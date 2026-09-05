import { useState, type FormEvent } from 'react';
import { Timestamp } from 'spacetimedb';
import { AlertTriangle, BadgeIndianRupee, Bot, CalendarDays, CalendarPlus, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, ClipboardCheck, Clock3, FileText, Image, Landmark, MapPin, MessageCircle, Milestone, Plus, ShieldCheck, Store, Upload, Users, X } from 'lucide-react';
import { reducers, tables } from '../module_bindings';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import { parseImport, type ParsedImport } from '../lib/ingest';
import bridalStyling from '../../dataset/priya-rahul/02-pinterest-mood-boards/images/bridal-styling.png';
import ceremonyMandap from '../../dataset/priya-rahul/02-pinterest-mood-boards/images/ceremony-mandap.png';
import dinnerCelebration from '../../dataset/priya-rahul/02-pinterest-mood-boards/images/dinner-celebration.png';
import '../wedding-workspace.css';

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
  { kind: 'menu_planner', title: 'Menu planner', copy: 'Shapes menu ideas around your events, guests, and dietary notes for family review.' },
] as const;

const eventTemplates = [
  { key: 'haldi', title: 'Haldi', copy: 'A calm, practical start for the turmeric ceremony.' },
  { key: 'mehendi', title: 'Mehendi', copy: 'Artist, comfort, music, and photo details in one place.' },
  { key: 'sangeet', title: 'Sangeet', copy: 'Keep performances and the run of show clear for everyone.' },
  { key: 'ceremony', title: 'Wedding ceremony', copy: 'A respectful ritual and guest-arrival checklist.' },
  { key: 'reception', title: 'Reception', copy: 'Welcome, food, stage, and arrival details to review.' },
] as const;

type View = 'calendar' | 'events' | 'budget' | 'guests' | 'mood' | 'connect';

const weddingSections = [
  { key: 'calendar', label: 'Timeline', hint: 'See the days ahead', icon: CalendarDays },
  { key: 'events', label: 'Events', hint: 'Check what is ready', icon: ClipboardCheck },
  { key: 'budget', label: 'Budget', hint: 'Track money and vendors', icon: BadgeIndianRupee },
  { key: 'guests', label: 'People', hint: 'Bring in guest details', icon: Users },
  { key: 'mood', label: 'Ideas', hint: 'Keep inspiration together', icon: Image },
  { key: 'connect', label: 'Set up', hint: 'Sources and assistants', icon: Bot },
] as const;

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

function rupeesToPaise(value: string): bigint | undefined {
  const match = value.trim().replace(/,/g, '').match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return undefined;
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

function BudgetWorkspace({ weddingId }: { weddingId: bigint }) {
  const { identity } = useSpacetimeDB();
  const [members] = useTable(tables.member);
  const [budgets] = useTable(tables.budget);
  const [expenses] = useTable(tables.expense);
  const [vendors] = useTable(tables.vendor);
  const [consents] = useTable(tables.vendorConsent);
  const setBudget = useReducer(reducers.setBudget);
  const createExpense = useReducer(reducers.createExpense);
  const confirmExpense = useReducer(reducers.confirmExpense);
  const createVendor = useReducer(reducers.createVendor);
  const setVendorBookingState = useReducer(reducers.setVendorBookingState);
  const setVendorConsent = useReducer(reducers.setVendorConsent);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [expense, setExpense] = useState({ category: '', label: '', amount: '', vendorId: '', paid: false });
  const [vendor, setVendor] = useState({ name: '', category: '', note: '' });
  const membership = members.find(member => member.weddingId === weddingId && member.identity.toHexString() === identity?.toHexString());
  const canManage = membership?.role === 'couple' || membership?.role === 'planner';
  const budget = budgets.find(item => item.weddingId === weddingId);
  const lines = expenses.filter(item => item.weddingId === weddingId).sort((a, b) => Number(b.updatedAt.microsSinceUnixEpoch - a.updatedAt.microsSinceUnixEpoch));
  const weddingVendors = vendors.filter(item => item.weddingId === weddingId);
  const confirmedTotal = lines.filter(item => item.state === 'confirmed').reduce((sum, item) => sum + Number(item.amountPaise) / 100, 0);
  const paidTotal = lines.filter(item => item.state === 'confirmed' && item.paid).reduce((sum, item) => sum + Number(item.amountPaise) / 100, 0);
  const pendingTotal = lines.filter(item => item.state === 'reported').reduce((sum, item) => sum + Number(item.amountPaise) / 100, 0);
  const target = budget ? Number(budget.amountPaise) / 100 : 0;
  const percent = target ? Math.min(100, (confirmedTotal / target) * 100) : 0;
  const submitBudget = (event: FormEvent) => {
    event.preventDefault();
    const amountPaise = rupeesToPaise(budgetAmount);
    if (!amountPaise) return;
    setBudget({ weddingId, amountPaise });
    setShowBudgetForm(false);
  };
  const submitExpense = (event: FormEvent) => {
    event.preventDefault();
    const amountPaise = rupeesToPaise(expense.amount);
    if (!amountPaise) return;
    createExpense({ weddingId, category: expense.category, label: expense.label, amountPaise, paid: expense.paid, vendorId: expense.vendorId ? BigInt(expense.vendorId) : undefined });
    setExpense({ category: '', label: '', amount: '', vendorId: '', paid: false });
    setShowExpenseForm(false);
  };
  const submitVendor = (event: FormEvent) => {
    event.preventDefault();
    createVendor({ weddingId, name: vendor.name, category: vendor.category, note: vendor.note.trim() || undefined });
    setVendor({ name: '', category: '', note: '' });
    setShowVendorForm(false);
  };

  return <section className="budget-workspace">
    <div className="budget-hero"><div><p className="section-label">Budget</p><h2>{target ? `${fmt.format(confirmedTotal)} planned` : 'Set a budget to begin'}</h2><p>{target ? `${fmt.format(Math.max(0, target - confirmedTotal))} still available from ${fmt.format(target)}` : 'Keep quotes, deposits, and payments in one shared picture.'}</p></div>{canManage && <button type="button" className="outline-action" onClick={() => { setBudgetAmount(target ? String(target) : ''); setShowBudgetForm(value => !value); }}><Landmark size={16}/>{target ? 'Edit budget' : 'Set budget'}</button>}</div>
    {showBudgetForm && <form className="quick-add-form budget-form" onSubmit={submitBudget}><label>Total budget in rupees<input autoFocus inputMode="decimal" value={budgetAmount} onChange={event => setBudgetAmount(event.target.value)} placeholder="e.g. 2500000" required /></label><p>This is a human-approved planning limit. It does not spend or book anything.</p><button className="primary-button" type="submit">Save budget</button></form>}
    <div className="budget-stats"><div><span>Planned</span><b>{fmt.format(confirmedTotal)}</b></div><div><span>Paid</span><b>{fmt.format(paidTotal)}</b></div><div><span>Needs review</span><b>{fmt.format(pendingTotal)}</b></div></div>
    {target > 0 && <><div className="budget-progress"><span style={{ width: `${percent}%` }} /></div><p className={confirmedTotal > target ? 'budget-warning' : 'budget-caption'}>{confirmedTotal > target ? `${fmt.format(confirmedTotal - target)} above the budget` : `${Math.round(percent)}% of the budget planned`}</p></>}
    <div className="budget-section-heading"><div><p className="section-label">Budget lines</p><h3>Quotes, deposits, and payments</h3></div>{canManage && <button type="button" className="outline-action" onClick={() => setShowExpenseForm(value => !value)}><Plus size={16}/> Add line</button>}</div>
    {showExpenseForm && <form className="quick-add-form budget-form" onSubmit={submitExpense}><label>What is this for?<input autoFocus value={expense.label} onChange={event => setExpense(value => ({ ...value, label: event.target.value }))} placeholder="e.g. Ceremony decor deposit" required maxLength={200} /></label><div className="budget-form-grid"><label>Category<input value={expense.category} onChange={event => setExpense(value => ({ ...value, category: event.target.value }))} placeholder="e.g. Decor" required maxLength={100} /></label><label>Amount in rupees<input inputMode="decimal" value={expense.amount} onChange={event => setExpense(value => ({ ...value, amount: event.target.value }))} placeholder="e.g. 45000" required /></label></div><label>Vendor <span>optional</span><select value={expense.vendorId} onChange={event => setExpense(value => ({ ...value, vendorId: event.target.value }))}><option value="">No vendor linked</option>{weddingVendors.map(item => <option key={String(item.id)} value={String(item.id)}>{item.name} · {item.category}</option>)}</select></label><label className="checkbox-row"><input type="checkbox" checked={expense.paid} onChange={event => setExpense(value => ({ ...value, paid: event.target.checked }))} /> This amount has been paid</label><p>Adding a line records it for the group. It does not pay, reserve, or contact a vendor.</p><button className="primary-button" type="submit"><BadgeIndianRupee size={17}/> Add budget line</button></form>}
    <div className="budget-lines">{lines.length ? lines.map(line => { const linkedVendor = line.vendorId === undefined ? undefined : weddingVendors.find(item => item.id === line.vendorId); return <article className={`budget-line ${line.state === 'reported' ? 'reported' : ''}`} key={String(line.id)}><div><b>{line.label}</b><p>{line.category}{linkedVendor ? ` · ${linkedVendor.name}` : ''}</p><small>{line.state === 'reported' ? 'Imported · needs review' : line.paid ? 'Paid' : 'Planned'}</small></div><div className="budget-line-value"><b>{fmt.format(Number(line.amountPaise) / 100)}</b>{line.state === 'reported' && canManage && <span><button type="button" onClick={() => confirmExpense({ expenseId: line.id, accept: true })}>Confirm</button><button type="button" className="text-button" onClick={() => confirmExpense({ expenseId: line.id, accept: false })}>Dismiss</button></span>}</div></article>; }) : <div className="empty-budget"><CircleDollarSign size={22}/><b>No budget lines yet</b><p>Add the first quote or payment yourself, or import vendor quotes from Connect for review.</p></div>}</div>
    <div className="budget-section-heading vendor-heading"><div><p className="section-label">Vendors</p><h3>Keep selection and consent clear</h3></div>{canManage && <button type="button" className="outline-action" onClick={() => setShowVendorForm(value => !value)}><Plus size={16}/> Add vendor</button>}</div>
    {showVendorForm && <form className="quick-add-form budget-form" onSubmit={submitVendor}><label>Vendor name<input autoFocus value={vendor.name} onChange={event => setVendor(value => ({ ...value, name: event.target.value }))} placeholder="e.g. Nila Blooms" required maxLength={160} /></label><label>Category<input value={vendor.category} onChange={event => setVendor(value => ({ ...value, category: event.target.value }))} placeholder="e.g. Floral decor" required maxLength={100} /></label><label>Notes <span>optional</span><textarea value={vendor.note} onChange={event => setVendor(value => ({ ...value, note: event.target.value }))} placeholder="What should the family remember about this vendor?" maxLength={1000} /></label><p>Vendor contact details and outreach stay outside this shared plan. Add only the planning context the group needs.</p><button className="primary-button" type="submit"><Store size={17}/> Add vendor</button></form>}
    <div className="vendor-list">{weddingVendors.length ? weddingVendors.map(item => { const consent = consents.find(row => row.vendorId === item.id); return <article className="vendor-card" key={String(item.id)}><div className="vendor-card-main"><span className="vendor-icon"><Store size={18}/></span><div><b>{item.name}</b><p>{item.category}{item.note ? ` · ${item.note}` : ''}</p></div></div><div className="vendor-card-actions"><label>Status<select value={item.bookingState} disabled={!canManage} onChange={event => setVendorBookingState({ vendorId: item.id, bookingState: event.target.value })}><option value="shortlisted">Shortlisted</option><option value="selected">Selected</option><option value="booked">Booked</option><option value="declined">Not proceeding</option></select></label>{canManage && <button type="button" className={consent?.consented ? 'consent-button allowed' : 'consent-button'} onClick={() => setVendorConsent({ vendorId: item.id, consented: !consent?.consented })}><ShieldCheck size={15}/>{consent?.consented ? 'Draft follow-ups allowed' : 'Allow draft follow-ups'}</button>}<small>{consent?.consented ? 'A person has approved draft outreach. Nothing is sent automatically.' : 'No vendor outreach is permitted.'}</small></div></article>; }) : <div className="empty-budget"><Store size={22}/><b>No vendors yet</b><p>Add the vendors you are considering, then link their quotes and payments above.</p></div>}</div>
  </section>;
}

function ContactImport({ weddingId }: { weddingId: bigint }) {
  const requestIngest = useReducer(reducers.requestIngest);
  const [guests] = useTable(tables.guest);
  const [fileName, setFileName] = useState('');
  const [queued, setQueued] = useState(false);
  const guestList = guests.filter(guest => guest.weddingId === weddingId);
  const queue = () => {
    if (!fileName) return;
    requestIngest({ weddingId, kind: 'guests' });
    setQueued(true);
  };
  return <section className="contact-import panel"><Upload color="#087d6b"/><h2>Guest list</h2><p>Choose a contacts CSV, spreadsheet, or phone export. The import worker turns it into reviewable guest records; nobody is invited automatically.</p><label className="file-picker"><input type="file" accept=".csv,.tsv,.xlsx,.xls,text/csv" onChange={event => { setFileName(event.target.files?.[0]?.name ?? ''); setQueued(false); }} /><Upload size={16}/>{fileName || 'Choose a contacts file'}</label>{fileName && <button type="button" className="primary-button" onClick={queue} disabled={queued}>{queued ? 'Import queued for review' : 'Queue contact import'}</button>}{guestList.length > 0 && <div className="guest-roster"><div><b>Imported guests</b><small>{guestList.length} records · review before sending anything</small></div>{guestList.map(guest => <article key={String(guest.id)}><span><b>{guest.name}</b><small>{guest.side === 'bride' ? 'Bride’s side' : guest.side === 'groom' ? 'Groom’s side' : 'Family'}{guest.homeCity ? ` · ${guest.homeCity}` : ''}</small></span><em className={guest.rsvpStatus}>{guest.rsvpStatus === 'confirmed' ? 'Coming' : guest.rsvpStatus === 'declined' ? 'Not coming' : 'Awaiting reply'}</em></article>)}</div>}</section>;
}

function MoodBoard({ weddingId }: { weddingId: bigint }) {
  const [moodItems] = useTable(tables.moodItem);
  const items = moodItems.filter(item => item.weddingId === weddingId);
  const thumbnails = [bridalStyling, ceremonyMandap, dinnerCelebration];
  return <section className="mood-board"><div className="mood-board-heading"><div><p className="section-label">Pinterest inspiration</p><h2>A feeling to build from</h2><p>These are source ideas, not final choices. Bring any one into Decide when the family is ready.</p></div><span className="mood-review-badge">Needs review</span></div>{items.length ? <div className="mood-grid">{items.map((item, index) => <article className="mood-card" key={String(item.id)}><img className="mood-swatch" src={thumbnails[index % thumbnails.length]} alt="" /><div><small>Pinterest import · needs review</small><h3>{item.title}</h3><p>{item.note}</p>{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open source board</a>}</div></article>)}</div> : <div className="panel"><Image color="#087d6b"/><h2>Your mood board</h2><p>Shared Pinterest images become grouped draft options on Decide. Nothing is chosen automatically.</p></div>}</section>;
}

function EventWorkspace({ weddingId }: { weddingId: bigint }) {
  const { identity } = useSpacetimeDB();
  const [members] = useTable(tables.member);
  const [events] = useTable(tables.event);
  const [checklistItems] = useTable(tables.eventChecklistItem);
  const [vendors] = useTable(tables.vendor);
  const applyEventTemplate = useReducer(reducers.applyEventTemplate);
  const addEventChecklistItem = useReducer(reducers.addEventChecklistItem);
  const confirmEventChecklistItem = useReducer(reducers.confirmEventChecklistItem);
  const setEventChecklistItemDone = useReducer(reducers.setEventChecklistItemDone);
  const [addingEvent, setAddingEvent] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const membership = members.find(member => member.weddingId === weddingId && member.identity.toHexString() === identity?.toHexString());
  const canManage = membership?.role === 'couple' || membership?.role === 'planner';
  const weddingEvents = events.filter(event => event.weddingId === weddingId);
  const weddingVendors = vendors.filter(vendor => vendor.weddingId === weddingId);
  const forEvent = (eventId: bigint) => checklistItems.filter(item => item.eventId === eventId);
  const eventStatus = (event: typeof weddingEvents[number]) => {
    const items = forEvent(event.id);
    const confirmed = items.filter(item => item.state === 'confirmed');
    const completed = confirmed.filter(item => item.done).length;
    const suggestions = items.filter(item => item.state === 'reported').length;
    const missing = [
      ...(event.state === 'reported' ? ['Confirm event details'] : []),
      ...(!event.startsAt ? ['Set date and time'] : []),
      ...(!event.venue ? ['Set venue'] : []),
      ...(suggestions ? [`Review ${suggestions} checklist suggestion${suggestions === 1 ? '' : 's'}`] : []),
      ...(!items.length ? ['Add an event checklist'] : []),
    ];
    return { completed, total: confirmed.length, suggestions, missing };
  };
  const allConfirmed = weddingEvents.reduce((total, event) => total + eventStatus(event).total, 0);
  const allCompleted = weddingEvents.reduce((total, event) => total + eventStatus(event).completed, 0);
  const priorityItems = weddingEvents.flatMap(event => eventStatus(event).missing.slice(0, 2).map(label => ({ event: event.title, label }))).slice(0, 5);
  const addChecklist = (eventId: bigint) => {
    const value = drafts[String(eventId)]?.trim();
    if (!value) return;
    addEventChecklistItem({ eventId, label: value });
    setDrafts(current => ({ ...current, [String(eventId)]: '' }));
  };

  return <section className="event-workspace">
    <div className="event-workspace-heading"><div><p className="section-label">Events and checklists</p><h2>Start with the moments your family knows</h2><p>Use a familiar event as a practical starting point, then keep only the details that fit your wedding. Template items are suggestions until a person confirms them.</p></div>{canManage && <button type="button" className="outline-action" onClick={() => setAddingEvent(true)}><Plus size={16}/> Add event</button>}</div>
    {weddingEvents.length > 0 && <section className="event-overview" aria-label="Wedding planning progress"><div className="event-overview-stat"><span>Confirmed checklist progress</span><b>{allCompleted}/{allConfirmed || 0}</b><small>{allConfirmed ? 'tasks complete' : 'Confirm a few suggestions to begin'}</small></div><div className="event-overview-panel"><div className="event-overview-heading"><AlertTriangle size={17}/><div><b>Needs attention</b><span>These are planning gaps, not automatic decisions.</span></div></div>{priorityItems.length ? <ul>{priorityItems.map(item => <li key={`${item.event}-${item.label}`}><b>{item.event}</b><span>{item.label}</span></li>)}</ul> : <p className="overview-clear"><CheckCircle2 size={17}/> The essential event details are in place.</p>}</div><div className="event-overview-panel"><div className="event-overview-heading"><Store size={17}/><div><b>Vendor updates</b><span>Latest shared booking status</span></div></div>{weddingVendors.length ? <ul>{weddingVendors.slice(0, 4).map(vendor => <li key={String(vendor.id)}><b>{vendor.name}</b><span className={`vendor-state ${vendor.bookingState}`}>{vendor.bookingState === 'booked' ? 'Booked' : vendor.bookingState === 'selected' ? 'Selected' : vendor.bookingState === 'declined' ? 'Not proceeding' : 'Shortlisted'}</span></li>)}</ul> : <p className="overview-clear">Add vendors in Budget to see their updates here.</p>}</div></section>}
    {addingEvent && <AddEvent weddingId={weddingId} onDone={() => setAddingEvent(false)} />}
    {canManage && <div className="event-template-section"><div><p className="section-label">Quick start</p><h3>Add a usual event</h3></div><div className="event-template-grid">{eventTemplates.map(template => <button type="button" key={template.key} onClick={() => applyEventTemplate({ weddingId, template: template.key })}><b>{template.title}</b><span>{template.copy}</span><small><Plus size={14}/> Add checklist</small></button>)}</div></div>}
    {weddingEvents.length ? <div className="event-detail-list">{weddingEvents.map(event => {
      const items = forEvent(event.id);
      const status = eventStatus(event);
      const progress = status.total ? Math.round((status.completed / status.total) * 100) : 0;
      return <article className={`event-detail-card ${event.state === 'reported' ? 'reported' : ''}`} key={String(event.id)}><div className="event-detail-title"><span className="card-icon"><CalendarDays size={20}/></span><div><h3>{event.title}</h3><p>{event.venue ?? 'Time and place to confirm'}{event.state === 'reported' ? ' · event details need review' : ''}</p></div><small>{status.completed}/{status.total} confirmed tasks done</small></div><div className="event-progress" aria-label={`${event.title} checklist progress`}><span style={{ width: `${progress}%` }} /><small>{status.total ? `${progress}% complete` : 'Confirm checklist suggestions to track progress'}</small></div>{status.missing.length > 0 && <div className="event-missing"><AlertTriangle size={15}/><span><b>Still needed:</b> {status.missing.join(' · ')}</span></div>}{items.length ? <ul className="event-checklist">{items.map(item => <li className={`${item.state === 'reported' ? 'reported' : ''} ${item.done ? 'done' : ''}`} key={String(item.id)}>{item.state === 'confirmed' && canManage ? <label><input type="checkbox" checked={item.done} onChange={event => setEventChecklistItemDone({ itemId: item.id, done: event.target.checked })}/><span>{item.label}</span></label> : <span>{item.label}</span>}{item.state === 'reported' ? <div><small>Template suggestion</small>{canManage && <><button type="button" onClick={() => confirmEventChecklistItem({ itemId: item.id, keep: true })}>Keep</button><button type="button" onClick={() => confirmEventChecklistItem({ itemId: item.id, keep: false })}>Remove</button></>}</div> : !canManage && <small>{item.done ? 'Done' : 'Open'}</small>}</li>)}</ul> : <p className="event-checklist-empty">Add the first task your family wants to keep track of for this event.</p>}{canManage && <form className="event-checklist-add" onSubmit={form => { form.preventDefault(); addChecklist(event.id); }}><input value={drafts[String(event.id)] ?? ''} onChange={input => setDrafts(current => ({ ...current, [String(event.id)]: input.target.value }))} placeholder="Add a checklist item" maxLength={240}/><button type="submit"><Plus size={16}/> Add</button></form>}</article>;
    })}</div> : !addingEvent && <div className="panel"><ClipboardCheck color="#087d6b"/><h2>Begin with an event</h2><p>Add a family event above and Inai will give your group a calm, reviewable checklist to start from.</p></div>}
  </section>;
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
  const recordImportedExpense = useReducer(reducers.recordImportedExpense);
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
    parsed.expenses.forEach(expense => recordImportedExpense({ weddingId, ...expense, source: source.kind }));
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
      const itemCount = existing.reduce((sum, item) => sum + Number(item.itemCount), 0);
      return <article className="source-card" key={source.kind}><span className="source-icon"><Icon size={19}/></span><div><b>{source.title}</b><p>{source.copy}</p>{existing.length > 0 && <small><Check size={13}/> {itemCount ? `${itemCount} items imported` : `${existing.length} ${existing.length === 1 ? 'source' : 'sources'} added for review`}</small>}</div>{canManage && <button type="button" className="source-add" onClick={() => setUploading(source)}>{existing.length ? 'Add another' : 'Add source'}</button>}</article>;
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
  const [weddings] = useTable(tables.wedding);
  const [events] = useTable(tables.event);
  const wedding = weddings.find(row => row.id === weddingId);
  const weddingEvents = events.filter(row => row.weddingId === weddingId);
  const items: Record<Exclude<View, 'budget'>, React.ReactNode> = {
    calendar: <CalendarItinerary wedding={wedding} events={weddingEvents} />,
    events: <EventWorkspace weddingId={weddingId} />,
    guests: <ContactImport weddingId={weddingId} />,
    mood: <MoodBoard weddingId={weddingId} />,
    connect: <ConnectWedding weddingId={weddingId}/>,
  };
  const selected = weddingSections.find(section => section.key === view)!;
  const SectionIcon = selected.icon;
  return <div className="wedding-workspace"><header className="wedding-workspace-header"><p className="eyebrow">{wedding ? `${wedding.brideName} & ${wedding.groomName} · ${wedding.city}` : 'Your shared plan'}</p><h1 className="headline">Plan the wedding, together</h1><p>Start with what matters today. Every update stays visible to the people planning with you.</p></header><nav className="wedding-section-nav" aria-label="Wedding planning sections">{weddingSections.map(section => { const Icon = section.icon; return <button className={view === section.key ? 'active' : ''} key={section.key} onClick={() => setView(section.key)} aria-current={view === section.key ? 'page' : undefined}><Icon size={18}/><span><b>{section.label}</b><small>{section.hint}</small></span></button>; })}</nav><div className="wedding-section-context"><SectionIcon size={17}/><div><b>{selected.label}</b><span>{selected.hint}</span></div></div>{view === 'budget' ? <BudgetWorkspace weddingId={weddingId} /> : items[view]}</div>;
}
