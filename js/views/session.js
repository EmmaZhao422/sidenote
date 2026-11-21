// A study block, from start to finish:
//
//   setup  ->  prep (plan + settle in)  ->  focus  ->  wrap (rate it)  ->  review
//
// The block in progress is kept in store.state.active, with real timestamps,
// so the timer stays correct in a background tab and survives a reload.

import { h, mount, toast, announce, clock, segmented, isTouchDevice, timeLabel } from '../ui.js';
import { t, getLang } from '../i18n.js';
import { store, TAB_ID } from '../store.js';
import { startBlock, heldElsewhere, settleCarried, takeFresh } from '../block.js';
import { breakTimer } from '../breaktimer.js';
import { SCENES, getScene, sceneName, sceneBlurb } from '../scenes.js';
import { audio } from '../audio.js';
import { createBackdrop } from '../backdrop.js';
import { computeFocusScore, recommendScene } from '../score.js';
import { aiMode, suggestSteps } from '../ai.js';

const SETTLE_SHARE = 0.4;      // the last 40% of prep is for breathing, not planning
const HEARTBEAT_MS = 5000;
// Browsers slow a hidden tab's timers to as little as one tick a minute, so only a
// longer silence than that is taken to mean the computer itself was asleep.
const SLEEP_GAP_MS = 120000;
const MIN_BLOCK_MS = 60000;     // shorter than this is not saved as a study block

export function sessionView(root, navigate) {
  let ticker = 0;
  let heartbeat = 0;
  let backdrop = null;
  let offVisibility = null;
  let offActivity = null;
  let yielded = false;   // true once another tab has taken this block over
  let refreshMargin = null; // redraws the count and list of parked thoughts, while the block is on screen
  const baseTitle = document.title;

  const active = () => store.state.active;
  // One rule for "parked during this block" on every screen: everything with this block's id
  const parkedIn = (id) => store.state.thoughts.filter((x) => x.sessionId === id);
  // When this tab last proved it was alive (used to date a pause after a reload or a crash)
  const lastAlive = (a) => { const b = store.lastBeat(); return Math.max(b.tab === TAB_ID ? b.at : 0, a.lastSeenAt || 0, a.focusStartedAt || 0) || Date.now(); };
  const save = (patch) => store.patchActive(patch);

  // Phones lock their screen after a minute or so, which would stop the sound and
  // look like the student left. A "wake lock" asks the device to stay on.
  let wakeLock = null;
  async function keepAwake() {
    try {
      if ('wakeLock' in navigator && !document.hidden) wakeLock = await navigator.wakeLock.request('screen');
    } catch { /* not supported or refused (low battery): the block still works */ }
  }
  function letSleep() {
    wakeLock?.release?.().catch(() => {});
    wakeLock = null;
  }

  function cleanupStage() {
    letSleep();
    clearInterval(ticker);
    clearInterval(heartbeat);
    ticker = heartbeat = 0;
    offVisibility?.();
    offVisibility = null;
    offActivity?.();
    offActivity = null;
    backdrop?.destroy();
    backdrop = null;
    document.title = baseTitle;
    document.body.classList.remove('is-immersed');
  }

  function show(...nodes) {
    cleanupStage();
    root.replaceChildren(...nodes);
    window.scrollTo(0, 0);
  }

  // Dark full-screen stage with the scene's backdrop behind it
  function showStage(scene, ...children) {
    const canvas = h('canvas', { class: 'stage-canvas', 'aria-hidden': 'true' });
    show(h('section', { class: 'stage' }, canvas, h('div', { class: 'stage-inner' }, children)));
    document.body.classList.add('is-immersed');
    backdrop = createBackdrop(canvas);
    backdrop.setScene(scene);
  }

  function volumeControl() {
    const input = h('input', {
      type: 'range', min: '0', max: '1', step: '0.05', value: String(store.state.settings.volume),
      'aria-label': t('focus.volume'),
      oninput: (e) => {
        const v = Number(e.target.value);
        audio.setVolume(v);
        store.setSettings({ volume: v });
      },
    });
    return h('label', { class: 'volume' }, h('span', null, t('focus.volume')), input);
  }

  // ------------------------------------------------------------------ setup
  function renderSetup() {
    const s = store.state.settings;
    const lang = getLang();
    const touch = isTouchDevice();
    const draft = { goal: '', minutes: s.focusMin, scene: s.scene, mode: s.studyMode, prep: [5, 2, 0].includes(s.prepMin) ? s.prepMin : 5 };
    const rec = recommendScene(store.state.sessions);
    const bestId = rec.status === 'ready' ? rec.best.id : null;

    const goal = h('input', {
      type: 'text', id: 'goal', class: 'field', maxlength: '120', autocomplete: 'off', enterkeyhint: 'go',
      placeholder: t('setup.goalPlaceholder'),
      oninput: (e) => { draft.goal = e.target.value; },
    });

    // --- how long: three usual lengths, or any other number of minutes
    const presets = [25, 45, 60];
    const isPreset = presets.includes(draft.minutes);
    const custom = h('input', {
      type: 'number', inputmode: 'numeric', class: 'field field-small', min: '5', max: '180',
      value: String(draft.minutes), 'aria-label': t('setup.customMinutes'),
      oninput: () => {
        const v = Math.round(Number(custom.value));
        const ok = v >= 5 && v <= 180;
        if (ok) draft.minutes = v;
        clampHint.hidden = ok || custom.value === '';
      },
      onblur: () => { custom.value = String(draft.minutes); clampHint.hidden = true; },
    });
    const clampHint = h('span', { class: 'hint', role: 'status', hidden: true }, t('setup.clamp'));
    const customWrap = h('span', { class: 'row setup-custom', hidden: isPreset }, custom, h('span', { class: 'hint' }, t('setup.minutes')), clampHint);
    const length = segmented(t('setup.length'),
      [...presets.map((m) => ({ value: m, label: t('unit.min', { n: m }) })), { value: 'other', label: t('setup.other') }],
      isPreset ? draft.minutes : 'other',
      (v) => {
        customWrap.hidden = v !== 'other';
        if (v === 'other') {
          custom.value = String(draft.minutes);
          const byKeyboard = document.activeElement?.matches?.('.seg-btn:focus-visible');
          if (!byKeyboard) { custom.focus(); custom.select(); }
        }
        else draft.minutes = v;
      });

    // --- sound, where, warm-up: remembered from last time, tucked away
    const sceneGrid = h('div', { class: 'scene-pick', role: 'radiogroup', 'aria-label': t('setup.scene') });
    SCENES.forEach((sc) => {
      const btn = h('button', {
        type: 'button', class: 'scene-chip', role: 'radio', 'aria-checked': String(sc.id === draft.scene),
        style: `--sky-a:${sc.sky[0]};--sky-b:${sc.sky[1]}`,
        onclick: () => {
          draft.scene = sc.id;
          sceneGrid.querySelectorAll('.scene-chip').forEach((b) => b.setAttribute('aria-checked', 'false'));
          btn.setAttribute('aria-checked', 'true');
          blurb.textContent = sceneBlurb(sc, lang);
          drawChoices();
        },
      }, sceneName(sc, lang), sc.id === bestId ? h('span', { class: 'scene-best' }, t('setup.yourBest')) : null);
      sceneGrid.append(btn);
    });
    // one Tab stop, arrows move and choose (the same as every other option group)
    const chips = () => [...sceneGrid.querySelectorAll('.scene-chip')];
    const rove = () => chips().forEach((b) => { b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1; });
    rove();
    sceneGrid.addEventListener('click', rove);
    sceneGrid.addEventListener('keydown', (e) => {
      const all = chips();
      const at = all.indexOf(document.activeElement);
      const to = { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: all.length - 1 }[e.key];
      if (to === undefined || at < 0) return;
      e.preventDefault();
      const next = all[(to + all.length) % all.length];
      next.focus();
      next.click();
    });
    const blurb = h('p', { class: 'hint' }, sceneBlurb(getScene(draft.scene), lang));

    const hintFor = (m) => t(m === 'paper' && touch ? 'setup.modeHint.paperTouch' : `setup.modeHint.${m}`);
    const mode = segmented(t('setup.where'), [
      { value: 'paper', label: t('setup.modePaper') },
      { value: 'screen', label: t('setup.modeScreen') },
    ], draft.mode, (v) => { draft.mode = v; modeHint.textContent = hintFor(v); drawChoices(); });
    const modeHint = h('p', { class: 'hint' }, hintFor(draft.mode));

    const prep = segmented(t('setup.prep'), [
      { value: 5, label: t('unit.min', { n: 5 }) },
      { value: 2, label: t('unit.min', { n: 2 }) },
      { value: 0, label: t('setup.prepSkip') },
    ], draft.prep, (v) => { draft.prep = v; drawChoices(); });

    // In a hurry: go straight to the timer this once, without changing the saved habit
    const skipPrep = h('button', {
      type: 'button', class: 'linklike setup-skip',
      onclick: () => {
        const keep = store.state.settings.prepMin;
        startBlock({ goal: draft.goal, minutes: draft.minutes, scene: draft.scene, mode: draft.mode, prep: 0 });
        store.setSettings({ prepMin: keep });
        render();
      },
    }, t('setup.skipOnce'));

    const choices = h('span', { class: 'setup-choices' });
    const start = h('button', { type: 'submit', class: 'btn btn-ink btn-big' });
    function drawChoices() {
      choices.replaceChildren(...[
        sceneName(getScene(draft.scene), lang),
        t(draft.mode === 'paper' ? 'setup.modePaperLong' : 'setup.modeScreenLong'),
        draft.prep ? t('setup.prepShort', { n: draft.prep }) : t('setup.prepNone'),
      ].map((text) => h('span', null, text)));
      start.textContent = draft.prep ? t('setup.start') : t('setup.startNow');
      skipPrep.hidden = !draft.prep;
    }
    drawChoices();

    const more = h('details', { class: 'setup-more' },
      h('summary', null, choices, h('span', { class: 'setup-change' }, t('setup.change'))),
      h('div', { class: 'label' }, t('setup.scene')), sceneGrid, blurb,
      h('div', { class: 'label' }, t('setup.where')), mode, modeHint,
      h('div', { class: 'label' }, t('setup.prep')), prep, h('p', { class: 'hint' }, t('setup.prepHint')));

    const waiting = (store.state.nextPlan || []).length;

    const form = h('form', {
      class: 'setup',
      onsubmit: (e) => {
        e.preventDefault();
        startBlock({ goal: draft.goal, minutes: draft.minutes, scene: draft.scene, mode: draft.mode, prep: draft.prep });
        render();
      },
    },
    h('h1', null, t('setup.title')),
    h('p', { class: 'lede' }, t('setup.lede')),
    h('label', { class: 'label', for: 'goal' }, t('setup.goal')), goal,
    h('div', { class: 'label' }, t('setup.length')), h('div', { class: 'row' }, length, customWrap),
    h('div', { class: 'label' }, t('setup.moreLabel')), more,
    waiting ? h('p', { class: 'hint setup-carried' }, t('setup.carried', { n: waiting })) : null,
    h('div', { class: 'row setup-go' }, start, skipPrep));

    show(form);
    // On a phone, focusing the box would throw the keyboard over the whole form
    if (!touch) goal.focus();
  }

  // Shown when the block on record is running in another tab right now
  function renderElsewhere() {
    audio.stop(0.5);
    show(h('section', { class: 'setup' },
      h('h1', null, t('setup.elsewhereTitle')),
      h('p', { class: 'lede' }, t('setup.elsewhereBody')),
      h('button', {
        type: 'button', class: 'btn btn-ink',
        onclick: () => { yielded = false; takeOver(); render(); },
      }, t('setup.takeOver'))));
  }

  // ------------------------------------------------------------------- prep
  function renderPrep() {
    document.title = baseTitle; // no countdown in the tab title outside the block itself
    const a = active();
    const scene = getScene(a.scene);
    const totalMs = a.prepMin * 60000;
    const settleMs = totalMs * SETTLE_SHARE;

    const countdown = h('span', { class: 'prep-clock' }, clock(totalMs / 1000));
    const body = h('div', { class: 'prep-body' });

    breakTimer.stop(); // a break left running would chime in the middle of the block
    const beginFocus = () => {
      // Read whatever is in the step boxes before leaving
      savePlan();
      save({ stage: 'focus', focusStartedAt: Date.now(), lastSeenAt: Date.now() });
      store.beat();
      render();
    };

    // --- phase 1: plan
    const goal = h('input', {
      type: 'text', class: 'field field-dark', maxlength: '120', value: a.goal,
      placeholder: t('setup.goalPlaceholder'), 'aria-label': t('setup.goal'),
    });
    // The goal was just typed on the previous screen, so it is shown as a heading
    // here and only becomes a box again if the student wants to change it.
    const goalLine = h('p', { class: 'prep-goal' }, h('span', null, a.goal),
      h('button', {
        type: 'button', class: 'linklike',
        onclick: () => { goalLine.replaceWith(goal); goal.focus(); },
      }, t('prep.goalEdit')));
    let lastTyped = 0;
    const stepInputs = [0, 1, 2].map((i) => h('input', {
      type: 'text', class: 'field field-dark', maxlength: '90', value: a.steps[i]?.text || '',
      placeholder: t(`prep.step${i + 1}`), 'aria-label': t('prep.stepLabel', { n: i + 1 }),
    }));
    function savePlan() {
      if (!stepInputs[0].isConnected) return;
      save({
        goal: goal.value.trim(),
        steps: stepInputs.map((el) => el.value.trim()).filter(Boolean).map((text) => ({ text, done: false })),
      });
    }

    const suggest = aiMode() === 'offline' ? null : h('button', {
      type: 'button', class: 'btn btn-ghost',
      onclick: async () => {
        if (!goal.value.trim()) { toast(t('prep.needGoal')); goal.focus(); return; }
        suggest.disabled = true;
        suggest.textContent = t('prep.suggesting');
        try {
          const steps = await suggestSteps(goal.value.trim(), a.plannedMin);
          steps.forEach((text, i) => { if (stepInputs[i]) stepInputs[i].value = text; });
        } catch {
          toast(t('prep.suggestFailed'));
        }
        suggest.disabled = false;
        suggest.textContent = t('prep.suggest');
      },
    }, t('prep.suggest'));

    const parkedList = h('ul', { class: 'prep-parked' });
    const drawParked = () => {
      parkedList.replaceChildren(...store.state.thoughts
        .filter((x) => x.sessionId === a.id)
        .map((x) => h('li', null, x.text)));
    };
    const dump = h('input', {
      type: 'text', class: 'field field-dark', maxlength: '500', autocomplete: 'off',
      placeholder: t('prep.dumpPlaceholder'), 'aria-label': t('prep.dumpTitle'),
    });
    const dumpForm = h('form', {
      class: 'row',
      onsubmit: (e) => {
        e.preventDefault();
        if (store.addThought(dump.value, { sessionId: a.id })) { dump.value = ''; drawParked(); }
      },
    }, dump, h('button', { type: 'submit', class: 'btn btn-ghost' }, t('park.button')));

    // What is typed is saved shortly after each keystroke, so a reload loses nothing
    let saveSoon = 0;
    // ...and at once if the page is being closed or reloaded
    window.addEventListener('pagehide', savePlan);
    offActivity = () => window.removeEventListener('pagehide', savePlan);
    const planPhase = h('div', { class: 'prep-plan', oninput: () => { lastTyped = Date.now(); clearTimeout(saveSoon); saveSoon = setTimeout(savePlan, 300); } },
      h('div', { class: 'prep-col' },
        h('h2', null, t('prep.planTitle')),
        a.goal ? goalLine : goal,
        h('p', { class: 'stage-hint' }, t('prep.planHint', { n: a.plannedMin })),
        ...stepInputs, suggest),
      h('div', { class: 'prep-col' },
        h('h2', null, t('prep.dumpTitle')),
        h('p', { class: 'stage-hint' }, t('prep.dumpHint')),
        dumpForm, parkedList),
    );

    // --- phase 2: settle in
    const breathWord = h('span', { class: 'breath-word' }, t('prep.breatheIn'));
    // A negative delay lines the ring's 10-second cycle up with the clock the words follow
    const ring = h('div', { class: 'breath-ring', style: `animation-delay:-${((Date.now() / 1000) % 10).toFixed(2)}s` });
    const settlePhase = h('div', { class: 'prep-settle' },
      h('div', { class: 'breath', 'aria-hidden': 'true' }, ring),
      breathWord,
      h('p', { class: 'stage-hint' }, t('prep.settleHint')),
      h('p', { class: 'prep-first', dir: 'auto', hidden: true }),
    );

    const toSettle = h('button', {
      type: 'button', class: 'btn btn-paper',
      onclick: () => { savePlan(); save({ settling: true }); drawPhase(); title.tabIndex = -1; title.focus(); },
    }, t('prep.planReady'));
    const startNow = h('button', { type: 'button', class: 'btn btn-ghost', onclick: beginFocus }, t('prep.startNow'));
    const foot = h('div', { class: 'stage-foot' });
    // while planning, the way out is a link by the countdown; on the breathing
    // screen the button at the bottom says the same thing, so the link goes
    const skipLink = h('button', { type: 'button', class: 'linklike prep-skip', onclick: beginFocus }, t('prep.startNow'));

    function drawPhase() {
      const settling = active().settling;
      skipLink.hidden = !!settling;
      body.replaceChildren(settling ? settlePhase : planPhase);
      foot.replaceChildren(...(settling ? [startNow] : [toSettle]), volumeControl());
      title.textContent = settling ? t('prep.settleTitle') : t('prep.title');
      // the breathing screen says "look at your first step", so it shows it
      const first = (active().steps || []).find((x) => x && x.text);
      const firstLine = settlePhase.querySelector('.prep-first');
      firstLine.textContent = first ? first.text : (active().goal || '');
      firstLine.hidden = !firstLine.textContent;
    }

    const title = h('h1', { class: 'stage-title' }, t('prep.title'));
    showStage(scene,
      h('header', { class: 'stage-head' }, title,
        h('p', { class: 'prep-count' }, t('prep.startsIn'), ' ', countdown,
          skipLink)),
      body, foot);
    drawParked();
    drawPhase();
    audio.play(a.scene, 3); // already playing after "Get ready"; this covers a reload
    if (!active().settling && !isTouchDevice()) (a.goal ? stepInputs.find((el) => !el.value) || stepInputs[0] : goal).focus();

    let lastTick = Date.now();
    ticker = setInterval(() => {
      // The laptop was asleep: the get-ready time did not really pass, so push its start forward
      const gap = Date.now() - lastTick;
      lastTick = Date.now();
      if (gap > SLEEP_GAP_MS) save({ prepStartedAt: active().prepStartedAt + gap });
      const left = totalMs - (Date.now() - active().prepStartedAt);
      countdown.textContent = clock(left / 1000);
      // 4 seconds in, 6 seconds out
      const phase = (Date.now() / 1000) % 10;
      breathWord.textContent = phase < 4 ? t('prep.breatheIn') : t('prep.breatheOut');
      // Move on to breathing when the planning time is up, but never mid-sentence:
      // wait until the student has stopped typing for a while.
      const idle = Date.now() - lastTyped > 15000;
      if (!active().settling && left <= settleMs && (idle || left <= 20000)) { savePlan(); save({ settling: true }); drawPhase(); }
      if (left <= 0) beginFocus();
    }, 250);
    store.beat();
    heartbeat = setInterval(() => { if (active()?.owner === TAB_ID) store.beat(); }, HEARTBEAT_MS);
  }

  // ------------------------------------------------------------------ focus
  function elapsedMs(a = active()) {
    const end = a.pausedAt ?? Date.now();
    return Math.min(a.plannedMin * 60000, Math.max(0, end - a.focusStartedAt - a.pausedMs));
  }

  function renderFocus() {
    breakTimer.stop();
    const a = active();
    const scene = getScene(a.scene);
    const plannedMs = a.plannedMin * 60000;

    const timer = h('div', { class: 'timer', role: 'timer', 'aria-label': t('focus.timeLeft') });
    const drawTimer = () => {
      const text = clock((plannedMs - elapsedMs()) / 1000);
      // one fixed-width box per character so the digits don't jiggle
      timer.replaceChildren(...[...text].map((ch) => h('span', { class: ch === ':' ? 'timer-colon' : 'timer-digit', 'aria-hidden': 'true' }, ch)));
      // read out as a time, not as five separate characters
      const [mm, ss] = text.split(':').map(Number);
      timer.setAttribute('aria-label', t('focus.timeLeftSaid', { m: mm, s: ss }));
      document.title = `${text} · ${baseTitle}`;
    };

    // goal + steps
    const steps = h('ul', { class: 'focus-steps' });
    a.steps.forEach((step, i) => {
      const id = `step-${i}`;
      steps.append(h('li', null,
        h('input', {
          type: 'checkbox', id, checked: step.done,
          onchange: (e) => {
            const next = active().steps.map((s, j) => (j === i ? { ...s, done: e.target.checked } : s));
            save({ steps: next });
          },
        }),
        h('label', { for: id }, step.text)));
    });

    // the margin: where stray thoughts go
    // Only a count is shown while studying: reading the list back would be its own distraction.
    const mine = () => parkedIn(a.id);
    // The count is a button: one press shows what has been parked (to fix a typo or
    // check it landed), and the list folds away again when the margin rests.
    const peek = h('ul', { class: 'margin-peek', id: 'margin-peek', hidden: true });
    const count = h('button', {
      type: 'button', class: 'margin-count', 'aria-expanded': 'false', 'aria-controls': 'margin-peek',
      onclick: () => showPeek(peek.hidden),
    });
    const showPeek = (on) => {
      peek.hidden = !on || !mine().length;
      count.setAttribute('aria-expanded', String(!peek.hidden));
      drawMargin();
    };
    const drawMargin = () => {
      const list = mine();
      const n = list.length;
      count.disabled = !n;
      count.textContent = !n ? t('focus.marginEmpty')
        : `${t('focus.inMargin', { n })} · ${t(peek.hidden ? 'focus.peekShow' : 'focus.peekHide')}`;
      if (!peek.hidden) {
        mount(peek, list.map((x) => h('li', { dir: 'auto' },
          h('span', null, x.text),
          h('button', {
            type: 'button', class: 'margin-peek-x', 'aria-label': t('focus.peekRemove', { text: x.text.slice(0, 40) }), title: t('note.delete'),
            onclick: () => { store.deleteThought(x.id); if (!mine().length) peek.hidden = true; drawMargin(); input.focus(); announce(t('note.deleted', { text: x.text.slice(0, 60) })); },
          }, '×'))));
        peek.scrollTop = peek.scrollHeight;
      }
    };

    const input = h('input', {
      type: 'text', class: 'margin-input', maxlength: '500', autocomplete: 'off', dir: 'auto', enterkeyhint: 'done',
      placeholder: t(window.innerWidth < 560 ? 'focus.parkPlaceholderShort' : 'focus.parkPlaceholder'), 'aria-label': t('focus.parkLabel'),
    });
    const flash = h('span', { class: 'margin-flash', 'aria-live': 'polite' });
    const strip = h('form', {
      class: 'margin-strip',
      onsubmit: (e) => {
        e.preventDefault();
        const cur = active();
        const offsetSec = Math.round(elapsedMs(cur) / 1000); // while paused: the minute the clock stopped at
        if (!store.addThought(input.value, { sessionId: cur.id, offsetSec })) return;
        input.value = '';
        drawMargin();
        flash.textContent = t(window.innerWidth < 560 || cur.pausedAt ? 'focus.parkedShort' : 'focus.parked');
        flash.classList.remove('is-on');
        void flash.offsetWidth; // restart the fade animation
        flash.classList.add('is-on');
      },
    }, input, h('button', { type: 'submit', class: 'btn btn-ink' }, t('park.button')));

    // pause / end
    const pauseBtn = h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => togglePause() });
    const endBtn = h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => finish() }, t('focus.end'));
    const pausedBanner = h('p', { class: 'paused-banner', role: 'status', hidden: true }, t('focus.paused'));
    const endsAt = h('p', { class: 'ends-at' });

    function drawPause() {
      const cur = active();
      const paused = Boolean(cur.pausedAt);
      pauseBtn.textContent = paused ? t('focus.resume') : t('focus.pause');
      pausedBanner.hidden = !paused;
      timer.classList.toggle('is-paused', paused);
      backdrop?.setRunning?.(!paused);
      // The clock time the block ends, so a glance at a watch is enough
      endsAt.hidden = paused;
      endsAt.textContent = t('focus.endsAt', { time: timeLabel(Date.now() + plannedMs - elapsedMs(cur)) });
    }

    function togglePause() {
      const cur = active();
      if (cur.pausedAt) {
        save({ pausedMs: cur.pausedMs + (Date.now() - cur.pausedAt), pausedAt: null, lastSeenAt: Date.now() });
        store.beat();
        audio.play(cur.scene, 1.5);
      } else {
        save({ pausedAt: Date.now(), pauses: cur.pauses + 1, awaySince: null });
        audio.stop(0.6);
      }
      drawPause();
      drawTimer();
    }

    function finish() {
      const cur = active();
      // Under a minute isn't a study block. Keep the thoughts, drop the block.
      if (elapsedMs(cur) < MIN_BLOCK_MS) {
        store.state.thoughts.filter((x) => x.sessionId === cur.id)
          .forEach((x) => store.updateThought(x.id, { sessionId: null, offsetSec: null }));
        settleCarried(cur.carried);
        store.setActive(null);
        audio.stop(0.8);
        cleanupStage();
        toast(t('focus.tooShort'));
        navigate('#/');
        return;
      }
      const patch = { stage: 'wrap', endedAt: Date.now(), focusMs: elapsedMs(cur) };
      if (cur.pausedAt) { patch.pausedMs = cur.pausedMs + (Date.now() - cur.pausedAt); patch.pausedAt = null; }
      // If the timer was noticed late (a throttled background tab), the extra seconds are
      // not study time: count them as paused, so the clock and the record agree.
      const paused = patch.pausedMs ?? cur.pausedMs;
      const over = (patch.endedAt - cur.focusStartedAt - paused) - patch.focusMs;
      if (over > 0) patch.pausedMs = paused + over;
      if (cur.awaySince) { patch.awayMs = cur.awayMs + (Date.now() - cur.awaySince); patch.awaySince = null; }
      save(patch);
      audio.stop(2.5);
      if (store.state.settings.chime) audio.chime();
      // If the tab is in the background, a system notification says the block is over
      if (store.state.settings.notify && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        try { new Notification(t('notify.title'), { body: t('notify.body'), tag: 'sidenote-block' }); } catch { /* not allowed here */ }
      }
      render();
    }

    // A phone that cannot be asked to stay awake will lock mid-block: say so once, up front
    const lockNote = isTouchDevice() && !('wakeLock' in navigator)
      ? h('p', { class: 'stage-hint lock-note' }, t('focus.noWakeLock')) : null;

    showStage(scene,
      h('header', { class: 'stage-head' },
        h('p', { class: 'focus-goal', dir: 'auto' }, a.goal || ''),
        h('div', { class: 'stage-tools' }, volumeControl(), pauseBtn, endBtn)),
      h('div', { class: 'focus-center' }, timer, endsAt, pausedBanner, steps, lockNote),
      h('div', { class: 'margin' },
        h('div', { class: 'margin-top' }, h('span', { class: 'margin-title' }, t('focus.marginTitle')), flash, count),
        peek, strip));
    drawTimer();
    drawMargin();
    refreshMargin = drawMargin;
    drawPause();
    if (!isTouchDevice()) input.focus();
    if (!a.pausedAt) audio.play(a.scene, 2);

    keepAwake();

    // The margin dims after a few idle seconds and wakes at the first key or touch
    const paper = root.querySelector('.margin');
    let restTimer = 0;
    const wake = () => {
      paper.classList.remove('is-resting');
      clearTimeout(restTimer);
      restTimer = setTimeout(() => {
        if (input.value) return;
        if (peek.contains(document.activeElement) || count === document.activeElement) { wake(); return; } // someone is reading the list
        paper.classList.add('is-resting');
        if (!peek.hidden) showPeek(false);
      }, 8000);
    };
    ['keydown', 'pointerdown', 'pointermove', 'focusin'].forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
    wake();
    offActivity = () => {
      clearTimeout(restTimer);
      ['keydown', 'pointerdown', 'pointermove', 'focusin'].forEach((ev) => window.removeEventListener(ev, wake));
    };

    // Leaving the tab while studying on paper counts as drifting.
    const onVisibility = () => {
      if (!document.hidden) keepAwake(); // the lock is dropped whenever the page is hidden
      const cur = active();
      if (!cur || cur.stage !== 'focus' || cur.pausedAt) return;
      if (cur.trackAway === false) return; // phones: a locked screen is not drifting
      if (document.hidden) {
        save({ awaySince: Date.now() });
      } else if (cur.awaySince) {
        // If the computer slept, the ticker below will pause the block from its last
        // tick. Time away is counted up to that tick only, not through the sleep as well.
        const until = Date.now() - lastTick > SLEEP_GAP_MS ? lastTick : Date.now();
        const gone = Math.max(0, until - cur.awaySince);
        save({ awayMs: cur.awayMs + gone, awayCount: cur.awayCount + (gone > 5000 ? 1 : 0), awaySince: null });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    // a last heartbeat as the page goes away, so a reload costs no study time
    const onHide = () => { const cur = active(); if (cur && cur.owner === TAB_ID && cur.stage === 'focus' && !cur.pausedAt) store.beat(true); };
    window.addEventListener('pagehide', onHide);
    // the long hint doesn't fit a phone held upright: re-pick it when the window turns or shrinks
    const fitHint = () => { input.placeholder = t(window.innerWidth < 560 ? 'focus.parkPlaceholderShort' : 'focus.parkPlaceholder'); };
    window.addEventListener('resize', fitHint);
    offVisibility = () => { document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', onHide); window.removeEventListener('resize', fitHint); };

    let lastTick = Date.now();
    ticker = setInterval(() => {
      const cur = active();
      if (!cur || cur.stage !== 'focus') return;
      // No tick for two minutes means the computer was asleep (lid closed). That time
      // was not studied: the block is paused from the moment the ticks stopped.
      const now = Date.now();
      const gap = now - lastTick;
      lastTick = now;
      const lockedPhone = isTouchDevice() && cur.mode === 'paper'; // the setup screen promises the timer runs on
      if (gap > SLEEP_GAP_MS && !cur.pausedAt && !lockedPhone) {
        save({ pausedAt: now - gap, autoPauses: (cur.autoPauses || 0) + 1, awaySince: null });
        audio.stop(0.3);
        drawPause();
        drawTimer();
        toast(t('focus.sleptPaused'), 6000);
        return;
      }
      drawTimer();
      if (!cur.pausedAt && elapsedMs(cur) >= plannedMs) finish();
    }, 250);
    store.beat();
    heartbeat = setInterval(() => {
      if (active()?.owner === TAB_ID && !active().pausedAt) store.beat();
    }, HEARTBEAT_MS);
  }

  // ------------------------------------------------------------------- wrap
  function renderWrap() {
    document.title = baseTitle; // no countdown in the tab title outside the block itself
    const a = active();
    const scene = getScene(a.scene);
    const focusSec = Math.round((a.focusMs ?? elapsedMs(a)) / 1000);
    const parked = parkedIn(a.id).length;
    const answers = { rating: null, finished: null };

    const rating = segmented(t('wrap.ratingLabel'),
      [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })), null,
      (v) => { answers.rating = v; ratingWord.textContent = t(`wrap.rating${v}`); check(); });
    const ratingWord = h('p', { class: 'hint' }, t('wrap.ratingHint'));
    const finished = segmented(t('wrap.finishedLabel'), [
      { value: 'yes', label: t('wrap.yes') },
      { value: 'partly', label: t('wrap.partly') },
      { value: 'no', label: t('wrap.no') },
    ], null, (v) => { answers.finished = v; check(); });

    // The button is never taken out of the Tab order: while an answer is missing it
    // is marked unavailable, says why, and sends the cursor to the unanswered question.
    const saveBtn = h('button', { type: 'button', class: 'btn btn-ink btn-big', 'aria-disabled': 'true', 'aria-describedby': 'wrap-need',
      onclick: () => {
        if (answers.rating && answers.finished) { commit(); return; }
        announce(t('wrap.need'));
        (answers.rating ? finished : rating).querySelector('[tabindex="0"]')?.focus();
      } },
      parked ? t('wrap.saveAndSort', { n: parked }) : t('wrap.save'));
    const need = h('p', { class: 'hint wrap-need', id: 'wrap-need' }, t('wrap.need'));
    const check = () => { const ready = Boolean(answers.rating && answers.finished); saveBtn.setAttribute('aria-disabled', String(!ready)); need.hidden = ready; };

    function commit() {
      const cur = active();
      const session = {
        id: cur.id,
        startedAt: cur.focusStartedAt,
        endedAt: cur.endedAt || Date.now(),
        plannedMin: cur.basePlannedMin ?? cur.plannedMin,
        focusSec,
        pauses: cur.pauses,
        autoPauses: cur.autoPauses || 0, // reloads, a closed lid, leaving the screen: recorded, never scored
        pausedSec: Math.round(cur.pausedMs / 1000),
        awaySec: Math.round(cur.awayMs / 1000),
        awayCount: cur.awayCount,
        mode: cur.mode,
        scene: cur.scene,
        goal: cur.goal,
        steps: cur.steps,
        rating: answers.rating,
        finished: answers.finished,
        parkedCount: parked,
      };
      const parts = computeFocusScore(session);
      session.score = parts.score;
      session.parts = parts;
      store.addSession(session);
      settleCarried(cur.carried, cur.steps);
      store.setActive(null);
      cleanupStage();
      navigate(`#/review/${session.id}`);
    }

    const more = h('button', {
      type: 'button', class: 'linklike',
      onclick: () => {
        const cur = active();
        // Carry on: ten more minutes on the same clock
        // basePlannedMin remembers the original plan, so extra time isn't scored as "stopped early"
        // Everything on the wall clock that was not counted as focus becomes "paused", so the
        // timer picks up exactly where the block stopped and the next ten minutes are a full ten.
        const done = cur.focusMs ?? 0;
        save({ stage: 'focus', basePlannedMin: cur.basePlannedMin ?? cur.plannedMin,
          plannedMin: Math.ceil(done / 60000) + 10, endedAt: null, focusMs: null,
          pausedMs: Date.now() - cur.focusStartedAt - done, lastSeenAt: Date.now() });
        audio.play(cur.scene, 1.5);
        render();
      },
    }, t('wrap.more'));

    let armed = false;
    const discard = h('button', {
      type: 'button', class: 'linklike',
      onclick: () => {
        if (!armed) { armed = true; discard.textContent = t('wrap.discardSure'); announce(t('wrap.discardSure')); return; }
        // The parked thoughts are kept; only the block itself is thrown away.
        store.state.thoughts.filter((x) => x.sessionId === a.id)
          .forEach((x) => store.updateThought(x.id, { sessionId: null, offsetSec: null }));
        settleCarried(active().carried);
        store.setActive(null);
        cleanupStage();
        navigate('#/');
      },
    }, t('wrap.discard'));

    const wrapTitle = h('h1', { tabindex: '-1' }, t('wrap.title'));
    showStage(scene,
      h('div', { class: 'wrap-card' },
        // focus lands here, and screen readers announce it: the chime alone is not enough
        wrapTitle,
        h('p', { class: 'lede' }, t('wrap.summary', { min: Math.max(1, Math.round(focusSec / 60)), n: parked })),
        h('div', { class: 'label' }, t('wrap.ratingLabel')), rating, ratingWord,
        h('div', { class: 'label' }, t('wrap.finishedLabel')), finished,
        saveBtn, need,
        h('p', { class: 'wrap-links' }, more, discard)));
    wrapTitle.focus({ preventScroll: true });
  }

  // ----------------------------------------------------------------- router
  function takeOver() {
    const a = active();
    if (!a) return;
    const patch = { owner: TAB_ID, lastSeenAt: Date.now() };
    if (a.stage === 'prep') Object.assign(patch, { prepStartedAt: Date.now() });
    // The time since the other tab last touched the block is treated as a pause
    else if (a.stage === 'focus' && !a.pausedAt) Object.assign(patch, { pausedAt: Math.min(Date.now(), Math.max(store.lastBeat().at, a.lastSeenAt || 0, a.focusStartedAt || 0) || Date.now()), autoPauses: (a.autoPauses || 0) + 1, awaySince: null });
    save(patch);
  }

  function render() {
    const a = active();
    if (!a) return renderSetup();
    if (a.owner !== TAB_ID && (yielded || heldElsewhere(a))) return renderElsewhere();
    if (a.owner !== TAB_ID) takeOver();
    if (a.stage === 'prep') return renderPrep();
    if (a.stage === 'focus') return renderFocus();
    return renderWrap();
  }

  audio.setVolume(store.state.settings.volume);

  // Coming back after a reload or a closed tab (same tab: the block picks up paused)
  const a = active();
  if (a && !takeFresh(a.id) && (a.owner === TAB_ID || !a.owner)) {
    if (a.stage === 'prep') {
      // the get-ready clock carries on from where it was, in the same phase
      save({ owner: TAB_ID, prepStartedAt: Date.now() - Math.min(a.prepMin * 60000, Math.max(0, lastAlive(a) - a.prepStartedAt)) });
    } else if (a.stage === 'focus' && !a.pausedAt) {
      // The time the page was closed is treated as a pause, starting at the last heartbeat.
      save({ owner: TAB_ID, pausedAt: lastAlive(a), autoPauses: (a.autoPauses || 0) + 1, awaySince: null });
    }
  }
  render();

  // If another tab ends, takes over or changes the block, follow it
  const stopWatching = store.subscribe((_, info) => {
    if (!info?.external) return;
    const cur = active();
    // Another tab took the block over: step aside here instead of grabbing it back
    if (cur && cur.owner !== TAB_ID) yielded = true;
    if (!cur || cur.owner !== TAB_ID) render();
    else refreshMargin?.();
  });

  return function destroy() {
    stopWatching();
    cleanupStage();
    // Walking away from a block mid-way pauses it rather than losing it.
    const cur = active();
    if (cur && cur.owner === TAB_ID && cur.stage === 'focus' && !cur.pausedAt) toast(t('focus.leftPaused'), 5000);
    if (cur && cur.owner === TAB_ID && cur.stage === 'focus' && !cur.pausedAt) save({ pausedAt: Date.now(), autoPauses: (cur.autoPauses || 0) + 1, awaySince: null });
    audio.stop(0.8);
  };
}
