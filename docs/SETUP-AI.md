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

提交并推送，等一分钟，网站上的「帮我处理」就会用真正的 AI 回答。

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

网站照常能用：记念头、计时、背景声、总结都不依赖 AI。「帮我处理」会用内置小帮手（按类型给下一步建议，但答不了问题）。访客也可以在设置里填自己的 API key。
