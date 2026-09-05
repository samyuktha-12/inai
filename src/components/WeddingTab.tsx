import { useMemo, useState } from 'react';
import { Bot, CalendarDays, CalendarPlus, Check, CircleDollarSign, FileText, Image, MessageCircle, Store, Users, WalletCards } from 'lucide-react';
import { reducers, tables } from '../module_bindings';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';

const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

const sources = [
  { kind: 'pinterest', title: 'Pinterest board', copy: 'Share your board or drop images. We never scrape boards.', icon: Image },
  { kind: 'whatsapp', title: 'WhatsApp group export', copy: 'Upload the export from WhatsApp. We cannot read group history directly.', icon: MessageCircle },
  { kind: 'guests', title: 'Guest list', copy: 'Add a CSV, spreadsheet, or contacts export.', icon: Users },
  { kind: 'quotes', title: 'Vendor quotes', copy: 'Upload PDFs, photos, or budget sheets for review.', icon: FileText },
  { kind: 'vendor_details', title: 'Vendor details', copy: 'Add contracts, contacts, and booking notes.', icon: Store },
  { kind: 'calendar', title: 'Wedding calendar', copy: 'Share a calendar export so dates can be proposed for review.', icon: CalendarPlus },
] as const;

const assistants = [
  { kind: 'coordinator', title: 'Coordinator', copy: 'Keeps open work visible and drafts check-ins for owners.' },
  { kind: 'decision', title: 'Decision helper', copy: 'Summarises discussion and suggests a decision for a human to make.' },
  { kind: 'guest_logistics', title: 'Guest logistics', copy: 'Organises RSVPs and travel details as drafts.' },
  { kind: 'vendor_liaison', title: 'Vendor helper', copy: 'Prepares vendor follow-ups. It never calls without recorded consent.' },
] as const;

type View = 'events' | 'budget' | 'guests' | 'mood' | 'connect';

function ConnectWedding({ weddingId }: { weddingId: bigint }) {
  const { identity } = useSpacetimeDB();
  const [members] = useTable(tables.member);
  const [ingestSources] = useTable(tables.ingestSource);
  const [weddingAgents] = useTable(tables.weddingAgent);
  const requestIngest = useReducer(reducers.requestIngest);
  const setWeddingAgent = useReducer(reducers.setWeddingAgent);
  const membership = members.find(member => member.weddingId === weddingId && member.identity.toHexString() === identity?.toHexString());
  const canManage = membership?.role === 'couple' || membership?.role === 'planner';
  const queued = ingestSources.filter(source => source.weddingId === weddingId);
  const agents = weddingAgents.filter(agent => agent.weddingId === weddingId);

  return <section className="connect-wedding">
    <div className="connect-intro"><p className="section-label">Bring in what already exists</p><h2>Connect your planning sources</h2><p>Everything an assistant reads becomes a draft for your review. Nothing is confirmed or sent on your behalf.</p></div>
    <div className="source-list">{sources.map(source => {
      const Icon = source.icon;
      const existing = queued.filter(item => item.kind === source.kind);
      return <article className="source-card" key={source.kind}><span className="source-icon"><Icon size={19}/></span><div><b>{source.title}</b><p>{source.copy}</p>{existing.length > 0 && <small><Check size={13}/> {existing.length} {existing.length === 1 ? 'source' : 'sources'} waiting for upload</small>}</div>{canManage && <button type="button" className="source-add" onClick={() => requestIngest({ weddingId, kind: source.kind })}>{existing.length ? 'Add another' : 'Add source'}</button>}</article>;
    })}</div>
    <div className="assistant-section"><div className="connect-intro"><p className="section-label">Helpful assistants</p><h2>Set up your wedding team</h2><p>Assistants can organise, draft, and remind. A person still approves every decision, spend, and external commitment.</p></div><div className="assistant-list">{assistants.map(agent => {
      const current = agents.find(item => item.kind === agent.kind);
      const enabled = current?.enabled ?? false;
      return <article className={`assistant-card ${enabled ? 'enabled' : ''}`} key={agent.kind}><span className="assistant-icon"><Bot size={19}/></span><div><b>{agent.title}</b><p>{agent.copy}</p></div>{canManage && <button className={enabled ? 'assistant-toggle enabled' : 'assistant-toggle'} type="button" aria-pressed={enabled} onClick={() => setWeddingAgent({ weddingId, kind: agent.kind, enabled: !enabled })}>{enabled ? 'Added' : 'Add'}</button>}</article>;
    })}</div></div>
  </section>;
}

export default function WeddingTab({ weddingId }: { weddingId: bigint }) {
  const [view, setView] = useState<View>('budget');
  const [weddings] = useTable(tables.wedding);
  const [events] = useTable(tables.event);
  const [expenses] = useTable(tables.expense);
  const wedding = weddings.find(row => row.id === weddingId);
  const weddingExpenses = expenses.filter(row => row.weddingId === weddingId);
  const weddingEvents = events.filter(row => row.weddingId === weddingId);
  const total = useMemo(() => weddingExpenses.reduce((sum, row) => sum + Number(row.amountPaise) / 100, 0), [weddingExpenses]);
  const reported = weddingExpenses.filter(row => row.state === 'reported').length;
  const items: Record<Exclude<View, 'budget'>, React.ReactNode> = {
    events: <><p className="section-label">Events</p>{weddingEvents.length ? weddingEvents.map(event => <div className={`inai-card ${event.state === 'reported' ? 'reported' : ''}`} key={String(event.id)}><span className="card-icon"><CalendarDays size={21}/></span><span className="card-content"><b>{event.title}</b><span>{event.venue ?? 'Venue to confirm'}{event.state === 'reported' ? ' · needs confirmation' : ''}</span></span></div>) : <div className="panel"><CalendarDays color="#087d6b"/><h2>Start with the events</h2><p>Events brought in by an import will appear here for confirmation.</p></div>}</>,
    guests: <div className="panel"><Users color="#087d6b"/><h2>Guests, without the spreadsheet</h2><p>Bring in a guest list from Connect. Every imported person is reviewed before they are invited.</p></div>,
    mood: <div className="panel"><Image color="#087d6b"/><h2>Your mood board</h2><p>Shared Pinterest images become grouped draft options on Decide. Nothing is chosen automatically.</p></div>,
    connect: <ConnectWedding weddingId={weddingId}/>,
  };
  return <div><p className="eyebrow">{wedding ? `${wedding.city} · ${wedding.dateLabel}` : 'Your shared plan'}</p><h1 className="headline">The wedding</h1><div className="wedding-tabs">{([['events', 'Events'], ['budget', 'Budget'], ['guests', 'Guests'], ['mood', 'Mood'], ['connect', 'Connect']] as const).map(([key, label]) => <button className={view === key ? 'active' : ''} key={key} onClick={() => setView(key)}>{label}</button>)}</div>{view === 'budget' ? <><div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 26 }}><span className="card-icon" style={{ width: 38, height: 38, flexBasis: 38, borderRadius: 12 }}><WalletCards size={19}/></span><p className="section-label" style={{ margin: 0 }}>Spend tracked</p></div><div className="budget-number">{fmt.format(total)}</div><p className="budget-copy">{weddingExpenses.length ? (reported ? `${reported} line${reported === 1 ? '' : 's'} to confirm` : 'Every imported line is confirmed') : 'Add quotes to start your budget'}</p><div className="budget-bar" aria-label="Budget spend currently tracked"><span style={{ width: total ? '100%' : '0%' }}/></div>{reported > 0 && <p className="notice">Imported amounts stay clearly marked until someone confirms them.</p>}<div className="panel" style={{ marginTop: 24 }}><CircleDollarSign color="#087d6b"/><h2>{wedding ? `${wedding.brideName} & ${wedding.groomName}` : 'Your shared budget'}</h2><p>{wedding ? 'Quotes, deposits and spending appear here as a clean shared picture.' : 'Budget lines from quotes will be reviewed here.'}</p></div></> : items[view]}</div>;
}
