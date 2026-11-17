import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Paperclip,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Star,
  UserCheck,
} from "lucide-react";
import {
  CATEGORY_LABELS,
  ComplaintCategory,
  FANAR_BRANCHES,
  FANAR_COMPANY_INFO,
  FANAR_REGIONS,
  FANAR_STATIONS,
  formatArabicDate,
  SLA_TIERS,
  SlaTier,
} from "../types/crm";
import { StationPicker } from "./StationPicker";

interface CustomerPortalViewProps {
  onSwitchToStaff: () => void;
}

interface RedactedPortalTicket {
  ticketCode: string;
  status: string;
  publicStatusLabel: string;
  expectedNextStep: string;
  branch: string;
  stationUnknown: boolean;
  category: string;
  slaTier: SlaTier;
  createdAtIso: string;
  updatedAtIso: string;
  publicUpdateNote: string;
  resolutionSummary: string;
  customerConfirmed: boolean;
  csatScore: number;
  canConfirmOrReopen: boolean;
  canAddInfo: boolean;
  customerTimeline: Array<{ timestamp: string; label: string }>;
}

const ALLOWED_FILE_TYPES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  onSwitchToStaff,
}) => {
  const [portalTab, setPortalTab] = useState<"submit" | "track">("submit");

  // Submission state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [category, setCategory] = useState<ComplaintCategory>("billing_pump");
  const [branch, setBranch] = useState(FANAR_BRANCHES[0]);
  const [stationUnknown, setStationUnknown] = useState(false);
  const [pumpNumber, setPumpNumber] = useState("");
  const [description, setDescription] = useState("");
  const [attachmentMeta, setAttachmentMeta] = useState<{
    fileName: string;
    fileType: string;
    sizeBytes: number;
  } | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{
    ticketCode: string;
    slaTier: SlaTier;
    stationUnknown: boolean;
    duplicateWarning: boolean;
    duplicateTicketCode: string | null;
    phoneUsed: string;
  } | null>(null);

  // Tracking & Confirmation state
  const [trackCode, setTrackCode] = useState("");
  const [trackPhone, setTrackPhone] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [trackedTicket, setTrackedTicket] = useState<RedactedPortalTicket | null>(null);

  const [extraInfoText, setExtraInfoText] = useState("");
  const [csatScore, setCsatScore] = useState<number>(5);
  const [csatComment, setCsatComment] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [showReopenBox, setShowReopenBox] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [directoryRegion, setDirectoryRegion] = useState<string>("all");
  const [directorySearch, setDirectorySearch] = useState("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAttachmentError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setAttachmentMeta(null);
      return;
    }
    if (!ALLOWED_FILE_TYPES.includes(file.type.toLowerCase())) {
      setAttachmentMeta(null);
      setAttachmentError("صيغة الملف غير مدعومة. الصيغ المسموحة هي JPG و PNG و PDF فقط.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentMeta(null);
      setAttachmentError("حجم المرفق يتجاوز الحد المسموح به (10 ميجابايت).");
      e.target.value = "";
      return;
    }
    setAttachmentMeta({
      fileName: file.name,
      fileType: file.type,
      sizeBytes: file.size,
    });
  }

  async function handleSubmitComplaint(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/portal/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          category,
          branch: stationUnknown ? "" : branch,
          stationUnknown,
          pumpNumber: pumpNumber.trim() || (stationUnknown ? "غير محدد" : "عام"),
          description,
          attachmentMeta: attachmentMeta || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "تعذر تسجيل الطلب حالياً.");
      }

      setSubmittedResult({
        ticketCode: data.ticketCode,
        slaTier: data.slaTier || "P3",
        stationUnknown: Boolean(data.stationUnknown),
        duplicateWarning: Boolean(data.duplicateWarning),
        duplicateTicketCode: data.duplicateTicketCode || null,
        phoneUsed: customerPhone,
      });
      setDescription("");
      setPumpNumber("");
      setAttachmentMeta(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "تعذر تسجيل الشكوى");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function fetchTicketStatus(codeToFind: string, phoneToFind: string) {
    setIsTracking(true);
    setTrackError(null);
    setActionNotice(null);
    setActionError(null);
    try {
      const response = await fetch("/api/portal/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketCode: codeToFind.trim().toUpperCase(),
          customerPhone: phoneToFind.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "تعذر التحقق من الطلب.");
      }
      setTrackedTicket(data.ticket as RedactedPortalTicket);
      setShowReopenBox(false);
    } catch (err) {
      setTrackedTicket(null);
      setTrackError(err instanceof Error ? err.message : "تعذر العثور على الطلب.");
    } finally {
      setIsTracking(false);
    }
  }

  async function handleTrackSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isTracking) return;
    await fetchTicketStatus(trackCode, trackPhone);
  }

  async function handleCustomerAction(
    action: "add_info" | "request_agent" | "confirm_resolved" | "reopen",
    payload?: { note?: string; csatScore?: number; csatComment?: string }
  ) {
    if (!trackedTicket || actionLoading) return;
    setActionLoading(true);
    setActionNotice(null);
    setActionError(null);
    try {
      const response = await fetch(
        `/api/portal/complaints/${encodeURIComponent(trackedTicket.ticketCode)}/customer-action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerPhone: trackPhone.trim(),
            action,
            note: payload?.note,
            csatScore: payload?.csatScore,
            csatComment: payload?.csatComment,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "تعذر تنفيذ الإجراء.");
      }
      setTrackedTicket(data.ticket as RedactedPortalTicket);
      if (action === "add_info") {
        setExtraInfoText("");
        setActionNotice("تمت إضافة معلوماتك إلى البلاغ وسيطلع عليها الفريق المختص.");
      } else if (action === "request_agent") {
        setActionNotice("تم إرسال طلبك للتواصل مع موظف خدمة العملاء.");
      } else if (action === "confirm_resolved") {
        setCsatComment("");
        setActionNotice("شكراً لتأكيدك! تم إغلاق الشكوى وتوثيق تقييمك بنجاح.");
      } else if (action === "reopen") {
        setReopenReason("");
        setShowReopenBox(false);
        setActionNotice("تمت إعادة فتح الشكوى وإعادتها للمعالجة ذات الأولوية.");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "تعذر تنفيذ الإجراء.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Portal Intro & Segmented Navigation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[#961B5E] dark:text-pink-400">
            بوابة عملاء شركة فنار الطاقة للوقود
          </p>
          <h1
            className="text-2xl font-bold text-[#1B2E66] dark:text-slate-100"
            style={{ fontFamily: "var(--font-display)" }}
          >
            تسجيل الشكاوى ومتابعة الحل وتقييم الخدمة
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            سجّل ملاحظتك خلال دقيقة واحدة واحصل على الرقم المرجعي فوراً، أو تابع حالة طلبك بالتحقق الثنائي.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setPortalTab("submit")}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              portalTab === "submit"
                ? "bg-white dark:bg-slate-950 text-[#1B2E66] dark:text-slate-100"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            تسجيل شكوى جديدة
          </button>
          <button
            type="button"
            onClick={() => setPortalTab("track")}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              portalTab === "track"
                ? "bg-white dark:bg-slate-950 text-[#1B2E66] dark:text-slate-100"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            متابعة طلب وتأكيد الحل
          </button>
        </div>
      </div>

      {portalTab === "submit" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Submission Form */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 lg:p-7 space-y-5">
            {submittedResult ? (
              <div className="space-y-5">
                <div className="p-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>تم استلام بلاغكم وإدراجه في النظام بنجاح</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        الرقم المرجعي الرسمي للشكوى:
                      </p>
                      <p className="text-2xl font-bold font-mono text-[#961B5E] dark:text-pink-400 tabular-nums mt-1">
                        {submittedResult.ticketCode}
                      </p>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                      <p>
                        مستوى الأولوية SLA:{" "}
                        <strong className="font-mono text-[#1B2E66] dark:text-sky-300">
                          {SLA_TIERS[submittedResult.slaTier].label}
                        </strong>
                      </p>
                      <p>
                        الاستجابة الأولى المستهدفة:{" "}
                        <strong className="font-mono tabular-nums">
                          {SLA_TIERS[submittedResult.slaTier].firstResponseMinutes} دقيقة
                        </strong>
                      </p>
                    </div>
                  </div>

                  {submittedResult.stationUnknown && (
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      ملاحظة: سيتم مراجعة الطلب يدوياً لتحديد المحطة المختصة بناءً على تفاصيلكم.
                    </p>
                  )}

                  {submittedResult.duplicateWarning && (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        تنبيه تكرار (خلال 48 ساعة): لديكم بلاغ مفتوح سابق بنفس التصنيف برمز{" "}
                        <strong className="font-mono tabular-nums">
                          {submittedResult.duplicateTicketCode}
                        </strong>
                        ، وتم حفظ بلاغكم الجديد دون حذف أي سجل.
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTrackCode(submittedResult.ticketCode);
                      setTrackPhone(submittedResult.phoneUsed);
                      setPortalTab("track");
                      void fetchTicketStatus(submittedResult.ticketCode, submittedResult.phoneUsed);
                    }}
                    className="px-4 py-2.5 rounded-lg bg-[#1B2E66] dark:bg-[#0D74B8] text-white text-xs font-semibold hover:bg-[#12204A] dark:hover:bg-[#0A5D94]"
                  >
                    الانتقال لمتابعة هذا الطلب الآن
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmittedResult(null)}
                    className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    تسجيل شكوى أخرى
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitComplaint} className="space-y-4">
                <div>
                  <h2 className="text-base font-bold text-[#1B2E66] dark:text-slate-100">
                    نموذج تقديم شكوى أو ملاحظة
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    حقول مبسطة لضمان سرعة التسجيل وإصدار الرقم المرجعي مباشرة.
                  </p>
                </div>

                {submitError && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                    {submitError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      الاسم الكامل
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="مثال: عبدالله الشهري"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-[#0D74B8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      رقم الجوال (للتحقق والمتابعة)
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="05XXXXXXXX"
                      className="w-full px-3 py-2 text-xs font-mono text-left bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-[#0D74B8]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      تصنيف الشكوى
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                    >
                      {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      رقم المضخة / الموقع (اختياري)
                    </label>
                    <input
                      type="text"
                      value={pumpNumber}
                      onChange={(e) => setPumpNumber(e.target.value)}
                      placeholder="مثال: مضخة 4 أو التموينات"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                    />
                  </div>
                </div>

                <StationPicker
                  label="المحطة التي وقفت فيها"
                  value={branch}
                  onChange={setBranch}
                  allowUnknown
                  stationUnknown={stationUnknown}
                  onStationUnknownChange={setStationUnknown}
                  showPreviewCard
                />

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    تفاصيل الملاحظة أو الشكوى
                  </label>
                  <textarea
                    rows={4}
                    required
                    minLength={10}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="اكتب وصفاً مختصراً للمشكلة ووقت حدوثها..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-[#0D74B8]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    إرفاق فاتورة أو صورة توضيحية (اختياري — JPG / PNG / PDF بحد أقصى 10MB)
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>اختيار ملف</span>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                        onChange={handleFileChange}
                        className="sr-only"
                      />
                    </label>
                    {attachmentMeta && (
                      <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                        {attachmentMeta.fileName} (
                        {Math.max(1, Math.round(attachmentMeta.sizeBytes / 1024))} KB)
                      </span>
                    )}
                  </div>
                  {attachmentError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{attachmentError}</p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={onSwitchToStaff}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-[#1B2E66] dark:hover:text-sky-300"
                  >
                    العودة لدخول الموظفين
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#961B5E] hover:bg-[#7A144B] text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? "جاري التسجيل..." : "إرسال الشكوى وإصدار الرمز"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Customer SLA Guarantees & Privacy Notice */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
                التزامات مستوى الخدمة والخصوصية (SLA)
              </h3>
              <div className="space-y-3 text-xs">
                {(["P1", "P2", "P3", "P4"] as const).map((tierKey) => {
                  const t = SLA_TIERS[tierKey];
                  return (
                    <div
                      key={tierKey}
                      className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3"
                    >
                      <div>
                        <p className="font-bold text-[#1B2E66] dark:text-slate-100">{t.label}</p>
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5">{t.examples}</p>
                      </div>
                      <div className="text-left font-mono tabular-nums shrink-0 text-slate-700 dark:text-slate-300">
                        <p>رد: {t.firstResponseMinutes}د</p>
                        <p>حل: {t.resolutionHours}س</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  لأمن بياناتكم، لا يمكن استعراض أي طلب برقم المرجع وحده؛ يلزم تطابق الرقم
                  المرجعي مع رقم الجوال المسجل معاً.
                </span>
              </div>
            </div>

            {/* Concise 19-Station Directory & HQ Contact */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
                    دليل محطات فنار (19 محطة)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    الرقم الموحد:{" "}
                    <span dir="ltr" className="font-mono font-semibold text-[#961B5E] dark:text-pink-400 tabular-nums">
                      {FANAR_COMPANY_INFO.unifiedPhone}
                    </span>{" "}
                    · {FANAR_COMPANY_INFO.city}
                  </p>
                </div>
              </div>

              <input
                type="text"
                value={directorySearch}
                onChange={(e) => setDirectorySearch(e.target.value)}
                placeholder="ابحث بالكود ST أو الاسم أو المدينة..."
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
              />

              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setDirectoryRegion("all")}
                  className={`px-2 py-1 rounded text-[11px] font-medium ${
                    directoryRegion === "all"
                      ? "bg-[#1B2E66] text-white dark:bg-[#0D74B8]"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  الكل (19)
                </button>
                {FANAR_REGIONS.map((reg) => (
                  <button
                    key={reg}
                    type="button"
                    onClick={() => setDirectoryRegion(reg)}
                    className={`px-2 py-1 rounded text-[11px] font-medium ${
                      directoryRegion === reg
                        ? "bg-[#961B5E] text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {reg}
                  </button>
                ))}
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                {FANAR_STATIONS.filter((st) => {
                  if (directoryRegion !== "all" && st.region !== directoryRegion) return false;
                  const q = directorySearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    st.code.toLowerCase().includes(q) ||
                    st.name.toLowerCase().includes(q) ||
                    st.city.toLowerCase().includes(q) ||
                    st.region.toLowerCase().includes(q)
                  );
                }).map((st) => {
                  const isActive = !stationUnknown && branch === st.label;
                  return (
                    <div
                      key={st.code}
                      className={`px-3 py-2 flex items-center justify-between gap-2 text-xs ${
                        isActive ? "bg-[#0D74B8]/10 dark:bg-sky-950/40" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[#1B2E66] dark:text-slate-100 truncate">
                          <span className="font-mono tabular-nums text-[#961B5E] dark:text-pink-400">
                            {st.code}
                          </span>{" "}
                          · {st.name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {st.city} ({st.region}) · <span className="font-mono tabular-nums">{st.phone}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setStationUnknown(false);
                          setBranch(st.label);
                        }}
                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-[#0D74B8] dark:text-sky-300 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 whitespace-nowrap"
                      >
                        {isActive ? "مختارة" : "تحديد"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Dual-Verification Lookup Form */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#1B2E66] dark:text-slate-100">
                التحقق الثنائي لمتابعة الشكوى
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                أدخل الرقم المرجعي (FNR-...) مع رقم الجوال المسجل لاستعراض حالة المعالجة.
              </p>
            </div>

            {trackError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {trackError}
              </div>
            )}

            <form onSubmit={handleTrackSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  الرقم المرجعي للشكوى
                </label>
                <input
                  type="text"
                  dir="ltr"
                  required
                  value={trackCode}
                  onChange={(e) => setTrackCode(e.target.value)}
                  placeholder="FNR-2611-4018"
                  className="w-full px-3 py-2 text-xs font-mono text-left bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-[#0D74B8]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  رقم الجوال المسجل في الشكوى
                </label>
                <input
                  type="text"
                  dir="ltr"
                  required
                  value={trackPhone}
                  onChange={(e) => setTrackPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full px-3 py-2 text-xs font-mono text-left bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-[#0D74B8]"
                />
              </div>

              <button
                type="submit"
                disabled={isTracking}
                className="w-full py-2.5 px-4 rounded-lg bg-[#1B2E66] dark:bg-[#0D74B8] hover:bg-[#12204A] dark:hover:bg-[#0A5D94] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
                <span>{isTracking ? "جاري التحقق..." : "استعراض حالة الشكوى"}</span>
              </button>
            </form>
          </div>

          {/* Public Ticket View (Strict Redaction — No Internal Notes) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            {!trackedTicket ? (
              <div className="py-16 text-center space-y-2 text-slate-500 dark:text-slate-400">
                <FileText className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  بانتظار إدخال الرقم المرجعي ورقم الجوال
                </p>
                <p className="text-xs">
                  ستظهر هنا الحالة المبسطة، الخطوة المتوقعة، التحديثات، وخيار تأكيد الحل وتقييم الخدمة.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">الرقم المرجعي</p>
                    <h3 className="text-xl font-bold font-mono text-[#961B5E] dark:text-pink-400 tabular-nums">
                      {trackedTicket.ticketCode}
                    </h3>
                  </div>
                  <div className="text-left">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1B2E66] dark:text-sky-300">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{trackedTicket.publicStatusLabel}</span>
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                      SLA: {trackedTicket.slaTier}
                    </p>
                  </div>
                </div>

                {actionNotice && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300">
                    {actionNotice}
                  </div>
                )}

                {actionError && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                    {actionError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                  <p>
                    <span className="text-slate-500 dark:text-slate-400">المحطة: </span>
                    <strong className="text-slate-900 dark:text-slate-100">
                      {trackedTicket.branch}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-500 dark:text-slate-400">تاريخ التسجيل: </span>
                    <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatArabicDate(trackedTicket.createdAtIso)}
                    </strong>
                  </p>
                  <p className="sm:col-span-2">
                    <span className="text-slate-500 dark:text-slate-400">الخطوة المتوقعة: </span>
                    <strong className="text-[#1B2E66] dark:text-sky-300">
                      {trackedTicket.expectedNextStep}
                    </strong>
                  </p>
                  <p className="sm:col-span-2">
                    <span className="text-slate-500 dark:text-slate-400">آخر تحديث: </span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {trackedTicket.publicUpdateNote}
                    </span>
                  </p>
                </div>

                {/* Confirm Resolution or Reopen Flow when Resolved */}
                {trackedTicket.canConfirmOrReopen && (
                  <div className="p-4 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900 space-y-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-teal-900 dark:text-teal-200">
                        تأكيد الحل وتقييم جودة الخدمة (CSAT)
                      </h4>
                      <p className="text-xs text-teal-800 dark:text-teal-300">
                        {trackedTicket.resolutionSummary}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                        تقييمكم لمستوى الحل والخدمة (من 1 إلى 5):
                      </p>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((score) => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => setCsatScore(score)}
                            className={`p-2 rounded-lg border transition-colors ${
                              score <= csatScore
                                ? "border-amber-400 bg-amber-50 dark:bg-amber-950/50 text-amber-500"
                                : "border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600"
                            }`}
                            aria-label={`تقييم ${score} من 5`}
                          >
                            <Star className="w-4 h-4 fill-current" />
                          </button>
                        ))}
                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 tabular-nums mr-2">
                          {csatScore} / 5
                        </span>
                      </div>
                      <input
                        type="text"
                        value={csatComment}
                        onChange={(e) => setCsatComment(e.target.value)}
                        placeholder="ملاحظة إضافية حول التجربة (اختياري)..."
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() =>
                          handleCustomerAction("confirm_resolved", {
                            csatScore,
                            csatComment,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تأكيد الحل وإغلاق الشكوى</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowReopenBox((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>المشكلة مستمرة — إعادة فتح</span>
                      </button>
                    </div>

                    {showReopenBox && (
                      <div className="pt-3 border-t border-teal-200 dark:border-teal-800 space-y-2">
                        <textarea
                          rows={2}
                          value={reopenReason}
                          onChange={(e) => setReopenReason(e.target.value)}
                          placeholder="اذكر سبب استمرار المشكلة لإعادة فتح التذكرة ومراجعتها..."
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                        />
                        <button
                          type="button"
                          disabled={actionLoading || !reopenReason.trim()}
                          onClick={() =>
                            handleCustomerAction("reopen", { note: reopenReason.trim() })
                          }
                          className="px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold disabled:opacity-50"
                        >
                          تأكيد إعادة فتح الشكوى
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Add Info or Request Agent */}
                {trackedTicket.canAddInfo && (
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={extraInfoText}
                        onChange={(e) => setExtraInfoText(e.target.value)}
                        placeholder="أضف معلومات إضافية أو رقم الفاتورة للمختص..."
                        className="flex-1 min-w-[200px] px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                      />
                      <button
                        type="button"
                        disabled={actionLoading || !extraInfoText.trim()}
                        onClick={() =>
                          handleCustomerAction("add_info", { note: extraInfoText.trim() })
                        }
                        className="px-3.5 py-2 rounded-lg bg-[#1B2E66] dark:bg-[#0D74B8] text-white text-xs font-medium disabled:opacity-50"
                      >
                        إضافة معلومات
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleCustomerAction("request_agent")}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>طلب موظف</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Customer-Safe Timeline */}
                {trackedTicket.customerTimeline.length > 0 && (
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2">
                    <p className="text-xs font-semibold text-[#1B2E66] dark:text-slate-100">
                      سجل متابعة الطلب
                    </p>
                    <div className="space-y-2">
                      {trackedTicket.customerTimeline.map((item, idx) => (
                        <div
                          key={`${item.timestamp}_${idx}`}
                          className="flex items-center justify-between gap-3 text-xs border-b border-slate-100 dark:border-slate-800 pb-2 last:border-b-0"
                        >
                          <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                          <span className="font-mono tabular-nums text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                            {formatArabicDate(item.timestamp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
