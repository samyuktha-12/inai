import { useState } from 'react';
import { FileText, MessageCircle, Pin, Users } from 'lucide-react';
import { reducers } from '../module_bindings';
import { useReducer } from 'spacetimedb/react';

export type NewWeddingPlan = {
  primaryName: string;
  partnerName: string;
  city: string;
  dateLabel: string;
};

type Props = { onComplete: (plan: NewWeddingPlan) => void };

const sources = [
  ['pinterest', 'Pinterest board', 'Turn your pins into choices', Pin],
  ['whatsapp', 'WhatsApp group', "Export the chat, we'll read it", MessageCircle],
  ['guests', 'Guest list', 'A sheet or your contacts', Users],
  ['quotes', 'Vendor quotes', 'PDFs or photos', FileText],
] as const;

export default function Onboarding({ onComplete }: Props) {
  const createWedding = useReducer(reducers.createWedding);
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [form, setForm] = useState({ primaryName: '', partnerName: '', city: '', dateLabel: '' });
  const [saving, setSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const toggle = (source: string) => setSelected(current => current.includes(source) ? current.filter(x => x !== source) : [...current, source]);
  const submit = () => {
    if (!form.primaryName.trim() || !form.partnerName.trim() || !form.city.trim() || !form.dateLabel.trim()) {
      setShowValidation(true);
      return;
    }
    setSaving(true);
    createWedding({ ...form, sourceKinds: selected });
    // The live wedding subscription is the source of truth; this optimistic
    // transition simply avoids making the first setup moment feel stuck.
    onComplete({
      primaryName: form.primaryName.trim(),
      partnerName: form.partnerName.trim(),
      city: form.city.trim(),
      dateLabel: form.dateLabel.trim(),
    });
  };

  if (step === 3) return <div className="onboard"><p className="setup-progress">Step 3 of 3</p><h1>Here’s what I’ll set up</h1><p className="subtitle">Review and fix anything. Nothing imported is final until you say so.</p><div className="setup-summary"><div className="inai-card"><span className="card-icon">📅</span><span className="card-content"><b>Wedding plan</b><span>{form.city || 'Your city'} · {form.dateLabel || 'Your date'}</span></span></div>{selected.map(source => { const item = sources.find(([id]) => id === source)!; const [, title, copy] = item; return <div className="inai-card" key={source}><span className="card-icon">{source === 'pinterest' ? '📌' : source === 'whatsapp' ? '💬' : source === 'quotes' ? '🧾' : '👥'}</span><span className="card-content"><b>{title}</b><span className="reported-note">{copy} · will be reviewed</span></span><span className="status-pill">Draft</span></div>; })}</div><div className="onboard-footer"><button className="primary-button" disabled={saving} onClick={submit}>{saving ? 'Setting up…' : 'Looks good'}</button></div></div>;

  const canContinue = Object.values(form).every(value => value.trim().length > 0);
  return <div className="onboard">
    <p className="setup-progress">Step {step} of 3</p>
    {step === 1 ? <><h1>Let’s set up the wedding</h1><p className="subtitle">Just the basics. Everything else comes next.</p><div className="onboard-fields">{([['primaryName','Your name','Priya'],['partnerName',"Partner’s name",'Arjun'],['dateLabel','When is it? (a rough date is fine)','December 2026'],['city','City','Chennai']] as const).map(([key,label,placeholder]) => <label key={key}>{label}<input aria-invalid={showValidation && !form[key].trim()} value={form[key]} placeholder={placeholder} onChange={e => { setForm({ ...form, [key]: e.target.value }); setShowValidation(false); }} /></label>)}</div>{showValidation && <p className="form-error">Add these four details to continue.</p>}<div className="onboard-footer"><button className="primary-button" disabled={!canContinue} onClick={() => setStep(2)}>Continue</button></div></> : <><h1>Bring in what you have</h1><p className="subtitle">Choose what you already have. You’ll review every detail before it becomes part of the plan.</p><div>{sources.map(([id,title,copy,Icon]) => <button key={id} aria-pressed={selected.includes(id)} className={`inai-card choice-card ${selected.includes(id) ? 'selected' : ''}`} onClick={() => toggle(id)}><span className="card-icon"><Icon size={21}/></span><span className="card-content"><b>{title}</b><span>{copy}</span></span><span className="selection-mark">{selected.includes(id) ? '✓' : '+'}</span></button>)}</div><div className="onboard-footer"><button className="primary-button" onClick={() => setStep(3)}>Review setup</button><button className="ghost-button" onClick={() => setStep(3)}>Skip for now</button></div></>}
  </div>;
}
