// DOCX(워드) 불러오기 → 누리글 편집기 HTML
// 문단(정렬·들여쓰기·간격·줄 간격), 글자(글꼴·크기·진하게·기울임·밑줄·취소선·색·형광펜·위/아래 첨자·자간·장평),
// 목록 번호, 표(칸 너비·줄 높이·합친 셀·테두리·배경·세로 정렬), 그림, 쪽 나누기, 용지·여백, 머리말·꼬리말·쪽 번호
'use strict';
const DocxImport = (() => {
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const kids = (el, name) => (el ? Array.from(el.children).filter((c) => c.localName === name) : []);
  const kid = (el, name) => (el ? Array.from(el.children).find((c) => c.localName === name) || null : null);
  const desc = (el, name) => (el ? Array.from(el.getElementsByTagNameNS('*', name)) : []);
  const wa = (el, name) => (el ? el.getAttributeNS(W, name) || el.getAttribute('w:' + name) : null);
  const ra = (el, name) => (el ? el.getAttributeNS(R, name) || el.getAttribute('r:' + name) : null);
  const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
  const twPt = (tw) => Math.round(num(tw) / 20 * 100) / 100; // twip → pt
  const twPx = (tw) => num(tw) / 15;                          // twip → px (96dpi)
  const twMm = (tw) => Math.round(num(tw) / 1440 * 25.4 * 10) / 10;
  const emuPx = (e) => num(e) / 9525;
  const onOff = (el) => { if (!el) return undefined; const v = wa(el, 'val'); return !(v === '0' || v === 'false' || v === 'off' || v === 'none'); };
  const HL = { yellow: '#FFFF00', green: '#00FF00', cyan: '#00FFFF', magenta: '#FF00FF', blue: '#0000FF', red: '#FF0000', darkBlue: '#000080', darkCyan: '#008080', darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000', darkYellow: '#808000', darkGray: '#808080', lightGray: '#C0C0C0', black: '#000000', white: '#FFFFFF' };
  const parse = (s) => new DOMParser().parseFromString(s, 'application/xml');

  // ---------- 글자 모양 (rPr) ----------
  function readRPr(rPr, theme) {
    const o = {};
    if (!rPr) return o;
    const f = kid(rPr, 'rFonts');
    if (f) {
      const pick = (k) => wa(f, k);
      const th = (k) => { const t = wa(f, k); return t ? theme[/major/i.test(t) ? (/eastAsia/i.test(t) ? 'majorEA' : 'major') : (/eastAsia/i.test(t) ? 'minorEA' : 'minor')] : null; };
      o.fontEA = pick('eastAsia') || th('eastAsiaTheme') || undefined;
      o.fontLatin = pick('ascii') || pick('hAnsi') || th('asciiTheme') || th('hAnsiTheme') || undefined;
      if (!o.fontEA) delete o.fontEA;
      if (!o.fontLatin) delete o.fontLatin;
    }
    const sz = kid(rPr, 'sz') || kid(rPr, 'szCs');
    if (sz && wa(sz, 'val')) o.size = num(wa(sz, 'val')) / 2;
    const b = onOff(kid(rPr, 'b')); if (b !== undefined) o.bold = b;
    const i = onOff(kid(rPr, 'i')); if (i !== undefined) o.italic = i;
    const u = kid(rPr, 'u'); if (u) o.underline = (wa(u, 'val') || 'single') !== 'none';
    const st = onOff(kid(rPr, 'strike')), ds = onOff(kid(rPr, 'dstrike'));
    if (st !== undefined || ds !== undefined) o.strike = !!(st || ds);
    const c = kid(rPr, 'color'); if (c && wa(c, 'val') && wa(c, 'val') !== 'auto') o.color = '#' + wa(c, 'val');
    const hl = kid(rPr, 'highlight'); if (hl && HL[wa(hl, 'val')]) o.shade = HL[wa(hl, 'val')];
    const sh = kid(rPr, 'shd'); if (sh && wa(sh, 'fill') && !/^(auto|FFFFFF)$/i.test(wa(sh, 'fill'))) o.shade = o.shade || '#' + wa(sh, 'fill');
    const va = kid(rPr, 'vertAlign'); if (va) { o.sup = wa(va, 'val') === 'superscript'; o.sub = wa(va, 'val') === 'subscript'; }
    const sp = kid(rPr, 'spacing'); if (sp && wa(sp, 'val')) o.spacing = num(wa(sp, 'val')); // twip
    const w = kid(rPr, 'w'); if (w && wa(w, 'val')) o.ratio = num(wa(w, 'val'), 100);
    const caps = onOff(kid(rPr, 'caps')); if (caps !== undefined) o.caps = caps;
    const vanish = onOff(kid(rPr, 'vanish')); if (vanish !== undefined) o.hidden = vanish;
    return o;
  }
  // ---------- 문단 모양 (pPr) ----------
  function readPPr(pPr) {
    const o = {};
    if (!pPr) return o;
    const jc = kid(pPr, 'jc'); if (jc) o.align = wa(jc, 'val');
    const ind = kid(pPr, 'ind');
    if (ind) {
      const l = wa(ind, 'start') ?? wa(ind, 'left'); if (l != null) o.left = num(l);
      const r = wa(ind, 'end') ?? wa(ind, 'right'); if (r != null) o.right = num(r);
      if (wa(ind, 'hanging') != null) o.first = -num(wa(ind, 'hanging'));
      else if (wa(ind, 'firstLine') != null) o.first = num(wa(ind, 'firstLine'));
    }
    const sp = kid(pPr, 'spacing');
    if (sp) {
      if (wa(sp, 'before') != null) o.before = num(wa(sp, 'before'));
      if (wa(sp, 'after') != null) o.after = num(wa(sp, 'after'));
      if (wa(sp, 'line') != null) { o.line = num(wa(sp, 'line')); o.lineRule = wa(sp, 'lineRule') || 'auto'; }
    }
    const pb = onOff(kid(pPr, 'pageBreakBefore')); if (pb !== undefined) o.pageBreakBefore = pb;
    const kl = onOff(kid(pPr, 'keepLines')); if (kl !== undefined) o.keepLines = kl;
    const np = kid(pPr, 'numPr');
    if (np) { const id = kid(np, 'numId'), lv = kid(np, 'ilvl'); o.numId = id ? wa(id, 'val') : null; o.ilvl = lv ? num(wa(lv, 'val')) : 0; }
    const shd = kid(pPr, 'shd'); if (shd && wa(shd, 'fill') && !/^(auto|FFFFFF)$/i.test(wa(shd, 'fill'))) o.shade = '#' + wa(shd, 'fill');
    const ps = kid(pPr, 'pStyle'); if (ps) o.style = wa(ps, 'val');
    const bd = kid(pPr, 'pBdr');
    if (bd) {
      o.border = {};
      for (const k of ['top', 'left', 'bottom', 'right', 'start', 'end']) {
        const e = kid(bd, k);
        if (!e) continue;
        const v = wa(e, 'val');
        const key = { start: 'left', end: 'right' }[k] || k;
        if (!v || v === 'nil' || v === 'none') { o.border[key] = null; continue; }
        const px = Math.max(1, Math.round(num(wa(e, 'sz'), 4) / 8 * 96 / 72 * 10) / 10);
        const style = /double/.test(v) ? 'double' : /dash/i.test(v) ? 'dashed' : /dot/i.test(v) ? 'dotted' : 'solid';
        const col = wa(e, 'color') && wa(e, 'color') !== 'auto' ? '#' + wa(e, 'color') : '#000000';
        o.border[key] = { css: `${style === 'double' ? Math.max(3, px) : px}px ${style} ${col}`, space: num(wa(e, 'space')) };
      }
    }
    const tabs = kid(pPr, 'tabs');
    if (tabs) o.tabs = kids(tabs, 'tab').filter((t) => wa(t, 'val') !== 'clear').map((t) => ({ pos: num(wa(t, 'pos')), type: wa(t, 'val'), leader: wa(t, 'leader') }));
    return o;
  }

  // ---------- 스타일 ----------
  function readStyles(doc, theme) {
    const st = { para: {}, char: {}, table: {}, defP: {}, defR: {}, defaultPara: null };
    if (!doc) return st;
    const dd = desc(doc, 'docDefaults')[0];
    if (dd) {
      st.defR = readRPr(desc(dd, 'rPr')[0], theme);
      st.defP = readPPr(desc(dd, 'pPr')[0]);
    }
    for (const s of desc(doc, 'style')) {
      const type = wa(s, 'type'), id = wa(s, 'styleId');
      const based = kid(s, 'basedOn');
      const e = { id, name: wa(kid(s, 'name'), 'val') || id, based: based ? wa(based, 'val') : null, pPr: readPPr(kid(s, 'pPr')), rPr: readRPr(kid(s, 'rPr'), theme), tblPr: kid(s, 'tblPr'), tcPr: kid(s, 'tcPr') };
      if (type === 'paragraph') { st.para[id] = e; if (wa(s, 'default') === '1') st.defaultPara = id; }
      else if (type === 'character') st.char[id] = e;
      else if (type === 'table') st.table[id] = e;
    }
    return st;
  }
  function chain(map, id, depth = 0) {
    const e = map[id];
    if (!e || depth > 10) return { pPr: {}, rPr: {} };
    const up = e.based ? chain(map, e.based, depth + 1) : { pPr: {}, rPr: {} };
    return { pPr: { ...up.pPr, ...e.pPr }, rPr: { ...up.rPr, ...e.rPr }, tblPr: e.tblPr || up.tblPr, name: e.name };
  }

  // ---------- 번호 ----------
  function readNumbering(doc) {
    const abs = {}, nums = {};
    if (!doc) return { abs, nums };
    for (const a of desc(doc, 'abstractNum')) {
      const lv = {};
      for (const l of kids(a, 'lvl')) {
        const il = num(wa(l, 'ilvl'));
        lv[il] = { fmt: wa(kid(l, 'numFmt'), 'val') || 'decimal', text: wa(kid(l, 'lvlText'), 'val') || '', start: num(wa(kid(l, 'start'), 'val'), 1), pPr: readPPr(kid(l, 'pPr')), rPr: kid(l, 'rPr') };
      }
      abs[wa(a, 'abstractNumId')] = lv;
    }
    for (const n of desc(doc, 'num')) {
      const an = kid(n, 'abstractNumId');
      const over = {};
      for (const o of kids(n, 'lvlOverride')) { const so = kid(o, 'startOverride'); if (so) over[num(wa(o, 'ilvl'))] = num(wa(so, 'val')); }
      nums[wa(n, 'numId')] = { abs: an ? wa(an, 'val') : null, over };
    }
    return { abs, nums };
  }
  function fmtNum(n, f) {
    const roman = (v) => { let r = ''; for (const [a, b] of [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (v >= a) { r += b; v -= a; } return r; };
    const latin = (v) => { let r = ''; while (v > 0) { v--; r = String.fromCharCode(65 + (v % 26)) + r; v = Math.floor(v / 26); } return r; };
    const circ = (base, max) => (n >= 1 && n <= max ? String.fromCharCode(base + n - 1) : String(n));
    switch (f) {
      case 'upperRoman': return roman(n);
      case 'lowerRoman': return roman(n).toLowerCase();
      case 'upperLetter': return latin(n);
      case 'lowerLetter': return latin(n).toLowerCase();
      case 'ganada': return '가나다라마바사아자차카타파하'[(n - 1) % 14];
      case 'chosung': return 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'[(n - 1) % 14];
      case 'decimalEnclosedCircle': return circ(0x2460, 20);
      case 'koreanDigital': case 'koreanCounting': case 'koreanLegal': return n <= 10 ? '일이삼사오육칠팔구십'[n - 1] : String(n);
      case 'decimalZero': return (n < 10 ? '0' : '') + n;
      case 'bullet': case 'none': return '';
      default: return String(n);
    }
  }

  // ---------- 본문 ----------
  async function read(bytes) {
    const zip = await JSZip.loadAsync(bytes);
    const txt = async (p) => { const f = zip.file(p); return f ? f.async('string') : null; };
    const main = await txt('word/document.xml');
    if (!main) throw new Error('word/document.xml 이 없습니다 (DOCX 파일이 아닙니다).');
    const doc = parse(main);
    // 관계(그림·링크·머리말)
    const rels = {};
    const relDoc = await txt('word/_rels/document.xml.rels');
    if (relDoc) for (const r of desc(parse(relDoc), 'Relationship')) rels[r.getAttribute('Id')] = { target: r.getAttribute('Target'), type: r.getAttribute('Type') || '', ext: r.getAttribute('TargetMode') === 'External' };
    // 테마 글꼴
    const theme = {};
    const th = await txt('word/theme/theme1.xml');
    if (th) {
      const t = parse(th);
      for (const [k, tag] of [['major', 'majorFont'], ['minor', 'minorFont']]) {
        const el = desc(t, tag)[0];
        if (!el) continue;
        const lat = kid(el, 'latin'); theme[k] = lat ? lat.getAttribute('typeface') : null;
        const hang = kids(el, 'font').find((x) => x.getAttribute('script') === 'Hang');
        const ea = kid(el, 'ea');
        theme[k + 'EA'] = (hang && hang.getAttribute('typeface')) || (ea && ea.getAttribute('typeface')) || theme[k];
      }
    }
    const stylesXml = await txt('word/styles.xml');
    const styles = readStyles(stylesXml ? parse(stylesXml) : null, theme);
    const numXml = await txt('word/numbering.xml');
    const numbering = readNumbering(numXml ? parse(numXml) : null);
    const counters = {};
    const media = {};
    const mediaUrl = async (rid, base = 'word/') => {
      const rel = rels[rid];
      if (!rel) return null;
      let p = rel.target.replace(/^\//, '');
      if (!p.startsWith('word/')) p = base + p;
      if (media[p]) return media[p];
      const f = zip.file(p);
      if (!f) return null;
      const b = await f.async('uint8array');
      let mime = mimeFromName(p);
      if (/\.(emf|wmf)$/i.test(p)) return null; // 브라우저가 못 그림
      return (media[p] = bytesToDataURL(b, mime));
    };

    const defFont = (r) => r.fontEA || r.fontLatin || null;
    // 워드의 '한 줄' 높이 = 글꼴의 위·아래 높이 + 줄 사이 (글꼴마다 다름)
    const lineFactor = (f) => {
      f = f || '';
      if (/맑은|Malgun/i.test(f)) return 1.33;
      if (/나눔|Nanum|돋움|Dotum|굴림|Gulim|바탕|Batang|궁서/i.test(f)) return 1.25;
      if (/Calibri|Cambria/i.test(f)) return 1.22;
      if (/Times|Georgia|Garamond/i.test(f)) return 1.15;
      if (/Arial|Helvetica|Verdana|Segoe|Tahoma/i.test(f)) return 1.15;
      if (/Noto|Pretendard|Spoqa|Source/i.test(f)) return 1.45;
      return 1.2;
    };
    const runCss = (r, base) => {
      const s = [];
      const font = defFont(r);
      // 워드처럼: 영문은 영문 글꼴, 한글은 한글 글꼴 (글꼴 목록 앞이 영문 글꼴)
      if (r.fontLatin && r.fontEA && r.fontLatin !== r.fontEA) s.push(`font-family:'${r.fontLatin.replace(/'/g, '')}', ${fontStack(r.fontEA).replace(/"/g, "'")}`);
      else if (font && font !== App.defaultFont) s.push(`font-family:${fontStack(font).replace(/"/g, "'")}`);
      if (r.size && !(r.sup || r.sub)) s.push(`font-size:${r.size}pt`);
      if (r.bold) s.push('font-weight:bold');
      if (r.italic) s.push('font-style:italic');
      const deco = [r.underline && 'underline', r.strike && 'line-through'].filter(Boolean);
      if (deco.length) s.push(`text-decoration:${deco.join(' ')}`);
      if (r.color && !/^#0{6}$/i.test(r.color)) s.push(`color:${r.color}`);
      if (r.shade) s.push(`background-color:${r.shade}`);
      if (r.sup || r.sub) s.push(`vertical-align:${r.sup ? 'super' : 'sub'};font-size:${Math.round((r.size || base || 10) * 0.7 * 2) / 2}pt`);
      if (r.spacing) s.push(`letter-spacing:${Math.round(r.spacing / 20 * 100) / 100}pt`);
      if (r.ratio && r.ratio !== 100) s.push(`--hr:${Math.max(50, Math.min(200, r.ratio))}`);
      if (r.caps) s.push('text-transform:uppercase');
      return s.join(';');
    };
    // 띄어쓰기 보존 (문단 전체 HTML에서): 문단 첫머리·연달아 나온 띄어쓰기만 &nbsp; — 낱말 사이 한 칸은 보통 띄어쓰기로 두어 줄바꿈이 됨
    const keepSpaces = (html) => {
      let out = '', inTag = false, prevSp = true;
      for (let i = 0; i < html.length; i++) {
        const ch = html[i];
        if (inTag) { out += ch; if (ch === '>') { inTag = false; if (/<br\s*\/?>$/i.test(out.slice(-6))) prevSp = true; } continue; }
        if (ch === '<') { inTag = true; out += ch; continue; }
        if (ch === ' ') { if (prevSp) { out += '&nbsp;'; prevSp = false; } else { out += ' '; prevSp = true; } continue; }
        out += ch; prevSp = false;
      }
      return out;
    };

    let prevAfter = 0; // 바로 앞 문단의 아래 간격(twip)
    const paraBlock = async (p, ctx) => {
      const pPr = kid(p, 'pPr');
      const own = readPPr(pPr);
      const sid = own.style || styles.defaultPara;
      const sc = chain(styles.para, sid);
      // 번호
      let pp = { ...styles.defP, ...sc.pPr, ...own };
      let numText = '', numRPr = {};
      const numId = own.numId != null ? own.numId : sc.pPr.numId;
      const ilvl = own.numId != null ? own.ilvl : (sc.pPr.ilvl || 0);
      if (numId && numId !== '0' && numbering.nums[numId]) {
        const n = numbering.nums[numId];
        const lv = (numbering.abs[n.abs] || {})[ilvl];
        if (lv) {
          const key = n.abs;
          const cs = counters[key] || (counters[key] = {});
          for (const k of Object.keys(cs)) if (+k > ilvl) delete cs[k];
          cs[ilvl] = cs[ilvl] == null ? (n.over[ilvl] != null ? n.over[ilvl] : lv.start) : cs[ilvl] + 1;
          if (lv.fmt === 'bullet') numText = (lv.text && !/[-]/.test(lv.text) ? lv.text : '•');
          else numText = lv.text.replace(/%(\d)/g, (m, d) => { const l = +d - 1; const al = (numbering.abs[n.abs] || {})[l]; return fmtNum(cs[l] != null ? cs[l] : (al ? al.start : 1), (l === ilvl ? lv.fmt : al ? al.fmt : 'decimal')); });
          pp = { ...styles.defP, ...sc.pPr, ...lv.pPr, ...own };
          numRPr = readRPr(lv.rPr, theme);
        }
      }
      const markR = { ...styles.defR, ...sc.rPr, ...readRPr(pPr && kid(pPr, 'rPr'), theme) };
      // 문단 속성 → CSS
      const s = [];
      const al = { center: 'center', right: 'right', end: 'right', left: 'left', start: 'left', both: '', justify: '', distribute: '' }[pp.align || 'left'];
      if (al) s.push(`text-align:${al}`);
      let left = pp.left || 0;
      const first = pp.first || 0;
      // 왼쪽 테두리는 워드처럼 글 왼쪽 바깥에 (글 시작 위치는 그대로)
      const lb = pp.border && pp.border.left;
      if (lb) { const bw = parseFloat(lb.css) * 0.75 || 0.75; left -= Math.round((lb.space + bw) * 20); }
      if (left) s.push(`margin-left:${twPt(left)}pt`);
      if (pp.right) s.push(`margin-right:${twPt(pp.right)}pt`);
      if (first) s.push(`text-indent:${twPt(first)}pt`);
      // 테두리 문단: 앞 문단의 '아래 간격'과 겹쳐 '위 간격'이 그만큼 줄어듦 (워드 화면에서 잼)
      if (pp.border && pp.before && !pp.pageBreakBefore) pp = { ...pp, before: Math.max(0, pp.before - prevAfter) };
      prevAfter = pp.after || 0;
      if (pp.before) s.push(`padding-top:${twPt(pp.before)}pt`);
      if (pp.after) s.push(`padding-bottom:${twPt(pp.after)}pt`);
      if (pp.line) {
        if (pp.lineRule === 'auto') s.push(`line-height:${Math.round((pp.line / 240) * lineFactor(defFont(markR)) * 100) / 100}`);
        else s.push(`line-height:${twPt(pp.line)}pt`);
      } else s.push(`line-height:${lineFactor(defFont(markR))}`);
      if (pp.shade) s.push(`background-color:${pp.shade}`);
      if (pp.border) {
        for (const [k, bd] of Object.entries(pp.border)) {
          if (!bd) continue;
          s.push(`border-${k}:${bd.css}`, `padding-${k}:${bd.space}pt`);
          // 문단 앞뒤 간격은 테두리 바깥으로
          if (k === 'top' && pp.before) { const i = s.indexOf(`padding-top:${twPt(pp.before)}pt`); if (i >= 0) s.splice(i, 1); s.push(`margin-top:${twPt(pp.before)}pt`); }
          if (k === 'bottom' && pp.after) { const i = s.indexOf(`padding-bottom:${twPt(pp.after)}pt`); if (i >= 0) s.splice(i, 1); s.push(`margin-bottom:${twPt(pp.after)}pt`); }
        }
      }
      // 문단 글자 크기 = 가장 큰 글자 (빈 문단은 문단 표시의 글자 크기)
      let maxSz = 0;
      const out = [];
      let cur = '';
      const runs = [];
      const flushTo = () => {
        const html = cur;
        cur = '';
        return html;
      };
      const pAttr = () => {
        const sz = maxSz || markR.size || 10;
        const ss = [...s];
        if (Math.abs(sz - 10) > 0.05) ss.unshift(`font-size:${sz}pt`);
        const f = defFont(markR);
        if (f && f !== App.defaultFont) ss.unshift(`font-family:${fontStack(f).replace(/"/g, "'")}`);
        let a = ss.length ? ` style="${ss.join(';')}"` : '';
        if (pp.align === 'distribute') a += ' class="align-distribute"';
        if (pp.keepLines) a += ' data-keep=""';
        if (pp.tabs && pp.tabs.length) a += ` data-tabs="${pp.tabs.map((t) => `${Math.round(twMm(t.pos) * 10) / 10}:${{ center: 'C', right: 'R', end: 'R', decimal: 'D' }[t.type] || 'L'}:${({ dot: 'dot', middleDot: 'dot', hyphen: 'dash', underscore: 'solid', heavy: 'solid' })[t.leader] || 'none'}`).join(';')}"`;
        return a;
      };
      const closeP = (force) => {
        const body = flushTo();
        if (!body && !force) return;
        const mk = runCss(markR);
        out.push(`<p${pAttr()}>${keepSpaces(body) || (mk ? `<span style="${mk}"><br></span>` : '<br>')}</p>`);
      };
      if (pp.pageBreakBefore) out.push('<div class="pagebreak" contenteditable="false"></div>');
      if (numText) {
        const r = { ...markR, ...numRPr };
        cur += `<span style="${runCss(r)}">${escHtml(numText)}</span>\t`;
      }
      // 필드(쪽 번호 등): begin~separate 사이 명령은 건너뛰고 결과만
      let inInstr = false;
      const walk = async (node, link) => {
        for (const c of Array.from(node.children)) {
          const n = c.localName;
          if (n === 'r') {
            const rPr = kid(c, 'rPr');
            const rs = kid(rPr, 'rStyle');
            const rc = rs ? chain(styles.char, wa(rs, 'val')).rPr : {};
            const r = { ...styles.defR, ...sc.rPr, ...rc, ...readRPr(rPr, theme) };
            if (r.hidden) continue;
            const css = runCss(r);
            let html = '';
            for (const x of Array.from(c.children)) {
              const xn = x.localName;
              if (xn === 'fldChar') { const t = wa(x, 'fldCharType'); if (t === 'begin') inInstr = true; else if (t === 'separate' || t === 'end') inInstr = false; continue; }
              if (inInstr) continue;
              if (xn === 't') html += escHtml(x.textContent || '');
              else if (xn === 'tab' || xn === 'ptab') html += '\t';
              else if (xn === 'br' || xn === 'cr') {
                const t = wa(x, 'type');
                if (t === 'page') {
                  if (html) { cur += css ? `<span style="${css}">${html}</span>` : html; html = ''; }
                  closeP(false);
                  out.push('<div class="pagebreak" contenteditable="false"></div>');
                } else if (t === 'column') html += '';
                else html += '<br>';
              } else if (xn === 'noBreakHyphen') html += '-';
              else if (xn === 'softHyphen') html += '';
              else if (xn === 'sym') { const ch = parseInt(wa(x, 'char') || '0', 16); if (ch) html += escHtml(String.fromCharCode(ch >= 0xF000 ? ch - 0xF000 : ch)); }
              else if (xn === 'drawing' || xn === 'pict') {
                const blip = desc(x, 'blip')[0] || desc(x, 'imagedata')[0];
                const rid = blip && (ra(blip, 'embed') || ra(blip, 'id'));
                const url = rid ? await mediaUrl(rid) : null;
                const ext = desc(x, 'extent')[0];
                let w = ext ? emuPx(ext.getAttribute('cx')) : 0, hh = ext ? emuPx(ext.getAttribute('cy')) : 0;
                if (!w) { const shp = desc(x, 'shape')[0]; const st = shp ? shp.getAttribute('style') || '' : ''; const mw = /width:([\d.]+)pt/.exec(st), mh = /height:([\d.]+)pt/.exec(st); if (mw) w = num(mw[1]) * 96 / 72; if (mh) hh = num(mh[1]) * 96 / 72; }
                if (url) html += `<img src="${url}" style="width:${Math.round(w)}px;height:${Math.round(hh)}px">`;
                else {
                  // 글상자 안 글은 살림
                  const tb = desc(x, 'txbxContent')[0];
                  if (tb) for (const tp of kids(tb, 'p')) { const t = desc(tp, 't').map((y) => y.textContent).join(''); if (t) html += escHtml(t) + ' '; }
                }
              }
            }
            if (html) {
              if (r.size && !(r.sup || r.sub)) maxSz = Math.max(maxSz, r.size);
              let seg = css ? `<span style="${css}">${html}</span>` : html;
              if (link) seg = `<a href="${escHtml(link)}">${seg}</a>`;
              cur += seg;
            }
          } else if (n === 'hyperlink') {
            const rid = ra(c, 'id');
            const href = rid && rels[rid] ? rels[rid].target : (wa(c, 'anchor') ? '#' + wa(c, 'anchor') : null);
            await walk(c, href);
          } else if (n === 'smartTag' || n === 'ins' || n === 'customXml' || n === 'sdt' || n === 'sdtContent' || n === 'fldSimple') {
            await walk(n === 'sdt' ? (kid(c, 'sdtContent') || c) : c, link);
          } else if (n === 'del' || n === 'moveFrom') continue;
        }
      };
      await walk(p, null);
      closeP(true);
      return out.join('');
    };

    const tableBlock = async (tbl, ctx) => {
      const tblPr = kid(tbl, 'tblPr');
      const ts = kid(tblPr, 'tblStyle');
      const stl = ts ? chain(styles.table, wa(ts, 'val')) : {};
      const bordersOf = (pr) => {
        const b = kid(pr, 'tblBorders') || kid(pr, 'tcBorders');
        const o = {};
        if (!b) return o;
        for (const k of ['top', 'left', 'start', 'bottom', 'right', 'end', 'insideH', 'insideV']) {
          const e = kid(b, k);
          if (!e) continue;
          const v = wa(e, 'val');
          const key = { start: 'left', end: 'right' }[k] || k;
          if (!v || v === 'nil' || v === 'none') o[key] = 'none';
          else {
            const px = Math.max(1, Math.round(num(wa(e, 'sz'), 4) / 8 * 96 / 72 * 10) / 10);
            const style = /double/.test(v) ? 'double' : /dash/i.test(v) ? 'dashed' : /dot/i.test(v) ? 'dotted' : 'solid';
            const col = wa(e, 'color') && wa(e, 'color') !== 'auto' ? '#' + wa(e, 'color') : '#000000';
            o[key] = `${style === 'double' ? Math.max(3, px) : px}px ${style} ${col}`;
          }
        }
        return o;
      };
      const tb = { ...bordersOf(stl.tblPr), ...bordersOf(tblPr) };
      const grid = kids(kid(tbl, 'tblGrid'), 'gridCol').map((g) => twPx(wa(g, 'w')));
      const cm = kid(tblPr, 'tblCellMar') || kid(stl.tblPr, 'tblCellMar');
      const mar = { top: 0, bottom: 0, left: 7.2, right: 7.2 };
      if (cm) for (const k of ['top', 'bottom', 'left', 'right', 'start', 'end']) { const e = kid(cm, k); if (e) mar[{ start: 'left', end: 'right' }[k] || k] = twPx(wa(e, 'w')); }
      const jc = kid(tblPr, 'jc');
      const align = jc ? wa(jc, 'val') : null;
      const rows = kids(tbl, 'tr');
      // 칸 자리 계산 (gridSpan, vMerge)
      const cells = [];
      rows.forEach((tr, r) => {
        let c = 0;
        const trPr = kid(tr, 'trPr');
        const gb = kid(trPr, 'gridBefore'); if (gb) c += num(wa(gb, 'val'));
        for (const tc of kids(tr, 'tc')) {
          const tcPr = kid(tc, 'tcPr');
          const span = num(wa(kid(tcPr, 'gridSpan'), 'val'), 1);
          const vm = kid(tcPr, 'vMerge');
          const vmv = vm ? (wa(vm, 'val') || 'continue') : null;
          cells.push({ tc, tcPr, r, c, cs: span, rs: 1, cont: vmv === 'continue' });
          c += span;
        }
      });
      for (const x of cells) if (x.cont) {
        const top = cells.filter((y) => y.c === x.c && y.r < x.r && !y.cont).sort((a, b) => b.r - a.r)[0];
        if (top) top.rs = x.r - top.r + 1;
      }
      const nc = Math.max(grid.length, ...rows.map((tr, r) => cells.filter((x) => x.r === r).reduce((a, x) => a + x.cs, 0)));
      const widths = Array.from({ length: nc }, (_, i) => grid[i] || 60);
      const total = widths.reduce((a, b) => a + b, 0);
      let html = `<table${align === 'center' ? ' class="tbl-center"' : align === 'right' || align === 'end' ? ' class="tbl-right"' : ''} style="width:${Math.round(total)}px"><colgroup>${widths.map((w) => `<col style="width:${Math.round(w * 10) / 10}px">`).join('')}</colgroup><tbody>`;
      for (let r = 0; r < rows.length; r++) {
        const trPr = kid(rows[r], 'trPr');
        const th = kid(trPr, 'trHeight');
        const hgt = th ? twPx(wa(th, 'val')) : 0;
        html += `<tr${hgt ? ` style="height:${Math.round(hgt)}px"` : ''}>`;
        for (const x of cells.filter((y) => y.r === r && !y.cont)) {
          const st = [];
          const cb = bordersOf(x.tcPr);
          const isTop = x.r === 0, isBot = x.r + x.rs >= rows.length, isL = x.c === 0, isR = x.c + x.cs >= nc;
          const side = (k, outer, inner) => cb[k] || (outer ? tb[k] : tb[inner]) || 'none';
          st.push(`border-top:${side('top', isTop, 'insideH')}`, `border-bottom:${side('bottom', isBot, 'insideH')}`, `border-left:${side('left', isL, 'insideV')}`, `border-right:${side('right', isR, 'insideV')}`);
          const shd = kid(x.tcPr, 'shd');
          if (shd && wa(shd, 'fill') && !/^(auto|FFFFFF)$/i.test(wa(shd, 'fill'))) st.push(`background-color:#${wa(shd, 'fill')}`);
          const va = kid(x.tcPr, 'vAlign');
          st.push(`vertical-align:${va ? ({ center: 'middle', bottom: 'bottom' }[wa(va, 'val')] || 'top') : 'top'}`);
          st.push(`padding:${mar.top}px ${mar.right}px ${mar.bottom}px ${mar.left}px`);
          let inner = '';
          prevAfter = 0;
          for (const ch of Array.from(x.tc.children)) {
            if (ch.localName === 'p') inner += await paraBlock(ch, ctx);
            else if (ch.localName === 'tbl') inner += await tableBlock(ch, ctx);
            else if (ch.localName === 'sdt') for (const q of Array.from((kid(ch, 'sdtContent') || ch).children)) { if (q.localName === 'p') inner += await paraBlock(q, ctx); }
          }
          html += `<td${x.cs > 1 ? ` colspan="${x.cs}"` : ''}${x.rs > 1 ? ` rowspan="${x.rs}"` : ''} style="${st.join(';')}">${inner || '<p><br></p>'}</td>`;
        }
        html += '</tr>';
      }
      return html + '</tbody></table>';
    };

    const body = desc(doc, 'body')[0];
    let html = '';
    const blocks = async (parent) => {
      for (const c of Array.from(parent.children)) {
        if (c.localName === 'p') html += await paraBlock(c, {});
        else if (c.localName === 'tbl') { html += await tableBlock(c, {}); prevAfter = 0; }
        else if (c.localName === 'sdt') await blocks(kid(c, 'sdtContent') || c);
        else if (c.localName === 'customXml') await blocks(c);
      }
    };
    await blocks(body);
    // 구역 설정: 마지막 sectPr (본문 끝)
    const sect = kid(body, 'sectPr') || desc(body, 'sectPr').pop();
    let page = null, mm = null;
    const settings = {};
    const hfH = {};
    if (sect) {
      const sz = kid(sect, 'pgSz'), m = kid(sect, 'pgMar');
      page = {};
      if (sz) { page.width = twMm(wa(sz, 'w')); page.height = twMm(wa(sz, 'h')); }
      if (m) {
        const top = num(wa(m, 'top')), bot = num(wa(m, 'bottom')), hd = num(wa(m, 'header'), 720), ft = num(wa(m, 'footer'), 720);
        mm = { top: Math.abs(top), bot: Math.abs(bot), hd, ft };
        page.left = twMm(wa(m, 'left')); page.right = twMm(wa(m, 'right'));
        page.top = twMm(Math.min(hd, Math.abs(top))); page.header = Math.max(0, twMm(Math.abs(top) - Math.min(hd, Math.abs(top))));
        page.bottom = twMm(Math.min(ft, Math.abs(bot))); page.footer = Math.max(0, twMm(Math.abs(bot) - Math.min(ft, Math.abs(bot))));
      }
      // 머리말·꼬리말 (기본 것만): 글과 정렬, 쪽 번호 필드
      for (const [tag, kind] of [['headerReference', 'header'], ['footerReference', 'footer']]) {
        const ref = kids(sect, tag).find((x) => (wa(x, 'type') || 'default') === 'default');
        const rel = ref && rels[ra(ref, 'id')];
        if (!rel) continue;
        const x = await txt('word/' + rel.target.replace(/^\//, '').replace(/^word\//, ''));
        if (!x) continue;
        const hd = parse(x);
        const o = { left: '', center: '', right: '', size: 9, bold: false, color: '#000000', line: false };
        let pn = null;
        // 머리말·꼬리말 글의 높이(twip): 워드는 이 글이 본문 여백을 넘으면 본문을 그만큼 밀어냄
        let hTw = 0;
        for (const p of desc(hd, 'p')) {
          if (p.parentNode && p.parentNode.localName === 'tc') continue;
          const own = readPPr(kid(p, 'pPr'));
          const sc = chain(styles.para, own.style || styles.defaultPara);
          const q = { ...styles.defP, ...sc.pPr, ...own };
          const mr = { ...styles.defR, ...sc.rPr, ...readRPr(kid(kid(p, 'pPr') || p, 'rPr'), theme) };
          let sz = 0;
          for (const r of desc(p, 'r')) { const rr = { ...mr, ...readRPr(kid(r, 'rPr'), theme) }; sz = Math.max(sz, rr.size || 0); }
          sz = Math.max(sz, mr.size || 0) || 10; // 문단 표시(¶)의 글자 크기도 줄 높이에 들어감 (워드)
          const nat = sz * lineFactor(defFont(mr));
          let lh = nat;
          if (q.line) lh = q.lineRule === 'auto' ? nat * q.line / 240 : q.lineRule === 'exact' ? q.line / 20 : Math.max(nat, q.line / 20);
          hTw += lh * 20 + (q.before || 0) + (q.after || 0);
        }
        hfH[kind] = hTw;
        for (const p of desc(hd, 'p')) {
          const pp = readPPr(kid(p, 'pPr'));
          const slot = { center: 'center', right: 'right', end: 'right' }[pp.align] || 'left';
          const instr = desc(p, 'instrText').map((i) => i.textContent).join(' ') + ' ' + desc(p, 'fldSimple').map((f) => wa(f, 'instr') || '').join(' ');
          if (/\bPAGE\b/.test(instr)) pn = slot;
          // 필드 결과(쪽 번호 숫자)는 빼고 보통 글만
          let t = '', inF = false;
          for (const r of desc(p, 'r')) {
            for (const y of Array.from(r.children)) {
              if (y.localName === 'fldChar') { const ty = wa(y, 'fldCharType'); if (ty === 'begin') inF = true; else if (ty === 'end') inF = false; continue; }
              if (inF) continue;
              if (y.localName === 't') t += y.textContent;
              else if (y.localName === 'tab') t += ' ';
            }
            const rr = readRPr(kid(r, 'rPr'), theme);
            if (rr.size) o.size = rr.size;
            if (rr.bold) o.bold = true;
          }
          if (desc(p, 'fldSimple').length) t = t.replace(/\d+/g, '');
          t = t.trim();
          if (t) o[slot] = (o[slot] ? o[slot] + ' ' : '') + t;
        }
        if (o.left || o.center || o.right) settings[kind] = o;
        if (pn) settings.pageNum = { pos: `${kind === 'header' ? 'top' : 'bottom'}-${pn}`, fmt: 'digit', deco: 'plain', start: 1 };
      }
      if (mm && page) {
        if (hfH.footer && mm.ft + hfH.footer > mm.bot) page.footer = twMm(mm.ft + hfH.footer - Math.min(mm.ft, mm.bot));
        if (hfH.header && mm.hd + hfH.header > mm.top) page.header = twMm(mm.hd + hfH.header - Math.min(mm.hd, mm.top));
      }
      const pgn = kid(sect, 'pgNumType');
      if (pgn && settings.pageNum && wa(pgn, 'start')) settings.pageNum.start = num(wa(pgn, 'start'), 1);
    }
    return { html: html || '<p><br></p>', page, settings };
  }
  return { read };
})();
