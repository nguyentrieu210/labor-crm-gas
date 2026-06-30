# UX/UI Design - Labor CRM Apps Script Web App

## 1. Nguyên Tắc Thiết Kế

Ứng dụng là công cụ vận hành nội bộ, không phải landing page.

Ưu tiên:

- Nhanh, rõ, ít chữ.
- Mobile dùng được cho nhập liệu nhanh.
- Desktop dùng tốt cho bảng, lọc, dashboard.
- Mỗi màn hình có một hành động chính.
- Không yêu cầu người dùng nhìn Google Sheet trực tiếp.
- Dữ liệu nhạy cảm có trạng thái rõ ràng: loading, empty, no access, error.

## 2. Layout Tổng Thể

### Desktop

```text
+--------------------------------------------------+
| Top bar: Logo, search, week, branch, user         |
+-------------+------------------------------------+
| Sidebar     | Page content                        |
| Dashboard   | Filters                             |
| Daily       | Table / Cards / Form                |
| KPI         |                                    |
| Customers   |                                    |
| Receivable  |                                    |
+-------------+------------------------------------+
```

### Mobile

```text
+----------------------------------+
| Top bar: title, user/menu         |
+----------------------------------+
| Page content as cards/forms       |
|                                  |
|                                  |
+----------------------------------+
| Bottom nav: Home Daily KPI More   |
+----------------------------------+
```

Desktop dùng bảng nhiều cột. Mobile dùng card/list và form một cột.

## 3. Navigation

Menu chính:

| Nav | Role thấy |
|---|---|
| Dashboard | Tất cả |
| Báo cáo ngày | ADMIN/BOD/BM/OM/SPV |
| KPI tuần | ADMIN/BOD/BM/OM/SPV |
| Nhu cầu tuần | ADMIN/BM/OM/SPV read |
| Khách hàng | ADMIN/BOD/BM/OM/SPV read |
| Dự án | ADMIN/BOD/BM/OM/SPV read |
| Xưởng | ADMIN/BOD/BM/OM/SPV read |
| Chăm sóc | ADMIN/BOD/BM/OM |
| Công nợ | ADMIN/BOD/BM/OM |
| Chính sách | ADMIN/BOD/BM/OM/SPV read |
| Nhân sự | ADMIN/BOD/BM/OM/SPV self |
| Cấu hình | ADMIN |

Mobile bottom nav:

- Home
- Báo cáo
- KPI
- Khách
- More

## 4. Màn Hình Xác Thực

Không có login form riêng.

Nếu Google chưa xác thực, Google tự yêu cầu đăng nhập.

Sau khi vào app:

- Nếu email có trong `Users`: vào Dashboard.
- Nếu email không có quyền: hiển thị No Access.

No Access copy:

```text
Tài khoản này chưa được cấp quyền
Email: user@gmail.com
Vui lòng liên hệ quản trị để thêm vào danh sách người dùng.
```

## 5. Dashboard

### BOD/ADMIN

Cards:

- Tổng đi làm tuần này
- Fill rate toàn công ty
- Công nợ còn lại
- Công nợ quá hạn
- Chăm sóc quá hạn
- Dòng dữ liệu cần rà soát

Charts:

- Fill rate theo chi nhánh
- Aging bucket
- Funnel tổng

### BM

Scope chi nhánh:

- KPI chi nhánh
- Top dự án fill thấp
- Công nợ quá hạn trong chi nhánh
- Khách thiếu quản lý

### OM

Scope phụ trách:

- Dự án mình quản lý
- CV dưới quyền
- Báo cáo thiếu trong tuần
- Công nợ mình phụ trách
- Lịch chăm sóc hôm nay/quá hạn

### SPV

Scope cá nhân:

- Báo cáo hôm nay cần nhập
- KPI tuần của mình
- Dự án đang tham gia
- Dòng lệch KPI cần xem

## 6. Báo Cáo Ngày

### Desktop

Controls:

- Date range
- Week
- Branch
- Project
- Specialist
- Method
- Button: `+ Nhập báo cáo`

Table columns:

- Ngày
- Tuần
- Dự án
- Xưởng
- Chuyên viên
- Phương thức
- Đăng ký
- Phỏng vấn
- Đỗ PV
- Đi làm
- Cảnh báo

### Mobile

List card:

```text
Dự án A - 29/06
CV: Nguyễn A
ĐK 20 · PV 12 · Đỗ 8 · Đi làm 6
[Sửa]
```

Form nhập nhanh:

- Ngày
- Dự án
- Xưởng
- Phương thức
- Đăng ký
- Phỏng vấn
- Đỗ PV
- Đi làm
- Ghi chú

Hiển thị cảnh báo soft ngay dưới field.

## 7. KPI Tuần

KPI là read-only.

Controls:

- Week picker
- Branch
- Project
- Specialist
- Toggle: chỉ dòng lệch
- Sort: fill rate / conversion / started_work

Cards:

- Fill rate
- Conversion
- Pass interview rate
- Total started work

Table:

- Dự án
- Chuyên viên
- KPI giao
- Đăng ký
- Phỏng vấn
- Đỗ PV
- Đi làm
- Fill
- Chuyển đổi
- Đậu PV
- Lệch CV

Actions:

- Recompute week: ADMIN/BM only.
- Drilldown: mở DailyReport filtered theo week/project/staff.

## 8. Nhu Cầu Tuần

Mục tiêu: nhập nhanh KPI giao theo tuần.

Pattern:

1. Chọn tuần.
2. Chọn chi nhánh/dự án.
3. App tạo grid theo dự án + chuyên viên.
4. Nhập nhu cầu KH và KPI giao.
5. Lưu hàng loạt.
6. App recompute KPI tuần.

Desktop dùng grid. Mobile dùng từng card dự án.

## 9. Khách Hàng 360

Trang danh sách:

- Search khách.
- Filter branch, type, manager.
- Card hoặc table.

Trang chi tiết:

- Thông tin khách.
- Dự án.
- Xưởng.
- Chính sách.
- Chăm sóc gần nhất.
- Công nợ còn lại.
- Nhật ký.

## 10. Chăm Sóc Khách Hàng

Views:

- Hôm nay
- Quá hạn
- Tuần này
- Theo khách

Card:

```text
Khách hàng A
Gặp mặt · Hôm nay
QL: Nguyễn B
[Bắt đầu] [Hoàn thành]
```

Hoàn thành:

- Mở modal ghi kết quả.
- Append CareLog.
- Set task done.
- Sinh task kế tiếp nếu tần suất không phải "Khi cần".

## 11. Công Nợ

Dashboard:

- Tổng còn lại
- Quá hạn
- Aging buckets
- Top khách quá hạn

List:

- Khách
- Kỳ
- Số tiền
- Đã thu
- Còn lại
- Quá hạn
- Aging
- Trạng thái thu

Action:

- Ghi nhận thu tiền.
- Xem log thu.
- Đề xuất chuyển pháp lý.
- Override giai đoạn truy thu: BM/ADMIN.

Mobile ưu tiên card và nút `Ghi nhận thu`.

## 12. Cấu Hình/Danh Mục

ADMIN only.

Tabs:

- Users
- Categories
- Aging thresholds
- Care frequencies
- Branches
- Alias review
- Backup

Màn Users:

- Email
- Role
- Staff
- Branch
- Active

## 13. Component Design

### Buttons

- Primary: hành động chính.
- Secondary: lọc, refresh.
- Danger: xóa, hủy.
- Icon buttons cho edit/delete/view.

### Cards

Chỉ dùng cho:

- Stat cards
- Mobile list items
- Individual record summaries

Không bọc cả page trong card lớn.

### Tables

Desktop:

- Sticky header.
- Compact row.
- Sortable.
- Row action bên phải.

Mobile:

- Không dùng bảng rộng.
- Chuyển thành cards.

### Status Badges

Care:

- pending: xám
- in_progress: xanh
- done: xanh lá
- overdue: đỏ

Receivable:

- not_due: xám
- remind_1/remind_2: vàng
- official_letter/negotiation: cam
- legal: đỏ
- paid: xanh lá

KPI:

- fill >= 100%: xanh lá
- fill 70-99%: xanh
- fill < 70%: cam/đỏ
- mismatch: vàng

## 14. Responsive Rules

Breakpoint:

- `<= 768px`: mobile
- `769px - 1199px`: tablet
- `>= 1200px`: desktop

Mobile:

- Font body 14-15px.
- Button height tối thiểu 40px.
- Form một cột.
- Bottom nav fixed.
- Modal full-screen sheet.

Desktop:

- Sidebar 240px.
- Content max width 1440px.
- Tables min width và horizontal scroll nếu cần.

## 15. Empty/Error/Loading

Mọi màn hình phải có:

- Loading skeleton/spinner.
- Empty state có hành động tiếp theo.
- Error state có nút thử lại.
- No access state nếu role không đủ quyền.

Ví dụ:

```text
Chưa có báo cáo ngày cho tuần này
[+ Nhập báo cáo]
```

## 16. i18n

MVP ưu tiên tiếng Việt. Chuẩn bị sẵn cơ chế song ngữ:

- UI labels: object dictionary trong JS.
- Enum labels: đọc từ `Categories`.
- Nếu locale = zh, hiển thị label_zh nếu có, fallback label_vi.

## 17. Design Tone

Ứng dụng vận hành nên giao diện:

- Sạch.
- Ít trang trí.
- Tương phản tốt.
- Dễ scan.
- Không dùng hero/landing.
- Không dùng gradient quá nhiều.

