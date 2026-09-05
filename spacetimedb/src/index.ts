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

const WEDDING_AGENT_KINDS = ['coordinator', 'decision', 'guest_logistics', 'vendor_liaison'] as const;
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

// Agents are explicitly added by a wedding administrator. This is an
// assignment record, not a user identity: agents never become accountable
// members and may only propose or coordinate work in the external agent layer.
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
  ingest_source,
  wedding_agent,
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
    if (!canManageWedding(ctx, weddingId)) throw new SenderError('only the couple or planner can create a decision');
    seedDecision(ctx, weddingId, title, options);
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

export const updateMyProfile = spacetimedb.reducer(
  { name: t.string(), dateOfBirth: t.option(t.string()), gender: t.option(t.string()), mealPreference: t.option(t.string()) },
  (ctx, { name, dateOfBirth, gender, mealPreference }) => {
    const person = ctx.db.participant.identity.find(ctx.sender);
    if (!person) throw new SenderError('sign in before updating your profile');
    if (person.profileState === 'confirmed' && name !== person.name) {
      throw new SenderError('your name is set during profile setup');
    }
    if (gender !== undefined && !['woman', 'man', 'non_binary', 'prefer_not_to_say'].includes(gender)) throw new SenderError('invalid gender');
    ctx.db.participant.identity.update({ ...person, name, dateOfBirth, gender, mealPreference, profileState: 'confirmed', profileSource: 'manual', profileUpdatedAt: ctx.timestamp });
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
    if (!caller || !isAdmin(caller.role)) {
      throw new SenderError('only the couple or planner can link a phone number');
    }
    const target = ctx.db.participant.identity.find(identity);
    if (!target) throw new SenderError('participant not found');
    ctx.db.participant.identity.update({ ...target, phone });
  }
);

export const setWebhookSecret = spacetimedb.reducer(
  { value: t.string() },
  (ctx, { value }) => {
    const caller = ctx.db.participant.identity.find(ctx.sender);
    if (!caller || !isAdmin(caller.role)) {
      throw new SenderError('only the couple or planner can set the webhook secret');
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

function jsonResponse(status: number, body: unknown): SyncResponse {
  return new SyncResponse(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// On-start hook / mid-call tool for Sarvam's voice agent: given the
// caller's phone number, returns their live open items so the agent
// answers from current state instead of a stale synced knowledge base.
export const voiceContext = spacetimedb.httpHandler((ctx, request) => {
  const phone = new URL(request.url).searchParams.get('phone');
  if (!phone) return jsonResponse(400, { error: 'phone is required' });

  return ctx.withTx(tx => {
    if (!checkWebhookAuth(tx, request)) {
      return jsonResponse(401, { error: 'unauthorized' });
    }

    const [person] = [...tx.db.participant.by_phone.filter(phone)];
    if (!person) {
      return jsonResponse(404, { error: 'no participant with this phone number' });
    }

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

export const voiceRoutes = spacetimedb.httpRouter(
  new Router()
    .get('/voice/context', voiceContext)
    .post('/voice/report-task-done', voiceReportTaskDone)
);
