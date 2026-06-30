/**
 * 05_Crm.gs — Chăm sóc khách hàng: cadence cố định không drift (BR-C),
 * auto Quá hạn, sinh lượt kế. Trạng thái dùng workflow_state (SM-1).
 */

/* States SM-1 */
var CARE_PENDING = 'Care Pending';
var CARE_IN_PROGRESS = 'Care In Progress';
var CARE_DONE = 'Care Done';
var CARE_OVERDUE = 'Care Overdue';

/* Mặc định theo phân loại KH (BR-C1/C2). */
function careDefaultsForClass_(phanLoai) {
  if (phanLoai === 'trong_diem') return { hoat_dong: 'meeting', tan_suat: 'weekly_1' };
  return { hoat_dong: 'phone', tan_suat: 'monthly_1' };  // Thường
}

/* Ngày kế tiếp theo cadence (anchor cố định, BR-C4). */
function nextCadenceDate_(fromDate, tanSuat) {
  var cf = dbQuery('CareFrequency', { tan_suat: tanSuat });
  var type = cf.length ? cf[0].cadence_type : 'none';
  var d = new Date(fromDate.getTime());
  if (type === 'weekly') { d.setDate(d.getDate() + 7); return d; }
  if (type === 'monthly') { d.setMonth(d.getMonth() + 1); return d; }
  if (type === 'quarterly') { d.setMonth(d.getMonth() + 3); return d; }
  if (type === 'mark_1_15') {                       // 2 mốc lịch cố định 1 & 15
    if (d.getDate() < 15) d.setDate(15);
    else { d.setMonth(d.getMonth() + 1); d.setDate(1); }
    return d;
  }
  return null;                                       // none / on_demand
}

/* Tạo task chăm sóc mặc định khi tạo/đổi phân loại KH (Luồng B). */
function createDefaultCareTask(khachHangName) {
  var kh = dbGet('Customer', khachHangName);
  if (!kh) throw new Error('Không tìm thấy Customer ' + khachHangName);
  var def = careDefaultsForClass_(kh.phan_loai);
  var today = todayVN_();
  var ngay = Utilities.formatDate(today, TZ, 'yyyy-MM-dd');
  return dbInsert('CareTask', {
    khach_hang: kh.name, chi_nhanh: kh.branch, quan_ly: kh.quan_ly_phu_trach,
    hoat_dong: def.hoat_dong, tan_suat: def.tan_suat,
    ngay_kh: ngay, mocneo_cadence: ngay, workflow_state: CARE_PENDING
  });
}

/* BR-M5: KH đổi phân loại → cập nhật default cho task chưa hoàn thành. */
function resyncPendingCareTasks(khachHangName) {
  var kh = dbGet('Customer', khachHangName);
  if (!kh) return 0;
  var def = careDefaultsForClass_(kh.phan_loai);
  var n = 0;
  dbQuery('CareTask', function (o) {
    return String(o.khach_hang) === khachHangName &&
      (String(o.workflow_state) === CARE_PENDING || String(o.workflow_state) === CARE_IN_PROGRESS);
  }).forEach(function (o) {
    dbUpdate('CareTask', o.name, { hoat_dong: def.hoat_dong, tan_suat: def.tan_suat });
    n++;
  });
  return n;
}

/* Cron ngày: auto Quá hạn (BR-C8). */
function markOverdueCare() {
  var today = todayVN_(), n = 0;
  // chỉ đánh Quá hạn task CHƯA bắt đầu (không cướp trạng thái Đang xử lý)
  dbQuery('CareTask', function (o) {
    var d = toDate_(o.ngay_kh);
    return String(o.workflow_state) === CARE_PENDING &&
      d && d.getTime() < today.getTime();
  }).forEach(function (o) {
    dbUpdate('CareTask', o.name, { workflow_state: CARE_OVERDUE });
    audit_('CareTask', o.name, 'wf', 'state', CARE_PENDING, CARE_OVERDUE);
    n++;
  });
  return n;
}

/* Hoàn thành 1 lượt → append log → sinh lượt kế (cadence cố định). */
function completeCareTask(name, noiDung, ketQua) {
  var t = dbGet('CareTask', name);
  if (!t) throw new Error('Không tìm thấy CareTask ' + name);
  if (!noiDung || !String(noiDung).trim()) throw new Error('Phải nhập nội dung chăm sóc (has_log).');
  var st = String(t.workflow_state);
  if ([CARE_PENDING, CARE_IN_PROGRESS, CARE_OVERDUE].indexOf(st) < 0)
    throw new Error('Chỉ hoàn thành từ Chưa hoàn thành/Đang xử lý/Quá hạn (hiện: ' + (st || '—') + ').');
  dbInsert('CareLog', {
    parent: name, thoi_diem: nowTs_(), noi_dung: noiDung,
    nguoi_thuc_hien: userEmail_(), ket_qua: ketQua || 'Đã liên hệ'
  });
  dbUpdate('CareTask', name, { workflow_state: CARE_DONE });
  audit_('CareTask', name, 'wf', 'state', st, CARE_DONE);
  var next = generateNextCareTask_(t);
  return { next_task: next };
}

function generateNextCareTask_(t) {
  var anchor = toDate_(t.mocneo_cadence) || toDate_(t.ngay_kh) || todayVN_();
  var nd = nextCadenceDate_(anchor, t.tan_suat);
  if (!nd) return null;                              // on_demand → không sinh
  var ngay = Utilities.formatDate(nd, TZ, 'yyyy-MM-dd');
  var nm = dbInsert('CareTask', {
    khach_hang: t.khach_hang, chi_nhanh: t.chi_nhanh, quan_ly: t.quan_ly,
    hoat_dong: t.hoat_dong, tan_suat: t.tan_suat,
    ngay_kh: ngay, mocneo_cadence: ngay, workflow_state: CARE_PENDING
  });
  audit_('CareTask', nm, 'create', 'cadence', '', ngay);
  return nm;
}

/* Danh sách việc đến hạn / quá hạn (cho dashboard). */
function getDueCareTasks(quanLy) {
  var today = todayVN_();
  return dbQuery('CareTask', function (o) {
    var st = String(o.workflow_state);
    if (st === CARE_DONE) return false;
    if (quanLy && String(o.quan_ly) !== quanLy) return false;
    var d = toDate_(o.ngay_kh);
    return st === CARE_OVERDUE || (d && d.getTime() <= today.getTime());
  });
}
