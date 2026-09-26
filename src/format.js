// 글자 모양 / 문단 모양
'use strict';
const ZWSP = '​';

const Fmt = {
  exec(cmd, val = null) {
    document.execCommand('styleWithCSS', false, true);
    document.execCommand(cmd, false, val);
  },

  // ----- 현재 커서 위치 서식 읽기 -----
  state() {
    const el = Sel.focusEl();
    if (!el || !Sel.editor.contains(el)) return null;
    const cs = getComputedStyle(el);
    const deco = decoOf(el);
    const block = Sel.block();
    const bcs = block ? getComputedStyle(block) : cs;
    let align = bcs.textAlign;
    if (block && block.classList.contains('align-distribute')) align = 'distribute';
    if (align === 'start') align = 'left';
    if (align === 'end') align = 'right';
    return {
      font: firstFamily(cs.fontFamily),
      size: Math.round(U.px2pt(parseFloat(cs.fontSize)) * 10) / 10,
      bold: parseInt(cs.fontWeight, 10) >= 600,
      italic: cs.fontStyle === 'italic',
      underline: deco.underline,
      strike: deco.strike,
      sup: deco.sup,
      sub: deco.sub,
      color: cssColorToHex(cs.color) || '#000000',
      align,
      lineHeight: lineHeightPct(block),
      style: block ? (block.dataset.style || '바탕글') : '바탕글',
      letterSpacing: letterSpacingPct(el),
      ratio: Math.round(Ratio.of(el)),
      ...charEffects(el),
    };
  },

  // ----- 글자 서식 -----
  toggle(kind) {
    const map = { bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strikeThrough', sup: 'superscript', sub: 'subscript' };
    const r = Sel.range();
    if (!r) return;
    if (kind === 'sup' || kind === 'sub') { this.script(kind); return; }
    this.exec(map[kind]);
    this.fieldsToggle(kind);
  },
  // 위/아래 첨자: 글자를 70%로 줄이고 위/아래로 (원래 크기는 data-base-size 에 기억)
  script(kind) {
    const st = Fmt.state();
    if (!st) return;
    const on = st[kind];
    const r = Sel.range();
    if (on && r && r.collapsed) {
      // 커서만 있을 때 끄기: 첨자 구간을 커서 위치에서 끊고 그 밖에 보통 글자 자리를 만든다
      const block = Sel.block();
      let anc = Sel.focusEl();
      while (anc && anc !== block && !(anc.dataset && anc.dataset.baseSize) && !/^(SUP|SUB)$/.test(anc.tagName) && !['super', 'sub'].includes(anc.style && anc.style.verticalAlign)) anc = anc.parentElement;
      if (anc && anc !== block && Sel.editor.contains(anc)) {
        const base = anc.dataset.baseSize ? parseFloat(anc.dataset.baseSize) : null;
        const tail = document.createRange();
        tail.setStart(r.startContainer, r.startOffset);
        tail.setEnd(anc, anc.childNodes.length);
        const after = anc.cloneNode(false);
        after.append(tail.extractContents());
        anc.after(after);
        const span = h('span', {}, ZWSP);
        if (base) span.style.fontSize = base + 'pt';
        anc.after(span);
        if (!after.textContent.replace(/\u200B/g, '')) after.remove();
        const nr = document.createRange();
        nr.setStart(span.firstChild, 1);
        nr.collapse(true);
        Sel.set(nr);
        return;
      }
    }
    this.styleSpans((el) => {
      const baseEl = el.closest && el.closest('[data-base-size]');
      const base = baseEl ? parseFloat(baseEl.dataset.baseSize) : Math.round(U.px2pt(parseFloat(getComputedStyle(el).fontSize)) * 2) / 2;
      if (on) return { verticalAlign: '', fontSize: base + 'pt', $base: null };
      return { verticalAlign: kind === 'sup' ? 'super' : 'sub', fontSize: Math.round(base * 0.7 * 2) / 2 + 'pt', $base: base };
    });
  },
  // 메일머지 필드(편집 불가 요소)에도 서식 반영
  fieldsInSel() {
    const r = Sel.range();
    if (!r) return [];
    return $$('.mm-field', Sel.editor).filter((f) => r.intersectsNode(f));
  },
  fieldsToggle(kind) {
    const fs = this.fieldsInSel();
    if (!fs.length) return;
    const prop = { bold: ['fontWeight', 'bold', ''], italic: ['fontStyle', 'italic', ''], underline: ['textDecoration', 'underline', ''], strike: ['textDecoration', 'line-through', ''] }[kind];
    if (!prop) return;
    const cur = (f) => (kind === 'bold' ? parseInt(getComputedStyle(f).fontWeight, 10) >= 600 : kind === 'italic' ? getComputedStyle(f).fontStyle === 'italic' : (f.style.textDecoration || '').includes(prop[1]));
    const turnOn = !cur(fs[0]);
    fs.forEach((f) => { f.style[prop[0]] = turnOn ? prop[1] : (kind === 'bold' ? 'normal' : prop[2]); });
  },
  normalChar() {
    // 보통 모양 (Alt+Shift+C): 진하게/기울임/밑줄/취소선/첨자 해제
    const st = Fmt.state();
    if (!st) return;
    if (st.bold) this.exec('bold');
    if (st.italic) this.exec('italic');
    if (st.underline) this.exec('underline');
    if (st.strike) this.exec('strikeThrough');
    if (st.sup) this.exec('superscript');
    if (st.sub) this.exec('subscript');
    if (st.ratio !== 100 || st.letterSpacing) { this.styleSpans(() => ({ '--hr': '', letterSpacing: '' })); Ratio.render(); }
  },
  color(c) { this.exec('foreColor', c); this.fieldsInSel().forEach((f) => (f.style.color = c)); },
  highlight(c) { this.exec('hiliteColor', c || 'transparent'); this.fieldsInSel().forEach((f) => (f.style.backgroundColor = c && c !== 'transparent' ? c : '')); },
  font(name) {
    if (!name) return;
    this.styleSpans((cur) => ({ fontFamily: fontStack(name) }));
  },
  size(pt) {
    pt = Math.max(1, Math.min(4096, +pt));
    if (!pt) return;
    this.styleSpans(() => ({ fontSize: pt + 'pt' }));
  },
  sizeStep(delta) {
    this.styleSpans((el) => {
      const cur = U.px2pt(parseFloat(getComputedStyle(el).fontSize));
      return { fontSize: Math.max(1, Math.round(cur) + delta) + 'pt' };
    });
  },
  spacingStep(delta) {
    let shown = null;
    this.styleSpans((el) => {
      const cur = letterSpacingPct(el);
      const next = Math.max(-50, Math.min(50, cur + delta));
      shown = next;
      return { letterSpacing: next ? (next / 100) + 'em' : '' };
    });
    if (shown != null) status(`자간 ${shown}%`);
  },
  applyCharProps(p) {
    // 글자 모양 대화상자 결과 적용
    const st = Fmt.state();
    if (!st) return;
    const styles = {};
    if (p.font) styles.fontFamily = fontStack(p.font);
    if (p.size) styles.fontSize = p.size + 'pt';
    if (p.letterSpacing != null) styles.letterSpacing = +p.letterSpacing ? (+p.letterSpacing / 100) + 'em' : '';
    if (p.ratio != null && Math.round(+p.ratio) !== st.ratio) { const v = Math.max(50, Math.min(200, Math.round(+p.ratio) || 100)); styles['--hr'] = v === 100 ? '' : String(v); }
    if (Object.keys(styles).length) this.styleSpans(() => styles);
    for (const k of ['bold', 'italic', 'underline', 'strike', 'sup', 'sub']) {
      if (p[k] != null && !!p[k] !== !!Fmt.state()[k]) this.toggle(k);
    }
    if (p.color) this.color(p.color);
    if (p.shade !== undefined) this.highlight(p.shade);
    // 그림자·외곽선·테두리
    const fx = {};
    if (p.shadow != null && (p.shadow !== !!st.shadow || (p.shadow && p.shadowColor !== st.shadow))) fx.textShadow = p.shadow ? `0.08em 0.08em 0 ${p.shadowColor || '#999999'}` : 'none';
    if (p.outline != null && p.outline !== st.outline) { fx.webkitTextStroke = p.outline ? '0.035em currentColor' : ''; fx.webkitTextFillColor = p.outline ? 'transparent' : ''; }
    if (p.border != null && (p.border !== !!st.border || (p.border && p.borderColor !== st.border))) {
      fx.border = p.border ? `1px solid ${p.borderColor || '#000000'}` : '';
      fx.padding = p.border ? '0 1px' : '';
      fx.boxDecorationBreak = p.border ? 'clone' : '';
    }
    if (Object.keys(fx).length) this.styleSpans(() => fx);
    Ratio.render();
  },

  // 선택된 텍스트에 span 스타일 적용 (접힌 선택이면 입력용 span 생성)
  styleSpans(styleFn) {
    const r = Sel.range();
    if (!r) return;
    if (r.collapsed) {
      const cur = Sel.focusEl();
      let span, basis;
      if (cur && cur.tagName === 'SPAN' && cur.textContent === ZWSP) { span = cur; basis = cur; }
      else {
        basis = cur && Sel.editor.contains(cur) ? cur : Sel.editor;
        span = h('span', {}, ZWSP);
        r.insertNode(span);
      }
      const st0 = styleFn(basis);
      if ('$base' in st0) { if (st0.$base == null) delete span.dataset.baseSize; else span.dataset.baseSize = st0.$base; delete st0.$base; }
      setStyles(span, st0);
      const nr = document.createRange();
      nr.setStart(span.firstChild, 1);
      nr.collapse(true);
      Sel.set(nr);
      return;
    }
    const nodes = textNodesInRange(r);
    if (!nodes.length) return;
    let first = null, last = null;
    for (const { node, start, end } of nodes) {
      let t = node;
      if (end < t.length) t.splitText(end);
      if (start > 0) t = t.splitText(start);
      const parent = t.parentElement;
      // 누름틀/메일머지 필드는 요소 자체에 적용
      const field = parent.closest('.mm-field');
      let target;
      if (field) target = field;
      else if (parent.classList.contains('rw') && parent.childNodes.length === 1) {
        // 장평 낱말 상자: 상자는 그대로 두고 바깥 span에 서식 (감싼 span이 이 상자만 품고 있으면 그것을 씀)
        const pp = parent.parentElement;
        if (pp && pp.tagName === 'SPAN' && pp.childNodes.length === 1 && !pp.closest('.mm-field')) target = pp;
        else { target = h('span'); parent.before(target); target.append(parent); }
      } else if (parent.tagName === 'SPAN' && parent.childNodes.length === 1) target = parent;
      else {
        target = h('span');
        t.parentNode.insertBefore(target, t);
        target.append(t);
      }
      const st = styleFn(target);
      if ('$base' in st) {
        if (st.$base == null) delete target.dataset.baseSize; else target.dataset.baseSize = st.$base;
        target.querySelectorAll('[data-base-size]').forEach((d) => delete d.dataset.baseSize);
        delete st.$base;
      }
      for (const [k, v] of Object.entries(st)) {
        setStyles(target, { [k]: v });
        // 하위 요소의 같은 속성 제거 (덮어쓰기)
        target.querySelectorAll('*').forEach((d) => { if (d.style) setStyles(d, { [k]: '' }); });
      }
      if (!first) first = target;
      last = target;
    }
    const nr = document.createRange();
    nr.setStart(first, 0);
    nr.setEnd(last, last.childNodes.length);
    Sel.set(nr);
  },

  // 모양 복사 (Alt+C): 커서만 두면 복사, 블록을 잡으면 붙이기. 개체(그림·도형·글상자)는 개체 모양.
  copied: null,
  copiedObj: null,
  async copyOrPasteShape() {
    const obj = Img.selected;
    if (obj) {
      let act = 'copy';
      if (this.copiedObj) {
        const v = await Dialog.form('모양 복사 (개체)', [
          { name: 'act', label: '할 일', type: 'select', options: [['paste', '복사해 둔 개체 모양을 이 개체에 적용'], ['copy', '이 개체의 모양을 새로 복사']], value: 'paste' },
        ], { okLabel: '확인', width: 420 });
        if (!v) return;
        act = v.act;
      }
      if (act === 'copy') { this.copiedObj = Look.copy(obj); status('개체 모양(테두리·그림자·여백·선·면)을 복사했습니다. 다른 개체를 선택하고 Alt+C를 누르면 적용됩니다.'); return; }
      History.checkpoint();
      Look.paste(obj, this.copiedObj);
      Img.drawBox();
      App.changed();
      status('복사한 개체 모양을 적용했습니다.');
      return;
    }
    const r = Sel.range();
    if (!r) return;
    if (r.collapsed || !this.copied) {
      const el = Sel.focusEl();
      const v = await Dialog.form('모양 복사', [
        { name: 'what', label: '복사할 모양', type: 'select', options: [['both', '글자 모양과 문단 모양 둘 다'], ['char', '글자 모양만'], ['para', '문단 모양만']], value: (this.copied && this.copied.what) || 'both' },
      ], { okLabel: '복사', width: 380, note: '블록을 잡은 뒤 다시 Alt+C를 누르면 복사한 모양이 적용됩니다.' });
      if (!v) return;
      const cs = getComputedStyle(el);
      const deco = decoOf(el);
      const block = Sel.block();
      const fx = charEffects(el);
      const bg = bgOf(el);
      this.copied = {
        what: v.what,
        char: {
          fontFamily: cs.fontFamily, fontSize: cs.fontSize,
          fontWeight: cs.fontWeight, fontStyle: cs.fontStyle, color: cs.color,
          letterSpacing: cs.letterSpacing === 'normal' ? '' : cs.letterSpacing,
          textDecoration: [deco.underline && 'underline', deco.strike && 'line-through'].filter(Boolean).join(' ') || 'none',
          backgroundColor: bg || '',
          textShadow: fx.shadow ? `0.08em 0.08em 0 ${fx.shadow}` : 'none',
          webkitTextStroke: fx.outline ? '0.035em currentColor' : '',
          webkitTextFillColor: fx.outline ? 'transparent' : '',
          border: fx.border ? `1px solid ${fx.border}` : '',
          padding: fx.border ? '0 1px' : '',
        },
        para: block && block !== Sel.editor ? {
          style: { textAlign: block.style.textAlign, lineHeight: block.style.lineHeight, marginLeft: block.style.marginLeft, marginRight: block.style.marginRight, textIndent: block.style.textIndent, marginTop: block.style.marginTop, marginBottom: block.style.marginBottom, paddingTop: block.style.paddingTop, paddingBottom: block.style.paddingBottom },
          tabs: block.dataset.tabs || '', distribute: block.classList.contains('align-distribute'), pstyle: block.dataset.style || '', sfile: 'sfile' in block.dataset,
        } : null,
      };
      status('모양을 복사했습니다. 블록을 지정한 뒤 다시 Alt+C를 누르면 적용됩니다.');
      return;
    }
    const cp = this.copied;
    if (cp.what !== 'para') this.styleSpans(() => cp.char);
    if (cp.what !== 'char' && cp.para) {
      const saved = Sel.save();
      this.eachBlock((b) => {
        Object.assign(b.style, cp.para.style);
        if (cp.para.tabs) b.dataset.tabs = cp.para.tabs; else delete b.dataset.tabs;
        b.classList.toggle('align-distribute', cp.para.distribute);
        if (cp.para.pstyle) b.dataset.style = cp.para.pstyle; else delete b.dataset.style;
        if (cp.para.sfile) b.dataset.sfile = ''; else delete b.dataset.sfile;
      });
      Sel.restore(saved);
      TabStops.layoutAll();
    }
    status('복사한 모양을 적용했습니다.');
  },

  // ----- 문단 서식 -----
  eachBlock(fn) {
    let blocks = Sel.blocks();
    if (!blocks.length) {
      Para.ensure();
      blocks = Sel.blocks();
    }
    blocks.forEach((b) => {
      if ((b.tagName === 'TD' || b.tagName === 'TH') && !Array.from(b.children).some((x) => isBlock(x))) {
        // 셀에 직접 있는 텍스트는 문단으로 감싸기
        const p = h('p');
        while (b.firstChild) p.append(b.firstChild);
        b.append(p);
        b = p;
      }
      fn(b);
    });
  },
  align(a) {
    this.eachBlock((b) => {
      b.classList.toggle('align-distribute', a === 'distribute');
      b.style.textAlign = a === 'distribute' ? '' : a;
      if (a === 'justify' && !b.closest('td')) b.style.textAlign = '';
    });
  },
  lineHeight(pct) {
    pct = Math.max(50, Math.min(500, Math.round(pct)));
    this.eachBlock((b) => { b.style.lineHeight = pct === 160 ? '' : String(pct / 100); });
  },
  lineHeightStep(d) {
    const b = Sel.block();
    const cur = lineHeightPct(b);
    this.lineHeight(cur + d);
  },
  marginStep(dPt) {
    this.eachBlock((b) => {
      const cur = U.px2pt(parseFloat(getComputedStyle(b).marginLeft) || 0);
      const v = Math.max(0, Math.round(cur + dPt));
      b.style.marginLeft = v ? v + 'pt' : '';
    });
  },
  // 한글 방식 첫 줄 들여쓰기(+1)/내어쓰기(-1): 한 번에 1pt씩.
  // 한글 모델: 왼쪽 여백 L, 첫 줄 값 I (양수=들여쓰기, 음수=내어쓰기)
  //   첫 줄 위치 = L + max(I,0), 나머지 줄 위치 = L + max(-I,0)
  // CSS 로는 margin-left = L + max(-I,0), text-indent = I
  indentStep(dir) {
    this.eachBlock((b) => {
      const cs = getComputedStyle(b);
      const px2pt = (v) => U.px2pt(parseFloat(v) || 0);
      const step = 1; // 한 번에 1pt씩
      const I = px2pt(cs.textIndent);
      const M = px2pt(cs.marginLeft);
      const L = Math.max(0, M - Math.max(-I, 0));
      let I2 = Math.round((I + dir * step) * 2) / 2;
      if (Math.abs(I2) < 0.25) I2 = 0;
      const M2 = L + Math.max(-I2, 0);
      b.style.textIndent = I2 ? I2 + 'pt' : '';
      b.style.marginLeft = M2 ? Math.round(M2 * 2) / 2 + 'pt' : '';
    });
  },
  applyParaProps(p) {
    this.eachBlock((b) => {
      if (p.align) {
        b.classList.toggle('align-distribute', p.align === 'distribute');
        b.style.textAlign = p.align === 'distribute' ? '' : p.align;
      }
      if (p.left != null) b.style.marginLeft = +p.left ? p.left + 'pt' : '';
      if (p.right != null) b.style.marginRight = +p.right ? p.right + 'pt' : '';
      if (p.indent != null) b.style.textIndent = +p.indent ? p.indent + 'pt' : '';
      if (p.lineHeight != null) b.style.lineHeight = +p.lineHeight === 160 ? '' : String(p.lineHeight / 100);
      // 문단 위·아래는 안쪽 여백으로: 바깥 여백은 앞뒤 문단끼리 겹쳐(큰 쪽만) 보이므로 한글처럼 더해지게
      if (p.before != null) { b.style.marginTop = ''; b.style.paddingTop = +p.before ? p.before + 'pt' : ''; }
      if (p.after != null) { b.style.marginBottom = ''; b.style.paddingBottom = +p.after ? p.after + 'pt' : ''; }
    });
  },
  setStyle(name) {
    this.eachBlock((b) => {
      delete b.dataset.sfile;
      if (name === '바탕글') delete b.dataset.style;
      else b.dataset.style = name;
    });
  },
  list(kind) {
    this.exec(kind === 'ol' ? 'insertOrderedList' : 'insertUnorderedList');
  },
};

const STYLES = ['바탕글', '본문', '개요 1', '개요 2', '개요 3', '개요 4', '개요 5', '개요 6', '개요 7'];

const Para = {
  // 편집기 최상위에 떠도는 텍스트를 문단으로 감싸고 빈 문서면 문단 하나 생성
  ensure() {
    const ed = Sel.editor;
    let run = null;
    for (const n of Array.from(ed.childNodes)) {
      const inline = n.nodeType === 3 || (n.nodeType === 1 && !isBlock(n) && !n.classList.contains('pagebreak'));
      if (inline) {
        if (n.nodeType === 3 && !n.textContent.trim() && !run) { if (!n.textContent.length) n.remove(); continue; }
        if (!run) { run = h('p'); ed.insertBefore(run, n); }
        run.append(n);
      } else run = null;
    }
    if (!ed.firstElementChild) {
      const p = h('p', {}, h('br'));
      ed.append(p);
      Sel.caretInto(p);
    }
    // 문서 끝이 표/쪽 나누기이면 뒤에 빈 문단
    const last = ed.lastElementChild;
    if (last && (last.tagName === 'TABLE' || last.classList.contains('pagebreak'))) ed.append(h('p', {}, h('br')));
    const first = ed.firstElementChild;
    if (first && first.tagName === 'TABLE') ed.insertBefore(h('p', {}, h('br')), first);
  },
};

function firstFamily(ff) {
  return (ff || '').split(',')[0].trim().replace(/^["']|["']$/g, '');
}
function fontStack(name) {
  const generic = /명조|바탕|Batang|Myeongjo|Serif|Times|궁서/i.test(name) ? 'serif' : 'sans-serif';
  return `"${name}", ${generic}`;
}
function decoOf(el) {
  const res = { underline: false, strike: false, sup: false, sub: false };
  const ed = Sel.editor;
  for (let e = el; e && e !== ed && e.nodeType === 1; e = e.parentElement) {
    const cs = getComputedStyle(e);
    const line = cs.textDecorationLine || '';
    if (line.includes('underline')) res.underline = true;
    if (line.includes('line-through')) res.strike = true;
    if (/^(U|INS)$/.test(e.tagName)) res.underline = true;
    if (/^(S|STRIKE|DEL)$/.test(e.tagName)) res.strike = true;
    if (!res.sup && !res.sub) {
      if (e.tagName === 'SUP' || cs.verticalAlign === 'super') res.sup = true;
      else if (e.tagName === 'SUB' || cs.verticalAlign === 'sub') res.sub = true;
    }
    if (isBlock(e)) break;
  }
  return res;
}
function bgOf(el) {
  const ed = Sel.editor;
  for (let e = el; e && e !== ed && e.nodeType === 1; e = e.parentElement) {
    if (isBlock(e)) break;
    const c = cssColorToHex(getComputedStyle(e).backgroundColor);
    if (c) return c;
  }
  return null;
}
function lineHeightPct(block) {
  for (let e = block; e && e !== Sel.editor.parentElement; e = e.parentElement) {
    if (e.style && e.style.lineHeight) {
      const v = e.style.lineHeight;
      if (v.endsWith('%')) return parseFloat(v);
      if (/^[\d.]+$/.test(v)) return Math.round(parseFloat(v) * 100);
      if (v.endsWith('px') || v.endsWith('pt')) {
        const fs = parseFloat(getComputedStyle(e).fontSize);
        const px = v.endsWith('pt') ? U.pt2px(parseFloat(v)) : parseFloat(v);
        return Math.round(px / fs * 100);
      }
    }
    if (e === Sel.editor) break;
  }
  return 160;
}
// style 적용 (--로 시작하는 사용자 속성도)
function setStyles(el, obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('--')) { if (v === '' || v == null) el.style.removeProperty(k); else el.style.setProperty(k, v); }
    else el.style[k] = v;
  }
}
function letterSpacingPct(el) {
  const cs = getComputedStyle(el);
  if (!cs.letterSpacing || cs.letterSpacing === 'normal') return 0;
  return Math.round(parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize) * 100);
}
// 범위 안의 텍스트 노드 조각 목록
function textNodesInRange(r) {
  const out = [];
  const root = r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer.parentNode : r.commonAncestorContainer;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (!r.intersectsNode(n)) continue;
    let start = 0, end = n.length;
    if (n === r.startContainer) start = r.startOffset;
    if (n === r.endContainer) end = r.endOffset;
    if (end <= start) continue;
    out.push({ node: n, start, end });
  }
  // 필드 내부 텍스트는 필드 하나로
  const seen = new Set();
  return out.filter((x) => {
    const f = x.node.parentElement.closest('.mm-field');
    if (!f) return true;
    if (seen.has(f)) return false;
    seen.add(f);
    x.start = 0; x.end = x.node.length;
    return true;
  });
}

// 글자 효과 (그림자 색, 외곽선, 테두리 색) — 없으면 null/false
function charEffects(el) {
  const cs = getComputedStyle(el);
  let shadow = null;
  if (cs.textShadow && cs.textShadow !== 'none') {
    const m = cs.textShadow.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/i);
    shadow = m ? cssColorToHex(m[0]) || '#999999' : '#999999';
  }
  const outline = parseFloat(cs.webkitTextStrokeWidth) > 0;
  let border = null;
  const block = el.closest && el.closest('p, li, td, th, h1, h2, h3, h4, h5, h6, .tb-body, #editor');
  for (let e = el; e && e !== block && e.nodeType === 1; e = e.parentElement) {
    if (e.tagName !== 'SPAN' || e.classList.contains('tab') || e.classList.contains('nobj')) continue;
    const c = getComputedStyle(e);
    if (c.borderTopStyle !== 'none' && parseFloat(c.borderTopWidth) > 0) { border = cssColorToHex(c.borderTopColor) || '#000000'; break; }
  }
  return { shadow, outline, border };
}
