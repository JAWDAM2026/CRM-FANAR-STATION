import React, { useState } from "react";
import { FanarLogo } from "./FanarLogo";
import { StationImage } from "./StationImage";
import { CustomerPortalView } from "./CustomerPortalView";
import {
  CheckCircle2,
  MessageSquare,
  Moon,
  PhoneCall,
  Printer,
  ShieldCheck,
  Sun,
  UserCheck,
} from "lucide-react";

interface LoginScreenProps {
  onSignIn: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  resolvedTheme?: "light" | "dark";
  onToggleTheme?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onSignIn,
  isLoading,
  error,
  resolvedTheme = "light",
  onToggleTheme,
}) => {
  const [landingMode, setLandingMode] = useState<"staff" | "customer">("staff");

  return (
    <div className="min-h-screen bg-[#F5F7FA] dark:bg-slate-950 flex flex-col">
      {/* Top 3-Zone Bar */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-10 py-4 flex flex-wrap items-center justify-between gap-6">
        <FanarLogo variant="dark" size="md" />

        {/* Mode Switcher: Public Customer Portal vs Staff Login */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setLandingMode("customer")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              landingMode === "customer"
                ? "bg-white dark:bg-slate-950 text-[#961B5E] dark:text-pink-400"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            بوابة العميل
          </button>
          <button
            type="button"
            onClick={() => setLandingMode("staff")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              landingMode === "staff"
                ? "bg-white dark:bg-slate-950 text-[#1B2E66] dark:text-slate-100"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            دخول الموظفين
          </button>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              title={
                resolvedTheme === "dark"
                  ? "التبديل إلى الوضع الفاتح"
                  : "التبديل إلى الوضع الداكن"
              }
              aria-label="تبديل المظهر الفاتح والداكن"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-[#1B2E66]" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={landingMode === "customer" ? () => setLandingMode("staff") : onSignIn}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#961B5E] text-white text-sm font-medium hover:bg-[#7A144B] transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            <UserCheck className="w-4 h-4" />
            <span>{isLoading ? "جاري تسجيل الدخول..." : "دخول الموظفين"}</span>
          </button>
        </div>
      </header>

      {landingMode === "customer" ? (
        <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 lg:px-10 py-8">
          <CustomerPortalView onSwitchToStaff={() => setLandingMode("staff")} />
        </main>
      ) : (
      <>
      {/* Main Split Showcase */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 lg:px-10 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Right Column (RTL Start): Auth & Capabilities */}
        <section className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 lg:p-10 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-[#961B5E] dark:text-pink-400 tracking-wide">
                نظام إدارة علاقات العملاء والشكاوى (CRM)
              </p>
              <h1
                className="text-3xl lg:text-4xl font-bold text-[#1B2E66] dark:text-slate-100 leading-tight"
                style={{ fontFamily: "var(--font-display)", textWrap: "balance" }}
              >
                منظومة خدمة عملاء محطات فنار الطاقة للوقود
              </h1>
              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                إدارة موحدة لشكاوى وبلاغات العملاء تبدأ من الرد الآلي الذكي على الواتساب
                والمكالمات الهاتفية، وتنتهي بإصدار رمز الشكوى ومتابعتها وطباعتها وإغلاقها
                من مدير خدمة العملاء.
              </p>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-[#0D74B8] dark:text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-[#1B2E66] dark:text-slate-100">
                    واتساب بالذكاء الاصطناعي
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    رد تلقائي ذكي، استخلاص تفاصيل الشكوى، وإرسال رمز المتابعة للعميل فوراً.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <PhoneCall className="w-5 h-5 text-[#961B5E] dark:text-pink-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-[#1B2E66] dark:text-slate-100">
                    استقبال اتصالات آلي
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    رد صوتي تفاعلي وتوثيق نصي للمكالمات وربطها مباشرة بسجل الشكاوى.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#1B2E66] dark:text-sky-300 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-[#1B2E66] dark:text-slate-100">
                    إغلاق مدير خدمة العملاء
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    متابعة الطلبات المصعّدة، توثيق قرار المعالجة، وإشعار العميل عند الإغلاق.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Printer className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-[#1B2E66] dark:text-slate-100">
                    سجلات مجمعة وطباعة
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    تقارير طباعة رسمية بترويسة وهوية فنار للشكوى الفردية والسجل المجمع.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-200 dark:border-slate-800 mt-8 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={onSignIn}
              disabled={isLoading}
              className="w-full py-3.5 px-6 rounded-lg bg-[#1B2E66] hover:bg-[#12204A] dark:bg-[#0D74B8] dark:hover:bg-[#0A5D94] text-white font-semibold text-sm flex items-center justify-center gap-3 transition-colors disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {isLoading
                  ? "جاري التحقق من الحساب..."
                  : "تسجيل الدخول عبر حساب Google المعتمد"}
              </span>
            </button>

            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              تُحفظ كافة السجلات والشكاوى بشكل سحابي مشفر مرتبط بصلاحيات الموظف ومدير خدمة العملاء.
            </p>
          </div>
        </section>

        {/* Left Column: Updated Fanar Al-Sultan (Wadi Al-Dawasir) & Al-Mohammadiya Night Showcase */}
        <section className="lg:col-span-6 flex flex-col gap-4">
          <div className="relative flex-1 min-h-[280px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#1B2E66]">
            <StationImage
              src="/src/assets/images/fanar_official_canopy_night_1794953089804.jpg"
              alt="المظلة المضيئة ولوحة الأسعار ومبنى الخدمات لمحطة فنار الطاقة للوقود - نموذج السلطان وادي الدواسر والمحمدية"
              fallbackTitle="مظلة ولوحة أسعار محطة فنار الطاقة للوقود"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#12204A]/90 via-[#12204A]/25 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 p-6 text-white">
              <p className="text-xs font-medium text-sky-200">
                هوية شركة فنار الطاقة للوقود — محطتا السلطان (وادي الدواسر) والمحمدية
              </p>
              <p className="text-lg font-bold mt-1" style={{ fontFamily: "var(--font-display)" }}>
                جودة الخدمة وسرعة الاستجابة في جميع الفروع
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 h-44">
            <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#1B2E66]">
              <StationImage
                src="/src/assets/images/fanar_official_services_night_1794953091819.jpg"
                alt="مبنى الخدمات المتكاملة وكشك القهوة بهوية فنار في محطة السلطان وادي الدواسر"
                fallbackTitle="مبنى الخدمات المتكاملة والمقهى"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/85 via-[#0F172A]/15 to-transparent" />
              <span className="absolute bottom-3 right-3 text-xs font-medium text-white">
                مبنى الخدمات المتكاملة والمقهى
              </span>
            </div>

            <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#1B2E66]">
              <StationImage
                src="/src/assets/images/fanar_official_pumps_night_1794953090427.jpg"
                alt="مضخات الوقود الرقمية بهوية فنار الطاقة للوقود (91 / 95)"
                fallbackTitle="مضخات الوقود وشاشات الدفع"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/85 via-[#0F172A]/15 to-transparent" />
              <span className="absolute bottom-3 right-3 text-xs font-medium text-white">
                مضخات الوقود وشاشات الدفع
              </span>
            </div>
          </div>
        </section>
      </main>
      </>
      )}
    </div>
  );
};
