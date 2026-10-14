// 마크다운(.md) 불러오기·저장
// - 불러올 때 블록(제목·문단·목록·표·인용·코드·구분선·HTML)마다 원문(data-md)과 앞 빈 줄(data-mdgap)을 기억
// - 저장할 때 고치지 않은 블록은 원문 그대로, 고친 블록만 새로 md로 만듦 → 형식이 틀어지지 않음
// - md 문법에 없는 서식(색·글꼴·크기·밑줄·위/아래 첨자·정렬)은 HTML 꼬리표로 함께 저장
'use strict';
const MD = {
  // ================= md → 편집기 =================
  // baseDir: md 파일이 있는 폴더 (그림 상대 경로용)
  toHtml(src) {
    const text = src.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
    const lines = text.split('\n');
    const blocks = [];
    let i = 0;
    let gap = '';
    const isBlank = (l) => /^\s*$/.test(l);
    const fence = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)?.*$/;
    const atx = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
    const hr = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
    const listRe = /^( *)([-*+]|\d{1,9}[.)])([ \t]+|$)(.*)$/;
    const tableSep = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
    const htmlStart = /^ {0,3}<(p|div|table|center|h[1-6]|ul|ol|blockquote|pre|details|hr|br|img|figure|section)\b/i;
    const startsBlock = (l, next) => /^ {0,3}<!--/.test(l) || fence.test(l) || atx.test(l) || hr.test(l) || /^ {0,3}>/.test(l) || listRe.test(l) || htmlStart.test(l) || (l.includes('|') && next != null && tableSep.test(next) && next.includes('-'));
    const push = (type, srcLines, extra = {}) => { blocks.push({ type, src: srcLines.join('\n'), gap, ...extra }); gap = ''; };

    // 머리 정보(front matter)
    if (lines[0] === '---') {
      let j = 1;
      while (j < lines.length && lines[j] !== '---' && lines[j] !== '...') j++;
      if (j < lines.length) { push('front', lines.slice(0, j + 1)); i = j + 1; }
    }
    while (i < lines.length) {
      const l = lines[i];
      if (isBlank(l)) { gap += l + '\n'; i++; continue; }
      let m;
      if ((m = fence.exec(l))) {
        const mark = m[1];
        let j = i + 1;
        while (j < lines.length && !new RegExp('^ {0,3}' + mark[0] + '{' + mark.length + ',}\\s*$').test(lines[j])) j++;
        push('code', lines.slice(i, Math.min(j + 1, lines.length)), { lang: m[2] || '', fence: mark });
        i = j + 1; continue;
      }
      if ((m = atx.exec(l))) { push('h', [l], { level: m[1].length, inner: m[2] || '' }); i++; continue; }
      if (hr.test(l)) { push('hr', [l]); i++; continue; }
      if (/^ {0,3}>/.test(l)) {
        let j = i;
        while (j < lines.length && !isBlank(lines[j]) && (/^ {0,3}>/.test(lines[j]) || (j > i && !startsBlock(lines[j], lines[j + 1])))) j++;
        // 인용 안의 빈 줄('>'만 있는 줄)도 같은 인용
        while (j < lines.length && /^ {0,3}>/.test(lines[j])) j++;
        push('quote', lines.slice(i, j)); i = j; continue;
      }
      if (/^ {0,3}<!--/.test(l)) {
        let j = i;
        while (j < lines.length && !lines[j].includes('-->')) j++;
        push('raw', lines.slice(i, Math.min(j + 1, lines.length))); i = j + 1; continue;
      }
      if (htmlStart.test(l)) {
        let j = i + 1;
        while (j < lines.length && !isBlank(lines[j])) j++;
        push('html', lines.slice(i, j)); i = j; continue;
      }
      if (l.includes('|') && i + 1 < lines.length && tableSep.test(lines[i + 1]) && lines[i + 1].includes('-')) {
        let j = i + 2;
        while (j < lines.length && !isBlank(lines[j]) && lines[j].includes('|')) j++;
        push('table', lines.slice(i, j)); i = j; continue;
      }
      if (listRe.test(l)) {
        let j = i + 1;
        const baseInd = listRe.exec(l)[1].length;
        const kind = (x) => { const mm = listRe.exec(x); return /\d/.test(mm[2]) ? 'o' + mm[2].slice(-1) : mm[2]; };
        const k0 = kind(l);
        const sameTop = (x) => { const mm = listRe.exec(x); return !mm || mm[1].length > baseInd + 1 || kind(x) === k0; };
        while (j < lines.length) {
          const x = lines[j];
          if (isBlank(x)) {
            // 빈 줄 뒤에 목록이 이어지면 같은 목록
            let k = j; while (k < lines.length && isBlank(lines[k])) k++;
            if (k < lines.length && ((listRe.test(lines[k]) && listRe.exec(lines[k])[1].length >= baseInd && sameTop(lines[k])) || /^ {2,}\S/.test(lines[k]))) { j = k; continue; }
            break;
          }
          if (listRe.test(x) && !sameTop(x)) break;
          if (listRe.test(x) || /^\s+\S/.test(x)) { j++; continue; }
          if (atx.test(x) || hr.test(x) || fence.test(x) || /^ {0,3}>/.test(x) || htmlStart.test(x)) break;
          j++; // 게으른 이어 쓰기
        }
        push('list', lines.slice(i, j)); i = j; continue;
      }
      // 문단 (setext 제목 포함)
      let j = i + 1;
      while (j < lines.length && !isBlank(lines[j]) && !startsBlock(lines[j], lines[j + 1])) {
        if (/^ {0,3}=+\s*$/.test(lines[j]) || /^ {0,3}-+\s*$/.test(lines[j])) break;
        j++;
      }
      if (j < lines.length && (/^ {0,3}=+\s*$/.test(lines[j]) || (/^ {0,3}-+\s*$/.test(lines[j]) && j > i))) {
        push('h', lines.slice(i, j + 1), { level: /=/.test(lines[j]) ? 1 : 2, inner: lines.slice(i, j).join('\n') });
        i = j + 1; continue;
      }
      push('p', lines.slice(i, j)); i = j;
    }
    MD._tailGap = gap;
    return blocks;
  },

  // 블록 → 편집기 요소
  blockEl(b) {
    const tpl = document.createElement('template');
    let html = '';
    const inl = (s) => this.inline(s);
    const softJoin = (ls) => this.inlineLines(ls);
    switch (b.type) {
      case 'front':
      case 'code': {
        const ls = b.src.split('\n');
        const body = b.type === 'front' ? ls.slice(1, -1) : ls.slice(1, /^ {0,3}(`{3,}|~{3,})\s*$/.test(ls[ls.length - 1]) ? -1 : undefined);
        html = `<p data-mt="${b.type}"${b.lang ? ` data-lang="${escHtml(b.lang)}"` : ''}${b.fence && b.fence !== '```' ? ` data-fence="${b.fence}"` : ''}${b.type === 'code' && /^ {0,3}(`{3,}|~{3,})\s*$/.test(ls[ls.length - 1]) && ls.length > 1 && ls[ls.length - 1].trim() !== (b.fence || '```') ? ` data-fenceend="${ls[ls.length - 1].trim()}"` : ''}>${body.map((x) => escHtml(x) || '').join('<br>') || '<br>'}</p>`;
        break;
      }
      case 'h': {
        const lv = Math.min(6, b.level);
        const inner = b.inner.split('\n');
        const ul = b.src.split('\n').length > 1 && /^ {0,3}(=+|-+)\s*$/.test(b.src.split('\n').pop()) ? b.src.split('\n').pop() : '';
        html = `<p data-style="개요 ${lv}" data-mt="h"${ul ? ` data-mdul="${ul}"` : ''}>${softJoin(inner) || '<br>'}</p>`;
        break;
      }
      case 'hr': html = '<p data-mt="hr"><br></p>'; break;
      case 'quote': {
        const ls = b.src.split('\n').map((x) => x.replace(/^ {0,3}> ?/, ''));
        const parts = [];
        ls.forEach((x) => parts.push(/^\s*$/.test(x) ? '' : inl(x)));
        html = `<p data-mt="quote">${parts.map((x, k) => (k ? (x === '' || parts[k - 1] === '' ? '<br>' : '<br class="md-soft">') : '') + x).join('') || '<br>'}</p>`;
        break;
      }
      case 'html': {
        if (/^\s*<div[^>]*page-break-after\s*:\s*always[^>]*>\s*<\/div>\s*$/i.test(b.src)) { html = '<div class="pagebreak" contenteditable="false"></div>'; break; }
        // md 안에 들어 있는 정렬 문단 등: <p align="center"> → 문단 정렬
        const fixed = b.src.replace(/<(p|div)([^>]*?)\salign\s*=\s*["']?(left|center|right|justify)["']?([^>]*)>/gi, (m0, t, a1, al, a2) => `<${t}${a1}${a2} style="text-align:${al.toLowerCase()}">`);
        html = sanitizeHtml(fixed);
        break;
      }
      case 'raw': html = `<p data-mt="raw">${b.src.split('\n').map((x) => escHtml(x)).join('<br>') || '<br>'}</p>`; break;
      case 'table': html = this.tableHtml(b.src); break;
      case 'list': html = this.listHtml(b.src); break;
      default: html = `<p>${softJoin(b.src.split('\n')) || '<br>'}</p>`;
    }
    tpl.innerHTML = html;
    let els = Array.from(tpl.content.children);
    if (!els.length) {
      // 보여 줄 수 없는 HTML(주석·스크립트 등): 원문을 그대로 회색 글로 보여 주고 그대로 저장
      tpl.innerHTML = `<p data-mt="raw">${b.src.split('\n').map((x) => escHtml(x)).join('<br>')}</p>`;
      els = Array.from(tpl.content.children);
    }
    // 블록 원문은 요소가 하나일 때만 기억 (여러 요소로 풀린 HTML 블록은 저장할 때 새로 만듦)
    if (els.length === 1) { els[0].setAttribute('data-md', b.src); }
    els[0].setAttribute('data-mdgap', b.gap);
    return els;
  },

  // 여러 줄 글(문단·목록 항목) → HTML: 줄 끝 두 칸/백슬래시는 강제 줄바꿈, 나머지는 부드러운 줄바꿈
  inlineLines(ls) {
    const inl = (x) => this.inline(x);
    return inl(ls.map((x, k) => (k < ls.length - 1 ? x.replace(/^\s+/, '').replace(/( {2,}|\\)$/, '\u0004').replace(/([^\u0004])$/, '$1\u0003') : x.replace(/^\s+/, ''))).join('')).replace(/\u0004/g, '<br>').replace(/\u0003/g, '<br class="md-soft">');;
  },
  // 글자 단위 md → HTML
  inline(s) {
    const keep = [];
    const ph = (h) => { keep.push(h); return `\u0001${keep.length - 1}\u0002`; };
    // 코드
    s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (m0, t, c) => ph(`<span class="md-code">${escHtml(c.replace(/^ (.*) $/, '$1'))}</span>`));
    // 백슬래시 탈출
    s = s.replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, (m0, c) => ph(escHtml(c)));
    // 허용하는 HTML 꼬리표는 그대로, 나머지 <, &는 글자로
    s = s.replace(/<\/?(span|u|ins|sup|sub|br|mark|b|i|strong|em|s|del|strike|font|a|small|big|kbd)\b[^>]*>/gi, (m0) => ph(m0));
    s = s.replace(/<(https?:\/\/[^>\s]+)>/g, (m0, u) => ph(`<a href="${escHtml(u)}" data-auto="1">${escHtml(u)}</a>`));
    s = s.replace(/&(?![a-zA-Z]+;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // 그림·링크
    s = s.replace(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+["']([^"']*)["'])?\s*\)/g, (m0, alt, u, ttl) => ph(`<img alt="${alt}" data-mdsrc="${u}"${ttl ? ` data-mdtitle="${ttl}"` : ''} src="${/^(https?:|data:)/i.test(u) ? u : 'data:image/gif;base64,R0lGODlhAQABAAAAACw='}">`));
    s = s.replace(/\[([^\]]+)\]\(\s*<?([^)\s>]+)>?(?:\s+["']([^"']*)["'])?\s*\)/g, (m0, t, u) => `<a href="${u}">${t}</a>`);
    // 굵게·기울임·취소선
    s = s.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, (m0, mk, t) => (mk === '__' ? `<b data-mk="_">${t}</b>` : `<b>${t}</b>`));
    s = s.replace(/(^|[^\w*])\*(?=\S)([^*]*?\S)\*(?!\*)/g, '$1<i>$2</i>');
    s = s.replace(/(^|[^\w_])_(?=\S)([^_]*?\S)_(?![\w_])/g, '$1<i data-mk="_">$2</i>');
    s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<s>$1</s>');
    // 줄 끝 강제 줄바꿈 (두 칸 띄움 / 백슬래시)
    s = s.replace(/( {2,}|\\)$/, '');
    s = s.replace(/\u0001(\d+)\u0002/g, (m0, k) => keep[+k]);
    s = s.replace(/\u0001(\d+)\u0002/g, (m0, k) => keep[+k]);
    return s;
  },

  splitRow(line) {
    let t = line.trim();
    if (t.startsWith('|')) t = t.slice(1);
    if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
    const out = []; let cur = '';
    for (let k = 0; k < t.length; k++) {
      if (t[k] === '\\' && t[k + 1] === '|') { cur += '|'; k++; continue; }
      if (t[k] === '|') { out.push(cur.trim()); cur = ''; continue; }
      cur += t[k];
    }
    out.push(cur.trim());
    return out;
  },
  tableHtml(src) {
    const ls = src.split('\n');
    const head = this.splitRow(ls[0]);
    const al = this.splitRow(ls[1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /^-+:$/.test(c) ? 'right' : /^:-+$/.test(c) ? 'left' : ''));
    const rows = ls.slice(2).map((l) => this.splitRow(l));
    const n = head.length;
    const cell = (c, k, th) => `<td${th ? ' data-mdth=""' : ''}><p${al[k] ? ` style="text-align:${al[k]}"` : ''}>${this.inline(c.replace(/<br\s*\/?>/gi, '\n')).replace(/\n/g, '<br>') || '<br>'}</p></td>`;
    const tr = (cells, th) => `<tr>${Array.from({ length: n }, (_, k) => cell(cells[k] || '', k, th)).join('')}</tr>`;
    return `<table class="md-table" data-mdal="${al.join(',')}" data-mdsep="${escHtml(ls[1])}" style="width:100%"><tbody>${tr(head, true)}${rows.map((r) => tr(r)).join('')}</tbody></table>`;
  },
  listHtml(src) {
    const ls = src.split('\n');
    const re = /^( *)([-*+]|\d{1,9}[.)])([ \t]+|$)(.*)$/;
    const items = [];
    for (const l of ls) {
      const m = re.exec(l);
      if (m) items.push({ ind: m[1].length, mk: m[2], text: [m[4]] });
      else if (items.length) items[items.length - 1].text.push(l.replace(/^\s+/, ''));
    }
    // 들여쓰기로 단계 나누기
    const build = (start, ind) => {
      let html = '';
      let k = start;
      const first = items[start];
      const ordered = /\d/.test(first.mk);
      const tag = ordered ? 'ol' : 'ul';
      const startNum = ordered ? parseInt(first.mk, 10) : 1;
      html += `<${tag} data-mk="${escHtml(ordered ? first.mk.replace(/\d+/, '') : first.mk)}"${ordered && startNum !== 1 ? ` start="${startNum}"` : ''}>`;
      while (k < items.length && items[k].ind >= ind) {
        const it = items[k];
        if (it.ind > ind) { k++; continue; }
        let txt = it.text.filter((x, q) => q === 0 || x !== '');
        let task = '';
        const tm = /^\[([ xX])\]\s+(.*)$/.exec(txt[0]);
        if (tm) { task = tm[1] === ' ' ? ' ' : 'x'; txt = [tm[2], ...txt.slice(1)]; }
        let inner = this.inlineLines(txt) || '<br>';
        if (task) inner = `<span class="md-task" contenteditable="false" data-done="${task === 'x' ? 1 : 0}">${task === 'x' ? '☑' : '☐'}</span> ` + inner;
        k++;
        if (k < items.length && items[k].ind > ind) {
          const sub = build(k, items[k].ind);
          inner += sub.html;
          k = sub.next;
        }
        html += `<li${task ? ` data-task="${task}"` : ''}>${inner}</li>`;
      }
      html += `</${tag}>`;
      return { html, next: k };
    };
    let html = '';
    let k = 0;
    while (k < items.length) { const r = build(k, items[k].ind); html += r.html; k = r.next; if (k < items.length && k === r.next && items[k].ind < (items[k - 1] ? items[k - 1].ind : 0)) continue; }
    return html;
  },

  // 문서 전체 불러오기 (그림은 md 파일 기준 상대 경로를 읽어 넣음)
  async load(text, filePath) {
    const blocks = this.toHtml(text);
    const frag = document.createDocumentFragment();
    for (const b of blocks) this.blockEl(b).forEach((e) => frag.append(e));
    const box = document.createElement('div');
    box.append(frag);
    if (!box.firstElementChild) box.innerHTML = '<p><br></p>';
    const dir = filePath ? filePath.replace(/[\\/][^\\/]*$/, '') : '';
    for (const img of box.querySelectorAll('img[data-mdsrc]')) {
      const u = img.dataset.mdsrc;
      if (/^(https?:|data:)/i.test(u)) continue;
      try {
        const p = /^([a-zA-Z]:[\\/]|[\\/])/.test(u) ? u : dir + '/' + decodeURIComponent(u);
        const f = await window.native.readFile(p);
        img.src = bytesToDataURL(f.data, mimeFromName(p));
      } catch { /* 그림 파일 없음 — 자리만 */ }
    }
    return { html: box.innerHTML, tailGap: this._tailGap || '' };
  },
  // 불러온 뒤(편집기에 그려진 뒤) 블록마다 '지금 모양의 md' 지문을 기억 → 저장할 때 바뀌었는지 판단
  stamp(root = Sel.editor) {
    for (const el of Array.from(root.children)) {
      if (!el.hasAttribute('data-md')) continue;
      el.setAttribute('data-mdh', this.hash(this.blockToMd(el, { forStamp: true })));
    }
  },
  hash(s) { let h = 5381; for (let k = 0; k < s.length; k++) h = ((h * 33) ^ s.charCodeAt(k)) >>> 0; return h.toString(36) + '.' + s.length; },

  // ================= 편집기 → md =================
  async save(filePath, o = {}) {
    const ed = Sel.editor;
    const out = [];
    const imgs = [];
    this._imgCtx = { filePath, imgs, n: 0 };
    const done = [];
    let first = true;
    let prevType = '';
    for (const el of Array.from(ed.children)) {
      if (el.matches('#print-cover, .pg-cover')) continue;
      let md;
      const unchanged = el.hasAttribute('data-md') && el.getAttribute('data-mdh') === this.hash(this.blockToMd(el, { forStamp: true }));
      if (unchanged) md = el.getAttribute('data-md');
      else md = this.blockToMd(el);
      if (md == null) continue;
      if (md === '' && !unchanged) continue; // 빈 문단은 md에 남지 않음
      let gap = el.getAttribute('data-mdgap');
      const type = this.typeOf(el);
      // 새로 생긴/고친 문단이 앞 문단에 붙어 버리지 않게 빈 줄 하나
      if (gap == null || (!unchanged && gap === '' && !first && type === 'p' && /^(p|ul|ol)$/.test(prevType))) gap = first ? '' : '\n';
      if (first) gap = el.getAttribute('data-mdgap') || '';
      out.push((first ? '' : '\n') + gap + md);
      done.push([el, md, gap]);
      first = false;
      prevType = type;
    }
    let text = out.join('') + (o.tail != null ? o.tail : '\n');
    if (!out.length) text = '';
    // 새로 넣은 그림은 md 옆에 파일로
    for (const im of imgs) await window.native.writeFile(im.path, im.bytes);
    // 저장한 모양을 새 원문으로 기억 (다음 저장 때 그대로)
    for (const [el, md, gap] of done) { el.setAttribute('data-md', md); el.setAttribute('data-mdgap', gap); }
    this.stamp(ed);
    return text;
  },
  typeOf(el) {
    if (el.tagName === 'P' && !el.dataset.mt && !/^개요/.test(el.dataset.style || '') && !el.style.textAlign) return 'p';
    return el.tagName.toLowerCase() + (el.dataset.mt || '');
  },
  // md 문서에서 Enter로 새로 생긴 문단: 원문 기억은 지우고, 제목·구분선 뒤의 빈 문단은 보통 문단으로
  afterEnter() {
    const r = Sel.range();
    if (!r) return;
    const blk = blockOf(r.startContainer);
    if (!blk || blk === Sel.editor) return;
    const top = blk.parentElement === Sel.editor ? blk : null;
    const prev = top && top.previousElementSibling;
    [blk, top].forEach((x) => x && ['data-md', 'data-mdh', 'data-mdgap'].forEach((a) => x.removeAttribute(a)));
    if (top && prev && prev.getAttribute('data-md') != null && prev.getAttribute('data-md') === top.getAttribute('data-md')) top.removeAttribute('data-md');
    if (top && !top.textContent.replace(/[\s\u200B]/g, '') && !top.querySelector('img')) {
      if (top.dataset.mt === 'hr' || top.dataset.mt === 'h') { top.removeAttribute('data-mt'); top.removeAttribute('data-style'); }
    }
  },

  // 블록 하나 → md
  blockToMd(el, opt = {}) {
    if (el.classList.contains('pagebreak')) return '<div style="page-break-after:always"></div>';
    if (el.classList.contains('colbreak')) return '';
    if (el.tagName === 'TABLE') return this.tableToMd(el, opt);
    if (el.tagName === 'UL' || el.tagName === 'OL') return this.listToMd(el, '', opt);
    if (!/^(P|H[1-6]|DIV)$/.test(el.tagName)) return opt.forStamp ? el.outerHTML : this.htmlOf(el);
    const mt = el.dataset.mt;
    if (mt === 'raw') return this.plainLines(el).join('\n');
    if (mt === 'code' || mt === 'front') {
      const body = this.plainLines(el).join('\n');
      if (mt === 'front') return `---\n${body}\n---`;
      let f = el.dataset.fence || '```';
      while (body.includes(f)) f += f[0];
      const fe = el.dataset.fenceend && el.dataset.fenceend[0] === f[0] && el.dataset.fenceend.length >= f.length ? el.dataset.fenceend : f;
      return f + (el.dataset.lang || '') + '\n' + body + '\n' + fe;
    }
    if (mt === 'hr' && !el.textContent.replace(/[\s\u200B]/g, '')) return '---';
    const st = el.dataset.style || '';
    const hm = /^개요 ([1-7])$/.exec(st);
    const inner = this.inlineToMd(el, opt);
    const align = el.style.textAlign;
    if (align && align !== 'left' && align !== 'start' && !hm) {
      // 정렬은 md에 없음 → HTML 문단
      const ih = this.inlineToMd(el, { ...opt, html: true });
      return ih.trim() || opt.forStamp ? `<p align="${align}">${ih}</p>` : '';
    }
    if (hm) {
      const lv = Math.min(6, +hm[1]);
      const ul = el.dataset.mdul;
      if (ul && lv <= 2 && !inner.includes('\n')) return inner + '\n' + (lv === 1 ? ul.replace(/-/g, '=') : ul.replace(/=/g, '-'));
      return '#'.repeat(lv) + ' ' + inner.replace(/\n/g, ' ');
    }
    if (mt === 'quote') return inner.replace(/ {2}\n {2}\n/g, '\n\n').split('\n').map((x) => (x ? '> ' + x : '>')).join('\n');
    return inner;
  },
  plainLines(el) {
    let s = '';
    const walk = (n) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) s += c.nodeValue.replace(/​/g, '');
        else if (c.nodeName === 'BR') { if (c.nextSibling || c.parentNode !== el) s += '\n'; }
        else if (c.nodeType === 1 && !c.matches('span.pgs, wbr')) walk(c);
      }
    };
    walk(el);
    return s.replace(/\n$/, '').split('\n');
  },

  // 블록 안의 글 → md (굵게·기울임·취소선·코드·링크는 md, 나머지 서식은 <span style>)
  inlineToMd(el, opt = {}) {
    const base = opt.base || Model.charStyle(el.tagName === 'LI' ? el.parentElement : el);
    const runs = [];
    const walk = (n) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) {
          const t = c.nodeValue.replace(/​/g, '');
          if (t) runs.push({ t, el: c.parentElement });
        } else if (c.nodeType === 1) {
          if (c.matches('span.pgs, wbr, .md-task, #print-cover')) continue;
          if (c.nodeName === 'BR') {
            const last = !c.nextSibling && (c.parentNode === el || !c.parentNode.nextSibling);
            if (!last) runs.push({ br: c.classList.contains('md-soft') ? 'soft' : 'hard' });
          } else if (c.nodeName === 'IMG') runs.push({ img: c });
          else if (c.matches('span.tab')) runs.push({ t: '\t', el: c });
          else if (c.matches('ul, ol, table')) continue;
          else if (c.nodeName === 'A' && !opt.html && c.getAttribute('href') && !c.dataset.auto) runs.push({ a: c });
          else walk(c);
        }
      }
    };
    walk(el);
    const fmt = (r) => {
      const e = r.el;
      const cs = Model.charStyle(e);
      const code = !!e.closest('.md-code');
      const a = e.closest('a');
      const css = [];
      if (cs.color && cs.color.toLowerCase() !== (base.color || '#000000').toLowerCase() && !a) css.push(`color:${cs.color}`);
      if (cs.shade && cs.shade !== base.shade && cs.shade !== 'none' && !code) css.push(`background-color:${cs.shade}`);
      if (cs.size && Math.abs(cs.size - base.size) > 0.2 && !cs.sup && !cs.sub && !code) css.push(`font-size:${cs.size}pt`);
      if (cs.font && cs.font !== base.font && !code) css.push(`font-family:'${cs.font}'`);
      return {
        b: cs.bold && !base.bold, i: cs.italic && !base.italic, ub: !!e.closest('b[data-mk="_"]'), ui: !!e.closest('i[data-mk="_"]'), s: cs.strike, code,
        u: cs.underline && !a, sup: cs.sup, sub: cs.sub, href: a && !opt.inLink ? a.getAttribute('href') : null, css: css.join(';'),
      };
    };
    const esc = (t, atStart) => {
      if (opt.html) return escHtml(t);
      let s = t.replace(/([\\`*_[\]])/g, '\\$1').replace(/<(?=[A-Za-z\/!?])/g, '\\<');
      if (atStart) s = s.replace(/^(\s*)([#>+-]|\d+\.)(?=\s)/, '$1\\$2');
      return s;
    };
    let out = '';
    let lineStart = true;
    let k = 0;
    while (k < runs.length) {
      const r = runs[k];
      if (r.br) { out += r.br === 'soft' || opt.html ? (opt.html ? '<br>' : '\n') : '  \n'; lineStart = true; k++; continue; }
      if (r.a) {
        const t = this.inlineToMd(r.a, { ...opt, base, inLink: true });
        out += `[${t}](${r.a.getAttribute('href')}${r.a.title ? ` "${r.a.title}"` : ''})`;
        lineStart = false; k++; continue;
      }
      if (r.img) { out += this.imgToMd(r.img, opt); lineStart = false; k++; continue; }
      // 같은 서식이 이어지는 글을 하나로
      const f = fmt(r);
      const key = JSON.stringify(f);
      let t = r.t;
      let j = k + 1;
      while (j < runs.length && runs[j].t != null && JSON.stringify(fmt(runs[j])) === key) { t += runs[j].t; j++; }
      k = j;
      // 앞뒤 띄어쓰기는 꾸밈 밖으로
      const lead = /^\s*/.exec(t)[0], trail = /\s*$/.exec(t)[0];
      let core = t.slice(lead.length, t.length - trail.length);
      if (!core) { out += t; continue; }
      let s;
      if (f.code && !opt.html) s = core.includes('`') ? '`` ' + core + ' ``' : '`' + core + '`';
      else s = esc(core, lineStart && !lead);
      if (opt.html) {
        if (f.code) s = `<code>${s}</code>`;
        if (f.i) s = `<i>${s}</i>`;
        if (f.b) s = `<b>${s}</b>`;
        if (f.s) s = `<s>${s}</s>`;
      } else {
        const bm = f.ub ? '__' : '**', im = f.ui ? '_' : '*';
        if (f.i) s = im + s + im;
        if (f.b) s = bm + s + bm;
        if (f.s) s = `~~${s}~~`;
      }
      if (f.sup) s = `<sup>${s}</sup>`;
      if (f.sub) s = `<sub>${s}</sub>`;
      if (f.u) s = `<u>${s}</u>`;
      if (f.css) s = `<span style="${f.css}">${s}</span>`;
      if (f.href && !opt.html && r.el.closest('a').dataset.auto && core === f.href) s = `<${f.href}>`;
      else if (f.href) s = opt.html ? `<a href="${escHtml(f.href)}">${s}</a>` : `[${s}](${f.href})`;
      out += lead + s + trail;
      lineStart = false;
    }
    return out;
  },
  imgToMd(img, opt) {
    const alt = img.getAttribute('alt') || '';
    let src = img.dataset.mdsrc;
    if (!src && !opt.forStamp && this._imgCtx && this._imgCtx.filePath && /^data:image\//.test(img.src)) {
      // 새로 넣은 그림: md 파일 옆에 '파일이름-그림N.png'로 저장
      const ctx = this._imgCtx;
      const m = /^data:image\/(\w+);base64,(.*)$/.exec(img.src);
      if (m) {
        const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
        const base = ctx.filePath.replace(/\.[^.\\/]+$/, '');
        let name;
        do { ctx.n++; name = `${base.split(/[\\/]/).pop()}-그림${ctx.n}.${ext}`; } while (ctx.imgs.some((x) => x.name === name));
        const bin = atob(m[2]);
        const bytes = new Uint8Array(bin.length);
        for (let q = 0; q < bin.length; q++) bytes[q] = bin.charCodeAt(q);
        ctx.imgs.push({ name, path: ctx.filePath.replace(/[^\\/]*$/, '') + name, bytes });
        src = name.replace(/ /g, '%20');
        img.dataset.mdsrc = src;
      }
    }
    if (!src) src = opt.forStamp ? '(new)' : img.src;
    const w = parseFloat(img.style.width);
    if (opt.html) return `<img src="${escHtml(src)}" alt="${escHtml(alt)}"${w ? ` width="${Math.round(w)}"` : ''}>`;
    return `![${alt}](${/\s/.test(src) ? '<' + src + '>' : src}${img.dataset.mdtitle ? ` "${img.dataset.mdtitle}"` : ''})`;
  },
  listToMd(list, depth, opt) {
    const ordered = list.tagName === 'OL';
    const mk = list.dataset.mk || (ordered ? '.' : '-');
    let n = parseInt(list.getAttribute('start') || '1', 10);
    const pad = typeof depth === 'string' ? depth : '';
    const lines = [];
    for (const li of Array.from(list.children)) {
      if (li.tagName !== 'LI') continue;
      const marker = ordered ? `${n++}${mk}` : mk;
      const task = li.dataset.task != null ? `[${li.dataset.task === 'x' || (li.querySelector('.md-task') && li.querySelector('.md-task').dataset.done === '1') ? 'x' : ' '}] ` : '';
      const inner = this.inlineToMd(li, opt).replace(task ? /^ / : /^$/, '').split('\n');
      lines.push(pad + marker + ' ' + task + inner[0]);
      inner.slice(1).forEach((x) => lines.push(pad + ' '.repeat(marker.length + 1) + x));
      for (const sub of li.querySelectorAll(':scope > ul, :scope > ol')) lines.push(this.listToMd(sub, pad + ' '.repeat(marker.length + 1), opt));
    }
    return lines.join('\n');
  },
  tableToMd(t, opt) {
    const rows = Array.from(t.querySelectorAll(':scope > tbody > tr, :scope > tr'));
    const merged = t.querySelector('td[colspan]:not([colspan="1"]), td[rowspan]:not([rowspan="1"]), th[colspan], th[rowspan]');
    if (merged || !rows.length) return opt.forStamp ? t.innerHTML : this.htmlOf(t);
    const cellMd = (td) => {
      const ps = Array.from(td.children).filter((x) => x.tagName === 'P');
      return (ps.length ? ps : [td]).map((p) => this.inlineToMd(p, opt).replace(/\n/g, '<br>')).join('<br>').replace(/\|/g, '\\|');
    };
    const grid = rows.map((r) => Array.from(r.cells).map(cellMd));
    const n = Math.max(...grid.map((r) => r.length));
    const stored = (t.dataset.mdal || '').split(',');
    const al = Array.from({ length: n }, (_, k) => {
      const p = rows[0].cells[k] && rows[0].cells[k].querySelector('p');
      const a = (p && p.style.textAlign) || stored[k] || '';
      return a === 'center' ? ':---:' : a === 'right' ? '---:' : a === 'left' ? ':---' : '---';
    });
    const sep = t.dataset.mdsep;
    const sepOk = sep && this.splitRow(sep).length === n && this.splitRow(sep).map((c) => (/^:-+:$/.test(c) ? ':---:' : /^-+:$/.test(c) ? '---:' : /^:-+$/.test(c) ? ':---' : '---')).join() === al.join();
    const line = (cells) => '| ' + Array.from({ length: n }, (_, k) => cells[k] || '').join(' | ') + ' |';
    return [line(grid[0]), sepOk ? sep : '| ' + al.join(' | ') + ' |', ...grid.slice(1).map(line)].join('\n');
  },
  // md로 나타낼 수 없는 블록(합친 셀이 있는 표 등)은 HTML로
  htmlOf(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll('span.pgs, wbr, span.rw').forEach((x) => (x.matches('span.rw') ? x.replaceWith(...x.childNodes) : x.remove()));
    [c, ...c.querySelectorAll('*')].forEach((x) => {
      for (const a of Array.from(x.attributes)) if (/^data-/.test(a.name) && !/^data-(mk|task|done)$/.test(a.name)) x.removeAttribute(a.name);
      x.classList.remove('cell-sel');
      if (!x.classList.length) x.removeAttribute('class');
      if (x.style && x.style.length) { for (const pr of Array.from(x.style)) if (pr.startsWith('--')) x.style.removeProperty(pr); if (!x.style.length) x.removeAttribute('style'); }
    });
    return c.outerHTML.replace(/\n/g, ' ');
  },
};
// 할 일 목록 확인란 누르기
document.addEventListener('mousedown', (e) => {
  const t = e.target.closest && e.target.closest('#editor .md-task');
  if (!t) return;
  e.preventDefault();
  History.checkpoint();
  const on = t.dataset.done !== '1';
  t.dataset.done = on ? '1' : '0';
  t.textContent = on ? '☑' : '☐';
  const li = t.closest('li');
  if (li) li.dataset.task = on ? 'x' : ' ';
  App.changed();
});
