import React, { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneOff,
  Send,
  Volume2,
} from "lucide-react";
import {
  createCallLogRecord,
  createComplaintWithNotification,
} from "../lib/crmService";
import {
  CallLog,
  Complaint,
  ComplaintCategory,
  ComplaintPriority,
  Conversation,
  Customer,
  FANAR_BRANCHES,
  formatArabicDate,
} from "../types/crm";

interface CallCenterViewProps {
  ownerId: string;
  agentName: string;
  callLogs: CallLog[];
  customers: Customer[];
  conversations: Conversation[];
  complaints: Complaint[];
  onOpenComplaintByCode: (code: string) => void;
}

interface CallTurn {
  role: "caller" | "ai";
  text: string;
}

const CALL_SCENARIOS = [
  {
    label: "اتصال مشكلة مضخة",
    name: "خالد بن محمد العتيبي",
    phone: "+966558123456",
    speech:
      "السلام عليكم، أنا حالياً في محطة السلطان بوادي الدواسر (ST-002) عند مضخة رقم 5، دفعت بالشبكة ومضخة الوقود ما اشتغلت والمبلغ انخصم.",
  },
  {
    label: "اتصال بطاقة أساطيل",
    name: "مؤسسة الأفق للنقل",
    phone: "+966501122334",
    speech:
      "أهلاً، سائق الشاحنة في محطة المحمدية بجيزان (ST-019) يواجه رفض في بطاقة الوقود رغم سريان العقد، نحتاج حل عاجل.",
  },
];

export const CallCenterView: React.FC<CallCenterViewProps> = ({
  ownerId,
  callLogs,
  customers,
  conversations,
  onOpenComplaintByCode,
}) => {
  const [callerName, setCallerName] = useState("عبدالرحمن السبيعي");
  const [callerPhone, setCallerPhone] = useState("+966559001122");
  const [isCallActive, setIsCallActive] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [turns, setTurns] = useState<CallTurn[]>([]);
  const [callerInput, setCallerInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [generatedTicketCode, setGeneratedTicketCode] = useState("");
  const [detectedBranch, setDetectedBranch] = useState(FANAR_BRANCHES[0]);
  const [callSummary, setCallSummary] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<CallLog | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<unknown>(null);

  useEffect(() => {
    if (!isCallActive) return;
    const timer = window.setInterval(() => {
      setCallSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isCallActive]);

  function formatDuration(sec: number): string {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  }

  async function playAiVoice(text: string) {
    setIsSpeaking(true);
    try {
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
          audioRef.current = audio;
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => setIsSpeaking(false);
          await audio.play();
          return;
        }
      }
      // Fallback to browser SpeechSynthesis if available
      if ("speechSynthesis" in window) {
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = "ar-SA";
        utter.onend = () => setIsSpeaking(false);
        utter.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utter);
      } else {
        setIsSpeaking(false);
      }
    } catch {
      setIsSpeaking(false);
    }
  }

  async function startIncomingCall(preset?: (typeof CALL_SCENARIOS)[number]) {
    const name = preset ? preset.name : callerName.trim() || "متصل فنار";
    const phone = preset ? preset.phone : callerPhone.trim() || "+966500000000";
    if (preset) {
      setCallerName(preset.name);
      setCallerPhone(preset.phone);
    }

    setErrorMsg(null);
    setGeneratedTicketCode("");
    setCallSummary("");
    setCallSeconds(0);
    setIsCallActive(true);

    const greeting = `أهلاً بكم في خدمة عملاء شركة فنار الطاقة للوقود، كيف يمكنني خدمتكم اليوم؟`;
    setTurns([{ role: "ai", text: greeting }]);
    await playAiVoice(greeting);

    if (preset) {
      await handleSendCallerSpeech(preset.speech, [{ role: "ai", text: greeting }], name, phone);
    }
  }

  async function handleSendCallerSpeech(
    speechText: string,
    overrideHistory?: CallTurn[],
    overrideName?: string,
    overridePhone?: string
  ) {
    const cleanSpeech = speechText.trim();
    if (!cleanSpeech || isProcessing) return;

    setErrorMsg(null);
    const currentTurns = overrideHistory || turns;
    const updatedTurns: CallTurn[] = [...currentTurns, { role: "caller", text: cleanSpeech }];
    setTurns(updatedTurns);
    setCallerInput("");
    setIsProcessing(true);

    try {
      const res = await fetch("/api/ai/call-respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callerName: overrideName || callerName,
          callerPhone: overridePhone || callerPhone,
          history: currentTurns,
          callerSpeech: cleanSpeech,
          existingTicketCode: generatedTicketCode,
          branches: FANAR_BRANCHES,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "تعذر رد النظام الهاتفي الذكي");
      }

      let finalReply = data.spokenReply || "تم استلام ملاحظتكم وجارٍ المتابعة.";
      let activeCode = generatedTicketCode;

      if (data.callSummary) {
        setCallSummary(data.callSummary);
      }

      if (data.shouldCreateComplaint && !activeCode && data.extractedComplaint) {
        const ext = data.extractedComplaint;
        const validCategory: ComplaintCategory = [
          "fuel_quality",
          "billing_pump",
          "cleanliness_facilities",
          "staff_service",
          "fleet_cards",
          "other",
        ].includes(ext.category)
          ? ext.category
          : "other";

        const validPriority: ComplaintPriority = ["normal", "high", "urgent"].includes(
          ext.priority
        )
          ? ext.priority
          : "normal";

        const branchName = ext.branch || FANAR_BRANCHES[0];
        setDetectedBranch(branchName);

        const created = await createComplaintWithNotification({
          ownerId,
          agentName: "الرد الهاتفي الذكي - فنار",
          customerName: overrideName || callerName,
          customerPhone: overridePhone || callerPhone,
          branch: branchName,
          pumpNumber: ext.pumpNumber || "غير محدد",
          category: validCategory,
          channel: "phone",
          priority: validPriority,
          status: "new",
          description: ext.description || cleanSpeech,
          aiSummary: ext.summary || data.callSummary || cleanSpeech,
          existingCustomers: customers,
          existingConversations: conversations,
          sendWhatsappCode: true,
        });

        activeCode = created.ticketCode;
        setGeneratedTicketCode(created.ticketCode);
        finalReply = `${finalReply} رمز شكواكم الرسمي هو ${created.ticketCode} وقد أُرسل الآن إلى الواتساب الخاص بكم.`;
      }

      setTurns((prev) => [...prev, { role: "ai", text: finalReply }]);
      await playAiVoice(finalReply);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "خطأ أثناء الاتصال");
    } finally {
      setIsProcessing(false);
    }
  }

  async function endAndSaveCall() {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsListeningMic(false);
    setIsCallActive(false);

    const transcript = turns
      .map((t) => `${t.role === "caller" ? "المتصل" : "نظام فنار الآلي"}: ${t.text}`)
      .join("\n");

    if (transcript) {
      await createCallLogRecord({
        callerName: callerName.trim() || "متصل",
        callerPhone: callerPhone.trim() || "+966500000000",
        branch: detectedBranch,
        durationSeconds: Math.max(callSeconds, 12),
        handledBy: "ai_ivr",
        transcript,
        aiSummary: callSummary || "مكالمة خدمة عملاء عبر الرد الآلي الذكي",
        linkedTicketCode: generatedTicketCode,
        codeSentViaWhatsapp: Boolean(generatedTicketCode),
        ownerId,
      });
    }
  }

  function toggleMicInput() {
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (!SpeechRec) {
      setErrorMsg("المتصفح الحالي لا يدعم تحويل الصوت المباشر، يمكنك كتابة حديث المتصل مباشرة.");
      return;
    }

    if (isListeningMic && recognitionRef.current) {
      (recognitionRef.current as { stop: () => void }).stop();
      setIsListeningMic(false);
      return;
    }

    const recognition = new SpeechRec() as {
      lang: string;
      interimResults: boolean;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
    };
    recognition.lang = "ar-SA";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      if (transcript) {
        setCallerInput(transcript);
        handleSendCallerSpeech(transcript);
      }
    };
    recognition.onerror = () => setIsListeningMic(false);
    recognition.onend = () => setIsListeningMic(false);
    recognitionRef.current = recognition;
    setIsListeningMic(true);
    recognition.start();
  }

  return (
    <div className="space-y-6">
      {/* Live AI Call Console */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Call Controls & Presets */}
        <div className="lg:col-span-5 p-6 border-b lg:border-b-0 lg:border-l border-slate-200 dark:border-slate-800 space-y-5">
          <div>
            <h2 className="text-base font-bold text-[#1B2E66] dark:text-slate-100">
              منظومة الرد الهاتفي الذكي (AI Call Center)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              يستقبل النظام المكالمات الواردة، يرد صوتياً بالذكاء الاصطناعي، يسجل الشكوى
              آلياً، ويرسل رمز الشكوى إلى واتساب المتصل فوراً.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                اسم المتصل
              </label>
              <input
                type="text"
                disabled={isCallActive}
                value={callerName}
                onChange={(e) => setCallerName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg disabled:bg-slate-50 dark:disabled:bg-slate-800/60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                رقم الجوال (لإرسال رمز الشكوى عبر الواتساب)
              </label>
              <input
                type="text"
                disabled={isCallActive}
                value={callerPhone}
                onChange={(e) => setCallerPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg disabled:bg-slate-50 dark:disabled:bg-slate-800/60"
              />
            </div>
          </div>

          {!isCallActive ? (
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => startIncomingCall()}
                className="w-full py-2.5 px-4 rounded-lg bg-[#961B5E] hover:bg-[#7A144B] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                <PhoneCall className="w-4 h-4" />
                <span>استقبال مكالمة واردة وتشغيل الرد الآلي</span>
              </button>

              <div className="space-y-1.5">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  أو تجربة سيناريو مكالمة جاهز:
                </p>
                <div className="flex flex-wrap gap-2">
                  {CALL_SCENARIOS.map((sc) => (
                    <button
                      key={sc.label}
                      type="button"
                      onClick={() => startIncomingCall(sc)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs text-[#1B2E66] dark:text-slate-100 font-medium transition-colors"
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#1B2E66] text-white space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold">مكالمة نشطة مع النظام الآلي</span>
                </div>
                <span className="font-mono text-sm tabular-nums">{formatDuration(callSeconds)}</span>
              </div>

              {isSpeaking && (
                <div className="flex items-center gap-2 text-xs text-sky-200">
                  <Volume2 className="w-4 h-4" />
                  <span>نظام فنار الصوتي يتحدث الآن...</span>
                </div>
              )}

              {generatedTicketCode && (
                <div className="p-3 rounded-lg bg-white/10 border border-white/15 flex items-center justify-between text-xs">
                  <span>تم تسجيل الشكوى وإرسال الرمز للواتساب:</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {generatedTicketCode}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={endAndSaveCall}
                className="w-full py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                <PhoneOff className="w-4 h-4" />
                <span>إنهاء المكالمة وحفظ السجل</span>
              </button>
            </div>
          )}
        </div>

        {/* Live Transcript & Speech Input */}
        <div className="lg:col-span-7 flex flex-col bg-[#F5F7FA] dark:bg-slate-950">
          <div className="px-5 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-[#1B2E66] dark:text-slate-100">
              التفريغ النصي المباشر للمكالمة
            </span>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Webhook: POST /api/webhooks/calls
            </span>
          </div>

          <div className="flex-1 p-5 space-y-3 overflow-y-auto min-h-[260px] max-h-[340px]">
            {turns.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 text-center">
                اضغط على "استقبال مكالمة واردة" لبدء التفاعل الصوتي والنصي مع نظام الرد الآلي.
              </div>
            ) : (
              turns.map((turn, idx) => (
                <div
                  key={idx}
                  className={`flex ${turn.role === "caller" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-2.5 text-xs leading-relaxed border ${
                      turn.role === "caller"
                        ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                        : "bg-[#1B2E66] border-[#1B2E66] text-white"
                    }`}
                  >
                    <span
                      className={`block text-[10px] font-semibold mb-1 ${
                        turn.role === "caller"
                          ? "text-[#961B5E] dark:text-pink-400"
                          : "text-sky-200"
                      }`}
                    >
                      {turn.role === "caller" ? callerName : "نظام الرد الآلي - فنار"}
                    </span>
                    {turn.text}
                  </div>
                </div>
              ))
            )}
            {isProcessing && (
              <div className="flex justify-end">
                <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-[#0D74B8] dark:text-sky-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري تحليل المكالمة وتوليد الرد الصوتي...</span>
                </span>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="mx-5 mb-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendCallerSpeech(callerInput);
            }}
            className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
          >
            <button
              type="button"
              disabled={!isCallActive || isProcessing}
              onClick={toggleMicInput}
              title="التحدث بالميكروفون"
              className={`p-2.5 rounded-lg border transition-colors ${
                isListeningMic
                  ? "bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              } disabled:opacity-40`}
            >
              {isListeningMic ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <input
              type="text"
              disabled={!isCallActive || isProcessing}
              value={callerInput}
              onChange={(e) => setCallerInput(e.target.value)}
              placeholder={
                isCallActive
                  ? "تحدث بالميكروفون أو اكتب كلام المتصل هنا..."
                  : "ابدأ مكالمة أولاً لإدخال حديث المتصل"
              }
              className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg disabled:bg-slate-50 dark:disabled:bg-slate-800/60"
            />
            <button
              type="submit"
              disabled={!isCallActive || isProcessing || !callerInput.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B2E66] dark:bg-[#0D74B8] text-white text-xs font-medium hover:bg-[#12204A] dark:hover:bg-[#0A5D94] disabled:opacity-50 whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              <span>إرسال للنظام</span>
            </button>
          </form>
        </div>
      </div>

      {/* Call Logs Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
              سجل الاتصالات الواردة والرد الآلي
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              توثيق كافة المكالمات ورموز الشكاوى المرسلة للعملاء
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            {callLogs.length} مكالمة
          </span>
        </div>

        {callLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            لا توجد مكالمات مسجلة بعد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <th className="py-3 px-4">المتصل</th>
                  <th className="py-3 px-4">المحطة</th>
                  <th className="py-3 px-4">المدة</th>
                  <th className="py-3 px-4">معالجة بواسطة</th>
                  <th className="py-3 px-4">رمز الشكوى</th>
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">التفريغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {callLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {log.callerName}
                      </div>
                      <div className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                        {log.callerPhone}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                      {log.branch}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatDuration(log.durationSeconds)}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#0D74B8] dark:text-sky-400 font-medium">
                      {log.handledBy === "ai_ivr" ? "رد آلي ذكي AI" : "موظف"}
                    </td>
                    <td className="py-3 px-4">
                      {log.linkedTicketCode ? (
                        <button
                          type="button"
                          onClick={() => onOpenComplaintByCode(log.linkedTicketCode)}
                          className="font-mono text-xs font-semibold text-[#961B5E] dark:text-pink-400 hover:underline tabular-nums"
                        >
                          {log.linkedTicketCode}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {formatArabicDate(log.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="text-xs text-[#1B2E66] dark:text-sky-300 font-medium hover:underline"
                      >
                        عرض النص
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transcript Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
                  نص المكالمة — {selectedLog.callerName}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                  {selectedLog.callerPhone} · {formatArabicDate(selectedLog.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                إغلاق
              </button>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed max-h-72 overflow-y-auto">
              {selectedLog.transcript}
            </div>
            {selectedLog.aiSummary && (
              <p className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-[#1B2E66] dark:text-slate-100">
                  ملخص النظام:{" "}
                </span>
                {selectedLog.aiSummary}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
