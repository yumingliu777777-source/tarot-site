# Cloudflare Worker 后端（国内连通性更好）

Vercel 的 `*.vercel.app` 在国内经常被墙/限速，导致用户 AI 报 "Load failed"。
把同一个后端迁到 **Cloudflare Workers**（`*.workers.dev`，国内连通性明显更好），
接口路径完全一致，前端只需把 `aiApi`（和 `payApi`）改成 Worker 域名。

## 部署（5 分钟）

1. 注册 https://dash.cloudflare.com （邮箱即可，免费）
2. 本机安装工具（PowerShell，npm 已验证可用）：
   ```
   npm install -g wrangler
   ```
3. 登录：
   ```
   cd E:\tarot-site\worker
   wrangler login
   ```
   会打开浏览器授权 Cloudflare 账号
4. 添加密钥（Dashboard → Workers & Pages → 你的 Worker `tarot-ai` → Settings → **Variables and Secrets** → Add secret）：
   - `SUPABASE_SERVICE_ROLE_KEY`（Supabase → Settings → API → service_role）
   - `AI_KEY`（你的 AI 密钥）
   - `EPAY_PID`、`EPAY_KEY`（用自动收款时才需要）
5. 部署：
   ```
   cd E:\tarot-site\worker
   wrangler deploy
   ```
   完成后会给你一个地址：`https://tarot-ai.你的子域.workers.dev`

## 切换网站

把 Worker 地址填进 `index.html` 的 `TAROT_SUPABASE.aiApi`（如要自动收款也填 `payApi`），
然后推送。之后所有用户的 AI 请求都走 Worker。

## 验证

浏览器打开 `https://你的worker域名/api/ai`：
- 显示 `{"error":"Method not allowed"}` = 部署成功 ✅

## 说明

- 非敏感变量（`SUPABASE_URL`、`AI_ENDPOINT`、`AI_MODEL`、`SITE_ORIGIN`）已写在 `wrangler.toml`
- 密钥一律走 Dashboard Secrets，绝不进仓库
- 免费档：每天 10 万次请求，小站足够
- Vercel 版 `api/` 保留不删（双保险）；Worker 域名生效后，前端只指向 Worker 即可
