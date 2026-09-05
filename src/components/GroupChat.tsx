import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, Users, X } from 'lucide-react';
import { Timestamp } from 'spacetimedb';
import { reducers, tables } from '../module_bindings';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';

function messageTime(value: { microsSinceUnixEpoch: bigint }) {
  return new Date(Number(value.microsSinceUnixEpoch / 1000n)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
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
  const [command, setCommand] = useState<'remind' | 'followup' | 'poll' | null>(null);
  const [targetHex, setTargetHex] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const endRef = useRef<HTMLDivElement>(null);
  const myHex = identity?.toHexString();
  const chatMessages = useMemo(() => messages.filter(message => message.weddingId === weddingId).sort((a, b) => Number(a.sentAt.microsSinceUnixEpoch - b.sentAt.microsSinceUnixEpoch)), [messages, weddingId]);
  const memberCount = members.filter(member => member.weddingId === weddingId).length;
  const weddingMembers = useMemo(() => members.filter(member => member.weddingId === weddingId).map(member => participants.find(person => person.identity.equals(member.identity))).filter((person): person is NonNullable<typeof person> => Boolean(person)), [members, participants, weddingId]);
  const coordinatorEnabled = agents.some(agent => agent.weddingId === weddingId && agent.kind === 'coordinator' && agent.enabled);
  const openCoordinatorRequests = coordinatorRequests.filter(request => request.weddingId === weddingId && request.status === 'open').length;

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
        const target = weddingMembers.find(person => person.identity.toHexString() === targetHex);
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

  const selectCommand = (kind: 'remind' | 'followup' | 'poll') => {
    setCommand(kind);
    setDraft('');
    setSendError(null);
  };

  const panel = <section className={`group-chat ${embedded ? 'group-chat--embedded' : ''}`} role={embedded ? undefined : 'dialog'} aria-modal={embedded ? undefined : true} aria-labelledby="group-chat-title" onClick={event => event.stopPropagation()}>
      <header className="group-chat-header">
        <span className="group-chat-mark"><MessageCircle size={20} /></span>
        <div><h2 id="group-chat-title">Wedding group</h2><p><Users size={13} /> {memberCount} {memberCount === 1 ? 'member' : 'members'}</p></div>
        {!embedded && <button type="button" onClick={onClose} className="group-chat-close" aria-label="Close wedding chat"><X size={19} /></button>}
      </header>
      <div className="group-chat-notice"><Bot size={16} /><span>Your coordinator can read the conversation to prepare drafts. People still confirm every change.</span></div>
      <div className="chat-coordinator-status"><span className="chat-coordinator-avatar"><Bot size={17}/></span><span><b>Coordinator</b><small>{coordinatorEnabled ? `${openCoordinatorRequests} open ${openCoordinatorRequests === 1 ? 'request' : 'requests'} · in-app only` : 'Add this assistant from Wedding → Connect'}</small></span></div>
      <div className="group-chat-messages" aria-live="polite">
        {!messagesReady ? <div className="group-chat-empty"><MessageCircle size={26} /><b>Loading conversation</b><p>Fetching the messages saved to your wedding.</p></div> : chatMessages.length === 0 ? <div className="group-chat-empty"><MessageCircle size={26} /><b>Start the conversation</b><p>Share an update, question, or plan with your wedding group.</p></div> : chatMessages.map(message => {
          const sender = participants.find(person => person.identity.equals(message.sentBy));
          const name = sender?.name ?? 'Wedding member';
          const own = message.sentBy.toHexString() === myHex;
          return <article className={`group-chat-message ${own ? 'own' : ''}`} key={String(message.id)}>
            {!own && <span className="message-avatar" aria-hidden>{initials(name)}</span>}
            <div className="message-bubble">{!own && <b>{name}</b>}<p>{message.body}</p><time>{messageTime(message.sentAt)}</time></div>
          </article>;
        })}
        <div ref={endRef} />
      </div>
      <form className="group-chat-compose" onSubmit={event => { event.preventDefault(); void send(); }}>
        {command && <div className="chat-command-fields"><span className="chat-command-label">/{command}</span>{command === 'poll' ? <>{pollOptions.map((option, index) => <input key={index} value={option} onChange={event => setPollOptions(current => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} placeholder={`Option ${index + 1}`} aria-label={`Poll option ${index + 1}`} />)}<button type="button" onClick={() => setPollOptions(current => [...current, ''])}>Add option</button></> : <><select value={targetHex} onChange={event => setTargetHex(event.target.value)} aria-label="Person to contact"><option value="">Choose a person</option>{weddingMembers.map(person => <option key={person.identity.toHexString()} value={person.identity.toHexString()}>{person.name}</option>)}</select>{command === 'remind' && <input type="datetime-local" value={remindAt} onChange={event => setRemindAt(event.target.value)} aria-label="Reminder time (optional)" />}</>}</div>}
        {draft === '/' && !command && <div className="chat-command-menu" role="listbox" aria-label="Coordinator commands"><button type="button" onClick={() => selectCommand('remind')}><b>/remind</b><span>Ask the coordinator to remind someone</span></button><button type="button" onClick={() => selectCommand('followup')}><b>/followup</b><span>Ask the coordinator to follow up with someone</span></button><button type="button" onClick={() => selectCommand('poll')}><b>/poll</b><span>Ask the group to vote on a choice</span></button></div>}
        <input value={draft} onChange={event => { setDraft(event.target.value); setSendError(null); }} maxLength={2000} placeholder={command ? command === 'poll' ? 'What should the group vote on?' : command === 'remind' ? 'What should the coordinator remind them about?' : 'What should the coordinator follow up about?' : 'Message the wedding group — type / for coordinator help'} aria-label={command ? 'Coordinator request' : 'Message the wedding group'} autoFocus />
        <button type="submit" disabled={!draft.trim() || isSending || !isActive} aria-label="Send message"><Send size={18} /></button>
        {command && <p className="chat-command-note">{command === 'poll' ? 'This creates a group poll. A person makes the final call after voting.' : 'This saves a request for the coordinator. It will only contact this person about their open item.'}</p>}
        {sendError && <p className="group-chat-send-error" role="alert">{sendError}</p>}
      </form>
    </section>;

  return embedded ? panel : <div className="chat-backdrop" onClick={onClose}>{panel}</div>;
}
