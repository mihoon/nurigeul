// 공통 유틸리티
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) {
    if (k == null || k === false) continue;
    e.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return e;
}

const U = {
  PX_PER_MM: 96 / 25.4,
  mm2px: (mm) => mm * 96 / 25.4,
  px2mm: (px) => px * 25.4 / 96,
  pt2px: (pt) => pt * 96 / 72,
  px2pt: (px) => px * 72 / 96,
  // HWPUNIT: 1/7200 inch
  px2hwp: (px) => Math.round(px * 75),
  hwp2px: (hu) => hu / 75,
  mm2hwp: (mm) => Math.round(mm * 7200 / 25.4),
  hwp2mm: (hu) => hu * 25.4 / 7200,
};

const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE', 'UL', 'OL', 'TR', 'TD', 'TH', 'TBODY', 'THEAD', 'TFOOT', 'HR', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER']);
const isBlock = (n) => n && n.nodeType === 1 && BLOCK_TAGS.has(n.tagName);

function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const escHtml = escXml;

function toast(msg, ms = 2200) {
  const t = h('div', { class: 'toast' }, T(msg));
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

function status(msg) {
  const e = $('#st-msg');
  if (!e) return;
  e.textContent = T(msg || '');
  clearTimeout(status._t);
  if (msg) status._t = setTimeout(() => (e.textContent = ''), 4000);
}

function bytesToDataURL(bytes, mime) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return `data:${mime};base64,${btoa(bin)}`;
}
function dataURLToBytes(url) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url);
  if (!m) return null;
  const mime = m[1] || 'application/octet-stream';
  let bytes;
  if (m[2]) {
    const bin = atob(m[3]);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else bytes = new TextEncoder().encode(decodeURIComponent(m[3]));
  return { mime, bytes };
}
function mimeFromName(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml' }[ext] || 'application/octet-stream';
}
function extFromMime(mime) {
  return { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/bmp': 'bmp', 'image/webp': 'webp', 'image/svg+xml': 'svg' }[mime] || 'png';
}

// 색상 문자열 → #rrggbb (투명이면 null)
function cssColorToHex(c) {
  if (!c) return null;
  c = c.trim();
  if (c === 'transparent') return null;
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) return '#' + m[1].split('').map((x) => x + x).join('').toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/i.exec(c);
  if (m) {
    if (m[4] !== undefined) {
      const a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      if (a === 0) return null;
    }
    return '#' + [m[1], m[2], m[3]].map((x) => Math.round(+x).toString(16).padStart(2, '0')).join('');
  }
  return null;
}

// 선택 영역 도우미
const Sel = {
  get editor() { return document.getElementById('editor'); },
  range() {
    const s = window.getSelection();
    if (!s.rangeCount) return null;
    const r = s.getRangeAt(0);
    return this.editor.contains(r.commonAncestorContainer) ? r : null;
  },
  inEditor() { return !!this.range(); },
  set(range) {
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(range);
  },
  caretAt(node, offset = 0) {
    const r = document.createRange();
    r.setStart(node, offset);
    r.collapse(true);
    this.set(r);
  },
  caretInto(el, atEnd = false) {
    // 글자 모양 요소(span 등) 안쪽 가장 깊은 곳으로: 밖에 두면 입력한 글이 기본 글꼴이 됨
    let n = el;
    for (;;) {
      const c = atEnd ? n.lastChild : n.firstChild;
      if (!c) break;
      if (c.nodeType === 3) { if (!c.nodeValue.length && (atEnd ? c.previousSibling : c.nextSibling)) break; n = c; break; }
      if (c.nodeType !== 1 || c.tagName === 'BR' || c.tagName === 'IMG' || c.getAttribute('contenteditable') === 'false' || isBlock(c) || /^(TABLE|OL|UL)$/.test(c.tagName)) break;
      n = c;
    }
    const r = document.createRange();
    if (n.nodeType === 3) r.setStart(n, atEnd ? n.length : 0);
    else { r.selectNodeContents(n); r.collapse(!atEnd); }
    r.collapse(true);
    this.set(r);
  },
  anchorEl() {
    const r = this.range();
    if (!r) return null;
    let n = r.startContainer;
    return n.nodeType === 1 ? (n.childNodes[r.startOffset] && n.childNodes[r.startOffset].nodeType === 1 ? n.childNodes[r.startOffset] : n) : n.parentElement;
  },
  focusEl() {
    const s = window.getSelection();
    if (!s.focusNode) return null;
    return s.focusNode.nodeType === 1 ? s.focusNode : s.focusNode.parentElement;
  },
  closest(selector) {
    const e = this.focusEl();
    if (!e || !this.editor.contains(e)) return null;
    const c = e.closest(selector);
    return c && this.editor.contains(c) ? c : null;
  },
  block() {
    const r = this.range();
    if (!r) return null;
    return blockOf(deepStart(r));
  },
  // 선택 영역에 걸친 문단들
  blocks() {
    const r = this.range();
    if (!r) return [];
    const start = blockOf(deepStart(r));
    const end = blockOf(deepEnd(r));
    if (!start) return [];
    if (start === end) return [start];
    const all = allParagraphs();
    const i = all.indexOf(start), j = all.indexOf(end);
    if (i < 0 || j < 0) return [start];
    return all.slice(i, j + 1);
  },
  // 선택 경로 저장/복원 (되돌리기, 매크로 등)
  save() {
    const s = window.getSelection();
    if (!s.rangeCount || !this.editor.contains(s.anchorNode)) return null;
    return { a: nodePath(s.anchorNode), ao: s.anchorOffset, f: nodePath(s.focusNode), fo: s.focusOffset };
  },
  restore(saved) {
    if (!saved) return false;
    const a = pathNode(saved.a), f = pathNode(saved.f);
    if (!a || !f) return false;
    try {
      const s = window.getSelection();
      s.setBaseAndExtent(a, Math.min(saved.ao, nodeLen(a)), f, Math.min(saved.fo, nodeLen(f)));
      return true;
    } catch { return false; }
  },
};
// 범위 경계가 요소를 가리키면 안쪽 가장 깊은 노드로
function deepStart(r) {
  let n = r.startContainer, o = r.startOffset;
  while (n.nodeType === 1 && n.childNodes.length) {
    const c = n.childNodes[Math.min(o, n.childNodes.length - 1)];
    if (!c || (c.nodeType === 1 && c.getAttribute('contenteditable') === 'false')) break;
    n = c; o = 0;
  }
  return n;
}
function deepEnd(r) {
  let n = r.endContainer, o = r.endOffset;
  while (n.nodeType === 1 && n.childNodes.length) {
    const c = n.childNodes[Math.max(0, Math.min(o, n.childNodes.length) - 1)];
    if (!c || (c.nodeType === 1 && c.getAttribute('contenteditable') === 'false')) break;
    n = c; o = c.nodeType === 3 ? c.length : c.childNodes.length;
  }
  return n;
}
function nodeLen(n) { return n.nodeType === 3 ? n.length : n.childNodes.length; }
function nodePath(node) {
  const ed = Sel.editor;
  const path = [];
  while (node && node !== ed) {
    const p = node.parentNode;
    if (!p) return null;
    path.unshift(Array.prototype.indexOf.call(p.childNodes, node));
    node = p;
  }
  return node === ed ? path : null;
}
function pathNode(path) {
  if (!path) return null;
  let n = Sel.editor;
  for (const i of path) {
    if (!n.childNodes[i]) return n;
    n = n.childNodes[i];
  }
  return n;
}

// 문단 블록 찾기 (표 셀 안 문단 포함)
function blockOf(node) {
  const ed = Sel.editor;
  let n = node && node.nodeType === 3 ? node.parentNode : node;
  while (n && n !== ed) {
    if (n.nodeType === 1 && /^(P|DIV|H[1-6]|LI|BLOCKQUOTE|PRE)$/.test(n.tagName) && !n.classList.contains('pagebreak')) {
      // 블록 요소 안에 다른 블록이 있다면 더 안쪽이 문단
      return n;
    }
    if (n.nodeType === 1 && /^(TD|TH)$/.test(n.tagName)) return n; // 셀 직접 텍스트
    n = n.parentNode;
  }
  return null;
}
function allParagraphs(root = Sel.editor) {
  const out = [];
  const walk = (el) => {
    for (const c of el.children) {
      if (c.classList.contains('pagebreak')) continue;
      if (c.tagName === 'TABLE') { for (const cell of c.querySelectorAll(':scope > tbody > tr > td, :scope > tr > td, :scope > thead > tr > td, :scope > tbody > tr > th')) walk(cell); continue; }
      if (/^(UL|OL)$/.test(c.tagName)) { walk(c); continue; }
      if (/^(P|DIV|H[1-6]|LI|BLOCKQUOTE|PRE)$/.test(c.tagName)) {
        if ([...c.children].some((x) => isBlock(x))) walk(c); else out.push(c);
      }
    }
  };
  walk(root);
  return out;
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function todayKorean(withTime) {
  const d = new Date();
  let s = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  if (withTime) s += ` ${d.getHours() < 12 ? '오전' : '오후'} ${((d.getHours() + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, '0')}`;
  return s;
}

function readTextAuto(bytes) {
  // UTF-8 BOM/UTF-16 BOM 판별, 실패 시 EUC-KR
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return new TextDecoder('euc-kr').decode(bytes); }
}
