// Sorts a parked thought into a rough category, instantly and offline.
// This is deliberately simple keyword matching: it runs the moment a thought is
// parked, so it must never wait on a network call. When the AI later reads the
// thought it may correct the category.

export const CATEGORIES = ['question', 'todo', 'worry', 'idea', 'urge', 'other'];

const RULES = {
  urge: [
    /\b(phone|instagram|insta|tiktok|youtube|netflix|twitter|reddit|snapchat|discord|game|gaming|snack|hungry|coffee|boba|nap|scroll)\b/i,
    /(刷|手机|抖音|小红书|微信|朋友圈|微博|b站|B站|游戏|王者|原神|零食|奶茶|好饿|饿了|想吃|外卖|睡一会|追剧|短视频)/,
  ],
  worry: [
    /\b(worried|worry|anxious|anxiety|afraid|scared|what if|stress|stressed|nervous|fail|failing|behind|overwhelmed|lonely|sad|tired of|hate|can't do|embarrass|regret)\b/i,
    /(担心|焦虑|害怕|好怕|万一|压力|紧张|好烦|烦死|难过|崩溃|来不及|完蛋|挂科|考不好|怎么办|丢人|后悔|孤独|撑不住)/,
  ],
  todo: [
    /^(i )?(need to|have to|must|gotta|should|remember to|don't forget|dont forget|todo|to-do)\b/i,
    /^(buy|email|call|text|reply|pay|book|submit|finish|send|sign up|register|schedule|clean|wash|renew|return|print|pick up|order|ask)\b/i,
    /(记得|别忘|不要忘|得去|要去|要交|要买|要回|要发|要问|需要|买|回复|报名|预约|打电话|洗衣|取快递|寄|提交|缴费|还书|订票|续费)/,
  ],
  idea: [
    /\b(idea|what about|maybe i could|i could build|could make|should try|side project|startup|an app that|a website that|business)\b/i,
    /(想法|点子|灵感|要不我|可以做一个|能不能做|创业|商业化|想做一个|试试看|做个)/,
  ],
  question: [
    /[?？]\s*$/,
    /^(what|why|how|when|where|who|which|is|are|was|were|can|could|does|do|did|will|would)\b/i,
    /(为什么|怎么|什么是|是什么|如何|是不是|多少|哪个|哪里|谁|能不能|吗$|呢$|区别)/,
  ],
};

// Lines that open like an errand ("Pay the phone bill", "记得给妈妈回电话") are to-dos
// even when a later word looks like an urge or a worry.
const TODO_OPENERS = [
  /^(i )?(need to|have to|must|gotta|remember to|don't forget|dont forget|todo|to-do)\b/i,
  /^(buy|email|call|text|reply|pay|book|submit|finish|send|sign up|register|schedule|clean|wash|renew|return|print|pick up|order|look up|check if|check whether)\b/i,
  /^(记得|别忘|不要忘|要交|要买|要回|要发|要问|查一下|问一下|买|回复|报名|预约|取快递|提交|缴费|还书|订票|续费)/,
];

// Order matters: a line like "what if I fail?" is a worry before it is a question.
const ORDER = ['urge', 'worry', 'todo', 'idea', 'question'];

export function classify(text) {
  const s = String(text || '').trim();
  if (!s) return 'other';
  if (!/[?？]\s*$/.test(s) && TODO_OPENERS.some((re) => re.test(s))) return 'todo';
  for (const cat of ORDER) {
    if (RULES[cat].some((re) => re.test(s))) return cat;
  }
  return 'other';
}

// A few phrases mean the right response is a person, not a study tip.
const CRISIS = [
  /\b(kill myself|suicide|suicidal|end my life|want to die|don't want to live|dont want to live|hurt myself|self[- ]harm)\b/i,
  /(不想活|想死|自杀|轻生|伤害自己|自残|活着没意思)/,
];

export function looksLikeCrisis(text) {
  const s = String(text || '');
  return CRISIS.some((re) => re.test(s));
}
