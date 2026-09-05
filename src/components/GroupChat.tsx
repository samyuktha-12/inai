import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, Users, X } from 'lucide-react';
import { reducers, tables } from '../module_bindings';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';

function messageTime(value: { microsSinceUnixEpoch: bigint }) {
  return new Date(Number(value.microsSinceUnixEpoch / 1000n)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

export default function GroupChat({ weddingId, onClose, embedded = false }: { weddingId: bigint; onClose?: () => void; embedded?: boolean }) {
  const { identity } = useSpacetimeDB();
  const [messages] = useTable(tables.weddingMessage);
  const [participants] = useTable(tables.participant);
  const [members] = useTable(tables.member);
  const sendWeddingMessage = useReducer(reducers.sendWeddingMessage);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const myHex = identity?.toHexString();
  const chatMessages = useMemo(() => messages.filter(message => message.weddingId === weddingId).sort((a, b) => Number(a.sentAt.microsSinceUnixEpoch - b.sentAt.microsSinceUnixEpoch)), [messages, weddingId]);
  const memberCount = members.filter(member => member.weddingId === weddingId).length;

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [chatMessages.length]);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    sendWeddingMessage({ weddingId, body });
    setDraft('');
  };

  const panel = <section className={`group-chat ${embedded ? 'group-chat--embedded' : ''}`} role={embedded ? undefined : 'dialog'} aria-modal={embedded ? undefined : true} aria-labelledby="group-chat-title" onClick={event => event.stopPropagation()}>
      <header className="group-chat-header">
        <span className="group-chat-mark"><MessageCircle size={20} /></span>
        <div><h2 id="group-chat-title">Wedding group</h2><p><Users size={13} /> {memberCount} {memberCount === 1 ? 'member' : 'members'}</p></div>
        {!embedded && <button type="button" onClick={onClose} className="group-chat-close" aria-label="Close wedding chat"><X size={19} /></button>}
      </header>
      <div className="group-chat-notice"><Bot size={16} /><span>Your coordinator can read the conversation to prepare drafts. People still confirm every change.</span></div>
      <div className="group-chat-messages" aria-live="polite">
        {chatMessages.length === 0 ? <div className="group-chat-empty"><MessageCircle size={26} /><b>Start the conversation</b><p>Share an update, question, or plan with your wedding group.</p></div> : chatMessages.map(message => {
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
      <form className="group-chat-compose" onSubmit={event => { event.preventDefault(); send(); }}>
        <input value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} placeholder="Message the wedding group" aria-label="Message the wedding group" autoFocus />
        <button type="submit" disabled={!draft.trim()} aria-label="Send message"><Send size={18} /></button>
      </form>
    </section>;

  return embedded ? panel : <div className="chat-backdrop" onClick={onClose}>{panel}</div>;
}
