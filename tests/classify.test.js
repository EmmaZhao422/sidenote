import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, looksLikeCrisis } from '../js/classify.js';

test('sorts thoughts into kinds, in English and Chinese', () => {
  const cases = [
    ['Why is the sky blue?', 'question'],
    ['天为什么是蓝的', 'question'],
    ['Email Professor Lin about the extension', 'todo'],
    ['记得给妈妈回电话', 'todo'],
    ['What if I fail the midterm', 'worry'],
    ['万一期中挂科怎么办', 'worry'],
    ['An app that turns slides into flashcards', 'idea'],
    ['这个能不能商业化', 'idea'],
    ['I want to check Instagram', 'urge'],
    ['想刷一会儿抖音', 'urge'],
    ['Pay the phone bill', 'todo'],
    ['Look up cheap flights home', 'todo'],
    ['查一下回家的便宜机票', 'todo'],
    ['Check if the gym is open on Sunday', 'todo'],
    ['Scroll TikTok for a bit', 'urge'],
    ['要不要组一个统计学习小组', 'idea'],
    ['Start a study group for stats?', 'idea'],
    ['How does game theory explain auctions?', 'question'],
    ['I want to check my phone', 'urge'],
    ['blue umbrella', 'other'],
    ['', 'other'],
  ];
  for (const [text, kind] of cases) assert.equal(classify(text), kind, text);
});

test('a worry phrased as a question is still a worry', () => {
  assert.equal(classify('what if everyone is ahead of me?'), 'worry');
});

test('flags thoughts that need a person, not a study tip', () => {
  assert.equal(looksLikeCrisis('sometimes I want to die'), true);
  assert.equal(looksLikeCrisis('我不想活了'), true);
  assert.equal(looksLikeCrisis('this deadline is killing me'), false);
  assert.equal(looksLikeCrisis('when does the lab report die down'), false);
});
