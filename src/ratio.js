// 장평(글자 가로 비율): span의 --hr(50~200, 기본 100)로 저장하고,
// 화면에서는 낱말마다 inline-block(.rw)으로 감싸 가로로 줄이거나 늘림 (줄바꿈은 낱말 사이에서)
'use strict';
const Ratio = {
  of(el) {
    if (!el) return 100;
    if (el.nodeType === 3) el = el.parentElement;
    const v = parseFloat(getComputedStyle(el).getPropertyValue('--hr'));
    return v > 0 ? v : 100;
  },
  // 커서를 문단 안 글자 위치로 기억했다가 되살림 (노드를 쪼개고 옮겨도 제자리)
  keep(fn) {
    const s = window.getSelection();
    let k = null;
    if (s.rangeCount && Sel.editor.contains(s.focusNode)) {
      const bf = blockOf(s.focusNode), ba = blockOf(s.anchorNode);
      if (bf && bf === ba) {
        const off = (n, o) => { const r = document.createRange(); r.setStart(bf, 0); r.setEnd(n, o); return r.toString().length; };
        k = { blk: bf, a: off(s.anchorNode, s.anchorOffset), f: off(s.focusNode, s.focusOffset) };
      }
    }
    const changed = fn();
    if (changed && k && k.blk.isConnected) {
      const at = (n) => {
        const tw = document.createTreeWalker(k.blk, NodeFilter.SHOW_TEXT);
        let t, last = null;
        while ((t = tw.nextNode())) { if (n <= t.length) return [t, n]; n -= t.length; last = t; }
        return last ? [last, last.length] : null;
      };
      const pa = at(k.a), pf = at(k.f);
      if (pa && pf) { try { s.setBaseAndExtent(pa[0], pa[1], pf[0], pf[1]); } catch { /* 무시 */ } }
    }
  },
  render(root) {
    root = root || Sel.editor;
    if (App.composing) return;
    const hasHr = root.querySelector('[style*="--hr"]');
    const rws = Array.from(root.querySelectorAll('span.rw'));
    if (!hasHr && !rws.length) return;
    this.keep(() => {
      let changed = false;
      // 1) 더는 맞지 않는 낱말 상자 풀기 (띄어쓰기가 들어감, 장평이 100이 됨, 안에 다른 요소)
      for (const rw of rws) {
        const own = (rw.getAttribute('style') || '').replace(/margin-right:[^;]*;?/g, '').trim();
        const bad = /\s/.test(rw.textContent) || this.of(rw.parentElement) === 100 || rw.querySelector('*') || !rw.textContent;
        if (own) {
          // 서식이 입혀진 상자는 보통 span으로 되돌림
          rw.classList.remove('rw'); if (!rw.className) rw.removeAttribute('class');
          rw.style.marginRight = '';
          changed = true;
        } else if (bad) {
          rw.replaceWith(...Array.from(rw.childNodes));
          changed = true;
        }
      }
      if (changed) root.normalize();
      // 2) 장평이 걸린 글 중 상자 밖의 낱말을 감싸기
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (t) => (t.nodeValue.replace(/[\s​]/g, '') && !t.parentElement.closest('.rw, .nobj svg, .tab, .mm-field') && this.of(t) !== 100 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
      });
      const nodes = [];
      let t;
      while ((t = tw.nextNode())) nodes.push(t);
      // 낱말 사이에 남은 줄바꿈 안 되는 띄어쓰기(입력 중 생긴 &nbsp;)를 보통 띄어쓰기로
      for (const rw of root.querySelectorAll('span.rw')) {
        const sp = rw.nextSibling;
        if (sp && sp.nodeType === 3 && sp.nodeValue === '\u00a0' && sp.nextSibling) { sp.nodeValue = ' '; changed = true; }
      }
      for (const node of nodes) {
        const parts = node.nodeValue.split(/(\s+)/);
        for (let i = 1; i < parts.length - 1; i++) if (parts[i] === '\u00a0' && parts[i + 1]) parts[i] = ' ';
        if (parts.length === 1 && node.parentElement.classList.contains('rw')) continue;
        const frag = document.createDocumentFragment();
        for (const p of parts) {
          if (!p) continue;
          if (/^\s+$/.test(p)) frag.append(document.createTextNode(p));
          else frag.append(h('span', { class: 'rw' }, p));
        }
        node.replaceWith(frag);
        changed = true;
      }
      return changed;
    });
    // 3) 줄인 만큼 옆 글자를 당기기 (transform은 자리를 차지하는 너비를 바꾸지 않음)
    for (const rw of root.querySelectorAll('span.rw')) {
      const r = this.of(rw) / 100;
      const m = ((r - 1) * rw.offsetWidth).toFixed(2) + 'px';
      if (rw.style.marginRight !== m) rw.style.marginRight = m;
    }
  },
  // 장평 바꾸기 (선택 영역, 없으면 이어 쓸 글자)
  step(delta) {
    let shown = null;
    Fmt.styleSpans((el) => {
      const next = Math.max(50, Math.min(200, Math.round(this.of(el)) + delta));
      shown = next;
      return { '--hr': next === 100 ? '' : String(next) };
    });
    this.render();
    App.layout();
    if (shown != null) status(`장평 ${shown}%`);
  },
  // 장평 낱말 상자(inline-block)가 있는 문단에서 Home/End가 상자 끝에서 멈추지 않도록 화면 줄 기준으로 이동
  eol: null,
  lineEdge(forward, extend) {
    const s = window.getSelection();
    if (!s.rangeCount || !Sel.editor.contains(s.focusNode)) return false;
    const blk = blockOf(s.focusNode);
    if (!blk || !blk.querySelector('span.rw')) return false;
    const chars = [];
    const tw = document.createTreeWalker(blk, NodeFilter.SHOW_TEXT);
    let t;
    while ((t = tw.nextNode())) for (let i = 0; i < t.length; i++) chars.push([t, i]);
    const n = chars.length;
    if (!n) return false;
    const pre = document.createRange(); pre.setStart(blk, 0); pre.setEnd(s.focusNode, s.focusOffset);
    const idx = pre.toString().length;
    const rng = document.createRange();
    const rect = (i) => { rng.setStart(chars[i][0], chars[i][1]); rng.setEnd(chars[i][0], chars[i][1] + 1); const r = rng.getBoundingClientRect(); return r.height ? r : null; };
    const atEol = this.eol && this.eol[0] === s.focusNode && this.eol[1] === s.focusOffset;
    let ref = (idx < n && !atEol) ? idx : idx - 1;
    if (ref < 0) ref = 0;
    let line = rect(ref);
    for (let k = ref; !line && k >= 0; k--) line = rect(k);
    if (!line) return false;
    const same = (i) => { const r = rect(i); return !r || (r.top < line.bottom - 2 && r.bottom > line.top + 2); };
    let j = ref, target;
    if (forward) {
      while (j + 1 < n && same(j + 1)) j++;
      target = j + 1;
      // 줄 끝의 띄어쓰기 앞에 커서 (다음 줄이 있을 때)
      if (target < n && /\s/.test(chars[j][0].data[chars[j][1]])) target = j;
    } else {
      while (j - 1 >= 0 && same(j - 1)) j--;
      while (j < ref && !rect(j)) j++;   // 앞 줄 끝에 걸린 띄어쓰기는 건너뜀
      target = j;
    }
    const pos = target < n ? chars[target] : [chars[n - 1][0], chars[n - 1][1] + 1];
    if (extend) s.extend(pos[0], pos[1]); else s.collapse(pos[0], pos[1]);
    this.eol = forward && target < n ? [pos[0], pos[1]] : null;
    return true;
  },
  // 문단 안 글자 목록과 글자 상자
  charsOf(blk) {
    const chars = [];
    const tw = document.createTreeWalker(blk, NodeFilter.SHOW_TEXT);
    let t;
    while ((t = tw.nextNode())) for (let i = 0; i < t.length; i++) chars.push([t, i]);
    return chars;
  },
  charRect(c) {
    const r = document.createRange();
    r.setStart(c[0], c[1]); r.setEnd(c[0], c[1] + 1);
    const b = r.getBoundingClientRect();
    return b.height ? b : null;
  },
  // 위·아래 화살표: 장평 상자가 있는 문단에서는 화면 줄을 직접 계산해 옮김
  goal: null,   // 위·아래로 이어 옮길 때 지키는 가로 위치 {x, node, off}
  lineMove(down, extend) {
    const s = window.getSelection();
    if (!s.rangeCount || !Sel.editor.contains(s.focusNode)) return false;
    const blk = blockOf(s.focusNode);
    if (!blk) return false;
    const chars = this.charsOf(blk);
    const n = chars.length;
    const pre = document.createRange(); pre.setStart(blk, 0); pre.setEnd(s.focusNode, s.focusOffset);
    const idx = pre.toString().length;
    const atEol = this.eol && this.eol[0] === s.focusNode && this.eol[1] === s.focusOffset;
    let ref = (idx < n && !atEol) ? idx : idx - 1;
    let line = null, x;
    const rA = idx < n && !atEol ? this.charRect(chars[idx]) : null;
    const rB = idx > 0 ? this.charRect(chars[idx - 1]) : null;
    if (rA) { line = rA; x = rA.left; } else if (rB) { line = rB; x = rB.right; }
    // 이웃 문단에 장평 상자가 있을 때도 처리
    const sib = down ? blk.nextElementSibling : blk.previousElementSibling;
    const involved = blk.querySelector('span.rw') || (sib && sib.querySelector && sib.querySelector('span.rw'));
    if (!involved) return false;
    if (!line) { line = blk.getBoundingClientRect(); x = line.left; }
    if (this.goal && this.goal.node === s.focusNode && this.goal.off === s.focusOffset) x = this.goal.x;
    const place = (cs, lineSel) => {
      // lineSel 줄에서 x에 가장 가까운 자리
      let best = null, bd = Infinity;
      for (let i = 0; i < cs.length; i++) {
        const r = this.charRect(cs[i]);
        if (!r || !lineSel(r)) continue;
        const dl = Math.abs(r.left - x), dr = Math.abs(r.right - x);
        if (dl < bd) { bd = dl; best = [cs[i][0], cs[i][1]]; }
        if (dr < bd) { bd = dr; best = [cs[i][0], cs[i][1] + 1]; }
      }
      return best;
    };
    let pos = null;
    // 같은 문단의 다음(이전) 화면 줄
    let edge = null;
    for (let i = 0; i < n; i++) {
      const r = this.charRect(chars[i]);
      if (!r) continue;
      if (down && r.top >= line.bottom - 2 && (edge == null || r.top < edge)) edge = r.top;
      if (!down && r.bottom <= line.top + 2 && (edge == null || r.bottom > edge)) edge = r.bottom;
    }
    if (edge != null) {
      pos = place(chars, (r) => (down ? Math.abs(r.top - edge) < 3 : Math.abs(r.bottom - edge) < 3));
    } else if (sib && (/^(P|H[1-6]|LI|DIV)$/).test(sib.tagName) && !sib.closest('.nobj')) {
      // 이웃 문단의 첫(마지막) 화면 줄
      const cs = this.charsOf(sib);
      const rs = cs.map((c) => this.charRect(c)).filter(Boolean);
      if (!rs.length) { pos = cs.length ? [cs[0][0], 0] : [sib, 0]; }
      else {
        const e2 = down ? Math.min(...rs.map((r) => r.top)) : Math.max(...rs.map((r) => r.bottom));
        pos = place(cs, (r) => (down ? Math.abs(r.top - e2) < 3 : Math.abs(r.bottom - e2) < 3));
      }
    } else return false;
    if (!pos) return false;
    if (extend) s.extend(pos[0], pos[1]); else s.collapse(pos[0], pos[1]);
    this.goal = { x, node: s.focusNode, off: s.focusOffset };
    this.eol = null;
    return true;
  },
  init() {
    document.addEventListener('keydown', (e) => {
      const k = e.key;
      if (!['Home', 'End', 'ArrowUp', 'ArrowDown'].includes(k) || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
      if (!Sel.editor.contains(e.target) && e.target !== Sel.editor) return;
      if (window.MultiSel && MultiSel.active) return;
      if (window.ColBlock && ColBlock.active) return;
      const done = (k === 'Home' || k === 'End') ? this.lineEdge(k === 'End', e.shiftKey) : this.lineMove(k === 'ArrowDown', e.shiftKey);
      if (done) { e.preventDefault(); e.stopImmediatePropagation(); App.scrollCaret && App.scrollCaret(); }
    }, true);
    document.addEventListener('selectionchange', () => {
      const s = window.getSelection();
      if (this.eol && !(s.focusNode === this.eol[0] && s.focusOffset === this.eol[1])) this.eol = null;
    });
  },
  set(v) {
    v = Math.max(50, Math.min(200, Math.round(+v || 100)));
    Fmt.styleSpans(() => ({ '--hr': v === 100 ? '' : String(v) }));
    this.render();
  },
};
