import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCheck,
  Clock,
  PauseCircle,
  Printer,
  Send,
  ShieldAlert,
  Star,
  X,
} from "lucide-react";
import {
  addWhatsappMessage,
  buildWhatsappTicketMessage,
  createComplaintWithNotification,
  updateComplaintByAgent,
  updateComplaintLifecycle,
} from "../lib/crmService";
import {
  CATEGORY_LABELS,
  CHANNEL_LABELS,
  Complaint,
  ComplaintCategory,
  ComplaintChannel,
  ComplaintPriority,
  ComplaintStatus,
  computeSlaStatus,
  Conversation,
  Customer,
  ESCALATION_MATRIX_LEVELS,
  FANAR_BRANCHES,
  formatArabicDate,
  getComplaintEffectiveDate,
  PRIORITY_LABELS,
  SLA_TIERS,
  SlaTier,
  STATUS_LABELS,
  UNKNOWN_BRANCH_LABEL,
} from "../types/crm";
import { SlaBadge, StatusIndicator } from "./StatusIndicator";
import { StationPicker } from "./StationPicker";

interface NewComplaintModalProps {
  open: boolean;
  onClose: () => void;
  ownerId: string;
  agentName: string;
  customers: Customer[];
  conversations: Conversation[];
  complaints?: Complaint[];
  onCreated: (ticketCode: string) => void;
}

export const NewComplaintModal: React.FC<NewComplaintModalProps> = ({
  open,
  onClose,
  ownerId,
  agentName,
  customers,
  conversations,
  complaints = [],
  onCreated,
}) => {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("+9665");
  const [branch, setBranch] = useState(FANAR_BRANCHES[0]);
  const [stationUnknown, setStationUnknown] = useState(false);
  const [pumpNumber, setPumpNumber] = useState("مضخة 1");
  const [category, setCategory] = useState<ComplaintCategory>("billing_pump");
  const [channel, setChannel] = useState<ComplaintChannel>("direct");
  const [priority, setPriority] = useState<ComplaintPriority>("normal");
  const [slaTier, setSlaTier] = useState<SlaTier>("P3");
  const [description, setDescription] = useState("");
  const [sendWhatsappCode, setSendWhatsappCode] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const duplicateCandidate = useMemo(() => {
    const digits = customerPhone.replace(/\D/g, "").slice(-9);
    if (digits.length < 7) return null;
    const cutoff = Date.now() - 48 * 3600 * 1000;
    return complaints.find((c) => {
      if (c.status === "closed" || c.status === "cancelled") return false;
      const phoneMatch = c.customerPhone.replace(/\D/g, "").slice(-9) === digits;
      return (
        phoneMatch &&
        c.category === category &&
        getComplaintEffectiveDate(c).getTime() >= cutoff
      );
    });
  }, [complaints, customerPhone, category]);

  if (!open) return null;

  function handlePriorityChange(nextPrio: ComplaintPriority) {
    setPriority(nextPrio);
    if (nextPrio === "urgent") setSlaTier("P1");
    else if (nextPrio === "high") setSlaTier("P2");
    else setSlaTier("P3");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || !description.trim() || isSaving) return;

    setIsSaving(true);
    setError(null);
    try {
      const res = await createComplaintWithNotification({
        ownerId,
        agentName,
        customerName,
        customerPhone,
        branch: stationUnknown ? UNKNOWN_BRANCH_LABEL : branch,
        stationUnknown,
        pumpNumber,
        category,
        channel,
        priority,
        slaTier,
        status: "new",
        description,
        aiSummary: description.slice(0, 140),
        existingCustomers: customers,
        existingConversations: conversations,
        sendWhatsappCode,
      });

      setCustomerName("");
      setCustomerPhone("+9665");
      setDescription("");
      setStationUnknown(false);
      onCreated(res.ticketCode);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل الشكوى");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-xl w-full p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-[#1B2E66] dark:text-slate-100">
              تسجيل شكوى عميل وتحديد مستوى SLA
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              يُنشأ رمز الشكوى (FNR-...) مع سجل إجراءات زمني فور الحفظ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {duplicateCandidate && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              تحذير تكرار خلال 48 ساعة: للعميل شكوى مفتوحة بنفس التصنيف برمز{" "}
              <strong className="font-mono">{duplicateCandidate.ticketCode}</strong> (لن يتم منع الحفظ).
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                اسم العميل
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="مثال: محمد العتيبي"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                رقم الجوال / الواتساب
              </label>
              <input
                type="text"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <StationPicker
              label="فرع المحطة (بالاسم أو الكود ST)"
              value={branch}
              onChange={setBranch}
              allowUnknown
              stationUnknown={stationUnknown}
              onStationUnknownChange={setStationUnknown}
              showPreviewCard
              compact
            />
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                رقم المضخة / الموقع
              </label>
              <input
                type="text"
                value={pumpNumber}
                onChange={(e) => setPumpNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                التصنيف
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                القناة
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as ComplaintChannel)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                الأولوية
              </label>
              <select
                value={priority}
                onChange={(e) => handlePriorityChange(e.target.value as ComplaintPriority)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                مستوى SLA
              </label>
              <select
                value={slaTier}
                onChange={(e) => setSlaTier(e.target.value as SlaTier)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                {(["P1", "P2", "P3", "P4"] as const).map((tier) => (
                  <option key={tier} value={tier}>
                    {SLA_TIERS[tier].shortLabel} ({SLA_TIERS[tier].resolutionHours}س)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              وصف الشكوى
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="تفاصيل بلاغ العميل والملاحظات الأولية..."
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={sendWhatsappCode}
              onChange={(e) => setSendWhatsappCode(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-[#961B5E]"
            />
            <span>إرسال رمز الشكوى تلقائياً إلى العميل عبر الواتساب فور التسجيل</span>
          </label>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-lg bg-[#961B5E] text-white text-xs font-semibold hover:bg-[#7A144B] disabled:opacity-50"
            >
              {isSaving ? "جاري التسجيل..." : "تسجيل الشكوى وإصدار الرمز"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ComplaintDetailModalProps {
  complaint: Complaint | null;
  onClose: () => void;
  ownerId: string;
  agentName: string;
  actorRole?: string;
  conversations: Conversation[];
  onPrint: (complaint: Complaint) => void;
  onGoToManagerPortal: () => void;
}

export const ComplaintDetailModal: React.FC<ComplaintDetailModalProps> = ({
  complaint,
  onClose,
  ownerId,
  agentName,
  actorRole = "agent",
  conversations,
  onPrint,
  onGoToManagerPortal,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [pauseReason, setPauseReason] = useState("");
  const [pauseReminderAt, setPauseReminderAt] = useState("متابعة بعد 24 ساعة");
  const [showPauseBox, setShowPauseBox] = useState(false);

  const [resolutionEvidence, setResolutionEvidence] = useState("");
  const [showResolveBox, setShowResolveBox] = useState(false);

  const [cancellationReason, setCancellationReason] = useState("");
  const [showCancelBox, setShowCancelBox] = useState(false);

  const [assignedBranch, setAssignedBranch] = useState(FANAR_BRANCHES[0]);

  if (!complaint) return null;

  const isClosed = complaint.status === "closed";
  const isCancelled = complaint.status === "cancelled";
  const sla = computeSlaStatus(complaint);
  const tierDef = SLA_TIERS[sla.tier];

  async function runLifecycleUpdate(
    nextStatus: ComplaintStatus,
    extra?: {
      note?: string;
      pauseReason?: string;
      pauseReminderAt?: string;
      resolutionEvidence?: string;
      publicUpdateNote?: string;
      escalationLevel?: number;
      escalationOwner?: string;
      cancellationReason?: string;
    }
  ) {
    if (!complaint) return;
    setIsUpdating(true);
    setNotice(null);
    setErrorMsg(null);
    try {
      await updateComplaintLifecycle({
        complaint,
        nextStatus,
        actorName: agentName,
        actorRole,
        ...extra,
      });
      setShowPauseBox(false);
      setShowResolveBox(false);
      setShowCancelBox(false);
      setNotice(`تم تحديث الحالة إلى «${STATUS_LABELS[nextStatus]}» وتوثيق الإجراء في السجل الزمني.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "تعذر تحديث دورة حياة الشكوى");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleAssignBranch() {
    if (!complaint) return;
    setIsUpdating(true);
    setNotice(null);
    try {
      await updateComplaintByAgent(complaint.id, {
        branch: assignedBranch,
        stationUnknown: false,
      });
      setNotice(`تم توجيه الشكوى يدوياً إلى ${assignedBranch}.`);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDispatchCodeWhatsapp() {
    if (!complaint) return;
    setIsUpdating(true);
    setNotice(null);
    try {
      const conv = conversations.find(
        (c) =>
          c.linkedTicketCode === complaint.ticketCode ||
          c.customerId === complaint.customerId ||
          c.customerPhone.replace(/\s+/g, "") === complaint.customerPhone.replace(/\s+/g, "")
      );
      if (conv) {
        await addWhatsappMessage({
          conversationId: conv.id,
          sender: "agent",
          senderName: agentName,
          body: buildWhatsappTicketMessage(
            complaint.customerName,
            complaint.ticketCode,
            complaint.branch,
            complaint.aiSummary
          ),
          messageType: "ticket_code",
          ticketCode: complaint.ticketCode,
          ownerId,
        });
      }
      if (!isClosed) {
        await updateComplaintByAgent(complaint.id, { codeSentViaWhatsapp: true });
      }
      setNotice(`تم إرسال رمز الشكوى ${complaint.ticketCode} عبر الواتساب بنجاح.`);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-bold font-mono text-[#1B2E66] dark:text-sky-300 tabular-nums">
                {complaint.ticketCode}
              </h3>
              <StatusIndicator status={complaint.status} />
              <SlaBadge complaint={complaint} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              سجلت بتاريخ{" "}
              <span className="font-mono tabular-nums">
                {formatArabicDate(getComplaintEffectiveDate(complaint))}
              </span>{" "}
              · مستوى التصعيد الحالي:{" "}
              <span className="font-mono font-semibold">L{complaint.escalationLevel ?? 0}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onPrint(complaint)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-[#1B2E66] dark:text-sky-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {notice && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300">
            {notice}
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {errorMsg}
          </div>
        )}

        {/* SLA Progress & Fair Pause Info */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-[#1B2E66] dark:text-slate-100 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#0D74B8] dark:text-sky-400" />
              <span>مؤشر اتفاقية مستوى الخدمة — {tierDef.label}</span>
            </span>
            <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
              هدف الرد: {tierDef.firstResponseMinutes}د · هدف الحل: {tierDef.resolutionHours}س · الاستهلاك: {sla.progressPct}%
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all ${
                sla.isPaused
                  ? "bg-indigo-500"
                  : sla.isBreached
                  ? "bg-red-600"
                  : sla.progressPct >= 75
                  ? "bg-amber-500"
                  : "bg-emerald-600"
              }`}
              style={{ width: `${Math.min(100, sla.progressPct)}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span>سياسة التصعيد: {tierDef.escalationPolicy}</span>
            {(complaint.pauseCount || 0) > 0 && (
              <span className="font-mono tabular-nums">
                مرات التوقف العادل: {complaint.pauseCount} ({complaint.pausedTotalMinutes || 0}د متوقفة)
              </span>
            )}
          </div>

          {complaint.status === "waiting_customer" && complaint.pauseReason && (
            <p className="text-indigo-700 dark:text-indigo-300 font-medium">
              سبب الإيقاف الحالي: {complaint.pauseReason} ({complaint.pauseReminderAt || "تذكير مجدول"})
            </p>
          )}
        </div>

        {/* Manual Station Triage if Station Unknown */}
        {complaint.stationUnknown && !isClosed && (
          <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2.5 text-xs">
            <span className="text-amber-900 dark:text-amber-200 font-medium block">
              المحطة غير محددة من العميل — ابحث وحدد المحطة المختصة للتوجيه:
            </span>
            <div className="flex flex-col sm:flex-row sm:items-end gap-2">
              <div className="flex-1">
                <StationPicker
                  label="المحطة المختصة"
                  value={assignedBranch}
                  onChange={setAssignedBranch}
                  showPreviewCard={false}
                  compact
                />
              </div>
              <button
                type="button"
                disabled={isUpdating}
                onClick={handleAssignBranch}
                className="px-4 py-2.5 rounded-lg bg-[#1B2E66] text-white font-medium hover:bg-[#12204A] whitespace-nowrap shrink-0"
              >
                اعتماد المحطة
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p>
            <span className="text-slate-500 dark:text-slate-400">العميل: </span>
            <strong className="text-slate-900 dark:text-slate-100">{complaint.customerName}</strong>
          </p>
          <p>
            <span className="text-slate-500 dark:text-slate-400">الجوال: </span>
            <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {complaint.customerPhone}
            </strong>
          </p>
          <p>
            <span className="text-slate-500 dark:text-slate-400">الفرع: </span>
            <strong className="text-slate-900 dark:text-slate-100">{complaint.branch}</strong>
          </p>
          <p>
            <span className="text-slate-500 dark:text-slate-400">المضخة: </span>
            <strong className="text-slate-900 dark:text-slate-100">
              {complaint.pumpNumber || "غير محدد"}
            </strong>
          </p>
          <p>
            <span className="text-slate-500 dark:text-slate-400">التصنيف: </span>
            <strong className="text-slate-900 dark:text-slate-100">
              {CATEGORY_LABELS[complaint.category]}
            </strong>
          </p>
          <p>
            <span className="text-slate-500 dark:text-slate-400">القناة والأولوية: </span>
            <strong className="text-slate-900 dark:text-slate-100">
              {CHANNEL_LABELS[complaint.channel]} · {PRIORITY_LABELS[complaint.priority]}
            </strong>
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-[#1B2E66] dark:text-slate-100">تفاصيل الشكوى</p>
          <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-lg p-3.5">
            {complaint.description}
          </p>
          {complaint.attachmentMeta && (
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              مرفق العميل: {complaint.attachmentMeta.fileName} (
              {Math.max(1, Math.round(complaint.attachmentMeta.sizeBytes / 1024))} KB)
            </p>
          )}
          {complaint.resolutionEvidence && (
            <p className="text-xs text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900 rounded-lg p-2.5">
              <strong>دليل الحل الميداني: </strong>
              {complaint.resolutionEvidence}
            </p>
          )}
          {complaint.csatScore ? (
            <p className="text-xs text-amber-700 dark:text-amber-300 inline-flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>
                تقييم العميل للحل: {complaint.csatScore}/5{" "}
                {complaint.csatComment ? `— "${complaint.csatComment}"` : ""}
              </span>
            </p>
          ) : null}
        </div>

        {/* Escalation Matrix Levels 1-3 */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 space-y-2 text-xs">
          <p className="font-bold text-[#1B2E66] dark:text-slate-100">
            مصفوفة التصعيد المعتمدة (المستويات 1–3)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {ESCALATION_MATRIX_LEVELS.map((lvl) => {
              const isCurrent = (complaint.escalationLevel || 0) === lvl.level;
              return (
                <div
                  key={lvl.level}
                  className={`p-2.5 rounded-lg border ${
                    isCurrent
                      ? "border-[#961B5E] bg-[#961B5E]/5 dark:bg-[#961B5E]/15"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  }`}
                >
                  <p className="font-semibold text-[#1B2E66] dark:text-slate-100">{lvl.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {lvl.owner}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lifecycle Action Controls */}
        {isClosed || isCancelled ? (
          <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 space-y-1.5 text-xs">
            <p className="font-bold text-emerald-900 dark:text-emerald-200">
              {isClosed ? "تم إغلاق الشكوى نهائياً" : "الشكوى ملغاة بتوثيق رسمي"}
            </p>
            <p className="text-emerald-800 dark:text-emerald-300">
              <strong>السبب / القرار: </strong>
              {isClosed ? complaint.closureReason : complaint.cancellationReason}
            </p>
            {complaint.managerNotes && (
              <p className="text-emerald-800 dark:text-emerald-300">
                <strong>ملاحظات المدير: </strong>
                {complaint.managerNotes}
              </p>
            )}
          </div>
        ) : (
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isUpdating || complaint.status === "in_progress"}
                onClick={() => runLifecycleUpdate("in_progress")}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-[#0D74B8] dark:text-sky-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                بدء / استئناف المعالجة
              </button>

              <button
                type="button"
                disabled={isUpdating}
                onClick={() => {
                  setShowPauseBox((v) => !v);
                  setShowResolveBox(false);
                  setShowCancelBox(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 text-xs font-medium"
              >
                <PauseCircle className="w-3.5 h-3.5" />
                <span>إيقاف SLA بانتظار العميل</span>
              </button>

              {complaint.status !== "new" && (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => {
                    setShowResolveBox((v) => !v);
                    setShowPauseBox(false);
                    setShowCancelBox(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-teal-300 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 text-xs font-medium"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>تسجيل الحل مع الدليل</span>
                </button>
              )}

              <button
                type="button"
                disabled={isUpdating}
                onClick={() =>
                  runLifecycleUpdate("pending_manager", {
                    escalationLevel: sla.tier === "P1" ? 3 : 2,
                    escalationOwner: "مدير خدمة العملاء",
                    note: "تصعيد لبوابة مدير خدمة العملاء للمراجعة والاعتماد",
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-medium"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>تصعيد للمدير</span>
              </button>

              <button
                type="button"
                disabled={isUpdating}
                onClick={() => {
                  setShowCancelBox((v) => !v);
                  setShowPauseBox(false);
                  setShowResolveBox(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>إلغاء موثق</span>
              </button>

              <button
                type="button"
                disabled={isUpdating}
                onClick={handleDispatchCodeWhatsapp}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Send className="w-3.5 h-3.5" />
                <span>إرسال الرمز واتساب</span>
              </button>
            </div>

            {complaint.status === "new" && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                قاعدة الحوكمة: لا يمكن الإغلاق مباشرة من حالة «جديدة»؛ يجب بدء المعالجة أو توثيق الحل أولاً.
              </p>
            )}

            {showPauseBox && (
              <div className="p-3.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 space-y-2.5 text-xs">
                <input
                  type="text"
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  placeholder="سبب الإيقاف (مثال: بانتظار تزويد العميل بصورة الفاتورة أو لوحة المركبة)..."
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={pauseReminderAt}
                    onChange={(e) => setPauseReminderAt(e.target.value)}
                    placeholder="موعد التذكير للمتابعة"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={isUpdating || !pauseReason.trim()}
                    onClick={() =>
                      runLifecycleUpdate("waiting_customer", {
                        pauseReason: pauseReason.trim(),
                        pauseReminderAt,
                        publicUpdateNote: `بانتظار ردكم: ${pauseReason.trim()}`,
                      })
                    }
                    className="px-4 py-1.5 rounded-lg bg-indigo-700 text-white font-semibold disabled:opacity-50"
                  >
                    تأكيد إيقاف SLA
                  </button>
                </div>
              </div>
            )}

            {showResolveBox && (
              <div className="p-3.5 rounded-lg bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900 space-y-2.5 text-xs">
                <textarea
                  rows={2}
                  value={resolutionEvidence}
                  onChange={(e) => setResolutionEvidence(e.target.value)}
                  placeholder="دليل الحل الميداني أو تسوية الفاتورة (سيُعرض للعميل لتأكيد الحل وتقييم CSAT)..."
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  disabled={isUpdating || !resolutionEvidence.trim()}
                  onClick={() =>
                    runLifecycleUpdate("resolved", {
                      resolutionEvidence: resolutionEvidence.trim(),
                      publicUpdateNote: resolutionEvidence.trim(),
                    })
                  }
                  className="px-4 py-1.5 rounded-lg bg-teal-700 text-white font-semibold disabled:opacity-50"
                >
                  حفظ الحل وإرساله لتأكيد العميل
                </button>
              </div>
            )}

            {showCancelBox && (
              <div className="p-3.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <input
                  type="text"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="سبب الإلغاء الموثق (مثال: بلاغ مكرر مؤكد من العميل)..."
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  disabled={isUpdating || !cancellationReason.trim()}
                  onClick={() =>
                    runLifecycleUpdate("cancelled", {
                      cancellationReason: cancellationReason.trim(),
                    })
                  }
                  className="px-4 py-1.5 rounded-lg bg-slate-700 text-white font-semibold disabled:opacity-50"
                >
                  تأكيد الإلغاء الموثق
                </button>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={complaint.status === "new"}
                onClick={() => {
                  onClose();
                  onGoToManagerPortal();
                }}
                className="px-4 py-2 rounded-lg bg-[#961B5E] text-white text-xs font-semibold hover:bg-[#7A144B] disabled:opacity-40"
              >
                الانتقال للإغلاق النهائي (بوابة المدير)
              </button>
            </div>
          </div>
        )}

        {/* Chronological Audit Trail */}
        {Array.isArray(complaint.auditTrail) && complaint.auditTrail.length > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2.5">
            <p className="text-xs font-bold text-[#1B2E66] dark:text-slate-100">
              سجل الإجراءات الزمني (Audit Trail — غير قابل للتعديل)
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {[...complaint.auditTrail].reverse().map((entry) => (
                <div
                  key={entry.id}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs flex flex-wrap items-start justify-between gap-2"
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {entry.action}{" "}
                      <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                        ({entry.actorName})
                      </span>
                    </p>
                    {entry.note && (
                      <p className="text-slate-600 dark:text-slate-300 mt-0.5">{entry.note}</p>
                    )}
                  </div>
                  <span className="font-mono tabular-nums text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                    {formatArabicDate(entry.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
