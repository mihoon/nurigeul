const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('native', {
  isElectron: true,
  init: () => ipcRenderer.invoke('init'),
  openDialog: (kind, multi) => ipcRenderer.invoke('dlg:open', kind, multi),
  saveDialog: (kind, name) => ipcRenderer.invoke('dlg:save', kind, name),
  writeFile: (p, data) => ipcRenderer.invoke('fs:write', p, data),
  readFile: (p) => ipcRenderer.invoke('fs:read', p),
  confirm: (message, buttons, detail) => ipcRenderer.invoke('msg:confirm', message, buttons, detail),
  newWindow: (opts) => ipcRenderer.invoke('win:new', opts),
  setTitle: (t) => ipcRenderer.invoke('win:title', t),
  toggleFullScreen: () => ipcRenderer.invoke('win:fullscreen'),
  closeWindow: () => ipcRenderer.invoke('win:close'),
  quit: () => ipcRenderer.invoke('app:quit'),
  print: () => ipcRenderer.invoke('print'),
  printToPDF: () => ipcRenderer.invoke('pdf'),
  loadMacros: () => ipcRenderer.invoke('macros:load'),
  saveMacros: (d) => ipcRenderer.invoke('macros:save', d),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (d) => ipcRenderer.invoke('settings:save', d),
  setLang: (l) => ipcRenderer.invoke('lang:set', l),
  pathForFile: (file) => { try { return webUtils.getPathForFile(file); } catch { return null; } },
  on: (ch, fn) => {
    const allowed = ['app:close-request', 'macros:changed'];
    if (allowed.includes(ch)) ipcRenderer.on(ch, (e, ...a) => fn(...a));
  },
});
