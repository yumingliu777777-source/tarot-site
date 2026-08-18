/**
 * 支付成功后的核心业务（Cloudflare Workers 版）：确认订单 → 触发返利 → 发放权益（幂等）
 */
import * as sb from "./supabase.js";
import { md5 } from "./epay.js";

const PLAN_DAYS = { single: 7, light: 30, plus: 30 };
const PLAN_CREDITS = { single: 1, light: 10, plus: 30 };

export async function markOrderPaid(orderNo, money, env) {
  if (!orderNo) return { ok: false, reason: "missing_order_no" };

  const rows = await sb.select(
    `orders?order_no=eq.${encodeURIComponent(orderNo)}&select=plan,price,status,issued_code,device_id,account_id`,
    env
  );
  const order = rows && rows[0];
  if (!order) return { ok: false, reason: "order_not_found" };

  if (order.status === "paid") {
    if (!order.issued_code && order.device_id) await issueCode(order, env);
    return { ok: true };
  }

  if (typeof money === "number" && Math.abs(money - Number(order.price)) > 0.01) {
    return { ok: false, reason: "amount_mismatch" };
  }

  await sb.update(
    `orders?order_no=eq.${encodeURIComponent(orderNo)}`,
    { status: "paid", paid_at: new Date().toISOString() },
    env
  );

  await issueCode({ ...order, order_no: orderNo }, env);
  return { ok: true };
}

async function issueCode(order, env) {
  if (order.account_id) {
    const credits = PLAN_CREDITS[order.plan] || 1;
    await sb.rpc("add_credit", {
      p_account_id: order.account_id,
      p_delta: credits,
      p_reason: "purchase",
      p_note: `购买会员订单 ${order.order_no || ""}`,
    }, env);
    await sb.update(
      `orders?order_no=eq.${encodeURIComponent(order.order_no)}`,
      { issued_code: "acct:" + order.account_id },
      env
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
    status: "used",
    used_by: order.device_id,
    activated_at: now,
    expires_at: expires,
  }, env);

  await sb.update(
    `orders?order_no=eq.${encodeURIComponent(order.order_no)}`,
    { issued_code: code },
    env
  );
  return code;
}
