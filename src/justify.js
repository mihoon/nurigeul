// 한글식 양쪽 정렬: 좁은 칸에서 띄어쓰기 없이 한 덩어리만 있는 줄(예: "6.아동결연", 단어 가운데서 나뉜 줄)은
// 한글처럼 글자 사이를 고르게 벌려 줄 끝까지 채움. 화면 전용(#jfy-css) — 저장·측정 때는 꺼짐(Table.natural)
'use strict';
const Justify = {
  MAXW: 360, // 이보다 넓은 문단은 검사하지 않음 (본문처럼 넓은 줄에는 거의 생기지 않고, 검사 비용이 큼)
  render(root) {
    root = root || Sel.editor;
    if (App.composing) return;
    const css = document.getElementById('jfy-css') || document.head.appendChild(h('style', { id: 'jfy-css' }));
    const old = Array.from(root.querySelectorAll('span.jl'));
    const z = App.zoom || 1;
    const cand = Array.from(root.querySelectorAll('td p, th p')).filter((p) => {
      if (!p.firstChild || p.classList.contains('align-distribute') || p.offsetWidth > this.MAXW) return false;
      const fs = parseFloat(getComputedStyle(p).fontSize) || 13;
      return p.offsetHeight > fs * 2.2;
    });
    if (!old.length && !cand.length) { css.textContent = ''; return; }
    const rules = [];
    Ratio.keep(() => {
      css.textContent = '';
      for (const s of old) { const par = s.parentNode; s.replaceWith(...Array.from(s.childNodes)); if (par) par.normalize(); }
      let n = 0;
      const rng = document.createRange();
      const rectsOf = (t, a, b) => { rng.setStart(t, a); rng.setEnd(t, b); return Array.from(rng.getClientRects()).filter((r) => r.width > 0 || r.height > 0); };
      for (const p of cand) {
        const cs = getComputedStyle(p);
        if (cs.textAlign !== 'justify') continue;
        if (Array.from(p.querySelectorAll('br')).some((b) => b.nextSibling || (b.parentElement !== p && b.parentElement.nextSibling))) continue; // 줄바꿈(Shift+Enter)이 있는 문단은 건너뜀
        const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
        const pieces = [];
        let t;
        while ((t = tw.nextNode())) {
          if (t.parentElement.closest('.rw, .nobj, .tab')) continue;
          const v = t.nodeValue;
          const re = /[^\s​ ]+/g;
          let m;
          while ((m = re.exec(v))) {
            const a = m.index, b = a + m[0].length;
            const rs = rectsOf(t, a, b);
            if (!rs.length) continue;
            if (rs.length === 1 || rs.every((r) => Math.abs(r.top - rs[0].top) < 2)) { pieces.push({ t, a, b, top: rs[0].top, right: Math.max(...rs.map((r) => r.right)) }); continue; }
            // 단어 가운데서 줄이 나뉨: 글자마다 줄을 찾아 조각으로
            let s = a, top = rectsOf(t, a, a + 1)[0].top, right = 0;
            for (let i = a; i < b; i++) {
              const r = rectsOf(t, i, i + 1)[0];
              if (!r) continue;
              if (Math.abs(r.top - top) >= 2) { pieces.push({ t, a: s, b: i, top, right }); s = i; top = r.top; }
              right = r.right;
            }
            pieces.push({ t, a: s, b, top, right });
          }
        }
        if (pieces.length < 2) continue;
        // 줄별로 묶기
        const lines = [];
        for (const pc of pieces) {
          const L = lines[lines.length - 1];
          if (L && Math.abs(L.top - pc.top) < 2) L.items.push(pc); else lines.push({ top: pc.top, items: [pc] });
        }
        const pr = p.getBoundingClientRect();
        const rightEdge = pr.right - (parseFloat(cs.paddingRight) || 0) * z;
        const jobs = [];
        lines.slice(0, -1).forEach((L) => {
          if (L.items.length !== 1) return;
          const pc = L.items[0];
          const text = pc.t.nodeValue.slice(pc.a, pc.b);
          const len = Array.from(text).length;
          if (len < 2) return;
          const extra = (rightEdge - pc.right) / z - 1; // 반올림 때문에 넘쳐서 줄이 다시 바뀌지 않도록 조금 덜 벌림
          if (extra <= 0.5) return;
          jobs.push({ ...pc, ls: extra / len });
        });
        // 같은 글 마디 안에서는 뒤에서부터 감쌈
        jobs.sort((x, y) => (x.t === y.t ? y.a - x.a : 0));
        for (const j of jobs) {
          if (!j.t.isConnected) continue;
          const r = document.createRange();
          r.setStart(j.t, j.a); r.setEnd(j.t, j.b);
          const span = h('span', { class: 'jl' });
          try { r.surroundContents(span); } catch { continue; }
          span.dataset.jl = ++n;
          rules.push(`span.jl[data-jl="${n}"]{letter-spacing:${j.ls.toFixed(2)}px}`);
        }
      }
      return true;
    });
    css.textContent = rules.join('');
  },
};
