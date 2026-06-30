/**
 * 11_Jobs.gs — Job nền (thay scheduler). Backup spreadsheet hằng ngày.
 * (Cần quyền Drive — Apps Script tự xin khi chạy; trigger chạy dưới quyền owner.)
 */

var BACKUP_FOLDER = 'Labor CRM Backups';
var BACKUP_KEEP = 30;

/* Tạo bản sao spreadsheet vào folder backup, giữ lại N bản mới nhất. */
function jobBackupSpreadsheet() {
  var ss = SpreadsheetApp.getActive();
  var folder = getOrCreateFolder_(BACKUP_FOLDER);
  var stamp = Utilities.formatDate(new Date(), TZ, 'yyyyMMdd-HHmmss');
  var copy = DriveApp.getFileById(ss.getId()).makeCopy('LaborCRM-backup-' + stamp, folder);
  pruneBackups_(folder, BACKUP_KEEP);
  return copy.getId();
}

function getOrCreateFolder_(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function pruneBackups_(folder, keep) {
  var arr = [], it = folder.getFiles();
  while (it.hasNext()) arr.push(it.next());
  arr.sort(function (a, b) { return b.getDateCreated().getTime() - a.getDateCreated().getTime(); });
  for (var i = keep; i < arr.length; i++) arr[i].setTrashed(true);
}

function menuBackupNow() {
  var id = jobBackupSpreadsheet();
  SpreadsheetApp.getActive().toast('Đã tạo backup (' + id + ').', 'Backup', 6);
}
