// 문서 모델 → DOCX (docx 라이브러리)
'use strict';
const DocxExport = {
  async write(model) {
    const D = window.docx;
    // 도형·글상자는 그림(PNG)으로 바꿔 넣기
    let figN = 0;
    const walk = async (blocks) => {
      for (const b of blocks) {
        if (b.t === 'table') { for (const c of b.cells) await walk(c.blocks); continue; }
        // 그림 캡션 → 그림 뒤(앞)에 줄을 바꿔 글로 넣음
        for (let i = 0; i < b.runs.length; i++) {
          const cap = b.runs[i].img && b.runs[i].img.caption;
          if (!cap) continue;
          const rs = cap.runs.map((r) => (r.autoNum ? { ...r, autoNum: undefined, text: '그림 ' + (++figN) } : r));
          if (cap.side === 'top') { b.runs.splice(i, 0, ...rs, { br: true }); i += rs.length + 1; }
          else { b.runs.splice(i + 1, 0, { br: true }, ...rs); i += rs.length + 1; }
        }
        for (let i = 0; i < b.runs.length; i++) {
          const sh = b.runs[i].shape;
          if (!sh) continue;
          try {
            const png = await Shapes.rasterize(sh);
            const im = { url: png.url, w: png.w, h: png.h, wrap: sh.wrap };
            if (sh.x != null) { im.x = sh.x - png.pad; im.y = sh.y - png.pad; }
            b.runs[i] = { img: im };
          } catch (e) {
            console.warn('도형 변환 실패', e);
            b.runs[i] = sh.blocks ? { text: Model.plainText(sh.blocks) } : { text: '' };
          }
        }
      }
    };
    await walk(model.blocks);
    const twip = (mm) => Math.round(mm * 1440 / 25.4);
    const ptTwip = (pt) => Math.round(pt * 20);
    const pxEmuPx = (px) => Math.round(px); // ImageRun 변환 단위는 픽셀
    const alignMap = { left: D.AlignmentType.LEFT, right: D.AlignmentType.RIGHT, center: D.AlignmentType.CENTER, justify: D.AlignmentType.JUSTIFIED, distribute: D.AlignmentType.DISTRIBUTE };
    const borderMap = { solid: D.BorderStyle.SINGLE, dashed: D.BorderStyle.DASHED, dotted: D.BorderStyle.DOTTED, double: D.BorderStyle.DOUBLE };
    const hwpBorder = { SOLID: D.BorderStyle.SINGLE, DASH: D.BorderStyle.DASHED, DOT: D.BorderStyle.DOTTED, DASH_DOT: D.BorderStyle.DOT_DASH, DASH_DOT_DOT: D.BorderStyle.DOT_DOT_DASH, LONG_DASH: D.BorderStyle.DASH_SMALL_GAP, DOUBLE_SLIM: D.BorderStyle.DOUBLE, SLIM_THICK: D.BorderStyle.THIN_THICK_SMALL_GAP, THICK_SLIM: D.BorderStyle.THICK_THIN_SMALL_GAP, SLIM_THICK_SLIM: D.BorderStyle.THIN_THICK_THIN_SMALL_GAP };

    const runOf = (r) => {
      if (r.newNum || r.pageHide) return null;
      if (r.br) return new D.TextRun({ break: 1 });
      if (r.tab) return new D.TextRun({ children: [new D.Tab()] });
      if (r.img) {
        const d = dataURLToBytes(r.img.url);
        if (!d) return null;
        let type = extFromMime(d.mime);
        if (type === 'jpeg') type = 'jpg';
        if (!['png', 'jpg', 'gif', 'bmp'].includes(type)) type = 'png';
        const opts = { data: d.bytes, type, transformation: { width: pxEmuPx(r.img.w), height: pxEmuPx(r.img.h) } };
        if (r.img.wrap === 'front' || r.img.wrap === 'behind') {
          const pg = model.page;
          const CH = model.pitch || U.mm2px(pg.height - pg.top - pg.header - pg.bottom - pg.footer);
          const k = Math.max(0, Math.floor(r.img.y / CH));
          const emu = (px) => Math.round(px * 9525);
          opts.floating = {
            horizontalPosition: { relative: D.HorizontalPositionRelativeFrom.PAGE, offset: emu(r.img.x + U.mm2px(pg.left)) },
            verticalPosition: { relative: D.VerticalPositionRelativeFrom.PAGE, offset: emu(r.img.y - k * CH + U.mm2px(pg.top + pg.header)) },
            behindDocument: r.img.wrap === 'behind',
            allowOverlap: true,
            wrap: { type: D.TextWrappingType.NONE },
          };
        } else if (r.img.wrap === 'left' || r.img.wrap === 'right') {
          opts.floating = {
            horizontalPosition: { relative: D.HorizontalPositionRelativeFrom.COLUMN, align: r.img.wrap === 'left' ? D.HorizontalPositionAlign.LEFT : D.HorizontalPositionAlign.RIGHT },
            verticalPosition: { relative: D.VerticalPositionRelativeFrom.PARAGRAPH, offset: 0 },
            wrap: { type: D.TextWrappingType.SQUARE, side: D.TextWrappingSide.BOTH_SIDES },
            margins: { left: 114300, right: 114300 },
          };
        }
        return new D.ImageRun(opts);
      }
      const o = {
        text: r.text.replace(/ /g, ' '),
        font: r.font ? { name: r.font, eastAsia: r.font } : undefined,
        size: Math.round((r.size || 10) * 2),
        bold: r.bold || undefined,
        italics: r.italic || undefined,
        underline: r.underline ? {} : undefined,
        strike: r.strike || undefined,
        superScript: r.sup || undefined,
        subScript: r.sub || undefined,
        color: r.color ? r.color.replace('#', '') : undefined,
        characterSpacing: r.spacing ? Math.round((r.size || 10) * r.spacing / 100 * 20) : undefined,
        scale: r.ratio && r.ratio !== 100 ? r.ratio : undefined,
      };
      if (r.border) o.border = { style: D.BorderStyle.SINGLE, size: 4, color: r.border.replace('#', ''), space: 1 };
      if (r.shade) o.shading = { type: D.ShadingType.CLEAR, fill: r.shade.replace('#', ''), color: 'auto' };
      return new D.TextRun(o);
    };

    const paraOf = (b) => {
      const children = b.runs.map(runOf).filter(Boolean);
      if (b.colBreakBefore && D.ColumnBreak) children.unshift(new D.ColumnBreak());
      if (!children.length && b.cs) children.push(new D.TextRun({ text: '', size: Math.round((b.cs.size || 10) * 2), font: b.cs.font ? { name: b.cs.font, eastAsia: b.cs.font } : undefined }));
      const ind = {};
      const indent = b.indent || 0;
      if (b.ml) ind.left = ptTwip(b.ml);
      if (b.mr) ind.right = ptTwip(b.mr);
      if (indent > 0) ind.firstLine = ptTwip(indent);
      if (indent < 0) ind.hanging = ptTwip(-indent);
      return new D.Paragraph({
        children,
        alignment: alignMap[b.align] || D.AlignmentType.JUSTIFIED,
        spacing: { line: Math.round((b.lh || 160) / 100 * 240 * 0.85), lineRule: D.LineRuleType.AUTO, before: ptTwip(b.before || 0), after: ptTwip(b.after || 0) },
        indent: Object.keys(ind).length ? ind : undefined,
        pageBreakBefore: b.pageBreakBefore || undefined,
        tabStops: b.tabs && b.tabs.length ? b.tabs.map((t) => ({
          type: { L: D.TabStopType.LEFT, C: D.TabStopType.CENTER, R: D.TabStopType.RIGHT }[t.type] || D.TabStopType.LEFT,
          position: twip(t.pos),
          leader: { dot: 'dot', dash: 'hyphen', longdash: 'hyphen', solid: 'underscore', double: 'heavy' }[t.leader] || undefined,
        })) : undefined,
      });
    };

    const tableFloat = (t) => {
      if (t.wrap === 'left' || t.wrap === 'right') {
        return { horizontalAnchor: 'margin', verticalAnchor: 'text', relativeHorizontalPosition: t.wrap, absoluteVerticalPosition: 0, leftFromText: 180, rightFromText: 180, bottomFromText: 90 };
      }
      if (t.wrap === 'front' || t.wrap === 'behind') {
        const pg = model.page;
        const CH = model.pitch || U.mm2px(pg.height - pg.top - pg.header - pg.bottom - pg.footer);
        const k = Math.max(0, Math.floor(t.y / CH));
        return { horizontalAnchor: 'page', verticalAnchor: 'page', absoluteHorizontalPosition: Math.round((t.x + U.mm2px(pg.left)) * 15), absoluteVerticalPosition: Math.round((t.y - k * CH + U.mm2px(pg.top + pg.header)) * 15), overlap: 'overlap' };
      }
      return undefined;
    };
    const tableOf = (t) => {
      const rows = [];
      for (let r = 0; r < t.nr; r++) {
        const cells = t.cells.filter((c) => c.r === r).sort((a, b) => a.c - b.c).map((c) => {
          const border = (s) => (!s || s.style === 'none' || s.style === 'hidden' || !s.width)
            ? { style: D.BorderStyle.NONE, size: 0, color: 'auto' }
            : { style: (s.hwp && hwpBorder[s.hwp]) || borderMap[s.style] || D.BorderStyle.SINGLE, size: s.mm ? Math.max(2, Math.min(96, Math.round(s.mm * 72 / 25.4 * 8))) : Math.max(2, Math.round(s.width * 6)), color: (s.color || '#000000').replace('#', '') };
          return new D.TableCell({
            children: blocksOf(c.blocks, true),
            columnSpan: c.cs > 1 ? c.cs : undefined,
            rowSpan: c.rs > 1 ? c.rs : undefined,
            width: { size: Math.round(c.w * 15), type: D.WidthType.DXA },
            verticalAlign: { top: D.VerticalAlign.TOP, middle: D.VerticalAlign.CENTER, bottom: D.VerticalAlign.BOTTOM }[c.valign],
            shading: c.bg ? { type: D.ShadingType.CLEAR, fill: c.bg.replace('#', ''), color: 'auto' } : undefined,
            borders: { top: border(c.borders.top), bottom: border(c.borders.bottom), left: border(c.borders.left), right: border(c.borders.right) },
            margins: { left: 100, right: 100, top: 30, bottom: 30 },
          });
        });
        if (!cells.length) continue;
        rows.push(new D.TableRow({ children: cells, height: t.heights[r] ? { value: Math.round(t.heights[r] * 15), rule: D.HeightRule.ATLEAST } : undefined }));
      }
      return new D.Table({
        rows,
        columnWidths: t.widths.map((w) => Math.round(w * 15)),
        width: { size: Math.round(t.widths.reduce((a, b) => a + b, 0) * 15), type: D.WidthType.DXA },
        layout: D.TableLayoutType.FIXED,
        alignment: !t.wrap || t.wrap === 'inline' ? { left: D.AlignmentType.LEFT, center: D.AlignmentType.CENTER, right: D.AlignmentType.RIGHT }[t.align] : undefined,
        float: tableFloat(t),
      });
    };

    const blocksOf = (blocks, inCell) => {
      const out = [];
      for (const b of blocks) {
        if (b.t === 'table') {
          if (b.pageBreakBefore) out.push(new D.Paragraph({ children: [new D.PageBreak()] }));
          out.push(tableOf(b));
          if (inCell) out.push(new D.Paragraph({ children: [] }));
        } else out.push(paraOf(b));
      }
      if (!out.length || (inCell && !(out[out.length - 1] instanceof D.Paragraph))) out.push(new D.Paragraph({ children: [] }));
      return out;
    };

    const pg = model.page;
    const pn = model.pageNum && model.pageNum.pos && model.pageNum.pos !== 'none' ? model.pageNum.pos : null;
    const pno = model.pageNum || {};
    const deco = pno.deco || (pno.side ? 'side' : 'plain');
    // 머리말·꼬리말: 왼쪽 ⇥ 가운데 ⇥ 오른쪽, {쪽}·{전체쪽}은 필드. withPn: 쪽 번호를 같은 문단에 합침
    const cwTw = twip(pg.width - pg.left - pg.right);
    const hfPara = (kind, withPn) => {
      const hf = HF.norm(model[kind]);
      const pnAl = withPn ? pn.split('-')[1] : null;
      if (!hf && !pnAl) return null;
      const o = hf || { left: '', center: '', right: '', font: '함초롬바탕', size: 9, bold: false, color: '#000000', line: false };
      const look = (q) => ({ font: { name: q.font || '함초롬바탕', eastAsia: q.font || '함초롬바탕' }, size: Math.round((q.size || 9) * 2), bold: !!q.bold, color: (q.color || '#000000').replace('#', '') });
      const run = (x) => ({ ...look(o), ...x });
      // 쪽 번호만 따로 있는 칸은 쪽 번호 글자 모양으로
      const pnLook = look({ font: pno.font, size: pno.size, bold: pno.bold, color: pno.color });
      const pnKids = () => { const C = D.PageNumber.CURRENT; return { side: ['- ', C, ' -'], paren: ['(', C, ')'], total: [C, ' / ', D.PageNumber.TOTAL_PAGES], jjok: [C, '쪽'] }[deco] || [C]; };
      const slotRuns = (k) => {
        const out = [];
        for (const p of HF.parts(o[k] || '')) {
          if (p.t != null) out.push(new D.TextRun(run({ text: p.t })));
          else out.push(new D.TextRun(run({ children: [p.tok === 'page' ? D.PageNumber.CURRENT : D.PageNumber.TOTAL_PAGES] })));
        }
        if (pnAl === k) { const own = (o[k] || '').trim(); if (own) out.push(new D.TextRun(run({ text: '   ' }))); out.push(new D.TextRun(own && hf ? run({ children: pnKids() }) : { ...pnLook, children: pnKids() })); }
        return out;
      };
      const used = HF.SLOTS.filter((k) => (o[k] || '').trim() || pnAl === k);
      const border = o.line ? { [kind === 'header' ? 'bottom' : 'top']: { style: D.BorderStyle.SINGLE, size: 4, color: o.color.replace('#', ''), space: 1 } } : undefined;
      if (used.length <= 1) {
        const k = used[0] || 'center';
        return new D.Paragraph({ children: slotRuns(k), alignment: alignMap[k], border });
      }
      const kids = [...slotRuns('left'), new D.TextRun(run({ children: [new D.Tab()] })), ...slotRuns('center'), new D.TextRun(run({ children: [new D.Tab()] })), ...slotRuns('right')];
      return new D.Paragraph({ children: kids, border, tabStops: [{ type: D.TabStopType.CENTER, position: Math.round(cwTw / 2) }, { type: D.TabStopType.RIGHT, position: cwTw }] });
    };
    const numFmt = { digit: D.NumberFormat.DECIMAL, lroman: D.NumberFormat.LOWER_ROMAN, uroman: D.NumberFormat.UPPER_ROMAN, hangul: D.NumberFormat.GANADA, lalpha: D.NumberFormat.LOWER_LETTER, ualpha: D.NumberFormat.UPPER_LETTER, circled: D.NumberFormat.DECIMAL_ENCLOSED_CIRCLE }[pno.fmt || 'digit'] || D.NumberFormat.DECIMAL;
    const headers = {}, footers = {};
    const pnTop = pn && pn.startsWith('top'), pnBot = pn && pn.startsWith('bottom');
    const hp = hfPara('header', pnTop), fp = hfPara('footer', pnBot);
    if (hp) headers.default = new D.Header({ children: [hp] });
    if (fp) footers.default = new D.Footer({ children: [fp] });
    // 첫 쪽 번호 감추기: 첫 쪽용 머리말·꼬리말은 번호 없이
    const hideFirst = pn && pno.hideFirst;
    if (hideFirst) {
      const h0 = hfPara('header', false), f0 = hfPara('footer', false);
      headers.first = new D.Header({ children: [h0 || new D.Paragraph({})] });
      footers.first = new D.Footer({ children: [f0 || new D.Paragraph({})] });
    }

    // 다단: 단 정의가 바뀌는 곳마다 구역을 나눔 (Word는 구역 끝의 단 설정을 씀)
    const pageProps = {
      size: { width: twip(Math.min(pg.width, pg.height)), height: twip(Math.max(pg.width, pg.height)), orientation: pg.width > pg.height ? D.PageOrientation.LANDSCAPE : D.PageOrientation.PORTRAIT },
      margin: { top: twip(pg.top + pg.header), bottom: twip(pg.bottom + pg.footer), left: twip(pg.left), right: twip(pg.right), header: twip(pg.top), footer: twip(pg.bottom) },
    };
    const segs = [];
    let curCols = null;
    for (const b of model.blocks) {
      const nn = b.runs && (b.runs.find((r) => r.newNum) || {}).newNum;
      if (b.cols) curCols = b.cols.n > 1 ? b.cols : null;
      if (!segs.length || b.cols || nn) segs.push({ cols: curCols, blocks: [], newNum: nn || null });
      segs[segs.length - 1].blocks.push(b);
    }
    const doc = new D.Document({
      creator: '누리글',
      compatibility: { doNotExpandShiftReturn: true },
      styles: { default: { document: { run: { font: { name: App.baseFont(), eastAsia: App.baseFont() }, size: Math.round(App.baseSize() * 2) } } } },
      sections: segs.map((sg, i) => ({
        properties: {
          ...(i > 0 ? { type: sg.newNum ? D.SectionType.NEXT_PAGE : D.SectionType.CONTINUOUS } : {}),
          ...(i === 0 && hideFirst ? { titlePage: true } : {}),
          page: { ...pageProps, ...(pn ? { pageNumbers: { formatType: numFmt, ...(i === 0 ? { start: sg.newNum || pno.start || 1 } : sg.newNum ? { start: sg.newNum } : {}) } } : {}) },
          ...(sg.cols && sg.cols.n > 1 ? { column: { count: sg.cols.n, space: twip(sg.cols.gap || 8), separate: !!sg.cols.line, equalWidth: true } } : {}),
        },
        ...(i === 0 ? { headers, footers } : {}),
        children: blocksOf(sg.blocks, false),
      })),
    });
    const blob = await D.Packer.toBlob(doc);
    return new Uint8Array(await blob.arrayBuffer());
  },
};
