// 키 매크로: 기록(Alt+Shift+H) / 실행(Alt+Shift+L, Alt+Shift+1~0)
'use strict';
const Macro = {
  slots: Array(10).fill(null),
  recording: null,
  playing: false,

  async load() {
    let data = null;
    try { data = window.native ? await window.native.loadMacros() : JSON.parse(localStorage.getItem('nurigeul-macros') || 'null'); } catch { data = null; }
    if (data && Array.isArray(data.slots)) this.slots = Array.from({ length: 10 }, (_, i) => data.slots[i] || null);
    if (window.native) window.native.on('macros:changed', (d) => { if (d && d.slots) this.slots = d.slots; });
  },
  async save() {
    const data = { version: 1, slots: this.slots };
    try {
      if (window.native) await window.native.saveMacros(data);
      else localStorage.setItem('nurigeul-macros', JSON.stringify(data));
    } catch (e) { toast('매크로 저장 실패: ' + e.message); }
  },
  slotKey(i) { return `Alt+Shift+${(i + 1) % 10}`; },

  // ----- 기록 -----
  start(slot, name) {
    this.recording = { slot, name: name || `매크로 ${slot + 1}`, steps: [] };
    this.updateUI();
    status(`매크로 기록을 시작합니다. 끝내려면 Alt+Shift+H를 누르세요.`);
  },
  async stop() {
    const rec = this.recording;
    if (!rec) return;
    this.recording = null;
    this.updateUI();
    if (!rec.steps.length) { status('기록된 동작이 없어 매크로를 저장하지 않았습니다.'); return; }
    this.slots[rec.slot] = { name: rec.name, steps: rec.steps, created: new Date().toISOString() };
    await this.save();
    toast(`"${rec.name}" 매크로를 저장했습니다 (${this.slotKey(rec.slot)}, 동작 ${rec.steps.length}개).`);
  },
  cancel() { this.recording = null; this.updateUI(); status('매크로 기록을 취소했습니다.'); },
  get active() { return !!this.recording && !this.playing; },
  push(step) {
    if (!this.active) return;
    this.recording.steps.push(step);
    this.updateUI();
  },
  text(t) {
    if (!this.active || !t) return;
    const steps = this.recording.steps;
    const last = steps[steps.length - 1];
    if (last && last.t === 'text') last.v += t;
    else steps.push({ t: 'text', v: t });
    this.updateUI();
  },
  input(type) { this.push({ t: 'input', v: type }); },
  nav(e) {
    const last = this.active && this.recording.steps[this.recording.steps.length - 1];
    const step = { t: 'nav', key: e.key, shift: e.shiftKey || undefined, ctrl: e.ctrlKey || undefined };
    if (last && last.t === 'nav' && last.key === step.key && last.shift === step.shift && last.ctrl === step.ctrl) { last.n = (last.n || 1) + 1; this.updateUI(); return; }
    this.push(step);
  },
  cmd(id, args) {
    if (/^macro-/.test(id)) return;
    this.push(args === undefined ? { t: 'cmd', id } : { t: 'cmd', id, args });
  },
  updateUI() {
    const st = $('#st-macro');
    if (st) st.textContent = this.recording ? `● 매크로 기록 중 (${this.recording.steps.length})` : '';
    const btn = $('#tb-macro');
    if (btn) btn.classList.toggle('active', !!this.recording);
  },

  // ----- 실행 -----
  async play(slot, times = 1) {
    const m = this.slots[slot];
    if (!m) { status(`${this.slotKey(slot)}에 저장된 매크로가 없습니다.`); return; }
    if (this.recording) { status('매크로 기록 중에는 실행할 수 없습니다.'); return; }
    this.playing = true;
    History.checkpoint();
    Sel.editor.focus({ preventScroll: true });
    try {
      for (let n = 0; n < times; n++) {
        for (const s of m.steps) await this.runStep(s);
      }
    } catch (e) {
      toast('매크로 실행 중 오류: ' + e.message);
    } finally {
      this.playing = false;
      App.changed();
    }
    status(`"${m.name}" 매크로를 ${times > 1 ? times + '번 ' : ''}실행했습니다.`);
  },
  async runStep(s) {
    const sel = window.getSelection();
    switch (s.t) {
      case 'text':
        document.execCommand('insertText', false, s.v);
        break;
      case 'input': {
        const map = { insertParagraph: 'insertParagraph', insertLineBreak: 'insertLineBreak', deleteContentBackward: 'delete', deleteContentForward: 'forwardDelete' };
        if (map[s.v]) document.execCommand(map[s.v]);
        else if (s.v === 'deleteWordBackward') { sel.modify('extend', 'backward', 'word'); document.execCommand('delete'); }
        else if (s.v === 'deleteWordForward') { sel.modify('extend', 'forward', 'word'); document.execCommand('forwardDelete'); }
        break;
      }
      case 'nav': {
        const alter = s.shift ? 'extend' : 'move';
        const n = s.n || 1;
        const g = {
          ArrowLeft: ['backward', s.ctrl ? 'word' : 'character'], ArrowRight: ['forward', s.ctrl ? 'word' : 'character'],
          ArrowUp: ['backward', s.ctrl ? 'paragraph' : 'line'], ArrowDown: ['forward', s.ctrl ? 'paragraph' : 'line'],
          Home: ['backward', s.ctrl ? 'documentboundary' : 'lineboundary'], End: ['forward', s.ctrl ? 'documentboundary' : 'lineboundary'],
          PageUp: ['backward', 'line', 20], PageDown: ['forward', 'line', 20],
        }[s.key];
        if (g) for (let i = 0; i < n * (g[2] || 1); i++) sel.modify(alter, g[0], g[1]);
        break;
      }
      case 'cmd':
        await Commands.exec(s.id, s.args, { fromMacro: true });
        break;
    }
    Para.ensure();
  },

  // ----- 대화상자 -----
  async defineDialog() {
    if (this.recording) { await this.stop(); return; }
    const firstEmpty = this.slots.findIndex((s) => !s);
    const v = await Dialog.form('매크로 정의 (키 매크로 기록)', [
      { name: 'slot', label: '매크로 번호', type: 'select', value: firstEmpty < 0 ? 0 : firstEmpty, options: this.slots.map((s, i) => [i, `${this.slotKey(i)}  ${s ? '— ' + s.name + ' (덮어쓰기)' : '— 비어 있음'}`]) },
      { name: 'name', label: '매크로 이름', type: 'text', value: '', autofocus: true },
    ], { okLabel: '기록 시작', width: 420, note: '기록을 시작한 뒤 글자 입력, 방향키, 서식·표 명령 등을 수행하세요. Alt+Shift+H를 다시 누르면 기록이 끝나고 저장됩니다.' });
    if (!v) return;
    const slot = +v.slot;
    this.start(slot, v.name.trim() || `매크로 ${slot + 1}`);
  },
  runDialog() {
    let sel = Math.max(0, this.slots.findIndex((s) => s));
    const list = h('div', { class: 'list', tabindex: 0, style: { height: '260px' } });
    const times = h('input', { type: 'number', min: 1, max: 9999, value: 1, style: { width: '80px' } });
    const info = h('div', { class: 'note' });
    const render = () => {
      list.innerHTML = '';
      this.slots.forEach((s, i) => {
        const li = h('div', { class: 'li' + (i === sel ? ' sel' : '') },
          h('span', { style: { width: '92px', color: '#1d3f7a', fontFamily: 'Consolas, monospace' } }, this.slotKey(i)),
          h('span', { style: { flex: 1 } }, s ? s.name : '(비어 있음)'),
          h('span', { class: 'muted' }, s ? `동작 ${s.steps.length}` : ''));
        li.addEventListener('click', () => { sel = i; render(); });
        li.addEventListener('dblclick', () => { sel = i; runIt(); });
        list.append(li);
      });
      const s = this.slots[sel];
      info.textContent = s ? summarize(s.steps) : '';
    };
    list.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { sel = Math.min(9, sel + 1); render(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); render(); e.preventDefault(); }
    });
    const runIt = () => { const n = Math.max(1, +times.value || 1); api.close(); setTimeout(() => this.play(sel, n), 0); };
    const body = h('div', {}, list, h('div', { class: 'row', style: { marginTop: '10px' } }, h('span', {}, '반복 횟수'), times), info);
    const api = Dialog.open({
      title: '매크로 실행 (Alt+Shift+L)', width: 520, body,
      buttons: [
        { label: '실행', primary: true, onClick: () => { runIt(); return false; } },
        { label: '이름 바꾸기', onClick: async () => {
          const s = this.slots[sel]; if (!s) return false;
          const v = await Dialog.form('매크로 이름 바꾸기', [{ name: 'name', label: '이름', value: s.name }]);
          if (v && v.name.trim()) { s.name = v.name.trim(); await this.save(); render(); }
          return false;
        } },
        { label: '편집', onClick: async () => {
          const s = this.slots[sel]; if (!s) return false;
          const v = await Dialog.form('매크로 편집 (고급)', [{ name: 'json', label: '동작 목록', type: 'textarea', rows: 14, value: JSON.stringify(s.steps, null, 1) }], { width: 560, note: 'text: 글자 입력, input: Enter/지우기, nav: 커서 이동, cmd: 명령. 형식을 지켜 수정하세요.' });
          if (v) {
            try { const steps = JSON.parse(v.json); if (!Array.isArray(steps)) throw new Error('배열이 아닙니다'); s.steps = steps; await this.save(); render(); }
            catch (e) { Dialog.alert('형식이 올바르지 않습니다: ' + e.message); }
          }
          return false;
        } },
        { label: '지우기', onClick: async () => {
          if (!this.slots[sel]) return false;
          this.slots[sel] = null; await this.save(); render(); return false;
        } },
        { label: '닫기' },
      ],
    });
    render();
  },
};

function summarize(steps) {
  const parts = steps.slice(0, 12).map((s) => {
    if (s.t === 'text') return `"${s.v.length > 20 ? s.v.slice(0, 20) + '…' : s.v}"`;
    if (s.t === 'input') return { insertParagraph: 'Enter', insertLineBreak: 'Shift+Enter', deleteContentBackward: 'BkSp', deleteContentForward: 'Del' }[s.v] || s.v;
    if (s.t === 'nav') return (s.ctrl ? 'Ctrl+' : '') + (s.shift ? 'Shift+' : '') + s.key.replace('Arrow', '') + (s.n > 1 ? '×' + s.n : '');
    if (s.t === 'cmd') { const c = Commands.get(s.id); return '[' + (c ? c.label : s.id) + ']'; }
    return '?';
  });
  return parts.join(' → ') + (steps.length > 12 ? ' …' : '');
}
