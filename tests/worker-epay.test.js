/* Worker 纯 JS MD5 与签名逻辑校验（与 Node crypto 对齐） */
const { test, before } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");

let epay;
before(async () => {
  epay = await import("../worker/lib/epay.js");
});

test("MD5 与 Node crypto 一致（含中文）", () => {
  ["", "abc", "123456", "星夜塔罗", "pid=1001&type=wxpay&money=6.90&key"].forEach(s => {
    const expected = crypto.createHash("md5").update(s, "utf8").digest("hex");
    assert.strictEqual(epay.md5(s), expected, `md5("${s}")`);
  });
});

test("易支付签名可复现 + 验签", () => {
  const params = { pid: "1001", type: "wxpay", out_trade_no: "T1", money: "6.90", sign_type: "MD5" };
  const signed = { ...params, sign: epay.buildSign(params, "key-123") };
  assert.match(signed.sign, /^[0-9a-f]{32}$/);
  assert.strictEqual(epay.verifySign(signed, "key-123"), true);
  assert.strictEqual(epay.verifySign(signed, "wrong"), false);
});

test("支付链接拼接", () => {
  const params = { pid: "1", out_trade_no: "T1", money: "1.00" };
  const url = epay.buildPayUrl("https://pay.example.com/submit.php", params, "k");
  assert.ok(url.startsWith("https://pay.example.com/submit.php?"));
  assert.ok(url.includes("sign="));
});

test("表单解析", () => {
  const p = epay.parseNotifyBody("pid=1&out_trade_no=NO1&sign=abc");
  assert.strictEqual(p.out_trade_no, "NO1");
});
