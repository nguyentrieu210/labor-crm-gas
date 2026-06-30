/**
 * 09_Rbac.gs — Phân quyền 3 tầng (GĐ3).
 *  Tầng 1: ma trận quyền theo module (R/W/C/D) — MODULE_PERMS.
 *  Tầng 2: scope theo chi nhánh (branch).
 *  Tầng 3: thu hẹp theo người phụ trách (OM thấy CV dưới quyền; SPV chỉ thấy của mình).
 * So khớp bằng ID, mặc định DENY.
 */

var ROLE_CODE = {
  'System Manager': 'ADMIN', 'BOD': 'BOD', 'Branch Manager': 'BM',
  'Operations Manager': 'OM', 'Operations Specialist': 'SPV'
};

/* Ma trận quyền: module → role → tổ hợp 'R'(đọc) 'W'(sửa) 'C'(tạo) 'D'(xóa). */
var MODULE_PERMS = {
  Customer:     { ADMIN: 'RWCD', BOD: 'R', BM: 'RWC',  OM: 'RWC', SPV: 'R'  },
  Project:      { ADMIN: 'RWCD', BOD: 'R', BM: 'RWCD', OM: 'RW',  SPV: 'R'  },
  Workshop:     { ADMIN: 'RWCD', BOD: 'R', BM: 'RWC',  OM: 'RWC', SPV: 'R'  },
  Staff:        { ADMIN: 'RWCD', BOD: 'R', BM: 'R',    OM: 'R',   SPV: 'R'  },
  Policy:       { ADMIN: 'RWCD', BOD: 'R', BM: 'RWC',  OM: 'RWC', SPV: 'R'  },
  WeeklyDemand: { ADMIN: 'RWCD', BOD: 'R', BM: 'RWC',  OM: 'RWC', SPV: 'R'  },
  DailyReport:  { ADMIN: 'RWCD', BOD: 'R', BM: 'RWC',  OM: 'RWC', SPV: 'RC' }, // SPV: tạo + đọc; sửa nếu owner (T+1)
  WeeklyKPI:    { ADMIN: 'R',    BOD: 'R', BM: 'R',    OM: 'R',   SPV: 'R'  }, // dẫn xuất, chỉ đọc
  Receivable:   { ADMIN: 'RWCD', BOD: 'R', BM: 'RWC',  OM: 'RWC', SPV: ''   }, // ẩn với SPV
  CareTask:     { ADMIN: 'RWCD', BOD: 'R', BM: 'RWC',  OM: 'RWC', SPV: ''   }, // ẩn với SPV
  AuditLog:     { ADMIN: 'R',    BOD: 'R', BM: 'R',    OM: '',    SPV: ''   },
  NameQueue:    { ADMIN: 'RWCD', BOD: 'R', BM: 'RW',   OM: '',    SPV: ''   },
  Users:        { ADMIN: 'RWCD', BOD: '',  BM: '',     OM: '',    SPV: ''   },
  CategoryValue:{ ADMIN: 'RWCD', BOD: 'R', BM: 'R',    OM: 'R',   SPV: 'R'  },
  Branch:       { ADMIN: 'RWCD', BOD: 'R', BM: 'R',    OM: 'R',   SPV: 'R'  }
};

function permOf_(moduleKey, role) {
  var m = MODULE_PERMS[moduleKey];
  if (!m) return role === 'ADMIN' ? 'RWCD' : '';   // mặc định DENY cho module lạ
  return m[role] || '';
}
function permCan_(moduleKey, role, op) { return permOf_(moduleKey, role).indexOf(op) >= 0; }

/* Email được cấp ADMIN tường minh (script property ADMIN_EMAILS, phân tách bằng dấu phẩy).
   setupAll() tự ghi email người chạy vào đây. */
function isAdminEmail_(email) {
  if (!email) return false;
  var raw = '';
  try { raw = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAILS') || ''; } catch (e) {}
  return raw.split(',').map(function (s) { return s.trim().toLowerCase(); }).indexOf(String(email).toLowerCase()) >= 0;
}

function bool_(v) {
  if (v === true) return true;
  var s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'có' || s === 'x';
}
function roleCodeToFull_(code) {
  return code === 'ADMIN' ? 'System Manager' : code === 'BOD' ? 'BOD'
    : code === 'BM' ? 'Branch Manager' : code === 'OM' ? 'Operations Manager'
    : code === 'SPV' ? 'Operations Specialist' : 'Chưa cấp quyền';
}
/* Tra người dùng trong sheet Users theo email (không phân biệt hoa thường). */
function resolveUser_(email) {
  if (!email) return null;
  var e = String(email).trim().toLowerCase(), rows;
  try { rows = dbAll('Users'); } catch (x) { return null; }
  for (var i = 0; i < rows.length; i++) {
    var ue = String(rows[i].user_email || rows[i].name || '').trim().toLowerCase();
    if (ue === e) return rows[i];
  }
  return null;
}

/* Ngữ cảnh người dùng — ưu tiên sheet Users (chuẩn spec), MẶC ĐỊNH DENY. */
function userContext_() {
  ormAllow_();                               // đã qua entry api hợp lệ → mở khóa ghi ORM cho request này
  var email = userEmail_();
  // 1) Lớp Users
  var u = email ? resolveUser_(email) : null;
  if (u && bool_(u.active)) {
    var code = String(u.role || '').trim().toUpperCase();
    var staff = u.staff_id ? dbGet('Staff', u.staff_id) : null;
    return {
      email: email, staff: u.staff_id || (staff ? staff.name : ''), staffObj: staff,
      roleFull: roleCodeToFull_(code), role: (code || 'NONE'),
      branch: u.branch_id || (staff ? staff.branch : ''),
      locale: u.locale || 'vi', display_name: u.display_name || ''
    };
  }
  // 2) Fallback bootstrap: ADMIN_EMAILS (trước khi seed Users)
  if (isAdminEmail_(email))
    return { email: email, staff: '', staffObj: null, roleFull: 'System Manager', role: 'ADMIN', branch: '', locale: 'vi', display_name: 'Quản trị' };
  // 3) Fallback legacy: Staff.user/email
  var staff2 = resolveStaff_(email);
  if (staff2) {
    var rf = vaiTroToRole_(staff2.vai_tro);
    var rc = ROLE_CODE[rf] || 'SPV';
    if (rc === 'ADMIN' || rc === 'BOD') { rc = 'BM'; rf = roleCodeToFull_('BM'); }  // fallback Staff KHÔNG được cấp ADMIN/BOD (chỉ Users/ADMIN_EMAILS)
    return { email: email, staff: staff2.name, staffObj: staff2, roleFull: rf, role: rc, branch: staff2.branch, locale: 'vi', display_name: staff2.full_name };
  }
  // 4) DENY
  return { email: email, staff: '', staffObj: null, roleFull: 'Chưa cấp quyền', role: 'NONE', branch: '', locale: 'vi', display_name: '' };
}

/* Tập dự án OM phụ trách. */
function myProjects_(staffName) {
  return dbQuery('Project', { quan_ly_phu_trach: staffName }).map(function (p) { return p.name; });
}
/* CV dưới quyền OM = quan_ly_truc_tiep==me ∪ chuyên viên trong dự án mình QL ∪ chính mình. */
function mySupervisees_(staffName, projSet) {
  var set = {};
  set[staffName] = 1;
  dbQuery('Staff', { quan_ly_truc_tiep: staffName }).forEach(function (s) { set[s.name] = 1; });
  dbAll('ProjectSpecialist').forEach(function (ps) {
    if (projSet[ps.parent] && ps.specialist) set[ps.specialist] = 1;
  });
  return set;
}
function customersOfProjects_(projNames) {
  var set = {};
  projNames.forEach(function (p) { var d = dbGet('Project', p); if (d && d.customer) set[d.customer] = 1; });
  return set;
}
/* map khách hàng → chi nhánh (cho module không có cột branch như Policy). */
function customerBranchMap_() {
  var m = {};
  dbAll('Customer').forEach(function (c) { m[c.name] = c.branch; });
  return m;
}

/* Lọc dòng theo scope (thay applyScope_ cũ). ctx = userContext_(). */
function scopeRows_(moduleKey, rows, ctx) {
  if (ctx.role === 'ADMIN' || ctx.role === 'BOD') return rows;
  var e = entity_(SCHEMA[moduleKey] ? moduleKey : moduleKey);
  var bf = e.headers.indexOf('chi_nhanh') >= 0 ? 'chi_nhanh' : (e.headers.indexOf('branch') >= 0 ? 'branch' : null);

  // Tầng 2: branch (nếu module có cột branch trực tiếp)
  if (bf && ctx.branch) {
    rows = rows.filter(function (o) {
      var v = String(o[bf]);
      return v === ctx.branch || (v === '' && ctx.role === 'BM');   // chỉ BM thấy bản ghi chưa gán chi nhánh
    });
  } else if (!bf && ctx.branch && (moduleKey === 'Policy')) {
    var cbmap = customerBranchMap_();
    rows = rows.filter(function (o) { return String(cbmap[o.khach_hang] || '') === ctx.branch; });
  }
  if (ctx.role === 'BM') return rows;

  var me = ctx.staff;
  if (!me) return [];                                  // không map được Staff → deny (trừ ADMIN/BOD ở trên)

  if (ctx.role === 'OM') {
    var projs = myProjects_(me);
    var projSet = {}; projs.forEach(function (p) { projSet[p] = 1; });
    var sup = mySupervisees_(me, projSet);
    var custs = customersOfProjects_(projs);
    return rows.filter(function (o) {
      switch (moduleKey) {
        case 'DailyReport': return projSet[o.du_an] || sup[o.chuyen_vien];
        case 'WeeklyDemand':
        case 'WeeklyKPI':   return projSet[o.du_an] || sup[o.chuyen_vien] || String(o.quan_ly) === me;
        case 'Receivable':  return String(o.quan_ly_phu_trach) === me;
        case 'CareTask':    return String(o.quan_ly) === me;
        case 'Customer':    return String(o.quan_ly_phu_trach) === me || custs[o.name];
        case 'Project':     return projSet[o.name];
        case 'Policy':      return custs[o.khach_hang];
        default:            return true;                // master khác: đã lọc theo branch
      }
    });
  }

  // SPV
  return rows.filter(function (o) {
    switch (moduleKey) {
      case 'DailyReport':
      case 'WeeklyDemand':
      case 'WeeklyKPI':   return String(o.chuyen_vien) === me;
      case 'Receivable':
      case 'CareTask':    return false;                // ẩn
      default:            return true;                 // master: đọc trong branch
    }
  });
}

/* Kiểm tra quyền ghi 1 bản ghi; throw nếu không được. */
function assertCanSave_(moduleKey, ctx, data) {
  var isNew = !data.name;
  // Ngoại lệ BR-F7: SPV được sửa báo cáo ngày của CHÍNH MÌNH trong cửa sổ T+1
  // (dù ma trận quyền 'RC' không có 'W').
  if (moduleKey === 'DailyReport' && ctx.role === 'SPV' && !isNew) {
    assertDailyEditWindow_(ctx, data);
    return;
  }
  var op = isNew ? 'C' : 'W';
  if (permCan_(moduleKey, ctx.role, op)) return;
  throw new Error('Bạn không có quyền ' + (isNew ? 'tạo' : 'sửa') + ' ' + moduleKey + ' (vai trò ' + ctx.roleFull + ').');
}

/* BR-F7: SPV chỉ sửa báo cáo của mình trong vòng T+1 (đến hết hôm sau ngày báo cáo). */
function assertDailyEditWindow_(ctx, data) {
  var cur = dbGet('DailyReport', data.name);
  if (!cur) throw new Error('Không tìm thấy báo cáo để sửa.');
  if (String(cur.chuyen_vien) !== ctx.staff) throw new Error('Chỉ sửa được báo cáo của chính bạn.');
  var ngay = toDate_(cur.ngay);
  if (ngay) {
    var han = new Date(ngay.getTime()); han.setDate(han.getDate() + 2);   // hết 23:59 ngày hôm sau
    if (todayVN_().getTime() >= han.getTime())
      throw new Error('Quá cửa sổ sửa T+1 — chỉ Quản lý chi nhánh/Admin sửa được.');
  }
  // SPV không được đổi các field định danh/scope — khôi phục từ bản ghi gốc
  data.chuyen_vien = cur.chuyen_vien;
  data.du_an = cur.du_an;
  data.chi_nhanh = cur.chi_nhanh;
  data.ngay = cur.ngay;
}

/* Bản ghi có nằm trong phạm vi của user không (chống IDOR). Dùng bản ghi HIỆN TẠI từ DB. */
function assertRowInScope_(moduleKey, ctx, record) {
  if (ctx.role === 'ADMIN' || ctx.role === 'BOD') return;
  if (!record) throw new Error('Không tìm thấy bản ghi.');
  if (!scopeRows_(moduleKey, [record], ctx).length)
    throw new Error('Bản ghi ngoài phạm vi của bạn (' + ctx.roleFull + ').');
}

function assertCanRead_(moduleKey, ctx) {
  if (!permCan_(moduleKey, ctx.role, 'R'))
    throw new Error('Bạn không có quyền xem ' + moduleKey + ' (vai trò ' + ctx.roleFull + ').');
}
