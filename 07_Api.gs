/**
 * 07_Api.gs — Web App: doGet + API whitelisted cho mini-app (gọi qua google.script.run).
 * Engine list/form tổng quát điều khiển bằng MODULES (08_Meta.gs).
 * RBAC mức GĐ2: lọc theo chi nhánh của user (OM/SPV chi tiết sẽ ở GĐ3).
 */

function doGet() {
  return HtmlService.createTemplateFromFile('App')
    .evaluate()
    .setTitle('Thành công — Quản lý điều hành')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* ===== Phiên & vai trò ===== */
function resolveStaff_(email) {
  if (!email) return null;
  var rows = dbQuery('Staff', function (o) {
    return String(o.user) === email || String(o.email) === email;
  });
  return rows.length ? rows[0] : null;
}
function vaiTroToRole_(v) {
  return v === 'branch_manager' ? 'Branch Manager'
    : v === 'ops_manager' ? 'Operations Manager'
    : v === 'ops_specialist' ? 'Operations Specialist'
    : v === 'bod' ? 'BOD'
    : v === 'admin' ? 'System Manager'
    : 'Operations Specialist';   // vai trò lạ → quyền THẤP NHẤT, không fail-open thành ADMIN
}

/* Đảm bảo admin hiện tại (đăng nhập qua ADMIN_EMAILS) có 1 dòng trong sheet Users để quản lý. */
function ensureSelfUser_(ctx) {
  if (!ctx || !ctx.email || ctx.role !== 'ADMIN') return;
  try {
    if (dbGet('Users', ctx.email)) return;
    dbInsert('Users', {
      user_email: ctx.email, active: true, role: 'ADMIN',
      staff_id: ctx.staff || '', branch_id: ctx.branch || '',
      display_name: ctx.display_name || 'Quản trị', locale: ctx.locale || 'vi', created_at: nowTs_()
    });
  } catch (e) { /* không chặn boot nếu seed lỗi */ }
}

function apiBootstrap() {
  var ctx = userContext_();
  ensureSelfUser_(ctx);
  var mods = MODULES
    .filter(function (m) { return permCan_(m.key, ctx.role, 'R'); })
    .map(function (m) {
      var c = Object.assign({}, m);
      c.canCreate = permCan_(m.key, ctx.role, 'C');
      return c;
    });
  var dw = latestDataWeek_();
  return {
    email: ctx.email,
    staff: ctx.staff,
    staff_name: ctx.staffObj ? ctx.staffObj.full_name : '',
    role: ctx.roleFull,
    roleCode: ctx.role,
    branch: ctx.branch,
    locale: ctx.locale || 'vi',
    branches: dbAll('Branch').map(function (b) { return b.name; }),
    week: isoWeekString_(todayVN_()),
    data_week: dw,
    modules: mods,
    dashboard: (function () { try { return apiDashboard(dw, ctx.branch); } catch (e) { return null; } })()  // gộp boot → 1 round-trip
  };
}

/* Tuần có dữ liệu mới nhất (để Dashboard mặc định về tuần có số liệu). */
function latestDataWeek_() {
  var max = '';
  dbAll('WeeklyKPI').forEach(function (r) { if (r.tuan && String(r.tuan) > max) max = String(r.tuan); });
  if (!max) dbAll('WeeklyDemand').forEach(function (r) { if (r.tuan && String(r.tuan) > max) max = String(r.tuan); });
  return max;
}

function apiEnums(group) {
  var rows = dbQuery('CategoryValue', function (o) { return String(o.category_group) === group; });
  rows.sort(function (a, b) { return num_(a.display_order) - num_(b.display_order); });
  return rows
    .filter(function (r) { return String(r.is_enabled) !== 'false' && r.is_enabled !== false; })
    .map(function (r) { return { code: r.enum_code, vi: r.gia_tri, zh: r.ten_trung || r.gia_tri }; });
}

function apiLookup(doctype, txt, limit) {
  limit = limit || 20;
  // Chỉ cho lookup entity cần cho dropdown form; chặn liệt kê Users/Receivable/CareTask/AuditLog/NameQueue
  var LOOKUP_WHITELIST = { Branch: 1, Staff: 1, Customer: 1, Project: 1, Workshop: 1, Policy: 1 };
  if (!LOOKUP_WHITELIST[doctype]) throw new Error('Không cho phép lookup: ' + doctype);
  var ctx = userContext_();
  assertCanRead_(doctype, ctx);                        // key === doctype trong MODULE_PERMS
  var df = DISPLAY_FIELD[doctype] || 'name';
  var t = String(txt || '').toLowerCase();
  var rows = scopeRows_(doctype, dbAll(doctype), ctx), out = [];   // lọc theo phạm vi chi nhánh/row
  for (var i = 0; i < rows.length && out.length < limit; i++) {
    var disp = String(rows[i][df] || rows[i].name);
    if (!t || disp.toLowerCase().indexOf(t) >= 0 || String(rows[i].name).toLowerCase().indexOf(t) >= 0) {
      out.push({ value: rows[i].name, label: disp });
    }
  }
  return out;
}

/* ===== Helper hiển thị ===== */
function fieldMeta_(m, f) {
  for (var i = 0; i < m.fields.length; i++) if (m.fields[i].f === f) return m.fields[i];
  return null;
}
function formatMoney_(n) {
  if (n === '' || n === null || n === undefined) return '';
  n = Math.round(num_(n));
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' đ';
}
function formatDate_(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'dd/MM/yyyy');
  var s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}
function resolveDisplay_(m, f, value, lang) {
  if (value === '' || value === null || value === undefined) return '';
  var fm = fieldMeta_(m, f);
  if (!fm) return value;
  if (fm.type === 'link') { var df = DISPLAY_FIELD[fm.link] || 'name'; return dbVal(fm.link, value, df) || value; }
  if (fm.type === 'enum') return categoryLabel_(fm.group, value, lang);
  if (fm.type === 'pct') return (num_(value) * 100).toFixed(2) + '%';
  if (fm.type === 'currency') return formatMoney_(value);
  if (fm.type === 'check') return (value === true || String(value) === 'true') ? '✓' : '';
  if (fm.type === 'date') return formatDate_(value);
  return value;
}

/* ===== List / Get / Save ===== */
function apiList(key, opts) {
  opts = opts || {};
  var ctx = userContext_();
  assertCanRead_(key, ctx);
  var m = moduleByKey_(key);
  var rows = dbAll(m.doctype);
  if (opts.filters) {
    rows = rows.filter(function (o) {
      for (var k in opts.filters) if (String(o[k]) !== String(opts.filters[k])) return false;
      return true;
    });
  }
  if (opts.week) rows = rows.filter(function (o) { return String(o.tuan) === String(opts.week); });
  rows = scopeRows_(key, rows, ctx);
  if (opts.search) {
    var t = String(opts.search).toLowerCase();
    rows = rows.filter(function (o) {
      if (String(o.name).toLowerCase().indexOf(t) >= 0) return true;
      for (var i = 0; i < m.list.length; i++)
        if (String(o[m.list[i]] || '').toLowerCase().indexOf(t) >= 0) return true;
      return false;
    });
  }
  rows.sort(function (a, b) { return String(b.name).localeCompare(String(a.name)); });
  rows = rows.slice(0, opts.limit || 500);
  var lang = opts.lang || 'vi';
  // Cache link + enum MỘT lần (tránh O(n^2) khi list nghìn dòng)
  var linkMaps = {}, catMap = null;
  m.list.forEach(function (f) {
    var fm = fieldMeta_(m, f);
    if (!fm) return;
    if (fm.type === 'link' && !linkMaps[fm.link]) {
      var df = DISPLAY_FIELD[fm.link] || 'name', mp = {};
      dbAll(fm.link).forEach(function (r) { mp[r.name] = r[df]; });
      linkMaps[fm.link] = mp;
    }
    if (fm.type === 'enum' && !catMap) {
      catMap = {};
      dbAll('CategoryValue').forEach(function (r) {
        (catMap[r.category_group] || (catMap[r.category_group] = {}))[r.enum_code] =
          (lang === 'zh' && r.ten_trung) ? r.ten_trung : r.gia_tri;
      });
    }
  });
  return rows.map(function (o) {
    var cells = {};
    m.list.forEach(function (f) {
      var fm = fieldMeta_(m, f), v = o[f];
      if (v === '' || v == null) { cells[f] = ''; return; }
      if (fm && fm.type === 'link') cells[f] = (linkMaps[fm.link] && linkMaps[fm.link][v]) || v;
      else if (fm && fm.type === 'enum') cells[f] = (catMap && catMap[fm.group] && catMap[fm.group][v]) || v;
      else cells[f] = resolveDisplay_(m, f, v, lang);
    });
    var raw = {};   // sanitize Date → chuỗi để google.script.run không trả null cả mảng
    for (var rk in o) { var rv = o[rk]; raw[rk] = (rv instanceof Date) ? Utilities.formatDate(rv, TZ, 'yyyy-MM-dd HH:mm:ss') : rv; }
    return { name: o.name, cells: cells, raw: raw };
  });
}

/* Danh sách người dùng — trả dữ liệu SẠCH (chuỗi/boolean), KHÔNG kèm raw/Date/_row,
   tránh lỗi google.script.run serialize cả mảng thành null (cột created_at là Date). */
function apiUsersList() {
  var ctx = userContext_();
  assertCanRead_('Users', ctx);
  return dbAll('Users').map(function (o) {
    return {
      name: String(o.name || ''),
      user_email: String(o.user_email || o.name || ''),
      role: String(o.role || ''),
      staff_id: String(o.staff_id || ''),
      staff_name: o.staff_id ? String(dbVal('Staff', o.staff_id, 'full_name') || o.staff_id) : '',
      branch_id: String(o.branch_id || ''),
      active: (o.active === true || String(o.active) === 'true'),
      display_name: String(o.display_name || '')
    };
  });
}

function apiGet(key, name) {
  var ctx = userContext_();
  assertCanRead_(key, ctx);
  var m = moduleByKey_(key);
  var o = dbGet(m.doctype, name);
  if (!o) throw new Error('Không tìm thấy ' + name);
  assertRowInScope_(key, ctx, o);                 // chống IDOR đọc
  var labels = {};
  m.fields.forEach(function (fm) {
    if (fm.type === 'link' && o[fm.f]) {
      var df = DISPLAY_FIELD[fm.link] || 'name';
      labels[fm.f] = dbVal(fm.link, o[fm.f], df) || o[fm.f];
    }
  });
  return { doc: o, labels: labels };
}

function validateReqd_(m, data) {
  m.fields.forEach(function (fm) {
    if (fm.reqd && (data[fm.f] === '' || data[fm.f] === null || data[fm.f] === undefined))
      throw new Error('Thiếu trường bắt buộc: ' + fm.label.vi);
  });
}

function apiSave(key, data) {
  var ctx = userContext_();
  var m = moduleByKey_(key);
  if (m.readonly) throw new Error('Module chỉ đọc, không lưu được.');
  if (m.onSave) throw new Error('Module này phải lưu qua ' + m.onSave + ' (không dùng apiSave).');
  var isNew = !data.name;
  if (!isNew) assertRowInScope_(key, ctx, dbGet(m.doctype, data.name));  // IDOR ghi: kiểm bản ghi CŨ
  assertCanSave_(key, ctx, data);
  if (isNew && ctx.role !== 'ADMIN' && ctx.role !== 'BOD' && ctx.branch) {   // tạo mới: khóa theo chi nhánh user
    var eSave = entity_(m.doctype);
    var bfSave = eSave.headers.indexOf('chi_nhanh') >= 0 ? 'chi_nhanh'
      : (eSave.headers.indexOf('branch') >= 0 ? 'branch' : null);
    if (bfSave) {
      if (data[bfSave] && String(data[bfSave]) !== String(ctx.branch))
        throw new Error('Không thể tạo bản ghi cho chi nhánh khác.');
      data[bfSave] = ctx.branch;
    } else if (m.key === 'Policy' && data.khach_hang) {
      var khSave = dbGet('Customer', data.khach_hang);
      if (khSave && khSave.branch && String(khSave.branch) !== String(ctx.branch))
        throw new Error('Không thể tạo chính sách cho khách hàng ngoài chi nhánh của bạn.');
    }
  }
  validateReqd_(m, data);
  if (m.key === 'CareTask' && isNew) {
    if (!data.workflow_state) data.workflow_state = CARE_PENDING;
    if (!data.chi_nhanh && data.khach_hang) { var kh = dbGet('Customer', data.khach_hang); if (kh) data.chi_nhanh = kh.branch; }
  }
  var name;
  if (isNew) { name = dbInsert(m.doctype, data); audit_(m.doctype, name, 'create'); }
  else { name = data.name; dbUpdate(m.doctype, name, data); audit_(m.doctype, name, 'update'); }

  if (m.key === 'Customer') { isNew ? createDefaultCareTask(name) : resyncPendingCareTasks(name); }
  if (m.key === 'Receivable') { applyReceivableDerive(name); isNew ? rcvInitState_(name) : rcvSyncMoneyState(name); }
  return { name: name };
}

/* ===== Hành động đặc thù ===== */
function apiSubmitDaily(data) {
  var ctx = userContext_();
  var m = moduleByKey_('DailyReport');
  if (data.name) assertRowInScope_('DailyReport', ctx, dbGet('DailyReport', data.name));  // IDOR khi sửa
  if (ctx.role === 'SPV') data.chuyen_vien = ctx.staff;    // SPV chỉ báo cáo cho chính mình
  assertCanSave_('DailyReport', ctx, data);
  validateReqd_(m, data);
  var warn = validateDailyFunnel_(data);                   // throws nếu vi phạm BR-F1
  var dt = toDate_(data.ngay);
  if (!dt) throw new Error('Ngày báo cáo không hợp lệ.');  // chặn ngày sai → tuần rác 'NaN-WNaN'
  data.tuan = isoWeekString_(dt);
  data.docstatus = 1;
  var prj = dbGet('Project', data.du_an);
  if (!data.name) {                                        // tạo mới: dự án phải thuộc phạm vi user
    if (!prj) throw new Error('Dự án không tồn tại.');
    assertRowInScope_('Project', ctx, prj);
  }
  data.chi_nhanh = prj ? prj.branch : '';
  var isNew = !data.name, name;
  if (isNew) name = dbInsert('DailyReport', data);
  else { name = data.name; dbUpdate('DailyReport', name, data); }
  audit_('DailyReport', name, isNew ? 'create' : 'update');
  recomputeWeek(data.tuan);
  return { name: name, warn: warn, tuan: data.tuan };
}

function apiSubmitDemand(data) {
  var ctx = userContext_();
  if (data.name) assertRowInScope_('WeeklyDemand', ctx, dbGet('WeeklyDemand', data.name));  // IDOR khi sửa
  assertCanSave_('WeeklyDemand', ctx, data);
  var m = moduleByKey_('WeeklyDemand');
  validateReqd_(m, data);
  var warn = '';
  if (num_(data.kpi_giao) > num_(data.nhu_cau_kh_tuan)) warn = 'VR-W6: KPI giao > Nhu cầu KH. ';
  if (num_(data.nhu_cau_kh_tuan) > 0 && num_(data.kpi_giao) === 0) warn += 'VR-W3: có nhu cầu nhưng KPI giao=0.';
  var prj = dbGet('Project', data.du_an);
  if (!data.name) {                                        // tạo mới: dự án phải thuộc phạm vi user
    if (!prj) throw new Error('Dự án không tồn tại.');
    assertRowInScope_('Project', ctx, prj);
  }
  data.chi_nhanh = prj ? prj.branch : '';
  var isNew = !data.name, name;
  if (isNew) name = dbInsert('WeeklyDemand', data);
  else { name = data.name; dbUpdate('WeeklyDemand', name, data); }
  audit_('WeeklyDemand', name, isNew ? 'create' : 'update');
  recomputeWeek(data.tuan);
  return { name: name, warn: warn };
}

function apiCompleteCare(name, noiDung, ketQua) {
  var ctx = userContext_();
  if (!permCan_('CareTask', ctx.role, 'W')) throw new Error('Không có quyền cập nhật chăm sóc.');
  assertRowInScope_('CareTask', ctx, dbGet('CareTask', name));
  return completeCareTask(name, noiDung, ketQua);
}
function apiRecordCollection(name, soTienThu, noiDung) {
  var ctx = userContext_();
  if (!permCan_('Receivable', ctx.role, 'W')) throw new Error('Không có quyền ghi thu công nợ.');
  assertRowInScope_('Receivable', ctx, dbGet('Receivable', name));
  return recordCollection(name, soTienThu, noiDung);
}

/* ===== Workflow endpoints (GĐ3) — đều kiểm scope bản ghi (chống IDOR) ===== */
function rcvScoped_(name) {
  var ctx = userContext_();
  assertRowInScope_('Receivable', ctx, dbGet('Receivable', name));
}
function apiRcvProposeLegal(name) { rcvScoped_(name); return rcvProposeLegal(name); }
function apiRcvApproveLegal(name) { rcvScoped_(name); return rcvApproveLegal(name); }
function apiRcvRejectLegal(name) { rcvScoped_(name); return rcvRejectLegal(name); }
function apiRcvOverrideStage(name, stage) { rcvScoped_(name); return rcvOverrideStage(name, stage); }
function apiCareStart(name) {
  var ctx = userContext_();
  if (!permCan_('CareTask', ctx.role, 'W')) throw new Error('Không có quyền cập nhật chăm sóc.');
  assertRowInScope_('CareTask', ctx, dbGet('CareTask', name));
  return careStart(name);
}

function apiResolveQueue(name) {
  var ctx = userContext_();
  if (['ADMIN', 'BM'].indexOf(ctx.role) < 0) throw new Error('Chỉ ADMIN/Quản lý chi nhánh xử lý hàng đợi.');
  dbUpdate('NameQueue', name, { status: 'resolved' });
  audit_('NameQueue', name, 'resolve', 'status', 'pending', 'resolved');
  return { ok: true };
}

/* ===== Khách hàng 360 (GĐ2-UI) ===== */
function apiCustomer360(name) {
  var ctx = userContext_();
  assertCanRead_('Customer', ctx);
  var c = dbGet('Customer', name);
  if (!c) throw new Error('Không tìm thấy khách hàng ' + name);
  assertRowInScope_('Customer', ctx, c);
  return {
    customer: {
      name: c.name, customer_name: c.customer_name, branch: c.branch,
      phan_loai: categoryLabel_('phan_loai_kh', c.phan_loai, ctx.locale || 'vi'),
      quan_ly: dbVal('Staff', c.quan_ly_phu_trach, 'full_name') || c.quan_ly_phu_trach || ''
    },
    projects: dbQuery('Project', { customer: name }).map(function (p) {
      return { name: p.name, ten: p.project_name, trang_thai: categoryLabel_('trang_thai_da', p.trang_thai, ctx.locale) };
    }),
    workshops: dbQuery('Workshop', { customer: name }).map(function (w) { return { name: w.name, ten: w.workshop_name }; }),
    policies: dbQuery('Policy', { khach_hang: name }).map(function (p) {
      return { name: p.name, xuong: dbVal('Workshop', p.xuong, 'workshop_name') || p.xuong || '',
        dang_tuyen: categoryLabel_('dang_tuyen', p.dang_tuyen, ctx.locale), don_gia: formatMoney_(p.don_gia) };
    }),
    care: dbQuery('CareTask', { khach_hang: name }).map(function (t) {
      return { name: t.name, hoat_dong: categoryLabel_('loai_hoat_dong', t.hoat_dong, ctx.locale),
        ngay_kh: formatDate_(t.ngay_kh), trang_thai: t.workflow_state };
    }),
    receivables: dbQuery('Receivable', { khach_hang: name }).map(function (r) {
      return { name: r.name, ky: r.ky_cong_no, so_tien: formatMoney_(r.so_tien), con_lai: formatMoney_(r.con_lai),
        giai_doan: categoryLabel_('giai_doan_truy_thu', r.giai_doan_truy_thu, ctx.locale) };
    })
  };
}

/* ===== Nhập nhu cầu tuần hàng loạt (grid) ===== */
function apiBulkDemand(week, branch) {
  var ctx = userContext_();
  if (!permCan_('WeeklyDemand', ctx.role, 'C')) throw new Error('Không có quyền nhập nhu cầu.');
  var br = branch || ctx.branch;
  var projs = dbQuery('Project', function (o) {
    return String(o.trang_thai) === 'dang_van_hanh' && (!br || String(o.branch) === br);
  });
  projs = scopeRows_('Project', projs, ctx);
  var existing = {};
  dbQuery('WeeklyDemand', { tuan: week }).forEach(function (d) { existing[d.du_an + '||' + d.chuyen_vien] = d; });
  var rows = [];
  projs.forEach(function (p) {
    var specs = dbQuery('ProjectSpecialist', { parent: p.name });
    var list = specs.length
      ? specs.map(function (s) { return { staff: s.specialist, ten: dbVal('Staff', s.specialist, 'full_name') || s.specialist }; })
      : [{ staff: '', ten: '(chưa gán CV)' }];
    list.forEach(function (s) {
      var ex = existing[p.name + '||' + s.staff];
      rows.push({
        du_an: p.name, du_an_ten: p.project_name, quan_ly: p.quan_ly_phu_trach, chi_nhanh: p.branch,
        chuyen_vien: s.staff, chuyen_vien_ten: s.ten,
        nhu_cau: ex ? ex.nhu_cau_kh_tuan : '', kpi: ex ? ex.kpi_giao : '', existing: ex ? ex.name : ''
      });
    });
  });
  return { week: week, branch: br, rows: rows };
}

function apiSaveBulkDemand(week, rows) {
  var ctx = userContext_();
  if (!permCan_('WeeklyDemand', ctx.role, 'C')) throw new Error('Không có quyền nhập nhu cầu.');
  var n = 0;
  (rows || []).forEach(function (r) {
    var blank = (r.nhu_cau === '' || r.nhu_cau == null) && (r.kpi === '' || r.kpi == null);
    if (blank) return;
    // Lấy Project tin cậy từ DB (KHÔNG tin chi_nhanh/quan_ly client gửi) + kiểm phạm vi
    var prj = dbGet('Project', r.du_an);
    if (!prj) throw new Error('Dự án không hợp lệ: ' + r.du_an);
    assertRowInScope_('Project', ctx, prj);
    var data = {
      tuan: week, du_an: r.du_an, chuyen_vien: r.chuyen_vien,
      nhu_cau_kh_tuan: num_(r.nhu_cau), kpi_giao: num_(r.kpi),
      chi_nhanh: prj.branch, quan_ly: prj.quan_ly_phu_trach   // derive từ Project
    };
    if (r.existing) {
      assertRowInScope_('WeeklyDemand', ctx, dbGet('WeeklyDemand', r.existing));   // chống IDOR ghi đè
      dbUpdate('WeeklyDemand', r.existing, data);
    } else {
      dbInsert('WeeklyDemand', data);
    }
    n++;
  });
  recomputeWeek(week);
  return { saved: n };
}

/* ===== Dashboard ===== */
function apiDashboard(week, branch) {
  var ctx = userContext_();
  var role = ctx.roleFull;
  if (ctx.role === 'NONE')
    return { week: week, branch: '', role: role, kpi: {}, funnel: [], aging: [],
             tong_con_lai: 0, tong_qua_han: 0, due_care: 0, dq: { kh_thieu_ql: 0, alias_queue: 0 } };
  var br = (ctx.role === 'ADMIN' || ctx.role === 'BOD') ? (branch || '') : (ctx.branch || '');   // non-admin LUÔN khóa theo chi nhánh mình

  var kpis = dbQuery('WeeklyKPI', { tuan: week });
  if (br) kpis = kpis.filter(function (o) { return String(o.chi_nhanh) === br; });
  var s = { kpi_giao: 0, nhu_cau_kh: 0, dang_ky: 0, phong_van: 0, do_pv: 0, di_lam: 0, lech: 0 };
  kpis.forEach(function (o) {
    s.kpi_giao += num_(o.kpi_giao); s.nhu_cau_kh += num_(o.nhu_cau_kh);
    s.dang_ky += num_(o.dang_ky); s.phong_van += num_(o.phong_van);
    s.do_pv += num_(o.do_pv_so_nguoi); s.di_lam += num_(o.di_lam);
    if (o.co_lech_chuyen_vien === true || String(o.co_lech_chuyen_vien) === 'true') s.lech++;
  });
  var kpi = {
    kpi_giao: s.kpi_giao, di_lam: s.di_lam, nhu_cau_kh: s.nhu_cau_kh, lech: s.lech,
    fill_rate: s.kpi_giao ? pct4_(s.di_lam / s.kpi_giao) : null,
    dat_nhu_cau: s.nhu_cau_kh ? pct4_(s.di_lam / s.nhu_cau_kh) : null,
    chuyen_doi: s.dang_ky ? pct4_(s.di_lam / s.dang_ky) : 0
  };
  var funnel = [
    { stage: 'Đăng ký', zh: '报名', value: s.dang_ky },
    { stage: 'Phỏng vấn', zh: '面试', value: s.phong_van },
    { stage: 'Đỗ PV', zh: '通过', value: s.do_pv },
    { stage: 'Đi làm', zh: '入职', value: s.di_lam }
  ];

  var rec = dbAll('Receivable');
  if (br) rec = rec.filter(function (o) { return String(o.chi_nhanh) === br; });
  var agingMap = {}, tongConLai = 0, tongQuaHan = 0;
  rec.forEach(function (o) {
    var g = o.giai_doan_aging || 'not_due';
    agingMap[g] = (agingMap[g] || 0) + num_(o.con_lai);
    tongConLai += num_(o.con_lai);
    if (num_(o.so_ngay_qua_han) > 0 && num_(o.con_lai) > 0) tongQuaHan += num_(o.con_lai);
  });
  var aging = Object.keys(agingMap).map(function (g) {
    return { code: g, label_vi: categoryLabel_('giai_doan_aging', g, 'vi'),
             label_zh: categoryLabel_('giai_doan_aging', g, 'zh'), value: agingMap[g] };
  });

  var due = getDueCareTasks(ctx.role === 'OM' ? ctx.staff : null);
  if (br) due = due.filter(function (o) { return String(o.chi_nhanh) === br || !o.chi_nhanh; });

  var custNoMgr = dbAll('Customer').filter(function (o) { return !o.quan_ly_phu_trach; });
  if (br) custNoMgr = custNoMgr.filter(function (o) { return String(o.branch) === br; });
  var queue = dbQuery('NameQueue', function (o) { return String(o.status) !== 'resolved'; });

  return {
    week: week, branch: br, role: role, kpi: kpi, funnel: funnel,
    aging: aging, tong_con_lai: tongConLai, tong_qua_han: tongQuaHan,
    due_care: due.length, dq: { kh_thieu_ql: custNoMgr.length, alias_queue: queue.length }
  };
}
