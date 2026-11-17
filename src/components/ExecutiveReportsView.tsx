import React, { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Database, Printer, TrendingDown, TrendingUp } from "lucide-react";
import {
  CATEGORY_LABELS,
  CHANNEL_LABELS,
  Complaint,
  ComplaintCategory,
  ComplaintChannel,
  computeSlaStatus,
  Conversation,
  ESCALATION_RULE_LABELS,
  EscalationRuleKey,
  FANAR_BRANCHES,
  findFanarStation,
  getComplaintEffectiveDate,
} from "../types/crm";

interface ExecutiveReportsViewProps {
  complaints: Complaint[];
  conversations: Conversation[];
  isDark?: boolean;
  onPrintReport: () => void;
  onBackfillHistoricalData?: () => Promise<void>;
  isBackfilling?: boolean;
}

interface MonthBucket {
  key: string; // YYYY-MM
  label: string;
  incoming: number;
  closed: number;
  backlog: number;
  slaPct: number;
  csatAvg: number;
  avgFirstRespMin: number;
  avgResolveHours: number;
  aiChats: number;
  handoffCount: number;
}

function getMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getArabicMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, 1);
  return new Intl.DateTimeFormat("ar-SA", {
    month: "short",
    year: "numeric",
  }).format(date);
}

function getRecentMonthKeys(count = 6): string[] {
  const now = new Date();
  const list: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push(getMonthKey(d));
  }
  return list;
}

export const ExecutiveReportsView: React.FC<ExecutiveReportsViewProps> = ({
  complaints,
  conversations,
  isDark = false,
  onPrintReport,
  onBackfillHistoricalData,
  isBackfilling = false,
}) => {
  const monthKeys = useMemo(() => getRecentMonthKeys(6), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    monthKeys[monthKeys.length - 1]
  );

  const selectedIdx = Math.max(0, monthKeys.indexOf(selectedMonth));
  const prevMonthKey = selectedIdx > 0 ? monthKeys[selectedIdx - 1] : null;

  const monthlySeries: MonthBucket[] = useMemo(() => {
    return monthKeys.map((key) => {
      const monthComplaints = complaints.filter(
        (c) => getMonthKey(getComplaintEffectiveDate(c)) === key
      );
      const closedItems = monthComplaints.filter(
        (c) => c.status === "closed" || c.status === "resolved"
      );
      const openItems = monthComplaints.filter(
        (c) => c.status !== "closed" && c.status !== "cancelled"
      );

      let slaMet = 0;
      let firstRespSum = 0;
      let firstRespCount = 0;
      let resolveHoursSum = 0;
      let resolveCount = 0;
      let csatSum = 0;
      let csatCount = 0;

      monthComplaints.forEach((c) => {
        const sla = computeSlaStatus(c);
        if (!sla.isBreached) slaMet += 1;

        const startMs = getComplaintEffectiveDate(c).getTime();
        if (c.firstResponseAt) {
          const mins = Math.max(
            1,
            Math.round((c.firstResponseAt.toMillis() - startMs) / 60000)
          );
          firstRespSum += Math.min(360, mins);
          firstRespCount += 1;
        }
        if (c.resolvedAt || c.closedAt) {
          const endMs = (c.resolvedAt || c.closedAt)!.toMillis();
          const hrs = Math.max(0.5, (endMs - startMs) / 3600000);
          resolveHoursSum += Math.min(200, hrs);
          resolveCount += 1;
        }
        if (typeof c.csatScore === "number" && c.csatScore > 0) {
          csatSum += c.csatScore;
          csatCount += 1;
        }
      });

      const monthConvs = conversations.filter((conv) => {
        const d = conv.occurredAt?.toDate?.() || conv.createdAt?.toDate?.() || new Date();
        return getMonthKey(d) === key;
      });
      const handoffCount = monthConvs.filter(
        (conv) => conv.handoffStatus === "escalated_to_agent" || !conv.aiAutoReplyEnabled
      ).length;

      return {
        key,
        label: getArabicMonthLabel(key),
        incoming: monthComplaints.length,
        closed: closedItems.length,
        backlog: openItems.length,
        slaPct:
          monthComplaints.length > 0
            ? Math.round((slaMet / monthComplaints.length) * 100)
            : 0,
        csatAvg: csatCount > 0 ? Number((csatSum / csatCount).toFixed(1)) : 0,
        avgFirstRespMin:
          firstRespCount > 0 ? Math.round(firstRespSum / firstRespCount) : 0,
        avgResolveHours:
          resolveCount > 0 ? Number((resolveHoursSum / resolveCount).toFixed(1)) : 0,
        aiChats: monthConvs.length,
        handoffCount,
      };
    });
  }, [monthKeys, complaints, conversations]);

  const currentStats = monthlySeries[selectedIdx] || monthlySeries[monthlySeries.length - 1];
  const prevStats = prevMonthKey
    ? monthlySeries.find((m) => m.key === prevMonthKey) || null
    : null;

  const selectedMonthComplaints = useMemo(
    () =>
      complaints.filter(
        (c) => getMonthKey(getComplaintEffectiveDate(c)) === selectedMonth
      ),
    [complaints, selectedMonth]
  );

  // Open Backlog Aging Breakdown (all active open across network or selected month)
  const agingBreakdown = useMemo(() => {
    const nowMs = Date.now();
    const openAll = complaints.filter(
      (c) => c.status !== "closed" && c.status !== "cancelled"
    );
    const buckets = [
      { label: "< 24 ساعة", count: 0 },
      { label: "1 - 2 يوم", count: 0 },
      { label: "3 - 5 أيام", count: 0 },
      { label: "> 5 أيام", count: 0 },
    ];
    openAll.forEach((c) => {
      const ageHours = Math.max(
        0,
        (nowMs - getComplaintEffectiveDate(c).getTime()) / 3600000
      );
      if (ageHours < 24) buckets[0].count += 1;
      else if (ageHours < 72) buckets[1].count += 1;
      else if (ageHours <= 120) buckets[2].count += 1;
      else buckets[3].count += 1;
    });
    return { totalOpen: openAll.length, buckets };
  }, [complaints]);

  // Channel Breakdown for selected month (fallback to all if selected month sparse)
  const analysisDataset =
    selectedMonthComplaints.length > 0 ? selectedMonthComplaints : complaints;

  const channelStats = useMemo(() => {
    const channels: ComplaintChannel[] = ["whatsapp", "phone", "portal", "direct"];
    const total = Math.max(1, analysisDataset.length);
    return channels.map((ch) => {
      const count = analysisDataset.filter((c) => c.channel === ch).length;
      return {
        channel: ch,
        label: CHANNEL_LABELS[ch],
        count,
        pct: Math.round((count / total) * 100),
      };
    });
  }, [analysisDataset]);

  const topCauses = useMemo(() => {
    const cats = Object.keys(CATEGORY_LABELS) as ComplaintCategory[];
    const total = Math.max(1, analysisDataset.length);
    return cats
      .map((cat) => {
        const count = analysisDataset.filter((c) => c.category === cat).length;
        return {
          category: cat,
          label: CATEGORY_LABELS[cat],
          count,
          pct: Math.round((count / total) * 100),
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [analysisDataset]);

  // Station & Region Performance Matrix (PDF p.24)
  const stationMatrix = useMemo(() => {
    return FANAR_BRANCHES.map((branch) => {
      const items = complaints.filter((c) => c.branch === branch);
      const closed = items.filter((c) => c.status === "closed" || c.status === "resolved").length;
      const open = items.filter((c) => c.status !== "closed" && c.status !== "cancelled").length;
      const slaMet = items.filter((c) => !computeSlaStatus(c).isBreached).length;
      const slaPct = items.length > 0 ? Math.round((slaMet / items.length) * 100) : 100;
      const csatItems = items.filter((c) => typeof c.csatScore === "number" && c.csatScore > 0);
      const csatAvg =
        csatItems.length > 0
          ? Number(
              (
                csatItems.reduce((acc, cur) => acc + (cur.csatScore || 0), 0) /
                csatItems.length
              ).toFixed(1)
            )
          : 0;

      const health =
        slaPct < 75 || open >= 3
          ? "خطة عاجلة"
          : slaPct < 88
          ? "متابعة"
          : csatAvg >= 4.5 && slaPct >= 95
          ? "أفضل ممارسة"
          : "مستقر";

      const st = findFanarStation(branch);
      return {
        branch,
        shortName: st ? `${st.code} · ${st.name}` : branch.split(" - ")[0],
        region: st ? st.region : branch.match(/\(([^)]+)\)/)?.[1] || "السعودية",
        total: items.length,
        closed,
        open,
        slaPct,
        csatAvg,
        health,
      };
    });
  }, [complaints]);

  // 5 Escalation Rules breakdown
  const escalationBreakdown = useMemo(() => {
    const keys: EscalationRuleKey[] = [
      "explicit_request",
      "missing_knowledge",
      "sensitive_case",
      "repeated_failure",
      "angry_or_reopen",
    ];
    return keys.map((k) => ({
      rule: k,
      label: ESCALATION_RULE_LABELS[k],
      count: conversations.filter((conv) => conv.escalationRule === k).length,
    }));
  }, [conversations]);

  // Insight Cards (Best Improvement, Top Cause, Emerging Risk)
  const worstStation = [...stationMatrix].sort((a, b) => a.slaPct - b.slaPct)[0];
  const bestStation = [...stationMatrix].sort((a, b) => b.slaPct - a.slaPct)[0];
  const topCause = topCauses[0];

  const slaDelta = prevStats ? currentStats.slaPct - prevStats.slaPct : 0;
  const gridStroke = isDark ? "#1E293B" : "#E2E8F0";
  const axisTickColor = isDark ? "#94A3B8" : "#64748B";

  return (
    <div className="space-y-6">
      {/* Header & Month Selector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#961B5E] dark:text-pink-400">
            حوكمة الأداء التنفيذي — التقارير الشهرية الستة
          </p>
          <h2 className="text-base font-bold text-[#1B2E66] dark:text-slate-100 mt-0.5">
            لوحة التقارير الشهرية التنفيذية ومقارنة السلاسل الزمنية
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            مؤشرات 6 أشهر للوارد والمغلق، أعمار الرصيد المفتوح، أداء المحطات، التزام SLA، وكفاءة الواتساب الذكي
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {complaints.length < 8 && onBackfillHistoricalData && (
            <button
              type="button"
              disabled={isBackfilling}
              onClick={onBackfillHistoricalData}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-950/60 disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5" />
              <span>
                {isBackfilling
                  ? "جاري تهيئة سجل 6 أشهر..."
                  : "تهيئة بيانات 6 أشهر للتقارير"}
              </span>
            </button>
          )}

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          >
            {monthlySeries.map((m) => (
              <option key={m.key} value={m.key}>
                شهر {m.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onPrintReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1B2E66] dark:bg-[#0D74B8] text-white text-xs font-semibold hover:bg-[#12204A] dark:hover:bg-[#0A5D94]"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الملخص التنفيذي</span>
          </button>
        </div>
      </div>

      {/* Section 1: Monthly 5-KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">إجمالي الشكاوى (الشهر)</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#1B2E66] dark:text-slate-100 mt-1.5">
            {currentStats.incoming}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
            {prevStats ? `الشهر السابق: ${prevStats.incoming}` : "أول شهر في السلسلة"}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">الشكاوى المغلقة/المحلولة</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1.5">
            {currentStats.closed}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
            معدل الإغلاق:{" "}
            {currentStats.incoming > 0
              ? Math.round((currentStats.closed / currentStats.incoming) * 100)
              : 0}
            %
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">الرصيد المفتوح (Backlog)</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#961B5E] dark:text-pink-400 mt-1.5">
            {agingBreakdown.totalOpen}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            متأخرة &gt; 5 أيام: {agingBreakdown.buckets[3].count}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">الالتزام بـ SLA</p>
          <div className="flex items-baseline gap-2 mt-1.5">
            <p className="text-2xl font-bold font-mono tabular-nums text-[#0D74B8] dark:text-sky-400">
              {currentStats.slaPct}%
            </p>
            {prevStats && slaDelta !== 0 && (
              <span
                className={`inline-flex items-center gap-0.5 text-[11px] font-mono tabular-nums ${
                  slaDelta >= 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-red-700 dark:text-red-400"
                }`}
              >
                {slaDelta >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {slaDelta > 0 ? `+${slaDelta}%` : `${slaDelta}%`}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            الهدف المعتمد: 90%+
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">متوسط رضا العملاء CSAT</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1.5">
            {currentStats.csatAvg > 0 ? `${currentStats.csatAvg} / 5` : "—"}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            بناءً على تأكيدات الحل
          </p>
        </div>
      </div>

      {/* 3 Automated Executive Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">أبرز تحسن تشغيلي</p>
          <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
            {bestStation
              ? `${bestStation.shortName} (${bestStation.region}) سجلت التزام SLA بنسبة ${bestStation.slaPct}% مع سرعة استجابة منتظمة.`
              : "لا توجد بيانات كافية بعد."}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1">
          <p className="text-xs font-bold text-[#0D74B8] dark:text-sky-400">أعلى سبب للشكاوى</p>
          <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
            {topCause
              ? `«${topCause.label}» يمثل ${topCause.pct}% من البلاغات (${topCause.count} شكوى) ويتطلب متابعة وقائية.`
              : "لا توجد شكاوى مصنفة."}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1">
          <p className="text-xs font-bold text-[#961B5E] dark:text-pink-400">مخاطرة ناشئة تستوجب التدخل</p>
          <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
            {worstStation && worstStation.slaPct < 90
              ? `${worstStation.shortName}: نسبة SLA ${worstStation.slaPct}% مع ${worstStation.open} شكاوى مفتوحة قيد المعالجة.`
              : agingBreakdown.buckets[3].count > 0
              ? `توجد ${agingBreakdown.buckets[3].count} شكاوى متجاوزة لـ 5 أيام في الرصيد المفتوح.`
              : "جميع الفروع ضمن النطاق المستقر حالياً."}
          </p>
        </div>
      </div>

      {/* Charts Row 1: 6-Month Trend + Backlog Aging */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Report 2: 6-Month Incoming vs Closed Line Chart */}
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
              تطور الشكاوى الواردة مقابل المغلقة (آخر 6 أشهر)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              مقارنة شهرية لقدرة الاستيعاب والإغلاق ومؤشر الرصيد المفتوح
            </p>
          </div>
          <div dir="ltr" className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlySeries} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="label" tick={{ fill: axisTickColor, fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: axisTickColor, fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="incoming"
                  name="الواردة"
                  stroke="#961B5E"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="closed"
                  name="المغلقة"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="backlog"
                  name="الرصيد المفتوح"
                  stroke="#0D74B8"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Report 3: Open Backlog Aging */}
        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
              أعمار الشكاوى المفتوحة (Backlog Aging)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              إجمالي الشكاوى غير المغلقة حالياً:{" "}
              <span className="font-mono font-bold text-[#961B5E] dark:text-pink-400">
                {agingBreakdown.totalOpen}
              </span>
            </p>
          </div>
          <div dir="ltr" className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={agingBreakdown.buckets}
                margin={{ top: 10, right: 10, left: -16, bottom: 0 }}
                barSize={36}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="label" tick={{ fill: axisTickColor, fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: axisTickColor, fontSize: 11 }} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  name="عدد التذاكر المفتوحة"
                  fill="#1B2E66"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Report 4: SLA Compliance + Response vs Resolution Times */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
              نسبة الالتزام بـ SLA ومؤشر الرضا CSAT (6 أشهر)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              التتبع الشهري لنسبة الالتزام بالوقت المحدد مقابل رضا العملاء
            </p>
          </div>
          <div dir="ltr" className="w-full h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlySeries} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="label" tick={{ fill: axisTickColor, fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: axisTickColor, fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="slaPct"
                  name="التزام SLA %"
                  stroke="#0D74B8"
                  strokeWidth={2.5}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
              متوسط الاستجابة الأولى (دقيقة) وزمن الحل (ساعة)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              قياس سرعة الاستجابة الفورية وزمن الإغلاق الفعلي عبر الأشهر
            </p>
          </div>
          <div dir="ltr" className="w-full h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySeries} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="label" tick={{ fill: axisTickColor, fontSize: 11 }} />
                <YAxis tick={{ fill: axisTickColor, fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="avgFirstRespMin"
                  name="الاستجابة الأولى (دقيقة)"
                  fill="#0D74B8"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="avgResolveHours"
                  name="زمن الحل (ساعة)"
                  fill="#961B5E"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Channels & Ranked Causes + Station Performance Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
          <div>
            <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
              توزيع القنوات وترتيب أسباب الشكاوى
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              تحليل مصادر الاستقبال والتصنيفات الأكثر تكراراً
            </p>
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              نسب القنوات:
            </p>
            {channelStats.map((ch) => (
              <div key={ch.channel} className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-200">{ch.label}</span>
                  <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {ch.count} ({ch.pct}%)
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-[#0D74B8]"
                    style={{ width: `${ch.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              ترتيب الأسباب (الأعلى أولاً):
            </p>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {topCauses.map((cause, idx) => (
                <div key={cause.category} className="py-2 flex items-center justify-between gap-2">
                  <span className="text-slate-800 dark:text-slate-200">
                    <span className="font-mono text-slate-400 ml-1.5">#{idx + 1}</span>
                    {cause.label}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-[#1B2E66] dark:text-sky-300">
                    {cause.count} ({cause.pct}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Station Performance Table */}
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
              تقرير أداء المحطات والمناطق (Station & Region Matrix)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              مقارنة الفروع في الوارد والمغلق والرصيد المفتوح والالتزام بـ SLA وتقييم العملاء
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                  <th className="py-3 px-4">المحطة والمنطقة</th>
                  <th className="py-3 px-4">الوارد</th>
                  <th className="py-3 px-4">المغلق</th>
                  <th className="py-3 px-4">المفتوح</th>
                  <th className="py-3 px-4">SLA %</th>
                  <th className="py-3 px-4">CSAT</th>
                  <th className="py-3 px-4">التصنيف التشغيلي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {stationMatrix.map((row) => (
                  <tr key={row.branch} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {row.shortName}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {row.region}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums">{row.total}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                      {row.closed}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-[#961B5E] dark:text-pink-400">
                      {row.open}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums font-bold">{row.slaPct}%</td>
                    <td className="py-3 px-4 font-mono tabular-nums">
                      {row.csatAvg > 0 ? `${row.csatAvg}/5` : "—"}
                    </td>
                    <td className="py-3 px-4 font-semibold">
                      <span
                        className={
                          row.health === "خطة عاجلة"
                            ? "text-red-700 dark:text-red-400"
                            : row.health === "متابعة"
                            ? "text-amber-700 dark:text-amber-400"
                            : row.health === "أفضل ممارسة"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-[#0D74B8] dark:text-sky-400"
                        }
                      >
                        {row.health}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Report 5 & 6: AI Assistant vs Handoff Performance + Executive Monthly Brief */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
              أداء المساعد الذكي والتحويل للموظف (قواعد التحويل الخمس)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              إجمالي المحادثات: <span className="font-mono font-bold">{conversations.length}</span> ·
              المحوّلة لموظف:{" "}
              <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                {
                  conversations.filter(
                    (c) => c.handoffStatus === "escalated_to_agent" || !c.aiAutoReplyEnabled
                  ).length
                }
              </span>
            </p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {escalationBreakdown.map((item) => (
              <div key={item.rule} className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-slate-700 dark:text-slate-200">{item.label}</span>
                <span className="font-mono tabular-nums font-bold text-[#1B2E66] dark:text-sky-300">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
              الملخص التنفيذي الشهري للإدارة (Executive Brief)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              قراءة تنفيذية من صفحة واحدة: ماذا حدث؟ لماذا يهم؟ وما هي القرارات المطلوبة؟
            </p>
          </div>
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <p className="font-bold text-[#1B2E66] dark:text-sky-300">1. ماذا حدث؟</p>
              <p className="text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                سجّل شهر {currentStats.label} عدد {currentStats.incoming} شكوى جديدة بنسبة إغلاق{" "}
                {currentStats.incoming > 0
                  ? Math.round((currentStats.closed / currentStats.incoming) * 100)
                  : 0}
                % والتزام SLA بلغ {currentStats.slaPct}%.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <p className="font-bold text-[#961B5E] dark:text-pink-400">2. لماذا يهم؟</p>
              <p className="text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                تركز الشكاوى في «{topCause?.label || "الخدمة"}» والحالات الحرجة P1 يؤثر مباشرة
                على ثقة العملاء وتكرار الزيارة عبر المحطات.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <p className="font-bold text-emerald-700 dark:text-emerald-400">
                3. قرارات الإدارة المطلوبة (1 – 3)
              </p>
              <ul className="mt-1 space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside">
                <li>متابعة خطة معالجة المحطة الأقل التزاماً ({worstStation?.shortName || "ST-001 · السلام"}).</li>
                <li>تحديث قاعدة معرفة المساعد الذكي لتقليل تحولات الفوترة وبطاقات الأساطيل.</li>
                <li>الالتزام بمراجعة جودة 100% من شكاوى P1 قبل الإغلاق النهائي.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
