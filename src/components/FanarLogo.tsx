import React from "react";

interface FanarLogoProps {
  variant?: "light" | "dark" | "pylon";
  showSubtitle?: boolean;
  size?: "sm" | "md" | "lg";
  adaptiveDark?: boolean;
}

export const FanarLogo: React.FC<FanarLogoProps> = ({
  variant = "dark",
  showSubtitle = false,
  size = "md",
  adaptiveDark = true,
}) => {
  const imageDimensions =
    size === "sm" ? "h-9 w-9" : size === "lg" ? "h-14 w-14" : "h-11 w-11";

  const useDarkOverrides = variant === "dark" && adaptiveDark;
  const textColor =
    variant === "light"
      ? "text-white"
      : useDarkOverrides
      ? "text-[#1B2E66] dark:text-slate-100"
      : "text-[#1B2E66]";
  const subTextColor =
    variant === "light"
      ? "text-white/75"
      : useDarkOverrides
      ? "text-slate-500 dark:text-slate-400"
      : "text-slate-500";
  const frameClasses =
    variant === "light"
      ? "bg-white rounded-lg p-1 shadow-xs"
      : useDarkOverrides
      ? "bg-white rounded-lg p-0.5 border border-slate-200/80 dark:border-slate-700"
      : "bg-white rounded-lg p-0.5 border border-slate-200/80";

  return (
    <div className="inline-flex items-center gap-3 shrink-0 select-none">
      <div className={`${frameClasses} shrink-0 flex items-center justify-center`}>
        <img
          src="/assets/aistudio/FANAR_c2cfe8c8.jpeg"
          alt="شعار شركة فنار الطاقة للوقود FANAR"
          referrerPolicy="no-referrer"
          className={`${imageDimensions} object-contain rounded`}
        />
      </div>

      <div className="flex flex-col leading-tight">
        <span
          className={`font-bold tracking-tight whitespace-nowrap ${
            size === "lg" ? "text-xl" : size === "sm" ? "text-sm" : "text-base"
          } ${textColor}`}
          style={{ fontFamily: "var(--font-display)" }}
        >
          فنار الطاقة للوقود
        </span>
        {showSubtitle && (
          <span className={`text-xs whitespace-nowrap mt-0.5 ${subTextColor}`}>
            منظومة إدارة علاقات العملاء والشكاوى
          </span>
        )}
      </div>
    </div>
  );
};
