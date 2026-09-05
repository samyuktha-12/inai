import { useMemo, useState } from 'react';
import { Bot, CalendarDays, CalendarPlus, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, Clock3, FileText, Image, MapPin, MessageCircle, Milestone, Store, Users, WalletCards } from 'lucide-react';
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
  { kind: 'coordinator', title: 'Coordinator', copy: 'Included with every new wedding. Tracks open work and drafts in-app follow-ups.' },
  { kind: 'decision', title: 'Decision helper', copy: 'Summarises discussion and suggests a decision for a person to make in the app.' },
  { kind: 'guest_logistics', title: 'Guest logistics', copy: 'Organises RSVP and travel details as in-app drafts.' },
  { kind: 'vendor_liaison', title: 'Vendor helper', copy: 'Prepares vendor follow-up drafts in the app. It never contacts vendors without consent.' },
] as const;

type View = 'calendar' | 'events' | 'budget' | 'guests' | 'mood' | 'connect';

const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

function timestampDate(value?: { microsSinceUnixEpoch: bigint }) {
  return value ? new Date(Number(value.microsSinceUnixEpoch / 1000n)) : undefined;
}

function weddingDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, count: number) {
  return new Date(value.getFullYear(), value.getMonth() + count, 1);
}

function CalendarItinerary({ wedding, events }: { wedding?: { dateLabel: string }; events: Array<{ id: bigint; title: string; startsAt?: { microsSinceUnixEpoch: bigint }; venue?: string; state: string }> }) {
  const anchor = weddingDate(wedding?.dateLabel) ?? new Date();
  const [month, setMonth] = useState(() => startOfMonth(anchor));
  const datedEvents = events.flatMap(event => {
    const date = timestampDate(event.startsAt);
    return date ? [{ ...event, date }] : [];
  });
  const days = Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - month.getDay() + 1));
  const checkpoints = [
    { title: 'Dates and venues settled', offset: -180, copy: 'Keep the main ceremony and venue details together.' },
    { title: 'Guest list checkpoint', offset: -120, copy: 'Review the first list before invitations are drafted.' },
    { title: 'Vendor details checked', offset: -60, copy: 'Confirm who is doing what, and keep contact details handy.' },
    { title: 'Wedding week plan', offset: -7, copy: 'Make the final run-sheet easy for every family member to follow.' },
  ].map(checkpoint => ({ ...checkpoint, date: new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + checkpoint.offset) }));
  const weddingDay = datedEvents.find(event => event.date.toDateString() === anchor.toDateString());

  return <section className="itinerary" aria-label="Wedding itinerary calendar">
    <div className="itinerary-intro">
      <div><p className="section-label">Shared calendar</p><h2>Build the days together</h2><p>Events from your group appear here. Planning checkpoints are a guide until your family confirms the details.</p></div>
      <div className="itinerary-legend"><span><i className="confirmed-dot" /> Confirmed</span><span><i className="draft-dot" /> Needs review</span></div>
    </div>
    <div className="itinerary-summary">
      <div><span>On the calendar</span><b>{datedEvents.length}</b><small>{datedEvents.length === 1 ? 'event' : 'events'} with a date</small></div>
      <div><span>Next checkpoint</span><b>{checkpoints.find(item => item.date >= new Date()) ? dateFormatter.format(checkpoints.find(item => item.date >= new Date())!.date) : '—'}</b><small>Keep the plan moving</small></div>
      <div><span>Wedding day</span><b>{wedding ? dateFormatter.format(anchor) : '—'}</b><small>{weddingDay?.title ?? 'Date to confirm'}</small></div>
    </div>
    <div className="calendar-layout">
      <div className="calendar-surface">
        <div className="calendar-toolbar"><button type="button" onClick={() => setMonth(value => addMonths(value, -1))} aria-label="Previous month"><ChevronLeft size={20}/></button><h3>{monthFormatter.format(month)}</h3><button type="button" onClick={() => setMonth(value => addMonths(value, 1))} aria-label="Next month"><ChevronRight size={20}/></button></div>
        <div className="calendar-weekdays">{Array.from({ length: 7 }, (_, index) => <span key={index}>{dayFormatter.format(new Date(2023, 0, index + 1)).slice(0, 1)}</span>)}</div>
        <div className="calendar-grid">{days.map(day => {
          const entries = datedEvents.filter(event => event.date.toDateString() === day.toDateString());
          const guide = checkpoints.find(checkpoint => checkpoint.date.toDateString() === day.toDateString());
          const isWeddingDay = day.toDateString() === anchor.toDateString();
          return <div className={`calendar-day ${day.getMonth() !== month.getMonth() ? 'outside' : ''} ${isWeddingDay ? 'wedding-day' : ''}`} key={day.toISOString()}><time>{day.getDate()}</time>{isWeddingDay && <span className="calendar-wedding-mark" aria-label="Wedding day" />}{entries.slice(0, 2).map(event => <span className={`calendar-entry ${event.state === 'reported' ? 'draft' : ''}`} key={String(event.id)} title={event.title}>{event.title}</span>)}{guide && <span className="calendar-guide" title={guide.title}><Milestone size={12}/></span>}</div>;
        })}</div>
      </div>
      <aside className="itinerary-rail"><div className="rail-heading"><Milestone size={18}/><div><p className="section-label">Milestones</p><h3>Plan checkpoints</h3></div></div><div className="checkpoint-list">{checkpoints.map((checkpoint, index) => <article key={checkpoint.title}><span className="checkpoint-marker">{index < 1 ? <CheckCircle2 size={15}/> : <i />}</span><div><time>{dateFormatter.format(checkpoint.date)}</time><b>{checkpoint.title}</b><p>{checkpoint.copy}</p><small>Planning guide · review with the group</small></div></article>)}</div></aside>
    </div>
    <div className="itinerary-events"><div className="rail-heading"><CalendarDays size={18}/><div><p className="section-label">Run of show</p><h3>The day-by-day plan</h3></div></div>{datedEvents.length ? <div className="itinerary-event-list">{datedEvents.sort((a, b) => a.date.getTime() - b.date.getTime()).map(event => <article key={String(event.id)}><time>{dateFormatter.format(event.date)}</time><span className={event.state === 'reported' ? 'draft' : 'confirmed'}>{event.state === 'reported' ? 'Needs review' : 'Confirmed'}</span><div><b>{event.title}</b><p>{event.venue ? <><MapPin size={14}/>{event.venue}</> : <><Clock3 size={14}/>Time and place to confirm</>}</p></div></article>)}</div> : <p className="itinerary-empty">Add event details or a calendar export in Connect. Once your group has reviewed them, the dates will form the run of show here.</p>}</div>
  </section>;
}

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
    <div className="assistant-section"><div className="connect-intro"><p className="section-label">In-app assistants</p><h2>Set up your wedding team</h2><p>These assistants work inside Inai: they organise, draft, and track requests. A person still approves every decision, spend, and external commitment.</p></div><div className="assistant-list">{assistants.map(agent => {
      const current = agents.find(item => item.kind === agent.kind);
      const enabled = current?.enabled ?? false;
      return <article className={`assistant-card ${enabled ? 'enabled' : ''}`} key={agent.kind}><span className="assistant-icon"><Bot size={19}/></span><div><b>{agent.title}</b><p>{agent.copy}</p></div>{canManage && <button className={enabled ? 'assistant-toggle enabled' : 'assistant-toggle'} type="button" aria-pressed={enabled} onClick={() => setWeddingAgent({ weddingId, kind: agent.kind, enabled: !enabled })}>{enabled ? 'Added' : 'Add'}</button>}</article>;
    })}</div></div>
  </section>;
}

export default function WeddingTab({ weddingId }: { weddingId: bigint }) {
  const [view, setView] = useState<View>('calendar');
  const [weddings] = useTable(tables.wedding);
  const [events] = useTable(tables.event);
  const [expenses] = useTable(tables.expense);
  const wedding = weddings.find(row => row.id === weddingId);
  const weddingExpenses = expenses.filter(row => row.weddingId === weddingId);
  const weddingEvents = events.filter(row => row.weddingId === weddingId);
  const total = useMemo(() => weddingExpenses.reduce((sum, row) => sum + Number(row.amountPaise) / 100, 0), [weddingExpenses]);
  const reported = weddingExpenses.filter(row => row.state === 'reported').length;
  const items: Record<Exclude<View, 'budget'>, React.ReactNode> = {
    calendar: <CalendarItinerary wedding={wedding} events={weddingEvents} />,
    events: <><p className="section-label">Events</p>{weddingEvents.length ? weddingEvents.map(event => <div className={`inai-card ${event.state === 'reported' ? 'reported' : ''}`} key={String(event.id)}><span className="card-icon"><CalendarDays size={21}/></span><span className="card-content"><b>{event.title}</b><span>{event.venue ?? 'Venue to confirm'}{event.state === 'reported' ? ' · needs confirmation' : ''}</span></span></div>) : <div className="panel"><CalendarDays color="#087d6b"/><h2>Start with the events</h2><p>Events brought in by an import will appear here for confirmation.</p></div>}</>,
    guests: <div className="panel"><Users color="#087d6b"/><h2>Guests, without the spreadsheet</h2><p>Bring in a guest list from Connect. Every imported person is reviewed before they are invited.</p></div>,
    mood: <div className="panel"><Image color="#087d6b"/><h2>Your mood board</h2><p>Shared Pinterest images become grouped draft options on Decide. Nothing is chosen automatically.</p></div>,
    connect: <ConnectWedding weddingId={weddingId}/>,
  };
  return <div><p className="eyebrow">{wedding ? `${wedding.city} · ${wedding.dateLabel}` : 'Your shared plan'}</p><h1 className="headline">The wedding</h1><div className="wedding-tabs">{([['calendar', 'Calendar'], ['events', 'Events'], ['budget', 'Budget'], ['guests', 'Guests'], ['mood', 'Mood'], ['connect', 'Connect']] as const).map(([key, label]) => <button className={view === key ? 'active' : ''} key={key} onClick={() => setView(key)}>{label}</button>)}</div>{view === 'budget' ? <><div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 26 }}><span className="card-icon" style={{ width: 38, height: 38, flexBasis: 38, borderRadius: 12 }}><WalletCards size={19}/></span><p className="section-label" style={{ margin: 0 }}>Spend tracked</p></div><div className="budget-number">{fmt.format(total)}</div><p className="budget-copy">{weddingExpenses.length ? (reported ? `${reported} line${reported === 1 ? '' : 's'} to confirm` : 'Every imported line is confirmed') : 'Add quotes to start your budget'}</p><div className="budget-bar" aria-label="Budget spend currently tracked"><span style={{ width: total ? '100%' : '0%' }}/></div>{reported > 0 && <p className="notice">Imported amounts stay clearly marked until someone confirms them.</p>}<div className="panel" style={{ marginTop: 24 }}><CircleDollarSign color="#087d6b"/><h2>{wedding ? `${wedding.brideName} & ${wedding.groomName}` : 'Your shared budget'}</h2><p>{wedding ? 'Quotes, deposits and spending appear here as a clean shared picture.' : 'Budget lines from quotes will be reviewed here.'}</p></div></> : items[view]}</div>;
}
