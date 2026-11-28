// 골글 들고 명전으로 — 확장판 화면 (선수 보관함 · 리그모드 · 온라인모드 베타)
// ui.js 가 window.GG 로 넘겨준 공용 도구(App, store, render, drawAvatar …)를 쓴다.
// 화면 이름은 모두 'x-' 로 시작하고, 버튼 동작(data-act)도 'x-' 로 시작한다.
const ModesUI = (function () {
  'use strict';
  const M = Modes;
  const G = () => window.GG;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KEY_V = 'gg_vault';
  const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const X = { mode: 'lg', tab: 'prog', msg: '', sel: null, newCard: null };
  const r3 = v => Sim.rate3(v), f2 = v => (Math.round(v * 100) / 100).toFixed(2);
  const ipT = s => Sim.ipTxt(s);
  const EMBLEMS = ['⚾', '🦅', '🐯', '🦁', '🐻', '🦈', '🐉', '⭐', '🔥', '⚡', '🌊', '🛡️'];
  const COLORS = ['#c8102e', '#1d4ea0', '#0b6e4f', '#ff6600', '#131230', '#6b3fa0', '#b5651d', '#111111'];
  // 유니폼: [id, 이름, 상의, 줄(null=팀 색), 바지]. 상의가 null이면 팀 색 상의
  const UNIS = [['white', '화이트', '#f4f1ea', null, '#f4f1ea'], ['cream', '아이보리', '#e9dfc4', null, '#e9dfc4'], ['gray', '그레이', '#bcc3cd', null, '#bcc3cd'], ['team', '팀 컬러', null, '#ffffff', '#f4f1ea'], ['navy', '네이비', '#1b2a4a', '#f4f1ea', '#bcc3cd'], ['black', '블랙', '#26272b', null, '#26272b']];
  const UNI_DEF = { home: 'white', away: 'gray', pat: 'plain' };
  // 유니폼 디자인 (상의 무늬): 기본(가운데 줄) · 핀스트라이프 · 라글란(어깨 배색) · 소매 배색 · 가로 띠 · 투톤(왼쪽 반)
  const PATS = [['plain', '기본'], ['pin', '줄무늬'], ['raglan', '라글란'], ['sleeve', '소매'], ['hoop', '가로 띠'], ['split', '투톤']];
  const mixHex = (a, b, t) => { const p = h => (/^#[0-9a-f]{6}$/i.test(h || '') ? h : '#888888').slice(1).match(/../g).map(x => parseInt(x, 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  // 배색 (디자인마다 따로 고른다 — 줄·어깨·소매·띠·반쪽 색). 'team'(기본)은 상의에 맞춰 정해진 색
  const ACCS = [['team', '기본', null], ['white', '흰색', '#f4f1ea'], ['black', '검정', '#26272b'], ['navy', '네이비', '#1b2a4a'], ['gold', '금색', '#d4a52f'], ['red', '빨강', '#c8102e'], ['sky', '하늘', '#5aa9e6'], ['green', '초록', '#0b6e4f']];
  const accOf = U => (U && U['acc_' + (U.pat || 'plain')]) || 'team';   // 지금 디자인에 고른 배색
  function uniCols(id, team, pat, acc) {
    const u = UNIS.find(x => x[0] === id) || UNIS[0], W = u[2] || team;
    const lum = h => { const n = parseInt((/^#[0-9a-f]{6}$/i.test(h || '') ? h : '#888888').slice(1), 16); return 0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255); };
    const pick = (ACCS.find(x => x[0] === acc) || ACCS[0])[2];
    let C = pick || u[3] || team; if (!pick && Math.abs(lum(C) - lum(W)) < 45) C = lum(W) < 128 ? '#f4f1ea' : '#26272b';   // 기본 배색이 상의와 비슷하면 (어두운 상의엔 흰색) 잘 보이는 색으로
    return { W, C, N: u[4], P: mixHex(W, C, 0.6), pat: pat || 'plain' };
  }
  // 컴퓨터 구단 유니폼: 팀 색마다 정해진 디자인 (홈은 밝은 상의, 원정은 회색·팀 색·네이비·블랙 중 하나)
  //   구단 순서(GAME_DATA.teams)대로 [홈, 원정, 디자인] — 서로 겹치지 않게 골라 둔 조합. 목록에 없는 색이면 색으로 정한다
  const AI_UNIS = [['cream', 'black', 'hoop'], ['white', 'team', 'sleeve'], ['white', 'team', 'raglan'], ['white', 'gray', 'pin'], ['white', 'navy', 'plain'],
    ['white', 'gray', 'split'], ['white', 'navy', 'hoop'], ['cream', 'navy', 'sleeve'], ['white', 'team', 'split'], ['white', 'black', 'pin']];
  function aiUni(team, home) {
    const i = ((window.GAME_DATA && GAME_DATA.teams) || []).findIndex(t => t.color === team);
    const u = AI_UNIS[i >= 0 ? i % AI_UNIS.length : M._t.hash('uni' + team) % AI_UNIS.length];
    return uniCols(home ? u[0] : u[1], team, u[2]);
  }
  function uniBg(c) {
    return { pin: `repeating-linear-gradient(90deg, ${c.W} 0 3px, ${c.P} 3px 4px)`, raglan: `linear-gradient(${c.C} 0 6px, ${c.W} 6px)`, sleeve: `linear-gradient(90deg, ${c.C} 0 5px, ${c.W} 5px calc(100% - 5px), ${c.C} 0)`,
      hoop: `linear-gradient(${c.W} 0 7px, ${c.C} 7px 11px, ${c.W} 11px)`, split: `linear-gradient(90deg, ${c.C} 0 50%, ${c.W} 50%)` }[c.pat] || c.W;
  }
  const uniSwatch = (id, team, pat, acc) => { const c = uniCols(id, team, pat, acc); return `<span class="x-uni" style="--w:${c.W};--c:${c.C};--n:${c.N};--bg:${uniBg(c)}">${c.pat === 'plain' ? '<i></i>' : ''}</span>`; };
  function uniPicker(cur, team, act) {   // cur: { home, away, pat, acc_디자인 }
    const pat = cur.pat || 'plain', acc = accOf(cur), home = cur.home || UNI_DEF.home;
    const row = k => `<div class="x-uni-row"><b class="small">${k === 'home' ? '🏠 홈' : '✈️ 원정'}</b><div class="x-uni-list">${UNIS.map(([id, nm]) => `<button class="x-uni-btn ${(cur[k] || UNI_DEF[k]) === id ? 'on' : ''}" data-act="${act}" data-k="${k}" data-v="${id}">${uniSwatch(id, team, pat, acc)}<span class="tiny">${nm}</span></button>`).join('')}</div></div>`;
    const patRow = `<div class="x-uni-row"><b class="small">🎨 디자인</b><div class="x-uni-list">${PATS.map(([id, nm]) => `<button class="x-uni-btn ${pat === id ? 'on' : ''}" data-act="${act}" data-k="pat" data-v="${id}">${uniSwatch(home, team, id, cur['acc_' + id])}<span class="tiny">${nm}</span></button>`).join('')}</div></div>`;
    const accRow = `<div class="x-uni-row"><b class="small">🖌️ 배색 <span class="tiny muted">(${esc((PATS.find(x => x[0] === pat) || PATS[0])[1])} 디자인)</span></b><div class="x-uni-list">${ACCS.map(([id, nm]) => `<button class="x-uni-btn ${acc === id ? 'on' : ''}" data-act="${act}" data-k="acc_${pat}" data-v="${id}">${uniSwatch(home, team, pat, id)}<span class="tiny">${nm}</span></button>`).join('')}</div></div>`;
    return patRow + accRow + row('home') + row('away');
  }

  // ---------- 저장 ----------
  function vault() {
    let v = G().store.get(KEY_V, null);
    if (!v || !Array.isArray(v.cards)) v = { cards: [] };
    // 70차: 생성 선수 카드는 보관함에서 뺀다 (내 구단은 원래 구단 선수로 시작) · 보관함에서 고르던 시작 나이(age0)는 없앤다
    if (!v.v70) {
      v.cards = v.cards.filter(c => !c.filler);
      for (const c of v.cards) delete c.age0;
      if (v.lineup) for (const k in v.lineup) if (!v.cards.some(c => c.id === v.lineup[k])) delete v.lineup[k];
      v.v70 = 1; G().store.set(KEY_V, v);
    }
    // 마무리 포지션이 생기기 전 저장한 카드: 원작에서 마무리였던 불펜 카드를 마무리 칸으로 (3명까지)
    if (!v.clMig) {
      for (const c of v.cards) if (c.pos === 'RP' && c.closer && v.cards.filter(x => x.pos === 'CL').length < M.capOf('CL')) c.pos = 'CL';
      v.clMig = 1; G().store.set(KEY_V, v);
    }
    // 불펜 한 칸(RP)이던 내 라인업 → 불펜1 A(RP0)
    if (v.lineup && v.lineup.RP) { if (!v.lineup.RP0) v.lineup.RP0 = v.lineup.RP; delete v.lineup.RP; G().store.set(KEY_V, v); }
    // 생성 선수 카드: 없는 포지션(불펜 3 · 선발 5 미만)만 채운다. 보관함 슬롯을 똑같이 차지한다
    if (M.ensureFillers(v)) G().store.set(KEY_V, v);
    return v;
  }
  function saveVault(v) { return G().store.set(KEY_V, v); }
  // 리그모드·온라인모드는 같은 엔진·같은 화면. X.mode('lg' | 'on')로 어느 쪽 저장을 쓰는지만 다르다
  const MODE = {
    lg: { key: 'gg_league', title: '리그모드', view: 'x-league', others: '컴퓨터 9팀', otherOne: '컴퓨터 구단' },
    on: { key: 'gg_online2', title: '온라인모드', view: 'x-online', others: '유저 9팀', otherOne: '유저 구단' },
  };
  const ST = { lg: undefined, on: undefined };
  function league(m) {
    m = m || X.mode;
    if (ST[m] === undefined) {
      ST[m] = G().store.get(MODE[m].key, null);
      // 이도류 카드는 처음 고른 포지션 쪽으로만 — 예전 리그에 이도류로 들어가 있던 선수도 바꾼다
      if (ST[m] && ST[m].cards) for (const id in ST[m].cards) { const p = ST[m].cards[id]; if (p && p.role === 'TW') p.role = ['SP', 'RP', 'CL'].includes(p.pos) ? 'P' : 'B'; }
    }
    return ST[m];
  }
  function setLeague(v) { ST[X.mode] = v; saveLeague(); }
  function saveLeague() { const m = X.mode, s = ST[m]; if (s) { if (!G().store.set(MODE[m].key, s)) X.msg = '저장 공간이 부족해 저장하지 못했다'; } else G().store.del(MODE[m].key); }
  try { localStorage.removeItem('gg_online'); } catch (e) { }   // 예전 6팀·14슬롯 온라인 베타 저장 (형식이 달라 더 쓰지 않는다)
  const vaultById = () => Object.fromEntries(vault().cards.map(c => [c.id, c]));

  // ---------- 공용 조각 ----------
  function topbar(title, back) {
    return `<div class="topbar"><button class="btn small" data-act="${back ? 'x-go' : 'home'}" data-v="${back || ''}">${back ? '← 뒤로' : '홈'}</button><span class="title">${esc(title)}</span><span class="spacer"></span><span class="chip red">베타</span></div>`;
  }
  const av = (c, size) => `<canvas class="x-av" width="16" height="16" data-av="${+c.avatar || 1}" data-color="${esc(c.color || '#3d4a5c')}" style="width:${size || 34}px;height:${size || 34}px"></canvas>`;
  // 카드 위 작은 표시: 사용 횟수 점 3개 · 은퇴해 쉬는 중 · 다 씀
  const lifeBadge = c => { const u = M.usesOf(c), L = M.MB.age.lives, out = false, rest = c.rest && (c.rest.lg || c.rest.on); return `<span class="x-lifebadge ${rest ? 'rest' : ''}" title="온라인 사용 횟수">${rest ? '쉬는 중' : ''}${Array.from({ length: L }, (_, i) => `<i class="${i < u ? 'u' : ''}"></i>`).join('')}</span>`; };
  function miniCard(c, o) {
    o = o || {};
    return `<button class="x-card ${o.sel ? 'sel' : ''} ${c.filler ? 'x-filler' : ''}" data-act="${o.act || 'x-card'}" data-v="${esc(c.id)}" style="--team:${esc(c.color || '#3d4a5c')}">
      ${av(c)}<span class="x-card-t"><b>${esc(c.name)}</b><span class="tiny">${esc(M.POS_KO[c.pos] || c.pos)}${c.tw ? ' · 이도류' : ''}${c.filler ? ' · 생성 선수' : ''}</span></span>
      <span class="x-card-ovr"><b class="num">${c.ovr}</b><i>${c.filler ? '생성' : '최고'}</i></span>${c.filler || o.noLife ? '' : lifeBadge(c)}</button>`;
  }
  function tabs(key, list) { return `<div class="tabs">${list.map(([k, t]) => `<button class="${X[key] === k ? 'on' : ''}" data-act="x-tab" data-k="${key}" data-v="${k}">${t}</button>`).join('')}</div>`; }
  function msgBox() { if (!X.msg) return ''; const m = X.msg; X.msg = ''; return `<div class="panel x-msg small">${esc(m)}</div>`; }
  function bars(r, keys) {
    return `<div class="bars">${keys.map(k => { const v = Sim.disp(r[k]); return `<div class="bar"><span class="lbl">${Sim.LABEL[k]}</span><span class="trk"><span class="fill ${v >= 80 ? 'hi' : ''}" style="width:${v}%"></span></span><span class="v num">${v}</span></div>`; }).join('')}</div>`;
  }
  function sheet(html) { G().$modal.innerHTML = `<div class="overlay" data-act="x-close"><div class="sheet x-sheet">${html}</div></div>`; drawAvatars(G().$modal); }
  function closeSheet() { G().$modal.innerHTML = ''; }
  function drawAvatars(root) { (root || document).querySelectorAll('canvas.x-av').forEach(cv => G().drawAvatar(cv, +cv.dataset.av || 1, cv.dataset.color)); }
  const batLine = b => b && b.PA ? `${r3(Sim.AVG(b))} ${b.H}안타 ${b.HR}홈런 ${b.RBI}타점${b.SB ? ` ${b.SB}도루` : ""} · OPS ${r3(Sim.OPS(b))}` : '';
  const pitLine = p => p && p.outs ? `${p.W}승 ${p.L}패${p.SV ? ` ${p.SV}세이브` : ''}${p.HLD ? ` ${p.HLD}홀드` : ''} · ${ipT(p)}이닝 ERA ${f2(Sim.ERA(p))} ${p.K}K` : '';

  // ================================================================
  // 확장 모드 첫 화면
  // ================================================================
  function viewHub() {
    const lg = league('lg');
    return `${topbar('감독모드')}
      <div class="panel"><h3>골글 들고 명전으로 확장판</h3><div class="small">원작에서 키운 선수를 <b>보관함</b>에 저장하고, 내 구단 라인업에 넣어 시즌을 치른다. 선수는 원작 프로 시절 가장 높았던 <b>최고 OVR</b>을 기준으로 뛴다. 리그에 넣을 때 고른 나이부터 자라고 늙는다.</div></div>
      <button class="btn block x-hub-btn" data-act="x-go" data-v="x-league"><span>🏟️ 리그모드</span><span class="tiny muted">${lg ? `${esc(lg.club.emblem)} ${esc(lg.club.name)} · ${lg.cur.season}시즌` : '내 구단 vs 컴퓨터 9팀 · 144경기'}</span></button>
      <button class="btn block x-hub-btn x-soon" disabled aria-disabled="true"><span>🌐 온라인모드 <span class="chip">예정</span></span><span class="tiny muted">내 구단 vs 유저 9팀 · 준비 중</span></button>
      <div class="panel small muted">베타 버전이다. 기록은 이 브라우저에만 저장된다. 선수 보관함은 홈 화면에서 연다.</div>`;
  }

  // ================================================================
  // 선수 보관함
  // ================================================================
  // ---------- 경기장 형태 라인업 (골든글러브 라인업 그림) — 보관함·리그·온라인 공용 ----------
  const FIELD_POS = [['CF', 'lu-cf'], ['LF', 'lu-lf'], ['RF', 'lu-rf'], ['SS', 'lu-ss'], ['2B', 'lu-2b'], ['3B', 'lu-3b'], ['1B', 'lu-1b'], ['SP', 'lu-sp'], ['C', 'lu-c'], ['DH', 'x-lu-dh'], ['CL', 'x-lu-cl']];   // 지명타자는 포수 왼쪽, 마무리는 포수 오른쪽
  // get(key) → { attrs, label, item: { name, ovr, av, color, tw, star } | null, empty }
  //   attrs: '교체'(선수 고르기)를 여는 속성, info: '카드 보기'를 여는 속성. 칸을 누르면 교체·카드 보기 창 (빈 칸은 바로 교체)
  function fieldHTML(get, bench, extra) {   // extra: 경기장 안에 더 넣을 것 (버튼 등)
    X.faGet = get;
    const slot = (key, cls) => {
      const s = get(key), it = s.item;
      return `<div class="lu-slot ${cls} x-lu-slot ${it ? (it.hurt ? 'x-hurt' : '') : 'empty'}" data-act="x-fa" data-v="${esc(key)}">${it
        ? `<canvas class="x-av lu-av" width="16" height="16" data-av="${it.av}" data-color="${esc(it.color || '#3d4a5c')}"></canvas>
           <b class="lu-name">${it.hurt ? '🚑' : ''}${it.star ? '★' : ''}${esc(it.name)}</b><span class="lu-score num ${it.off ? 'x-offpos' : ''}">OVR ${it.ovr}${it.off ? '▼' : ''}</span>${it.cond != null ? gauge(it.cond) : ''}
           <span class="lu-pos">${esc(s.label)}${it.tw ? '<i class="lu-tw">이도류</i>' : ''}</span>`
        : `<div class="lu-empty">${s.empty || '+'}</div><span class="lu-pos">${esc(s.label)}</span>`}</div>`;
    };
    return `<div class="lu-field">
        <svg class="lu-bg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M50 98 L2 50 Q50 -6 98 50 Z" class="lu-grass"/><path d="M50 92 L24 66 L50 40 L76 66 Z" class="lu-dirt"/>
          <path d="M50 86 L30 66 L50 46 L70 66 Z" class="lu-infield"/><circle cx="50" cy="64" r="4" class="lu-dirt"/>
          <path d="M50 98 L2 50 M50 98 L98 50" class="lu-line"/>
        </svg>
        ${FIELD_POS.map(([k, c]) => slot(k, c)).join('')}${extra || ''}
      </div>
      <div class="lu-bench x-bench">${bench.map(k => typeof k === 'object' ? `<div class="x-bench-t">${esc(k.title)}</div>` : slot(k, 'lu-bn')).join('')}</div>`;
  }
  // 경기장 칸을 눌렀을 때: 교체 · 카드 보기
  // 경기장에서 선발을 누르면: 선발 로테이션 1~5선발 보기 (여기서는 바꾸지 않는다 — 투수 화면에서). 누르면 야구카드
  // 72차: 그라운드에서 선발을 누르면 — 로테이션이 한 바퀴 돌아 1선발 차례일 때는 순서 바꾸기(두 명을 차례로 누르면 맞바꾼다). 도는 중에는 보기만 (누르면 야구카드)
  function rotSheet(msg) {
    const lg = league(), lu = lg.lineup, nx = M.nextSp(lg), can = M.canReorderRot(lg) && lg.cur.phase !== 'post', sel = can ? X.rotSel : null;
    const rows = [0, 1, 2, 3, 4].map(i => { const p = M.lgPlayer(lg, lu.sp[i]); const act = can ? `data-act="x-rot-sel" data-v="${i}"` : p ? `data-act="x-pinfo" data-m="lg" data-v="${esc(p.id)}" data-s="SP"` : '';
      return p || can ? `<button class="x-pk-item ${sel === i ? 'sel' : !can && i === nx ? 'sel' : ''}" ${act}>${p ? candHtml(p, 'SP', true, sel === i ? '✔ 골랐다 — 바꿀 자리를 누르기' : !can && i === nx ? '▶ 다음 선발' : '', false, `${i + 1}선발`) : `<span class="chip">${i + 1}선발</span> <span class="muted">비어 있음</span>`}</button>` : `<div class="x-pk-item dis"><span class="chip">${i + 1}선발</span> <span class="muted">비어 있음</span></div>`; }).join('');
    const note = can ? '지금은 1선발 차례라 <b>로테이션 순서를 바꿀 수 있다</b>. 두 선발을 차례로 누르면 자리가 바뀐다.' : '<b>로테이션이 도는 중이라 순서를 바꿀 수 없다</b> (한 바퀴 돌아 1선발 차례가 되면 바꿀 수 있다). 누르면 야구카드.';
    sheet(`<h3>선발 로테이션</h3>${msg ? `<div class="small x-okline" style="margin-bottom:6px">${esc(msg)}</div>` : ''}<div class="small muted" style="margin-bottom:8px">${note} 다른 투수로 선발을 바꾸는 건 '⚾ 투수' 화면이나 [내 선수]에서 한다.</div>
      <div class="x-pk-list">${rows}</div><button class="btn small block" data-act="x-close-btn" style="margin-top:12px">닫기</button>`);
  }
  function faSheet(key) {
    const get = X.faGet; if (!get) return;
    const s = get(key), it = s.item;
    if (!it || !s.info) { sheet(`<button id="x-fa-go" ${s.attrs}></button>`); const b = document.getElementById('x-fa-go'); if (b) b.click(); return; }
    sheet(`<div class="row" style="gap:10px;align-items:center"><canvas class="x-av" width="16" height="16" data-av="${it.av}" data-color="${esc(it.color || '#3d4a5c')}" style="width:44px;height:44px"></canvas>
        <div style="flex:1"><b style="font-size:16px">${esc(it.name)}</b><div class="tiny muted">${esc(s.label)}</div></div><span class="x-pk-ovr"><b class="num">${it.ovr}</b></span></div>
      <div class="row" style="gap:8px;margin-top:14px"><button class="btn" ${s.attrs} style="flex:1">${s.rot ? "📋 선발 로테이션" : "🔁 교체"}</button><button class="btn" ${s.info} style="flex:1">🃏 카드 보기</button></div>
      <button class="btn small block" data-act="x-close-btn" style="margin-top:10px">닫기</button>`);
  }
  // 투수 체력 게이지 (다음 경기 기준). 리그·온라인 모드 안에서만 의미가 있다
  const condNow = p => { const lg = X.mode ? league() : null; return lg && lg.cur && p ? M.condOf(lg, p, M.nowDay(lg)) : null; };
  // 경기 중 지금 체력 %: 경기 전 컨디션에서 투구 수만큼 줄어든다 (한계 투구 수의 1.35배에서 0). 한계 투구 수(npTarget)쯤이면 약 25%
  const liveSta = st => { const c = condNow(st.p), base = c == null ? 100 : c; return Math.max(0, Math.round(base * (1 - (st.line.NP || 0) / ((st.npTarget || 100) * 1.35)))); };
  const gauge = (v, wide) => v == null ? '' : `<span class="x-gauge ${v >= 70 ? 'ok' : v >= 50 ? 'mid' : 'low'} ${wide ? 'wide' : ''}" title="체력 ${v}"><i style="width:${v}%"></i></span>`;
  const condTag = p => { const v = condNow(p); return v == null ? '' : `<span class="x-cond">${gauge(v, true)}<b class="num ${tiredNow(p) ? 'x-offpos' : ''}">${v}${tiredNow(p) ? '▼' : ''}</b></span>`; };
  const tiredNow = p => { const lg = X.mode ? league() : null; return lg && lg.cur && p ? M.tiredDrop(lg, p, M.nowDay(lg)) : 0; };
  // 체력 저하 설명: 화면 눈금으로 얼마나 떨어지나
  const tiredTxt = p => { const d = tiredNow(p); if (!d) return ''; const v = Sim.disp(p.r.ctl) - Sim.disp(Math.max(20, p.r.ctl - d)); return v ? `<div class="tiny x-warn">${esc(p.name)}: 체력이 떨어져 지금 던지면 구속·제구·구위·변화·체력 −${v}</div>` : ''; };
  // 부상 남은 경기 수 (리그·온라인 화면용)
  const hurtLeft = p => { const lg = X.mode ? league() : null; if (!lg || !lg.cur || !p || !lg.cur.inj) return 0; const u = lg.cur.inj[p.id] || 0, d = M.nowDay(lg); return u > d ? u - d : 0; };
  // 경기용 선수 → 그림 칸 (보관함 카드는 카드 얼굴, 나머지는 이름으로 정한 얼굴)
  function fieldItem(p, at, color, pit) {
    if (!p) return null;
    const vc = p.card ? vault().cards.find(c => c.id === p.card) : null;
    return { name: p.name, ovr: M.dispOvr(M.effR(p, at), at), off: !!M.offPenalty(p, at), av: vc ? (+vc.avatar || 1) : (M._t.hash(p.id) % 99991) + 1, color: vc ? vc.color : color, tw: p.role === 'TW', star: false, cond: pit ? condNow(p) : null, hurt: hurtLeft(p) };
  }

  // ---------- 내 라인업 (보관함) ----------
  // vault.lineup = { 자리: 카드 id } — 야수 8 + 지명타자 + 선발 + 불펜 5 + 마무리 1 (리그·온라인 그림과 같은 모양)
  const LU_BP = ['RP0', 'RP1', 'RP2', 'RP3', 'RP4'];   // 불펜 5 (리그·온라인과 같음)
  const LU_SLOTS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'SP', 'CL'];   // 보관함 내 라인업은 불펜 칸 없이 (경기장 그림의 선발·마무리까지만)
  const LU_KO = Object.assign({}, M.POS_KO, { CL: '마무리' }); LU_BP.forEach((k, i) => { LU_KO[k] = '불펜' + (i + 1); });
  const slotPos = k => /^RP/.test(k) ? 'RP' : k;
  // 지명타자는 타자라면 누구나, 나머지는 그 포지션으로 보관한 카드만. 이도류는 처음 고른 포지션 쪽으로만 (투수로 시작했으면 투수, 타자로 시작했으면 타자)
  const pitPos = p => p === 'SP' || p === 'RP' || p === 'CL';
  const canPlay = (c, slot) => slot === 'DH' ? (c.tw ? !pitPos(c.pos) : c.role === 'B') : c.pos === slotPos(slot);
  function myLineup(v) {
    const lu = v.lineup || {}, out = {};
    for (const k of LU_SLOTS) { const c = v.cards.find(x => x.id === lu[k] && canPlay(x, k)); if (c) out[k] = c; }
    return out;
  }
  // 한 선수는 한 자리에만: 다른 자리에 있던 같은 카드는 빼고 넣는다
  function luPut(vv, pos, id) {
    vv.lineup = vv.lineup || {};
    for (const k in vv.lineup) if (vv.lineup[k] === id) delete vv.lineup[k];
    if (id) vv.lineup[pos] = id; else delete vv.lineup[pos];
  }
  function luField(v) {
    const L = myLineup(v), n = Object.keys(L).length;
    const get = k => {
      const c = L[k];
      return { attrs: `data-act="x-lu-slot" data-v="${k}"`, info: c ? `data-act="x-card" data-v="${esc(c.id)}"` : '', label: LU_KO[k], empty: v.cards.some(x => canPlay(x, k)) ? '+' : '?',
        item: c ? { name: c.name, ovr: c.ovr, av: +c.avatar || 1, color: c.color, tw: c.tw } : null };
    };
    const ovrs = Object.values(L).map(c => c.ovr), avg = ovrs.length ? Math.round(ovrs.reduce((a, b) => a + b, 0) / ovrs.length) : 0;
    return `<div class="panel lu-panel x-lu">
      <div class="row" style="align-items:center;margin-bottom:8px"><b>내 라인업</b><span class="tiny muted" style="margin-left:6px">${n}/${LU_SLOTS.length}${n ? ` · 평균 최고 OVR ${avg}` : ''}</span><span class="spacer"></span>
        <button class="btn small" data-act="x-lu-auto">자동 편성</button>${n ? '<button class="btn small" data-act="x-lu-clear" style="margin-left:4px">비우기</button>' : ''}</div>
      ${fieldHTML(get, [])}
      <div class="tiny muted" style="margin-top:8px;text-align:center">자리를 누르면 그 포지션에 보관한 선수 중에서 고른다 · <b>+</b> 고를 선수 있음 · <b>?</b> 보관한 선수 없음</div></div>`;
  }
  function luPickSheet(pos) {
    X.luIds = null;   // 보관함 선택 창에는 ★(리그 라인업 표시)을 쓰지 않는다
    const v = vault(), cur = (v.lineup || {})[pos], L = myLineup(v), sp = slotPos(pos);
    const list = v.cards.filter(c => canPlay(c, pos)).sort((a, b) => (b.id === cur) - (a.id === cur) || (b.pos === sp) - (a.pos === sp) || b.ovr - a.ovr);   // 지금 고른 선수를 맨 위에
    const where = c => { const k = Object.keys(L).find(p => p !== pos && L[p].id === c.id); return k ? `<div class="tiny x-warn" style="margin:-2px 0 4px 6px">지금 내 라인업 ${LU_KO[k]} — 고르면 그 자리는 비워진다</div>` : ''; };
    sheet(`<h3>${LU_KO[pos]} 고르기</h3>${pos === 'DH' ? '<div class="small muted" style="margin-bottom:8px">지명타자는 어느 포지션 타자든 고를 수 있다.</div>' : ''}
      ${list.length ? `<div class="x-pk-list">${list.map(c => `<button class="x-pk-item ${c.id === cur ? "sel" : ""} ${c.filler ? "ghost" : ""}" data-act="x-lu-pick" data-v="${esc(c.id)}">${candHtml(M.cardPlayer(c), sp === "CL" ? "RP" : sp, c.role === "P" && !c.tw || sp === "SP" || sp === "RP" || sp === "CL", c.filler ? "생성 선수" : "", true)}${where(c)}</button>`).join("")}</div>`
        : `<div class="small muted">이 포지션에 보관한 선수가 없다. 원작에서 ${M.POS_KO[sp]}로 은퇴한 선수를 보관함에 저장하면 고를 수 있다.</div>`}
      <div class="row" style="gap:8px;margin-top:14px">${cur ? `<button class="btn small" data-act="x-lu-pick" data-v="" data-p="${pos}" style="flex:1">이 자리 비우기</button>` : ''}<button class="btn small" data-act="x-close-btn" style="flex:1">닫기</button></div>`);
    X.luPos = pos;
  }
  function viewVault() {
    const v = vault();
    const rows = M.VAULT_POS.map(pos => {
      const list = v.cards.filter(c => c.pos === pos);
      const empty = Math.max(0, M.capOf(pos) - list.length);
      return `<div class="x-vpos"><div class="x-vpos-h"><b>${M.POS_KO[pos]}</b><span class="tiny muted">${list.length}/${M.capOf(pos)}</span></div>
        <div class="x-vgrid">${list.map(c => miniCard(c)).join('')}${'<div class="x-card empty"><span class="tiny muted">빈 슬롯</span></div>'.repeat(empty)}</div></div>`;
    }).join('');
    return `${topbar('선수 보관함', X.vaultHome ? '' : 'x-hub')}${msgBox()}
      <button class="btn block x-hof-btn" data-act="x-hof">🏛 명예의 전당 <span class="tiny">${(v.hof || []).length}/${M.MB.age.hof}</span></button>
      ${luField(v)}
      <div class="panel small">원작에서 은퇴한 선수를 <b>은퇴 결산 화면의 '보관함에 저장'</b>으로 넣는다. 주 포지션 슬롯에 저장되고 포지션마다 ${M.MB.vaultPerPos}명까지(선발 6 · 불펜 7 · 마무리 2). 리그모드 라인업에 넣을 때 시작 나이(20~30세)를 고른다. 카드를 누르면 상세·삭제.</div>
      ${LOCAL ? `<div class="panel small"><b>개발용</b> (내 컴퓨터에서만 보임) — 봇이 원작 커리어를 자동으로 끝까지 돌려 카드를 만든다.<div class="row wrap" style="gap:6px;margin-top:8px">${M.VAULT_POS.map(p => `<button class="btn small" data-act="x-devcard" data-v="${p}">+ ${M.POS_KO[p]}</button>`).join('')}<button class="btn small" data-act="x-devcard" data-v="TW">+ 이도류</button></div></div>` : ''}
      <div class="panel">${rows}</div>`;
  }
  function cardRecords(c) {
    const out = [];
    const lg = league('lg'), on = league('on');
    const rec = (R, label) => {
      if (!R) return;
      const tb = {}, tp = {};
      for (const s of R.seasons) { if (s.b) addTo(tb, s.b); if (s.p) addTo(tp, s.p); }
      out.push(`<div class="x-rec"><b>${label}</b> · ${R.seasons.length}시즌${R.seasons.some(s => s.champ) ? ` · 우승 ${R.seasons.filter(s => s.champ).length}회` : ''}<div class="tiny">${[batLine(tb), pitLine(tp)].filter(Boolean).join('<br>') || '출전 기록 없음'}</div></div>`);
    };
    if (lg) rec(lg.cardRec['v:' + c.id], `리그모드 (${esc(lg.club.name)})`);
    if (on) rec(on.cardRec['v:' + c.id], `온라인모드 (${esc(on.club.name)})`);
    for (const L of c.bank || []) rec({ seasons: L.seasons }, `${L.mode === 'on' ? '온라인' : '리그'} · ${L.life}번째 생활 (${esc(L.club)})`);   // 은퇴·초기화로 끝난 지난 생활
    return out.join('') || '<div class="tiny muted">아직 모드 경기 기록이 없다. 원작 기록과 모드 기록은 따로 남는다.</div>';
  }
  function addTo(a, b) { for (const k in b) if (typeof b[k] === 'number') a[k] = (a[k] || 0) + b[k]; return a; }
  // 카드 생활: 사용 횟수(3번) · 모드별 지금 나이 · 은퇴해 쉬는 중 · 시작 나이 · 다시 쓰기 · 명예의 전당
  function lifeHTML(c) {
    const left = M.livesLeft(c), used = M.usesOf(c), lives = M.MB.age.lives, rest = c.rest || {}, hof = (vault().hof || []).length;
    const now = ['lg', 'on'].map(k => { const L = league(k), p = L && L.cards['v:' + c.id]; return p && p.age ? `${k === 'lg' ? '리그' : '온라인'} 지금 <b>${p.age}세</b> · OVR ${p.ovr}` : rest[k] ? `${k === 'lg' ? '리그' : '온라인'}에서 은퇴함` : ''; }).filter(Boolean);
    // 리그모드는 횟수 제한 없음. 사용 횟수(3번)는 온라인만
    return `<h4 class="x-h4">선수 생활</h4>
      <div class="small">🏟️ 리그모드: <b>횟수 제한 없이</b> 다시 쓸 수 있다</div>
      <div class="x-lives" style="margin-top:3px"><span class="small">🌐 온라인 사용 ${used}/${lives}</span>${Array.from({ length: lives }, (_, i) => `<i class="${i < used ? 'used' : ''}"></i>`).join('')}<span class="small">${left ? `${left}번 남음` : '<b>모두 씀</b> — 온라인 라인업엔 못 넣는다'}</span></div>
      ${now.length ? `<div class="small" style="margin-top:4px">${now.join(' · ')}</div>` : ''}
      <div class="tiny muted">시작 나이는 리그모드 라인업에 처음 넣을 때 고른다 (20~30세, 은퇴 전에는 못 바꾼다).</div>
      <div class="row wrap" style="gap:6px;margin-top:8px">${rest.lg || (rest.on && left) ? `<button class="btn small go" data-act="x-card-reuse" data-v="${esc(c.id)}" style="flex:1">🔄 다시 쓰기</button>` : ''}
        <button class="btn small" data-act="x-hof-add" data-v="${esc(c.id)}" style="flex:1" ${hof >= M.MB.age.hof ? 'disabled' : ''}>🏛 명예의 전당에 올리기 (${hof}/${M.MB.age.hof})</button></div>
      <div class="tiny muted" style="margin-top:4px">명예의 전당에 올리면 보관함에서 빠지고(슬롯이 빈다) 원작 카드와 리그·온라인 통산 기록이 함께 남는다.</div>`;
  }
  // ---------- 명예의 전당 (최대 10명): 원작 카드 + 리그·온라인 통산 ----------
  function saveBoth() { for (const m of ['lg', 'on']) { const s = league(m); if (s) G().store.set(MODE[m].key, s); } }
  function hofSheet() {
    const H = vault().hof || [];
    sheet(`<h3>🏛 명예의 전당 <span class="tiny muted">${H.length}/${M.MB.age.hof}</span></h3>
      <div class="small muted" style="margin-bottom:8px">보관함 카드 중 고른 선수를 올린다. 원작 카드와 리그·온라인에서 쌓은 통산 기록이 함께 남는다. 10명까지.</div>
      ${H.length ? `<div class="x-vgrid col">${H.map((e, i) => { const t = M.hofTotals(e.card); return `<button class="x-card x-hof-card" data-act="x-hof-card" data-v="${i}" style="--team:${esc(e.card.color || '#3d4a5c')}">${av(e.card)}<span class="x-card-t"><b>${esc(e.card.name)}</b><span class="tiny">${esc(M.POS_KO[e.card.pos] || e.card.pos)} · 모드 ${t.seasons}시즌${t.champ ? ` · 🏆${t.champ}` : ''}</span></span><span class="x-card-ovr"><b class="num">${e.card.ovr}</b><i>최고</i></span></button>`; }).join('')}</div>` : '<div class="small muted">아직 아무도 없다. 보관함에서 카드를 눌러 \'명예의 전당에 올리기\'.</div>'}
      ${(vault().mgrs || []).length ? `<h4 class="x-h4">👔 역대 감독</h4>${vault().mgrs.slice().reverse().map(m => `<div class="x-mgr-row small"><b>${esc(m.club)}</b> <span class="muted">${m.from}~${m.to} · ${m.seasons}시즌${m.mode === 'on' ? ' · 온라인' : ''}</span><span class="spacer"></span><span>${m.w}승 ${m.l}패${m.champ ? ` · 🏆${m.champ}` : ''}</span></div>`).join('')}` : ''}
      <button class="btn small block" data-act="x-close-btn" style="margin-top:12px">닫기</button>`);
  }
  // 리그 초기화 때: 이 감독 기록을 보관함에 남긴다 (최근 10명)
  function keepMgr(lg, vv) {
    const L = lg && lg.mgr && lg.mgr.log; if (!L || !L.length) return false;
    const m = { club: lg.club.name, mode: lg.mode === 'online' ? 'on' : 'lg', from: L[0].year, to: L[L.length - 1].year, seasons: L.length, w: L.reduce((a, x) => a + x.w, 0), l: L.reduce((a, x) => a + x.l, 0), champ: L.filter(x => x.champ).length, ps: L.filter(x => x.rank <= 5).length };
    (vv.mgrs || (vv.mgrs = [])).push(m); if (vv.mgrs.length > 10) vv.mgrs.shift();
    return true;
  }
  function hofCard(i) {
    const e = (vault().hof || [])[+i]; if (!e) return;
    const c = e.card, t = M.hofTotals(c), keys = c.role === 'P' ? Sim.PIT : Sim.BAT;
    sheet(`${cardFace({ name: c.name, num: c.num, color: c.color, av: +c.avatar || 1, ovr: c.ovr, ovrLbl: '최고 OVR', sub: `${M.POS_KO[c.pos]}${c.tw ? ' · 이도류' : ''}${c.team ? ' · 원작 ' + c.team : ''}`, emblem: (c.team || '⚾').slice(0, 2), r: c.r, keys, hof: true, foot: `🏛 헌액 · ${cardFoot(c)}` })}
      <h4 class="x-h4">원작 커리어</h4><div class="small">통산 WAR <b>${c.career.war}</b> · ${c.career.seasons}시즌 · ${c.career.retireAge}세 은퇴${c.career.hof ? ' · <b>원작 명예의 전당</b>' : ''}</div>
      ${c.career.aw && c.career.aw.length ? `<div class="stamps sm">${c.career.aw.map(a => `<span class="stamp ${/MVP|우승|골든/.test(a) ? 'gold' : ''}">${esc(a)}</span>`).join('')}</div>` : ''}
      <h4 class="x-h4">리그·온라인 통산 <span class="tiny muted">${t.seasons}시즌 · 생활 ${t.lives}번</span></h4>
      ${t.seasons ? `<div class="small">${[batLine(t.b), pitLine(t.p)].filter(Boolean).join('<br>')}</div><div class="tiny muted" style="margin-top:4px">${t.clubs.map(esc).join(' · ')}</div>` : '<div class="small muted">모드 경기 기록 없음</div>'}
      ${t.champ || t.titles.length ? `<div class="stamps sm">${t.champ ? `<span class="stamp gold">🏆 우승 ${t.champ}회</span>` : ''}${t.titles.map(x => `<span class="stamp ${/MVP|골든/.test(x) ? 'gold' : ''}">${esc(x)}</span>`).join('')}</div>` : ''}
      <div class="row" style="gap:8px;margin-top:12px"><button class="btn small" data-act="x-hof" style="flex:1">← 명예의 전당</button><button class="btn small" data-act="x-close-btn" style="flex:1">닫기</button></div>`);
  }
  function cardDetail(id) {
    const c = vault().cards.find(x => x.id === id); if (!c) return;
    const keys = c.role === 'P' ? Sim.PIT : Sim.BAT, opp = c.role === 'P' ? Sim.BAT : Sim.PIT;
    sheet(`${cardFace({ name: c.name, num: c.num, color: c.color, av: +c.avatar || 1, ovr: c.ovr, ovrLbl: c.filler ? 'OVR' : '최고 OVR', sub: `${M.POS_KO[c.pos]}${c.tw ? ' · 이도류' : ''}${c.filler ? ' · 생성 선수' : c.team ? ' · 원작 ' + c.team : ''}`, emblem: (c.team || '⚾').slice(0, 2), r: c.r, keys, opp: c.tw ? opp : null, oppLbl: c.role === 'P' ? '타격' : '투구', hof: c.career && c.career.hof, foot: c.filler ? '' : cardFoot(c) })}
      <div class="tiny muted" style="margin-top:6px">${c.filler ? "생성 선수 — 모든 능력치 65. 이 포지션에 선수가 모자라서 들어 있다. 보관함 슬롯을 차지하니, 꽉 찬 슬롯에 새 선수를 넣으려면 지우면 된다." : c.primeAge ? `원작 ${c.primeYear}시즌(${c.primeAge}세) 개막 능력치로 고정` : '나이별 기록이 없어 대표 카드 능력치로 고정'}${c.tw ? ` · 반대쪽 OVR ${c.oppOvr}` : ''}</div>
      ${c.filler ? "" : `<div class="small" style="margin-top:10px">원작 통산 WAR <b>${c.career.war}</b> · 점수 ${c.career.score} · ${c.career.seasons}시즌 · ${c.career.retireAge}세 은퇴${c.career.hof ? ' · <b>명예의 전당</b>' : ''}</div>`}
      ${c.career.aw && c.career.aw.length ? `<div class="stamps sm">${c.career.aw.map(a => `<span class="stamp ${/MVP|우승|골든/.test(a) ? 'gold' : ''}">${esc(a)}</span>`).join('')}</div>` : ''}
      <h4 class="x-h4">모드 기록</h4>${cardRecords(c)}${c.filler ? '' : lifeHTML(c)}
      ${(() => { const L = myLineup(vault()), k = Object.keys(L).find(s => L[s].id === c.id); return k ? `<div class="small x-ok" style="margin-top:12px">✔ 내 라인업 ${esc(LU_KO[k])}</div>` : `<button class="btn small block" data-act="x-lu-set" data-v="${esc(c.id)}" style="margin-top:12px">내 라인업 ${esc(M.POS_KO[c.pos])}로 넣기</button>`; })()}
      <div class="row" style="gap:8px;margin-top:8px"><button class="btn small red" data-act="x-del" data-v="${esc(c.id)}" style="flex:1">보관함에서 삭제</button><button class="btn small" data-act="x-close-btn" style="flex:1">닫기</button></div>
      <div class="tiny muted" style="margin-top:6px">삭제해도 지난 경기·시즌 기록은 기록실에 남는다.</div>`);
  }
  // 개발용: 봇 커리어로 카드 만들기
  function devCard(pos) {
    const tw = pos === 'TW';
    const role = tw ? 'B' : (pos === 'SP' || pos === 'RP' || pos === 'CL') ? 'P' : 'B';
    const p0 = tw ? 'SS' : pos === 'DH' ? '1B' : pos === 'CL' ? 'RP' : pos;   // 원작엔 지명타자로 시작하는 선택지가 없어 1루수로 키운다
    let best = null, bestAny = null;
    const old = Sim.OPT.fast; Sim.OPT.fast = true;
    try {
      for (let k = 0; k < (tw ? 8 : 4); k++) {   // 여러 명 돌려, 고른 포지션으로 끝난 커리어 중 가장 좋은 것
        const seed = (Math.random() * 1e9) >>> 0;
        const cands = Sim.makeCandidates({ rng: { s: seed ^ 0x9e3779b9 } }, role, M.simPos(p0));
        const keys = Sim.mainKeys({ role });
        const pick = cands.slice().sort((a, b) => keys.reduce((s, q) => s + b.r[q], 0) - keys.reduce((s, q) => s + a.r[q], 0))[0];
        const D = GAME_DATA, rp = a => a[Math.floor(Math.random() * a.length)];
        const st = Sim.newGame(seed, { name: rp(D.surnames) + rp(D.given1) + rp(D.given2), num: 1 + seed % 99, role, pos: p0, r: pick.r, school: 'strong', avatar: seed % 99991, closer: pos === 'CL' });
        let g = 0;
        while (!st.done && g++ < 40) { Sim.playSeason(st); let g2 = 0; while (st.pending.length && g2++ < 20) { const it = st.pending[0]; let i = it.safe || 0; if (tw && it.id === 'twoway') i = 0; Sim.choose(st, Math.min(i, it.ch.length - 1)); } }
        if (!st.done) continue;
        const c = M.cardFromCareer(st, { color: G().TEAMCOLOR(st.final.mainTeam || st.me.team), team: st.final.mainTeamName });
        if (tw && !c.tw) continue;
        if (!bestAny || c.ovr > bestAny.ovr) bestAny = c;
        if ((tw || c.pos === pos) && (!best || c.ovr > best.ovr)) best = c;
      }
    } finally { Sim.OPT.fast = old; }
    // 커리어 도중 포지션을 옮겨 다른 자리로 끝났으면, 테스트 카드라 고른 포지션으로 맞춰 준다
    if (!best && bestAny && !tw) { best = bestAny; best.pos = pos; best.ovr = M.dispOvr(best.r, pos); }
    if (!best) { X.msg = tw ? '이도류 커리어가 나오지 않았다. 다시 눌러 보자.' : '커리어를 만들지 못했다'; return; }
    best.dev = true;
    const v = vault(); const r = M.vaultAdd(v, best);
    if (r.ok) { saveVault(v); X.msg = `테스트 카드: ${best.name} (${M.POS_KO[best.pos]}, 최고 OVR ${best.ovr}) 저장`; }
    else X.msg = r.why === 'full' ? `${M.POS_KO[best.pos]} 슬롯이 가득 찼다 (${best.name} OVR ${best.ovr}은 저장 안 함)` : '저장 실패';
  }

  // 시작 나이 고르기: 전성기 나이 ~ 5살 어리게 (기본 4살). 어릴수록 낮은 능력치로 시작해 전성기에 카드 능력치에 닿는다 (오래 쓰지만 초반엔 약하다)
  function ageRow(c, cur, act, id) {
    const pa = M.primeAgeOf(c), sel = cur || M.startAgeOf(c), opts = Array.from({ length: M.MB.age.young + 1 }, (_, i) => pa - M.MB.age.young + i);
    return `<div class="x-agerow"><div class="small"><b>시작 나이</b> <span class="tiny muted">전성기 ${pa}세${c.primeAge ? '' : ' (기록 없음 → 28세로)'} · 어리게 넣으면 1살에 능력치 −${M.MB.age.grow}에서 시작해 해마다 자란다</span></div>
      <div class="x-agebtns">${opts.map(a => `<button class="x-agebtn ${a === sel ? 'on' : ''}" data-act="${act}" data-v="${a}" ${id ? `data-id="${esc(id)}"` : ''}><b class="num">${a}세</b><span class="tiny">${a === pa ? '전성기' : `−${(pa - a) * M.MB.age.grow}`}</span></button>`).join('')}</div></div>`;
  }
  // ---------- 은퇴 화면: 보관함에 저장 ----------
  function retirePanel(st) {
    if (!st || !st.final) return '';
    let card;
    try { card = M.cardFromCareer(st, G().cardData(st)); } catch (e) { return ''; }
    const v = vault(), have = v.cards.find(c => c.id === card.id);
    if (have) return `<div class="panel reveal x-save"><b>🗂️ 보관함에 저장됨</b><div class="small muted">${esc(M.POS_KO[have.pos])} 슬롯 · 최고 OVR ${have.ovr}</div><button class="btn small" data-act="x-go" data-v="x-vault" style="margin-top:8px">보관함 보기</button></div>`;
    const chk = M.vaultCheck(v, card);
    return `<div class="panel reveal x-save"><div class="row" style="align-items:center;gap:10px"><div style="flex:1"><b>🗂️ 확장 모드 보관함</b><div class="small muted">${esc(M.POS_KO[card.pos])} 슬롯 ${chk.same.length}/${M.capOf(card.pos)} · 최고 OVR <b>${card.ovr}</b></div></div>
      <button class="btn small primary" data-act="x-save">보관함에 저장</button></div>
      <div class="tiny muted" style="margin-top:6px">저장한 선수는 리그모드·온라인모드 라인업에 넣을 수 있다. 원작 기록은 그대로 남는다.</div></div>`;
  }
  function saveFromRetire() {
    const st = G().App.st; if (!st || !st.final) return;
    const card = M.cardFromCareer(st, G().cardData(st));   // 70차: 시작 나이는 리그 라인업에 넣을 때 고른다
    const v = vault(), chk = M.vaultCheck(v, card);
    if (chk.ok) { M.vaultAdd(v, card); saveVault(v); G().render(); return; }
    if (chk.why === 'dup') { G().render(); return; }
    X.newCard = card; X.sel = null; fullSheet();
  }
  function fullSheet() {
    const card = X.newCard, same = vault().cards.filter(c => c.pos === card.pos);
    sheet(`<h3>${esc(M.POS_KO[card.pos])} 슬롯이 가득 찼다</h3><div class="small muted">기존 카드 한 장을 골라 삭제하면 새 선수를 저장한다. 취소하면 기존 카드는 그대로.</div>
      <h4 class="x-h4">새 선수</h4>${miniCard(card, { act: 'x-noop' })}
      <h4 class="x-h4">기존 카드 (삭제할 카드 선택)</h4><div class="x-vgrid col">${same.map(c => miniCard(c, { act: 'x-pickdel', sel: X.sel === c.id })).join('')}</div>
      <div class="row" style="gap:8px;margin-top:14px"><button class="btn small red" data-act="x-replace" style="flex:1.4" ${X.sel ? '' : 'disabled'}>${X.sel ? `${esc((same.find(c => c.id === X.sel) || {}).name)} 삭제하고 저장` : '삭제할 카드를 고르세요'}</button><button class="btn small" data-act="x-close-btn" style="flex:1">취소</button></div>`);
  }

  // ================================================================
  // 박스스코어
  // ================================================================
  function boxSheet(box, teamName, playerName, label) {
    const inn = Math.max(9, box.inn);
    const cols = Array.from({ length: inn }, (_, i) => i + 1);
    const H = t => (box.b[t] || []).reduce((a, r) => a + r[4], 0), BB = t => (box.b[t] || []).reduce((a, r) => a + r[8], 0);
    const ER = (box.e || []);   // 팀 실책 [원정, 홈] (예전 박스스코어엔 없음)
    const lineRow = (t, i) => `<tr><td>${esc(teamName(t))}</td>${cols.map(c => `<td>${box.ln[i][c - 1] == null ? (c <= box.inn ? 'X' : '') : box.ln[i][c - 1]}</td>`).join('')}<td><b>${box.sc[i]}</b></td><td>${H(t)}</td><td>${ER[i] != null ? ER[i] : '-'}</td><td>${BB(t)}</td></tr>`;
    // 타자: 타수 · 득점 · 안타 · 타점 · 홈런 · 볼넷 · 삼진 · 도루 (포지션은 적지 않는다, 교체만 표시)
    const batT = t => `<div class="tbl-scroll"><table class="lg x-box"><tr><th></th><th class="nm">타자</th><th>타수</th><th>득점</th><th>안타</th><th>타점</th><th>홈런</th><th>볼넷</th><th>삼진</th><th>도루</th></tr>${(box.b[t] || []).map((r, i) => `<tr><td>${r[14] ? "" : (r[15] != null ? r[15] + 1 : i + 1)}</td><td class="nm">${r[14] ? "↳ " : ""}${esc(playerName(r[0]))}${r[14] === "PH" || r[14] === "PHF" ? ' <span class="tiny muted">대타</span>' : r[14] === "DEF" ? ' <span class="tiny muted">대수비</span>' : ''}</td><td>${r[3]}</td><td>${r[10]}</td><td>${r[4]}</td><td>${r[11]}</td><td>${r[7]}</td><td>${r[8]}</td><td>${r[9]}</td><td>${r[12] || 0}</td></tr>`).join('')}</table></div>`;
    // 투수: 이닝 · 피안타 · 실점 · 자책 · 4사구 · 삼진 · 피홈런, 이름 옆에 승·패·세이브·홀드
    const DEC = { W: '승', L: '패', S: '세이브', H: '홀드' };
    const pitT = t => `<div class="tbl-scroll"><table class="lg x-box"><tr><th class="nm">투수</th><th></th><th>이닝</th><th>투구</th><th>피안타</th><th>실점</th><th>자책</th><th>4사구</th><th>삼진</th><th>피홈런</th></tr>${(box.p[t] || []).map(r => `<tr><td class="nm">${esc(playerName(r[0]))}</td><td class="x-decc">${r[8] ? `<b class="x-dec ${r[8]}">${DEC[r[8]]}</b>` : ''}</td><td>${ipT({ outs: r[1] })}</td><td>${r[11] != null ? r[11] : '-'}</td><td>${r[3]}</td><td>${r[4]}</td><td>${r[10] != null ? r[10] : r[4]}</td><td>${r[5]}</td><td>${r[6]}</td><td>${r[7]}</td></tr>`).join('')}</table></div>`;
    const notes = (box.notes || []).map(n => `<div class="x-note">⚠ ${esc(teamName(n.t))}: ${esc(n.txt)}</div>`).join('');
    sheet(`<div class="row" style="align-items:center"><b>${esc(teamName(box.a))} ${box.sc[0]} : ${box.sc[1]} ${esc(teamName(box.h))}</b><span class="spacer"></span><span class="tiny muted">${box.win ? '' : '무승부 · '}${box.inn}회</span></div>
      <div class="tiny muted">${esc(label || box.id)}</div>
      <div class="tbl-scroll" style="margin-top:8px"><table class="lg x-line"><tr><th>팀</th>${cols.map(c => `<th>${c}</th>`).join('')}<th>R</th><th>H</th><th>E</th><th>B</th></tr>${lineRow(box.a, 0)}${lineRow(box.h, 1)}</table></div>
      ${notes ? `<div style="margin-top:8px">${notes}</div>` : ''}
      ${[box.a, box.h].map(t => `<h4 class="x-h4">${esc(teamName(t))}</h4>${batT(t)}${pitT(t)}`).join('')}
      <button class="btn small block" data-act="x-close-btn" style="margin-top:12px">닫기</button>`);
  }

  // ================================================================
  // 리그모드
  // ================================================================
  function lgTeamName(lg, id) { const t = lg.teams.find(x => x.id === id); return t ? t.name : id; }
  const luSet = lg => { const lu = lg && lg.lineup; return new Set(lu ? [].concat(lu.bat.map(x => x.id), lu.sp, [lu.CL, lu.CL2], lu.SU || [], lu.MR || [], lu.BN || []).filter(Boolean) : []); };   // 라인업 칸에 든 선수 (후보 포함, 남는 불펜 LR은 제외)
  function lgName(lg, id) { const p = M.lgPlayer(lg, id); return p ? p.name + (luSet(lg).has(id) ? ' ★' : '') : id; }
  function viewLeagueCreate() {
    const c = X.create || (X.create = { slot: 'HH', name: '', emblem: '🦅', color: null });
    const team = GAME_DATA.teams.find(t => t.id === c.slot);
    return `${topbar(MODE[X.mode].title + ' · 구단 만들기', 'x-hub')}${msgBox()}
      <div class="panel"><h3>1. 이어받을 구단 슬롯</h3><div class="small muted">홈구장·일정을 이어받고 이름과 엠블럼을 내 구단으로 바꾼다. 원래 그 구단 선수가 포지션마다 한 명씩(선발 5 · 불펜 5 · 마무리 1) 이름만 조금 바뀌어 남는다. 보관함 선수는 라인업에 넣을 때 나이를 골라 투입한다.</div>
        <div class="x-teamgrid">${GAME_DATA.teams.map(t => `<button class="x-team ${c.slot === t.id ? 'on' : ''}" data-act="x-cr" data-k="slot" data-v="${t.id}" style="--team:${t.color}">${esc(t.name)}</button>`).join('')}</div></div>
      <div class="panel"><h3>2. 구단 이름</h3><input id="x-club-name" class="x-input" maxlength="12" placeholder="${esc(team.name)} 자리의 새 이름" value="${esc(c.name)}"></div>
      <div class="panel"><h3>3. 엠블럼과 색</h3><div class="x-emb">${EMBLEMS.map(e => `<button class="${c.emblem === e ? 'on' : ''}" data-act="x-cr" data-k="emblem" data-v="${e}">${e}</button>`).join('')}</div>
        <div class="x-colors">${[team.color].concat(COLORS.filter(x => x.toLowerCase() !== String(team.color).toLowerCase())).map(col => `<button class="${(c.color || team.color) === col ? 'on' : ''}" data-act="x-cr" data-k="color" data-v="${col}" style="background:${col}"></button>`).join('')}</div></div>
      <div class="panel"><h3>4. 유니폼</h3><div class="small muted">홈 경기와 원정 경기에 입을 유니폼</div>${uniPicker(c.uni || {}, c.color || team.color, 'x-cr-uni')}</div>
      <div class="panel small muted">${X.mode === 'on' ? '다른 9팀은 유저 구단이다 (베타: 가상 유저 — 각자 원작에서 키운 선수 몇 명을 데리고 있다). 리그모드와 규칙은 같다. ' : '다른 9팀은 컴퓨터 구단이다. '}첫해 영입 인원 제한·연봉 한도 없음. 보관함 선수(${vault().cards.length}명)는 만든 뒤 '라인업' 탭에서 자유롭게 넣는다.</div>
      <button class="btn go block" data-act="x-lg-create" style="margin-top:14px">${esc(c.emblem)} 구단 창단</button>`;
  }
  // ---------- 원작 커리어 모드 화면 그대로 쓰기 (순위표·기록실·구단 기록·시상·포스트시즌·로딩) ----------
  // 원작 화면 함수는 st(커리어 상태)에서 구단 이름(st.lg.teams)과 내 구단(st.me.team)만 쓴다
  const fakeSt = (teams, my) => ({ lg: { teams: teams.map(t => ({ id: t.id, name: t.name })) }, me: { team: my }, L: {} });
  function leagueTabHTML(st, sum, title, psN, extra) {
    const g = G(), App = g.App;
    const L = { standings: sum.standings, post: { seeds: sum.standings.slice(0, psN).map(s => s.id) }, stats: sum.stats, teams: sum.standings };
    const S = sum.stats, kind = App.recKind || 'bat', sortKey = kind === 'bat' ? (App.recBat || 'OPS') : (App.recPit || 'ERA');
    const recs = `<div class="seg" style="margin-bottom:8px">${[['bat', '타자'], ['pit', '투수']].map(([k, t]) => `<button class="${kind === k ? 'on' : ''}" data-act="reckind" data-v="${k}">${t} 기록실</button>`).join('')}</div>${g.recTable(st, S, kind, S[kind], sortKey, { qualify: true, limit: 20, rank: true, team: true, act: 'recsort' })}`;
    const teamPanel = App.lgTeam && sum.standings.some(t => t.id === App.lgTeam) ? g.teamRoster(st, L, App.lgTeam) : '';
    return `<div class="panel"><h3>${esc(title)} 순위</h3>${g.standingsHTML(st, L, {})}<div class="tiny muted" style="margin-top:4px">구단을 누르면 소속 선수 기록이 열린다</div>${extra || ''}</div>
      ${teamPanel}
      <div class="panel"><h3>기록실 TOP 20</h3>${recs}</div>
      ${sum.awards ? `<div class="panel"><h3>시상</h3>${g.awardsHTML(st, sum.awards)}</div>` : ''}`;
  }
  // 포스트시즌 (원작 viewPost와 같은 모양). rv = { i: 공개 중인 라운드, shown: 공개한 경기 수 }
  function psHTML(P, tn, myId, rv, boxAct) {
    const seed = id => P.seeds.indexOf(id) + 1;
    const tag = id => id ? `<span class="${id === myId ? 'my-team' : ''}">${esc(tn(id))}</span> <span class="tiny muted">${seed(id) || ''}위</span>` : '앞 시리즈 승자';
    return P.rounds.map((r, i) => {
      const live = rv && rv.i === i, ahead = rv && rv.i < i;
      if ((!r.games.length && !r.winner) || ahead) return `<div class="ps-round wait"><div class="ps-name">${esc(r.name)}</div><div class="small muted">${tag(r.hi)} vs ${ahead ? '앞 시리즈 승자' : tag(r.lo)}</div></div>`;
      const shown = live ? rv.shown : r.games.length;
      let a = r.adv || 0, b = 0;
      const games = r.games.slice(0, shown).map((g, gi) => {
        if (g.win === r.hi) a++; else if (g.win === r.lo) b++;
        const hiR = g.h === r.hi ? g.sc[1] : g.sc[0], loR = g.h === r.hi ? g.sc[0] : g.sc[1];
        return `<div class="game ${live && gi === shown - 1 ? 'new' : ''}" data-act="${boxAct}" data-v="${esc(g.id)}"><span class="tiny muted">${gi + 1}차전${g.win ? '' : ' (무)'}</span><span class="${g.win === r.hi ? 'w' : ''}">${esc(tn(r.hi))} ${hiR}</span><span class="muted">:</span><span class="${g.win === r.lo ? 'w' : ''}">${loR} ${esc(tn(r.lo))}</span></div>`;
      }).join('');
      const done = r.winner && !(live && shown < r.games.length);
      const mine = r.hi === myId || r.lo === myId;
      return `<div class="ps-round ${done ? 'done' : 'cur'} ${mine ? 'mine' : ''}">
        <div class="ps-name">${esc(r.name)}</div><div class="small">${tag(r.hi)} vs ${tag(r.lo)}</div>
        <div class="ps-score num">${a} - ${b}${r.adv ? ' <span class="tiny muted">(어드밴티지 포함)</span>' : ''}</div>
        ${games ? `<div class="games">${games}</div>` : ''}
        ${done ? `<div class="ps-res"><b>${esc(tn(r.winner))}</b> 시리즈 승리 (${Math.max(a, b)}-${Math.min(a, b)})${r.winner === myId ? ' · 다음 라운드로!' : mine ? ' · 우리 팀의 가을은 여기까지' : ''}</div>` : ''}</div>`;
    }).join('');
  }
  // 경기를 한 경기씩 공개 (원작 psPlay처럼 0.65초 간격). chain이면 다음 라운드까지 이어서
  function reveal(mode, P, from, chain) {
    X.rvMode = mode; X.rv = { i: from, shown: 0 };
    G().render();
    const step = () => {
      const rv = X.rv; if (!rv) return;
      const r = P.rounds[rv.i];
      if (rv.shown < r.games.length) { rv.shown++; G().render(); setTimeout(step, 650); return; }
      if (chain && rv.i < P.rounds.length - 1) { rv.i++; rv.shown = 0; G().render(); setTimeout(step, 700); return; }
      setTimeout(() => { X.rv = null; G().render(); }, 600);
    };
    setTimeout(step, 450);
  }
  // 로딩 화면 (원작 viewLoading과 같은 모양). 계산은 먼저 끝내고 화면만 보여 준다
  function runLoading(o, work, after) {
    busy(work);
    const App = G().App, back = App.view;
    X.loading = { year: o.year, sub: o.sub, msgs: o.msgs, p: 0 };
    App.view = 'x-loading'; G().render(); window.scrollTo(0, 0);
    const dur = o.dur || 1800, t0 = performance.now();
    const tick = () => {
      if (App.view !== 'x-loading') return;
      const L = X.loading; L.p = Math.min(1, (performance.now() - t0) / dur);
      const bar = document.querySelector('.ld-bar span'), msg = document.querySelector('.ld-msg');
      if (bar) bar.style.width = Math.round(L.p * 100) + '%';
      if (msg) msg.textContent = L.msgs[Math.min(L.msgs.length - 1, Math.floor(L.p * L.msgs.length))] + '…';
      if (L.p >= 1) { setTimeout(() => { if (App.view !== 'x-loading') return; App.view = back; X.loading = null; G().render(); window.scrollTo(0, 0); if (after) after(); }, 250); return; }
      setTimeout(tick, 33);
    };
    setTimeout(tick, 33);
  }
  function viewLoadingX() {
    const L = X.loading; if (!L) return viewHub();
    const i = Math.min(L.msgs.length - 1, Math.floor(L.p * L.msgs.length));
    return `<div class="loading-screen"><div class="ld-year num">${esc(L.year)}</div><div class="ld-sub">${esc(L.sub)}</div><div class="ld-ball" aria-hidden="true"></div>
      <div class="ld-bar"><span style="width:${Math.round(L.p * 100)}%"></span></div><div class="ld-msg">${esc(L.msgs[i])}…</div></div>`;
  }
  const LD_SEASON = ['스프링캠프 출발', '시범경기 점검', '개막전', '전반기 일정 소화 중', '올스타 브레이크', '후반기 순위 싸움', '정규시즌 최종전'];
  function champBanner(title, name, mine, line) {
    return `<div class="panel reveal champ-banner ${mine ? 'mine' : ''}"><div class="tiny muted">${esc(title)}</div><div class="champ-name">${esc(name)}</div>${mine ? '<div class="small">우리가 해냈다! 우승 반지를 낀다.</div>' : line ? `<div class="small">우리 팀: ${esc(line)}</div>` : ''}</div>`;
  }
  function myPostLine(P, my) {
    if (!P || P.seeds.indexOf(my) < 0) return '포스트시즌 진출 실패';
    let last = null; for (const r of P.rounds) if (r.hi === my || r.lo === my) last = r;
    return last ? (last.winner === my ? '우승' : `${last.name} 탈락`) : '';
  }
  function postLines(P, tn) {
    return P ? P.rounds.filter(r => r.winner).map(r => { const w = M.seriesWins(r); return `${esc(r.name)}: <b>${esc(tn(r.winner))}</b> ${Math.max(w[0], w[1])}-${Math.min(w[0], w[1])} <span class="muted">vs ${esc(tn(r.winner === r.hi ? r.lo : r.hi))}</span>`; }).join('<br>') : '';
  }

  // ================================================================
  // 리그모드 화면
  // ================================================================
  function lgFake(lg) { return fakeSt(lg.teams, lg.my); }
  function viewLeague() {
    const lg = league();
    if (!lg) return viewLeagueCreate();
    M.signCards(lg, vault());
    const cur = lg.cur, stand = M.leagueStandings(lg), me = stand.find(s => s.id === lg.my);
    const phaseTxt = cur.phase === 'reg' ? `다음 경기 ${M.dateTxt(lg.year, cur.day)}` : cur.phase === 'regDone' ? '정규시즌 종료' : cur.phase === 'post' ? '포스트시즌' : '시즌 종료';
    if (!['prog', 'lineup', 'league', 'cards', 'hist'].includes(X.tab)) X.tab = 'prog';
    return `${topbar(MODE[X.mode].title, 'x-hub')}${msgBox()}
      <div class="row" style="justify-content:flex-end;margin:0 0 6px"><button class="btn small" data-act="x-lg-reset">🔄 리그 초기화</button></div>
      <div class="panel x-club" style="--team:${esc(lg.club.color)}"><span class="x-emb-big">${esc(lg.club.emblem)}</span><div style="flex:1"><b>${esc(lg.club.name)}</b><div class="tiny">${lg.year} 시즌 (${cur.season}시즌째) · ${phaseTxt}</div></div>
        <button class="btn small ghost x-club-uni" data-act="x-uni-open" title="유니폼">${uniSwatch((lg.club.uni || UNI_DEF).home, lg.club.color, (lg.club.uni || UNI_DEF).pat, accOf(lg.club.uni))}${uniSwatch((lg.club.uni || UNI_DEF).away, lg.club.color, (lg.club.uni || UNI_DEF).pat, accOf(lg.club.uni))}</button><div class="x-club-rec"><b class="num">${me.w}-${me.l}${me.t ? '-' + me.t : ''}</b><span class="tiny">${me.w + me.l + me.t ? me.rank + '위' : '개막 전'}</span></div></div>
      ${tabs('tab', [['prog', '진행'], ['lineup', '라인업'], ['league', '리그'], ['cards', '내 선수'], ['hist', '지난 시즌']])}
      ${X.tab === 'prog' ? lgProg(lg) : X.tab === 'lineup' ? lgLineupTab(lg) : X.tab === 'league' ? lgLeagueTab(lg) : X.tab === 'cards' ? lgCards(lg) : lgHist(lg)}
      `;
  }
  function lgLeagueTab(lg) {
    const sum = M.leagueSummary(lg, false);
    if (lg.cur.awards) sum.awards = lg.cur.awards;
    const pl = lg.cur.phase === 'done' ? postLines(lg.cur.post, id => lgTeamName(lg, id)) : '';
    return leagueTabHTML(lgFake(lg), sum, `${lg.year} ${MODE[X.mode].title}`, 5, pl ? `<div class="small" style="margin-top:10px">${pl}</div>` : '');
  }
  // 경기 날짜 표시: 정규시즌은 달력 날짜, 포스트시즌은 시리즈 이름 + 날짜
  const PS_KEY = { WC: 0, SPO: 1, PO: 2, KS: 3 }, PS_NAME = { WC: '와일드카드', SPO: '준PO', PO: 'PO', KS: '한국시리즈' };
  function gameLabel(lg, b) {
    if (!b.post) return M.dateTxt(lg.year, b.day);
    const m = /-(WC|SPO|PO|KS)(\d+)$/.exec(b.id); if (!m) return '포스트시즌';
    return `${M.postDate(lg.year, lg.cur.sched.length, PS_KEY[m[1]], +m[2] - 1)} ${PS_NAME[m[1]]} ${m[2]}차전`;
  }
  function myGameRow(lg, id) {
    const b = lg.cur.myBox[id]; if (!b) return '';
    const home = b.h === lg.my, opp = home ? b.a : b.h, my = home ? b.sc[1] : b.sc[0], ot = home ? b.sc[0] : b.sc[1];
    const res = b.win == null ? '무' : b.win === lg.my ? '승' : '패';
    const tag = gameLabel(lg, b);
    return `<button class="x-game ${res === '승' ? 'w' : res === '패' ? 'l' : ''}" data-act="x-lg-box" data-v="${esc(id)}"><span class="tiny muted">${esc(tag)}</span><span>${home ? 'vs' : '@'} ${esc(lgTeamName(lg, opp))}</span><b class="num">${my}:${ot}</b><span class="x-res">${res}</span></button>`;
  }
  // ---------- 일정 달력: 내 구단 경기 (지난 경기는 결과, 앞으로는 상대·홈/원정) ----------
  function calHTML(lg) {
    const cur = lg.cur, y = lg.year, my = lg.my, tn = id => lgTeamName(lg, id);
    const games = {};   // 'm-d' → { d, opp, home, res }
    let first = null, last = null;
    cur.sched.forEach((day, d) => {
      const g = day.find(([a, h]) => a === my || h === my); if (!g) return;
      const dt = M.gameDate(y, d), key = dt.m + '-' + dt.d, id = `L${cur.season}-D${d + 1}-${g[0]}-${g[1]}`, sc = cur.done[id];
      const home = g[1] === my, res = sc ? { me: home ? sc[1] : sc[0], op: home ? sc[0] : sc[1], id } : null;
      games[key] = { d, opp: home ? g[0] : g[1], home, res };
      if (first == null) first = dt.m; last = dt.m;
    });
    const nextM = M.gameDate(y, Math.min(cur.day, cur.sched.length - 1)).m;
    const mm = Math.max(first, Math.min(last, X.calM && X.calM.y === y ? X.calM.m : nextM));
    const start = new Date(Date.UTC(y, mm - 1, 1)), days = new Date(Date.UTC(y, mm, 0)).getUTCDate(), pad = start.getUTCDay();
    const cells = [];
    for (let i = 0; i < pad; i++) cells.push('<div class="x-cal-c empty"></div>');
    for (let dd = 1; dd <= days; dd++) {
      const g = games[mm + '-' + dd], isNext = g && g.d === cur.day;
      if (!g) { cells.push(`<div class="x-cal-c"><span class="x-cal-n">${dd}</span></div>`); continue; }
      const r = g.res, wl = r ? (r.me > r.op ? 'w' : r.me < r.op ? 'l' : 't') : '';
      const inner = `<span class="x-cal-n">${dd}</span><span class="x-cal-o">${g.home ? '' : '@'}${esc(tn(g.opp).slice(0, 4))}</span>${r ? `<span class="x-cal-r ${wl}">${wl === 'w' ? '승' : wl === 'l' ? '패' : '무'} ${r.me}:${r.op}</span>` : `<span class="x-cal-h">${g.home ? '홈' : '원정'}</span>`}`;
      cells.push(r && cur.myBox[r.id] ? `<button class="x-cal-c game ${wl}" data-act="x-lg-box" data-v="${esc(r.id)}">${inner}</button>` : `<div class="x-cal-c game ${isNext ? 'next' : ''} ${g.home ? 'home' : ''}">${inner}</div>`);
    }
    const nav = (dv, on) => `<button class="btn small" data-act="x-cal" data-v="${dv}" ${on ? '' : 'disabled'}>${dv < 0 ? '◀' : '▶'}</button>`;
    return `<div class="panel"><div class="row" style="align-items:center;margin-bottom:8px">${nav(-1, mm > first)}<b style="flex:1;text-align:center">${y}년 ${mm}월 일정</b>${nav(1, mm < last)}</div>
      <div class="x-cal">${['일', '월', '화', '수', '목', '금', '토'].map(w => `<div class="x-cal-w">${w}</div>`).join('')}${cells.join('')}</div>
      <div class="tiny muted" style="margin-top:6px">@ = 원정 · 파란 칸 = 다음 경기 · 지난 경기는 누르면 박스스코어</div></div>`;
  }
  // 소식: 경기마다 쌓이는 뉴스 (최근 날짜부터, 날짜별로 묶어서). 경기 결과는 누르면 박스스코어
  const NEWS_IC = { game: '⚾', streak: '🔥', hr: '💥', hit: '🏏', sb: '👟', pit: '🎯', inj: '🚑', retire: '👋', mile: '🎉', fut: '🌱', legend: '🏅' };
  function newsHTML(lg) {
    const cur = lg.cur, my = lg.my, all = cur.news || [], pr = n => n.k === 'game' ? 0 : n.k === 'streak' ? 1 : n.t === my ? 2 : 3;
    const N = all.slice(-60).map((n, i) => [n, i]).sort((a, b) => (b[0].post ? 1e4 : 0) + b[0].d - (a[0].post ? 1e4 : 0) - a[0].d || pr(a[0]) - pr(b[0]) || a[1] - b[1]).map(x => x[0]);   // 최근 날짜부터, 같은 날은 내 경기 결과 → 내 소식 → 다른 구단
    if (!N.length) return `<div class="panel"><h3>소식</h3><div class="small muted">아직 소식이 없다. 경기를 치르면 기록·부상 소식이 쌓인다.</div></div>`;
    let lastD = null, h = '';
    for (const n of N) {
      if (n.d !== lastD) { lastD = n.d; h += `<div class="x-news-d">${n.post ? '포스트시즌' : n.d < 0 ? '비시즌' : M.dateTxt(lg.year, n.d)}</div>`; }
      const cls = `x-news ${n.t === my ? 'me' : ''} ${n.k}${n.k === 'game' ? (n.w > 0 ? ' w' : n.w < 0 ? ' l' : '') : ''}`;
      const inner = `<span class="x-news-ic">${NEWS_IC[n.k] || '•'}</span><span>${esc(n.txt)}</span>`;
      h += n.k === 'game' && n.id && cur.myBox[n.id] ? `<button class="${cls}" data-act="x-lg-box" data-v="${esc(n.id)}">${inner}<span class="tiny muted">박스 ›</span></button>` : `<div class="${cls}">${inner}</div>`;
    }
    return `<div class="panel"><h3>소식</h3><div class="x-news-list">${h}</div></div>`;
  }
  function lgProg(lg) {
    const cur = lg.cur, st = lgFake(lg), tn = id => lgTeamName(lg, id);
    const errs = lineupErrs(lg);
    const recentP = newsHTML(lg);
    if (!cur.goal && cur.phase !== 'done') M.mgrGoal(lg);   // 예전 리그: 이번 시즌 목표를 지금 정한다
    const mgrP = mgrHTML(lg);
    if (cur.phase === 'reg') {
      const m = M.monthOf(cur.day, lg.year), nx = M.nextOpp(lg), sl = M.seriesLeft(lg) || 1;
      let mg = 0; while (cur.day + mg < cur.sched.length && M.monthOf(cur.day + mg, lg.year) === m) mg++;
      const g0 = M.gameDate(lg.year, cur.day), vs = nx ? `${nx.home ? 'vs' : '@'} ${esc(tn(nx.opp))}` : '';
      const dis = errs.length ? 'disabled' : '';
      // 진행 버튼 셋: 같은 모양 (큰 글씨 = 얼마나, 작은 글씨 = 무엇을)
      const pb = (act, title, sub) => `<button class="btn x-prog-btn" data-act="${act}" ${dis}><b>${title}</b><span>${sub}</span></button>`;
      const offB = cur.off && cur.day < 6 ? `<button class="btn small block" data-act="x-off" style="margin-bottom:8px">🗓️ 오프시즌 변화 다시 보기 (성장·노쇠·은퇴)</button>` : '';
      return `${mgrP}<div class="panel">${offB}<button class="btn go block x-watch-btn" data-act="x-watch-start" ${dis}>📺 다음 경기 관전 <span class="tiny">${g0.m}/${g0.d}(${g0.w}) ${vs}</span></button><div class="x-prog" style="margin-top:6px">${pb("x-lg-game", "한 경기", `${g0.m}/${g0.d}(${g0.w}) ${vs}`)}${pb('x-lg-series', '시리즈', `${sl}경기 · ${vs}`)}${pb('x-lg-month', '한 달', `${M.MONTHS[m]} · ${mg}경기`)}</div>
        ${errs.length ? fixBox(errs) : `<div class="tiny muted" style="margin-top:6px">다음 경기 ${M.dateTxt(lg.year, cur.day)}${nx ? ` · ${nx.home ? '홈' : '원정'} vs ${esc(tn(nx.opp))} (이번 시리즈 ${sl}경기 남음)` : ''}</div>`}</div>
        ${calHTML(lg)}${recentP}`;
    }
    if (cur.phase === 'regDone') {
      const sum = M.leagueSummary(lg, false), mine = sum.standings.find(s => s.id === lg.my), inPS = mine.rank <= 5;
      return `<div class="panel reveal"><div class="res-head"><h2>${lg.year}</h2><span class="muted">정규시즌 종료 · ${M.MB.league.games}경기</span></div></div>
        <div class="panel reveal"><h3>최종 순위</h3>${G().standingsHTML(st, { standings: sum.standings, post: { seeds: sum.standings.slice(0, 5).map(s => s.id) } }, {})}
          <div class="small" style="margin-top:10px">${inPS ? `<b>${esc(mine.name)}</b>, ${mine.rank}위로 가을야구 진출!` : `${esc(mine.name)}은(는) ${mine.rank}위. 올해 가을야구는 TV로 본다.`}</div></div>
        <div class="panel">${inPS ? `<button class="btn go block" data-act="x-lg-post">가을야구 시작 ▶</button><div class="tiny muted" style="margin-top:6px">다른 팀끼리 붙는 시리즈는 결과만 바로 나온다. 우리 경기는 관전하거나 시뮬로.</div>` : `<button class="btn go block" data-act="x-lg-postall">포스트시즌 결과 보기 ▶</button>`}</div>${recentP}`;
    }
    const P = cur.post;
    // 포스트시즌: 내 구단이 없는 시리즈는 결과만 (바로 진행), 내 시리즈는 한 경기씩 — 관전 또는 시뮬
    if (cur.phase === 'post' && M.postSkipOthers(lg)) saveLeague();
    const ps = `<div class="panel">${psHTML(P, tn, lg.my, null, 'x-lg-box')}</div>`;
    if (cur.phase === 'post') {
      const n = M.postNext(lg), r = n ? n.r : P.rounds[P.idx], w = M.seriesWins(r), dis = errs.length ? 'disabled' : '';
      const meHi = r.hi === lg.my, myW = meHi ? w[0] : w[1], opW = meHi ? w[1] : w[0], need = r.need[meHi ? 0 : 1];
      const pb = (act, title, sub) => `<button class="btn x-prog-btn" data-act="${act}" ${dis}><b>${title}</b><span>${sub}</span></button>`;
      return `<div class="panel x-ps-now"><div class="tiny muted">${esc(r.name)} · ${r.key === 'WC' && meHi ? '1승 안고 시작 · ' : ''}${need}승 하면 다음 라운드</div>
          <div class="x-ps-score"><span>${esc(tn(lg.my))}</span><b class="num">${myW} : ${opW}</b><span>${esc(tn(meHi ? r.lo : r.hi))}</span></div>
          ${n ? `<button class="btn go block x-watch-btn" data-act="x-watch-start" ${dis}>📺 ${n.gi}차전 관전 <span class="tiny">${n.h === lg.my ? '홈' : '원정'}</span></button>
          <div class="x-prog" style="margin-top:6px">${pb('x-ps-game', '한 경기', `${n.gi}차전 시뮬`)}${pb('x-ps-series', '시리즈', '끝까지 시뮬')}${pb('x-lg-postall', '가을야구', '끝까지 시뮬')}</div>` : ''}
          ${errs.length ? fixBox(errs) : ''}</div>${ps}${recentP}`;
    }
    const aw = cur.awards ? `<div class="panel"><h3>${lg.year} 시상</h3>${G().awardsHTML(st, cur.awards)}</div>` : '';
    if (M.mgrDone(lg)) return mgrRetireHTML(lg) + champBanner(`${lg.year} 한국시리즈 우승`, tn(cur.champion), cur.champion === lg.my, myPostLine(P, lg.my)) + reportHTML(lg) + aw + ps;   // 20시즌: 감독 은퇴
    return `${champBanner(`${lg.year} 한국시리즈 우승`, tn(cur.champion), cur.champion === lg.my, myPostLine(P, lg.my))}${mgrP}${reportHTML(lg)}${aw}${ps}
      <div class="panel"><button class="btn go block" data-act="x-lg-next">다음 시즌 시작 (같은 라인업) ▶</button></div>${recentP}`;
  }
  // ---------- 라인업 편집 ----------
  // 경기 전에 라인업을 고쳐야 할 때 (부상 선수 · 규칙 위반): 이유 + 라인업으로 가는 버튼
  const fixBox = errs => `<div class="x-err small x-fixbox" style="margin-top:6px"><b>경기 전에 라인업을 고쳐야 한다</b><br>${errs.map(esc).join('<br>')}<button class="btn small go block" data-act="x-tab" data-k="tab" data-v="lineup" style="margin-top:6px">라인업 고치러 가기 ›</button></div>`;
  function lineupErrs(lg) { const pool = M.myPool(lg); return M.myHurt(lg).map(h => `🚑 부상 선수 ${h.name} (${h.left}경기 결장)을 라인업에서 빼야 한다`).concat(M.hasEmpty(lg.lineup) ? [] : M.checkLineup(lg.lineup, Object.fromEntries(pool.map(p => [p.id, p])))).concat(M.myLineupFit(lg)); }   // 빈 칸은 오류가 아니다 (경기 때 생성 선수로)
  // ---------- 편성 화면용: 능력치 한 줄 · 선수 카드 ----------
  const SHORT = k => Sim.LABEL[k].slice(0, 2);
  // slot을 주면 그 자리에서 뛸 때의 능력치(포지션 불일치 감점 반영). 깎인 값은 ▼로 표시
  function abilLine(p, pitch, slot) {
    if (!p) return '';
    const keys = pitch ? Sim.PIT : Sim.BAT, r = slot ? M.effR(p, slot) : p.r;
    return `<div class="x-abil">${keys.map(k => { const v = Sim.disp(r[k]), down = r[k] < p.r[k]; return `<span class="${down ? 'dn' : v >= 80 ? 'hi' : v < 55 ? 'lo' : ''}">${SHORT(k)}<b class="num">${v}</b>${down ? '▼' : ''}</span>`; }).join('')}</div>`;
  }
  const slotOvr = (p, slot) => M.dispOvr(M.effR(p, slot), slot);
  // 포지션 불일치 감점 설명 (없으면 '')
  function penTxt(p, slot) {
    const pen = M.offPenalty(p, slot); if (!pen) return '';
    const L = { def: '수비', arm: '어깨', con: '컨택', pow: '파워', eye: '선구안', sta: '체력' };
    const parts = []; const seen = {};
    for (const k in pen) { const d = Sim.disp(p.r[k]) - Sim.disp(Math.max(20, p.r[k] + pen[k])); if (!d) continue; const lab = /con|pow|eye/.test(k) ? '타격' : L[k]; if (seen[lab]) continue; seen[lab] = 1; parts.push(`${lab} −${d}`); }
    return `${slot === 'SP' ? '불펜투수라 선발로 쓰면' : '본 포지션이 아니라'} 능력치가 떨어진다 (${parts.join(' · ')})`;
  }
  const infoBtn = (m, id, slot) => id ? `<button class="x-info" data-act="x-pinfo" data-m="${m}" data-v="${esc(id)}" data-s="${slot}" title="선수 카드">카드</button>` : '';
  // p: 경기용 선수(리그 로스터·보관함 카드), slot: 지금 맡은 자리, stat: 이 모드 이번 시즌 기록
  // ---------- 야구카드 (원작 카드 앞면과 같은 모양) ----------
  //   o: { name, num, color, av, ovr, ovrLbl, sub, emblem, r, keys, opp, oppLbl, hof, foot }
  const gradeOf = ovr => ovr >= 88 ? 'legend' : ovr >= 80 ? 'gold' : ovr >= 70 ? 'silver' : 'bronze';
  // 카드 아래 한 줄: 전성기 연도·나이 · 노화 유형 (예전 카드는 노화 유형이 저장돼 있지 않아 표준형으로 친다)
  const AGING_KO = { iron: '철인형', long: '장수형', std: '표준형', early: '조기 쇠퇴형', meteor: '혜성형', flash: '반짝 각성형' };
  const GROWTH_KO = { early: '조숙형', std: '보통', late: '대기만성형' };
  const cardFoot = c => `성장 ${GROWTH_KO[c.growth] || '보통'} · ${c.aging ? AGING_KO[c.aging] || '표준형' : '표준형(기본)'} 노화`;
  function cardFace(o) {
    const g = o.hof ? 'hof' : gradeOf(o.ovr), gl = o.hof ? 'HALL OF FAME' : { bronze: 'BRONZE', silver: 'SILVER', gold: 'GOLD', legend: 'LEGEND' }[g];
    const bg = G().cardBg ? G().cardBg(o.color || '#3d4a5c') : (o.color || '#3d4a5c');
    const bars2 = (keys, cls) => G().barsHTML ? G().barsHTML(o.r, keys, cls) : bars(o.r, keys);
    return `<div class="card-wrap x-cardwrap"><div class="bcard ${o.hof ? 'is-hof' : ''}"><div class="face front ${g}"><div class="face-in">
        <div class="card-top" style="--team:${bg}">
          <div class="card-emblem">${esc(o.emblem || '⚾')}</div>
          <div class="card-ovr"><b class="num">${o.ovr}</b><span>${esc(o.ovrLbl || 'OVR')}</span></div>
          <canvas class="x-av" width="16" height="16" data-av="${o.av}" data-color="${esc(o.color || '#3d4a5c')}"></canvas>
          <div class="card-grade">${gl}</div>
        </div>
        <div class="card-name">${o.num ? `<span class="no num">${o.num}</span>` : ''}<h2>${esc(o.name)}</h2></div>
        <div class="card-sub">${esc(o.sub || '')}</div>
        ${bars2(o.keys)}
        ${o.opp ? `<div class="card-sub tiny" style="padding-top:6px">${esc(o.oppLbl || '')}</div>${bars2(o.opp, 'opp')}` : ''}
        <div class="card-foot"><span>${esc(o.foot || '')}</span><span></span></div>
      </div></div></div></div>`;
  }
  function playerSheet(p, slot, stat, note) {
    const vc = p.card ? vault().cards.find(c => c.id === p.card) : null;
    const pitch = M.isPitcher(p) && (/^SP|^MR$|^CL$|^RP$|^SU/.test(slot) || !M.isBatter(p));
    const main = pitch ? Sim.PIT : Sim.BAT, opp = pitch ? Sim.BAT : Sim.PIT;
    const at = slot && slot !== '-' ? slot : p.pos;
    const ovrAt = slotOvr(p, at), own = vc ? vc.ovr : M.dispOvr(p.r, p.pos), pt = penTxt(p, at);
    const a = avOf(p), posTxt = `${M.isCloser(p) ? '마무리' : M.POS_KO[p.pos] || p.pos}${p.role === 'TW' ? ' · 이도류' : ''}${p.foreign ? ' · 외국인' : ''}${p.filler ? ' · 생성 선수 (모든 능력치 65)' : vc ? ' · 보관함 선수' : p.user ? ' · 유저 선수' : ''}`;
    sheet(`${cardFace({ name: p.name, num: p.num, color: a.color, av: a.av, ovr: own, ovrLbl: vc && !p.filler ? '최고 OVR' : 'OVR', sub: posTxt, emblem: X.mode && league() ? league().club.emblem : '⚾', r: p.r, keys: main, opp: p.role === 'TW' ? opp : null, oppLbl: pitch ? '타격' : '투구', hof: vc && vc.career && vc.career.hof, foot: vc && !vc.filler ? cardFoot(vc) : '' })}
      ${slot && at !== p.pos && ovrAt !== own ? `<div class="tiny muted" style="margin-top:6px">${esc(M.POS_KO[slot] || slot)} 자리 기준 OVR <b>${ovrAt}</b></div>` : ''}
      ${pt ? `<div class="tiny x-warn" style="margin:4px 0 0">${esc(pt)}</div>` : ''}
      ${note ? `<div class="tiny muted" style="margin-top:4px">${note}</div>` : ''}
      ${stat ? `<h4 class="x-h4">이번 시즌</h4><div class="small">${[batLine(stat.b), pitLine(stat.p)].filter(Boolean).join('<br>') || '출전 기록 없음'}</div>` : ''}
      ${vc && !p.filler ? `<h4 class="x-h4">원작</h4><div class="small">통산 WAR <b>${vc.career.war}</b> · ${vc.career.seasons}시즌${vc.career.hof ? ' · <b>명예의 전당</b>' : ''}</div>${vc.career.aw && vc.career.aw.length ? `<div class="stamps sm">${vc.career.aw.map(a => `<span class="stamp ${/MVP|우승|골든/.test(a) ? 'gold' : ''}">${esc(a)}</span>`).join('')}</div>` : ''}` : ''}
      <button class="btn small block" data-act="x-close-btn" style="margin-top:14px">닫기</button>`);
  }
  // ---------- 선택 창 (드롭다운 대신: 앱 안 브라우저에서 드롭다운 목록이 안 열려서) ----------
  const pickBtn = (x, attrs, html, cls) => `<button class="x-sel x-pickbtn ${cls || ''}" data-act="x-pk" data-x="${x}" ${attrs}><span class="x-pk-t">${html}</span><span class="x-caret">▾</span></button>`;
  // items: [{ v, html, sel, note, head }] — head가 있으면 그 앞에 구분 제목
  // keep: 순서를 그대로 둔다 (지금 멤버 → 그 밖). dis: 누를 수 없는 줄
  function pickSheet(title, items, sub, keep) {
    if (!keep) items = items.filter(it => it.sel).concat(items.filter(it => !it.sel));   // 지금 고른 선수를 맨 위에
    sheet(`<h3>${esc(title)}</h3>${sub ? `<div class="small muted" style="margin-bottom:8px">${sub}</div>` : ''}
      <div class="x-pk-list">${items.map(it => `${it.head ? `<div class="x-pk-head tiny">${esc(it.head)}</div>` : ''}<${it.dis ? 'div' : 'button'} class="x-pk-item ${it.sel ? 'sel' : ''} ${it.ghost ? 'ghost' : ''} ${it.dis ? 'dis' : ''}" ${it.dis ? '' : `data-act="x-pk-do" data-v="${esc(it.v)}"`}>${it.html}${it.note ? `<div class="tiny x-warn" style="margin:2px 0 0">${it.note}</div>` : ''}</${it.dis ? 'div' : 'button'}>`).join('')}</div>
      <button class="btn small block" data-act="x-close-btn" style="margin-top:12px">닫기</button>`);
  }
  // 선택 창 한 줄: 초상화 · 이름(포지션) · 능력치 · 맨 오른쪽 OVR
  const avOf = p => { const vc = p && p.card ? vault().cards.find(c => c.id === p.card) : null; return { av: vc ? (+vc.avatar || 1) : (M._t.hash(p.id) % 99991) + 1, color: vc ? vc.color : (X.mode && league() ? league().club.color : '#3d4a5c') }; };
  //   posLabel: 포지션 대신 보여줄 글자 (예: '1선발', '불펜2', '후보3')
  function candHtml(p, slot, pitch, tag, noCond, posLabel) {   // noCond: 보관함처럼 체력이 없는 곳
    const own = p.ovr || M.dispOvr(p.r, p.pos), at = slotOvr(p, slot), a = avOf(p);
    return `<div class="x-cand"><canvas class="x-av" width="16" height="16" data-av="${a.av}" data-color="${esc(a.color)}" style="width:38px;height:38px"></canvas>
      <div class="x-cand-mid"><div><b>${X.luIds && X.luIds.has(p.id) ? '★' : ''}${esc(p.name)}</b>${hurtLeft(p) ? ` <b class="x-warn">🚑 부상 ${hurtLeft(p)}경기</b>` : ''} ${posLabel ? `<span class="chip">${esc(posLabel)}</span>` : `<span class="tiny muted">${esc(M.isCloser(p) ? '마무리' : M.POS_KO[p.pos] || p.pos)}${p.role === 'TW' ? ' · 이도류' : ''}</span>`}${tag ? `<span class="tiny muted"> · ${tag}</span>` : ''}${pitch && !noCond ? condTag(p) : ''}</div>${abilLine(p, pitch, slot)}</div>
      <span class="x-pk-ovr"><b class="num">${at}</b>${at !== own ? `<i>본래 ${own}</i>` : ''}</span></div>`;
  }
  const tagOf = p => p.fresh ? '보관함 · 새로 투입' : X.mode && league() && M.inFarm(league(), p.id) ? '2군 · 고르면 1군으로' : p.filler ? '생성 선수' : p.card ? '보관함' : p.own ? '원래 구단 선수' : p.user ? '유저 선수' : '';
  function openPick(el) {
    const x = el.dataset.x, i = el.dataset.i, k = el.dataset.k;
    X.pk = { x, i, k };
    if (/^lg-/.test(x)) {
      const lg = league(), lu = lg.lineup, pool = M.myPool(lg).concat((lg.farm || []).map(id => M.lgPlayer(lg, id)).filter(Boolean)); X.luIds = luSet(lg);   // 71차: 내 선수(1군·2군)에 등록된 선수만 (보관함에서 바로 넣기는 없앰 — [내 선수]에서 1군에 합류시킨 뒤). 2군 선수는 고르면 1군으로 올라온다
      // 제 포지션 선수만 고를 수 있다 (지명타자는 타자 누구나). 다른 칸에 있던 선수와 맞바꿀 때 그 칸 규칙도 지켜야 한다
      const byOvr = slot => (a, b) => (!!a.filler - !!b.filler) || slotOvr(b, slot) - slotOvr(a, slot);   // 보관함 선수 먼저, 생성 선수(빈 칸)는 아래에 연하게
    if (x === 'lg-bp') {
        const slot = lu.bat[+i].slot, cur = lu.bat[+i].id, curP = M.lgPlayer(lg, cur);
        const list = pool.filter(p => M.fitsSlot(p, slot) && (() => { const j = lu.bat.findIndex((b, q) => q !== +i && b.id === p.id); return j < 0 || !curP || M.fitsSlot(curP, lu.bat[j].slot); })()).sort(byOvr(slot));
        return pickSheet(`${+i + 1}번 타자 · ${M.POS_KO[slot]}`, list.map(p => {
          const j = lu.bat.findIndex((b, q) => q !== +i && b.id === p.id);
          return { v: p.id, sel: p.id === cur, ghost: p.filler, html: candHtml(p, slot, false, tagOf(p)), note: j >= 0 ? `지금 ${j + 1}번 타자 — 고르면 자리를 맞바꾼다` : '' };
        }), slot === 'DH' ? '지명타자는 어느 포지션 타자든 고를 수 있다 · ★ 지금 라인업에 든 선수' : `${M.POS_KO[slot]}만 고를 수 있다 · ★ 지금 라인업에 든 선수`);
      }
      // 후보·불펜·선발·마무리 선택 창: 위에는 지금 그 무리(후보 1~5, 불펜 1~5, 1~5선발)에 든 선수를 차례대로, 그 아래는 라인업에 없는 선수 OVR 순
      if (x === 'lg-bn') {   // 후보: 타순에 없는 타자 누구나 (다른 후보 칸에 있던 선수면 맞바꾼다)
        const BN = lu.BN || [], cur = BN[+i], bat = new Set(lu.bat.map(b => b.id)), inBN = new Set(BN.filter(Boolean));
        const members = BN.map((id, j) => ({ id, j })).filter(m => m.id && pool.some(p => p.id === m.id));
        const rest = pool.filter(p => M.isBatter(p) && !bat.has(p.id) && !inBN.has(p.id)).sort((a, b) => (!!a.filler - !!b.filler) || slotOvr(b, 'DH') - slotOvr(a, 'DH'));
        const items = members.map(m => { const p = M.lgPlayer(lg, m.id); return { v: p.id, sel: m.j === +i, ghost: p.filler, html: candHtml(p, p.pos, false, tagOf(p), false, `후보${m.j + 1}`), note: m.j !== +i ? '고르면 두 후보 칸을 맞바꾼다' : '' }; })
          .concat(rest.map((p, n) => Object.assign({ v: p.id, ghost: p.filler, html: candHtml(p, p.pos, false, tagOf(p)) }, n === 0 ? { head: '교체' } : {})));
        return pickSheet(`후보 ${+i + 1}`, items, '타순에 없는 타자 중에서 5명까지 · 경기에 나갈 수 있는 후보', true);
      }
      if (x === 'lg-pp') {
        const isCL = /^CL/.test(k), slot = /^sp/.test(k) ? 'SP' : isCL ? 'CL' : 'RP', ko = slot === 'SP' ? '선발투수' : isCL ? '마무리' : '불펜투수', at = slot === 'SP' ? 'SP' : 'RP';
        const get = kk => pkGet(lu, kk), label = pkLabel, keys = pkeys(lg);
        const grpKeys = slot === 'SP' ? ['sp0', 'sp1', 'sp2', 'sp3', 'sp4'] : isCL ? ['CL'] : bpKeys(lg).filter(kk => kk !== 'CL');
        const used = new Set(keys.map(get).filter(Boolean)), rot = M.canReorderRot(lg), nx = 'sp' + M.nextSp(lg);
        const members = grpKeys.filter(kk => get(kk)).map(kk => ({ kk, p: M.lgPlayer(lg, get(kk)) })).filter(m => m.p);
        const rest = pool.filter(p => M.fitsSlot(p, slot) && !used.has(p.id)).sort(byOvr(at));
        const items = members.map(m => {
          const me = m.kk === k, lockRot = slot === 'SP' && !me && !rot;   // 선발끼리 순서 바꾸기는 1선발 차례에만
          return { v: m.p.id, sel: me, dis: lockRot, ghost: m.p.filler, html: candHtml(m.p, at, true, tagOf(m.p) + (m.kk === nx && slot === 'SP' ? ' · ▶ 다음 선발' : ''), false, label(m.kk)),
            note: me ? '' : lockRot ? '선발 순서는 로테이션 한 바퀴가 끝나 1선발이 나올 차례에만 바꿀 수 있다' : `고르면 ${label(m.kk)}와 자리를 맞바꾼다` };
        }).concat(rest.map((p, n) => Object.assign({ v: p.id, ghost: p.filler, html: candHtml(p, at, true, tagOf(p)) }, n === 0 ? { head: '교체' } : {})));
        return pickSheet(label(k), items, `${ko}만 고를 수 있다 · ★ 지금 라인업에 든 선수`, true);
      }
    }
  }
  // 70차: 보관함 카드 첫 투입 — 시작 나이 고르기 (20~30세). 한 번 넣으면 은퇴하기 전에는 못 바꾼다
  function agePickSheet(pid) {
    const c = vault().cards.find(x => 'v:' + x.id === pid); if (!c) return;
    const pa = M.primeAgeOf(c), ages = Array.from({ length: M.MB.age.startMax - M.MB.age.startMin + 1 }, (_, i) => M.MB.age.startMin + i);
    sheet(`<h3>${esc(c.name)} · 시작 나이</h3>
      <div class="small muted" style="margin-bottom:8px">최고 OVR ${c.ovr}. 최고 OVR만 카드와 같고, 성장 속도와 노화 시점은 넣을 때마다 새로 정해진다. 어리게 넣을수록 낮게 시작하고, 많이 뛸수록 잘 자란다 (성장 유형도 반영). <b>한 번 넣으면 은퇴하기 전에는 나이를 바꿀 수 없다.</b></div>
      <div class="x-agebtns x-agebtns-11">${ages.map(a => { const s = M.startPreview(c, a); return `<button class="x-agebtn" data-act="x-age-pick" data-v="${a}" data-id="${esc(pid)}"><b class="num">${a}세</b><span class="tiny">OVR ${s.ovr}</span></button>`; }).join('')}</div>
      <div class="tiny muted" style="margin-top:6px">나이를 누르고 한 번 더 누르면 투입된다.</div>
      <button class="btn small block" data-act="x-close-btn" style="margin-top:12px">취소</button>`);
  }
  function doPick(v) {
    const pk = X.pk; if (!pk) return;
    // 70차: 아직 리그에 안 넣은 보관함 카드면 먼저 시작 나이를 고른다
    if (/^lg-/.test(pk.x) && v && /^v:/.test(v) && !league().cards[v]) { agePickSheet(v); return; }
    if (/^lg-/.test(pk.x) && v && M.inFarm(league(), v)) { const r = M.farmMove(league(), v, false, vault()); if (!r.ok) { X.msg = r.why; X.pk = null; G().render(); return; } }   // 2군 선수를 고르면 1군으로 올린 뒤 넣는다
    X.lsel = [];
    if (/^lg-/.test(pk.x)) lgSelectChange({ dataset: { x: pk.x, i: pk.i, k: pk.k }, value: v });
    X.pk = null;
  }
  // 투수 보직 칸: 선발 5 · 불펜1·2(SU) · 불펜3~(MR) · 마무리(CL). 불펜 5명 (리그·온라인·보관함 같음). 빈 칸은 생성 선수로 채운다
  const pkeys = lg => ['sp0', 'sp1', 'sp2', 'sp3', 'sp4', 'SU0', 'SU1'].concat(Array.from({ length: M.bpN(lg) - 2 }, (_, i) => 'MR' + i), ['CL']);
  const bpKeys = lg => pkeys(lg).filter(k => k[0] !== 's');
  const pkGet = (lu, k) => k === 'CL' ? lu.CL : k === 'CL2' ? lu.CL2 : k[0] === 's' ? lu.sp[+k.slice(2)] : (lu[k.slice(0, 2)] || [])[+k.slice(2)];
  function pkSet(lu, k, v) { v = v || null; if (k === 'CL') lu.CL = v; else if (k === 'CL2') lu.CL2 = v; else if (k[0] === 's') lu.sp[+k.slice(2)] = v; else { const a = k.slice(0, 2); lu[a] = lu[a] || []; lu[a][+k.slice(2)] = v; } }
  function pkLabel(k) {
    if (k[0] === 's') return `${+k.slice(2) + 1}선발`;
    if (k === 'CL') return '마무리';
    return `불펜${k[0] === 'S' ? +k.slice(2) + 1 : +k.slice(2) + 3}`;
  }
  // 리그 라인업 그림: 수비 위치 9 + 1선발(마운드), 아래 줄에 지명타자·2~5선발·마무리·셋업. 누르면 그 자리 선택 창
  function lgField(lg, byId) {
    const lu = lg.lineup, color = lg.club.color;
    const nx = "sp" + M.nextSp(lg);   // 마운드에는 다음 선발
    const PK = { SP: [nx, `다음 선발 · ${pkLabel(nx)}`] }; for (const k of pkeys(lg)) if (k[0] !== "s") PK[k] = [k, pkLabel(k)];
    const pid = k => pkGet(lu, k);
    const info = (id, slot) => id ? `data-act="x-pinfo" data-m="lg" data-v="${esc(id)}" data-s="${slot}"` : '';
    const get = k => {
      if (PK[k]) { const [key, label] = PK[k], id = pid(key), at = /^s/.test(key) ? "SP" : "RP"; return { attrs: at === "SP" ? `data-act="x-rot"` : `data-act="x-pk" data-x="lg-pp" data-k="${key}"`, rot: at === "SP", info: info(id, at), label, item: fieldItem(byId[id], at, color, true) }; }
      if (/^bn[0-9]/.test(k)) { const i = +k.slice(2), id = (lu.BN || [])[i], p = byId[id]; return { attrs: `data-act="x-pk" data-x="lg-bn" data-i="${i}"`, info: p ? info(id, p.pos) : '', label: `후보${i + 1}${p ? " · " + (M.POS_KO[p.pos] || p.pos) : ""}`, item: p ? fieldItem(p, p.pos, color) : null }; }
      const i = lu.bat.findIndex(x => x.slot === k), id = i >= 0 ? lu.bat[i].id : null;
      return { attrs: i >= 0 ? `data-act="x-pk" data-x="lg-bp" data-i="${i}"` : '', info: info(id, k), label: `${M.POS_KO[k]}${i >= 0 ? ` · ${i + 1}번` : ''}`, item: i >= 0 ? fieldItem(byId[id], k, color) : null };
    };
    return `<div class="panel lu-panel x-lu"><div class="row" style="margin-bottom:8px"><b>${esc(lg.club.name)} 라인업</b><span class="spacer"></span>
        <button class="btn small" data-act="x-lg-auto" data-v="all">자동 편성</button><button class="btn small" data-act="x-lg-clear" style="margin-left:4px">비우기</button></div>
      ${fieldHTML(get, [{ title: '불펜' }].concat(bpKeys(lg).filter(k => k !== 'CL'), [{ title: '후보' }], Array.from({ length: M.BN_N }, (_, i) => 'bn' + i)))}
      </div>`;
  }
  function lgLineupTab(lg) {
    const lu = lg.lineup, pool = M.myPool(lg), byId = Object.fromEntries(pool.map(p => [p.id, p]));
    const errs = lineupErrs(lg);
    const nEmpty = [].concat(lu.bat.map(b => b.id), lu.sp.slice(0, 5), [lu.CL], (lu.SU || []).slice(0, 2), (lu.MR || []).slice(0, M.bpN(lg) - 2)).filter(x => !x).length + Math.max(0, 5 - lu.sp.length);
    const head = `${errs.length ? `<div class="panel"><div class="x-err small">${errs.map(esc).join('<br>')}</div></div>` : ''}${nEmpty ? `<div class="panel small muted">빈 칸 ${nEmpty}개 — 경기를 시작할 때 남는 선수로 채워진다 (불펜은 선수가 모자라면 빈 채로)</div>` : ''}`;
    if (X.lsub === 'bat' || X.lsub === 'pit') return head + lsubView(lg, X.lsub, byId, pool);
    const navBtn = (v, title, sub) => `<button class="btn block x-hub-btn" data-act="x-lsub" data-v="${v}"><span>${title}</span><span class="tiny muted">${sub} ▸</span></button>`;
    return `${head}${lgField(lg, byId)}
      ${navBtn('bat', '📋 타자', `타순 9 · 후보 ${M.BN_N}`)}${navBtn('pit', '⚾ 투수', `선발 5 · 불펜 ${M.bpN(lg)} · 마무리 1 · 후보`)}`;
  }
  // ---------- 71차: 라인업 아래 선수 목록 — 내 선수 전부(원래 구단 선수 · 투입한 보관함 선수 · 아직 안 넣은 보관함 선수). 누르면 넣을 자리 고르기 ----------
  function luRoleMap(lg) {   // 선수 id → 지금 라인업 자리 이름
    const lu = lg.lineup, m = {};
    lu.bat.forEach((b, i) => { if (b.id) m[b.id] = `${i + 1}번 ${M.POS_KO[b.slot]}`; });
    (lu.BN || []).forEach((id, i) => { if (id) m[id] = `후보${i + 1}`; });
    for (const k of pkeys(lg)) { const id = pkGet(lu, k); if (id) m[id] = pkLabel(k); }
    return m;
  }
  function rosterPanel(lg, pool) {
    const role = luRoleMap(lg), fresh = M.freshCards(lg, vault());
    const grp = p => M.isPitcher(p) && p.role !== 'TW' ? (p.pos === 'SP' ? 'SP' : 'RP') : 'B';
    const order = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
    const all = pool.concat(fresh), sec = X.rosSec || 'B';
    const list = all.filter(p => grp(p) === sec).sort((a, b) => (!!b.fresh - !!a.fresh) || (!!role[b.id] - !!role[a.id]) || (sec === 'B' ? order.indexOf(a.pos) - order.indexOf(b.pos) : 0) || (b.ovr || M.dispOvr(b.r, b.pos)) - (a.ovr || M.dispOvr(a.r, a.pos)));
    const row = p => {
      const a = avOf(p), ovr = p.fresh ? p.ovr : (p.ovr || M.dispOvr(p.r, p.pos)), tag = p.fresh ? '<span class="chip red">새로 투입</span>' : p.card ? '<span class="chip">보관함</span>' : '';
      return `<button class="x-ros-row ${role[p.id] ? 'on' : ''}" data-act="x-ros" data-v="${esc(p.id)}">
        <canvas class="x-av" width="16" height="16" data-av="${a.av}" data-color="${esc(a.color)}"></canvas>
        <span class="x-ros-mid"><b>${role[p.id] ? '★' : ''}${esc(p.name)}</b> ${tag}<span class="tiny muted">${esc(M.isCloser(p) ? '마무리' : M.POS_KO[p.pos] || p.pos)}${p.fresh ? ' · 최고 OVR' : p.age ? ` · ${p.age}세` : ''}${hurtLeft(p) ? ' · 🚑' : ''}${role[p.id] ? ` · <b>${esc(role[p.id])}</b>` : ''}</span></span>
        <b class="num x-ros-ovr">${ovr}</b></button>`;
    };
    const tab = (k, t) => `<button class="${sec === k ? 'on' : ''}" data-act="x-ros-sec" data-v="${k}">${t} ${all.filter(p => grp(p) === k).length}</button>`;
    return `<div class="panel x-ros"><div class="row" style="align-items:center;margin-bottom:6px"><b>내 선수</b><span class="tiny muted" style="margin-left:6px">누르면 넣을 자리를 고른다 · ★ 지금 라인업</span></div>
      <div class="seg" style="margin-bottom:6px">${tab('B', '타자')}${tab('SP', '선발')}${tab('RP', '불펜·마무리')}</div>
      <div class="x-ros-list">${list.map(row).join('') || '<div class="small muted">선수가 없다.</div>'}</div></div>`;
  }
  // 선수 목록에서 고른 선수를 넣을 자리 고르기 (그 선수가 설 수 있는 자리만)
  function rosSlotSheet(id) {
    const lg = league(), lu = lg.lineup, p = M.lgPlayer(lg, id) || M.freshCards(lg, vault()).find(x => x.id === id); if (!p) return;
    const nm = x => { const q = x && M.lgPlayer(lg, x); return q ? esc(q.name) : '<span class="muted">빈 칸</span>'; };
    const opts = [];
    if (M.isBatter(p) && !(M.isPitcher(p) && p.role !== 'TW')) {
      lu.bat.forEach((b, i) => { if (M.fitsSlot(p, b.slot)) opts.push({ x: 'lg-bp', i, label: `${i + 1}번 ${M.POS_KO[b.slot]}`, cur: b.id }); });
      if (!lu.bat.some(b => b.id === id)) (lu.BN || Array(M.BN_N).fill(null)).forEach((x, i) => opts.push({ x: 'lg-bn', i, label: `후보${i + 1}`, cur: x }));
    } else {
      for (const k of pkeys(lg)) { const slot = k[0] === 's' ? 'SP' : k === 'CL' ? 'CL' : 'RP'; if (M.fitsSlot(p, slot)) opts.push({ x: 'lg-pp', k, label: pkLabel(k), cur: pkGet(lu, k) }); }
    }
    sheet(`<h3>${esc(p.name)} · 넣을 자리</h3><div class="small muted" style="margin-bottom:8px">${p.fresh ? '보관함에서 새로 투입한다. 자리를 고르면 시작 나이를 정한다.' : '고른 자리에 있던 선수와 바뀐다.'}</div>
      <div class="x-pk-list">${opts.map(o => `<button class="x-pk-item ${o.cur === id ? 'sel' : ''}" data-act="x-ros-put" data-x="${o.x}" data-i="${o.i == null ? '' : o.i}" data-k="${o.k || ''}" data-v="${esc(id)}"><div class="x-cand"><div class="x-cand-mid"><b>${esc(o.label)}</b> <span class="tiny muted">지금: ${o.cur === id ? '이 선수' : nm(o.cur)}</span></div></div></button>`).join('') || '<div class="small muted">이 선수가 설 수 있는 자리가 없다.</div>'}</div>
      <div class="row" style="gap:8px;margin-top:12px">${p.fresh ? '' : `<button class="btn small" data-act="x-pinfo" data-m="lg" data-v="${esc(id)}" data-s="${esc(p.pos)}" style="flex:1">🃏 카드 보기</button>`}<button class="btn small" data-act="x-close-btn" style="flex:1">닫기</button></div>`);
  }
  // ---------- 타자 / 투수 화면: 작은 카드. 하나 누르면 카드 보기·선수 고르기, 두 장 고르면 교체 ----------
  //   key: 타순 'b0'~'b8' · 후보 'n0'~'n4' · 투수 보직 'sp0'…'CL' · 투수 후보 'x:<id>'
  function lsKeySlot(lg, kind, key) {
    const lu = lg.lineup;
    if (key.startsWith('x:')) return { id: key.slice(2), slot: null, bench: true };
    if (kind === 'bat') {
      if (key[0] === 'n') { const j = +key.slice(1); return { id: (lu.BN || [])[j] || null, slot: null, bn: j, bench: true }; }
      const i = +key.slice(1); return { id: lu.bat[i].id, slot: lu.bat[i].slot, i };
    }
    return { id: pkGet(lu, key), slot: key[0] === 's' ? 'SP' : key === 'CL' ? 'CL' : 'RP', k: key };
  }
  function lsubView(lg, kind, byId, pool) {
    const lu = lg.lineup, sel = X.lsel || [], bat = kind === 'bat';
    const card = (key, label, p, slot, cls) => {
      const s = sel.indexOf(key) >= 0, at = slot === 'CL' ? 'RP' : slot;
      const ovr = p ? (at ? slotOvr(p, at) : M.dispOvr(p.r, p.pos)) : null, off = p && at && M.offPenalty(p, at);
      const cv = !bat && p ? condNow(p) : null, tired = !bat && p && tiredNow(p);
      const vc = p && p.card ? vault().cards.find(c => c.id === p.card) : null;
      return `<button class="x-mc ${cls || ''} ${s ? 'sel' : ''} ${p && p.filler ? 'x-filler' : ''} ${p ? (hurtLeft(p) ? 'x-hurt' : '') : 'empty'}" data-act="x-ls" data-v="${esc(key)}">
        <span class="x-mc-lbl">${label}</span>
        ${p ? `<canvas class="x-av x-mc-av" width="16" height="16" data-av="${vc ? (+vc.avatar || 1) : (M._t.hash(p.id) % 99991) + 1}" data-color="${esc(vc ? vc.color : lg.club.color)}"></canvas>
          <b class="x-mc-name">${hurtLeft(p) ? '🚑' : ''}${esc(p.name)}</b><span class="x-mc-pos">${esc(M.isCloser(p) ? '마무리' : M.POS_KO[p.pos] || p.pos)}${p.filler ? ' · 생성' : ''}</span>
          <span class="x-mc-ovr num ${off || tired ? 'x-offpos' : ''}">${ovr}${off || tired ? '▼' : ''}</span>${cv != null ? gauge(cv) : ''}` : '<span class="x-mc-empty">+</span><span class="x-mc-pos muted">비어 있음</span>'}</button>`;
    };
    let body;
    if (bat) {
      const BN = lu.BN || [];
      body = `<div class="x-h4">타순</div><div class="x-mc-grid five">${lu.bat.map((b, i) => card("b" + i, `${i + 1}번`, byId[b.id], b.slot, "plain")).join('')}</div>
        <div class="x-ls-sep"></div><h4 class="x-h4">후보 (${BN.filter(Boolean).length}/${M.BN_N})</h4>
        <div class="x-mc-grid five">${Array.from({ length: M.BN_N }, (_, j) => card('n' + j, `후보 ${j + 1}`, byId[BN[j]], null, 'plain')).join('')}</div>`;
    } else {
      const used = new Set(pkeys(lg).map(k => pkGet(lu, k)).filter(Boolean));
      const grp = p => p.pos === 'SP' ? 0 : M.isCloser(p) ? 2 : 1;
      const bench = pool.filter(p => M.isPitcher(p) && p.role !== 'TW' && !used.has(p.id)).sort((a, b) => grp(a) - grp(b) || b.ovr - a.ovr);
      const nx = 'sp' + M.nextSp(lg);
      const pc = k => card(k, pkLabel(k), byId[pkGet(lu, k)], k[0] === 's' ? 'SP' : 'RP', 'small' + (k === nx ? ' next' : ''));
      const bp = bpKeys(lg).filter(k => k !== 'CL');
      body = `<div class="x-h4">선발 로테이션</div><div class="x-mc-grid five x-rotrow">${['sp0', 'sp1', 'sp2', 'sp3', 'sp4'].map(pc).join('')}</div>
        <div class="x-ls-sep"></div>
        <div class="x-pen"><div class="x-pen-bp"><div class="x-h4">불펜</div><div class="x-mc-grid">${bp.map(pc).join('')}</div></div>
          <div class="x-pen-cl"><div class="x-h4 x-red">마무리</div>${pc('CL')}</div></div>
        <div class="x-ls-sep"></div><h4 class="x-h4">후보 (${bench.length})</h4>
        <div class="x-mc-grid five">${bench.map(p => card('x:' + p.id, '후보', p, null, 'small')).join('') || '<span class="tiny muted">없음</span>'}</div>`;
    }
    // 위 버튼: 고른 카드 수에 따라
    let bar;
    if (sel.length === 2) bar = `<button class="btn small" data-act="x-ls-swap">↔ 자리 바꾸기</button><button class="btn small" data-act="x-ls-clear">선택 취소</button>`;
    else if (sel.length === 1) {
      const t = lsKeySlot(lg, kind, sel[0]);
      const pk = t.i != null ? `<button class="btn small" data-act="x-pk" data-x="lg-bp" data-i="${t.i}">🔁 교체</button>`
        : t.bn != null ? `<button class="btn small" data-act="x-pk" data-x="lg-bn" data-i="${t.bn}">🔁 교체</button>`
        : t.k ? `<button class="btn small" data-act="x-pk" data-x="lg-pp" data-k="${t.k}">🔁 교체</button>` : '';
      bar = `${t.id ? `<button class="btn small" data-act="x-pinfo" data-m="lg" data-v="${esc(t.id)}" data-s="${t.slot || '-'}">🃏 카드 보기</button>` : ''}${pk}<button class="btn small" data-act="x-ls-clear">선택 취소</button><span class="tiny muted">한 장 더 고르면 자리 바꾸기</span>`;
    } else bar = '<span class="tiny muted">초상화를 누르면 교체·카드 보기, 두 장을 고르면 자리 바꾸기</span>';
    return `<div class="panel"><div class="row" style="align-items:center;margin-bottom:8px"><button class="btn small" data-act="x-lsub" data-v="">← 라인업</button><b style="margin-left:8px">${bat ? '타자' : '투수'}</b><span class="spacer"></span><button class="btn small" data-act="x-lg-auto" data-v="all">자동 편성</button></div>
        <div class="x-ls-bar">${bar}</div>
        ${body}
        ${bat ? `<div class="tiny muted" style="margin-top:8px">후보는 타순에 없는 타자 중 ${M.BN_N}명까지 — 경기에 나갈 수 있는 후보다.</div>` : '<div class="tiny muted" style="margin-top:8px">불펜1·2는 접전 후반(셋업), 나머지 불펜은 중간계투. 후보 투수는 남는 불펜으로 자동 등판. 게이지는 다음 경기 체력 — 70 아래면 능력치가 떨어진다(▼), 35 아래 불펜은 등판 안 함.</div>'}</div>`;
  }
  // 두 장 교체: 라인업끼리는 자리(타순·보직)를 맞바꾸고, 후보와는 그 자리를 맞바꾼다 (제 포지션일 때만)
  function lsSwap() {
    const lg = league(), lu = lg.lineup, kind = X.lsub, sel = X.lsel || []; if (sel.length !== 2) return;
    const P = id => M.lgPlayer(lg, id);
    const [a, b] = sel.map(k => lsKeySlot(lg, kind, k));
    if (kind === 'bat') {
      lu.BN = lu.BN || [];
      if (a.bench && b.bench) { const x = lu.BN[a.bn], y = lu.BN[b.bn]; lu.BN[a.bn] = y || null; lu.BN[b.bn] = x || null; }
      else if (!a.bench && !b.bench) { [lu.bat[a.i], lu.bat[b.i]] = [lu.bat[b.i], lu.bat[a.i]]; }
      else { X.msg = '타순 선수와 후보는 여기서 맞바꾸지 않는다 — 라인업 그림에서 그 자리를 눌러 교체한다'; return; }
    } else {
      if (a.bench && b.bench) { X.msg = '라인업에 있는 투수를 하나 골라야 바꿀 수 있다'; return; }
      if (!a.bench && !b.bench) {
        if (a.slot === "SP" && b.slot === "SP" && !M.canReorderRot(lg)) { X.msg = "선발 순서는 로테이션 한 바퀴가 끝나 1선발이 나올 차례(1선발 등판 전날)에만 바꿀 수 있다. 다른 선발로 교체는 언제든 된다."; return; }
        if (!(!b.id || M.fitsSlot(P(b.id), a.slot)) || !(!a.id || M.fitsSlot(P(a.id), b.slot))) { X.msg = '선발은 선발끼리, 불펜은 불펜끼리, 마무리는 마무리끼리만 바꿀 수 있다'; return; }
        const va = a.id, vb = b.id; pkSet(lu, a.k, vb); pkSet(lu, b.k, va);
      } else {
        const L = a.bench ? b : a, B = a.bench ? a : b;
        if (!M.fitsSlot(P(B.id), L.slot)) { X.msg = `${P(B.id).name}은(는) ${pkLabel(L.k)} 자리에 설 수 없다`; return; }
        pkSet(lu, L.k, B.id);
      }
    }
    rebuildPen(lg); saveLeague();
  }
  function rebuildPen(lg) { lg.lineup.LR = M.benchPitchers(M.myPool(lg), lg.lineup); }   // 라인업 밖 투수는 남는 불펜으로
  function lgSelectChange(el) {
    const lg = league(), lu = lg.lineup, x = el.dataset.x, v = el.value;

    if (x === 'lg-bn') { lu.BN = lu.BN || []; const i = +el.dataset.i, j = lu.BN.findIndex((id, q) => q !== i && id === v); if (j >= 0) lu.BN[j] = lu.BN[i] || null; lu.BN[i] = v || null; }
    if (x === 'lg-bp') {
      const i = +el.dataset.i, j = lu.bat.findIndex((b, k) => k !== i && b.id === v);
      const old = lu.bat[i].id, h = (lu.BN || []).indexOf(v);
      if (j >= 0) lu.bat[j].id = old;   // 이미 타순에 있던 선수면 자리를 맞바꾼다
      else if (h >= 0) lu.BN[h] = old || null;   // 후보에 있던 선수면 원래 타자가 후보로
      lu.bat[i].id = v;
    }
    if (x === 'lg-pp') {
      const k = el.dataset.k;
      const get = kk => pkGet(lu, kk), set = (kk, val) => pkSet(lu, kk, val);
      const other = v && pkeys(lg).find(kk => kk !== k && get(kk) === v);
      if (other && k[0] === 's' && other[0] === 's' && !M.canReorderRot(lg)) { X.msg = '선발 순서는 1선발이 나올 차례에만 바꿀 수 있다'; return G().render(); }
      if (other) set(other, get(k));   // 다른 보직에 있던 투수면 맞바꾼다
      set(k, v);
    }
    rebuildPen(lg); saveLeague(); G().render();
  }
  // ---------- 내 선수: 초상화 1열 + 이번 시즌 기록. 초상화를 누르면 이 모드 역대 기록·수상·우승 ----------
  // ---------- 내 선수 (71차): 1군 / 퓨처스(2군) 두 칸 + 아직 안 넣은 보관함 선수. 구단 선수 전부를 한 번에 본다 ----------
  //   초상화: 이 모드 역대 기록 · 이름 줄: 넣을 자리 고르기 (1군·보관함) · 1군 성적은 모두 옆에, 2군 선수는 퓨처스 성적도
  function lgCards(lg) {
    const inLu = luSet(lg), role = luRoleMap(lg);
    const grp = p => M.isPitcher(p) && p.role !== 'TW' ? (p.pos === 'SP' ? 2 : 3) : 1;
    const order = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
    const sorter = (a, b) => grp(a) - grp(b) || (inLu.has(b.id) - inLu.has(a.id)) || (grp(a) === 1 ? order.indexOf(a.pos) - order.indexOf(b.pos) : 0) || (b.ovr || M.dispOvr(b.r, b.pos)) - (a.ovr || M.dispOvr(a.r, a.pos));
    const own = (lg.own || []).map(id => lg.players[id]).filter(Boolean), cards = Object.keys(lg.cards).map(id => M.lgPlayer(lg, id)).filter(Boolean);
    const all = own.concat(cards), fresh = M.freshCards(lg, vault());
    const farmOn = M.farmOn(lg), F = lg.cur.fut;
    const row = p => {
      const farm = M.inFarm(lg, p.id), s1 = lg.cur.stats[p.id], s2 = farm && F ? F.stats[p.id] : null, a = avOf(p), R = lg.cardRec[p.id];
      const ln = s => s ? [batLine(s.b), pitLine(s.p)].filter(Boolean).join(' / ') : '';
      const mv = farmOn && (p.card || (lg.own || []).indexOf(p.id) >= 0) && !p.fresh && !p.filler && lg.cur.phase !== 'post' ? `<button class="btn small ghost x-farm-btn" data-act="x-farm" data-v="${esc(p.id)}" data-on="${farm ? 0 : 1}">${farm ? '1군 ↑' : '2군 ↓'}</button>` : '';
      const champs = R ? R.seasons.filter(x => x.champ).length : 0, titles = R ? R.seasons.reduce((n, x) => n + (x.titles || []).length, 0) : 0;
      const growing = p.baseR && Object.keys(p.baseR).some(k => p.r[k] < p.baseR[k] - 0.05) && (p.agStart == null || p.age < p.agStart);
      const tag = p.fresh ? '<span class="chip red">새로 투입</span>' : p.card ? '<span class="chip">보관함</span>' : '';
      const info = p.fresh ? `<span class="tiny muted">${esc(M.POS_KO[p.pos] || p.pos)} · 최고 OVR ${p.ovr} · 누르면 나이를 골라 1군에 합류</span>`
        : `<span class="tiny muted">${esc(M.isCloser(p) ? '마무리' : M.POS_KO[p.pos] || p.pos)} · OVR ${p.ovr || M.dispOvr(p.r, p.pos)}${p.age ? ` · <b>${p.age}세</b>` : ''}${growing ? ` (성장 중${p.lastF ? ` · 지난 시즌 출전 성장 ×${p.lastF}` : ''})` : ''}${role[p.id] ? ` · <b>${esc(role[p.id])}</b>` : ''}</span>`;
      const stats = p.fresh ? '' : `<div class="tiny">${lg.cur.year} 1군: ${ln(s1) || '<span class="muted">출전 기록 없음</span>'}${farm ? `<br>퓨처스: ${ln(s2) || '<span class="muted">출전 기록 없음</span>'}` : ''}${hurtLeft(p) ? ` <b class="x-warn">🚑 부상 ${hurtLeft(p)}경기 결장</b>` : ''}</div>`;
      const pick = p.fresh ? `data-act="x-fresh" data-v="${esc(p.id)}"` : !farm ? `data-act="x-ros" data-v="${esc(p.id)}"` : '';   // 새로 투입은 나이만 골라 1군으로 (라인업은 따로)
      return `<div class="x-myrow ${role[p.id] ? 'x-inlu' : ''}"><button class="x-myav" ${p.fresh ? '' : `data-act="x-myp" data-v="${esc(p.id)}"`} title="역대 기록"><canvas class="x-av" width="16" height="16" data-av="${a.av}" data-color="${esc(a.color)}"></canvas></button>
        <${pick ? 'button' : 'div'} class="x-myinfo" ${pick}><div><b>${inLu.has(p.id) ? '★' : ''}${esc(p.name)}</b> ${tag}${champs ? ` <span class="chip gold">🏆${champs}</span>` : ''}${titles ? ` <span class="chip">🏅${titles}</span>` : ''}</div>${info}${stats}</${pick ? 'button' : 'div'}>${mv}</div>`;
    };
    const sec = (t, arr) => arr.length ? `<h4 class="x-h4">${t} <span class="tiny muted">${arr.length}명</span></h4>${arr.map(row).join('')}` : '';
    const groups = arr => sec('타자', arr.filter(p => grp(p) === 1)) + sec('선발투수', arr.filter(p => grp(p) === 2)) + sec('불펜·마무리', arr.filter(p => grp(p) === 3));
    const one = all.filter(p => !M.inFarm(lg, p.id)).sort(sorter), two = all.filter(p => M.inFarm(lg, p.id)).sort(sorter);
    const fs = farmOn ? M.futStandings(lg) : null, me = fs && fs.find(s => s.id === lg.my), cap = M.MB.fut.cap;
    const tbl = fs ? `<details class="aw-gg" style="margin-top:8px"><summary class="small">퓨처스 순위 보기</summary><table class="lg x-box"><tr><th>순위</th><th>구단</th><th>승</th><th>패</th><th>무</th><th>승차</th></tr>${fs.map(s => `<tr class="${s.id === lg.my ? 'me' : ''}"><td>${s.rank}</td><td>${esc(s.name)} 2군</td><td>${s.w}</td><td>${s.l}</td><td>${s.t}</td><td>${s.gb ? s.gb.toFixed(1) : '-'}</td></tr>`).join('')}</table></details>` : '';
    return `<div class="panel"><div class="row" style="align-items:center"><h3 style="margin:0">1군</h3><span class="tiny muted" style="margin-left:8px">${one.length}명 · ★ 지금 라인업</span></div>
        <div class="tiny muted" style="margin:4px 0 6px">이름을 누르면 넣을 자리를 고르고, 초상화를 누르면 이 모드 역대 기록${farmOn ? ' · 2군 ↓ 으로 퓨처스에 보내 키울 수 있다' : ''}</div>
        ${groups(one)}</div>
      ${farmOn ? `<div class="panel x-fut"><div class="row" style="align-items:center;gap:8px"><h3 style="margin:0">🌱 퓨처스 (2군)</h3><span class="tiny muted">${two.length}명</span><span class="spacer"></span><span class="small">${me && me.w + me.l + me.t ? `<b>${me.rank}위</b> ${me.w}-${me.l}${me.t ? '-' + me.t : ''}` : '개막 전'}</span></div>
        <div class="tiny muted" style="margin:4px 0 6px">2군 선수는 1군 경기에 못 나오고 퓨처스에서 뛴다. 많이 뛸수록 다음 해 더 자란다.</div>
        ${two.length ? groups(two) : '<div class="small muted">2군 선수가 없다. 1군 목록에서 2군 ↓ 로 내려 보자.</div>'}${tbl}</div>` : ''}
      ${fresh.length ? `<div class="panel"><div class="row" style="align-items:center"><h3 style="margin:0">🗂️ 보관함 · 아직 안 넣은 선수</h3><span class="tiny muted" style="margin-left:8px">${fresh.length}명</span></div>
        <div class="tiny muted" style="margin:4px 0 6px">누르면 시작 나이(20~30세)를 골라 1군에 합류한다. 라인업에는 1군 목록에서 따로 넣는다</div>${groups(fresh)}</div>` : ''}`;
  }
  // 이 모드 역대 기록 창
  function myCareerSheet(id) {
    const lg = league(), p = M.lgPlayer(lg, id); if (!p) return;
    const R = lg.cardRec[id] || { seasons: [] }, s = lg.cur.stats[id], a = avOf(p);
    const done = lg.cur.phase === 'done' && R.seasons.some(x => x.season === lg.cur.season);
    const rows = R.seasons.map(x => ({ year: x.year, b: x.b, p: x.p, war: x.war, titles: x.titles || [], champ: x.champ }));
    if (s && !done) rows.push({ year: lg.cur.year, b: s.b, p: s.p, war: null, titles: [], champ: false, now: true });
    const isP = M.isPitcher(p) && p.role !== 'TW', showB = !isP || rows.some(r => r.b && r.b.PA), showP = isP || rows.some(r => r.p && r.p.outs);
    const tb = {}, tp = {}; let war = 0; for (const r of rows) { if (r.b) addTo(tb, r.b); if (r.p) addTo(tp, r.p); war += r.war || 0; }
    const yr = r => `${r.year}${r.now ? '<span class="tiny muted"> 진행</span>' : ''}${r.champ ? ' 🏆' : ''}`;
    const batTab = `<div class="tbl-scroll"><table class="lg x-box"><tr><th>연도</th><th>경기</th><th>타율</th><th>안타</th><th>홈런</th><th>타점</th><th>득점</th><th>도루</th><th>OPS</th><th>WAR</th></tr>
      ${rows.filter(r => r.b && r.b.PA).map(r => `<tr><td>${yr(r)}</td><td>${r.b.G}</td><td>${r3(Sim.AVG(r.b))}</td><td>${r.b.H}</td><td>${r.b.HR}</td><td>${r.b.RBI}</td><td>${r.b.R}</td><td>${r.b.SB}</td><td>${r3(Sim.OPS(r.b))}</td><td>${r.war != null ? r.war : '-'}</td></tr>`).join('')}
      <tr class="x-tot"><td>통산</td><td>${tb.G || 0}</td><td>${tb.AB ? r3(Sim.AVG(tb)) : '-'}</td><td>${tb.H || 0}</td><td>${tb.HR || 0}</td><td>${tb.RBI || 0}</td><td>${tb.R || 0}</td><td>${tb.SB || 0}</td><td>${tb.AB ? r3(Sim.OPS(tb)) : '-'}</td><td>${Math.round(war * 10) / 10}</td></tr></table></div>`;
    const pitTab = `<div class="tbl-scroll"><table class="lg x-box"><tr><th>연도</th><th>경기</th><th>승</th><th>패</th><th>세</th><th>홀</th><th>이닝</th><th>ERA</th><th>삼진</th><th>WAR</th></tr>
      ${rows.filter(r => r.p && r.p.outs).map(r => `<tr><td>${yr(r)}</td><td>${r.p.G}</td><td>${r.p.W}</td><td>${r.p.L}</td><td>${r.p.SV}</td><td>${r.p.HLD}</td><td>${ipT(r.p)}</td><td>${f2(Sim.ERA(r.p))}</td><td>${r.p.K}</td><td>${r.war != null ? r.war : '-'}</td></tr>`).join('')}
      <tr class="x-tot"><td>통산</td><td>${tp.G || 0}</td><td>${tp.W || 0}</td><td>${tp.L || 0}</td><td>${tp.SV || 0}</td><td>${tp.HLD || 0}</td><td>${tp.outs ? ipT(tp) : '0'}</td><td>${tp.outs ? f2(Sim.ERA(tp)) : '-'}</td><td>${tp.K || 0}</td><td>${showB ? '' : Math.round(war * 10) / 10}</td></tr></table></div>`;
    const champs = rows.filter(r => r.champ).map(r => r.year), titles = rows.flatMap(r => r.titles.map(t => `${r.year} ${t}`));
    const fnow = lg.cur.fut && lg.cur.fut.stats[id], futRows = R.seasons.filter(x => x.fb || x.fp).map(x => ({ year: x.year, b: x.fb, p: x.fp })).concat(fnow && !done ? [{ year: lg.cur.year, b: fnow.b, p: fnow.p, now: true }] : []);
    const isOwn = (lg.own || []).indexOf(id) >= 0, canRetire = X.mode === 'lg' && !p.filler && ((p.card && lg.cards[id]) || isOwn) && lg.cur.phase !== 'post';   // 71차: 원래 구단 선수도
    sheet(`<div class="row" style="gap:10px;align-items:center"><canvas class="x-av" width="16" height="16" data-av="${a.av}" data-color="${esc(a.color)}" style="width:52px;height:52px"></canvas>
        <div style="flex:1"><b style="font-size:17px">${esc(p.name)}</b><div class="tiny muted">${esc(M.isCloser(p) ? '마무리' : M.POS_KO[p.pos] || p.pos)} · ${esc(lg.club.name)} · ${R.seasons.length}시즌${p.filler ? ' · 생성 선수' : ''}</div></div>
        <div class="x-card-ovr big"><b class="num">${p.ovr || M.dispOvr(p.r, p.pos)}</b><i>OVR</i></div></div>
      <h4 class="x-h4">우승 · 수상</h4>
      ${champs.length || titles.length ? `<div class="stamps sm">${champs.map(y => `<span class="stamp gold">🏆 ${y} 우승</span>`).join('')}${titles.map(t => `<span class="stamp ${/MVP|골든/.test(t) ? 'gold' : ''}">${esc(t)}</span>`).join('')}</div>` : '<div class="tiny muted">아직 없음</div>'}
      ${showB ? `<h4 class="x-h4">타격 기록</h4>${batTab}` : ''}${showP ? `<h4 class="x-h4">투구 기록</h4>${pitTab}` : ''}
      ${futRows.length ? `<h4 class="x-h4">🌱 퓨처스 (2군)</h4><div class="tiny">${futRows.map(r => `${r.year}${r.now ? ' 진행' : ''}: ${[batLine(r.b), pitLine(r.p)].filter(Boolean).join(' / ') || '출전 없음'}`).join('<br>')}</div>` : ''}
      ${rows.length || futRows.length ? '' : '<div class="tiny muted" style="margin-top:8px">아직 이 모드에서 뛴 기록이 없다.</div>'}
      <div class="row" style="gap:8px;margin-top:14px"><button class="btn small" data-act="x-pinfo" data-m="lg" data-v="${esc(id)}" data-s="-" style="flex:1">🃏 카드 보기</button><button class="btn small" data-act="x-close-btn" style="flex:1">닫기</button></div>
      ${canRetire ? `<button class="btn small ghost block" data-act="x-retire" data-v="${esc(isOwn ? id : p.card)}" ${isOwn ? 'data-own="1"' : ''} style="margin-top:8px">👋 현역 은퇴시키기 <span class="tiny muted">(${isOwn ? '구단에서 빠지고 신인은 오지 않는다' : '보관함에서 다시 쓸 수 있다'} · 은퇴식에서 영구결번 지정)</span></button>` : ''}`);
  }
  // ---------- 은퇴식 · 영구결번 (구단 레전드) ----------
  function legendStat(lg, id) {
    const L = M.legendLine(lg, id), b = L.b, p = L.p, bits = [];
    if (b.PA) bits.push(`${b.G}경기 타율 ${r3(Sim.AVG(b))} ${b.H}안타 ${b.HR}홈런 ${b.RBI}타점`);
    if (p.outs) bits.push(`${p.G}경기 ${p.W}승 ${p.L}패${p.SV ? ` ${p.SV}세이브` : ''} ERA ${f2(Sim.ERA(p))}`);
    return { txt: bits.join(' / ') || '1군 기록 없음', yrs: L.from ? `${L.from}~${L.to}` : '', champ: L.champ };
  }
  function retireSheet(ids, title) {
    const lg = league(), R = (lg.retired || []).filter(x => ids.includes(x.id)), L = lg.legends || [];
    if (!R.length) return;
    sheet(`<h3>👋 ${esc(title || '은퇴식')}</h3><div class="tiny muted" style="margin-bottom:8px">우리 구단에 남긴 기록. 영구결번으로 지정하면 그 번호는 아무도 달 수 없고, 지난 시즌 탭에 구단 레전드로 남는다.</div>
      ${R.map(r => { const s = legendStat(lg, r.id), on = L.some(x => x.id === r.id), taken = !on && L.find(x => x.num === r.num);
        return `<div class="x-ret ${on ? 'on' : ''}"><canvas class="x-av" width="16" height="16" data-av="${+r.av || 1}" data-color="${esc(r.color || lg.club.color)}"></canvas>
          <div style="flex:1;min-width:0"><div><b>${esc(r.name)}</b> <span class="x-retnum num">${r.num != null ? r.num : '-'}</span> <span class="tiny muted">${esc(M.POS_KO[r.pos] || r.pos)} · ${r.age}세 은퇴${s.yrs ? ` · ${s.yrs}` : ''}${s.champ ? ` · 🏆${s.champ}` : ''}</span></div>
          <div class="tiny">${esc(s.txt)}</div></div>
          ${on ? `<button class="btn small" data-act="x-retnum" data-v="${esc(r.id)}" data-on="0" data-ids="${esc(ids.join(','))}">✓ 영구결번</button>` : taken ? `<span class="tiny muted">${r.num}번은<br>${esc(taken.name)}</span>` : r.num == null ? '' : `<button class="btn small go" data-act="x-retnum" data-v="${esc(r.id)}" data-on="1" data-ids="${esc(ids.join(','))}">🏅 ${r.num}번 영구결번</button>`}</div>`; }).join('')}
      <button class="btn block" data-act="x-close-btn" style="margin-top:12px">닫기</button>`);
  }
  function legendsHTML(lg) {
    const L = lg.legends || [], R = (lg.retired || []).slice().reverse();
    if (!L.length && !R.length) return '';
    return `<div class="panel"><h3>🏅 구단 레전드 · 영구결번</h3>
      ${L.length ? `<div class="x-legends">${L.slice().sort((a, b) => a.num - b.num).map(x => { const s = legendStat(lg, x.id); return `<div class="x-legend"><b class="num">${x.num}</b><span>${esc(x.name)}</span><i class="tiny muted">${s.yrs || x.year}${s.champ ? ` · 🏆${s.champ}` : ''}</i></div>`; }).join('')}</div>` : '<div class="small muted">아직 영구결번이 없다.</div>'}
      ${R.length ? `<button class="btn small block" data-act="x-retlist" style="margin-top:8px">은퇴 선수 ${R.length}명 · 영구결번 지정 ›</button>` : ''}</div>`;
  }
  // ---------- 시즌 리포트 (포스트시즌까지 끝난 뒤) ----------
  const LOOK_KO = { grow: ['📈', '성장'], hold: ['⭐', '최고 기량'], down: ['📉', '노쇠'], risk: ['⚠️', '은퇴 위기'] };
  function reportHTML(lg) {
    const R = M.seasonReport(lg); if (!R) return '';
    const who = (x, line) => x ? `<div class="x-rep-who"><b>${esc(x.name)}</b> <span class="tiny muted">${esc(M.POS_KO[x.pos] || x.pos)}${x.war != null ? ` · WAR ${x.war}` : ''}</span><div class="tiny">${line(x)}</div></div>` : '<div class="tiny muted">-</div>';
    const g = R.mgr && R.mgr.year === R.year ? `${R.mgr.ok ? '✔ 달성' : '✘ 실패'} (${GOAL_KO[R.mgr.goal]})` : '';
    const fb = R.farm.filter(x => (x.b && x.b.PA) || (x.p && x.p.outs)).map(x => `<div class="tiny">🌱 <b>${esc(x.name)}</b> ${[batLine(x.b), pitLine(x.p)].filter(Boolean).join(' / ')}</div>`).join('');
    const look = k => R.look.filter(x => x.k === k);
    const lk = k => look(k).length ? `<div class="x-look ${k}"><b class="small">${LOOK_KO[k][0]} ${LOOK_KO[k][1]} ${look(k).length}명</b><div class="tiny">${look(k).map(x => `${esc(x.name)} <i class="muted">${x.age}세${x.farm ? '·2군' : ''}</i>`).join(' · ')}</div></div>` : '';
    return `<div class="panel x-report"><h3>📋 ${R.year} 시즌 리포트</h3>
      <div class="x-trophy-sum" style="margin:6px 0 10px"><div><span class="tiny">정규시즌</span><b class="num">${R.rank}위</b><span class="tiny muted">${R.w}승 ${R.l}패${R.t ? ` ${R.t}무` : ''} · 득실 ${R.rs - R.ra > 0 ? '+' : ''}${R.rs - R.ra}</span></div>
        <div class="${R.post === '한국시리즈 우승' ? 'gold' : ''}"><span class="tiny">가을야구</span><b class="small">${esc(R.post)}</b>${g ? `<span class="tiny muted">목표 ${g}</span>` : ''}</div>
        ${R.fut ? `<div><span class="tiny">🌱 퓨처스</span><b class="num">${R.fut.rank}위</b><span class="tiny muted">${R.fut.w}승 ${R.fut.l}패</span></div>` : ''}</div>
      <div class="x-rep-grid"><div><span class="tiny muted">🏅 팀 MVP</span>${who(R.mvp, x => [batLine(x.b), pitLine(x.p)].filter(Boolean).join(' / '))}</div>
        <div><span class="tiny muted">🏏 최고 타자</span>${who(R.bat, x => batLine(x.b))}</div><div><span class="tiny muted">🎯 최고 투수</span>${who(R.pit, x => pitLine(x.p))}</div></div>
      ${fb ? `<h4 class="x-h4">퓨처스에서 뛴 선수</h4>${fb}` : ''}
      <h4 class="x-h4">다음 시즌 전망</h4>${lk('grow')}${lk('hold')}${lk('down')}${lk('risk')}${R.look.length ? '' : '<div class="tiny muted">보관함 카드가 없다.</div>'}
      <div class="tiny muted" style="margin-top:6px">은퇴 위기: 다음 시즌 ${M.MB.age.retire}세가 되거나, ${M.MB.age.dropAge}세 이후 최고 OVR보다 ${M.MB.age.drop - 4} 넘게 떨어진 선수.</div></div>`;
  }
  // 다음 시즌 시작 뒤: 오프시즌 변화 (나이 먹고 자라거나 늙은 정도, 은퇴)
  function offSheet() {
    const lg = league(), O = lg && lg.cur.off; if (!O) return;
    const up = O.ch.filter(x => x.d > 0), dn = O.ch.filter(x => x.d < 0).reverse(), row = x => `<div class="x-offrow"><span>${esc(x.name)} <i class="tiny muted">${x.age}세${x.farm ? ' · 2군' : ''}</i></span><b class="num ${x.d > 0 ? 'x-okline' : 'x-warn'}">${x.from} → ${x.to} (${x.d > 0 ? '+' : ''}${x.d})</b></div>`;
    sheet(`<h3>🗓️ ${O.year + 1} 시즌 준비 · 오프시즌 변화</h3>
      ${up.length ? `<h4 class="x-h4">📈 성장 ${up.length}명</h4>${up.map(row).join('')}` : ''}${dn.length ? `<h4 class="x-h4">📉 노쇠 ${dn.length}명</h4>${dn.map(row).join('')}` : ''}
      ${!up.length && !dn.length ? '<div class="small muted">능력치가 바뀐 선수가 없다.</div>' : ''}
      ${O.gone.length ? `<h4 class="x-h4">👋 은퇴 ${O.gone.length}명</h4><div class="small">${O.gone.map(g => `${esc(g.name)} (${g.age}세)`).join(', ')}</div><button class="btn small go block" data-act="x-retlist" data-ids="${esc(O.gone.map(g => g.id).join(','))}" style="margin-top:6px">🏅 은퇴식 · 영구결번 지정</button>` : ''}
      <button class="btn block" data-act="x-close-btn" style="margin-top:12px">새 시즌 시작</button>`);
  }
  // ---------- 지난 시즌 (원작 시상 화면 그대로) ----------
  function histPanel(hist, st, tn, label) {
    if (!hist.length) return '<div class="panel small muted">아직 끝난 시즌이 없다.</div>';
    return hist.slice().reverse().map(h => `<div class="panel"><h3>${esc(label(h))}</h3>
      <div class="small">🏆 우승 <b>${esc(h.championName)}</b> · 우리 구단 ${h.myRank}위 (${esc(h.myRec)})</div>
      ${h.post && h.post.length && h.post[0].score ? `<div class="small" style="margin-top:8px">${h.post.map(r => `${esc(r.name)}: <b>${esc(tn(r.win))}</b> ${esc(r.score)} <span class="muted">vs ${esc(tn(r.lose))}</span>`).join('<br>')}</div>` : ''}
      ${h.awards ? `<details class="aw-gg" style="margin-top:10px"><summary class="small">시상 보기</summary>${G().awardsHTML(st, h.awards)}</details>` : ''}</div>`).join('');
  }
  // ---------- 감독 커리어: 구단주 목표 · 신뢰도 · 20시즌 감독 은퇴 ----------
  const GOAL_KO = { champ: '한국시리즈 우승', ks: '한국시리즈 진출', ps: '가을야구 진출', half: '5할 승률' };
  function mgrHTML(lg) {
    const Mg = lg.mgr || { trust: 60, log: [] }, n = Mg.log.length, cur = lg.cur, last = Mg.log[n - 1], done = cur.phase === 'done';
    const yr = done ? n : n + 1, tr = Mg.trust, col = tr >= 70 ? '#16a34a' : tr >= 40 ? '#d97706' : '#dc2626';
    const res = done && last && last.year === cur.year ? `<div class="small ${last.ok ? 'x-okline' : 'x-warn'}" style="margin-top:4px">${last.ok ? '✔ 목표 달성' : '✘ 목표 실패'} (${GOAL_KO[last.goal]}) · 신뢰도 ${last.d > 0 ? '+' : ''}${last.d}</div>` : '';
    return `<div class="panel x-mgr"><div class="row" style="align-items:center;gap:8px"><b>👔 감독 ${yr}년차</b><span class="tiny muted">/ ${M.MB.mgr.seasons}시즌</span><span class="spacer"></span><span class="small">신뢰도 <b style="color:${col}">${tr}</b></span></div>
      <div class="x-trust"><i style="width:${tr}%;background:${col}"></i></div>
      <div class="small" style="margin-top:4px">구단주 목표 <b>${esc(GOAL_KO[done && last ? last.goal : cur.goal] || '가을야구 진출')}</b>${tr < 25 ? ' <span class="x-warn">— 구단주가 불만이 많다</span>' : ''}</div>${res}</div>`;
  }
  function mgrRetireHTML(lg) {
    const L = (lg.mgr || { log: [] }).log, w = L.reduce((a, x) => a + x.w, 0), l = L.reduce((a, x) => a + x.l, 0);
    const champ = L.filter(x => x.champ).length, ps = L.filter(x => x.rank <= 5).length, ok = L.filter(x => x.ok).length;
    return `<div class="panel reveal champ-banner mine"><div class="tiny muted">${L.length}시즌 감독 생활 끝</div><div class="champ-name">👔 감독 은퇴</div>
      <div class="x-trophy-sum" style="margin:10px 0"><div class="gold"><span class="tiny">🏆 우승</span><b class="num">${champ}</b></div><div><span class="tiny">통산</span><b class="num">${w}승</b><span class="tiny muted">${l}패 · 승률 ${w + l ? (w / (w + l)).toFixed(3).slice(1) : '-'}</span></div><div><span class="tiny">🍂 가을야구</span><b class="num">${ps}</b><span class="tiny muted">목표 달성 ${ok}/${L.length}</span></div></div>
      <div class="x-mgr-seasons">${L.map(x => `<span class="${x.champ ? 'champ' : x.rank <= 5 ? 'ps' : ''}"><i>${x.year}</i><b class="num">${x.w}-${x.l}</b><i>${x.champ ? '🏆' : x.rank + '위'}</i></span>`).join('')}</div>
      <div class="small">최종 신뢰도 ${lg.mgr.trust} · 새 감독으로 다시 시작하면 이 감독 기록은 보관함의 '명예의 전당' 아래 '역대 감독'에 남는다.</div>
      <button class="btn go block" data-act="x-lg-reset" style="margin-top:10px">🔄 새 감독으로 다시 시작</button></div>`;
  }
  // ---------- 구단 기록실: 우리 구단 통산 순위 · 한 시즌 최고 (이번 시즌 기록도 더해서) ----------
  function clubBookHTML(lg) {
    const C = M.clubInit(lg), cur = lg.cur, add = (a, b) => { const o = Object.assign({}, a); for (const k in b) if (typeof b[k] === 'number') o[k] = (o[k] || 0) + b[k]; return o; };
    const car = {}; for (const id in C.car) car[id] = { name: C.car[id].name, b: C.car[id].b, p: C.car[id].p, from: C.car[id].from, to: C.car[id].to };
    if (cur.phase !== 'done') for (const id in cur.stats) { const s = cur.stats[id]; if (s.t !== lg.my) continue; const e = car[id] || (car[id] = { name: (M.lgPlayer(lg, id) || {}).name || id, b: {}, p: {}, from: cur.year }); e.b = add(e.b, s.b); e.p = add(e.p, s.p); e.to = cur.year; }
    const list = Object.values(car); if (!list.length) return '';
    const r3 = x => x.toFixed(3).slice(1);
    const board = (t, f, fmt, ok) => { const top = list.filter(x => (ok ? ok(x) : true) && f(x) > 0).sort((a, b) => f(b) - f(a)).slice(0, 5); return top.length ? `<div class="x-book"><b class="small">${t}</b>${top.map((x, i) => `<div class="tiny"><span>${i + 1}. ${esc(x.name)}</span><b class="num">${fmt(f(x))}</b></div>`).join('')}</div>` : ''; };
    const hi = (k, b) => x => (b ? x.b : x.p)[k] || 0;
    const careers = [board('홈런', hi('HR', 1), v => v), board('안타', hi('H', 1), v => v), board('타점', hi('RBI', 1), v => v), board('도루', hi('SB', 1), v => v),
      board('타율 (1000타석+)', x => x.b.AB ? x.b.H / x.b.AB : 0, r3, x => (x.b.PA || 0) >= 1000), board('승', hi('W'), v => v), board('세이브', hi('SV'), v => v), board('탈삼진', hi('K'), v => v),
      board('평균자책점 (300이닝+)', x => x.p.outs ? 100 - x.p.ER * 27 / x.p.outs : 0, v => (100 - v).toFixed(2), x => (x.p.outs || 0) >= 900)].join('');
    const best = (C.best || []).slice(), one = (t, f) => { const top = best.filter(x => f(x) > 0).sort((a, b) => f(b) - f(a)).slice(0, 3); return top.length ? `<div class="x-book"><b class="small">${t}</b>${top.map(x => `<div class="tiny"><span>${esc(x.name)} <i class="muted">${x.year}</i></span><b class="num">${f(x)}</b></div>`).join('')}</div>` : ''; };
    const seasons = [one('홈런', x => x.b.HR || 0), one('안타', x => x.b.H || 0), one('타점', x => x.b.RBI || 0), one('도루', x => x.b.SB || 0), one('승', x => x.p.W || 0), one('세이브', x => x.p.SV || 0), one('탈삼진', x => x.p.K || 0)].join('');
    return `<div class="panel"><h3>📖 구단 기록실 <span class="tiny muted">${esc(lg.club.name)}에서 뛴 기록 (이 리그)</span></h3><h4 class="x-h4">통산</h4><div class="x-books">${careers}</div>${seasons ? `<h4 class="x-h4">한 시즌 최고</h4><div class="x-books">${seasons}</div>` : ''}</div>`;
  }
  function lgHist(lg) {   // 맨 위: 우리 구단 우승 횟수 (한국시리즈 · 정규시즌 1위 · 가을야구 진출)
    const H = lg.hist, ks = H.filter(h => h.champion === lg.my), reg = H.filter(h => (h.stand[0] || {}).id === lg.my), ps = H.filter(h => h.myRank && h.myRank <= 5);
    const top = `<div class="panel"><h3>${esc(lg.club.emblem)} ${esc(lg.club.name)} 우승 기록 <span class="tiny muted">${H.length}시즌</span></h3>
      <div class="x-trophy-sum"><div class="gold"><span class="tiny">🏆 한국시리즈 우승</span><b class="num">${ks.length}</b><span class="tiny muted">${ks.map(h => h.year).join(' · ') || '-'}</span></div>
        <div><span class="tiny">🥇 정규시즌 1위</span><b class="num">${reg.length}</b><span class="tiny muted">${reg.map(h => h.year).join(' · ') || '-'}</span></div>
        <div><span class="tiny">🍂 가을야구 진출</span><b class="num">${ps.length}</b></div></div></div>`;
    return top + legendsHTML(lg) + clubBookHTML(lg) + histPanel(H, lgFake(lg), id => lgTeamName(lg, id), h => `${h.year} · ${h.season}시즌${h.champion === lg.my ? ' 🏆' : ''}`);
  }

  // ================================================================
  // 화면 진입점 · 이벤트
  // ================================================================
  // ================================================================
  // 관전 픽셀 경기장 (원작 홈 화면 픽셀 그림체). 결과는 엔진이 정하고, 그림은 그 결과를 보여준다
  // ================================================================
  //   위치는 160×136 좌표로 정하고, 그릴 때 1.5배(240×204 캔버스). 선수는 픽셀 하나를 2×2로
  const PF = { W: 240, H: 204, K: 1.5, PX: 2, R: 3 };   // R: 실제 캔버스는 3배(720×612) — 글씨·얼굴을 선명하게
  const PT = { HOME: [80, 120], B1: [111, 90], B2: [80, 60], B3: [49, 90], MOUND: [80, 93] };
  const BASES = [PT.HOME, PT.B1, PT.B2, PT.B3, PT.HOME];
  const FPOS = { P: [80, 93], C: [80, 128], '1B': [108, 82], '2B': [96, 66], SS: [64, 66], '3B': [52, 82], LF: [38, 44], CF: [80, 30], RF: [122, 44] };
  // 몸통만 (머리는 야구카드 초상화 얼굴을 그대로 올린다) — W 유니폼, C 팀 색 줄, N 바지, S 피부(팔), G 글러브, B 배트
  const SPRP = {
    stand: ['.WCWW...', 'GWCWWS..', '.WCWW...', '..NNN...', '..N.N...', '.NN.NN..'],
    run1: ['.WCWWS..', 'SWCWW...', '..CWW...', '..NNN...', '.N...N..', 'N.....N.'],
    run2: ['SWCWW...', '.WCWWS..', '..CWW...', '..NNN...', '..NN....', '...N....'],
    pitSet: ['.WWCW...', 'GWWCW...', '.WWCW...', '..NNN...', '..N.N...', '.NN.NN..'],
    pitThrow: ['.WWCWWSS', 'GWWCW...', '..WCW...', '..NNN...', '.N...N..', 'N.....N.'],
    batUp: ['.WCWW.B.', 'SWCWW.B.', '.WCWWSB.', '..NNN...', '..N.N...', '.NN.NN..'],
    batSwing: ['BBBCWW..', '..WCWWS.', '.WCWW...', '..NNN...', '.N...N..', 'NN...NN.'],
    catcher: ['GWCWW...', '.WCWWW..', '.NN.NN..', 'NN..NN..'],
    ump: ['.KKK....', 'KKKK....', '.SSS....', '.KKKK...', 'KKKKK...', '.KK.KK..', 'KK..KK..'],
  };
  const HEAD0 = ['..HHH...', '.HHHH...', '.RSSS...'];   // 얼굴이 없을 때 기본 머리
  const sx = x => Math.round(x * PF.K), sy = y => Math.round(y * PF.K);
  const shadeHex = (hex, k) => { const n = parseInt((/^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '#3d4a5c').slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  function sprPal(team, home) { const U = (X.uniMap && X.uniMap[team + (home ? 'H' : 'A')]) || (team === '#26272b' ? null : aiUni(team, home)); return { H: team, R: '#1b1b1b', C: U ? U.C : team, N: U ? U.N : shadeHex(team, 0.55), W: U ? U.W : home ? '#f4f1ea' : '#bcc3cd', P: U ? U.P : team, pat: U ? U.pat : 'plain', S: '#f1c9a5', G: '#7a4a2a', B: '#d9b26b', K: '#26272b' }; }
  // 유니폼 디자인을 몸통 픽셀에 입힌다 (W = 상의 바탕, C = 배색, P = 핀 줄). 무늬·자세별로 한 번만 만든다
  const patCache = new Map();
  function patRows(rows, pat) {
    if (!pat || pat === 'plain') return rows;
    const key = pat + '|' + rows.join('/'); if (patCache.has(key)) return patCache.get(key);
    const body = rows.map((r, j) => /W/.test(r) ? j : -1).filter(j => j >= 0);
    const out = rows.map((r, j) => {
      const k = body.indexOf(j); if (k < 0) return r;
      const a = r.split(''), ws = a.map((ch, i) => ch === 'W' || ch === 'C' ? i : -1).filter(i => i >= 0), lo = Math.min(...ws), hi = Math.max(...ws), mid = (lo + hi) / 2;
      return a.map((ch, i) => {
        if (ch !== 'W' && ch !== 'C') return ch;
        if (pat === 'pin') return ch === 'C' ? 'C' : i % 2 ? 'P' : 'W';
        if (pat === 'raglan') return k === 0 ? 'C' : 'W';
        if (pat === 'sleeve') return i === lo || i === hi ? 'C' : 'W';
        if (pat === 'hoop') return k === 1 ? 'C' : 'W';
        if (pat === 'split') return i < mid ? 'C' : 'W';
        return ch;
      }).join('');
    });
    patCache.set(key, out); return out;
  }
  // 선수 한 명: 야구카드 초상화(drawAvatar) 얼굴을 머리로, 팔 피부색도 초상화와 같게
  const palCache = new Map();
  function faceOf(seed) { let s = (seed * 9301 + 49297) % 233280; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280; const skin = ['#f1c9a5', '#e0ac85', '#c98e64', '#a86f4c'][Math.floor(rnd() * 4)], hair = ['#1b1b1b', '#3b2618', '#5a3a22'][Math.floor(rnd() * 3)]; return { skin, hair }; }
  function playerPal(p, team, home) {
    if (!p) return sprPal(team, home);
    const key = p.id + '|' + team + '|' + home; if (palCache.has(key)) return palCache.get(key);
    const vc = p.card ? vault().cards.find(c => c.id === p.card) : null;
    const seed = vc ? (+vc.avatar || 1) : (M._t.hash(p.id) % 99991) + 1, cap = vc ? (vc.color || team) : team, f = faceOf(seed);
    const head = document.createElement('canvas'); G().drawAvatar(head, seed, cap);
    const pal = Object.assign(sprPal(team, home), { H: cap, R: f.hair, S: f.skin, head });
    palCache.set(key, pal); return pal;
  }
  // cx, fy: 160 좌표의 가운데·발끝
  function drawSpr(c, rows, cx, fy, pal, flip, alpha) {
    const P = PF.PX, R = PF.R, noFace = !pal.head && rows !== SPRP.ump;
    if (rows !== SPRP.ump) rows = patRows(rows, pal.pat);
    if (noFace) rows = HEAD0.concat(rows);
    const h = rows.length, x0 = sx(cx) - 4 * P, y0 = sy(fy) - h * P;
    c.globalAlpha = alpha == null ? 1 : alpha;
    c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(x0 + P, sy(fy) - 1, 6 * P, 2);   // 그림자
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[flip ? row.length - 1 - i : i]; if (ch !== '.') { c.fillStyle = pal[ch] || '#000'; c.fillRect(x0 + i * P, y0 + j * P, P, P); } } });
    if (pal.head && rows !== SPRP.ump) {   // 머리: 초상화 16×13칸을 실제 픽셀 2배로 (몸통 위에 살짝 겹쳐)
      const hw = 16 * 2, hh = 13 * 2, mx = Math.round((x0 + (flip ? 4.5 : 3.5) * P) * R - hw / 2), my = Math.round(y0 * R - hh + 4);
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false; c.globalAlpha = alpha == null ? 1 : alpha;
      c.drawImage(pal.head, 0, 0, 16, 13, mx, my, hw, hh); c.restore();
    }
    c.globalAlpha = 1;
  }
  let pfBG = null;
  function fieldBG() {   // 한 번만 그려 두는 배경
    if (pfBG) return pfBG;
    const cv = document.createElement('canvas'); cv.width = PF.W; cv.height = PF.H; const c = cv.getContext('2d');
    const hx = sx(PT.HOME[0]), hy = sy(PT.HOME[1]), RF = 112 * PF.K, img = c.createImageData(PF.W, PF.H), D = img.data;
    const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const C = { g1: hex('#3f8f4f'), g2: hex('#4c9e5c'), f1: hex('#367f45'), f2: hex('#3f8a4d'), wall: hex('#2a6b42'), pad: hex('#1f5434'), top: hex('#d4a52f'), st1: hex('#5b6b8c'), st2: hex('#6f7e9c'), st3: hex('#8c97b0'), dirt: hex('#c9915a'), warn: hex('#b98450') };
    const mx = sx(PT.MOUND[0]), my = sy(PT.MOUND[1]);
    for (let y = 0; y < PF.H; y++) for (let x = 0; x < PF.W; x++) {
      const dx = x - hx, dy = hy - y, d = Math.hypot(dx, dy), fair = dy > 0 && Math.abs(dx) <= dy + 1;
      let col;
      if (d > RF + 10) { const r = Math.floor((d - RF) / 4); col = (x + r) % 4 === 0 ? C.st3 : r % 2 ? C.st1 : C.st2; }   // 관중석 (층·사람 점)
      else if (d > RF + 2) col = C.wall; else if (d > RF) col = C.top;   // 펜스 · 노란 윗줄
      else if (d > RF - 7 && dy > 0) col = C.warn;   // 경고 트랙
      else { const band = (Math.floor((x + y) / 14) + Math.floor((x - y + 400) / 14)) % 2; col = fair ? (band ? C.g1 : C.g2) : (band ? C.f1 : C.f2); }   // 잔디 체크 무늬
      // 내야 흙: 마운드 중심 원(베이스 너머까지) · 페어 지역만
      if (d <= RF - 7 && Math.hypot(x - mx, y - my) < 50 && dy > -4 && Math.abs(dx) <= dy + 6) col = C.dirt;
      const i = (y * PF.W + x) * 4; D[i] = col[0]; D[i + 1] = col[1]; D[i + 2] = col[2]; D[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    // 안쪽 잔디 다이아몬드 + 베이스 길 흙
    const P = p => [sx(p[0]), sy(p[1])];
    c.fillStyle = '#4c9e5c'; c.beginPath(); const g = [[80, 112], [104, 90], [80, 67], [56, 90]].map(P); c.moveTo(...g[0]); g.slice(1).forEach(q => c.lineTo(...q)); c.closePath(); c.fill();
    c.fillStyle = '#c9915a'; c.beginPath(); c.arc(mx, my, 7, 0, 7); c.fill(); c.beginPath(); c.arc(hx, hy, 10, 0, 7); c.fill();
    c.fillStyle = '#e3b07a'; c.fillRect(mx - 2, my - 1, 4, 2);   // 투수판
    // 파울라인 · 타석 · 베이스
    c.fillStyle = '#ffffff'; for (let k = 0; k < 175; k++) { c.fillRect(hx + k, hy - k, 1, 1); c.fillRect(hx - k, hy - k, 1, 1); }
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1; c.strokeRect(hx - 13.5, hy - 6.5, 8, 12); c.strokeRect(hx + 5.5, hy - 6.5, 8, 12);
    [PT.B1, PT.B2, PT.B3].forEach(p => { const [x, y] = P(p); c.fillStyle = '#ffffff'; c.fillRect(x - 2, y - 2, 5, 5); });
    c.beginPath(); c.moveTo(hx - 3, hy - 2); c.lineTo(hx + 3, hy - 2); c.lineTo(hx + 3, hy + 1); c.lineTo(hx, hy + 3); c.lineTo(hx - 3, hy + 1); c.closePath(); c.fill();
    pfBG = cv; return cv;
  }
  function basePos(s) { s = Math.max(0, Math.min(4, s)); const i = Math.min(3, Math.floor(s)), f = s - i, a = BASES[i], b = BASES[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; }
  const lerp = (a, b, t) => a + (b - a) * t, ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  function hitTarget(an, dir) {
    const L = [[52, 82], [64, 66], [96, 66], [108, 82]], O = [FPOS.LF, FPOS.CF, FPOS.RF];
    switch (an) {
      case 'GO': case 'E': case 'DP': return { to: L[dir % 4], arc: 0, f: ['3B', 'SS', '2B', '1B'][dir % 4], thru: an === 'E' };
      case 'FO': case 'SF': return { to: O[dir % 3], arc: 34, f: ['LF', 'CF', 'RF'][dir % 3] };
      case '1B': return { to: [[56, 52], [80, 46], [104, 52]][dir % 3], arc: 6, f: ['LF', 'CF', 'RF'][dir % 3], late: true };
      case '2B': return { to: [[46, 24], [114, 24]][dir % 2], arc: 16, f: ['LF', 'RF'][dir % 2], late: true };
      case '3B': return { to: [[22, 40], [138, 40]][dir % 2], arc: 14, f: ['LF', 'RF'][dir % 2], late: true };
      case 'HR': return { to: [[34, -10], [80, -14], [126, -10]][dir % 3], arc: 50, f: ['LF', 'CF', 'RF'][dir % 3], late: true, gone: true };
      case 'BUNT': case 'BUNTF': return { to: [80, 106], arc: 0, f: 'P' };
      default: return { to: FPOS.C, arc: 0, f: null, noSwing: an === 'BB' || an === 'IBB' };
    }
  }
  const CAPTION = { HR: '홈런!', '3B': '3루타!', '2B': '2루타!', '1B': '안타', K: '삼진!', BB: '볼넷', IBB: '고의사구', GO: '땅볼 아웃', FO: '뜬공 아웃', DP: '병살!', E: '실책!', BUNT: '희생번트', BUNTF: '번트 실패' };
  // 글씨는 실제 픽셀(3배)로 그려 선명하게. x·y·size는 240 좌표 기준
  function txt(c, s, x, y, size, col, align) { const R = PF.R; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.font = `bold ${size * R}px sans-serif`; c.textAlign = align || 'center'; c.lineJoin = 'round'; c.lineWidth = 3 * R; c.strokeStyle = '#111827'; c.strokeText(s, x * R, y * R); c.fillStyle = col || '#fff'; c.fillText(s, x * R, y * R); c.restore(); }
  // 한 프레임 그리기
  function drawPitch(c, st) {
    c.setTransform(PF.R, 0, 0, PF.R, 0, 0); c.imageSmoothingEnabled = false;
    c.drawImage(fieldBG(), 0, 0);
    // 전광판 (관중석 가운데)
    c.fillStyle = '#111827'; c.fillRect(84, 2, 72, 22); c.strokeStyle = '#d4a52f'; c.lineWidth = 1; c.strokeRect(84.5, 2.5, 71, 21);
    const plain = (s, x, y, size, col, al) => { const R = PF.R; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.font = `bold ${size * R}px sans-serif`; c.textAlign = al; c.fillStyle = col; c.fillText(s, x * R, y * R); c.restore(); };
    plain(`${st.names[0].slice(0, 5)} ${st.score[0]}`, 88, 11, 8, '#fde68a', 'left'); plain(`${st.names[1].slice(0, 5)} ${st.score[1]}`, 88, 21, 8, '#fde68a', 'left');
    plain(st.innTxt, 152, 11, 8, '#93c5fd', 'right'); plain('●'.repeat(st.outs) + '○'.repeat(3 - st.outs), 152, 21, 8, '#fca5a5', 'right');
    const dp = sprPal(st.defColor, st.defHome), op = sprPal(st.offColor, !st.defHome), up = sprPal('#26272b', true);
    const dpo = k => playerPal(st.field && st.field[k], st.defColor, st.defHome), opo = id => playerPal(id && st.pl ? st.pl(id) : null, st.offColor, !st.defHome);   // 선수마다 초상화 색
    const ev = st.ev, t = st.t == null ? 1 : st.t, pa = ev && ev.pa, tg = pa ? hitTarget(pa.a, pa.dir || 0) : null;
    const tPitch = 0.22, tSwing = 0.3, tEnd = 0.82, fl = t <= tSwing ? 0 : Math.min(1, (t - tSwing) / (tEnd - tSwing));
    const lefty = st.lefty, BX = PT.HOME[0] + (lefty ? 7 : -7);
    // 공: 투구 → 타구(tSwing~tLand) → 수비가 잡아 송구(tLand~tEnd)
    const tLand = 0.6, kf = t <= tSwing ? 0 : Math.min(1, (t - tSwing) / (tLand - tSwing)), kt = t <= tLand ? 0 : Math.min(1, (t - tLand) / (tEnd - tLand));
    const THROW = { GO: [PT.B1], BUNT: [PT.B1], DP: [PT.B2, PT.B1], BUNTF: [PT.B2], SF: [PT.HOME], '1B': [PT.B2], '2B': [PT.B2], '3B': [PT.B3] };
    let ball = null;
    if (pa) {
      if (t < tPitch) { const k = t / tPitch; ball = [lerp(PT.MOUND[0], PT.HOME[0], k), lerp(PT.MOUND[1] - 3, PT.HOME[1] - 3, k), 0]; }
      else if (t < tSwing) ball = [PT.HOME[0], PT.HOME[1] - 2, 0];
      else if (t < tLand) {
        const k = ease(kf); let to = tg.to;
        if (tg.thru) to = [to[0] + (to[0] - 80) * 0.4, to[1] - 10];   // 실책: 글러브 밑으로 빠진다
        ball = [lerp(PT.HOME[0], to[0], k), lerp(PT.HOME[1] - 2, to[1], k), Math.sin(Math.PI * Math.min(1, k)) * tg.arc];
        if (tg.gone && k > 0.96) ball = null;
      } else if (t < tEnd + 0.04 && tg.f && !tg.gone) {
        const from = tg.thru ? [tg.to[0] + (tg.to[0] - 80) * 0.4, tg.to[1] - 10] : tg.to, path = THROW[pa.a];
        if (path) {   // 송구: 잡은 자리 → 베이스 (병살은 2루 거쳐 1루)
          const pts = [from].concat(path), seg = Math.min(pts.length - 2, Math.floor(kt * (pts.length - 1))), f2 = kt * (pts.length - 1) - seg;
          const a = pts[seg], b = pts[seg + 1]; ball = [lerp(a[0], b[0], f2), lerp(a[1], b[1], f2), Math.sin(Math.PI * f2) * 4];
        } else ball = [from[0], from[1], tg.arc && !tg.thru ? 6 : 0];   // 뜬공은 글러브 안, 실책은 굴러간 자리
      }
    }
    // 수비 (뒤쪽부터 그려야 겹침이 자연스럽다)
    const fieldOrder = ['CF', 'LF', 'RF', '2B', 'SS', '1B', '3B', 'P'];
    for (const k of fieldOrder) {
      let [x, y] = FPOS[k];
      const chase = tg && tg.f === k && t > tSwing;
      if (chase) { const r = tg.late ? lerp(0.62, 1, kt) : 0.95, k2 = ease(Math.min(1, kf * 1.1)) * r; x = lerp(x, tg.to[0], k2); y = lerp(y, tg.to[1], k2); }
      if (k === 'P') { drawSpr(c, pa && t < tPitch && t > 0.04 ? SPRP.pitThrow : SPRP.pitSet, x, y, dpo('P')); continue; }
      drawSpr(c, chase && (t < tLand || (tg.late && t < tEnd)) ? (Math.floor(t * 20) % 2 ? SPRP.run1 : SPRP.run2) : SPRP.stand, x, y, dpo(k), x > 80);
    }
    // 주자
    const runFrame = Math.floor(t * 18) % 2 ? SPRP.run1 : SPRP.run2;
    if (pa) {
      pa.before.forEach((id, i) => {
        if (!id) return;
        const j = pa.after.indexOf(id), scored = pa.sc.indexOf(id) >= 0, from = i + 1, to = j >= 0 ? j + 1 : scored ? 4 : from + 0.5;
        const s = lerp(from, to, ease(fl)), [x, y] = basePos(s), out = j < 0 && !scored;
        drawSpr(c, fl > 0 && fl < 1 && to !== from ? runFrame : SPRP.stand, x + 3, y, opo(id), false, out && fl > 0.7 ? Math.max(0, 1 - (fl - 0.7) / 0.3) : scored && fl >= 1 ? 0 : 1);
      });
    } else (st.basePl || []).forEach((bp, i) => { if (bp) { const [x, y] = basePos(i + 1); drawSpr(c, SPRP.stand, x + 3, y, playerPal(bp, st.offColor, !st.defHome)); } });
    // 타자 · 포수 · 주심 (앞쪽)
    const bIn = pa ? pa.after.indexOf(pa.b) : -1, bScored = pa ? pa.sc.indexOf(pa.b) >= 0 : false;
    if (!pa || t < tSwing + 0.02) drawSpr(c, pa && t > tPitch + 0.02 && !tg.noSwing ? SPRP.batSwing : SPRP.batUp, BX, PT.HOME[1] + 3, opo(pa ? pa.b : st.batterId), lefty);
    else {
      const to = bIn >= 0 ? bIn + 1 : bScored ? 4 : pa.a === 'K' ? 0 : 0.45;
      const s = lerp(0, to, ease(fl)), [x, y] = to === 0 ? [BX, PT.HOME[1] + 3] : basePos(s);
      const gone = bIn < 0 && !bScored;
      drawSpr(c, to > 0 && fl < 1 ? runFrame : pa.a === 'K' ? SPRP.batSwing : SPRP.stand, x, y, opo(pa.b), lefty && to === 0, gone && fl > 0.6 ? Math.max(0, 1 - (fl - 0.6) / 0.4) : bScored && fl >= 1 ? 0 : 1);
    }
    drawSpr(c, SPRP.catcher, FPOS.C[0], FPOS.C[1], dpo('C'));
    drawSpr(c, SPRP.ump, FPOS.C[0] + 1, FPOS.C[1] + 5, up);
    if (st.batterName && (!pa || t < tSwing)) txt(c, st.batterName, sx(BX), sy(PT.HOME[1]) - 27, 8);
    // 공 (그림자 + 공)
    if (ball) { const [x, y, h] = ball; c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(sx(x) - 1, sy(y), 3, 2); c.fillStyle = '#ffffff'; c.fillRect(sx(x) - 1, sy(y - h) - 3, 3, 3); c.fillStyle = '#c4352b'; c.fillRect(sx(x), sy(y - h) - 3, 1, 1); }
    // 자막
    if (pa && t > tEnd - 0.05) {
      const cap = pa.sc.length && pa.a !== 'HR' ? `${CAPTION[pa.a] || ''} ${pa.sc.length}점` : (CAPTION[pa.a] || '');
      if (cap) txt(c, cap, PF.W / 2, 44, pa.a === 'HR' ? 20 : 15, pa.a === 'HR' ? '#fde68a' : pa.sc.length ? '#fecaca' : '#ffffff');
    }
  }
  // 애니메이션 루프 (관전 화면 캔버스가 있을 때만)
  function pitchLoop() {
    const w = X.watch, cv = document.getElementById('x-pcv');
    if (!w || !cv) { if (w) w.raf = null; return; }
    const c = cv.getContext('2d'), v = w.g.v, A = w.anim;
    const t = A ? Math.min(1, (performance.now() - A.start) / A.dur) : null;
    const ev = A ? A.ev : null, offT = ev ? ev.t : v.half, defT = 1 - offT;
    const bp = v.batter() && v.batter().p, names = [0, 1].map(i => lgTeamName(w.lg, v.sides[i].tid));
    const sc = ev ? ev.sc : v.score;
    // 하이라이트 두 장면: 중계 시점으로 투구·타격 → 공이 맞으면 경기장으로 넘어가 수비·송구·주루 (삼진·볼넷은 중계 시점만)
    const el = A ? performance.now() - A.start : 0, hit = ev && ev.pa && ['K', 'BB', 'IBB'].indexOf(ev.pa.a) < 0;
    const inBC = (A && A.close && (!hit || el < A.bc)) || (!A && w.card);
    const tBC = A && A.close ? (hit ? Math.min(0.6, el / A.bc * 0.6) : t) : t, tField = A && A.close && hit ? 0.3 + 0.7 * Math.min(1, (el - A.bc) / (A.dur - A.bc)) : t;
    if (inBC) {   // 하이라이트: 투수 뒤 중계 시점 (작전 카드를 고르는 동안은 대기 장면)
      const fieldNow = Object.assign(Object.fromEntries(v.order[defT].map(x => [x.slot, x.p])), { P: v.cur[defT].p });
      const batP = ev ? M.lgPlayer(w.lg, ev.pa.b) : bp;
      drawBroadcast(c, { ev, t: tBC, lefty: ev ? ev.lefty : bp && M.handOf(bp) === 'L', pitPal: playerPal(fieldNow.P, w.colors[defT], defT === 1), catPal: playerPal(fieldNow.C, w.colors[defT], defT === 1), batPal: playerPal(batP, w.colors[offT], offT === 1), umpPal: sprPal('#26272b', true) });
      if (A && t >= 1) w.anim = null; w.raf = requestAnimationFrame(pitchLoop); return;
    }
    drawPitch(c, { defColor: w.colors[defT], offColor: w.colors[offT], defHome: defT === 1, ev, t: tField, bases: v.base.map(Boolean), lefty: ev ? ev.lefty : bp && M.handOf(bp) === 'L',
      names, score: sc, outs: Math.min(3, ev && ev.pa ? ev.pa.outs : v.outs), field: Object.assign(Object.fromEntries(v.order[defT].map(x => [x.slot, x.p])), { P: v.cur[defT].p }), pl: id => M.lgPlayer(w.lg, id), basePl: v.base, batterId: bp ? bp.id : null, innTxt: `${(ev || v).inn}회${(ev ? ev.half : v.half) ? '말' : '초'}`, batterName: ev ? '' : bp ? bp.name : '' });
    if (A && t >= 1) w.anim = null;
    w.raf = requestAnimationFrame(pitchLoop);
  }
  // ================================================================
  // 경기 관전 (내 구단 경기를 한 타석씩 본다. 플레이는 자동, 감독은 타임을 불러 교체·작전)
  // ================================================================
  const W_SPEED = { slow: 2200, normal: 1100, fast: 350 };
  const W_ANIM = { slow: 2600, normal: 1700 };   // 타석 애니메이션 길이
  const W_QUICK = 160;   // 하이라이트 모드에서 평범한 타석 (글자만)
  function watchStart() {
    const lg = league(); if (!lg) return;
    const g = lg.cur.phase === 'post' ? M.watchPost(lg) : M.watchDay(lg);   // 포스트시즌이면 내 시리즈 다음 경기
    if (!g) { saveLeague(); X.msg = '오늘은 내 구단 경기가 없다'; G().render(); return; }
    g.v.ctl.auto = false;   // 관전 중 내 구단 교체는 감독만 (하이라이트 작전 카드에서)
    const tc = tid => tid === lg.my ? lg.club.color : ((lg.teams.find(x => x.id === tid) || {}).color || "#3d4a5c");
    { const U = lg.club.uni || UNI_DEF, myHome = g.v.sides[1].tid === lg.my, col = uniCols(myHome ? U.home : U.away, lg.club.color, U.pat, accOf(U)); X.uniMap = { [lg.club.color + 'H']: col, [lg.club.color + 'A']: col }; palCache.clear(); }   // 내 구단 유니폼 (홈·원정)
    X.watch = { g, lg, speed: "normal", paused: false, alerts: true, hl: true, card: null, cardKey: -1, inHL: false, quick: false, timer: null, alertTxt: "", colors: [tc(g.v.sides[0].tid), tc(g.v.sides[1].tid)], seen: 0, anim: null, raf: null };
    G().App.view = 'x-watch'; G().render(); window.scrollTo(0, 0);
  }
  function watchEnd(toBox) {
    const w = X.watch; if (!w) return;
    clearTimeout(w.timer); w.timer = null;
    if (!w.g.closed) w.g.finish();
    if (w.lg.cur.phase === 'post') M.postSkipOthers(w.lg);   // 내 시리즈가 끝났으면 다른 시리즈는 결과만
    saveLeague();
    const id = w.g.id; X.watch = null; X.calM = null;
    G().App.view = MODE[X.mode].view; G().render();
    if (toBox) { const lg = league(), b = lg.cur.myBox[id]; if (b) boxSheet(b, t => lgTeamName(lg, t), pid => lgName(lg, pid), M.dateTxt(lg.year, b.day)); }
  }
  // ---------- 하이라이트: 작전을 낼 순간(타석 전)과 볼 만한 결과(타석 후) ----------
  //   타석 전: 내 공격 득점권·후반 접전 주자 / 내 수비 상대 득점권 접전·투구 수 95+ → 작전 카드
  //   타석 후: 홈런·득점·병살·작전 카드를 낸 타석 → 픽셀 애니메이션. 그 밖 평범한 타석은 글자만 빠르게
  function decisionNow(w) {
    const v = w.g.v, my = v.mine; if (my < 0 || v.done) return null;
    // 하이라이트 조건 (한 경기 평균 약 7번): 4회부터 3점 차 이내 득점권 / 7회부터 2점 차 이내 주자 있음 / 8회부터 3점 차 이내 주자 있음
    const inn = v.inn, gap = Math.abs(v.score[my] - v.score[1 - my]), diff = v.score[my] - v.score[1 - my];
    const b = v.base, risp = !!(b[1] || b[2]), on = risp || !!b[0], bx = v.batter();
    if (!bx || v.outs >= 3) return null;
    const sit = `${inn}회${v.half ? '말' : '초'} ${v.outs}사 ${on ? [b[0] && '1', b[1] && '2', b[2] && '3'].filter(Boolean).join('·') + '루' : '주자 없음'} · ${diff > 0 ? `${diff}점 앞섬` : diff < 0 ? `${-diff}점 뒤짐` : '동점'}`;
    const hot = (risp && inn >= 4 && gap <= 3) || (on && inn >= 7 && gap <= 2) || (on && inn >= 8 && gap <= 3);
    if (v.half === my) { if (hot) return { off: true, sit }; }
    else {
      // 내 투수가 지쳤거나 많이 맞으면 하이라이트 (교체는 감독만 할 수 있으니 물어본다). 같은 단계는 한 번만, 더 나빠지면 다시
      const st = v.cur[my], L = st.line, np = L.NP || 0, pid = st.p.id, sp = st.role === 'SP', asked = w.npAsked || (w.npAsked = {});
      const ask = (k, why, lvl) => { if (asked[pid + k]) return null; asked[pid + k] = 1; return { off: false, sit: `${sit} · ${st.p.name} ${why}`, trouble: true, lvl: lvl || 0 }; };
      let tr = null;
      const sta = liveSta(st);   // 지금 체력 (경기 전 컨디션 × 남은 투구 여력)
      if (sta <= 0) tr = ask('Z' + Math.floor(np / 10), `체력 0% · ${np}구 — 🚨 한계를 넘겼다! 지금 바꿔야 한다`, 3);   // 바닥나면 10구마다 다시
      if (!tr && sta <= 15) tr = ask('L15', `체력 ${sta}% · ${np}구 — ⚠ 교체가 필요하다`, 2);
      if (!tr && sta <= 30) tr = ask('L30', `체력 ${sta}% · ${np}구 — 지쳐 간다, 교체를 생각할 때`, 1);
      if (!tr && L.R >= (sp ? 3 : 2)) tr = ask('R' + L.R, `${L.R}실점`);
      if (!tr && sp && L.H >= 7) tr = ask('H' + Math.floor(L.H / 3), `${L.H}피안타`);
      if (!tr && !sp && L.outs >= st.target) tr = ask('O' + Math.floor(L.outs / 3), `${L.outs}아웃 처리 — 맡은 이닝 끝`);
      if (tr) return tr;
      if (hot) return { off: false, sit };
    }
    return null;
  }
  // ---------- 하이라이트 중계 시점: 투수 뒤에서 본 장면 (앞에 투수 뒷모습, 가운데 타자 정면, 뒤에 포수·주심) ----------
  const SPRB = {   // 8칸 너비. 투수 뒷모습은 얼굴 대신 모자·뒷머리, 등에 팀 색 번호 줄
    pitBackHead: ['..HHHH..', '.HHHHHH.', '..RRRR..'],
    pitBack: ['.WWWWWW.', 'GWWCCWWS', '.WWCCWW.', '.WWWWWW.', '..NNNN..', '..NN.NN.', '..N...N.', '.NN...NN'],
    pitBackThrow: ['SWWWWWW.', '.WWCCWW.', '.WWCCWWG', '.WWWWWW.', '..NNNN..', '.NN..NN.', 'NN....N.', 'N.....NN'],
    batFront: ['.WCWW.B.', 'SWCWWSB.', '.WCWW.B.', '..NNN...', '..N.N...', '.NN.NN..'],
    batFrontSwing: ['BBBBBB..', 'SWCWWS..', '.WCWW...', '..NNN...', '.N...N..', 'NN...NN.'],
    catFront: ['KKKKKK..', 'KSSSSK..', 'KKKKKK..', 'GWCWWW..', '.WWWWW..', 'NN..NN..'],
    umpFront: ['.KKKK...', 'KKKKKK..', '.SSSS...', '.KKKK...', 'KKKKKK..', 'KKKKKK..', '.KK.KK..', 'KK..KK..'],
  };
  let bcBG = null;
  function bcBack() {   // 관중석 · 광고 담장 · 흙 · 타석 선
    if (bcBG) return bcBG;
    const cv = document.createElement('canvas'); cv.width = PF.W; cv.height = PF.H; const c = cv.getContext('2d');
    for (let y = 0; y < 70; y++) for (let x = 0; x < PF.W; x++) { const r = Math.floor(y / 7), seat = (x + r * 5) % 7; c.fillStyle = seat === 0 ? '#d7dbe5' : seat === 1 ? '#f1c9a5' : seat === 2 ? '#1f3a68' : r % 2 ? '#3b4766' : '#46537a'; c.fillRect(x, y, 1, 1); }
    c.fillStyle = '#1e6b55'; c.fillRect(0, 70, PF.W, 26); c.fillStyle = '#d4a52f'; c.fillRect(0, 70, PF.W, 1);
    c.fillStyle = '#e8dfc8'; c.font = 'bold 15px sans-serif'; c.textAlign = 'center'; c.fillText('GOLDEN GLOVE', PF.W / 2, 90);
    c.fillStyle = '#4c9e5c'; c.fillRect(0, 96, PF.W, 8);
    for (let y = 104; y < PF.H; y++) { c.fillStyle = (y % 6 < 3) ? '#8a5b3a' : '#94623f'; c.fillRect(0, y, PF.W, 1); }
    // 타석 선 · 홈플레이트 (원근으로 조금 납작하게)
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1;
    c.strokeRect(118.5, 140.5, 26, 14); c.strokeRect(176.5, 140.5, 26, 14);
    c.beginPath(); c.moveTo(60, 160); c.lineTo(122, 140); c.moveTo(260, 160); c.lineTo(198, 140); c.stroke();
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(152, 146); c.lineTo(168, 146); c.lineTo(168, 149); c.lineTo(160, 152); c.lineTo(152, 149); c.closePath(); c.fill();
    c.fillStyle = '#c9a27a'; c.fillRect(64, 196, 60, 4);   // 투수판 (앞)
    bcBG = cv; return cv;
  }
  function drawSz(c, rows, cx, fy, pal, P, head, flip) {   // 크기 P로 그리기 (머리는 초상화 얼굴, 없으면 rows만)
    const R = PF.R, h = rows.length, x0 = Math.round(cx - 4 * P), y0 = Math.round(fy - h * P);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x0 + P, fy - 2, 6 * P, 3);
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[flip ? row.length - 1 - i : i]; if (ch !== '.') { c.fillStyle = pal[ch] || '#000'; c.fillRect(x0 + i * P, y0 + j * P, P, P); } } });
    if (head && pal.head) { const s = Math.round(P * R * 0.62), hw = 16 * s, hh = 13 * s; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false; c.drawImage(pal.head, 0, 0, 16, 13, Math.round((x0 + 3.5 * P) * R - hw / 2), Math.round(y0 * R - hh + P), hw, hh); c.restore(); }
    return y0;
  }
  // st: { pitPal, batPal, catPal, umpPal, lefty, ev(pa) | null(대기), t }
  function drawBroadcast(c, st) {
    c.setTransform(PF.R, 0, 0, PF.R, 0, 0); c.imageSmoothingEnabled = false;
    c.drawImage(bcBack(), 0, 0);
    const pa = st.ev && st.ev.pa, t = pa ? st.t : 0, tg = pa ? hitTarget(pa.a, 0) : null;
    const tWind = 0.16, tPitch = 0.4, tHit = 0.46, tEnd = 0.86;
    const swing = pa && !tg.noSwing && t >= tPitch - 0.03, contact = pa && !tg.noSwing && pa.a !== 'K';
    const BXc = st.lefty ? 188 : 132, plate = [160, 128], mitt = [160, 138];
    // 뒤: 주심 → 포수 → 타자
    drawSz(c, SPRB.umpFront, 162, 142, st.umpPal, 3, false);
    drawSz(c, SPRB.catFront, 160, 152, st.catPal, 3, false);
    const by0 = drawSz(c, swing ? SPRB.batFrontSwing : SPRB.batFront, BXc, 156, st.batPal, 4, true, st.lefty);
    // 스트라이크 존 (대기 중에만)
    if (!pa) { c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 0.7; c.strokeRect(152, 108, 16, 22); }
    // 공 (투수 손 → 홈, 점점 작게) / 맞은 뒤 결과대로
    let b = null, bs = 2;
    if (pa && t >= tWind && t < tPitch) { const k = (t - tWind) / (tPitch - tWind); b = [lerp(78, plate[0], k), lerp(140, plate[1], k) - Math.sin(k * Math.PI) * 10]; bs = lerp(6, 2, k); }
    else if (pa && t >= tPitch && (!contact || t < tHit)) { const k = Math.min(1, (t - tPitch) / 0.08); b = contact ? plate : [lerp(plate[0], mitt[0], k), lerp(plate[1], mitt[1], k)]; }
    else if (pa && contact && t >= tHit) {
      const k = Math.min(1, (t - tHit) / (tEnd - tHit - 0.04)), a = pa.a, dir = (pa.dir || 0) % 3;
      const sideX = [-40, 160, 360][dir];
      let to, arc, size = [2, 5];
      if (a === 'GO' || a === 'DP' || a === 'E') { to = [sideX < 160 ? 40 : sideX > 160 ? 280 : 120, 210]; arc = 0; size = [2, 7]; }
      else if (a === 'BUNT' || a === 'BUNTF') { to = [140, 170]; arc = 0; size = [2, 3]; }
      else if (a === 'FO' || a === 'SF') { to = [sideX, -30]; arc = 40; size = [2, 1]; }
      else if (a === 'HR') { to = [sideX * 0.7 + 50, -40]; arc = 60; size = [2, 1]; }
      else { to = [sideX < 160 ? -20 : 260, 60]; arc = 10; size = [2, 4]; }
      b = [lerp(plate[0], to[0], k), lerp(plate[1], to[1], k) - Math.sin(k * Math.PI) * arc]; bs = lerp(size[0], size[1], k);
      if (k >= 1) b = null;
    }
    if (b) { const s = Math.max(1.5, bs); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(b[0], b[1], s / 2, 0, 7); c.fill(); c.fillStyle = '#c4352b'; c.fillRect(b[0] - 0.3, b[1] - s / 2, 0.6, s); }
    if (contact && t >= tHit - 0.02 && t < tHit + 0.05) { c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(plate[0], plate[1] - 6, 12, 0, 7); c.fill(); }
    if (pa && pa.a === 'HR' && t > tHit + 0.2) { c.fillStyle = `rgba(253,230,138,${0.15 + 0.12 * Math.sin(t * 40)})`; c.fillRect(0, 0, PF.W, 70); }
    // 앞: 투수 뒷모습 (크게)
    const throwing = pa && t > tWind * 0.5 && t < tPitch + 0.06;
    const py0 = drawSz(c, throwing ? SPRB.pitBackThrow : SPRB.pitBack, 64, 214, st.pitPal, 6, false);
    drawSz(c, SPRB.pitBackHead, 64, py0, st.pitPal, 6, false);
    // 자막
    if (pa && t > tEnd - 0.04) {
      const cap = pa.sc.length && pa.a !== 'HR' ? `${CAPTION[pa.a] || ''} ${pa.sc.length}점` : (CAPTION[pa.a] || '');
      if (cap) txt(c, cap, PF.W / 2, 112, pa.a === 'HR' ? 28 : 20, pa.a === 'HR' ? '#fde68a' : pa.sc.length ? '#fecaca' : '#ffffff');
    }
  }
  // 능력 등급 (S~G)
  const grade = v => v >= 90 ? 'S' : v >= 80 ? 'A' : v >= 70 ? 'B' : v >= 60 ? 'C' : v >= 50 ? 'D' : v >= 40 ? 'E' : 'F';
  // 중계 정보판 (HTML): 왼쪽 위 점수·주자·아웃, 오른쪽 타자·투수
  function bcHUD(w) {
    const v = w.g.v, off = v.half, def = 1 - off, sides = v.sides, tn = t => lgTeamName(w.lg, sides[t].tid);
    const bx = v.batter(), bp = bx && bx.p, pst = v.cur[def], pp = pst && pst.p, b = v.base;
    if (!bp || !pp) return '';
    const g = k => { const d = Sim.disp(bp.r[k]); return `<b class="g${grade(d)} num">${d}</b>`; };   // 등급 글자 대신 능력치 숫자 (색은 등급대로)
    const cond = liveSta(pst), np = pst.line.NP || 0, BL = v.bat[off].get(bp.id);
    return `<div class="x-hud-sb"><div class="x-hud-inn">${v.inn}<i>${off ? '말' : '초'}</i></div><div class="x-hud-tm"><div>${esc(tn(0).slice(0, 4))} <b>${v.score[0]}</b></div><div>${esc(tn(1).slice(0, 4))} <b>${v.score[1]}</b></div></div>
        <div class="x-hud-bs"><i class="${b[1] ? 'on' : ''} b2"></i><i class="${b[2] ? 'on' : ''} b3"></i><i class="${b[0] ? 'on' : ''} b1"></i></div><div class="x-hud-o">O ${[0, 1, 2].map(i => `<i class="${i < v.outs ? 'on' : ''}"></i>`).join('')}</div></div>
      <div class="x-hud-r">
        <div class="x-hud-bat"><div class="x-hud-l1">VS ${handTxt(pp, true).slice(0, 1)} · 컨택 ${g('con')} 파워 ${g('pow')} 주력 ${g('spd')}</div><div class="x-hud-l2"><span>${bx.slot}</span> ${esc(bp.name)} <small>${handTxt(bp)} · ${BL ? `${BL.AB}타수 ${BL.H}안타` : ''}</small></div></div>
        <div class="x-hud-pit"><div class="x-hud-l1">투구 수 <b>${np}</b> · 체력 <b class="${cond <= 15 ? 'x-sta-red' : ''}">${cond}%</b></div><div class="x-hud-bar"><i style="width:${cond == null ? 100 : cond}%;background:${cond == null || cond >= 70 ? '#22c55e' : cond >= 50 ? '#f59e0b' : '#ef4444'}"></i></div><div class="x-hud-l2"><span>${pst.role === 'SP' ? '선발' : '구원'}</span> ${esc(pp.name)} <small>${handTxt(pp, true)}</small></div></div>
      </div>`;
  }
  // 아래 작전 카드 줄 (시간 제한 없음)
  // [키, 아이콘, 이름, 효과 한 줄, 종류(색): ai 회색 · hit 빨강(치기) · eye 파랑(고르기·제구) · run 노랑(작전·주루) · sub 보라(교체)]
  const OFF_CARDS = [['ai', '🤖', '자동', '감독 AI에 맡김', 'ai'], ['power', '💥', '강공', '장타↑ 삼진↑', 'hit'], ['contact', '🎯', '컨택', '삼진↓ 장타↓', 'eye'], ['oppo', '↗️', '밀어치기', '안타↑ 장타↓', 'eye'], ['pull', '↖️', '당겨치기', '장타↑ 안타↓', 'hit'], ['wait', '👀', '기다리기', '볼넷↑ 투구 수↑', 'eye'], ['first', '⚡', '초구 공략', '빠른 승부', 'hit'],
    ['bunt', '🏏', '희생번트', '주자 한 베이스', 'run'], ['steal', '👟', '도루', '한 베이스 더', 'run'], ['hitrun', '🏃', '히트앤런', '주자 먼저 출발', 'run'], ['time', '🔁', '대타·대주자', '선수 바꾸기', 'sub']];
  const DEF_CARDS = [['ai', '🤖', '자동', '포수 AI에 맡김', 'ai'], ['out', '◀', '바깥쪽', '장타↓ 볼넷↑', 'eye'], ['ins', '▶', '몸쪽', '빗맞은 타구↑', 'eye'], ['low', '⬇️', '낮게', '병살↑ 홈런↓', 'eye'], ['high', '⬆️', '높게', '삼진↑ 홈런↑', 'hit'], ['slow', '🐢', '완급 조절', '타이밍 뺏기', 'eye'], ['weak', '⚾', '범타 유도', '땅볼·병살↑', 'eye'], ['edge', '📐', '코너워크', '삼진↑ 볼넷↑', 'hit'], ['nohr', '🛡️', '장타 경계', '홈런↓ 볼넷↑', 'eye'],
    ['guard', '👁️', '주자 견제', '도루 막기', 'run'], ['ibb', '🚶', '고의사구', '1루 채우기', 'run'], ['in', '⏩', '전진수비', '홈에서 승부', 'run'], ['time', '🔁', '투수 교체', '투수·수비 바꾸기', 'sub']];
  function showCard(w, d) {
    const v = w.g.v, b = v.base;
    const okC = k => k === 'bunt' ? v.outs < 2 && !!(b[0] || b[1]) : k === 'steal' ? !!(b[0] && !b[1] || b[1] && !b[2]) : k === 'hitrun' ? !!b[0] : k === 'guard' ? !!(b[0] || b[1]) : k === 'in' ? !!b[2] && v.outs < 2 : k === 'ibb' ? !!(b[1] || b[2]) && !b[0] : true;
    // 선택지는 6개: 자동 · 기본 둘 · 지금 상황에 맞는 작전 둘 · 교체 (투수 위기면 교체를 맨 앞에)
    const pick = ks => ks.map(k => (d.off ? OFF_CARDS : DEF_CARDS).find(c => c[0] === k));
    const sit = (d.off ? ['bunt', 'steal', 'hitrun', 'wait', 'oppo'] : ['in', 'ibb', 'guard', 'low', 'edge']).filter(okC).slice(0, 2);
    w.card = { sit: d.sit, off: d.off, opts: pick(d.off ? ['ai', 'power', 'contact', ...sit, 'time'] : d.trouble ? ['time', 'ai', 'weak', 'nohr', ...sit] : ['ai', 'weak', 'nohr', ...sit, 'time']), trouble: d.trouble, lvl: d.lvl || 0 };
    w.paused = true;
  }
  function cardPick(k) {
    const w = X.watch; if (!w || !w.card) return;
    w.card = null; w.inHL = true;   // 이 타석은 중계 장면으로
    if (k === 'time') { watchTime(); return; }
    if (k !== 'ai') w.g.v.ctl.cmds.push({ type: 'tac', v: k });
    w.paused = false; G().render();
  }
  function cardHTML(w) {
    const showHud = w.card || (w.anim && w.anim.close);
    if (!showHud) return '';
    const c = w.card;
    return !c && w.hudSnap ? w.hudSnap : bcHUD(w);
  }
  function tacRowHTML(w) {
    const c = w.card; if (!c) return "";
    return `${c ? `<div class="x-sit-tag ${c.lvl >= 2 ? 'alarm' : ''}">${c.off ? '⚾ 공격 찬스' : c.lvl >= 2 ? '🚨 교체 필요' : c.trouble ? '⚠ 투수 위기' : '🛡 수비 위기'} · ${esc(c.sit)}</div>
      <div class="x-tac-row six">${c.opts.map(([k, ic, t, fx, cat], i) => `<button class="x-tac c-${cat} ${c.trouble && i === 0 ? 'hot' : ''}" data-act="x-w-card" data-v="${k}"><span class="x-tac-ic">${ic}</span><span class="x-tac-t">${t}</span><span class="x-tac-fx">${fx}</span></button>`).join('')}</div>
      <div class="x-tac-key"><i class="c-hit"></i>치기·승부 <i class="c-eye"></i>고르기·제구 <i class="c-run"></i>작전 <i class="c-sub"></i>교체</div>` : ''}`;
  }
  function watchTick() {
    const w = X.watch; if (!w) return; w.timer = null;
    if (w.paused || w.g.v.done) return;
    // 타석 전: 작전 낼 순간이면 카드 (같은 타석에 두 번 띄우지 않는다)
    const key = w.g.v.log.length;
    if (w.hl && w.cardKey !== key) { w.cardKey = key; const d = decisionNow(w); if (d) { showCard(w, d); G().render(); return; } }
    w.hudSnap = w.hl ? bcHUD(w) : "";   // 하이라이트 재생 중에는 친 타자 기준 정보판
    w.g.it.next();
    // 새 사건 중 타석 결과: 하이라이트면 픽셀 경기장에서 재생, 평범한 타석은 글자만
    const L = w.g.v.log, nev = L.slice(w.seen); w.seen = L.length;
    const pe = nev.filter(e => e.pa).pop();
    // 평범한 타석은 전체 경기장에서 플레이. 하이라이트(득점·실점 직전, 작전 카드를 띄운 타석)만 중계 시점 → 수비 플레이
    const big = !!(pe && w.hl && w.inHL);
    w.quick = false;
    if (pe && w.speed !== "fast") { const bp = M.lgPlayer(w.lg, pe.pa.b); pe.pa.dir = (L.length * 7 + pe.inn * 3) % 12; pe.lefty = bp && M.handOf(bp) === "L"; w.anim = { ev: pe, start: performance.now(), dur: W_ANIM[w.speed] * (big ? (['K', 'BB', 'IBB'].indexOf(pe.pa.a) >= 0 ? 1.2 : 3.4) : 1), bc: W_ANIM[w.speed] * 0.9, close: big }; }
    if (pe) w.inHL = false;
    if (w.g.v.alert) { if (w.alerts && !w.hl) { w.paused = true; w.alertTxt = w.g.v.alert; } w.g.v.alert = null; }
    if (w.g.v.done && !w.g.closed) { w.g.finish(); saveLeague(); }
    G().render();
  }
  function watchSchedule() {
    const w = X.watch; if (!w || w.timer || w.paused || w.g.v.done || G().App.view !== 'x-watch') return;
    const left = w.anim ? w.anim.dur - (performance.now() - w.anim.start) + 300 : 0;
    w.timer = setTimeout(watchTick, Math.max(w.quick ? W_QUICK : W_SPEED[w.speed], left));
    if (!w.raf) w.raf = requestAnimationFrame(pitchLoop);
  }
  const handTxt = (p, pit) => { const h = M.handOf(p, pit); return pit ? (h === 'L' ? '좌투' : '우투') : (h === 'L' ? '좌타' : h === 'S' ? '양타' : '우타'); };
  function viewWatch() {
    const w = X.watch; if (!w) { G().App.view = MODE[X.mode].view; return viewLeague(); }
    const lg = w.lg, v = w.g.v, sides = v.sides, my = v.mine, tn = t => lgTeamName(lg, sides[t].tid);
    const off = v.half, def = 1 - off, done = v.done;
    // 점수판
    const n = Math.max(9, v.line[0].length, v.line[1].length + (off === 1 ? 1 : 0), v.inn);
    const cell = (t, i) => { const r = v.line[t][i]; if (r != null) return r; if (!done && i === v.inn - 1 && t === off) return v.score[t] - v.line[t].reduce((a, b) => a + b, 0); return ''; };
    const sb = `<div class="tbl-scroll"><table class="lg x-line x-wline"><tr><th></th>${Array.from({ length: n }, (_, i) => `<th class="${!done && i === v.inn - 1 ? 'now' : ''}">${i + 1}</th>`).join('')}<th>R</th><th>H</th><th>E</th><th>B</th></tr>
      ${[0, 1].map(t => `<tr class="${t === my ? 'me' : ''}"><td>${esc(tn(t))}</td>${Array.from({ length: n }, (_, i) => `<td>${cell(t, i)}</td>`).join('')}<td><b>${v.score[t]}</b></td><td>${v.H(t)}</td><td>${v.E[t]}</td><td>${v.BB(t)}</td></tr>`).join('')}</table></div>`;
    // 다이아몬드 (주자·아웃)
    const bs = v.base, runner = (i, x, y) => `<g><rect x="${x - 9}" y="${y - 9}" width="18" height="18" transform="rotate(45 ${x} ${y})" class="${bs[i] ? 'on' : ''}"/>${bs[i] ? `<text x="${x}" y="${y + 24}" text-anchor="middle">${esc(bs[i].name)}</text>` : ''}</g>`;
    const dia = `<svg class="x-dia" viewBox="0 0 160 120"><path d="M80 105 L140 55 L80 15 L20 55 Z" class="ln"/>${runner(0, 140, 55)}${runner(1, 80, 15)}${runner(2, 20, 55)}<rect x="74" y="99" width="12" height="12" transform="rotate(45 80 105)" class="home"/></svg>`;
    const outsDots = [0, 1, 2].map(i => `<i class="${i < v.outs ? 'on' : ''}"></i>`).join('');
    // 지금 타자 vs 투수
    const bx = v.batter(), bp = bx && bx.p, pst = v.cur[def], pp = pst && pst.p, BL = bp && v.bat[off].get(bp.id), PL = pst && pst.line;
    const face = (p, t) => { const a = avOf(p); return `<canvas class="x-av" width="16" height="16" data-av="${a.av}" data-color="${esc(t === my ? lg.club.color : '#3d4a5c')}" style="width:44px;height:44px"></canvas>`; };
    const mu = done ? '' : `<div class="x-mu">
        <div class="x-mu-p">${bp ? face(bp, off) : ''}<div><div class="tiny muted">타자 · ${esc(tn(off))}</div><b>${esc(bp ? bp.name : '')}</b><div class="tiny">${bp ? `${handTxt(bp)} · ${BL ? `${BL.AB}타수 ${BL.H}안타${BL.HR ? ` ${BL.HR}홈런` : ''}${BL.RBI ? ` ${BL.RBI}타점` : ''}` : ''}` : ''}</div></div></div>
        <div class="x-mu-vs">VS</div>
        <div class="x-mu-p r"><div><div class="tiny muted">투수 · ${esc(tn(def))}</div><b>${esc(pp ? pp.name : '')}</b><div class="tiny">${pp ? `${handTxt(pp, true)} · ${ipT({ outs: PL.outs })}이닝 ${PL.K}K · <b>${PL.NP || 0}구</b>` : ''}</div></div>${pp ? face(pp, def) : ''}</div></div>`;
    // 중계
    const logs = v.log.slice(-14).reverse().map(e => `<div class="x-pbp ${e.kind}"><span class="x-pbp-i">${e.inn}${e.half ? '말' : '초'}</span>${esc(e.txt)}</div>`).join('');
    const sp = k => `<button class="btn small ${w.speed === k ? 'on' : ''}" data-act="x-w-speed" data-v="${k}">${{ slow: '느리게', normal: '보통', fast: '빠르게' }[k]}</button>`;
    const tacTxt = { steal: '도루', bunt: '번트', hitrun: '히트앤런', ibb: '고의사구', in: '전진수비' }[v.tac()];
    const ctrl = done ? `<div class="row" style="gap:8px"><button class="btn go" data-act="x-w-exit" data-v="box" style="flex:1">박스스코어</button><button class="btn" data-act="x-w-exit" style="flex:1">진행으로 돌아가기</button></div>`
      : `<div class="row wrap" style="gap:6px;align-items:center">${sp('slow')}${sp('normal')}${sp('fast')}<button class="btn small" data-act="x-w-pause">${w.paused ? '▶ 계속' : '⏸ 멈춤'}</button><span class="spacer"></span><button class="btn small" data-act="x-w-skip" title="${w.hl ? '다음 하이라이트까지 넘긴다' : '경기 끝까지'}">${w.hl ? '스킵 ⏭' : '끝까지 ⏭'}</button></div>
        <div class="row wrap" style="gap:6px;margin-top:6px;align-items:center">
          <label class="tiny"><input type="checkbox" data-act="x-w-hl" ${w.hl ? "checked" : ""}> 하이라이트 + 작전 카드</label>
          <span class="tiny muted">${w.hl ? '교체·작전은 하이라이트에서 감독이' : '교체는 AI가 알아서'}</span></div>
        ${tacTxt ? `<div class="tiny x-warn" style="margin-top:4px">다음 타석 작전: ${tacTxt}</div>` : ''}${v.ctl.cmds.length ? `<div class="tiny muted">명령 ${v.ctl.cmds.length}개 — 다음 타석 전에 적용</div>` : ''}`;
    const alertBox = w.paused && w.alertTxt ? `<div class="panel x-walert"><b>⚠ ${esc(w.alertTxt)}</b><div class="row" style="gap:6px;margin-top:6px"><button class="btn small" data-act="x-w-pause">계속</button></div></div>` : '';
    return `${topbar('경기 관전', MODE[X.mode].view)}${msgBox()}
      <div class="panel"><div class="tiny muted">${w.g.title ? esc(w.g.title) : M.dateTxt(lg.year, w.g.day)} · ${esc(tn(0))} @ ${esc(tn(1))}</div>${sb}</div>
      ${alertBox}
      <div class="panel x-wfield"><div class="x-wsit"><b>${done ? '경기 종료' : `${v.inn}회${off ? '말' : '초'}`}</b><span class="x-outs">${done ? '' : outsDots}</span><span class="tiny muted">${done ? '' : `${esc(tn(off))} 공격`}</span></div><div class="x-pcwrap"><canvas id="x-pcv" class="x-pcv" width="720" height="612"></canvas>${cardHTML(w)}</div>${tacRowHTML(w)}${mu}</div>
      <div class="panel">${ctrl}</div>
      <div class="panel"><h3>중계</h3><div class="x-pbps">${logs}</div></div>`;
  }
  // 타임: 지금 상황에 맞는 교체·작전
  function watchTime() {
    const w = X.watch; if (!w || w.g.v.done) return;
    w.paused = true; w.alertTxt = '';
    const v = w.g.v, my = v.mine, side = v.sides[my], batting = v.half === my, lg = w.lg;
    // 선수 옆에 능력치 (교체할 때 비교하기 쉽게). ref: 지금 뛰는 선수 (누를 수 없음, 비교 기준)
    const row = (act, p, extra, data, slot, ref) => { const a = avOf(p), pit = M.isPitcher(p) && p.role !== 'TW'; return `<${ref ? 'div' : 'button'} class="x-pk-item${ref ? ' x-pk-ref' : ''}" ${ref ? '' : `data-act="${act}"`} ${data}><div class="x-cand"><canvas class="x-av" width="16" height="16" data-av="${a.av}" data-color="${esc(lg.club.color)}" style="width:34px;height:34px"></canvas><div class="x-cand-mid"><div>${ref ? '<span class="chip">지금</span> ' : ''}<b>${esc(p.name)}</b> <span class="tiny muted">${esc(M.isCloser(p) ? '마무리' : M.POS_KO[p.pos] || p.pos)} · ${handTxt(p, pit)}</span>${extra || ''}</div>${abilLine(p, pit, slot || (pit ? null : p.pos))}</div><span class="x-pk-ovr"><b class="num">${p.ovr || M.dispOvr(p.r, p.pos)}</b></span></div></${ref ? 'div' : 'button'}>`; };
    // 대타·대주자가 그 수비 위치에 안 맞으면: 공격이 끝나고 수비 들어갈 때 남은 후보 중 맞는 선수로 자동 교체 (엔진 fixDefense와 같은 규칙)
    const swapNote = (p, slot, bench) => {
      if (!slot || slot === 'DH' || M.natural(p, slot)) return `<div class="tiny x-okline">✔ 수비도 그대로 (${esc(M.POS_KO[slot] || slot)})</div>`;
      const d = bench.filter(c => c !== p && M.natural(c, slot)).sort((a, b) => b.r.def - a.r.def)[0];
      return d ? `<div class="tiny x-warn">⚠ ${esc(M.POS_KO[slot])} 수비가 안 맞아 공격이 끝나면 ${esc(d.name)}(으)로 자동 교체</div>` : `<div class="tiny x-warn">⚠ ${esc(M.POS_KO[slot])} 맞는 후보가 없어 그대로 수비 (능력치 감점)</div>`;
    };
    let html = '';
    if (batting) {
      const bx = v.batter(), bench = v.bench[my];
      html += `<div class="tiny muted x-subnote">후보 5명만 쓸 수 있다. 대타·대주자가 수비 위치에 안 맞으면 공격이 끝날 때 남은 후보 중 그 포지션 선수로 자동 교체된다.</div><h4 class="x-h4">대타 — 다음 타자 ${esc(bx.p.name)} (${handTxt(bx.p)}) 대신</h4>${row('', bx.p, '', '', bx.slot, true)}${bench.length ? bench.map(p => row('x-w-cmd', p, swapNote(p, bx.slot, bench), `data-c="ph" data-v="${esc(p.id)}"`)).join('') : '<div class="tiny muted">남은 후보 없음</div>'}`;
      const bs = v.base; [0, 1, 2].forEach(b => { if (bs[b] && bench.length) html += `<h4 class="x-h4">대주자 — ${b + 1}루 ${esc(bs[b].name)} 대신</h4>${bench.map(p => row('x-w-cmd', p, ` <span class="tiny">주루 ${Sim.disp(p.r.spd)}</span>${swapNote(p, (v.order[my].find(x => x.p.id === bs[b].id) || {}).slot, bench)}`, `data-c="pr" data-b="${b}" data-v="${esc(p.id)}"`)).join('')}`; });
      html += `<h4 class="x-h4">작전 (다음 타석)</h4><div class="row wrap" style="gap:6px">${[['steal', '도루'], ['bunt', '번트'], ['hitrun', '히트앤런']].map(([k, t]) => `<button class="btn small" data-act="x-w-cmd" data-c="tac" data-v="${k}">${t}</button>`).join('')}</div>`;
    } else {
      const lu = lg.lineup, onLu = new Set([].concat(lu.SU || [], lu.MR || [], [lu.CL, lu.CL2]).filter(Boolean));   // 라인업에 올린 불펜 5명 + 마무리만
      const pen = [].concat(side.pen.SU || [], side.pen.MR || [], side.pen.LR || [], side.pen.CL ? [side.pen.CL] : []).filter((p, i, a) => p && a.indexOf(p) === i && onLu.has(p.id) && !v.used[my].has(p.id));
      const cp = v.cur[my];
      html += `<h4 class="x-h4">투수 교체 — 지금 ${esc(cp.p.name)} ${cp.line.NP || 0}구</h4>${row('', cp.p, ` <span class="tiny">${cp.line.NP || 0}구</span>`, '', null, true)}${pen.length ? pen.map(p => { const c = condNow(p); return row('x-w-cmd', p, ` ${gauge(c, true)}<span class="tiny">체력 ${c}</span>`, `data-c="pitch" data-v="${esc(p.id)}"`); }).join('') : '<div class="tiny muted">남은 불펜 없음</div>'}`;
      const bench = v.bench[my];
      if (bench.length) html += `<h4 class="x-h4">대수비</h4>${bench.map(p => { const i = v.order[my].findIndex(x => x.slot !== 'DH' && M.natural(p, x.slot)); return i >= 0 ? row('x-w-cmd', p, ` <span class="tiny">→ ${esc(M.POS_KO[v.order[my][i].slot])} ${esc(v.order[my][i].p.name)} 대신</span>`, `data-c="def" data-i="${i}" data-v="${esc(p.id)}"`, v.order[my][i].slot) : ''; }).join('') || '<div class="tiny muted">수비 바꿀 후보 없음</div>'}`;
      html += `<h4 class="x-h4">작전 (다음 타석)</h4><div class="row wrap" style="gap:6px">${[['ibb', '고의사구'], ['in', '전진수비']].map(([k, t]) => `<button class="btn small" data-act="x-w-cmd" data-c="tac" data-v="${k}">${t}</button>`).join('')}</div>`;
    }
    sheet(`<h3>⏱ 타임 — ${batting ? '공격' : '수비'}</h3><div class="small muted" style="margin-bottom:6px">고르면 다음 타석 전에 적용된다</div>${html}
      <button class="btn small block" data-act="x-w-resume" style="margin-top:12px">닫고 계속</button>`);
  }
  function watchCmd(el) {
    const w = X.watch; if (!w) return;
    const v = w.g.v, my = v.mine, c = el.dataset.c, id = el.dataset.v, P = pid => M.lgPlayer(w.lg, pid);
    if (c === 'pitch') { const side = v.sides[my], all = [].concat(side.pen.SU || [], side.pen.MR || [], side.pen.LR || [], side.pen.CL ? [side.pen.CL] : []), p = all.find(x => x && x.id === id); if (p) v.ctl.cmds.push({ type: 'pitch', p, role: p === side.pen.CL ? 'CL' : 'MR' }); }
    else if (c === 'ph') v.ctl.cmds.push({ type: 'ph', id });
    else if (c === 'pr') v.ctl.cmds.push({ type: 'pr', b: +el.dataset.b, id });
    else if (c === 'def') v.ctl.cmds.push({ type: 'def', i: +el.dataset.i, id });
    else if (c === 'tac') v.ctl.cmds.push({ type: 'tac', v: id });
    closeSheet(); w.paused = false; G().render();
  }
  function view(v) {
    if (v === 'x-vault') return viewVault();
    if (v === 'x-league') { X.mode = 'lg'; return viewLeague(); }
    if (v === 'x-online') { X.mode = 'on'; return viewLeague(); }
    if (v === 'x-loading') return viewLoadingX();
    if (v === 'x-watch') return viewWatch();
    return viewHub();
  }
  // ---------- 우승 애니메이션: 정규시즌 1위 · 한국시리즈 우승 (한 번만) ----------
  function champCheck() {
    const lg = X.mode && G().App.view === MODE[X.mode].view ? league() : null; if (!lg || !lg.cur || X.watch) return;
    const cur = lg.cur, ks = cur.phase === 'done' && cur.champion === lg.my && !cur.champSeen;
    const reg = !ks && ['regDone', 'post', 'done'].includes(cur.phase) && !cur.regSeen && (M.leagueStandings(lg)[0] || {}).id === lg.my;
    if (!ks && !reg) return;
    if (ks) cur.champSeen = cur.regSeen = true; else cur.regSeen = true; saveLeague();
    const n = ks ? lg.hist.filter(h => h.champion === lg.my).length : lg.hist.filter(h => (h.stand[0] || {}).id === lg.my).length + 1;
    const colors = ['#d4a52f', '#f5d76e', '#ffffff', lg.club.color, '#8fb3ff'];
    let conf = ''; for (let i = 0; i < 60; i++) conf += `<i style="left:${(i * 37) % 100}%;background:${colors[i % colors.length]};animation-delay:${((i * 0.13) % 2.2).toFixed(2)}s;animation-duration:${(2.2 + (i % 6) * 0.3).toFixed(2)}s"></i>`;
    G().App.troView = G().App.view;   // 원작 렌더가 팝업을 지우지 않게 (우승 트로피 팝업과 같은 표시)
    G().$modal.innerHTML = `<div class="hof-overlay x-champ-ov" data-act="x-champ-ok"><i class="tro-overlay" style="display:none"></i><div class="hof-confetti">${conf}</div>
      <div class="hof-box"><div class="x-champ-cup">${ks ? '🏆' : '🥇'}</div><div class="hof-kicker">${lg.year} ${ks ? '한국시리즈' : '정규시즌'}</div><div class="hof-big">${ks ? '우승!' : '1위 확정!'}</div>
        <div class="hof-name">${esc(lg.club.emblem)} ${esc(lg.club.name)}</div>
        <div class="hof-msg">${ks ? `구단 역사상 <b>${n}번째</b> 우승. 우리가 해냈다! 우승 반지를 낀다.` : `정규시즌 1위 ${n}번째. 한국시리즈 직행!`}</div>
        <button class="btn go" data-act="x-champ-ok">${ks ? '🏆 우승 반지 끼기' : '가을야구로'}</button></div></div>`;
  }
  function after() { drawAvatars(document.getElementById('app')); watchSchedule(); champCheck(); if (X.watch && !X.watch.raf && document.getElementById('x-pcv')) X.watch.raf = requestAnimationFrame(pitchLoop); }
  function go(v) { G().App.view = v; G().render(); window.scrollTo(0, 0); }
  function busy(fn) { try { fn(); } catch (e) { console.error(e); X.msg = '오류: ' + e.message; } }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act; if (!/^x-/.test(act)) return;
    const v = el.dataset.v, App = G().App;
    switch (act) {
      case 'x-go': if (X.watch) watchEnd(); if (v === 'x-vault') X.vaultHome = el.dataset.from === 'home'; go(v || 'x-hub'); break;
      case 'x-watch-start': watchStart(); break;
      case 'x-w-speed': X.watch.speed = v; X.watch.paused = false; G().render(); break;
      case 'x-w-pause': X.watch.paused = !X.watch.paused; X.watch.alertTxt = ''; G().render(); break;
      case 'x-w-resume': closeSheet(); X.watch.paused = false; G().render(); break;
      // 스킵: 하이라이트 모드면 다음 하이라이트(작전 카드)까지 바로 넘긴다. 하이라이트를 끈 상태면 경기 끝까지
      case 'x-w-skip': {
        const w = X.watch; clearTimeout(w.timer); w.timer = null; w.anim = null; w.alertTxt = ''; w.card = null;   // 카드가 떠 있을 때 스킵 = 자동
        let guard = 0;
        while (!w.g.v.done && guard++ < 3000) {
          const key = w.g.v.log.length;
          if (w.hl && w.cardKey !== key) { w.cardKey = key; const d = decisionNow(w); if (d) { showCard(w, d); break; } }
          w.g.it.next(); w.g.v.alert = null;
        }
        w.seen = w.g.v.log.length; w.inHL = false;
        if (w.g.v.done && !w.g.closed) { w.g.finish(); saveLeague(); }
        if (!w.card) w.paused = false;
        G().render(); break;
      }
      case 'x-w-time': watchTime(); break;
      case 'x-w-cmd': watchCmd(el); break;
      case 'x-w-exit': watchEnd(v === 'box'); break;
      case 'x-w-alerts': X.watch.alerts = el.checked; break;
      case 'x-w-card': cardPick(v); break;
      case 'x-w-hl': X.watch.hl = el.checked; X.watch.g.v.ctl.auto = !el.checked; G().render(); break;   // 하이라이트를 끄면 교체는 AI가
      case 'x-w-auto': X.watch.g.v.ctl.cmds.push({ type: 'auto', v: el.checked }); X.watch.g.v.ctl.auto = el.checked; break;
      case 'x-tab': X[el.dataset.k] = v; X.lsub = null; X.lsel = []; G().render(); break;
      case 'x-noop': break;
      case 'x-close': if (e.target.closest('.sheet')) break; closeSheet(); break;
      case 'x-close-btn': closeSheet(); break;
      case 'x-champ-ok': G().App.troView = null; closeSheet(); break;
      case 'x-card': cardDetail(v); break;
      case 'x-del': if (G().armed('x-del-' + v, el, '한 번 더 누르면 삭제')) { const vv = vault(); M.vaultRemove(vv, v); saveVault(vv); closeSheet(); G().render(); } break;
      case 'x-lu-slot': luPickSheet(v); break;
      case 'x-pk': openPick(el); break;
      case 'x-fa': faSheet(v); break;
      case 'x-rot': X.rotSel = null; rotSheet(); break;
      case 'x-rot-sel': {   // 72차: 선발 로테이션 순서 바꾸기 (1선발 차례에만)
        const lg = league(), lu = lg.lineup, i = +v;
        if (!M.canReorderRot(lg) || lg.cur.phase === 'post') { X.rotSel = null; rotSheet(); break; }
        if (X.rotSel == null || X.rotSel === i) { X.rotSel = X.rotSel === i ? null : i; rotSheet(); break; }
        const j = X.rotSel, a = lu.sp[j]; lu.sp[j] = lu.sp[i]; lu.sp[i] = a; X.rotSel = null;
        saveLeague(); G().render(); rotSheet(`${j + 1}선발 ↔ ${i + 1}선발 자리를 바꿨다`); break;
      }
      case 'x-myp': myCareerSheet(v); break;
      case 'x-pk-do': closeSheet(); doPick(v); break;
      // 71차: 라인업 아래 선수 목록
      case 'x-ros-sec': X.rosSec = v; G().render(); break;
      case 'x-ros': rosSlotSheet(v); break;
      case 'x-ros-put': {
        if (el.dataset.x === 'lg-pp' && /^sp/.test(el.dataset.k)) {   // 선발 자리끼리 맞바꾸기는 1선발 차례에만 (새 선발을 넣는 건 언제든)
          const lg = league(), other = pkeys(lg).find(kk => kk[0] === 's' && kk !== el.dataset.k && pkGet(lg.lineup, kk) === v);
          if (other && !M.canReorderRot(lg)) { closeSheet(); X.msg = '선발 순서는 1선발이 나올 차례에만 바꿀 수 있다'; G().render(); break; }
        }
        closeSheet(); X.pk = { x: el.dataset.x, i: el.dataset.i, k: el.dataset.k }; doPick(v); break;
      }
      case 'x-fresh': X.pk = null; agePickSheet(v); break;   // 71차: 보관함 선수 → 나이 골라 1군 합류 (라인업에는 직접 넣는다)
      case 'x-age-pick': {   // 70차: 보관함 카드 첫 투입 (나이 확정)
        if (!G().armed('x-age-' + v, el, `${v}세로 투입`)) break;
        const lg = league(), id = el.dataset.id, p = M.activateCard(lg, vault(), id.replace(/^v:/, ''), +v);
        closeSheet();
        if (p) { saveLeague(); X.msg = X.pk ? `${p.name} ${p.age}세로 투입 (OVR ${p.ovr})` : `${p.name} ${p.age}세로 1군 합류 (OVR ${p.ovr}) — 라인업에는 따로 넣으면 된다`; doPick(id); } else X.msg = '투입할 수 없는 카드다';
        G().render(); break;
      }
      case 'x-pinfo': {
        const slot = el.dataset.s;
        { const lg = league(), p = M.lgPlayer(lg, v); if (p) playerSheet(p, slot, lg.cur.stats[v]); }
        break;
      }
      case 'x-lu-pick': { const vv = vault(), pos = el.dataset.p || X.luPos; luPut(vv, pos, v || null); saveVault(vv); closeSheet(); G().render(); break; }
      case 'x-lu-set': {
        const vv = vault(), c = vv.cards.find(x => x.id === v);
        if (c) { const L = myLineup(vv), k = c.pos === 'RP' ? (LU_BP.find(b => !L[b]) || 'RP0') : c.pos; luPut(vv, k, c.id); saveVault(vv); }
        closeSheet(); G().render(); break;
      }
      case 'x-lu-auto': {
        // 제 포지션부터 채우고(불펜 3자리는 불펜 카드 OVR 순), 지명타자는 마지막에 (지명타자 카드 → 없으면 라인업에 못 든 타자 중 타격이 가장 좋은 선수)
        const vv = vault(); vv.lineup = vv.lineup || {};
        for (const exact of [true, false]) for (const k of LU_SLOTS.filter(p => p !== 'DH')) {   // 1차: 제 포지션 카드만, 2차: 남는 칸을 가능한 카드로
          if (myLineup(vv)[k]) continue;
          const used = new Set(Object.values(myLineup(vv)).map(c => c.id));
          const best = vv.cards.filter(c => canPlay(c, k) && !used.has(c.id) && (!exact || c.pos === slotPos(k))).sort((a, b) => (b.pos === slotPos(k)) - (a.pos === slotPos(k)) || b.ovr - a.ovr)[0]; if (best) vv.lineup[k] = best.id;
        }
        if (!myLineup(vv).DH) {
          const used = new Set(Object.values(myLineup(vv)).map(c => c.id));
          const best = vv.cards.filter(c => canPlay(c, 'DH') && !used.has(c.id)).sort((a, b) => (b.pos === 'DH') - (a.pos === 'DH') || M.dispOvr(b.r, 'DH') - M.dispOvr(a.r, 'DH'))[0];
          if (best) vv.lineup.DH = best.id;
        }
        saveVault(vv); G().render(); break;
      }
      case 'x-lu-clear': if (G().armed('x-lu-clear', el, '한 번 더')) { const vv = vault(); vv.lineup = {}; saveVault(vv); G().render(); } break;
      case 'x-devcard': el.textContent = '만드는 중…'; setTimeout(() => { busy(() => devCard(v)); G().render(); }, 30); break;
      case 'x-save': saveFromRetire(); break;
      case 'x-card-reuse': { const vv = vault(), c = vv.cards.find(x => x.id === v); if (c) { delete c.rest; saveVault(vv); X.msg = `${c.name} 다시 쓰기 — ${M.startAgeOf(c)}세로 새 생활`; closeSheet(); G().render(); } break; }
      case 'x-hof-add': if (G().armed('x-hof-' + v, el, '한 번 더 누르면 명예의 전당에 올린다 (보관함에서 빠진다)')) { const vv = vault(), r = M.hofInduct(vv, v, [league('lg'), league('on')]); if (r.ok) { saveVault(vv); saveBoth(); G().render(); hofSheet(); } else X.msg = r.why === 'full' ? '명예의 전당이 가득 찼다 (10명)' : '올릴 수 없다'; } break;
      case 'x-hof': hofSheet(); break;
      case 'x-hof-card': hofCard(v); break;
      case 'x-pickdel': X.sel = v; fullSheet(); break;
      case 'x-replace': if (X.sel && X.newCard && G().armed('x-rep', el, '한 번 더 누르면 삭제하고 저장')) { const vv = vault(); const r = M.vaultAdd(vv, X.newCard, X.sel); if (r.ok) saveVault(vv); X.newCard = null; X.sel = null; closeSheet(); G().render(); } break;
      // 리그모드
      case 'x-cr-uni': { const nm = document.getElementById('x-club-name'); if (nm) X.create.name = nm.value; X.create.uni = Object.assign({}, X.create.uni, { [el.dataset.k]: v }); G().render(); break; }
      case 'x-uni-open': case 'x-uni-set': {
        const lg = league(); if (!lg) break;
        if (act === 'x-uni-set') { lg.club.uni = Object.assign({}, UNI_DEF, lg.club.uni, { [el.dataset.k]: v }); saveLeague(); G().render(); }
        sheet(`<h3>👕 유니폼</h3><div class="small muted" style="margin-bottom:8px">관전 경기장에서 우리 선수들이 입는다</div>${uniPicker(lg.club.uni || {}, lg.club.color, 'x-uni-set')}<button class="btn small block" data-act="x-close-btn" style="margin-top:12px">닫기</button>`);
        break;
      }
      case 'x-cr': { const nm = document.getElementById('x-club-name'); if (nm) X.create.name = nm.value; X.create[el.dataset.k] = v; G().render(); break; }
      case 'x-lg-create': {
        const nm = document.getElementById('x-club-name'); const c = X.create; if (nm) c.name = nm.value.trim();
        const team = GAME_DATA.teams.find(t => t.id === c.slot);
        ST[X.mode] = M.newLeague({ seed: (Math.random() * 1e9) >>> 0, slot: c.slot, name: c.name || team.name, emblem: c.emblem, color: c.color || team.color, online: X.mode === 'on' }); league().club.uni = Object.assign({}, UNI_DEF, c.uni || {});
        M.signCards(league(), vault()); saveLeague(); X.tab = vault().cards.length ? 'lineup' : 'prog'; G().render(); break;
      }
      case 'x-lg-reset': if (G().armed('x-lg-reset', el, '한 번 더 누르면 이 리그 기록이 모두 지워지고 구단 만들기로')) { { const vv = vault(), n = M.resetLives(league(), vv), k = keepMgr(league(), vv); if (n || k) saveVault(vv); }   // 뛴 카드 기록을 명전 통산용으로 옮긴다 (사용 횟수는 온라인만)
        ST[X.mode] = null; saveLeague(); X.create = null; X.tab = 'prog'; X.lsub = null; G().render(); } break;
      // 진행: 계산은 바로 하고 원작과 같은 로딩 화면을 보여 준다
      case 'x-lg-month': { X.calM = null;
        const lg = league(), mn = M.MONTHS[M.monthOf(lg.cur.day, lg.year)];
        runLoading({ year: lg.year, sub: `${mn} 정규시즌 진행 중`, msgs: [`${mn} 첫 3연전`, '주중 3연전', '주말 3연전', '순위 싸움', `${mn} 마무리`], dur: 1500 }, () => { M.playLeagueMonth(lg, true); saveLeague(); });
        break;
      }
      case 'x-cal': { const lg = league(), cm = X.calM && X.calM.y === lg.year ? X.calM.m : M.gameDate(lg.year, Math.min(lg.cur.day, lg.cur.sched.length - 1)).m; X.calM = { y: lg.year, m: cm + +v }; G().render(); break; }
      case 'x-lg-game': { X.calM = null; const lg = league(); M.playLeagueDays(lg, 1, true); saveLeague(); G().render(); break; }
      case 'x-lg-series': { X.calM = null; const lg = league(), n = M.seriesLeft(lg) || 1, o = M.nextOpp(lg); runLoading({ year: lg.year, sub: `${o ? lgTeamName(lg, o.opp) + '와 ' : ''}${n}연전 진행 중`, msgs: Array.from({ length: n }, (_, i) => `${i + 1}차전`), dur: 400 + n * 250 }, () => { M.playLeagueDays(lg, n, true); saveLeague(); }); break; }
      case 'x-lg-all': { const lg = league(); runLoading({ year: lg.year, sub: '정규시즌 진행 중', msgs: LD_SEASON, dur: 2200 }, () => { M.playLeagueAll(lg); saveLeague(); }); break; }
      case 'x-lg-post': busy(() => { const lg = league(); M.leaguePostInit(lg); M.postSkipOthers(lg); saveLeague(); }); G().render(); window.scrollTo(0, 0); break;
      // 포스트시즌 내 시리즈: 한 경기 시뮬 · 시리즈 끝까지 시뮬 (끝나면 다른 팀 시리즈는 결과만)
      case 'x-ps-game': busy(() => { const lg = league(); M.playPostGame(lg); M.postSkipOthers(lg); saveLeague(); }); G().render(); break;
      case 'x-ps-series': busy(() => { const lg = league(); M.playLeagueSeries(lg); M.postSkipOthers(lg); saveLeague(); }); G().render(); window.scrollTo(0, 0); break;
      case 'x-lg-postall': { if (X.rv) break; X.rv = null; busy(() => { M.playLeaguePostAll(league()); saveLeague(); }); G().render(); window.scrollTo(0, 0); break; }
      case 'x-lg-next': { const lg = league(); runLoading({ year: lg.year + 1, sub: '새 시즌 준비', msgs: ['비시즌', '스프링캠프 출발', '시범경기 점검', '개막 준비'], dur: 1500 }, () => { const vv = vault(), O = M.leagueOffseason(lg, vv); saveVault(vv); saveLeague(); if (O && O.gone.length) X.msg = `👋 은퇴: ${O.gone.map(g => `${g.name}(${g.age}세)`).join(', ')} — 은퇴식에서 영구결번을 정할 수 있다. 보관함에서 다시 쓰거나 명예의 전당에 올릴 수도 있다`; }, () => offSheet()); break; }
      case 'x-off': offSheet(); break;
      case 'x-farm': { const lg = league(), r = M.farmMove(lg, v, el.dataset.on === '1', vault()); if (r.ok) saveLeague(); else X.msg = r.why; G().render(); break; }
      case 'x-retire': if (G().armed('x-retire-' + v, el, el.dataset.own ? '한 번 더 누르면 은퇴 (구단에서 빠진다)' : '한 번 더 누르면 은퇴 (이 리그에서 빠지고, 보관함에서 다시 쓸 수 있다)')) { const lg = league(), vv = vault(), r = el.dataset.own ? M.retireOwn(lg, v) : M.retireCard(lg, vv, v); if (r.ok) { saveVault(vv); saveLeague(); G().render(); retireSheet([r.e.id], `${r.e.name} 은퇴식`); } else { X.msg = r.why; closeSheet(); G().render(); } } break;
      case 'x-retnum': { const lg = league(), r = M.retireNum(lg, v, el.dataset.on === '1'); if (r.ok) { if (el.dataset.on === '1') { const e = (lg.retired || []).find(x => x.id === v); (lg.cur.news || (lg.cur.news = [])).push({ d: Math.max(-1, lg.cur.phase === 'reg' ? lg.cur.day - 1 : -1), k: 'legend', txt: `[${lg.club.name}] ${e.name}의 ${e.num}번 영구결번`, t: lg.my }); } saveLeague(); G().render(); retireSheet(el.dataset.ids.split(',')); } else X.msg = r.why; break; }
      case 'x-retlist': { const lg = league(); retireSheet(el.dataset.ids ? el.dataset.ids.split(',') : (lg.retired || []).slice().reverse().map(x => x.id), el.dataset.ids ? '은퇴식' : '은퇴 선수'); break; }
      case 'x-psbox': break;
      case 'x-lg-box': { const lg = league(), b = lg.cur.myBox[v]; if (b) boxSheet(b, t => lgTeamName(lg, t), id => lgName(lg, id), `${lg.year}년 ${gameLabel(lg, b)}`); break; }
      case 'x-lsub': X.lsub = v || null; X.lsel = []; G().render(); window.scrollTo(0, 0); break;
      case 'x-ls': { X.lsel = X.lsel || []; const i = X.lsel.indexOf(v); if (i >= 0) X.lsel.splice(i, 1); else if (X.lsel.length >= 2) X.lsel = [v]; else X.lsel.push(v); G().render(); break; }
      case 'x-ls-clear': X.lsel = []; G().render(); break;
      case 'x-ls-swap': lsSwap(); X.lsel = []; G().render(); break;
      case 'x-lg-mv': { const lg = league(), a = lg.lineup.bat, i = +v, j = i + +el.dataset.d; if (j >= 0 && j < 9) { [a[i], a[j]] = [a[j], a[i]]; saveLeague(); G().render(); } break; }
      case 'x-lg-clear': { const lg = league(); M.clearMyLineup(lg); saveLeague(); G().render(); break; }
      case 'x-lg-auto': { const lg = league(); lg.lineup = M.myAutoLineup(M.myPool(lg).filter(p => !M.isHurt(lg, p.id, M.nowDay(lg))), M.bpN(lg)); saveLeague(); G().render(); break; }
    }
  });
  document.addEventListener('change', e => {
    const el = e.target.closest('select[data-x]'); if (!el) return;
    const x = el.dataset.x;
    if (/^lg-/.test(x)) lgSelectChange(el);
  });

  return { view, after, retirePanel, _x: X, _st: ST, _reload() { ST.lg = undefined; ST.on = undefined; } };
})();
window.ModesUI = ModesUI;
