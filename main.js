// 누리글 - Electron main process
const { app, BrowserWindow, ipcMain, dialog, Menu, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const windows = new Set();
let untitledCounter = 0;

function macrosPath() { return path.join(app.getPath('userData'), 'macros.json'); }
function settingsPath() { return path.join(app.getPath('userData'), 'settings.json'); }

function createWindow(opts = {}) {
  // 새 창은 앞 창에서 조금 비켜서 열기 (겹쳐서 안 보이는 것 방지)
  const prev = BrowserWindow.getFocusedWindow();
  let pos = {};
  if (prev && !prev.isMaximized() && !prev.isFullScreen()) {
    const [x, y] = prev.getPosition();
    pos = { x: x + 32, y: y + 32 };
  }
  const win = new BrowserWindow({
    ...pos,
    width: 1280,
    height: 880,
    minWidth: 760,
    minHeight: 480,
    title: '누리글',
    backgroundColor: '#e9ebee',
    icon: path.join(__dirname, 'build', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  win.__init = {
    filePath: opts.filePath || null,
    html: opts.html || null,
    title: opts.title || null,
    untitled: ++untitledCounter,
  };
  win.__forceClose = false;
  windows.add(win);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => { win.show(); win.focus(); });
  win.on('close', (e) => {
    if (win.__forceClose) return;
    e.preventDefault();
    win.webContents.send('app:close-request');
  });
  win.on('closed', () => windows.delete(win));
  // 외부 링크는 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); }
  });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
  });
  return win;
}

function fromEvent(e) { return BrowserWindow.fromWebContents(e.sender); }

let uiLang = 'ko';
const L = (ko, en) => (uiLang === 'en' ? en : ko);
const FILTERS_FN = () => ({
  open: [
    { name: L('지원하는 문서', 'Supported documents'), extensions: ['hwpx', 'hwp', 'md', 'markdown', 'txt', 'html', 'htm'] },
    { name: L('한글 문서 (HWPX, HWP)', 'Hangul document (HWPX, HWP)'), extensions: ['hwpx', 'hwp'] },
    { name: L('마크다운 (MD)', 'Markdown (MD)'), extensions: ['md', 'markdown'] },
    { name: L('모든 파일', 'All files'), extensions: ['*'] },
  ],
  hwpx: [{ name: L('한글 문서 (HWPX)', 'Hangul document (HWPX)'), extensions: ['hwpx'] }, { name: L('마크다운 (MD)', 'Markdown (MD)'), extensions: ['md'] }],
  md: [{ name: L('마크다운 (MD)', 'Markdown (MD)'), extensions: ['md', 'markdown'] }, { name: L('한글 문서 (HWPX)', 'Hangul document (HWPX)'), extensions: ['hwpx'] }],
  docx: [{ name: L('Word 문서', 'Word document'), extensions: ['docx'] }],
  pdf: [{ name: L('PDF 문서', 'PDF document'), extensions: ['pdf'] }],
  png: [{ name: L('PNG 그림', 'PNG image'), extensions: ['png'] }],
  jpg: [{ name: L('JPG 그림', 'JPEG image'), extensions: ['jpg', 'jpeg'] }],
  image: [{ name: L('그림 파일', 'Pictures'), extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'] }],
  mergeData: [
    { name: L('메일머지 자료 (HWPX, CSV, TXT)', 'Mail merge data (HWPX, CSV, TXT)'), extensions: ['hwpx', 'csv', 'txt'] },
    { name: L('모든 파일', 'All files'), extensions: ['*'] },
  ],
});
ipcMain.handle('lang:set', (e, l) => { uiLang = l === 'en' ? 'en' : 'ko'; return true; });
const FILTERS_OLD = {
  open: [
    { name: '지원하는 문서', extensions: ['hwpx', 'hwp', 'txt', 'html', 'htm'] },
    { name: '한글 문서 (HWPX, HWP)', extensions: ['hwpx', 'hwp'] },
    { name: '모든 파일', extensions: ['*'] },
  ],
  hwpx: [{ name: '한글 문서 (HWPX)', extensions: ['hwpx'] }],
  docx: [{ name: 'Word 문서', extensions: ['docx'] }],
  pdf: [{ name: 'PDF 문서', extensions: ['pdf'] }],
  image: [{ name: '그림 파일', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'] }],
  mergeData: [
    { name: '메일머지 자료 (HWPX, CSV, TXT)', extensions: ['hwpx', 'csv', 'txt'] },
    { name: '모든 파일', extensions: ['*'] },
  ],
};

ipcMain.handle('init', (e) => {
  const win = fromEvent(e);
  const init = win.__init || {};
  win.__init = { untitled: init.untitled };
  return init;
});

ipcMain.handle('dlg:open', async (e, kind = 'open', multi = false) => {
  const win = fromEvent(e);
  const r = await dialog.showOpenDialog(win, {
    title: kind === 'image' ? L('그림 넣기', 'Insert Picture') : kind === 'mergeData' ? L('메일머지 자료 선택', 'Choose Mail Merge Data') : L('불러오기', 'Open'),
    filters: FILTERS_FN()[kind] || FILTERS_FN().open,
    properties: multi ? ['openFile', 'multiSelections'] : ['openFile'],
  });
  if (r.canceled || !r.filePaths.length) return null;
  return r.filePaths.map((p) => ({ path: p, name: path.basename(p), data: fs.readFileSync(p) }));
});

ipcMain.handle('dlg:save', async (e, kind = 'hwpx', defaultName = '문서') => {
  const win = fromEvent(e);
  const r = await dialog.showSaveDialog(win, {
    title: kind === 'pdf' ? L('PDF로 저장', 'Save as PDF') : (kind === 'png' || kind === 'jpg') ? L('그림으로 저장', 'Save as Image') : kind === 'docx' ? L('DOCX로 내보내기', 'Export to DOCX') : L('다른 이름으로 저장', 'Save As'),
    defaultPath: defaultName,
    filters: FILTERS_FN()[kind] || FILTERS_FN().hwpx,
  });
  if (r.canceled || !r.filePath) return null;
  return r.filePath;
});

ipcMain.handle('fs:write', async (e, filePath, data) => {
  fs.writeFileSync(filePath, Buffer.from(data));
  return true;
});

ipcMain.handle('fs:read', async (e, filePath) => {
  return { path: filePath, name: path.basename(filePath), data: fs.readFileSync(filePath) };
});

ipcMain.handle('msg:confirm', async (e, message, buttons, detail) => {
  const win = fromEvent(e);
  const r = await dialog.showMessageBox(win, {
    type: 'question', title: L('누리글', 'Nurigeul'), message, detail: detail || '',
    buttons: buttons && buttons.length ? buttons : [L('확인', 'OK'), L('취소', 'Cancel')], defaultId: 0, cancelId: (buttons && buttons.length ? buttons.length : 2) - 1,
    noLink: true,
  });
  return r.response;
});

ipcMain.handle('win:new', (e, opts) => { createWindow(opts || {}); return true; });
ipcMain.handle('win:title', (e, title) => { const w = fromEvent(e); if (w) w.setTitle(title); });
ipcMain.handle('win:fullscreen', (e) => { const w = fromEvent(e); if (!w) return false; w.setFullScreen(!w.isFullScreen()); return w.isFullScreen(); });
ipcMain.handle('win:close', (e) => { const w = fromEvent(e); if (w) { w.__forceClose = true; w.close(); } });
ipcMain.handle('app:quit', () => {
  for (const w of windows) w.webContents.send('app:close-request');
});

ipcMain.handle('print', (e) => {
  const w = fromEvent(e);
  return new Promise((resolve) => {
    w.webContents.print({ printBackground: true }, (ok, reason) => resolve({ ok, reason }));
  });
});

ipcMain.handle('pdf', async (e) => {
  const w = fromEvent(e);
  const data = await w.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true });
  return data;
});

ipcMain.handle('macros:load', () => {
  try { return JSON.parse(fs.readFileSync(macrosPath(), 'utf8')); } catch { return null; }
});
ipcMain.handle('macros:save', (e, data) => {
  fs.mkdirSync(path.dirname(macrosPath()), { recursive: true });
  fs.writeFileSync(macrosPath(), JSON.stringify(data, null, 1), 'utf8');
  for (const w of windows) if (w.webContents !== e.sender) w.webContents.send('macros:changed', data);
  return true;
});
// ----- 한글(한컴오피스)이 따로 가지고 있는 글꼴 (HY헤드라인M, 한컴 소망 등) -----
// 한글은 이 글꼴들을 Windows에 설치하지 않고 자기 폴더에서만 쓰므로, 누리글이 같은 파일을 찾아 @font-face로 씀
function fontNames(file) {
  const fd = fs.openSync(file, 'r');
  const rd = (pos, len) => { const b = Buffer.alloc(len); const n = fs.readSync(fd, b, 0, len, pos); return b.subarray(0, n); };
  const out = [];
  try {
    const head = rd(0, 12);
    let offsets = [0];
    if (head.toString('latin1', 0, 4) === 'ttcf') {
      const n = Math.min(head.readUInt32BE(8), 16);
      const t = rd(12, 4 * n);
      offsets = Array.from({ length: n }, (_, i) => t.readUInt32BE(i * 4));
    }
    for (const off of offsets) {
      const h = rd(off, 12);
      const nt = h.readUInt16BE(4);
      const dir = rd(off + 12, nt * 16);
      let nameOff = -1, nameLen = 0, os2 = -1;
      for (let i = 0; i < nt; i++) {
        const tag = dir.toString('latin1', i * 16, i * 16 + 4);
        if (tag === 'name') { nameOff = dir.readUInt32BE(i * 16 + 8); nameLen = dir.readUInt32BE(i * 16 + 12); }
        if (tag === 'OS/2') os2 = dir.readUInt32BE(i * 16 + 8);
      }
      if (nameOff < 0) continue;
      const nb = rd(nameOff, Math.min(nameLen, 65536));
      const cnt = nb.readUInt16BE(2), strOff = nb.readUInt16BE(4);
      const fam = new Set(); let sub = '';
      for (let i = 0; i < cnt; i++) {
        const r = 6 + i * 12;
        if (r + 12 > nb.length) break;
        const pid = nb.readUInt16BE(r), nid = nb.readUInt16BE(r + 6), len = nb.readUInt16BE(r + 8), o = nb.readUInt16BE(r + 10);
        if (pid !== 3 || ![1, 2, 4, 16].includes(nid)) continue;
        const raw = nb.subarray(strOff + o, strOff + o + len);
        let str = '';
        for (let k = 0; k + 1 < raw.length; k += 2) str += String.fromCharCode(raw.readUInt16BE(k));
        str = str.replace(/\0/g, '').trim();
        if (!str) continue;
        if (nid === 2 && !sub) sub = str;
        else if (nid !== 2) fam.add(str);
      }
      let weight = 400;
      if (os2 >= 0) { const w = rd(os2 + 4, 2); if (w.length === 2) weight = w.readUInt16BE(0) || 400; }
      if (fam.size) out.push({ names: [...fam], weight, italic: /italic|oblique/i.test(sub) });
    }
  } catch { /* 망가진 글꼴 */ }
  fs.closeSync(fd);
  return out;
}
let appFontsCache = null;
ipcMain.handle('fonts:app', () => {
  if (appFontsCache) return appFontsCache;
  const list = [];
  const ls = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }); } catch { return []; } };
  let roots;
  const dirs = new Set();
  if (process.platform === 'win32') roots = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, 'C:\\Program Files (x86)', 'C:\\Program Files'].filter(Boolean);
  else {
    // 리눅스: 한컴오피스 리눅스판(/opt/hnc), 와인으로 설치한 한글(~/.wine/drive_c/Program Files…)
    const home = require('os').homedir();
    roots = ['/opt', '/usr/share', path.join(home, '.wine/drive_c/Program Files (x86)'), path.join(home, '.wine/drive_c/Program Files')];
    for (const d of ['/opt/hnc/hoffice11/Bin/fonts', '/opt/hnc/hoffice9/Bin/fonts', '/opt/hnc/hoffice/Bin/fonts']) if (fs.existsSync(d)) dirs.add(d);
  }
  for (const r of new Set(roots)) {
    for (const vendor of ['HNC', 'Hnc', 'hnc', 'Hancom']) {
      const v = path.join(r, vendor);
      for (const prod of ls(v)) {
        if (!prod.isDirectory()) continue;
        const pp = path.join(v, prod.name);
        // HNC\Office 2024\HOffice130\Shared\TTF, HNC\Office NEO\HOffice100\Shared\TTF, HNC\HOffice\Shared\TTF ...
        const cands = [path.join(pp, 'Shared'), ...ls(pp).filter((x) => x.isDirectory()).map((x) => path.join(pp, x.name, 'Shared'))];
        for (const sh of cands) for (const sub of ['TTF', 'Fonts', path.join('TTF', 'Hnc')]) { const d = path.join(sh, sub); if (fs.existsSync(d)) dirs.add(d); }
      }
    }
  }
  const seen = new Set();
  const walk = (d, depth) => {
    for (const e of ls(d)) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { if (depth < 2) walk(f, depth + 1); continue; }
      if (!/\.(ttf|ttc|otf)$/i.test(e.name) || seen.has(e.name.toLowerCase())) continue;
      seen.add(e.name.toLowerCase());
      for (const fn of fontNames(f).slice(0, 1)) list.push({ ...fn, url: require('url').pathToFileURL(f).href });
    }
  };
  for (const d of dirs) walk(d, 0);
  return (appFontsCache = list);
});

ipcMain.handle('settings:load', () => {
  try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')); } catch { return {}; }
});
ipcMain.handle('settings:save', (e, data) => {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(data), 'utf8');
  return true;
});

function fileArgs(argv) {
  return argv.slice(1).filter((a) => !a.startsWith('-') && /\.(hwpx|hwp|md|markdown|txt|html?)$/i.test(a) && fs.existsSync(a));
}


// ================= 업데이트 (GitHub 릴리스) =================
const UPDATE_API = process.env.NURIGEUL_UPDATE_API || 'https://api.github.com/repos/mihoon/nurigeul/releases/latest';
const RELEASES_PAGE = 'https://github.com/mihoon/nurigeul/releases/latest';
// 업데이트 설정은 따로 (편집기 설정 파일은 화면 쪽이 통째로 덮어쓰므로)
const updPath = () => path.join(app.getPath('userData'), 'update.json');
function readSettings() { try { return JSON.parse(fs.readFileSync(updPath(), 'utf8')); } catch { return {}; } }
function writeSettings(d) { try { fs.mkdirSync(path.dirname(updPath()), { recursive: true }); fs.writeFileSync(updPath(), JSON.stringify(d), 'utf8'); } catch { /* 무시 */ } }
function msgBox(o) { if (process.env.NURIGEUL_UPDATE_AUTO) return Promise.resolve({ response: 0, checkboxChecked: false }); const w = mainWin(); return w ? dialog.showMessageBox(w, o) : dialog.showMessageBox(o); }
function verCmp(a, b) {
  const pa = String(a).replace(/^v/i, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b).replace(/^v/i, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
}
// 이 실행 방식에 맞는 받을 파일: 포터블 exe / AppImage (나머지는 릴리스 페이지를 엶)
function updateKind() {
  if (process.platform === 'win32' && process.env.PORTABLE_EXECUTABLE_FILE) return { kind: 'portable', self: process.env.PORTABLE_EXECUTABLE_FILE, re: /^Nurigeul-Portable-[\d.]+\.exe$/i };
  if (process.platform === 'linux' && process.env.APPIMAGE) return { kind: 'appimage', self: process.env.APPIMAGE, re: /^Nurigeul-[\d.]+-linux-x86_64\.AppImage$/i };
  return { kind: 'page' };
}
async function fetchLatest() {
  const r = await fetch(UPDATE_API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Nurigeul/' + app.getVersion() } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  return { version: String(j.tag_name || '').replace(/^v/i, ''), name: j.name || j.tag_name, notes: (j.body || '').replace(/\r/g, ''), page: j.html_url || RELEASES_PAGE, assets: (j.assets || []).map((a) => ({ name: a.name, url: a.browser_download_url, size: a.size })) };
}
// 렌더러에 물어볼 때 쓰는 창 (가장 앞 창)
function mainWin() { return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]; }
let updateBusy = false;
async function checkUpdate(manual) {
  if (updateBusy) return;
  const st = readSettings();
  if (!manual) {
    if (st.updateOff) return;
    if (st.updateLast && Date.now() - st.updateLast < 6 * 3600 * 1000) return; // 6시간에 한 번
  }
  updateBusy = true;
  try {
    let info;
    try { info = await fetchLatest(); } catch (err) {
      if (manual) msgBox({ type: 'warning', title: L('업데이트', 'Update'), message: L('업데이트 정보를 가져오지 못했습니다.', 'Could not check for updates.'), detail: String(err.message || err), noLink: true });
      return;
    }
    st.updateLast = Date.now(); writeSettings(st);
    const cur = app.getVersion();
    if (!info.version || verCmp(info.version, cur) <= 0) {
      if (manual) msgBox({ type: 'info', title: L('업데이트', 'Update'), message: L(`지금 쓰고 있는 누리글 ${cur}이(가) 최신 버전입니다.`, `Nurigeul ${cur} is up to date.`), noLink: true });
      return;
    }
    if (!manual && st.updateSkip === info.version) return;
    const k = updateKind();
    const asset = k.re ? info.assets.find((a) => k.re.test(a.name)) : null;
    const notes = info.notes.length > 1500 ? info.notes.slice(0, 1500) + '\n…' : info.notes;
    const canAuto = !!asset;
    const btns = canAuto ? [L('지금 업데이트', 'Update now'), L('나중에', 'Later'), L('이 버전 건너뛰기', 'Skip this version')]
      : [L('내려받는 곳 열기', 'Open download page'), L('나중에', 'Later'), L('이 버전 건너뛰기', 'Skip this version')];
    const r = await msgBox({
      type: 'info', title: L('누리글 업데이트', 'Nurigeul Update'),
      message: L(`새 버전 누리글 ${info.version}이(가) 나왔습니다. (지금: ${cur})`, `Nurigeul ${info.version} is available. (current: ${cur})`),
      detail: notes, buttons: btns, defaultId: 0, cancelId: 1, noLink: true,
      checkboxLabel: L('시작할 때 업데이트를 확인하지 않기', 'Do not check for updates at startup'), checkboxChecked: !!st.updateOff,
    });
    const st2 = readSettings(); st2.updateOff = !!r.checkboxChecked; writeSettings(st2);
    if (r.response === 2) { st2.updateSkip = info.version; writeSettings(st2); return; }
    if (r.response !== 0) return;
    if (!canAuto) { shell.openExternal(info.page); return; }
    await downloadAndRestart(info, asset, k);
  } finally { updateBusy = false; }
}
async function downloadAndRestart(info, asset, k) {
  const dir = path.dirname(k.self);
  const target = path.join(dir, asset.name);
  const tmp = target + '.part';
  const send = (ch, ...a) => { for (const w of BrowserWindow.getAllWindows()) w.webContents.send(ch, ...a); };
  try {
    const r = await fetch(asset.url, { headers: { 'User-Agent': 'Nurigeul/' + app.getVersion() } });
    if (!r.ok || !r.body) throw new Error('HTTP ' + r.status);
    const total = +r.headers.get('content-length') || asset.size || 0;
    const out = fs.createWriteStream(tmp);
    let got = 0, lastPct = -1;
    const reader = r.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      if (!out.write(Buffer.from(value))) await new Promise((res) => out.once('drain', res));
      const pct = total ? Math.floor((got / total) * 100) : -1;
      if (pct !== lastPct) { lastPct = pct; send('update:progress', pct, got, total); }
    }
    await new Promise((res, rej) => out.end((err) => (err ? rej(err) : res())));
    if (total && fs.statSync(tmp).size !== total) throw new Error(L('받은 파일 크기가 맞지 않습니다.', 'Downloaded size mismatch.'));
    try { fs.unlinkSync(target); } catch { /* 없음 */ }
    fs.renameSync(tmp, target);
    if (k.kind === 'appimage') fs.chmodSync(target, 0o755);
    send('update:progress', 100, got, total);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* 무시 */ }
    send('update:progress', null);
    const r = await msgBox({ type: 'error', title: L('업데이트', 'Update'), message: L('새 버전을 내려받지 못했습니다.', 'Download failed.'), detail: String(err.message || err), buttons: [L('내려받는 곳 열기', 'Open download page'), L('닫기', 'Close')], noLink: true });
    if (r.response === 0) shell.openExternal(info.page);
    return;
  }
  const r = await msgBox({
    type: 'info', title: L('누리글 업데이트', 'Nurigeul Update'),
    message: L(`누리글 ${info.version}을(를) 내려받았습니다.`, `Nurigeul ${info.version} downloaded.`),
    detail: L(`저장 위치: ${target}\n\n지금 다시 시작할까요? (바뀐 문서는 저장할지 먼저 묻습니다)`, `Saved to: ${target}\n\nRestart now?`),
    buttons: [L('다시 시작', 'Restart'), L('나중에', 'Later')], defaultId: 0, cancelId: 1, noLink: true,
  });
  if (r.response !== 0) return;
  // 열린 문서 저장 확인 (창마다) → 새 버전 실행 → 끝내기
  for (const w of BrowserWindow.getAllWindows()) {
    const ok = await w.webContents.executeJavaScript('Tabs.confirmAll()').catch(() => true);
    if (!ok) return;
  }
  const { spawn } = require('child_process');
  const child = spawn(target, ['--after-update', '--old-exe=' + k.self], { detached: true, stdio: 'ignore', cwd: dir });
  child.unref();
  app.exit(0);
}
ipcMain.handle('update:check', () => checkUpdate(true));

// 업데이트 뒤 새 버전으로 시작: 앞 버전이 완전히 끝날 때까지 잠시 기다렸다가 시작하고, 앞 버전 파일은 지움
const afterUpdate = process.argv.includes('--after-update');
function cleanupOld() {
  const a = process.argv.find((x) => x.startsWith('--old-exe='));
  if (!a) return;
  const old = a.slice('--old-exe='.length);
  const me = process.env.PORTABLE_EXECUTABLE_FILE || process.env.APPIMAGE || '';
  if (!old || path.resolve(old) === path.resolve(me || '') || !/Nurigeul-(Portable-)?[\d.]+(-linux-x86_64\.AppImage|\.exe)$/i.test(old)) return;
  let n = 0;
  const tryDel = () => { try { fs.unlinkSync(old); } catch { if (++n < 20) setTimeout(tryDel, 1500); } };
  setTimeout(tryDel, 1500);
}
let gotLock = app.requestSingleInstanceLock();
if (!gotLock && afterUpdate) {
  // 앞 버전이 아직 끝나는 중: 최대 15초까지 기다리며 다시 시도
  const t0 = Date.now();
  while (!gotLock && Date.now() - t0 < 15000) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300); gotLock = app.requestSingleInstanceLock(); }
}
if (!gotLock) {
  app.quit();
} else {
  // 프로그램이 한 번 더 실행되면(포터블 실행기 재실행, 두 번 클릭 등) 새 창을 만들지 않고
  // 이미 열린 창을 앞으로 가져온다. 문서 파일을 넘겨받았을 때만 그 문서를 연다.
  app.on('second-instance', (event, argv) => {
    const files = fileArgs(argv);
    if (files.length) { files.forEach((f) => createWindow({ filePath: path.resolve(f) })); return; }
    const w = BrowserWindow.getAllWindows()[0];
    if (w) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); }
    else createWindow();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => {
      cb(['local-fonts', 'clipboard-read', 'clipboard-sanitized-write'].includes(permission));
    });
    session.defaultSession.setPermissionCheckHandler((wc, permission) =>
      ['local-fonts', 'clipboard-read', 'clipboard-sanitized-write'].includes(permission));
    const files = fileArgs(process.argv);
    if (files.length) files.forEach((f) => createWindow({ filePath: path.resolve(f) }));
    else createWindow();
    if (afterUpdate) cleanupOld();
    // 시작하고 조금 뒤 업데이트 확인 (6시간에 한 번)
    setTimeout(() => checkUpdate(false).catch(() => {}), 8000);
  });

  app.on('window-all-closed', () => app.quit());
}
