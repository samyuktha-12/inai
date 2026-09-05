import { useState } from 'react';
import { tables, reducers } from '../module_bindings';
import { useTable, useReducer, useSpacetimeDB } from 'spacetimedb/react';
import DecisionBoard from './DecisionBoard';
import TaskBoard from './TaskBoard';
import { colors, fonts } from '../theme';

export default function DemoApp({ onBack }: { onBack: () => void }) {
  const { isActive, identity } = useSpacetimeDB();
  const [participants] = useTable(tables.participant);
  const setName = useReducer(reducers.setName);
  const [name, setNameInput] = useState('');

  const myHex = identity?.toHexString();
  const me = participants.find(p => p.identity.toHexString() === myHex);
  const online = [...participants]
    .filter(p => p.connected)
    .sort((a, b) => a.name.localeCompare(b.name));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setName({ name: name.trim() });
    setNameInput('');
  };

  return (
    <div style={{ minHeight: '100vh', background: colors.paper, fontFamily: fonts.sans }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: `1px solid ${colors.hairline}`,
          background: colors.ink,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: colors.cream,
            fontFamily: fonts.serif,
            fontSize: 20,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          ← Inai
        </button>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: isActive ? colors.green : 'rgba(246,241,232,0.6)',
          }}
        >
          {isActive ? 'Connected' : 'Connecting…'}
        </span>
      </header>

      <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
        <section
          style={{
            marginBottom: 32,
            background: '#FFFFFF',
            border: `1px solid ${colors.hairline}`,
            borderRadius: 16,
            padding: 20,
          }}
        >
          <p style={{ margin: '0 0 12px', fontSize: 14, color: colors.muted }}>
            You are{' '}
            <b style={{ color: colors.ink2 }}>{me?.name ?? 'a guest'}</b>
          </p>
          <form
            onSubmit={submit}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}
          >
            <input
              value={name}
              onChange={e => setNameInput(e.target.value)}
              placeholder="Set your name"
              style={{
                flex: '1 1 200px',
                height: 40,
                borderRadius: 10,
                border: `1px solid ${colors.hairline}`,
                padding: '0 12px',
                fontFamily: fonts.ui,
                fontSize: 14,
                boxSizing: 'border-box',
              }}
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
              Save
            </button>
          </form>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {online.map(p => (
              <span
                key={p.identity.toHexString()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  background: colors.greenTint,
                  color: colors.green,
                  borderRadius: 999,
                  padding: '4px 12px',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: colors.green,
                  }}
                />
                {p.name}
                {p.identity.toHexString() === myHex ? ' (you)' : ''}
              </span>
            ))}
          </div>
        </section>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
            gap: 32,
          }}
        >
          <DecisionBoard />
          <TaskBoard />
        </div>
      </div>
    </div>
  );
}
