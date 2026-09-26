// 여러 커서 동시 편집 (Ctrl+Shift+;, VS Code의 Ctrl+Shift+L 방식)
// 커서마다 기준점(anchor)과 끝점(focus)을 "살아 있는" Range 로 들고 있다가,
// 입력·지우기·이동을 커서마다 실제 선택으로 바꿔 가며 똑같이 실행한다.
'use strict';
const MultiSel = {
  active: false,
  carets: [],      // [{ a: Range(접힘), f: Range(접힘) }]
  primary: 0,      // 실제 커서(화면 선택)로 쓰는 번호
  busy: false,

  start() {
    if (this.active) this.stop();
    const r = Sel.range();
    if (!r) return;
    let text, whole = false, pr = r.cloneRange();
    if (r.collapsed) {
      const w = wordAt(r);
      if (!w) { status('커서가 낱말 위에 있지 않습니다.'); return; }
      text = w.text; pr = w.range; whole = true;
    } else {
      text = r.toString();
      if (!text.replace(/​/g, '').trim()) { status('선택한 글자가 없습니다.'); return; }
      if (/\n/.test(text) || Sel.blocks().length > 1) { status('한 문단 안의 글자만 모두 선택할 수 있습니다.'); return; }
    }
    const idx = Find.index();
    const esc = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 한글 낱말은 조사가 붙으므로(바벨론이, 바벨론을) 앞쪽 경계만 본다
    const hangul = /[\uAC00-\uD7A3]/.test(text);
    const re = new RegExp(whole ? (hangul ? `(?<![\\p{L}\\p{N}_])${esc}` : `(?<![\\p{L}\\p{N}_])${esc}(?![\\p{L}\\p{N}_])`) : esc, 'gu');
    const pStart = Find.posToIndex(idx, pr.startContainer, pr.startOffset);
    const carets = [];
    let primary = 0;
    for (const m of idx.str.matchAll(re)) {
      const rg = Find.rangeFor(idx, m.index, m.index + m[0].length);
      if (!rg) continue;
      const anc = rg.commonAncestorContainer.nodeType === 3 ? rg.commonAncestorContainer.parentElement : rg.commonAncestorContainer;
      if (anc.closest('.mm-field') || !Sel.editor.contains(anc)) continue;
      if (m.index <= pStart && pStart <= m.index + m[0].length) primary = carets.length;
      carets.push(this.make(rg.startContainer, rg.startOffset, rg.endContainer, rg.endOffset));
    }
    if (!carets.length) return;
    History.checkpoint();
    this.carets = carets;
    this.primary = primary;
    this.active = true;
    this.focusPrimary();
    this.draw();
    $('#st-block').textContent = `커서 ${carets.length}개 (입력·지우기·방향키가 모두에 적용 · Esc 끝내기)`;
    status(`"${text}" ${carets.length}곳을 모두 선택했습니다.`);
  },

  make(an, ao, fn, fo) {
    const a = document.createRange(); a.setStart(an, ao); a.collapse(true);
    const f = document.createRange(); f.setStart(fn, fo); f.collapse(true);
    return { a, f };
  },
  // 커서 하나를 실제 선택으로
  apply(c) {
    const s = window.getSelection();
    try { s.setBaseAndExtent(c.a.startContainer, c.a.startOffset, c.f.startContainer, c.f.startOffset); } catch { /* 무시 */ }
  },
  // 실제 선택을 커서에 되돌려 담기
  capture(c) {
    const s = window.getSelection();
    if (!s.anchorNode) return;
    c.a.setStart(s.anchorNode, s.anchorOffset); c.a.collapse(true);
    c.f.setStart(s.focusNode, s.focusOffset); c.f.collapse(true);
  },
  focusPrimary() {
    Sel.editor.focus({ preventScroll: true });
    this.apply(this.carets[this.primary]);
  },
  // 모든 커서에 같은 동작 (문서 뒤쪽 커서부터 해야 앞쪽 위치가 흐트러지지 않음)
  run(fn) {
    if (!this.active) return;
    this.busy = true;
    const order = this.carets.map((c, i) => i).sort((i, j) => {
      const x = this.carets[i].f, y = this.carets[j].f;
      return y.compareBoundaryPoints(Range.START_TO_START, x);
    });
    for (const i of order) {
      const c = this.carets[i];
      if (!Sel.editor.contains(c.f.startContainer)) continue;
      this.apply(c);
      fn(window.getSelection(), i);
      this.capture(c);
    }
    this.busy = false;
    this.dedupe();
    this.focusPrimary();
    this.draw();
  },
  // Ctrl+Alt+↑/↓: 위·아래 문단(Enter로 나뉜 줄)의 같은 글자 칸에 커서 더하기 (VS Code 방식)
  paraBlocks() {
    const out = [];
    const walk = (el) => {
      for (const c of el.children) {
        if (c.classList.contains('pagebreak') || c.classList.contains('colbreak')) continue;
        if (c.tagName === 'TABLE') {
          for (const cell of c.querySelectorAll(':scope > tbody > tr > td, :scope > tbody > tr > th, :scope > thead > tr > td, :scope > thead > tr > th, :scope > tr > td, :scope > tr > th')) {
            if ([...cell.children].some((x) => isBlock(x))) walk(cell); else out.push(cell);
          }
          continue;
        }
        if (/^(UL|OL)$/.test(c.tagName)) { walk(c); continue; }
        if (/^(P|DIV|H[1-6]|LI|BLOCKQUOTE|PRE)$/.test(c.tagName)) {
          if ([...c.children].some((x) => isBlock(x))) {
            // 안쪽 목록 앞에 제 글이 있는 항목(목록 항목 + 하위 목록)은 그 항목도 한 줄로
            const own = Array.from(c.childNodes).filter((x) => !isBlock(x));
            if (own.some((x) => (x.textContent || '').replace(/[\s\u200B]/g, ''))) out.push(c);
            walk(c);
          } else out.push(c);
        }
      }
    };
    walk(Sel.editor);
    return out;
  },
  offsetIn(blk, node, off) { const r = document.createRange(); r.setStart(blk, 0); r.setEnd(node, off); return r.toString().length; },
  pointAt(blk, n) {
    const tw = document.createTreeWalker(blk, NodeFilter.SHOW_TEXT);
    let t, last = null;
    while ((t = tw.nextNode())) { if (n <= t.length) return [t, n]; n -= t.length; last = t; }
    if (last) return [last, last.length];
    // 빈 문단: 가장 안쪽 요소의 줄 나눔 앞
    let el = blk;
    while (el.firstElementChild && el.firstElementChild.tagName !== 'BR' && !el.firstElementChild.matches('.nobj,.tab,img')) el = el.firstElementChild;
    return [el, 0];
  },
  addLine(down) {
    const s = window.getSelection();
    const ed = Sel.editor;
    if (!this.active) {
      if (!s.rangeCount || !ed.contains(s.focusNode)) return;
      const blk = blockOf(s.focusNode) || null;
      if (!blk) { status('문단 안에 커서를 두고 누르세요.'); return; }
      History.checkpoint();
      this.carets = [this.make(s.anchorNode, s.anchorOffset, s.focusNode, s.focusOffset)];
      this.primary = 0;
      this.active = true;
      this.col = this.offsetIn(blk, s.focusNode, s.focusOffset);
    }
    // 문서에서 맨 뒤(맨 앞) 커서의 문단 다음(앞) 문단으로
    let edge = null;
    for (const c of this.carets) {
      if (!ed.contains(c.f.startContainer)) continue;
      if (!edge || (down ? c.f.compareBoundaryPoints(Range.START_TO_START, edge.f) > 0 : c.f.compareBoundaryPoints(Range.START_TO_START, edge.f) < 0)) edge = c;
    }
    if (!edge) return;
    const blocks = this.paraBlocks();
    const cur = blockOf(edge.f.startContainer);
    let i = blocks.indexOf(cur);
    let next = null;
    if (i >= 0) next = blocks[i + (down ? 1 : -1)];
    else {
      // 목록 항목 안 등 목록에 없는 자리: 문서 순서로 다음(앞) 문단
      const at = (b, end) => { const r = document.createRange(); r.selectNodeContents(b); r.collapse(!end); return r; };
      if (down) next = blocks.find((b) => at(b, false).compareBoundaryPoints(Range.START_TO_START, edge.f) > 0) || null;
      else next = blocks.filter((b) => at(b, true).compareBoundaryPoints(Range.START_TO_START, edge.f) < 0).pop() || null;
    }
    let added = null;
    if (next) {
      const [n, o] = this.pointAt(next, this.col || 0);
      added = this.make(n, o, n, o);
      this.carets.push(added);
    } else status(down ? '아래에 더 문단이 없습니다.' : '위에 더 문단이 없습니다.');
    this.dedupe();
    if (added && this.carets.includes(added)) this.primary = this.carets.indexOf(added);
    this.focusPrimary();
    this.draw();
    $('#st-block').textContent = `커서 ${this.carets.length}개 (입력·지우기·방향키가 모두에 적용 · Esc 끝내기)`;
    App.scrollToSelection();
  },
  // 같은 자리에 겹친 커서 합치기
  dedupe() {
    const out = [];
    let prim = this.carets[this.primary];
    for (const c of this.carets) {
      if (!Sel.editor.contains(c.f.startContainer)) continue;
      if (out.some((d) => d.f.compareBoundaryPoints(Range.START_TO_START, c.f) === 0 && d.a.compareBoundaryPoints(Range.START_TO_START, c.a) === 0)) { if (c === prim) prim = null; continue; }
      out.push(c);
    }
    this.carets = out;
    this.primary = Math.max(0, prim ? out.indexOf(prim) : 0);
    if (!out.length) this.stop();
  },

  // ---------- 동작 ----------
  insertText(t) {
    History.beforeTyping('text');
    this.run(() => document.execCommand('insertText', false, t));
    App.changed();
  },
  // 선택마다 괄호·따옴표로 감싸기 (선택이 없는 커서에는 그 글자를 입력)
  wrap(open) {
    const close = App.WRAP_PAIRS[open];
    History.checkpoint();
    this.run((s) => {
      if (s.isCollapsed) { document.execCommand('insertText', false, open); return; }
      const r = s.getRangeAt(0).cloneRange();
      const c = document.createTextNode(close), o = document.createTextNode(open);
      const er = r.cloneRange(); er.collapse(false); er.insertNode(c);
      const sr = r.cloneRange(); sr.collapse(true); sr.insertNode(o);
      const back = s.anchorNode && s.focusNode && (s.anchorNode !== r.startContainer || s.anchorOffset !== r.startOffset);
      const nr = document.createRange(); nr.setStartAfter(o); nr.setEndBefore(c);
      if (back) s.setBaseAndExtent(nr.endContainer, nr.endOffset, nr.startContainer, nr.startOffset);
      else s.setBaseAndExtent(nr.startContainer, nr.startOffset, nr.endContainer, nr.endOffset);
    });
    App.changed();
  },
  hasSelection() { return this.carets.some((c) => !this.collapsed(c)); },
  del(forward, word) {
    History.beforeTyping('delete');
    this.run((s) => {
      if (s.isCollapsed) s.modify('extend', forward ? 'forward' : 'backward', word ? 'word' : 'character');
      if (!s.isCollapsed) document.execCommand('delete');
    });
    App.changed();
  },
  // 선택된 글자만 지우기 (한글 입력 시작 전 준비)
  clearSelections(exceptPrimary) {
    if (!this.carets.some((c, i) => (!exceptPrimary || i !== this.primary) && !this.collapsed(c))) return;
    History.beforeTyping('text');
    const prim = this.carets[this.primary];
    this.run((s, i) => { if (!s.isCollapsed && !(exceptPrimary && this.carets[i] === prim)) document.execCommand('delete'); });
  },
  collapsed(c) { return c.a.compareBoundaryPoints(Range.START_TO_START, c.f) === 0; },
  move(dir, unit, extend) {
    History.endTyping();
    this.run((s) => {
      if (!extend && !s.isCollapsed && (unit === 'character')) {
        // 선택이 있으면 그 끝으로 접기
        if (dir === 'backward') s.collapseToStart(); else s.collapseToEnd();
        return;
      }
      s.modify(extend ? 'extend' : 'move', dir, unit);
    });
  },
  // ---------- 한글 입력기(조합) ----------
  // 조합 중에는 실제 선택을 건드리면 입력이 깨지므로, 다른 커서 자리마다 전용 글자 노드를 만들어
  // 조합 중인 글자를 그대로 비춰 준다 (선택은 바꾸지 않음).
  compStart() {
    if (!this.active) return;
    const prim = this.carets[this.primary];
    const items = [];
    for (const c of this.carets) {
      if (c === prim || !Sel.editor.contains(c.f.startContainer)) continue;
      // 선택된 글자가 남아 있으면 지우기
      if (!this.collapsed(c)) {
        const back = c.f.compareBoundaryPoints(Range.START_TO_START, c.a) < 0;
        const rg = document.createRange();
        rg.setStart((back ? c.f : c.a).startContainer, (back ? c.f : c.a).startOffset);
        rg.setEnd((back ? c.a : c.f).startContainer, (back ? c.a : c.f).startOffset);
        rg.deleteContents();
        c.a.setStart(rg.startContainer, rg.startOffset); c.a.collapse(true);
        c.f.setStart(rg.startContainer, rg.startOffset); c.f.collapse(true);
      }
      let n = c.f.startContainer, o = c.f.startOffset;
      const t = document.createTextNode('');
      if (n.nodeType === 3) {
        const rest = o < n.length ? n.splitText(o) : null;
        n.parentNode.insertBefore(t, rest || n.nextSibling);
      } else {
        n.insertBefore(t, n.childNodes[o] || null);
      }
      items.push({ c, t });
    }
    this.comp = { items };
  },
  compUpdate(text) {
    if (!this.comp) return;
    for (const it of this.comp.items) if (it.t.nodeValue !== text) it.t.nodeValue = text;
    this.draw();
  },
  compEnd(text) {
    if (!this.comp) return;
    for (const it of this.comp.items) {
      if (text != null && it.t.nodeValue !== text) it.t.nodeValue = text;
      it.c.a.setStart(it.t, it.t.length); it.c.a.collapse(true);
      it.c.f.setStart(it.t, it.t.length); it.c.f.collapse(true);
    }
    this.comp = null;
    const prim = this.carets[this.primary];
    if (prim && Sel.inEditor()) this.capture(prim); // 기준 커서는 입력기가 넣은 글자 뒤
    this.draw();
    App.changed();
  },
  // 조합 중에 방향키를 누르면 입력기가 기준 커서만 옮기므로, 나머지 커서도 같이 옮긴다
  navOthers(dir, unit, extend) {
    const prim = this.carets[this.primary];
    this.capture(prim); // 입력기가 옮긴 기준 커서 위치를 먼저 받아 두기
    this.busy = true;
    for (const c of this.carets) {
      if (c === prim || !Sel.editor.contains(c.f.startContainer)) continue;
      this.apply(c);
      window.getSelection().modify(extend ? 'extend' : 'move', dir, unit);
      this.capture(c);
    }
    this.busy = false;
    this.dedupe();
    this.focusPrimary();
    this.draw();
  },
  // 서식 명령을 모든 커서의 선택 부분에 적용
  async each(fn) {
    this.busy = true;
    for (const c of this.carets) {
      if (this.collapsed(c)) continue;
      this.apply(c);
      await fn();
      this.capture(c);
    }
    this.busy = false;
    this.focusPrimary();
    this.draw();
  },

  // ---------- 화면 표시 (다른 커서의 깜빡이는 막대 + 선택 영역) ----------
  draw() {
    const box = $('#mcarets');
    if (!box) return;
    box.innerHTML = '';
    if (!this.active) { if (window.CSS && CSS.highlights) CSS.highlights.delete('multi'); return; }
    const page = $('#page').getBoundingClientRect();
    const z = App.zoom;
    const ranges = [];
    this.carets.forEach((c, i) => {
      const rg = document.createRange();
      const back = c.f.compareBoundaryPoints(Range.START_TO_START, c.a) < 0;
      rg.setStart((back ? c.f : c.a).startContainer, (back ? c.f : c.a).startOffset);
      rg.setEnd((back ? c.a : c.f).startContainer, (back ? c.a : c.f).startOffset);
      if (!rg.collapsed && i !== this.primary) ranges.push(rg);
      if (i === this.primary) return;
      const rects = c.f.getClientRects();
      let r = rects[0] || c.f.getBoundingClientRect();
      if (!r || (!r.height && c.f.startContainer.nodeType === 1)) {
        const el = c.f.startContainer.childNodes[c.f.startOffset] || c.f.startContainer;
        if (el.getBoundingClientRect) r = el.getBoundingClientRect();
      }
      if (!r) return;
      box.append(h('div', { class: 'mcaret', style: { left: (r.left - page.left) / z + 'px', top: (r.top - page.top) / z + 'px', height: Math.max(12, r.height / z) + 'px' } }));
    });
    if (window.CSS && CSS.highlights && window.Highlight) CSS.highlights.set('multi', new Highlight(...ranges));
  },

  stop() {
    if (!this.active) return;
    this.active = false;
    const prim = this.carets[this.primary];
    this.carets = [];
    $('#st-block').textContent = '';
    this.draw();
    if (prim && Sel.editor.contains(prim.f.startContainer)) {
      Sel.editor.focus({ preventScroll: true });
      const s = window.getSelection();
      try { s.setBaseAndExtent(prim.a.startContainer, prim.a.startOffset, prim.f.startContainer, prim.f.startOffset); } catch { /* 무시 */ }
    }
  },

  // 키 처리 (App.onKeyDown 에서 호출). 처리했으면 true
  NAV: null,
  onKey(e, k) {
    const nav = this.NAV = this.NAV || {
      Left: ['backward', 'character'], Right: ['forward', 'character'],
      Up: ['backward', 'line'], Down: ['forward', 'line'],
      Home: ['backward', 'lineboundary'], End: ['forward', 'lineboundary'],
      'Ctrl+Left': ['backward', 'word'], 'Ctrl+Right': ['forward', 'word'],
      'Ctrl+Home': ['backward', 'documentboundary'], 'Ctrl+End': ['forward', 'documentboundary'],
    };
    const shift = /(^|\+)Shift\+/.test(k);
    const base = k.replace('Shift+', '');
    if (k === 'Escape') { this.stop(); return true; }
    if (k === 'Ctrl+Alt+Down' || k === 'Ctrl+Alt+Up') { this.addLine(k.endsWith('Down')); return true; }
    if (nav[base]) { this.move(nav[base][0], nav[base][1], shift); return true; }
    if (base === 'Backspace' || base === 'Delete' || base === 'Ctrl+Backspace' || base === 'Ctrl+Delete') {
      this.del(base.endsWith('Delete'), base.startsWith('Ctrl+'));
      return true;
    }
    if (k === 'Tab') { this.insertText('\t'); return true; }
    if (k === 'Enter' || k === 'Shift+Enter' || /^Ctrl\+(Z|Y|X|Shift\+Z)$/.test(k)) { this.stop(); return false; }
    // 한글 입력기가 켜져 있어도 괄호·따옴표 키는 감싸기로 (선택을 지우지 않음)
    if (e.key === 'Process' && this.hasSelection() && /^(Digit9|BracketLeft|Quote|Backquote|Comma)$/.test(e.code)) return false;
    if (e.key === 'Process') { this.clearSelections(true); return false; } // 한글 입력 시작 전 다른 커서의 선택 지우기
    return false;
  },
};

function wordAt(r) {
  let node = r.startContainer, off = r.startOffset;
  if (node.nodeType !== 3) {
    const prev = node.childNodes[off - 1];
    const next = node.childNodes[off];
    if (next && next.nodeType === 3) { node = next; off = 0; }
    else if (prev && prev.nodeType === 3) { node = prev; off = prev.length; }
    else return null;
  }
  const s = node.nodeValue;
  const isW = (ch) => /[\p{L}\p{N}_]/u.test(ch);
  let a = off, b = off;
  while (a > 0 && isW(s[a - 1])) a--;
  while (b < s.length && isW(s[b])) b++;
  if (a === b) return null;
  const rg = document.createRange();
  rg.setStart(node, a); rg.setEnd(node, b);
  return { text: s.slice(a, b), range: rg };
}
