import { Timestamp } from 'spacetimedb';
import { tables, reducers } from '../module_bindings';
import { useTable, useReducer, useSpacetimeDB } from 'spacetimedb/react';
import { colors, fonts } from '../theme';

function formatDue(dueAt?: Timestamp) {
  if (!dueAt) return null;
  const date = new Date(Number(dueAt.microsSinceUnixEpoch / 1000n));
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  background: '#FFFFFF',
  border: `1px solid ${colors.hairline}`,
  borderRadius: 14,
  padding: '14px 16px',
};

export default function TodayTab({
  onNavigate,
}: {
  onNavigate: (tab: 'decide' | 'tasks') => void;
}) {
  const { identity } = useSpacetimeDB();
  const [tasks] = useTable(tables.task);
  const [decisions] = useTable(tables.decision);
  const [votes] = useTable(tables.vote);
  const [participants] = useTable(tables.participant);
  const toggleTask = useReducer(reducers.toggleTask);

  const myHex = identity?.toHexString();
  const me = participants.find(p => p.identity.toHexString() === myHex);

  const myOpenTasks = tasks.filter(
    t => t.ownerIdentity.toHexString() === myHex && !t.done
  );

  const openDecisions = decisions.filter(d => d.lockedOptionId === undefined);
  const myVotedIds = new Set(
    votes
      .filter(v => v.voterIdentity.toHexString() === myHex)
      .map(v => v.decisionId)
  );
  const needsMyVote = openDecisions.filter(d => !myVotedIds.has(d.id));
  const needsMyLock = openDecisions.filter(
    d => d.deciderIdentity?.toHexString() === myHex
  );

  const totalCount = myOpenTasks.length + needsMyVote.length + needsMyLock.length;

  return (
    <div>
      <p style={{ fontSize: 14, color: colors.muted, margin: '0 0 4px' }}>
        Good to see you, {me?.name ?? 'there'}
      </p>
      <h2
        style={{
          fontFamily: fonts.serif,
          fontWeight: 400,
          fontSize: 26,
          color: colors.ink2,
          margin: '0 0 20px',
        }}
      >
        {totalCount === 0
          ? 'All caught up'
          : `${totalCount} thing${totalCount === 1 ? '' : 's'} need${
              totalCount === 1 ? 's' : ''
            } you`}
      </h2>

      {needsMyLock.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <p style={{ ...sectionLabel }}>You decide</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {needsMyLock.map(d => (
              <button
                key={String(d.id)}
                type="button"
                onClick={() => onNavigate('decide')}
                style={{ ...cardStyle, width: '100%', cursor: 'pointer', textAlign: 'left' }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    flex: 'none',
                    borderRadius: 10,
                    background: '#FBEFD8',
                    color: '#9a6712',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                  }}
                >
                  ★
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 15 }}>{d.title}</b>
                  <span style={{ fontSize: 12, color: colors.muted }}>
                    Ready for your final call
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {needsMyVote.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <p style={{ ...sectionLabel }}>Needs your vote</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {needsMyVote.map(d => (
              <button
                key={String(d.id)}
                type="button"
                onClick={() => onNavigate('decide')}
                style={{ ...cardStyle, width: '100%', cursor: 'pointer', textAlign: 'left' }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    flex: 'none',
                    borderRadius: 10,
                    background: colors.greenTint,
                    color: colors.green,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                  }}
                >
                  ✓
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 15 }}>{d.title}</b>
                  <span style={{ fontSize: 12, color: colors.muted }}>
                    Cast your vote
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginBottom: 24 }}>
        <p style={{ ...sectionLabel }}>Your turn</p>
        {myOpenTasks.length === 0 ? (
          <p style={{ fontSize: 14, color: colors.muted }}>
            No open tasks assigned to you.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {myOpenTasks.map(task => (
              <label key={String(task.id)} style={{ ...cardStyle, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => toggleTask({ taskId: task.id })}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 15 }}>{task.title}</b>
                  {formatDue(task.dueAt) && (
                    <span style={{ fontSize: 12, color: colors.muted }}>
                      due {formatDue(task.dueAt)}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}
        {myOpenTasks.length > 0 && (
          <button
            type="button"
            onClick={() => onNavigate('tasks')}
            style={{
              marginTop: 10,
              border: 'none',
              background: 'none',
              color: colors.green,
              fontFamily: fonts.ui,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            See all tasks →
          </button>
        )}
      </section>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: colors.muted,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  margin: '0 0 10px',
};
