// 문서 탭: 한 창에서 여러 문서 (한글처럼 Alt+N은 새 탭)
'use strict';
const Tabs = {
  docs: [],     // 비활성 문서의 저장된 상태 (활성 문서는 App/편집기에 있음)
  active: 0,
  seq: 0,
  nextUntitled: 1,

  init(untitledStart) {
    this.nextUntitled = untitledStart || 1;
    App.untitled = this.nextUntitled++;
    this.docs = [{ id: ++this.seq, state: null }];
    this.active = 0;
    this.render();
  },

  // 현재 편집 중인 문서 상태를 꺼내기
  capture() {
    Table.block.clear();
    Img.deselect();
    return {
      html: Sel.editor.innerHTML,
      sel: Sel.save() || App.lastSel,
      page: { ...App.page },
      docSettings: JSON.parse(JSON.stringify(App.docSettings)),
      filePath: App.filePath,
      fileName: App.fileName,
      untitled: App.untitled,
      dirty: App.dirty,
      history: History.exportState(),
      scroll: $('#workspace').scrollTop,
    };
  },
  restore(st) {
    App.page = { ...st.page };
    App.docSettings = st.docSettings;
    App.filePath = st.filePath;
    App.fileName = st.fileName;
    App.untitled = st.untitled;
    Sel.editor.innerHTML = st.html;
    History.importState(st.history);
    App.dirty = st.dirty;
    App.layout();
    App.updateTitle();
    Sel.editor.focus({ preventScroll: true });
    if (!Sel.restore(st.sel)) Sel.caretInto(Sel.editor.querySelector('p, td') || Sel.editor);
    $('#workspace').scrollTop = st.scroll || 0;
    App.updateToolbar();
    App.updateStatus();
  },

  // 새 탭 만들기 (opts.html 이 있으면 그 내용으로)
  newDoc(opts = {}) {
    this.docs[this.active].state = this.capture();
    const doc = { id: ++this.seq, state: null };
    this.docs.splice(this.active + 1, 0, doc);
    this.active = this.active + 1;
    App.page = { ...DEFAULT_PAGE, ...(opts.page || {}) };
    App.docSettings = { header: null, footer: null, pageNum: null, ...(opts.settings ? JSON.parse(JSON.stringify(opts.settings)) : {}) };
    App.filePath = null;
    App.fileName = opts.title || null;
    App.untitled = this.nextUntitled++;
    App.setHtml(opts.html || '<p><br></p>');
    App.dirty = !!opts.html;
    $('#workspace').scrollTop = 0;
    App.updateTitle();
    Sel.editor.focus({ preventScroll: true });
    Sel.caretInto(Sel.editor.querySelector('p, td') || Sel.editor);
    this.render();
  },

  switchTo(i) {
    if (i === this.active || i < 0 || i >= this.docs.length) return;
    History.endTyping();
    const fromId = this.docs[this.active].id;
    this.docs[this.active].state = this.capture();
    this.active = i;
    const st = this.docs[i].state;
    this.docs[i].state = null;
    this.restore(st);
    this.render();
    Split.onSwitch(fromId, this.docs[i].id);
  },
  next(dir = 1) {
    if (this.docs.length < 2) return;
    this.switchTo((this.active + dir + this.docs.length) % this.docs.length);
  },

  // 현재 탭 닫기 (저장 확인 포함). 반환: 닫았으면 true
  async closeCurrent() {
    if (App.dirty) {
      const r = await nconfirm(`'${App.displayName()}' 문서가 바뀌었습니다. 저장할까요?`, ['저장', '저장 안 함', '취소']);
      if (r === 2) return false;
      if (r === 0 && !(await App.save())) return false;
    }
    if (this.docs.length === 1) {
      // 마지막 문서면 빈 문서로
      App.page = { ...DEFAULT_PAGE };
      App.docSettings = { header: null, footer: null, pageNum: null };
      App.filePath = null; App.fileName = null;
      App.untitled = this.nextUntitled++;
      App.setHtml('<p><br></p>');
      App.dirty = false;
      App.updateTitle();
      Sel.caretInto(Sel.editor.querySelector('p'));
      this.render();
      return true;
    }
    const closedId = this.docs[this.active].id;
    this.docs.splice(this.active, 1);
    setTimeout(() => Split.onClosed(closedId), 0);
    this.active = Math.min(this.active, this.docs.length - 1);
    const st = this.docs[this.active].state;
    this.docs[this.active].state = null;
    this.restore(st);
    this.render();
    return true;
  },
  async closeAt(i) {
    if (i !== this.active) this.switchTo(i);
    return this.closeCurrent();
  },
  // 창 닫기 전: 바뀐 문서마다 저장 확인
  async confirmAll() {
    for (let i = 0; i < this.docs.length; i++) {
      const dirty = i === this.active ? App.dirty : this.docs[i].state && this.docs[i].state.dirty;
      if (!dirty) continue;
      this.switchTo(i);
      const r = await nconfirm(`'${App.displayName()}' 문서가 바뀌었습니다. 저장할까요?`, ['저장', '저장 안 함', '취소']);
      if (r === 2) return false;
      if (r === 0 && !(await App.save())) return false;
    }
    return true;
  },

  info(i) {
    if (i === this.active) return { name: App.displayName(), dirty: App.dirty, path: App.filePath };
    const st = this.docs[i].state;
    return { name: st.fileName || `빈 문서 ${st.untitled}`, dirty: st.dirty, path: st.filePath };
  },
  render() {
    const bar = $('#doctabs');
    if (!bar) return;
    bar.innerHTML = '';
    this.docs.forEach((d, i) => {
      const inf = this.info(i);
      const tab = h('div', { class: 'dtab' + (i === this.active ? ' on' : ''), title: inf.path || inf.name },
        h('span', { class: 'nm' }, inf.name + (inf.dirty ? ' *' : '')));
      const x = h('button', { class: 'cx', type: 'button', title: '문서 닫기 (Ctrl+F4)' }, '×');
      x.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
      x.addEventListener('click', (e) => { e.stopPropagation(); this.closeAt(i); });
      tab.append(x);
      tab.addEventListener('mousedown', (e) => { if (e.button === 1) { e.preventDefault(); this.closeAt(i); } else if (e.button === 0) { e.preventDefault(); this.switchTo(i); } });
      bar.append(tab);
    });
    bar.querySelectorAll('.dtab').forEach((tab, i) => tab.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      App.closeMenus();
      const pop = App.renderMenu([
        { label: '옆 창에서 보기 (좌우)', run: () => { Split.viewId = this.docs[i].id; Split.open('v'); } },
        { label: '아래 창에서 보기 (위아래)', run: () => { Split.viewId = this.docs[i].id; Split.open('h'); } },
        '-',
        { label: '문서 닫기', run: () => this.closeAt(i) },
      ]);
      pop.id = 'ctxmenu';
      $('#ctxmenu').replaceWith(pop);
      pop.hidden = false;
      document.body.append(pop);
      pop.style.left = Math.min(e.clientX, window.innerWidth - 260) + 'px';
      pop.style.top = Math.max(4, e.clientY - pop.getBoundingClientRect().height - 4) + 'px';
    }));
    const add = h('button', { class: 'dtab-add', type: 'button', title: '새 문서 (Alt+N)' }, '+');
    add.addEventListener('mousedown', (e) => e.preventDefault());
    add.addEventListener('click', () => Commands.run('file-new'));
    bar.append(add);
  },
};
