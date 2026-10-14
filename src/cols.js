// 다단: <div class="cols" data-cols="2" data-gap="8" data-line="1"> … 문단들 … </div>
// 단 나누기: <div class="colbreak" contenteditable="false"></div>
'use strict';
const Cols = {
  region() { return Sel.closest('div.cols'); },
  apply(el) {
    const n = +el.dataset.cols || 2;
    el.style.columnCount = n;
    el.style.columnGap = U.mm2px(+el.dataset.gap || 8).toFixed(1) + 'px';
    el.style.columnRule = el.dataset.line === '1' ? '1px solid #000' : '';
  },
  applyAll(root) { (root || Sel.editor).querySelectorAll('div.cols').forEach((el) => { this.apply(el); if (!el.firstElementChild) el.append(h('p', {}, h('br'))); }); },

  // 문단이 들어 있는 단의 왼쪽·오른쪽 (화면 좌표) — 눈금자·탭 기준
  columnBox(block) {
    const reg = block && block.closest && block.closest('div.cols');
    if (!reg || !Sel.editor.contains(reg)) return null;
    const z = App.zoom;
    const rr = reg.getBoundingClientRect();
    const n = +reg.dataset.cols || 2;
    const gap = U.mm2px(+reg.dataset.gap || 8) * z;
    const colW = (rr.width - gap * (n - 1)) / n;
    const bl = block.getBoundingClientRect().left;
    const i = Math.max(0, Math.min(n - 1, Math.floor((bl - rr.left + 2) / (colW + gap))));
    const left = rr.left + i * (colW + gap);
    return { left, right: left + colW };
  },

  async dialog() {
    const reg = this.region();
    const v = await Dialog.form('다단 설정', [
      { name: 'n', label: '단 개수', type: 'select', options: [['1', '하나 (다단 해제)'], ['2', '둘'], ['3', '셋'], ['4', '넷']], value: reg ? reg.dataset.cols : '2' },
      { name: 'gap', label: '단 사이 간격', type: 'number', value: reg ? +reg.dataset.gap || 8 : 8, step: 0.5, min: 0, suffix: 'mm' },
      { name: 'line', label: '단 사이에 구분선', type: 'checkbox', value: reg ? reg.dataset.line === '1' : false },
      { name: 'scope', label: '적용 범위', type: 'select', options: reg ? [['region', '지금 다단 영역']] : [['sel', '선택한 문단 (커서가 있는 문단)'], ['after', '커서가 있는 문단부터 끝까지'], ['doc', '문서 전체']], value: reg ? 'region' : 'sel' },
    ], { okLabel: '설정', width: 400, note: '다단 안에서 Ctrl+Shift+Enter를 누르면 다음 단으로 넘어갑니다(단 나누기).' });
    if (!v) return null;
    v.n = +v.n;
    return v;
  },
  set(a) {
    let reg = this.region();
    if (reg) {
      if (a.n <= 1) { this.unwrap(reg); App.changed(); return; }
      reg.dataset.cols = a.n; reg.dataset.gap = a.gap; reg.dataset.line = a.line ? '1' : '0';
      this.apply(reg);
      App.layout();
      return;
    }
    if (a.n <= 1) return;
    const ed = Sel.editor;
    const top = (b) => { while (b && b.parentElement !== ed) b = b.parentElement; return b; };
    let first, last;
    if (a.scope === 'doc') { first = ed.firstElementChild; last = ed.lastElementChild; }
    else {
      const blocks = Sel.blocks();
      if (!blocks.length) { Para.ensure(); }
      const bs = Sel.blocks();
      first = top(bs[0]); last = a.scope === 'after' ? ed.lastElementChild : top(bs[bs.length - 1]);
    }
    if (!first) return;
    const saved = Sel.save();
    reg = h('div', { class: 'cols' });
    reg.dataset.cols = a.n; reg.dataset.gap = a.gap; reg.dataset.line = a.line ? '1' : '0';
    first.before(reg);
    let n = first;
    while (n) {
      const next = n.nextSibling;
      reg.append(n);
      if (n === last) break;
      n = next;
    }
    this.apply(reg);
    // 다단 뒤에 이어 쓸 문단
    if (!reg.nextElementSibling) reg.after(h('p', {}, h('br')));
    Sel.restore(saved);
    App.layout();
  },
  unwrap(reg) {
    const saved = Sel.save();
    reg.querySelectorAll(':scope > .colbreak').forEach((x) => x.remove());
    reg.replaceWith(...Array.from(reg.childNodes));
    Sel.restore(saved);
    App.layout();
  },
  colBreak() {
    const reg = this.region();
    if (!reg) { status('단 나누기는 다단 영역 안에서만 쓸 수 있습니다. (쪽 → 다단 설정)'); return; }
    const r = Sel.range();
    let block = blockOf(r.startContainer);
    while (block && block.parentElement !== reg) block = block.parentElement;
    if (!block) return;
    // 커서 자리에서 문단을 나누고 사이에 단 나누기
    const inner = blockOf(r.startContainer);
    const after = r.cloneRange();
    after.collapse(true);
    after.setEndAfter(inner.lastChild || inner);
    const frag = after.extractContents();
    const tail = inner.cloneNode(false);
    tail.append(frag);
    if (!tail.textContent.replace(/​/g, '') && !tail.querySelector('img,br,.nobj')) tail.append(h('br'));
    if (!inner.textContent && !inner.querySelector('img,.nobj,br')) inner.innerHTML = '<br>';
    const cb = h('div', { class: 'colbreak', contenteditable: 'false' });
    if (inner === block) { block.after(cb); cb.after(tail); }
    else { block.after(cb); cb.after(tail); }
    Sel.caretInto(tail);
  },
};
