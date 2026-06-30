/**
 * 00_Config.gs — Khai báo SCHEMA + dữ liệu nền (seed)
 * Labor CRM trên Apps Script + Google Sheets.
 *
 * Quy ước:
 *  - Mỗi entity = 1 sheet. Cột đầu luôn là `name` (PK, sinh tự động).
 *  - FK lưu giá trị `name` của bản ghi được trỏ (KHÔNG lưu tên hiển thị).
 *  - Enum lưu `enum_code` (tham chiếu sheet CategoryValue).
 *  - Child table = sheet riêng có cột `parent`.
 */

var TZ = 'Asia/Ho_Chi_Minh';

/* Cách sinh name: 'series:PREFIX-' (NS-00001), 'field:branch_name', 'hash', 'group_enum' */
var SCHEMA = {
  // ----- Master Data -----
  Branch: {
    sheet: 'Branch', naming: 'field:name',
    headers: ['name', 'name_zh', 'branch_code', 'region', 'is_active']
  },
  Staff: {
    sheet: 'Staff', naming: 'series:NS-',
    headers: ['name', 'full_name', 'full_name_zh', 'branch', 'vai_tro', 'trang_thai',
              'user', 'quan_ly_truc_tiep', 'email', 'phone', 'is_active']
  },
  Customer: {
    sheet: 'Customer', naming: 'series:KH-',
    headers: ['name', 'customer_name', 'customer_name_zh', 'customer_code', 'branch',
              'phan_loai', 'dich_vu', 'quan_ly_phu_trach', 'is_active']
  },
  Project: {
    sheet: 'Project', naming: 'series:PRJ-',
    headers: ['name', 'project_name', 'project_name_zh', 'customer', 'branch', 'phan_loai',
              'dich_vu', 'quan_ly_phu_trach', 'trang_thai', 'is_active']
  },
  ProjectSpecialist: {
    sheet: 'ProjectSpecialist', naming: 'hash', child: true,
    headers: ['name', 'parent', 'specialist', 'specialist_name', 'vai_tro_trong_du_an']
  },
  Workshop: {
    sheet: 'Workshop', naming: 'series:WS-',
    headers: ['name', 'workshop_name', 'workshop_name_zh', 'workshop_code', 'project',
              'customer', 'branch', 'parent_workshop', 'is_group', 'status', 'merged_into',
              'recruiting', 'has_dormitory', 'notes']
  },
  CategoryValue: {
    sheet: 'CategoryValue', naming: 'group_enum',
    headers: ['name', 'category_group', 'enum_code', 'gia_tri', 'ten_trung', 'display_order', 'is_enabled']
  },
  WorkshopAlias: {
    sheet: 'WorkshopAlias', naming: 'hash',
    headers: ['name', 'alias', 'alias_normalized', 'workshop']
  },
  ProjectAlias: {
    sheet: 'ProjectAlias', naming: 'hash',
    headers: ['name', 'alias', 'alias_normalized', 'project']
  },
  NameQueue: {
    sheet: 'NameQueue', naming: 'hash',
    headers: ['name', 'raw_text', 'raw_normalized', 'context', 'suggested', 'status', 'created']
  },

  // ----- Recruitment -----
  WeeklyDemand: {
    sheet: 'WeeklyDemand', naming: 'series:NC-',
    headers: ['name', 'ma', 'tuan', 'chi_nhanh', 'du_an', 'xuong', 'quan_ly', 'chuyen_vien',
              'nhu_cau_kh_tuan', 'kpi_giao']
  },
  DailyReport: {
    sheet: 'DailyReport', naming: 'series:BC-',
    headers: ['name', 'ma', 'ngay', 'tuan', 'du_an', 'xuong', 'chi_nhanh', 'phuong_thuc',
              'chuyen_vien', 'dang_ky', 'phong_van', 'do_pv', 'di_lam', 'nhap_tre', 'docstatus']
  },
  WeeklyKPI: {
    sheet: 'WeeklyKPI', naming: 'hash',
    headers: ['name', 'tuan', 'chi_nhanh', 'du_an', 'quan_ly', 'chuyen_vien', 'kpi_giao',
              'nhu_cau_kh', 'dang_ky', 'phong_van', 'do_pv_so_nguoi', 'di_lam',
              'fill_rate', 'chuyen_doi', 'ti_le_dau_pv', 'dat_nhu_cau', 'co_lech_chuyen_vien']
  },
  Policy: {
    sheet: 'Policy', naming: 'series:CS-',
    headers: ['name', 'ma', 'khach_hang', 'xuong', 'du_an', 'dang_tuyen', 'don_gia', 'don_vi',
              'yeu_cau', 'luong_co_ban', 'phu_cap', 'co_ktx']
  },
  KpiRecomputeLog: {
    sheet: 'KpiRecomputeLog', naming: 'series:KRL-',
    headers: ['name', 'tuan', 'so_dong', 'nguoi', 'thoi_diem']
  },

  // ----- CRM -----
  CareTask: {
    sheet: 'CareTask', naming: 'series:CSK-',
    headers: ['name', 'ma', 'khach_hang', 'chi_nhanh', 'quan_ly', 'hoat_dong', 'tan_suat',
              'ngay_kh', 'noi_dung', 'mocneo_cadence', 'workflow_state']
  },
  CareLog: {
    sheet: 'CareLog', naming: 'hash', child: true,
    headers: ['name', 'parent', 'thoi_diem', 'noi_dung', 'nguoi_thuc_hien', 'ket_qua']
  },

  // ----- Finance -----
  Receivable: {
    sheet: 'Receivable', naming: 'series:CN-',
    headers: ['name', 'ma', 'chi_nhanh', 'khach_hang', 'du_an', 'quan_ly_phu_trach', 'ky_cong_no',
              'so_tien', 'ngay_den_han', 'da_thu', 'con_lai', 'so_ngay_qua_han', 'giai_doan_aging',
              'trang_thai_thu', 'giai_doan_truy_thu', 'giai_doan_override', 'ty_le_thu_hoi',
              'workflow_state', 'ghi_chu']
  },
  ReceivableLog: {
    sheet: 'ReceivableLog', naming: 'hash', child: true,
    headers: ['name', 'parent', 'thoi_diem', 'so_tien_thu', 'giai_doan', 'nguoi_thuc_hien', 'noi_dung']
  },

  // ----- Auth / Settings / Audit -----
  Users: {
    sheet: 'Users', naming: 'field:user_email',
    headers: ['name', 'user_email', 'active', 'role', 'staff_id', 'branch_id', 'display_name', 'locale', 'created_at']
  },
  Settings: {
    sheet: 'Settings', naming: 'field:name',
    headers: ['name', 'value']
  },
  AgingThreshold: {
    sheet: 'AgingThreshold', naming: 'hash', child: true,
    headers: ['name', 'giai_doan_aging', 'tu_ngay', 'den_ngay']
  },
  CareFrequency: {
    sheet: 'CareFrequency', naming: 'hash', child: true,
    headers: ['name', 'tan_suat', 'cadence_type', 'chu_ky_ngay']
  },
  AuditLog: {
    sheet: 'AuditLog', naming: 'hash',
    headers: ['name', 'thoi_diem', 'nguoi', 'doctype', 'docname', 'action',
              'truong', 'gia_tri_cu', 'gia_tri_moi']
  }
};

/* ===== Seed: CategoryValue (enum song ngữ) — theo Kiến trúc 12.5 ===== */
/* mỗi mục: [enum_code, gia_tri(VI), ten_trung(ZH)] */
var SEED_CATEGORY = {
  vai_tro: [
    ['branch_manager', 'Quản lý chi nhánh', '分公司经理'],
    ['ops_manager', 'Quản lý vận hành', '运营主管'],
    ['ops_specialist', 'Chuyên viên vận hành', '运营专员'],
    ['bod', 'Ban lãnh đạo', '董事会'],
    ['admin', 'Quản trị hệ thống', '系统管理员']
  ],
  trang_thai_nv: [
    ['chinh_thuc', 'Chính thức', '正式'],
    ['thu_viec', 'Thử việc', '试用']
  ],
  phan_loai_kh: [
    ['thuong', 'Thường', '普通'],
    ['trong_diem', 'Trọng điểm', '重点']
  ],
  trang_thai_da: [
    ['dang_van_hanh', 'Đang vận hành', '运营中'],
    ['tam_dung', 'Tạm dừng', '暂停']
  ],
  dich_vu: [
    ['gioi_thieu', 'Giới thiệu lao động', '代理招聘'],
    ['cho_thue_lai', 'Cho thuê lại (ngắn hạn)', '岗位外包（短期）'],
    ['eor', 'EOR – nhân sự', '人事代理']
  ],
  phuong_thuc: [
    ['truc_tiep', 'Trực tiếp', '直接招聘'],
    ['doi_tac', 'Đối tác', '市场合作'],
    ['noi_bo', 'Nội bộ', '内部推荐']
  ],
  dang_tuyen: [
    ['co', 'Có nhu cầu', '有需求'],
    ['khong', 'Dừng tuyển', '停招']
  ],
  co_ktx: [
    ['co', 'Có', '有'],
    ['khong', 'Không', '没有']
  ],
  loai_hoat_dong: [
    ['meeting', 'Gặp mặt', '见面'],
    ['cafe', 'Cà phê', '咖啡'],
    ['meal', 'Ăn uống', '吃饭'],
    ['phone', 'Điện thoại', '电话'],
    ['sms_zalo', 'Tin nhắn/Zalo', '短信Zalo'],
    ['other', 'Khác', '其他']
  ],
  tan_suat: [
    ['weekly_1', 'Mỗi tuần 1 lần', '每周一次'],
    ['monthly_2', 'Mỗi tháng 2 lần', '每月两次'],
    ['monthly_1', 'Mỗi tháng 1 lần', '每月一次'],
    ['quarterly_1', 'Mỗi quý 1 lần', '每季一次'],
    ['on_demand', 'Khi cần', '按需']
  ],
  trang_thai_thu: [
    ['unpaid', 'Chưa thu', '未收款'],
    ['partial', 'Đã thu một phần', '已部分收款'],
    ['paid', 'Đã thu đủ', '已全额收款']
  ],
  giai_doan_aging: [
    ['not_due', 'Chưa đến hạn', '未到期'],
    ['remind_1', 'Nhắc lần 1', '第一次催收'],
    ['remind_2', 'Nhắc lần 2', '第二次催收'],
    ['official_letter', 'Gửi công văn', '发函'],
    ['negotiation', 'Đàm phán', '谈判'],
    ['legal', 'Chuyển pháp lý', '转法务']
  ],
  giai_doan_truy_thu: [
    ['not_due', 'Chưa đến hạn', '未到期'],
    ['remind_1', 'Nhắc lần 1', '第一次催收'],
    ['remind_2', 'Nhắc lần 2', '第二次催收'],
    ['official_letter', 'Gửi công văn', '发函'],
    ['negotiation', 'Đàm phán', '谈判'],
    ['legal', 'Chuyển pháp lý', '转法务'],
    ['partial_collected', 'Đã thu một phần', '已部分收款'],
    ['fully_collected', 'Đã thu đủ', '已全额收款']
  ],
  don_vi_don_gia: [
    ['gio', 'Đồng/giờ', '元每小时'],
    ['nguoi', 'Đồng/người', '元每人']
  ]
};

/* 7 chi nhánh (Branch là thực thể riêng, KHÔNG seed thành enum) */
var SEED_BRANCHES = [
  ['Bắc Ninh', '北宁', 'BN', 'Miền Bắc'],
  ['Bắc Giang', '北江', 'BG', 'Miền Bắc'],
  ['Nam Định', '南定', 'ND', 'Miền Bắc'],
  ['Hà Nam', '河南', 'HNa', 'Miền Bắc'],
  ['Đà Nẵng', '岘港', 'DN', 'Miền Trung'],
  ['Nghệ An', '乂安', 'NA', 'Miền Trung'],
  ['Vĩnh Phúc', '永福', 'VP', 'Miền Bắc']
];

/* Ngưỡng aging (5.3) — [enum_code, tu_ngay, den_ngay('' = ∞)] */
var SEED_AGING = [
  ['not_due', 0, 0],
  ['remind_1', 1, 7],
  ['remind_2', 8, 15],
  ['official_letter', 16, 30],
  ['negotiation', 31, 60],
  ['legal', 61, '']
];

/* Cadence chăm sóc — [tan_suat, cadence_type, chu_ky_ngay] */
var SEED_CARE_FREQ = [
  ['weekly_1', 'weekly', 7],
  ['monthly_2', 'mark_1_15', 0],
  ['monthly_1', 'monthly', 1],
  ['quarterly_1', 'quarterly', 3],
  ['on_demand', 'none', 0]
];

/* Alias dự án cứng (Kiến trúc 12.2) — [alias, project_canonical] */
var SEED_PROJECT_ALIAS = [
  ['HIP', 'HI-P'],
  ['Canfoco CN', 'Canfoco'],
  ['LuxshareBacGiang', 'Luxshare Bắc Giang']
];
