// Sorts a parked thought into a rough category, instantly and offline.
// This is deliberately simple keyword matching: it runs the moment a thought is
// parked, so it must never wait on a network call. When the AI later reads the
// thought it may correct the category.

export const CATEGORIES = ['question', 'todo', 'worry', 'idea', 'urge', 'other'];

const RULES = {
  // wanting something other than studying: phone, food, rest
  urge: [
    /\b(instagram|insta|tiktok|youtube|netflix|twitter|reddit|snapchat|discord|video ?games?|gaming|play a game|snack|hungry|starving|boba|nap|scroll|sleepy|so tired|exhausted|wanna|want to (go home|sleep|leave|quit|stop))\b/i,
    /\b(check|grab|look at|pick up|get) my phone\b/i,
    /(刷(手机|抖音|小红书|微博|视频|b站|B站|朋友圈)?|玩手机|(看|拿|摸).{0,3}手机|想.{0,4}手机|抖音|小红书|朋友圈|微博|b站|B站|(打|玩).{0,3}游戏|开黑|王者|原神|零食|奶茶|好饿|饿了|想吃|外卖|睡一会|想睡|好困|困死|好累|累死|追剧|短视频|想回家|不想学)/,
  ],
  worry: [
    /\b(worried|worry|anxious|anxiety|afraid|scared|what if|stress|stressed|nervous|fail|failing|behind|overwhelmed|lonely|sad|tired of|hate|can't do|embarrass|regret|too late|not good enough|mad at me|annoyed with me|bad at|not cut out|not smart enough|too dumb|so stupid|give up|never going to|never gonna)\b/i,
    /^why am i (so|like|always)\b/i,
    /(担心|焦虑|害怕|好怕|万一|压力|紧张|好烦|烦死|难过|崩溃|来不及|完蛋|挂科|考不好|考不上|考不过|过不了|上不了岸|没戏|没希望|怎么办|丢人|后悔|孤独|撑不住|落后|跟不上|太晚|太迟|是不是(很|太)?(差|笨|菜)|生我(的)?气|讨厌我|不适合|是不是不|学不会|听不懂|看不懂|太难了|我不行|好笨|没救)/,
  ],
  todo: [
    /^(i )?(need to|have to|must|gotta|should|remember to|don't forget|dont forget|todo|to-do)\b/i,
    /^(buy|email|call|text|reply|pay|book|submit|finish|send|sign up|register|schedule|clean|wash|renew|return|print|pick up|order|ask)\b/i,
    /(记得|别忘|不要忘|得去|要去|要交|要买|要回|要发|要问|需要|买|回复|报名|预约|打电话|回电话|回个电话|回消息|回微信|回邮件|让我(去|回|给|带|买)|洗衣|取快递|寄|提交|缴费|还书|订票|续费)/,
  ],
  idea: [
    /\b(idea|what about|maybe i could|i could build|could make|should try|side project|startup|an app that|a website that|business)\b/i,
    /^(start|make|build|create|organi[sz]e|try) (a|an|my|our)\b/i,
    /(想法|点子|灵感|要不我|要不要(组|做|建|开|搞|试)|不如|可以做一个|能不能做|创业|商业化|想做一个|试试看|做个|做一个)/,
  ],
  question: [
    /[?？]\s*$/,
    /^(what|why|how|when|where|who|which|is|are|was|were|can|could|does|do|did|will|would|should)\b/i,
    /^i wonder\b/i,
    /(为什么|为啥|怎么|什么是|是什么|如何|是不是|多少|哪个|哪里|哪天|几点|几号|什么时候|多久|吃啥|吃什么|谁|能不能|要不要|吗$|呢$|区别|了没(有)?$|哪了$|哪儿|(什么|啥)$|在哪里?$|到底|有什么不同|有啥不同|不一样|什么意思|怎么回事|对不对|行不行|可以吗|是不是)/,
  ],
};

// Lines that open like an errand ("Pay the phone bill", "记得给妈妈回电话") are to-dos
// even when a later word looks like an urge or a worry.
const TODO_OPENERS = [
  /^(i )?(need to|have to|must|gotta|remember to|don't forget|dont forget|todo|to-do)\b/i,
  /^(buy|email|call|text|reply|pay|book|submit|finish|send|sign up|register|schedule|clean|wash|renew|return|print|pick up|order|look up|check if|check whether)\b/i,
  /^(记得|别忘|不要忘|要交|要买|要回|要发|要问|查一下|查查|搜一下|看一下|看看|问一下|问问|买|回复|报名|预约|取快递|提交|缴费|还书|订票|续费|给.{1,8}(发|回|打|寄|买))/,
];

// Order matters: a line like "what if I fail?" is a worry before it is a question.
const ORDER = ['urge', 'worry', 'todo', 'idea', 'question'];
// A line that ends in a question mark is being asked, not planned: it can be an
// urge, a worry or an idea, but never a to-do.
const ORDER_WHEN_ASKED = ['urge', 'worry', 'idea', 'question'];

export function classify(text) {
  const s = String(text || '').trim();
  if (!s) return 'other';
  const asked = /[?？]\s*$/.test(s);
  if (!asked && TODO_OPENERS.some((re) => re.test(s))) return 'todo';
  for (const cat of asked ? ORDER_WHEN_ASKED : ORDER) {
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

// "Did I lock my bike?" is a question no search engine or AI can answer: only
// the student can, by checking. The helper says so instead of offering a search.
const ONLY_YOU = [
  /^(did|have|had) (i|we)\b/i,
  /^(where('s| is| are| did i put| did i leave)) (my|the)\b/i,
  /^(is|are|was|were) (my|the) .{0,40}\b(locked|unlocked|off|on|closed|open|shut|unplugged|plugged in|charging|charged|sent|submitted|turned in|saved)\b/i,
  /我.{0,6}(有没有|是不是).{0,12}(锁|关|拔|带|交|发|回|存|保存|提交|还|拿|吃药|打卡)/,
  /(门|窗|灯|煤气|燃气|火|车|电动车|自行车|空调|电脑|水龙头|热水器|插头|充电器).{0,8}(锁|关|拔|停|熄).{0,3}(了吗|了没|没有|没)[?？]?$/,
  /.{1,12}(放|落|丢|忘)(在|到)?(哪|哪里|哪儿)了?[?？]?$/,
  /(带|交|发|回|提交|保存|存|打卡)了(吗|没|没有)[?？]?$/,
  /(是不是|有没有|会不会).{0,4}(没|忘了?).{0,2}(带|锁|关|拔|交|发|回|存|拿|充|还|提交|保存)/,
];

export function onlyYouCanCheck(text) {
  const s = String(text || '').trim();
  return ONLY_YOU.some((re) => re.test(s));
}
