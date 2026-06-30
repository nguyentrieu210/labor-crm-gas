# Implementation Blueprint - Apps Script

## 1. Kiến Trúc

```text
Google Account
   |
Apps Script Web App
   |
   +-- HTML/CSS/JS frontend
   +-- google.script.run API bridge
   +-- Apps Script services
   |
Google Sheet database
```

## 2. Deploy

Khuyến nghị:

```text
Execute as: User accessing the web app
Who has access: Anyone with Google account
```

Lý do:

- Dùng Google account làm xác thực.
- Lấy được email người dùng.
- Có thể chia quyền theo sheet `Users`.

Lưu ý:

- Người dùng cần có quyền mở spreadsheet nếu script chạy bằng user accessing.
- Nếu muốn người dùng không cần quyền trực tiếp với Sheet, dùng execute as owner, nhưng khi đó lấy email có thể hạn chế hơn và cần cân nhắc bảo mật kỹ hơn.

## 3. Cấu Trúc Project

```text
labor_crm_gas/
  appsscript.json
  00_Config.gs
  01_Db.gs
  02_Auth.gs
  03_Rbac.gs
  04_Master.gs
  05_Recruitment.gs
  06_Kpi.gs
  07_Crm.gs
  08_Finance.gs
  09_Dashboard.gs
  10_Audit.gs
  11_Jobs.gs
  12_Api.gs
  App.html
  Styles.html
  Ui.html
  Client.html
```

## 4. Manifest

```json
{
  "timeZone": "Asia/Ho_Chi_Minh",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_ACCESSING",
    "access": "ANYONE_WITH_GOOGLE_ACCOUNT"
  },
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets.currentonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}
```

Scope thực tế có thể điều chỉnh theo việc có dùng Drive/Gmail hay không.

## 5. App.html

```html
<!doctype html>
<html>
<head>
  <base target="_top">
  <meta charset="utf-8">
  <?!= include('Styles'); ?>
</head>
<body>
  <div id="app"></div>
  <?!= include('Ui'); ?>
  <?!= include('Client'); ?>
</body>
</html>
```

## 6. doGet

```javascript
function doGet() {
  return HtmlService.createTemplateFromFile('App')
    .evaluate()
    .setTitle('Labor CRM')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}
```

## 7. Auth

```javascript
function getCurrentUser_() {
  var email = Session.getActiveUser().getEmail();
  if (!email) {
    throw new Error('Không lấy được email Google. Hãy đăng nhập và cấp quyền cho ứng dụng.');
  }

  var users = dbAll_('Users');
  var user = users.find(function (u) {
    return lower_(u.user_email) === lower_(email)
      && bool_(u.active);
  });

  if (!user) {
    throw new Error('Tài khoản ' + email + ' chưa được cấp quyền.');
  }

  return user;
}

function lower_(v) {
  return String(v || '').trim().toLowerCase();
}
```

## 8. RBAC

```javascript
var ROLES = {
  ADMIN: 'ADMIN',
  BOD: 'BOD',
  BM: 'BM',
  OM: 'OM',
  SPV: 'SPV'
};

function requireRole_(user, roles) {
  if (roles.indexOf(user.role) === -1) {
    throw new Error('Không đủ quyền.');
  }
}

function canReadModule_(user, moduleName) {
  if (user.role === ROLES.ADMIN || user.role === ROLES.BOD) return true;
  return true;
}
```

## 9. Scope Filter

```javascript
function filterRowsByScope_(rows, moduleName, user) {
  if (user.role === ROLES.ADMIN || user.role === ROLES.BOD) return rows;

  if (user.role === ROLES.BM) {
    return rows.filter(function (r) {
      return String(r.branch_id) === String(user.branch_id);
    });
  }

  if (user.role === ROLES.OM) {
    return rows.filter(function (r) {
      return String(r.branch_id) === String(user.branch_id)
        && (
          String(r.manager_staff_id) === String(user.staff_id)
          || String(r.specialist_staff_id) === String(user.staff_id)
          || isStaffUnderManager_(r.specialist_staff_id, user.staff_id)
        );
    });
  }

  if (user.role === ROLES.SPV) {
    return rows.filter(function (r) {
      return String(r.specialist_staff_id) === String(user.staff_id)
        || String(r.staff_id) === String(user.staff_id);
    });
  }

  return [];
}
```

Mỗi module có thể override scope riêng vì không phải sheet nào cũng có cùng cột.

## 10. DB Helpers

```javascript
function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Thiếu sheet: ' + name);
  return sh;
}

function dbAll_(name) {
  var sh = sheet_(name);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(String);
  return values.slice(1)
    .filter(function (r) { return r.some(function (c) { return c !== '' && c != null; }); })
    .map(function (row, idx) {
      var obj = {_row: idx + 2};
      headers.forEach(function (h, i) { obj[h] = row[i]; });
      return obj;
    });
}

function dbAppend_(name, obj) {
  var sh = sheet_(name);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var row = headers.map(function (h) { return obj[h] == null ? '' : obj[h]; });
  sh.appendRow(row);
}

function dbUpdateById_(name, idField, idValue, patch) {
  var rows = dbAll_(name);
  var row = rows.find(function (r) { return String(r[idField]) === String(idValue); });
  if (!row) throw new Error('Không tìm thấy ' + idValue);

  var sh = sheet_(name);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  headers.forEach(function (h, i) {
    if (patch.hasOwnProperty(h)) {
      sh.getRange(row._row, i + 1).setValue(patch[h]);
    }
  });
}
```

## 11. API Pattern

Frontend chỉ gọi các hàm `api*`.

```javascript
function apiBootstrap() {
  var user = getCurrentUser_();
  return {
    email: user.user_email,
    role: user.role,
    staff_id: user.staff_id,
    branch_id: user.branch_id,
    locale: user.locale || 'vi',
    nav: getNavForRole_(user.role)
  };
}

function apiListDailyReports(filters) {
  var user = getCurrentUser_();
  var rows = dbAll_('DailyReport');
  rows = filterRowsByScope_(rows, 'DailyReport', user);
  return applyFilters_(rows, filters);
}
```

## 12. Frontend API Bridge

```javascript
function callApi(name, payload) {
  return new Promise(function (resolve, reject) {
    google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler(function (err) {
        reject(err && err.message ? err.message : err);
      })[name](payload || {});
  });
}
```

## 13. Validation DailyReport

```javascript
function validateDailyReport_(r) {
  var reg = num_(r.registered);
  var intv = num_(r.interviewed);
  var pass = num_(r.passed_interview);
  var start = num_(r.started_work);

  if (reg < 0 || intv < 0 || pass < 0 || start < 0) {
    throw new Error('Các chỉ số phễu không được âm.');
  }
  if (reg < intv) throw new Error('Đăng ký không được nhỏ hơn Phỏng vấn.');
  if (intv < pass) throw new Error('Phỏng vấn không được nhỏ hơn Đỗ PV.');

  return {
    warnings: start > pass ? ['Đi làm lớn hơn Đỗ PV. Hệ thống vẫn lưu nhưng cần rà soát.'] : []
  };
}
```

## 14. Recompute Weekly KPI

```javascript
function recomputeWeeklyKpi_(week) {
  var demands = dbAll_('WeeklyDemand').filter(function (r) { return r.week === week; });
  var reports = dbAll_('DailyReport').filter(function (r) { return r.week === week; });

  var map = {};

  demands.forEach(function (d) {
    var key = kpiKey_(week, d.project_id, d.specialist_staff_id);
    map[key] = map[key] || emptyKpiRow_(week, d.project_id, d.specialist_staff_id);
    map[key].branch_id = d.branch_id;
    map[key].manager_staff_id = d.manager_staff_id;
    map[key].assigned_kpi += num_(d.assigned_kpi);
    map[key].customer_demand += num_(d.customer_demand);
    map[key]._hasDemand = true;
  });

  reports.forEach(function (r) {
    var key = kpiKey_(week, r.project_id, r.specialist_staff_id);
    map[key] = map[key] || emptyKpiRow_(week, r.project_id, r.specialist_staff_id);
    map[key].branch_id = r.branch_id;
    map[key].registered += num_(r.registered);
    map[key].interviewed += num_(r.interviewed);
    map[key].passed_interview += num_(r.passed_interview);
    map[key].started_work += num_(r.started_work);
    map[key]._hasReport = true;
  });

  var rows = Object.keys(map).map(function (key) {
    var k = map[key];
    k.fill_rate = k.assigned_kpi ? k.started_work / k.assigned_kpi : '';
    k.conversion_rate = k.registered ? k.started_work / k.registered : 0;
    k.pass_interview_rate = k.interviewed ? k.passed_interview / k.interviewed : 0;
    k.has_staff_mismatch = !(k._hasDemand && k._hasReport);
    k.recomputed_at = new Date();
    delete k._hasDemand;
    delete k._hasReport;
    return k;
  });

  replaceKpiWeek_(week, rows);
  audit_('recompute', 'WeeklyKPI', week, null, {count: rows.length});
  return {week: week, count: rows.length};
}
```

## 15. Jobs

Time triggers:

| Job | Lịch | Làm gì |
|---|---|---|
| `jobNightlyAging` | mỗi ngày 02:00 | Tính lại công nợ aging |
| `jobMarkCareOverdue` | mỗi ngày 03:00 | Chuyển chăm sóc quá hạn |
| `jobBackupSpreadsheet` | mỗi ngày 04:00 | Copy spreadsheet backup |
| `jobRecomputeRecentKpi` | mỗi ngày 05:00 | Tính lại KPI 8 tuần gần nhất |

## 16. Audit

```javascript
function audit_(action, tableName, rowId, oldObj, newObj) {
  dbAppend_('AuditLog', {
    audit_id: nextId_('AUD'),
    timestamp: new Date(),
    actor_email: safeEmail_(),
    action: action,
    table_name: tableName,
    row_id: rowId,
    old_json: oldObj ? JSON.stringify(oldObj) : '',
    new_json: newObj ? JSON.stringify(newObj) : '',
    note: ''
  });
}
```

## 17. Error Handling

Backend:

- Throw `Error(message)` với message người dùng hiểu được.
- Không trả stack trace ra frontend.
- Log lỗi kỹ thuật bằng `console.error`.

Frontend:

- Hiện toast lỗi.
- Có nút retry.
- Không crash toàn app khi một widget lỗi.

## 18. Performance

Nguyên tắc:

- Đọc sheet một lần, xử lý trong memory, ghi batch.
- Không gọi `getRange().setValue()` trong vòng lặp lớn.
- Dùng `setValues()` khi ghi nhiều dòng.
- Cache categories/master lookup.
- Với list lớn, phân trang ở Apps Script.

Mục tiêu MVP:

- Dashboard < 3 giây với dưới 50k dòng DailyReport.
- List page < 2 giây với filter cơ bản.
- Recompute một tuần < 10 giây.

## 19. Development Với clasp

```powershell
npm install -g @google/clasp
clasp login
clasp clone SCRIPT_ID
clasp push -f
```

Nếu PowerShell chặn `.ps1`, dùng:

```powershell
clasp.cmd push -f
```

Test dev:

- Dùng `/dev` link để chạy code mới nhất.
- Deploy production bằng Manage deployments -> Edit -> New version.
- Không tạo New deployment nếu muốn giữ link cũ.

## 20. Roadmap

### Phase 0 - Sheet Foundation

- Tạo toàn bộ sheets/header.
- Seed Categories/Branches/Settings.
- Tạo Users/Staff mẫu.

### Phase 1 - Auth + Layout

- doGet/App shell.
- Bootstrap user.
- Role-aware nav.
- No access page.

### Phase 2 - Master Data

- Customers.
- Projects.
- Staff.
- Workshops.
- Policies.

### Phase 3 - Recruitment

- DailyReport CRUD.
- WeeklyDemand bulk entry.
- Recompute WeeklyKPI.
- KPI dashboard.

### Phase 4 - CRM/Finance

- CareTasks + CareLog + overdue job.
- Receivables + aging + collection log.

### Phase 5 - Hardening

- Audit.
- Backup.
- Permission test.
- Mobile polish.
- Data quality dashboard.

