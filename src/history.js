// 되돌리기 / 다시 실행 (스냅숏 방식)
'use strict';
const History = (() => {
  const undo = [], redo = [];
  const LIMIT = 300;
  const imgPool = new Map(); // dataURL -> id
  const imgRev = new Map();
  let typing = false, typingKind = '', typingTimer = null;
  let onChange = () => {};

  function intern(url) {
    let id = imgPool.get(url);
    if (id == null) { id = imgPool.size + 1; imgPool.set(url, id); imgRev.set(id, url); }
    return id;
  }
  function pack(html) {
    return html.replace(/src="(data:[^"]+)"/g, (m, u) => `src="@img:${intern(u)}"`);
  }
  function unpack(html) {
    return html.replace(/src="@img:(\d+)"/g, (m, id) => `src="${imgRev.get(+id) || ''}"`);
  }
  function snap() {
    return { html: pack(Sel.editor.innerHTML), sel: Sel.save() };
  }
  function apply(state) {
    Sel.editor.innerHTML = unpack(state.html);
    if (!Sel.restore(state.sel)) {
      const first = Sel.editor.querySelector('p,div,td') || Sel.editor;
      Sel.caretInto(first);
    }
    onChange('history');
  }
  function checkpoint() {
    const s = snap();
    const top = undo[undo.length - 1];
    if (top && top.html === s.html) { top.sel = s.sel; return; }
    undo.push(s);
    if (undo.length > LIMIT) undo.shift();
    redo.length = 0;
  }
  function endTyping() { typing = false; typingKind = ''; clearTimeout(typingTimer); }
  return {
    set onChange(fn) { onChange = fn; },
    checkpoint() { endTyping(); checkpoint(); },
    // 입력(beforeinput) 직전 호출: 연속 입력은 하나로 묶음
    beforeTyping(kind) {
      if (!typing || kind !== typingKind) { checkpoint(); typing = true; typingKind = kind; }
      clearTimeout(typingTimer);
      typingTimer = setTimeout(endTyping, 1200);
    },
    endTyping,
    undo() {
      endTyping();
      if (!undo.length) { status('되돌릴 내용이 없습니다.'); return; }
      const cur = snap();
      let prev = undo.pop();
      while (prev && prev.html === cur.html && undo.length) prev = undo.pop();
      if (prev.html === cur.html) { undo.push(prev); status('되돌릴 내용이 없습니다.'); return; }
      redo.push(cur);
      apply(prev);
    },
    redo() {
      endTyping();
      if (!redo.length) { status('다시 실행할 내용이 없습니다.'); return; }
      const next = redo.pop();
      undo.push(snap());
      apply(next);
    },
    reset() { undo.length = 0; redo.length = 0; endTyping(); },
    exportState() { endTyping(); return { undo: undo.slice(), redo: redo.slice() }; },
    importState(st) { undo.length = 0; redo.length = 0; endTyping(); if (st) { undo.push(...st.undo); redo.push(...st.redo); } },
    get canUndo() { return undo.length > 0; },
    get canRedo() { return redo.length > 0; },
  };
})();
