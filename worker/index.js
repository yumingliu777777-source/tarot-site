/**
 * 星夜塔罗 · Cloudflare Worker 后端
 * 路由：POST /api/ai · POST /api/epay/create · POST|GET /api/epay/notify · GET /api/order
 * 部署：cd worker && npx wrangler deploy
 * 环境变量：见 wrangler.toml（非敏感）+ Dashboard Secrets（密钥）
 */
import * as sb from "./lib/supabase.js";
import { buildSign, verifySign, buildPayUrl, parseNotifyBody } from "./lib/epay.js";
import { markOrderPaid } from "./lib/pay.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
function text(status, body) {
  return new Response(String(body), { status, headers: { ...CORS } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    try {
      if (path === "/api/ai" && method === "POST") return await handleAi(request, env);
      if (path === "/api/epay/create" && method === "POST") return await handleCreate(request, env, url);
      if (path === "/api/epay/notify") return await handleNotify(request, env, url);
      if (path === "/api/order" && method === "GET") return await handleOrder(url, env);
    } catch (e) {
      return json(500, { error: e.message || "服务异常" });
    }
    return json(404, { error: "Not Found" });
  },
};

/* ---------- /api/ai：店主 AI 深度解析 ---------- */
async function handleAi(request, env) {
  if (!env.AI_ENDPOINT || !env.AI_MODEL || !env.AI_KEY) {
    return json(503, { error: "店主 AI 通道未配置（Worker 环境变量 AI_ENDPOINT / AI_MODEL / AI_KEY）" });
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(503, { error: "数据库未配置" });
  }
  let body;
  try { body = await request.json(); } catch (e) { return json(400, { error: "参数无效" }); }
  const { token, prompt } = body || {};
  if (!token || typeof prompt !== "string" || prompt.length < 10 || prompt.length > 4000) {
    return json(400, { error: "参数无效" });
  }

  // 校验登录会话 + 额度
  let account;
  try {
    const sessions = await sb.select(`sessions?token=eq.${encodeURIComponent(token)}&select=account_id,expires_at`, env);
    const session = sessions && sessions[0];
    if (!session || new Date(session.expires_at).getTime() < Date.now()) {
      return json(401, { error: "登录已过期，请重新登录" });
    }
    const accounts = await sb.select(`accounts?id=eq.${encodeURIComponent(session.account_id)}&select=credits`, env);
    account = accounts && accounts[0];
    if (!account || Number(account.credits) < 1) {
      return json(402, { error: "深度解析额度不足：邀请好友注册或开通会员即可获得" });
    }
  } catch (e) {
    return json(500, { error: e.message || "校验登录失败" });
  }

  // 调用店主 AI
  let textOut;
  try {
    const aiRes = await fetch(`${String(env.AI_ENDPOINT).replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.AI_KEY}` },
      body: JSON.stringify({
        model: env.AI_MODEL,
        messages: [
          { role: "system", content: "你以中文提供关怀、接地气的塔罗解读，说话像朋友聊天，全程大白话，不堆砌辞藻，不声称预测绝对未来，不提供医疗、法律、投资或危机建议。" },
          { role: "user", content: prompt },
        ],
        temperature: 0.75,
      }),
    });
    if (!aiRes.ok) return json(502, { error: `AI 服务返回 ${aiRes.status}，请检查店主配置` });
    const data = await aiRes.json();
    textOut = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!textOut) return json(502, { error: "AI 未返回解读内容" });
  } catch (e) {
    return json(502, { error: "AI 服务暂时不可用，请稍后再试" });
  }

  try {
    await sb.rpc("consume_credit_account", { p_token: token }, env);
  } catch (e) { /* 扣减失败不阻塞返回 */ }
  return json(200, { ok: true, text: textOut });
}

/* ---------- /api/epay/create：创建订单并返回支付链接 ---------- */
const PLAN_NAMES = { single: "深度解读", light: "轻会员", plus: "星夜会员" };

async function handleCreate(request, env, url) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(503, { error: "数据库未配置" });
  }
  let body;
  try { body = await request.json(); } catch (e) { return json(400, { error: "参数无效" }); }
  const { planId, method, referrer = "", deviceId = "" } = body || {};
  if (!PLAN_NAMES[planId]) return json(400, { error: "未知方案" });
  if (method !== "wechat" && method !== "alipay") return json(400, { error: "未知支付方式" });
  if (String(deviceId).length < 8) return json(400, { error: "设备标识无效" });

  let order;
  try {
    order = await sb.rpc("create_order", {
      p_plan: planId, p_method: method, p_referrer: String(referrer || ""), p_device: String(deviceId),
    }, env);
  } catch (e) {
    return json(502, { error: e.message || "创建订单失败" });
  }

  const money = Number(order.price).toFixed(2);
  const apiBase = `https://${url.host}`;
  const siteOrigin = (env.SITE_ORIGIN || "").replace(/\/+$/, "");

  if (env.PAYMENT_TEST_MODE === "1") {
    const testUrl = `${apiBase}/api/epay/notify?test=1&out_trade_no=${encodeURIComponent(order.order_no)}&money=${money}`;
    return json(200, { orderNo: order.order_no, payUrl: testUrl });
  }

  if (!env.EPAY_PID || !env.EPAY_KEY || !env.EPAY_GATEWAY) {
    return json(503, { error: "支付通道未配置，请在 Worker 环境变量设置 EPAY_*" });
  }

  const params = {
    pid: env.EPAY_PID,
    type: method === "alipay" ? "alipay" : "wxpay",
    out_trade_no: order.order_no,
    notify_url: `${apiBase}/api/epay/notify`,
    return_url: `${siteOrigin}/?pay=return&order=${encodeURIComponent(order.order_no)}`,
    name: `星夜塔罗-${PLAN_NAMES[planId]}`,
    money,
    sign_type: "MD5",
  };
  const payUrl = buildPayUrl(env.EPAY_GATEWAY, params, env.EPAY_KEY);
  return json(200, { orderNo: order.order_no, payUrl });
}

/* ---------- /api/epay/notify：异步回调（验签+对账+发权益） ---------- */
async function handleNotify(request, env, url) {
  const siteOrigin = (env.SITE_ORIGIN || "").replace(/\/+$/, "");

  // 测试模式（GET ?test=1，仅 PAYMENT_TEST_MODE=1）
  if (env.PAYMENT_TEST_MODE === "1" && request.method === "GET" && url.searchParams.get("test") === "1") {
    try {
      await markOrderPaid(String(url.searchParams.get("out_trade_no") || ""), Number(url.searchParams.get("money")), env);
    } catch (e) { /* 测试失败也跳回 */ }
    return new Response(null, {
      status: 302,
      headers: { Location: `${siteOrigin}/?pay=return&order=${encodeURIComponent(url.searchParams.get("out_trade_no") || "")}` },
    });
  }

  if (request.method !== "POST") return text(405, "fail");
  if (!env.EPAY_KEY) return text(503, "fail");

  const raw = await request.text();
  const params = parseNotifyBody(raw);
  // 兼容部分网关把参数放在 query
  url.searchParams.forEach((v, k) => { if (!params[k]) params[k] = v; });

  if (!verifySign(params, env.EPAY_KEY)) return text(400, "fail");

  const tradeStatus = String(params.trade_status || "");
  if (!["TRADE_SUCCESS", "TRADE_FINISHED"].includes(tradeStatus)) return text(200, "success");

  try {
    const result = await markOrderPaid(String(params.out_trade_no || ""), Number(params.money), env);
    if (!result.ok && result.reason === "amount_mismatch") return text(400, "fail");
    return text(200, "success");
  } catch (e) {
    return text(500, "fail");
  }
}

/* ---------- /api/order：查询订单状态 ---------- */
async function handleOrder(url, env) {
  const no = String(url.searchParams.get("no") || url.searchParams.get("order_no") || "");
  if (!no) return json(400, { error: "缺少订单号" });
  try {
    const rows = await sb.select(
      `orders?order_no=eq.${encodeURIComponent(no)}&select=order_no,plan,plan_name,price,status,created_at,paid_at`,
      env
    );
    if (!rows || !rows.length) return json(404, { error: "订单不存在" });
    return json(200, rows[0]);
  } catch (e) {
    return json(500, { error: e.message || "查询订单失败" });
  }
}
