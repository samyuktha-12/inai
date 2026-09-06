import {
  schema,
  table,
  t,
  SenderError,
  Router,
  SyncResponse,
  type Request,
  type ReducerCtx,
  type InferSchema,
} from 'spacetimedb/server';

const ROLES = ['couple', 'planner', 'family', 'guest'] as const;
type Role = (typeof ROLES)[number];

const SIDES = ['bride', 'groom'] as const;
type Side = (typeof SIDES)[number];

const INGEST_KINDS = ['pinterest', 'whatsapp', 'guests', 'quotes', 'calendar', 'vendor_details'] as const;
type IngestKind = (typeof INGEST_KINDS)[number];

const WEDDING_AGENT_KINDS = ['coordinator', 'decision', 'guest_logistics', 'vendor_liaison', 'menu_planner'] as const;
type WeddingAgentKind = (typeof WEDDING_AGENT_KINDS)[number];

const participant = table(
  {
    name: 'participant',
    public: true,
    indexes: [
      { accessor: 'by_phone', algorithm: 'btree', columns: ['phone'] },
    ],
  },
  {
    identity: t.identity().primaryKey(),
    name: t.string(),
    connected: t.bool(),
    role: t.string().default('guest'),
    side: t.option(t.string()).default(undefined),
    // E.164 phone number, used to resolve a voice caller who has no app
    // identity of their own (e.g. a parent) to their participant row.
    phone: t.option(t.string()).default(undefined),
    // These fields are appended so existing participant rows migrate safely.
    dateOfBirth: t.option(t.string()).default(undefined),
    gender: t.option(t.string()).default(undefined),
    mealPreference: t.option(t.string()).default(undefined),
    profileState: t.string().default('unknown'),
    profileSource: t.string().default('manual'),
    profileUpdatedAt: t.option(t.timestamp()).default(undefined),
    // Keep this field in sync with the deployed schema. Client bindings are
    // generated from this definition; omitting an appended deployed field
    // makes the client decoder read past the participant row payload.
    preferredLanguage: t.string().default('English'),
  }
);

// A person has one global identity and profile, but can take a different role
// and side in every wedding they belong to.
const member = table(
  {
    name: 'member',
    public: true,
    indexes: [
      { accessor: 'by_wedding_identity', algorithm: 'btree', columns: ['weddingId', 'identity'] },
      { accessor: 'by_identity', algorithm: 'btree', columns: ['identity'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    weddingId: t.u64(),
    identity: t.identity(),
    role: t.string(),
    side: t.option(t.string()).default(undefined),
    joinedAt: t.timestamp(),
    state: t.string().default('confirmed'),
    source: t.string().default('manual'),
    updatedBy: t.identity(),
    confidence: t.f32().default(1),
    updatedAt: t.timestamp(),
  }
);

// Bearer invite tokens are deliberately private: recipients redeem a token
// through a reducer, while only the module can look up the pending invite.
const wedding_invitation = table(
  { name: 'wedding_invitation', indexes: [{ accessor: 'by_code', algorithm: 'btree', columns: ['code'] }] },
  {
    id: t.u64().primaryKey().autoInc(),
    weddingId: t.u64(),
    code: t.string(),
    role: t.string(),
    side: t.option(t.string()).default(undefined),
    status: t.string(),
    createdBy: t.identity(),
    createdAt: t.timestamp(),
    acceptedBy: t.option(t.identity()).default(undefined),
    acceptedAt: t.option(t.timestamp()).default(undefined),
  }
);

// Phase 0's shared wedding surface.  The agent layer may propose values for
// these records, but it must use the reported-state reducers below; a reducer
// never reaches out to Pinterest, WhatsApp, maps, or telephony itself.
const wedding = table(
  { name: 'wedding', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    createdBy: t.identity(),
    brideName: t.string(),
    groomName: t.string(),
    city: t.string(),
    dateLabel: t.string(),
    state: t.string().default('confirmed'),
    source: t.string().default('manual'),
    updatedBy: t.identity(),
    confidence: t.f32().default(1),
    updatedAt: t.timestamp(),
  }
);

const event = table(
  { name: 'event', public: true, indexes: [{ accessor: 'by_wedding', algorithm: 'btree', columns: ['weddingId'] }] },
  {
    id: t.u64().primaryKey().autoInc(),
    weddingId: t.u64(),
    title: t.string(),
    startsAt: t.option(t.timestamp()).default(undefined),
    venue: t.option(t.string()).default(undefined),
    state: t.string().default('reported'),
    source: t.string().default('manual'),
    updatedBy: t.identity(),
    confidence: t.f32().default(1),
    updatedAt: t.timestamp(),
    // A human-marked milestone in the shared run of show.
    isCheckpoint: t.bool().default(false),
  }
);

const expense = table(
  { name: 'expense', public: true, indexes: [{ accessor: 'by_wedding', algorithm: 'btree', columns: ['weddingId'] }] },
  {
    id: t.u64().primaryKey().autoInc(),
    weddingId: t.u64(),
    category: t.string(),
    label: t.string(),
    amountPaise: t.i64(),
    paid: t.bool(),
    state: t.string().default('reported'),
    source: t.string().default('manual'),
    updatedBy: t.identity(),
    confidence: t.f32().default(1),
    updatedAt: t.timestamp(),
    // Appended for safe schema migration; table field order is persistent.
    vendorId: t.option(t.u64()).default(undefined),
  }
);

// A budget is a human-set planning limit. It is deliberately separate from
// expenses so a quote or a reported amount can never silently become a spend.
const budget = table(
  { name: 'budget', public: true, indexes: [{ accessor: 'by_wedding', algorithm: 'btree', columns: ['weddingId'] }] },
  {
    id: t.u64().primaryKey().autoInc(),
    weddingId: t.u64(),
    amountPaise: t.i64(),
    state: t.string().default('confirmed'),
    source: t.string().default('manual'),
    updatedBy: t.identity(),
    confidence: t.f32().default(1),
    updatedAt: t.timestamp(),
  }
);

// Vendor contact details intentionally stay out of this shared table. The
// shared plan tracks selection and money; any contact channel is handled by a
// separate, consent-gated worker outside the deterministic module.
const vendor = table(
  { name: 'vendor', public: true, indexes: [{ accessor: 'by_wedding', algorithm: 'btree', columns: ['weddingId'] }] },
  {
    id: t.u64().primaryKey().autoInc(),
    weddingId: t.u64(),
    name: t.string(),
    category: t.string(),
    bookingState: t.string().default('shortlisted'),
    note: t.option(t.string()).default(undefined),
    state: t.string().default('confirmed'),
    source: t.string().default('manual'),
    updatedBy: t.identity(),
    confidence: t.f32().default(1),
    updatedAt: t.timestamp(),
  }
);

// This records a human's permission for a future external vendor-contact
// worker. No reducer sends anything; absence of this record means no contact.
const vendor_consent = table(
  { name: 'vendor_consent', public: true, indexes: [{ accessor: 'by_vendor', algorithm: 'btree', columns: ['vendorId'] }] },
  {
    id: t.u64().primaryKey().autoInc(),
    vendorId: t.u64(),
    weddingId: t.u64(),
    consented: t.bool(),
    state: t.string().default('confirmed'),
    source: t.string().default('manual'),
    updatedBy: t.identity(),
    confidence: t.f32().default(1),
    updatedAt: t.timestamp(),
  }
);

// Metadata only. Raw exports/files remain in the external ingest worker and
// are deliberately not replicated to every wedding participant.
const ingest_source = table(
  { name: 'ingest_source', public: true, indexes: [{ accessor: 'by_wedding', algorithm: 'btree', columns: ['weddingId'] }] },
  {
    id: t.u64().primaryKey().autoInc(),
    weddingId: t.u64(),
    kind: t.string(),
    status: t.string(),
    itemCount: t.u32(),
    submittedBy: t.identity(),
    createdAt: t.timestamp(),
  }
);

// This is an assignment record, not a user identity: agents never become
// accountable members and may only propose or coordinate work in the external
// agent layer. Every wedding starts with its Coordinator enabled.
const wedding_agent = table(
  { name: 'wedding_agent', public: true, indexes: [{ accessor: 'by_wedding_kind', algorithm: 'btree', columns: ['weddingId', 'kind'] }] },
  {
    id: t.u64().primaryKey().autoInc(),
    weddingId: t.u64(),
    kind: t.string(),
    enabled: t.bool(),
    state: t.string().default('confirmed'),
    source: t.string().default('manual'),
    updatedBy: t.identity(),
    confidence: t.f32().default(1),
    updatedAt: t.timestamp(),
  }
);

// A couple or planner can tune an assistant's working brief. This stays
// separate from the assignment record so an agent is never granted authority
// merely by being configured.
const wedding_agent_setting = table(
  { name: 'wedding_agent_setting', public: true, indexes: [{ accessor: 'by_wedding_kind', algorithm: 'btree', columns: ['weddingId', 'kind'] }] },
  {
    id: t.u64().primaryKey().autoInc(),
    weddingId: t.u64(),
    kind: t.string(),
    instructions: t.string(),
    state: t.string().default('confirmed'),
    source: t.string().default('manual'),
    updatedBy: t.identity(),
    confidence: t.f32().default(1),
    updatedAt: t.timestamp(),
  }
);

// User-created assistants are configuration records for the external agent
// layer. They have no decision or communication authority of their own.
const custom_wedding_agent = table(
  { name: 'custom_wedding_agent', public: true, indexes: [{ accessor: 'by_wedding', algorithm: 'btree', columns: ['weddingId'] }] },
  {
    id: t.u64().primaryKey().autoInc(),
    weddingId: t.u64(),
    name: t.string(),
    instructions: t.string(),
    enabled: t.bool().default(true),
    state: t.string().default('confirmed'),
    source: t.string().default('manual'),
    updatedBy: t.identity(),
    confidence: t.f32().default(1),
    updatedAt: t.timestamp(),
  }
);

// Pinterest-derived inspiration is always a reviewable draft, never a choice.
const mood_item = table(
  { name: 'mood_item', public: true, indexes: [{ accessor: 'by_wedding', algorithm: 'btree', columns: ['weddingId'] }] },
  {
    id: t.u64().primaryKey().autoInc(),
    weddingId: t.u64(),
    title: t.string(),
    note: t.string(),
    palette: t.string(),
    state: t.string().default('reported'),
    source: t.string().default('pinterest'),
    updatedBy: t.identity(),
    confidence: t.f32().default(1),
    updatedAt: t.timestamp(),
    // A user-provided board or pin reference. The module never fetches it;
    // importing files or images is handled by the external ingest worker.
    sourceUrl: t.option(t.string()).default(undefined),
  }
);

// Template checklists give each event a practical starting point. Generated
// items remain reported until a wedding manager keeps them for this plan.
const event_checklist_item = table(
  { name: 'event_checklist_item', public: true, indexes: [{ accessor: 'by_event', algorithm: 'btree', columns: ['eventId'] }, { accessor: 'by_wedding', algorithm: 'btree', columns: ['weddingId'] }] },
  {
    id: t.u64().primaryKey().autoInc(),
    weddingId: t.u64(),
    eventId: t.u64(),
    label: t.string(),
    done: t.bool().default(false),
    state: t.string().default('reported'),
    source: t.string().default('template'),
    updatedBy: t.identity(),
    confidence: t.f32().default(1),
    updatedAt: t.timestamp(),
  }
);

// Guest rows are deliberately light-weight for Phase 0. Imports create
// reviewable records; contact data stays in the external worker rather than
// replicating phone numbers to the group surface.
const guest = table(
  { name: 'guest', public: true, indexes: [{ accessor: 'by_wedding', algorithm: 'btree', columns: ['weddingId'] }] },
  {
    id: t.u64().primaryKey().autoInc(),
    weddingId: t.u64(),
    name: t.string(),
    side: t.option(t.string()).default(undefined),
    homeCity: t.option(t.string()).default(undefined),
    rsvpStatus: t.string().default('awaiting_response'),
    state: t.string().default('reported'),
    source: t.string().default('guests'),
    updatedBy: t.identity(),
    confidence: t.f32().default(1),
    updatedAt: t.timestamp(),
    note: t.option(t.string()).default(undefined),
    needsFollowUp: t.bool().default(false),
  }
);

// The planning group chat is a shared, human-authored coordination record.
// Agent-written summaries belong in proposals, never in this chat as facts.
const wedding_message = table(
  { name: 'wedding_message', public: true, indexes: [{ accessor: 'by_wedding', algorithm: 'btree', columns: ['weddingId'] }] },
  {
    id: t.u64().primaryKey().autoInc(),
    weddingId: t.u64(),
    body: t.string(),
    sentBy: t.identity(),
    sentAt: t.timestamp(),
    state: t.string().default('confirmed'),
    source: t.string().default('manual'),
    updatedBy: t.identity(),
    confidence: t.f32().default(1),
    updatedAt: t.timestamp(),
  }
);

// A human-requested item for the coordinator. This is deliberately a durable
// request, not permission for a bot to contact anyone: the agent layer must
// still apply ownership, channel-preference, frequency-cap, and confirmation
// rules before taking any outbound action.
const coordinator_request = table(
  { name: 'coordinator_request', public: true, indexes: [{ accessor: 'by_wedding_status', algorithm: 'btree', columns: ['weddingId', 'status'] }] },
  {
    id: t.u64().primaryKey().autoInc(),
    weddingId: t.u64(),
    kind: t.string(),
    targetIdentity: t.identity(),
    instruction: t.string(),
    scheduledFor: t.option(t.timestamp()).default(undefined),
    status: t.string().default('open'),
    state: t.string().default('confirmed'),
    source: t.string().default('manual'),
    requestedBy: t.identity(),
    requestedAt: t.timestamp(),
    updatedBy: t.identity(),
    confidence: t.f32().default(1),
    updatedAt: t.timestamp(),
    taskId: t.option(t.u64()).default(undefined),
  }
);

const decision = table(
  { name: 'decision', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    title: t.string(),
    createdBy: t.identity(),
    createdAt: t.timestamp(),
    deciderIdentity: t.option(t.identity()).default(undefined),
    lockedOptionId: t.option(t.u64()).default(undefined),
    weddingId: t.option(t.u64()).default(undefined),
  }
);

const decision_option = table(
  { name: 'decision_option', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    decisionId: t.u64(),
    label: t.string(),
  }
);

const vote = table(
  {
    name: 'vote',
    public: true,
    indexes: [
      {
        accessor: 'by_decision_voter',
        algorithm: 'btree',
        columns: ['decisionId', 'voterIdentity'],
      },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    decisionId: t.u64(),
    optionId: t.u64(),
    voterIdentity: t.identity(),
    votedAt: t.timestamp(),
  }
);

const TASK_STATES = ['confirmed', 'reported'] as const;
type TaskState = (typeof TASK_STATES)[number];

const task = table(
  { name: 'task', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    title: t.string(),
    ownerIdentity: t.identity(),
    done: t.bool(),
    createdAt: t.timestamp(),
    dueAt: t.option(t.timestamp()).default(undefined),
    // Provenance for `done`: a human tap lands as 'confirmed' immediately;
    // a voice call lands as 'reported' and does not flip `done` until a
    // human confirms it (confirmation gate, see CLAUDE.md invariant 1).
    state: t.string().default('confirmed'),
    source: t.string().default('manual'),
    reportedBy: t.option(t.identity()).default(undefined),
    confidence: t.option(t.f32()).default(undefined),
    reportedAt: t.option(t.timestamp()).default(undefined),
    weddingId: t.option(t.u64()).default(undefined),
  }
);

// Holds the shared secret Sarvam's webhooks authenticate with. Private
// (no `public: true`) so it never replicates to clients; not process env,
// since SpacetimeDB modules don't have one.
const webhook_secret = table(
  { name: 'webhook_secret' },
  {
    id: t.u8().primaryKey(),
    value: t.string(),
  }
);

const spacetimedb = schema({
  // Keep the deployed tables in their original order. New tables append below.
  task,
  decision,
  webhook_secret,
  vote,
  decision_option,
  participant,
  member,
  wedding_invitation,
  wedding,
  event,
  expense,
  budget,
  vendor,
  vendor_consent,
  ingest_source,
  wedding_agent,
  wedding_agent_setting,
  custom_wedding_agent,
  mood_item,
  event_checklist_item,
  guest,
  wedding_message,
  coordinator_request,
});
export default spacetimedb;

type Ctx = ReducerCtx<InferSchema<typeof spacetimedb>>;

function seedDecision(ctx: Ctx, weddingId: bigint, title: string, options: string[]) {
  const inserted = ctx.db.decision.insert({
    id: 0n,
    weddingId,
    title,
    createdBy: ctx.sender,
    createdAt: ctx.timestamp,
    deciderIdentity: undefined,
    lockedOptionId: undefined,
  });
  for (const label of options) {
    ctx.db.decision_option.insert({ id: 0n, decisionId: inserted.id, label });
  }
}

const EVENT_TEMPLATES: Record<string, { title: string; checklist: string[] }> = {
  haldi: { title: 'Haldi', checklist: ['Confirm ceremony time and home or venue', 'Choose turmeric-safe seating and floor covering', 'Arrange towels, water, and a change area', 'Share the family dress note'] },
  mehendi: { title: 'Mehendi', checklist: ['Confirm artist arrival and guest count', 'Choose the seating layout and shade', 'Prepare music and welcome drinks', 'Share the hands-free photo moment plan'] },
  sangeet: { title: 'Sangeet', checklist: ['Confirm the run of show', 'Collect family song choices', 'Check sound, stage, and rehearsal timing', 'Share arrival and outfit notes'] },
  ceremony: { title: 'Wedding ceremony', checklist: ['Confirm the muhurtham and priest schedule', 'Check mandap, seating, and shade', 'Prepare ritual items with the family', 'Share the arrival plan with key guests'] },
  reception: { title: 'Reception', checklist: ['Confirm the welcome line and stage timing', 'Finalise the menu and service flow', 'Check lights, sound, and photo plan', 'Share guest arrival and parking notes'] },
};

export const init = spacetimedb.init(() => {});

function roleForNewParticipant(ctx: Ctx): Role {
  const [first] = [...ctx.db.participant.iter()];
  return first ? 'guest' : 'couple';
}

export const onConnect = spacetimedb.clientConnected(ctx => {
  const existing = ctx.db.participant.identity.find(ctx.sender);
  if (existing) {
    ctx.db.participant.identity.update({ ...existing, connected: true });
  } else {
    ctx.db.participant.insert({
      identity: ctx.sender,
      name: `Guest ${ctx.sender.toHexString().slice(0, 4)}`,
      connected: true,
      role: roleForNewParticipant(ctx),
      side: undefined,
      dateOfBirth: undefined,
      gender: undefined,
      mealPreference: undefined,
      profileState: 'unknown',
      profileSource: 'manual',
      profileUpdatedAt: undefined,
      preferredLanguage: 'English',
      phone: undefined,
    });
  }
});

export const onDisconnect = spacetimedb.clientDisconnected(ctx => {
  const existing = ctx.db.participant.identity.find(ctx.sender);
  if (existing) {
    ctx.db.participant.identity.update({ ...existing, connected: false });
  }
});

export const setName = spacetimedb.reducer(
  { name: t.string() },
  (ctx, { name }) => {
    const existing = ctx.db.participant.identity.find(ctx.sender);
    if (existing) {
      ctx.db.participant.identity.update({ ...existing, name });
    } else {
      ctx.db.participant.insert({
        identity: ctx.sender,
        name,
        connected: true,
        role: roleForNewParticipant(ctx),
        side: undefined,
        dateOfBirth: undefined,
        gender: undefined,
        mealPreference: undefined,
        profileState: 'unknown',
        profileSource: 'manual',
        profileUpdatedAt: undefined,
        preferredLanguage: 'English',
        phone: undefined,
      });
    }
  }
);

/**
 * Creates the deliberately small first confirmed record.  Imported material
 * is represented separately as reported records by an authenticated worker.
 */
export const createWedding = spacetimedb.reducer(
  {
    brideName: t.string(),
    groomName: t.string(),
    city: t.string(),
    dateLabel: t.string(),
    sourceKinds: t.array(t.string()),
  },
  (ctx, { sourceKinds, ...values }) => {
    const caller = ctx.db.participant.identity.find(ctx.sender);
    if (!caller) throw new SenderError('sign in before creating a wedding');
    const created = ctx.db.wedding.insert({
      id: 0n,
      ...values,
      createdBy: ctx.sender,
      state: 'confirmed',
      source: 'manual',
      updatedBy: ctx.sender,
      confidence: 1,
      updatedAt: ctx.timestamp,
    });
    for (const kind of sourceKinds) {
      if (!INGEST_KINDS.includes(kind as IngestKind)) {
        throw new SenderError('invalid ingest source');
      }
      ctx.db.ingest_source.insert({
        id: 0n,
        weddingId: created.id,
        kind,
        status: 'awaiting_upload',
        itemCount: 0,
        submittedBy: ctx.sender,
        createdAt: ctx.timestamp,
      });
    }
    ctx.db.member.insert({
      id: 0n,
      weddingId: created.id,
      identity: ctx.sender,
      // The person starting a plan may be a sibling, parent, or professional
      // planner. They coordinate the wedding; they are not assumed to be one
      // of the two people getting married.
      role: 'planner',
      side: undefined,
      joinedAt: ctx.timestamp,
      state: 'confirmed',
      source: 'manual',
      updatedBy: ctx.sender,
      confidence: 1,
      updatedAt: ctx.timestamp,
    });
    // The Coordinator is responsible for organising and drafting, never
    // accountable for a decision or commitment. It starts enabled so slash
    // requests have a single, durable destination from the first day.
    ctx.db.wedding_agent.insert({
      id: 0n,
      weddingId: created.id,
      kind: 'coordinator',
      enabled: true,
      state: 'confirmed',
      source: 'manual',
      updatedBy: ctx.sender,
      confidence: 1,
      updatedAt: ctx.timestamp,
    });
    seedDecision(ctx, created.id, 'Which mandap feels right?', ['Floral arch', 'Draped cloth', 'Temple style']);
  }
);

export const setSide = spacetimedb.reducer(
  { side: t.string() },
  (ctx, { side }) => {
    if (!SIDES.includes(side as Side)) {
      throw new SenderError('invalid side');
    }
    const existing = ctx.db.participant.identity.find(ctx.sender);
    if (!existing) throw new SenderError('join the event first');
    ctx.db.participant.identity.update({ ...existing, side });
  }
);

function isAdmin(role: string): boolean {
  return role === 'couple' || role === 'planner';
}

function membershipFor(ctx: Ctx, weddingId: bigint, identity = ctx.sender) {
  const [membership] = [...ctx.db.member.by_wedding_identity.filter([weddingId, identity])];
  return membership;
}

function canManageWedding(ctx: Ctx, weddingId: bigint): boolean {
  const membership = membershipFor(ctx, weddingId);
  return !!membership && isAdmin(membership.role);
}

export const setRole = spacetimedb.reducer(
  { identity: t.identity(), role: t.string() },
  (_ctx, _args) => {
    // Roles are wedding-specific. Kept only for compatibility with older
    // clients; membership roles can be assigned by a wedding administrator.
    throw new SenderError('use the wedding membership role instead');
  }
);

export const createDecision = spacetimedb.reducer(
  { weddingId: t.u64(), title: t.string(), options: t.array(t.string()) },
  (ctx, { weddingId, title, options }) => {
    // A poll is a human proposal, not a decision. Any wedding member may put
    // a question to the group; only a named decider or the couple can lock an
    // outcome later. This keeps chat polls useful without giving them authority.
    if (!membershipFor(ctx, weddingId)) throw new SenderError('only wedding members can create a poll');
    const question = title.trim();
    const cleanOptions = options.map(option => option.trim()).filter(Boolean);
    if (!question || question.length > 300) throw new SenderError('enter a short poll question');
    if (cleanOptions.length < 2 || cleanOptions.length > 12 || cleanOptions.some(option => option.length > 160)) {
      throw new SenderError('add between two and twelve short poll options');
    }
    seedDecision(ctx, weddingId, question, cleanOptions);
    // Creating a poll is a human chat action. Record its question and options
    // in the shared conversation in the same transaction, so the family sees
    // the new poll even if they have not opened the Decide tab yet.
    ctx.db.wedding_message.insert({
      id: 0n,
      weddingId,
      body: `New poll: ${question}\nOptions: ${cleanOptions.join(' · ')}`,
      sentBy: ctx.sender,
      sentAt: ctx.timestamp,
      state: 'confirmed',
      source: 'chat',
      updatedBy: ctx.sender,
      confidence: 1,
      updatedAt: ctx.timestamp,
    });
  }
);

export const addMember = spacetimedb.reducer(
  { weddingId: t.u64(), identity: t.identity(), role: t.string(), side: t.option(t.string()) },
  (ctx, { weddingId, identity, role, side }) => {
    if (!canManageWedding(ctx, weddingId)) throw new SenderError('only the couple or planner can add people');
    if (!ROLES.includes(role as Role)) throw new SenderError('invalid role');
    if (side !== undefined && !SIDES.includes(side as Side)) throw new SenderError('invalid side');
    if (membershipFor(ctx, weddingId, identity)) throw new SenderError('this person is already in the wedding');
    if (!ctx.db.participant.identity.find(identity)) throw new SenderError('ask this person to sign in first');
    ctx.db.member.insert({ id: 0n, weddingId, identity, role, side, joinedAt: ctx.timestamp, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
  }
);

// The client records intent only. Uploading/parsing happens outside the module;
// the worker writes extracted facts back as reported state for human review.
export const requestIngest = spacetimedb.reducer(
  { weddingId: t.u64(), kind: t.string() },
  (ctx, { weddingId, kind }) => {
    if (!canManageWedding(ctx, weddingId)) throw new SenderError('only the couple or event creator can add a source');
    if (!INGEST_KINDS.includes(kind as IngestKind)) throw new SenderError('invalid source type');
    ctx.db.ingest_source.insert({
      id: 0n,
      weddingId,
      kind,
      status: 'awaiting_upload',
      itemCount: 0,
      submittedBy: ctx.sender,
      createdAt: ctx.timestamp,
    });
  }
);

export const setWeddingAgent = spacetimedb.reducer(
  { weddingId: t.u64(), kind: t.string(), enabled: t.bool() },
  (ctx, { weddingId, kind, enabled }) => {
    if (!canManageWedding(ctx, weddingId)) throw new SenderError('only the couple or event creator can manage assistants');
    if (!WEDDING_AGENT_KINDS.includes(kind as WeddingAgentKind)) throw new SenderError('invalid assistant');
    const [existing] = [...ctx.db.wedding_agent.by_wedding_kind.filter([weddingId, kind])];
    if (existing) {
      ctx.db.wedding_agent.id.update({ ...existing, enabled, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
    } else {
      ctx.db.wedding_agent.insert({ id: 0n, weddingId, kind, enabled, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
    }
  }
);

export const setWeddingAgentInstructions = spacetimedb.reducer(
  { weddingId: t.u64(), kind: t.string(), instructions: t.string() },
  (ctx, { weddingId, kind, instructions }) => {
    if (!canManageWedding(ctx, weddingId)) throw new SenderError('only the couple or event creator can customise assistants');
    if (!WEDDING_AGENT_KINDS.includes(kind as WeddingAgentKind)) throw new SenderError('invalid assistant');
    const value = instructions.trim();
    if (value.length > 2000) throw new SenderError('instructions must be 2000 characters or fewer');
    const [existing] = [...ctx.db.wedding_agent_setting.by_wedding_kind.filter([weddingId, kind])];
    if (existing) {
      ctx.db.wedding_agent_setting.id.update({ ...existing, instructions: value, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
    } else {
      ctx.db.wedding_agent_setting.insert({ id: 0n, weddingId, kind, instructions: value, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
    }
  }
);

export const createCustomWeddingAgent = spacetimedb.reducer(
  { weddingId: t.u64(), name: t.string(), instructions: t.string() },
  (ctx, { weddingId, name, instructions }) => {
    if (!canManageWedding(ctx, weddingId)) throw new SenderError('only the couple or event creator can add an assistant');
    const title = name.trim();
    const brief = instructions.trim();
    if (!title || title.length > 80) throw new SenderError('assistant name must be between 1 and 80 characters');
    if (!brief || brief.length > 2000) throw new SenderError('add a working brief of 2000 characters or fewer');
    ctx.db.custom_wedding_agent.insert({
      id: 0n,
      weddingId,
      name: title,
      instructions: brief,
      enabled: true,
      state: 'confirmed',
      source: 'manual',
      updatedBy: ctx.sender,
      confidence: 1,
      updatedAt: ctx.timestamp,
    });
  }
);

// A deliberately narrow, idempotent fixture for the one public demo wedding.
// It is unavailable to normal wedding members and does not process user data.
export const seedPriyaRahulDemo = spacetimedb.reducer({}, ctx => {
  const isDemoAppAdmin = ctx.sender.toHexString() === 'c20062ae5d5c3fba6488abffb4db96a9cc793f9300697fbba5fee78670432648';
  if (!isDemoAppAdmin) throw new SenderError('only the demo app administrator can load demo data');
  const weddingId = 1n;
  if (!ctx.db.wedding.id.find(weddingId)) throw new SenderError('the Priya and Rahul demo wedding was not found');
  const caller = ctx.db.participant.identity.find(ctx.sender);
  const priyaIdentity = [...ctx.db.participant.iter()].find(person => person.name === 'Priya')?.identity;
  const rahulIdentity = [...ctx.db.participant.iter()].find(person => person.name === 'Rahul')?.identity;
  if (!caller || !priyaIdentity || !rahulIdentity) throw new SenderError('demo participants were not found');
  const has = (table: Iterable<{ weddingId: bigint; title?: string; label?: string }>, value: string) => [...table].some(row => row.weddingId === weddingId && (row.title === value || row.label === value));
  const addEvent = (title: string, venue: string) => {
    if (has(ctx.db.event.iter(), title)) return;
    ctx.db.event.insert({ id: 0n, weddingId, title, startsAt: ctx.timestamp, venue, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp, isCheckpoint: false });
  };
  addEvent('Mehendi evening', 'The Leela Palace lawn');
  addEvent('Sangeet night', 'The Leela Palace ballroom');
  addEvent('Wedding ceremony', 'Kapaleeshwarar Temple courtyard');
  if (![...ctx.db.budget.iter()].some(item => item.weddingId === weddingId)) {
    ctx.db.budget.insert({ id: 0n, weddingId, amountPaise: 300000000n, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
  }
  const planner = [...ctx.db.participant.iter()].find(person => person.name === 'Anonymous User');
  if (planner && ![...ctx.db.member.by_wedding_identity.filter([weddingId, planner.identity])].length) {
    ctx.db.participant.identity.update({ ...planner, name: 'Ananya Mehta', profileState: 'confirmed', profileSource: 'manual', profileUpdatedAt: ctx.timestamp });
    ctx.db.member.insert({ id: 0n, weddingId, identity: planner.identity, role: 'planner', side: undefined, joinedAt: ctx.timestamp, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
  }
  for (const [name, category, bookingState, note] of [
    ['Nila Blooms', 'Floral decor', 'booked', 'Jasmine-forward mandap and entrance florals'],
    ['Saffron Table', 'Catering', 'selected', 'South Indian lunch and live filter-coffee bar'],
    ['Frame Story Studio', 'Photography', 'booked', 'Two-day photo and short wedding film'],
    ['Raaga Collective', 'Music', 'shortlisted', 'Sangeet band with family song support'],
  ] as const) {
    if ([...ctx.db.vendor.iter()].some(item => item.weddingId === weddingId && item.name === name)) continue;
    ctx.db.vendor.insert({ id: 0n, weddingId, name, category, bookingState, note, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
  }
  const caterer = [...ctx.db.vendor.iter()].find(item => item.weddingId === weddingId && item.name === 'Saffron Table');
  if (caterer && ![...ctx.db.vendor_consent.by_vendor.filter(caterer.id)].length) {
    ctx.db.vendor_consent.insert({ id: 0n, weddingId, vendorId: caterer.id, consented: true, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
  }
  for (const [title, note, palette, sourceUrl] of [
    ['Soft jasmine ceremony', 'White jasmine, warm ivory, and a quiet brass glow.', '#f4efe2,#d8c79f,#85765c', 'https://www.pinterest.com/instyle/wedding-inspiration/'],
    ['Marigold gathering', 'A bright marigold moment for the mehendi entrance.', '#f5cf5c,#d98632,#7c5633', 'https://www.pinterest.com/instyle/wedding-inspiration/'],
    ['Indigo sangeet', 'Deep indigo textiles with candlelight and mirrored details.', '#25375c,#7d91bd,#d8c8ac', 'https://in.pinterest.com/beedilcs/wedding-inspiration/'],
    ['Coconut welcome', 'Tender coconut, cane, and leafy greens for guests arriving.', '#dce7d4,#a6b98d,#e8d7b4', 'https://in.pinterest.com/beedilcs/wedding-inspiration/'],
  ] as const) {
    const existing = [...ctx.db.mood_item.iter()].find(item => item.weddingId === weddingId && item.title === title);
    if (existing) {
      if (!existing.sourceUrl) ctx.db.mood_item.id.update({ ...existing, sourceUrl, updatedBy: ctx.sender, updatedAt: ctx.timestamp });
      continue;
    }
    ctx.db.mood_item.insert({ id: 0n, weddingId, title, note, palette, state: 'reported', source: 'pinterest', updatedBy: ctx.sender, confidence: 0.9, updatedAt: ctx.timestamp, sourceUrl });
  }
  for (const [name, side, homeCity, rsvpStatus] of [
    ['Lakshmi Iyer', 'bride', 'Chennai', 'confirmed'],
    ['Karthik Iyer', 'bride', 'Bengaluru', 'awaiting_response'],
    ['Meera Menon', 'bride', 'Chennai', 'confirmed'],
    ['Arjun Nair', 'groom', 'Kochi', 'awaiting_response'],
    ['Vikram Shah', 'groom', 'Mumbai', 'declined'],
    ['Nandini Rao', 'groom', 'Hyderabad', 'confirmed'],
  ] as const) {
    if ([...ctx.db.guest.iter()].some(item => item.weddingId === weddingId && item.name === name)) continue;
    ctx.db.guest.insert({ id: 0n, weddingId, name, side, homeCity, rsvpStatus, state: 'reported', source: 'guests', updatedBy: ctx.sender, confidence: 0.88, updatedAt: ctx.timestamp, note: undefined, needsFollowUp: false });
  }
  for (const [kind, itemCount] of [
    ['pinterest', 4], ['whatsapp', 8], ['guests', 6], ['quotes', 4], ['calendar', 3], ['vendor_details', 4],
  ] as const) {
    if ([...ctx.db.ingest_source.iter()].some(item => item.weddingId === weddingId && item.kind === kind && item.status === 'imported')) continue;
    ctx.db.ingest_source.insert({ id: 0n, weddingId, kind, status: 'imported', itemCount, submittedBy: ctx.sender, createdAt: ctx.timestamp });
  }
  for (const kind of ['decision', 'guest_logistics', 'vendor_liaison'] as const) {
    if ([...ctx.db.wedding_agent.by_wedding_kind.filter([weddingId, kind])].length) continue;
    ctx.db.wedding_agent.insert({ id: 0n, weddingId, kind, enabled: true, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
  }
  for (const [kind, instructions] of [
    ['coordinator', 'Keep the immediate family on the ceremony, guest list, and open planning tasks. Prepare follow-ups for review only.'],
    ['decision', 'Summarise choices clearly and show the family what needs a final call.'],
    ['guest_logistics', 'Organise RSVP drafts and note which guests may need travel details.'],
    ['vendor_liaison', 'Prepare concise follow-up drafts for confirmed vendors. Never send anything without consent.'],
  ] as const) {
    if ([...ctx.db.wedding_agent_setting.by_wedding_kind.filter([weddingId, kind])].length) continue;
    ctx.db.wedding_agent_setting.insert({ id: 0n, weddingId, kind, instructions, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
  }
  if (![...ctx.db.custom_wedding_agent.iter()].some(item => item.weddingId === weddingId && item.name === 'Ritual guide')) {
    ctx.db.custom_wedding_agent.insert({ id: 0n, weddingId, name: 'Ritual guide', instructions: 'Organise the ceremony ritual sequence and prepare a simple family run-sheet for review.', enabled: true, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
  }
  if (![...ctx.db.wedding_agent.by_wedding_kind.filter([weddingId, 'menu_planner'])].length) {
    ctx.db.wedding_agent.insert({ id: 0n, weddingId, kind: 'menu_planner', enabled: true, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
  }
  if (![...ctx.db.wedding_agent_setting.by_wedding_kind.filter([weddingId, 'menu_planner'])].length) {
    ctx.db.wedding_agent_setting.insert({ id: 0n, weddingId, kind: 'menu_planner', instructions: 'Draft a mostly vegetarian Tamil menu for each event, include one Jain-friendly option, and keep every suggestion ready for family review.', state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
  }
  for (const [eventTitle, label] of [
    ['Mehendi evening', 'Confirm artist arrival time and number of artists'],
    ['Mehendi evening', 'Arrange shaded seating, drinks, and a photo corner'],
    ['Sangeet night', 'Share the family performance order and rehearsal time'],
    ['Sangeet night', 'Confirm stage, sound check, and dinner service timing'],
    ['Wedding ceremony', 'Confirm muhurtham timing with the priest and family'],
    ['Wedding ceremony', 'Review mandap seating, ritual items, and guest arrivals'],
  ] as const) {
    const event = [...ctx.db.event.iter()].find(item => item.weddingId === weddingId && item.title === eventTitle);
    if (!event || [...ctx.db.event_checklist_item.by_event.filter(event.id)].some(item => item.label === label)) continue;
    ctx.db.event_checklist_item.insert({ id: 0n, weddingId, eventId: event.id, label, done: false, state: 'reported', source: 'template', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
  }
  for (const [category, label, amountPaise, paid] of [
    ['Venue', 'Leela Palace ceremony spaces', 8500000n, true],
    ['Catering', 'South Indian lunch for 240 guests', 6240000n, false],
    ['Decor', 'Jasmine and marigold florals', 2850000n, false],
    ['Photography', 'Two-day photo and film team', 1900000n, true],
  ] as const) {
    if ([...ctx.db.expense.iter()].some(item => item.weddingId === weddingId && item.label === label)) continue;
    ctx.db.expense.insert({ id: 0n, weddingId, category, label, amountPaise, paid, vendorId: undefined, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
  }
  for (const [title, ownerIdentity] of [
    ['Share the final guest list with catering', priyaIdentity],
    ['Confirm the sangeet song list', rahulIdentity],
    ['Review the florist’s jasmine samples', priyaIdentity],
  ] as const) {
    if ([...ctx.db.task.iter()].some(item => item.weddingId === weddingId && item.title === title)) continue;
    ctx.db.task.insert({ id: 0n, weddingId, title, ownerIdentity, done: false, createdAt: ctx.timestamp, dueAt: ctx.timestamp, state: 'confirmed', source: 'manual', reportedBy: undefined, confidence: undefined, reportedAt: undefined });
  }
  const guestListTask = [...ctx.db.task.iter()].find(item => item.weddingId === weddingId && item.title === 'Share the final guest list with catering');
  if (guestListTask && ![...ctx.db.coordinator_request.iter()].some(item => item.weddingId === weddingId && item.instruction === 'Ask Priya whether the guest-list additions are ready for the caterer.')) {
    ctx.db.coordinator_request.insert({ id: 0n, weddingId, kind: 'followup', targetIdentity: priyaIdentity, instruction: 'Ask Priya whether the guest-list additions are ready for the caterer.', scheduledFor: undefined, status: 'open', state: 'confirmed', source: 'manual', requestedBy: rahulIdentity, requestedAt: ctx.timestamp, updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp, taskId: guestListTask.id });
  }
  for (const [body, sentBy] of [
    ['The floral samples are in. I have put the three options on Decide for everyone to see.', priyaIdentity],
    ['I will send the first guest list to catering after we review the family additions tonight.', rahulIdentity],
    ['The Leela has held the ballroom for the sangeet. We still need to confirm the menu.', priyaIdentity],
  ] as const) {
    if ([...ctx.db.wedding_message.iter()].some(message => message.weddingId === weddingId && message.body === body)) continue;
    ctx.db.wedding_message.insert({ id: 0n, weddingId, body, sentBy, sentAt: ctx.timestamp, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
  }
  for (const [body, sentBy] of [
    ['Mummy prefers a simple jasmine entrance. Can we keep the marigolds for the mehendi?', priyaIdentity],
    ['I have added the cousins from Bengaluru to the guest sheet. A few RSVPs are still pending.', rahulIdentity],
    ['The sangeet rehearsal can start at 5:30 pm if the sound team is ready by then.', rahulIdentity],
    ['The caterer shared two lunch menus. Please keep one Jain-friendly option in the shortlist.', priyaIdentity],
    ['I saved a few softer ivory-and-jasmine ideas from the Pinterest board for everyone to review.', priyaIdentity],
  ] as const) {
    if ([...ctx.db.wedding_message.iter()].some(message => message.weddingId === weddingId && message.body === body)) continue;
    ctx.db.wedding_message.insert({ id: 0n, weddingId, body, sentBy, sentAt: ctx.timestamp, state: 'reported', source: 'whatsapp', updatedBy: ctx.sender, confidence: 0.86, updatedAt: ctx.timestamp });
  }
  if (![...ctx.db.decision.iter()].some(decision => decision.weddingId === weddingId && decision.title === 'Which welcome drink should guests receive?')) {
    seedDecision(ctx, weddingId, 'Which welcome drink should guests receive?', ['Tender coconut cooler', 'Rose milk', 'Filter coffee bar']);
  }
  for (const [title, options] of [
    ['Which sangeet opening should the family use?', ['Bride’s cousins dance', 'Couple entry', 'Parents’ welcome']],
    ['Which ceremony flower direction should we review?', ['Mostly jasmine', 'Jasmine with marigold', 'Soft ivory and greenery']],
  ] as const) {
    if ([...ctx.db.decision.iter()].some(decision => decision.weddingId === weddingId && decision.title === title)) continue;
    seedDecision(ctx, weddingId, title, [...options]);
  }
});

export const updateGuestCoordination = spacetimedb.reducer(
  { guestId: t.u64(), note: t.option(t.string()), needsFollowUp: t.bool() },
  (ctx, { guestId, note, needsFollowUp }) => {
    const existing = ctx.db.guest.id.find(guestId);
    if (!existing || !canManageWedding(ctx, existing.weddingId)) throw new SenderError('only the couple or event creator can update guest planning notes');
    const cleanedNote = note?.trim() || undefined;
    if (cleanedNote && cleanedNote.length > 500) throw new SenderError('guest note must be 500 characters or fewer');
    ctx.db.guest.id.update({ ...existing, note: cleanedNote, needsFollowUp, updatedBy: ctx.sender, updatedAt: ctx.timestamp });
  }
);

export const createEvent = spacetimedb.reducer(
  { weddingId: t.u64(), title: t.string(), venue: t.option(t.string()), startsAt: t.option(t.timestamp()), source: t.string(), confidence: t.f32(), isCheckpoint: t.bool() },
  (ctx, { weddingId, title, venue, startsAt, source, confidence, isCheckpoint }) => {
    if (!canManageWedding(ctx, weddingId)) throw new SenderError('only the couple or event creator can add an event');
    const eventTitle = title.trim();
    if (!eventTitle || eventTitle.length > 200) throw new SenderError('event name must be between 1 and 200 characters');
    const eventVenue = venue?.trim() || undefined;
    if (eventVenue && eventVenue.length > 300) throw new SenderError('venue must be 300 characters or fewer');
    if (!['manual', ...INGEST_KINDS].includes(source)) throw new SenderError('invalid event source');
    if (confidence < 0 || confidence > 1) throw new SenderError('confidence must be between 0 and 1');
    ctx.db.event.insert({
      id: 0n,
      weddingId,
      title: eventTitle,
      startsAt,
      venue: eventVenue,
      state: 'reported',
      source,
      updatedBy: ctx.sender,
      confidence,
      updatedAt: ctx.timestamp,
      isCheckpoint,
    });
  }
);

export const updateEvent = spacetimedb.reducer(
  { eventId: t.u64(), title: t.string(), venue: t.option(t.string()), startsAt: t.option(t.timestamp()), isCheckpoint: t.bool() },
  (ctx, { eventId, title, venue, startsAt, isCheckpoint }) => {
    const existing = ctx.db.event.id.find(eventId);
    if (!existing || !canManageWedding(ctx, existing.weddingId)) throw new SenderError('only the couple or event creator can update an event');
    const eventTitle = title.trim();
    if (!eventTitle || eventTitle.length > 200) throw new SenderError('event name must be between 1 and 200 characters');
    const eventVenue = venue?.trim() || undefined;
    if (eventVenue && eventVenue.length > 300) throw new SenderError('venue must be 300 characters or fewer');
    ctx.db.event.id.update({ ...existing, title: eventTitle, venue: eventVenue, startsAt, isCheckpoint, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
  }
);

export const deleteEvent = spacetimedb.reducer(
  { eventId: t.u64() },
  (ctx, { eventId }) => {
    const existing = ctx.db.event.id.find(eventId);
    if (!existing || !canManageWedding(ctx, existing.weddingId)) throw new SenderError('only the couple or event creator can delete an event');
    ctx.db.event.id.delete(eventId);
  }
);

export const applyEventTemplate = spacetimedb.reducer(
  { weddingId: t.u64(), template: t.string() },
  (ctx, { weddingId, template }) => {
    if (!canManageWedding(ctx, weddingId)) throw new SenderError('only the couple or event creator can add an event template');
    const selected = EVENT_TEMPLATES[template];
    if (!selected) throw new SenderError('unknown event template');
    const existing = [...ctx.db.event.iter()].find(event => event.weddingId === weddingId && event.title === selected.title);
    const event = existing ?? ctx.db.event.insert({
      id: 0n,
      weddingId,
      title: selected.title,
      startsAt: undefined,
      venue: undefined,
      state: 'reported',
      source: 'template',
      updatedBy: ctx.sender,
      confidence: 1,
      updatedAt: ctx.timestamp,
      isCheckpoint: false,
    });
    for (const label of selected.checklist) {
      if ([...ctx.db.event_checklist_item.by_event.filter(event.id)].some(item => item.label === label)) continue;
      ctx.db.event_checklist_item.insert({ id: 0n, weddingId, eventId: event.id, label, done: false, state: 'reported', source: 'template', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
    }
  }
);

export const addEventChecklistItem = spacetimedb.reducer(
  { eventId: t.u64(), label: t.string() },
  (ctx, { eventId, label }) => {
    const event = ctx.db.event.id.find(eventId);
    if (!event || !canManageWedding(ctx, event.weddingId)) throw new SenderError('only the couple or event creator can add an event checklist item');
    const value = label.trim();
    if (!value || value.length > 240) throw new SenderError('checklist item must be between 1 and 240 characters');
    ctx.db.event_checklist_item.insert({ id: 0n, weddingId: event.weddingId, eventId, label: value, done: false, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
  }
);

export const confirmEventChecklistItem = spacetimedb.reducer(
  { itemId: t.u64(), keep: t.bool() },
  (ctx, { itemId, keep }) => {
    const item = ctx.db.event_checklist_item.id.find(itemId);
    if (!item || !canManageWedding(ctx, item.weddingId)) throw new SenderError('only the couple or event creator can review an event checklist item');
    if (!keep) {
      ctx.db.event_checklist_item.id.delete(itemId);
      return;
    }
    ctx.db.event_checklist_item.id.update({ ...item, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
  }
);

export const setEventChecklistItemDone = spacetimedb.reducer(
  { itemId: t.u64(), done: t.bool() },
  (ctx, { itemId, done }) => {
    const item = ctx.db.event_checklist_item.id.find(itemId);
    if (!item || !canManageWedding(ctx, item.weddingId)) throw new SenderError('only the couple or event creator can update an event checklist item');
    if (item.state !== 'confirmed') throw new SenderError('confirm this checklist item before marking it complete');
    ctx.db.event_checklist_item.id.update({ ...item, done, updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
  }
);

export const setBudget = spacetimedb.reducer(
  { weddingId: t.u64(), amountPaise: t.i64() },
  (ctx, { weddingId, amountPaise }) => {
    if (!canManageWedding(ctx, weddingId)) throw new SenderError('only the couple or event creator can set the budget');
    if (amountPaise <= 0n) throw new SenderError('budget must be greater than zero');
    const [existing] = [...ctx.db.budget.by_wedding.filter(weddingId)];
    if (existing) {
      ctx.db.budget.id.update({ ...existing, amountPaise, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
    } else {
      ctx.db.budget.insert({ id: 0n, weddingId, amountPaise, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
    }
  }
);

export const createVendor = spacetimedb.reducer(
  { weddingId: t.u64(), name: t.string(), category: t.string(), note: t.option(t.string()) },
  (ctx, { weddingId, name, category, note }) => {
    if (!canManageWedding(ctx, weddingId)) throw new SenderError('only the couple or event creator can add a vendor');
    const vendorName = name.trim();
    const vendorCategory = category.trim();
    const vendorNote = note?.trim() || undefined;
    if (!vendorName || vendorName.length > 160 || !vendorCategory || vendorCategory.length > 100) throw new SenderError('enter a vendor name and category');
    if (vendorNote && vendorNote.length > 1000) throw new SenderError('vendor note must be 1000 characters or fewer');
    ctx.db.vendor.insert({ id: 0n, weddingId, name: vendorName, category: vendorCategory, bookingState: 'shortlisted', note: vendorNote, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
  }
);

export const setVendorBookingState = spacetimedb.reducer(
  { vendorId: t.u64(), bookingState: t.string() },
  (ctx, { vendorId, bookingState }) => {
    const existing = ctx.db.vendor.id.find(vendorId);
    if (!existing) throw new SenderError('vendor not found');
    if (!canManageWedding(ctx, existing.weddingId)) throw new SenderError('only the couple or event creator can update a vendor');
    if (!['shortlisted', 'selected', 'booked', 'declined'].includes(bookingState)) throw new SenderError('invalid vendor status');
    ctx.db.vendor.id.update({ ...existing, bookingState, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
  }
);

export const setVendorConsent = spacetimedb.reducer(
  { vendorId: t.u64(), consented: t.bool() },
  (ctx, { vendorId, consented }) => {
    const existingVendor = ctx.db.vendor.id.find(vendorId);
    if (!existingVendor) throw new SenderError('vendor not found');
    if (!canManageWedding(ctx, existingVendor.weddingId)) throw new SenderError('only the couple or event creator can give vendor contact consent');
    const [existing] = [...ctx.db.vendor_consent.by_vendor.filter(vendorId)];
    if (existing) {
      ctx.db.vendor_consent.id.update({ ...existing, consented, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
    } else {
      ctx.db.vendor_consent.insert({ id: 0n, vendorId, weddingId: existingVendor.weddingId, consented, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
    }
  }
);

export const createExpense = spacetimedb.reducer(
  { weddingId: t.u64(), category: t.string(), label: t.string(), amountPaise: t.i64(), paid: t.bool(), vendorId: t.option(t.u64()) },
  (ctx, { weddingId, category, label, amountPaise, paid, vendorId }) => {
    if (!canManageWedding(ctx, weddingId)) throw new SenderError('only the couple or event creator can add a budget line');
    const expenseCategory = category.trim();
    const expenseLabel = label.trim();
    if (!expenseCategory || expenseCategory.length > 100 || !expenseLabel || expenseLabel.length > 200 || amountPaise <= 0n) throw new SenderError('enter a category, description, and amount');
    if (vendorId !== undefined) {
      const linkedVendor = ctx.db.vendor.id.find(vendorId);
      if (!linkedVendor || linkedVendor.weddingId !== weddingId) throw new SenderError('choose a vendor from this wedding');
    }
    ctx.db.expense.insert({ id: 0n, weddingId, category: expenseCategory, label: expenseLabel, amountPaise, paid, vendorId, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
  }
);

// The browser/worker parses the file; this deterministic reducer only records
// its proposed facts with provenance. Imported amounts never become confirmed
// state just because a parser found them.
export const recordImportedExpense = spacetimedb.reducer(
  { weddingId: t.u64(), category: t.string(), label: t.string(), amountPaise: t.i64(), source: t.string(), confidence: t.f32() },
  (ctx, { weddingId, category, label, amountPaise, source, confidence }) => {
    if (!canManageWedding(ctx, weddingId)) throw new SenderError('only the couple or event creator can add a budget line');
    const expenseCategory = category.trim();
    const expenseLabel = label.trim();
    if (!expenseCategory || expenseCategory.length > 100 || !expenseLabel || expenseLabel.length > 200 || amountPaise <= 0n) throw new SenderError('enter a category, description, and amount');
    if (!INGEST_KINDS.includes(source as IngestKind) || confidence < 0 || confidence > 1) throw new SenderError('invalid imported expense');
    ctx.db.expense.insert({ id: 0n, weddingId, category: expenseCategory, label: expenseLabel, amountPaise, paid: false, vendorId: undefined, state: 'reported', source, updatedBy: ctx.sender, confidence, updatedAt: ctx.timestamp });
  }
);

export const confirmExpense = spacetimedb.reducer(
  { expenseId: t.u64(), accept: t.bool() },
  (ctx, { expenseId, accept }) => {
    const existing = ctx.db.expense.id.find(expenseId);
    if (!existing) throw new SenderError('budget line not found');
    if (!canManageWedding(ctx, existing.weddingId)) throw new SenderError('only the couple or event creator can review budget lines');
    // Rejection does not destroy imported evidence. It remains traceable but
    // cannot be treated as a confirmed budget fact.
    ctx.db.expense.id.update({ ...existing, state: accept ? 'confirmed' : 'unknown', updatedBy: ctx.sender, confidence: accept ? 1 : 0, updatedAt: ctx.timestamp });
  }
);

export const sendWeddingMessage = spacetimedb.reducer(
  { weddingId: t.u64(), body: t.string() },
  (ctx, { weddingId, body }) => {
    if (!membershipFor(ctx, weddingId)) throw new SenderError('only wedding members can send messages');
    const message = body.trim();
    if (!message || message.length > 2000) throw new SenderError('message must be between 1 and 2000 characters');
    ctx.db.wedding_message.insert({
      id: 0n,
      weddingId,
      body: message,
      sentBy: ctx.sender,
      sentAt: ctx.timestamp,
      state: 'confirmed',
      source: 'manual',
      updatedBy: ctx.sender,
      confidence: 1,
      updatedAt: ctx.timestamp,
    });
  }
);

export const requestCoordinatorAction = spacetimedb.reducer(
  { weddingId: t.u64(), kind: t.string(), targetIdentity: t.identity(), instruction: t.string(), scheduledFor: t.option(t.timestamp()) },
  (ctx, { weddingId, kind, targetIdentity, instruction, scheduledFor }) => {
    if (!membershipFor(ctx, weddingId)) throw new SenderError('only wedding members can request coordinator help');
    if (!membershipFor(ctx, weddingId, targetIdentity)) throw new SenderError('choose someone in this wedding');
    if (!targetIdentity.equals(ctx.sender) && !canManageWedding(ctx, weddingId)) throw new SenderError('only the couple or planner can request a follow-up for someone else');
    if (!['remind', 'followup'].includes(kind)) throw new SenderError('invalid coordinator request');
    const request = instruction.trim();
    if (!request || request.length > 2000) throw new SenderError('request must be between 1 and 2000 characters');
    // The request creates the owned work item first. The agent layer must
    // only contact this owner about this still-open task.
    const task = ctx.db.task.insert({
      id: 0n,
      weddingId,
      title: `${kind === 'remind' ? 'Reminder' : 'Follow up'}: ${request}`,
      ownerIdentity: targetIdentity,
      done: false,
      createdAt: ctx.timestamp,
      dueAt: scheduledFor,
      state: 'confirmed',
      source: 'manual',
      reportedBy: undefined,
      confidence: undefined,
      reportedAt: undefined,
    });
    ctx.db.coordinator_request.insert({
      id: 0n,
      weddingId,
      kind,
      targetIdentity,
      taskId: task.id,
      instruction: request,
      scheduledFor,
      status: 'open',
      state: 'confirmed',
      source: 'manual',
      requestedBy: ctx.sender,
      requestedAt: ctx.timestamp,
      updatedBy: ctx.sender,
      confidence: 1,
      updatedAt: ctx.timestamp,
    });
  }
);

export const createWeddingInvitation = spacetimedb.reducer(
  { weddingId: t.u64(), code: t.string(), role: t.string(), side: t.option(t.string()) },
  (ctx, { weddingId, code, role, side }) => {
    if (!canManageWedding(ctx, weddingId)) throw new SenderError('only the couple or planner can invite people');
    if (!ROLES.includes(role as Role)) throw new SenderError('invalid role');
    if (side !== undefined && !SIDES.includes(side as Side)) throw new SenderError('invalid side');
    if (code.length < 16 || code.length > 160) throw new SenderError('invalid invitation code');
    if ([...ctx.db.wedding_invitation.by_code.filter(code)].length > 0) throw new SenderError('try creating this invite again');
    ctx.db.wedding_invitation.insert({ id: 0n, weddingId, code, role, side, status: 'pending', createdBy: ctx.sender, createdAt: ctx.timestamp, acceptedBy: undefined, acceptedAt: undefined });
  }
);

export const acceptWeddingInvitation = spacetimedb.reducer(
  { code: t.string() },
  (ctx, { code }) => {
    const person = ctx.db.participant.identity.find(ctx.sender);
    if (!person) throw new SenderError('sign in before joining a wedding');
    const [invite] = [...ctx.db.wedding_invitation.by_code.filter(code)];
    if (!invite || invite.status !== 'pending') throw new SenderError('this invite is no longer available');
    if (membershipFor(ctx, invite.weddingId)) throw new SenderError('you are already part of this wedding');
    ctx.db.member.insert({ id: 0n, weddingId: invite.weddingId, identity: ctx.sender, role: invite.role, side: invite.side, joinedAt: ctx.timestamp, state: 'confirmed', source: 'manual', updatedBy: ctx.sender, confidence: 1, updatedAt: ctx.timestamp });
    ctx.db.wedding_invitation.id.update({ ...invite, status: 'accepted', acceptedBy: ctx.sender, acceptedAt: ctx.timestamp });
  }
);

export const declineWeddingInvitation = spacetimedb.reducer(
  { code: t.string() },
  (ctx, { code }) => {
    const [invite] = [...ctx.db.wedding_invitation.by_code.filter(code)];
    if (!invite || invite.status !== 'pending') throw new SenderError('this invite is no longer available');
    ctx.db.wedding_invitation.id.update({ ...invite, status: 'declined' });
  }
);

export const updateMyProfile = spacetimedb.reducer(
  { name: t.string(), phone: t.string(), dateOfBirth: t.option(t.string()), gender: t.option(t.string()), mealPreference: t.option(t.string()) },
  (ctx, { name, phone, dateOfBirth, gender, mealPreference }) => {
    const person = ctx.db.participant.identity.find(ctx.sender);
    if (!person) throw new SenderError('sign in before updating your profile');
    if (person.profileState === 'confirmed' && name !== person.name && !person.name.startsWith('Guest ') && person.name !== 'Anonymous User') {
      throw new SenderError('your name is set during profile setup');
    }
    if (!/^\+91[6-9][0-9]{9}$/.test(phone)) throw new SenderError('enter a valid Indian mobile number, for example +919360305804');
    const [phoneOwner] = [...ctx.db.participant.by_phone.filter(phone)];
    if (phoneOwner && !phoneOwner.identity.equals(ctx.sender)) throw new SenderError('this phone number is already linked to another person');
    if (gender !== undefined && !['woman', 'man', 'non_binary', 'prefer_not_to_say'].includes(gender)) throw new SenderError('invalid gender');
    ctx.db.participant.identity.update({ ...person, name, phone, dateOfBirth, gender, mealPreference, profileState: 'confirmed', profileSource: 'manual', profileUpdatedAt: ctx.timestamp });
  }
);

export const setMembershipRole = spacetimedb.reducer(
  { weddingId: t.u64(), identity: t.identity(), role: t.string() },
  (ctx, { weddingId, identity, role }) => {
    if (!canManageWedding(ctx, weddingId)) throw new SenderError('only the couple or planner can change roles');
    if (identity.equals(ctx.sender)) throw new SenderError('your wedding role is set when you join');
    if (!ROLES.includes(role as Role)) throw new SenderError('invalid role');
    const membership = membershipFor(ctx, weddingId, identity);
    if (!membership) throw new SenderError('member not found');
    ctx.db.member.id.update({ ...membership, role, updatedBy: ctx.sender, updatedAt: ctx.timestamp });
  }
);

export const setMembershipSide = spacetimedb.reducer(
  { weddingId: t.u64(), identity: t.identity(), side: t.option(t.string()) },
  (ctx, { weddingId, identity, side }) => {
    if (!canManageWedding(ctx, weddingId)) throw new SenderError('only the couple or planner can change sides');
    if (side !== undefined && !SIDES.includes(side as Side)) throw new SenderError('invalid side');
    const membership = membershipFor(ctx, weddingId, identity);
    if (!membership) throw new SenderError('member not found');
    ctx.db.member.id.update({ ...membership, side, updatedBy: ctx.sender, updatedAt: ctx.timestamp });
  }
);

export const setDecider = spacetimedb.reducer(
  { decisionId: t.u64(), identity: t.identity() },
  (ctx, { decisionId, identity }) => {
    const decision = ctx.db.decision.id.find(decisionId);
    if (!decision) throw new SenderError('decision not found');
    if (decision.weddingId === undefined || !canManageWedding(ctx, decision.weddingId)) throw new SenderError('only the couple or planner can set a decider');
    if (!membershipFor(ctx, decision.weddingId, identity)) throw new SenderError('decider must be a wedding member');
    ctx.db.decision.id.update({ ...decision, deciderIdentity: identity });
  }
);

export const lockDecision = spacetimedb.reducer(
  { decisionId: t.u64(), optionId: t.u64() },
  (ctx, { decisionId, optionId }) => {
    const decision = ctx.db.decision.id.find(decisionId);
    if (!decision) throw new SenderError('decision not found');
    if (decision.weddingId === undefined || !membershipFor(ctx, decision.weddingId)) throw new SenderError('you are not part of this wedding');
    const caller = decision.weddingId === undefined ? undefined : membershipFor(ctx, decision.weddingId);
    const isDecider =
      decision.deciderIdentity && decision.deciderIdentity.equals(ctx.sender);
    if (!isDecider && !isAdmin(caller?.role ?? '')) {
      throw new SenderError('only the decider or the couple can lock this decision');
    }
    const option = ctx.db.decision_option.id.find(optionId);
    if (!option || option.decisionId !== decisionId) {
      throw new SenderError('option does not belong to this decision');
    }
    ctx.db.decision.id.update({ ...decision, lockedOptionId: optionId });
  }
);

export const castVote = spacetimedb.reducer(
  { decisionId: t.u64(), optionId: t.u64() },
  (ctx, { decisionId, optionId }) => {
    const decision = ctx.db.decision.id.find(decisionId);
    if (!decision || decision.weddingId === undefined || !membershipFor(ctx, decision.weddingId)) throw new SenderError('you are not part of this wedding');
    if (decision?.lockedOptionId !== undefined && decision?.lockedOptionId !== null) {
      throw new SenderError('decision is locked');
    }
    const [existing] = [
      ...ctx.db.vote.by_decision_voter.filter([decisionId, ctx.sender]),
    ];
    if (existing) {
      ctx.db.vote.id.update({ ...existing, optionId, votedAt: ctx.timestamp });
    } else {
      ctx.db.vote.insert({
        id: 0n,
        decisionId,
        optionId,
        voterIdentity: ctx.sender,
        votedAt: ctx.timestamp,
      });
    }
  }
);

export const createTask = spacetimedb.reducer(
  {
    weddingId: t.u64(),
    title: t.string(),
    ownerIdentity: t.identity(),
    dueAt: t.option(t.timestamp()),
  },
  (ctx, { weddingId, title, ownerIdentity, dueAt }) => {
    if (!canManageWedding(ctx, weddingId)) throw new SenderError('only the couple or planner can create tasks');
    if (!membershipFor(ctx, weddingId, ownerIdentity)) throw new SenderError('task owner must be a wedding member');
    ctx.db.task.insert({
      id: 0n,
      weddingId,
      title,
      ownerIdentity,
      done: false,
      createdAt: ctx.timestamp,
      dueAt,
      state: 'confirmed',
      source: 'manual',
      reportedBy: undefined,
      confidence: undefined,
      reportedAt: undefined,
    });
  }
);

export const toggleTask = spacetimedb.reducer(
  { taskId: t.u64() },
  (ctx, { taskId }) => {
    const existing = ctx.db.task.id.find(taskId);
    if (!existing) throw new SenderError('task not found');
    if (!existing.ownerIdentity.equals(ctx.sender)) {
      throw new SenderError('only the owner can update this task');
    }
    // A direct tap from the owner is a human confirming state, so it
    // always resolves any pending 'reported' completion.
    ctx.db.task.id.update({
      ...existing,
      done: !existing.done,
      state: 'confirmed',
      reportedBy: undefined,
      confidence: undefined,
      reportedAt: undefined,
    });
  }
);

export const confirmReportedTask = spacetimedb.reducer(
  { taskId: t.u64(), accept: t.bool() },
  (ctx, { taskId, accept }) => {
    const existing = ctx.db.task.id.find(taskId);
    if (!existing) throw new SenderError('task not found');
    if (!existing.ownerIdentity.equals(ctx.sender)) {
      throw new SenderError('only the owner can confirm this task');
    }
    if (existing.state !== 'reported') {
      throw new SenderError('this task has no pending report to confirm');
    }
    ctx.db.task.id.update({
      ...existing,
      done: accept,
      state: 'confirmed',
      reportedBy: undefined,
      confidence: undefined,
      reportedAt: undefined,
    });
  }
);

export const linkPhone = spacetimedb.reducer(
  { identity: t.identity(), phone: t.string() },
  (ctx, { identity, phone }) => {
    const caller = ctx.db.participant.identity.find(ctx.sender);
    const isDemoAppAdmin = ctx.sender.toHexString() === 'c20062ae5d5c3fba6488abffb4db96a9cc793f9300697fbba5fee78670432648';
    const isPriyaDemoLink = isDemoAppAdmin
      && identity.toHexString() === 'c200582c7368177c29e7e0ac08a80e08242c6af85200c9066985bce68bba300f'
      && phone === '+919360305804';
    if ((!caller || !isAdmin(caller.role)) && !isPriyaDemoLink) {
      throw new SenderError('only the app administrator, couple, or planner can link a phone number');
    }
    const target = ctx.db.participant.identity.find(identity);
    if (!target) throw new SenderError('participant not found');
    ctx.db.participant.identity.update({ ...target, phone });
  }
);

export const setWebhookSecret = spacetimedb.reducer(
  { value: t.string() },
  (ctx, { value }) => {
    // Demo app administrator. The voice secret is app-scoped rather than a
    // wedding decision, so only this explicitly designated identity can
    // change it. Replace with a durable app-admin table before production.
    const isAppAdmin = ctx.sender.toHexString() === 'c20062ae5d5c3fba6488abffb4db96a9cc793f9300697fbba5fee78670432648';
    if (!isAppAdmin) {
      throw new SenderError('only the app administrator can set the webhook secret');
    }
    const existing = ctx.db.webhook_secret.id.find(0);
    if (existing) {
      ctx.db.webhook_secret.id.update({ ...existing, value });
    } else {
      ctx.db.webhook_secret.insert({ id: 0, value });
    }
  }
);

function checkWebhookAuth(
  tx: ReducerCtx<InferSchema<typeof spacetimedb>>,
  request: Request
): boolean {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const secret = tx.db.webhook_secret.id.find(0);
  return token.length > 0 && !!secret && token === secret.value;
}

function queryParam(url: string, name: string): string | undefined {
  const query = url.split('?')[1];
  if (!query) return undefined;
  const pair = query.split('&').find(item => item.split('=')[0] === name);
  if (!pair) return undefined;
  const value = pair.slice(name.length + 1).replace(/\+/g, ' ');
  return decodeURIComponent(value);
}

function jsonResponse(status: number, body: unknown): SyncResponse {
  return new SyncResponse(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  });
}

// On-start hook / mid-call tool for Sarvam's voice agent: given the
// caller's phone number, returns their live open items so the agent
// answers from current state instead of a stale synced knowledge base.
export const voiceContext = spacetimedb.httpHandler((ctx, request) => {
  const phone = queryParam(request.url, 'phone');
  if (!phone) return jsonResponse(400, { error: 'phone is required' });

  return ctx.withTx(tx => {
    if (!checkWebhookAuth(tx, request)) {
      return jsonResponse(401, { error: 'unauthorized' });
    }

    const [person] = [...tx.db.participant.by_phone.filter(phone)];
    if (!person) {
      return jsonResponse(404, { error: 'no participant with this phone number' });
    }

    // Scope all shared wedding information to weddings this caller belongs to.
    // The voice-agent prompt is an additional safety layer, not the access
    // control boundary.
    const weddingIds = new Set(
      [...tx.db.member.by_identity.filter(person.identity)].map(row => row.weddingId.toString())
    );
    const weddings = [...tx.db.wedding.iter()]
      .filter(row => weddingIds.has(row.id.toString()))
      .map(row => ({
        id: Number(row.id),
        brideName: row.brideName,
        groomName: row.groomName,
        city: row.city,
        dateLabel: row.dateLabel,
      }));
    const events = [...tx.db.event.iter()]
      .filter(row => weddingIds.has(row.weddingId.toString()))
      .map(row => ({
        id: Number(row.id),
        weddingId: Number(row.weddingId),
        title: row.title,
        startsAt: row.startsAt ? Number(row.startsAt.microsSinceUnixEpoch / 1000n) : null,
        venue: row.venue ?? null,
        // A reported event must never be phrased as settled by the voice agent.
        state: row.state,
      }));
    const decisions = [...tx.db.decision.iter()]
      .filter(row => row.weddingId !== undefined && weddingIds.has(row.weddingId.toString()))
      .map(row => {
        const option = row.lockedOptionId === undefined
          ? undefined
          : tx.db.decision_option.id.find(row.lockedOptionId);
        return {
          id: Number(row.id),
          weddingId: Number(row.weddingId!),
          title: row.title,
          lockedOption: option?.label ?? null,
          // A decision is final only when a human has locked an option.
          state: option ? 'confirmed' : 'open',
        };
      });
    const openTasks = [...tx.db.task.iter()]
      .filter(row => row.ownerIdentity.equals(person.identity) && !row.done)
      .map(row => ({
        id: Number(row.id),
        title: row.title,
        state: row.state,
        dueAt: row.dueAt
          ? Number(row.dueAt.microsSinceUnixEpoch / 1000n)
          : null,
      }));

    return jsonResponse(200, {
      name: person.name,
      role: person.role,
      side: person.side ?? null,
      weddings,
      events,
      decisions,
      openTasks,
    });
  });
});

// On-end hook for Sarvam's voice agent: records what the caller reported
// as done. Always lands as 'reported' with provenance — never flips
// `done` — a human still has to confirm it (confirmReportedTask, or a
// tap in the app) before anything downstream acts on it.
export const voiceReportTaskDone = spacetimedb.httpHandler((ctx, request) => {
  const payload = request.json() as {
    phone?: string;
    taskId?: number;
    confidence?: number;
  };

  return ctx.withTx(tx => {
    if (!checkWebhookAuth(tx, request)) {
      return jsonResponse(401, { error: 'unauthorized' });
    }
    if (!payload.phone || payload.taskId === undefined) {
      return jsonResponse(400, { error: 'phone and taskId are required' });
    }

    const [person] = [...tx.db.participant.by_phone.filter(payload.phone)];
    if (!person) {
      return jsonResponse(404, { error: 'no participant with this phone number' });
    }

    const existing = tx.db.task.id.find(BigInt(payload.taskId));
    if (!existing || !existing.ownerIdentity.equals(person.identity)) {
      // Invariant 5: only report on items this caller owns.
      return jsonResponse(404, { error: 'no matching open task for this caller' });
    }

    tx.db.task.id.update({
      ...existing,
      state: 'reported' satisfies TaskState,
      source: 'voice_call',
      reportedBy: person.identity,
      confidence: payload.confidence ?? undefined,
      reportedAt: ctx.timestamp,
    });

    return jsonResponse(200, { ok: true, state: 'reported' });
  });
});

// An invitation code is a bearer credential. This endpoint reveals only the
// small amount of context a recipient needs before accepting it; invitation
// rows and their codes remain private tables.
export const invitationPreview = spacetimedb.httpHandler((ctx, request) => {
  const code = queryParam(request.url, 'code');
  if (!code) return jsonResponse(400, { error: 'invite code is required' });
  return ctx.withTx(tx => {
    const [invitation] = [...tx.db.wedding_invitation.by_code.filter(code)];
    if (!invitation) return jsonResponse(404, { error: 'invite not found' });
    const invitedWedding = tx.db.wedding.id.find(invitation.weddingId);
    if (!invitedWedding) return jsonResponse(404, { error: 'wedding not found' });
    return jsonResponse(200, {
      weddingId: invitation.weddingId.toString(),
      brideName: invitedWedding.brideName,
      groomName: invitedWedding.groomName,
      city: invitedWedding.city,
      dateLabel: invitedWedding.dateLabel,
      role: invitation.role,
      side: invitation.side ?? null,
      status: invitation.status,
    });
  });
});

export const voiceRoutes = spacetimedb.httpRouter(
  new Router()
    .get('/voice/context', voiceContext)
    .post('/voice/report-task-done', voiceReportTaskDone)
    .get('/invites/preview', invitationPreview)
);
