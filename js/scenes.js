// The study scenes: each one is a sound (built in audio.js) plus a backdrop
// (drawn in backdrop.js). The `traits` numbers describe how a scene feels, from
// 0 to 1, and are what the "similar scenes" recommendation compares.
//
//   steady  - how constant the sound is (white noise = 1, crackling fire = low)
//   nature  - outdoors / natural
//   low     - how much of the sound sits in deep, low frequencies
//   rhythm  - has a repeating pulse
//   bright  - how much high-frequency "hiss" it has

export const SCENES = [
  {
    id: 'rain', en: 'Rain on the window', zh: '窗边的雨',
    blurbEn: 'Steady rainfall with the odd heavier drop.', blurbZh: '持续的雨声，偶尔几滴重的。',
    traits: { steady: 0.8, nature: 0.9, low: 0.4, rhythm: 0.1, bright: 0.7 },
    sky: ['#1c2a44', '#33486b'], visual: 'rain',
  },
  {
    id: 'ocean', en: 'Slow waves', zh: '慢慢的海浪',
    blurbEn: 'Waves rolling in every eight seconds or so.', blurbZh: '大约八秒一道浪，来了又退。',
    traits: { steady: 0.4, nature: 1.0, low: 0.6, rhythm: 0.6, bright: 0.5 },
    sky: ['#0f3246', '#2b6a7c'], visual: 'waves',
  },
  {
    id: 'fire', en: 'Fireplace', zh: '壁炉',
    blurbEn: 'A low roar with dry crackles.', blurbZh: '低低的火声，夹着噼啪响。',
    traits: { steady: 0.3, nature: 0.6, low: 0.7, rhythm: 0.0, bright: 0.4 },
    sky: ['#2a1410', '#5a2a16'], visual: 'embers',
  },
  {
    id: 'forest', en: 'Forest wind', zh: '林间的风',
    blurbEn: 'Wind through leaves, a few birds far off.', blurbZh: '风吹树叶，远处几声鸟叫。',
    traits: { steady: 0.5, nature: 1.0, low: 0.3, rhythm: 0.0, bright: 0.6 },
    sky: ['#16302a', '#3f6a4c'], visual: 'leaves',
  },
  {
    id: 'night', en: 'Summer night', zh: '夏夜',
    blurbEn: 'Crickets over still night air.', blurbZh: '安静的夜里，一片虫鸣。',
    traits: { steady: 0.6, nature: 0.9, low: 0.2, rhythm: 0.7, bright: 0.8 },
    sky: ['#0d1230', '#262a5c'], visual: 'stars',
  },
  {
    id: 'train', en: 'Night train', zh: '夜行列车',
    blurbEn: 'Carriage rumble and the clack of the rails.', blurbZh: '车厢的低鸣，铁轨一下一下。',
    traits: { steady: 0.6, nature: 0.0, low: 0.9, rhythm: 0.9, bright: 0.2 },
    sky: ['#191a2b', '#3a3550'], visual: 'rails',
  },
  {
    id: 'library', en: 'Quiet library', zh: '安静的图书馆',
    blurbEn: 'Almost silent: air vents, a page turning now and then.', blurbZh: '几乎无声：通风口，偶尔翻一页书。',
    traits: { steady: 0.9, nature: 0.0, low: 0.6, rhythm: 0.0, bright: 0.1 },
    sky: ['#2b2620', '#5a4c3a'], visual: 'dust',
  },
  {
    id: 'brown', en: 'Brown noise', zh: '棕噪音',
    blurbEn: 'Deep and soft, like a distant waterfall.', blurbZh: '低沉柔和，像远处的瀑布。',
    traits: { steady: 1.0, nature: 0.1, low: 1.0, rhythm: 0.0, bright: 0.1 },
    sky: ['#2a1f1a', '#4d3a2e'], visual: 'drift',
  },
  {
    id: 'pink', en: 'Pink noise', zh: '粉噪音',
    blurbEn: 'Even and full, between white and brown.', blurbZh: '均匀饱满，介于白噪音和棕噪音之间。',
    traits: { steady: 1.0, nature: 0.1, low: 0.5, rhythm: 0.0, bright: 0.5 },
    sky: ['#3a2038', '#6a3a5a'], visual: 'drift',
  },
  {
    id: 'white', en: 'White noise', zh: '白噪音',
    blurbEn: 'A bright, flat hiss that covers other sounds.', blurbZh: '明亮平直的沙沙声，能盖住杂音。',
    traits: { steady: 1.0, nature: 0.0, low: 0.1, rhythm: 0.0, bright: 1.0 },
    sky: ['#232a36', '#4a5566'], visual: 'drift',
  },
  {
    id: 'silence', en: 'Silence', zh: '不放声音',
    blurbEn: 'No sound, just the timer.', blurbZh: '不放任何声音，只计时。',
    traits: { steady: 1.0, nature: 0.0, low: 0.0, rhythm: 0.0, bright: 0.0 },
    sky: ['#1b2033', '#313a57'], visual: 'none',
  },
];

export function getScene(id) {
  return SCENES.find((s) => s.id === id) || SCENES[0];
}

export function sceneName(scene, lang) {
  return lang === 'zh' ? scene.zh : scene.en;
}

export function sceneBlurb(scene, lang) {
  return lang === 'zh' ? scene.blurbZh : scene.blurbEn;
}
