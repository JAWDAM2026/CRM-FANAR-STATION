import React from "react";
import { Printer, X } from "lucide-react";
import { FanarLogo } from "./FanarLogo";
import {
  CATEGORY_LABELS,
  CHANNEL_LABELS,
  Complaint,
  formatArabicDate,
  getComplaintEffectiveDate,
  OFFICIAL_WHATSAPP_NUMBER,
  PRIORITY_LABELS,
  resolveComplaintSlaTier,
  SLA_TIERS,
  STATUS_LABELS,
} from "../types/crm";

export type PrintMode =
  | { type: "single"; complaint: Complaint }
  | { type: "register"; complaints: Complaint[]; filterSummary: string };

interface PrintModalProps {
  mode: PrintMode | null;
  officialWhatsappNumber?: string;
  onClose: () => void;
}

const PrintableDocumentBody: React.FC<{
  mode: PrintMode;
  officialWhatsappNumber: string;
}> = ({ mode, officialWhatsappNumber }) => {
  const printDate = formatArabicDate(new Date());

  return (
    <div className="bg-white text-slate-900 space-y-6" dir="rtl">
      {/* Official Fanar Letterhead */}
      <div className="border-b-2 border-[#1B2E66] pb-4 flex items-center justify-between gap-6">
        <div className="space-y-1">
          <FanarLogo variant="dark" size="lg" showSubtitle adaptiveDark={false} />
          <p className="text-xs text-slate-600">
            إدارة خدمة العملاء وضمان جودة التشغيل — السجل الرسمي للشكاوى والبلاغات
          </p>
          <p className="text-xs text-slate-700">
            واتساب خدمة العملاء الرسمي:{" "}
            <span dir="ltr" className="font-mono font-semibold text-[#961B5E] tabular-nums">
              {officialWhatsappNumber}
            </span>
            {" · "}
            الرقم الموحد:{" "}
            <span dir="ltr" className="font-mono font-semibold text-[#1B2E66] tabular-nums">
              920014255
            </span>
            {" · "}
            وادي الدواسر
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-left text-xs text-slate-600 space-y-0.5">
            <p>تاريخ الطباعة: <span className="font-mono tabular-nums">{printDate}</span></p>
            <p>
              نوع المستند:{" "}
              <span className="font-semibold text-[#1B2E66]">
                {mode.type === "single" ? "تذكرة شكوى فردية" : "سجل مجمع للشكاوى"}
              </span>
            </p>
          </div>
          <img
            src="/src/assets/images/fanar_official_canopy_night_1794953089804.jpg"
            alt="مظلة ولوحة أسعار محطة فنار الطاقة للوقود - وادي الدواسر والمحمدية"
            referrerPolicy="no-referrer"
            className="w-20 h-14 object-cover rounded border border-slate-200"
          />
        </div>
      </div>

      {mode.type === "single" ? (
        <div className="space-y-5">
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div>
              <p className="text-xs text-slate-500">رمز متابعة الشكوى الرسمي</p>
              <p className="text-xl font-bold font-mono text-[#961B5E] tabular-nums mt-0.5">
                {mode.complaint.ticketCode}
              </p>
            </div>
            <div className="text-left text-xs space-y-1">
              <p>
                الحالة الحالية:{" "}
                <strong className="text-[#1B2E66]">
                  {STATUS_LABELS[mode.complaint.status]}
                </strong>{" "}
                · مستوى SLA:{" "}
                <strong className="font-mono">
                  {SLA_TIERS[resolveComplaintSlaTier(mode.complaint)].label}
                </strong>
              </p>
              <p>
                تاريخ التسجيل:{" "}
                <span className="font-mono tabular-nums">
                  {formatArabicDate(getComplaintEffectiveDate(mode.complaint))}
                </span>
              </p>
            </div>
          </div>

          <table className="w-full text-right border-collapse border border-slate-300 text-xs">
            <tbody>
              <tr className="border-b border-slate-300">
                <th className="bg-slate-50 p-2.5 w-36 font-semibold text-slate-700 border-l border-slate-300">
                  اسم العميل
                </th>
                <td className="p-2.5 border-l border-slate-300">{mode.complaint.customerName}</td>
                <th className="bg-slate-50 p-2.5 w-36 font-semibold text-slate-700 border-l border-slate-300">
                  رقم الجوال / الواتساب
                </th>
                <td className="p-2.5 font-mono tabular-nums">{mode.complaint.customerPhone}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <th className="bg-slate-50 p-2.5 font-semibold text-slate-700 border-l border-slate-300">
                  فرع المحطة
                </th>
                <td className="p-2.5 border-l border-slate-300">{mode.complaint.branch}</td>
                <th className="bg-slate-50 p-2.5 font-semibold text-slate-700 border-l border-slate-300">
                  رقم المضخة / الموقع
                </th>
                <td className="p-2.5">{mode.complaint.pumpNumber || "غير محدد"}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <th className="bg-slate-50 p-2.5 font-semibold text-slate-700 border-l border-slate-300">
                  التصنيف والأولوية
                </th>
                <td className="p-2.5 border-l border-slate-300">
                  {CATEGORY_LABELS[mode.complaint.category]} ({PRIORITY_LABELS[mode.complaint.priority]})
                </td>
                <th className="bg-slate-50 p-2.5 font-semibold text-slate-700 border-l border-slate-300">
                  قناة الاستقبال
                </th>
                <td className="p-2.5">
                  {CHANNEL_LABELS[mode.complaint.channel]} ·{" "}
                  {mode.complaint.codeSentViaWhatsapp ? "تم إرسال الرمز للواتساب" : "داخلي / بوابة"}
                  {mode.complaint.csatScore ? ` · CSAT: ${mode.complaint.csatScore}/5` : ""}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="border border-slate-300 rounded-lg p-4 space-y-2">
            <h4 className="text-xs font-bold text-[#1B2E66]">تفاصيل شكوى العميل</h4>
            <p className="text-xs leading-relaxed text-slate-800">{mode.complaint.description}</p>
            {mode.complaint.aiSummary && (
              <p className="text-xs text-slate-600 pt-2 border-t border-slate-200">
                <strong>ملخص المعالجة الأولي: </strong>
                {mode.complaint.aiSummary}
              </p>
            )}
          </div>

          <div className="border border-slate-300 rounded-lg p-4 space-y-2">
            <h4 className="text-xs font-bold text-[#1B2E66]">قرار وإغلاق مدير خدمة العملاء</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <p>
                <strong>قرار المعالجة: </strong>
                {mode.complaint.closureReason || "قيد المراجعة ولم يُعتمد الإغلاق بعد"}
              </p>
              <p>
                <strong>اعتماد المدير: </strong>
                {mode.complaint.closedBy || "—"}
              </p>
            </div>
            <p className="text-xs text-slate-700">
              <strong>ملاحظات الإدارة: </strong>
              {mode.complaint.managerNotes || "لا توجد ملاحظات إضافية مسجلة."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
            <span>
              نطاق التقرير: <strong>{mode.filterSummary}</strong>
            </span>
            <div className="flex items-center gap-5 font-mono tabular-nums">
              <span>الإجمالي: {mode.complaints.length}</span>
              <span>
                المغلقة: {mode.complaints.filter((c) => c.status === "closed").length}
              </span>
              <span>
                المفتوحة: {mode.complaints.filter((c) => c.status !== "closed").length}
              </span>
            </div>
          </div>

          <table className="w-full text-right border-collapse border border-slate-300 text-[11px]">
            <thead>
              <tr className="bg-[#1B2E66] text-white">
                <th className="p-2 border border-slate-300">الرمز</th>
                <th className="p-2 border border-slate-300">العميل والجوال</th>
                <th className="p-2 border border-slate-300">المحطة والتصنيف</th>
                <th className="p-2 border border-slate-300">القناة</th>
                <th className="p-2 border border-slate-300">الحالة</th>
                <th className="p-2 border border-slate-300">قرار الإغلاق</th>
              </tr>
            </thead>
            <tbody>
              {mode.complaints.map((c) => (
                <tr key={c.id} className="border-b border-slate-200">
                  <td className="p-2 border border-slate-300 font-mono font-semibold tabular-nums whitespace-nowrap">
                    {c.ticketCode}
                  </td>
                  <td className="p-2 border border-slate-300">
                    <div className="font-semibold">{c.customerName}</div>
                    <div className="font-mono text-slate-600 tabular-nums">{c.customerPhone}</div>
                  </td>
                  <td className="p-2 border border-slate-300">
                    <div>{c.branch}</div>
                    <div className="text-slate-500">{CATEGORY_LABELS[c.category]}</div>
                  </td>
                  <td className="p-2 border border-slate-300 whitespace-nowrap">
                    {CHANNEL_LABELS[c.channel]}
                  </td>
                  <td className="p-2 border border-slate-300 whitespace-nowrap font-semibold">
                    {STATUS_LABELS[c.status]}
                  </td>
                  <td className="p-2 border border-slate-300">
                    {c.closureReason || "قيد المتابعة"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Official Signature Footer */}
      <div className="pt-8 border-t border-slate-300 grid grid-cols-3 gap-6 text-xs text-slate-700">
        <div>
          <p className="font-semibold">مسؤول خدمة العملاء</p>
          <p className="mt-6 border-b border-dashed border-slate-400 w-40" />
        </div>
        <div>
          <p className="font-semibold">مدير خدمة العملاء</p>
          <p className="mt-6 border-b border-dashed border-slate-400 w-40" />
        </div>
        <div className="text-left">
          <p className="font-semibold">الختم الرسمي للشركة</p>
          <p className="mt-2 text-[11px] text-slate-500">شركة فنار الطاقة للوقود</p>
          <p className="mt-0.5 text-[11px] text-slate-600">
            واتساب:{" "}
            <span dir="ltr" className="font-mono tabular-nums">
              {officialWhatsappNumber}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export const PrintModal: React.FC<PrintModalProps> = ({
  mode,
  officialWhatsappNumber = OFFICIAL_WHATSAPP_NUMBER,
  onClose,
}) => {
  if (!mode) return null;

  return (
    <>
      {/* Screen Preview Modal */}
      <div className="no-print fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
              معاينة الطباعة الرسمية — شركة فنار الطاقة للوقود
            </h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#961B5E] text-white text-xs font-semibold hover:bg-[#7A144B] transition-colors whitespace-nowrap"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة / حفظ كـ PDF</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="إغلاق المعاينة"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-8 overflow-y-auto bg-slate-100 dark:bg-slate-950">
            <div className="bg-white p-8 border border-slate-200 rounded-lg max-w-[794px] mx-auto">
              <PrintableDocumentBody
                mode={mode}
                officialWhatsappNumber={officialWhatsappNumber}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Actual Print Output Layer */}
      <div className="print-only">
        <PrintableDocumentBody
          mode={mode}
          officialWhatsappNumber={officialWhatsappNumber}
        />
      </div>
    </>
  );
};
