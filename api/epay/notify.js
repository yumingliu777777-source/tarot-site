/**
 * POST /api/epay/notify — 易支付异步回调（服务端到服务端）
 * 必须校验 MD5 签名 + 金额对账，绝不能信任浏览器跳转参数。
 * 返回纯文本 success / fail；易支付收到 success 后停止重试。
 *
 * GET /api/epay/notify?test=1&out_trade_no=...&money=...（仅 PAYMENT_TEST_MODE=1 时可用）
 * 测试模式：跳过签名直接模拟支付成功，然后 302 跳回站点的 pay=return 页面。
 */
const { verifySign, parseNotifyBody } = require("../_lib/epay");
const { markOrderPaid } = require("../_lib/pay");

module.exports = async function handler(req, res) {
  const siteOrigin = (process.env.SITE_ORIGIN || "").replace(/\/+$/, "");

  // ---------- 测试模式 ----------
  if (process.env.PAYMENT_TEST_MODE === "1" && req.method === "GET" && req.query.test === "1") {
    try {
      await markOrderPaid(String(req.query.out_trade_no || ""), Number(req.query.money));
    } catch (e) {
      res.writeHead(302, { Location: `${siteOrigin}/?pay=return&order=${encodeURIComponent(req.query.out_trade_no || "")}&err=1` });
      res.end();
      return;
    }
    res.writeHead(302, {
      Location: `${siteOrigin}/?pay=return&order=${encodeURIComponent(req.query.out_trade_no || "")}`,
    });
    res.end();
    return;
  }

  // ---------- 真实回调 ----------
  if (req.method !== "POST") {
    res.status(405).send("fail");
    return;
  }
  if (!process.env.EPAY_KEY) {
    res.status(503).send("fail");
    return;
  }

  const params = parseNotifyBody(req.body, req.headers["content-type"] || "");
  // 兼容部分网关把参数放在 query 上
  Object.assign(params, req.query || {});

  // 1) 验签
  if (!verifySign(params, process.env.EPAY_KEY)) {
    res.status(400).send("fail");
    return;
  }
  // 2) 仅处理成功状态
  const tradeStatus = String(params.trade_status || "");
  if (!["TRADE_SUCCESS", "TRADE_FINISHED"].includes(tradeStatus)) {
    res.status(200).send("success"); // 非成功状态也回 success，避免无意义重试
    return;
  }

  try {
    const result = await markOrderPaid(
      String(params.out_trade_no || ""),
      Number(params.money)
    );
    if (!result.ok) {
      if (result.reason === "amount_mismatch") {
        res.status(400).send("fail"); // 金额不符视为异常，不回 success 让网关重试/告警
      } else {
        // 订单不存在等情况：回 success 避免无限重试，人工在后台排查
        res.status(200).send("success");
      }
      return;
    }
    res.status(200).send("success");
  } catch (e) {
    // 网络/数据库瞬时错误：回 fail，让易支付稍后重试
    res.status(500).send("fail");
  }
};
