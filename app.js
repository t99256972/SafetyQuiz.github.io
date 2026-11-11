// 職安健常識問答 practice, standalone build.
// Question bank: OSHC Safety Quiz Handbook 2026, loaded from data/bank.js as window.SAFETY_BANK.
// The passcode is a front-end gate, not security.
// Every screen is sized to the viewport so a phone never has to scroll the page.
(function () {
  "use strict";

  var PASS = "tnd";
  var KEY = { gate: "safety_quiz_access_ok", settings: "safety_quiz_settings", wrong: "safety_quiz_wrong", history: "safety_quiz_history" };
  var LETTERS = ["A", "B", "C"];
  var ALL_CH = Array.from({ length: 20 }, function (_, i) { return i + 1; });
  var DEFAULTS = {
    chapters: ALL_CH, count: 50, mode: "practice", timer: "question",
    perQ: 20, totalMin: 30, shuffleQ: true, shuffleO: true, autoNext: false, onlyWrong: false
  };

  // ---------- storage, always wrapped so a blocked localStorage never breaks the page ----------
  function load(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  function gateSeen() { try { return localStorage.getItem(KEY.gate) === "1"; } catch (e) { return false; } }
  function gateRemember() { try { localStorage.setItem(KEY.gate, "1"); } catch (e) { /* storage blocked */ } }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function answered(it) { return it.pick !== null || it.timedOut; }
  function pctColor(p) { return p >= 70 ? "c-green" : p >= 50 ? "c-amber" : "c-red"; }
  function fmtTime(s) { s = Math.ceil(s); return s >= 60 ? Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") : s + "s"; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function asObject(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }

  // ---------- state ----------
  var root = document.getElementById("app");
  var bank = window.SAFETY_BANK && Array.isArray(window.SAFETY_BANK.questions) && Array.isArray(window.SAFETY_BANK.chapters) ? window.SAFETY_BANK : null;
  var gateOpen = !gateSeen();
  var S = Object.assign({}, DEFAULTS, asObject(load(KEY.settings, {})));
  if (!Array.isArray(S.chapters)) S.chapters = ALL_CH;
  var wrong = asObject(load(KEY.wrong, {}));
  var history = load(KEY.history, []);
  if (!Array.isArray(history)) history = [];
  var sheet = false;
  var showAll = false;
  var Z = null;            // the running quiz
  var screen = "setup";    // setup | quiz | result
  var tickId = null, lastTick = 0;

  function set(patch) { S = Object.assign({}, S, patch); save(KEY.settings, S); render(); }
  function chName(n) { var c = bank && bank.chapters.find(function (x) { return x.n === n; }); return c ? c.name : ""; }
  function getPool() { return bank ? bank.questions.filter(function (q) { return S.chapters.indexOf(q.ch) >= 0 && (!S.onlyWrong || wrong[q.id]); }) : []; }
  // Wrong-book ids carried over from an older bank may no longer exist; count only live ones.
  function getWrongCount() { return bank ? bank.questions.filter(function (q) { return wrong[q.id]; }).length : Object.keys(wrong).length; }
  function rightCount(items) { return items.filter(function (x) { return x.pick === x.q.a; }).length; }

  // ---------- quiz engine ----------
  function finish() {
    var z = Z; if (!z || z.done) return;
    z.done = true; z.end = Date.now();
    var items = z.items, right = rightCount(items);
    var pct = Math.round((right / items.length) * 100);
    var w = Object.assign({}, wrong);
    items.forEach(function (x) { if (x.pick === x.q.a) delete w[x.q.id]; else if (x.seen) w[x.q.id] = (w[x.q.id] || 0) + 1; });
    wrong = w; save(KEY.wrong, wrong);
    var d = new Date(), p2 = function (v) { return String(v).padStart(2, "0"); };
    history = [{
      pct: pct, right: right, total: items.length, label: z.label,
      date: d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes())
    }].concat(history).slice(0, 50);
    save(KEY.history, history);
    showAll = false; screen = "result"; render();
  }

  function next() {
    var z = Z; if (!z || z.done) return;
    if (z.i < z.items.length - 1) { z.i++; z.items[z.i].seen = true; render(); } else finish();
  }

  function startQuiz(questions, retry) {
    if (!bank || !questions.length) return;
    var n = retry || S.count === "all" ? questions.length : Math.min(S.count, questions.length);
    var ordered = S.shuffleQ ? shuffle(questions) : questions.slice().sort(function (a, b) {
      return a.ch - b.ch || a.id.localeCompare(b.id, undefined, { numeric: true });
    });
    // options that refer to each other ("以上兩者皆是") keep their printed order
    var list = ordered.slice(0, n).map(function (q) {
      return { q: q, order: S.shuffleO && !q.k ? shuffle([0, 1, 2]) : [0, 1, 2], pick: null, timedOut: false, left: null, seen: false };
    });
    list[0].seen = true;
    var chs = retry ? Array.from(new Set(list.map(function (x) { return x.q.ch; }))) : S.chapters;
    var base = chs.length === 1 ? "第" + chs[0] + "章 " + chName(chs[0]) : chs.length === bank.chapters.length ? "全部章節" : chs.length + " 章";
    Z = {
      items: list, i: 0, mode: S.mode, timer: S.timer, perQ: S.perQ, totalSec: S.totalMin * 60, start: Date.now(), end: 0,
      deadline: S.timer === "total" ? Date.now() + S.totalMin * 60000 : null,
      label: (S.onlyWrong && !retry ? "錯題 · " : "") + base + (retry ? " · 重做錯題" : ""), done: false, endedEarly: false
    };
    screen = "quiz"; lastTick = Date.now(); render();
  }

  function choose(oi) {
    var z = Z; if (!z || z.done) return;
    var it = z.items[z.i];
    if (z.mode === "practice" && answered(it)) return;
    it.pick = oi; it.timedOut = false; render();
    if (z.mode === "practice" && S.autoNext && oi === it.q.a) {
      setTimeout(function () { if (Z === z && !z.done && z.items[z.i] === it) next(); }, 700);
    }
  }
  function back() { var z = Z; if (z && z.i > 0) { z.i--; render(); } }
  function endEarly() {
    var z = Z; if (!z) return;
    if (!confirm("End this quiz now? Only the questions you have reached are scored.")) return;
    var keep = z.i + (answered(z.items[z.i]) ? 1 : 0);
    if (!keep) { z.done = true; Z = null; screen = "setup"; render(); return; }
    z.items = z.items.slice(0, keep); z.endedEarly = true; finish();
  }

  // countdown: one ticking interval while a quiz is running. A tick only touches the
  // timer elements, so a tap on an option is never lost to a redraw.
  function tick() {
    var z = Z; if (!z || z.done) return;
    var now = Date.now(), dt = (now - lastTick) / 1000; lastTick = now;
    if (z.timer === "question") {
      var it = z.items[z.i];
      var cur = it.left == null ? z.perQ : it.left;
      var running = !it.timedOut && !(z.mode === "practice" && it.pick !== null) && cur > 0;
      if (running) {
        it.left = Math.max(0, cur - dt);
        if (it.left <= 0) {
          if (it.pick === null) it.timedOut = true;
          if (z.mode === "exam") { next(); return; }
          render(); return;
        }
      }
    } else if (z.timer === "total" && z.deadline && now >= z.deadline) { finish(); return; }
    updateTimer();
  }
  function syncTicker() {
    if (screen === "quiz" && !tickId) { lastTick = Date.now(); tickId = setInterval(tick, 200); }
    else if (screen !== "quiz" && tickId) { clearInterval(tickId); tickId = null; }
  }
  function timerState() {
    var z = Z, it = z.items[z.i];
    var left = z.timer === "question" ? (it.left == null ? z.perQ : it.left) : z.timer === "total" && z.deadline ? Math.max(0, (z.deadline - Date.now()) / 1000) : 0;
    var total = z.timer === "question" ? z.perQ : z.totalSec;
    var low = z.timer !== "off" && (left <= Math.min(5, total * 0.2) || (total > 120 && left <= 60));
    return { left: left, total: total, low: low };
  }
  function updateTimer() {
    var el = document.getElementById("sq-timer");
    if (!el || !Z || screen !== "quiz") return;
    var t = timerState();
    el.classList.toggle("low", t.low);
    el.firstElementChild.textContent = fmtTime(t.left);
    document.getElementById("sq-timer-bar").style.width = (t.left / t.total) * 100 + "%";
  }

  // keyboard: A/B/C or 1/2/3, Enter/right arrow next, left arrow back
  window.addEventListener("keydown", function (e) {
    if (screen !== "quiz") return;
    var z = Z; if (!z || z.done) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key.toLowerCase(), pos = { a: 0, b: 1, c: 2, "1": 0, "2": 1, "3": 2, z: 0 , x: 2 }[k];
    var it = z.items[z.i];
    if (pos !== undefined) { choose(it.order[pos]); e.preventDefault(); }
    else if ((k === "enter" || k === "arrowright") && (z.mode === "exam" || answered(it))) { next(); e.preventDefault(); }
    else if (k === "arrowleft" && z.mode === "exam") { back(); e.preventDefault(); }
  });

  // ---------- small UI pieces ----------
  function seg(name, value, options) {
    return '<div class="seg">' + options.map(function (o) {
      return '<button data-act="seg" data-k="' + name + '" data-v="' + o[0] + '" class="' + (value === o[0] ? "on" : "") + '">' + esc(o[1]) + "</button>";
    }).join("") + "</div>";
  }
  function toggle(name, on, label, disabled) {
    return '<button data-act="toggle" data-k="' + name + '" class="toggle' + (on ? " on" : "") + '"' + (disabled ? " disabled" : "") + ">" + (on ? "✓ " : "") + esc(label) + "</button>";
  }
  function stepper(name, value, min, max, step, unit) {
    var a = ' data-k="' + name + '" data-min="' + min + '" data-max="' + max + '"';
    return '<div class="stepper">' +
      '<button data-act="step"' + a + ' data-d="' + -step + '" aria-label="less">−</button>' +
      "<span>" + value + " " + unit + "</span>" +
      '<button data-act="step"' + a + ' data-d="' + step + '" aria-label="more">+</button></div>';
  }

  // ---------- screens ----------
  function viewGate() {
    return '<div class="page"><div class="overlay"><div class="gate-card">' +
      '<div class="gate-title">Enter passcode</div>' +
      '<input id="sq-pass" class="gate-input" placeholder="Passcode" type="password" autocomplete="off" autocapitalize="off">' +
      '<div class="gate-row"><span id="sq-pass-err" class="gate-err"></span><button data-act="unlock" class="btn-black">Unlock</button></div>' +
      '<div class="gate-note">First-time access lock. Passcode required.</div>' +
      "</div></div></div>";
  }

  function viewNoBank() {
    return '<div class="page"><div class="center-msg">Could not load the question bank. Make sure data/bank.js sits next to index.html, then reload.</div></div>';
  }

  // quiz: full screen, nothing to scroll; Next sits at the bottom away from the options
  function viewQuiz() {
    var z = Z, it = z.items[z.i], q = it.q, done = answered(it), reveal = z.mode === "practice" && done;
    var right = rightCount(z.items), seen = z.items.filter(answered).length;
    var long = q.q.length > 90 || q.o.some(function (o) { return o.length > 40; });
    var h = '<div class="full"><div class="q-top">' +
      '<button data-act="end" class="btn-end">✕ End</button>' +
      '<div class="q-prog"><div class="nums"><span>' + (z.i + 1) + " / " + z.items.length + "</span>" +
      (z.mode === "practice" ? '<span class="score">✓ ' + right + " / " + seen + "</span>" : "") + "</div>" +
      '<div class="bar"><div style="width:' + (z.i / z.items.length) * 100 + '%"></div></div></div>';
    if (z.timer !== "off") h += '<div id="sq-timer" class="q-timer"><span></span><div class="bar"><div id="sq-timer-bar"></div></div></div>';
    h += "</div>";

    h += '<div id="sq-body" class="q-body" data-keep="q' + z.i + '">' +
      '<div class="q-meta"><span class="chip">第' + q.ch + "章 " + esc(chName(q.ch)) + "</span><span>" + esc(q.id) + " · 手冊 p." + esc(q.p) + "</span></div>" +
      '<h2 class="q-text' + (long ? " long" : "") + '">' + esc(q.q) + "</h2>" +
      '<div class="opts">';
    it.order.forEach(function (oi, pos) {
      var cls = "";
      if (reveal && oi === q.a) cls = " right";
      else if (reveal && oi === it.pick) cls = " wrong";
      else if (!reveal && oi === it.pick) cls = " picked";
      h += '<button data-act="choose" data-v="' + oi + '" class="opt' + (long ? " long" : "") + cls + '"' + (reveal ? " disabled" : "") + ">" +
        '<span class="dot">' + LETTERS[pos] + '</span><span class="txt">' + esc(q.o[oi]) + "</span></button>";
    });
    h += "</div>";
    if (reveal) {
      var ok = it.pick === q.a;
      h += '<div class="feedback ' + (ok ? "ok" : "bad") + '">' +
        (ok ? "✓ 答對 Correct" : (it.timedOut ? "⏱ 時間到 Time up" : "✗ 答錯 Wrong") + ", 答案 " + LETTERS[it.order.indexOf(q.a)] + ". " + esc(q.o[q.a])) + "</div>";
    }
    h += "</div>";

    h += '<div class="q-foot">' +
      (z.mode === "exam" ? '<button data-act="back" class="btn-back"' + (z.i === 0 ? " disabled" : "") + ">←</button>" : "") +
      '<button data-act="next" class="btn-next"' + (z.mode === "practice" && !done ? " disabled" : "") + ">" +
      (z.i === z.items.length - 1 ? "完成 Finish" : "下一題 Next →") + "</button></div></div>";
    return h;
  }

  // result: summary fixed, review list scrolls inside its own box
  function viewResult() {
    var z = Z, items = z.items, right = rightCount(items), pct = Math.round((right / items.length) * 100);
    var secs = Math.round(((z.end || Date.now()) - z.start) / 1000), missed = items.filter(function (x) { return x.pick === null; }).length;
    var byCh = {};
    items.forEach(function (x) { var c = byCh[x.q.ch] || (byCh[x.q.ch] = { r: 0, t: 0 }); c.t++; if (x.pick === x.q.a) c.r++; });
    var review = items.filter(function (x) { return showAll || x.pick !== x.q.a; });

    var h = '<div class="full"><div class="r-main"><div class="r-card">' +
      '<div class="r-score ' + pctColor(pct) + '">' + right + " / " + items.length + " · " + pct + "%</div>" +
      '<div class="r-sub">' + Math.floor(secs / 60) + "m " + (secs % 60) + "s" + (missed ? " · " + missed + " 未答" : "") + (z.endedEarly ? " · 提早結束" : "") + " · " + esc(z.label) + "</div>" +
      '<div class="r-chs">';
    Object.keys(byCh).sort(function (a, b) { return +a - +b; }).forEach(function (ch) {
      var c = byCh[ch];
      h += '<div class="r-ch"><span class="nm">' + ch + ". " + esc(chName(+ch)) + '</span><div class="hb"><div style="width:' + (c.r / c.t) * 100 + '%"></div></div><span class="ct">' + c.r + "/" + c.t + "</span></div>";
    });
    h += "</div></div>";

    h += '<div class="r-head"><span>Review <span class="n">(' + (items.length - right) + ' wrong)</span></span>' +
      '<button data-act="showall" class="pill">' + (showAll ? "Only wrong" : "Show all") + "</button></div>";
    h += '<div class="r-list" data-keep="review' + (showAll ? "A" : "W") + '">';
    if (review.length) {
      review.forEach(function (x) {
        var ok = x.pick === x.q.a;
        h += '<div class="r-item' + (ok ? " ok" : "") + '"><div class="tag">' + esc(x.q.id) + " · 第" + x.q.ch + "章 · p." + esc(x.q.p) + " · " +
          (x.pick === null ? (x.timedOut ? "時間到" : "未答") : ok ? "答對" : "你的答案已劃線") + "</div>" +
          '<div class="qq">' + esc(x.q.q) + "</div><ul>";
        x.order.forEach(function (oi, pos) {
          h += '<li class="' + (oi === x.q.a ? "ans" : oi === x.pick ? "mine" : "") + '">' + LETTERS[pos] + ". " + esc(x.q.o[oi]) + "</li>";
        });
        h += "</ul></div>";
      });
    } else h += '<div class="r-empty">全部答對, nothing to review.</div>';
    h += "</div></div>";

    h += '<div class="r-foot">' +
      '<button data-act="retry" class="btn-dark"' + (right === items.length ? " disabled" : "") + ">重做錯題</button>" +
      '<button data-act="again" class="lite">再來一次</button>' +
      '<button data-act="setup" class="lite">設定</button></div></div>';
    return h;
  }

  // setup: one screen; chapters open in a sheet
  function viewSetup() {
    var pool = getPool(), wrongCount = getWrongCount();
    var n = S.count === "all" ? pool.length : Math.min(S.count, pool.length);
    var chLabel = S.chapters.length === bank.chapters.length ? "全部 " + bank.chapters.length + " 章"
      : S.chapters.length === 0 ? "未選章節"
      : S.chapters.length <= 2 ? S.chapters.map(function (c) { return c + ". " + chName(c); }).join("、")
      : S.chapters.length + " 章";
    var last = history[0];

    var h = '<div class="page setup"><main class="setup-main">' +
      '<div class="setup-head"><h1>職安健常識問答</h1><span class="xs muted">手冊 ' + esc(bank.edition) + " · " + bank.questions.length + " 題</span></div>" +
      '<div id="sq-setup" class="card" data-keep="setup">';

    h += '<button data-act="sheet-open" class="ch-btn"><span><span class="lbl">章節 Chapters</span><span class="val">' + esc(chLabel) + '</span></span><span class="go">更改 ›</span></button>';

    h += '<div><div class="field-label">題數 Questions <span class="right">' + (pool.length ? n + " / " + pool.length + " 題可用" : "") + "</span></div>" +
      seg("count", S.count, [[10, "10"], [20, "20"], [50, "50"], [100, "100"], ["all", "全部"]]) + "</div>";

    h += '<div><div class="field-label">模式 Mode</div>' +
      seg("mode", S.mode, [["practice", "練習 即時對答案"], ["exam", "考試 完結先睇"]]) + "</div>";

    h += '<div><div class="field-label row"><span>倒數 Countdown</span>' +
      (S.timer === "question" ? stepper("perQ", S.perQ, 5, 120, 5, "秒/題") : "") +
      (S.timer === "total" ? stepper("totalMin", S.totalMin, 5, 180, 5, "分鐘") : "") + "</div>" +
      seg("timer", S.timer, [["off", "關"], ["question", "每題"], ["total", "全卷"]]) + "</div>";

    h += '<div class="row">' + toggle("shuffleQ", S.shuffleQ, "亂序題目") + toggle("shuffleO", S.shuffleO, "亂序ABC") +
      toggle("autoNext", S.autoNext, "自動下一題", S.mode !== "practice") + "</div>";

    h += '<div class="row">' + toggle("onlyWrong", S.onlyWrong, "只做錯題簿 (" + wrongCount + ")", !wrongCount && !S.onlyWrong) +
      '<button data-act="defaults" class="btn-reset">重設預設</button></div>';
    h += "</div>";

    h += '<div class="last-row"><span>' +
      (last ? '上次 <b class="' + pctColor(last.pct) + '">' + esc(last.pct) + "%</b> (" + esc(last.right) + "/" + esc(last.total) + ") · " + esc(last.label) : "未有紀錄") + "</span>" +
      (history.length > 0 || wrongCount > 0 ? '<button data-act="clear">清除紀錄</button>' : "") + "</div>";
    h += '<button data-act="start" class="btn-start"' + (pool.length ? "" : " disabled") + ">開始 Start · " + n + " 題</button></main>";

    if (sheet) {
      h += '<div class="sheet-back" data-act="sheet-close" data-self="1"><div class="sheet">' +
        '<div class="sheet-head"><span>章節 Chapters</span><div class="acts">' +
        '<button data-act="ch-all" class="pill">全選</button><button data-act="ch-none" class="pill">清除</button></div></div>' +
        '<div class="ch-grid" data-keep="sheet">';
      bank.chapters.forEach(function (c) {
        var on = S.chapters.indexOf(c.n) >= 0;
        h += '<button data-act="ch" data-v="' + c.n + '" class="ch-item' + (on ? " on" : "") + '"><span class="box">' + (on ? "✓" : "") +
          '</span><span class="name">' + c.n + ". " + esc(c.name) + '</span><span class="cnt">' + c.count + "</span></button>";
      });
      h += '</div><button data-act="sheet-close" class="btn-dark">完成 · 已選 ' + S.chapters.length + " 章</button></div></div>";
    }
    return h + "</div>";
  }

  function render() {
    var keep = {};
    root.querySelectorAll("[data-keep]").forEach(function (el) { keep[el.getAttribute("data-keep")] = el.scrollTop; });
    var html;
    if (gateOpen) html = viewGate();
    else if (!bank) html = viewNoBank();
    else if (screen === "quiz" && Z) html = viewQuiz();
    else if (screen === "result" && Z) html = viewResult();
    else html = viewSetup();
    root.innerHTML = html;
    root.querySelectorAll("[data-keep]").forEach(function (el) { var v = keep[el.getAttribute("data-keep")]; if (v) el.scrollTop = v; });
    syncTicker();
    updateTimer();
    if (gateOpen) { var p = document.getElementById("sq-pass"); if (p) p.focus(); }
  }

  // ---------- events ----------
  function unlock() {
    var p = document.getElementById("sq-pass"); if (!p) return;
    if (p.value.trim().toLowerCase() === PASS) { gateRemember(); gateOpen = false; render(); }
    else { p.classList.add("err"); document.getElementById("sq-pass-err").textContent = "Wrong passcode"; }
  }
  root.addEventListener("input", function (e) {
    if (e.target.id !== "sq-pass") return;
    e.target.classList.remove("err"); document.getElementById("sq-pass-err").textContent = "";
  });
  root.addEventListener("keydown", function (e) { if (e.target.id === "sq-pass" && e.key === "Enter") unlock(); });

  var actions = {
    unlock: unlock,
    seg: function (el) { var k = el.dataset.k, v = el.dataset.v, p = {}; p[k] = k === "count" && v !== "all" ? +v : v; set(p); },
    toggle: function (el) { var p = {}; p[el.dataset.k] = !S[el.dataset.k]; set(p); },
    step: function (el) { var k = el.dataset.k, p = {}; p[k] = Math.min(+el.dataset.max, Math.max(+el.dataset.min, S[k] + +el.dataset.d)); set(p); },
    defaults: function () { S = Object.assign({}, DEFAULTS); save(KEY.settings, S); render(); },
    clear: function () {
      if (!confirm("Clear your results history and wrong-answer book?")) return;
      history = []; wrong = {}; save(KEY.history, []); save(KEY.wrong, {}); render();
    },
    start: function () { startQuiz(getPool(), false); },
    "sheet-open": function () { sheet = true; render(); },
    "sheet-close": function () { sheet = false; render(); },
    "ch-all": function () { set({ chapters: ALL_CH }); },
    "ch-none": function () { set({ chapters: [] }); },
    ch: function (el) {
      var n = +el.dataset.v, on = S.chapters.indexOf(n) >= 0;
      set({ chapters: on ? S.chapters.filter(function (x) { return x !== n; }) : S.chapters.concat([n]).sort(function (a, b) { return a - b; }) });
    },
    end: endEarly,
    choose: function (el) { choose(+el.dataset.v); },
    next: next,
    back: back,
    showall: function () { showAll = !showAll; render(); },
    retry: function () { startQuiz(Z.items.filter(function (x) { return x.pick !== x.q.a; }).map(function (x) { return x.q; }), true); },
    again: function () { startQuiz(getPool(), false); },
    setup: function () { Z = null; screen = "setup"; render(); }
  };
  root.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]");
    if (!el || !root.contains(el) || el.disabled) return;
    if (el.dataset.self && e.target !== el) return;   // backdrop only closes on a tap outside the sheet
    var fn = actions[el.dataset.act];
    if (fn) fn(el);
  });

  render();
})();
