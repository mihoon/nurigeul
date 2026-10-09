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
      if (s.noToolbar) document.body.classList.add('no-toolbar');
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
      // 한글처럼 굵기가 따로 있는 글꼴(나눔고딕 ExtraBold, 나눔고딕 Light 등)은 목록에 따로 보여 줌
      // (크롬은 굵기를 한 가족으로 묶어 돌려주므로 '가족 + 굵기' 이름을 만들어 넣음)
      const plain = /^(regular|normal|roman|book|bold|italic|oblique|bold italic|bold oblique)$/i;
      const names = new Set();
      for (const f of fonts) {
        const famKo = FONT_KO[f.family] || f.family;
        names.add(famKo);
        const st = (f.style || '').trim();
        if (st && !plain.test(st) && !/italic|oblique/i.test(st)) names.add(`${famKo} ${st}`);
      }
      const fam = Array.from(names).sort((a, b) => a.localeCompare(b, 'ko'));
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
      } else if (/\.(md|markdown)$/i.test(f.name)) {
        const text = readTextAuto(f.data);
        const r = await MD.load(text, f.path);
        this.page = { ...DEFAULT_PAGE };
        this.docSettings = { header: null, footer: null, pageNum: null, md: { tail: r.tailGap, eol: /\r\n/.test(text) ? '\r\n' : '\n', bom: text.charCodeAt(0) === 0xFEFF } };
        Sel.editor.classList.add('md-doc');
        this.setHtml(r.html);
        MD.stamp();
      } else if (/\.html?$/i.test(f.name)) {
        this.setHtml(sanitizeHtml(readTextAuto(f.data)));
      } else {
        const text = readTextAuto(f.data);
        this.setHtml(text.replace(/\r\n?/g, '\n').split('\n').map((l) => `<p>${escHtml(l) || '<br>'}</p>`).join(''));
      }
      const isMd = /\.(md|markdown)$/i.test(f.name);
      this.filePath = (/\.hwpx$/i.test(f.name) && !isHwp) || isMd ? f.path : null;
      this.fileName = isMd ? f.name : f.name.replace(/\.[^.]+$/, '') + (/\.hwpx?$/i.test(f.name) || isHwp ? '.hwpx' : '');
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
      const md = this.isMdDoc();
      p = await window.native.saveDialog(md ? 'md' : 'hwpx', (this.fileName || `${T("문서")}${this.untitled}`).replace(/\.(hwpx|md|markdown)$/i, '') + (md ? '.md' : '.hwpx'));
      if (!p) return false;
    }
    if (/\.(md|markdown)$/i.test(p)) return this.saveMd(p);
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
  isMdDoc() { return /\.(md|markdown)$/i.test(this.fileName || ''); },
  async saveMd(p) {
    try {
      this.prepareForOutput();
      let text = await MD.save(p, this.docSettings.md);
      const o = this.docSettings.md || {};
      if (o.eol === '\r\n') text = text.replace(/\r?\n/g, '\r\n');
      if (o.bom) text = '\uFEFF' + text;
      await window.native.writeFile(p, new TextEncoder().encode(text));
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
  // 인쇄·PDF는 100% 배율로 쪽 나눔을 다시 계산한 뒤 출력 (배율에 따라 줄바꿈이 조금 달라지므로)
  async atPrintZoom(fn) {
    const z = this.zoom;
    if (z !== 1) { this.zoom = 1; $('#zoomer').style.zoom = 1; }
    this.layout();
    this.applyPrintStyle();
    // 커서(깜박이는 세로줄)·선택 영역이 인쇄·PDF·이미지에 찍히지 않도록 잠시 떼어 둠
    const sel = window.getSelection(), saved = [];
    for (let i = 0; i < sel.rangeCount; i++) saved.push(sel.getRangeAt(i).cloneRange());
    const act = document.activeElement, ws = $('#workspace'), st = ws ? ws.scrollTop : 0;
    sel.removeAllRanges(); if (act && act.blur) act.blur();
    document.body.classList.add('printing');
    try { return await fn(); } finally {
      document.body.classList.remove('printing');
      if (z !== 1) { this.zoom = z; $('#zoomer').style.zoom = z; this.layout(); }
      try {
        if (act && act.focus) act.focus({ preventScroll: true });
        const s2 = window.getSelection(); s2.removeAllRanges(); saved.forEach((r) => s2.addRange(r));
        if (ws) ws.scrollTop = st;
      } catch (e) { /* ignore */ }
    }
  },
  async renderPDF() {
    this.prepareForOutput();
    return this.atPrintZoom(() => window.native.printToPDF());
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
  // 그림(PNG/JPG)으로 저장: 인쇄와 똑같은 PDF를 만든 뒤 쪽마다 그림으로 바꿈 (pdf.js)
  async loadPdfJs() {
    if (window.pdfjsLib) return window.pdfjsLib;
    await new Promise((res, rej) => { const sc = h('script', { src: 'lib/pdf.min.js' }); sc.onload = res; sc.onerror = () => rej(new Error('pdf.js를 불러오지 못했습니다.')); document.head.append(sc); });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
    return window.pdfjsLib;
  },
  parsePages(spec, max) {
    const out = new Set();
    for (const part of String(spec || '').split(/[,\s]+/).filter(Boolean)) {
      const m = /^(\d+)(?:\s*[-~]\s*(\d+))?$/.exec(part);
      if (!m) continue;
      let a = +m[1], b = m[2] ? +m[2] : a;
      if (a > b) [a, b] = [b, a];
      for (let i = Math.max(1, a); i <= Math.min(max, b); i++) out.add(i);
    }
    return [...out].sort((x, y) => x - y);
  },
  async exportImage() {
    const total = this.pageCount();
    const v = await Dialog.form('그림으로 저장', [
      { name: 'fmt', label: '파일 형식', type: 'select', value: 'png', options: [['png', 'PNG (선명함)'], ['jpg', 'JPG (파일 작음)']] },
      { name: 'dpi', label: '해상도', type: 'select', value: '150', options: [['96', '96 dpi (화면용)'], ['150', '150 dpi (보통)'], ['200', '200 dpi'], ['300', '300 dpi (인쇄용)']] },
      { name: 'range', label: '쪽 범위', type: 'select', value: total > 1 ? 'all' : 'all', options: [['all', `모든 쪽 (${total}쪽)`], ['cur', `현재 쪽 (${this.currentPage()}쪽)`], ['pick', '쪽 지정']] },
      { name: 'pages', label: '쪽 지정', placeholder: '예: 1-3, 5' },
    ], { note: '여러 쪽이면 "파일이름-1.png", "파일이름-2.png"처럼 쪽마다 따로 저장합니다.' });
    if (!v) return;
    const ext = v.fmt === 'jpg' ? 'jpg' : 'png';
    const base0 = this.baseName(this.fileName) || `${T('문서')}${this.untitled}`;
    const p = await window.native.saveDialog(ext, base0 + '.' + ext);
    if (!p) return;
    await this.exportImageTo(p, v);
  },
  async exportImageTo(p, v) {
    const ext = v.fmt === 'jpg' ? 'jpg' : 'png';
    try {
      status('그림으로 바꾸는 중…');
      const pdfBytes = await this.renderPDF();
      const lib = await this.loadPdfJs();
      const doc = await lib.getDocument({ data: new Uint8Array(pdfBytes), isEvalSupported: false }).promise;
      const n = doc.numPages;
      let pages = v.range === 'cur' ? [Math.min(n, this.currentPage())] : v.range === 'pick' ? this.parsePages(v.pages, n) : Array.from({ length: n }, (_, i) => i + 1);
      if (!pages.length) { Dialog.alert('저장할 쪽이 없습니다. 쪽 번호를 확인하세요.'); return; }
      const scale = (+v.dpi || 150) / 72;
      const stem = p.replace(/\.(png|jpe?g)$/i, '');
      const w = String(n).length;
      const saved = [];
      for (const no of pages) {
        const pg = await doc.getPage(no);
        const vp = pg.getViewport({ scale });
        const cv = document.createElement('canvas');
        cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
        await pg.render({ canvasContext: ctx, viewport: vp }).promise;
        const blob = await new Promise((res) => cv.toBlob(res, ext === 'jpg' ? 'image/jpeg' : 'image/png', 0.92));
        const out = pages.length === 1 ? `${stem}.${ext}` : `${stem}-${String(no).padStart(w, '0')}.${ext}`;
        await window.native.writeFile(out, new Uint8Array(await blob.arrayBuffer()));
        saved.push(out);
      }
      doc.destroy();
      toast(pages.length === 1 ? '그림으로 저장했습니다.' : `${pages.length}쪽을 그림으로 저장했습니다.`);
      status(`저장했습니다: ${saved.length === 1 ? saved[0] : saved[0] + ' 외 ' + (saved.length - 1) + '개'}`);
    } catch (e) { console.error(e); Dialog.alert('그림으로 저장하지 못했습니다: ' + e.message); }
  },
  async print() {
    this.prepareForOutput();
    await this.atPrintZoom(() => window.native.print());
  },
  async requestClose() {
    if (!(await Tabs.confirmAll())) return;
    window.native.closeWindow();
  },
  displayName() { return this.fileName || `빈 문서 ${this.untitled}`; },
  updateTitle() {
    const t = T(`${this.displayName()}${this.dirty ? ' *' : ''} - 누리글`);
    document.title = t;
    if (Sel.editor) Sel.editor.classList.toggle('md-doc', this.isMdDoc());
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
    if (typeof fontAlias === 'function') fontAlias(f); // 굵기 붙은 글꼴 이름(나눔고딕 ExtraBold 등)도 찾게
    const wm = /^(.+?)\s*(Thin|Hairline|ExtraLight|UltraLight|Light|Book|Medium|SemiBold|DemiBold|ExtraBold|UltraBold|Bold|Heavy|Black)$/i.exec(f);
    const stack = `"${f}", ${wm ? `"${wm[1].trim()}", ` : ''}"함초롬바탕", "HCR Batang", "바탕", "Batang", "Noto Serif KR", ${generic}`;
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
  // 한 줄(tr) 안에서 쪽 경계에 걸친 문단부터 다음 쪽으로 넘기는 규칙을 만듦. 셀마다 걸친 문단 앞에 빈 자리를 넣음.
  // 나눌 수 있는 곳이 없으면(모든 셀의 첫 문단부터 걸침) null
  splitInRow(tr, rTop, B, next, rowSel, print) {
    const z = this.zoom || 1;
    const cells = Array.from(tr.cells);
    const saved = cells.map((c) => c.style.verticalAlign);
    cells.forEach((c) => { c.style.verticalAlign = 'top'; });
    try {
      const trR = tr.getBoundingClientRect();
      const rH = trR.height / z;
      const rules = [`${rowSel} > :is(td,th){vertical-align:top !important}`];
      let need = rH, useful = false;
      cells.forEach((td, ci) => {
        const tdR = td.getBoundingClientRect();
        const tdTop = rTop + (tdR.top - trR.top) / z;
        const kids = Array.from(td.children).filter((el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.position !== 'absolute' && cs.float === 'none'; });
        if (!kids.length) return;
        let gi = 0;
        for (let n = 0; n < kids.length; n++) {
          const el = kids[n];
          const r = el.getBoundingClientRect();
          const t = tdTop + (r.top - tdR.top) / z, bt = tdTop + (r.bottom - tdR.top) / z;
          if (bt > B + 0.5) {
            if (n > 0) useful = true;
            gi = Math.max(0, next - t);
            const mt = parseFloat(getComputedStyle(el).marginTop) || 0;
            rules.push(print ? `${rowSel} > :nth-child(${ci + 1}) > :nth-child(${Array.from(td.children).indexOf(el) + 1}){break-before:page}` : `${rowSel} > :nth-child(${ci + 1}) > :nth-child(${Array.from(td.children).indexOf(el) + 1}){margin-top:${(mt + gi).toFixed(1)}px !important}`);
            break;
          }
        }
        const last = kids[kids.length - 1].getBoundingClientRect();
        const padB = (parseFloat(getComputedStyle(td).paddingBottom) || 0) + (parseFloat(getComputedStyle(td).borderBottomWidth) || 0);
        need = Math.max(need, tdTop - rTop + (last.bottom - tdR.top) / z + padB + gi);
      });
      // 앞 쪽에 실제로 남는 글이 있는 셀이 하나도 없으면 줄째 넘김
      const partial = rules.length > 1;
      if (!useful || !partial) return null;
      if (!print) rules.push(`${rowSel}{height:${need.toFixed(1)}px !important}`);
      return { rules, add: need - rH };
    } finally {
      cells.forEach((c, i) => { c.style.verticalAlign = saved[i]; });
    }
  },
  // 잠시 화면 위치를 고정 (그림 넣은 직후 다시 짜기·커서 복원 때문에 화면이 커서 쪽으로 튀지 않게)
  keepScroll(top, ms = 1500) {
    const ws = $('#workspace');
    this._keepScroll = { top, until: Date.now() + ms };
    const hold = () => { const k = this._keepScroll; if (k && Date.now() < k.until && Math.abs(ws.scrollTop - k.top) > 1) ws.scrollTop = k.top; };
    const onUser = () => { this._keepScroll = null; ws.removeEventListener('wheel', onUser); ws.removeEventListener('mousedown', onUser); document.removeEventListener('keydown', onUser, true); };
    ws.addEventListener('wheel', onUser, { passive: true }); ws.addEventListener('mousedown', onUser); document.addEventListener('keydown', onUser, true);
    [0, 50, 150, 300, 600, 1000, ms].forEach((t) => setTimeout(hold, t));
  },
  layout() {
    // 지난번 문단 쪽 나눔 빈 자리 지우기
    const oldPgs = Sel.editor.querySelectorAll('span.pgs, wbr.pgsw');
    if (oldPgs.length) Ratio.keep(() => { oldPgs.forEach((x) => { const par = x.parentNode; x.remove(); if (par) par.normalize(); }); return true; });
    this.applyBaseFont();
    // 붙여 넣은 글 등에 들어 있는 굵기 붙은 글꼴 이름(나눔고딕 ExtraBold 등)도 찾을 수 있게
    if (typeof fontAlias === 'function') for (const el of Sel.editor.querySelectorAll('[style*="font-family"]')) { const f = firstFamily(el.style.fontFamily); if (f) fontAlias(f); }
    // 내어쓰기가 왼쪽 여백보다 크면 첫 줄이 본문 밖으로 나감 → 한글처럼 첫 줄은 왼쪽 여백에서 시작하게 맞춤
    for (const b of Sel.editor.querySelectorAll('[style*="text-indent"]')) {
      const cs = getComputedStyle(b);
      const ti = parseFloat(cs.textIndent) || 0, ml = parseFloat(cs.marginLeft) || 0;
      if (ti < 0 && ml + ti < -0.5) b.style.marginLeft = Math.round(U.px2pt(-ti) * 10) / 10 + 'pt';
    }
    // 겹친 개체의 앞뒤 순서: 한글 zOrder가 큰 것이 위 (글 앞: 3 위로, 글 뒤: -1 아래로)
    for (const o of Sel.editor.querySelectorAll('[data-z]')) {
      const w = o.dataset.wrap, z = Math.min(900, +o.dataset.z || 0);
      const v = w === 'front' ? String(3 + z) : w === 'behind' ? String(-1000 + z) : '';
      if (o.style.zIndex !== v) o.style.zIndex = v;
    }
    // 덧말 줄 높이: 한글은 (본말 + 덧말) 높이에 줄 간격을 곱함
    for (const rb of Sel.editor.querySelectorAll('ruby.dutmal')) {
      const blk = rb.closest('p, li, h1, h2, h3, h4, h5, h6, td, div') || Sel.editor;
      const cs = getComputedStyle(blk);
      const r = parseFloat(cs.lineHeight) / (parseFloat(cs.fontSize) || 1);
      const ratio = (r > 0 && isFinite(r) ? r : 1.6) * (1 + (+rb.dataset.sz || 50) / 100);
      const v = ratio.toFixed(3);
      if (rb.style.lineHeight !== v) rb.style.lineHeight = v;
    }
    Ratio.render();
    LineLock.render();
    Justify.render();
    Img.syncFigs();
    Table.fitCellLines();
    Table.layoutBgAll();
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
      // 한글은 쪽 끝 줄이 '글자 높이'만 들어가면 그 쪽에 둠: 줄 간격 여분(줄 높이 - 글자 크기)과 문단 아래 간격은 쪽 끝에서 따지지 않음
      const lh = parseFloat(cs.lineHeight), fs = parseFloat(cs.fontSize) || 0;
      const lead = lh > fs ? lh - fs : 0;
      const pb = parseFloat(cs.paddingBottom) || 0; // 한글 '문단 아래' 간격은 padding-bottom으로 들어옴
      return { top: b.offsetTop - mt, h: b.offsetHeight + mt + mb, mt, mb: mb + pb, lead, out: cs.position === 'absolute' || cs.float !== 'none' };
    });
    const TOL = Math.min(14, CH * 0.015);
    // 꼬리말이 없으면 한글은 표의 마지막 줄이 꼬리말 자리까지 내려가도 그 쪽에 둠
    const TOLT = this.docSettings && this.docSettings.footer ? TOL : Math.max(TOL, U.mm2px(p.footer || 0));
    this.printTol = TOLT;
    this.blockPage = new WeakMap();
    this.rowSplit = new WeakMap();
    // 문단의 줄 정보 (줄 위·아래: 문단 위에서부터, 줄이 시작하는 글자 위치) — 두 번 계산하지 않게 기억
    const lineCache = new Map();
    const pageSplits = [];
    const lineInfo = (b) => {
      if (lineCache.has(b)) return lineCache.get(b);
      const z = this.zoom || 1;
      const br = b.getBoundingClientRect();
      const cs = getComputedStyle(b);
      const cTop = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.paddingTop) || 0);
      const cBot = b.offsetHeight - (parseFloat(cs.borderBottomWidth) || 0) - (parseFloat(cs.paddingBottom) || 0);
      const starts = []; // {g: 글자 윗변(문단 기준), node, off}
      const rg = document.createRange();
      const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
      let t, lastTop = -1e9;
      while ((t = tw.nextNode())) {
        if (t.parentElement.closest('.nobj, .pnnew, .pnhide')) continue;
        const v = t.nodeValue;
        for (let q = 0; q < v.length; q++) {
          if (v[q] === '\u200b') continue;
          rg.setStart(t, q); rg.setEnd(t, q + 1);
          const rs = rg.getClientRects();
          const r = rs[rs.length - 1];
          if (!r || (!r.width && !r.height)) continue;
          const gt = (r.top - br.top) / z;
          if (gt > lastTop + 2) { starts.push({ g: gt, node: t, off: q }); lastTop = gt; }
        }
      }
      let lines = [];
      if (starts.length) {
        const g0 = starts[0].g;
        lines = starts.map((st, n) => ({ top: cTop + st.g - g0, node: n ? st.node : null, off: st.off }));
        lines.forEach((ln, n) => { ln.bottom = n + 1 < lines.length ? lines[n + 1].top : cBot; });
      }
      const info = { lines };
      lineCache.set(b, info);
      return info;
    };
    // 쪽 나눔 계산: 화면(쪽 사이 틈 포함 pitch)과 인쇄(쪽마다 본문 높이 + 넘침 허용 TOLT, 틈 없음) 두 번 계산
    const paginate = (pitch, print) => {
    let shift = 0, lastBottom = 0;
    const rules = [];
    const splits = [];
    let prevTbl = null;
    kids.forEach((b, i) => {
      const e = m[i];
      if (e.out) return;
      const top = e.top + shift;
      const pk = Math.floor(top / pitch + 1e-6);
      const cEnd = pk * pitch + CH;
      // 표: 한글처럼 줄 단위로 나눠 다음 쪽으로 이어 감 (쪽 경계에 걸친 줄은 통째로 다음 쪽 맨 위로)
      if (paged && b.tagName === 'TABLE' && b.tBodies.length === 1 && !b.querySelector(':scope > tr') && b.tBodies[0].rows.length) {
        const sel = `#editor > :nth-child(${i + 1})`;
        const rows = Array.from(b.tBodies[0].rows);
        const r0 = rows[0];
        let gap = 0;
        if (top > pk * pitch + 1 && (top >= cEnd - 0.5 || (top + r0.offsetTop + r0.offsetHeight > cEnd + 0.5 && r0.offsetHeight <= CH))) gap = (pk + 1) * pitch - top;
        // 한글: 같은 문단에 붙은 앞 표가 여러 쪽에 걸쳐 있으면 이 표는 다음 쪽에서 시작
        let pv = b.previousElementSibling;
        while (pv && pv.tagName === 'P' && !pv.textContent.replace(/\u200b/g, '').trim()) pv = pv.previousElementSibling; // 첫 표 아래 빈 문단은 건너뜀
        if (!gap && b.dataset.samepara && prevTbl && prevTbl.el === pv && prevTbl.end > prevTbl.start && top > pk * pitch + 1) gap = (pk + 1) * pitch - top;
        // 다음 쪽으로 넘어간 표는 한글처럼 본문 맨 위에 붙임 (문단 기준 세로 띄움은 원래 쪽에서만 의미가 있음)
        const drop = gap > 0 ? Math.min(+b.dataset.vshift || 0, e.mt) : 0;
        const mt = e.mt - drop;
        if (gap > 0) rules.push(print ? `${sel}{break-before:page;margin-top:${mt.toFixed(1)}px !important}` : `${sel}{margin-top:${(mt + gap).toFixed(1)}px !important}`);
        let extra = 0;
        // 줄 경계마다 합친 셀(세로)이 걸쳐 있는지: 한글은 합친 셀을 가르지 않는 경계에서 먼저 나눔
        const crossed = new Array(rows.length + 1).fill(false);
        // inner[q]: 경계 q를 가로지르는 합친 셀 중 가장 늦게 시작하는 셀의 시작 줄 (가장 안쪽 묶음)
        const inner = new Array(rows.length + 1).fill(-1);
        try { for (const c of Table.grid(b).cells) for (let q = c.r + 1; q < c.r + c.rs; q++) { crossed[q] = true; inner[q] = Math.max(inner[q], c.r); } } catch { /* 무시 */ }
        const rowTop = (q) => top + mt + gap + rows[q].offsetTop + extra;
        for (let j = 1; j < rows.length; j++) {
          let tr = rows[j];
          let rTop = rowTop(j);
          let rH = tr.offsetHeight;
          const k = Math.floor(rTop / pitch + 1e-6);
          const pbT = b.dataset.pb === 'TABLE';
          // 글꼴 차이로 한글보다 몇 픽셀 커지는 일이 흔해서, 조금 넘치는 정도(쪽 높이의 1.5%, 최대 14px)는 그 쪽에 둠
          if (!(rTop + rH > k * pitch + CH + TOLT)) continue;
          let to = -1;
          // 합친 셀이 걸쳐 있으면 그 묶음이 시작하는 줄까지 거슬러 올라가 거기서 나눔 (같은 쪽 안에서만)
          if (crossed[j]) {
            // 표 첫 쪽에서는 제목 줄(맨 위 묶음)만 홀로 남기지 않음
            let headEnd = 1;
            while (headEnd < rows.length && crossed[headEnd]) headEnd++;
            const firstPage = k === Math.floor((top + mt + gap) / pitch + 1e-6);
            const ok = (q) => q >= 1 && q < j && rowTop(q) > k * pitch + 1 && !(firstPage && q <= headEnd);
            // 1) 바깥 묶음 전체가 한 쪽에 들어가면 그 묶음 시작에서 나눔 (한글: '나눔' 표도 이렇게 함)
            let q = j;
            while (q > 1 && crossed[q]) q--;
            let e2 = j;
            while (e2 + 1 < rows.length && crossed[e2 + 1]) e2++;
            const groupH = rows[e2].offsetTop + rows[e2].offsetHeight - rows[q].offsetTop;
            if (!crossed[q] && groupH <= CH && ok(q)) to = q;
            // 2) 아니면 가장 안쪽 합친 셀이 시작하는 줄에서 나눔 (그 셀을 다음 쪽 맨 위부터 시작)
            else if (ok(inner[j])) to = inner[j];
          }
          // 표 속성 '나눔'(pageBreak=TABLE): 한 쪽보다 긴 줄은 줄 안의 글도 쪽 경계에서 잘라 다음 쪽으로 이어 씀
          if (to < 0 && pbT && rH > CH + TOLT && rTop < k * pitch + CH - 4) {
            const res = this.splitInRow(tr, rTop, k * pitch + CH, (k + 1) * pitch, `${sel} > tbody > tr:nth-child(${j + 1})`, print);
            if (res) {
              rules.push(...res.rules);
              splits.push({ tbl: b, y: k * pitch + CH, k, to: (k + 1) * pitch, mid: true });
              if (!print) this.rowSplit.set(tr, res.add);
              extra += res.add;
              continue;
            }
          }
          if (to > 0) { j = to; tr = rows[to]; rTop = rowTop(to); rH = tr.offsetHeight; }
          if (rH <= CH && rTop > k * pitch + 1) {
            const g = (k + 1) * pitch - rTop;
            if (print) rules.push(`${sel} > tbody > tr:nth-child(${j + 1}){break-before:page}`);
            else {
              rules.push(`${sel} > tbody > tr:nth-child(${j + 1}) > :is(td,th)::before{content:"";display:block;height:${g.toFixed(1)}px}`);
              rules.push(`${sel} > tbody > tr:nth-child(${j + 1}){height:${(rH + g).toFixed(1)}px !important}`);
            }
            const bw = Math.max(1, ...Array.from(tr.cells).map((c) => parseFloat(getComputedStyle(c).borderTopWidth) || 0));
            splits.push({ tbl: b, y: rTop + bw / 2 + 2, k, to: (k + 1) * pitch });
            if (!print) this.rowSplit.set(tr, g);
            extra += g;
          }
        }
        if (!print) this.blockPage.set(b, Math.floor((top + gap) / pitch + 1e-6));
        prevTbl = { el: b, start: Math.floor((top + gap) / pitch + 1e-6), end: Math.floor((top + gap + e.h - drop + extra - 1) / pitch + 1e-6) };
        shift += gap + extra - drop;
        lastBottom = Math.max(lastBottom, top + gap + e.h - drop + extra);
        return;
      }
      if (b.classList.contains('pagebreak')) {
        // 쪽 맨 위에 있는 쪽 나누기는 빈 쪽을 만들지 않음
        const atStart = top > 0 && top - pk * pitch < 2;
        const hgt = atStart ? 0 : Math.max(0, (pk + 1) * pitch - top);
        if (!print) b.style.height = hgt + 'px';
        else if (atStart) rules.push(`#editor > :nth-child(${i + 1}){break-after:auto !important}`);
        shift += hgt;
        lastBottom = Math.max(lastBottom, top + hgt);
        return;
      }
      let gap = 0;
      let pgs = 0; // 문단을 쪽 경계에서 줄 단위로 나눠 넣은 빈 자리 합
      if (paged && top > pk * pitch + 1 && top >= cEnd - 0.5) gap = (pk + 1) * pitch - top; // 쪽 여백에서 시작하면 다음 쪽으로
      else if (paged && /^(P|H[1-6]|DIV)$/.test(b.tagName) ? top + e.h - e.mb - e.lead > cEnd + 0.5 : (paged && top + e.h > cEnd + 0.5)) {
        // 한글처럼 문단을 줄 단위로 나눠 다음 쪽으로 이어 씀 (첫 줄부터 넘치면 문단째 넘김)
        const L = /^(P|H[1-6])$/.test(b.tagName) ? lineInfo(b) : null;
        let base = top, cut = [], splitDone = false;
        if (L && L.lines.length > 1) {
          let k = pk;
          for (let li = 0; li < L.lines.length; li++) {
            const ln = L.lines[li];
            const lt = base + e.mt + ln.top, lb = base + e.mt + ln.bottom;
            const ce = k * pitch + CH;
            if (lb - e.lead > ce + 0.5) {
              if (li === 0) { if (top > pk * pitch + 1 && e.h <= CH) { cut = null; } break; }
              if (!ln.node) { cut = null; break; }
              const g = (k + 1) * pitch - lt;
              // 인쇄: 쪽 끝까지만 채움(조금 모자라게) → 다음 줄이 들어가지 않아 브라우저가 다음 쪽으로 넘김. 남은 자리가 한 줄보다 작으면 그냥 넘어감
              const hh = print ? g - 0.5 : g;
              if (!print || hh >= (ln.bottom - ln.top) + 0.5) cut.push({ node: ln.node, off: ln.off, h: hh, print });
              splitDone = true;
              base += g; pgs += g; k++;
            }
          }
        } else cut = null;
        if (cut && splitDone) pageSplits.push(...cut);
        else if (top > pk * pitch + 1 && e.h <= CH) { gap = (pk + 1) * pitch - top; pgs = 0; } // 쪽 끝에 걸치면 통째로 다음 쪽으로
        else pgs = 0;
      }
      if (!print) this.blockPage.set(b, Math.floor((top + gap) / pitch + 1e-6));
      if (gap > 0) {
        const sel = `#editor > :nth-child(${i + 1})`;
        // (문단도 ::before가 아닌 margin으로 띄움 — ::before가 첫 줄이 되면 내어쓰기·들여쓰기가 사라짐)
        if (print) rules.push(`${sel}{break-before:page}`);
        else rules.push(`${sel}{margin-top:${(e.mt + gap).toFixed(1)}px !important}`);
        shift += gap;
      }
      shift += pgs;
      lastBottom = Math.max(lastBottom, top + gap + e.h + pgs);
    });
    return { rules, splits, lastBottom };
    };
    const scr = paginate(pitch, false);
    const splits = scr.splits, lastBottom = scr.lastBottom;
    const PP = CH + TOLT;
    const prn = paged ? paginate(PP, true) : { rules: [], splits: [] };
    // 문단을 나눈 자리에 빈 자리 넣기 — 화면용·인쇄용 따로
    if (pageSplits.length) {
      Ratio.keep(() => {
        const byNode = new Map();
        pageSplits.forEach((sp) => { if (!byNode.has(sp.node)) byNode.set(sp.node, []); byNode.get(sp.node).push(sp); });
        let n = 0;
        for (const [node, list] of byNode) {
          list.sort((a, b2) => b2.off - a.off || (a.print ? 1 : -1));
          for (const sp of list) {
            if (!node.isConnected || sp.off > node.nodeValue.length) continue;
            const after = sp.off > 0 ? node.splitText(sp.off) : node;
            // [줄바꿈 가능][가로 전체·빈 자리 높이의 상자][줄바꿈 가능] → 상자가 한 줄을 통째로 차지해 다음 줄이 다음 쪽 맨 위로 감
            // (float는 한글 줄 나눔 고정(nowrap) 문단에서 제자리에 놓이지 않아 인라인 상자를 씀)
            const span = h('span', { class: 'pgs', contenteditable: 'false', 'data-n': ++n });
            const w1 = document.createElement('wbr'); w1.className = 'pgsw';
            const w2 = document.createElement('wbr'); w2.className = 'pgsw';
            after.parentNode.insertBefore(w1, after);
            after.parentNode.insertBefore(span, after);
            after.parentNode.insertBefore(w2, after);
            (sp.print ? prn : scr).rules.push(`#editor span.pgs[data-n="${n}"]{display:inline-block;vertical-align:top;width:100%;height:${sp.h.toFixed(1)}px;text-indent:0}`);
          }
        }
        return true;
      });
    }
    gapCss.textContent = (scr.rules.length ? `@media screen{${scr.rules.join('')}}` : '') + (prn.rules.length ? `@media print{${prn.rules.join('')}}` : '');
    if (this._keepScroll && Date.now() < this._keepScroll.until) $('#workspace').scrollTop = this._keepScroll.top;
    // 인쇄용 가림: 나뉜 표의 빈 부분(쪽 아래)을 가리고 다음 쪽 첫 줄 위에 선을 그음
    let pcover = $('#print-cover');
    if (!pcover) { pcover = h('div', { id: 'print-cover', 'aria-hidden': 'true' }); page.append(pcover); }
    pcover.innerHTML = '';
    for (const sp of prn.splits) {
      if (!sp.mid) continue; // 줄째 넘김은 인쇄에서 쪽 나눔(break-before)으로 처리되어 가릴 것이 없음
      const L = sp.tbl.offsetLeft - 2 + 'px', W = sp.tbl.offsetWidth + 4 + 'px';
      pcover.append(h('div', { class: 'pg-split', style: { top: sp.y + 'px', height: Math.max(0, sp.to - sp.y - 0.5) + 'px', left: L, width: W, borderTop: '1px solid #000', borderBottom: '0' } }));
      pcover.append(h('div', { class: 'pg-split', style: { top: sp.to + 'px', height: '1px', left: L, width: W, borderBottom: '0', background: '#000' } }));
    }
    // 표가 나뉜 자리: 쪽 아래 여백·쪽 사이·다음 쪽 위 여백에 걸친 표 부분을 가려서 나뉜 곳이 보이게
    let cover = $('#page-cover');
    if (!cover) { cover = h('div', { id: 'page-cover', class: 'no-print', 'aria-hidden': 'true' }); page.append(cover); }
    cover.innerHTML = '';
    const padL = U.mm2px(p.left), paperH = U.mm2px(p.height);
    for (const sp of splits) {
      const y1 = padTop + sp.y, y2 = padTop + sp.to;
      const a1 = sp.k * pitch + paperH - y1, a2 = a1 + this.PAGE_GAP;
      cover.append(h('div', { class: 'pg-split', style: {
        top: y1 + 'px', height: Math.max(0, y2 - y1) + 'px', left: padL + sp.tbl.offsetLeft - 2 + 'px', width: sp.tbl.offsetWidth + 4 + 'px', ...(sp.mid ? { borderTop: '1px solid #000' } : {}),
        background: `linear-gradient(to bottom, #fff 0 ${a1}px, var(--workspace) ${a1}px ${a2}px, #fff ${a2}px)`,
      } }));
    }
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
    // 본문 네 귀퉁이 표시 (한글 2024처럼 모서리만)
    const cornerL = U.mm2px(p.left), cornerR = U.mm2px(p.width - p.right);
    const corners = (T, B) => {
      const c = (x, y, sides) => { const d = h('div', { class: 'pg-corner', style: { left: x + 'px', top: y + 'px' } }); sides.forEach((sd) => (d.style['border' + sd + 'Width'] = '1px')); guides.append(d); };
      if (T != null) { c(cornerL - 14, T - 14, ['Right', 'Bottom']); c(cornerR, T - 14, ['Left', 'Bottom']); }
      if (B != null) { c(cornerL - 14, B, ['Right', 'Top']); c(cornerR, B, ['Left', 'Top']); }
    };
    if (paged) for (let k = 0; k < pages; k++) corners(k * pitch + padTop, k * pitch + padTop + CH);
    else corners(padTop, padTop + pages * CH);
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
    Marks.update();
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
    // 배율에 따라 글자 줄바꿈이 조금 달라지므로 쪽 나눔(표가 나뉘는 자리)을 다시 계산
    if (this.layoutSoon) this.layoutSoon();
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
    App.saveSettings({ noGuides: cl.contains('no-guides'), showMarks: cl.contains('show-marks'), showParaMarks: cl.contains('show-paramarks'), noHRuler: cl.contains('no-hruler'), noVRuler: cl.contains('no-vruler'), noToolbar: cl.contains('no-toolbar'), zoom: App.zoom });
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
        // 인쇄 쪽 오른쪽 여백을 0으로 두므로(표가 오른쪽 여백까지 나가도 잘리지 않게), 머리말 칸은 오른쪽 여백만큼 안쪽으로
        let css = `content:${content};${font}text-align:${al};vertical-align:${top ? 'bottom' : 'top'};${al !== 'left' ? `padding-right:${p.right}mm;` : ''}`;
        if (bx.line) {
          const col = (HF.get(top ? 'header' : 'footer') || {}).color || '#000';
          css += `width:${((p.width - p.left - p.right) / 3).toFixed(2)}mm;border-${top ? 'bottom' : 'top'}:0.4pt solid ${col};padding-${top ? 'bottom' : 'top'}:1mm;margin-${top ? 'bottom' : 'top'}:${Math.max(0, pad - 1)}mm;`;
        } else css += `padding-${top ? 'bottom' : 'top'}:${pad}mm;`;
        margin += `@${pos}{${css}}`;
      }
      return margin;
    };
    const pn = PageNum.printCss(boxesFor);
    // 인쇄 쪽 본문 = 화면 본문 + 넘침 허용(printTol): 화면에서 꼬리말 자리까지 내려간 표 줄이 인쇄에서도 같은 쪽에 남게
    const tolMm = Math.min(p.bottom + p.footer - 1, ((this.printTol || 0) + 3) * 25.4 / 96); // +3px: 반올림 여유
    $('#page-style').textContent =
      `@page{background:#fff;size:${p.width}mm ${p.height}mm;margin:${p.top + p.header}mm 0 ${(p.bottom + p.footer - Math.max(0, tolMm)).toFixed(3)}mm ${p.left}mm;${pn.page}}${pn.extra}`
      + `@media print{#editor{width:${this.contentWidth()}px !important}}`;
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
      // 텍스트 파일 끝의 줄바꿈 하나는 붙이지 않음 (그대로 넣으면 마지막에 빈 줄이 하나 더 생김)
      const lines = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
      if (lines.length === 1) document.execCommand('insertText', false, lines[0]);
      else if (!App.pasteLines(lines)) document.execCommand('insertHTML', false, lines.map((l) => `<p>${escHtml(l).replace(/\t/g, '<span class="tab" contenteditable="false">&#9;</span>') || '<br>'}</p>`).join(''));
    }
    Para.ensure();
    Sel.editor.querySelectorAll('td, th').forEach((td) => { if (!td.firstElementChild) td.append(h('p', {}, h('br'))); });
  },

  // 여러 줄 글 붙이기: 커서 자리 문단을 나눠 줄마다 같은 문단·글자 모양의 문단으로 넣음
  // (크롬 insertHTML은 문단 모양을 버리고, 앞뒤 문단과 합치면서 빈 문단을 하나 더 만들기도 함)
  pasteLines(lines) {
    const r = Sel.range();
    if (!r) return false;
    const blk = blockOf(r.startContainer);
    if (!blk || !/^(P|H[1-6])$/.test(blk.tagName) || !Sel.editor.contains(blk) || blk.closest('.tb-body, .nobj, .figcap')) return false;
    History.checkpoint();
    r.deleteContents();
    // 커서 자리 글자 모양(바깥 문단까지의 span 등) — 새 줄에도 같은 모양으로
    const chain = [];
    for (let n = r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer; n && n !== blk; n = n.parentElement) {
      if (n.matches && !n.matches('span.rw, span.pgs, span.tab, ruby, rt, .nobj, a')) chain.unshift(n);
    }
    const wrap = (frag) => {
      let node = frag;
      for (let i = chain.length - 1; i >= 0; i--) { const c = chain[i].cloneNode(false); c.append(node); node = c; }
      return node;
    };
    const lineFrag = (l) => {
      const f = document.createDocumentFragment();
      l.split('\t').forEach((part, i) => {
        if (i) f.append(h('span', { class: 'tab', contenteditable: 'false' }, '\t'));
        if (part) f.append(document.createTextNode(part));
      });
      return f;
    };
    // 커서 뒤 나머지 글
    const tailR = document.createRange();
    tailR.setStart(r.startContainer, r.startOffset);
    tailR.setEnd(blk, blk.childNodes.length);
    const tail = tailR.extractContents();
    // 첫 줄은 지금 문단 끝에
    const first = lineFrag(lines[0]);
    if (first.childNodes.length) {
      const ins = document.createRange(); ins.setStart(r.startContainer, r.startOffset); ins.collapse(true);
      ins.insertNode(first);
    }
    const fresh = () => {
      const p = blk.cloneNode(false);
      p.removeAttribute('id'); p.removeAttribute('data-hl'); p.removeAttribute('data-hh'); p.classList.remove('hl-lock');
      if (!p.className) p.removeAttribute('class');
      return p;
    };
    let after = blk, last = null, lastText = null;
    for (let i = 1; i < lines.length; i++) {
      const p = fresh();
      const f = lineFrag(lines[i]);
      lastText = f.lastChild && f.lastChild.nodeType === 3 ? f.lastChild : null;
      p.append(wrap(f.childNodes.length ? f : h('br')));
      after.after(p); after = p; last = p;
    }
    // 커서 뒤 나머지는 마지막 줄 뒤에 붙이고, 커서는 붙인 글 끝에
    const tailHasContent = tail.textContent.replace(/\u200b/g, '') || (tail.querySelector && tail.querySelector('img, .nobj, .tab, br'));
    const caretAt = (() => {
      if (lastText) return [lastText, lastText.length];
      return null;
    })();
    if (tailHasContent) last.append(tail);
    for (const p of [blk, last]) {
      p.querySelectorAll(':scope br').forEach((b) => { if (p.textContent.replace(/\u200b/g, '') && !b.nextSibling && b.parentElement.lastChild === b) b.remove(); });
      if (!p.textContent.replace(/\u200b/g, '') && !p.querySelector('img, .nobj, br, .tab')) p.append(chain.length ? wrap(h('br')) : h('br'));
    }
    blk.removeAttribute('data-hl'); blk.removeAttribute('data-hh'); blk.classList.remove('hl-lock');
    const rg = document.createRange();
    if (caretAt) rg.setStart(caretAt[0], caretAt[1]);
    else rg.setStart(last, 0);
    rg.collapse(true);
    Sel.set(rg);
    return true;
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
  // 글꼴 파일을 늦게 불러오면(local 글꼴 등) 글자 폭이 바뀌므로 쪽·줄 나눔을 다시 계산
  if (document.fonts) document.fonts.addEventListener('loadingdone', () => App.layoutSoon());
  const statusSoon = debounce(() => { App.updateStatus(); App.updateToolbar(); Ruler.drawSoon(); }, 60);

  window.addEventListener('keydown', (e) => App.onKeyDown(e), true);
  ed.addEventListener('beforeinput', (e) => {
    const t = e.inputType;
    if (t === 'historyUndo') { e.preventDefault(); History.undo(); return; }
    if (t === 'historyRedo') { e.preventDefault(); History.redo(); return; }
    if (Table.block.active()) Table.block.clear();
    // 셀 안 글 전체를 잡고 지우기·오려 두기·덮어 쓰기: 크롬은 셀 하나짜리 표면 표까지 지워 버림 → 셀 내용만 비움
    if ((t.startsWith('delete') || t === 'insertText' || t === 'insertFromPaste') && !MultiSel.active && App.clearWholeCell()) {
      if (t.startsWith('delete')) { e.preventDefault(); App.changed(); return; }
    }
    // 문단 합치기(문단 맨 앞 Backspace, 맨 끝 Delete)는 직접: 크롬은 합치면서 문단 서식(내어쓰기·여백)을 글자 상자에 복사해 넣어 첫 줄이 밀림
    if ((t === 'deleteContentBackward' || t === 'deleteContentForward') && !MultiSel.active && !ColBlock.active && App.mergeParas(t === 'deleteContentForward')) { e.preventDefault(); App.changed(); return; }
    if (t === 'insertText' && App.overwrite && !e.isComposing) {
      const s = window.getSelection();
      if (s.isCollapsed) {
        s.modify('extend', 'forward', 'character');
        const sel = s.toString();
        if (!sel || sel === '\n' || /\u0001/.test(sel)) s.collapseToStart();
      }
    }
    if (t === 'insertParagraph' && !MultiSel.active && Lists.enterOnEmpty()) { e.preventDefault(); return; }
    // md 코드 블록·머리 정보 안의 Enter는 줄바꿈 (블록이 나뉘지 않게)
    if (t === 'insertParagraph' && !MultiSel.active && App.isMdDoc()) {
      const r0 = Sel.range();
      const b0 = r0 && blockOf(r0.startContainer);
      if (b0 && /^(code|front)$/.test(b0.dataset.mt || '')) { e.preventDefault(); History.checkpoint(); document.execCommand('insertLineBreak'); App.changed(); return; }
    }
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
    if (e.inputType === 'insertParagraph') { if (App.isMdDoc()) MD.afterEnter(); App.carryStyle(); }
    TabStops.onInput(e);
    if (MultiSel.active) MultiSel.draw();
    if (!ed.firstElementChild || ed.childNodes[0].nodeType === 3) Para.ensure();
    // 문단 부호(↵)는 입력 즉시 다시 그림 — 쪽 나눔 계산(layout)을 기다리면 한 박자 늦게 나타남
    if (document.body.classList.contains('show-paramarks') || document.body.classList.contains('show-marks')) Marks.update();
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
      (async () => { for (const f of files) await Img.insert(await fileToDataURL(f), { name: f.name && f.name !== 'image.png' ? f.name : '' }); App.changed(); })();
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
    // 스크롤바를 누르거나 끌 때도 mousedown이 #workspace로 옴 → 커서를 옮기면 안 됨 (Shift+클릭 블록이 문서 끝까지 잡힘)
    const wr = ws.getBoundingClientRect();
    if (e.clientX >= wr.left + ws.clientLeft + ws.clientWidth || e.clientY >= wr.top + ws.clientTop + ws.clientHeight) return;
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
    const files = Array.from(e.dataTransfer.files || []).filter((f) => /\.(hwpx|hwp|md|markdown|txt|html?)$/i.test(f.name));
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

// 커서가 문단 맨 앞(Backspace) 또는 맨 끝(Delete)일 때 앞뒤 문단을 합침. 합칠 수 없는 경우는 false (크롬 기본 동작)
App.mergeParas = function (forward) {
  const s = window.getSelection();
  if (!s.rangeCount || !s.isCollapsed) return false;
  const r = s.getRangeAt(0);
  const isPara = (el) => el && /^(P|H[1-6])$/.test(el.tagName) && !el.closest('.tb-body, .nobj, .figcap');
  const blk = blockOf(r.startContainer);
  if (!isPara(blk) || !Sel.editor.contains(blk)) return false;
  const vis = (rg) => rg.toString().replace(/\u200b/g, '');
  const edge = document.createRange();
  if (forward) { edge.setStart(r.startContainer, r.startOffset); edge.setEnd(blk, blk.childNodes.length); }
  else { edge.setStart(blk, 0); edge.setEnd(r.startContainer, r.startOffset); }
  if (vis(edge) !== '') return false;
  const frag = edge.cloneContents();
  if (frag.querySelector && frag.querySelector('img, .nobj, .tab, .mm-field, table')) return false;
  // 쪽 나누기·단 나누기 바로 뒤에서 Backspace(앞에서 Delete): 나누기만 지움 — 크롬 기본은 문단을 풀어 글을 나누기 표시 안으로 옮겨 버림
  const nb = forward ? blk.nextElementSibling : blk.previousElementSibling;
  if (nb && (nb.classList.contains('pagebreak') || nb.classList.contains('colbreak'))) {
    History.checkpoint();
    nb.remove(); // 커서는 이 문단 안에 그대로 있음
    return true;
  }
  const A = forward ? blk : blk.previousElementSibling, B = forward ? blk.nextElementSibling : blk;
  if (!isPara(A) || !isPara(B) || A.parentNode !== B.parentNode) return false;
  const empty = (el) => !el.textContent.replace(/[\u200b]/g, '') && !el.querySelector('img, .nobj, .tab, .mm-field, table');
  History.checkpoint();
  const caretAt = (node, off) => { const rg = document.createRange(); rg.setStart(node, off); rg.collapse(true); Sel.set(rg); };
  if (empty(A)) {
    // 빈 문단을 지움 — 남는 문단의 서식(내어쓰기 등)은 그대로
    A.remove();
    const tw = document.createTreeWalker(B, NodeFilter.SHOW_TEXT);
    const f = tw.nextNode();
    if (f) caretAt(f, 0); else Sel.caretInto(B, false);
    return true;
  }
  if (empty(B)) {
    B.remove();
    Sel.caretInto(A, true);
    return true;
  }
  // 둘 다 글이 있으면 B의 내용을 A 끝에 옮김 (A의 문단 서식 유지)
  A.querySelectorAll(':scope > br:last-child').forEach((x) => x.remove());
  B.querySelectorAll('span.pgs, wbr.pgsw').forEach((x) => x.remove());
  // 나눈 자리 양쪽 띄어쓰기를 크롬이 &nbsp;로 바꿔 둔 것을 보통 빈칸으로 되돌림
  const lastText = (el, back) => { const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let t, res = null; while ((t = tw.nextNode())) { if (t.nodeValue.replace(/\u200b/g, '')) { res = t; if (!back) break; } } return res; };
  const ta = lastText(A, true), tb = lastText(B, false);
  if (ta && /\u00a0$/.test(ta.nodeValue)) ta.nodeValue = ta.nodeValue.replace(/\u00a0$/, ' ');
  if (tb && /^\u00a0/.test(tb.nodeValue)) tb.nodeValue = tb.nodeValue.replace(/^\u00a0/, ' ');
  const first = B.firstChild;
  while (B.firstChild) A.append(B.firstChild);
  B.remove();
  A.removeAttribute('data-hl'); A.removeAttribute('data-hh'); A.classList.remove('hl-lock');
  if (first && first.isConnected) {
    if (first.nodeType === 3) caretAt(first, 0);
    else { const tw = document.createTreeWalker(first, NodeFilter.SHOW_TEXT); const f = tw.nextNode(); if (f) caretAt(f, 0); else { const rg = document.createRange(); rg.setStartBefore(first); rg.collapse(true); Sel.set(rg); } }
  }
  return true;
};
// 선택(또는 커서)이 한 셀 안에 있으면 그 셀
App.cellOfSelection = function () {
  const r = Sel.range();
  if (!r || !Sel.editor.contains(r.startContainer)) return null;
  const cell = (n) => { const el = n.nodeType === 1 ? n : n.parentElement; return el && el.closest('td, th'); };
  const a = cell(r.startContainer), b = cell(r.endContainer);
  return a && a === b && Sel.editor.contains(a) ? a : null;
};
App.cellFullySelected = function (td) {
  const r = Sel.range();
  if (!r || r.collapsed) return false;
  const all = document.createRange();
  all.selectNodeContents(td);
  const norm = (x) => x.replace(/[\s\u200b]/g, '');
  const txt = norm(td.textContent);
  const objs = td.querySelector('img, .nobj, table');
  if (!txt && !objs) return false;
  if (norm(r.toString()) !== txt) return false;
  // 그림·개체가 있으면 경계까지 모두 들어 있어야 전체
  if (objs) return Array.from(td.querySelectorAll('img, .nobj, table')).every((o) => r.intersectsNode(o));
  return true;
};
// 셀 내용 전체가 선택돼 있으면 셀을 빈 문단 하나로 비우고 커서를 넣음 (표는 그대로)
App.clearWholeCell = function () {
  const td = App.cellOfSelection();
  if (!td || !App.cellFullySelected(td)) return false;
  History.checkpoint();
  const first = td.querySelector('p, li, h1, h2, h3, h4, h5, h6, div');
  const p = first && first.parentElement === td ? first.cloneNode(false) : h('p');
  // 첫 글자의 글자 모양은 이어 쓰도록 남김
  const run = first && first.querySelector('span[style]');
  const keep = run ? run.cloneNode(false) : null;
  p.append(h('br'));
  td.replaceChildren(p);
  const rg = document.createRange();
  if (keep) { keep.append(document.createTextNode('\u200b')); p.insertBefore(keep, p.firstChild); rg.setStart(keep.firstChild, 1); }
  else rg.setStart(p, 0);
  rg.collapse(true);
  Sel.set(rg);
  return true;
};
App.onKeyDown = function (e) {
  if (e.target.closest && e.target.closest('.dlg')) return; // 대화상자가 처리
  if (Dialog.stack.some((d) => !d.el.closest('.modeless'))) { e.preventDefault(); return; }
  if (App.menuKey(e)) return;
  if (MultiSel.active && (e.isComposing || e.keyCode === 229)) {
    // 한글 조합 중 방향키: 기본 동작(조합 끝내고 이동)은 그대로 두고, 키를 뗄 때 나머지 커서도 이동
    const nav = { ArrowLeft: ['backward', 'character'], ArrowRight: ['forward', 'character'], ArrowUp: ['backward', 'line'], ArrowDown: ['forward', 'line'], Home: ['backward', 'lineboundary'], End: ['forward', 'lineboundary'] }[e.code];
    if (nav && e.isComposing) { MultiSel.navPending = [nav[0], e.ctrlKey && nav[1] === 'character' ? 'word' : nav[1], e.shiftKey]; return; }
  }
  // ----- 표 밖 왼쪽 커서 (Shift+Esc) -----
  if (Table.outside && Table.outsideKey(e)) return;
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

  // ----- 셀 안에서 Ctrl+A: 먼저 그 셀 내용만, 한 번 더 누르면 문서 전체 -----
  if (k === 'Ctrl+A' && !Table.block.active() && !Sel.closest('.tb-body')) {
    const td = App.cellOfSelection();
    if (td && !App.cellFullySelected(td)) {
      stop();
      const r = document.createRange();
      r.selectNodeContents(td);
      Sel.set(r);
      return;
    }
  }
  if ((k === 'Left' || k === 'Right') && !MultiSel.active && !Table.block.active() && Table.arrowToTable(k === 'Left' ? -1 : 1)) { stop(); return; }
  // ----- 표 밖으로 나가기 (한글: Shift+Esc) -----
  if (k === 'Shift+Escape' && (Sel.closest('td, th') || Table.block.active()) && !Sel.closest('.tb-body')) { stop(); Table.exitBefore(); return; }
  // ----- 고른 표 (바깥 테두리를 눌러 고름) -----
  if (Table.selected) {
    const t = Table.selected;
    if (!t.isConnected) Table.deselect();
    else if (k === 'Delete' || k === 'Backspace') { stop(); History.checkpoint(); const nx = t.nextElementSibling || t.previousElementSibling; Table.deselect(); t.remove(); Para.ensure(); if (nx && nx.isConnected) Sel.caretInto(nx); App.changed(); return; }
    else if (k === 'Escape' || k === 'Shift+Escape') { stop(); Table.deselect(); const nx = t.nextElementSibling; if (nx) Sel.caretInto(nx); return; }
    else if (!/^(Ctrl|Alt|Shift)$/.test(k)) Table.deselect();
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
  { name: '파일', key: 'F', items: ['file-new', 'file-new-window', 'file-open', '-', 'file-save', 'file-saveas', 'file-docx', 'file-pdf', 'file-image', '-', 'page-setup', 'file-print', '-', 'file-close', 'app-quit'] },
  { name: '편집', key: 'E', items: ['undo', 'redo', '-', 'cut', 'copy', 'paste', 'paste-text', '-', 'select-all', 'block', 'col-block', 'caret-add-up', 'caret-add-down', '-', 'delete-line', 'delete-eol', 'delete-word', '-', 'find', 'replace', 'find-next', 'goto', '-', 'shape-copy'] },
  { name: '보기', key: 'U', items: ['fullscreen', 'toggle-toolbar', '-', 'toggle-guides', 'toggle-paramarks', 'toggle-marks', 'toggle-hruler', 'toggle-vruler', '-', 'split-v', 'split-h', 'split-off', '-', 'lang-ko', 'lang-en', '-', 'zoom-in', 'zoom-out', 'zoom-100', 'zoom-width'] },
  { name: '입력', key: 'D', items: ['table-create', 'image-insert', 'textbox', '-', 'shape-line', 'shape-arrow', 'shape-darrow', 'shape-rect', 'shape-roundrect', 'shape-ellipse', 'shape-triangle', '-', 'wrap-inline', 'wrap-left', 'wrap-right', 'wrap-front', 'wrap-behind', 'object-props', 'image-caption', 'shape-text', 'obj-group', 'obj-ungroup', '-', 'page-break', 'symbols', 'date-insert', 'link', '-', 'mm-mark'] },
  { name: '서식', key: 'J', items: ['char-shape', 'para-shape', 'tab-dialog', 'style-dlg', '-', 'bold', 'italic', 'underline', 'strike', 'sup', 'sub', 'normal-char', '-', 'size-up', 'size-down', 'spacing-wide', 'spacing-narrow', 'ratio-wide', 'ratio-narrow', 'lh-up', 'lh-down', '-', 'align-justify', 'align-left', 'align-center', 'align-right', 'align-distribute', '-', 'indent-first', 'outdent-first', 'margin-inc', 'margin-dec', '-', 'numbering', 'numbering-shape', 'num-restart', 'bullets', 'bullet-shape', 'list-deeper', 'list-shallower'] },
  { name: '쪽', key: 'W', items: ['page-setup', 'page-break', '-', 'columns', 'col-break', '-', 'page-number', 'page-newnum', 'page-hide', 'header-footer'] },
  { name: '표', key: 'B', items: ['table-create', '-', 'cell-block', 'row-col-insert', 'row-add', 'col-add', 'row-col-delete', '-', 'cell-merge', 'cell-split', 'cell-props', 'equal-width', 'equal-height', '-', 'table-split', 'table-join', '-', 'table-props', 'wrap-inline', 'wrap-left', 'wrap-right', 'wrap-front', 'wrap-behind', '-', 'table-delete'] },
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
  // 오른쪽 끝: 도구 상자 접기/펴기, 전체 화면
  const tb = h('button', { class: 'mb-btn', id: 'mb-fold', title: '도구 상자 접기/펴기 (Ctrl+F1)' });
  const fs = h('button', { class: 'mb-btn', title: '전체 화면 (F11)' }, '⛶');
  const setFold = () => { tb.textContent = document.body.classList.contains('no-toolbar') ? '▾' : '▴'; };
  tb.addEventListener('mousedown', (e) => { e.preventDefault(); Commands.run('toggle-toolbar'); setFold(); });
  fs.addEventListener('mousedown', (e) => { e.preventDefault(); Commands.run('fullscreen'); });
  new MutationObserver(setFold).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  setFold();
  bar.append(h('div', { style: { flex: '1' } }), tb, fs);
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
    if (isImg) items.push('image-caption');
    if (Shapes.canHaveText(obj)) items.push({ label: obj.querySelector('.sh-text') ? '도형 안 글자 고치기' : '도형 안에 글자 넣기', run: () => Shapes.addText(obj) });
    items.push(...wrapItems(Shapes.WRAPS),
      { label: isImg ? '그림 지우기' : '개체 지우기', key: 'Delete', run: () => Img.remove() });
  } else if (Table.block.active() || e.target.closest('td,th')) {
    if (!Table.block.active()) {
      const pos = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (pos && !Sel.range()?.intersectsNode(pos.startContainer)) Sel.set(pos);
    }
    items.push('-', 'cell-block', 'row-col-insert', 'row-col-delete', 'cell-merge', 'cell-split', 'table-split', 'table-join', 'cell-props', 'table-props', 'equal-width', 'equal-height', '-', ...wrapItems(Shapes.TABLE_WRAPS), '-', 'table-delete');
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
  // 문단을 감싼 div(웹 페이지 틀)는 벗김 — 그대로 두면 문단들이 한 덩어리로 들어감
  const BLOCKS = /^(P|DIV|TABLE|UL|OL|LI|TR|TBODY|THEAD|TFOOT)$/;
  let more = true;
  while (more) {
    more = false;
    for (const d of Array.from(body.querySelectorAll('div'))) {
      if (d.closest('td, th, li') && d.closest('td, th, li') !== d) continue;
      if (Array.from(d.children).some((x) => BLOCKS.test(x.tagName))) { d.replaceWith(...Array.from(d.childNodes)); more = true; }
    }
  }
  // 문단 사이의 줄바꿈 공백(</p>⏎<p>)은 지움 — 크롬이 이것을 빈 문단으로 넣어 마지막 문단 앞에 빈 줄이 생김
  const tw0 = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const wsNodes = [];
  for (let t = tw0.nextNode(); t; t = tw0.nextNode()) {
    if (/\S/.test(t.nodeValue.replace(/\u00a0/g, 'x'))) continue;
    const par = t.parentNode;
    if (par && Array.from(par.children).some((x) => BLOCKS.test(x.tagName))) wsNodes.push(t);
  }
  wsNodes.forEach((t) => t.remove());
  // 문단 끝에 남은 줄바꿈(<br>)과 맨 끝의 <br>은 지움 — 마지막 줄 뒤에 빈 줄이 하나 더 생김
  body.querySelectorAll('p').forEach((p) => {
    let last = p.lastChild;
    while (last && last.nodeType === 3 && !last.nodeValue.trim()) last = last.previousSibling;
    if (last && last.nodeName === 'BR' && p.textContent.trim()) last.remove();
  });
  for (let last = body.lastChild; last && (last.nodeName === 'BR' || (last.nodeType === 3 && !last.nodeValue.trim())); last = body.lastChild) {
    if (last.nodeName === 'BR' && !Array.from(body.children).some((x) => BLOCKS.test(x.tagName))) break; // 글만 있는 조각의 줄바꿈은 그대로
    last.remove();
  }
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
