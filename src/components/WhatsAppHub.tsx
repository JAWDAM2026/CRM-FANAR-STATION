import React, { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  ArrowUpLeft,
  Bot,
  CheckCheck,
  ExternalLink,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Send,
  SlidersHorizontal,
  UserCheck,
  Wifi,
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import {
  addWhatsappMessage,
  buildWhatsappTicketMessage,
  createComplaintWithNotification,
  createWhatsappConversationOnly,
  escalateConversationToAgent,
  toggleConversationAiMode,
} from "../lib/crmService";
import {
  BotIntent,
  buildWhatsappDirectUrl,
  Complaint,
  ComplaintCategory,
  ComplaintPriority,
  Conversation,
  Customer,
  ESCALATION_RULE_LABELS,
  EscalationRuleKey,
  FANAR_BRANCHES,
  formatArabicDate,
  HANDOFF_STATUS_LABELS,
  INTENT_LABELS,
  OFFICIAL_WHATSAPP_NUMBER,
  PRIORITY_LABELS,
  STATUS_LABELS,
  WhatsappBotConfig,
  WhatsappMessage,
} from "../types/crm";
import { WhatsappBotSettingsPanel } from "./WhatsappBotSettingsPanel";

interface WhatsAppHubProps {
  ownerId: string;
  agentName: string;
  isManager: boolean;
  conversations: Conversation[];
  customers: Customer[];
  complaints: Complaint[];
  botConfig: Omit<WhatsappBotConfig, "ownerId" | "updatedBy" | "createdAt" | "updatedAt">;
  requestedConversationId?: string | null;
  onConsumeRequestedConversation?: () => void;
  onOpenComplaint: (complaint: Complaint) => void;
}

type HubSection = "chats" | "bot_settings";
type ConvFilter = "all" | "bot" | "escalated";

const PRESET_SIMULATIONS = [
  {
    label: "استفسار منتجات وخدمات",
    text: "السلام عليكم، ما هي أنواع الوقود المتوفرة في محطات فنار وهل يتوفر لديكم غسيل سيارات؟",
  },
  {
    label: "استفسار أوقات العمل والمحطات",
    text: "مساء الخير، ما هي أوقات عمل محطة السلطان بوادي الدواسر (ST-002) وهل مضخات الوقود تعمل يوم الجمعة؟",
  },
  {
    label: "استعلام عن حالة طلب",
    text: "لو سمحت أريد معرفة حالة الشكوى رقم FNR-2611-4018 وماذا تم فيها؟",
  },
  {
    label: "شكوى معقدة (تحويل تلقائي)",
    text: "عبيت بنزين 95 أمس وتوقفت السيارة تماماً واحتجت سطحة، أريد تعويضاً مالياً فورياً أو التحدث مع مسؤول خدمة العملاء الآن!",
  },
];

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, "").replace(/^\+/, "");
}

function findMatchingCustomerOrders(
  complaints: Complaint[],
  customerPhone: string,
  linkedTicketCode: string,
  incomingText: string
) {
  const codeMatches: string[] =
    incomingText.toUpperCase().match(/FNR-[0-9A-Z-]+/g) ?? [];
  const normPhone = normalizePhone(customerPhone);

  const matched = complaints.filter((c) => {
    const phoneMatch = normPhone && normalizePhone(c.customerPhone) === normPhone;
    const linkedMatch = linkedTicketCode && c.ticketCode === linkedTicketCode;
    const mentionedMatch = codeMatches.includes(c.ticketCode.toUpperCase());
    return phoneMatch || linkedMatch || mentionedMatch;
  });

  return matched.map((c) => ({
    ticketCode: c.ticketCode,
    statusLabel: STATUS_LABELS[c.status],
    branch: c.branch,
    priorityLabel: PRIORITY_LABELS[c.priority],
    aiSummary: c.aiSummary,
    closureReason: c.closureReason,
    managerNotes: c.managerNotes,
    createdAtLabel: formatArabicDate(c.createdAt),
  }));
}

export const WhatsAppHub: React.FC<WhatsAppHubProps> = ({
  ownerId,
  agentName,
  isManager,
  conversations,
  customers,
  complaints,
  botConfig,
  requestedConversationId,
  onConsumeRequestedConversation,
  onOpenComplaint,
}) => {
  const [hubSection, setHubSection] = useState<HubSection>("chats");
  const [convFilter, setConvFilter] = useState<ConvFilter>("all");
  const [selectedConvId, setSelectedConvId] = useState<string>("");
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [customerSimText, setCustomerSimText] = useState("");
  const [agentReplyText, setAgentReplyText] = useState("");
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const officialWhatsappNumber =
    botConfig.officialWhatsappNumber || OFFICIAL_WHATSAPP_NUMBER;
  const officialWhatsappUrl = buildWhatsappDirectUrl(officialWhatsappNumber);

  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [newChatPhone, setNewChatPhone] = useState(officialWhatsappNumber);
  const [newChatFirstMsg, setNewChatFirstMsg] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const agentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (requestedConversationId) {
      const exists = conversations.some((c) => c.id === requestedConversationId);
      if (exists) {
        setHubSection("chats");
        setConvFilter("all");
        setSelectedConvId(requestedConversationId);
        onConsumeRequestedConversation?.();
      }
    }
  }, [requestedConversationId, conversations, onConsumeRequestedConversation]);

  useEffect(() => {
    if (!selectedConvId && conversations.length > 0) {
      setSelectedConvId(conversations[0].id);
    }
  }, [conversations, selectedConvId]);

  const activeConv = conversations.find((c) => c.id === selectedConvId) || null;
  const linkedComplaint = activeConv?.linkedTicketCode
    ? complaints.find((c) => c.ticketCode === activeConv.linkedTicketCode) || null
    : null;

  const customerAllComplaints = activeConv
    ? complaints.filter(
        (c) =>
          c.customerId === activeConv.customerId ||
          normalizePhone(c.customerPhone) === normalizePhone(activeConv.customerPhone)
      )
    : [];

  const escalatedCount = conversations.filter(
    (c) => c.handoffStatus === "escalated_to_agent" || !c.aiAutoReplyEnabled
  ).length;
  const botActiveCount = conversations.filter((c) => c.aiAutoReplyEnabled).length;

  useEffect(() => {
    if (!activeConv) {
      setMessages([]);
      return;
    }

    const path = `conversations/${activeConv.id}/messages`;
    const q = isManager
      ? query(collection(db, path), orderBy("createdAt", "asc"))
      : query(collection(db, path), where("ownerId", "==", ownerId));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: WhatsappMessage[] = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<WhatsappMessage, "id">),
          }))
          .sort(
            (a, b) =>
              (a.createdAt?.toMillis() ?? Date.now()) -
              (b.createdAt?.toMillis() ?? Date.now())
          );
        setMessages(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );

    return () => unsub();
  }, [activeConv?.id, isManager, ownerId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const filteredConversations = conversations.filter((c) => {
    const isEscalated =
      c.handoffStatus === "escalated_to_agent" ||
      c.handoffStatus === "agent_handling" ||
      !c.aiAutoReplyEnabled;

    if (convFilter === "bot" && isEscalated) return false;
    if (convFilter === "escalated" && !isEscalated) return false;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.customerName.toLowerCase().includes(q) ||
      c.customerPhone.toLowerCase().includes(q) ||
      c.linkedTicketCode.toLowerCase().includes(q) ||
      (c.handoffReason || "").toLowerCase().includes(q)
    );
  });

  async function processIncomingWhatsappMessage(
    conv: Conversation,
    incomingText: string,
    existingHistory: WhatsappMessage[]
  ) {
    setAiError(null);
    await addWhatsappMessage({
      conversationId: conv.id,
      sender: "customer",
      senderName: conv.customerName,
      body: incomingText,
      messageType: "text",
      ticketCode: conv.linkedTicketCode || "",
      ownerId,
      unreadDelta: conv.aiAutoReplyEnabled ? 0 : 1,
    });

    if (!conv.aiAutoReplyEnabled) {
      return;
    }

    setIsAiProcessing(true);
    try {
      const customerOrders = findMatchingCustomerOrders(
        complaints,
        conv.customerPhone,
        conv.linkedTicketCode,
        incomingText
      );

      const response = await fetch("/api/ai/whatsapp-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: conv.customerName,
          customerPhone: conv.customerPhone,
          history: existingHistory.map((m) => ({ sender: m.sender, body: m.body })),
          incomingMessage: incomingText,
          existingTicketCode: conv.linkedTicketCode || "",
          branches: FANAR_BRANCHES,
          botConfig,
          customerOrders,
          consecutiveFailures: conv.consecutiveAiFailures || 0,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "تعذر استجابة الذكاء الاصطناعي");
      }

      const detectedIntent: BotIntent = [
        "greeting",
        "faq",
        "order_status",
        "complaint",
        "escalation",
      ].includes(data.intent)
        ? data.intent
        : "unknown";

      const validRules: EscalationRuleKey[] = [
        "none",
        "explicit_request",
        "missing_knowledge",
        "sensitive_case",
        "repeated_failure",
        "angry_or_reopen",
      ];
      let detectedRule: EscalationRuleKey = validRules.includes(data.escalationRule)
        ? data.escalationRule
        : "none";

      const prevFailures = conv.consecutiveAiFailures || 0;
      const nextFailures = data.confidence === "low" ? prevFailures + 1 : 0;

      const shouldAutoEscalate =
        Boolean(data.shouldEscalate) ||
        (botConfig.autoEscalateComplex && data.confidence === "low") ||
        nextFailures >= 2;

      if (shouldAutoEscalate && detectedRule === "none") {
        detectedRule = nextFailures >= 2 ? "repeated_failure" : "missing_knowledge";
      }

      if (data.reply) {
        await addWhatsappMessage({
          conversationId: conv.id,
          sender: "ai",
          senderName: botConfig.botName || "مساعد فنار الذكي",
          body: data.reply,
          messageType: "text",
          ticketCode: conv.linkedTicketCode || "",
          ownerId,
          lastIntent: detectedIntent,
          consecutiveAiFailures: shouldAutoEscalate ? 0 : nextFailures,
        });
      }

      let createdTicketCode = conv.linkedTicketCode || "";

      if (data.shouldCreateComplaint && data.extractedComplaint) {
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

        const created = await createComplaintWithNotification({
          ownerId,
          agentName: data.needsManagerEscalation
            ? `${agentName} (تصعيد للمدير)`
            : botConfig.botName || "مساعد فنار الذكي",
          customerId: conv.customerId,
          customerName: conv.customerName,
          customerPhone: conv.customerPhone,
          branch: ext.branch || FANAR_BRANCHES[0],
          pumpNumber: ext.pumpNumber || "غير محدد",
          category: validCategory,
          channel: "whatsapp",
          priority: validPriority,
          slaTier:
            validPriority === "urgent"
              ? "P1"
              : validPriority === "high"
              ? "P2"
              : "P3",
          status: data.needsManagerEscalation ? "pending_manager" : "new",
          description: ext.description || incomingText,
          aiSummary: ext.summary || incomingText,
          existingConversationId: conv.id,
          existingCustomers: customers,
          existingConversations: conversations,
          sendWhatsappCode: true,
        });
        createdTicketCode = created.ticketCode;
      }

      if (shouldAutoEscalate) {
        const reason =
          (data.escalationReason || "").trim() ||
          ESCALATION_RULE_LABELS[detectedRule] ||
          "يتطلب تدخل موظف خدمة العملاء";

        await escalateConversationToAgent({
          conversationId: conv.id,
          ownerId,
          reason,
          rule: detectedRule,
          handoffSummary: (data.handoffSummary || "").trim(),
          intent: detectedIntent,
          ticketCode: createdTicketCode,
        });
      } else {
        await updateDoc(doc(db, "conversations", conv.id), {
          lastIntent: detectedIntent,
          handoffStatus: "bot_active",
          escalationRule: "none",
          consecutiveAiFailures: nextFailures,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "تعذر معالجة الرد الآلي");
    } finally {
      setIsAiProcessing(false);
    }
  }

  async function handleSimulateCustomerSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeConv || !customerSimText.trim() || isAiProcessing) return;
    const text = customerSimText.trim();
    setCustomerSimText("");
    await processIncomingWhatsappMessage(activeConv, text, messages);
  }

  async function handleAgentReplySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeConv || !agentReplyText.trim()) return;
    const text = agentReplyText.trim();
    setAgentReplyText("");
    await addWhatsappMessage({
      conversationId: activeConv.id,
      sender: "agent",
      senderName: agentName,
      body: text,
      messageType: "text",
      ticketCode: activeConv.linkedTicketCode || "",
      ownerId,
      unreadDelta: 0,
      handoffStatus: "agent_handling",
    });
  }

  async function handleStartNewWhatsappChat(e: React.FormEvent) {
    e.preventDefault();
    if (!newChatName.trim() || !newChatPhone.trim() || !newChatFirstMsg.trim()) return;
    setIsAiProcessing(true);
    setAiError(null);
    try {
      const firstMsg = newChatFirstMsg.trim();
      const customerOrders = findMatchingCustomerOrders(
        complaints,
        newChatPhone.trim(),
        "",
        firstMsg
      );

      const response = await fetch("/api/ai/whatsapp-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: newChatName.trim(),
          customerPhone: newChatPhone.trim(),
          history: [],
          incomingMessage: firstMsg,
          branches: FANAR_BRANCHES,
          botConfig,
          customerOrders,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "تعذر تشغيل الذكاء الاصطناعي للمحادثة الجديدة");
      }

      const detectedIntent: BotIntent = [
        "greeting",
        "faq",
        "order_status",
        "complaint",
        "escalation",
      ].includes(data.intent)
        ? data.intent
        : "unknown";

      const validRules: EscalationRuleKey[] = [
        "none",
        "explicit_request",
        "missing_knowledge",
        "sensitive_case",
        "repeated_failure",
        "angry_or_reopen",
      ];
      let detectedRule: EscalationRuleKey = validRules.includes(data.escalationRule)
        ? data.escalationRule
        : "none";

      const shouldAutoEscalate =
        Boolean(data.shouldEscalate) ||
        (botConfig.autoEscalateComplex && data.confidence === "low");

      if (shouldAutoEscalate && detectedRule === "none") {
        detectedRule = "missing_knowledge";
      }

      let targetConvId = "";

      if (data.shouldCreateComplaint && data.extractedComplaint) {
        const ext = data.extractedComplaint;
        const result = await createComplaintWithNotification({
          ownerId,
          agentName: botConfig.botName || "مساعد فنار الذكي",
          customerName: newChatName.trim(),
          customerPhone: newChatPhone.trim(),
          branch: ext.branch || FANAR_BRANCHES[0],
          pumpNumber: ext.pumpNumber || "غير محدد",
          category: ext.category || "other",
          channel: "whatsapp",
          priority: ext.priority || "normal",
          status: data.needsManagerEscalation ? "pending_manager" : "new",
          description: ext.description || firstMsg,
          aiSummary: ext.summary || firstMsg,
          existingCustomers: customers,
          existingConversations: conversations,
          sendWhatsappCode: true,
        });

        targetConvId = result.conversationId;

        await addWhatsappMessage({
          conversationId: result.conversationId,
          sender: "customer",
          senderName: newChatName.trim(),
          body: firstMsg,
          messageType: "text",
          ticketCode: result.ticketCode,
          ownerId,
        });

        if (data.reply) {
          await addWhatsappMessage({
            conversationId: result.conversationId,
            sender: "ai",
            senderName: botConfig.botName || "مساعد فنار الذكي",
            body: data.reply,
            messageType: "text",
            ticketCode: result.ticketCode,
            ownerId,
            lastIntent: detectedIntent,
          });
        }

        if (shouldAutoEscalate) {
          await escalateConversationToAgent({
            conversationId: result.conversationId,
            ownerId,
            reason:
              (data.escalationReason || "").trim() ||
              ESCALATION_RULE_LABELS[detectedRule],
            rule: detectedRule,
            handoffSummary: (data.handoffSummary || "").trim(),
            intent: detectedIntent,
            ticketCode: result.ticketCode,
          });
        }
      } else {
        const convRes = await createWhatsappConversationOnly({
          ownerId,
          customerName: newChatName.trim(),
          customerPhone: newChatPhone.trim(),
          initialMessage: firstMsg,
          botName: botConfig.botName || "مساعد فنار الذكي",
          aiReply: data.reply || "",
          intent: detectedIntent,
          escalate: shouldAutoEscalate,
          escalationReason: data.escalationReason || "",
          escalationRule: detectedRule,
          consecutiveAiFailures: !shouldAutoEscalate && data.confidence === "low" ? 1 : 0,
          existingCustomers: customers,
          existingConversations: conversations,
        });
        targetConvId = convRes.conversationId;
      }

      setSelectedConvId(targetConvId);
      setShowNewChat(false);
      setNewChatName("");
      setNewChatPhone(officialWhatsappNumber);
      setNewChatFirstMsg("");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "فشل إنشاء المحادثة");
    } finally {
      setIsAiProcessing(false);
    }
  }

  async function handleResendTicketCode() {
    if (!activeConv || !linkedComplaint) return;
    await addWhatsappMessage({
      conversationId: activeConv.id,
      sender: "agent",
      senderName: agentName,
      body: buildWhatsappTicketMessage(
        linkedComplaint.customerName,
        linkedComplaint.ticketCode,
        linkedComplaint.branch,
        linkedComplaint.aiSummary,
        officialWhatsappNumber
      ),
      messageType: "ticket_code",
      ticketCode: linkedComplaint.ticketCode,
      ownerId,
    });
  }

  async function handleTakeOverNow() {
    if (!activeConv) return;
    if (activeConv.aiAutoReplyEnabled) {
      await toggleConversationAiMode(activeConv.id, false);
    }
    agentInputRef.current?.focus();
  }

  return (
    <div className="space-y-4">
      {/* Integrated Workspace Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setHubSection("chats")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              hubSection === "chats"
                ? "bg-white dark:bg-slate-950 text-[#1B2E66] dark:text-slate-100"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>المحادثات الواردة</span>
          </button>
          <button
            type="button"
            onClick={() => setHubSection("bot_settings")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              hubSection === "bot_settings"
                ? "bg-white dark:bg-slate-950 text-[#1B2E66] dark:text-slate-100"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>إعدادات الروبوت وقاعدة المعرفة</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
          <span>
            الروبوت النشط:{" "}
            <strong className="text-[#1B2E66] dark:text-slate-100">{botConfig.botName}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            واتساب الشركة:{" "}
            <strong
              dir="ltr"
              className="font-mono tabular-nums text-[#1B2E66] dark:text-sky-300"
            >
              {officialWhatsappNumber}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            محادثات محولة للموظف:{" "}
            <strong
              className={
                escalatedCount > 0
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-slate-700 dark:text-slate-300"
              }
            >
              {escalatedCount}
            </strong>
          </span>
          <a
            href={officialWhatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <span>تواصل واتساب</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {hubSection === "bot_settings" ? (
        <WhatsappBotSettingsPanel
          ownerId={ownerId}
          updatedBy={agentName}
          botConfig={botConfig}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[680px]">
          {/* Conversations Sidebar */}
          <aside className="lg:col-span-3 border-b lg:border-b-0 lg:border-l border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
                  محادثات الواتساب
                </h2>
                <button
                  type="button"
                  onClick={() => setShowNewChat((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#961B5E] text-white text-xs font-medium hover:bg-[#7A144B] transition-colors whitespace-nowrap shrink-0"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  <span>محادثة جديدة</span>
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setConvFilter("all")}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                    convFilter === "all"
                      ? "bg-white dark:bg-slate-950 text-[#1B2E66] dark:text-slate-100"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  الكل ({conversations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setConvFilter("bot")}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                    convFilter === "bot"
                      ? "bg-white dark:bg-slate-950 text-[#1B2E66] dark:text-slate-100"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  رد آلي ({botActiveCount})
                </button>
                <button
                  type="button"
                  onClick={() => setConvFilter("escalated")}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                    convFilter === "escalated"
                      ? "bg-white dark:bg-slate-950 text-amber-800 dark:text-amber-300"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  محولة ({escalatedCount})
                </button>
              </div>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم، الجوال، أو رمز الشكوى..."
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:border-[#0D74B8]"
              />
            </div>

            {showNewChat && (
              <form
                onSubmit={handleStartNewWhatsappChat}
                className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 space-y-2.5"
              >
                <p className="text-xs font-bold text-[#1B2E66] dark:text-slate-100">
                  محاكاة رسالة واتساب من عميل جديد
                </p>
                <input
                  type="text"
                  required
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  placeholder="اسم العميل"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                />
                <input
                  type="text"
                  dir="ltr"
                  required
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  placeholder="009665XXXXXXXX"
                  className="w-full px-3 py-1.5 text-xs font-mono text-left bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                />
                <textarea
                  required
                  rows={2}
                  value={newChatFirstMsg}
                  onChange={(e) => setNewChatFirstMsg(e.target.value)}
                  placeholder="استفسار عن منتج/خدمة/أوقات عمل/حالة طلب أو شكوى..."
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewChat(false)}
                    className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isAiProcessing}
                    className="px-3 py-1.5 rounded-lg bg-[#1B2E66] dark:bg-[#0D74B8] text-white text-xs font-medium disabled:opacity-60"
                  >
                    {isAiProcessing ? "جاري المعالجة..." : "بدء وتفعيل الذكاء"}
                  </button>
                </div>
              </form>
            )}

            <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto flex-1">
              {filteredConversations.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  لا توجد محادثات مطابقة للتصفية الحالية.
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isSelected = conv.id === activeConv?.id;
                  const isEscalated =
                    conv.handoffStatus === "escalated_to_agent" || !conv.aiAutoReplyEnabled;
                  const statusLabel =
                    conv.handoffStatus === "escalated_to_agent"
                      ? "محولة للموظف"
                      : conv.handoffStatus === "agent_handling" || !conv.aiAutoReplyEnabled
                      ? "متابعة يدوية"
                      : "رد آلي AI";

                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => setSelectedConvId(conv.id)}
                      className={`w-full text-right p-4 transition-colors ${
                        isSelected
                          ? "bg-[#1B2E66]/5 dark:bg-slate-800"
                          : conv.handoffStatus === "escalated_to_agent"
                          ? "bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {conv.customerName}
                        </span>
                        <span className="text-[11px] font-mono text-[#0D74B8] dark:text-sky-400 tabular-nums shrink-0">
                          {conv.linkedTicketCode || "استفسار"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
                        {conv.lastMessage}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-2">
                        <span className="font-mono tabular-nums">{conv.customerPhone}</span>
                        <span
                          className={
                            conv.handoffStatus === "escalated_to_agent"
                              ? "font-semibold text-amber-700 dark:text-amber-400"
                              : isEscalated
                              ? "text-slate-700 dark:text-slate-300"
                              : "text-emerald-700 dark:text-emerald-400"
                          }
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Main Chat Pane */}
          <section className="lg:col-span-6 flex flex-col bg-[#F5F7FA] dark:bg-slate-950">
            {!activeConv ? (
              <div className="flex-1 flex items-center justify-center p-8 text-sm text-slate-500 dark:text-slate-400">
                اختر محادثة واتساب لعرضها أو ابدأ محادثة عميل جديدة.
              </div>
            ) : (
              <>
                {/* Conversation Header */}
                <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100">
                      {activeConv.customerName}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {activeConv.customerPhone} ·{" "}
                      {activeConv.aiAutoReplyEnabled
                        ? `الرد التلقائي (${botConfig.botName}) مفعّل`
                        : activeConv.handoffStatus === "escalated_to_agent"
                        ? "محولة تلقائياً لموظف خدمة العملاء"
                        : "تحت متابعة الموظف البشري"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      toggleConversationAiMode(activeConv.id, !activeConv.aiAutoReplyEnabled)
                    }
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                      activeConv.aiAutoReplyEnabled
                        ? "border-[#0D74B8]/30 dark:border-sky-700 bg-[#0D74B8]/5 dark:bg-sky-950/50 text-[#0D74B8] dark:text-sky-300"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                    }`}
                  >
                    {activeConv.aiAutoReplyEnabled ? (
                      <>
                        <Bot className="w-3.5 h-3.5" />
                        <span>إيقاف الرد الآلي وتولي المحادثة</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>إعادة تفعيل الرد الآلي AI</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Escalation Notice Banner */}
                {(!activeConv.aiAutoReplyEnabled ||
                  activeConv.handoffStatus === "escalated_to_agent") && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-bold text-amber-900 dark:text-amber-200">
                        {activeConv.handoffStatus === "escalated_to_agent"
                          ? "تم تحويل المحادثة تلقائياً إلى موظف خدمة العملاء"
                          : "المحادثة قيد المعالجة اليدوية من الموظف"}
                      </p>
                      {activeConv.escalationRule && activeConv.escalationRule !== "none" && (
                        <p className="text-[11px] font-semibold text-[#961B5E] dark:text-pink-400">
                          {ESCALATION_RULE_LABELS[activeConv.escalationRule]}
                        </p>
                      )}
                      {activeConv.handoffReason && (
                        <p className="text-amber-800 dark:text-amber-300 truncate">
                          السبب: {activeConv.handoffReason}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleTakeOverNow}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1B2E66] dark:bg-[#0D74B8] text-white text-[11px] font-medium hover:bg-[#12204A] dark:hover:bg-[#0A5D94] whitespace-nowrap shrink-0"
                    >
                      <ArrowUpLeft className="w-3.5 h-3.5" />
                      <span>الرد الآن</span>
                    </button>
                  </div>
                )}

                {/* Messages Timeline */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3.5 max-h-[430px]">
                  {messages.map((msg) => {
                    if (msg.messageType === "handoff_notice") {
                      return (
                        <div key={msg.id} className="flex justify-center">
                          <div className="max-w-[90%] rounded-lg px-4 py-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-xs text-center space-y-1">
                            <p className="font-bold">{msg.senderName}</p>
                            <p className="whitespace-pre-line leading-relaxed">{msg.body}</p>
                            <p className="text-[10px] text-amber-700 dark:text-amber-400 tabular-nums">
                              {formatArabicDate(msg.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    const isCustomer = msg.sender === "customer";
                    const isCodeCard = msg.messageType === "ticket_code";
                    const isClosure = msg.messageType === "closure_notice";

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[82%] rounded-xl px-4 py-3 text-sm border ${
                            isCustomer
                              ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                              : isCodeCard
                              ? "bg-[#1B2E66] border-[#1B2E66] text-white"
                              : isClosure
                              ? "bg-emerald-800 border-emerald-900 text-white"
                              : "bg-[#961B5E]/10 dark:bg-[#961B5E]/20 border-[#961B5E]/20 dark:border-[#961B5E]/40 text-slate-900 dark:text-slate-100"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4 mb-1">
                            <span
                              className={`text-[11px] font-semibold ${
                                isCodeCard || isClosure
                                  ? "text-white/80"
                                  : isCustomer
                                  ? "text-slate-500 dark:text-slate-400"
                                  : "text-[#961B5E] dark:text-pink-400"
                              }`}
                            >
                              {msg.senderName}
                            </span>
                            {msg.ticketCode && (
                              <span
                                className={`text-[11px] font-mono tabular-nums ${
                                  isCodeCard || isClosure
                                    ? "text-white/90"
                                    : "text-[#1B2E66] dark:text-sky-300"
                                }`}
                              >
                                {msg.ticketCode}
                              </span>
                            )}
                          </div>
                          <p className="whitespace-pre-line leading-relaxed text-[13px]">
                            {msg.body}
                          </p>
                          <div
                            className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${
                              isCodeCard || isClosure
                                ? "text-white/70"
                                : "text-slate-400 dark:text-slate-500"
                            }`}
                          >
                            <span className="tabular-nums">
                              {formatArabicDate(msg.createdAt)}
                            </span>
                            {!isCustomer && <CheckCheck className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {isAiProcessing && (
                    <div className="flex justify-end">
                      <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-[#0D74B8] dark:text-sky-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{botConfig.botName} يحلل الرسالة ويراجع قاعدة المعرفة والطلبات...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {aiError && (
                  <div className="mx-5 mb-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                    {aiError}
                  </div>
                )}

                {/* Dual Input Area: Incoming Customer Simulator + Agent Manual Reply */}
                <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 space-y-3">
                  {/* Quick Customer Simulation */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5">
                        <Wifi className="w-3.5 h-3.5 text-[#0D74B8] dark:text-sky-400" />
                        <span>اختبار الروبوت كعميل عبر الواتساب:</span>
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {PRESET_SIMULATIONS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            disabled={isAiProcessing}
                            onClick={() =>
                              processIncomingWhatsappMessage(activeConv, preset.text, messages)
                            }
                            className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <form
                      onSubmit={handleSimulateCustomerSubmit}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={customerSimText}
                        onChange={(e) => setCustomerSimText(e.target.value)}
                        placeholder={
                          activeConv.aiAutoReplyEnabled
                            ? "اكتب استفساراً عن المنتجات/الخدمات/الأوقات/حالة طلب أو شكوى..."
                            : "المحادثة محولة للموظف (أرسل رسالة عميل أو أعد تفعيل AI)..."
                        }
                        className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:border-[#0D74B8]"
                      />
                      <button
                        type="submit"
                        disabled={isAiProcessing || !customerSimText.trim()}
                        className="px-3.5 py-2 rounded-lg bg-[#0D74B8] text-white text-xs font-medium hover:bg-[#0A5D94] disabled:opacity-50 whitespace-nowrap"
                      >
                        إرسال كعميل
                      </button>
                    </form>
                  </div>

                  {/* Staff Agent Reply */}
                  <form
                    onSubmit={handleAgentReplySubmit}
                    className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800"
                  >
                    <input
                      ref={agentInputRef}
                      type="text"
                      value={agentReplyText}
                      onChange={(e) => setAgentReplyText(e.target.value)}
                      placeholder="رد مباشر من موظف خدمة العملاء (مع إبقاء سجل المحادثة كاملاً)..."
                      className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:border-[#1B2E66]"
                    />
                    <button
                      type="submit"
                      disabled={!agentReplyText.trim()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1B2E66] dark:bg-[#961B5E] text-white text-xs font-medium hover:bg-[#12204A] dark:hover:bg-[#7A144B] disabled:opacity-50 whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>رد الموظف</span>
                    </button>
                  </form>
                </div>
              </>
            )}
          </section>

          {/* Linked Ticket & Bot Context Panel */}
          <aside className="lg:col-span-3 border-t lg:border-t-0 lg:border-r border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between bg-white dark:bg-slate-900 space-y-5">
            {!activeConv ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                بيانات العميل والشكوى ستظهر هنا.
              </p>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                    بيانات العميل
                  </p>
                  <h4 className="text-sm font-bold text-[#1B2E66] dark:text-slate-100 mt-1">
                    {activeConv.customerName}
                  </h4>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p
                      dir="ltr"
                      className="text-xs font-mono text-slate-600 dark:text-slate-300 tabular-nums"
                    >
                      {activeConv.customerPhone}
                    </p>
                    <a
                      href={buildWhatsappDirectUrl(activeConv.customerPhone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0"
                    >
                      <span>wa.me</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Bot & Escalation Context */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2 text-xs">
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                    حالة الروبوت والتحويل
                  </p>
                  <p className="text-slate-700 dark:text-slate-300">
                    <span className="text-slate-400 dark:text-slate-500">الحالة: </span>
                    <strong className="text-[#1B2E66] dark:text-slate-100">
                      {
                        HANDOFF_STATUS_LABELS[
                          activeConv.handoffStatus ||
                            (activeConv.aiAutoReplyEnabled ? "bot_active" : "agent_handling")
                        ]
                      }
                    </strong>
                  </p>
                  {activeConv.lastIntent && (
                    <p className="text-slate-700 dark:text-slate-300">
                      <span className="text-slate-400 dark:text-slate-500">آخر نية مكتشفة: </span>
                      <span>{INTENT_LABELS[activeConv.lastIntent]}</span>
                    </p>
                  )}
                  {activeConv.escalationRule && activeConv.escalationRule !== "none" && (
                    <p className="text-[#961B5E] dark:text-pink-400 font-medium leading-relaxed">
                      <span className="text-slate-400 dark:text-slate-500">قاعدة التحويل: </span>
                      {ESCALATION_RULE_LABELS[activeConv.escalationRule]}
                    </p>
                  )}
                  {activeConv.handoffReason && (
                    <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                      <span className="text-slate-400 dark:text-slate-500">سبب التحويل: </span>
                      {activeConv.handoffReason}
                    </p>
                  )}
                  {(activeConv.consecutiveAiFailures || 0) > 0 && activeConv.aiAutoReplyEnabled && (
                    <p className="text-xs font-mono text-amber-700 dark:text-amber-400 tabular-nums">
                      تنبيه القاعدة 4: تعثر سابق ({activeConv.consecutiveAiFailures}/2)
                    </p>
                  )}
                </div>

                {/* Linked Complaint */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                    الشكوى المرتبطة بالمحادثة
                  </p>
                  {linkedComplaint ? (
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          رمز الشكوى:
                        </span>
                        <p className="text-base font-bold font-mono text-[#961B5E] dark:text-pink-400 tabular-nums">
                          {linkedComplaint.ticketCode}
                        </p>
                      </div>
                      <div className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                        <p>
                          <span className="text-slate-400 dark:text-slate-500">الحالة: </span>
                          <strong className="text-[#1B2E66] dark:text-slate-100">
                            {STATUS_LABELS[linkedComplaint.status]}
                          </strong>
                        </p>
                        <p>
                          <span className="text-slate-400 dark:text-slate-500">الفرع: </span>
                          {linkedComplaint.branch}
                        </p>
                        <p>
                          <span className="text-slate-400 dark:text-slate-500">المضخة: </span>
                          {linkedComplaint.pumpNumber || "غير محدد"}
                        </p>
                        <p>
                          <span className="text-slate-400 dark:text-slate-500">ملخص الذكاء: </span>
                          {linkedComplaint.aiSummary}
                        </p>
                      </div>

                      <div className="pt-2 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenComplaint(linkedComplaint)}
                          className="w-full py-2 px-3 rounded-lg bg-[#1B2E66] dark:bg-[#0D74B8] text-white text-xs font-medium hover:bg-[#12204A] dark:hover:bg-[#0A5D94] transition-colors"
                        >
                          فتح بطاقة الشكوى
                        </button>
                        <button
                          type="button"
                          onClick={handleResendTicketCode}
                          className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          إعادة إرسال الرمز للعميل
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      المحادثة استفسار عام أو استعلام بدون شكوى مفتوحة حالياً. عند تسجيل شكوى جديدة
                      سيُصدر الرمز تلقائياً.
                    </p>
                  )}
                </div>

                {/* Other Customer Orders/Tickets */}
                {customerAllComplaints.length > 0 && (
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                      سجل طلبات العميل ({customerAllComplaints.length})
                    </p>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {customerAllComplaints.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onOpenComplaint(item)}
                          className="w-full text-right px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-mono font-semibold text-[#1B2E66] dark:text-sky-300 tabular-nums">
                            {item.ticketCode}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {STATUS_LABELS[item.status]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              <div className="space-y-1">
                <p className="font-semibold text-slate-600 dark:text-slate-300">
                  رقم الواتساب الرسمي لشركة فنار:
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span
                    dir="ltr"
                    className="font-mono text-xs font-semibold text-[#1B2E66] dark:text-sky-300 tabular-nums"
                  >
                    {officialWhatsappNumber}
                  </span>
                  <a
                    href={officialWhatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium hover:underline whitespace-nowrap"
                  >
                    <span>فتح المحادثة</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <div>
                نقطة الربط البرمجي الجاهزة للواتساب الفعلي:
                <code className="block mt-1 font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-700 dark:text-slate-200 break-all">
                  POST /api/webhooks/whatsapp
                </code>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
