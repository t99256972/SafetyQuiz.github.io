// Safety Quiz practice app — plain JS, works offline from file://
// Data comes from data/questions.js (window.SQ_DATA).
(() => {
'use strict';

const DATA = window.SQ_DATA;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LETTERS = ['A', 'B', 'C', 'D'];
const BY_ID = Object.fromEntries(DATA.questions.map(q => [q.id, q]));
const CH_NAME = Object.fromEntries(DATA.chapters.map(c => [c.n, c.name]));

// ---------- saved settings / history / wrong book (localStorage, per browser) ----------
const store = {
  get(k, d){ try { const v = localStorage.getItem('sq.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v){ try { localStorage.setItem('sq.' + k, JSON.stringify(v)); } catch (e) {} },
  del(k){ try { localStorage.removeItem('sq.' + k); } catch (e) {} },
};
const DEFAULTS = {
  chapters: DATA.chapters.map(c => c.n),  // all chapters
  count: 50,
  mode: 'practice',                       // practice = answer shown after each question; exam = at the end
  timer: 'question',                      // off | question | total
  perQ: 20,                               // seconds per question
  totalMin: 30,                           // minutes for the whole quiz
  shuffleQ: true,
  shuffleO: true,
  autoNext: false,
  onlyWrong: false,
};
let S = {...DEFAULTS, ...store.get('settings', {})};
let wrongBook = store.get('wrong', {});    // id -> times wrong
let history = store.get('history', []);    // recent results

// ---------- setup screen ----------
$('srcLine').textContent = `題庫：${DATA.source} · ${DATA.questions.length} 題 · checked ${DATA.checked}`;

function renderChapters(){
  $('chapters').innerHTML = DATA.chapters.map(c => {
    const on = S.chapters.includes(c.n);
    return `<label class="chip${on ? ' on' : ''}"><input type="checkbox" data-ch="${c.n}"${on ? ' checked' : ''}>
      <span class="n">${c.n}</span><span>${esc(c.name)}</span><span class="c">${c.count}</span></label>`;
  }).join('');
}
$('chapters').addEventListener('change', e => {
  const n = +e.target.dataset.ch; if (!n) return;
  S.chapters = e.target.checked ? [...new Set([...S.chapters, n])].sort((a, b) => a - b) : S.chapters.filter(x => x !== n);
  saveSettings(); renderChapters(); renderSetup();
});
$('chAll').onclick = () => { S.chapters = DATA.chapters.map(c => c.n); saveSettings(); renderChapters(); renderSetup(); };
$('chNone').onclick = () => { S.chapters = []; saveSettings(); renderChapters(); renderSetup(); };

function segBind(id, key, parse){
  $(id).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    S[key] = parse ? parse(b.dataset.v) : b.dataset.v; saveSettings(); renderSetup();
  });
}
segBind('countSeg', 'count', v => v === 'all' ? 'all' : +v);
segBind('modeSeg', 'mode');
segBind('timerSeg', 'timer');
$('count').addEventListener('input', e => { const v = parseInt(e.target.value, 10); if (v > 0) { S.count = v; saveSettings(); renderSetup(false); } });
$('perQ').addEventListener('input', e => { const v = parseInt(e.target.value, 10); if (v >= 3) { S.perQ = v; saveSettings(); } });
$('totalMin').addEventListener('input', e => { const v = parseInt(e.target.value, 10); if (v >= 1) { S.totalMin = v; saveSettings(); } });
['shuffleQ', 'shuffleO', 'autoNext', 'onlyWrong'].forEach(k => $(k).addEventListener('change', e => { S[k] = e.target.checked; saveSettings(); renderSetup(); }));
$('resetDefaults').onclick = () => { S = {...DEFAULTS}; saveSettings(); renderChapters(); renderSetup(); };
$('clearData').onclick = () => {
  if (!confirm('Clear your result history and wrong-answer book?')) return;
  wrongBook = {}; history = []; store.del('wrong'); store.del('history'); renderSetup();
};

function saveSettings(){ store.set('settings', S); }
function pool(){
  return DATA.questions.filter(q => S.chapters.includes(q.ch) && (!S.onlyWrong || wrongBook[q.id]));
}
function renderSetup(syncCount = true){
  const P = pool(), n = S.count === 'all' ? P.length : Math.min(S.count, P.length);
  document.querySelectorAll('#countSeg button').forEach(b => b.classList.toggle('on', String(S.count) === b.dataset.v));
  if (syncCount) $('count').value = S.count === 'all' ? P.length : S.count;
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', S.mode === b.dataset.v));
  $('modeHint').textContent = S.mode === 'practice' ? 'See the answer right after each question.' : 'No answers until the end — like the real competition.';
  document.querySelectorAll('#timerSeg button').forEach(b => b.classList.toggle('on', S.timer === b.dataset.v));
  $('perQWrap').hidden = S.timer !== 'question'; $('totalWrap').hidden = S.timer !== 'total';
  $('perQ').value = S.perQ; $('totalMin').value = S.totalMin;
  ['shuffleQ', 'shuffleO', 'autoNext', 'onlyWrong'].forEach(k => $(k).checked = S[k]);
  $('autoNext').disabled = S.mode !== 'practice';
  const wc = Object.keys(wrongBook).length;
  $('wrongCount').textContent = wc;
  $('poolNote').textContent = P.length ? `${n} of ${P.length} available questions` : (S.onlyWrong && !wc ? 'Your wrong-answer book is empty.' : 'Pick at least one chapter.');
  $('start').disabled = !P.length;
  $('history').innerHTML = history.length ? history.slice(0, 10).map(h =>
    `<div class="hrow"><span class="pct" style="color:${h.pct >= 70 ? 'var(--good)' : h.pct >= 50 ? 'var(--warn)' : 'var(--bad)'}">${h.pct}%</span>
     <span>${h.right}/${h.total} · ${esc(h.label)}</span><span class="d">${esc(h.date)}</span></div>`).join('')
    : '<div class="empty">No results yet.</div>';
}

// ---------- quiz ----------
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
let Z = null;   // current quiz state
let tick = null;

function startQuiz(questions, retry = false){
  const n = S.count === 'all' ? questions.length : Math.min(S.count, questions.length);
  let list = S.shuffleQ ? shuffle(questions) : [...questions].sort((a, b) => a.ch - b.ch || a.id.localeCompare(b.id, undefined, {numeric: true}));
  list = list.slice(0, n).map(q => {
    // options that refer to each other ("以上兩者皆是") keep their printed order
    const order = S.shuffleO && !q.k ? shuffle([0, 1, 2]) : [0, 1, 2];
    return {q, order, pick: null, timedOut: false};
  });
  Z = {items: list, i: 0, mode: S.mode, timer: S.timer, perQ: S.perQ, start: Date.now(),
       deadline: S.timer === 'total' ? Date.now() + S.totalMin * 60000 : null, done: false,
       label: labelFor(retry ? list.map(x => x.q.ch) : S.chapters, retry)};
  show('quiz'); renderQ();
}
function labelFor(chList, retry){
  const chs = [...new Set(chList)];
  const base = chs.length === 1 ? `Ch ${chs[0]} ${CH_NAME[chs[0]]}` : chs.length === DATA.chapters.length ? 'All chapters' : `${chs.length} chapters`;
  return (S.onlyWrong ? 'Wrong book · ' : '') + base + (retry ? ' · retry' : '');
}

function renderQ(){
  const it = Z.items[Z.i], q = it.q, answered = it.pick != null || it.timedOut;
  it.seen = true;
  const reveal = Z.mode === 'practice' && answered;
  $('qTag').textContent = `第${q.ch}章 ${CH_NAME[q.ch]}`;
  $('qId').textContent = `${q.id} · 手冊 p.${q.p}`;
  $('qText').textContent = q.q;
  $('opts').innerHTML = it.order.map((oi, pos) => {
    let cls = 'opt';
    if (reveal) { if (oi === q.a) cls += ' right'; else if (oi === it.pick) cls += ' wrong'; }
    else if (oi === it.pick) cls += ' sel';
    return `<button class="${cls}" data-oi="${oi}"${reveal ? ' disabled' : ''}><span class="l">${LETTERS[pos]}</span><span>${esc(q.o[oi])}</span></button>`;
  }).join('');
  const fb = $('feedback');
  if (reveal) {
    const ok = it.pick === q.a, pos = it.order.indexOf(q.a);
    fb.hidden = false; fb.className = 'feedback ' + (ok ? 'ok' : 'no');
    fb.textContent = ok ? '✓ Correct' : `${it.timedOut ? '⏱ Time up' : '✗ Wrong'} — answer: ${LETTERS[pos]}. ${q.o[q.a]}`;
  } else fb.hidden = true;
  $('prev').hidden = Z.mode !== 'exam' || Z.i === 0;
  $('next').textContent = Z.i === Z.items.length - 1 ? 'Finish' : 'Next →';
  $('next').disabled = Z.mode === 'practice' && !answered;
  const right = Z.items.filter(x => x.pick === x.q.a).length, seen = Z.items.filter(x => x.pick != null || x.timedOut).length;
  $('progText').textContent = `${Z.i + 1} / ${Z.items.length}`;
  $('progFill').style.width = (Z.i / Z.items.length * 100) + '%';
  $('scoreText').textContent = Z.mode === 'practice' ? `✓ ${right} / ${seen}` : '';
  startTimer(answered);
}

function startTimer(answered){
  clearInterval(tick); tick = null;
  if (Z.timer === 'off') { $('timer').hidden = true; return; }
  $('timer').hidden = false;
  const it = Z.items[Z.i];
  if (Z.timer === 'question') {
    if (answered && Z.mode === 'practice') { drawTimer(it.left ?? 0, Z.perQ); return; }
    if (it.left == null) it.left = Z.perQ;
    if (it.left <= 0) { drawTimer(0, Z.perQ); return; }  // already timed out (exam mode, came back)
    let end = Date.now() + it.left * 1000;
    const step = () => {
      it.left = Math.max(0, (end - Date.now()) / 1000); drawTimer(it.left, Z.perQ);
      if (it.left <= 0) { clearInterval(tick); timeUp(); }
    };
    step(); tick = setInterval(step, 100);
  } else {
    const total = S.totalMin * 60;
    const step = () => {
      const left = Math.max(0, (Z.deadline - Date.now()) / 1000); drawTimer(left, total);
      if (left <= 0) { clearInterval(tick); finish(); }
    };
    step(); tick = setInterval(step, 250);
  }
}
function drawTimer(left, total){
  const s = Math.ceil(left);
  $('timerText').textContent = s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
  $('timerFill').style.width = (left / total * 100) + '%';
  $('timer').classList.toggle('low', left <= Math.min(5, total * 0.2) || (total > 120 && left <= 60));
}
function timeUp(){
  const it = Z.items[Z.i];
  if (it.pick == null) it.timedOut = true;
  if (Z.mode === 'practice') renderQ(); else next();
}

function choose(oi){
  if (Z.done) return;
  const it = Z.items[Z.i], answered = it.pick != null || it.timedOut;
  if (Z.mode === 'practice' && answered) return;
  it.pick = oi; it.timedOut = false;
  if (Z.mode === 'practice') {
    clearInterval(tick); renderQ();
    if (S.autoNext && oi === it.q.a) setTimeout(() => { if (Z && !Z.done && Z.items[Z.i] === it) next(); }, 700);
  } else renderQ();
}
function next(){
  clearInterval(tick);
  if (Z.i < Z.items.length - 1) { Z.i++; renderQ(); } else finish();
}
$('opts').addEventListener('click', e => { const b = e.target.closest('.opt'); if (b && !b.disabled) choose(+b.dataset.oi); });
$('next').onclick = next;
$('prev').onclick = () => { clearInterval(tick); if (Z.i > 0) { Z.i--; renderQ(); } };
$('quit').onclick = () => {
  if (!confirm('End this quiz now? Only the questions you have reached will be scored.')) return;
  const it = Z.items[Z.i], keep = Z.i + (it.pick != null || it.timedOut ? 1 : 0);
  if (!keep) { clearInterval(tick); Z.done = true; renderSetup(); show('setup'); return; }
  Z.items = Z.items.slice(0, keep); Z.endedEarly = true; finish();
};
document.addEventListener('keydown', e => {
  if ($('quiz').hidden || !Z || Z.done || e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase(), pos = {a: 0, b: 1, c: 2, '1': 0, '2': 1, '3': 2}[k];
  if (pos != null) { const it = Z.items[Z.i]; choose(it.order[pos]); e.preventDefault(); }
  else if ((k === 'enter' || k === 'arrowright') && !$('next').disabled) { next(); e.preventDefault(); }
  else if (k === 'arrowleft' && !$('prev').hidden) { $('prev').click(); e.preventDefault(); }
});

// ---------- results ----------
function finish(){
  clearInterval(tick); Z.done = true;
  const items = Z.items, right = items.filter(x => x.pick === x.q.a).length;
  const pct = Math.round(right / items.length * 100), secs = Math.round((Date.now() - Z.start) / 1000);
  // wrong book: add misses, remove questions answered correctly
  items.forEach(x => { if (x.pick === x.q.a) delete wrongBook[x.q.id]; else if (x.seen) wrongBook[x.q.id] = (wrongBook[x.q.id] || 0) + 1; });
  store.set('wrong', wrongBook);
  const d = new Date();
  history.unshift({pct, right, total: items.length, label: Z.label, date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`});
  history = history.slice(0, 50); store.set('history', history);

  $('resScore').textContent = `${right} / ${items.length} · ${pct}%`;
  $('resScore').style.color = pct >= 70 ? 'var(--good)' : pct >= 50 ? 'var(--warn)' : 'var(--bad)';
  const missed = items.filter(x => x.pick == null).length;
  $('resSub').textContent = `Time used ${Math.floor(secs / 60)}m ${secs % 60}s` + (missed ? ` · ${missed} not answered` : '') + (Z.endedEarly ? ' · ended early' : '') + ` · ${Z.label}`;
  const byCh = {};
  items.forEach(x => { const c = byCh[x.q.ch] ||= {r: 0, t: 0}; c.t++; if (x.pick === x.q.a) c.r++; });
  $('byChapter').innerHTML = Object.entries(byCh).sort((a, b) => a[0] - b[0]).map(([ch, c]) =>
    `<div class="bc"><span>${ch}. ${esc(CH_NAME[ch])}</span><div class="bar"><div style="width:${c.r / c.t * 100}%"></div></div><span class="v">${c.r}/${c.t}</span></div>`).join('');
  $('retryWrong').disabled = right === items.length;
  $('showAllReview').checked = false;
  renderReview();
  show('result');
}
function renderReview(){
  const all = $('showAllReview').checked, items = Z.items.filter(x => all || x.pick !== x.q.a);
  $('reviewCount').textContent = `(${Z.items.filter(x => x.pick !== x.q.a).length} wrong)`;
  $('review').innerHTML = items.length ? items.map(x => {
    const q = x.q, ok = x.pick === q.a;
    const li = x.order.map((oi, pos) => `<li class="${oi === q.a ? 'c' : oi === x.pick ? 'x' : ''}">${LETTERS[pos]}. ${esc(q.o[oi])}</li>`).join('');
    const note = x.pick == null ? (x.timedOut ? 'time up' : 'not answered') : ok ? 'correct' : 'your answer crossed out';
    return `<div class="rv${ok ? ' ok' : ''}"><div class="rm">${q.id} · 第${q.ch}章 ${esc(CH_NAME[q.ch])} · 手冊 p.${q.p} · ${note}</div>
      <div class="rq">${esc(q.q)}</div><ul type="none">${li}</ul></div>`;
  }).join('') : '<div class="empty">All correct — nothing to review.</div>';
}
$('showAllReview').onchange = renderReview;
$('retryWrong').onclick = () => {
  const qs = Z.items.filter(x => x.pick !== x.q.a).map(x => x.q);
  const saved = S.count; S.count = 'all'; startQuiz(qs, true); S.count = saved;
};
$('again').onclick = () => startQuiz(pool());
$('toSetup').onclick = () => { renderSetup(); show('setup'); };

function show(id){
  ['setup', 'quiz', 'result'].forEach(s => $(s).hidden = s !== id);
  window.scrollTo(0, 0);
}
$('start').onclick = () => startQuiz(pool());

renderChapters(); renderSetup();
})();
