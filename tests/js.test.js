/* js/site.js 语法与关键函数完整性（不执行，只解析） */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const site = fs.readFileSync(path.join(root, "js", "site.js"), "utf8");

test("site.js 语法可解析", () => {
  assert.doesNotThrow(() => new Function(site), "site.js 语法错误");
});
test("关键函数/常量齐全", () => {
  const required = [
    "function openAccount", "function openAccountReal", "function renderGateForm", "function showAuthGate",
    "function openMemberBilling", "function renderMemberCheckout", "function openAdmin", "function loadAdminTab",
    "function generateAiReportV2", "function refreshAccount", "function applyNumStyle", "function updateNewbieBanner",
    "function renderReport", "function buildDeck", "function goHome", "function closeModal",
    "const TAROT_SUPABASE", "const SPREADS", "const MEMBER_PLANS",
  ];
  required.forEach(name => {
    assert.ok(site.includes(name), "site.js 缺 " + name);
  });
});
test("初始化执行顺序：buildDeck / 登录墙 / 版本", () => {
  assert.ok(site.includes("buildDeck();"));
  assert.ok(site.includes("showAuthGate();"));
});
