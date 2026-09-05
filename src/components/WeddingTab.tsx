import { useMemo, useState, type FormEvent } from 'react';
import { Timestamp } from 'spacetimedb';
import { Bot, CalendarDays, CalendarPlus, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, Clock3, FileText, Image, MapPin, MessageCircle, Milestone, Plus, Store, Upload, Users, WalletCards, X } from 'lucide-react';
import { reducers, tables } from '../module_bindings';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import { parseImport, type ParsedImport } from '../lib/ingest';

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

function AddEvent({ weddingId, onDone }: { weddingId: bigint; onDone: () => void }) {
  const createEvent = useReducer(reducers.createEvent);
  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    createEvent({ weddingId, title: title.trim(), venue: venue.trim() || undefined, startsAt: startsAt ? Timestamp.fromDate(new Date(startsAt)) : undefined, source: 'manual', confidence: 1 });
    onDone();
  };
  return <form className="quick-add-form" onSubmit={submit}>
    <div className="quick-add-heading"><div><p className="section-label">Add an event</p><h2>Put a moment on the plan</h2></div><button type="button" onClick={onDone} aria-label="Close add event"><X size={18}/></button></div>
    <label>Event name<input value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Mehendi" required maxLength={200} autoFocus /></label>
    <label>When<input type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} /></label>
    <label>Venue <span>optional</span><input value={venue} onChange={event => setVenue(event.target.value)} placeholder="e.g. The Leela Palace" maxLength={300} /></label>
    <p>New event details are marked for the group to review.</p>
    <button className="primary-button" type="submit"><Plus size={17}/> Add event</button>
  </form>;
}

function ContactImport({ weddingId }: { weddingId: bigint }) {
  const requestIngest = useReducer(reducers.requestIngest);
  const [fileName, setFileName] = useState('');
  const [queued, setQueued] = useState(false);
  const queue = () => {
    if (!fileName) return;
    requestIngest({ weddingId, kind: 'guests' });
    setQueued(true);
  };
  return <section className="contact-import panel"><Upload color="#087d6b"/><h2>Import contacts</h2><p>Choose a contacts CSV, spreadsheet, or phone export. The import worker will turn it into reviewable guest records; nobody is invited automatically.</p><label className="file-picker"><input type="file" accept=".csv,.tsv,.xlsx,.xls,text/csv" onChange={event => { setFileName(event.target.files?.[0]?.name ?? ''); setQueued(false); }} /><Upload size={16}/>{fileName || 'Choose a contacts file'}</label>{fileName && <button type="button" className="primary-button" onClick={queue} disabled={queued}>{queued ? 'Import queued for review' : 'Queue contact import'}</button>}</section>;
}

function AddCustomAgent({ weddingId, onDone }: { weddingId: bigint; onDone: () => void }) {
  const createCustomWeddingAgent = useReducer(reducers.createCustomWeddingAgent);
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !instructions.trim()) return;
    createCustomWeddingAgent({ weddingId, name: name.trim(), instructions: instructions.trim() });
    onDone();
  };
  return <form className="quick-add-form custom-agent-form" onSubmit={submit}>
    <div className="quick-add-heading"><div><p className="section-label">New assistant</p><h2>Give your wedding team a hand</h2></div><button type="button" onClick={onDone} aria-label="Close new assistant"><X size={18}/></button></div>
    <label>Assistant name<input value={name} onChange={event => setName(event.target.value)} maxLength={80} placeholder="e.g. Ritual guide" required autoFocus /></label>
    <label>What should it focus on?<textarea value={instructions} onChange={event => setInstructions(event.target.value)} maxLength={2000} placeholder="For example: Organise ceremony traditions and draft a simple family run-sheet for review." required /></label>
    <p>It can read the plan, organise information, and prepare drafts. A person still approves all decisions, spending, messages, and vendor contact.</p>
    <button className="primary-button" type="submit"><Plus size={17}/> Add assistant</button>
  </form>;
}

function SourceUpload({ weddingId, source, onClose }: { weddingId: bigint; source: typeof sources[number]; onClose: () => void }) {
  const requestIngest = useReducer(reducers.requestIngest);
  const createEvent = useReducer(reducers.createEvent);
  const createExpense = useReducer(reducers.createExpense);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const readFile = async (next: File) => {
    setFile(next); setError('');
    try { setParsed(parseImport(source.kind, next, next.type.startsWith('image/') ? '' : await next.text())); }
    catch { setParsed(null); setError('We could not read that file. Try a text export, CSV, or calendar file.'); }
  };
  const save = () => {
    if (!file || !parsed) return;
    setSaving(true);
    requestIngest({ weddingId, kind: source.kind });
    parsed.events.forEach(event => createEvent({ weddingId, title: event.title, venue: event.venue, startsAt: event.startsAt ? Timestamp.fromDate(event.startsAt) : undefined, source: source.kind, confidence: event.confidence }));
    parsed.expenses.forEach(expense => createExpense({ weddingId, ...expense, source: source.kind }));
    onClose();
  };
  const accept = source.kind === 'calendar' ? '.ics,text/calendar' : source.kind === 'whatsapp' ? '.txt,text/plain' : source.kind === 'guests' ? '.csv,.tsv,text/csv,text/tab-separated-values' : 'image/*,.txt,.csv,.ics,text/plain,text/csv,text/calendar';
  return <div className="modal-backdrop" onClick={onClose}><section className="modal-sheet ingest-sheet" role="dialog" aria-modal="true" aria-labelledby="ingest-title" onClick={event => event.stopPropagation()}><div className="sheet-heading"><div><p className="eyebrow">Add a source</p><h2 id="ingest-title">{source.title}</h2></div><button className="close-button" aria-label="Close upload" onClick={onClose}>×</button></div><p>{source.copy} It stays a draft until your family reviews it.</p><label className="file-picker"><input type="file" accept={accept} onChange={event => { const next = event.target.files?.[0]; if (next) void readFile(next); }} /><Upload size={16}/>{file?.name ?? 'Choose a file'}</label>{error && <p className="form-error">{error}</p>}{parsed && <div className="ingest-preview"><b>Ready for review</b><p>{parsed.summary}</p>{parsed.events.length > 0 && <ul>{parsed.events.slice(0, 4).map(event => <li key={event.title}>{event.title}</li>)}</ul>}{parsed.expenses.length > 0 && <ul>{parsed.expenses.slice(0, 4).map(expense => <li key={expense.label}>{expense.label} · {fmt.format(Number(expense.amountPaise) / 100)}</li>)}</ul>}<small>These details will be marked “needs review”.</small></div>}{file && parsed && <button type="button" className="primary-button" disabled={saving} onClick={save}>{saving ? 'Adding drafts…' : 'Add drafts for review'}</button>}</section></div>;
}

function ConnectWedding({ weddingId }: { weddingId: bigint }) {
  const { identity } = useSpacetimeDB();
  const [members] = useTable(tables.member);
  const [ingestSources] = useTable(tables.ingestSource);
  const [weddingAgents] = useTable(tables.weddingAgent);
  const [agentSettings] = useTable(tables.weddingAgentSetting);
  const [customAgents] = useTable(tables.customWeddingAgent);
  const requestIngest = useReducer(reducers.requestIngest);
  const setWeddingAgent = useReducer(reducers.setWeddingAgent);
  const setWeddingAgentInstructions = useReducer(reducers.setWeddingAgentInstructions);
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [instructionDraft, setInstructionDraft] = useState('');
  const [addingCustomAgent, setAddingCustomAgent] = useState(false);
  const [uploading, setUploading] = useState<typeof sources[number] | null>(null);
  const membership = members.find(member => member.weddingId === weddingId && member.identity.toHexString() === identity?.toHexString());
  const canManage = membership?.role === 'couple' || membership?.role === 'planner';
  const queued = ingestSources.filter(source => source.weddingId === weddingId);
  const agents = weddingAgents.filter(agent => agent.weddingId === weddingId);

  return <section className="connect-wedding">
    <div className="connect-intro"><p className="section-label">Bring in what already exists</p><h2>Connect your planning sources</h2><p>Everything an assistant reads becomes a draft for your review. Nothing is confirmed or sent on your behalf.</p></div>
    <div className="source-list">{sources.map(source => {
      const Icon = source.icon;
      const existing = queued.filter(item => item.kind === source.kind);
      return <article className="source-card" key={source.kind}><span className="source-icon"><Icon size={19}/></span><div><b>{source.title}</b><p>{source.copy}</p>{existing.length > 0 && <small><Check size={13}/> {existing.length} {existing.length === 1 ? 'source' : 'sources'} added for review</small>}</div>{canManage && <button type="button" className="source-add" onClick={() => setUploading(source)}>{existing.length ? 'Add another' : 'Add source'}</button>}</article>;
    })}</div>
    {uploading && <SourceUpload weddingId={weddingId} source={uploading} onClose={() => setUploading(null)} />}
    <div className="assistant-section"><div className="connect-intro assistant-intro"><div><p className="section-label">In-app assistants</p><h2>Set up your wedding team</h2><p>These assistants work inside Inai: they organise, draft, and track requests. A person still approves every decision, spend, and external commitment.</p></div>{canManage && <button type="button" className="outline-action" onClick={() => setAddingCustomAgent(true)}><Plus size={16}/> Add assistant</button>}</div>{addingCustomAgent && <AddCustomAgent weddingId={weddingId} onDone={() => setAddingCustomAgent(false)} />}<div className="assistant-list">{assistants.map(agent => {
      const current = agents.find(item => item.kind === agent.kind);
      const enabled = current?.enabled ?? false;
      const setting = agentSettings.find(item => item.weddingId === weddingId && item.kind === agent.kind);
      const editing = editingAgent === agent.kind;
      const saveInstructions = () => { setWeddingAgentInstructions({ weddingId, kind: agent.kind, instructions: instructionDraft }); setEditingAgent(null); };
      return <article className={`assistant-card ${enabled ? 'enabled' : ''} ${editing ? 'customising' : ''}`} key={agent.kind}><span className="assistant-icon"><Bot size={19}/></span><div><b>{agent.title}</b><p>{agent.copy}</p></div>{canManage && <div className="agent-actions"><button className={enabled ? 'assistant-toggle enabled' : 'assistant-toggle'} type="button" aria-pressed={enabled} onClick={() => setWeddingAgent({ weddingId, kind: agent.kind, enabled: !enabled })}>{enabled ? 'Added' : 'Add'}</button>{enabled && <button className="customise-agent" type="button" onClick={() => { setEditingAgent(editing ? null : agent.kind); setInstructionDraft(setting?.instructions ?? ''); }}>{editing ? 'Close' : 'Customise'}</button>}</div>}{editing && <div className="agent-customisation"><label>What should this assistant focus on?<textarea value={instructionDraft} onChange={event => setInstructionDraft(event.target.value)} maxLength={2000} placeholder="For example: Keep the family focused on the ceremony schedule and flag anything that needs a decision." /></label><p>It can organise and draft from this brief. It cannot make decisions, spend money, or contact anyone without the required approval.</p><button type="button" className="primary-button" onClick={saveInstructions}>Save instructions</button></div>}</article>;
    })}{customAgents.filter(agent => agent.weddingId === weddingId).map(agent => <article className={`assistant-card enabled custom-agent-card`} key={String(agent.id)}><span className="assistant-icon"><Bot size={19}/></span><div><b>{agent.name}</b><p>{agent.instructions}</p><small>Custom assistant · drafts only</small></div><span className="assistant-toggle enabled">Added</span></article>)}</div></div>
  </section>;
}

export default function WeddingTab({ weddingId }: { weddingId: bigint }) {
  const [view, setView] = useState<View>('calendar');
  const [addingEvent, setAddingEvent] = useState(false);
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
    events: <><div className="view-action-heading"><p className="section-label">Events</p><button type="button" className="outline-action" onClick={() => setAddingEvent(true)}><Plus size={16}/> Add event</button></div>{addingEvent && <AddEvent weddingId={weddingId} onDone={() => setAddingEvent(false)} />}{weddingEvents.length ? weddingEvents.map(event => <div className={`inai-card ${event.state === 'reported' ? 'reported' : ''}`} key={String(event.id)}><span className="card-icon"><CalendarDays size={21}/></span><span className="card-content"><b>{event.title}</b><span>{event.venue ?? 'Venue to confirm'}{event.state === 'reported' ? ' · needs confirmation' : ''}</span></span></div>) : !addingEvent && <div className="panel"><CalendarDays color="#087d6b"/><h2>Start with the events</h2><p>Add an event now or bring in a calendar export. Your group reviews every new detail.</p></div>}</>,
    guests: <ContactImport weddingId={weddingId} />,
    mood: <div className="panel"><Image color="#087d6b"/><h2>Your mood board</h2><p>Shared Pinterest images become grouped draft options on Decide. Nothing is chosen automatically.</p></div>,
    connect: <ConnectWedding weddingId={weddingId}/>,
  };
  return <div><p className="eyebrow">{wedding ? `${wedding.city} · ${wedding.dateLabel}` : 'Your shared plan'}</p><h1 className="headline">The wedding</h1><div className="wedding-tabs">{([['calendar', 'Calendar'], ['events', 'Events'], ['budget', 'Budget'], ['guests', 'Guests'], ['mood', 'Mood'], ['connect', 'Connect']] as const).map(([key, label]) => <button className={view === key ? 'active' : ''} key={key} onClick={() => setView(key)}>{label}</button>)}</div>{view === 'budget' ? <><div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 26 }}><span className="card-icon" style={{ width: 38, height: 38, flexBasis: 38, borderRadius: 12 }}><WalletCards size={19}/></span><p className="section-label" style={{ margin: 0 }}>Spend tracked</p></div><div className="budget-number">{fmt.format(total)}</div><p className="budget-copy">{weddingExpenses.length ? (reported ? `${reported} line${reported === 1 ? '' : 's'} to confirm` : 'Every imported line is confirmed') : 'Add quotes to start your budget'}</p><div className="budget-bar" aria-label="Budget spend currently tracked"><span style={{ width: total ? '100%' : '0%' }}/></div>{reported > 0 && <p className="notice">Imported amounts stay clearly marked until someone confirms them.</p>}<div className="panel" style={{ marginTop: 24 }}><CircleDollarSign color="#087d6b"/><h2>{wedding ? `${wedding.brideName} & ${wedding.groomName}` : 'Your shared budget'}</h2><p>{wedding ? 'Quotes, deposits and spending appear here as a clean shared picture.' : 'Budget lines from quotes will be reviewed here.'}</p></div></> : items[view]}</div>;
}
