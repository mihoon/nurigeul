// 그리기 개체: 글상자, 선·화살표, 사각형, 타원, 삼각형 + 표 배치(글자처럼/어울림/글 앞/글 뒤)
// 개체 모양: <span class="nobj" contenteditable="false" data-kind="shape|textbox" data-shape="..." ...>
'use strict';

// 메뉴·도구 모음 아이콘
(() => {
  const sv = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  Object.assign(window.ICONS, {
    textbox: sv('<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M8 9h8M12 9v7"/>'),
    shapes: sv('<circle cx="8" cy="8" r="5"/><rect x="11" y="11" width="10" height="10" rx="1"/>'),
    'sh-line': sv('<path d="M4 20 20 4"/>'),
    'sh-arrow': sv('<path d="M4 20 19 5M11 5h8v8"/>'),
    'sh-darrow': sv('<path d="M5 19 19 5M11 5h8v8M5 11v8h8"/>'),
    'sh-rect': sv('<rect x="3" y="6" width="18" height="12"/>'),
    'sh-roundrect': sv('<rect x="3" y="6" width="18" height="12" rx="4"/>'),
    'sh-ellipse': sv('<ellipse cx="12" cy="12" rx="9" ry="7"/>'),
    'sh-triangle': sv('<path d="M12 4 21 20H3z"/>'),
  });
})();
const Shapes = {
  KINDS: {
    textbox: { label: '글상자', w: 60, h: 20 },
    line: { label: '직선', w: 40, h: 0 },
    arrow: { label: '화살표', w: 40, h: 0 },
    darrow: { label: '양쪽 화살표', w: 40, h: 0 },
    rect: { label: '직사각형', w: 30, h: 20 },
    roundrect: { label: '둥근 사각형', w: 30, h: 20 },
    ellipse: { label: '타원', w: 30, h: 20 },
    triangle: { label: '삼각형', w: 30, h: 25 },
  },
  WRAPS: [['inline', '글자처럼 취급'], ['left', '어울림 (왼쪽)'], ['right', '어울림 (오른쪽)'], ['center', '자리 차지 (가운데)'], ['front', '글 앞으로'], ['behind', '글 뒤로']],
  TABLE_WRAPS: [['inline', '글자처럼 취급'], ['left', '어울림 (왼쪽)'], ['right', '어울림 (오른쪽)'], ['front', '글 앞으로'], ['behind', '글 뒤로']],

  isObj(el) { return !!el && el.nodeType === 1 && el.classList.contains('nobj'); },

  // 새 개체 만들기 (크기는 px)
  create(kind, w, hh, opt = {}) {
    const k = kind === 'arrow' || kind === 'darrow' ? 'line' : kind === 'triangle' ? 'poly' : kind;
    const el = h('span', { class: 'nobj', contenteditable: 'false' });
    el.dataset.kind = kind === 'textbox' ? 'textbox' : 'shape';
    if (kind !== 'textbox') el.dataset.shape = k;
    el.dataset.stroke = opt.stroke || '#000000';
    el.dataset.sw = opt.sw != null ? String(opt.sw) : '1';
    el.dataset.fill = opt.fill || (k === 'line' ? 'none' : '#ffffff');
    if (k === 'line') {
      el.dataset.dir = opt.dir || 'dr';
      if (kind === 'arrow' || kind === 'darrow') el.dataset.at = '1';
      if (kind === 'darrow') el.dataset.ah = '1';
    }
    if (k === 'poly') el.dataset.pts = opt.pts || '0.5,0 1,1 0,1';
    el.style.width = Math.round(w) + 'px';
    el.style.height = Math.round(hh) + 'px';
    if (kind === 'textbox') el.append(h('span', { class: 'tb-body', contenteditable: 'true' }, h('br')));
    this.render(el);
    return el;
  },

  // 모서리 곡률(%): 짧은 변의 몇 %를 반지름으로 (한글 '곡률'과 같음, 50 = 반원). 둥근 사각형 기본 20
  roundPct(d) {
    if (d.rr != null && d.rr !== '') return Math.max(0, Math.min(50, +d.rr || 0));
    return d.shape === 'roundrect' ? 20 : 0;
  },
  // SVG 그리기 (크기가 바뀔 때마다 다시)
  svg(d, w, hh) {
    const stroke = d.stroke || '#000000';
    const sw = Math.max(0, +d.sw || 0);
    const fill = !d.fill || d.fill === 'none' ? 'none' : d.fill;
    const st = sw > 0 ? `stroke="${stroke}" stroke-width="${sw}"` : 'stroke="none"';
    const p = sw / 2;
    let body = '';
    const shape = d.shape;
    if (shape === 'rect' || shape === 'roundrect') {
      const rx = Math.max(0, Math.min(w, hh) - sw) * this.roundPct(d) / 100;
      body = `<rect x="${p}" y="${p}" width="${Math.max(0, w - sw)}" height="${Math.max(0, hh - sw)}" rx="${rx}" fill="${fill}" ${st}/>`;
    } else if (shape === 'ellipse') {
      body = `<ellipse cx="${w / 2}" cy="${hh / 2}" rx="${Math.max(0, w / 2 - p)}" ry="${Math.max(0, hh / 2 - p)}" fill="${fill}" ${st}/>`;
    } else if (shape === 'poly') {
      const pts = (d.pts || '').split(/\s+/).filter(Boolean).map((s) => s.split(',').map(Number));
      // 선 굵기만큼 안쪽으로
      const pp = pts.map(([x, y]) => `${(p + x * (w - sw)).toFixed(1)},${(p + y * (hh - sw)).toFixed(1)}`).join(' ');
      body = `<polygon points="${pp}" fill="${fill}" ${st} stroke-linejoin="round"/>`;
    } else if (shape === 'line') {
      const [x1, y1, x2, y2] = d.dir === 'ur' ? [0, hh, w, 0] : [0, 0, w, hh];
      const ah = Math.max(7, (sw || 1) * 4);
      const head = (xa, ya, xb, yb) => {
        // (xa,ya) → (xb,yb) 방향의 끝에 화살촉
        const len = Math.hypot(xb - xa, yb - ya) || 1;
        const ux = (xb - xa) / len, uy = (yb - ya) / len;
        const bx = xb - ux * ah, by = yb - uy * ah;
        const nx = -uy * ah * 0.45, ny = ux * ah * 0.45;
        return `<polygon points="${xb},${yb} ${bx + nx},${by + ny} ${bx - nx},${by - ny}" fill="${stroke}" stroke="none"/>`;
      };
      let lx1 = x1, ly1 = y1, lx2 = x2, ly2 = y2;
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      if (d.at === '1') { lx2 = x2 - (x2 - x1) / len * ah * 0.8; ly2 = y2 - (y2 - y1) / len * ah * 0.8; }
      if (d.ah === '1') { lx1 = x1 + (x2 - x1) / len * ah * 0.8; ly1 = y1 + (y2 - y1) / len * ah * 0.8; }
      body = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="10" class="hit"/>`
        + (sw > 0 ? `<line x1="${lx1}" y1="${ly1}" x2="${lx2}" y2="${ly2}" ${st} stroke-linecap="butt"/>` : '')
        + (d.at === '1' ? head(x1, y1, x2, y2) : '') + (d.ah === '1' ? head(x2, y2, x1, y1) : '');
    }
    // 크기가 0이면 그려지지 않으므로 최소 1px (좌표는 그대로)
    const W = Math.max(1, w), H = Math.max(1, hh);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" overflow="visible">${body}</svg>`;
  },
  size(el) {
    return { w: parseFloat(el.style.width) || 0, h: parseFloat(el.style.height) || parseFloat(el.style.minHeight) || 0 };
  },
  render(el) {
    const d = el.dataset;
    const { w, h: hh } = this.size(el);
    if (d.kind === 'group') { this.renderGroup(el, w, hh); Look.apply(el); return; }
    if (d.kind === 'textbox') {
      const sw = +d.sw || 0;
      el.style.border = sw > 0 ? `${sw}px solid ${d.stroke || '#000'}` : '1px dashed transparent';
      el.style.background = !d.fill || d.fill === 'none' ? '' : d.fill;
      // 글이 넘치면 늘어나도록 높이는 최소 높이로
      if (el.style.height) { el.style.minHeight = el.style.height; el.style.height = ''; }
      const rr = this.roundPct(d);
      el.style.borderRadius = rr ? Math.round(Math.min(w, hh || w) * rr / 100 * 10) / 10 + 'px' : '';
      let body = el.querySelector(':scope > .tb-body');
      if (!body) { body = h('span', { class: 'tb-body', contenteditable: 'true' }, h('br')); el.append(body); }
      body.setAttribute('contenteditable', 'true');
      Look.apply(el);
      return;
    }
    // 그림(SVG)만 바꾸고 도형 안 글자는 그대로
    const tpl = document.createElement('template');
    tpl.innerHTML = this.svg(d, w, hh);
    const old = el.querySelector(':scope > svg');
    if (old) old.replaceWith(tpl.content.firstChild); else el.prepend(tpl.content.firstChild);
    Array.from(el.childNodes).forEach((n) => { if (n.nodeType === 3 || (n.nodeType === 1 && n.tagName !== 'svg' && !n.classList.contains('sh-text'))) n.remove(); });
    const st = el.querySelector(':scope > .sh-text');
    if (st) {
      st.style.inset = this.TEXT_INSET[d.shape] || '4px';
      const body = st.querySelector('.tb-body');
      if (body) body.setAttribute('contenteditable', 'true');
    }
    Look.apply(el);
  },
  // 도형 안 글자 자리 (위 오른쪽 아래 왼쪽)
  TEXT_INSET: { rect: '4px', roundrect: '6px', ellipse: '14% 15%', poly: '38% 22% 4px 22%' },
  canHaveText(el) { return this.isObj(el) && el.dataset.kind === 'shape' && el.dataset.shape !== 'line'; },
  // 도형 안에 글자 넣기
  addText(el) {
    el = el || Img.selected;
    if (!this.canHaveText(el)) { status('선에는 글자를 넣을 수 없습니다.'); return; }
    let st = el.querySelector(':scope > .sh-text');
    if (!st) {
      History.checkpoint();
      st = h('span', { class: 'sh-text' }, h('span', { class: 'tb-body', contenteditable: 'true' }, h('br')));
      el.append(st);
      this.render(el);
      App.changed();
    }
    const body = st.querySelector('.tb-body');
    Img.deselect();
    body.focus({ preventScroll: true });
    Sel.caretInto(body, true);
  },
  renderAll(root) {
    (root || Sel.editor).querySelectorAll('.nobj').forEach((el) => {
      el.setAttribute('contenteditable', 'false');
      this.render(el);
    });
  },

  // 모델(저장용)
  toModel(el) {
    const d = el.dataset;
    if (d.kind === 'group') {
      const sz = this.size(el);
      const m = { kind: 'group', w: sz.w, h: sz.h, wrap: d.wrap || 'inline', members: [] };
      if (m.wrap === 'front' || m.wrap === 'behind') { m.x = parseFloat(el.style.left) || 0; m.y = parseFloat(el.style.top) || 0; }
      Object.assign(m, Look.model(el));
      for (const c of this.members(el)) {
        const lx = parseFloat(c.style.left) || 0, ly = parseFloat(c.style.top) || 0;
        if (c.tagName === 'IMG') m.members.push({ lx, ly, img: { ...Model.imgModel(c), wrap: 'inline' } });
        else m.members.push({ lx, ly, shape: { ...this.toModel(c), wrap: 'inline' } });
      }
      return m;
    }
    const z = App.zoom || 1;
    const r = el.getBoundingClientRect();
    const sz = this.size(el);
    const w = sz.w || r.width / z;
    const hh = d.kind === 'textbox' ? Math.max(sz.h, r.height / z) : sz.h;
    const m = {
      kind: d.kind === 'textbox' ? 'textbox' : d.shape, w, h: hh, wrap: d.wrap || 'inline',
      stroke: d.stroke || '#000000', sw: +d.sw || 0, fill: !d.fill || d.fill === 'none' ? null : d.fill,
      dir: d.dir || 'dr', ah: d.ah === '1', at: d.at === '1', pts: d.pts || null,
    };
    if (d.kind === 'textbox' || d.shape === 'rect' || d.shape === 'roundrect') m.rr = this.roundPct(d);
    m.va = d.va || (d.kind === 'textbox' ? 'top' : 'middle');
    if (m.wrap === 'front' || m.wrap === 'behind') { m.x = parseFloat(el.style.left) || 0; m.y = parseFloat(el.style.top) || 0; }
    Object.assign(m, Look.model(el));
    if (m.kind === 'textbox') {
      const body = el.querySelector('.tb-body');
      m.blocks = body ? Model.blocks(body) : [];
      m.html = body ? body.innerHTML : '';
    } else {
      const body = el.querySelector(':scope > .sh-text .tb-body');
      if (body && body.textContent.replace(/[\u200b\s]/g, '')) {
        m.blocks = Model.blocks(body);
        m.html = body.innerHTML;
        m.inset = this.TEXT_INSET[m.kind] || '4px';
      }
    }
    return m;
  },

  // PNG로 (DOCX 내보내기용). 여백 pad 만큼 둘레를 넓혀 그린다.
  async rasterize(m) {
    const pad = m.kind === 'line' ? Math.max(6, m.sw * 4) : m.kind === 'group' ? 12 : Math.ceil(m.sw / 2) + 1;
    const W = Math.max(1, m.w + pad * 2), H = Math.max(1, m.h + pad * 2);
    const inner = this.fragment(m, pad, pad);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}">${inner}</svg>`;
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const k = 2;
    const cv = h('canvas', { width: Math.round(W * k), height: Math.round(H * k) });
    const cx = cv.getContext('2d');
    cx.scale(k, k);
    cx.drawImage(img, 0, 0);
    return { url: cv.toDataURL('image/png'), w: W, h: H, pad };
  },
  // SVG 조각 (ox, oy 위치에)
  fragment(m, ox, oy) {
    const xhtml = (html) => new XMLSerializer().serializeToString(h('div', { xmlns: 'http://www.w3.org/1999/xhtml', html }));
    if (m.kind === 'group') {
      return (m.members || []).map((c) => {
        if (c.img) return `<image href="${c.img.url}" xlink:href="${c.img.url}" x="${ox + c.lx}" y="${oy + c.ly}" width="${c.img.w}" height="${c.img.h}" preserveAspectRatio="none"/>`;
        return this.fragment(c.shape, ox + c.lx, oy + c.ly);
      }).join('');
    }
    if (m.kind === 'textbox') {
      const bg = m.fill ? `background:${m.fill};` : '';
      const bd = (m.sw > 0 ? `border:${m.sw}px solid ${m.stroke};` : '') + (m.rr ? `border-radius:${Math.min(m.w, m.h) * m.rr / 100}px;` : '');
      const vj = m.va === 'middle' ? 'display:flex;flex-direction:column;justify-content:center;' : m.va === 'bottom' ? 'display:flex;flex-direction:column;justify-content:flex-end;' : '';
      return `<foreignObject x="${ox}" y="${oy}" width="${m.w}" height="${m.h}"><div xmlns="http://www.w3.org/1999/xhtml" style="box-sizing:border-box;width:${m.w}px;height:${m.h}px;padding:4px;${vj}${bg}${bd}font:10pt '함초롬바탕','HCR Batang','바탕',serif;line-height:1.6;color:#000;white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere">${xhtml(m.html)}</div></foreignObject>`;
    }
    const d = { shape: m.kind, stroke: m.stroke, sw: m.sw, fill: m.fill || 'none', dir: m.dir, ah: m.ah ? '1' : '', at: m.at ? '1' : '', pts: m.pts, rr: m.rr };
    let out = `<g transform="translate(${ox},${oy})">${this.svg(d, m.w, m.h).replace(/<svg[^>]*>|<\/svg>/g, '').replace(/<line[^>]*class="hit"\/>/, '')}</g>`;
    if (m.html) {
      // 도형 안 글자
      const px = (v, whole) => (String(v).endsWith('%') ? parseFloat(v) / 100 * whole : parseFloat(v) || 0);
      const ins = m.inset.split(/\s+/);
      const [t, r, b, l] = [ins[0], ins[1] || ins[0], ins[2] || ins[0], ins[3] || ins[1] || ins[0]];
      const x = px(l, m.w), y = px(t, m.h), w = m.w - x - px(r, m.w), hh = m.h - y - px(b, m.h);
      out += `<foreignObject x="${ox + x}" y="${oy + y}" width="${w}" height="${hh}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${hh}px;display:flex;align-items:${m.va === 'top' ? 'flex-start' : m.va === 'bottom' ? 'flex-end' : 'center'};font:10pt '함초롬바탕','HCR Batang','바탕',serif;line-height:1.6;color:#000;text-align:center;white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere"><div style="width:100%">${xhtml(m.html)}</div></div></foreignObject>`;
    }
    return out;
  },

  // ---------- 개체 묶기 / 풀기 ----------
  members(g) { return Array.from(g.children).filter((c) => c.tagName === 'IMG' || c.classList.contains('nobj')); },
  // 묶음 크기가 바뀌면 안의 개체도 같은 비율로
  renderGroup(g, w, hh) {
    const bw = +g.dataset.bw || w || 1, bh = +g.dataset.bh || hh || 1;
    const sx = w / bw, sy = hh / bh;
    for (const c of this.members(g)) {
      const cd = c.dataset;
      c.style.left = Math.round(+cd.gx * sx * 10) / 10 + 'px';
      c.style.top = Math.round(+cd.gy * sy * 10) / 10 + 'px';
      c.style.width = Math.max(0, Math.round(+cd.gw * sx * 10) / 10) + 'px';
      const ch = Math.max(0, Math.round(+cd.gh * sy * 10) / 10) + 'px';
      if (cd.kind === 'textbox') { c.style.minHeight = ch; c.style.height = ''; } else c.style.height = ch;
      if (this.isObj(c)) this.render(c);
    }
  },
  group(list) {
    list = (list || Img.selection()).filter((o) => o && o.isConnected);
    if (list.length < 2) { status('묶을 개체를 Ctrl(또는 Shift)을 누른 채 두 개 이상 누르세요.'); return null; }
    // 문서 순서(겹침 순서) 유지
    list.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const z = App.zoom;
    const er = Sel.editor.getBoundingClientRect();
    const rects = list.map((o) => { const r = o.getBoundingClientRect(); return { x: (r.left - er.left) / z, y: (r.top - er.top) / z, w: r.width / z, h: r.height / z }; });
    const minX = Math.min(...rects.map((r) => r.x)), minY = Math.min(...rects.map((r) => r.y));
    const maxX = Math.max(...rects.map((r) => r.x + r.w)), maxY = Math.max(...rects.map((r) => r.y + r.h));
    Img.deselect();
    const g = h('span', { class: 'nobj', contenteditable: 'false' });
    g.dataset.kind = 'group';
    g.dataset.wrap = list.every((o) => o.dataset.wrap === 'behind') ? 'behind' : 'front';
    const W = Math.max(1, maxX - minX), H = Math.max(1, maxY - minY);
    g.dataset.bw = Math.round(W * 10) / 10; g.dataset.bh = Math.round(H * 10) / 10;
    g.style.left = Math.round(minX) + 'px'; g.style.top = Math.round(minY) + 'px';
    g.style.width = Math.round(W * 10) / 10 + 'px'; g.style.height = Math.round(H * 10) / 10 + 'px';
    list.forEach((o, i) => {
      const r = rects[i];
      o.dataset.gwrap = o.dataset.wrap || 'inline';
      delete o.dataset.wrap;
      o.classList.remove('selected');
      o.dataset.gx = Math.round((r.x - minX) * 10) / 10; o.dataset.gy = Math.round((r.y - minY) * 10) / 10;
      o.dataset.gw = Math.round(r.w * 10) / 10; o.dataset.gh = Math.round(r.h * 10) / 10;
      g.append(o);
    });
    Para.ensure();
    Img.reanchor(g);
    if (!g.isConnected) Sel.editor.firstElementChild.prepend(g);
    this.render(g);
    Img.select(g);
    const rg = document.createRange(); rg.selectNode(g); Sel.set(rg);
    App.changed();
    status(`개체 ${list.length}개를 묶었습니다. (풀기: Ctrl+Shift+G)`);
    return g;
  },
  ungroup(g) {
    g = g || Img.selected;
    if (!g || g.dataset.kind !== 'group') { status('풀 묶음 개체를 선택하세요.'); return; }
    const z = App.zoom;
    const er = Sel.editor.getBoundingClientRect();
    const wrap = g.dataset.wrap === 'behind' ? 'behind' : 'front';
    const kids = this.members(g);
    const pos = kids.map((c) => { const r = c.getBoundingClientRect(); return [(r.left - er.left) / z, (r.top - er.top) / z]; });
    Img.deselect();
    kids.forEach((c, i) => {
      ['gx', 'gy', 'gw', 'gh', 'gwrap'].forEach((k) => delete c.dataset[k]);
      c.dataset.wrap = wrap;
      c.style.left = Math.round(pos[i][0]) + 'px';
      c.style.top = Math.round(pos[i][1]) + 'px';
      g.parentNode.insertBefore(c, g);
    });
    g.remove();
    kids.forEach((c) => { Img.reanchor(c); if (this.isObj(c)) this.render(c); else Look.apply(c); });
    // 풀린 개체들을 모두 고른 상태로
    kids.forEach((c) => Img.toggleMulti(c));
    App.changed();
    status(`묶음을 풀었습니다. (개체 ${kids.length}개)`);
  },

  // ---------- 마우스로 그리기 ----------
  drawing: null,
  startDraw(kind) {
    this.cancelDraw();
    Img.deselect();
    const page = $('#page');
    const layer = h('div', { id: 'draw-layer' });
    const ghost = h('div', { class: 'draw-ghost' });
    layer.append(ghost);
    page.append(layer);
    const info = this.KINDS[kind];
    status(`마우스로 끌어서 ${info.label}을(를) 그리세요. 누르기만 하면 기본 크기로 넣습니다. (Esc: 취소)`);
    const st = { kind, layer };
    this.drawing = st;
    const z = () => App.zoom;
    const pr = () => page.getBoundingClientRect();
    let x0, y0, down = false;
    const geo = (ev) => {
      let dx = (ev.clientX - pr().left) / z() - x0, dy = (ev.clientY - pr().top) / z() - y0;
      const isLine = kind === 'line' || kind === 'arrow' || kind === 'darrow';
      if (ev.shiftKey) {
        if (isLine) {
          // 가로/세로/45도
          const a = Math.atan2(dy, dx), L = Math.hypot(dx, dy);
          const s = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
          dx = Math.round(Math.cos(s) * L); dy = Math.round(Math.sin(s) * L);
        } else { const m = Math.max(Math.abs(dx), Math.abs(dy)); dx = Math.sign(dx || 1) * m; dy = Math.sign(dy || 1) * m; }
      }
      return { dx, dy };
    };
    layer.addEventListener('mousedown', (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      down = true;
      x0 = (ev.clientX - pr().left) / z(); y0 = (ev.clientY - pr().top) / z();
    });
    const move = (ev) => {
      if (!down) return;
      const { dx, dy } = geo(ev);
      Object.assign(ghost.style, { display: 'block', left: Math.min(x0, x0 + dx) + 'px', top: Math.min(y0, y0 + dy) + 'px', width: Math.abs(dx) + 'px', height: Math.abs(dy) + 'px' });
    };
    const up = (ev) => {
      if (!down) return;
      down = false;
      const { dx, dy } = geo(ev);
      this.cancelDraw();
      const isLine = kind === 'line' || kind === 'arrow' || kind === 'darrow';
      let w = Math.abs(dx), hh = Math.abs(dy);
      let left = Math.min(x0, x0 + dx), top = Math.min(y0, y0 + dy);
      if (w + hh < 5) { w = U.mm2px(info.w); hh = U.mm2px(info.h); left = x0; top = y0; }
      if (!isLine) { w = Math.max(w, 8); hh = Math.max(hh, 8); }
      const dir = (dx >= 0) === (dy >= 0) ? 'dr' : 'ur';
      // 종이 좌표 → 편집기 좌표
      const er = Sel.editor.getBoundingClientRect();
      const ex = (er.left - pr().left) / z(), ey = (er.top - pr().top) / z();
      this.place(kind, w, hh, left - ex, top - ey, { dir });
    };
    const key = (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); this.cancelDraw(); status('그리기를 취소했습니다.'); } };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('keydown', key, true);
    st.off = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); window.removeEventListener('keydown', key, true); };
  },
  cancelDraw() {
    const st = this.drawing;
    if (!st) return;
    st.off();
    st.layer.remove();
    this.drawing = null;
  },
  // 글 앞으로 떠 있는 개체를 편집기 좌표 (x, y)에 넣기
  place(kind, w, hh, x, y, opt = {}) {
    History.checkpoint();
    const el = this.create(kind, w, hh, opt);
    el.dataset.wrap = 'front';
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    Para.ensure();
    Img.reanchor(el);
    if (!el.isConnected) Sel.editor.firstElementChild.prepend(el);
    this.afterInsert(el, kind);
    return el;
  },
  // 키보드로 넣기 (커서 자리에 글자처럼)
  insertAtCaret(kind) {
    const info = this.KINDS[kind];
    const el = this.create(kind, U.mm2px(info.w), U.mm2px(info.h));
    const r = Sel.range();
    if (r) { r.deleteContents(); r.insertNode(el); } else { Para.ensure(); Sel.editor.lastElementChild.append(el); }
    this.afterInsert(el, kind);
    return el;
  },
  afterInsert(el, kind) {
    App.changed();
    if (kind === 'textbox') {
      const body = el.querySelector('.tb-body');
      body.focus({ preventScroll: true });
      Sel.caretInto(body);
    } else {
      Img.select(el);
      const r = document.createRange();
      r.selectNode(el);
      Sel.set(r);
      Sel.editor.focus({ preventScroll: true });
      Sel.set(r);
    }
  },

  // 속성 적용 (대화상자 결과)
  applyProps(el, a) {
    if (!el) return;
    const d = el.dataset;
    if (a.w != null) el.style.width = Math.round(U.mm2px(a.w)) + 'px';
    if (a.hh != null) {
      const v = Math.round(U.mm2px(a.hh)) + 'px';
      if (d.kind === 'textbox') { el.style.minHeight = v; el.style.height = ''; } else el.style.height = v;
    }
    if (a.stroke) d.stroke = a.stroke;
    if (a.sw != null) d.sw = String(a.sw);
    if (a.fillOn != null) d.fill = a.fillOn ? a.fill || '#ffffff' : 'none';
    if (a.arrow != null && d.shape === 'line') {
      d.at = a.arrow === 'end' || a.arrow === 'both' ? '1' : '';
      d.ah = a.arrow === 'start' || a.arrow === 'both' ? '1' : '';
      if (!d.at) delete d.at;
      if (!d.ah) delete d.ah;
    }
    if (a.dir && d.shape === 'line') d.dir = a.dir;
    if (a.va && (d.kind === 'textbox' || this.canHaveText(el))) {
      const def = d.kind === 'textbox' ? 'top' : 'middle';
      if (a.va === def) delete d.va; else d.va = a.va;
    }
    if (a.rr != null && a.rr !== '' && (d.kind === 'textbox' || d.shape === 'rect' || d.shape === 'roundrect')) {
      const v = Math.max(0, Math.min(50, Math.round(+a.rr || 0)));
      d.rr = String(v);
      if (d.kind !== 'textbox') d.shape = v > 0 ? 'roundrect' : 'rect';
    }
    this.render(el);
    if (a.wrap) Img.setWrap(el, a.wrap);
    Img.drawBox();
  },

  // ---------- 표 배치 ----------
  tableOf() {
    if (Table.block.active()) return Table.block.table;
    return Table.current();
  },
  isFloatingTable(t) { return !!t && (t.dataset.wrap === 'front' || t.dataset.wrap === 'behind'); },
  setTableWrap(t, wrap) {
    t = t || this.tableOf();
    if (!t) return;
    // 표 안의 표는 글자처럼만
    if (t.parentElement !== Sel.editor && wrap !== 'inline') { status('표 안의 표는 글자처럼 취급만 할 수 있습니다.'); return; }
    const z = App.zoom;
    if (wrap === 'front' || wrap === 'behind') {
      if (!this.isFloatingTable(t)) {
        const r = t.getBoundingClientRect(), er = Sel.editor.getBoundingClientRect();
        t.style.left = Math.round((r.left - er.left) / z) + 'px';
        t.style.top = Math.round((r.top - er.top) / z) + 'px';
      }
      t.dataset.wrap = wrap;
      this.reanchorTable(t);
    } else {
      t.style.left = ''; t.style.top = '';
      if (wrap === 'inline') delete t.dataset.wrap; else t.dataset.wrap = wrap;
    }
    Para.ensure();
    this.updateGrip();
    App.changed();
  },
  // DOM을 옮겨도 커서가 풀리지 않게
  keepSel(fn) {
    const s = window.getSelection();
    const r = s.rangeCount ? s.getRangeAt(0) : null;
    const b = r ? [r.startContainer, r.startOffset, r.endContainer, r.endOffset] : null;
    fn();
    if (b && b[0].isConnected && b[2].isConnected) {
      try { const nr = document.createRange(); nr.setStart(b[0], b[1]); nr.setEnd(b[2], b[3]); s.removeAllRanges(); s.addRange(nr); } catch { /* 무시 */ }
    }
  },
  reanchorTable(t) { this.keepSel(() => this._reanchorTable(t)); },
  _reanchorTable(t) {
    const top = parseFloat(t.style.top) || 0;
    let anchor = null;
    for (const c of Sel.editor.children) {
      if (c === t || c.classList.contains('pagebreak')) continue;
      if (!/^(P|DIV|H[1-6]|UL|OL)$/.test(c.tagName)) continue;
      if (!anchor || c.offsetTop <= top) anchor = c; else break;
    }
    if (anchor && t.previousElementSibling !== anchor) anchor.after(t);
  },
  // 떠 있는 표 옮기기 손잡이
  gripTable: null,
  updateGrip(hoverTable) {
    let grip = $('#tgrip');
    const cur = Sel.closest('table');
    let t = hoverTable || cur;
    while (t && t.parentElement && t.parentElement !== Sel.editor) t = t.parentElement.closest('table');
    if (!t || !this.isFloatingTable(t) || !t.isConnected) {
      if (grip && !this.gripDragging) grip.hidden = true;
      this.gripTable = null;
      return;
    }
    if (!grip) {
      grip = h('div', { id: 'tgrip', class: 'no-print', title: '끌어서 표 옮기기' }, '✥');
      grip.addEventListener('mousedown', (e) => this.startTableMove(e));
      $('#page').append(grip);
    }
    const z = App.zoom;
    const pr = $('#page').getBoundingClientRect(), r = t.getBoundingClientRect();
    grip.style.left = (r.left - pr.left) / z - 20 + 'px';
    grip.style.top = (r.top - pr.top) / z - 20 + 'px';
    grip.hidden = false;
    this.gripTable = t;
  },
  startTableMove(e) {
    const t = this.gripTable;
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    const z = App.zoom;
    const x0 = e.clientX, y0 = e.clientY;
    const l0 = parseFloat(t.style.left) || 0, t0 = parseFloat(t.style.top) || 0;
    let moved = false;
    this.gripDragging = true;
    const move = (ev) => {
      const dx = (ev.clientX - x0) / z, dy = (ev.clientY - y0) / z;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      if (!moved) { History.checkpoint(); moved = true; }
      t.style.left = Math.round(l0 + dx) + 'px';
      t.style.top = Math.round(t0 + dy) + 'px';
      this.updateGrip(t);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      this.gripDragging = false;
      if (moved) { this.reanchorTable(t); Para.ensure(); this.updateGrip(t); App.changed(); }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  },
  moveTableBy(t, dx, dy) {
    t.style.left = Math.round((parseFloat(t.style.left) || 0) + dx) + 'px';
    t.style.top = Math.round((parseFloat(t.style.top) || 0) + dy) + 'px';
    this.reanchorTable(t);
    this.updateGrip(t);
  },

  // ---------- 선택한 개체 / 표 공통 ----------
  target() {
    if (Img.selected) return { type: 'obj', el: Img.selected };
    const t = this.tableOf();
    if (t) return { type: 'table', el: t };
    return null;
  },
  currentWrap() {
    const t = this.target();
    return t ? t.el.dataset.wrap || 'inline' : null;
  },
  setWrap(wrap) {
    const t = this.target();
    if (!t) { status('배치를 바꿀 개체(그림·도형·글상자)를 선택하거나 표 안에 커서를 두세요.'); return; }
    if (t.type === 'table') this.setTableWrap(t.el, wrap === 'center' ? 'inline' : wrap);
    else { Img.selection().forEach((el) => Img.setWrap(el, wrap)); Img.drawBox(); App.changed(); }
  },

  init() {
    const ed = Sel.editor;
    document.addEventListener('selectionchange', () => this.updateGrip());
    ed.addEventListener('mouseover', (e) => {
      const t = e.target.closest && e.target.closest('table');
      if (t && this.isFloatingTable(t)) this.updateGrip(t);
    });
    // 글상자 안에 붙일 때는 글자만
    ed.addEventListener('paste', (e) => {
      const body = e.target.closest && e.target.closest('.tb-body');
      if (!body) return;
      e.preventDefault();
      e.stopPropagation();
      const text = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
      History.checkpoint();
      document.execCommand('insertText', false, text);
      App.changed();
    }, true);
  },
  // App.onKeyDown 에서 부름: 처리했으면 true
  onKey(e, k) {
    const r = Sel.range();
    const body = r && (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement).closest('.tb-body');
    if (!body) return false;
    if (k === 'Enter' || k === 'Shift+Enter') {
      History.checkpoint();
      document.execCommand('insertLineBreak');
      App.changed();
      return true;
    }
    if (k === 'Escape' || k === 'Shift+Escape') {
      const box = body.closest('.nobj');
      Img.select(box);
      const rg = document.createRange();
      rg.selectNode(box);
      Sel.editor.focus({ preventScroll: true });
      Sel.set(rg);
      return true;
    }
    if (k === 'Tab') { History.checkpoint(); TabStops.insert(); App.changed(); return true; }
    // 글상자 안에서 쓸 수 없는 명령 막기
    if (['Ctrl+Enter', 'Ctrl+N,T', 'Ctrl+Shift+Insert', 'Ctrl+Shift+Delete'].includes(k)) return true;
    // 글상자 안에서 전체 선택은 글상자 글만
    if (k === 'Ctrl+A') { const rg = document.createRange(); rg.selectNodeContents(body); Sel.set(rg); return true; }
    return false;
  },
};
