import { useMemo } from 'react';
import { Timestamp } from 'spacetimedb';
import { reducers, tables } from '../module_bindings';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import { CheckCircle2, MessageCircle, Sparkles } from 'lucide-react';

const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

function eventDate(dateLabel?: string) {
  if (!dateLabel) return undefined;
  const value = new Date(dateLabel);
  return Number.isNaN(value.getTime()) ? undefined : value;
}

function daysUntil(date?: Date) {
  if (!date) return undefined;
  return Math.ceil((date.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
}

function shortDate(value?: Timestamp) {
  if (!value) return 'Date to confirm';
  return new Date(Number(value.microsSinceUnixEpoch / 1000n)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function TodayTab({ onNavigate, onOpenChat, onOpenAssistant, weddingId }: { onNavigate: (tab: 'decide' | 'tasks') => void; onOpenChat: () => void; onOpenAssistant: () => void; weddingId: bigint }) {
  const { identity } = useSpacetimeDB();
  const [tasks] = useTable(tables.task);
  const [decisions] = useTable(tables.decision);
  const [votes] = useTable(tables.vote);
  const [participants] = useTable(tables.participant);
  const [events] = useTable(tables.event);
  const [budgets] = useTable(tables.budget);
  const [expenses] = useTable(tables.expense);
  const [ingestSources] = useTable(tables.ingestSource);
  const [messages] = useTable(tables.weddingMessage);
  const [weddings] = useTable(tables.wedding);
  const toggleTask = useReducer(reducers.toggleTask);
  const myHex = identity?.toHexString();
  const me = participants.find(person => person.identity.toHexString() === myHex);
  const wedding = weddings.find(row => row.id === weddingId);
  const weddingTasks = tasks.filter(task => task.weddingId === weddingId);
  const myOpenTasks = weddingTasks.filter(task => task.ownerIdentity.toHexString() === myHex && !task.done);
  const completedTasks = weddingTasks.filter(task => task.done).sort((a, b) => Number(b.id - a.id)).slice(0, 6);
  const openDecisions = decisions.filter(decision => decision.weddingId === weddingId && decision.lockedOptionId === undefined);
  const votedOn = new Set(votes.filter(vote => vote.voterIdentity.toHexString() === myHex).map(vote => vote.decisionId));
  const needsMyVote = openDecisions.filter(decision => !votedOn.has(decision.id));
  const needsMyLock = openDecisions.filter(decision => decision.deciderIdentity?.toHexString() === myHex);
  const weddingEvents = events.filter(event => event.weddingId === weddingId).sort((a, b) => Number((a.startsAt?.microsSinceUnixEpoch ?? 0n) - (b.startsAt?.microsSinceUnixEpoch ?? 0n))).slice(0, 3);
  const weddingExpenses = expenses.filter(expense => expense.weddingId === weddingId && expense.state === 'confirmed');
  const spend = weddingExpenses.reduce((sum, expense) => sum + Number(expense.amountPaise) / 100, 0);
  const budget = budgets.find(item => item.weddingId === weddingId);
  const budgetTarget = budget ? Number(budget.amountPaise) / 100 : 0;
  const exactDate = eventDate(wedding?.dateLabel);
  const countdown = daysUntil(exactDate);
  const sourceCount = ingestSources.filter(source => source.weddingId === weddingId && source.status === 'awaiting_upload').length;
  const chat = useMemo(() => messages.filter(item => item.weddingId === weddingId).sort((a, b) => Number(b.sentAt.microsSinceUnixEpoch - a.sentAt.microsSinceUnixEpoch)), [messages, weddingId]);
  const actionItems = [
    ...needsMyLock.map(item => ({ key: `lock-${item.id}`, tone: 'marigold', title: `Make the final call: ${item.title}`, detail: 'This decision is waiting for you', onClick: () => onNavigate('decide') })),
    ...needsMyVote.map(item => ({ key: `vote-${item.id}`, tone: 'jade', title: `Vote on ${item.title}`, detail: 'Your input is needed', onClick: () => onNavigate('decide') })),
    ...myOpenTasks.map(item => ({ key: `task-${item.id}`, tone: 'mist', title: item.title, detail: `Due ${shortDate(item.dueAt)}`, onClick: () => toggleTask({ taskId: item.id }) })),
  ].slice(0, 3);

  return <div className="today-dashboard">
    <section className="dashboard-hero">
      <div className="dashboard-welcome"><span className="dashboard-mark" aria-hidden /><p>{exactDate ? `Wedding day, ${exactDate.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}` : wedding?.dateLabel ?? 'Wedding date to confirm'}</p><h1>Good morning, {me?.name?.split(' ')[0] ?? 'there'}</h1></div>
      <div className="today-hero-actions"><button type="button" className="contextual-assistant-button" onClick={onOpenAssistant}><Sparkles size={16}/> Ask coordinator</button><div className="countdown-cards"><div><b>{countdown === undefined ? '—' : Math.max(0, countdown)}</b><span>days</span></div><div><b>{weddingEvents.length}</b><span>events</span></div><div><b>{weddingTasks.length}</b><span>in the plan</span></div></div></div>
    </section>
    <section className="dashboard-metrics" aria-label="Wedding metrics"><div><span>Open work</span><b>{weddingTasks.filter(task => !task.done).length}</b><small>{myOpenTasks.length ? `${myOpenTasks.length} assigned to you` : 'Nothing assigned to you'}</small></div><div><span>Budget planned</span><b>{fmt.format(spend)}</b><small>{budgetTarget ? `${fmt.format(Math.max(0, budgetTarget - spend))} remaining` : weddingExpenses.length ? `${weddingExpenses.length} confirmed lines` : 'Set a budget in Wedding'}</small></div><div><span>Open decisions</span><b>{openDecisions.length}</b><small>{needsMyLock.length ? `${needsMyLock.length} waiting on you` : needsMyVote.length ? `${needsMyVote.length} need your vote` : 'All caught up'}</small></div><div><span>Sources waiting</span><b>{sourceCount}</b><small>Exports and quotes to add</small></div></section>
    <section className="dashboard-workspace">
      <div className="dashboard-column"><div className="dashboard-section-heading"><h2>Your turn</h2><p>Only the things you can move forward.</p></div>{actionItems.length ? <div className="action-list">{actionItems.map(item => <button className="dashboard-action" type="button" key={String(item.key)} onClick={item.onClick}><span className={`action-mark ${item.tone}`} /><span className="dashboard-action-copy"><b>{item.title}</b><small>{item.detail}</small></span></button>)}</div> : <div className="dashboard-empty"><CheckCircle2 size={22}/><p>You are clear for now. New work will appear here when it needs you.</p></div>}
        {completedTasks.length > 0 && <section className="completed-actions"><div className="dashboard-section-heading"><div><p className="section-label">Completed work</p><h2>Action items done</h2></div><CheckCircle2 size={21}/></div><div>{completedTasks.map(task => { const owner = participants.find(person => person.identity.equals(task.ownerIdentity)); return <article key={String(task.id)}><CheckCircle2 size={17}/><span><b>{task.title}</b><small>Completed by {owner?.name ?? 'Wedding member'}</small></span></article>; })}</div></section>}
        <section className="dashboard-chat"><div className="dashboard-section-heading"><div><p className="section-label">Wedding chat</p><h2>Keep the group close</h2></div><MessageCircle size={21}/></div><p>{chat.length ? `${chat.length} ${chat.length === 1 ? 'message' : 'messages'} in the group conversation.` : 'Share an update with everyone in the wedding.'}</p><button type="button" className="open-chat-button" onClick={onOpenChat}>Open wedding chat <MessageCircle size={17}/></button></section>
      </div>
      <div className="dashboard-column"><div className="dashboard-section-heading"><h2>The next days</h2><p>What is coming up across the wedding.</p></div><div className="event-list">{weddingEvents.length ? weddingEvents.map(event => <article key={String(event.id)}><time>{shortDate(event.startsAt)}</time><span className="event-list-copy"><b>{event.title}</b><p>{event.venue ?? 'Venue to confirm'}{event.state === 'reported' ? ' · draft' : ''}</p></span></article>) : <div className="dashboard-empty"><CheckCircle2 size={22}/><p>Add a calendar export or event details to see the schedule here.</p></div>}</div><div className="since-yesterday"><b>Since the last update</b>{chat.length ? chat.slice(0, 3).map(item => { const sender = participants.find(person => person.identity.equals(item.sentBy)); return <p key={String(item.id)}><strong>{sender?.name ?? 'Wedding member'}</strong> {item.body}</p>; }) : <p>No updates yet. Your group chat will keep the family in the loop.</p>}</div></div>
    </section>
  </div>;
}
