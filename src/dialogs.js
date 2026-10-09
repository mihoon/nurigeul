// 대화상자
'use strict';
const Dialog = {
  stack: [],
  open({ title, body, buttons = [], modeless = false, width, onClose, keepSelection = true }) {
    const savedSel = keepSelection ? Sel.save() : null;
    const back = h('div', { class: 'dlg-backdrop' + (modeless ? ' modeless' : '') });
    const closeBtn = h('button', { class: 'x', title: '닫기 (Esc)', html: ICONS.x });
    const head = h('div', { class: 'dlg-head' }, h('span', { class: 't' }, title), closeBtn);
    const bodyEl = h('div', { class: 'dlg-body' }, body);
    const foot = h('div', { class: 'dlg-foot' });
    const dlg = h('div', { class: 'dlg', role: 'dialog', 'aria-label': title, style: width ? { width: width + 'px' } : {} }, head, bodyEl);
    const api = {
      el: dlg, body: bodyEl, closed: false,
      close(result) {
        if (api.closed) return;
        api.closed = true;
        back.remove();
        Dialog.stack = Dialog.stack.filter((x) => x !== api);
        if (onClose) onClose(result);
        if (!Dialog.stack.length) {
          Sel.editor.focus({ preventScroll: true });
          if (savedSel) Sel.restore(savedSel);
        }
      },
      restoreSel() { if (savedSel) Sel.restore(savedSel); },
      savedSel,
    };
    let primary = null;
    buttons.forEach((b) => {
      const btn = h('button', { class: 'btn' + (b.primary ? ' primary' : ''), type: 'button' }, b.label);
      btn.addEventListener('click', async () => {
        const r = b.onClick ? await b.onClick(api) : undefined;
        if (r !== false) api.close(b.value);
      });
      if (b.primary) primary = btn;
      if (b.id) api[b.id] = btn;
      foot.append(btn);
    });
    if (buttons.length) dlg.append(foot);
    closeBtn.addEventListener('click', () => api.close(null));
    back.append(dlg);
    $('#dialogs').append(back);
    Dialog.stack.push(api);
    // 키 처리
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); api.close(null); }
      else if (e.key === 'Enter' && primary && !e.isComposing && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && !e.target.closest('.no-enter')) {
        e.preventDefault(); e.stopPropagation(); primary.click();
      }
      e.stopPropagation();
    });
    // 끌어서 옮기기
    let drag = null;
    head.addEventListener('mousedown', (e) => {
      if (e.target.closest('.x')) return;
      const r = dlg.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      dlg.style.position = 'fixed';
      dlg.style.margin = '0';
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!drag) return;
      dlg.style.left = Math.max(0, e.clientX - drag.dx) + 'px';
      dlg.style.top = Math.max(0, e.clientY - drag.dy) + 'px';
    });
    window.addEventListener('mouseup', () => (drag = null));
    if (modeless) {
      const r = () => {
        dlg.style.position = 'fixed';
        dlg.style.right = '40px';
        dlg.style.top = '140px';
      };
      r();
    }
    setTimeout(() => {
      const f = bodyEl.querySelector('[autofocus]') || bodyEl.querySelector('input:not([type=hidden]):not([disabled]), select, textarea, .list');
      if (f) { f.focus(); if (f.select) f.select(); } else if (primary) primary.focus();
    }, 0);
    return api;
  },

  // 간단한 입력 양식
  form(title, fields, { okLabel = '확인', note, width, onChange } = {}) {
    return new Promise((resolve) => {
      const form = h('div', { class: 'form' });
      const inputs = {};
      for (const f of fields) {
        if (f.type === 'section') { form.append(h('div', { style: { gridColumn: '1 / -1', fontWeight: 'bold', marginTop: '6px' } }, f.label)); continue; }
        let inp;
        if (f.type === 'select') {
          inp = h('select', {}, f.options.map((o) => {
            const [v, l] = Array.isArray(o) ? o : [o, o];
            return h('option', { value: v, selected: String(v) === String(f.value) }, l);
          }));
        } else if (f.type === 'checkbox') {
          inp = h('input', { type: 'checkbox' });
          inp.checked = !!f.value;
        } else if (f.type === 'quad') {
          // 위·아래·왼쪽·오른쪽 네 칸 (값 순서: 위, 오른쪽, 아래, 왼쪽)
          const v = f.value || [0, 0, 0, 0];
          const mk = (i) => { const x = h('input', { type: 'number', step: f.step || 0.1, min: f.min != null ? f.min : 0 }); x.value = v[i]; return x; };
          const ins = [mk(0), mk(1), mk(2), mk(3)];
          inp = h('div', { class: 'quad' }, h('span', { class: 'muted' }, '위'), ins[0], h('span', { class: 'muted' }, '아래'), ins[2], h('span', { class: 'muted' }, '왼쪽'), ins[3], h('span', { class: 'muted' }, '오른쪽'), ins[1]);
          inp._quad = ins;
        } else if (f.type === 'border') {
          // 선 하나: 종류 + 굵기(mm, 직접 입력) + 색(#RRGGBB 직접 입력)
          const v = f.value || {};
          const kind = h('select', {}, [['keep', '바꾸지 않음'], ...Table.BORDER_KINDS.map((k) => [k[0], k[1]]), ['none', '없음']].map(([a, b]) => h('option', { value: a, selected: a === (v.kind || 'keep') }, b)));
          const w = h('input', { type: 'number', min: 0.05, max: 10, step: 0.01, list: 'dl-border-mm', style: { width: '78px' } });
          w.value = v.mm != null ? v.mm : 0.12;
          const col = colorWithHex(v.color || '#000000');
          inp = h('div', { class: 'row border-row' }, kind, w, h('span', { class: 'muted' }, 'mm'), col.el);
          inp._b = { kind, w, col: col.input };
          // 굵기나 색을 고치면 '바꾸지 않음'을 자동으로 실선으로
          const touch = () => { if (kind.value === 'keep' || kind.value === 'none') kind.value = 'solid'; };
          w.addEventListener('input', touch); col.input.addEventListener('input', touch); col.text.addEventListener('input', touch);
        } else if (f.type === 'color') {
          const col = colorWithHex(f.value || '#000000');
          inp = col.input;
          inputs[f.name] = inp;
          const lab = h('label', {}, f.label);
          form.append(lab, col.el);
          continue;
        } else if (f.type === 'image') {
          // 그림 고르기: 미리보기 + [그림 고르기…] [없애기]. 값: null(그대로) / ''(없앰) / data URL
          const prev = h('span', { class: 'img-prev' });
          const show = () => {
            prev.textContent = '';
            if (inp._img === null) prev.append(h('span', { class: 'muted' }, f.keepLabel || '바꾸지 않음'));
            else if (!inp._img) prev.append(h('span', { class: 'muted' }, '없음'));
            else prev.append(h('img', { src: inp._img, style: { maxWidth: '72px', maxHeight: '40px', verticalAlign: 'middle', border: '1px solid #ccc' } }));
          };
          const pickBtn = h('button', { type: 'button' }, '그림 고르기…');
          const clearBtn = h('button', { type: 'button' }, '없애기');
          inp = h('div', { class: 'row', style: { gap: '6px', alignItems: 'center' } }, prev, pickBtn, clearBtn);
          inp._img = f.value === undefined ? null : f.value;
          pickBtn.addEventListener('click', async () => {
            const files = await window.native.openDialog('image', false);
            if (!files || !files.length) return;
            inp._img = bytesToDataURL(files[0].data, mimeFromName(files[0].name));
            show();
            inp.dispatchEvent(new Event('input'));
          });
          clearBtn.addEventListener('click', () => { inp._img = ''; show(); inp.dispatchEvent(new Event('input')); });
          show();
        } else if (f.type === 'textarea') {
          inp = h('textarea', { rows: f.rows || 4 });
          inp.value = f.value || '';
        } else {
          inp = h('input', { type: f.type || 'text', min: f.min, max: f.max, step: f.step, list: f.list, placeholder: f.placeholder || '' });
          inp.value = f.value != null ? f.value : '';
        }
        inputs[f.name] = inp;
        if (f.autofocus) inp.setAttribute('autofocus', '');
        const lab = h('label', {}, f.label);
        const cell = f.suffix ? h('div', { class: 'row' }, inp, h('span', { class: 'muted' }, f.suffix)) : inp;
        form.append(lab, cell);
      }
      if (onChange) for (const [n, inp] of Object.entries(inputs)) inp.addEventListener(inp.tagName === 'SELECT' || inp.type === 'checkbox' ? 'change' : 'input', () => onChange(n, inputs));
      const body = h('div', {}, form, note ? h('div', { class: 'note' }, note) : null);
      const read = () => {
        const out = {};
        for (const f of fields) {
          const inp = inputs[f.name];
          if (!inp) continue;
          if (f.type === 'quad') out[f.name] = inp._quad.map((x) => +x.value || 0);
          else if (f.type === 'border') out[f.name] = { kind: inp._b.kind.value, mm: Math.max(0.05, +inp._b.w.value || 0.12), color: inp._b.col.value };
          else if (f.type === 'checkbox') out[f.name] = inp.checked;
          else if (f.type === 'image') out[f.name] = inp._img;
          else if (f.type === 'number') out[f.name] = inp.value === '' ? null : +inp.value;
          else out[f.name] = inp.value;
        }
        return out;
      };
      let result = null;
      Dialog.open({
        title, body, width,
        buttons: [
          { label: okLabel, primary: true, onClick: () => { result = read(); } },
          { label: '취소' },
        ],
        onClose: () => resolve(result),
      });
    });
  },

  alert(msg, title = '누리글') {
    return new Promise((res) => Dialog.open({ title, body: h('div', { style: { whiteSpace: 'pre-wrap', maxWidth: '480px' } }, msg), buttons: [{ label: '확인', primary: true }], onClose: res }));
  },
};

// ---------------- 개별 대화상자 ----------------
const FONT_LIST = ['함초롬바탕', '함초롬돋움', '맑은 고딕', '바탕', '돋움', '굴림', '궁서', '나눔고딕', '나눔명조', '나눔바른고딕', 'Noto Sans KR', 'Noto Serif KR', 'Arial', 'Times New Roman', 'Courier New', 'Consolas'];

const Dialogs = {
  async charShape() {
    const st = Fmt.state();
    if (!st) return null;
    return Dialog.form('글자 모양', [
      { name: 'font', label: '글꼴', type: 'select', options: fontOptions(st.font), value: st.font },
      { name: 'size', label: '기준 크기', type: 'number', value: st.size, min: 1, max: 4096, step: 0.5, suffix: 'pt' },
      { name: 'letterSpacing', label: '자간', type: 'number', value: st.letterSpacing, min: -50, max: 50, suffix: '%' },
      { name: 'ratio', label: '장평', type: 'number', value: st.ratio, min: 50, max: 200, suffix: '%' },
      { name: 'color', label: '글자 색', type: 'color', value: st.color },
      { name: 'shadeOn', label: '음영 사용', type: 'checkbox', value: false },
      { name: 'shade', label: '음영 색', type: 'color', value: '#ffff00' },
      { type: 'section', label: '속성' },
      { name: 'bold', label: '진하게', type: 'checkbox', value: st.bold },
      { name: 'italic', label: '기울임', type: 'checkbox', value: st.italic },
      { name: 'underline', label: '밑줄', type: 'checkbox', value: st.underline },
      { name: 'strike', label: '취소선', type: 'checkbox', value: st.strike },
      { name: 'sup', label: '위 첨자', type: 'checkbox', value: st.sup },
      { name: 'sub', label: '아래 첨자', type: 'checkbox', value: st.sub },
      { type: 'section', label: '효과' },
      { name: 'shadow', label: '그림자', type: 'checkbox', value: !!st.shadow },
      { name: 'shadowColor', label: '그림자 색', type: 'color', value: st.shadow || '#999999' },
      { name: 'outline', label: '외곽선 (속이 빈 글자)', type: 'checkbox', value: st.outline },
      { name: 'border', label: '글자 테두리', type: 'checkbox', value: !!st.border },
      { name: 'borderColor', label: '테두리 색', type: 'color', value: st.border || '#000000' },
    ], { okLabel: '설정', width: 380 }).then((v) => {
      if (!v) return null;
      v.shade = v.shadeOn ? v.shade : undefined;
      delete v.shadeOn;
      return v;
    });
  },
  async paraShape() {
    const b = Sel.block();
    if (!b) return null;
    const cs = getComputedStyle(b);
    const st = Fmt.state();
    const pt = (v) => Math.round(U.px2pt(parseFloat(v) || 0) * 10) / 10;
    return Dialog.form('문단 모양', [
      { name: 'align', label: '정렬 방식', type: 'select', value: st.align === 'start' ? 'justify' : st.align, options: [['justify', '양쪽 정렬'], ['left', '왼쪽 정렬'], ['center', '가운데 정렬'], ['right', '오른쪽 정렬'], ['distribute', '배분 정렬']] },
      // 한글처럼: 왼쪽 여백 = 첫 줄이 시작하는 자리 기준 (내어쓰기는 둘째 줄부터 그만큼 더 들어감)
      { name: 'left', label: '왼쪽 여백', type: 'number', value: Math.max(0, Math.round((pt(cs.marginLeft) - Math.max(0, -pt(cs.textIndent))) * 10) / 10), step: 1, min: 0, suffix: 'pt' },
      { name: 'right', label: '오른쪽 여백', type: 'number', value: pt(cs.marginRight), step: 1, suffix: 'pt' },
      { name: 'indent', label: '첫 줄 (들여쓰기+/내어쓰기−)', type: 'number', value: pt(cs.textIndent), step: 1, suffix: 'pt' },
      { name: 'lineHeight', label: '줄 간격', type: 'number', value: st.lineHeight, min: 50, max: 500, step: 5, suffix: '%' },
      { name: 'before', label: '문단 위', type: 'number', value: Math.round((pt(cs.marginTop) + pt(cs.paddingTop)) * 10) / 10, step: 1, min: 0, suffix: 'pt' },
      { name: 'after', label: '문단 아래', type: 'number', value: Math.round((pt(cs.marginBottom) + pt(cs.paddingBottom)) * 10) / 10, step: 1, min: 0, suffix: 'pt' },
    ], { okLabel: '설정', width: 400 }).then((v) => (v ? { ...v, hwpLeft: true } : v));
  },
  async pageSetup() {
    const p = App.page;
    const customs = (App.settings.customPapers || []).slice();
    const std = [['A4', 'A4 (210×297)'], ['A3', 'A3 (297×420)'], ['B4', 'B4 (257×364)'], ['B5', 'B5 (182×257)'], ['A5', 'A5 (148×210)'], ['Letter', 'Letter (216×279)'], ['Legal', 'Legal (216×356)']];
    const sizes = [...std, ...customs.map((c) => ['c:' + c.name, `★ ${c.name} (${c.w}×${c.h})`]), ['custom', '사용자 정의 (직접 입력)']];
    const short = Math.min(p.width, p.height), long = Math.max(p.width, p.height);
    const sizeOf = (key) => (PAPER[key] ? PAPER[key] : key.startsWith('c:') ? (() => { const c = customs.find((x) => 'c:' + x.name === key); return c ? [c.w, c.h] : null; })() : null);
    const found = sizes.find(([k]) => { const d = sizeOf(k); return d && Math.abs(Math.min(...d) - short) < 0.6 && Math.abs(Math.max(...d) - long) < 0.6; });
    const v = await Dialog.form('편집 용지 (F7)', [
      { name: 'paper', label: '용지 종류', type: 'select', options: sizes, value: found ? found[0] : 'custom' },
      { name: 'w', label: '폭', type: 'number', value: short, step: 0.1, suffix: 'mm' },
      { name: 'hh', label: '길이', type: 'number', value: long, step: 0.1, suffix: 'mm' },
      { name: 'orient', label: '용지 방향', type: 'select', options: [['portrait', '세로'], ['landscape', '가로']], value: p.width > p.height ? 'landscape' : 'portrait' },
      { type: 'section', label: '용지 여백' },
      { name: 'top', label: '위쪽', type: 'number', value: p.top, step: 0.5, suffix: 'mm' },
      { name: 'bottom', label: '아래쪽', type: 'number', value: p.bottom, step: 0.5, suffix: 'mm' },
      { name: 'left', label: '왼쪽', type: 'number', value: p.left, step: 0.5, suffix: 'mm' },
      { name: 'right', label: '오른쪽', type: 'number', value: p.right, step: 0.5, suffix: 'mm' },
      { name: 'header', label: '머리말', type: 'number', value: p.header, step: 0.5, suffix: 'mm' },
      { name: 'footer', label: '꼬리말', type: 'number', value: p.footer, step: 0.5, suffix: 'mm' },
      { type: 'section', label: '저장' },
      { name: 'saveName', label: '용지 이름으로 저장', type: 'text', value: '', placeholder: '예: 주보 용지 (비워 두면 저장 안 함)' },
      { name: 'delCustom', label: '고른 ★ 용지를 목록에서 지우기', type: 'checkbox', value: false },
      { name: 'asDefault', label: '이 용지·여백을 새 문서 기본값으로', type: 'checkbox', value: false },
    ], {
      okLabel: '설정', width: 440,
      note: '용지 종류를 고르면 폭과 길이가 바뀝니다. 폭·길이·여백을 정하고 이름을 넣으면 ★ 사용자 정의 용지로 저장되어 다음부터 목록에 나오고, 고르면 저장한 여백도 함께 들어갑니다.',
      onChange: (name, inputs) => {
        if (name === 'paper') {
          const d = sizeOf(inputs.paper.value);
          if (d) { inputs.w.value = Math.min(...d); inputs.hh.value = Math.max(...d); }
          // ★ 사용자 용지는 함께 저장한 여백·방향도 되살림
          const c = inputs.paper.value.startsWith('c:') && customs.find((x) => 'c:' + x.name === inputs.paper.value);
          if (c && c.m) {
            for (const k of ['top', 'bottom', 'left', 'right', 'header', 'footer']) if (c.m[k] != null && inputs[k]) inputs[k].value = c.m[k];
            if (c.orient && inputs.orient) inputs.orient.value = c.orient;
          }
        } else if (name === 'w' || name === 'hh') {
          inputs.paper.value = 'custom';
        }
      },
    });
    if (!v) return null;
    let [w, hh] = [v.w, v.hh];
    if (!(w > 0 && hh > 0)) { const d = sizeOf(v.paper) || [210, 297]; [w, hh] = d; }
    const name = (v.saveName || '').trim();
    let list = customs;
    if (v.delCustom && v.paper.startsWith('c:')) list = list.filter((c) => 'c:' + c.name !== v.paper);
    if (name) list = [...list.filter((c) => c.name !== name), { name, w: Math.min(w, hh), h: Math.max(w, hh), orient: v.orient, m: { top: v.top, bottom: v.bottom, left: v.left, right: v.right, header: v.header, footer: v.footer } }];
    if (v.orient === 'landscape') [w, hh] = [Math.max(w, hh), Math.min(w, hh)];
    else [w, hh] = [Math.min(w, hh), Math.max(w, hh)];
    const page = { width: w, height: hh, top: v.top, bottom: v.bottom, left: v.left, right: v.right, header: v.header, footer: v.footer };
    const patch = {};
    if (name || v.delCustom) patch.customPapers = list;
    if (v.asDefault) { patch.defaultPage = { ...page }; Object.assign(DEFAULT_PAGE, page); }
    if (Object.keys(patch).length) {
      await App.saveSettings(patch);
      toast([name ? `'${name}' 용지를 저장했습니다.` : '', v.asDefault ? '새 문서 기본 용지·여백으로 저장했습니다.' : ''].filter(Boolean).join(' ') || '용지 목록을 고쳤습니다.');
    }
    return page;
  },
  tableCreate() {
    return new Promise((resolve) => {
      let rows = 3, cols = 3;
      const rIn = h('input', { type: 'number', min: 1, max: 500, value: rows });
      const cIn = h('input', { type: 'number', min: 1, max: 60, value: cols });
      const hdr = h('input', { type: 'checkbox' });
      const grid = h('div', { class: 'table-grid-pick' });
      const cellsEl = [];
      let armed = false; // 대화상자가 커서 아래에 뜰 때 값이 바뀌지 않도록 실제 움직임 뒤에만 반응
      let lastXY = null;
      grid.addEventListener('mousemove', (e) => {
        if (lastXY && (Math.abs(e.clientX - lastXY[0]) > 2 || Math.abs(e.clientY - lastXY[1]) > 2)) armed = true;
        lastXY = lastXY || [e.clientX, e.clientY];
      });
      for (let r = 0; r < 8; r++) for (let c = 0; c < 10; c++) {
        const d = h('div');
        d.addEventListener('mousemove', () => { if (!armed) return; rIn.value = r + 1; cIn.value = c + 1; paint(); });
        d.addEventListener('click', () => { result = { rows: r + 1, cols: c + 1, header: hdr.checked }; api.close(); });
        cellsEl.push({ d, r, c });
        grid.append(d);
      }
      const paint = () => cellsEl.forEach(({ d, r, c }) => d.classList.toggle('on', r < +rIn.value && c < +cIn.value));
      rIn.addEventListener('input', paint); cIn.addEventListener('input', paint);
      paint();
      let result = null;
      const body = h('div', {},
        h('div', { class: 'form' }, h('label', {}, '줄 개수'), rIn, h('label', {}, '칸 개수'), cIn, h('label', {}, '첫 줄 제목 칸'), hdr),
        grid, h('div', { class: 'note' }, '칸을 클릭하면 바로 만들어집니다.'));
      const api = Dialog.open({
        title: '표 만들기', body, width: 300,
        buttons: [{ label: '만들기', primary: true, onClick: () => { result = { rows: +rIn.value, cols: +cIn.value, header: hdr.checked }; } }, { label: '취소' }],
        onClose: () => resolve(result),
      });
    });
  },
  async cellProps() {
    const td = Table.block.active() ? Table.block.cells()[0] : Table.currentCell();
    if (!td) return null;
    const cs = getComputedStyle(td);
    const table = td.closest('table');
    ensureBorderDatalist();
    const cur = Object.fromEntries(['Top', 'Right', 'Bottom', 'Left'].map((S) => [S, Table.sideGet(td, S)]));
    const pick = (x) => ({ mm: x.mm, color: x.color });
    let multiR = false, multiC = false;
    if (Table.block.active()) { const rc = Table.block.rect(); multiR = rc.r2 > rc.r1; multiC = rc.c2 > rc.c1; }
    const v = await Dialog.form('셀 테두리/배경', [
      { name: 'bgOn', label: '배경색 사용', type: 'checkbox', value: !!cssColorToHex(cs.backgroundColor) },
      { name: 'bg', label: '배경색', type: 'color', value: cssColorToHex(cs.backgroundColor) || '#e8edf5' },
      { type: 'section', label: '배경 그림' },
      { name: 'bgImg', label: '그림', type: 'image', value: null, keepLabel: td.dataset.bgmode ? '지금 그림 그대로' : '없음 (그대로)' },
      { name: 'bgMode', label: '채우는 방식', type: 'select', options: [['stretch', '셀 크기에 맞춤 (늘이기)'], ['cover', '비율 유지하며 가득 채우기'], ['center', '가운데 (원래 크기)'], ['tile', '바둑판식']], value: td.dataset.bgmode || 'cover' },
      ...(Table.block.active() && Table.block.cells().length > 1 ? [{ name: 'bgSpan', label: '여러 셀에', type: 'select', options: [['one', '선택한 셀 전체에 하나로 (이어서)'], ['each', '셀마다 따로']], value: 'one' }] : []),
      { type: 'section', label: '테두리 — 한꺼번에' },
      { name: 'bAll', label: '적용할 곳', type: 'select', options: [['keep', '바꾸지 않음'], ['all', '모두 (바깥 + 안쪽)'], ['outer', '바깥쪽만'], ['inner', '안쪽만'], ['none', '테두리 모두 없애기']], value: 'keep' },
      { name: 'bLine', label: '선 (종류·굵기·색)', type: 'border', value: { kind: 'solid', mm: cur.Top.mm, color: cur.Top.color } },
      { type: 'section', label: '테두리 — 변마다 따로' },
      { name: 'bTop', label: '위', type: 'border', value: { kind: 'keep', ...pick(cur.Top) } },
      { name: 'bBottom', label: '아래', type: 'border', value: { kind: 'keep', ...pick(cur.Bottom) } },
      { name: 'bLeft', label: '왼쪽', type: 'border', value: { kind: 'keep', ...pick(cur.Left) } },
      { name: 'bRight', label: '오른쪽', type: 'border', value: { kind: 'keep', ...pick(cur.Right) } },
      ...(multiR ? [{ name: 'bInH', label: '안쪽 가로선', type: 'border', value: { kind: 'keep', ...pick(cur.Bottom) } }] : []),
      ...(multiC ? [{ name: 'bInV', label: '안쪽 세로선', type: 'border', value: { kind: 'keep', ...pick(cur.Right) } }] : []),
      { type: 'section', label: '대각선' },
      { name: 'diag', label: '대각선', type: 'select', options: [['keep', '바꾸지 않음'], ['none', '없음'], ['down', '╲ (왼쪽 위 → 오른쪽 아래)'], ['up', '╱ (왼쪽 아래 → 오른쪽 위)'], ['both', '╳ (둘 다)']], value: 'keep' },
      { name: 'dColor', label: '대각선 색', type: 'color', value: td.dataset.dgc || '#000000' },
      { name: 'dWidth', label: '대각선 굵기', type: 'number', min: 0.05, max: 10, step: 0.01, list: 'dl-border-mm', value: (+td.dataset.dgw || 1) <= 1 ? 0.12 : Math.round(+td.dataset.dgw * 25.4 / 96 * 100) / 100, suffix: 'mm' },
      { type: 'section', label: '정렬' },
      { name: 'valign', label: '세로 정렬', type: 'select', options: [['middle', '가운데'], ['top', '위'], ['bottom', '아래']], value: cs.verticalAlign === 'top' ? 'top' : cs.verticalAlign === 'bottom' ? 'bottom' : 'middle' },
      { name: 'tableAlign', label: '표 위치', type: 'select', options: [['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']], value: table.classList.contains('tbl-center') ? 'center' : table.classList.contains('tbl-right') ? 'right' : 'left' },
    ], { okLabel: '설정', width: 600, note: '굵기는 mm로 직접 적거나 목록에서 고르고, 색은 #RRGGBB 또는 R,G,B로 적을 수 있습니다. 셀 블록(F5)이면 위·아래·왼쪽·오른쪽은 블록의 바깥 변, 안쪽 선은 블록 안의 선입니다. 굵기·색을 고치면 종류가 자동으로 실선이 됩니다.' });
    return v;
  },
  async shapeProps(el) {
    const z = App.zoom;
    const r = el.getBoundingClientRect();
    const d = el.dataset;
    const isLine = d.shape === 'line';
    const isBox = d.kind === 'textbox';
    const sw = String(+d.sw || 0);
    const swOpts = [['0', '없음'], ['1', '0.26 mm'], ['1.5', '0.4 mm'], ['2', '0.5 mm'], ['3', '0.8 mm'], ['4', '1.0 mm'], ['6', '1.6 mm']];
    if (!swOpts.some((o) => o[0] === sw)) swOpts.push([sw, `${U.px2mm(+sw).toFixed(2)} mm`]);
    const fields = [
      { name: 'w', label: '너비', type: 'number', value: U.px2mm(r.width / z).toFixed(1), step: 0.1, suffix: 'mm' },
      { name: 'hh', label: '높이', type: 'number', value: U.px2mm(r.height / z).toFixed(1), step: 0.1, suffix: 'mm' },
      { type: 'section', label: '선' },
      { name: 'stroke', label: '선 색', type: 'color', value: d.stroke || '#000000' },
      { name: 'sw', label: '선 굵기', type: 'select', value: sw, options: swOpts },
    ];
    if (isLine) {
      fields.push({ name: 'arrow', label: '화살표', type: 'select', value: d.at && d.ah ? 'both' : d.at ? 'end' : d.ah ? 'start' : 'none', options: [['none', '없음'], ['end', '끝에'], ['start', '시작에'], ['both', '양쪽']] });
      fields.push({ name: 'dir', label: '방향', type: 'select', value: d.dir || 'dr', options: [['dr', '↘ 왼쪽 위 → 오른쪽 아래'], ['ur', '↗ 왼쪽 아래 → 오른쪽 위']] });
    } else {
      fields.push({ type: 'section', label: '채우기' });
      fields.push({ name: 'fillOn', label: '면 색 채우기', type: 'checkbox', value: !!d.fill && d.fill !== 'none' });
      fields.push({ name: 'fill', label: '면 색', type: 'color', value: d.fill && d.fill !== 'none' ? d.fill : '#ffffff' });
    }
    if (isBox || Shapes.canHaveText(el)) {
      fields.push({ type: 'section', label: '글자' });
      fields.push({ name: 'va', label: '세로 배치', type: 'select', value: d.va || (isBox ? 'top' : 'middle'), options: [['top', '위'], ['middle', '가운데'], ['bottom', '아래']] });
    }
    if (isBox || d.shape === 'rect' || d.shape === 'roundrect') {
      fields.push({ type: 'section', label: '모서리' });
      fields.push({ name: 'rrPreset', label: '모양', type: 'select', value: '', options: [['', '(아래 곡률 값대로)'], ['0', '직각'], ['20', '둥근 모양 (20%)'], ['50', '반원 (50%)']] });
      fields.push({ name: 'rr', label: '곡률', type: 'number', value: Shapes.roundPct(d), min: 0, max: 50, step: 1, suffix: '% (짧은 변 기준, 50 = 반원)' });
    }
    fields.push({ type: 'section', label: '본문과의 배치' });
    fields.push({ name: 'wrap', label: '배치', type: 'select', value: d.wrap || 'inline', options: Shapes.WRAPS });
    fields.push(...Look.fields(el));
    const v = await Dialog.form(isBox ? '글상자 속성' : '도형 속성', fields, {
      okLabel: '설정', width: 460,
      onChange: (n, inputs) => { if (n === 'rrPreset' && inputs.rrPreset.value !== '' && inputs.rr) inputs.rr.value = inputs.rrPreset.value; },
    });
    if (v) v.sw = +v.sw;
    if (v && v.rrPreset) v.rr = +v.rrPreset;
    return v;
  },
  async imageProps(img) {
    const z = App.zoom;
    const r = img.getBoundingClientRect();
    const v = await Dialog.form('그림 속성', [
      { name: 'w', label: '너비', type: 'number', value: U.px2mm(r.width / z).toFixed(1), step: 0.1, suffix: 'mm' },
      { name: 'hh', label: '높이', type: 'number', value: U.px2mm(r.height / z).toFixed(1), step: 0.1, suffix: 'mm' },
      { name: 'keep', label: '비율 유지', type: 'checkbox', value: true },
      { name: 'wrap', label: '배치', type: 'select', value: img.dataset.wrap || 'inline', options: [['inline', '글자처럼 취급'], ['left', '어울림 (왼쪽)'], ['right', '어울림 (오른쪽)'], ['center', '자리 차지 (가운데)'], ['front', '글 앞으로 (자유 이동)'], ['behind', '글 뒤로 (자유 이동)']] },
      { name: 'reset', label: '원래 크기로', type: 'checkbox', value: false },
      ...Look.fields(img),
    ], { okLabel: '설정', width: 460 });
    if (v && v.keep) {
      const ratio = r.width / r.height;
      const origW = U.px2mm(r.width / z), origH = U.px2mm(r.height / z);
      if (Math.abs(v.w - origW) > 0.05) v.hh = v.w / ratio;
      else if (Math.abs(v.hh - origH) > 0.05) v.w = v.hh * ratio;
    }
    return v;
  },
  symbols() {
    const sets = {
      '기호': '※★☆○●◎◇◆□■△▲▽▼→←↑↓↔⇒⇔〓♠♣♥♡♤♧◈▣◐◑▒▤▥▨▧▦▩☏☎☜☞¶†‡↕↗↙↖↘♭♩♪♬㉿㈜№㏇™㏂㏘℡',
      '문장 부호': '、。·‥…¨〃―∥＼∼‘’“”〔〕〈〉《》「」『』【】±×÷≠≤≥∞∴°′″℃Å￠￡￥♂♀∠⊥⌒∂∇≡≒§',
      '원/괄호 문자': '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮㉠㉡㉢㉣㉤㉥㉦㉧㉨㉩㉪㉫㉬㉭㉮㉯㉰㉱㉲㉳㉴㉵㉶㉷㉸㉹㉺㉻⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽㈀㈁㈂㈃㈄㈅㈆㈇㈈㈉㈊㈋㈌㈍㈎㈏㈐㈑㈒㈓㈔㈕㈖㈗㈘㈙㈚㈛',
      '로마/그리스': 'ⅰⅱⅲⅳⅴⅵⅶⅷⅸⅹⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψω',
      '단위': '㎕㎖㎗ℓ㎘㏄㎣㎤㎥㎦㎙㎚㎛㎜㎝㎞㎟㎠㎡㎢㏊㎍㎎㎏㏏㎈㎉㏈㎧㎨㎰㎱㎲㎳㎴㎵㎶㎷㎸㎹㎀㎁㎂㎃㎄㎺㎻㎼㎽㎾㎿㎐㎑㎒㎓㎔Ω㏀㏁㎊㎋㎌㏖㏅㎭㎮㎯㏛㎩㎪㎫㎬㏝㏐㏓㏃㏉㏜㏆',
      '선 문자': '─│┌┐┘└├┬┤┴┼━┃┏┓┛┗┣┳┫┻╋┠┯┨┷┿┝┰┥┸╂',
    };
    return new Promise((resolve) => {
      let result = null;
      const tabs = h('div', { class: 'tabs' });
      const grid = h('div', { class: 'symgrid' });
      const show = (name) => {
        tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.textContent === name));
        grid.innerHTML = '';
        for (const ch of Array.from(sets[name])) {
          const b = h('button', { type: 'button', title: 'U+' + ch.codePointAt(0).toString(16).toUpperCase() }, ch);
          b.addEventListener('click', () => { result = ch; api.close(); });
          grid.append(b);
        }
      };
      Object.keys(sets).forEach((n) => { const b = h('button', { type: 'button' }, n); b.addEventListener('click', () => show(n)); tabs.append(b); });
      show('기호');
      const api = Dialog.open({ title: '문자표 (Ctrl+F10)', body: h('div', {}, tabs, grid), buttons: [{ label: '닫기' }], onClose: () => resolve(result) });
    });
  },
  pageNumber() {
    const on = App.docSettings.pageNum;
    const o = PageNum.opts() || { pos: 'bottom-center', fmt: 'digit', deco: 'side', start: 1, hideFirst: false };
    const st = PageNum.style();
    return Dialog.form('쪽 번호 매기기', [
      { name: 'pos', label: '번호 위치', type: 'select', value: on ? o.pos : 'bottom-center', options: [['none', '쪽 번호 없음'], ['top-left', '위 왼쪽'], ['top-center', '위 가운데'], ['top-right', '위 오른쪽'], ['bottom-left', '아래 왼쪽'], ['bottom-center', '아래 가운데'], ['bottom-right', '아래 오른쪽']] },
      { name: 'fmt', label: '번호 모양', type: 'select', value: o.fmt, options: PageNum.FORMATS.map((f) => [f[0], f[1]]) },
      { name: 'deco', label: '줄표·꾸밈', type: 'select', value: o.deco, options: PageNum.DECOS },
      { name: 'start', label: '시작 번호', type: 'number', value: o.start, min: 1, step: 1 },
      { name: 'hideFirst', label: '첫 쪽에는 번호 감추기', type: 'checkbox', value: o.hideFirst },
      { type: 'section', label: '글자 모양' },
      { name: 'font', label: '글꼴', type: 'select', options: fontOptions(st.font), value: st.font },
      { name: 'size', label: '글자 크기', type: 'number', value: st.size, min: 5, max: 40, step: 0.5, suffix: 'pt' },
      { name: 'bold', label: '진하게', type: 'checkbox', value: st.bold },
      { name: 'color', label: '글자 색', type: 'color', value: st.color },
    ], { okLabel: '넣기', width: 400, note: '중간부터 번호를 다시 매기려면 그 쪽에서 [쪽 → 새 번호로 시작]을 쓰세요. 쪽 번호는 인쇄·PDF와 HWPX·DOCX 파일에 반영됩니다. 머리말·꼬리말과 같은 칸에 넣으면 인쇄할 때 머리말·꼬리말 글자 모양을 따릅니다.' });
  },
  rowColInsert() {
    return Dialog.form('줄/칸 추가하기 (Alt+Insert)', [
      { name: 'where', label: '추가할 곳', type: 'select', value: 'below', options: [['below', '아래쪽에 줄 추가'], ['above', '위쪽에 줄 추가'], ['right', '오른쪽에 칸 추가'], ['left', '왼쪽에 칸 추가']] },
      { name: 'count', label: '개수', type: 'number', value: 1, min: 1, max: 100 },
    ], { okLabel: '추가', width: 320 });
  },
  rowColDelete() {
    return Dialog.form('줄/칸 지우기 (Alt+Delete)', [
      { name: 'what', label: '지울 대상', type: 'select', value: 'row', options: [['row', '줄'], ['col', '칸']] },
    ], { okLabel: '지우기', width: 300, note: '셀 블록이 있으면 블록이 걸친 줄/칸을 모두 지웁니다.' });
  },
  splitCell() {
    return Dialog.form('셀 나누기', [
      { name: 'rows', label: '줄 개수', type: 'number', value: 1, min: 1, max: 50 },
      { name: 'cols', label: '칸 개수', type: 'number', value: 2, min: 1, max: 30 },
    ], { okLabel: '나누기', width: 300, note: '합쳐진 셀은 줄 1, 칸 1로 나누면 원래 모양으로 풀립니다.' });
  },
  goto() {
    return Dialog.form('찾아가기 (Alt+G)', [
      { name: 'page', label: '쪽 번호', type: 'number', value: App.currentPage(), min: 1, max: App.pageCount() },
    ], { okLabel: '가기', width: 280 });
  },
  shortcuts() {
    const rows = [];
    for (const group of Commands.groups()) {
      rows.push(h('tr', { class: 'h' }, h('td', { colspan: 2 }, group.name)));
      for (const c of group.items) if (c.keys) rows.push(h('tr', {}, h('td', { class: 'k' }, c.keys.join(', ')), h('td', {}, c.label)));
    }
    rows.push(h('tr', { class: 'h' }, h('td', { colspan: 2 }, '표 안 / 셀 블록 상태')));
    [['Tab / Shift+Tab', '다음/이전 셀로 이동 (마지막 셀에서 Tab: 줄 추가)'], ['Ctrl+Enter (표 안)', '아래에 줄 추가'], ['F5', '셀 블록 (두 번: 확장, 세 번: 표 전체)'], ['M', '셀 합치기'], ['S', '셀 나누기'], ['L', '셀 테두리/배경'], ['H / W', '셀 높이/너비를 같게'], ['F7 (셀 블록)', '세로 줄(칸) 전체 선택'], ['F8 (셀 블록)', '가로 줄 전체 선택'], ['Ctrl+방향키', '셀 크기 조절 (표 크기도 바뀜)'], ['Alt+방향키', '셀 크기 조절 (표 전체 크기는 그대로)'], ['Shift+방향키', '선택한 셀만 크기 조절'], ['F5 두 번 + 방향키', '셀 블록 넓히기'], ['Delete', '셀 내용 지우기'], ['Esc', '셀 블록 해제']]
      .forEach(([k, l]) => rows.push(h('tr', {}, h('td', { class: 'k' }, k), h('td', {}, l))));
    Dialog.open({ title: '단축키 목록', width: 560, body: h('div', { style: { maxHeight: '64vh', overflow: 'auto' } }, h('table', { class: 'keytable' }, rows)), buttons: [{ label: '닫기', primary: true }] });
  },
  about() {
    Dialog.open({
      title: '누리글 정보', width: 420,
      body: h('div', { style: { lineHeight: 1.7 } },
        h('div', { style: { fontSize: '18px', fontWeight: 'bold' } }, '누리글 1.5.70'),
        h('div', {}, '아래아한글 단축키 체계를 따르는 가벼운 문서 편집기'),
        h('div', { class: 'note' }, 'HWPX 열기/저장 · HWP 열기(HWPX로 변환) · DOCX/PDF 내보내기 · 표 · 그림 · 키 매크로 · 메일머지')),
      buttons: [{ label: '확인', primary: true }],
    });
  },
};

const PAPER = { A4: [210, 297], A3: [297, 420], B4: [257, 364], B5: [182, 257], A5: [148, 210], Letter: [215.9, 279.4], Legal: [215.9, 355.6] };

// 색 고르기 + #RRGGBB(또는 R,G,B) 직접 입력
function colorWithHex(value) {
  const input = h('input', { type: 'color' });
  input.value = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
  const text = h('input', { type: 'text', class: 'hex', maxlength: 16, style: { width: '76px' }, title: '#RRGGBB 또는 R,G,B' });
  text.value = input.value.toUpperCase();
  input.addEventListener('input', () => { text.value = input.value.toUpperCase(); });
  input.addEventListener('change', () => { text.value = input.value.toUpperCase(); text.classList.remove('bad'); });
  // 누르면 기본은 색 팔레트 (팔레트의 '다른 색…'으로 전체 색 고르기)
  input.addEventListener('click', (e) => {
    e.preventDefault();
    ColorPalette.open(input, {
      current: input.value,
      onPick: (c) => {
        if (!c) return;
        input.value = c;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      },
    });
  });
  input.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); input.click(); } });
  const parse = (t) => {
    t = t.trim();
    let m = t.match(/^#?([0-9a-f]{6})$/i);
    if (m) return '#' + m[1].toLowerCase();
    m = t.match(/^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    if (m) return '#' + m[1] + m[1] + m[2] + m[2] + m[3] + m[3];
    m = t.match(/^(?:rgb\()?\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)?$/i);
    if (m && [m[1], m[2], m[3]].every((x) => +x <= 255)) return '#' + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join('');
    return null;
  };
  text.addEventListener('input', () => { const c = parse(text.value); if (c) { input.value = c; input.dispatchEvent(new Event('change')); } text.classList.toggle('bad', !c); });
  return { el: h('div', { class: 'row' }, input, text), input, text };
}
function ensureBorderDatalist() {
  if (document.getElementById('dl-border-mm')) return;
  document.body.append(h('datalist', { id: 'dl-border-mm' }, [0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0].map((v) => h('option', { value: v }))));
}

function fontOptions(cur) {
  const list = Array.from(new Set([...(App.fonts || FONT_LIST), cur].filter(Boolean)));
  return list;
}

// ---------------- 색 고르기 (견본 팔레트) ----------------
const ColorPalette = {
  recent: [],
  BASE: ['#000000', '#ffffff', '#44546a', '#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#7030a0'],
  STD: ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'],
  mix(hex, t) {
    // t>0: 흰색 쪽으로, t<0: 검정 쪽으로
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(t > 0 ? v + (255 - v) * t : v * (1 + t)));
    return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('');
  },
  open(anchor, { current, allowNone, onPick }) {
    this.close();
    const pop = h('div', { class: 'color-pop menu-popup', id: 'color-pop' });
    pop.addEventListener('mousedown', (e) => { if (e.target.tagName !== 'INPUT') e.preventDefault(); });
    const pick = (c) => {
      this.close();
      if (c) { this.recent = [c, ...this.recent.filter((x) => x !== c)].slice(0, 10); }
      onPick(c);
    };
    const sw = (c, title) => {
      const b = h('button', { type: 'button', class: 'csw' + (current && c && current.toLowerCase() === c.toLowerCase() ? ' on' : ''), title: title || c, style: { background: c } });
      b.addEventListener('click', () => pick(c));
      return b;
    };
    const row = (cols) => h('div', { class: 'crow' }, cols.map((c) => sw(c)));
    if (allowNone) {
      const none = h('button', { type: 'button', class: 'cnone' }, '색 없음');
      none.addEventListener('click', () => pick(null));
      pop.append(none);
    }
    pop.append(h('div', { class: 'clabel' }, '테마 색'), row(this.BASE));
    const blackCol = ['#7f7f7f', '#595959', '#404040', '#262626', '#0d0d0d'];
    const whiteCol = ['#f2f2f2', '#d9d9d9', '#bfbfbf', '#a6a6a6', '#808080'];
    [0.8, 0.6, 0.4, -0.25, -0.5].forEach((t, i) => pop.append(row(this.BASE.map((c) => (c === '#000000' ? blackCol[i] : c === '#ffffff' ? whiteCol[i] : this.mix(c, t))))));
    pop.append(h('div', { class: 'clabel' }, '기본 색'), row(this.STD));
    if (this.recent.length) pop.append(h('div', { class: 'clabel' }, '최근에 쓴 색'), row(this.recent));
    const more = h('button', { type: 'button', class: 'cmore' }, '다른 색…');
    more.addEventListener('click', () => {
      const inp = $('#color-input');
      inp.value = current && current.startsWith('#') ? current : '#000000';
      inp.onchange = () => pick(inp.value);
      this.close();
      inp.click();
    });
    pop.append(more);
    document.body.append(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.min(r.left - 30, window.innerWidth - 250) + 'px';
    pop.style.top = r.bottom + 4 + 'px';
    setTimeout(() => {
      this._off = (e) => { if (!e.target.closest('#color-pop')) this.close(); };
      document.addEventListener('mousedown', this._off);
    }, 0);
  },
  close() {
    const p = $('#color-pop');
    if (p) p.remove();
    if (this._off) document.removeEventListener('mousedown', this._off);
    this._off = null;
  },
};
