# Labor CRM — bản dựng trên kiến trúc Google Apps Script

Port toàn bộ **SRS-CRM-MINIAPP-v1.1** + **CRM-Frappe-Architecture** sang **Google Apps Script + Google Sheets**
(thay cho Frappe v15 + Vue). Giữ nguyên: khóa định danh thay tên, số liệu dẫn xuất tính bằng máy,
2 engine lõi (KPI roll-up FULL OUTER, công nợ 2 trục) với Test Vectors T1–T5 / D1–D4.

## Ánh xạ kiến trúc Frappe → Apps Script

| Frappe | Apps Script + Sheets |
|---|---|
| DocType | 1 tab (sheet); hàng 1 = `fieldname` máy |
| `name` (naming series) | cột `name` (PK) sinh tự động: `NS-00001`, `BC-00001`… |
| Link field | ô lưu giá trị `name` của bản ghi được trỏ (không lưu tên hiển thị) |
| Child table (istable) | 1 sheet riêng có cột `parent` trỏ về bản ghi cha |
| Single (Labor CRM Settings) | sheet `Settings` key/value + 2 sheet con AgingThreshold/CareFrequency |
| Category Value (enum song ngữ) | sheet `CategoryValue`; FK enum lưu `enum_code` |
| Controller `validate`/`on_update` | hàm service `.gs` gọi khi submit form / chạy menu |
| `scheduler_events` (cron) | **time-driven trigger** (recompute đêm, re-age, mark overdue, lock tuần) |
| Workflow state | cột `workflow_state` + hàm chuyển trạng thái có kiểm role |
| RBAC (DocPerm + UserPermission + Query Cond) | Web App: `Session.getActiveUser()` → Staff → role+chi nhánh; lọc ở API |
| FULL OUTER JOIN (Python merge) | merge object trong `recomputeWeek()` (`03_Kpi.gs`) |
| Vue 3 SPA (frappe-ui) | Web App `HtmlService` mobile-first, gọi `google.script.run` |
| i18n (vi/zh) | `CategoryValue.ten_trung` + chuỗi UI 2 ngôn ngữ trong HTML |

## Cấu trúc mã (.gs)

| File | Vai trò |
|---|---|
| `00_Config.gs` | Khai báo SCHEMA mọi sheet + seed enum, ngưỡng aging, cadence, alias, chi nhánh |
| `01_Db.gs` | "ORM" tối giản: đọc/ghi sheet theo object, sinh `name`, query, upsert |
| `02_Setup.gs` | `setupAll()` tạo toàn bộ tab + seed dữ liệu nền |
| `03_Kpi.gs` | ISO week, FULL OUTER roll-up, công thức KPI + `runKpiTests()` (T1–T5) |
| `04_Finance.gs` | Công nợ 2 trục (aging + thu) + `runReceivableTests()` (D1–D4) |
| `05_Crm.gs` | Cadence chăm sóc (Mốc 1&15), mark overdue, sinh lượt kế |
| `06_Menu.gs` | Menu điều khiển + cài đặt time-trigger tự động |
| `07_Api.gs` | **Web App**: doGet + API (bootstrap, list/get/save tổng quát, lookup, dashboard, hành động đặc thù) |
| `08_Meta.gs` | Metadata 10 module (nhãn song ngữ, cột list, field form) điều khiển UI tổng quát |
| `App.html` | Khung SPA (doGet phục vụ) |
| `Styles.html` | CSS mobile-first |
| `Ui.html` | Client JS: router, engine list/form, dashboard, song ngữ, gọi `google.script.run` |

## Lộ trình giai đoạn

- **GĐ1** ✅ — Data layer + 2 engine lõi + menu + trigger. Test vector PASS.
- **GĐ2** ✅ — Web App mini-app (Dashboard theo vai trò + List/Form 10 module) bằng HtmlService, song ngữ.
- **GĐ3** — RBAC chi tiết theo người phụ trách (OM/SPV) + Workflow công nợ/chăm sóc + Audit UI.
- **GĐ4** — Migration dữ liệu thật từ `My.xlsx` (alias, cây xưởng Foxconn, tách cột công nợ) + đối soát.

## Cách chạy

1. Tạo 1 Google Sheet mới (trống). Vào **Tiện ích mở rộng → Apps Script**.
2. Tạo các file `.gs` (00→08) và 3 file HTML (`App`, `Styles`, `Ui`) đúng tên, dán nội dung. Lưu.
   - Tên file HTML không kèm `.html` (gõ `App`, `Styles`, `Ui`).
3. Chạy hàm **`setupAll`** (cấp quyền lần đầu) → tạo 24 tab + seed enum/cấu hình.
4. *(Tùy chọn)* chạy **`seedDemo`** → tạo dữ liệu mẫu để Dashboard có số liệu.
5. Chạy **`runKpiTests`** + **`runReceivableTests`** → Log (Ctrl+Enter) phải PASS hết.
6. F5 Sheet → menu **⚙️ Labor CRM** xuất hiện (chạy nghiệp vụ + bật tự động).

## Triển khai Web App (mini-app)

1. Trong Apps Script: **Triển khai (Deploy) → Tùy chọn triển khai mới → Ứng dụng web (Web app)**.
2. *Execute as:* Me · *Who has access:* tùy (nội bộ → "Bất kỳ ai trong tổ chức" hoặc "Anyone with link").
3. Deploy → mở **link /exec** trên điện thoại. (KHÔNG xem được bằng nút ▶️ Run trong editor.)
4. Đăng nhập là ai → hệ thống map sang `Staff` theo `user`/`email` để xác định vai trò + chi nhánh.
   - Chưa map được Staff → tạm coi là **System Manager** (xem toàn bộ) — sẽ siết ở GĐ3.

> Mã `.gs` thuần JS — có thể đẩy bằng `clasp` hoặc copy tay.
