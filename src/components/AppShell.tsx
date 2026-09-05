import { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Home, Vote, ListChecks, Users, LogOut, ArrowLeft, X } from 'lucide-react';
import { tables, reducers } from '../module_bindings';
import { useTable, useReducer, useSpacetimeDB } from 'spacetimedb/react';
import TodayTab from './TodayTab';
import DecisionBoard from './DecisionBoard';
import TaskBoard from './TaskBoard';
import { colors, fonts } from '../theme';

type Tab = 'today' | 'decide' | 'tasks';

const ROLE_LABELS: Record<string, string> = {
  couple: 'Couple',
  planner: 'Planner',
  family: 'Family',
  guest: 'Guest',
};

const SIDE_LABELS: Record<string, string> = {
  bride: "Bride's side",
  groom: "Groom's side",
};

function PeoplePanel({ onClose }: { onClose: () => void }) {
  const auth = useAuth();
  const { identity } = useSpacetimeDB();
  const [participants] = useTable(tables.participant);
  const setName = useReducer(reducers.setName);
  const setSide = useReducer(reducers.setSide);
  const setRole = useReducer(reducers.setRole);
  const [name, setNameInput] = useState('');

  const myHex = identity?.toHexString();
  const me = participants.find(p => p.identity.toHexString() === myHex);
  const iAmAdmin = me?.role === 'couple' || me?.role === 'planner';
  const online = [...participants]
    .filter(p => p.connected)
    .sort((a, b) => a.name.localeCompare(b.name));

  const submitName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setName({ name: name.trim() });
    setNameInput('');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(22,17,13,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: colors.paper,
          width: '100%',
          maxWidth: 560,
          margin: '0 auto',
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
          maxHeight: '80vh',
          overflowY: 'auto',
          fontFamily: fonts.sans,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontFamily: fonts.serif,
              fontWeight: 400,
              fontSize: 20,
              margin: 0,
              color: colors.ink2,
            }}
          >
            People
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: colors.paperAlt,
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: colors.ink2,
            }}
          >
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: colors.muted, margin: '0 0 8px' }}>
          You are <b style={{ color: colors.ink2 }}>{me?.name ?? '…'}</b>
          {me?.role && ` · ${ROLE_LABELS[me.role] ?? me.role}`}
          {me?.side && ` · ${SIDE_LABELS[me.side] ?? me.side}`}
        </p>

        <form
          onSubmit={submitName}
          style={{ display: 'flex', gap: 8, marginBottom: 10 }}
        >
          <input
            value={name}
            onChange={e => setNameInput(e.target.value)}
            placeholder="Set your name"
            style={{
              flex: 1,
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

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['bride', 'groom'] as const).map(side => (
            <button
              key={side}
              type="button"
              onClick={() => setSide({ side })}
              style={{
                flex: 1,
                height: 36,
                borderRadius: 10,
                border: `1px solid ${me?.side === side ? colors.green : colors.hairline}`,
                background: me?.side === side ? colors.greenTint : '#FFFFFF',
                color: me?.side === side ? colors.green : colors.muted,
                fontFamily: fonts.ui,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {SIDE_LABELS[side]}
            </button>
          ))}
        </div>

        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: colors.muted,
            letterSpacing: '.05em',
            textTransform: 'uppercase',
            margin: '0 0 10px',
          }}
        >
          Online now
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {online.map(p => {
            const isMe = p.identity.toHexString() === myHex;
            return (
              <div
                key={p.identity.toHexString()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#FFFFFF',
                  border: `1px solid ${colors.hairline}`,
                  borderRadius: 12,
                  padding: '10px 12px',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: colors.green,
                    flex: 'none',
                  }}
                />
                <span style={{ flex: 1, fontSize: 14 }}>
                  {p.name}
                  {isMe ? ' (you)' : ''}
                </span>
                {iAmAdmin && !isMe ? (
                  <select
                    value={p.role}
                    onChange={e =>
                      setRole({ identity: p.identity, role: e.target.value })
                    }
                    style={{
                      border: `1px solid ${colors.hairline}`,
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: fonts.ui,
                      padding: '4px 6px',
                    }}
                  >
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span style={{ fontSize: 12, color: colors.muted }}>
                    {ROLE_LABELS[p.role] ?? p.role}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => auth.signoutRedirect()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: 'none',
            background: 'none',
            color: colors.muted,
            fontFamily: fonts.ui,
            fontSize: 13,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}

export default function AppShell({ onBack }: { onBack: () => void }) {
  const { isActive } = useSpacetimeDB();
  const [tab, setTab] = useState<Tab>('today');
  const [peopleOpen, setPeopleOpen] = useState(false);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.paper,
        fontFamily: fonts.sans,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          background: colors.ink,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            color: colors.cream,
            fontFamily: fonts.serif,
            fontSize: 18,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <ArrowLeft size={16} /> Inai
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isActive ? colors.green : 'rgba(246,241,232,0.4)',
            }}
            title={isActive ? 'Connected' : 'Connecting…'}
          />
          <button
            type="button"
            onClick={() => setPeopleOpen(true)}
            aria-label="People"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '1px solid rgba(246,241,232,0.18)',
              background: 'transparent',
              color: colors.cream,
              cursor: 'pointer',
            }}
          >
            <Users size={16} />
          </button>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 560,
          margin: '0 auto',
          padding: '20px 16px calc(88px + env(safe-area-inset-bottom))',
          boxSizing: 'border-box',
        }}
      >
        {tab === 'today' && <TodayTab onNavigate={t => setTab(t)} />}
        {tab === 'decide' && <DecisionBoard />}
        {tab === 'tasks' && <TaskBoard />}
      </main>

      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          background: colors.ink,
          display: 'flex',
          justifyContent: 'center',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div style={{ display: 'flex', width: '100%', maxWidth: 560 }}>
          {(
            [
              ['today', 'Today', Home],
              ['decide', 'Decide', Vote],
              ['tasks', 'Tasks', ListChecks],
            ] as [Tab, string, typeof Home][]
          ).map(([key, label, Icon]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: '10px 4px',
                  background: 'none',
                  border: 'none',
                  color: active ? colors.green : 'rgba(246,241,232,0.6)',
                  fontFamily: fonts.ui,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Icon size={20} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {peopleOpen && <PeoplePanel onClose={() => setPeopleOpen(false)} />}
    </div>
  );
}
