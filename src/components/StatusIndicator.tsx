import React from "react";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  CheckCheck,
  Clock,
  PauseCircle,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import {
  Complaint,
  ComplaintPriority,
  ComplaintStatus,
  computeSlaStatus,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "../types/crm";

export const StatusIndicator: React.FC<{ status: ComplaintStatus }> = ({ status }) => {
  switch (status) {
    case "new":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#961B5E] dark:text-pink-400 whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{STATUS_LABELS[status]}</span>
        </span>
      );
    case "in_progress":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D74B8] dark:text-sky-400 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{STATUS_LABELS[status]}</span>
        </span>
      );
    case "waiting_customer":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400 whitespace-nowrap">
          <PauseCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{STATUS_LABELS[status]}</span>
        </span>
      );
    case "pending_manager":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span>{STATUS_LABELS[status]}</span>
        </span>
      );
    case "resolved":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-400 whitespace-nowrap">
          <CheckCheck className="w-3.5 h-3.5 shrink-0" />
          <span>{STATUS_LABELS[status]}</span>
        </span>
      );
    case "closed":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{STATUS_LABELS[status]}</span>
        </span>
      );
    case "reopened":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 whitespace-nowrap">
          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
          <span>{STATUS_LABELS[status]}</span>
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
          <Ban className="w-3.5 h-3.5 shrink-0" />
          <span>{STATUS_LABELS[status]}</span>
        </span>
      );
  }
};

export const PriorityLabel: React.FC<{ priority: ComplaintPriority }> = ({ priority }) => {
  const colorClass =
    priority === "urgent"
      ? "text-red-700 dark:text-red-400 font-semibold"
      : priority === "high"
      ? "text-amber-700 dark:text-amber-400 font-medium"
      : "text-slate-600 dark:text-slate-300";

  return <span className={`text-xs whitespace-nowrap ${colorClass}`}>{PRIORITY_LABELS[priority]}</span>;
};

function formatDurationShort(totalMinutes: number): string {
  const abs = Math.abs(Math.round(totalMinutes));
  if (abs < 60) return `${abs}د`;
  const hrs = Math.floor(abs / 60);
  const mins = abs % 60;
  return mins > 0 ? `${hrs}س ${mins}د` : `${hrs}س`;
}

export const SlaBadge: React.FC<{ complaint: Complaint }> = ({ complaint }) => {
  const sla = computeSlaStatus(complaint);
  const isTerminal = complaint.status === "closed" || complaint.status === "cancelled";

  const tierTone =
    sla.tier === "P1"
      ? "text-red-700 dark:text-red-400"
      : sla.tier === "P2"
      ? "text-amber-700 dark:text-amber-400"
      : sla.tier === "P3"
      ? "text-[#0D74B8] dark:text-sky-400"
      : "text-slate-600 dark:text-slate-300";

  return (
    <div className="space-y-0.5 text-xs whitespace-nowrap">
      <div className="flex items-center gap-1.5">
        <span className={`font-mono font-bold tabular-nums ${tierTone}`}>{sla.tier}</span>
        {!isTerminal && sla.isPaused && (
          <span className="text-[11px] text-indigo-700 dark:text-indigo-400 font-medium">
            متوقف بانتظار العميل
          </span>
        )}
        {!isTerminal && !sla.isPaused && sla.isBreached && (
          <span className="text-[11px] text-red-700 dark:text-red-400 font-semibold font-mono tabular-nums">
            متجاوز SLA ({formatDurationShort(sla.remainingMinutes)})
          </span>
        )}
        {!isTerminal && !sla.isPaused && !sla.isBreached && (
          <span className="text-[11px] text-slate-600 dark:text-slate-300 font-mono tabular-nums">
            متبقي {formatDurationShort(sla.remainingMinutes)}
          </span>
        )}
        {isTerminal && (
          <span
            className={`text-[11px] font-medium ${
              sla.isBreached
                ? "text-amber-700 dark:text-amber-400"
                : "text-emerald-700 dark:text-emerald-400"
            }`}
          >
            {sla.isBreached ? "أُغلق بعد المهلة" : "ضمن SLA"}
          </span>
        )}
      </div>
    </div>
  );
};
