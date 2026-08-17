/* 支付核心逻辑：markOrderPaid 幂等、金额对账、自动发码 */
const { test } = require("node:test");
const assert = require("node:assert");

process.env.SUPABASE_URL = "https://fake.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "svc-test-key";
const pay = require("../api/_lib/pay.js");

function makeDb() {
  const db = new Map();
  db.set("NO1", { plan: "light", price: "6.90", status: "pending", issued_code: null, device_id: "device-abc-123" });
  const calls = [];
  global.fetch = async (url, opts = {}) => {
    calls.push({ url, opts });
    const path = url.replace("https://fake.supabase.co/rest/v1/", "");
    if (path === "vip_codes") {
      return { ok: true, status: 201, json: async () => [JSON.parse(opts.body)] };
    }
    const no = decodeURIComponent(/order_no=eq\.([^&]+)/.exec(path)[1]);
    if (opts.method === "PATCH") {
      const row = db.get(no);
      Object.assign(row, JSON.parse(opts.body));
      return { ok: true, status: 200, json: async () => [row] };
    }
    const row = db.get(no);
    return { ok: true, status: 200, json: async () => (row ? [row] : []) };
  };
  return { db, calls };
}

test("首次支付：订单置 paid、自动发码、只发一张", async () => {
  const { db, calls } = makeDb();
  const r = await pay.markOrderPaid("NO1", 6.9);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(db.get("NO1").status, "paid");
  assert.ok(db.get("NO1").issued_code);
  assert.strictEqual(calls.filter(c => c.url.endsWith("vip_codes")).length, 1);
});
test("重复回调幂等：不再发码", async () => {
  const { db, calls } = makeDb();
  await pay.markOrderPaid("NO1", 6.9);
  await pay.markOrderPaid("NO1", 6.9);
  assert.strictEqual(db.get("NO1").status, "paid");
  assert.strictEqual(calls.filter(c => c.url.endsWith("vip_codes")).length, 1);
});
test("金额不符拒绝", async () => {
  const { db } = makeDb();
  const r = await pay.markOrderPaid("NO1", 1.0);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, "amount_mismatch");
  assert.strictEqual(db.get("NO1").status, "pending");
});
test("订单不存在", async () => {
  const { } = makeDb();
  const r = await pay.markOrderPaid("NO999", 6.9);
  assert.strictEqual(r.reason, "order_not_found");
});
