# Builds the plain HTML pages: guides, about, privacy, terms, the Claude page and the Chinese landing page.
#
#   python3 tools/build_pages.py .
#
# The text of every page lives in this file (and tools/more_guides.py for the newer guides).
# Change the text here and run the command again; don't edit the generated .html files by hand,
# because the next run would overwrite them.
import os, html, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = 'https://emmazhao422.github.io/sidenote/'
REPO = 'https://github.com/EmmaZhao422/sidenote'
UPDATED = {'en': 'November 21, 2026', 'zh': '2026 年 11 月 21 日'}

def page(path, lang, title, desc, body, other, depth, ad=False):
    up = '../' * depth
    canon = path[:-len('index.html')] if path.endswith('index.html') else path
    alt_path = os.path.normpath(os.path.join(os.path.dirname(path), other)).replace(os.sep, '/')
    if other.endswith('/') or other in ('zh/', '../'): alt_path = (alt_path + '/').replace('./', '')
    brand = '走神本' if lang == 'zh' else 'Sidenote'
    nav = ([('开始一轮学习', up + '#/focus'), ('学习方法', up + 'guides/zh/'), ('English', other)] if lang == 'zh'
           else [('Start a study block', up + '#/focus'), ('Study guides', up + 'guides/'), ('中文', other)])
    foot = ([('首页', up), ('配合 Claude 使用', up + 'zh/claude.html'), ('关于', up + 'zh/about.html'), ('隐私', up + 'zh/privacy.html'), ('条款', up + 'zh/terms.html'), ('GitHub 源码', REPO)] if lang == 'zh'
            else [('Home', up), ('Use with Claude', up + 'claude.html'), ('About', up + 'about.html'), ('Privacy', up + 'privacy.html'), ('Terms', up + 'terms.html'), ('Source on GitHub', REPO)])
    nav_html = ''.join(f'<a href="{h}"{" lang=\"zh-CN\"" if t == "中文" else ""}{" lang=\"en\"" if t == "English" else ""}>{t}</a>' for t, h in nav)
    foot_html = ''.join(f'<a href="{h}">{t}</a>' for t, h in foot)
    out = f'''<!doctype html>
<html lang="{'zh-CN' if lang == 'zh' else 'en'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(title)} | {brand}</title>
  <meta name="description" content="{html.escape(desc)}">
  <link rel="canonical" href="{SITE}{canon}">
  <link rel="alternate" hreflang="{'zh' if lang == 'zh' else 'en'}" href="{SITE}{canon}">
  <link rel="alternate" hreflang="{'en' if lang == 'zh' else 'zh'}" href="{SITE}{alt_path}">
  <link rel="icon" href="{up}favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="{up}css/app.css">
  <script>
    try {{
      var saved = (JSON.parse(localStorage.getItem('sidenote.v1')) || {{}}).settings;
      var theme = saved && saved.theme;
      if (theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.dataset.theme = 'dark';
    }} catch (e) {{}}
  </script>
</head>
<body>
  <header class="site-head">
    <a class="brand" href="{up}"><span class="brand-mark" aria-hidden="true"></span>{brand}</a>
    <nav>{nav_html}</nav>
  </header>
  <main class="prose">
{body.strip()}
{'    <div data-ad="guide"></div>' if ad else ''}
  </main>
  <footer class="prose-foot">{foot_html}</footer>
  <script type="module" src="{up}js/site.js"></script>
</body>
</html>
'''
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, 'w', encoding='utf8').write(out)

def cta(lang, up):
    if lang == 'zh':
        return f'<p class="cta"><a class="btn btn-ink btn-big" href="{up}#/focus">开始一轮学习</a></p>'
    return f'<p class="cta"><a class="btn btn-ink btn-big" href="{up}#/focus">Start a study block</a></p>'

# ----------------------------------------------------------------------------- guides
GUIDES = [
 dict(slug='parking-lot-method',
  en=dict(title='The parking lot method: what to do with a thought that shows up mid-study',
   desc='Why stray thoughts keep interrupting your studying, and a simple way to write them down and deal with them after the block ends.',
   body='''
    <h1>The parking lot method: what to do with a thought that shows up mid-study</h1>
    <p class="byline">A Sidenote study guide</p>
    <p>You sit down to study. Eight minutes in, your brain reminds you that you never replied to that email. Then it wonders why the sky is blue. Then it asks whether you are behind everyone else in the class. None of these thoughts is urgent, and each one feels like it needs attention right now.</p>
    <p>You can't stop thoughts from showing up. What you can change is what happens next. The parking lot method is one rule: <strong>write the thought down in one line, and go back to work.</strong> You deal with it later, at a time you choose.</p>

    <h2>Why a stray thought is so hard to ignore</h2>
    <p>An unfinished task nags. Psychologists have studied this since the 1920s, when Bluma Zeigarnik reported that people remembered interrupted tasks better than completed ones. Later studies of that specific memory effect have been mixed, but the everyday experience behind it is familiar: an open loop keeps asking for attention.</p>
    <p>A more useful finding came in 2011. E. J. Masicampo and Roy Baumeister found that unfinished goals intruded on people's thinking during an unrelated task, and that the intrusions largely went away once people made a specific plan for the unfinished goal. They didn't have to finish it. Deciding when and how they would handle it was enough.</p>
    <p>That is what parking a thought does. Writing it down in a place you trust tells your brain the thought is safe and has an appointment.</p>

    <h2>How to do it</h2>
    <ol>
      <li><strong>Keep one capture spot open before you start.</strong> A sheet of paper beside your notes, or the box at the bottom of a Sidenote study block. One spot only. If you have to decide where to write, you have already left your work.</li>
      <li><strong>Write one line, no more.</strong> "Email Prof. Lin re: extension." "Why is the sky blue?" You are leaving a pointer to the thought, and a pointer is all you need.</li>
      <li><strong>Don't act on it.</strong> No new tab, no phone, no "this will only take a second." The line you wrote is the action.</li>
      <li><strong>Go back to the exact sentence you were on.</strong> Put your finger or cursor on it if that helps.</li>
      <li><strong>Empty the lot when the block ends.</strong> This step is what makes the method work. If parked thoughts are never dealt with, your brain learns that the list is a place where things get lost, and it stops letting go.</li>
    </ol>

    <h2>Emptying the lot</h2>
    <p>Go through the list once and give every line one of four endings:</p>
    <ul>
      <li><strong>Answer it.</strong> Questions you were curious about. Look them up now, when it costs you nothing.</li>
      <li><strong>Schedule it.</strong> Errands and to-dos get a time, or a first step that takes under two minutes.</li>
      <li><strong>Talk it through.</strong> Worries often shrink when you look at them outside of study time. Ask what part of it you can act on.</li>
      <li><strong>Drop it.</strong> Plenty of mid-study thoughts turn out to be nothing. Cross them off.</li>
    </ul>
    <div class="callout">
      <p>Francesco Cirillo's Pomodoro Technique has a version of this idea: when an internal interruption comes up during a 25-minute session, you mark it, note it down, and carry on. The parking lot method takes that note seriously afterwards.</p>
    </div>

    <h2>What the list tells you over time</h2>
    <p>After a week, read back over what you parked. Patterns show up quickly. If most lines are errands, you may need a five-minute admin slot before you study. If most are worries about one course, that points to a conversation with a tutor. If they cluster around minute fifteen, your blocks may be a little too long. Sidenote keeps this record for you and shows it on the summary page.</p>

    <h2>Common ways it goes wrong</h2>
    <ul>
      <li><strong>Writing paragraphs.</strong> If capturing takes more than ten seconds, you have switched tasks.</li>
      <li><strong>Several lists.</strong> Phone notes, sticky notes and a notebook all at once means none of them is trusted.</li>
      <li><strong>Never reviewing.</strong> The method only works if the lot gets emptied.</li>
    </ul>
    <h2>Sources</h2>
    <ul>
      <li>Masicampo, E. J., &amp; Baumeister, R. F. (2011). Consider it done! Plan making can eliminate the cognitive effects of unfulfilled goals. <em>Journal of Personality and Social Psychology</em>, 101(4), 667–683.</li>
      <li>Cirillo, F. <em>The Pomodoro Technique</em>.</li>
    </ul>
   '''),
  zh=dict(title='「念头停车场」：学到一半冒出来的想法，该拿它怎么办',
   desc='为什么学习时总有念头来打扰，以及一个简单的办法：先写下来，学完再处理。',
   body='''
    <h1>「念头停车场」：学到一半冒出来的想法，该拿它怎么办</h1>
    <p class="byline">走神本学习方法</p>
    <p>你坐下来学习。第八分钟，脑子提醒你那封邮件还没回。接着它想知道天为什么是蓝的。再接着它问你：是不是全班就你落后了。这些念头没有一个是急事，可每一个都像是现在就得管。</p>
    <p>念头冒出来这件事，你拦不住。你能改的是接下来怎么做。「念头停车场」只有一条规则：<strong>用一行字把它写下来，然后回去继续。</strong>等到你自己选的时间再处理。</p>

    <h2>为什么走神的念头这么难忽略</h2>
    <p>没做完的事会一直惦记着你。早在 1920 年代，心理学家就在研究这个现象：布鲁玛·蔡格尼克（Bluma Zeigarnik）报告说，人对被打断的任务比对已完成的任务记得更牢。后来针对这个记忆效应的重复实验结果并不一致，但它背后的日常体验大家都熟悉：一件悬着的事，会不停地来要注意力。</p>
    <p>2011 年有一项更实用的发现。马西坎波（E. J. Masicampo）和鲍迈斯特（Roy Baumeister）发现，没完成的目标会在人做别的事时不断闯进脑子；而只要为这件事定一个具体的计划，这种干扰就基本消失了。不需要把事做完，只要决定了什么时候、怎么做，就够了。</p>
    <p>把念头「停」下来，做的正是这件事。把它写在一个你信得过的地方，等于告诉大脑：这件事丢不了，已经排上日程了。</p>

    <h2>具体怎么做</h2>
    <ol>
      <li><strong>开始之前，只留一个记录的地方。</strong>笔记旁边的一张纸，或者走神本学习页面底部的那个输入框。只要一个。如果还得想「写在哪儿」，你就已经离开正在学的东西了。</li>
      <li><strong>只写一行。</strong>「给林老师发邮件说延期的事」「天为什么是蓝的？」你只需要留一个之后能找回它的记号。</li>
      <li><strong>不要动手去做。</strong>不开新标签页，不拿手机，不说「就一秒钟」。写下那一行，就是你现在要做的全部。</li>
      <li><strong>回到刚才读到的那一句。</strong>需要的话，用手指或光标点着它。</li>
      <li><strong>这一轮学完，把停车场清空。</strong>这一步决定了方法管不管用。如果记下的念头从来没人管，大脑会发现这张单子是个「丢东西的地方」，下次就不肯放手了。</li>
    </ol>

    <h2>清空停车场</h2>
    <p>把单子从头过一遍，每一行给它四种结局之一：</p>
    <ul>
      <li><strong>回答它。</strong>好奇的问题，现在去查，这时候查不耽误任何事。</li>
      <li><strong>排进日程。</strong>杂事和待办，定一个时间，或者写下两分钟内能做完的第一步。</li>
      <li><strong>理一理。</strong>担心的事，离开学习时间再看，往往会小一圈。问问自己：其中哪一部分是我能做点什么的？</li>
      <li><strong>放掉它。</strong>很多学习中途冒出来的念头，回头看其实什么都不是。划掉就好。</li>
    </ul>
    <div class="callout">
      <p>弗朗切斯科·西里洛（Francesco Cirillo）的番茄工作法里有类似的做法：25 分钟内如果冒出内部干扰，做个记号、记下来，然后继续。「念头停车场」多做了一步：事后认真对待那张单子。</p>
    </div>

    <h2>时间长了，单子会告诉你什么</h2>
    <p>一周之后，回头看看你都记了些什么，规律很快就出来了。如果大多是杂事，你可能需要在学习前留五分钟专门处理杂事。如果大多是对某一门课的担心，那该去找老师或助教聊一次。如果它们总在第十五分钟前后出现，也许你的一轮学习稍微长了点。走神本会替你保留这份记录，并在总结页里展示出来。</p>

    <h2>常见的翻车方式</h2>
    <ul>
      <li><strong>写成一大段。</strong>记录超过十秒，你就已经换任务了。</li>
      <li><strong>到处都记。</strong>手机备忘录、便利贴、笔记本同时用，结果哪个都信不过。</li>
      <li><strong>从不回看。</strong>只有停车场会被清空，这个方法才成立。</li>
    </ul>
    <h2>参考</h2>
    <ul>
      <li>Masicampo, E. J., &amp; Baumeister, R. F. (2011). Consider it done! Plan making can eliminate the cognitive effects of unfulfilled goals. <em>Journal of Personality and Social Psychology</em>, 101(4), 667–683.</li>
      <li>Cirillo, F. <em>The Pomodoro Technique</em>.</li>
    </ul>
   ''')),
 dict(slug='five-minute-start',
  en=dict(title='Five minutes before you study: a short plan beats a long warm-up',
   desc='A five-minute routine for starting a study session: name the goal, split it into steps, empty your head, and settle in.',
   body='''
    <h1>Five minutes before you study: a short plan beats a long warm-up</h1>
    <p class="byline">A Sidenote study guide</p>
    <p>The first ten minutes of a study session are the hardest ones. You open the book, read the same paragraph twice, check the time, and rearrange your desk. Usually the material isn't the problem. You sat down without deciding what, exactly, you were about to do.</p>
    <p>A five-minute start fixes that. It isn't a warm-up or a motivational ritual. You make four small decisions before the timer starts, so you don't have to make them while you work.</p>

    <h2>Minute one: say what this block is for</h2>
    <p>"Study chemistry" is a mood. "Finish problem set 6, questions 1 to 4" is a goal you can start on. Write one sentence that would let a friend check whether you did it.</p>

    <h2>Minutes two and three: split it into two or three steps</h2>
    <p>Steps should be small enough that the first one is obvious. "Re-read the worked example on page 112." "Do questions 1 and 2." "Check answers against the key." If you can't name the first step, you have just found out why you were about to procrastinate, and you found out before the timer started.</p>
    <p>There is good evidence that this kind of specific planning helps. The psychologist Peter Gollwitzer calls plans of the form "when X happens, I will do Y" implementation intentions, and his 1999 review found that they make people noticeably more likely to follow through than a general intention to "work hard" does. You can borrow the format: "When the timer starts, I will open to page 112."</p>

    <h2>Minute four: empty your head</h2>
    <p>Anything already nagging at you (a message you owe someone, something you need to buy, a worry about tomorrow) will interrupt you later if you leave it loose. Write each one down in a single line now. Don't solve them. Once it is on the page, it stops asking for attention. Our guide to the <a href="parking-lot-method.html">parking lot method</a> explains why this works.</p>

    <h2>Minute five: settle</h2>
    <p>Put the phone out of reach, face down or in another room. Start your background sound if you use one. Take a few slow breaths, with the out-breath longer than the in-breath. Look at your first step. Then begin.</p>

    <div class="callout">
      <p>Sidenote runs this routine for you. Before each study block it gives you five minutes: a plan with up to three steps, a place to empty your head, and a breathing guide while the sound fades in. The focus timer starts only after that.</p>
    </div>

    <h2>Why not just start?</h2>
    <p>Sometimes you can. If you already know your next step, skip the routine. The five minutes pay off when you feel resistance, because that resistance is usually vagueness. Once the work has a clear first step, starting is easy.</p>
    <p>The routine also helps at the end. When the block is over you can ask a concrete question: did I finish what I planned? Over a few weeks, the answers show you how much you can really do in 25 or 45 minutes, which makes the next plan more realistic.</p>

    <h2>A version for bad days</h2>
    <p>If five minutes feels like too much, do the two-line version: one sentence for the goal, one for the first step. Then start a short block, even ten minutes.</p>
    <h2>Source</h2>
    <ul>
      <li>Gollwitzer, P. M. (1999). Implementation intentions: Strong effects of simple plans. <em>American Psychologist</em>, 54(7), 493–503.</li>
    </ul>
   '''),
  zh=dict(title='开始学习前的五分钟：短计划比长热身管用',
   desc='开始学习前的五分钟流程：说清目标，拆成几步，清空脑子，进入状态。',
   body='''
    <h1>开始学习前的五分钟：短计划比长热身管用</h1>
    <p class="byline">走神本学习方法</p>
    <p>一次学习里最难熬的是开头十分钟。翻开书，同一段读了两遍，看一眼时间，又把桌子收拾了一下。多数时候内容本身并不难，难在你坐下来的时候，还没决定接下来到底要做什么。</p>
    <p>「五分钟开场」解决的就是这个问题。它不是热身，也不是打鸡血。你在计时开始前做完四个小决定，学的时候就不用再做了。</p>

    <h2>第一分钟：说清这一轮要做什么</h2>
    <p>「学化学」是一种心情。「做完第 6 次作业的第 1 到 4 题」才是一个能动手的目标。写一句话，让朋友看了能判断你做没做到。</p>

    <h2>第二、三分钟：拆成两三步</h2>
    <p>每一步要小到第一步一眼就知道怎么做。「重看 112 页的例题」「做第 1、2 题」「对答案」。如果你说不出第一步是什么，你就找到了自己想拖延的原因，而且是在计时开始之前找到的。</p>
    <p>这种具体的计划确实有用，研究证据不少。心理学家彼得·戈尔维策（Peter Gollwitzer）把「当 X 发生时，我就做 Y」这种形式的计划叫做「执行意图」。他 1999 年的综述发现，比起笼统地想「我要好好学」，这种计划能明显提高人真正去做的可能性。你可以直接套用这个句式：「计时一开始，我就翻到 112 页。」</p>

    <h2>第四分钟：把脑子清空</h2>
    <p>已经在惦记的事（欠别人的一条消息、要买的东西、对明天的担心），现在不处理，等会儿一定来打扰你。趁现在每件事写一行。不用解决它们。写下来以后，它就不再来抢注意力了。原理可以看我们的另一篇：<a href="parking-lot-method.html">「念头停车场」</a>。</p>

    <h2>第五分钟：安顿下来</h2>
    <p>把手机放到够不着的地方，扣过来，或者放到另一个房间。如果你习惯听背景声，现在打开。慢慢呼吸几次，呼气比吸气长一点。看一眼你的第一步。开始。</p>

    <div class="callout">
      <p>走神本会带你走完这个流程。每一轮学习之前有五分钟：最多三步的计划，一个清空脑子的地方，再加一段呼吸引导，背景声在这期间慢慢响起。这之后才开始专注计时。</p>
    </div>

    <h2>为什么不直接开始？</h2>
    <p>有时候可以。如果你已经清楚下一步是什么，就跳过这个流程。这五分钟在你有抵触感的时候最值得花，因为抵触感多半来自模糊。第一步一旦清楚了，开始就很容易。</p>
    <p>这个流程在结束时也有用。这一轮学完，你可以问自己一个具体的问题：计划的事做完了吗？几周下来，这些答案会告诉你 25 分钟或 45 分钟里到底能做多少，下一次的计划也就更靠谱。</p>

    <h2>状态很差时的简化版</h2>
    <p>如果连五分钟都嫌多，就写两行：一句目标，一句第一步。然后开始一轮短的，哪怕只有十分钟。</p>
    <h2>参考</h2>
    <ul>
      <li>Gollwitzer, P. M. (1999). Implementation intentions: Strong effects of simple plans. <em>American Psychologist</em>, 54(7), 493–503.</li>
    </ul>
   ''')),
 dict(slug='background-sound',
  en=dict(title='Rain, brown noise or silence: finding the sound you focus with',
   desc='What research says about studying with background sound, why it differs from person to person, and how to test it on yourself.',
   body='''
    <h1>Rain, brown noise or silence: finding the sound you focus with</h1>
    <p class="byline">A Sidenote study guide</p>
    <p>Ask ten students what they listen to while studying and you get ten answers: rain, lo-fi, a café recording, brown noise, total silence. Each of them is sure theirs is the right one. They may all be right, because the best background sound differs from person to person.</p>

    <h2>What the research does and doesn't say</h2>
    <p>The evidence is mixed, and the most consistent finding is that people differ.</p>
    <ul>
      <li><strong>Speech and lyrics get in the way of reading.</strong> Decades of work on what researchers call the irrelevant speech effect shows that background speech disrupts tasks that rely on verbal memory, even when you try to ignore it. If you are reading or writing, songs with words in a language you understand are the riskiest choice.</li>
      <li><strong>Steady noise helps some people and hurts others.</strong> In a 2007 study, Göran Söderlund and colleagues found that white noise improved memory performance in children with ADHD and made it worse in children without it. So the same sound can help one person and get in another's way.</li>
      <li><strong>Sound can also work as a mask.</strong> In a noisy dorm or café, a steady background covers sudden sounds (a door, a conversation) that would otherwise pull your attention. Here the noise isn't helping your brain directly. It hides the things that would interrupt you.</li>
    </ul>
    <p>We haven't found good evidence that any one colour of noise is best for everyone. Be sceptical of anyone who says otherwise.</p>

    <h2>The kinds of sound, in plain words</h2>
    <ul>
      <li><strong>White noise</strong> has equal energy at every pitch. It sounds like a bright hiss. It masks well and is the harshest to listen to.</li>
      <li><strong>Pink noise</strong> is softer in the high pitches. Steady rain is close to it.</li>
      <li><strong>Brown noise</strong> is deeper still, like a distant waterfall or the inside of a plane.</li>
      <li><strong>Natural scenes</strong> (rain, waves, wind, a fire) are mostly noise with slow changes and occasional events. Some people find the variation calming. Others find themselves listening to it.</li>
      <li><strong>Rhythmic scenes</strong> (a train, crickets) add a pulse. A pulse can steady you, and it can also become the thing you pay attention to.</li>
      <li><strong>Silence</strong> is a real option, and for demanding reading it is often the best one, as long as your surroundings are quiet.</li>
    </ul>

    <h2>How to find yours: run a small experiment</h2>
    <p>You can't settle this by thinking about it. You have to test it.</p>
    <ol>
      <li><strong>Pick three or four candidates,</strong> including silence.</li>
      <li><strong>Use one per study block,</strong> for the whole block. Don't switch halfway.</li>
      <li><strong>Rate your focus right after each block,</strong> on the same 1-to-5 scale, before you look at your phone.</li>
      <li><strong>Keep the task type similar</strong> where you can. Problem sets and reading may have different winners.</li>
      <li><strong>Wait for at least three blocks per sound</strong> before you believe a difference. One good session proves nothing; you might just have slept well.</li>
    </ol>
    <div class="callout">
      <p>Sidenote does this bookkeeping for you. Every block records which scene was playing and the focus score you ended with. After three rated blocks it starts showing which scene you focus best with, pulls small samples toward your average so one lucky session doesn't decide it, and suggests untried scenes with a similar character.</p>
    </div>

    <h2>Practical settings</h2>
    <ul>
      <li><strong>Keep it quiet.</strong> The sound should sit just above the room, low enough that you forget it is on.</li>
      <li><strong>Avoid surprises.</strong> Playlists with ads or sudden changes in volume defeat the purpose.</li>
      <li><strong>Protect your hearing.</strong> If you study for hours with headphones, keep the volume low.</li>
    </ul>
    <h2>Source</h2>
    <ul>
      <li>Söderlund, G., Sikström, S., &amp; Smart, A. (2007). Listen to the noise: Noise is beneficial for cognitive performance in ADHD. <em>Journal of Child Psychology and Psychiatry</em>, 48(8), 840–847.</li>
    </ul>
   '''),
  zh=dict(title='雨声、棕噪音还是安静：找到适合你专注的声音',
   desc='关于学习时听背景声，研究怎么说，为什么因人而异，以及怎么在自己身上测试。',
   body='''
    <h1>雨声、棕噪音还是安静：找到适合你专注的声音</h1>
    <p class="byline">走神本学习方法</p>
    <p>问十个学生学习时听什么，会得到十个答案：雨声、lo-fi、咖啡馆录音、棕噪音、完全安静。每个人都觉得自己那个才对。他们可能都没错，因为最合适的背景声本来就因人而异。</p>

    <h2>研究说了什么，没说什么</h2>
    <p>证据并不一致，其中最稳定的一条结论是：人和人不一样。</p>
    <ul>
      <li><strong>人声和歌词会干扰阅读。</strong>研究者把这叫做「无关言语效应」：几十年的研究表明，背景里的说话声会干扰依赖语言记忆的任务，即使你努力不去听。如果你在读书或写东西，带歌词而且你听得懂的歌风险最大。</li>
      <li><strong>平稳的噪音对一些人有帮助，对另一些人有妨碍。</strong>2007 年，约兰·瑟德隆德（Göran Söderlund）等人的研究发现，白噪音让有 ADHD 的孩子记忆成绩变好，却让没有 ADHD 的孩子成绩变差。同一种声音，可能帮了这个人，却妨碍了那个人。</li>
      <li><strong>声音还可以当遮挡用。</strong>在吵闹的宿舍或咖啡馆，平稳的背景声能盖住突然的响动（关门声、说话声），这些响动本来会把你的注意力拽走。这时候噪音并没有直接帮到大脑，它只是把会打断你的东西盖住了。</li>
    </ul>
    <p>我们没有找到可靠的证据表明某一种颜色的噪音对所有人都最好。谁要是这么说，别急着信。</p>

    <h2>几种声音，说人话</h2>
    <ul>
      <li><strong>白噪音：</strong>各个音高的能量一样多，听起来是明亮的沙沙声。遮挡效果好，也最刺耳。</li>
      <li><strong>粉噪音：</strong>高音部分更柔和，持续的雨声和它很接近。</li>
      <li><strong>棕噪音：</strong>更低沉，像远处的瀑布，或者飞机舱里的声音。</li>
      <li><strong>自然场景</strong>（雨、海浪、风、炉火）：主体是噪音，带着缓慢的起伏和偶尔的响动。有人觉得这种变化让人平静，也有人会不自觉地去听它。</li>
      <li><strong>有节奏的场景</strong>（火车、虫鸣）：多了一个节拍。节拍能让人稳下来，也可能把注意力吸过去。</li>
      <li><strong>安静：</strong>这也是一个正经选项。读难懂的东西时，只要周围够安静，它常常是最好的。</li>
    </ul>

    <h2>怎么找到你的那一个：做个小实验</h2>
    <p>这件事靠想是想不出来的，得试。</p>
    <ol>
      <li><strong>选三四个候选，</strong>把「安静」也算进去。</li>
      <li><strong>每一轮学习只用一个，</strong>从头用到尾，中途不换。</li>
      <li><strong>每轮结束马上给自己的专注程度打分，</strong>用同一个 1 到 5 的标准，在看手机之前打。</li>
      <li><strong>尽量让任务类型接近。</strong>做题和读书，胜出的声音可能不一样。</li>
      <li><strong>每种声音至少试三轮，</strong>再相信它们之间的差别。一次状态好说明不了什么，也许只是前一晚睡得好。</li>
    </ol>
    <div class="callout">
      <p>这些记录走神本会替你做。每一轮都会记下当时放的是哪个场景、最后的专注分是多少。打过三次分之后，它开始告诉你在哪个场景里专注得最好；数据少的场景会向你的平均分靠拢，免得一次超常发挥就定了结论；它还会推荐性格相近、你还没试过的场景。</p>
    </div>

    <h2>实用的小设置</h2>
    <ul>
      <li><strong>音量调小。</strong>声音只要比房间的底噪稍高一点，小到你会忘了它开着。</li>
      <li><strong>避免意外。</strong>带广告、音量忽大忽小的歌单，起的是反作用。</li>
      <li><strong>保护听力。</strong>戴耳机连续学几个小时的话，音量保持在低位。</li>
    </ul>
    <h2>参考</h2>
    <ul>
      <li>Söderlund, G., Sikström, S., &amp; Smart, A. (2007). Listen to the noise: Noise is beneficial for cognitive performance in ADHD. <em>Journal of Child Psychology and Psychiatry</em>, 48(8), 840–847.</li>
    </ul>
   ''')),
 dict(slug='study-block-length',
  en=dict(title='25 minutes or 45? How long a study block should be',
   desc='What studies of the Pomodoro technique found about fixed study blocks and breaks, and how to pick a block length from your own data.',
   body="""
    <h1>25 minutes or 45? How long a study block should be</h1>
    <p class="byline">A Sidenote study guide</p>
    <p>The Pomodoro technique says 25 minutes of work, then a 5-minute break. Other people swear by 50 and 10, or by working until they feel like stopping. So which one is right?</p>
    <p>Researchers have only recently started testing this with students doing their real coursework, and so far the answer is: no single number wins. What the studies do show is useful for choosing your own.</p>

    <h2>What the studies found</h2>
    <p>In 2023, Felicitas Biwer and colleagues at Maastricht University followed students through a day of their own studying. One group decided for themselves when to take breaks. Two other groups took breaks on a fixed schedule: 6 minutes after every 24 minutes, or 3 minutes after every 12.</p>
    <ul>
      <li>Students who chose their own breaks studied in longer stretches and also took longer breaks.</li>
      <li>The groups didn't differ in how much mental effort they reported or in how much of their work they completed.</li>
      <li>Fixed, pre-planned breaks came with better mood, and appeared to be more efficient: similar work in less time.</li>
    </ul>
    <p>A follow-up study from the same university in 2025 compared self-chosen breaks, Pomodoro breaks (25 and 5) and a third method. This time fatigue rose faster in the Pomodoro group, and again the groups ended up without overall differences.</p>
    <p>So the evidence doesn't crown 25 minutes. It suggests that <strong>deciding your block length in advance</strong> is what helps, because you stop spending attention on the question "should I take a break now?"</p>

    <h2>How to choose your length</h2>
    <ol>
      <li><strong>Start with 25 minutes.</strong> It is short enough to begin on a bad day.</li>
      <li><strong>Look at when your mind starts to wander.</strong> If your stray thoughts cluster around minute 15, a 45-minute block is mostly a fight. If you are still steady at minute 25 and annoyed when the timer rings, go longer.</li>
      <li><strong>Match the block to the task.</strong> Flashcards and problem drills suit short blocks. Writing and long proofs need time to load into your head, so 45 or 60 minutes often works better.</li>
      <li><strong>Change one thing at a time</strong> and give it a few sessions before judging.</li>
    </ol>
    <div class="callout">
      <p>Sidenote's summary page has a chart called "When in a block your mind wandered". It counts your parked thoughts in five-minute stretches. If the bars pile up late in the block, shorten it. If they pile up in the first five minutes, the block length isn't your problem and the start is; see <a href="five-minute-start.html">the five-minute start</a>.</p>
    </div>

    <h2>Breaks matter as much as blocks</h2>
    <p>A break only works if it actually rests the part of you that was working. Stand up, look at something far away, get water. Scrolling a feed isn't rest for your attention, and it makes the next start harder. If you want to check your phone, that is exactly the kind of urge to park and deal with after the last block of the day.</p>

    <h2>Sources</h2>
    <ul>
      <li>Biwer, F., Wiradhany, W., oude Egbrink, M. G. A., &amp; de Bruin, A. B. H. (2023). Understanding effort regulation: Comparing 'Pomodoro' breaks and self-regulated breaks. <em>British Journal of Educational Psychology</em>, 93(S2), 353–367.</li>
      <li>Investigating the effectiveness of self-regulated, Pomodoro, and Flowtime break-taking techniques among students (2025). <em>Behavioral Sciences</em>, 15(7), 861.</li>
    </ul>
   """),
  zh=dict(title='25 分钟还是 45 分钟？一轮学习该多长',
   desc='关于番茄钟式的固定时长和休息，研究发现了什么；以及怎么用自己的数据选时长。',
   body="""
    <h1>25 分钟还是 45 分钟？一轮学习该多长</h1>
    <p class="byline">走神本学习方法</p>
    <p>番茄工作法说：学 25 分钟，休息 5 分钟。也有人坚持 50 加 10，还有人主张学到想停为止。到底哪个对？</p>
    <p>研究者是最近几年才开始拿学生的真实功课来测这件事的。目前的答案是：没有哪个数字胜出。不过这些研究对你自己做选择很有用。</p>

    <h2>研究发现了什么</h2>
    <p>2023 年，马斯特里赫特大学的 Felicitas Biwer 等人跟踪了学生一整天的自习。一组学生自己决定什么时候休息；另外两组按固定时间表休息：每学 24 分钟休息 6 分钟，或者每学 12 分钟休息 3 分钟。</p>
    <ul>
      <li>自己决定休息的学生，每段学得更久，休息得也更久。</li>
      <li>三组学生自我报告的脑力投入没有差别，完成的任务量也没有差别。</li>
      <li>事先定好的固定休息，带来了更好的心情，看起来效率也更高：差不多的任务量，用的时间更少。</li>
    </ul>
    <p>2025 年，同一所大学的后续研究比较了自主休息、番茄钟休息（25 加 5）和第三种方法。这一次番茄钟组的疲劳感上升得更快，而各组最终同样没有整体上的差别。</p>
    <p>所以，证据并没有把 25 分钟捧上王座。它提示的是：<strong>提前定好一轮多长</strong>这件事本身有帮助，因为你不用再分神去想「现在要不要休息」。</p>

    <h2>怎么选你的时长</h2>
    <ol>
      <li><strong>从 25 分钟开始。</strong>它够短，状态差的日子也开得了头。</li>
      <li><strong>看看你一般什么时候开始走神。</strong>如果走神的念头集中在第 15 分钟前后，45 分钟的一轮大半是在硬撑。如果到第 25 分钟还很稳，计时器响了你还嫌烦，那就加长。</li>
      <li><strong>时长跟着任务走。</strong>背卡片、刷题适合短的一轮。写作和长证明需要时间「加载」到脑子里，45 或 60 分钟往往更合适。</li>
      <li><strong>一次只改一样，</strong>多试几轮再下结论。</li>
    </ol>
    <div class="callout">
      <p>走神本的总结页里有一张图叫「一轮里什么时候开始走神」，它按每五分钟一段统计你记下的念头。如果柱子堆在后半段，把一轮缩短。如果堆在头五分钟，问题不在时长，在开头，可以看<a href="five-minute-start.html">开始学习前的五分钟</a>。</p>
    </div>

    <h2>休息和学习一样要紧</h2>
    <p>休息要有用，得真的让刚才在干活的那部分歇下来。站起来，看看远处，喝口水。刷信息流对注意力来说算不上休息，还会让下一轮更难开始。如果想看手机，这正是该先记下来、等今天最后一轮结束再处理的那种念头。</p>

    <h2>参考</h2>
    <ul>
      <li>Biwer, F., Wiradhany, W., oude Egbrink, M. G. A., &amp; de Bruin, A. B. H. (2023). Understanding effort regulation: Comparing 'Pomodoro' breaks and self-regulated breaks. <em>British Journal of Educational Psychology</em>, 93(S2), 353–367.</li>
      <li>Investigating the effectiveness of self-regulated, Pomodoro, and Flowtime break-taking techniques among students (2025). <em>Behavioral Sciences</em>, 15(7), 861.</li>
    </ul>
   """)),
 dict(slug='phone-while-studying',
  en=dict(title='Where should your phone be while you study?',
   desc='The "brain drain" study said a phone on the desk hurts your thinking even when you ignore it. Later studies disagree. Here is what holds up, and what to do.',
   body="""
    <h1>Where should your phone be while you study?</h1>
    <p class="byline">A Sidenote study guide</p>
    <p>You have probably heard that a phone on your desk makes you think worse even if you never touch it. The claim comes from a real study. Later research has complicated it, and the practical advice turns out to be simpler than the headline.</p>

    <h2>The original claim</h2>
    <p>In 2017, Adrian Ward and colleagues reported what they called the brain drain effect. People did tests of working memory and reasoning with their phone on the desk, in a pocket or bag, or in another room. Those with the phone in another room did best, even though nobody was using their phone. The authors' explanation was that part of your attention is spent on not checking it.</p>

    <h2>What happened next</h2>
    <p>Other labs tried to repeat the result, and it has not held up cleanly.</p>
    <ul>
      <li>A 2022 replication by Ruiz Pardo and Minda used the same tasks and found no difference between phone locations.</li>
      <li>A 2023 meta-analysis by Böttger, Poschik and Zierer found a significant negative effect overall when it pooled studies of phone use and phone presence together.</li>
      <li>A 2024 meta-analysis by Hartanto and colleagues looked only at mere presence, across 33 studies and 4,368 participants, and found no significant effect.</li>
      <li>Another 2024 meta-analysis, by Douglas Parry, found a small negative effect on working memory and nothing for other abilities, and called the support limited.</li>
    </ul>
    <p>So a silent phone lying face down may cost you a little, or nothing. The evidence is mixed, and anyone who tells you it is settled is overselling it.</p>

    <h2>What matters in practice</h2>
    <p>The lab studies test a phone that stays silent and untouched. That isn't the usual problem when you study. The usual problem is that the phone lights up, or you pick it up "for a second", and the block is gone. You don't need a study to know what the next twenty minutes look like after that.</p>
    <p>Whatever the mere-presence effect turns out to be, the useful move is the same: make the phone harder to reach than the thing you are studying.</p>
    <ol>
      <li><strong>Put it out of arm's reach,</strong> ideally out of sight: a bag across the room, a shelf behind you, another room if you can.</li>
      <li><strong>Silence it properly.</strong> Vibration on a desk is still an interruption. Use Do Not Disturb, and allow calls from the two or three people who might really need you.</li>
      <li><strong>Give the urge somewhere to go.</strong> When you think "I should check if she replied", write that down in one line and keep going. The thought is safe, and you can check when the block ends. This is the <a href="parking-lot-method.html">parking lot method</a>.</li>
      <li><strong>If your phone is your timer,</strong> use a timer on your computer instead, so the phone has no reason to be on the desk.</li>
    </ol>
    <div class="callout">
      <p>In Sidenote, urges get their own category. If "check my phone" keeps showing up in your parked thoughts, the summary page will show it, along with the minute of the block when it tends to hit.</p>
    </div>

    <h2>Sources</h2>
    <ul>
      <li>Ward, A. F., Duke, K., Gneezy, A., &amp; Bos, M. W. (2017). Brain drain: The mere presence of one's own smartphone reduces available cognitive capacity. <em>Journal of the Association for Consumer Research</em>. doi:10.1086/691462</li>
      <li>Ruiz Pardo, A. C., &amp; Minda, J. P. (2022). Reexamining the "brain drain" effect: A replication of Ward et al. (2017). <em>Acta Psychologica</em>, 230, 103717.</li>
      <li>Böttger, T., Poschik, M., &amp; Zierer, K. (2023). Does the brain drain effect really exist? A meta-analysis. <em>Behavioral Sciences</em>, 13(9), 751.</li>
      <li>Hartanto, A., et al. (2024). The effect of mere presence of smartphone on cognitive functions: A four-level meta-analysis.</li>
      <li>Parry, D. A. (2024). Does the mere presence of a smartphone impact cognitive performance? A meta-analysis of the "brain drain effect".</li>
    </ul>
   """),
  zh=dict(title='学习的时候，手机该放哪儿？',
   desc='「大脑流失」研究说，手机放在桌上，就算不碰也会影响思考。后来的研究并不都同意。这里讲哪些结论站得住，以及该怎么做。',
   body="""
    <h1>学习的时候，手机该放哪儿？</h1>
    <p class="byline">走神本学习方法</p>
    <p>你大概听过这个说法：手机放在桌上，就算一下都不碰，也会让你的思考变差。这个说法出自一项真实的研究。后来的研究让事情变复杂了，而实际的建议比标题简单。</p>

    <h2>最初的说法</h2>
    <p>2017 年，Adrian Ward 等人报告了他们称为「大脑流失」（brain drain）的效应。参与者做工作记忆和推理测试时，手机分别放在桌上、口袋或包里、另一个房间。手机在另一个房间的人成绩最好，尽管没有任何人在用手机。作者的解释是：你有一部分注意力花在了「忍住不去看它」上。</p>

    <h2>后来怎么样了</h2>
    <p>其他实验室尝试重复这个结果，结果并不干净。</p>
    <ul>
      <li>2022 年 Ruiz Pardo 和 Minda 用同样的任务做了重复实验，发现手机放在哪儿没有差别。</li>
      <li>2023 年 Böttger、Poschik 和 Zierer 的元分析把「使用手机」和「手机在场」的研究合在一起，发现总体上有显著的负面影响。</li>
      <li>2024 年 Hartanto 等人的元分析只看「手机在场」，汇总了 33 项研究、4,368 名参与者，没有发现显著影响。</li>
      <li>2024 年 Douglas Parry 的另一项元分析发现，对工作记忆有较小的负面影响，对其他能力没有，并认为支持这个效应的证据有限。</li>
    </ul>
    <p>所以，一部静音、扣在桌上的手机，可能让你损失一点点，也可能没有影响。证据并不一致，谁说这件事已有定论，都是在夸大。</p>

    <h2>实际要紧的是什么</h2>
    <p>实验室里测的是一部全程安静、没人碰的手机。学习时通常的问题不在这儿。通常的问题是：屏幕亮了一下，或者你「就看一秒」，然后这一轮就没了。之后那二十分钟是什么样子，不需要研究来告诉你。</p>
    <p>不管「手机在场」的效应最后被证明有多大，有用的做法都一样：让手机比你正在学的东西更难够到。</p>
    <ol>
      <li><strong>放到伸手够不着的地方，</strong>最好看不见：房间另一头的包里、身后的架子上，条件允许就放到另一个房间。</li>
      <li><strong>真正静音。</strong>在桌上震动同样是打断。开勿扰模式，只放行两三个可能真有急事找你的人的电话。</li>
      <li><strong>给那个冲动找个去处。</strong>想到「看看她回了没有」，就用一行字写下来，然后继续。这个念头丢不了，这一轮结束再去看。这就是<a href="parking-lot-method.html">「念头停车场」</a>。</li>
      <li><strong>如果你用手机计时，</strong>换成电脑上的计时器，手机就没有留在桌上的理由了。</li>
    </ol>
    <div class="callout">
      <p>在走神本里，「想摸鱼」是单独的一类。如果「想看手机」总是出现在你记下的念头里，总结页会显示出来，连同它通常在一轮的第几分钟冒头。</p>
    </div>

    <h2>参考</h2>
    <ul>
      <li>Ward, A. F., Duke, K., Gneezy, A., &amp; Bos, M. W. (2017). Brain drain: The mere presence of one's own smartphone reduces available cognitive capacity. <em>Journal of the Association for Consumer Research</em>. doi:10.1086/691462</li>
      <li>Ruiz Pardo, A. C., &amp; Minda, J. P. (2022). Reexamining the "brain drain" effect: A replication of Ward et al. (2017). <em>Acta Psychologica</em>, 230, 103717.</li>
      <li>Böttger, T., Poschik, M., &amp; Zierer, K. (2023). Does the brain drain effect really exist? A meta-analysis. <em>Behavioral Sciences</em>, 13(9), 751.</li>
      <li>Hartanto, A., et al. (2024). The effect of mere presence of smartphone on cognitive functions: A four-level meta-analysis.</li>
      <li>Parry, D. A. (2024). Does the mere presence of a smartphone impact cognitive performance? A meta-analysis of the "brain drain effect".</li>
    </ul>
   """)),
]

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from more_guides import MORE_GUIDES
GUIDES += MORE_GUIDES

import json
PUBLISHED = '2026-11-21'

def guide_extras(i, lang):
    """Date line, three more guides to read, and Article data for search engines."""
    g = GUIDES[i]
    others = [GUIDES[(i + k) % len(GUIDES)] for k in (1, 2, 3)]
    links = ''.join(f'<li><a href="{o["slug"]}.html">{o[lang]["title"]}</a></li>' for o in others)
    head = '接着读' if lang == 'zh' else 'Keep reading'
    url = SITE + ('guides/zh/' if lang == 'zh' else 'guides/') + g['slug'] + '.html'
    data = {
        '@context': 'https://schema.org', '@type': 'Article',
        'headline': g[lang]['title'], 'description': g[lang]['desc'],
        'datePublished': PUBLISHED, 'dateModified': PUBLISHED,
        'inLanguage': 'zh-CN' if lang == 'zh' else 'en',
        'author': {'@type': 'Organization', 'name': '走神本 Sidenote' if lang == 'zh' else 'Sidenote', 'url': SITE},
        'publisher': {'@type': 'Organization', 'name': 'Sidenote', 'url': SITE},
        'mainEntityOfPage': url,
    }
    return (f'\n    <h2>{head}</h2>\n    <ul>{links}</ul>\n'
            f'    <script type="application/ld+json">{json.dumps(data, ensure_ascii=False)}</script>\n')

def dated(body, lang):
    if lang == 'zh':
        for old in ('<p class="byline">走神本 · 学习方法</p>', '<p class="byline">走神本学习方法</p>'):
            body = body.replace(old, f'<p class="byline">走神本 · 学习方法 · 发布于 {UPDATED["zh"]}</p>', 1)
        return body
    return body.replace('<p class="byline">A Sidenote study guide</p>', f'<p class="byline">A Sidenote study guide · Published {UPDATED["en"]}</p>', 1)

for i, g in enumerate(GUIDES):
    page(f"guides/{g['slug']}.html", 'en', g['en']['title'], g['en']['desc'], dated(g['en']['body'], 'en') + guide_extras(i, 'en') + cta('en', '../'), f"zh/{g['slug']}.html", 1, ad=True)
    page(f"guides/zh/{g['slug']}.html", 'zh', g['zh']['title'], g['zh']['desc'], dated(g['zh']['body'], 'zh') + guide_extras(i, 'zh') + cta('zh', '../../'), f"../{g['slug']}.html", 2, ad=True)

def index(lang):
    items = ''.join(f'<li><a href="{g["slug"]}.html">{g[lang]["title"]}</a><br><span class="byline">{g[lang]["desc"]}</span></li>' for g in GUIDES)
    if lang == 'zh':
        return f'<h1>学习方法</h1><p>几篇短文，讲走神本背后的做法。每一篇都能在五分钟内读完，读完马上能用。</p><ul>{items}</ul>'
    return f'<h1>Study guides</h1><p>Short pieces on the ideas behind Sidenote. Each takes under five minutes to read, and you can use it the same day.</p><ul>{items}</ul>'

page('guides/index.html', 'en', 'Study guides', 'Short, practical guides on focus: parking stray thoughts, starting a study session, and choosing background sound.', index('en'), 'zh/', 1)
page('guides/zh/index.html', 'zh', '学习方法', '几篇实用短文：怎么处理走神的念头，怎么开始一次学习，怎么选背景声。', index('zh'), '../', 2)

# ----------------------------------------------------------------------------- Chinese landing page
# A plain page in Chinese that search engines can read without running the app.
zh_guides = ''.join(f'<li><a href="../guides/zh/{g["slug"]}.html">{g["zh"]["title"]}</a></li>' for g in GUIDES)
page('zh/index.html', 'zh', '学习时把走神的念头先记下来', '走神本是一个免费的学习计时器，多了一个输入框：学习时冒出来的念头一句话记下，继续学；这一轮学完再处理，接上 AI 还能直接给答案。还会告诉你注意力都去了哪儿。', f'''
    <h1>走神了？先记下来。</h1>
    <p>走神本（Sidenote）是一个免费的学习计时器，只多了一个输入框。学习的时候，冒出来的念头用一句话记在里面，然后继续学。这一轮学完，再一条条处理：问题给答案，待办给第一步，担心的事换个更平静的角度看。最后你会看到注意力都去了哪儿。</p>
    <p class="cta"><a class="btn btn-ink btn-big" href="../?lang=zh#/focus">开始一轮学习</a></p>
    <p class="byline">免费，不用注册。记下的内容只存在你自己的浏览器里。</p>

    <h2>一轮学习是怎么走的</h2>
    <ol>
      <li><strong>先花五分钟准备。</strong>写下这一轮要做什么，拆成两三步，把已经在脑子里转的事先倒出来，再跟着呼吸两分钟。</li>
      <li><strong>学习时只留一个输入框。</strong>一个计时器，一个背景声，一个输入框。念头冒出来，打一行字，回车，它就不占脑子了。</li>
      <li><strong>学完再处理那些念头。</strong>计时结束后一条条过一遍，处理完就勾掉。待办可以直接排进下一轮的计划。</li>
      <li><strong>看出规律。</strong>总结页会显示你都学了什么、每一轮有多稳、走神时通常在想什么，以及一般在第几分钟开始走神。</li>
    </ol>

    <h2>还有什么</h2>
    <ul>
      <li><strong>十种背景声：</strong>窗边的雨、海浪、壁炉、林间的风、夏夜、夜行列车、安静的图书馆，以及棕噪音、粉噪音、白噪音。声音是在你的浏览器里现场合成的，不用下载。</li>
      <li><strong>找到适合你的声音：</strong>打过三次分之后，走神本会告诉你在哪个场景里专注得最好，并推荐相似的场景。</li>
      <li><strong>专注分：</strong>每一轮一个 0 到 100 的分数，只用来比较你自己的每一轮。记下念头不会扣分。</li>
      <li><strong>AI 可接可不接：</strong>用自己的 API key，或者配合 Claude 使用（<a href="claude.html">怎么用</a>）。不接的时候，内置小助手会给每个念头一个下一步。</li>
    </ul>

    <h2>延伸阅读</h2>
    <ul>{zh_guides}</ul>
    <p class="cta"><a class="btn btn-ink btn-big" href="../?lang=zh#/focus">开始一轮学习</a></p>
''', '../', 1)

# ----------------------------------------------------------------------------- about
page('about.html', 'en', 'About', 'What Sidenote is, who makes it, and how it handles your notes.', f'''
    <h1>About Sidenote</h1>
    <p>Sidenote is a study timer with one extra box. While you study, every stray thought (a question, an errand, a worry, an idea) goes into that box in one line, and you keep working. When the block ends, you click each thought and an AI model answers it, plans it, or talks it through. Over time the summary page shows what you worked on, how steady your attention was, and what tends to pull it away.</p>
    <h2>Why it exists</h2>
    <p>Most study tools help you with the material. This one is for the moment your mind leaves the material. It started as a simple observation: some of us wander constantly while studying, and trying harder to concentrate doesn't help. What helps is having somewhere to put the thought so it can wait.</p>
    <h2>Who makes it</h2>
    <p>Sidenote is designed and maintained by Emma Zhao as an independent student project. The first version of the code was written with the help of an AI coding assistant, and the source is public on <a href="{REPO}">GitHub</a>.</p>
    <h2>How it treats your notes</h2>
    <p>There is no account. Your thoughts, plans and study history are stored in your own browser. The text of a thought is sent to an AI model only when you ask for that thought to be dealt with. The details are on the <a href="privacy.html">privacy page</a>.</p>
    <h2>What it is not</h2>
    <p>Sidenote is a study aid. It is not medical or mental-health advice, and its focus score is a rough yardstick for comparing your own sessions, not a measurement of attention. AI replies can be wrong, so check anything that matters.</p>
    <h2>Contact</h2>
    <p>Questions, bugs and ideas are welcome on the <a href="{REPO}/issues">GitHub issues page</a>.</p>
''', 'zh/about.html', 0)

page('zh/about.html', 'zh', '关于', '走神本是什么，谁在做，怎么对待你写下的内容。', f'''
    <h1>关于走神本</h1>
    <p>走神本是一个多了一个输入框的学习计时器。学习的时候，每一个冒出来的念头（一个问题、一件杂事、一个担心、一个点子）都用一行字记进这个框里，然后继续学。这一轮结束后，点开每一条，AI 模型会回答它、帮你拆解它，或者陪你理一理。用久了，总结页会显示你学了什么、注意力有多稳，以及通常是什么把它拉走的。</p>
    <h2>为什么做它</h2>
    <p>大多数学习工具帮你对付学习内容。这个工具管的是你的心思离开内容的那一刻。它来自一个很简单的观察：有些人学习时就是会不停地走神，更用力地「集中注意力」并没有用。有用的是给念头找个地方先放着，让它可以等。</p>
    <h2>谁在做</h2>
    <p>走神本由 Emma Zhao 作为独立的学生项目设计和维护。第一版代码是在 AI 编程助手的帮助下写的，源码公开在 <a href="{REPO}">GitHub</a>。</p>
    <h2>怎么对待你写下的内容</h2>
    <p>不需要注册。你的念头、计划和学习记录都存在你自己的浏览器里。只有当你要求处理某一条念头时，它的文字才会被发给 AI 模型。细节见<a href="privacy.html">隐私说明</a>。</p>
    <h2>它不是什么</h2>
    <p>走神本是学习辅助工具。它不提供医疗或心理健康建议；专注分只用来比较你自己的每一轮学习，不是对注意力的测量。AI 的回复可能出错，重要的事请自己核实。</p>
    <h2>联系</h2>
    <p>有问题、发现 bug 或有想法，欢迎到 <a href="{REPO}/issues">GitHub issues</a> 提出。</p>
''', '../about.html', 1)

# ----------------------------------------------------------------------------- use with Claude
SUPPORT = 'https://support.claude.com/en/articles/12512180'
page('claude.html', 'en', 'Use Sidenote with Claude', 'A free skill that lets Claude deal with the thoughts you parked while studying and review your week, on your own Claude plan.', f"""
    <h1>Use Sidenote with Claude</h1>
    <p>If you already use Claude, you don't need anything else to get real answers to the thoughts you park. The <strong>sidenote-coach</strong> skill teaches Claude what to do with them. It runs in your own Claude account, on your own plan, so it costs this site nothing and needs no API key.</p>

    <h2>What it does</h2>
    <ul>
      <li><strong>Sorts out your margin.</strong> Paste your parked thoughts, or attach a backup file. Questions get answered, to-dos get a first step, worries get a calmer second look, and you get a short "next ten minutes" list.</li>
      <li><strong>Reviews your week.</strong> From a backup file it reports your focus time, focus score, what your stray thoughts were about, the minute of a block they tend to hit, and which scene you focus best with. The numbers are computed by a script, the same way this site computes them.</li>
      <li><strong>Plans a block</strong> in under a minute: one checkable goal, two or three steps, a starting line.</li>
      <li><strong>Holds your thoughts in the chat</strong> when you study without this site open. It replies with a tick and nothing else until you say you're done.</li>
    </ul>

    <h2>Get the skill</h2>
    <p class="cta"><a class="btn btn-ink btn-big" href="skill/sidenote-coach.zip" download>Download sidenote-coach.zip</a></p>
    <p class="byline">A small ZIP file. It contains plain-text instructions and one short Python script; you can read all of it <a href="{REPO}/tree/main/skill/sidenote-coach">on GitHub</a> before adding it.</p>

    <h2>Add it to Claude</h2>
    <ol>
      <li>In Claude, open <strong>Customize</strong>, then <strong>Skills</strong>.</li>
      <li>Click the <strong>+</strong> button, choose <strong>Create skill</strong>, then <strong>Upload a skill</strong>.</li>
      <li>Pick the ZIP file you downloaded. Leave it zipped.</li>
      <li>Make sure the skill is switched on in the list.</li>
    </ol>
    <p>Skills need "Code execution and file creation" switched on in Claude's settings. Claude's menus change from time to time; if these steps don't match what you see, <a href="{SUPPORT}">Claude's help page on skills</a> has the current ones.</p>

    <h2>Use it</h2>
    <ul>
      <li><strong>After a study block:</strong> on the Margin page here, click <strong>Copy for Claude</strong>, then paste into a Claude chat.</li>
      <li><strong>For a weekly review:</strong> in Settings here, click <strong>Save a backup file</strong>, attach that file in Claude and ask "How did my week go?"</li>
      <li><strong>Before studying:</strong> tell Claude "Help me plan a 45-minute block for chapter 7."</li>
      <li><strong>Without this site:</strong> tell Claude "I'm starting a 25-minute block, hold my thoughts."</li>
    </ul>

    <h2>What to know</h2>
    <ul>
      <li>Whatever you paste or attach goes to Claude under your own account and its privacy terms. This site never sees it.</li>
      <li>A chat can't keep time or play sound. The timer, the scenes and the charts stay here.</li>
      <li>Sidenote is an independent student project. It is not affiliated with or endorsed by Anthropic, the company that makes Claude.</li>
    </ul>
""" + cta('en', ''), 'zh/claude.html', 0)

page('zh/claude.html', 'zh', '配合 Claude 使用走神本', '一个免费的 skill：让 Claude 用你自己的额度处理学习时记下的念头，并做每周复盘。', f"""
    <h1>配合 Claude 使用走神本</h1>
    <p>如果你平时就在用 Claude，不需要别的东西，就能让记下的念头得到真正的回答。<strong>sidenote-coach</strong> 这个 skill 会教 Claude 怎么处理它们。它在你自己的 Claude 账号里运行，用的是你自己的额度，所以本站不花钱，你也不用准备 API key。</p>

    <h2>它能做什么</h2>
    <ul>
      <li><strong>处理记下的念头。</strong>把记下的念头粘贴过去，或者上传备份文件。问题给答案，待办给第一步，担心的事换个更平静的角度看，最后给你一张「接下来十分钟」的小清单。</li>
      <li><strong>做每周复盘。</strong>根据备份文件告诉你：专注了多久、专注分多少、走神时在想什么、一般在第几分钟走神、在哪个场景里最专注。数字由脚本计算，算法和本站一致。</li>
      <li><strong>帮你计划一轮学习，</strong>不到一分钟：一个能检查的目标，两三步，一句开始的话。</li>
      <li><strong>在对话里替你记念头。</strong>没开本站时也能用。在你说「结束」之前，它只回一个对勾，别的什么都不说。</li>
    </ul>

    <h2>获取 skill</h2>
    <p class="cta"><a class="btn btn-ink btn-big" href="../skill/sidenote-coach.zip" download>下载 sidenote-coach.zip</a></p>
    <p class="byline">一个很小的 ZIP 文件，里面是纯文本的说明和一个很短的 Python 脚本。添加之前可以先在 <a href="{REPO}/tree/main/skill/sidenote-coach">GitHub</a> 上看完全部内容。</p>

    <h2>添加到 Claude</h2>
    <ol>
      <li>在 Claude 里打开 <strong>Customize</strong>，再点 <strong>Skills</strong>。</li>
      <li>点 <strong>+</strong> 按钮，选 <strong>Create skill</strong>，再选 <strong>Upload a skill</strong>。</li>
      <li>选中刚下载的 ZIP 文件，不用解压。</li>
      <li>确认它在列表里是开启状态。</li>
    </ol>
    <p>使用 skill 需要在 Claude 的设置里打开「Code execution and file creation」。Claude 的菜单时不时会变，如果这里的步骤和你看到的对不上，以 <a href="{SUPPORT}">Claude 官方的 skill 帮助页</a>为准。</p>

    <h2>怎么用</h2>
    <ul>
      <li><strong>学完一轮之后：</strong>在本站的「念头」页点<strong>复制给 Claude</strong>，然后粘贴到 Claude 的对话里。</li>
      <li><strong>每周复盘：</strong>在本站的「设置」页点<strong>保存备份文件</strong>，把文件上传给 Claude，问一句「我这周学得怎么样？」</li>
      <li><strong>开始学习之前：</strong>对 Claude 说「帮我计划一轮 45 分钟的学习，内容是第 7 章」。</li>
      <li><strong>没开本站的时候：</strong>对 Claude 说「我要开始学 25 分钟，先帮我记着冒出来的念头」。</li>
    </ul>

    <h2>需要知道的</h2>
    <ul>
      <li>你粘贴或上传的内容，会在你自己的账号下交给 Claude，适用它的隐私条款。本站看不到这些内容。</li>
      <li>聊天窗口不会计时，也放不了声音。计时器、场景和图表还是在本站。</li>
      <li>走神本是独立的学生项目，与 Claude 的开发公司 Anthropic 没有隶属或合作关系，也未获其认可。</li>
    </ul>
""" + cta('zh', '../'), '../claude.html', 1)

# ----------------------------------------------------------------------------- privacy
page('privacy.html', 'en', 'Privacy', 'What Sidenote stores, what it sends, and who else is involved.', f'''
    <h1>Privacy</h1>
    <p class="byline">Last updated {UPDATED['en']}</p>
    <p>The short version: there is no account, your notes stay in your browser, and the text of a thought leaves your device only when you ask the AI to deal with it.</p>

    <h2>What is stored, and where</h2>
    <p>Everything you enter (parked thoughts, study goals and steps, session history, ratings and settings) is saved in your browser's local storage on your own device. We don't have a database of users and we can't see this data. Clearing your browser data erases it. You can download a backup or erase everything from the Settings page.</p>

    <h2>What is sent to an AI model</h2>
    <p>When you click to have a thought dealt with, ask for suggested steps, or ask for an AI-written recap, the relevant text is sent to an AI model so it can reply:</p>
    <ul>
      <li><strong>Dealing with a thought:</strong> the text of that thought and the goal of the study block it came from.</li>
      <li><strong>Suggested steps:</strong> the goal you typed and the length of the block.</li>
      <li><strong>AI recap:</strong> your summary numbers and the goals you typed. The thoughts themselves are not included.</li>
    </ul>
    <p>Depending on how the site is set up, the request goes either through this site's own server, which forwards it to the model provider and doesn't store it, or, if you entered your own API key in Settings, straight from your browser to the provider you chose. The provider handles that text under its own terms and privacy policy. Nothing is sent until you click, so please don't park anything you wouldn't want processed that way and then ask the AI about it.</p>
    <p>If you enter your own API key, it is stored only in your browser and is not included in backups.</p>

    <h2>Advertising</h2>
    <p>Sidenote is free, and some pages may show ads to pay for running it. Ads are never shown while you are planning or in a study block. When ads are enabled they are provided by Google AdSense:</p>
    <ul>
      <li>Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this and other websites.</li>
      <li>Google's use of advertising cookies enables it and its partners to serve ads based on your visits to this site and other sites on the Internet.</li>
      <li>You can opt out of personalised advertising in <a href="https://adssettings.google.com/">Google's Ads Settings</a>, or opt out of some third-party vendors' cookies at <a href="https://www.aboutads.info/choices/">aboutads.info</a>.</li>
    </ul>
    <p>Where the law requires it (for example in the EEA, the UK and Switzerland), you will be asked for consent before advertising cookies are used. The content of your notes is never shared with advertisers.</p>

    <h2>Other services involved</h2>
    <ul>
      <li><strong>Hosting:</strong> the site is served by GitHub Pages, which logs technical information such as IP addresses.</li>
      <li><strong>Fonts:</strong> the typefaces are files on this site. No request goes to a font service.</li>
      <li><strong>"Search the web", "Ask Claude" and "Ask ChatGPT":</strong> these buttons open the other site in a new tab with the text of that one thought in the link. Nothing is sent unless you press the button, and what happens next is covered by that site's own privacy policy.</li>
    </ul>
    <p>Sidenote doesn't run its own analytics or tracking scripts.</p>

    <h2>Children</h2>
    <p>Sidenote is not directed at children under 13, and we don't knowingly collect personal information from them.</p>

    <h2>Changes and contact</h2>
    <p>If this page changes, the date at the top changes with it. Questions can be raised on the <a href="{REPO}/issues">GitHub issues page</a>.</p>
''', 'zh/privacy.html', 0)

page('zh/privacy.html', 'zh', '隐私', '走神本存了什么，发送了什么，还涉及哪些第三方。', f'''
    <h1>隐私说明</h1>
    <p class="byline">最后更新：{UPDATED['zh']}</p>
    <p>一句话版本：不用注册，你写的东西留在你的浏览器里；只有当你让 AI 处理某一条念头时，那条念头的文字才会离开你的设备。</p>

    <h2>存了什么，存在哪儿</h2>
    <p>你输入的所有内容（记下的念头、学习目标和步骤、学习记录、打分和设置）都保存在你自己设备上的浏览器本地存储里。我们没有用户数据库，也看不到这些数据。清除浏览器数据会把它们一并清掉。你可以在「设置」页下载备份或清空全部。</p>

    <h2>哪些内容会发给 AI 模型</h2>
    <p>当你点击处理一条念头、让它帮你拆步骤，或者让 AI 写总结时，相关文字会被发给 AI 模型，以便它回复：</p>
    <ul>
      <li><strong>处理念头：</strong>那一条念头的文字，以及它所属那一轮学习的目标。</li>
      <li><strong>拆步骤：</strong>你输入的目标和这一轮的时长。</li>
      <li><strong>AI 总结：</strong>你的统计数字和你输入过的目标，不包含念头本身。</li>
    </ul>
    <p>根据网站的配置，请求有两种走法：一种是经过本站自己的服务器转发给模型服务商，本站服务器不保存内容；另一种是你在「设置」里填了自己的 API key，这时请求从你的浏览器直接发给你选的服务商。服务商会按它自己的条款和隐私政策处理这些文字。你不点击就不会发送，所以，不想被这样处理的内容，请不要记下来之后再让 AI 处理。</p>
    <p>如果你填了自己的 API key，它只保存在你的浏览器里，也不会写进备份文件。</p>

    <h2>广告</h2>
    <p>走神本免费使用，部分页面可能展示广告来支付运行成本。在你做计划或学习的过程中，永远不会显示广告。广告开启后由 Google AdSense 提供：</p>
    <ul>
      <li>包括 Google 在内的第三方供应商会使用 cookie，根据你之前访问本站或其他网站的情况来投放广告。</li>
      <li>Google 使用广告 cookie，使它和它的合作伙伴能够根据你对本站及互联网上其他网站的访问情况投放广告。</li>
      <li>你可以在 <a href="https://adssettings.google.com/">Google 广告设置</a>中停用个性化广告，也可以在 <a href="https://www.aboutads.info/choices/">aboutads.info</a> 停用部分第三方供应商的 cookie。</li>
    </ul>
    <p>在法律有要求的地区（例如欧洲经济区、英国和瑞士），使用广告 cookie 之前会先征得你的同意。你记下的内容不会分享给广告商。</p>

    <h2>涉及的其他服务</h2>
    <ul>
      <li><strong>托管：</strong>网站由 GitHub Pages 提供访问，它会记录 IP 地址等技术信息。</li>
      <li><strong>字体：</strong>字体文件就放在本站，不会向任何字体服务发请求。</li>
      <li><strong>「去网上搜」「问 Claude」「问 ChatGPT」：</strong>这几个按钮会在新标签页打开对应的网站，并把这一条念头的文字带在链接里。你不点，就什么都不会发出去；点了之后的事，由对方网站自己的隐私政策负责。</li>
    </ul>
    <p>走神本自己不运行任何统计或追踪脚本。</p>

    <h2>儿童</h2>
    <p>走神本不面向 13 岁以下的儿童，我们也不会有意收集他们的个人信息。</p>

    <h2>变更与联系</h2>
    <p>本页内容如有变化，顶部的日期会同步更新。有疑问可以到 <a href="{REPO}/issues">GitHub issues</a> 提出。</p>
''', '../privacy.html', 1)

# ----------------------------------------------------------------------------- terms
page('terms.html', 'en', 'Terms', 'The terms for using Sidenote.', f'''
    <h1>Terms of use</h1>
    <p class="byline">Last updated {UPDATED['en']}</p>
    <p>By using Sidenote you agree to these terms. They are short on purpose.</p>
    <h2>What you get</h2>
    <p>Sidenote is a free study tool, provided as it is. We try to keep it working and accurate, but we don't promise that it will always be available or free of errors.</p>
    <h2>AI replies</h2>
    <p>Replies are generated by an AI model and can be wrong, incomplete or out of date. Treat them as a starting point and check anything that matters, especially for coursework, health, money or legal questions. Sidenote is not a substitute for a teacher, a doctor or a counsellor. If you are in distress or might be in danger, contact someone you trust or your local emergency services.</p>
    <h2>Your data</h2>
    <p>Your notes are stored in your own browser and are your responsibility to back up. See the <a href="privacy.html">privacy page</a> for what is sent where.</p>
    <h2>Fair use</h2>
    <p>Please don't try to break the service, overload it with automated requests, or use the AI feature for anything unlawful or harmful. We may limit or block use that does.</p>
    <h2>Liability</h2>
    <p>To the extent the law allows, Sidenote and its maintainer are not liable for losses that come from using, or being unable to use, the site.</p>
    <h2>Changes</h2>
    <p>These terms may be updated; the date above shows the latest version. Questions can be raised on the <a href="{REPO}/issues">GitHub issues page</a>.</p>
''', 'zh/terms.html', 0)

page('zh/terms.html', 'zh', '条款', '使用走神本的条款。', f'''
    <h1>使用条款</h1>
    <p class="byline">最后更新：{UPDATED['zh']}</p>
    <p>使用走神本即表示你同意以下条款。我们特意写得很短。</p>
    <h2>你得到的是什么</h2>
    <p>走神本是一个免费的学习工具，按现状提供。我们会尽力让它正常、准确地运行，但不保证它永远可用或没有错误。</p>
    <h2>AI 的回复</h2>
    <p>回复由 AI 模型生成，可能有错、不完整或已经过时。请把它当作起点，重要的内容自己核实，尤其是涉及课业、健康、金钱或法律的问题。走神本不能替代老师、医生或心理咨询师。如果你情绪很糟或者可能有危险，请联系你信任的人或当地的急救服务。</p>
    <h2>你的数据</h2>
    <p>你记下的内容存在你自己的浏览器里，需要你自己备份。哪些内容会发送到哪里，见<a href="privacy.html">隐私说明</a>。</p>
    <h2>合理使用</h2>
    <p>请不要试图破坏服务、用自动化请求压垮它，或者把 AI 功能用于违法或有害的事情。对这类使用，我们可能会限制或屏蔽。</p>
    <h2>责任</h2>
    <p>在法律允许的范围内，走神本及其维护者不对因使用或无法使用本站造成的损失承担责任。</p>
    <h2>变更</h2>
    <p>条款可能会更新，以上面的日期为准。有疑问可以到 <a href="{REPO}/issues">GitHub issues</a> 提出。</p>
''', '../terms.html', 1)
print('pages built')
