# 星夜塔罗 · 会员收款 + 推广返利 搭建指南

本网站支持两种收款模式（可并存，自动降级）：

| 模式 | 买家体验 | 你需要做什么 |
|---|---|---|
| **A. 自动化支付（推荐）** | 选方案 → 微信/支付宝收银台扫码 → 支付成功**自动到账、自动返利**，无需人工 | 开通一个"易支付"聚合商户 + 把 `api/` 部署到 Vercel（约 20 分钟） |
| **B. 个人收款码人工确认** | 扫码付款给你的个人码 → 加你微信 → 你确认后手动发激活码 | 只要你的微信/支付宝收款码（约 10 分钟） |

- 模式 A 需要一个小后端保存商户密钥（Vercel 免费档即可），前端仍是静态站。
- 未配置 Supabase 时，网站自动保持"本地体验"模式，免费功能不受影响。
- 全程免费（Supabase + Vercel 免费档足够）。

---

## 第 1 步：准备收款方式（2 分钟）

**模式 B（人工确认）**：
1. 微信：我 → 服务 → 收付款 → 二维码收款 → 保存收款码 → 得到 `qr-wechat.png`
2. 支付宝：首页搜「收钱」→ 保存收款码 → 得到 `qr-alipay.png`
3. 用你自己的收款码图片**覆盖**仓库里的 `qr-wechat.png` / `qr-alipay.png`（现在是占位图，务必替换）

**模式 A（自动化支付）**：
1. 找任意一家"**易支付**"聚合支付开通商户（搜"易支付 免签约"，例如彩虹易支付等；它们都支持微信+支付宝，按套系协议接入，无需营业执照/商户号）
2. 开通后你会得到：**商户ID（pid）**、**商户密钥（key）**、**网关地址**（形如 `https://pay.xxx.com/submit.php`）
3. 收款码图片可以不用了（收银台由易支付托管），但保留也无妨

## 第 2 步：注册 Supabase 并建数据库（10 分钟）

1. 打开 https://supabase.com 用邮箱注册（免费，不需要身份证/营业执照）
2. 登录后点 **New project**：名字随意（如 `tarot`），密码设一个记牢的，区域选离你近的（如 Singapore 或 Tokyo）
3. 等 1-2 分钟项目建好，左侧菜单点 **SQL Editor** → **New query**
4. 把仓库里 `supabase/schema.sql` 的全部内容粘贴进去 → **Run**
   看到 "Success. No rows returned" 就成功了
5. 点左侧 **Table Editor**，确认能看到这些表：`settings` `vip_codes` `orders` `referrers` `rebates` **`accounts` `sessions`**

> 账号系统说明：`accounts` 表保存用户名 + bcrypt 密码（绝不存明文）、每个账号的专属邀请码、
> 深度解析额度（服务端记账，跟账号走，换设备登录依然可用）；`sessions` 保存登录会话令牌（有效期 30 天）。
> 注册时若填了邀请码，双方各 +1 次深度解析，由服务端直接记账，无法伪造。

> 升级提醒：如果你之前建过库，重新粘贴并运行一遍 `schema.sql` 即可（全部是 `create or replace` / `if not exists`，可重复执行）。

## 第 3 步：把密钥填进网站（3 分钟）

1. Supabase 左侧 **Settings → API**（或 Project Settings → API）
2. 复制 **Project URL**（形如 `https://xxxx.supabase.co`）和 **anon public** 密钥
3. 编辑 `index.html`，找到 `TAROT_SUPABASE` 配置，填进去：

```js
const TAROT_SUPABASE = {
  url: "https://你的项目.supabase.co",
  anonKey: "粘贴 anon public 密钥",
  payApi: "https://tarot-pay.vercel.app",  // 模式A必填：自动化支付后端域名（见第4步）
  qrWechat: "qr-wechat.png",               // 模式B用：你的微信收款码
  qrAlipay: "qr-alipay.png",               // 模式B用：你的支付宝收款码
  contact: "你的微信号",   // 模式B用：买家付完款后加你发订单号
  rebateRate: 0.30,       // 返利比例（展示兜底；实际以数据库 settings 表为准）
  discount: 0.50          // 好友首单立减（展示兜底；实际以数据库 settings 表为准）
};
```

> ⚠️ 填了 `url` + `anonKey` 后，网站才从"本地体验模式"切换成真实收款模式。
> `payApi` 留空 = 模式 B（个人码人工确认）；填了 = 模式 A（自动化支付）。

## 第 4 步（模式 A）：部署支付后端到 Vercel（10 分钟）

`api/` 目录是一个完整的 Vercel Serverless 支付后端（易支付签名、回调、自动发码、自动返利）。详见 [`api/README.md`](api/README.md)，要点：

1. 把这个仓库推到 GitHub → 打开 https://vercel.com → **Add New Project** 导入仓库（Framework 选 Other）→ Deploy
2. 在项目 **Settings → Environment Variables** 添加（值从你开通的易支付商户拿）：
   - `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`（Supabase → Settings → API → service_role，注意不是 anon）
   - `EPAY_PID`、`EPAY_KEY`、`EPAY_GATEWAY`（如 `https://pay.xxx.com/submit.php`）
   - `SITE_ORIGIN`（网站真实域名，如 `https://你的用户名.github.io`）
   - `PAYMENT_TEST_MODE=0`（上线前务必为 0 或删除）
3. 把部署得到的域名（如 `https://tarot-pay.vercel.app`）填进第 3 步的 `payApi`
4. **先测再上线**：把 `PAYMENT_TEST_MODE` 临时设为 `1`，重新 Deploy。此时买家点"去支付"会跳到一个"立即支付成功"的测试链接，整个流程（建单→回调→自动发码→自动返利→前端到账）会真实跑一遍，但**不产生真实扣款**。测完改回 `0`。

## 第 5 步：生成激活码（仅模式 B 需要）

Supabase → **SQL Editor**，执行（生成 20 个轻会员码）：

```sql
select * from generate_codes(20, 'light');
```

- `single` = 单次深度解读（0.99 元，7 天有效，1 次额度）
- `light` = 轻会员（6.90 元，30 天，10 次）
- `plus` = 星夜会员（12.90 元，30 天，30 次）

模式 A 不需要手动生成：买家支付成功后，后端会**自动**为买家生成并预激活一张卡密，权益直接到账。

## 第 6 步：启用店主后台（3 分钟）

1. 打开网站 → 「我的」→ 注册一个普通账号（或直接用现有账号登录）
2. Supabase → **SQL Editor** 执行（把用户名换成你自己的）：

```sql
update accounts set is_admin = true where username = '你的用户名';
```

3. 回到网站刷新 → 「我的」→ 出现 **「⚙ 管理后台」** 按钮（也可直接访问 `你的网站地址/#admin`）

后台包含 6 个页签：

| 页签 | 能做什么 |
|---|---|
| 概览 | 注册用户数、今日新增、被拉新人数、已支付订单、累计收入、待确认订单、待结算返利、未用卡密 |
| 用户 | 所有账号（昵称/邀请码/拉新数/额度），一键 +1 / +10 / -1 调整深度解析额度 |
| 订单 | 按状态筛选订单；**「标记已支付」自动发卡密并生成返利**，「退款/取消」改状态 |
| 返利 | 现金返利台账：已转账 / 不返 |
| 卡密 | 批量生成激活码（1-50 个），一键复制发给买家 |
| 设置 | 改现金返利比例、好友首单立减（等同改 settings 表） |

> 安全说明：后台所有接口都要求"管理员会话"（`accounts.is_admin=true` 的登录态），
> 普通用户/匿名调用一律拒绝；不要把管理员账号的密码告诉别人。

## 第 7 步：上线（git push）

```bash
git add -A
git commit -m "会员收款 + 推广返利（自动化支付）"
git push origin master
```

GitHub Pages 自动生效；Vercel 每次 push 自动重新部署后端。

---

## 日常运营流程

### 模式 A（自动化）：基本什么都不用做

买家付款 → 易支付回调 → 自动置订单 paid → 自动返利 + 自动发码 → 买家权益到账。
你只需要偶尔去 Supabase **Table Editor → orders** 看一眼流水（`status=paid` 即收款成功）。

### 模式 B（人工确认，每单约 1 分钟）

1. 买家在网站选方案 → 扫码付款给你（钱直接进你微信/支付宝，秒到账）
2. 你手机收到到账提醒，金额和方案对上
3. Supabase → **Table Editor → orders**，找到对应订单（看 order_no 或时间）
   把它的 **status 从 pending 改成 paid**（改完保存，返利台账自动生成）
4. 从 `vip_codes` 里复制一个 unused 的码（或 `select * from generate_codes(1, 'light')`）发给买家
5. 买家在网站「已有激活码？输入激活」处输入 → 会员立即开通

### 返利结算（推广优先：拉新得免费深度解析）

**核心规则：每拉 1 个新用户 = 你 +1 次免费深度解析（账号额度，服务端记账）**

1. 推荐人注册账号后，在首页点「复制邀请链接」或进「推广活动」拿专属链接 `?ref=账号邀请码`
2. 好友点链接进入网站 → 首页出现「新人礼」横幅 → 点「立即注册领取」**注册账号**
3. 注册瞬间自动触发：**你和好友各 +1 次深度解析**——好友立即到账，你的计入账号余额（可随时在「推广活动」页查看）
4. 每个账号只计一次、邀请码必须真实存在、同一设备 24 小时最多注册 3 个号（防刷）；多邀多得上不封顶
5. 额度跟账号走：好友/推荐人换设备登录后额度依然在；AI 深度解读每用一次服务端扣一次，无法本地伪造

**补充：好友购买会员时的额外奖励**

- 好友通过你的链接下单并确认到账后，`orders` 表置 paid 会自动在 **Table Editor → rebates** 记一笔现金返利
  （按 `settings.rebate_rate`，默认 30%）；你人工转账后把 status 改成 `paid` 留底，不想返就改 `skipped`
- 该返利以订单里的推荐码为准，最终由你人工确认，发现异常可以拒付

**运营提示**：拉新是纯免费奖励（AI 深度解读走用户自己的 API Key，不产生你的成本），
适合放手让用户去裂变；现金返利才涉及真金白银，按订单逐笔人工结算即可。

### 常见操作

| 想做什么 | 怎么做 |
|---|---|
| 改返利比例 | Table Editor → settings → rebate_rate（如 0.3 改成 0.5） |
| 改首单立减 | settings → discount |
| 买家退款 | orders 改 status=cancelled；若已 paid 另手动处理 rebates |
| AI 解读恢复免费 | index.html 里 `AI_REPORT_NEEDS_MEMBER` 改成 false |
| 查收入 | Table Editor → orders（status=paid 的 price 求和） |
| 查拉新数据 | Table Editor → accounts（referrer 列非空的即被拉来的新用户） |
| 给用户补/扣额度 | Table Editor → accounts → credits 直接改数值 |
| 买家看订单 | 网站「我的」页（会员订单目前按设备记录） |

---

## 注意事项（实话实说）

- **模式 A 的钱去哪了**：易支付是第三方聚合支付，买家付款先进易支付账户，按它们平台的结算周期（通常 T+1 或按平台规则）提现到你绑定的收款账户。**选平台前先确认结算周期与提现手续费**，别选明显可疑的站。
- **模式 B 没有自动对账**：个人收款码没有官方 API，每笔都得你人工确认到账再发码。金额小、量不大时人工确认完全够用。
- **推荐码就是推荐人的身份凭证**：推广链接 `?ref=XXXX` 里的码是唯一的身份标识。提醒推荐人别把链接发到公共大群（防止别人冒领返利）；现金返利最终由你人工确认转账，发现异常可以拒付。
- **账号安全**：密码用 bcrypt 加密存储（`accounts.password_hash`，无明文）；登录失败 8 次锁定 15 分钟；会话令牌随机生成、30 天有效，仅存用户浏览器 localStorage。这是轻量自建账号系统，适合小站——如果你以后要做大规模/高价值业务，建议升级为 Supabase Auth（邮箱/手机验证码登录）。
- **防刷**：同一设备 24 小时内最多注册 3 个账号；邀请码必须对应真实账号。额度是服务端账本（`accounts.credits`），用户无法本地伪造。
- **安全**：anon key 是公开密钥，可放心放 GitHub Pages；`service_role` 密钥和易支付商户密钥**只存在 Vercel 环境变量**，绝不要提交到仓库。回调一律验签 + 金额对账，重复通知不会重复发码。
- **隐私**：账号、订单、推广关系都在 Supabase 数据库里，只有你能看。
- 本文件不包含任何密钥，可以放心提交到公开仓库。
