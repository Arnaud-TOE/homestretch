// What the server adds to every model call: its instructions, and only the options a current model
// accepts. Kept apart from the route so the tests can pin it down.

export const DEFAULT_MODEL = 'gpt-5.4-mini';

// Bounds the cost of one call, whatever the browser asks for.
const MAX_COMPLETION_TOKENS = 6000;
// Low reasoning costs about half as much per answer; the tools check every rule, so the model needn't.
const REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT || 'low';

export const BUDGET_USED_UP =
  "The demo's AI budget has run out for now, so I can't answer. You can still drag shifts by hand and pay finished ones, and the demo video shows the assistant at work.";

export const SCHEDULING_INSTRUCTIONS = `You are the scheduling assistant in Homestretch, for the owner of a small catering company. You drive the
schedule on screen; the owner watches each change happen.

How to work:
- Use your scheduling tools (checkSchedule, addJob, fillOpenShifts, reportAbsence, whoCanTake, moveShift, pinShift). They enforce the rules: skills,
  time people have blocked, overlaps, 10 hours of rest and weekly hour limits. Never claim something is valid unless a tool said so.
- When someone is out, call reportAbsence and let it find the smallest repair. Report how many shifts moved and how many stayed.
- If a shift can't be filled, say so and give the reasons the tool returned. Don't suggest breaking a rule without saying that you are.
- Never move a pinned shift. If a pinned shift is in the way, tell the owner and let them decide.

Money:
- You can't pay anyone. Only the owner can, by pressing "Approve and pay". listReadyToPay tells you what is waiting. Never say someone has been
  paid unless a tool said so.

Style: short and plain. Name people and jobs, not ids. Dates are in the schedule's own time; today is given by checkSchedule.`;

// All the model is offered. Bryntum's panel also brings its own general tools, such as "update any shift"
// or "delete shifts", which would go around the rules, so the server keeps only these: ours, and the
// panel's tools for asking a question, filtering, highlighting and scrolling.
export const ALLOWED_TOOLS = new Set([
  'checkSchedule',
  'addJob',
  'fillOpenShifts',
  'reportAbsence',
  'whoCanTake',
  'moveShift',
  'pinShift',
  'listReadyToPay',
  'askUser',
  'filterShifts',
  'unfilterShifts',
  'highlightShifts',
  'unhighlightAll',
  'scrollToDate',
]);

type ChatMessage = { role: string; content?: unknown };
type Tool = { type?: string; function?: { name?: string }; name?: string };
const toolName = (tool: Tool) => tool.function?.name ?? tool.name ?? '';

/**
 * The request to send upstream. Current models take `max_completion_tokens` and only their default
 * temperature, so what Bryntum's plugin sets for older ones is left out. The browser can't choose
 * a costlier model.
 */
export function shapeForModel(body: { messages: ChatMessage[]; tools?: Tool[]; tool_choice?: unknown }, model: string, instructions: string) {
  const [first, ...rest] = body.messages;
  const messages =
    first?.role === 'system'
      ? [{ ...first, content: `${instructions}\n\n${typeof first.content === 'string' ? first.content : ''}` }, ...rest]
      : [{ role: 'system', content: instructions }, ...body.messages];
  return {
    model,
    messages,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    reasoning_effort: REASONING_EFFORT,
    ...(Array.isArray(body.tools) ? { tools: body.tools.filter((tool) => ALLOWED_TOOLS.has(toolName(tool))) } : {}),
    ...(body.tool_choice ? { tool_choice: body.tool_choice } : {}),
  };
}

/** A message for the chat panel, in the shape of a model's answer: the panel shows a failed request only as "(failed)". */
export const assistantSays = (content: string) => ({
  id: 'homestretch-notice',
  object: 'chat.completion',
  choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }],
});

type ModelAnswer = { choices?: { finish_reason?: string; message?: { content?: string | null; tool_calls?: Tool[] } }[] };

/** Holds a model to the tools it was offered: a call to anything else never reaches the browser. */
export function dropForbiddenCalls<T extends ModelAnswer>(answer: T): T {
  for (const choice of answer.choices ?? []) {
    const calls = choice.message?.tool_calls;
    if (!choice.message || !calls) continue;
    const allowed = calls.filter((call) => ALLOWED_TOOLS.has(toolName(call)));
    if (allowed.length === calls.length) continue;
    if (allowed.length > 0) {
      choice.message.tool_calls = allowed;
    } else {
      delete choice.message.tool_calls;
      choice.message.content = choice.message.content || "I can't do that from here. I can staff shifts, repair the schedule and list what is waiting for approval.";
      choice.finish_reason = 'stop';
    }
  }
  return answer;
}
