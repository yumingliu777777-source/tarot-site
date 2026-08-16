/**
 * GET /api/order?no=订单号 — 查询订单状态（前端轮询用）
 * 返回：{ order_no, plan, plan_name, price, status, created_at, paid_at }
 * 订单号是随机短串，仅含方案/金额/状态，不含任何个人信息，可安全轮询。
 */
const sb = require("./_lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const no = String(req.query.no || req.query.order_no || "");
  if (!no) {
    res.status(400).json({ error: "缺少订单号" });
    return;
  }

  try {
    const rows = await sb.select(
      `orders?order_no=eq.${encodeURIComponent(no)}&select=order_no,plan,plan_name,price,status,created_at,paid_at`
    );
    if (!rows || !rows.length) {
      res.status(404).json({ error: "订单不存在" });
      return;
    }
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message || "查询订单失败" });
  }
};
