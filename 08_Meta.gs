/**
 * 08_Meta.gs — Metadata UI điều khiển engine list/form tổng quát của Web App.
 * Mỗi module: doctype, nhãn song ngữ, cột list, field form (kiểu + link/enum).
 */

/* Field hiển thị (title) của từng doctype khi là Link. */
var DISPLAY_FIELD = {
  Branch: 'name', Staff: 'full_name', Customer: 'customer_name', Project: 'project_name',
  Workshop: 'workshop_name', Policy: 'name', WeeklyDemand: 'name', DailyReport: 'name',
  WeeklyKPI: 'name', Receivable: 'name', CareTask: 'name', Users: 'name', CategoryValue: 'gia_tri'
};

function L_(vi, zh) { return { vi: vi, zh: zh }; }
function F_(f, vi, zh, type, opt) {
  var o = { f: f, label: L_(vi, zh), type: type || 'data' };
  if (opt) for (var k in opt) o[k] = opt[k];
  return o;
}

var MODULES = [
  {
    key: 'DailyReport', doctype: 'DailyReport', icon: '📝', nav: true,
    title: L_('Báo cáo ngày', '每日报表'), onSave: 'apiSubmitDaily',
    list: ['ngay', 'du_an', 'xuong', 'chuyen_vien', 'phuong_thuc', 'dang_ky', 'phong_van', 'do_pv', 'di_lam'],
    fields: [
      F_('ngay', 'Ngày', '日期', 'date', { reqd: true }),
      F_('du_an', 'Dự án', '项目', 'link', { link: 'Project', reqd: true }),
      F_('xuong', 'Xưởng', '车间', 'link', { link: 'Workshop' }),
      F_('phuong_thuc', 'Phương thức', '招聘方式', 'enum', { group: 'phuong_thuc' }),
      F_('chuyen_vien', 'Chuyên viên', '专员', 'link', { link: 'Staff', reqd: true }),
      F_('dang_ky', 'Đăng ký', '报名', 'int', { reqd: true }),
      F_('phong_van', 'Phỏng vấn', '面试', 'int', { reqd: true }),
      F_('do_pv', 'Đỗ PV', '通过面试', 'int', { reqd: true }),
      F_('di_lam', 'Đi làm', '入职', 'int', { reqd: true })
    ]
  },
  {
    key: 'WeeklyDemand', doctype: 'WeeklyDemand', icon: '📅', nav: true,
    title: L_('Nhu cầu tuần', '周需求'), onSave: 'apiSubmitDemand',
    list: ['tuan', 'du_an', 'chuyen_vien', 'kpi_giao', 'nhu_cau_kh_tuan'],
    fields: [
      F_('tuan', 'Tuần', '周', 'data', { reqd: true, placeholder: '2026-W14' }),
      F_('du_an', 'Dự án', '项目', 'link', { link: 'Project', reqd: true }),
      F_('xuong', 'Xưởng', '车间', 'link', { link: 'Workshop' }),
      F_('quan_ly', 'Quản lý', '主管', 'link', { link: 'Staff', reqd: true }),
      F_('chuyen_vien', 'Chuyên viên', '专员', 'link', { link: 'Staff', reqd: true }),
      F_('nhu_cau_kh_tuan', 'Nhu cầu KH', '客户需求', 'int', { reqd: true }),
      F_('kpi_giao', 'KPI giao', '下达KPI', 'int', { reqd: true })
    ]
  },
  {
    key: 'WeeklyKPI', doctype: 'WeeklyKPI', icon: '📊', nav: true, readonly: true,
    title: L_('KPI tuần', '周KPI'),
    list: ['du_an', 'chuyen_vien', 'kpi_giao', 'dang_ky', 'phong_van', 'do_pv_so_nguoi', 'di_lam', 'fill_rate', 'chuyen_doi', 'ti_le_dau_pv', 'co_lech_chuyen_vien'],
    fields: [
      F_('tuan', 'Tuần', '周', 'data'),
      F_('du_an', 'Dự án', '项目', 'link', { link: 'Project' }),
      F_('chuyen_vien', 'Chuyên viên', '专员', 'link', { link: 'Staff' }),
      F_('kpi_giao', 'KPI giao', '下达KPI', 'int'),
      F_('nhu_cau_kh', 'Nhu cầu KH', '客户需求', 'int'),
      F_('dang_ky', 'Đăng ký', '报名', 'int'),
      F_('phong_van', 'Phỏng vấn', '面试', 'int'),
      F_('do_pv_so_nguoi', 'Đỗ PV', '通过面试', 'int'),
      F_('di_lam', 'Đi làm', '入职', 'int'),
      F_('fill_rate', 'Fill rate', '完成率', 'pct'),
      F_('chuyen_doi', 'Chuyển đổi', '转化率', 'pct'),
      F_('ti_le_dau_pv', 'Tỷ lệ đậu PV', '面试通过率', 'pct'),
      F_('dat_nhu_cau', 'Đạt nhu cầu', '需求达成率', 'pct'),
      F_('co_lech_chuyen_vien', 'Lệch CV', '专员不匹配', 'check')
    ]
  },
  {
    key: 'CareTask', doctype: 'CareTask', icon: '📞', nav: true,
    title: L_('Chăm sóc KH', '客户维护'), special: 'care',
    list: ['khach_hang', 'quan_ly', 'hoat_dong', 'tan_suat', 'ngay_kh', 'workflow_state'],
    fields: [
      F_('khach_hang', 'Khách hàng', '客户', 'link', { link: 'Customer', reqd: true }),
      F_('quan_ly', 'Quản lý', '负责经理', 'link', { link: 'Staff', reqd: true }),
      F_('hoat_dong', 'Hoạt động', '活动方式', 'enum', { group: 'loai_hoat_dong', reqd: true }),
      F_('tan_suat', 'Tần suất', '频率', 'enum', { group: 'tan_suat', reqd: true }),
      F_('ngay_kh', 'Ngày kế hoạch', '计划日期', 'date', { reqd: true }),
      F_('noi_dung', 'Nội dung', '内容', 'smalltext'),
      F_('workflow_state', 'Trạng thái', '状态', 'readonly')
    ]
  },
  {
    key: 'Receivable', doctype: 'Receivable', icon: '💰', nav: true,
    title: L_('Công nợ', '应收账款'), special: 'receivable',
    list: ['khach_hang', 'ky_cong_no', 'so_tien', 'con_lai', 'so_ngay_qua_han', 'giai_doan_aging', 'trang_thai_thu', 'giai_doan_truy_thu'],
    fields: [
      F_('chi_nhanh', 'Chi nhánh', '分公司', 'link', { link: 'Branch', reqd: true }),
      F_('khach_hang', 'Khách hàng', '客户', 'link', { link: 'Customer', reqd: true }),
      F_('du_an', 'Dự án', '项目', 'link', { link: 'Project' }),
      F_('quan_ly_phu_trach', 'Quản lý', '负责经理', 'link', { link: 'Staff', reqd: true }),
      F_('ky_cong_no', 'Kỳ công nợ', '账期', 'data', { reqd: true, placeholder: 'T06/2026' }),
      F_('so_tien', 'Số tiền', '金额', 'currency', { reqd: true }),
      F_('ngay_den_han', 'Ngày đến hạn', '到期日', 'date', { reqd: true }),
      F_('da_thu', 'Đã thu', '已收', 'currency'),
      F_('ghi_chu', 'Ghi chú', '备注', 'smalltext'),
      F_('con_lai', 'Còn lại', '余额', 'currency', { ro: true }),
      F_('so_ngay_qua_han', 'Số ngày quá hạn', '逾期天数', 'int', { ro: true }),
      F_('giai_doan_aging', 'Giai đoạn aging', '账龄阶段', 'enum', { group: 'giai_doan_aging', ro: true }),
      F_('trang_thai_thu', 'Trạng thái thu', '收款状态', 'enum', { group: 'trang_thai_thu', ro: true }),
      F_('giai_doan_truy_thu', 'Giai đoạn truy thu', '催收阶段', 'enum', { group: 'giai_doan_truy_thu', ro: true }),
      F_('ty_le_thu_hoi', 'Tỷ lệ thu hồi', '回收率', 'pct', { ro: true })
    ]
  },
  {
    key: 'Customer', doctype: 'Customer', icon: '🏢', more: true,
    title: L_('Khách hàng', '客户'),
    list: ['customer_name', 'branch', 'phan_loai', 'quan_ly_phu_trach'],
    fields: [
      F_('customer_name', 'Tên khách hàng', '客户名称', 'data', { reqd: true }),
      F_('customer_name_zh', 'Tên KH (中文)', '客户名称(中)', 'data'),
      F_('branch', 'Chi nhánh', '分公司', 'link', { link: 'Branch', reqd: true }),
      F_('phan_loai', 'Phân loại', '分类', 'enum', { group: 'phan_loai_kh', reqd: true }),
      F_('dich_vu', 'Dòng dịch vụ', '服务类型', 'enum', { group: 'dich_vu' }),
      F_('quan_ly_phu_trach', 'Quản lý phụ trách', '负责经理', 'link', { link: 'Staff' })
    ]
  },
  {
    key: 'Project', doctype: 'Project', icon: '📁', more: true,
    title: L_('Dự án', '项目'),
    list: ['project_name', 'customer', 'branch', 'trang_thai'],
    fields: [
      F_('project_name', 'Tên dự án', '项目名称', 'data', { reqd: true }),
      F_('customer', 'Khách hàng', '客户', 'link', { link: 'Customer', reqd: true }),
      F_('branch', 'Chi nhánh', '分公司', 'link', { link: 'Branch', reqd: true }),
      F_('phan_loai', 'Phân loại', '分类', 'enum', { group: 'phan_loai_kh', reqd: true }),
      F_('dich_vu', 'Dòng dịch vụ', '服务类型', 'enum', { group: 'dich_vu' }),
      F_('quan_ly_phu_trach', 'Quản lý phụ trách', '负责经理', 'link', { link: 'Staff' }),
      F_('trang_thai', 'Trạng thái', '状态', 'enum', { group: 'trang_thai_da', reqd: true })
    ]
  },
  {
    key: 'Workshop', doctype: 'Workshop', icon: '🏭', more: true,
    title: L_('Xưởng', '车间'),
    list: ['workshop_name', 'project', 'status'],
    fields: [
      F_('workshop_name', 'Tên xưởng', '车间名称', 'data', { reqd: true }),
      F_('project', 'Dự án', '项目', 'link', { link: 'Project', reqd: true }),
      F_('parent_workshop', 'Xưởng cha', '上级车间', 'link', { link: 'Workshop' }),
      F_('is_group', 'Là nhóm', '分组节点', 'check'),
      F_('status', 'Trạng thái', '状态', 'data', { placeholder: 'Active' }),
      F_('notes', 'Ghi chú', '备注', 'smalltext')
    ]
  },
  {
    key: 'Staff', doctype: 'Staff', icon: '👤', more: true,
    title: L_('Nhân sự', '员工'),
    list: ['full_name', 'branch', 'vai_tro', 'trang_thai'],
    fields: [
      F_('full_name', 'Họ tên', '姓名', 'data', { reqd: true }),
      F_('branch', 'Chi nhánh', '分公司', 'link', { link: 'Branch', reqd: true }),
      F_('vai_tro', 'Vai trò', '角色', 'enum', { group: 'vai_tro', reqd: true }),
      F_('trang_thai', 'Trạng thái', '状态', 'enum', { group: 'trang_thai_nv', reqd: true }),
      F_('user', 'Tài khoản (email)', '登录账号', 'data'),
      F_('email', 'Email', '邮箱', 'data'),
      F_('phone', 'Điện thoại', '电话', 'data')
    ]
  },
  {
    key: 'Policy', doctype: 'Policy', icon: '💵', more: true,
    title: L_('Chính sách', '招聘政策'),
    list: ['khach_hang', 'xuong', 'dang_tuyen', 'don_gia'],
    fields: [
      F_('khach_hang', 'Khách hàng', '客户', 'link', { link: 'Customer', reqd: true }),
      F_('xuong', 'Xưởng', '车间', 'link', { link: 'Workshop', reqd: true }),
      F_('dang_tuyen', 'Đang tuyển', '是否招聘', 'enum', { group: 'dang_tuyen', reqd: true }),
      F_('don_gia', 'Đơn giá', '单价', 'currency'),
      F_('don_vi', 'Đơn vị', '单位', 'enum', { group: 'don_vi_don_gia' }),
      F_('yeu_cau', 'Yêu cầu', '要求', 'smalltext'),
      F_('luong_co_ban', 'Lương cơ bản', '基本工资', 'currency'),
      F_('phu_cap', 'Phụ cấp', '补贴', 'currency'),
      F_('co_ktx', 'Có KTX', '有宿舍', 'enum', { group: 'co_ktx' })
    ]
  },
  {
    key: 'NameQueue', doctype: 'NameQueue', icon: '🔤', more: true, special: 'queue', readonly: true,
    title: L_('Hàng đợi alias', '别名队列'),
    list: ['raw_text', 'context', 'status'],
    fields: [
      F_('raw_text', 'Tên thô', '原始名称', 'data', { ro: true }),
      F_('raw_normalized', 'Đã chuẩn hóa', '规范化', 'data', { ro: true }),
      F_('context', 'Bối cảnh', '来源', 'data', { ro: true }),
      F_('suggested', 'Gợi ý', '建议', 'data', { ro: true }),
      F_('status', 'Trạng thái', '状态', 'data', { ro: true })
    ]
  },
  {
    key: 'Users', doctype: 'Users', icon: '🔑', more: true,
    title: L_('Người dùng', '用户'),
    list: ['user_email', 'role', 'staff_id', 'branch_id', 'active'],
    fields: [
      F_('user_email', 'Email Google', '谷歌邮箱', 'data', { reqd: true }),
      F_('role', 'Vai trò', '角色', 'data', { reqd: true, placeholder: 'ADMIN/BOD/BM/OM/SPV' }),
      F_('staff_id', 'Nhân sự', '员工', 'link', { link: 'Staff' }),
      F_('branch_id', 'Chi nhánh', '分公司', 'link', { link: 'Branch' }),
      F_('display_name', 'Tên hiển thị', '显示名', 'data'),
      F_('locale', 'Ngôn ngữ', '语言', 'data', { placeholder: 'vi/zh' }),
      F_('active', 'Đang hoạt động', '启用', 'check')
    ]
  },
  {
    key: 'AuditLog', doctype: 'AuditLog', icon: '🧾', more: true, readonly: true,
    title: L_('Nhật ký kiểm toán', '审计日志'),
    list: ['thoi_diem', 'doctype', 'docname', 'action', 'nguoi'],
    fields: [
      F_('thoi_diem', 'Thời điểm', '时间', 'readonly'),
      F_('nguoi', 'Người', '用户', 'readonly'),
      F_('doctype', 'Bảng', '表', 'readonly'),
      F_('docname', 'Bản ghi', '记录', 'readonly'),
      F_('action', 'Hành động', '动作', 'readonly'),
      F_('truong', 'Trường', '字段', 'readonly'),
      F_('gia_tri_cu', 'Giá trị cũ', '旧值', 'readonly'),
      F_('gia_tri_moi', 'Giá trị mới', '新值', 'readonly')
    ]
  },
  {
    key: 'CategoryValue', doctype: 'CategoryValue', icon: '🏷️',
    title: L_('Danh mục', '类别值'),
    list: ['category_group', 'enum_code', 'gia_tri', 'ten_trung', 'is_enabled'],
    fields: [
      F_('category_group', 'Nhóm', '类别组', 'data', { reqd: true }),
      F_('enum_code', 'Mã enum', '枚举码', 'data', { reqd: true }),
      F_('gia_tri', 'Giá trị (VI)', '值(越)', 'data', { reqd: true }),
      F_('ten_trung', 'Giá trị (中文)', '值(中)', 'data'),
      F_('display_order', 'Thứ tự', '排序', 'int'),
      F_('is_enabled', 'Đang dùng', '启用', 'check')
    ]
  },
  {
    key: 'Branch', doctype: 'Branch', icon: '🏢',
    title: L_('Chi nhánh', '分公司'),
    list: ['name', 'name_zh', 'branch_code', 'region', 'is_active'],
    fields: [
      F_('name', 'Tên chi nhánh', '名称', 'data', { reqd: true }),
      F_('name_zh', 'Tên (中文)', '名称(中)', 'data'),
      F_('branch_code', 'Mã', '编码', 'data'),
      F_('region', 'Khu vực', '区域', 'data'),
      F_('is_active', 'Đang hoạt động', '启用', 'check')
    ]
  }
];

function moduleByKey_(key) {
  for (var i = 0; i < MODULES.length; i++) if (MODULES[i].key === key) return MODULES[i];
  throw new Error('Module không tồn tại: ' + key);
}
