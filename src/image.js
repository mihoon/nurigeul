// 그림: 넣기, 선택, 크기 조절, 배치
'use strict';
const Img = {
  selected: null,

  async insertFromDialog() {
    const files = await window.native.openDialog('image', true);
    if (!files) return null;
    const saved = Sel.save();
    const out = [];
    for (const f of files) out.push({ url: bytesToDataURL(f.data, mimeFromName(f.name)), name: f.name });
    return out;
  },

  async insert(url, opts = {}) {
    const dim = await imageSize(url);
    const maxW = opts.maxWidth || App.contentWidth();
    let w = opts.width || dim.w, hgt = opts.height || dim.h;
    if (!opts.width && w > maxW) { hgt = Math.round(hgt * maxW / w); w = Math.round(maxW); }
    const img = h('img', { src: url, alt: opts.alt || '', style: `width:${w}px;height:${hgt}px` });
    if (opts.wrap && opts.wrap !== 'inline') img.dataset.wrap = opts.wrap;
    if (opts.name) img.dataset.name = String(opts.name).split(/[\\/]/).pop();
    // 넣은 뒤에도 화면이 그 자리에 있게: 커서가 큰 그림 뒤로 가면 크롬이 커서 쪽으로 몇 쪽씩 내려가 버림
    const ws = $('#workspace');
    const st0 = ws ? ws.scrollTop : 0;
    const r = Sel.range();
    if (r) {
      r.deleteContents();
      r.insertNode(img);
      const nr = document.createRange();
      nr.setStartAfter(img);
      nr.collapse(true);
      Sel.set(nr);
    } else {
      const p = h('p', {}, img);
      Sel.editor.append(p);
    }
    Para.ensure();
    if (ws) {
      ws.scrollTop = st0;
      const vr = ws.getBoundingClientRect(), ir = img.getBoundingClientRect();
      // 그림 윗부분이 화면 밖이면 그림 위쪽이 보이게만 옮김
      if (ir.top < vr.top + 10 || ir.top > vr.bottom - 60) ws.scrollTop += ir.top - (vr.top + vr.height * 0.25);
      App.keepScroll(ws.scrollTop);
    }
    return img;
  },

  multi: [], // Ctrl/Shift+클릭으로 함께 고른 개체들 (selected 포함)
  select(img) {
    if (this.selected === img && this.multi.length < 2) return;
    this.deselect();
    this.selected = img;
    img.classList.add('selected');
    this.drawBox();
  },
  // Ctrl/Shift+클릭: 여러 개체 고르기 (다시 누르면 빠짐)
  toggleMulti(o) {
    let list = this.multi.length ? this.multi.slice() : (this.selected ? [this.selected] : []);
    list = list.filter((x) => x.isConnected);
    if (list.includes(o)) list = list.filter((x) => x !== o); else list.push(o);
    const prim = list[list.length - 1] || null;
    this.deselect();
    if (!prim) return;
    this.multi = list.length > 1 ? list : [];
    list.forEach((x) => x.classList.add('selected'));
    this.selected = prim;
    this.drawBox();
    if (list.length > 1) status(`개체 ${list.length}개를 골랐습니다. Ctrl+G: 개체 묶기`);
  },
  selection() { return this.multi.length > 1 ? this.multi.filter((x) => x.isConnected) : this.selected ? [this.selected] : []; },
  deselect() {
    if (this.selected) this.selected.classList.remove('selected');
    this.multi.forEach((x) => x.classList.remove('selected'));
    this.multi = [];
    this.selected = null;
    $('#overlay').innerHTML = '';
  },
  // ---------- 캡션 ----------
  figOf(img) { return img && img.parentElement && img.parentElement.classList.contains('figure') ? img.parentElement : null; },
  // 캡션 상자의 너비·떠 있는 위치를 그림에 맞춤
  syncFig(img) {
    const fig = this.figOf(img);
    if (!fig) return;
    const w = parseFloat(img.style.width) || img.getBoundingClientRect().width / (App.zoom || 1);
    if (w) fig.style.width = Math.round(w) + 'px';
    if (this.isFloating(img)) { fig.style.left = img.style.left; fig.style.top = img.style.top; }
    else { fig.style.left = ''; fig.style.top = ''; }
  },
  syncFigs(root) { for (const f of (root || Sel.editor).querySelectorAll('.figure > img')) this.syncFig(f); },
  capText(fig) {
    const cap = fig && fig.querySelector('.figcap');
    if (!cap) return '';
    const c = cap.cloneNode(true);
    c.querySelectorAll('.fignum').forEach((n) => n.remove());
    return c.textContent.replace(/ /g, ' ').trim();
  },
  async captionDialog() {
    const img = this.selected;
    if (!img || img.tagName !== 'IMG') { status('캡션을 넣을 그림을 먼저 누르세요.'); return null; }
    const fig = this.figOf(img);
    const cap = fig && fig.querySelector('.figcap');
    const imgs = this.selection().filter((o) => o.tagName === 'IMG');
    const named = imgs.filter((o) => this.fileLabel(o)).length;
    const curText = this.capText(fig);
    return Dialog.form(imgs.length > 1 ? `캡션 (그림 ${imgs.length}개)` : '캡션', [
      { name: 'src', label: '캡션 내용', type: 'select', options: [['text', '직접 입력'], ['name', '파일 이름' + (named ? '' : ' (알 수 없음)')]], value: named && (imgs.length > 1 || (curText && curText === this.fileLabel(img))) ? 'name' : 'text' },
      { name: 'text', label: '캡션 글', type: 'text', value: curText, placeholder: this.fileLabel(img) || '그림 설명', autofocus: true },
      { name: 'num', label: '번호 붙이기 (그림 1, 그림 2 …)', type: 'checkbox', value: cap ? !!cap.querySelector('.fignum') : true },
      { name: 'side', label: '위치', type: 'select', options: [['bottom', '그림 아래'], ['top', '그림 위']], value: fig ? fig.dataset.cap || 'bottom' : 'bottom' },
      { name: 'align', label: '정렬', type: 'select', options: [['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']], value: cap ? (cap.style.textAlign || 'left') : 'center' },
      ...(fig ? [{ name: 'remove', label: '캡션 없애기', type: 'checkbox', value: false }] : []),
    ], { okLabel: '확인', width: 440, note: `그림 번호는 문서 안 순서대로 저절로 매겨집니다. 캡션 글은 그림 아래(위)에서 바로 고쳐 쓸 수도 있습니다. '파일 이름'은 그림 파일 이름에서 확장자를 뺀 글자이며, Ctrl+누르기로 그림 여러 개를 골라 두면 한꺼번에 각자의 파일 이름으로 달립니다.${named < imgs.length ? ' 파일 이름을 모르는 그림(복사해 붙인 그림 등)은 직접 입력한 글이 들어갑니다.' : ''}` });
  },
  // 그림 파일 이름 (확장자 뺌)
  fileLabel(img) {
    const n = img && img.dataset.name;
    return n ? n.replace(/\.[a-z0-9]{2,5}$/i, '').trim() : '';
  },
  setCaptions(a) {
    const imgs = this.selection().filter((o) => o.tagName === 'IMG');
    const prim = this.selected;
    if (!imgs.length || !a) return;
    for (const img of imgs) this.setCaption({ ...a, text: a.src === 'name' && this.fileLabel(img) ? this.fileLabel(img) : a.text }, img, true);
    if (prim && prim.isConnected) this.select(prim);
  },
  setCaption(a, img, quiet) {
    img = img || this.selected;
    if (!img || img.tagName !== 'IMG' || !a) return;
    let fig = this.figOf(img);
    if (a.remove) {
      if (fig) { fig.replaceWith(img); this.select(img); }
      return;
    }
    if (!fig) {
      fig = h('span', { class: 'figure', contenteditable: 'false' });
      img.replaceWith(fig);
      fig.append(img, h('span', { class: 'figcap', contenteditable: 'true' }));
    }
    fig.dataset.cap = a.side === 'top' ? 'top' : 'bottom';
    const cap = fig.querySelector('.figcap');
    cap.style.textAlign = a.align && a.align !== 'left' ? a.align : '';
    const text = String(a.text || '').trim();
    const hadNum = !!cap.querySelector('.fignum');
    if (text !== this.capText(fig) || hadNum !== !!a.num) {
      cap.textContent = '';
      if (a.num) cap.append(h('span', { class: 'fignum', contenteditable: 'false' }));
      if (text || !a.num) cap.append((a.num ? ' ' : '') + (text || ' '));
    }
    this.syncFig(img);
    if (!quiet) this.select(img);
  },
  drawBox() {
    const ov = $('#overlay');
    ov.innerHTML = '';
    for (const o of this.selection()) if (o.tagName === 'IMG') this.syncFig(o);
    const img = this.selected;
    if (!img || !img.isConnected) { this.selected = null; return; }
    const page = $('#page').getBoundingClientRect();
    const r = img.getBoundingClientRect();
    const z = App.zoom;
    // 함께 고른 다른 개체는 테두리만
    for (const o of this.multi) {
      if (o === img || !o.isConnected) continue;
      const q = o.getBoundingClientRect();
      ov.append(h('div', { class: 'img-box multi', style: { left: (q.left - page.left) / z + 'px', top: (q.top - page.top) / z + 'px', width: q.width / z + 'px', height: q.height / z + 'px' } }));
    }
    const box = h('div', { class: 'img-box', style: { left: (r.left - page.left) / z + 'px', top: (r.top - page.top) / z + 'px', width: r.width / z + 'px', height: r.height / z + 'px' } });
    for (const d of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
      const hd = h('div', { class: 'h ' + d });
      hd.addEventListener('mousedown', (e) => this.startResize(e, d));
      box.append(hd);
    }
    box.append(h('div', { class: 'sz' }, `${U.px2mm(r.width / z).toFixed(1)} × ${U.px2mm(r.height / z).toFixed(1)} mm`));
    ov.append(box);
  },
  startMove(e, img) {
    const z = App.zoom;
    const x0 = e.clientX, y0 = e.clientY;
    const items = (this.multi.includes(img) ? this.multi : [img]).filter((o) => this.isFloating(o));
    const start = items.map((o) => [parseFloat(o.style.left) || 0, parseFloat(o.style.top) || 0]);
    let moved = false;
    const move = (ev) => {
      const dx = (ev.clientX - x0) / z, dy = (ev.clientY - y0) / z;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      if (!moved) { History.checkpoint(); moved = true; }
      items.forEach((o, i) => { o.style.left = Math.round(start[i][0] + dx) + 'px'; o.style.top = Math.round(start[i][1] + dy) + 'px'; });
      this.drawBox();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (moved) { items.forEach((o) => this.reanchor(o)); this.drawBox(); App.changed(); }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  },
  startResize(e, dir) {
    e.preventDefault();
    e.stopPropagation();
    const img = this.selected;
    History.checkpoint();
    const z = App.zoom;
    const w0 = img.getBoundingClientRect().width / z, h0 = img.getBoundingClientRect().height / z;
    const x0 = e.clientX, y0 = e.clientY;
    const isObj = Shapes.isObj(img);
    const isLine = isObj && img.dataset.shape === 'line';
    const ratio = h0 ? w0 / h0 : 1;
    const corner = dir.length === 2;
    const minS = isLine ? 0 : 8;
    const move = (ev) => {
      let dx = (ev.clientX - x0) / z, dy = (ev.clientY - y0) / z;
      if (dir.includes('w')) dx = -dx;
      if (dir.includes('n')) dy = -dy;
      let w = w0, hh = h0;
      if (dir.includes('e') || dir.includes('w')) w = Math.max(minS, w0 + dx);
      if (dir.includes('s') || dir.includes('n')) hh = Math.max(minS, h0 + dy);
      // 그림은 모서리를 끌면 비율 유지(Shift: 자유), 도형은 반대
      if (corner && h0 && (isObj ? ev.shiftKey : !ev.shiftKey)) {
        // 비율 유지
        if (Math.abs(dx) > Math.abs(dy)) hh = w / ratio; else w = hh * ratio;
      }
      img.style.width = Math.round(w) + 'px';
      if (isObj && img.dataset.kind === 'textbox') { img.style.minHeight = Math.round(hh) + 'px'; img.style.height = ''; }
      else img.style.height = Math.round(hh) + 'px';
      if (isObj) Shapes.render(img);
      this.drawBox();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      App.changed();
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  },
  // 누른 요소가 속한 개체 (그림 또는 도형·글상자 테두리)
  objOf(t) {
    if (!t || t.nodeType !== 1 || !Sel.editor.contains(t)) return null;
    if (t.tagName === 'IMG') return t;
    let o = t.tagName === 'IMG' ? t : t.closest('.tb-body') ? null : t.closest('.nobj');
    if (!o) return null;
    // 묶인 개체는 가장 바깥 묶음이 선택됨
    for (let g = o.parentElement && o.parentElement.closest('.nobj[data-kind="group"]'); g; g = g.parentElement && g.parentElement.closest('.nobj[data-kind="group"]')) o = g;
    return o;
  },
  propsCmd(o) { return o && o.tagName === 'IMG' ? 'image-props' : 'object-props'; },
  isFloating(img) { return img && (img.dataset.wrap === 'front' || img.dataset.wrap === 'behind'); },
  setWrap(img, wrap) {
    img = img || this.selected;
    if (!img) return;
    const ed = Sel.editor;
    const z = App.zoom;
    if (wrap === 'front' || wrap === 'behind') {
      if (!this.isFloating(img)) {
        // 지금 보이는 자리 그대로 떠 있게
        const r = img.getBoundingClientRect(), er = ed.getBoundingClientRect();
        img.style.left = Math.round((r.left - er.left) / z) + 'px';
        img.style.top = Math.round((r.top - er.top) / z) + 'px';
      }
      img.dataset.wrap = wrap;
    } else {
      img.style.left = ''; img.style.top = '';
      if (!wrap || wrap === 'inline') delete img.dataset.wrap;
      else img.dataset.wrap = wrap;
    }
    this.drawBox();
  },
  // 떠 있는 그림 옮기기 (여백 밖도 가능)
  moveBy(dx, dy) {
    const items = this.selection().filter((o) => this.isFloating(o));
    if (!items.length) return false;
    for (const img of items) {
      img.style.left = Math.round((parseFloat(img.style.left) || 0) + dx) + 'px';
      img.style.top = Math.round((parseFloat(img.style.top) || 0) + dy) + 'px';
      this.reanchor(img);
    }
    this.drawBox();
    return true;
  },
  // 그림 위쪽 높이에 있는 문단으로 기준 문단 옮기기 (저장할 때 쪽 계산용)
  reanchor(img) {
    Shapes.keepSel(() => this._reanchor(img));
    // 선택된 개체면 선택 상태 유지
    if (this.selected === img && img.isConnected) {
      const r = document.createRange();
      r.selectNode(img);
      Sel.set(r);
    }
  },
  _reanchor(img) {
    const top = parseFloat(img.style.top) || 0;
    let anchor = null;
    for (const c of Sel.editor.children) {
      if (!/^(P|DIV|H[1-6])$/.test(c.tagName) || c.classList.contains('pagebreak')) continue;
      if (!anchor || c.offsetTop <= top) anchor = c; else break;
    }
    if (anchor && img.parentElement !== anchor) anchor.insertBefore(img, anchor.firstChild);
  },
  setSizeMM(img, wmm, hmm) {
    img = img || this.selected;
    if (!img) return;
    if (Shapes.isObj(img)) { Shapes.applyProps(img, { w: wmm, hh: hmm }); return; }
    img.style.width = Math.round(U.mm2px(wmm)) + 'px';
    img.style.height = Math.round(U.mm2px(hmm)) + 'px';
    this.drawBox();
  },
  resetSize(img) {
    img = img || this.selected;
    if (!img || img.tagName !== 'IMG') return;
    imageSize(img.src).then((d) => {
      let w = d.w, hh = d.h;
      const maxW = App.contentWidth();
      if (w > maxW) { hh = hh * maxW / w; w = maxW; }
      img.style.width = Math.round(w) + 'px';
      img.style.height = Math.round(hh) + 'px';
      this.drawBox();
      App.changed();
    });
  },
  remove() {
    const img = this.selected;
    if (!img) return false;
    const all = this.selection();
    History.checkpoint();
    const r = document.createRange();
    r.setStartBefore(this.figOf(img) || img);
    r.collapse(true);
    this.deselect();
    all.forEach((o) => (this.figOf(o) || o).remove());
    Sel.set(r);
    App.changed();
    return true;
  },

  init() {
    const ed = Sel.editor;
    ed.addEventListener('mousedown', (e) => {
      if (Shapes.drawing) return;
      let target = this.objOf(e.target);
      // 글 뒤로 보낸 그림·도형: 글자가 없는 곳을 누르거나 Alt+클릭하면 선택
      if (!target) {
        const under = document.elementsFromPoint(e.clientX, e.clientY).map((x) => this.objOf(x)).find((x) => x && x.dataset.wrap === 'behind');
        if (under && (e.altKey || !textAtPoint(e.clientX, e.clientY))) target = under;
      }
      const field = e.target.closest && e.target.closest('.mm-field');
      if (!target && field && e.button === 0 && !e.shiftKey) {
        const r = document.createRange();
        r.selectNode(field);
        Sel.set(r);
        e.preventDefault();
        Sel.editor.focus({ preventScroll: true });
        return;
      }
      if (target && e.button === 0 && (e.ctrlKey || e.shiftKey)) {
        // 여러 개체 고르기
        e.preventDefault();
        this.toggleMulti(target);
        Sel.editor.focus({ preventScroll: true });
        if (this.selected) { const r = document.createRange(); r.selectNode(this.selected); Sel.set(r); }
        return;
      }
      if (target && e.button === 0 && this.multi.length > 1 && this.multi.includes(target)) {
        // 고른 개체들을 함께 끌어 옮기기
        e.preventDefault();
        if (this.isFloating(target)) this.startMove(e, target);
        return;
      }
      if (target && e.button === 0) {
        this.select(target);
        const r = document.createRange();
        r.selectNode(target);
        Sel.set(r);
        e.preventDefault();
        if (this.isFloating(target)) this.startMove(e, target);
      } else if (target && e.button === 2) {
        if (!(this.multi.length > 1 && this.multi.includes(target))) this.select(target);
      } else if (!e.target.closest('.img-box')) this.deselect();
    });
    ed.addEventListener('dblclick', (e) => {
      const o = this.objOf(e.target);
      if (!o) return;
      if (o.dataset.kind === 'textbox') {
        // 글상자: 글 편집으로
        this.deselect();
        const body = o.querySelector('.tb-body');
        body.focus({ preventScroll: true });
        Sel.caretInto(body, true);
        return;
      }
      this.select(o);
      Commands.run(this.propsCmd(o));
    });
    // 그림 드래그 금지(내부 이동은 오려두기/붙이기로)
    ed.addEventListener('dragstart', (e) => { if (e.target.tagName === 'IMG') e.preventDefault(); });
    // 파일 끌어다 놓기
    ed.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
    ed.addEventListener('drop', async (e) => {
      const files = Array.from(e.dataTransfer.files || []);
      if (!files.length) return;
      e.preventDefault();
      const docs = files.filter((f) => /\.(hwpx|hwp|txt|html?)$/i.test(f.name));
      if (docs.length) { for (const f of docs) App.openPath(window.native.pathForFile(f)); return; }
      const imgs = files.filter((f) => f.type.startsWith('image/'));
      if (!imgs.length) return;
      const pos = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (pos && ed.contains(pos.startContainer)) Sel.set(pos);
      History.checkpoint();
      for (const f of imgs) await Img.insert(await fileToDataURL(f), { name: f.name });
      App.changed();
    });
  },
};

function imageSize(url) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res({ w: im.naturalWidth || 100, h: im.naturalHeight || 100 });
    im.onerror = () => res({ w: 100, h: 100 });
    im.src = url;
  });
}
function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

// 화면 좌표에 글자가 있는지
function textAtPoint(x, y) {
  const r = document.caretRangeFromPoint(x, y);
  if (!r || r.startContainer.nodeType !== 3) return false;
  const t = r.startContainer;
  const rg = document.createRange();
  for (const off of [r.startOffset - 1, r.startOffset]) {
    if (off < 0 || off >= t.length) continue;
    rg.setStart(t, off); rg.setEnd(t, off + 1);
    for (const b of rg.getClientRects()) if (x >= b.left - 1 && x <= b.right + 1 && y >= b.top && y <= b.bottom) return true;
  }
  return false;
}
