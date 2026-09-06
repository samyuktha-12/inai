import { CalendarDays, ChevronLeft, Clock3, MapPin, ShieldCheck } from 'lucide-react';
import { tables } from '../module_bindings';
import { useSpacetimeDB, useTable } from 'spacetimedb/react';
import '../guest-wedding.css';

function asDate(value?: { microsSinceUnixEpoch: bigint }) { return value ? new Date(Number(value.microsSinceUnixEpoch / 1000n)) : undefined; }

export default function GuestWeddingView({ weddingId, onBack }: { weddingId: bigint; onBack: () => void }) {
  const { identity } = useSpacetimeDB();
  const [weddings] = useTable(tables.wedding);
  const [participants] = useTable(tables.participant);
  const [events] = useTable(tables.event);
  const wedding = weddings.find(item => item.id === weddingId);
  const person = participants.find(item => item.identity.toHexString() === identity?.toHexString());
  const schedule = events.filter(item => item.weddingId === weddingId && item.state === 'confirmed').sort((left, right) => Number((left.startsAt?.microsSinceUnixEpoch ?? 0n) - (right.startsAt?.microsSinceUnixEpoch ?? 0n)));
  return <main className="guest-wedding-page"><header className="guest-wedding-header"><button type="button" onClick={onBack}><ChevronLeft size={19} /> All weddings</button><span><ShieldCheck size={16} /> Guest view</span></header><section className="guest-wedding-hero"><p className="eyebrow">You’re invited</p><h1>{wedding ? `${wedding.brideName} & ${wedding.groomName}` : 'Wedding invitation'}</h1><p>{wedding ? `${wedding.city} · ${wedding.dateLabel}` : 'Your invitation details are loading.'}</p></section><section className="guest-wedding-content"><article className="guest-welcome-card"><CalendarDays size={25}/><div><p className="section-label">Welcome, {person?.name && !person.name.startsWith('Guest ') ? person.name.split(' ')[0] : 'guest'}</p><h2>Your wedding details</h2><p>Keep this page handy for confirmed dates, times, and places shared by the wedding family.</p></div></article><section className="guest-schedule"><div className="guest-section-heading"><div><p className="section-label">Schedule</p><h2>Confirmed moments</h2></div><small>Only confirmed details appear here.</small></div>{schedule.length ? <div className="guest-event-list">{schedule.map(event => { const date = asDate(event.startsAt); return <article key={String(event.id)}><time>{date ? date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date to confirm'}</time><div><b>{event.title}</b><p><Clock3 size={15}/>{date ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'Time to confirm'}</p>{event.venue && <p><MapPin size={15}/>{event.venue}</p>}</div></article>; })}</div> : <div className="guest-empty"><CalendarDays size={22}/><p>The family has not shared confirmed schedule details yet. They will appear here when ready.</p></div>}</section><aside className="guest-note"><b>What you can expect</b><p>Attendance, travel, and arrival instructions will be shared here if the wedding family needs them from you.</p><small>Planning conversations, decisions, money, vendors, and family contact details stay private to the planning team.</small></aside></section></main>;
}
