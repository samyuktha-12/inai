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
  participant,
  decision,
  decision_option,
  vote,
  task,
  webhook_secret,
});
export default spacetimedb;

type Ctx = ReducerCtx<InferSchema<typeof spacetimedb>>;

function seedDecision(ctx: Ctx, title: string, options: string[]) {
  const inserted = ctx.db.decision.insert({
    id: 0n,
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

export const init = spacetimedb.init(ctx => {
  seedDecision(ctx, 'Vote on the venue', [
    'Garden Estate',
    'Beachfront Resort',
    'Temple Hall',
  ]);
  seedDecision(ctx, 'Which mandap?', [
    'Floral arch',
    'Draped cloth',
    'Temple style',
  ]);
});

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
        phone: undefined,
      });
    }
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

export const setRole = spacetimedb.reducer(
  { identity: t.identity(), role: t.string() },
  (ctx, { identity, role }) => {
    const caller = ctx.db.participant.identity.find(ctx.sender);
    if (!caller || !isAdmin(caller.role)) {
      throw new SenderError('only the couple or planner can assign roles');
    }
    if (!ROLES.includes(role as Role)) {
      throw new SenderError('invalid role');
    }
    const target = ctx.db.participant.identity.find(identity);
    if (!target) throw new SenderError('participant not found');
    ctx.db.participant.identity.update({ ...target, role });
  }
);

export const createDecision = spacetimedb.reducer(
  { title: t.string(), options: t.array(t.string()) },
  (ctx, { title, options }) => {
    seedDecision(ctx, title, options);
  }
);

export const setDecider = spacetimedb.reducer(
  { decisionId: t.u64(), identity: t.identity() },
  (ctx, { decisionId, identity }) => {
    const caller = ctx.db.participant.identity.find(ctx.sender);
    if (!caller || !isAdmin(caller.role)) {
      throw new SenderError('only the couple or planner can set a decider');
    }
    const decision = ctx.db.decision.id.find(decisionId);
    if (!decision) throw new SenderError('decision not found');
    ctx.db.decision.id.update({ ...decision, deciderIdentity: identity });
  }
);

export const lockDecision = spacetimedb.reducer(
  { decisionId: t.u64(), optionId: t.u64() },
  (ctx, { decisionId, optionId }) => {
    const decision = ctx.db.decision.id.find(decisionId);
    if (!decision) throw new SenderError('decision not found');
    const caller = ctx.db.participant.identity.find(ctx.sender);
    const isDecider =
      decision.deciderIdentity && decision.deciderIdentity.equals(ctx.sender);
    if (!isDecider && caller?.role !== 'couple') {
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
    title: t.string(),
    ownerIdentity: t.identity(),
    dueAt: t.option(t.timestamp()),
  },
  (ctx, { title, ownerIdentity, dueAt }) => {
    ctx.db.task.insert({
      id: 0n,
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
