// Worked examples for the model, in the shape Bryntum's AI panel passes along. They replace the panel's
// defaults, which teach tools this app removes because they would go around the rules.

const ok = (message: string) => JSON.stringify({ ok: true, message });

function call(id: string, name: string, args: object) {
  return { id, type: 'function', function: { name, arguments: JSON.stringify(args) } };
}

export const AGENT_EXAMPLES = [
  [
    { role: 'user', content: 'Staff the Okafor dinner' },
    { role: 'assistant', tool_calls: [call('1', 'fillOpenShifts', { job: 'Okafor' })] },
    {
      role: 'tool',
      tool_call_id: '1',
      content: ok(
        JSON.stringify({
          filled: [
            { shift: 'Cook at Okafor dinner, Sat 4 PM to 10 PM', from: 'open', to: 'Lena Ortiz', why: 'Lena Ortiz is a cook, is free then and stays within 40 hours.' },
            { shift: 'Server at Okafor dinner, Sat 4 PM to 10 PM', from: 'open', to: 'Malik Johnson', why: 'Malik Johnson is a server, is free then and stays within 30 hours.' },
          ],
          couldNotFill: [{ shift: 'Bartender at Okafor dinner, Sat 4 PM to 10 PM', reasons: ['Grace Liu would go over 32 hours this week (30 already).', 'Priya Sandhu is unavailable then (evening class).'] }],
          brokenRules: [],
        }),
      ),
    },
    {
      role: 'assistant',
      content: "Two of the three Okafor shifts are staffed: Lena cooks and Malik serves. The bartender shift is still open, because Grace would go over 32 hours and Priya has an evening class. You could raise Grace's limit for that week or find someone else.",
    },
  ],
  [
    { role: 'user', content: 'Theo called in sick for Friday' },
    { role: 'assistant', tool_calls: [call('2', 'reportAbsence', { worker: 'Theo', from: '2026-03-13', to: '2026-03-13', reason: 'Sick' })] },
    {
      role: 'tool',
      tool_call_id: '2',
      content: ok(
        JSON.stringify({
          moves: [
            { shift: 'Driver at Harbor launch, Fri 3 PM to 9 PM', from: 'Diego Ramos', to: 'Kofi Mensah', why: 'This frees Diego for the launch; Kofi can drive.' },
            { shift: 'Cook at Harbor launch, Fri 3 PM to 9 PM', from: 'Theo Nakamura', to: 'Diego Ramos', why: 'Theo Nakamura is out; Diego Ramos is the only cook who can cover it.' },
          ],
          shiftsThatStayedPut: 13,
          couldNotCover: [],
          pinnedShiftsTheOwnerMustDecide: [],
          brokenRules: [],
        }),
      ),
    },
    { role: 'assistant', content: 'Theo is covered. I moved 2 shifts and left the other 13 alone: Diego cooks at the Harbor launch, and Kofi takes the driving.' },
  ],
  [
    { role: 'user', content: 'New booking: dinner for 40 on Saturday, 5 to 10 pm. One cook and two servers.' },
    { role: 'assistant', tool_calls: [call('3', 'addJob', { name: 'Dinner for 40', date: '2026-03-14', startHour: 17, endHour: 22, roles: [{ skill: 'Cook', count: 1 }, { skill: 'Server', count: 2 }] })] },
    { role: 'tool', tool_call_id: '3', content: ok('Added 3 open shifts for Dinner for 40, Sat, Mar 14, 5 PM. Call fillOpenShifts to staff them.') },
    { role: 'assistant', content: "I've added Dinner for 40 with 3 open shifts. Want me to staff them?" },
  ],
  [
    { role: 'user', content: 'Pay Malik for last night' },
    { role: 'assistant', tool_calls: [call('4', 'listReadyToPay', {})] },
    {
      role: 'tool',
      tool_call_id: '4',
      content: ok(
        JSON.stringify({
          shifts: [{ worker: 'Malik Johnson', shift: 'Server at Okafor dinner, Thu 4 PM to 10 PM', hours: 6, rate: 18, pay: '$108.00' }],
          total: '$108.00',
          note: 'You cannot pay anyone. The owner approves these with the Approve and pay button, and PayPal then pays each person.',
        }),
      ),
    },
    { role: 'assistant', content: "I can't pay anyone myself. Malik's shift is in the Ready to pay list, at $108: press Approve and pay, and PayPal sends it right away." },
  ],
];
