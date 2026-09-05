import {
  schema,
  table,
  t,
  SenderError,
  type ReducerCtx,
  type InferSchema,
} from 'spacetimedb/server';

const participant = table(
  { name: 'participant', public: true },
  {
    identity: t.identity().primaryKey(),
    name: t.string(),
    connected: t.bool(),
  }
);

const decision = table(
  { name: 'decision', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    title: t.string(),
    createdBy: t.identity(),
    createdAt: t.timestamp(),
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

const task = table(
  { name: 'task', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    title: t.string(),
    ownerIdentity: t.identity(),
    done: t.bool(),
    createdAt: t.timestamp(),
  }
);

const spacetimedb = schema({
  participant,
  decision,
  decision_option,
  vote,
  task,
});
export default spacetimedb;

type Ctx = ReducerCtx<InferSchema<typeof spacetimedb>>;

function seedDecision(ctx: Ctx, title: string, options: string[]) {
  const inserted = ctx.db.decision.insert({
    id: 0n,
    title,
    createdBy: ctx.sender,
    createdAt: ctx.timestamp,
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

export const onConnect = spacetimedb.clientConnected(ctx => {
  const existing = ctx.db.participant.identity.find(ctx.sender);
  if (existing) {
    ctx.db.participant.identity.update({ ...existing, connected: true });
  } else {
    ctx.db.participant.insert({
      identity: ctx.sender,
      name: `Guest ${ctx.sender.toHexString().slice(0, 4)}`,
      connected: true,
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
      });
    }
  }
);

export const createDecision = spacetimedb.reducer(
  { title: t.string(), options: t.array(t.string()) },
  (ctx, { title, options }) => {
    seedDecision(ctx, title, options);
  }
);

export const castVote = spacetimedb.reducer(
  { decisionId: t.u64(), optionId: t.u64() },
  (ctx, { decisionId, optionId }) => {
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
  { title: t.string(), ownerIdentity: t.identity() },
  (ctx, { title, ownerIdentity }) => {
    ctx.db.task.insert({
      id: 0n,
      title,
      ownerIdentity,
      done: false,
      createdAt: ctx.timestamp,
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
    ctx.db.task.id.update({ ...existing, done: !existing.done });
  }
);
