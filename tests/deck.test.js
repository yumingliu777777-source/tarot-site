/* 牌库数据校验：js/deck.js 必须包含 78 张结构完整的牌、大白话释义、纯数字映射 */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "js", "deck.js"), "utf8");
const getDeck = new Function(src + "\n;return { DECK, cardNumber, SUIT_GLYPH, MAJOR_GLYPH, COURT_NUM, MINOR_NUM };");
const { DECK, cardNumber } = getDeck();

test("共 78 张牌", () => assert.strictEqual(DECK.length, 78));
test("大阿卡纳 22 张 + 小阿卡纳 56 张", () => {
  assert.strictEqual(DECK.filter(c => c[3] === "大").length, 22);
  assert.strictEqual(DECK.filter(c => c[3] !== "大").length, 56);
});
test("中文名唯一", () => {
  const names = DECK.map(c => c[0]);
  assert.strictEqual(new Set(names).size, 78);
  assert.ok(!names.some(n => !n || n.length < 2), "存在空名");
});
test("每张牌为 7 字段完整结构", () => {
  DECK.forEach(c => assert.strictEqual(c.length, 7, c[0] + " 字段数=" + c.length));
});
test("释义为非空大白话（每张 ≥8 字）", () => {
  DECK.forEach(c => {
    assert.ok(c[5] && c[5].length >= 8, c[0] + " 正位释义过短");
    assert.ok(c[6] && c[6].length >= 8, c[0] + " 逆位释义过短");
  });
});
test("释义不含书面腔/旧版措辞", () => {
  DECK.forEach(c => {
    assert.ok(!/(徐徐|莅临|徜徉|喷薄|翕动)/.test(c[5] + c[6]), c[0] + " 释义仍含书面腔");
  });
});
test("数字牌/宫廷牌/大阿卡纳数字映射", () => {
  assert.strictEqual(cardNumber(["愚者", "", 0, "大"]), "0");
  assert.strictEqual(cardNumber(["权杖侍从", "", "侍从", "权杖"]), "11");
  assert.strictEqual(cardNumber(["圣杯骑士", "", "骑士", "圣杯"]), "12");
  assert.strictEqual(cardNumber(["宝剑皇后", "", "皇后", "宝剑"]), "13");
  assert.strictEqual(cardNumber(["星币国王", "", "国王", "星币"]), "14");
  assert.strictEqual(cardNumber(["星币十", "", "X", "星币"]), "10");
  assert.strictEqual(cardNumber(["圣杯三", "", "III", "圣杯"]), "3");
  assert.strictEqual(cardNumber(["权杖一", "", "A", "权杖"]), "1");
});
