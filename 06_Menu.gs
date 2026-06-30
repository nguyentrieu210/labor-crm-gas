/**
 * 06_Menu.gs — Menu điều khiển + cài đặt time-trigger tự động (thay scheduler_events Frappe).
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ Thành công')
    .addItem('① Khởi tạo schema + seed (chạy 1 lần)', 'setupAll')
    .addItem('② Tạo dữ liệu demo (test nhanh)', 'seedDemo')
    .addSeparator()
    .addItem('🔄 Tính lại KPI tuần hiện tại', 'recomputeCurrentWeek')
    .addItem('🔄 Tính lại TẤT CẢ tuần', 'menuRecomputeAll')
    .addItem('💰 Re-age toàn bộ công nợ', 'menuReage')
    .addItem('📞 Quét chăm sóc quá hạn', 'menuMarkOverdue')
    .addItem('💾 Backup spreadsheet ngay', 'menuBackupNow')
    .addSeparator()
    .addItem('✅ Chạy test KPI (T1–T5)', 'runKpiTests')
    .addItem('✅ Chạy test Công nợ (D1–D4)', 'runReceivableTests')
    .addSeparator()
    .addItem('⏰ Bật tự động hằng ngày (~2h sáng)', 'installTriggers')
    .addItem('⛔ Tắt tự động', 'removeTriggers')
    .addToUi();
}

function recomputeCurrentWeek() {
  ormAllow_();
  var tuan = isoWeekString_(todayVN_());
  var n = recomputeWeek(tuan);
  SpreadsheetApp.getActive().toast('Đã tính KPI tuần ' + tuan + ': ' + n + ' dòng.', 'KPI', 6);
}

function menuRecomputeAll() {
  ormAllow_();
  var w = recomputeAllWeeks();
  SpreadsheetApp.getActive().toast('Đã tính lại ' + w + ' tuần.', 'KPI', 6);
}

function menuReage() {
  ormAllow_();
  var n = nightlyReage();
  SpreadsheetApp.getActive().toast('Đã re-age ' + n + ' khoản công nợ.', 'Công nợ', 6);
}

function menuMarkOverdue() {
  ormAllow_();
  var n = markOverdueCare();
  SpreadsheetApp.getActive().toast('Đã đánh dấu ' + n + ' việc chăm sóc quá hạn.', 'Chăm sóc', 6);
}

/* Job tổng hợp chạy đêm. */
function nightlyAll() {
  ormAllow_();
  recomputeRecentWeeks();   // self-heal KPI 3 tuần gần nhất
  nightlyReage();           // aging công nợ
  markOverdueCare();        // quá hạn chăm sóc
  try { jobBackupSpreadsheet(); } catch (e) {}   // backup (bỏ qua nếu thiếu quyền Drive)
}

function installTriggers() {
  removeTriggers();
  ScriptApp.newTrigger('nightlyAll').timeBased().everyDays(1).atHour(2).create();
  SpreadsheetApp.getUi().alert('Đã bật tự động: mỗi ngày ~2h sáng sẽ tính lại KPI, re-age công nợ, quét chăm sóc quá hạn.');
}

function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'nightlyAll') ScriptApp.deleteTrigger(t);
  });
}
