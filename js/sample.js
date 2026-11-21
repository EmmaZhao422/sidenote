// Example data for the summary page, so a first-time visitor can see what it
// will look like after a week of use. Every sample item is tagged `sample: true`
// and "Remove the example data" deletes exactly those.

import { computeFocusScore } from './score.js';
import { classify } from './classify.js';

const GOALS = {
  en: ['Organic chemistry: problem set 6', 'Read Ch. 4 of Macroeconomics', 'Essay outline for history seminar', 'Linear algebra: eigenvalues practice', 'Flashcards for bio midterm'],
  zh: ['有机化学：第 6 次作业', '读宏观经济学第 4 章', '历史课论文提纲', '线性代数：特征值练习', '生物期中的背诵卡片'],
};

const THOUGHTS = {
  en: [
    'Why is the sky blue but sunsets red?', 'Email Professor Lin about the extension', 'What if I fail the midterm',
    'Check if the gym is open on Sunday', 'An app that turns lecture slides into flashcards?', 'I want to check Instagram',
    'How do noise-cancelling headphones work?', 'Buy printer paper', 'Is it too late to switch majors?', 'Reply to mom',
    'What is the difference between mitosis and meiosis again', 'Hungry, maybe ramen', 'Sign up for the career fair',
    'Am I behind everyone else in this class', 'Could I automate my reading notes?', 'When is the lab report due?',
    'Return library books', 'Why do we forget dreams?', 'What if my roommate is annoyed with me', 'Look up cheap flights home',
    'Does caffeine actually help memory?', 'Pay the phone bill', 'Start a study group for stats?', 'Scroll TikTok for a bit',
  ],
  zh: [
    '为什么天是蓝的，晚霞却是红的？', '记得给林老师发邮件申请延期', '万一期中挂科怎么办', '看看周日健身房开不开',
    '能不能做一个把课件变成背诵卡片的小工具', '想刷一下小红书', '降噪耳机是怎么工作的？', '要买打印纸',
    '现在转专业是不是太晚了', '回复妈妈的微信', '有丝分裂和减数分裂的区别到底是什么', '好饿，想吃拉面',
    '报名招聘会', '我是不是比班上其他人都落后', '读书笔记可以自动整理吗？', '实验报告什么时候交？',
    '记得还图书馆的书', '为什么人会忘记做过的梦？', '担心室友是不是生我气了', '查一下回家的便宜机票',
    '咖啡因真的对记忆有帮助吗', '要交话费', '要不要组一个统计学习小组', '想刷一会儿抖音',
  ],
};

// scene, minutes planned, rating, finished, pauses, parked count, days ago, hour
const PLAN = [
  ['rain', 25, 4, 'yes', 0, 2, 8, 20], ['white', 25, 2, 'partly', 2, 4, 8, 21],
  ['rain', 45, 4, 'yes', 0, 3, 7, 19], ['fire', 25, 3, 'partly', 1, 3, 6, 15],
  ['brown', 45, 5, 'yes', 0, 1, 5, 20], ['ocean', 25, 3, 'yes', 1, 2, 4, 10],
  ['brown', 45, 4, 'yes', 0, 2, 3, 20], ['library', 25, 3, 'partly', 1, 3, 2, 16],
  ['rain', 45, 5, 'yes', 0, 1, 1, 19], ['brown', 60, 4, 'partly', 1, 2, 1, 21],
  ['rain', 25, 4, 'yes', 0, 1, 0, 9],
];

export function buildSample(lang, now = Date.now()) {
  const goals = GOALS[lang] || GOALS.en;
  const texts = THOUGHTS[lang] || THOUGHTS.en;
  const sessions = [];
  const thoughts = [];
  let cursor = 0;

  PLAN.forEach(([scene, minutes, rating, finished, pauses, parked, daysAgo, hour], i) => {
    const start = new Date(now - daysAgo * 86400000);
    start.setHours(hour, 5 + i, 0, 0);
    let startedAt = start.getTime();
    if (startedAt > now) startedAt = now - (minutes + 10) * 60000;
    const focusSec = finished === 'no' ? minutes * 40 : minutes * 60;
    const id = `sample-${i}`;
    const session = {
      id, sample: true, startedAt, endedAt: startedAt + focusSec * 1000 + pauses * 90000,
      plannedMin: minutes, focusSec, pauses, pausedSec: pauses * 90, awaySec: 0, awayCount: 0,
      mode: 'screen', scene, goal: goals[i % goals.length], steps: [], rating, finished, parkedCount: parked,
    };
    session.parts = computeFocusScore(session);
    session.score = session.parts.score;
    sessions.push(session);

    for (let k = 0; k < parked; k++) {
      const text = texts[cursor % texts.length];
      cursor += 1;
      // Stray thoughts cluster around the 10-20 minute mark in the example
      const offsetSec = Math.min(focusSec - 30, Math.round((8 + k * 6 + (i % 3) * 2) * 60));
      thoughts.push({
        id: `sample-t-${i}-${k}`, sample: true, text, createdAt: startedAt + offsetSec * 1000,
        sessionId: id, offsetSec, category: classify(text),
        status: daysAgo > 2 ? 'done' : 'open', reply: null,
      });
    }
  });
  return { sessions, thoughts };
}
