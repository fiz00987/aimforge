'use strict';

const STORAGE_KEY = 'aimforge-state-v1';
const MONTH_TARGET = 20;

const drills = [
  {
    id: 'warmup', number: '01', name: 'Visual lock-in', short: 'Warm-up', seconds: 120,
    mode: 'Range · Easy bots',
    description: 'Wake up your eyes and hand without spending your focus. Move between targets slowly and make every first shot deliberate.',
    goal: '30 clean first bullets', cue: 'Eyes lead the hand', standard: '0 panic flicks'
  },
  {
    id: 'two-bot-flicks', number: '02', name: 'Two-bot precision flicks', short: 'Flick control', seconds: 300,
    mode: 'Range · 2 bots · Headshots',
    description: 'Your core transfer drill. Alternate between two bots with a full reset after every shot. Speed comes after the crosshair stops cleanly.',
    goal: 'Clean stop before click', cue: 'Flick · settle · fire', standard: '80%+ clean reps'
  },
  {
    id: 'strafe-stop', number: '03', name: 'Strafe-stop one taps', short: 'Movement', seconds: 240,
    mode: 'Range · Strafing bots',
    description: 'Build the tiny pause that makes ranked gunfights predictable. Move, counter-strafe, then take one controlled bullet.',
    goal: 'One bullet per stop', cue: 'Stop before you shoot', standard: 'No spray panic'
  },
  {
    id: 'burst-transfer', number: '04', name: 'Burst transfer', short: 'Target switch', seconds: 300,
    mode: 'Range · Hard bots · 2–3 bullets',
    description: 'Transfer across targets without losing your first-bullet discipline. Misses are information; never chase them with a long spray.',
    goal: 'Fast, short bursts', cue: 'Reset after 3 bullets', standard: 'No autopilot'
  },
  {
    id: 'pressure', number: '05', name: 'Pressure finish', short: 'Clutch precision', seconds: 240,
    mode: 'Range · Hard bots / DM',
    description: 'Finish with a small dose of pressure. Keep your crosshair height and decision speed when the targets feel less comfortable.',
    goal: 'Stay composed late', cue: 'Breathe on every reset', standard: 'Finish with intent'
  }
];

let state = loadState();
let selectedPeriod = 'month';
let timerHandle = null;
let lastTickAt = 0;
let toastHandle = null;

function defaultState() {
  return { history: [], activeSession: null, lastCompletion: null };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.history)) return defaultState();
    return { ...defaultState(), ...saved };
  } catch (error) {
    return defaultState();
  }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { setText('sync-label', 'Session only'); }
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseKey(key) { return new Date(`${key}T12:00:00`); }
function formatDate(key, options = { weekday: 'short', month: 'short', day: 'numeric' }) { return parseKey(key).toLocaleDateString(undefined, options); }
function setText(id, value) { const node = document.getElementById(id); if (node) node.textContent = value; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function totalRoutineSeconds() { return drills.reduce((sum, drill) => sum + drill.seconds, 0); }
function formatClock(seconds) { const safe = Math.max(0, Math.ceil(seconds)); return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`; }
function formatMinutes(seconds) { const minutes = Math.round(seconds / 60); return `${minutes}m`; }

function sessionsForDate(key) { return state.history.filter(item => item.date === key); }
function countForDate(key) { return sessionsForDate(key).length; }
function historyMinutes(history = state.history) { return Math.round(history.reduce((sum, item) => sum + (item.seconds || totalRoutineSeconds()), 0) / 60); }

function currentStreak() {
  const dates = new Set(state.history.map(item => item.date));
  let cursor = new Date();
  if (!dates.has(todayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dates.has(todayKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}

function bestStreak() {
  const dates = [...new Set(state.history.map(item => item.date))].sort();
  let best = 0; let run = 0; let previous = null;
  dates.forEach(date => {
    const current = parseKey(date);
    const consecutive = previous && Math.round((current - previous) / 86400000) === 1;
    run = consecutive ? run + 1 : 1;
    best = Math.max(best, run);
    previous = current;
  });
  return best;
}

function monthHistory() {
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return state.history.filter(item => item.date.startsWith(prefix));
}

function periodHistory(period = selectedPeriod) {
  const year = new Date().getFullYear();
  if (period === 'month') return monthHistory();
  return state.history.filter(item => item.date.startsWith(`${year}-`));
}

function renderStats() {
  const month = monthHistory();
  const minutes = historyMinutes();
  const streak = currentStreak();
  setText('top-streak', streak);
  setText('metric-streak', streak);
  setText('metric-month', month.length);
  setText('metric-minutes', minutes);
  setText('metric-best', bestStreak());
  const progress = document.getElementById('month-progress');
  if (progress) progress.style.width = `${clamp((month.length / MONTH_TARGET) * 100, 0, 100)}%`;
  const active = state.activeSession;
  const done = active ? active.completed.length : 0;
  setText('routine-complete-count', `${done} / ${drills.length}`);
  setText('progress-total-sessions', state.history.length);
  renderPeriodStats();
}

function renderPeriodStats() {
  const history = periodHistory();
  const days = new Set(history.map(item => item.date)).size;
  const now = new Date();
  const calendarDays = selectedPeriod === 'month' ? now.getDate() : (new Date(now.getFullYear(), 11, 31).getDate() === 31 ? 365 : 366);
  setText('period-sessions', history.length);
  setText('period-minutes', formatMinutes(historyMinutes(history) * 60));
  setText('period-days', days);
  setText('period-rate', `${Math.round((days / Math.max(calendarDays, 1)) * 100)}%`);
  setText('period-sessions-note', selectedPeriod === 'month' ? `of ${MONTH_TARGET} target` : 'this calendar year');
  setText('period-days-note', selectedPeriod === 'month' ? 'unique days this month' : 'unique days this year');
}

function renderRoutineList() {
  const container = document.getElementById('routine-list');
  if (!container) return;
  const active = state.activeSession;
  const current = active ? active.currentIndex : 0;
  const completed = active ? active.completed : [];
  container.innerHTML = drills.map((drill, index) => {
    const isDone = completed.includes(index);
    const isActive = Boolean(active && current === index && !isDone);
    const stateClass = isDone ? 'done' : isActive ? 'active' : 'locked';
    const icon = isDone ? '✓' : isActive ? '●' : '⌁';
    return `<div class="routine-step ${stateClass}" aria-label="${drill.name} ${isDone ? 'complete' : isActive ? 'current' : 'locked'}">
      <span class="step-number">${isDone ? icon : drill.number}</span><span class="step-copy"><strong>${drill.short}</strong><small>${formatClock(drill.seconds)} · ${isDone ? 'COMPLETE' : isActive ? 'IN FOCUS' : 'LOCKED'}</small></span><span class="step-lock">${isDone ? '✓' : isActive ? '◆' : '◼'}</span>
    </div>`;
  }).join('');
}

function renderSession() {
  const container = document.getElementById('session-content');
  if (!container) return;
  const active = state.activeSession;
  if (state.lastCompletion && !active) {
    container.innerHTML = `<div class="session-view completed-view"><span class="complete-mark">✓</span><div class="session-topline"><span class="session-tag">ROUTINE COMPLETE</span><span class="session-duration">${formatDate(state.lastCompletion.date)} · ${formatMinutes(state.lastCompletion.seconds)}</span></div><h3>That’s a rep<br><em>worth keeping.</em></h3><p>Your complete routine is logged. Protect the next session by leaving the range while your quality is still high.</p><div class="session-bottom"><button class="primary-btn" id="fresh-session" type="button"><span class="play-icon">↻</span> Start a fresh session</button><span class="secondary-note">The next streak day starts tomorrow.</span></div></div>`;
    document.getElementById('fresh-session').addEventListener('click', startSession);
    return;
  }
  if (!active) {
    const drill = drills[0];
    container.innerHTML = `<div class="session-view"><div class="session-topline"><span class="session-tag">READY WHEN YOU ARE</span><span class="session-duration">${formatClock(totalRoutineSeconds())} TOTAL</span></div><h3>${drill.name}<br><em>then earn the next.</em></h3><p class="session-description">This is a guided block, not a menu. Start the timer and stay on the current drill until it ends. Your next drill will unlock only after the full timer is complete.</p><div class="cue-grid"><div class="cue"><span>GOAL</span><strong>${drill.goal}</strong></div><div class="cue"><span>KEY CUE</span><strong>${drill.cue}</strong></div><div class="cue"><span>STANDARD</span><strong>${drill.standard}</strong></div></div><div class="session-bottom"><button class="primary-btn" id="session-start" type="button"><span class="play-icon">▶</span> Start drill 01</button><span class="locked-note">⌁ <b>Progression is locked</b></span></div></div>`;
    document.getElementById('session-start').addEventListener('click', startSession);
    return;
  }

  const drill = drills[active.currentIndex];
  const isDone = active.completed.includes(active.currentIndex);
  const percent = isDone ? 100 : clamp(((drill.seconds - active.remaining) / drill.seconds) * 100, 0, 100);
  const timerLabel = isDone ? 'COMPLETE' : formatClock(active.remaining);
  const next = drills[active.currentIndex + 1];
  if (isDone) {
    container.innerHTML = `<div class="session-view"><div class="session-topline"><span class="session-tag">DRILL ${drill.number} COMPLETE</span><span class="session-duration">${formatClock(drill.seconds)} LOGGED</span></div><h3>Good rep.<br><em>Reset your eyes.</em></h3><p class="session-description">Do not rush the transition. Shake out your hand, breathe once, then begin the next locked block when you are ready.</p><div class="timer-wrap"><div class="timer-display">${timerLabel}</div><div class="timer-track"><i style="width:100%"></i></div><div class="timer-meta"><span>DRILL COMPLETE</span><b>${active.currentIndex + 1} / ${drills.length}</b></div></div><div class="session-bottom"><button class="primary-btn" id="next-drill" type="button">${next ? `Unlock ${next.number} · ${next.short}` : 'Finish routine'} <span class="play-icon">→</span></button><span class="locked-note">✓ <b>Next step unlocked</b></span></div></div>`;
    document.getElementById('next-drill').addEventListener('click', nextDrill);
    return;
  }

  container.innerHTML = `<div class="session-view"><div class="session-topline"><span class="session-tag">DRILL ${drill.number} · ${active.running ? 'IN FOCUS' : 'PAUSED'}</span><span class="session-duration">${drill.mode}</span></div><h3>${drill.name}<br><em>${active.running ? 'stay on the cue.' : 'take your reset.'}</em></h3><p class="session-description">${drill.description}</p><div class="cue-grid"><div class="cue"><span>GOAL</span><strong>${drill.goal}</strong></div><div class="cue"><span>KEY CUE</span><strong>${drill.cue}</strong></div><div class="cue"><span>STANDARD</span><strong>${drill.standard}</strong></div></div><div class="timer-wrap"><div class="timer-display" id="timer-display">${formatClock(active.remaining)}</div><div class="timer-track"><i id="timer-progress" style="width:${percent}%"></i></div><div class="timer-meta"><span>${active.running ? 'TIMER RUNNING' : 'TIMER PAUSED'}</span><b>DRILL ${active.currentIndex + 1} / ${drills.length}</b></div></div><div class="timer-controls"><button class="primary-btn" id="pause-toggle" type="button">${active.running ? 'Ⅱ Pause timer' : '▶ Resume timer'}</button><span class="control-help">⌁ Keep this drill active until the timer reaches zero.</span></div></div>`;
  document.getElementById('pause-toggle').addEventListener('click', togglePause);
}

function renderAll() { renderStats(); renderRoutineList(); renderSession(); renderProgress(); }

function startSession() {
  stopTimer();
  state.lastCompletion = null;
  state.activeSession = { currentIndex: 0, remaining: drills[0].seconds, completed: [], startedAt: Date.now(), running: true };
  lastTickAt = Date.now();
  saveState(); renderAll(); startTimer();
}

function startTimer() {
  stopTimer();
  timerHandle = window.setInterval(tick, 250);
}

function stopTimer() { if (timerHandle) { window.clearInterval(timerHandle); timerHandle = null; } }

function tick() {
  const active = state.activeSession;
  if (!active || !active.running) { stopTimer(); return; }
  const now = Date.now();
  const elapsed = (now - lastTickAt) / 1000;
  lastTickAt = now;
  if (elapsed <= 0) return;
  active.remaining -= elapsed;
  if (active.remaining <= 0) { completeDrill(); return; }
  updateTimerDom(active);
  if (Math.floor(active.remaining) % 2 === 0) saveState();
}

function updateTimerDom(active) {
  const drill = drills[active.currentIndex];
  const timer = document.getElementById('timer-display');
  const progress = document.getElementById('timer-progress');
  if (timer) timer.textContent = formatClock(active.remaining);
  if (progress) progress.style.width = `${clamp(((drill.seconds - active.remaining) / drill.seconds) * 100, 0, 100)}%`;
}

function togglePause() {
  if (!state.activeSession || state.activeSession.completed.includes(state.activeSession.currentIndex)) return;
  if (state.activeSession.running) {
    tick(); state.activeSession.running = false; stopTimer();
  } else {
    state.activeSession.running = true; lastTickAt = Date.now(); startTimer();
  }
  saveState(); renderAll();
}

function completeDrill() {
  const active = state.activeSession;
  if (!active) return;
  active.remaining = 0; active.running = false;
  if (!active.completed.includes(active.currentIndex)) active.completed.push(active.currentIndex);
  stopTimer(); saveState();
  if (active.currentIndex === drills.length - 1) completeSession(); else renderAll();
  showToast(active.currentIndex === drills.length - 1 ? 'Routine complete — clean work.' : 'Drill complete — next step unlocked.');
}

function nextDrill() {
  const active = state.activeSession;
  if (!active || !active.completed.includes(active.currentIndex)) return;
  if (active.currentIndex >= drills.length - 1) { completeSession(); return; }
  active.currentIndex += 1; active.remaining = drills[active.currentIndex].seconds; active.running = true;
  lastTickAt = Date.now(); saveState(); renderAll(); startTimer();
}

function completeSession() {
  const active = state.activeSession;
  if (!active) return;
  const completion = { date: todayKey(), seconds: totalRoutineSeconds(), completedAt: Date.now(), drillCount: drills.length };
  state.history.push(completion);
  state.lastCompletion = completion;
  state.activeSession = null;
  stopTimer(); saveState(); renderAll();
}

function renderProgress() {
  renderHeatmap(); renderWeek(); renderHistory();
}

function renderHeatmap() {
  const container = document.getElementById('heatmap');
  if (!container) return;
  const today = new Date(); const start = new Date(today); start.setDate(today.getDate() - 363);
  const first = new Date(start); first.setDate(start.getDate() - first.getDay());
  const cells = [];
  for (let index = 0; index < 371; index += 1) {
    const date = new Date(first); date.setDate(first.getDate() + index);
    const key = todayKey(date); const count = countForDate(key); const level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3;
    cells.push(`<span class="heat-cell level-${level}" title="${formatDate(key)} · ${count} session${count === 1 ? '' : 's'}"></span>`);
  }
  container.innerHTML = cells.join('');
}

function renderWeek() {
  const container = document.getElementById('week-bars'); if (!container) return;
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(today); date.setDate(today.getDate() - (6 - index)); return date; });
  const counts = days.map(day => countForDate(todayKey(day))); const max = Math.max(...counts, 1);
  container.innerHTML = days.map((day, index) => { const count = counts[index]; const height = Math.max(5, (count / max) * 100); return `<div class="week-day ${index === 6 ? 'today' : ''} ${count ? 'done' : ''}"><b>${count || ''}</b><em style="height:${height}%" title="${formatDate(todayKey(day))}: ${count} sessions"></em><span>${day.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)}</span></div>`; }).join('');
}

function renderHistory() {
  const container = document.getElementById('history-list'); if (!container) return;
  const list = [...state.history].sort((a, b) => b.completedAt - a.completedAt).slice(0, 12);
  container.innerHTML = list.length ? list.map(item => `<div class="history-row"><div class="history-date"><strong>${formatDate(item.date, { weekday: 'long', month: 'short', day: 'numeric' })}</strong><small>${item.date === todayKey() ? 'Today' : 'Completed session'}</small></div><span>${drills.length} drills</span><span>${formatMinutes(item.seconds)}</span><span class="history-result">✓ Complete</span></div>`).join('') : '<div class="empty-state">No sessions logged yet. Your first completed routine will appear here.</div>';
}

function switchView(view) {
  document.querySelectorAll('.view').forEach(section => section.classList.toggle('active', section.id === `view-${view}`));
  document.querySelectorAll('.nav-link').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  window.location.hash = view;
}

function setPeriod(period) {
  selectedPeriod = period;
  document.querySelectorAll('.period-btn').forEach(button => button.classList.toggle('active', button.dataset.period === period));
  renderPeriodStats();
}

function showToast(message) {
  const toast = document.getElementById('toast'); if (!toast) return;
  toast.textContent = message; toast.classList.add('show');
  window.clearTimeout(toastHandle); toastHandle = window.setTimeout(() => toast.classList.remove('show'), 3000);
}

function resetHistory() {
  if (!window.confirm('Reset every logged session on this device? This cannot be undone.')) return;
  state.history = []; state.lastCompletion = null; saveState(); renderAll(); showToast('History reset. New block starts now.');
}

document.querySelectorAll('.nav-link').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
document.querySelectorAll('.period-btn').forEach(button => button.addEventListener('click', () => setPeriod(button.dataset.period)));
document.getElementById('hero-start').addEventListener('click', startSession);
document.getElementById('clear-history').addEventListener('click', resetHistory);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.activeSession && state.activeSession.running) togglePause();
});

const initialView = window.location.hash === '#progress' ? 'progress' : 'today';
switchView(initialView);
renderAll();
if (state.activeSession && state.activeSession.running) {
  state.activeSession.running = false;
  saveState();
  showToast('Session paused after reload — resume when ready.');
  renderAll();
}
