# Thiết Kế Google Sheet Database

## 1. Nguyên Tắc

Google Sheet là database đơn giản. Mỗi tab là một bảng.

Quy ước:

- Dòng 1 là header kỹ thuật, không dùng nhãn tiếng Việt.
- Không đổi tên cột sau khi đã build.
- Mỗi bảng có cột ID riêng.
- ID dùng prefix dễ đọc, ví dụ `KH-00001`, `BC-00001`.
- Các cột FK lưu ID, không lưu tên.
- Tên hiển thị được resolve qua master.
- Dữ liệu computed vẫn lưu trong sheet để dashboard nhanh hơn.
- Apps Script là lớp duy nhất được phép ghi cột computed.

## 2. Danh Sách Sheet

| Sheet | Vai trò |
|---|---|
| `Users` | Tài khoản Google và quyền ứng dụng |
| `Branches` | Chi nhánh |
| `Staff` | Nhân sự |
| `Customers` | Khách hàng |
| `Projects` | Dự án |
| `ProjectStaff` | Chuyên viên theo dự án |
| `Workshops` | Xưởng |
| `ProjectAliases` | Alias tên dự án |
| `WorkshopAliases` | Alias tên xưởng |
| `Policies` | Chính sách tuyển dụng |
| `WeeklyDemand` | Nhu cầu tuần + KPI giao |
| `DailyReport` | Báo cáo tuyển dụng ngày |
| `WeeklyKPI` | KPI tuần dẫn xuất |
| `CareTasks` | Lịch chăm sóc |
| `CareLog` | Nhật ký chăm sóc |
| `Receivables` | Công nợ |
| `ReceivableLog` | Nhật ký thu công nợ |
| `Categories` | Danh mục song ngữ |
| `AgingThresholds` | Ngưỡng aging |
| `CareFrequencies` | Cấu hình tần suất chăm sóc |
| `Settings` | Cấu hình chung |
| `AuditLog` | Log thay đổi |
| `ReviewQueue` | Hàng đợi chuẩn hóa tên |

## 3. Users

| Cột | Kiểu | Ghi chú |
|---|---|---|
| user_email | email | Google account, unique |
| active | bool | TRUE/FALSE |
| role | enum | ADMIN/BOD/BM/OM/SPV |
| staff_id | FK | Link Staff |
| branch_id | FK | Chi nhánh chính |
| display_name | text | Tên hiển thị |
| locale | text | vi/zh |
| created_at | datetime | |

Rule:

- Không có user trong sheet này thì không vào app.
- `role` là quyền làm gì.
- `branch_id` là scope mặc định.

## 4. Branches

| Cột | Kiểu | Ghi chú |
|---|---|---|
| branch_id | id | `BR-0001` |
| branch_name | text | Bắc Ninh... |
| branch_name_zh | text | |
| region | text | |
| active | bool | |

## 5. Staff

| Cột | Kiểu | Ghi chú |
|---|---|---|
| staff_id | id | `NS-00001` |
| full_name | text | |
| full_name_zh | text | |
| email | email | |
| user_email | email | Google account mapping |
| branch_id | FK | |
| role_business | enum | branch_manager/ops_manager/ops_specialist |
| status | enum | official/probation/inactive |
| manager_staff_id | FK | OM của SPV |
| active | bool | |

## 6. Customers

| Cột | Kiểu | Ghi chú |
|---|---|---|
| customer_id | id | `KH-00001` |
| customer_name | text | unique mềm |
| customer_name_zh | text | |
| branch_id | FK | |
| customer_type | enum | regular/key |
| service_type | enum | |
| manager_staff_id | FK | có thể trống nhưng cảnh báo |
| active | bool | |

## 7. Projects

| Cột | Kiểu | Ghi chú |
|---|---|---|
| project_id | id | `DA-00001` |
| project_name | text | unique mềm |
| customer_id | FK | |
| branch_id | FK | suy từ customer hoặc chọn |
| manager_staff_id | FK | OM phụ trách |
| service_type | enum | |
| status | enum | active/paused/ended |
| note | text | |

## 8. ProjectStaff

| Cột | Kiểu | Ghi chú |
|---|---|---|
| project_id | FK | |
| staff_id | FK | |
| project_role | enum | specialist_1/specialist_2/support |
| active | bool | |

Unique mềm: `project_id + staff_id`.

## 9. Workshops

| Cột | Kiểu | Ghi chú |
|---|---|---|
| workshop_id | id | `WS-00001` |
| workshop_name | text | |
| workshop_name_zh | text | |
| customer_id | FK | |
| project_id | FK | bắt buộc |
| is_group | bool | |
| status | enum | active/merged/inactive |
| merged_into | FK | workshop_id |

Validation:

- `project_id` bắt buộc.
- customer của workshop phải bằng customer của project.
- Nếu status = merged thì phải có merged_into.

## 10. WeeklyDemand

| Cột | Kiểu | Ghi chú |
|---|---|---|
| demand_id | id | `NC-00001` |
| week | isoweek | `YYYY-Www` |
| branch_id | FK | |
| project_id | FK | |
| workshop_id | FK | optional |
| manager_staff_id | FK | |
| specialist_staff_id | FK | |
| customer_demand | int | >= 0 |
| assigned_kpi | int | >= 0 |
| created_by | email | |
| created_at | datetime | |
| updated_at | datetime | |

Unique mềm: `week + project_id + specialist_staff_id`.

## 11. DailyReport

| Cột | Kiểu | Ghi chú |
|---|---|---|
| report_id | id | `BC-00001` |
| date | date | |
| week | isoweek | computed |
| branch_id | FK | |
| project_id | FK | |
| workshop_id | FK | optional |
| method | enum | direct/partner/internal |
| registered | int | |
| interviewed | int | |
| passed_interview | int | |
| started_work | int | |
| specialist_staff_id | FK | |
| late_entry | bool | computed |
| created_by | email | |
| created_at | datetime | |
| updated_at | datetime | |

## 12. WeeklyKPI

| Cột | Kiểu | Ghi chú |
|---|---|---|
| kpi_id | id | deterministic hash hoặc `KPI-00001` |
| week | isoweek | |
| branch_id | FK | |
| project_id | FK | |
| manager_staff_id | FK | |
| specialist_staff_id | FK | |
| assigned_kpi | int | từ WeeklyDemand |
| customer_demand | int | từ WeeklyDemand |
| registered | int | sum DailyReport |
| interviewed | int | sum DailyReport |
| passed_interview | int | sum DailyReport |
| started_work | int | sum DailyReport |
| fill_rate | number | computed |
| conversion_rate | number | computed |
| pass_interview_rate | number | computed |
| has_staff_mismatch | bool | computed |
| recomputed_at | datetime | |

Không nhập tay. Chỉ service `recomputeWeeklyKpi_()` ghi.

## 13. CareTasks

| Cột | Kiểu | Ghi chú |
|---|---|---|
| care_id | id | `CSK-00001` |
| customer_id | FK | |
| branch_id | FK | suy từ customer |
| manager_staff_id | FK | |
| activity_type | enum | |
| frequency | enum | |
| planned_date | date | |
| cadence_anchor | date | |
| status | enum | pending/in_progress/done/overdue |
| note | text | |
| created_by | email | |
| created_at | datetime | |
| updated_at | datetime | |

## 14. CareLog

| Cột | Kiểu | Ghi chú |
|---|---|---|
| log_id | id | `CL-00001` |
| care_id | FK | |
| timestamp | datetime | |
| actor_email | email | |
| result | enum/text | |
| content | text | |

Append-only.

## 15. Receivables

| Cột | Kiểu | Ghi chú |
|---|---|---|
| receivable_id | id | `CN-00001` |
| branch_id | FK | |
| customer_id | FK | |
| project_id | FK | optional |
| manager_staff_id | FK | |
| period | text | `T06/2026` |
| amount | money | > 0 |
| due_date | date | |
| overdue_days | int | computed |
| collected_amount | money | |
| remaining_amount | money | computed |
| aging_stage | enum | computed |
| collection_status | enum | computed |
| collection_stage | enum | computed/override |
| collection_stage_override | bool | |
| note | text | |
| updated_at | datetime | |

## 16. ReceivableLog

| Cột | Kiểu | Ghi chú |
|---|---|---|
| log_id | id | `CNL-00001` |
| receivable_id | FK | |
| timestamp | datetime | |
| actor_email | email | |
| amount_collected | money | |
| old_remaining | money | |
| new_remaining | money | |
| note | text | |

## 17. Categories

| Cột | Kiểu | Ghi chú |
|---|---|---|
| category_group | text | |
| enum_code | text | khóa kỹ thuật |
| label_vi | text | |
| label_zh | text | |
| sort_order | int | |
| active | bool | |

Unique mềm: `category_group + enum_code`.

Nhóm chính:

- role
- staff_status
- customer_type
- service_type
- project_status
- method
- recruiting_status
- price_unit
- activity_type
- care_frequency
- care_status
- aging_stage
- collection_status
- collection_stage

## 18. AgingThresholds

| Cột | Kiểu | Ghi chú |
|---|---|---|
| aging_stage | enum | |
| from_day | int | |
| to_day | int/null | null = vô cực |
| sort_order | int | |

Mặc định:

| aging_stage | from_day | to_day |
|---|---:|---:|
| not_due | 0 | 0 |
| remind_1 | 1 | 7 |
| remind_2 | 8 | 15 |
| official_letter | 16 | 30 |
| negotiation | 31 | 60 |
| legal | 61 | |

## 19. CareFrequencies

| Cột | Kiểu | Ghi chú |
|---|---|---|
| frequency | enum | |
| cadence_type | enum | weekly/monthly_1_15/monthly/quarterly/none |
| cycle_days | int | |
| active | bool | |

## 20. AuditLog

| Cột | Kiểu | Ghi chú |
|---|---|---|
| audit_id | id | `AUD-00001` |
| timestamp | datetime | |
| actor_email | email | |
| action | text | create/update/delete/approve/recompute |
| table_name | text | |
| row_id | text | |
| old_json | text | |
| new_json | text | |
| note | text | |

Ghi log cho:

- Receivables
- WeeklyDemand
- DailyReport sau cửa sổ sửa
- Categories/Settings
- Overrides
- Recompute KPI

## 21. Index Mềm Trong Apps Script

Apps Script không có index DB thật. Khi cần hiệu năng, load sheet thành object map:

```javascript
{
  byId: {},
  byBranch: {},
  byWeekProjectStaff: {}
}
```

Cache ngắn hạn bằng `CacheService`:

- categories: 10 phút
- master lookup: 5 phút
- dashboard summary: 1-5 phút

Không cache dữ liệu theo user nếu scope phức tạp mà chưa kèm key role/email.

## 22. Backup

Tối thiểu:

- Tạo bản copy spreadsheet mỗi ngày bằng time trigger.
- Lưu vào folder `Labor CRM Backups`.
- Giữ 30 bản gần nhất.

Nâng cấp:

- Export JSON/CSV theo từng sheet.
- Audit log không xóa.

