/**
 * 10_Workflow.gs — Máy trạng thái có kiểm vai trò (GĐ3).
 *  Receivable Collection (SM-2, trục thu tiền + escalation pháp lý).
 *  Customer Care Lifecycle (SM-1) — start; complete/overdue ở 05_Crm.gs.
 * Mọi chuyển trạng thái đi qua đây để giữ role-gating + điều kiện.
 */

var RCV = {
  OPEN: 'Receivable Open',
  PARTIAL: 'Receivable Partially Collected',
  LEGAL_PENDING: 'Receivable Legal Pending',
  LEGAL: 'Receivable Legal',
  SETTLED: 'Receivable Settled'
};

function requireRole_(ctx, allowed) {
  if (allowed.indexOf(ctx.role) < 0)
    throw new Error('Cần vai trò ' + allowed.join('/') + ' — bạn là ' + ctx.roleFull + '.');
}

/* Khởi tạo state khi tạo công nợ. */
function rcvInitState_(name) {
  var o = dbGet('Receivable', name);
  if (o && !o.workflow_state) dbUpdate('Receivable', name, { workflow_state: RCV.OPEN });
}

/* Đồng bộ state theo số tiền sau khi ghi thu (không đụng nhánh pháp lý trừ khi đã thu đủ). */
function rcvSyncMoneyState(name) {
  var o = dbGet('Receivable', name);
  if (!o) return;
  var conlai = num_(o.con_lai), dathu = num_(o.da_thu), st = String(o.workflow_state);
  var next;
  if (conlai <= 0) next = RCV.SETTLED;                 // thu đủ → kết thúc tài chính (thắng mọi nhánh)
  else if (st === RCV.LEGAL || st === RCV.LEGAL_PENDING) next = st;  // giữ nhánh pháp lý
  else next = dathu > 0 ? RCV.PARTIAL : RCV.OPEN;
  if (next !== st) { dbUpdate('Receivable', name, { workflow_state: next }); audit_('Receivable', name, 'wf', 'state', st, next); }
}

/* OM/BM đề xuất chuyển pháp lý (quá hạn >60 & còn nợ). */
function rcvProposeLegal(name) {
  var ctx = userContext_(); requireRole_(ctx, ['OM', 'BM', 'ADMIN']);
  var o = dbGet('Receivable', name); if (!o) throw new Error('Không tìm thấy ' + name);
  if ([RCV.OPEN, RCV.PARTIAL].indexOf(String(o.workflow_state)) < 0)
    throw new Error('Chỉ đề xuất pháp lý từ trạng thái Mở/Thu một phần.');
  if (!(num_(o.so_ngay_qua_han) > 60 && num_(o.con_lai) > 0))
    throw new Error('Điều kiện: quá hạn > 60 ngày và còn nợ > 0.');
  dbUpdate('Receivable', name, { workflow_state: RCV.LEGAL_PENDING });
  audit_('Receivable', name, 'wf', 'state', o.workflow_state, RCV.LEGAL_PENDING);
  return { workflow_state: RCV.LEGAL_PENDING };
}

/* BM duyệt chuyển pháp lý. */
function rcvApproveLegal(name) {
  var ctx = userContext_(); requireRole_(ctx, ['BM', 'ADMIN']);
  var o = dbGet('Receivable', name); if (!o) throw new Error('Không tìm thấy ' + name);
  if (String(o.workflow_state) !== RCV.LEGAL_PENDING) throw new Error('Chỉ duyệt khi đang Chờ duyệt pháp lý.');
  if (!(num_(o.con_lai) > 0)) throw new Error('Đã hết nợ — không cần pháp lý.');
  dbUpdate('Receivable', name, { workflow_state: RCV.LEGAL });
  audit_('Receivable', name, 'wf', 'state', o.workflow_state, RCV.LEGAL);
  return { workflow_state: RCV.LEGAL };
}

/* BM từ chối đề xuất pháp lý → về Mở. */
function rcvRejectLegal(name) {
  var ctx = userContext_(); requireRole_(ctx, ['BM', 'ADMIN']);
  var o = dbGet('Receivable', name); if (!o) throw new Error('Không tìm thấy ' + name);
  if (String(o.workflow_state) !== RCV.LEGAL_PENDING) throw new Error('Chỉ từ chối khi đang Chờ duyệt pháp lý.');
  dbUpdate('Receivable', name, { workflow_state: RCV.OPEN });
  audit_('Receivable', name, 'wf', 'state', o.workflow_state, RCV.OPEN);
  return { workflow_state: RCV.OPEN };
}

/* BM override nhãn giai đoạn truy thu (job nền không ghi đè khi đã override). */
function rcvOverrideStage(name, stageEnum) {
  var ctx = userContext_(); requireRole_(ctx, ['BM', 'ADMIN']);
  var o = dbGet('Receivable', name); if (!o) throw new Error('Không tìm thấy ' + name);
  var valid = dbQuery('CategoryValue', { category_group: 'giai_doan_truy_thu', enum_code: stageEnum });
  if (!valid.length) throw new Error('Giá trị giai đoạn không hợp lệ: ' + stageEnum);
  dbUpdate('Receivable', name, { giai_doan_truy_thu: stageEnum, giai_doan_override: true });
  audit_('Receivable', name, 'override', 'giai_doan_truy_thu', o.giai_doan_truy_thu, stageEnum);
  return { giai_doan_truy_thu: stageEnum };
}

/* Bắt đầu liên hệ chăm sóc: Pending → In Progress. */
function careStart(name) {
  var ctx = userContext_();
  var o = dbGet('CareTask', name); if (!o) throw new Error('Không tìm thấy ' + name);
  if ([CARE_PENDING, CARE_OVERDUE].indexOf(String(o.workflow_state)) < 0)
    throw new Error('Chỉ bắt đầu từ trạng thái Chưa hoàn thành/Quá hạn.');
  dbUpdate('CareTask', name, { workflow_state: CARE_IN_PROGRESS });
  audit_('CareTask', name, 'wf', 'state', o.workflow_state, CARE_IN_PROGRESS);
  return { workflow_state: CARE_IN_PROGRESS };
}
