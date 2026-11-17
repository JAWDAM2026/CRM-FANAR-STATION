import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

interface WebhookEventRecord {
  id: string;
  source: "whatsapp" | "calls";
  receivedAt: string;
  from: string;
  summary: string;
  aiReply?: string;
}

const recentWebhookEvents: WebhookEventRecord[] = [];

const FANAR_COMPANY_INFO = {
  name: "شركة فنار الطاقة للوقود",
  unifiedPhone: "920014255",
  city: "وادي الدواسر",
  postalCode: "18612",
  additionalNumber: "9859",
  unitNumber: "1000",
  email: "fahad1vip1@gmail.com",
};

const FANAR_STATIONS = [
  { code: "ST-001", name: "السلام", city: "وادي الدواسر", region: "الرياض", operator: "شركة فنار الطاقة للوقود", phone: "0537037162", operationType: "تشغيل ذاتي" },
  { code: "ST-002", name: "السلطان", city: "وادي الدواسر", region: "الرياض", operator: "شركة فنار الطاقة للوقود", phone: "0537037162", operationType: "تشغيل ذاتي" },
  { code: "ST-003", name: "ارض المنتزه", city: "شرورة", region: "نجران", operator: "شركة فنار الطاقة للوقود", phone: "0557145782", operationType: "تشغيل ذاتي" },
  { code: "ST-004", name: "البريكي", city: "رنية", region: "مكة المكرمة", operator: "شركة فنار الطاقة للوقود", phone: "0537037162", operationType: "تشغيل ذاتي" },
  { code: "ST-005", name: "الفرسان", city: "البديع", region: "الرياض", operator: "شركة فنار الطاقة للوقود", phone: "0537037162", operationType: "تشغيل ذاتي" },
  { code: "ST-006", name: "كوكبة غرناطة", city: "تبوك", region: "تبوك", operator: "شركة فنار الطاقة للوقود", phone: "0537037162", operationType: "تشغيل ذاتي" },
  { code: "ST-007", name: "المرزوق", city: "وادي الدواسر", region: "الرياض", operator: "شركة فنار الطاقة للوقود", phone: "0537037162", operationType: "تشغيل ذاتي" },
  { code: "ST-008", name: "بتروتمرة", city: "السليل", region: "الرياض", operator: "شركة فنار الطاقة للوقود", phone: "0537037162", operationType: "تشغيل ذاتي" },
  { code: "ST-010", name: "الجفري", city: "القنفذة", region: "مكة المكرمة", operator: "شركة فنار الطاقة للوقود", phone: "0557145782", operationType: "تشغيل ذاتي" },
  { code: "ST-011", name: "اليرموك", city: "العارضة", region: "جازان", operator: "شركة فنار الطاقة للوقود", phone: "0557145782", operationType: "تشغيل ذاتي" },
  { code: "ST-016", name: "مبخوت البريكي", city: "سكاكا", region: "الشرقية", operator: "مؤسسة مبخوت البريكي", phone: "0503606669", operationType: "امتياز تجاري" },
  { code: "ST-018", name: "الشهراني", city: "وادي بن هشبل", region: "عسير", operator: "مؤسسة وقد الشعلة للوقود", phone: "0505761413", operationType: "تشغيل ذاتي" },
  { code: "ST-019", name: "المحمدية", city: "جيزان", region: "جازان", operator: "شركة فنار الطاقة للوقود", phone: "0557145782", operationType: "تشغيل ذاتي" },
  { code: "ST-021", name: "الكربي", city: "حفر الباطن", region: "الشرقية", operator: "شركة فنار الطاقة للوقود", phone: "0537037162", operationType: "تشغيل ذاتي" },
  { code: "ST-023", name: "الشنيفي", city: "تيماء", region: "تبوك", operator: "مؤسسة الشنيفي للوقود", phone: "0559133270", operationType: "امتياز تجاري" },
  { code: "ST-026", name: "الصدفة", city: "جيزان", region: "جازان", operator: "شركة فنار الطاقة للوقود", phone: "0557145782", operationType: "تشغيل ذاتي" },
  { code: "ST-027", name: "الجوهرة", city: "شرورة", region: "نجران", operator: "شركة فنار الطاقة للوقود", phone: "0557145782", operationType: "تشغيل ذاتي" },
  { code: "ST-028", name: "الدوشان", city: "تيماء", region: "تبوك", operator: "مؤسسة الشنيفي للوقود", phone: "0559133270", operationType: "امتياز تجاري" },
  { code: "ST-029", name: "ال ردعان", city: "السليل", region: "الرياض", operator: "شركة فنار الطاقة للوقود", phone: "0537037162", operationType: "تشغيل ذاتي" },
].map((st) => ({
  ...st,
  label: `${st.code} · محطة ${st.name} — ${st.city} (${st.region})`,
}));

const FANAR_BRANCHES = FANAR_STATIONS.map((st) => st.label);

const UNKNOWN_BRANCH_LABEL = "غير محددة — مراجعة وتوجيه يدوي";

const PUBLIC_STATUS_LABELS: Record<string, string> = {
  new: "تم استلام الطلب",
  in_progress: "قيد المعالجة لدى الفريق المختص",
  waiting_customer: "بانتظار معلومات إضافية منك",
  pending_manager: "قيد المراجعة النهائية",
  resolved: "تم الحل — يرجى التأكيد",
  closed: "مغلقة ومنجزة",
  reopened: "أُعيد فتحها للمتابعة",
  cancelled: "ملغاة",
};

const NEXT_STEP_BY_STATUS: Record<string, string> = {
  new: "يراجع فريق خدمة العملاء البلاغ وتحديد الأولوية والتوجيه للمحطة المختصة.",
  in_progress: "فريق التشغيل المختص يعمل على معالجة البلاغ والتحقق الميداني.",
  waiting_customer: "يرجى تزويدنا بالمعلومات الإضافية المطلوبة أدناه لاستكمال المعالجة.",
  pending_manager: "الشكوى قيد المراجعة النهائية لاعتماد الإغلاق وضمان الجودة.",
  resolved: "يرجى تأكيد إغلاق الشكوى وتقييم الخدمة، أو طلب إعادة الفتح إذا استمرت المشكلة.",
  closed: "تم إغلاق البلاغ بنجاح. نشكركم لتواصلكم مع محطات فنار.",
  reopened: "تمت إعادة فتح البلاغ للمراجعة الإضافية لدى الفريق المختص.",
  cancelled: "تم إلغاء الطلب وفق التوثيق المسجل.",
};

interface PortalTicketRecord {
  ticketCode: string;
  customerName: string;
  customerPhone: string;
  branch: string;
  stationUnknown: boolean;
  pumpNumber: string;
  category: string;
  priority: "normal" | "high" | "urgent";
  slaTier: "P1" | "P2" | "P3" | "P4";
  status: string;
  description: string;
  attachmentMeta?: {
    fileName: string;
    fileType: string;
    sizeBytes: number;
  };
  publicUpdateNote: string;
  resolutionEvidence: string;
  customerConfirmed: boolean;
  csatScore?: number;
  csatComment?: string;
  reopenCount: number;
  reopenReason?: string;
  previousSolution?: string;
  createdAtIso: string;
  updatedAtIso: string;
  customerTimeline: Array<{ timestamp: string; label: string }>;
}

interface PendingPortalCreate {
  id: string;
  ticketCode: string;
  customerName: string;
  customerPhone: string;
  branch: string;
  stationUnknown: boolean;
  pumpNumber: string;
  category: string;
  priority: "normal" | "high" | "urgent";
  slaTier: "P1" | "P2" | "P3" | "P4";
  description: string;
  attachmentMeta?: {
    fileName: string;
    fileType: string;
    sizeBytes: number;
  };
  createdAtIso: string;
}

interface PendingPortalAction {
  id: string;
  ticketCode: string;
  action: "add_info" | "request_agent" | "confirm_resolved" | "reopen";
  note?: string;
  csatScore?: number;
  csatComment?: string;
  createdAtIso: string;
}

interface PortalStoreState {
  syncedTickets: PortalTicketRecord[];
  pendingCreates: PendingPortalCreate[];
  pendingActions: PendingPortalAction[];
}

const PORTAL_STORE_PATH = "/tmp/fanar-crm-portal-store.json";

function loadPortalStore(): PortalStoreState {
  try {
    if (fs.existsSync(PORTAL_STORE_PATH)) {
      const raw = fs.readFileSync(PORTAL_STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as Partial<PortalStoreState>;
      return {
        syncedTickets: Array.isArray(parsed.syncedTickets) ? parsed.syncedTickets : [],
        pendingCreates: Array.isArray(parsed.pendingCreates) ? parsed.pendingCreates : [],
        pendingActions: Array.isArray(parsed.pendingActions) ? parsed.pendingActions : [],
      };
    }
  } catch {
    // Ignore corrupted file and initialize fresh
  }
  return { syncedTickets: [], pendingCreates: [], pendingActions: [] };
}

function savePortalStore(state: PortalStoreState): void {
  try {
    fs.writeFileSync(PORTAL_STORE_PATH, JSON.stringify(state), "utf-8");
  } catch {
    // Ignore disk write failure on ephemeral environments
  }
}

function normalizePhoneDigits(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("00966")) return digits.slice(5);
  if (digits.startsWith("966")) return digits.slice(3);
  if (digits.startsWith("05") && digits.length === 10) return digits.slice(1);
  return digits.slice(-9);
}

function phonesMatch(a: string, b: string): boolean {
  const na = normalizePhoneDigits(a);
  const nb = normalizePhoneDigits(b);
  return na.length >= 7 && nb.length >= 7 && na === nb;
}

function generateServerTicketCode(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `FNR-${yy}${mm}-${rand}`;
}

function redactTicketForCustomer(ticket: PortalTicketRecord) {
  return {
    ticketCode: ticket.ticketCode,
    status: ticket.status,
    publicStatusLabel: PUBLIC_STATUS_LABELS[ticket.status] || "قيد المراجعة",
    expectedNextStep: NEXT_STEP_BY_STATUS[ticket.status] || "تحت المتابعة",
    branch: ticket.stationUnknown ? UNKNOWN_BRANCH_LABEL : ticket.branch,
    stationUnknown: ticket.stationUnknown,
    category: ticket.category,
    slaTier: ticket.slaTier,
    createdAtIso: ticket.createdAtIso,
    updatedAtIso: ticket.updatedAtIso,
    publicUpdateNote:
      ticket.publicUpdateNote ||
      (ticket.status === "new"
        ? "تم تسجيل البلاغ وإدراجه في قائمة الأولوية."
        : "تتم مراجعة الشكوى وفق مستويات الخدمة المعتمدة."),
    resolutionSummary:
      ticket.status === "resolved" || ticket.status === "closed"
        ? ticket.resolutionEvidence || "تمت معالجة البلاغ وتنفيذ الإجراء التصحيحي."
        : "",
    customerConfirmed: Boolean(ticket.customerConfirmed),
    csatScore: ticket.csatScore || 0,
    canConfirmOrReopen: ticket.status === "resolved",
    canAddInfo: ticket.status !== "closed" && ticket.status !== "cancelled",
    customerTimeline: ticket.customerTimeline.slice(-10),
  };
}

let portalStore: PortalStoreState = loadPortalStore();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "4mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "fanar-energy-crm" });
  });

  // ============================================================================
  // PUBLIC CUSTOMER PORTAL ROUTES (Strictly Isolated from Direct Firestore PII)
  // ============================================================================

  app.post("/api/portal/complaints", (req, res) => {
    const body = req.body || {};
    const customerName = String(body.customerName || "").trim().slice(0, 120);
    const customerPhone = String(body.customerPhone || "").trim().slice(0, 30);
    const category = String(body.category || "other").trim();
    const branchRaw = String(body.branch || "").trim().slice(0, 100);
    const stationUnknown = Boolean(body.stationUnknown) || !branchRaw;
    const branch = stationUnknown ? UNKNOWN_BRANCH_LABEL : branchRaw;
    const pumpNumber = String(body.pumpNumber || (stationUnknown ? "غير محدد" : "عام"))
      .trim()
      .slice(0, 20);
    const description = String(body.description || "").trim().slice(0, 2000);
    const attachmentMeta = body.attachmentMeta as
      | { fileName?: string; fileType?: string; sizeBytes?: number }
      | undefined;

    if (customerName.length < 2) {
      return res.status(400).json({ error: "يرجى إدخال الاسم الكامل بشكل صحيح." });
    }
    if (normalizePhoneDigits(customerPhone).length < 8) {
      return res.status(400).json({ error: "يرجى إدخال رقم جوال صحيح للتحقق والمتابعة." });
    }
    if (!["fuel_quality", "billing_pump", "cleanliness_facilities", "staff_service", "fleet_cards", "other"].includes(category)) {
      return res.status(400).json({ error: "تصنيف الشكوى غير صالح." });
    }
    if (description.length < 10) {
      return res.status(400).json({ error: "يرجى كتابة تفاصيل الشكوى (10 أحرف على الأقل)." });
    }

    let cleanAttachment: PortalTicketRecord["attachmentMeta"] | undefined;
    if (attachmentMeta && attachmentMeta.fileName) {
      const allowedMime = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
      const fileType = String(attachmentMeta.fileType || "").toLowerCase();
      const sizeBytes = Number(attachmentMeta.sizeBytes || 0);
      if (!allowedMime.includes(fileType)) {
        return res.status(400).json({
          error: "صيغة المرفق غير مدعومة. الصيغ المسموحة هي JPG و PNG و PDF فقط.",
        });
      }
      if (sizeBytes <= 0 || sizeBytes > 10 * 1024 * 1024) {
        return res.status(400).json({
          error: "حجم الملف المرفق يتجاوز الحد المسموح به (10 ميجابايت).",
        });
      }
      cleanAttachment = {
        fileName: String(attachmentMeta.fileName).slice(0, 200),
        fileType,
        sizeBytes: Math.round(sizeBytes),
      };
    }

    // Duplicate Check within 48h (warn without blocking/deleting)
    const nowMs = Date.now();
    const fortyEightHoursMs = 48 * 3600 * 1000;
    const allKnown = [
      ...portalStore.syncedTickets,
      ...portalStore.pendingCreates.map((p) => ({
        ticketCode: p.ticketCode,
        customerPhone: p.customerPhone,
        category: p.category,
        createdAtIso: p.createdAtIso,
        status: "new",
      })),
    ];

    const duplicateMatch = allKnown.find((t) => {
      if (t.status === "closed" || t.status === "cancelled") return false;
      const ageMs = nowMs - new Date(t.createdAtIso).getTime();
      return (
        ageMs >= 0 &&
        ageMs <= fortyEightHoursMs &&
        phonesMatch(t.customerPhone, customerPhone) &&
        t.category === category
      );
    });

    const ticketCode = generateServerTicketCode();
    const priority: "normal" | "high" | "urgent" =
      category === "fuel_quality"
        ? "urgent"
        : category === "billing_pump" || category === "fleet_cards"
        ? "high"
        : "normal";
    const slaTier: "P1" | "P2" | "P3" | "P4" =
      priority === "urgent" ? "P1" : priority === "high" ? "P2" : "P3";
    const nowIso = new Date().toISOString();

    const newTicket: PortalTicketRecord = {
      ticketCode,
      customerName,
      customerPhone,
      branch,
      stationUnknown,
      pumpNumber,
      category,
      priority,
      slaTier,
      status: "new",
      description,
      attachmentMeta: cleanAttachment,
      publicUpdateNote: stationUnknown
        ? "تم استلام طلبك وجارٍ مراجعته يدوياً لتحديد المحطة المختصة."
        : "تم استلام طلبك وإحالته لفريق خدمة العملاء وفق مستوى الخدمة المعتمد.",
      resolutionEvidence: "",
      customerConfirmed: false,
      reopenCount: 0,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
      customerTimeline: [
        { timestamp: nowIso, label: "تم استلام وتسجيل الشكوى عبر بوابة العميل" },
      ],
    };

    portalStore.syncedTickets.unshift(newTicket);
    portalStore.pendingCreates.push({
      id: `pcreate_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      ticketCode,
      customerName,
      customerPhone,
      branch,
      stationUnknown,
      pumpNumber,
      category,
      priority,
      slaTier,
      description,
      attachmentMeta: cleanAttachment,
      createdAtIso: nowIso,
    });
    savePortalStore(portalStore);

    return res.status(201).json({
      ok: true,
      ticketCode,
      slaTier,
      stationUnknown,
      duplicateWarning: Boolean(duplicateMatch),
      duplicateTicketCode: duplicateMatch?.ticketCode || null,
      ticket: redactTicketForCustomer(newTicket),
    });
  });

  app.post("/api/portal/track", (req, res) => {
    const ticketCode = String(req.body?.ticketCode || "").trim().toUpperCase();
    const customerPhone = String(req.body?.customerPhone || "").trim();

    if (!/^FNR-[0-9A-Z-]+$/.test(ticketCode) || normalizePhoneDigits(customerPhone).length < 7) {
      return res.status(400).json({
        error: "لحماية خصوصيتك، يجب إدخال الرقم المرجعي (FNR-...) ورقم الجوال المسجل معاً.",
      });
    }

    const found = portalStore.syncedTickets.find(
      (t) =>
        t.ticketCode.toUpperCase() === ticketCode &&
        phonesMatch(t.customerPhone, customerPhone)
    );

    if (!found) {
      return res.status(404).json({
        error: "تعذر العثور على طلب مطابق لبيانات التحقق المدخلة. تأكد من الرقم المرجعي ورقم الجوال.",
      });
    }

    return res.json({
      ok: true,
      ticket: redactTicketForCustomer(found),
    });
  });

  app.post("/api/portal/complaints/:ticketCode/customer-action", (req, res) => {
    const ticketCode = String(req.params.ticketCode || "").trim().toUpperCase();
    const customerPhone = String(req.body?.customerPhone || "").trim();
    const action = String(req.body?.action || "").trim() as PendingPortalAction["action"];
    const note = String(req.body?.note || "").trim().slice(0, 400);
    const csatScore = Number(req.body?.csatScore || 0);
    const csatComment = String(req.body?.csatComment || "").trim().slice(0, 400);

    if (!["add_info", "request_agent", "confirm_resolved", "reopen"].includes(action)) {
      return res.status(400).json({ error: "الإجراء المطلوب غير صالح." });
    }

    const idx = portalStore.syncedTickets.findIndex(
      (t) =>
        t.ticketCode.toUpperCase() === ticketCode &&
        phonesMatch(t.customerPhone, customerPhone)
    );

    if (idx === -1) {
      return res.status(404).json({
        error: "فشل التحقق الثنائي من الرقم المرجعي ورقم الجوال.",
      });
    }

    const ticket = portalStore.syncedTickets[idx];
    const nowIso = new Date().toISOString();

    if (action === "add_info") {
      if (!note) return res.status(400).json({ error: "يرجى كتابة المعلومات الإضافية." });
      ticket.publicUpdateNote = `تمت إضافة إفادة العميل: ${note}`;
      if (ticket.status === "waiting_customer") {
        ticket.status = "in_progress";
      }
      ticket.customerTimeline.push({ timestamp: nowIso, label: "أضاف العميل معلومات إضافية" });
    } else if (action === "request_agent") {
      ticket.publicUpdateNote = "تم تسجيل طلب العميل للتواصل مع موظف خدمة العملاء المختص.";
      ticket.customerTimeline.push({ timestamp: nowIso, label: "طلب العميل التحدث مع موظف مختص" });
    } else if (action === "confirm_resolved") {
      ticket.customerConfirmed = true;
      ticket.status = "closed";
      if (csatScore >= 1 && csatScore <= 5) {
        ticket.csatScore = Math.round(csatScore);
      }
      if (csatComment) {
        ticket.csatComment = csatComment;
      }
      ticket.publicUpdateNote = "أكد العميل الحل وتم إغلاق الشكوى بنجاح.";
      ticket.customerTimeline.push({
        timestamp: nowIso,
        label: `أكد العميل الحل${ticket.csatScore ? ` (تقييم ${ticket.csatScore}/5)` : ""}`,
      });
    } else if (action === "reopen") {
      if (!note) {
        return res.status(400).json({ error: "يرجى توضيح سبب إعادة فتح الشكوى." });
      }
      ticket.previousSolution = ticket.resolutionEvidence || ticket.publicUpdateNote;
      ticket.reopenCount = (ticket.reopenCount || 0) + 1;
      ticket.reopenReason = note;
      ticket.status = "reopened";
      ticket.customerConfirmed = false;
      ticket.publicUpdateNote = `تمت إعادة فتح الطلب بناءً على إفادة العميل: ${note}`;
      ticket.customerTimeline.push({ timestamp: nowIso, label: "أعاد العميل فتح الشكوى (المشكلة مستمرة)" });
    }

    ticket.updatedAtIso = nowIso;
    portalStore.syncedTickets[idx] = ticket;
    portalStore.pendingActions.push({
      id: `pact_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      ticketCode: ticket.ticketCode,
      action,
      note,
      csatScore: csatScore >= 1 && csatScore <= 5 ? Math.round(csatScore) : undefined,
      csatComment: csatComment || undefined,
      createdAtIso: nowIso,
    });
    savePortalStore(portalStore);

    return res.json({
      ok: true,
      ticket: redactTicketForCustomer(ticket),
    });
  });

  app.post("/api/portal/sync", (req, res) => {
    const incomingList = Array.isArray(req.body?.tickets) ? req.body.tickets : [];
    const incomingMap = new Map<string, PortalTicketRecord>();
    for (const raw of incomingList) {
      if (raw && typeof raw.ticketCode === "string") {
        incomingMap.set(raw.ticketCode.toUpperCase(), raw as PortalTicketRecord);
      }
    }

    // Preserve un-committed portal creates
    const pendingCodes = new Set(portalStore.pendingCreates.map((c) => c.ticketCode.toUpperCase()));
    const merged: PortalTicketRecord[] = [];
    for (const existing of portalStore.syncedTickets) {
      if (pendingCodes.has(existing.ticketCode.toUpperCase()) && !incomingMap.has(existing.ticketCode.toUpperCase())) {
        merged.push(existing);
      }
    }
    for (const item of incomingMap.values()) {
      merged.push(item);
    }

    portalStore.syncedTickets = merged.slice(0, 500);
    savePortalStore(portalStore);
    return res.json({
      ok: true,
      pendingCreates: portalStore.pendingCreates,
      pendingActions: portalStore.pendingActions,
    });
  });

  app.get("/api/portal/pending-sync", (_req, res) => {
    return res.json({
      ok: true,
      pendingCreates: portalStore.pendingCreates,
      pendingActions: portalStore.pendingActions,
    });
  });

  app.post("/api/portal/pending-sync/ack", (req, res) => {
    const createIds = new Set(Array.isArray(req.body?.createIds) ? req.body.createIds : []);
    const actionIds = new Set(Array.isArray(req.body?.actionIds) ? req.body.actionIds : []);

    portalStore.pendingCreates = portalStore.pendingCreates.filter((c) => !createIds.has(c.id));
    portalStore.pendingActions = portalStore.pendingActions.filter((a) => !actionIds.has(a.id));
    savePortalStore(portalStore);

    return res.json({ ok: true });
  });

  // Recent webhook inspection endpoint
  app.get("/api/webhooks/events", (_req, res) => {
    res.json({ events: recentWebhookEvents.slice(0, 20) });
  });

  // WhatsApp Business Cloud API Verification Challenge
  app.get("/api/webhooks/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && typeof challenge === "string") {
      return res.status(200).send(challenge);
    }
    return res.json({
      status: "ready",
      provider: "WhatsApp Cloud API / Twilio Webhook",
      company: "شركة فنار الطاقة للوقود",
    });
  });

  const DEFAULT_BOT_KNOWLEDGE = {
    botName: "مساعد فنار الذكي",
    officialWhatsappNumber: "00966559144745",
    welcomeMessage:
      "أهلاً بكم في خدمة عملاء شركة فنار الطاقة للوقود عبر واتساب. يسعدني مساعدتكم في الاستفسار عن منتجاتنا، خدمات المحطات، أوقات العمل، متابعة حالة طلباتكم، أو تسجيل أي ملاحظة.",
    toneInstruction:
      "تحدث بعربية سعودية مهنية ولطيفة ومختصرة. اعتمد على بيانات قاعدة المعرفة المعتمدة فقط، وإذا تعذرت الإجابة أو كانت الشكوى معقدة/حساسة أو طلب العميل موظفاً بشرياً فقم بتحويل المحادثة فوراً مع حفظ السجل.",
    autoEscalateComplex: true,
    escalationMessage:
      "نقدّر تواصلكم معنا. تم تحويل محادثتكم وكامل السجل الآن إلى أحد موظفي خدمة العملاء المختصين في شركة فنار الطاقة للوقود لمباشرة خدمتكم والرد عليكم في أقرب وقت.",
    productsInfo:
      "بنزين 91، بنزين 95، الديزل النظيف للشاحنات، زيوت المحركات المعتمدة، وبطاقات وقود الأساطيل للشركات.",
    servicesInfo:
      "تعبئة الوقود والدفع الإلكتروني (مدى، Apple Pay، فيزا، بطاقات الأساطيل)، غسيل السيارات، تبديل الزيوت السريع، تموينات فنار، والمصليات ودورات المياه.",
    workingHoursSummary:
      `مضخات الوقود والتموينات تعمل 24 ساعة طوال أيام الأسبوع بما فيها الجمعة. الرقم الموحد للشركة: ${FANAR_COMPANY_INFO.unifiedPhone} — المقر الرئيسي: ${FANAR_COMPANY_INFO.city} (الرمز البريدي ${FANAR_COMPANY_INFO.postalCode}).`,
    branchesInfo: FANAR_STATIONS.map((st) => `${st.label} | هاتف: ${st.phone} | ${st.operationType}`).join("\n"),
    faqs: [] as Array<{ question?: string; answer?: string; enabled?: boolean; category?: string }>,
  };

  // Incoming WhatsApp Webhook Receiver
  app.post("/api/webhooks/whatsapp", async (req, res) => {
    try {
      const from = String(req.body?.from || req.body?.sender || "+966500000000");
      const text = String(req.body?.text || req.body?.body || "").trim();
      if (!text) {
        return res.status(400).json({ error: "نص الرسالة مطلوب" });
      }

      const aiResponse = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: `
رسالة واردة عبر واتساب من الرقم ${from}: "${text}"

قاعدة المعرفة المعتمدة لشركة فنار الطاقة للوقود:
- رقم الواتساب الرسمي للشركة: ${DEFAULT_BOT_KNOWLEDGE.officialWhatsappNumber}
- المنتجات: ${DEFAULT_BOT_KNOWLEDGE.productsInfo}
- الخدمات: ${DEFAULT_BOT_KNOWLEDGE.servicesInfo}
- أوقات العمل: ${DEFAULT_BOT_KNOWLEDGE.workingHoursSummary}
- الفروع: ${DEFAULT_BOT_KNOWLEDGE.branchesInfo}
`,
        config: {
          systemInstruction:
            "أنت مساعد خدمة العملاء الذكي الرسمي لشركة فنار الطاقة للوقود عبر واتساب. أجب على الأسئلة الشائعة بدقة من قاعدة المعرفة، واكتشف نية الرسالة وما إذا كانت تتطلب تحويلاً تلقائياً لموظف خدمة العملاء.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              intent: {
                type: Type.STRING,
                enum: ["greeting", "faq", "order_status", "complaint", "escalation"],
              },
              isComplaint: { type: Type.BOOLEAN },
              shouldEscalate: { type: Type.BOOLEAN },
              escalationRule: {
                type: Type.STRING,
                enum: ["none", "explicit_request", "missing_knowledge", "sensitive_case", "repeated_failure", "angry_or_reopen"],
              },
              escalationReason: { type: Type.STRING },
              category: { type: Type.STRING },
            },
            required: ["reply", "intent", "isComplaint", "shouldEscalate", "escalationRule", "escalationReason", "category"],
          },
        },
      });

      const parsed = JSON.parse(aiResponse.text || "{}");
      recentWebhookEvents.unshift({
        id: `wh_${Date.now()}`,
        source: "whatsapp",
        receivedAt: new Date().toISOString(),
        from,
        summary: text.slice(0, 120),
        aiReply: parsed.reply || "",
      });

      return res.json({ ok: true, ...parsed });
    } catch (error) {
      const message = error instanceof Error ? error.message : "خطأ غير متوقع في معالجة الواتساب";
      return res.status(500).json({ error: message });
    }
  });

  // Incoming Call Webhook Receiver
  app.post("/api/webhooks/calls", async (req, res) => {
    try {
      const from = String(req.body?.from || req.body?.caller || "+966500000000");
      const speech = String(req.body?.speech || req.body?.transcript || "").trim();
      if (!speech) {
        return res.status(400).json({ error: "نص المكالمة مطلوب" });
      }

      const aiResponse = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: `مكالمة هاتفية واردة من ${from}: "${speech}"`,
        config: {
          systemInstruction:
            "أنت نظام الرد الآلي الهاتفي الذكي لشركة فنار الطاقة للوقود. رحب بالمتصل باقتضاب ووضوح واستلم شكواه لتسجيلها وإرسال رمزها عبر الواتساب.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              spokenReply: { type: Type.STRING },
              isComplaint: { type: Type.BOOLEAN },
            },
            required: ["spokenReply", "isComplaint"],
          },
        },
      });

      const parsed = JSON.parse(aiResponse.text || "{}");
      recentWebhookEvents.unshift({
        id: `call_${Date.now()}`,
        source: "calls",
        receivedAt: new Date().toISOString(),
        from,
        summary: speech.slice(0, 120),
        aiReply: parsed.spokenReply || "",
      });

      return res.json({ ok: true, ...parsed });
    } catch (error) {
      const message = error instanceof Error ? error.message : "خطأ غير متوقع في معالجة المكالمة";
      return res.status(500).json({ error: message });
    }
  });

  // AI WhatsApp Chatbot: FAQs, Order Status Lookup, Complaint Extraction & 5-Rule Auto-Escalation
  app.post("/api/ai/whatsapp-reply", async (req, res) => {
    try {
      const {
        customerName = "عميلنا العزيز",
        customerPhone = "",
        history = [],
        incomingMessage = "",
        existingTicketCode = "",
        branches = FANAR_BRANCHES,
        botConfig = {},
        customerOrders = [],
        consecutiveFailures = 0,
      } = req.body || {};

      if (!incomingMessage || typeof incomingMessage !== "string") {
        return res.status(400).json({ error: "يرجى إدخال نص رسالة العميل" });
      }

      const activeBot = {
        ...DEFAULT_BOT_KNOWLEDGE,
        ...(typeof botConfig === "object" && botConfig ? botConfig : {}),
      };

      const enabledFaqs = Array.isArray(activeBot.faqs)
        ? activeBot.faqs
            .filter((f: { enabled?: boolean; question?: string; answer?: string }) => f && f.enabled !== false && f.question && f.answer)
            .slice(0, 30)
            .map(
              (f: { question?: string; answer?: string; category?: string }, i: number) =>
                `${i + 1}. س: ${f.question}\n   ج: ${f.answer}`
            )
            .join("\n")
        : "";

      const ordersContext = Array.isArray(customerOrders) && customerOrders.length > 0
        ? customerOrders
            .slice(0, 10)
            .map(
              (o: {
                ticketCode?: string;
                statusLabel?: string;
                branch?: string;
                priorityLabel?: string;
                aiSummary?: string;
                closureReason?: string;
                createdAtLabel?: string;
              }) =>
                `- الرمز: ${o.ticketCode} | الحالة: ${o.statusLabel} | الأولوية: ${o.priorityLabel || "عادية"} | الفرع: ${o.branch} | التاريخ: ${o.createdAtLabel || ""} | الملخص: ${o.aiSummary || ""}${
                  o.closureReason ? ` | قرار الإغلاق: ${o.closureReason}` : ""
                }`
            )
            .join("\n")
        : "لا توجد طلبات أو شكاوى مسجلة مطابقة لرقم الجوال أو الرمز في السجل حالياً.";

      const historyText = Array.isArray(history)
        ? history
            .slice(-14)
            .map(
              (m: { sender?: string; body?: string }) =>
                `${m.sender === "customer" ? "العميل" : "فنار"}: ${m.body || ""}`
            )
            .join("\n")
        : "";

      const prompt = `
هوية الروبوت ونبرته:
- اسم الروبوت: ${activeBot.botName}
- رقم الواتساب الرسمي للشركة: ${activeBot.officialWhatsappNumber}
- الرسالة الترحيبية المرجعية: ${activeBot.welcomeMessage}
- تعليمات الأسلوب: ${activeBot.toneInstruction}
- التحويل التلقائي للحالات المعقدة أو غير المجابة: ${activeBot.autoEscalateComplex ? "مفعّل" : "معطّل"}
- نص رسالة التحويل المعتمد: ${activeBot.escalationMessage}
- عدد مرات تعثر البوت السابقة في هذه المحادثة: ${Number(consecutiveFailures) || 0}

بيانات العميل الحالي:
- الاسم: ${customerName}
- الجوال: ${customerPhone}
- رمز شكوى مرتبط بالمحادثة (إن وجد): ${existingTicketCode || "لا يوجد"}

قاعدة معرفة شركة فنار الطاقة للوقود:
[المنتجات]
${activeBot.productsInfo}

[الخدمات]
${activeBot.servicesInfo}

[أوقات العمل]
${activeBot.workingHoursSummary}

[الفروع المعتمدة]
${activeBot.branchesInfo || branches.join("\n")}

[الأسئلة الشائعة المعتمدة]
${enabledFaqs || "(لا توجد أسئلة إضافية)"}

سجل الطلبات والشكاوى الفعلية للعميل (للاستعلام فقط، لا تفصح عن ملاحظات داخلية):
${ordersContext}

سجل المحادثة السابق:
${historyText || "(بداية محادثة جديدة)"}

رسالة العميل الجديدة:
"${incomingMessage}"

قواعد اتخاذ القرار والتحويل الذكية الخمس الصارمة:
1. صنّف نية الرسالة (intent):
   - "greeting": تحية فقط -> رحب به (shouldCreateComplaint=false, shouldEscalate=false, escalationRule="none").
   - "faq": استفسار عن المنتجات أو الخدمات أو أوقات العمل أو الفروع -> أجب بدقة من قاعدة المعرفة فقط دون اختلاق.
   - "order_status": استعلام عن حالة طلب أو شكوى -> ابحث في سجل الطلبات أعلاه واعرض الحالة الرسمية والفرع فقط.
   - "complaint": بلاغ أو شكوى جديدة واضحة (جودة وقود، فارق فوترة، مضخة، نظافة، موظف، بطاقة أسطول) -> اجعل shouldCreateComplaint = true (بشرط ألا تكون متابعة لنفس existingTicketCode).
   - "escalation": يتطلب تحويلاً لموظف خدمة العملاء.
2. قواعد التحويل الخمس الإلزامية (escalationRule):
   - "explicit_request": العميل يطلب صراحة التحدث مع موظف بشري أو مشرف.
   - "missing_knowledge": السؤال خارج قاعدة المعرفة ولا توجد إجابة موثقة (confidence="low").
   - "sensitive_case": قضية حساسة (سلامة عامة، تسرب وقود، عطل مركبة، جودة وقود مع تلف، تعويض مالي، تهديد قانوني/إعلامي، خصوصية بيانات).
   - "repeated_failure": إذا كان عدد مرات التعثر السابقة >= 1 وما زالت الإجابة غير واضحة أو لم يُحل الطلب.
   - "angry_or_reopen": أسلوب غاضب/متذمر حاد أو طلب إعادة فتح شكوى مغلقة/محلولة.
   - "none": لا ينطبق أي سبب تحويل.
   عند تحقق أي من القواعد الخمس (غير "none"): فعّل shouldEscalate = true (إذا كان التحويل التلقائي مفعلاً أو كان طلباً صريحاً/حالة حساسة)، واكتب سبباً واضحاً في escalationReason، وملخصاً انتقالياً للموظف في handoffSummary.
`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          systemInstruction: `أنت ${activeBot.botName}، المساعد الذكي المعتمد لخدمة العملاء في شركة فنار الطاقة للوقود (FANAR) عبر الواتساب. تلتزم بالرد الدقيق من قاعدة المعرفة وسجل الطلبات الحقيقي، وتطبّق قواعد التحويل الذكية الخمس للموظف البشري مع نقل الملخص والسياق الكامل.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: "نص الرد المرسل للعميل عبر الواتساب باللغة العربية",
              },
              intent: {
                type: Type.STRING,
                enum: ["greeting", "faq", "order_status", "complaint", "escalation"],
              },
              confidence: {
                type: Type.STRING,
                enum: ["high", "medium", "low"],
              },
              shouldEscalate: {
                type: Type.BOOLEAN,
                description: "هل يجب تحويل المحادثة تلقائياً لموظف خدمة العملاء وإيقاف الرد الآلي",
              },
              escalationRule: {
                type: Type.STRING,
                enum: [
                  "none",
                  "explicit_request",
                  "missing_knowledge",
                  "sensitive_case",
                  "repeated_failure",
                  "angry_or_reopen",
                ],
                description: "رمز القاعدة المطبقة من قواعد التحويل الخمس",
              },
              escalationReason: {
                type: Type.STRING,
                description: "سبب التحويل المختصر بالعربية لموظف خدمة العملاء، أو نص فارغ إذا لم يتحول",
              },
              handoffSummary: {
                type: Type.STRING,
                description: "ملخص سياقي موجز ينتقل للموظف المستلم لعدم سؤال العميل من جديد",
              },
              shouldCreateComplaint: {
                type: Type.BOOLEAN,
                description: "هل يجب إنشاء تذكرة شكوى جديدة الآن",
              },
              needsManagerEscalation: {
                type: Type.BOOLEAN,
                description: "هل الشكوى حرجة وتستدعي تصعيداً فورياً لمدير خدمة العملاء",
              },
              extractedComplaint: {
                type: Type.OBJECT,
                properties: {
                  branch: {
                    type: Type.STRING,
                    description: "أقرب فرع محطة من قائمة فروع فنار أو غير محدد",
                  },
                  pumpNumber: {
                    type: Type.STRING,
                    description: "رقم المضخة إن ذُكر أو نص فارغ",
                  },
                  category: {
                    type: Type.STRING,
                    enum: [
                      "fuel_quality",
                      "billing_pump",
                      "cleanliness_facilities",
                      "staff_service",
                      "fleet_cards",
                      "other",
                    ],
                  },
                  priority: {
                    type: Type.STRING,
                    enum: ["normal", "high", "urgent"],
                  },
                  summary: {
                    type: Type.STRING,
                    description: "ملخص تنفيذي من سطر واحد للشكوى",
                  },
                  description: {
                    type: Type.STRING,
                    description: "وصف منظم ومكتمل للشكوى باللغة العربية",
                  },
                },
                required: [
                  "branch",
                  "pumpNumber",
                  "category",
                  "priority",
                  "summary",
                  "description",
                ],
              },
            },
            required: [
              "reply",
              "intent",
              "confidence",
              "shouldEscalate",
              "escalationRule",
              "escalationReason",
              "handoffSummary",
              "shouldCreateComplaint",
              "needsManagerEscalation",
              "extractedComplaint",
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text || "{}");

      // Server-side enforcement for Rule 4 (repeated_failure >= 2 consecutive turns)
      if (Number(consecutiveFailures) >= 1 && parsed.confidence === "low" && !parsed.shouldEscalate) {
        parsed.shouldEscalate = true;
        parsed.escalationRule = "repeated_failure";
        parsed.escalationReason = "تعثر المساعد الذكي في الفهم أو الحل لمرتين متتاليتين (القاعدة 4).";
        parsed.intent = "escalation";
        parsed.reply = activeBot.escalationMessage;
      }

      return res.json(parsed);
    } catch (error) {
      console.error("Gemini WhatsApp Error:", error);
      const message =
        error instanceof Error ? error.message : "تعذر الاتصال بمحرك الذكاء الاصطناعي";
      return res.status(500).json({ error: message });
    }
  });

  // AI Voice Call / IVR Handler
  app.post("/api/ai/call-respond", async (req, res) => {
    try {
      const {
        callerName = "المتصل",
        callerPhone = "",
        history = [],
        callerSpeech = "",
        existingTicketCode = "",
        branches = FANAR_BRANCHES,
      } = req.body || {};

      if (!callerSpeech || typeof callerSpeech !== "string") {
        return res.status(400).json({ error: "يرجى إدخال نص حديث المتصل" });
      }

      const historyText = Array.isArray(history)
        ? history
            .slice(-10)
            .map(
              (turn: { role?: string; text?: string }) =>
                `${turn.role === "caller" ? "المتصل" : "الرد الآلي"}: ${turn.text || ""}`
            )
            .join("\n")
        : "";

      const prompt = `
بيانات المتصل:
- الاسم: ${callerName}
- رقم المتصل: ${callerPhone}
- رمز شكوى مسجل في هذه المكالمة: ${existingTicketCode || "لا يوجد بعد"}

فروع محطات فنار:
${branches.join("\n")}

نص المكالمة السابق:
${historyText || "(بداية المكالمة - الرد الترحيبي)"}

ما قاله المتصل الآن:
"${callerSpeech}"

المطلوب:
- قدّم رداً صوتياً طبيعياً ومختصراً (2-3 جمل واضحة بدون رموز نقطية أو تنسيق ماركداون) بصفتك نظام الرد الهاتفي الذكي لشركة فنار الطاقة للوقود.
- إذا طرح المتصل شكوى واضحة ولم يُسجل رمز بعد، فعّل shouldCreateComplaint = true وأخبره أن الشكوى سُجلت وسيصله رمز الشكوى فوراً على الواتساب الخاص برقمه.
- إذا طلب المتصل إنهاء المكالمة أو شكر بعد استلام الرمز، فعّل shouldEndCall = true.
`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          systemInstruction:
            "أنت نظام الاستقبال والرد الصوتي الذكي لشركة فنار الطاقة للوقود. تحدث بعربية فصحى سلسة ومهنية ومناسبة للمكالمات الهاتفية دون رموز أو نجوم.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              spokenReply: { type: Type.STRING },
              shouldCreateComplaint: { type: Type.BOOLEAN },
              shouldEndCall: { type: Type.BOOLEAN },
              callSummary: { type: Type.STRING },
              extractedComplaint: {
                type: Type.OBJECT,
                properties: {
                  branch: { type: Type.STRING },
                  pumpNumber: { type: Type.STRING },
                  category: {
                    type: Type.STRING,
                    enum: [
                      "fuel_quality",
                      "billing_pump",
                      "cleanliness_facilities",
                      "staff_service",
                      "fleet_cards",
                      "other",
                    ],
                  },
                  priority: {
                    type: Type.STRING,
                    enum: ["normal", "high", "urgent"],
                  },
                  summary: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: [
                  "branch",
                  "pumpNumber",
                  "category",
                  "priority",
                  "summary",
                  "description",
                ],
              },
            },
            required: [
              "spokenReply",
              "shouldCreateComplaint",
              "shouldEndCall",
              "callSummary",
              "extractedComplaint",
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      return res.json(parsed);
    } catch (error) {
      console.error("Gemini Call Error:", error);
      const message =
        error instanceof Error ? error.message : "تعذر معالجة المكالمة عبر الذكاء الاصطناعي";
      return res.status(500).json({ error: message });
    }
  });

  // Gemini TTS for AI Call Voice Response
  app.post("/api/ai/tts", async (req, res) => {
    try {
      const { text } = req.body || {};
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "النص مطلوب للتحويل الصوتي" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash-lite-tts",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: text.slice(0, 600),
                speechMetadata: {
                  style: "Clear, polite, reassuring Arabic customer service representative",
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        return res.status(502).json({ error: "لم يتم استلام مخرج صوتي من النموذج" });
      }

      return res.json({
        audioBase64: base64Audio,
        mimeType: "audio/wav",
      });
    } catch (error) {
      console.error("Gemini TTS Error:", error);
      const message =
        error instanceof Error ? error.message : "تعذر توليد الصوت عبر Gemini TTS";
      return res.status(500).json({ error: message });
    }
  });

  // Vite middleware in dev / static build in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Fanar Energy Fuel CRM running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
