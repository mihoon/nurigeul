// 쪽 번호: 모양(1·i·I·가·a·A·①), 꾸밈(- 1 -, (1), 1 / 전체, 1쪽), 시작 번호, 첫 쪽 감추기, 새 번호로 시작
// 새 번호: <span class="pnnew" contenteditable="false" data-start="N"></span> (이 조판 부호가 있는 쪽부터 N)
'use strict';
const PageNum = {
  FORMATS: [['digit', '1, 2, 3', 'decimal'], ['lroman', 'i, ii, iii', 'lower-roman'], ['uroman', 'I, II, III', 'upper-roman'], ['hangul', '가, 나, 다', 'nr-hangul-plain'], ['lalpha', 'a, b, c', 'lower-alpha'], ['ualpha', 'A, B, C', 'upper-alpha'], ['circled', '①, ②, ③', 'nr-circled-plain']],
  DECOS: [['plain', '1'], ['side', '- 1 -'], ['paren', '(1)'], ['total', '1 / 전체 쪽수'], ['jjok', '1쪽']],
  HWP_FMT: { digit: 'DIGIT', lroman: 'ROMAN_SMALL', uroman: 'ROMAN_CAPITAL', hangul: 'HANGUL_SYLLABLE', lalpha: 'LATIN_SMALL', ualpha: 'LATIN_CAPITAL', circled: 'CIRCLED_DIGIT' },

  opts() {
    const s = App.docSettings.pageNum;
    if (!s || !s.pos || s.pos === 'none') return null;
    return { pos: s.pos, fmt: s.fmt || 'digit', deco: s.deco || (s.side ? 'side' : 'plain'), start: s.start > 0 ? s.start : 1, hideFirst: !!s.hideFirst, ...this.style() };
  },
  // 쪽 번호 글자 모양
  style() {
    const s = App.docSettings.pageNum || {};
    return { font: (s.font || App.baseFont()).replace(/["']/g, ''), size: s.size > 0 ? +s.size : 9, bold: !!s.bold, color: s.color || '#000000' };
  },
  controls() { return Array.from(Sel.editor.querySelectorAll('.pnnew')); },

  // 숫자 → 글자 (화면 표시용)
  format(n, fmt) {
    const roman = (v) => { let r = ''; for (const [a, s] of [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]) while (v >= a) { r += s; v -= a; } return r; };
    const alpha = (v) => { let r = ''; while (v > 0) { v--; r = String.fromCharCode(97 + (v % 26)) + r; v = Math.floor(v / 26); } return r; };
    if (n < 1 && fmt !== 'digit') return String(n);
    switch (fmt) {
      case 'lroman': return roman(n);
      case 'uroman': return roman(n).toUpperCase();
      case 'hangul': return '가나다라마바사아자차카타파하'[(n - 1) % 14];
      case 'lalpha': return alpha(n);
      case 'ualpha': return alpha(n).toUpperCase();
      case 'circled': return n <= 20 ? String.fromCharCode(0x2460 + n - 1) : String(n);
      default: return String(n);
    }
  },
  decorate(t, deco, total) {
    return { side: `- ${t} -`, paren: `(${t})`, total: `${t} / ${total}`, jjok: `${t}쪽` }[deco] || t;
  },
  // 화면: k번째 쪽(0부터)의 번호 글자, 감춘 쪽이면 ''
  label(k, pages) {
    const o = this.opts();
    if (!o) return '';
    if (this.hiddenOn(k).pn) return '';
    return this.decorate(this.numberOn(k), o.deco, pages);
  },
  yOf(el) {
    const er = Sel.editor.getBoundingClientRect();
    return (el.getBoundingClientRect().top - er.top) / App.zoom;
  },
  // k번째 쪽에서 감출 것 {pn: 쪽 번호, hd: 머리말, ft: 꼬리말}
  hiddenOn(k) {
    const o = this.opts();
    const out = { pn: !!(o && o.hideFirst && k === 0), hd: false, ft: false };
    for (const c of Sel.editor.querySelectorAll('.pnhide')) {
      if (App.pageOfY(Math.max(0, this.yOf(c))) !== k) continue;
      const f = c.dataset.hide || 'p';
      if (f.includes('p')) out.pn = true;
      if (f.includes('h')) out.hd = true;
      if (f.includes('f')) out.ft = true;
    }
    return out;
  },
  hideKey(hd) { return (hd.pn ? 'p' : '') + (hd.hd ? 'h' : '') + (hd.ft ? 'f' : ''); },

  // 인쇄용 CSS 조각: 기본 쪽(pc0)과 새 번호 구역마다(pcK) 따로 셈. 감춘 쪽은 이름 붙은 쪽(hK_키)으로.
  // boxesFor(쪽번호 식 또는 null, 머리말 감춤, 꼬리말 감춤) → margin box CSS
  printCss(boxesFor) {
    // 쪽 번호를 안 매겨도 머리말·꼬리말의 {쪽}을 위해 셈은 함
    const o = this.opts() || { none: true, pos: null, fmt: 'digit', deco: 'plain', start: 1, hideFirst: false };
    const ed = Sel.editor;
    const ctrls = this.controls();
    let sec = 0;
    const secStart = [];
    ctrls.forEach((c, i) => { c.dataset.k = i + 1; secStart[i + 1] = +c.dataset.start || 1; });
    const hideAt = new Map();
    for (const c of ed.querySelectorAll('.pnhide')) {
      const k = App.pageOfY(Math.max(0, this.yOf(c)));
      const cur = hideAt.get(k) || { pn: false, hd: false, ft: false };
      const f = c.dataset.hide || 'p';
      hideAt.set(k, { pn: cur.pn || f.includes('p'), hd: cur.hd || f.includes('h'), ft: cur.ft || f.includes('f') });
    }
    for (const b of Array.from(ed.children)) {
      const inner = b.classList.contains('pnnew') ? [b] : Array.from(b.querySelectorAll('.pnnew'));
      if (inner.length) sec = +inner[inner.length - 1].dataset.k;
      if (sec) b.dataset.pnsec = sec; else delete b.dataset.pnsec;
      const k = App.blockPage ? App.blockPage.get(b) : undefined;
      const hd = k != null && k > 0 ? hideAt.get(k) : null;
      if (hd) b.dataset.pnhide = this.hideKey(hd); else delete b.dataset.pnhide;
    }
    const first = { pn: false, hd: false, ft: false, ...(hideAt.get(0) || {}) };
    if (o.hideFirst) first.pn = true;
    const show = !o.none;
    // 문서 맨 앞 문단의 새 번호는 시작 번호로 처리
    const fb = ed.firstElementChild;
    if (fb && fb.dataset.pnsec) {
      const k0 = +fb.dataset.pnsec;
      o.start = secStart[k0];
      ed.querySelectorAll(`[data-pnsec="${k0}"]`).forEach((x) => delete x.dataset.pnsec);
      ctrls[k0 - 1] = null;
    }
    const resets = ['pc0 ' + (o.start - 0)].concat(ctrls.map((c, i) => (c ? `pc${i + 1} ${secStart[i + 1] - 1}` : '')).filter(Boolean)).join(' ');
    // 크롬: :first 의 counter-reset 은 다음 쪽으로 이어지지 않고 counter-increment 는 이어짐 → 첫 쪽에서 시작값만큼 더함
    const firstHide = first.pn || first.hd || first.ft;
    let extra = `@page :first{counter-increment:${resets};${firstHide ? boxesFor('pc0', show && !first.pn, first.hd, first.ft) : ''}}`;
    ctrls.forEach((c, i) => {
      if (!c) return;
      const k = i + 1;
      extra += `@page pn${k}{counter-increment:pc${k};${boxesFor('pc' + k, show)}}`;
      extra += `@media print{#editor [data-pnsec="${k}"]{page:pn${k}}}`;
    });
    // 감춘 쪽: 구역 번호를 그대로 세면서 번호·머리말·꼬리말만 뺌
    const combos = new Set(Array.from(ed.querySelectorAll('[data-pnhide]')).map((b) => (b.dataset.pnsec || '0') + '_' + b.dataset.pnhide));
    combos.forEach((c) => {
      const [sk, key] = c.split('_');
      extra += `@page h${sk}_${key}{counter-increment:pc${sk};${boxesFor('pc' + sk, show && !key.includes('p'), key.includes('h'), key.includes('f'))}}`;
      extra += `@media print{#editor ${sk === '0' ? ':not([data-pnsec])' : `[data-pnsec="${sk}"]`}[data-pnhide="${key}"]{page:h${sk}_${key}}}`;
    });
    return { page: `counter-increment:pc0;${boxesFor('pc0', show)}`, extra };
  },
  // CSS: 번호 글자 (꾸밈 없이) / 쪽 번호 (꾸밈 포함)
  numExpr(cn) {
    const o = this.opts() || { fmt: 'digit' };
    return `counter(${cn}, ${this.FORMATS.find((f) => f[0] === o.fmt)[2]})`;
  },
  pnExpr(cn) {
    const o = this.opts();
    const c = this.numExpr(cn);
    return { plain: c, side: `"- " ${c} " -"`, paren: `"(" ${c} ")"`, total: `${c} " / " counter(pages)`, jjok: `${c} "쪽"` }[o.deco] || c;
  },
  // 화면: k번째 쪽의 번호 글자 (꾸밈·감춤 없이)
  numberOn(k) {
    const o = this.opts() || { fmt: 'digit', start: 1 };
    let n = (o.start || 1) + k;
    for (const c of this.controls()) {
      const kc = App.pageOfY(Math.max(0, this.yOf(c)));
      if (kc <= k) n = (+c.dataset.start || 1) + (k - kc);
    }
    return this.format(n, o.fmt || 'digit');
  },

  // ---------- 현재 쪽만 감추기 ----------
  async hideDialog() {
    const v = await Dialog.form('현재 쪽만 감추기', [
      { name: 'pn', label: '쪽 번호', type: 'checkbox', value: true },
      { name: 'hd', label: '머리말', type: 'checkbox', value: false },
      { name: 'ft', label: '꼬리말', type: 'checkbox', value: false },
    ], { okLabel: '감추기', width: 340, note: '커서가 있는 쪽에서만 고른 것을 감춥니다. 쪽 번호는 감춰도 그대로 셉니다. 조판 부호를 지우면 다시 나타납니다.' });
    if (!v || (!v.pn && !v.hd && !v.ft)) return null;
    return { hide: (v.pn ? 'p' : '') + (v.hd ? 'h' : '') + (v.ft ? 'f' : '') };
  },
  insertHide(hide) {
    const r = Sel.range();
    if (!r) return;
    let block = blockOf(r.startContainer);
    if (block && block.closest('td, th, .tb-body, .nobj')) block = block.closest('table') || block.closest('.nobj');
    while (block && block.parentElement && block.parentElement !== Sel.editor && !block.parentElement.classList.contains('cols')) block = block.parentElement;
    if (!block || block === Sel.editor) { Para.ensure(); block = Sel.editor.firstElementChild; }
    if (block.tagName === 'TABLE') { const p = h('p', {}, h('br')); block.before(p); block = p; }
    const old = block.querySelector(':scope > .pnhide');
    if (old) old.remove();
    const el = h('span', { class: 'pnhide', contenteditable: 'false' });
    el.dataset.hide = hide || 'p';
    el.dataset.label = '감추기: ' + [hide.includes('p') && '쪽 번호', hide.includes('h') && '머리말', hide.includes('f') && '꼬리말'].filter(Boolean).join('·');
    block.prepend(el);
    App.layout();
    status('이 쪽에서 ' + el.dataset.label.replace('감추기: ', '') + '을(를) 감춥니다.');
  },

  // ---------- 새 번호로 시작 ----------
  async newNumDialog() {
    const v = await Dialog.form('새 번호로 시작', [
      { name: 'start', label: '시작 쪽 번호', type: 'number', value: 1, min: 1, step: 1 },
    ], { okLabel: '넣기', width: 360, note: '커서가 있는 쪽부터 이 번호로 다시 셉니다. 인쇄·PDF에서는 이 문단이 새 쪽에서 시작하므로 보통 쪽 나누기 바로 뒤, 쪽 맨 위 문단에 넣습니다. 조판 부호를 지우면 원래대로 돌아갑니다.' });
    return v && v.start ? { start: Math.max(1, Math.round(v.start)) } : null;
  },
  insertNew(start) {
    const r = Sel.range();
    if (!r) return;
    let block = blockOf(r.startContainer);
    if (block && block.closest('td, th, .tb-body, .nobj')) { status('새 번호는 본문 문단에 넣어야 합니다.'); return; }
    // 문단 맨 앞에 넣음 (그 쪽부터 적용)
    while (block && block.parentElement && block.parentElement !== Sel.editor && !block.parentElement.classList.contains('cols')) block = block.parentElement;
    if (!block || block === Sel.editor) { Para.ensure(); block = Sel.editor.firstElementChild; }
    const old = block.querySelector('.pnnew');
    if (old) old.remove();
    const el = h('span', { class: 'pnnew', contenteditable: 'false', title: `새 쪽 번호: ${start}` });
    el.dataset.start = start;
    block.prepend(el);
    if (!App.docSettings.pageNum) App.setDocSetting('pageNum', { pos: 'bottom-center', fmt: 'digit', deco: 'side', start: 1 });
    App.layout();
    status(`이 쪽부터 쪽 번호를 ${start}(으)로 새로 시작합니다.`);
  },
};
