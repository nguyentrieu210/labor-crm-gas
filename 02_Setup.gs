/**
 * 02_Setup.gs — Tạo toàn bộ tab theo SCHEMA + seed dữ liệu nền.
 * Chạy 1 lần: setupAll()
 */

function setupAll() {
  ormAllow_();
  createAllSheets_();
  seedCategoryValues();
  seedBranches();
  seedSettings();
  seedProjectAliases();
  seedAdminEmail_();
  seedAdminUser_();
  SpreadsheetApp.getActive().toast('Đã tạo schema + seed dữ liệu nền.', 'Labor CRM Setup', 6);
}

/* Tạo bản ghi Users cho người chạy setup (role ADMIN) — để có người vào app ngay. */
function seedAdminUser_() {
  var em = userEmail_();
  if (!em) return;
  if (dbGet('Users', em)) return;
  dbInsert('Users', {
    user_email: em, active: true, role: 'ADMIN', staff_id: '', branch_id: '',
    display_name: 'Quản trị', locale: 'vi', created_at: nowTs_()
  });
}

/* Ghi email người chạy setup vào allow-list ADMIN (nếu chưa có) để không bị khóa khỏi app. */
function seedAdminEmail_() {
  try {
    var props = PropertiesService.getScriptProperties();
    if (!props.getProperty('ADMIN_EMAILS')) {
      var em = userEmail_();
      if (em) props.setProperty('ADMIN_EMAILS', em);
    }
  } catch (e) {}
}

/* Tạo tất cả sheet (nếu chưa có) + ghi header + đóng băng hàng 1. Idempotent. */
function createAllSheets_() {
  var ss = ssApp_();
  for (var key in SCHEMA) {
    var e = SCHEMA[key];
    var sh = ss.getSheetByName(e.sheet);
    if (!sh) sh = ss.insertSheet(e.sheet);
    // ghi header
    sh.getRange(1, 1, 1, e.headers.length).setValues([e.headers]);
    sh.getRange(1, 1, 1, e.headers.length).setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  // dọn sheet mặc định "Sheet1"/"Trang tính1" nếu trống
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);
}

/* Seed enum song ngữ — idempotent theo (category_group + enum_code). */
function seedCategoryValues() {
  var count = 0;
  for (var group in SEED_CATEGORY) {
    var list = SEED_CATEGORY[group];
    for (var i = 0; i < list.length; i++) {
      var code = list[i][0], vi = list[i][1], zh = list[i][2];
      var obj = {
        category_group: group, enum_code: code, gia_tri: vi, ten_trung: zh,
        display_order: i + 1, is_enabled: true
      };
      var res = dbUpsert('CategoryValue', ['category_group', 'enum_code'], obj);
      if (res.created) count++;
    }
  }
  return count;
}

/* Seed 7 chi nhánh — idempotent theo name. */
function seedBranches() {
  var count = 0;
  for (var i = 0; i < SEED_BRANCHES.length; i++) {
    var b = SEED_BRANCHES[i];
    var obj = { name: b[0], name_zh: b[1], branch_code: b[2], region: b[3], is_active: true };
    var res = dbUpsert('Branch', ['name'], obj);
    if (res.created) count++;
  }
  return count;
}

/* Seed Settings (single key/value) + ngưỡng aging + cadence chăm sóc. */
function seedSettings() {
  dbUpsert('Settings', ['name'], { name: 'timezone', value: TZ });
  dbUpsert('Settings', ['name'], { name: 'week_start', value: 'Monday (ISO)' });

  for (var i = 0; i < SEED_AGING.length; i++) {
    var a = SEED_AGING[i];
    dbUpsert('AgingThreshold', ['giai_doan_aging'],
      { giai_doan_aging: a[0], tu_ngay: a[1], den_ngay: a[2] });
  }
  for (var j = 0; j < SEED_CARE_FREQ.length; j++) {
    var c = SEED_CARE_FREQ[j];
    dbUpsert('CareFrequency', ['tan_suat'],
      { tan_suat: c[0], cadence_type: c[1], chu_ky_ngay: c[2] });
  }
}

/* Seed alias dự án cứng. Chỉ tạo bản ghi alias nếu project canonical đã tồn tại;
   nếu chưa có Project tương ứng → bỏ qua (sẽ tạo khi migration). */
function seedProjectAliases() {
  for (var i = 0; i < SEED_PROJECT_ALIAS.length; i++) {
    var alias = SEED_PROJECT_ALIAS[i][0], canonical = SEED_PROJECT_ALIAS[i][1];
    var prj = dbQuery('Project', { project_name: canonical });
    var prjName = prj.length ? prj[0].name : '';
    dbUpsert('ProjectAlias', ['alias_normalized'], {
      alias: alias, alias_normalized: normalizeText_(alias), project: prjName
    });
  }
}

/* Tạo dữ liệu DEMO để test nhanh Web App (chỉ chạy khi Staff đang trống). */
function seedDemo() {
  ormAllow_();
  if (dbAll('Staff').length) {
    SpreadsheetApp.getActive().toast('Đã có dữ liệu — bỏ qua seedDemo.', 'Demo', 5);
    return;
  }
  var br = 'Bắc Ninh';
  var an = dbInsert('Staff', { full_name: 'Nguyễn Văn An', branch: br, vai_tro: 'ops_manager', trang_thai: 'chinh_thuc', is_active: true });
  var binh = dbInsert('Staff', { full_name: 'Trần Thị Bình', branch: br, vai_tro: 'ops_specialist', trang_thai: 'chinh_thuc', is_active: true });

  var kh = dbInsert('Customer', { customer_name: 'Goertek', customer_name_zh: '歌尔', branch: br,
    phan_loai: 'trong_diem', dich_vu: 'cho_thue_lai', quan_ly_phu_trach: an, is_active: true });
  var prj = dbInsert('Project', { project_name: 'Goertek Bắc Ninh', customer: kh, branch: br,
    phan_loai: 'trong_diem', dich_vu: 'cho_thue_lai', quan_ly_phu_trach: an, trang_thai: 'dang_van_hanh', is_active: true });

  var tuan = isoWeekString_(todayVN_());
  dbInsert('WeeklyDemand', { tuan: tuan, chi_nhanh: br, du_an: prj, quan_ly: an, chuyen_vien: binh,
    nhu_cau_kh_tuan: 200, kpi_giao: 100 });

  var ngay = Utilities.formatDate(todayVN_(), TZ, 'yyyy-MM-dd');
  dbInsert('DailyReport', { ngay: ngay, tuan: tuan, du_an: prj, chi_nhanh: br, phuong_thuc: 'truc_tiep',
    chuyen_vien: binh, dang_ky: 60, phong_van: 40, do_pv: 30, di_lam: 25, docstatus: 1 });
  dbInsert('DailyReport', { ngay: ngay, tuan: tuan, du_an: prj, chi_nhanh: br, phuong_thuc: 'doi_tac',
    chuyen_vien: binh, dang_ky: 40, phong_van: 30, do_pv: 22, di_lam: 18, docstatus: 1 });
  recomputeWeek(tuan);

  var due = Utilities.formatDate(new Date(todayVN_().getTime() - 20 * 86400000), TZ, 'yyyy-MM-dd');
  var cn = dbInsert('Receivable', { chi_nhanh: br, khach_hang: kh, du_an: prj, quan_ly_phu_trach: an,
    ky_cong_no: 'T05/2026', so_tien: 150000000, ngay_den_han: due, da_thu: 50000000 });
  applyReceivableDerive(cn);

  createDefaultCareTask(kh);
  SpreadsheetApp.getActive().toast('Đã tạo dữ liệu demo (Goertek Bắc Ninh).', 'Demo', 6);
}

/* Chuẩn hóa chuỗi: trim + gộp khoảng trắng + bỏ dấu + UPPER (dùng cho alias matching). */
function normalizeText_(raw) {
  var s = String(raw || '').trim().replace(/\s+/g, ' ');
  // bỏ dấu tiếng Việt (đ trước vì không phân rã qua NFD)
  s = s.replace(/đ/g, 'd').replace(/Đ/g, 'D');
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return s.toUpperCase();
}
