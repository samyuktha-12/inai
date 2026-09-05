const MAX_INSTRUCTION_LENGTH = 2_000;

type DraftRequest = {
  ownerName?: unknown;
  kind?: unknown;
  instruction?: unknown;
  scheduledFor?: unknown;
};

function error(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export const maxDuration = 30;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return error('The Coordinator is not configured yet.', 503);

  let body: DraftRequest;
  try {
    body = await request.json();
  } catch {
    return error('Send a JSON request.');
  }

  const ownerName = typeof body.ownerName === 'string' ? body.ownerName.trim() : '';
  const kind = body.kind === 'remind' || body.kind === 'followup' ? body.kind : '';
  const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
  const scheduledFor = typeof body.scheduledFor === 'string' ? body.scheduledFor : '';
  if (!ownerName || !kind || !instruction || instruction.length > MAX_INSTRUCTION_LENGTH) {
    return error('Include a person, request type, and a short instruction.');
  }

  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
      instructions: 'You are Inai’s in-app wedding Coordinator. Draft one short, kind note for the named owner about their single open task. Do not claim you contacted anyone, make decisions, commit spending, contact a vendor, or send a message. Return plain text only.',
      input: `Person: ${ownerName}\nRequest: ${kind}\nTask: ${instruction}${scheduledFor ? `\nPlanned reminder time: ${scheduledFor}` : ''}`,
    }),
  });

  if (!upstream.ok) return error('The Coordinator could not prepare a draft. Please try again.', 502);
  const result = await upstream.json() as { output_text?: unknown };
  const draft = typeof result.output_text === 'string' ? result.output_text.trim() : '';
  if (!draft) return error('The Coordinator returned an empty draft.', 502);
  return Response.json({ draft, state: 'reported', needsHumanReview: true });
}
