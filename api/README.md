# 星夜塔罗 · 支付后端（Vercel Serverless）

前端是 GitHub Pages / Vercel 静态站，无法保存商户密钥，因此支付逻辑放在本目录的
**Vercel Serverless Functions** 里：易支付回调在这里验签、对账、标记订单、自动发码并触发返利。

## 部署

1. 把这个仓库推到 GitHub，然后到 [vercel.com](https://vercel.com) 导入项目（Framework 选 Other）。
   会生成一个域名，如 `tarot-pay.vercel.app`。
2. 在 Vercel 项目 **Settings → Environment Variables** 添加（见根目录 `.env.example`）：
   - `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`
   - `EPAY_PID`、`EPAY_KEY`、`EPAY_GATEWAY`
   - `SITE_ORIGIN`（网站真实域名，如 `https://xxx.github.io`）
   - `PAYMENT_TEST_MODE=0`（上线前务必关掉）
3. 部署成功后，把该域名填进 `index.html` 的 `TAROT_SUPABASE.payApi`。
4. 打开网站「VIP 会员」→ 选方案 → 下一步 → 应跳转到易支付收银台。

## 接口

| 路径 | 方法 | 说明 |
|---|---|---|
| `/api/epay/create` | POST | `{planId, method, referrer, deviceId}` → `{orderNo, payUrl}`。金额在服务端计算 |
| `/api/epay/notify` | POST | 易支付异步回调：验签 → 金额对账 → 订单置 paid（自动返利）→ 自动发码。返回 `success` |
| `/api/epay/notify?test=1` | GET | 仅 `PAYMENT_TEST_MODE=1` 时可用，模拟支付成功 |
| `/api/order?no=订单号` | GET | 前端轮询订单状态（含 CORS） |
| `/api/ai` | POST | 店主 AI 深度解析：`{token, prompt}`，校验登录会话 + 服务端扣 1 次账号额度 → `{ok, text}` |

## 店主 AI 深度解析（接你自己的 API）

1. 找一个 OpenAI 兼容的模型服务（DeepSeek / 通义千问 / Kimi / OpenRouter 等），拿到 **API Key** 和接口地址
2. 在 Vercel 环境变量里加（Key 只存在 Vercel，用户看不到）：
   - `AI_ENDPOINT`（如 `https://api.deepseek.com/v1`）
   - `AI_MODEL`（如 `deepseek-chat`）
   - `AI_KEY`（你的密钥）
3. 网站 `index.html` → `TAROT_SUPABASE.aiApi` 填这个后端域名（和 `payApi` 同一个 Vercel 域名即可，填了 payApi 可以留空 aiApi）
4. 之后所有用户的「AI 深度解读」都走你的 API：每次校验登录会话、扣 1 次账号额度（服务端记账），无需用户自带 Key

> 未配置 AI_* 时，`/api/ai` 返回 503；网站会自动退回"用户自带 Key"模式（原 AI 设置功能仍可用）。

## 支付成功后发生了什么

1. 买家跳转到易支付收银台完成扫码付款。
2. 易支付向 `/api/epay/notify` 发送异步通知（会重试直到收到 `success`）。
3. 后端验签、核对金额后把 `orders.status` 改为 `paid`：
   - **返利**：`orders` 表上的 `trg_order_paid` 触发器自动生成返利台账（推荐人是额度返利则自动 +1）。
   - **发码**：后端为买家设备预生成并激活一张卡密，买家无需输入激活码，权益自动到账。
4. 买家浏览器从易支付跳回 `SITE_ORIGIN/?pay=return&order=订单号`，前端轮询 `/api/order` 确认后自动同步权益。

## 本地调试

```bash
vercel dev          # 需要登录 Vercel CLI，环境变量读 .env
curl -X POST http://localhost:3000/api/epay/create \
  -H 'Content-Type: application/json' \
  -d '{"planId":"light","method":"wechat","referrer":"","deviceId":"test-device-0001"}'
```

## 安全说明

- 商户密钥只存在于 Vercel 环境变量；静态站里只有公开的 Supabase anon key。
- 回调一律验签 + 金额对账；订单置 paid 用 `where status='pending'` 幂等，重复通知不会重复发码。
- `api/_lib/*` 仅供后端使用，请勿在 `index.html` 中引用。
