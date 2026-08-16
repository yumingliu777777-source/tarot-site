/**
 * 易支付（EPay）协议工具：MD5 签名 / 验签 / 拼接支付链接
 * 兼容彩虹易支付、各类“易支付”聚合站（虎皮椒等自建网关均走这套 submit.php 协议）。
 * 签名规则：除 sign、sign_type 及空值外的全部参数按 key 升序排列，
 * 以 k=v 用 & 连接，末尾拼上商户密钥，整体做 MD5。
 */
const crypto = require("crypto");

function md5(value) {
  return crypto.createHash("md5").update(String(value), "utf8").digest("hex");
}

/** 按易支付规则计算签名（返回小写 hex） */
function buildSign(params, merchantKey) {
  const keys = Object.keys(params)
    .filter((k) => k !== "sign" && k !== "sign_type" && params[k] !== "" && params[k] != null)
    .sort();
  const raw = keys.map((k) => `${k}=${params[k]}`).join("&") + merchantKey;
  return md5(raw);
}

/** 校验回调/跳转签名（兼容大小写） */
function verifySign(params, merchantKey) {
  if (!params || !params.sign) return false;
  return buildSign(params, merchantKey).toLowerCase() === String(params.sign).toLowerCase();
}

/** 把参数拼成网关 URL（gateway 形如 https://pay.example.com/submit.php） */
function buildPayUrl(gateway, params, merchantKey) {
  const sign = buildSign(params, merchantKey);
  const qs = Object.entries({ ...params, sign }).map(
    ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
  ).join("&");
  return `${gateway}${gateway.includes("?") ? "&" : "?"}${qs}`;
}

/** 解析易支付回调的原始 body（application/x-www-form-urlencoded 或 JSON 都兼容） */
function parseNotifyBody(rawBody, contentType) {
  if (!rawBody) return {};
  if (typeof rawBody === "object") return rawBody; // @vercel/node 已解析
  try {
    if (contentType && contentType.includes("application/json")) return JSON.parse(rawBody);
  } catch (_) { /* fall through */ }
  const params = {};
  new URLSearchParams(String(rawBody)).forEach((value, key) => { params[key] = value; });
  return params;
}

module.exports = { md5, buildSign, verifySign, buildPayUrl, parseNotifyBody };
