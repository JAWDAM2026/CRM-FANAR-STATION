import { Timestamp } from "firebase/firestore";

export type UserRole =
  | "agent"
  | "station_supervisor"
  | "manager"
  | "quality_auditor"
  | "system_admin";

export type CustomerSegment = "individual" | "fleet" | "corporate";

export type ComplaintCategory =
  | "fuel_quality"
  | "billing_pump"
  | "cleanliness_facilities"
  | "staff_service"
  | "fleet_cards"
  | "other";

export type ComplaintChannel = "whatsapp" | "phone" | "direct" | "portal";

export type ComplaintPriority = "normal" | "high" | "urgent";

export type SlaTier = "P1" | "P2" | "P3" | "P4";

export type ComplaintStatus =
  | "new"
  | "in_progress"
  | "waiting_customer"
  | "pending_manager"
  | "resolved"
  | "closed"
  | "reopened"
  | "cancelled";

export type HandoffStatus = "bot_active" | "escalated_to_agent" | "agent_handling";

export type BotIntent =
  | "greeting"
  | "faq"
  | "order_status"
  | "complaint"
  | "escalation"
  | "unknown";

export type EscalationRuleKey =
  | "none"
  | "explicit_request"
  | "missing_knowledge"
  | "sensitive_case"
  | "repeated_failure"
  | "angry_or_reopen";

export type BotFaqCategory =
  | "products"
  | "services"
  | "hours"
  | "orders"
  | "general";

export interface BotFaqItem {
  id: string;
  question: string;
  answer: string;
  category: BotFaqCategory;
  enabled: boolean;
}

export interface WhatsappBotConfig {
  ownerId: string;
  botName: string;
  officialWhatsappNumber: string;
  welcomeMessage: string;
  toneInstruction: string;
  autoEscalateComplex: boolean;
  escalationMessage: string;
  workingHoursSummary: string;
  productsInfo: string;
  servicesInfo: string;
  branchesInfo: string;
  faqs: BotFaqItem[];
  updatedBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  branch: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  city: string;
  preferredBranch: string;
  segment: CustomerSegment;
  totalComplaints: number;
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ComplaintAttachmentMeta {
  fileName: string;
  fileType: string;
  sizeBytes: number;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  fromStatus: string;
  toStatus: string;
  action: string;
  note: string;
}

export interface Complaint {
  id: string;
  ticketCode: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  branch: string;
  pumpNumber: string;
  category: ComplaintCategory;
  channel: ComplaintChannel;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  description: string;
  aiSummary: string;
  codeSentViaWhatsapp: boolean;
  ownerId: string;
  assignedAgentName: string;
  managerNotes: string;
  closureReason: string;
  closedBy: string;
  closedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  // Extended Lifecycle, SLA & Customer Portal fields
  slaTier?: SlaTier;
  stationUnknown?: boolean;
  attachmentMeta?: ComplaintAttachmentMeta;
  occurredAt?: Timestamp;
  firstResponseAt?: Timestamp;
  resolvedAt?: Timestamp;
  pausedAt?: Timestamp | null;
  pausedTotalMinutes?: number;
  pauseCount?: number;
  pauseReason?: string;
  pauseReminderAt?: string;
  escalationLevel?: number;
  escalationOwner?: string;
  resolutionEvidence?: string;
  publicUpdateNote?: string;
  customerConfirmed?: boolean;
  csatScore?: number;
  csatComment?: string;
  reopenCount?: number;
  reopenReason?: string;
  previousSolution?: string;
  cancellationReason?: string;
  auditTrail?: AuditEntry[];
}

export interface Conversation {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  aiAutoReplyEnabled: boolean;
  lastMessage: string;
  linkedTicketCode: string;
  unreadCount: number;
  handoffStatus?: HandoffStatus;
  handoffReason?: string;
  handoffAt?: Timestamp;
  lastIntent?: BotIntent;
  escalationRule?: EscalationRuleKey;
  consecutiveAiFailures?: number;
  occurredAt?: Timestamp;
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface WhatsappMessage {
  id: string;
  sender: "customer" | "ai" | "agent";
  senderName: string;
  body: string;
  messageType: "text" | "ticket_code" | "closure_notice" | "handoff_notice";
  ticketCode: string;
  ownerId: string;
  createdAt?: Timestamp;
}

export interface CallLog {
  id: string;
  callerName: string;
  callerPhone: string;
  branch: string;
  durationSeconds: number;
  handledBy: "ai_ivr" | "agent";
  transcript: string;
  aiSummary: string;
  linkedTicketCode: string;
  codeSentViaWhatsapp: boolean;
  ownerId: string;
  createdAt?: Timestamp;
}

export interface QualityAudit {
  id: string;
  complaintId: string;
  ticketCode: string;
  stationName: string;
  auditorName: string;
  problemUnderstanding: number;
  communication: number;
  solutionAndEvidence: number;
  recordCompleteness: number;
  privacyCompliance: number;
  totalScore: number;
  improvementNotes: string;
  status: "passed" | "needs_improvement";
  monthKey: string;
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ActionPlanItem {
  id: string;
  title: string;
  rootCause: string;
  ownerName: string;
  dueDateLabel: string;
  targetMetric: string;
  status: "open" | "in_progress" | "completed";
  monthKey: string;
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface FanarStation {
  serial: number;
  code: string;
  name: string;
  city: string;
  region: string;
  operator: string;
  phone: string;
  operationType: "تشغيل ذاتي" | "امتياز تجاري";
  label: string;
}

export const FANAR_COMPANY_INFO = {
  name: "شركة فنار الطاقة للوقود",
  unifiedPhone: "920014255",
  city: "وادي الدواسر",
  postalCode: "18612",
  additionalNumber: "9859",
  unitNumber: "1000",
  email: "fahad1vip1@gmail.com",
} as const;

const RAW_FANAR_STATIONS: Array<Omit<FanarStation, "label">> = [
  { serial: 1, code: "ST-001", name: "السلام", city: "وادي الدواسر", region: "الرياض", operator: "شركة فنار الطاقة للوقود", phone: "0537037162", operationType: "تشغيل ذاتي" },
  { serial: 2, code: "ST-002", name: "السلطان", city: "وادي الدواسر", region: "الرياض", operator: "شركة فنار الطاقة للوقود", phone: "0537037162", operationType: "تشغيل ذاتي" },
  { serial: 3, code: "ST-003", name: "ارض المنتزه", city: "شرورة", region: "نجران", operator: "شركة فنار الطاقة للوقود", phone: "0557145782", operationType: "تشغيل ذاتي" },
  { serial: 4, code: "ST-004", name: "البريكي", city: "رنية", region: "مكة المكرمة", operator: "شركة فنار الطاقة للوقود", phone: "0537037162", operationType: "تشغيل ذاتي" },
  { serial: 5, code: "ST-005", name: "الفرسان", city: "البديع", region: "الرياض", operator: "شركة فنار الطاقة للوقود", phone: "0537037162", operationType: "تشغيل ذاتي" },
  { serial: 6, code: "ST-006", name: "كوكبة غرناطة", city: "تبوك", region: "تبوك", operator: "شركة فنار الطاقة للوقود", phone: "0537037162", operationType: "تشغيل ذاتي" },
  { serial: 7, code: "ST-007", name: "المرزوق", city: "وادي الدواسر", region: "الرياض", operator: "شركة فنار الطاقة للوقود", phone: "0537037162", operationType: "تشغيل ذاتي" },
  { serial: 8, code: "ST-008", name: "بتروتمرة", city: "السليل", region: "الرياض", operator: "شركة فنار الطاقة للوقود", phone: "0537037162", operationType: "تشغيل ذاتي" },
  { serial: 9, code: "ST-010", name: "الجفري", city: "القنفذة", region: "مكة المكرمة", operator: "شركة فنار الطاقة للوقود", phone: "0557145782", operationType: "تشغيل ذاتي" },
  { serial: 10, code: "ST-011", name: "اليرموك", city: "العارضة", region: "جازان", operator: "شركة فنار الطاقة للوقود", phone: "0557145782", operationType: "تشغيل ذاتي" },
  { serial: 11, code: "ST-016", name: "مبخوت البريكي", city: "سكاكا", region: "الشرقية", operator: "مؤسسة مبخوت البريكي", phone: "0503606669", operationType: "امتياز تجاري" },
  { serial: 12, code: "ST-018", name: "الشهراني", city: "وادي بن هشبل", region: "عسير", operator: "مؤسسة وقد الشعلة للوقود", phone: "0505761413", operationType: "تشغيل ذاتي" },
  { serial: 13, code: "ST-019", name: "المحمدية", city: "جيزان", region: "جازان", operator: "شركة فنار الطاقة للوقود", phone: "0557145782", operationType: "تشغيل ذاتي" },
  { serial: 14, code: "ST-021", name: "الكربي", city: "حفر الباطن", region: "الشرقية", operator: "شركة فنار الطاقة للوقود", phone: "0537037162", operationType: "تشغيل ذاتي" },
  { serial: 15, code: "ST-023", name: "الشنيفي", city: "تيماء", region: "تبوك", operator: "مؤسسة الشنيفي للوقود", phone: "0559133270", operationType: "امتياز تجاري" },
  { serial: 16, code: "ST-026", name: "الصدفة", city: "جيزان", region: "جازان", operator: "شركة فنار الطاقة للوقود", phone: "0557145782", operationType: "تشغيل ذاتي" },
  { serial: 17, code: "ST-027", name: "الجوهرة", city: "شرورة", region: "نجران", operator: "شركة فنار الطاقة للوقود", phone: "0557145782", operationType: "تشغيل ذاتي" },
  { serial: 18, code: "ST-028", name: "الدوشان", city: "تيماء", region: "تبوك", operator: "مؤسسة الشنيفي للوقود", phone: "0559133270", operationType: "امتياز تجاري" },
  { serial: 19, code: "ST-029", name: "ال ردعان", city: "السليل", region: "الرياض", operator: "شركة فنار الطاقة للوقود", phone: "0537037162", operationType: "تشغيل ذاتي" },
];

export const FANAR_STATIONS: FanarStation[] = RAW_FANAR_STATIONS.map((st) => ({
  ...st,
  label: `${st.code} · محطة ${st.name} — ${st.city} (${st.region})`,
}));

export const FANAR_BRANCHES: string[] = FANAR_STATIONS.map((st) => st.label);

export const FANAR_REGIONS: string[] = Array.from(
  new Set(FANAR_STATIONS.map((st) => st.region))
);

export function findFanarStation(branchOrCode?: string | null): FanarStation | undefined {
  if (!branchOrCode) return undefined;
  const normalized = branchOrCode.trim().toLowerCase();
  if (!normalized) return undefined;
  return FANAR_STATIONS.find(
    (st) =>
      st.label.toLowerCase() === normalized ||
      st.code.toLowerCase() === normalized ||
      normalized.includes(st.code.toLowerCase()) ||
      normalized.includes(st.name.toLowerCase())
  );
}

export const UNKNOWN_BRANCH_LABEL = "غير محددة — مراجعة وتوجيه يدوي";

export const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  fuel_quality: "جودة الوقود والأوكتان",
  billing_pump: "المضخات والفوترة والدفع",
  cleanliness_facilities: "النظافة والمرافق والمسجد",
  staff_service: "جودة خدمة الموظفين",
  fleet_cards: "بطاقات الوقود والأساطيل",
  other: "ملاحظات أخرى",
};

export const CHANNEL_LABELS: Record<ComplaintChannel, string> = {
  whatsapp: "واتساب الذكي",
  phone: "اتصال هاتفي",
  direct: "تسجيل مباشر",
  portal: "بوابة العميل",
};

export const PRIORITY_LABELS: Record<ComplaintPriority, string> = {
  normal: "عادية",
  high: "مرتفعة",
  urgent: "عاجلة",
};

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  new: "جديدة",
  in_progress: "قيد المعالجة",
  waiting_customer: "بانتظار العميل",
  pending_manager: "بانتظار المدير",
  resolved: "محلولة",
  closed: "مغلقة",
  reopened: "معاد فتحها",
  cancelled: "ملغاة",
};

export const PUBLIC_STATUS_LABELS: Record<ComplaintStatus, string> = {
  new: "تم استلام الطلب",
  in_progress: "قيد المعالجة لدى الفريق المختص",
  waiting_customer: "بانتظار معلومات إضافية منك",
  pending_manager: "قيد المراجعة النهائية",
  resolved: "تم الحل — يرجى التأكيد",
  closed: "مغلقة ومنجزة",
  reopened: "أُعيد فتحها للمتابعة",
  cancelled: "ملغاة",
};

export const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  individual: "أفراد",
  fleet: "أساطيل نقل",
  corporate: "شركات وجهات",
};

export const HANDOFF_STATUS_LABELS: Record<HandoffStatus, string> = {
  bot_active: "رد آلي AI نشط",
  escalated_to_agent: "محولة لموظف خدمة العملاء",
  agent_handling: "تحت متابعة الموظف",
};

export const INTENT_LABELS: Record<BotIntent, string> = {
  greeting: "ترحيب وبداية محادثة",
  faq: "استفسار من قاعدة المعرفة",
  order_status: "استعلام عن حالة طلب",
  complaint: "تسجيل شكوى",
  escalation: "تحويل لموظف خدمة العملاء",
  unknown: "استفسار عام",
};

export const ESCALATION_RULE_LABELS: Record<EscalationRuleKey, string> = {
  none: "لا يوجد تحويل",
  explicit_request: "القاعدة 1: طلب العميل التحدث مع موظف صراحة",
  missing_knowledge: "القاعدة 2: غياب إجابة موثقة في قاعدة المعرفة",
  sensitive_case: "القاعدة 3: حالة حساسة (سلامة / جودة وقود / خصوصية / إعلام)",
  repeated_failure: "القاعدة 4: تعثر البوت مرتين متتاليتين",
  angry_or_reopen: "القاعدة 5: عميل غاضب أو شكوى معاد فتحها",
};

export const FAQ_CATEGORY_LABELS: Record<BotFaqCategory, string> = {
  products: "المنتجات والوقود",
  services: "خدمات المحطات",
  hours: "أوقات العمل والفروع",
  orders: "حالة الطلبات والشكاوى",
  general: "أسئلة عامة",
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  agent: "موظف خدمة العملاء",
  station_supervisor: "مشرف المحطة",
  manager: "مدير المنطقة / خدمة العملاء",
  quality_auditor: "فريق الجودة والرقابة",
  system_admin: "مسؤول النظام",
};

export const ROLE_PERMISSION_DESCRIPTIONS: Record<
  UserRole,
  { scope: string; capabilities: string[] }
> = {
  agent: {
    scope: "تنفيذ المعالجة والتواصل اليومي",
    capabilities: [
      "قراءة وتعديل الشكاوى وتحديث الحالة وإيقاف SLA بانتظار العميل",
      "تسلّم المحادثات المحوّلة من واتساب والرد على العملاء",
      "محظور: حذف التذاكر أو تعديل سجل الإجراءات الزمني أو الاعتماد النهائي للإغلاق",
    ],
  },
  station_supervisor: {
    scope: "متابعة وحل شكاوى محطة محددة",
    capabilities: [
      "استعراض شكاوى محطته وإرفاق أدلة الحل الميدانية",
      "تحديث حالة المعالجة ورفع التذاكر للحل أو للمدير",
      "محظور: رؤية أو تعديل شكاوى المحطات الأخرى",
    ],
  },
  manager: {
    scope: "متابعة المحطات والالتزام وإغلاق الشكاوى",
    capabilities: [
      "إغلاق الشكاوى نهائياً مع سبب الإغلاق والدليل والملاحظات",
      "إعادة فتح الشكاوى أو إلغاؤها وفق السياسة المعتمدة",
      "مراجعة التقارير الشهرية التنفيذية ومصفوفة التصعيد",
    ],
  },
  quality_auditor: {
    scope: "تدقيق الجودة والخصوصية وسلامة السجل",
    capabilities: [
      "تقييم عينات الشكاوى وفق المعايير الخمسة الموزونة (100%)",
      "توثيق ملاحظات التحسين ومتابعة خطة العمل الشهرية",
      "صلاحية قراءة ومراجعة دون تغيير الإغلاقات التشغيلية مباشرة",
    ],
  },
  system_admin: {
    scope: "إعداد النظام والصلاحيات وقواعد التحويل",
    capabilities: [
      "تعديل مصفوفة الصلاحيات وأدوار الفريق وإعدادات المساعد الذكي",
      "الوصول الكامل لجميع الوحدات والتقارير التنفيذية وسجلات التدقيق",
      "تهيئة البيانات التأسيسية وإدارة قاعدة المعرفة",
    ],
  },
};

export interface SlaTierDefinition {
  tier: SlaTier;
  label: string;
  shortLabel: string;
  firstResponseMinutes: number;
  resolutionHours: number;
  escalateAtPct: number;
  escalationPolicy: string;
  examples: string;
}

export const SLA_TIERS: Record<SlaTier, SlaTierDefinition> = {
  P1: {
    tier: "P1",
    label: "حرجة (P1)",
    shortLabel: "P1 حرج",
    firstResponseMinutes: 15,
    resolutionHours: 4,
    escalateAtPct: 0,
    escalationPolicy: "تصعيد فوري للإدارة وQHSE",
    examples: "سلامة، تسرب، تعطل مضخات كامل، خطأ وقود",
  },
  P2: {
    tier: "P2",
    label: "عالية (P2)",
    shortLabel: "P2 عالي",
    firstResponseMinutes: 30,
    resolutionHours: 8,
    escalateAtPct: 50,
    escalationPolicy: "تصعيد تلقائي عند بلوغ 50% من الزمن",
    examples: "خصم غير صحيح، تعطل دفع، سلوك حاد، جودة وقود",
  },
  P3: {
    tier: "P3",
    label: "متوسطة (P3)",
    shortLabel: "P3 متوسط",
    firstResponseMinutes: 120,
    resolutionHours: 24,
    escalateAtPct: 75,
    escalationPolicy: "تصعيد عند بلوغ 75% من الزمن",
    examples: "نظافة مرافق، تأخر خدمة، بطاقة ولاء / أسطول",
  },
  P4: {
    tier: "P4",
    label: "منخفضة (P4)",
    shortLabel: "P4 منخفض",
    firstResponseMinutes: 240,
    resolutionHours: 72,
    escalateAtPct: 100,
    escalationPolicy: "تصعيد عند التجاوز فقط",
    examples: "استفسار عام، اقتراح، طلب معلومة أو فاتورة",
  },
};

export const SLA_TIER_BY_PRIORITY: Record<ComplaintPriority, SlaTier> = {
  urgent: "P1",
  high: "P2",
  normal: "P3",
};

export function resolveComplaintSlaTier(c: Pick<Complaint, "slaTier" | "priority" | "category">): SlaTier {
  if (c.slaTier && c.slaTier in SLA_TIERS) {
    return c.slaTier;
  }
  if (c.priority === "urgent" || c.category === "fuel_quality") return "P1";
  if (c.priority === "high") return "P2";
  return "P3";
}

// Strict Lifecycle Transitions (no jumping directly from 'new' to 'closed')
export const ALLOWED_STATUS_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  new: ["in_progress", "waiting_customer", "pending_manager", "cancelled"],
  in_progress: ["waiting_customer", "pending_manager", "resolved", "cancelled"],
  waiting_customer: ["in_progress", "pending_manager", "resolved", "cancelled"],
  pending_manager: ["in_progress", "waiting_customer", "resolved", "closed", "cancelled"],
  resolved: ["closed", "reopened", "pending_manager"],
  closed: ["reopened"],
  reopened: ["in_progress", "waiting_customer", "pending_manager", "resolved"],
  cancelled: ["reopened"],
};

export const ESCALATION_MATRIX_LEVELS = [
  {
    level: 1,
    name: "المستوى 1 — التشغيل والمحطة",
    trigger: "اقتراب تجاوز SLA أو نقص دليل ميداني",
    owner: "مشرف المحطة + موظف خدمة العملاء",
    targetHours: 4,
  },
  {
    level: 2,
    name: "المستوى 2 — إدارة التشغيل والمنطقة",
    trigger: "تجاوز 75% من زمن SLA أو تذكرة P2 متكررة",
    owner: "مدير المنطقة / مدير خدمة العملاء",
    targetHours: 8,
  },
  {
    level: 3,
    name: "المستوى 3 — الإدارة العليا وQHSE",
    trigger: "حالات P1 الحرجة (سلامة / تسرب / جودة وقود / خطأ تعبئة)",
    owner: "مدير الجودة والسلامة والإدارة التنفيذية",
    targetHours: 4,
  },
];

export const CLOSURE_REASONS = [
  "تمت المعالجة والحل مع العميل",
  "تعويض العميل / تسوية الفاتورة",
  "إجراء تصحيحي لمضخات / مرافق المحطة",
  "توجيه وتدريب طاقم المحطة",
  "بلاغ غير مطابق بعد المراجعة الفنية",
];

export const QUALITY_CRITERIA_WEIGHTS = {
  problemUnderstanding: { label: "فهم المشكلة والتوجيه الصحيح", weight: 0.2 },
  communication: { label: "جودة التواصل والأسلوب المهني", weight: 0.2 },
  solutionAndEvidence: { label: "جودة الحل وإرفاق الدليل", weight: 0.3 },
  recordCompleteness: { label: "اكتمال السجل والتوقيت", weight: 0.2 },
  privacyCompliance: { label: "الالتزام بالخصوصية وحماية البيانات", weight: 0.1 },
} as const;

export function calculateWeightedQualityScore(scores: {
  problemUnderstanding: number;
  communication: number;
  solutionAndEvidence: number;
  recordCompleteness: number;
  privacyCompliance: number;
}): number {
  const total =
    scores.problemUnderstanding * 0.2 +
    scores.communication * 0.2 +
    scores.solutionAndEvidence * 0.3 +
    scores.recordCompleteness * 0.2 +
    scores.privacyCompliance * 0.1;
  return Math.round(Math.max(0, Math.min(100, total)));
}

// Synchronized validation bounds matching firebase-blueprint.json
export const FIELD_LIMITS = {
  NAME_MAX: 120,
  PHONE_MAX: 30,
  CITY_MAX: 60,
  BRANCH_MAX: 100,
  PUMP_MAX: 20,
  DESCRIPTION_MAX: 2000,
  SUMMARY_MAX: 1000,
  NOTES_MAX: 2000,
  TRANSCRIPT_MAX: 4000,
  HANDOFF_REASON_MAX: 400,
  EVIDENCE_MAX: 600,
  REASON_MAX: 400,
  AUDIT_MAX_ENTRIES: 30,
  TICKET_CODE_REGEX: /^FNR-[0-9A-Z-]+$/,
};

export const OFFICIAL_WHATSAPP_NUMBER = "00966559144745";

export function buildWhatsappDirectUrl(phone: string, prefilledText?: string): string {
  const digitsOnly = (phone || OFFICIAL_WHATSAPP_NUMBER).replace(/\D/g, "");
  let normalized = digitsOnly;
  if (normalized.startsWith("00")) {
    normalized = normalized.slice(2);
  } else if (normalized.startsWith("05") && normalized.length === 10) {
    normalized = `966${normalized.slice(1)}`;
  } else if (normalized.startsWith("5") && normalized.length === 9) {
    normalized = `966${normalized}`;
  }
  const base = `https://wa.me/${normalized || "966559144745"}`;
  if (prefilledText && prefilledText.trim()) {
    return `${base}?text=${encodeURIComponent(prefilledText.trim())}`;
  }
  return base;
}

export const BOT_FIELD_LIMITS = {
  BOT_NAME_MAX: 80,
  OFFICIAL_WHATSAPP_MAX: 30,
  WELCOME_MAX: 600,
  TONE_MAX: 600,
  ESCALATION_MSG_MAX: 600,
  HOURS_MAX: 1000,
  PRODUCTS_MAX: 1500,
  SERVICES_MAX: 1500,
  BRANCHES_MAX: 1500,
  FAQ_QUESTION_MAX: 300,
  FAQ_ANSWER_MAX: 1000,
  MAX_FAQS: 30,
};

export const DEFAULT_WHATSAPP_BOT_CONFIG: Omit<
  WhatsappBotConfig,
  "ownerId" | "updatedBy" | "createdAt" | "updatedAt"
> = {
  botName: "مساعد فنار الذكي",
  officialWhatsappNumber: OFFICIAL_WHATSAPP_NUMBER,
  welcomeMessage:
    "أهلاً بكم في خدمة عملاء شركة فنار الطاقة للوقود عبر واتساب. يسعدني مساعدتكم في الاستفسار عن منتجاتنا، خدمات المحطات، أوقات العمل، متابعة حالة طلباتكم، أو تسجيل أي ملاحظة.",
  toneInstruction:
    "تحدث بعربية سعودية مهنية ولطيفة ومختصرة. اعتمد على بيانات قاعدة المعرفة المعتمدة فقط، وإذا تعذرت الإجابة أو كانت الشكوى معقدة/حساسة أو تعثر الفهم مرتين أو طلب العميل موظفاً بشرياً فقم بتحويل المحادثة فوراً مع حفظ السجل.",
  autoEscalateComplex: true,
  escalationMessage:
    "نقدّر تواصلكم معنا. تم تحويل محادثتكم وكامل السجل الآن إلى أحد موظفي خدمة العملاء المختصين في شركة فنار الطاقة للوقود لمباشرة خدمتكم والرد عليكم في أقرب وقت.",
  productsInfo: [
    "• بنزين 91 (أوكتان 91) وبنزين 95 (أوكتان 95) بجودة معتمدة ومطابقة لمواصفات أرامكو السعودية.",
    "• الديزل النظيف المخصص للشاحنات والمعدات الثقيلة والمركبات التجارية.",
    "• زيوت المحركات الأصلية، سوائل التبريد، وإضافات الوقود المعتمدة.",
    "• بطاقات وقود الأساطيل للشركات والجهات (فوترة شهرية، تقارير استهلاك رقمية، وتحديد حدود لكل مركبة).",
  ].join("\n"),
  servicesInfo: [
    "• تعبئة الوقود بالخدمة الكاملة مع الدفع الإلكتروني (مدى، Apple Pay، فيزا، ماستركارد، وبطاقات أساطيل فنار).",
    "• غسيل السيارات الآلي واليدوي وتلميع المركبات في المحطات الرئيسية.",
    "• خدمة تبديل الزيوت السريع وفحص ضغط الإطارات.",
    "• تموينات وسوبرماركت فنار ومقهى المسافرين.",
    "• مصليات مجهزة ودورات مياه مراقبة النظافة على مدار الساعة.",
  ].join("\n"),
  workingHoursSummary: [
    "• مضخات الوقود والدفع الإلكتروني: تعمل على مدار 24 ساعة يومياً طوال أيام الأسبوع (بما في ذلك يوم الجمعة والعطل الرسمية).",
    "• خدمات غسيل السيارات وتبديل الزيوت السريع: يومياً من 6:00 صباحاً حتى 12:00 منتصف الليل (الجمعة من 1:00 ظهراً حتى 12:00 منتصف الليل).",
    "• تموينات فنار: 24 ساعة يومياً في المحطات الرئيسية.",
    "• الدعم المباشر لموظفي خدمة العملاء: يومياً من 8:00 صباحاً حتى 11:00 مساءً، والرد الآلي الذكي متاح 24/7.",
  ].join("\n"),
  branchesInfo: FANAR_BRANCHES.join("\n"),
  faqs: [
    {
      id: "faq-fuel-types",
      category: "products",
      question: "ما هي أنواع الوقود المتوفرة في محطات فنار؟",
      answer:
        "نوفر في محطات فنار بنزين 91، بنزين 95، والديزل النظيف للشاحنات، بالإضافة إلى زيوت المحركات المعتمدة وبطاقات وقود الأساطيل.",
      enabled: true,
    },
    {
      id: "faq-fleet-cards",
      category: "products",
      question: "كيف يمكن للشركات الاشتراك في بطاقات وقود الأساطيل؟",
      answer:
        "تتيح بطاقات أساطيل فنار للشركات إدارة استهلاك المركبات عبر فواتير شهرية وتقارير لحظية. لتقديم طلب تعاقد جديد أو تفعيل بطاقات، يمكننا تحويلكم الآن لموظف خدمة العملاء المختص.",
      enabled: true,
    },
    {
      id: "faq-car-wash",
      category: "services",
      question: "هل يتوفر غسيل سيارات وتبديل زيوت في المحطات؟",
      answer:
        "نعم، تتوفر خدمات غسيل السيارات وتبديل الزيوت السريع وفحص الإطارات في المحطات الرئيسية يومياً من 6 صباحاً حتى 12 منتصف الليل (والجمعة من 1 ظهراً).",
      enabled: true,
    },
    {
      id: "faq-hours",
      category: "hours",
      question: "ما هي أوقات عمل محطات فنار وهل تعملون يوم الجمعة؟",
      answer:
        "تعمل مضخات الوقود وتموينات فنار على مدار 24 ساعة طوال أيام الأسبوع بما فيها يوم الجمعة والإجازات الرسمية.",
      enabled: true,
    },
    {
      id: "faq-order-status",
      category: "orders",
      question: "كيف أستعلم عن حالة طلبي أو شكواي؟",
      answer:
        "يمكنكم إرسال رمز الشكوى الرسمي (مثال: FNR-2611-4018) أو الاستفسار برقم جوالكم المسجل أو الدخول لبوابة العميل وسأعرض لكم الحالة المحدثة فوراً.",
      enabled: true,
    },
    {
      id: "faq-payment",
      category: "services",
      question: "ما وسائل الدفع المتاحة عند المضخات؟",
      answer:
        "نقبل الدفع نقداً وعبر بطاقات مدى، Apple Pay، فيزا، ماستركارد، بالإضافة إلى بطاقات وقود أساطيل فنار.",
      enabled: true,
    },
    {
      id: "faq-whatsapp-contact",
      category: "general",
      question: "ما هو رقم الواتساب الرسمي لخدمة عملاء فنار؟",
      answer:
        "رقم الواتساب الرسمي المعتمد لخدمة عملاء شركة فنار الطاقة للوقود هو 00966559144745، ويسعدنا استقبال استفساراتكم وطلباتكم عليه في أي وقت.",
      enabled: true,
    },
  ],
};

export function generateTicketCode(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `FNR-${yy}${mm}-${rand}`;
}

export function getComplaintEffectiveDate(c: Pick<Complaint, "occurredAt" | "createdAt">): Date {
  const ts = c.occurredAt || c.createdAt;
  if (!ts) return new Date();
  return ts instanceof Timestamp ? ts.toDate() : new Date(ts as unknown as string);
}

export function formatArabicDate(ts?: Timestamp | Date | string | null): string {
  if (!ts) return "الآن";
  const date =
    ts instanceof Timestamp ? ts.toDate() : typeof ts === "string" ? new Date(ts) : ts;
  if (Number.isNaN(date.getTime())) return "الآن";
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export interface ComputedSlaStatus {
  tier: SlaTier;
  tierLabel: string;
  targetHours: number;
  firstResponseTargetMinutes: number;
  elapsedMinutes: number;
  effectiveElapsedMinutes: number;
  remainingMinutes: number;
  progressPct: number;
  isPaused: boolean;
  isBreached: boolean;
  needsEscalation: boolean;
  firstResponseMet: boolean;
}

export function computeSlaStatus(c: Complaint, nowMs = Date.now()): ComputedSlaStatus {
  const tier = resolveComplaintSlaTier(c);
  const def = SLA_TIERS[tier];
  const targetMinutes = def.resolutionHours * 60;

  const startDate = getComplaintEffectiveDate(c);
  const startMs = startDate.getTime();
  const endMs =
    c.status === "closed" || c.status === "resolved" || c.status === "cancelled"
      ? (c.resolvedAt || c.closedAt || c.updatedAt)?.toMillis?.() ?? nowMs
      : nowMs;

  const rawElapsedMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));
  const pausedStored = Math.max(0, c.pausedTotalMinutes || 0);
  const activePauseMinutes =
    c.status === "waiting_customer" && c.pausedAt
      ? Math.max(0, Math.round((nowMs - c.pausedAt.toMillis()) / 60000))
      : 0;

  const effectiveElapsedMinutes = Math.max(
    0,
    rawElapsedMinutes - pausedStored - activePauseMinutes
  );
  const remainingMinutes = targetMinutes - effectiveElapsedMinutes;
  const progressPct = Math.min(
    200,
    Math.round((effectiveElapsedMinutes / Math.max(1, targetMinutes)) * 100)
  );

  const isTerminal = c.status === "closed" || c.status === "cancelled";
  const isPaused = c.status === "waiting_customer";
  const isBreached = effectiveElapsedMinutes > targetMinutes;
  const needsEscalation =
    !isTerminal &&
    (tier === "P1" || (def.escalateAtPct > 0 && progressPct >= def.escalateAtPct));

  const firstRespMinutes = c.firstResponseAt
    ? Math.max(0, Math.round((c.firstResponseAt.toMillis() - startMs) / 60000))
    : isTerminal || c.status !== "new"
    ? Math.min(def.firstResponseMinutes, rawElapsedMinutes)
    : rawElapsedMinutes;

  return {
    tier,
    tierLabel: def.label,
    targetHours: def.resolutionHours,
    firstResponseTargetMinutes: def.firstResponseMinutes,
    elapsedMinutes: rawElapsedMinutes,
    effectiveElapsedMinutes,
    remainingMinutes,
    progressPct,
    isPaused,
    isBreached,
    needsEscalation,
    firstResponseMet: firstRespMinutes <= def.firstResponseMinutes,
  };
}
