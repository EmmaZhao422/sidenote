// The written recap on the summary page when no AI is connected: a few plain
// sentences assembled from the numbers. With AI connected, ai.js writes it
// instead, from the same numbers.

import { t, getLang } from './i18n.js';
import { breadthLabel } from './score.js';
import { getScene, sceneName } from './scenes.js';
import { minutesText } from './ui.js';

export function localRecap(stats, rec) {
  if (!stats.sessionCount) return t('recap.none');
  const lines = [];

  lines.push(t('recap.time', {
    sessions: stats.sessionCount,
    time: minutesText(stats.focusMin),
    longest: minutesText(stats.longestMin),
  }));
  if (stats.goals.length) lines.push(t('recap.goals', { goals: stats.goals.slice(0, 3).join(getLang() === 'zh' ? '、' : '; ') }));

  if (stats.avgScore !== null) {
    let line = t('recap.score', { score: stats.avgScore });
    if (stats.trend) line += ' ' + t(`recap.trend.${stats.trend}`);
    lines.push(line);
  }

  if (stats.thoughtCount) {
    let line = t('recap.thoughts', { n: stats.thoughtCount, top: t(`cat.${stats.topCategory}`) });
    const b = breadthLabel(stats.breadth);
    if (b) line += ' ' + t(`recap.breadth.${b}`);
    lines.push(line);

    const peak = stats.timing.indexOf(Math.max(...stats.timing));
    if (stats.timing[peak] >= 2) {
      lines.push(peak === 9
        ? t('recap.timingLate', { from: 45 })
        : t('recap.timing', { from: peak * 5, to: peak * 5 + 5 }));
    }
    if (stats.openCount) lines.push(t('recap.open', { n: stats.openCount }));
  } else {
    lines.push(t('recap.noThoughts'));
  }

  if (rec && rec.status === 'ready') {
    lines.push(t(rec.confidence === 'solid' ? 'recap.sceneSolid' : 'recap.sceneEarly', {
      scene: sceneName(getScene(rec.best.id), getLang()),
      score: rec.best.avg,
    }));
  }
  return lines.join('\n\n');
}
