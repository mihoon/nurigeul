// 창 나누기: 문서 두 개(또는 같은 문서의 다른 부분)를 나란히 보기
// 편집은 한쪽(편집 창)에서 하고, 다른 쪽(보기 창)을 누르면 그 문서가 편집 창으로 바뀐다.
// 문서마다 자기 자리(왼쪽/오른쪽)를 지키도록 두 창의 순서를 바꿔 준다.
'use strict';
const Split = {
  mode: null,      // null | 'v'(좌우) | 'h'(위아래)
  viewId: null,    // 보기 창에 보이는 문서 id
  cssReady: false,

  // #editor 용 스타일을 보기 창(.static-ed)에도 똑같이 적용
  buildCss() {
    if (this.cssReady) return;
    this.cssReady = true;
    const out = [];
    const walk = (rules) => {
      for (const r of rules) {
        if (r.type === CSSRule.STYLE_RULE && r.selectorText.includes('#editor')) {
          const sel = r.selectorText.split(',').filter((x) => x.includes('#editor')).map((x) => x.replace(/#editor/g, '.static-ed')).join(', ');
          out.push(`${sel} { ${r.style.cssText} }`);
        }
      }
    };
    for (const sh of Array.from(document.styleSheets)) {
      try { walk(sh.cssRules); } catch { /* 무시 */ }
    }
    const ed = getComputedStyle(Sel.editor);
    out.push(`.static-ed { font-family: ${ed.fontFamily}; font-size: ${ed.fontSize}; line-height: ${ed.lineHeight === 'normal' ? 1.6 : 1.6}; }`);
    document.head.append(h('style', { id: 'static-ed-css' }, out.join('\n')));
  },

  open(mode) {
    this.buildCss();
    this.mode = mode;
    const panes = $('#panes');
    panes.classList.toggle('split-h', mode === 'h');
    $('#viewpane').hidden = false;
    if (this.viewId == null || this.indexOf(this.viewId) < 0) {
      // 기본: 다른 탭이 있으면 그 문서, 없으면 같은 문서를 한 번 더
      const other = Tabs.docs.findIndex((d, i) => i !== Tabs.active);
      this.viewId = Tabs.docs[other >= 0 ? other : Tabs.active].id;
    }
    this.bind();
    this.render();
    App.layout();
    // 좌우로 나누면 쪽 너비가 창에 들어오도록 배율을 맞춘다 (해제하면 되돌림)
    if (mode === 'v') {
      const fit = Math.floor(($('#workspace').clientWidth - 40) / U.mm2px(App.page.width) * 20) / 20;
      if (fit < App.zoom) { if (this.prevZoom == null) this.prevZoom = App.zoom; App.setZoom(fit); }
    }
    status(mode === 'h' ? '창을 위아래로 나누었습니다.' : '창을 좌우로 나누었습니다.');
  },
  close() {
    this.mode = null;
    this.viewId = null;
    const panes = $('#panes');
    panes.classList.remove('split-h', 'live-second');
    $('#viewpane').hidden = true;
    $('#workspace').classList.remove('pane-active');
    App.layout();
    if (this.prevZoom != null) { App.setZoom(this.prevZoom); this.prevZoom = null; }
  },
  indexOf(id) { return Tabs.docs.findIndex((d) => d.id === id); },

  bind() {
    if (this.bound) return;
    this.bound = true;
    const vp = $('#viewpane');
    vp.querySelector('.vp-close').addEventListener('click', () => this.close());
    vp.querySelector('.vp-sel').addEventListener('change', (e) => { this.viewId = +e.target.value; this.render(true); });
    vp.querySelector('.vp-body').addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const i = this.indexOf(this.viewId);
      if (i < 0 || i === Tabs.active) return; // 같은 문서를 보고 있으면 그냥 보기
      e.preventDefault();
      // 누른 곳 비율을 기억해 두었다가 편집 창에서 비슷한 위치로
      const body = vp.querySelector('.vp-body');
      const ratio = body.scrollTop;
      this.activate(i, ratio);
    });
  },
  // 보기 창의 문서를 편집 창으로 (자리는 그대로)
  activate(i, scrollTop) {
    const prevId = Tabs.docs[Tabs.active].id;
    const viewScroll = $('#viewpane .vp-body').scrollTop;
    const liveScroll = $('#workspace').scrollTop;
    Tabs.switchTo(i); // onSwitch 에서 자리 바꿈 처리
    $('#workspace').scrollTop = scrollTop != null ? scrollTop : viewScroll;
    $('#viewpane .vp-body').scrollTop = liveScroll;
    void prevId;
  },
  // Tabs.switchTo 가 부름: 보기 창 문서로 바꾸면 두 창 자리를 맞바꾼다
  onSwitch(fromId, toId) {
    if (!this.mode) return;
    if (toId === this.viewId) {
      this.viewId = fromId;
      $('#panes').classList.toggle('live-second');
    }
    this.render();
  },
  onClosed(id) {
    if (!this.mode) return;
    if (id === this.viewId) {
      const other = Tabs.docs.findIndex((d, i) => i !== Tabs.active);
      this.viewId = Tabs.docs[other >= 0 ? other : Tabs.active].id;
    }
    this.render();
  },
  refreshSoon: null,
  render(resetScroll) {
    if (!this.mode) return;
    const vp = $('#viewpane');
    const sel = vp.querySelector('.vp-sel');
    sel.innerHTML = '';
    Tabs.docs.forEach((d, i) => sel.append(h('option', { value: d.id, selected: d.id === this.viewId }, Tabs.info(i).name + (i === Tabs.active ? ' (편집 중인 문서)' : ''))));
    const i = this.indexOf(this.viewId);
    if (i < 0) { this.close(); return; }
    const same = i === Tabs.active;
    const st = same ? null : Tabs.docs[i].state;
    const html = same ? Sel.editor.innerHTML : (st ? st.html : '');
    const page = same ? App.page : st.page;
    vp.querySelector('.vp-title').textContent = same ? '같은 문서 보기' : '보기 창';
    vp.querySelector('.vp-hint').textContent = same ? '편집 중인 문서의 다른 부분을 볼 수 있습니다' : '누르면 이 문서를 편집합니다';
    const pg = vp.querySelector('.vp-page');
    pg.style.width = U.mm2px(page.width) + 'px';
    pg.style.padding = `${U.mm2px(page.top + page.header)}px ${U.mm2px(page.right)}px ${U.mm2px(page.bottom + page.footer)}px ${U.mm2px(page.left)}px`;
    pg.style.minHeight = U.mm2px(page.height) + 'px';
    vp.querySelector('.vp-zoom').style.zoom = App.zoom;
    const body = vp.querySelector('.vp-body');
    const keep = body.scrollTop;
    const ed = vp.querySelector('.static-ed');
    if (ed.innerHTML !== html) ed.innerHTML = html;
    ed.querySelectorAll('[contenteditable]').forEach((x) => x.removeAttribute('contenteditable'));
    ed.querySelectorAll('.cell-sel, .selected').forEach((x) => x.classList.remove('cell-sel', 'selected'));
    body.scrollTop = resetScroll ? 0 : keep;
    $('#workspace').classList.toggle('pane-active', true);
  },
};
