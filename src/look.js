// 개체 모양: 바깥/안 여백, 테두리, 그림자 (그림·도형·글상자·표 공통)
// data-om="위,오른쪽,아래,왼쪽"(mm)  data-im="…"(mm)  data-bd="굵기px,종류,색"  data-sh="x mm,y mm,색"
'use strict';
const Look = {
  SHADOWS: [['none', '없음'], ['rb', '오른쪽 아래'], ['lb', '왼쪽 아래'], ['rt', '오른쪽 위'], ['lt', '왼쪽 위']],
  BORDER_STYLES: [['none', '없음'], ['solid', '실선'], ['dashed', '파선'], ['dotted', '점선'], ['double', '이중선']],
  BORDER_WIDTHS: [['1', '0.26 mm'], ['1.5', '0.4 mm'], ['2', '0.5 mm'], ['3', '0.8 mm'], ['4', '1.0 mm'], ['6', '1.6 mm']],

  quad(s) {
    if (!s) return null;
    const v = String(s).split(',').map((x) => +x || 0);
    return [v[0] || 0, v[1] != null ? v[1] : v[0] || 0, v[2] != null ? v[2] : v[0] || 0, v[3] != null ? v[3] : v[1] || 0];
  },
  quadStr(q) { return q.map((x) => Math.round(x * 100) / 100).join(','); },
  pxQuad(q) { return q.map((x) => Math.round(U.mm2px(x) * 10) / 10 + 'px').join(' '); },
  border(el) {
    const s = el.dataset.bd;
    if (!s) return null;
    const [w, style, color] = s.split(',');
    return +w > 0 && style && style !== 'none' ? { w: +w, style, color: color || '#000000' } : null;
  },
  shadow(el) {
    const s = el.dataset.sh;
    if (!s) return null;
    const [x, y, color] = s.split(',');
    return { x: +x || 0, y: +y || 0, color: color || '#808080' };
  },
  shadowDir(sh) {
    if (!sh) return 'none';
    return (sh.x >= 0 ? (sh.y >= 0 ? 'rb' : 'rt') : (sh.y >= 0 ? 'lb' : 'lt'));
  },

  // data-* → 화면 스타일
  apply(el) {
    const d = el.dataset;
    const om = this.quad(d.om);
    if (el.tagName === 'TABLE' && (!d.wrap || d.wrap === 'inline')) {
      // 글자처럼 놓인 표는 위·아래 여백만 (가운데/오른쪽 정렬을 지키려고)
      el.style.margin = '';
      el.style.marginTop = om || +d.vshift ? (om ? U.mm2px(om[0]) : 0) + (+d.vshift || 0) + 'px' : '';
      el.style.marginBottom = om ? U.mm2px(om[2]) + 'px' : '';
      // 불러온 문서에서 가로 위치를 옮긴 표
      if (+d.shift > 0 && !el.classList.contains('tbl-center') && !el.classList.contains('tbl-right')) el.style.marginLeft = d.shift + 'px';
    } else if (om || !d.vdrop) el.style.margin = om ? this.pxQuad(om) : '';
    // 문단 위에서 떨어진 어울림 그림: 위 여백에 떨어진 거리를 더함
    if (+d.vdrop > 0 && el.tagName === 'IMG') el.style.marginTop = (om ? U.mm2px(om[0]) : 0) + +d.vdrop + 'px';
    const im = this.quad(d.im);
    if (d.kind === 'textbox') el.style.padding = im ? this.pxQuad(im) : '';
    const st = el.querySelector && el.querySelector(':scope > .sh-text');
    if (st && im) st.style.inset = this.pxQuad(im);
    if (el.tagName === 'IMG') {
      const b = this.border(el);
      el.style.outline = b ? `${b.w}px ${b.style} ${b.color}` : '';
      el.style.outlineOffset = b ? `-${b.w}px` : '';
    }
    if (el.tagName === 'TABLE') {
      // 표 안 여백: 모든 셀에 (셀마다 따로 준 여백은 그대로)
      if (im) el.querySelectorAll(':scope > tbody > tr > td, :scope > tr > td').forEach((td) => { if (!td.dataset.im) td.style.padding = this.pxQuad(im); });
    }
    const sh = this.shadow(el);
    el.style.filter = sh ? `drop-shadow(${U.mm2px(sh.x).toFixed(1)}px ${U.mm2px(sh.y).toFixed(1)}px 0 ${sh.color})` : '';
  },
  applyAll(root) {
    (root || Sel.editor).querySelectorAll('[data-om], [data-im], [data-bd], [data-sh]').forEach((el) => { if (el.tagName !== 'TD') this.apply(el); });
  },

  // 대화상자 칸 (그림·도형·글상자)
  fields(el) {
    const d = el.dataset;
    const out = [];
    const isImg = el.tagName === 'IMG';
    if (isImg) {
      const b = this.border(el);
      out.push({ type: 'section', label: '테두리' });
      out.push({ name: 'bdStyle', label: '선 종류', type: 'select', options: this.BORDER_STYLES, value: b ? b.style : 'none' });
      out.push({ name: 'bdW', label: '굵기', type: 'select', options: this.BORDER_WIDTHS, value: b ? String(b.w) : '1' });
      out.push({ name: 'bdColor', label: '선 색', type: 'color', value: b ? b.color : '#000000' });
    }
    const sh = this.shadow(el);
    out.push({ type: 'section', label: '그림자' });
    out.push({ name: 'shDir', label: '그림자 방향', type: 'select', options: this.SHADOWS, value: this.shadowDir(sh) });
    out.push({ name: 'shDist', label: '거리', type: 'number', value: sh ? Math.max(Math.abs(sh.x), Math.abs(sh.y)) : 1, step: 0.1, min: 0, suffix: 'mm' });
    out.push({ name: 'shColor', label: '그림자 색', type: 'color', value: sh ? sh.color : '#808080' });
    out.push({ type: 'section', label: '여백' });
    out.push({ name: 'om', label: '바깥 여백 (mm)', type: 'quad', value: this.quad(d.om) || this.defaultOm(el) });
    const hasInner = d.kind === 'textbox' || (el.querySelector && el.querySelector(':scope > .sh-text'));
    if (hasInner) out.push({ name: 'im', label: '안 여백 (mm)', type: 'quad', value: this.quad(d.im) || [1, 1, 1, 1] });
    return out;
  },
  defaultOm(el) {
    const cs = getComputedStyle(el);
    return ['Top', 'Right', 'Bottom', 'Left'].map((s) => Math.round(U.px2mm(parseFloat(cs['margin' + s]) || 0) * 10) / 10);
  },
  // 대화상자 결과 적용
  set(el, v) {
    const d = el.dataset;
    if (v.bdStyle != null) {
      if (v.bdStyle === 'none') delete d.bd; else d.bd = `${v.bdW},${v.bdStyle},${v.bdColor}`;
    }
    if (v.shDir != null) {
      if (v.shDir === 'none' || !v.shDist) delete d.sh;
      else {
        const dist = +v.shDist;
        const sx = v.shDir[0] === 'r' ? dist : -dist, sy = v.shDir[1] === 'b' ? dist : -dist;
        d.sh = `${sx},${sy},${v.shColor}`;
      }
    }
    if (v.om) {
      const same = this.quad(d.om) ? false : v.om.every((x, i) => Math.abs(x - this.defaultOm(el)[i]) < 0.05);
      if (!same) d.om = this.quadStr(v.om);
    }
    if (v.im) d.im = this.quadStr(v.im);
    this.apply(el);
  },

  // 모양 복사용: 개체의 겉모양만
  KEYS: ['om', 'im', 'bd', 'sh', 'stroke', 'sw', 'fill'],
  copy(el) {
    const o = {};
    for (const k of this.KEYS) if (el.dataset[k] != null) o[k] = el.dataset[k];
    o.$kind = el.tagName === 'IMG' ? 'img' : el.tagName === 'TABLE' ? 'table' : 'obj';
    return o;
  },
  paste(el, o) {
    for (const k of this.KEYS) {
      if (k === 'bd' && el.tagName !== 'IMG') continue;
      if ((k === 'stroke' || k === 'sw' || k === 'fill') && !Shapes.isObj(el)) continue;
      if (k === 'fill' && el.dataset.shape === 'line') continue;
      if (o[k] != null) el.dataset[k] = o[k]; else delete el.dataset[k];
    }
    if (Shapes.isObj(el)) Shapes.render(el);
    this.apply(el);
  },

  // 모델(저장용)
  model(el) {
    const m = {};
    const om = this.quad(el.dataset.om), im = this.quad(el.dataset.im);
    if (om) m.om = om;
    if (im) m.im = im;
    const b = this.border(el);
    if (b) m.bd = b;
    const sh = this.shadow(el);
    if (sh) m.sh = sh;
    return m;
  },

  // ---------- 표 속성 (크기·여백·배치) ----------
  async tableDialog() {
    const t = Shapes.tableOf();
    if (!t) return null;
    const z = App.zoom;
    const r = t.getBoundingClientRect();
    const td = Table.block.active() ? Table.block.cells()[0] : Table.currentCell();
    const cr = td ? td.getBoundingClientRect() : null;
    const pad = td ? getComputedStyle(td) : null;
    const padQ = pad ? ['Top', 'Right', 'Bottom', 'Left'].map((s) => Math.round(U.px2mm(parseFloat(pad['padding' + s]) || 0) * 10) / 10) : [0.5, 1.8, 0.5, 1.8];
    const v = await Dialog.form('표 속성', [
      { type: 'section', label: '크기' },
      { name: 'tw', label: '표 너비', type: 'number', value: U.px2mm(r.width / z).toFixed(1), step: 0.1, suffix: 'mm' },
      { name: 'th', label: '표 높이', type: 'number', value: U.px2mm(r.height / z).toFixed(1), step: 0.1, suffix: 'mm' },
      ...(cr ? [
        { name: 'cw', label: '현재 칸 너비', type: 'number', value: U.px2mm(cr.width / z).toFixed(1), step: 0.1, suffix: 'mm' },
        { name: 'ch', label: '현재 줄 높이', type: 'number', value: U.px2mm(cr.height / z).toFixed(1), step: 0.1, suffix: 'mm' },
      ] : []),
      { type: 'section', label: '여백' },
      { name: 'im', label: '셀 안 여백 (mm)', type: 'quad', value: padQ },
      { name: 'imWhere', label: '안 여백 적용', type: 'select', options: [['all', '표 전체 셀'], ['sel', '선택한 셀만']], value: Table.block.active() ? 'sel' : 'all' },
      { name: 'om', label: '바깥 여백 (mm)', type: 'quad', value: this.quad(t.dataset.om) || this.defaultOm(t) },
      { type: 'section', label: '본문과의 배치' },
      { name: 'wrap', label: '배치', type: 'select', options: Shapes.TABLE_WRAPS, value: t.dataset.wrap || 'inline' },
    ], { okLabel: '설정', width: 460 });
    if (!v) return null;
    v.orig = { tw: U.px2mm(r.width / z), th: U.px2mm(r.height / z), cw: cr ? U.px2mm(cr.width / z) : 0, ch: cr ? U.px2mm(cr.height / z) : 0, pad: padQ };
    return v;
  },
  applyTable(v) {
    const t = Shapes.tableOf();
    if (!t) return;
    const o = v.orig || {};
    const g = Table.grid(t);
    const td = Table.block.active() ? Table.block.cells()[0] : Table.currentCell();
    const cell = td ? g.cells.find((c) => c.el === td) : null;
    // 현재 칸/줄 크기
    if (cell && v.cw != null && Math.abs(v.cw - o.cw) > 0.05) {
      const d = U.mm2px(v.cw) - U.mm2px(o.cw);
      g.widths[cell.c + cell.cs - 1] = Math.max(10, g.widths[cell.c + cell.cs - 1] + d);
    }
    if (cell && v.ch != null && Math.abs(v.ch - o.ch) > 0.05) {
      const trs = rowsOf(t);
      const tr = trs[cell.r + cell.rs - 1];
      const cur = tr.getBoundingClientRect().height / App.zoom;
      tr.style.height = Math.max(8, cur + U.mm2px(v.ch) - U.mm2px(o.ch)) + 'px';
    }
    // 표 전체 크기 (칸 너비·줄 높이를 비율대로)
    if (v.tw != null && Math.abs(v.tw - o.tw) > 0.05) {
      const k = U.mm2px(v.tw) / g.widths.reduce((a, b) => a + b, 0);
      g.widths = g.widths.map((w) => Math.max(8, w * k));
    }
    if (g.widths) {
      const cols = t.querySelectorAll(':scope > colgroup > col');
      g.widths.forEach((w, i) => { if (cols[i]) cols[i].style.width = Math.round(w * 10) / 10 + 'px'; });
      t.style.width = Math.round(g.widths.reduce((a, b) => a + b, 0)) + 'px';
    }
    if (v.th != null && Math.abs(v.th - o.th) > 0.05) {
      const trs = rowsOf(t);
      const hs = trs.map((tr) => tr.getBoundingClientRect().height / App.zoom);
      const k = U.mm2px(v.th) / hs.reduce((a, b) => a + b, 0);
      trs.forEach((tr, i) => { tr.style.height = Math.max(8, hs[i] * k) + 'px'; });
    }
    // 여백
    if (v.im && (v.im.some((x, i) => Math.abs(x - o.pad[i]) > 0.05) || v.imWhere === 'sel')) {
      if (v.imWhere === 'sel' && Table.block.active()) Table.block.cells().forEach((c) => { c.dataset.im = this.quadStr(v.im); c.style.padding = this.pxQuad(v.im); });
      else { t.dataset.im = this.quadStr(v.im); t.querySelectorAll('td, th').forEach((c) => { if (c.closest('table') === t) { delete c.dataset.im; c.style.padding = this.pxQuad(v.im); } }); }
    }
    if (v.om) {
      const def = this.defaultOm(t);
      if (this.quad(t.dataset.om) || v.om.some((x, i) => Math.abs(x - def[i]) > 0.05)) t.dataset.om = this.quadStr(v.om);
    }
    this.apply(t);
    if (v.wrap && (t.dataset.wrap || 'inline') !== v.wrap) Shapes.setTableWrap(t, v.wrap);
    App.layout();
  },
};
