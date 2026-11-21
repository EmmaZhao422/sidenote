# 变现方案（给 Emma）

最后更新：2026-11-21（美东时间）。标 ✓ 的是我在官方页面核对过的；标 ⚠ 的来自第三方文章，没有官方出处，用之前再核一次。

## 结论

1. **广告渠道选 Google AdSense。** 门槛最低、广告质量最干净，适合学生用的工具。
2. **广告只放在不学习的页面：** 首页底部和学习方法文章。念头页、总结页这些工具页面不放（AdSense 不喜欢广告出现在没有文章内容的页面上，学生也不喜欢）。准备和专注的页面永远不放。这条已经写进代码（`js/ads.js`），不是靠自觉。
3. **现在还收不到钱，差三件只有你本人能做的事：** 买域名、申请 AdSense、把你的发布商 ID 填进 `js/config.js`。代码这边已经全部接好，填完就生效。
4. **广告大概只够付域名钱。** 真想做成生意，后面要靠会员功能，见最后一节。

## 为什么是 AdSense

| 渠道 | 门槛 | 适不适合 |
|---|---|---|
| Google AdSense | 满 18 岁、内容原创、网站归你所有、遵守政策 ✓ | 适合。没有流量门槛 |
| Adsterra / PropellerAds | 号称秒过、无流量要求 ⚠ | 不建议。主打弹窗、跳转类广告，放在学习工具上很伤体验 |
| EthicalAds | 面向开发者类网站 ⚠ | 受众不对口 |
| Mediavine / Raptive / Ezoic | 要几万到几十万月访问量 ⚠ | 以后流量大了再考虑 |

AdSense 的官方条件见：https://support.google.com/adsense/answer/9724

## 你要做的 5 步

### 1. 买一个自己的域名（约 10 到 15 美元一年，具体价格待确认）

AdSense 要求网站归你所有。`emmazhao422.github.io` 是 GitHub 的子域名，多篇开发者经验帖都说用这类免费子域名申请会被拒 ⚠（Google 官方没有明说，但要求「拥有或控制网站」）。所以先买域名。

- 在 Cloudflare Registrar 或 Namecheap 买，比如 `sidenote.study`、`zoushenben.com`（名字你定，买之前搜一下有没有重名的产品）。
- 仓库 Settings → Pages → Custom domain 填域名，按 GitHub 的提示去域名商那里加 DNS 记录。
- 然后改 4 个地方的网址：`js/config.js` 的 `siteUrl`、`index.html` 里的 canonical 和 og:url、`sitemap.xml`、`robots.txt`。再把 `worker/wrangler.toml` 的 `ALLOWED_ORIGINS` 加上新域名，把 `404.html` 里的 `/sidenote/` 前缀改成 `/`。

### 2. 申请 AdSense

- 打开 https://adsense.google.com ，用你自己的 Google 账号注册。要填地址和收款信息，这些只能你本人填。
- 添加网站时选你的新域名。Google 会给一段验证代码或让你放 `ads.txt`。
- 审核通常要几天到几周 ⚠。被拒最常见的原因是「内容价值低」⚠，所以网站上已经放了 12 篇中英文的学习方法文章（引用的论文都用搜索核对过作者、期刊、年份和主要结论 ✓；例外两处：Zeigarnik 1920 年代的原始实验和 Cirillo《番茄工作法》的出版年份 2006 只凭记忆 ⚠），以及关于、隐私、条款页面。**审核前再自己写 3 到 5 篇会更稳**，这也是你能亲手做的部分。

### 3. 把 ID 填进代码

审核通过后，在 AdSense 后台「广告 → 按广告单元 → 展示广告」建 2 个广告单元（首页一个，文章页一个），然后改 `js/config.js`：

```js
ads: {
  adsenseClient: 'ca-pub-你的16位数字',
  slots: { home: '单元ID', guide: '单元ID' },
},
```

再把 `ads.txt` 里那一行前面的 `#` 去掉，换成你的发布商 ID。注意 `ads.txt` 必须能在域名根目录访问到（用了自定义域名后自动满足）。

想先看广告位在哪：在网址后面加 `?adpreview=1`，会显示虚线框。

### 4. 打开欧洲地区的同意弹窗

在 AdSense 后台「隐私权和消息 → 欧洲法规」创建一条消息。Google 要求面向欧洲经济区、英国、瑞士的用户投放个性化广告时，必须用它认证过的同意管理平台，它自带的这个工具就是认证过的 ✓。来源：https://support.google.com/adsense/answer/13554116

### 5. 接上 AI（不然「帮我想想」只有内置小帮手）

见 [SETUP-AI.md](SETUP-AI.md)。

### 6.（可选）装一个访问统计

想知道每天有多少人来，可以用 Cloudflare Web Analytics：免费，官方说不用 cookie ⚠（以它的文档为准）。在 Cloudflare 后台「Analytics & Logs → Web Analytics」添加网站，把给你的 token 填进 `js/config.js` 的 `analytics.cloudflareToken`。开了之后，把 `privacy.html` 和 `zh/privacy.html` 里「不运行任何统计脚本」那句改成实际情况。

## 能赚多少（粗算）

广告收入 ≈ 月浏览量 ÷ 1000 × RPM。第三方文章给的 AdSense 平均 RPM 是每千次浏览 2 到 6 美元 ⚠，学生受众可能偏低。

| 月浏览量 | 估算月收入 |
|---|---|
| 1,000 | 2 到 6 美元 |
| 10,000 | 20 到 60 美元 |
| 100,000 | 200 到 600 美元 |

成本这边：域名约 1 美元一个月；AI 用 Claude Haiku 5.5，官方价格是每百万输入 token 0.10 美元起、每百万输出 token 0.50 美元起 ✓，处理一条念头大约 400 输入加 250 输出 token，折合约 0.00017 美元，也就是一万次约 1.7 美元（我的估算 ⚠）。价格页：https://platform.claude.com/docs/en/models/overview

所以：AI 成本很低，广告在流量小的时候几乎可以忽略。

## 流量从哪来

工具页本身很难被搜到，能带来搜索流量的是文章。`guides/` 下面每多一篇认真写的文章，就多一个入口。可以写的题目：

- 番茄钟 25 分钟还是 45 分钟
- 考试周怎么安排一天
- 手机放哪儿才不会去拿
- ADHD 学生的学习环境（写这类要引用可靠来源，不给医疗建议）

另外可以发的地方：小红书、B 站、Reddit 的 r/GetStudying、Product Hunt。

## 比广告更靠谱的收入：以后的会员功能

这些现在都没做，只是方向：

- 多设备同步（现在数据只在一个浏览器里）
- 每周一封邮件总结
- 更多场景、自己混音
- 更长的历史记录和导出

做法是基础功能永久免费，会员每月几美元。等有了第一批真的在用的人，再问他们愿意为什么付钱。

## 关于「市面上有没有类似的」

我查了一下，不是完全没有，但组合起来的确实没看到：

- **FocusTrack**：专注计时加「Parking Lot」，页面上没提 AI 处理念头，也没提背景声。https://www.producthunt.com/p/focus-focustrack/focus-focustrack-2
- **Distraction Vault**：面向 ADHD 的念头收集，有 AI 打标签和待办，没说会回答问题。https://www.producthunt.com/p/wishly/distraction-vault
- **Saner.AI、Recall**：AI 笔记/第二大脑，不是围绕一次学习来设计的。
- **Endel、Noisli、Brain.fm**：主要做背景声（Noisli 和 Brain.fm 这两个是我凭已有了解写的，没有重新核对 ⚠）。

你的想法里别人没做（或者我没查到）的部分是这条完整的线：学习时只记不处理 → 学完 AI 逐条处理 → 用这些记录算出专注情况 → 反过来推荐场景。我只搜了几轮，不算完整的市场调研。
