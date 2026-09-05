export type ParsedEvent = { title: string; venue?: string; startsAt?: Date; confidence: number };
export type ParsedExpense = { label: string; category: string; amountPaise: bigint; confidence: number };
export type ParsedImport = { events: ParsedEvent[]; expenses: ParsedExpense[]; summary: string };

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const money = (value: string) => Math.round(Number(value.replace(/,/g, '')) * 100);

function parseIcs(text: string): ParsedEvent[] {
  return [...text.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)].flatMap(match => {
    const block = match[1];
    const title = clean(block.match(/^SUMMARY(?:;[^:]+)?:([^\r\n]+)/m)?.[1] ?? '');
    const rawDate = block.match(/^DTSTART(?:;[^:]+)?:([0-9]{8}(?:T[0-9]{4,6})?)/m)?.[1];
    if (!title) return [];
    const startsAt = rawDate ? new Date(rawDate.length === 8 ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}T12:00:00` : `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}T${rawDate.slice(9, 11)}:${rawDate.slice(11, 13)}:00`) : undefined;
    return [{ title, venue: clean(block.match(/^LOCATION(?:;[^:]+)?:([^\r\n]+)/m)?.[1] ?? '') || undefined, startsAt: startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : undefined, confidence: 0.9 }];
  });
}

function parseQuotes(text: string, kind: string): ParsedExpense[] {
  return [...text.matchAll(/(?:₹|Rs\.?|INR\s*)([\d,]+(?:\.\d{1,2})?)/gi)].slice(0, 30).map(match => {
    const before = text.slice(Math.max(0, (match.index ?? 0) - 100), match.index).split(/\n|[.!?]/).pop() ?? '';
    return { label: clean(before).replace(/[:\-–]+$/, '') || 'Imported quote amount', category: kind === 'quotes' ? 'Vendor quote' : 'Vendor details', amountPaise: BigInt(money(match[1])), confidence: 0.72 };
  }).filter(item => item.amountPaise > 0n);
}

export function parseImport(kind: string, file: File, text: string): ParsedImport {
  if (kind === 'calendar') {
    const events = parseIcs(text);
    return { events, expenses: [], summary: `${events.length} event${events.length === 1 ? '' : 's'} found` };
  }
  if (kind === 'quotes' || kind === 'vendor_details') {
    const expenses = parseQuotes(text, kind);
    return { events: [], expenses, summary: `${expenses.length} amount${expenses.length === 1 ? '' : 's'} found` };
  }
  if (kind === 'whatsapp') {
    const events = text.split(/\r?\n/).flatMap(line => {
      const match = line.match(/(?:^| - ).*?:\s*(.*\b(?:mehendi|sangeet|haldi|ceremony|reception|wedding)\b.*)/i);
      return match ? [{ title: clean(match[1]).slice(0, 200), confidence: 0.5 }] : [];
    }).slice(0, 15);
    return { events, expenses: [], summary: `${events.length} possible event${events.length === 1 ? '' : 's'} found` };
  }
  if (kind === 'guests') {
    const rows = text.trim().split(/\r?\n/).filter(Boolean);
    return { events: [], expenses: [], summary: `${Math.max(0, rows.length - 1)} guest${rows.length === 2 ? '' : 's'} read for review` };
  }
  const images = file.type.startsWith('image/') ? 1 : 0;
  return { events: [], expenses: [], summary: images ? '1 image added for mood review' : 'Source added for review' };
}
