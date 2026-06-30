# Trạng Thái Hiện Thực & Điểm Lệch So Với Spec

**Bản build:** `C:\Users\Admin\Documents\exel\AppsScript\labor_crm_gas\` (đẩy lên Apps Script bằng `clasp`).
**Ngày:** 2026-06-29. Tài liệu này đối chiếu code thực tế với bộ spec `01..04` và ghi rõ điểm đã khớp / lệch / chưa làm.

> Kết luận nhanh: **lõi nghiệp vụ khớp gần như 100%**. Lệch chủ yếu ở **quy ước đặt tên** (field/sheet tiếng Việt thay vì English) và một số màn phụ. Đã đồng bộ: manifest, sheet `Users`, backup, UI desktop, nhập nhu cầu hàng loạt, Khách hàng 360.

---

## 1. File code thực tế

| File | Vai trò | Spec tương ứng |
|---|---|---|
| `00_Config.gs` | SCHEMA 25 sheet + seed enum/branch/aging/cadence/alias | 02-Sheet-Data-Model |
| `01_Db.gs` | ORM (dbAll/dbInsert/dbUpdate/dbUpsert/audit) | 04 §10 DB Helpers |
| `02_Setup.gs` | `setupAll`, `seedDemo`, `seedAdminUser_` | 04 Phase 0 |
| `03_Kpi.gs` | FULL OUTER roll-up + công thức + test T1–T5 | 01 §5.8, 04 §14 |
| `04_Finance.gs` | Công nợ 2 trục + test D1–D4 | 01 §5.11, BR-D |
| `05_Crm.gs` | Cadence chăm sóc, overdue, sinh lượt kế | 01 §5.10, BR-C |
| `06_Menu.gs` | Menu + time-trigger | 04 §15 Jobs |
| `07_Api.gs` | doGet + API (bootstrap/list/get/save/dashboard/360/bulk/workflow) | 04 §6,§11 |
| `08_Meta.gs` | Metadata module điều khiển UI generic | (kiến trúc bổ sung) |
| `09_Rbac.gs` | userContext_ (Users sheet) + ma trận quyền + scope + IDOR guard | 04 §7,§8,§9 |
| `10_Workflow.gs` | Workflow công nợ/chăm sóc, role-gated | 01 §5.11, BR-D |
| `11_Jobs.gs` | Backup spreadsheet hằng ngày (giữ 30) | 02 §22, 04 §15 |
| `99_Migration.gs` | Nạp dữ liệu thật CRM-Miniapp-2.xlsx | (GĐ4) |
| `App/Styles/Ui.html` | Web App SPA responsive (mobile + desktop) | 03 UX/UI, 04 §5 |

---

## 2. Đối chiếu theo tài liệu spec

### 01-SRS-AppsScript

| Mục | Trạng thái | Ghi chú |
|---|---|---|
| Vai trò ADMIN/BOD/BM/OM/SPV | ✅ | đủ 5 role |
| Auth Google + sheet `Users` | ✅ | `userContext_` đọc `Users`; không có → No Access |
| Dashboard theo role | ✅ | `apiDashboard` scope theo role/branch |
| Nhân sự/Khách/Dự án/Xưởng | ✅ | CRUD qua engine generic + Khách 360 |
| Nhu cầu tuần + KPI giao | ✅ | form đơn + **grid nhập hàng loạt** |
| Báo cáo ngày (phễu, T+1, week computed) | ✅ | `apiSubmitDaily` BR-F1, cửa sổ T+1, SPV ép specialist |
| KPI tuần dẫn xuất (read-only, FULL OUTER) | ✅ | test T1–T5 PASS |
| Chính sách (khách×xưởng, đơn vị) | ✅ | |
| Chăm sóc (cadence không drift) | ✅ | mark_1_15, has_log bắt buộc |
| Công nợ (2 trục, override BM) | ✅ | test D1–D4 PASS |
| Danh mục/Config | ✅ | Categories + AgingThresholds + CareFrequencies |
| BR-F/K/C/D/O | ✅ | đầy đủ |

### 02-Sheet-Data-Model

| Mục | Trạng thái | Ghi chú |
|---|---|---|
| Mỗi tab 1 bảng, cột ID, FK lưu ID | ✅ | |
| Sheet `Users` | ✅ | đã thêm |
| Toàn bộ 23 sheet | ✅ | có đủ (xem mục 3 về tên) |
| Aging thresholds mặc định | ✅ | giống hệt bảng spec |
| CareFrequencies (weekly/monthly_1_15/...) | ✅ | |
| AuditLog | ⚠️ | có, nhưng **format field-level** (trường/cũ/mới) thay vì `old_json/new_json` |
| ReviewQueue | ⚠️ | đặt tên `NameQueue` |
| Index mềm / CacheService | ❌ | **chưa dùng CacheService** (dữ liệu nhỏ, chưa cần) |
| Backup | ✅ | `jobBackupSpreadsheet` |

### 03-UX-UI-Design

| Mục | Trạng thái | Ghi chú |
|---|---|---|
| Mobile-first (bottom nav, card, form 1 cột) | ✅ | |
| **Desktop (sidebar 240px + bảng)** | ✅ | đã thêm layout responsive @1024px |
| No Access state | ⚠️ | backend chặn (throw); chưa có màn No Access đẹp riêng |
| Dashboard role-aware + widget | ✅ | cards/funnel/aging/data-quality |
| Báo cáo ngày desktop bảng + mobile card | ✅ | list render cả 2 |
| KPI read-only + badge lệch CV + sort | ✅ (một phần) | có badge; sort nâng cao cơ bản |
| Nhu cầu tuần grid hàng loạt | ✅ | màn `#/bulk` |
| Khách hàng 360 (tabs liên quan) | ✅ | `#/cust360` hiển thị dự án/xưởng/chính sách/chăm sóc/công nợ |
| Chăm sóc (bắt đầu/hoàn thành) | ✅ | |
| Công nợ (ghi thu, pháp lý, override) | ✅ | |
| Cấu hình/Users in-app (ADMIN) | ⚠️ | có **module Users** + Hàng đợi alias + Audit; **chưa gộp thành 1 màn tabs** Categories/Aging/CareFreq |
| Status badges màu | ✅ (một phần) | badge trạng thái có; bảng màu đầy đủ chưa tinh chỉnh hết |
| i18n VI/中 | ✅ | toggle + Categories song ngữ |

### 04-Implementation-Blueprint

| Mục | Trạng thái | Ghi chú |
|---|---|---|
| Manifest USER_ACCESSING + ANYONE_WITH_GOOGLE_ACCOUNT | ✅ | đã sửa |
| doGet + include + App/Styles/Ui.html | ✅ | (gộp Client vào Ui) |
| getCurrentUser_ → Users | ✅ | `userContext_` |
| RBAC require/scope | ✅ | + **chống IDOR** (kiểm scope từng bản ghi) — chặt hơn spec |
| DB helpers | ✅ | tên `dbAll/dbInsert/...` |
| recomputeWeeklyKpi_ | ✅ | `recomputeWeek` |
| Jobs (aging/overdue/backup/recompute) | ✅ | gộp trong `nightlyAll` |
| Audit | ✅ | (format field-level) |
| clasp dev | ✅ | đã push thực tế |

---

## 3. Điểm lệch CỐ Ý (giữ nguyên, không refactor)

| # | Spec | Build | Lý do giữ |
|---|---|---|---|
| 1 | Field/sheet **English** (staff_id, project_id, started_work, Customers...) | **Tiếng Việt** (du_an, chuyen_vien, di_lam, Customer...) | Lõi đã chạy + test PASS; đổi tên toàn bộ tốn công, rủi ro, không thêm chức năng. Người dùng quyết bỏ refactor English |
| 2 | ID prefix `DA-`, `BR-0001`, `AUD-` | `PRJ-`, Branch=tên trực tiếp, Audit=hash | đã có dữ liệu thật theo prefix này |
| 3 | AuditLog `old_json/new_json` | field-level (truong/cũ/mới) | đủ truy vết; có thể đổi sau nếu cần |
| 4 | `ReviewQueue` | `NameQueue` | chỉ khác tên |
| 5 | Sheet số nhiều (Customers, Projects) | số ít (Customer, Project) | chỉ khác tên |

**Bảng quy đổi field chính (build VN ↔ spec EN):**

| Build (VN) | Spec (EN) |
|---|---|
| du_an | project_id |
| chuyen_vien | specialist_staff_id |
| quan_ly / quan_ly_phu_trach | manager_staff_id |
| kpi_giao | assigned_kpi |
| nhu_cau_kh_tuan | customer_demand |
| dang_ky / phong_van / do_pv / di_lam | registered / interviewed / passed_interview / started_work |
| so_tien / da_thu / con_lai | amount / collected_amount / remaining_amount |
| so_ngay_qua_han | overdue_days |
| giai_doan_aging / trang_thai_thu / giai_doan_truy_thu | aging_stage / collection_status / collection_stage |
| chi_nhanh / branch | branch_id |

---

## 4. Chưa làm / để sau

- Màn **Cấu hình gộp tabs** (Categories/Aging/CareFreq/Branches/Backup) in-app — hiện quản trị qua Sheet trực tiếp + module rời (Users, Hàng đợi alias, Audit).
- **CacheService** tối ưu (dữ liệu hiện nhỏ, chưa cần).
- Cột **created_by/created_at/updated_at** mỗi dòng (đang dùng AuditLog tách riêng).
- Màn **No Access** thẩm mỹ riêng (hiện chặn bằng lỗi backend).
- Tinh chỉnh **bảng màu badge** đầy đủ theo 03 §13.
- **Refactor English** toàn bộ (đã quyết bỏ).

---

## 5. Khác biệt build CHẶT HƠN spec (điểm cộng)

- **Chống IDOR**: mọi `apiGet/apiSave/workflow` kiểm scope **từng bản ghi** (không chỉ ma trận role) — spec mẫu mới lọc ở list.
- **Default-deny** + allow-list `ADMIN_EMAILS` (script property) làm bootstrap trước khi seed Users.
- **Test vectors** T1–T5 (KPI) + D1–D4 (công nợ) chạy được bằng `runKpiTests`/`runReceivableTests`.
- **Đã review đa tác nhân** và vá 15 lỗ hổng phân quyền trước khi bàn giao.
