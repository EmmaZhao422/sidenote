# Sidenote · 走神本

**Mind wandered? Put it in the margin.**

A study timer with one extra box. While you study, every stray thought goes into the box in one line and you keep working. When the block ends you deal with them one by one: an answer for a question, a day for an errand, one thing to do about a worry. With an AI model connected, it writes the answers. The summary page then shows where your attention went.

Live site: https://emmazhao422.github.io/sidenote/

中文说明在[下面](#中文说明)。

## What it does

- **Five minutes to get ready.** Name the goal, split it into up to three steps, empty your head, then a short breathing guide while the sound fades in.
- **Park stray thoughts.** One input box during the block. Type, press Enter, back to work. The count beside it opens a list of what you have parked, in case of a typo.
- **Deal with them afterwards.** Each thought ends in something to do: a to-do gets a day (and stays on the home page until it is done) or goes into the next block's plan, a question gets your own guess and then the answer, a worry gets one next step, an urge gets a ten-minute break on the clock. Anything given a day folds away under "Planned", so the list shows what is still undecided.
- **Summary.** Focus time per day, a focus score per block, what your stray thoughts were about, and the minute of a block they tend to show up.
- **Ten scenes, generated in the browser.** Rain, waves, fireplace, forest, summer night, night train, quiet library, and brown, pink and white noise. No audio files.
- **Scene recommendation.** After three rated blocks on at least two scenes it shows which one you focus best with and suggests untried scenes with a similar character.
- **Reasons to come back.** One tap to repeat the last block, a streak, an optional exam-date countdown, a calendar reminder for tomorrow, and a picture of the week to share (numbers only).
- **A break timer** that follows you around the site, light and dark themes, a phone layout with a tab bar, a spreadsheet export, and it still opens when the connection drops.
- **English and Chinese.** No account. Data stays in the visitor's browser.

## How it is built

Plain HTML, CSS and JavaScript modules. There is no framework and no build step, so what is in the repo is what runs.

| Path | What is in it |
|---|---|
| `index.html`, `css/app.css` | The page shell and all styling |
| `js/config.js` | **The one file to edit** to switch on AI and ads |
| `js/main.js` | Picks the screen for the current address |
| `js/views/` | One file per screen: home, study block, margin, summary, scenes, settings |
| `js/block.js` | Starts a study block (used by the setup screen and the one-tap "Same as last time") |
| `js/store.js` | Saves everything in the browser's local storage |
| `js/classify.js` | Sorts a thought into question / to-do / worry / idea / urge |
| `js/score.js` | Focus score, totals for the summary, scene recommendation |
| `js/audio.js`, `js/backdrop.js` | The soundscapes and the moving backdrop |
| `js/ai.js`, `js/prompts.js` | Talking to the AI model (site proxy, a visitor's own key, or Claude itself when the page is opened inside the Claude app), and what it is told |
| `js/i18n.js` | Every piece of interface text, in both languages |
| `js/ads.js` | Ad placements (off until configured) |
| `js/theme.js` | Light and dark theme switch |
| `js/analytics.js` | Optional visit counter (off until configured) |
| `js/charts.js`, `js/recap.js`, `js/sample.js` | Charts, the written recap, and example data for the summary page |
| `js/breaktimer.js`, `js/ics.js`, `js/sharecard.js`, `js/csv.js`, `js/handoff.js` | The break timer, the calendar reminder, the picture to share, the spreadsheet export, and "Copy for Claude" |
| `worker/` | The Cloudflare Worker that keeps the API key off the website |
| `guides/`, `about.html`, `privacy.html`, `terms.html`, `claude.html`, `zh/`, `sitemap.xml` | Articles and plain pages. They are generated: the text lives in `tools/build_pages.py`, `tools/more_guides.py` and `tools/guides_3.py` |
| `fonts/` | The two typefaces, served from the site itself |
| `skill/` | `sidenote-coach`, a Claude skill that sorts parked thoughts and reviews study sessions with the visitor's own Claude plan |
| `tools/` | Scripts that build the plain pages and package the skill |
| `sw.js` | Keeps a copy of the site so it still opens when the connection drops |
| `tests/` | Unit tests |
| `docs/` | Setup notes, monetization plan and roadmap (in Chinese) |

## Run it on your computer

```bash
git clone https://github.com/EmmaZhao422/sidenote.git
cd sidenote
npm start        # serves the folder at http://localhost:8080
npm test         # runs the unit tests (needs Node 20 or newer)
```

`npm start` only runs Python's built-in web server; there is nothing to install.

## Switching on AI and ads

Both are off by default and the site works without them (the built-in helper sorts thoughts and suggests a next step, but cannot answer questions).

- AI: deploy the Worker in `worker/` and paste its address into `js/config.js`. Steps: [docs/SETUP-AI.md](docs/SETUP-AI.md).
- Ads: get an AdSense account approved for your own domain and paste the ids into `js/config.js`. Steps and the reasoning: [docs/MONETIZATION.md](docs/MONETIZATION.md).

Ads never appear on the planning or study screens. That rule lives in `js/ads.js`.

## The focus score

A 0 to 100 number for comparing your own blocks with each other: your own rating after the block (40%), whether you finished the plan (25%), and how uninterrupted the block was (35%). Parking a thought never costs points. The exact formula is in `js/score.js`. It is a rough yardstick, not a measurement of attention.

## Who made what

The idea and the product decisions are Emma Zhao's. The first version of the code (v0.1, November 2026) was written by an AI coding assistant (Claude) working from her description. Changes after that are tracked in the commit history.

## Licence

No open-source licence has been chosen yet, so all rights are reserved for now. You are welcome to read the code and open issues.

---

## 中文说明

**走神了？先记下来。**

走神本是一个多了一个输入框的学习计时器。学习时冒出来的念头，用一行字记下来，继续学。这一轮结束后，再一条条处理：待办定个日子，问题先猜再查，担心的事写一件能做的。接上 AI 之后，回答由 AI 来写。总结页会告诉你注意力都去了哪儿。

线上地址：https://emmazhao422.github.io/sidenote/

### 功能

- **五分钟准备：** 写目标、拆两三步、把脑子里的事先倒出来，再跟着呼吸进入状态
- **记下走神的念头：** 学习时只有一个输入框，打字、回车、继续；旁边的「已记 N 条」可以点开看一眼刚才记了什么
- **学完再处理：** 每条念头最后都落到一件能做的事上：待办定个日子（没做完会一直显示在首页）或排进下一轮；问题先写猜测再看答案；担心的事写一件能做的；想摸鱼给一个 10 分钟的休息计时
- **总结：** 每天专注多久、每轮的专注分、走神时在想什么、一般在第几分钟走神
- **十个场景：** 全部在浏览器里实时生成，没有音频文件
- **场景推荐：** 打过三次分、至少用过两个场景后，告诉你在哪个场景里最专注，并推荐相似的
- **回来的理由：** 「和上次一样」一键开始、连续天数、可选的考试倒计时、「明天提醒我」的日历文件、一张只有数字的分享图
- 全站共用的休息计时；浅色和深色两种外观；手机上有底部导航；学习记录可以导出成表格；断网时也能打开
- 中英文切换，不用注册，数据只存在访客自己的浏览器里

### 怎么改

没有框架，也没有打包步骤，仓库里的文件就是线上跑的文件。用 VS Code 打开文件夹，终端里运行 `npm start`，浏览器打开 http://localhost:8080 就能看到。改完保存，刷新页面即可。

最常改的几个地方：

- 改文案：`js/i18n.js`
- 改颜色和排版：`css/app.css` 最上面的 `:root`
- 加一个场景：`js/scenes.js` 加一项，`js/audio.js` 的 `BUILDERS` 里加同名的声音
- 改专注分的算法：`js/score.js` 的 `computeFocusScore`
- 改 AI 的说话方式：`js/prompts.js`

### 开通 AI 和广告

见 [docs/SETUP-AI.md](docs/SETUP-AI.md) 和 [docs/MONETIZATION.md](docs/MONETIZATION.md)。

### 接下来做什么

见 [docs/ROADMAP.md](docs/ROADMAP.md)：哪些事适合自己动手改，改哪个文件。
