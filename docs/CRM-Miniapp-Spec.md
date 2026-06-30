# Đặc tả Phần mềm (SRS) — CRM Mini App cho Công ty Cung ứng & Tuyển dụng Lao động (FDI)

**Mã tài liệu:** SRS-CRM-MINIAPP-v1.1
**Ngày phát hành:** 2026-06-28
**Trạng thái:** Bản hoàn chỉnh để bàn giao đội phát triển (kèm danh mục điểm cần nghiệp vụ xác nhận ở Mục 1.6)
**Nguồn dữ liệu nền:** `CRM-Miniapp-2.xlsx` (10 sheet)

> Quy ước trong tài liệu: Mọi nội dung suy luận vượt ngoài dữ liệu thực được đánh dấu **(giả định)**. Các điểm này cần được Chủ sản phẩm (Product Owner) xác nhận trước khi chốt build, tổng hợp tại Mục 1.6.
>
> **Cập nhật v1.1 (sau review):** (1) Giải quyết mâu thuẫn `xuong` enum-vs-thực-thể; (2) Sửa nhãn enum "Tin nhắn/Zalo" đúng chuỗi gốc; (3) Thêm ràng buộc toàn vẹn Xuong; (4) Bổ sung module quản trị ChiNhanh/Xuong/Alias; (5) Định nghĩa rõ phép JOIN roll-up KPITuan (FULL OUTER) + xử lý lệch chuyên viên; (6) Quy định lưu đồng thời du_an_id + xuong_id; (7) Thêm ETL rule tách cột gộp CongNo; (8) Hạ BR-O2 thành quy tắc mềm; (9) Tách trục công nợ aging vs trạng thái thu (chốt Q5); (10) Chuẩn hóa ký hiệu RBAC; (11) Thêm Mục 7.11 Test Vectors; (12) Đồng nhất ngưỡng aging về một nguồn cấu hình; (13) Chốt một số Open Question vốn là quy tắc tính cốt lõi (Q2, Q8).

---

## 1. Giới thiệu & Mục tiêu

### 1.1. Bối cảnh nghiệp vụ

Công ty là một **đơn vị cung ứng / tuyển dụng lao động (staffing & labor-outsourcing agency)** phục vụ khối **nhà máy FDI điện tử** (Trung Quốc / Đài Loan) tại Việt Nam: Goertek, Canon, Foxconn (các xưởng Fuyu/Fulian/Fukang/Fuhong/Fushan/Funing), Luxshare, Lens, Wistron, Qisda, Quanta, Compal, Amphenol, GGEC, Foxlink, Gentherm, YKK, LCFC…

Công ty vận hành theo **chi nhánh tỉnh**: Bắc Ninh, Bắc Giang, Nam Định, Hà Nam, Đà Nẵng, Nghệ An, Vĩnh Phúc. Mỗi chi nhánh có đội vận hành gồm Quản lý vận hành và Chuyên viên vận hành, phục vụ nhiều khách hàng (mỗi khách thường gắn với một "Dự án" tại một chi nhánh).

Công ty cung cấp **3 dòng dịch vụ**:

| Dòng dịch vụ | Tên tiếng Trung | Bản chất |
|---|---|---|
| Giới thiệu lao động | 代理招聘 | Tuyển và giới thiệu lao động cho nhà máy, ăn phí theo đầu người |
| Cho thuê lại lao động (ngắn hạn) | 岗位外包（短期） | Cung ứng lao động thời vụ/ngắn hạn |
| EOR / Quản lý nhân sự | 人事代理 | Đại lý nhân sự, quản lý HĐLĐ/BHXH |

**Lõi nghiệp vụ** không phải bán hàng mà là **phễu tuyển dụng theo đầu người** (Đăng ký → Phỏng vấn → Đỗ PV → Đi làm) cùng **KPI fill (số người đi làm) theo tuần**, bổ trợ bởi quản trị khách hàng, chính sách giá lao động, chăm sóc khách và công nợ phải thu.

### 1.2. Vấn đề hiện tại

Dữ liệu vận hành đang nằm rải rác trong Excel (10 sheet), liên kết với nhau **bằng tên (text-join), không có khóa định danh**, dẫn tới các vấn đề:

- **Bất nhất định danh** giữa các sheet: `HIP` vs `HI-P`, `LuxshareBacGiang` vs `Luxshare Bắc Giang`, `Canfoco CN` vs `Canfoco`, tên gõ sai dấu (`Phùng Minh HIếu`) → roll-up KPI sai/sót.
- **Lệch cấp chi tiết**: sheet `DuAn` lưu cấp "Foxconn" nhưng `NhuCauTuan`/`BaoCaoNgay`/`ChinhSach` lưu cấp xưởng con (Fuyu/Fulian/Fukang) không tồn tại trong `DuAn`.
- **Mâu thuẫn KPI giao**: `NhuCauTuan` đặt 100 nhưng `KPITuan` các tuần W15/W16 lại 0 → Fill rate trống.
- **Không có ràng buộc** dữ liệu, không kiểm soát nhập liệu, không phân quyền, không nhật ký kiểm toán.

### 1.3. Mục tiêu sản phẩm

1. **Hợp nhất dữ liệu vận hành** từ Excel thành một công cụ điều hành thống nhất, có khóa định danh và ràng buộc toàn vẹn.
2. **Quản trị quan hệ khách hàng nhà máy**: hồ sơ, phân loại, phân công người phụ trách, lịch chăm sóc định kỳ.
3. **Điều phối cung ứng lao động theo phễu**: nhập báo cáo hằng ngày, tự roll-up KPI theo tuần với các công thức đã kiểm chứng.
4. **Đối chiếu nhu cầu vs năng lực fill** theo tuần (Nhu cầu KH / KPI giao / Đi làm thực tế).
5. **Quản trị chính sách giá lao động** theo từng khách/xưởng.
6. **Quản lý công nợ phải thu & truy thu bậc thang** với cảnh báo quá hạn.
7. **Hỗ trợ song ngữ Việt–Trung** ở tầng giao diện (master data đã có cột `ten_trung`).

### 1.4. Phạm vi

#### 1.4.1. Trong phạm vi (In-scope)

| Khối chức năng | Sheet nguồn |
|---|---|
| Quản lý nhân sự nội bộ & phân công | NhanSu |
| Quản lý khách hàng | KhachHang |
| Quản lý dự án (1 KH × 1 chi nhánh) | DuAn |
| Quản lý nhu cầu tuyển theo tuần & KPI giao | NhuCauTuan |
| Chính sách tuyển dụng theo khách/xưởng | ChinhSach |
| Báo cáo tuyển dụng hằng ngày (phễu) | BaoCaoNgay |
| Tổng hợp & tính KPI tuần | KPITuan |
| Chăm sóc khách hàng theo lịch/tần suất | ChamSoc |
| Công nợ phải thu & truy thu bậc thang | CongNo |
| Master data song ngữ (enum) | DanhMuc |
| Quản trị thực thể nền (Chi nhánh, Xưởng, Alias) | (bổ sung) |
| Dashboard & báo cáo tổng hợp, chất lượng dữ liệu | (tổng hợp) |

#### 1.4.2. Ngoài phạm vi (Out-of-scope)

| Hạng mục | Lý do |
|---|---|
| ATS chi tiết từng ứng viên (CV, lịch PV cá nhân) | Phễu chỉ lưu số đếm tổng hợp, không có thực thể ứng viên |
| Hợp đồng & xuất hóa đơn điện tử | Không có sheet hợp đồng/hóa đơn |
| Bảng lương & chấm công người lao động | `ChinhSach` chỉ lưu lương chính sách, không có chấm công |
| Kế toán/sổ cái đầy đủ (phải trả, dòng tiền) | Chỉ có công nợ phải thu |
| Marketing/pipeline cơ hội bán hàng mới | Khách đã cố định |
| Tích hợp BHXH/EOR vận hành thực tế | EOR mới ở mức enum |

*(Toàn bộ mục Out-of-scope dựa trên việc vắng mặt dữ liệu — **(giả định)** cần PO xác nhận.)*

### 1.5. Giả định nền tảng

- **Nền tảng:** Mini App mobile-first — nhiều khả năng **Zalo Mini App** hoặc web responsive nội bộ (**giả định**). Người dùng là đội vận hành chi nhánh, nhập liệu tại hiện trường.
- **Song ngữ Việt–Trung bắt buộc** ở tầng UI (nhãn, enum, thông báo).
- **Backend** đề xuất CSDL quan hệ chuẩn hóa (chi tiết Mục 3), tiến hóa từ hiện trạng bảng Excel.

### 1.6. Điểm cần nghiệp vụ xác nhận (Open questions)

| # | Vấn đề | Trạng thái | Tham chiếu |
|---|---|---|---|
| Q1 | Ngưỡng ngày bậc thang truy thu (7/15/30/60) | Ngỏ — dùng cấu hình `aging_threshold` (Mục 5.3), giá trị mặc định giả định | BR-D6 |
| Q2 | Chu kỳ "2 lần/tháng": 15 ngày hay 2 mốc cố định? | **Đã chốt v1.1:** dùng 2 mốc lịch cố định (ngày 1 & 15) để tránh lệch tháng — xem BR-C4 | BR-C4 |
| Q3 | Nguồn sự thật của KPI giao: NhuCauTuan hay nhập tay KPITuan? | Ngỏ — mặc định **giả định** NhuCauTuan; xem BR-K7 + xử lý lệch CV | BR-K7 |
| Q4 | "Đi làm" có được phép > "Đỗ PV" (cho phép vs lỗi nhập)? | Ngỏ — mặc định cho phép + cảnh báo mềm (VR-W4) | BR-F3 |
| Q5 | Tách trục Giai đoạn truy thu thành aging + thu_status? | **Đã chốt v1.1:** TÁCH 2 cột — `giai_doan_aging` (tự động) + `trang_thai_thu` (tự động từ số tiền); cột `giai_doan_truy_thu` gốc giữ làm nhãn hiển thị dẫn xuất | BR-D6, SM-2 |
| Q6 | Gộp xưởng con → dự án cha (Foxconn) hay giữ cấp Xưởng riêng? | Ngỏ — lưu đồng thời cả hai (BR-R6, BR-X3); roll-up theo dự án cha | BR-R6 |
| Q7 | Bổ sung enum thiếu: chi_nhanh, don_vi_don_gia; trạng thái "Đã kết thúc"/"Đã nghỉ" | **Đã chốt v1.1:** bổ sung enum; `xuong` KHÔNG phải enum (là thực thể) | Mục 5 |
| Q8 | Làm tròn tỷ lệ & cho phép Fill rate > 100%? | **Đã chốt v1.1:** lưu decimal 0..n (không cap), hiển thị % 2 chữ số, làm tròn half-up | BR-K5 |
| Q9 | Bổ sung 2 vai trò hệ thống ADMIN, BOD ngoài 3 vai trò master? | Ngỏ — **giả định** cần thiết, xem Mục 2 | Mục 2 |
| Q10 | Có cần hoạt động offline cho nhập báo cáo ngày? | Ngỏ — ảnh hưởng cơ chế sinh mã hiển thị (VR-KEY) | NFR Mục 11 |

### 1.7. Thuật ngữ song ngữ Việt–Trung

| Thuật ngữ (VI) | 中文 | Giải thích |
|---|---|---|
| Quản lý vận hành | 运营主管 | Người phụ trách nhiều dự án/khách trong chi nhánh |
| Chuyên viên vận hành | 运营专员 | Người thực thi tuyển dụng tại dự án |
| Quản lý chi nhánh | 分公司经理 | Quản trị cấp chi nhánh |
| Giới thiệu lao động | 代理招聘 | Dòng dịch vụ |
| Cho thuê lại lao động (ngắn hạn) | 岗位外包（短期） | Dòng dịch vụ |
| EOR / Quản lý nhân sự | 人事代理 | Dòng dịch vụ |
| Phễu tuyển dụng | 招聘漏斗 | Đăng ký → Phỏng vấn → Đỗ PV → Đi làm |
| Đỗ PV (số người) | 通过面试人数 | Số người đậu phỏng vấn (cột số đếm) |
| Tỷ lệ đậu PV | 面试通过率 | Đỗ PV / Phỏng vấn (cột tỷ lệ) |
| Fill rate (Tỷ lệ lấp đầy) | 完成率 | Đi làm / KPI giao |
| Công nợ phải thu | 应收账款 | Khoản tiền khách còn nợ |
| Chăm sóc khách hàng | 客户维护 | Hoạt động duy trì quan hệ |

> **Glossary chốt (BR-K4):** Trong toàn tài liệu, "**Đỗ PV**" luôn là SỐ NGƯỜI (field `do_pv_so_nguoi`, cột 10 nguồn). "**Tỷ lệ đậu PV**" luôn là TỶ LỆ (field `ti_le_dau_pv`, cột 14 nguồn — gốc ghi typo "Đổ PV"). Không dùng lẫn "Đỗ/Đổ/đậu" cho hai khái niệm khác nhau.

---

## 2. Đối tượng người dùng & Vai trò (Actors)

### 2.1. Vai trò nội bộ (người dùng hệ thống)

| Mã | Vai trò | 中文 | Nguồn | Mô tả phạm vi |
|---|---|---|---|---|
| `ADMIN` | Quản trị hệ thống | 系统管理员 | **(giả định)** | Cấu hình hệ thống, quản lý người dùng & master data |
| `BOD` | Ban lãnh đạo | 董事会 | **(giả định)** | Xem toàn bộ dữ liệu mọi chi nhánh (read-only + duyệt cấp cao) |
| `BM` | Quản lý chi nhánh | 分公司经理 | DanhMuc (chưa có người) | Toàn quyền nghiệp vụ trong 1 chi nhánh |
| `OM` | Quản lý vận hành | 运营主管 | NhanSu (thực) | Quản lý dự án/khách mình phụ trách + chuyên viên dưới quyền |
| `SPV` | Chuyên viên vận hành | 运营专员 | NhanSu (thực) | Tác nghiệp trên dự án được phân công |

**Lưu ý:** Vai trò `Quản lý chi nhánh` có trong `DanhMuc.vai_tro` nhưng hiện chưa có nhân sự — ghế trống/sắp tuyển. Giai đoạn đầu quyền cấp chi nhánh có thể tạm ủy cho OM cao cấp hoặc ADMIN **(giả định)**.

### 2.2. Thuộc tính hạn chế quyền bổ trợ (ABAC)

- `NhanSu.Trạng thái = Thử việc` → mất quyền Xóa; thao tác tài chính/khách hàng phải qua duyệt **(giả định)**. Lưu ý: nhân sự Thử việc **vẫn được** gán phụ trách dự án (dữ liệu thực: Lý Văn Quyết — Thử việc — là Chuyên viên).

### 2.3. Actor bên ngoài (đối tượng nghiệp vụ, không phải người dùng)

| Actor ngoài | Vai trò |
|---|---|
| Khách hàng (nhà máy FDI) | Bên đặt nhu cầu lao động, bên trả tiền (công nợ) |
| Xưởng con của khách | Đơn vị chi tiết hơn khách, có chính sách riêng |
| Người lao động (ứng viên) | Đối tượng chảy qua phễu (chỉ lưu dạng số đếm tổng hợp) |
| Kênh tuyển dụng | Trực tiếp / Đối tác thị trường / Giới thiệu nội bộ |

**Lằn ranh quan trọng:** Hệ thống là **CRM điều hành cung ứng**, KHÔNG phải ATS từng ứng viên.

---

## 3. Kiến trúc tổng quan & Công nghệ *(đề xuất — giả định)*

### 3.1. Hình thái triển khai

- **Frontend:** Mini App mobile-first (Zalo Mini App hoặc web responsive). UI danh sách dạng card, filter dạng chip, form tối giản từng bước. Bắt buộc **i18n Việt–Trung** (nhãn UI + enum + thông báo lỗi).
- **Backend:** API (REST/GraphQL) trên **CSDL quan hệ** (PostgreSQL/MySQL hoặc tương đương). Có thể dùng backend bảng (NocoDB/Airtable-like / Google Sheets) cho giai đoạn MVP nhanh, nhưng **khuyến nghị CSDL quan hệ** để xử lý roll-up KPI và ràng buộc FK đáng tin cậy.
- **Lớp tính toán:** KPITuan và các trường dẫn xuất (Còn lại, Số ngày quá hạn, Fill rate, aging, trạng thái thu…) được **tính tự động** (view/bảng materialized + job nền), không cho nhập tay.

### 3.2. Nguyên tắc thiết kế cốt lõi (bắt buộc)

1. **Khóa định danh thay tên:** Mọi tham chiếu giữa các thực thể dùng **surrogate ID** (không text-join). UI bắt buộc chọn từ dropdown, cấm nhập tên tự do cho FK.
2. **Chiến lược khóa kép cho thực thể giao dịch:** Master dùng surrogate `int ID`. Thực thể giao dịch (NhuCauTuan, BaoCaoNgay, KPITuan, ChamSoc, CongNo) cũng có **surrogate ID kỹ thuật** làm PK; mã hiển thị (`NC####`, `BC#####`…) giữ làm **business key UNIQUE** (sinh ở server), không dùng làm FK nội bộ. (Giải quyết bất nhất chiến lược khóa.)
3. **DanhMuc là lớp cấu hình trung tâm:** tách `ma_enum` (kỹ thuật, bất biến) khỏi `gia_tri` (nhãn VI) và `ten_trung` (nhãn ZH).
4. **Thực thể Xưởng (Workshop)** được bổ sung giữa Khách hàng/Dự án và các bảng cấp xưởng để vá lệch cấp chi tiết. **`xuong` KHÔNG phải nhóm enum DanhMuc** — luôn là thực thể có FK (xem 4.3 và Mục 5).
5. **Múi giờ cố định** `Asia/Ho_Chi_Minh`; **tuần ISO** `YYYY-Www` (bắt đầu Thứ Hai).
6. **Tiền tệ** dùng số nguyên VNĐ (không float).
7. **Ngưỡng cấu hình tập trung:** mọi ngưỡng aging công nợ và quy đổi tần suất chăm sóc khai báo **một lần** trong bảng cấu hình (Mục 5.3), tham chiếu lại ở BR-D6, SM-2 và Dashboard — tránh hard-code trùng lặp.
8. **Audit log** cho mọi thao tác CUD nhạy cảm (CongNo, KPI giao, override KPITuan, sửa DanhMuc/alias).

### 3.3. Sơ đồ thành phần (mô tả bằng lời)

```
[Mini App UI (VI/ZH)] → [API Gateway / Auth+RBAC] → [Service nghiệp vụ]
   → [CSDL quan hệ: master + transaction + DanhMuc + Config + Audit]
   → [Job nền: roll-up KPITuan (FULL OUTER), tính aging+thu_status công nợ, auto Quá hạn chăm sóc]
[ETL Import Excel] → [Staging → Profiling → Cleansing(alias) → Validation → Load]
```

---

## 4. Mô hình dữ liệu

### 4.1. ERD bằng lời (tổng thể)

```
DanhMuc (1) ──cấp enum──► [mọi cột enum của tất cả thực thể]
ChiNhanh (1) ──n──► NhanSu, KhachHang, DuAn, NhuCauTuan, BaoCaoNgay, KPITuan, CongNo

NhanSu (1) ──n──► KhachHang (Quản lý phụ trách)
NhanSu (1) ──n──► DuAn (QL / CV qua bảng nối DuAn_NhanSu)
NhanSu (1) ──n──► ChamSoc (Quản lý), CongNo (Quản lý phụ trách)
NhanSu (1) ──n──► NhuCauTuan, KPITuan, BaoCaoNgay (Quản lý/Chuyên viên)

KhachHang (1) ──n──► DuAn (file mẫu ~1-1; mô hình 1-n là mở rộng, giả định)
KhachHang (1) ──n──► Xuong ──n──► ChinhSach
KhachHang (1) ──n──► ChamSoc, CongNo

DuAn (1) ──n──► Xuong   [RÀNG BUỘC: Xuong.khach_hang_id = DuAn.khach_hang_id]
DuAn (1) ──n──► NhuCauTuan (theo tuần)
DuAn (1) ──n──► BaoCaoNgay (theo ngày)

BaoCaoNgay (n) ──rollup theo Tuần×Dự án×Chuyên viên──► KPITuan (1 dòng tổng hợp)
NhuCauTuan (1) ──FULL OUTER JOIN theo Tuần×Dự án×Chuyên viên──► KPITuan (cấp KPI giao)
```

### 4.2. Quy ước kiểu dữ liệu

| Ký hiệu | Ý nghĩa |
|---|---|
| `string` / `text` | Chuỗi / chuỗi dài tự do |
| `FK→X` | Khóa ngoại tham chiếu thực thể X (bằng ID) |
| `enum→DanhMuc.<nhóm>` | Ràng buộc bởi nhóm trong DanhMuc |
| `int` | Số nguyên ≥ 0 |
| `money` | Số nguyên VNĐ |
| `ratio` | Tỷ lệ thập phân ≥ 0 (không cap) |
| `date` / `datetime` | Ngày / Ngày-giờ |
| `isoweek` | `YYYY-Www` (vd `2026-W14`) |
| `computed` | Trường dẫn xuất, hệ thống tính, không nhập tay |

### 4.3. Master mới bổ sung (vá lệch dữ liệu)

#### E0a — `ChiNhanh` (Chi nhánh) **(bổ sung)**

| Trường | Kiểu | Bắt buộc | Khóa | Ghi chú |
|---|---|---|---|---|
| `chi_nhanh_id` | int | Có | PK | Surrogate |
| `ten` | string | Có | Unique | Bắc Ninh, Bắc Giang, Nam Định, Hà Nam, Đà Nẵng, Nghệ An, Vĩnh Phúc |
| `tinh` | string | Không | — | Tỉnh tương ứng |
| `ten_trung` | string | Không | — | Song ngữ |

#### E0b — `Xuong` (Xưởng / Workshop) **(bổ sung — là THỰC THỂ, không phải enum)**

| Trường | Kiểu | Bắt buộc | Khóa | Ghi chú |
|---|---|---|---|---|
| `xuong_id` | int | Có | PK | Surrogate |
| `khach_hang_id` | FK→KhachHang | Có | FK | Xưởng thuộc khách |
| `du_an_id` | FK→DuAn | **Có** (BR-X1) | FK | Dự án cha; bắt buộc để mọi báo cáo cấp xưởng luôn truy được dự án cha |
| `ten` | string | Có | — | Fuyu, Fulian, Fukang, Nam Sơn, Quế Võ… |
| `ten_trung` | string | Không | — | Song ngữ |
| (UNIQUE) | (khach_hang_id, ten) | — | — | Chống trùng |
| (RÀNG BUỘC) | Xuong.du_an_id thuộc dự án có cùng khach_hang_id | — | — | BR-X2 — chống Xưởng gắn nhầm khách |

#### E0c — `DuAn_Alias` (Bảng ánh xạ tên — cấp dự án) **(bổ sung)**

| Trường | Kiểu | Bắt buộc | Khóa | Ghi chú |
|---|---|---|---|---|
| `alias` | string | Có | **Unique** | Tên thô cấp dự án (vd "HIP", "Canfoco CN") |
| `du_an_id` | FK→DuAn | Có | FK | Tên chuẩn |

#### E0d — `Xuong_Alias` (Bảng ánh xạ tên — cấp xưởng) **(bổ sung)**

| Trường | Kiểu | Bắt buộc | Khóa | Ghi chú |
|---|---|---|---|---|
| `alias` | string | Có | **Unique** | Tên thô cấp xưởng (vd "Fuyu", "Fulian", "Fukang") |
| `xuong_id` | FK→Xuong | Có | FK | Xưởng chuẩn (đã gắn du_an_id cha) |

> **Thứ tự áp dụng alias trong pipeline (BR-R4b):** với mỗi token tên thô từ NhuCauTuan/BaoCaoNgay, đối chiếu **Xuong_Alias trước** (khớp → có cả `xuong_id` + `du_an_id` cha); nếu không khớp xưởng thì đối chiếu **DuAn_Alias** (khớp → chỉ `du_an_id`); không khớp cả hai → hàng đợi review, không tự gộp.

### 4.4. E1 — `NhanSu` (Nhân sự nội bộ)

| Trường | Kiểu | Bắt buộc | Khóa | Enum/Ràng buộc |
|---|---|---|---|---|
| `nhan_su_id` | int | Có | PK | Surrogate **(bổ sung)** |
| `ho_ten` | string | Có | — | Chuẩn hóa casing/dấu khi nhập |
| `chi_nhanh_id` | FK→ChiNhanh | Có | FK | — |
| `vai_tro` | enum | Có | — | `enum→DanhMuc.vai_tro` |
| `trang_thai` | enum | Có | — | `enum→DanhMuc.trang_thai_nv` |
| `quan_ly_truc_tiep_id` | FK→NhanSu | Không | FK | **(bổ sung)** để scope OM→SPV tường minh |

Số bản ghi nền: 17. Vai trò `Quản lý chi nhánh` chưa có người (enum hợp lệ, để trống).

### 4.5. E2 — `DuAn` (Dự án)

| Trường | Kiểu | Bắt buộc | Khóa | Enum/Ràng buộc |
|---|---|---|---|---|
| `du_an_id` | int | Có | PK | Surrogate **(bổ sung)** |
| `ten_du_an` | string | Có | Unique | — |
| `chi_nhanh_id` | FK→ChiNhanh | Có | FK | — |
| `khach_hang_id` | FK→KhachHang | Có | FK | — |
| `phan_loai` | enum | Có | — | `enum→DanhMuc.phan_loai_kh` |
| `dich_vu` | enum | Không | — | `enum→DanhMuc.dich_vu` **(bổ sung — gắn dòng dịch vụ)** |
| `quan_ly_phu_trach_id` | FK→NhanSu | Có | FK | vai_tro nên = Quản lý vận hành (**giả định**) |
| `trang_thai` | enum | Có | — | `enum→DanhMuc.trang_thai_da` |

> **Ghi chú quan hệ:** Trong file mẫu KhachHang ~ DuAn là **1-1** (~38 mỗi bên). Mô hình hóa **1-n** (1 khách nhiều dự án) là **mở rộng vượt dữ liệu (giả định)** cho tương lai; `ten_du_an` UNIQUE và `khach_hang_id` bắt buộc.
>
> **Lưu ý `phan_loai`:** đây là cột thực có trong sheet DuAn nguồn nên giữ lại; tuy nhiên nguồn chuẩn là `KhachHang.phan_loai` (xem I7). Cách xử lý: xem 4.11 (ChamSoc) và BR-M5.

**Bảng nối E2b — `DuAn_NhanSu`** **(bổ sung — thay 2 cột Chuyên viên 1/2)**

| Trường | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `du_an_id` | FK→DuAn | Có | PK kép |
| `nhan_su_id` | FK→NhanSu | Có | PK kép |
| `vai_tro_trong_du_an` | enum | Có | Chuyên viên 1 / Chuyên viên 2 |

Số bản ghi nền: ~38. Chuyên viên 2 thường null → mô hình hóa thành quan hệ n-n.

### 4.6. E3 — `KhachHang` (Khách hàng)

| Trường | Kiểu | Bắt buộc | Khóa | Enum/Ràng buộc |
|---|---|---|---|---|
| `khach_hang_id` | int | Có | PK | Surrogate **(bổ sung)** |
| `ten_khach_hang` | string | Có | Unique | — |
| `ten_trung` | string | Không | — | Song ngữ **(bổ sung, giả định — ưu tiên thấp)**; tên khách phần lớn là tên riêng Latin, fallback VI/tên gốc |
| `chi_nhanh_id` | FK→ChiNhanh | Có | FK | — |
| `phan_loai` | enum | Có | — | `enum→DanhMuc.phan_loai_kh` — **nguồn chuẩn của phân loại** |
| `dich_vu` | enum | Không | — | `enum→DanhMuc.dich_vu` **(bổ sung)** |
| `quan_ly_phu_trach_id` | FK→NhanSu | **Không** | FK | Dữ liệu thực có null → cảnh báo (VR-W1) |

Số bản ghi nền: ~38.

### 4.7. E4 — `ChinhSach` (Chính sách tuyển dụng theo khách/xưởng)

| Trường | Kiểu | Bắt buộc | Khóa | Enum/Ràng buộc |
|---|---|---|---|---|
| `chinh_sach_id` | int | Có | PK | Surrogate **(bổ sung)** |
| `khach_hang_id` | FK→KhachHang | Có | FK | — |
| `xuong_id` | FK→Xuong | Có | FK | (không qua DuAn) |
| `dang_tuyen` | enum | Có | — | `enum→DanhMuc.dang_tuyen` |
| `don_gia` | money | Có | — | vd 15000, 850000 |
| `don_vi` | enum | Có (nếu có đơn giá) | — | `enum→DanhMuc.don_vi_don_gia` (/giờ, /người) **(bổ sung enum)** |
| `yeu_cau` | text | Không | — | Free text, vd "15k/1h với LĐ trên 22 tuổi…" |
| `luong_co_ban` | money | Không | — | VNĐ, có null |
| `phu_cap` | money | Không | — | VNĐ, có null |
| `co_ktx` | enum | Không | — | `enum→DanhMuc.co_ktx` |
| (UNIQUE) | (khach_hang_id, xuong_id) | — | — | Chống trùng |

Lưu ý: `don_gia` phụ thuộc ngữ nghĩa `don_vi` — **không cộng gộp/so sánh /giờ với /người** khi báo cáo (mọi tổng hợp/sắp xếp đơn giá bắt buộc nhóm theo `don_vi`, xem BR-P8).

### 4.8. E5 — `NhuCauTuan` (Nhu cầu tuyển theo tuần)

| Trường | Kiểu | Bắt buộc | Khóa | Enum/Ràng buộc |
|---|---|---|---|---|
| `nhu_cau_id` | int | Có | PK | Surrogate **(bổ sung)** |
| `ma` | string | Có | Unique | `NC0001…` business key |
| `tuan` | isoweek | Có | — | `YYYY-Www` |
| `chi_nhanh_id` | FK→ChiNhanh | Có | FK | — |
| `du_an_id` | FK→DuAn | Có | FK | (sau chuẩn hóa alias) |
| `xuong_id` | FK→Xuong | Không | FK | Nếu nhu cầu ở cấp xưởng — **lưu đồng thời với du_an_id cha** (BR-X3) |
| `quan_ly_id` | FK→NhanSu | Có | FK | — |
| `chuyen_vien_id` | FK→NhanSu | Có | FK | — |
| `nhu_cau_kh_tuan` | int | Có | — | vd 200 |
| `kpi_giao` | int | Có | — | vd 100; ≤ nhu_cau_kh (**giả định**, soft VR-W6) |
| (UNIQUE) | (tuan, du_an_id, chuyen_vien_id) | — | — | — |

Header gốc trải tới cột T(20) nhưng chỉ 8 cột có dữ liệu → **9 cột dự trữ rỗng, không di trú**.

### 4.9. E6 — `BaoCaoNgay` (Báo cáo tuyển dụng hằng ngày — fact phễu)

| Trường | Kiểu | Bắt buộc | Khóa | Enum/Ràng buộc |
|---|---|---|---|---|
| `bao_cao_id` | int | Có | PK | Surrogate **(bổ sung)** |
| `ma` | string | Có | Unique | `BC00001…` business key |
| `ngay` | datetime | Có | — | — |
| `tuan` | isoweek | computed | — | Tự suy từ `ngay` theo ISO-week, KHÔNG nhập tay (BR-F6) |
| `du_an_id` | FK→DuAn | Có | FK | Bắt buộc chọn dropdown (sau alias); luôn truy được kể cả khi nhập cấp xưởng (vì Xuong.du_an_id bắt buộc) |
| `xuong_id` | FK→Xuong | Không | FK | Lưu đồng thời nếu báo cáo ở cấp xưởng (BR-X3) |
| `chi_nhanh_id` | FK→ChiNhanh | Có | FK | Tự điền theo dự án |
| `phuong_thuc` | enum | Có | — | `enum→DanhMuc.phuong_thuc` |
| `dang_ky` | int | Có | — | Đỉnh phễu |
| `phong_van` | int | Có | — | ≤ Đăng ký (BR-F1) |
| `do_pv` | int | Có | — | ≤ Phỏng vấn (số người đậu PV) |
| `di_lam` | int | Có | — | Kết quả; KHÔNG chặn trên bởi Đỗ PV (BR-F3) |
| `chuyen_vien_id` | FK→NhanSu | Có | FK | — |

Số bản ghi nền: ~1048 (bảng lớn nhất, nguồn roll-up). Dữ liệu mẫu: Đỗ PV=6, Đi làm=10 → Đi làm > Đỗ PV hợp lệ.

### 4.10. E7 — `KPITuan` (Tổng hợp KPI tuần — bảng dẫn xuất, read-only)

| Trường | Kiểu | Bắt buộc | Khóa | Công thức / Ràng buộc |
|---|---|---|---|---|
| `kpi_tuan_id` | int | Có | PK | Surrogate **(bổ sung)** |
| `ma` | string | Có | Unique | `KPI0001…` business key (upsert, không tái sử dụng) |
| `tuan` | isoweek | Có | — | Khóa nhóm roll-up |
| `chi_nhanh_id` | FK→ChiNhanh | Có | FK | Suy từ Dự án (BR-R1) |
| `du_an_id` | FK→DuAn | Có | FK | — |
| `quan_ly_id` | FK→NhanSu | Có | FK | Suy từ Dự án (BR-R1) |
| `chuyen_vien_id` | FK→NhanSu | Có | FK | — |
| `kpi_giao` | int | Có | — | Lấy từ NhuCauTuan (BR-K7); không có nhu cầu → 0 |
| `dang_ky` | int | Có | — | = Σ BaoCaoNgay.dang_ky (0 nếu không có báo cáo) |
| `phong_van` | int | Có | — | = Σ BaoCaoNgay.phong_van |
| `do_pv_so_nguoi` | int | Có | — | = Σ BaoCaoNgay.do_pv (**đổi tên từ "Đỗ PV"**) |
| `di_lam` | int | Có | — | = Σ BaoCaoNgay.di_lam |
| `fill_rate` | ratio/computed | None nếu KPI=0 | — | = Đi làm / KPI giao (BR-K1) |
| `chuyen_doi` | ratio/computed | Có | — | = Đi làm / Đăng ký (BR-K2) |
| `ti_le_dau_pv` | ratio/computed | Có | — | = Đỗ PV / Phỏng vấn (**đổi tên từ "Đổ PV"**, BR-K3) |
| `co_lech_chuyen_vien` | bool/computed | Có | — | True nếu dòng chỉ có nhu cầu hoặc chỉ có báo cáo (BR-K8) |
| (UNIQUE) | (tuan, du_an_id, chuyen_vien_id) | — | — | Idempotent khi re-compute (upsert) |

**Bẫy đặt tên đã xử lý:** cột số người = `do_pv_so_nguoi`; cột tỷ lệ = `ti_le_dau_pv` (trước là "Đỗ PV" / "Đổ PV" gần trùng).

### 4.11. E8 — `ChamSoc` (Chăm sóc khách hàng)

| Trường | Kiểu | Bắt buộc | Khóa | Enum/Ràng buộc |
|---|---|---|---|---|
| `cham_soc_id` | int | Có | PK | Surrogate **(bổ sung)** |
| `ma` | string | Có | Unique | `CSK00001…` business key |
| `quan_ly_id` | FK→NhanSu | Có | FK | gợi ý = quan_ly_phu_trach của KH (BR-C3, mềm) |
| `khach_hang_id` | FK→KhachHang | Có | FK | — |
| `phan_loai` | enum/computed | computed | — | **Luôn dẫn xuất từ KhachHang.phan_loai hiện tại** (BR-M5) — không lưu cố định |
| `hoat_dong` | enum | Có | — | `enum→DanhMuc.loai_hoat_dong` |
| `tan_suat` | enum | Có | — | `enum→DanhMuc.tan_suat` |
| `ngay_kh` | date | Không | — | Ngày hẹn/chăm sóc kế tiếp |
| `noi_dung` | text | Không | — | Nội dung/kế hoạch chăm sóc |
| `trang_thai` | enum | Có | — | `enum→DanhMuc.trang_thai_cham_soc` |

**Bảng con E8b — `ChamSoc_LichSu`** **(bổ sung — nhật ký append-only, thay cột "Lịch sử/Nhật ký")**: `cham_soc_id` (FK), `thoi_diem` (datetime), `noi_dung` (text). Append-only (BR-C7).

### 4.12. E9 — `CongNo` (Công nợ phải thu)

| Trường | Kiểu | Bắt buộc | Khóa | Công thức / Ràng buộc |
|---|---|---|---|---|
| `cong_no_id` | int | Có | PK | Surrogate **(bổ sung)** |
| `ma` | string | Có | Unique | `CN001…` business key |
| `chi_nhanh_id` | FK→ChiNhanh | Có | FK | — |
| `khach_hang_id` | FK→KhachHang | Có | FK | **(tách từ cột gộp "Khách hàng/Dự án" — ETL rule BR-D9)** |
| `du_an_id` | FK→DuAn | Không | FK | **(tách, nullable)** |
| `quan_ly_phu_trach_id` | FK→NhanSu | Có | FK | — |
| `ky_cong_no` | string | Có | — | `T<MM>/<YYYY>` (vd `T06/2026`) |
| `so_tien` | money | Có | — | > 0 |
| `ngay_den_han` | date | Có | — | — |
| `so_ngay_qua_han` | int/computed | computed | — | = max(0, hôm nay − ngày đến hạn) (BR-D2) |
| `da_thu` | money | Có | — | 0 ≤ Đã thu ≤ Số tiền |
| `con_lai` | money/computed | computed | — | = Số tiền − Đã thu (BR-D1) |
| `giai_doan_aging` | enum/computed | computed | — | Theo bậc thang thời gian (BR-D6); xem 5.3 |
| `trang_thai_thu` | enum/computed | computed | — | Theo số tiền: Chưa thu / Đã thu một phần / Đã thu đủ (BR-D6) |
| `giai_doan_truy_thu` | enum | Không (nhãn dẫn xuất / override) | — | `enum→DanhMuc.giai_doan_truy_thu`; mặc định = hợp nhất aging+thu (BR-D6b), cho phép người dùng override thủ công có duyệt |
| `ghi_chu` | text | Không | — | — |

Trường `computed` (con_lai, so_ngay_qua_han, giai_doan_aging, trang_thai_thu) **không cho nhập tay**.

### 4.13. E10 — `DanhMuc` (Master data / enum song ngữ)

| Trường | Kiểu | Bắt buộc | Khóa | Ràng buộc |
|---|---|---|---|---|
| `nhom_danh_muc` | string | Có | PK (phần 1) | Tên nhóm enum |
| `ma_enum` | string | Có | Unique trong nhóm | **(bổ sung)** mã kỹ thuật bất biến — khóa thực dùng cho FK enum |
| `gia_tri` | string | Có | PK (phần 2) | Nhãn tiếng Việt |
| `ten_trung` | string | Không | — | Nhãn tiếng Trung |
| `thu_tu` | int | Không | — | **(bổ sung)** thứ tự hiển thị |
| `dang_su_dung` | bool | Không | — | **(bổ sung)** active flag |

Chi tiết giá trị: xem Mục 5.

---

## 5. Danh mục dùng chung (DanhMuc) — enum song ngữ + Cấu hình

### 5.1. Các nhóm hiện có trong dữ liệu

| `nhom_danh_muc` | Giá trị (VI) — 中文 | Dùng tại |
|---|---|---|
| `vai_tro` | Quản lý chi nhánh / Quản lý vận hành (运营主管) / Chuyên viên vận hành (运营专员) | NhanSu.vai_tro |
| `trang_thai_nv` | Chính thức (转正) / Thử việc (试用) | NhanSu.trang_thai |
| `phan_loai_kh` | Thường / Trọng điểm (重点客户) | KhachHang/DuAn/ChamSoc.phan_loai |
| `trang_thai_da` | Đang vận hành (运营中) / Tạm dừng (暂停) | DuAn.trang_thai |
| `dich_vu` | Giới thiệu lao động (代理招聘) / Cho thuê lại lao động (Ngắn hạn) (岗位外包（短期）) / EOR-Quản lý nhân sự (人事代理) | DuAn/KhachHang.dich_vu **(bổ sung gắn cột)** |
| `phuong_thuc` | Tuyển dụng trực tiếp (直招) / Đối tác thị trường (渠道) / Giới thiệu nội bộ (内荐) | BaoCaoNgay.phuong_thuc |
| `dang_tuyen` | Có (有需求) / Không (停招) | ChinhSach.dang_tuyen |
| `co_ktx` | Có (有) / Không (没有) | ChinhSach.co_ktx |
| `loai_hoat_dong` | Gặp mặt / Cafe / Ăn cơm / Điện thoại / **Tin nhắn/Zalo** / Khác | ChamSoc.hoat_dong |
| `tan_suat` | 1 lần / tuần / 2 lần / tháng / 1 lần / tháng / 1 lần / quý / Khi cần | ChamSoc.tan_suat |
| `trang_thai_cham_soc` | Chưa hoàn thành / Đang thực hiện / Hoàn thành / Quá hạn | ChamSoc.trang_thai |
| `giai_doan_truy_thu` | Chưa đến hạn / Nhắc lần 1 / Nhắc lần 2 / Gửi công văn / Đàm phán / Đã thu một phần / Đã thu đủ / Chuyển pháp lý | CongNo.giai_doan_truy_thu |

> **Sửa lỗi nhãn (v1.1):** `loai_hoat_dong` dùng đúng chuỗi gốc **"Tin nhắn/Zalo"** (gạch chéo), không phải "Tin nhắn-Zalo". Vì dùng `ma_enum` làm khóa (BR-M2), nhãn hiển thị có thể chỉnh mà không vỡ FK, nhưng phải khớp chuỗi gốc khi migrate dữ liệu nền.

### 5.2. Các nhóm enum bổ sung *(đề xuất — giả định, Q7)*

| `nhom_danh_muc` | Giá trị (VI) — 中文 | Dùng tại |
|---|---|---|
| `chi_nhanh` | Bắc Ninh / Bắc Giang / Nam Định / Hà Nam / Đà Nẵng / Nghệ An / Vĩnh Phúc | seed cho thực thể ChiNhanh / cột Chi nhánh |
| `don_vi_don_gia` | /giờ (/小时) / /người (/人) | ChinhSach.don_vi |
| `trang_thai_thu` | Chưa thu / Đã thu một phần / Đã thu đủ | CongNo.trang_thai_thu |
| `giai_doan_aging` | Chưa đến hạn / Nhắc lần 1 / Nhắc lần 2 / Gửi công văn / Đàm phán / Chuyển pháp lý | CongNo.giai_doan_aging |

> **`xuong` KHÔNG phải nhóm DanhMuc.** Xưởng là **thực thể** `Xuong` (E0b) có FK tới KhachHang/DuAn và giá trị động theo khách; danh sách chi_nhanh chỉ là **seed ban đầu** cho thực thể ChiNhanh, sau đó ChiNhanh quản trị độc lập. (Giải quyết mâu thuẫn enum-vs-thực-thể trong review.)

### 5.3. Bảng cấu hình ngưỡng tập trung **(bổ sung — Config)**

Khai báo một lần, tham chiếu ở BR-D6/SM-2/Dashboard và BR-C4.

**`aging_threshold` (ngưỡng aging công nợ — giả định Q1):**

| `giai_doan_aging` | Số ngày quá hạn |
|---|---|
| Chưa đến hạn | = 0 |
| Nhắc lần 1 | 1–7 |
| Nhắc lần 2 | 8–15 |
| Gửi công văn | 16–30 |
| Đàm phán | 31–60 |
| Chuyển pháp lý | > 60 |

**`tan_suat_chu_ky` (quy đổi tần suất chăm sóc — Q2 đã chốt: dùng mốc lịch để tránh lệch tháng):**

| `tan_suat` | Quy tắc sinh "Ngày KH" kế tiếp |
|---|---|
| 1 lần / tuần | + 7 ngày kể từ ngày kế hoạch trước |
| 2 lần / tháng | mốc lịch cố định: ngày 1 và ngày 15 của tháng |
| 1 lần / tháng | + 1 tháng lịch (cùng ngày tháng kế tiếp) |
| 1 lần / quý | + 3 tháng lịch |
| Khi cần | không tự sinh |

---

## 6. Đặc tả chức năng theo module

> Nguyên tắc chung mọi module: enum lấy từ DanhMuc (dropdown song ngữ); FK chọn từ dropdown (cấm gõ tự do); danh sách dạng card + filter chip; phân quyền theo Mục 9.

### 6.1. Module Nhân sự (NhanSu)

- **Mục đích:** Quản lý nhân sự nội bộ — nguồn gán Quản lý/Chuyên viên cho mọi module.
- **Màn hình:** Danh sách (nhóm theo chi nhánh); Chi tiết (hiển thị dự án/khách/công nợ/chăm sóc đang phụ trách — quan hệ ngược, workload).
- **CRUD:** Create (Thử việc); Update (đổi vai trò, Thử việc→Chính thức, đổi chi nhánh); **Delete = vô hiệu hóa mềm** (không xóa cứng vì được tham chiếu nhiều nơi).
- **Bộ lọc:** Chi nhánh, Vai trò, Trạng thái. Tìm kiếm theo họ tên (hỗ trợ không dấu).
- **Quy tắc:** BR-O3, BR-O4. Vai trò "Quản lý chi nhánh" vẫn cho chọn dù chưa có người.

### 6.2. Module Khách hàng (KhachHang)

- **Mục đích:** Hồ sơ khách hàng — gốc của Dự án/Chính sách/Chăm sóc/Công nợ.
- **Màn hình:** Danh sách; Chi tiết = **hub 360°** với tab Dự án | Xưởng | Chính sách (theo xưởng) | Lịch chăm sóc | Công nợ.
- **CRUD:** Create/Update/Read chuẩn; Delete chặn nếu có Dự án/Công nợ/Chính sách liên kết.
- **Bộ lọc:** Chi nhánh, Phân loại, Quản lý phụ trách, **"Thiếu quản lý phụ trách"** (filter chất lượng dữ liệu).
- **Quy tắc:** Khi tạo KH → gợi ý gán Quản lý; tạo KH "Trọng điểm/Thường" → sinh lịch chăm sóc mặc định (Luồng B). Đổi `phan_loai` → lịch chăm sóc dẫn xuất phân loại mới (BR-M5).

### 6.3. Module Dự án (DuAn)

- **Mục đích:** Đơn vị vận hành (1 KH × 1 chi nhánh); khóa liên kết cho Nhu cầu tuần/Báo cáo ngày/KPI tuần.
- **Màn hình:** Danh sách (lọc trạng thái); Chi tiết = tab Xưởng | Nhu cầu tuần | Báo cáo ngày | KPI tuần.
- **CRUD:** Create (gán team 1 QL + 1–2 CV qua bảng nối); Update (đổi team, Tạm dừng/Kích hoạt); Delete chặn nếu có lịch sử → dùng "Tạm dừng".
- **Bộ lọc:** Chi nhánh, Khách hàng, Phân loại, Trạng thái, Quản lý, Chuyên viên.
- **Quy tắc:** SM-3 (Đang vận hành ⇄ Tạm dừng). Tạo dự án mới cần BM/ADMIN duyệt (kiểm soát master, tránh trùng tên).

### 6.4. Module Nhu cầu tuần (NhuCauTuan)

- **Mục đích:** Ghi nhu cầu KH theo tuần + KPI giao; đầu vào chu trình tuần.
- **Màn hình:** Danh sách theo tuần (mặc định tuần hiện tại); **Nhập hàng loạt theo tuần** (chọn tuần → list dự án đang vận hành → nhập KPI từng dòng theo từng chuyên viên).
- **CRUD:** Create/Update KPI tuần hiện tại; tuần đã khóa chỉ đọc; Delete chặn nếu tuần đã có Báo cáo ngày.
- **Bộ lọc:** Tuần, Chi nhánh, Dự án, Quản lý/Chuyên viên.
- **Quy tắc:** Là **nguồn sự thật** cho KPI giao (BR-K7). Khuyến nghị 1 dòng/(Tuần×Dự án×Chuyên viên) để khớp khóa roll-up. Cột dự trữ I–T bị bỏ.

### 6.5. Module Chính sách (ChinhSach)

- **Mục đích:** Bảng giá/điều khoản tuyển theo khách × xưởng.
- **Màn hình:** Trong tab Chính sách của Khách hàng (list theo xưởng); màn tra cứu read-only khi tư vấn.
- **CRUD:** Create/Update theo dòng xưởng; Delete khi ngừng hợp tác.
- **Bộ lọc:** Khách hàng, **Đang tuyển=Có** (mặc định), Có KTX, Đơn vị. Sắp xếp theo đơn giá **trong từng nhóm đơn vị** (BR-P8).
- **Quy tắc:** BR-P1..P8. Đổi đơn giá/lương cần BM duyệt.

### 6.6. Module Báo cáo ngày (BaoCaoNgay)

- **Mục đích:** Nhật ký phễu hằng ngày; nguồn roll-up KPI tuần.
- **Màn hình:** Form nhập nhanh (< 30 giây/dòng): chọn Dự án (hoặc Xưởng) + Phương thức → nhập 4 số phễu; Tuần tự gắn theo Ngày.
- **CRUD:** Create; Update trong cửa sổ T+1 (xem BR-F7); sau đó chỉ BM/ADMIN; Delete chặn nếu tuần đã chốt KPI.
- **Validation:** BR-F1 (Đăng ký ≥ Phỏng vấn ≥ Đỗ PV); BR-F3 (Đi làm có thể > Đỗ PV — cảnh báo soft VR-W4).
- **Bộ lọc:** Ngày/Khoảng ngày, Tuần, Dự án, Xưởng, Chi nhánh, Phương thức, Chuyên viên.
- **Quy tắc:** **Bắt buộc chọn Dự án/Xưởng từ dropdown (ID)**, cấm nhập text tự do (chống bất nhất tên).

### 6.7. Module KPI tuần (KPITuan)

- **Mục đích:** Bảng roll-up tự động Tuần×Dự án×Chuyên viên + 3 tỷ lệ.
- **Màn hình:** Bảng (lọc/sắp xếp); **read-only**; nút "Tính lại tuần" (re-compute, upsert); drill-down sang Báo cáo ngày.
- **CRUD:** Không nhập tay số liệu phễu; chỉ ADMIN re-compute. KPI giao sửa qua NhuCauTuan.
- **Bộ lọc:** Tuần, Chi nhánh, Dự án, Quản lý, Chuyên viên, **"Lệch chuyên viên"** (co_lech_chuyen_vien). Sắp xếp Fill rate/Chuyển đổi (thấp→cao để soi điểm yếu).
- **Quy tắc:** BR-K1..K8, BR-R1..R7. Nhãn cột tỷ lệ hiển thị **"Tỷ lệ đậu PV"**.

### 6.8. Module Chăm sóc khách hàng (ChamSoc)

- **Mục đích:** Lập & theo dõi lịch chăm sóc theo Quản lý phụ trách.
- **Màn hình:** Lịch (calendar) + danh sách "đến hạn hôm nay/tuần này".
- **CRUD:** Create (có auto-generate theo phân loại); Update (trạng thái + ghi nhật ký append-only); Delete (hủy lịch).
- **Bộ lọc:** Quản lý (mặc định = tôi), Khách, Phân loại, Hoạt động, Trạng thái, **"Quá hạn"**, khoảng "Ngày KH".
- **Quy tắc:** BR-C1..C8, SM-1. Hoàn thành → sinh lịch kế tiếp theo tần suất (mốc neo: xem BR-C4).

### 6.9. Module Công nợ (CongNo)

- **Mục đích:** Quản lý phải thu theo kỳ + truy thu bậc thang.
- **Màn hình:** Danh sách + tổng hợp aging; Chi tiết khoản nợ (hiển thị song song aging + trạng thái thu).
- **CRUD:** Create (Số tiền, Ngày đến hạn, Kỳ); Update (Đã thu → Còn lại/aging/trạng thái thu tự tính; override Giai đoạn truy thu nếu cần — có duyệt); Delete hạn chế.
- **Bộ lọc:** Chi nhánh, Khách, Quản lý, Kỳ, Giai đoạn aging, Trạng thái thu, **"Quá hạn (>0)"**, **"Còn lại>0"**. Sắp xếp theo Số ngày quá hạn / Còn lại giảm dần.
- **Quy tắc:** BR-D1..D9, SM-2. Đóng công nợ / chuyển pháp lý cần duyệt (Mục 9.5).

### 6.10. Module Danh mục (DanhMuc)

- **Mục đích:** Master enum song ngữ — cấp dropdown cho mọi module.
- **Màn hình:** Quản trị theo nhóm (ADMIN only).
- **CRUD:** CRUD theo nhóm; **không xóa giá trị đang được tham chiếu** (chỉ ẩn qua `dang_su_dung`). Hỗ trợ `thu_tu`.
- **Quy tắc:** Sửa giá trị ảnh hưởng toàn hệ thống → tập trung quyền ADMIN. Cũng là nơi sửa **bảng cấu hình ngưỡng** (5.3).

### 6.11. Module Quản trị thực thể nền — ChiNhanh / Xuong / Alias **(bổ sung)**

- **Mục đích:** Quản trị các thực thể nền được bổ sung mà sheet gốc không có màn riêng.
- **ChiNhanh:** CRUD bởi ADMIN; BM xem. Vô hiệu hóa mềm nếu đã được tham chiếu.
- **Xuong:** CRUD bởi ADMIN/BM (trong scope); tạo trong tab Xưởng của Khách hàng/Dự án; bắt buộc gán `du_an_id` cha (BR-X1) và kiểm BR-X2.
- **DuAn_Alias / Xuong_Alias:** màn ADMIN duyệt/map; **hàng đợi review** các tên thô chưa map phát sinh từ ETL/nhập liệu (VR-W2). Khi duyệt 1 alias → áp dụng lại cho các bản ghi chờ.

### 6.12. Module Dashboard & Báo cáo

- Xem Mục 10.

---

## 7. Quy tắc nghiệp vụ & Công thức

> Quy ước mã: `BR-*` (Business Rule), `VR-*` (Validation), `SM-*` (State Machine).

### 7.1. Phễu tuyển dụng — BR-F

| Mã | Quy tắc |
|---|---|
| BR-F1 | `Đăng ký ≥ Phỏng vấn ≥ Đỗ PV ≥ 0` (bất biến thứ tự phễu) |
| BR-F2 | 4 chỉ số phễu là số nguyên ≥ 0 |
| BR-F3 | `Đi làm` là kết quả, KHÔNG bắt buộc ≤ Đỗ PV (mẫu: Đỗ PV=6, Đi làm=10 hợp lệ). **(giả định lý do:** đi làm từ kỳ trước/nguồn khác.) Cảnh báo soft VR-W4. |
| BR-F4 | Mỗi dòng gắn đúng 1 Phương thức ∈ DanhMuc.phuong_thuc |
| BR-F5 | Khóa ngữ cảnh = Ngày + Dự án + Chi nhánh + Chuyên viên (+ Xưởng nếu có) |
| BR-F6 | `Tuần` là trường **computed** từ `Ngày` theo ISO-week — KHÔNG lưu nhập tay, KHÔNG có VR đối chiếu (loại bỏ mâu thuẫn cũ) |
| BR-F7 | **Cửa sổ sửa của SPV (khóa sổ):** SPV được sửa/xóa bản ghi nếu `now ≤ (ngay 00:00 + 2 ngày) tại Asia/Ho_Chi_Minh` (tức đến hết 23:59 ngày hôm sau ngày báo cáo). Quá hạn → chỉ BM/ADMIN. Bản ghi nhập trễ vẫn cho tạo nhưng đánh cờ "nhập trễ". |

### 7.2. Công thức KPI tuần — BR-K *(đã kiểm chứng từ dữ liệu)*

| Mã | Chỉ tiêu | Công thức | Xử lý chia 0 |
|---|---|---|---|
| BR-K1 | **Fill rate** | `Đi làm / KPI giao` | KPI giao=0 → **None (trống)** |
| BR-K2 | **Chuyển đổi** | `Đi làm / Đăng ký` | Đăng ký=0 → **0** |
| BR-K3 | **Tỷ lệ đậu PV** (cột 14) | `Đỗ PV / Phỏng vấn` | Phỏng vấn=0 → **0** (**giả định**) |

- **BR-K4:** Phân biệt `do_pv_so_nguoi` (SỐ NGƯỜI, cột 10) vs `ti_le_dau_pv` (TỶ LỆ, cột 14). Bắt buộc đặt 2 field-name kỹ thuật khác nhau (xem Glossary Mục 1.7).
- **BR-K5 (Q8 đã chốt):** Tỷ lệ lưu decimal ≥ 0 (không cap); hiển thị % 2 chữ số thập phân, làm tròn **half-up** (0.6667→66.67%; 0.8333→83.33%). Fill rate cho phép **> 100%** khi Đi làm > KPI giao (không cap).
- **BR-K6:** KPITuan giữ bất biến phễu `Đăng ký ≥ Phỏng vấn ≥ Đỗ PV` (cộng dồn giữ thứ tự).
- **BR-K7 (giả định, Q3):** KPI giao trong KPITuan **đồng bộ từ NhuCauTuan** theo (Tuần × Dự án × Chuyên viên). Không có dòng NhuCauTuan → KPI giao=0 → Fill rate trống. NhuCauTuan là **nguồn sự thật** (đây là **quyết định thiết kế** trên nền dữ liệu mâu thuẫn W15/W16, KHÔNG phải sự thật suy ra từ dữ liệu — chờ PO xác nhận).
- **BR-K8 (xử lý lệch chuyên viên):** Roll-up dùng **FULL OUTER JOIN** giữa (tổng BaoCaoNgay) và (NhuCauTuan) trên khóa (Tuần × Dự án × Chuyên viên):
  - Dòng chỉ có báo cáo (không có nhu cầu cho CV đó) → `kpi_giao=0`, fill_rate=None, `co_lech_chuyen_vien=True`.
  - Dòng chỉ có nhu cầu (CV chưa nhập báo cáo) → phễu=0, fill_rate=0, `co_lech_chuyen_vien=True`.
  - Cả hai trường hợp lệch → cảnh báo VR-W7 để OM rà soát (vd nhu cầu giao CV B nhưng CV A nhập báo cáo). **(giả định)** chưa tự phân bổ KPI giao giữa các CV; nếu PO muốn phân bổ cấp (Tuần×Dự án) rồi chia, bổ sung sau (mở rộng Q3).

### 7.3. Roll-up BaoCaoNgay → KPITuan — BR-R

| Mã | Quy tắc |
|---|---|
| BR-R1 | Khóa nhóm = Tuần × Dự án × Chuyên viên (Chi nhánh, Quản lý suy từ Dự án) |
| BR-R2 | `Đăng ký/Phỏng vấn/Đỗ PV/Đi làm = Σ` các chỉ số ngày (0 nếu không có báo cáo) |
| BR-R3 | Tỷ lệ tính SAU khi cộng dồn (từ tổng tuần), KHÔNG phải trung bình các tỷ lệ ngày |
| BR-R4 | **Chuẩn hóa tên dự án trước roll-up** qua Alias (BR-R4b thứ tự): HIP→HI-P, LuxshareBacGiang→Luxshare Bắc Giang, Canfoco CN→Canfoco |
| BR-R4b | Áp Xuong_Alias trước (Fuyu/Fulian/Fukang → xuong_id + du_an_id cha), sau đó DuAn_Alias |
| BR-R5 | Phương thức KHÔNG nằm trong khóa KPITuan (gộp mọi phương thức) — báo cáo theo phương thức lấy trực tiếp từ BaoCaoNgay, không từ KPITuan (xem 10.2.A) |
| BR-R6 | Roll-up theo **dự án cha**; báo cáo cấp xưởng được gộp lên cha nhưng **giữ nguyên `xuong_id`** ở bản ghi BaoCaoNgay gốc để không mất chi tiết (BR-X3) |
| BR-R7 | KPI giao lấy từ NhuCauTuan (FULL OUTER, BR-K8), không cộng dồn từ BaoCaoNgay |

### 7.4. Chính sách tuyển — BR-P

| Mã | Quy tắc |
|---|---|
| BR-P1 | Mỗi (Khách × Xưởng) = 1 dòng chính sách (UNIQUE) |
| BR-P2 | `Đơn vị` ∈ {/giờ, /người} quy định ngữ nghĩa `Đơn giá`; có Đơn giá thì bắt buộc Đơn vị |
| BR-P3 | Chỉ chính sách `Đang tuyển=Có` hiển thị cho tuyển/khớp nhu cầu (**giả định**) |
| BR-P4 | Lương cơ bản, Phụ cấp ≥ 0, cho phép null |
| BR-P5 | Có KTX ∈ {Có, Không} |
| BR-P6 | Yêu cầu = free text |
| BR-P7 | Đơn giá > 0 khi Đang tuyển=Có (soft, cảnh báo VR-W5) |
| BR-P8 | **Mọi tổng hợp/sắp xếp/so sánh đơn giá bắt buộc nhóm theo `don_vi`**; cấm trộn /giờ với /người ở tầng báo cáo |

### 7.5. Sinh lịch chăm sóc — BR-C

| Mã | Quy tắc |
|---|---|
| BR-C1 | KH **Trọng điểm** → mặc định Hoạt động=Gặp mặt, Tần suất=1 lần/tuần |
| BR-C2 | KH **Thường** → mặc định Hoạt động=Điện thoại, Tần suất=1 lần/tháng |
| BR-C3 | Quản lý của lịch = Quản lý phụ trách của KH (gợi ý, có thể đổi) |
| BR-C4 | Sinh "Ngày KH" kế tiếp theo `tan_suat_chu_ky` (5.3). **Mốc neo (Q2 chốt):** neo theo **lịch kế hoạch cố định** (cadence không drift), không neo theo ngày hoàn thành thực; làm bù trễ KHÔNG dời các mốc kế tiếp |
| BR-C5 | Hoạt động ∈ DanhMuc.loai_hoat_dong (cho đổi khác mặc định) |
| BR-C6 | Tần suất ∈ DanhMuc.tan_suat; "Khi cần" → không tự sinh lịch |
| BR-C7 | Lịch sử = append-only log (bảng ChamSoc_LichSu) |
| BR-C8 | Nếu `Ngày KH < hôm nay` AND Trạng thái ∈ {Chưa hoàn thành, Đang thực hiện} → auto **Quá hạn** |

### 7.6. Lão hóa công nợ — BR-D *(Q5 đã chốt: tách 2 trục)*

| Mã | Quy tắc / Công thức |
|---|---|
| BR-D1 | `Còn lại = Số tiền − Đã thu` (KC: 54.200.000 − 20.000.000 = 34.200.000) |
| BR-D2 | `Số ngày quá hạn = max(0, hôm nay − Ngày đến hạn)` |
| BR-D3 | `0 ≤ Đã thu ≤ Số tiền`; `Số tiền > 0`; `Còn lại ≥ 0` |
| BR-D4 | `Đã thu + Còn lại = Số tiền` (bất biến) |
| BR-D5 | Nếu `Số ngày quá hạn > 0` AND `Còn lại > 0` → `giai_doan_aging ≥ Nhắc lần 1` (không phải một trạng thái enum tên "truy thu") |
| BR-D7 | Kỳ công nợ dạng `T<MM>/<YYYY>` |
| BR-D8 | **Tỷ lệ thu hồi** (report-level) = `Đã thu / Số tiền` theo kỳ/khách; Số tiền=0 → None |
| BR-D9 | **ETL tách cột gộp "Khách hàng / Dự án":** nếu giá trị khớp `KhachHang.ten` → `khach_hang_id`, `du_an_id=null`; nếu khớp `DuAn.ten` → `du_an_id` và suy `khach_hang_id` từ DuAn; không khớp → quarantine review |

**BR-D6 — Tách 2 trục (computed, tự động):**

- **Trục thời gian** `giai_doan_aging` = ánh xạ `so_ngay_qua_han` qua `aging_threshold` (5.3). Chỉ phụ thuộc thời gian.
- **Trục thu tiền** `trang_thai_thu`:
  - `Đã thu = 0` → **Chưa thu**
  - `0 < Đã thu < Số tiền` → **Đã thu một phần**
  - `Đã thu = Số tiền` (Còn lại = 0) → **Đã thu đủ** (kết thúc tài chính)

**BR-D6b — Nhãn hợp nhất `giai_doan_truy_thu` (dẫn xuất, để tương thích enum gốc 8 giá trị):**
- Nếu `trang_thai_thu = Đã thu đủ` → "Đã thu đủ".
- Else nếu `trang_thai_thu = Đã thu một phần` → "Đã thu một phần".
- Else (Chưa thu) → ánh xạ trực tiếp từ `giai_doan_aging` (Chưa đến hạn / Nhắc lần 1 / Nhắc lần 2 / Gửi công văn / Đàm phán / Chuyển pháp lý).
- **Override:** người dùng (BM trở lên) có thể đặt thủ công `giai_doan_truy_thu` (vd "Đàm phán" khi đang thương lượng) — khi đã override, job nền **không ghi đè** giá trị thủ công, chỉ cập nhật 2 trục computed; UI hiển thị cờ "đã override".

> Việc tách 2 trục loại bỏ mâu thuẫn "vừa quá hạn 40 ngày vừa đã thu một phần": aging=Đàm phán, trạng thái thu=Đã thu một phần — hiển thị đồng thời, không tranh chấp một giá trị duy nhất.

### 7.7. Phân quyền & phụ trách — BR-O

| Mã | Quy tắc |
|---|---|
| BR-O1 | Mỗi DuAn có QL phụ trách + CV1 (bắt buộc) + CV2 (tùy chọn) |
| BR-O2 | **(MỀM)** QL phụ trách của KhachHang/CongNo/ChamSoc *nên* nhất quán với DuAn cùng khách; nếu lệch hoặc thiếu → **cảnh báo/gợi ý điền (VR-W1)**, KHÔNG tự đồng bộ ghi đè (mỗi sheet có cột Quản lý độc lập trong dữ liệu gốc) |
| BR-O3 | Vai trò ∈ DanhMuc.vai_tro |
| BR-O4 | Nhân sự Thử việc vẫn được gán phụ trách dự án |
| BR-O5 | Chuyên viên nên thuộc cùng chi nhánh dự án (soft, cảnh báo nếu lệch) |

### 7.8. Xưởng & lệch cấp — BR-X **(bổ sung)**

| Mã | Quy tắc |
|---|---|
| BR-X1 | `Xuong.du_an_id` **bắt buộc** — mọi xưởng phải gắn một dự án cha (đảm bảo báo cáo cấp xưởng luôn truy được du_an_id) |
| BR-X2 | Ràng buộc toàn vẹn: `Xuong.khach_hang_id` phải bằng `khach_hang_id` của `Xuong.du_an_id` (chống xưởng gắn nhầm khách) |
| BR-X3 | Bản ghi cấp xưởng (NhuCauTuan/BaoCaoNgay) **lưu đồng thời** `du_an_id` (cha) + `xuong_id` (chi tiết); roll-up theo cha, giữ chi tiết xưởng cho báo cáo |

### 7.9. Song ngữ & master — BR-M

| Mã | Quy tắc |
|---|---|
| BR-M1 | Mọi enum lấy từ DanhMuc; hiển thị song ngữ theo locale |
| BR-M2 | Dùng `ma_enum` kỹ thuật bất biến làm khóa, không dùng nhãn VI (vì vậy sửa nhãn "Tin nhắn/Zalo" an toàn) |
| BR-M3 | ZH optional; thiếu ZH → fallback VI |
| BR-M4 | `dich_vu` gắn ở cấp DuAn/KhachHang |
| BR-M5 | `phan_loai` ở ChamSoc là **computed** từ KhachHang.phan_loai hiện tại (không snapshot). Khách đổi loại → mặc định chăm sóc dẫn xuất tự đổi theo BR-C1/C2 cho các lịch **chưa hoàn thành**; lịch đã hoàn thành giữ nguyên lịch sử |

### 7.10. Validation Rules — VR

**Cứng (reject):**

| Mã | Quy tắc |
|---|---|
| VR-ENUM | Trường enum chỉ nhận giá trị (qua `ma_enum`) ∈ DanhMuc tương ứng |
| VR-INT | Chỉ số phễu, Nhu cầu KH, KPI giao: int ≥ 0 |
| VR-MONEY | Đơn giá/Lương/Phụ cấp/Số tiền/Đã thu ≥ 0 (số nguyên VNĐ) |
| VR-DATE | Ngày hợp lệ (Tuần được tính từ Ngày, không đối chiếu — BR-F6) |
| VR-KEY | Mã business key duy nhất theo prefix: NC####, BC#####, KPI####, CSK#####, CN###; sinh ở server (xem NFR offline) |
| VR-REQ | Bắt buộc: DuAn{Tên,Chi nhánh,KH,QL,CV1}; CongNo{Số tiền,Ngày đến hạn,Kỳ,KH}; BaoCaoNgay{Ngày,Dự án,Chuyên viên,4 chỉ số} |
| VR-FK | FK tham chiếu hợp lệ (sau chuẩn hóa alias) |
| VR-FUNNEL | Enforce BR-F1 |
| VR-MONEY2 | Enforce BR-D3 (Đã thu ≤ Số tiền) |
| VR-UNIT | Có Đơn giá thì bắt buộc Đơn vị |
| VR-BRANCH | Chi nhánh ∈ ChiNhanh |
| VR-XUONG | Enforce BR-X1 (Xuong.du_an_id bắt buộc) + BR-X2 (cùng khách) |

**Mềm (cảnh báo, không reject):**

| Mã | Quy tắc |
|---|---|
| VR-W1 | KhachHang/ChamSoc/CongNo thiếu Quản lý phụ trách hoặc lệch với DuAn cùng khách |
| VR-W2 | Tên Dự án/Xưởng không khớp canonical → gợi ý alias, đẩy hàng đợi review |
| VR-W3 | KPI giao=0 trong khi NhuCauTuan có nhu cầu |
| VR-W4 | Đi làm > Đỗ PV |
| VR-W5 | Đang tuyển=Có nhưng Đơn giá null/0 |
| VR-W6 | KPI giao > Nhu cầu KH |
| VR-W7 | Lệch chuyên viên giữa NhuCauTuan và BaoCaoNgay (co_lech_chuyen_vien=True) |

### 7.11. Test Vectors *(bổ sung — cho tính kiểm thử)*

Một bộ input nhất quán → output, dùng trực tiếp viết unit test. Mọi tỷ lệ làm tròn half-up 2 chữ số (BR-K5).

**KPI tuần (BR-K1/K2/K3/K8):**

| # | KPI giao | Đăng ký | Phỏng vấn | Đỗ PV | Đi làm | → fill_rate | chuyen_doi | ti_le_dau_pv | co_lech_cv |
|---|---|---|---|---|---|---|---|---|---|
| T1 | 100 | 6 | 6 | 5 | 4 | 0.04 (4%) | 0.6667 (66.67%) | 0.8333 (83.33%) | False |
| T2 | 100 | 11 | 6 | 6 | 10 | 0.10 (10%) | 0.9091 (90.91%) | 1.0000 (100%) | False |
| T3 | 0 | 5 | 3 | 2 | 1 | **None** | 0.20 (20%) | 0.6667 (66.67%) | True (chỉ có báo cáo) |
| T4 | 100 | 0 | 0 | 0 | 0 | 0.00 (0%) | **0** (Đăng ký=0) | **0** (Phỏng vấn=0) | True (chỉ có nhu cầu) |
| T5 | 50 | 80 | 70 | 65 | 60 | 1.20 (120%) | 0.7500 (75%) | 0.9286 (92.86%) | False |

**Công nợ (BR-D1/D2/D6) — giả sử hôm nay 2026-06-28:**

| # | Số tiền | Đã thu | Ngày đến hạn | → Còn lại | Số ngày quá hạn | giai_doan_aging | trang_thai_thu | giai_doan_truy_thu (D6b) |
|---|---|---|---|---|---|---|---|---|
| D1 | 54.200.000 | 20.000.000 | 2026-07-02 | 34.200.000 | 0 | Chưa đến hạn | Đã thu một phần | Đã thu một phần |
| D2 | 30.000.000 | 0 | 2026-06-20 | 30.000.000 | 8 | Nhắc lần 2 | Chưa thu | Nhắc lần 2 |
| D3 | 10.000.000 | 10.000.000 | 2026-05-01 | 0 | 58 | Đàm phán | Đã thu đủ | Đã thu đủ |
| D4 | 40.000.000 | 5.000.000 | 2026-04-01 | 35.000.000 | 88 | Chuyển pháp lý | Đã thu một phần | Đã thu một phần |

### 7.12. State Machines — SM

**SM-1 ChamSoc** {Chưa hoàn thành, Đang thực hiện, Hoàn thành, Quá hạn}

| Từ | Đến | Điều kiện |
|---|---|---|
| (mới) | Chưa hoàn thành | Sinh lịch |
| Chưa hoàn thành | Đang thực hiện | Bắt đầu liên hệ |
| Chưa HT / Đang TH | Hoàn thành | Xong → append nhật ký → sinh lịch kế tiếp |
| Chưa HT / Đang TH | Quá hạn | Ngày KH < hôm nay (auto BR-C8) |
| Quá hạn | Đang TH / Hoàn thành | Chăm sóc bù (không dời cadence — BR-C4) |

Cấm: Hoàn thành → Chưa hoàn thành; Quá hạn → Chưa hoàn thành.

**SM-2 CongNo — HAI máy trạng thái độc lập (Q5 chốt):**

- **Trục aging** `giai_doan_aging` (computed thuần theo thời gian): Chưa đến hạn → Nhắc 1 → Nhắc 2 → Gửi công văn → Đàm phán → Chuyển pháp lý. Đơn điệu tăng theo số ngày quá hạn; có thể quay lại "Chưa đến hạn" nếu ngày đến hạn được sửa.
- **Trục thu** `trang_thai_thu` (computed theo số tiền): Chưa thu → Đã thu một phần → Đã thu đủ (**kết thúc tài chính**). Có thể nhảy thẳng Chưa thu → Đã thu đủ.
- Hai trục **chạy song song**, không tranh chấp. "Chuyển pháp lý" thuộc trục aging, KHÔNG phải kết thúc tài chính. Nhãn hợp nhất `giai_doan_truy_thu` chỉ là dẫn xuất hiển thị (BR-D6b), có thể override thủ công có duyệt.

**SM-3 DuAn** {Đang vận hành, Tạm dừng}: (mới)→Đang vận hành; Đang vận hành⇄Tạm dừng. Khi Tạm dừng: không sinh NhuCauTuan/BaoCaoNgay mới, KPITuan để trống, lịch ChamSoc vẫn chạy. **(giả định)** đề xuất bổ sung "Đã kết thúc" (enum bổ sung Q7).

**SM-4 NhanSu** {Thử việc, Chính thức}: Thử việc → Chính thức. **(giả định)** đề xuất bổ sung "Đã nghỉ" (enum bổ sung Q7).

---

## 8. Luồng nghiệp vụ đầu–cuối

### Luồng A — Chu trình tuyển dụng theo tuần (LÕI HỆ THỐNG)

1. **Đầu tuần:** OM/BM vào **Nhu cầu tuần**, chọn tuần (vd 2026-W14), nhập Nhu cầu KH + KPI giao cho từng (Dự án × Chuyên viên) → khóa kế hoạch.
2. **Hằng ngày:** SPV vào **Báo cáo ngày**, chọn Dự án/Xưởng (dropdown) + Phương thức, nhập 4 số phễu; Tuần tự gắn theo Ngày.
3. **Tự động:** Hệ thống chuẩn hóa tên (Xuong_Alias→DuAn_Alias, BR-R4b), gộp xưởng→dự án cha giữ chi tiết xưởng (BR-X3/R6), roll-up **KPI tuần** bằng FULL OUTER JOIN với NhuCauTuan (BR-K8) + tính Fill rate/Chuyển đổi/Tỷ lệ đậu PV; đánh cờ lệch chuyên viên nếu có.
4. **Cuối tuần:** OM/BM review **KPI tuần**, sort Fill rate tăng dần → drill-down Báo cáo ngày tìm điểm phễu rụng; xử lý dòng "Lệch chuyên viên" → Dashboard tổng hợp.

### Luồng B — Thiết lập khách & sinh lịch chăm sóc

1. Tạo Khách → đặt Phân loại (Thường/Trọng điểm) → gán Quản lý.
2. Hệ thống auto-gen lịch **Chăm sóc**: Trọng điểm→Gặp mặt 1 lần/tuần; Thường→Điện thoại 1 lần/tháng (BR-C1/C2), neo theo cadence cố định (BR-C4).
3. Đến hạn → việc xuất hiện trong "hôm nay" của Quản lý → thực hiện → ghi nhật ký → Hoàn thành → sinh lịch kế tiếp.
4. Quá "Ngày KH" chưa làm → auto **Quá hạn** (BR-C8) → lên Dashboard.

### Luồng C — Truy thu công nợ bậc thang

1. Ghi nhận công nợ kỳ (Số tiền, Ngày đến hạn, Kỳ, Khách).
2. Job nền tính **Số ngày quá hạn** (BR-D2) → `giai_doan_aging` + `trang_thai_thu` (BR-D6) → nhãn hợp nhất gợi ý (BR-D6b).
3. OM liên hệ → nhập **Đã thu** (Còn lại tự tính BR-D1) + Ghi chú → có thể override Giai đoạn truy thu (qua duyệt).
4. Còn lại=0 → **Đã thu đủ** (đóng); aging>60 & còn lại>0 → leo thang **Chuyển pháp lý** (duyệt BM/BOD).

### Luồng D — Khai báo chính sách & tư vấn tuyển

1. Khai báo **Chính sách** theo xưởng (Đơn giá/Lương/Phụ cấp/KTX/Yêu cầu/Đang tuyển).
2. Khi tuyển, SPV tra "Đang tuyển=Có" → tư vấn ứng viên → đưa vào phễu → ghi **Báo cáo ngày**.
3. Chính sách đổi giá → BM duyệt → phản ánh tức thì.

### Luồng E — Lập dự án & phân bổ nguồn lực

1. Có Khách + Nhân sự → tạo **Dự án** (1 KH × 1 chi nhánh), gán 1 QL + 1–2 CV (bảng nối), đặt Phân loại + Dòng dịch vụ; khai báo Xưởng con (gắn du_an_id cha).
2. Dự án "Đang vận hành" → đủ điều kiện nhận **Nhu cầu tuần** → vào Luồng A.
3. Theo dõi KPI → tái phân bổ team (xem workload ở module Nhân sự).

---

## 9. Phân quyền (RBAC + Data Scoping)

### 9.1. Nguyên tắc

- **Role** = "làm được gì"; **Scope** = "làm trên dữ liệu của ai" (Chi nhánh + người phụ trách); **ABAC** bổ trợ (Trạng thái NV, Trạng thái DA, Phân loại, khóa sổ thời gian).
- **Quy ước ký hiệu ô (v1.1 chuẩn hóa):** ✅ full trong scope · 🔵 scope hẹp (chỉ bản ghi mình phụ trách/của mình) · ⛔ không quyền · **A** phải qua duyệt. **Không dùng ký hiệu "X" cho giá trị ô.** Cột Action: X=Xem, T=Tạo, S=Sửa, D=Xóa, A=Duyệt.

### 9.2. Ma trận quyền theo module

**Nghiệp vụ cốt lõi:**

| Module | Action | ADMIN | BOD | BM | OM | SPV |
|---|---|:--:|:--:|:--:|:--:|:--:|
| NhanSu | X | ✅ | ✅ | 🔵 | 🔵 | 🔵 (hồ sơ mình) |
| NhanSu | T/S/D | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |
| KhachHang | X | ✅ | ✅ | 🔵 | 🔵 | 🔵 |
| KhachHang | T/S | ✅ | ⛔ | ✅ | 🔵 | ⛔ |
| KhachHang | D | ✅ | ⛔ | ✅ | ⛔ | ⛔ |
| DuAn | X | ✅ | ✅ | 🔵 | 🔵 | 🔵 |
| DuAn | T | ✅ | ⛔ | ✅ | A | ⛔ |
| DuAn | S | ✅ | ⛔ | ✅ | 🔵 | ⛔ |
| DuAn | D/Tạm dừng | ✅ | ⛔ | ✅ | A | ⛔ |
| ChinhSach | X | ✅ | ✅ | 🔵 | 🔵 | 🔵 |
| ChinhSach | T/S | ✅ | ⛔ | ✅ | 🔵 | ⛔ |
| ChinhSach | A(giá/lương) | ✅ | ⛔ | ✅ | ⛔ | ⛔ |

**Tác nghiệp tuyển dụng:**

| Module | Action | ADMIN | BOD | BM | OM | SPV |
|---|---|:--:|:--:|:--:|:--:|:--:|
| NhuCauTuan | X | ✅ | ✅ | 🔵 | 🔵 | 🔵 |
| NhuCauTuan | T/S (KPI giao) | ✅ | ⛔ | ✅ | ✅ | ⛔ |
| BaoCaoNgay | X | ✅ | ✅ | 🔵 | 🔵 | 🔵 (mình nhập) |
| BaoCaoNgay | T | ✅ | ⛔ | ✅ | ✅ | ✅ (CV=mình) |
| BaoCaoNgay | S | ✅ | ⛔ | ✅ | 🔵 | 🔵 (trong cửa sổ T+1, BR-F7) |
| KPITuan | X | ✅ | ✅ | 🔵 | 🔵 | 🔵 |
| KPITuan | T/S/D | ✅ (re-calc) | ⛔ | ⛔ | ⛔ | ⛔ |

**Quan hệ KH & tài chính + Quản trị:**

| Module | Action | ADMIN | BOD | BM | OM | SPV |
|---|---|:--:|:--:|:--:|:--:|:--:|
| ChamSoc | X | ✅ | ✅ | 🔵 | 🔵 | ⛔ |
| ChamSoc | T/S | ✅ | ⛔ | ✅ | 🔵 | ⛔ |
| ChamSoc | A(hoàn thành) | ✅ | ⛔ | ✅ | 🔵 | ⛔ |
| CongNo | X | ✅ | ✅ | 🔵 | 🔵 | ⛔ |
| CongNo | T/S | ✅ | ⛔ | ✅ | 🔵 | ⛔ |
| CongNo | A(thu/pháp lý/override giai đoạn) | ✅ | ⛔ | ✅ | ⛔ | ⛔ |
| DanhMuc / Config | X | ✅ | ✅ | ✅ | ✅ | ✅ (read-only, dropdown dùng chung) |
| DanhMuc / Config | T/S/D | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |
| ChiNhanh | X | ✅ | ✅ | ✅ | 🔵 | 🔵 |
| ChiNhanh | T/S/D | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |
| Xuong | X | ✅ | ✅ | 🔵 | 🔵 | 🔵 |
| Xuong | T/S | ✅ | ⛔ | ✅ | 🔵 | ⛔ |
| DuAn_Alias / Xuong_Alias | X/T/S/D | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |

KPITuan **read-only tuyệt đối** với mọi role nghiệp vụ. DanhMuc/Config chỉ ADMIN ghi; mọi role **đọc được** (enum song ngữ là dropdown dùng chung). Alias chỉ ADMIN quản trị.

### 9.3. Data Scoping

| Role | Phạm vi row-level |
|---|---|
| ADMIN | Tất cả + cấu hình |
| BOD | Tất cả, read-only + duyệt cấp cao |
| BM | `record.chi_nhanh == user.chi_nhanh` (mọi bản ghi trong chi nhánh) |
| OM | cùng chi nhánh AND (mình phụ trách OR thuộc dự án mình QL OR CV dưới quyền) |
| SPV | bản ghi gắn trực tiếp tên mình (CV) |

**Cột scope theo module:**

| Module | Scope chi nhánh | Scope OM | Scope SPV |
|---|---|---|---|
| KhachHang | chi_nhanh_id | quan_ly_phu_trach_id | qua dự án |
| DuAn | chi_nhanh_id | quan_ly_phu_trach_id | DuAn_NhanSu |
| NhuCauTuan | chi_nhanh_id | quan_ly_id | chuyen_vien_id |
| BaoCaoNgay | chi_nhanh_id | qua dự án mình QL | chuyen_vien_id |
| KPITuan | chi_nhanh_id | quan_ly_id | chuyen_vien_id |
| ChamSoc | KH→chi_nhanh_id | quan_ly_id | — |
| CongNo | chi_nhanh_id | quan_ly_phu_trach_id | — |
| ChinhSach | KH→chi_nhanh_id | KH của mình | KH dự án mình |

**Cảnh báo:** ChamSoc/ChinhSach không có cột chi nhánh trực tiếp → JOIN qua KhachHang.chi_nhanh_id. **Bản ghi mồ côi** (KH thiếu Quản lý phụ trách) → chỉ BM/ADMIN thấy + cảnh báo cần gán. **Bắt buộc dùng ID, không khớp tên** (chống rò rỉ/bỏ sót do bất nhất tên).

### 9.4. Định nghĩa "CV dưới quyền OM"

Trước mắt suy ra từ quan hệ dự án: CV dưới quyền OM = nhân sự ở `DuAn_NhanSu` của các dự án mà OM là QL phụ trách. **Khuyến nghị** dùng `NhanSu.quan_ly_truc_tiep_id` để tường minh (tránh sai khi 1 CV làm nhiều dự án thuộc nhiều OM).

### 9.5. Luồng duyệt (Approval)

| Luồng | Đề xuất | Duyệt |
|---|---|---|
| Đặt/đổi Đơn giá/Lương/Phụ cấp | OM | BM/ADMIN |
| Đóng công nợ / ghi nhận Đã thu / giảm trừ | OM | BM |
| Override Giai đoạn truy thu | OM | BM |
| Chuyển pháp lý | OM/BM | BM/BOD |
| Tạm dừng dự án | OM | BM |
| Tạo dự án/khách hàng mới | OM | BM/ADMIN |
| Sửa DanhMuc/Config/Alias | — | ADMIN |
| Đánh giá Hoàn thành chăm sóc | SPV/OM | OM |

---

## 10. Báo cáo & Dashboard

### 10.1. Dashboard theo vai trò

| Vai trò | Trọng tâm |
|---|---|
| BM / OM | Toàn chi nhánh/dự án: KPI tuần, công nợ quá hạn, chăm sóc quá hạn |
| SPV | Cá nhân: việc chăm sóc hôm nay, báo cáo ngày cần nhập, KPI dự án mình |
| BOD | Toàn công ty: tổng KPI, công nợ, fill rate theo chi nhánh |

### 10.2. Bộ widget/báo cáo

**A. Tuyển dụng & KPI**
- Fill rate theo Chi nhánh / Chuyên viên / Dự án (tuần hiện tại + xu hướng nhiều tuần) — nguồn KPITuan.
- Phễu tổng hợp (Đăng ký → Phỏng vấn → Đỗ PV → Đi làm) + tỷ lệ rụng từng bước.
- Tỷ lệ chuyển đổi (Đi làm/Đăng ký) & Tỷ lệ đậu PV (Đỗ PV/Phỏng vấn) — xếp hạng chuyên viên.
- **Hiệu quả theo Phương thức** (Trực tiếp vs Đối tác vs Giới thiệu nội bộ) — **tính trực tiếp từ BaoCaoNgay** (KPITuan đã gộp phương thức, BR-R5), hoặc qua roll-up phụ Tuần×Dự án×Phương thức.
- KPI giao vs Đi làm thực tế theo tuần (gap analysis); cảnh báo dòng "Lệch chuyên viên".

**B. Công nợ**
- Tổng Còn lại & **Aging buckets** (tham chiếu `aging_threshold` 5.3: 1–7 / 8–15 / 16–30 / 31–60 / >60 ngày — một nguồn ngưỡng duy nhất).
- Top khách nợ quá hạn; Công nợ theo Giai đoạn aging × Trạng thái thu (ma trận 2 trục); theo Quản lý.
- Tỷ lệ thu hồi = Đã thu / Số tiền theo kỳ (BR-D8).

**C. Chăm sóc khách hàng**
- Số việc Quá hạn / Đến hạn hôm nay / tuần này; tỷ lệ Hoàn thành đúng hạn theo Quản lý.
- Độ phủ chăm sóc khách Trọng điểm (% được chăm đúng tần suất).

**D. Chất lượng dữ liệu** *(rất cần do dữ liệu bất nhất)*
- Khách thiếu Quản lý phụ trách.
- Dự án/Xưởng trong Báo cáo ngày không khớp master (HIP/HI-P…) → hàng đợi alias.
- Tuần có KPI giao=0 dẫn tới Fill rate trống; dòng Lệch chuyên viên.
- Dự án Đang vận hành nhưng không có Báo cáo ngày trong tuần.

---

## 11. Yêu cầu phi chức năng (NFR)

| Nhóm | Yêu cầu |
|---|---|
| **Hiệu năng** | Quy mô hiện tại nhỏ (BaoCaoNgay ~1048 dòng, sheet khác ≤40). Xử lý mượt tới vài chục nghìn dòng (dự phòng 1–2 năm, **giả định** ~1k dòng/tháng). Index trên `(tuan, du_an_id, chuyen_vien_id)`; roll-up KPI chạy nền (upsert). Mục tiêu **(giả định)**: mở danh sách < 1s, báo cáo tuần < 3s @ 50k dòng. |
| **Song ngữ** | i18n toàn diện VI–中文 (nhãn UI, enum, thông báo lỗi). Lưu Unicode NFC; font hỗ trợ tiếng Việt có dấu + Hán tự. Dữ liệu nghiệp vụ hiển thị song ngữ khi có, fallback VI. Tên khách hàng (ten_trung) ưu tiên thấp, fallback tên gốc. |
| **Phân quyền** | RBAC + ABAC + row-level security theo chi nhánh/người phụ trách. CongNo kiểm soát chặt. |
| **Audit log** | Ghi mọi CUD nhạy cảm (ai/khi nào/cũ→mới): CongNo, KPI giao, override KPITuan/giai_doan_truy_thu, đổi DanhMuc/Config/alias. |
| **Sinh mã hiển thị** | Mã `NC/BC/KPI/CSK/CN` sinh ở **server** khi tạo/đồng bộ (không sinh ở client offline để tránh đụng độ). Tách định danh nội bộ (surrogate ID) khỏi mã hiển thị; zero-pad động khi vượt độ rộng (BC##### → mở rộng số chữ số khi cần). |
| **Offline** *(giả định, Q10)* | Nếu là Mini App hiện trường: nhập BaoCaoNgay offline + đồng bộ; hàng đợi đồng bộ, chống xung đột (last-write-wins có cảnh báo); mã hiển thị cấp khi đồng bộ về server. Cần xác nhận có thực sự cần. |
| **Backup/DR** | Sao lưu hằng ngày + point-in-time **(giả định 30 ngày)**; RPO ≤ 24h, RTO ≤ 4h **(giả định)**. Export Excel cho đối soát/backup logic. |
| **Toàn vẹn tiền tệ** | Số nguyên VNĐ, không float. |
| **Múi giờ & tuần** | Asia/Ho_Chi_Minh; tuần ISO `YYYY-Www`, bắt đầu Thứ Hai. |

---

## 12. Chất lượng dữ liệu, chuẩn hóa & Migration

### 12.1. Danh sách bất nhất cần xử lý

| # | Vấn đề | Bằng chứng | Mức | Hành động |
|---|---|---|---|---|
| I1 | FK bằng tên (natural key mong manh) | "Phùng Minh HIếu" | Cao | Thêm surrogate ID, mọi FK qua ID |
| I2 | Tên dự án bất nhất | HIP/HI-P, LuxshareBacGiang/Luxshare Bắc Giang, Canfoco CN/Canfoco | Cao | DuAn_Alias + dropdown bắt buộc |
| I3 | Lệch cấp chi tiết | Fuyu/Fulian/Fukang không có trong DuAn | Cao | Bổ sung thực thể Xuong + Xuong_Alias; lưu đồng thời du_an_id+xuong_id |
| I4 | KPI giao bất nhất | NhuCauTuan=100 vs KPITuan W15/W16=0 | TB | **(giả định, chờ Q3)** Single source = NhuCauTuan + FULL OUTER JOIN + audit; KHÔNG khẳng định bên nào đúng |
| I5 | Bẫy đặt tên Đỗ PV/Đổ PV | cột 10 số người vs cột 14 tỷ lệ | TB | `do_pv_so_nguoi` / `ti_le_dau_pv` |
| I6 | FK đa hình mơ hồ | CongNo cột gộp KH/Dự án | TB | Tách khach_hang_id + du_an_id (ETL BR-D9) |
| I7 | Dư thừa phan_loai | lặp ở KhachHang/DuAn/ChamSoc | TB | Nguồn = KhachHang; ChamSoc computed (BR-M5); DuAn giữ cột gốc nhưng coi KhachHang là chuẩn |
| I8 | Enum thiếu | don_vi_don_gia, chi_nhanh, trang_thai_thu, giai_doan_aging | TB | Bổ sung nhóm DanhMuc (5.2); `xuong` là thực thể không phải enum |
| I9 | Enum mồ côi | Quản lý chi nhánh chưa có người; dich_vu chưa gắn | Thấp | Chấp nhận; gắn dich_vu vào DuAn/KhachHang |
| I10 | Trường dẫn xuất nhập tay | con_lai, so_ngay_qua_han, fill_rate, aging, thu_status | TB | Đánh dấu computed, khóa nhập tay |
| I11 | Quan hệ n-n bị dẹt | 2 cột Chuyên viên | Thấp | Bảng nối DuAn_NhanSu |
| I12 | Null trường có thể bắt buộc | KhachHang.quan_ly_phu_trach | Thấp | Cảnh báo (VR-W1), xác nhận chính sách; KHÔNG tự đồng bộ (BR-O2 mềm) |
| I13 | Cột dự trữ rỗng | NhuCauTuan I–T | Thấp | Không di trú |
| I14 | Nhãn enum lệch | "Tin nhắn/Zalo" vs "Tin nhắn-Zalo" | TB | Dùng đúng chuỗi gốc + ma_enum khóa |
| I15 | Chiến lược khóa không đồng nhất | master int vs transaction mã chuỗi | Thấp | Mọi thực thể có surrogate ID; mã chuỗi là business key UNIQUE |

### 12.2. Bảng ánh xạ tên (alias → canonical)

| Bí danh (raw) | Tên/Thực thể chuẩn | Loại | Bảng alias |
|---|---|---|---|
| HIP | HI-P | DuAn | DuAn_Alias |
| LuxshareBacGiang | Luxshare Bắc Giang | DuAn | DuAn_Alias |
| Canfoco CN | Canfoco | DuAn | DuAn_Alias |
| Fuyu / Fulian / Fukang | Xưởng thuộc Foxconn (gắn du_an_id Foxconn) | Xưởng | Xuong_Alias |

### 12.3. Pipeline chuẩn hóa chuỗi

1. Trim + gộp khoảng trắng thừa.
2. Chuẩn hóa Unicode NFC (tiếng Việt có dấu).
3. Sửa casing bất thường (HIếu→Hiếu) — **(giả định)** cần từ điển tên riêng.
4. Đối chiếu **Xuong_Alias trước, rồi DuAn_Alias** (BR-R4b); khớp → thay canonical (kèm du_an_id cha).
5. Không khớp → hàng đợi review (không tự gộp).

### 12.4. Quy trình ETL & chính sách dòng lỗi

**Pipeline:** Staging (raw + truy vết dòng nguồn) → Profiling (đếm null/distinct/alias/trùng) → Cleansing (pipeline + alias) → Validation (Mục 7.10) → Load (sinh ID + mã hiển thị) → Reconciliation (đối chiếu tổng dòng, tổng tiền CongNo, tổng Đi làm).

| Mức | Ví dụ | Hành động |
|---|---|---|
| Tự sửa an toàn | trim, NFC, alias đã duyệt | Sửa + log |
| Cần duyệt | tên lạ chưa map, casing nghi ngờ, cột gộp KH/Dự án không khớp | Hàng đợi review, không tự gộp |
| Chặn | vi phạm FK, vi phạm phễu, Đã thu > Số tiền, Xuong vi phạm BR-X2 | Quarantine, không load |

**Bất biến migration:** Idempotent (chạy lại không tạo trùng — upsert theo business key/khóa tự nhiên); không phá hủy (giữ raw để rollback); truy vết nguồn (`nguon_file`, `nguon_sheet`, `nguon_dong`).

### 12.5. Top rủi ro ưu tiên

| Ưu tiên | Vấn đề | Hành động |
|---|---|---|
| P0 | KPI giao 100 vs 0 | (giả định) Single source NhuCauTuan + FULL OUTER + audit; chốt Q3 |
| P0 | Naming drift (HIP/Luxshare/Canfoco/Fuyu) | Alias map (Du/Xuong) + dropdown khóa |
| P1 | Thiếu thực thể Xưởng | Bổ sung bảng Xuong + ràng buộc BR-X1/X2 |
| P1 | Không có FK/khóa | Migrate sang ID + FK |
| P2 | Đi làm > Đỗ PV | Làm rõ định nghĩa trước khi đặt CHECK (Q4) |
| P2 | Null Quản lý phụ trách | Cảnh báo + làm sạch (không tự đồng bộ) |
| P3 | Cột dự trữ, cột Đỗ/Đổ PV, nhãn Zalo | Không migrate / đổi tên rõ / sửa nhãn gốc |

---

## 13. Phụ lục: User Stories chính & Tiêu chí chấp nhận

### US-01 — Nhập báo cáo ngày (SPV)
> Là **Chuyên viên vận hành**, tôi muốn nhập nhanh phễu tuyển dụng cuối ngày để theo dõi tiến độ.

**Tiêu chí chấp nhận:**
- Chọn Dự án/Xưởng từ dropdown (không gõ tự do); Tuần tự gắn theo Ngày (computed).
- Hệ thống chặn lưu nếu Đăng ký < Phỏng vấn hoặc Phỏng vấn < Đỗ PV (BR-F1).
- Nếu Đi làm > Đỗ PV → vẫn lưu nhưng hiện cảnh báo (VR-W4).
- Bản ghi tự gán `chuyen_vien_id = tôi`; thời gian nhập < 30 giây.
- Sửa được trong cửa sổ T+1 (BR-F7), quá hạn chuyển BM.

### US-02 — Xem KPI tuần & tìm điểm yếu (OM)
> Là **Quản lý vận hành**, tôi muốn xem KPI tuần đã roll-up để biết dự án/chuyên viên nào fill thấp.

**Tiêu chí chấp nhận:**
- KPITuan = Σ BaoCaoNgay theo Tuần×Dự án×Chuyên viên (BR-R2), FULL OUTER JOIN với NhuCauTuan (BR-K8).
- Fill rate = Đi làm/KPI giao; nếu KPI giao=0 → ô trống (BR-K1). Test vectors T1–T5 (7.11) phải pass.
- Chuyển đổi = Đi làm/Đăng ký; Đăng ký=0 → 0 (BR-K2).
- Tỷ lệ đậu PV = Đỗ PV/Phỏng vấn (BR-K3), nhãn cột "Tỷ lệ đậu PV".
- Dòng lệch chuyên viên được đánh cờ và lọc được.
- Sort được theo Fill rate tăng dần; drill-down sang Báo cáo ngày.
- Không cho sửa tay số liệu (read-only).

### US-03 — Sinh & theo dõi lịch chăm sóc (OM)
> Là **Quản lý vận hành**, tôi muốn hệ thống tự tạo lịch chăm sóc theo phân loại khách.

**Tiêu chí chấp nhận:**
- KH Trọng điểm → Gặp mặt, 1 lần/tuần; KH Thường → Điện thoại, 1 lần/tháng (BR-C1/C2).
- Hoàn thành 1 lượt → ghi nhật ký (append, ChamSoc_LichSu) → sinh lịch kế tiếp theo cadence cố định (BR-C4, không drift).
- Ngày KH < hôm nay & chưa hoàn thành → auto Quá hạn (BR-C8).
- Khách đổi phân loại → lịch chưa hoàn thành cập nhật mặc định mới (BR-M5).

### US-04 — Truy thu công nợ (OM)
> Là **Quản lý vận hành**, tôi muốn theo dõi công nợ quá hạn và cập nhật tiến độ thu.

**Tiêu chí chấp nhận:**
- Còn lại = Số tiền − Đã thu (BR-D1); chặn nếu Đã thu > Số tiền (BR-D3).
- Số ngày quá hạn = max(0, hôm nay − Ngày đến hạn) (BR-D2), tính tự động.
- `giai_doan_aging` và `trang_thai_thu` tính tự động, hiển thị song song (BR-D6); test vectors D1–D4 (7.11) phải pass.
- Còn lại=0 → trạng thái thu = "Đã thu đủ".
- Override `giai_doan_truy_thu` thủ công cần duyệt; job không ghi đè giá trị override.
- Chuyển pháp lý cần BM/BOD duyệt.

### US-05 — Nhập nhu cầu & KPI giao theo tuần (OM/BM)
> Là **Quản lý**, tôi muốn nhập nhu cầu KH và KPI giao cho từng dự án/chuyên viên theo tuần.

**Tiêu chí chấp nhận:**
- Chế độ nhập hàng loạt: chọn tuần → list dự án đang vận hành → nhập từng dòng theo chuyên viên.
- KPI giao ở đây là **nguồn sự thật** (giả định Q3), đồng bộ sang KPITuan theo (Tuần×Dự án×Chuyên viên) (BR-K7).
- Cảnh báo nếu KPI giao=0 mà có nhu cầu (VR-W3); cảnh báo KPI giao > Nhu cầu KH (VR-W6).

### US-06 — Quản trị danh mục song ngữ & cấu hình (ADMIN)
> Là **Quản trị hệ thống**, tôi muốn quản lý enum song ngữ và ngưỡng cấu hình dùng chung.

**Tiêu chí chấp nhận:**
- CRUD theo nhóm; không xóa giá trị đang được tham chiếu (chỉ ẩn `dang_su_dung`).
- Mỗi giá trị có `ma_enum` bất biến + `gia_tri` (VI) + `ten_trung` (ZH) + `thu_tu`.
- Sửa được bảng ngưỡng aging và quy đổi tần suất (5.3) — phản ánh ở BR-D6/SM-2/Dashboard.
- Thay đổi phản ánh tức thì ở mọi dropdown.

### US-07 — Phân quyền theo chi nhánh & người phụ trách
> Là người dùng, tôi chỉ thấy dữ liệu trong phạm vi của mình.

**Tiêu chí chấp nhận:**
- SPV chỉ thấy bản ghi gắn tên mình; OM thấy mình + CV dưới quyền cùng chi nhánh; BM thấy toàn chi nhánh; BOD/ADMIN thấy tất cả.
- Scope dùng ID, không khớp tên (chống rò rỉ do bất nhất).
- Bản ghi mồ côi (thiếu Quản lý phụ trách) chỉ BM/ADMIN thấy + cảnh báo.
- Mọi role đọc được DanhMuc/Config (dropdown dùng chung).

### US-08 — Quản trị thực thể nền Xưởng & Alias (ADMIN/BM)
> Là **ADMIN/BM**, tôi muốn quản trị Xưởng và duyệt ánh xạ tên để giữ master sạch.

**Tiêu chí chấp nhận:**
- Tạo/sửa Xưởng bắt buộc gán dự án cha (BR-X1) và cùng khách (BR-X2, chặn nếu vi phạm).
- Tên thô chưa map từ ETL/nhập liệu vào hàng đợi review; ADMIN duyệt → áp lại cho bản ghi chờ.
- Áp Xuong_Alias trước DuAn_Alias (BR-R4b).

---

*Hết tài liệu SRS-CRM-MINIAPP-v1.1. Các điểm **(giả định)** (tổng hợp tại Mục 1.6) cần Chủ sản phẩm xác nhận trước khi chốt build; phần không gắn nhãn bám trực tiếp vào cấu trúc & giá trị của 10 sheet nguồn và các công thức đã kiểm chứng (Test Vectors Mục 7.11).*