/* 推送前自检：所有 JS 语法 + 拆分完整性 + 关键文件存在（快速，非单元测试） */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const files = [
  "js/deck.js", "js/site.js",
  "api/_lib/epay.js", "api/_lib/supabase.js", "api/_lib/pay.js",
  "api/epay/create.js", "api/epay/notify.js", "api/order.js", "api/ai.js",
  "tools/split.js",
];

let fail = 0;
console.log("═══ 推送前自检 ═══");
for (const f of files) {
  try {
    execFileSync(process.execPath, ["--check", path.join(root, f)], { stdio: "pipe" });
    console.log("  PASS  语法  " + f);
  } catch (e) {
    fail++;
    console.log("  FAIL  语法  " + f + "\n        " + (e.stderr || e.message).toString().split("\n")[0]);
  }
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const checks = [
  ["引用 style.css", html.includes('href="style.css"')],
  ["引用 js/deck.js", html.includes('src="js/deck.js"')],
  ["引用 js/site.js", html.includes('src="js/site.js"')],
  ["无内联主脚本", !html.includes('"use strict";')],
  ["页脚有版本号", /v1\.\d+/.test(html)],
  ["登录墙存在", html.includes('id="authGate"')],
];
for (const [name, ok] of checks) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) fail++;
}

const deck = fs.readFileSync(path.join(root, "js", "deck.js"), "utf8");
const cardCount = (deck.match(/^\["/gm) || []).length;
console.log(`  ${cardCount === 78 ? "PASS" : "FAIL"}  牌库 ${cardCount} 张（应为78）`);
if (cardCount !== 78) fail++;

console.log(fail === 0 ? "═══ 全部通过 ✅ 可以推送 ═══" : `═══ ${fail} 项失败，先修复再推送 ═══`);
process.exit(fail === 0 ? 0 : 1);
