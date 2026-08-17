
/* Google Analytics 4 事件埋点 */
const track = (name, params={}) => { if(typeof window.gtag === "function") window.gtag("event", name, params); };
/* ══════════════ Deck data ══════════════ */


/* ══════════════ Spreads ══════════════ */
const SPREADS = {
  single: { name:"单张占卜", n:1, slots:[
    {x:50,y:34,label:"当下指引",mean:"这张牌代表此刻围绕你的核心能量，也是对你问题最直接的回应。"}
  ]},
  three: { name:"三张牌阵", n:3, slots:[
    {x:20,y:40,label:"过去",mean:"这件事的根源与起因，你从何处走来。"},
    {x:50,y:40,label:"现在",mean:"当下的处境与正在起作用的力量。"},
    {x:80,y:40,label:"未来",mean:"若保持现状，事情将如何发展。"}
  ]},
  celtic: { name:"凯尔特十字", n:10, slots:[
    {x:38,y:40,label:"① 现状",mean:"问题的核心，当前最主要的处境。"},
    {x:50,y:40,label:"② 挑战",mean:"横亘在问题之上的阻碍或助力。"},
    {x:38,y:86,label:"③ 潜意识",mean:"你内心深处的根基与隐藏动机。"},
    {x:12,y:40,label:"④ 过去",mean:"近期已发生、仍在影响你的事。"},
    {x:38,y:4,label:"⑤ 目标",mean:"你意识层面的期望与理想状态。"},
    {x:64,y:40,label:"⑥ 近未来",mean:"短期内即将到来的发展。"},
    {x:76,y:4,label:"⑦ 自我",mean:"你如何看待自己，内在的态度。"},
    {x:76,y:40,label:"⑧ 环境",mean:"外界与他人的影响。"},
    {x:76,y:76,label:"⑨ 希望与恐惧",mean:"你内心深处的渴望与担忧。"},
    {x:96,y:40,label:"⑩ 结果",mean:"整件事最终的走向与答案。"}
  ]}
};

/* ══════════════ State ══════════════ */
Object.assign(SPREADS, {
  choice:{name:"二选一",n:3,slots:[
    {x:22,y:40,label:"选项 A",mean:"选择这条路时，你最先会感受到的能量与发展。"},
    {x:78,y:40,label:"选项 B",mean:"另一条路呈现的氛围、代价或潜在收获。"},
    {x:50,y:78,label:"核心建议",mean:"帮助你作出符合内心与现实的选择。"}
  ]},
  love:{name:"爱情十字",n:5,slots:[
    {x:50,y:40,label:"你的心意",mean:"你在这段关系里真实的感受与需求。"},
    {x:50,y:10,label:"对方状态",mean:"对方此刻的情感状态或表达方式。"},
    {x:22,y:40,label:"关系基础",mean:"这段关系正在依靠的连结与基础。"},
    {x:78,y:40,label:"阻碍与课题",mean:"需要被看见、沟通或跨越的部分。"},
    {x:50,y:76,label:"发展建议",mean:"让关系更健康前进的温柔行动。"}
  ]},
  career:{name:"事业分析",n:4,slots:[
    {x:20,y:40,label:"事业现状",mean:"当前工作与发展处境的核心能量。"},
    {x:43,y:40,label:"你的优势",mean:"此刻最值得发挥的能力或资源。"},
    {x:66,y:40,label:"挑战所在",mean:"需要正视、调整或补足的课题。"},
    {x:89,y:40,label:"下一步",mean:"帮助你稳步向前的务实行动。"}
  ]},
  year:{name:"年度展望",n:5,slots:[
    {x:12,y:40,label:"年度基调",mean:"贯穿这一周期的主旋律与学习。"},
    {x:31,y:40,label:"机会",mean:"值得主动把握的新窗口与资源。"},
    {x:50,y:40,label:"挑战",mean:"促使你成长、需要谨慎面对的部分。"},
    {x:69,y:40,label:"关系",mean:"人际、亲密关系与合作中的提示。"},
    {x:88,y:40,label:"年度成果",mean:"持续投入后可能抵达的收获与落点。"}
  ]}
});

let state = { spread:"single", drawn:[], flipped:0, question:"", fan:[] };
const $ = id => document.getElementById(id);
const rand = n => Math.floor(Math.random()*n);
const shuffleArr = a => { for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]];} return a; };

/* ══════════════ Stage nav ══════════════ */
const NUM_STYLE_KEY = "lunar-tarot-card-num-v1";
function applyNumStyle(){
  const v = localStorage.getItem(NUM_STYLE_KEY)==="hide" ? "hide" : "poker";
  document.documentElement.setAttribute("data-numstyle", v);
  document.querySelectorAll(".num-toggle .nt-btn").forEach(b=>b.classList.toggle("sel", b.dataset.nt===v));
  const hb=$("btnNumStyle"); if(hb) hb.textContent = v==="poker" ? "牌面:扑克" : "牌面:隐藏";
}
function bindNumToggles(){
  document.querySelectorAll(".num-toggle .nt-btn").forEach(b=>b.onclick=()=>{
    localStorage.setItem(NUM_STYLE_KEY, b.dataset.nt);
    applyNumStyle();
    showToast(b.dataset.nt==="poker"?"牌面已切换为扑克牌数字样式":"牌面数字已隐藏");
  });
}
let stage = 0;
function goStage(n){
  for(let i=0;i<=4;i++) $(`stage${i}`).classList.toggle("hidden", i!==n);
  for(let i=0;i<=3;i++){ const d=$( `dot${i}`); d.classList.toggle("on", i===n); d.classList.toggle("done", i<n); }
  stage = n;
  window.scrollTo({top:0,behavior:"smooth"});
}

/* ══════════════ Stage 0→1 ══════════════ */
$("btnStart").onclick = () => { track("start_reading"); goStage(1); };

/* ══════════════ Spread select ══════════════ */
let selSpread = "single";
document.querySelectorAll(".spread-card").forEach(c=>{
  c.onclick = () => {
    document.querySelectorAll(".spread-card").forEach(x=>x.classList.remove("sel"));
    c.classList.add("sel");
    selSpread = c.dataset.spread;
    state.spread = selSpread;
    track("select_spread", { spread: selSpread });
  };
});
$("btnBack0").onclick = () => goStage(0);

/* ══════════════ Stage 2: shuffle ══════════════ */
function buildDeck(){
  const deck = $("deck");
  deck.innerHTML = "";
  const n = 24;
  for(let i=0;i<n;i++){
    const d = document.createElement("div");
    d.className = "deck-card";
    d.style.setProperty("--i", i);
    deck.appendChild(d);
  }
}
$("btnShuffle").onclick = () => {
  track("begin_shuffle", { spread: state.spread, has_question: !!$("questionInput").value.trim() });
  $("questionInput").blur();
  state.question = $("questionInput").value.trim();
  buildDeck();
  const deck = $("deck");
  deck.classList.add("shuffling");
  $("btnDraw").disabled = false;
  $("btnBack1").disabled = false;
  goStage(2);
  setTimeout(()=>{ deck.classList.remove("shuffling"); }, 1400);
};
$("btnBack1").onclick = () => { $("btnDraw").disabled = true; buildDeck(); };

/* ══════════════ Stage 2→3: user picks cards ══════════════ */
$("btnDraw").onclick = () => {
  $("btnDraw").disabled = true;
  $("btnBack1").disabled = true;
  buildFan();
  goStage(3);
  $("revealSub").textContent = `凭直觉，从牌扇中挑出 ${SPREADS[state.spread].n} 张牌，每张牌对应一个牌位`;
  renderSlots();
  renderFan();
  updatePickHint();
};

/* ══════════════ Stage 3: joystick cylinder pick ══════════════ */
let slotWraps = [];
let cyl = { N:16, R:330, angle:0, vel:0, cards:[], els:[] };
let cylRaf = null;
let cylPointerX = null;  // 鼠标在筒内横向位置 0..1，null=离开
let cylLastX = null;     // 触摸拖动上次 x
let cylTouchVel = 0;     // 触摸惯性速度
let cardQueue = [];      // 洗好的剩余牌堆

function buildFan(){
  const isMobile = window.innerWidth < 760;
  cyl.N = isMobile ? 10 : 16;
  cyl.R = isMobile ? 190 : 330;
  cyl.angle = Math.random() * Math.PI * 2;
  cyl.vel = 0;
  cyl.cards = [];
  cyl.els = [];
  cardQueue = shuffleArr(DECK.map(c => [...c]));
  for(let i=0;i<cyl.N;i++){
    const card = cardQueue.pop();
    card.reversed = Math.random() < 0.32;
    cyl.cards.push(card);
  }
}

function renderSlots(){
  const sp = SPREADS[state.spread];
  const table = $("spreadTable");
  table.innerHTML = "";
  slotWraps = [];

  const wrap = document.createElement("div");
  wrap.style.position = "relative";
  wrap.style.height = (["celtic","love"].includes(state.spread) ? "520px" : state.spread==="choice" ? "460px" : "360px");
  wrap.style.width = "100%";
  table.appendChild(wrap); // attach first so offsetWidth is measurable

  const W = wrap.offsetWidth || 860, H = parseFloat(wrap.style.height);
  const cardW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--card-w"))||150;
  const cardH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--card-h"))||252;

  sp.slots.forEach((s, i) => {
    const sw = document.createElement("div");
    sw.className = "slot-wrap";
    sw.style.left = (s.x/100*W - cardW/2) + "px";
    sw.style.top  = (s.y/100*H - cardH/2) + "px";

    const empty = document.createElement("div");
    empty.className = "slot-empty";
    empty.textContent = "✦";

    const tag = document.createElement("div");
    tag.className = "pos-tag";
    tag.textContent = s.label;

    sw.appendChild(empty);
    sw.appendChild(tag);
    wrap.appendChild(sw);
    slotWraps.push(sw);
  });
}

function renderFan(){
  const zone = $("pickZone");
  zone.innerHTML = "";
  const cardW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--card-w"))||150;
  const cardH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--card-h"))||252;
  zone.style.height = (cardH + 96) + "px";

  cyl.cards.forEach((d, i) => {
    const c = document.createElement("div");
    c.className = "fan-card";
    c.dataset.i = i;
    const back = document.createElement("div");
    back.className = "card-back";
    back.innerHTML = `<span class="back-num">${cardNumber(d)}</span>`;
    c.appendChild(back);
    c.onclick = () => pickCard(i, c);
    zone.appendChild(c);
    cyl.els.push(c);
  });

  // 操作提示
  const tip = document.createElement("div");
  tip.className = "cyl-tip";
  tip.innerHTML = "↔ 左右移动鼠标转动牌筒 · <b>归中即停</b> · 点击正面牌选牌";
  zone.appendChild(tip);

  // 鼠标摇杆：位置决定方向与速度
  zone.addEventListener("mousemove", e => {
    const r = zone.getBoundingClientRect();
    cylPointerX = (e.clientX - r.left) / r.width;
  });
  zone.addEventListener("mouseleave", () => { cylPointerX = null; });
  zone.addEventListener("mousedown", () => zone.classList.add("dragging"));
  window.addEventListener("mouseup", () => zone.classList.remove("dragging"));

  // 触摸：跟手拖动 + 惯性
  zone.addEventListener("touchstart", e => {
    cylLastX = e.touches[0].clientX;
    cylTouchVel = 0;
  }, { passive:true });
  zone.addEventListener("touchmove", e => {
    const x = e.touches[0].clientX;
    if(cylLastX !== null){
      cylTouchVel = (x - cylLastX) * 0.012;
      cyl.angle += cylTouchVel;
    }
    cylLastX = x;
  }, { passive:true });
  zone.addEventListener("touchend", () => { cylLastX = null; });

  positionCylinder();
  cylRaf = requestAnimationFrame(cylLoop);
}

let lastCylT = 0;
function cylLoop(t){
  const dt = lastCylT ? Math.min(0.05, (t - lastCylT)/1000) : 0.016;
  lastCylT = t;
  // 摇杆控速：指针偏右→正转，偏左→反转，居中→停
  let target = 0;
  if(cylPointerX !== null){
    target = (cylPointerX - 0.5) * 2 * 3.2;   // 最大约 3.2 rad/s
  }
  cyl.vel += (target - cyl.vel) * 0.3;    // 归中后快速停稳
  cyl.angle += cyl.vel * dt;
  // 触摸惯性衰减
  if(cylLastX === null && cylTouchVel !== 0){
    cyl.angle += cylTouchVel;
    cylTouchVel *= 0.95;
    if(Math.abs(cylTouchVel) < 0.0005) cylTouchVel = 0;
  }
  positionCylinder();
  cylRaf = requestAnimationFrame(cylLoop);
}

function positionCylinder(){
  const zone = $("pickZone");
  const cardW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--card-w"))||150;
  const cardH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--card-h"))||252;
  const cx = zone.clientWidth / 2;
  const cy = (zone.clientHeight - cardH) / 2 - 10;
  const step = 2*Math.PI / cyl.N;
  cyl.els.forEach((c, i) => {
    let a = cyl.angle + i*step;
    a = ((a + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI; // 归一到 -π..π
    const depth = Math.cos(a);            // 1=正对屏幕，-1=背对
    const x = cx + cyl.R * Math.sin(a) - cardW/2;
    const depthN = (depth + 1) / 2;       // 0..1
    const scale = 0.55 + 0.45 * depthN;   // 近大远小
    const opacity = depth > -0.05 ? Math.min(1, (depth + 0.05) / 0.5) : 0;
    c.style.transform = `translate(${x}px, ${cy}px) scale(${scale})`;
    c.style.opacity = String(opacity);
    c.style.zIndex = Math.round(depth * 100);
    c.style.pointerEvents = depth > 0.15 ? "auto" : "none";
  });
}

function stopCylinder(){
  if(cylRaf) cancelAnimationFrame(cylRaf);
  cylRaf = null;
  cylPointerX = null;
}

function pickCard(i, el){
  const sp = SPREADS[state.spread];
  if(state.drawn.length >= sp.n) return;
  const card = cyl.cards[i];
  state.drawn.push(card);
  const slotWrap = slotWraps[state.drawn.length - 1];
  flyToSlot(el, slotWrap, card);   // 幽灵牌飞向牌位
  // 补一张新牌：背面看不见，筒里牌永远转不完
  if(cardQueue.length){
    const nc = cardQueue.pop();
    nc.reversed = Math.random() < 0.32;
    cyl.cards[i] = nc;
  } else {
    cyl.cards.splice(i, 1);
    cyl.els.splice(i, 1);
    el.remove();
  }
  updatePickHint();
}

function flyToSlot(el, slotWrap, card){
  const cr = el.getBoundingClientRect();
  const sr = slotWrap.getBoundingClientRect();
  const ghost = el.cloneNode(true);
  ghost.style.cssText = "";
  ghost.style.position = "fixed";
  ghost.style.left = cr.left + "px";
  ghost.style.top = cr.top + "px";
  ghost.style.width = cr.width + "px";
  ghost.style.height = cr.height + "px";
  ghost.style.zIndex = 999;
  ghost.style.margin = "0";
  ghost.style.pointerEvents = "none";
  ghost.style.transition = "transform .85s cubic-bezier(.25,.6,.25,1), opacity .85s";
  document.body.appendChild(ghost);
  void ghost.offsetWidth; // force reflow, then fly
  const dx = sr.left - cr.left + (sr.width - cr.width)/2;
  const dy = sr.top  - cr.top  + (sr.height - cr.height)/2;
  ghost.style.transform = `translate(${dx}px, ${dy}px) scale(.86) rotate(6deg)`;
  ghost.style.opacity = ".35";
  setTimeout(() => {
    ghost.remove();
    landCard(slotWrap, card);
  }, 850);
}

function landCard(slotWrap, card){
  slotWrap.querySelector(".slot-empty")?.remove();
  const c = document.createElement("div");
  c.className = "draw-card face-down";
  const inner = document.createElement("div");
  inner.className = "card3d";
  const back = document.createElement("div");
  back.className = "card-back";
  back.innerHTML = `<span class="back-num">${cardNumber(card)}</span>`;
  const face = document.createElement("div");
  face.className = "card-face" + (card.reversed ? " rev" : "");
  const isMajor = card[3] === "大";
  const cornerNum = cardNumber(card);
  const corners = `<div class="poker-corner tl"><span class="pv">${cornerNum}</span>${isMajor ? "" : `<span class="ps">${SUIT_GLYPH[card[3]]}</span>`}</div><div class="poker-corner br"><span class="pv">${cornerNum}</span>${isMajor ? "" : `<span class="ps">${SUIT_GLYPH[card[3]]}</span>`}</div>`;
  face.innerHTML = `
    ${corners}
    <div class="num">${card[2]}</div>
    <div class="suit">${isMajor ? "" : SUIT_GLYPH[card[3]]}</div>
    <div class="glyph">${isMajor ? MAJOR_GLYPH[card[2]] : SUIT_SVG[card[3]]}</div>
    <div class="cname">${card[0]}</div>
    <div class="cname-en">${card[1]}</div>`;
  inner.appendChild(back);
  inner.appendChild(face);
  c.appendChild(inner);
  slotWrap.appendChild(c);
  slotWrap.classList.add("flipped");
  setTimeout(() => c.classList.add("flipped"), 140);
  showToast(`${card[0]} · ${card.reversed ? "逆位" : "正位"} — ${card[4][0]}`);
}

function updatePickHint(){
  const sp = SPREADS[state.spread];
  const n = state.drawn.length;
  if(n >= sp.n){
    $("revealHint").textContent = "所有牌位已落定，星光已为你拼出全貌";
    $("reportBtnRow").classList.remove("hidden");
    stopCylinder();
    document.querySelectorAll(".fan-card").forEach(c => c.classList.add("done"));
  } else {
    const next = sp.slots[n];
    $("reportBtnRow").classList.add("hidden");
    $("revealHint").textContent = `已选 ${n} / ${sp.n} 张 · 请为「${next.label}」挑选下一张`;
  }
}

/* ══════════════ Stage 3→4: report ══════════════ */
const ELEM_THEME = { "权杖":"火元素 · 行动与激情", "圣杯":"水元素 · 情感与直觉", "宝剑":"风元素 · 思维与抉择", "星币":"土元素 · 现实与物质" };
const ELEM_DESC = {
  "权杖":"火元素能量充沛，说明这件事需要你拿出行动力与热情，主动出击。",
  "圣杯":"水元素主导，情感与直觉是解开问题的钥匙，先倾听内心。",
  "宝剑":"风元素当道，理性分析与清晰沟通至关重要，真相需要用头脑厘清。",
  "星币":"土元素厚重，现实基础与物质条件决定成败，请务实推进。"
};

$("btnReport").onclick = () => { track("generate_report", { spread: state.spread, cards: state.drawn.length }); goStage(4); renderReport(); saveReading(); if(sbConfigured() && getSession()) saveReadingToServer(); };
$("btnReportRedo").onclick = $("btnRedo").onclick = resetAll;
$("btnPrint").onclick = () => window.print();
$("btnCopyShare").onclick = copyShareLink;
$("btnShareCard").onclick = downloadShareCard;
$("btnAiReport").onclick = generateAiReportV2;

function renderReport(){
  const sp = SPREADS[state.spread];
  const drawn = state.drawn;
  const root = $("report");
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  const uprightN = drawn.filter(d=>!d.reversed).length;
  const reversedN = drawn.length - uprightN;

  /* element counts */
  const counts = { "权杖":0, "圣杯":0, "宝剑":0, "星币":0 };
  let majors = 0;
  drawn.forEach(d=>{ if(d[3]==="大"){majors++;} else {counts[d[3]]++;} });
  const dominant = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  const domElem = dominant && dominant[1]>0 ? dominant[0] : null;

  /* card items */
  let cardsHtml = sp.slots.map((s,i)=>{
    const d = drawn[i];
    const isMajor = d[3]==="大";
    const ori = d.reversed ? "reversed" : "upright";
    const oriTxt = d.reversed ? "逆位" : "正位";
    const meaning = d.reversed ? d[6] : d[5];
    return `<div class="card-item">
      <div class="thumb ${ori}">
        <div class="poker-corner tl"><span class="pv">${cardNumber(d)}</span>${isMajor?"":`<span class="ps">${SUIT_GLYPH[d[3]]}</span>`}</div>
        <div class="poker-corner br"><span class="pv">${cardNumber(d)}</span>${isMajor?"":`<span class="ps">${SUIT_GLYPH[d[3]]}</span>`}</div>
        <div class="suit">${isMajor?"":SUIT_GLYPH[d[3]]}</div>
        <div class="glyph">${isMajor?MAJOR_GLYPH[d[2]]:SUIT_SVG[d[3]]}</div>
        <div class="tname">${d[0]}</div>
      </div>
      <div class="body">
        <h4>${s.label} · ${d[0]}</h4>
        <div class="pos-name">${d[1]}${isMajor?" · 大阿卡纳":" · "+d[3]}</div>
        <span class="ori ${ori}">${oriTxt}</span>
        <div class="kws">${d[4].map(k=>"✦ "+k).join("  ")}</div>
        <p><b>牌位含义：</b>${s.mean}</p>
        <p><b>${oriTxt}解读：</b>${meaning}</p>
      </div>
    </div>`;
  }).join("");

  /* synthesis paragraphs */
  const p = [];
  const first = drawn[0];
  const firstMeaning = first.reversed ? first[6] : first[5];

  // lead
  const tone = uprightN > reversedN
    ? `整副牌阵${uprightN===drawn.length?"全部正位":"以正位为主"}，能量流动顺畅，星光对你颇为眷顾`
    : uprightN===reversedN
      ? "整副牌阵正逆均衡，吉凶参半，选择权牢牢握在你手中"
      : `整副牌阵以逆位居多，当下的课题需要你更多耐心与内省`;
  p.push(`<p class="lead">${tone}。牌阵的第一张牌「${first[0]}」${first.reversed?"逆位":"正位"}出现，${firstMeaning}</p>`);

  // dominant element / majors
  if(domElem && !(drawn.length===1 && drawn[0][3]==="大")){
    p.push(`<p>纵观整副牌阵，${ELEM_THEME[domElem]}的力量最为突出。${ELEM_DESC[domElem]}</p>`);
  }
  if(majors>0){
    const majorNames = drawn.filter(d=>d[3]==="大").map(d=>d[0]).join("、");
    p.push(`<p>牌阵中出现${majors}张${majors>1?"大阿卡纳":"大阿卡纳"}（${majorNames}），这是命运在放大这一课题的信号——它不只是琐事，而是你人生阶段的重要章节，值得认真对待。</p>`);
  }
  if(drawn.length>=3){
    // flow reading for three-card
    if(state.spread==="three"){
      const [pa,cu,fu] = drawn;
      p.push(`<p>从时间线上看，<b>过去</b>的「${pa[0]}」${pa.reversed?"逆位":"正位"}奠定了事情的底色：${pa.reversed?pa[6]:pa[5]} <b>现在</b>的「${cu[0]}」${cu.reversed?"逆位":"正位"}则揭示了当下正在起作用的力量：${cu.reversed?cu[6]:cu[5]} 循此轨迹，<b>未来</b>的「${fu[0]}」${fu.reversed?"逆位":"正位"}暗示：${fu.reversed?fu[6]:fu[5]}</p>`);
    }
    if(state.spread==="celtic"){
      const [nowC,chall,_,past,goal,__,selfC,env,hopes,result] = drawn;
      p.push(`<p>问题的核心落在「${nowC[0]}」上，${nowC.reversed?nowC[6]:nowC[5]} 而最大的挑战来自「${chall[0]}」——${chall.reversed?chall[6]:chall[5]}。回到起点，过去的「${past[0]}」仍在施加影响：${past.reversed?past[6]:past[5]} 你心中向往的「${goal[0]}」则指向：${goal.reversed?goal[6]:goal[5]}</p>`);
      p.push(`<p>你如何看待自己，决定了你能走多远——「${selfC[0]}」${selfC.reversed?"逆位":"正位"}提示你：${selfC.reversed?selfC[6]:selfC[5]} 而环境与他人的影响集中在「${env[0]}」上：${env.reversed?env[6]:env[5]} 你内心深处的希望与恐惧，则由「${hopes[0]}」代言：${hopes.reversed?hopes[6]:hopes[5]}</p>`);
      p.push(`<p>最终，所有线索汇聚成「${result[0]}」——${result.reversed?result[6]:result[5]} 这是牌阵给出的最终答案，也是星光为你指出的落点。</p>`);
    }
  }
  if(state.question){
    p.push(`<p>回到你的问题「${state.question}」——牌阵的指引并非预言定局，而是提醒你：看清现状、善用优势、正视阻碍，答案就在你每一次选择之中。</p>`);
  } else {
    p.push(`<p>这份指引并非预言定局，而是提醒你：看清现状、善用优势、正视阻碍，答案就在你每一次选择之中。</p>`);
  }

  /* advice */
  const kwPool = [];
  drawn.forEach(d=>{ d[4].forEach(k=>kwPool.push(k)); });
  const advice = [];
  const used = new Set();
  const pick = ()=> { const k = kwPool[rand(kwPool.length)]; if(used.has(k)) return pick(); used.add(k); return k; };
  const a1 = pick(), a2 = pick();
  const advTone = uprightN>=reversedN ? "顺势而为" : "静待时机";
  advice.push({t:"行动建议", p:`<p>整体能量偏向「${advTone}」。回到你的问题${state.question?`「${state.question}」`:""}，近期可以围绕 <b>${a1}</b> 动手试试，同时留意 <b>${a2}</b> 带来的提示。</p>`});
  if(domElem) advice.push({t:"元素提示", p:`<p>整副牌里${ELEM_THEME[domElem]}的力量最强，${ELEM_DESC[domElem].replace("。","，")} 做决定时把它当底色。</p>`});
  advice.push({t:"一句话总结", p:`<p>把牌面翻译成大白话，最实在的一句是：<b>「${first[0]}」${first.reversed?"逆位":"正位"}——${firstMeaning}</b></p>`});
  advice.push({t:"心念指引", p:`<p>牌面只是照见，不是判决。无论抽到什么，选择权永远在你手里。</p>`});

  root.innerHTML = `
    <div class="report-head">
      <div class="goldline"></div>
      <h2 class="title">${sp.name} · 解读报告</h2>
      ${state.question?`<div class="q">「${state.question}」</div>`:`<div class="q">整体运势指引</div>`}
      <div class="meta">${dateStr} · 共${drawn.length}张牌 · 正位${uprightN} · 逆位${reversedN}</div>
    </div>

    <div class="sec-title">✦ 牌阵详解</div>
    <div class="card-list">${cardsHtml}</div>

    <div class="sec-title">✦ 综合解读</div>
    <div class="analysis">${p.join("")}</div>

    <div class="sec-title">✦ 行动建议</div>
    <div class="advice">${advice.map(a=>`<div class="a"><div class="at">— ${a.t} —</div>${a.p}</div>`).join("")}</div>`;
}

/* ══════════════ Reset ══════════════ */
function resetAll(){
  state = { spread: selSpread, drawn:[], flipped:0, question:"", fan:[] };
  slotWraps = [];
  cyl = { N:16, R:330, angle:0, vel:0, cards:[], els:[] };
  stopCylinder();
  $("questionInput").value = "";
  $("btnDraw").disabled = true;
  $("reportBtnRow").classList.add("hidden");
  $("spreadTable").innerHTML = "";
  $("pickZone").innerHTML = "";
  goStage(1);
}

/* ══════════════ Toast ══════════════ */
let toastTimer;
function showToast(msg){
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove("show"), 2200);
}

/* Reader tools and local memory */
const HISTORY_KEY = "lunar-tarot-history-v1";
const DAILY_KEY = "lunar-tarot-daily-v1";
const cardByName = name => DECK.find(card => card[0] === name);
const safeRead = key => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } };
const safeWrite = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const localDay = () => new Date().toLocaleDateString("sv-SE");
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));

function readingPayload(){
  return { v:1, spread:state.spread, question:state.question, at:new Date().toISOString(), cards:state.drawn.map(card => ({name:card[0], reversed:!!card.reversed})) };
}
function saveReading(){
  if(!state.drawn.length) return;
  const record = readingPayload();
  const history = safeRead(HISTORY_KEY);
  if(!history.length || JSON.stringify(history[0].cards) !== JSON.stringify(record.cards) || history[0].question !== record.question){
    history.unshift(record);
    safeWrite(HISTORY_KEY, history.slice(0,80));
  }
}
function payloadToState(payload){
  if(!payload || !SPREADS[payload.spread] || !Array.isArray(payload.cards)) return false;
  const cards = payload.cards.map(item => { const card = cardByName(item.name); return card ? Object.assign([...card], {reversed:!!item.reversed}) : null; }).filter(Boolean);
  if(cards.length !== SPREADS[payload.spread].n) return false;
  state = {spread:payload.spread, drawn:cards, flipped:cards.length, question:payload.question || "", fan:[]};
  selSpread = payload.spread;
  return true;
}
function encodePayload(payload){ return btoa(unescape(encodeURIComponent(JSON.stringify(payload)))); }
function decodePayload(value){ try { return JSON.parse(decodeURIComponent(escape(atob(value)))); } catch { return null; } }
function copyText(value){
  if(navigator.clipboard && location.protocol !== "file:") return navigator.clipboard.writeText(value);
  const input = document.createElement("textarea"); input.value = value; document.body.appendChild(input); input.select(); document.execCommand("copy"); input.remove(); return Promise.resolve();
}
function copyShareLink(){
  track("copy_share_link", { spread: state.spread });
  const link = `${location.href.split("#")[0]}#r=${encodePayload(readingPayload())}`;
  copyText(link).then(() => showToast("分享链接已复制")).catch(() => showToast("复制失败，请手动复制地址栏链接"));
}
function downloadShareCard(){
  if(!state.drawn.length) return;
  track("generate_share_card", { spread: state.spread });
  const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
  canvas.width = 1200; canvas.height = 630;
  const bg = ctx.createLinearGradient(0,0,1200,630); bg.addColorStop(0,"#090911"); bg.addColorStop(1,"#1b1630"); ctx.fillStyle=bg; ctx.fillRect(0,0,1200,630);
  ctx.strokeStyle="#c9a957"; ctx.lineWidth=2; ctx.strokeRect(32,32,1136,566);
  ctx.fillStyle="#e8cf8f"; ctx.font="42px serif"; ctx.fillText("星夜塔罗 · 我的抽牌报告",92,118);
  ctx.fillStyle="#8f8876"; ctx.font="24px sans-serif"; ctx.fillText(state.question || "整体运势指引",92,164);
  const cardW=160, gap=28, total=state.drawn.length*cardW+(state.drawn.length-1)*gap, start=(1200-total)/2;
  state.drawn.forEach((card,i) => { const x=start+i*(cardW+gap), y=225; ctx.fillStyle="#f1e8d1"; ctx.fillRect(x,y,cardW,240); ctx.strokeStyle="#b99b54"; ctx.strokeRect(x,y,cardW,240); ctx.fillStyle="#312710"; ctx.font="25px serif"; ctx.textAlign="center"; ctx.fillText(card[0],x+cardW/2,y+112); ctx.font="18px sans-serif"; ctx.fillStyle=card.reversed?"#a54e47":"#7c6735"; ctx.fillText(card.reversed?"逆位":"正位",x+cardW/2,y+148); });
  ctx.textAlign="left"; ctx.fillStyle="#8f8876"; ctx.font="18px sans-serif"; ctx.fillText("塔罗为心灵参考，选择始终在你手中",92,550);
  const link=document.createElement("a"); link.download=`tarot-${localDay()}.png`; link.href=canvas.toDataURL("image/png"); link.click(); showToast("分享卡已生成");
}

function apiPrompt(){
  const spread=SPREADS[state.spread];
  const cards=state.drawn.map((card,index)=>`第${index+1}张【${spread.slots[index].label}】${card[0]}（${card.reversed?"逆位":"正位"}），关键词：${card[4].join("、")}，含义：${card.reversed?card[6]:card[5]}`).join("\n");
  return `你是一位温和、接地气的中文塔罗解读师，说话像朋友聊天，全程用大白话，别堆砌华丽辞藻，别故作高深，别绕弯子。
请基于下面的牌阵，给出一份【详细、具体、能落地】的深度解读，结构如下：
1. 开头总览：用两三句话，大白话说清楚这副牌整体在讲什么、这件事现在处于什么状态。
2. 逐张详解：每张牌单独一段。结合它的牌位含义和正逆位，说清楚它对应你生活中的哪件事/哪种心态、在提醒你什么。尽量结合提问场景，举具体的例子，不要只说套话。
3. 牌与牌的联系：点出哪几张牌互相呼应、哪几张在打架，说明这背后藏着的深层情况。
4. 接下来怎么走：给出 3-5 条具体、可执行的小行动（要真的能照着做，不要"保持积极心态"这种空话），并说说时间上的大致节奏。
5. 心态盲点：提醒一个你容易忽略的心理坑。
6. 结尾一句大白话总结：一句话收尾，像朋友拍着你肩膀说的那种。
不要声称预测绝对未来，不提供医疗、法律、投资或危机建议。整体篇幅请尽量充实、具体。

提问：${state.question||"整体运势指引"}
牌阵：${spread.name}（共${state.drawn.length}张）
${cards}`;
}
function openModal(kind){
  const content = $("toolContent");
  if(kind === "daily"){
    const today=localDay(); let daily=safeRead(DAILY_KEY); daily = Array.isArray(daily) ? daily : [];
    let entry=daily.find(item => item.day===today);
    if(!entry){ const seed=[...today].reduce((sum,char)=>sum+char.charCodeAt(0),0); entry={day:today,name:DECK[seed%DECK.length][0],reversed:seed%7===0}; daily.unshift(entry); safeWrite(DAILY_KEY,daily.slice(0,366)); }
    const card=Object.assign([...cardByName(entry.name)],{reversed:entry.reversed}); const meaning=card.reversed?card[6]:card[5];
    content.innerHTML=`<h2 class="modal-title" id="toolTitle">每日一签</h2><p class="modal-sub">${today} · 每天一张牌，留下一条与自己对话的线索。</p><div class="daily-card"><div class="thumb ${card.reversed?"rev":""}"><div class="poker-corner tl"><span class="pv">${cardNumber(card)}</span>${card[3]==="大"?"":`<span class="ps">${SUIT_GLYPH[card[3]]}</span>`}</div><div class="poker-corner br"><span class="pv">${cardNumber(card)}</span>${card[3]==="大"?"":`<span class="ps">${SUIT_GLYPH[card[3]]}</span>`}</div><div class="suit">${card[3]==="大"?"":SUIT_GLYPH[card[3]]}</div><div class="glyph">${card[3]==="大"?MAJOR_GLYPH[card[2]]:SUIT_SVG[card[3]]}</div><div class="tname">${card[0]}</div></div><div><h3>${card[0]} · ${card.reversed?"逆位":"正位"}</h3><div class="kws">${card[4].map(escapeHtml).join(" · ")}</div><p>${meaning}</p></div></div>`;
  } else if(kind === "history"){
    if(sbConfigured() && getSession()){ openServerHistory(content); }
    else{
      const reports=safeRead(HISTORY_KEY), daily=safeRead(DAILY_KEY).map(item=>({spread:"每日一签",at:item.day,cards:[item],question:"每日一签"})); const items=[...reports,...daily].sort((a,b)=>String(b.at).localeCompare(String(a.at)));
      content.innerHTML=`<h2 class="modal-title" id="toolTitle">抽牌历史</h2><p class="modal-sub">记录保存在当前浏览器。报告最多保留 80 次，每日一签最多保留一年。</p><div class="history-list">${items.length?items.map((item,index)=>`<button class="history-item" data-history="${index}"><time>${String(item.at).slice(0,10)}</time><div><h4>${escapeHtml(item.spread || "塔罗报告")}</h4><p>${item.cards.map(card=>escapeHtml(card.name)).join(" · ")}</p></div><span>查看</span></button>`).join(""):`<p class="modal-sub">还没有记录。完成一次占卜或抽取每日一签后，它会出现在这里。</p>`}</div>`;
      content.querySelectorAll("[data-history]").forEach(button=>button.onclick=()=>{ const item=items[Number(button.dataset.history)]; if(item.spread==="每日一签"){openModal("daily"); return;} if(payloadToState(item)){closeModal();goStage(4);renderReport();} });
    }
  } else if(kind === "dict") {
    content.innerHTML=`<h2 class="modal-title" id="toolTitle">牌意词典</h2><p class="modal-sub">完整收录 78 张塔罗牌的正位、逆位与关键词，可按名称、英文或关键词搜索。</p><div class="dict-toolbar"><input class="dict-search" id="dictSearch" placeholder="搜索牌名、英文名或关键词"><select class="dict-filter" id="dictFilter"><option value="">全部牌组</option><option value="大">大阿尔卡那</option><option value="权杖">权杖</option><option value="圣杯">圣杯</option><option value="宝剑">宝剑</option><option value="星币">星币</option></select></div><div class="dict-grid" id="dictGrid"></div>`;
    const renderDict=()=>{ const term=$("dictSearch").value.trim().toLowerCase(), suit=$("dictFilter").value; const cards=DECK.filter(card=>{const text=[card[0],card[1],card[3],...card[4]].join(" ").toLowerCase();return (!term||text.includes(term))&&(!suit||card[3]===suit);}); $("dictGrid").innerHTML=cards.map(card=>`<article class="dict-item"><h4>${card[0]}</h4><div class="en">${card[1]} · ${card[3]==="大"?"大阿尔卡那":card[3]}</div><div class="kws">${card[4].map(escapeHtml).join(" · ")}</div><p><b>正位：</b>${card[5]}</p><p><b>逆位：</b>${card[6]}</p></article>`).join("")||"<p class='modal-sub'>没有匹配的牌，请换个关键词试试。</p>"; };
    $("dictSearch").oninput=renderDict; $("dictFilter").onchange=renderDict; renderDict();
  }
  $("toolModal").classList.remove("hidden");
}
function closeModal(){ $("toolModal").classList.add("hidden"); }
/* ══════════ 占卜记录：跟账号走 ══════════ */
let lastReadingId=null;
function openServerHistory(content){
  content.innerHTML=`<h2 class="modal-title" id="toolTitle">抽牌历史</h2><p class="modal-sub">记录已同步到账号，换手机登录后依然可见。支持收藏、分享、删除。</p><div class="history-list" id="srvHistory">加载中…</div>`;
  const list=$("srvHistory");
  sbRpc("my_readings",{p_token:getSession(),p_fav_only:false}).then(r=>{
    const rows=(r&&r.list)||[];
    if(!rows.length){ list.innerHTML=`<p class="modal-sub">还没有记录。完成一次占卜后，它会自动同步到你的账号。</p>`; return; }
    list.innerHTML=rows.map(item=>{
      const names=(item.cards||[]).map(c=>escapeHtml(c.name)).join(" · ");
      return `<div class="history-item" style="display:block;text-align:left;padding:12px;border:1px solid var(--line);border-radius:4px;background:var(--panel)">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <h4 style="color:var(--gold-hi);font-family:var(--serif);font-size:14px">${escapeHtml(item.spread||"塔罗报告")}${item.favorite?' ★':''}${item.has_ai?' <span style="color:var(--ok);font-size:10px">AI</span>':''}</h4>
          <time style="color:var(--muted);font-size:11px">${String(item.created_at||"").slice(0,16).replace("T"," ")}</time>
        </div>
        <p style="color:var(--muted);font-size:12px;margin:6px 0 10px">${names}</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn ghost" data-rv="${item.id}">重新查看</button>
          <button class="btn ghost" data-fav="${item.id}" data-f="${item.favorite?'1':'0'}">${item.favorite?"取消收藏":"收藏"}</button>
          <button class="btn ghost" data-share="${item.id}">分享</button>
          <button class="btn ghost danger" data-del="${item.id}">删除</button>
        </div>
      </div>`;
    }).join("");
    list.querySelectorAll("[data-rv]").forEach(b=>b.onclick=()=>openReadingById(b.dataset.rv));
    list.querySelectorAll("[data-fav]").forEach(b=>b.onclick=async()=>{
      const fav=b.dataset.f!=="1";
      try{ await sbRpc("toggle_favorite",{p_token:getSession(),p_id:b.dataset.fav,p_fav:fav}); showToast(fav?"已收藏":"已取消收藏"); openServerHistory(content); }catch(e){ showToast(e.message); }
    });
    list.querySelectorAll("[data-share]").forEach(b=>b.onclick=()=>shareReadingById(b.dataset.share));
    list.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{
      if(!confirm("确认删除这条占卜记录？")) return;
      try{ await sbRpc("delete_reading",{p_token:getSession(),p_id:b.dataset.del}); showToast("已删除"); openServerHistory(content); }catch(e){ showToast(e.message); }
    });
  }).catch(()=>{ list.innerHTML=`<p class="modal-sub">加载失败，请稍后重试。</p>`; });
}
async function openReadingById(id){
  try{
    const r=await sbRpc("get_reading",{p_token:getSession(),p_id:id});
    if(!r||!r.ok) throw new Error(r?.reason==="not_found"?"记录不存在":"加载失败");
    const payload={v:1,spread:r.spread,question:r.question||"",at:r.created_at,cards:(r.cards||[]).map(c=>({name:c.name,reversed:!!c.reversed}))};
    if(payloadToState(payload)){
      closeModal(); goStage(4); renderReport();
      if(r.ai_report) attachAiText(r.ai_report);
      lastReadingId=id;
    }
  }catch(e){ showToast(e.message); }
}
async function shareReadingById(id){
  try{
    const r=await sbRpc("get_reading",{p_token:getSession(),p_id:id});
    if(!r||!r.ok) throw new Error("加载失败");
    const payload={v:1,spread:r.spread,question:r.question||"",at:r.created_at,cards:(r.cards||[]).map(c=>({name:c.name,reversed:!!c.reversed}))};
    copyText(`${location.href.split("#")[0]}#r=${encodePayload(payload)}`).then(()=>showToast("分享链接已复制")).catch(()=>showToast("复制失败"));
  }catch(e){ showToast(e.message); }
}
function attachAiText(text){
  const root=$("report"); let panel=$("aiAnalysis");
  if(!panel){ panel=document.createElement("section"); panel.id="aiAnalysis"; panel.innerHTML='<div class="sec-title">✦ AI 深度解读</div><div class="api-analysis"></div>'; root.appendChild(panel); }
  const output=panel.querySelector(".api-analysis"); output.className="api-analysis"; output.textContent=text||"";
}
async function saveReadingToServer(){
  try{
    const cards=state.drawn.map(d=>({name:d[0],reversed:!!d.reversed}));
    const r=await sbRpc("save_reading",{p_token:getSession(),p_spread:state.spread,p_question:state.question||"",p_cards:cards,p_report_html:null,p_ai_report:null});
    if(r&&r.ok) lastReadingId=r.id;
  }catch(e){ /* 静默，不影响占卜流程 */ }
}
async function generateAiReportV2(){
  if(!state.drawn.length) return;
  if(AI_REPORT_NEEDS_MEMBER && sbConfigured()){
    if(!getSession()){ openAccount(); showToast("AI 深度解读需先登录账号（额度在账号里，邀请好友即可获得）"); return; }
    await ensureEntitlementMerged();   // 先合并设备VIP权益
    await refreshAccount();   // 再同步服务器上的最新额度，避免缓存过期误判
    if(getCredits()<1){ openMemberBilling(); showToast("深度解析额度已用完：邀请好友注册即可获得"); return; }
  }
  if(!aiApiBase()){ showToast("店主 AI 服务尚未配置，请联系店主"); return; }
  const root=$("report"); let panel=$("aiAnalysis");
  if(!panel){panel=document.createElement("section");panel.id="aiAnalysis";panel.innerHTML='<div class="sec-title">✦ AI 深度解读</div><div class="api-analysis loading"></div>';root.appendChild(panel);}
  const output=panel.querySelector(".api-analysis"); output.className="api-analysis loading"; output.textContent="AI 正在整理这副牌阵的关联与行动建议...";
  try{
    const res=await fetch(`${aiApiBase()}/api/ai`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:getSession(),prompt:apiPrompt()})});
    const data=await res.json().catch(()=>null);
    if(!res.ok||!data||!data.ok) throw new Error(data?.error||"AI 服务暂时不可用");
    output.textContent=data.text; output.className="api-analysis";
    await refreshAccount();   // 同步服务端扣减后的余额
    updateMemberBadge();
    if(lastReadingId) sbRpc("update_ai_report",{p_token:getSession(),p_id:lastReadingId,p_ai:data.text}).catch(()=>{});
    if(AI_REPORT_NEEDS_MEMBER && sbConfigured()) showToast(`已消耗 1 次深度解析，剩余 ${getCredits()} 次`);
  }catch(error){
    output.className="api-analysis";
    output.textContent=`AI 解读暂时无法生成：${error.message}。可稍后重试，或联系店主检查配置。`;
  }
}

const MEMBER_PLANS = [
  {id:"single",name:"深度解读",price:"0.99",detail:"1 次官方 AI 深度解读"},
  {id:"light",name:"轻会员",price:"6.90",detail:"30 天内 10 次 AI 深度解读 + 无限历史"},
  {id:"plus",name:"星夜会员",price:"12.90",detail:"30 天内 30 次 AI 深度解读 + 专属分享报告"}
];
/* 方案 → 次数/名称（与数据库 plan_credits 保持一致：single=1, light=10, plus=30） */
const planCredits = id => id==="single" ? 1 : (id==="light" ? 10 : 30);
const PLAN_NAMES = { single:"深度解读", light:"轻会员", plus:"星夜会员" };
const REFERRAL_KEY = "lunar-tarot-referral-code-v1";
const getReferralCode = () => { let code=localStorage.getItem(REFERRAL_KEY); if(!code){code=Math.random().toString(36).slice(2,8).toUpperCase();localStorage.setItem(REFERRAL_KEY,code);} return code; };
const getReferrer = () => new URLSearchParams(location.search).get("ref") || "";
const promoLinkFor = code => `${location.origin}${location.pathname}?ref=${code}`;
/* ===== 会员收款配置（Supabase 免费档 + 可选自动化支付）=====
   搭建步骤见 SETUP.md：注册 supabase.com → 新建项目 → SQL Editor 运行 supabase/schema.sql
   → 把项目 URL 与 anon public key 填到下面 → 把你的微信/支付宝收款码截图
   命名为 qr-wechat.png / qr-alipay.png 放进本目录。
   自动化支付：另把 api/ 目录部署到 Vercel（见 api/README.md），把域名填到 payApi，
   买家付款后自动确认到账、自动发码、自动返利；payApi 留空则退回个人码人工确认流程。 */
const TAROT_SUPABASE = {
  url: "https://mkpwkjtuxsklptseemrf.supabase.co",
  anonKey: "sb_publishable_wYXeekHAru_NXDl9wuBakw_7n-vuHGH",        // Settings → API → anon public key
  payApi: "",         // 自动化支付后端（易支付+自动发码）；留空=个人码人工确认（当前模式）
  aiApi: "https://tarot-site-one.vercel.app",  // 店主 AI 深度解析后端（和 payApi 同一个 Vercel 域名；填了 payApi 可留空）；留空=用户自带 Key
  qrWechat: "qr-wechat.png",
  qrAlipay: "qr-alipay.png",  // 未使用（本店仅微信收款）
  contact: "",        // 你的微信号，买家付完款后联系你确认
  rebateRate: 0.30,   // 现金返利比例（展示兜底；实际以数据库 settings 表为准）
  discount: 0.50      // 好友首单立减金额（展示兜底；实际以数据库 settings 表为准）
};
const AI_REPORT_NEEDS_MEMBER = true; // true=AI 深度解读需会员额度；false=恢复免费
const sbConfigured = () => !!(TAROT_SUPABASE.url && TAROT_SUPABASE.anonKey);
const payApiBase = () => (TAROT_SUPABASE.payApi || "").replace(/\/+$/, "");
const aiApiBase = () => ((TAROT_SUPABASE.aiApi || TAROT_SUPABASE.payApi) || "").replace(/\/+$/, "");
const autoPayEnabled = () => sbConfigured() && !!payApiBase();
async function sbRpc(fn, body={}){
  const res = await fetch(`${TAROT_SUPABASE.url.replace(/\/+$/,"")}/rest/v1/rpc/${fn}`, {
    method:"POST", headers:{apikey:TAROT_SUPABASE.anonKey, Authorization:`Bearer ${TAROT_SUPABASE.anonKey}`, "Content-Type":"application/json"},
    body: JSON.stringify(body)
  });
  if(!res.ok){ let msg="服务暂时不可用"; try{ const j=await res.json(); msg=j.message||j.msg||msg; }catch(e){} throw new Error(msg); }
  return res.json();
}
const DEVICE_KEY = "lunar-tarot-device-v1";
const getDeviceId = () => { let d=localStorage.getItem(DEVICE_KEY); if(!d){ try{ d=Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b=>b.toString(16).padStart(2,"0")).join(""); }catch(e){ d=Math.random().toString(36).slice(2,10)+Math.random().toString(36).slice(2,10); } localStorage.setItem(DEVICE_KEY,d); } return d; };
const REFERRED_BY_KEY = "lunar-tarot-referred-by-v1";
const persistReferrer = () => { const ref=getReferrer(); if(ref && /^[A-Za-z0-9]{4,8}$/.test(ref)) localStorage.setItem(REFERRED_BY_KEY, ref.toUpperCase()); };
const getStoredReferrer = () => { persistReferrer(); return (localStorage.getItem(REFERRED_BY_KEY)||"").toUpperCase(); };
/* ══════════ 账号系统：会话与深度解析额度（服务端记账）══════════ */
const SESSION_KEY = "lunar-tarot-session-v1";
const ACCOUNT_KEY = "lunar-tarot-account-v1";
const getSession = () => localStorage.getItem(SESSION_KEY) || "";
const readCachedAccount = () => { try{ return JSON.parse(localStorage.getItem(ACCOUNT_KEY)||"null"); }catch{ return null; } };
const saveSession = (token, account) => { localStorage.setItem(SESSION_KEY, token); localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account)); };
const clearSession = () => { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(ACCOUNT_KEY); };
async function refreshAccount(){
  const token=getSession();
  if(!token) return null;
  try{
    const r=await sbRpc("me",{p_token:token});
    if(r && r.ok){
      const acc={username:r.username,nickname:r.nickname,credits:r.credits,ref_code:r.ref_code,referrer:r.referrer||"",createdAt:r.created_at||"",is_admin:!!r.is_admin};
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acc));
      updateMemberBadge();
      return acc;
    }
    clearSession();
    if(sbConfigured()) showAuthGate();
    return null;
  }catch(e){ return readCachedAccount(); }
}
/* 设备 VIP 权益合并到账号：登录后调用一次，避免"开了VIP却显示0额度" */
let entMergedPending=null;
function ensureEntitlementMerged(){
  if(!sbConfigured() || !getSession()) return Promise.resolve(null);
  if(entMergedPending) return entMergedPending;
  entMergedPending=sbRpc("merge_device_entitlement",{p_token:getSession(),p_device:getDeviceId()})
    .then(r=>{
      if(r&&r.ok){
        if(r.merged>0){ showToast(`已将 ${r.merged} 次 VIP 额度合并到账号`); localStorage.removeItem(LOCAL_MEMBER_KEY); }
        updateMemberBadge();
      }
      return r;
    })
    .catch(e=>{
      if(e && /merge_device_entitlement/.test(String(e.message||""))){
        showToast("检测到数据库缺少新函数：请先在 Supabase 重跑最新 schema.sql");
      }
      return null;
    })
    .finally(()=>{ entMergedPending=null; });
  return entMergedPending;
}
/* ══════════ 登录墙：未登录全屏拦截 ══════════ */
function showAuthGate(){
  const gate=$("authGate");
  if(!gate || !sbConfigured()) return;
  if(getSession()){ gate.classList.add("hidden"); return; }
  gate.classList.remove("hidden");
  renderGateForm();
}
function hideAuthGate(){ const g=$("authGate"); if(g) g.classList.add("hidden"); }
function renderGateForm(){
  const content=$("gateContent");
  const ref=(getStoredReferrer()||"").toUpperCase();
  content.innerHTML=`
    <p class="gate-sub">登录后即可开始占卜 · 每日一签 · 牌意词典 · AI 深度解读<br>注册即得专属邀请链接，邀请好友各得 1 次免费深度解析</p>
    ${ref?`<div class="gate-referral">🎁 你正使用好友邀请码 <b>${ref}</b>，注册后你和好友各得 1 次免费深度解析</div>`:""}
    <div class="auth-tabs"><button class="auth-tab sel" id="gTabLogin">登录</button><button class="auth-tab" id="gTabReg">注册</button></div>
    <form class="api-form" id="gForm">
      <label>用户名<input id="gUser" maxlength="20" autocomplete="username" placeholder="4-20 位字母/数字/下划线"></label>
      <div id="gRegFields" class="hidden">
        <label>昵称（选填）<input id="gNick" maxlength="20" placeholder="显示在账户页与推广记录里"></label>
        <label>邀请码（选填）<input id="gRef" maxlength="8" placeholder="好友的邀请码" value="${ref}"></label>
      </div>
      <label>密码<input id="gPwd" type="password" autocomplete="current-password" placeholder="至少 6 位"></label>
      <div id="gPwd2" class="hidden"><label>确认密码<input id="gPwd2Input" type="password" autocomplete="new-password"></label></div>
      <div class="btn-row"><button class="btn primary" id="gSubmit" type="submit" style="width:100%">登 录</button></div>
      <p style="text-align:center;margin-top:12px"><button type="button" class="btn ghost" id="gForgot" style="border:0;background:none;padding:4px;font-size:12px;color:var(--muted)">忘记密码？</button></p>
    </form>`;
  let mode="login";
  const setMode=m=>{
    mode=m;
    $("gTabLogin").classList.toggle("sel",m==="login");
    $("gTabReg").classList.toggle("sel",m==="register");
    $("gRegFields").classList.toggle("hidden",m!=="register");
    $("gPwd2").classList.toggle("hidden",m!=="register");
    $("gSubmit").textContent=m==="login"?"登 录":"注册并领取新人礼";
  };
  $("gTabLogin").onclick=()=>setMode("login");
  $("gTabReg").onclick=()=>setMode("register");
  setMode(ref?"register":"login");
  const forgotBtn=$("gForgot");
  if(forgotBtn) forgotBtn.onclick=renderForgotGate;
  $("gForm").onsubmit=async e=>{
    e.preventDefault();
    const user=$("gUser").value.trim(), pwd=$("gPwd").value, btn=$("gSubmit");
    btn.disabled=true; btn.textContent="请稍候…";
    try{
      let r;
      if(mode==="login"){
        r=await sbRpc("login_account",{p_username:user,p_password:pwd});
        if(!(r&&r.token)) throw new Error("登录失败");
      }else{
        if(pwd!==$("gPwd2Input").value) throw new Error("两次输入的密码不一致");
        const refVal=($("gRef").value.trim()||getStoredReferrer()).toUpperCase();
        r=await sbRpc("register_account",{p_username:user,p_password:pwd,p_nickname:$("gNick").value.trim(),p_referrer:refVal,p_device:getDeviceId()});
        if(!(r&&r.token)) throw new Error("注册失败");
        showToast(refVal?"🎉 注册成功！你和好友各 +1 次免费深度解析":"注册成功，快去邀请好友吧 ✦");
      }
      saveSession(r.token,{username:r.username,nickname:r.nickname,credits:r.credits,ref_code:r.ref_code,referrer:"",createdAt:"",is_admin:false});
      await refreshAccount();
      updateMemberBadge(); updateNewbieBanner();
      ensureEntitlementMerged();
      hideAuthGate();
      if(pendingAdminIntent){ pendingAdminIntent=false; openAdmin(); }
    }catch(err){
      showToast(err.message||"操作失败，请稍后再试");
      btn.disabled=false; btn.textContent=mode==="login"?"登 录":"注册并领取新人礼";
    }
  };
}
/* 忘记密码：用户名+邮箱匹配 → 页面显示找回码 → 用找回码重置（所有设备退出） */
function renderForgotGate(){
  const content=$("gateContent");
  content.innerHTML=`
    <p class="gate-sub">输入注册时的用户名和绑定邮箱，获取找回码重置密码（30 分钟内有效）</p>
    <form class="api-form" id="gForgotForm">
      <label>用户名<input id="gfUser" maxlength="20"></label>
      <label>绑定邮箱<input id="gfEmail" type="email"></label>
      <div class="btn-row"><button class="btn primary" id="gfBtn1" type="submit" style="width:100%">获取找回码</button></div>
    </form>
    <div id="gfStep2" class="hidden">
      <form class="api-form" id="gResetForm" style="margin-top:14px;border-top:1px solid var(--line);padding-top:14px">
        <label>找回码<input id="gfCode" maxlength="6" placeholder="6 位字母数字"></label>
        <label>新密码<input id="gfPwd" type="password" placeholder="至少 6 位"></label>
        <label>确认新密码<input id="gfPwd2" type="password"></label>
        <div class="btn-row"><button class="btn primary" id="gfBtn2" type="submit" style="width:100%">重置密码</button></div>
      </form>
    </div>
    <p style="text-align:center;margin-top:12px"><button type="button" class="btn ghost" id="gfBack" style="border:0;background:none;padding:4px;font-size:12px;color:var(--muted)">← 返回登录</button></p>`;
  $("gfBack").onclick=()=>showAuthGate();
  $("gForgotForm").onsubmit=async e=>{
    e.preventDefault();
    const btn=$("gfBtn1"); btn.disabled=true; btn.textContent="请稍候…";
    try{
      const r=await sbRpc("request_password_reset",{p_username:$("gfUser").value.trim(),p_email:$("gfEmail").value.trim()});
      if(!(r&&r.ok)) throw new Error("获取失败");
      $("gfStep2").classList.remove("hidden");
      btn.textContent="找回码已生成，请看下方";
      btn.disabled=false;
      const hint=document.createElement("p");
      hint.style.cssText="color:var(--gold);font-size:15px;text-align:center;margin:12px 0;letter-spacing:.25em;font-weight:700";
      hint.textContent="🔑 找回码：" + r.code;
      const step2=$("gfStep2");
      step2.insertBefore(hint, step2.firstChild);
      showToast("找回码已生成（30 分钟内有效）");
    }catch(err){ showToast(err.message); btn.disabled=false; btn.textContent="获取找回码"; }
  };
  $("gResetForm").onsubmit=async e=>{
    e.preventDefault();
    if($("gfPwd").value!==$("gfPwd2").value){ showToast("两次输入的新密码不一致"); return; }
    const btn=$("gfBtn2"); btn.disabled=true; btn.textContent="请稍候…";
    try{
      const r=await sbRpc("reset_password",{p_username:$("gfUser").value.trim(),p_code:$("gfCode").value.trim(),p_new:$("gfPwd").value});
      if(!(r&&r.ok)) throw new Error("重置失败");
      showToast("密码已重置，所有设备已退出，请重新登录");
      showAuthGate();
    }catch(err){ showToast(err.message); btn.disabled=false; btn.textContent="重置密码"; }
  };
}
/* 深度解析额度：登录用户看账号余额（服务端），未登录看本机设备权益 */
const getCredits = () => {
  if(getSession()){
    const acc=readCachedAccount();
    return acc && typeof acc.credits==="number" ? acc.credits : 0;
  }
  return readLocalMember()?.credits || 0;
};
/* 拉新活动：注册时带邀请码 → 双方各 +1 次深度解析（服务端记账，见 register_account）。
   新人礼横幅：仅对「经好友链接访问且尚未注册」的用户显示。 */
function updateNewbieBanner(){
  const banner=$("newbieBanner");
  if(!banner) return;
  const show=sbConfigured() && !!getStoredReferrer() && !getSession();
  banner.classList.toggle("hidden", !show);
}
/* 会员权益：激活码由服务端校验，权益缓存到本机浏览器 */
const grantEntitlement = (plan, credits, expiresMs) => {
  const cur = readLocalMember();
  const member = { plan, credits: credits + (cur?cur.credits:0), expires: Math.max(cur?cur.expires:0, expiresMs), verified:true };
  localStorage.setItem(LOCAL_MEMBER_KEY, JSON.stringify(member));
  updateMemberBadge();
  return member;
};
function updateMemberBadge(){
  const member = readLocalMember();
  const hasAccountCredits = getSession() && getCredits() > 0;
  const isMember = !!(member || hasAccountCredits);
  const badge = $("memberBadge");
  if(badge) badge.classList.toggle("hidden", !isMember);
  const cta = $("btnVipCta");
  if(cta) cta.textContent = isMember ? "我的会员权益" : "会员权益";
  const acct = $("btnAccount");
  if(acct){
    if(getSession()){
      const acc=readCachedAccount();
      acct.textContent = acc && acc.nickname ? String(acc.nickname).slice(0,6) : "我的";
    }else{
      acct.textContent = "我的";
    }
  }
}
async function syncServerEntitlements(){
  if(!sbConfigured()) return;
  try{
    const list = await sbRpc("my_entitlement", { p_device: getDeviceId() });
    if(Array.isArray(list) && list.length){
      let credits=0, expires=0, plan="";
      list.forEach(e => { credits += e.credits||0; const t=new Date(e.expires_at).getTime(); if(t>expires) expires=t; plan = e.plan||plan; });
      if(credits > 0 && expires > Date.now()){
        // 以服务端为准整体覆盖（不是叠加），避免刷新后权益翻倍
        const member={ plan, credits, expires, verified:true };
        localStorage.setItem(LOCAL_MEMBER_KEY, JSON.stringify(member));
        updateMemberBadge();
        return;
      }
    }
    // 服务端无有效权益 → 清掉本地设备权益，防止残留叠加
    localStorage.removeItem(LOCAL_MEMBER_KEY);
    updateMemberBadge();
  }catch(e){ /* 同步失败不打扰用户 */ }
}
const LOCAL_ACCOUNT_KEY = "lunar-tarot-local-account-v1";
const LOCAL_MEMBER_KEY = "lunar-tarot-local-member-v1";
const LOCAL_ORDER_KEY = "lunar-tarot-local-order-v1";
const readLocalAccount = () => { try{return JSON.parse(localStorage.getItem(LOCAL_ACCOUNT_KEY)||"null");}catch{return null;} };
const readLocalMember = () => { try{const member=JSON.parse(localStorage.getItem(LOCAL_MEMBER_KEY)||"null");return member?.verified===true&&member.expires>Date.now()?member:null;}catch{return null;} };
const readLocalOrder = () => { try{return JSON.parse(localStorage.getItem(LOCAL_ORDER_KEY)||"null");}catch{return null;} };
function openAccount(){
  if(sbConfigured()){ openAccountReal(); }
  else { openAccountLocal(); }
  $("toolModal").classList.remove("hidden");
}
/* 真实账号系统：登录 / 注册 / 账户信息 */
async function openAccountReal(){
  const content=$("toolContent"), token=getSession();
  if(!token){ renderAuthForm(content); return; }
  await ensureEntitlementMerged();   // 先合并设备VIP权益，再取真实余额
  await refreshAccount();   // 打开账户页先同步服务器上的真实余额（含刚开通的VIP/管理员调整）
  const acc=readCachedAccount();
  const initials=(acc?.nickname||acc?.username||"星").slice(0,1);
  const emailBox=acc?.email
    ? `<section class="referral-box"><h3>绑定邮箱</h3><p>${escapeHtml(acc.email)}${acc.email_verified?' <span class="st-paid">已验证</span>':' <span class="muted">（未验证）</span>'} · 用于忘记密码找回</p></section>`
    : `<section class="referral-box"><h3>绑定邮箱</h3><p>用于忘记密码找回。未接邮件服务，找回码会直接显示在页面上。</p><div class="code-row"><input class="member-input" id="bindEmail" placeholder="name@example.com"><button class="btn primary" id="btnBindEmail">绑定</button></div></section>`;
  content.innerHTML=`<h2 class="modal-title" id="toolTitle">我的账户</h2><section class="account-summary"><div class="avatar">${escapeHtml(initials)}</div><div><h3>${escapeHtml(acc?.nickname||acc?.username||"星夜旅人")}</h3><p>@${escapeHtml(acc?.username||"")} · 额度跟账号走，换设备登录后依然可用</p></div></section><div class="benefit-grid"><div class="benefit"><strong id="statCredits">${acc?.credits||0}</strong><span>深度解析次数</span></div><div class="benefit"><strong id="statNew">…</strong><span>已拉新人数</span></div><div class="benefit"><strong>${acc?.createdAt?String(acc.createdAt).slice(0,10):"--"}</strong><span>注册日期</span></div></div>${emailBox}<section class="referral-box"><h3>我的专属邀请链接</h3><p>好友用此链接注册，你和 TA 各 +1 次免费深度解析，多邀多得。</p><div class="referral-link"><input id="promoLink" readonly value="${promoLinkFor(acc?.ref_code||"")}"><button class="btn ghost" id="btnCopyPromo">复制</button></div></section><section class="referral-box"><h3>额度明细</h3><div class="order-list" id="ledgerList">加载中…</div></section><div class="btn-row">${acc?.is_admin?'<button class="btn primary" id="btnAdmin" style="padding:10px 26px;font-size:13px">⚙ 管理后台</button>':""}<button class="btn ghost" id="btnEditProfile">修改昵称</button><button class="btn ghost" id="btnChangePwd">修改密码</button><button class="btn ghost" id="btnLogout">退出登录</button></div><div id="editPanel"></div>`;
  $("btnCopyPromo").onclick=()=>copyText(promoLinkFor(acc?.ref_code||"")).then(()=>showToast("邀请链接已复制"));
  if(acc?.is_admin && $("btnAdmin")) $("btnAdmin").onclick=openAdmin;
  const bindBtn=$("btnBindEmail");
  if(bindBtn) bindBtn.onclick=async()=>{ try{ const r=await sbRpc("bind_email",{p_token:token,p_email:$("bindEmail").value.trim()}); if(r&&r.ok){ showToast("邮箱已绑定"); await refreshAccount(); openAccountReal(); } }catch(e){ showToast(e.message); } };
  $("btnLogout").onclick=async()=>{ try{ await sbRpc("logout_account",{p_token:token}); }catch(e){} clearSession(); showToast("已退出登录"); updateMemberBadge(); updateNewbieBanner(); openAccountReal(); showAuthGate(); };
  $("btnEditProfile").onclick=()=>{ const p=$("editPanel"); p.innerHTML=`<form class="api-form" id="nickForm"><label>新昵称<input id="nickInput" maxlength="20" value="${escapeHtml(acc?.nickname||"")}"></label><div class="btn-row"><button class="btn primary" type="submit">保存</button></div></form>`; $("nickForm").onsubmit=async e=>{e.preventDefault(); try{ const r=await sbRpc("update_profile",{p_token:token,p_nickname:$("nickInput").value.trim()}); if(r&&r.ok){ await refreshAccount(); showToast("昵称已更新"); openAccountReal(); } }catch(err){ showToast(err.message); } }; };
  $("btnChangePwd").onclick=()=>{ const p=$("editPanel"); p.innerHTML=`<form class="api-form" id="pwdForm"><label>原密码<input id="pwdOld" type="password" autocomplete="current-password"></label><label>新密码（至少6位）<input id="pwdNew" type="password" autocomplete="new-password"></label><label>确认新密码<input id="pwdNew2" type="password" autocomplete="new-password"></label><div class="btn-row"><button class="btn primary" type="submit">修改</button></div></form>`; $("pwdForm").onsubmit=async e=>{e.preventDefault(); if($("pwdNew").value!==$("pwdNew2").value){showToast("两次输入的新密码不一致");return;} try{ const r=await sbRpc("change_password",{p_token:token,p_old:$("pwdOld").value,p_new:$("pwdNew").value}); if(r&&r.ok){ showToast("密码已修改，其他设备已退出登录"); openAccountReal(); } }catch(err){ showToast(err.message); } }; };
  sbRpc("my_referrals",{p_token:token}).then(stats=>{ if(stats&&stats.ok){ const el=$("statNew"); if(el) el.textContent=stats.new_users||0; } }).catch(()=>{ const el=$("statNew"); if(el) el.textContent="—"; });
  sbRpc("my_ledger",{p_token:token}).then(r=>{
    const list=$("ledgerList"); if(!list) return;
    const rows=(r&&r.list)||[];
    if(!rows.length){ list.innerHTML=`<p class="modal-sub">暂无额度变动记录。</p>`; return; }
    const REASON={register:"注册奖励",invite:"邀请奖励",admin:"后台调整",purchase:"购买会员",ai:"AI 消耗",refund:"退款"};
    list.innerHTML=rows.map(x=>`<div class="order-item"><div><b style="color:${x.delta>=0?'var(--ok)':'#d98a7a'}">${x.delta>0?"+":""}${x.delta} 次</b> · ${REASON[x.reason]||x.reason}${x.note?`<div class="od">${escapeHtml(x.note)}</div>`:""}</div><span class="od">${String(x.created_at||"").slice(0,16).replace("T"," ")} · 余额 ${x.balance_after}</span></div>`).join("");
  }).catch(()=>{ const l=$("ledgerList"); if(l) l.innerHTML=`<p class="modal-sub">加载失败</p>`; });
}
/* 登录 / 注册表单 */
function renderAuthForm(content){
  const ref=(getStoredReferrer()||"").toUpperCase();
  content.innerHTML=`<h2 class="modal-title" id="toolTitle">登录 / 注册</h2><p class="modal-sub">${ref?`你正使用好友的邀请码 <b style="color:var(--gold)">${ref}</b>，注册完成后你和好友各得 1 次免费深度解析。`:"注册即获专属邀请链接，邀请好友各得 1 次免费深度解析。"}</p>
  <div class="auth-tabs"><button class="auth-tab sel" id="tabLogin">登录</button><button class="auth-tab" id="tabRegister">注册</button></div>
  <form class="api-form" id="authForm">
    <label>用户名<input id="authUsername" maxlength="20" autocomplete="username" placeholder="4-20 位字母/数字/下划线"></label>
    <div id="regFields" class="hidden">
      <label>昵称（选填）<input id="authNick" maxlength="20" placeholder="显示在账户页与推广记录里"></label>
      <label>邀请码（选填）<input id="authRef" maxlength="8" placeholder="好友的邀请码" value="${ref}"></label>
    </div>
    <label>密码<input id="authPassword" type="password" autocomplete="current-password" placeholder="至少 6 位"></label>
    <div id="regPwd2" class="hidden"><label>确认密码<input id="authPassword2" type="password" autocomplete="new-password"></label></div>
    <div class="btn-row"><button class="btn primary" id="btnAuthSubmit" type="submit">登 录</button></div>
    <p class="api-note">账号与深度解析额度保存在服务端，换设备登录后依然可用。</p>
  </form>`;
  let mode=ref?"register":"login";
  const setMode=m=>{
    mode=m;
    $("tabLogin").classList.toggle("sel",m==="login");
    $("tabRegister").classList.toggle("sel",m==="register");
    $("regFields").classList.toggle("hidden",m!=="register");
    $("regPwd2").classList.toggle("hidden",m!=="register");
    $("btnAuthSubmit").textContent=m==="login"?"登 录":"注册并领取新人礼";
  };
  $("tabLogin").onclick=()=>setMode("login");
  $("tabRegister").onclick=()=>setMode("register");
  setMode(mode);
  $("authForm").onsubmit=async e=>{
    e.preventDefault();
    const username=$("authUsername").value.trim();
    const password=$("authPassword").value;
    const submit=$("btnAuthSubmit");
    submit.disabled=true; submit.textContent="请稍候…";
    try{
      if(mode==="login"){
        const r=await sbRpc("login_account",{p_username:username,p_password:password});
        if(!(r&&r.token)) throw new Error("登录失败");
        saveSession(r.token,{username:r.username,nickname:r.nickname,credits:r.credits,ref_code:r.ref_code,referrer:"",createdAt:"",is_admin:false});
        showToast("登录成功 ✦");
      }else{
        const nick=$("authNick").value.trim();
        const ref2=($("authRef").value.trim()||getStoredReferrer()).toUpperCase();
        const pwd2=$("authPassword2").value;
        if(password!==pwd2){ throw new Error("两次输入的密码不一致"); }
        const r=await sbRpc("register_account",{p_username:username,p_password:password,p_nickname:nick,p_referrer:ref2,p_device:getDeviceId()});
        if(!(r&&r.token)) throw new Error("注册失败");
        saveSession(r.token,{username:r.username,nickname:r.nickname,credits:r.credits,ref_code:r.ref_code,referrer:ref2,createdAt:"",is_admin:false});
        showToast(ref2?"🎉 注册成功！你和好友各 +1 次免费深度解析":"注册成功，快去邀请好友吧 ✦");
      }
      await refreshAccount();  // 拉取完整资料（含 is_admin / 余额）
      updateMemberBadge();
      updateNewbieBanner();
      ensureEntitlementMerged();
      track(mode==="login"?"login":"register", { referred: !!getStoredReferrer() });
      if(pendingAdminIntent){ pendingAdminIntent=false; openAdmin(); }
      else openAccountReal();
    }catch(err){
      showToast(err.message||"操作失败，请稍后再试");
      submit.disabled=false; submit.textContent=mode==="login"?"登 录":"注册并领取新人礼";
    }
  };
}
/* 本地体验账户（未配置 Supabase 时） */
function openAccountLocal(){
  const content=$("toolContent"), account=readLocalAccount(), member=readLocalMember();
  if(account){
    const initials=(account.name||"星").slice(0,1);
    content.innerHTML=`<h2 class="modal-title" id="toolTitle">我的账户</h2><section class="account-summary"><div class="avatar">${escapeHtml(initials)}</div><div><h3>${escapeHtml(account.name)}</h3><p>${escapeHtml(account.email||"本地体验账户")}</p></div></section><div class="benefit-grid"><div class="benefit"><strong>${member?.credits||0}</strong><span>AI 解读额度</span></div><div class="benefit"><strong>${member?.plan||"免费"}</strong><span>当前权益</span></div><div class="benefit"><strong>${member?.expires?new Date(member.expires).toLocaleDateString("zh-CN"):"--"}</strong><span>权益有效期</span></div></div><p class="api-note">本地体验模式：配置 Supabase 后自动升级为真实账号系统（用户名+密码，额度保存在服务端，换设备可用）。</p><div class="btn-row"><button class="btn ghost" id="btnLogout">退出本地账户</button></div>`;
    $("btnLogout").onclick=()=>{localStorage.removeItem(LOCAL_ACCOUNT_KEY);localStorage.removeItem(LOCAL_MEMBER_KEY);showToast("已退出本地账户");updateMemberBadge();openAccountLocal();};
  }else{
    content.innerHTML=`<h2 class="modal-title" id="toolTitle">登录星夜塔罗</h2><p class="modal-sub">本地体验版账户仅保存在当前浏览器，用于测试会员与推广流程。</p><form class="api-form" id="loginForm"><label>昵称<input id="loginName" maxlength="16" required placeholder="给自己起一个名字"></label><label>邮箱（选填）<input id="loginEmail" type="email" placeholder="name@example.com"></label><div class="btn-row"><button class="btn primary" type="submit">进入星夜塔罗</button></div></form>`;
    $("loginForm").onsubmit=event=>{event.preventDefault();const account={name:$("loginName").value.trim(),email:$("loginEmail").value.trim(),createdAt:Date.now()};localStorage.setItem(LOCAL_ACCOUNT_KEY,JSON.stringify(account));showToast("登录成功");updateMemberBadge();openAccountLocal();};
  }
}
function requireLocalAccount(){if(readLocalAccount())return true;openAccount();showToast("请先登录本地体验账户");return false;}
function openMemberExperience(){
  if(!requireLocalAccount())return;
  const content=$("toolContent"), member=readLocalMember();
  content.innerHTML=`<h2 class="modal-title" id="toolTitle">灵感会员</h2><p class="modal-sub">免费占卜、每日一签与词典始终可用。以下为本地会员体验流程，不会创建真实订单。</p><section class="member-hero"><h3>${member?`当前：${PLAN_NAMES[member.plan]||member.plan}`:"低价解锁更多灵感"}</h3><p>${member?`剩余 ${member.credits} 次 AI 解读额度，有效至 ${new Date(member.expires).toLocaleDateString("zh-CN")}。`:"官方 AI 深度解读、更多历史与分享权益，均可在本地先完整体验。"}</p></section><div class="plan-grid" id="localPlanGrid">${MEMBER_PLANS.map((plan,index)=>`<button class="plan ${index===0?"selected":""}" data-local-plan="${plan.id}"><h4>${plan.name}</h4><div class="price">¥${plan.price}</div><p>${plan.detail}</p></button>`).join("")}</div><div class="checkout-options" id="localPayOptions"><button class="pay-option selected" data-local-pay="wechat">微信支付</button><button class="pay-option" data-local-pay="alipay">支付宝</button></div><div class="btn-row"><button class="btn primary" id="btnLocalActivate">本地体验开通</button></div>`;
  let planId="single";
  content.querySelectorAll("[data-local-plan]").forEach(button=>button.onclick=()=>{planId=button.dataset.localPlan;content.querySelectorAll("[data-local-plan]").forEach(item=>item.classList.toggle("selected",item===button));});
  content.querySelectorAll("[data-local-pay]").forEach(button=>button.onclick=()=>content.querySelectorAll("[data-local-pay]").forEach(item=>item.classList.toggle("selected",item===button)));
  $("btnLocalActivate").onclick=()=>{const plan=MEMBER_PLANS.find(item=>item.id===planId), days=planId==="single"?7:30, credits=planCredits(planId);localStorage.setItem(LOCAL_MEMBER_KEY,JSON.stringify({plan:plan.name,credits,expires:Date.now()+days*86400000}));showToast("本地会员权益已开通");updateMemberBadge();openMemberExperience();};
  $("toolModal").classList.remove("hidden");
}
/* ══════════ 会员开通：自动化支付 + 个人码人工确认 ══════════ */
function openMemberBilling(){
  if(sbConfigured()){ openMemberCheckout(); return; }
  openMemberExperience();
}
let payPollTimer=null;
async function startAutoPay(s){
  const btn=$("btnNext"); if(btn){ btn.disabled=true; btn.textContent="正在跳转收银台…"; }
  const plan=MEMBER_PLANS.find(p=>p.id===s.planId)||MEMBER_PLANS[0];
  try{
    const res=await fetch(`${payApiBase()}/api/epay/create`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({planId:s.planId,method:s.method,referrer:s.ref||"",deviceId:getDeviceId()})});
    let data=null; try{ data=await res.json(); }catch(e){ /* 非 JSON */ }
    if(!res.ok||!data||!data.payUrl) throw new Error(data?.error||"创建订单失败");
    track("order_created", { plan: s.planId, method: s.method, referrer: !!s.ref });
    localStorage.setItem(LOCAL_ORDER_KEY,JSON.stringify({orderNo:data.orderNo,planName:plan.name,planId:s.planId,method:s.method,status:"pending",createdAt:Date.now()}));
    location.href=data.payUrl;   // 跳转易支付收银台，付款后自动跳回
  }catch(e){
    // 自动支付不可用（如商户未配置）时，自动降级为个人码扫码人工确认
    try{
      const quote=await sbRpc("quote_order",{p_plan:s.planId,p_referrer:s.ref||"",p_device:getDeviceId()});
      renderMemberCheckout({step:"pay",planId:s.planId,method:s.method,ref:s.ref||getStoredReferrer(),quote});
      showToast("自动支付暂不可用，已切换为扫码支付");
    }catch(e2){
      renderMemberCheckout({...s,err:e.message});
    }
  }
}
function waitOrderPaid(orderNo, planId, method){
  if(payPollTimer) clearInterval(payPollTimer);
  let tries=0;
  const tick=async()=>{
    tries++;
    try{
      const res=await fetch(`${payApiBase()}/api/order?no=${encodeURIComponent(orderNo)}`);
      const data=await res.json();
      if(res.ok && data.status==="paid"){
        clearInterval(payPollTimer); payPollTimer=null;
        localStorage.removeItem(LOCAL_ORDER_KEY);
        await syncServerEntitlements();
        updateMemberBadge();
        renderMemberCheckout({step:"ok",planId,method,orderNo});
        showToast("支付成功，会员权益已到账 ✦");
        return;
      }
      if(res.ok && data.status==="cancelled"){
        clearInterval(payPollTimer); payPollTimer=null;
        localStorage.removeItem(LOCAL_ORDER_KEY);
        renderMemberCheckout({step:"plan",planId,method,err:"订单已取消，请重新下单"});
        return;
      }
    }catch(e){ /* 网络抖动继续轮询 */ }
    if(tries>=45){ clearInterval(payPollTimer); payPollTimer=null; renderMemberCheckout({step:"plan",planId,method,err:"支付结果确认超时，请稍后到「我的-订单」查看"}); }
  };
  tick();
  payPollTimer=setInterval(tick,2000);
}
function renderMemberCheckout(state){
  const content=$("toolContent"), member=readLocalMember(), pending=readLocalOrder();
  const AUTO=autoPayEnabled();
  const s=state||{step:"plan",planId:"single",method:"wechat",ref:"",quote:null,orderNo:null,err:""};
  const plan=MEMBER_PLANS.find(p=>p.id===s.planId)||MEMBER_PLANS[0];
  const storedRef=s.ref||getStoredReferrer();
  const payHint=AUTO?"微信 / 支付宝支付成功后自动到账，无需等待人工发码。":"付款直接转给店主微信/支付宝，确认到账后发放激活码。";
  let html=`<h2 class="modal-title" id="toolTitle">灵感会员</h2><p class="modal-sub">免费占卜、每日一签与牌意词典始终可用。会员解锁官方 AI 深度解读。${payHint}</p>`;
  if(member) html+=`<section class="member-hero"><h3>当前：${PLAN_NAMES[member.plan]||member.plan}</h3><p>剩余 <b style="color:var(--gold)">${getCredits()}</b> 次深度解析额度${member.expires?`，会员有效至 ${new Date(member.expires).toLocaleDateString("zh-CN")}`:""}。<button class="btn ghost" id="btnSync" style="margin-left:8px;padding:6px 12px;font-size:11px">刷新权益</button></p></section>`;
  else if(getSession()) html+=`<section class="member-hero"><h3>账户余额</h3><p>深度解析额度：<b style="color:var(--gold)">${getCredits()}</b> 次（邀请好友可免费获得）；开通会员可享更多权益。</p></section>`;
  else if(pending && !s.orderNo) html+=`<section class="member-hero"><h3>待确认订单</h3><p>订单 ${pending.orderNo||""}（${pending.planName}）${AUTO?"已生成，可返回收银台继续付款":"等待店主确认到账，确认后店主会发你激活码"}。</p>${AUTO?`<div class="btn-row" style="margin-top:10px;justify-content:flex-start"><button class="btn ghost" id="btnResumePay">查看支付状态</button></div>`:""}</section>`;
  html+=`<section class="referral-box"><h3>已有激活码？</h3><div class="code-row"><input class="member-input" id="activateInput" maxlength="16" placeholder="输入店主发给你的激活码"><button class="btn primary" id="btnActivate">激活</button></div></section>`;
  if(s.step==="waiting"&&AUTO){
    html+=`<section class="pay-wait"><div class="spinner"></div>正在确认支付结果…<br>如已完成付款但迟迟未到账，请稍候片刻，页面会自动刷新状态。</section>`;
  }else if(s.step==="ok"&&AUTO){
    html+=`<section class="order-info"><b>✦ 支付成功，会员权益已到账</b><br>方案：${plan.name}<br>AI 解读额度：<b style="color:var(--gold)">${getCredits()}</b> 次<br>有效期至：${member&&member.expires?new Date(member.expires).toLocaleDateString("zh-CN"):"--"}${s.orderNo?`<br>订单号：${s.orderNo}`:""}</section>`;
    html+=`<div class="btn-row"><button class="btn primary" id="btnStartUse">开始占卜</button><button class="btn ghost" id="btnAgain">再开通一份</button></div>`;
  }else if(s.step==="pay"&&s.quote){
    html+=`<section class="qr-box"><h3 style="color:var(--gold-hi);font:16px var(--serif);letter-spacing:.1em">请扫码支付（微信）</h3>
      <img id="qrImg" src="${TAROT_SUPABASE.qrWechat}" alt="微信收款码">
      <p class="qr-note">收款方：星夜塔罗店主<br>应付金额：<b style="color:var(--gold)">¥${Number(s.quote.price).toFixed(2)}</b>（${plan.name}）${s.quote.discount>0?`<br>含好友首单立减 ¥${Number(s.quote.discount).toFixed(2)}`:""}<br>订单号：<b style="color:var(--gold)">${s.orderNo||"--"}</b><br><span style="color:#e8cf8f">⚠️ 付款时请在「备注 / 附言」里填写上面的订单号，方便店主核对到账！</span><br>付完点击下方「我已完成付款」</p>
      <div class="btn-row"><button class="btn primary" id="btnPaid">我已完成付款</button><button class="btn ghost" id="btnBackPlan">返回改选</button></div></section>`;
  }else if(s.step==="done"){
    html+=`<section class="order-info"><b>订单已提交</b><br>订单号：${s.orderNo||"--"}<br>方案：${plan.name}　金额：¥${s.quote?Number(s.quote.price).toFixed(2):""}${TAROT_SUPABASE.contact?`<br>若已付款，加店主微信「${TAROT_SUPABASE.contact}」发送订单号，确认后店主会发你激活码。`:"<br>若已付款，联系店主发送订单号，确认后你会收到激活码。"}</section>`;
    html+=`<div class="btn-row"><button class="btn ghost" id="btnAgain">再开通一份</button></div>`;
  }else{
    html+=`<div class="plan-grid">${MEMBER_PLANS.map((p,i)=>`<button class="plan ${(i===0&&!s.planId)||p.id===s.planId?"selected":""}" data-plan="${p.id}"><h4>${p.name}</h4><div class="price">¥${p.price}</div><p>${p.detail}</p></button>`).join("")}</div>`;
    html+=`<section class="referral-box"><h3>推荐码（选填）</h3><p>好友推荐首单立减 ¥${Number(TAROT_SUPABASE.discount).toFixed(2)}。</p><input class="member-input" id="refInput" maxlength="8" placeholder="粘贴好友的推荐码" value="${storedRef}"></section>`;
    html+=`<div class="checkout-options"><button class="pay-option ${s.method==="wechat"?"selected":""}" data-pay="wechat">微信扫码支付</button></div>`;
    html+=`<div class="btn-row"><button class="btn primary" id="btnNext">${AUTO?"去支付":"下一步：扫码支付"}</button></div>`;
  }
  if(s.err) html+=`<p style="color:#e08a8a;font-size:12px;margin-top:12px">${s.err}</p>`;
  content.innerHTML=html;
  const q=sel=>content.querySelector(sel);
  const act=q("#btnActivate");
  if(act) act.onclick=async()=>{const code=q("#activateInput").value.trim(); if(!code){showToast("请输入激活码");return;} try{
    if(getSession()){
      const r=await sbRpc("activate_code_account",{p_token:getSession(),p_code:code,p_device:getDeviceId()});
      if(!(r&&r.ok)) throw new Error(r?.reason==="login_expired"?"登录已过期":(r?.reason||"激活失败"));
      localStorage.removeItem(LOCAL_MEMBER_KEY);   // 权益已入账号，清本地设备权益
      await refreshAccount();
      showToast(`会员已开通 ✦ 额度 ${r.credits} 次`);
    }else{
      const r=await sbRpc("activate_code",{p_code:code,p_device:getDeviceId()});
      grantEntitlement(r.plan,r.credits,new Date(r.expires_at).getTime());
      showToast("会员已开通 ✦");
    }
    updateMemberBadge(); renderMemberCheckout({step:"plan",planId:s.planId,method:s.method});
  }catch(e){showToast(e.message);} };
  const sync=q("#btnSync");
  if(sync) sync.onclick=async()=>{sync.disabled=true; sync.textContent="刷新中…"; await syncServerEntitlements(); showToast("权益已同步"); renderMemberCheckout({step:"plan",planId:s.planId,method:s.method}); };
  const resume=q("#btnResumePay");
  if(resume) resume.onclick=()=>{renderMemberCheckout({step:"waiting",planId:pending?.planId||"single",method:pending?.method||"wechat",orderNo:pending?.orderNo});};
  if(s.step==="waiting"&&AUTO&&s.orderNo){
    waitOrderPaid(s.orderNo, s.planId||"single", s.method||"wechat");
  }else if(s.step==="ok"&&AUTO){
    const use=q("#btnStartUse");
    if(use) use.onclick=()=>{closeModal(); goStage(0);};
    const again=q("#btnAgain");
    if(again) again.onclick=()=>renderMemberCheckout({step:"plan",planId:s.planId,method:s.method});
  }else if(s.step==="pay"){
    q("#btnPaid").onclick=()=>{ renderMemberCheckout({step:"done",planId:s.planId,method:s.method,quote:s.quote,orderNo:s.orderNo}); showToast("订单已提交，等待店主确认到账"); };
    q("#btnBackPlan").onclick=()=>renderMemberCheckout({step:"plan",planId:s.planId,method:s.method,ref:s.ref});
  }else if(s.step==="done"){
    q("#btnAgain").onclick=()=>renderMemberCheckout({step:"plan",planId:s.planId,method:s.method,ref:s.ref});
  }else{
    q("#btnNext").onclick=async()=>{
      const ref=(q("#refInput")?.value||"").trim().toUpperCase();
      if(ref&&!/^[A-Z0-9]{4,8}$/.test(ref)){renderMemberCheckout({...s,err:"推荐码格式不对（4-8位字母数字）"});return;}
      const meth="wechat";
      const next={...s,ref:ref||getStoredReferrer(),method:meth};
      if(AUTO){ await startAutoPay(next); }
      else{
        try{
          const quote=await sbRpc("quote_order",{p_plan:s.planId,p_referrer:ref||"",p_device:getDeviceId()});
          const order=getSession()
            ? await sbRpc("create_account_order",{p_token:getSession(),p_plan:s.planId,p_method:meth,p_referrer:ref||"",p_device:getDeviceId()})
            : await sbRpc("create_order",{p_plan:s.planId,p_method:meth,p_referrer:ref||"",p_device:getDeviceId()});
          localStorage.setItem(LOCAL_ORDER_KEY,JSON.stringify({orderNo:order.order_no,planName:plan.name,status:"pending",createdAt:Date.now()}));
          renderMemberCheckout({step:"pay",planId:s.planId,method:meth,ref:ref||getStoredReferrer(),quote,orderNo:order.order_no});
        }catch(e){renderMemberCheckout({...s,err:e.message});}
      }
    };
    content.querySelectorAll("[data-plan]").forEach(b=>b.onclick=()=>{content.querySelectorAll("[data-plan]").forEach(x=>x.classList.toggle("selected",x===b)); s.planId=b.dataset.plan;});
    content.querySelectorAll("[data-pay]").forEach(b=>b.onclick=()=>{content.querySelectorAll("[data-pay]").forEach(x=>x.classList.toggle("selected",x===b)); s.method=b.dataset.pay;});
  }
  $("toolModal").classList.remove("hidden");
}
function openMemberCheckout(init){
  Promise.all([
    syncServerEntitlements(),
    getSession() ? refreshAccount() : Promise.resolve(null)
  ]).then(()=>renderMemberCheckout(init));
}
function openPromotionSecure(){
  if(sbConfigured()){ openPromotionReal(); return; }
  const content=$("toolContent"), link=`${location.href.split("?")[0]}?ref=${getReferralCode()}`, referrer=getReferrer();
  content.innerHTML=`<h2 class="modal-title" id="toolTitle">星光邀请计划</h2><p class="modal-sub">本地活动预览。配置收款后自动切换为真实拉新返利。</p><section class="promo-banner"><h3>${referrer?"你已获得好友邀请":"邀请好友，分享一束星光"}</h3><p>${referrer?"注册新用户后，你和邀请人各得 1 次免费深度解析。":"每位好友通过你的链接注册，你和 TA 各得 1 次官方 AI 深度解析。"}</p><div class="promo-steps"><div class="promo-step"><b>01</b>复制专属链接</div><div class="promo-step"><b>02</b>好友注册新用户</div><div class="promo-step"><b>03</b>双方各 +1 次解析</div></div></section><div class="referral-box"><h3>我的专属推广链接</h3><div class="referral-link"><input id="promoLink" readonly value="${link}"><button class="btn ghost" id="btnCopyPromo">复制</button></div></div>`;
  $("btnCopyPromo").onclick=()=>copyText(link).then(()=>showToast("推广链接已复制"));
  $("toolModal").classList.remove("hidden");
}
async function openPromotionReal(){
  if(!getSession()){ openAccount(); showToast("请先登录，登录后即可生成专属邀请链接"); return; }
  const acc=await refreshAccount();
  if(!acc){ openAccount(); showToast("登录已过期，请重新登录"); return; }
  const content=$("toolContent"), link=promoLinkFor(acc.ref_code);
  let rate=TAROT_SUPABASE.rebateRate, discount=TAROT_SUPABASE.discount;
  try{ const pub=await sbRpc("pub_settings",{}); if(pub&&pub.rebate_rate!=null){ rate=Number(pub.rebate_rate); discount=Number(pub.discount); } }catch(e){ /* 用兜底值 */ }
  content.innerHTML=`<h2 class="modal-title" id="toolTitle">星光邀请计划</h2><p class="modal-sub">好友通过你的链接<b>注册新用户</b>：你和 TA 各 +1 次免费深度解析（上不封顶）；好友购买会员还有首单立减 ¥${Number(discount).toFixed(2)}。</p>
  <section class="promo-banner"><h3>每拉 1 个新用户 = 1 次免费深度解析</h3><p>无需好友付费，只要 TA 通过你的链接创建账户完成注册，你和 TA 各得 1 次官方 AI 深度解析机会。多邀多得，自动到账。</p><div class="promo-steps"><div class="promo-step"><b>01</b>复制专属链接</div><div class="promo-step"><b>02</b>好友注册新用户</div><div class="promo-step"><b>03</b>双方各 +1 次解析</div></div></section>
  <div class="referral-box"><h3>我的专属邀请链接</h3><div class="referral-link"><input id="promoLink" readonly value="${link}"><button class="btn ghost" id="btnCopyPromo">复制</button></div><p id="promoStats" style="font-size:12px;color:var(--muted);margin-top:12px">加载中…</p></div>
  <section class="referral-box"><h3>现金返利（选填）</h3><p>好友购买会员时按 ${Math.round(rate*100)}% 比例返现金，由店主人工确认后转账；想启用请把收款账号发给店主。默认深度解析额度自动到账。</p></section>`;
  $("btnCopyPromo").onclick=()=>copyText(link).then(()=>showToast("邀请链接已复制"));
  $("toolModal").classList.remove("hidden");
  try{
    const stats=await sbRpc("my_referrals",{p_token:getSession()});
    const st=$("promoStats");
    if(stats&&stats.ok){
      st.innerHTML=`已拉新：<b style="color:var(--gold)">${stats.new_users||0}</b> 人　可用深度解析：<b style="color:var(--gold)">${stats.credits||0}</b> 次`;
    }else{
      st.innerHTML=`已拉新：0 人　可用深度解析：${acc.credits||0} 次`;
    }
  }catch(e){ const st=$("promoStats"); if(st) st.innerHTML=`已拉新：—　可用深度解析：${acc.credits||0} 次`; }
}

/* ══════════ 店主后台 ══════════ */
let pendingAdminIntent=false;
let adminTab="overview";
let adminOrderFilter="";
let adminCodeFilter="unused";
function openAdmin(){
  if(!sbConfigured()){ showToast("配置 Supabase 后即可使用后台"); return; }
  if(!getSession()){ pendingAdminIntent=true; openAccount(); showToast("请先登录管理员账号"); return; }
  refreshAccount().then(acc=>{
    if(!acc || !acc.is_admin){ showToast("无管理员权限"); pendingAdminIntent=false; openAccountReal(); return; }
    renderAdmin();
  });
}
function renderAdmin(){
  const content=$("toolContent");
  content.innerHTML=`<h2 class="modal-title" id="toolTitle">⚙ 店主后台</h2>
  <div class="auth-tabs" id="adminTabs">
    <button class="auth-tab sel" data-tab="overview">概览</button>
    <button class="auth-tab" data-tab="users">用户</button>
    <button class="auth-tab" data-tab="orders">订单</button>
    <button class="auth-tab" data-tab="rebates">返利</button>
    <button class="auth-tab" data-tab="codes">卡密</button>
    <button class="auth-tab" data-tab="settings">设置</button>
    <button class="auth-tab" data-tab="logs">日志</button>
  </div>
  <div id="adminBody"><div class="pay-wait"><div class="spinner"></div>加载中…</div></div>
  <p class="admin-note">提示：标记订单「已支付」会自动发卡密并生成返利台账；用户额度可随时手动调整。</p>`;
  content.querySelectorAll("#adminTabs .auth-tab").forEach(btn=>btn.onclick=()=>{
    adminTab=btn.dataset.tab;
    content.querySelectorAll("#adminTabs .auth-tab").forEach(x=>x.classList.toggle("sel",x===btn));
    loadAdminTab();
  });
  $("toolModal").classList.remove("hidden");
  loadAdminTab();
}
async function loadAdminTab(){
  const body=$("adminBody");
  if(!body) return;
  body.innerHTML=`<div class="pay-wait"><div class="spinner"></div>加载中…</div>`;
  const token=getSession();
  try{
    if(adminTab==="overview"){
      const r=await sbRpc("admin_stats",{p_token:token});
      if(!r||r.ok===false) throw new Error(r?.reason==="forbidden"?"无权限":(r?.reason||"加载失败"));
      body.innerHTML=`<div class="benefit-grid"><div class="benefit"><strong>${r.total_users}</strong><span>总注册用户</span></div><div class="benefit"><strong>${r.users_today}</strong><span>今日新增</span></div><div class="benefit"><strong>${r.referred_users}</strong><span>被拉新用户</span></div><div class="benefit"><strong>${r.paid_orders}</strong><span>已支付订单</span></div><div class="benefit"><strong>¥${Number(r.revenue).toFixed(2)}</strong><span>累计收入</span></div><div class="benefit"><strong>${r.pending_orders}</strong><span>待确认订单</span></div><div class="benefit"><strong>${r.pending_rebates}</strong><span>待结算返利</span></div><div class="benefit"><strong>${r.unused_codes}</strong><span>未用卡密</span></div></div>`;
    }else if(adminTab==="users"){
      const r=await sbRpc("admin_list_accounts",{p_token:token});
      if(!r||r.ok===false) throw new Error(r?.reason==="forbidden"?"无权限":"加载失败");
      const rows=(r.list||[]).map(u=>`<div class="admin-row"><div><b>${escapeHtml(u.nickname)}</b> <span class="muted">@${escapeHtml(u.username)}</span>${u.is_admin?' <span class="st-paid">管理员</span>':''}${u.is_banned?' <span style="color:#d98a7a">已封禁</span>':''}<div class="od">邀请码 ${escapeHtml(u.ref_code)} · 拉新 ${u.referred||0} 人 · ${String(u.created_at||"").slice(0,10)}${u.referrer?` · 经 ${escapeHtml(u.referrer)} 邀请`:""}${u.device_id?`<br>设备 ${escapeHtml(String(u.device_id).slice(0,10))}${u.client_ip?` · IP ${escapeHtml(u.client_ip)}`:""}`:""}</div></div><div class="admin-actions"><span class="st-paid">${u.credits} 次</span><button class="btn ghost" data-cred="${escapeHtml(u.username)}" data-delta="1">+1</button><button class="btn ghost" data-cred="${escapeHtml(u.username)}" data-delta="10">+10</button><button class="btn ghost danger" data-cred="${escapeHtml(u.username)}" data-delta="-1">-1</button><button class="btn ghost" data-ledger="${escapeHtml(u.username)}">明细</button>${u.is_admin?"":(u.is_banned?`<button class="btn ghost" data-ban="${escapeHtml(u.username)}" data-banned="false">解封</button>`:`<button class="btn ghost danger" data-ban="${escapeHtml(u.username)}" data-banned="true">封禁</button>`)}</div></div>`).join("");
      body.innerHTML=`<div class="admin-list">${rows||'<p class="modal-sub">暂无用户</p>'}</div>`;
      body.querySelectorAll("[data-ledger]").forEach(btn=>btn.onclick=()=>showUserLedger(btn.dataset.ledger));
      body.querySelectorAll("[data-cred]").forEach(btn=>btn.onclick=async()=>{
        const uname=btn.dataset.cred, delta=Number(btn.dataset.delta);
        if(delta<0 && !confirm(`确认给 @${uname} 扣减 ${-delta} 次深度解析额度？`)) return;
        try{
          const rr=await sbRpc("admin_set_credits",{p_token:token,p_username:uname,p_delta:delta});
          if(!rr||rr.ok===false) throw new Error(rr?.reason==="no_user"?"用户不存在":(rr?.reason||"操作失败"));
          showToast("额度已调整"); loadAdminTab();
        }catch(e){ showToast(e.message); }
      });
      body.querySelectorAll("[data-ban]").forEach(btn=>btn.onclick=async()=>{
        const uname=btn.dataset.ban, banned=btn.dataset.banned==="true";
        if(banned && !confirm(`确认封禁 @${uname}？封禁后该账号无法登录，已登录的会话也会失效。`)) return;
        try{
          const rr=await sbRpc("admin_set_banned",{p_token:token,p_username:uname,p_banned:banned});
          if(!rr||rr.ok===false) throw new Error(rr?.reason||"操作失败");
          showToast(banned?"已封禁":"已解封"); loadAdminTab();
        }catch(e){ showToast(e.message); }
      });
    }else if(adminTab==="orders"){
      const statusText={pending:"待确认",paid:"已支付",cancelled:"已取消"};
      const r=await sbRpc("admin_list_orders",{p_token:token,p_status:adminOrderFilter});
      if(!r||r.ok===false) throw new Error(r?.reason==="forbidden"?"无权限":"加载失败");
      const rows=(r.list||[]).map(o=>`<div class="admin-row"><div><b>${escapeHtml(o.plan_name)}</b> · ¥${Number(o.price).toFixed(2)} · <span class="st-${o.status}">${statusText[o.status]||o.status}</span><div class="od">${escapeHtml(o.order_no)} · ${o.pay_method==="alipay"?"支付宝":"微信"}${o.referrer?` · 推荐 ${escapeHtml(o.referrer)}`:""} · ${String(o.created_at||"").slice(0,16).replace("T"," ")}${o.issued_code?` · 已发放 ${String(o.issued_code).slice(0,8)}…`:""}</div></div><div class="admin-actions">${o.status==="pending"?`<button class="btn ghost" data-order="${escapeHtml(o.order_no)}" data-st="paid">标记已支付</button><button class="btn ghost danger" data-order="${escapeHtml(o.order_no)}" data-st="cancelled">取消</button>`:o.status==="paid"?`<button class="btn ghost danger" data-order="${escapeHtml(o.order_no)}" data-st="cancelled">退款/取消</button>${o.issued_code?"":`<button class="btn ghost" data-rebind="${escapeHtml(o.order_no)}">补发到账号</button>`}`:""}</div></div>`).join("");
      body.innerHTML=`<div class="auth-tabs" id="orderFilter" style="margin-bottom:10px"><button class="auth-tab ${adminOrderFilter===""?"sel":""}" data-st="">全部</button><button class="auth-tab ${adminOrderFilter==="pending"?"sel":""}" data-st="pending">待确认</button><button class="auth-tab ${adminOrderFilter==="paid"?"sel":""}" data-st="paid">已支付</button><button class="auth-tab ${adminOrderFilter==="cancelled"?"sel":""}" data-st="cancelled">已取消</button></div><div class="admin-list">${rows||'<p class="modal-sub">暂无订单</p>'}</div>`;
      body.querySelectorAll("#orderFilter .auth-tab").forEach(btn=>btn.onclick=()=>{adminOrderFilter=btn.dataset.st;loadAdminTab();});
      body.querySelectorAll("[data-rebind]").forEach(btn=>btn.onclick=async()=>{
        const uname=prompt("输入该订单买家的用户名，把权益补发到他的账号：");
        if(!uname||!uname.trim()) return;
        try{
          const rr=await sbRpc("admin_set_order_account",{p_token:token,p_order_no:btn.dataset.rebind,p_username:uname.trim()});
          if(!rr||rr.ok===false) throw new Error({already_issued:"该订单已发放过权益",no_user:"用户不存在"}[rr.reason]||rr.reason||"操作失败");
          showToast("已补发到账号"); loadAdminTab();
        }catch(e){ showToast(e.message); }
      });
      body.querySelectorAll("[data-order]").forEach(btn=>btn.onclick=async()=>{
        const orderNo=btn.dataset.order, st=btn.dataset.st;
        if(st==="paid" && !confirm(`确认订单 ${orderNo} 已到账？将自动发放会员权益并生成返利。`)) return;
        if(st==="cancelled" && !confirm(`确认${orderNo==="paid"?"退款/":"取消"}订单 ${orderNo}？`)) return;
        try{
          const rr=await sbRpc("admin_set_order_status",{p_token:token,p_order_no:orderNo,p_status:st});
          if(!rr||rr.ok===false) throw new Error(rr?.reason||"操作失败");
          showToast(st==="paid"?"已标记支付，权益已自动发放":"状态已更新"); loadAdminTab();
        }catch(e){ showToast(e.message); }
      });
    }else if(adminTab==="rebates"){
      const statusText={pending:"待结算",paid:"已结算",skipped:"已跳过"};
      const kindText={cash:"现金",credit:"额度"};
      const r=await sbRpc("admin_list_rebates",{p_token:token});
      if(!r||r.ok===false) throw new Error(r?.reason==="forbidden"?"无权限":"加载失败");
      const rows=(r.list||[]).map(b=>`<div class="admin-row"><div><b>${kindText[b.kind]||b.kind}${b.amount?` ¥${Number(b.amount).toFixed(2)}`:""}</b> · <span class="st-${b.status}">${statusText[b.status]||b.status}</span><div class="od">订单 ${escapeHtml(b.order_no||"--")} · 推荐人 ${escapeHtml(b.referrer||"--")} · ${String(b.created_at||"").slice(0,16).replace("T"," ")}${b.note?` · ${escapeHtml(b.note)}`:""}</div></div><div class="admin-actions">${b.status==="pending"?`<button class="btn ghost" data-rebate="${b.id}" data-st="paid">已转账</button><button class="btn ghost danger" data-rebate="${b.id}" data-st="skipped">不返</button>`:""}</div></div>`).join("");
      body.innerHTML=`<div class="admin-list">${rows||'<p class="modal-sub">暂无返利记录</p>'}</div>`;
      body.querySelectorAll("[data-rebate]").forEach(btn=>btn.onclick=async()=>{
        if(btn.dataset.st==="paid" && !confirm("确认已转账给推荐人？")) return;
        try{
          const rr=await sbRpc("admin_set_rebate_status",{p_token:token,p_id:btn.dataset.rebate,p_status:btn.dataset.st});
          if(!rr||rr.ok===false) throw new Error(rr?.reason||"操作失败");
          showToast("已更新"); loadAdminTab();
        }catch(e){ showToast(e.message); }
      });
    }else if(adminTab==="codes"){
      const r=await sbRpc("admin_list_codes",{p_token:token,p_status:adminCodeFilter});
      if(!r||r.ok===false) throw new Error(r?.reason==="forbidden"?"无权限":"加载失败");
      const codes=(r.list||[]).map(c=>escapeHtml(c.code)).join("\n");
      body.innerHTML=`<section class="referral-box"><h3>生成卡密</h3><div class="code-row"><select id="admCodeCount" class="member-input" style="max-width:90px"><option>1</option><option>5</option><option selected>10</option><option>20</option><option>50</option></select><select id="admCodePlan" class="member-input"><option value="single">深度解读 0.99</option><option value="light" selected>轻会员 6.90</option><option value="plus">星夜会员 12.90</option></select><button class="btn primary" id="btnGenCodes">生成</button></div></section>
      <section class="referral-box"><h3>卡密列表</h3><div class="auth-tabs" id="codeFilter" style="margin-bottom:10px"><button class="auth-tab ${adminCodeFilter==="unused"?"sel":""}" data-st="unused">未用</button><button class="auth-tab ${adminCodeFilter==="used"?"sel":""}" data-st="used">已用</button><button class="auth-tab ${adminCodeFilter===""?"sel":""}" data-st="">全部</button></div><textarea class="member-input" id="admCodeBox" rows="7" readonly placeholder="生成的卡密会显示在这里，发给买家输入激活即可">${codes}</textarea><div class="btn-row"><button class="btn ghost" id="btnCopyCodes">复制全部</button></div></section>`;
      body.querySelectorAll("#codeFilter .auth-tab").forEach(btn=>btn.onclick=()=>{adminCodeFilter=btn.dataset.st;loadAdminTab();});
      $("btnGenCodes").onclick=async()=>{
        try{
          const rr=await sbRpc("admin_generate_codes",{p_token:token,p_count:Number($("admCodeCount").value),p_plan:$("admCodePlan").value});
          if(!rr||rr.ok===false) throw new Error("生成失败");
          const box=$("admCodeBox");
          const codes2=(rr.codes||[]).join("\n");
          box.value=box.value?(box.value.replace(/\n$/,"")+"\n"+codes2):codes2;
          showToast(`已生成 ${(rr.codes||[]).length} 个${$("admCodePlan").selectedOptions[0].text}卡密`);
        }catch(e){ showToast(e.message); }
      };
      $("btnCopyCodes").onclick=()=>copyText($("admCodeBox").value).then(()=>showToast("已复制"));
    }else if(adminTab==="settings"){
      const r=await sbRpc("admin_get_settings",{p_token:token});
      if(!r||r.ok===false) throw new Error(r?.reason==="forbidden"?"无权限":"加载失败");
      const s=r.settings||{};
      body.innerHTML=`<form class="api-form" id="admSettingsForm"><label>现金返利比例（0-1，如 0.3 = 30%）<input id="admRate" value="${escapeHtml(s.rebate_rate||"0.3")}"></label><label>好友首单立减（元）<input id="admDiscount" value="${escapeHtml(s.discount||"0.5")}"></label><div class="btn-row"><button class="btn primary" type="submit">保存设置</button></div></form>`;
      $("admSettingsForm").onsubmit=async e=>{
        e.preventDefault();
        try{
          const rate=$("admRate").value.trim(), disc=$("admDiscount").value.trim();
          if(!/^\d+(\.\d+)?$/.test(rate)||! /^\d+(\.\d+)?$/.test(disc)){ throw new Error("请输入数字"); }
          await sbRpc("admin_set_setting",{p_token:token,p_key:"rebate_rate",p_value:rate});
          await sbRpc("admin_set_setting",{p_token:token,p_key:"discount",p_value:disc});
          showToast("设置已保存");
        }catch(err){ showToast(err.message); }
      };
    }else if(adminTab==="logs"){
      const r=await sbRpc("admin_list_logs",{p_token:token});
      if(!r||r.ok===false) throw new Error(r?.reason==="forbidden"?"无权限":"加载失败");
      const ACT={set_credits:"调整额度",order_paid:"标记订单已支付",order_cancelled:"退款/取消订单",ban:"封禁账号",unban:"解封账号",set_setting:"修改配置",rebate_status:"结算返利"};
      const rows=(r.list||[]).map(x=>`<div class="admin-row"><div><b>${ACT[x.action]||x.action}</b> · ${escapeHtml(x.target||"")}<div class="od">操作人 ${escapeHtml(x.admin_username)}${x.detail?` · ${escapeHtml(x.detail)}`:""} · ${String(x.created_at||"").slice(0,16).replace("T"," ")}</div></div></div>`).join("");
      body.innerHTML=`<div class="admin-list">${rows||'<p class="modal-sub">暂无操作记录</p>'}</div>`;
    }
  }catch(e){
    body.innerHTML=`<p style="color:#e08a8a;font-size:12px;line-height:1.8">${escapeHtml(e.message)}</p>`;
  }
}
/* 管理员查看某用户额度账本 */
async function showUserLedger(username){
  const body=$("adminBody");
  body.innerHTML=`<div class="pay-wait"><div class="spinner"></div>加载中…</div>`;
  try{
    const r=await sbRpc("admin_list_ledger",{p_token:getSession(),p_username:username});
    if(!r||r.ok===false) throw new Error(r?.reason==="forbidden"?"无权限":"加载失败");
    const REASON={register:"注册奖励",invite:"邀请奖励",admin:"后台调整",purchase:"购买会员",ai:"AI 消耗",refund:"退款"};
    const rows=(r.list||[]).map(x=>`<div class="admin-row"><div><b style="color:${x.delta>=0?'var(--ok)':'#d98a7a'}">${x.delta>0?"+":""}${x.delta} 次</b> · ${REASON[x.reason]||x.reason}${x.note?`<div class="od">${escapeHtml(x.note)}</div>`:""}</div><span class="od">@${escapeHtml(x.username)} · 余额 ${x.balance_after} · ${String(x.created_at||"").slice(0,16).replace("T"," ")}</span></div>`).join("");
    body.innerHTML=`<div class="btn-row" style="margin-bottom:10px"><button class="btn ghost" id="btnLedgerBack">← 返回用户列表</button></div><div class="admin-list">${rows||'<p class="modal-sub">该用户暂无额度变动</p>'}</div>`;
    $("btnLedgerBack").onclick=()=>{ adminTab="users"; loadAdminTab(); };
  }catch(e){ body.innerHTML=`<p style="color:#e08a8a;font-size:12px">${escapeHtml(e.message)}</p>`; }
}

function goHome(){
  stopCylinder();
  state={spread:"single",drawn:[],flipped:0,question:"",fan:[]};
  $("questionInput").value="";
  $("reportBtnRow").classList.add("hidden");
  closeModal();
  goStage(0);
}
$("btnDaily").onclick=()=>{track("open_daily_draw");openModal("daily");}; $("btnHistory").onclick=()=>{track("open_history");openModal("history");}; $("btnDict").onclick=()=>{track("open_dictionary");openModal("dict");}; $("btnNumStyle").onclick=()=>{ const next=document.documentElement.getAttribute("data-numstyle")==="poker"?"hide":"poker"; localStorage.setItem(NUM_STYLE_KEY,next); applyNumStyle(); showToast(next==="poker"?"牌面已切换为扑克牌数字样式":"牌面数字已隐藏"); }; $("btnMember").onclick=openMemberBilling; $("btnPromo").onclick=openPromotionSecure; $("btnAccount").onclick=openAccount; $("btnAiReport").onclick=generateAiReportV2; $("btnVipCta").onclick=openMemberBilling; $("btnCopyInvite").onclick=async()=>{
  if(getSession()){
    const acc=await refreshAccount();
    if(acc&&acc.ref_code){ track("invite_copy", { ref_code: acc.ref_code }); copyText(promoLinkFor(acc.ref_code)).then(()=>showToast("邀请链接已复制，快去分享吧 ✦")).catch(()=>showToast("复制失败，请到「推广活动」页复制")); }
    else{ showToast("正在同步账号信息，请稍后再试"); }
  }else{
    openAccount(); showToast("注册登录后即可生成专属邀请链接");
  }
}; $("btnClaimNewbie").onclick=openAccount; $("btnHome").onclick=goHome; $("btnCloseModal").onclick=closeModal; $("toolModal").onclick=e=>{if(e.target===$("toolModal"))closeModal();};

/* init */
buildDeck();
bindNumToggles();
applyNumStyle();
updateMemberBadge();
updateNewbieBanner();
if(getSession()){ refreshAccount(); ensureEntitlementMerged(); }        // 恢复登录态：同步账号额度与昵称 + 合并设备VIP权益
else if(sbConfigured()){ showAuthGate(); }   // 未登录：全屏登录墙
if(autoPayEnabled()){
  /* 易支付付款后跳回本站 ?pay=return&order=xxx：自动确认并同步权益 */
  const payParams=new URLSearchParams(location.search);
  const payOrder=payParams.get("order");
  if(payParams.get("pay")==="return" && payOrder){
    const ref=payParams.get("ref");
    history.replaceState(null,"",location.pathname+(ref?`?ref=${encodeURIComponent(ref)}`:"")+location.hash);
    const last=readLocalOrder()||{};
    openMemberCheckout({step:"waiting",planId:last.planId||"single",method:last.method||"wechat",orderNo:payOrder});
    showToast("正在确认支付结果…");
  }
}
if(location.hash.startsWith("#r=")){ const shared=decodePayload(location.hash.slice(3)); if(payloadToState(shared)){ goStage(4); renderReport(); } }
if(location.hash==="#admin"){ openAdmin(); }
