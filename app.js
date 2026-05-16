// ============================================================
// BrainMaster — main app shell
// Screens: home → countdown → game (×5) → results → home
// ============================================================

const STORAGE_KEY = 'brainmaster.v1';
const GAME_DURATION = 30 * 1000; // 30s per game

const root = document.getElementById('app');

const defaultState = () => ({
  brainWeight: null,
  grade: null,
  best: {}, // { gameId: score }
});

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch { return defaultState(); }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function gradeFor(weight) {
  if (weight >= 1500) return { letter: 'S', blurb: "Superhuman. Your brain is glowing." };
  if (weight >= 1300) return { letter: 'A', blurb: "Razor sharp — top of the class." };
  if (weight >= 1100) return { letter: 'B', blurb: "Solid performance. Keep training." };
  if (weight >=  900) return { letter: 'C', blurb: "Warming up. There's room to grow." };
  if (weight >=  600) return { letter: 'D', blurb: "Drowsy brain. Coffee, maybe?" };
  return { letter: 'E', blurb: "Bring snacks next time." };
}

// score → weight contribution per game (roughly 0..400)
function gameWeight(score) {
  return Math.max(0, Math.round(score * 4));
}

// ============================================================
// SCREEN: HOME
// ============================================================
function renderHome() {
  root.innerHTML = '';
  const screen = document.createElement('div');
  screen.className = 'screen';

  const grade = state.brainWeight != null ? gradeFor(state.brainWeight) : null;

  screen.innerHTML = `
    <div class="home-header">
      <div class="home-logo"><span class="brain">🧠</span> BrainMaster</div>
      <div class="home-tag">Test your brain in 5 quick minigames.</div>
    </div>

    <div class="brain-status">
      <div class="bs-block">
        <div class="bs-label">Brain Weight</div>
        <div class="bs-value">${state.brainWeight != null ? state.brainWeight + 'g' : '— —'}</div>
      </div>
      <div class="bs-block">
        <div class="bs-label">Grade</div>
        <div class="bs-grade ${grade ? '' : 'locked'}">${grade ? grade.letter : '?'}</div>
      </div>
      <div class="bs-block">
        <div class="bs-label">Tests Taken</div>
        <div class="bs-value">${state.testsTaken || 0}</div>
      </div>
    </div>

    <div class="home-actions">
      <button class="btn primary big" id="btn-test">🧪 Take the Test</button>
      <button class="btn secondary big" id="btn-practice">🎯 Practice</button>
    </div>

    <div class="home-section-title">Practice a category</div>
    <div class="cat-grid" id="cat-grid"></div>
  `;

  root.appendChild(screen);

  const cg = screen.querySelector('#cat-grid');
  GAMES.forEach(g => {
    const card = document.createElement('button');
    card.className = 'cat-card';
    card.innerHTML = `
      <div class="cat-icon" style="background:${g.color}">${g.icon}</div>
      <div class="cat-name">${g.name}</div>
      <div class="cat-best">${state.best[g.id] ? 'Best ' + state.best[g.id] : '—'}</div>
    `;
    card.onclick = () => startGame(g, /*solo*/ true);
    cg.appendChild(card);
  });

  screen.querySelector('#btn-test').onclick = () => startTest();
  screen.querySelector('#btn-practice').onclick = () => {
    // shortcut to first category card
    cg.firstChild.scrollIntoView({ behavior: 'smooth' });
  };
}

// ============================================================
// SCREEN: COUNTDOWN
// ============================================================
function countdown(label, then) {
  root.innerHTML = '';
  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.style.textAlign = 'center';
  screen.innerHTML = `
    <div class="result-kicker">${label}</div>
    <div class="countdown" id="cd">3</div>
  `;
  root.appendChild(screen);
  const el = screen.querySelector('#cd');
  let n = 3;
  const step = () => {
    if (n === 0) { then(); return; }
    el.textContent = n;
    el.style.animation = 'none';
    requestAnimationFrame(() => { el.style.animation = ''; });
    if (n === 1) el.style.color = 'var(--compute)';
    else if (n === 2) el.style.color = 'var(--memorize)';
    else el.style.color = 'var(--ink)';
    n--;
    setTimeout(step, 700);
  };
  step();
}

// ============================================================
// SCREEN: GAME
// ============================================================
function startGame(game, solo) {
  countdown(game.name, () => runGame(game, solo, null));
}

function runGame(game, solo, sessionState) {
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'game-screen';
  wrap.innerHTML = `
    <div class="game-header">
      <div class="game-title">
        <span style="color:${game.color}">${game.icon}</span>
        ${game.name}
      </div>
      <div class="game-meta">
        <div class="meta-block">
          <div class="meta-label">SCORE</div>
          <div class="meta-value" id="score">0</div>
        </div>
        <div class="meta-block">
          <div class="meta-label">TIME</div>
          <div class="meta-value" id="time">30</div>
        </div>
        <button class="exit-btn" id="exit">Quit</button>
      </div>
    </div>
    <div class="timer-bar"><div class="timer-fill" id="tfill"></div></div>
    <div class="game-body" id="body"></div>
  `;
  root.appendChild(wrap);

  const body = wrap.querySelector('#body');
  const scoreEl = wrap.querySelector('#score');
  const timeEl = wrap.querySelector('#time');
  const fill = wrap.querySelector('#tfill');

  let score = 0;
  let stopped = false;
  const startedAt = performance.now();
  const exitHandlers = [];

  const api = {
    score(n) {
      score += n;
      scoreEl.textContent = score;
      if (n > 0) flashBadge('+' + n, 'var(--identify)');
      else if (n < 0) flashBadge(n.toString(), 'var(--compute)');
    },
    now: () => performance.now() - startedAt,
    onExit: (fn) => exitHandlers.push(fn),
    host: body,
  };

  game.mount(body, api);

  const cleanup = () => {
    stopped = true;
    exitHandlers.forEach(fn => fn());
  };

  wrap.querySelector('#exit').onclick = () => {
    if (!confirm('Quit this game?')) return;
    cleanup();
    renderHome();
  };

  // timer
  const tick = () => {
    if (stopped) return;
    const elapsed = performance.now() - startedAt;
    const remaining = Math.max(0, GAME_DURATION - elapsed);
    const secs = Math.ceil(remaining / 1000);
    timeEl.textContent = secs;
    const pct = (remaining / GAME_DURATION) * 100;
    fill.style.width = pct + '%';
    if (remaining < 8000) fill.classList.add('warn');
    if (remaining <= 0) {
      cleanup();
      finishGame(game, score, solo, sessionState);
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function flashBadge(text, color) {
  const b = document.createElement('div');
  b.className = 'flash-badge';
  b.textContent = text;
  if (color) b.style.color = color;
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 600);
}

// ============================================================
// FINISH a single game (practice OR test step)
// ============================================================
function finishGame(game, score, solo, sessionState) {
  // update best
  if (!state.best[game.id] || score > state.best[game.id]) {
    state.best[game.id] = score;
  }
  saveState();

  if (solo) {
    showSoloResult(game, score);
  } else {
    // accumulate into session and move to next
    sessionState.results.push({ gameId: game.id, score, weight: gameWeight(score) });
    sessionState.idx++;
    if (sessionState.idx < GAMES.length) {
      const next = GAMES[sessionState.idx];
      countdown(`Game ${sessionState.idx + 1} of ${GAMES.length} — ${next.name}`,
        () => runGame(next, false, sessionState));
    } else {
      showTestResult(sessionState);
    }
  }
}

// ============================================================
// SOLO PRACTICE result
// ============================================================
function showSoloResult(game, score) {
  root.innerHTML = '';
  const screen = document.createElement('div');
  screen.className = 'screen result-screen';
  const isBest = state.best[game.id] === score;
  screen.innerHTML = `
    <div class="result-kicker">${game.name} • PRACTICE</div>
    <div class="result-weight">${score}</div>
    <div class="result-unit">${isBest ? 'NEW BEST!' : 'points'}</div>
    <div class="result-blurb">${score >= 80 ? 'Excellent reflexes.' : score >= 40 ? 'Decent run.' : 'Keep at it — speed comes with reps.'}</div>
    <div class="home-actions">
      <button class="btn primary big" id="again">↻ Play Again</button>
      <button class="btn secondary big" id="home">🏠 Home</button>
    </div>
  `;
  root.appendChild(screen);
  screen.querySelector('#again').onclick = () => startGame(game, true);
  screen.querySelector('#home').onclick = () => renderHome();
}

// ============================================================
// FULL TEST flow (5 games sequentially)
// ============================================================
function startTest() {
  const sessionState = { idx: 0, results: [] };
  const first = GAMES[0];
  countdown(`Game 1 of ${GAMES.length} — ${first.name}`,
    () => runGame(first, false, sessionState));
}

function showTestResult(sessionState) {
  const totalWeight = sessionState.results.reduce((s, r) => s + r.weight, 0);
  const grade = gradeFor(totalWeight);

  state.brainWeight = totalWeight;
  state.grade = grade.letter;
  state.testsTaken = (state.testsTaken || 0) + 1;
  saveState();

  root.innerHTML = '';
  const screen = document.createElement('div');
  screen.className = 'screen result-screen';

  const bd = sessionState.results.map(r => {
    const g = GAMES.find(x => x.id === r.gameId);
    return `
      <div class="bd-row" style="border-color:${g.color}">
        <div class="bd-cat">${g.name}</div>
        <div class="bd-val">${r.weight}g</div>
      </div>
    `;
  }).join('');

  screen.innerHTML = `
    <div class="result-kicker">YOUR BRAIN WEIGHS</div>
    <div class="result-weight">${totalWeight}<span style="font-size:36px;color:var(--ink-soft)">g</span></div>
    <div class="result-grade">${grade.letter}</div>
    <div class="result-blurb">${grade.blurb}</div>
    <div class="breakdown">${bd}</div>
    <div class="home-actions">
      <button class="btn primary big" id="again">↻ Test Again</button>
      <button class="btn secondary big" id="home">🏠 Home</button>
    </div>
  `;
  root.appendChild(screen);
  screen.querySelector('#again').onclick = () => startTest();
  screen.querySelector('#home').onclick = () => renderHome();
}

// ============================================================
// boot
// ============================================================
renderHome();
