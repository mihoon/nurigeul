// HWPX(OWPML) 읽기/쓰기
'use strict';
const BG_META = '누리글 셀 배경:';
const HWPX = (() => {
  const T = window.HWPX_TEMPLATE;
  const NS_HP = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
  const BASE_CHARPR = 7, BASE_PARAPR = 20, BASE_BF = 3, BASE_TAB = 3;
  const DEFAULT_FONTS = ['함초롬돋움', '함초롬바탕'];
  const BORDER_MM = [0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0];
  let idSeq = 1000;
  const nid = () => String(++idSeq + Math.floor(Math.random() * 1000) * 100000);

  const secRootOpen = T['Contents/section0.xml'].match(/<hs:sec [^>]*>/)[0];
  const xmlDecl = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>';
  const skeletonSecPr = T['Contents/section0.xml'].match(/<hp:secPr[\s\S]*?<\/hp:secPr>/)[0];

  // =================== 쓰기 ===================
  function write(model, meta = {}) {
    const fonts = DEFAULT_FONTS.slice();
    const charPrs = new Map(), paraPrs = new Map(), borderFills = new Map(), tabPrs = new Map();
    const tabPrId = (tabs) => {
      if (!tabs || !tabs.length) return 0;
      const items = tabs.map((t) => ({ pos: Math.round(U.mm2hwp(t.pos)), type: TabStops.HWP_TYPE[t.type] || 'LEFT', leader: TabStops.HWP_LEADER[t.leader] || 'NONE' }));
      const key = JSON.stringify(items);
      if (!tabPrs.has(key)) tabPrs.set(key, { id: BASE_TAB + tabPrs.size, items });
      return tabPrs.get(key).id;
    };
    const bins = [];
    const binByUrl = new Map();
    let zSeq = 0;
    const contentW = U.mm2hwp(model.page.width - model.page.left - model.page.right);

    const fontId = (name) => {
      name = (name || '함초롬바탕').replace(/["']/g, '');
      if (/^(serif|sans-serif|monospace|system-ui)$/i.test(name)) name = name === 'serif' ? '함초롬바탕' : '함초롬돋움';
      let i = fonts.indexOf(name);
      if (i < 0) { fonts.push(name); i = fonts.length - 1; }
      return i;
    };
    const charPrId = (st) => {
      st = st || {};
      const k = {
        f: fontId(st.font), s: Math.round((st.size || 10) * 100), b: !!st.bold, i: !!st.italic, u: !!st.underline,
        x: !!st.strike, p: !!st.sup, d: !!st.sub, c: (st.color || '#000000').toUpperCase(), h: st.shade ? st.shade.toUpperCase() : 'none',
        sp: Math.max(-50, Math.min(50, Math.round(st.spacing || 0))),
        rt: Math.max(50, Math.min(200, Math.round(st.ratio || 100))),
        sh: st.shadow ? st.shadow.toUpperCase() : null, ol: !!st.outline,
        bf: st.border ? bfId({ borders: Object.fromEntries(['top', 'right', 'bottom', 'left'].map((x) => [x, { style: 'solid', width: 1, color: st.border }])), bg: null }) : 2,
      };
      const key = JSON.stringify(k);
      if (!charPrs.has(key)) charPrs.set(key, { id: BASE_CHARPR + charPrs.size, k });
      return charPrs.get(key).id;
    };
    const paraPrId = (b) => {
      const alignMap = { left: 'LEFT', right: 'RIGHT', center: 'CENTER', justify: 'JUSTIFY', distribute: 'DISTRIBUTE' };
      const ind = Math.round((b.indent || 0) * 100);
      let left = Math.round((b.ml || 0) * 100);
      if (ind < 0) left = Math.max(0, left + ind); // CSS 내어쓰기 → HWP 내어쓰기
      const k = {
        a: alignMap[b.align] || 'JUSTIFY', l: left, r: Math.round((b.mr || 0) * 100), i: ind,
        lh: Math.round(b.lh || 160), pv: Math.round((b.before || 0) * 100), nx: Math.round((b.after || 0) * 100),
        tab: tabPrId(b.tabs),
        ...(b.kw ? { kw: 1 } : {}),
        ...(b.pbd ? { bd: bfId({ borders: { [b.pbd.side]: { style: 'solid', width: 1, color: b.pbd.color } }, bg: null }) } : {}),
      };
      const key = JSON.stringify(k);
      if (!paraPrs.has(key)) paraPrs.set(key, { id: BASE_PARAPR + paraPrs.size, k });
      return paraPrs.get(key).id;
    };
    const bfId = (cell) => {
      const side = (s) => {
        if (!s || s.style === 'none' || s.style === 'hidden' || !s.width) return { t: 'NONE', w: '0.12 mm', c: '#000000' };
        const t = s.hwp || { solid: 'SOLID', dashed: 'DASH', dotted: 'DOT', double: 'DOUBLE_SLIM' }[s.style] || 'SOLID';
        return { t, w: s.mm ? mmToBorderMM(s.mm) : pxToBorderMM(s.width), c: (s.color || '#000000').toUpperCase() };
      };
      const b = cell ? cell.borders : null;
      const k = b ? { l: side(b.left), r: side(b.right), t: side(b.top), b: side(b.bottom), f: cell.bg ? cell.bg.toUpperCase() : null, ...(cell.bgImg && binFor(cell.bgImg) ? { im: binFor(cell.bgImg), imm: { center: 'CENTER', tile: 'TILE' }[cell.bgMode] || 'TOTAL' } : {}), ...(cell.diag ? { dg: cell.diag, dc: (cell.dgc || '#000000').toUpperCase(), dw: pxToBorderMM(cell.dgw || 1) } : {}) }
        : { l: side({ style: 'solid', width: 1 }), r: side({ style: 'solid', width: 1 }), t: side({ style: 'solid', width: 1 }), b: side({ style: 'solid', width: 1 }), f: null };
      const key = JSON.stringify(k);
      if (!borderFills.has(key)) borderFills.set(key, { id: BASE_BF + borderFills.size, k });
      return borderFills.get(key).id;
    };
    const binFor = (url) => {
      if (binByUrl.has(url)) return binByUrl.get(url);
      const d = dataURLToBytes(url);
      if (!d) return null;
      const id = 'BIN' + String(bins.length + 1).padStart(4, '0');
      bins.push({ id, ext: extFromMime(d.mime), mime: d.mime, bytes: d.bytes });
      binByUrl.set(url, id);
      return id;
    };

    const STYLE_IDS = { '바탕글': 0, '본문': 1, '개요 1': 2, '개요 2': 3, '개요 3': 4, '개요 4': 5, '개요 5': 6, '개요 6': 7, '개요 7': 8 };

    // 다단 정의
    function colPrXml(c) {
      const n = c && c.n > 1 ? c.n : 1;
      const gap = n > 1 ? Math.round(U.mm2hwp(c.gap || 8)) : 0;
      const line = n > 1 && c.line ? '<hp:colLine type="SOLID" width="0.12 mm" color="#000000"/>' : '';
      return `<hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="${n}" sameSz="1" sameGap="${gap}"${line ? `>${line}</hp:colPr>` : '/>'}`;
    }
    function paraXml(b, extraFirstRun = '') {
      const pp = paraPrId(b);
      const sid = STYLE_IDS[b.style] || 0;
      let x = `<hp:p id="${nid()}" paraPrIDRef="${pp}" styleIDRef="${sid}" pageBreak="${b.pageBreakBefore ? 1 : 0}" columnBreak="${b.colBreakBefore ? 1 : 0}" merged="0">`;
      if (extraFirstRun) x += extraFirstRun;
      else if (b.cols) x += `<hp:run charPrIDRef="0"><hp:ctrl>${colPrXml(b.cols)}</hp:ctrl></hp:run>`;
      if (b.t === 'table') {
        x += `<hp:run charPrIDRef="0">${tableXml(b)}<hp:t/></hp:run>`;
      } else {
        x += runsXml(b.runs, b.cs);
      }
      return x + '</hp:p>';
    }
    function runsXml(runs, blockStyle) {
      let x = '';
      let cur = null, buf = '';
      const flush = () => { if (cur !== null) x += `<hp:run charPrIDRef="${cur}"><hp:t>${buf}</hp:t></hp:run>`; cur = null; buf = ''; };
      let lastStyle = blockStyle || null;
      for (const r of runs) {
        if (r.img) { flush(); x += `<hp:run charPrIDRef="${charPrId(lastStyle)}">${picXml(r.img)}<hp:t/></hp:run>`; continue; }
        if (r.pageHide) { flush(); const f = r.pageHide; x += `<hp:run charPrIDRef="${charPrId(lastStyle)}"><hp:ctrl><hp:pageHiding hideHeader="${f.includes('h') ? 1 : 0}" hideFooter="${f.includes('f') ? 1 : 0}" hideMasterPage="0" hideBorder="0" hideFill="0" hidePageNum="${f.includes('p') ? 1 : 0}"/></hp:ctrl></hp:run>`; continue; }
        if (r.autoNum) { flush(); lastStyle = r; x += `<hp:run charPrIDRef="${charPrId(r)}"><hp:t>그림 </hp:t><hp:ctrl><hp:autoNum num="1" numType="${r.autoNum}"><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar="" supscript="0"/></hp:autoNum></hp:ctrl><hp:t/></hp:run>`; continue; }
        if (r.newNum) { flush(); x += `<hp:run charPrIDRef="${charPrId(lastStyle)}"><hp:ctrl><hp:newNum num="${r.newNum}" numType="PAGE"/></hp:ctrl></hp:run>`; continue; }
        if (r.shape) { flush(); x += `<hp:run charPrIDRef="${charPrId(lastStyle)}">${shapeXml(r.shape)}<hp:t/></hp:run>`; continue; }
        if (r.text != null) {
          lastStyle = r;
          const id = charPrId(r);
          if (cur !== id) { flush(); cur = id; }
          buf += textXml(r.text);
          continue;
        }
        const id = cur !== null ? cur : charPrId(lastStyle);
        if (cur !== id) { flush(); cur = id; }
        if (r.br) buf += '<hp:lineBreak/>';
        else if (r.tab) buf += `<hp:tab width="${r.w ? Math.max(1, U.px2hwp(r.w)) : 4000}" leader="0" type="1"/>`;
      }
      flush();
      if (!x) x = `<hp:run charPrIDRef="${charPrId(blockStyle)}"><hp:t/></hp:run>`;
      return x;
    }
    function textXml(s) {
      return escXml(s.replace(/ /g, ' ').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f￾￿]/g, ''));
    }
    function picXml(img) {
      const bin = binFor(img.url);
      if (!bin) return '';
      const w = U.px2hwp(img.w), hh = U.px2hwp(img.h);
      const id = nid();
      const inline = !img.wrap || img.wrap === 'inline';
      const floating = img.wrap === 'front' || img.wrap === 'behind';
      const horz = { left: 'LEFT', right: 'RIGHT', center: 'CENTER' }[img.wrap] || 'LEFT';
      const wrap = inline ? 'SQUARE' : img.wrap === 'center' ? 'TOP_AND_BOTTOM' : floating ? (img.wrap === 'front' ? 'IN_FRONT_OF_TEXT' : 'BEHIND_TEXT') : 'SQUARE';
      const posXml = posXmlOf(img);
      return `<hp:pic textWrap="${wrap}" textFlow="BOTH_SIDES" reverse="0" id="${id}" zOrder="${bins.length}" numberingType="PICTURE" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${id}">`
        + `<hp:offset x="0" y="0"/><hp:orgSz width="${w}" height="${hh}"/><hp:curSz width="${w}" height="${hh}"/><hp:flip horizontal="0" vertical="0"/>`
        + `<hp:rotationInfo angle="0" centerX="${Math.round(w / 2)}" centerY="${Math.round(hh / 2)}" rotateimage="1"/>`
        + `<hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo>`
        + (img.bd ? lineShapeXml(img.bd.color, img.bd.w, img.bd.style) : '')
        + `<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${w}" y="0"/><hc:pt2 x="${w}" y="${hh}"/><hc:pt3 x="0" y="${hh}"/></hp:imgRect>`
        + `<hp:imgClip left="0" right="${w}" top="0" bottom="${hh}"/><hp:inMargin left="0" right="0" top="0" bottom="0"/><hp:imgDim dimwidth="${w}" dimheight="${hh}"/>`
        + `<hc:img binaryItemIDRef="${bin}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/><hp:effects/>`
        + `<hp:sz width="${w}" widthRelTo="ABSOLUTE" height="${hh}" heightRelTo="ABSOLUTE" protect="0"/>`
        + posXml
        + (img.om ? outMarginOf(img) : `<hp:outMargin left="${inline || floating ? 0 : 283}" right="${inline || floating ? 0 : 283}" top="0" bottom="0"/>`)
        + (img.caption ? `<hp:caption side="${img.caption.side === 'top' ? 'TOP' : 'BOTTOM'}" fullSz="0" width="${w}" gap="850" lastWidth="${w}"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="${w}" textHeight="0" hasTextRef="0" hasNumRef="0"><hp:p id="${nid()}" paraPrIDRef="${paraPrId(img.caption.para)}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">${runsXml(img.caption.runs, img.caption.cs)}</hp:p></hp:subList></hp:caption>` : '')
        + (img.name ? `<hp:shapeComment>${escXml('그림입니다.\n원본 그림의 이름: ' + img.name)}</hp:shapeComment>` : '<hp:shapeComment/>') + '</hp:pic>';
    }
    // 배치 → textWrap / pos
    function wrapAttr(o) {
      const w = o.wrap || 'inline';
      return w === 'front' ? 'IN_FRONT_OF_TEXT' : w === 'behind' ? 'BEHIND_TEXT' : w === 'center' ? 'TOP_AND_BOTTOM' : w === 'inline' ? (o.t === 'table' ? 'TOP_AND_BOTTOM' : 'SQUARE') : 'SQUARE';
    }
    function posXmlOf(o, inlineAlign) {
      const w = o.wrap || 'inline';
      if (w === 'front' || w === 'behind') {
        // 종이 기준 위치 (쪽마다 계산)
        const pg = model.page;
        const PT = model.pitch || U.mm2px(pg.height - pg.top - pg.header - pg.bottom - pg.footer);
        const k = Math.max(0, Math.floor(o.y / PT));
        const vy = o.y - k * PT + U.mm2px(pg.top + pg.header);
        const hx = o.x + U.mm2px(pg.left);
        return `<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="0" allowOverlap="1" holdAnchorAndSO="0" vertRelTo="PAPER" horzRelTo="PAPER" vertAlign="TOP" horzAlign="LEFT" vertOffset="${Math.max(0, U.px2hwp(vy))}" horzOffset="${Math.max(0, U.px2hwp(hx))}"/>`;
      }
      const inline = w === 'inline';
      // 가로 위치를 옮긴 표 (불러온 문서): 글자처럼 취급하지 않고 단 왼쪽에서 떨어진 거리로
      if (o.t === 'table' && inline && (o.shift > 0 || o.vshift > 0)) return `<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="${o.shift > 0 ? 'LEFT' : ({ center: 'CENTER', right: 'RIGHT' }[o.align] || 'LEFT')}" vertOffset="${U.px2hwp(o.vshift || 0)}" horzOffset="${U.px2hwp(o.shift || 0)}"/>`;
      const horz = { left: 'LEFT', right: 'RIGHT', center: 'CENTER' }[inline ? inlineAlign || 'left' : w] || 'LEFT';
      return `<hp:pos treatAsChar="${inline ? 1 : 0}" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="${horz}" vertOffset="0" horzOffset="0"/>`;
    }
    function outMarginOf(o) {
      if (o.om) { const q = o.om.map((v) => Math.max(0, Math.round(U.mm2hwp(v)))); return `<hp:outMargin left="${q[3]}" right="${q[1]}" top="${q[0]}" bottom="${q[2]}"/>`; }
      const m = o.wrap === 'left' || o.wrap === 'right' || o.wrap === 'center' ? 283 : 0;
      return `<hp:outMargin left="${m}" right="${m}" top="0" bottom="0"/>`;
    }
    const LINE_STYLE = { solid: 'SOLID', dashed: 'DASH', dotted: 'DOT', double: 'DOUBLE_SLIM' };
    function lineShapeXml(color, wpx, style) {
      return `<hp:lineShape color="${(color || '#000000').toUpperCase()}" width="${Math.max(1, U.px2hwp(wpx))}" style="${LINE_STYLE[style] || 'SOLID'}" endCap="FLAT" headStyle="NORMAL" tailStyle="NORMAL" headfill="1" tailfill="1" headSz="SMALL_SMALL" tailSz="SMALL_SMALL" outlineStyle="NORMAL" alpha="0"/>`;
    }
    function shadowXml(sh) {
      if (!sh) return '<hp:shadow type="NONE" color="#B2B2B2" offsetX="0" offsetY="0" alpha="0"/>';
      const t = `PARALLEL_${sh.x >= 0 ? 'RIGHT' : 'LEFT'}${sh.y >= 0 ? 'BOTTOM' : 'TOP'}`;
      return `<hp:shadow type="${t}" color="${sh.color.toUpperCase()}" offsetX="${Math.round(U.mm2hwp(Math.abs(sh.x)))}" offsetY="${Math.round(U.mm2hwp(Math.abs(sh.y)))}" alpha="0"/>`;
    }
    function marginXml(tag, q, def) {
      const v = q ? q.map((x) => Math.max(0, Math.round(U.mm2hwp(x)))) : def;
      return `<hp:${tag} left="${v[3]}" right="${v[1]}" top="${v[0]}" bottom="${v[2]}"/>`;
    }
    // 도형·글상자
    // 묶음 안 개체로 바꾸기: id=0, groupLevel, 위치(offset·transMatrix), 끝의 sz/pos/outMargin/shapeComment 제거
    function memberize(xml, lx, ly, level) {
      const x = Math.round(U.px2hwp(lx)), y = Math.round(U.px2hwp(ly));
      return xml
        .replace(/ id="\d+"/, ' id="0"')
        .replace(/ groupLevel="\d+"/, ` groupLevel="${level}"`)
        .replace(/ textWrap="\w+" textFlow="\w+"/, '')
        .replace('<hp:offset x="0" y="0"/>', `<hp:offset x="${x}" y="${y}"/>`)
        .replace('<hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>', `<hc:transMatrix e1="1" e2="0" e3="${x}" e4="0" e5="1" e6="${y}"/>`)
        .replace(/<hp:sz [^>]*\/><hp:pos [^>]*\/><hp:outMargin [^>]*\/>(<hp:caption[\s\S]*?<\/hp:caption>)?(<hp:shapeComment\/>|<hp:shapeComment>[\s\S]*?<\/hp:shapeComment>)?(<\/hp:\w+>)$/, '$3');
    }
    // 개체 묶음 → hp:container
    function containerXml(g, level = 0) {
      const w = Math.max(1, U.px2hwp(g.w)), hh = Math.max(1, U.px2hwp(g.h));
      const id = nid();
      const members = (g.members || []).map((c) => {
        const inner = c.img ? picXml(c.img) : c.shape.kind === 'group' ? containerXml(c.shape, level + 1) : shapeXml(c.shape);
        return memberize(inner, c.lx, c.ly, level + 1);
      }).join('');
      return `<hp:container id="${id}" zOrder="${++zSeq}" numberingType="PICTURE" textWrap="${wrapAttr(g)}" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="${level}" instid="${id}">`
        + `<hp:offset x="0" y="0"/><hp:orgSz width="${w}" height="${hh}"/><hp:curSz width="${w}" height="${hh}"/><hp:flip horizontal="0" vertical="0"/>`
        + `<hp:rotationInfo angle="0" centerX="${Math.round(w / 2)}" centerY="${Math.round(hh / 2)}" rotateimage="1"/>`
        + '<hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo>'
        + members
        + `<hp:sz width="${w}" widthRelTo="ABSOLUTE" height="${hh}" heightRelTo="ABSOLUTE" protect="0"/>`
        + posXmlOf(g) + outMarginOf(g) + '<hp:shapeComment/></hp:container>';
    }
    function shapeXml(sh) {
      if (sh.kind === 'group') return containerXml(sh);
      const w = Math.max(0, U.px2hwp(sh.w)), hh = Math.max(0, U.px2hwp(sh.h));
      const id = nid();
      const tag = sh.kind === 'textbox' || sh.kind === 'rect' || sh.kind === 'roundrect' ? 'rect' : sh.kind === 'poly' ? 'polygon' : sh.kind;
      const extraAttr = tag === 'rect' ? ` ratio="${sh.kind === 'roundrect' ? 20 : 0}"` : tag === 'ellipse' ? ' intervalDirty="0" hasArcPr="0" arcType="NORMAL"' : tag === 'line' ? ' isReverseHV="0"' : '';
      const common = `<hp:offset x="0" y="0"/><hp:orgSz width="${w}" height="${hh}"/><hp:curSz width="${w}" height="${hh}"/><hp:flip horizontal="0" vertical="0"/>`
        + `<hp:rotationInfo angle="0" centerX="${Math.round(w / 2)}" centerY="${Math.round(hh / 2)}" rotateimage="1"/>`
        + '<hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo>';
      const lw = sh.sw > 0 ? Math.max(1, U.px2hwp(sh.sw)) : 0;
      const line = `<hp:lineShape color="${(sh.stroke || '#000000').toUpperCase()}" width="${lw}" style="${sh.sw > 0 ? 'SOLID' : 'NONE'}" endCap="FLAT" headStyle="${sh.ah ? 'ARROW' : 'NORMAL'}" tailStyle="${sh.at ? 'ARROW' : 'NORMAL'}" headfill="1" tailfill="1" headSz="MEDIUM_MEDIUM" tailSz="MEDIUM_MEDIUM" outlineStyle="NORMAL" alpha="0"/>`;
      const fill = sh.fill && tag !== 'line' ? `<hc:fillBrush><hc:winBrush faceColor="${sh.fill.toUpperCase()}" hatchColor="#FFFFFF" alpha="0"/></hc:fillBrush>` : '';
      const shadow = shadowXml(sh.sh);
      let text = '';
      if (sh.kind === 'textbox' || (sh.blocks && tag !== 'line')) {
        const paras = (sh.blocks && sh.blocks.length ? sh.blocks : [{ t: 'p', runs: [] }]).map((b) => paraXml(b)).join('');
        text = `<hp:drawText name="" editable="0" lastWidth="${w}"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="${sh.kind === 'textbox' ? 'TOP' : 'CENTER'}" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${paras}</hp:subList>${marginXml('textMargin', sh.im, [283, 283, 283, 283])}</hp:drawText>`;
      }
      let geo;
      if (tag === 'rect') geo = `<hc:pt0 x="0" y="0"/><hc:pt1 x="${w}" y="0"/><hc:pt2 x="${w}" y="${hh}"/><hc:pt3 x="0" y="${hh}"/>`;
      else if (tag === 'ellipse') {
        const cx = Math.round(w / 2), cy = Math.round(hh / 2);
        geo = `<hc:center x="${cx}" y="${cy}"/><hc:ax1 x="${w}" y="${cy}"/><hc:ax2 x="${cx}" y="${hh}"/><hc:start1 x="${w}" y="${cy}"/><hc:end1 x="${w}" y="${cy}"/><hc:start2 x="${w}" y="${cy}"/><hc:end2 x="${w}" y="${cy}"/>`;
      } else if (tag === 'line') {
        geo = sh.dir === 'ur' ? `<hc:startPt x="0" y="${hh}"/><hc:endPt x="${w}" y="0"/>` : `<hc:startPt x="0" y="0"/><hc:endPt x="${w}" y="${hh}"/>`;
      } else {
        const pts = (sh.pts || '0.5,0 1,1 0,1').split(/\s+/).filter(Boolean).map((p) => p.split(',').map(Number));
        geo = pts.map(([x, y]) => `<hc:pt x="${Math.round(x * w)}" y="${Math.round(y * hh)}"/>`).join('');
      }
      return `<hp:${tag}${extraAttr} id="${id}" zOrder="${++zSeq}" numberingType="NONE" textWrap="${wrapAttr(sh)}" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${id}">`
        + common + line + fill + shadow + text + geo
        + `<hp:sz width="${w}" widthRelTo="ABSOLUTE" height="${hh}" heightRelTo="ABSOLUTE" protect="0"/>`
        + posXmlOf(sh) + outMarginOf(sh) + `</hp:${tag}>`;
    }
    // 누리글 전용: 셀 배경 그림의 원본·채우기 방식을 표 설명에 적어 둠 (다시 열면 셀 크기를 바꿔도 그림 전체가 맞춰지도록)
    function bgMetaXml(t) {
      const list = t.cells.filter((c) => c.bgMeta && c.bgMeta.url && binFor(c.bgMeta.url)).map((c) => ({ r: c.r, c: c.c, m: c.bgMeta.m, f: c.bgMeta.f, g: c.bgMeta.g, b: binFor(c.bgMeta.url) }));
      return list.length ? `<hp:shapeComment>${escXml(BG_META + JSON.stringify(list))}</hp:shapeComment>` : '';
    }
    function tableXml(t) {
      const tw = t.widths.reduce((a, b) => a + b, 0);
      const W = U.px2hwp(tw), H = U.px2hwp(t.heights.reduce((a, b) => a + b, 0));
      const floating = t.wrap === 'front' || t.wrap === 'behind';
      let x = `<hp:tbl id="${nid()}" zOrder="${++zSeq}" numberingType="TABLE" textWrap="${wrapAttr(t)}" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="${floating ? 'NONE' : (t.pb || 'CELL')}" repeatHeader="0" rowCnt="${t.nr}" colCnt="${t.nc}" cellSpacing="0" borderFillIDRef="${bfId(null)}" noAdjust="0">`
        + `<hp:sz width="${W}" widthRelTo="ABSOLUTE" height="${H}" heightRelTo="ABSOLUTE" protect="0"/>`
        + posXmlOf(t, t.align)
        + outMarginOf(t) + bgMetaXml(t) + marginXml('inMargin', t.im, [141, 510, 141, 510]);
      for (let r = 0; r < t.nr; r++) {
        x += '<hp:tr>';
        for (const c of t.cells.filter((c) => c.r === r).sort((a, b) => a.c - b.c)) {
          const va = { top: 'TOP', middle: 'CENTER', bottom: 'BOTTOM' }[c.valign] || 'CENTER';
          const paras = c.blocks.map((b) => paraXml(b)).join('');
          x += `<hp:tc name="" header="0" hasMargin="${c.pad ? 1 : 0}" protect="0" editable="0" dirty="0" borderFillIDRef="${bfId(c)}">`
            + `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="${va}" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${paras}</hp:subList>`
            + `<hp:cellAddr colAddr="${c.c}" rowAddr="${c.r}"/><hp:cellSpan colSpan="${c.cs}" rowSpan="${c.rs}"/>`
            + `<hp:cellSz width="${U.px2hwp(c.w)}" height="${U.px2hwp(c.h)}"/>${c.pad ? `<hp:cellMargin left="${U.px2hwp(c.pad[3])}" right="${U.px2hwp(c.pad[1])}" top="${U.px2hwp(c.pad[0])}" bottom="${U.px2hwp(c.pad[2])}"/>` : '<hp:cellMargin left="510" right="510" top="141" bottom="141"/>'}</hp:tc>`;
        }
        x += '</hp:tr>';
      }
      return x + '</hp:tbl>';
    }

    // ---- 구역 정의(첫 문단) ----
    const pg = model.page;
    const pw = U.mm2hwp(Math.min(pg.width, pg.height)), ph = U.mm2hwp(Math.max(pg.width, pg.height));
    const landscape = pg.width > pg.height;
    let secPr = skeletonSecPr.replace(/<hp:pagePr[\s\S]*?<\/hp:pagePr>/,
      `<hp:pagePr landscape="${landscape ? 'NARROWLY' : 'WIDELY'}" width="${pw}" height="${ph}" gutterType="LEFT_ONLY">`
      + `<hp:margin header="${U.mm2hwp(pg.header)}" footer="${U.mm2hwp(pg.footer)}" gutter="0" left="${U.mm2hwp(pg.left)}" right="${U.mm2hwp(pg.right)}" top="${U.mm2hwp(pg.top)}" bottom="${U.mm2hwp(pg.bottom)}"/></hp:pagePr>`);
    let ctrls = `<hp:ctrl>${colPrXml(model.blocks[0] && model.blocks[0].cols)}</hp:ctrl>`;
    const hfXml = (kind, raw) => {
      const hf = HF.norm(raw);
      if (!hf) return '';
      const used = HF.SLOTS.filter((k) => (hf[k] || '').trim());
      const cwMM = pg.width - pg.left - pg.right;
      const single = used.length === 1;
      const para = { t: 'p', align: single ? used[0] : 'left', lh: 150, tabs: single ? null : [{ pos: cwMM / 2, type: 'C', leader: 'none' }, { pos: cwMM, type: 'R', leader: 'none' }] };
      if (hf.line) para.pbd = { side: kind === 'header' ? 'bottom' : 'top', color: hf.color };
      const pp = paraPrId(para);
      const cp = charPrId({ font: hf.font, size: hf.size, bold: hf.bold, color: hf.color });
      // 탭 너비 어림 (한글이 열 때 다시 계산함)
      const cv = document.createElement('canvas').getContext('2d');
      cv.font = `${hf.bold ? 'bold ' : ''}${hf.size}pt ${HF.fontStack(hf.font)}`;
      const wOf = (t) => cv.measureText(HF.screenText(t, 0, 1)).width;
      const cwPx = U.mm2px(cwMM);
      let x = '', pos = 0;
      const slots = single ? used : HF.SLOTS;
      slots.forEach((k, i) => {
        const t = hf[k] || '';
        if (!single && i > 0) {
          const target = i === 1 ? cwPx / 2 - wOf(t) / 2 : cwPx - wOf(t);
          const w = Math.max(1, U.px2hwp(Math.max(4, target - pos)));
          x += `<hp:run charPrIDRef="${cp}"><hp:t><hp:tab width="${w}" leader="0" type="1"/></hp:t></hp:run>`;
          pos = Math.max(pos + 4, target);
        }
        for (const part of HF.parts(t)) {
          if (part.t != null) x += `<hp:run charPrIDRef="${cp}"><hp:t>${textXml(part.t)}</hp:t></hp:run>`;
          else x += `<hp:run charPrIDRef="${cp}"><hp:ctrl><hp:autoNum num="1" numType="${part.tok === 'page' ? 'PAGE' : 'TOTAL_PAGE'}"><hp:autoNumFormat type="${PageNum.HWP_FMT[(model.pageNum && model.pageNum.fmt) || 'digit'] || 'DIGIT'}" userChar="" prefixChar="" suffixChar="" supscript="0"/></hp:autoNum></hp:ctrl><hp:t/></hp:run>`;
        }
        pos += wOf(t);
      });
      if (!x) x = `<hp:run charPrIDRef="${cp}"><hp:t/></hp:run>`;
      const inner = `<hp:p id="${nid()}" paraPrIDRef="${pp}" styleIDRef="14" pageBreak="0" columnBreak="0" merged="0">${x}</hp:p>`;
      return `<hp:ctrl><hp:${kind} id="${nid()}" applyPageType="BOTH"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="${kind === 'header' ? 'TOP' : 'BOTTOM'}" linkListIDRef="0" linkListNextIDRef="0" textWidth="${contentW}" textHeight="${U.mm2hwp(kind === 'header' ? pg.header : pg.footer)}" hasTextRef="0" hasNumRef="0">${inner}</hp:subList></hp:${kind}></hp:ctrl>`;
    };
    ctrls += hfXml('header', model.header);
    ctrls += hfXml('footer', model.footer);
    let pnRun = '';
    if (model.pageNum && model.pageNum.pos && model.pageNum.pos !== 'none') {
      const pos = model.pageNum.pos.toUpperCase().replace('-', '_');
      const pn = model.pageNum;
      pnRun = `<hp:run charPrIDRef="${charPrId({ font: pn.font || '함초롬바탕', size: pn.size || 9, bold: !!pn.bold, color: pn.color || '#000000' })}"><hp:ctrl><hp:pageNum pos="${pos}" formatType="${PageNum.HWP_FMT[pn.fmt] || 'DIGIT'}" sideChar="${(pn.deco || (pn.side ? 'side' : '')) === 'side' ? '-' : ''}"/></hp:ctrl></hp:run>`;
      if (pn.hideFirst) ctrls += '<hp:ctrl><hp:pageHiding hideHeader="0" hideFooter="0" hideMasterPage="0" hideBorder="0" hideFill="0" hidePageNum="1"/></hp:ctrl>';
      if (pn.start > 1) secPr = secPr.replace(/(<hp:startNum [^>]*page=")\d+(")/, `$1${pn.start}$2`);
    }
    const firstRun = `<hp:run charPrIDRef="0">${secPr}${ctrls}</hp:run>${pnRun}`;
    // 같은 문단에 붙어 있던 표는 앞 표의 문단 안에 이어 적음 (한글 쪽 배치 유지)
    // (앞 표와 이 표 사이에 빈 문단만 있으면 그 빈 문단은 표 문단 뒤에 그대로 둠 — 한글에서 첫 표 아래 빈 줄로 보이는 모양)
    let body = '';
    let anchorEnd = -1;
    const emptyP = (b) => b.t === 'p' && !(b.runs && b.runs.length) && !b.pageBreakBefore && !b.colBreakBefore && !b.cols;
    model.blocks.forEach((b, i) => {
      if (b.tend && emptyP(b) && anchorEnd >= 0) return; // 표 문단의 끝 표시 = 표 문단 자체
      if (b.t === 'table' && b.samepara && anchorEnd >= 0) {
        const at = anchorEnd - '</hp:p>'.length;
        const ins = `<hp:run charPrIDRef="0">${tableXml(b)}<hp:t/></hp:run>`;
        body = body.slice(0, at) + ins + body.slice(at);
        anchorEnd += ins.length;
        return;
      }
      body += paraXml(b, i === 0 ? firstRun : '');
      if (b.t === 'table' && body.endsWith('<hp:t/></hp:run></hp:p>')) anchorEnd = body.length;
      else if (!emptyP(b)) anchorEnd = -1;
    });
    const section = xmlDecl + secRootOpen + body + '</hs:sec>';

    // ---- header.xml ----
    let header = T['Contents/header.xml'];
    const fontXml = (id, face) => `<hh:font id="${id}" face="${escXml(face)}" type="TTF" isEmbedded="0"><hh:typeInfo familyType="FCAT_GOTHIC" weight="6" proportion="4" contrast="0" strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/></hh:font>`;
    const extraFonts = fonts.slice(DEFAULT_FONTS.length).map((f, i) => fontXml(DEFAULT_FONTS.length + i, f)).join('');
    header = header.replace(/<hh:fontface lang="(\w+)" fontCnt="\d+">([\s\S]*?)<\/hh:fontface>/g,
      (m, lang, inner) => `<hh:fontface lang="${lang}" fontCnt="${fonts.length}">${inner}${extraFonts}</hh:fontface>`);
    const bfXml = [...borderFills.values()].map(({ id, k }) => {
      const s = (tag, v) => `<hh:${tag} type="${v.t}" width="${v.w}" color="${v.c}"/>`;
      const up = k.dg === 'up' || k.dg === 'both', down = k.dg === 'down' || k.dg === 'both';
      return `<hh:borderFill id="${id}" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0"><hh:slash type="${up ? 'CENTER' : 'NONE'}" Crooked="0" isCounter="0"/><hh:backSlash type="${down ? 'CENTER' : 'NONE'}" Crooked="0" isCounter="0"/>`
        + s('leftBorder', k.l) + s('rightBorder', k.r) + s('topBorder', k.t) + s('bottomBorder', k.b)
        + (k.dg ? `<hh:diagonal type="SOLID" width="${k.dw}" color="${k.dc}"/>` : '<hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/>')
        + (k.f || k.im ? '<hc:fillBrush>' + (k.f ? `<hc:winBrush faceColor="${k.f}" hatchColor="#999999" alpha="0"/>` : '')
          + (k.im ? `<hc:imgBrush mode="${k.imm}"><hc:img binaryItemIDRef="${k.im}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/></hc:imgBrush>` : '') + '</hc:fillBrush>' : '')
        + '</hh:borderFill>';
    }).join('');
    header = header.replace(/<hh:borderFills itemCnt="(\d+)">([\s\S]*?)<\/hh:borderFills>/,
      (m, n, inner) => `<hh:borderFills itemCnt="${+n + borderFills.size}">${inner}${bfXml}</hh:borderFills>`);
    const cpXml = [...charPrs.values()].map(({ id, k }) => {
      const all = (v) => `hangul="${v}" latin="${v}" hanja="${v}" japanese="${v}" other="${v}" symbol="${v}" user="${v}"`;
      return `<hh:charPr id="${id}" height="${k.s}" textColor="${k.c}" shadeColor="${k.h}" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="${k.bf || 2}">`
        + `<hh:fontRef ${all(k.f)}/><hh:ratio ${all(k.rt || 100)}/><hh:spacing ${all(k.sp)}/><hh:relSz ${all(100)}/><hh:offset ${all(0)}/>`
        + (k.i ? '<hh:italic/>' : '') + (k.b ? '<hh:bold/>' : '')
        + `<hh:underline type="${k.u ? 'BOTTOM' : 'NONE'}" shape="SOLID" color="${k.c}"/>`
        + `<hh:strikeout shape="${k.x ? 'SOLID' : 'NONE'}" color="${k.c}"/>`
        + `<hh:outline type="${k.ol ? 'SOLID' : 'NONE'}"/><hh:shadow type="${k.sh ? 'DROP' : 'NONE'}" color="${k.sh || '#C0C0C0'}" offsetX="10" offsetY="10"/>`
        + (k.p ? '<hh:supscript/>' : '') + (k.d ? '<hh:subscript/>' : '')
        + '</hh:charPr>';
    }).join('');
    header = header.replace(/<hh:charProperties itemCnt="(\d+)">([\s\S]*?)<\/hh:charProperties>/,
      (m, n, inner) => `<hh:charProperties itemCnt="${+n + charPrs.size}">${inner}${cpXml}</hh:charProperties>`);
    const ppXml = [...paraPrs.values()].map(({ id, k }) => {
      const margin = (f) => `<hh:margin><hc:intent value="${k.i * f}" unit="HWPUNIT"/><hc:left value="${k.l * f}" unit="HWPUNIT"/><hc:right value="${k.r * f}" unit="HWPUNIT"/><hc:prev value="${k.pv * f}" unit="HWPUNIT"/><hc:next value="${k.nx * f}" unit="HWPUNIT"/></hh:margin><hh:lineSpacing type="PERCENT" value="${k.lh}" unit="HWPUNIT"/>`;
      return `<hh:paraPr id="${id}" tabPrIDRef="${k.tab || 0}" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0" textDir="LTR">`
        + `<hh:align horizontal="${k.a}" vertical="BASELINE"/><hh:heading type="NONE" idRef="0" level="0"/>`
        + `<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="${k.kw ? 'KEEP_WORD' : 'BREAK_WORD'}" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>`
        + '<hh:autoSpacing eAsianEng="0" eAsianNum="0"/>'
        + `<hp:switch><hp:case hp:required-namespace="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar">${margin(1)}</hp:case><hp:default>${margin(2)}</hp:default></hp:switch>`
        + `<hh:border borderFillIDRef="${k.bd || 2}" offsetLeft="0" offsetRight="0" offsetTop="${k.bd ? 100 : 0}" offsetBottom="${k.bd ? 100 : 0}" connect="0" ignoreMargin="0"/></hh:paraPr>`;
    }).join('');
    header = header.replace(/<hh:paraProperties itemCnt="(\d+)">([\s\S]*?)<\/hh:paraProperties>/,
      (m, n, inner) => `<hh:paraProperties itemCnt="${+n + paraPrs.size}">${inner}${ppXml}</hh:paraProperties>`);

    if (tabPrs.size) {
      const tpXml = [...tabPrs.values()].map(({ id, items }) => `<hh:tabPr id="${id}" autoTabLeft="0" autoTabRight="0">${items.map((t) => `<hh:tabItem pos="${t.pos}" type="${t.type}" leader="${t.leader}"/>`).join('')}</hh:tabPr>`).join('');
      header = header.replace(/<hh:tabProperties itemCnt="(\d+)">([\s\S]*?)<\/hh:tabProperties>/,
        (m, n, inner) => `<hh:tabProperties itemCnt="${+n + tabPrs.size}">${inner}${tpXml}</hh:tabProperties>`);
    }

    // ---- content.hpf ----
    const now = new Date();
    const iso = now.toISOString().replace(/\.\d+Z$/, 'Z');
    let hpf = T['Contents/content.hpf']
      .replace('<opf:title/>', `<opf:title>${escXml(meta.title || '')}</opf:title>`)
      .replace(/synthetic-fixture-author/g, escXml(meta.author || '누리글'))
      .replace(/(<opf:meta name="CreatedDate" content="text">)[^<]*/, `$1${meta.created || iso}`)
      .replace(/(<opf:meta name="ModifiedDate" content="text">)[^<]*/, `$1${iso}`)
      .replace(/(<opf:meta name="date" content="text">)[^<]*/, `$1${escXml(todayKorean(true))}`);
    const binItems = bins.map((b) => `<opf:item id="${b.id}" href="BinData/${b.id}.${b.ext}" media-type="${b.mime}" isEmbeded="1"/>`).join('');
    hpf = hpf.replace('</opf:manifest>', binItems + '</opf:manifest>');

    // ---- 압축 ----
    const zip = new JSZip();
    zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });
    zip.file('version.xml', T['version.xml']);
    zip.file('Contents/header.xml', header);
    zip.file('Contents/section0.xml', section);
    zip.file('Contents/content.hpf', hpf);
    zip.file('settings.xml', T['settings.xml']);
    zip.file('META-INF/container.xml', T['META-INF/container.xml']);
    zip.file('META-INF/container.rdf', T['META-INF/container.rdf']);
    zip.file('META-INF/manifest.xml', T['META-INF/manifest.xml']);
    zip.file('Preview/PrvText.txt', Model.plainText(model.blocks).slice(0, 1024));
    zip.file('Preview/PrvImage.png', T['Preview/PrvImage.png#b64'], { base64: true });
    for (const b of bins) zip.file(`BinData/${b.id}.${b.ext}`, b.bytes);
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 }, mimeType: 'application/hwp+zip' });
  }

  function pxToBorderMM(px) {
    let mm;
    if (px <= 1.01) mm = 0.12;
    else {
      const target = px * 25.4 / 96;
      mm = BORDER_MM.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
    }
    return (mm === 1 || mm === 2 || mm === 3 || mm === 4 || mm === 5 ? mm.toFixed(1) : String(mm)) + ' mm';
  }
  // 한글이 쓰는 굵기 가운데 가장 가까운 값
  function mmToBorderMM(mm) {
    const v = BORDER_MM.reduce((a, b) => (Math.abs(b - mm) < Math.abs(a - mm) ? b : a));
    return (Number.isInteger(v) ? v.toFixed(1) : String(v)) + ' mm';
  }
  function borderMMToPx(s) {
    const mm = parseFloat(s) || 0.12;
    if (mm < 0.3) return 1;
    return Math.max(1, Math.round(mm * 96 / 25.4 * 2) / 2);
  }

  // =================== 읽기 ===================
  const kids = (el, name) => el ? Array.from(el.children).filter((c) => c.localName === name) : [];
  const kid = (el, name) => el ? Array.from(el.children).find((c) => c.localName === name) || null : null;
  const desc = (el, name) => el ? Array.from(el.getElementsByTagNameNS('*', name)) : [];
  const num = (v, d = 0) => (v == null || v === '' ? d : +v);

  async function read(bytes) {
    const zip = await JSZip.loadAsync(bytes);
    const txt = async (p) => { const f = zip.file(p); return f ? f.async('string') : null; };
    const parse = (s) => new DOMParser().parseFromString(s, 'application/xml');
    // 매니페스트
    let hpfPath = 'Contents/content.hpf';
    const container = await txt('META-INF/container.xml');
    if (container) {
      const rf = desc(parse(container).documentElement, 'rootfile').find((r) => /hpf$/i.test(r.getAttribute('full-path') || ''));
      if (rf) hpfPath = rf.getAttribute('full-path');
    }
    const hpfText = await txt(hpfPath);
    if (!hpfText) throw new Error('HWPX 구조를 찾을 수 없습니다 (content.hpf 없음).');
    const hpf = parse(hpfText);
    const items = {};
    desc(hpf.documentElement, 'item').forEach((it) => { items[it.getAttribute('id')] = { href: it.getAttribute('href'), type: it.getAttribute('media-type') }; });
    const title = (desc(hpf.documentElement, 'title')[0] || {}).textContent || '';
    let sectionPaths = desc(hpf.documentElement, 'itemref').map((r) => items[r.getAttribute('idref')]).filter((x) => x && /section/i.test(x.href)).map((x) => x.href);
    if (!sectionPaths.length) sectionPaths = Object.keys(zip.files).filter((f) => /^Contents\/section\d+\.xml$/i.test(f)).sort();
    const headerPath = (Object.values(items).find((x) => /header\.xml$/i.test(x.href)) || { href: 'Contents/header.xml' }).href;
    const head = parse(await txt(headerPath) || '<x/>');
    const ctx = await readHeader(head.documentElement);
    ctx.zip = zip;
    ctx.items = items;
    ctx.images = {};
    ctx.settings = { header: null, footer: null, pageNum: null, baseFont: App.defaultFont, baseSize: App.defaultSize };
    ctx.page = null;
    // 그림 미리 로드
    for (const [id, it] of Object.entries(items)) {
      if (/^image\//.test(it.type || '') || /\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(it.href)) {
        const f = zip.file(it.href) || zip.file(it.href.replace(/^\.?\//, ''));
        if (f) {
          const b = await f.async('uint8array');
          ctx.images[id] = bytesToDataURL(b, it.type && it.type.startsWith('image/') ? it.type : mimeFromName(it.href));
        }
      }
    }
    let html = '';
    let first = true;
    for (const sp of sectionPaths) {
      const s = await txt(sp);
      if (!s) continue;
      const sec = parse(s).documentElement;
      if (!first) html += '<div class="pagebreak" contenteditable="false"></div>';
      html += paragraphsHtml(kids(sec, 'p'), ctx, first);
      first = false;
    }
    if (ctx.settings.pageNum) {
      if (ctx.pnStart > 0) ctx.settings.pageNum.start = ctx.pnStart;
      if (ctx.pnHide) ctx.settings.pageNum.hideFirst = true;
    }
    return { html: groupColumns(html), page: ctx.page, settings: ctx.settings, title };
  }

  async function readHeader(root) {
    const ctx = { fonts: {}, charPr: {}, paraPr: {}, borderFill: {}, styles: {}, tabPr: {}, numberings: {}, bullets: {}, numState: {}, outlineId: '1' };
    // 문단 번호 정의 (수준별 모양 "^1." 과 번호 형식)
    desc(root, 'numbering').forEach((n) => {
      const heads = {};
      kids(n, 'paraHead').forEach((h) => { heads[num(h.getAttribute('level'), 1)] = { text: h.textContent || '', fmt: h.getAttribute('numFormat') || 'DIGIT', start: num(h.getAttribute('start'), 1) }; });
      ctx.numberings[n.getAttribute('id')] = heads;
    });
    desc(root, 'bullet').forEach((b) => { ctx.bullets[b.getAttribute('id')] = b.getAttribute('char') || ''; });
    // 탭 정의 (hp:switch 안에 있으면 hp:case 값, 없으면 hp:default 값의 절반)
    const rT = Object.fromEntries(Object.entries(TabStops.HWP_TYPE).map(([k, v]) => [v, k]));
    const rL = Object.fromEntries(Object.entries(TabStops.HWP_LEADER).map(([k, v]) => [v, k]));
    desc(root, 'tabPr').forEach((tp) => {
      let items = kids(tp, 'tabItem'), f = 1;
      if (!items.length) {
        const sw = kid(tp, 'switch');
        const cs = sw && kid(sw, 'case'), df = sw && kid(sw, 'default');
        if (cs && kids(cs, 'tabItem').length) items = kids(cs, 'tabItem');
        else if (df) { items = kids(df, 'tabItem'); f = 0.5; }
      }
      if (!items.length) return;
      ctx.tabPr[tp.getAttribute('id')] = items.map((t) => ({
        pos: Math.round(U.hwp2mm(num(t.getAttribute('pos')) * f) * 10) / 10,
        type: rT[t.getAttribute('type')] || 'L',
        leader: rL[t.getAttribute('leader')] || (t.getAttribute('leader') && t.getAttribute('leader') !== 'NONE' ? 'solid' : 'none'),
      }));
    });
    const hangul = desc(root, 'fontface').find((f) => f.getAttribute('lang') === 'HANGUL') || desc(root, 'fontface')[0];
    if (hangul) kids(hangul, 'font').forEach((f) => (ctx.fonts[f.getAttribute('id')] = f.getAttribute('face')));
    desc(root, 'charPr').forEach((c) => {
      const fr = kid(c, 'fontRef');
      const ul = kid(c, 'underline'), so = kid(c, 'strikeout'), sp = kid(c, 'spacing');
      const shade = c.getAttribute('shadeColor');
      ctx.charPr[c.getAttribute('id')] = {
        font: ctx.fonts[fr ? fr.getAttribute('hangul') : '0'] || null,
        size: num(c.getAttribute('height'), 1000) / 100,
        color: c.getAttribute('textColor') || '#000000',
        shade: shade && shade !== 'none' && !/^#?FFFFFFFF$/i.test(shade) ? shade : null,
        bold: !!kid(c, 'bold'), italic: !!kid(c, 'italic'),
        underline: !!ul && ul.getAttribute('type') !== 'NONE',
        strike: !!so && /^(SOLID|DASH|DOT|DASH_DOT|DASH_DOT_DOT|LONG_DASH|CIRCLE|DOUBLE_SLIM|SLIM_THICK|THICK_SLIM|SLIM_THICK_SLIM|WAVE|DOUBLE_WAVE|DOUBLEWAVE)$/.test(so.getAttribute('shape') || ''), // 한글은 취소선 없음을 shape="3D"로 적기도 함
        sup: !!kid(c, 'supscript'), sub: !!kid(c, 'subscript'),
        spacing: sp ? num(sp.getAttribute('hangul')) : 0,
        ratio: (() => { const r = kid(c, 'ratio'); return r ? num(r.getAttribute('hangul'), 100) : 100; })(),
        outline: (() => { const o = kid(c, 'outline'); return !!o && o.getAttribute('type') && o.getAttribute('type') !== 'NONE'; })(),
        shadow: (() => { const o = kid(c, 'shadow'); return o && o.getAttribute('type') && o.getAttribute('type') !== 'NONE' ? o.getAttribute('color') || '#999999' : null; })(),
        bfRef: c.getAttribute('borderFillIDRef'),
      };
    });
    desc(root, 'paraPr').forEach((p) => {
      const al = kid(p, 'align');
      let margin = null, ls = null;
      const sw = kid(p, 'switch');
      let factor = 1;
      if (sw) {
        const cs = kid(sw, 'case');
        const df = kid(sw, 'default');
        if (cs && kid(cs, 'margin')) { margin = kid(cs, 'margin'); ls = kid(cs, 'lineSpacing'); }
        else if (df) { margin = kid(df, 'margin'); ls = kid(df, 'lineSpacing'); factor = 0.5; }
      }
      if (!margin) { margin = kid(p, 'margin'); ls = ls || kid(p, 'lineSpacing'); }
      const mv = (n) => { const e = kid(margin, n); return e ? num(e.getAttribute('value')) * factor : 0; };
      ctx.paraPr[p.getAttribute('id')] = {
        align: (al && al.getAttribute('horizontal')) || 'JUSTIFY',
        indent: mv('intent'), left: mv('left'), right: mv('right'), prev: mv('prev'), next: mv('next'),
        lsType: ls ? ls.getAttribute('type') : 'PERCENT', ls: ls ? num(ls.getAttribute('value'), 160) : 160,
        tabs: ctx.tabPr[p.getAttribute('tabPrIDRef')] || null,
        bf: (desc(p, 'border')[0] || { getAttribute: () => null }).getAttribute('borderFillIDRef'),
        kw: (() => { const bs = kid(p, 'breakSetting'); return !!bs && bs.getAttribute('breakNonLatinWord') === 'KEEP_WORD'; })(),
        heading: (() => { const hd = kid(p, 'heading'); const t = hd && hd.getAttribute('type'); return t && t !== 'NONE' ? { type: t, id: hd.getAttribute('idRef'), level: num(hd.getAttribute('level'), 0) } : null; })(),
      };
    });
    desc(root, 'borderFill').forEach((b) => {
      const side = (n) => { const e = kid(b, n); return e ? { type: e.getAttribute('type'), width: e.getAttribute('width'), color: e.getAttribute('color') } : null; };
      const wb = desc(b, 'winBrush')[0];
      const face = wb ? wb.getAttribute('faceColor') : null;
      const ib = desc(b, 'imgBrush')[0];
      const ibImg = ib && desc(ib, 'img')[0];
      ctx.borderFill[b.getAttribute('id')] = {
        left: side('leftBorder'), right: side('rightBorder'), top: side('topBorder'), bottom: side('bottomBorder'),
        fill: face && face !== 'none' && !/^#?FFFFFFFF$/i.test(face) ? face : null,
        img: ibImg ? { ref: ibImg.getAttribute('binaryItemIDRef'), mode: ib.getAttribute('mode') || 'TOTAL' } : null,
        diag: (() => {
          const sl = kid(b, 'slash'), bs = kid(b, 'backSlash');
          const up = sl && sl.getAttribute('type') && sl.getAttribute('type') !== 'NONE';
          const down = bs && bs.getAttribute('type') && bs.getAttribute('type') !== 'NONE';
          if (!up && !down) return null;
          const dg = kid(b, 'diagonal');
          // 한글은 대각선 모양(hh:diagonal)이 없거나 NONE이면 대각선을 그리지 않음
          if (!dg || !dg.getAttribute('type') || dg.getAttribute('type') === 'NONE') return null;
          return { dir: up && down ? 'both' : up ? 'up' : 'down', color: (dg && dg.getAttribute('color')) || '#000000', width: borderMMToPx(dg && dg.getAttribute('width')) };
        })(),
      };
    });
    desc(root, 'style').forEach((s) => (ctx.styles[s.getAttribute('id')] = s.getAttribute('name')));
    // 글자 테두리: charPr의 borderFill에 선이 있으면
    for (const cp of Object.values(ctx.charPr)) {
      const bf = ctx.borderFill[cp.bfRef];
      const side = bf && [bf.top, bf.right, bf.bottom, bf.left].find((x) => x && x.type && x.type !== 'NONE');
      cp.border = side ? side.color || '#000000' : null;
    }
    return ctx;
  }

  function charCss(cp) {
    if (!cp) return '';
    const s = [];
    if (cp.font && cp.font !== App.defaultFont) s.push(`font-family:${fontStack(cp.font).replace(/"/g, "'")}`);
    if (cp.size && cp.size !== App.defaultSize) s.push(`font-size:${cp.size}pt`);
    if (cp.bold) s.push('font-weight:bold');
    if (cp.italic) s.push('font-style:italic');
    const deco = [cp.underline && 'underline', cp.strike && 'line-through'].filter(Boolean);
    if (deco.length) s.push(`text-decoration:${deco.join(' ')}`);
    if (cp.color && !/^#0{6}$/i.test(cp.color)) s.push(`color:${cp.color}`);
    if (cp.shade) s.push(`background-color:${cp.shade}`);
    if (cp.sup || cp.sub) {
      const i = s.findIndex((x) => x.startsWith('font-size'));
      if (i >= 0) s.splice(i, 1);
      s.push(`vertical-align:${cp.sup ? 'super' : 'sub'};font-size:${Math.round((cp.size || 10) * 0.7 * 2) / 2}pt`);
    }
    if (cp.spacing) s.push(`letter-spacing:${cp.spacing / 100}em`);
    if (cp.ratio && cp.ratio !== 100) s.push(`--hr:${Math.max(50, Math.min(200, cp.ratio))}`);
    if (cp.shadow) s.push(`text-shadow:0.08em 0.08em 0 ${cp.shadow}`);
    if (cp.outline) s.push('-webkit-text-stroke:0.035em currentColor;-webkit-text-fill-color:transparent');
    if (cp.border) s.push(`border:1px solid ${cp.border};padding:0 1px;box-decoration-break:clone`);
    return s.join(';');
  }
  function paraAttrs(pp, styleName) {
    const s = [];
    let cls = '';
    if (pp) {
      const a = { LEFT: 'left', RIGHT: 'right', CENTER: 'center', JUSTIFY: '', DISTRIBUTE: '', DISTRIBUTE_SPACE: '' }[pp.align];
      if (a) s.push(`text-align:${a}`);
      if (pp.align === 'DISTRIBUTE' || pp.align === 'DISTRIBUTE_SPACE') cls = 'align-distribute';
      const pt = (v) => Math.round(v) / 100;
      let left = pp.left;
      if (pp.indent < 0) left += -pp.indent;
      if (left) s.push(`margin-left:${pt(left)}pt`);
      if (pp.right) s.push(`margin-right:${pt(pp.right)}pt`);
      if (pp.indent) s.push(`text-indent:${pt(pp.indent)}pt`);
      if (pp.prev) s.push(`padding-top:${pt(pp.prev)}pt`);
      if (pp.next) s.push(`padding-bottom:${pt(pp.next)}pt`);
      if (pp.lsType === 'PERCENT' && pp.ls !== 160) s.push(`line-height:${pp.ls / 100}`);
      else if (pp.lsType && pp.lsType !== 'PERCENT' && pp.ls) s.push(`line-height:${Math.round(U.hwp2px(pp.ls) * 10) / 10}px`);
    }
    let attr = '';
    if (s.length) attr += ` style="${s.join(';')}"`;
    if (cls) attr += ` class="${cls}"`;
    // 파일에서 온 스타일 이름은 이름만 기억 (누리글 스타일의 글자 크기·들여쓰기를 덧씌우지 않음)
    if (styleName && STYLES.includes(styleName) && styleName !== '바탕글') attr += ` data-style="${styleName}" data-sfile=""`;
    if (pp && pp.tabs && pp.tabs.length) attr += ` data-tabs="${TabStops.serialize(pp.tabs)}"`;
    if (pp && pp.kw) attr += ' data-kw=""';
    return attr;
  }

  function paragraphsHtml(ps, ctx, isTop) {
    let html = '';
    ps.forEach((p, idx) => {
      const pp = ctx.paraPr[p.getAttribute('paraPrIDRef')];
      const styleName = ctx.styles[p.getAttribute('styleIDRef')];
      if (isTop && idx > 0 && p.getAttribute('pageBreak') === '1') html += '<div class="pagebreak" contenteditable="false"></div>';
      if (isTop) {
        // 다단 정의·단 나누기 표시 (read() 끝에서 div.cols로 묶음)
        for (const run of kids(p, 'run')) for (const c of kids(run, 'ctrl')) for (const cp of kids(c, 'colPr')) {
          const n = num(cp.getAttribute('colCount'), 1);
          const gap = Math.round(U.hwp2mm(num(cp.getAttribute('sameGap'), 0)) * 10) / 10;
          const line = kid(cp, 'colLine');
          html += `<div data-colmark="${n}" data-gap="${gap || 8}" data-line="${line && line.getAttribute('type') !== 'NONE' ? 1 : 0}"></div>`;
        }
        if (p.getAttribute('columnBreak') === '1') html += '<div class="colbreak" contenteditable="false"></div>';
      }
      let attrs = paraAttrs(pp, styleName);
      // 문단 글자 크기 = 그 문단에서 가장 큰 글자 (한글은 줄 높이를 실제 글자 크기로 계산.
      // 기본 10pt 그대로 두면 8pt 글자만 있는 줄도 10pt 줄 높이가 되어 표·문서가 길어짐)
      {
        let mx = 0, last = 0, mxFont = null, lastFont = null;
        for (const run of kids(p, 'run')) {
          const cp = ctx.charPr[run.getAttribute('charPrIDRef')];
          if (!cp || cp.sup || cp.sub) continue;
          last = cp.size || 10; lastFont = cp.font || null;
          if (Array.from(run.children).some((x) => (x.localName === 't' && textOf(x)) || x.localName === 'tab') && last > mx) { mx = last; mxFont = lastFont; }
        }
        const sz = mx || last;
        const pst = [];
        if (sz && Math.abs(sz - 10) > 0.05) pst.push(`font-size:${sz}pt`);
        // 문단 글꼴도 그 문단의 (가장 큰) 글자 글꼴로: 문단 기본 글꼴과 글자 글꼴의 기준선 위치가 다르면 줄 높이가 1~2px씩 커짐
        const pf = mx ? mxFont : lastFont;
        if (pf && pf !== App.defaultFont) pst.push(`font-family:${fontStack(pf).replace(/"/g, "'")}`);
        if (pst.length) attrs = attrs.includes(' style="') ? attrs.replace(' style="', ` style="${pst.join(';')};`) : ` style="${pst.join(';')}"` + attrs;
      }
      let cur = '';
      let hasContent = false;
      const out = [];
      const flushPara = (force) => {
        if (hasContent || force) out.push(`<p${attrs}>${keepSpaces(cur) || '<br>'}</p>`);
        cur = ''; hasContent = false;
      };
      let lastCp = null;
      let tblInPara = 0;
      // 문단 번호·글머리표: 번호를 글자로 넣음 (한글의 자동 번호 모양 그대로 보이게)
      const head = headText(pp && pp.heading, ctx);
      if (head) {
        const r0 = kids(p, 'run')[0];
        const css0 = charCss(r0 && ctx.charPr[r0.getAttribute('charPrIDRef')]);
        cur += (css0 ? `<span style="${css0}">` : '') + escHtml(head) + '&nbsp;' + (css0 ? '</span>' : '');
        hasContent = true;
      }
      // 한글이 단어 가운데서 줄을 바꾼 자리(lineseg textpos)에 줄바꿈 가능 표시(ZWSP)를 넣어 같은 자리에서 줄이 바뀌게 함
      // (글자만 있는 문단에서만 — 저장할 때 ZWSP는 지워짐)
      let brk = null, off = 0;
      {
        const runs = kids(p, 'run');
        const plainOnly = runs.every((r) => Array.from(r.children).every((c) => c.localName === 't' && !c.children.length));
        const lsa = kids(p, 'linesegarray')[0];
        if (plainOnly && lsa) {
          const plain = runs.map((r) => Array.from(r.children).map((c) => c.textContent).join('')).join('');
          const set = new Set();
          for (const ls of kids(lsa, 'lineseg')) {
            const q = +ls.getAttribute('textpos');
            if (q > 0 && q < plain.length && /\S/.test(plain[q - 1]) && /\S/.test(plain[q])) set.add(q);
          }
          if (set.size) brk = set;
        }
      }
      // 한글이 저장해 둔 줄 나눔 자리(lineseg)를 기억: 글이 그대로인 동안 누리글도 같은 자리에서만 줄을 바꿈 (LineLock)
      if (!head) {
        const runs = kids(p, 'run');
        const chars = [];
        let ok = runs.length > 0;
        for (const r of runs) {
          for (const c of Array.from(r.children)) {
            if (c.localName !== 't') { ok = false; break; }
            for (const n of Array.from(c.childNodes)) {
              if (n.nodeType === 3) chars.push(...n.nodeValue);
              else if (n.localName === 'lineBreak') chars.push('\n');
              else { ok = false; break; }
            }
          }
          if (!ok) break;
        }
        const lsa = kids(p, 'linesegarray')[0];
        const segs = lsa ? kids(lsa, 'lineseg').map((ls) => +ls.getAttribute('textpos')) : [];
        if (ok && segs.length > 1) {
          const offs = [];
          for (const q of segs) {
            if (!(q > 0 && q < chars.length) || chars[q - 1] === '\n') continue;
            let nl = 0;
            for (let x = 0; x < q; x++) if (chars[x] === '\n') nl++;
            offs.push(q - nl);
          }
          if (offs.length) attrs += ` data-hl="${offs.join(',')}" data-hh="${textHash(chars.filter((c) => c !== '\n').join(''))}"`;
        }
      }
      for (const run of kids(p, 'run')) {
        const cp = ctx.charPr[run.getAttribute('charPrIDRef')];
        lastCp = cp;
        const css = charCss(cp);
        const baseAttr = cp && (cp.sup || cp.sub) ? ` data-base-size="${cp.size || 10}"` : '';
        const wrap = (inner) => (css && inner ? `<span style="${css}"${baseAttr}>${inner}</span>` : inner);
        for (const node of Array.from(run.children)) {
          const n = node.localName;
          if (n === 't') {
            let inner;
            if (brk) {
              const raw = node.textContent;
              let t2 = '';
              for (let q = 0; q < raw.length; q++) { if (brk.has(off + q)) t2 += '\u200b'; t2 += raw[q]; }
              off += raw.length;
              inner = escHtml(t2);
            } else inner = textOf(node);
            if (inner) { cur += wrap(inner); hasContent = true; }
          } else if (n === 'tab') { cur += wrap('\t'); hasContent = true; }
          else if (n === 'lineBreak') { cur += '<br>'; hasContent = true; }
          else if (n === 'tbl') {
            flushPara(false);
            // 한 문단에 붙은 두 번째 이후 표 (앞 표가 여러 쪽에 걸치면 한글은 다음 쪽에서 시작)
            let th = tableHtml(node, ctx, pp);
            if (tblInPara++ && !cur) {
              th = th.replace('<table', '<table data-samepara="1"');
              // 한글: 같은 문단의 둘째 표는 다음 쪽으로 넘어가고, 문단 끝 표시는 첫 표 바로 아래에 보임
              const ecss = charCss(lastCp);
              out.push(`<p${attrs} data-tend="">${ecss ? `<span style="${ecss}"><br></span>` : '<br>'}</p>`);
            }
            out.push(th);
          } else if (n === 'pic') {
            cur += picHtml(node, ctx);
            hasContent = true;
          } else if (n === 'secPr') readSecPr(node, ctx);
          else if (n === 'ctrl') {
            readCtrl(node, ctx);
            const nn = kids(node, 'newNum').find((x) => (x.getAttribute('numType') || 'PAGE') === 'PAGE');
            if (nn) { cur += `<span class="pnnew" contenteditable="false" data-start="${Math.max(1, num(nn.getAttribute('num'), 1))}"></span>`; }
            const ph = kids(node, 'pageHiding')[0];
            if (ph && !kids(run, 'secPr').length) {
              const f = (ph.getAttribute('hidePageNum') === '1' ? 'p' : '') + (ph.getAttribute('hideHeader') === '1' ? 'h' : '') + (ph.getAttribute('hideFooter') === '1' ? 'f' : '');
              if (f) cur += `<span class="pnhide" contenteditable="false" data-hide="${f}" data-label="감추기: ${[f.includes('p') && '쪽 번호', f.includes('h') && '머리말', f.includes('f') && '꼬리말'].filter(Boolean).join('·')}"></span>`;
            }
          }
          else if (n === 'rect' || n === 'ellipse' || n === 'polygon' || n === 'line') {
            cur += shapeHtml(node, ctx);
            hasContent = true;
          } else if (n === 'container' && kids(node, 'curSz').length) {
            cur += groupHtml(node, ctx);
            hasContent = true;
          } else if (n === 'container') {
            // 도형 안 글상자 텍스트 살리기
            const sub = desc(node, 'subList')[0];
            if (sub) { flushPara(false); out.push(paragraphsHtml(kids(sub, 'p'), ctx, false)); }
            desc(node, 'pic').forEach((pic) => { cur += picHtml(pic, ctx); hasContent = true; });
          }
        }
      }
      // 빈 문단은 글자 크기를 살려 빈 줄 높이 유지
      if (!out.length || hasContent) {
        if (!hasContent) {
          const css = charCss(lastCp);
          if (css) cur = `<span style="${css}"><br></span>`;
        }
        flushPara(true);
      }
      html += out.join('');
    });
    return html;
  }
  // 번호 모양
  function fmtNum(n, f) {
    const cyc = (arr) => arr[(n - 1) % arr.length];
    const circ = (base, max) => (n >= 1 && n <= max ? String.fromCharCode(base + n - 1) : String(n));
    const roman = (v) => { let r = ''; for (const [a, b] of [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (v >= a) { r += b; v -= a; } return r; };
    const latin = (v) => { let r = ''; while (v > 0) { v--; r = String.fromCharCode(65 + (v % 26)) + r; v = Math.floor(v / 26); } return r; };
    if (n < 1) return String(n);
    switch (f) {
      case 'CIRCLED_DIGIT': return circ(0x2460, 20);
      case 'ROMAN_CAPITAL': return roman(n);
      case 'ROMAN_SMALL': return roman(n).toLowerCase();
      case 'LATIN_CAPITAL': return latin(n);
      case 'LATIN_SMALL': return latin(n).toLowerCase();
      case 'CIRCLED_LATIN_CAPITAL': return circ(0x24B6, 26);
      case 'CIRCLED_LATIN_SMALL': return circ(0x24D0, 26);
      case 'HANGUL_SYLLABLE': return cyc('가나다라마바사아자차카타파하'.split(''));
      case 'CIRCLED_HANGUL_SYLLABLE': return circ(0x326E, 14);
      case 'HANGUL_JAMO': return cyc('ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'.split(''));
      case 'CIRCLED_HANGUL_JAMO': return circ(0x3260, 14);
      case 'HANGUL_PHONETIC': return n <= 10 ? '일이삼사오육칠팔구십'.split('')[n - 1] : String(n);
      case 'IDEOGRAPH': return n <= 10 ? '一二三四五六七八九十'.split('')[n - 1] : String(n);
      case 'CIRCLED_IDEOGRAPH': return circ(0x3280, 10);
      default: return String(n);
    }
  }
  // 문단 머리(번호/글머리표) 글자. 번호는 정의별·수준별로 세어 감
  function headText(hd, ctx) {
    if (!hd) return '';
    if (hd.type === 'BULLET') {
      let c = ctx.bullets[hd.id] || '•';
      // 글꼴 전용 영역(기호 글꼴) 글자는 보통 글머리표로
      if (/[\uE000-\uF8FF]/.test(c)) c = '•';
      return c;
    }
    const id = hd.type === 'OUTLINE' ? ctx.outlineId : hd.id;
    const heads = ctx.numberings[id];
    if (!heads) return '';
    const lv = Math.max(0, Math.min(9, hd.level)) + 1;   // 수준 1부터
    const st = ctx.numState[id] || (ctx.numState[id] = {});
    st[lv] = (st[lv] != null ? st[lv] : ((heads[lv] && heads[lv].start) || 1) - 1) + 1;
    for (const k of Object.keys(st)) if (+k > lv) delete st[k];
    const h = heads[lv];
    if (!h || !h.text) return '';
    return h.text.replace(/\^(\d)/g, (m, d) => {
      const L = +d;
      const v = st[L] != null ? st[L] : ((heads[L] && heads[L].start) || 1);
      return fmtNum(v, (heads[L] && heads[L].fmt) || 'DIGIT');
    });
  }
  // 한글처럼 띄어쓰기를 그대로 보이게: 문단 첫머리·줄바꿈 뒤·연달아 나온 띄어쓰기는 &nbsp;로 (HTML은 합쳐 버림)
  function keepSpaces(html) {
    let out = '', inTag = false, prevSp = true;
    for (let i = 0; i < html.length; i++) {
      const ch = html[i];
      if (inTag) { out += ch; if (ch === '>') { inTag = false; if (/<br\s*\/?>$/i.test(out.slice(-6))) prevSp = true; } continue; }
      if (ch === '<') { inTag = true; out += ch; continue; }
      if (ch === ' ') { if (prevSp) { out += '&nbsp;'; prevSp = false; } else { out += ' '; prevSp = true; } continue; }
      out += ch; prevSp = false;
    }
    return out;
  }
  function textOf(t) {
    let s = '';
    for (const n of Array.from(t.childNodes)) {
      if (n.nodeType === 3) s += escHtml(n.nodeValue);
      else if (n.nodeType === 1) {
        const ln = n.localName;
        if (ln === 'lineBreak') s += '<br>';
        else if (ln === 'tab') s += '\t';
        else if (ln === 'nbSpace') s += '&nbsp;';
        else if (ln === 'fwSpace') s += '\u2002';
        else if (ln === 'hyphen') s += '-';
        else if (n.textContent) s += escHtml(n.textContent);
      }
    }
    return s;
  }
  function readSecPr(sp, ctx) {
    const oid = sp.getAttribute('outlineShapeIDRef');
    if (oid && oid !== '0') ctx.outlineId = oid;
    const sn = kid(sp, 'startNum');
    if (sn && ctx.pnStart == null) ctx.pnStart = num(sn.getAttribute('page'), 0);
    const pp = kid(sp, 'pagePr');
    if (!pp) return;
    const m = kid(pp, 'margin');
    let w = U.hwp2mm(num(pp.getAttribute('width'), 59528)), hh = U.hwp2mm(num(pp.getAttribute('height'), 84186));
    if (pp.getAttribute('landscape') === 'NARROWLY') { const t = w; w = Math.max(t, hh); hh = Math.min(t, hh); }
    const g = (n, d) => (m ? U.hwp2mm(num(m.getAttribute(n), d)) : U.hwp2mm(d));
    ctx.page = ctx.page || {
      width: round1(w), height: round1(hh),
      top: round1(g('top', 5668)), bottom: round1(g('bottom', 4252)), left: round1(g('left', 8504)), right: round1(g('right', 8504)),
      header: round1(g('header', 4252)), footer: round1(g('footer', 4252)),
    };
  }
  function readCtrl(c, ctx) {
    for (const x of Array.from(c.children)) {
      const n = x.localName;
      if (n === 'pageNum') {
        const pos = (x.getAttribute('pos') || 'BOTTOM_CENTER').toLowerCase().replace('_', '-');
        const rf = Object.fromEntries(Object.entries(PageNum.HWP_FMT).map(([k, v]) => [v, k]));
        const side = !!x.getAttribute('sideChar');
        const run = c.parentNode && c.parentNode.localName === 'run' ? c.parentNode : null;
        const cp = run ? ctx.charPr[run.getAttribute('charPrIDRef')] : null;
        const look = cp ? { font: cp.font || '함초롬바탕', size: cp.size || 9, bold: !!cp.bold, color: /^#[0-9a-f]{6}$/i.test(cp.color || '') ? cp.color.toLowerCase() : '#000000' } : {};
        if (pos !== 'none') ctx.settings.pageNum = { pos, side, deco: side ? 'side' : 'plain', fmt: rf[x.getAttribute('formatType')] || 'digit', start: 1, ...look };
      } else if (n === 'pageHiding') {
        if (x.getAttribute('hidePageNum') === '1') ctx.pnHide = true;
      } else if (n === 'header' || n === 'footer') {
        const hf = readHF(x, ctx, n);
        if (hf) ctx.settings[n] = hf;
      }
    }
  }
  // 머리말·꼬리말: 탭으로 나눈 왼쪽·가운데·오른쪽, 자동 번호는 {쪽}·{전체쪽}
  function readHF(x, ctx, kind) {
    const p = desc(x, 'p')[0];
    if (!p) return null;
    const parts = [''];
    let st = null;
    const walk = (node) => {
      for (const c of Array.from(node.children)) {
        const ln = c.localName;
        if (ln === 'run' && !st) { const cp = ctx.charPr[c.getAttribute('charPrIDRef')]; if (cp && desc(c, 't').some((t) => t.textContent.trim())) st = cp; }
        if (ln === 't') {
          for (const t of Array.from(c.childNodes)) {
            if (t.nodeType === 3) parts[parts.length - 1] += t.nodeValue;
            else if (t.localName === 'tab') parts.push('');
            else if (t.nodeType === 1) parts[parts.length - 1] += t.textContent;
          }
        } else if (ln === 'autoNum') {
          const ty = c.getAttribute('numType');
          if (ty === 'PAGE') parts[parts.length - 1] += '{쪽}';
          else if (ty === 'TOTAL_PAGE') parts[parts.length - 1] += '{전체쪽}';
        } else if (ln === 'subList' || ln === 'tbl') continue;
        else walk(c);
      }
    };
    walk(p);
    if (!parts.join('').trim()) return null;
    const pp = ctx.paraPr[p.getAttribute('paraPrIDRef')];
    const o = { left: '', center: '', right: '' };
    if (parts.length >= 3) { o.left = parts[0]; o.center = parts[1]; o.right = parts.slice(2).join(' '); }
    else if (parts.length === 2) { o.left = parts[0]; o.right = parts[1]; }
    else o[pp ? ({ LEFT: 'left', RIGHT: 'right', CENTER: 'center' }[pp.align] || 'left') : 'center'] = parts[0];
    for (const k of ['left', 'center', 'right']) o[k] = o[k].replace(/\s+$/, '').replace(/^\s+/, '');
    if (st) {
      if (st.font) o.font = st.font;
      if (st.size) o.size = st.size;
      if (st.bold) o.bold = true;
      if (st.color && /^#[0-9a-f]{6}$/i.test(st.color)) o.color = st.color.toLowerCase();
    }
    const bf = pp && pp.bf && ctx.borderFill[pp.bf];
    const has = (sd) => sd && sd.type && sd.type !== 'NONE';
    if (bf && has(kind === 'header' ? bf.bottom : bf.top)) o.line = true;
    return HF.norm(o);
  }
  function picHtml(pic, ctx) {
    const img = desc(pic, 'img')[0];
    if (!img) return '';
    const url = ctx.images[img.getAttribute('binaryItemIDRef')];
    if (!url) return '';
    // 크기: hp:sz(실제 보이는 크기)를 먼저, 없으면 curSz. 부호 없는 32비트로 적힌 음수(뒤집힌 그림)는 절댓값으로
    const dim = (el, n) => { if (!el) return 0; let v = num(el.getAttribute(n), 0); if (v >= 2147483648) v -= 4294967296; v = Math.abs(v); return v > 0 && v < 10000000 ? U.hwp2px(v) : 0; };
    const szEl = kid(pic, 'sz'), cur = kid(pic, 'curSz');
    let w = dim(szEl, 'width') || dim(cur, 'width'), hh = dim(szEl, 'height') || dim(cur, 'height');
    const { wrap, extra } = wrapOf(pic);
    const style = w && hh ? ` style="width:${Math.round(w)}px;height:${Math.round(hh)}px"` : '';
    // 한글이 적어 두는 개체 설명: "원본 그림의 이름: 사진.jpg"
    const cm = kid(pic, 'shapeComment');
    const nm = cm && /원본 그림의 이름\s*:\s*([^\r\n]+)/.exec(cm.textContent || '');
    const nameAttr = nm ? ` data-name="${escHtml(nm[1].trim().split(/[\\/]/).pop())}"` : '';
    const imgHtml = `<img src="${url}"${style}${wrap ? ` data-wrap="${wrap}"` : ''}${extra}${lookAttrs(pic, wrap)}${nameAttr}>`;
    const cap = kid(pic, 'caption');
    if (!cap) return imgHtml;
    return `<span class="figure" contenteditable="false" data-cap="${cap.getAttribute('side') === 'TOP' ? 'top' : 'bottom'}"${w ? ` style="width:${Math.round(w)}px"` : ''}>${imgHtml}${captionHtml(cap, ctx)}</span>`;
  }
  // 캡션: 글과 그림 번호(autoNum) → span.figcap
  function captionHtml(cap, ctx) {
    const sub = kid(cap, 'subList');
    let inner = '', align = '';
    kids(sub || cap, 'p').forEach((p, i) => {
      if (i) inner += '<br>';
      const pp = ctx.paraPr[p.getAttribute('paraPrIDRef')];
      if (!i && pp) align = { CENTER: 'center', RIGHT: 'right' }[pp.align] || '';
      for (const run of kids(p, 'run')) {
        const css = charCss(ctx.charPr[run.getAttribute('charPrIDRef')]);
        let part = '';
        for (const node of Array.from(run.children)) {
          if (node.localName === 't') part += textOf(node);
          else if (node.localName === 'ctrl' && kids(node, 'autoNum').some((n) => (n.getAttribute('numType') || '') === 'PICTURE')) {
            // 앞에 적힌 "그림 " 글자는 번호 표시가 대신함
            part = part.replace(/그림\s*$/, '');
            if (!part && /그림\s*(<\/span>)?$/.test(inner)) inner = inner.replace(/그림\s*(<\/span>)?$/, '$1');
            part += '<span class="fignum" contenteditable="false"></span>';
          }
        }
        if (part) inner += css ? `<span style="${css}">${part}</span>` : part;
      }
    });
    return `<span class="figcap" contenteditable="true"${align ? ` style="text-align:${align}"` : ''}>${keepSpaces(inner) || ' '}</span>`;
  }
  // 개체 모양 (바깥/안 여백, 그림 테두리, 그림자) → data-*
  function lookAttrs(node, wrap, dt, isTable) {
    let a = '';
    const q = (el) => (el ? [el.getAttribute('top'), el.getAttribute('right'), el.getAttribute('bottom'), el.getAttribute('left')].map((v) => Math.round(U.hwp2mm(num(v)) * 100) / 100) : null);
    const om = q(kid(node, 'outMargin'));
    // 누리글이 기본으로 쓰는 값이면 따로 적지 않음
    if (om && om.some((v) => v > 0) && !(om[0] === 0 && om[2] === 0 && Math.abs(om[1] - 1) < 0.02 && Math.abs(om[3] - 1) < 0.02)) a += ` data-om="${om.join(',')}"`;
    if (dt) {
      const im = q(kid(dt, 'textMargin'));
      if (im && !im.every((v) => Math.abs(v - 1) < 0.02)) a += ` data-im="${im.join(',')}"`;
    }
    if (isTable) {
      const im = q(kid(node, 'inMargin'));
      if (im && !(Math.abs(im[0] - 0.5) < 0.02 && Math.abs(im[1] - 1.8) < 0.02 && Math.abs(im[2] - 0.5) < 0.02 && Math.abs(im[3] - 1.8) < 0.02)) a += ` data-im="${im.join(',')}"`;
    }
    if (node.localName === 'pic') {
      const ls = kid(node, 'lineShape');
      const st = ls && ls.getAttribute('style');
      if (ls && st && st !== 'NONE' && num(ls.getAttribute('width')) > 0) {
        const css = { DASH: 'dashed', DOT: 'dotted', DOUBLE_SLIM: 'double' }[st] || 'solid';
        a += ` data-bd="${Math.max(1, Math.round(U.hwp2px(num(ls.getAttribute('width'))) * 2) / 2)},${css},${ls.getAttribute('color') || '#000000'}"`;
      }
    }
    const sh = kid(node, 'shadow');
    const t = sh && sh.getAttribute('type');
    if (t && t !== 'NONE') {
      const dx = Math.round(U.hwp2mm(num(sh.getAttribute('offsetX'))) * 10) / 10 || 1, dy = Math.round(U.hwp2mm(num(sh.getAttribute('offsetY'))) * 10) / 10 || 1;
      a += ` data-sh="${/LEFT/.test(t) ? -dx : dx},${/TOP/.test(t) ? -dy : dy},${sh.getAttribute('color') || '#808080'}"`;
    }
    return a;
  }
  // 개체의 본문과의 배치 → data-wrap (+ 떠 있는 개체 위치 정보)
  function wrapOf(node, isTable) {
    const pos = kid(node, 'pos');
    let wrap = '', extra = '';
    if (pos && pos.getAttribute('treatAsChar') === '0') {
      const ha = pos.getAttribute('horzAlign');
      const tw = node.getAttribute('textWrap');
      if (tw === 'IN_FRONT_OF_TEXT' || tw === 'BEHIND_TEXT') {
        wrap = tw === 'IN_FRONT_OF_TEXT' ? 'front' : 'behind';
        // 위치는 불러온 뒤 쪽 배치를 보고 계산 (App.resolveFloats)
        const a = (n) => pos.getAttribute(n) || '';
        extra = ` data-vrel="${a('vertRelTo')}" data-hrel="${a('horzRelTo')}" data-valign="${a('vertAlign')}" data-halign="${a('horzAlign')}" data-voff="${Math.round(U.hwp2px(num(a('vertOffset'))))}" data-hoff="${Math.round(U.hwp2px(num(a('horzOffset'))))}"`;
      } else if (tw === 'TOP_AND_BOTTOM') wrap = isTable ? '' : ha === 'CENTER' ? 'center' : '';
      else if (ha === 'CENTER') wrap = isTable ? '' : 'center';
      else wrap = ha === 'RIGHT' ? 'right' : 'left';
    }
    return { wrap, extra };
  }
  // 개체 묶음 (hp:container) → 묶음 span
  // 크기 값: 부호 없는 32비트로 적힌 음수는 절댓값, 터무니없이 큰 값은 0
  function sdim(v) { v = num(v, 0); if (v >= 2147483648) v -= 4294967296; v = Math.abs(v); return v < 10000000 ? v : 0; }
  function groupHtml(node, ctx, inner) {
    const sz = (el, n) => { const e = kid(el, n); return e ? [U.hwp2px(sdim(e.getAttribute('width'))), U.hwp2px(sdim(e.getAttribute('height')))] : null; };
    const cur = sz(node, 'curSz') || sz(node, 'sz') || [100, 100];
    const org = sz(node, 'orgSz') || cur;
    const sx = org[0] ? cur[0] / org[0] : 1, sy = org[1] ? cur[1] / org[1] : 1;
    const tmp = document.createElement('div');
    for (const c of Array.from(node.children)) {
      const n = c.localName;
      let html = '';
      if (n === 'pic') html = picHtml(c, ctx);
      else if (n === 'container') html = groupHtml(c, ctx, true);
      else if (n === 'rect' || n === 'ellipse' || n === 'polygon' || n === 'line') html = shapeHtml(c, ctx);
      if (!html) continue;
      tmp.innerHTML = html;
      const el = tmp.firstElementChild;
      if (!el) continue;
      const off = kid(c, 'offset');
      const ox = U.hwp2px(num(off && off.getAttribute('x'))) * sx, oy = U.hwp2px(num(off && off.getAttribute('y'))) * sy;
      const cs = sz(c, 'curSz') || sz(c, 'orgSz') || [parseFloat(el.style.width) || 0, parseFloat(el.style.height) || 0];
      ['wrap', 'vrel', 'hrel', 'valign', 'halign', 'voff', 'hoff'].forEach((k) => el.removeAttribute('data-' + k));
      el.dataset.gx = Math.round(ox * 10) / 10; el.dataset.gy = Math.round(oy * 10) / 10;
      el.dataset.gw = Math.round(cs[0] * sx * 10) / 10; el.dataset.gh = Math.round(cs[1] * sy * 10) / 10;
      el.dataset.gwrap = 'front';
      tmp.dataset.out = (tmp.dataset.out || '') + el.outerHTML;
    }
    const { wrap, extra } = inner ? { wrap: '', extra: '' } : wrapOf(node);
    const W = Math.round(cur[0] * 10) / 10, H = Math.round(cur[1] * 10) / 10;
    return `<span class="nobj" contenteditable="false" data-kind="group" data-bw="${W}" data-bh="${H}"${wrap ? ` data-wrap="${wrap}"` : ''}${extra} style="width:${W}px;height:${H}px">${tmp.dataset.out || ''}</span>`;
  }
  // 도형·글상자
  function shapeHtml(node, ctx) {
    const n = node.localName;
    const sz = kid(node, 'curSz') || kid(node, 'sz');
    let w = sz ? U.hwp2px(sdim(sz.getAttribute('width'))) : 0, hh = sz ? U.hwp2px(sdim(sz.getAttribute('height'))) : 0;
    const s2 = kid(node, 'sz');
    if (!w && s2) w = U.hwp2px(sdim(s2.getAttribute('width')));
    if (!hh && s2 && n !== 'line') hh = U.hwp2px(sdim(s2.getAttribute('height')));
    const ls = kid(node, 'lineShape');
    const d = {};
    let sw = 1, stroke = '#000000';
    if (ls) {
      stroke = ls.getAttribute('color') || '#000000';
      sw = ls.getAttribute('style') === 'NONE' ? 0 : Math.max(0.5, Math.round(U.hwp2px(num(ls.getAttribute('width'), 33)) * 2) / 2);
    }
    const wb = desc(node, 'winBrush').find((x) => x.parentElement && x.parentElement.parentElement === node);
    const face = wb ? wb.getAttribute('faceColor') : null;
    const fill = face && face !== 'none' && !/^#?FFFFFFFF$/i.test(face) && num(wb.getAttribute('alpha')) < 255 ? face : 'none';
    const dt = kid(node, 'drawText');
    const { wrap, extra } = wrapOf(node);
    let kind = 'shape', shape = n, body = '';
    const sub = dt ? kid(dt, 'subList') : null;
    const textHtml = () => {
      const tmp = document.createElement('div');
      tmp.innerHTML = sub ? paragraphsHtml(kids(sub, 'p'), ctx, false) : '';
      const lines = Array.from(tmp.children).filter((c) => c.tagName === 'P').map((p) => (p.innerHTML === '<br>' ? '' : p.innerHTML));
      return `<span class="tb-body" contenteditable="true">${lines.join('<br>') || '<br>'}</span>`;
    };
    // 가운데 정렬된 글이 있는 도형은 "도형 안 글자", 나머지 사각형+글은 글상자
    const centered = sub && sub.getAttribute('vertAlign') === 'CENTER';
    if (n === 'rect') {
      if (dt && !centered) { kind = 'textbox'; body = textHtml(); }
      else shape = num(node.getAttribute('ratio')) > 0 ? 'roundrect' : 'rect';
    } else if (n === 'line') {
      const sp = kid(node, 'startPt'), ep = kid(node, 'endPt');
      let x1 = num(sp && sp.getAttribute('x')), y1 = num(sp && sp.getAttribute('y')), x2 = num(ep && ep.getAttribute('x')), y2 = num(ep && ep.getAttribute('y'));
      let head = ls && ls.getAttribute('headStyle') && ls.getAttribute('headStyle') !== 'NORMAL';
      let tail = ls && ls.getAttribute('tailStyle') && ls.getAttribute('tailStyle') !== 'NORMAL';
      if (x2 < x1 || (x2 === x1 && y2 < y1)) { [x1, x2] = [x2, x1]; [y1, y2] = [y2, y1]; [head, tail] = [tail, head]; }
      d.dir = y2 < y1 ? 'ur' : 'dr';
      if (tail) d.at = '1';
      if (head) d.ah = '1';
      w = Math.max(w, U.hwp2px(Math.abs(x2 - x1)));
      hh = U.hwp2px(Math.abs(y2 - y1));
    } else if (n === 'polygon') {
      shape = 'poly';
      const pts = kids(node, 'pt').map((p) => [num(p.getAttribute('x')), num(p.getAttribute('y'))]);
      const W = Math.max(1, ...pts.map((p) => p[0])), H = Math.max(1, ...pts.map((p) => p[1]));
      d.pts = pts.map(([x, y]) => `${Math.round(x / W * 1000) / 1000},${Math.round(y / H * 1000) / 1000}`).join(' ');
    }
    if (kind === 'shape' && dt && n !== 'line') body = `<span class="sh-text">${textHtml()}</span>`;
    const attrs = [`class="nobj"`, `contenteditable="false"`, `data-kind="${kind}"`];
    if (kind === 'shape') attrs.push(`data-shape="${shape}"`);
    attrs.push(`data-stroke="${stroke}"`, `data-sw="${sw}"`, `data-fill="${fill}"`);
    for (const [k, v] of Object.entries(d)) attrs.push(`data-${k}="${v}"`);
    if (wrap) attrs.push(`data-wrap="${wrap}"`);
    const hs = kind === 'textbox' ? `min-height:${Math.round(hh)}px` : `height:${Math.round(hh)}px`;
    return `<span ${attrs.join(' ')}${extra}${lookAttrs(node, wrap, dt)} style="width:${Math.round(w)}px;${hs}">${body}</span>`;
  }
  function tableHtml(tbl, ctx, pp) {
    const rows = kids(tbl, 'tr');
    const nc = num(tbl.getAttribute('colCnt'), 0);
    const cells = [];
    rows.forEach((tr) => kids(tr, 'tc').forEach((tc) => {
      const addr = kid(tc, 'cellAddr'), span = kid(tc, 'cellSpan'), sz = kid(tc, 'cellSz');
      cells.push({
        tc, r: num(addr && addr.getAttribute('rowAddr')), c: num(addr && addr.getAttribute('colAddr')),
        rs: num(span && span.getAttribute('rowSpan'), 1), cs: num(span && span.getAttribute('colSpan'), 1),
        w: U.hwp2px(num(sz && sz.getAttribute('width'))), h: U.hwp2px(num(sz && sz.getAttribute('height'))),
      });
    }));
    const ncols = Math.max(nc, ...cells.map((c) => c.c + c.cs));
    const nrows = Math.max(num(tbl.getAttribute('rowCnt'), 0), ...cells.map((c) => c.r + c.rs));
    // 칸 너비 계산
    const widths = Array(ncols).fill(0);
    cells.filter((c) => c.cs === 1).forEach((c) => { widths[c.c] = Math.max(widths[c.c], c.w); });
    for (let pass = 0; pass < 3; pass++) {
      cells.filter((c) => c.cs > 1).forEach((c) => {
        const idx = Array.from({ length: c.cs }, (_, i) => c.c + i);
        const unknown = idx.filter((i) => !widths[i]);
        if (!unknown.length) return;
        const known = idx.reduce((a, i) => a + widths[i], 0);
        const rest = Math.max(0, c.w - known) / unknown.length;
        unknown.forEach((i) => (widths[i] = rest));
      });
    }
    const tsz = kid(tbl, 'sz');
    const tw = tsz ? U.hwp2px(num(tsz.getAttribute('width'))) : 600;
    for (let i = 0; i < ncols; i++) if (!widths[i]) widths[i] = tw / ncols;
    const heights = Array(nrows).fill(0);
    cells.filter((c) => c.rs === 1).forEach((c) => { heights[c.r] = Math.max(heights[c.r], c.h); });
    const pos = kid(tbl, 'pos');
    const ha = pos ? pos.getAttribute('horzAlign') : 'LEFT';
    const tw2 = wrapOf(tbl, true);
    // 누리글이 적어 둔 셀 배경 그림 원본
    const bgMeta = {};
    const scm = kid(tbl, 'shapeComment');
    if (scm && (scm.textContent || '').startsWith(BG_META)) {
      try { for (const m of JSON.parse(scm.textContent.slice(BG_META.length))) bgMeta[m.r + ',' + m.c] = m; } catch { /* 무시 */ }
    }
    // 표 가로 위치: 글자처럼 취급한 표는 그 문단의 정렬을, 아니면 가로 정렬·가로 위치 값을 따름
    const asChar = pos && pos.getAttribute('treatAsChar') === '1';
    let hAlign = asChar ? ({ CENTER: 'CENTER', RIGHT: 'RIGHT' }[pp && pp.align] || 'LEFT') : ha;
    let shift = 0;
    if (!asChar && !tw2.wrap && hAlign === 'LEFT' && pos) {
      const off = U.hwp2px(num(pos.getAttribute('horzOffset'), 0));
      const rel = pos.getAttribute('horzRelTo');
      if (rel === 'PAGE' || rel === 'PAPER') shift = off - U.mm2px(ctx.page ? ctx.page.left || 0 : 0);
      else shift = off;
      shift = Math.max(0, Math.round(shift));
    }
    // 세로 위치: 문단 기준으로 아래로 띄운 거리 (한 문단에 표가 여러 개면 앞 표 아래로 쌓이고 그만큼 띄움)
    let vshift = 0;
    if (!asChar && !tw2.wrap && pos && (pos.getAttribute('vertRelTo') || 'PARA') === 'PARA') vshift = Math.max(0, Math.round(U.hwp2px(sdim(pos.getAttribute('vertOffset')))));
    const cls = !tw2.wrap && hAlign === 'CENTER' ? ' class="tbl-center"' : !tw2.wrap && hAlign === 'RIGHT' ? ' class="tbl-right"' : '';
    let html = `<table${cls}${tw2.wrap ? ` data-wrap="${tw2.wrap}"` : ''}${tw2.extra}${lookAttrs(tbl, tw2.wrap, null, true)} ${shift ? ` data-shift="${shift}"` : ''}${vshift ? ` data-vshift="${vshift}"` : ''}${/^(TABLE|NONE)$/.test(tbl.getAttribute('pageBreak') || '') ? ` data-pb="${tbl.getAttribute('pageBreak')}"` : ''} style="width:${Math.round(widths.reduce((a, b) => a + b, 0))}px${shift ? `;margin-left:${shift}px` : ''}"><colgroup>${widths.map((w) => `<col style="width:${Math.round(w * 10) / 10}px">`).join('')}</colgroup><tbody>`;
    for (let r = 0; r < nrows; r++) {
      html += `<tr${heights[r] ? ` style="height:${Math.round(heights[r])}px"` : ''}>`;
      for (const c of cells.filter((x) => x.r === r).sort((a, b) => a.c - b.c)) {
        const bf = ctx.borderFill[c.tc.getAttribute('borderFillIDRef')];
        const sub = kid(c.tc, 'subList');
        const st = [];
        let tdAttr = '';
        if (bf) {
          for (const [side, key] of [['top', 'top'], ['right', 'right'], ['bottom', 'bottom'], ['left', 'left']]) {
            const b = bf[key];
            if (!b || b.type === 'NONE') st.push(`border-${side}:none`);
            else {
              const style = { DASH: 'dashed', DOT: 'dotted', DASH_DOT: 'dashed', DASH_DOT_DOT: 'dashed', LONG_DASH: 'dashed', DOUBLE_SLIM: 'double', SLIM_THICK: 'double', THICK_SLIM: 'double', SLIM_THICK_SLIM: 'double' }[b.type] || 'solid';
              const wpx = style === 'double' ? Math.max(3, borderMMToPx(b.width)) : borderMMToPx(b.width);
              st.push(`border-${side}:${wpx}px ${style} ${b.color || '#000'}`);
              const bmm = parseFloat(b.width) || 0.12;
              if (bmm !== 0.12 || b.type !== 'SOLID') tdAttr += ` data-b${side[0]}="${bmm}|${b.type}"`;
            }
          }
          if (bf.fill) st.push(`background-color:${bf.fill}`);
          const meta = bgMeta[c.r + ',' + c.c];
          const bgu = bf.img && ctx.images[bf.img.ref];
          if (meta && ctx.images[meta.b]) {
            st.push(`background-image:url(${ctx.images[meta.b]})`);
            tdAttr += ` data-bgmode="${meta.m === 'one' ? 'one' : 'cover'}"` + (meta.m === 'one' ? ` data-bgfit="${meta.f || 'stretch'}" data-bggid="${meta.g || 'g0'}"` : '');
          } else if (bgu) {
            const m = bf.img.mode;
            st.push(`background-image:url(${bgu})`);
            tdAttr += ` data-bgmode="${/^TILE/.test(m) ? 'tile' : /^(CENTER|LEFT|RIGHT)/.test(m) ? 'center' : 'stretch'}"`;
          }
        }
        if (bf && bf.diag) tdAttr += ` data-diag="${bf.diag.dir}" data-dgc="${bf.diag.color}" data-dgw="${bf.diag.width}"`;
        if (c.tc.getAttribute('hasMargin') === '1') {
          const cm = kid(c.tc, 'cellMargin');
          if (cm) {
            const v = ['top', 'right', 'bottom', 'left'].map((n) => Math.round(U.hwp2px(num(cm.getAttribute(n))) * 10) / 10);
            st.push(`padding:${v.map((x) => x + 'px').join(' ')}`);
            tdAttr += ` data-im="${v.map((x) => Math.round(U.px2mm(x) * 100) / 100).join(',')}"`;
          }
        }
        const va = sub ? sub.getAttribute('vertAlign') : 'CENTER';
        if (va === 'TOP') st.push('vertical-align:top');
        else if (va === 'BOTTOM') st.push('vertical-align:bottom');
        const inner = sub ? paragraphsHtml(kids(sub, 'p'), ctx, false) : '<p><br></p>';
        html += `<td${tdAttr}${c.cs > 1 ? ` colspan="${c.cs}"` : ''}${c.rs > 1 ? ` rowspan="${c.rs}"` : ''}${st.length ? ` style="${st.join(';')}"` : ''}>${inner || '<p><br></p>'}</td>`;
      }
      html += '</tr>';
    }
    return html + '</tbody></table>';
  }
  const round1 = (v) => Math.round(v * 10) / 10;
  // 다단 표시를 div.cols 영역으로 묶기
  function groupColumns(html) {
    if (!html.includes('data-colmark')) return html;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    let reg = null;
    for (const n of Array.from(tmp.childNodes)) {
      if (n.nodeType === 1 && n.hasAttribute('data-colmark')) {
        const cnt = +n.getAttribute('data-colmark');
        reg = null;
        if (cnt > 1) {
          reg = document.createElement('div');
          reg.className = 'cols';
          reg.dataset.cols = cnt; reg.dataset.gap = n.dataset.gap; reg.dataset.line = n.dataset.line;
          n.replaceWith(reg);
        } else n.remove();
        continue;
      }
      if (reg) reg.append(n);
    }
    tmp.querySelectorAll('div.cols').forEach((r) => { if (!r.firstElementChild) r.remove(); });
    // 다단 밖의 단 나누기는 의미 없음
    // 한 단짜리 문서의 단 나누기는 한글에서 쪽 나누기처럼 동작
    tmp.querySelectorAll('.colbreak').forEach((c) => {
      if (c.closest('div.cols')) return;
      if (c.parentElement === tmp && c.previousElementSibling) c.outerHTML = '<div class="pagebreak" contenteditable="false"></div>';
      else c.remove();
    });
    // 같은 문단의 둘째 표 뒤에 이어지는 빈 문단은 한글에서 첫 표 아래(앞 쪽)에 보임
    tmp.querySelectorAll(':scope > table[data-samepara]').forEach((t) => {
      let n = t.nextElementSibling;
      while (n && n.tagName === 'P' && !n.textContent.replace(/\u200b/g, '').trim() && !n.querySelector('img,.nobj,.pnnew,.pnhide')) {
        const nx = n.nextElementSibling;
        t.before(n);
        n = nx;
      }
    });
    return tmp.innerHTML;
  }

  return { write, read };
})();
