/* 易支付签名/验签/链接拼接/表单解析 */
const { test } = require("node:test");
const assert = require("node:assert");
const epay = require("../api/_lib/epay.js");

const params = {
  pid: "1001", type: "wxpay", out_trade_no: "T250101-ABC123", money: "6.90",
  name: "星夜塔罗-轻会员", notify_url: "https://x/api/epay/notify",
  return_url: "https://y/?pay=return", sign_type: "MD5",
};

test("签名可复现", () => {
  const s1 = epay.buildSign(params, "key-123");
  const s2 = epay.buildSign(params, "key-123");
  assert.strictEqual(s1, s2);
  assert.match(s1, /^[0-9a-f]{32}$/);
});
test("验签：正确密钥通过、错误密钥拒绝", () => {
  const signed = { ...params, sign: epay.buildSign(params, "key-123") };
  assert.strictEqual(epay.verifySign(signed, "key-123"), true);
  assert.strictEqual(epay.verifySign(signed, "wrong"), false);
});
test("签名不含 sign/sign_type、忽略空值", () => {
  const signed = { ...params, empty: "", sign_type: "MD5", sign: epay.buildSign(params, "key-123") };
  assert.strictEqual(epay.verifySign(signed, "key-123"), true);
});
test("支付链接拼接正确", () => {
  const url = epay.buildPayUrl("https://pay.example.com/submit.php", params, "key-123");
  assert.ok(url.startsWith("https://pay.example.com/submit.php?"));
  assert.ok(url.includes("sign="));
  assert.ok(url.includes(encodeURIComponent("星夜塔罗-轻会员")));
});
test("表单 body 解析", () => {
  const parsed = epay.parseNotifyBody("pid=1001&out_trade_no=NO1&sign=abc", "application/x-www-form-urlencoded");
  assert.strictEqual(parsed.out_trade_no, "NO1");
  assert.strictEqual(parsed.sign, "abc");
});
