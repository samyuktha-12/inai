import { useState, type FormEvent } from 'react';
import { Timestamp } from 'spacetimedb';
import { AlertTriangle, BadgeIndianRupee, Bot, CalendarDays, CalendarPlus, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, ClipboardCheck, FileText, Heart, Image, Landmark, MapPin, MessageCircle, Milestone, Plus, ShieldCheck, Sparkles, Store, Upload, UserPlus, Users, UtensilsCrossed, X } from 'lucide-react';
import { reducers, tables } from '../module_bindings';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import { parseImport, type ParsedImport } from '../lib/ingest';
import bridalStyling from '../../dataset/priya-rahul/02-pinterest-mood-boards/images/bridal-styling.png';
import ceremonyMandap from '../../dataset/priya-rahul/02-pinterest-mood-boards/images/ceremony-mandap.png';
import dinnerCelebration from '../../dataset/priya-rahul/02-pinterest-mood-boards/images/dinner-celebration.png';
import '../wedding-workspace.css';
import '../timeline-calendar.css';
import '../timeline-event-actions.css';
import '../event-modal.css';
import '../guest-roster.css';

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

type View = 'calendar' | 'events' | 'menus' | 'budget' | 'guests' | 'mood' | 'connect';

const weddingSections = [
  { key: 'calendar', label: 'Timeline', hint: 'See the days ahead', icon: CalendarDays },
  { key: 'events', label: 'Events', hint: 'Check what is ready', icon: ClipboardCheck },
  { key: 'menus', label: 'Menus', hint: 'Plan food together', icon: UtensilsCrossed },
  { key: 'budget', label: 'Budget', hint: 'Track money and vendors', icon: BadgeIndianRupee },
  { key: 'guests', label: 'People', hint: 'Bring in guest details', icon: Users },
  { key: 'mood', label: 'Ideas', hint: 'Keep inspiration together', icon: Image },
  { key: 'connect', label: 'Set up', hint: 'Sources and assistants', icon: Bot },
] as const;

const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const eventTimeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

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

function eventTimeLabel(value: Date) {
  return value.getHours() || value.getMinutes() ? eventTimeFormatter.format(value) : 'Time to confirm';
}

function CalendarItinerary({ weddingId, wedding, events, canManage }: { weddingId: bigint; wedding?: { dateLabel: string }; events: Array<{ id: bigint; title: string; startsAt?: { microsSinceUnixEpoch: bigint }; venue?: string; state: string; isCheckpoint: boolean }>; canManage: boolean }) {
  const anchor = weddingDate(wedding?.dateLabel) ?? new Date();
  const [month, setMonth] = useState(() => startOfMonth(anchor));
  const [addingEvent, setAddingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<typeof events[number] | null>(null);
  const datedEvents = events.flatMap(event => {
    const date = timestampDate(event.startsAt);
    return date ? [{ ...event, date }] : [];
  });
  const days = Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - month.getDay() + 1));
  const checkpoints = datedEvents.filter(event => event.isCheckpoint).sort((left, right) => left.date.getTime() - right.date.getTime());
  const nextCheckpoint = checkpoints.find(event => event.date >= new Date());
  const weddingDay = datedEvents.find(event => event.date.toDateString() === anchor.toDateString());

  return <section className="itinerary" aria-label="Wedding itinerary calendar">
    <div className="itinerary-intro">
      <div><p className="section-label">Shared calendar</p><h2>Build the days together</h2><p>Events from your group appear here. Mark any event as a key checkpoint when the family wants it highlighted.</p></div>
      <div className="itinerary-legend"><span><i className="confirmed-dot" /> Confirmed</span><span><i className="draft-dot" /> Needs review</span>{canManage && <button type="button" className="outline-action" onClick={() => setAddingEvent(true)}><Plus size={16}/> Add event</button>}</div>
    </div>
    {addingEvent && <AddEvent weddingId={weddingId} onDone={() => setAddingEvent(false)} />}
    {editingEvent && <EditEvent event={editingEvent} onDone={() => setEditingEvent(null)} />}
    <div className="itinerary-summary">
      <div><span>On the calendar</span><b>{datedEvents.length}</b><small>{datedEvents.length === 1 ? 'event' : 'events'} with a date</small></div>
      <div><span>Next checkpoint</span><b>{nextCheckpoint ? dateFormatter.format(nextCheckpoint.date) : '—'}</b><small>{nextCheckpoint?.title ?? 'Mark an event when needed'}</small></div>
      <div><span>Wedding day</span><b>{wedding ? dateFormatter.format(anchor) : '—'}</b><small>{weddingDay?.title ?? 'Date to confirm'}</small></div>
    </div>
    <div className="calendar-layout">
      <div className="calendar-surface">
        <div className="calendar-toolbar"><button type="button" onClick={() => setMonth(value => addMonths(value, -1))} aria-label="Previous month"><ChevronLeft size={20}/></button><h3>{monthFormatter.format(month)}</h3><button type="button" onClick={() => setMonth(value => addMonths(value, 1))} aria-label="Next month"><ChevronRight size={20}/></button></div>
        <div className="calendar-weekdays">{Array.from({ length: 7 }, (_, index) => <span key={index}>{dayFormatter.format(new Date(2023, 0, index + 1)).slice(0, 1)}</span>)}</div>
        <div className="calendar-grid">{days.map(day => {
          const entries = datedEvents.filter(event => event.date.toDateString() === day.toDateString());
          const isWeddingDay = day.toDateString() === anchor.toDateString();
          return <div className={`calendar-day ${day.getMonth() !== month.getMonth() ? 'outside' : ''} ${isWeddingDay ? 'wedding-day' : ''}`} key={day.toISOString()}><time>{day.getDate()}</time>{isWeddingDay && <span className="calendar-wedding-mark" aria-label="Wedding day" />}{entries.slice(0, 2).map(event => <span className={`calendar-entry ${event.state === 'reported' ? 'draft' : ''} ${event.isCheckpoint ? 'checkpoint' : ''}`} key={String(event.id)} title={event.title}>{event.isCheckpoint && <Milestone size={11}/>} {event.title}</span>)}</div>;
        })}</div>
      </div>
      <aside className="itinerary-rail"><div className="rail-heading"><Milestone size={18}/><div><p className="section-label">Milestones</p><h3>Key checkpoints</h3></div></div><div className="checkpoint-list">{checkpoints.length ? checkpoints.map((checkpoint, index) => <article key={String(checkpoint.id)}><span className="checkpoint-marker">{index === 0 ? <CheckCircle2 size={15}/> : <i />}</span><div><time>{dateFormatter.format(checkpoint.date)}</time><b>{checkpoint.title}</b><p>{checkpoint.venue ?? 'Time and place to confirm'}</p><small>{checkpoint.state === 'reported' ? 'Needs review' : 'Confirmed event'}</small></div></article>) : <p className="itinerary-empty">Mark an event as a key checkpoint to keep it visible here.</p>}</div></aside>
    </div>
    <div className="itinerary-events"><div className="run-of-show-heading"><div className="rail-heading"><CalendarDays size={18}/><div><p className="section-label">Run of show</p><h3>The day-by-day plan</h3></div></div><p>Times, places, and review status at a glance.</p></div>{datedEvents.length ? <div className="itinerary-event-list">{datedEvents.sort((a, b) => a.date.getTime() - b.date.getTime()).map(event => <article key={String(event.id)}><time dateTime={event.date.toISOString()}><b>{dateFormatter.format(event.date)}</b><span>{eventTimeLabel(event.date)}</span></time><span className={`event-state ${event.state === 'reported' ? 'draft' : 'confirmed'}`}>{event.state === 'reported' ? 'Needs review' : 'Confirmed'}</span><div className="timeline-event-main"><div className="timeline-event-details"><b>{event.title}</b><p>{event.venue ? <><MapPin size={14}/>{event.venue}</> : <><MapPin size={14}/>Venue to confirm</>}</p></div>{event.isCheckpoint && <span className="checkpoint-label"><Milestone size={13}/> Key checkpoint</span>}</div>{canManage && <span className="timeline-event-actions"><button type="button" onClick={() => setEditingEvent(event)} aria-label={`Edit ${event.title}`}>Edit</button></span>}</article>)}</div> : <p className="itinerary-empty">Add event details or a calendar export in Connect. Once your group has reviewed them, the dates will form the run of show here.</p>}</div>
  </section>;
}

function AddEvent({ weddingId, onDone }: { weddingId: bigint; onDone: () => void }) {
  const createEvent = useReducer(reducers.createEvent);
  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [isCheckpoint, setIsCheckpoint] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    createEvent({ weddingId, title: title.trim(), venue: venue.trim() || undefined, startsAt: startsAt ? Timestamp.fromDate(new Date(startsAt)) : undefined, source: 'manual', confidence: 1, isCheckpoint });
    onDone();
  };
  return <div className="modal-backdrop modal-backdrop--sheet" onClick={onDone}><form className="modal-sheet event-editor-sheet quick-add-form" onClick={event => event.stopPropagation()} onSubmit={submit}>
    <div className="quick-add-heading"><div><p className="section-label">Add an event</p><h2>Put a moment on the plan</h2></div><button type="button" onClick={onDone} aria-label="Close add event"><X size={18}/></button></div>
    <label>Event name<input value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Mehendi" required maxLength={200} autoFocus /></label>
    <label>When<input type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} /></label>
    <label>Venue <span>optional</span><input value={venue} onChange={event => setVenue(event.target.value)} placeholder="e.g. The Leela Palace" maxLength={300} /></label>
    <label className="checkbox-row"><input type="checkbox" checked={isCheckpoint} onChange={event => setIsCheckpoint(event.target.checked)} /> Mark as a key checkpoint</label>
    <p>New event details are marked for the group to review.</p>
    <button className="primary-button" type="submit"><Plus size={17}/> Add event</button>
  </form></div>;
}

function localDateTime(value?: { microsSinceUnixEpoch: bigint }) {
  const date = timestampDate(value);
  if (!date) return '';
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function EditEvent({ event, onDone }: { event: { id: bigint; title: string; venue?: string; startsAt?: { microsSinceUnixEpoch: bigint }; isCheckpoint: boolean }; onDone: () => void }) {
  const updateEvent = useReducer(reducers.updateEvent);
  const deleteEvent = useReducer(reducers.deleteEvent);
  const [title, setTitle] = useState(event.title);
  const [venue, setVenue] = useState(event.venue ?? '');
  const [startsAt, setStartsAt] = useState(localDateTime(event.startsAt));
  const [isCheckpoint, setIsCheckpoint] = useState(event.isCheckpoint);
  const save = (form: FormEvent) => {
    form.preventDefault();
    if (!title.trim()) return;
    updateEvent({ eventId: event.id, title: title.trim(), venue: venue.trim() || undefined, startsAt: startsAt ? Timestamp.fromDate(new Date(startsAt)) : undefined, isCheckpoint });
    onDone();
  };
  const remove = () => {
    if (!window.confirm(`Delete “${event.title}” from the shared calendar?`)) return;
    deleteEvent({ eventId: event.id });
    onDone();
  };
  return <div className="modal-backdrop modal-backdrop--sheet" onClick={onDone}><form className="modal-sheet event-editor-sheet quick-add-form timeline-editor" onClick={input => input.stopPropagation()} onSubmit={save}><div className="quick-add-heading"><div><p className="section-label">Edit event</p><h2>Update the shared calendar</h2></div><button type="button" onClick={onDone} aria-label="Close event editor"><X size={18}/></button></div><label>Event name<input value={title} onChange={input => setTitle(input.target.value)} required maxLength={200} autoFocus /></label><label>When<input type="datetime-local" value={startsAt} onChange={input => setStartsAt(input.target.value)} /></label><label>Venue <span>optional</span><input value={venue} onChange={input => setVenue(input.target.value)} maxLength={300} /></label><label className="checkbox-row"><input type="checkbox" checked={isCheckpoint} onChange={input => setIsCheckpoint(input.target.checked)} /> Mark as a key checkpoint</label><div className="timeline-editor-actions"><button className="primary-button" type="submit">Save changes</button><button className="text-button danger-button" type="button" onClick={remove}>Delete event</button></div></form></div>;
}

function rupeesToPaise(value: string): bigint | undefined {
  const match = value.trim().replace(/,/g, '').match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return undefined;
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

type VendorChoice = { id: bigint; name: string; category: string; note?: string; bookingState: string };

function VendorSwipeDeck({ vendors, onUpdate, onClose }: { vendors: VendorChoice[]; onUpdate: (vendorId: bigint, bookingState: string) => void; onClose: () => void }) {
  const candidates = vendors.filter(vendor => vendor.bookingState === 'shortlisted');
  const index = 0;
  const [dragX, setDragX] = useState(0);
  const [startX, setStartX] = useState<number | null>(null);
  const vendor = candidates[index];
  const choose = (bookingState: 'selected' | 'declined') => {
    if (!vendor) return;
    onUpdate(vendor.id, bookingState);
    setDragX(0);
  };
  const finishDrag = () => {
    if (dragX > 100) choose('selected');
    else if (dragX < -100) choose('declined');
    else setDragX(0);
    setStartX(null);
  };

  return <div className="modal-backdrop modal-backdrop--sheet" onClick={onClose}><section className="modal-sheet vendor-swipe-sheet" role="dialog" aria-modal="true" aria-labelledby="vendor-review-title" onClick={event => event.stopPropagation()}>
    <div className="quick-add-heading"><div><p className="section-label">Vendor review</p><h2 id="vendor-review-title">One choice at a time</h2></div><button type="button" onClick={onClose} aria-label="Close vendor review"><X size={18}/></button></div>
    {vendor ? <><p className="swipe-progress">{index + 1} of {candidates.length} to review</p><div className="vendor-swipe-stage"><article className="vendor-swipe-card" style={{ transform: `translateX(${dragX}px) rotate(${dragX / 24}deg)` }} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); setStartX(event.clientX); }} onPointerMove={event => { if (startX !== null) setDragX(event.clientX - startX); }} onPointerUp={finishDrag} onPointerCancel={finishDrag}><span className={dragX < -40 ? 'swipe-intent pass visible' : 'swipe-intent pass'}>Pass</span><span className={dragX > 40 ? 'swipe-intent select visible' : 'swipe-intent select'}>Select</span><Store size={22}/><p className="section-label">{vendor.category}</p><h3>{vendor.name}</h3><p>{vendor.note || 'No extra notes yet.'}</p><small>Currently shortlisted</small></article></div><p className="swipe-help">Swipe left to pass or right to select. You can also use the buttons below.</p><div className="vendor-swipe-actions"><button type="button" className="swipe-pass" onClick={() => choose('declined')}><X size={18}/> Pass</button><button type="button" className="primary-button" onClick={() => choose('selected')}><Check size={18}/> Select</button></div><p className="swipe-note">This updates the shared shortlist only. It does not book, pay, or contact a vendor.</p></> : <div className="swipe-complete"><CheckCircle2 size={24}/><h3>Review complete</h3><p>You have worked through every vendor that still needs a choice.</p><button type="button" className="primary-button" onClick={onClose}>Back to vendors</button></div>}
  </section></div>;
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
  const [showVendorReview, setShowVendorReview] = useState(false);
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
  const categoryTotals = Array.from(lines.filter(item => item.state === 'confirmed').reduce((categories, item) => {
    const category = item.category.trim() || 'Other';
    const current = categories.get(category) ?? { planned: 0, paid: 0, lines: 0 };
    current.planned += Number(item.amountPaise) / 100;
    current.paid += item.paid ? Number(item.amountPaise) / 100 : 0;
    current.lines += 1;
    categories.set(category, current);
    return categories;
  }, new Map<string, { planned: number; paid: number; lines: number }>())).sort(([, left], [, right]) => right.planned - left.planned);
  const lineGroups = Array.from(lines.reduce((groups, line) => {
    const category = line.category.trim() || 'Other';
    const group = groups.get(category) ?? [];
    group.push(line);
    groups.set(category, group);
    return groups;
  }, new Map<string, typeof lines>())).sort(([, left], [, right]) => right.reduce((sum, line) => sum + Number(line.amountPaise), 0) - left.reduce((sum, line) => sum + Number(line.amountPaise), 0));
  const vendorStages = ['shortlisted', 'selected', 'booked', 'declined'].map(state => ({
    state,
    label: state === 'shortlisted' ? 'To choose' : state === 'selected' ? 'Selected' : state === 'booked' ? 'Booked' : 'Not proceeding',
    vendors: weddingVendors.filter(vendor => vendor.bookingState === state),
  })).filter(stage => stage.vendors.length);
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

  const remaining = Math.max(0, target - confirmedTotal);
  const overBudget = Math.max(0, confirmedTotal - target);

  return <section className="budget-workspace">
    <div className="budget-hero budget-hero--summary"><div><p className="section-label">Budget overview</p><h2>{target ? overBudget ? `${fmt.format(overBudget)} over budget` : `${fmt.format(remaining)} left to plan` : 'Set a budget to begin'}</h2><p>{target ? `Total budget: ${fmt.format(target)}. ${fmt.format(confirmedTotal)} has been planned so far.` : 'Set a shared spending limit, then add quotes, deposits, and payments below.'}</p></div>{canManage && <button type="button" className="outline-action" onClick={() => { setBudgetAmount(target ? String(target) : ''); setShowBudgetForm(value => !value); }}><Landmark size={16}/>{target ? 'Edit total budget' : 'Set total budget'}</button>}</div>
    {showBudgetForm && <form className="quick-add-form budget-form" onSubmit={submitBudget}><label>Total budget in rupees<input autoFocus inputMode="decimal" value={budgetAmount} onChange={event => setBudgetAmount(event.target.value)} placeholder="e.g. 2500000" required /></label><p>This is a human-approved planning limit. It does not spend or book anything.</p><button className="primary-button" type="submit">Save budget</button></form>}
    <div className="budget-stats budget-stats--expanded" aria-label="Budget summary">
      <div><span>Total budget</span><b>{target ? fmt.format(target) : 'Not set'}</b><small>Family-approved limit</small></div>
      <div><span>Current plan</span><b>{fmt.format(confirmedTotal)}</b><small>{target ? `${Math.round(percent)}% of the total budget` : `${lines.filter(item => item.state === 'confirmed').length} confirmed lines`}</small></div>
      <div><span>Paid so far</span><b>{fmt.format(paidTotal)}</b><small>{paidTotal ? `${fmt.format(Math.max(0, confirmedTotal - paidTotal))} still to pay` : 'No payments marked yet'}</small></div>
      <div className={pendingTotal ? 'budget-review' : ''}><span>Needs review</span><b>{fmt.format(pendingTotal)}</b><small>{pendingTotal ? 'Not included in the plan yet' : 'Everything is confirmed'}</small></div>
    </div>
    {target > 0 && <div className="budget-progress-summary"><div className="budget-progress" role="progressbar" aria-label="Budget planned" aria-valuemin={0} aria-valuemax={target} aria-valuenow={confirmedTotal}><span style={{ width: `${percent}%` }} /></div><p className={overBudget ? 'budget-warning' : 'budget-caption'}>{overBudget ? `${fmt.format(overBudget)} above your total budget` : `${fmt.format(confirmedTotal)} of ${fmt.format(target)} planned · ${Math.round(percent)}%`}</p></div>}
    {categoryTotals.length > 0 && <section className="budget-breakdown" aria-labelledby="budget-breakdown-title">
      <div className="budget-breakdown-heading"><div><p className="section-label">By section</p><h3 id="budget-breakdown-title">Where the budget is going</h3><p>Confirmed amounts only. Imported figures stay outside the running plan until someone reviews them.</p></div><span>{categoryTotals.length} {categoryTotals.length === 1 ? 'section' : 'sections'}</span></div>
      <div className="budget-breakdown-table" role="table" aria-label="Budget by section">
        <div className="budget-breakdown-row budget-breakdown-row--head" role="row"><span role="columnheader">Section</span><span role="columnheader">Planned</span><span role="columnheader">Paid</span><span role="columnheader">To pay</span></div>
        {categoryTotals.map(([category, totals]) => <div className="budget-breakdown-row" role="row" key={category}><div role="cell"><b>{category}</b><small>{totals.lines} {totals.lines === 1 ? 'line' : 'lines'}</small></div><b role="cell">{fmt.format(totals.planned)}</b><b role="cell">{fmt.format(totals.paid)}</b><b role="cell">{fmt.format(Math.max(0, totals.planned - totals.paid))}</b></div>)}
      </div>
    </section>}
    <div className="budget-section-heading"><div><p className="section-label">Budget lines</p><h3>Quotes, deposits, and payments</h3></div>{canManage && <button type="button" className="outline-action" onClick={() => setShowExpenseForm(true)}><Plus size={16}/> Add line</button>}</div>
    {showExpenseForm && <div className="modal-backdrop modal-backdrop--sheet" onClick={() => setShowExpenseForm(false)}><form className="modal-sheet budget-line-sheet" role="dialog" aria-modal="true" aria-labelledby="add-budget-line-title" onClick={event => event.stopPropagation()} onSubmit={submitExpense}>
      <div className="quick-add-heading"><div><p className="section-label">Budget line</p><h2 id="add-budget-line-title">Add a quote or payment</h2></div><button type="button" onClick={() => setShowExpenseForm(false)} aria-label="Close add budget line"><X size={18}/></button></div>
      <label>What is this for?<input autoFocus value={expense.label} onChange={event => setExpense(value => ({ ...value, label: event.target.value }))} placeholder="e.g. Ceremony decor deposit" required maxLength={200} /></label>
      <div className="budget-form-grid"><label>Category<input value={expense.category} onChange={event => setExpense(value => ({ ...value, category: event.target.value }))} placeholder="e.g. Decor" required maxLength={100} /></label><label>Amount in rupees<input inputMode="decimal" value={expense.amount} onChange={event => setExpense(value => ({ ...value, amount: event.target.value }))} placeholder="e.g. 45000" required /></label></div>
      <label>Vendor <span>optional</span><select value={expense.vendorId} onChange={event => setExpense(value => ({ ...value, vendorId: event.target.value }))}><option value="">No vendor linked</option>{weddingVendors.map(item => <option key={String(item.id)} value={String(item.id)}>{item.name} · {item.category}</option>)}</select></label>
      <label className="checkbox-row"><input type="checkbox" checked={expense.paid} onChange={event => setExpense(value => ({ ...value, paid: event.target.checked }))} /> This amount has been paid</label>
      <p>Adding a line records it for the group. It does not pay, reserve, or contact a vendor.</p>
      <div className="budget-line-sheet-actions"><button type="button" className="text-button" onClick={() => setShowExpenseForm(false)}>Cancel</button><button className="primary-button" type="submit"><BadgeIndianRupee size={17}/> Add budget line</button></div>
    </form></div>}
    <div className="budget-chapters">{lineGroups.length ? lineGroups.map(([category, categoryLines], index) => {
      const categoryAmount = categoryLines.reduce((sum, line) => sum + Number(line.amountPaise) / 100, 0);
      const reviewCount = categoryLines.filter(line => line.state === 'reported').length;
      return <details className="budget-chapter" key={category} open={index === 0 || reviewCount > 0}>
        <summary>
          <span className="budget-chapter-mark"><BadgeIndianRupee size={17}/></span>
          <span className="budget-chapter-title"><b>{category}</b><small>{categoryLines.length} {categoryLines.length === 1 ? 'item' : 'items'}{reviewCount ? ` · ${reviewCount} to review` : ''}</small></span>
          <span className="budget-chapter-total">{fmt.format(categoryAmount)}</span><ChevronDown className="chapter-chevron" size={19}/>
        </summary>
        <div className="budget-lines">{categoryLines.map(line => { const linkedVendor = line.vendorId === undefined ? undefined : weddingVendors.find(item => item.id === line.vendorId); const status = line.state === 'reported' ? 'Needs review' : line.paid ? 'Paid' : 'Planned'; return <article className={`budget-line ${line.state === 'reported' ? 'reported' : ''}`} key={String(line.id)}><div className="budget-line-main"><b>{line.label}</b><p>{linkedVendor ? linkedVendor.name : 'No vendor linked'}</p></div><div className="budget-line-status"><span className={line.state === 'reported' ? 'budget-status review' : line.paid ? 'budget-status paid' : 'budget-status planned'}>{status}</span></div><div className="budget-line-value"><b>{fmt.format(Number(line.amountPaise) / 100)}</b>{line.state === 'reported' && canManage && <span><button type="button" onClick={() => confirmExpense({ expenseId: line.id, accept: true })}>Confirm</button><button type="button" className="text-button" onClick={() => confirmExpense({ expenseId: line.id, accept: false })}>Dismiss</button></span>}</div></article>; })}</div>
      </details>;
    }) : <div className="empty-budget"><CircleDollarSign size={22}/><b>No budget lines yet</b><p>Add the first quote or payment yourself, or import vendor quotes from Connect for review.</p></div>}</div>
    <div className="budget-section-heading vendor-heading"><div><p className="section-label">Vendors</p><h3>Keep selection and consent clear</h3></div>{canManage && <div className="vendor-heading-actions">{weddingVendors.some(item => item.bookingState === 'shortlisted') && <button type="button" className="outline-action" onClick={() => setShowVendorReview(true)}>Review choices</button>}<button type="button" className="outline-action" onClick={() => setShowVendorForm(true)}><Plus size={16}/> Add vendor</button></div>}</div>
    {showVendorReview && <VendorSwipeDeck vendors={weddingVendors} onUpdate={(vendorId, bookingState) => setVendorBookingState({ vendorId, bookingState })} onClose={() => setShowVendorReview(false)} />}
    {showVendorForm && <div className="modal-backdrop modal-backdrop--sheet" onClick={() => setShowVendorForm(false)}><form className="modal-sheet vendor-form-sheet" role="dialog" aria-modal="true" aria-labelledby="add-vendor-title" onClick={event => event.stopPropagation()} onSubmit={submitVendor}><div className="quick-add-heading"><div><p className="section-label">Vendor</p><h2 id="add-vendor-title">Add a vendor</h2></div><button type="button" onClick={() => setShowVendorForm(false)} aria-label="Close add vendor"><X size={18}/></button></div><label>Vendor name<input autoFocus value={vendor.name} onChange={event => setVendor(value => ({ ...value, name: event.target.value }))} placeholder="e.g. Nila Blooms" required maxLength={160} /></label><label>Category<input value={vendor.category} onChange={event => setVendor(value => ({ ...value, category: event.target.value }))} placeholder="e.g. Floral decor" required maxLength={100} /></label><label>Notes <span>optional</span><textarea value={vendor.note} onChange={event => setVendor(value => ({ ...value, note: event.target.value }))} placeholder="What should the family remember about this vendor?" maxLength={1000} /></label><p>Vendor contact details and outreach stay outside this shared plan. Add only the planning context the group needs.</p><div className="budget-line-sheet-actions"><button type="button" className="text-button" onClick={() => setShowVendorForm(false)}>Cancel</button><button className="primary-button" type="submit"><Store size={17}/> Add vendor</button></div></form></div>}
    <div className="vendor-stages">{vendorStages.length ? vendorStages.map((stage, index) => <details className={`vendor-stage vendor-stage--${stage.state}`} key={stage.state} open={stage.state === 'shortlisted' || (index === 0 && stage.state !== 'declined')}>
      <summary><span className="vendor-stage-dot" /><span><b>{stage.label}</b><small>{stage.vendors.length} {stage.vendors.length === 1 ? 'vendor' : 'vendors'}</small></span><ChevronDown className="chapter-chevron" size={19}/></summary>
      <div className="vendor-list">{stage.vendors.map(item => { const consent = consents.find(row => row.vendorId === item.id); return <article className="vendor-card" key={String(item.id)}><div className="vendor-card-main"><span className="vendor-icon"><Store size={18}/></span><div><b>{item.name}</b><p>{item.category}{item.note ? ` · ${item.note}` : ''}</p></div></div><div className="vendor-card-actions"><label>Status<select value={item.bookingState} disabled={!canManage} onChange={event => setVendorBookingState({ vendorId: item.id, bookingState: event.target.value })}><option value="shortlisted">Shortlisted</option><option value="selected">Selected</option><option value="booked">Booked</option><option value="declined">Not proceeding</option></select></label>{canManage && <button type="button" className={consent?.consented ? 'consent-button allowed' : 'consent-button'} onClick={() => setVendorConsent({ vendorId: item.id, consented: !consent?.consented })}><ShieldCheck size={15}/>{consent?.consented ? 'Draft follow-ups allowed' : 'Allow draft follow-ups'}</button>}<small>{consent?.consented ? 'A person has approved draft outreach. Nothing is sent automatically.' : 'No vendor outreach is permitted.'}</small></div></article>; })}</div>
    </details>) : <div className="empty-budget"><Store size={22}/><b>No vendors yet</b><p>Add the vendors you are considering, then link their quotes and payments above.</p></div>}</div>
  </section>;
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
  return <section className="contact-import panel"><div className="guest-list-intro"><div><Upload color="#087d6b"/><h2>Guest list</h2><p>Add people one at a time, or bring in a contacts CSV, spreadsheet, or phone export. Imported records stay reviewable; nobody is invited automatically.</p></div></div><GuestRoster weddingId={weddingId}/><div className="guest-import-divider"><span>Import several guests</span></div><label className="file-picker"><input type="file" accept=".csv,.tsv,.xlsx,.xls,text/csv" onChange={event => { setFileName(event.target.files?.[0]?.name ?? ''); setQueued(false); }} /><Upload size={16}/>{fileName || 'Choose a contacts file'}</label>{fileName && <button type="button" className="primary-button" onClick={queue} disabled={queued}>{queued ? 'Import queued for review' : 'Queue contact import'}</button>}</section>;
}

function GuestRoster({ weddingId }: { weddingId: bigint }) {
  const { identity } = useSpacetimeDB();
  const [members] = useTable(tables.member);
  const [guests] = useTable(tables.guest);
  const updateGuestCoordination = useReducer(reducers.updateGuestCoordination);
  const createGuest = useReducer(reducers.createGuest);
  const [editingGuestId, setEditingGuestId] = useState<bigint | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [addingGuest, setAddingGuest] = useState(false);
  const [guestDraft, setGuestDraft] = useState({ name: '', side: '', homeCity: '' });
  const membership = members.find(member => member.weddingId === weddingId && member.identity.toHexString() === identity?.toHexString());
  const canManage = membership?.role === 'couple' || membership?.role === 'planner';
  const guestList = guests.filter(guest => guest.weddingId === weddingId);
  const rsvp = (status: string) => status === 'confirmed' ? 'Coming' : status === 'declined' ? 'Not coming' : 'Awaiting reply';
  const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase();
  const editNote = (guest: typeof guestList[number]) => { setEditingGuestId(guest.id); setNoteDraft(guest.note ?? ''); };
  const saveNote = (guest: typeof guestList[number]) => { updateGuestCoordination({ guestId: guest.id, note: noteDraft.trim() || undefined, needsFollowUp: guest.needsFollowUp }); setEditingGuestId(null); };
  const submitGuest = (event: FormEvent) => { event.preventDefault(); if (!guestDraft.name.trim()) return; createGuest({ weddingId, name: guestDraft.name.trim(), side: guestDraft.side || undefined, homeCity: guestDraft.homeCity.trim() || undefined }); setGuestDraft({ name: '', side: '', homeCity: '' }); setAddingGuest(false); };
  return <><div className="guest-roster"><div className="guest-roster-heading"><div><b>Your guests</b><small>{guestList.length ? `${guestList.length} ${guestList.length === 1 ? 'guest' : 'guests'} · review imported details before sending anything` : 'No guests added yet'}</small></div><div className="guest-roster-heading-actions">{guestList.length > 0 && <span>{guestList.filter(guest => guest.needsFollowUp).length} follow-up{guestList.filter(guest => guest.needsFollowUp).length === 1 ? '' : 's'} flagged</span>}{canManage && <button type="button" className="outline-action" onClick={() => setAddingGuest(true)}><UserPlus size={16}/> Add guest</button>}</div></div>{guestList.length ? <div className="guest-card-grid">{guestList.map((guest, index) => <article className="guest-roster-card" key={String(guest.id)}><div className={`guest-avatar avatar-tone-${index % 6}`} aria-hidden="true">{initials(guest.name)}</div><div className="guest-roster-main"><div className="guest-card-title"><b>{guest.name}</b><span className={`guest-chip guest-rsvp ${guest.rsvpStatus}`}>{rsvp(guest.rsvpStatus)}</span></div><div className="guest-chips"><span className={`guest-chip guest-side ${guest.side ?? 'family'}`}>{guest.side === 'bride' ? 'Bride’s side' : guest.side === 'groom' ? 'Groom’s side' : 'Family'}</span>{guest.homeCity && <span className="guest-chip guest-city"><MapPin size={13}/> {guest.homeCity}</span>}{guest.needsFollowUp && <span className="guest-chip guest-followup"><MessageCircle size={13}/> Follow up</span>}</div>{guest.note && editingGuestId !== guest.id && <p className="guest-note"><b>Note</b> {guest.note}</p>}{editingGuestId === guest.id && <form className="guest-note-editor" onSubmit={event => { event.preventDefault(); saveNote(guest); }}><input value={noteDraft} onChange={event => setNoteDraft(event.target.value)} placeholder="e.g. Needs airport pickup confirmation" maxLength={500} autoFocus/><button type="submit">Save note</button><button type="button" onClick={() => setEditingGuestId(null)}>Cancel</button></form>}</div>{canManage && <div className="guest-roster-actions"><button type="button" className={guest.needsFollowUp ? 'guest-action flagged' : 'guest-action'} onClick={() => updateGuestCoordination({ guestId: guest.id, note: guest.note, needsFollowUp: !guest.needsFollowUp })}>{guest.needsFollowUp ? 'Following up' : 'Follow up'}</button><button type="button" className="guest-action" onClick={() => editNote(guest)}>{guest.note ? 'Edit note' : 'Add note'}</button></div>}</article>)}</div> : <div className="guest-roster-empty"><Users size={22}/><p>Add a guest yourself or import the list you already have.</p></div>}</div>{addingGuest && <div className="modal-backdrop modal-backdrop--sheet" onClick={() => setAddingGuest(false)}><form className="modal-sheet guest-add-sheet" onClick={event => event.stopPropagation()} onSubmit={submitGuest}><div className="quick-add-heading"><div><p className="section-label">Guest list</p><h2>Add a guest</h2></div><button type="button" onClick={() => setAddingGuest(false)} aria-label="Close add guest"><X size={18}/></button></div><label><span>Guest name</span><input value={guestDraft.name} onChange={event => setGuestDraft(value => ({ ...value, name: event.target.value }))} placeholder="e.g. Ananya Iyer" required maxLength={160} autoFocus /></label><label><span>Side <small>optional</small></span><select value={guestDraft.side} onChange={event => setGuestDraft(value => ({ ...value, side: event.target.value }))}><option value="">Family / not set</option><option value="bride">Bride’s side</option><option value="groom">Groom’s side</option></select></label><label><span>Home city <small>optional</small></span><input value={guestDraft.homeCity} onChange={event => setGuestDraft(value => ({ ...value, homeCity: event.target.value }))} placeholder="e.g. Bengaluru" maxLength={120} /></label><p>This guest is added to the shared list. No invitation or message will be sent.</p><button className="primary-button" type="submit"><UserPlus size={17}/> Add guest</button></form></div>}</>;
}

function MoodBoard({ weddingId }: { weddingId: bigint }) {
  const [moodItems] = useTable(tables.moodItem);
  const items = moodItems.filter(item => item.weddingId === weddingId);
  const thumbnails = [bridalStyling, ceremonyMandap, dinnerCelebration];
  return <section className="mood-board">
    <div className="mood-board-heading">
      <div>
        <p className="section-label">Pinterest inspiration</p>
        <h2>A feeling to build from</h2>
        <p>These are source ideas, not final choices. Bring any one into Decide when the family is ready.</p>
      </div>
      <span className="mood-review-badge">{items.length} ideas to review</span>
    </div>
    {items.length ? <div className="mood-grid">
      {items.map((item, index) => <article className={`mood-card mood-card--${index % 4}`} key={String(item.id)}>
        <img className="mood-swatch" src={thumbnails[index % thumbnails.length]} alt={`${item.title} inspiration`} />
        <div className="mood-card-copy">
          <small>Pinterest import · needs review</small>
          <h3>{item.title}</h3>
          <p>{item.note}</p>
          {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">View source <span aria-hidden="true">↗</span></a>}
        </div>
      </article>)}
    </div> : <div className="panel"><Image color="#087d6b"/><h2>Your mood board</h2><p>Shared Pinterest images become grouped draft options on Decide. Nothing is chosen automatically.</p></div>}
  </section>;
}

const menuCourses = ['Welcome drink', 'Starter', 'Main', 'Bread or rice', 'Dessert', 'Live counter', 'Late-night bite'];

const menuPreviewData = [
  { event: 'Mehendi evening', title: 'Garden mehendi supper', service: 'Food stations', guests: 160, state: 'Draft', notes: 'Vegetarian-forward · Jain-friendly main · nut-free dessert', dishes: [{ course: 'Welcome drink', name: 'Tender coconut and lime cooler', tag: 'Confirmed' }, { course: 'Starter', name: 'Mini paniyaram with tomato chutney', tag: 'Family favourite' }, { course: 'Live counter', name: 'Kothu parotta counter', tag: '2 favourites' }, { course: 'Dessert', name: 'Tender coconut payasam', tag: 'Confirmed' }] },
  { event: 'Wedding ceremony', title: 'Ceremony lunch', service: 'Buffet', guests: 240, state: 'Final', notes: 'Vegetarian Tamil lunch · Jain-friendly main · filter coffee', dishes: [{ course: 'Welcome drink', name: 'Panakam and buttermilk', tag: 'Confirmed' }, { course: 'Main', name: 'Banana-leaf South Indian lunch', tag: 'Confirmed' }, { course: 'Main', name: 'Jain vegetable korma', tag: 'Confirmed' }, { course: 'Dessert', name: 'Elaneer payasam', tag: 'Confirmed' }] },
] as const;

function MenuPreviewModal({ menu, onClose }: { menu: typeof menuPreviewData[number]; onClose: () => void }) {
  return <div className="modal-backdrop modal-backdrop--sheet" onClick={onClose}><section className="modal-sheet menu-preview-modal" role="dialog" aria-modal="true" aria-labelledby="menu-preview-title" onClick={event => event.stopPropagation()}><div className="quick-add-heading"><div><p className="section-label">{menu.state === 'Final' ? 'Final menu' : 'Menu draft'}</p><h2 id="menu-preview-title">{menu.title}</h2><p>{menu.event} · {menu.service} · {menu.guests} guests</p></div><button type="button" onClick={onClose} aria-label="Close menu preview"><X size={18}/></button></div><div className="menu-preview-notes"><Heart size={16}/><span>{menu.notes}</span></div><div className="menu-preview-dishes">{menu.dishes.map(dish => <article key={dish.name}><span>{dish.course}</span><b>{dish.name}</b><small>{dish.tag}</small></article>)}</div><p className="menu-preview-footnote">Demo preview. Once this wedding’s live menu records arrive, your group’s dishes, reviews, and favourites appear here instead.</p><button type="button" className="primary-button" onClick={onClose}>Back to menus</button></section></div>;
}

function MenuWorkspace({ weddingId }: { weddingId: bigint }) {
  const { identity } = useSpacetimeDB();
  const [members] = useTable(tables.member);
  const [events] = useTable(tables.event);
  const [menus] = useTable(tables.menu);
  const [menuItems] = useTable(tables.menuItem);
  const [menuVotes] = useTable(tables.menuItemVote);
  const createMenu = useReducer(reducers.createMenu);
  const addMenuItem = useReducer(reducers.addMenuItem);
  const reviewMenuItem = useReducer(reducers.reviewMenuItem);
  const voteMenuItem = useReducer(reducers.voteMenuItem);
  const finalizeMenu = useReducer(reducers.finalizeMenu);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [previewMenu, setPreviewMenu] = useState<typeof menuPreviewData[number] | null>(null);
  const [selectedMenuId, setSelectedMenuId] = useState<bigint | undefined>();
  const [menuDraft, setMenuDraft] = useState({ eventId: '', title: '', serviceStyle: 'Buffet', guestCount: '', dietaryNotes: '' });
  const [itemDraft, setItemDraft] = useState({ course: 'Starter', dish: '', dietaryTags: '' });
  const myHex = identity?.toHexString();
  const membership = members.find(member => member.weddingId === weddingId && member.identity.toHexString() === myHex);
  const canManage = membership?.role === 'couple' || membership?.role === 'planner';
  const weddingEvents = events.filter(event => event.weddingId === weddingId);
  const weddingMenus = menus.filter(menu => menu.weddingId === weddingId).sort((a, b) => Number(a.id - b.id));
  const selectedMenu = weddingMenus.find(menu => menu.id === selectedMenuId) ?? weddingMenus.find(menu => menu.state !== 'confirmed') ?? weddingMenus[0];
  const selectedItems = selectedMenu ? menuItems.filter(item => item.menuId === selectedMenu.id && item.state !== 'unknown') : [];
  const confirmedItems = selectedItems.filter(item => item.state === 'confirmed');
  const submitMenu = (form: FormEvent) => {
    form.preventDefault();
    if (!menuDraft.eventId || !menuDraft.title.trim()) return;
    const count = menuDraft.guestCount ? Number(menuDraft.guestCount) : undefined;
    if (count !== undefined && (!Number.isInteger(count) || count < 1 || count > 100000)) return;
    createMenu({ weddingId, eventId: BigInt(menuDraft.eventId), title: menuDraft.title.trim(), serviceStyle: menuDraft.serviceStyle, guestCount: count, dietaryNotes: menuDraft.dietaryNotes.trim() || undefined });
    setMenuDraft({ eventId: '', title: '', serviceStyle: 'Buffet', guestCount: '', dietaryNotes: '' });
    setShowNewMenu(false);
  };
  const submitItem = (form: FormEvent) => {
    form.preventDefault();
    if (!selectedMenu || !itemDraft.dish.trim()) return;
    addMenuItem({ menuId: selectedMenu.id, course: itemDraft.course, dish: itemDraft.dish.trim(), dietaryTags: itemDraft.dietaryTags.trim() || undefined });
    setItemDraft(current => ({ ...current, dish: '', dietaryTags: '' }));
  };

  return <section className="menu-workspace">
    <header className="menu-workspace-heading"><div><p className="section-label">Menus</p><h2>Plan food everyone can feel good about</h2><p>Shape a menu around each event, gather the family’s preferences, then let the couple or planner make the final call. Food ideas stay reviewable until then.</p></div>{canManage && <button className="outline-action" type="button" onClick={() => setShowNewMenu(true)}><Plus size={16}/> Start a menu</button>}</header>
    <div className="menu-live-note"><span><i/><b>Live shared menu</b><small>Changes, reviews, and preferences update for everyone in the plan.</small></span><span>Finalisation stays with a person</span></div>
    {!weddingMenus.length && <section className="menu-demo" aria-label="Menu examples"><div className="menu-demo-heading"><div><p className="section-label">Sample menus</p><h3>See the plan taking shape</h3><p>These examples keep the menu surface useful while this wedding’s shared menu records are still empty.</p></div><span>Preview data</span></div><div className="menu-demo-grid">{menuPreviewData.map(menu => <article key={menu.title}><div><p className="section-label">{menu.event}</p><h3>{menu.title}</h3><p>{menu.service} · {menu.guests} guests</p></div><span className={menu.state === 'Final' ? 'demo-menu-state final' : 'demo-menu-state'}>{menu.state}</span><ul>{menu.dishes.slice(0, 3).map(dish => <li key={dish.name}><span>{dish.course}</span><b>{dish.name}</b></li>)}</ul><button type="button" onClick={() => setPreviewMenu(menu)}>View menu</button></article>)}</div></section>}
    {showNewMenu && <form className="menu-form" onSubmit={submitMenu}><div className="quick-add-heading"><div><p className="section-label">New menu draft</p><h3>Set the shape first</h3></div><button type="button" onClick={() => setShowNewMenu(false)} aria-label="Close new menu"><X size={18}/></button></div><div className="menu-form-grid"><label>Event<select required value={menuDraft.eventId} onChange={event => setMenuDraft(current => ({ ...current, eventId: event.target.value }))}><option value="" disabled>Choose an event</option>{weddingEvents.map(event => <option key={String(event.id)} value={String(event.id)}>{event.title}</option>)}</select></label><label>Menu name<input required maxLength={160} value={menuDraft.title} onChange={event => setMenuDraft(current => ({ ...current, title: event.target.value }))} placeholder="e.g. Mehendi supper" /></label><label>Service style<select value={menuDraft.serviceStyle} onChange={event => setMenuDraft(current => ({ ...current, serviceStyle: event.target.value }))}><option>Buffet</option><option>Plated meal</option><option>Family-style</option><option>Food stations</option></select></label><label>Expected guests <span>optional</span><input type="number" min="1" max="100000" value={menuDraft.guestCount} onChange={event => setMenuDraft(current => ({ ...current, guestCount: event.target.value }))} placeholder="e.g. 180" /></label></div><label>Dietary notes <span>optional</span><textarea maxLength={600} value={menuDraft.dietaryNotes} onChange={event => setMenuDraft(current => ({ ...current, dietaryNotes: event.target.value }))} placeholder="For example: vegetarian-forward, Jain-friendly main, nut-free dessert" /></label><p>This creates a draft for the group to review. It does not contact or book a caterer.</p><button className="primary-button" type="submit">Create menu draft</button></form>}
    {!weddingEvents.length ? <div className="panel"><UtensilsCrossed color="#087d6b"/><h2>Add an event first</h2><p>Menus are kept with the event they serve, so the family always knows where each choice belongs.</p></div> : !weddingMenus.length ? <div className="menu-empty"><UtensilsCrossed size={28}/><h3>Start with one event</h3><p>Create a menu draft for a meal, then add candidates course by course for the family to review.</p>{canManage && <button className="primary-button" type="button" onClick={() => setShowNewMenu(true)}>Start a menu</button>}</div> : <div className="menu-layout"><aside className="menu-list" aria-label="Event menus"><p className="section-label">Your menus</p>{weddingMenus.map(menu => { const event = weddingEvents.find(item => item.id === menu.eventId); const count = menuItems.filter(item => item.menuId === menu.id && item.state === 'confirmed').length; return <button type="button" key={String(menu.id)} className={selectedMenu?.id === menu.id ? 'active' : ''} onClick={() => setSelectedMenuId(menu.id)}><UtensilsCrossed size={18}/><span><b>{event?.title ?? 'Event menu'}</b><small>{menu.title} · {count} confirmed dish{count === 1 ? '' : 'es'}</small></span><em>{menu.state === 'confirmed' ? 'Final' : 'Draft'}</em></button>; })}</aside>{selectedMenu && <article className="menu-detail"><header><div><p className="section-label">{selectedMenu.state === 'confirmed' ? 'Final menu' : 'Menu draft'}</p><h3>{selectedMenu.title}</h3><p>{weddingEvents.find(event => event.id === selectedMenu.eventId)?.title ?? 'Event'} · {selectedMenu.serviceStyle}{selectedMenu.guestCount ? ` · ${selectedMenu.guestCount} guests` : ''}</p></div><span className={`menu-state ${selectedMenu.state}`}>{selectedMenu.state === 'confirmed' ? <><Check size={14}/> Finalised</> : 'Needs review'}</span></header>{selectedMenu.dietaryNotes && <div className="menu-dietary"><Heart size={16}/><span><b>Dietary notes</b>{selectedMenu.dietaryNotes}</span></div>}<div className="menu-progress"><span><b>{confirmedItems.length}</b> confirmed dishes</span><span><b>{selectedItems.filter(item => item.state === 'reported').length}</b> to review</span><span><b>{menuVotes.filter(vote => selectedItems.some(item => item.id === vote.menuItemId) && vote.liked).length}</b> family favourites</span></div><div className="menu-course-list">{selectedItems.length ? selectedItems.map(item => { const votes = menuVotes.filter(vote => vote.menuItemId === item.id); const likes = votes.filter(vote => vote.liked).length; const mine = votes.find(vote => vote.voterIdentity.toHexString() === myHex); return <article className={item.state === 'reported' ? 'menu-item reported' : 'menu-item'} key={String(item.id)}><div><span className="menu-course">{item.course}</span><b>{item.dish}</b>{item.dietaryTags && <small>{item.dietaryTags}</small>}</div><div className="menu-item-actions">{selectedMenu.state !== 'confirmed' && <button type="button" className={mine?.liked ? 'menu-like liked' : 'menu-like'} onClick={() => voteMenuItem({ menuItemId: item.id, liked: !mine?.liked })}><Heart size={15} fill={mine?.liked ? 'currentColor' : 'none'}/>{likes}</button>}{item.state === 'reported' ? <><small>Candidate · needs review</small>{canManage && <span><button type="button" onClick={() => reviewMenuItem({ menuItemId: item.id, keep: true })}>Keep</button><button type="button" onClick={() => reviewMenuItem({ menuItemId: item.id, keep: false })}>Remove</button></span>}</> : <small>Confirmed for this menu</small>}</div></article>; }) : <p className="menu-items-empty">Add a dish for the first course your family wants to shape.</p>}</div>{selectedMenu.state !== 'confirmed' && canManage && <form className="menu-item-form" onSubmit={submitItem}><select value={itemDraft.course} onChange={event => setItemDraft(current => ({ ...current, course: event.target.value }))}>{menuCourses.map(course => <option key={course}>{course}</option>)}</select><input required maxLength={160} value={itemDraft.dish} onChange={event => setItemDraft(current => ({ ...current, dish: event.target.value }))} placeholder="Add a dish to consider" /><input maxLength={160} value={itemDraft.dietaryTags} onChange={event => setItemDraft(current => ({ ...current, dietaryTags: event.target.value }))} placeholder="Dietary tags (optional)" /><button type="submit"><Plus size={16}/> Add candidate</button></form>}{selectedMenu.state !== 'confirmed' && canManage && <footer className="menu-finalise"><div><b>Ready to make the final call?</b><p>Only confirmed dishes are included. Finalising locks this menu; it still does not place a catering order.</p></div><button type="button" className="primary-button" disabled={!confirmedItems.length} onClick={() => { if (window.confirm(`Finalise “${selectedMenu.title}” with ${confirmedItems.length} confirmed dishes?`)) finalizeMenu({ menuId: selectedMenu.id }); }}><CheckCircle2 size={16}/> Finalise menu</button></footer>}</article>}</div>}
    {previewMenu && <MenuPreviewModal menu={previewMenu} onClose={() => setPreviewMenu(null)} />}
  </section>;
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
  const [openEventIds, setOpenEventIds] = useState<Set<string>>(() => new Set());
  const [hasToggledMilestone, setHasToggledMilestone] = useState(false);
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
  const toggleEvent = (eventId: bigint) => {
    const id = String(eventId);
    setHasToggledMilestone(true);
    setOpenEventIds(current => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return <section className="event-workspace">
    <div className="event-workspace-heading"><div><p className="section-label">Events and checklists</p><h2>Start with the moments your family knows</h2><p>Use a familiar event as a practical starting point, then keep only the details that fit your wedding. Template items are suggestions until a person confirms them.</p></div>{canManage && <button type="button" className="outline-action" onClick={() => setAddingEvent(true)}><Plus size={16}/> Add event</button>}</div>
    {weddingEvents.length > 0 && <section className="event-overview" aria-label="Wedding planning progress"><div className="event-overview-stat"><span>Confirmed checklist progress</span><b>{allCompleted}/{allConfirmed || 0}</b><small>{allConfirmed ? 'tasks complete' : 'Confirm a few suggestions to begin'}</small></div><div className="event-overview-panel"><div className="event-overview-heading"><AlertTriangle size={17}/><div><b>Needs attention</b><span>These are planning gaps, not automatic decisions.</span></div></div>{priorityItems.length ? <ul>{priorityItems.map(item => <li key={`${item.event}-${item.label}`}><b>{item.event}</b><span>{item.label}</span></li>)}</ul> : <p className="overview-clear"><CheckCircle2 size={17}/> The essential event details are in place.</p>}</div><div className="event-overview-panel"><div className="event-overview-heading"><Store size={17}/><div><b>Vendor updates</b><span>Latest shared booking status</span></div></div>{weddingVendors.length ? <ul>{weddingVendors.slice(0, 4).map(vendor => <li key={String(vendor.id)}><b>{vendor.name}</b><span className={`vendor-state ${vendor.bookingState}`}>{vendor.bookingState === 'booked' ? 'Booked' : vendor.bookingState === 'selected' ? 'Selected' : vendor.bookingState === 'declined' ? 'Not proceeding' : 'Shortlisted'}</span></li>)}</ul> : <p className="overview-clear">Add vendors in Budget to see their updates here.</p>}</div></section>}
    {addingEvent && <AddEvent weddingId={weddingId} onDone={() => setAddingEvent(false)} />}
    {canManage && <div className="event-template-section"><div><p className="section-label">Quick start</p><h3>Add a usual event</h3></div><div className="event-template-grid">{eventTemplates.map(template => <button type="button" key={template.key} onClick={() => applyEventTemplate({ weddingId, template: template.key })}><b>{template.title}</b><span>{template.copy}</span><small><Plus size={14}/> Add checklist</small></button>)}</div></div>}
    {weddingEvents.length ? <div className="event-detail-list event-milestone-list">{weddingEvents.map((event, index) => {
      const items = forEvent(event.id);
      const status = eventStatus(event);
      const progress = status.total ? Math.round((status.completed / status.total) * 100) : 0;
      const eventId = String(event.id);
      const isOpen = hasToggledMilestone ? openEventIds.has(eventId) : index === 0;
      const panelId = `event-milestone-${eventId}`;
      return <article className={`event-detail-card event-milestone event-milestone--${index % 4} ${isOpen ? 'is-open' : ''} ${event.state === 'reported' ? 'reported' : ''}`} key={eventId}>
        <button className="event-milestone-toggle" type="button" onClick={() => toggleEvent(event.id)} aria-expanded={isOpen} aria-controls={panelId}>
          <span className="milestone-scene" aria-hidden="true"><span className="milestone-halo"/><span className="milestone-orb milestone-orb--one"/><span className="milestone-orb milestone-orb--two"/><Sparkles size={19}/><span className="milestone-number">{index + 1}</span></span>
          <span className="event-detail-title"><span className="card-icon"><CalendarDays size={20}/></span><span><h3>{event.title}</h3><p>{event.venue ?? 'Time and place to confirm'}{event.state === 'reported' ? ' · event details need review' : ''}</p></span></span>
          <span className="milestone-status"><b>{status.completed}/{status.total || 0}</b><small>{status.total ? 'tasks done' : 'ready to shape'}</small></span>
          <span className="milestone-chevron"><ChevronDown size={20}/><span className="sr-only">{isOpen ? 'Collapse' : 'Expand'} {event.title}</span></span>
        </button>
        <div className="event-milestone-body" id={panelId} hidden={!isOpen}>
          <section className="event-menu-panel" aria-labelledby={`event-menu-${eventId}`}>
            <div className="event-menu-heading">
              <span className="event-menu-icon"><UtensilsCrossed size={19}/></span>
              <div><p className="section-label">Menu</p><h4 id={`event-menu-${eventId}`}>Food for {event.title}</h4></div>
              <span className="event-menu-status">Plan in Menus</span>
            </div>
            <p>Use the Menus section to shape dishes, service style, and dietary notes with the family. Nothing is confirmed until a person makes the final call.</p>
            <dl className="event-menu-details">
              <div><dt>Menu</dt><dd>No dishes added yet</dd></div>
              <div><dt>Service</dt><dd>To confirm</dd></div>
              <div><dt>Dietary notes</dt><dd>To confirm</dd></div>
            </dl>
          </section>
          <div className="checklist-path-intro">
            <img src="/images/checklist-path.png" alt="A winding planning path with flowers and stationery" />
            <div>
              <p className="section-label">Planning path</p>
              <h4>{status.total ? 'One clear step at a time' : 'Shape this moment together'}</h4>
              <p>{status.total ? 'Review the suggestions, then tick off the details your family has confirmed.' : 'Keep the details that matter, then add your own next step.'}</p>
            </div>
          </div>
          <div className="event-progress" aria-label={`${event.title} checklist progress`}><span style={{ width: `${progress}%` }} /><small>{status.total ? `${progress}% complete` : 'Confirm checklist suggestions to track progress'}</small></div>
          {status.missing.length > 0 && <div className="event-missing"><AlertTriangle size={15}/><span><b>Still needed:</b> {status.missing.join(' · ')}</span></div>}
          {items.length ? <ul className="event-checklist event-checklist-path">{items.map((item, itemIndex) => <li className={`${item.state === 'reported' ? 'reported' : ''} ${item.done ? 'done' : ''}`} key={String(item.id)}>
            <span className="checklist-path-marker" aria-hidden="true">{item.done ? <Check size={14}/> : itemIndex + 1}</span>
            <div className="checklist-path-content">{item.state === 'confirmed' && canManage ? <label><input type="checkbox" checked={item.done} onChange={event => setEventChecklistItemDone({ itemId: item.id, done: event.target.checked })}/><span>{item.label}</span></label> : <span>{item.label}</span>}{item.state === 'reported' ? <div className="checklist-suggestion-actions"><small>Template suggestion</small>{canManage && <><button type="button" onClick={() => confirmEventChecklistItem({ itemId: item.id, keep: true })}>Keep</button><button type="button" onClick={() => confirmEventChecklistItem({ itemId: item.id, keep: false })}>Remove</button></>}</div> : !canManage && <small>{item.done ? 'Done' : 'Open'}</small>}</div>
          </li>)}</ul> : <p className="event-checklist-empty">Add the first task your family wants to keep track of for this event.</p>}
          {canManage && <form className="event-checklist-add" onSubmit={form => { form.preventDefault(); addChecklist(event.id); }}><input value={drafts[eventId] ?? ''} onChange={input => setDrafts(current => ({ ...current, [eventId]: input.target.value }))} placeholder="Add a checklist item" maxLength={240}/><button type="submit"><Plus size={16}/> Add</button></form>}
        </div>
      </article>;
    })}</div> : !addingEvent && <div className="panel"><ClipboardCheck color="#087d6b"/><h2>Begin with an event</h2><p>Add a family event above and Inai will give your group a calm, reviewable checklist to start from.</p></div>}
  </section>;
}

function AddCustomAgent({ weddingId, onDone }: { weddingId: bigint; onDone: () => void }) {
  const createCustomWeddingAgent = useReducer(reducers.createCustomWeddingAgent);
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !instructions.trim()) return;
    setSaving(true); setError('');
    try {
      await createCustomWeddingAgent({ weddingId, name: name.trim(), instructions: instructions.trim() });
      const runtimeUrl = import.meta.env.VITE_AGENT_RUNTIME_URL?.replace(/\/$/, '');
      if (runtimeUrl) {
        const response = await fetch(`${runtimeUrl}/v1/agents/deploy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wedding_id: String(weddingId), agent_id: `${weddingId}:${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name: name.trim(), instructions: instructions.trim() }) });
        if (!response.ok) throw new Error('The assistant was added, but could not start yet. Try again shortly.');
      }
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not add this assistant. Try again.');
    } finally { setSaving(false); }
  };
  return <form className="quick-add-form custom-agent-form" onSubmit={submit}>
    <div className="quick-add-heading"><div><p className="section-label">New assistant</p><h2>Give your wedding team a hand</h2></div><button type="button" onClick={onDone} aria-label="Close new assistant"><X size={18}/></button></div>
    <label>Assistant name<input value={name} onChange={event => setName(event.target.value)} maxLength={80} placeholder="e.g. Ritual guide" required autoFocus /></label>
    <label>What should it focus on?<textarea value={instructions} onChange={event => setInstructions(event.target.value)} maxLength={2000} placeholder="For example: Organise ceremony traditions and draft a simple family run-sheet for review." required /></label>
    <p>It becomes active across Inai as soon as you add it. It can read the plan, organise information, and prepare drafts. A person still approves all decisions, spending, messages, and vendor contact.</p>
    {error && <p className="form-error">{error}</p>}
    <button className="primary-button" type="submit" disabled={saving}><Plus size={17}/>{saving ? 'Adding assistant…' : 'Add assistant'}</button>
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
    parsed.events.forEach(event => createEvent({ weddingId, title: event.title, venue: event.venue, startsAt: event.startsAt ? Timestamp.fromDate(event.startsAt) : undefined, source: source.kind, confidence: event.confidence, isCheckpoint: false }));
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

export default function WeddingTab({ weddingId, canViewBudget = true }: { weddingId: bigint; canViewBudget?: boolean }) {
  const { identity } = useSpacetimeDB();
  const [members] = useTable(tables.member);
  const [view, setView] = useState<View>('calendar');
  const [weddings] = useTable(tables.wedding);
  const [events] = useTable(tables.event);
  const wedding = weddings.find(row => row.id === weddingId);
  const weddingEvents = events.filter(row => row.weddingId === weddingId);
  const membership = members.find(member => member.weddingId === weddingId && member.identity.toHexString() === identity?.toHexString());
  const canManageTimeline = membership?.role === 'couple' || membership?.role === 'planner';
  const items: Record<Exclude<View, 'budget'>, React.ReactNode> = {
    calendar: <CalendarItinerary weddingId={weddingId} wedding={wedding} events={weddingEvents} canManage={canManageTimeline} />,
    events: <EventWorkspace weddingId={weddingId} />,
    menus: <MenuWorkspace weddingId={weddingId} />,
    guests: <ContactImport weddingId={weddingId} />,
    mood: <MoodBoard weddingId={weddingId} />,
    connect: <ConnectWedding weddingId={weddingId}/>,
  };
  const visibleSections = canViewBudget ? weddingSections : weddingSections.filter(section => section.key !== 'budget');
  const selected = visibleSections.find(section => section.key === view) ?? visibleSections[0];
  const SectionIcon = selected.icon;
  return <div className="wedding-workspace"><header className="wedding-workspace-header"><p className="eyebrow">{wedding ? `${wedding.brideName} & ${wedding.groomName} · ${wedding.city}` : 'Your shared plan'}</p><div className="wedding-workspace-title"><h1 className="headline">Plan the wedding, together</h1><p>Start with what matters today. Every update stays visible to the people planning with you.</p></div></header><nav className="wedding-section-nav" aria-label="Wedding planning sections">{visibleSections.map(section => { const Icon = section.icon; return <button className={view === section.key ? 'active' : ''} key={section.key} onClick={() => setView(section.key)} aria-current={view === section.key ? 'page' : undefined}><Icon size={18}/><span><b>{section.label}</b><small>{section.hint}</small></span></button>; })}</nav><div className="wedding-section-context"><SectionIcon size={17}/><div><b>{selected.label}</b><span>{selected.hint}</span></div></div>{view === 'budget' && canViewBudget ? <BudgetWorkspace weddingId={weddingId} /> : items[selected.key as Exclude<View, 'budget'>]}</div>;
}
