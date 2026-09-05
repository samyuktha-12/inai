import { useMemo, useState } from 'react';
import { Timestamp } from 'spacetimedb';
import { tables, reducers } from '../module_bindings';
import { useTable, useReducer, useSpacetimeDB } from 'spacetimedb/react';
import { colors, fonts } from '../theme';

function formatDue(dueAt?: Timestamp) {
  if (!dueAt) return null;
  const date = new Date(Number(dueAt.microsSinceUnixEpoch / 1000n));
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function TaskBoard({ weddingId }: { weddingId: bigint }) {
  const { identity } = useSpacetimeDB();
  const [tasks] = useTable(tables.task);
  const [participants] = useTable(tables.participant);
  const createTask = useReducer(reducers.createTask);
  const toggleTask = useReducer(reducers.toggleTask);

  const [title, setTitle] = useState('');
  const [ownerHex, setOwnerHex] = useState('');
  const [dueDate, setDueDate] = useState('');

  const myHex = identity?.toHexString();

  const nameFor = (hex: string) =>
    participants.find(p => p.identity.toHexString() === hex)?.name ?? 'Someone';

  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => Number(a.id - b.id)),
    [tasks]
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const owner = participants.find(p => p.identity.toHexString() === ownerHex);
    if (!title.trim() || !owner) return;
    createTask({
      weddingId,
      title: title.trim(),
      ownerIdentity: owner.identity,
      dueAt: dueDate
        ? new Timestamp(BigInt(new Date(dueDate).getTime()) * 1000n)
        : undefined,
    });
    setTitle('');
    setDueDate('');
  };

  const inputStyle: React.CSSProperties = {
    height: 40,
    borderRadius: 10,
    border: `1px solid ${colors.hairline}`,
    padding: '0 12px',
    fontFamily: fonts.ui,
    fontSize: 14,
    boxSizing: 'border-box',
  };

  return (
    <div>
      <h2
        style={{
          fontFamily: fonts.serif,
          fontWeight: 400,
          fontSize: 22,
          color: colors.ink2,
          margin: '0 0 16px',
        }}
      >
        Tasks
      </h2>

      <form
        onSubmit={submit}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}
      >
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="New task"
          style={{ ...inputStyle, flex: '1 1 160px' }}
        />
        <select
          value={ownerHex}
          onChange={e => setOwnerHex(e.target.value)}
          style={{ ...inputStyle, flex: '1 1 140px' }}
        >
          <option value="">Assign to…</option>
          {participants.map(p => (
            <option key={p.identity.toHexString()} value={p.identity.toHexString()}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          style={{ ...inputStyle, flex: '1 1 140px' }}
        />
        <button
          type="submit"
          style={{
            height: 40,
            padding: '0 16px',
            borderRadius: 10,
            border: 'none',
            background: colors.green,
            color: '#FFFFFF',
            fontFamily: fonts.ui,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Add
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sortedTasks.map(task => {
          const mine = task.ownerIdentity.toHexString() === myHex;
          const due = formatDue(task.dueAt);
          return (
            <label
              key={String(task.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: '#FFFFFF',
                border: `1px solid ${colors.hairline}`,
                borderRadius: 12,
                padding: '10px 14px',
                opacity: task.done ? 0.6 : 1,
                cursor: mine ? 'pointer' : 'default',
              }}
            >
              <input
                type="checkbox"
                checked={task.done}
                disabled={!mine}
                onChange={() => toggleTask({ taskId: task.id })}
              />
              <span style={{ flex: 1 }}>
                <b
                  style={{
                    display: 'block',
                    fontSize: 15,
                    textDecoration: task.done ? 'line-through' : 'none',
                  }}
                >
                  {task.title}
                </b>
                <span style={{ fontSize: 12, color: colors.muted }}>
                  {nameFor(task.ownerIdentity.toHexString())}
                  {mine ? ' (you)' : ''}
                  {due ? ` · due ${due}` : ''}
                </span>
              </span>
            </label>
          );
        })}
        {sortedTasks.length === 0 && (
          <p style={{ color: colors.muted, fontSize: 14 }}>No tasks yet.</p>
        )}
      </div>
    </div>
  );
}
