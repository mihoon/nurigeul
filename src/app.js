// 누리글 앱 본체
'use strict';
const DEFAULT_PAGE = { width: 210, height: 297, top: 20, bottom: 15, left: 30, right: 30, header: 15, footer: 15 };
const App = {
  page: { ...DEFAULT_PAGE },
  docSettings: { header: null, footer: null, pageNum: null },
  filePath: null,
  fileName: null,
  untitled: 1,
  dirty: false,
  zoom: 1,
  overwrite: false,
  blockMode: false,
  fonts: FONT_LIST.slice(),
  pendingChord: null,
  lastSel: null,

  async init() {
    document.execCommand('defaultParagraphSeparator', false, 'p');
    document.execCommand('styleWithCSS', false, true);
    this.buildMenubar();
    this.buildToolbars();
    const ed = Sel.editor;
    ed.innerHTML = '<p><br></p>';
    History.onChange = () => {
      if (MultiSel.active) { MultiSel.active = false; MultiSel.carets = []; $('#st-block').textContent = ''; MultiSel.draw(); }
      this.changed(true);
    };
    this.bindEvents();
    Table.initMouse();
    Img.init();
    Shapes.init();
    TabStops.init();
    ColBlock.init();
    HF.init();
    Ratio.init();
    Marks.updateSoon = debounce(() => Marks.update(), 150);
    Ruler.init();
    await Macro.load();
    // 설정
    try {
      const s = window.native ? await window.native.loadSettings() : {};
      if (s.noGuides) document.body.classList.add('no-guides');
      if (s.showMarks) document.body.classList.add('show-marks');
      if (s.showParaMarks) document.body.classList.add('show-paramarks');
      if (s.noHRuler) document.body.classList.add('no-hruler');
      if (s.noVRuler) document.body.classList.add('no-vruler');
      if (s.zoom) this.zoom = s.zoom;
      if (s.defaultFont) this.defaultFont = s.defaultFont;
      if (s.defaultSize > 0) this.defaultSize = +s.defaultSize;
      this.settings = s || {};
      if (s.lang === 'en') I18N.setLang('en', true);
      if (s.defaultPage) { Object.assign(DEFAULT_PAGE, s.defaultPage); this.page = { ...DEFAULT_PAGE }; }
    } catch { /* 무시 */ }
    this.setZoom(this.zoom, true);
    // 초기 문서
    const init = window.native ? await window.native.init() : {};
    Tabs.init(init.untitled || 1);
    if (init.filePath) await this.openPath(init.filePath, true);
    else if (init.html) {
      if (init.page) this.page = { ...this.page, ...init.page };
      if (init.settings) this.docSettings = { ...this.docSettings, ...init.settings };
      this.setHtml(init.html);
      this.fileName = init.title || null;
      this.dirty = true;
    }
    this.layout();
    this.updateTitle();
    Sel.caretInto(ed.querySelector('p, td') || ed);
    ed.focus();
    this.updateToolbar();
    this.updateStatus();
    this.loadLocalFonts();
    if (window.native) window.native.on('app:close-request', () => this.requestClose());
  },

  async loadLocalFonts() {
    try {
      if (!window.queryLocalFonts) return;
      const fonts = await window.queryLocalFonts();
      const fam = Array.from(new Set(fonts.map((f) => f.family))).sort((a, b) => a.localeCompare(b, 'ko'));
      this.fonts = Array.from(new Set([...FONT_LIST, ...fam]));
      this.fillFontSelect();
    } catch { /* 권한 없음 */ }
  },

  // ================= 문서 =================
  setHtml(html) {
    const ed = Sel.editor;
    ed.innerHTML = html || '<p><br></p>';
    // 표 셀에 문단 보장
    ed.querySelectorAll('td, th').forEach((td) => { if (!td.firstElementChild || !isBlock(td.firstElementChild)) { const p = h('p'); while (td.firstChild) p.append(td.firstChild); if (!p.firstChild) p.append(h('br')); td.append(p); } });
    Merge.convertText(ed);
    Para.ensure();
    History.reset();
    Img.deselect();
    Table.block.clear();
    Shapes.renderAll(ed);
    Cols.applyAll(ed);
    Look.applyAll(ed);
    ed.querySelectorAll('td[data-diag]').forEach((td) => Table.paintDiag(td));
    TabStops.wrapAll(ed);
    this.layout();
    this.resolveFloats();
  },
  // HWPX에서 불러온 글 앞/뒤 그림의 위치를 편집기 좌표로
  resolveFloats() {
    const ed = Sel.editor;
    const imgs = ed.querySelectorAll('[data-voff]');
    if (!imgs.length) return;
    const p = this.page, CH = this.contentHeight(), PT = this.pitch();
    const padTop = U.mm2px(p.top + p.header), left = U.mm2px(p.left);
    const bodyW = this.contentWidth(), paperW = U.mm2px(p.width), paperH = U.mm2px(p.height);
    const er = ed.getBoundingClientRect();
    imgs.forEach((img) => {
      const d = img.dataset;
      const anchor = img.tagName === 'TABLE' ? img : img.parentElement.closest('p, li, td') || ed;
      const aTop = (anchor.getBoundingClientRect().top - er.top) / this.zoom;
      const k = this.pageOfY(aTop);
      const w = parseFloat(img.style.width) || img.naturalWidth || img.offsetWidth, hh = parseFloat(img.style.height) || parseFloat(img.style.minHeight) || img.naturalHeight || img.offsetHeight;
      let y, x;
      const voff = +d.voff || 0, hoff = +d.hoff || 0;
      if (d.vrel === 'PARA') y = aTop + voff;
      else {
        const base = d.vrel === 'PAPER' ? k * PT - padTop : k * PT;
        const areaH = d.vrel === 'PAPER' ? paperH : CH;
        y = base + (d.valign === 'CENTER' ? (areaH - hh) / 2 + voff : d.valign === 'BOTTOM' ? areaH - hh - voff : voff);
      }
      const baseX = d.hrel === 'PAPER' ? -left : 0;
      const areaW = d.hrel === 'PAPER' ? paperW : bodyW;
      x = baseX + (d.halign === 'CENTER' ? (areaW - w) / 2 + hoff : d.halign === 'RIGHT' ? areaW - w - hoff : hoff);
      img.style.left = Math.round(x) + 'px';
      img.style.top = Math.round(y) + 'px';
      ['vrel', 'hrel', 'valign', 'halign', 'voff', 'hoff'].forEach((n) => delete d[n]);
      if (img.tagName === 'TABLE') Shapes.reanchorTable(img);
    });
  },
  isEmptyDoc() {
    const ed = Sel.editor;
    return !this.filePath && !this.dirty && !ed.textContent.replace(/​/g, '').trim() && !ed.querySelector('img,table,.nobj');
  },
  async openDialog() {
    const files = await window.native.openDialog('open');
    if (!files) return;
    for (const f of files) await this.openFile(f);
  },
  async openPath(p, here = false) {
    if (!p) return;
    try {
      const f = await window.native.readFile(p);
      await this.openFile(f, here);
    } catch (e) { Dialog.alert(`파일을 열 수 없습니다.\n${p}\n${e.message}`); }
  },
  async openFile(f, here = false) {
    // .hwp(바이너리): HWPX로 바꿔서 불러옴 (저장하면 .hwpx)
    const isHwp = /\.hwp$/i.test(f.name) || HWP5.isHwp5(f.data);
    if (!here && !this.isEmptyDoc()) Tabs.newDoc(); // 새 탭에서 열기
    try {
      if (isHwp || /\.hwpx$/i.test(f.name)) {
        if (isHwp) status('HWP 문서를 HWPX로 바꾸는 중…');
        const doc = await HWPX.read(isHwp ? await HWP5.toHwpx(f.data) : f.data);
        this.page = { ...DEFAULT_PAGE, ...(doc.page || {}) };
        this.docSettings = { header: null, footer: null, pageNum: null, ...doc.settings };
        this.setHtml(doc.html);
      } else if (/\.html?$/i.test(f.name)) {
        this.setHtml(sanitizeHtml(readTextAuto(f.data)));
      } else {
        const text = readTextAuto(f.data);
        this.setHtml(text.replace(/\r\n?/g, '\n').split('\n').map((l) => `<p>${escHtml(l) || '<br>'}</p>`).join(''));
      }
      this.filePath = /\.hwpx$/i.test(f.name) && !isHwp ? f.path : null;
      this.fileName = f.name.replace(/\.[^.]+$/, '') + (/\.hwpx?$/i.test(f.name) || isHwp ? '.hwpx' : '');
      this.dirty = false;
      this.updateTitle();
      if (isHwp) { status(`${f.name}을(를) HWPX로 바꿔 불러왔습니다. 저장하면 HWPX 파일로 저장됩니다.`); Sel.caretInto(Sel.editor.querySelector('p, td') || Sel.editor); Sel.editor.focus(); return; }
      Sel.caretInto(Sel.editor.querySelector('p, td') || Sel.editor);
      Sel.editor.focus();
      Sel.editor.parentElement.parentElement.parentElement.scrollTop = 0;
      status(`${f.name}을(를) 불러왔습니다.`);
    } catch (e) {
      console.error(e);
      Dialog.alert(`문서를 여는 중 문제가 생겼습니다.\n${e.message}`);
    }
  },
  prepareForOutput() {
    MultiSel.stop();
    Table.block.clear();
    Img.deselect();
    Para.ensure();
  },
  async save(as = false) {
    let p = this.filePath;
    if (!p || as) {
      p = await window.native.saveDialog('hwpx', (this.fileName || `${T("문서")}${this.untitled}`).replace(/\.hwpx$/i, '') + '.hwpx');
      if (!p) return false;
    }
    try {
      this.prepareForOutput();
      const model = Model.fromEditor();
      const bytes = await HWPX.write(model, { title: this.baseName(p) });
      await window.native.writeFile(p, bytes);
      this.filePath = p;
      this.fileName = p.split(/[\\/]/).pop();
      this.dirty = false;
      this.updateTitle();
      status(`저장했습니다: ${p}`);
      return true;
    } catch (e) {
      console.error(e);
      Dialog.alert('저장하지 못했습니다: ' + e.message);
      return false;
    }
  },
  baseName(p) { return (p || '').split(/[\\/]/).pop().replace(/\.[^.]+$/, ''); },
  async exportDocx() {
    const p = await window.native.saveDialog('docx', (this.baseName(this.fileName) || `${T("문서")}${this.untitled}`) + '.docx');
    if (!p) return;
    try {
      this.prepareForOutput();
      const bytes = await DocxExport.write(Model.fromEditor());
      await window.native.writeFile(p, bytes);
      toast('DOCX로 내보냈습니다.');
    } catch (e) { console.error(e); Dialog.alert('DOCX 내보내기 실패: ' + e.message); }
  },
  async renderPDF() {
    this.prepareForOutput();
    this.applyPrintStyle();
    return window.native.printToPDF();
  },
  async exportPdf() {
    const p = await window.native.saveDialog('pdf', (this.baseName(this.fileName) || `${T("문서")}${this.untitled}`) + '.pdf');
    if (!p) return;
    try {
      const bytes = await this.renderPDF();
      await window.native.writeFile(p, bytes);
      toast('PDF로 저장했습니다.');
    } catch (e) { Dialog.alert('PDF 저장 실패: ' + e.message); }
  },
  async print() {
    this.prepareForOutput();
    this.applyPrintStyle();
    await window.native.print();
  },
  async requestClose() {
    if (!(await Tabs.confirmAll())) return;
    window.native.closeWindow();
  },
  displayName() { return this.fileName || `빈 문서 ${this.untitled}`; },
  updateTitle() {
    const t = T(`${this.displayName()}${this.dirty ? ' *' : ''} - 누리글`);
    document.title = t;
    if (window.native) window.native.setTitle(t);
    Tabs.render();
  },
  changed(fromHistory) {
    if (!this.dirty) { this.dirty = true; this.updateTitle(); }
    if (Split.mode) { clearTimeout(this._splitT); this._splitT = setTimeout(() => Split.render(), 400); }
    this.layoutSoon();
    if (Img.selected) Img.drawBox();
  },
  setPage(p) {
    this.page = { ...this.page, ...p };
    this.layout();
  },
  setDocSetting(k, v) {
    this.docSettings[k] = v;
    this.layout();
    status('설정했습니다. 인쇄·PDF·저장 파일에 반영됩니다.');
  },

  // ================= 배치 / 쪽 =================
  contentWidth() { return U.mm2px(this.page.width - this.page.left - this.page.right); },
  contentHeight() { return U.mm2px(this.page.height - this.page.top - this.page.header - this.page.bottom - this.page.footer); },
  layoutSoon: null,
  // 쪽 사이 간격 (쪽 윤곽을 켜면 쪽마다 떨어져 보임)
  PAGE_GAP: 18,
  paged() { return !document.body.classList.contains('no-guides'); },
  // 편집기 좌표에서 한 쪽의 본문 시작부터 다음 쪽 본문 시작까지 거리
  pitch() { return this.paged() ? U.mm2px(this.page.height) + this.PAGE_GAP : this.contentHeight(); },
  pageOfY(y) { return Math.max(0, Math.floor(y / this.pitch() + 1e-6)); },
  // Enter로 새로 생긴 빈 문단에 앞 문단 끝 글자 모양(글꼴 span 등)을 그대로 넣어 둠
  // (크롬은 '입력할 글자 모양'으로만 기억해서 한글 입력기로 치면 기본 글꼴로 돌아가는 일이 있음)
  carryStyle() {
    const r = Sel.range();
    if (!r || !r.collapsed) return;
    const blk = blockOf(r.startContainer);
    if (!blk || blk === Sel.editor || blk.textContent.replace(/[\s\u200B]/g, '') || blk.querySelector('img,.nobj,table')) return;
    const INL = /^(SPAN|B|STRONG|I|EM|U|S|STRIKE|SUB|SUP|FONT)$/;
    // 이미 글자 모양 요소 안에 커서가 있으면 그대로
    for (let n = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement; n && n !== blk; n = n.parentElement) if (INL.test(n.tagName)) return;
    // 바로 앞의 글이 있는 문단 (목록·표 칸 경계와 상관없이 문서 순서로)
    const blocks = MultiSel.paraBlocks();
    let i = blocks.indexOf(blk);
    if (i < 0) return;
    let prev = null, last = null;
    const txt = (b) => { const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (t.nodeValue.replace(/[\s\u200B]/g, '') && t.parentElement.closest('.nobj, .tab, .mm-field') === null ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) }); let l = null, t; while ((t = tw.nextNode())) l = t; return l; };
    for (let j = i - 1; j >= 0 && j >= i - 3; j--) { const l = txt(blocks[j]); if (l) { prev = blocks[j]; last = l; break; } }
    if (!last) return;
    const chain = [];
    for (let n = last.parentElement; n && n !== prev; n = n.parentElement) {
      if (!INL.test(n.tagName) || n.closest('.nobj, .tab, .mm-field')) return;
      chain.unshift(n.cloneNode(false));
    }
    if (!chain.length) return;
    for (let i = 0; i < chain.length - 1; i++) chain[i].append(chain[i + 1]);
    const br = h('br');
    chain[chain.length - 1].append(br);
    blk.querySelectorAll(':scope > br').forEach((b) => b.remove());
    blk.append(chain[0]);
    const cr = document.createRange(); cr.setStartBefore(br); cr.collapse(true);
    Sel.set(cr);
    if (blk.tagName === 'LI') Lists.syncMarkers();
  },
  WRAP_PAIRS: { '"': '"', "'": "'", '(': ')', '[': ']', '{': '}', '<': '>', '`': '`', '“': '”', '‘': '’', '「': '」', '『': '』', '《': '》', '〈': '〉', '【': '】' },
  wrapSelection(open) {
    const s = window.getSelection();
    if (!s.rangeCount || s.isCollapsed || Table.block.active()) return false;
    const r = s.getRangeAt(0).cloneRange();
    const ed = Sel.editor;
    if (!ed.contains(r.startContainer) || !ed.contains(r.endContainer)) return false;
    const close = this.WRAP_PAIRS[open];
    // 끝이 다음 문단 맨 앞이면(세 번 누르기 등) 앞 문단 끝으로
    const sb = blockOf(r.startContainer), eb = blockOf(r.endContainer);
    if (eb && sb !== eb) {
      const pre = document.createRange();
      pre.setStart(eb, 0); pre.setEnd(r.endContainer, r.endOffset);
      if (!pre.toString().replace(/\u200B/g, '') && eb.previousElementSibling) {
        const pb = eb.previousElementSibling;
        let n = pb.childNodes.length;
        if (n && pb.lastChild.nodeName === 'BR') n--;
        r.setEnd(pb, n);
      }
    }
    if (!r.toString().replace(/\u200B/g, '').length && !r.cloneContents().querySelector('img,.nobj')) return false;
    History.checkpoint();
    const c = document.createTextNode(close), o = document.createTextNode(open);
    const er = r.cloneRange(); er.collapse(false); er.insertNode(c);
    const sr = r.cloneRange(); sr.collapse(true); sr.insertNode(o);
    const nr = document.createRange();
    nr.setStartAfter(o); nr.setEndBefore(c);
    Sel.set(nr);
    this.changed();
    return true;
  },
  // 선택 범위의 글: 문단·줄 나눔마다 줄 하나, 탭은 탭, 표는 칸마다 탭·줄마다 줄 바꿈
  plainText(r) {
    let out = '';
    const nl = () => { if (out && !out.endsWith('\n')) out += '\n'; };
    const BLOCK = /^(P|DIV|H[1-6]|LI|TR|TABLE|UL|OL|BLOCKQUOTE|PRE)$/;
    const walk = (n) => {
      if (!r.intersectsNode(n)) return;
      if (n.nodeType === 3) {
        let a = 0, b = n.nodeValue.length;
        if (n === r.startContainer) a = r.startOffset;
        if (n === r.endContainer) b = r.endOffset;
        out += n.nodeValue.slice(a, b).replace(/\u200B/g, '');
        return;
      }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'BR') {
        const blk = n.parentElement;
        const last = !n.nextSibling || (n.nextSibling.nodeType === 3 && !n.nextSibling.nodeValue);
        // 문단 끝의 자리 표시 줄 나눔은 빈 문단일 때만 줄로 셈
        if (last && blk && BLOCK.test(blk.tagName) && blk.textContent.replace(/\u200B/g, '')) return;
        out += '\n';
        return;
      }
      if (n.classList.contains('tab')) { out += '\t'; return; }
      if (n.matches('.pnhide, .pnnew, .colbreak, .pagebreak, svg')) return;
      const block = BLOCK.test(tag);
      if (block && n !== ed()) nl();
      if (tag === 'LI' && n.parentElement && n.parentElement.tagName === 'OL' && r.intersectsNode(n.firstChild || n)) out += Lists.markerText(n);
      if ((tag === 'TD' || tag === 'TH') && n.previousElementSibling && r.intersectsNode(n.previousElementSibling)) out += '\t';
      for (const c of Array.from(n.childNodes)) walk(c);
      if (block) nl();
    };
    const ed = () => Sel.editor;
    walk(r.commonAncestorContainer);
    return out.replace(/\n$/, '');
  },
  // ---- 기본 글꼴: 새 문서는 설정의 기본 글꼴, 문서마다 처음 쓴 기본 글꼴을 기억 ----
  defaultFont: '함초롬바탕',
  defaultSize: 10,
  baseFont() {
    if (!this.docSettings.baseFont) this.docSettings.baseFont = this.defaultFont;
    return this.docSettings.baseFont;
  },
  baseSize() {
    if (!(this.docSettings.baseSize > 0)) this.docSettings.baseSize = this.defaultSize;
    return this.docSettings.baseSize;
  },
  applyBaseFont() {
    const f = this.baseFont().replace(/["']/g, '');
    const generic = /명조|바탕|Batang|Myeongjo|Serif|Times|궁서/i.test(f) ? 'serif' : 'sans-serif';
    const stack = `"${f}", "함초롬바탕", "HCR Batang", "바탕", "Batang", "Noto Serif KR", ${generic}`;
    const ed = Sel.editor;
    if (ed.style.fontFamily !== stack) ed.style.fontFamily = stack;
    const sz = this.baseSize() + 'pt';
    if (ed.style.fontSize !== sz) ed.style.fontSize = sz;
    document.documentElement.style.setProperty('--doc-font', stack);
  },
  async defaultFontDialog() {
    const v = await Dialog.form('기본 글꼴', [
      { name: 'font', label: '기본 글꼴', type: 'select', options: fontOptions(this.defaultFont), value: this.defaultFont },
      { name: 'size', label: '기본 크기', type: 'number', value: this.defaultSize, min: 5, max: 72, step: 0.5, suffix: 'pt' },
      { name: 'cur', label: '지금 문서에도 적용', type: 'checkbox', value: true },
    ], { okLabel: '설정', width: 380, note: '새 문서는 이 글꼴과 크기로 시작합니다. 글꼴을 따로 지정한 글자는 바뀌지 않습니다. 다른 탭에 열려 있는 문서는 그대로입니다.' });
    if (!v) return;
    this.defaultFont = v.font || '함초롬바탕';
    this.defaultSize = v.size > 0 ? v.size : 10;
    await this.saveSettings({ defaultFont: this.defaultFont, defaultSize: this.defaultSize });
    if (v.cur) {
      History.checkpoint();
      this.docSettings.baseFont = this.defaultFont;
      this.docSettings.baseSize = this.defaultSize;
      this.layout();
      this.changed();
    }
    status(`기본 글꼴을 ${this.defaultFont} ${this.defaultSize}pt로 정했습니다.`);
    this.updateToolbar && this.updateToolbar();
  },
  layout() {
    this.applyBaseFont();
    Ratio.render();
    Lists.syncMarkers();
    TabStops.layoutAll();
    const p = this.page;
    const page = $('#page');
    const padTop = U.mm2px(p.top + p.header), padBot = U.mm2px(p.bottom + p.footer);
    page.style.width = U.mm2px(p.width) + 'px';
    page.style.padding = `${padTop}px ${U.mm2px(p.right)}px ${padBot}px ${U.mm2px(p.left)}px`;
    const ed = Sel.editor;
    const CH = this.contentHeight();
    const paged = this.paged();
    const pitch = this.pitch();
    // ---- 쪽 나누기: 문단을 다음 쪽으로 넘기고, 쪽 나누기는 남은 자리를 채움 ----
    const gapCss = $('#page-gaps') || document.head.appendChild(h('style', { id: 'page-gaps' }));
    gapCss.textContent = '';
    const kids = Array.from(ed.children);
    kids.forEach((b) => { if (b.classList.contains('pagebreak')) b.style.height = '0px'; });
    ed.style.minHeight = '';
    const m = kids.map((b) => {
      const cs = getComputedStyle(b);
      const mt = parseFloat(cs.marginTop) || 0, mb = parseFloat(cs.marginBottom) || 0;
      return { top: b.offsetTop - mt, h: b.offsetHeight + mt + mb, mt, out: cs.position === 'absolute' || cs.float !== 'none' };
    });
    let shift = 0, lastBottom = 0;
    const rules = [];
    this.blockPage = new WeakMap();
    kids.forEach((b, i) => {
      const e = m[i];
      if (e.out) return;
      const top = e.top + shift;
      const pk = Math.floor(top / pitch + 1e-6);
      const cEnd = pk * pitch + CH;
      if (b.classList.contains('pagebreak')) {
        // 쪽 맨 위에 있는 쪽 나누기는 빈 쪽을 만들지 않음
        const atStart = top > 0 && top - pk * pitch < 2;
        const hgt = atStart ? 0 : Math.max(0, (pk + 1) * pitch - top);
        b.style.height = hgt + 'px';
        shift += hgt;
        lastBottom = Math.max(lastBottom, top + hgt);
        return;
      }
      let gap = 0;
      if (paged && top > pk * pitch + 1) {
        if (top >= cEnd - 0.5) gap = (pk + 1) * pitch - top; // 쪽 여백에서 시작하면 다음 쪽으로
        else if (top + e.h > cEnd + 0.5 && e.h <= CH) gap = (pk + 1) * pitch - top; // 쪽 끝에 걸치면 통째로 다음 쪽으로
      }
      this.blockPage.set(b, Math.floor((top + gap) / pitch + 1e-6));
      if (gap > 0) {
        const sel = `#editor > :nth-child(${i + 1})`;
        if (/^(P|H[1-6])$/.test(b.tagName)) rules.push(`${sel}::before{content:"";display:block;height:${gap.toFixed(1)}px}`);
        else rules.push(`${sel}{margin-top:${(e.mt + gap).toFixed(1)}px !important}`);
        shift += gap;
      }
      lastBottom = Math.max(lastBottom, top + gap + e.h);
    });
    gapCss.textContent = rules.length ? `@media screen{${rules.join('')}}` : '';
    const contentH = Math.max(lastBottom, ed.scrollHeight, 1);
    const pages = Math.max(1, Math.floor((contentH - 1) / pitch) + 1);
    ed.style.minHeight = (pages - 1) * pitch + CH + 'px';
    page.style.minHeight = (padTop + (pages - 1) * pitch + CH + padBot) + 'px';
    this.pages = pages;
    // ---- 쪽 모양 (쪽 사이 틈, 머리말·꼬리말·쪽 번호) ----
    const guides = $('#page-guides');
    guides.innerHTML = '';
    const hf = this.docSettings;
    const hfLine = (text, align, top) => h('div', { class: 'pg-hf', style: { top: top + 'px', left: U.mm2px(p.left) + 'px', right: U.mm2px(p.right) + 'px', textAlign: align || 'center' } }, text);
    const pno = PageNum.opts();
    const paperTop = (k) => (paged ? k * pitch : 0);
    const footY = (k) => (paged ? k * pitch : (pages - 1) * CH) + padTop + CH + U.mm2px(p.bottom) - 4;
    for (let k = 0; k < pages; k++) {
      if (paged && k > 0) {
        const y = k * pitch - this.PAGE_GAP;
        guides.append(h('div', { class: 'pg-gap', style: { top: y + 'px', height: this.PAGE_GAP + 'px' } }, h('span', {}, `${k + 1}쪽`)));
      } else if (!paged && k > 0) {
        const y = padTop + k * CH;
        guides.append(h('div', { class: 'pg-line', style: { top: y + 'px' } }), h('div', { class: 'pg-lbl', style: { top: y + 'px' } }, `${k + 1}쪽`));
      }
      if (!paged && k > 0 && k < pages - 1) continue; // 이어 보기: 머리말은 첫 쪽, 꼬리말은 끝 쪽에만
      const hide = PageNum.hiddenOn(k);
      const footBottom = paged ? paperTop(k) + U.mm2px(p.height - p.bottom) : padTop + pages * CH + U.mm2px(p.footer);
      const hdEl = !hide.hd && (paged || k === 0) ? HF.screenEl('header', k, pages, paperTop(k) + U.mm2px(p.top)) : null;
      const ftEl = !hide.ft && (paged || k === pages - 1) ? HF.screenEl('footer', k, pages, footBottom) : null;
      if (hdEl) guides.append(hdEl);
      if (ftEl) guides.append(ftEl);
      if (pno && (paged || k === 0 || k === pages - 1)) {
        const t = PageNum.label(k, pages);
        if (t) {
          const top = pno.pos.startsWith('top');
          const al = pno.pos.split('-')[1];
          if (paged || (top && k === 0) || (!top && k === pages - 1)) {
            const box = top ? hdEl : ftEl;
            if (box) {
              // 머리말·꼬리말과 같은 칸에 이어서
              const sp = box.querySelector('.' + al);
              const own = !!sp.textContent;
              const no = h('span', { class: 'pg-no' }, (own ? '   ' : '') + t);
              // 머리말·꼬리말이 없는 칸이면 쪽 번호 글자 모양으로 (인쇄와 같게)
              if (!own) no.style.cssText = HF.cssFont(pno);
              sp.append(no);
            } else {
              const el = hfLine(t, al, top ? paperTop(k) + U.mm2px(p.top) : footBottom - 16);
              el.classList.add('pg-no');
              el.style.cssText += HF.cssFont(pno) + 'line-height:1.5;';
              if (!top) el.style.top = (footBottom - pno.size * 96 / 72 * 1.5) + 'px';
              guides.append(el);
            }
          }
        }
      }
    }
    this.applyPrintStyle();
    this.updateStatus();
    if (Img.selected) Img.drawBox();
    Ruler.drawSoon();
    if (Marks.updateSoon) Marks.updateSoon();
    if (MultiSel.active) MultiSel.draw();
  },
  pageCount() { return this.pages || 1; },
  currentPage() {
    const r = Sel.range();
    if (!r) return 1;
    let rect = r.getBoundingClientRect();
    if (!rect.height && r.startContainer.nodeType === 1) {
      const el = r.startContainer.childNodes[r.startOffset] || r.startContainer;
      if (el.getBoundingClientRect) rect = el.getBoundingClientRect();
    }
    const edTop = Sel.editor.getBoundingClientRect().top;
    const y = (rect.top - edTop) / this.zoom;
    return Math.min(this.pageCount(), this.pageOfY(y) + 1);
  },
  gotoPage(n) {
    n = Math.max(1, Math.min(this.pageCount(), n | 0));
    const ws = $('#workspace');
    const edRect = Sel.editor.getBoundingClientRect();
    const wsRect = ws.getBoundingClientRect();
    const y = edRect.top - wsRect.top + ws.scrollTop + (n - 1) * this.pitch() * this.zoom;
    ws.scrollTop = y - 30;
    setTimeout(() => {
      const r = document.caretRangeFromPoint(edRect.left + 10 * this.zoom, Sel.editor.getBoundingClientRect().top + ((n - 1) * this.pitch() + 4) * this.zoom);
      if (r && Sel.editor.contains(r.startContainer)) Sel.set(r);
      Sel.editor.focus({ preventScroll: true });
    }, 0);
  },
  scrollToSelection() {
    const r = Sel.range();
    if (!r) return;
    const rect = r.getBoundingClientRect();
    const ws = $('#workspace');
    const wr = ws.getBoundingClientRect();
    if (rect.top < wr.top + 20 || rect.bottom > wr.bottom - 20) ws.scrollTop += rect.top - wr.top - wr.height / 3;
  },
  setZoom(z, silent) {
    z = Math.round(Math.max(0.3, Math.min(3, z)) * 100) / 100;
    this.zoom = z;
    $('#zoomer').style.zoom = z;
    $('#zoom-range').value = Math.round(z * 100);
    $('#zoom-val').textContent = Math.round(z * 100) + '%';
    if (Img.selected) Img.drawBox();
    Ruler.drawSoon();
    if (Marks.updateSoon) Marks.updateSoon();
    if (Split.mode) Split.render();
    if (!silent) this.saveUiPref();
  },
  zoomToWidth() {
    const ws = $('#workspace');
    this.setZoom((ws.clientWidth - 60) / U.mm2px(this.page.width));
  },
  saveUiPref: debounce(function () {
    const cl = document.body.classList;
    App.saveSettings({ noGuides: cl.contains('no-guides'), showMarks: cl.contains('show-marks'), showParaMarks: cl.contains('show-paramarks'), noHRuler: cl.contains('no-hruler'), noVRuler: cl.contains('no-vruler'), zoom: App.zoom });
  }, 500),
  settings: {},
  // 설정 파일은 다른 창과 함께 쓰므로 읽어서 합친 뒤 저장
  async saveSettings(patch) {
    let cur = {};
    try { cur = window.native ? (await window.native.loadSettings()) || {} : {}; } catch { cur = {}; }
    Object.assign(cur, patch);
    this.settings = cur;
    if (window.native) await window.native.saveSettings(cur);
  },

  applyPrintStyle() {
    const p = this.page, s = this.docSettings;
    const pnPos = PageNum.opts() ? PageNum.opts().pos : null;
    // 머리말·꼬리말과 쪽 번호를 합친 margin box (cn: 이 쪽의 번호 셈 이름)
    const boxesFor = (cn, showPn, hideHd, hideFt) => {
      const boxes = {};
      for (const side of ['top', 'bottom']) for (const s of HF.SLOTS) boxes[side + '-' + s] = { parts: [], style: '', line: false };
      if (!hideHd) HF.printBoxes('header', cn, boxes);
      if (!hideFt) HF.printBoxes('footer', cn, boxes);
      if (showPn && pnPos && boxes[pnPos]) {
        const b = boxes[pnPos];
        if (b.parts.length) b.parts.push('"   "'); else b.style = HF.cssFont(PageNum.style());
        b.parts.push(PageNum.pnExpr(cn));
      }
      let margin = '';
      for (const [pos, bx] of Object.entries(boxes)) {
        const top = pos.startsWith('top');
        const room = top ? p.header : p.footer;
        const content = bx.parts.length ? bx.parts.join(' ') : bx.line ? '""' : 'none';
        const font = bx.style || 'font:9pt "함초롬바탕","HCR Batang","바탕",serif;';
        const al = pos.split('-')[1];
        const pad = Math.max(0, room - 6);
        let css = `content:${content};${font}text-align:${al};vertical-align:${top ? 'bottom' : 'top'};`;
        if (bx.line) {
          const col = (HF.get(top ? 'header' : 'footer') || {}).color || '#000';
          css += `width:${((p.width - p.left - p.right) / 3).toFixed(2)}mm;border-${top ? 'bottom' : 'top'}:0.4pt solid ${col};padding-${top ? 'bottom' : 'top'}:1mm;margin-${top ? 'bottom' : 'top'}:${Math.max(0, pad - 1)}mm;`;
        } else css += `padding-${top ? 'bottom' : 'top'}:${pad}mm;`;
        margin += `@${pos}{${css}}`;
      }
      return margin;
    };
    const pn = PageNum.printCss(boxesFor);
    $('#page-style').textContent =
      `@page{background:#fff;size:${p.width}mm ${p.height}mm;margin:${p.top + p.header}mm ${p.right}mm ${p.bottom + p.footer}mm ${p.left}mm;${pn.page}}${pn.extra}`;
  },

  // ================= 상태 표시 =================
  updateStatus: null,
  updateToolbar: null,

  // ================= 붙이기 =================
  async pasteFromClipboard(textOnly, args) {
    let html = args && args.html, text = args && args.text;
    if (!args) {
      try {
        if (!textOnly && navigator.clipboard.read) {
          const items = await navigator.clipboard.read();
          for (const it of items) {
            const img = it.types.find((t) => t.startsWith('image/'));
            if (img && !it.types.includes('text/html')) {
              const blob = await it.getType(img);
              await Img.insert(await fileToDataURL(blob));
              return;
            }
            if (it.types.includes('text/html')) html = await (await it.getType('text/html')).text();
            if (it.types.includes('text/plain')) text = await (await it.getType('text/plain')).text();
          }
        } else text = await navigator.clipboard.readText();
      } catch (e) { status('클립보드를 읽을 수 없습니다. Ctrl+V를 사용하세요.'); return; }
    }
    if (ColBlock.clip && text && text.replace(/\r\n?/g, '\n') === ColBlock.clip.text && ColBlock.clip.lines.length > 1) { ColBlock.pasteColumn(ColBlock.clip.lines); return; }
    this.insertPasted(textOnly ? null : html, text);
  },
  insertPasted(html, text) {
    if (html) {
      let clean = sanitizeHtml(html);
      // 글상자·도형은 insertHTML이 망가뜨리므로 자리표시 그림으로 넣은 뒤 바꿔 끼우기
      const objs = [];
      if (clean.includes('nobj')) {
        const tmp = document.createElement('div');
        tmp.innerHTML = clean;
        tmp.querySelectorAll('.nobj').forEach((o) => {
          const ph = document.createElement('img');
          ph.setAttribute('data-nobj-ph', String(objs.length));
          ph.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAAAAACw=');
          objs.push(o);
          o.replaceWith(ph);
        });
        clean = tmp.innerHTML;
      }
      document.execCommand('insertHTML', false, clean);
      Sel.editor.querySelectorAll('img[data-nobj-ph]').forEach((ph) => {
        const o = objs[+ph.getAttribute('data-nobj-ph')];
        if (o) ph.replaceWith(o); else ph.remove();
      });
      Merge.convertText();
      Shapes.renderAll();
      TabStops.wrapAll();
      TabStops.layoutAll();
    } else if (text != null) {
      const lines = text.replace(/\r\n?/g, '\n').split('\n');
      if (lines.length === 1) document.execCommand('insertText', false, text);
      else document.execCommand('insertHTML', false, lines.map((l) => `<p>${escHtml(l).replace(/\t/g, '<span class="tab" contenteditable="false">&#9;</span>') || '<br>'}</p>`).join(''));
    }
    Para.ensure();
    Sel.editor.querySelectorAll('td, th').forEach((td) => { if (!td.firstElementChild) td.append(h('p', {}, h('br'))); });
  },

  toggleBlockMode(force) {
    this.blockMode = force != null ? force : !this.blockMode;
    $('#st-block').textContent = this.blockMode ? '블록 설정 중 (방향키로 범위 지정, Esc 해제)' : '';
  },
};

// ================= 이벤트 =================
App.bindEvents = function () {
  const ed = Sel.editor;
  const ws = $('#workspace');
  App.layoutSoon = debounce(() => App.layout(), 120);
  const statusSoon = debounce(() => { App.updateStatus(); App.updateToolbar(); Ruler.drawSoon(); }, 60);

  window.addEventListener('keydown', (e) => App.onKeyDown(e), true);
  ed.addEventListener('beforeinput', (e) => {
    const t = e.inputType;
    if (t === 'historyUndo') { e.preventDefault(); History.undo(); return; }
    if (t === 'historyRedo') { e.preventDefault(); History.redo(); return; }
    if (Table.block.active()) Table.block.clear();
    if (t === 'insertText' && App.overwrite && !e.isComposing) {
      const s = window.getSelection();
      if (s.isCollapsed) {
        s.modify('extend', 'forward', 'character');
        const sel = s.toString();
        if (!sel || sel === '\n' || /\u0001/.test(sel)) s.collapseToStart();
      }
    }
    if (t === 'insertParagraph' && !MultiSel.active && Lists.enterOnEmpty()) { e.preventDefault(); return; }
    // 블록을 잡고 괄호·따옴표를 누르면 지우지 않고 양쪽을 감쌈
    if (t === 'insertText' && !e.isComposing && e.data && App.WRAP_PAIRS[e.data] && !MultiSel.active && !ColBlock.active && App.wrapSelection(e.data)) {
      e.preventDefault();
      return;
    }
    if (MultiSel.active && !MultiSel.busy && t === 'insertText' && !e.isComposing && e.data && App.WRAP_PAIRS[e.data] && MultiSel.hasSelection()) {
      e.preventDefault();
      MultiSel.wrap(e.data);
      return;
    }
    if (MultiSel.active && !MultiSel.busy && t === 'insertText' && !e.isComposing && e.data) {
      e.preventDefault();
      MultiSel.insertText(e.data);
      return;
    }
    const kind = t.startsWith('insert') && t !== 'insertParagraph' ? 'text' : t.startsWith('delete') ? 'delete' : t;
    History.beforeTyping(kind);
    if (Macro.active && !Macro.playing) {
      if (t === 'insertText' && !e.isComposing && e.data) Macro.text(e.data);
      else if (/^(insertParagraph|insertLineBreak|deleteContentBackward|deleteContentForward|deleteWordBackward|deleteWordForward)$/.test(t)) Macro.input(t);
    }
  });
  ed.addEventListener('compositionstart', () => { App.composing = true; if (MultiSel.active) MultiSel.compStart(); });
  ed.addEventListener('compositionupdate', (e) => { if (MultiSel.active) MultiSel.compUpdate(e.data || ''); });
  ed.addEventListener('compositionend', (e) => {
    App.composing = false;
    if (Macro.active && e.data) Macro.text(e.data);
    if (MultiSel.active) MultiSel.compEnd(e.data || '');
  });
  // 한글 조합 중 방향키: 입력기가 기준 커서만 옮기므로 키를 뗄 때 나머지 커서도 옮김
  window.addEventListener('keyup', (e) => {
    if (!MultiSel.active || !MultiSel.navPending) return;
    const n = MultiSel.navPending; MultiSel.navPending = null;
    MultiSel.navOthers(n[0], n[1], n[2]);
  }, true);
  ed.addEventListener('input', (e) => {
    if (MultiSel.busy) return;
    if (e.inputType === 'insertParagraph') App.carryStyle();
    TabStops.onInput(e);
    if (MultiSel.active) MultiSel.draw();
    if (!ed.firstElementChild || ed.childNodes[0].nodeType === 3) Para.ensure();
    // 글자를 입력한 뒤 남은 빈 자리 표시(ZWSP) 지우기: 방향키가 한 번 더 눌리는 문제 방지
    if (!e.isComposing) {
      const s = window.getSelection();
      const n = s.focusNode;
      if (n && n.nodeType === 3 && s.isCollapsed && n.nodeValue.includes('\u200B') && n.nodeValue.replace(/\u200B/g, '').length) {
        const off = s.focusOffset;
        const removedBefore = n.nodeValue.slice(0, off).split('\u200B').length - 1;
        n.nodeValue = n.nodeValue.replace(/\u200B/g, '');
        s.collapse(n, Math.max(0, off - removedBefore));
      }
      // 장평 문단: 띄어쓰기로 낱말이 나뉘면 바로 상자를 다시 짬 (줄바꿈이 낱말 사이에서 되도록)
      const b = Sel.block();
      if (b && !MultiSel.active && b.querySelector('span.rw, [style*="--hr"]')) Ratio.render(b);
    }
    App.changed();
  });
  ed.addEventListener('paste', (e) => {
    e.preventDefault();
    const dt = e.clipboardData;
    const files = Array.from(dt.files || []).filter((f) => f.type.startsWith('image/'));
    const html = dt.getData('text/html');
    const text = dt.getData('text/plain');
    if (ColBlock.active) ColBlock.stop();
    // 칸 블록으로 복사한 글: 줄마다 같은 칸에 붙이기
    if (ColBlock.clip && text && text.replace(/\r\n?/g, '\n') === ColBlock.clip.text && ColBlock.clip.lines.length > 1) { ColBlock.pasteColumn(ColBlock.clip.lines); return; }
    if (MultiSel.active && text && !/\n/.test(text)) { MultiSel.insertText(text); return; }
    if (MultiSel.active) MultiSel.stop();
    History.checkpoint();
    if (files.length && !html) {
      (async () => { for (const f of files) await Img.insert(await fileToDataURL(f)); App.changed(); })();
      return;
    }
    if (Macro.active) Macro.cmd('paste', { html: html || undefined, text });
    App.insertPasted(html, text);
    App.changed();
  });
  // 복사: 다른 프로그램에 붙일 글(text/plain)은 문단마다 줄 하나로 (크롬 기본은 문단 사이에 빈 줄)
  const fixPlain = () => {
    if (ColBlock._copying) return;
    const r = Sel.range();
    if (!r || r.collapsed) return;
    const plain = App.plainText(r);
    setTimeout(async () => {
      try {
        let html = '';
        for (const it of await navigator.clipboard.read()) if (it.types.includes('text/html')) html = await (await it.getType('text/html')).text();
        const data = { 'text/plain': new Blob([plain], { type: 'text/plain' }) };
        if (html) data['text/html'] = new Blob([html], { type: 'text/html' });
        await navigator.clipboard.write([new ClipboardItem(data)]);
      } catch { /* 클립보드를 못 쓰면 기본 그대로 */ }
    }, 30);
  };
  ed.addEventListener('copy', fixPlain);
  ed.addEventListener('cut', fixPlain);
  ed.addEventListener('cut', () => { History.checkpoint(); if (Macro.active) Macro.cmd('cut'); setTimeout(() => App.changed(), 0); });
  ed.addEventListener('copy', () => { if (Macro.active) Macro.cmd('copy'); });
  document.addEventListener('selectionchange', () => {
    if (Sel.inEditor()) App.lastSel = Sel.save();
    statusSoon();
  });
  ed.addEventListener('mousedown', (e) => {
    History.endTyping();
    if (MultiSel.active) MultiSel.stop();
    if (App.blockMode) App.toggleBlockMode(false);
    if (e.button === 0 && e.shiftKey && !Sel.inEditor() && App.lastSel) Sel.restore(App.lastSel);
  });
  ws.addEventListener('scroll', () => { if (Img.selected) Img.drawBox(); });
  window.addEventListener('resize', () => { if (Img.selected) Img.drawBox(); });
  ws.addEventListener('wheel', (e) => {
    if (e.ctrlKey) { e.preventDefault(); App.setZoom(App.zoom + (e.deltaY < 0 ? 0.1 : -0.1)); }
  }, { passive: false });
  // 용지 바깥 클릭 → 문서 끝으로
  ws.addEventListener('mousedown', (e) => {
    if (e.target === ws || e.target.id === 'zoomer') {
      e.preventDefault();
      const last = ed.lastElementChild;
      if (last) Sel.caretInto(last, true);
      ed.focus({ preventScroll: true });
    } else if (e.target.id === 'page') {
      e.preventDefault();
      ed.focus({ preventScroll: true });
    }
  });
  // 상태 표시줄
  $('#st-mode').addEventListener('click', () => App.toggleOverwrite());
  $('#zoom-range').addEventListener('input', (e) => App.setZoom(+e.target.value / 100));
  $('#zoom-in').addEventListener('click', () => App.setZoom(App.zoom + 0.1));
  $('#zoom-out').addEventListener('click', () => App.setZoom(App.zoom - 0.1));
  // 오른쪽 단추 메뉴
  ed.addEventListener('contextmenu', (e) => { e.preventDefault(); App.showContextMenu(e); });
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.menu-popup') && !e.target.closest('#menubar')) App.closeMenus();
  });
  window.addEventListener('blur', () => App.closeMenus());
  // 문서 파일 끌어다 놓기 (편집기 밖)
  document.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', (e) => {
    if (e.defaultPrevented) return;
    const files = Array.from(e.dataTransfer.files || []).filter((f) => /\.(hwpx|hwp|txt|html?)$/i.test(f.name));
    if (!files.length) return;
    e.preventDefault();
    files.forEach((f) => App.openPath(window.native.pathForFile(f)));
  });
};

App.toggleOverwrite = function () {
  App.overwrite = !App.overwrite;
  const m = $('#st-mode');
  m.textContent = T(App.overwrite ? '수정' : '삽입');
  m.classList.toggle('over', App.overwrite);
};

function keyString(e) {
  const k = e.key;
  if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'HangulMode', 'HanjaMode', 'CapsLock'].includes(k)) return null;
  const code = e.code || '';
  let name;
  if (/^Key[A-Z]$/.test(code)) name = code.slice(3);
  else if (/^Digit\d$/.test(code)) name = code.slice(5);
  else if (/^F\d{1,2}$/.test(k)) name = k;
  else if (code === 'Equal') name = '=';
  else if (code === 'Minus') name = '-';
  else if (code === 'Semicolon') name = ';';
  else if (code === 'NumpadAdd') name = 'NumAdd';
  else if (code === 'NumpadSubtract') name = 'NumSub';
  else name = { ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down', ' ': 'Space', Esc: 'Escape' }[k] || k;
  if (name === 'Process' || name === 'Unidentified') return null;
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(name);
  return parts.join('+');
}

App.onKeyDown = function (e) {
  if (e.target.closest && e.target.closest('.dlg')) return; // 대화상자가 처리
  if (Dialog.stack.some((d) => !d.el.closest('.modeless'))) { e.preventDefault(); return; }
  if (App.menuKey(e)) return;
  if (MultiSel.active && (e.isComposing || e.keyCode === 229)) {
    // 한글 조합 중 방향키: 기본 동작(조합 끝내고 이동)은 그대로 두고, 키를 뗄 때 나머지 커서도 이동
    const nav = { ArrowLeft: ['backward', 'character'], ArrowRight: ['forward', 'character'], ArrowUp: ['backward', 'line'], ArrowDown: ['forward', 'line'], Home: ['backward', 'lineboundary'], End: ['forward', 'lineboundary'] }[e.code];
    if (nav && e.isComposing) { MultiSel.navPending = [nav[0], e.ctrlKey && nav[1] === 'character' ? 'word' : nav[1], e.shiftKey]; return; }
  }
  const k = keyString(e);
  if (!k) return;
  const stop = () => { e.preventDefault(); e.stopPropagation(); };

  // 여러 개체를 고른 상태의 Ctrl+G는 개체 묶기 (평소 Ctrl+G는 보기 단축키의 첫 키)
  if (k === 'Ctrl+G' && !App.pendingChord && Img.selection().length > 1) { stop(); Commands.exec('obj-group'); return; }

  // ----- 두 단계 단축키 (Ctrl+N,T 등) -----
  if (App.pendingChord) {
    stop();
    const prefix = App.pendingChord;
    App.cancelChord();
    if (k === 'Escape') return;
    const second = k.replace(/^Ctrl\+/, '');
    const id = Commands.forKey(prefix + ',' + second);
    if (id) Commands.run(id);
    else status(`${prefix},${second} 에 해당하는 명령이 없습니다.`);
    return;
  }
  if (Commands.isChordPrefix(k)) {
    stop();
    App.pendingChord = k;
    // 한글 입력기가 두 번째 키를 조합하지 않도록 잠시 편집기 밖으로 초점 이동
    App._chordSel = Sel.inEditor() ? Sel.save() : null;
    if (document.activeElement === Sel.editor) $('#key-sink').focus({ preventScroll: true });
    $('#st-chord').textContent = k + ', …';
    clearTimeout(App._chordT);
    App._chordT = setTimeout(() => App.cancelChord(), 2500);
    return;
  }

  // ----- 칸 블록 (F4) -----
  if (ColBlock.active && !e.isComposing) { if (ColBlock.onKey(e, k)) { stop(); return; } }

  // ----- 글상자 안 -----
  if (!App.pendingChord && Shapes.onKey(e, k)) { stop(); return; }

  // ----- 여러 커서 동시 편집 상태 (Ctrl+Shift+;) -----
  if (MultiSel.active && !e.isComposing) {
    if (MultiSel.onKey(e, k)) { stop(); return; }
  }

  // ----- 셀 블록 상태 -----
  if (Table.block.active()) {
    const b = Table.block;
    const arrows = { Left: [0, -1], Right: [0, 1], Up: [-1, 0], Down: [1, 0] };
    const base = k.replace(/^(Ctrl\+|Shift\+|Alt\+)+/, '');
    if (arrows[base]) {
      stop();
      const [dr, dc] = arrows[base];
      const step = U.mm2px(1); // 1mm씩
      const d = dc ? { dx: dc * step } : { dy: dr * step };
      if (k.startsWith('Ctrl+')) Commands.exec('cell-resize', d);            // 표 크기도 함께 변경
      else if (k.startsWith('Alt+')) Commands.exec('cell-resize-keep', d);   // 표 크기 유지
      else if (k.startsWith('Shift+')) Commands.exec('cell-resize-only', d); // 선택한 셀만
      else b.move(dr, dc, false);
      return;
    }
    const map = { M: 'cell-merge', S: 'cell-split', L: 'cell-props', H: 'equal-height', W: 'equal-width', Delete: 'cell-clear', Backspace: 'cell-clear' };
    if (map[k]) { stop(); Commands.run(map[k]); return; }
    if (k === 'F5') { stop(); b.start(b.cells()[0]); return; }
    if (k === 'F7') { stop(); b.selectLine('col'); return; } // 세로 줄(칸) 전체
    if (k === 'F8') { stop(); b.selectLine('row'); return; } // 가로 줄 전체
    if (k === 'Escape' || k === 'Enter') {
      stop();
      const td = b.cells()[0];
      b.clear();
      Sel.editor.focus({ preventScroll: true });
      if (td) Sel.caretInto(td.firstElementChild || td);
      return;
    }
    if (!Commands.forKey(k)) {
      // 다른 입력은 블록 해제 후 첫 셀에서 계속
      const td = b.cells()[0];
      b.clear();
      Sel.editor.focus({ preventScroll: true });
      if (td) Sel.caretInto(td.firstElementChild || td);
      if (/^[A-Z0-9]$/.test(k)) return;
    }
  }

  // ----- 그림 선택 상태 -----
  if (Img.selected) {
    const img = Img.selected;
    const r0 = Sel.range();
    const stillSelected = r0 && !r0.collapsed && r0.startContainer === img.parentNode && r0.endOffset - r0.startOffset === 1 && img.parentNode.childNodes[r0.startOffset] === img;
    const after = () => { const r = document.createRange(); r.setStartAfter(img); r.collapse(true); Sel.set(r); };
    if (!stillSelected) Img.deselect();
    else if (k === 'Delete' || k === 'Backspace') { stop(); Img.remove(); return; }
    else if (k === 'Escape') { stop(); Img.deselect(); after(); return; }
    else if (k === 'Enter') { stop(); Commands.run(Img.propsCmd(img)); return; }
    else if ((k === 'Left' || k === 'Right') && !Img.isFloating(img)) {
      // 글자처럼 놓인 개체: 개체 앞/뒤로 커서만 옮기기
      stop();
      Img.deselect();
      const r = document.createRange();
      if (k === 'Left') r.setStartBefore(img); else r.setStartAfter(img);
      r.collapse(true);
      Sel.set(r);
      return;
    }
    else if (/^(Alt\+)?(Left|Right|Up|Down)$/.test(k) && Img.isFloating(img)) {
      // 떠 있는 그림: 방향키로 1mm씩 (Alt: 0.1mm씩) 옮기기
      stop();
      const st = k.startsWith('Alt+') ? U.mm2px(0.1) : U.mm2px(1);
      const dir = k.replace('Alt+', '');
      History.checkpoint();
      Img.moveBy(dir === 'Left' ? -st : dir === 'Right' ? st : 0, dir === 'Up' ? -st : dir === 'Down' ? st : 0);
      App.changed();
      return;
    }
    else if (!/^(Ctrl|Alt)\+/.test(k) || /^Ctrl\+(V|X|C)$/.test(k)) {
      // 그림을 덮어쓰지 않도록 커서를 그림 뒤로 옮기고 계속 입력
      Img.deselect();
      if (!/^Ctrl\+(X|C)$/.test(k)) after();
    }
  }

  // ----- 블록 설정(F3) 상태: 방향키로 범위 넓히기 -----
  if (App.blockMode) {
    const navMap = { Left: ['backward', 'character'], Right: ['forward', 'character'], Up: ['backward', 'line'], Down: ['forward', 'line'], Home: ['backward', 'lineboundary'], End: ['forward', 'lineboundary'], 'Ctrl+Left': ['backward', 'word'], 'Ctrl+Right': ['forward', 'word'], PageDown: ['forward', 'paragraph'], PageUp: ['backward', 'paragraph'] };
    if (navMap[k]) {
      stop();
      const rk = { Up: () => Ratio.lineMove(false, true), Down: () => Ratio.lineMove(true, true), Home: () => Ratio.lineEdge(false, true), End: () => Ratio.lineEdge(true, true) }[k];
      if (!(rk && rk())) window.getSelection().modify('extend', ...navMap[k]);
      return;
    }
    if (k === 'Escape' || k === 'F3') { stop(); App.toggleBlockMode(false); if (k === 'Escape') window.getSelection().collapseToEnd(); return; }
    App.toggleBlockMode(false);
  }

  // ----- 표 안의 Tab -----
  if ((k === 'Tab' || k === 'Shift+Tab') && Sel.inEditor()) {
    stop();
    // 문단 번호 항목 맨 앞에서 Tab: 수준 바꾸기
    const li = Lists.currentLi();
    const r = Sel.range();
    if (li && r && r.collapsed) {
      const pre = document.createRange();
      pre.selectNodeContents(li);
      pre.setEnd(r.startContainer, r.startOffset);
      if (!pre.toString().replace(/\u200B/g, '')) { Commands.exec(k === 'Tab' ? 'list-deeper' : 'list-shallower'); return; }
    }
    if (Table.currentCell()) Commands.exec('cell-next', { forward: k === 'Tab' });
    else if (k === 'Tab') Commands.exec('tab');
    return;
  }
  if (k === 'Insert') { stop(); App.toggleOverwrite(); return; }
  if (k === 'Ctrl+PageUp' || k === 'Ctrl+PageDown') {
    stop();
    window.getSelection().modify('move', k.endsWith('Up') ? 'backward' : 'forward', 'documentboundary');
    App.scrollToSelection();
    return;
  }
  if (k === 'Escape') {
    if (Find.dlg && !Find.dlg.closed) { stop(); Find.dlg.close(); return; }
  }

  const id = Commands.forKey(k);
  if (id) {
    stop();
    Commands.run(id);
    return;
  }
  if (/^(Arrow|Home|End|Page)/.test(e.key)) History.endTyping();
  // 매크로: 이동 키 기록
  if (Macro.active && /^(Arrow|Home|End|Page)/.test(e.key) && Sel.inEditor()) Macro.nav(e);
  // 브라우저 기본 단축키 막기 (새로고침 등)
  if (/^Ctrl\+(R|W|Shift\+R|Shift\+I|J|G|D|E|K|N|Q|Shift\+N)$/.test(k)) e.preventDefault();
};
App.cancelChord = function () {
  App.pendingChord = null;
  clearTimeout(App._chordT);
  $('#st-chord').textContent = '';
  if (document.activeElement === $('#key-sink')) {
    Sel.editor.focus({ preventScroll: true });
    if (App._chordSel) Sel.restore(App._chordSel);
  }
  App._chordSel = null;
};

// ================= 상태 표시 / 도구 모음 갱신 =================
App.updateStatus = function () {
  const ed = Sel.editor;
  $('#st-page').textContent = `${App.currentPage()}/${App.pageCount()}쪽`;
  const text = ed.innerText || '';
  const chars = text.replace(/[\n​]/g, '').length;
  const noSpace = text.replace(/[\s​]/g, '').length;
  $('#st-count').textContent = `글자 ${chars} (공백 제외 ${noSpace})`;
  const r = Sel.range();
  if (r) {
    const blocks = allParagraphs();
    const b = Sel.block();
    const idx = blocks.indexOf(b) + 1;
    let col = 1;
    if (b) {
      const pre = document.createRange();
      pre.selectNodeContents(b);
      try { pre.setEnd(r.startContainer, r.startOffset); col = pre.toString().replace(/​/g, '').length + 1; } catch { /* 무시 */ }
    }
    const cell = Table.currentCell();
    let cellInfo = '';
    if (cell) {
      const g = Table.grid(cell.closest('table'));
      const x = g.cells.find((c) => c.el === cell);
      if (x) cellInfo = ` · 셀 ${String.fromCharCode(65 + (x.c % 26))}${x.r + 1}`;
    }
    $('#st-pos').textContent = `문단 ${idx > 0 ? idx : '-'} · ${col}칸${cellInfo}`;
  }
};
App.updateToolbar = function () {
  const st = Fmt.state();
  if (!st) return;
  $$('[data-cmd]').forEach((b) => {
    const c = Commands.get(b.dataset.cmd);
    if (c && c.active) b.classList.toggle('active', !!c.active(st));
  });
  const fs = $('#fb-font');
  if (fs && document.activeElement !== fs) {
    if (![...fs.options].some((o) => o.value === st.font)) fs.append(h('option', { value: st.font }, st.font));
    fs.value = st.font;
  }
  const sz = $('#fb-size');
  if (sz && document.activeElement !== sz) sz.value = st.size;
  const sty = $('#fb-style');
  if (sty && document.activeElement !== sty) sty.value = st.style;
  const lh = $('#fb-lh');
  if (lh && document.activeElement !== lh) {
    if (![...lh.options].some((o) => +o.value === st.lineHeight)) lh.append(h('option', { value: st.lineHeight }, st.lineHeight + '%'));
    lh.value = st.lineHeight;
  }
};

// ================= 메뉴 =================
const MENUS = [
  { name: '파일', key: 'F', items: ['file-new', 'file-new-window', 'file-open', '-', 'file-save', 'file-saveas', 'file-docx', 'file-pdf', '-', 'page-setup', 'file-print', '-', 'file-close', 'app-quit'] },
  { name: '편집', key: 'E', items: ['undo', 'redo', '-', 'cut', 'copy', 'paste', 'paste-text', '-', 'select-all', 'block', 'col-block', 'caret-add-up', 'caret-add-down', '-', 'delete-line', 'delete-eol', 'delete-word', '-', 'find', 'replace', 'find-next', 'goto', '-', 'shape-copy'] },
  { name: '보기', key: 'U', items: ['toggle-guides', 'toggle-paramarks', 'toggle-marks', 'toggle-hruler', 'toggle-vruler', '-', 'split-v', 'split-h', 'split-off', '-', 'lang-ko', 'lang-en', '-', 'zoom-in', 'zoom-out', 'zoom-100', 'zoom-width'] },
  { name: '입력', key: 'D', items: ['table-create', 'image-insert', 'textbox', '-', 'shape-line', 'shape-arrow', 'shape-darrow', 'shape-rect', 'shape-roundrect', 'shape-ellipse', 'shape-triangle', '-', 'wrap-inline', 'wrap-left', 'wrap-right', 'wrap-front', 'wrap-behind', 'object-props', 'shape-text', 'obj-group', 'obj-ungroup', '-', 'page-break', 'symbols', 'date-insert', 'link', '-', 'mm-mark'] },
  { name: '서식', key: 'J', items: ['char-shape', 'para-shape', 'tab-dialog', 'style-dlg', '-', 'bold', 'italic', 'underline', 'strike', 'sup', 'sub', 'normal-char', '-', 'size-up', 'size-down', 'spacing-wide', 'spacing-narrow', 'ratio-wide', 'ratio-narrow', 'lh-up', 'lh-down', '-', 'align-justify', 'align-left', 'align-center', 'align-right', 'align-distribute', '-', 'indent-first', 'outdent-first', 'margin-inc', 'margin-dec', '-', 'numbering', 'numbering-shape', 'num-restart', 'bullets', 'bullet-shape', 'list-deeper', 'list-shallower'] },
  { name: '쪽', key: 'W', items: ['page-setup', 'page-break', '-', 'columns', 'col-break', '-', 'page-number', 'page-newnum', 'page-hide', 'header-footer'] },
  { name: '표', key: 'B', items: ['table-create', '-', 'cell-block', 'row-col-insert', 'row-add', 'col-add', 'row-col-delete', '-', 'cell-merge', 'cell-split', 'cell-props', 'equal-width', 'equal-height', '-', 'table-props', 'wrap-inline', 'wrap-left', 'wrap-right', 'wrap-front', 'wrap-behind', '-', 'table-delete'] },
  { name: '도구', key: 'K', items: ['macro-record', 'macro-run', '-', 'mm-mark', 'mm-make', 'mm-datadoc', '-', 'default-font', 'shortcuts', 'about'] },
];

App.buildMenubar = function () {
  const bar = $('#menubar');
  MENUS.forEach((m, i) => {
    const it = h('div', { class: 'mb-item', 'data-i': i }, `${m.name}(${m.key})`);
    it.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (App.openMenuIdx === i) App.closeMenus(); else App.openMenu(i);
    });
    it.addEventListener('mouseenter', () => { if (App.openMenuIdx != null && App.openMenuIdx !== i) App.openMenu(i); });
    bar.append(it);
  });
};
App.openMenuIdx = null;
App.openMenu = function (i) {
  App.closeMenus();
  const m = MENUS[i];
  const anchor = $(`#menubar .mb-item[data-i="${i}"]`);
  anchor.classList.add('open');
  const r = anchor.getBoundingClientRect();
  const pop = App.renderMenu(m.items.map((x) => (x === '-' ? '-' : { cmd: x })));
  pop.style.left = r.left + 'px';
  pop.style.top = r.bottom + 2 + 'px';
  $('#menu-popups').append(pop);
  App.openMenuIdx = i;
  App.menuHot = -1;
};
App.renderMenu = function (items) {
  const pop = h('div', { class: 'menu-popup', role: 'menu' });
  for (const it of items) {
    if (it === '-') { pop.append(h('div', { class: 'sep' })); continue; }
    const c = it.cmd ? Commands.get(it.cmd) : null;
    const label = it.label || (c && c.label);
    const key = it.key || (c && ((c.keys && c.keys[0]) || c.keyLabel)) || '';
    const disabled = it.disabled || (c && c.enabled ? !c.enabled() : false);
    const checked = it.checked ? it.checked() : c && c.checked ? c.checked() : false;
    const icon = c && c.icon && ICONS[c.icon] ? ICONS[c.icon] : '';
    const mi = h('div', { class: 'mi' + (disabled ? ' disabled' : '') + (checked ? ' checked' : ''), role: 'menuitem' },
      h('span', { class: 'ic', html: checked ? '' : icon }), h('span', { class: 'lbl' }, label), h('span', { class: 'key' }, key));
    mi.addEventListener('mousedown', (e) => e.preventDefault());
    mi.addEventListener('click', () => {
      if (disabled) return;
      App.closeMenus();
      if (it.run) it.run(); else Commands.run(it.cmd);
    });
    pop.append(mi);
  }
  return pop;
};
App.closeMenus = function () {
  $('#menu-popups').innerHTML = '';
  $$('#menubar .mb-item.open').forEach((x) => x.classList.remove('open'));
  const cm = $('#ctxmenu');
  if (cm) { cm.hidden = true; cm.innerHTML = ''; }
  App.openMenuIdx = null;
};
App.menuKey = function (e) {
  const open = App.openMenuIdx != null || !$('#ctxmenu').hidden;
  // Alt+문자로 메뉴 열기
  if (!open && e.altKey && !e.ctrlKey && !e.shiftKey && /^Key[A-Z]$/.test(e.code)) {
    const letter = e.code.slice(3);
    const idx = MENUS.findIndex((m) => m.key === letter);
    if (idx >= 0 && !Commands.forKey('Alt+' + letter)) { e.preventDefault(); App.openMenu(idx); return true; }
  }
  if (!open) return false;
  const pop = App.openMenuIdx != null ? $('#menu-popups .menu-popup') : $('#ctxmenu');
  const items = $$('.mi:not(.disabled)', pop);
  e.preventDefault();
  e.stopPropagation();
  if (e.key === 'Escape') { App.closeMenus(); Sel.editor.focus({ preventScroll: true }); return true; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    App.menuHot = (App.menuHot + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items.forEach((x, i) => x.classList.toggle('hot', i === App.menuHot));
    return true;
  }
  if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && App.openMenuIdx != null) {
    App.openMenu((App.openMenuIdx + (e.key === 'ArrowRight' ? 1 : -1) + MENUS.length) % MENUS.length);
    return true;
  }
  if (e.key === 'Enter' && items[App.menuHot]) { items[App.menuHot].click(); return true; }
  return true;
};

App.showContextMenu = function (e) {
  App.closeMenus();
  const items = ['cut', 'copy', 'paste', 'paste-text', '-', 'char-shape', 'para-shape'];
  const obj = Img.objOf(e.target);
  const wrapItems = (list) => list.map(([w, l]) => ({ label: '배치: ' + l, checked: () => Shapes.currentWrap() === w, run: () => Commands.exec('obj-wrap', { wrap: w }) }));
  if (obj && Img.multi.length > 1 && Img.multi.includes(obj)) {
    items.push('-', 'obj-group', ...wrapItems(Shapes.WRAPS), { label: '개체 지우기', key: 'Delete', run: () => Img.remove() });
  } else if (obj) {
    Img.select(obj);
    if (obj.dataset.kind === 'group') items.push('-', 'obj-ungroup');
    const isImg = obj.tagName === 'IMG';
    items.push('-', Img.propsCmd(obj));
    if (Shapes.canHaveText(obj)) items.push({ label: obj.querySelector('.sh-text') ? '도형 안 글자 고치기' : '도형 안에 글자 넣기', run: () => Shapes.addText(obj) });
    items.push(...wrapItems(Shapes.WRAPS),
      { label: isImg ? '그림 지우기' : '개체 지우기', key: 'Delete', run: () => Img.remove() });
  } else if (Table.block.active() || e.target.closest('td,th')) {
    if (!Table.block.active()) {
      const pos = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (pos && !Sel.range()?.intersectsNode(pos.startContainer)) Sel.set(pos);
    }
    items.push('-', 'cell-block', 'row-col-insert', 'row-col-delete', 'cell-merge', 'cell-split', 'cell-props', 'table-props', 'equal-width', 'equal-height', '-', ...wrapItems(Shapes.TABLE_WRAPS), '-', 'table-delete');
  }
  const pop = App.renderMenu(items.map((x) => (typeof x === 'string' ? (x === '-' ? '-' : { cmd: x }) : x)));
  const cm = $('#ctxmenu');
  cm.replaceWith(pop);
  pop.id = 'ctxmenu';
  pop.hidden = false;
  const W = window.innerWidth, H = window.innerHeight;
  pop.style.left = Math.min(e.clientX, W - 260) + 'px';
  pop.style.top = '0px';
  document.body.append(pop);
  const ph = pop.getBoundingClientRect().height;
  pop.style.top = Math.max(4, Math.min(e.clientY, H - ph - 6)) + 'px';
  App.menuHot = -1;
};

// 도형 고르기 (도구 모음의 [도형] 단추)
App.showShapeMenu = function () {
  App.closeMenus();
  const btn = $('#toolbar [data-cmd="shape-menu"]');
  const pop = App.renderMenu(['shape-line', 'shape-arrow', 'shape-darrow', '-', 'shape-rect', 'shape-roundrect', 'shape-ellipse', 'shape-triangle', '-', 'textbox'].map((x) => (x === '-' ? '-' : { cmd: x })));
  const cm = $('#ctxmenu');
  cm.replaceWith(pop);
  pop.id = 'ctxmenu';
  pop.hidden = false;
  const r = btn ? btn.getBoundingClientRect() : { left: 200, bottom: 80 };
  pop.style.left = r.left + 'px';
  pop.style.top = r.bottom + 2 + 'px';
  document.body.append(pop);
  App.menuHot = -1;
};

// ================= 도구 모음 =================
App.buildToolbars = function () {
  const tb = $('#toolbar');
  const big = (cmd, label) => {
    const c = Commands.get(cmd);
    const b = h('button', { class: 'tb-btn', title: `${c.label}${c.keys ? ' (' + c.keys[0] + ')' : ''}`, 'data-cmd': cmd, type: 'button', id: cmd === 'macro-record' ? 'tb-macro' : null },
      h('span', { html: ICONS[c.icon] || '' }), h('span', {}, label));
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => { App.restoreSel(); Commands.run(cmd); });
    return b;
  };
  const sep = () => h('span', { class: 'tb-sep' });
  tb.append(
    big('file-new', '새 문서'), big('file-open', '불러오기'), big('file-save', '저장'), big('file-print', '인쇄'), big('file-pdf', 'PDF'), sep(),
    big('cut', '오려 두기'), big('copy', '복사'), big('paste', '붙이기'), sep(),
    big('undo', '되돌리기'), big('redo', '다시 실행'), sep(),
    big('table-create', '표'), big('image-insert', '그림'), big('textbox', '글상자'), big('shape-menu', '도형'), big('symbols', '문자표'), big('page-break', '쪽 나누기'), sep(),
    big('find', '찾기'), sep(),
    big('macro-record', '매크로 기록'), big('mm-make', '메일머지'), sep(),
    big('shortcuts', '단축키'));
  $('#tb-macro').classList.add('tb-rec');

  const fb = $('#formatbar');
  const small = (cmd) => {
    const c = Commands.get(cmd);
    const b = h('button', { class: 'tb-btn', title: `${c.label}${c.keys ? ' (' + c.keys[0] + ')' : ''}`, 'data-cmd': cmd, type: 'button', html: ICONS[c.icon] || c.label });
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => { App.restoreSel(); Commands.run(cmd); });
    return b;
  };
  const style = h('select', { class: 'tb-select', id: 'fb-style', title: '스타일 (F6)', style: { width: '96px' } }, STYLES.map((s) => h('option', { value: s }, s)));
  style.addEventListener('change', () => { App.restoreSel(); Commands.exec('style-' + STYLES.indexOf(style.value)); Sel.editor.focus(); });
  const font = h('select', { class: 'tb-select', id: 'fb-font', title: '글꼴', style: { width: '150px' } });
  font.addEventListener('change', () => { App.restoreSel(); Commands.exec('font', { font: font.value }); Sel.editor.focus(); });
  const size = h('input', { class: 'tb-num', id: 'fb-size', type: 'number', min: 1, max: 4096, step: 0.5, title: '글자 크기(pt)', list: 'size-list' });
  const sizeList = h('datalist', { id: 'size-list' }, [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72].map((v) => h('option', { value: v })));
  const applySize = () => { const v = parseFloat(size.value); if (v > 0) { App.restoreSel(); Commands.exec('size', { size: v }); Sel.editor.focus(); } };
  size.addEventListener('change', applySize);
  size.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applySize(); } e.stopPropagation(); });
  const colorBtn = (cmd, initial) => {
    let current = initial;
    const c = Commands.get(cmd);
    const sw = h('span', { class: 'swatch', style: { background: current } });
    const b = h('button', { class: 'tb-btn tb-color', title: c.label, type: 'button', html: ICONS[c.icon] });
    b.append(sw);
    const more = h('button', { class: 'tb-btn', title: c.label + ' 고르기', type: 'button', style: { minWidth: '14px', padding: '0 1px' } }, '▾');
    b.addEventListener('mousedown', (e) => e.preventDefault());
    more.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => { App.restoreSel(); Commands.exec(cmd, { color: current }); });
    more.addEventListener('click', () => {
      ColorPalette.open(more, {
        current, allowNone: cmd === 'highlight',
        onPick: (c) => { current = c || 'transparent'; sw.style.background = c || 'transparent'; App.restoreSel(); Commands.exec(cmd, { color: current }); Sel.editor.focus({ preventScroll: true }); },
      });
    });
    return [b, more];
  };
  const lh = h('select', { class: 'tb-select', id: 'fb-lh', title: '줄 간격 (Alt+Shift+A/Z)' }, [100, 120, 130, 150, 160, 180, 200, 250, 300].map((v) => h('option', { value: v }, v + '%')));
  lh.addEventListener('change', () => { App.restoreSel(); Commands.exec('line-height', { pct: +lh.value }); Sel.editor.focus(); });
  fb.append(style, font, size, sizeList, h('span', { class: 'tb-sep' }),
    small('bold'), small('italic'), small('underline'), small('strike'), small('sup'), small('sub'),
    ...colorBtn('color', '#c00000'), ...colorBtn('highlight', '#ffff00'), h('span', { class: 'tb-sep' }),
    small('align-justify'), small('align-left'), small('align-center'), small('align-right'), small('align-distribute'), h('span', { class: 'tb-sep' }),
    lh, small('bullets'), small('numbering'), small('outdent-first'), small('indent-first'), h('span', { class: 'tb-sep' }), small('toggle-paramarks'));
  App.fillFontSelect();
};
App.fillFontSelect = function () {
  const font = $('#fb-font');
  if (!font) return;
  const cur = font.value;
  font.innerHTML = '';
  App.fonts.forEach((f) => font.append(h('option', { value: f }, f)));
  if (cur) font.value = cur;
};
App.restoreSel = function () {
  if (!Sel.inEditor() && App.lastSel && !Table.block.active()) {
    Sel.editor.focus({ preventScroll: true });
    Sel.restore(App.lastSel);
  }
};

// ================= HTML 정리 (붙이기) =================
function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;
  const ALLOWED = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'SUP', 'SUB', 'SPAN', 'A', 'TABLE', 'TBODY', 'THEAD', 'TFOOT', 'TR', 'TD', 'TH', 'COLGROUP', 'COL', 'IMG', 'UL', 'OL', 'LI', 'DIV']);
  const STYLE_OK = ['font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'color', 'background-color', 'font-size', 'font-family', 'text-align', 'vertical-align', 'width', 'height', 'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'margin-left', 'text-indent', 'line-height', 'letter-spacing', 'left', 'top', 'min-height'];
  const OBJ_DATA = ['data-kind', 'data-shape', 'data-stroke', 'data-sw', 'data-fill', 'data-dir', 'data-at', 'data-ah', 'data-pts', 'data-bw', 'data-bh', 'data-gx', 'data-gy', 'data-gw', 'data-gh', 'data-gwrap', 'data-om', 'data-im', 'data-bd', 'data-sh'];
  const HEAD_SIZE = { H1: '20pt', H2: '16pt', H3: '14pt', H4: '12pt', H5: '10pt', H6: '9pt' };
  const walk = (el) => {
    for (const c of Array.from(el.childNodes)) {
      if (c.nodeType === 8) { c.remove(); continue; }
      if (c.nodeType === 3) { if (!c.parentElement.closest('pre')) c.nodeValue = c.nodeValue.replace(/[\r\n]+/g, ' '); continue; }
      if (c.nodeType !== 1) { c.remove(); continue; }
      let tag = c.tagName;
      if (['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'svg', 'SVG', 'IFRAME', 'OBJECT', 'NOSCRIPT', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'XML'].includes(tag)) { c.remove(); continue; }
      let node = c;
      if (/^H[1-6]$/.test(tag)) {
        node = doc.createElement('p');
        node.setAttribute('style', (c.getAttribute('style') || '') + `;font-weight:bold;font-size:${HEAD_SIZE[tag]}`);
        while (c.firstChild) node.append(c.firstChild);
        c.replaceWith(node);
        tag = 'P';
      } else if (tag === 'FONT') {
        node = doc.createElement('span');
        const st = [];
        if (c.getAttribute('face')) st.push(`font-family:${c.getAttribute('face')}`);
        if (c.getAttribute('color')) st.push(`color:${c.getAttribute('color')}`);
        node.setAttribute('style', st.join(';'));
        while (c.firstChild) node.append(c.firstChild);
        c.replaceWith(node);
        tag = 'SPAN';
      } else if (tag === 'PRE' || tag === 'BLOCKQUOTE' || tag === 'SECTION' || tag === 'ARTICLE') {
        node = doc.createElement('div');
        while (c.firstChild) node.append(c.firstChild);
        c.replaceWith(node);
        tag = 'DIV';
      } else if (!ALLOWED.has(tag)) {
        // 태그만 벗기고 내용 유지 후 다시 검사
        c.replaceWith(...Array.from(c.childNodes));
        return walk(el);
      }
      // 속성 정리
      const isObjSpan = tag === 'SPAN' && /(^|\s)(nobj|tb-body|sh-text)(\s|$)/.test(node.getAttribute('class') || '');
      if (isObjSpan) node.setAttribute('class', ['nobj', 'tb-body', 'sh-text'].find((c) => node.classList.contains(c)));
      for (const a of Array.from(node.attributes)) {
        const n = a.name.toLowerCase();
        if (n === 'style') {
          const keep = [];
          for (const decl of a.value.split(';')) {
            const [p, ...rest] = decl.split(':');
            if (!p || !rest.length) continue;
            const prop = p.trim().toLowerCase();
            const val = rest.join(':').trim();
            if (STYLE_OK.includes(prop) && !/expression|url\(/i.test(val)) keep.push(`${prop}:${val}`);
          }
          if (keep.length) node.setAttribute('style', keep.join(';')); else node.removeAttribute('style');
        } else if ((n === 'colspan' || n === 'rowspan') && /^(TD|TH)$/.test(tag)) { /* 유지 */ }
        else if (n === 'href' && tag === 'A' && /^(https?:|mailto:)/i.test(a.value)) { /* 유지 */ }
        else if (n === 'src' && tag === 'IMG' && /^data:image\//i.test(a.value)) { /* 유지 */ }
        else if ((n === 'width' || n === 'height') && /^(IMG|COL|TD|TABLE)$/.test(tag)) { /* 유지 */ }
        else if (n === 'data-wrap' && /^(IMG|TABLE|SPAN)$/.test(tag) && /^(left|right|center|front|behind)$/.test(a.value)) { /* 유지 */ }
        else if (tag === 'SPAN' && isObjSpan && (n === 'class' || n === 'contenteditable' || OBJ_DATA.includes(n))) { /* 글상자·도형 유지 */ }
        else if (tag === 'IMG' && OBJ_DATA.includes(n)) { /* 묶음 안 그림 위치·모양 */ }
        else node.removeAttribute(a.name);
      }
      if (tag === 'IMG' && !node.getAttribute('src')) { node.remove(); continue; }
      if (tag === 'DIV') {
        // div는 문단으로
        const hasBlock = Array.from(node.children).some((x) => isBlock(x));
        if (!hasBlock) {
          const p = doc.createElement('p');
          for (const a of Array.from(node.attributes)) p.setAttribute(a.name, a.value);
          while (node.firstChild) p.append(node.firstChild);
          node.replaceWith(p);
          node = p;
        }
      }
      walk(node);
    }
  };
  walk(body);
  // 표 셀은 문단을 갖게
  body.querySelectorAll('td, th').forEach((td) => {
    if (!Array.from(td.children).some((x) => x.tagName === 'P' || x.tagName === 'TABLE')) {
      const p = doc.createElement('p');
      while (td.firstChild) p.append(td.firstChild);
      if (!p.firstChild) p.append(doc.createElement('br'));
      td.append(p);
    }
  });
  body.querySelectorAll('th').forEach((th) => {
    const td = doc.createElement('td');
    for (const a of Array.from(th.attributes)) td.setAttribute(a.name, a.value);
    td.style.fontWeight = 'bold';
    while (th.firstChild) td.append(th.firstChild);
    th.replaceWith(td);
  });
  return body.innerHTML;
}

window.addEventListener('DOMContentLoaded', () => App.init().catch((e) => { console.error(e); alert('초기화 오류: ' + e.message); }));
