import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";
import {
  ActionPlanItem,
  ALLOWED_STATUS_TRANSITIONS,
  AuditEntry,
  BOT_FIELD_LIMITS,
  BotFaqItem,
  BotIntent,
  calculateWeightedQualityScore,
  Complaint,
  ComplaintAttachmentMeta,
  ComplaintCategory,
  ComplaintChannel,
  ComplaintPriority,
  ComplaintStatus,
  Conversation,
  Customer,
  CustomerSegment,
  DEFAULT_WHATSAPP_BOT_CONFIG,
  EscalationRuleKey,
  FANAR_BRANCHES,
  FIELD_LIMITS,
  generateTicketCode,
  HandoffStatus,
  OFFICIAL_WHATSAPP_NUMBER,
  QualityAudit,
  resolveComplaintSlaTier,
  SlaTier,
  UNKNOWN_BRANCH_LABEL,
  UserProfile,
  UserRole,
  WhatsappBotConfig,
} from "../types/crm";

function clampStr(val: string | undefined | null, max: number, fallback = ""): string {
  const clean = (val ?? "").trim();
  if (!clean) return fallback;
  return clean.slice(0, max);
}

function makeAuditEntry(params: {
  actorName: string;
  actorRole: string;
  fromStatus: string;
  toStatus: string;
  action: string;
  note: string;
}): AuditEntry {
  return {
    id: `aud_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    actorName: clampStr(params.actorName, 100, "النظام"),
    actorRole: clampStr(params.actorRole, 64, "agent"),
    fromStatus: clampStr(params.fromStatus, 40, ""),
    toStatus: clampStr(params.toStatus, 40, "new"),
    action: clampStr(params.action, 120, "تحديث"),
    note: clampStr(params.note, 600, ""),
  };
}

function appendAuditTrail(
  existingTrail: AuditEntry[] | undefined,
  nextEntry: AuditEntry
): AuditEntry[] {
  const current = Array.isArray(existingTrail) ? existingTrail : [];
  return [...current, nextEntry].slice(-FIELD_LIMITS.AUDIT_MAX_ENTRIES);
}

export function buildWhatsappTicketMessage(
  customerName: string,
  ticketCode: string,
  branch: string,
  summary: string,
  officialWhatsappNumber = OFFICIAL_WHATSAPP_NUMBER
): string {
  return [
    `مرحباً ${customerName}،`,
    `تم تسجيل بلاغكم لدى شركة فنار الطاقة للوقود بنجاح.`,
    `رمز الشكوى الرسمي: ${ticketCode}`,
    `المحطة: ${branch}`,
    summary ? `ملخص البلاغ: ${summary}` : "",
    `يمكنكم متابعة حالة الطلب بهذا الرمز عبر بوابة العميل أو واتساب خدمة العملاء الرسمي (${officialWhatsappNumber})، وسيصلكم إشعار فور مراجعة وإغلاق الشكوى.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildWhatsappClosureMessage(
  customerName: string,
  ticketCode: string,
  closureReason: string,
  managerNotes: string,
  officialWhatsappNumber = OFFICIAL_WHATSAPP_NUMBER
): string {
  return [
    `عزيزي ${customerName}،`,
    `نفيدكم بأنه تم إغلاق الشكوى رقم (${ticketCode}) من قِبل مدير خدمة العملاء في شركة فنار الطاقة للوقود.`,
    `قرار المعالجة: ${closureReason}`,
    managerNotes ? `ملاحظات الإدارة: ${managerNotes}` : "",
    `نشكركم على ثقتكم بمحطات فنار ونسعد بتواصلكم الدائم عبر واتسابنا الرسمي (${officialWhatsappNumber}).`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function ensureUserProfile(params: {
  uid: string;
  displayName: string;
  email: string;
  isBootstrappedAdmin: boolean;
}): Promise<UserProfile> {
  const userRef = doc(db, "users", params.uid);
  try {
    const q = query(collection(db, "users"), where("uid", "==", params.uid), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as UserProfile;
    }

    const profile: UserProfile = {
      uid: params.uid,
      displayName: clampStr(params.displayName, 100, "موظف فنار"),
      email: clampStr(params.email, 150, "staff@fanarenergy.sa"),
      role: params.isBootstrappedAdmin ? "system_admin" : "agent",
      branch: FANAR_BRANCHES[0],
    };

    await setDoc(userRef, {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return profile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${params.uid}`);
  }
}

export async function updateUserRoleProfile(params: {
  uid: string;
  displayName: string;
  role: UserRole;
  branch: string;
}): Promise<void> {
  try {
    await updateDoc(doc(db, "users", params.uid), {
      displayName: clampStr(params.displayName, 100, "موظف فنار"),
      role: params.role,
      branch: clampStr(params.branch, 100, FANAR_BRANCHES[0]),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${params.uid}`);
  }
}

export async function saveWhatsappBotConfig(params: {
  ownerId: string;
  updatedBy: string;
  config: Omit<WhatsappBotConfig, "ownerId" | "updatedBy" | "createdAt" | "updatedAt">;
}): Promise<void> {
  const docRef = doc(db, "bot_configs", params.ownerId);
  try {
    const cleanFaqs: BotFaqItem[] = (params.config.faqs || [])
      .slice(0, BOT_FIELD_LIMITS.MAX_FAQS)
      .filter((f) => f.question.trim() && f.answer.trim())
      .map((f, index) => ({
        id: clampStr(f.id, 64, `faq-${index + 1}`),
        question: clampStr(f.question, BOT_FIELD_LIMITS.FAQ_QUESTION_MAX, "سؤال شائع"),
        answer: clampStr(f.answer, BOT_FIELD_LIMITS.FAQ_ANSWER_MAX, "إجابة معتمدة"),
        category: ["products", "services", "hours", "orders", "general"].includes(f.category)
          ? f.category
          : "general",
        enabled: Boolean(f.enabled),
      }));

    const existingSnap = await getDoc(docRef);
    const payload = {
      ownerId: params.ownerId,
      botName: clampStr(
        params.config.botName,
        BOT_FIELD_LIMITS.BOT_NAME_MAX,
        DEFAULT_WHATSAPP_BOT_CONFIG.botName
      ),
      officialWhatsappNumber: clampStr(
        params.config.officialWhatsappNumber,
        BOT_FIELD_LIMITS.OFFICIAL_WHATSAPP_MAX,
        DEFAULT_WHATSAPP_BOT_CONFIG.officialWhatsappNumber
      ),
      welcomeMessage: clampStr(
        params.config.welcomeMessage,
        BOT_FIELD_LIMITS.WELCOME_MAX,
        DEFAULT_WHATSAPP_BOT_CONFIG.welcomeMessage
      ),
      toneInstruction: clampStr(
        params.config.toneInstruction,
        BOT_FIELD_LIMITS.TONE_MAX,
        DEFAULT_WHATSAPP_BOT_CONFIG.toneInstruction
      ),
      autoEscalateComplex: Boolean(params.config.autoEscalateComplex),
      escalationMessage: clampStr(
        params.config.escalationMessage,
        BOT_FIELD_LIMITS.ESCALATION_MSG_MAX,
        DEFAULT_WHATSAPP_BOT_CONFIG.escalationMessage
      ),
      workingHoursSummary: clampStr(
        params.config.workingHoursSummary,
        BOT_FIELD_LIMITS.HOURS_MAX,
        DEFAULT_WHATSAPP_BOT_CONFIG.workingHoursSummary
      ),
      productsInfo: clampStr(
        params.config.productsInfo,
        BOT_FIELD_LIMITS.PRODUCTS_MAX,
        DEFAULT_WHATSAPP_BOT_CONFIG.productsInfo
      ),
      servicesInfo: clampStr(
        params.config.servicesInfo,
        BOT_FIELD_LIMITS.SERVICES_MAX,
        DEFAULT_WHATSAPP_BOT_CONFIG.servicesInfo
      ),
      branchesInfo: clampStr(
        params.config.branchesInfo,
        BOT_FIELD_LIMITS.BRANCHES_MAX,
        DEFAULT_WHATSAPP_BOT_CONFIG.branchesInfo
      ),
      faqs: cleanFaqs,
      updatedBy: clampStr(params.updatedBy, 120, "مدير النظام"),
      updatedAt: serverTimestamp(),
    };

    if (existingSnap.exists()) {
      await updateDoc(docRef, payload);
    } else {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `bot_configs/${params.ownerId}`);
  }
}

export async function seedEnrichedMultiMonthData(
  ownerId: string,
  agentName: string,
  canCloseAsManager: boolean
): Promise<boolean> {
  try {
    const existingAudits = await getDocs(
      query(collection(db, "quality_audits"), where("ownerId", "==", ownerId), limit(1))
    );
    const existingPlans = await getDocs(
      query(collection(db, "action_plans"), where("ownerId", "==", ownerId), limit(1))
    );
    const existingComps = await getDocs(
      query(collection(db, "complaints"), where("ownerId", "==", ownerId), limit(6))
    );
    if (!existingAudits.empty && !existingPlans.empty && existingComps.size >= 6) {
      return false;
    }

    const batch = writeBatch(db);
    const ts = serverTimestamp();
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const daysAgoTs = (days: number, extraHours = 0) =>
      Timestamp.fromDate(new Date(now.getTime() - days * 86400000 + extraHours * 3600000));

    // Create 6 customers covering segments & repeat customer pattern across Fanar regions
    const seedCustomers = [
      { name: "سلطان بن عبدالله القحطاني", phone: "+966554128901", city: "وادي الدواسر", branch: FANAR_BRANCHES[1], segment: "individual" as CustomerSegment, total: 2 },
      { name: "شركة المسار اللوجستي للنقليات", phone: "+966509873210", city: "جيزان", branch: FANAR_BRANCHES[12], segment: "fleet" as CustomerSegment, total: 3 },
      { name: "فهد بن ناصر الدوسري", phone: "+966543219876", city: "حفر الباطن", branch: FANAR_BRANCHES[13], segment: "individual" as CustomerSegment, total: 2 },
      { name: "نورة بنت خالد الحربي", phone: "+966561123490", city: "تبوك", branch: FANAR_BRANCHES[5], segment: "individual" as CustomerSegment, total: 2 },
      { name: "مؤسسة الأفق للنقل التجاري", phone: "+966558899112", city: "شرورة", branch: FANAR_BRANCHES[16], segment: "corporate" as CustomerSegment, total: 3 },
      { name: "خالد بن سعد الشمري", phone: "+966501144778", city: "وادي الدواسر", branch: FANAR_BRANCHES[0], segment: "individual" as CustomerSegment, total: 2 },
    ];

    const custRefs = seedCustomers.map(() => doc(collection(db, "customers")));
    seedCustomers.forEach((c, idx) => {
      batch.set(custRefs[idx], {
        name: c.name,
        phone: c.phone,
        city: c.city,
        preferredBranch: c.branch,
        segment: c.segment,
        totalComplaints: c.total,
        ownerId,
        createdAt: ts,
        updatedAt: ts,
      });
    });

    const historicalSpecs: Array<{
      code: string;
      custIdx: number;
      branch: string;
      stationUnknown?: boolean;
      pump: string;
      category: ComplaintCategory;
      channel: ComplaintChannel;
      priority: ComplaintPriority;
      slaTier: SlaTier;
      status: ComplaintStatus;
      desc: string;
      summary: string;
      daysAgo: number;
      firstRespMins: number;
      resolveHours: number;
      csat?: number;
      confirmed?: boolean;
      closure?: string;
    }> = [
      // Month -5
      {
        code: "FNR-2606-1102", custIdx: 0, branch: FANAR_BRANCHES[1], pump: "مضخة 2",
        category: "billing_pump", channel: "whatsapp", priority: "high", slaTier: "P2",
        status: canCloseAsManager ? "closed" : "resolved",
        desc: "تكرار خصم مبلغ تعبئة وقود 91 في محطة السلطان (ST-002) عبر شبكة مدى.",
        summary: "استرداد فارق خصم مكرر بنجاح في محطة السلطان ST-002.",
        daysAgo: 152, firstRespMins: 18, resolveHours: 5.5, csat: 5, confirmed: true,
        closure: "تعويض العميل / تسوية الفاتورة",
      },
      {
        code: "FNR-2606-1114", custIdx: 1, branch: FANAR_BRANCHES[12], pump: "مضخة الديزل 1",
        category: "fleet_cards", channel: "phone", priority: "high", slaTier: "P2",
        status: canCloseAsManager ? "closed" : "resolved",
        desc: "تأخر تفعيل بطاقة الأسطول لثلاث شاحنات في محطة المحمدية (ST-019) فترة الفجر.",
        summary: "تحديث برمجة قارئ البطاقات بفرع المحمدية ST-019.",
        daysAgo: 146, firstRespMins: 22, resolveHours: 7, csat: 4, confirmed: true,
        closure: "تمت المعالجة والحل مع العميل",
      },
      // Month -4
      {
        code: "FNR-2607-2041", custIdx: 2, branch: FANAR_BRANCHES[13], pump: "المرافق",
        category: "cleanliness_facilities", channel: "portal", priority: "normal", slaTier: "P3",
        status: canCloseAsManager ? "closed" : "resolved",
        desc: "انقطاع المياه عن دورات المياه في محطة الكربي حفر الباطن (ST-021) لساعتين.",
        summary: "إصلاح مضخة المياه الاحتياطية بمحطة الكربي ST-021.",
        daysAgo: 120, firstRespMins: 35, resolveHours: 11, csat: 4, confirmed: true,
        closure: "إجراء تصحيحي لمضخات / مرافق المحطة",
      },
      {
        code: "FNR-2607-2058", custIdx: 4, branch: FANAR_BRANCHES[16], pump: "مضخة 5",
        category: "staff_service", channel: "whatsapp", priority: "normal", slaTier: "P3",
        status: canCloseAsManager ? "closed" : "resolved",
        desc: "ملاحظة على سرعة الاستجابة في محطة الجوهرة بشرورة (ST-027) أثناء الذروة الصباحية.",
        summary: "توزيع جدول مناوبات إضافي للمضخات في ST-027.",
        daysAgo: 112, firstRespMins: 28, resolveHours: 14, csat: 5, confirmed: true,
        closure: "توجيه وتدريب طاقم المحطة",
      },
      // Month -3
      {
        code: "FNR-2608-3011", custIdx: 3, branch: FANAR_BRANCHES[5], pump: "مضخة 3",
        category: "fuel_quality", channel: "phone", priority: "urgent", slaTier: "P1",
        status: canCloseAsManager ? "closed" : "resolved",
        desc: "اشتباه تذبذب قراءة العداد في محطة كوكبة غرناطة بتبوك (ST-006) عند مضخة 3.",
        summary: "فحص فوري لخزان 95 واعتماد معايير الجودة في ST-006.",
        daysAgo: 92, firstRespMins: 10, resolveHours: 3.5, csat: 5, confirmed: true,
        closure: "إجراء تصحيحي لمضخات / مرافق المحطة",
      },
      {
        code: "FNR-2608-3029", custIdx: 5, branch: FANAR_BRANCHES[0], pump: "مضخة 6",
        category: "billing_pump", channel: "portal", priority: "high", slaTier: "P2",
        status: canCloseAsManager ? "closed" : "resolved",
        desc: "عدم طباعة فاتورة ضريبية إلكترونية في محطة السلام (ST-001) بعد الدفع ببطاقة مدى.",
        summary: "إرسال الفاتورة الضريبية واستبدال رول الطابعة في ST-001.",
        daysAgo: 84, firstRespMins: 19, resolveHours: 6, csat: 4, confirmed: true,
        closure: "تمت المعالجة والحل مع العميل",
      },
      // Month -2
      {
        code: "FNR-2609-4005", custIdx: 1, branch: FANAR_BRANCHES[12], pump: "مضخة الديزل 3",
        category: "fleet_cards", channel: "whatsapp", priority: "high", slaTier: "P2",
        status: canCloseAsManager ? "closed" : "resolved",
        desc: "فشل قراءة شريحة NFC لبطاقة الأسطول على مضخة الديزل في محطة المحمدية (ST-019).",
        summary: "إعادة تفعيل البطاقة وإرسال كود التفويض.",
        daysAgo: 61, firstRespMins: 14, resolveHours: 4.5, csat: 5, confirmed: true,
        closure: "تمت المعالجة والحل مع العميل",
      },
      {
        code: "FNR-2609-4019", custIdx: 4, branch: FANAR_BRANCHES[3], pump: "مضخة 1",
        category: "billing_pump", channel: "direct", priority: "high", slaTier: "P2",
        status: canCloseAsManager ? "closed" : "resolved",
        desc: "فارق مبلغ 25 ريال في كشف الفوترة الشهرية للشركة بمحطة البريكي رنية (ST-004).",
        summary: "تسوية الفارق وإصدار إشعار دائن.",
        daysAgo: 52, firstRespMins: 24, resolveHours: 7.5, csat: 4, confirmed: true,
        closure: "تعويض العميل / تسوية الفاتورة",
      },
      // Month -1
      {
        code: "FNR-2610-5008", custIdx: 3, branch: FANAR_BRANCHES[5], pump: "مضخة 4",
        category: "staff_service", channel: "whatsapp", priority: "normal", slaTier: "P3",
        status: canCloseAsManager ? "closed" : "resolved",
        desc: "تأخر تقديم خدمة تنظيف الزجاج والتحقق من ضغط الإطارات في محطة كوكبة غرناطة (ST-006).",
        summary: "تأكيد الالتزام بمعيار الضيافة وتدريب العامل.",
        daysAgo: 34, firstRespMins: 20, resolveHours: 9, csat: 5, confirmed: true,
        closure: "توجيه وتدريب طاقم المحطة",
      },
      {
        code: "FNR-2610-5022", custIdx: 2, branch: FANAR_BRANCHES[13], pump: "المرافق",
        category: "cleanliness_facilities", channel: "portal", priority: "normal", slaTier: "P3",
        status: canCloseAsManager ? "closed" : "resolved",
        desc: "ملاحظة على إضاءة مدخل المصلى في محطة الكربي (ST-021) ليلاً.",
        summary: "تم استبدال وحدات الإضاءة خلال نفس اليوم.",
        daysAgo: 28, firstRespMins: 15, resolveHours: 6.5, csat: 4, confirmed: true,
        closure: "إجراء تصحيحي لمضخات / مرافق المحطة",
      },
      // Current Month (active + closed mix + aging buckets + unknown station)
      {
        code: "FNR-2611-4018", custIdx: 0, branch: FANAR_BRANCHES[1], pump: "مضخة 4",
        category: "billing_pump", channel: "whatsapp", priority: "high", slaTier: "P2",
        status: "pending_manager",
        desc: "تم خصم مبلغ 185 ريال عبر مدى عند المضخة رقم 4 لوقود 95 في محطة السلطان بوادي الدواسر (ST-002) بينما العداد توقف عند 150 ريال.",
        summary: "فارق فوترة بمقدار 35 ريال في مضخة 4 — محطة السلطان ST-002.",
        daysAgo: 2, firstRespMins: 12, resolveHours: 0,
      },
      {
        code: "FNR-2611-4025", custIdx: 1, branch: FANAR_BRANCHES[12], pump: "مضخة الديزل 2",
        category: "fleet_cards", channel: "phone", priority: "urgent", slaTier: "P1",
        status: "in_progress",
        desc: "بطاقة الأسطول رقم 8821 لم تقبل التفويض في مضخة الديزل بمحطة المحمدية جيزان (ST-019) رغم توفر الرصيد في العقد الشهري.",
        summary: "تعطل قراءة بطاقة أسطول لشركة نقل في محطة المحمدية ST-019.",
        daysAgo: 1, firstRespMins: 9, resolveHours: 0,
      },
      {
        code: "FNR-2611-4031", custIdx: 2, branch: FANAR_BRANCHES[13], pump: "عام",
        category: "cleanliness_facilities", channel: "whatsapp", priority: "normal", slaTier: "P3",
        status: "new",
        desc: "ملاحظة حول نظافة دورات المياه والمسجد في محطة الكربي حفر الباطن (ST-021) أثناء فترة الذروة المسائية.",
        summary: "بلاغ نظافة مرافق في محطة الكربي ST-021.",
        daysAgo: 0, firstRespMins: 0, resolveHours: 0,
      },
      {
        code: "FNR-2611-4044", custIdx: 5, branch: UNKNOWN_BRANCH_LABEL, stationUnknown: true, pump: "غير محدد",
        category: "other", channel: "portal", priority: "normal", slaTier: "P3",
        status: "waiting_customer",
        desc: "سجلت طلباً عبر بوابة العميل للاستفسار عن فاتورة تعبئة سابقة دون تذكر كود المحطة بالضبط.",
        summary: "طلب بانتظار تزويد العميل بصورة الإيصال لتحديد المحطة.",
        daysAgo: 4, firstRespMins: 25, resolveHours: 0,
      },
      {
        code: "FNR-2611-4052", custIdx: 4, branch: FANAR_BRANCHES[11], pump: "مضخة 2",
        category: "billing_pump", channel: "direct", priority: "high", slaTier: "P2",
        status: "resolved",
        desc: "عدم ظهور تفاصيل اللوحة على فاتورة أسطول رقم 412 في محطة الشهراني (ST-018).",
        summary: "تم تعديل بيانات المركبة وإصدار فاتورة محدثة للعميل.",
        daysAgo: 3, firstRespMins: 16, resolveHours: 5, confirmed: false,
      },
      {
        code: "FNR-2611-4060", custIdx: 3, branch: FANAR_BRANCHES[5], pump: "مضخة 1",
        category: "staff_service", channel: "whatsapp", priority: "normal", slaTier: "P4",
        status: canCloseAsManager ? "closed" : "resolved",
        desc: "استفسار واقتراح لإضافة مسار سريع لخدمة الدفع عبر Apple Pay في محطة كوكبة غرناطة (ST-006).",
        summary: "تم توثيق المقترح وإغلاق البلاغ بتقييم ممتاز.",
        daysAgo: 7, firstRespMins: 14, resolveHours: 10, csat: 5, confirmed: true,
        closure: "تمت المعالجة والحل مع العميل",
      },
    ];

    const complaintRefs = historicalSpecs.map(() => doc(collection(db, "complaints")));

    historicalSpecs.forEach((spec, i) => {
      const cust = seedCustomers[spec.custIdx];
      const occTs = daysAgoTs(spec.daysAgo);
      const occDate = occTs.toDate();
      const firstRespTs =
        spec.firstRespMins > 0
          ? Timestamp.fromDate(new Date(occDate.getTime() + spec.firstRespMins * 60000))
          : undefined;
      const resTs =
        spec.resolveHours > 0
          ? Timestamp.fromDate(new Date(occDate.getTime() + spec.resolveHours * 3600000))
          : undefined;

      const isTerminalClosed = spec.status === "closed";
      const isResolvedOrClosed = spec.status === "resolved" || spec.status === "closed";

      const docPayload: Record<string, unknown> = {
        ticketCode: spec.code,
        customerId: custRefs[spec.custIdx].id,
        customerName: cust.name,
        customerPhone: cust.phone,
        branch: spec.branch,
        stationUnknown: Boolean(spec.stationUnknown),
        pumpNumber: spec.pump,
        category: spec.category,
        channel: spec.channel,
        priority: spec.priority,
        slaTier: spec.slaTier,
        status: spec.status,
        description: spec.desc,
        aiSummary: spec.summary,
        codeSentViaWhatsapp: spec.channel !== "portal",
        ownerId,
        assignedAgentName: agentName,
        managerNotes: isTerminalClosed
          ? "تمت مراجعة الدليل الميداني واعتماد الإغلاق وفق معايير الجودة."
          : "",
        closureReason: spec.closure || "",
        closedBy: isTerminalClosed ? agentName : "",
        occurredAt: occTs,
        pausedTotalMinutes: spec.status === "waiting_customer" ? 180 : 0,
        pauseCount: spec.status === "waiting_customer" ? 1 : 0,
        pauseReason:
          spec.status === "waiting_customer"
            ? "بانتظار إرسال العميل صورة إيصال مدى لتحديد المحطة."
            : "",
        pauseReminderAt: spec.status === "waiting_customer" ? "غداً الساعة 10:00 صباحاً" : "",
        escalationLevel: spec.slaTier === "P1" ? 3 : spec.slaTier === "P2" ? 1 : 0,
        escalationOwner:
          spec.slaTier === "P1"
            ? "الإدارة التنفيذية وQHSE"
            : spec.slaTier === "P2"
            ? "مدير خدمة العملاء"
            : "مشرف المحطة",
        resolutionEvidence: isResolvedOrClosed ? spec.summary : "",
        publicUpdateNote: isResolvedOrClosed
          ? `تم تنفيذ الإجراء التصحيحي: ${spec.summary}`
          : spec.summary,
        customerConfirmed: Boolean(spec.confirmed),
        reopenCount: 0,
        auditTrail: [
          makeAuditEntry({
            actorName: "نظام التسجيل الموحد",
            actorRole: "system_admin",
            fromStatus: "",
            toStatus: "new",
            action: "تسجيل الشكوى",
            note: `تم التسجيل عبر قناة ${spec.channel} بأولوية ${spec.slaTier}`,
          }),
          ...(spec.status !== "new"
            ? [
                makeAuditEntry({
                  actorName: agentName,
                  actorRole: "manager",
                  fromStatus: "new",
                  toStatus: spec.status,
                  action: isTerminalClosed ? "إغلاق واعتماد نهائي" : "تحديث المعالجة",
                  note: spec.closure || spec.summary,
                }),
              ]
            : []),
        ],
        createdAt: ts,
        updatedAt: ts,
      };

      if (firstRespTs) docPayload.firstResponseAt = firstRespTs;
      if (resTs && isResolvedOrClosed) docPayload.resolvedAt = resTs;
      if (resTs && isTerminalClosed) docPayload.closedAt = resTs;
      if (spec.status === "waiting_customer") docPayload.pausedAt = daysAgoTs(1);
      if (spec.csat) docPayload.csatScore = spec.csat;

      batch.set(complaintRefs[i], docPayload);
    });

    // Conversations across months + active WhatsApp chats
    const conv1Ref = doc(collection(db, "conversations"));
    batch.set(conv1Ref, {
      customerId: custRefs[0].id,
      customerName: seedCustomers[0].name,
      customerPhone: seedCustomers[0].phone,
      aiAutoReplyEnabled: true,
      handoffStatus: "bot_active",
      handoffReason: "",
      escalationRule: "none",
      consecutiveAiFailures: 0,
      lastIntent: "complaint",
      lastMessage: "رمز الشكوى الرسمي: FNR-2611-4018",
      linkedTicketCode: "FNR-2611-4018",
      unreadCount: 0,
      occurredAt: daysAgoTs(2),
      ownerId,
      createdAt: ts,
      updatedAt: ts,
    });

    batch.set(doc(collection(db, `conversations/${conv1Ref.id}/messages`)), {
      sender: "customer",
      senderName: "سلطان القحطاني",
      body: "السلام عليكم، قبل قليل عبيت بنزين 95 من محطة السلطان بوادي الدواسر (ST-002) مضخة 4 وانخصم 185 ريال والفاتورة 150 ريال فقط.",
      messageType: "text",
      ticketCode: "",
      ownerId,
      createdAt: ts,
    });
    batch.set(doc(collection(db, `conversations/${conv1Ref.id}/messages`)), {
      sender: "ai",
      senderName: "نظام رموز الشكاوى - فنار",
      body: buildWhatsappTicketMessage(
        "سلطان القحطاني",
        "FNR-2611-4018",
        FANAR_BRANCHES[1],
        "فارق فوترة بمقدار 35 ريال في مضخة 4"
      ),
      messageType: "ticket_code",
      ticketCode: "FNR-2611-4018",
      ownerId,
      createdAt: ts,
    });

    const conv2Ref = doc(collection(db, "conversations"));
    batch.set(conv2Ref, {
      customerId: custRefs[2].id,
      customerName: seedCustomers[2].name,
      customerPhone: seedCustomers[2].phone,
      aiAutoReplyEnabled: false,
      handoffStatus: "escalated_to_agent",
      handoffReason: "القاعدة 3: حالة حساسة تتطلب مراجعة مشرف المحطة",
      escalationRule: "sensitive_case",
      consecutiveAiFailures: 0,
      lastIntent: "escalation",
      lastMessage: "تم تحويل المحادثة لموظف خدمة العملاء",
      linkedTicketCode: "FNR-2611-4031",
      unreadCount: 1,
      occurredAt: daysAgoTs(0),
      handoffAt: ts,
      ownerId,
      createdAt: ts,
      updatedAt: ts,
    });
    batch.set(doc(collection(db, `conversations/${conv2Ref.id}/messages`)), {
      sender: "customer",
      senderName: "فهد الدوسري",
      body: "مساء الخير، محطة الكربي في حفر الباطن (ST-021) دورات المياه تحتاج صيانة ونظافة فورية لو تكرمتوا.",
      messageType: "text",
      ticketCode: "",
      ownerId,
      createdAt: ts,
    });

    // Call Log
    batch.set(doc(collection(db, "call_logs")), {
      callerName: seedCustomers[1].name,
      callerPhone: seedCustomers[1].phone,
      branch: FANAR_BRANCHES[12],
      durationSeconds: 94,
      handledBy: "ai_ivr",
      transcript:
        "الرد الآلي: أهلاً بكم في خدمة عملاء شركة فنار الطاقة للوقود.\nالمتصل: معنا أسطول شاحنات في محطة المحمدية بجيزان (ST-019) والبطاقة 8821 ترفض الدفع.\nالرد الآلي: تم تسجيل البلاغ العاجل وإرسال الرمز للواتساب.",
      aiSummary: "توقف بطاقة وقود أساطيل في محطة المحمدية جيزان (ST-019) - تم رفع البلاغ P1.",
      linkedTicketCode: "FNR-2611-4025",
      codeSentViaWhatsapp: true,
      ownerId,
      createdAt: ts,
    });

    // 5 Weighted Quality Audits (PDF p.16)
    const auditSeeds = [
      { idx: 4, understanding: 95, comm: 92, solution: 94, completeness: 96, privacy: 100, note: "تطبيق ممتاز لمعايير P1 وفحص جودة الوقود خلال 3.5 ساعات." },
      { idx: 0, understanding: 90, comm: 95, solution: 90, completeness: 88, privacy: 100, note: "إغلاق موثق وإرفاق إيصال التسوية للعميل." },
      { idx: 6, understanding: 92, comm: 88, solution: 92, completeness: 90, privacy: 95, note: "تجاوب سريع مع مشكلة بطاقة الأساطيل." },
      { idx: 2, understanding: 80, comm: 78, solution: 72, completeness: 75, privacy: 90, note: "يحتاج إرفاق صورة التحقق الميداني لمرافق المحطة قبل الإغلاق." },
      { idx: 14, understanding: 88, comm: 90, solution: 86, completeness: 85, privacy: 100, note: "حل واضح وبانتظار تأكيد العميل على بوابة المتابعة." },
    ];

    auditSeeds.forEach((a) => {
      const compSpec = historicalSpecs[a.idx];
      const total = calculateWeightedQualityScore({
        problemUnderstanding: a.understanding,
        communication: a.comm,
        solutionAndEvidence: a.solution,
        recordCompleteness: a.completeness,
        privacyCompliance: a.privacy,
      });
      batch.set(doc(collection(db, "quality_audits")), {
        complaintId: complaintRefs[a.idx].id,
        ticketCode: compSpec.code,
        stationName: compSpec.branch,
        auditorName: agentName,
        problemUnderstanding: a.understanding,
        communication: a.comm,
        solutionAndEvidence: a.solution,
        recordCompleteness: a.completeness,
        privacyCompliance: a.privacy,
        totalScore: total,
        improvementNotes: a.note,
        status: total >= 85 ? "passed" : "needs_improvement",
        monthKey: currentMonthKey,
        ownerId,
        createdAt: ts,
        updatedAt: ts,
      });
    });

    // 3 Monthly Action Plan Items (PDF p.29)
    const actionSeeds: Array<Omit<ActionPlanItem, "id" | "ownerId" | "createdAt" | "updatedAt">> = [
      {
        title: "مراجعة محطة الكربي (ST-021) وخطة رفع الالتزام بـ SLA",
        rootCause: "تكرار بلاغات نظافة المرافق وتأخر الإسناد الميداني",
        ownerName: "مدير المنطقة — الشرقية",
        dueDateLabel: "اليوم 10 من الشهر",
        targetMetric: "رفع التزام SLA إلى 92%+",
        status: "in_progress",
        monthKey: currentMonthKey,
      },
      {
        title: "تحديث ردود المساعد الذكي حول الفواتير وبطاقات الأساطيل",
        rootCause: "أبرز سبب تحويل للموظف البشري في استفسارات الفوترة",
        ownerName: "قائد فريق خدمة العملاء",
        dueDateLabel: "اليوم 15 من الشهر",
        targetMetric: "خفض التحويل بنسبة 10%",
        status: "open",
        monthKey: currentMonthKey,
      },
      {
        title: "تدقيق إغلاقات الفروع ذات التكرار العالي وإلزامية الدليل",
        rootCause: "بعض الإغلاقات السابقة بدون إرفاق دليل حل مكتمل",
        ownerName: "فريق الجودة والرقابة",
        dueDateLabel: "نهاية الشهر",
        targetMetric: "اكتمال السجل والدليل 100%",
        status: "in_progress",
        monthKey: currentMonthKey,
      },
    ];

    actionSeeds.forEach((plan) => {
      batch.set(doc(collection(db, "action_plans")), {
        ...plan,
        ownerId,
        createdAt: ts,
        updatedAt: ts,
      });
    });

    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "seed_enriched_data");
  }
}

export async function seedInitialFanarDataIfEmpty(
  ownerId: string,
  agentName: string,
  canCloseAsManager = false
): Promise<boolean> {
  try {
    const existingCustomers = await getDocs(
      query(collection(db, "customers"), where("ownerId", "==", ownerId), limit(1))
    );
    if (!existingCustomers.empty) {
      return false;
    }
    return await seedEnrichedMultiMonthData(ownerId, agentName, canCloseAsManager);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "seed_initial_data");
  }
}

export async function createCustomerRecord(params: {
  name: string;
  phone: string;
  city: string;
  preferredBranch: string;
  segment: CustomerSegment;
  ownerId: string;
}): Promise<string> {
  try {
    const ref = doc(collection(db, "customers"));
    await setDoc(ref, {
      name: clampStr(params.name, FIELD_LIMITS.NAME_MAX, "عميل فنار"),
      phone: clampStr(params.phone, FIELD_LIMITS.PHONE_MAX, "+966500000000"),
      city: clampStr(params.city, FIELD_LIMITS.CITY_MAX, "وادي الدواسر"),
      preferredBranch: clampStr(params.preferredBranch, FIELD_LIMITS.BRANCH_MAX, FANAR_BRANCHES[0]),
      segment: params.segment,
      totalComplaints: 0,
      ownerId: params.ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, "customers");
  }
}

export async function createWhatsappConversationOnly(params: {
  ownerId: string;
  customerName: string;
  customerPhone: string;
  initialMessage: string;
  botName: string;
  aiReply?: string;
  intent?: BotIntent;
  escalate?: boolean;
  escalationReason?: string;
  escalationRule?: EscalationRuleKey;
  consecutiveAiFailures?: number;
  existingCustomers: Customer[];
  existingConversations: Conversation[];
}): Promise<{ conversationId: string; customerId: string }> {
  try {
    const batch = writeBatch(db);
    const ts = serverTimestamp();
    const cleanPhone = clampStr(params.customerPhone, FIELD_LIMITS.PHONE_MAX, "+966500000000");
    const cleanName = clampStr(params.customerName, FIELD_LIMITS.NAME_MAX, "عميل فنار");

    const matchedCustomer = params.existingCustomers.find(
      (c) => c.phone.replace(/\s+/g, "") === cleanPhone.replace(/\s+/g, "")
    );

    let customerId = matchedCustomer?.id;
    if (!customerId) {
      const newCustRef = doc(collection(db, "customers"));
      customerId = newCustRef.id;
      batch.set(newCustRef, {
        name: cleanName,
        phone: cleanPhone,
        city: "وادي الدواسر",
        preferredBranch: FANAR_BRANCHES[0],
        segment: "individual",
        totalComplaints: 0,
        ownerId: params.ownerId,
        createdAt: ts,
        updatedAt: ts,
      });
    }

    const matchedConv = params.existingConversations.find(
      (conv) =>
        conv.customerId === customerId ||
        conv.customerPhone.replace(/\s+/g, "") === cleanPhone.replace(/\s+/g, "")
    );

    const lastText = clampStr(
      params.aiReply || params.initialMessage,
      120,
      "محادثة واتساب"
    );

    const convRef = matchedConv
      ? doc(db, "conversations", matchedConv.id)
      : doc(collection(db, "conversations"));

    const handoffStatus: HandoffStatus = params.escalate
      ? "escalated_to_agent"
      : "bot_active";

    if (matchedConv) {
      const updatePayload: Record<string, unknown> = {
        lastMessage: lastText,
        aiAutoReplyEnabled: !params.escalate,
        handoffStatus,
        lastIntent: params.intent || "faq",
        escalationRule: params.escalationRule || "none",
        consecutiveAiFailures: params.consecutiveAiFailures ?? 0,
        unreadCount: params.escalate ? increment(1) : 0,
        updatedAt: ts,
      };
      if (params.escalate) {
        updatePayload.handoffReason = clampStr(
          params.escalationReason,
          FIELD_LIMITS.HANDOFF_REASON_MAX,
          "تحويل تلقائي لموظف خدمة العملاء"
        );
        updatePayload.handoffAt = ts;
      }
      batch.update(convRef, updatePayload);
    } else {
      const createPayload: Record<string, unknown> = {
        customerId,
        customerName: cleanName,
        customerPhone: cleanPhone,
        aiAutoReplyEnabled: !params.escalate,
        handoffStatus,
        handoffReason: params.escalate
          ? clampStr(
              params.escalationReason,
              FIELD_LIMITS.HANDOFF_REASON_MAX,
              "تحويل تلقائي لموظف خدمة العملاء"
            )
          : "",
        lastIntent: params.intent || "faq",
        escalationRule: params.escalationRule || "none",
        consecutiveAiFailures: params.consecutiveAiFailures ?? 0,
        lastMessage: lastText,
        linkedTicketCode: "",
        unreadCount: params.escalate ? 1 : 0,
        occurredAt: ts,
        ownerId: params.ownerId,
        createdAt: ts,
        updatedAt: ts,
      };
      if (params.escalate) {
        createPayload.handoffAt = ts;
      }
      batch.set(convRef, createPayload);
    }

    const msgCustRef = doc(collection(db, `conversations/${convRef.id}/messages`));
    batch.set(msgCustRef, {
      sender: "customer",
      senderName: cleanName,
      body: clampStr(params.initialMessage, FIELD_LIMITS.DESCRIPTION_MAX, "..."),
      messageType: "text",
      ticketCode: "",
      ownerId: params.ownerId,
      createdAt: ts,
    });

    if (params.aiReply) {
      const msgAiRef = doc(collection(db, `conversations/${convRef.id}/messages`));
      batch.set(msgAiRef, {
        sender: "ai",
        senderName: clampStr(params.botName, 100, "مساعد فنار الذكي"),
        body: clampStr(params.aiReply, FIELD_LIMITS.DESCRIPTION_MAX, "..."),
        messageType: "text",
        ticketCode: "",
        ownerId: params.ownerId,
        createdAt: ts,
      });
    }

    if (params.escalate) {
      const handoffRef = doc(collection(db, `conversations/${convRef.id}/messages`));
      batch.set(handoffRef, {
        sender: "ai",
        senderName: "نظام التحويل التلقائي - فنار",
        body: `تم تحويل المحادثة تلقائياً إلى موظف خدمة العملاء مع الاحتفاظ بكامل سجل المحادثة. السبب: ${clampStr(
          params.escalationReason,
          FIELD_LIMITS.HANDOFF_REASON_MAX,
          "استفسار يتطلب تدخلاً بشرياً"
        )}`,
        messageType: "handoff_notice",
        ticketCode: "",
        ownerId: params.ownerId,
        createdAt: ts,
      });
    }

    await batch.commit();
    return { conversationId: convRef.id, customerId };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "conversations");
  }
}

export async function createComplaintWithNotification(params: {
  ownerId: string;
  agentName: string;
  ticketCode?: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  city?: string;
  segment?: CustomerSegment;
  branch: string;
  stationUnknown?: boolean;
  pumpNumber: string;
  category: ComplaintCategory;
  channel: ComplaintChannel;
  priority: ComplaintPriority;
  slaTier?: SlaTier;
  status?: Exclude<ComplaintStatus, "closed">;
  description: string;
  aiSummary?: string;
  attachmentMeta?: ComplaintAttachmentMeta;
  existingConversationId?: string;
  existingCustomers: Customer[];
  existingConversations: Conversation[];
  sendWhatsappCode?: boolean;
}): Promise<{ complaintId: string; ticketCode: string; conversationId: string }> {
  try {
    const batch = writeBatch(db);
    const ts = serverTimestamp();
    const ticketCode = params.ticketCode || generateTicketCode();
    const cleanPhone = clampStr(params.customerPhone, FIELD_LIMITS.PHONE_MAX, "+966500000000");
    const cleanName = clampStr(params.customerName, FIELD_LIMITS.NAME_MAX, "عميل فنار");
    const cleanBranch = clampStr(
      params.branch,
      FIELD_LIMITS.BRANCH_MAX,
      params.stationUnknown ? UNKNOWN_BRANCH_LABEL : FANAR_BRANCHES[0]
    );
    const cleanSummary = clampStr(
      params.aiSummary || params.description,
      FIELD_LIMITS.SUMMARY_MAX,
      "بلاغ خدمة عملاء"
    );

    const slaTier =
      params.slaTier ||
      resolveComplaintSlaTier({
        priority: params.priority,
        category: params.category,
      });

    // Resolve or create customer
    let customerId = params.customerId;
    if (!customerId) {
      const matchedCustomer = params.existingCustomers.find(
        (c) => c.phone.replace(/\s+/g, "") === cleanPhone.replace(/\s+/g, "")
      );
      if (matchedCustomer) {
        customerId = matchedCustomer.id;
        batch.update(doc(db, "customers", customerId), {
          totalComplaints: increment(1),
          updatedAt: ts,
        });
      } else {
        const newCustRef = doc(collection(db, "customers"));
        customerId = newCustRef.id;
        batch.set(newCustRef, {
          name: cleanName,
          phone: cleanPhone,
          city: clampStr(params.city, FIELD_LIMITS.CITY_MAX, "وادي الدواسر"),
          preferredBranch: params.stationUnknown ? FANAR_BRANCHES[0] : cleanBranch,
          segment: params.segment || "individual",
          totalComplaints: 1,
          ownerId: params.ownerId,
          createdAt: ts,
          updatedAt: ts,
        });
      }
    } else {
      batch.update(doc(db, "customers", customerId), {
        totalComplaints: increment(1),
        updatedAt: ts,
      });
    }

    const complaintRef = doc(collection(db, "complaints"));
    const sendCode = params.sendWhatsappCode ?? true;

    const initialAudit = makeAuditEntry({
      actorName: params.agentName,
      actorRole: params.channel === "portal" ? "customer_portal" : "agent",
      fromStatus: "",
      toStatus: params.status || "new",
      action: "إنشاء وتوثيق الشكوى",
      note: params.stationUnknown
        ? "سُجلت الشكوى مع خيار (لا أعرف المحطة) للمراجعة اليدوية"
        : `تخصيص مستوى SLA: ${slaTier}`,
    });

    const complaintPayload: Record<string, unknown> = {
      ticketCode,
      customerId,
      customerName: cleanName,
      customerPhone: cleanPhone,
      branch: cleanBranch,
      stationUnknown: Boolean(params.stationUnknown),
      pumpNumber: clampStr(params.pumpNumber, FIELD_LIMITS.PUMP_MAX, "غير محدد"),
      category: params.category,
      channel: params.channel,
      priority: params.priority,
      slaTier,
      status: params.status || "new",
      description: clampStr(params.description, FIELD_LIMITS.DESCRIPTION_MAX, "شكوى عميل"),
      aiSummary: cleanSummary,
      codeSentViaWhatsapp: sendCode,
      ownerId: params.ownerId,
      assignedAgentName: clampStr(params.agentName, 100, "فريق خدمة العملاء"),
      managerNotes: "",
      closureReason: "",
      closedBy: "",
      occurredAt: ts,
      pausedTotalMinutes: 0,
      pauseCount: 0,
      escalationLevel: slaTier === "P1" ? 3 : slaTier === "P2" ? 1 : 0,
      escalationOwner:
        slaTier === "P1" ? "الإدارة التنفيذية وQHSE" : "فريق خدمة العملاء",
      publicUpdateNote: params.stationUnknown
        ? "تم استلام الطلب ويجري تحديد المحطة المختصة يدوياً."
        : "تم استلام الطلب وإصدار الرقم المرجعي.",
      customerConfirmed: false,
      reopenCount: 0,
      auditTrail: [initialAudit],
      createdAt: ts,
      updatedAt: ts,
    };

    if (params.attachmentMeta?.fileName) {
      complaintPayload.attachmentMeta = {
        fileName: clampStr(params.attachmentMeta.fileName, 200, "attachment"),
        fileType: clampStr(params.attachmentMeta.fileType, 100, "application/pdf"),
        sizeBytes: Math.max(0, Math.min(20000000, Math.round(params.attachmentMeta.sizeBytes || 0))),
      };
    }

    batch.set(complaintRef, complaintPayload);

    // Resolve or create conversation & dispatch ticket code via WhatsApp
    let conversationId = params.existingConversationId;
    if (!conversationId) {
      const matchedConv = params.existingConversations.find(
        (conv) =>
          conv.customerId === customerId ||
          conv.customerPhone.replace(/\s+/g, "") === cleanPhone.replace(/\s+/g, "")
      );
      if (matchedConv) {
        conversationId = matchedConv.id;
      }
    }

    const codeBody = buildWhatsappTicketMessage(cleanName, ticketCode, cleanBranch, cleanSummary);

    if (conversationId) {
      batch.update(doc(db, "conversations", conversationId), {
        linkedTicketCode: ticketCode,
        lastMessage: sendCode ? `رمز الشكوى الرسمي: ${ticketCode}` : cleanSummary,
        lastIntent: "complaint",
        updatedAt: ts,
      });
    } else {
      const newConvRef = doc(collection(db, "conversations"));
      conversationId = newConvRef.id;
      batch.set(newConvRef, {
        customerId,
        customerName: cleanName,
        customerPhone: cleanPhone,
        aiAutoReplyEnabled: true,
        handoffStatus: "bot_active",
        handoffReason: "",
        escalationRule: "none",
        consecutiveAiFailures: 0,
        lastIntent: "complaint",
        lastMessage: sendCode ? `رمز الشكوى الرسمي: ${ticketCode}` : cleanSummary,
        linkedTicketCode: ticketCode,
        unreadCount: 0,
        occurredAt: ts,
        ownerId: params.ownerId,
        createdAt: ts,
        updatedAt: ts,
      });
    }

    if (sendCode) {
      const msgRef = doc(collection(db, `conversations/${conversationId}/messages`));
      batch.set(msgRef, {
        sender: "ai",
        senderName: "نظام رموز الشكاوى - فنار",
        body: codeBody,
        messageType: "ticket_code",
        ticketCode,
        ownerId: params.ownerId,
        createdAt: ts,
      });
    }

    await batch.commit();
    return { complaintId: complaintRef.id, ticketCode, conversationId };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "complaints");
  }
}

export async function addWhatsappMessage(params: {
  conversationId: string;
  sender: "customer" | "ai" | "agent";
  senderName: string;
  body: string;
  messageType?: "text" | "ticket_code" | "closure_notice" | "handoff_notice";
  ticketCode?: string;
  ownerId: string;
  unreadDelta?: number;
  lastIntent?: BotIntent;
  handoffStatus?: HandoffStatus;
  consecutiveAiFailures?: number;
}): Promise<void> {
  try {
    const batch = writeBatch(db);
    const ts = serverTimestamp();
    const cleanBody = clampStr(params.body, FIELD_LIMITS.DESCRIPTION_MAX, "...");

    const msgRef = doc(collection(db, `conversations/${params.conversationId}/messages`));
    batch.set(msgRef, {
      sender: params.sender,
      senderName: clampStr(params.senderName, 100, "فنار"),
      body: cleanBody,
      messageType: params.messageType || "text",
      ticketCode: clampStr(params.ticketCode, 32, ""),
      ownerId: params.ownerId,
      createdAt: ts,
    });

    const convUpdate: Record<string, unknown> = {
      lastMessage: cleanBody.slice(0, 120),
      updatedAt: ts,
    };
    if (params.ticketCode) {
      convUpdate.linkedTicketCode = clampStr(params.ticketCode, 32, "");
    }
    if (params.lastIntent) {
      convUpdate.lastIntent = params.lastIntent;
    }
    if (typeof params.consecutiveAiFailures === "number") {
      convUpdate.consecutiveAiFailures = Math.max(0, Math.min(50, params.consecutiveAiFailures));
    }
    if (params.handoffStatus) {
      convUpdate.handoffStatus = params.handoffStatus;
    } else if (params.sender === "agent" && params.messageType !== "closure_notice") {
      convUpdate.handoffStatus = "agent_handling";
    }
    if (typeof params.unreadDelta === "number") {
      convUpdate.unreadCount = params.unreadDelta === 0 ? 0 : increment(params.unreadDelta);
    }

    batch.update(doc(db, "conversations", params.conversationId), convUpdate);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `conversations/${params.conversationId}/messages`
    );
  }
}

export async function escalateConversationToAgent(params: {
  conversationId: string;
  ownerId: string;
  reason: string;
  rule?: EscalationRuleKey;
  handoffSummary?: string;
  intent?: BotIntent;
  ticketCode?: string;
}): Promise<void> {
  try {
    const batch = writeBatch(db);
    const ts = serverTimestamp();
    const cleanReason = clampStr(
      params.reason,
      FIELD_LIMITS.HANDOFF_REASON_MAX,
      "يتطلب متابعة وتدخل موظف خدمة العملاء"
    );

    const noticeRef = doc(collection(db, `conversations/${params.conversationId}/messages`));
    batch.set(noticeRef, {
      sender: "ai",
      senderName: "نظام التحويل التلقائي - فنار",
      body: `تم تحويل المحادثة تلقائياً إلى موظف خدمة العملاء مع الاحتفاظ بكامل سجل المحادثة.\nالسبب: ${cleanReason}${
        params.handoffSummary ? `\nملخص للموظف: ${params.handoffSummary}` : ""
      }`,
      messageType: "handoff_notice",
      ticketCode: clampStr(params.ticketCode, 32, ""),
      ownerId: params.ownerId,
      createdAt: ts,
    });

    batch.update(doc(db, "conversations", params.conversationId), {
      aiAutoReplyEnabled: false,
      handoffStatus: "escalated_to_agent",
      handoffReason: cleanReason,
      escalationRule: params.rule || "explicit_request",
      handoffAt: ts,
      lastIntent: params.intent || "escalation",
      unreadCount: increment(1),
      lastMessage: `محولة للموظف: ${cleanReason.slice(0, 90)}`,
      updatedAt: ts,
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `conversations/${params.conversationId}`
    );
  }
}

export async function toggleConversationAiMode(
  conversationId: string,
  enabled: boolean
): Promise<void> {
  try {
    await updateDoc(doc(db, "conversations", conversationId), {
      aiAutoReplyEnabled: enabled,
      handoffStatus: enabled ? "bot_active" : "agent_handling",
      handoffReason: enabled ? "" : "تم تولي المحادثة يدوياً من موظف خدمة العملاء",
      escalationRule: "none",
      consecutiveAiFailures: 0,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `conversations/${conversationId}`);
  }
}

export async function updateComplaintByAgent(
  complaintId: string,
  updates: Partial<
    Pick<
      Complaint,
      | "status"
      | "priority"
      | "slaTier"
      | "branch"
      | "stationUnknown"
      | "pumpNumber"
      | "category"
      | "description"
      | "aiSummary"
      | "codeSentViaWhatsapp"
      | "assignedAgentName"
      | "publicUpdateNote"
    >
  >
): Promise<void> {
  try {
    const sanitized: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.status && updates.status !== "closed") sanitized.status = updates.status;
    if (updates.priority) sanitized.priority = updates.priority;
    if (updates.slaTier) sanitized.slaTier = updates.slaTier;
    if (updates.branch) sanitized.branch = clampStr(updates.branch, FIELD_LIMITS.BRANCH_MAX);
    if (typeof updates.stationUnknown === "boolean")
      sanitized.stationUnknown = updates.stationUnknown;
    if (typeof updates.pumpNumber === "string")
      sanitized.pumpNumber = clampStr(updates.pumpNumber, FIELD_LIMITS.PUMP_MAX);
    if (updates.category) sanitized.category = updates.category;
    if (updates.description)
      sanitized.description = clampStr(updates.description, FIELD_LIMITS.DESCRIPTION_MAX);
    if (typeof updates.aiSummary === "string")
      sanitized.aiSummary = clampStr(updates.aiSummary, FIELD_LIMITS.SUMMARY_MAX);
    if (typeof updates.codeSentViaWhatsapp === "boolean")
      sanitized.codeSentViaWhatsapp = updates.codeSentViaWhatsapp;
    if (updates.assignedAgentName)
      sanitized.assignedAgentName = clampStr(updates.assignedAgentName, 100);
    if (typeof updates.publicUpdateNote === "string")
      sanitized.publicUpdateNote = clampStr(updates.publicUpdateNote, FIELD_LIMITS.EVIDENCE_MAX);

    await updateDoc(doc(db, "complaints", complaintId), sanitized);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `complaints/${complaintId}`);
  }
}

export async function updateComplaintLifecycle(params: {
  complaint: Complaint;
  nextStatus: ComplaintStatus;
  actorName: string;
  actorRole: string;
  note?: string;
  pauseReason?: string;
  pauseReminderAt?: string;
  resolutionEvidence?: string;
  publicUpdateNote?: string;
  escalationLevel?: number;
  escalationOwner?: string;
  cancellationReason?: string;
  reopenReason?: string;
  slaTier?: SlaTier;
  branch?: string;
}): Promise<void> {
  const { complaint, nextStatus } = params;

  if (complaint.status === "new" && nextStatus === "closed") {
    throw new Error("لا يُسمح بالقفز مباشرة من «جديدة» إلى «مغلقة». يجب المعالجة أو الحل أولاً.");
  }

  const allowed = ALLOWED_STATUS_TRANSITIONS[complaint.status] || [];
  if (nextStatus !== complaint.status && !allowed.includes(nextStatus)) {
    throw new Error(`الانتقال من «${complaint.status}» إلى «${nextStatus}» غير مسموح به وفق دورة الحياة.`);
  }

  try {
    const ts = serverTimestamp();
    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      assignedAgentName: clampStr(params.actorName, 100, complaint.assignedAgentName),
      updatedAt: ts,
    };

    if (!complaint.firstResponseAt && nextStatus !== "new") {
      updatePayload.firstResponseAt = ts;
    }

    if (params.slaTier) {
      updatePayload.slaTier = params.slaTier;
    }

    if (params.branch && params.branch !== UNKNOWN_BRANCH_LABEL) {
      updatePayload.branch = clampStr(params.branch, FIELD_LIMITS.BRANCH_MAX);
      updatePayload.stationUnknown = false;
    }

    // Leaving waiting_customer resumes SLA timer and accumulates paused minutes
    if (complaint.status === "waiting_customer" && nextStatus !== "waiting_customer") {
      const pausedStartMs = complaint.pausedAt?.toMillis?.() ?? Date.now();
      const deltaMinutes = Math.max(1, Math.round((Date.now() - pausedStartMs) / 60000));
      updatePayload.pausedAt = null;
      updatePayload.pausedTotalMinutes = (complaint.pausedTotalMinutes || 0) + deltaMinutes;
    }

    // Entering waiting_customer pauses SLA fairly
    if (nextStatus === "waiting_customer" && complaint.status !== "waiting_customer") {
      updatePayload.pausedAt = ts;
      updatePayload.pauseCount = (complaint.pauseCount || 0) + 1;
      updatePayload.pauseReason = clampStr(
        params.pauseReason || params.note,
        FIELD_LIMITS.REASON_MAX,
        "بانتظار رد ومستندات العميل"
      );
      updatePayload.pauseReminderAt = clampStr(
        params.pauseReminderAt,
        60,
        "متابعة بعد 24 ساعة"
      );
    }

    if (nextStatus === "resolved") {
      updatePayload.resolvedAt = ts;
      if (params.resolutionEvidence) {
        updatePayload.resolutionEvidence = clampStr(
          params.resolutionEvidence,
          FIELD_LIMITS.EVIDENCE_MAX
        );
      }
    }

    if (typeof params.escalationLevel === "number") {
      updatePayload.escalationLevel = Math.max(0, Math.min(3, params.escalationLevel));
    }
    if (params.escalationOwner) {
      updatePayload.escalationOwner = clampStr(params.escalationOwner, 120);
    }
    if (params.publicUpdateNote) {
      updatePayload.publicUpdateNote = clampStr(
        params.publicUpdateNote,
        FIELD_LIMITS.EVIDENCE_MAX
      );
    }

    if (nextStatus === "cancelled") {
      updatePayload.cancellationReason = clampStr(
        params.cancellationReason || params.note,
        FIELD_LIMITS.REASON_MAX,
        "إلغاء موثق"
      );
    }

    if (nextStatus === "reopened") {
      updatePayload.reopenCount = (complaint.reopenCount || 0) + 1;
      updatePayload.reopenReason = clampStr(
        params.reopenReason || params.note,
        FIELD_LIMITS.REASON_MAX,
        "المشكلة مستمرة حسب إفادة العميل"
      );
      updatePayload.previousSolution = clampStr(
        complaint.resolutionEvidence || complaint.closureReason,
        FIELD_LIMITS.EVIDENCE_MAX
      );
      updatePayload.customerConfirmed = false;
    }

    const entry = makeAuditEntry({
      actorName: params.actorName,
      actorRole: params.actorRole,
      fromStatus: complaint.status,
      toStatus: nextStatus,
      action:
        nextStatus === "waiting_customer"
          ? "إيقاف SLA بانتظار العميل"
          : nextStatus === "resolved"
          ? "توثيق الحل بانتظار تأكيد العميل"
          : nextStatus === "reopened"
          ? "إعادة فتح الشكوى"
          : nextStatus === "cancelled"
          ? "إلغاء موثق للشكوى"
          : "تحديث حالة المعالجة",
      note:
        params.note ||
        params.pauseReason ||
        params.resolutionEvidence ||
        params.cancellationReason ||
        params.reopenReason ||
        "",
    });

    updatePayload.auditTrail = appendAuditTrail(complaint.auditTrail, entry);

    await updateDoc(doc(db, "complaints", complaint.id), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `complaints/${complaint.id}`);
  }
}

export async function closeComplaintByManager(params: {
  complaint: Complaint;
  managerName: string;
  closureReason: string;
  managerNotes: string;
  resolutionEvidence?: string;
  notifyCustomerWhatsapp: boolean;
  conversations: Conversation[];
  ownerId: string;
}): Promise<void> {
  if (params.complaint.status === "new") {
    throw new Error("لا يمكن إغلاق الشكوى مباشرة من حالة «جديدة». يرجى نقلها للمعالجة أو الحل أولاً.");
  }

  try {
    const batch = writeBatch(db);
    const ts = serverTimestamp();

    const cleanReason = clampStr(params.closureReason, 200, "تمت المعالجة والحل");
    const cleanNotes = clampStr(params.managerNotes, FIELD_LIMITS.NOTES_MAX, "");
    const cleanManager = clampStr(params.managerName, 120, "مدير خدمة العملاء");
    const cleanEvidence = clampStr(
      params.resolutionEvidence || params.complaint.resolutionEvidence || cleanReason,
      FIELD_LIMITS.EVIDENCE_MAX
    );

    const nextAudit = appendAuditTrail(
      params.complaint.auditTrail,
      makeAuditEntry({
        actorName: cleanManager,
        actorRole: "manager",
        fromStatus: params.complaint.status,
        toStatus: "closed",
        action: "اعتماد وإغلاق نهائي للشكوى",
        note: `${cleanReason} — ${cleanNotes}`.slice(0, 500),
      })
    );

    const closeUpdate: Record<string, unknown> = {
      status: "closed",
      closureReason: cleanReason,
      managerNotes: cleanNotes,
      resolutionEvidence: cleanEvidence,
      publicUpdateNote: `تم اعتماد معالجة البلاغ: ${cleanReason}`,
      closedBy: cleanManager,
      closedAt: ts,
      updatedAt: ts,
      auditTrail: nextAudit,
    };
    if (!params.complaint.firstResponseAt) {
      closeUpdate.firstResponseAt = ts;
    }
    if (!params.complaint.resolvedAt) {
      closeUpdate.resolvedAt = ts;
    }

    batch.update(doc(db, "complaints", params.complaint.id), closeUpdate);

    if (params.notifyCustomerWhatsapp) {
      const conv = params.conversations.find(
        (c) =>
          c.linkedTicketCode === params.complaint.ticketCode ||
          c.customerId === params.complaint.customerId ||
          c.customerPhone.replace(/\s+/g, "") ===
            params.complaint.customerPhone.replace(/\s+/g, "")
      );

      if (conv) {
        const noticeBody = buildWhatsappClosureMessage(
          params.complaint.customerName,
          params.complaint.ticketCode,
          cleanReason,
          cleanNotes
        );
        const msgRef = doc(collection(db, `conversations/${conv.id}/messages`));
        batch.set(msgRef, {
          sender: "agent",
          senderName: `إدارة خدمة العملاء - ${cleanManager}`,
          body: noticeBody,
          messageType: "closure_notice",
          ticketCode: params.complaint.ticketCode,
          ownerId: params.ownerId,
          createdAt: ts,
        });
        batch.update(doc(db, "conversations", conv.id), {
          lastMessage: `تم إغلاق الشكوى ${params.complaint.ticketCode}`,
          updatedAt: ts,
        });
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `complaints/${params.complaint.id}`
    );
  }
}

export async function createOrUpdateQualityAudit(params: {
  existingAuditId?: string;
  complaint: Complaint;
  auditorName: string;
  problemUnderstanding: number;
  communication: number;
  solutionAndEvidence: number;
  recordCompleteness: number;
  privacyCompliance: number;
  improvementNotes: string;
  ownerId: string;
}): Promise<void> {
  const totalScore = calculateWeightedQualityScore({
    problemUnderstanding: params.problemUnderstanding,
    communication: params.communication,
    solutionAndEvidence: params.solutionAndEvidence,
    recordCompleteness: params.recordCompleteness,
    privacyCompliance: params.privacyCompliance,
  });

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const payload = {
    complaintId: params.complaint.id,
    ticketCode: params.complaint.ticketCode,
    stationName: clampStr(params.complaint.branch, 100, FANAR_BRANCHES[0]),
    auditorName: clampStr(params.auditorName, 100, "فريق الجودة"),
    problemUnderstanding: Math.round(Math.max(0, Math.min(100, params.problemUnderstanding))),
    communication: Math.round(Math.max(0, Math.min(100, params.communication))),
    solutionAndEvidence: Math.round(Math.max(0, Math.min(100, params.solutionAndEvidence))),
    recordCompleteness: Math.round(Math.max(0, Math.min(100, params.recordCompleteness))),
    privacyCompliance: Math.round(Math.max(0, Math.min(100, params.privacyCompliance))),
    totalScore,
    improvementNotes: clampStr(params.improvementNotes, 1000, ""),
    status: (totalScore >= 85 ? "passed" : "needs_improvement") as "passed" | "needs_improvement",
    monthKey,
    ownerId: params.ownerId,
    updatedAt: serverTimestamp(),
  };

  try {
    if (params.existingAuditId) {
      await updateDoc(doc(db, "quality_audits", params.existingAuditId), payload);
    } else {
      await setDoc(doc(collection(db, "quality_audits")), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "quality_audits");
  }
}

export async function createActionPlanItem(params: {
  title: string;
  rootCause: string;
  ownerName: string;
  dueDateLabel: string;
  targetMetric: string;
  monthKey: string;
  ownerId: string;
}): Promise<void> {
  try {
    await setDoc(doc(collection(db, "action_plans")), {
      title: clampStr(params.title, 200, "إجراء تحسيني"),
      rootCause: clampStr(params.rootCause, 400, "تحليل بيانات الأداء"),
      ownerName: clampStr(params.ownerName, 120, "إدارة خدمة العملاء"),
      dueDateLabel: clampStr(params.dueDateLabel, 60, "نهاية الشهر"),
      targetMetric: clampStr(params.targetMetric, 200, "رفع التزام SLA"),
      status: "open",
      monthKey: params.monthKey,
      ownerId: params.ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, "action_plans");
  }
}

export async function updateActionPlanStatus(
  planId: string,
  status: "open" | "in_progress" | "completed"
): Promise<void> {
  try {
    await updateDoc(doc(db, "action_plans", planId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `action_plans/${planId}`);
  }
}

export async function applyCustomerPortalPendingSync(params: {
  ownerId: string;
  agentName: string;
  complaints: Complaint[];
  customers: Customer[];
  conversations: Conversation[];
  pendingCreates: Array<{
    id: string;
    ticketCode: string;
    customerName: string;
    customerPhone: string;
    branch: string;
    stationUnknown: boolean;
    pumpNumber: string;
    category: ComplaintCategory;
    priority: ComplaintPriority;
    slaTier: SlaTier;
    description: string;
    attachmentMeta?: ComplaintAttachmentMeta;
  }>;
  pendingActions: Array<{
    id: string;
    ticketCode: string;
    action: "add_info" | "request_agent" | "confirm_resolved" | "reopen";
    note?: string;
    csatScore?: number;
    csatComment?: string;
  }>;
}): Promise<{ ackCreateIds: string[]; ackActionIds: string[] }> {
  const ackCreateIds: string[] = [];
  const ackActionIds: string[] = [];

  for (const item of params.pendingCreates) {
    const alreadyExists = params.complaints.some(
      (c) => c.ticketCode.toUpperCase() === item.ticketCode.toUpperCase()
    );
    if (!alreadyExists) {
      await createComplaintWithNotification({
        ownerId: params.ownerId,
        agentName: params.agentName,
        ticketCode: item.ticketCode,
        customerName: item.customerName,
        customerPhone: item.customerPhone,
        branch: item.branch,
        stationUnknown: item.stationUnknown,
        pumpNumber: item.pumpNumber,
        category: item.category,
        channel: "portal",
        priority: item.priority,
        slaTier: item.slaTier,
        status: "new",
        description: item.description,
        aiSummary: item.description.slice(0, 140),
        attachmentMeta: item.attachmentMeta,
        existingCustomers: params.customers,
        existingConversations: params.conversations,
        sendWhatsappCode: false,
      });
    }
    ackCreateIds.push(item.id);
  }

  for (const act of params.pendingActions) {
    const target = params.complaints.find(
      (c) => c.ticketCode.toUpperCase() === act.ticketCode.toUpperCase()
    );
    if (!target) continue;

    try {
      const ts = serverTimestamp();
      if (act.action === "add_info") {
        await updateDoc(doc(db, "complaints", target.id), {
          status: target.status === "waiting_customer" ? "in_progress" : target.status,
          pausedAt: null,
          publicUpdateNote: clampStr(`إفادة العميل: ${act.note || ""}`, 600),
          auditTrail: appendAuditTrail(
            target.auditTrail,
            makeAuditEntry({
              actorName: target.customerName,
              actorRole: "customer_portal",
              fromStatus: target.status,
              toStatus: target.status === "waiting_customer" ? "in_progress" : target.status,
              action: "إضافة معلومات من بوابة العميل",
              note: act.note || "",
            })
          ),
          updatedAt: ts,
        });
      } else if (act.action === "request_agent") {
        await updateDoc(doc(db, "complaints", target.id), {
          publicUpdateNote: "طلب العميل التحدث مع موظف خدمة العملاء",
          escalationLevel: Math.max(1, target.escalationLevel || 0),
          escalationOwner: "موظف خدمة العملاء",
          auditTrail: appendAuditTrail(
            target.auditTrail,
            makeAuditEntry({
              actorName: target.customerName,
              actorRole: "customer_portal",
              fromStatus: target.status,
              toStatus: target.status,
              action: "طلب تواصل مع موظف",
              note: "طلب العميل تحويل البلاغ لمتابعة موظف خدمة العملاء",
            })
          ),
          updatedAt: ts,
        });
      } else if (act.action === "confirm_resolved") {
        await updateDoc(doc(db, "complaints", target.id), {
          customerConfirmed: true,
          csatScore: act.csatScore || 5,
          csatComment: clampStr(act.csatComment, 600),
          status: target.status === "resolved" ? "pending_manager" : target.status,
          publicUpdateNote: `أكد العميل الحل${act.csatScore ? ` بتقييم ${act.csatScore}/5` : ""}`,
          auditTrail: appendAuditTrail(
            target.auditTrail,
            makeAuditEntry({
              actorName: target.customerName,
              actorRole: "customer_portal",
              fromStatus: target.status,
              toStatus: target.status === "resolved" ? "pending_manager" : target.status,
              action: "تأكيد العميل للحل وتقييم الرضا CSAT",
              note: `التقييم: ${act.csatScore || 5}/5 ${act.csatComment || ""}`.trim(),
            })
          ),
          updatedAt: ts,
        });
      } else if (act.action === "reopen") {
        await updateDoc(doc(db, "complaints", target.id), {
          status: "reopened",
          customerConfirmed: false,
          reopenCount: (target.reopenCount || 0) + 1,
          reopenReason: clampStr(act.note, 400, "المشكلة ما زالت قائمة"),
          previousSolution: clampStr(target.resolutionEvidence || target.closureReason, 600),
          publicUpdateNote: `أعاد العميل فتح الشكوى: ${act.note || ""}`,
          auditTrail: appendAuditTrail(
            target.auditTrail,
            makeAuditEntry({
              actorName: target.customerName,
              actorRole: "customer_portal",
              fromStatus: target.status,
              toStatus: "reopened",
              action: "إعادة فتح الشكوى من بوابة العميل",
              note: act.note || "المشكلة مستمرة",
            })
          ),
          updatedAt: ts,
        });
      }
      ackActionIds.push(act.id);
    } catch {
      // Retry next sync cycle if permissions differ
    }
  }

  return { ackCreateIds, ackActionIds };
}

export async function createCallLogRecord(params: {
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
}): Promise<string> {
  try {
    const ref = doc(collection(db, "call_logs"));
    await setDoc(ref, {
      callerName: clampStr(params.callerName, FIELD_LIMITS.NAME_MAX, "متصل"),
      callerPhone: clampStr(params.callerPhone, FIELD_LIMITS.PHONE_MAX, "+966500000000"),
      branch: clampStr(params.branch, FIELD_LIMITS.BRANCH_MAX, FANAR_BRANCHES[0]),
      durationSeconds: Math.max(0, Math.min(86400, Math.round(params.durationSeconds))),
      handledBy: params.handledBy,
      transcript: clampStr(params.transcript, FIELD_LIMITS.TRANSCRIPT_MAX, "مكالمة خدمة عملاء"),
      aiSummary: clampStr(params.aiSummary, FIELD_LIMITS.SUMMARY_MAX, ""),
      linkedTicketCode: clampStr(params.linkedTicketCode, 32, ""),
      codeSentViaWhatsapp: params.codeSentViaWhatsapp,
      ownerId: params.ownerId,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, "call_logs");
  }
}
