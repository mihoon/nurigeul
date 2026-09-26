// 머리말·꼬리말: 왼쪽·가운데·오른쪽 세 칸, 글자 크기·진하게·색, 구분선
// 글 안에 넣는 표시: {쪽} 쪽 번호, {전체쪽} 전체 쪽수, {날짜} 오늘 날짜, {파일이름} 문서 이름
'use strict';
const HF = {
  SLOTS: ['left', 'center', 'right'],
  TOKENS: [['{쪽}', '쪽 번호'], ['{전체쪽}', '전체 쪽수'], ['{날짜}', '오늘 날짜'], ['{파일이름}', '문서 이름']],
  // 예전 {text, align} 모양도 받아서 새 모양으로
  norm(x) {
    if (!x) return null;
    const o = { left: '', center: '', right: '', font: App.baseFont(), size: 9, bold: false, color: '#000000', line: false };
    if (x.text != null && x.left == null && x.center == null && x.right == null) o[x.align && o[x.align] != null ? x.align : 'center'] = x.text;
    for (const k of this.SLOTS) if (x[k] != null) o[k] = String(x[k]);
    if (x.font) o.font = String(x.font).replace(/["']/g, '');
    if (x.size > 0) o.size = +x.size;
    o.bold = !!x.bold;
    if (x.color) o.color = x.color;
    o.line = !!x.line;
    if (!o.left.trim() && !o.center.trim() && !o.right.trim() && !o.line) return null;
    return o;
  },
  get(kind) { return this.norm(App.docSettings[kind]); },
  docName() {
    const n = App.fileName || (App.displayName ? App.displayName() : '') || '';
    return String(n).replace(/\.(hwpx?|docx|txt|html?)$/i, '').replace(/\s*\*$/, '');
  },
  today() {
    const d = new Date();
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
  },
  // 글 → 조각 [{t:'글'} | {tok:'page'|'total'}]
  parts(s) {
    const out = [];
    const re = /\{(쪽|전체쪽|날짜|파일이름)\}/g;
    let i = 0, m;
    const push = (t) => { if (!t) return; const l = out[out.length - 1]; if (l && l.t != null) l.t += t; else out.push({ t }); };
    while ((m = re.exec(s))) {
      push(s.slice(i, m.index));
      if (m[1] === '쪽') out.push({ tok: 'page' });
      else if (m[1] === '전체쪽') out.push({ tok: 'total' });
      else if (m[1] === '날짜') push(this.today());
      else push(this.docName());
      i = re.lastIndex;
    }
    push(s.slice(i));
    return out;
  },
  // 화면용 글자
  screenText(s, k, pages) {
    return this.parts(s).map((p) => (p.t != null ? p.t : p.tok === 'page' ? PageNum.numberOn(k) : String(pages))).join('');
  },
  // 인쇄용 CSS content 식
  cssContent(s, cn) {
    const str = (t) => '"' + String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ') + '"';
    const ps = this.parts(s);
    if (!ps.length) return '""';
    return ps.map((p) => (p.t != null ? str(p.t) : p.tok === 'page' ? PageNum.numExpr(cn) : 'counter(pages)')).join(' ');
  },
  fontStack(f) {
    f = (f || '함초롬바탕').replace(/["']/g, '');
    return `"${f}","함초롬바탕","HCR Batang","바탕",serif`;
  },
  cssFont(o) {
    return `font-family:${this.fontStack(o.font)};font-size:${o.size}pt;font-weight:${o.bold ? 'bold' : 'normal'};color:${o.color};`;
  },

  // ---------- 화면: k번째 쪽의 머리말/꼬리말 ----------
  // top: 쪽 종이 위 기준 (머리말은 글 윗선, 꼬리말은 글 아랫선의 y)
  screenEl(kind, k, pages, y) {
    const o = this.get(kind);
    if (!o) return null;
    const p = App.page;
    const el = h('div', { class: 'pg-hfbox ' + kind, title: (kind === 'header' ? '머리말' : '꼬리말') + ' — 두 번 누르면 고칩니다' });
    el.style.left = U.mm2px(p.left) + 'px';
    el.style.right = U.mm2px(p.right) + 'px';
    el.style.cssText += this.cssFont(o);
    if (kind === 'header') el.style.top = y + 'px'; else el.style.top = (y - o.size * 96 / 72 * 1.5) + 'px';
    if (o.line) el.classList.add('line');
    for (const s of this.SLOTS) el.append(h('span', { class: s }, this.screenText(o[s] || '', k, pages)));
    return el;
  },

  // ---------- 인쇄: margin box ----------
  // boxes: {'top-left': {parts:[css식], style:''}, ...} 에 채움
  printBoxes(kind, cn, boxes) {
    const o = this.get(kind);
    if (!o) return;
    const side = kind === 'header' ? 'top' : 'bottom';
    const slots = this.SLOTS.filter((s) => (o[s] || '').trim());
    for (const s of this.SLOTS) {
      const b = boxes[side + '-' + s];
      if ((o[s] || '').trim()) b.parts.push(this.cssContent(o[s], cn));
      b.style += this.cssFont(o);
      if (o.line) b.line = true;
    }
    return slots;
  },

  // ---------- 대화상자 ----------
  async dialog(focusKind) {
    const hd = this.get('header') || { left: '', center: '', right: '', font: App.baseFont(), size: 9, bold: false, color: '#000000', line: false };
    const ft = this.get('footer') || { left: '', center: '', right: '', font: App.baseFont(), size: 9, bold: false, color: '#000000', line: false };
    const sec = (kind, o, title) => [
      { type: 'section', label: title },
      { name: kind + 'L', label: '왼쪽', type: 'text', value: o.left, placeholder: '예: {파일이름}' },
      { name: kind + 'C', label: '가운데', type: 'text', value: o.center, placeholder: kind === 'f' ? '예: - {쪽} -' : '' },
      { name: kind + 'R', label: '오른쪽', type: 'text', value: o.right, placeholder: '예: {날짜}' },
      { name: kind + 'Font', label: '글꼴', type: 'select', options: fontOptions(o.font), value: o.font },
      { name: kind + 'Size', label: '글자 크기', type: 'number', value: o.size, min: 5, max: 30, step: 0.5, suffix: 'pt' },
      { name: kind + 'Bold', label: '진하게', type: 'checkbox', value: o.bold },
      { name: kind + 'Color', label: '글자 색', type: 'color', value: o.color },
      { name: kind + 'Line', label: kind === 'h' ? '아래에 구분선' : '위에 구분선', type: 'checkbox', value: o.line },
    ];
    const fields = focusKind === 'footer' ? [...sec('f', ft, '꼬리말'), ...sec('h', hd, '머리말')] : [...sec('h', hd, '머리말'), ...sec('f', ft, '꼬리말')];
    const v = await Dialog.form('머리말/꼬리말', fields, {
      okLabel: '설정', width: 460,
      note: '넣을 수 있는 표시: {쪽} 쪽 번호, {전체쪽} 전체 쪽수, {날짜} 오늘 날짜, {파일이름} 문서 이름. 칸을 모두 비우면 없어집니다. 쪽 윤곽에서 쪽의 위·아래 여백을 두 번 눌러도 이 창이 열립니다. 특정 쪽에서만 빼려면 쪽 → 현재 쪽만 감추기.',
    });
    if (!v) return null;
    const pack = (k) => ({ left: v[k + 'L'] || '', center: v[k + 'C'] || '', right: v[k + 'R'] || '', font: v[k + 'Font'] || App.baseFont(), size: v[k + 'Size'] || 9, bold: !!v[k + 'Bold'], color: v[k + 'Color'] || '#000000', line: !!v[k + 'Line'] });
    return { header: this.norm(pack('h')), footer: this.norm(pack('f')) };
  },
  set(a) {
    App.setDocSetting('header', a.header || null);
    App.setDocSetting('footer', a.footer || null);
  },

  // 쪽 윤곽의 위·아래 여백을 두 번 누르면 설정
  init() {
    $('#page').addEventListener('dblclick', (e) => {
      if (Sel.editor.contains(e.target) || e.target.closest('.nobj')) return;
      const pr = $('#page').getBoundingClientRect();
      const y = (e.clientY - pr.top) / App.zoom;
      const p = App.page;
      const padTop = U.mm2px(p.top + p.header);
      const pitch = App.paged() ? App.pitch() : 0;
      let yy = y;
      if (pitch) yy = y - Math.floor(y / pitch) * pitch;
      const bodyEnd = padTop + App.contentHeight();
      let kind = null;
      if (yy < padTop) kind = 'header';
      else if (yy > bodyEnd && yy < U.mm2px(p.height)) kind = 'footer';
      if (!pitch && y > padTop && y < pr.height / App.zoom - U.mm2px(p.bottom + p.footer)) kind = null;
      if (!pitch && y >= pr.height / App.zoom - U.mm2px(p.bottom + p.footer)) kind = 'footer';
      if (!kind) return;
      e.preventDefault();
      this.focusNext = kind;
      Commands.run('header-footer');
    });
  },
};
