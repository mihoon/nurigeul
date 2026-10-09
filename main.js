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
  if (process.platform !== 'win32') return (appFontsCache = list);
  const roots = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, 'C:\\Program Files (x86)', 'C:\\Program Files'].filter(Boolean);
  const dirs = new Set();
  const ls = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }); } catch { return []; } };
  for (const r of new Set(roots)) {
    for (const vendor of ['HNC', 'Hnc', 'Hancom']) {
      const v = path.join(r, vendor);
      for (const prod of ls(v)) {
        if (!prod.isDirectory()) continue;
        const pp = path.join(v, prod.name);
        // HNC\Office 2024\HOffice130\Shared\TTF, HNC\Office NEO\HOffice100\Shared\TTF, HNC\HOffice\Shared\TTF ...
        const cands = [path.join(pp, 'Shared'), ...ls(pp).filter((x) => x.isDirectory()).map((x) => path.join(pp, x.name, 'Shared'))];
        for (const sh of cands) for (const sub of ['TTF', 'Fonts', 'TTF\\Hnc']) { const d = path.join(sh, sub); if (fs.existsSync(d)) dirs.add(d); }
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
      for (const fn of fontNames(f).slice(0, 1)) list.push({ ...fn, url: 'file:///' + f.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace(/^([A-Za-z])%3A/, '$1:') });
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

const gotLock = app.requestSingleInstanceLock();
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
  });

  app.on('window-all-closed', () => app.quit());
}
