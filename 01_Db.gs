/**
 * 01_Db.gs — "ORM" tối giản trên Google Sheets.
 * Mọi truy cập dữ liệu đi qua đây để giữ nhất quán (đọc/ghi theo object, sinh `name`).
 */

function ssApp_() { return SpreadsheetApp.getActive(); }

/* Cache đọc theo-request (mỗi google.script.run là execution mới → cache tự reset, an toàn). */
var DB_CACHE_ = {};
function dbCacheClear_(key) { if (key) { delete DB_CACHE_[key]; } else { DB_CACHE_ = {}; } }

/* Chốt ghi nội bộ: ORM chỉ ghi khi đã đi qua entry hợp lệ (api* gọi userContext_, hoặc menu/job/migration
   gọi ormAllow_). Chặn client gọi thẳng google.script.run.dbUpdate('Users',..){role:'ADMIN'} bỏ qua RBAC. */
var ORM_OK_ = false;
function ormAllow_() { ORM_OK_ = true; }
function assertOrm_() {
  if (!ORM_OK_) throw new Error('Thao tác dữ liệu nội bộ — không thể gọi trực tiếp.');
}

function entity_(key) {
  var e = SCHEMA[key];
  if (!e) throw new Error('Entity không tồn tại trong SCHEMA: ' + key);
  return e;
}

function sheetByKey_(key) {
  var e = entity_(key);
  var sh = ssApp_().getSheetByName(e.sheet);
  if (!sh) throw new Error('Chưa tạo sheet "' + e.sheet + '" — hãy chạy setupAll() trước.');
  return sh;
}

/* Đọc toàn bộ entity thành mảng object (kèm `_row` = số dòng thật để update). */
function dbAll(key) {
  if (DB_CACHE_[key]) return DB_CACHE_[key];
  var e = entity_(key);
  var sh = sheetByKey_(key);
  var lr = sh.getLastRow();
  if (lr < 2) { DB_CACHE_[key] = []; return DB_CACHE_[key]; }
  var hs = e.headers;
  var vals = sh.getRange(2, 1, lr - 1, hs.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (String(r[0]).trim() === '') continue;
    var o = { _row: i + 2 };
    for (var c = 0; c < hs.length; c++) o[hs[c]] = r[c];
    out.push(o);
  }
  DB_CACHE_[key] = out;
  return out;
}

/* Lọc theo điều kiện object (so khớp bằng ==) hoặc hàm predicate. */
function dbQuery(key, where) {
  var rows = dbAll(key);
  if (!where) return rows;
  if (typeof where === 'function') return rows.filter(where);
  return rows.filter(function (o) {
    for (var k in where) if (String(o[k]) !== String(where[k])) return false;
    return true;
  });
}

function dbGet(key, name) {
  var rows = dbQuery(key, { name: name });
  return rows.length ? rows[0] : null;
}

/* Lấy 1 giá trị field của 1 bản ghi (như frappe.db.get_value). */
function dbVal(key, name, field) {
  var o = dbGet(key, name);
  return o ? o[field] : null;
}

/* Sinh `name` theo chiến lược naming của entity. */
function makeName_(key, obj) {
  var e = entity_(key);
  var n = e.naming;
  if (n === 'hash') return Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  if (n === 'group_enum') return obj.category_group + '-' + obj.enum_code;
  if (n.indexOf('field:') === 0) {
    var f = n.slice(6);
    var v = (f === 'name') ? obj.name : obj[f];
    if (!v) throw new Error('Thiếu giá trị cho naming field: ' + f);
    return String(v).trim();
  }
  if (n.indexOf('series:') === 0) {
    var prefix = n.slice(7);
    return prefix + nextSeq_(key, prefix);
  }
  throw new Error('Naming không hỗ trợ: ' + n);
}

/* Tìm số thứ tự kế tiếp cho naming series (quét cột name). Zero-pad 5, tự nới rộng. */
function nextSeq_(key, prefix) {
  var rows = dbAll(key);
  var max = 0;
  for (var i = 0; i < rows.length; i++) {
    var nm = String(rows[i].name);
    if (nm.indexOf(prefix) === 0) {
      var num = parseInt(nm.slice(prefix.length), 10);
      if (isFinite(num) && num > max) max = num;
    }
  }
  var next = max + 1;
  var s = String(next);
  while (s.length < 5) s = '0' + s;
  return s;
}

/* Chèn bản ghi mới. obj theo fieldname; tự sinh name nếu chưa có. Trả về name. */
function dbInsert(key, obj) {
  assertOrm_();
  var e = entity_(key);
  var sh = sheetByKey_(key);
  if (!obj.name) obj.name = makeName_(key, obj);
  var row = e.headers.map(function (h) {
    var v = obj[h];
    return (v === undefined || v === null) ? '' : v;
  });
  sh.appendRow(row);
  if (DB_CACHE_[key]) {                         // giữ cache ấm cho vòng lặp insert
    var co = { _row: sh.getLastRow() };
    for (var i = 0; i < e.headers.length; i++) co[e.headers[i]] = row[i];
    DB_CACHE_[key].push(co);
  }
  return obj.name;
}

/* Chèn nhiều bản ghi trong MỘT lần ghi (setValues) — nhanh hơn appendRow rất nhiều.
   Mỗi obj nên có sẵn `name` (tránh quét sinh series O(n²)). */
function dbBulkInsert(key, objs) {
  if (!objs || !objs.length) return 0;
  assertOrm_();
  var e = entity_(key);
  var sh = sheetByKey_(key);
  var matrix = objs.map(function (obj) {
    if (!obj.name) obj.name = makeName_(key, obj);
    return e.headers.map(function (h) {
      var v = obj[h];
      return (v === undefined || v === null) ? '' : v;
    });
  });
  var startRow = sh.getLastRow() + 1;
  sh.getRange(startRow, 1, matrix.length, e.headers.length).setValues(matrix);
  dbCacheClear_(key);
  return matrix.length;
}

/* Cập nhật bản ghi theo name với patch (chỉ ghi các field có trong patch). */
function dbUpdate(key, name, patch) {
  assertOrm_();
  var e = entity_(key);
  var sh = sheetByKey_(key);
  var o = dbGet(key, name);
  if (!o) throw new Error('Không tìm thấy ' + key + ' name=' + name);
  for (var f in patch) {
    var col = e.headers.indexOf(f);
    if (col < 0) continue;
    var v = patch[f] === undefined || patch[f] === null ? '' : patch[f];
    sh.getRange(o._row, col + 1).setValue(v);
    o[f] = v;                                    // đồng bộ cache (o là tham chiếu trong DB_CACHE_)
  }
  return name;
}

/* Upsert theo bộ field khóa (mảng tên field). Trả {name, created}. */
function dbUpsert(key, keyFields, obj) {
  var where = {};
  keyFields.forEach(function (f) { where[f] = obj[f]; });
  var found = dbQuery(key, where);
  if (found.length) {
    dbUpdate(key, found[0].name, obj);
    return { name: found[0].name, created: false };
  }
  return { name: dbInsert(key, obj), created: true };
}

function dbDelete(key, name) {
  assertOrm_();
  var sh = sheetByKey_(key);
  var o = dbGet(key, name);
  if (o) { sh.deleteRow(o._row); dbCacheClear_(key); }   // _row các dòng sau dịch chuyển → bỏ cache
}

/* Xóa toàn bộ dữ liệu (giữ header) — dùng khi recompute. */
function dbClear(key) {
  assertOrm_();
  var sh = sheetByKey_(key);
  var lr = sh.getLastRow();
  if (lr > 1) sh.getRange(2, 1, lr - 1, sh.getLastColumn()).clearContent();
  dbCacheClear_(key);
}

/* ===== Tiện ích chung ===== */
function num_(v) { var n = Number(v); return isFinite(n) ? n : 0; }
function nowTs_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function todayVN_() {
  var s = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  return new Date(s + 'T00:00:00');
}
function userEmail_() {
  try { return Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail(); }
  catch (e) { return ''; }
}

/* Ghi audit log (ai/khi/cũ→mới). */
function audit_(doctype, docname, action, field, oldV, newV) {
  try {
    dbInsert('AuditLog', {
      thoi_diem: nowTs_(), nguoi: userEmail_(), doctype: doctype, docname: docname,
      action: action, truong: field || '', gia_tri_cu: oldV == null ? '' : oldV,
      gia_tri_moi: newV == null ? '' : newV
    });
  } catch (e) { /* không chặn nghiệp vụ vì lỗi audit */ }
}

/* Nhãn enum theo locale ('vi' | 'zh'). */
function categoryLabel_(group, enumCode, lang) {
  if (!enumCode) return '';
  var rows = dbQuery('CategoryValue', { category_group: group, enum_code: enumCode });
  if (!rows.length) return enumCode;
  var r = rows[0];
  return (lang === 'zh' && r.ten_trung) ? r.ten_trung : r.gia_tri;
}

/* Danh sách giá trị 1 nhóm enum (cho dropdown), đã sắp theo display_order. */
function getCategoryValues(group, lang) {
  var rows = dbQuery('CategoryValue', function (o) {
    return String(o.category_group) === group && String(o.is_enabled) !== 'false' && o.is_enabled !== false;
  });
  rows.sort(function (a, b) { return num_(a.display_order) - num_(b.display_order); });
  return rows.map(function (r) {
    return { enum_code: r.enum_code, label: (lang === 'zh' && r.ten_trung) ? r.ten_trung : r.gia_tri };
  });
}
