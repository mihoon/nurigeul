// 탭: 문단별 탭 위치(왼쪽/가운데/오른쪽)와 채울 모양
// 문단: <p data-tabs="35:L:none;120:R:dot">  (위치는 mm, 문단이 놓인 칸의 왼쪽 끝 기준)
// 탭 글자: <span class="tab" contenteditable="false">\t</span>  (너비는 layout()이 계산)
'use strict';
const TabStops = {
  DEFAULT_PT: 40, // 기본 탭 간격
  TYPES: { L: '왼쪽', C: '가운데', R: '오른쪽' },
  LEADERS: [['none', '없음'], ['solid', '실선 ─────'], ['dash', '파선 - - - -'], ['dot', '점선 ·········'], ['longdash', '긴 파선 — — —'], ['double', '이중 실선 ═════']],
  HWP_LEADER: { none: 'NONE', solid: 'SOLID', dash: 'DASH', dot: 'DOT', longdash: 'LONG_DASH', double: 'DOUBLE_SLIM' },
  HWP_TYPE: { L: 'LEFT', C: 'CENTER', R: 'RIGHT' },
  leader: 'none', // 새로 넣는 탭의 채울 모양

  parse(el) {
    const s = el && el.dataset ? el.dataset.tabs : '';
    if (!s) return [];
    return s.split(';').map((x) => {
      const [pos, type, leader] = x.split(':');
      return { pos: +pos, type: this.TYPES[type] ? type : 'L', leader: leader || 'none' };
    }).filter((t) => t.pos >= 0 && !isNaN(t.pos)).sort((a, b) => a.pos - b.pos);
  },
  serialize(list) {
    return list.slice().sort((a, b) => a.pos - b.pos).map((t) => `${Math.round(t.pos * 10) / 10}:${t.type}:${t.leader || 'none'}`).join(';');
  },
  store(el, list) {
    if (list.length) el.dataset.tabs = this.serialize(list); else delete el.dataset.tabs;
  },
  // 탭 설정이 붙는 문단 (목록 항목은 li)
  holder(block) { return block; },
  current() {
    const b = Sel.block() || (Ruler.lastBlock && Ruler.lastBlock.isConnected ? Ruler.lastBlock : null);
    return b && b !== Sel.editor ? this.parse(b) : [];
  },
  // 선택한 문단들에 적용
  each(fn) {
    if (!Sel.inEditor() && Ruler.lastBlock && Ruler.lastBlock.isConnected) { fn(Ruler.lastBlock); return; }
    Fmt.eachBlock((b) => { if (b !== Sel.editor) fn(b); });
  },
  add(pos, type, leader) {
    pos = Math.max(0, Math.round(pos * 10) / 10);
    this.each((b) => {
      const list = this.parse(b).filter((t) => Math.abs(t.pos - pos) > 0.4);
      list.push({ pos, type, leader: leader || this.leader });
      this.store(b, list);
    });
    this.after();
  },
  remove(pos) {
    this.each((b) => this.store(b, this.parse(b).filter((t) => Math.abs(t.pos - pos) > 0.4)));
    this.after();
  },
  clear() {
    this.each((b) => delete b.dataset.tabs);
    this.after();
  },
  setLeader(pos, leader) {
    this.each((b) => this.store(b, this.parse(b).map((t) => (Math.abs(t.pos - pos) <= 0.4 ? { ...t, leader } : t))));
    this.after();
  },
  set(list) {
    this.each((b) => this.store(b, list));
    this.after();
  },
  move(from, to) {
    to = Math.max(0, Math.round(to * 10) / 10);
    this.each((b) => this.store(b, this.parse(b).map((t) => (Math.abs(t.pos - from) <= 0.4 ? { ...t, pos: to } : t))));
    this.layoutAll();
    Ruler.drawH();
  },
  after() {
    this.layoutAll();
    Ruler.drawH();
    App.changed();
  },

  init() {
    // 글꼴을 늦게 불러오면 너비가 바뀌므로 다시 계산
    if (document.fonts) document.fonts.addEventListener('loadingdone', () => this.layoutAll());
    // 탭 빈 공간을 누르면 탭 앞/뒤로 커서
    Sel.editor.addEventListener('mousedown', (e) => {
      const t = e.target;
      if (e.button !== 0 || !t.classList || !t.classList.contains('tab') || e.shiftKey) return;
      e.preventDefault();
      const r = t.getBoundingClientRect();
      const rg = document.createRange();
      if (e.clientX < r.left + r.width / 2) rg.setStartBefore(t); else rg.setStartAfter(t);
      rg.collapse(true);
      (t.closest('.tb-body') || Sel.editor).focus({ preventScroll: true });
      Sel.set(rg);
    });
  },

  // ---------- 탭 글자 ----------
  make() { return h('span', { class: 'tab', contenteditable: 'false' }, '\t'); },
  insert() {
    const r = Sel.range();
    if (!r) return;
    r.deleteContents();
    const t = this.make();
    r.insertNode(t);
    const nr = document.createRange();
    nr.setStartAfter(t);
    nr.collapse(true);
    Sel.set(nr);
    this.layoutBlock(t);
  },
  // 맨 탭 글자(\t)를 탭 요소로 바꾸기
  wrapAll(root) {
    root = root || Sel.editor;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue.includes('\t') && !(n.parentElement && n.parentElement.classList.contains('tab')) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (let t of nodes) {
      let i;
      while ((i = t.nodeValue.indexOf('\t')) >= 0) {
        const tabText = t.splitText(i);
        const rest = tabText.splitText(1);
        const span = h('span', { class: 'tab', contenteditable: 'false' });
        tabText.replaceWith(span);
        span.append(tabText);
        t = rest;
      }
    }
    // 크롬이 탭을 감싸는 white-space:pre span 정리
    root.querySelectorAll('span.tab').forEach((s) => {
      const p = s.parentElement;
      if (p && p.tagName === 'SPAN' && p.childNodes.length === 1 && /white-space:\s*pre/.test(p.getAttribute('style') || '') && p.attributes.length === 1) p.replaceWith(s);
    });
    return nodes.length;
  },

  // ---------- 너비 계산 ----------
  // 탭 위치의 기준(칸 왼쪽 끝) — 눈금자와 같은 기준
  originOf(block) {
    const z = App.zoom;
    if (!block.closest('td, th, .tb-body')) { const cb = Cols.columnBox(block); if (cb) return cb.left; }
    const cont = block.closest('td, th, .tb-body') || Sel.editor;
    const cr = cont.getBoundingClientRect();
    const ccs = getComputedStyle(cont);
    let left = cr.left + (cont === Sel.editor ? 0 : (parseFloat(ccs.paddingLeft) + parseFloat(ccs.borderLeftWidth)) * z);
    let extra = 0;
    for (let e = block.parentElement; e && e !== cont; e = e.parentElement) extra += (parseFloat(getComputedStyle(e).paddingLeft) || 0) + (parseFloat(getComputedStyle(e).marginLeft) || 0);
    return left + extra * z;
  },
  blockOf(tab) {
    return tab.closest('p, li, h1, h2, h3, h4, h5, h6, div.p, .tb-body, td, th') || Sel.editor;
  },
  layoutBlock(tabOrBlock) {
    const block = tabOrBlock.classList && tabOrBlock.classList.contains('tab') ? this.blockOf(tabOrBlock) : tabOrBlock;
    if (!block || !block.isConnected) return;
    const tabs = Array.from(block.querySelectorAll('span.tab')).filter((t) => this.blockOf(t) === block);
    if (!tabs.length) return;
    const z = App.zoom || 1;
    const stops = this.parse(block);
    const origin = this.originOf(block);
    const defPx = U.pt2px(this.DEFAULT_PT);
    for (const t of tabs) t.style.width = '0px';
    tabs.forEach((t, i) => {
      const x = (t.getBoundingClientRect().left - origin) / z;
      let stop = stops.find((s) => U.mm2px(s.pos) > x + 0.5);
      let sx, type = 'L', leader = 'none';
      if (stop) { sx = U.mm2px(stop.pos); type = stop.type; leader = stop.leader; }
      else sx = (Math.floor(x / defPx + 1e-6) + 1) * defPx;
      let w = sx - x;
      if (type !== 'L') {
        // 탭 뒤 글(다음 탭이나 문단 끝까지)의 너비
        const r = document.createRange();
        r.setStartAfter(t);
        if (tabs[i + 1]) r.setEndBefore(tabs[i + 1]); else r.setEnd(block, block.childNodes.length);
        // 탭과 같은 줄에 있는 글자만 (세로 가운데가 탭 상자 안에 들면 같은 줄)
        const tr = t.getBoundingClientRect();
        const rects = Array.from(r.getClientRects()).filter((q) => q.width > 0 && (q.top + q.bottom) / 2 >= tr.top - 1 && (q.top + q.bottom) / 2 <= tr.bottom + 1);
        const segW = rects.length ? (Math.max(...rects.map((q) => q.right)) - Math.min(...rects.map((q) => q.left))) / z : 0;
        w = type === 'R' ? sx - x - segW : sx - x - segW / 2;
      }
      w = Math.max(0, w);
      t.style.width = Math.round(w * 10) / 10 + 'px';
      if (leader && leader !== 'none') t.dataset.leader = leader; else delete t.dataset.leader;
    });
  },
  layoutAll(root) {
    root = root || Sel.editor;
    const blocks = new Set();
    root.querySelectorAll('span.tab').forEach((t) => blocks.add(this.blockOf(t)));
    blocks.forEach((b) => this.layoutBlock(b));
  },
  // 입력할 때: 커서가 있는 문단만 바로
  onInput(e) {
    const composing = e && e.isComposing;
    if (!Sel.editor.querySelector('span.tab') && (composing || !Sel.editor.textContent.includes('\t'))) return;
    // 입력이 일어난 문단을 바로 기억 (Enter 등으로 커서가 옮겨 가도 앞 문단을 다시 계산)
    this._pending = this._pending || new Set();
    const b = Sel.block();
    if (b) {
      this._pending.add(b);
      if (b.previousElementSibling) this._pending.add(b.previousElementSibling);
    }
    if (composing) this._composing = true;
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = null;
      const blocks = this._pending;
      this._pending = null;
      const comp = this._composing;
      this._composing = false;
      // 한글 조합 중에는 글자 노드를 건드리지 않고 너비만 다시 계산
      if (!comp && this.wrapAll()) { this.layoutAll(); return; }
      for (const x of blocks || []) {
        if (!x.isConnected) continue;
        const blk = x.querySelector('span.tab') ? x : x.closest('p, li, td, th, .tb-body');
        if (blk && blk.querySelector('span.tab')) {
          // 문단 안의 탭을 가진 블록(목록 항목 등) 모두
          const set = new Set(Array.from(blk.querySelectorAll('span.tab')).map((t) => this.blockOf(t)));
          set.forEach((q) => this.layoutBlock(q));
        }
      }
    });
  },

  // ---------- 눈금자 오른쪽 단추 메뉴 ----------
  rulerMenu(e) {
    e.preventDefault();
    App.restoreSel();
    const g = Ruler.paraGeom();
    if (!g.block) { status('탭을 넣을 문단에 커서를 두세요.'); return; }
    const z = App.zoom;
    const pos = Math.max(0, Math.round(U.px2mm((e.clientX - g.left) / z) * 2) / 2);
    const near = this.parse(g.block).find((t) => Math.abs(U.mm2px(t.pos) * z + g.left - e.clientX) < 6);
    const mm = (v) => `${v.toFixed(1)} mm`;
    const items = [];
    if (near) {
      items.push({ label: `${this.TYPES[near.type]} 탭 (${mm(near.pos)})`, disabled: true });
      for (const [k, l] of this.LEADERS) items.push({ label: '채울 모양: ' + l, checked: () => near.leader === k, run: () => Commands.exec('tab-leader', { pos: near.pos, leader: k }) });
      items.push('-');
      for (const [k, l] of Object.entries(this.TYPES)) if (k !== near.type) items.push({ label: `${l} 탭으로 바꾸기`, run: () => Commands.exec('tab-add', { pos: near.pos, type: k, leader: near.leader }) });
      items.push({ label: '이 탭 지우기', run: () => Commands.exec('tab-remove', { pos: near.pos }) });
    } else {
      items.push({ label: `왼쪽 탭 넣기 (${mm(pos)})`, run: () => Commands.exec('tab-add', { pos, type: 'L', leader: this.leader }) });
      items.push({ label: `가운데 탭 넣기 (${mm(pos)})`, run: () => Commands.exec('tab-add', { pos, type: 'C', leader: this.leader }) });
      items.push({ label: `오른쪽 탭 넣기 (${mm(pos)})`, run: () => Commands.exec('tab-add', { pos, type: 'R', leader: this.leader }) });
      items.push('-');
      for (const [k, l] of this.LEADERS) items.push({ label: '채울 모양: ' + l, checked: () => this.leader === k, run: () => { this.leader = k; status(`새 탭의 채울 모양: ${l}`); } });
    }
    items.push('-', { label: '모든 탭 지우기', disabled: !this.parse(g.block).length, run: () => Commands.exec('tab-clear') }, { cmd: 'tab-dialog' });
    App.closeMenus();
    const pop = App.renderMenu(items);
    const cm = $('#ctxmenu');
    cm.replaceWith(pop);
    pop.id = 'ctxmenu';
    pop.hidden = false;
    pop.style.left = Math.min(e.clientX, window.innerWidth - 280) + 'px';
    pop.style.top = e.clientY + 4 + 'px';
    document.body.append(pop);
    App.menuHot = -1;
  },

  // 눈금자에 그리기 (Ruler.drawH 에서 부름)
  draw(ctx, g, rLeft, H) {
    const z = App.zoom;
    this.marks = [];
    if (!g.block) return;
    const stops = this.parse(g.block);
    ctx.save();
    ctx.lineWidth = 1.5;
    for (const t of stops) {
      const drag = Ruler.drag && Ruler.drag.kind === 'tab' && Math.abs(Ruler.drag.pos - t.pos) < 0.01;
      const x = Math.round(g.left - rLeft + U.mm2px(t.pos) * z) + 0.5;
      this.marks.push({ x, pos: t.pos });
      ctx.strokeStyle = drag ? '#2563c9' : '#1f2937';
      ctx.beginPath();
      const y0 = H - 11, y1 = H - 4;
      ctx.moveTo(x, y0); ctx.lineTo(x, y1);
      if (t.type === 'L') ctx.lineTo(x + 5, y1);
      else if (t.type === 'R') ctx.lineTo(x - 5, y1);
      else { ctx.moveTo(x - 5, y1); ctx.lineTo(x + 5, y1); }
      ctx.stroke();
      if (t.leader && t.leader !== 'none') { ctx.fillStyle = '#1f2937'; ctx.fillRect(x - 1, y0 - 3, 2, 2); }
    }
    ctx.restore();
  },
  hit(x) {
    if (!this.marks) return null;
    let best = null, bd = 5;
    for (const m of this.marks) { const d = Math.abs(m.x - x); if (d < bd) { bd = d; best = m; } }
    return best;
  },

  // ---------- 탭 설정 대화상자 ----------
  dialog() {
    const g = Ruler.paraGeom();
    const list = g.block ? this.parse(g.block) : [];
    return new Promise((resolve) => {
      const rows = h('div', { class: 'tabdlg-rows' });
      const typeSel = (v) => h('select', {}, Object.entries(this.TYPES).map(([k, l]) => h('option', { value: k, selected: k === v }, l)));
      const leadSel = (v) => h('select', {}, this.LEADERS.map(([k, l]) => h('option', { value: k, selected: k === v }, l)));
      const addRow = (t) => {
        const pos = h('input', { type: 'number', step: 0.5, min: 0, value: t.pos });
        const del = h('button', { type: 'button', class: 'btn' }, '지우기');
        const row = h('div', { class: 'tabdlg-row' }, pos, h('span', { class: 'muted' }, 'mm'), typeSel(t.type), leadSel(t.leader), del);
        del.addEventListener('click', () => row.remove());
        rows.append(row);
      };
      list.forEach(addRow);
      const add = h('button', { type: 'button', class: 'btn' }, '탭 추가');
      add.addEventListener('click', () => {
        const last = Array.from(rows.querySelectorAll('input')).map((i) => +i.value).sort((a, b) => b - a)[0];
        addRow({ pos: last != null ? last + 20 : 20, type: 'L', leader: this.leader });
      });
      const head = h('div', { class: 'tabdlg-row tabdlg-head' }, h('span', {}, '위치'), h('span', {}, ''), h('span', {}, '종류'), h('span', {}, '채울 모양'), h('span', {}, ''));
      const body = h('div', {}, head, rows, h('div', { class: 'row', style: { marginTop: '8px' } }, add),
        h('div', { class: 'note' }, '위치는 본문(또는 셀) 왼쪽 끝에서부터 잽니다. 눈금자를 마우스 오른쪽 단추로 눌러도 탭을 넣을 수 있고, 눈금자의 탭 표시를 끌어 옮기거나 눈금자 밖으로 끌어내 지울 수 있습니다.'));
      let result = null;
      Dialog.open({
        title: '탭 설정', body, width: 470,
        buttons: [
          { label: '설정', primary: true, onClick: () => {
            result = Array.from(rows.children).map((r) => {
              const [pos] = r.querySelectorAll('input');
              const [type, leader] = r.querySelectorAll('select');
              return { pos: Math.max(0, +pos.value || 0), type: type.value, leader: leader.value };
            });
          } },
          { label: '취소' },
        ],
        onClose: () => resolve(result ? { stops: result } : null),
      });
    });
  },
};
