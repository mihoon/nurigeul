// 명령 모음, 단축키, 메뉴, 도구 모음
'use strict';
const Commands = (() => {
  const list = [];
  const byId = new Map();
  const keyMap = new Map();
  const chordPrefixes = new Set();

  function def(group, id, label, opts = {}) {
    const c = { group, id, label, ...opts };
    c.keys = opts.keys || null;
    list.push(c);
    byId.set(id, c);
    (c.keys || []).forEach((k) => {
      keyMap.set(k, id);
      if (k.includes(',')) chordPrefixes.add(k.split(',')[0]);
    });
    return c;
  }

  const inTable = () => !!Table.currentCell() || Table.block.active();
  const needSel = () => Sel.inEditor() || Table.block.active();

  // ================= 파일 =================
  def('파일', 'file-new', '새 문서', { keys: ['Alt+N'], icon: 'file-plus', noHistory: true, run: () => Tabs.newDoc() });
  def('파일', 'file-new-window', '새 창', { noHistory: true, run: () => window.native.newWindow({}) });
  def('파일', 'tab-next', '다음 문서 탭', { keys: ['Ctrl+Tab'], noHistory: true, hidden: true, run: () => Tabs.next(1) });
  def('파일', 'tab-prev', '이전 문서 탭', { keys: ['Ctrl+Shift+Tab'], noHistory: true, hidden: true, run: () => Tabs.next(-1) });
  def('파일', 'file-open', '불러오기…', { keys: ['Alt+O', 'Ctrl+O'], icon: 'folder-open', noHistory: true, run: () => App.openDialog() });
  def('파일', 'file-save', '저장하기', { keys: ['Alt+S', 'Ctrl+S'], icon: 'save', noHistory: true, run: () => App.save() });
  def('파일', 'file-saveas', '다른 이름으로 저장하기…', { keys: ['Alt+V'], noHistory: true, run: () => App.save(true) });
  def('파일', 'file-docx', 'DOCX(Word)로 내보내기…', { noHistory: true, icon: 'file-text', run: () => App.exportDocx() });
  def('파일', 'file-pdf', 'PDF로 저장하기…', { noHistory: true, icon: 'file-down', run: () => App.exportPdf() });
  def('파일', 'file-image', '그림으로 저장하기…', { noHistory: true, icon: 'image', run: () => App.exportImage() });
  def('파일', 'page-setup', '편집 용지…', { keys: ['F7'], ask: () => Dialogs.pageSetup(), run: (a) => App.setPage(a) });
  def('파일', 'file-print', '인쇄…', { keys: ['Alt+P', 'Ctrl+P'], icon: 'printer', noHistory: true, run: () => App.print() });
  def('파일', 'file-close', '문서 닫기', { keys: ['Ctrl+F4'], noHistory: true, run: () => Tabs.closeCurrent() });
  def('파일', 'app-quit', '끝', { keys: ['Alt+X'], noHistory: true, run: () => window.native.quit() });

  // ================= 편집 =================
  def('편집', 'undo', '되돌리기', { keys: ['Ctrl+Z'], icon: 'undo-2', noHistory: true, run: () => History.undo() });
  def('편집', 'redo', '다시 실행', { keys: ['Ctrl+Shift+Z'], icon: 'redo-2', noHistory: true, run: () => History.redo() });
  def('편집', 'cut', '오려 두기', { keyLabel: 'Ctrl+X', icon: 'scissors', run: () => document.execCommand('cut') });
  def('편집', 'copy', '복사하기', { keyLabel: 'Ctrl+C', icon: 'copy', noHistory: true, run: () => document.execCommand('copy') });
  def('편집', 'paste', '붙이기', { keyLabel: 'Ctrl+V', icon: 'clipboard-paste', run: (a) => App.pasteFromClipboard(false, a) });
  def('편집', 'paste-text', '골라 붙이기 (텍스트만)', { keys: ['Ctrl+Alt+V'], run: (a) => App.pasteFromClipboard(true, a) });
  def('편집', 'select-all', '모두 선택', { keyLabel: 'Ctrl+A', noHistory: true, run: () => { Sel.editor.focus(); document.execCommand('selectAll'); } });
  def('편집', 'col-block', '칸 블록 (네모 범위)', { keys: ['F4'], noHistory: true, run: () => (ColBlock.active ? ColBlock.stop() : ColBlock.start()) });
  def('편집', 'caret-add-down', '아래 줄에 커서 추가', { keys: ['Ctrl+Alt+Down'], noHistory: true, run: () => MultiSel.addLine(true) });
  def('편집', 'caret-add-up', '위 줄에 커서 추가', { keys: ['Ctrl+Alt+Up'], noHistory: true, run: () => MultiSel.addLine(false) });
  def('편집', 'select-same', '같은 글자 모두 선택', { keys: ['Ctrl+Shift+;'], noHistory: true, run: () => MultiSel.start() });
  def('편집', 'block', '블록 설정', { keys: ['F3'], noHistory: true, run: () => App.toggleBlockMode() });
  def('편집', 'delete-line', '한 줄 지우기', { keys: ['Ctrl+Y'], run: () => Editing.deleteLine() });
  def('편집', 'delete-eol', '줄 뒤 지우기', { keys: ['Alt+Y'], run: () => Editing.deleteToEol() });
  def('편집', 'delete-word', '단어 지우기', { keys: ['Ctrl+T'], run: () => Editing.deleteWord() });
  def('편집', 'find', '찾기…', { keys: ['Ctrl+F', 'Ctrl+Q,F'], icon: 'search', noHistory: true, run: () => Find.open(false) });
  def('편집', 'replace', '찾아 바꾸기…', { keys: ['Ctrl+H', 'Ctrl+F2'], noHistory: true, run: () => Find.open(true) });
  def('편집', 'find-next', '다시 찾기', { keys: ['Ctrl+L'], noHistory: true, run: () => Find.next() });
  def('편집', 'goto', '찾아가기…', { keys: ['Alt+G'], noHistory: true, ask: () => Dialogs.goto(), run: (a) => App.gotoPage(a.page) });
  def('편집', 'shape-copy', '모양 복사', { keys: ['Alt+C'], run: () => Fmt.copyOrPasteShape() });

  // ================= 보기 =================
  def('보기', 'toggle-guides', '쪽 윤곽 (쪽 경계 표시)', { keys: ['Ctrl+G,L'], noHistory: true, checked: () => !document.body.classList.contains('no-guides'), run: () => { document.body.classList.toggle('no-guides'); App.saveUiPref(); App.layout(); } });
  def('보기', 'toggle-paramarks', '문단 부호 (문단 끝 ↵)', { keys: ['Ctrl+G,T'], noHistory: true, icon: 'pilcrow', checked: () => document.body.classList.contains('show-paramarks'), run: () => { document.body.classList.toggle('show-paramarks'); Marks.update(); App.saveUiPref(); } });
  def('보기', 'toggle-marks', '조판 부호 (줄 나눔·탭·개체·쪽 설정 표시)', { keys: ['Ctrl+G,C'], noHistory: true, checked: () => document.body.classList.contains('show-marks'), run: () => { document.body.classList.toggle('show-marks'); Marks.update(); App.saveUiPref(); } });
  def('보기', 'fullscreen', '전체 화면', { keys: ['F11'], noHistory: true, run: async () => {
    if (window.native && window.native.toggleFullScreen) await window.native.toggleFullScreen();
    else if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
    setTimeout(() => App.layoutSoon(), 300);
  } });
  def('보기', 'toggle-toolbar', '도구 상자 접기/펴기', { keys: ['Ctrl+F1'], noHistory: true, checked: () => document.body.classList.contains('no-toolbar'), run: () => { document.body.classList.toggle('no-toolbar'); App.saveUiPref(); Ruler.drawSoon(); } });
  def('보기', 'toggle-hruler', '가로 눈금자', { noHistory: true, checked: () => !document.body.classList.contains('no-hruler'), run: () => { document.body.classList.toggle('no-hruler'); App.saveUiPref(); Ruler.drawSoon(); } });
  def('보기', 'toggle-vruler', '세로 눈금자', { noHistory: true, checked: () => !document.body.classList.contains('no-vruler'), run: () => { document.body.classList.toggle('no-vruler'); App.saveUiPref(); Ruler.drawSoon(); } });
  def('보기', 'lang-ko', '언어: 한국어', { noHistory: true, checked: () => I18N.lang === 'ko', run: () => I18N.setLang('ko') });
  def('보기', 'lang-en', '언어: English', { noHistory: true, checked: () => I18N.lang === 'en', run: () => I18N.setLang('en') });
  def('보기', 'split-v', '창 나누기 (좌우)', { noHistory: true, checked: () => Split.mode === 'v', run: () => Split.open('v') });
  def('보기', 'split-h', '창 나누기 (위아래)', { noHistory: true, checked: () => Split.mode === 'h', run: () => Split.open('h') });
  def('보기', 'split-off', '창 나누기 해제', { noHistory: true, enabled: () => !!Split.mode, run: () => Split.close() });
  def('보기', 'zoom-in', '확대', { noHistory: true, run: () => App.setZoom(App.zoom + 0.1) });
  def('보기', 'zoom-out', '축소', { noHistory: true, run: () => App.setZoom(App.zoom - 0.1) });
  def('보기', 'zoom-100', '100%', { noHistory: true, run: () => App.setZoom(1) });
  def('보기', 'zoom-width', '폭 맞춤', { noHistory: true, run: () => App.zoomToWidth() });

  // ================= 입력 =================
  def('입력', 'table-create', '표 만들기…', { keys: ['Ctrl+N,T'], icon: 'table', ask: () => Dialogs.tableCreate(), run: (a) => Table.create(a.rows, a.cols, { header: a.header }) });
  def('입력', 'image-insert', '그림 넣기…', { keys: ['Ctrl+N,I'], icon: 'image', ask: () => Img.insertFromDialog().then((f) => (f ? { images: f.map((x) => x.url), names: f.map((x) => x.name) } : null)), run: async (a) => { for (let i = 0; i < a.images.length; i++) await Img.insert(a.images[i], { name: a.names && a.names[i] }); } });
  def('입력', 'page-break', '쪽 나누기', { keys: ['Ctrl+Enter'], icon: 'separator-horizontal', run: () => { if (Table.currentCell()) Table.insertRow(true); else Editing.pageBreak(); } });
  def('쪽', 'columns', '다단 설정…', { ask: () => Cols.dialog(), run: (a) => Cols.set(a) });
  def('쪽', 'col-break', '단 나누기', { keys: ['Ctrl+Shift+Enter'], run: () => Cols.colBreak() });
  def('입력', 'symbols', '문자표…', { keys: ['Ctrl+F10'], icon: 'omega', ask: () => Dialogs.symbols().then((c) => (c ? { ch: c } : null)), run: (a) => document.execCommand('insertText', false, a.ch) });
  def('입력', 'date-insert', '날짜 넣기', { keys: ['Ctrl+K,D'], run: () => document.execCommand('insertText', false, todayKorean(false)) });
  def('입력', 'link', '하이퍼링크…', { keys: ['Ctrl+K,H'], ask: () => Dialog.form('하이퍼링크', [{ name: 'url', label: '연결 주소', value: 'https://' }, { name: 'text', label: '표시할 글자', value: window.getSelection().toString() }]), run: (a) => Editing.link(a) });
  def('입력', 'mm-mark', '메일머지 표시 달기…', { keys: ['Ctrl+K,M'], icon: 'mail', ask: () => Merge.markDialog(), run: (a) => Merge.insertField(a.name) });
  def('입력', 'tab', '탭', { run: () => TabStops.insert() });
  def('서식', 'tab-dialog', '탭 설정…', { ask: () => TabStops.dialog(), run: (a) => TabStops.set(a.stops || []) });
  def('서식', 'tab-add', '탭 넣기', { hidden: true, run: (a) => TabStops.add(a.pos, a.type || 'L', a.leader) });
  def('서식', 'tab-remove', '탭 지우기', { hidden: true, run: (a) => TabStops.remove(a.pos) });
  def('서식', 'tab-leader', '탭 채울 모양', { hidden: true, run: (a) => TabStops.setLeader(a.pos, a.leader) });
  def('서식', 'tab-clear', '모든 탭 지우기', { hidden: true, run: () => TabStops.clear() });

  // ================= 서식 =================
  def('서식', 'char-shape', '글자 모양…', { keys: ['Alt+L'], icon: 'type', ask: () => Dialogs.charShape(), run: (a) => Fmt.applyCharProps(a) });
  def('서식', 'para-shape', '문단 모양…', { keys: ['Alt+T'], ask: () => Dialogs.paraShape(), run: (a) => Fmt.applyParaProps(a) });
  def('서식', 'bold', '진하게', { keys: ['Ctrl+B', 'Alt+Shift+B'], icon: 'bold', active: (s) => s.bold, run: () => Fmt.toggle('bold') });
  def('서식', 'italic', '기울임', { keys: ['Ctrl+I', 'Alt+Shift+I'], icon: 'italic', active: (s) => s.italic, run: () => Fmt.toggle('italic') });
  def('서식', 'underline', '밑줄', { keys: ['Ctrl+U', 'Alt+Shift+U'], icon: 'underline', active: (s) => s.underline, run: () => Fmt.toggle('underline') });
  def('서식', 'strike', '취소선', { icon: 'strikethrough', active: (s) => s.strike, run: () => Fmt.toggle('strike') });
  def('서식', 'sup', '위 첨자', { keys: ['Alt+Shift+P'], icon: 'superscript', active: (s) => s.sup, run: () => Fmt.toggle('sup') });
  def('서식', 'sub', '아래 첨자', { keys: ['Alt+Shift+S'], icon: 'subscript', active: (s) => s.sub, run: () => Fmt.toggle('sub') });
  def('서식', 'normal-char', '보통 모양', { keys: ['Alt+Shift+C'], run: () => Fmt.normalChar() });
  def('서식', 'size-up', '글자 크게', { keys: ['Alt+Shift+E'], run: () => Fmt.sizeStep(1) });
  def('서식', 'size-down', '글자 작게', { keys: ['Alt+Shift+R'], run: () => Fmt.sizeStep(-1) });
  def('서식', 'spacing-wide', '자간 넓게', { keys: ['Alt+Shift+W'], run: () => Fmt.spacingStep(1) });
  def('서식', 'ratio-narrow', '장평 좁게', { keys: ['Alt+Shift+J'], run: () => Ratio.step(-1) });
  def('서식', 'ratio-wide', '장평 넓게', { keys: ['Alt+Shift+K'], run: () => Ratio.step(1) });
  def('서식', 'spacing-narrow', '자간 좁게', { keys: ['Alt+Shift+N'], run: () => Fmt.spacingStep(-1) });
  def('서식', 'lh-up', '줄 간격 넓게', { keys: ['Alt+Shift+Z'], run: () => Fmt.lineHeightStep(10) });
  def('서식', 'lh-down', '줄 간격 좁게', { keys: ['Alt+Shift+A'], run: () => Fmt.lineHeightStep(-10) });
  def('서식', 'font', '글꼴', { run: (a) => Fmt.font(a.font) });
  def('서식', 'size', '글자 크기', { run: (a) => Fmt.size(a.size) });
  def('서식', 'color', '글자 색', { icon: 'baseline', run: (a) => Fmt.color(a.color) });
  def('서식', 'highlight', '형광펜', { icon: 'highlighter', run: (a) => Fmt.highlight(a.color) });
  def('서식', 'align-justify', '양쪽 정렬', { keys: ['Ctrl+Shift+M'], icon: 'align-justify', active: (s) => s.align === 'justify', run: () => Fmt.align('justify') });
  def('서식', 'align-left', '왼쪽 정렬', { keys: ['Ctrl+Shift+L'], icon: 'align-left', active: (s) => s.align === 'left', run: () => Fmt.align('left') });
  def('서식', 'align-center', '가운데 정렬', { keys: ['Ctrl+Shift+C'], icon: 'align-center', active: (s) => s.align === 'center', run: () => Fmt.align('center') });
  def('서식', 'align-right', '오른쪽 정렬', { keys: ['Ctrl+Shift+R'], icon: 'align-right', active: (s) => s.align === 'right', run: () => Fmt.align('right') });
  def('서식', 'align-distribute', '배분 정렬', { keys: ['Ctrl+Shift+T'], icon: 'align-horizontal-distribute-center', active: (s) => s.align === 'distribute', run: () => Fmt.align('distribute') });
  def('서식', 'line-height', '줄 간격', { run: (a) => Fmt.lineHeight(a.pct) });
  def('서식', 'indent-first', '첫 줄 들여쓰기', { keys: ['Ctrl+F6'], icon: 'indent-increase', run: () => Fmt.indentStep(1) });
  def('서식', 'outdent-first', '첫 줄 내어쓰기', { keys: ['Ctrl+F5'], icon: 'indent-decrease', run: () => Fmt.indentStep(-1) });
  def('서식', 'margin-inc', '왼쪽 여백 늘리기', { keys: ['Ctrl+Alt+F6'], run: () => Fmt.marginStep(10) });
  def('서식', 'margin-dec', '왼쪽 여백 줄이기', { keys: ['Ctrl+Alt+F5'], run: () => Fmt.marginStep(-10) });
  def('서식', 'bullets', '글머리표 적용/해제', { keys: ['Ctrl+Shift+Delete'], icon: 'list', run: () => Lists.toggle('ul') });
  def('서식', 'numbering', '문단 번호 적용/해제', { keys: ['Ctrl+Shift+Insert'], icon: 'list-ordered', run: () => Lists.toggle('ol') });
  def('서식', 'numbering-shape', '문단 번호 모양…', { keys: ['Ctrl+K,N'], ask: () => Lists.numberingDialog(), run: (a) => Lists.applyNumbering(a) });
  def('서식', 'bullet-shape', '글머리표 모양…', { keys: ['Ctrl+K,B'], ask: () => Lists.bulletDialog(), run: (a) => Lists.applyBullet(a.ch) });
  def('서식', 'num-restart', '문단 번호 새로 시작…', { ask: () => Lists.restartDialog(), run: (a) => Lists.applyNumbering({ restart: true, start: a.start }) });
  def('서식', 'list-deeper', '한 수준 증가', { keys: ['Ctrl+NumSub'], run: () => Lists.levelChange(true) });
  def('서식', 'list-shallower', '한 수준 감소', { keys: ['Ctrl+NumAdd'], run: () => Lists.levelChange(false) });
  def('서식', 'style-dlg', '스타일…', { keys: ['F6'], ask: () => Dialog.form('스타일', [{ name: 'style', label: '스타일', type: 'select', value: (Fmt.state() || {}).style || '바탕글', options: STYLES.map((s, i) => [s, `${s}  (Ctrl+${i === 0 ? 1 : i === 1 ? 2 : i + 1})`]) }], { okLabel: '설정', width: 320 }), run: (a) => Fmt.setStyle(a.style) });
  STYLES.forEach((s, i) => def('서식', 'style-' + i, `스타일: ${s}`, { keys: [`Ctrl+${i + 1}`], hidden: true, run: () => Fmt.setStyle(s) }));

  // ================= 쪽 =================
  def('쪽', 'page-number', '쪽 번호 매기기…', { keys: ['Ctrl+N,P'], ask: () => Dialogs.pageNumber(), run: (a) => App.setDocSetting('pageNum', a.pos === 'none' ? null : { pos: a.pos, fmt: a.fmt || 'digit', deco: a.deco || 'plain', side: a.deco === 'side', start: Math.max(1, Math.round(a.start || 1)), hideFirst: !!a.hideFirst, font: a.font || '함초롬바탕', size: a.size > 0 ? a.size : 9, bold: !!a.bold, color: a.color || '#000000' }) });
  def('쪽', 'page-hide', '현재 쪽만 감추기…', { ask: () => PageNum.hideDialog(), run: (a) => PageNum.insertHide(a.hide) });
  def('쪽', 'page-newnum', '새 번호로 시작…', { ask: () => PageNum.newNumDialog(), run: (a) => PageNum.insertNew(a.start) });
  def('쪽', 'header-footer', '머리말/꼬리말…', { keys: ['Ctrl+N,H'], ask: () => { const f = HF.focusNext; HF.focusNext = null; return HF.dialog(f); }, run: (a) => HF.set(a) });

  // ================= 표 =================
  def('표', 'row-col-insert', '줄/칸 추가하기…', { keys: ['Alt+Insert'], enabled: inTable, ask: () => Dialogs.rowColInsert(), run: (a) => { const n = a.count || 1; ({ below: () => Table.insertRow(true, n), above: () => Table.insertRow(false, n), right: () => Table.insertCol(true, n), left: () => Table.insertCol(false, n) })[a.where](); } });
  def('표', 'row-add', '아래에 줄 추가', { enabled: inTable, run: () => Table.insertRow(true) });
  def('표', 'col-add', '오른쪽에 칸 추가', { enabled: inTable, run: () => Table.insertCol(true) });
  def('표', 'row-col-delete', '줄/칸 지우기…', { keys: ['Alt+Delete'], enabled: inTable, ask: () => Dialogs.rowColDelete(), run: (a) => (a.what === 'col' ? Table.deleteCol() : Table.deleteRow()) });
  def('표', 'cell-block', '셀 블록', { keys: ['F5'], enabled: inTable, noHistory: true, run: () => Table.block.start() });
  def('표', 'cell-merge', '셀 합치기', { keyLabel: 'M (셀 블록)', enabled: () => Table.block.active(), run: () => Table.merge() });
  def('표', 'cell-split', '셀 나누기…', { keyLabel: 'S (셀 블록)', enabled: inTable, ask: () => Dialogs.splitCell(), run: (a) => Table.split(a.rows, a.cols) });
  def('표', 'cell-props', '셀 테두리/배경…', { keyLabel: 'L (셀 블록)', enabled: inTable, ask: () => Dialogs.cellProps(), run: (a) => Table.applyCellProps(cellPropsArgs(a)) });
  def('표', 'cell-valign-top', '셀 세로 정렬: 위', { enabled: inTable, checked: () => Table.cellVAlign() === 'top', run: () => Table.applyCellProps({ valign: 'top' }) });
  def('표', 'cell-valign-middle', '셀 세로 정렬: 가운데', { enabled: inTable, checked: () => Table.cellVAlign() === 'middle', run: () => Table.applyCellProps({ valign: 'middle' }) });
  def('표', 'cell-valign-bottom', '셀 세로 정렬: 아래', { enabled: inTable, checked: () => Table.cellVAlign() === 'bottom', run: () => Table.applyCellProps({ valign: 'bottom' }) });
  def('표', 'equal-width', '셀 너비를 같게', { keyLabel: 'W (셀 블록)', enabled: inTable, run: () => Table.equalWidths() });
  def('표', 'equal-height', '셀 높이를 같게', { keyLabel: 'H (셀 블록)', enabled: inTable, run: () => Table.equalHeights() });
  def('표', 'cell-resize', '셀 크기 조절', { hidden: true, run: (a) => (a.dx ? Table.resizeCols(a.dx) : Table.resizeRows(a.dy)) });
  def('표', 'cell-resize-keep', '셀 크기 조절 (표 크기 유지)', { hidden: true, run: (a) => Table.resizeKeep(a.dx || 0, a.dy || 0) });
  def('표', 'cell-resize-only', '선택한 셀만 크기 조절', { hidden: true, run: (a) => Table.resizeCellsOnly(a.dx || 0, a.dy || 0) });
  def('표', 'cell-clear', '셀 내용 지우기', { hidden: true, run: () => Table.block.clearContents() });
  def('표', 'table-split', '표 나누기', { keys: ['Ctrl+N,A'], enabled: inTable, run: () => Table.splitTable() });
  def('표', 'table-join', '표 붙이기', { keys: ['Ctrl+N,Z'], enabled: inTable, run: () => Table.joinTable() });
  def('표', 'table-props', '표 속성 (크기·여백·배치)…', { keys: ['Ctrl+N,K'], enabled: inTable, ask: () => Look.tableDialog(), run: (a) => Look.applyTable(a) });
  def('표', 'table-delete', '표 지우기', { enabled: inTable, run: () => Table.remove() });
  def('표', 'cell-next', '다음 셀', { hidden: true, noHistory: false, run: (a) => Table.moveCell(!a || a.forward !== false) });

  // ================= 그림 =================
  def('그림', 'image-props', '그림 속성…', { enabled: () => !!Img.selected, ask: () => (Img.selected ? Dialogs.imageProps(Img.selected) : null), run: (a) => { const el = Img.selected; if (a.reset) Img.resetSize(); else Img.setSizeMM(null, a.w, a.hh); Img.setWrap(null, a.wrap); if (el) { Look.set(el, a); Img.drawBox(); } } });
  def('그림', 'image-caption', '캡션 넣기/고치기…', { keys: ['Ctrl+N,C'], enabled: () => !!Img.selected && Img.selected.tagName === 'IMG', ask: () => Img.captionDialog(), run: (a) => Img.setCaptions(a) });
  def('그림', 'image-wrap', '그림 배치', { hidden: true, run: (a) => Shapes.setWrap(a.wrap) });

  // ================= 글상자·도형·배치 =================
  const drawCmd = (kind) => () => { if (Shapes.drawing) Shapes.cancelDraw(); Shapes.startDraw(kind); };
  def('입력', 'textbox', '글상자', { keys: ['Ctrl+N,B'], icon: 'textbox', noHistory: true, run: drawCmd('textbox') });
  def('입력', 'shape-line', '직선', { icon: 'sh-line', noHistory: true, run: drawCmd('line') });
  def('입력', 'shape-arrow', '화살표', { icon: 'sh-arrow', noHistory: true, run: drawCmd('arrow') });
  def('입력', 'shape-darrow', '양쪽 화살표', { icon: 'sh-darrow', noHistory: true, run: drawCmd('darrow') });
  def('입력', 'shape-rect', '직사각형', { icon: 'sh-rect', noHistory: true, run: drawCmd('rect') });
  def('입력', 'shape-roundrect', '둥근 사각형', { icon: 'sh-roundrect', noHistory: true, run: drawCmd('roundrect') });
  def('입력', 'shape-ellipse', '타원', { icon: 'sh-ellipse', noHistory: true, run: drawCmd('ellipse') });
  def('입력', 'shape-triangle', '삼각형', { icon: 'sh-triangle', noHistory: true, run: drawCmd('triangle') });
  def('입력', 'shape-insert', '도형 넣기 (커서 자리)', { hidden: true, run: (a) => Shapes.insertAtCaret(a.kind) });
  def('입력', 'shape-menu', '도형', { icon: 'shapes', noHistory: true, hidden: true, run: () => App.showShapeMenu() });
  const hasTarget = () => !!Shapes.target();
  const wrapCmd = (w, label) => def('입력', 'wrap-' + w, label, { enabled: hasTarget, checked: () => Shapes.currentWrap() === w, run: () => Shapes.setWrap(w) });
  wrapCmd('inline', '배치: 글자처럼 취급');
  wrapCmd('left', '배치: 어울림 (왼쪽)');
  wrapCmd('right', '배치: 어울림 (오른쪽)');
  wrapCmd('front', '배치: 글 앞으로');
  wrapCmd('behind', '배치: 글 뒤로');
  def('입력', 'shape-text', '도형 안에 글자 넣기', { enabled: () => Shapes.canHaveText(Img.selected), noHistory: true, run: () => Shapes.addText(Img.selected) });
  def('입력', 'obj-group', '개체 묶기', { keyLabel: 'Ctrl+G', enabled: () => Img.selection().length > 1, run: () => Shapes.group() });
  def('입력', 'obj-ungroup', '개체 풀기', { keys: ['Ctrl+Shift+G'], enabled: () => !!Img.selected && Img.selected.dataset.kind === 'group', run: () => Shapes.ungroup() });
  def('입력', 'obj-wrap', '개체 배치', { hidden: true, run: (a) => Shapes.setWrap(a.wrap) });
  def('입력', 'object-props', '개체 속성…', { enabled: () => Shapes.isObj(Img.selected), ask: () => (Shapes.isObj(Img.selected) ? Dialogs.shapeProps(Img.selected) : null), run: (a) => { const el = Img.selected; Shapes.applyProps(el, a); if (el) { Look.set(el, a); Img.drawBox(); } } });

  // ================= 도구 =================
  def('도구', 'macro-record', '매크로 정의 (기록 시작/끝)', { keys: ['Alt+Shift+H'], icon: 'circle-dot', noHistory: true, run: () => Macro.defineDialog() });
  def('도구', 'macro-run', '매크로 실행…', { keys: ['Alt+Shift+L'], noHistory: true, run: () => Macro.runDialog() });
  for (let i = 0; i < 10; i++) def('도구', 'macro-' + (i + 1), `매크로 ${i + 1} 실행`, { keys: [`Alt+Shift+${(i + 1) % 10}`], hidden: true, noHistory: true, run: () => Macro.play(i) });
  def('도구', 'mm-make', '메일머지 만들기…', { keys: ['Alt+M'], icon: 'mail', noHistory: true, run: () => Merge.makeDialog() });
  def('도구', 'mm-datadoc', '메일머지 자료 문서 만들기…', { noHistory: true, run: () => Merge.dataDocDialog() });
  def('도구', 'default-font', '기본 글꼴 설정…', { noHistory: true, run: () => App.defaultFontDialog() });
  def('도구', 'shortcuts', '단축키 목록', { keys: ['F1'], icon: 'keyboard', noHistory: true, run: () => Dialogs.shortcuts() });
  def('도구', 'about', '누리글 정보', { noHistory: true, run: () => Dialogs.about() });

  function cellPropsArgs(a) {
    const out = { valign: a.valign, tableAlign: a.tableAlign, bg: a.bgOn ? a.bg : '' };
    if (a.bgImg !== undefined) { out.bgImg = a.bgImg; out.bgMode = a.bgMode || 'stretch'; out.bgSpan = a.bgSpan || 'each'; }
    if (a.diag && a.diag !== 'keep') out.diag = { dir: a.diag, color: a.dColor, width: a.dWidth > 0 && a.dWidth < 0.3 ? 1 : Math.max(1, Math.round((+a.dWidth || 0.12) * 96 / 25.4 * 2) / 2) };
    if (a.bApply && !a.bAll) { // 예전 모양(매크로)
      a.bAll = a.bApply;
      a.bLine = { kind: a.bStyle || 'solid', mm: (+a.bWidth || 1) <= 1 ? 0.12 : Math.round(+a.bWidth * 25.4 / 96 * 100) / 100, color: a.bColor || '#000000' };
    }
    const keep = { kind: 'keep' };
    const sp = { top: keep, bottom: keep, left: keep, right: keep, inH: keep, inV: keep };
    if (a.bAll && a.bAll !== 'keep') {
      const line = a.bAll === 'none' ? { kind: 'none' } : { ...a.bLine, kind: a.bLine.kind === 'keep' || a.bLine.kind === 'none' ? 'solid' : a.bLine.kind };
      if (a.bAll === 'all' || a.bAll === 'outer' || a.bAll === 'none') Object.assign(sp, { top: line, bottom: line, left: line, right: line });
      if (a.bAll === 'all' || a.bAll === 'inner' || a.bAll === 'none') Object.assign(sp, { inH: line, inV: line });
    }
    for (const [k, n] of [['top', 'bTop'], ['bottom', 'bBottom'], ['left', 'bLeft'], ['right', 'bRight'], ['inH', 'bInH'], ['inV', 'bInV']]) {
      if (a[n] && a[n].kind !== 'keep') sp[k] = a[n];
    }
    if (Object.values(sp).some((x) => x.kind !== 'keep')) out.borders = sp;
    return out;
  }

  // ---------- 실행 ----------
  async function run(id) {
    const c = byId.get(id);
    if (!c) return;
    if (c.enabled && !c.enabled()) { status(`'${c.label}'은(는) 지금 사용할 수 없습니다.`); return; }
    let args;
    if (c.ask) {
      args = await c.ask();
      if (args == null) return;
    }
    return exec(id, args);
  }
  async function exec(id, args, opts = {}) {
    const c = byId.get(id);
    if (!c) return;
    if (!opts.fromMacro) Macro.cmd(id, args);
    if (!c.noHistory) History.checkpoint();
    // 편집기 선택 복원 보장
    if (!Sel.inEditor() && !c.noHistory && !Table.block.active()) Sel.editor.focus({ preventScroll: true });
    let r;
    try {
      if (ColBlock.active && c.group === '서식') {
        await ColBlock.each(() => c.run(args));
      } else if (MultiSel.active && c.group === '서식') {
        await MultiSel.each(() => c.run(args));
      } else if (Table.block.active() && c.group === '서식') {
        // 셀 블록에 서식 적용: 셀마다 내용 전체를 선택해 실행
        const cells = Table.block.cells();
        Sel.editor.focus({ preventScroll: true });
        for (const td of cells) {
          const rg = document.createRange();
          rg.selectNodeContents(td);
          Sel.set(rg);
          await c.run(args);
        }
        window.getSelection().removeAllRanges();
        Sel.editor.blur();
        Table.block.paint();
      } else r = await c.run(args);
    } catch (e) {
      console.error(e);
      toast(`${c.label} 실패: ${e.message}`);
    }
    if (!c.noHistory) App.changed();
    App.updateToolbar();
    return r;
  }

  function groups() {
    const g = [];
    for (const c of list) {
      let grp = g.find((x) => x.name === c.group);
      if (!grp) g.push((grp = { name: c.group, items: [] }));
      if (!c.hidden || c.keys) grp.items.push(c);
    }
    return g;
  }

  return {
    run, exec, groups, list,
    get: (id) => byId.get(id),
    forKey: (k) => keyMap.get(k),
    isChordPrefix: (k) => chordPrefixes.has(k),
  };
})();

// 셀 테두리 적용 확장 (바깥쪽만)
(function patchCellBorder() {
  const orig = Table.applyCellProps.bind(Table);
  Table.applyCellProps = function (p) {
    if (p.border && p.border.mode === 'outer' && Table.block.active()) {
      const g = Table.grid(Table.block.table);
      const rc = Table.block.rect();
      const cells = g.cells.filter((x) => x.r >= rc.r1 && x.r <= rc.r2 && x.c >= rc.c1 && x.c <= rc.c2);
      const v = `${p.border.width}px ${p.border.style} ${p.border.color}`;
      for (const x of cells) {
        if (x.r === rc.r1) x.el.style.borderTop = v;
        if (x.r + x.rs - 1 === rc.r2) x.el.style.borderBottom = v;
        if (x.c === rc.c1) x.el.style.borderLeft = v;
        if (x.c + x.cs - 1 === rc.c2) x.el.style.borderRight = v;
      }
      const rest = { ...p };
      delete rest.border;
      return orig(rest);
    }
    return orig(p);
  };
})();

// ---------------- 편집 보조 ----------------
const Editing = {
  deleteLine() {
    const s = window.getSelection();
    if (!Sel.inEditor()) return;
    s.collapseToStart();
    s.modify('move', 'backward', 'lineboundary');
    s.modify('extend', 'forward', 'lineboundary');
    if (s.toString() === '') s.modify('extend', 'forward', 'character');
    else s.modify('extend', 'forward', 'character');
    document.execCommand('delete');
  },
  deleteToEol() {
    const s = window.getSelection();
    if (!Sel.inEditor()) return;
    s.collapseToStart();
    s.modify('extend', 'forward', 'lineboundary');
    if (s.toString()) document.execCommand('delete');
  },
  deleteWord() {
    const s = window.getSelection();
    if (!Sel.inEditor()) return;
    s.collapseToStart();
    s.modify('extend', 'forward', 'word');
    document.execCommand('delete');
  },
  pageBreak() {
    const r = Sel.range();
    if (!r) return;
    const pb = h('div', { class: 'pagebreak', contenteditable: 'false' });
    const block = blockOf(r.startContainer);
    if (!block || block === Sel.editor || block.tagName === 'TD') { Sel.editor.append(pb); Para.ensure(); return; }
    const top0 = block.closest('li') ? block.closest('ul,ol') : block;
    const txt = (rg) => rg.toString().replace(/\u200b/g, '');
    const beforeR = document.createRange(); beforeR.setStartBefore(block.firstChild || block); beforeR.setEnd(r.startContainer, r.startOffset);
    const afterR = document.createRange(); afterR.setStart(r.endContainer, r.endOffset); afterR.setEndAfter(block.lastChild || block);
    const hasObj = (rg) => { const f = rg.cloneContents(); return !!f.querySelector && !!f.querySelector('img,.nobj,table'); };
    // 빈 문단에서: 그 빈 문단째 다음 쪽으로 (한글: 엔터 뒤 Ctrl+Enter면 빈 줄이 다음 쪽 첫 줄)
    if (r.collapsed && !txt(beforeR) && !txt(afterR) && !hasObj(beforeR) && !hasObj(afterR) && top0.previousElementSibling && !top0.previousElementSibling.classList.contains('pagebreak')) {
      top0.before(pb);
      Sel.caretInto(block);
      return;
    }
    // 문단 끝에서: 빈 문단을 만들지 않고 다음 문단을 다음 쪽으로 (한글처럼)
    if (r.collapsed && !txt(afterR) && !hasObj(afterR) && top0.nextElementSibling && !top0.nextElementSibling.classList.contains('pagebreak')) {
      const nx = top0.nextElementSibling;
      top0.after(pb);
      Sel.caretInto(nx.matches('ul,ol') ? (nx.querySelector('li') || nx) : nx);
      return;
    }
    // 문단 맨 앞에서: 이 문단을 통째로 다음 쪽으로
    if (r.collapsed && !txt(beforeR) && !hasObj(beforeR) && (txt(afterR) || hasObj(afterR)) && top0.previousElementSibling) {
      top0.before(pb);
      Sel.caretInto(block);
      return;
    }
    // 커서 위치에서 문단을 나누고 사이에 쪽 나누기
    const after = r.cloneRange();
    after.collapse(true);
    after.setEndAfter(block.lastChild || block);
    const frag = after.extractContents();
    const tail = block.cloneNode(false);
    tail.append(frag);
    if (!tail.textContent.replace(/​/g, '') && !tail.querySelector('img,br')) tail.append(h('br'));
    if (!block.textContent && !block.querySelector('img,.nobj')) block.innerHTML = '<br>';
    const top = block.closest('li') ? block.closest('ul,ol') : block;
    top.after(pb);
    pb.after(tail);
    Sel.caretInto(tail);
  },
  link(a) {
    if (!a || !a.url) return;
    const text = a.text || a.url;
    const r = Sel.range();
    if (!r) return;
    r.deleteContents();
    const el = h('a', { href: a.url }, text);
    r.insertNode(el);
    const nr = document.createRange();
    nr.setStartAfter(el);
    nr.collapse(true);
    Sel.set(nr);
  },
};

// ---------------- 찾기 / 바꾸기 ----------------
const Find = {
  query: '', repl: '', caseSens: false, backward: false, dlg: null,
  index() {
    const nodes = [];
    let str = '';
    let lastBlock = null;
    const w = document.createTreeWalker(Sel.editor, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const b = blockOf(n);
      if (lastBlock && b !== lastBlock) str += '\n';
      lastBlock = b;
      nodes.push({ node: n, start: str.length });
      str += n.nodeValue;
    }
    return { nodes, str };
  },
  posToIndex(idx, node, offset) {
    if (node.nodeType !== 3) {
      // 요소 기준 위치 → 가장 가까운 텍스트 노드
      const r = document.createRange();
      r.setStart(node, offset);
      for (const x of idx.nodes) {
        const c = r.comparePoint(x.node, 0);
        if (c >= 0) return x.start;
      }
      return idx.str.length;
    }
    const x = idx.nodes.find((y) => y.node === node);
    return x ? x.start + offset : 0;
  },
  rangeFor(idx, a, b) {
    const loc = (i, isEnd) => {
      for (let k = idx.nodes.length - 1; k >= 0; k--) {
        const x = idx.nodes[k];
        if (x.start <= i && (isEnd ? i <= x.start + x.node.length : i < x.start + x.node.length || k === idx.nodes.length - 1)) return { node: x.node, off: i - x.start };
      }
      return null;
    };
    const s = loc(a, false), e = loc(b, true);
    if (!s || !e) return null;
    const r = document.createRange();
    r.setStart(s.node, Math.min(s.off, s.node.length));
    r.setEnd(e.node, Math.min(e.off, e.node.length));
    return r;
  },
  // 찾을 식 만들기: 조건식(정규식)·온전한 낱말·대소문자
  regex(q) {
    let src = this.useRegex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (this.wholeWord) src = `(?<![\\p{L}\\p{N}_])(?:${src})(?![\\p{L}\\p{N}_])`;
    try { return new RegExp(src, 'gmu' + (this.caseSens ? '' : 'i')); }
    catch (e) { status('조건식이 올바르지 않습니다: ' + e.message); return null; }
  },
  matches(q, idx) {
    const re = this.regex(q);
    if (!re) return [];
    const out = [];
    for (const m of idx.str.matchAll(re)) {
      if (!m[0].length) continue;
      out.push({ s: m.index, e: m.index + m[0].length, m });
    }
    return out;
  },
  search(q, { backward = this.backward, from } = {}) {
    if (!q) return null;
    const idx = this.index();
    const all = this.matches(q, idx);
    if (!all.length) return null;
    const r = Sel.range();
    let pos;
    if (from != null) pos = from;
    else if (r) pos = backward ? this.posToIndex(idx, r.startContainer, r.startOffset) : this.posToIndex(idx, r.endContainer, r.endOffset);
    else pos = backward ? idx.str.length : 0;
    let hit = backward ? [...all].reverse().find((x) => x.s < pos) : all.find((x) => x.s >= pos && !(r && !r.collapsed && x.e === pos));
    let wrapped = false;
    if (!hit) { hit = backward ? all[all.length - 1] : all[0]; wrapped = true; }
    return { range: this.rangeFor(idx, hit.s, hit.e), wrapped, count: all.length };
  },
  next() {
    if (!this.query) { this.open(false); return; }
    const res = this.search(this.query);
    if (!res || !res.range) { status(`"${this.query}"을(를) 찾을 수 없습니다.`); return false; }
    Sel.set(res.range);
    App.scrollToSelection();
    status((res.wrapped ? (this.backward ? '문서 끝부터 다시 찾았습니다. ' : '문서 처음부터 다시 찾았습니다. ') : '') + `모두 ${res.count}곳`);
    return true;
  },
  // 찾은 글자를 바꿀 내용으로 ($1, $2 … 로 괄호 부분 쓰기 가능)
  replacementFor(text) {
    if (!this.useRegex) return this.repl;
    const re = this.regex(this.query);
    if (!re) return this.repl;
    re.lastIndex = 0;
    return text.replace(new RegExp(re.source, re.flags.replace('g', '')), this.repl);
  },
  replaceOne() {
    const r = Sel.range();
    const cur = r ? r.toString() : '';
    let ok = false;
    if (r && !r.collapsed && cur) {
      const re = this.regex(this.query);
      if (re) { const m = new RegExp(`^(?:${re.source})$`, re.flags.replace('g', '')); ok = m.test(cur); }
    }
    if (ok) {
      History.checkpoint();
      document.execCommand('insertText', false, this.replacementFor(cur));
      App.changed();
    }
    return this.next();
  },
  replaceAll() {
    if (!this.query) return 0;
    const idx = this.index();
    const hits = this.matches(this.query, idx);
    if (!hits.length) return 0;
    History.checkpoint();
    for (let k = hits.length - 1; k >= 0; k--) {
      const h0 = hits[k];
      const r = this.rangeFor(idx, h0.s, h0.e);
      if (!r) continue;
      const rep = this.useRegex ? h0.m[0].replace(new RegExp(this.regex(this.query).source, this.regex(this.query).flags.replace('g', '')), this.repl) : this.repl;
      r.deleteContents();
      if (rep) r.insertNode(document.createTextNode(rep));
    }
    Sel.editor.normalize();
    App.changed();
    return hits.length;
  },
  open(withReplace) {
    if (this.dlg && !this.dlg.closed) { this.dlg.close(); }
    const sel = window.getSelection().toString();
    if (sel && !sel.includes('\n')) this.query = sel;
    const q = h('input', { type: 'text', value: this.query });
    const rp = h('input', { type: 'text', value: this.repl });
    const cs = h('input', { type: 'checkbox' }); cs.checked = this.caseSens;
    const dir = h('select', {}, h('option', { value: 'f' }, '아래로'), h('option', { value: 'b' }, '위로'));
    dir.value = this.backward ? 'b' : 'f';
    const rx = h('input', { type: 'checkbox' }); rx.checked = !!this.useRegex;
    const ww = h('input', { type: 'checkbox' }); ww.checked = !!this.wholeWord;
    const sync = () => { this.query = q.value; this.repl = rp.value; this.caseSens = cs.checked; this.backward = dir.value === 'b'; this.useRegex = rx.checked; this.wholeWord = ww.checked; };
    const help = h('div', { class: 'note', style: { gridColumn: '1 / -1', marginTop: 0 } },
      '조건식 예: \\d+ (숫자) · [가-힣]+ (한글 낱말) · (주|월)요일 · ^제\\d+장 (문단 처음) · \\s{2,} (빈칸 여러 개). 바꿀 내용에 $1, $2로 괄호 부분을 쓸 수 있습니다.');
    const form = h('div', { class: 'form' },
      h('label', {}, '찾을 내용'), q,
      withReplace ? h('label', {}, '바꿀 내용') : null, withReplace ? rp : null,
      h('label', {}, '찾을 방향'), dir,
      h('label', {}, '대소문자 구별'), cs,
      h('label', {}, '온전한 낱말'), ww,
      h('label', {}, '조건식 사용'), rx,
      help);
    help.style.display = rx.checked ? '' : 'none';
    rx.addEventListener('change', () => (help.style.display = rx.checked ? '' : 'none'));
    const buttons = [{ label: '다음 찾기', primary: true, onClick: () => { sync(); this.next(); return false; } }];
    if (withReplace) {
      buttons.push({ label: '바꾸기', onClick: () => { sync(); this.replaceOne(); return false; } });
      buttons.push({ label: '모두 바꾸기', onClick: () => { sync(); const n = this.replaceAll(); status(`${n}개를 바꾸었습니다.`); toast(`${n}개를 바꾸었습니다.`); return false; } });
    }
    buttons.push({ label: '닫기' });
    this.dlg = Dialog.open({ title: withReplace ? '찾아 바꾸기' : '찾기', body: form, modeless: true, width: 420, buttons, keepSelection: false });
  },
};
