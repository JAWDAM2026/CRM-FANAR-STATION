import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Database,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  createActionPlanItem,
  createOrUpdateQualityAudit,
  updateActionPlanStatus,
  updateUserRoleProfile,
} from "../lib/crmService";
import {
  ActionPlanItem,
  calculateWeightedQualityScore,
  Complaint,
  FANAR_BRANCHES,
  QUALITY_CRITERIA_WEIGHTS,
  QualityAudit,
  ROLE_PERMISSION_DESCRIPTIONS,
  USER_ROLE_LABELS,
  UserProfile,
  UserRole,
} from "../types/crm";

interface QualityGovernanceViewProps {
  ownerId: string;
  actorName: string;
  complaints: Complaint[];
  qualityAudits: QualityAudit[];
  actionPlans: ActionPlanItem[];
  teamUsers: UserProfile[];
  canManageRoles: boolean;
  onBackfillHistoricalData?: () => Promise<void>;
  isBackfilling?: boolean;
}

const FIVE_DAY_CYCLE = [
  { day: "اليوم 1", title: "سحب البيانات وتجميد اللقطة", desc: "تثبيت بيانات الشهر وإغلاق المراجعات المعلقة" },
  { day: "اليوم 2", title: "تدقيق الشواذ والتكرار", desc: "مراجعة حالات التجاوز SLA والشكاوى المعاد فتحها" },
  { day: "اليوم 3", title: "تحليل الأسباب والمحطات", desc: "ترتيب الأسباب الجذرية ومصفوفة أداء الفروع" },
  { day: "اليوم 4", title: "جودة الردود والخصوصية", desc: "فحص عينات التقييم الموزون (5 معايير / 100%)" },
  { day: "اليوم 5", title: "الاعتماد وخطة العمل", desc: "توزيع الملخص التنفيذي وتكليف ملاك الإجراءات" },
];

export const QualityGovernanceView: React.FC<QualityGovernanceViewProps> = ({
  ownerId,
  actorName,
  complaints,
  qualityAudits,
  actionPlans,
  teamUsers,
  canManageRoles,
  onBackfillHistoricalData,
  isBackfilling = false,
}) => {
  const auditableComplaints = useMemo(
    () =>
      [...complaints].sort((a, b) => {
        const aDone = a.status === "resolved" || a.status === "closed" ? 0 : 1;
        const bDone = b.status === "resolved" || b.status === "closed" ? 0 : 1;
        return aDone - bDone;
      }),
    [complaints]
  );

  // Quality Audit Form state
  const [selectedComplaintId, setSelectedComplaintId] = useState<string>(
    auditableComplaints[0]?.id || ""
  );
  const [problemUnderstanding, setProblemUnderstanding] = useState<number>(90);
  const [communication, setCommunication] = useState<number>(90);
  const [solutionAndEvidence, setSolutionAndEvidence] = useState<number>(85);
  const [recordCompleteness, setRecordCompleteness] = useState<number>(90);
  const [privacyCompliance, setPrivacyCompliance] = useState<number>(100);
  const [improvementNotes, setImprovementNotes] = useState<string>("");
  const [isSavingAudit, setIsSavingAudit] = useState(false);
  const [auditFeedback, setAuditFeedback] = useState<string | null>(null);

  // Action Plan Form state
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [planTitle, setPlanTitle] = useState("");
  const [planRootCause, setPlanRootCause] = useState("");
  const [planOwner, setPlanOwner] = useState("مدير المنطقة");
  const [planDue, setPlanDue] = useState("اليوم 15 من الشهر");
  const [planMetric, setPlanMetric] = useState("رفع التزام SLA إلى 92%+");
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  // Role management feedback
  const [roleFeedback, setRoleFeedback] = useState<string | null>(null);

  const previewScore = calculateWeightedQualityScore({
    problemUnderstanding,
    communication,
    solutionAndEvidence,
    recordCompleteness,
    privacyCompliance,
  });

  // 5 Quality KPI Strip (PDF p.16)
  const newTicketsCount = complaints.filter((c) => c.status === "new").length;
  const auditsReviewedCount = qualityAudits.length;
  const needsImprovementCount = qualityAudits.filter(
    (q) => q.status === "needs_improvement"
  ).length;
  const recordCompletenessPct = useMemo(() => {
    if (complaints.length === 0) return 100;
    const complete = complaints.filter(
      (c) =>
        Boolean(c.branch) &&
        Boolean(c.description) &&
        (c.status !== "closed" || Boolean(c.closureReason && c.resolutionEvidence))
    ).length;
    return Math.round((complete / complaints.length) * 100);
  }, [complaints]);
  const avgAuditScore = useMemo(() => {
    if (qualityAudits.length === 0) return 0;
    return Math.round(
      qualityAudits.reduce((sum, q) => sum + q.totalScore, 0) / qualityAudits.length
    );
  }, [qualityAudits]);

  async function handleSaveAudit(e: React.FormEvent) {
    e.preventDefault();
    const comp =
      auditableComplaints.find((c) => c.id === selectedComplaintId) ||
      auditableComplaints[0];
    if (!comp || isSavingAudit) return;

    setIsSavingAudit(true);
    setAuditFeedback(null);
    try {
      const existing = qualityAudits.find((q) => q.complaintId === comp.id);
      await createOrUpdateQualityAudit({
        existingAuditId: existing?.id,
        complaint: comp,
        auditorName: actorName,
        problemUnderstanding,
        communication,
        solutionAndEvidence,
        recordCompleteness,
        privacyCompliance,
        improvementNotes,
        ownerId,
      });
      setAuditFeedback(
        `تم حفظ تقييم الجودة للشكوى ${comp.ticketCode} بدرجة موزونة ${previewScore}/100.`
      );
      setImprovementNotes("");
    } finally {
      setIsSavingAudit(false);
    }
  }

  async function handleCreateActionPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!planTitle.trim() || isSavingPlan) return;
    setIsSavingPlan(true);
    try {
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      await createActionPlanItem({
        title: planTitle,
        rootCause: planRootCause,
        ownerName: planOwner,
        dueDateLabel: planDue,
        targetMetric: planMetric,
        monthKey,
        ownerId,
      });
      setPlanTitle("");
      setPlanRootCause("");
      setShowNewPlan(false);
    } finally {
      setIsSavingPlan(false);
    }
  }

  async function handleUpdateRole(u: UserProfile, role: UserRole, branch: string) {
    if (!canManageRoles) return;
    await updateUserRoleProfile({
      uid: u.uid,
      displayName: u.displayName,
      role,
      branch,
    });
    setRoleFeedback(`تم تحديث صلاحية «${u.displayName}» إلى ${USER_ROLE_LABELS[role]}.`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#961B5E] dark:text-pink-400">
            ضمان الجودة والحوكمة الشهرية (5 معايير + دورة التقرير + الصلاحيات)
          </p>
          <h2 className="text-base font-bold text-[#1B2E66] dark:text-slate-100 mt-0.5">
            لوحة تدقيق الجودة وخطة العمل الشهرية ومصفوفة الأدوار
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            مراجعة عينات الشكاوى وفق نموذج التقييم الموزون (100%)، متابعة بنود التحسين، وإدارة صلاحيات الفريق الخمس
          </p>
        </div>
        {complaints.length < 8 && onBackfillHistoricalData && (
          <button
            type="button"
            disabled={isBackfilling}
            onClick={onBackfillHistoricalData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-semibold"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{isBackfilling ? "جاري التهيئة..." : "تهيئة بيانات التدقيق التأسيسية"}</span>
          </button>
        )}
      </div>

      {/* 5 Quality KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">شكاوى جديدة للمتابعة</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#961B5E] dark:text-pink-400 mt-1.5">
            {newTicketsCount}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">عينات جودة مراجعة</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#1B2E66] dark:text-slate-100 mt-1.5">
            {auditsReviewedCount}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">ملاحظات تحسين (&lt;85)</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400 mt-1.5">
            {needsImprovementCount}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">اكتمال السجل والدليل</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#0D74B8] dark:text-sky-400 mt-1.5">
            {recordCompletenessPct}%
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">متوسط التقييم الموزون</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1.5">
            {avgAuditScore > 0 ? `${avgAuditScore}%` : "—"}
          </p>
        </div>
      </div>

      {/* Weighted 5-Criteria Quality Audit Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSaveAudit}
          className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-[#961B5E] dark:text-pink-400" />
              <span>تقييم عينة شكوى (5 معايير موزونة)</span>
            </h3>
            <span className="font-mono text-sm font-bold text-[#0D74B8] dark:text-sky-300 tabular-nums">
              {previewScore} / 100
            </span>
          </div>

          {auditFeedback && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300">
              {auditFeedback}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              اختر الشكوى للتدقيق
            </label>
            <select
              value={selectedComplaintId || auditableComplaints[0]?.id || ""}
              onChange={(e) => setSelectedComplaintId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
            >
              {auditableComplaints.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.ticketCode} — {c.customerName} ({c.branch.split(" - ")[0]})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3 text-xs">
            {[
              {
                key: "understanding",
                label: QUALITY_CRITERIA_WEIGHTS.problemUnderstanding.label,
                weight: "20%",
                value: problemUnderstanding,
                set: setProblemUnderstanding,
              },
              {
                key: "comm",
                label: QUALITY_CRITERIA_WEIGHTS.communication.label,
                weight: "20%",
                value: communication,
                set: setCommunication,
              },
              {
                key: "solution",
                label: QUALITY_CRITERIA_WEIGHTS.solutionAndEvidence.label,
                weight: "30%",
                value: solutionAndEvidence,
                set: setSolutionAndEvidence,
              },
              {
                key: "completeness",
                label: QUALITY_CRITERIA_WEIGHTS.recordCompleteness.label,
                weight: "20%",
                value: recordCompleteness,
                set: setRecordCompleteness,
              },
              {
                key: "privacy",
                label: QUALITY_CRITERIA_WEIGHTS.privacyCompliance.label,
                weight: "10%",
                value: privacyCompliance,
                set: setPrivacyCompliance,
              },
            ].map((item) => (
              <div key={item.key} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-700 dark:text-slate-300">
                    {item.label}{" "}
                    <span className="font-mono text-slate-400">({item.weight})</span>
                  </span>
                  <span className="font-mono font-bold tabular-nums text-[#1B2E66] dark:text-sky-300">
                    {item.value}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={item.value}
                  onChange={(e) => item.set(Number(e.target.value))}
                  className="w-full accent-[#961B5E]"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              ملاحظات المدقق وخطة التحسين
            </label>
            <textarea
              rows={2}
              value={improvementNotes}
              onChange={(e) => setImprovementNotes(e.target.value)}
              placeholder="ملاحظات الجودة حول سرعة الرد أو إرفاق دليل الحل..."
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
            />
          </div>

          <button
            type="submit"
            disabled={isSavingAudit || auditableComplaints.length === 0}
            className="w-full py-2.5 px-4 rounded-lg bg-[#1B2E66] dark:bg-[#0D74B8] text-white text-xs font-semibold hover:bg-[#12204A] dark:hover:bg-[#0A5D94] disabled:opacity-50"
          >
            {isSavingAudit ? "جاري حفظ التقييم..." : "اعتماد وحفظ تقييم الجودة"}
          </button>
        </form>

        {/* Quality Audits Table */}
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
              سجل عينات تدقيق الجودة الموزونة
            </h3>
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {qualityAudits.length} تقييمات
            </span>
          </div>
          {qualityAudits.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
              لا توجد عينات جودة مسجلة بعد. استخدم النموذج المجاور لتقييم أول شكوى.
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                    <th className="py-3 px-4">الشكوى والمحطة</th>
                    <th className="py-3 px-4">الفهم / التواصل / الحل / السجل / الخصوصية</th>
                    <th className="py-3 px-4">النتيجة</th>
                    <th className="py-3 px-4">الملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {qualityAudits.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-[#1B2E66] dark:text-sky-300 tabular-nums">
                          {q.ticketCode}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {q.stationName.split(" - ")[0]}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-300">
                        {q.problemUnderstanding} / {q.communication} / {q.solutionAndEvidence} /{" "}
                        {q.recordCompleteness} / {q.privacyCompliance}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-mono font-bold tabular-nums ${
                            q.totalScore >= 85
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-amber-700 dark:text-amber-400"
                          }`}
                        >
                          {q.totalScore}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-[220px]">
                        {q.improvementNotes || "مطابق للمعايير"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* 5-Day Monthly Report Governance Cycle */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
            دورة إعداد واعتماد التقرير الشهري (5 أيام عمل من الشهر التالي)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            الجدول التشغيلي الموحد لسحب البيانات وتدقيق الجودة واعتماد خطة العمل
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {FIVE_DAY_CYCLE.map((step) => (
            <div
              key={step.day}
              className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1"
            >
              <p className="text-[11px] font-mono font-bold text-[#961B5E] dark:text-pink-400">
                {step.day}
              </p>
              <p className="text-xs font-bold text-[#1B2E66] dark:text-slate-100">{step.title}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Monthly Action Plan Tracker */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
              خطة العمل الشهرية (Action Plan Governance)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              تحويل توصيات التقارير والجودة إلى إجراءات بمالك وموعد استحقاق ومؤشر إغلاق
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewPlan((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#961B5E] text-white text-xs font-semibold hover:bg-[#7A144B]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة بند خطة عمل</span>
          </button>
        </div>

        {showNewPlan && (
          <form
            onSubmit={handleCreateActionPlan}
            className="p-5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-3 text-xs"
          >
            <input
              type="text"
              required
              value={planTitle}
              onChange={(e) => setPlanTitle(e.target.value)}
              placeholder="عنوان الإجراء التحسيني..."
              className="md:col-span-4 px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            />
            <input
              type="text"
              required
              value={planRootCause}
              onChange={(e) => setPlanRootCause(e.target.value)}
              placeholder="السبب الجذري..."
              className="md:col-span-3 px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            />
            <input
              type="text"
              value={planOwner}
              onChange={(e) => setPlanOwner(e.target.value)}
              placeholder="المالك المسؤول"
              className="md:col-span-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            />
            <input
              type="text"
              value={planDue}
              onChange={(e) => setPlanDue(e.target.value)}
              placeholder="الاستحقاق"
              className="md:col-span-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            />
            <input
              type="text"
              value={planMetric}
              onChange={(e) => setPlanMetric(e.target.value)}
              placeholder="مؤشر الإغلاق"
              className="md:col-span-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            />
            <div className="md:col-span-12 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewPlan(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSavingPlan}
                className="px-4 py-1.5 rounded-lg bg-[#1B2E66] text-white font-semibold"
              >
                {isSavingPlan ? "جاري الحفظ..." : "حفظ البند"}
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                <th className="py-3 px-4">الإجراء</th>
                <th className="py-3 px-4">السبب الجذري</th>
                <th className="py-3 px-4">المالك</th>
                <th className="py-3 px-4">الاستحقاق</th>
                <th className="py-3 px-4">مؤشر الإغلاق</th>
                <th className="py-3 px-4">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {actionPlans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    لا توجد بنود في خطة العمل بعد.
                  </td>
                </tr>
              ) : (
                actionPlans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60">
                    <td className="py-3 px-4 font-semibold text-[#1B2E66] dark:text-slate-100">
                      {plan.title}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{plan.rootCause}</td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-200">{plan.ownerName}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {plan.dueDateLabel}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-200">
                      {plan.targetMetric}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={plan.status}
                        onChange={(e) =>
                          updateActionPlanStatus(
                            plan.id,
                            e.target.value as "open" | "in_progress" | "completed"
                          )
                        }
                        className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium text-slate-800 dark:text-slate-200"
                      >
                        <option value="open">مفتوح</option>
                        <option value="in_progress">قيد التنفيذ</option>
                        <option value="completed">مكتمل</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* RBAC 5-Role Matrix & Team Access Control */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#961B5E] dark:text-pink-400" />
              <span>مصفوفة الصلاحيات والأدوار الخمسة (RBAC)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              الفصل بين التنفيذ والإشراف على المحطة واعتماد الإدارة ومراقبة الجودة وإعداد النظام
            </p>
          </div>
          {roleFeedback && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{roleFeedback}</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map((roleKey) => {
            const info = ROLE_PERMISSION_DESCRIPTIONS[roleKey];
            return (
              <div
                key={roleKey}
                className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
              >
                <p className="font-bold text-[#1B2E66] dark:text-sky-300">
                  {USER_ROLE_LABELS[roleKey]}
                </p>
                <p className="text-[11px] font-medium text-[#961B5E] dark:text-pink-400">
                  {info.scope}
                </p>
                <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300 list-disc list-inside leading-relaxed">
                  {info.capabilities.map((cap, idx) => (
                    <li key={idx}>{cap}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {teamUsers.length > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
            <h4 className="text-xs font-bold text-[#1B2E66] dark:text-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#0D74B8] dark:text-sky-400" />
              <span>أعضاء الفريق المسجلون وتخصيص الأدوار</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-4">الاسم والبريد</th>
                    <th className="py-2.5 px-4">الدور الوظيفي</th>
                    <th className="py-2.5 px-4">المحطة المرتبطة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {teamUsers.map((u) => (
                    <tr key={u.uid}>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {u.displayName}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {u.email}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <select
                          disabled={!canManageRoles}
                          value={u.role}
                          onChange={(e) =>
                            handleUpdateRole(u, e.target.value as UserRole, u.branch)
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs disabled:opacity-60"
                        >
                          {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map((r) => (
                            <option key={r} value={r}>
                              {USER_ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-4">
                        <select
                          disabled={!canManageRoles}
                          value={u.branch || FANAR_BRANCHES[0]}
                          onChange={(e) =>
                            handleUpdateRole(u, u.role, e.target.value)
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs disabled:opacity-60"
                        >
                          {FANAR_BRANCHES.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
