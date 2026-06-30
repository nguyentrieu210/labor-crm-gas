# Đặc tả Kiến trúc — CRM Mini App Cung ứng & Tuyển dụng Lao động FDI (Frappe + Vue)

> **App:** `labor_crm` (module gốc `Labor CRM`) · **Site:** `hoangdat.gpcds.site` · **Mount SPA:** `/labor` · **Stack:** Frappe v15 (Python/MariaDB) + Vue 3 SPA (frappe-ui + Tailwind + Vue Router + Pinia + Vite) · **Ngôn ngữ:** Song ngữ Việt–Trung.
>
> Phạm vi nghiệp vụ: CRM cho công ty cung ứng/tuyển dụng lao động phục vụ nhà máy FDI (Goertek, Canon, Foxconn[Fuyu/Fulian/Fukang/Fuhong/Fushan/Funing], Luxshare, Lens, Wistron, Qisda, Quanta, Compal, Amphenol, GGEC, Foxlink, Gentherm, YKK, LCFC). Chi nhánh: Bắc Ninh, Bắc Giang, Nam Định, Hà Nam, Đà Nẵng, Nghệ An, Vĩnh Phúc.
>
> Tệp tham chiếu: `C:\Thanh cong\CRM-Miniapp-Spec.md` (SRS-CRM-MINIAPP-v1.1, trích từ workbook `CRM-Miniapp-2.xlsx`, 10 sheet). *Lưu ý: file `.xlsx` không hiện diện trong thư mục làm việc; đặc tả này bám trực tiếp SRS đã trích xuất.*

---

## 1. Mục tiêu & phạm vi kiến trúc — 2 cải tiến chốt

### 1.1. Mục tiêu

Xây dựng một Mini App CRM mobile-first, song ngữ Việt–Trung, đủ để đội dev **khởi tạo app Frappe và tạo DocType ngay**, quản lý đầu–cuối: Nhân sự → Khách hàng → Dự án → Xưởng → Chính sách giá → Nhu cầu tuần → Báo cáo tuyển dụng ngày → KPI tuần → Chăm sóc khách hàng → Công nợ. Trọng tâm kiến trúc: **dữ liệu sạch (liên kết bằng khóa, không bằng tên)**, **số liệu dẫn xuất tính bằng máy (không nhập tay)**, **phân quyền theo chi nhánh + người phụ trách**.

### 1.2. Hai cải tiến chốt (Quyết định kiến trúc)

#### Quyết định A — KPI tuần suy ra từ Nhu cầu tuần (LDR Weekly KPI là bảng DẪN XUẤT)

> **Vấn đề nền:** dữ liệu mâu thuẫn — `NhuCauTuan` ghi KPI giao=100 ở W15 nhưng `KPITuan` các tuần sau lại =0; liên kết các sheet bằng TÊN gây roll-up sai.
>
> **QUYẾT ĐỊNH:**
> 1. **`LDR Weekly Demand` (NhuCauTuan) là nguồn sự thật duy nhất của `kpi_giao`** (BR-K7/R7). Mỗi tuần độc lập, **KHÔNG cộng dồn**.
> 2. **`LDR Weekly KPI` (KPITuan) là bảng dẫn xuất, read-only tuyệt đối** (BR-K10): không role nào nhập tay trừ recompute path (`flags.from_recompute`) / System Manager. Sửa KPI giao → tại Nhu cầu tuần; sửa phễu → tại Báo cáo ngày.
> 3. Sinh KPI tuần bằng **FULL OUTER JOIN** theo khóa nhóm `(tuan × du_an × chuyen_vien)`: cạnh trái = KPI giao + Nhu cầu (Demand), cạnh phải = Σ phễu (Daily Report, gộp mọi phương thức). MariaDB không hỗ trợ FULL OUTER native → **emulate bằng merge dict trong Python** để unit-test khớp Test Vectors T1–T5.
> 4. Bổ sung chỉ số **"Đạt nhu cầu"** (`dat_nhu_cau = di_lam / nhu_cau_kh`) bên cạnh "Fill rate" (`di_lam / kpi_giao`) — đo fill so với nhu cầu thật của khách (khác cam kết nội bộ).
> 5. Lệch chuyên viên (chỉ có Demand HOẶC chỉ có Report) → cờ `co_lech_chuyen_vien=True` (BR-K8/VR-W7); Phase 1 chỉ gắn cờ + cảnh báo (API `get_kpi_mismatch` + msgprint khi nhập), KHÔNG tự phân bổ lại KPI.

#### Quyết định B — LDR Workshop là thực thể độc lập

> **Vấn đề nền:** các xưởng con Foxconn (Fuyu/Fulian/Fukang/Fuhong/Fushan/Funing) + biến thể tên (HIP↔HI-P, LuxshareBacGiang↔Luxshare Bắc Giang, Canfoco CN↔Canfoco) xuất hiện trong NhuCauTuan/BaoCaoNgay/ChinhSach dưới dạng **text tự do**, không có trong DuAn → lệch cấp chi tiết, roll-up sai.
>
> **QUYẾT ĐỊNH:**
> 1. Tạo DocType **`LDR Workshop`** nằm giữa `LDR Project` và các sheet giao dịch; tự tham chiếu `parent_workshop` + `is_group` để dựng **cây xưởng Foxconn** (xưởng con → node group → dự án).
> 2. Mọi tham chiếu xưởng đổi từ `Data` (text) sang **`Link → LDR Workshop`**.
> 3. **Denormalization có kiểm soát:** mọi dòng giao dịch lưu CẢ HAI khóa `du_an` + `xuong`; `du_an` luôn derive lại từ `workshop.project` trong `validate()` (không tin client).
> 4. Tên thô chỉ vào hệ thống qua **pipeline alias** (`LDR Workshop Alias` / `LDR Project Alias`) + **hàng đợi review** (`LDR Name Normalization Queue`) — KHÔNG bao giờ tự tạo Workshop bừa. Thứ tự áp alias: **Workshop Alias TRƯỚC, rồi Project Alias** (BR-R4b).
> 5. Roll-up theo **dự án cha** (BR-R6); `xuong` giữ ở bản ghi gốc để drill-down (BR-X3).
> 6. **Node group** (`is_group=1`, vd "Foxconn"): vẫn BẮT BUỘC trỏ `project` về dự án Foxconn cấp dưới khách hàng (BR-X1 không miễn trừ); node group chỉ dùng làm cấp tổng hợp roll-up, KHÔNG được chọn trực tiếp cho giao dịch (validate chặn `is_group=1` ở field `xuong` của Demand/Daily/Policy).

---

## 2. Sơ đồ kiến trúc tổng thể

> **Quy ước tên trong sơ đồ & toàn tài liệu:** mọi tham chiếu rút gọn (Workshop, Project, Weekly KPI, Daily Report, Customer…) = tên DocType đầy đủ có tiền tố **`LDR`** (xem 3.1). Sơ đồ rút gọn cho dễ đọc; khi code phải dùng tên đầy đủ.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Mobile-first Mini App)                      │
│   Vue 3 SPA  ·  frappe-ui + Tailwind  ·  Vue Router 4  ·  Pinia  ·  vue-i18n│
│   mount /labor  →  pages (Dashboard theo vai trò, List+Form mỗi module)     │
└───────────────┬───────────────────────────────────────┬───────────────────┘
                │ frappe.call / createListResource       │ socket.io (realtime)
                │ (REST /api/method, CSRF token)          │ list_update
                ▼                                         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       FRAPPE BACKEND (Python)                               │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐ │
│  │ Controllers  │  │ Whitelisted  │  │  Workflow     │  │ RBAC 3 tầng    │ │
│  │ validate/    │  │ API          │  │  Engine       │  │ DocPerm →      │ │
│  │ on_update    │  │ (api/*.py)   │  │ (Receivable,  │  │ UserPerm Branch│ │
│  │              │  │              │  │  Care)        │  │ → QueryCond    │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────────┘  └────────────────┘ │
│         │  services/ (kpi_rollup, normalization, aging, cadence, recompute) │
│  ┌──────▼──────────────────────────────────────────────────────────────┐  │
│  │ doc_events + scheduler_events + permission_query_conditions           │  │
│  │  cron 02:00 → recompute KPI (self-heal T+1) + nightly_reage công nợ   │  │
│  │  daily → mark_overdue chăm sóc ·  weekly → lock_previous_week         │  │
│  └──────────────────────────────────────────────────────────────────────┘ │
└───────────────┬──────────────────────────────────────────┬────────────────┘
                │ ORM (DocType)                              │ Redis (cache/queue/lock)
                ▼                                            ▼
┌──────────────────────────────┐              ┌────────────────────────────┐
│         MariaDB               │              │  Background Workers          │
│  tab* DocTypes + index        │              │  (RQ): recompute_week,       │
│  composite (tuan,du_an,cv)    │              │   enqueue jobs, scheduler    │
└──────────────────────────────┘              └────────────────────────────┘
```

**Luồng dữ liệu cốt lõi:** `LDR Weekly Demand` (KPI giao) + `LDR Daily Recruitment Report` (phễu) → **FULL OUTER JOIN (Python merge)** → `LDR Weekly KPI` (read-only) → roll-up dự án/chi nhánh → Dashboard. Mọi field dẫn xuất tính ở controller/scheduler, đẩy realtime về SPA qua `list_update`.

---

## 3. Danh mục DocType đầy đủ

### 3.1. Quy ước

- **Tiền tố `LDR`** (Labor Demand & Recruitment) cho mọi DocType custom → tránh đụng core Frappe (`Customer`, `Project`, `Contact`).
- **CHỐT ĐẶT TÊN (load-bearing):** Mọi tham chiếu rút gọn trong văn bản/sơ đồ (Workshop, Project, Weekly KPI, Daily Report, Customer, Staff…) = tên DocType đầy đủ có tiền tố `LDR` (`LDR Workshop`, `LDR Project`…). Ngoại lệ duy nhất KHÔNG có tiền tố: `Labor CRM Settings`, `User`, `Workflow State` (core Frappe). `frappe.get_doc(...)`, `Link.options`, `tab<Name>` đều phải khớp chính xác tên đầy đủ.
- Tên DocType = **English Title Case**; label VI + 中文 đặt qua **Translation** (vi, zh).
- 5 module: **Master Data, Recruitment, CRM, Finance, Settings**.
- **Chiến lược naming (sửa A1/A2 review Frappe):** mọi DocType mã tăng dần dùng **`naming_series`** thuần (`autoname = "XX-.#####"`). KHÔNG dùng `format:` chứa token `{#####}` (Frappe không parse `#` trong `format:` thành counter). `LDR Weekly KPI` dùng **`autoname = "hash"`** + UNIQUE index `(tuan, du_an, chuyen_vien)` (tránh xung đột set `name` thủ công khi upsert).
- **Trường `ma` (mã gốc):** chỉ giữ ở các DocType import từ Excel để **truy vết dữ liệu cũ** (vd `NC0001` từ workbook), read-only, KHÔNG dùng làm khóa logic. Khóa nghiệp vụ thực = `name` (naming series). DocType không import từ Excel KHÔNG có field `ma`.

### 3.2. Bảng danh mục + ánh xạ sheet → DocType

| # | Sheet gốc | DocType | Label VI | 中文 | Module | autoname | istable | submittable |
|---|---|---|---|---|---|---|---|---|
| 1 | (seed) | **LDR Branch** | Chi nhánh | 分公司 | Master Data | `field:branch_name` | 0 | 0 |
| 2 | NhanSu | **LDR Staff** | Nhân sự | 员工 | Master Data | `NS-.#####` | 0 | 0 |
| 3 | KhachHang | **LDR Customer** | Khách hàng | 客户 | Master Data | `KH-.#####` | 0 | 0 |
| 4 | DuAn | **LDR Project** | Dự án | 项目 | Master Data | `PRJ-.#####` | 0 | 0 |
| 5 | (con DuAn) | **LDR Project Specialist** | Chuyên viên dự án | 项目专员 | Master Data | hash | **1** | 0 |
| 6 | (QĐ B) | **LDR Workshop** | Xưởng | 车间 | Master Data | `WS-.#####` | 0 | 0 |
| 7 | DanhMuc | **LDR Category Value** | Giá trị danh mục | 类别值 | Master Data | `format:{category_group}-{enum_code}` | 0 | 0 |
| 8 | (QĐ B) | **LDR Workshop Alias** | Bí danh xưởng | 车间别名 | Master Data | hash | 0 | 0 |
| 9 | (QĐ B) | **LDR Project Alias** | Bí danh dự án | 项目别名 | Master Data | hash | 0 | 0 |
| 10 | (QĐ B) | **LDR Name Normalization Queue** | Hàng đợi chuẩn hóa tên | 名称规范队列 | Master Data | hash | 0 | 0 |
| 11 | NhuCauTuan | **LDR Weekly Demand** | Nhu cầu tuần | 周需求 | Recruitment | `NC-.#####` | 0 | 0 |
| 12 | BaoCaoNgay | **LDR Daily Recruitment Report** | Báo cáo tuyển dụng ngày | 每日招聘报表 | Recruitment | `BC-.#####` | 0 | **1** |
| 13 | KPITuan | **LDR Weekly KPI** | KPI tuần | 周KPI | Recruitment | `hash` (+UNIQUE) | 0 | 0 |
| 14 | ChinhSach | **LDR Recruitment Policy** | Chính sách tuyển dụng | 招聘政策 | Recruitment | `CS-.####` | 0 | 0 |
| 15 | (QĐ A) | **LDR KPI Recompute Log** | Nhật ký tính lại KPI | KPI重算日志 | Recruitment | `KRL-.#######` | 0 | 0 |
| 16 | ChamSoc | **LDR Customer Care Task** | Việc chăm sóc khách hàng | 客户维护任务 | CRM | `CSK-.#####` | 0 | 0 (Workflow) |
| 17 | (con ChamSoc) | **LDR Customer Care Log** | Nhật ký tương tác | 互动日志 | CRM | hash | **1** | 0 |
| 18 | CongNo | **LDR Receivable** | Công nợ phải thu | 应收账款 | Finance | `CN-.####` | 0 | 0 (Workflow) |
| 19 | (con CongNo) | **LDR Receivable Collection Log** | Nhật ký thu hồi | 催收日志 | Finance | hash | **1** | 0 |
| 20 | (config 5.3) | **Labor CRM Settings** | Cấu hình CRM | CRM配置 | Settings | Single | 0 | 0 |
| 21 | (con Settings) | **LDR Aging Threshold** | Ngưỡng lão hóa | 账龄阈值 | Settings | hash | **1** | 0 |
| 22 | (con Settings) | **LDR Care Frequency Setting** | Cấu hình tần suất | 关怀频率配置 | Settings | hash | **1** | 0 |

### 3.3. ERD bằng lời

- **LDR Branch** ―(1:N)→ **LDR Customer**, **LDR Project**, **LDR Staff** (mỗi thực thể có `branch` Link → Branch, dùng cho User Permission row-level).
- **LDR Customer** ―(1:N)→ **LDR Project** ―(1:N)→ **LDR Workshop**. Workshop tự tham chiếu `parent_workshop` (cây Foxconn), `customer`/`branch` derive từ Project.
- **LDR Project** ―(1:N child)→ **LDR Project Specialist** (n-n chuyên viên, thay 2 cột CV1/CV2).
- **LDR Recruitment Policy**: `khach_hang` (Link Customer) + `xuong` (Link Workshop), UNIQUE `(khach_hang, xuong)`.
- **LDR Weekly Demand** + **LDR Daily Recruitment Report** ―(FULL OUTER theo `tuan×du_an×chuyen_vien`)→ **LDR Weekly KPI** (dẫn xuất). Mỗi có `du_an` (Link Project) + `xuong` (Link Workshop, optional).
- **LDR Customer Care Task** ―(1:N child)→ **LDR Customer Care Log** (append-only). `khach_hang` → Customer; `quan_ly` → Staff.
- **LDR Receivable** ―(1:N child)→ **LDR Receivable Collection Log**. `khach_hang` → Customer; `du_an` → Project (nullable, tách từ cột gộp).
- **LDR Category Value** ←(N:1 logic)― mọi field Link song ngữ động (vai_tro, trang_thai, phuong_thuc, dang_tuyen…) tham chiếu qua Link.
- **LDR Workshop Alias / Project Alias** ―(map)→ Workshop / Project; tên thô không khớp → **LDR Name Normalization Queue**.

---

## 4. Đặc tả từng DocType

> **Chính sách enum song ngữ (sửa V9/A14 — load-bearing):** MỌI field enum cần hiển thị song ngữ động (đổi nhãn theo locale) đều là **`Link → LDR Category Value`** (lọc theo `category_group` qua `get_query`), KHÔNG dùng `Select`. Lý do: chiến lược i18n (mục 11.1) dịch enum runtime qua `get_category_values` đọc `LDR Category Value` — chỉ chạy được khi enum là dữ liệu Link. `Select` tĩnh CHỈ dùng cho enum kỹ thuật không cần dịch (vd `vai_tro_trong_du_an`, `status` Workshop, `ket_qua` care log).

### 4.1. LDR Branch — autoname `field:branch_name` · istable 0 · submittable 0

| fieldname | label VI | 中文 | fieldtype | options | reqd | read_only | ghi chú |
|---|---|---|---|---|:--:|:--:|---|
| `branch_name` | Tên chi nhánh | 分公司名称 | Data | — | ✓ | | unique; dùng làm giá trị User Permission |
| `branch_name_zh` | Tên chi nhánh (中文) | 分公司名称(中) | Data | — | | | song ngữ master |
| `branch_code` | Mã chi nhánh | 分公司编码 | Data | — | | | BN, BG, NĐ… |
| `region` | Khu vực | 区域 | Data | — | | | tùy chọn |
| `is_active` | Đang hoạt động | 启用 | Check | — | | | default 1 |

> Seed 7 chi nhánh: Bắc Ninh, Bắc Giang, Nam Định, Hà Nam, Đà Nẵng, Nghệ An, Vĩnh Phúc. *(Branch là DocType riêng, KHÔNG seed thành nhóm `chi_nhanh` trong Category Value — quyết định cố ý, vì cần row-level User Permission.)*

### 4.2. LDR Staff — autoname `NS-.#####` · title `full_name`

| fieldname | label VI | 中文 | fieldtype | options | reqd | read_only | ghi chú |
|---|---|---|---|---|:--:|:--:|---|
| `full_name` | Họ tên | 姓名 | Data | — | ✓ | | tìm không dấu ở UI |
| `full_name_zh` | Họ tên (中文) | 姓名(中) | Data | — | | | |
| `branch` | Chi nhánh | 分公司 | Link | LDR Branch | ✓ | | User Permission |
| `vai_tro` | Vai trò | 角色 | Link | LDR Category Value | ✓ | | nhóm `vai_tro` |
| `trang_thai` | Trạng thái | 状态 | Link | LDR Category Value | ✓ | | nhóm `trang_thai_nv` (Chính thức/Thử việc) |
| `user` | Tài khoản đăng nhập | 登录账号 | Link | User | | | gắn Frappe User; Role cấp trên User |
| `quan_ly_truc_tiep` | Quản lý trực tiếp | 直属上级 | Link | LDR Staff | | | self-FK; scope OM→SPV |
| `email` | Email | 邮箱 | Data | — | | | fetch_from `user.email` |
| `phone` | Điện thoại | 电话 | Data | — | | | |
| `is_active` | Đang làm việc | 在职 | Check | — | | | default 1; soft-delete |

### 4.3. LDR Customer — autoname `KH-.#####` · title `customer_name`

| fieldname | label VI | 中文 | fieldtype | options | reqd | read_only | ghi chú |
|---|---|---|---|---|:--:|:--:|---|
| `customer_name` | Tên khách hàng | 客户名称 | Data | — | ✓ | | Goertek, Foxconn… |
| `customer_name_zh` | Tên KH (中文) | 客户名称(中) | Data | — | | | |
| `customer_code` | Mã khách hàng | 客户编码 | Data | — | | | ghép naming Workshop |
| `branch` | Chi nhánh | 分公司 | Link | LDR Branch | ✓ | | row-level perm |
| `phan_loai` | Phân loại | 分类 | Link | LDR Category Value | ✓ | | nhóm `phan_loai_kh` |
| `dich_vu` | Dòng dịch vụ | 服务类型 | Link | LDR Category Value | | | nhóm `dich_vu` |
| `quan_ly_phu_trach` | Quản lý phụ trách | 负责经理 | Link | LDR Staff | | | |
| `is_active` | Đang hợp tác | 合作中 | Check | — | | | default 1 |

> **Hook BR-M5:** `LDR Customer.on_update` → nếu `phan_loai` đổi, cập nhật default `hoat_dong`/`tan_suat` cho các `LDR Customer Care Task` của khách này còn ở trạng thái Pending/In Progress (theo BR-C1/C2); task đã Done giữ nguyên.

### 4.4. LDR Project + child LDR Project Specialist

**LDR Project** — autoname `PRJ-.#####` · title `project_name`

| fieldname | label VI | 中文 | fieldtype | options | reqd | read_only | ghi chú |
|---|---|---|---|---|:--:|:--:|---|
| `project_name` | Tên dự án | 项目名称 | Data | — | ✓ | | tên chuẩn (sau resolve alias) |
| `project_name_zh` | Tên dự án (中文) | 项目名称(中) | Data | — | | | |
| `customer` | Khách hàng | 客户 | Link | LDR Customer | ✓ | | |
| `branch` | Chi nhánh | 分公司 | Link | LDR Branch | ✓ | | fetch_from `customer.branch`; kiểm nhất quán |
| `phan_loai` | Phân loại | 分类 | Link | LDR Category Value | ✓ | | nhóm `phan_loai_kh` |
| `dich_vu` | Dòng dịch vụ | 服务类型 | Link | LDR Category Value | | | nhóm `dich_vu` |
| `quan_ly_phu_trach` | Quản lý phụ trách | 负责经理 | Link | LDR Staff | | | null → cảnh báo mềm VR-W1 |
| `specialists` | Chuyên viên | 专员 | Table | LDR Project Specialist | | | n-n thay CV1/CV2 |
| `trang_thai` | Trạng thái | 状态 | Link | LDR Category Value | ✓ | | nhóm `trang_thai_da` |
| `is_active` | Đang hoạt động | 启用 | Check | — | | | default 1 |

**LDR Project Specialist** (child, istable 1) — parentfield `specialists`

| fieldname | label VI | 中文 | fieldtype | options | reqd | read_only | ghi chú |
|---|---|---|---|---|:--:|:--:|---|
| `specialist` | Chuyên viên | 专员 | Link | LDR Staff | ✓ | | không trùng trong cùng dự án |
| `specialist_name` | Tên chuyên viên | 专员姓名 | Data | — | | ✓ | fetch_from `specialist.full_name` |
| `vai_tro_trong_du_an` | Vai trò trong dự án | 项目角色 | Select | `Chuyên viên 1`⏎`Chuyên viên 2`⏎`Khác` | ✓ | | Select tĩnh có chủ đích (không cần dịch động) |
| `branch` | Chi nhánh | 分公司 | Data | — | | ✓ | fetch_from `specialist.branch` |

### 4.5. LDR Workshop — autoname `WS-.#####` · title `workshop_name`

| fieldname | label VI | 中文 | fieldtype | options | reqd | read_only | ghi chú |
|---|---|---|---|---|:--:|:--:|---|
| `workshop_name` | Tên xưởng | 车间名称 | Data | — | ✓ | | tên chuẩn (canonical) |
| `workshop_name_zh` | Tên xưởng (中文) | 车间名称(中) | Data | — | | | |
| `workshop_code` | Mã xưởng | 车间编码 | Data | — | | | FUYU, FULIAN… |
| `project` | Dự án | 项目 | Link | LDR Project | ✓ | | xưởng THUỘC dự án (BR-X1 reqd, kể cả node group) |
| `customer` | Khách hàng | 客户 | Link | LDR Customer | | ✓ | fetch_from `project.customer` |
| `branch` | Chi nhánh | 分公司 | Link | LDR Branch | | ✓ | fetch_from `project.branch` |
| `parent_workshop` | Xưởng cha | 上级车间 | Link | LDR Workshop | | | self-FK cây Foxconn |
| `is_group` | Là nhóm | 分组节点 | Check | — | | | =1 node tổng hợp ("Foxconn"); cấm chọn cho giao dịch |
| `status` | Trạng thái | 状态 | Select | `Active`⏎`Inactive`⏎`Merged` | ✓ | | Select tĩnh (kỹ thuật); default Active |
| `merged_into` | Gộp vào | 合并至 | Link | LDR Workshop | | | depends_on status=Merged |
| `recruiting` | Đang tuyển | 招聘中 | Check | — | | ✓ | đồng bộ từ Policy (hook) |
| `has_dormitory` | Có KTX | 有宿舍 | Check | — | | ✓ | đồng bộ từ Policy (hook) |
| `notes` | Ghi chú | 备注 | Small Text | — | | | |

> **Ràng buộc validate:** `customer==project.customer`, `branch==project.branch`; `parent_workshop` cùng project/customer; không chọn xưởng `Merged` cho giao dịch (auto-redirect `merged_into`); `is_group=1` không được dùng ở field `xuong` của Demand/Daily/Policy. `project` reqd kể cả khi `is_group=1` (node group trỏ về dự án Foxconn — BR-X1 không miễn trừ).

### 4.6. LDR Category Value — autoname `format:{category_group}-{enum_code}` · title `gia_tri`

| fieldname | label VI | 中文 | fieldtype | options | reqd | read_only | ghi chú |
|---|---|---|---|---|:--:|:--:|---|
| `category_group` | Nhóm danh mục | 类别组 | Data | — | ✓ | | `vai_tro`, `phan_loai_kh`… |
| `enum_code` | Mã enum | 枚举编码 | Data | — | ✓ | | bất biến — khóa FK (BR-M2); validate regex `^[a-z0-9_]+$` (A3) |
| `gia_tri` | Giá trị (VI) | 值(越) | Data | — | ✓ | | nhãn tiếng Việt |
| `ten_trung` | Giá trị (中文) | 值(中) | Data | — | | | nhãn tiếng Trung |
| `display_order` | Thứ tự hiển thị | 排序 | Int | — | | | sắp xếp dropdown |
| `is_enabled` | Đang sử dụng | 启用 | Check | — | | | default 1 |

> **Ràng buộc đúng nhóm:** mỗi Link → Category Value đặt `get_query` lọc `category_group=<nhóm> & is_enabled=1`; kiểm bổ sung trong `validate`. `category_group` + `enum_code` validate regex để name (`format:`) không chứa ký tự phá vỡ. `track_changes=1` (audit đổi danh mục).

### 4.7. LDR Weekly Demand — autoname `NC-.#####` · title `name`

| fieldname | label VI | 中文 | fieldtype | options | reqd | read_only | ghi chú |
|---|---|---|---|---|:--:|:--:|---|
| `ma` | Mã gốc | 原编号 | Data | — | | ✓ | mã gốc Excel (NC0001) để truy vết; null nếu tạo mới |
| `tuan` | Tuần | 周 | Data | — | ✓ | | ISO `YYYY-Www`; regex `^\d{4}-W\d{2}$` |
| `chi_nhanh` | Chi nhánh | 分公司 | Link | LDR Branch | | ✓ | fetch_from `du_an.branch` (không reqd — fetch sau khi chọn du_an) |
| `du_an` | Dự án | 项目 | Link | LDR Project | ✓ | | |
| `xuong` | Xưởng | 车间 | Link | LDR Workshop | | | nếu nhu cầu cấp xưởng; cấm `is_group=1` |
| `quan_ly` | Quản lý | 主管 | Link | LDR Staff | ✓ | | |
| `chuyen_vien` | Chuyên viên | 专员 | Link | LDR Staff | ✓ | | thành phần khóa nhóm |
| `nhu_cau_kh_tuan` | Nhu cầu KH (tuần) | 客户周需求 | Int | — | ✓ | | ≥ 0 |
| `kpi_giao` | KPI giao | 下达KPI | Int | — | ✓ | | ≥ 0; **nguồn sự thật** |

> UNIQUE `(tuan, du_an, chuyen_vien)` (validate + index). VR-W3 (mềm): `nhu_cau>0 & kpi_giao=0` → msgprint. VR-W6 (mềm): `kpi_giao>nhu_cau` → msgprint. `track_changes=1`. `on_update` → `recompute_for_demand`.

### 4.8. LDR Daily Recruitment Report — autoname `BC-.#####` · **submittable 1**

| fieldname | label VI | 中文 | fieldtype | options | reqd | read_only | allow_on_submit | ghi chú |
|---|---|---|---|---|:--:|:--:|:--:|---|
| `ma` | Mã gốc | 原编号 | Data | — | | ✓ | | mã gốc Excel; truy vết |
| `ngay` | Ngày | 日期 | Date | — | ✓ | | ✓ | nguồn suy `tuan` |
| `tuan` | Tuần | 周 | Data | — | | ✓ | ✓ | **computed** trong `validate` từ `ngay` (BR-F6), PERSIST vào cột |
| `du_an` | Dự án | 项目 | Link | LDR Project | ✓ | | | |
| `xuong` | Xưởng | 车间 | Link | LDR Workshop | | | ✓ | lưu đồng thời (BR-X3); cấm `is_group` |
| `chi_nhanh` | Chi nhánh | 分公司 | Link | LDR Branch | | ✓ | | fetch_from `du_an.branch` |
| `phuong_thuc` | Phương thức | 招聘方式 | Link | LDR Category Value | | | | nhóm `phuong_thuc` (Trực tiếp/Đối tác/Nội bộ) |
| `chuyen_vien` | Chuyên viên | 专员 | Link | LDR Staff | ✓ | | | |
| `dang_ky` | Đăng ký | 报名 | Int | — | ✓ | | ✓ | ≥ 0 |
| `phong_van` | Phỏng vấn | 面试 | Int | — | ✓ | | ✓ | ≤ dang_ky |
| `do_pv` | Đỗ PV (số người) | 通过面试人数 | Int | — | ✓ | | ✓ | ≤ phong_van; **số người** (xem ghi chú V2) |
| `di_lam` | Đi làm | 入职 | Int | — | ✓ | | ✓ | KHÔNG chặn trên bởi do_pv |
| `nhap_tre` | Nhập trễ | 迟报 | Check | — | | ✓ | | computed: tạo/sửa sau cửa sổ T+1 |

> **Ghi chú V2 (load-bearing):** `do_pv` ở Daily Report = số người đậu PV trong ngày. Khi roll-up, `SUM(do_pv)` được đặt vào field `do_pv_so_nguoi` của `LDR Weekly KPI` (đổi tên có chủ đích, BR-K4). Hai field thuộc HAI DocType khác nhau — không nhầm lẫn.
>
> **Hard validate:** `dang_ky ≥ phong_van ≥ do_pv ≥ 0` (BR-F1, throw). **Soft VR-W4:** `di_lam > do_pv` → msgprint.
>
> **Cửa sổ sửa T+1 (BR-F7):** cho phép user (if_owner) sửa khi `now() ≤ ngay 00:00 + 2 ngày` (tính theo `Asia/Ho_Chi_Minh`, tức hết 23:59 ngày kế tiếp). Quá hạn: set `nhap_tre=1`, chỉ Branch Manager/System Manager sửa. Vì các field tham gia tính có `allow_on_submit=1`, hook `on_update_after_submit` kích recompute hợp lệ.

### 4.9. LDR Weekly KPI — autoname `hash` + UNIQUE `(tuan,du_an,chuyen_vien)` · **DẪN XUẤT, toàn bộ read-only**

| fieldname | label VI | 中文 | fieldtype | options | reqd | read_only | ghi chú |
|---|---|---|---|---|:--:|:--:|---|
| `tuan` | Tuần | 周 | Data | — | ✓ | ✓ | khóa nhóm |
| `chi_nhanh` | Chi nhánh | 分公司 | Link | LDR Branch | | ✓ | fetch_from `du_an.branch` |
| `du_an` | Dự án | 项目 | Link | LDR Project | ✓ | ✓ | khóa; roll-up dự án cha |
| `quan_ly` | Quản lý | 主管 | Link | LDR Staff | | ✓ | fetch_from `du_an.quan_ly_phu_trach` |
| `chuyen_vien` | Chuyên viên | 专员 | Link | LDR Staff | ✓ | ✓ | khóa |
| `kpi_giao` | KPI giao | 下达KPI | Int | — | | ✓ | derived (Demand); =0 nếu không có |
| `nhu_cau_kh` | Nhu cầu KH | 客户需求 | Int | — | | ✓ | derived (Demand) — bổ sung A |
| `dang_ky` | Đăng ký | 报名 | Int | — | | ✓ | Σ Daily |
| `phong_van` | Phỏng vấn | 面试 | Int | — | | ✓ | Σ Daily |
| `do_pv_so_nguoi` | Đỗ PV (số người) | 通过面试人数 | Int | — | | ✓ | Σ Daily(`do_pv`) |
| `di_lam` | Đi làm | 入职 | Int | — | | ✓ | Σ Daily |
| `fill_rate` | Fill rate | 完成率 | Percent | — | | ✓ | BR-K1: di_lam/kpi_giao; KPI=0→None |
| `chuyen_doi` | Chuyển đổi | 转化率 | Percent | — | | ✓ | BR-K2: di_lam/dang_ky; ĐK=0→0 |
| `ti_le_dau_pv` | Tỷ lệ đậu PV | 面试通过率 | Percent | — | | ✓ | BR-K3: do_pv/phong_van; PV=0→0 |
| `dat_nhu_cau` | Đạt nhu cầu | 需求达成率 | Percent | — | | ✓ | BR-K9: di_lam/nhu_cau_kh; =0→None |
| `co_lech_chuyen_vien` | Lệch chuyên viên | 专员不匹配 | Check | — | | ✓ | BR-K8 |

> Naming `hash` + UNIQUE index `(tuan, du_an, chuyen_vien)`. KHÔNG `track_changes` (audit qua LDR KPI Recompute Log). `validate` chạy `guard_manual_edit` (BR-K10).

### 4.10. LDR Recruitment Policy — autoname `CS-.####`

| fieldname | label VI | 中文 | fieldtype | options | reqd | read_only | ghi chú |
|---|---|---|---|---|:--:|:--:|---|
| `ma` | Mã gốc | 原编号 | Data | — | | ✓ | truy vết Excel |
| `khach_hang` | Khách hàng | 客户 | Link | LDR Customer | ✓ | | |
| `xuong` | Xưởng | 车间 | Link | LDR Workshop | ✓ | | cấm `is_group` |
| `du_an` | Dự án | 项目 | Link | LDR Project | | ✓ | fetch_from `xuong.project` |
| `dang_tuyen` | Đang tuyển | 是否招聘 | Link | LDR Category Value | ✓ | | nhóm `dang_tuyen` (Có/Không) |
| `don_gia` | Đơn giá | 单价 | Currency | — | | | reqd nếu đang tuyển (soft VR-W5) |
| `don_vi` | Đơn vị | 单位 | Link | LDR Category Value | | | nhóm `don_vi_don_gia` (/giờ /người); reqd nếu có đơn giá |
| `yeu_cau` | Yêu cầu | 要求 | Small Text | — | | | |
| `luong_co_ban` | Lương cơ bản | 基本工资 | Currency | — | | | có null |
| `phu_cap` | Phụ cấp | 补贴 | Currency | — | | | có null |
| `co_ktx` | Có KTX | 有宿舍 | Link | LDR Category Value | | | nhóm `co_ktx` (Có/Không) |

> UNIQUE `(khach_hang, xuong)`. Validate: `xuong.customer==khach_hang` (throw nếu lệch). BR-P8: không trộn đơn giá /giờ với /người khi tổng hợp. **Hook đồng bộ Workshop:** `on_update` → set `recruiting`/`has_dormitory` về `LDR Workshop` (`xuong`) theo `dang_tuyen`/`co_ktx` (V15).

### 4.11. LDR Customer Care Task — autoname `CSK-.#####` · workflow `Customer Care Lifecycle`

| fieldname | label VI | 中文 | fieldtype | options | reqd | read_only | ghi chú |
|---|---|---|---|---|:--:|:--:|---|
| `ma` | Mã gốc | 原编号 | Data | — | | ✓ | truy vết Excel |
| `khach_hang` | Khách hàng | 客户 | Link | LDR Customer | ✓ | | |
| `chi_nhanh` | Chi nhánh | 分公司 | Link | LDR Branch | | ✓ | fetch_from `khach_hang.branch` (lưu cứng cho User Perm) |
| `quan_ly` | Quản lý | 负责经理 | Link | LDR Staff | ✓ | | gợi ý = KH.quan_ly_phu_trach |
| `phan_loai_hien_thi` | Phân loại (hiện tại) | 客户分类 | Data | — | | ✓ | **virtual/UI-derive** từ `khach_hang.phan_loai`, KHÔNG lưu cột — đảm bảo BR-M5 non-snapshot |
| `hoat_dong` | Hoạt động | 活动方式 | Link | LDR Category Value | ✓ | | nhóm `loai_hoat_dong`; default BR-C1/C2 |
| `tan_suat` | Tần suất | 频率 | Link | LDR Category Value | ✓ | | nhóm `tan_suat`; "Khi cần"→không sinh lịch |
| `ngay_kh` | Ngày kế hoạch | 计划日期 | Date | — | ✓ | | auto Quá hạn nếu < today |
| `noi_dung` | Nội dung | 内容 | Small Text | — | | | |
| `mocneo_cadence` | Mốc neo lịch | 节奏锚点 | Date | — | | ✓ | derived: anchor không drift |
| `workflow_state` | Trạng thái | 状态 | Link | Workflow State | | ✓ | engine tự set; SM-1 |
| `lich_su` | Nhật ký tương tác | 互动日志 | Table | LDR Customer Care Log | | | append-only (BR-C7) |

> **V10:** `phan_loai_hien_thi` là **Virtual field** (`fieldtype=Data`, `is_virtual=1`, đọc `khach_hang.phan_loai` lúc load) — KHÔNG `fetch_from` (fetch_from sẽ snapshot, vi phạm BR-M5). Để filter theo phân loại, dùng join sang Customer ở API/report, không lưu cột. `track_changes=1`.

**LDR Customer Care Log** (child, istable 1) — `thoi_diem` (Datetime, read_only), `noi_dung` (Small Text, reqd), `nguoi_thuc_hien` (Link Staff, read_only), `ket_qua` (Select tĩnh: `Đã liên hệ`⏎`Không liên lạc được`⏎`Đã hẹn lại`⏎`Khác`).

### 4.12. LDR Receivable — autoname `CN-.####` · workflow `Receivable Collection` · track_changes 1

| fieldname | label VI | 中文 | fieldtype | options | reqd | read_only | ghi chú |
|---|---|---|---|---|:--:|:--:|---|
| `ma` | Mã gốc | 原编号 | Data | — | | ✓ | truy vết Excel (CN001) |
| `chi_nhanh` | Chi nhánh | 分公司 | Link | LDR Branch | ✓ | | User Permission |
| `khach_hang` | Khách hàng | 客户 | Link | LDR Customer | ✓ | | tách từ cột gộp (BR-D9) |
| `du_an` | Dự án | 项目 | Link | LDR Project | | | nullable |
| `quan_ly_phu_trach` | Quản lý phụ trách | 负责经理 | Link | LDR Staff | ✓ | | scope OM/SPV |
| `ky_cong_no` | Kỳ công nợ | 账期 | Data | — | ✓ | | `T<MM>/<YYYY>` (BR-D7) |
| `so_tien` | Số tiền | 金额 | Currency | — | ✓ | | > 0 (BR-D3) |
| `ngay_den_han` | Ngày đến hạn | 到期日 | Date | — | ✓ | | |
| `da_thu` | Đã thu | 已收 | Currency | — | | | 0 ≤ da_thu ≤ so_tien |
| `con_lai` | Còn lại | 余额 | Currency | — | | ✓ | BR-D1: so_tien − da_thu |
| `so_ngay_qua_han` | Số ngày quá hạn | 逾期天数 | Int | — | | ✓ | BR-D2: max(0, today − ngay_den_han) |
| `giai_doan_aging` | Giai đoạn aging | 账龄阶段 | Link | LDR Category Value | | ✓ | nhóm `giai_doan_aging`; trục THỜI GIAN (BR-D6) |
| `trang_thai_thu` | Trạng thái thu | 收款状态 | Link | LDR Category Value | | ✓ | nhóm `trang_thai_thu`; trục TIỀN (BR-D6) |
| `giai_doan_truy_thu` | Giai đoạn truy thu | 催收阶段 | Link | LDR Category Value | | | nhóm `giai_doan_truy_thu`; nhãn hợp nhất BR-D6b; override BM |
| `giai_doan_override` | Override giai đoạn | 手动覆盖 | Check | — | | | =1 → job không ghi đè |
| `ty_le_thu_hoi` | Tỷ lệ thu hồi | 回收率 | Percent | — | | ✓ | BR-D8: da_thu/so_tien; =0→None |
| `workflow_state` | Trạng thái xử lý | 处理状态 | Link | Workflow State | | ✓ | engine tự set; trục thu + escalation |
| `ghi_chu` | Ghi chú | 备注 | Small Text | — | | | |
| `lich_su_thu` | Nhật ký thu hồi | 催收日志 | Table | LDR Receivable Collection Log | | | append-only |

> **Mô hình hai trục + ánh xạ aging (sửa A9):** `giai_doan_aging` và `giai_doan_truy_thu` cùng tham chiếu Category Value nhưng KHÁC nhóm. `map_aging(so_ngay)` trả enum thuộc **nhóm `giai_doan_aging`**. `giai_doan_truy_thu` (BR-D6b) chỉ nhận giá trị thuộc **nhóm `giai_doan_truy_thu`**; do hai nhóm có enum_code TRÙNG NHAU cho 6 mốc thời gian (`not_due, remind_1, remind_2, official_letter, negotiation, legal`) — xem seed 12.4 — nên hàm hợp nhất map đúng enum_code sang nhóm `giai_doan_truy_thu`, KHÔNG gán chéo Link sai nhóm.

**LDR Receivable Collection Log** (child) — `thoi_diem` (Datetime, read_only), `so_tien_thu` (Currency, read_only), `giai_doan` (Data snapshot), `nguoi_thuc_hien` (Link Staff), `noi_dung` (Small Text).

### 4.13. Labor CRM Settings (Single) + child

**LDR Aging Threshold** (child): `giai_doan_aging` (Link → Category Value, nhóm `giai_doan_aging`), `tu_ngay` (Int, inclusive), `den_ngay` (Int, trống=∞).
**LDR Care Frequency Setting** (child): `tan_suat` (Link → Category Value, nhóm `tan_suat`), `cadence_type` (Select tĩnh: `Hằng tuần`⏎`Mốc 1&15`⏎`Hằng tháng`⏎`Hằng quý`⏎`Không sinh`), `chu_ky_ngay` (Int, dùng cho weekly/monthly/quarterly).

> **Cadence "2 lần/tháng" (sửa C5/BR-C4):** `cadence_type=Mốc 1&15` mô hình hóa rõ **2 mốc lịch cố định ngày 1 và 15 hằng tháng** (anchor tuyệt đối, KHÔNG cộng "+15 ngày" để tránh drift). Sinh task kế: tìm mốc 1/15 kế tiếp sau `ngay_kh`.

---

## 5. Quy tắc nghiệp vụ & công thức (BR-xx) + cơ chế tự động

### 5.1. Công thức KPI (BR-K) — làm tròn half-up, lưu 4 chữ số decimal

```python
from decimal import Decimal, ROUND_HALF_UP
def pct2(x):
    return None if x is None else float(Decimal(str(x)).quantize(Decimal("0.0001"), ROUND_HALF_UP))

fill_rate    = pct2(di_lam/kpi_giao)            if kpi_giao   else None   # BR-K1
chuyen_doi   = pct2(di_lam/dang_ky)             if dang_ky    else 0      # BR-K2
ti_le_dau_pv = pct2(do_pv_so_nguoi/phong_van)   if phong_van  else 0      # BR-K3
dat_nhu_cau  = pct2(di_lam/nhu_cau_kh)          if nhu_cau_kh else None   # BR-K9 (A)
```

**Test Vectors KPI 7.11 (phải pass — khớp SRS):**

| # | KPI | ĐK | PV | Đỗ | ĐL | fill_rate | chuyen_doi | ti_le_dau_pv | co_lech_cv |
|---|---|---|---|---|---|---|---|---|---|
| T1 | 100 | 6 | 6 | 5 | 4 | 0.0400 | 0.6667 | 0.8333 | False |
| T2 | 100 | 11 | 6 | 6 | 10 | 0.1000 | 0.9091 | 1.0000 | False |
| T3 | 0 | 5 | 3 | 2 | 1 | **None** | 0.2000 | 0.6667 | True |
| T4 | 100 | 0 | 0 | 0 | 0 | 0.0000 | **0** | **0** | True |
| T5 | 50 | 80 | 70 | 65 | 60 | 1.2000 | 0.7500 | 0.9286 | False |

### 5.2. Roll-up KPI — FULL OUTER (Python merge) + upsert idempotent (naming hash)

```python
# services/kpi_rollup.py
def compute_full_outer(tuan):
    nc = { (r.du_an, r.chuyen_vien): r for r in frappe.db.sql("""
        SELECT du_an, chuyen_vien, SUM(kpi_giao) kpi_giao, SUM(nhu_cau_kh_tuan) nhu_cau_kh
        FROM `tabLDR Weekly Demand` WHERE tuan=%s AND docstatus<2
        GROUP BY du_an, chuyen_vien""", tuan, as_dict=True) }
    bc = { (r.du_an, r.chuyen_vien): r for r in frappe.db.sql("""
        SELECT du_an, chuyen_vien, SUM(dang_ky) dang_ky, SUM(phong_van) phong_van,
               SUM(do_pv) do_pv_so_nguoi, SUM(di_lam) di_lam
        FROM `tabLDR Daily Recruitment Report` WHERE tuan=%s AND docstatus<2
        GROUP BY du_an, chuyen_vien""", tuan, as_dict=True) }
    rows = []
    for key in set(nc) | set(bc):                 # FULL OUTER
        d, n = nc.get(key), bc.get(key)
        row = {"tuan": tuan, "du_an": key[0], "chuyen_vien": key[1],
               "kpi_giao": (d.kpi_giao if d else 0), "nhu_cau_kh": (d.nhu_cau_kh if d else 0),
               "dang_ky": (n.dang_ky if n else 0), "phong_van": (n.phong_van if n else 0),
               "do_pv_so_nguoi": (n.do_pv_so_nguoi if n else 0), "di_lam": (n.di_lam if n else 0),
               "co_lech_chuyen_vien": (d is None) or (n is None)}     # BR-K8
        row.update(derive_ratios(row)); rows.append(row)
    return rows
```

```python
# services/recompute.py — upsert idempotent theo UNIQUE (tuan,du_an,chuyen_vien); naming=hash
@frappe.whitelist()
def recompute_week(tuan):
    frappe.only_for(["System Manager", "Branch Manager"])
    with frappe.cache().lock(f"kpi:{tuan}", timeout=120):
        rows = compute_full_outer(tuan); seen = set()
        for r in rows:
            existing = frappe.db.get_value("LDR Weekly KPI",
                {"tuan": r["tuan"], "du_an": r["du_an"], "chuyen_vien": r["chuyen_vien"]}, "name")
            doc = (frappe.get_doc("LDR Weekly KPI", existing) if existing
                   else frappe.new_doc("LDR Weekly KPI"))
            doc.update(r); doc.flags.from_recompute = True       # set TRƯỚC insert/save (A13)
            doc.save(ignore_permissions=True); seen.add(doc.name)
        stale = set(frappe.get_all("LDR Weekly KPI", {"tuan": tuan}, pluck="name")) - seen
        for n in stale:
            frappe.delete_doc("LDR Weekly KPI", n, ignore_permissions=True, force=True)
        frappe.db.commit()
        _log_recompute(tuan, len(rows))    # ghi LDR KPI Recompute Log
```

> Idempotent vì tra cứu theo UNIQUE 3-field (không theo `name` format). Naming `hash` né xung đột autoname khi save. `flags.from_recompute` set trước `save()` để `guard_manual_edit` (chạy trong `validate` lúc insert) không chặn.

### 5.3. Công nợ aging — 2 trục độc lập (BR-D)

```python
def derive(self):
    self.con_lai = self.so_tien - self.da_thu                                   # BR-D1
    self.so_ngay_qua_han = max(0, (getdate() - getdate(self.ngay_den_han)).days) # BR-D2
    self.trang_thai_thu = ("paid"    if self.con_lai==0 else
                           "unpaid"  if self.da_thu==0  else "partial")          # trục TIỀN (enum_code)
    self.giai_doan_aging = map_aging(self.so_ngay_qua_han)                       # trục THỜI GIAN
    self.ty_le_thu_hoi = (self.da_thu/self.so_tien) if self.so_tien else None    # BR-D8
    if not self.giai_doan_override:                                              # BR-D6b nhãn hợp nhất
        if self.trang_thai_thu == "paid":
            self.giai_doan_truy_thu = "fully_collected"
        elif self.trang_thai_thu == "partial":
            self.giai_doan_truy_thu = "partial_collected"
        else:
            self.giai_doan_truy_thu = self.giai_doan_aging   # cùng enum_code ↔ nhóm truy_thu (12.4)
```

```python
# services/aging.py — ngưỡng đọc từ Labor CRM Settings (LDR Aging Threshold)
def map_aging(so_ngay):
    for row in frappe.get_single("Labor CRM Settings").aging_thresholds:
        if so_ngay >= row.tu_ngay and (not row.den_ngay or so_ngay <= row.den_ngay):
            return row.giai_doan_aging          # enum_code thuộc nhóm giai_doan_aging
    return "not_due"
```

**Ngưỡng aging mặc định (seed `seed_aging_thresholds`, khớp SRS 5.3):**

| giai_doan_aging | tu_ngay | den_ngay |
|---|---|---|
| not_due (Chưa đến hạn) | 0 | 0 |
| remind_1 (Nhắc lần 1) | 1 | 7 |
| remind_2 (Nhắc lần 2) | 8 | 15 |
| official_letter (Gửi công văn) | 16 | 30 |
| negotiation (Đàm phán) | 31 | 60 |
| legal (Chuyển pháp lý) | 61 | (∞) |

**Test Vectors Công nợ D1–D4 (phải pass — as_of = 2026-06-28, tiêu chí US-04, sửa C3):**

| # | so_tien | da_thu | ngay_den_han | con_lai | so_ngay_qua_han | giai_doan_aging | trang_thai_thu | giai_doan_truy_thu | ty_le_thu_hoi |
|---|---|---|---|---|---|---|---|---|---|
| D1 | 100,000,000 | 0 | 2026-07-10 | 100,000,000 | 0 | not_due | unpaid | not_due | None |
| D2 | 50,000,000 | 20,000,000 | 2026-06-20 | 30,000,000 | 8 | remind_2 | partial | partial_collected | 0.4000 |
| D3 | 80,000,000 | 0 | 2026-05-01 | 80,000,000 | 58 | negotiation | unpaid | negotiation | None |
| D4 | 30,000,000 | 30,000,000 | 2026-04-01 | 0 | 88 | legal | paid | fully_collected | 1.0000 |

> D2: 8 ngày → remble_2 (khoảng 8–15) ✓. D3: 58 → negotiation (31–60) ✓. D4: 88 → legal về aging, nhưng `trang_thai_thu=paid` ⇒ `giai_doan_truy_thu=fully_collected` (trục tiền thắng khi đã thu đủ) ✓.

### 5.4. hooks.py — doc_events + scheduler_events + permission_query_conditions

```python
# hooks.py
doc_events = {
  "LDR Daily Recruitment Report": {"validate":"labor_crm.recruitment.daily.validate",  # set tuan ISO (persist)
      "on_submit":"labor_crm.services.recompute.recompute_for_report",
      "on_cancel":"labor_crm.services.recompute.recompute_for_report",
      "on_update_after_submit":"labor_crm.services.recompute.recompute_for_report",
      "on_trash":"labor_crm.services.recompute.recompute_for_report"},
  "LDR Weekly Demand": {"validate":"labor_crm.recruitment.demand.validate",
      "on_update":"labor_crm.services.recompute.recompute_for_demand",
      "on_trash":"labor_crm.services.recompute.recompute_for_demand"},
  "LDR Weekly KPI": {"validate":"labor_crm.recruitment.weekly_kpi.guard_manual_edit"},     # BR-K10
  "LDR Recruitment Policy": {"validate":"labor_crm.recruitment.policy.validate",
      "on_update":"labor_crm.recruitment.policy.sync_workshop_flags"},                      # V15
  "LDR Receivable": {"validate":"labor_crm.finance.receivable.validate"},                   # derive 2 trục
  "LDR Customer Care Task": {"validate":"labor_crm.crm.care.derive_defaults",
      "on_update":"labor_crm.crm.care.on_done_generate_next"},
  "LDR Customer": {"on_update":"labor_crm.crm.care.resync_pending_tasks"},                  # BR-M5
}
scheduler_events = {
  "cron": {"0 2 * * *": ["labor_crm.services.recompute.nightly_recompute_recent_weeks",     # self-heal T+1
                         "labor_crm.finance.receivable.nightly_reage"]},                     # auto aging
  "daily":  ["labor_crm.crm.care.mark_overdue"],                                            # BR-C8
  "weekly": ["labor_crm.services.recompute.lock_previous_week"],                            # chốt tuần
}
permission_query_conditions = {
  "LDR Receivable": "labor_crm.permissions.conditions.receivable_query",
  "LDR Daily Recruitment Report": "labor_crm.permissions.conditions.daily_report_query",
  "LDR Weekly Demand": "labor_crm.permissions.conditions.branch_scoped_query",
  "LDR Customer Care Task": "labor_crm.permissions.conditions.care_query",
}
has_permission = {
  "LDR Receivable": "labor_crm.permissions.conditions.receivable_has_permission",
}
```

> **Chính sách (sửa A10):** khối `permission_query_conditions` + `has_permission` BẮT BUỘC có trong hooks.py, nếu thiếu toàn bộ row-level filter nâng cao mục 7.3 sẽ không chạy. Handler luôn dùng **full dotted-path** (không rút gọn `...`). Logic lõi (BR-F/K/R/C/D) đặt trong Python controller + `services/` (versioned, unit-test). Cấu hình runtime (ngưỡng aging, cadence) ở Single `Labor CRM Settings`, không hard-code.

---

## 6. Frappe Workflow (state machine)

> **Nguyên tắc (sửa V5/V6):** API thay đổi trạng thái (`complete_care_task`, `propose_legal`, escalation) PHẢI là wrapper mỏng gọi `frappe.model.workflow.apply_workflow(doc, action)` — đi qua engine để giữ role-gating + condition. KHÔNG tự `db_set("workflow_state", ...)`. State phải khớp ĐÚNG tên `Workflow State` đã seed qua fixtures.

### 6.1. Receivable Collection (`document_type=LDR Receivable`, field `workflow_state`)

> Tách 2 trục (SM-2): **aging** tính bằng scheduler (KHÔNG qua workflow); **thu tiền + escalation pháp lý** đi qua Workflow.

**States:** Receivable Open (跟进中) · Receivable Partially Collected (已部分收款) · Receivable Legal Pending (待审法务) · Receivable Legal (已转法务) · Receivable Settled (已全额收款). Tất cả `doc_status=0`.

**Transitions chính:**

| Từ | Action | Đến | Allowed | Condition |
|---|---|---|---|---|
| Open | Ghi nhận thu một phần | Partially Collected | Operations Manager | `da_thu>0 and con_lai>0` |
| Open / Partially | Thu đủ | Settled | Operations Manager | `con_lai==0` |
| Open / Partially | Đề xuất chuyển pháp lý | Legal Pending | Operations Manager | `so_ngay_qua_han>60 and con_lai>0` |
| Legal Pending | Duyệt chuyển pháp lý | Legal | Branch Manager | `con_lai>0` |
| Legal Pending | Từ chối | Open | Branch Manager | — |
| Legal | Thu đủ | Settled | Branch Manager | `con_lai==0` |

> API `record_collection` chỉ cập nhật `da_thu` + append `LDR Receivable Collection Log`, KHÔNG tự đổi state; nếu `con_lai==0` thì gọi `apply_workflow(doc, "Thu đủ")`, nếu `da_thu>0 & con_lai>0` gọi `apply_workflow(doc, "Ghi nhận thu một phần")`. `propose_legal` = `apply_workflow(doc, "Đề xuất chuyển pháp lý")`.

### 6.2. Customer Care Lifecycle (`document_type=LDR Customer Care Task`)

**States (SM-1):** Care Pending (未完成) · Care In Progress (进行中) · Care Done (已完成) · Care Overdue (已逾期).

**Transitions:** Pending→In Progress (Bắt đầu liên hệ); Pending/In Progress→Done (Hoàn thành, condition `has_log()`); Overdue→In Progress/Done (chăm sóc bù). **Auto-transition** Pending/In Progress→Overdue do scheduler `mark_overdue` (đi qua `apply_workflow` với action hệ thống hoặc set state có kiểm soát). Cấm: Done→Pending, Overdue→Pending.

> API `complete_care_task(name, noi_dung, ket_qua)` = wrapper: (1) `apply_workflow(doc, "Hoàn thành")` → engine kiểm role + `has_log`; (2) hook `on_update` append `LDR Customer Care Log` + sinh task kế theo cadence cố định (mục 4.13). Trả `{next_task}`.
>
> *(Lưu ý: nhóm Category Value `trang_thai_cham_soc` KHÔNG seed — trạng thái care quản lý hoàn toàn bằng Workflow State, tránh "hai sự thật"; xem 12.4.)*

---

## 7. RBAC — phân quyền 3 tầng

```
Tầng 1: DocPerm (Role)           → làm được gì (R/W/C/D/Submit/Approve)
Tầng 2: User Permission (Branch) → thấy bản ghi chi nhánh nào (row-level)
Tầng 3: Permission Query Cond + if_owner → thu hẹp theo người phụ trách / chủ bản ghi
```

### 7.1. Role

| Role | Mã | Label VI | 中文 | desk_access |
|---|---|---|---|---|
| System Manager | ADMIN | Quản trị hệ thống | 系统管理员 | 1 |
| BOD | BOD | Ban lãnh đạo | 董事会 | 0 |
| Branch Manager | BM | Quản lý chi nhánh | 分公司经理 | 0 |
| Operations Manager | OM | Quản lý vận hành | 运营主管 | 0 |
| Operations Specialist | SPV | Chuyên viên vận hành | 运营专员 | 0 |

### 7.2. Ma trận permission (R/W/C/D/S=Submit/A=Approve)

| DocType | System Mgr | BOD | Branch Mgr | Ops Mgr | Ops Specialist |
|---|---|---|---|---|---|
| LDR Customer | RWCD | R | RWC+A | RWC | R |
| LDR Project | RWCD | R | RWCD+A | RW | R |
| LDR Weekly Demand | RWCD | R | RWC | RWC | R |
| LDR Daily Recruitment Report | RWCD+S | R | RWC+S | RWC+S | R/C, W if_owner (T+1) |
| LDR Weekly KPI | RWCD (recompute) | R | R | R | R |
| LDR Recruitment Policy | RWCD | R | RWC+A (đơn giá) | RWC | R |
| LDR Receivable | RWCD | R | RWC+A (ghi thu) | RWC | — |
| LDR Customer Care Task | RWCD | R | RWC | RWC | — |
| LDR Workshop / Branch / Category Value | RWCD | R | R | R | R |

> CongNo & ChamSoc ẩn với SPV. Override `giai_doan_truy_thu` chỉ Branch Manager + System Manager.
>
> **Approval (SRS 9.5, sửa F1):** các luồng cần duyệt — đổi/đặt đơn giá `LDR Recruitment Policy`, ghi nhận "Đã thu" `LDR Receivable`, tạo/tạm dừng `LDR Project` & tạo `LDR Customer` — hiện thực qua **Workflow action có `allowed=Branch Manager`** (Receivable đã có ở 6.1; Policy đơn giá + Project lifecycle bổ sung Workflow `Pricing Approval`/`Project Lifecycle` ở Phase 1.5 nếu cần phê duyệt cứng, hoặc cờ `cho_duyet` + doc_event chặn submit khi chưa duyệt). Cột A trong ma trận đánh dấu nơi cần duyệt.
>
> **ABAC nhân sự Thử việc (SRS 2.2, sửa F2):** `LDR Staff.trang_thai=thu_viec` → mất quyền Delete + thao tác tài chính/khách hàng phải qua duyệt. Hiện thực bằng `has_permission` kiểm `trang_thai` của Staff gắn với user (Phase 1: chặn Delete + Submit Receivable; phân quyền tài chính khác để Phase sau, ghi rõ trong backlog).

### 7.3. User Permission Branch + Permission Query Conditions

- **BM/OM/SPV:** 1 User Permission Branch → lọc mọi DocType có field `chi_nhanh`/`branch`. DocType không có branch trực tiếp (Care/Policy) thêm `chi_nhanh` dạng fetch_from + lưu cứng.
- **BOD / System Manager:** KHÔNG tạo User Permission → thấy mọi chi nhánh.

```python
# permissions/conditions.py — SO KHỚP BẰNG ID, mặc định deny
def receivable_query(user):
    if {"System Manager","BOD","Branch Manager"} & set(frappe.get_roles(user)): return ""
    emp = frappe.db.get_value("LDR Staff", {"user": user}, "name")
    return f"`tabLDR Receivable`.quan_ly_phu_trach = {frappe.db.escape(emp)}" if emp else "1=0"

def daily_report_query(user):
    if {"System Manager","BOD","Branch Manager"} & set(frappe.get_roles(user)): return ""
    emp = frappe.db.get_value("LDR Staff", {"user": user}, "name")
    if not emp: return "1=0"
    if "Operations Manager" in frappe.get_roles(user):
        e = frappe.db.escape(emp)
        return (f"(`tabLDR Daily Recruitment Report`.du_an in "
                f"(select name from `tabLDR Project` where quan_ly_phu_trach={e}) "
                f"or `tabLDR Daily Recruitment Report`.chuyen_vien in "
                f"(select name from `tabLDR Staff` where quan_ly_truc_tiep={e}))")
    return f"`tabLDR Daily Recruitment Report`.chuyen_vien = {frappe.db.escape(emp)}"
```

---

## 8. API whitelisted cho SPA

> **Phân định (sửa V4):** `dashboard.summary` = tổng hợp NHIỀU khối cho 1 màn dashboard (KPI + funnel + aging + data-quality). `dashboard.get_kpi_summary` = CHỈ khối KPI roll-up cho 1 tuần. Không viết trùng logic — `summary` gọi lại các hàm con (`get_kpi_summary`, `get_ar_aging_buckets`…).

| Endpoint | Tham số | Trả về |
|---|---|---|
| `labor_crm.api.dashboard.bootstrap` | — | `{user, roles, employee, default_branch, allowed_branches}` |
| `labor_crm.api.dashboard.summary` | `branch?`, `week` | `{kpi, funnel, by_project, aging, data_quality}` (gọi các hàm con) |
| `labor_crm.api.dashboard.get_kpi_summary` | `tuan`, `chi_nhanh?`, `du_an?` | roll-up tính lại từ Σ tử/Σ mẫu |
| `labor_crm.api.dashboard.get_funnel` | `tuan`, `du_an?`, `phuong_thuc?` | `[{stage, value}]` |
| `labor_crm.api.dashboard.get_ar_aging_buckets` | `chi_nhanh?`, `as_of?` | `[{giai_doan_aging, so_khoan, tong_con_lai}]` |
| `labor_crm.api.dashboard.get_data_quality` | `chi_nhanh?` | `{kh_thieu_ql, alias_queue, tuan_kpi0, du_an_khong_baocao}` (4 widget D) |
| `labor_crm.api.kpi.recompute_week` | `tuan` | `{status, so_dong}` (ADMIN/BM) |
| `labor_crm.api.kpi.get_weak_specialists` | `tuan`, `metric`, `threshold` | `[{chuyen_vien, du_an, value}]` |
| `labor_crm.api.kpi.get_kpi_mismatch` | `tuan` | danh sách `co_lech_chuyen_vien=1` (VR-W7) |
| `labor_crm.api.care.get_due_care_tasks` | `quan_ly?`, `status?` | việc tới hạn/quá hạn |
| `labor_crm.api.care.complete_care_task` | `name`, `noi_dung`, `ket_qua` | `{next_task}` (wrapper `apply_workflow`) |
| `labor_crm.api.receivable.record_collection` | `name`, `so_tien_thu`, `noi_dung` | `{con_lai, giai_doan_truy_thu}` (+auto apply_workflow) |
| `labor_crm.api.receivable.propose_legal` / `override_stage` | `name`[, `giai_doan`] | `{workflow_state}` (apply_workflow) / `{ok}` |
| `labor_crm.api.lookup.get_category_values` | `category_group`, `lang?` | `[{enum_code, label}]` (nguồn i18n enum) |
| `labor_crm.api.lookup.search_workshop` | `txt`, `project?`, `customer?` | autocomplete (resolve alias, loại `is_group`/`Merged`) |
| `labor_crm.api.normalization.get_review_queue` / `resolve_queue_item` | `status?` / `name`,`action` | hàng đợi alias (US-08) |

```python
@frappe.whitelist()
def get_kpi_summary(tuan, chi_nhanh=None, du_an=None):
    cond = {"tuan": tuan}
    if chi_nhanh: cond["chi_nhanh"] = chi_nhanh
    if du_an: cond["du_an"] = du_an
    r = (frappe.get_list("LDR Weekly KPI", filters=cond,    # get_list = áp RBAC tự động
        fields=["sum(kpi_giao) kpi_giao","sum(nhu_cau_kh) nhu_cau_kh","sum(di_lam) di_lam",
                "sum(dang_ky) dang_ky"]) or [{}])[0]
    kpi, nhu, dl, dk = (r.get(k) or 0 for k in ("kpi_giao","nhu_cau_kh","di_lam","dang_ky"))
    return {**r, "fill_rate": round(dl/kpi,4) if kpi else None,    # tính lại từ tổng (tránh Simpson)
            "dat_nhu_cau": round(dl/nhu,4) if nhu else None,
            "chuyen_doi": round(dl/dk,4) if dk else 0}
```

---

## 9. Kiến trúc Frontend Vue 3 SPA

### 9.1. Cấu trúc & khởi tạo

```
frontend/src/
├─ main.js           # createApp + Pinia + Router + FrappeUI + i18n
├─ router/index.js   # route mỗi module + detail (:id="new") + guard theo Role
├─ stores/           # session, category (DanhMuc song ngữ), filters (branch+week dùng chung)
├─ i18n/             # vi.json, zh.json (chuỗi UI tĩnh)
├─ composables/      # useRealtime (socket list_update), useEnumLabel, useWeek
├─ components/       # AppShell, BottomNav, BranchFilter, WeekFilter, StatusBadge,
│                    # MetricCard, FunnelChart, KpiBars, AgingChart, DataQualityCards
└─ pages/            # Dashboard + {staff,customer,project,workshop,policy,demand,
                     #   daily,kpi,care,receivable,normalization}/{List,Detail}.vue
```

```js
// main.js
import { FrappeUI, setConfig, frappeRequest, resourcesPlugin } from 'frappe-ui'
setConfig('resourceFetcher', frappeRequest)   // /api/method + CSRF
const app = createApp(App)
app.use(createPinia()); app.use(router); app.use(i18n); app.use(resourcesPlugin); app.use(FrappeUI)
app.mount('#app')
```

> **Phạm vi admin trong SPA (sửa E):** quản trị **Branch** và **Category Value** thực hiện qua **Frappe Desk** (quyết định cố ý — ít dùng, cần bảng chi tiết). SPA CÓ trang `normalization/` (hàng đợi chuẩn hóa tên — US-08, dùng thường xuyên bởi OM/BM). Các page nghiệp vụ chính: staff, customer, project, workshop, policy, demand, daily, kpi, care, receivable, normalization (11) + Dashboard.

### 9.2. Router guard theo Role

```js
const router = createRouter({ history: createWebHistory('/labor'), routes })
router.beforeEach(async (to) => {
  if (to.meta.public) return true
  const s = useSession(); if (!s.ready) await s.load()
  if (!s.user) return { name: 'login' }
  if (to.meta.roles && !to.meta.roles.some(r => s.roles.includes(r))) return { name: 'dashboard' }
  return true
})
// care & receivable: meta.roles = ['Branch Manager','Operations Manager','BOD','System Manager']
```

### 9.3. i18n 2 lớp + realtime

- **Chuỗi UI tĩnh** → vue-i18n (vi/zh, `localStorage.lang`). **Nhãn enum động** → store `category` đọc `get_category_values` (`gia_tri`/`ten_trung`), KHÔNG hardcode trong options. *(Đây là lý do mọi enum nghiệp vụ là Link → LDR Category Value, không Select — xem mục 4.)*
- **Realtime** (`useRealtime`): KPI list + Receivable list subscribe `list_update` → auto reload sau recompute đêm / re-age (vì là DocType dẫn xuất, người dùng không sửa trực tiếp).

### 9.4. Dashboard theo vai trò

| Vai trò | Nội dung |
|---|---|
| **SPV** | Phễu tuần của mình (FunnelChart) + fill_rate/đạt nhu cầu (KpiBars) + nút "Báo cáo hôm nay" |
| **OM** | KPI roll-up dự án phụ trách + công nợ còn lại + việc chăm sóc quá hạn + cảnh báo lệch CV |
| **BM** | Toàn chi nhánh: fill_rate trung bình (Σ) + AgingChart + top dự án lệch CV + **DataQualityCards** |
| **BOD** | Đa chi nhánh (BranchFilter mở), read-only, so sánh fill_rate + công nợ + tỷ lệ thu hồi |

> **DataQualityCards (Dashboard D, sửa E):** 4 widget chất lượng dữ liệu (BM/ADMIN) — KH thiếu QL phụ trách; hàng đợi alias mismatch; tuần có KPI giao=0 nhưng có nhu cầu; dự án đang vận hành không có báo cáo tuần. Nguồn: `dashboard.get_data_quality`.

### 9.5. Ví dụ — Weekly KPI List (read-only, badge lệch CV)

```vue
<script setup>
import { createListResource, Badge, LoadingIndicator } from 'frappe-ui'
import { useFilters } from '@/stores/filters'; import { useRealtime } from '@/composables/useRealtime'
const filters = useFilters()
const kpi = createListResource({ doctype: 'LDR Weekly KPI',
  fields: ['name','du_an','chuyen_vien','fill_rate','dat_nhu_cau','chuyen_doi','ti_le_dau_pv','co_lech_chuyen_vien'],
  filters: filters.asFilters({ weekField: 'tuan' }), pageLength: 50, auto: true })
const fmtPct = (v) => v == null ? '—' : (v * 100).toFixed(2) + '%'    // fill_rate=null → "—"; >100% giữ nguyên
function reload() { kpi.update({ filters: filters.asFilters({ weekField:'tuan' }) }); kpi.reload() }
useRealtime(['LDR Weekly KPI'], reload)
</script>
```

> **Nguyên tắc:** derived hiển thị read-only; client chỉ preview tạm khi nhập (con_lai/aging/fill_rate server tính). Scope là việc của backend (API có Permission Query Conditions); frontend không tự lọc theo người phụ trách.

---

## 10. Luồng vận hành đầu–cuối

8 luồng end-to-end, mỗi luồng: Actor → Tiền điều kiện → Bước (UI ⟶ hệ thống ⟶ Workflow) → Hậu điều kiện → Ngoại lệ.

1. **Khai báo Nhu cầu tuần & KPI giao** (OM/BM): tạo `LDR Weekly Demand` (tuan ISO, du_an, chuyen_vien, nhu_cau, kpi_giao) → validate (ép du_an từ xuong; VR-W3/W6 mềm) → on_update kích `recompute_for_demand`. *Mỗi tuần độc lập, không cộng dồn (BR-R7).*
2. **Nhập Báo cáo ngày → roll-up KPI** (SPV + hệ thống): tạo `LDR Daily Recruitment Report` (tuan computed+persist từ ngay trong validate; hard funnel `dang_ky≥phong_van≥do_pv`) → submit → FULL OUTER JOIN (Python merge) → upsert `LDR Weekly KPI` idempotent → realtime refresh. *Self-heal cron 02:00 + nút "Tính lại tuần" cùng code path; cửa sổ sửa T+1 + cờ `nhap_tre`.*
3. **Theo dõi & phân tích KPI** (OM/BM): list KPI, sort fill_rate tăng dần, drill-down phễu rụng theo `LDR Daily Recruitment Report`; roll-up dự án/chi nhánh **tính lại từ Σ tử/Σ mẫu** (tránh Simpson); xử lý dòng lệch CV (`get_kpi_mismatch`).
4. **Quản trị Xưởng & chuẩn hóa Alias** (ADMIN/BM/OM): tạo `LDR Workshop` (cây Foxconn), Alias; pipeline `resolve_workshop` (Workshop Alias TRƯỚC → Project Alias → canonical → fuzzy) → ≥90 auto-alias Pending, 70–90 đẩy Queue, <70 tạo mới; gộp xưởng (Merged + merged_into auto-redirect). UI qua trang `normalization/`.
5. **Sinh & thực hiện lịch chăm sóc** (OM): default theo phân loại (Trọng điểm→Gặp mặt/1 lần tuần; Thường→Điện thoại/1 lần tháng); cadence cố định không drift (Mốc 1&15 cho "2 lần/tháng"); auto Quá hạn (scheduler); hoàn thành → `apply_workflow` + append log + sinh lượt kế. Khách đổi phân loại → resync task Pending (BR-M5).
6. **Truy thu công nợ bậc thang** (OM/BM): nhập `da_thu` (`record_collection`); 2 trục độc lập (aging scheduler || thu tiền workflow); nhãn hợp nhất BR-D6b + override BM; chuyển pháp lý cần duyệt khi `so_ngay_qua_han>60 & con_lai>0`.
7. **Quản trị chính sách giá** (BM/OM/SPV): `LDR Recruitment Policy` UNIQUE (khách×xưởng); đơn giá bắt buộc đơn vị; đổi đơn giá cần BM duyệt; SPV tra cứu chính sách `dang_tuyen=Có`; BR-P8 cấm trộn /giờ với /người; on_update đồng bộ cờ Workshop.
8. **Phân quyền & scoping** (ADMIN + mọi user): gán Role + User Permission Branch; SPV thấy báo cáo của mình, OM thấy CV dưới quyền, BM toàn chi nhánh, BOD đa chi nhánh read-only; so khớp bằng ID; mặc định deny; ABAC Thử việc chặn Delete.

---

## 11. i18n · NFR · Hiệu năng/Index · Audit · Backup

### 11.1. i18n song ngữ Việt–Trung (2 lớp)

| Lớp | Dịch gì | Cơ chế |
|---|---|---|
| Nhãn UI tĩnh (label DocType/field, nút) | giao diện | `_()` + `translations/{vi,zh}.csv` + DocType Translation |
| Giá trị dữ liệu song ngữ (tên KH/xưởng, enum) | dữ liệu | cột `*_zh` (master) + `LDR Category Value` (`gia_tri`/`ten_trung`) |

Source key bất biến (English Title Case) → đổi nhãn không vỡ code. SPA: chuỗi tĩnh qua vue-i18n; enum gọi `get_category_values` hiển thị theo locale. **Mọi enum nghiệp vụ là Link → LDR Category Value** (không Select) để cơ chế này hoạt động.

### 11.2. NFR

- **Mobile-first** (Mini App): list dạng card, form 1 cột/grid 2 cột số liệu, không bảng rộng.
- **Mọi field dẫn xuất Read Only**, tính ở controller/scheduler.
- **Idempotent**: recompute chạy nhiều lần cho cùng kết quả (naming hash + upsert theo UNIQUE 3-field + dọn stale + cache lock).
- **Mặc định deny**: query condition trả `1=0` nếu user không map được Staff.
- **Site timezone** `Asia/Ho_Chi_Minh` (cron 02:00 + `so_ngay_qua_han` + cửa sổ T+1 đúng giờ VN).

### 11.3. Hiệu năng & Index

| DocType | Index | Lý do |
|---|---|---|
| LDR Daily Recruitment Report | composite `(tuan, du_an, chuyen_vien)`; `(ngay)`; `(chuyen_vien)` | roll-up + scoping |
| LDR Weekly Demand | composite UNIQUE `(tuan, du_an, chuyen_vien)` | nguồn KPI + chống trùng |
| LDR Weekly KPI | UNIQUE `(tuan, du_an, chuyen_vien)`; `(chi_nhanh)`; `(du_an)` | upsert idempotent + dashboard |
| LDR Receivable | `(chi_nhanh)`, `(quan_ly_phu_trach)`, `(con_lai)`, `(ngay_den_han)` | scoping + nightly_reage |
| LDR Customer Care Task | `(ngay_kh, workflow_state)`, `(quan_ly)` | mark_overdue |
| LDR Workshop | `(project)`, `(status)`, UNIQUE `(project, workshop_code)` | roll-up + chống trùng |
| LDR Workshop Alias | UNIQUE `(alias_normalized)` | resolve nhanh + chống trùng |

Roll-up incremental (chỉ khóa bị ảnh hưởng) + nightly self-heal cửa sổ T+1; merge Python (~1k dòng/tuần nằm trong RAM). Quy mô nhỏ (BaoCaoNgay ~1048, master ≤40) → 1 site, không cần sharding.

### 11.4. Audit

`track_changes=1` cho **LDR Receivable, Customer Care Task, Weekly Demand, Workshop, Category Value, Customer, Project**, và bổ sung **LDR Workshop Alias, LDR Project Alias, Labor CRM Settings** (đổi danh mục/alias/config — yêu cầu audit SRS I10). KPI dẫn xuất dùng **LDR KPI Recompute Log** (ai/khi/tuần/số dòng) thay Version. Workflow transitions (`Workflow Action` log) + override `giai_doan_truy_thu` ghi log riêng.

### 11.5. Backup

`bench backup --with-files` hằng ngày (`backup_limit=7`) + off-site (rclone S3/Drive) + backup riêng `encryption_key`. HTTPS (Let's Encrypt), rate-limit `/api/method/login`, `desk_access=0` cho role nghiệp vụ.

---

## 12. Migration & chuẩn hóa dữ liệu + seed DanhMuc

### 12.1. patches.txt (post_model_sync, idempotent)

```
labor_crm.patches.v1_0.seed_category_values      # nền enum song ngữ (trước tiên)
labor_crm.patches.v1_0.seed_branches             # 7 chi nhánh
labor_crm.patches.v1_0.seed_aging_thresholds     # 6 ngưỡng (5.3)
labor_crm.patches.v1_0.seed_care_frequencies     # gồm Mốc 1&15
labor_crm.patches.v1_0.seed_roles_and_workflow
labor_crm.patches.v1_0.import_master_from_excel
labor_crm.patches.v1_0.seed_aliases              # HIP→HI-P, Canfoco CN→Canfoco, LuxshareBacGiang→Luxshare Bắc Giang
labor_crm.patches.v1_0.build_workshops           # cây Foxconn (Fuyu/Fulian/Fukang/Fuhong/Fushan/Funing)
labor_crm.patches.v1_0.split_receivable_columns  # ETL tách cột gộp KH/Dự án (BR-D9)
labor_crm.patches.v1_0.backfill_transaction_keys # resolve_workshop cho mọi giao dịch
labor_crm.patches.v1_0.recompute_all_weeks
labor_crm.patches.v1_0.reconcile_migration       # đối soát Σ di_lam + Σ tiền CongNo trước/sau
```

### 12.2. Pipeline chuẩn hóa (dùng chung import + validate)

```python
HARD_RULES = {"HIP":"HI-P", "CANFOCO CN":"CANFOCO", "LUXSHAREBACGIANG":"LUXSHARE BAC GIANG"}
def normalize(raw):
    s = re.sub(r"\s+", " ", unidecode((raw or "").strip()).upper())
    return HARD_RULES.get(s, s)
def resolve_workshop(raw, project_hint=None):
    # Thứ tự (BR-R4b): Workshop Alias TRƯỚC → Project Alias → canonical name → fuzzy:
    #   exact Workshop Alias → normalized Workshop Alias → Project Alias →
    #   canonical workshop_name → fuzzy (rapidfuzz):
    #     ≥90 → trả + tạo Alias (Auto-fuzzy, Pending); 70–90 → Queue (suggested); <70 → Queue (tạo mới)
    ...
```

### 12.3. ETL tách cột gộp Công nợ (BR-D9, sửa F4)

```python
# split_receivable_columns: cột gộp "KhachHang/DuAn" trong CongNo cũ
#   1) khớp KhachHang.ten → khach_hang_id
#   2) không khớp KH nhưng khớp DuAn.ten → suy khach_hang_id = DuAn.customer
#   3) không khớp → quarantine vào Name Normalization Queue (giữ legacy_text), KHÔNG tạo bừa
```

### 12.4. Đối soát (reconcile_migration)

- Số dòng giao dịch `workshop`/`du_an` NULL = 0 (nếu >0 → đẩy Queue, giữ `legacy_*_text`).
- Σ `di_lam` trước/sau migrate bằng nhau (không mất dữ liệu).
- **Σ `so_tien` Công nợ trước/sau bằng nhau** (sửa F6).
- Số Workshop trùng tên trong cùng project = 0.
- Chỉ ẩn field text cũ sau khi đối soát đạt (giữ read-only để audit).

### 12.5. Seed DanhMuc (LDR Category Value, idempotent)

Nhóm + (enum_code, VI, 中文):

- `vai_tro`: branch_manager/Quản lý chi nhánh/分公司经理, ops_manager/Quản lý vận hành/运营主管, ops_specialist/Chuyên viên vận hành/运营专员.
- `trang_thai_nv`: chinh_thuc/Chính thức/正式, thu_viec/Thử việc/试用.
- `phan_loai_kh`: thuong/Thường/普通, trong_diem/Trọng điểm/重点.
- `trang_thai_da`: dang_van_hanh/Đang vận hành/运营中, tam_dung/Tạm dừng/暂停.
- `dich_vu`: gioi_thieu/Giới thiệu/代理招聘, cho_thue_lai/Cho thuê lại (ngắn hạn)/岗位外包（短期）, eor/EOR – nhân sự/人事代理. *(中文 theo bản dịch chuẩn SRS — sửa B4.)*
- `phuong_thuc`: truc_tiep/Trực tiếp/直接招聘, doi_tac/Đối tác/市场合作, noi_bo/Nội bộ/内部推荐.
- `dang_tuyen`: co/Có nhu cầu/有需求, khong/Dừng tuyển/停招.
- `co_ktx`: co/Có/有, khong/Không/没有.
- `loai_hoat_dong`: meeting/Gặp mặt/见面, cafe/Cà phê/咖啡, meal/Ăn uống/吃饭, phone/Điện thoại/电话, sms_zalo/**Tin nhắn/Zalo**/短信Zalo, other/Khác/其他. *(VI canonical "Tin nhắn/Zalo" — sửa B3.)*
- `tan_suat`: weekly_1/Mỗi tuần 1 lần/每周一次, monthly_2/Mỗi tháng 2 lần/每月两次, monthly_1/Mỗi tháng 1 lần/每月一次, quarterly_1/Mỗi quý 1 lần/每季一次, on_demand/Khi cần/按需.
- `trang_thai_thu`: unpaid/Chưa thu/未收款, partial/Đã thu một phần/已部分收款, paid/Đã thu đủ/已全额收款.
- `giai_doan_aging` *(nhóm riêng — sửa B1)*: not_due/Chưa đến hạn/未到期, remind_1/Nhắc lần 1/第一次催收, remind_2/Nhắc lần 2/第二次催收, official_letter/Gửi công văn/发函, negotiation/Đàm phán/谈判, legal/Chuyển pháp lý/转法务.
- `giai_doan_truy_thu` *(nhãn hợp nhất BR-D6b)*: not_due, remind_1, remind_2, official_letter, negotiation, legal (cùng nhãn nhóm aging) + partial_collected/Đã thu một phần/已部分收款, fully_collected/Đã thu đủ/已全额收款. *(6 enum_code đầu TRÙNG nhóm aging để map trực tiếp; 2 enum_code cuối là trục tiền.)*
- `don_vi_don_gia`: gio/Đồng/giờ/元每小时, nguoi/Đồng/người/元每人.

> *(KHÔNG seed nhóm `trang_thai_cham_soc` — trạng thái care quản lý bằng Workflow State; KHÔNG seed nhóm `chi_nhanh` — Branch là DocType riêng. Hai quyết định cố ý, sửa A8/B2.)*

---

## 13. Lộ trình triển khai theo giai đoạn

### Giai đoạn 0 — Khởi tạo (Dev)

```bash
bench new-app labor_crm          # app_name labor_crm, title "Labor CRM"
bench --site labor.localhost install-app labor_crm
# Tạo 5 module (modules.txt): Master Data, Recruitment, CRM, Finance, Settings
```

### Giai đoạn 1 — Master Data + DanhMuc

Tạo DocType: LDR Branch, Category Value, Staff, Customer, Project (+child Specialist), Workshop, Alias × 2, Name Normalization Queue. Viết `install.py` seed Category Value → Branch → Role. Cấu hình get_query song ngữ (lọc `category_group`) + validate ràng buộc nhóm + regex `enum_code`. Mọi enum nghiệp vụ = Link → Category Value.

### Giai đoạn 2 — Recruitment + Quyết định A

Tạo Weekly Demand, Daily Recruitment Report (submittable, field tính `allow_on_submit=1`), Weekly KPI (derived, naming hash + UNIQUE), Recruitment Policy, KPI Recompute Log. Viết `services/kpi_rollup.py` + `recompute.py` + doc_events + scheduler. **Unit-test T1–T5 + idempotent (chạy 2 lần = nhau).**

### Giai đoạn 3 — CRM + Finance + Workflow

Tạo Customer Care Task (+log, virtual `phan_loai_hien_thi`), Receivable (+log), Labor CRM Settings (+2 child với seed ngưỡng aging + cadence 1&15). Setup 2 Workflow (fixtures + install.py) + seed Workflow State. Viết derive aging 2 trục + cadence chăm sóc + nightly_reage + mark_overdue. **Unit-test D1–D4.**

### Giai đoạn 4 — RBAC + API

Cấu hình DocPerm + User Permission Branch + `permission_query_conditions` + `has_permission` (so khớp ID, deny mặc định, ABAC Thử việc). Viết `api/*.py` (bootstrap, summary, get_data_quality, recompute_week, lookup, normalization…). API đổi state = wrapper `apply_workflow`.

### Giai đoạn 5 — Frontend SPA

```bash
# frontend/ (Vite + frappe-ui), mount /labor qua website_route_rules
bench build --app labor_crm
```

Xây Router + stores (session/category/filters) + i18n + components (gồm DataQualityCards) + pages mỗi module + trang normalization + Dashboard theo vai trò + realtime.

### Giai đoạn 6 — Migration dữ liệu thật

Chạy patches: seed → import master → seed aliases → build_workshops (cây Foxconn) → split_receivable_columns (BR-D9) → backfill_transaction_keys → recompute_all_weeks → reconcile (gồm Σ tiền CongNo). Xử lý Name Normalization Queue thủ công qua trang `normalization/` (OM/BM).

### Giai đoạn 7 — Deploy production `hoangdat.gpcds.site`

```bash
bench --site hoangdat.gpcds.site set-config time_zone "Asia/Ho_Chi_Minh"
cd apps/labor_crm && git pull && cd ../..
bench --site hoangdat.gpcds.site migrate          # DocType + patches + fixtures (Workflow/Role/Translation)
bench build --app labor_crm
bench --site hoangdat.gpcds.site clear-cache
sudo supervisorctl restart all                    # web + workers + scheduler
bench setup lets-encrypt hoangdat.gpcds.site      # HTTPS
```

**Checklist go-live:** (1) timezone VN; (2) 7 Branch + DanhMuc đủ nhóm (gồm `giai_doan_aging`); (3) 2 Workflow `is_active=1` + Workflow State đã seed; (4) index composite/UNIQUE `(tuan,du_an,chuyen_vien)` xác nhận trên cả Demand & Weekly KPI; (5) `permission_query_conditions` đăng ký trong hooks.py; (6) scheduler chạy sau 02:00; (7) OM 1 chi nhánh chỉ thấy dữ liệu của mình; (8) chuyển language=zh → label + enum 中文; (9) backup + off-site OK; (10) HTTPS `/labor`; (11) smoke-test KPI: tạo Daily Report → submit → Weekly KPI sinh đúng T1, recompute 2 lần → idempotent; (12) smoke-test công nợ D1–D4.

---

> **Tổng kết quyết định kiến trúc:** (A) `LDR Weekly KPI` dẫn xuất tuyệt đối từ `LDR Weekly Demand` + `LDR Daily Recruitment Report` qua FULL OUTER JOIN (Python merge), read-only, naming hash + upsert theo UNIQUE 3-field, idempotent, tự self-heal; (B) `LDR Workshop` là thực thể với cây Foxconn + pipeline alias/queue (Workshop Alias trước Project Alias), denormalize `du_an`+`xuong` derive trong validate, node group vẫn buộc `project`; phân quyền 3 tầng so khớp bằng ID + ABAC Thử việc + Approval qua Workflow; mọi enum nghiệp vụ = Link → Category Value (i18n động); aging 2 trục với ánh xạ enum đồng nhóm; mọi tỷ lệ roll-up tính lại từ Σ tử/Σ mẫu (tránh Simpson) + `ROUND_HALF_UP` không cap. Naming chuẩn `naming_series`/`hash` (không `format:` chứa counter). Test Vectors KPI T1–T5 + Công nợ D1–D4 là tiêu chí chấp nhận.
>
> **File tham chiếu:** `C:\Thanh cong\CRM-Miniapp-Spec.md`.