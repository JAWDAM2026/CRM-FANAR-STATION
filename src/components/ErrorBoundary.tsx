import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || "حدث خطأ غير متوقع في النظام",
    };
  }

  componentDidCatch(error: Error) {
    console.error("CRM ErrorBoundary:", error);
  }

  render() {
    if (this.state.hasError) {
      let friendly = "تعذر إتمام العملية الحالية. يرجى إعادة تحميل الصفحة أو التحقق من الصلاحيات.";
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) {
          friendly = `تعذر الوصول للبيانات (${parsed.operationType || "Firestore"}): ${parsed.error}`;
        }
      } catch {
        if (this.state.message) {
          friendly = this.state.message;
        }
      }

      return (
        <div className="min-h-screen bg-[#F5F7FA] dark:bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-right space-y-5">
            <div className="flex items-center gap-3 text-[#DC2626] dark:text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-bold text-[#1B2E66] dark:text-slate-100">
                تنبيه تشغيل النظام
              </h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1B2E66] text-white text-sm font-medium hover:bg-[#12204A] transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة تحميل النظام</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
