// A study block, from start to finish:
//
//   setup  ->  prep (plan + settle in)  ->  focus  ->  wrap (rate it)  ->  review
//
// The block in progress is kept in store.state.active, with real timestamps,
// so the timer stays correct in a background tab and survives a reload.

import { h, toast, clock, segmented } from '../ui.js';
import { t, getLang } from '../i18n.js';
import { store, uid } from '../store.js';
import { SCENES, getScene, sceneName, sceneBlurb } from '../scenes.js';
import { audio } from '../audio.js';
import { createBackdrop } from '../backdrop.js';
import { computeFocusScore, recommendScene } from '../score.js';
import { aiMode, suggestSteps } from '../ai.js';

const SETTLE_SHARE = 0.4;      // the last 40% of prep is for breathing, not planning
const HEARTBEAT_MS = 5000;
const MIN_BLOCK_MS = 60000;     // shorter than this is not saved as a study block

export function sessionView(root, navigate) {
  let ticker = 0;
  let heartbeat = 0;
  let backdrop = null;
  let offVisibility = null;
  const baseTitle = document.title;

  const active = () => store.state.active;
  const save = (patch) => store.setActive({ ...active(), ...patch });

  function cleanupStage() {
    clearInterval(ticker);
    clearInterval(heartbeat);
    ticker = heartbeat = 0;
    offVisibility?.();
    offVisibility = null;
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
    const draft = { goal: '', minutes: s.focusMin, scene: s.scene, mode: s.studyMode, prep: s.prepMin };
    const rec = recommendScene(store.state.sessions);
    const bestId = rec.status === 'ready' ? rec.best.id : null;

    const goal = h('input', {
      type: 'text', id: 'goal', class: 'field', maxlength: '120', autocomplete: 'off',
      placeholder: t('setup.goalPlaceholder'),
      oninput: (e) => { draft.goal = e.target.value; },
    });

    const custom = h('input', {
      type: 'number', class: 'field field-small', min: '5', max: '180', value: String(draft.minutes),
      'aria-label': t('setup.customMinutes'),
      oninput: (e) => {
        const v = Math.round(Number(e.target.value));
        if (v >= 5 && v <= 180) draft.minutes = v;
      },
    });
    const presets = [25, 45, 60];
    const length = segmented(t('setup.length'), presets.map((m) => ({ value: m, label: t('unit.min', { n: m }) })),
      presets.includes(draft.minutes) ? draft.minutes : null,
      (v) => { draft.minutes = v; custom.value = String(v); });

    const sceneGrid = h('div', { class: 'scene-pick', role: 'radiogroup', 'aria-label': t('setup.scene') });
    SCENES.forEach((sc) => {
      const btn = h('button', {
        type: 'button', class: 'scene-chip', role: 'radio', 'aria-checked': String(sc.id === draft.scene),
        style: `--sky-a:${sc.sky[0]};--sky-b:${sc.sky[1]}`,
        onclick: () => {
          draft.scene = sc.id;
          sceneGrid.querySelectorAll('.scene-chip').forEach((b) => b.setAttribute('aria-checked', 'false'));
          btn.setAttribute('aria-checked', 'true');
          blurb.textContent = sceneBlurb(sc, getLang());
        },
      }, sceneName(sc, getLang()), sc.id === bestId ? h('span', { class: 'scene-best' }, t('setup.yourBest')) : null);
      sceneGrid.append(btn);
    });
    const blurb = h('p', { class: 'hint' }, sceneBlurb(getScene(draft.scene), getLang()));

    const mode = segmented(t('setup.where'), [
      { value: 'paper', label: t('setup.modePaper') },
      { value: 'screen', label: t('setup.modeScreen') },
    ], draft.mode, (v) => { draft.mode = v; modeHint.textContent = t(`setup.modeHint.${v}`); });
    const modeHint = h('p', { class: 'hint' }, t(`setup.modeHint.${draft.mode}`));

    const prep = segmented(t('setup.prep'), [
      { value: 5, label: t('unit.min', { n: 5 }) },
      { value: 2, label: t('unit.min', { n: 2 }) },
      { value: 0, label: t('setup.prepSkip') },
    ], [5, 2, 0].includes(draft.prep) ? draft.prep : 5, (v) => { draft.prep = v; });

    const start = h('button', { type: 'submit', class: 'btn btn-ink btn-big' }, t('setup.start'));

    const form = h('form', {
      class: 'setup',
      onsubmit: (e) => {
        e.preventDefault();
        store.setSettings({ focusMin: draft.minutes, scene: draft.scene, studyMode: draft.mode, prepMin: draft.prep });
        const now = Date.now();
        store.setActive({
          id: uid(),
          stage: draft.prep > 0 ? 'prep' : 'focus',
          goal: draft.goal.trim(),
          steps: [],
          plannedMin: draft.minutes,
          prepMin: draft.prep,
          scene: draft.scene,
          mode: draft.mode,
          prepStartedAt: now,
          settling: false,
          focusStartedAt: draft.prep > 0 ? null : now,
          pausedAt: null, pausedMs: 0, pauses: 0,
          awayMs: 0, awayCount: 0, awaySince: null,
          lastSeenAt: now,
        });
        // This click is the "user gesture" browsers need before sound can play.
        audio.setVolume(store.state.settings.volume);
        audio.play(draft.scene, 4);
        render();
      },
    },
    h('h1', null, t('setup.title')),
    h('p', { class: 'lede' }, t('setup.lede')),
    h('label', { class: 'label', for: 'goal' }, t('setup.goal')), goal,
    h('div', { class: 'label' }, t('setup.length')), h('div', { class: 'row' }, length, custom, h('span', { class: 'hint' }, t('setup.minutes'))),
    h('div', { class: 'label' }, t('setup.scene')), sceneGrid, blurb,
    h('div', { class: 'label' }, t('setup.where')), mode, modeHint,
    h('div', { class: 'label' }, t('setup.prep')), prep, h('p', { class: 'hint' }, t('setup.prepHint')),
    start);

    show(form);
    goal.focus();
  }

  // ------------------------------------------------------------------- prep
  function renderPrep() {
    const a = active();
    const scene = getScene(a.scene);
    const totalMs = a.prepMin * 60000;
    const settleMs = totalMs * SETTLE_SHARE;

    const countdown = h('span', { class: 'prep-clock' }, clock(totalMs / 1000));
    const body = h('div', { class: 'prep-body' });

    const beginFocus = () => {
      // Read whatever is in the step boxes before leaving
      savePlan();
      save({ stage: 'focus', focusStartedAt: Date.now(), lastSeenAt: Date.now() });
      render();
    };

    // --- phase 1: plan
    const goal = h('input', {
      type: 'text', class: 'field field-dark', maxlength: '120', value: a.goal,
      placeholder: t('setup.goalPlaceholder'), 'aria-label': t('setup.goal'),
    });
    const stepInputs = [0, 1, 2].map((i) => h('input', {
      type: 'text', class: 'field field-dark', maxlength: '90', value: a.steps[i]?.text || '',
      placeholder: t(`prep.step${i + 1}`), 'aria-label': t('prep.stepLabel', { n: i + 1 }),
    }));
    function savePlan() {
      if (!goal.isConnected && !stepInputs[0].isConnected) return;
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

    const planPhase = h('div', { class: 'prep-plan' },
      h('div', { class: 'prep-col' },
        h('h2', null, t('prep.planTitle')),
        h('p', { class: 'stage-hint' }, t('prep.planHint', { n: a.plannedMin })),
        goal, ...stepInputs, suggest),
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
    );

    const toSettle = h('button', {
      type: 'button', class: 'btn btn-paper',
      onclick: () => { savePlan(); save({ settling: true }); drawPhase(); },
    }, t('prep.planReady'));
    const startNow = h('button', { type: 'button', class: 'btn btn-ghost', onclick: beginFocus }, t('prep.startNow'));
    const foot = h('div', { class: 'stage-foot' });

    function drawPhase() {
      const settling = active().settling;
      body.replaceChildren(settling ? settlePhase : planPhase);
      foot.replaceChildren(...(settling ? [startNow] : [toSettle, startNow]), volumeControl());
      title.textContent = settling ? t('prep.settleTitle') : t('prep.title');
    }

    const title = h('h1', { class: 'stage-title' }, t('prep.title'));
    showStage(scene,
      h('header', { class: 'stage-head' }, title, h('p', { class: 'prep-count' }, t('prep.startsIn'), ' ', countdown)),
      body, foot);
    drawParked();
    drawPhase();
    audio.play(a.scene, 3); // already playing after "Get ready"; this covers a reload
    if (!active().settling) goal.value ? stepInputs[0].focus() : goal.focus();

    ticker = setInterval(() => {
      const left = totalMs - (Date.now() - active().prepStartedAt);
      countdown.textContent = clock(left / 1000);
      // 4 seconds in, 6 seconds out
      const phase = (Date.now() / 1000) % 10;
      breathWord.textContent = phase < 4 ? t('prep.breatheIn') : t('prep.breatheOut');
      if (!active().settling && left <= settleMs) { savePlan(); save({ settling: true }); drawPhase(); }
      if (left <= 0) beginFocus();
    }, 250);
  }

  // ------------------------------------------------------------------ focus
  function elapsedMs(a = active()) {
    const end = a.pausedAt ?? Date.now();
    return Math.min(a.plannedMin * 60000, Math.max(0, end - a.focusStartedAt - a.pausedMs));
  }

  function renderFocus() {
    const a = active();
    const scene = getScene(a.scene);
    const plannedMs = a.plannedMin * 60000;

    const timer = h('div', { class: 'timer', role: 'timer', 'aria-label': t('focus.timeLeft') });
    const drawTimer = () => {
      const text = clock((plannedMs - elapsedMs()) / 1000);
      // one fixed-width box per character so the digits don't jiggle
      timer.replaceChildren(...[...text].map((ch) => h('span', { class: ch === ':' ? 'timer-colon' : 'timer-digit' }, ch)));
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
    const mine = () => store.state.thoughts.filter((x) => x.sessionId === a.id);
    const peekList = h('ul', { class: 'margin-peek', hidden: true });
    const count = h('button', {
      type: 'button', class: 'margin-count', 'aria-expanded': 'false',
      onclick: () => {
        peekList.hidden = !peekList.hidden;
        count.setAttribute('aria-expanded', String(!peekList.hidden));
      },
    });
    const drawMargin = () => {
      const list = mine();
      count.textContent = list.length ? t('focus.inMargin', { n: list.length }) : t('focus.marginEmpty');
      count.disabled = !list.length;
      peekList.replaceChildren(...list.map((x) => h('li', null, x.text)));
      if (!list.length) peekList.hidden = true;
    };

    const input = h('input', {
      type: 'text', class: 'margin-input', maxlength: '500', autocomplete: 'off',
      placeholder: t('focus.parkPlaceholder'), 'aria-label': t('focus.parkLabel'),
    });
    const flash = h('span', { class: 'margin-flash', 'aria-live': 'polite' });
    const strip = h('form', {
      class: 'margin-strip',
      onsubmit: (e) => {
        e.preventDefault();
        const cur = active();
        const offsetSec = cur.pausedAt ? null : Math.round(elapsedMs(cur) / 1000);
        if (!store.addThought(input.value, { sessionId: cur.id, offsetSec })) return;
        input.value = '';
        drawMargin();
        flash.textContent = t('focus.parked');
        flash.classList.remove('is-on');
        void flash.offsetWidth; // restart the fade animation
        flash.classList.add('is-on');
      },
    }, input, h('button', { type: 'submit', class: 'btn btn-ink' }, t('park.button')));

    // pause / end
    const pauseBtn = h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => togglePause() });
    const endBtn = h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => finish() }, t('focus.end'));
    const pausedBanner = h('p', { class: 'paused-banner', hidden: true }, t('focus.paused'));

    function drawPause() {
      const paused = Boolean(active().pausedAt);
      pauseBtn.textContent = paused ? t('focus.resume') : t('focus.pause');
      pausedBanner.hidden = !paused;
      timer.classList.toggle('is-paused', paused);
    }

    function togglePause() {
      const cur = active();
      if (cur.pausedAt) {
        save({ pausedMs: cur.pausedMs + (Date.now() - cur.pausedAt), pausedAt: null, lastSeenAt: Date.now() });
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
        store.setActive(null);
        audio.stop(0.8);
        cleanupStage();
        toast(t('focus.tooShort'));
        navigate('#/');
        return;
      }
      const patch = { stage: 'wrap', endedAt: Date.now(), focusMs: elapsedMs(cur) };
      if (cur.pausedAt) { patch.pausedMs = cur.pausedMs + (Date.now() - cur.pausedAt); patch.pausedAt = null; }
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

    showStage(scene,
      h('header', { class: 'stage-head' },
        h('p', { class: 'focus-goal' }, a.goal || t('focus.noGoal')),
        h('div', { class: 'stage-tools' }, volumeControl(), pauseBtn, endBtn)),
      h('div', { class: 'focus-center' }, timer, pausedBanner, steps),
      h('div', { class: 'margin' },
        h('div', { class: 'margin-top' }, h('span', { class: 'margin-title' }, t('focus.marginTitle')), flash, count),
        peekList, strip));
    drawTimer();
    drawMargin();
    drawPause();
    input.focus();
    if (!a.pausedAt) audio.play(a.scene, 2);

    // Leaving the tab while studying on paper counts as drifting.
    const onVisibility = () => {
      const cur = active();
      if (!cur || cur.stage !== 'focus' || cur.pausedAt) return;
      if (document.hidden) {
        save({ awaySince: Date.now() });
      } else if (cur.awaySince) {
        const gone = Date.now() - cur.awaySince;
        save({ awayMs: cur.awayMs + gone, awayCount: cur.awayCount + (gone > 5000 ? 1 : 0), awaySince: null });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    offVisibility = () => document.removeEventListener('visibilitychange', onVisibility);

    ticker = setInterval(() => {
      const cur = active();
      if (!cur || cur.stage !== 'focus') return;
      drawTimer();
      if (!cur.pausedAt && elapsedMs(cur) >= plannedMs) finish();
    }, 250);
    heartbeat = setInterval(() => {
      if (active() && !active().pausedAt) save({ lastSeenAt: Date.now() });
    }, HEARTBEAT_MS);
  }

  // ------------------------------------------------------------------- wrap
  function renderWrap() {
    const a = active();
    const scene = getScene(a.scene);
    const focusSec = Math.round((a.focusMs ?? elapsedMs(a)) / 1000);
    const parked = store.state.thoughts.filter((x) => x.sessionId === a.id && typeof x.offsetSec === 'number').length;
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

    const saveBtn = h('button', { type: 'button', class: 'btn btn-ink btn-big', disabled: true, onclick: commit },
      parked ? t('wrap.saveAndSort', { n: parked }) : t('wrap.save'));
    const check = () => { saveBtn.disabled = !(answers.rating && answers.finished); };

    function commit() {
      const cur = active();
      const session = {
        id: cur.id,
        startedAt: cur.focusStartedAt,
        endedAt: cur.endedAt || Date.now(),
        plannedMin: cur.basePlannedMin ?? cur.plannedMin,
        focusSec,
        pauses: cur.pauses,
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
        save({ stage: 'focus', basePlannedMin: cur.basePlannedMin ?? cur.plannedMin,
          plannedMin: Math.ceil((cur.focusMs ?? 0) / 60000) + 10, endedAt: null, focusMs: null,
          pausedMs: cur.pausedMs + (Date.now() - (cur.endedAt || Date.now())), lastSeenAt: Date.now() });
        audio.play(cur.scene, 1.5);
        render();
      },
    }, t('wrap.more'));

    let armed = false;
    const discard = h('button', {
      type: 'button', class: 'linklike',
      onclick: () => {
        if (!armed) { armed = true; discard.textContent = t('wrap.discardSure'); return; }
        // The parked thoughts are kept; only the block itself is thrown away.
        store.state.thoughts.filter((x) => x.sessionId === a.id)
          .forEach((x) => store.updateThought(x.id, { sessionId: null, offsetSec: null }));
        store.setActive(null);
        cleanupStage();
        navigate('#/');
      },
    }, t('wrap.discard'));

    showStage(scene,
      h('div', { class: 'wrap-card' },
        h('h1', null, t('wrap.title')),
        h('p', { class: 'lede' }, t('wrap.summary', { min: Math.max(1, Math.round(focusSec / 60)), n: parked })),
        h('div', { class: 'label' }, t('wrap.ratingLabel')), rating, ratingWord,
        h('div', { class: 'label' }, t('wrap.finishedLabel')), finished,
        saveBtn,
        h('p', { class: 'wrap-links' }, more, discard)));
  }

  // ----------------------------------------------------------------- router
  function render() {
    const a = active();
    if (!a) return renderSetup();
    if (a.stage === 'prep') return renderPrep();
    if (a.stage === 'focus') return renderFocus();
    return renderWrap();
  }

  audio.setVolume(store.state.settings.volume);

  // Coming back after a reload or a closed tab
  const a = active();
  if (a) {
    if (a.stage === 'prep') {
      save({ prepStartedAt: Date.now(), settling: false });
    } else if (a.stage === 'focus' && !a.pausedAt) {
      // The time the page was closed is treated as a pause, starting at the last heartbeat.
      save({ pausedAt: a.lastSeenAt || Date.now(), pauses: a.pauses + 1, awaySince: null });
    }
  }
  render();

  return function destroy() {
    cleanupStage();
    // Walking away from a block mid-way pauses it rather than losing it.
    const cur = active();
    if (cur && cur.stage === 'focus' && !cur.pausedAt) save({ pausedAt: Date.now(), pauses: cur.pauses + 1 });
    audio.stop(0.8);
  };
}
