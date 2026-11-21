// One parked thought, drawn as a note: the thought, what kind it is, the AI's
// reply once asked for, and the buttons to deal with it. Used on the review
// screen and in the margin list.

import { h, renderText, toast, whenLabel, dayLabel } from '../ui.js';
import { t } from '../i18n.js';
import { store } from '../store.js';
import { CATEGORIES, looksLikeCrisis } from '../classify.js';
import { resolveThought, offlineReply, aiMode } from '../ai.js';
import { breakTimer } from '../breaktimer.js';

// opts.onChange()  called when the note is marked done / reopened / deleted
// opts.goal        what the student was studying when they parked it
export function noteCard(thoughtId, opts = {}) {
  const thought = store.state.thoughts.find((x) => x.id === thoughtId);
  if (!thought) return h('div');

  const card = h('article', { class: 'note', dataset: { status: thought.status, id: thought.id } });
  const redraw = () => card.replaceWith(noteCard(thoughtId, opts));

  // --- the thought itself
  card.append(h('p', { class: 'note-text', dir: 'auto' }, thought.text));

  // --- kind + when
  const kind = h('select', {
    class: 'note-kind', 'aria-label': t('note.kindLabel'), title: t('note.kindHint'),
    onchange: (e) => { store.updateThought(thought.id, { category: e.target.value }); opts.onChange?.('kind'); },
  }, CATEGORIES.map((c) => h('option', { value: c, selected: c === thought.category }, t(`cat.${c}`))));
  const meta = h('div', { class: 'note-meta' }, kind, h('span', null, whenLabel(thought.createdAt)));
  if (typeof thought.offsetSec === 'number') {
    meta.append(h('span', null, t('note.offset', { n: Math.max(1, Math.round(thought.offsetSec / 60)) })));
  }
  if (thought.due && thought.status !== 'done') {
    const today = store.dayKey(0);
    const label = thought.due <= today ? t('due.today') : thought.due === store.dayKey(1) ? t('due.tomorrow') : t('due.by', { day: dayLabel(new Date(`${thought.due}T12:00`).getTime()) });
    meta.append(h('span', { class: 'note-due' }, label));
  }
  card.append(meta);

  // --- reply
  const replyBox = h('div', { class: 'note-reply' });
  if (thought.reply) {
    replyBox.append(h('div', { class: 'note-reply-from' }, thought.reply.source === 'ai' ? t('note.fromAi') : t('note.fromOffline')));
    // Without an AI, the useful thing for a question is the search link, so it goes first
    (thought.reply.links || []).forEach((l) => {
      replyBox.append(h('a', { class: 'btn btn-quiet note-link', href: l.url, target: '_blank', rel: 'noopener noreferrer' }, l.label));
    });
    replyBox.append(renderText(thought.reply.text));
    if (thought.reply.source === 'offline' && aiMode() === 'offline' && thought.category === 'question') {
      replyBox.append(h('p', { class: 'hint' }, t('note.connectHint'), ' ', h('a', { href: '#/settings' }, t('note.connectLink'))));
    }
    card.append(replyBox);
  }

  // --- the student's own line: a guess, a next step, the idea in three lines.
  // Writing it is the "dealing with it", so it is offered as soon as the thought is opened up.
  const wantsLine = thought.status !== 'done' && thought.category !== 'urge' && (thought.reply || thought.note);
  if (wantsLine) {
    const line = h('textarea', {
      class: 'field note-line', rows: '2', maxlength: '400', dir: 'auto',
      placeholder: t(`line.${thought.category}`), 'aria-label': t('line.label'),
      onchange: (e) => { store.updateThought(thought.id, { note: e.target.value.trim() }); },
    });
    line.value = thought.note || '';
    card.append(line);
  } else if (thought.note) {
    card.append(h('p', { class: 'note-line-done', dir: 'auto' }, thought.note));
  }
  if (looksLikeCrisis(thought.text)) {
    card.append(h('p', { class: 'note-care' }, t('note.care')));
  }

  // --- buttons
  const actions = h('div', { class: 'note-actions' });
  const errorLine = h('p', { class: 'note-error', role: 'alert', hidden: true });

  async function sortOut(forceOffline) {
    sortBtn.disabled = true;
    sortBtn.textContent = t('note.sorting');
    errorLine.hidden = true;
    try {
      const reply = forceOffline ? offlineReply(thought) : await resolveThought(thought, opts.goal);
      const patch = { reply: { text: reply.text, source: reply.source, links: reply.links || [], at: Date.now() } };
      if (reply.category && CATEGORIES.includes(reply.category)) patch.category = reply.category;
      store.updateThought(thought.id, patch);
      redraw();
      opts.onChange?.('reply');
    } catch (err) {
      sortBtn.disabled = false;
      sortBtn.textContent = t('note.sort');
      errorLine.hidden = false;
      errorLine.replaceChildren(
        t('note.error', { detail: err.name === 'AbortError' ? t('note.timeout') : (err.message || '') }), ' ',
        h('button', { type: 'button', class: 'linklike', onclick: () => sortOut(true) }, t('note.useOffline')),
      );
    }
  }

  const sortBtn = h('button', {
    type: 'button', class: thought.reply ? 'btn btn-quiet' : 'btn btn-ink',
    onclick: () => sortOut(false),
  }, thought.reply ? t('note.again') : t('note.sort'));
  // The built-in helper always says the same thing, so asking it again is pointless
  const canAsk = !thought.reply || aiMode() !== 'offline';

  // A to-do gets a "when": today, tomorrow, this week, or straight into the next study block.
  // Dated to-dos show on the home page until they are done.
  let whenRow = null;
  if (thought.category === 'todo' && thought.status !== 'done') {
    const sunday = () => { const d = new Date(); return store.dayKey(((7 - d.getDay()) % 7) || 7); };
    const choices = [
      { key: 'today', due: () => store.dayKey(0) },
      { key: 'tomorrow', due: () => store.dayKey(1) },
      { key: 'week', due: sunday },
    ];
    whenRow = h('div', { class: 'note-when', role: 'group', 'aria-label': t('due.label') },
      h('span', { class: 'note-when-label' }, t('due.label')),
      choices.map((c) => h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(Boolean(thought.due) && thought.duePick === c.key),
        onclick: () => {
          const due = thought.due && thought.duePick === c.key ? null : c.due();
          store.updateThought(thought.id, { due, duePick: due ? c.key : null });
          if (due) toast(t('due.saved'));
          redraw();
          opts.onChange?.('due');
        },
      }, t(`due.pick.${c.key}`))),
      h('button', {
        type: 'button', class: 'chip',
        onclick: () => {
          if ((store.state.nextPlan || []).length >= 3) { toast(t('note.nextFull')); return; }
          store.addToNextPlan(thought.text);
          store.updateThought(thought.id, { status: 'done', doneAt: Date.now() });
          toast(t('note.nextAdded'));
          opts.onChange?.('status');
        },
      }, t('note.next')));
  }

  // An urge gets what it asked for, with an end: a ten-minute break on the clock
  const breakBtn = thought.category === 'urge' && thought.status !== 'done' ? h('button', {
    type: 'button', class: 'btn btn-quiet',
    onclick: () => {
      breakTimer.start(10);
      store.updateThought(thought.id, { status: 'done', doneAt: Date.now() });
      opts.onChange?.('status');
    },
  }, t('note.break')) : null;

  if (thought.status === 'done') {
    actions.append(h('button', {
      type: 'button', class: 'btn btn-quiet',
      onclick: () => { store.updateThought(thought.id, { status: 'open', doneAt: null }); opts.onChange?.('status'); },
    }, t('note.reopen')));
  } else {
    const doneBtn = h('button', {
      type: 'button', class: 'btn btn-quiet',
      onclick: () => {
        store.updateThought(thought.id, { status: 'done', doneAt: Date.now() });
        toast(t('note.doneToast'));
        opts.onChange?.('status');
      },
    }, t('note.done'));
    actions.append(...[canAsk ? sortBtn : null, breakBtn, doneBtn].filter(Boolean));
  }

  // Delete asks twice by changing its own label, instead of a pop-up dialog
  let armed = false;
  const del = h('button', {
    type: 'button', class: 'btn btn-quiet btn-danger',
    onclick: () => {
      if (!armed) {
        armed = true;
        del.textContent = t('note.deleteSure');
        setTimeout(() => { armed = false; del.textContent = t('note.delete'); }, 3000);
        return;
      }
      store.deleteThought(thought.id);
      opts.onChange?.('status');
    },
  }, t('note.delete'));
  actions.append(del);

  if (whenRow) card.append(whenRow);
  card.append(actions, errorLine);
  return card;
}

// "Sort everything out": asks for each open note in turn, one at a time.
export async function sortAll(ids, goalFor, onProgress) {
  let done = 0;
  let failed = 0;
  for (const id of ids) {
    const thought = store.state.thoughts.find((x) => x.id === id);
    if (!thought || thought.reply || thought.status === 'done') continue;
    try {
      const reply = await resolveThought(thought, goalFor ? goalFor(thought) : '');
      const patch = { reply: { text: reply.text, source: reply.source, links: reply.links || [], at: Date.now() } };
      if (reply.category && CATEGORIES.includes(reply.category)) patch.category = reply.category;
      store.updateThought(id, patch);
    } catch {
      // Leave this one for the student to retry by hand; keep going with the rest.
      failed += 1;
    }
    done += 1;
    onProgress?.(done);
  }
  return failed;
}
