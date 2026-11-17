import React from "react";
import {
  ArrowLeft,
  CheckCircle2,
  MessageSquare,
  PhoneCall,
  Printer,
  ShieldAlert,
} from "lucide-react";
import {
  CallLog,
  CATEGORY_LABELS,
  CHANNEL_LABELS,
  Complaint,
  Conversation,
  Customer,
  FANAR_BRANCHES,
  findFanarStation,
  formatArabicDate,
} from "../types/crm";
import { PriorityLabel, StatusIndicator } from "./StatusIndicator";
import { OverviewCharts } from "./OverviewCharts";
import { StationImage } from "./StationImage";

interface OverviewViewProps {
  complaints: Complaint[];
  customers: Customer[];
  conversations: Conversation[];
  callLogs: CallLog[];
  resolvedTheme?: "light" | "dark";
  onNavigate: (tab: "whatsapp" | "calls" | "complaints" | "manager" | "customers") => void;
  onSelectComplaint: (complaint: Complaint) => void;
  onPrintSummary: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  complaints,
  customers,
  conversations,
  callLogs,
  resolvedTheme = "light",
  onNavigate,
  onSelectComplaint,
  onPrintSummary,
}) => {
  const [activeStationView, setActiveStationView] = React.useState<
    "canopy" | "pumps" | "services"
  >("canopy");

  const stationViews: Record<
    "canopy" | "pumps" | "services",
    { label: string; src: string; alt: string }
  > = {
    canopy: {
      label: "المظلة",
      src: "/src/assets/images/fanar_official_canopy_night_1794953089804.jpg",
      alt: "المظلة المضيئة ولوحة الأسعار لمحطة فنار الطاقة للوقود - نموذج السلطان وادي الدواسر والمحمدية",
    },
    pumps: {
      label: "المضخات",
      src: "/src/assets/images/fanar_official_pumps_night_1794953090427.jpg",
      alt: "مضخات الوقود الرقمية بهوية فنار الطاقة للوقود (91 / 95)",
    },
    services: {
      label: "الخدمات",
      src: "/src/assets/images/fanar_official_services_night_1794953091819.jpg",
      alt: "مبنى الخدمات المتكاملة وكشك القهوة بهوية فنار في محطة السلطان وادي الدواسر",
    },
  };

  const currentStationVisual = stationViews[activeStationView];

  const totalComplaints = complaints.length;
  const openCount = complaints.filter((c) => c.status === "new" || c.status === "in_progress").length;
  const pendingManagerCount = complaints.filter((c) => c.status === "pending_manager").length;
  const closedCount = complaints.filter((c) => c.status === "closed").length;

  const branchCounts = FANAR_BRANCHES.map((branch) => {
    const st = findFanarStation(branch);
    return {
      branch,
      shortName: st ? `${st.code} · ${st.name}` : branch.split(" - ")[0],
      location: st ? `${st.city} — ${st.region}` : branch.split(" - ")[1] || "",
      total: complaints.filter((c) => c.branch === branch).length,
      open: complaints.filter((c) => c.branch === branch && c.status !== "closed").length,
    };
  });

  const recentComplaints = complaints.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Top Hero Station Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-8 p-6 lg:p-7 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#961B5E] dark:text-pink-400">
              مركز العمليات الموحد — شركة فنار الطاقة للوقود
            </p>
            <h2
              className="text-xl lg:text-2xl font-bold text-[#1B2E66] dark:text-slate-100"
              style={{ fontFamily: "var(--font-display)", textWrap: "balance" }}
            >
              متابعة الشكاوى والاتصالات والرد الآلي عبر الواتساب
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              تُستقبل طلبات العملاء آلياً عبر الواتساب والاتصالات الهاتفية، ويتم إصدار رمز
              شكوى فوري للعميل مع إتاحة المراجعة والإغلاق والطباعة الرسمية لمدير خدمة العملاء.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate("whatsapp")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1B2E66] dark:bg-[#0D74B8] text-white text-xs font-medium hover:bg-[#12204A] dark:hover:bg-[#0A5D94] transition-colors whitespace-nowrap"
            >
              <MessageSquare className="w-4 h-4" />
              <span>مركز الواتساب الذكي ({conversations.length})</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate("calls")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1B2E66] dark:text-slate-100 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
            >
              <PhoneCall className="w-4 h-4 text-[#961B5E] dark:text-pink-400" />
              <span>مركز الاتصالات ({callLogs.length})</span>
            </button>
            <button
              type="button"
              onClick={onPrintSummary}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة السجل المجمع</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 relative min-h-[200px] bg-[#1B2E66]">
          <StationImage
            src={currentStationVisual.src}
            alt={currentStationVisual.alt}
            fallbackTitle="محطة فنار الطاقة للوقود"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#12204A]/85 via-transparent to-[#12204A]/45 pointer-events-none" />
          <div className="absolute top-3 left-3 flex items-center gap-1 p-1 rounded-lg bg-[#0F172A]/70 backdrop-blur-sm border border-white/15">
            {(["canopy", "pumps", "services"] as const).map((viewKey) => (
              <button
                key={viewKey}
                type="button"
                onClick={() => setActiveStationView(viewKey)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                  activeStationView === viewKey
                    ? "bg-white text-[#1B2E66]"
                    : "text-white/85 hover:text-white hover:bg-white/10"
                }`}
              >
                {stationViews[viewKey].label}
              </button>
            ))}
          </div>
          <div className="absolute bottom-3 right-4 left-4 flex items-center justify-between text-white text-xs">
            <span>إجمالي العملاء المسجلين</span>
            <span className="font-mono font-semibold tabular-nums">{customers.length} عميل</span>
          </div>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">إجمالي الشكاوى المسجلة</p>
          <p className="text-3xl font-bold text-[#1B2E66] dark:text-slate-100 font-mono tabular-nums mt-2">
            {totalComplaints}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            عبر الواتساب والاتصالات والتسجيل المباشر
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">شكاوى قيد المعالجة</p>
          <p className="text-3xl font-bold text-[#0D74B8] dark:text-sky-400 font-mono tabular-nums mt-2">
            {openCount}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            تحت متابعة موظفي خدمة العملاء
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">بانتظار اعتماد المدير</p>
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-3xl font-bold text-amber-700 dark:text-amber-400 font-mono tabular-nums mt-2">
            {pendingManagerCount}
          </p>
          <button
            type="button"
            onClick={() => onNavigate("manager")}
            className="text-xs text-[#961B5E] dark:text-pink-400 font-medium hover:underline mt-2 inline-flex items-center gap-1"
          >
            <span>فتح بوابة المدير</span>
            <ArrowLeft className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">الشكاوى المغلقة</p>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums mt-2">
            {closedCount}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            نسبة الإغلاق:{" "}
            <span className="font-mono tabular-nums font-medium text-slate-700 dark:text-slate-200">
              {totalComplaints > 0 ? Math.round((closedCount / totalComplaints) * 100) : 0}%
            </span>
          </p>
        </div>
      </div>

      {/* Recharts Distribution Analytics (Status & Department) */}
      <OverviewCharts
        complaints={complaints}
        isDark={resolvedTheme === "dark"}
        onFilterComplaints={() => onNavigate("complaints")}
      />

      {/* Main Split: Recent Complaints Table + Station Branches */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
                أحدث شكاوى العملاء
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                انقر على أي شكوى لعرض التفاصيل أو طباعتها أو متابعة إغلاقها
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("complaints")}
              className="text-xs font-medium text-[#0D74B8] dark:text-sky-400 hover:underline whitespace-nowrap shrink-0"
            >
              عرض السجل الكامل
            </button>
          </div>

          {recentComplaints.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              لا توجد شكاوى مسجلة حتى الآن.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <th className="py-3 px-4">رمز الشكوى</th>
                    <th className="py-3 px-4">العميل</th>
                    <th className="py-3 px-4">الفرع والتصنيف</th>
                    <th className="py-3 px-4">القناة</th>
                    <th className="py-3 px-4">الأولوية</th>
                    <th className="py-3 px-4">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {recentComplaints.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => onSelectComplaint(c)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[#1B2E66] dark:text-sky-300 tabular-nums whitespace-nowrap">
                        {c.ticketCode}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[160px]">
                          {c.customerName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          {c.customerPhone}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs text-slate-800 dark:text-slate-200 truncate max-w-[190px]">
                          {c.branch}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {CATEGORY_LABELS[c.category]}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {CHANNEL_LABELS[c.channel]}
                      </td>
                      <td className="py-3 px-4">
                        <PriorityLabel priority={c.priority} />
                      </td>
                      <td className="py-3 px-4">
                        <StatusIndicator status={c.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Station Branch Summary */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
              توزيع الشكاوى حسب المحطة
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">مراقبة الفروع النشطة</p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 flex-1">
            {branchCounts.map((item) => (
              <div key={item.branch} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {item.shortName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {item.location}
                  </p>
                </div>
                <div className="text-left shrink-0">
                  <p className="text-sm font-bold font-mono tabular-nums text-[#1B2E66] dark:text-slate-100">
                    {item.total}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    مفتوحة: {item.open}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
            <span>آخر تحديث للسجل</span>
            <span className="font-mono tabular-nums">
              {complaints[0]?.createdAt ? formatArabicDate(complaints[0].createdAt) : "الآن"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
