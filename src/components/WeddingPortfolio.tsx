import { useEffect, useState } from 'react';
import { CalendarDays, ChevronRight, Copy, HeartHandshake, Plus, Settings, Users } from 'lucide-react';
import { tables, reducers } from '../module_bindings';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import { useAuth } from 'react-oidc-context';
import Onboarding, { type NewWeddingPlan } from './Onboarding';
import '../profile-form.css';
import '../invite-flow.css';

type Props = { onOpenWedding: (id: bigint) => void };

type InvitePreview = { weddingId: string; brideName: string; groomName: string; city: string; dateLabel: string; role: string; side: string | null; status: 'pending' | 'accepted' | 'declined' };

function invitePreviewUrl(code: string) {
  const host = (import.meta.env.VITE_SPACETIMEDB_HOST ?? 'ws://localhost:3000').replace(/^ws/, 'http').replace(/\/$/, '');
  const database = import.meta.env.VITE_SPACETIMEDB_DB_NAME ?? 'react-ts';
  return `${host}/v1/database/${encodeURIComponent(database)}/route/invites/preview?code=${encodeURIComponent(code)}`;
}

function removeInviteFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('invite');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function DateOfBirthFields({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [parts, setParts] = useState(() => {
    const [year = '', month = '', day = ''] = value ? value.split('-') : [];
    return { day, month, year };
  });
  useEffect(() => {
    if (!value) return;
    const [year = '', month = '', day = ''] = value.split('-');
    setParts({ day, month, year });
  }, [value]);
  const update = (part: 'day' | 'month' | 'year', raw: string) => {
    const next = { ...parts, [part]: raw.replace(/\D/g, '').slice(0, part === 'year' ? 4 : 2) };
    setParts(next);
    if (next.day.length === 2 && next.month.length === 2 && next.year.length === 4) {
      const candidate = `${next.year}-${next.month}-${next.day}`;
      const parsed = new Date(`${candidate}T12:00:00`);
      onChange(!Number.isNaN(parsed.getTime()) && parsed.getFullYear() === Number(next.year) && parsed.getMonth() + 1 === Number(next.month) && parsed.getDate() === Number(next.day) ? candidate : '');
    } else onChange('');
  };
  return <span className="profile-date-fields"><input value={parts.day} onChange={event => update('day', event.target.value)} inputMode="numeric" placeholder="DD" maxLength={2} aria-label="Day of birth" /><input value={parts.month} onChange={event => update('month', event.target.value)} inputMode="numeric" placeholder="MM" maxLength={2} aria-label="Month of birth" /><input value={parts.year} onChange={event => update('year', event.target.value)} inputMode="numeric" placeholder="YYYY" maxLength={4} aria-label="Year of birth" /></span>;
}

function ProfileSheet({ onClose, initialName, required }: { onClose: () => void; initialName: string; required?: boolean }) {
  const { identity } = useSpacetimeDB();
  const [people] = useTable(tables.participant);
  const updateMyProfile = useReducer(reducers.updateMyProfile);
  const person = people.find(row => row.identity.toHexString() === identity?.toHexString());
  const suggestedName = initialName === 'Anonymous User' ? '' : initialName;
  const [name, setName] = useState(person?.name === undefined || person.name.startsWith('Guest ') || person.name === 'Anonymous User' ? suggestedName : person.name);
  const [phone, setPhone] = useState(person?.phone ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(person?.dateOfBirth ?? '');
  const [gender, setGender] = useState(person?.gender ?? '');
  const [mealPreference, setMealPreference] = useState(person?.mealPreference ?? 'vegetarian');
  const normalisedPhone = phone.replace(/\s|-/g, '').replace(/^91(?=\d{10}$)/, '+91').replace(/^(?=[6-9]\d{9}$)/, '+91');
  const validPhone = /^\+91[6-9]\d{9}$/.test(normalisedPhone);
  return <div className="modal-backdrop modal-backdrop--sheet" onClick={required ? undefined : onClose}><section className="modal-sheet profile-sheet" role="dialog" aria-modal="true" aria-labelledby="profile-sheet-title" onClick={event => event.stopPropagation()}><div className="modal-handle" aria-hidden="true" /><div className="sheet-heading"><div><p className="eyebrow">Your profile</p><h2 id="profile-sheet-title">Before we start, tell us a little about you</h2></div>{!required && <button className="close-button" aria-label="Close profile" onClick={onClose}>×</button>}</div><p className="profile-help">{required ? 'Add your name and mobile number so everyone knows who joined the wedding.' : 'Your name was set during profile setup. You can update your phone and planning details below.'}</p><label>Your name<input readOnly={!required} aria-readonly={!required} value={name} onChange={event => setName(event.target.value)} placeholder="Your name" /></label><label>Mobile number <span>Required · India</span><input type="tel" inputMode="numeric" maxLength={14} value={phone} onChange={event => setPhone(event.target.value.replace(/[^\d+\s-]/g, ''))} placeholder="+91 93603 05804" aria-invalid={phone.length > 0 && !validPhone} aria-describedby={phone.length > 0 && !validPhone ? 'phone-error' : undefined} /></label>{phone.length > 0 && !validPhone && <p className="form-error" id="phone-error">Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.</p>}<label>Date of birth <span>Optional</span><DateOfBirthFields value={dateOfBirth} onChange={setDateOfBirth} /></label><label>Gender <span>Optional</span><select value={gender} onChange={event => setGender(event.target.value)}><option value="">Prefer not to say</option><option value="woman">Woman</option><option value="man">Man</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></select></label><label>Meal preference<select value={mealPreference} onChange={event => setMealPreference(event.target.value)}><option value="vegetarian">Vegetarian</option><option value="non_vegetarian">Non-vegetarian</option><option value="vegan">Vegan</option><option value="jain">Jain</option><option value="no_preference">No preference</option></select></label><button className="primary-button" disabled={!name.trim() || !validPhone} onClick={() => { updateMyProfile({ name: name.trim(), phone: normalisedPhone, dateOfBirth: dateOfBirth || undefined, gender: gender || undefined, mealPreference: mealPreference || undefined }); onClose(); }}>{required ? 'Continue' : 'Save profile'}</button></section></div>;
}

function NewWeddingHome({
  name,
  onCreate,
  onProfile,
  onInvite,
}: {
  name?: string;
  onCreate: () => void;
  onProfile: () => void;
  onInvite: () => void;
}) {
  return <main className="portfolio-page portfolio-new">
    <header className="new-home-header">
      <div className="inai-brand"><HeartHandshake size={27} /><b>Inai</b></div>
      <div className="new-home-profile"><span>{name ?? 'Your account'}</span><button className="avatar-button" aria-label="Open your profile" onClick={onProfile}><Settings size={18}/></button></div>
    </header>
    <div className="new-home-orbits" aria-hidden><i /><i /><i /><b /></div>
    <section className="new-home-grid">
      <div className="new-home-intro">
        <span className="new-home-rule"><i /> <b /></span>
        <h1>Your weddings</h1>
        <p className="new-home-lead">Nothing here yet. Start a plan for your family, or wait to be added to one.</p>
        <h2>Start your first plan</h2>
        <p>Four questions to begin. Inai builds the events, budget and guest list from whatever you already have, then shows them to you as drafts.</p>
        <div className="new-home-actions"><button className="create-wedding-button" onClick={onCreate}><Plus size={20}/> Create a wedding plan</button><button className="invite-button" type="button" onClick={onInvite}>I have an invite code</button></div>
        <ol className="new-home-steps"><li><span>1</span><div><b>Name the wedding</b><p>Two names, a rough month, a city. A guess is fine.</p></div></li><li><span>2</span><div><b>Bring in what you have</b><p>Pinterest board, WhatsApp export, guest sheet, vendor quotes. All optional.</p></div></li><li><span>3</span><div><b>Confirm the drafts</b><p>Nothing is committed until you say yes. Then you can add the family.</p></div></li></ol>
      </div>
      <aside className="new-home-preview">
        <p>A wedding will look like this once you are added to one.</p>
        <div className="preview-card" aria-hidden><div className="preview-top"><i /><span><b /><b /></span></div><div className="preview-line wide" /><div className="preview-line" /><div className="preview-line short" /><div className="preview-rings"><i /><i /></div></div>
      </aside>
    </section>
  </main>;
}

function InvitePeople({ weddingId }: { weddingId: bigint }) {
  const createInvitation = useReducer(reducers.createWeddingInvitation);
  const [link, setLink] = useState('');
  const [role, setRole] = useState('');
  const [side, setSide] = useState('');
  const makeInvite = () => {
    if (!role) return;
    const code = crypto.randomUUID();
    createInvitation({ weddingId, code, role, side: side || undefined });
    setLink(`${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(code)}`);
  };
  return <section className="invite-people"><div><p className="eyebrow">Next step</p><h2>Invite your family</h2><p>Choose their role before sending the private link. They will join with that role and cannot change it themselves.</p></div>{link ? <div className="invite-link"><code>{link}</code><button type="button" onClick={() => navigator.clipboard?.writeText(link)}><Copy size={16} /> Copy link</button></div> : <><div className="invite-role-fields"><label>Role<select value={role} onChange={event => setRole(event.target.value)}><option value="" disabled>Choose a role</option><option value="couple">Couple</option><option value="planner">Event creator</option><option value="family">Family</option><option value="guest">Guest</option></select></label><label>Side <span>Optional</span><select value={side} onChange={event => setSide(event.target.value)}><option value="">No side yet</option><option value="bride">Bride’s side</option><option value="groom">Groom’s side</option></select></label></div><button className="primary-button" type="button" disabled={!role} onClick={makeInvite}>Create an invite link</button></>}</section>;
}

function InviteCodeSheet({ onClose, onContinue }: { onClose: () => void; onContinue: (code: string) => void }) {
  const [code, setCode] = useState('');
  return <div className="modal-backdrop modal-backdrop--sheet" onClick={onClose}><section className="modal-sheet invite-code-sheet" role="dialog" aria-modal="true" aria-labelledby="invite-code-title" onClick={event => event.stopPropagation()}><div className="modal-handle" aria-hidden="true" /><div className="sheet-heading"><div><p className="eyebrow">Join a wedding</p><h2 id="invite-code-title">Enter your invite code</h2></div><button className="close-button" aria-label="Close invite code" onClick={onClose}>×</button></div><p>Paste the private code shared by the couple or planner.</p><label>Invite code<input autoFocus value={code} onChange={event => setCode(event.target.value)} placeholder="Paste your code" /></label><button className="primary-button" disabled={!code.trim()} onClick={() => onContinue(code.trim())}>Continue</button></section></div>;
}

export default function WeddingPortfolio({ onOpenWedding }: Props) {
  const auth = useAuth();
  const { identity } = useSpacetimeDB();
  const [memberships] = useTable(tables.member);
  const [weddings] = useTable(tables.wedding);
  const [people] = useTable(tables.participant);
  const [creating, setCreating] = useState(false);
  const [newPlan, setNewPlan] = useState<NewWeddingPlan | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileAfterInvite, setProfileAfterInvite] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [decliningInvite, setDecliningInvite] = useState(false);
  const [inviteDeclined, setInviteDeclined] = useState(false);
  const [invitedWeddingId, setInvitedWeddingId] = useState<string | null>(null);
  const [inviteEntryOpen, setInviteEntryOpen] = useState(false);
  const acceptWeddingInvitation = useReducer(reducers.acceptWeddingInvitation);
  const declineWeddingInvitation = useReducer(reducers.declineWeddingInvitation);
  const [inviteCode, setInviteCode] = useState(() => new URLSearchParams(window.location.search).get('invite') ?? localStorage.getItem('inai-invite') ?? '');
  const [inviteError, setInviteError] = useState('');
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const myId = identity?.toHexString();
  const me = people.find(row => row.identity.toHexString() === myId);
  const googleName = typeof auth.user?.profile?.name === 'string' ? auth.user.profile.name : '';
  const mine = memberships.filter(row => row.identity.toHexString() === myId).map(member => ({ member, wedding: weddings.find(wedding => wedding.id === member.weddingId) })).filter((row): row is { member: typeof memberships[number]; wedding: typeof weddings[number] } => !!row.wedding);
  const joinedInvitation = invitedWeddingId !== null && mine.some(({ wedding }) => wedding.id.toString() === invitedWeddingId);
  const profileIsComplete = Boolean(me?.phone && me.profileState === 'confirmed' && !me.name.startsWith('Guest ') && me.name !== 'Anonymous User');
  useEffect(() => {
    if (!newPlan) return;
    const planIsLive = mine.some(({ wedding }) =>
      wedding.brideName === newPlan.brideName &&
      wedding.groomName === newPlan.groomName &&
      wedding.city === newPlan.city &&
      wedding.dateLabel === newPlan.dateLabel
    );
    if (planIsLive) setNewPlan(null);
  }, [mine, newPlan]);
  useEffect(() => {
    if (!inviteCode) { setInvitePreview(null); return; }
    let cancelled = false;
    fetch(invitePreviewUrl(inviteCode))
      .then(response => response.ok ? response.json() : null)
      .then((preview: InvitePreview | null) => { if (!cancelled) { setInvitePreview(preview); if (preview) setInvitedWeddingId(preview.weddingId); } })
      .catch(() => { if (!cancelled) setInvitePreview(null); });
    return () => { cancelled = true; };
  }, [inviteCode]);
  useEffect(() => {
    if (!inviteCode || !joinedInvitation) return;
    localStorage.removeItem('inai-invite');
    removeInviteFromUrl();
    setInviteCode('');
    setInviteError('');
    setAcceptingInvite(false);
    setProfileAfterInvite(true);
  }, [inviteCode, joinedInvitation]);

  if (creating) return <Onboarding onComplete={plan => { setNewPlan(plan); setCreating(false); }} />;
  const acceptInvite = async () => {
    if (!inviteCode.trim()) return;
    setAcceptingInvite(true);
    setInviteError('');
    try { await acceptWeddingInvitation({ code: inviteCode.trim() }); }
    catch { setAcceptingInvite(false); setInviteError('That invite could not be accepted. Ask the wedding owner for a new link.'); }
  };
  const declineInvite = async () => {
    if (!inviteCode.trim()) return;
    setDecliningInvite(true);
    setInviteError('');
    try { await declineWeddingInvitation({ code: inviteCode.trim() }); setInviteDeclined(true); }
    catch { setDecliningInvite(false); setInviteError('That invitation could not be declined. Please try again.'); }
  };
  const leaveInvitation = () => { localStorage.removeItem('inai-invite'); removeInviteFromUrl(); setInviteCode(''); setInviteDeclined(false); };
  if (inviteCode && !joinedInvitation && !newPlan) return <main className="portfolio-page invite-accept-page"><section className="invite-accept-card"><p className="eyebrow">Wedding invitation</p><h1>{invitePreview ? `${invitePreview.brideName} & ${invitePreview.groomName}` : 'You’re invited'}</h1>{inviteDeclined || invitePreview?.status === 'declined' ? <><p>You’ve declined this invitation. You will not be added to this wedding.</p><button className="secondary-button" onClick={leaveInvitation}>Back to your weddings</button></> : <>{invitePreview ? <p>{invitePreview.city} · {invitePreview.dateLabel}<br />You’ll join as {invitePreview.role === 'planner' ? 'event creator' : invitePreview.role}{invitePreview.side ? ` · ${invitePreview.side === 'bride' ? 'Bride’s side' : 'Groom’s side'}` : ''}.</p> : <p>Checking the invitation details…</p>}{invitePreview?.status === 'accepted' ? <><p className="form-error">This invitation has already been used.</p><small>Ask the wedding owner to send you a new link if you need access.</small></> : <><button className="primary-button" onClick={acceptInvite} disabled={!invitePreview || acceptingInvite || decliningInvite}>{acceptingInvite ? 'Joining wedding…' : 'Accept invitation'}</button>{invitePreview?.role === 'guest' && <button className="invite-decline-button" onClick={declineInvite} disabled={!invitePreview || acceptingInvite || decliningInvite}>{decliningInvite ? 'Declining…' : 'Decline invitation'}</button>}{inviteError && <span className="form-error">{inviteError}</span>}<small>You can add your contact and planning details next.</small></>}</>}</section></main>;
  if ((profileAfterInvite || mine.length > 0) && !profileIsComplete) return <ProfileSheet required initialName={googleName} onClose={() => undefined} />;
  if (mine.length === 0 && !newPlan && !inviteCode) return <><NewWeddingHome name={me?.name?.startsWith('Guest ') ? googleName : me?.name} onCreate={() => setCreating(true)} onProfile={() => setProfileOpen(true)} onInvite={() => setInviteEntryOpen(true)} />{profileOpen && <ProfileSheet initialName={googleName} onClose={() => setProfileOpen(false)} />}{inviteEntryOpen && <InviteCodeSheet onClose={() => setInviteEntryOpen(false)} onContinue={code => { setInviteCode(code); setInviteEntryOpen(false); }} />}</>;
  return <main className="portfolio-page"><header className="portfolio-header"><div><p className="eyebrow">Welcome{me?.name ? `, ${me.name}` : ''}</p><h1>Your weddings</h1></div><button className="avatar-button" aria-label="Open your profile" onClick={() => setProfileOpen(true)}>{me?.name?.slice(0, 1).toUpperCase() || <Settings size={18}/>}</button></header><p className="portfolio-intro">Choose a wedding to see what needs you, or start a new plan.</p>{inviteCode && <section className="join-invite"><b>{invitePreview ? `${invitePreview.brideName} & ${invitePreview.groomName}` : 'You’ve been invited to a wedding'}</b>{invitePreview ? <p>{invitePreview.city} · {invitePreview.dateLabel}<br />Join as {invitePreview.role === 'planner' ? 'event creator' : invitePreview.role}{invitePreview.side ? ` · ${invitePreview.side === 'bride' ? 'Bride’s side' : 'Groom’s side'}` : ''}.</p> : <p>Checking the wedding details…</p>}<button className="primary-button" onClick={acceptInvite}>Join this wedding</button>{inviteError && <span>{inviteError}</span>}</section>}<section className="wedding-list" aria-live="polite">{newPlan && <div className="wedding-card" aria-label={`${newPlan.brideName} and ${newPlan.groomName}'s wedding plan is being set up`}><span className="wedding-card-mark"><CalendarDays size={22}/></span><span className="wedding-card-copy"><b>{newPlan.brideName} & {newPlan.groomName}</b><span>{newPlan.city} · {newPlan.dateLabel}</span><small>Setting up your plan…</small></span></div>}{mine.map(({ member, wedding }) => <button className="wedding-card" key={String(wedding.id)} onClick={() => onOpenWedding(wedding.id)}><span className="wedding-card-mark"><CalendarDays size={22}/></span><span className="wedding-card-copy"><b>{wedding.brideName} & {wedding.groomName}</b><span>{wedding.city} · {wedding.dateLabel}</span><small><Users size={13}/>{member.role === 'family' ? `${member.side === 'bride' ? 'Bride' : member.side === 'groom' ? 'Groom' : 'Family'} side` : member.role === 'planner' ? 'Event creator' : member.role}</small></span><ChevronRight size={20}/></button>)}</section>{mine.filter(({ member }) => member.role === 'couple' || member.role === 'planner').map(({ wedding }) => <InvitePeople key={`invite-${wedding.id}`} weddingId={wedding.id} />)}<button className="create-wedding-button" onClick={() => setCreating(true)}><Plus size={20}/> Create a wedding plan</button>{profileOpen && <ProfileSheet initialName={googleName} onClose={() => setProfileOpen(false)} />}</main>;
}
