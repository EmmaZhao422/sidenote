// Settings: language, the AI connection, and your data.

import { h, mount, toast, announce, segmented } from '../ui.js';
import { t, getLang } from '../i18n.js';
import { store } from '../store.js';
import { aiMode, testConnection, DEFAULT_ANTHROPIC_MODEL } from '../ai.js';
import { CONFIG } from '../config.js';
import { applyTheme } from '../theme.js';
import { sessionsToCsv } from '../csv.js';
import { buildIcs, nextAt, downloadIcs } from '../ics.js';

export function settingsView(root, navigate, rerenderAll) {
  const s = store.state.settings;

  // ---- language
  const language = h('section', { class: 'card' },
    h('h2', null, t('settings.language')),
    segmented(t('settings.language'), [
      { value: 'en', label: 'English' },
      { value: 'zh', label: '中文' },
    ], getLang(), (v) => { store.setSettings({ lang: v }); rerenderAll(); }));
  language.querySelectorAll('.seg-btn').forEach((b, i) => { b.lang = i === 0 ? 'en' : 'zh-CN'; });

  // ---- appearance
  const appearance = h('section', { class: 'card' },
    h('h2', null, t('settings.theme')),
    segmented(t('settings.theme'), [
      { value: 'auto', label: t('settings.theme.auto') },
      { value: 'light', label: t('settings.theme.light') },
      { value: 'dark', label: t('settings.theme.dark') },
    ], s.theme || 'auto', (v) => { store.setSettings({ theme: v }); applyTheme(v); }));

  // ---- a standing reminder to study. The site cannot notify anyone while it is closed,
  // so the student's own calendar does it: a repeating event, added from a file.
  const lastBlock = store.state.sessions.filter((x) => !x.sample).slice(-1)[0];
  const guess = lastBlock ? new Date(lastBlock.startedAt) : null;
  const two = (n) => String(n).padStart(2, '0');
  const remTime = h('input', { type: 'time', class: 'field field-date', id: 'rem-time', step: '300', value: guess ? `${two(guess.getHours())}:${two(Math.floor(guess.getMinutes() / 15) * 15)}` : '19:00' });
  const remDays = h('select', { class: 'field field-date', id: 'rem-days' },
    h('option', { value: 'daily' }, t('settings.reminder.daily')),
    h('option', { value: 'weekdays' }, t('settings.reminder.weekdays')));
  const reminder = h('section', { class: 'card' },
    h('h2', null, t('settings.reminder')),
    h('p', { class: 'hint' }, t('settings.reminder.hint')),
    h('div', { class: 'row' },
      h('label', { class: 'label', for: 'rem-time' }, t('settings.reminder.time')), remTime,
      h('label', { class: 'label', for: 'rem-days' }, t('settings.reminder.days')), remDays),
    h('div', { class: 'row' }, h('button', {
      type: 'button', class: 'btn btn-quiet',
      onclick: () => {
        const start = nextAt(remTime.value || '19:00', remDays.value);
        downloadIcs(buildIcs({
          title: t('ics.title'), start, minutes: s.focusMin || 25, url: `${CONFIG.siteUrl}#/focus`,
          note: t('settings.reminder.note'), repeat: remDays.value,
        }), 'study-reminder.ics');
        toast(t('settings.reminder.saved'), 6000);
      },
    }, t('settings.reminder.add'))));

  // ---- a date to work toward (an exam, a deadline): shown as a countdown on the home page
  const dl = s.deadline || {};
  const dlName = h('input', { type: 'text', class: 'field', id: 'dl-name', maxlength: '40', value: dl.label || '', placeholder: t('settings.deadline.namePlaceholder') });
  const dlDate = h('input', { type: 'date', class: 'field', id: 'dl-date', value: dl.date || '', min: store.dayKey(0) });
  const saveDeadline = () => {
    store.setSettings({ deadline: dlDate.value ? { label: dlName.value.trim(), date: dlDate.value } : null });
  };
  dlName.addEventListener('change', saveDeadline);
  dlDate.addEventListener('change', () => { saveDeadline(); if (dlDate.value) toast(t('settings.deadline.saved')); });
  const deadline = h('section', { class: 'card' },
    h('h2', null, t('settings.deadline')),
    h('p', { class: 'hint' }, t('settings.deadline.hint')),
    h('label', { class: 'label', for: 'dl-name' }, t('settings.deadline.name')), dlName,
    h('label', { class: 'label', for: 'dl-date' }, t('settings.deadline.date')), dlDate,
    h('div', { class: 'row' }, h('button', {
      type: 'button', class: 'btn btn-quiet',
      onclick: () => { dlName.value = ''; dlDate.value = ''; saveDeadline(); },
    }, t('settings.deadline.clear'))));

  // ---- AI connection
  const status = h('p', { class: 'ai-status' });
  const drawStatus = () => { status.textContent = t(`settings.ai.status.${aiMode()}`); status.dataset.mode = aiMode(); };

  const provider = h('select', { class: 'field', id: 'ai-provider' },
    h('option', { value: 'anthropic', selected: s.ai.provider === 'anthropic' }, 'Anthropic (Claude)'),
    h('option', { value: 'openai-compatible', selected: s.ai.provider === 'openai-compatible' }, t('settings.ai.compatible')));
  const key = h('input', { type: 'password', class: 'field', id: 'ai-key', autocomplete: 'off', value: s.ai.key, placeholder: 'sk-…', 'aria-describedby': 'ai-test-result' });
  const baseUrl = h('input', { type: 'url', class: 'field', id: 'ai-base', value: s.ai.baseUrl, placeholder: 'https://api.openai.com/v1' });
  const model = h('input', { type: 'text', class: 'field', id: 'ai-model', value: s.ai.model });
  const baseRow = h('div', null, h('label', { class: 'label', for: 'ai-base' }, t('settings.ai.baseUrl')), baseUrl);
  const syncProvider = () => {
    const compat = provider.value === 'openai-compatible';
    baseRow.hidden = !compat;
    model.placeholder = compat ? 'gpt-4o-mini' : DEFAULT_ANTHROPIC_MODEL;
  };
  provider.addEventListener('change', syncProvider);

  const remember = h('input', { type: 'checkbox', id: 'ai-remember', checked: Boolean(s.ai.remember) });
  const saveAi = () => store.setAiSettings({
    provider: provider.value, key: key.value.trim(), baseUrl: baseUrl.value.trim(), model: model.value.trim(),
    remember: remember.checked,
  });

  const testResult = h('p', { class: 'test-result', id: 'ai-test-result', role: 'alert', hidden: true });
  const testBtn = h('button', {
    type: 'button', class: 'btn btn-quiet',
    onclick: async () => {
      saveAi();
      drawStatus();
      // The result stays on the page, next to the field it is about
      const say = (text, bad) => { testResult.textContent = text; testResult.hidden = false; testResult.classList.toggle('is-bad', bad); if (bad) key.setAttribute('aria-invalid', 'true'); else key.removeAttribute('aria-invalid'); };
      if (aiMode() === 'offline') { say(t('settings.ai.needKey'), true); key.focus(); return; }
      if (testBtn.getAttribute('aria-busy') === 'true') return;
      testBtn.setAttribute('aria-busy', 'true'); // not `disabled`: that would drop the cursor
      testBtn.textContent = t('settings.ai.testing');
      try {
        await testConnection();
        say(t('settings.ai.ok'), false);
      } catch (err) {
        say(t('settings.ai.failed', { detail: err.message || '' }), true);
      }
      testBtn.removeAttribute('aria-busy');
      testBtn.textContent = t('settings.ai.test');
    },
  }, t('settings.ai.test'));

  const ai = h('section', { class: 'card' },
    h('h2', null, t('settings.ai.title')),
    status,
    h('p', null, CONFIG.ai.proxyUrl ? t('settings.ai.introSite') : t('settings.ai.introNoSite')),
    h('p', null, t('settings.ai.skill'), ' ', h('a', { href: (getLang() === 'zh' ? 'zh/' : '') + 'claude.html' }, t('settings.ai.skillLink'))),
    h('details', { open: Boolean(s.ai.key) || !CONFIG.ai.proxyUrl },
      h('summary', null, t('settings.ai.ownKey')),
      h('p', { class: 'hint' }, t('settings.ai.keyHint')),
      h('label', { class: 'label', for: 'ai-provider' }, t('settings.ai.provider')), provider,
      h('label', { class: 'label', for: 'ai-key' }, t('settings.ai.key')), key,
      h('div', { class: 'check' }, remember, h('label', { for: 'ai-remember' }, t('settings.ai.remember'))),
      h('p', { class: 'hint' }, t('settings.ai.rememberHint')),
      baseRow,
      h('label', { class: 'label', for: 'ai-model' }, t('settings.ai.model')), model,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn-ink', onclick: () => { saveAi(); drawStatus(); toast(t('settings.saved')); } }, t('settings.save')),
        testBtn,
        h('button', {
          type: 'button', class: 'btn btn-quiet',
          onclick: () => { key.value = ''; saveAi(); drawStatus(); toast(t('settings.ai.removed')); },
        }, t('settings.ai.remove'))),
      testResult));

  // ---- sound
  const chime = h('input', { type: 'checkbox', id: 'chime', checked: s.chime, onchange: (e) => store.setSettings({ chime: e.target.checked }) });
  const notify = h('input', {
    type: 'checkbox', id: 'notify', checked: s.notify && 'Notification' in window && Notification.permission === 'granted',
    onchange: async (e) => {
      if (!e.target.checked) { store.setSettings({ notify: false }); return; }
      if (!('Notification' in window)) { e.target.checked = false; toast(t('settings.notifyUnsupported')); return; }
      // The browser shows its own permission prompt here
      const answer = await Notification.requestPermission();
      if (answer === 'granted') { store.setSettings({ notify: true }); return; }
      e.target.checked = false;
      store.setSettings({ notify: false });
      toast(t('settings.notifyDenied'));
    },
  });
  const sound = h('section', { class: 'card' },
    h('h2', null, t('settings.sound')),
    h('div', { class: 'check' }, chime, h('label', { for: 'chime' }, t('settings.chime'))),
    h('div', { class: 'check' }, notify, h('label', { for: 'notify' }, t('settings.notify'))));

  // ---- data
  const file = h('input', {
    type: 'file', accept: 'application/json,.json', hidden: true,
    onchange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        const inside = store.peekJSON(text);
        // Restoring replaces everything here, so say what is about to happen first
        mount(confirmBox,
          h('p', null, t('settings.importConfirm', {
            sessions: inside.sessions, thoughts: inside.thoughts,
            nowSessions: store.state.sessions.length, nowThoughts: store.state.thoughts.length,
          })),
          h('div', { class: 'row' },
            h('button', {
              type: 'button', class: 'btn btn-ink',
              onclick: () => { store.importJSON(text); toast(t('settings.imported')); rerenderAll(); },
            }, t('settings.importGo')),
            h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => { confirmBox.hidden = true; } }, t('settings.importCancel'))));
        confirmBox.hidden = false;
        confirmBox.querySelector('button')?.focus(); // so Tab does not pass over "Erase everything" on the way
      } catch {
        toast(t('settings.importFailed'));
      }
      e.target.value = '';
    },
  });
  const confirmBox = h('div', { class: 'notice confirm-box', role: 'alert', hidden: true });
  let armed = false;
  const clear = h('button', {
    type: 'button', class: 'btn btn-quiet btn-danger',
    onclick: () => {
      if (!armed) {
        armed = true;
        clear.textContent = t('settings.clearSure');
        announce(t('settings.clearSure'));
        clear.addEventListener('blur', () => { armed = false; clear.textContent = t('settings.clear'); }, { once: true });
        return;
      }
      store.clearAll();
      toast(t('settings.cleared'));
      rerenderAll();
    },
  }, t('settings.clear'));

  const counts = t('settings.dataCounts', { sessions: store.state.sessions.length, thoughts: store.state.thoughts.length });
  const data = h('section', { class: 'card' },
    h('h2', null, t('settings.data')),
    h('p', null, t('settings.dataIntro')),
    h('p', { class: 'hint' }, counts),
    h('div', { class: 'row' },
      h('button', {
        type: 'button', class: 'btn btn-quiet',
        onclick: () => {
          const blob = new Blob([store.exportJSON()], { type: 'application/json' });
          const a = h('a', { href: URL.createObjectURL(blob), download: `sidenote-backup-${new Date().toISOString().slice(0, 10)}.json` });
          document.body.append(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        },
      }, t('settings.export')),
      h('button', {
        type: 'button', class: 'btn btn-quiet', disabled: !store.state.sessions.length,
        onclick: () => {
          const blob = new Blob([sessionsToCsv(store.state.sessions.filter((x) => !x.sample))], { type: 'text/csv' });
          const a = h('a', { href: URL.createObjectURL(blob), download: `sidenote-blocks-${new Date().toISOString().slice(0, 10)}.csv` });
          document.body.append(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        },
      }, t('settings.csv')),
      h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => file.click() }, t('settings.import')),
      file, clear),
    confirmBox);

  mount(root,
    h('header', { class: 'view-head' }, h('h1', null, t('settings.title'))),
    language, appearance, deadline, reminder, ai, sound, data);
  syncProvider();
  drawStatus();
}
