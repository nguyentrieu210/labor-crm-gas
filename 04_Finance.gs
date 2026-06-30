/**
 * 04_Finance.gs — Công nợ 2 trục độc lập (BR-D).
 * Trục THỜI GIAN: giai_doan_aging (theo số ngày quá hạn).
 * Trục TIỀN: trang_thai_thu (unpaid/partial/paid).
 * Nhãn hợp nhất giai_doan_truy_thu (BR-D6b). Test Vectors D1–D4.
 */

function toDate_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  var s = String(v).trim();
  if (!s) return null;
  var d = new Date(s.length > 10 ? s : (s + 'T00:00:00'));
  return isNaN(d.getTime()) ? null : d;        // ngày sai định dạng → null (không trả Invalid Date)
}

/* Ngưỡng aging: ưu tiên đọc từ sheet AgingThreshold, fallback SEED_AGING. */
function agingRows_() {
  var rows = [];
  try { rows = dbAll('AgingThreshold'); } catch (e) {}
  if (rows.length) {
    return rows.map(function (r) {
      return { code: r.giai_doan_aging, tu: num_(r.tu_ngay),
               den: (r.den_ngay === '' || r.den_ngay === null || r.den_ngay === undefined) ? null : num_(r.den_ngay) };
    });
  }
  return SEED_AGING.map(function (a) { return { code: a[0], tu: a[1], den: (a[2] === '' ? null : a[2]) }; });
}

function mapAging_(soNgay) {
  var rows = agingRows_();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (soNgay >= r.tu && (r.den === null || soNgay <= r.den)) return r.code;
  }
  return 'not_due';
}

/* Tính các trường dẫn xuất từ 1 bản ghi công nợ. asOf để test (mặc định hôm nay VN). */
function deriveReceivable_(o, asOf) {
  asOf = asOf || todayVN_();
  var so_tien = num_(o.so_tien), da_thu = num_(o.da_thu);
  var con_lai = so_tien - da_thu;
  var due = o.ngay_den_han ? toDate_(o.ngay_den_han) : null;
  var soNgay = due ? Math.max(0, Math.floor((asOf.getTime() - due.getTime()) / 86400000)) : 0;
  var thu = (con_lai <= 0) ? 'paid' : (da_thu === 0 ? 'unpaid' : 'partial');
  var aging = mapAging_(soNgay);
  var patch = {
    con_lai: con_lai, so_ngay_qua_han: soNgay, trang_thai_thu: thu,
    giai_doan_aging: aging,
    // BR-D8 + Test Vector D1/D3: None khi chưa thu (da_thu=0) hoặc so_tien=0
    ty_le_thu_hoi: (da_thu && so_tien) ? pct4_(da_thu / so_tien) : null
  };
  var overridden = (o.giai_doan_override === true || String(o.giai_doan_override) === 'true');
  if (!overridden) {
    patch.giai_doan_truy_thu = (thu === 'paid') ? 'fully_collected'
      : (thu === 'partial') ? 'partial_collected' : aging;   // BR-D6b
  }
  return patch;
}

/* Áp dụng tính toán vào 1 bản ghi (ghi sheet). */
function applyReceivableDerive(name) {
  var o = dbGet('Receivable', name);
  if (!o) throw new Error('Không tìm thấy Receivable ' + name);
  var patch = deriveReceivable_(o);
  dbUpdate('Receivable', name, patch);
  return patch;
}

/* Cron đêm: re-age toàn bộ công nợ chưa đóng. */
function nightlyReage() {
  var n = 0;
  dbAll('Receivable').forEach(function (o) {
    var patch = deriveReceivable_(o);
    dbUpdate('Receivable', o.name, patch);
    n++;
  });
  return n;
}

/* Ghi nhận thu tiền: cộng da_thu, append log, tính lại. (API record_collection) */
function recordCollection(name, soTienThu, noiDung) {
  var o = dbGet('Receivable', name);
  if (!o) throw new Error('Không tìm thấy Receivable ' + name);
  var st = num_(soTienThu);
  if (!(st > 0)) throw new Error('Số tiền thu phải > 0.');                 // chặn số âm/0 (BR-D3)
  var moi = num_(o.da_thu) + st;
  if (moi > num_(o.so_tien)) throw new Error('Đã thu (' + moi + ') vượt Số tiền (' + o.so_tien + ') — BR-D3.');
  dbInsert('ReceivableLog', {
    parent: name, thoi_diem: nowTs_(), so_tien_thu: st,
    giai_doan: o.giai_doan_aging, nguoi_thuc_hien: userEmail_(), noi_dung: noiDung || ''
  });
  audit_('Receivable', name, 'collection', 'da_thu', o.da_thu, moi);
  dbUpdate('Receivable', name, { da_thu: moi });
  var patch = applyReceivableDerive(name);
  if (typeof rcvSyncMoneyState === 'function') rcvSyncMoneyState(name);  // đồng bộ workflow (GĐ3)
  return patch;
}

/* ===== Test Vectors D1–D4 (as_of = 2026-06-28) ===== */
function runReceivableTests() {
  var asOf = new Date('2026-06-28T00:00:00');
  var cases = [
    { id: 'D1', so_tien: 100000000, da_thu: 0,        ngay_den_han: '2026-07-10', con: 100000000, ng: 0,  aging: 'not_due',     thu: 'unpaid',  truy: 'not_due',           ty: null },
    { id: 'D2', so_tien: 50000000,  da_thu: 20000000, ngay_den_han: '2026-06-20', con: 30000000,  ng: 8,  aging: 'remind_2',    thu: 'partial', truy: 'partial_collected', ty: 0.4 },
    { id: 'D3', so_tien: 80000000,  da_thu: 0,        ngay_den_han: '2026-05-01', con: 80000000,  ng: 58, aging: 'negotiation', thu: 'unpaid',  truy: 'negotiation',       ty: null },
    { id: 'D4', so_tien: 30000000,  da_thu: 30000000, ngay_den_han: '2026-04-01', con: 0,         ng: 88, aging: 'legal',       thu: 'paid',    truy: 'fully_collected',   ty: 1.0 }
  ];
  var pass = 0, fail = 0, msgs = [];
  cases.forEach(function (c) {
    var p = deriveReceivable_(c, asOf);
    var ok = num_(p.con_lai) === c.con && num_(p.so_ngay_qua_han) === c.ng &&
             p.giai_doan_aging === c.aging && p.trang_thai_thu === c.thu &&
             p.giai_doan_truy_thu === c.truy && eqNum_(p.ty_le_thu_hoi, c.ty);
    if (ok) pass++;
    else { fail++; msgs.push(c.id + ' FAIL → con=' + p.con_lai + ' ng=' + p.so_ngay_qua_han +
      ' aging=' + p.giai_doan_aging + ' thu=' + p.trang_thai_thu + ' truy=' + p.giai_doan_truy_thu + ' ty=' + p.ty_le_thu_hoi); }
  });
  var res = 'Receivable Tests: ' + pass + ' PASS / ' + fail + ' FAIL' + (msgs.length ? ('\n' + msgs.join('\n')) : '');
  Logger.log(res);
  try { SpreadsheetApp.getActive().toast(res, 'runReceivableTests', 8); } catch (e) {}
  return fail === 0;
}
