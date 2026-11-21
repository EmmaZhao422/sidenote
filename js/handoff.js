// "Copy for Claude": puts the waiting thoughts on the clipboard as plain text,
// ready to paste into a Claude chat. With the sidenote-coach skill (see /skill)
// Claude then deals with them on the student's own Claude plan, which costs the
// site nothing.

import { h, toast } from './ui.js';
import { t } from './i18n.js';
import { store } from './store.js';

export function marginAsText(thoughts) {
  const goalOf = (th) => {
    const s = store.state.sessions.find((x) => x.id === th.sessionId);
    return s ? s.goal : '';
  };
  const lines = thoughts.map((th) => {
    const goal = goalOf(th);
    const when = typeof th.offsetSec === 'number'
      ? t('handoff.when', { n: Math.max(1, Math.round(th.offsetSec / 60)), goal: goal || t('focus.noGoal') })
      : '';
    return `- [${th.category || 'other'}] ${th.text}${when ? `  (${when})` : ''}`;
  });
  return `${t('handoff.header')}\n\n${lines.join('\n')}\n`;
}

// Returns a button. `getThoughts` is called at click time.
export function copyForClaudeButton(getThoughts) {
  const btn = h('button', {
    type: 'button', class: 'btn btn-quiet',
    onclick: async () => {
      const text = marginAsText(getThoughts());
      try {
        await navigator.clipboard.writeText(text);
        toast(t('handoff.copied'));
      } catch {
        // Clipboard blocked (older browser, embedded view): show the text to copy by hand
        const box = h('textarea', { class: 'field handoff-box', readonly: true, rows: '6', 'aria-label': t('handoff.button') });
        box.value = text;
        btn.after(box);
        box.focus();
        box.select();
        toast(t('handoff.manual'));
      }
    },
  }, t('handoff.button'));
  return btn;
}
