// A wider check of the keyword classifier: about fifty everyday lines per
// language, each with the kind a person would give it. Keyword rules will never
// get all of them, so the test tracks a score instead of demanding perfection.
// When you add a rule, add the lines that motivated it here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../js/classify.js';

const EN = [
  ['Why is the sky blue?', 'question'], ['How do noise-cancelling headphones work?', 'question'],
  ['What is the difference between mitosis and meiosis again', 'question'], ['When is the lab report due?', 'question'],
  ['Does caffeine actually help memory?', 'question'], ['I wonder if she likes me', 'question'],
  ['Should I switch majors?', 'question'], ['Is Zaitsev rule always right?', 'question'],
  ['what room is the exam in', 'question'], ['Do I need a calculator for the exam', 'question'],
  ['Email Professor Lin about the extension', 'todo'], ['Buy printer paper', 'todo'], ['Reply to mom', 'todo'],
  ['Pay the phone bill', 'todo'], ['Return library books', 'todo'], ['Sign up for the career fair', 'todo'],
  ['need to call the landlord', 'todo'], ['Remember to charge my laptop', 'todo'], ['text Maya back', 'todo'],
  ['Look up cheap flights home', 'todo'], ['Check if the gym is open on Sunday', 'todo'], ['book dentist appointment', 'todo'],
  ['What if I fail the midterm', 'worry'], ['Am I behind everyone else in this class', 'worry'],
  ['Is it too late to switch majors?', 'worry'], ['What if my roommate is annoyed with me', 'worry'],
  ['why am I so bad at this', 'worry'], ['I am going to fail this class', 'worry'], ['am I just too dumb for this major', 'worry'],
  ['I feel so overwhelmed', 'worry'], ['nervous about the presentation tomorrow', 'worry'], ['maybe I am not cut out for engineering', 'worry'],
  ['An app that turns lecture slides into flashcards?', 'idea'], ['Could I automate my reading notes?', 'question'],
  ['Start a study group for stats?', 'idea'], ['idea: color code my notes by topic', 'idea'],
  ['maybe I could tutor first years', 'idea'], ['what about a podcast on organic chemistry', 'idea'],
  ['I want to check Instagram', 'urge'], ['Scroll TikTok for a bit', 'urge'], ['Hungry, maybe ramen', 'urge'],
  ['so tired', 'urge'], ['wanna go home', 'urge'], ['one episode on Netflix', 'urge'], ['I need a snack', 'urge'],
  ['check my phone', 'urge'], ['take a nap', 'urge'],
  ['my phone battery is dying', 'other'], ['Mom birthday Friday', 'other'], ['that song from the cafe', 'other'],
  ['game theory chapter looks fun', 'other'], ['it is snowing', 'other'],
];

const ZH = [
  ['为什么天是蓝的，晚霞却是红的？', 'question'], ['降噪耳机是怎么工作的？', 'question'], ['有丝分裂和减数分裂的区别到底是什么', 'question'],
  ['实验报告什么时候交？', 'question'], ['咖啡因真的对记忆有帮助吗', 'question'], ['明天几点交作业', 'question'],
  ['今晚吃啥', 'question'], ['为什么冬天容易静电？', 'question'], ['考试在哪个教室', 'question'], ['这个公式怎么推出来的', 'question'],
  ['记得给林老师发邮件申请延期', 'todo'], ['要买打印纸', 'todo'], ['回复妈妈的微信', 'todo'], ['报名招聘会', 'todo'],
  ['记得还图书馆的书', 'todo'], ['查一下回家的便宜机票', 'todo'], ['要交话费', 'todo'], ['看看周日健身房开不开', 'todo'],
  ['给房东打电话问暖气', 'todo'], ['取快递', 'todo'], ['预约牙医', 'todo'], ['别忘了带充电器', 'todo'],
  ['万一期中挂科怎么办', 'worry'], ['现在转专业是不是太晚了', 'worry'], ['我是不是比班上其他人都落后', 'worry'],
  ['担心室友是不是生我气了', 'worry'], ['我是不是不适合读这个专业', 'worry'], ['感觉跟不上了', 'worry'], ['好焦虑', 'worry'],
  ['这门课太难了我学不会', 'worry'], ['明天的展示好紧张', 'worry'], ['来不及复习了', 'worry'],
  ['能不能做一个把课件变成背诵卡片的小工具', 'idea'], ['要不要组一个统计学习小组', 'idea'], ['想做一个记账的小程序', 'idea'],
  ['有个点子：把笔记按主题上色', 'idea'], ['不如把错题整理成卡片', 'idea'],
  ['想刷一下小红书', 'urge'], ['好饿，想吃拉面', 'urge'], ['想刷一会儿抖音', 'urge'], ['好困', 'urge'], ['想打两把游戏', 'urge'],
  ['想喝奶茶', 'urge'], ['看一眼手机', 'urge'], ['想回家', 'urge'], ['点个外卖', 'urge'],
  ['手机好像没电了', 'other'], ['妈妈周五生日', 'other'], ['外面下雪了', 'other'], ['刚才那首歌叫什么来着', 'other'],
  ['读书笔记可以自动整理吗？', 'question'],
];

function score(lines) {
  const wrong = lines.filter(([text, kind]) => classify(text) !== kind).map(([text, kind]) => `${text} → ${classify(text)} (want ${kind})`);
  return { rate: 1 - wrong.length / lines.length, wrong };
}

test('English everyday lines: at least 9 in 10 get the kind a person would give', () => {
  const { rate, wrong } = score(EN);
  assert.ok(rate >= 0.9, `only ${(rate * 100).toFixed(0)}% right:\n${wrong.join('\n')}`);
});

test('Chinese everyday lines: at least 9 in 10 get the kind a person would give', () => {
  const { rate, wrong } = score(ZH);
  assert.ok(rate >= 0.9, `only ${(rate * 100).toFixed(0)}% right:\n${wrong.join('\n')}`);
});

test('a line that ends in a question mark is never filed as a to-do', () => {
  for (const line of ['Should I email her?', 'Need to buy milk?', '要不要买票？', '记得带伞吗？']) {
    assert.notEqual(classify(line), 'todo', line);
  }
});
