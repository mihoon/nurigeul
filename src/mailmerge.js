// 메일머지: 표시 달기(Ctrl+K,M), 만들기(Alt+M), 자료 문서 만들기
'use strict';
const Merge = {
  lastData: null, // { fields:[], records:[[]], source }

  fieldEl(name) {
    return h('span', { class: 'mm-field', contenteditable: 'false', 'data-field': name }, `{{${name}}}`);
  },
  insertField(name) {
    name = String(name).trim().replace(/[{}]/g, '');
    if (!name) return;
    const r = Sel.range();
    if (!r) return;
    r.deleteContents();
    const f = this.fieldEl(name);
    r.insertNode(f);
    const after = document.createTextNode(ZWSP);
    f.after(after);
    const nr = document.createRange();
    nr.setStart(after, 1);
    nr.collapse(true);
    Sel.set(nr);
  },
  // {{이름}} 형태 텍스트를 필드로 변환
  convertText(root = Sel.editor) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const hits = [];
    let n;
    while ((n = w.nextNode())) if (/\{\{[^{}\n]{1,40}\}\}/.test(n.nodeValue) && !n.parentElement.closest('.mm-field')) hits.push(n);
    for (const t of hits) {
      const frag = document.createDocumentFragment();
      const parts = t.nodeValue.split(/(\{\{[^{}\n]{1,40}\}\})/);
      for (const p of parts) {
        const m = /^\{\{([^{}\n]{1,40})\}\}$/.exec(p);
        if (m) frag.append(this.fieldEl(m[1].trim()));
        else if (p) frag.append(document.createTextNode(p));
      }
      t.replaceWith(frag);
    }
    return hits.length;
  },
  fieldsInDoc(root = Sel.editor) {
    return Array.from(new Set($$('.mm-field', root).map((f) => f.dataset.field)));
  },

  async markDialog() {
    const known = Array.from(new Set([...(this.lastData ? this.lastData.fields : []), ...this.fieldsInDoc()]));
    const v = await Dialog.form('메일머지 표시 달기 (Ctrl+K,M)', [
      known.length
        ? { name: 'pick', label: '필드 선택', type: 'select', value: '', options: [['', '(직접 입력)'], ...known.map((k) => [k, k])] }
        : null,
      { name: 'name', label: '필드 이름/번호', type: 'text', value: '', autofocus: true },
    ].filter(Boolean), { okLabel: '넣기', width: 380, note: '자료의 필드 이름(예: 이름, 주소) 또는 필드 번호(1, 2, …)를 입력하세요. 문서에는 {{이름}} 처럼 표시됩니다.' });
    if (!v) return null;
    const name = (v.pick || v.name || '').trim();
    return name ? { name } : null;
  },

  // ----- 자료 읽기 -----
  async loadData(file, docFields = this.fieldsInDoc()) {
    const name = file.name;
    if (/\.hwpx$/i.test(name)) {
      const doc = await HWPX.read(file.data);
      return this.fromHtml(doc.html, name, docFields);
    }
    const text = readTextAuto(file.data);
    return { ...textData(text, docFields), source: name };
  },

  // 문서 내용(HTML)에서 자료 읽기: 첫 표 또는 한글 자료 형식/쉼표 구분 글
  fromHtml(html, name, docFields = this.fieldsInDoc()) {
    const tmp = h('div', { html });
    tmp.querySelectorAll('.mm-field').forEach((f) => f.replaceWith(document.createTextNode(f.textContent)));
    const table = tmp.querySelector('table');
    if (table) return { ...tableData(table, docFields), source: name };
    const lines = Array.from(tmp.querySelectorAll('p, li')).map((p) => nodeText(p).replace(/\u200B/g, ''));
    return { ...textData(lines.join('\n'), docFields), source: name };
  },

  // ----- 병합 -----
  mergeHtml(templateHtml, data, { from = 1, to, pageBreak = true, sep } = {}) {
    // sep: 'page'(쪽 나누기) | 'none'(바로 이어서) | 'blank'(빈 줄 한 줄)
    if (!sep) sep = pageBreak ? 'page' : 'none';
    const recs = data.records.slice(Math.max(0, from - 1), to ? to : undefined);
    const out = [];
    const tmpl = h('div', { html: templateHtml });
    this.convertText(tmpl);
    // 서식 문서 앞뒤의 빈 문단은 빼기 (자료 사이에 빈 줄이 생기지 않게)
    const isEmpty = (el) => el && /^(P|DIV)$/.test(el.tagName) && !el.classList.contains('pagebreak') && !el.textContent.replace(/[\s\u200B\u00a0]/g, '') && !el.querySelector('img,table,.mm-field');
    while (isEmpty(tmpl.lastElementChild)) tmpl.lastElementChild.remove();
    while (isEmpty(tmpl.firstElementChild) && tmpl.children.length > 1) tmpl.firstElementChild.remove();
    recs.forEach((rec, i) => {
      const d = tmpl.cloneNode(true);
      $$('.mm-field', d).forEach((f) => {
        const key = f.dataset.field;
        let idx = data.fields.indexOf(key);
        if (idx < 0 && /^\d+$/.test(key)) idx = +key - 1;
        if (idx < 0) idx = data.fields.findIndex((x) => x.replace(/\s/g, '') === key.replace(/\s/g, ''));
        const val = idx >= 0 && idx < rec.length ? rec[idx] : '';
        const frag = document.createDocumentFragment();
        String(val).split('\n').forEach((line, k) => { if (k) frag.append(h('br')); frag.append(document.createTextNode(line)); });
        // 필드의 글자 모양 유지
        if (f.getAttribute('style')) { const s = h('span', { style: f.getAttribute('style') }); s.append(frag); f.replaceWith(s); } else f.replaceWith(frag);
      });
      d.innerHTML = d.innerHTML.replace(/​/g, '');
      if (i > 0 && sep === 'page') out.push('<div class="pagebreak" contenteditable="false"></div>');
      else if (i > 0 && sep === 'blank') out.push('<p><br></p>');
      out.push(d.innerHTML);
    });
    return { html: out.join(''), count: recs.length };
  },

  async makeDialog() {
    const docFields = this.fieldsInDoc();
    let data = this.lastData;
    const fileLbl = h('span', { class: 'muted' }, data ? data.source : '선택된 자료 없음');
    const preview = h('div', { style: { maxHeight: '180px', overflow: 'auto', marginTop: '8px' } });
    const out = h('select', {}, h('option', { value: 'window' }, '새 문서 (화면)'), h('option', { value: 'hwpx' }, 'HWPX 파일로 저장'), h('option', { value: 'pdf' }, 'PDF 파일로 저장'));
    const fromIn = h('input', { type: 'number', min: 1, value: 1, style: { width: '70px' } });
    const toIn = h('input', { type: 'number', min: 1, value: '', placeholder: '끝', style: { width: '70px' } });
    const pb = h('select', { class: 'no-enter' }, h('option', { value: 'page' }, '쪽 나누기 (한 사람에 한 쪽)'), h('option', { value: 'none' }, '바로 이어서 (빈 줄 없이)'), h('option', { value: 'blank' }, '빈 줄 한 줄 띄우기'));
    const showPreview = () => {
      preview.innerHTML = '';
      if (!data) return;
      const missing = docFields.filter((f) => !data.fields.includes(f) && !/^\d+$/.test(f));
      const tbl = h('table', { class: 'data-table' },
        h('tr', {}, data.fields.map((f) => h('th', { style: docFields.includes(f) ? { color: '#1f55ad' } : {} }, f))),
        data.records.slice(0, 8).map((r) => h('tr', {}, data.fields.map((f, i) => h('td', {}, r[i] || '')))));
      preview.append(h('div', { class: 'note', style: { marginTop: 0 } }, `필드 ${data.fields.length}개 · 자료 줄 ${data.records.length}개` + (data.numbered ? ' · 필드 이름 줄 없음(첫 줄부터 자료, 필드 번호로 연결)' : '') + (missing.length ? ` · 자료에 없는 필드: ${missing.join(', ')}` : '')), tbl);
      toIn.value = data.records.length;
      toIn.max = data.records.length;
      fromIn.max = data.records.length;
    };
    const pick = h('button', { class: 'btn', type: 'button' }, '자료 파일 선택…');
    pick.addEventListener('click', async () => {
      const files = await window.native.openDialog('mergeData');
      if (!files) return;
      try {
        data = await this.loadData(files[0]);
        if (!data.fields.length) throw new Error('필드를 찾지 못했습니다.');
        this.lastData = data;
        fileLbl.textContent = data.source;
        showPreview();
      } catch (e) { Dialog.alert('자료를 읽을 수 없습니다: ' + e.message); }
    });
    // 함께 열려 있는 다른 문서(탭)를 자료로
    const others = Tabs.docs.map((d, i) => ({ i, inf: Tabs.info(i) })).filter((x) => x.i !== Tabs.active);
    const openSel = h('select', { class: 'no-enter' }, h('option', { value: '' }, others.length ? '열린 문서에서 고르기…' : '(열린 다른 문서 없음)'),
      others.map((x) => h('option', { value: x.i }, x.inf.name)));
    openSel.disabled = !others.length;
    openSel.addEventListener('change', () => {
      if (openSel.value === '') return;
      const i = +openSel.value;
      const st = Tabs.docs[i].state;
      try {
        data = this.fromHtml(st.html, Tabs.info(i).name);
        if (!data.fields.length) throw new Error('필드를 찾지 못했습니다. 첫 줄이 필드 이름인 표를 넣어 주세요.');
        this.lastData = data;
        fileLbl.textContent = data.source + ' (열린 문서)';
        showPreview();
      } catch (e) { Dialog.alert('자료를 읽을 수 없습니다: ' + e.message); }
    });
    showPreview();
    const body = h('div', {},
      h('div', { class: 'form' },
        h('label', {}, '자료 종류'), h('div', { class: 'row' }, pick, openSel),
        h('label', {}, '고른 자료'), fileLbl,
        h('label', {}, '출력 방향'), out,
        h('label', {}, '만들 범위'), h('div', { class: 'row' }, fromIn, h('span', {}, '번째 줄부터'), toIn, h('span', {}, '번째 줄까지')),
        h('label', {}, '자료 사이'), pb),
      preview,
      h('div', { class: 'note' }, '자료로 쓸 수 있는 파일: ① 첫 줄이 필드 이름인 표가 든 한글(HWPX) 문서 ② 한글 메일머지 자료 형식(첫 줄에 필드 개수, 다음 줄부터 자료를 한 줄에 하나씩. 필드 이름 줄은 넣어도 되고 빼도 됨) 문서 ③ CSV/탭 구분 텍스트.' + (docFields.length ? `\n현재 문서의 필드: ${docFields.join(', ')}` : '\n현재 문서에 메일머지 표시가 없습니다. Ctrl+K,M으로 먼저 표시를 다세요.')));
    Dialog.open({
      title: '메일머지 만들기 (Alt+M)', width: 620, body,
      buttons: [
        { label: '만들기', primary: true, onClick: async () => {
          if (!data) { Dialog.alert('먼저 자료 파일을 선택하세요.'); return false; }
          await this.run(data, { from: +fromIn.value || 1, to: +toIn.value || undefined, sep: pb.value, output: out.value });
        } },
        { label: '취소' },
      ],
    });
  },

  async run(data, opts) {
    Merge.lastData = data;
    const { html, count } = this.mergeHtml(Sel.editor.innerHTML, data, opts);
    if (!count) { Dialog.alert('만들 자료 줄이 없습니다.'); return; }
    if (opts.output === 'window') {
      Tabs.newDoc({ html, title: '메일머지 결과', page: App.page, settings: App.docSettings });
      status(`자료 ${count}줄로 새 문서를 만들었습니다.`);
      return;
    }
    // 파일 출력: 편집기에 잠시 넣어 모델 생성
    const saved = Sel.editor.innerHTML;
    const savedSel = Sel.save();
    try {
      Sel.editor.innerHTML = html;
      App.layout();
      if (opts.output === 'hwpx') {
        const p = await window.native.saveDialog('hwpx', '메일머지 결과.hwpx');
        if (!p) return;
        const bytes = await HWPX.write(Model.fromEditor(), { title: '메일머지 결과' });
        await window.native.writeFile(p, bytes);
        toast(`자료 ${count}줄을 저장했습니다: ${p}`);
      } else if (opts.output === 'pdf') {
        const p = await window.native.saveDialog('pdf', '메일머지 결과.pdf');
        if (!p) return;
        const bytes = await App.renderPDF();
        await window.native.writeFile(p, bytes);
        toast(`자료 ${count}줄을 PDF로 저장했습니다.`);
      }
    } finally {
      Sel.editor.innerHTML = saved;
      Sel.restore(savedSel);
      App.layout();
    }
  },

  // 메일머지 자료 문서 만들기: 필드 이름을 첫 줄로 한 표가 든 새 문서
  async dataDocDialog() {
    const cur = this.fieldsInDoc();
    const v = await Dialog.form('메일머지 자료 문서 만들기', [
      { name: 'fields', label: '필드 이름 (쉼표로 구분)', type: 'text', value: cur.length ? cur.join(', ') : '이름, 주소, 전화번호' },
      { name: 'rows', label: '빈 줄 수', type: 'number', value: 5, min: 1, max: 500 },
    ], { okLabel: '만들기', width: 460, note: '새 창에 자료 입력용 표가 만들어집니다. 내용을 채운 뒤 HWPX로 저장하고, 메일머지 만들기(Alt+M)에서 자료로 선택하세요.' });
    if (!v) return;
    const fields = v.fields.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (!fields.length) return;
    const n = fields.length;
    const w = Math.floor(App.contentWidth() / n);
    let html = '<p style="text-align:center"><span style="font-size:14pt;font-weight:bold">메일머지 자료</span></p><p><br></p>';
    html += `<table style="width:${w * n}px"><colgroup>${fields.map(() => `<col style="width:${w}px">`).join('')}</colgroup><tbody>`;
    html += '<tr>' + fields.map((f) => `<td style="background-color:#e8edf5"><p style="text-align:center"><span style="font-weight:bold">${escHtml(f)}</span></p></td>`).join('') + '</tr>';
    for (let i = 0; i < Math.max(1, v.rows | 0); i++) html += '<tr>' + fields.map(() => '<td><p><br></p></td>').join('') + '</tr>';
    html += '</tbody></table><p><br></p>';
    Tabs.newDoc({ html, title: '메일머지 자료' });
  },
};

// 첫 줄이 필드 이름인지 판단: 문서가 번호 필드({{1}}, {{2}})만 쓰고
// 첫 줄이 그 이름들과 맞지 않으면 첫 줄부터 바로 자료로 본다.
function hasHeaderRow(first, docFields) {
  if (!docFields || !docFields.length) return true;
  const cells = first.map((s) => String(s).trim());
  if (docFields.some((f) => cells.includes(f))) return true;
  const allNumbered = docFields.every((f) => /^\d+$/.test(f));
  return !allNumbered;
}
function tableData(table, docFields) {
  const rows = Array.from(table.rows).filter((tr) => tr.closest('table') === table);
  const cellText = (td) => {
    const ps = Array.from(td.querySelectorAll('p'));
    return (ps.length ? ps.map(nodeText).join('\n') : nodeText(td)).replace(/​/g, '').trim();
  };
  const matrix = rows.map((tr) => Array.from(tr.cells).map(cellText));
  if (matrix.length && !hasHeaderRow(matrix[0], docFields)) {
    const n = Math.max(...matrix.map((r) => r.length));
    return { fields: Array.from({ length: n }, (_, i) => String(i + 1)), records: matrix.filter((r) => r.some((x) => x)), numbered: true };
  }
  const fields = (matrix.shift() || []).map((f, i) => f || `필드${i + 1}`);
  const records = matrix.filter((r) => r.some((x) => x));
  return { fields, records };
}
function nodeText(el) {
  let s = '';
  const walk = (n) => {
    if (n.nodeType === 3) s += n.nodeValue;
    else if (n.nodeName === 'BR') s += '\n';
    else n.childNodes.forEach(walk);
  };
  walk(el);
  return s.replace(/\n$/, '');
}
function textData(text, docFields) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  while (lines.length && !lines[0].trim()) lines.shift();
  // 한글 메일머지 자료 형식: 첫 줄 = 필드 개수, (필드 이름 줄), 자료
  if (/^\s*\d+\s*$/.test(lines[0] || '')) {
    const n = parseInt(lines[0], 10);
    if (n > 0 && lines.length >= n + 1) {
      const body = lines.slice(1).filter((s) => s.trim() !== '');
      const withNames = hasHeaderRow(body.slice(0, n), docFields);
      const fields = withNames ? body.slice(0, n).map((s) => s.trim()) : Array.from({ length: n }, (_, i) => String(i + 1));
      const rest = withNames ? body.slice(n) : body;
      const records = [];
      for (let i = 0; i + n <= rest.length; i += n) records.push(rest.slice(i, i + n).map((s) => s.trim()));
      return { fields, records: records.filter((r) => r.some((x) => x)), numbered: !withNames };
    }
  }
  const sep = lines[0] && lines[0].includes('\t') ? '\t' : ',';
  const rows = sep === '\t' ? lines.map((l) => l.split('\t')) : parseCSV(lines.join('\n'));
  const fields = (rows.shift() || []).map((f, i) => f.trim() || `필드${i + 1}`);
  return { fields, records: rows.filter((r) => r.some((x) => x && x.trim())).map((r) => r.map((x) => (x || '').trim())) };
}
function parseCSV(s) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
