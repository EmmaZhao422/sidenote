# 接上 AI：部署 Cloudflare Worker

网站是纯静态的，放在 GitHub Pages 上。API key 不能写进网页（任何人都能看到），所以需要一个小小的中转服务替网站去调用 AI。这个中转就是 `worker/worker.js`，部署到 Cloudflare Workers，免费额度足够起步。

打个比方：网站是前台，Worker 是只有你有钥匙的后厨。客人在前台点单，后厨拿着你的 key 去找 AI 做菜，再把结果端出来。客人永远碰不到钥匙。

## 需要准备

- 一个 Anthropic API key：https://console.anthropic.com （注册、绑卡、建 key 都只能你本人做。**顺手设一个每月消费上限**，这是防止账单失控最可靠的一道保险）
- 一个 Cloudflare 账号：https://dash.cloudflare.com/sign-up
- 电脑上有 Node.js

## 步骤

在仓库的 `worker/` 文件夹里打开终端：

```bash
cd worker
npx wrangler login                          # 浏览器里登录 Cloudflare
npx wrangler secret put ANTHROPIC_API_KEY   # 粘贴你的 key，回车
npx wrangler deploy                         # 部署
```

部署成功后会打印一个网址，类似 `https://sidenote-ai.你的名字.workers.dev`。把它填进 `js/config.js`：

```js
ai: { proxyUrl: 'https://sidenote-ai.你的名字.workers.dev' },
```

提交并推送，等一分钟，网站上每条念头旁会多出「帮我想想」按钮，点它就由真正的 AI 回答。（没接 AI 时没有这个按钮，只有内置小帮手。）

**同一次提交里还要改隐私页。** 隐私页现在写着「截至上面的日期，本站自己的服务器连接还没有开通」。接上之后这句话就不是真的了：打开 `tools/build_pages.py`，搜「还没有开通」和 `switched off`，把中英文两处改成实际情况，再运行 `python3 tools/build_pages.py .` 重新生成页面。

## 建议再做一步：每日总量上限

```bash
npx wrangler kv namespace create LIMITS
```

把打印出来的 id 填进 `worker/wrangler.toml` 里那段被注释掉的 `[[kv_namespaces]]`，去掉 `#`，再 `npx wrangler deploy` 一次。之后每天超过 `DAILY_LIMIT`（默认 2000 次）就会停到第二天。

## 想换成别的模型

Worker 也支持 OpenAI 兼容接口（OpenAI、DeepSeek、OpenRouter 等）。设这三个值即可，不需要改代码：

```bash
npx wrangler secret put AI_API_KEY
# 然后在 wrangler.toml 的 [vars] 里加：
# OPENAI_COMPAT_BASE_URL = "https://api.deepseek.com/v1"
# AI_MODEL = "deepseek-chat"
```

具体的地址和模型名以各家文档为准（上面两行是示例，待确认）。

## 换了自定义域名之后

把 `worker/wrangler.toml` 里的 `ALLOWED_ORIGINS` 改成 `"https://emmazhao422.github.io,https://你的域名"`，重新 deploy。否则 Worker 会拒绝来自新域名的请求。

## 不部署 Worker 会怎样

网站照常能用：记念头、计时、背景声、总结都不依赖 AI。没接 AI 的访客看到的是这样：

- 每条念头直接显示能做的事：待办选日子或排进下一轮，问题先写猜测，担心的事写一件能做的，想摸鱼给一个 10 分钟休息计时
- 每条念头下面有「问 Claude」「问 ChatGPT」「复制，去问别的 AI」。点了会在新标签页打开对方网站，把这条念头带过去，用的是访客自己的账号，不花你的钱。⚠ 这两个链接的格式（`claude.ai/new?q=`、`chatgpt.com/?q=`）来自 Claude 帮助页和第三方文章，上线后请自己点一次确认还能用；哪天失效了，改 `js/ai.js` 里 `offlineReply` 的两行网址，或者直接删掉
- 访客也可以在设置里填自己的 API key。key 默认只留在当前这个标签页里，关掉就没了，勾选「在这台设备上记住 key」才会存下来；它不会进备份文件，恢复备份也不会改动它发往哪里

## 四种 AI 接法，各自谁付钱

| 接法 | 谁付钱 | 现在的状态 |
|---|---|---|
| 网站自己的 AI（Worker） | 你 | 没部署，见上面的步骤 |
| 访客填自己的 API key | 访客 | 能用 |
| 「问 Claude / 问 ChatGPT」按钮 | 访客（用他们自己的账号） | 能用 ⚠ 链接格式待你确认 |
| 配套 skill（`skill/` 文件夹） | 访客（用他们自己的 Claude 额度） | 能用 ⚠ 没在真实的 Claude 应用里装过 |
