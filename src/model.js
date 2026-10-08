// 편집기 DOM → 문서 모델 (HWPX/DOCX 저장용)
'use strict';
const Model = {
  fromEditor() {
    return {
      page: { ...App.page },
      pitch: App.pitch(),
      header: App.docSettings.header ? { ...App.docSettings.header } : null,
      footer: App.docSettings.footer ? { ...App.docSettings.footer } : null,
      pageNum: App.docSettings.pageNum ? { ...App.docSettings.pageNum } : null,
      // 쪽 나눔 때문에 화면에만 넣은 빈 자리·정렬(#page-gaps)은 빼고 읽음
      blocks: Table.natural(() => this.blocks(Sel.editor)),
    };
  },

  blocks(container) {
    const out = [];
    let pendingBreak = false, pendingCols = null, colsEnd = false, pendingColBreak = false;
    const push = (b) => {
      if (pendingBreak) { b.pageBreakBefore = true; pendingBreak = false; }
      if (pendingCols) { b.cols = pendingCols; pendingCols = null; colsEnd = false; } else if (colsEnd) { b.cols = { n: 1 }; colsEnd = false; }
      if (pendingColBreak) { b.colBreakBefore = true; pendingColBreak = false; }
      out.push(b);
    };
    const visit = (parent, listCtx) => {
      let loose = null; // 블록 사이 떠도는 인라인 노드
      const flushLoose = () => {
        if (loose && loose.length) {
          const runs = [];
          loose.forEach((n) => this.runs(n, runs));
          if (runs.some((r) => r.text?.trim() || r.img || r.shape || r.newNum || r.pageHide)) push(this.paraFrom(parent.nodeType ? parent : loose[0].parentElement, runs));
        }
        loose = null;
      };
      let olIndex = 0;
      for (const n of Array.from(parent.childNodes)) {
        if (n.nodeType === 1 && n.classList.contains('pagebreak')) { flushLoose(); pendingBreak = true; continue; }
        if (n.nodeType === 1 && n.classList.contains('colbreak')) { flushLoose(); pendingColBreak = true; continue; }
        if (n.nodeType === 1 && n.classList.contains('cols')) {
          flushLoose();
          pendingCols = { n: +n.dataset.cols || 2, gap: +n.dataset.gap || 8, line: n.dataset.line === '1' };
          visit(n, listCtx);
          pendingCols = null;
          colsEnd = true;
          continue;
        }
        if (n.nodeType === 1 && n.tagName === 'TABLE') { flushLoose(); push(this.table(n)); continue; }
        if (n.nodeType === 1 && (n.tagName === 'UL' || n.tagName === 'OL')) { flushLoose(); visit(n, { type: n.tagName }); continue; }
        if (n.nodeType === 1 && isBlock(n) && n.tagName !== 'HR') {
          flushLoose();
          const hasBlockKids = Array.from(n.children).some((c) => isBlock(c) || c.classList.contains('pagebreak'));
          if (n.tagName === 'LI') {
            // 번호/글머리표 글자 + 항목 글(안쪽 목록 앞부분까지)
            const runs = [{ ...this.charStyle(n), text: Lists.markerText(n) }];
            const rest = [];
            let inBlocks = false;
            for (const c of Array.from(n.childNodes)) {
              if (!inBlocks && c.nodeType === 1 && (isBlock(c) || c.classList.contains('pagebreak'))) inBlocks = true;
              if (inBlocks) rest.push(c); else this.runs(c, runs);
            }
            push(this.paraFrom(n, runs));
            // 항목 안에 이어지는 목록·문단
            if (rest.length) visit({ childNodes: rest }, listCtx);
            continue;
          }
          if (hasBlockKids) { visit(n, listCtx); continue; }
          const runs = [];
          this.runs(n, runs);
          push(this.paraFrom(n, runs));
          continue;
        }
        if (n.nodeType === 1 && n.tagName === 'HR') { flushLoose(); continue; }
        if (n.nodeType === 3 && !n.textContent.replace(/[\s​]/g, '') && !loose) continue;
        (loose = loose || []).push(n);
      }
      flushLoose();
    };
    visit(container, null);
    if (pendingBreak) out.push({ t: 'p', runs: [], pageBreakBefore: true, ...this.paraProps(container) });
    if (!out.length) out.push({ t: 'p', runs: [], ...this.paraProps(container) });
    return out;
  },

  paraFrom(el, runs) {
    // 연속된 같은 서식 텍스트 합치기, ZWSP 제거
    const merged = [];
    for (const r of runs) {
      if (r.text != null) {
        r.text = r.text.replace(/​/g, '');
        if (!r.text) continue;
      }
      const prev = merged[merged.length - 1];
      if (prev && prev.text != null && r.text != null && sameStyle(prev, r)) prev.text += r.text;
      else merged.push(r);
    }
    const out = { t: 'p', runs: merged, ...this.paraProps(el) };
    // 표가 붙은 문단의 끝 표시(한글에서 첫 표 바로 아래에 보이는 문단 부호)
    if (el.dataset && 'tend' in el.dataset) out.tend = true;
    return out;
  },

  paraProps(el) {
    const cs = getComputedStyle(el);
    let align = cs.textAlign;
    if (el.classList && el.classList.contains('align-distribute')) align = 'distribute';
    if (align === 'start' || align === '-webkit-left') align = 'left';
    if (align === 'end' || align === '-webkit-right') align = 'right';
    if (align === '-webkit-center') align = 'center';
    const px2pt = (v) => Math.round(U.px2pt(parseFloat(v) || 0) * 10) / 10;
    let ml = px2pt(cs.marginLeft) + px2pt(cs.paddingLeft);
    // 목록 들여쓰기 반영
    const list = el.closest && el.closest('ul,ol');
    if (list && Sel.editor.contains(list)) ml += px2pt(getComputedStyle(list).paddingLeft);
    // 셀 안 첫/마지막 문단의 줄 간격 여분 보정(--lsx)은 모양이 아니므로 되돌려 계산
    const lsx0 = el.style && el.style.getPropertyValue('--lsx') ? (parseFloat(el.style.getPropertyValue('--lsx')) || 0) / 2 : 0;
    const inCell = lsx0 && el.parentElement && /^(TD|TH)$/.test(el.parentElement.tagName);
    const lsxT = inCell && el === el.parentElement.firstElementChild ? lsx0 : 0;
    const lsxB = inCell && el === el.parentElement.lastElementChild ? lsx0 : 0;
    return {
      align,
      ml,
      mr: px2pt(cs.marginRight),
      indent: px2pt(cs.textIndent),
      lh: el === Sel.editor || el.tagName === 'TD' ? 160 : lineHeightPct(el),
      before: px2pt((parseFloat(cs.marginTop) || 0) + lsxT + (el === Sel.editor || el.tagName === 'TD' || el.tagName === 'TH' ? 0 : parseFloat(cs.paddingTop) || 0) + 'px'),
      after: px2pt((parseFloat(cs.marginBottom) || 0) + lsxB + (el === Sel.editor || el.tagName === 'TD' || el.tagName === 'TH' ? 0 : parseFloat(cs.paddingBottom) || 0) + 'px'),
      style: (el.dataset && el.dataset.style) || null,
      kw: !!(el.dataset && 'kw' in el.dataset),
      tabs: el === Sel.editor ? [] : TabStops.parse(el),
      cs: el === Sel.editor ? null : this.charStyle(el.tagName === 'TD' || el.tagName === 'TH' ? el : (el.querySelector('span') && !el.textContent.trim() ? el.querySelector('span') : el)),
    };
  },

  charStyle(el) {
    const cs = getComputedStyle(el);
    const deco = decoOf(el);
    let size = Math.round(U.px2pt(parseFloat(cs.fontSize)) * 10) / 10;
    if (deco.sup || deco.sub) {
      const b = el.closest && el.closest('[data-base-size]');
      size = b ? parseFloat(b.dataset.baseSize) : Math.round(size / 0.7 * 2) / 2;
    }
    return {
      font: firstFamily(cs.fontFamily),
      size,
      bold: parseInt(cs.fontWeight, 10) >= 600,
      italic: cs.fontStyle === 'italic' || cs.fontStyle.startsWith('oblique'),
      underline: deco.underline,
      strike: deco.strike,
      sup: deco.sup,
      sub: deco.sub,
      color: cssColorToHex(cs.color) || '#000000',
      shade: bgOf(el),
      spacing: letterSpacingPct(el),
      ratio: Math.round(Ratio.of(el)),
      ...charEffects(el),
    };
  },

  runs(node, out) {
    if (node.nodeType === 3) {
      const text = node.textContent;
      if (!text) return;
      const st = this.charStyle(node.parentElement);
      // 탭/줄바꿈 분리
      const parts = text.split(/(\t|\n)/);
      for (const p of parts) {
        if (p === '\t') out.push({ tab: true, w: node.parentElement.classList.contains('tab') ? parseFloat(node.parentElement.style.width) || 0 : 0 });
        else if (p === '\n') out.push({ br: true });
        else if (p) out.push({ ...st, text: p });
      }
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (tag === 'BR') {
      // 문단 끝의 자리표시 BR은 무시
      // 문단 끝의 자리표시 BR(뒤에 아무것도 없음)은 무시 — 글자 상자(span) 안에 있어도 마찬가지
      // (그림을 빈 줄에 넣으면 <span><img><br></span>이 되는데, 이 BR을 줄 바꿈으로 저장하면 한글에서 그림 밑에 빈 줄이 생김)
      const blk = (node.parentElement && node.parentElement.closest('p, li, h1, h2, h3, h4, h5, h6, td, th, .tb-body, .figcap, div')) || node.parentElement;
      if (blk) {
        const rest = document.createRange();
        rest.setStartAfter(node);
        rest.setEnd(blk, blk.childNodes.length);
        const f = rest.cloneContents();
        const more = rest.toString().replace(/\u200b/g, '') !== '' || (f.querySelector && f.querySelector('br, img, .nobj, .tab, .mm-field, .fignum'));
        if (!more) return;
      }
      out.push({ br: true });
      return;
    }
    if (node.classList.contains('figure')) {
      // 캡션 달린 그림
      const img = node.querySelector('img');
      if (!img) return;
      const im = this.imgModel(img);
      const cap = node.querySelector('.figcap');
      if (cap) {
        const rs = [];
        for (const c of cap.childNodes) this.runs(c, rs);
        im.caption = { side: node.dataset.cap === 'top' ? 'top' : 'bottom', runs: rs, cs: this.charStyle(cap), para: { ...this.paraProps(cap), ml: 0, mr: 0, indent: 0, before: 0, after: 0, tabs: [] } };
      }
      out.push({ img: im });
      return;
    }
    if (node.classList.contains('fignum')) { out.push({ ...this.charStyle(node), autoNum: 'PICTURE' }); return; }
    if (tag === 'IMG') { out.push({ img: this.imgModel(node) }); return; }
    if (node.classList.contains('pnnew')) { out.push({ newNum: +node.dataset.start || 1 }); return; }
    if (tag === 'RUBY') {
      // 덧말 (본말 + 위/아래 작은 글자)
      const rt = node.querySelector('rt');
      let main = '';
      for (const c of node.childNodes) if (c.nodeName !== 'RT' && c.nodeName !== 'RP') main += c.textContent;
      out.push({ ...this.charStyle(node), dutmal: { main: main.replace(/\u200b/g, ''), sub: rt ? rt.textContent.replace(/\u200b/g, '') : '', pos: node.dataset.pos || 'TOP', sz: +node.dataset.sz || 50, align: node.dataset.align || 'CENTER' } });
      return;
    }
    if (node.classList.contains('pnhide')) { out.push({ pageHide: node.dataset.hide || 'p' }); return; }
    if (node.classList.contains('nobj')) { const sh = Shapes.toModel(node); if (sh && node.dataset.z) sh.z = +node.dataset.z; out.push({ shape: sh }); return; }
    if (node.classList.contains('mm-field')) {
      // 필드 표시용 색/배경은 저장하지 않음 (사용자가 직접 준 색만 유지)
      const st = this.charStyle(node);
      const ps = this.charStyle(node.parentElement);
      if (!node.style.color) st.color = ps.color;
      st.shade = node.style.backgroundColor ? cssColorToHex(node.style.backgroundColor) : bgOf(node.parentElement);
      out.push({ ...st, text: `{{${node.dataset.field || node.textContent.replace(/[{}]/g, '')}}}` });
      return;
    }
    if (tag === 'TABLE') return; // 인라인 위치의 표는 무시 (블록 처리됨)
    for (const c of node.childNodes) this.runs(c, out);
  },

  imgModel(node) {
    const z = App.zoom || 1;
    const rect = node.getBoundingClientRect();
    const w = parseFloat(node.style.width) || rect.width / z || node.naturalWidth;
    const hh = parseFloat(node.style.height) || rect.height / z || node.naturalHeight;
    const im = { url: node.src, w, h: hh, wrap: node.dataset.wrap || 'inline', name: node.dataset.name || '', ...Look.model(node) };
    if (node.dataset.z) im.z = +node.dataset.z;
    if (node.dataset.vdrop && (im.wrap === 'left' || im.wrap === 'right')) im.vdrop = +node.dataset.vdrop;
    if (im.wrap === 'front' || im.wrap === 'behind') { im.x = parseFloat(node.style.left) || 0; im.y = parseFloat(node.style.top) || 0; }
    return im;
  },
  table(table) {
    const g = Table.grid(table);
    const z = App.zoom || 1;
    const trs = rowsOf(table);
    const gs = document.getElementById('page-gaps');
    const gapsOn = !!(gs && !gs.disabled);
    const heights = trs.map((tr) => Math.max(parseFloat(tr.style.height) || 0, tr.getBoundingClientRect().height / z - (gapsOn && App.rowSplit && App.rowSplit.get(tr) || 0)));
    let align = 'left';
    if (table.classList.contains('tbl-center')) align = 'center';
    else if (table.classList.contains('tbl-right')) align = 'right';
    const cells = g.cells.map((x) => {
      const cs = getComputedStyle(x.el);
      const side = (s) => {
        const o = { style: cs[`border${s}Style`], width: parseFloat(cs[`border${s}Width`]) || 0, color: cssColorToHex(cs[`border${s}Color`]) || '#000000' };
        const d = x.el.dataset[Table.SIDE_KEY[s]];
        if (d && o.style !== 'none' && o.width) { const [mm, hwp] = d.split('|'); o.mm = +mm || null; o.hwp = hwp || null; }
        return o;
      };
      const w = g.widths.slice(x.c, x.c + x.cs).reduce((a, b) => a + b, 0);
      const hh = heights.slice(x.r, x.r + x.rs).reduce((a, b) => a + b, 0);
      return {
        r: x.r, c: x.c, rs: x.rs, cs: x.cs, w, h: hh,
        bg: cssColorToHex(cs.backgroundColor),
        // 여러 셀에 하나로 넣은 그림·비율 유지 채우기는 셀 크기대로 잘라 저장 (원본은 표 설명에 따로 기록)
        bgImg: !x.el.dataset.bgmode ? null : /^(one|cover)$/.test(x.el.dataset.bgmode) ? Table.bakeBg(x.el) : Table.bgUrl(x.el),
        bgMode: !x.el.dataset.bgmode ? null : /^(one|cover)$/.test(x.el.dataset.bgmode) ? 'stretch' : x.el.dataset.bgmode,
        bgMeta: /^(one|cover)$/.test(x.el.dataset.bgmode || '') ? { m: x.el.dataset.bgmode, f: x.el.dataset.bgfit || '', g: x.el.dataset.bggid || '', url: Table.bgUrl(x.el) } : null,
        valign: cs.verticalAlign === 'top' ? 'top' : cs.verticalAlign === 'bottom' ? 'bottom' : 'middle',
        borders: { top: side('Top'), right: side('Right'), bottom: side('Bottom'), left: side('Left') },
        blocks: this.blocks(x.el),
        diag: x.el.dataset.diag || null, dgc: x.el.dataset.dgc || '#000000', dgw: +x.el.dataset.dgw || 1,
        pad: x.el.style.padding || x.el.dataset.im ? ['Top', 'Right', 'Bottom', 'Left'].map((s) => parseFloat(cs['padding' + s]) || 0) : null,
      };
    });
    const wrap = table.dataset.wrap || 'inline';
    const out = { t: 'table', nr: g.nr, nc: g.nc, widths: g.widths, heights, align, cells, wrap, shift: align === 'left' ? +table.dataset.shift || 0 : 0, vshift: +table.dataset.vshift || 0, samepara: !!table.dataset.samepara, pb: table.dataset.pb || '', ...Look.model(table), ...(table.dataset.z ? { z: +table.dataset.z } : {}) };
    if (wrap === 'front' || wrap === 'behind') { out.x = parseFloat(table.style.left) || 0; out.y = parseFloat(table.style.top) || 0; }
    return out;
  },

  // 모델 전체 텍스트 (미리보기/메일머지용)
  plainText(blocks) {
    const lines = [];
    for (const b of blocks) {
      if (b.t === 'p') {
        lines.push(b.runs.map((r) => (r.text != null ? r.text : r.br ? '\n' : r.tab ? '\t' : '')).join(''));
        for (const r of b.runs) if (r.shape && r.shape.blocks) lines.push(this.plainText(r.shape.blocks));
      }
      else if (b.t === 'table') for (const c of b.cells) lines.push(this.plainText(c.blocks));
    }
    return lines.join('\n');
  },
};

function sameStyle(a, b) {
  const keys = ['font', 'size', 'bold', 'italic', 'underline', 'strike', 'sup', 'sub', 'color', 'shade', 'spacing', 'ratio', 'shadow', 'outline', 'border'];
  return keys.every((k) => a[k] === b[k]);
}
