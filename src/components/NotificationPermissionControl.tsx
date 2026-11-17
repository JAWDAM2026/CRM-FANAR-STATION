import React from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { BrowserNotificationPermissionState } from "../lib/browserNotifications";

interface NotificationPermissionControlProps {
  permission: BrowserNotificationPermissionState;
  muted: boolean;
  onRequestPermission: () => Promise<void>;
  onToggleMute: () => void;
  onBlockedInfo: () => void;
}

export const NotificationPermissionControl: React.FC<
  NotificationPermissionControlProps
> = ({ permission, muted, onRequestPermission, onToggleMute, onBlockedInfo }) => {
  if (permission === "unsupported") {
    return null;
  }

  if (permission === "default") {
    return (
      <button
        type="button"
        onClick={onRequestPermission}
        title="طلب إذن إشعارات المتصفح للشكاوى وتصعيدات الواتساب"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1B2E66] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
      >
        <BellRing className="w-3.5 h-3.5 text-[#0D74B8] dark:text-sky-400 shrink-0" />
        <span className="hidden sm:inline">تفعيل الإشعارات</span>
      </button>
    );
  }

  if (permission === "denied") {
    return (
      <button
        type="button"
        onClick={onBlockedInfo}
        title="إشعارات المتصفح محظورة حالياً — اضغط لعرض تعليمات التفعيل"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
      >
        <BellOff className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">الإشعارات محظورة</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggleMute}
      aria-pressed={!muted}
      title={
        muted
          ? "التنبيهات مكتومة — اضغط لإعادة تفعيل الإشعارات الفورية والصوت"
          : "إشعارات المتصفح مفعّلة — اضغط لكتم التنبيهات مؤقتاً"
      }
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
        muted
          ? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          : "border-[#0D74B8]/30 dark:border-sky-500/40 bg-[#0D74B8]/10 dark:bg-sky-500/15 text-[#1B2E66] dark:text-sky-300 hover:bg-[#0D74B8]/15 dark:hover:bg-sky-500/25"
      }`}
    >
      {muted ? (
        <BellOff className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
      ) : (
        <Bell className="w-3.5 h-3.5 text-[#0D74B8] dark:text-sky-400 shrink-0" />
      )}
      <span className="hidden sm:inline">
        {muted ? "التنبيهات مكتومة" : "الإشعارات مفعّلة"}
      </span>
    </button>
  );
};
