import React, { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CATEGORY_LABELS, Complaint, ComplaintCategory } from "../types/crm";

interface OverviewChartsProps {
  complaints: Complaint[];
  isDark?: boolean;
  onFilterComplaints?: () => void;
}

interface StatusSlice {
  key: "open" | "in_progress" | "closed";
  name: string;
  value: number;
  percent: number;
  color: string;
  detail?: string;
}

interface DepartmentRow {
  category: ComplaintCategory;
  shortName: string;
  fullName: string;
  open: number;
  inProgress: number;
  closed: number;
  total: number;
}

interface CustomTooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  payload?: StatusSlice & DepartmentRow;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
}

const SHORT_CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  fuel_quality: "جودة الوقود",
  billing_pump: "المضخات",
  cleanliness_facilities: "المرافق",
  staff_service: "الموظفين",
  fleet_cards: "الأساطيل",
  other: "أخرى",
};

const STATUS_COLORS = {
  open: "#961B5E",
  inProgress: "#0D74B8",
  closed: "#10B981",
  departmentTotal: "#1B2E66",
  departmentTotalDark: "#38BDF8",
};

const StatusTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div
      dir="rtl"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs shadow-sm"
    >
      <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
        <span
          className="w-2.5 h-2.5 rounded-xs shrink-0"
          style={{ backgroundColor: item.color }}
        />
        <span>{item.name}</span>
      </div>
      <div className="mt-1 text-slate-600 dark:text-slate-300 font-mono tabular-nums">
        {item.value} شكوى ({item.percent}%)
      </div>
      {item.detail && (
        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          {item.detail}
        </div>
      )}
    </div>
  );
};

const DepartmentTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div
      dir="rtl"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-xs shadow-sm min-w-[180px]"
    >
      <p className="font-bold text-[#1B2E66] dark:text-slate-100 pb-1.5 border-b border-slate-100 dark:border-slate-800">
        {row.fullName}
      </p>
      <div className="mt-1.5 space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="w-2 h-2 rounded-xs bg-[#961B5E]" />
            <span>مفتوحة</span>
          </span>
          <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
            {row.open}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="w-2 h-2 rounded-xs bg-[#0D74B8]" />
            <span>قيد المعالجة</span>
          </span>
          <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
            {row.inProgress}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="w-2 h-2 rounded-xs bg-[#10B981]" />
            <span>مغلقة</span>
          </span>
          <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
            {row.closed}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-100 dark:border-slate-800 font-semibold text-slate-900 dark:text-slate-100">
          <span>الإجمالي</span>
          <span className="font-mono tabular-nums">{row.total}</span>
        </div>
      </div>
    </div>
  );
};

export const OverviewCharts: React.FC<OverviewChartsProps> = ({
  complaints,
  isDark = false,
  onFilterComplaints,
}) => {
  const [departmentChartMode, setDepartmentChartMode] = useState<"stacked" | "total">(
    "stacked"
  );

  const total = complaints.length;
  const openCount = complaints.filter((c) => c.status === "new").length;
  const activeProcessingCount = complaints.filter(
    (c) => c.status === "in_progress"
  ).length;
  const pendingManagerCount = complaints.filter(
    (c) => c.status === "pending_manager"
  ).length;
  const inProgressTotal = activeProcessingCount + pendingManagerCount;
  const closedCount = complaints.filter((c) => c.status === "closed").length;

  const pct = (value: number) => (total > 0 ? Math.round((value / total) * 100) : 0);

  const statusData: StatusSlice[] = [
    {
      key: "open",
      name: "مفتوحة",
      value: openCount,
      percent: pct(openCount),
      color: STATUS_COLORS.open,
    },
    {
      key: "in_progress",
      name: "قيد المعالجة",
      value: inProgressTotal,
      percent: pct(inProgressTotal),
      color: STATUS_COLORS.inProgress,
      detail:
        pendingManagerCount > 0
          ? `تشمل ${pendingManagerCount} بانتظار اعتماد المدير`
          : undefined,
    },
    {
      key: "closed",
      name: "مغلقة",
      value: closedCount,
      percent: pct(closedCount),
      color: STATUS_COLORS.closed,
    },
  ];

  const nonZeroStatusData = statusData.filter((item) => item.value > 0);

  const departmentData: DepartmentRow[] = (
    Object.keys(CATEGORY_LABELS) as ComplaintCategory[]
  ).map((category) => {
    const items = complaints.filter((c) => c.category === category);
    const open = items.filter((c) => c.status === "new").length;
    const inProgress = items.filter(
      (c) => c.status === "in_progress" || c.status === "pending_manager"
    ).length;
    const closed = items.filter((c) => c.status === "closed").length;
    return {
      category,
      shortName: SHORT_CATEGORY_LABELS[category],
      fullName: CATEGORY_LABELS[category],
      open,
      inProgress,
      closed,
      total: items.length,
    };
  });

  const gridStroke = isDark ? "#1E293B" : "#E2E8F0";
  const axisTickColor = isDark ? "#94A3B8" : "#64748B";
  const pieStroke = isDark ? "#0F172A" : "#FFFFFF";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Status Distribution Chart */}
      <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
              توزيع الشكاوى حسب الحالة
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              مفتوحة · قيد المعالجة · مغلقة
            </p>
          </div>
          {onFilterComplaints && (
            <button
              type="button"
              onClick={onFilterComplaints}
              className="text-xs font-medium text-[#0D74B8] dark:text-sky-400 hover:underline whitespace-nowrap shrink-0"
            >
              تصفية السجل
            </button>
          )}
        </div>

        {total === 0 ? (
          <div className="flex-1 p-10 flex items-center justify-center text-center text-sm text-slate-500 dark:text-slate-400">
            لا توجد شكاوى مسجلة لعرض توزيع الحالات حتى الآن.
          </div>
        ) : (
          <div className="p-5 flex-1 grid grid-cols-1 sm:grid-cols-12 items-center gap-4">
            <div dir="ltr" className="sm:col-span-6 h-[220px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={nonZeroStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={84}
                    paddingAngle={nonZeroStatusData.length > 1 ? 3 : 0}
                    stroke={pieStroke}
                    strokeWidth={2}
                  >
                    {nonZeroStatusData.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<StatusTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold font-mono tabular-nums text-[#1B2E66] dark:text-slate-100">
                  {total}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  إجمالي الشكاوى
                </span>
              </div>
            </div>

            <div className="sm:col-span-6 divide-y divide-slate-100 dark:divide-slate-800">
              {statusData.map((item) => (
                <div key={item.key} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span>{item.name}</span>
                    </span>
                    <div className="flex items-baseline gap-1.5 font-mono tabular-nums">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {item.value}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        ({item.percent}%)
                      </span>
                    </div>
                  </div>
                  {item.detail && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pr-4">
                      {item.detail}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Department Distribution Chart */}
      <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
              توزيع الشكاوى حسب القسم
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              تصنيف البلاغات عبر الأقسام التشغيلية في محطات فنار
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => setDepartmentChartMode("stacked")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                departmentChartMode === "stacked"
                  ? "bg-white dark:bg-slate-950 text-[#1B2E66] dark:text-slate-100"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              حسب الحالة
            </button>
            <button
              type="button"
              onClick={() => setDepartmentChartMode("total")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                departmentChartMode === "total"
                  ? "bg-white dark:bg-slate-950 text-[#1B2E66] dark:text-slate-100"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              الإجمالي
            </button>
          </div>
        </div>

        {total === 0 ? (
          <div className="flex-1 p-10 flex items-center justify-center text-center text-sm text-slate-500 dark:text-slate-400">
            لا توجد بيانات أقسام لعرضها حتى يتم تسجيل الشكوى الأولى.
          </div>
        ) : (
          <div className="p-5 flex-1 flex flex-col justify-between gap-3">
            <div dir="ltr" className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={departmentData}
                  margin={{ top: 8, right: 8, left: -16, bottom: 4 }}
                  barSize={26}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={gridStroke}
                  />
                  <XAxis
                    dataKey="shortName"
                    interval={0}
                    tickLine={false}
                    axisLine={{ stroke: gridStroke }}
                    tick={{ fill: axisTickColor, fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: axisTickColor, fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{
                      fill: isDark ? "rgba(148, 163, 184, 0.08)" : "rgba(15, 23, 42, 0.04)",
                    }}
                    content={<DepartmentTooltip />}
                  />
                  {departmentChartMode === "stacked" ? (
                    <>
                      <Bar
                        dataKey="open"
                        name="مفتوحة"
                        stackId="status"
                        fill={STATUS_COLORS.open}
                      />
                      <Bar
                        dataKey="inProgress"
                        name="قيد المعالجة"
                        stackId="status"
                        fill={STATUS_COLORS.inProgress}
                      />
                      <Bar
                        dataKey="closed"
                        name="مغلقة"
                        stackId="status"
                        fill={STATUS_COLORS.closed}
                        radius={[4, 4, 0, 0]}
                      />
                    </>
                  ) : (
                    <Bar
                      dataKey="total"
                      name="إجمالي الشكاوى"
                      fill={
                        isDark
                          ? STATUS_COLORS.departmentTotalDark
                          : STATUS_COLORS.departmentTotal
                      }
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {departmentChartMode === "stacked" ? (
              <div className="flex flex-wrap items-center justify-end gap-5 text-xs text-slate-600 dark:text-slate-300 pt-1">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#961B5E]" />
                  <span>مفتوحة</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#0D74B8]" />
                  <span>قيد المعالجة</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#10B981]" />
                  <span>مغلقة</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2 text-xs text-slate-500 dark:text-slate-400 pt-1">
                <span>مرر المؤشر على أي عمود لعرض تفاصيل الحالات داخل القسم</span>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
