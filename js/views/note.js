// One parked thought, drawn as a note: the thought, what kind it is, the AI's
// reply once asked for, and the buttons to deal with it. Used on the review
// screen and in the margin list.

import { h, renderText, toast, announce, whenLabel, dayLabel } from '../ui.js';
import { t, getLang } from '../i18n.js';
import { store } from '../store.js';
import { CATEGORIES, looksLikeCrisis } from '../classify.js';
import { resolveThought, offlineReply, aiMode, askPrompt } from '../ai.js';
import { breakTimer } from '../breaktimer.js';

// Planned cards the student has opened up again with "Change", for this page visit
const unfolded = new Set();
// (called when the screen changes, so a card opened here is folded again elsewhere)
export function foldAll() { unfolded.clear(); }

export function isPlanned(thought) {
  return thought.status !== 'done' && Boolean(thought.due || thought.queued);
}

function dueLabel(due) {
  const today = store.dayKey(0);
  return due < today ? t('due.overdue') : due === today ? t('due.today') : due === store.dayKey(1) ? t('due.tomorrow')
    : t('due.by', { day: dayLabel(new Date(`${due}T12:00`).getTime()) });
}

// opts.onChange()  called when the note is marked done / reopened / deleted
// opts.goal        what the student was studying when they parked it
export function noteCard(thoughtId, opts = {}) {
  const thought = store.state.thoughts.find((x) => x.id === thoughtId);
  if (!thought) return h('div');

  const card = h('article', { class: 'note', dataset: { status: thought.status, id: thought.id }, 'aria-label': thought.text.slice(0, 80) });
  const redraw = (focus) => {
    const next = noteCard(thoughtId, opts);
    card.replaceWith(next);
    if (focus) next.querySelector(focus)?.focus();
  };

  // A thought that has been given a day, or a place in the next block, is dealt with
  // for now: it folds down to one line so the list shows what is still undecided.
  if (isPlanned(thought) && !unfolded.has(thought.id)) {
    card.classList.add('is-planned');
    card.append(...[
      h('p', { class: 'note-text', dir: 'auto' }, thought.text),
      h('div', { class: 'note-meta' },
        h('span', { class: 'note-kind-text' }, t(`cat.${thought.category}`)),
        thought.due ? h('span', { class: 'note-due' }, dueLabel(thought.due)) : null,
        thought.queued ? h('span', { class: 'note-due' }, t('note.queuedTag')) : null),
      thought.note ? h('p', { class: 'note-line-done', dir: 'auto' }, thought.note) : null,
      h('div', { class: 'note-actions' },
        h('button', {
          type: 'button', class: 'btn btn-quiet',
          onclick: () => {
            if (thought.queued) store.removeFromNextPlan(thought.text);
            store.updateThought(thought.id, { status: 'done', doneAt: Date.now(), queued: false });
            opts.onChange?.('status');
          },
        }, t('note.done')),
        h('button', {
          type: 'button', class: 'btn btn-quiet note-change',
          onclick: () => { unfolded.add(thought.id); redraw('.note-when .chip[aria-pressed="true"]'); },
        }, t('note.change')))].filter(Boolean));
    return card;
  }

  // --- the thought itself
  card.append(h('p', { class: 'note-text', dir: 'auto' }, thought.text));

  // --- kind + when
  const kind = h('select', {
    class: 'note-kind', 'aria-label': t('note.kindLabel'), title: t('note.kindHint'),
    onchange: (e) => {
      store.updateThought(thought.id, { category: e.target.value });
      redraw('.note-kind');
      announce(t('note.kindChanged', { kind: t(`cat.${e.target.value}`) }));
      opts.onChange?.('kind');
    },
  }, CATEGORIES.map((c) => h('option', { value: c, selected: c === thought.category }, t(`cat.${c}`))));
  // Parked during a block: say which minute of the block. Otherwise: the time of day.
  const meta = h('div', { class: 'note-meta' }, kind,
    h('span', null, typeof thought.offsetSec === 'number'
      ? t('note.offset', { n: Math.max(1, Math.round(thought.offsetSec / 60)) })
      : whenLabel(thought.createdAt)));
  if (thought.due && thought.status !== 'done') {
    meta.append(h('span', { class: 'note-due' }, dueLabel(thought.due)));
  }
  card.append(meta);

  // --- reply
  // An AI answer is kept and shown. With no AI connected there is nothing to wait
  // for, so what the built-in helper offers is shown straight away, for the kind
  // the thought has right now.
  const offline = aiMode() === 'offline';
  const reply = thought.reply && thought.reply.source === 'ai' ? thought.reply
    : offline && thought.status !== 'done' ? offlineReply(thought)
      : thought.reply;
  const replyBox = h('div', { class: 'note-reply' });
  if (reply) {
    if (reply.source === 'ai') replyBox.append(h('div', { class: 'note-reply-from' }, t('note.fromAi')));
    replyBox.append(renderText(reply.text));
    // One visible action per card: a search for questions, and "Ask an AI", which
    // opens to the student's choice of Claude, ChatGPT, or a copy for any other AI.
    const links = h('div', { class: 'note-links' });
    const linkTo = (l) => h('a', { class: 'btn btn-quiet note-link', href: l.url, target: '_blank', rel: 'noopener noreferrer', title: t('offline.linkHint') }, l.label, h('span', { class: 'sr-only' }, ` (${t('offline.newTab')})`));
    const safe = (reply.links || []).filter((l) => /^https:\/\//.test(l.url));
    const ai = safe.filter((l) => l.kind === 'ai');
    safe.filter((l) => l.kind !== 'ai').forEach((l) => links.append(linkTo(l)));
    if (reply.source === 'offline' && ai.length) {
      const copy = h('button', {
        type: 'button', class: 'btn btn-quiet note-link',
        onclick: async () => {
          try { await navigator.clipboard.writeText(askPrompt(thought.text)); toast(t('offline.copied')); } catch { toast(t('offline.copyFailed')); }
        },
      }, t('offline.copy'));
      // Claude and ChatGPT are not reachable everywhere Chinese is read, so the copy comes first there
      const choices = getLang() === 'zh' ? [copy, ...ai.map(linkTo)] : [...ai.map(linkTo), copy];
      links.append(h('details', {
        class: 'ask-menu',
        onkeydown: (e) => { if (e.key === 'Escape' && e.currentTarget.open) { e.currentTarget.open = false; e.currentTarget.querySelector('summary').focus(); } },
      },
        h('summary', { class: 'btn btn-quiet note-link' }, t('offline.askAi')),
        h('div', { class: 'ask-menu-list' }, choices)));
    } else {
      ai.forEach((l) => links.append(linkTo(l)));
    }
    if (links.children.length) replyBox.append(links);
    card.append(replyBox);
  }
  if (looksLikeCrisis(thought.text) && !(reply && reply.source === 'offline')) {
    card.append(h('p', { class: 'note-care' }, t('note.care')));
  }

  // --- the student's own line: a guess, a next step, the idea in three lines.
  // Writing it is the "dealing with it", so it is offered as soon as the thought is opened up.
  const wantsLine = thought.status !== 'done' && thought.category !== 'urge' && (reply || thought.note);
  // A worry is sorted by one question: can I do something about it? Two buttons
  // answer it, so the student is not left facing an empty box.
  if (wantsLine && thought.category === 'worry' && reply && reply.source === 'offline' && !looksLikeCrisis(thought.text)) {
    card.append(h('div', { class: 'note-sort', role: 'group', 'aria-label': t('worry.ask') },
      h('button', {
        type: 'button', class: 'chip',
        onclick: () => { const el = card.querySelector('.note-line'); el.placeholder = t('worry.stepPlaceholder'); el.focus(); },
      }, t('worry.can')),
      h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(Boolean(thought.notToday)),
        onclick: () => {
          if (thought.notToday) {
            store.updateThought(thought.id, { notToday: false, note: '' });
            redraw('.note-sort .chip:nth-child(2)');
            return;
          }
          store.updateThought(thought.id, { notToday: true, note: t('worry.nothingNote') });
          toast(t('worry.nothingToast'), 5000);
          redraw('.note-when .chip');
        },
      }, t('worry.nothing')),
      document.body.classList.contains('in-claude-app') ? null : h('a', {
        class: 'note-sort-more', href: getLang() === 'zh' ? 'guides/zh/worry-while-studying.html' : 'guides/worry-while-studying.html',
      }, t('worry.guide'))));
  }
  if (wantsLine) {
    const line = h('textarea', {
      class: 'field note-line', rows: '1', maxlength: '400', dir: 'auto',
      oninput: (e) => { e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight + 2}px`; },
      placeholder: t(reply && reply.kind === 'check' ? 'line.check' : `line.${thought.category}`), 'aria-label': t('line.label'),
      onchange: (e) => { store.updateThought(thought.id, { note: e.target.value.trim() }); },
    });
    line.value = thought.note || '';
    card.append(line);
  } else if (thought.note) {
    card.append(h('p', { class: 'note-line-done', dir: 'auto' }, thought.note));
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
    type: 'button', class: reply ? 'btn btn-quiet' : 'btn btn-ink',
    onclick: () => sortOut(false),
  }, reply ? t('note.again') : t('note.sort'));
  // The built-in helper always says the same thing, so asking it again is pointless
  const canAsk = !offline;

  // A to-do gets a "when": today, tomorrow, this week, or straight into the next study block.
  // Dated to-dos show on the home page until they are done.
  let whenRow = null;
  // (worries and "other" thoughts can be given a day too: "look at this again tonight")
  if ((['todo', 'worry', 'other'].includes(thought.category) || (reply && reply.kind === 'check')) && thought.status !== 'done') {
    // "this week" runs to Sunday; on a Sunday that is today
    const sunday = () => store.dayKey((7 - new Date().getDay()) % 7);
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
          // one "when" at a time: picking a day takes it out of the next block's plan
          if (due && thought.queued) store.removeFromNextPlan(thought.text);
          store.updateThought(thought.id, { due, duePick: due ? c.key : null, ...(due ? { queued: false } : {}) });
          if (due) toast(t('due.saved'));
          unfolded.delete(thought.id);
          redraw(due ? '.note-change' : null);
          opts.onChange?.('due');
        },
      }, t(`due.pick.${c.key}`))),
      // "Next block": the to-do becomes a step of the next block's plan. It stays in the
      // list until that step is ticked off, so nothing is marked done that was not done.
      thought.category !== 'todo' ? null : h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(Boolean(thought.queued)),
        onclick: () => {
          if (thought.queued) {
            store.removeFromNextPlan(thought.text);
            store.updateThought(thought.id, { queued: false });
            redraw('.note-when .chip:last-child');
            opts.onChange?.('due');
            return;
          } else {
            if ((store.state.nextPlan || []).length >= 6) { toast(t('note.nextFull')); return; }
            store.addToNextPlan(thought.text);
            store.updateThought(thought.id, { queued: true, due: null, duePick: null });
            toast(t('note.nextAdded'));
          }
          unfolded.delete(thought.id);
          redraw('.note-change');
          opts.onChange?.('due');
        },
      }, t('note.next')));
  }

  // An urge gets what it asked for, with an end: a ten-minute break on the clock
  const breakBtn = thought.category === 'urge' && thought.status !== 'done' && !store.state.active ? h('button', {
    type: 'button', class: 'btn btn-quiet',
    onclick: () => {
      breakTimer.start(10);
      toast(t('note.breakStarted'), 4000);
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
    // one filled button per card: "help me" while an AI can still be asked, otherwise Done
    const doneBtn = h('button', {
      type: 'button', class: canAsk && !reply ? 'btn btn-quiet' : 'btn btn-ink',
      onclick: () => {
        if (thought.queued) store.removeFromNextPlan(thought.text);
        store.updateThought(thought.id, { status: 'done', doneAt: Date.now(), queued: false });
        announce(t('note.doneSaid', { text: thought.text.slice(0, 60) }));
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
        announce(t('note.deleteAsk', { text: thought.text.slice(0, 60) }));
        // the question stays while the button has focus, and for a while after
        setTimeout(() => { if (document.activeElement !== del) { armed = false; del.textContent = t('note.delete'); } }, 20000);
        del.addEventListener('blur', () => { armed = false; del.textContent = t('note.delete'); }, { once: true });
        return;
      }
      if (thought.queued) store.removeFromNextPlan(thought.text);
      store.deleteThought(thought.id);
      announce(t('note.deleted', { text: thought.text.slice(0, 60) }));
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
