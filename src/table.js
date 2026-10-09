// 표 기능: 만들기, 줄/칸 추가·삭제, 셀 합치기/나누기, 셀 블록(F5), 크기 조절
'use strict';
const Table = {
  // ---------- 격자 모델 ----------
  grid(table) {
    const trs = rowsOf(table);
    const cells = [];
    const occ = [];
    trs.forEach((tr, r) => {
      let c = 0;
      for (const td of Array.from(tr.cells)) {
        occ[r] = occ[r] || [];
        while (occ[r][c]) c++;
        const rs = Math.max(1, td.rowSpan || 1), cs = Math.max(1, td.colSpan || 1);
        const cell = { el: td, r, c, rs, cs };
        cells.push(cell);
        for (let i = r; i < r + rs; i++) {
          occ[i] = occ[i] || [];
          for (let j = c; j < c + cs; j++) occ[i][j] = cell;
        }
        c += cs;
      }
    });
    const nr = Math.max(trs.length, occ.length);
    let nc = 0;
    occ.forEach((row) => { if (row) nc = Math.max(nc, row.length); });
    const widths = colWidths(table, nc);
    const heights = trs.map((tr) => parseFloat(tr.style.height) || 0);
    return { table, cells, nr, nc, widths, heights };
  },
  // 셀마다 가로 범위([x1,x2])를 주면 칸 경계를 새로 계산해 표를 다시 짬 (필요하면 칸을 나누거나 합침)
  regridX(g0, ranges) {
    const xs = [];
    ranges.forEach(([a, b]) => { xs.push(a, b); });
    xs.sort((a, b) => a - b);
    const P = [];
    for (const v of xs) if (!P.length || v - P[P.length - 1] > 0.5) P.push(v);
    const idx = (v) => { let best = 0; P.forEach((p, i) => { if (Math.abs(p - v) < Math.abs(P[best] - v)) best = i; }); return best; };
    const g = { table: g0.table, nr: g0.nr, heights: g0.heights, nc: P.length - 1, widths: P.slice(1).map((p, i) => p - P[i]) };
    g.cells = g0.cells.map((c, i) => { const a = idx(ranges[i][0]), b = idx(ranges[i][1]); return { el: c.el, r: c.r, rs: c.rs, c: a, cs: Math.max(1, b - a) }; });
    this.rebuild(g);
  },
  cellAt(g, r, c) {
    return g.cells.find((x) => r >= x.r && r < x.r + x.rs && c >= x.c && c < x.c + x.cs) || null;
  },
  rebuild(g) {
    const { table } = g;
    // 빈 구멍 채우기
    for (let r = 0; r < g.nr; r++) for (let c = 0; c < g.nc; c++) {
      if (!this.cellAt(g, r, c)) g.cells.push({ el: newCell(), r, c, rs: 1, cs: 1 });
    }
    let tbody = table.tBodies[0];
    Array.from(table.querySelectorAll(':scope > tr, :scope > thead, :scope > tfoot')).forEach((x) => x.remove());
    if (!tbody) { tbody = h('tbody'); table.append(tbody); }
    Array.from(table.tBodies).slice(1).forEach((b) => b.remove());
    tbody.innerHTML = '';
    const trs = [];
    for (let r = 0; r < g.nr; r++) {
      const tr = h('tr');
      if (g.heights[r]) tr.style.height = g.heights[r] + 'px';
      trs.push(tr);
      tbody.append(tr);
    }
    g.cells.sort((a, b) => a.r - b.r || a.c - b.c);
    for (const x of g.cells) {
      x.el.rowSpan = x.rs;
      x.el.colSpan = x.cs;
      if (x.rs === 1) x.el.removeAttribute('rowspan');
      if (x.cs === 1) x.el.removeAttribute('colspan');
      trs[x.r].append(x.el);
    }
    setColWidths(table, g.widths);
  },

  // ---------- 만들기 ----------
  create(rows, cols, opts = {}) {
    rows = Math.max(1, Math.min(500, rows | 0));
    cols = Math.max(1, Math.min(60, cols | 0));
    const inCell = Sel.closest('td');
    const avail = inCell ? Math.max(60, inCell.clientWidth - 16) : App.contentWidth();
    const total = opts.width || avail;
    const w = Math.floor(total / cols);
    const table = h('table');
    const g = { table, cells: [], nr: rows, nc: cols, widths: Array(cols).fill(w), heights: Array(rows).fill(0) };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g.cells.push({ el: newCell(), r, c, rs: 1, cs: 1 });
    this.rebuild(g);
    if (opts.header) g.cells.filter((x) => x.r === 0).forEach((x) => { x.el.style.backgroundColor = '#e8edf5'; x.el.firstChild.style.textAlign = 'center'; });
    insertBlockAtCaret(table);
    Sel.caretInto(table.rows[0].cells[0].firstChild);
    return table;
  },

  current() { return Sel.closest('table'); },
  currentCell() { return Sel.closest('td, th'); },

  // ---------- 줄/칸 ----------
  insertRow(below = true, count = 1) {
    const td = this.currentCell() || (this.block && this.block.cells()[0]);
    if (!td) return false;
    const table = td.closest('table');
    for (let n = 0; n < count; n++) {
      const g = this.grid(table);
      const cur = g.cells.find((x) => x.el === td);
      const k = below ? cur.r + cur.rs : cur.r;
      for (const x of g.cells) {
        if (x.r < k && k < x.r + x.rs) x.rs++;
        else if (x.r >= k) x.r++;
      }
      g.nr++;
      g.heights.splice(k, 0, 0);
      this.rebuild(g);
    }
    return true;
  },
  insertCol(right = true, count = 1) {
    const td = this.currentCell();
    if (!td) return false;
    const table = td.closest('table');
    for (let n = 0; n < count; n++) {
      const g = this.grid(table);
      const cur = g.cells.find((x) => x.el === td);
      const k = right ? cur.c + cur.cs : cur.c;
      for (const x of g.cells) {
        if (x.c < k && k < x.c + x.cs) x.cs++;
        else if (x.c >= k) x.c++;
      }
      g.nc++;
      const refW = g.widths[Math.min(right ? k - 1 : k, g.widths.length - 1)] || 60;
      g.widths.splice(k, 0, refW);
      fitWidths(g, table);
      this.rebuild(g);
    }
    return true;
  },
  deleteRow() {
    const sel = this.block && this.block.active() ? this.block.rect() : null;
    const td = this.currentCell();
    if (!td && !sel) return false;
    const table = sel ? this.block.table : td.closest('table');
    const g0 = this.grid(table);
    let r1, r2;
    if (sel) { r1 = sel.r1; r2 = sel.r2; }
    else { const cur = g0.cells.find((x) => x.el === td); r1 = cur.r; r2 = cur.r; }
    this.block.clear();
    for (let k = r2; k >= r1; k--) {
      const g = this.grid(table);
      if (g.nr <= 1) { this.remove(table); return true; }
      g.cells = g.cells.filter((x) => {
        if (x.r <= k && k < x.r + x.rs) {
          if (x.rs > 1) { x.rs--; return true; }
          return false;
        }
        if (x.r > k) x.r--;
        return true;
      });
      g.nr--;
      g.heights.splice(k, 1);
      this.rebuild(g);
    }
    const first = table.querySelector('td p, td');
    if (first) Sel.caretInto(first);
    return true;
  },
  deleteCol() {
    const sel = this.block && this.block.active() ? this.block.rect() : null;
    const td = this.currentCell();
    if (!td && !sel) return false;
    const table = sel ? this.block.table : td.closest('table');
    const g0 = this.grid(table);
    let c1, c2;
    if (sel) { c1 = sel.c1; c2 = sel.c2; }
    else { const cur = g0.cells.find((x) => x.el === td); c1 = cur.c; c2 = cur.c; }
    this.block.clear();
    for (let k = c2; k >= c1; k--) {
      const g = this.grid(table);
      if (g.nc <= 1) { this.remove(table); return true; }
      g.cells = g.cells.filter((x) => {
        if (x.c <= k && k < x.c + x.cs) {
          if (x.cs > 1) { x.cs--; return true; }
          return false;
        }
        if (x.c > k) x.c--;
        return true;
      });
      g.nc--;
      g.widths.splice(k, 1);
      this.rebuild(g);
    }
    const first = table.querySelector('td p, td');
    if (first) Sel.caretInto(first);
    return true;
  },
  remove(table) {
    table = table || this.current();
    if (!table) return;
    this.block.clear();
    const p = h('p', {}, h('br'));
    table.replaceWith(p);
    Sel.caretInto(p);
    Para.ensure();
  },

  // ---------- 합치기 / 나누기 ----------
  merge() {
    if (!this.block.active()) { status('셀 블록(F5)을 먼저 지정하세요.'); return false; }
    const table = this.block.table;
    const g = this.grid(table);
    const rc = expandRect(g, this.block.rect());
    const anchor = this.cellAt(g, rc.r1, rc.c1);
    const inside = g.cells.filter((x) => x !== anchor && x.r >= rc.r1 && x.r <= rc.r2 && x.c >= rc.c1 && x.c <= rc.c2);
    const anchorEmpty = () => !anchor.el.textContent.trim() && !anchor.el.querySelector('img,table,.nobj');
    for (const x of inside) {
      const has = x.el.textContent.trim() || x.el.querySelector('img,table,.nobj');
      if (has) {
        if (anchorEmpty()) anchor.el.innerHTML = '';
        while (x.el.firstChild) anchor.el.append(x.el.firstChild);
      }
    }
    g.cells = g.cells.filter((x) => !inside.includes(x));
    anchor.rs = rc.r2 - rc.r1 + 1;
    anchor.cs = rc.c2 - rc.c1 + 1;
    this.rebuild(g);
    this.block.clear();
    Sel.caretInto(anchor.el.firstElementChild || anchor.el);
    return true;
  },
  split(nRows, nCols) {
    const td = this.block.active() ? this.block.cells()[0] : this.currentCell();
    if (!td) return false;
    const table = td.closest('table');
    nRows = Math.max(1, nRows | 0); nCols = Math.max(1, nCols | 0);
    let g = this.grid(table);
    let cur = g.cells.find((x) => x.el === td);
    // 필요한 만큼 격자 칸 추가
    if (nCols > cur.cs) {
      const extra = nCols - cur.cs;
      const k = cur.c + cur.cs; // 마지막 칸 뒤
      const lastW = g.widths[k - 1];
      for (const x of g.cells) {
        if (x === cur) continue;
        if (x.c < k && k <= x.c + x.cs - 0 && x.c + x.cs >= k && x.c <= k - 1) x.cs += extra; // 같은 칸을 덮는 셀 확장
        else if (x.c >= k) x.c += extra;
      }
      const piece = lastW / (extra + 1);
      g.widths.splice(k - 1, 1, ...Array(extra + 1).fill(piece));
      cur.cs += extra;
      g.nc += extra;
    }
    if (nRows > cur.rs) {
      const extra = nRows - cur.rs;
      const k = cur.r + cur.rs;
      for (const x of g.cells) {
        if (x === cur) continue;
        if (x.r <= k - 1 && x.r + x.rs >= k) x.rs += extra;
        else if (x.r >= k) x.r += extra;
      }
      g.heights.splice(k, 0, ...Array(extra).fill(0));
      cur.rs += extra;
      g.nr += extra;
    }
    // 영역을 nRows × nCols 로 분배
    const rParts = distribute(cur.rs, nRows), cParts = distribute(cur.cs, nCols);
    const baseR = cur.r, baseC = cur.c;
    g.cells = g.cells.filter((x) => x !== cur);
    let rr = baseR;
    rParts.forEach((rs, i) => {
      let cc = baseC;
      cParts.forEach((cs, j) => {
        const el = i === 0 && j === 0 ? td : newCell(td);
        g.cells.push({ el, r: rr, c: cc, rs, cs });
        cc += cs;
      });
      rr += rs;
    });
    this.rebuild(g);
    this.block.clear();
    Sel.caretInto(td.firstElementChild || td);
    return true;
  },

  // ---------- 표 나누기 / 붙이기 (한글: Ctrl+N,A / Ctrl+N,Z) ----------
  // 커서가 있는 줄부터 아래를 새 표로 떼어 냄. 그 줄에 걸친 세로로 합친 셀은 위·아래로 갈라짐
  splitTable() {
    const td = this.block.active() ? this.block.cells()[0] : this.currentCell();
    if (!td) { status('표 안에 커서를 두세요.'); return false; }
    const table = td.closest('table');
    const g = this.grid(table);
    const cur = g.cells.find((x) => x.el === td);
    const r = this.block.active() ? this.block.rect().r1 : cur.r;
    if (r <= 0) { status('표의 첫 줄에서는 표를 나눌 수 없습니다.'); return false; }
    this.block.clear();
    const top = [], bot = [];
    for (const x of g.cells) {
      if (x.r + x.rs <= r) top.push(x);
      else if (x.r >= r) bot.push({ ...x, r: x.r - r });
      else {
        // 나누는 줄에 걸친 셀: 위쪽은 원래 셀, 아래쪽은 같은 모양의 빈 셀
        bot.push({ el: newCell(x.el), r: 0, c: x.c, rs: x.r + x.rs - r, cs: x.cs });
        top.push({ ...x, rs: r - x.r });
      }
    }
    const t2 = table.cloneNode(false);
    t2.removeAttribute('id');
    delete t2.dataset.vshift; delete t2.dataset.samepara;
    this.rebuild({ table, cells: top, nr: r, nc: g.nc, widths: g.widths.slice(), heights: g.heights.slice(0, r) });
    table.after(t2);
    this.rebuild({ table: t2, cells: bot, nr: g.nr - r, nc: g.nc, widths: g.widths.slice(), heights: g.heights.slice(r) });
    const first = bot.find((x) => x.el === td) ? td : t2.rows[0].cells[0];
    Sel.caretInto(first.querySelector('p') || first);
    return true;
  },
  // 커서가 있는 표와 바로 아래 표를 하나로 붙임 (사이의 빈 문단은 지움). 칸 경계가 다르면 칸을 나눠 맞춤
  joinTable() {
    const table = this.block.active() ? this.block.table : this.current();
    if (!table) { status('표 안에 커서를 두세요.'); return false; }
    const between = [];
    let next = table.nextElementSibling;
    while (next && next.tagName === 'P' && !next.textContent.trim() && !next.querySelector('img,table,.nobj,.pagebreak')) { between.push(next); next = next.nextElementSibling; }
    if (!next || next.tagName !== 'TABLE') {
      // 아래에 없으면 바로 위 표와 붙임
      const up = [];
      let prev = table.previousElementSibling;
      while (prev && prev.tagName === 'P' && !prev.textContent.trim() && !prev.querySelector('img,table,.nobj,.pagebreak')) { up.push(prev); prev = prev.previousElementSibling; }
      if (!prev || prev.tagName !== 'TABLE' || prev.parentElement !== table.parentElement) { status('바로 아래(또는 위)에 붙일 표가 없습니다.'); return false; }
      return this.joinPair(prev, table, up);
    }
    if (next.parentElement !== table.parentElement) { status('바로 아래에 붙일 표가 없습니다.'); return false; }
    return this.joinPair(table, next, between);
  },
  joinPair(a, b, between) {
    this.block.clear();
    const keep = Sel.closest('td, th');
    const ga = this.grid(a), gb = this.grid(b);
    const cum = (w) => { const X = [0]; w.forEach((v, i) => X.push(X[i] + v)); return X; };
    const XA = cum(ga.widths);
    let XB = cum(gb.widths);
    const WA = XA[XA.length - 1], WB = XB[XB.length - 1];
    // 전체 너비가 조금만 다르면 아래 표를 위 표 너비에 맞춤
    if (Math.abs(WA - WB) > 0.5 && Math.abs(WA - WB) < WA * 0.1) XB = XB.map((x) => (x * WA) / WB);
    // 거의 같은 경계는 위 표 경계로 맞춤
    XB = XB.map((x) => { const near = XA.find((y) => Math.abs(y - x) < 3); return near != null ? near : x; });
    const P = [];
    for (const v of [...XA, ...XB].sort((p, q) => p - q)) if (!P.length || v - P[P.length - 1] > 0.5) P.push(v);
    const ix = (v) => { let best = 0; P.forEach((p, i) => { if (Math.abs(p - v) < Math.abs(P[best] - v)) best = i; }); return best; };
    const cells = [];
    for (const x of ga.cells) { const c1 = ix(XA[x.c]), c2 = ix(XA[x.c + x.cs]); cells.push({ el: x.el, r: x.r, rs: x.rs, c: c1, cs: Math.max(1, c2 - c1) }); }
    for (const x of gb.cells) { const c1 = ix(XB[x.c]), c2 = ix(XB[x.c + x.cs]); cells.push({ el: x.el, r: x.r + ga.nr, rs: x.rs, c: c1, cs: Math.max(1, c2 - c1) }); }
    between.forEach((p) => p.remove());
    b.remove();
    this.rebuild({ table: a, cells, nr: ga.nr + gb.nr, nc: P.length - 1, widths: P.slice(1).map((p, i) => p - P[i]), heights: [...ga.heights, ...gb.heights] });
    const t = keep && keep.isConnected ? keep : a.rows[0].cells[0];
    Sel.caretInto(t.querySelector('p') || t);
    return true;
  },

  // ---------- 크기 ----------
  // 쪽 나눔 때문에 늘려 둔 줄 높이(다음 쪽으로 밀린 간격)를 빼고 원래 높이를 재도록, 잠시 쪽 간격 규칙을 끄고 측정
  natural(fn) {
    const ss = ['page-gaps', 'jfy-css'].map((id) => document.getElementById(id)).filter((s) => s && !s.disabled);
    if (!ss.length) return fn();
    ss.forEach((s) => { s.disabled = true; });
    try { return fn(); } finally { ss.forEach((s) => { s.disabled = false; }); }
  },
  equalWidths() {
    const table = this.block.active() ? this.block.table : this.current();
    if (!table) return;
    const g = this.grid(table);
    const rc = this.block.active() ? this.block.rect() : { c1: 0, c2: g.nc - 1 };
    const sum = g.widths.slice(rc.c1, rc.c2 + 1).reduce((a, b) => a + b, 0);
    const w = sum / (rc.c2 - rc.c1 + 1);
    for (let c = rc.c1; c <= rc.c2; c++) g.widths[c] = w;
    setColWidths(table, g.widths);
  },
  equalHeights() {
    const table = this.block.active() ? this.block.table : this.current();
    if (!table) return;
    const trs = rowsOf(table);
    const rc = this.block.active() ? this.block.rect() : { r1: 0, r2: trs.length - 1 };
    // 한글처럼: 고른 줄들의 전체 높이는 그대로 두고 그 안에서 똑같이 나눔
    const rows = trs.slice(rc.r1, rc.r2 + 1);
    if (rows.length < 2) return;
    const z = App.zoom || 1;
    const { total, mins } = this.natural(() => {
      const total = rows.reduce((a, tr) => a + tr.getBoundingClientRect().height / z, 0);
      // 글자 때문에 더 줄일 수 없는 최소 높이
      const saved = rows.map((tr) => tr.style.height);
      rows.forEach((tr) => (tr.style.height = '1px'));
      const mins = rows.map((tr) => tr.getBoundingClientRect().height / z);
      rows.forEach((tr, i) => (tr.style.height = saved[i]));
      return { total, mins };
    });
    // 최소 높이보다 작아지는 줄은 최소 높이로 두고 나머지 줄끼리 나눔
    const fixed = new Set();
    let each = total / rows.length;
    for (let k = 0; k < rows.length; k++) {
      const over = rows.findIndex((tr, i) => !fixed.has(i) && mins[i] > each + 0.5);
      if (over < 0) break;
      fixed.add(over);
      const free = rows.length - fixed.size;
      if (!free) break;
      each = (total - [...fixed].reduce((a, i) => a + mins[i], 0)) / free;
    }
    rows.forEach((tr, i) => (tr.style.height = (fixed.has(i) ? Math.ceil(mins[i]) : Math.round(each * 10) / 10) + 'px'));
    if (fixed.size) status(`글자가 많은 줄 ${fixed.size}개는 더 줄일 수 없어 그대로 두고, 나머지 줄을 같은 높이로 맞췄습니다.`);
  },
  resizeCols(dx) {
    const table = this.block.active() ? this.block.table : this.current();
    if (!table) return;
    const g = this.grid(table);
    let c1, c2;
    if (this.block.active()) ({ c1, c2 } = this.block.rect());
    else { const cur = g.cells.find((x) => x.el === this.currentCell()); c1 = cur.c; c2 = cur.c + cur.cs - 1; }
    for (let c = c1; c <= c2; c++) g.widths[c] = Math.max(12, g.widths[c] + dx);
    setColWidths(table, g.widths);
  },
  resizeRows(dy) {
    const table = this.block.active() ? this.block.table : this.current();
    if (!table) return;
    const trs = rowsOf(table);
    const g = this.grid(table);
    let r1, r2;
    if (this.block.active()) ({ r1, r2 } = this.block.rect());
    else { const cur = g.cells.find((x) => x.el === this.currentCell()); r1 = cur.r; r2 = cur.r + cur.rs - 1; }
    const hs = this.natural(() => trs.map((tr) => tr.getBoundingClientRect().height / App.zoom));
    for (let r = r1; r <= r2; r++) trs[r].style.height = Math.max(10, Math.round(hs[r] + dy)) + 'px';
  },

  // Alt+방향키: 표 전체 크기는 그대로, 선택한 칸/줄만 커지고 이웃이 줄어듦
  resizeKeep(dx, dy) {
    if (!this.block.active()) return;
    const table = this.block.table;
    const g = this.grid(table);
    const rc = this.block.rect();
    const MIN = 12;
    if (dx) {
      const w = g.widths.slice();
      if (rc.c2 + 1 < g.nc) {
        const d = Math.max(-(w[rc.c2] - MIN), Math.min(dx, w[rc.c2 + 1] - MIN));
        w[rc.c2] += d; w[rc.c2 + 1] -= d;
      } else if (rc.c1 > 0) {
        const d = Math.max(-(w[rc.c1] - MIN), Math.min(dx, w[rc.c1 - 1] - MIN));
        w[rc.c1] += d; w[rc.c1 - 1] -= d;
      } else { status('표 전체가 선택되어 있어 크기를 나눌 칸이 없습니다.'); return; }
      setColWidths(table, w);
    }
    if (dy) {
      const trs = rowsOf(table);
      const hs = this.natural(() => trs.map((tr) => tr.getBoundingClientRect().height / App.zoom));
      let a = rc.r2, b = rc.r2 + 1;
      if (b >= trs.length) { a = rc.r1; b = rc.r1 - 1; }
      if (b < 0) { status('표 전체가 선택되어 있어 크기를 나눌 줄이 없습니다.'); return; }
      const d = Math.max(-(hs[a] - 10), Math.min(dy, hs[b] - 10));
      trs[a].style.height = Math.round(hs[a] + d) + 'px';
      trs[b].style.height = Math.round(hs[b] - d) + 'px';
    }
  },

  // Shift+방향키: 선택한 셀만 크기 바꾸기 (같은 칸/줄의 다른 셀은 그대로)
  resizeCellsOnly(dx, dy) {
    if (!this.block.active()) return;
    const table = this.block.table;
    const g = this.grid(table);
    const sel = new Set(this.block.cells());
    const trs = rowsOf(table);
    const hs = this.natural(() => trs.map((tr) => Math.max(parseFloat(tr.style.height) || 0, tr.getBoundingClientRect().height / App.zoom)));
    const X = [0]; g.widths.forEach((w, i) => X.push(X[i] + w));
    const Y = [0]; for (let i = 0; i < g.nr; i++) Y.push(Y[i] + (hs[i] || 20));
    const geo = g.cells.map((c) => ({ el: c.el, x0: X[c.c], x1: X[c.c + c.cs], y0: Y[c.r], y1: Y[c.r + c.rs] }));
    const MIN = 10;
    const overlap = (a0, a1, b0, b1) => a0 < b1 - 0.5 && b0 < a1 - 0.5;
    const selGeo = geo.filter((q) => sel.has(q.el));
    const move = (axis, d) => {
      const [p0, p1, q0, q1] = axis === 'x' ? ['x0', 'x1', 'y0', 'y1'] : ['y0', 'y1', 'x0', 'x1'];
      // 선택 셀의 뒤쪽 경계와 맞닿은 이웃
      const changes = [];
      for (const s of selGeo) {
        const nb = geo.filter((n) => !sel.has(n.el) && Math.abs(n[p0] - s[p1]) < 0.5 && overlap(n[q0], n[q1], s[q0], s[q1]));
        if (!nb.length) return '표 가장자리에 있는 셀은 셀만 따로 크기를 바꿀 수 없습니다. Ctrl+방향키를 쓰세요.';
        for (const n of nb) {
          // 이웃이 선택 영역 밖 줄/칸까지 걸쳐 있으면 불가
          const covered = selGeo.filter((t) => Math.abs(t[p1] - s[p1]) < 0.5).reduce((acc, t) => { acc.push([t[q0], t[q1]]); return acc; }, []);
          const inside = covered.some(([a, b]) => n[q0] >= a - 0.5 && n[q1] <= b + 0.5) || covered.reduce((lo, [a]) => Math.min(lo, a), Infinity) <= n[q0] + 0.5 && covered.reduce((hi, [, b]) => Math.max(hi, b), -Infinity) >= n[q1] - 0.5;
          if (!inside) return '합쳐진 이웃 셀 때문에 이 셀만 크기를 바꿀 수 없습니다.';
          if (n[p1] - (n[p0] + d) < MIN) return null;
          changes.push(() => { n[p0] += d; });
        }
        if (s[p1] + d - s[p0] < MIN) return null;
        changes.push(() => { s[p1] += d; });
      }
      changes.forEach((f) => f());
      return true;
    };
    const res = dx ? move('x', dx) : move('y', dy);
    if (res !== true) { if (res) status(res); return; }
    // 새 경계로 격자 다시 만들기
    const uniq = (arr) => Array.from(new Set(arr.map((v) => Math.round(v * 10) / 10))).sort((a, b) => a - b);
    const xs = uniq(geo.flatMap((q) => [q.x0, q.x1]));
    const ys = uniq(geo.flatMap((q) => [q.y0, q.y1]));
    const ix = (arr, v) => arr.findIndex((a) => Math.abs(a - Math.round(v * 10) / 10) < 0.05);
    const ng = {
      table, nr: ys.length - 1, nc: xs.length - 1,
      widths: xs.slice(1).map((x, i) => x - xs[i]),
      heights: ys.slice(1).map((y, i) => Math.round(y - ys[i])),
      cells: geo.map((q) => ({ el: q.el, c: ix(xs, q.x0), cs: ix(xs, q.x1) - ix(xs, q.x0), r: ix(ys, q.y0), rs: ix(ys, q.y1) - ix(ys, q.y0) })),
    };
    this.rebuild(ng);
    // 셀 블록 다시 표시
    const cs = ng.cells.filter((c) => sel.has(c.el));
    this.block.table = table;
    this.block.anchor = { r: Math.min(...cs.map((c) => c.r)), c: Math.min(...cs.map((c) => c.c)) };
    this.block.focus = { r: Math.max(...cs.map((c) => c.r + c.rs - 1)), c: Math.max(...cs.map((c) => c.c + c.cs - 1)) };
    this.block.paint();
  },

  // 셀 속성 적용
  // 셀 대각선 (╲ down, ╱ up, ╳ both)
  setDiag(td, dir, color = '#000000', width = 1) {
    if (!dir || dir === 'none') { delete td.dataset.diag; delete td.dataset.dgc; delete td.dataset.dgw; td.style.backgroundImage = ''; td.style.backgroundSize = ''; td.style.backgroundRepeat = ''; return; }
    td.dataset.diag = dir; td.dataset.dgc = color; td.dataset.dgw = String(width);
    Table.paintDiag(td);
  },
  paintDiag(td) {
    const dir = td.dataset.diag;
    if (!dir) return;
    const c = td.dataset.dgc || '#000000', w = +td.dataset.dgw || 1;
    const ln = (x1, y1, x2, y2) => `<line x1='${x1}' y1='${y1}' x2='${x2}' y2='${y2}' stroke='${c}' stroke-width='${w}' vector-effect='non-scaling-stroke'/>`;
    let body = '';
    if (dir === 'down' || dir === 'both') body += ln(0, 0, 100, 100);
    if (dir === 'up' || dir === 'both') body += ln(0, 100, 100, 0);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>${body}</svg>`;
    td.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    td.style.backgroundSize = '100% 100%';
    td.style.backgroundRepeat = 'no-repeat';
  },
  // ---------- 테두리 ----------
  // [id, 이름, 한글 선 종류, 화면(CSS) 선 종류]
  BORDER_KINDS: [
    ['solid', '실선', 'SOLID', 'solid'], ['dashed', '파선', 'DASH', 'dashed'], ['dotted', '점선', 'DOT', 'dotted'],
    ['dashdot', '일점쇄선', 'DASH_DOT', 'dashed'], ['dashdotdot', '이점쇄선', 'DASH_DOT_DOT', 'dashed'], ['longdash', '긴 파선', 'LONG_DASH', 'dashed'],
    ['double', '이중선', 'DOUBLE_SLIM', 'double'], ['slimthick', '얇고 굵은 이중선', 'SLIM_THICK', 'double'], ['thickslim', '굵고 얇은 이중선', 'THICK_SLIM', 'double'],
    ['triple', '삼중선', 'SLIM_THICK_SLIM', 'double'],
  ],
  SIDE_KEY: { Top: 'bt', Right: 'br', Bottom: 'bb', Left: 'bl' },
  kindOf(id) { return this.BORDER_KINDS.find((k) => k[0] === id) || this.BORDER_KINDS[0]; },
  kindFromHwp(t) { return this.BORDER_KINDS.find((k) => k[2] === t) || null; },
  // 셀 한 변의 현재 선 {kind, mm, color} (kind 'none' 이면 없음)
  sideGet(td, S) {
    const cs = getComputedStyle(td);
    const color = cssColorToHex(cs['border' + S + 'Color']) || '#000000';
    const st = cs['border' + S + 'Style'];
    if (!st || st === 'none' || st === 'hidden' || !parseFloat(cs['border' + S + 'Width'])) return { kind: 'none', mm: 0.12, color };
    const d = td.dataset[this.SIDE_KEY[S]];
    if (d) { const [mm, hwp] = d.split('|'); const k = this.kindFromHwp(hwp); return { kind: k ? k[0] : 'solid', mm: +mm || 0.12, color }; }
    const px = parseFloat(cs['border' + S + 'Width']);
    return { kind: st === 'dashed' ? 'dashed' : st === 'dotted' ? 'dotted' : st === 'double' ? 'double' : 'solid', mm: px <= 1.01 ? 0.12 : Math.round(px * 25.4 / 96 * 100) / 100, color };
  },
  sideSet(td, S, spec) {
    const key = this.SIDE_KEY[S];
    if (!spec || spec.kind === 'keep') return;
    if (spec.kind === 'none') { td.style['border' + S] = 'none'; delete td.dataset[key]; return; }
    const k = this.kindOf(spec.kind);
    const mm = Math.max(0.05, +spec.mm || 0.12);
    let px = mm * 96 / 25.4;
    if (k[3] === 'double') px = Math.max(3, px);
    px = Math.max(1, Math.round(px * 2) / 2);
    td.style['border' + S] = `${px}px ${k[3]} ${spec.color || '#000000'}`;
    td.dataset[key] = `${Math.round(mm * 100) / 100}|${k[2]}`;
  },
  // 선택 범위(셀 블록 또는 커서 셀)에 변마다 선 적용
  // specs: {top, bottom, left, right, inH(안쪽 가로), inV(안쪽 세로)}
  applyBorders(specs) {
    const td0 = this.block.active() ? this.block.cells()[0] : this.currentCell();
    if (!td0) return;
    const table = td0.closest('table');
    const g = this.grid(table);
    let rc;
    if (this.block.active()) rc = this.block.rect();
    else { const x = g.cells.find((c) => c.el === td0); rc = { r1: x.r, r2: x.r + x.rs - 1, c1: x.c, c2: x.c + x.cs - 1 }; }
    const inR = (x) => x.r >= rc.r1 && x.r + x.rs - 1 <= rc.r2 && x.c >= rc.c1 && x.c + x.cs - 1 <= rc.c2;
    const set = (el, S, spec) => this.sideSet(el, S, spec);
    const nb = (r, c) => (r >= 0 && c >= 0 && r < g.nr && c < g.nc ? this.cellAt(g, r, c) : null);
    for (const x of g.cells.filter(inR)) {
      const top = x.r === rc.r1, bot = x.r + x.rs - 1 === rc.r2, lef = x.c === rc.c1, rig = x.c + x.cs - 1 === rc.c2;
      const sT = top ? specs.top : specs.inH, sB = bot ? specs.bottom : specs.inH;
      const sL = lef ? specs.left : specs.inV, sR = rig ? specs.right : specs.inV;
      set(x.el, 'Top', sT); set(x.el, 'Bottom', sB); set(x.el, 'Left', sL); set(x.el, 'Right', sR);
      // 붙어 있는 바깥 셀의 맞닿은 변도 같게 (겹친 선에서 굵은 쪽이 이기지 않게)
      if (top && sT && sT.kind !== 'keep') for (let c = x.c; c < x.c + x.cs; c++) { const o = nb(x.r - 1, c); if (o && !inR(o)) set(o.el, 'Bottom', sT); }
      if (bot && sB && sB.kind !== 'keep') for (let c = x.c; c < x.c + x.cs; c++) { const o = nb(x.r + x.rs, c); if (o && !inR(o)) set(o.el, 'Top', sB); }
      if (lef && sL && sL.kind !== 'keep') for (let r = x.r; r < x.r + x.rs; r++) { const o = nb(r, x.c - 1); if (o && !inR(o)) set(o.el, 'Right', sL); }
      if (rig && sR && sR.kind !== 'keep') for (let r = x.r; r < x.r + x.rs; r++) { const o = nb(r, x.c + x.cs); if (o && !inR(o)) set(o.el, 'Left', sR); }
    }
  },
  // 지금 셀의 세로 정렬 (top/middle/bottom)
  cellVAlign() {
    const td = this.block.active() ? this.block.cells()[0] : this.currentCell();
    if (!td) return null;
    const v = getComputedStyle(td).verticalAlign;
    return v === 'top' ? 'top' : v === 'bottom' ? 'bottom' : 'middle';
  },
  applyCellProps(p) {
    const cells = this.block.active() ? this.block.cells() : [this.currentCell()].filter(Boolean);
    if (!cells.length) return;
    const table = cells[0].closest('table');
    for (const td of cells) {
      if (p.bg !== undefined) td.style.backgroundColor = p.bg || '';
      if (p.valign) td.style.verticalAlign = p.valign;
      if (p.diag) Table.setDiag(td, p.diag.dir, p.diag.color, p.diag.width);

    }
    if (p.borders) this.applyBorders(p.borders);
    if (p.bgImg !== undefined) {
      if (p.bgImg === '') cells.forEach((td) => { td.style.backgroundImage = ''; delete td.dataset.bgmode; });
      else if (p.bgImg) this.applyBgImage(cells, p.bgImg, p.bgMode, p.bgSpan).then(() => App.changed(), (e) => status('배경 그림을 넣지 못했습니다: ' + e.message));
      else if (p.bgMode) {
        cells.forEach((td) => { if (td.dataset.bgmode === 'one') td.dataset.bgfit = p.bgMode; else if (td.dataset.bgmode) td.dataset.bgmode = p.bgMode; });
        this.layoutBg(table);
      }
    }
    if (p.tableAlign) {
      table.classList.remove('tbl-center', 'tbl-right'); delete table.dataset.shift; table.style.marginLeft = '';
      if (p.tableAlign !== 'left') table.classList.add('tbl-' + p.tableAlign);
    }
  },

  // ---------- 표 밖으로 (Shift+Esc) ----------
  exitAfter() {
    const td = Sel.closest('td, th') || (this.block.active() ? this.block.cells()[0] : null);
    if (!td) return false;
    const t = td.closest('table');
    this.block.clear();
    let next = t.nextElementSibling;
    while (next && (next.classList.contains('pagebreak') || next.classList.contains('colbreak') || next.getAttribute('contenteditable') === 'false')) next = next.nextElementSibling;
    if (next && /^(UL|OL)$/.test(next.tagName)) next = next.querySelector('li') || next;
    if (!next || next.tagName === 'TABLE' || !/^(P|H[1-6]|DIV|LI)$/.test(next.tagName)) {
      next = h('p', {}, h('br'));
      t.after(next);
    }
    Sel.editor.focus({ preventScroll: true });
    Sel.caretInto(next);
    App.scrollToSelection && App.scrollToSelection();
    return true;
  },

  // ---------- 표 밖 왼쪽 (한글 Shift+Esc: 표 앞에 커서) ----------
  // 누리글의 표는 문단 밖의 블록이므로 '표 앞 자리'를 가상 커서로 보여 주고,
  // 글자를 치면 표 앞에 새 문단을 만들어 거기에 씀. Enter는 표 위에 빈 줄을 넣음.
  outside: null,
  outsideSide: 'before',
  exitBefore() {
    const td = Sel.closest('td, th') || (this.block.active() ? this.block.cells()[0] : null);
    if (!td) return false;
    const t = td.closest('table');
    this.block.clear();
    this.outsideStart(t, 'before');
    return true;
  },
  // side: 'before' 표 앞(왼쪽), 'after' 표 뒤(오른쪽)
  outsideStart(t, side = 'before') {
    this.outsideEnd();
    this.outside = t;
    this.outsideSide = side;
    Sel.editor.focus({ preventScroll: true });
    window.getSelection().removeAllRanges();
    this.outsideDraw();
    const c = $('#tbl-out-caret');
    if (c) {
      const r = c.getBoundingClientRect();
      const ws = $('#workspace');
      const wr = ws.getBoundingClientRect();
      if (r.top < wr.top + 20 || r.bottom > wr.bottom - 20) ws.scrollTop += r.top - wr.top - wr.height / 3;
    }
    status(side === 'before'
      ? '표 앞: 글자를 치면 표 위에 새 문단이 생기고, Enter는 표 위에 빈 줄을 넣습니다. End: 표 뒤로, →/↓: 표 안으로.'
      : '표 뒤: 글자를 치거나 Enter를 누르면 표 아래에 새 문단이 생깁니다. Home: 표 앞으로, ←/↑: 표 안으로.');
  },
  outsideDraw() {
    const old = $('#tbl-out-caret');
    if (old) old.remove();
    const t = this.outside;
    if (!t || !t.isConnected) { this.outside = null; return; }
    window.getSelection().removeAllRanges();
    const page = $('#page').getBoundingClientRect();
    const r = t.getBoundingClientRect();
    const z = App.zoom;
    const after = this.outsideSide === 'after';
    const row = after ? t.rows[t.rows.length - 1] : t.rows[0];
    const rr = row ? row.getBoundingClientRect() : { top: r.top, bottom: r.top + 20, height: 20 };
    const hgt = Math.max(12 * z, Math.min(rr.height, 28 * z));
    const top = after ? rr.bottom - hgt : rr.top;
    const left = after ? r.right + 2 * z : r.left - 3 * z;
    $('#page').append(h('div', { id: 'tbl-out-caret', class: 'no-print', style: { left: (left - page.left) / z + 'px', top: (top - page.top) / z + 'px', height: hgt / z + 'px' } }));
  },
  outsideEnd() {
    this.outside = null;
    const old = $('#tbl-out-caret');
    if (old) old.remove();
  },
  // 표 앞/뒤에 새 문단을 만들어 커서를 넣음
  outsideNewPara() {
    const t = this.outside;
    const p = h('p', {}, h('br'));
    if (this.outsideSide === 'after') t.after(p); else t.before(p);
    this.outsideEnd();
    Sel.caretInto(p);
    return p;
  },
  outsideKey(e) {
    const t = this.outside;
    if (!t || !t.isConnected) { this.outsideEnd(); return false; }
    const after = this.outsideSide === 'after';
    const k = keyString(e);
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    const skip = (p, dir) => { while (p && (p.classList.contains('pagebreak') || p.classList.contains('colbreak'))) p = p[dir]; return p; };
    const prevBlock = () => skip(t.previousElementSibling, 'previousElementSibling');
    const nextBlock = () => skip(t.nextElementSibling, 'nextElementSibling');
    const isEmptyP = (p) => p && p.tagName === 'P' && !p.textContent.replace(/[\s​]/g, '') && !p.querySelector('img, .nobj, table');
    const caretAt = (blk, end) => {
      this.outsideEnd();
      if (blk.tagName === 'TABLE') { this.outsideStart(blk, end ? 'after' : 'before'); return; }
      let x = blk;
      if (/^(UL|OL)$/.test(blk.tagName)) { const lis = blk.querySelectorAll('li'); x = (end ? lis[lis.length - 1] : lis[0]) || blk; }
      const r = document.createRange(); r.selectNodeContents(x); r.collapse(!end); Sel.set(r);
    };
    const firstCell = () => { const td = t.rows[0] && t.rows[0].cells[0]; this.outsideEnd(); if (td) Sel.caretInto(td.querySelector('p') || td); };
    const lastCell = () => {
      const row = t.rows[t.rows.length - 1];
      const td = row && row.cells[row.cells.length - 1];
      this.outsideEnd();
      if (td) { const r = document.createRange(); r.selectNodeContents(td.querySelector('p:last-of-type') || td); r.collapse(false); Sel.set(r); }
    };
    // 글자 입력(한글 조합 포함)·붙여넣기: 새 문단을 만들고 그곳에서 계속
    if (e.isComposing || e.keyCode === 229 || e.key === 'Process' || (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) || k === 'Ctrl+V' || k === 'Shift+Insert') {
      History.checkpoint();
      this.outsideNewPara();
      App.changed();
      return false; // 기본 동작(글자 넣기)은 새 문단에서
    }
    if (!k || /^(Ctrl|Alt|Shift|Meta)$/.test(k)) return true;
    if (k === 'Escape' || k === 'Shift+Escape') { stop(); return true; }
    if (k === 'Home' || k === 'End') {
      stop();
      const side = k === 'End' ? 'after' : 'before';
      if (side !== this.outsideSide) this.outsideStart(t, side);
      return true;
    }
    if (k === 'Enter') {
      stop();
      History.checkpoint();
      if (after) { this.outsideNewPara(); App.changed(); return true; }
      t.before(h('p', {}, h('br')));
      App.changed();
      App.layout && App.layout();
      this.outsideDraw();
      return true;
    }
    if (!after) {
      if (k === 'Right' || k === 'Down' || k === 'Tab') { stop(); firstCell(); return true; }
      if (k === 'Left' || k === 'Up') { stop(); const p = prevBlock(); if (p) caretAt(p, true); return true; }
      if (k === 'Backspace') {
        stop();
        const p = prevBlock();
        if (!p) return true;
        if (isEmptyP(p)) { History.checkpoint(); p.remove(); App.changed(); App.layout && App.layout(); this.outsideDraw(); return true; }
        caretAt(p, true);
        return true;
      }
      if (k === 'Delete') { stop(); this.outsideEnd(); this.select(t); return true; }
    } else {
      if (k === 'Left' || k === 'Up' || k === 'Shift+Tab') { stop(); lastCell(); return true; }
      if (k === 'Right' || k === 'Down') { stop(); const p = nextBlock(); if (p) caretAt(p, false); return true; }
      if (k === 'Delete') {
        stop();
        const p = nextBlock();
        if (!p) return true;
        if (isEmptyP(p) && p.nextElementSibling) { History.checkpoint(); p.remove(); App.changed(); App.layout && App.layout(); this.outsideDraw(); return true; }
        caretAt(p, false);
        return true;
      }
      if (k === 'Backspace') { stop(); this.outsideEnd(); this.select(t); return true; }
    }
    // 그 밖의 단축키(저장 등)는 그대로 처리. 편집 단축키는 커서만 표 안으로.
    if (/^(Ctrl\+(X|C|A|Z|Y|B|I|U)|Alt\+)/.test(k)) { if (after) lastCell(); else firstCell(); return false; }
    return false;
  },
  // 표 바로 뒤 문단 맨 앞에서 ← → 표 뒤, 표 바로 앞 문단 끝에서 → → 표 앞
  arrowToTable(dir) {
    const s = window.getSelection();
    if (!s.rangeCount || !s.isCollapsed) return false;
    const r = s.getRangeAt(0);
    const blk = blockOf(r.startContainer);
    if (!blk || blk === Sel.editor || blk.closest('td, th, li') || !blk.parentElement) return false;
    const sib = dir < 0 ? blk.previousElementSibling : blk.nextElementSibling;
    if (!sib || sib.tagName !== 'TABLE') return false;
    const q = document.createRange();
    q.selectNodeContents(blk);
    if (dir < 0) q.setEnd(r.startContainer, r.startOffset); else q.setStart(r.startContainer, r.startOffset);
    const frag = q.cloneContents();
    if (frag.textContent.replace(/[​]/g, '') || frag.querySelector && frag.querySelector('img, .nobj, table')) return false;
    this.outsideStart(sib, dir < 0 ? 'after' : 'before');
    return true;
  },

  // ---------- 표 고르기·옮기기 (표 바깥 테두리 바로 바깥을 누름) ----------
  selected: null,
  select(t) {
    this.deselect();
    this.selected = t;
    t.classList.add('tbl-sel');
    this.block.clear();
    window.getSelection().removeAllRanges();
    status('표를 골랐습니다. 끌면 옮겨지고, Delete: 표 지우기, Esc: 고르기 풀기. 표 안을 누르면 글자를 고칠 수 있습니다.');
  },
  deselect() {
    if (this.selected) this.selected.classList.remove('tbl-sel');
    this.selected = null;
  },
  // 점(x,y)이 어느 표의 바깥 테두리 바로 바깥(7px 안)인지
  tableRimAt(x, y) {
    const ts = Array.from(Sel.editor.querySelectorAll('table')).reverse(); // 안쪽 표 먼저
    for (const t of ts) {
      const r = t.getBoundingClientRect();
      const out = 7, inn = 1;
      const inOuter = x >= r.left - out && x <= r.right + out && y >= r.top - out && y <= r.bottom + out;
      const inInner = x > r.left - inn && x < r.right + inn && y > r.top - inn && y < r.bottom + inn;
      if (inOuter && !inInner) return t;
    }
    return null;
  },
  startMove(e, t) {
    const z = App.zoom || 1;
    if (Shapes.isFloatingTable(t)) { Shapes.gripTable = t; Shapes.startTableMove(e); return; }
    const x0 = e.clientX, y0 = e.clientY;
    const shift0 = +t.dataset.shift || 0;
    const aligned = t.classList.contains('tbl-center') || t.classList.contains('tbl-right');
    const left0 = (t.getBoundingClientRect().left - Sel.editor.getBoundingClientRect().left) / z;
    const maxShift = Math.max(0, Sel.editor.clientWidth - t.offsetWidth);
    let moved = false, drop = null;
    const guide = h('div', { class: 'tbl-drop no-print' });
    const move = (ev) => {
      const dx = (ev.clientX - x0) / z, dy = (ev.clientY - y0) / z;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      if (!moved) { History.checkpoint(); moved = true; $('#page').append(guide); }
      // 가로: 왼쪽에서 떨어진 거리 (표 안의 표는 제외)
      if (t.parentElement === Sel.editor && Math.abs(dx) >= 2) {
        const nx = Math.round(Math.max(0, Math.min(maxShift, (aligned ? left0 : shift0) + dx)));
        t.classList.remove('tbl-center', 'tbl-right');
        if (nx > 0) { t.dataset.shift = nx; t.style.marginLeft = nx + 'px'; } else { delete t.dataset.shift; t.style.marginLeft = ''; }
      }
      // 세로: 놓을 자리(문단 사이) 표시
      drop = null;
      if (t.parentElement === Sel.editor && Math.abs(dy) > 12) {
        const kids = Array.from(Sel.editor.children).filter((c) => c !== t && !c.classList.contains('pagebreak'));
        let best = null;
        for (const c of kids) {
          const r = c.getBoundingClientRect();
          if (ev.clientY < r.top + r.height / 2) { best = { el: c, before: true, y: r.top }; break; }
          best = { el: c, before: false, y: r.bottom };
        }
        if (best && !(best.before && best.el === t.nextElementSibling) && !(!best.before && best.el === t.previousElementSibling)) drop = best;
      }
      if (drop) {
        const pr = $('#page').getBoundingClientRect(), er = Sel.editor.getBoundingClientRect();
        guide.style.cssText = `top:${(drop.y - pr.top) / z}px;left:${(er.left - pr.left) / z}px;width:${er.width / z}px`;
        guide.hidden = false;
      } else guide.hidden = true;
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      guide.remove();
      if (!moved) return;
      if (drop) { if (drop.before) drop.el.before(t); else drop.el.after(t); Para.ensure(); }
      Look.apply(t);
      this.select(t);
      App.changed();
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  },

  // ---------- 셀 배경 그림 ----------
  // each: 셀마다 같은 그림 / one: 선택한 셀들을 한 장처럼 (그림을 잘라 셀마다 나눠 넣음)
  async applyBgImage(cells, url, mode, span) {
    mode = mode || 'stretch';
    const one = span === 'one' && cells.length > 1;
    await this.bgImage(url);
    const gid = one ? 'g' + Date.now().toString(36) : null;
    for (const td of cells) {
      td.style.backgroundImage = `url(${url})`;
      td.style.backgroundSize = td.style.backgroundPosition = td.style.backgroundRepeat = '';
      delete td.dataset.bgfit; delete td.dataset.bggid;
      if (one) { td.dataset.bgmode = 'one'; td.dataset.bgfit = mode; td.dataset.bggid = gid; }
      else td.dataset.bgmode = mode;
    }
    const table = cells[0].closest('table');
    if (table) this.layoutBg(table);
  },
  // 배경 그림 불러 두기 (크기 계산·저장할 때 자르기용)
  _bgCache: new Map(),
  bgImage(url) {
    let c = this._bgCache.get(url);
    if (!c) {
      const im = new Image();
      c = { im, ready: false };
      c.p = new Promise((res, rej) => { im.onload = () => { c.ready = true; res(im); }; im.onerror = () => rej(new Error('그림을 읽을 수 없습니다')); });
      im.src = url;
      this._bgCache.set(url, c);
    }
    return c.p;
  },
  bgUrl(td) { return (/url\(["']?([^"')]+)["']?\)/.exec(td.style.backgroundImage) || [])[1] || null; },
  // "하나로" 넣은 그림: 셀 묶음 전체 크기에 맞춰 셀마다 보이는 부분을 계산 (셀 크기가 바뀌면 다시)
  bgGeom(td) {
    const table = td.closest('table');
    const gid = td.dataset.bggid;
    const group = gid && table ? Array.from(table.querySelectorAll(`td[data-bggid="${gid}"], th[data-bggid="${gid}"]`)) : [td];
    const z = App.zoom || 1;
    const rs = group.map((c) => c.getBoundingClientRect());
    const gx = Math.min(...rs.map((r) => r.left)) / z, gy = Math.min(...rs.map((r) => r.top)) / z;
    const W = Math.max(...rs.map((r) => r.right)) / z - gx, H = Math.max(...rs.map((r) => r.bottom)) / z - gy;
    const r = td.getBoundingClientRect();
    const cx = r.left / z, cy = r.top / z;
    const c = this._bgCache.get(this.bgUrl(td));
    const nw = c && c.ready ? c.im.naturalWidth : W, nh = c && c.ready ? c.im.naturalHeight : H;
    const fit = td.dataset.bgmode === 'one' ? td.dataset.bgfit || 'stretch' : td.dataset.bgmode;
    let iw = W, ih = H, ox = gx, oy = gy;
    if (fit === 'cover') { const sc = Math.max(W / nw, H / nh); iw = nw * sc; ih = nh * sc; ox = gx + (W - iw) / 2; oy = gy + (H - ih) / 2; }
    else if (fit === 'center') { iw = nw; ih = nh; ox = gx + (W - iw) / 2; oy = gy + (H - ih) / 2; }
    else if (fit === 'tile') { iw = nw; ih = nh; }
    return { fit, iw, ih, dx: ox - cx, dy: oy - cy, w: r.width / z, h: r.height / z, cache: c };
  },
  layoutBg(table) {
    for (const td of table.querySelectorAll('td[data-bgmode="one"], th[data-bgmode="one"]')) {
      const url = this.bgUrl(td);
      if (!url) continue;
      const c = this._bgCache.get(url);
      if (!c || !c.ready) { this.bgImage(url).then(() => this.layoutBg(table), () => {}); continue; }
      const g = this.bgGeom(td);
      td.style.backgroundSize = `${g.iw.toFixed(1)}px ${g.ih.toFixed(1)}px`;
      td.style.backgroundPosition = `${g.dx.toFixed(1)}px ${g.dy.toFixed(1)}px`;
      td.style.backgroundRepeat = g.fit === 'tile' ? 'repeat' : 'no-repeat';
    }
  },
  // 한글처럼 셀 안 첫 줄 위와 마지막 줄 아래에는 줄 간격 여분을 두지 않음 (줄 간격 300%라도 셀이 커지지 않게)
  fitCellLines(root) {
    for (const td of (root || Sel.editor).querySelectorAll('td, th')) {
      const ps = Array.from(td.children).filter((c) => c.tagName === 'P');
      ps.forEach((p, i) => {
        if (i !== 0 && i !== ps.length - 1) { if (p.style.getPropertyValue('--lsx')) p.style.removeProperty('--lsx'); return; }
        const cs = getComputedStyle(p);
        const lh = parseFloat(cs.lineHeight), pf = parseFloat(cs.fontSize);
        let extra = 0;
        if (lh && pf && lh / pf > 1.05) {
          let fs = 0;
          for (const t of p.querySelectorAll('span')) if (t.textContent.trim()) fs = Math.max(fs, parseFloat(getComputedStyle(t).fontSize) || 0);
          if (!fs) fs = pf;
          extra = Math.max(0, (lh / pf - 1) * fs);
        }
        const v = extra ? extra.toFixed(1) + 'px' : '';
        if (p.style.getPropertyValue('--lsx') !== v) { if (v) p.style.setProperty('--lsx', v); else p.style.removeProperty('--lsx'); }
      });
    }
  },
  layoutBgAll() { for (const t of Sel.editor.querySelectorAll('table')) if (t.querySelector('[data-bgmode="one"]')) this.layoutBg(t); },
  // 저장용: 화면에 보이는 대로 셀 크기의 그림으로 굽기 (HWPX는 셀마다 '크기에 맞추어'만 되므로)
  bakeBg(td) {
    const url = this.bgUrl(td);
    const c = url && this._bgCache.get(url);
    if (!c || !c.ready) return url;
    const g = this.bgGeom(td);
    const im = c.im;
    const k = Math.max(1, Math.min(3, im.naturalWidth / Math.max(1, g.iw)), 1);
    const kk = Math.min(k, 3000 / Math.max(1, g.w), 3000 / Math.max(1, g.h));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(g.w * kk)); cv.height = Math.max(1, Math.round(g.h * kk));
    const cx = cv.getContext('2d');
    const jpeg = /^data:image\/jpe?g/i.test(url);
    if (jpeg) { cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); }
    if (g.fit === 'tile') {
      cx.scale(kk, kk);
      const pat = cx.createPattern(im, 'repeat');
      pat.setTransform(new DOMMatrix().translate(g.dx, g.dy));
      cx.fillStyle = pat; cx.fillRect(0, 0, g.w, g.h);
    } else cx.drawImage(im, g.dx * kk, g.dy * kk, g.iw * kk, g.ih * kk);
    return cv.toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.9);
  },

  // ---------- 셀 이동 ----------
  moveCell(forward) {
    const td = this.currentCell();
    if (!td) return false;
    const table = td.closest('table');
    const all = Array.from(table.querySelectorAll(':scope > tbody > tr > td, :scope > tbody > tr > th, :scope > tr > td'));
    let i = all.indexOf(td) + (forward ? 1 : -1);
    if (i >= all.length) {
      this.insertRow(true);
      const all2 = Array.from(table.querySelectorAll(':scope > tbody > tr > td, :scope > tbody > tr > th'));
      const lastRow = rowsOf(table).pop();
      Sel.caretInto(lastRow.cells[0].firstElementChild || lastRow.cells[0]);
      return true;
    }
    if (i < 0) return true;
    const target = all[i];
    const r = document.createRange();
    r.selectNodeContents(target.firstElementChild || target);
    Sel.set(r);
    return true;
  },
};

// ---------- 셀 블록 (F5) ----------
Table.block = {
  table: null, anchor: null, focus: null, mode: 0,
  active() { return !!(this.table && this.table.isConnected && this.anchor); },
  start(td) {
    td = td || Table.currentCell();
    if (!td) return false;
    const table = td.closest('table');
    const g = Table.grid(table);
    const x = g.cells.find((c) => c.el === td);
    if (this.active() && this.table === table && this.mode === 1) {
      // F5 두 번: 확장 모드, 세 번: 표 전체
      this.mode = 2;
      status('셀 블록 확장: 방향키로 범위를 넓히세요.');
      this.paint();
      return true;
    }
    if (this.active() && this.table === table && this.mode === 2) {
      this.anchor = { r: 0, c: 0 };
      this.focus = { r: g.nr - 1, c: g.nc - 1 };
      this.mode = 3;
      this.paint();
      return true;
    }
    this.table = table;
    this.anchor = { r: x.r, c: x.c };
    this.focus = { r: x.r + x.rs - 1, c: x.c + x.cs - 1 };
    this.mode = 1;
    window.getSelection().removeAllRanges();
    Sel.editor.blur();
    this.paint();
    return true;
  },
  setRange(table, a, f) {
    this.table = table; this.anchor = a; this.focus = f; this.mode = 2;
    this.paint();
  },
  clear() {
    if (this.table) this.table.querySelectorAll('.cell-sel').forEach((c) => c.classList.remove('cell-sel'));
    document.querySelectorAll('#editor .cell-sel').forEach((c) => c.classList.remove('cell-sel'));
    const had = this.active();
    this.table = null; this.anchor = null; this.focus = null; this.mode = 0;
    $('#st-block').textContent = '';
    return had;
  },
  rect() {
    const g = Table.grid(this.table);
    return expandRect(g, {
      r1: Math.min(this.anchor.r, this.focus.r), r2: Math.max(this.anchor.r, this.focus.r),
      c1: Math.min(this.anchor.c, this.focus.c), c2: Math.max(this.anchor.c, this.focus.c),
    });
  },
  // 지금 블록이 걸친 칸(세로 줄) 또는 줄(가로 줄) 전체로 넓히기
  selectLine(kind) {
    if (!this.active()) return;
    const g = Table.grid(this.table);
    const rc = this.rect();
    if (kind === 'col') { this.anchor = { r: 0, c: rc.c1 }; this.focus = { r: g.nr - 1, c: rc.c2 }; }
    else { this.anchor = { r: rc.r1, c: 0 }; this.focus = { r: rc.r2, c: g.nc - 1 }; }
    this.mode = 2;
    this.paint();
    status(kind === 'col' ? '세로 줄 전체를 선택했습니다.' : '가로 줄 전체를 선택했습니다.');
  },
  cells() {
    if (!this.active()) return [];
    const g = Table.grid(this.table);
    const rc = this.rect();
    return g.cells.filter((x) => x.r >= rc.r1 && x.r <= rc.r2 && x.c >= rc.c1 && x.c <= rc.c2).map((x) => x.el);
  },
  paint() {
    document.querySelectorAll('#editor .cell-sel').forEach((c) => c.classList.remove('cell-sel'));
    const cells = this.cells();
    cells.forEach((c) => c.classList.add('cell-sel'));
    $('#st-block').textContent = cells.length ? `셀 블록 ${cells.length}개 (M 합치기 · S 나누기 · L 테두리/배경 · H/W 같게 · F7 세로 줄 · F8 가로 줄 · Ctrl·Alt·Shift+방향키 크기)` : '';
  },
  move(dr, dc, extend) {
    const g = Table.grid(this.table);
    const f = { r: Math.max(0, Math.min(g.nr - 1, this.focus.r + dr)), c: Math.max(0, Math.min(g.nc - 1, this.focus.c + dc)) };
    if (extend || this.mode >= 2) this.focus = f;
    else {
      const x = Table.cellAt(g, f.r, f.c);
      this.anchor = { r: x.r, c: x.c };
      this.focus = { r: x.r + x.rs - 1, c: x.c + x.cs - 1 };
      if (dr > 0 || dc > 0) { /* 이미 반영 */ }
    }
    this.paint();
  },
  clearContents() {
    this.cells().forEach((td) => { td.innerHTML = ''; td.append(h('p', {}, h('br'))); });
  },
};

// 마우스: 셀 드래그 블록, 칸/줄 경계 드래그로 크기 조절
Table.initMouse = function () {
  const ed = Sel.editor;
  let drag = null, cellDrag = null;
  const EDGE = 4;
  function edgeAt(e) {
    const td = e.target.closest && e.target.closest('td, th');
    if (!td || !ed.contains(td)) return null;
    const r = td.getBoundingClientRect();
    if (Math.abs(e.clientX - r.right) <= EDGE) return { type: 'col', td, side: 'right' };
    if (Math.abs(e.clientX - r.left) <= EDGE && td.cellIndex > 0) return { type: 'col', td: td.previousElementSibling || td, side: td.previousElementSibling ? 'right' : 'left' };
    if (Math.abs(e.clientY - r.bottom) <= EDGE) return { type: 'row', td };
    if (Math.abs(e.clientY - r.top) <= EDGE && td.parentElement.rowIndex > 0) return { type: 'row', td, top: true };
    return null;
  }
  ed.addEventListener('mousemove', (e) => {
    if (drag || cellDrag) return;
    const rim = e.buttons ? null : Table.tableRimAt(e.clientX, e.clientY);
    document.body.classList.toggle('tbl-move', !!rim);
    if (rim) { document.body.classList.remove('col-resize', 'row-resize'); return; }
    const eg = edgeAt(e);
    document.body.classList.toggle('col-resize', !!eg && eg.type === 'col');
    document.body.classList.toggle('row-resize', !!eg && eg.type === 'row');
  });
  ed.addEventListener('mouseleave', () => { if (!drag) document.body.classList.remove('col-resize', 'row-resize'); });
  // 본문 폭을 꽉 채운 표는 바깥 테두리 바깥이 쪽 여백(편집 영역 밖)이라 쪽 전체에서도 확인
  const pageEl = $('#page');
  pageEl.addEventListener('mousemove', (e) => {
    if (drag || cellDrag || ed.contains(e.target) || e.buttons) return;
    document.body.classList.toggle('tbl-move', !!Table.tableRimAt(e.clientX, e.clientY));
  });
  pageEl.addEventListener('mouseleave', () => document.body.classList.remove('tbl-move'));
  pageEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || ed.contains(e.target)) return;
    const rim = Table.tableRimAt(e.clientX, e.clientY);
    if (!rim) return;
    e.preventDefault();
    e.stopPropagation();
    Table.select(rim);
    Table.startMove(e, rim);
  }, true);
  ed.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const rim = Table.tableRimAt(e.clientX, e.clientY);
    if (rim) {
      e.preventDefault();
      Table.select(rim);
      Table.startMove(e, rim);
      return;
    }
    if (Table.selected) Table.deselect();
    const eg = edgeAt(e);
    if (eg) {
      e.preventDefault();
      History.checkpoint();
      const table = eg.td.closest('table');
      const g = Table.grid(table);
      const x = g.cells.find((c) => c.el === eg.td);
      if (eg.type === 'col') {
        const idx = eg.side === 'left' ? x.c - 1 : x.c + x.cs - 1;
        drag = { type: 'col', table, idx, widths: g.widths.slice(), x0: e.clientX };
        // 안쪽 세로선: 선 전체가 움직이고 표 너비는 그대로.
        // 셀 블록(F5) 안의 선이면 블록의 줄만, Ctrl을 누르면 그 셀의 줄만 (Shift: 칸 너비만 바꿔 표가 커짐)
        const inBlock = Table.block.active() && Table.block.table === table && Table.block.cells().includes(eg.td);
        if (idx >= 0 && idx + 1 < g.nc && !e.shiftKey && (e.ctrlKey || inBlock)) {
          const b = idx + 1;
          let r1 = x.r, r2 = x.r + x.rs - 1;
          if (inBlock) { const rc = Table.block.rect(); r1 = Math.min(r1, rc.r1); r2 = Math.max(r2, rc.r2); }
          // 경계에 닿는 셀이 위아래로 더 걸쳐 있으면 그 줄까지 넓힘
          for (let changed = true; changed;) {
            changed = false;
            for (const c of g.cells) {
              if ((c.c + c.cs === b || c.c === b) && c.r <= r2 && c.r + c.rs - 1 >= r1) {
                if (c.r < r1) { r1 = c.r; changed = true; }
                if (c.r + c.rs - 1 > r2) { r2 = c.r + c.rs - 1; changed = true; }
              }
            }
          }
          if (r1 > 0 || r2 < g.nr - 1) {
            const P = [0]; g.widths.forEach((w) => P.push(P[P.length - 1] + w));
            const cells = g.cells.map((c) => ({ ...c, x1: P[c.c], x2: P[c.c + c.cs], L: c.r >= r1 && c.r + c.rs - 1 <= r2 && c.c + c.cs === b, R: c.r >= r1 && c.r + c.rs - 1 <= r2 && c.c === b }));
            const lo = Math.max(...cells.filter((c) => c.L).map((c) => c.x1)) + 8;
            const hi = Math.min(...cells.filter((c) => c.R).map((c) => c.x2)) - 8;
            drag = { type: 'seg', table, g, cells, X: P[b], lo, hi, x0: e.clientX };
          }
        }
      } else {
        const trs = rowsOf(table);
        const i = eg.top ? x.r - 1 : x.r + x.rs - 1;
        const tr = trs[i], next = trs[i + 1];
        drag = { type: 'row', table, tr, h0: Table.natural(() => tr.getBoundingClientRect().height / App.zoom), y0: e.clientY };
        // 안쪽 가로선: 위 줄이 커진 만큼 아래 줄이 줄어 표 높이는 그대로 (Shift: 위 줄만 바꿔 표가 커짐)
        if (next && !e.shiftKey) {
          const z = App.zoom || 1;
          const minOf = (row) => { const sv = row.style.height; row.style.height = '1px'; const m = row.getBoundingClientRect().height / z; row.style.height = sv; return m; };
          drag.next = next;
          Table.natural(() => { drag.n0 = next.getBoundingClientRect().height / z; drag.tmin = minOf(tr); drag.nmin = minOf(next); });
        }
      }
      return;
    }
    const td = e.target.closest && e.target.closest('td, th');
    Table.block.clear();
    if (td && ed.contains(td) && !e.shiftKey) cellDrag = { td, table: td.closest('table'), started: false };
  });
  window.addEventListener('mousemove', (e) => {
    if (drag) {
      if (drag.type === 'col') {
        const dx = (e.clientX - drag.x0) / App.zoom;
        const w = drag.widths.slice();
        const i = drag.idx;
        if (i < 0) return;
        if (i + 1 < w.length && !e.shiftKey) {
          const total = w[i] + w[i + 1];
          w[i] = Math.max(12, Math.min(total - 12, w[i] + dx));
          w[i + 1] = total - w[i];
        } else w[i] = Math.max(12, w[i] + dx);
        setColWidths(drag.table, w);
      } else if (drag.type === 'seg') {
        const nx = Math.max(drag.lo, Math.min(drag.hi, drag.X + (e.clientX - drag.x0) / App.zoom));
        Table.regridX(drag.g, drag.cells.map((c) => [c.R ? nx : c.x1, c.L ? nx : c.x2]));
      } else {
        const dy = (e.clientY - drag.y0) / App.zoom;
        if (drag.next) {
          const total = drag.h0 + drag.n0;
          const want = drag.h0 + dy;
          const top = Math.max(drag.tmin, Math.min(total - drag.nmin, want));
          if (Math.abs(top - want) > 2 && !drag.warned) { drag.warned = true; status('아래(위) 줄의 글자 때문에 더 옮길 수 없습니다. 표 높이까지 바꾸려면 Shift를 누른 채 끄세요.'); }
          drag.tr.style.height = Math.round(top) + 'px';
          drag.next.style.height = Math.round(total - top) + 'px';
        } else drag.tr.style.height = Math.max(10, Math.round(drag.h0 + dy)) + 'px';
      }
      Table.layoutBg(drag.table || drag.tr.closest('table'));
      App.layoutSoon();
      return;
    }
    if (cellDrag && e.buttons === 1) {
      const td = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('td, th');
      if (td && td !== cellDrag.td && td.closest('table') === cellDrag.table) {
        const g = Table.grid(cellDrag.table);
        const a = g.cells.find((x) => x.el === cellDrag.td), b = g.cells.find((x) => x.el === td);
        if (a && b) {
          window.getSelection().removeAllRanges();
          Table.block.setRange(cellDrag.table, { r: a.r, c: a.c }, { r: b.r + b.rs - 1, c: b.c + b.cs - 1 });
          cellDrag.started = true;
        }
      }
      if (cellDrag.started) e.preventDefault();
    }
  });
  window.addEventListener('mouseup', () => {
    if (drag) { drag = null; document.body.classList.remove('col-resize', 'row-resize'); App.changed(); }
    if (cellDrag && cellDrag.started) { window.getSelection().removeAllRanges(); ed.blur(); }
    cellDrag = null;
  });
  document.addEventListener('selectionchange', () => {
    if (cellDrag && cellDrag.started) window.getSelection().removeAllRanges();
  });
};

// ---------- 도우미 ----------
function rowsOf(table) {
  return Array.from(table.rows).filter((tr) => tr.closest('table') === table);
}
function newCell(like) {
  const td = h('td', {}, h('p', {}, h('br')));
  if (like) {
    ['backgroundColor', 'verticalAlign', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft'].forEach((k) => { if (like.style[k]) td.style[k] = like.style[k]; });
  }
  return td;
}
function colWidths(table, nc) {
  let cols = Array.from(table.querySelectorAll(':scope > colgroup > col'));
  let w = cols.map((c) => parseFloat(c.style.width) || parseFloat(c.getAttribute('width')) || 0);
  if (w.length !== nc || w.some((x) => !x)) {
    // 측정해서 채우기
    const first = rowsOf(table)[0];
    const Z = typeof App !== 'undefined' && App.zoom ? App.zoom : 1;
    const tw = (/px$/.test(table.style.width) && parseFloat(table.style.width)) || table.getBoundingClientRect().width / Z || 600;
    const measured = [];
    if (first && nc) {
      let c = 0;
      for (const td of first.cells) {
        const cw = td.getBoundingClientRect().width / Z;
        for (let k = 0; k < td.colSpan; k++) measured[c++] = cw / td.colSpan;
      }
    }
    w = Array.from({ length: nc }, (_, i) => w[i] || measured[i] || tw / nc);
  }
  return w;
}
function setColWidths(table, widths) {
  let cg = table.querySelector(':scope > colgroup');
  if (!cg) { cg = h('colgroup'); table.prepend(cg); }
  cg.innerHTML = '';
  widths.forEach((w) => cg.append(h('col', { style: `width:${Math.round(w * 10) / 10}px` })));
  const total = widths.reduce((a, b) => a + b, 0);
  table.style.width = Math.round(total) + 'px';
}
function fitWidths(g, table) {
  const inCell = table.parentElement.closest('td');
  const max = inCell ? inCell.clientWidth - 14 : App.contentWidth();
  const total = g.widths.reduce((a, b) => a + b, 0);
  if (total > max) g.widths = g.widths.map((w) => (w * max) / total);
}
function expandRect(g, rc) {
  let changed = true;
  rc = { ...rc };
  while (changed) {
    changed = false;
    for (const x of g.cells) {
      const overlaps = x.r <= rc.r2 && x.r + x.rs - 1 >= rc.r1 && x.c <= rc.c2 && x.c + x.cs - 1 >= rc.c1;
      if (!overlaps) continue;
      if (x.r < rc.r1) { rc.r1 = x.r; changed = true; }
      if (x.c < rc.c1) { rc.c1 = x.c; changed = true; }
      if (x.r + x.rs - 1 > rc.r2) { rc.r2 = x.r + x.rs - 1; changed = true; }
      if (x.c + x.cs - 1 > rc.c2) { rc.c2 = x.c + x.cs - 1; changed = true; }
    }
  }
  return rc;
}
function distribute(total, parts) {
  if (parts >= total) return Array(parts).fill(1);
  const base = Math.floor(total / parts);
  const out = Array(parts).fill(base);
  for (let i = 0; i < total - base * parts; i++) out[i]++;
  return out;
}
// 커서 위치에 블록 요소(표 등) 넣기
function insertBlockAtCaret(node) {
  const r = Sel.range();
  let block = r ? blockOf(r.startContainer) : null;
  const ed = Sel.editor;
  if (!block || block === ed) {
    ed.append(node);
  } else if (block.tagName === 'TD' || block.tagName === 'TH') {
    block.append(node);
  } else {
    const empty = !block.textContent.replace(ZWSP, '').trim() && !block.querySelector('img,.nobj');
    if (empty) block.replaceWith(node);
    else {
      // 커서 위치에서 문단 나누기
      const after = r.cloneRange();
      after.setEndAfter(block.lastChild || block);
      const frag = after.extractContents();
      const tail = block.cloneNode(false);
      tail.append(frag);
      block.after(node);
      if (tail.textContent.trim() || tail.querySelector('img,.nobj')) node.after(tail);
      if (!block.firstChild) block.append(h('br'));
    }
  }
  if (!node.nextElementSibling || node.nextElementSibling.tagName === 'TABLE') node.after(h('p', {}, h('br')));
}
// 표 앞 가상 커서: 마우스를 누르거나 실제 커서가 생기면 끝냄
document.addEventListener('mousedown', () => { if (Table.outside) Table.outsideEnd(); }, true);
