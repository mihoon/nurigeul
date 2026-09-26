// 가로/세로 눈금자와 조판 부호(문단 끝 ↵, 줄 나눔 ↓)
'use strict';
const Ruler = {
  drag: null,
  hover: null,

  init() {
    const hc = $('#ruler-h');
    hc.addEventListener('mousemove', (e) => this.onMove(e));
    hc.addEventListener('mouseleave', () => { if (!this.drag) { this.hover = null; hc.style.cursor = 'default'; } });
    // 눈금자를 눌러도 편집기 초점이 빠지지 않게
    hc.addEventListener('mousedown', (e) => { e.preventDefault(); this.onDown(e); });
    hc.addEventListener('dblclick', (e) => { if (!TabStops.hit(e.clientX - hc.getBoundingClientRect().left)) Commands.run('para-shape'); });
    hc.addEventListener('contextmenu', (e) => TabStops.rulerMenu(e));
    window.addEventListener('mousemove', (e) => { if (this.drag) this.onDrag(e); });
    window.addEventListener('mouseup', () => this.onUp());
    window.addEventListener('resize', () => this.drawSoon());
    $('#workspace').addEventListener('scroll', () => this.drawSoon());
    new ResizeObserver(() => this.drawSoon()).observe($('#docarea'));
  },
  drawSoon() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = null; this.draw(); });
  },
  draw() {
    if (!document.body.classList.contains('no-hruler')) this.drawH();
    if (!document.body.classList.contains('no-vruler')) this.drawV();
  },

  setupCanvas(c) {
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width * dpr)), hh = Math.max(1, Math.round(r.height * dpr));
    if (c.width !== w || c.height !== hh) { c.width = w; c.height = hh; }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, r };
  },

  // 현재 문단의 들여쓰기 정보 (화면 좌표)
  paraGeom() {
    let block = Sel.block();
    if (block) this.lastBlock = block;
    else if (this.lastBlock && this.lastBlock.isConnected) block = this.lastBlock;
    const z = App.zoom;
    const cont = block ? (block.closest('td, th') || Sel.editor) : Sel.editor;
    const cr = cont.getBoundingClientRect();
    const ccs = getComputedStyle(cont);
    const left = cr.left + (cont === Sel.editor ? 0 : (parseFloat(ccs.paddingLeft) + parseFloat(ccs.borderLeftWidth)) * z);
    const right = cr.right - (cont === Sel.editor ? 0 : (parseFloat(ccs.paddingRight) + parseFloat(ccs.borderRightWidth)) * z);
    if (!block || block === cont) return { block: null, cont, left, right, ml: 0, mr: 0, ind: 0 };
    // 다단 안 문단: 그 단의 왼쪽·오른쪽
    const cb = cont === Sel.editor ? Cols.columnBox(block) : null;
    if (cb) {
      const bcs = getComputedStyle(block);
      return { block, cont, left: cb.left, right: cb.right, ml: parseFloat(bcs.marginLeft) || 0, mr: parseFloat(bcs.marginRight) || 0, ind: parseFloat(bcs.textIndent) || 0 };
    }
    const cs = getComputedStyle(block);
    // 목록 안 문단은 목록 들여쓰기까지 포함
    let extra = 0;
    for (let e = block.parentElement; e && e !== cont; e = e.parentElement) extra += (parseFloat(getComputedStyle(e).paddingLeft) || 0) + (parseFloat(getComputedStyle(e).marginLeft) || 0);
    return { block, cont, left: left + extra * z, right, ml: parseFloat(cs.marginLeft) || 0, mr: parseFloat(cs.marginRight) || 0, ind: parseFloat(cs.textIndent) || 0 };
  },

  drawH() {
    const c = $('#ruler-h');
    const { ctx, r } = this.setupCanvas(c);
    const W = r.width, H = r.height;
    const z = App.zoom, p = App.page;
    const pr = $('#page').getBoundingClientRect();
    const x0 = pr.left - r.left; // 용지 왼쪽
    const mm = (v) => x0 + U.mm2px(v) * z;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#e8eaee'; ctx.fillRect(0, 0, W, H);
    // 용지 / 여백
    ctx.fillStyle = '#c9ced6'; ctx.fillRect(mm(0), 3, U.mm2px(p.width) * z, H - 6);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(mm(p.left), 3, U.mm2px(p.width - p.left - p.right) * z, H - 6);
    // 눈금 (본문 왼쪽이 0)
    ctx.strokeStyle = '#6b7280'; ctx.fillStyle = '#4b5563';
    ctx.font = '9px "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const step = z < 0.6 ? 2 : 1;
    ctx.beginPath();
    for (let m = -Math.floor(p.left); m <= p.width - p.left; m += step) {
      const x = Math.round(mm(p.left + m)) + 0.5;
      if (x < 0 || x > W) continue;
      if (m % 10 === 0) {
        if (m !== 0) ctx.fillText(String(Math.abs(m / 10)), x, H / 2);
        else { ctx.moveTo(x, 5); ctx.lineTo(x, H - 5); }
      } else if (m % 5 === 0) { ctx.moveTo(x, H / 2 - 3); ctx.lineTo(x, H / 2 + 3); }
      else if (z >= 0.8) { ctx.moveTo(x, H / 2 - 1); ctx.lineTo(x, H / 2 + 1); }
    }
    ctx.stroke();
    // 문단 표시기
    const g = this.paraGeom();
    this.geom = g;
    const L = g.left - r.left + g.ml * z;
    const F = g.left - r.left + (g.ml + g.ind) * z;
    const R = g.right - r.left - g.mr * z;
    this.markers = { first: F, left: L, right: R };
    const tri = (x, down, hot) => {
      ctx.beginPath();
      if (down) { ctx.moveTo(x - 5, 2); ctx.lineTo(x + 5, 2); ctx.lineTo(x, 8); }
      else { ctx.moveTo(x - 5, H - 2); ctx.lineTo(x + 5, H - 2); ctx.lineTo(x, H - 8); }
      ctx.closePath();
      ctx.fillStyle = hot ? '#2563c9' : '#ffffff';
      ctx.strokeStyle = '#2563c9';
      ctx.fill(); ctx.stroke();
    };
    const hot = (k) => (this.drag && this.drag.kind === k) || this.hover === k;
    tri(F, true, hot('first'));
    tri(L, false, hot('left'));
    tri(R, false, hot('right'));
    TabStops.draw(ctx, g, r.left, H);
    // 끌기 안내선
    if (this.drag && this.drag.kind === 'tab') {
      const x = g.left - r.left + U.mm2px(this.drag.pos) * z;
      ctx.fillStyle = this.drag.out ? '#c62828' : '#2563c9';
      ctx.textAlign = 'left';
      ctx.fillText(this.drag.out ? '놓으면 탭을 지웁니다' : `${this.drag.pos.toFixed(1)} mm`, x + 8, H / 2);
      if (!this.drag.out) this.showGuide(x + r.left); else this.hideGuide();
    } else if (this.drag) {
      const x = this.markers[this.drag.kind];
      ctx.fillStyle = '#2563c9';
      const val = this.drag.kind === 'first' ? g.ml + g.ind : this.drag.kind === 'left' ? g.ml : g.mr;
      ctx.textAlign = 'left';
      ctx.fillText(`${(U.px2mm(val)).toFixed(1)} mm`, x + 8, H / 2);
      this.showGuide(x + r.left);
    }
  },

  drawV() {
    const c = $('#ruler-v');
    const { ctx, r } = this.setupCanvas(c);
    const W = r.width, H = r.height;
    const z = App.zoom, p = App.page;
    const pr = $('#page').getBoundingClientRect();
    const top = pr.top - r.top;
    const padTop = U.mm2px(p.top + p.header), padBot = U.mm2px(p.bottom + p.footer);
    const CH = App.contentHeight();
    const PT = App.pitch(), paged = App.paged();
    const pages = App.pageCount();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#e8eaee'; ctx.fillRect(0, 0, W, H);
    // 쪽마다 용지(회색)와 본문(흰색)
    for (let k = 0; k < (paged ? pages : 1); k++) {
      const ptop = top + (paged ? k * PT : 0) * z;
      const pageH = paged ? padTop + CH + padBot : padTop + pages * CH + padBot;
      ctx.fillStyle = '#c9ced6'; ctx.fillRect(3, ptop, W - 6, pageH * z);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(3, ptop + padTop * z, W - 6, (paged ? CH : pages * CH) * z);
    }
    ctx.strokeStyle = '#6b7280'; ctx.fillStyle = '#4b5563';
    ctx.font = '9px "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const chMM = U.px2mm(CH);
    const step = z < 0.6 ? 2 : 1;
    ctx.beginPath();
    for (let k = 0; k < pages; k++) {
      const base = top + (padTop + k * PT) * z;
      if (base > H || base + CH * z < 0) continue;
      // 쪽 경계
      ctx.moveTo(4, Math.round(base) + 0.5); ctx.lineTo(W - 4, Math.round(base) + 0.5);
      for (let m = step; m < chMM; m += step) {
        const y = Math.round(base + U.mm2px(m) * z) + 0.5;
        if (y < 0 || y > H) continue;
        if (m % 10 === 0) {
          ctx.save(); ctx.translate(W / 2, y); ctx.rotate(-Math.PI / 2); ctx.fillText(String(m / 10), 0, 0); ctx.restore();
        } else if (m % 5 === 0) { ctx.moveTo(W / 2 - 3, y); ctx.lineTo(W / 2 + 3, y); }
        else if (z >= 0.8) { ctx.moveTo(W / 2 - 1, y); ctx.lineTo(W / 2 + 1, y); }
      }
    }
    ctx.stroke();
    // 현재 쪽 표시
    const cur = App.currentPage() - 1;
    const cy = top + (padTop + cur * PT) * z;
    ctx.fillStyle = 'rgba(37,99,201,.12)';
    ctx.fillRect(3, Math.max(0, cy), W - 6, Math.min(H, CH * z));
  },

  hit(x) {
    if (!this.markers) return null;
    const order = ['first', 'left', 'right'];
    let best = null, bd = 6;
    for (const k of order) {
      const d = Math.abs(this.markers[k] - x);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  },
  onMove(e) {
    if (this.drag) return;
    const r = $('#ruler-h').getBoundingClientRect();
    const k = this.hit(e.clientX - r.left);
    const lab = { first: '첫 줄 시작 위치 (끌어서 들여쓰기/내어쓰기)', left: '왼쪽 여백 (끌어서 조절)', right: '오른쪽 여백 (끌어서 조절)' };
    const tb = !k && TabStops.hit(e.clientX - r.left);
    $('#ruler-h').title = k ? lab[k] : tb ? '탭 (끌어서 옮기기, 눈금자 밖으로 끌어내면 지우기, 오른쪽 단추: 채울 모양)' : '눈금자 (오른쪽 단추: 탭 넣기, 두 번 누르면 문단 모양)';
    $('#ruler-h').style.cursor = k || tb ? 'ew-resize' : 'default';
    if (k !== this.hover) { this.hover = k; this.drawH(); }
  },
  onDown(e) {
    const r = $('#ruler-h').getBoundingClientRect();
    if (e.button !== 0) return;
    const k = this.hit(e.clientX - r.left);
    const tb = !k && TabStops.hit(e.clientX - r.left);
    if (tb) {
      e.preventDefault();
      App.restoreSel();
      History.checkpoint();
      this.drag = { kind: 'tab', pos: tb.pos, sel: Sel.save() };
      this.drawH();
      return;
    }
    if (!k) return;
    e.preventDefault();
    App.restoreSel();
    const g = this.paraGeom();
    if (!g.block) return;
    History.checkpoint();
    this.drag = { kind: k, first: g.ml + g.ind, sel: Sel.save() };
    this.drawH();
  },
  onDrag(e) {
    const g = this.paraGeom();
    if (!g.block) return;
    const z = App.zoom;
    const px = (e.clientX - g.left) / z;
    const snap = (v) => Math.round(U.px2pt(v) * 2) / 2; // 0.5pt 단위
    const contW = (g.right - g.left) / z;
    const d = this.drag;
    if (d.kind === 'tab') {
      const rr = $('#ruler-h').getBoundingClientRect();
      d.out = e.clientY > rr.bottom + 25 || e.clientY < rr.top - 25;
      const pos = Math.max(0, Math.min(U.px2mm(contW), Math.round(U.px2mm(px) * 2) / 2));
      if (d.sel) Sel.restore(d.sel);
      if (Math.abs(pos - d.pos) >= 0.25) { TabStops.move(d.pos, pos); d.pos = pos; }
      this.drawH();
      return;
    }
    if (d.kind === 'first') {
      const first = Math.max(0, Math.min(contW - 20, px));
      Fmt.applyParaProps({ indent: snap(first - g.ml) });
    } else if (d.kind === 'left') {
      const ml = Math.max(0, Math.min(contW - g.mr - 20, px));
      Fmt.applyParaProps({ left: snap(ml), indent: snap(d.first - ml) });
    } else {
      const mr = Math.max(0, Math.min(contW - g.ml - 20, contW - px));
      Fmt.applyParaProps({ right: snap(mr) });
    }
    if (d.sel) Sel.restore(d.sel);
    this.drawH();
    Marks.updateSoon();
  },
  onUp() {
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    if (d.kind === 'tab' && d.out) {
      if (d.sel) Sel.restore(d.sel);
      TabStops.remove(d.pos);
      status('탭을 지웠습니다.');
    }
    this.hideGuide();
    App.changed();
    this.drawH();
    Sel.editor.focus({ preventScroll: true });
  },
  showGuide(x) {
    let gl = $('#ruler-guide');
    if (!gl) { gl = h('div', { id: 'ruler-guide', style: { position: 'fixed', width: '0', borderLeft: '1px dashed #2563c9', pointerEvents: 'none', zIndex: 50 } }); document.body.append(gl); }
    const wr = $('#workspace').getBoundingClientRect();
    Object.assign(gl.style, { left: x + 'px', top: wr.top + 'px', height: wr.height + 'px', display: 'block' });
  },
  hideGuide() { const gl = $('#ruler-guide'); if (gl) gl.style.display = 'none'; },
};

// ---------- 조판 부호 ----------
const Marks = {
  updateSoon: null,
  update() {
    const box = $('#marks');
    const para = document.body.classList.contains('show-paramarks');
    const ctrl = document.body.classList.contains('show-marks');
    if (!para && !ctrl) { box.innerHTML = ''; return; }
    const page = $('#page').getBoundingClientRect();
    const z = App.zoom;
    const frag = document.createDocumentFragment();
    const put = (x, y, hgt, ch, cls) => {
      const s = document.createElement('span');
      s.textContent = ch;
      if (cls) s.className = cls;
      s.style.left = ((x - page.left) / z + 1) + 'px';
      s.style.top = ((y - page.top) / z + Math.max(0, hgt / z - 13)) + 'px';
      frag.append(s);
    };
    const tag = (el, label) => {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      const s = document.createElement('span');
      s.textContent = label;
      s.className = 'obj';
      s.style.left = ((r.left - page.left) / z) + 'px';
      s.style.top = ((r.top - page.top) / z - 13) + 'px';
      frag.append(s);
    };
    for (const b of allParagraphs()) {
      // 문단 부호: 문단 끝 ↵
      if (para) {
        const end = lastContentRect(b);
        if (end) put(end.right, end.top, end.height, '↵');
        else {
          const br = b.getBoundingClientRect();
          const cs = getComputedStyle(b);
          const indent = (parseFloat(cs.textIndent) || 0) * z;
          put(br.left + Math.max(0, indent) + (cs.textAlign === 'center' ? br.width / 2 : cs.textAlign === 'right' ? br.width - 10 : 0), br.top, Math.min(br.height, parseFloat(cs.lineHeight) * z || br.height), '↵');
        }
      }
      if (!ctrl) continue;
      // 조판 부호: 줄 나눔(Shift+Enter) ↓
      b.querySelectorAll('br').forEach((brEl) => {
        if (!brEl.nextSibling && brEl.parentElement === b) return; // 자리표시 br
        const rr = rectBefore(brEl);
        if (rr) put(rr.right, rr.top, rr.height, '↓');
      });
    }
    if (ctrl) {
      const ed = Sel.editor;
      // 탭 →
      ed.querySelectorAll('span.tab').forEach((t) => { const r = t.getBoundingClientRect(); put(r.left, r.top, r.height, '→', 'tabm'); });
      // 표·그림·도형·글상자
      ed.querySelectorAll('table').forEach((t) => { if (!t.parentElement.closest('table')) tag(t, '표'); });
      ed.querySelectorAll('img').forEach((im) => { if (!im.closest('.nobj')) tag(im, '그림'); });
      ed.querySelectorAll('.nobj').forEach((o) => {
        if (o.parentElement.closest('.nobj')) return;
        const k = o.dataset.kind;
        tag(o, k === 'textbox' ? '글상자' : k === 'group' ? '묶음 개체' : '도형');
      });
    }
    box.innerHTML = '';
    box.append(frag);
  },
};

// 문단 안 마지막 글자(또는 그림)의 화면 위치
function lastContentRect(block) {
  const w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let last = null, n;
  while ((n = w.nextNode())) {
    if (n.nodeType === 3 && n.nodeValue.replace(/​/g, '').length) last = n;
    else if (n.nodeType === 1 && (n.tagName === 'IMG' || n.classList.contains('mm-field'))) last = n;
    else if (n.nodeType === 1 && n.tagName === 'BR' && last && n.nextSibling) last = n; // 줄 나눔 뒤 빈 줄
  }
  if (!last) return null;
  if (last.nodeType === 1 && last.tagName === 'BR') {
    // 줄 나눔 다음 줄의 시작 → 다음 형제 위치
    const r = document.createRange();
    r.setStartAfter(last); r.collapse(true);
    const rects = r.getClientRects();
    if (rects.length) return { right: rects[0].left, top: rects[0].top, height: rects[0].height };
    return null;
  }
  if (last.nodeType === 1) {
    const r = last.getBoundingClientRect();
    return { right: r.right, top: r.top, height: r.height };
  }
  const r = document.createRange();
  let end = last.nodeValue.length;
  while (end > 0 && last.nodeValue[end - 1] === '​') end--;
  r.setStart(last, end - 1);
  r.setEnd(last, end);
  const rects = r.getClientRects();
  if (!rects.length) return null;
  const rc = rects[rects.length - 1];
  return { right: rc.right, top: rc.top, height: rc.height };
}
function rectBefore(node) {
  let p = node.previousSibling;
  while (p && p.nodeType === 1 && !p.textContent && p.tagName !== 'IMG') p = p.previousSibling;
  if (!p) return null;
  if (p.nodeType === 1 && p.tagName !== 'IMG') {
    return lastContentRect(p) || null;
  }
  if (p.nodeType === 1) { const r = p.getBoundingClientRect(); return { right: r.right, top: r.top, height: r.height }; }
  if (!p.nodeValue.length) return null;
  const r = document.createRange();
  r.setStart(p, p.nodeValue.length - 1); r.setEnd(p, p.nodeValue.length);
  const rects = r.getClientRects();
  if (!rects.length) return null;
  const rc = rects[rects.length - 1];
  return { right: rc.right, top: rc.top, height: rc.height };
}
