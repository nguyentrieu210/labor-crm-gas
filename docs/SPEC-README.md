# Labor CRM Apps Script Spec

Bộ tài liệu này chuyển nghiệp vụ Labor CRM từ bản Frappe/Vue sang hướng **Google Sheet + Google Apps Script Web App**.

Mục tiêu: giữ đủ nghiệp vụ lõi, nhưng thiết kế lại để chạy được trên Apps Script, dễ triển khai bằng `clasp`, dùng Google account thay cổng đăng nhập tự làm, và dùng Google Sheet như database đơn giản.

## Tài liệu

| File | Nội dung |
|---|---|
| `01-SRS-AppsScript.md` | Đặc tả nghiệp vụ đã chuyển sang Apps Script |
| `02-Sheet-Data-Model.md` | Thiết kế Google Sheet database, sheet/tab, cột, khóa, index mềm |
| `03-UX-UI-Design.md` | Thiết kế giao diện Web App cho desktop/mobile |
| `04-Implementation-Blueprint.md` | Kiến trúc code Apps Script, API, phân quyền, deploy |

## Quyết định nền tảng

- Google Sheet là database.
- Apps Script là backend/API và job tự động.
- HTML/CSS/JS trong Apps Script là frontend.
- Google account là lớp xác thực.
- Sheet `Users` là lớp phân quyền ứng dụng.
- KPI tuần là bảng dẫn xuất, không nhập tay.
- Các rule nghiệp vụ phức tạp vẫn giữ, nhưng triển khai bằng service functions thay vì Frappe controllers/workflows.

## Không còn dùng

- Frappe DocType, hooks, workflow engine.
- Vue 3/Vite build.
- User/password riêng của app.
- Database SQL riêng ở giai đoạn MVP.

## Cấu hình deploy khuyến nghị

Apps Script Web App:

```text
Execute as: User accessing the web app
Who has access: Anyone with Google account
```

Người dùng đăng nhập Google. App lấy email, tra trong sheet `Users`, rồi quyết định role/scope.

