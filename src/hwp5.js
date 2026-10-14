// 한글 97 이후 바이너리 문서(HWP 5.x) → HWPX 로 바꾸기
// hwp.js 파서(@hwp.js/parser, Apache-2.0)로 읽은 뒤 HWPX(OWPML) 묶음을 만들어 HWPX.read 로 불러옴
'use strict';
const HWP5 = (() => {
  const NS = 'xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"';
  const BORDER_MM = ['0.1 mm', '0.12 mm', '0.15 mm', '0.2 mm', '0.25 mm', '0.3 mm', '0.4 mm', '0.5 mm', '0.6 mm', '0.7 mm', '1.0 mm', '1.5 mm', '2.0 mm', '3.0 mm', '4.0 mm', '5.0 mm'];
  const LINE = ['NONE', 'SOLID', 'DASH', 'DOT', 'DASH_DOT', 'DASH_DOT_DOT', 'LONG_DASH', 'CIRCLE', 'DOUBLE_SLIM', 'SLIM_THICK', 'THICK_SLIM', 'SLIM_THICK_SLIM', 'WAVE', 'DOUBLEWAVE', 'THICK_3D', 'THICK_3D_REVERS', '3D', '3D_REVERS'];
  const ALIGN = ['JUSTIFY', 'LEFT', 'RIGHT', 'CENTER', 'DISTRIBUTE', 'DISTRIBUTE_SPACE'];
  const WRAP = ['SQUARE', 'TOP_AND_BOTTOM', 'BEHIND_TEXT', 'IN_FRONT_OF_TEXT'];
  const VALIGN = ['TOP', 'CENTER', 'BOTTOM'];
  // 확장 제어 문자(뒤에 제어 레코드가 딸린 것)
  const EXTENDED = new Set([1, 2, 3, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23]);

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const hex = (c) => (c ? '#' + [c.red, c.green, c.blue].map((v) => (v | 0).toString(16).padStart(2, '0')).join('').toUpperCase() : '#000000');
  const isWhite = (c) => !c || (c.red === 255 && c.green === 255 && c.blue === 255);
  const half = (v) => Math.round((v || 0) / 2);

  function isHwp5(bytes) {
    // OLE 복합 문서 서명 D0 CF 11 E0 A1 B1 1A E1
    const sig = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    return bytes && bytes.length > 8 && sig.every((b, i) => bytes[i] === b);
  }

  // ---------- header.xml ----------
  function headerXml(doc) {
    const im = doc.info.idMappings;
    const fontface = (lang, list) => `<hh:fontface lang="${lang}" fontCnt="${list.length}">${list.map((f, i) => `<hh:font id="${i}" face="${esc(f.name || '함초롬바탕')}" type="TTF" isEmbedded="0"/>`).join('')}</hh:fontface>`;
    const langs = [['HANGUL', im.koreanFonts], ['LATIN', im.englishFonts], ['HANJA', im.chineseCharactersFonts], ['JAPANESE', im.japaneseFonts], ['OTHER', im.etcFonts], ['SYMBOL', im.symbolFonts], ['USER', im.userFonts]];
    let x = `<hh:fontfaces itemCnt="7">${langs.map(([l, list]) => fontface(l, list || [])).join('')}</hh:fontfaces>`;
    // 테두리/배경 (HWP id는 1부터)
    const side = (tag, b) => `<hh:${tag} type="${b && b.kind ? LINE[b.kind] || 'SOLID' : 'NONE'}" width="${BORDER_MM[(b && b.width) || 0] || '0.12 mm'}" color="${hex(b && b.color)}"/>`;
    x += `<hh:borderFills itemCnt="${im.borderFills.length}">` + im.borderFills.map((bf, i) => {
      const [l, r, t, b] = bf.borders || [];
      let fill = '';
      const fc = bf.fill && bf.fill.kind & 1 && bf.fill.content ? bf.fill.content.background_color || bf.fill.content.backgroundColor : null;
      if (fc && !isWhite(fc)) fill = `<hc:fillBrush><hc:winBrush faceColor="${hex(fc)}" hatchColor="#000000" alpha="0"/></hc:fillBrush>`;
      const d = bf.diagonalBorder;
      return `<hh:borderFill id="${i + 1}" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">`
        + `<hh:slash type="${bf.slashDiagonalShape ? 'CENTER' : 'NONE'}" Crooked="0" isCounter="0"/><hh:backSlash type="${bf.backSlashDiagonalShape ? 'CENTER' : 'NONE'}" Crooked="0" isCounter="0"/>`
        + side('leftBorder', l) + side('rightBorder', r) + side('topBorder', t) + side('bottomBorder', b)
        + `<hh:diagonal type="SOLID" width="${BORDER_MM[(d && d.width) || 0]}" color="${hex(d && d.color)}"/>${fill}</hh:borderFill>`;
    }).join('') + '</hh:borderFills>';
    // 글자 모양
    x += `<hh:charProperties itemCnt="${im.charShapes.length}">` + im.charShapes.map((c, i) => {
      const all = (v) => `hangul="${v}" latin="${v}" hanja="${v}" japanese="${v}" other="${v}" symbol="${v}" user="${v}"`;
      const f = c.fontIds || [0];
      return `<hh:charPr id="${i}" height="${c.fontBaseSize || 1000}" textColor="${hex(c.color)}" shadeColor="${isWhite(c.shadeColor) ? 'none' : hex(c.shadeColor)}" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="${c.borderFillId || 0}">`
        + `<hh:fontRef hangul="${f[0] || 0}" latin="${f[1] || 0}" hanja="${f[2] || 0}" japanese="${f[3] || 0}" other="${f[4] || 0}" symbol="${f[5] || 0}" user="${f[6] || 0}"/>`
        + `<hh:ratio ${all((c.fontScales || [100])[0])}/><hh:spacing ${all((c.fontSpacings || [0])[0])}/><hh:relSz ${all(100)}/><hh:offset ${all(0)}/>`
        + (c.italic ? '<hh:italic/>' : '') + (c.bold ? '<hh:bold/>' : '')
        + `<hh:underline type="${c.underlineKind ? 'BOTTOM' : 'NONE'}" shape="SOLID" color="${hex(c.underlineColor)}"/>`
        + `<hh:strikeout shape="${c.strike ? 'SOLID' : 'NONE'}" color="${hex(c.color)}"/>`
        + `<hh:outline type="${c.outlineKind ? 'SOLID' : 'NONE'}"/><hh:shadow type="${c.shadowKind ? 'DROP' : 'NONE'}" color="${hex(c.shadowColor)}" offsetX="10" offsetY="10"/>`
        + (c.supscript ? '<hh:supscript/>' : '') + (c.subscript ? '<hh:subscript/>' : '') + '</hh:charPr>';
    }).join('') + '</hh:charProperties>';
    // 탭
    const TT = ['LEFT', 'RIGHT', 'CENTER', 'DECIMAL'];
    x += `<hh:tabProperties itemCnt="${im.tabDefinitions.length}">` + im.tabDefinitions.map((t, i) => `<hh:tabPr id="${i}" autoTabLeft="${t.leftTab ? 1 : 0}" autoTabRight="${t.rightTab ? 1 : 0}">`
      + (t.tabInfos || []).map((ti) => `<hh:tabItem pos="${half(ti.position)}" type="${TT[ti.kind] || 'LEFT'}" leader="${ti.borderKind ? LINE[ti.borderKind] || 'SOLID' : 'NONE'}"/>`).join('') + '</hh:tabPr>').join('') + '</hh:tabProperties>';
    // 문단 번호·글머리표 (번호 모양은 문단 머리 속성의 5~8비트)
    const NUMF = ['DIGIT', 'CIRCLED_DIGIT', 'ROMAN_CAPITAL', 'ROMAN_SMALL', 'LATIN_CAPITAL', 'LATIN_SMALL', 'CIRCLED_LATIN_CAPITAL', 'CIRCLED_LATIN_SMALL', 'HANGUL_SYLLABLE', 'CIRCLED_HANGUL_SYLLABLE', 'HANGUL_JAMO', 'CIRCLED_HANGUL_JAMO', 'HANGUL_PHONETIC', 'IDEOGRAPH', 'CIRCLED_IDEOGRAPH'];
    const heads = (hs, start) => (hs || []).map((hd, lv) => `<hh:paraHead start="${hd.startNumber != null ? hd.startNumber : 1}" level="${lv + 1}" align="LEFT" useInstWidth="${hd.useInstanceWidth ? 1 : 0}" autoIndent="${hd.autoIndent ? 1 : 0}" widthAdjust="0" textOffsetType="PERCENT" textOffset="${hd.textOffset || 50}" numFormat="${NUMF[((hd.attr >>> 5) & 15)] || 'DIGIT'}" charPrIDRef="4294967295" checkable="0">${esc(hd.numberFormat || '')}</hh:paraHead>`).join('');
    const nums = im.numberings || [];
    if (nums.length) x += `<hh:numberings itemCnt="${nums.length}">` + nums.map((n, i) => `<hh:numbering id="${i + 1}" start="${n.start || 0}">${heads(n.paragraphHeads)}</hh:numbering>`).join('') + '</hh:numberings>';
    const buls = im.bullets || [];
    if (buls.length) x += `<hh:bullets itemCnt="${buls.length}">` + buls.map((bl, i) => `<hh:bullet id="${i + 1}" char="${esc(bl.bulletChar || '')}" useImage="0"/>`).join('') + '</hh:bullets>';
    // 문단 모양 (HWP 5는 여백 값을 두 배로 적음)
    x += `<hh:paraProperties itemCnt="${im.paragraphShapes.length}">` + im.paragraphShapes.map((p, i) => {
      const lsKind = ['PERCENT', 'FIXED', 'BETWEEN_LINES', 'AT_LEAST'][p.lineSpaceKindOld || 0] || 'PERCENT';
      const ls = lsKind === 'PERCENT' ? p.lineSpaceOld || 160 : half(p.lineSpaceOld);
      return `<hh:paraPr id="${i}" tabPrIDRef="${p.tabDefinitionId || 0}" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">`
        + `<hh:align horizontal="${ALIGN[p.align] || 'JUSTIFY'}" vertical="BASELINE"/>`
        + `<hh:heading type="${['NONE', 'OUTLINE', 'NUMBER', 'BULLET'][p.headingKind || 0] || 'NONE'}" idRef="${p.numberingBulletId || 0}" level="${p.headingLevel || 0}"/>`
        + `<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="${p.breakNonLatinWord ? 'BREAK_WORD' : 'KEEP_WORD'}" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>`
        + `<hh:margin><hc:intent value="${half(p.indent)}" unit="HWPUNIT"/><hc:left value="${half(p.paddingLeft)}" unit="HWPUNIT"/><hc:right value="${half(p.paddingRight)}" unit="HWPUNIT"/><hc:prev value="${half(p.marginTop)}" unit="HWPUNIT"/><hc:next value="${half(p.marginBottom)}" unit="HWPUNIT"/></hh:margin>`
        + `<hh:lineSpacing type="${lsKind}" value="${ls}" unit="HWPUNIT"/><hh:border borderFillIDRef="${p.borderFillId || 0}" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/></hh:paraPr>`;
    }).join('') + '</hh:paraProperties>';
    x += `<hh:styles itemCnt="${im.styles.length}">` + im.styles.map((s, i) => `<hh:style id="${i}" type="${s.kind ? 'CHAR' : 'PARA'}" name="${esc(s.name || '')}" engName="${esc(s.englishName || '')}" paraPrIDRef="${s.paragraphShapeId || 0}" charPrIDRef="${s.charShapeId || 0}" nextStyleIDRef="${s.nextStyleId || 0}" langID="1042" lockForm="0"/>`).join('') + '</hh:styles>';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hh:head ${NS} version="1.4" secCnt="${doc.sections.length}"><hh:refList>${x}</hh:refList></hh:head>`;
  }

  // ---------- section*.xml ----------
  function makeWriter(doc, bins) {
    const im = doc.info.idMappings;
    // 그림 번호 → BinData 파일 이름
    const binName = (binItemId) => {
      const bd = im.binaryData[binItemId - 1];
      if (!bd) return null;
      const want = 'BIN' + bd.id.toString(16).toUpperCase().padStart(4, '0');
      const f = doc.binDataList.find((b) => b.name.toUpperCase().startsWith(want)) || doc.binDataList[binItemId - 1];
      if (!f) return null;
      const id = 'image' + binItemId;
      if (!bins.has(id)) bins.set(id, { id, name: f.name, data: f.data, ext: (f.name.split('.').pop() || bd.extension || 'bin').toLowerCase() });
      return id;
    };
    const posXml = (cp) => `<hp:pos treatAsChar="${cp.treatAsChar ? 1 : 0}" affectLSpacing="0" flowWithText="1" allowOverlap="${cp.allowOverlap ? 1 : 0}" holdAnchorAndSO="0" vertRelTo="${['PAPER', 'PAGE', 'PARA'][cp.verticalRelativeTo] || 'PARA'}" horzRelTo="${['PAPER', 'PAGE', 'COLUMN', 'PARA'][cp.horizontalRelativeTo] || 'COLUMN'}" vertAlign="${['TOP', 'CENTER', 'BOTTOM', 'INSIDE', 'OUTSIDE'][cp.verticalAlign] || 'TOP'}" horzAlign="${['LEFT', 'CENTER', 'RIGHT', 'INSIDE', 'OUTSIDE'][cp.horizontalAlign] || 'LEFT'}" vertOffset="${(cp.offset && cp.offset.vertical) || 0}" horzOffset="${(cp.offset && cp.offset.horizontal) || 0}"/>`;
    const marginXml = (tag, m) => `<hp:${tag} left="${(m && m[0]) || 0}" right="${(m && m[1]) || 0}" top="${(m && m[2]) || 0}" bottom="${(m && m[3]) || 0}"/>`;

    function tableXml(ctrl) {
      const t = ctrl.content;
      const cp = t.commonProperties || {};
      const rec = t.record || {};
      const rows = {};
      for (const c of t.cells || []) (rows[c.row] = rows[c.row] || []).push(c);
      let x = `<hp:tbl id="${cp.instanceId || 0}" zOrder="${cp.zOrder || 0}" numberingType="TABLE" textWrap="${WRAP[cp.textWrap] || 'TOP_AND_BOTTOM'}" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="${rec.repeatHeader ? 1 : 0}" rowCnt="${rec.rows || 0}" colCnt="${rec.cols || 0}" cellSpacing="${rec.cellSpacing || 0}" borderFillIDRef="${rec.borderFillId || 0}" noAdjust="0">`
        + `<hp:sz width="${cp.width || 0}" widthRelTo="ABSOLUTE" height="${cp.height || 0}" heightRelTo="ABSOLUTE" protect="0"/>` + posXml(cp)
        + marginXml('outMargin', cp.margin) + marginXml('inMargin', rec.padding);
      for (const r of Object.keys(rows).map(Number).sort((a, b) => a - b)) {
        x += '<hp:tr>';
        for (const c of rows[r].sort((a, b) => a.column - b.column)) {
          const pl = c.paragraphs || {};
          const ps = pl.paragraphs || (Array.isArray(pl) ? pl : []);
          const va = pl.header ? VALIGN[pl.header.verticalAlign] || 'CENTER' : 'CENTER';
          const pad = c.padding || [];
          const hasMargin = pad.some((v, i) => v !== (rec.padding || [])[i]);
          x += `<hp:tc name="" header="0" hasMargin="${hasMargin ? 1 : 0}" protect="0" editable="0" dirty="0" borderFillIDRef="${c.borderFillId || 0}">`
            + `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="${va}" linkListIDRef="0" linkListNextIDRef="0" textWidth="${c.width || 0}" textHeight="${c.height || 0}" hasTextRef="0" hasNumRef="0">${paras(ps)}</hp:subList>`
            + `<hp:cellAddr colAddr="${c.column}" rowAddr="${c.row}"/><hp:cellSpan colSpan="${c.colSpan || 1}" rowSpan="${c.rowSpan || 1}"/><hp:cellSz width="${c.width || 0}" height="${c.height || 0}"/>`
            + marginXml('cellMargin', pad) + '</hp:tc>';
        }
        x += '</hp:tr>';
      }
      return x + '</hp:tbl>';
    }
    function picXml(ctrl, pic) {
      const cp = ctrl.content.commonProperties || {};
      const id = pic.image ? binName(pic.image.binItemId) : null;
      if (!id) return '';
      return `<hp:pic id="${cp.instanceId || 0}" zOrder="${cp.zOrder || 0}" numberingType="PICTURE" textWrap="${WRAP[cp.textWrap] || 'TOP_AND_BOTTOM'}" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="0" reverse="0">`
        + `<hp:curSz width="${cp.width || 0}" height="${cp.height || 0}"/>`
        + `<hp:sz width="${cp.width || 0}" widthRelTo="ABSOLUTE" height="${cp.height || 0}" heightRelTo="ABSOLUTE" protect="0"/>` + posXml(cp)
        + marginXml('outMargin', cp.margin) + `<hc:img binaryItemIDRef="${id}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/></hp:pic>`;
    }
    function secXml(sc) {
      const pd = sc.pageDefinition || {};
      const m = pd.padding || {};
      return `<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="${sc.columnSpace || 1134}" tabStop="8000" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0">`
        + `<hp:startNum pageStartsOn="BOTH" page="${sc.pageNumber || 0}" pic="0" tbl="0" equation="0"/>`
        + `<hp:pagePr landscape="${pd.landscape ? 'NARROWLY' : 'WIDELY'}" width="${pd.width || 59528}" height="${pd.height || 84186}" gutterType="LEFT_ONLY">`
        + `<hp:margin header="${m.header != null ? m.header : 4252}" footer="${m.footer != null ? m.footer : 4252}" gutter="${m.binding || 0}" left="${m.left != null ? m.left : 8504}" right="${m.right != null ? m.right : 8504}" top="${m.top != null ? m.top : 5668}" bottom="${m.bottom != null ? m.bottom : 4252}"/></hp:pagePr></hp:secPr>`;
    }
    // 글상자 등 도형 안의 글 → 따로 문단으로
    const after = [];
    function controlXml(ctrl) {
      const c = ctrl && ctrl.content;
      if (!c) return '';
      // 파서의 클래스 이름은 줄여져 있으므로 속성으로 구분
      if (c.pageDefinition) return secXml(c);
      if (c.cells) return tableXml(ctrl);
      if (c.commonProperties && c.elementProperties) {
        const inner = c.content;
        const pic = inner && (inner.image ? inner : inner.content && inner.content.image ? inner.content : null);
        if (pic) return picXml(ctrl, pic);
        const dt = c.drawText && c.drawText.paragraphs;
        const ps = dt && (dt.paragraphs || (Array.isArray(dt) ? dt : null));
        if (ps && ps.length) after.push(paras(ps));
        return '';
      }
      return '';
    }
    function paraXml(p) {
      const hdr = p.header || {};
      const shapes = (p.charShapes || []).slice().sort((a, b) => a.startPosition - b.startPosition);
      const shapeAt = (pos) => { let id = shapes.length ? shapes[0].shapeId : 0; for (const s of shapes) if (s.startPosition <= pos) id = s.shapeId; return id; };
      const controls = (p.controls || []).slice();
      let x = '', run = null, buf = '', pos = 0;
      const flushT = () => { if (buf) { x += `<hp:t>${buf}</hp:t>`; buf = ''; } };
      const openRun = (id) => { if (run !== id) { flushT(); if (run !== null) x += '</hp:run>'; x += `<hp:run charPrIDRef="${id}">`; run = id; } };
      for (const ch of (p.chars && p.chars.chars) || []) {
        openRun(shapeAt(pos));
        const code = ch.control != null ? ch.control : ch.code;
        if (ch.control != null || code < 32) {
          if (code === 13) { /* 문단 끝 */ }
          else if (code === 10) buf += '<hp:lineBreak/>';
          else if (code === 9) buf += '<hp:tab width="4000" leader="0" type="1"/>';
          else if (code === 24) buf += '-';
          else if (code === 30) buf += '<hp:nbSpace/>';   // 묶음 빈칸
          else if (code === 31) buf += '<hp:fwSpace/>';   // 고정폭 빈칸
          else if (EXTENDED.has(code)) { flushT(); x += controlXml(controls.shift()); }
        } else buf += esc(String.fromCodePoint(code));
        pos += ch.bytes || 1;
      }
      flushT();
      if (run === null) x += `<hp:run charPrIDRef="${shapeAt(0)}">`;
      x += '</hp:run>';
      const out = `<hp:p id="0" paraPrIDRef="${hdr.paragraphShapeId || 0}" styleIDRef="${hdr.styleId || 0}" pageBreak="${hdr.pageBreak ? 1 : 0}" columnBreak="${hdr.columnBreak ? 1 : 0}" merged="0">${x}</hp:p>`;
      const extra = after.splice(0).join('');
      return out + extra;
    }
    function paras(ps) { return (ps || []).map(paraXml).join(''); }
    return { paras };
  }

  // HWP 바이트 → HWPX 바이트 (Uint8Array)
  async function toHwpx(bytes) {
    if (!window.HwpParser) throw new Error('HWP 해석기를 불러오지 못했습니다.');
    let doc;
    try { doc = HwpParser.parse(bytes, { type: 'array' }); }
    catch (e) { throw new Error('HWP 파일을 읽을 수 없습니다: ' + (e && e.message ? e.message : e)); }
    if (doc.header && doc.header.flags && (doc.header.flags.encrypted || doc.header.flags.distributed)) throw new Error('암호가 걸렸거나 배포용으로 만든 HWP 문서는 열 수 없습니다.');
    const bins = new Map();
    const w = makeWriter(doc, bins);
    const zip = new JSZip();
    zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });
    zip.file('version.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" major="5" minor="1" micro="0" buildNumber="0" os="1" xmlVersion="1.4" application="Nurigeul" appVersion="1.0"/>');
    zip.file('META-INF/container.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container"><ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/></ocf:rootfiles></ocf:container>');
    zip.file('Contents/header.xml', headerXml(doc));
    const secItems = [];
    doc.sections.forEach((s, i) => {
      zip.file(`Contents/section${i}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hs:sec ${NS}>${w.paras(s.paragraphs)}</hs:sec>`);
      secItems.push(`section${i}`);
    });
    const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff', wmf: 'image/x-wmf', emf: 'image/x-emf' };
    let binItems = '';
    for (const b of bins.values()) {
      zip.file(`BinData/${b.name}`, b.data);
      binItems += `<opf:item id="${b.id}" href="BinData/${esc(b.name)}" media-type="${mime[b.ext] || 'application/octet-stream'}" isEmbeded="1"/>`;
    }
    zip.file('Contents/content.hpf', '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><opf:package xmlns:opf="http://www.idpf.org/2007/opf/" version="" unique-identifier="" id=""><opf:metadata><opf:title/></opf:metadata><opf:manifest>'
      + '<opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>'
      + secItems.map((s) => `<opf:item id="${s}" href="Contents/${s}.xml" media-type="application/xml"/>`).join('') + binItems
      + '</opf:manifest><opf:spine><opf:itemref idref="header" linear="yes"/>' + secItems.map((s) => `<opf:itemref idref="${s}" linear="yes"/>`).join('') + '</opf:spine></opf:package>');
    return zip.generateAsync({ type: 'uint8array' });
  }

  return { isHwp5, toHwpx };
})();
