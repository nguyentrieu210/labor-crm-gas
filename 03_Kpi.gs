/**
 * 03_Kpi.gs — Engine KPI tuần (DẪN XUẤT, read-only).
 * FULL OUTER JOIN (merge object) giữa WeeklyDemand (KPI giao) và DailyReport (phễu)
 * theo khóa (tuan × du_an × chuyen_vien). Test Vectors T1–T5.
 */

/* ISO week "YYYY-Www" (bắt đầu Thứ Hai). */
function isoWeekString_(d) {
  var date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  var yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  var week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  var ww = week < 10 ? '0' + week : '' + week;
  return date.getUTCFullYear() + '-W' + ww;
}

/* Làm tròn half-up 4 chữ số; giữ null. */
function pct4_(x) {
  if (x === null || x === undefined) return null;
  return Math.round(x * 10000) / 10000;
}

/* Công thức tỷ lệ (BR-K1..K3, K9). */
function deriveRatios_(r) {
  var kpi = num_(r.kpi_giao), dk = num_(r.dang_ky), pv = num_(r.phong_van),
      dopv = num_(r.do_pv_so_nguoi), dl = num_(r.di_lam), nhu = num_(r.nhu_cau_kh);
  return {
    fill_rate:    kpi ? pct4_(dl / kpi) : null,   // BR-K1: KPI=0 → None
    chuyen_doi:   dk ? pct4_(dl / dk) : 0,         // BR-K2: ĐK=0 → 0
    ti_le_dau_pv: pv ? pct4_(dopv / pv) : 0,       // BR-K3: PV=0 → 0
    dat_nhu_cau:  nhu ? pct4_(dl / nhu) : null     // BR-K9: nhu cầu=0 → None
  };
}

/* FULL OUTER JOIN cho 1 tuần → mảng row KPI. */
function computeFullOuter_(tuan) {
  var prjIndex = {};
  dbAll('Project').forEach(function (p) { prjIndex[p.name] = p; });

  var nc = {}, bc = {};
  dbQuery('WeeklyDemand', { tuan: tuan }).forEach(function (r) {
    var k = r.du_an + '||' + r.chuyen_vien;
    var a = nc[k] || (nc[k] = { kpi_giao: 0, nhu_cau_kh: 0 });
    a.kpi_giao += num_(r.kpi_giao);
    a.nhu_cau_kh += num_(r.nhu_cau_kh_tuan);
  });
  dbQuery('DailyReport', function (r) {
    return String(r.tuan) === String(tuan) && num_(r.docstatus) < 2;
  }).forEach(function (r) {
    var k = r.du_an + '||' + r.chuyen_vien;
    var a = bc[k] || (bc[k] = { dang_ky: 0, phong_van: 0, do_pv: 0, di_lam: 0 });
    a.dang_ky += num_(r.dang_ky); a.phong_van += num_(r.phong_van);
    a.do_pv += num_(r.do_pv); a.di_lam += num_(r.di_lam);
  });

  var keys = {};
  Object.keys(nc).forEach(function (k) { keys[k] = 1; });
  Object.keys(bc).forEach(function (k) { keys[k] = 1; });

  var rows = [];
  Object.keys(keys).forEach(function (k) {
    var parts = k.split('||'), du_an = parts[0], cv = parts[1];
    var d = nc[k], n = bc[k], prj = prjIndex[du_an];
    var row = {
      tuan: tuan, du_an: du_an, chuyen_vien: cv,
      chi_nhanh: prj ? prj.branch : '', quan_ly: prj ? prj.quan_ly_phu_trach : '',
      kpi_giao: d ? d.kpi_giao : 0, nhu_cau_kh: d ? d.nhu_cau_kh : 0,
      dang_ky: n ? n.dang_ky : 0, phong_van: n ? n.phong_van : 0,
      do_pv_so_nguoi: n ? n.do_pv : 0, di_lam: n ? n.di_lam : 0,
      co_lech_chuyen_vien: (!d) || (!n)              // BR-K8
    };
    var rt = deriveRatios_(row);
    for (var f in rt) row[f] = rt[f];
    rows.push(row);
  });
  return rows;
}

/* Tính lại 1 tuần → upsert WeeklyKPI theo (tuan,du_an,chuyen_vien), dọn dòng thừa. Idempotent. */
function recomputeWeek(tuan) {
  var rows = computeFullOuter_(tuan);
  var seen = {};
  rows.forEach(function (r) {
    var found = dbQuery('WeeklyKPI', { tuan: r.tuan, du_an: r.du_an, chuyen_vien: r.chuyen_vien });
    if (found.length) { dbUpdate('WeeklyKPI', found[0].name, r); seen[found[0].name] = 1; }
    else { seen[dbInsert('WeeklyKPI', r)] = 1; }
  });
  dbQuery('WeeklyKPI', { tuan: tuan }).forEach(function (r) {
    if (!seen[r.name]) dbDelete('WeeklyKPI', r.name);
  });
  dbInsert('KpiRecomputeLog', { tuan: tuan, so_dong: rows.length, nguoi: userEmail_(), thoi_diem: nowTs_() });
  return rows.length;
}

/* Tính lại mọi tuần có dữ liệu. */
function recomputeAllWeeks() {
  var set = {};
  dbAll('WeeklyDemand').forEach(function (r) { if (r.tuan) set[r.tuan] = 1; });
  dbAll('DailyReport').forEach(function (r) { if (r.tuan) set[r.tuan] = 1; });
  var weeks = Object.keys(set);
  weeks.forEach(function (w) { recomputeWeek(w); });
  return weeks.length;
}

/* Tính lại TOÀN BỘ tuần trong 1 lượt: đọc Demand+Daily+Project mỗi sheet 1 lần,
   gom trong RAM, ghi WeeklyKPI 1 lần (setValues). Dùng cho migration (tránh timeout). */
function recomputeAllWeeksBulk() {
  var prj = {};
  dbAll('Project').forEach(function (p) { prj[p.name] = p; });

  var agg = {};
  function ensure(k, week, du, cv) {
    return agg[k] || (agg[k] = {
      tuan: week, du_an: du, chuyen_vien: cv, kpi_giao: 0, nhu_cau_kh: 0,
      dang_ky: 0, phong_van: 0, do_pv_so_nguoi: 0, di_lam: 0, _d: false, _r: false
    });
  }
  dbAll('WeeklyDemand').forEach(function (r) {
    if (!r.tuan) return;
    var a = ensure(r.tuan + '||' + r.du_an + '||' + r.chuyen_vien, r.tuan, r.du_an, r.chuyen_vien);
    a.kpi_giao += num_(r.kpi_giao); a.nhu_cau_kh += num_(r.nhu_cau_kh_tuan); a._d = true;
  });
  dbAll('DailyReport').forEach(function (r) {
    if (!r.tuan || num_(r.docstatus) >= 2) return;
    var a = ensure(r.tuan + '||' + r.du_an + '||' + r.chuyen_vien, r.tuan, r.du_an, r.chuyen_vien);
    a.dang_ky += num_(r.dang_ky); a.phong_van += num_(r.phong_van);
    a.do_pv_so_nguoi += num_(r.do_pv); a.di_lam += num_(r.di_lam); a._r = true;
  });

  var objs = [];
  Object.keys(agg).forEach(function (k) {
    var a = agg[k], p = prj[a.du_an];
    a.chi_nhanh = p ? p.branch : '';
    a.quan_ly = p ? p.quan_ly_phu_trach : '';
    a.co_lech_chuyen_vien = !(a._d && a._r);
    var rt = deriveRatios_(a);
    for (var f in rt) a[f] = rt[f];
    a.name = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
    objs.push(a);
  });
  dbClear('WeeklyKPI');
  dbBulkInsert('WeeklyKPI', objs);
  var weeks = {};
  objs.forEach(function (o) { weeks[o.tuan] = 1; });
  return { weeks: Object.keys(weeks).length, rows: objs.length };
}

/* Tính lại n tuần gần nhất (self-heal cron). */
function recomputeRecentWeeks() {
  var d = todayVN_(), n = 0;
  for (var i = 0; i < 3; i++) {
    recomputeWeek(isoWeekString_(d));
    d.setDate(d.getDate() - 7); n++;
  }
  return n;
}

/* Validate phễu BR-F1 (throw nếu vi phạm); trả cảnh báo mềm VR-W4 nếu có. */
function validateDailyFunnel_(o) {
  var dk = num_(o.dang_ky), pv = num_(o.phong_van), dopv = num_(o.do_pv), dl = num_(o.di_lam);
  if (!(dk >= pv && pv >= dopv && dopv >= 0)) {
    throw new Error('Sai phễu (BR-F1): cần Đăng ký ≥ Phỏng vấn ≥ Đỗ PV ≥ 0. Hiện: '
      + dk + '/' + pv + '/' + dopv);
  }
  return (dl > dopv) ? 'Cảnh báo (VR-W4): Đi làm (' + dl + ') > Đỗ PV (' + dopv + ').' : '';
}

/* ===== Test Vectors T1–T5 ===== */
function runKpiTests() {
  var cases = [
    { id: 'T1', hasD: 1, hasR: 1, kpi_giao: 100, dang_ky: 6, phong_van: 6, do_pv_so_nguoi: 5, di_lam: 4, nhu_cau_kh: 0, fill: 0.04, cd: 0.6667, tl: 0.8333, lech: false },
    { id: 'T2', hasD: 1, hasR: 1, kpi_giao: 100, dang_ky: 11, phong_van: 6, do_pv_so_nguoi: 6, di_lam: 10, nhu_cau_kh: 0, fill: 0.10, cd: 0.9091, tl: 1.0, lech: false },
    { id: 'T3', hasD: 0, hasR: 1, kpi_giao: 0, dang_ky: 5, phong_van: 3, do_pv_so_nguoi: 2, di_lam: 1, nhu_cau_kh: 0, fill: null, cd: 0.20, tl: 0.6667, lech: true },
    { id: 'T4', hasD: 1, hasR: 0, kpi_giao: 100, dang_ky: 0, phong_van: 0, do_pv_so_nguoi: 0, di_lam: 0, nhu_cau_kh: 0, fill: 0.0, cd: 0, tl: 0, lech: true },
    { id: 'T5', hasD: 1, hasR: 1, kpi_giao: 50, dang_ky: 80, phong_van: 70, do_pv_so_nguoi: 65, di_lam: 60, nhu_cau_kh: 0, fill: 1.20, cd: 0.75, tl: 0.9286, lech: false }
  ];
  var pass = 0, fail = 0, msgs = [];
  cases.forEach(function (c) {
    var r = deriveRatios_(c);
    var lech = (!c.hasD) || (!c.hasR);
    var ok = eqNum_(r.fill_rate, c.fill) && eqNum_(r.chuyen_doi, c.cd) &&
             eqNum_(r.ti_le_dau_pv, c.tl) && (lech === c.lech);
    if (ok) pass++;
    else { fail++; msgs.push(c.id + ' FAIL → fill=' + r.fill_rate + ' cd=' + r.chuyen_doi + ' tl=' + r.ti_le_dau_pv + ' lech=' + lech); }
  });
  var res = 'KPI Tests: ' + pass + ' PASS / ' + fail + ' FAIL' + (msgs.length ? ('\n' + msgs.join('\n')) : '');
  Logger.log(res);
  try { SpreadsheetApp.getActive().toast(res, 'runKpiTests', 8); } catch (e) {}
  return fail === 0;
}

function eqNum_(a, b) {
  if (a === null || b === null) return a === b;
  return Math.abs(num_(a) - num_(b)) < 1e-9;
}
