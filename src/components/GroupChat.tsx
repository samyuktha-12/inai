import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, Sparkles, Users, X } from 'lucide-react';
import { Timestamp } from 'spacetimedb';
import { reducers, tables } from '../module_bindings';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import '../chat.css';
import '../chat-alignment.css';
import '../chat-received.css';
import '../chat-commands.css';
import '../chat-poll.css';
import '../chat-groups.css';
import '../chat-layout.css';
import '../chat-message-rhythm.css';
import '../reminder-schedule.css';

const visualGroups = [
  { id: 'family', label: 'Family group', detail: 'Everyone planning together' },
  { id: 'bride', label: 'Bride’s side', detail: 'A private planning circle' },
  { id: 'groom', label: 'Groom’s side', detail: 'A private planning circle' },
  { id: 'sangeet', label: 'Sangeet team', detail: 'A private planning circle' },
] as const;

type VisualGroupId = typeof visualGroups[number]['id'];

function messageTime(value: { microsSinceUnixEpoch: bigint }) {
  return new Date(Number(value.microsSinceUnixEpoch / 1000n)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function messageDay(value: { microsSinceUnixEpoch: bigint }) {
  return new Date(Number(value.microsSinceUnixEpoch / 1000n)).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function ReminderSchedule({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const parsed = value ? new Date(value) : undefined;
  const today = new Date();
  const year = parsed?.getFullYear();
  const month = parsed?.getMonth();
  const day = parsed?.getDate();
  const time = value ? value.slice(11, 16) : '';
  const update = (next: Partial<{ year: number; month: number; day: number; time: string }>) => {
    const nextYear = next.year ?? year ?? today.getFullYear();
    const nextMonth = next.month ?? month ?? today.getMonth();
    const maxDay = new Date(nextYear, nextMonth + 1, 0).getDate();
    const nextDay = Math.min(next.day ?? day ?? today.getDate(), maxDay);
    onChange(`${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}T${(next.time ?? time) || '09:00'}`);
  };
  return <fieldset className="reminder-schedule"><legend>When <span>optional</span></legend><div><select value={month ?? ''} onChange={event => update({ month: Number(event.target.value) })} aria-label="Reminder month"><option value="" disabled>Month</option>{Array.from({ length: 12 }, (_, index) => <option value={index} key={index}>{new Date(2026, index, 1).toLocaleString(undefined, { month: 'short' })}</option>)}</select><select value={day ?? ''} onChange={event => update({ day: Number(event.target.value) })} aria-label="Reminder day"><option value="" disabled>Day</option>{Array.from({ length: new Date(year ?? today.getFullYear(), (month ?? today.getMonth()) + 1, 0).getDate() }, (_, index) => <option value={index + 1} key={index}>{index + 1}</option>)}</select><select value={year ?? ''} onChange={event => update({ year: Number(event.target.value) })} aria-label="Reminder year"><option value="" disabled>Year</option>{Array.from({ length: 6 }, (_, index) => <option value={today.getFullYear() + index} key={index}>{today.getFullYear() + index}</option>)}</select><input type="time" value={time} onChange={event => update({ time: event.target.value })} aria-label="Reminder time" /></div></fieldset>;
}

export default function GroupChat({ weddingId, onClose, embedded = false }: { weddingId: bigint; onClose?: () => void; embedded?: boolean }) {
  const { identity, isActive } = useSpacetimeDB();
  const [messages, messagesReady] = useTable(tables.weddingMessage);
  const [participants] = useTable(tables.participant);
  const [members] = useTable(tables.member);
  const [agents] = useTable(tables.weddingAgent);
  const [coordinatorRequests] = useTable(tables.coordinatorRequest);
  const sendWeddingMessage = useReducer(reducers.sendWeddingMessage);
  const requestCoordinatorAction = useReducer(reducers.requestCoordinatorAction);
  const createDecision = useReducer(reducers.createDecision);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [command, setCommand] = useState<'remind' | 'followup' | 'summarize' | 'poll' | null>(null);
  const [targetHex, setTargetHex] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [activeGroup, setActiveGroup] = useState<VisualGroupId>('family');
  const endRef = useRef<HTMLDivElement>(null);
  const myHex = identity?.toHexString();
  const chatMessages = useMemo(() => messages.filter(message => message.weddingId === weddingId).sort((a, b) => Number(a.sentAt.microsSinceUnixEpoch - b.sentAt.microsSinceUnixEpoch)), [messages, weddingId]);
  const memberCount = members.filter(member => member.weddingId === weddingId).length;
  const weddingMembers = useMemo(() => members.filter(member => member.weddingId === weddingId).map(member => participants.find(person => person.identity.equals(member.identity))).filter((person): person is NonNullable<typeof person> => Boolean(person)), [members, participants, weddingId]);
  const coordinatorEnabled = agents.some(agent => agent.weddingId === weddingId && agent.kind === 'coordinator' && agent.enabled);
  const openCoordinatorRequests = coordinatorRequests.filter(request => request.weddingId === weddingId && request.status === 'open').length;
  const selectedGroup = visualGroups.find(group => group.id === activeGroup)!;
  const isGroupPreview = activeGroup !== 'family';

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [chatMessages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    if (!isActive) {
      setSendError('Reconnecting to your wedding. Your message has not been sent yet.');
      return;
    }

    setSendError(null);
    setIsSending(true);
    try {
      if (command === 'poll') {
        const options = pollOptions.map(option => option.trim()).filter(Boolean);
        if (options.length < 2) throw new Error('Add at least two poll options.');
        await createDecision({ weddingId, title: body, options });
        setCommand(null);
        setPollOptions(['', '']);
      } else if (command) {
        const target = command === 'summarize'
          ? weddingMembers.find(person => person.identity.toHexString() === myHex)
          : weddingMembers.find(person => person.identity.toHexString() === targetHex);
        if (!target) throw new Error('Choose who the coordinator should contact.');
        const scheduledFor = command === 'remind' && remindAt
          ? new Timestamp(BigInt(new Date(remindAt).getTime()) * 1000n)
          : undefined;
        await requestCoordinatorAction({ weddingId, kind: command, targetIdentity: target.identity, instruction: body, scheduledFor });
        setCommand(null);
        setTargetHex('');
        setRemindAt('');
      } else {
        await sendWeddingMessage({ weddingId, body });
      }
      setDraft('');
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Your message could not be sent. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const selectCommand = (kind: 'remind' | 'followup' | 'summarize' | 'poll') => {
    setCommand(kind);
    setDraft(kind === 'summarize' ? 'Summarise the family conversation: confirmed updates, items to review, and next steps.' : '');
    setSendError(null);
  };

  const panel = <section className={`group-chat ${embedded ? 'group-chat--embedded' : ''}`} role={embedded ? undefined : 'dialog'} aria-modal={embedded ? undefined : true} aria-labelledby="group-chat-title" onClick={event => event.stopPropagation()}>
      <header className="group-chat-header">
        <span className="group-chat-mark"><MessageCircle size={19} /></span>
        <div><p className="group-chat-eyebrow">Family space</p><h2 id="group-chat-title">The wedding conversation</h2><p><Users size={13} /> {memberCount} {memberCount === 1 ? 'person' : 'people'} planning together</p></div>
        {!embedded && <button type="button" onClick={onClose} className="group-chat-close" aria-label="Close wedding chat"><X size={19} /></button>}
      </header>
      <div className="chat-group-switcher" aria-label="Planning groups">{visualGroups.map(group => <button type="button" className={activeGroup === group.id ? 'active' : ''} key={group.id} onClick={() => setActiveGroup(group.id)}><b>{group.label}</b><small>{group.id === 'family' ? `${memberCount} people` : 'Preview'}</small></button>)}</div>
      <div className="chat-coordinator-status"><span className="chat-coordinator-avatar"><Sparkles size={15}/></span><span><b>{isGroupPreview ? `${selectedGroup.label} is ready to set up` : 'Inai is listening for planning details'}</b><small>{isGroupPreview ? 'This visual preview does not create a private group or save messages yet.' : coordinatorEnabled ? `${openCoordinatorRequests} open ${openCoordinatorRequests === 1 ? 'request' : 'requests'} · it only prepares drafts for review` : 'Add the coordinator in Wedding → Connect when you want a hand'}</small></span></div>
      <div className="group-chat-messages" aria-live="polite">
        {isGroupPreview ? <div className="group-chat-empty group-preview"><Users size={26}/><b>{selectedGroup.label}</b><p>{selectedGroup.detail}. We will connect this to secure group membership when the backend is ready.</p></div> : !messagesReady ? <div className="group-chat-empty"><MessageCircle size={26} /><b>Loading your conversation</b><p>Bringing the family’s planning notes together.</p></div> : chatMessages.length === 0 ? <div className="group-chat-empty"><MessageCircle size={26} /><b>Start where you are</b><p>Share an update, a question, or something the family should see.</p></div> : chatMessages.map((message, index) => {
          const sender = participants.find(person => person.identity.equals(message.sentBy));
          const name = sender?.name ?? 'Wedding member';
          const own = message.sentBy.toHexString() === myHex;
          const previous = chatMessages[index - 1];
          const newDay = !previous || messageDay(previous.sentAt) !== messageDay(message.sentAt);
          const hasGap = !!previous && Number(message.sentAt.microsSinceUnixEpoch - previous.sentAt.microsSinceUnixEpoch) > 5 * 60 * 1_000_000;
          return <div key={String(message.id)}>{newDay && <p className="chat-day"><span>{messageDay(message.sentAt)}</span></p>}{hasGap && !newDay && <p className="chat-gap"><span>{messageTime(message.sentAt)}</span></p>}<article className={`group-chat-message ${own ? 'own' : ''} ${hasGap && !newDay ? 'spaced' : ''}`}>
            {!own && <span className="message-avatar" aria-hidden>{initials(name)}</span>}
            <div className="message-bubble">{!own && <b>{name}</b>}{message.source === 'whatsapp' && <small className="imported-message-label">WhatsApp import · needs review</small>}{message.source === 'voice_call' && <small className="imported-message-label">Call note · needs review</small>}<p>{message.body}</p><time>{messageTime(message.sentAt)}</time></div>
          </article></div>;
        })}
        <div ref={endRef} />
      </div>
      {!isGroupPreview && <form className="group-chat-compose" onSubmit={event => { event.preventDefault(); void send(); }}>
        {command === 'poll' ? <div className="chat-poll-builder"><div className="chat-poll-heading"><span className="chat-command-label">Poll for the family</span><button type="button" onClick={() => { setCommand(null); setPollOptions(['', '']); setDraft(''); }}>Cancel</button></div><label>Question<input value={draft} onChange={event => { setDraft(event.target.value); setSendError(null); }} maxLength={300} placeholder="What should the group vote on?" aria-label="Poll question" autoFocus /></label><div className="chat-poll-options"><span>Options</span>{pollOptions.map((option, index) => <input key={index} value={option} onChange={event => setPollOptions(current => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} placeholder={`Option ${index + 1}`} aria-label={`Option ${index + 1}`} />)}</div><button className="chat-add-option" type="button" onClick={() => setPollOptions(current => [...current, ''])}>+ Add another option</button><div className="chat-poll-footer"><p>This opens a poll for the group. A person still makes the final call.</p><button className="chat-create-poll" type="submit" disabled={!draft.trim() || isSending || !isActive}>Create poll</button></div></div> : <>{command && <div className="chat-command-fields"><span className="chat-command-label">/{command}</span>{command !== 'summarize' && <select value={targetHex} onChange={event => setTargetHex(event.target.value)} aria-label="Person to contact"><option value="">Choose a person</option>{weddingMembers.map(person => <option key={person.identity.toHexString()} value={person.identity.toHexString()}>{person.name}</option>)}</select>}{command === 'remind' && <ReminderSchedule value={remindAt} onChange={setRemindAt} />}<button className="chat-command-cancel" type="button" onClick={() => { setCommand(null); setTargetHex(''); setRemindAt(''); setDraft(''); setSendError(null); }}>Cancel</button></div>}{draft === '/' && !command && <div className="chat-command-menu" role="listbox" aria-label="Coordinator commands"><button type="button" onClick={() => selectCommand('remind')}><b>/remind</b><span>Ask the coordinator to remind someone</span></button><button type="button" onClick={() => selectCommand('followup')}><b>/followup</b><span>Ask the coordinator to follow up with someone</span></button><button type="button" onClick={() => selectCommand('summarize')}><b>/summarize</b><span>Prepare a reviewable summary of this chat</span></button><button type="button" onClick={() => selectCommand('poll')}><b>/poll</b><span>Ask the group to vote on a choice</span></button></div>}<input value={draft} onChange={event => { setDraft(event.target.value); setSendError(null); }} maxLength={2000} placeholder={command ? command === 'remind' ? 'What should the coordinator remind them about?' : command === 'followup' ? 'What should the coordinator follow up about?' : 'What should the summary cover?' : 'Write an update for the family'} aria-label={command ? 'Coordinator request' : 'Message the wedding group'} autoFocus /><button type="submit" disabled={!draft.trim() || isSending || !isActive} aria-label="Send message"><Send size={18} /></button>{command && <p className="chat-command-note">{command === 'summarize' ? 'This creates a reviewable draft. It does not change your wedding plan.' : 'This saves a request for the coordinator. It will only contact this person about their open item.'}</p>}</>}
        {sendError && <p className="group-chat-send-error" role="alert">{sendError}</p>}
      </form>}
    </section>;

  return embedded ? panel : <div className="chat-backdrop" onClick={onClose}>{panel}</div>;
}
