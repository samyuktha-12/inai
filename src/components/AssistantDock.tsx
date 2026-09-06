import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Bot, Send, Sparkles, X } from 'lucide-react';
import { reducers, tables } from '../module_bindings';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import '../assistant-dock.css';

type Screen = 'Today' | 'Decide' | 'Wedding';

const builtInNames: Record<string, string> = {
  coordinator: 'Coordinator',
  decision: 'Decision helper',
  guest_logistics: 'Guest logistics',
  vendor_liaison: 'Vendor helper',
  menu_planner: 'Menu planner',
};

export default function AssistantDock({ weddingId, screen, initialAgentId, onClose }: { weddingId: bigint; screen: Screen; initialAgentId?: string; onClose: () => void }) {
  const { identity, isActive } = useSpacetimeDB();
  const [agents] = useTable(tables.weddingAgent);
  const [customAgents] = useTable(tables.customWeddingAgent);
  const requestCoordinatorAction = useReducer(reducers.requestCoordinatorAction);
  const [selected, setSelected] = useState('coordinator');
  const [request, setRequest] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const available = useMemo(() => [
    ...agents.filter(agent => agent.weddingId === weddingId && agent.enabled).map(agent => ({ id: `built-in:${agent.kind}`, label: builtInNames[agent.kind] ?? agent.kind, brief: 'Built-in assistant' })),
    ...customAgents.filter(agent => agent.weddingId === weddingId && agent.enabled).map(agent => ({ id: `custom:${agent.id}`, label: agent.name, brief: 'Custom assistant' })),
  ], [agents, customAgents, weddingId]);
  useEffect(() => {
    if (initialAgentId && available.some(agent => agent.id === initialAgentId)) setSelected(initialAgentId);
  }, [available, initialAgentId]);
  const chosen = available.find(agent => agent.id === selected) ?? available[0];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!identity || !chosen || !request.trim()) return;
    if (!isActive) { setError('Reconnecting to your wedding. Try again in a moment.'); return; }
    setSaving(true); setError('');
    try {
      await requestCoordinatorAction({
        weddingId,
        kind: 'summarize',
        targetIdentity: identity,
        instruction: `[Assistant: ${chosen.label}] [Screen: ${screen}] ${request.trim()}`,
        scheduledFor: undefined,
      });
      setRequest('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The assistant request could not be saved.');
    } finally { setSaving(false); }
  };

  return <aside id="wedding-assistants" className="assistant-dock" aria-label="Wedding assistants">
    <header><span><Sparkles size={16}/></span><div><p>Wedding assistants</p><h2>Get a draft</h2></div><button type="button" onClick={onClose} aria-label="Close assistants"><X size={17}/></button></header>
    {available.length ? <form onSubmit={event => void submit(event)}>
      <label>Assistant<select value={chosen?.id ?? ''} onChange={event => setSelected(event.target.value)}>{available.map(agent => <option key={agent.id} value={agent.id}>{agent.label}</option>)}</select></label>
      <p className="assistant-dock-brief"><Bot size={14}/>{chosen?.brief} · ready on {screen}</p>
      <label>What should it prepare?<textarea value={request} onChange={event => setRequest(event.target.value)} maxLength={2000} placeholder={`For example: Summarise what needs attention in ${screen.toLowerCase()}.`} autoFocus /></label>
      <p className="assistant-dock-note">It creates a reviewable draft only. People still make every decision and commitment.</p>
      <button className="primary-button" type="submit" disabled={!request.trim() || saving || !isActive}><Send size={16}/>{saving ? 'Saving request…' : 'Prepare draft'}</button>
      {error && <p className="assistant-dock-error" role="alert">{error}</p>}
    </form> : <div className="assistant-dock-empty"><Bot size={22}/><b>Add an assistant first</b><p>Set up an assistant in Wedding → Set up, then it will be ready across the app.</p></div>}
  </aside>;
}
