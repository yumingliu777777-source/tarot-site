/**
 * POST /api/epay/create — 创建订单并返回支付链接
 * 请求体：{ planId, method: 'wechat'|'alipay', referrer?, deviceId }
 * 金额在服务端（Supabase create_order RPC）计算，浏览器无法改价。
 * 返回：{ orderNo, payUrl }
 */
const sb = require("../_lib/supabase");
const { buildPayUrl } = require("../_lib/epay");
const { PLAN_NAMES } = require("../_lib/pay");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).end();
    return;
  }
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { planId, method, referrer = "", deviceId = "" } = req.body || {};
  if (!PLAN_NAMES[planId]) { res.status(400).json({ error: "未知方案" }); return; }
  if (method !== "wechat" && method !== "alipay") { res.status(400).json({ error: "未知支付方式" }); return; }
  if (String(deviceId).length < 8) { res.status(400).json({ error: "设备标识无效" }); return; }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    res.status(503).json({ error: "数据库未配置" });
    return;
  }

  // 服务端创建待支付订单（含推荐立减与频率限制）
  let order;
  try {
    order = await sb.rpc("create_order", {
      p_plan: planId,
      p_method: method,
      p_referrer: String(referrer || ""),
      p_device: String(deviceId),
    });
  } catch (e) {
    res.status(502).json({ error: e.message || "创建订单失败" });
    return;
  }

  const money = Number(order.price).toFixed(2);
  const apiBase = `https://${req.headers.host}`;
  const siteOrigin = (process.env.SITE_ORIGIN || "").replace(/\/+$/, "");

  // 测试模式：返回一个立即"支付成功"的链接，用于未接入易支付前验证全流程
  if (process.env.PAYMENT_TEST_MODE === "1") {
    const testUrl =
      `${apiBase}/api/epay/notify?test=1&out_trade_no=${encodeURIComponent(order.order_no)}&money=${money}`;
    res.json({ orderNo: order.order_no, payUrl: testUrl });
    return;
  }

  if (!process.env.EPAY_PID || !process.env.EPAY_KEY || !process.env.EPAY_GATEWAY) {
    res.status(503).json({ error: "支付通道未配置，请在 Vercel 环境变量中设置 EPAY_*" });
    return;
  }

  const params = {
    pid: process.env.EPAY_PID,
    type: method === "alipay" ? "alipay" : "wxpay",
    out_trade_no: order.order_no,
    notify_url: `${apiBase}/api/epay/notify`,
    return_url: `${siteOrigin}/?pay=return&order=${encodeURIComponent(order.order_no)}`,
    name: `星夜塔罗-${PLAN_NAMES[planId]}`,
    money,
    sign_type: "MD5",
  };

  try {
    const payUrl = buildPayUrl(process.env.EPAY_GATEWAY, params, process.env.EPAY_KEY);
    res.json({ orderNo: order.order_no, payUrl });
  } catch (e) {
    res.status(500).json({ error: "生成支付链接失败" });
  }
};
