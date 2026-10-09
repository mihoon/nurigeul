// 문단 번호 / 글머리표
'use strict';
const NUM_FORMATS = [
  { id: 'decimal-dot', label: '1.  2.  3.' },
  { id: 'decimal-paren', label: '1)  2)  3)' },
  { id: 'paren-decimal', label: '(1)  (2)  (3)' },
  { id: 'circled', label: '①  ②  ③' },
  { id: 'hangul-dot', label: '가.  나.  다.' },
  { id: 'hangul-paren', label: '가)  나)  다)' },
  { id: 'paren-hangul', label: '(가)  (나)  (다)' },
  { id: 'jamo-dot', label: 'ㄱ.  ㄴ.  ㄷ.' },
  { id: 'lower-alpha-dot', label: 'a.  b.  c.' },
  { id: 'upper-alpha-dot', label: 'A.  B.  C.' },
  { id: 'lower-roman-dot', label: 'i.  ii.  iii.' },
  { id: 'upper-roman-dot', label: 'I.  II.  III.' },
];
// 한글 기본 수준별 번호: 1. 가. 1) 가) (1) (가) ①
const LEVEL_FORMATS = ['decimal-dot', 'hangul-dot', 'decimal-paren', 'hangul-paren', 'paren-decimal', 'paren-hangul', 'circled'];
const BULLETS = ['●', '○', '■', '□', '◆', '◇', '▶', '▷', '★', '☆', '✓', '※', '•', '-', '◎', '➤'];
const LEVEL_BULLETS = ['●', '○', '■', '□', '◆', '◇', '•'];

const Lists = {
  // 현재 커서가 있는 목록 항목 / 목록
  currentLi() { return Sel.closest('li'); },
  level(list) {
    let n = 0;
    for (let e = list; e && e !== Sel.editor; e = e.parentElement) if (e.tagName === 'OL' || e.tagName === 'UL') n++;
    return Math.max(1, n);
  },
  fmtOf(ol) { return ol.dataset.fmt || LEVEL_FORMATS[(this.level(ol) - 1) % LEVEL_FORMATS.length]; },
  bulletOf(ul) { return ul.dataset.bullet || LEVEL_BULLETS[(this.level(ul) - 1) % LEVEL_BULLETS.length]; },

  // 목록 명령 뒤 커서가 문단 맨 앞으로 튀는 크롬 동작 막기: 같은 글 노드가 남아 있으면 그 자리로
  keepCaret(fn) {
    const s = window.getSelection();
    let k = null;
    if (s.rangeCount && Sel.editor.contains(s.focusNode)) {
      const blk = blockOf(s.focusNode);
      if (blk && blk === blockOf(s.anchorNode)) {
        const off = (node, o) => { const r = document.createRange(); r.setStart(blk, 0); r.setEnd(node, o); return r.toString().length; };
        k = { a: off(s.anchorNode, s.anchorOffset), f: off(s.focusNode, s.focusOffset) };
      }
    }
    const res = fn();
    // 빈 줄에 번호를 매기면 앞 문단의 글꼴을 이어받게
    if (s.rangeCount && s.isCollapsed) App.carryStyle();
    if (k && s.rangeCount) {
      const blk = blockOf(s.focusNode);
      if (blk && Sel.editor.contains(blk)) {
        const at = (n) => {
          const tw = document.createTreeWalker(blk, NodeFilter.SHOW_TEXT);
          let t, last = null;
          while ((t = tw.nextNode())) { if (n <= t.length) return [t, n]; n -= t.length; last = t; }
          return last ? [last, last.length] : null;
        };
        const pa = at(k.a), pf = at(k.f);
        if (pa && pf) { try { s.setBaseAndExtent(pa[0], pa[1], pf[0], pf[1]); } catch { /* 무시 */ } }
      }
    }
    return res;
  },
  toggle(kind) { return this.keepCaret(() => this._toggle(kind)); },
  _toggle(kind) {
    const li = this.currentLi();
    // 번호 없는 줄이면 다시 번호를 붙임
    if (li && li.classList.contains('nonum')) { li.classList.remove('nonum'); if (!li.className) li.removeAttribute('class'); this.normalize(); return; }
    const want = kind === 'ol' ? 'OL' : 'UL';
    if (li && li.parentElement.tagName === want) {
      document.execCommand(kind === 'ol' ? 'insertOrderedList' : 'insertUnorderedList');
    } else {
      document.execCommand(kind === 'ol' ? 'insertOrderedList' : 'insertUnorderedList');
    }
    this.normalize();
  },
  ensureList(kind) { return this.keepCaret(() => this._ensureList(kind)); },
  _ensureList(kind) {
    const li = this.currentLi();
    const want = kind === 'ol' ? 'OL' : 'UL';
    if (li && li.parentElement.tagName === want) return li.parentElement;
    document.execCommand(kind === 'ol' ? 'insertOrderedList' : 'insertUnorderedList');
    this.normalize();
    const li2 = this.currentLi();
    return li2 ? li2.parentElement : null;
  },
  // 목록 안에 문단 태그가 끼어 있으면 정리 + 표시기 스타일 반영
  normalize() {
    // <p> 안에 들어간 목록 꺼내기
    Sel.editor.querySelectorAll('p > ol, p > ul, div.p > ol, div.p > ul').forEach((list) => {
      const p = list.parentElement;
      const saved = Sel.save();
      const after = p.cloneNode(false);
      let n = list.nextSibling;
      while (n) { const nx = n.nextSibling; after.append(n); n = nx; }
      p.after(list);
      if (after.childNodes.length && (after.textContent.trim() || after.querySelector('img,.nobj'))) list.after(after);
      if (!p.textContent.trim() && !p.querySelector('img,.nobj')) p.remove();
      Sel.restore(saved);
    });
    // 번호를 풀었을 때 문단 밖에 떠도는 글(span 등)을 문단으로 감쌈
    {
      const ed = Sel.editor;
      const isBlk = (n) => n.nodeType === 1 && (isBlock(n) || n.matches('.pagebreak, .colbreak, div.cols, table, .nobj[data-wrap="front"], .nobj[data-wrap="behind"]'));
      const loose = Array.from(ed.childNodes).filter((n) => !isBlk(n) && !(n.nodeType === 3 && !n.nodeValue.trim()));
      if (loose.length) {
        const s = window.getSelection();
        const k = s.rangeCount ? [s.anchorNode, s.anchorOffset, s.focusNode, s.focusOffset] : null;
        let p = null;
        for (const n of Array.from(ed.childNodes)) {
          if (isBlk(n)) { p = null; continue; }
          if (n.nodeType === 3 && !n.nodeValue.trim() && !p) continue;
          if (!p) { p = h('p'); n.before(p); }
          p.append(n);
        }
        if (k && k[0] && ed.contains(k[0]) && ed.contains(k[2])) { try { s.setBaseAndExtent(k[0], k[1], k[2], k[3]); } catch { /* 무시 */ } }
      }
    }
    const unwrap = Sel.editor.querySelectorAll('li > p:only-child');
    const saved2 = unwrap.length ? Sel.save() : null;
    unwrap.forEach((p) => {
      const li = p.parentElement;
      if (p.getAttribute('style')) li.setAttribute('style', (li.getAttribute('style') || '') + ';' + p.getAttribute('style'));
      while (p.firstChild) li.insertBefore(p.firstChild, p);
      p.remove();
    });
    if (saved2) Sel.restore(saved2);
    Sel.editor.querySelectorAll('ul').forEach((ul) => { ul.style.listStyleType = `"${this.bulletOf(ul)} "`; });
    this.syncMarkers();
  },
  // 번호/글머리표 크기·글꼴·색을 항목 첫 글자에 맞추기
  syncMarkers() {
    // 마크다운 문서: 번호·글머리표는 기본 모양 (첫 글자 모양을 따라가면 굵게·코드 글꼴이 항목 전체에 번짐)
    if (Sel.editor.classList.contains('md-doc')) {
      Sel.editor.querySelectorAll('li').forEach((li) => ['fontSize', 'fontFamily', 'color', 'fontWeight'].forEach((k) => { if (li.style[k]) li.style[k] = ''; }));
      return;
    }
    const sel = window.getSelection();
    const keep = sel.rangeCount ? [sel.anchorNode, sel.anchorOffset, sel.focusNode, sel.focusOffset] : null;
    let moved = false;
    Sel.editor.querySelectorAll('li').forEach((li) => {
      // 항목에 바로 들어 있는 글은 li에 붙은 글꼴(번호 모양용)을 빌려 쓰고 있으므로
      // 그 모양을 span으로 옮겨 둠 (새 번호 등으로 li 모양이 바뀌어도 글꼴이 그대로)
      if (App.composing) return; // 한글 조합 중에는 건드리지 않음
      const props = ['fontFamily', 'fontSize', 'color', 'fontWeight'].filter((k) => li.style[k]);
      if (!props.length) return;
      let run = [];
      const flush = () => {
        if (run.some((n) => (n.nodeType === 3 ? n.nodeValue.replace(/[\s\u200B]/g, '') : true))) {
          const sp = h('span');
          props.forEach((k) => (sp.style[k] = li.style[k]));
          run[0].before(sp);
          run.forEach((n) => sp.append(n));
          moved = true;
        }
        run = [];
      };
      for (const c of Array.from(li.childNodes)) {
        const inl = c.nodeType === 3 || (c.nodeType === 1 && !isBlock(c) && !/^(OL|UL)$/.test(c.tagName) && !(c.tagName === 'SPAN' && c.style.fontFamily) && c.getAttribute('contenteditable') !== 'false');
        if (inl) run.push(c); else flush();
      }
      flush();
    });
    if (moved && keep && keep[0] && Sel.editor.contains(keep[0]) && Sel.editor.contains(keep[2])) {
      try { sel.setBaseAndExtent(keep[0], keep[1], keep[2], keep[3]); } catch { /* 무시 */ }
    }
    Sel.editor.querySelectorAll('li').forEach((li) => {
      const tw = document.createTreeWalker(li, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest('li') === li && n.nodeValue.replace(/[\s​]/g, '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) });
      const t = tw.nextNode();
      const src = t ? t.parentElement : null;
      const set = (k, v) => { if (li.style[k] !== v) li.style[k] = v; };
      // li 자체 값을 비운 뒤 재야 첫 글자의 진짜 모양을 알 수 있음
      ['fontSize', 'fontFamily', 'color', 'fontWeight'].forEach((k) => (li.style[k] = ''));
      let from = src && src !== li ? src : null;
      if (!from) {
        // 빈 항목: 안쪽 글자 모양 요소(빈 span 등)나 바로 앞 항목의 모양을 따름
        const inner = Array.from(li.querySelectorAll('span, b, strong, i, em, u, font')).filter((x) => x.closest('li') === li).pop();
        if (inner) from = inner;
        else {
          const prev = li.previousElementSibling;
          if (prev && prev.tagName === 'LI') { ['fontSize', 'fontFamily', 'color', 'fontWeight'].forEach((k) => set(k, prev.style[k])); }
          return;
        }
      }
      const cs = getComputedStyle(from);
      set('fontSize', cs.fontSize);
      set('fontFamily', cs.fontFamily);
      set('color', cs.color);
      set('fontWeight', parseInt(cs.fontWeight, 10) >= 600 ? 'bold' : '');
    });
  },

  // 빈 번호 항목에서 Enter: 그 줄은 번호 없는 빈 줄로 두고 다음 줄에 다음 번호
  // (번호 없는 빈 줄에서 한 번 더 Enter면 목록을 끝냄 → 기본 동작)
  enterOnEmpty() {
    const r = Sel.range();
    if (!r || !r.collapsed) return false;
    const li = this.currentLi();
    if (!li || li.classList.contains('nonum')) return false;
    if (li.textContent.replace(/[\s\u200B]/g, '') || li.querySelector('img,.nobj,table,ol,ul')) return false;
    // 목록의 첫 항목이 비었으면 기본 동작(목록 끝내기)
    if (!li.previousElementSibling) return false;
    History.checkpoint();
    li.classList.add('nonum');
    // 새 줄은 빈 줄의 글자 모양(글꼴 span 등)을 그대로 이어받음
    const nli = li.cloneNode(true);
    nli.classList.remove('nonum');
    if (!nli.className) nli.removeAttribute('class');
    nli.querySelectorAll('br').forEach((b, i) => { if (i) b.remove(); });
    let br = nli.querySelector('br');
    if (!br) { br = h('br'); (nli.querySelector('span') || nli).append(br); }
    li.after(nli);
    const cr = document.createRange();
    cr.setStartBefore(br); cr.collapse(true);
    Sel.set(cr);
    this.normalize();
    App.changed();
    return true;
  },

  // 새 번호로 시작 / 번호 모양
  applyNumbering(a) { return this.keepCaret(() => this._applyNumbering(a)); },
  _applyNumbering({ fmt, restart, start }) {
    const ol = this.ensureList('ol');
    if (!ol) return;
    let target = ol;
    if (restart) {
      const li = this.currentLi();
      const first = ol.querySelector(':scope > li');
      if (li && li.parentElement === ol && li !== first) {
        // 현재 항목부터 새 목록으로 떼어내기
        target = ol.cloneNode(false);
        target.removeAttribute('start');
        let n = li;
        const move = [];
        while (n) { move.push(n); n = n.nextSibling; }
        move.forEach((x) => target.append(x));
        ol.after(target);
        Sel.caretInto(li, false);
      }
      if (+start > 1) target.setAttribute('start', +start); else target.removeAttribute('start');
    } else {
      // 앞 번호에 이어: 바로 앞 목록과 합치기
      const prev = ol.previousElementSibling;
      if (prev && prev.tagName === 'OL' && !restart && fmt && (prev.dataset.fmt || '') === (fmt || '')) {
        while (ol.firstChild) prev.append(ol.firstChild);
        ol.remove();
        target = prev;
      }
    }
    if (fmt) target.dataset.fmt = fmt;
    this.normalize();
  },
  applyBullet(ch) {
    const ul = this.ensureList('ul');
    if (!ul) return;
    ul.dataset.bullet = ch;
    this.normalize();
  },
  levelChange(deeper) {
    if (!this.currentLi()) return false;
    document.execCommand(deeper ? 'indent' : 'outdent');
    this.normalize();
    return true;
  },

  // 번호 글자 만들기 (저장용)
  format(n, fmt) {
    const circ = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
    const hangul = '가나다라마바사아자차카타파하';
    const jamo = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ';
    const alpha = (k) => { let s = ''; while (k > 0) { k--; s = String.fromCharCode(97 + (k % 26)) + s; k = Math.floor(k / 26); } return s; };
    const roman = (k) => { const m = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]; let s = ''; for (const [v, r] of m) while (k >= v) { s += r; k -= v; } return s; };
    const cyc = (set, k) => set[(k - 1) % set.length];
    switch (fmt) {
      case 'decimal-paren': return `${n})`;
      case 'paren-decimal': return `(${n})`;
      case 'circled': return n <= 20 ? circ[n - 1] : `(${n})`;
      case 'hangul-dot': return `${cyc(hangul, n)}.`;
      case 'hangul-paren': return `${cyc(hangul, n)})`;
      case 'paren-hangul': return `(${cyc(hangul, n)})`;
      case 'jamo-dot': return `${cyc(jamo, n)}.`;
      case 'lower-alpha-dot': return `${alpha(n)}.`;
      case 'upper-alpha-dot': return `${alpha(n).toUpperCase()}.`;
      case 'lower-roman-dot': return `${roman(n)}.`;
      case 'upper-roman-dot': return `${roman(n).toUpperCase()}.`;
      default: return `${n}.`;
    }
  },
  markerText(li) {
    const list = li.parentElement;
    if (!list) return '';
    if (list.tagName === 'UL') return li.classList.contains('nonum') ? '' : this.bulletOf(list) + ' ';
    if (li.classList.contains('nonum')) return '';
    let n = parseInt(list.getAttribute('start') || '1', 10);
    for (let x = list.firstElementChild; x && x !== li; x = x.nextElementSibling) if (x.tagName === 'LI' && !x.classList.contains('nonum')) n++;
    return this.format(n, this.fmtOf(list)) + ' ';
  },

  // ---------- 대화상자 ----------
  // 새 번호로 시작: 시작 번호를 고름 (지금 항목의 번호가 기본값)
  async restartDialog() {
    const li = this.currentLi();
    let cur = 1;
    if (li && li.parentElement.tagName === 'OL') cur = parseInt(this.markerText(li), 10) || 1;
    const v = await Dialog.form('문단 번호 새로 시작', [
      { name: 'start', label: '시작 번호', type: 'number', value: cur, min: 1, max: 9999, step: 1 },
    ], { okLabel: '설정', width: 300, note: '커서가 있는 문단부터 이 번호로 다시 매깁니다. 번호 모양이 가·나·다, ①②③이면 그 차례의 글자로 나옵니다.' });
    if (!v) return null;
    return { start: Math.max(1, Math.round(v.start || 1)) };
  },
  numberingDialog() {
    return new Promise((resolve) => {
      const li = this.currentLi();
      const ol = li && li.parentElement.tagName === 'OL' ? li.parentElement : null;
      let fmt = ol ? this.fmtOf(ol) : 'decimal-dot';
      const grid = h('div', { class: 'fmt-grid' });
      const paint = () => grid.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.id === fmt));
      NUM_FORMATS.forEach((f) => {
        const b = h('button', { type: 'button', 'data-id': f.id }, f.label);
        b.addEventListener('click', () => { fmt = f.id; paint(); });
        b.addEventListener('dblclick', () => { fmt = f.id; result = read(); api.close(); });
        grid.append(b);
      });
      paint();
      const cont = h('input', { type: 'radio', name: 'numstart', checked: true });
      const fresh = h('input', { type: 'radio', name: 'numstart' });
      const startIn = h('input', { type: 'number', min: 1, value: ol ? parseInt(ol.getAttribute('start') || '1', 10) : 1, style: { width: '70px' } });
      startIn.addEventListener('focus', () => (fresh.checked = true));
      const read = () => ({ fmt, restart: fresh.checked, start: +startIn.value || 1 });
      let result = null;
      const body = h('div', {},
        h('div', { class: 'muted', style: { marginBottom: '6px' } }, '번호 모양'), grid,
        h('div', { class: 'group', style: { marginTop: '12px' } },
          h('label', { class: 'row' }, cont, '앞 번호 목록에 이어'),
          h('label', { class: 'row', style: { marginTop: '6px' } }, fresh, '새 번호로 시작', startIn, h('span', { class: 'muted' }, '번부터'))));
      const api = Dialog.open({
        title: '문단 번호 모양 (Ctrl+K,N)', width: 420, body,
        buttons: [{ label: '설정', primary: true, onClick: () => { result = read(); } }, { label: '취소' }],
        onClose: () => resolve(result),
      });
    });
  },
  bulletDialog() {
    return new Promise((resolve) => {
      const li = this.currentLi();
      const ul = li && li.parentElement.tagName === 'UL' ? li.parentElement : null;
      let ch = ul ? this.bulletOf(ul) : '●';
      const grid = h('div', { class: 'fmt-grid bullets' });
      const paint = () => grid.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.textContent === ch));
      BULLETS.forEach((c) => {
        const b = h('button', { type: 'button' }, c);
        b.addEventListener('click', () => { ch = c; paint(); });
        b.addEventListener('dblclick', () => { ch = c; result = { ch }; api.close(); });
        grid.append(b);
      });
      paint();
      const custom = h('input', { type: 'text', maxlength: 2, placeholder: '직접', style: { width: '60px' } });
      custom.addEventListener('input', () => { if (custom.value.trim()) { ch = custom.value.trim(); paint(); } });
      let result = null;
      const body = h('div', {}, grid, h('div', { class: 'row', style: { marginTop: '10px' } }, h('span', {}, '다른 문자'), custom, h('span', { class: 'muted' }, '(문자표의 기호도 붙여 넣을 수 있습니다)')));
      const api = Dialog.open({
        title: '글머리표 모양', width: 400, body,
        buttons: [{ label: '설정', primary: true, onClick: () => { result = { ch }; } }, { label: '취소' }],
        onClose: () => resolve(result),
      });
    });
  },
};
