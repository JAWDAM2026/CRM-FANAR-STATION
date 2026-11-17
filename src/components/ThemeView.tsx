import React from "react";
import { CheckCircle2, Monitor, Moon, Sun } from "lucide-react";
import { FanarLogo } from "./FanarLogo";

export type ThemePreference = "light" | "dark" | "system";

interface ThemeViewProps {
  themePreference: ThemePreference;
  resolvedTheme: "light" | "dark";
  onChangeTheme: (next: ThemePreference) => void;
}

export const ThemeView: React.FC<ThemeViewProps> = ({
  themePreference,
  resolvedTheme,
  onChangeTheme,
}) => {
  const options: Array<{
    key: ThemePreference;
    title: string;
    subtitle: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    previewBg: string;
    previewCard: string;
    previewText: string;
    previewSubtext: string;
    previewBorder: string;
  }> = [
    {
      key: "light",
      title: "الوضع الفاتح (Light Mode)",
      subtitle: "وضوح نهاري وإضاءة مكتبية عالية",
      description:
        "خلفية محايدة ناعمة مع سطوح بيضاء ناصعة وعناوين كحلية بنظام ألوان فنار الرسمي، مثالي لبيئة المكاتب وساعات العمل النهارية.",
      icon: Sun,
      previewBg: "bg-[#F5F7FA]",
      previewCard: "bg-white",
      previewText: "text-[#1B2E66]",
      previewSubtext: "text-slate-500",
      previewBorder: "border-slate-200",
    },
    {
      key: "dark",
      title: "الوضع الداكن (Dark Mode)",
      subtitle: "راحة بصرية للمراقبة المسائية والمناوبات",
      description:
        "خلفية داكنة عميقة بسطوح متدرجة وتباين عالٍ للنصوص والأرقام والرموز، مصمم لتخفيف إجهاد العين في غرف العمليات والمناوبات الليلية.",
      icon: Moon,
      previewBg: "bg-slate-950",
      previewCard: "bg-slate-900",
      previewText: "text-slate-100",
      previewSubtext: "text-slate-400",
      previewBorder: "border-slate-800",
    },
    {
      key: "system",
      title: "تلقائي حسب الجهاز (System)",
      subtitle: "مزامنة فورية مع إعدادات نظام التشغيل",
      description:
        "يتحول النظام تلقائياً بين الوضع الفاتح والداكن استناداً إلى تفضيل المتصفح أو نظام التشغيل الحالي.",
      icon: Monitor,
      previewBg: resolvedTheme === "dark" ? "bg-slate-950" : "bg-[#F5F7FA]",
      previewCard: resolvedTheme === "dark" ? "bg-slate-900" : "bg-white",
      previewText: resolvedTheme === "dark" ? "text-slate-100" : "text-[#1B2E66]",
      previewSubtext: resolvedTheme === "dark" ? "text-slate-400" : "text-slate-500",
      previewBorder: resolvedTheme === "dark" ? "border-slate-800" : "border-slate-200",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[#961B5E] dark:text-pink-400">
            تفضيلات الواجهة وإعدادات العرض
          </p>
          <h2
            className="text-lg lg:text-xl font-bold text-[#1B2E66] dark:text-slate-100"
            style={{ fontFamily: "var(--font-display)" }}
          >
            الوضع الفاتح والوضع الداكن (Light Mode & Dark Mode)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
            اختر مظهر النظام المناسب لبيئة عملك في مركز خدمة عملاء فنار الطاقة للوقود. يُحفظ اختيارك
            تلقائياً على هذا المتصفح ويُطبّق فوراً على جميع الشاشات والجداول ومحادثات الواتساب.
          </p>
        </div>

        {/* Segmented Quick Switch */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => onChangeTheme("light")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              themePreference === "light"
                ? "bg-white text-[#1B2E66]"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>الوضع الفاتح</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTheme("dark")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              themePreference === "dark"
                ? "bg-slate-950 text-white"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>الوضع الداكن</span>
          </button>
        </div>
      </div>

      {/* Mode Selection Cards with Live Visual Previews */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {options.map((opt) => {
          const Icon = opt.icon;
          const isSelected = themePreference === opt.key;

          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChangeTheme(opt.key)}
              className={`text-right rounded-xl border p-5 transition-colors flex flex-col justify-between gap-5 ${
                isSelected
                  ? "bg-white dark:bg-slate-900 border-[#961B5E] ring-1 ring-[#961B5E]"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="space-y-4 w-full">
                {/* Visual Mini Mockup Preview */}
                <div
                  className={`rounded-lg border p-3.5 space-y-2.5 ${opt.previewBg} ${opt.previewBorder}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${opt.previewText}`}>
                      فنار الطاقة للوقود
                    </span>
                    <span className="font-mono text-[10px] text-[#0D74B8] tabular-nums">
                      FNR-2611-4018
                    </span>
                  </div>
                  <div
                    className={`rounded-md border p-2.5 space-y-1.5 ${opt.previewCard} ${opt.previewBorder}`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`font-semibold ${opt.previewText}`}>
                        مركز الواتساب الذكي
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        نشط
                      </span>
                    </div>
                    <p className={`text-[10px] ${opt.previewSubtext}`}>
                      معاينة تباين النصوص والحدود والبطاقات
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-[#1B2E66] dark:text-slate-100">
                      <Icon className="w-4 h-4 text-[#961B5E] dark:text-pink-400 shrink-0" />
                      <span>{opt.title}</span>
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-[#961B5E] dark:text-pink-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs font-medium text-[#0D74B8] dark:text-sky-400">
                    {opt.subtitle}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {opt.description}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 w-full flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">الحالة</span>
                <span
                  className={
                    isSelected
                      ? "font-semibold text-[#961B5E] dark:text-pink-400"
                      : "text-slate-600 dark:text-slate-400"
                  }
                >
                  {isSelected ? "مفعّل حالياً" : "اضغط للتفعيل"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Component Contrast Preview */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
              معاينة المظهر النشط حالياً (
              {resolvedTheme === "dark" ? "الوضع الداكن" : "الوضع الفاتح"})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              تظهر النماذج المطبوعة (PDF / A4) دائماً بخلفية ورقية بيضاء للحفاظ على جودة الطباعة الرسمية.
            </p>
          </div>
          <FanarLogo variant="dark" size="sm" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-[#F5F7FA] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-500 dark:text-slate-400">الخلفية الأساسية</span>
            <p className="font-mono font-semibold text-[#1B2E66] dark:text-slate-100 tabular-nums">
              {resolvedTheme === "dark" ? "#020617 (Slate 950)" : "#F5F7FA (Fanar Canvas)"}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-[#F5F7FA] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-500 dark:text-slate-400">سطوح البطاقات والجداول</span>
            <p className="font-mono font-semibold text-[#1B2E66] dark:text-slate-100 tabular-nums">
              {resolvedTheme === "dark" ? "#0F172A (Slate 900)" : "#FFFFFF (Pure Surface)"}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-[#F5F7FA] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-500 dark:text-slate-400">ألوان الهوية المميزة</span>
            <p className="font-mono font-semibold text-[#961B5E] dark:text-pink-400 tabular-nums">
              #961B5E · #1B2E66 · #0D74B8
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
