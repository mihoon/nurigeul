// 칸 블록 (F4, 아래아한글의 사각형 블록): 여러 줄에 걸친 네모난 범위를 잡아 복사·오려 두기·지우기·서식 적용
// F4로 시작 → 방향키/Home/End/Shift+클릭으로 넓히기, Alt+끌기로도 시작, Esc 또는 F4로 끝
'use strict';
const ColBlock = {
  active: false,
  anchor: null, // 시작 자리 (접힌 Range)
  focus: null,  // 끝 자리 (접힌 Range)
  segs: [],
  clip: null,   // 마지막으로 복사한 칸 블록 {text, lines}

  // 접힌 범위의 화면 위치
  rectOf(r) {
    let q = r.getClientRects()[0] || r.getBoundingClientRect();
    if (!q || (!q.width && !q.height && !q.left && !q.top)) {
      // 빈 줄 등: 옆 요소의 위치로
      const n = r.startContainer.nodeType === 1 ? (r.startContainer.childNodes[r.startOffset] || r.startContainer) : r.startContainer.parentElement;
      const b = (n.nodeType === 1 ? n : n.parentElement).getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(n.nodeType === 1 ? n : n.parentElement).lineHeight) || 16;
      q = { left: b.left, top: b.top, bottom: b.top + Math.min(b.height || lh, lh * App.zoom), height: Math.min(b.height || lh, lh * App.zoom) };
    }
    return { left: q.left, top: q.top, bottom: q.bottom, height: q.bottom - q.top };
  },
  start(at) {
    const r = at || Sel.range();
    if (!r) return;
    if (MultiSel.active) MultiSel.stop();
    if (App.blockMode) App.toggleBlockMode(false);
    const c = r.cloneRange();
    c.collapse(true);
    this.anchor = c;
    this.focus = c.cloneRange();
    this.active = true;
    this.segs = [];
    this.draw();
    status('칸 블록: 방향키·Shift+클릭으로 범위를 넓히세요. Ctrl+C 복사, Ctrl+X 오려 두기, Delete 지우기, Esc/F4 끝');
  },
  stop(keepCaret = true) {
    if (!this.active) return;
    this.active = false;
    this.segs = [];
    if (CSS.highlights) CSS.highlights.delete('colblock');
    if (keepCaret && this.focus && this.focus.startContainer.isConnected) Sel.set(this.focus.cloneRange());
    this.anchor = this.focus = null;
    $('#st-block').textContent = '';
  },

  // 네모 범위 안의 줄마다 Range 하나
  compute() {
    const a = this.rectOf(this.anchor), f = this.rectOf(this.focus);
    const x1 = Math.min(a.left, f.left), x2 = Math.max(a.left, f.left);
    const upper = a.top <= f.top ? this.anchor : this.focus;
    const yBot = Math.max(a.bottom, f.bottom);
    const s = window.getSelection();
    const saved = s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
    const segs = [];
    Sel.set(upper.cloneRange());
    let lastTop = -1e9;
    for (let guard = 0; guard < 2000; guard++) {
      const pr = s.getRangeAt(0);
      const q = this.rectOf(pr);
      if (q.top > yBot - 1 || q.top <= lastTop + 0.5) break;
      lastTop = q.top;
      const yc = q.top + q.height / 2;
      const p1 = document.caretRangeFromPoint(x1 + 0.5, yc), p2 = document.caretRangeFromPoint(x2 + 0.5, yc);
      if (p1 && p2 && Sel.editor.contains(p1.startContainer) && Sel.editor.contains(p2.startContainer)) {
        const r = document.createRange();
        r.setStart(p1.startContainer, p1.startOffset);
        r.setEnd(p2.startContainer, p2.startOffset);
        if (r.collapsed) { r.setStart(p2.startContainer, p2.startOffset); r.setEnd(p1.startContainer, p1.startOffset); }
        // 한 줄 안에 있는 범위만 (줄보다 왼쪽 끝이 짧으면 빈 칸)
        const rr = r.getClientRects();
        const oneLine = !rr.length || Array.from(rr).every((b) => Math.abs((b.top + b.bottom) / 2 - yc) < q.height);
        if (oneLine) segs.push(r); else { const e = p2.cloneRange(); e.collapse(true); segs.push(e); }
      } else {
        const e = pr.cloneRange(); segs.push(e);
      }
      s.modify('move', 'forward', 'line');
    }
    if (saved) Sel.set(saved);
    this.segs = segs;
    this.box = { x1, x2 };
  },
  draw() {
    if (!this.active) return;
    this.compute();
    if (CSS.highlights && window.Highlight) CSS.highlights.set('colblock', new Highlight(...this.segs.filter((r) => !r.collapsed)));
    // 눈에 보이는 커서는 끝 자리에
    Sel.set(this.focus.cloneRange());
    const n = this.segs.length;
    $('#st-block').textContent = `칸 블록 ${n}줄 (Ctrl+C 복사 · Ctrl+X 오려 두기 · Delete 지우기 · Esc 끝)`;
  },
  text() { return this.segs.map((r) => r.toString().replace(/​/g, '')).join('\n'); },

  moveFocus(dir, unit) {
    Sel.set(this.focus.cloneRange());
    window.getSelection().modify('move', dir, unit);
    this.focus = window.getSelection().getRangeAt(0).cloneRange();
    this.draw();
  },
  setFocusAt(x, y) {
    const p = document.caretRangeFromPoint(x, y);
    if (!p || !Sel.editor.contains(p.startContainer)) return;
    p.collapse(true);
    this.focus = p;
    this.draw();
  },

  copy() {
    const text = this.text();
    this.clip = { text, lines: text.split('\n') };
    this._copying = true;
    document.execCommand('copy');
    this._copying = false;
    status(`칸 블록 ${this.clip.lines.length}줄을 복사했습니다. 붙이면 커서 자리부터 줄마다 같은 칸에 들어갑니다.`);
  },
  remove() {
    History.checkpoint();
    const first = this.segs[0] ? this.segs[0].cloneRange() : null;
    for (let i = this.segs.length - 1; i >= 0; i--) if (!this.segs[i].collapsed) this.segs[i].deleteContents();
    this.stop(false);
    if (first) { first.collapse(true); Sel.set(first); }
    App.changed();
  },
  // 칸 블록으로 복사한 글을 커서 자리부터 줄마다 같은 가로 위치에 붙이기
  pasteColumn(lines) {
    const r0 = Sel.range();
    if (!r0) return false;
    History.checkpoint();
    const s = window.getSelection();
    const x = this.rectOf(r0).left;
    let r = r0.cloneRange();
    r.collapse(true);
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        // 다음 줄의 같은 가로 위치로
        Sel.set(r);
        const before = this.rectOf(r).top;
        s.modify('move', 'forward', 'line');
        let nr = s.getRangeAt(0);
        if (this.rectOf(nr).top <= before + 0.5) {
          // 더 내려갈 줄이 없으면 새 문단
          const blk = blockOf(nr.startContainer);
          const p = h('p', {}, h('br'));
          (blk && blk !== Sel.editor ? blk : Sel.editor.lastElementChild).after(p);
          nr = document.createRange(); nr.setStart(p, 0); nr.collapse(true);
        } else {
          const q = this.rectOf(nr);
          const p = document.caretRangeFromPoint(x + 0.5, q.top + q.height / 2);
          if (p && Sel.editor.contains(p.startContainer)) nr = p;
        }
        r = nr.cloneRange();
        r.collapse(true);
      }
      Sel.set(r);
      // 줄이 짧아 그 가로 위치까지 못 가면 빈칸으로 채움
      const gap = x - this.rectOf(r).left;
      const sp = gap > 2 ? ' '.repeat(Math.round(gap / (parseFloat(getComputedStyle(blockOf(r.startContainer) || Sel.editor).fontSize) * 0.5 * App.zoom || 6))) : '';
      document.execCommand('insertText', false, sp + lines[i]);
      r = s.getRangeAt(0).cloneRange();
    }
    App.changed();
    return true;
  },

  // 서식 명령을 줄마다 적용
  async each(fn) {
    // 서식을 입히면 글 노드가 쪼개져 시작·끝 자리가 흐트러지므로 화면 위치로 기억했다가 되살림
    const pa = this.pointOf(this.anchor), pf = this.pointOf(this.focus);
    const segs = this.segs.filter((r) => !r.collapsed).map((r) => r.cloneRange());
    for (const r of segs) { Sel.set(r); await fn(); }
    this.anchor = this.rangeAt(pa) || this.anchor;
    this.focus = this.rangeAt(pf) || this.focus;
    this.draw();
  },
  pointOf(r) {
    const q = this.rectOf(r), e = Sel.editor.getBoundingClientRect();
    return { x: q.left - e.left, y: q.top + q.height / 2 - e.top };
  },
  rangeAt(pt) {
    const e = Sel.editor.getBoundingClientRect();
    const p = document.caretRangeFromPoint(e.left + pt.x + 0.5, e.top + pt.y);
    if (!p || !Sel.editor.contains(p.startContainer)) return null;
    p.collapse(true);
    return p;
  },

  // App.onKeyDown 에서 부름
  onKey(e, k) {
    if (!this.active) return false;
    const nav = { Left: ['backward', 'character'], Right: ['forward', 'character'], Up: ['backward', 'line'], Down: ['forward', 'line'], Home: ['backward', 'lineboundary'], End: ['forward', 'lineboundary'], 'Ctrl+Left': ['backward', 'word'], 'Ctrl+Right': ['forward', 'word'], PageUp: ['backward', 'paragraph'], PageDown: ['forward', 'paragraph'] };
    const kk = k.replace(/^Shift\+/, '').replace(/^Ctrl\+Shift\+/, 'Ctrl+');
    if (nav[kk]) { this.moveFocus(...nav[kk]); return true; }
    if (k === 'Escape' || k === 'F4') { this.stop(); status('칸 블록을 끝냈습니다.'); return true; }
    if (k === 'Ctrl+C' || k === 'Ctrl+Insert') { this.copy(); return true; }
    if (k === 'Ctrl+X' || k === 'Shift+Delete') { this.copy(); this.remove(); return true; }
    if (k === 'Delete' || k === 'Backspace') { this.remove(); return true; }
    const id = Commands.forKey(k);
    if (id && Commands.get(id).group === '서식') { Commands.exec(id); return true; }
    // 다른 키는 칸 블록을 끝내고 그대로
    this.stop();
    return false;
  },

  init() {
    const ed = Sel.editor;
    ed.addEventListener('copy', (e) => {
      if (!this._copying) return;
      e.preventDefault();
      e.clipboardData.setData('text/plain', this.clip.text);
    }, true);
    // Shift+클릭: 칸 블록 넓히기 / Alt+끌기: 칸 블록 시작
    ed.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (this.active && e.shiftKey) { e.preventDefault(); e.stopPropagation(); this.setFocusAt(e.clientX, e.clientY); return; }
      if (this.active && !e.altKey) { this.stop(false); return; }
      if (e.altKey && !e.ctrlKey && !Img.objOf(e.target)) {
        const p = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (!p || !ed.contains(p.startContainer)) return;
        e.preventDefault();
        e.stopPropagation();
        ed.focus({ preventScroll: true });
        this.start(p);
        const move = (ev) => this.setFocusAt(ev.clientX, ev.clientY);
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      }
    }, true);
    const redraw = () => { if (this.active && CSS.highlights) this.draw(); };
    $('#workspace').addEventListener('scroll', debounce(redraw, 60));
  },
};
