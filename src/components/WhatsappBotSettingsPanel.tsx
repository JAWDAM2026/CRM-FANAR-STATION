import React, { useEffect, useState } from "react";
import { ExternalLink, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { saveWhatsappBotConfig } from "../lib/crmService";
import {
  BOT_FIELD_LIMITS,
  BotFaqCategory,
  BotFaqItem,
  buildWhatsappDirectUrl,
  DEFAULT_WHATSAPP_BOT_CONFIG,
  FAQ_CATEGORY_LABELS,
  OFFICIAL_WHATSAPP_NUMBER,
  WhatsappBotConfig,
} from "../types/crm";

interface WhatsappBotSettingsPanelProps {
  ownerId: string;
  updatedBy: string;
  botConfig: Omit<WhatsappBotConfig, "ownerId" | "updatedBy" | "createdAt" | "updatedAt">;
  onSaved?: () => void;
}

export const WhatsappBotSettingsPanel: React.FC<WhatsappBotSettingsPanelProps> = ({
  ownerId,
  updatedBy,
  botConfig,
  onSaved,
}) => {
  const [form, setForm] = useState(botConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  useEffect(() => {
    setForm(botConfig);
  }, [botConfig]);

  function handleAddFaq() {
    if (form.faqs.length >= BOT_FIELD_LIMITS.MAX_FAQS) {
      setStatusMsg({
        type: "error",
        text: `الحد الأقصى للأسئلة الشائعة هو ${BOT_FIELD_LIMITS.MAX_FAQS} سؤالاً.`,
      });
      return;
    }
    const newFaq: BotFaqItem = {
      id: `faq-${Date.now()}`,
      category: "general",
      question: "",
      answer: "",
      enabled: true,
    };
    setForm((prev) => ({ ...prev, faqs: [newFaq, ...prev.faqs] }));
  }

  function handleUpdateFaq(id: string, patch: Partial<BotFaqItem>) {
    setForm((prev) => ({
      ...prev,
      faqs: prev.faqs.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  function handleRemoveFaq(id: string) {
    setForm((prev) => ({
      ...prev,
      faqs: prev.faqs.filter((item) => item.id !== id),
    }));
  }

  function handleResetDefaults() {
    setForm(DEFAULT_WHATSAPP_BOT_CONFIG);
    setStatusMsg({
      type: "success",
      text: "تمت استعادة قاعدة المعرفة الافتراضية لشركة فنار. اضغط «حفظ الإعدادات» لاعتمادها.",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    setStatusMsg(null);
    try {
      await saveWhatsappBotConfig({
        ownerId,
        updatedBy,
        config: form,
      });
      setStatusMsg({
        type: "success",
        text: "تم حفظ إعدادات الروبوت وقاعدة المعرفة بنجاح وتطبيقها فوراً على ردود الواتساب.",
      });
      onSaved?.();
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "تعذر حفظ إعدادات الروبوت",
      });
    } finally {
      setIsSaving(false);
    }
  }

  const officialNumberValue = form.officialWhatsappNumber || OFFICIAL_WHATSAPP_NUMBER;
  const officialWaUrl = buildWhatsappDirectUrl(officialNumberValue);

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800"
    >
      {/* Header */}
      <div className="p-5 lg:p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-[#1B2E66] dark:text-slate-100">
            إعدادات روبوت الواتساب الذكي وقاعدة المعرفة
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            تخصيص رقم الواتساب الرسمي، بيانات المنتجات والخدمات وأوقات العمل، والأسئلة الشائعة، وقواعد التحويل التلقائي
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الافتراضي</span>
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#961B5E] text-white text-xs font-semibold hover:bg-[#7A144B] disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? "جاري الحفظ..." : "حفظ الإعدادات"}</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`px-6 py-3 text-xs ${
            statusMsg.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Section 1: Identity, Official Number, Tone & Escalation */}
      <div className="p-5 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-1.5">
          <h4 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
            01. شخصية الروبوت والرقم الرسمي
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            ضبط اسم المساعد، رقم الواتساب الرسمي لشركة فنار، نبرة الحديث، وإجراء التحويل التلقائي لموظفي خدمة العملاء.
          </p>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                اسم الروبوت
              </label>
              <input
                type="text"
                required
                maxLength={BOT_FIELD_LIMITS.BOT_NAME_MAX}
                value={form.botName}
                onChange={(e) => setForm((p) => ({ ...p, botName: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-[#0D74B8]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  رقم الواتساب الرسمي للشركة
                </label>
                <a
                  href={officialWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0D74B8] dark:text-sky-400 hover:underline whitespace-nowrap"
                >
                  <span>فتح wa.me</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <input
                type="text"
                dir="ltr"
                required
                minLength={5}
                maxLength={BOT_FIELD_LIMITS.OFFICIAL_WHATSAPP_MAX}
                value={officialNumberValue}
                onChange={(e) =>
                  setForm((p) => ({ ...p, officialWhatsappNumber: e.target.value }))
                }
                placeholder={OFFICIAL_WHATSAPP_NUMBER}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums text-left bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-[#0D74B8]"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums truncate">
                {officialWaUrl}
              </p>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.autoEscalateComplex}
                onChange={(e) =>
                  setForm((p) => ({ ...p, autoEscalateComplex: e.target.checked }))
                }
                className="rounded border-slate-300 dark:border-slate-600 text-[#961B5E]"
              />
              <span>تفعيل التحويل التلقائي للموظف عند تعذر الإجابة أو تعقيد الشكوى</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              الرسالة الترحيبية المرجعية
            </label>
            <textarea
              rows={2}
              required
              maxLength={BOT_FIELD_LIMITS.WELCOME_MAX}
              value={form.welcomeMessage}
              onChange={(e) => setForm((p) => ({ ...p, welcomeMessage: e.target.value }))}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-[#0D74B8]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                تعليمات الأسلوب ونبرة الرد
              </label>
              <textarea
                rows={3}
                required
                maxLength={BOT_FIELD_LIMITS.TONE_MAX}
                value={form.toneInstruction}
                onChange={(e) => setForm((p) => ({ ...p, toneInstruction: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-[#0D74B8]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                رسالة إشعار العميل عند التحويل التلقائي
              </label>
              <textarea
                rows={3}
                required
                maxLength={BOT_FIELD_LIMITS.ESCALATION_MSG_MAX}
                value={form.escalationMessage}
                onChange={(e) => setForm((p) => ({ ...p, escalationMessage: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-[#0D74B8]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Knowledge Base (Products, Services, Hours, Branches) */}
      <div className="p-5 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-1.5">
          <h4 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
            02. قاعدة المعرفة (المنتجات والخدمات والأوقات)
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            يعتمد المساعد الذكي على هذه البيانات كمصدر رسمي وحيد للإجابة على استفسارات العملاء عبر واتساب.
          </p>
        </div>

        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              المنتجات وأنواع الوقود
            </label>
            <textarea
              rows={5}
              required
              maxLength={BOT_FIELD_LIMITS.PRODUCTS_MAX}
              value={form.productsInfo}
              onChange={(e) => setForm((p) => ({ ...p, productsInfo: e.target.value }))}
              className="w-full px-3 py-2 text-xs leading-relaxed bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-[#0D74B8]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              الخدمات المساندة ووسائل الدفع
            </label>
            <textarea
              rows={5}
              required
              maxLength={BOT_FIELD_LIMITS.SERVICES_MAX}
              value={form.servicesInfo}
              onChange={(e) => setForm((p) => ({ ...p, servicesInfo: e.target.value }))}
              className="w-full px-3 py-2 text-xs leading-relaxed bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-[#0D74B8]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              أوقات العمل والدوام الرسمي
            </label>
            <textarea
              rows={4}
              required
              maxLength={BOT_FIELD_LIMITS.HOURS_MAX}
              value={form.workingHoursSummary}
              onChange={(e) => setForm((p) => ({ ...p, workingHoursSummary: e.target.value }))}
              className="w-full px-3 py-2 text-xs leading-relaxed bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-[#0D74B8]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              فروع محطات فنار المعتمدة
            </label>
            <textarea
              rows={4}
              required
              maxLength={BOT_FIELD_LIMITS.BRANCHES_MAX}
              value={form.branchesInfo}
              onChange={(e) => setForm((p) => ({ ...p, branchesInfo: e.target.value }))}
              className="w-full px-3 py-2 text-xs leading-relaxed bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-[#0D74B8]"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Editable FAQs */}
      <div className="p-5 lg:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
              03. بنك الأسئلة الشائعة ({form.faqs.length}/{BOT_FIELD_LIMITS.MAX_FAQS})
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              أسئلة وإجابات محددة يتطابق معها الروبوت مباشرة عند استفسار العميل.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddFaq}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1B2E66]/25 dark:border-slate-700 text-[#1B2E66] dark:text-sky-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة سؤال شائع</span>
          </button>
        </div>

        {form.faqs.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
            لا توجد أسئلة شائعة مضافة حالياً. اضغط «إضافة سؤال شائع» لإدخال سؤال وجواب معتمد.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {form.faqs.map((faq, idx) => (
              <div key={faq.id} className="p-4 bg-white dark:bg-slate-900 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono tabular-nums font-semibold text-[#1B2E66] dark:text-sky-300">
                      #{idx + 1}
                    </span>
                    <select
                      value={faq.category}
                      onChange={(e) =>
                        handleUpdateFaq(faq.id, { category: e.target.value as BotFaqCategory })
                      }
                      className="px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                    >
                      {Object.entries(FAQ_CATEGORY_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={faq.enabled}
                        onChange={(e) => handleUpdateFaq(faq.id, { enabled: e.target.checked })}
                        className="rounded border-slate-300 dark:border-slate-600 text-[#0D74B8]"
                      />
                      <span>مفعّل</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveFaq(faq.id)}
                    className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    maxLength={BOT_FIELD_LIMITS.FAQ_QUESTION_MAX}
                    value={faq.question}
                    onChange={(e) => handleUpdateFaq(faq.id, { question: e.target.value })}
                    placeholder="نص السؤال المتوقع من العميل..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-[#0D74B8]"
                  />
                  <textarea
                    rows={2}
                    required
                    maxLength={BOT_FIELD_LIMITS.FAQ_ANSWER_MAX}
                    value={faq.answer}
                    onChange={(e) => handleUpdateFaq(faq.id, { answer: e.target.value })}
                    placeholder="الإجابة الرسمية المعتمدة..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:border-[#0D74B8]"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </form>
  );
};
