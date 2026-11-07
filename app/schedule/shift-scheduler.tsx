'use client';

import { useEffect, useRef, useState } from 'react';
import { BryntumScheduler } from '@bryntum/scheduler-react-enterprise';
import { AIHelper, OpenAIPlugin, StringHelper, type Model } from '@bryntum/core-enterprise';
import type { EventModel, ResourceModel, Scheduler } from '@bryntum/scheduler-enterprise';
import { AGENT_TOOLS } from '@/lib/schedule/agent';
import { AGENT_EXAMPLES } from '@/lib/schedule/agent-examples';
import { DEFAULT_MODEL } from '@/lib/assistant';
import { WORKERS } from '@/lib/schedule/demo';
import { describeShift, shiftHours, shiftPay, shiftState, upcomingHours, whyNot } from '@/lib/schedule/rules';
import type { Shift, Skill, Worker } from '@/lib/schedule/types';
import { wallClock } from '@/lib/schedule/wall-clock';
import { CrewMember, OPEN_ROW, ShiftEvent, toEventData, toRangeData, type Board } from './board';

// A trial key from bryntum.com/download covers every visitor until its end date. Without one, Bryntum
// gives each browser 14 days from its first visit. Either way the component shows its Trial badge.
const licenseKey = process.env.NEXT_PUBLIC_BRYNTUM_LICENSE_KEY;
if (licenseKey) ((globalThis as unknown as { bryntum?: { licenseKey?: string } }).bryntum ??= {}).licenseKey = licenseKey;

const SKILL_COLORS: Record<Skill, string> = {
  Cook: 'orange',
  Server: 'blue',
  Bartender: 'violet',
  Driver: 'teal',
};

const AVATAR_COLORS = ['#b4532a', '#1f6f8b', '#6b4fa0', '#2f7d4f', '#a13d63', '#8a6d1f', '#3c5ba9', '#0f766e'];

const initials = (name: string) => name.split(' ').map((part) => part[0]).join('').slice(0, 2);

function crewCell(board: Board, record: Model) {
  const resource = record as CrewMember;
  const view = board.getView();
  if (resource.id === OPEN_ROW) {
    return {
      class: 'crew crew-open',
      children: [
        { class: 'crew-avatar', children: [{ tag: 'i', class: 'fa fa-plus' }] },
        {
          class: 'crew-text',
          children: [
            { class: 'crew-name', text: 'Open shifts' },
            { class: 'crew-sub', text: view.open === 0 ? 'All staffed' : `${view.open} to fill` },
          ],
        },
      ],
    };
  }
  const index = WORKERS.findIndex((w) => w.id === resource.id);
  const hours = upcomingHours(view.schedule, String(resource.id), view.now);
  const share = Math.min(100, (hours / resource.maxWeeklyHours) * 100);
  return {
    class: 'crew',
    children: [
      { class: 'crew-avatar', style: { background: AVATAR_COLORS[index % AVATAR_COLORS.length] }, text: initials(resource.name) },
      {
        class: 'crew-text',
        children: [
          { tag: 'a', class: 'crew-name', href: `/crew/${resource.id}`, target: '_blank', text: resource.name, dataset: { btip: `See ${resource.name.split(' ')[0]}'s phone` } },
          {
            class: 'crew-skills',
            children: resource.skills.map((skill) => ({ tag: 'span', class: `crew-skill skill-${skill.toLowerCase()}`, text: skill })),
          },
        ],
      },
      {
        class: 'crew-hours',
        dataset: { btip: `${hours} hours booked in the next 7 days. Weekly limit: ${resource.maxWeeklyHours}.` },
        children: [
          { class: 'crew-hours-text', text: `${hours}/${resource.maxWeeklyHours}h` },
          { class: 'crew-meter', children: [{ tag: 'i', style: { width: `${share}%` } }] },
        ],
      },
    ],
  };
}

/** What one shift bar says, and how it looks. */
function shiftBar(board: Board, record: ShiftEvent, renderData: { cls: unknown; eventStyle: unknown; eventColor: unknown }) {
  const { schedule, now } = board.getView();
  const shift = schedule.shifts.find((s) => s.id === record.id);
  const state = shift ? shiftState(shift, now) : 'open';
  const cls = renderData.cls as { add(name: string): void };
  cls.add(`shift-${state}`);
  if (record.pinned) cls.add('shift-pinned');
  if (board.glowing.has(String(record.id))) cls.add('shift-moved');

  renderData.eventColor = state === 'finished' ? 'amber' : state === 'paid' || state === 'paying' ? 'green' : SKILL_COLORS[record.skill];
  renderData.eventStyle = state === 'paid' ? 'filled' : 'tonal';

  const worker = schedule.workers.find((w) => w.id === shift?.workerId);
  const amount = shift && worker ? shiftPay(shift, worker) : 0;
  const money = amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
  const second =
    state === 'finished' || state === 'paying' || state === 'paid' ? money : record.job;

  if (state === 'open') return { class: 'shift-line', children: [{ tag: 'strong', text: record.skill }, { tag: 'span', text: ` ${record.job}` }] };

  return {
    children: [
      {
        class: 'shift-first',
        children: [
          state === 'paid' ? { tag: 'i', class: 'fa fa-check' } : null,
          state === 'paying' ? { tag: 'i', class: 'fa fa-spinner fa-spin' } : null,
          { tag: 'span', text: record.skill },
          record.pinned ? { tag: 'i', class: 'fa fa-thumbtack shift-pin' } : null,
        ],
      },
      { class: 'shift-second', text: second },
    ],
  };
}

function shiftTooltip(board: Board, record: ShiftEvent) {
  const { schedule, now } = board.getView();
  const shift = schedule.shifts.find((s) => s.id === record.id);
  if (!shift) return '';
  const worker = schedule.workers.find((w) => w.id === shift.workerId);
  const encode = StringHelper.encodeHtml;
  const state = shiftState(shift, now);
  const lines = [
    `<strong>${encode(record.job)}</strong>`,
    `<div>${encode(describeShift(shift).split(', ')[1] ?? '')}</div>`,
    `<div>${encode(record.skill)}${worker ? `: ${encode(worker.name)}` : ', still open'}</div>`,
  ];
  if (worker) lines.push(`<div>${shiftHours(shift)} h at $${worker.hourlyRate}: $${shiftPay(shift, worker).toFixed(2)}</div>`);
  if (state === 'finished') lines.push('<div class="tip-note">Finished. Approve it below to pay now.</div>');
  if (state === 'paying') lines.push('<div class="tip-note">PayPal is processing this payment.</div>');
  if (state === 'paid') lines.push('<div class="tip-note">Paid through PayPal.</div>');
  if (record.pinned) lines.push('<div class="tip-note">Pinned: the assistant leaves it alone.</div>');
  if (record.why) lines.push(`<div class="tip-why">${encode(record.why)}</div>`);
  return lines.join('');
}

function agentTools(board: Board) {
  const tools: Record<string, unknown> = {};
  for (const [name, tool] of Object.entries(AGENT_TOOLS)) {
    tools[name] = AIHelper.createBasicTool(
      {
        description: tool.description,
        available: true,
        properties: tool.properties as never,
        required: tool.required,
        statusDescription: tool.status,
        fn: (async ({ args }: { args: Record<string, unknown> }) => {
          const outcome = tool.run(board.snapshot(), args ?? {}, wallClock(), { balance: board.balance });
          if (outcome.failed) return AIHelper.error(outcome.reply);
          await board.apply(outcome.effects);
          return outcome.reply;
        }) as never,
      } as never,
      tool.status,
    );
  }
  return tools as never;
}

const INTRO = `<p>I run this schedule with you. Ask me to staff a job, or tell me someone is out and I'll repair the week.</p><p>I can't pay anyone. That takes your click.</p>`;

function buildConfig(board: Board, dock: HTMLElement, actions: { pay: (shiftId: string) => void; notify: (message: string) => void }) {
  const { start, end, today } = board.timeline;
  const fromEvent = (record: EventModel): Shift | undefined => board.snapshot().shifts.find((s) => s.id === record.id);

  /** Whether a shift can go to this row, in the words of the rules. */
  const dropVerdict = (record: EventModel, target: ResourceModel): { valid: boolean; message: string } => {
    if (target.id === OPEN_ROW) return { valid: true, message: 'Back to the open row' };
    const schedule = board.snapshot();
    const shift = schedule.shifts.find((s) => s.id === record.id);
    const worker = schedule.workers.find((w) => w.id === target.id);
    if (!shift || !worker) return { valid: false, message: "That shift can't go there." };
    const problems = whyNot(schedule, shift, worker);
    return problems.length > 0 ? { valid: false, message: problems[0].message } : { valid: true, message: `${worker.name} can take it` };
  };

  return {
    startDate: start,
    endDate: end,
    visibleDate: { date: new Date(today.getTime() - 86_400_000), block: 'start' as const },
    workingTime: { fromHour: 8, toHour: 24 },
    viewPreset: {
      base: 'hourAndDay',
      tickWidth: 48,
      shiftUnit: 'day',
      shiftIncrement: 1,
      timeResolution: { unit: 'minute', increment: 30 },
      headers: [
        {
          unit: 'day',
          renderer: (date: Date, _end: Date, header: { headerCellCls?: string }) => {
            if (date.getTime() === today.getTime()) header.headerCellCls = 'is-today';
            return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          },
        },
        { unit: 'hour', increment: 4, dateFormat: 'ha' },
      ],
    },
    rowHeight: 50,
    barMargin: 4,
    resourceMargin: 4,
    eventLayout: 'stack' as const,
    zoomOnMouseWheel: false,
    zoomOnTimeAxisDoubleClick: false,
    createEventOnDblClick: false,
    columnLines: false,
    project: {
      eventModelClass: ShiftEvent,
      resourceModelClass: CrewMember,
      eventsData: board.initial.shifts.map(toEventData),
      resourcesData: [
        // Slimmer bars here: a big job shouldn't push the crew off the screen.
        { id: OPEN_ROW, name: 'Open shifts', skills: [], hourlyRate: 0, maxWeeklyHours: 0, cls: 'row-open', rowHeight: 28, barMargin: 2, resourceMargin: 2 },
        ...WORKERS.map((w: Worker) => ({ id: w.id, name: w.name, skills: w.skills, hourlyRate: w.hourlyRate, maxWeeklyHours: w.maxWeeklyHours })),
      ],
      resourceTimeRangesData: board.initial.blocked.map(toRangeData) as never,
      stm: { autoRecord: true },
    },
    columns: [
      {
        id: 'crew',
        text: 'Crew',
        field: 'name',
        width: 262,
        sortable: false,
        groupable: false,
        draggable: false,
        resizable: false,
        cellCls: 'crew-cell',
        renderer: ({ record }: { record: Model }) => crewCell(board, record),
      },
    ],
    eventRenderer: ({ eventRecord, renderData }: { eventRecord: EventModel; renderData: { cls: unknown; eventStyle: unknown; eventColor: unknown } }) =>
      shiftBar(board, eventRecord as ShiftEvent, renderData),

    eventDragFeature: {
      // A job's hours come from the client: shifts change hands, not times.
      constrainDragToTimeSlot: true,
      validatorFn: ({ eventRecords, newResource }: { eventRecords: EventModel[]; newResource: ResourceModel }) => dropVerdict(eventRecords[0], newResource),
      // The time can't change here, so the rule's answer is all the tooltip needs to say.
      tooltipTemplate: ({ eventRecord, newResource }: { eventRecord: EventModel; newResource: ResourceModel }) => {
        const { valid, message } = dropVerdict(eventRecord, newResource);
        return `<div class="drag-tip ${valid ? 'drag-ok' : 'drag-no'}"><i class="fa ${valid ? 'fa-check' : 'fa-ban'}"></i> ${StringHelper.encodeHtml(message)}</div>`;
      },
    },
    eventResizeFeature: false,
    eventEditFeature: false,
    eventDragCreateFeature: false,
    scheduleMenuFeature: false,
    scheduleTooltipFeature: false,
    cellEditFeature: false,
    cellMenuFeature: false,
    headerMenuFeature: false,
    timeAxisHeaderMenuFeature: false,
    sortFeature: false,
    groupFeature: false,
    timeRangesFeature: { showCurrentTimeLine: { name: 'Now' } },
    resourceTimeRangesFeature: true,
    eventTooltipFeature: {
      template: ({ eventRecord }: { eventRecord: EventModel }) => shiftTooltip(board, eventRecord as ShiftEvent),
    },
    eventMenuFeature: {
      items: {
        editEvent: false,
        deleteEvent: false,
        unassignEvent: false,
        copyEvent: false,
        cutEvent: false,
        splitEvent: false,
      },
      processItems: ({ eventRecord, items }: { eventRecord: EventModel; items: Record<string, unknown> }) => {
        const record = eventRecord as ShiftEvent;
        const shift = fromEvent(record);
        if (!shift) return false;
        const state = shiftState(shift, wallClock());
        if (state === 'finished') {
          items.pay = { text: 'Approve and pay', icon: 'fa fa-money-bill', onItem: () => actions.pay(shift.id) };
        }
        if (state === 'upcoming') {
          items.pin = {
            text: record.pinned ? 'Unpin' : 'Pin to this person',
            icon: 'fa fa-thumbtack',
            onItem: () => {
              record.pinned = !record.pinned;
            },
          };
        }
        if (state === 'upcoming' && !record.pinned) {
          items.open = {
            text: 'Send back to open',
            icon: 'fa fa-rotate-left',
            onItem: () => {
              record.why = null;
              record.resourceId = OPEN_ROW;
            },
          };
        }
        return Object.values(items).some((item) => item);
      },
    },
    aiFeature: {
      promptUrl: '/api/ai/prompt',
      apiPlugin: OpenAIPlugin,
      model: DEFAULT_MODEL,
      undo: true,
      redo: true,
      timeout: 90_000,
      delayStatusTexts: ['Thinking it through', 'Still working on it'],
      minStatusDisplayTime: 700,
      tools: agentTools(board),
      trainingData: AGENT_EXAMPLES,
      chatButton: {
        tooltip: 'Ask the assistant',
        chatPanel: {
          appendTo: dock,
          floating: false,
          autoClose: false,
          title: 'Your assistant',
          intro: { html: INTRO },
          examplePrompts: ['Staff the Rivera wedding', 'Lena is out sick tomorrow. Fix it.', 'Who is waiting to be paid?'],
          showTimestamp: false,
          showReadAloud: false,
          showRecordButton: false,
        },
      },
    },
    onBeforeEventDrag: ({ eventRecord }: { eventRecord: EventModel }) => {
      const shift = fromEvent(eventRecord);
      if (!shift) return false;
      const state = shiftState(shift, wallClock());
      if (state === 'finished' || state === 'paying' || state === 'paid') {
        actions.notify('A finished shift stays with the person who worked it.');
        return false;
      }
      return true;
    },
    onAfterEventDrop: ({ eventRecords }: { eventRecords: EventModel[] }) => {
      for (const record of eventRecords) board.clearWhy(record as ShiftEvent);
    },
  };
}

export default function ShiftScheduler({ board, dock, onPay, onNotify }: { board: Board; dock: HTMLElement; onPay: (shiftId: string) => void; onNotify: (message: string) => void }) {
  const scheduler = useRef<BryntumScheduler>(null);
  const [config] = useState(() => buildConfig(board, dock, { pay: (id) => onPay(id), notify: (message) => onNotify(message) }));

  useEffect(() => {
    const instance = scheduler.current?.instance as Scheduler | undefined;
    if (!instance) return;
    const detach = board.attach(instance);
    (instance.features.ai as unknown as { chatPanel: { show(): void } }).chatPanel.show();
    return detach;
  }, [board]);

  return <BryntumScheduler ref={scheduler} {...(config as object)} />;
}
