// ============================================================
// BrainMaster — 5 mini-games. Each exports an object with:
//   { id, name, icon, color, prompt, mount(host, api) }
// api.score(n) — add n to current score (n can be negative)
// api.next()   — request next problem (after correct/wrong feedback)
// api.now()    — current elapsed ms
// api.host     — game body container
// ============================================================

const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];
const shuffle = (arr) => arr.slice().sort(() => Math.random() - 0.5);

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// -------------- THINK: HEAVIEST --------------
// Show 4 expressions, pick the one with the largest value.
const gameThink = {
  id: 'think',
  name: 'THINK',
  icon: '🧠',
  color: 'var(--think)',
  prompt: 'Tap the box with the LARGEST value',
  mount(host, api) {
    const problemEl = document.createElement('div');
    problemEl.className = 'prompt';
    problemEl.textContent = this.prompt;
    host.appendChild(problemEl);

    const choices = document.createElement('div');
    choices.className = 'choices col-2';
    host.appendChild(choices);

    const makeExpr = () => {
      const t = rand(3);
      if (t === 0) { const a = 2 + rand(8); const b = 2 + rand(8); return { txt: `${a} × ${b}`, val: a*b }; }
      if (t === 1) { const a = 5 + rand(40); const b = 1 + rand(15); return { txt: `${a} - ${b}`, val: a-b }; }
      const a = 1 + rand(40); const b = 1 + rand(40); return { txt: `${a} + ${b}`, val: a+b };
    };

    const round = () => {
      choices.innerHTML = '';
      const seen = new Set();
      const items = [];
      while (items.length < 4) {
        const e = makeExpr();
        if (seen.has(e.val)) continue;
        seen.add(e.val);
        items.push(e);
      }
      const max = Math.max(...items.map(x => x.val));
      items.forEach(it => {
        const b = document.createElement('button');
        b.className = 'choice';
        b.textContent = it.txt;
        b.onclick = () => {
          if (it.val === max) {
            b.classList.add('right');
            api.score(10);
            setTimeout(round, 280);
          } else {
            b.classList.add('wrong');
            api.score(-3);
            setTimeout(round, 380);
          }
        };
        choices.appendChild(b);
      });
    };
    round();
  }
};

// -------------- MEMORIZE: FLASH --------------
// Numbered cells flash briefly, hide, then click in ascending order.
const gameMemorize = {
  id: 'memorize',
  name: 'MEMORIZE',
  icon: '⚡',
  color: 'var(--memorize)',
  prompt: 'Remember the numbers, then tap them 1 → N',
  mount(host, api) {
    const status = document.createElement('div');
    status.className = 'prompt';
    status.textContent = this.prompt;
    host.appendChild(status);

    const grid = document.createElement('div');
    grid.className = 'mem-grid';
    host.appendChild(grid);

    let level = 3;
    let cells = [];
    for (let i = 0; i < 16; i++) {
      const c = document.createElement('div');
      c.className = 'mem-cell';
      c.dataset.idx = i;
      grid.appendChild(c);
      cells.push(c);
    }

    const round = async () => {
      cells.forEach(c => { c.className = 'mem-cell'; c.textContent = ''; c.onclick = null; delete c.dataset.num; });
      status.textContent = `Memorize ${level} numbers...`;
      // pick `level` cells, assign numbers 1..level
      const idxs = shuffle([...Array(16).keys()]).slice(0, level);
      idxs.forEach((idx, i) => {
        cells[idx].classList.add('show');
        cells[idx].textContent = (i + 1);
        cells[idx].dataset.num = i + 1;
      });
      // show for `level` * 600ms (more time when harder)
      await delay(800 + level * 300);
      // hide
      cells.forEach(c => {
        if (c.classList.contains('show')) {
          c.classList.remove('show');
          c.classList.add('hidden');
        }
      });
      status.textContent = `Now tap 1 → ${level}`;
      let expected = 1;
      const onClick = (c) => {
        const n = parseInt(c.dataset.num || 0);
        if (n === expected) {
          c.classList.remove('hidden');
          c.classList.add('picked');
          c.textContent = n;
          expected++;
          if (expected > level) {
            api.score(level * 5);
            level = Math.min(8, level + 1);
            setTimeout(round, 500);
          }
        } else {
          c.classList.add('wrong');
          api.score(-4);
          level = Math.max(3, level - 1);
          setTimeout(round, 600);
        }
      };
      cells.forEach(c => c.onclick = () => onClick(c));
    };
    round();
  }
};

// -------------- ANALYZE: COUNT --------------
// Count how many of a target shape+color appear in a scattered scene.
const gameAnalyze = {
  id: 'analyze',
  name: 'ANALYZE',
  icon: '🔍',
  color: 'var(--analyze)',
  prompt: 'Count the target shapes',
  mount(host, api) {
    const promptEl = document.createElement('div');
    promptEl.className = 'prompt';
    host.appendChild(promptEl);

    const board = document.createElement('div');
    board.className = 'count-board';
    host.appendChild(board);

    const choices = document.createElement('div');
    choices.className = 'choices col-4';
    host.appendChild(choices);

    const palette = [
      { name: 'red',    css: '#e85b7d' },
      { name: 'blue',   css: '#6c91e8' },
      { name: 'green',  css: '#5fc28f' },
      { name: 'yellow', css: '#f5c542' },
    ];
    const shapes = [
      { name: 'square',   cls: 'sq' },
      { name: 'circle',   cls: 'circle' },
      { name: 'triangle', cls: 'tri' },
    ];

    const round = () => {
      board.innerHTML = '';
      choices.innerHTML = '';
      const tShape = pick(shapes);
      const tColor = pick(palette);
      const total = 14 + rand(8);
      let targetCount = 0;
      for (let i = 0; i < total; i++) {
        const sh = pick(shapes);
        const co = pick(palette);
        const el = document.createElement('div');
        el.className = `count-shape ${sh.cls}`;
        if (sh.name === 'triangle') {
          el.style.borderBottomColor = co.css;
        } else {
          el.style.background = co.css;
        }
        // use percentage positions so board can be responsive
        el.style.left = (2 + rand(86)) + '%';
        el.style.top  = (4 + rand(80)) + '%';
        el.style.transform = `rotate(${rand(40) - 20}deg)`;
        board.appendChild(el);
        if (sh.name === tShape.name && co.name === tColor.name) targetCount++;
      }
      // guarantee at least 2
      while (targetCount < 2) {
        const el = document.createElement('div');
        el.className = `count-shape ${tShape.cls}`;
        if (tShape.name === 'triangle') el.style.borderBottomColor = tColor.css;
        else el.style.background = tColor.css;
        el.style.left = (2 + rand(86)) + '%';
        el.style.top  = (4 + rand(80)) + '%';
        board.appendChild(el);
        targetCount++;
      }
      promptEl.innerHTML = `How many <strong style="color:${tColor.css}">${tColor.name} ${tShape.name}s</strong>?`;
      // build 4 nearby choices
      const opts = new Set([targetCount]);
      while (opts.size < 4) {
        const delta = (rand(5) + 1) * (rand(2) ? 1 : -1);
        const v = targetCount + delta;
        if (v >= 0) opts.add(v);
      }
      shuffle([...opts]).forEach(v => {
        const b = document.createElement('button');
        b.className = 'choice';
        b.textContent = v;
        b.onclick = () => {
          if (v === targetCount) { b.classList.add('right'); api.score(12); setTimeout(round, 320); }
          else { b.classList.add('wrong'); api.score(-4); setTimeout(round, 420); }
        };
        choices.appendChild(b);
      });
    };
    round();
  }
};

// -------------- COMPUTE: SPRINT --------------
// Rapid arithmetic with on-screen keypad.
const gameCompute = {
  id: 'compute',
  name: 'COMPUTE',
  icon: '🧮',
  color: 'var(--compute)',
  prompt: 'Solve as many as you can',
  mount(host, api) {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '14px';
    host.appendChild(wrap);

    const problem = document.createElement('div');
    problem.className = 'problem';
    wrap.appendChild(problem);

    const answer = document.createElement('div');
    answer.className = 'answer-display';
    answer.textContent = '';
    wrap.appendChild(answer);

    const pad = document.createElement('div');
    pad.className = 'keypad';
    wrap.appendChild(pad);

    let current = 0;
    let input = '';

    const makeProblem = () => {
      const t = rand(4);
      let a, b, op, val;
      if (t === 0)      { a = 2 + rand(20); b = 2 + rand(20); op = '+'; val = a + b; }
      else if (t === 1) { a = 10 + rand(40); b = 2 + rand(a - 1); op = '-'; val = a - b; }
      else if (t === 2) { a = 2 + rand(10); b = 2 + rand(10); op = '×'; val = a * b; }
      else              { b = 2 + rand(8); val = 2 + rand(10); a = b * val; op = '÷'; }
      current = val;
      problem.textContent = `${a} ${op} ${b}`;
      input = '';
      answer.textContent = '';
    };

    const submit = () => {
      if (input === '') return;
      if (parseInt(input) === current) {
        answer.style.color = 'var(--identify)';
        api.score(8);
        setTimeout(() => { answer.style.color = ''; makeProblem(); }, 200);
      } else {
        answer.style.color = 'var(--compute)';
        host.parentElement.style.animation = 'shake 0.3s';
        api.score(-3);
        setTimeout(() => {
          host.parentElement.style.animation = '';
          answer.style.color = '';
          input = '';
          answer.textContent = '';
        }, 320);
      }
    };

    const press = (k) => {
      if (k === 'enter') return submit();
      if (k === 'back')  { input = input.slice(0, -1); answer.textContent = input; return; }
      if (input.length >= 4) return;
      input += k;
      answer.textContent = input;
    };

    ['7','8','9','4','5','6','1','2','3','back','0','enter'].forEach(k => {
      const b = document.createElement('button');
      b.className = 'key' + (k === 'enter' ? ' enter' : '') + (k === 'back' ? ' back' : '');
      b.textContent = k === 'enter' ? '✓' : k === 'back' ? '⌫' : k;
      b.onclick = () => press(k);
      pad.appendChild(b);
    });

    // keyboard support
    const onKey = (e) => {
      if (e.key >= '0' && e.key <= '9') press(e.key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Enter') press('enter');
    };
    document.addEventListener('keydown', onKey);
    api.onExit(() => document.removeEventListener('keydown', onKey));

    makeProblem();
  }
};

// -------------- IDENTIFY: SHADOW --------------
// Show silhouette of an emoji, pick which one matches.
const gameIdentify = {
  id: 'identify',
  name: 'IDENTIFY',
  icon: '👁️',
  color: 'var(--identify)',
  prompt: 'Which one is the shadow?',
  mount(host, api) {
    const promptEl = document.createElement('div');
    promptEl.className = 'prompt';
    promptEl.textContent = this.prompt;
    host.appendChild(promptEl);

    const stage = document.createElement('div');
    stage.className = 'shadow-stage';
    host.appendChild(stage);

    const shape = document.createElement('div');
    shape.className = 'shadow-shape';
    stage.appendChild(shape);

    const choices = document.createElement('div');
    choices.className = 'id-choices';
    host.appendChild(choices);

    // Pick visually distinct emoji silhouettes
    const pool = ['🐢','🦊','🐘','🦒','🐬','🦋','🍎','🌵','🚲','⚓','🎩','🪂','🐙','🍄','🌙','⭐','🍦','🎺','🦖','🪁','🐌','🍕','🪐','🧩'];

    const round = () => {
      choices.innerHTML = '';
      const opts = shuffle(pool).slice(0, 4);
      const target = pick(opts);
      shape.textContent = target;
      opts.forEach(e => {
        const b = document.createElement('button');
        b.className = 'id-choice';
        b.textContent = e;
        b.onclick = () => {
          if (e === target) { b.classList.add('right'); api.score(10); setTimeout(round, 280); }
          else { b.classList.add('wrong'); api.score(-3); setTimeout(round, 380); }
        };
        choices.appendChild(b);
      });
    };
    round();
  }
};

const GAMES = [gameThink, gameMemorize, gameAnalyze, gameCompute, gameIdentify];
