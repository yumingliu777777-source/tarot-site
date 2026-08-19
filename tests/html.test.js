/* 页面结构校验：index.html 引用拆分后的文件、无内联主脚本、无重复 id、关键元素齐全 */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("引用 style.css / js/deck.js / js/site.js", () => {
  assert.ok(html.includes('href="style.css"'), "缺 style.css 引用");
  assert.match(html, /src="js\/deck\.js(?:\?[^\"]*)?"/, "缺 deck.js 引用");
  assert.match(html, /src="js\/site\.js(?:\?[^\"]*)?"/, "缺 site.js 引用");
});
test("无内联主脚本残留", () => {
  assert.ok(!html.includes('"use strict";'), "index.html 仍含内联主脚本");
});
test("无重复 id", () => {
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  assert.strictEqual(dup.length, 0, "重复 id: " + dup.join(","));
});
test("div 标签平衡", () => {
  const open = (html.match(/<div[\s>]/g) || []).length;
  const close = (html.match(/<\/div>/g) || []).length;
  assert.strictEqual(open, close, `div 开=${open} 闭=${close}`);
});
test("关键元素齐全", () => {
  ["btnStart", "questionInput", "btnNumStyle", "btnMember", "btnPromo", "btnAccount",
   "authGate", "toolModal", "toast", "stage1", "stage2", "stage3", "stage4"].forEach(id => {
    assert.ok(html.includes('id="' + id + '"'), "缺元素 #" + id);
  });
});
test("页脚版本号存在", () => {
  assert.ok(/v\d+\.\d+/.test(html), "页脚缺版本号");
});
test("GA4 统计脚本存在", () => {
  assert.ok(html.includes("googletagmanager.com/gtag"), "缺 GA4");
});
test("拆分产物文件存在", () => {
  ["style.css", "js/deck.js", "js/site.js"].forEach(f =>
    assert.ok(fs.existsSync(path.join(root, f)), "缺文件 " + f));
});
