import React, { useMemo, useState } from "react";
import { Download, Plus, Printer, Search, Star } from "lucide-react";
import {
  CATEGORY_LABELS,
  CHANNEL_LABELS,
  Complaint,
  ComplaintChannel,
  ComplaintStatus,
  computeSlaStatus,
  FANAR_BRANCHES,
  getComplaintEffectiveDate,
  formatArabicDate,
  resolveComplaintSlaTier,
  SLA_TIERS,
  SlaTier,
  STATUS_LABELS,
  UNKNOWN_BRANCH_LABEL,
} from "../types/crm";
import { PriorityLabel, SlaBadge, StatusIndicator } from "./StatusIndicator";

interface ComplaintsRegistryViewProps {
  complaints: Complaint[];
  onSelectComplaint: (complaint: Complaint) => void;
  onNewComplaint: () => void;
  onPrintSingle: (complaint: Complaint) => void;
  onPrintRegister: (filtered: Complaint[], filterSummary: string) => void;
}

export const ComplaintsRegistryView: React.FC<ComplaintsRegistryViewProps> = ({
  complaints,
  onSelectComplaint,
  onNewComplaint,
  onPrintSingle,
  onPrintRegister,
}) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ComplaintStatus>("all");
  const [channelFilter, setChannelFilter] = useState<"all" | ComplaintChannel>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [slaFilter, setSlaFilter] = useState<"all" | SlaTier>("all");
  const [onlyRepeatCustomers, setOnlyRepeatCustomers] = useState(false);
  const [smartSort, setSmartSort] = useState(true);

  const phoneCounts = useMemo(() => {
    const map = new Map<string, number>();
    complaints.forEach((c) => {
      const norm = c.customerPhone.replace(/\D/g, "").slice(-9);
      if (norm) map.set(norm, (map.get(norm) || 0) + 1);
    });
    return map;
  }, [complaints]);

  const filtered = useMemo(() => {
    const base = complaints.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (channelFilter !== "all" && c.channel !== channelFilter) return false;
      if (branchFilter !== "all" && c.branch !== branchFilter) return false;
      if (slaFilter !== "all" && resolveComplaintSlaTier(c) !== slaFilter) return false;
      if (onlyRepeatCustomers) {
        const norm = c.customerPhone.replace(/\D/g, "").slice(-9);
        if ((phoneCounts.get(norm) || 0) <= 1) return false;
      }

      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        c.ticketCode.toLowerCase().includes(q) ||
        c.customerName.toLowerCase().includes(q) ||
        c.customerPhone.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    });

    if (!smartSort) {
      return [...base].sort(
        (a, b) => getComplaintEffectiveDate(b).getTime() - getComplaintEffectiveDate(a).getTime()
      );
    }

    const tierWeight: Record<SlaTier, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };
    return [...base].sort((a, b) => {
      const aClosed = a.status === "closed" || a.status === "cancelled";
      const bClosed = b.status === "closed" || b.status === "cancelled";
      if (aClosed !== bClosed) return aClosed ? 1 : -1;

      const slaA = computeSlaStatus(a);
      const slaB = computeSlaStatus(b);
      if (!aClosed && slaA.isBreached !== slaB.isBreached) {
        return slaA.isBreached ? -1 : 1;
      }
      if (!aClosed && tierWeight[slaA.tier] !== tierWeight[slaB.tier]) {
        return tierWeight[slaA.tier] - tierWeight[slaB.tier];
      }
      if (!aClosed && a.status === "reopened" && b.status !== "reopened") return -1;
      if (!aClosed && b.status === "reopened" && a.status !== "reopened") return 1;
      return getComplaintEffectiveDate(b).getTime() - getComplaintEffectiveDate(a).getTime();
    });
  }, [
    complaints,
    statusFilter,
    channelFilter,
    branchFilter,
    slaFilter,
    onlyRepeatCustomers,
    smartSort,
    search,
    phoneCounts,
  ]);

  function buildFilterSummary(): string {
    const parts: string[] = [];
    parts.push(statusFilter === "all" ? "جميع الحالات" : STATUS_LABELS[statusFilter]);
    if (slaFilter !== "all") parts.push(SLA_TIERS[slaFilter].label);
    if (channelFilter !== "all") parts.push(CHANNEL_LABELS[channelFilter]);
    if (branchFilter !== "all") parts.push(branchFilter);
    if (onlyRepeatCustomers) parts.push("عملاء متكررون");
    return parts.join(" · ");
  }

  function handleExportCsv() {
    const headers = [
      "رمز الشكوى",
      "العميل",
      "الجوال",
      "المحطة",
      "المضخة",
      "التصنيف",
      "القناة",
      "SLA",
      "الأولوية",
      "الحالة",
      "تقييم العميل",
      "قرار الإغلاق",
    ];
    const rows = filtered.map((c) => [
      c.ticketCode,
      c.customerName,
      c.customerPhone,
      c.branch,
      c.pumpNumber,
      CATEGORY_LABELS[c.category],
      CHANNEL_LABELS[c.channel],
      resolveComplaintSlaTier(c),
      c.priority,
      STATUS_LABELS[c.status],
      c.csatScore ? `${c.csatScore}/5` : "",
      c.closureReason || "",
    ]);
    const csvContent =
      "\uFEFF" +
      [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fanar-complaints-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const statusTabs: Array<{ key: "all" | ComplaintStatus; label: string }> = [
    { key: "all", label: `الكل (${complaints.length})` },
    { key: "new", label: `جديدة (${complaints.filter((c) => c.status === "new").length})` },
    {
      key: "in_progress",
      label: `قيد المعالجة (${complaints.filter((c) => c.status === "in_progress").length})`,
    },
    {
      key: "waiting_customer",
      label: `بانتظار العميل (${complaints.filter((c) => c.status === "waiting_customer").length})`,
    },
    {
      key: "pending_manager",
      label: `بانتظار المدير (${complaints.filter((c) => c.status === "pending_manager").length})`,
    },
    {
      key: "resolved",
      label: `محلولة (${complaints.filter((c) => c.status === "resolved").length})`,
    },
    {
      key: "reopened",
      label: `معاد فتحها (${complaints.filter((c) => c.status === "reopened").length})`,
    },
    {
      key: "closed",
      label: `مغلقة (${complaints.filter((c) => c.status === "closed").length})`,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header & Print Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#1B2E66] dark:text-slate-100">
              سجل الشكاوى الذكي ومؤشرات SLA والطباعة
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              فرز تلقائي لتقديم الحالات الحرجة P1 والمتجاوزة للوقت، مع تصفية حسب المحطة ومستوى SLA والعملاء المتكررين
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>تصدير CSV</span>
            </button>

            <button
              type="button"
              onClick={() => onPrintRegister(filtered, buildFilterSummary())}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#1B2E66] dark:border-sky-500 bg-white dark:bg-slate-800 text-xs font-semibold text-[#1B2E66] dark:text-sky-300 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة السجل المجمع ({filtered.length})</span>
            </button>

            <button
              type="button"
              onClick={onNewComplaint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#961B5E] text-white text-xs font-semibold hover:bg-[#7A144B] whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل شكوى جديدة</span>
            </button>
          </div>
        </div>

        {/* Status Segmented Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === tab.key
                  ? "bg-white dark:bg-slate-950 text-[#1B2E66] dark:text-slate-100 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Filters */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برمز الشكوى FNR-... أو اسم العميل أو الجوال"
              className="w-full pr-9 pl-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:border-[#0D74B8]"
            />
          </div>

          <div className="md:col-span-2">
            <select
              value={slaFilter}
              onChange={(e) => setSlaFilter(e.target.value as "all" | SlaTier)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value="all">كل مستويات SLA</option>
              {(["P1", "P2", "P3", "P4"] as const).map((tier) => (
                <option key={tier} value={tier}>
                  {SLA_TIERS[tier].label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as "all" | ComplaintChannel)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value="all">جميع القنوات</option>
              <option value="whatsapp">واتساب الذكي</option>
              <option value="phone">اتصال هاتفي</option>
              <option value="direct">تسجيل مباشر</option>
              <option value="portal">بوابة العميل</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value="all">جميع فروع محطات فنار</option>
              {FANAR_BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
              <option value={UNKNOWN_BRANCH_LABEL}>{UNKNOWN_BRANCH_LABEL}</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={smartSort}
                onChange={(e) => setSmartSort(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-[#961B5E]"
              />
              <span>فرز ذكي (تثبيت حالات P1 والمتجاوزة للوقت في الأعلى)</span>
            </label>
            <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyRepeatCustomers}
                onChange={(e) => setOnlyRepeatCustomers(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-[#961B5E]"
              />
              <span>العملاء ذوو الشكاوى المتكررة فقط</span>
            </label>
          </div>
          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
            النتائج: {filtered.length}
          </span>
        </div>
      </div>

      {/* Complaints Data Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              لا توجد شكاوى تطابق معايير البحث الحالية.
            </p>
            <button
              type="button"
              onClick={onNewComplaint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B2E66] dark:bg-[#0D74B8] text-white text-xs font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل شكوى جديدة</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <th className="py-3 px-4">رمز الشكوى</th>
                  <th className="py-3 px-4">العميل</th>
                  <th className="py-3 px-4">المحطة والمضخة</th>
                  <th className="py-3 px-4">التصنيف والقناة</th>
                  <th className="py-3 px-4">SLA والأولوية</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filtered.map((c) => {
                  const normPhone = c.customerPhone.replace(/\D/g, "").slice(-9);
                  const repeatCount = phoneCounts.get(normPhone) || 1;
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[#1B2E66] dark:text-sky-300 tabular-nums whitespace-nowrap">
                        {c.ticketCode}
                        <span className="block text-[10px] font-sans font-normal text-slate-400 dark:text-slate-500">
                          {c.codeSentViaWhatsapp ? "أُرسل للواتساب" : "داخلي / بوابة"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{c.customerName}</span>
                          {repeatCount > 1 && (
                            <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400">
                              ({repeatCount}×)
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                          {c.customerPhone}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div
                          className={`max-w-[190px] truncate ${
                            c.stationUnknown
                              ? "text-amber-700 dark:text-amber-400 font-medium"
                              : "text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          {c.branch}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {c.pumpNumber || "غير محدد"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="text-slate-800 dark:text-slate-200">
                          {CATEGORY_LABELS[c.category]}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {CHANNEL_LABELS[c.channel]}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <SlaBadge complaint={c} />
                        <div className="mt-0.5">
                          <PriorityLabel priority={c.priority} />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <StatusIndicator status={c.status} />
                        {c.csatScore ? (
                          <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-mono text-amber-600 dark:text-amber-400 tabular-nums">
                            <Star className="w-3 h-3 fill-current" />
                            <span>{c.csatScore}/5</span>
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatArabicDate(getComplaintEffectiveDate(c))}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectComplaint(c)}
                            className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs font-medium text-[#1B2E66] dark:text-sky-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                          >
                            متابعة
                          </button>
                          <button
                            type="button"
                            onClick={() => onPrintSingle(c)}
                            title="طباعة نموذج الشكوى"
                            className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
