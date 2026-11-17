# Security Specification — Fanar Energy Fuel CRM

## 1. Data Invariants
1. **Authenticated & Verified Access**: Every Firestore read/write requires `request.auth != null && request.auth.token.email_verified == true`. Unauthenticated Customer Portal submissions/tracking are strictly isolated behind server API routes (`/api/portal/*`) with dual `ticketCode + customerPhone` verification and internal note redaction.
2. **Ownership & 5-Role RBAC**: Staff roles (`agent`, `station_supervisor`, `manager`, `quality_auditor`, `system_admin`) cannot self-escalate upon user profile creation (non-bootstrapped accounts start as `agent`; only `isManager()` / `isAdmin()` can assign elevated roles). Non-admin users can only query/update documents scoped to `ownerId == request.auth.uid`.
3. **Referential Integrity**: A `complaint` cannot be created unless its referenced `customerId` exists (`existsAfter`), and `quality_audits` records must reference an existing `complaintId` (`exists(...)`).
4. **Immutable Audit Fields**: `createdAt`, `ownerId`, `ticketCode`, and `customerId` are immutable after creation.
5. **Lifecycle Transition Discipline**: Complaints CANNOT jump directly from `status == 'new'` to `status == 'closed'`. Once a complaint reaches `closed`, agents cannot arbitrarily mutate it; only `isManager()` or a documented `reopened` transition (`reopenCount == existing + 1`) is allowed.
6. **Temporal Integrity & SLA Pause Accounting**: `createdAt` and `updatedAt` must equal `request.time`. Bounded `auditTrail` arrays (`<= 30` entries) validate element 0 structure per Pillar 5.
7. **Bot Config, Quality Audits & Action Plans**: `/quality_audits` scores are strictly bounded `0..100`; `/action_plans` enforce bounded text lengths and explicit status enums.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read on `/complaints` or `/quality_audits` -> Denied (default-deny + `isSignedIn()`).
2. Unverified email user attempting to create a customer -> Denied (`email_verified == true` check).
3. Self-escalation: staff creating `/users/{uid}` with `role: 'manager'` or `role: 'system_admin'` -> Denied.
4. Direct lifecycle shortcut attack: updating a `complaint` directly from `status: 'new'` to `status: 'closed'` -> Denied.
5. Shadow field injection: updating `/complaints/{id}` or `/quality_audits/{id}` with extra `{ isApproved: true }` -> Denied (`affectedKeys().hasOnly(...)` + `keys().hasOnly(...)`).
6. Oversized `auditTrail` (> 30 items) or malformed `auditTrail[0]` entry -> Denied (Pillar 5 guard).
7. Quality score poisoning: setting `problemUnderstanding: 500` in `/quality_audits/{id}` -> Denied (`0..100` integer check).
8. Agent closing their own complaint (`status: 'closed'`) -> Denied (only `isManager()` branch permits `closed`).
9. Timestamp spoofing (`createdAt` backdated to 2020) -> Denied (`== request.time`).
10. Orphaned quality audit referencing non-existent `complaintId` -> Denied (`exists()`).
11. Cross-tenant list scraping on `/complaints`, `/quality_audits`, or `/action_plans` without `ownerId == request.auth.uid` -> Denied (`allow list` enforces `resource.data.ownerId == request.auth.uid || isBootstrappedAdmin()`).
12. Mutating `ownerId`, `ticketCode`, or `customerId` during update -> Denied.
