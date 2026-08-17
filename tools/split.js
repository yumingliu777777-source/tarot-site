/* 一次性拆分工具：把单文件 index.html 拆成 style.css + js/deck.js + js/site.js */
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(htmlPath, "utf8");

// ---------- 1. 提取 CSS ----------
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) throw new Error("找不到 <style> 块");
const css = styleMatch[1];

// ---------- 2. 提取主脚本（含 "use strict" 的那个）----------
const mainMatch = html.match(/<script>\s*"use strict";([\s\S]*?)<\/script>/);
if (!mainMatch) throw new Error("找不到主脚本");
const mainScript = mainMatch[1];
const mainStart = mainMatch.index;
const mainEnd = mainMatch.index + mainMatch[0].length;

// 主脚本内部再拆：deck 数据部分（SUIT_GLYPH .. DECK 数组结束）与其余逻辑
const deckStart = mainScript.indexOf("const SUIT_GLYPH");
if (deckStart < 0) throw new Error("找不到 SUIT_GLYPH");
const deckArrStart = mainScript.indexOf("const DECK = [");
const deckArrEnd = mainScript.indexOf("\n];", deckArrStart); // DECK 数组以独占一行的 ]; 结束
if (deckArrStart < 0 || deckArrEnd < 0) throw new Error("找不到 DECK 数组边界");
const deckEnd = deckArrEnd + 3; // 含 "];"

const deckJs = mainScript.slice(deckStart, deckEnd);
const restJs = mainScript.slice(0, deckStart) + mainScript.slice(deckEnd);
// restJs 现在以 "use strict" + track 开头，接 Spreads 等逻辑

// ---------- 3. 写文件 ----------
fs.mkdirSync(path.join(__dirname, "..", "js"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "..", "style.css"), css, "utf8");
fs.writeFileSync(path.join(__dirname, "..", "js", "deck.js"), deckJs, "utf8");
fs.writeFileSync(path.join(__dirname, "..", "js", "site.js"), restJs, "utf8");

// ---------- 4. 改写 index.html ----------
// 先替换主脚本（在 <style> 之后，改动不影响 style 位置），再替换 <style>
const styleStart = styleMatch.index;
const styleEnd = styleMatch.index + styleMatch[0].length;
let out = html.slice(0, mainStart) + '\n<script src="js/deck.js"></script>\n<script src="js/site.js"></script>' + html.slice(mainEnd);
out = out.slice(0, styleStart) + '<link rel="stylesheet" href="style.css">' + out.slice(styleEnd);
fs.writeFileSync(htmlPath, out, "utf8");

console.log("拆分完成:");
console.log("  style.css      " + css.length + " 字节");
console.log("  js/deck.js     " + deckJs.length + " 字节");
console.log("  js/site.js     " + restJs.length + " 字节");
console.log("  index.html     " + out.length + " 字节（原 " + html.length + "）");
