import React, { useState } from "react";
import { CheckCircle2, Lock, Printer, RotateCcw, ShieldCheck, Star } from "lucide-react";
import {
  closeComplaintByManager,
  updateComplaintLifecycle,
} from "../lib/crmService";
import {
  CATEGORY_LABELS,
  CHANNEL_LABELS,
  CLOSURE_REASONS,
  Complaint,
  Conversation,
  formatArabicDate,
  getComplaintEffectiveDate,
} from "../types/crm";
import { PriorityLabel, SlaBadge, StatusIndicator } from "./StatusIndicator";

interface ManagerPortalViewProps {
  ownerId: string;
  managerName: string;
  canCloseAsManager: boolean;
  complaints: Complaint[];
  conversations: Conversation[];
  onPrintSingle: (complaint: Complaint) => void;
  onPrintRegister: (filtered: Complaint[], summary: string) => void;
}

export const ManagerPortalView: React.FC<ManagerPortalViewProps> = ({
  ownerId,
  managerName,
  canCloseAsManager,
  complaints,
  conversations,
  onPrintSingle,
  onPrintRegister,
}) => {
  const openQueue = complaints.filter(
    (c) => c.status !== "closed" && c.status !== "cancelled"
  );
  const closedQueue = complaints.filter((c) => c.status === "closed");

  const [selectedId, setSelectedId] = useState<string>(openQueue[0]?.id || "");
  const [closureReason, setClosureReason] = useState<string>(CLOSURE_REASONS[0]);
  const [resolutionEvidence, setResolutionEvidence] = useState<string>("");
  const [managerNotes, setManagerNotes] = useState<string>("");
  const [notifyWhatsapp, setNotifyWhatsapp] = useState<boolean>(true);
  const [isClosing, setIsClosing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeTicket =
    openQueue.find((c) => c.id === selectedId) || openQueue[0] || null;

  async function handleMoveFromNewToProgress() {
    if (!activeTicket) return;
    setIsClosing(true);
    setError(null);
    try {
      await updateComplaintLifecycle({
        complaint: activeTicket,
        nextStatus: "in_progress",
        actorName: managerName,
        actorRole: "manager",
        note: "بدء المعالجة الميدانية من بوابة الإدارة قبل اعتماد الإغلاق النهائي",
      });
      setFeedback(`تم نقل الشكوى ${activeTicket.ticketCode} إلى «قيد المعالجة» بنجاح.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحديث الحالة");
    } finally {
      setIsClosing(false);
    }
  }

  async function handleCloseTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTicket || !canCloseAsManager || isClosing) return;

    if (activeTicket.status === "new") {
      setError("قاعدة دورة الحياة: لا يمكن القفز مباشرة من «جديدة» إلى «مغلقة». يرجى بدء المعالجة أولاً.");
      return;
    }

    setIsClosing(true);
    setError(null);
    setFeedback(null);
    try {
      await closeComplaintByManager({
        complaint: activeTicket,
        managerName,
        closureReason,
        managerNotes,
        resolutionEvidence:
          resolutionEvidence.trim() || activeTicket.resolutionEvidence || closureReason,
        notifyCustomerWhatsapp: notifyWhatsapp,
        conversations,
        ownerId,
      });
      setFeedback(
        `تم اعتماد إغلاق الشكوى ${activeTicket.ticketCode} بنجاح${
          notifyWhatsapp ? " وإرسال إشعار الإغلاق للعميل عبر الواتساب" : ""
        }.`
      );
      setManagerNotes("");
      setResolutionEvidence("");
      setSelectedId("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "تعذر إغلاق الشكوى. تأكد من امتلاك صلاحية مدير خدمة العملاء."
      );
    } finally {
      setIsClosing(false);
    }
  }

  async function handleReopenClosed(ticket: Complaint) {
    if (!canCloseAsManager || isClosing) return;
    setIsClosing(true);
    setError(null);
    try {
      await updateComplaintLifecycle({
        complaint: ticket,
        nextStatus: "reopened",
        actorName: managerName,
        actorRole: "manager",
        reopenReason: "إعادة فتح إدارية لمراجعة جودة الحل والتأكد من رضا العميل",
      });
      setFeedback(`تمت إعادة فتح الشكوى ${ticket.ticketCode} وإرجاعها لقائمة المتابعة.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إعادة فتح الشكوى");
    } finally {
      setIsClosing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Manager Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#961B5E] dark:text-pink-400" />
            <h2 className="text-base font-bold text-[#1B2E66] dark:text-slate-100">
              بوابة مدير خدمة العملاء — متابعة SLA واعتماد الإغلاق
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            مراجعة الشكاوى المفتوحة والمصعّدة، توثيق الدليل والقرار النهائي، إغلاق الطلب أو إعادة فتحه، وإصدار التقارير المعتمدة.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            onPrintRegister(closedQueue, "تقرير الشكاوى المغلقة والمعتمدة من مدير خدمة العملاء")
          }
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1B2E66] dark:border-sky-500 text-[#1B2E66] dark:text-sky-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة تقرير الشكاوى المغلقة ({closedQueue.length})</span>
        </button>
      </div>

      {!canCloseAsManager && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 flex items-center gap-3 text-xs text-amber-800 dark:text-amber-300">
          <Lock className="w-4 h-4 shrink-0" />
          <span>
            أنت تتصفح النظام بصلاحية غير مخوّلة للاعتماد النهائي. قرار الإغلاق النهائي للشكاوى متاح
            حصرياً لحساب مدير خدمة العملاء أو مسؤول النظام.
          </span>
        </div>
      )}

      {feedback && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Split Workspace: Open Queue + Manager Closure Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Queue List */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
              الطلبات المفتوحة والمصعّدة
            </h3>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {openQueue.length} طلب
            </span>
          </div>

          {openQueue.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              جميع الشكاوى الحالية مغلقة ومكتملة.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[560px] overflow-y-auto">
              {openQueue.map((c) => {
                const selected = c.id === activeTicket?.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(c.id);
                      setFeedback(null);
                      setError(null);
                    }}
                    className={`w-full text-right p-4 transition-colors ${
                      selected
                        ? "bg-[#1B2E66]/5 dark:bg-slate-800"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-[#961B5E] dark:text-pink-400 tabular-nums">
                        {c.ticketCode}
                      </span>
                      <StatusIndicator status={c.status} />
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                      {c.customerName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                      {c.description}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-2 gap-2">
                      <SlaBadge complaint={c} />
                      <PriorityLabel priority={c.priority} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Manager Review & Closure Panel */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          {!activeTicket ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-400 py-16">
              لا توجد طلبات مفتوحة للمراجعة حالياً.
            </div>
          ) : (
            <form onSubmit={handleCloseTicket} className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    مراجعة واعتماد إغلاق الشكوى
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <h3 className="text-lg font-bold font-mono text-[#1B2E66] dark:text-sky-300 tabular-nums">
                      {activeTicket.ticketCode}
                    </h3>
                    <SlaBadge complaint={activeTicket} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onPrintSingle(activeTicket)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة التذكرة</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">العميل: </span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    {activeTicket.customerName}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">الجوال: </span>
                  <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {activeTicket.customerPhone}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">المحطة: </span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    {activeTicket.branch}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">التصنيف والقناة: </span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    {CATEGORY_LABELS[activeTicket.category]} ·{" "}
                    {CHANNEL_LABELS[activeTicket.channel]}
                  </strong>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#1B2E66] dark:text-slate-100">
                  تفاصيل البلاغ وسابقة الحل:
                </p>
                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5">
                  {activeTicket.description}
                </p>
                {activeTicket.resolutionEvidence && (
                  <p className="text-xs text-teal-800 dark:text-teal-300">
                    <strong>دليل الحل المسجل: </strong>
                    {activeTicket.resolutionEvidence}
                  </p>
                )}
                {activeTicket.reopenReason && (
                  <p className="text-xs text-rose-700 dark:text-rose-300">
                    <strong>سبب إعادة الفتح ({activeTicket.reopenCount || 1}×): </strong>
                    {activeTicket.reopenReason}
                  </p>
                )}
                {activeTicket.csatScore ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300 inline-flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>تأكيد العميل وتقييمه: {activeTicket.csatScore}/5</span>
                  </p>
                ) : null}
              </div>

              {activeTicket.status === "new" && (
                <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
                  <span>
                    الشكوى ما زالت بحالة «جديدة» — يجب بدء المعالجة قبل اعتماد الإغلاق النهائي.
                  </span>
                  <button
                    type="button"
                    disabled={isClosing}
                    onClick={handleMoveFromNewToProgress}
                    className="px-3 py-1.5 rounded-lg bg-[#1B2E66] text-white font-semibold hover:bg-[#12204A]"
                  >
                    نقل إلى قيد المعالجة الآن
                  </button>
                </div>
              )}

              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1B2E66] dark:text-slate-100 mb-1.5">
                    قرار المعالجة والإغلاق المعتمد
                  </label>
                  <select
                    value={closureReason}
                    onChange={(e) => setClosureReason(e.target.value)}
                    disabled={!canCloseAsManager}
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-800/60"
                  >
                    {CLOSURE_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1B2E66] dark:text-slate-100 mb-1.5">
                    دليل الحل / الإثبات الميداني المعتمد (يظهر لملخص العميل)
                  </label>
                  <input
                    type="text"
                    disabled={!canCloseAsManager}
                    value={resolutionEvidence}
                    onChange={(e) => setResolutionEvidence(e.target.value)}
                    placeholder={
                      activeTicket.resolutionEvidence ||
                      "مثال: تم إرجاع الفرق لحساب العميل ومراجعة المضخة..."
                    }
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1B2E66] dark:text-slate-100 mb-1.5">
                    ملاحظات مدير خدمة العملاء والتوصية التشغيلية
                  </label>
                  <textarea
                    rows={3}
                    required
                    disabled={!canCloseAsManager}
                    value={managerNotes}
                    onChange={(e) => setManagerNotes(e.target.value)}
                    placeholder="اكتب الإجراء المتخذ مع العميل أو المحطة قبل الإغلاق النهائي..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg disabled:bg-slate-50 dark:disabled:bg-slate-800/60"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyWhatsapp}
                    onChange={(e) => setNotifyWhatsapp(e.target.checked)}
                    disabled={!canCloseAsManager}
                    className="rounded border-slate-300 dark:border-slate-600 text-[#961B5E]"
                  />
                  <span>إرسال إشعار إغلاق الشكوى تلقائياً إلى واتساب العميل</span>
                </label>

                <button
                  type="submit"
                  disabled={
                    !canCloseAsManager ||
                    isClosing ||
                    !managerNotes.trim() ||
                    activeTicket.status === "new"
                  }
                  className="w-full py-2.5 px-5 rounded-lg bg-[#961B5E] hover:bg-[#7A144B] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {isClosing ? "جاري اعتماد الإغلاق..." : "اعتماد وإغلاق الشكوى نهائياً"}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Closed Archive Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
            أرشيف الشكاوى المغلقة
          </h3>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            {closedQueue.length} شكاوى مغلقة
          </span>
        </div>

        {closedQueue.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            لم يتم إغلاق شكاوى بعد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <th className="py-3 px-4">الرمز</th>
                  <th className="py-3 px-4">العميل</th>
                  <th className="py-3 px-4">قرار الإغلاق</th>
                  <th className="py-3 px-4">SLA / CSAT</th>
                  <th className="py-3 px-4">تاريخ التسجيل / الإغلاق</th>
                  <th className="py-3 px-4">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {closedQueue.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60">
                    <td className="py-3 px-4 font-mono font-semibold text-[#1B2E66] dark:text-sky-300 tabular-nums">
                      {c.ticketCode}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                      {c.customerName}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {c.closureReason}
                    </td>
                    <td className="py-3 px-4">
                      <SlaBadge complaint={c} />
                      {c.csatScore ? (
                        <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 tabular-nums">
                          CSAT: {c.csatScore}/5
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {formatArabicDate(c.closedAt || getComplaintEffectiveDate(c))}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onPrintSingle(c)}
                          className="inline-flex items-center gap-1 text-[#0D74B8] dark:text-sky-400 hover:underline"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>طباعة</span>
                        </button>
                        {canCloseAsManager && (
                          <button
                            type="button"
                            disabled={isClosing}
                            onClick={() => handleReopenClosed(c)}
                            className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400 hover:underline"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>إعادة فتح</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
