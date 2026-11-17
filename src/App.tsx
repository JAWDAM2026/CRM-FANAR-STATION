/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import {
  BarChart3,
  ClipboardCheck,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  PhoneCall,
  Plus,
  ShieldCheck,
  Sun,
  Users,
  X,
} from "lucide-react";
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from "./lib/firebase";
import {
  applyCustomerPortalPendingSync,
  ensureUserProfile,
  seedEnrichedMultiMonthData,
  seedInitialFanarDataIfEmpty,
} from "./lib/crmService";
import {
  ActionPlanItem,
  CallLog,
  Complaint,
  Conversation,
  Customer,
  DEFAULT_WHATSAPP_BOT_CONFIG,
  getComplaintEffectiveDate,
  OFFICIAL_WHATSAPP_NUMBER,
  QualityAudit,
  resolveComplaintSlaTier,
  USER_ROLE_LABELS,
  UserProfile,
  UserRole,
  WhatsappBotConfig,
} from "./types/crm";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { FanarLogo } from "./components/FanarLogo";
import { LoginScreen } from "./components/LoginScreen";
import { OverviewView } from "./components/OverviewView";
import { WhatsAppHub } from "./components/WhatsAppHub";
import { CallCenterView } from "./components/CallCenterView";
import { ComplaintsRegistryView } from "./components/ComplaintsRegistryView";
import { ManagerPortalView } from "./components/ManagerPortalView";
import { CustomersView } from "./components/CustomersView";
import { ExecutiveReportsView } from "./components/ExecutiveReportsView";
import { QualityGovernanceView } from "./components/QualityGovernanceView";
import {
  ComplaintDetailModal,
  NewComplaintModal,
} from "./components/ComplaintModals";
import { PrintModal, PrintMode } from "./components/PrintTemplates";
import { ThemePreference, ThemeView } from "./components/ThemeView";
import { NotificationPermissionControl } from "./components/NotificationPermissionControl";
import {
  BrowserNotificationPermissionState,
  getBrowserNotificationPermission,
  playNotificationChime,
  requestBrowserNotificationPermission,
  sendBrowserNotification,
} from "./lib/browserNotifications";

type NavTab =
  | "overview"
  | "whatsapp"
  | "calls"
  | "complaints"
  | "manager"
  | "reports"
  | "quality"
  | "customers"
  | "theme";

const NAV_ITEMS: Array<{
  key: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "overview", label: "لوحة العمليات", icon: LayoutDashboard },
  { key: "whatsapp", label: "الواتساب الذكي", icon: MessageSquare },
  { key: "calls", label: "الاتصالات والرد الآلي", icon: PhoneCall },
  { key: "complaints", label: "سجلات الشكاوى والطباعة", icon: FileSpreadsheet },
  { key: "manager", label: "بوابة مدير خدمة العملاء", icon: ShieldCheck },
  { key: "reports", label: "التقارير التنفيذية الشهرية", icon: BarChart3 },
  { key: "quality", label: "الجودة وخطة العمل والحوكمة", icon: ClipboardCheck },
  { key: "customers", label: "دليل العملاء", icon: Users },
  { key: "theme", label: "المظهر الفاتح والداكن", icon: Sun },
];

function sortByCreatedDesc<T extends { createdAt?: Timestamp }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
  );
}

function sortByUpdatedDesc<T extends { updatedAt?: Timestamp }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0)
  );
}

function FanarCrmWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<NavTab>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [viewRoleOverride, setViewRoleOverride] = useState<UserRole>("system_admin");

  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    try {
      const saved = window.localStorage.getItem("fanar-theme");
      if (saved === "light" || saved === "dark" || saved === "system") {
        return saved;
      }
    } catch {
      // Ignore storage errors
    }
    return "light";
  });

  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const resolvedTheme: "light" | "dark" =
    themePreference === "system" ? (systemDark ? "dark" : "light") : themePreference;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    try {
      window.localStorage.setItem("fanar-theme", themePreference);
    } catch {
      // Ignore storage errors
    }
  }, [resolvedTheme, themePreference]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [qualityAudits, setQualityAudits] = useState<QualityAudit[]>([]);
  const [actionPlans, setActionPlans] = useState<ActionPlanItem[]>([]);
  const [teamUsers, setTeamUsers] = useState<UserProfile[]>([]);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [botConfig, setBotConfig] = useState<
    Omit<WhatsappBotConfig, "ownerId" | "updatedBy" | "createdAt" | "updatedAt">
  >(DEFAULT_WHATSAPP_BOT_CONFIG);

  const [showNewComplaint, setShowNewComplaint] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [printMode, setPrintMode] = useState<PrintMode | null>(null);
  const [toastState, setToastState] = useState<{
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);
  const [requestedWhatsappConvId, setRequestedWhatsappConvId] = useState<string | null>(null);

  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermissionState>(() => getBrowserNotificationPermission());
  const [notificationsMuted, setNotificationsMuted] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem("fanar-notifications-muted") === "true";
    } catch {
      return false;
    }
  });

  const isBootstrappedManager =
    user?.email === "aammj227@gmail.com" && user?.emailVerified === true;
  const hasManagerPrivilege =
    isBootstrappedManager ||
    profile?.role === "manager" ||
    profile?.role === "system_admin";
  const effectiveRole: UserRole = hasManagerPrivilege
    ? viewRoleOverride
    : profile?.role || "agent";

  const notificationsMutedRef = useRef(notificationsMuted);
  notificationsMutedRef.current = notificationsMuted;
  const effectiveRoleRef = useRef<UserRole>(effectiveRole);
  effectiveRoleRef.current = effectiveRole;
  const toastTimerRef = useRef<number | null>(null);
  const portalSyncInFlightRef = useRef(false);

  const complaintsBaselineReadyRef = useRef(false);
  const prevComplaintsMapRef = useRef<Map<string, Complaint["status"]>>(new Map());
  const conversationsBaselineReadyRef = useRef(false);
  const prevConversationsMapRef = useRef<Map<string, Conversation["handoffStatus"] | undefined>>(
    new Map()
  );

  useEffect(() => {
    try {
      window.localStorage.setItem("fanar-notifications-muted", String(notificationsMuted));
    } catch {
      // Ignore storage errors
    }
  }, [notificationsMuted]);

  useEffect(() => {
    const syncPermission = () => {
      setNotificationPermission(getBrowserNotificationPermission());
    };
    window.addEventListener("focus", syncPermission);
    document.addEventListener("visibilitychange", syncPermission);
    return () => {
      window.removeEventListener("focus", syncPermission);
      document.removeEventListener("visibilitychange", syncPermission);
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setAuthReady(true);
        return;
      }

      try {
        const isAdminEmail =
          firebaseUser.email === "aammj227@gmail.com" &&
          firebaseUser.emailVerified === true;
        const userProf = await ensureUserProfile({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || "موظف خدمة العملاء",
          email: firebaseUser.email || "",
          isBootstrappedAdmin: isAdminEmail,
        });
        setProfile(userProf);
        setViewRoleOverride(isAdminEmail ? "system_admin" : userProf.role);
        await seedInitialFanarDataIfEmpty(
          firebaseUser.uid,
          userProf.displayName,
          isAdminEmail
        );
      } catch (err) {
        console.error("Profile init error:", err);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      setCustomers([]);
      setComplaints([]);
      setConversations([]);
      setCallLogs([]);
      setQualityAudits([]);
      setActionPlans([]);
      setTeamUsers([]);
      complaintsBaselineReadyRef.current = false;
      prevComplaintsMapRef.current.clear();
      conversationsBaselineReadyRef.current = false;
      prevConversationsMapRef.current.clear();
      return;
    }

    const useAllScope = isBootstrappedManager;

    const customersQuery = useAllScope
      ? query(collection(db, "customers"), orderBy("createdAt", "desc"))
      : query(collection(db, "customers"), where("ownerId", "==", user.uid));

    const complaintsQuery = useAllScope
      ? query(collection(db, "complaints"), orderBy("createdAt", "desc"))
      : query(collection(db, "complaints"), where("ownerId", "==", user.uid));

    const conversationsQuery = useAllScope
      ? query(collection(db, "conversations"), orderBy("updatedAt", "desc"))
      : query(collection(db, "conversations"), where("ownerId", "==", user.uid));

    const callLogsQuery = useAllScope
      ? query(collection(db, "call_logs"), orderBy("createdAt", "desc"))
      : query(collection(db, "call_logs"), where("ownerId", "==", user.uid));

    const qualityAuditsQuery = useAllScope
      ? query(collection(db, "quality_audits"), orderBy("createdAt", "desc"))
      : query(collection(db, "quality_audits"), where("ownerId", "==", user.uid));

    const actionPlansQuery = useAllScope
      ? query(collection(db, "action_plans"), orderBy("createdAt", "desc"))
      : query(collection(db, "action_plans"), where("ownerId", "==", user.uid));

    const teamUsersQuery = useAllScope
      ? query(collection(db, "users"), orderBy("createdAt", "desc"))
      : query(collection(db, "users"), where("uid", "==", user.uid));

    const unsubCust = onSnapshot(
      customersQuery,
      (snap) => {
        setCustomers(
          sortByCreatedDesc(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Customer, "id">) }))
          )
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "customers")
    );

    const unsubComp = onSnapshot(
      complaintsQuery,
      (snap) => {
        const next = sortByCreatedDesc(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Complaint, "id">) }))
        );
        setComplaints(next);
        setSelectedComplaint((prev) =>
          prev ? next.find((item) => item.id === prev.id) || null : null
        );

        if (!complaintsBaselineReadyRef.current) {
          const initialMap = new Map<string, Complaint["status"]>();
          next.forEach((c) => initialMap.set(c.id, c.status));
          prevComplaintsMapRef.current = initialMap;
          complaintsBaselineReadyRef.current = true;
          return;
        }

        const prevMap = prevComplaintsMapRef.current;
        const role = effectiveRoleRef.current;
        const isMuted = notificationsMutedRef.current;
        const alerts: Array<{
          title: string;
          body: string;
          tag: string;
          actionLabel: string;
          onAction: () => void;
        }> = [];

        next.forEach((c) => {
          const existed = prevMap.has(c.id);
          const prevStatus = prevMap.get(c.id);

          if (!existed) {
            if (c.status === "pending_manager" && (role === "manager" || role === "system_admin")) {
              alerts.push({
                title: `شكوى جديدة بانتظار اعتماد المدير · ${c.ticketCode}`,
                body: `${c.customerName} — ${c.branch}`,
                tag: `fanar-comp-mgr-${c.id}`,
                actionLabel: "مراجعة الشكوى",
                onAction: () => {
                  setActiveTab("manager");
                  setSelectedComplaint(c);
                },
              });
            } else if (c.status !== "closed") {
              alerts.push({
                title: `وصول شكوى جديدة · ${c.ticketCode}`,
                body: `${c.customerName} — ${c.branch}`,
                tag: `fanar-comp-new-${c.id}`,
                actionLabel: "عرض الشكوى",
                onAction: () => {
                  setSelectedComplaint(c);
                },
              });
            }
          } else if (
            prevStatus !== "pending_manager" &&
            c.status === "pending_manager" &&
            (role === "manager" || role === "system_admin")
          ) {
            alerts.push({
              title: `تحويل شكوى لاعتماد المدير · ${c.ticketCode}`,
              body: `${c.customerName} — ${c.branch}`,
              tag: `fanar-comp-escalate-${c.id}`,
              actionLabel: "فتح بوابة المدير",
              onAction: () => {
                setActiveTab("manager");
                setSelectedComplaint(c);
              },
            });
          }
        });

        const updatedMap = new Map<string, Complaint["status"]>();
        next.forEach((c) => updatedMap.set(c.id, c.status));
        prevComplaintsMapRef.current = updatedMap;

        if (!isMuted && alerts.length > 0) {
          playNotificationChime();
          alerts.slice(0, 3).forEach((alert) => {
            sendBrowserNotification({
              title: alert.title,
              body: alert.body,
              tag: alert.tag,
              onClick: alert.onAction,
            });
          });
          const latest = alerts[0];
          showToast(`${latest.title} (${latest.body})`, {
            actionLabel: latest.actionLabel,
            onAction: latest.onAction,
          });
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "complaints")
    );

    const unsubConv = onSnapshot(
      conversationsQuery,
      (snap) => {
        const next = sortByUpdatedDesc(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Conversation, "id">),
          }))
        );
        setConversations(next);

        if (!conversationsBaselineReadyRef.current) {
          const initialMap = new Map<string, Conversation["handoffStatus"] | undefined>();
          next.forEach((conv) => initialMap.set(conv.id, conv.handoffStatus));
          prevConversationsMapRef.current = initialMap;
          conversationsBaselineReadyRef.current = true;
          return;
        }

        const prevMap = prevConversationsMapRef.current;
        const isMuted = notificationsMutedRef.current;
        const escalations: Array<{
          title: string;
          body: string;
          tag: string;
          onAction: () => void;
        }> = [];

        next.forEach((conv) => {
          const prevHandoff = prevMap.get(conv.id);
          if (
            prevHandoff !== "escalated_to_agent" &&
            conv.handoffStatus === "escalated_to_agent"
          ) {
            escalations.push({
              title: "تصعيد محادثة واتساب لموظف خدمة العملاء",
              body: `${conv.customerName}${conv.handoffReason ? ` — ${conv.handoffReason}` : ""}`,
              tag: `fanar-wa-escalate-${conv.id}`,
              onAction: () => {
                setRequestedWhatsappConvId(conv.id);
                setActiveTab("whatsapp");
              },
            });
          }
        });

        const updatedMap = new Map<string, Conversation["handoffStatus"] | undefined>();
        next.forEach((conv) => updatedMap.set(conv.id, conv.handoffStatus));
        prevConversationsMapRef.current = updatedMap;

        if (!isMuted && escalations.length > 0) {
          playNotificationChime();
          escalations.slice(0, 3).forEach((esc) => {
            sendBrowserNotification({
              title: esc.title,
              body: esc.body,
              tag: esc.tag,
              onClick: esc.onAction,
            });
          });
          const latest = escalations[0];
          showToast(`${latest.title}: ${latest.body}`, {
            actionLabel: "فتح المحادثة",
            onAction: latest.onAction,
          });
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "conversations")
    );

    const unsubCalls = onSnapshot(
      callLogsQuery,
      (snap) => {
        setCallLogs(
          sortByCreatedDesc(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CallLog, "id">) }))
          )
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "call_logs")
    );

    const botConfigPath = `bot_configs/${user.uid}`;
    const unsubBotConfig = onSnapshot(
      doc(db, "bot_configs", user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as WhatsappBotConfig;
          setBotConfig({
            botName: data.botName || DEFAULT_WHATSAPP_BOT_CONFIG.botName,
            officialWhatsappNumber:
              data.officialWhatsappNumber || DEFAULT_WHATSAPP_BOT_CONFIG.officialWhatsappNumber,
            welcomeMessage: data.welcomeMessage || DEFAULT_WHATSAPP_BOT_CONFIG.welcomeMessage,
            toneInstruction: data.toneInstruction || DEFAULT_WHATSAPP_BOT_CONFIG.toneInstruction,
            autoEscalateComplex:
              typeof data.autoEscalateComplex === "boolean"
                ? data.autoEscalateComplex
                : DEFAULT_WHATSAPP_BOT_CONFIG.autoEscalateComplex,
            escalationMessage:
              data.escalationMessage || DEFAULT_WHATSAPP_BOT_CONFIG.escalationMessage,
            workingHoursSummary:
              data.workingHoursSummary || DEFAULT_WHATSAPP_BOT_CONFIG.workingHoursSummary,
            productsInfo: data.productsInfo || DEFAULT_WHATSAPP_BOT_CONFIG.productsInfo,
            servicesInfo: data.servicesInfo || DEFAULT_WHATSAPP_BOT_CONFIG.servicesInfo,
            branchesInfo: data.branchesInfo || DEFAULT_WHATSAPP_BOT_CONFIG.branchesInfo,
            faqs: Array.isArray(data.faqs) ? data.faqs : DEFAULT_WHATSAPP_BOT_CONFIG.faqs,
          });
        } else {
          setBotConfig(DEFAULT_WHATSAPP_BOT_CONFIG);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, botConfigPath)
    );

    const unsubQualityAudits = onSnapshot(
      qualityAuditsQuery,
      (snap) => {
        setQualityAudits(
          sortByCreatedDesc(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<QualityAudit, "id">),
            }))
          )
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "quality_audits")
    );

    const unsubActionPlans = onSnapshot(
      actionPlansQuery,
      (snap) => {
        setActionPlans(
          sortByCreatedDesc(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<ActionPlanItem, "id">),
            }))
          )
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "action_plans")
    );

    const unsubTeamUsers = onSnapshot(
      teamUsersQuery,
      (snap) => {
        setTeamUsers(
          sortByCreatedDesc(
            snap.docs.map((d) => d.data() as UserProfile)
          )
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "users")
    );

    return () => {
      unsubCust();
      unsubComp();
      unsubConv();
      unsubCalls();
      unsubBotConfig();
      unsubQualityAudits();
      unsubActionPlans();
      unsubTeamUsers();
    };
  }, [authReady, user, isBootstrappedManager]);

  // Bidirectional Sync between Firestore CRM and Public Customer Portal
  const syncDepsRef = useRef({
    user,
    profile,
    complaints,
    customers,
    conversations,
  });
  syncDepsRef.current = { user, profile, complaints, customers, conversations };

  useEffect(() => {
    if (!authReady || !user) return;

    async function runPortalSync() {
      const snap = syncDepsRef.current;
      if (!snap.user || portalSyncInFlightRef.current) return;
      portalSyncInFlightRef.current = true;
      try {
        const serializedTickets = snap.complaints.map((c) => ({
          ticketCode: c.ticketCode,
          customerName: c.customerName,
          customerPhone: c.customerPhone,
          branch: c.branch,
          stationUnknown: Boolean(c.stationUnknown),
          pumpNumber: c.pumpNumber,
          category: c.category,
          priority: c.priority,
          slaTier: resolveComplaintSlaTier(c),
          status: c.status,
          description: c.description,
          attachmentMeta: c.attachmentMeta,
          publicUpdateNote: c.publicUpdateNote || c.aiSummary || "",
          resolutionEvidence: c.resolutionEvidence || c.closureReason || "",
          customerConfirmed: Boolean(c.customerConfirmed),
          csatScore: c.csatScore,
          csatComment: c.csatComment,
          reopenCount: c.reopenCount || 0,
          reopenReason: c.reopenReason,
          previousSolution: c.previousSolution,
          createdAtIso: getComplaintEffectiveDate(c).toISOString(),
          updatedAtIso: (c.updatedAt?.toDate?.() || getComplaintEffectiveDate(c)).toISOString(),
          customerTimeline: Array.isArray(c.auditTrail)
            ? c.auditTrail.map((entry) => ({
                timestamp: entry.timestamp,
                label: entry.action,
              }))
            : [],
        }));

        const syncRes = await fetch("/api/portal/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tickets: serializedTickets }),
        });
        if (!syncRes.ok) return;
        const payload = await syncRes.json();
        const pendingCreates = Array.isArray(payload.pendingCreates)
          ? payload.pendingCreates
          : [];
        const pendingActions = Array.isArray(payload.pendingActions)
          ? payload.pendingActions
          : [];

        if (pendingCreates.length > 0 || pendingActions.length > 0) {
          const { ackCreateIds, ackActionIds } = await applyCustomerPortalPendingSync({
            ownerId: snap.user.uid,
            agentName: snap.profile?.displayName || snap.user.displayName || "فريق خدمة العملاء",
            complaints: snap.complaints,
            customers: snap.customers,
            conversations: snap.conversations,
            pendingCreates,
            pendingActions,
          });
          if (ackCreateIds.length > 0 || ackActionIds.length > 0) {
            await fetch("/api/portal/pending-sync/ack", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ createIds: ackCreateIds, actionIds: ackActionIds }),
            });
          }
        }
      } catch {
        // Ignore transient network sync failures
      } finally {
        portalSyncInFlightRef.current = false;
      }
    }

    void runPortalSync();
    const timer = window.setInterval(() => void runPortalSync(), 12000);
    return () => window.clearInterval(timer);
  }, [authReady, user, complaints.length]);

  async function handleGoogleSignIn() {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : "تعذر إتمام تسجيل الدخول عبر Google. يرجى المحاولة مرة أخرى."
      );
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleSignOut() {
    await signOut(auth);
  }

  function showToast(
    msg: string,
    options?: { actionLabel?: string; onAction?: () => void }
  ) {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastState({
      message: msg,
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
    });
    toastTimerRef.current = window.setTimeout(() => {
      setToastState(null);
      toastTimerRef.current = null;
    }, 6500);
  }

  async function handleRequestBrowserNotifications() {
    const result = await requestBrowserNotificationPermission();
    setNotificationPermission(result);
    if (result === "granted") {
      setNotificationsMuted(false);
      playNotificationChime();
      sendBrowserNotification({
        title: "تم تفعيل إشعارات فنار الطاقة للوقود",
        body: "ستصلكم التنبيهات الفورية عند وصول شكوى جديدة أو تصعيد حالة واتساب.",
        tag: "fanar-notifications-enabled",
      });
      showToast("تم تفعيل إشعارات المتصفح الفورية بنجاح.");
    } else if (result === "denied") {
      showToast(
        "تم حظر إشعارات المتصفح من إعدادات الموقع. يمكنك السماح بها من أيقونة القفل في شريط العنوان."
      );
    } else {
      showToast("لم يتم منح إذن إشعارات المتصفح بعد.");
    }
  }

  function handleToggleNotificationsMute() {
    setNotificationsMuted((prev) => {
      const next = !prev;
      if (!next) {
        playNotificationChime();
        showToast("تمت إعادة تفعيل تنبيهات المتصفح والصوت.");
      } else {
        showToast("تم كتم إشعارات المتصفح ونغمة التنبيه مؤقتاً.");
      }
      return next;
    });
  }

  function handleBlockedNotificationsInfo() {
    showToast(
      "إشعارات المتصفح محظورة في إعدادات المتصفح؛ افتح إعدادات الموقع من شريط العنوان واختر السماح للإشعارات."
    );
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] dark:bg-slate-950 flex items-center justify-center">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-8 py-6 text-center space-y-3">
          <FanarLogo variant="dark" size="md" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            جاري تهيئة منظومة فنار الطاقة للوقود...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        onSignIn={handleGoogleSignIn}
        isLoading={isSigningIn}
        error={authError}
        resolvedTheme={resolvedTheme}
        onToggleTheme={() =>
          setThemePreference(resolvedTheme === "dark" ? "light" : "dark")
        }
      />
    );
  }

  async function handleBackfillHistoricalData() {
    if (!user || isBackfilling) return;
    setIsBackfilling(true);
    try {
      await seedEnrichedMultiMonthData(
        user.uid,
        profile?.displayName || user.displayName || "مدير خدمة العملاء",
        isBootstrappedManager || effectiveRole === "manager" || effectiveRole === "system_admin"
      );
      showToast("تمت تهيئة بيانات 6 أشهر وتقييمات الجودة وخطة العمل بنجاح.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "تعذر تهيئة البيانات التاريخية.");
    } finally {
      setIsBackfilling(false);
    }
  }

  const scopedComplaints =
    effectiveRole === "station_supervisor" && profile?.branch
      ? complaints.filter((c) => c.branch === profile.branch)
      : complaints;

  const activeNavLabel =
    NAV_ITEMS.find((item) => item.key === activeTab)?.label || "لوحة العمليات";
  const pendingManagerCount = scopedComplaints.filter(
    (c) => c.status === "pending_manager"
  ).length;
  const escalatedWhatsappCount = conversations.filter(
    (c) => c.handoffStatus === "escalated_to_agent"
  ).length;

  return (
    <div className="min-h-screen bg-[#F5F7FA] dark:bg-slate-950 flex">
      {/* Desktop Sidebar (260px, Fanar Deep Navy) */}
      <aside className="no-print hidden lg:flex w-[260px] shrink-0 bg-[#1B2E66] dark:bg-slate-900 text-white flex-col justify-between border-l border-[#12204A] dark:border-slate-800">
        <div className="p-5 space-y-7">
          <div className="pb-4 border-b border-white/10">
            <FanarLogo variant="light" size="md" showSubtitle />
          </div>

          <nav className="space-y-1.5" aria-label="القائمة الرئيسية">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-[#961B5E] text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {item.key === "manager" && pendingManagerCount > 0 && (
                    <span className="font-mono text-xs tabular-nums text-white/90">
                      {pendingManagerCount}
                    </span>
                  )}
                  {item.key === "whatsapp" && escalatedWhatsappCount > 0 && (
                    <span className="font-mono text-xs tabular-nums text-amber-300">
                      {escalatedWhatsappCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-5 border-t border-white/10 space-y-4">
          <div className="rounded-lg overflow-hidden border border-white/15 h-24 relative">
            <img
              src="/assets/aistudio/2-_____________f28bff6a.jpg"
              alt="محطة فنار للوقود"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#12204A]/85 via-transparent to-transparent" />
            <span className="absolute bottom-2 right-2.5 text-[11px] font-medium text-white">
              هوية محطات فنار المعتمدة
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              setThemePreference(resolvedTheme === "dark" ? "light" : "dark")
            }
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              {resolvedTheme === "dark" ? (
                <Sun className="w-3.5 h-3.5 text-amber-300" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-sky-200" />
              )}
              <span>{resolvedTheme === "dark" ? "الوضع الداكن مفعّل" : "الوضع الفاتح مفعّل"}</span>
            </span>
            <span className="text-[11px] text-white/75">تبديل</span>
          </button>

          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <p className="font-semibold text-white truncate">
                {profile?.displayName || user.displayName || "موظف فنار"}
              </p>
              <p className="text-white/65 truncate">
                {USER_ROLE_LABELS[effectiveRole]}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              title="تسجيل الخروج"
              className="p-2 rounded-lg text-white/75 hover:bg-white/10 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div className="w-72 bg-[#1B2E66] dark:bg-slate-900 text-white p-5 flex flex-col justify-between border-l border-[#12204A] dark:border-slate-800">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <FanarLogo variant="light" size="sm" />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-white/80 hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.key);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium ${
                        activeTab === item.key
                          ? "bg-[#961B5E] text-white"
                          : "text-white/80 hover:bg-white/10"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="space-y-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() =>
                  setThemePreference(resolvedTheme === "dark" ? "light" : "dark")
                }
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white"
              >
                <span className="inline-flex items-center gap-2">
                  {resolvedTheme === "dark" ? (
                    <Sun className="w-3.5 h-3.5 text-amber-300" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-sky-200" />
                  )}
                  <span>{resolvedTheme === "dark" ? "الوضع الداكن" : "الوضع الفاتح"}</span>
                </span>
                <span className="text-[11px] text-white/75">تبديل</span>
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-2 text-xs text-white/80 hover:text-white"
              >
                <LogOut className="w-4 h-4" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
          <div
            className="flex-1 bg-slate-900/50 dark:bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean 3-Zone Top Header */}
        <header className="no-print bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 lg:px-8 py-3.5 flex items-center justify-between gap-6">
          {/* Zone 1: Breadcrumb + Mobile Menu */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              aria-label="فتح القائمة"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">
                فنار الطاقة للوقود
              </span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
              <h1 className="font-bold text-[#1B2E66] dark:text-slate-100 truncate">
                {activeNavLabel}
              </h1>
            </div>
          </div>

          {/* Zone 2: 5-Role Context Switch (if authorized Manager/Admin) */}
          {hasManagerPrivilege && (
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-slate-400 dark:text-slate-500">معاينة الدور:</span>
              <select
                value={effectiveRole}
                onChange={(e) => setViewRoleOverride(e.target.value as UserRole)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-[#1B2E66] dark:text-slate-100"
              >
                {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map((roleKey) => (
                  <option key={roleKey} value={roleKey}>
                    {USER_ROLE_LABELS[roleKey]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Zone 3: Notification Control & Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            <NotificationPermissionControl
              permission={notificationPermission}
              muted={notificationsMuted}
              onRequestPermission={handleRequestBrowserNotifications}
              onToggleMute={handleToggleNotificationsMute}
              onBlockedInfo={handleBlockedNotificationsInfo}
            />
            <button
              type="button"
              onClick={() => setShowNewComplaint(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#961B5E] hover:bg-[#7A144B] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل شكوى</span>
            </button>
          </div>
        </header>

        {toastState && (
          <div className="no-print mx-5 lg:mx-8 mt-4 p-3.5 rounded-xl bg-[#1B2E66] dark:bg-slate-800 border border-transparent dark:border-slate-700 text-white text-xs flex flex-wrap items-center justify-between gap-3">
            <span>{toastState.message}</span>
            <div className="flex items-center gap-3 shrink-0">
              {toastState.actionLabel && toastState.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    toastState.onAction?.();
                    setToastState(null);
                  }}
                  className="px-2.5 py-1 rounded-md bg-white text-[#1B2E66] font-semibold hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  {toastState.actionLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => setToastState(null)}
                className="text-white/75 hover:text-white whitespace-nowrap"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}

        {/* Viewport Content */}
        <main className="no-print flex-1 p-5 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeTab === "overview" && (
            <OverviewView
              complaints={scopedComplaints}
              customers={customers}
              conversations={conversations}
              callLogs={callLogs}
              resolvedTheme={resolvedTheme}
              onNavigate={(tab) => setActiveTab(tab)}
              onSelectComplaint={(c) => setSelectedComplaint(c)}
              onPrintSummary={() =>
                setPrintMode({
                  type: "register",
                  complaints: scopedComplaints,
                  filterSummary: "كامل سجل شكاوى شركة فنار الطاقة للوقود",
                })
              }
            />
          )}

          {activeTab === "whatsapp" && (
            <WhatsAppHub
              ownerId={user.uid}
              agentName={profile?.displayName || user.displayName || "موظف فنار"}
              isManager={isBootstrappedManager}
              conversations={conversations}
              customers={customers}
              complaints={scopedComplaints}
              botConfig={botConfig}
              requestedConversationId={requestedWhatsappConvId}
              onConsumeRequestedConversation={() => setRequestedWhatsappConvId(null)}
              onOpenComplaint={(c) => setSelectedComplaint(c)}
            />
          )}

          {activeTab === "calls" && (
            <CallCenterView
              ownerId={user.uid}
              agentName={profile?.displayName || user.displayName || "موظف فنار"}
              callLogs={callLogs}
              customers={customers}
              conversations={conversations}
              complaints={scopedComplaints}
              onOpenComplaintByCode={(code) => {
                const found = scopedComplaints.find((c) => c.ticketCode === code);
                if (found) setSelectedComplaint(found);
              }}
            />
          )}

          {activeTab === "complaints" && (
            <ComplaintsRegistryView
              complaints={scopedComplaints}
              onSelectComplaint={(c) => setSelectedComplaint(c)}
              onNewComplaint={() => setShowNewComplaint(true)}
              onPrintSingle={(c) => setPrintMode({ type: "single", complaint: c })}
              onPrintRegister={(filtered, filterSummary) =>
                setPrintMode({ type: "register", complaints: filtered, filterSummary })
              }
            />
          )}

          {activeTab === "manager" && (
            <ManagerPortalView
              ownerId={user.uid}
              managerName={profile?.displayName || user.displayName || "مدير خدمة العملاء"}
              canCloseAsManager={
                hasManagerPrivilege &&
                (effectiveRole === "manager" || effectiveRole === "system_admin")
              }
              complaints={scopedComplaints}
              conversations={conversations}
              onPrintSingle={(c) => setPrintMode({ type: "single", complaint: c })}
              onPrintRegister={(filtered, summary) =>
                setPrintMode({
                  type: "register",
                  complaints: filtered,
                  filterSummary: summary,
                })
              }
            />
          )}

          {activeTab === "reports" && (
            <ExecutiveReportsView
              complaints={scopedComplaints}
              conversations={conversations}
              isDark={resolvedTheme === "dark"}
              onPrintReport={() =>
                setPrintMode({
                  type: "register",
                  complaints: scopedComplaints,
                  filterSummary: "التقرير التنفيذي الشهري المجمع — شركة فنار الطاقة للوقود",
                })
              }
              onBackfillHistoricalData={handleBackfillHistoricalData}
              isBackfilling={isBackfilling}
            />
          )}

          {activeTab === "quality" && (
            <QualityGovernanceView
              ownerId={user.uid}
              actorName={profile?.displayName || user.displayName || "فريق الجودة"}
              complaints={scopedComplaints}
              qualityAudits={qualityAudits}
              actionPlans={actionPlans}
              teamUsers={teamUsers}
              canManageRoles={
                hasManagerPrivilege &&
                (effectiveRole === "system_admin" || effectiveRole === "manager")
              }
              onBackfillHistoricalData={handleBackfillHistoricalData}
              isBackfilling={isBackfilling}
            />
          )}

          {activeTab === "customers" && (
            <CustomersView ownerId={user.uid} customers={customers} />
          )}

          {activeTab === "theme" && (
            <ThemeView
              themePreference={themePreference}
              resolvedTheme={resolvedTheme}
              onChangeTheme={setThemePreference}
            />
          )}
        </main>
      </div>

      {/* Modals & Official Print Renderer */}
      <NewComplaintModal
        open={showNewComplaint}
        onClose={() => setShowNewComplaint(false)}
        ownerId={user.uid}
        agentName={profile?.displayName || user.displayName || "موظف فنار"}
        customers={customers}
        conversations={conversations}
        complaints={complaints}
        onCreated={(code) =>
          showToast(`تم تسجيل الشكوى بنجاح برمز (${code}) وإرسال الإشعار عبر الواتساب.`)
        }
      />

      <ComplaintDetailModal
        complaint={selectedComplaint}
        onClose={() => setSelectedComplaint(null)}
        ownerId={user.uid}
        agentName={profile?.displayName || user.displayName || "موظف فنار"}
        actorRole={effectiveRole}
        conversations={conversations}
        onPrint={(c) => setPrintMode({ type: "single", complaint: c })}
        onGoToManagerPortal={() => setActiveTab("manager")}
      />

      <PrintModal
        mode={printMode}
        officialWhatsappNumber={botConfig.officialWhatsappNumber || OFFICIAL_WHATSAPP_NUMBER}
        onClose={() => setPrintMode(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FanarCrmWorkspace />
    </ErrorBoundary>
  );
}
