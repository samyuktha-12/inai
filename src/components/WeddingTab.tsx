import { useMemo, useState } from 'react';
import { CalendarDays, CircleDollarSign, Image, Users, WalletCards } from 'lucide-react';
import { tables } from '../module_bindings';
import { useTable } from 'spacetimedb/react';

const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function WeddingTab({ weddingId }: { weddingId: bigint }) {
  const [view, setView] = useState<'events' | 'budget' | 'guests' | 'mood'>('budget');
  const [weddings] = useTable(tables.wedding);
  const [events] = useTable(tables.event);
  const [expenses] = useTable(tables.expense);
  const wedding = weddings.find(row => row.id === weddingId);
  const weddingExpenses = expenses.filter(row => row.weddingId === weddingId);
  const weddingEvents = events.filter(row => row.weddingId === weddingId);
  const total = useMemo(() => weddingExpenses.reduce((sum, row) => sum + Number(row.amountPaise) / 100, 0), [weddingExpenses]);
  const reported = weddingExpenses.filter(row => row.state === 'reported').length;
  const items = {
    events: <><p className="section-label">Events</p>{weddingEvents.length ? weddingEvents.map(event => <div className={`inai-card ${event.state === 'reported' ? 'reported' : ''}`} key={String(event.id)}><span className="card-icon"><CalendarDays size={21}/></span><span className="card-content"><b>{event.title}</b><span>{event.venue ?? 'Venue to confirm'}{event.state === 'reported' ? ' · needs confirmation' : ''}</span></span></div>) : <div className="panel"><CalendarDays color="#087d6b"/><h2>Start with the events</h2><p>Events brought in by an import will appear here for confirmation.</p></div>}</>,
    guests: <div className="panel"><Users color="#087d6b"/><h2>Guests, without the spreadsheet</h2><p>Invite links and RSVP status will appear here after a guest list is ingested.</p></div>,
    mood: <div className="panel"><Image color="#087d6b"/><h2>Your mood board</h2><p>Pinned ideas become grouped options on the Decide tab. Nothing is chosen automatically.</p></div>,
  };
  return <div><p className="eyebrow">{wedding ? `${wedding.city} · ${wedding.dateLabel}` : 'Your shared plan'}</p><h1 className="headline">The wedding</h1><div className="wedding-tabs">{([['events', 'Events'], ['budget', 'Budget'], ['guests', 'Guests'], ['mood', 'Mood']] as const).map(([key, label]) => <button className={view === key ? 'active' : ''} key={key} onClick={() => setView(key)}>{label}</button>)}</div>{view === 'budget' ? <><div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 26 }}><span className="card-icon" style={{ width: 38, height: 38, flexBasis: 38, borderRadius: 12 }}><WalletCards size={19}/></span><p className="section-label" style={{ margin: 0 }}>Spend tracked</p></div><div className="budget-number">{fmt.format(total)}</div><p className="budget-copy">{weddingExpenses.length ? (reported ? `${reported} line${reported === 1 ? '' : 's'} to confirm` : 'Every imported line is confirmed') : 'Add quotes to start your budget'}</p><div className="budget-bar" aria-label="Budget spend currently tracked"><span style={{ width: total ? '100%' : '0%' }}/></div>{reported > 0 && <p className="notice">Imported amounts stay clearly marked until someone confirms them.</p>}<div className="panel" style={{ marginTop: 24 }}><CircleDollarSign color="#087d6b"/><h2>{wedding ? `${wedding.primaryName} & ${wedding.partnerName}` : 'Your shared budget'}</h2><p>{wedding ? 'Quotes, deposits and spending appear here as a clean shared picture.' : 'Budget lines from quotes will be reviewed here.'}</p></div></> : items[view]}</div>;
}
