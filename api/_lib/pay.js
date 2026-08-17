/**
 * 支付成功后的核心业务：确认订单 → 触发返利 → 自动发码（幂等）。
 * 被 notify.js（易支付异步回调）与测试模式共用。
 */
const sb = require("./supabase");
const { md5 } = require("./epay");

/** 方案 → 激活码有效期（天） */
const PLAN_DAYS = { single: 7, light: 30, plus: 30 };
const PLAN_NAMES = { single: "深度解读", light: "轻会员", plus: "星夜会员" };
const PLAN_CREDITS = { single: 1, light: 10, plus: 30 };

/**
 * 标记订单已支付并发放权益。
 * @param {string} orderNo 商户订单号（out_trade_no）
 * @param {number} money   回调携带的实付金额（用于对账，防止改价）
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
async function markOrderPaid(orderNo, money) {
  if (!orderNo) return { ok: false, reason: "missing_order_no" };

  const rows = await sb.select(
    `orders?order_no=eq.${encodeURIComponent(orderNo)}&select=plan,price,status,issued_code,device_id,account_id`
  );
  const order = rows && rows[0];
  if (!order) return { ok: false, reason: "order_not_found" };

  // 已处理过：幂等返回，避免易支付重试导致重复发码
  if (order.status === "paid") {
    if (!order.issued_code && order.device_id) await issueCode(order);
    return { ok: true };
  }

  // 金额对账：回调金额必须与订单金额一致（容差 0.01）
  if (typeof money === "number" && Math.abs(money - Number(order.price)) > 0.01) {
    return { ok: false, reason: "amount_mismatch" };
  }

  // 置为已支付：orders 表上的 trg_order_paid 触发器会自动生成返利台账
  await sb.update(
    `orders?order_no=eq.${encodeURIComponent(orderNo)}`,
    { status: "paid", paid_at: new Date().toISOString() }
  );

  // 发放权益：订单绑定了账号则直接入账（走额度账本），否则预激活设备卡密
  await issueCode({ ...order, order_no: orderNo });

  return { ok: true };
}

/** 发放权益（幂等由调用方保证）：优先账号入账，其次设备卡密 */
async function issueCode(order) {
  if (order.account_id) {
    const credits = PLAN_CREDITS[order.plan] || 1;
    await sb.rpc("add_credit", {
      p_account_id: order.account_id,
      p_delta: credits,
      p_reason: "purchase",
      p_note: `购买会员订单 ${order.order_no || ""}`,
    });
    await sb.update(
      `orders?order_no=eq.${encodeURIComponent(order.order_no)}`,
      { issued_code: "acct:" + order.account_id }
    );
    return "acct:" + order.account_id;
  }
  const days = PLAN_DAYS[order.plan] || 30;
  const code = "X" + md5(String(Math.random()) + Date.now()).slice(0, 11).toUpperCase();
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + days * 86400000).toISOString();

  await sb.insert("vip_codes", {
    code,
    plan: order.plan,
    status: "used",          // 预激活
    used_by: order.device_id,
    activated_at: now,
    expires_at: expires,
  });

  await sb.update(
    `orders?order_no=eq.${encodeURIComponent(order.order_no)}`,
    { issued_code: code }
  );
  return code;
}

module.exports = { markOrderPaid, issueCode, PLAN_DAYS, PLAN_NAMES, PLAN_CREDITS };
