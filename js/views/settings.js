// Settings: language, the AI connection, and your data.

import { h, mount, toast, segmented } from '../ui.js';
import { t, getLang } from '../i18n.js';
import { store } from '../store.js';
import { aiMode, testConnection, DEFAULT_ANTHROPIC_MODEL } from '../ai.js';
import { CONFIG } from '../config.js';
import { applyTheme } from '../theme.js';

export function settingsView(root, navigate, rerenderAll) {
  const s = store.state.settings;

  // ---- language
  const language = h('section', { class: 'card' },
    h('h2', null, t('settings.language')),
    segmented(t('settings.language'), [
      { value: 'en', label: 'English' },
      { value: 'zh', label: '中文' },
    ], getLang(), (v) => { store.setSettings({ lang: v }); rerenderAll(); }));

  // ---- appearance
  const appearance = h('section', { class: 'card' },
    h('h2', null, t('settings.theme')),
    segmented(t('settings.theme'), [
      { value: 'auto', label: t('settings.theme.auto') },
      { value: 'light', label: t('settings.theme.light') },
      { value: 'dark', label: t('settings.theme.dark') },
    ], s.theme || 'auto', (v) => { store.setSettings({ theme: v }); applyTheme(v); }));

  // ---- AI connection
  const status = h('p', { class: 'ai-status' });
  const drawStatus = () => { status.textContent = t(`settings.ai.status.${aiMode()}`); status.dataset.mode = aiMode(); };

  const provider = h('select', { class: 'field', id: 'ai-provider' },
    h('option', { value: 'anthropic', selected: s.ai.provider === 'anthropic' }, 'Anthropic (Claude)'),
    h('option', { value: 'openai-compatible', selected: s.ai.provider === 'openai-compatible' }, t('settings.ai.compatible')));
  const key = h('input', { type: 'password', class: 'field', id: 'ai-key', autocomplete: 'off', value: s.ai.key, placeholder: 'sk-…' });
  const baseUrl = h('input', { type: 'url', class: 'field', id: 'ai-base', value: s.ai.baseUrl, placeholder: 'https://api.openai.com/v1' });
  const model = h('input', { type: 'text', class: 'field', id: 'ai-model', value: s.ai.model });
  const baseRow = h('div', null, h('label', { class: 'label', for: 'ai-base' }, t('settings.ai.baseUrl')), baseUrl);
  const syncProvider = () => {
    const compat = provider.value === 'openai-compatible';
    baseRow.hidden = !compat;
    model.placeholder = compat ? 'gpt-4o-mini' : DEFAULT_ANTHROPIC_MODEL;
  };
  provider.addEventListener('change', syncProvider);

  const saveAi = () => store.setAiSettings({
    provider: provider.value, key: key.value.trim(), baseUrl: baseUrl.value.trim(), model: model.value.trim(),
  });

  const testBtn = h('button', {
    type: 'button', class: 'btn btn-quiet',
    onclick: async () => {
      saveAi();
      drawStatus();
      if (aiMode() === 'offline') { toast(t('settings.ai.needKey')); return; }
      testBtn.disabled = true;
      testBtn.textContent = t('settings.ai.testing');
      try {
        await testConnection();
        toast(t('settings.ai.ok'));
      } catch (err) {
        toast(t('settings.ai.failed', { detail: err.message || '' }));
      }
      testBtn.disabled = false;
      testBtn.textContent = t('settings.ai.test');
    },
  }, t('settings.ai.test'));

  const ai = h('section', { class: 'card' },
    h('h2', null, t('settings.ai.title')),
    status,
    h('p', null, CONFIG.ai.proxyUrl ? t('settings.ai.introSite') : t('settings.ai.introNoSite')),
    h('details', { open: Boolean(s.ai.key) || !CONFIG.ai.proxyUrl },
      h('summary', null, t('settings.ai.ownKey')),
      h('p', { class: 'hint' }, t('settings.ai.keyHint')),
      h('label', { class: 'label', for: 'ai-provider' }, t('settings.ai.provider')), provider,
      h('label', { class: 'label', for: 'ai-key' }, t('settings.ai.key')), key,
      baseRow,
      h('label', { class: 'label', for: 'ai-model' }, t('settings.ai.model')), model,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn-ink', onclick: () => { saveAi(); drawStatus(); toast(t('settings.saved')); } }, t('settings.save')),
        testBtn,
        h('button', {
          type: 'button', class: 'btn btn-quiet',
          onclick: () => { key.value = ''; saveAi(); drawStatus(); toast(t('settings.ai.removed')); },
        }, t('settings.ai.remove')))));

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
        store.importJSON(await f.text());
        toast(t('settings.imported'));
        rerenderAll();
      } catch {
        toast(t('settings.importFailed'));
      }
      e.target.value = '';
    },
  });
  let armed = false;
  const clear = h('button', {
    type: 'button', class: 'btn btn-quiet btn-danger',
    onclick: () => {
      if (!armed) { armed = true; clear.textContent = t('settings.clearSure'); setTimeout(() => { armed = false; clear.textContent = t('settings.clear'); }, 4000); return; }
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
      h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => file.click() }, t('settings.import')),
      file, clear));

  mount(root,
    h('header', { class: 'view-head' }, h('h1', null, t('settings.title'))),
    language, appearance, ai, sound, data);
  syncProvider();
  drawStatus();
}
