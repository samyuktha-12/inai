import { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Home, Vote, MapPin, Users, LogOut, ArrowLeft, X } from 'lucide-react';
import { tables, reducers } from '../module_bindings';
import { useTable, useReducer, useSpacetimeDB } from 'spacetimedb/react';
import TodayTab from './TodayTab';
import DecisionBoard from './DecisionBoard';
import WeddingTab from './WeddingTab';
import { colors, fonts } from '../theme';

type Tab = 'today' | 'decide' | 'wedding';

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

function PeoplePanel({ onClose, weddingId }: { onClose: () => void; weddingId: bigint }) {
  const auth = useAuth();
  const { identity } = useSpacetimeDB();
  const [participants] = useTable(tables.participant);
  const [members] = useTable(tables.member);
  const setName = useReducer(reducers.setName);
  const addMember = useReducer(reducers.addMember);
  const createWeddingInvitation = useReducer(reducers.createWeddingInvitation);
  const setMembershipSide = useReducer(reducers.setMembershipSide);
  const setMembershipRole = useReducer(reducers.setMembershipRole);
  const [name, setNameInput] = useState('');
  const [inviteRole, setInviteRole] = useState('family');
  const [inviteSide, setInviteSide] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const myHex = identity?.toHexString();
  const me = participants.find(p => p.identity.toHexString() === myHex);
  const weddingMembers = members.filter(member => member.weddingId === weddingId);
  const myMembership = weddingMembers.find(member => member.identity.toHexString() === myHex);
  const iAmAdmin = myMembership?.role === 'couple' || myMembership?.role === 'planner';
  const online = [...participants]
    .filter(p => p.connected)
    .sort((a, b) => a.name.localeCompare(b.name));

  const submitName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setName({ name: name.trim() });
    setNameInput('');
  };

  const createInvite = () => {
    const code = crypto.randomUUID().split('-').join('');
    createWeddingInvitation({ weddingId, code, role: inviteRole, side: inviteSide || undefined });
    setInviteLink(`${window.location.origin}/?invite=${code}`);
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
          {myMembership?.role && ` · ${ROLE_LABELS[myMembership.role] ?? myMembership.role}`}
          {myMembership?.side && ` · ${SIDE_LABELS[myMembership.side] ?? myMembership.side}`}
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

        {myMembership && <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['bride', 'groom'] as const).map(side => (
            <button
              key={side}
              type="button"
            onClick={() => setMembershipSide({ weddingId, identity: myMembership.identity, side })}
              style={{
                flex: 1,
                height: 36,
                borderRadius: 10,
                border: `1px solid ${myMembership.side === side ? colors.green : colors.hairline}`,
                background: myMembership.side === side ? colors.greenTint : '#FFFFFF',
                color: myMembership.side === side ? colors.green : colors.muted,
                fontFamily: fonts.ui,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {SIDE_LABELS[side]}
            </button>
          ))}
        </div>}

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
            const membership = weddingMembers.find(member => member.identity.toHexString() === p.identity.toHexString());
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
                {iAmAdmin && !membership ? (
                  <button type="button" onClick={() => addMember({ weddingId, identity: p.identity, role: 'family', side: undefined })} style={{ border: 'none', background: colors.greenTint, color: colors.green, borderRadius: 8, padding: '6px 9px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Add</button>
                ) : iAmAdmin && !isMe ? (
                  <select
                    value={membership?.role ?? 'guest'}
                    onChange={e =>
                      setMembershipRole({ weddingId, identity: p.identity, role: e.target.value })
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
                    {membership ? (ROLE_LABELS[membership.role] ?? membership.role) : 'Not added'}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {iAmAdmin && <section style={{ marginBottom: 20, padding: 14, border: `1px solid ${colors.hairline}`, borderRadius: 14, background: '#FFFFFF' }}>
          <b style={{ display: 'block', fontSize: 15, marginBottom: 5 }}>Invite someone</b>
          <p style={{ color: colors.muted, fontSize: 13, lineHeight: 1.4, margin: '0 0 10px' }}>Choose their role now. They can join after signing in with Google.</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 9 }}>
            <select value={inviteRole} onChange={event => setInviteRole(event.target.value)} style={{ flex: 1, height: 40, border: `1px solid ${colors.hairline}`, borderRadius: 9, padding: '0 8px' }}>
              {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={inviteSide} onChange={event => setInviteSide(event.target.value)} style={{ flex: 1, height: 40, border: `1px solid ${colors.hairline}`, borderRadius: 9, padding: '0 8px' }}>
              <option value="">No side yet</option><option value="bride">Bride’s side</option><option value="groom">Groom’s side</option>
            </select>
          </div>
          <button type="button" onClick={createInvite} style={{ width: '100%', height: 42, border: 'none', borderRadius: 10, background: colors.green, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Create invite link</button>
          {inviteLink && <><input readOnly value={inviteLink} aria-label="Wedding invitation link" style={{ width: '100%', height: 40, marginTop: 10, border: `1px solid ${colors.hairline}`, borderRadius: 9, padding: '0 8px', fontSize: 12 }} /><button type="button" onClick={() => navigator.clipboard?.writeText(inviteLink)} style={{ marginTop: 7, border: 0, background: 'transparent', color: colors.green, padding: 0, fontWeight: 700, cursor: 'pointer' }}>Copy link</button></>}
        </section>}

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

export default function AppShell({ onBack, weddingId }: { onBack: () => void; weddingId: bigint }) {
  const { isActive } = useSpacetimeDB();
  const [tab, setTab] = useState<Tab>('today');
  const [peopleOpen, setPeopleOpen] = useState(false);

  return (
    <div className="inai-app">
      <header className="inai-topbar">
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
            color: colors.ink2,
            fontFamily: fonts.ui,
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
              background: isActive ? colors.green : colors.hairline,
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
              border: `1px solid ${colors.hairline}`,
              background: colors.card,
              color: colors.ink2,
              cursor: 'pointer',
            }}
          >
            <Users size={18} />
          </button>
        </div>
      </header>

      <main className="inai-page">
        {tab === 'today' && <TodayTab weddingId={weddingId} onNavigate={t => setTab(t === 'tasks' ? 'wedding' : t)} />}
        {tab === 'decide' && <DecisionBoard weddingId={weddingId} />}
        {tab === 'wedding' && <WeddingTab weddingId={weddingId} />}
      </main>

      <nav className="inai-nav">
        <div className="inai-nav-inner">
          {(
            [
              ['today', 'Today', Home],
              ['decide', 'Decide', Vote],
              ['wedding', 'Wedding', MapPin],
            ] as [Tab, string, typeof Home][]
          ).map(([key, label, Icon]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={active ? 'active' : ''}
              >
                <Icon size={20} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {peopleOpen && <PeoplePanel weddingId={weddingId} onClose={() => setPeopleOpen(false)} />}
    </div>
  );
}
