# Đặc Tả Nghiệp Vụ Apps Script - Labor CRM

## 1. Mục Tiêu

Xây dựng mini CRM quản lý cung ứng và tuyển dụng lao động cho các nhà máy FDI bằng Google Sheet + Apps Script Web App.

Ứng dụng phục vụ:

- Nhập báo cáo tuyển dụng hằng ngày.
- Nhập nhu cầu tuần và KPI giao.
- Tự tính KPI tuần.
- Quản lý khách hàng, dự án, xưởng, nhân sự.
- Quản lý chăm sóc khách hàng.
- Quản lý công nợ phải thu.
- Dashboard theo vai trò.
- Phân quyền theo Google account, role, chi nhánh và người phụ trách.

## 2. Phạm Vi

### Trong Phạm Vi

- Web App chạy bằng Apps Script.
- Dữ liệu lưu trong Google Sheet.
- Giao diện chạy được trên máy tính và điện thoại.
- Người dùng xác thực bằng tài khoản Google.
- Role/scope nằm trong sheet `Users` và `Staff`.
- Tính toán tự động bằng Apps Script.
- Sao lưu dữ liệu bằng Google Drive/export file.

### Ngoài Phạm Vi Giai Đoạn MVP

- SaaS public nhiều công ty.
- Database SQL chuyên nghiệp.
- Realtime nhiều người cùng sửa như app enterprise.
- Workflow engine phức tạp như Frappe.
- Thanh toán/subscription.
- Mobile app native.

## 3. Vai Trò

| Role | Ý nghĩa |
|---|---|
| `ADMIN` | Quản trị toàn hệ thống, cấu hình, danh mục, dữ liệu |
| `BOD` | Ban lãnh đạo, xem toàn công ty, không sửa nghiệp vụ |
| `BM` | Quản lý chi nhánh, xem/sửa trong chi nhánh |
| `OM` | Quản lý vận hành, quản lý dự án/khách/công nợ mình phụ trách |
| `SPV` | Chuyên viên vận hành, nhập báo cáo ngày, xem dữ liệu gắn mình |

## 4. Xác Thực Và Phân Quyền

Ứng dụng không có form login riêng.

Luồng:

1. Người dùng mở Web App.
2. Google yêu cầu đăng nhập nếu chưa đăng nhập.
3. Apps Script lấy email bằng `Session.getActiveUser().getEmail()`.
4. App tra sheet `Users`.
5. Nếu email active: load role, staff_id, branch_id.
6. Nếu chưa được cấp quyền: hiển thị màn hình "Chưa được cấp quyền".

Mỗi API đều phải gọi `getCurrentUser_()` trước khi đọc/ghi dữ liệu.

## 5. Module Nghiệp Vụ

### 5.1. Dashboard

Hiển thị theo role:

- BOD/ADMIN: KPI toàn công ty, công nợ, aging, chất lượng dữ liệu.
- BM: KPI/công nợ/chăm sóc trong chi nhánh.
- OM: dự án mình quản lý, chuyên viên dưới quyền, công nợ phụ trách.
- SPV: báo cáo ngày cần nhập, KPI cá nhân, dự án mình tham gia.

Widget chính:

- Fill rate tuần hiện tại.
- Phễu tuyển dụng.
- Dòng lệch chuyên viên.
- Công nợ quá hạn.
- Chăm sóc quá hạn.
- Khách thiếu quản lý.
- Dự án đang vận hành thiếu báo cáo.

### 5.2. Nhân Sự

Quản lý hồ sơ nhân sự nội bộ.

Trường chính:

- staff_id
- full_name
- email
- branch_id
- role_business
- status
- manager_staff_id
- user_email

ADMIN quản trị. Role khác chỉ đọc trong scope.

### 5.3. Khách Hàng

Quản lý khách hàng FDI.

Trường chính:

- customer_id
- customer_name
- customer_name_zh
- branch_id
- customer_type
- service_type
- manager_staff_id
- active

Khách thiếu quản lý vẫn lưu được nhưng bị đưa vào cảnh báo chất lượng dữ liệu.

### 5.4. Dự Án

Quản lý dự án tuyển dụng/cung ứng.

Trường chính:

- project_id
- project_name
- customer_id
- branch_id
- manager_staff_id
- service_type
- status

Quan hệ chuyên viên dự án nằm ở sheet `ProjectStaff`.

### 5.5. Xưởng

Xưởng là thực thể riêng, không phải enum.

Trường chính:

- workshop_id
- workshop_name
- workshop_name_zh
- customer_id
- project_id
- is_group
- status
- merged_into

Rule:

- Xưởng bắt buộc thuộc dự án cha.
- Xưởng phải cùng khách với dự án cha.
- Báo cáo cấp xưởng lưu cả `project_id` và `workshop_id`.

### 5.6. Nhu Cầu Tuần

OM/BM nhập nhu cầu KH và KPI giao theo tuần.

Khóa unique:

```text
week + project_id + specialist_staff_id
```

Trường chính:

- demand_id
- week
- branch_id
- project_id
- workshop_id
- manager_staff_id
- specialist_staff_id
- customer_demand
- assigned_kpi

Rule:

- `customer_demand >= 0`
- `assigned_kpi >= 0`
- cảnh báo nếu `assigned_kpi > customer_demand`
- KPI giao ở đây là nguồn sự thật cho KPI tuần.

### 5.7. Báo Cáo Ngày

SPV/OM nhập phễu tuyển dụng hằng ngày.

Trường chính:

- report_id
- date
- week
- branch_id
- project_id
- workshop_id
- method
- registered
- interviewed
- passed_interview
- started_work
- specialist_staff_id
- late_entry
- created_by
- created_at
- updated_at

Rule:

- `registered >= interviewed >= passed_interview >= 0`
- `started_work >= 0`
- `started_work > passed_interview` được phép, nhưng cảnh báo.
- `week` tính từ `date`, không nhập tay.
- SPV chỉ sửa trong cửa sổ T+1.

### 5.8. KPI Tuần

KPI tuần là bảng dẫn xuất, không nhập tay.

Nguồn:

- `WeeklyDemand`
- `DailyReport`

Khóa:

```text
week + project_id + specialist_staff_id
```

Chỉ số:

- assigned_kpi
- registered
- interviewed
- passed_interview
- started_work
- fill_rate
- conversion_rate
- pass_interview_rate
- has_staff_mismatch

Công thức:

- `fill_rate = started_work / assigned_kpi`
- `conversion_rate = started_work / registered`
- `pass_interview_rate = passed_interview / interviewed`

Chia 0:

- assigned_kpi = 0: fill_rate trống
- registered = 0: conversion_rate = 0
- interviewed = 0: pass_interview_rate = 0

Roll-up dùng FULL OUTER JOIN logic bằng Apps Script:

- Có nhu cầu, chưa có báo cáo: phễu = 0, `has_staff_mismatch = TRUE`
- Có báo cáo, không có nhu cầu: KPI = 0, fill trống, `has_staff_mismatch = TRUE`
- Có cả hai: tính bình thường.

### 5.9. Chính Sách Tuyển Dụng

Chính sách theo khách/xưởng.

Trường chính:

- policy_id
- customer_id
- workshop_id
- recruiting_status
- unit_price
- price_unit
- requirement_note
- base_salary
- allowance
- has_dormitory

Rule:

- Mỗi khách + xưởng chỉ có 1 chính sách active.
- Có đơn giá thì bắt buộc có đơn vị.
- Không trộn đơn giá `/giờ` với `/người` khi báo cáo.

### 5.10. Chăm Sóc Khách Hàng

Quản lý lịch chăm sóc khách.

Trường chính:

- care_id
- customer_id
- manager_staff_id
- activity_type
- frequency
- planned_date
- status
- note
- cadence_anchor

State:

- pending
- in_progress
- done
- overdue

Rule:

- Khách trọng điểm: mặc định gặp mặt, 1 lần/tuần.
- Khách thường: mặc định điện thoại, 1 lần/tháng.
- Hoàn thành tạo log và sinh lịch kế tiếp.
- Cadence neo theo lịch kế hoạch, không drift theo ngày hoàn thành trễ.
- planned_date < hôm nay và chưa done: auto overdue.

Nhật ký chăm sóc nằm ở sheet `CareLog`, append-only.

### 5.11. Công Nợ

Quản lý công nợ phải thu.

Trường chính:

- receivable_id
- branch_id
- customer_id
- project_id
- manager_staff_id
- period
- amount
- due_date
- overdue_days
- collected_amount
- remaining_amount
- aging_stage
- collection_status
- collection_stage
- collection_stage_override
- note

Rule:

- amount > 0
- 0 <= collected_amount <= amount
- remaining_amount = amount - collected_amount
- overdue_days = max(0, today - due_date)
- aging_stage tính theo ngưỡng ngày.
- collection_status tính theo tiền:
  - collected = 0: unpaid
  - 0 < collected < amount: partial
  - collected = amount: paid
- collection_stage là nhãn hợp nhất, có thể override bởi BM/ADMIN.

### 5.12. Danh Mục Và Cấu Hình

Danh mục dùng chung nằm ở sheet `Categories`.

Trường:

- category_group
- enum_code
- label_vi
- label_zh
- sort_order
- active

Config nằm ở các sheet:

- `AgingThresholds`
- `CareFrequencies`
- `Settings`

Mọi role đọc được danh mục. Chỉ ADMIN sửa.

## 6. Quy Tắc Nghiệp Vụ Lõi

### BR-F - Phễu Tuyển Dụng

- registered >= interviewed >= passed_interview >= 0
- started_work không bắt buộc <= passed_interview
- week tính từ date theo ISO week
- SPV chỉ sửa trong cửa sổ T+1

### BR-K - KPI Tuần

- Tỷ lệ tính sau khi cộng tổng tuần, không lấy trung bình dòng ngày.
- KPI giao lấy từ WeeklyDemand.
- KPI tuần read-only.
- Fill rate được phép > 100%.

### BR-C - Chăm Sóc

- Tần suất chăm sóc dựa vào phân loại khách.
- Log chăm sóc append-only.
- Auto overdue theo planned_date.
- Sinh lịch kế tiếp không drift.

### BR-D - Công Nợ

- Tách 2 trục: aging theo thời gian, thu tiền theo số tiền.
- collection_stage chỉ là nhãn hiển thị, không thay thế 2 trục.
- Override collection_stage cần quyền BM/ADMIN.

### BR-O - Scope

- ADMIN/BOD xem toàn hệ thống.
- BM xem chi nhánh.
- OM xem dữ liệu mình phụ trách hoặc CV dưới quyền.
- SPV xem dữ liệu gắn trực tiếp mình.

## 7. User Stories Chính

### US-01 - SPV nhập báo cáo ngày

SPV mở màn hình Báo cáo ngày, chọn dự án/xưởng, nhập phễu, lưu trong dưới 30 giây.

Acceptance:

- Dự án/xưởng là dropdown.
- Tự tính tuần.
- Chặn phễu sai.
- Tự gán specialist = user hiện tại nếu role SPV.
- Quá T+1 thì không cho SPV sửa.

### US-02 - OM xem KPI tuần

OM chọn tuần và xem fill rate theo dự án/chuyên viên.

Acceptance:

- Dữ liệu roll-up đúng từ DailyReport + WeeklyDemand.
- Dòng lệch CV có badge cảnh báo.
- Sort theo fill rate.
- Drilldown được về báo cáo ngày.

### US-03 - OM chăm sóc khách hàng

OM xem lịch chăm sóc hôm nay/quá hạn, ghi log hoàn thành, hệ thống sinh lịch kế tiếp.

### US-04 - OM/BM theo dõi công nợ

OM cập nhật thu tiền, BM duyệt override/truy thu/chuyển pháp lý.

### US-05 - BM nhập nhu cầu tuần

BM/OM nhập nhu cầu và KPI giao theo tuần cho từng dự án/chuyên viên.

### US-06 - ADMIN quản trị danh mục

ADMIN thêm/sửa enum song ngữ, ngưỡng aging, tần suất chăm sóc.

## 8. Tiêu Chí Hoàn Thành MVP

- Có Web App deploy được.
- Người dùng đăng nhập bằng Google account.
- Phân quyền theo sheet `Users`.
- CRUD được các master chính.
- SPV nhập báo cáo ngày.
- OM/BM nhập nhu cầu tuần.
- Recompute KPI tuần đúng test vectors.
- Dashboard role-aware.
- Công nợ tính aging/remaining đúng.
- Chăm sóc khách tự sinh lịch kế tiếp.
- Responsive mobile/desktop.

