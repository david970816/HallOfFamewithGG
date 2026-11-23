// 골글 들고 명전으로 — 화면
(function () {
  'use strict';
  const $app = document.getElementById('app');
  const $modal = document.getElementById('modal-root');
  const VER = GAME_DATA.version;
  const KEY_SAVE = 'dugout_save_' + VER, KEY_REC = 'dugout_records', KEY_DEV = 'dugout_dev', KEY_BENCH = 'dugout_bench_' + VER;
  // 39차: 역대 최고점수 TOP 50 → 52차: 역대 TOP 20 + 시즌 TOP 50 (ALL_MAX·SEASON_MAX)

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } },
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const KEY_ADMIN = 'dugout_admin2';
  const ADMIN_HASH = 'bd54c316efd8aed7048bfb6d52aa1c5acab855674870e56c896e495be52baeec';
  try { localStorage.removeItem('dugout_admin'); } catch (e) { }
  const sha256 = s => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
  const isAdmin = false;
  const App = {
    view: 'home', st: null, admin: isAdmin, dev: isAdmin && !!store.get(KEY_DEV, false), flipped: false, tab: 'career', lgCat: 'HR', res: null, reaction: null,
    create: null,
  };

  // ---------- 저장 ----------
  // 39차: 은퇴해서 기록(카드·점수·업적)을 남긴 커리어는 저장 데이터를 지운다
  function save() { if (!App.st) return; if (App.st.done && App.st._recorded) { store.del(KEY_SAVE); return; } store.set(KEY_SAVE, App.st); }
  function loadSave() { const sv = store.get(KEY_SAVE, null); if (sv && sv.done && sv._recorded) { store.del(KEY_SAVE); return null; } return sv; }

  // ---------- 포맷 ----------
  const r3 = v => Sim.rate3(v);
  const ip = s => Sim.ipTxt(s);
  const f2 = v => (Math.round(v * 100) / 100).toFixed(2);
  const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
  const ALLTEAMS = GAME_DATA.teams.concat(GAME_DATA.npbTeams || [], GAME_DATA.mlbTeams || [], GAME_DATA.univTeams || []);
  const TEAMCOLOR = id => (ALLTEAMS.find(t => t.id === id) || {}).color || '#1f3a68';
  const SCHOOL = { strong: '명문고', mid: '중위권', weak: '약체' };
  const HANDS = [['R', 'R', '우투우타'], ['R', 'L', '우투좌타'], ['L', 'L', '좌투좌타'], ['L', 'R', '좌투우타']];
  function handText(me) { return (me.throws === 'R' ? '우투' : '좌투') + (me.bats === 'R' ? '우타' : me.bats === 'L' ? '좌타' : '양타'); }
  function mainPosText(f, me) { return f.mainPos === 'TW' ? '이도류' : (Sim.POSNAME[f.mainPos] || posText(me)); }
  function posText(me) { return (me.pos === 'RP' && me.flags && me.flags.closer ? '마무리투수' : Sim.posName(me)) + (me.twoWay ? ' · 이도류' : ''); }

  // ---------- 픽셀 아바타 ----------
  function drawAvatar(cv, seed, color) {
    const N = 16, ctx = cv.getContext('2d');
    cv.width = N; cv.height = N;
    let s = (seed * 9301 + 49297) % 233280; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const skins = ['#f1c9a5', '#e0ac85', '#c98e64', '#a86f4c'];
    const skin = skins[Math.floor(rnd() * skins.length)], hair = ['#1b1b1b', '#3b2618', '#5a3a22'][Math.floor(rnd() * 3)];
    const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
    const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    ctx.clearRect(0, 0, N, N);
    // 유니폼
    rect(2, 13, 12, 3, '#f4f1ea'); rect(7, 13, 2, 3, color); rect(2, 13, 1, 3, color); rect(13, 13, 1, 3, color);
    // 목
    rect(6, 12, 4, 1, skin);
    // 얼굴
    rect(4, 6, 8, 6, skin); rect(3, 8, 1, 2, skin); rect(12, 8, 1, 2, skin);
    // 머리카락(옆)
    rect(4, 6, 1, 2, hair); rect(11, 6, 1, 2, hair);
    // 모자
    rect(4, 2, 8, 4, color); rect(5, 1, 6, 1, color); rect(3, 5, 11, 1, color); rect(11, 5, 3, 1, shade(color));
    px(7, 3, '#ffffff'); px(8, 3, '#ffffff');
    // 눈·입
    const eyeY = 8;
    px(6, eyeY, '#1b1b1b'); px(9, eyeY, '#1b1b1b');
    if (rnd() < 0.3) { rect(5, 7, 2, 1, hair); rect(9, 7, 2, 1, hair); }
    rect(7, 10, 2, 1, '#9b4a3a');
    if (rnd() < 0.25) rect(5, 11, 6, 1, hair); // 수염
    if (rnd() < 0.2) { px(5, 9, '#e98a7a'); px(10, 9, '#e98a7a'); }
  }
  // ---------- 홈 화면 픽셀 장면 (투수 → 타자 → 홈런, 하늘의 별) ----------
  const PIX = { H: '#c4352b', S: '#f1c9a5', W: '#f4f1ea', N: '#1f3a68', G: '#7a4a2a', B: '#d9b26b', K: '#1b1b1b' };
  const SPR = {
    pitSet: ['..HHH...', '..HHHH..', '..SSS...', '.WWWW...', 'GWWWW...', '.WWWW...', '..NNN...', '..N.N...', '..N.N...', '.NN.NN..'],
    pitThrow: ['..HHH...', '..HHHH..', '..SSS...', '.WWWWWSS', 'GWWWW...', '..WWW...', '..NNN...', '.N...N..', 'N.....N.', 'N.....N.'],
    batUp: ['.....B..', '.....B..', '..HHHB..', '.HHHH...', '..SSS...', '.WWWW...', 'SWWWW...', '.WWWW...', '..NNN...', '..N.N...', '..N.N...', '.NN.NN..'],
    batSwing: ['........', '........', '..HHH...', '.HHHH...', '..SSS...', 'BBBWWW..', '..WWWWS.', '.WWWW...', '..NNN...', '.N...N..', '.N...N..', 'NN...NN.'],
    catcher: ['.KKK....', 'KKKK....', '.SSS....', 'GWWWW...', '.WWWWW..', '.NN.NN..', 'NN..NN..'],
  };
  const STARS = [[6, 3], [27, 2], [36, 6], [58, 3], [17, 7]];
  function drawSprite(c, rows, x, y, flip) {
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[flip ? row.length - 1 - i : i]; if (ch !== '.') { c.fillStyle = PIX[ch]; c.fillRect(x + i, y + j, 1, 1); } } });
  }
  function drawHero(c, f) {
    c.clearRect(0, 0, 64, 26);
    // 밤하늘·조명탑·외야 펜스
    c.fillStyle = '#16213a'; c.fillRect(0, 0, 64, 26);
    c.fillStyle = '#1d2c4d'; c.fillRect(0, 10, 64, 8);
    c.fillStyle = '#5b6b8c'; c.fillRect(2, 4, 1, 14); c.fillRect(61, 4, 1, 14);
    c.fillStyle = '#fff3c4'; c.fillRect(1, 3, 3, 1); c.fillRect(60, 3, 3, 1);
    c.fillStyle = '#245a3a'; c.fillRect(0, 17, 64, 5);
    c.fillStyle = '#2e6b46'; c.fillRect(0, 17, 64, 1);
    // 별 (반짝임)
    STARS.forEach(([x, y], i) => { const on = (f + i * 7) % 20 < 14; c.fillStyle = '#d4a52f'; c.fillRect(x, y, 1, 1); if (on) { c.fillRect(x - 1, y, 1, 1); c.fillRect(x + 1, y, 1, 1); c.fillRect(x, y - 1, 1, 1); c.fillRect(x, y + 1, 1, 1); } });
    // 땅: 잔디·마운드·홈 주변 흙
    c.fillStyle = '#3f8f4f'; c.fillRect(0, 22, 64, 4);
    c.fillStyle = '#4fa35f'; for (let x = 0; x < 64; x += 4) c.fillRect(x + ((x / 4) % 2), 22, 2, 1);
    c.fillStyle = '#c9915a'; c.fillRect(5, 21, 12, 2); c.fillRect(7, 20, 8, 1); c.fillRect(42, 22, 20, 2);
    c.fillStyle = '#ffffff'; c.fillRect(52, 22, 3, 1);   // 홈 플레이트
    // 선수들
    const throwing = f >= 6 && f < 10, swung = f >= 17 && f < 34;
    drawSprite(c, throwing ? SPR.pitThrow : SPR.pitSet, 7, 12);
    drawSprite(c, swung ? SPR.batSwing : SPR.batUp, 46, 10);
    drawSprite(c, SPR.catcher, 56, 15);
    // 공: 투구 (8~16) → 타격 후 하늘로 (17~33)
    let bx = null, by = null;
    if (f >= 8 && f <= 16) { const t = (f - 8) / 8; bx = 15 + (46 - 15) * t; by = 15 + Math.sin(t * Math.PI) * -2 + t * 1; }
    else if (f >= 17 && f <= 33) { const t = (f - 17) / 16; bx = 46 - 40 * t; by = 16 - 22 * Math.sin(t * Math.PI * 0.62) ; }
    if (bx != null && by > -2) { c.fillStyle = '#ffffff'; c.fillRect(Math.round(bx), Math.round(by), 1, 1); c.fillStyle = 'rgba(196,53,43,.7)'; c.fillRect(Math.round(bx) + 1, Math.round(by), 1, 1); }
  }
  function startHero() {
    const cv = document.getElementById('hero-pix');
    if (!cv) return;
    const c = cv.getContext('2d');
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { drawHero(c, 22); return; }
    clearInterval(App._heroT);
    let f = 0;
    drawHero(c, f);
    App._heroT = setInterval(() => {
      if (App.view !== 'home' || !document.body.contains(cv)) { clearInterval(App._heroT); return; }
      f = (f + 1) % 44; drawHero(c, f);
    }, 95);
  }
  // 65차: 카드 배경색 — 모자(팀 색)와 겹치지 않게. 어두운 팀 색은 밝게, 밝은 팀 색은 어둡게
  function cardBg(hex) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) return hex;
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const f = lum < 0.3 ? (v => v + (255 - v) * 0.32) : (v => v * 0.58);
    return `rgb(${f(r) | 0},${f(g) | 0},${f(b) | 0})`;
  }
  function shade(hex) { const n = parseInt(hex.slice(1), 16); const r = (n >> 16) * 0.7, g = ((n >> 8) & 255) * 0.7, b = (n & 255) * 0.7; return `rgb(${r | 0},${g | 0},${b | 0})`; }

  // ---------- 공통 조각 ----------
  function barsHTML(r, keys, cls, chg) {
    return `<div class="bars ${cls || ''}">${keys.map(k => { const v = Sim.disp(r[k]); const d = Sim.dispD(chg && chg[k]); return `<div class="bar"><span class="lbl">${Sim.LABEL[k]}</span><span class="trk"><span class="fill ${v >= 80 ? 'hi' : ''}" style="width:${v}%"></span></span><span class="v">${v}</span>${chg ? `<span class="dvc">${d ? `<i class="dv ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</i>` : ''}</span>` : ''}</div>`; }).join('')}</div>`;
  }
  function lastChg(st) { const h = st.hist[st.hist.length - 1]; return h && h.chg ? h.chg : null; }
  function chgChips(chg, keys) {
    const list = Object.entries(chg || {}).filter(([k]) => !keys || keys.indexOf(k) >= 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    return list.length ? `<div class="changes">${list.map(([k, d]) => `<span class="chg ${d > 0 ? 'up' : 'down'}">${Sim.LABEL[k]} ${d > 0 ? '+' : ''}${Sim.dispD(d)}</span>`).join('')}</div>` : '<div class="muted small">능력치 변화 없음</div>';
  }
  function miniBars(r, keys) {
    return `<div class="mini-bars">${keys.map(k => { const v = Sim.disp(r[k]); return `<div class="bar"><span class="lbl">${Sim.LABEL[k]}</span><span class="trk"><span class="fill" style="width:${v}%"></span></span><span class="v">${v}</span></div>`; }).join('')}</div>`;
  }
  function devToggle() { if (!App.admin) return ''; return `<button class="dev-toggle ${App.dev ? 'on' : ''}" data-act="dev">${App.dev ? '관리자 ON' : '관리자'}</button>`; }
  // 관리자 모드: 숨은 잠재능력(PA)·등급·성장/노화 유형·전성기 창
  const GROWTH_T = { early: '조숙형 (어릴 때 빨리 큼)', late: '대기만성형 (늦게 꽃핌)', normal: '보통', std: '보통' };
  const AGING_T = { iron: '철인형 (늦게 늙음)', long: '장수형', std: '보통', early: '조기 하락형', meteor: '혜성형 (늦게 터지고 빨리 짐)', flash: '반짝 각성형 (급락)' };
  function adminPanel(st) {
    const me = st.me, d = Sim.debug(st);
    const keys = me.twoWay ? Sim.ALL : Sim.mainKeys(me);
    const rows = keys.map(k => { const cur = Sim.disp(me.r[k]), pa = Sim.disp(d.pa[k]); return `<div class="pa-row"><span>${Sim.LABEL[k]}</span><span class="pa-trk"><span class="pot" style="width:${pa}%"></span><span class="cur" style="width:${cur}%"></span></span><span class="v">${cur} / ${pa}</span></div>`; }).join('');
    const pk = d.peak ? `${d.peak.from}~${d.peak.from + d.peak.len - 1}세 (+${d.peak.boost})` : '없음';
    const tf = (me.trainFocus || []).map(k => Sim.LABEL[k]).join('·') || '없음';
    const kv = [['잠재 등급', d.tier], ['성장 유형', GROWTH_T[d.growth] || d.growth], ['노화 유형', AGING_T[d.aging] || d.aging], ['전성기', pk], ['훈련 부스트', `${tf}${me.age < Sim.BAL.trainFocus.untilAge ? ` (${Sim.BAL.trainFocus.untilAge - 1}세 시즌까지)` : ' (종료)'}`], ['관리', d.care], ['감독 신뢰', d.trust], ['인기', d.pop], ['기초체력', d.fit], ['큰 부상', d.bigInj], ['스카우트 점수', d.scout], ['1군 연차', `${d.svc} / FA ${d.faAt == null ? '-' : d.faAt}`]];
    return `<div class="panel admin-panel"><h3>관리자 · 숨은 값</h3><div class="tiny muted">막대: 진한 색 = 현재, 연한 금색 = 잠재 상한(PA)</div>${rows}
      <div class="admin-kv">${kv.map(([k, v]) => `<div><span class="muted">${k}</span> <b>${esc(v)}</b></div>`).join('')}</div>
      <div class="tiny muted" style="margin-top:8px">커리어 점수(현재) ${Sim.careerScore(st)} · 플래그 ${esc(JSON.stringify(d.flags))}</div></div>`;
  }

  // ================================================================
  // 홈
  // ================================================================
  // ---------- 31차: 홈 오른쪽 위 아이콘 · 공략집 · 공지사항 · 패치노트 ----------
  const CT = window.GAME_CONTENT || { notices: [], guide: [], patches: [] };
  const IG_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor"/></svg>';
  const X_SVG ='<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3zm-1.08 16.2h1.7L7.4 4.73H5.58L16.67 19.2z"/></svg>';
  // 34차: 새 공지·패치노트 빨간 점 — 내용 요약(서명)이 마지막으로 본 것과 다르면 점을 띄우고, 화면에 들어가면 본 것으로 기록
  const KEY_SEEN = 'dugout_seen';
  function contentSig(kind) {
    if (kind === 'notice') return CT.notices.map(n => `${n.date}|${n.title}|${n.body.join('').length}|${n.highlight || ''}`).join('#');
    if (kind === 'patch') return CT.patches.map(d => `${d.date}|${d.items.join('').length}|${d.items.length}`).join('#');
    return '';
  }
  function isNew(kind) { const sig = contentSig(kind); return !!sig && (store.get(KEY_SEEN, {}) || {})[kind] !== sig; }
  function markSeen(kind) { const s = store.get(KEY_SEEN, {}) || {}; s[kind] = contentSig(kind); store.set(KEY_SEEN, s); }
  function homeIcons() {
    const dot = k => isNew(k) ? '<span class="new-dot" aria-label="새 글"></span>' : '';
    return `<button class="icon-btn" data-act="page" data-v="notice" title="공지사항" aria-label="공지사항">📢${dot('notice')}</button>
      <button class="icon-btn" data-act="page" data-v="patch" title="패치노트" aria-label="패치노트">📝${dot('patch')}</button>
      <button class="icon-btn txt" data-act="page" data-v="guide" title="공략집" aria-label="공략집">공략</button>
      ${CT.instagram ? `<a class="icon-btn ig" href="${esc(CT.instagram)}" target="_blank" rel="noopener" title="인스타그램" aria-label="인스타그램">${IG_SVG}</a>` : ''}
      ${CT.x ? `<a class="icon-btn ig" href="${esc(CT.x)}" target="_blank" rel="noopener" title="X (트위터)" aria-label="X">${X_SVG}</a>` : ''}`;
  }
  function pageShell(title, body) {
    return `<div class="topbar page-top"><button class="btn small" data-act="home">← 뒤로</button><span class="title">${esc(title)}</span></div>${body}`;
  }
  function viewGuide() {
    return pageShell('공략집', `<div class="panel small muted">처음 하는 사람을 위한 간단한 안내. 정확한 수치보다 게임이 무엇을 보고 판단하는지 위주로 적었다.</div>`
      + CT.guide.map(s => `<div class="panel guide-sec"><h3>${esc(s.title)}</h3>${s.body.map(p => `<p>${esc(p)}</p>`).join('')}</div>`).join(''));
  }
  function viewNotice() {
    return pageShell('공지사항', CT.notices.length ? CT.notices.map(n => `<div class="panel guide-sec"><div class="tiny muted">${esc(n.date)}</div><h3>📢 ${esc(n.title)}</h3>${n.body.map(p => `<p>${esc(p)}</p>`).join('')}${n.highlight ? `<p class="notice-hl">${esc(n.highlight)}</p>` : ''}</div>`).join('')
      : '<div class="panel muted small">공지사항이 없다.</div>');
  }
  // 51차: 새 공지 팝업 — 가장 최신 공지 하나를 보여 주고, 닫거나 '공지사항 전체 보기'를 누르면 본 것으로 기록 (빨간 점도 사라짐)
  function noticeModal() {
    const n = CT.notices[0];
    if (!n) { App.noticePop = false; return; }
    const more = CT.notices.length > 1;
    $modal.innerHTML = `<div class="notice-overlay" data-act="notice-close" role="dialog" aria-modal="true" aria-labelledby="notice-pop-title"><div class="notice-pop">
      <div class="notice-pop-kicker">📢 공지사항</div>
      <div class="tiny muted">${esc(n.date)}</div>
      <h3 id="notice-pop-title">${esc(n.title)}</h3>
      <div class="notice-pop-body">${n.body.map(p => `<p>${esc(p)}</p>`).join('')}${n.highlight ? `<p class="notice-hl">${esc(n.highlight)}</p>` : ''}</div>
      <div class="row" style="gap:8px;margin-top:12px">${more ? '<button class="btn" data-act="notice-all" style="flex:1">공지사항 전체 보기</button>' : ''}<button class="btn go" data-act="notice-close" style="flex:1">확인</button></div>
    </div></div>`;
  }
  function viewPatch() {
    if (!CT.patches.length) return pageShell('패치노트', '<div class="panel muted small">아직 패치노트가 없다.</div>');
    return pageShell('패치노트', CT.patches.map(d => `<div class="panel guide-sec"><h3>${esc(d.date)}</h3><ul class="patch-list">${d.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join(''));
  }

  // 39차: 역대 최고점수 TOP 50 — 1~3위는 시상대 위에서 금·은·동 메달을 건다.
  // 47차: content.js 의 leaderboard(url·key)가 채워져 있으면 온라인(Supabase) 전체 순위, 비어 있거나 연결이 안 되면 이 기기 기록
  const LB = (CT && CT.leaderboard) || {};
  const LB_ON = !!(LB.url && LB.key);
  App.lb = { list: null, at: 0, err: false, loading: false };
  function lbFetch(path, opt) {
    opt = opt || {};
    // 예전 anon 키(eyJ…)는 Authorization 에도 넣고, 새 publishable 키(sb_publishable_…)는 apikey 헤더만 쓴다
    const headers = Object.assign({ apikey: LB.key, 'Content-Type': 'application/json' }, /^eyJ/.test(LB.key) ? { Authorization: 'Bearer ' + LB.key } : {}, opt.headers || {});
    return fetch(LB.url.replace(/\/+$/, '') + '/rest/v1/' + path, Object.assign({}, opt, { headers }))
      .then(r => { if (!r.ok) throw new Error('leaderboard ' + r.status); return r.text(); })
      .then(t => t ? JSON.parse(t) : null);   // 저장(201)은 빈 응답으로 온다
  }
  const LOCALHOST = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !window.__countLocal;   // __countLocal: 테스트 페이지용
  const STAT_POS = ['C', '1B', '2B', '3B', 'SS', 'OF', 'SP', 'RP', 'CL'];
  const statOK = () => LB_ON && !LOCALHOST;
  function bump(k) {
    if (!statOK()) return;
    lbFetch('rpc/bump', { method: 'POST', body: JSON.stringify({ k }) }).catch(() => { });
  }
  App.stats = { data: null, at: 0, err: false, loading: false };
  function statsLoad() {
    if (!LB_ON || App.stats.loading || (App.stats.at && Date.now() - App.stats.at < 60000)) return;
    App.stats.loading = true;
    Promise.all([lbFetch('stats_daily?select=day,kind,n&order=day.desc&limit=3000'), lbFetch('stats_total?select=kind,n').catch(() => null),
      lbFetch('score_total?select=pos,n,sum').catch(() => null), lbFetch('score_daily?select=day,pos,n,sum').catch(() => null)])
      .then(([rows, tot, sT, sD]) => { App.stats.data = rows || []; App.stats.total = tot && tot.length ? tot : null; App.stats.scT = sT || []; App.stats.scD = sD || []; App.stats.err = false; })
      .catch(() => { App.stats.err = true; })
      .then(() => { App.stats.loading = false; App.stats.at = Date.now(); if (App.view === 'home') render(); });
  }
  function statsPanel() {
    if (!App.admin) return '';
    const box = inner => `<div class="panel admin-panel"><h3>관리자 · 이용 통계 <span class="tiny muted">전체 온라인</span></h3>${inner}</div>`;
    if (!LB_ON) return box('<div class="small muted">온라인 서버가 설정되지 않았다.</div>');
    statsLoad();
    const S = App.stats;
    if (!S.data) return box(`<div class="small muted">${S.err ? '통계를 불러오지 못했다. Supabase에서 supabase-stats.sql을 실행했는지 확인.' : '불러오는 중…'}</div>`);
    const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);   // 한국 날짜
    const tot = k => S.total ? S.total.filter(r => r.kind === k).reduce((a, r) => a + (+r.n || 0), 0) : S.data.filter(r => r.kind === k).reduce((a, r) => a + (+r.n || 0), 0);
    const day = k => S.data.filter(r => r.kind === k && r.day === today).reduce((a, r) => a + (+r.n || 0), 0);
    const K = [['uv', '접속'], ['create', '생성'], ['retire', '은퇴'], ['hof', '명예의 전당']];
    const P = STAT_POS;
    const M = [['pro', '프로 입단'], ['debut', '1군 데뷔'], ['starter', '주전'], ['s3', '3시즌'], ['s6', '6시즌'], ['s10', '10시즌'], ['s15', '15시즌']];
    const pname = p => ({ C: '포수', '1B': '1루', '2B': '2루', '3B': '3루', SS: '유격', OF: '외야', SP: '선발', RP: '불펜', CL: '마무리' })[p];
    // 포지션별 평균 점수 — 처음 고른 포지션 기준, 은퇴한 선수만
    const avgOf = (rows, p) => { const r = (rows || []).filter(x => x.pos === p), n = r.reduce((a, x) => a + (+x.n || 0), 0), s = r.reduce((a, x) => a + (+x.sum || 0), 0); return n ? { avg: Math.round(s / n), n } : null; };
    const block = (title, f, scRows) => {
      const made = P.reduce((a, p) => a + f('pos_' + p), 0);
      return `<div class="stat-blk"><div class="stat-ttl">${title}</div>
        <div class="season-sum">${K.map(([k, t]) => `<div><b>${(k === 'uv' ? f('uv') + f('visit') : f(k)).toLocaleString()}</b><span>${t}</span></div>`).join('')}</div>
        <div class="pos-grid">${P.map(p => { const n = f('pos_' + p), a = avgOf(scRows, p); return `<div><span>${pname(p)}</span><b class="num">${n.toLocaleString()}</b><i class="tiny muted">${made ? Math.round(n * 100 / made) + '%' : '-'}</i><em class="tiny" title="${a ? `은퇴 ${a.n}명 평균` : '아직 은퇴 기록 없음'}">평균 ${a ? a.avg.toLocaleString() + '점' : '-'}</em></div>`; }).join('')}</div>
        <div class="funnel tiny"><span class="muted">도달</span>${M.map(([k, t]) => { const n = f('m_' + k); return `<span>${t} <b class="num">${n.toLocaleString()}</b>${made ? `<i class="muted">${Math.round(n * 100 / made)}%</i>` : ''}</span>`; }).join('')}</div></div>`;
    };
    return box(`${block('누적', tot, S.scT)}${block(`오늘 <span class="tiny muted">${today.slice(5).replace('-', '/')} · 한국 시간 0시에 초기화</span>`, day, (S.scD || []).filter(r => r.day === today))}
      <div class="tiny muted" style="margin-top:6px">접속 = 기기마다 하루 1회(누적은 날마다 더한 값, 예전 방식으로 센 접속도 포함) ·칸마다 생성 수 · 비율 · 은퇴한 선수의 평균 점수(처음 고른 포지션 기준) · 도달 % = 포지션별 생성 합계 대비 그 단계까지 간 선수 · 포지션·평균·도달은 업데이트 이후 만든 선수만 센다 · 관리자 플레이도 센다 · 1분마다 새로 받음</div>`);
  }
  const lbRow = r => ({ id: r.id, name: String(r.name || ''), pos: String(r.pos || ''), twoWay: !!r.two_way, score: +r.score || 0, war: +r.war || 0, hof: !!r.hof, avatar: +r.avatar || 1, color: /^#[0-9a-fA-F]{3,8}$/.test(r.color || '') ? r.color : '#3d4a5c', online: true });
  // 52차: 역대 최고점수 TOP 20 + 시즌 최고점수 TOP 50 (61차: 시즌 = 한국 시간 하루, 매일 밤 12시에 새 시즌)
  const ALL_MAX = 50, SEASON_MAX = 50,   // 64차: 역대 TOP 20 → TOP 50 (서버 supabase-alltop50.sql 도 실행해야 50위까지 남는다)
 SEASON_MS = 86400000, KST = 9 * 3600000;
  function seasonInfo(now) {
    now = now || Date.now();
    const idx = Math.floor((now + KST) / SEASON_MS), start = idx * SEASON_MS - KST;
    return { idx, start, end: start + SEASON_MS };
  }
  function leftText(ms) { const h = Math.max(0, Math.ceil(ms / 3600000)); return h >= 24 ? `${Math.floor(h / 24)}일 ${h % 24}시간` : `${h}시간`; }
  function lbLoad(force) {
    if (!LB_ON || App.lb.loading) return;
    if (!force && App.lb.at && Date.now() - App.lb.at < 60000) return;
    App.lb.loading = true;
    const sel = 'select=id,name,pos,two_way,score,war,hof,avatar,color,created_at&order=score.desc,id.asc';
    const S = seasonInfo();
    Promise.all([
      lbFetch(`top50?${sel}&limit=${ALL_MAX}`),
      lbFetch(`top50?${sel}&created_at=gte.${new Date(S.start).toISOString()}&limit=${SEASON_MAX}`),
    ])
      .then(([all, season]) => { App.lb.list = (all || []).map(lbRow); App.lb.season = (season || []).map(lbRow); App.lb.err = false; })
      .catch(() => { App.lb.err = true; })
      .then(() => { App.lb.loading = false; App.lb.at = Date.now(); if (App.view === 'home') render(); });
  }
  // 61차: 골든글러브 라인업 포지션 — 이도류(중간에 그만둔 경우 포함)는 처음 고른 포지션, 아니면 가장 오래 뛴 포지션. 마무리는 불펜(RP)
  // 62차: 외야를 좌익수·중견수·우익수로 나눴다 (예전 기록의 OF는 세 자리에 점수 순으로 채운다)
  const LINEUP_POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH', 'SP', 'RP'];
  function lineupPos(st) {
    const me = st.me, f = st.final, tw = !!(me.twoWay || me.twoWayChosen);
    let p = tw ? (me.flags && me.flags.pos0) || me.pos : (f.mainPos && f.mainPos !== 'TW' ? f.mainPos : me.pos);
    if (p === 'CL') p = 'RP';
    if (p === 'OF') p = me.ofPos || 'OF';
    return LINEUP_POS.indexOf(p) >= 0 ? p : null;
  }
  // 은퇴 때: 역대 20위 · 이번 시즌 50위 · 내 포지션 1위(역대·이번 시즌)보다 높을 때만 보낸다 (대부분의 판은 서버에 아무것도 보내지 않는다)
  function lbSubmit(st) {
    const f = st.final, S = seasonInfo(), since = new Date(S.start).toISOString(), lp = lineupPos(st);
    st._lb = 'checking';
    const posQ = lp ? `select=score&or=(lpos.eq.${lp},and(lpos.is.null,pos.eq.${lp}))&order=score.desc,id.asc&offset=${lp === 'OF' ? 2 : 0}&limit=1` : '';
    Promise.all([
      lbFetch(`top50?select=score&order=score.desc,id.asc&offset=${ALL_MAX - 1}&limit=1`),
      lbFetch(`top50?select=score&created_at=gte.${since}&order=score.desc,id.asc&offset=${SEASON_MAX - 1}&limit=1`),
      // 포지션 기준 (서버에 lpos 칸이 아직 없으면 실패 → 이 기준은 쓰지 않는다)
      lp ? lbFetch(`top50?${posQ}`).then(r => ({ r }), () => null) : null,
      lp ? lbFetch(`top50?${posQ}&created_at=gte.${since}`).then(r => ({ r }), () => null) : null,
    ])
      .then(([a, s, p, ps]) => {
        const cutA = a && a.length ? +a[0].score : -1, cutS = s && s.length ? +s[0].score : -1;
        const cutP = p ? (p.r && p.r.length ? +p.r[0].score : -1) : Infinity;
        const cutPS = ps ? (ps.r && ps.r.length ? +ps.r[0].score : -1) : Infinity;
        if (f.score <= cutA && f.score <= cutS && f.score <= cutP && f.score <= cutPS) { st._lb = 'out'; return; }
        const c = cardData(st);
        const body = { name: f.name, pos: f.mainPos && f.mainPos !== 'TW' ? f.mainPos : f.pos, two_way: !!(st.me.twoWay || st.me.twoWayChosen), score: f.score, war: Math.round(f.war * 10) / 10, hof: !!(f.hof && f.hof.in), avatar: c.avatar, color: c.color, card: c };
        if (p && lp) body.lpos = lp;
        const post = b => lbFetch('top50', { method: 'POST', body: JSON.stringify(b), headers: { Prefer: 'return=minimal' } });
        // 서버가 아직 좌익·중견·우익(LF·CF·RF)을 모르면 예전처럼 외야(OF)로 한 번 더 보낸다
        return post(body).catch(e => { if (!/^(LF|CF|RF)$/.test(body.lpos || '')) throw e; return post(Object.assign({}, body, { lpos: 'OF', pos: 'OF' })); })
          .then(() => Promise.all([
            f.score > cutA ? lbFetch(`top50?select=id&score=gt.${f.score}&limit=${ALL_MAX}`) : null,
            lbFetch(`top50?select=id&created_at=gte.${since}&score=gt.${f.score}&limit=${SEASON_MAX}`),
          ]))
          .then(([ra, rs]) => {
            st._lb = 'in'; st._lbRank = ra ? ra.length + 1 : 0; st._lbSRank = rs ? rs.length + 1 : 0;
            // 65차: 뱃지 — 역대는 바로, 시즌은 마감(한국 시간 밤 12시) 뒤 판정
            if (st._lbRank && st._lbRank <= ALL_MAX) giveBadge(st, 'top50', { rank: st._lbRank });
            if (p && lp && f.score > cutP) giveBadge(st, 'ggAll', { pos: lp });
            const wi = { score: f.score, start: S.start, end: S.end, who: f.name };
            if (st._lbSRank && st._lbSRank <= SEASON_MAX) waitBadge('season50', wi);
            if (ps && lp && f.score > cutPS) waitBadge('ggSeason', Object.assign({ lp }, wi));
          });
      })
      .catch(() => { st._lb = 'error'; })
      .then(() => { App.lb.at = 0; if (App.view === 'retire' && App.st === st) render(); });   // 홈으로 가면 순위표를 새로 받는다
  }
  // ---------- 65차: 뱃지 — 이 기기(브라우저)에만 저장, 서버에는 안 올린다 ----------
  //   새 뱃지는 BADGES에 한 줄 추가 + 조건이 되는 곳에서 giveBadge(st, id) 한 번
  const KEY_BADGE = 'dugout_badges';
  //   ico: 10×10 도트 그림 (W 흰색 · K 진한색 · Y 금색 · R 빨강 · B 파랑 · G 초록 · N 갈색 · O 주황 · . 빈칸)
  //   tone: 메달 색 · chk(st): 은퇴할 때 검사 (top50은 온라인 순위 확인 뒤 따로 준다)
  const AWL = st => (st.final && st.final.awList) || (st.car && st.car.awList) || [];
  const BADGES = [
    { id: 'top50', name: '명예의 전당 TOP50', desc: '역대 최고점수 TOP50 순위표에 이름을 올린다', tone: 'gold',
      ico: ['..........', '.WWW.WWW..', '.W...W.W..', '.WWW.W.W..', '...W.W.W..', '.WWW.WWW..', '..........', 'Y.Y.Y.Y.Y.', '.Y.Y.Y.Y..', '..........'] },
    { id: 'hof', name: '명예의 전당 헌액', desc: '명예의 전당에 헌액된다', tone: 'gold', chk: st => !!(st.final.hof && st.final.hof.in),
      ico: ['..........', 'W...WW...W', 'WW..WW..WW', 'WWW.WW.WWW', 'WWWWWWWWWW', 'WRWWBBWWRW', 'WWWWWWWWWW', 'KKKKKKKKKK', '..........', '..........'] },
    { id: 'mvp', name: '첫 MVP', desc: '정규시즌 MVP를 처음 받는다', tone: 'blue', chk: st => (st.car.aw.MVP || 0) >= 1,
      ico: ['....WW....', '....WW....', '...WWWW...', 'WWWWWWWWWW', '.WWWWWWWW.', '..WWWWWW..', '..WWWWWW..', '.WWW..WWW.', '.WW....WW.', '..........'] },
    { id: 'mvp4', name: 'MVP 4회', desc: '한 커리어에서 정규시즌 MVP를 4번 받는다', tone: 'purple', chk: st => (st.car.aw.MVP || 0) >= 4,
      ico: ['.W....W...', 'WWW..WWW..', '.W....W...', '..........', '.W....W...', 'WWW..WWW..', '.W....W...', '..........', '..........', '..........'] },
    { id: 'gg5', name: '황금 장갑', desc: '골든글러브를 5번 받는다', tone: 'gold', chk: st => (st.car.aw.GG || 0) >= 5,
      ico: ['.N.N.N....', '.N.N.N.N..', '.NNNNNNN..', '.NNNNNNN..', 'NNNNNNNN..', 'NNYNNNNN..', '.NNNNNNN..', '..NNNNN...', '...NNN....', '..........'] },
    { id: 'ring', name: '첫 우승 반지', desc: '소속팀이 리그 우승(한국·재팬·월드시리즈)을 차지한다', tone: 'red', chk: st => (st.car.aw.KS || 0) >= 1,
      ico: ['...YYYY...', '..Y....Y..', '.Y......Y.', '.Y......Y.', '.Y......Y.', '..Y....Y..', '...YYYY...', '...WWWW...', '....WW....', '..........'] },
    { id: 'ws', name: '월드시리즈 챔피언', desc: '월드시리즈에서 우승한다', tone: 'navy', chk: st => AWL(st).some(a => /월드시리즈 우승/.test(a)),
      ico: ['..........', '.WWWWWWWW.', 'WW.WWWW.WW', 'WW.WWWW.WW', '.WWWWWWWW.', '..WWWWWW..', '....WW....', '....WW....', '..YYYYYY..', '..........'] },
    { id: 'wbc', name: '세계 정상', desc: 'WBC에서 우승한다', tone: 'blue', chk: st => AWL(st).some(a => /WBC.*우승/.test(a)),
      ico: ['...WWWW...', '..WGGWWW..', '.WGGGWWGW.', '.WGGWWGGW.', '.WWWWGGGW.', '.WGWWWGGW.', '.WGGWWWWW.', '..WGGWWW..', '...WWWW...', '..........'] },
    { id: 'og', name: '올림픽 금메달', desc: '올림픽에서 금메달을 딴다', tone: 'red', chk: st => AWL(st).some(a => /올림픽.*금메달/.test(a)),
      ico: ['.BB....RR.', '..BB..RR..', '...BBRR...', '....YY....', '...YYYY...', '..YYWYYY..', '..YYYYYY..', '...YYYY...', '....YY....', '..........'] },
    { id: 'tw', name: '이도류', desc: '한 시즌에 타자·투수 WAR를 모두 기준 이상 기록한다', tone: 'purple', chk: st => (st.car.twoWaySeasons || 0) >= 1,
      ico: ['N.......WW', '.N.....WRW', '..N....WWW', '...N......', '....N.....', '.....N....', '......N...', '.......N..', '........NN', '.........N'] },
    { id: 'war100', name: '통산 WAR 100', desc: '통산 WAR 100을 넘긴다', tone: 'green', chk: st => (st.car.war || 0) >= 100,
      ico: ['..........', '..........', '.W.WWW.WWW', 'WW.W.W.W.W', '.W.W.W.W.W', '.W.W.W.W.W', '.W.WWW.WWW', '..........', '..........', '..........'] },
    { id: 'hr500', name: '500홈런', desc: '통산 홈런 500개를 친다', tone: 'red', chk: st => (st.car.bat.HR || 0) >= 500,
      ico: ['........WW', '.......W.W', '......W..W', '.........W', '.....N....', '....N.....', '...N......', '..N.......', '.NN.......', 'NN........'] },
    { id: 'hit3000', name: '3000안타', desc: '통산 안타 3,000개를 친다', tone: 'blue', chk: st => (st.car.bat.H || 0) >= 3000,
      ico: ['...WWWW...', '..WWWWWW..', '.WRWWWWRW.', '.RWWWWWWR.', '.RWWWWWWR.', '.RWWWWWWR.', '.WRWWWWRW.', '..WWWWWW..', '...WWWW...', '..........'] },
    { id: 'w200', name: '200승', desc: '통산 200승을 거둔다', tone: 'navy', chk: st => (st.car.pit.W || 0) >= 200,
      ico: ['..........', 'W...W...W.', 'W...W...W.', 'W..WWW..W.', 'W.W...W.W.', 'WW.....WW.', 'W.......W.', '..........', 'YYYYYYYYY.', '..........'] },
    { id: 'sv400', name: '수호신', desc: '통산 400세이브를 올린다', tone: 'green', chk: st => (st.car.pit.SV || 0) >= 400,
      ico: ['.WWWWWWWW.', '.WWWWWWWW.', '.WWWYYWWW.', '.WWYYYYWW.', '.WWWYYWWW.', '..WWWWWW..', '..WWWWWW..', '...WWWW...', '....WW....', '..........'] },
    { id: 'k3000', name: '닥터 K', desc: '통산 탈삼진 3,000개를 잡는다', tone: 'red', chk: st => (st.car.pit.K || 0) >= 3000,
      ico: ['.WW...WW..', '.WW..WW...', '.WW.WW....', '.WWWW.....', '.WWWW.....', '.WW.WW....', '.WW..WW...', '.WW...WW..', '..........', '..........'] },
    { id: 'oneclub', name: '원클럽맨', desc: '한 팀에서만 15시즌 이상 뛰고 은퇴한다', tone: 'red', chk: st => (st.final.teams || []).length === 1 && (st.final.seasons || 0) >= 15,
      ico: ['..........', '.WW....WW.', 'WWWW..WWWW', 'WWWWWWWWWW', 'WWWWWWWWWW', '.WWWWWWWW.', '..WWWWWW..', '...WWWW...', '....WW....', '..........'] },
    { id: 'mlb', name: '빅리거', desc: '메이저리그 1군 무대를 밟는다', tone: 'navy', chk: st => (st.hist || []).some(h => h.lg === 'MLB' && h.lvl === '1군'),
      ico: ['....W.....', '....WW....', 'W...WW....', 'WWWWWWWWW.', 'WWWWWWWWWW', 'W...WW....', '....WW....', '....W.....', '..........', '..........'] },
    { id: 'roy', name: '신인왕', desc: '신인왕을 받는다', tone: 'gold', chk: st => (st.car.aw.ROY || 0) >= 1,
      ico: ['...GG.GG..', '..GGG.GGG.', '..GGGNGGG.', '....N.....', '....N.....', '....N.....', '..NNNNNN..', '..NNNNNN..', '...NNNN...', '..........'] },
    { id: 'underdog', name: '흙수저 신화', desc: '평범 등급으로 시작해 명예의 전당에 오른다', tone: 'orange', chk: st => st.me.tier === '평범' && !!(st.final.hof && st.final.hof.in),
      ico: ['....Y.....', '...YY.....', '...YYY....', '..YYOY.Y..', '..YOOYYY..', '.YOOOOYY..', '.YOORROY..', '.YOORROY..', '..YOOOY...', '...YYY....'] },
    // ---- 2차 추가분 ----
    { id: 'unanimous', name: '만장일치', desc: '명예의 전당 헌액 기준을 7개 이상 채우고 헌액된다', tone: 'gold', chk: st => !!(st.final.hof && st.final.hof.in && (st.final.hof.why || []).length >= 7),
      ico: ['..........', '.........W', '........WW', '.......WW.', 'W.....WW..', 'WW...WW...', '.WW.WW....', '..WWW.....', '...W......', '..........'] },
    { id: 'season50', name: '시즌 TOP50', desc: '오늘 시즌 순위(TOP50)에 밤 11시 59분 마감까지 남는다', tone: 'blue', season: true,
      ico: ['...WWWW...', '..W.WW.W..', '.W..WW..W.', '.W..WWW.W.', '.W......W.', '..W....W..', '...WWWW...', '..........', 'Y.Y.Y.Y.Y.', '..........'] },
    { id: 'ggAll', name: '역대 골든글러브', desc: '은퇴할 때 역대 골든글러브 라인업(포지션별 1위)에 든다', tone: 'red',
      ico: ['.Y.Y.Y....', '.Y.Y.Y.Y..', '.YYYYYYY..', '.YYYYYYY..', 'YYYYYYYY..', 'YYWYYYYY..', '.YYYYYYY..', '..YYYYY...', '...YYY....', '..........'] },
    { id: 'ggSeason', name: '시즌 골든글러브', desc: '오늘 시즌 골든글러브 라인업에 밤 11시 59분 마감까지 남는다', tone: 'navy', season: true,
      ico: ['.Y.Y.Y....', '.Y.Y.Y.Y..', '.YYYYYYY..', '.YYYYYYY..', 'YYYYYYYY..', 'YYWYYYYY..', '.YYYYYYY..', '..YYYYY...', '...YYY....', '..........'] },
    { id: 'roymvp', name: '신인 MVP', desc: '신인왕을 받은 그해 MVP까지 받는다', tone: 'purple', chk: st => { const a = AWL(st); return a.some(x => { const m = /^(\d{4}) 신인왕$/.exec(x); return m && a.indexOf(`${m[1]} MVP`) >= 0; }); },
      ico: ['....WW....', '...WWWW...', 'WWWWWWWWWW', '.WWWWWWWW.', '..WWGGWW..', '..WGGGGW..', '.WWWNNWWW.', '.WW.NN.WW.', '....NN....', '..........'] },
    { id: 'titles10', name: '타이틀 수집가', desc: '개인 타이틀을 10개 이상 차지한다', tone: 'orange', chk: st => (st.car.aw.TITLE || 0) >= 10,
      ico: ['..........', '.WWWWWWWW.', '.WYYWWYYW.', '.WWWWWWWW.', '.WYYWWYYW.', '.WWWWWWWW.', '.WYYWWYYW.', '.WWWWWWWW.', '..........', '..........'] },
    { id: 'dynasty', name: '왕조 달성', desc: '소속팀이 리그 우승을 5번 차지한다', tone: 'purple', chk: st => (st.car.aw.KS || 0) >= 5,
      ico: ['..........', 'Y...YY...Y', 'YY..YY..YY', 'YYY.YY.YYY', 'YYYYYYYYYY', 'YRYYWWYYRY', 'YYYYYYYYYY', '..........', 'W.W.W.W.W.', '..........'] },
    { id: 'smvp', name: '시리즈의 사나이', desc: '우승 시리즈 MVP를 받는다', tone: 'red', chk: st => (st.car.aw.KSMVP || 0) >= 1,
      ico: ['....YY....', '...YYYY...', 'YYYYYYYYYY', '.YYYYYYYY.', '..YYYYYY..', '..YYYYYY..', '.YYY..YYY.', '.YY....YY.', '..........', '..........'] },
    { id: 'avg400', name: '4할 타자', desc: '1군 한 시즌 타율 4할 이상 (규정 타석)', tone: 'blue', chk: st => (st.hist || []).some(h => h.lvl === '1군' && h.bat && !h.bat.fut && (h.bat.PA || 0) >= 440 && h.bat.AB && h.bat.H / h.bat.AB >= 0.4),
      ico: ['..........', 'W..W..WWW.', 'W..W..W.W.', 'WWWW..W.W.', '...W..W.W.', '...W..WWW.', '..........', '...WWWW...', '..W.RR.W..', '...WWWW...'] },
    { id: 'hr50', name: '50홈런', desc: '1군 한 시즌 홈런 50개 이상', tone: 'red', chk: st => (st.hist || []).some(h => h.lvl === '1군' && h.bat && !h.bat.fut && (h.bat.HR || 0) >= 50),
      ico: ['..........', 'WWW.WWW...', 'W...W.W...', 'WWW.W.W...', '..W.W.W...', 'WWW.WWW...', '.......WW.', '......WWWW', '......WWWW', '.......WW.'] },
    { id: 'era1', name: '1점대 에이스', desc: '1군 한 시즌 평균자책점 1점대 (규정 이닝)', tone: 'navy', chk: st => (st.hist || []).some(h => h.lvl === '1군' && h.pit && !h.pit.fut && (h.pit.outs || 0) >= 432 && h.pit.ER * 27 / h.pit.outs < 2),
      ico: ['..........', '...WW.....', '..WWW.....', '...WW.....', '...WW.....', '...WW.....', '..WWWW....', '......WWW.', '.....WRWRW', '......WWW.'] },
    { id: 'three', name: '3개 리그 정복', desc: 'KBO·NPB·MLB 1군을 모두 뛴다', tone: 'green', chk: st => ['KBO', 'NPB', 'MLB'].every(l => (st.hist || []).some(h => h.lg === l && h.lvl === '1군')),
      ico: ['..........', '...RRRR...', '..RRRRRR..', '..RRRRRR..', '...RRRR...', 'BBBB..WWWW', 'BBBBBWWWWW', 'BBBBBWWWWW', '.BBB..WWW.', '..........'] },
    { id: 'age43', name: '불혹의 현역', desc: '43세 이상까지 현역으로 뛴다', tone: 'orange', chk: st => (st.final.retireAge || 0) >= 43,
      ico: ['...WWWW...', '..W....W..', '.W..W...W.', '.W..W...W.', '.W..WWW.W.', '.W......W.', '..W....W..', '...WWWW...', '..........', '..........'] },
    { id: 'late', name: '늦게 핀 꽃', desc: '드래프트 미지명이나 육성선수로 시작해 MVP를 받는다', tone: 'green', chk: st => (!st.me.draft || /육성/.test(String(st.me.draft.round))) && (st.car.aw.MVP || 0) >= 1,
      ico: ['...R.R....', '..RRYRR...', '...RRR....', '....G.....', '....G.GG..', '..GGG.G...', '....G.....', '..NNNNNN..', '...NNNN...', '..........'] },
    { id: 'retnum', name: '영구결번', desc: '명예의 전당 헌액 + 한 팀의 영구결번이 된다', tone: 'navy', chk: st => !!retiredNumber(st),
      ico: ['.WWWWWWWW.', '.W......W.', '.W.WWWW.W.', '.W.W..W.W.', '.W.WWWW.W.', '.W....W.W.', '.W.WWWW.W.', '.W......W.', '.WWWWWWWW.', '..........'] },
    // ---- 3차 추가분: 국가대표 · 누적 연봉 (earnings = 수수료 뗀 통산 수령액, 단위 만원) ----
    { id: 'intl8', name: '국가대표 단골', desc: '국제대회에 8번 이상 출전한다', tone: 'blue', chk: st => (st.car.intlRec || st.car.intl || []).length >= 8,
      ico: ['WWWWWWWWWW', 'WWWWWWWWWW', 'WWWRRWWWWW', 'WWRRBBWWWW', 'WWWBBWWWWW', 'WWWWWWWWWW', 'WWWWWWWWWW', 'N.........', 'N.........', 'N.........'] },
    ...[[100, 'green'], [300, 'blue'], [500, 'navy'], [1000, 'purple']].map(([e, tone]) => ({
      id: 'earn' + e, name: `누적 연봉 ${e.toLocaleString()}억`, desc: `통산 연봉+계약금 ${e.toLocaleString()}억 원 돌파`, tone,
      chk: st => ((st.final && st.final.earnings) || st.me.earnings || 0) >= e * 10000,
      ico: e >= 1000 ? ['..YYYYYY..', '.YYYYYYYY.', 'YYYWWWWYYY', 'YYWYYYYYYY', 'YYYWWWYYYY', 'YYYYYYWYYY', 'YYWWWWYYYY', '.YYYWYYYY.', '..YYYYYY..', '..........']
        : e >= 500 ? ['..........', '..YYYYYY..', '.YYYYYYYY.', '..YYYYYY..', '.YYYYYYYY.', '..YYYYYY..', '.YYYYYYYY.', '..YYYYYY..', '..........', '..........']
        : e >= 300 ? ['..........', '..........', '..YYYYYY..', '.YYYYYYYY.', '..YYYYYY..', '.YYYYYYYY.', '..YYYYYY..', '..........', '..........', '..........']
        : ['..........', '..........', '..........', '..YYYYYY..', '.YYYYYYYY.', '..YYYYYY..', '..........', '..........', '..........', '..........'],
    })),
  ];
  // 홈에서 보여 주는 순서 (커리어 정점 → 개인 수상 → 우승·국제대회 → 타자 → 투수 → 여정)
  const BADGE_ORDER = ['top50', 'hof', 'retnum', 'unanimous', 'season50', 'war100', 'ggAll', 'ggSeason', 'mvp', 'mvp4', 'gg5', 'roy', 'roymvp', 'titles10',
    'ring', 'dynasty', 'ws', 'smvp', 'wbc', 'og', 'hr500', 'hit3000', 'avg400', 'hr50', 'w200', 'k3000', 'sv400', 'era1',
    'intl8', 'tw', 'mlb', 'three', 'oneclub', 'age43', 'underdog', 'late', 'earn100', 'earn300', 'earn500', 'earn1000'];
  BADGES.sort((a, b) => BADGE_ORDER.indexOf(a.id) - BADGE_ORDER.indexOf(b.id));
  // ---------- 65차: 영구결번 ----------
  //   명예의 전당 헌액 + 한 팀(T)에서: 1군 8시즌 이상 · WAR 40 이상 · T 소속으로 골든글러브 2회 이상
  //   + T와 같은 리그 안에서는 '22세가 되고 주전을 잡은 뒤'부터 T에서만 뛰어야 한다 (해외 리그로 나갔다 오는 건 괜찮지만 돌아올 때도 T)
  //   주전 기록(h.starter)이 없는 예전 저장은 22세 기준만 본다
  function retiredNumber(st) {
    const f = st.final; if (!f || !f.hof || !f.hof.in) return null;
    const PRO = ['KBO', 'NPB', 'MLB'];
    const H = (st.hist || []).filter(h => h.teamId && PRO.indexOf(h.lg) >= 0);
    const ones = H.filter(h => h.lvl === '1군');
    const teamOf = {}; H.forEach(h => { teamOf[h.year] = h.teamId; });
    const hasStarter = H.some(h => h.starter != null);
    const y22 = (H.find(h => h.age >= 22) || {}).year, yS = hasStarter ? (H.find(h => h.starter) || {}).year : null;
    const cut = Math.max(y22 || 9999, yS == null ? -1 : yS);   // 둘 다 지난 해부터 제한
    const by = {}; ones.forEach(h => { const b = by[h.teamId] = by[h.teamId] || { n: 0, war: 0, name: h.team, lg: h.lg }; b.n++; b.war += +h.war || 0; b.name = h.team; });
    const ggYears = AWL(st).map(a => /^(\d{4}) (투수 )?골든글러브$/.exec(a)).filter(Boolean).map(m => +m[1]);
    const cand = Object.keys(by).sort((a, b) => by[b].n - by[a].n || by[b].war - by[a].war);
    for (const T of cand) {
      const b = by[T];
      if (b.n < 8 || b.war < 40) continue;
      if (ggYears.filter(y => teamOf[y] === T).length < 2) continue;
      if (H.some(h => h.lg === b.lg && h.year >= cut && h.teamId !== T)) continue;   // 같은 리그 이적 불가
      return { teamId: T, team: b.name, num: st.me.num, lg: b.lg };
    }
    return null;
  }
  // 65차: 뱃지 도입 전에 역대 TOP50에 든 선수 — 이 기기 기록실(은퇴 기록)과 서버 역대 TOP50을 이름·점수로 맞춰 보고 한 번만 소급
  const KEY_BACKFILL = 'dugout_badge_backfill1';
  function backfillTop50() {
    if (!LB_ON || store.get(KEY_BACKFILL, false)) return;
    if (myBadges().top50) { store.set(KEY_BACKFILL, true); return; }
    const recs = (store.get(KEY_REC, []) || []).filter(r => r && r.name && r.score != null && !r.online);
    if (!recs.length) { store.set(KEY_BACKFILL, true); return; }
    lbFetch(`top50?select=id,name,score&order=score.desc,id.asc&limit=${ALL_MAX}`).then(rows => {
      if (!Array.isArray(rows)) return;
      let hit = null;
      rows.forEach((x, i) => { if (!hit) { const r = recs.find(r => r.name === x.name && Math.round(r.score) === Math.round(+x.score)); if (r) hit = { r, rank: i + 1 }; } });
      if (hit && giveBadge(null, 'top50', { at: hit.r.date || Date.now(), who: hit.r.name, rank: hit.rank }) && App.view === 'home') render();
      store.set(KEY_BACKFILL, true);
    }).catch(() => { });   // 실패하면 다음 접속 때 다시
  }
  function ensureRetNum(st) { const f = st && st.final; if (!f) return null; if (f.retNum === undefined) { try { f.retNum = retiredNumber(st); } catch (e) { f.retNum = null; } } return f.retNum; }
  // 시즌 뱃지 판정 대기 —은퇴 때 들면 적어 두고, 시즌(한국 시간 하루)이 끝난 뒤 접속하면 서버에서 최종 순위를 읽어 판정
  const KEY_BADGE_WAIT = 'dugout_badges_wait';
  function waitBadge(id, info) { const w = store.get(KEY_BADGE_WAIT, []); if (!Array.isArray(w) || w.some(x => x.id === id && x.end === info.end)) return; w.push(Object.assign({ id }, info)); store.set(KEY_BADGE_WAIT, w); }
  function judgeSeasonBadges() {
    const w = store.get(KEY_BADGE_WAIT, []); if (!Array.isArray(w) || !w.length || !LB_ON) return;
    //   시즌 중에 들어와도 한 번씩 확인해서 이미 밀려났으면 대기에서 뺀다
    //   (시즌이 끝난 뒤에는 서버가 그날 기록 일부를 지우므로, 시즌 중 확인이 더 정확하다)
    const now = Date.now(), due = w.filter(x => !myBadges()[x.id]);
    if (!due.length) { store.set(KEY_BADGE_WAIT, []); return; }
    const range = x => `created_at=gte.${new Date(x.start).toISOString()}&created_at=lt.${new Date(x.end).toISOString()}`;
    Promise.all(due.map(x => {
      const q = x.id === 'season50' ? `top50?select=id&${range(x)}&score=gt.${x.score}&limit=50`
        : `top50?select=id&${range(x)}&or=(lpos.eq.${x.lp},and(lpos.is.null,pos.eq.${x.lp}))&score=gt.${x.score}&limit=5`;
      return lbFetch(q).then(r => ({ x, ok: Array.isArray(r) && r.length < (x.id === 'season50' ? 50 : x.lp === 'OF' ? 3 : 1) }), () => ({ x, ok: null }));
    })).then(rs => {
      let left = store.get(KEY_BADGE_WAIT, []), got = false;
      for (const { x, ok } of rs) {
        if (ok == null) continue;
        const done = now >= x.end;
        if (ok && !done) continue;   // 아직 시즌 중이고 순위 안 → 계속 대기
        left = left.filter(y => !(y.id === x.id && y.end === x.end));
        if (ok && done && giveBadge(null, x.id, { at: x.end - 1, who: x.who })) got = true;
      }
      store.set(KEY_BADGE_WAIT, left);
      if (got && App.view === 'home') render();
    });
  }
  // 메달 색 [밝은, 기본, 진한, 테두리]
  const BTONE = { gold: ['#ffe9a3', '#e0b341', '#b8862a', '#7a5a14'], blue: ['#9cc4ff', '#3d7be0', '#2a5bb0', '#173a75'], navy: ['#8ea4d6', '#2e4a8a', '#1f3566', '#101d3d'],
    red: ['#ffa8a0', '#d9483b', '#a8322a', '#6e1b16'], green: ['#a8e6a3', '#3f9d4a', '#2c7436', '#174420'], purple: ['#d4b3ff', '#8a4fd6', '#6534a8', '#3c1a6e'], orange: ['#ffd29a', '#e88a2c', '#b8641c', '#7a3e0c'] };
  const BPAL = { W: '#ffffff', K: '#2a2a33', Y: '#ffd84a', R: '#e2443a', B: '#3d7be0', G: '#4cb050', N: '#8a5a32', O: '#ff9a2e' };
  // 16×16 도트 메달
  function drawBadge(cv, b, on) {
    const N = 16, c = cv.getContext('2d'); cv.width = N; cv.height = N; c.clearRect(0, 0, N, N);
    const inC = (x, y) => (x - 7.5) ** 2 + (y - 7.5) ** 2 <= 7.6 ** 2;
    const T = on ? BTONE[b.tone] || BTONE.gold : ['#d6d0c4', '#bdb5a6', '#a39b8b', '#8a8274'];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!inC(x, y)) continue;
      const edge = !inC(x - 1, y) || !inC(x + 1, y) || !inC(x, y - 1) || !inC(x, y + 1);
      const d = (x - 5) ** 2 + (y - 5) ** 2;
      c.fillStyle = edge ? T[3] : d < 10 ? T[0] : (x + y > 19 ? T[2] : T[1]);
      c.fillRect(x, y, 1, 1);
    }
    (b.ico || []).forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.') continue; c.fillStyle = on ? BPAL[ch] || '#fff' : (ch === 'K' ? '#8a8274' : '#9a9284'); c.fillRect(x + 3, y + 3, 1, 1); } });
  }
  function checkBadges(st) { for (const b of BADGES) if (b.chk) { try { if (b.chk(st)) giveBadge(st, b.id); } catch (e) { } } }
  function myBadges() { const b = store.get(KEY_BADGE, {}); return b && typeof b === 'object' ? b : {}; }
  function giveBadge(st, id, extra) {
    const b = myBadges(); if (b[id]) return false;
    b[id] = Object.assign({ at: Date.now(), who: st && st.final ? st.final.name : '' }, extra || {});
    store.set(KEY_BADGE, b);
    if (st) st._newBadges = (st._newBadges || []).concat([id]);
    return true;
  }
  function badgePanel() {
    const mine = myBadges(), got = BADGES.filter(x => mine[x.id]).length;
    const waitL = store.get(KEY_BADGE_WAIT, []), waiting = id => Array.isArray(waitL) && waitL.some(w => w.id === id);
    const day = t => { const d = new Date(t); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`; };
    return `<div class="panel badge-panel"><h3>내 뱃지 <span class="tiny muted">${got} / ${BADGES.length} · 기기 기준으로 기록됩니다 · 옆으로 밀어서 보기</span></h3>
      <div class="badge-grid">${BADGES.filter(x => mine[x.id]).sort((a, b) => mine[b.id].at - mine[a.id].at).concat(BADGES.filter(x => !mine[x.id])).map(x => {   /* 획득한 것(최근 순) → 미획득 순서 */ const m = mine[x.id]; return `<div class="badge ${m ? 'on' : 'off'} tone-${x.tone}">
        <canvas class="badge-pix" data-badge="${x.id}" data-on="${m ? 1 : 0}" width="16" height="16"></canvas>
        <b class="badge-name">${esc(x.name)}</b>
        <span class="badge-desc tiny">${esc(x.desc)}</span>
        ${m ? `<span class="badge-when tiny" title="${m.who ? esc(m.who) : ''}">${day(m.at)}${m.rank ? ` · ${m.rank}위` : m.who ? ` · ${esc(m.who)}` : ''}</span>` : waiting(x.id) ? '<span class="badge-when tiny">판정 대기 중</span>' : '<span class="badge-when tiny muted">미획득</span>'}
      </div>`; }).join('')}</div></div>`;
  }
  const recKey = (r, i) => r.online ? 'o' + r.id : String(r.date || 'r' + i);
  function rankPanel(recs, o) {
    const max = o.max, top = recs.slice().sort((a, b) => b.score - a.score).slice(0, max);
    const head = `<h3>${esc(o.title)} <span class="tiny muted">${esc(o.sub)}</span></h3>${o.note ? `<div class="tiny muted" style="margin:-4px 0 6px">${esc(o.note)}</div>` : ''}`;
    if (!top.length) return `<div class="panel rank50">${head}
      ${o.podium ? `<div class="podium empty">${[[1, 'silver'], [0, 'gold'], [2, 'bronze']].map(([i, m]) => `<div class="pod pod-${m}"><div class="pod-who"><b class="pod-name muted">?</b></div><div class="pod-step"><span>${i + 1}</span></div></div>`).join('')}</div>` : ''}
      <div class="muted small" style="margin-top:8px">${LB_ON && !App.lb.list && !App.lb.err ? '순위를 불러오는 중…' : o.empty}</div></div>`;
    const MEDAL = ['gold', 'silver', 'bronze'], MNAME = ['금', '은', '동'];
    const who = r => `${esc(Sim.POSNAME[r.pos] || r.pos)}${r.twoWay ? '·이도류' : ''}${r.hof ? ' · 명전' : ''}`;
    const hasCard = r => !!(r.card || r.online);
    const pod = o.podium ? [1, 0, 2].filter(i => top[i]).map(i => {
      const r = top[i], m = MEDAL[i], c = r.card;
      const av = r.online ? r.avatar : c ? c.avatar : (r.date || 1) % 99991, col = r.online ? r.color : c ? c.color : '#3d4a5c';
      return `<div class="pod pod-${m}">
        <button class="pod-who" data-act="reccard" data-v="${esc(recKey(r, i))}" ${hasCard(r) ? '' : 'disabled'} aria-label="${i + 1}위 ${esc(r.name)} ${r.score}점${hasCard(r) ? ' — 카드 보기' : ''}">
          <span class="pod-fig"><canvas class="pod-av" width="16" height="16" data-av="${+av || 1}" data-color="${esc(col)}"></canvas>
            <span class="pod-medal" title="${MNAME[i]}메달"><i class="rb rb-l"></i><i class="rb rb-r"></i><b>${i + 1}</b></span></span>
          <b class="pod-name">${esc(r.name)}</b><span class="pod-score num">${r.score}</span><span class="tiny muted">${who(r)}</span>
        </button>
        <div class="pod-step"><span>${i + 1}</span></div></div>`;
    }).join('') : '';
    const from = o.podium ? 3 : 0;
    const rest = top.slice(from).map((r, j) => { const i = j + from; return `<button class="rank-row" data-act="reccard" data-v="${esc(recKey(r, i))}" ${hasCard(r) ? '' : 'disabled'}><b class="num rk">${i + 1}</b><span class="spacer"><b>${esc(r.name)}</b> <span class="muted tiny">${who(r)} · WAR ${f1(r.war)}</span></span><b class="num">${r.score}</b></button>`; }).join('');
    return `<div class="panel rank50">${head}
      ${pod ? `<div class="podium">${pod}</div>` : ''}
      ${rest ? `<div class="rank-list">${rest}</div>` : ''}
      ${o.foot ? `<div class="tiny muted" style="margin-top:6px">${esc(o.foot)}</div>` : ''}</div>`;
  }
  // 이 기기 기록에서 이번 시즌(오늘) 기록만
  const inSeason = r => (r.date || 0) >= seasonInfo().start;
  // 홈 순위표 2개: 역대 TOP 20(시상대) + 이번 시즌 TOP 50 (온라인이면 전체 플레이어, 아니면 이 기기 기록)
  function homeBoard(recs) {
    const S = seasonInfo(), left = `새 시즌까지 ${leftText(S.end - Date.now())}`;
    let all = recs, season = recs.filter(inSeason), sub = '이 기기 기록';
    if (LB_ON) {
      lbLoad();
      if (App.lb.list) { all = App.lb.list; season = App.lb.season || []; sub = '전체 플레이어'; }
      else if (!App.lb.err) { all = []; season = []; sub = '전체 플레이어'; }
      else sub = '온라인 연결 실패 · 이 기기 기록';
    }
    return rankPanel(all, { title: '명예의 전당 [역대 TOP50]', sub, max: ALL_MAX, podium: true, empty: '아직 기록이 없다. 시상대 맨 위에 서 보자.', foot: '이름을 누르면 야구카드를 볼 수 있다.' })
      + rankPanel(season, { title: '시즌 최고점수 TOP 50', sub, max: SEASON_MAX, podium: true, /* 53차: 시즌 순위도 1~3위 시상대 */ note: `매일 밤 12시(한국 시간) 새 시즌 · ${left}`, empty: '이번 시즌 기록이 아직 없다. 첫 번째 주인공이 되어 보자.' });
  }
  // 61차: 골든글러브 라인업 — 포지션마다 커리어 점수 1위(외야는 1~3위)를 야구장에 세운다
  // 62차: 역대 라인업 + 이번 시즌(오늘) 라인업
  App.lu = { list: null, season: null, at: 0, loading: false, err: false, tab: 'all' };
  function lineupLoad() {
    if (!LB_ON || App.lu.loading || (App.lu.at && Date.now() - App.lu.at < 60000)) return;
    App.lu.loading = true;
    const since = new Date(seasonInfo().start).toISOString();
    const q = (cols, extra) => lbFetch(`top50?select=${cols}&order=score.desc,id.asc&limit=300${extra || ''}`);
    const both = cols => Promise.all([q(cols), q(cols, `&created_at=gte.${since}`)]);
    both('id,name,pos,lpos,two_way,score,avatar,color').catch(() => both('id,name,pos,two_way,score,avatar,color'))   // lpos 칸이 아직 없으면 pos 로
      .then(([rows, srows]) => { const m = r => Object.assign(lbRow(r), { lpos: r.lpos || null }); App.lu.list = (rows || []).map(m); App.lu.season = (srows || []).map(m); App.lu.err = false; })
      .catch(() => { App.lu.err = true; })
      .then(() => { App.lu.loading = false; App.lu.at = Date.now(); if (App.view === 'lineup') render(); });
  }
  function lineupPick(rows) {
    const by = {};
    for (const r of rows.slice().sort((a, b) => b.score - a.score)) {
      const p = r.lpos || (r.pos === 'CL' ? 'RP' : r.pos);
      if (LINEUP_POS.indexOf(p) < 0) continue;
      (by[p] = by[p] || []).push(r);
    }
    // 좌익·중견·우익: 그 자리 1위와 예전 외야(OF) 기록 중 점수가 높은 쪽
    const old = (by.OF || []).slice();
    for (const x of ['CF', 'LF', 'RF']) {
      const a = (by[x] || [])[0], b = old[0];
      by[x] = b && (!a || b.score > a.score) ? [old.shift()] : a ? [a] : [];
    }
    return by;
  }
  function viewLineup() {
    const tab = App.lu.tab === 'season' ? 'season' : 'all';
    let rows = null, sub = '전체 플레이어';
    if (LB_ON) { lineupLoad(); if (App.lu.list) rows = tab === 'season' ? App.lu.season || [] : App.lu.list; else if (App.lu.err) sub = '온라인 연결 실패 · 이 기기 기록'; }
    if (!rows && (!LB_ON || App.lu.err)) {
      rows = store.get(KEY_REC, []).filter(r => tab === 'all' || inSeason(r)).map(r => ({ name: r.name, pos: r.pos, twoWay: r.twoWay, score: r.score, avatar: r.card ? r.card.avatar : 1, color: r.card ? r.card.color : '#3d4a5c' }));
      if (!LB_ON) sub = '이 기기 기록';
    }
    const tabs = `<div class="lg-pick" style="margin-bottom:8px">${[['all', '역대 골든글러브'], ['season', '시즌 골든글러브']].map(([k, t]) => `<button class="${tab === k ? 'on' : ''}" data-act="lu-tab" data-v="${k}">${t}</button>`).join('')}</div>`;
    if (!rows) return pageShell('골든글러브 라인업', `${tabs}<div class="panel muted small">라인업을 불러오는 중…</div>`);
    const by = lineupPick(rows);
    const slot = (r, label, cls) => `<div class="lu-slot ${cls}">${r
      ? `<canvas class="pod-av lu-av" width="16" height="16" data-av="${+r.avatar || 1}" data-color="${esc(r.color || '#3d4a5c')}"></canvas>
         <b class="lu-name">${esc(r.name)}</b><span class="lu-score num">${r.score.toLocaleString()}점</span>
         <span class="lu-pos">${label}${r.twoWay ? '<i class="lu-tw">이도류</i>' : ''}</span>`
      : `<div class="lu-empty">?</div><span class="lu-pos">${label}</span>`}</div>`;
    const field = `<div class="lu-field">
      <svg class="lu-bg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M50 98 L2 50 Q50 -6 98 50 Z" class="lu-grass"/>
        <path d="M50 92 L24 66 L50 40 L76 66 Z" class="lu-dirt"/>
        <path d="M50 86 L30 66 L50 46 L70 66 Z" class="lu-infield"/>
        <circle cx="50" cy="64" r="4" class="lu-dirt"/>
        <path d="M50 98 L2 50 M50 98 L98 50" class="lu-line"/>
      </svg>
      ${slot(by.CF[0], '중견수', 'lu-cf')}${slot(by.LF[0], '좌익수', 'lu-lf')}${slot(by.RF[0], '우익수', 'lu-rf')}
      ${slot((by.SS || [])[0], '유격수', 'lu-ss')}${slot((by['2B'] || [])[0], '2루수', 'lu-2b')}
      ${slot((by['3B'] || [])[0], '3루수', 'lu-3b')}${slot((by['1B'] || [])[0], '1루수', 'lu-1b')}
      ${slot((by.SP || [])[0], '선발투수', 'lu-sp')}${slot((by.C || [])[0], '포수', 'lu-c')}
    </div>
    <div class="lu-bench">${slot((by.DH || [])[0], '지명타자', 'lu-dh')}${slot((by.RP || [])[0], '불펜투수', 'lu-rp')}</div>`;
    const S = seasonInfo();
    const head = tab === 'season' ? `오늘 은퇴한 선수 중 포지션별 커리어 점수 1위 · 새 시즌까지 ${leftText(S.end - Date.now())}` : '역대 포지션별 커리어 점수 1위';
    return pageShell('골든글러브 라인업', `${tabs}<div class="panel lu-panel"><div class="tiny muted" style="margin-bottom:8px">${head} · ${esc(sub)} · 이도류는 처음 고른 포지션</div>${field}</div>`);
  }
  function drawPodium() {
    document.querySelectorAll('canvas.pod-av').forEach(cv => drawAvatar(cv, +cv.dataset.av || 1, cv.dataset.color));
    document.querySelectorAll('canvas.badge-pix').forEach(cv => { const b = BADGES.find(x => x.id === cv.dataset.badge); if (b) drawBadge(cv, b, cv.dataset.on === '1'); });   // 65차: 뱃지 도트
    document.querySelectorAll('.badge-grid').forEach(dragScroll);
    if (App.view === 'home' && Date.now() - (App._judgeAt || 0) > 60000) { App._judgeAt = Date.now(); judgeSeasonBadges(); backfillTop50(); }
  }
  // 65차: 가로 줄을 마우스로 끌어서 밀기 + 세로 휠을 가로로 (터치는 브라우저 기본 스와이프)
  function dragScroll(el) {
    if (el._drag) return; el._drag = true;
    let down = false, x0 = 0, s0 = 0, moved = false;
    el.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = true; moved = false; x0 = e.clientX; s0 = el.scrollLeft; });
    window.addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - x0; if (Math.abs(dx) > 4) { moved = true; el.classList.add('dragging'); } el.scrollLeft = s0 - dx; });
    window.addEventListener('pointerup', () => { if (!down) return; down = false; el.classList.remove('dragging');
      if (moved) { const w = el.firstElementChild ? el.firstElementChild.offsetWidth + 8 : 1; el.scrollTo({ left: Math.round(el.scrollLeft / w) * w, behavior: 'smooth' }); } });
    el.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) { const max = el.scrollWidth - el.clientWidth; if ((e.deltaY > 0 && el.scrollLeft < max) || (e.deltaY < 0 && el.scrollLeft > 0)) { e.preventDefault(); el.scrollLeft += e.deltaY; } } }, { passive: false });
  }
  function openCard(name, card) {
    if (!card || !Array.isArray(card.stats) || !Array.isArray(card.rows)) return;
    App._recCard = card;
    const url = drawCard(card).toDataURL('image/png');
    $modal.innerHTML = `<div class="card-overlay" data-act="reccard-close"><div class="card-box">
      <img src="${url}" alt="${esc(name)} 야구카드 (앞·뒤)">
      <div class="row" style="gap:8px;margin-top:10px"><button class="btn" data-act="reccard-save" style="flex:1">이미지 저장</button><button class="btn go" data-act="reccard-close" style="flex:1">닫기</button></div>
    </div></div>`;
  }
  function showRecCard(key) {
    if (/^o\d+$/.test(key || '')) {   // 온라인 기록: 누를 때 카드 한 장만 받는다
      lbFetch(`top50?select=name,card&id=eq.${key.slice(1)}`).then(rows => { if (rows && rows[0]) openCard(rows[0].name, rows[0].card); }).catch(() => { });
      return;
    }
    const recs = store.get(KEY_REC, []);
    const r = recs.find((x, i) => recKey(x, i) === key) || recs.slice().sort((a, b) => b.score - a.score).find((x, i) => recKey(x, i) === key);
    if (r && r.card) openCard(r.name, r.card);
  }

  function viewHome() {
    const sv = loadSave();
    const recs = store.get(KEY_REC, []);
    return `
      <div class="row home-top">${devToggle()}<span class="spacer"></span>${homeIcons()}</div>
      <div class="home-hero">
        <canvas id="hero-pix" class="hero-pix" width="64" height="26" aria-label="투수가 던지고 타자가 받아치는 픽셀 그림"></canvas>
        <h1>골글 들고 명전으로</h1>
        <p>고교 야구부 벤치 끝자리에서 시작하는<br>야구선수 한 명의 인생</p>
      </div>
      <div class="home-actions">
        ${sv && !sv.done ? `<button class="btn go block" data-act="continue">이어하기 · ${esc(sv.me.name)} (${sv.me.age}세)</button>` : ''}
        <button class="btn ${sv && !sv.done ? '' : 'go'} block" data-act="new">새 인생 시작</button>
        <button class="btn block" data-act="page" data-v="lineup">🧤 골든글러브 라인업</button>
        ${App.admin ? `<button class="btn block small ghost" data-act="admin">${App.dev ? '<span class="admin-on">관리자 모드 ON</span> · 끄기' : '관리자 모드 들어가기'}</button>` : ''}
      </div>
      ${App.dev ? '<div class="panel admin-panel small">관리자 모드: 진행 화면에서 내 선수의 잠재능력(PA)·등급·성장/노화 유형·전성기 시기를, 리그 탭 구단 기록에서 선수 OVR을 볼 수 있다.</div>' : ''}
      ${statsPanel()}
      ${badgePanel()}
      ${homeBoard(recs)}
      <p class="tiny muted" style="text-align:center;margin-top:18px">리그 선수는 2025 시즌 실제 명단 기준(능력치는 가상) · 진행 중인 게임은 이 브라우저에 저장된다</p>
      <p class="tiny muted legal" style="text-align:center;margin-top:8px;line-height:1.5">이 게임은 KBO·NPB·MLB 및 각 구단·선수와 공식 관계가 없는 비영리 팬 게임입니다.<br>게임에 나오는 실제 리그·구단 명칭과 선수 이름에 대한 상표권·초상권·퍼블리시티권 등 모든 권리는 각 권리자에게 있습니다.<br>선수 능력치와 경기 결과는 모두 가상입니다. 권리자의 요청이 있으면 해당 내용을 바로 수정·삭제합니다.<br>© 2026 골글 들고 명전으로</p>`;
  }

  // ================================================================
  // 선수 생성
  // ================================================================
  function randName() { const D = GAME_DATA; const p = a => a[Math.floor(Math.random() * a.length)]; return p(D.surnames) + p(D.given1) + p(D.given2); }
  function newCreate() {
    const hs0 = GAME_DATA.eliteSchools[Math.floor(Math.random() * GAME_DATA.eliteSchools.length)];
    App.create = { name: randName(), num: 1 + Math.floor(Math.random() * 99), role: 'B', pos: 'SS', hand: 0, school: 'mid', hsName: hs0.name, hometown: hs0.team, pick: 0, candSeed: (Math.random() * 1e9) >>> 0, avatar: (Math.random() * 1e6) | 0, tf: ['con', 'pow'] };
    rollCands();
  }
  const simPos = p => /^(LF|CF|RF)$/.test(p) ? 'OF' : p === 'CL' ? 'RP' : p;   // 62차: 좌익·중견·우익은 계산상 외야수
  function rollCands() {
    const c = App.create;
    c.cands = Sim.makeCandidates({ rng: { s: c.candSeed } }, c.role, simPos(c.pos));
  }
  function viewCreate() {
    const c = App.create;
    const keys = c.role === 'P' ? Sim.PIT : Sim.BAT;
    const posList = c.role === 'P' ? ['SP'] : ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
    return `
      <div class="topbar"><button class="btn small" data-act="home">← 홈</button><span class="title">새 인생</span><span class="spacer"></span>${devToggle()}</div>
      <div class="panel" style="margin-top:6px">
        <div class="row" style="gap:14px">
          <canvas id="cr-ava" width="16" height="16" style="width:72px;height:72px;image-rendering:pixelated;background:${TEAMCOLOR(c.hometown)};border-radius:12px"></canvas>
          <div class="spacer">
            <div class="grid2"><div><label class="f" style="margin-top:0">이름</label><input class="t" id="cr-name" maxlength="8" value="${esc(c.name)}"></div>
            <div><label class="f" style="margin-top:0">등번호</label><input class="t num" id="cr-num" type="number" min="0" max="99" value="${c.num}"></div></div>
          </div>
        </div>
        <button class="btn small" data-act="cr-ava" style="margin-top:8px">얼굴 바꾸기</button>
        <label class="f">투수 / 타자</label>
        <div class="seg">${[['B', '타자'], ['P', '투수']].map(([v, t]) => `<button class="${c.role === v ? 'on' : ''}" data-act="cr-role" data-v="${v}">${t}</button>`).join('')}</div>
        <label class="f">포지션</label>
        ${c.role === 'P' ? '<div class="tiny muted" style="margin-top:2px">고교 시절은 선발로 던진다. 보직(선발·불펜·마무리)은 고교를 졸업할 때 고른다.</div>' : `<div class="seg">${posList.map(p => `<button class="${c.pos === p ? 'on' : ''}" data-act="cr-pos" data-v="${p}">${{ C: '포수', '1B': '1루', '2B': '2루', '3B': '3루', SS: '유격', OF: '외야', LF: '좌익', CF: '중견', RF: '우익', SP: '선발', RP: '불펜', CL: '마무리' }[p]}</button>`).join('')}</div>${/^(LF|CF|RF)$/.test(c.pos) ? '<div class="tiny muted" style="margin-top:4px">좌익수·중견수·우익수는 이름만 다르고 능력치 계산과 기록은 모두 같은 외야수로 친다.</div>' : ''}`}
        <div class="grid2">
          <div><label class="f">투타</label><select class="t" id="cr-hand">${HANDS.map((h, i) => `<option value="${i}" ${c.hand === i ? 'selected' : ''}>${h[2]}</option>`).join('')}</select></div>
          <div><label class="f">고등학교</label><select class="t" id="cr-hs">${GAME_DATA.eliteSchools.map(s => `<option value="${esc(s.name)}" ${c.hsName === s.name ? 'selected' : ''}>${esc(s.name)} (${GAME_DATA.regions[s.team]})</option>`).join('')}</select></div>
        </div>
        <div class="tiny muted" style="margin-top:6px">실력이 상위 라운드감이면 고등학교 연고 구단이 드래프트에서 먼저 관심을 보인다.</div>
        <label class="f">훈련 부스트</label>
        <div class="seg wrap">${keys.map(k => `<button class="${(c.tf || []).indexOf(k) >= 0 ? 'on' : ''}" data-act="cr-tf" data-v="${k}">${Sim.LABEL[k]}</button>`).join('')}</div>
      </div>
      <div class="panel">
        <div class="row"><h3 style="margin:0">시작 후보</h3><span class="spacer"></span><button class="btn small" data-act="cr-reroll">다른 후보 보기</button></div>
        <div class="tiny muted" style="margin:4px 0 2px">능력치 총량은 같고 구성만 다르다. 잠재력은 끝까지 비밀.</div>
        <div class="cands">${c.cands.map((cd, i) => `<button class="cand ${c.pick === i ? 'on' : ''}" data-act="cr-pick" data-v="${i}"><div class="head"><b>후보 ${i + 1} · ${cd.label}</b><span class="small muted">OVR <b class="num" style="color:var(--ink)">${Sim.disp(Sim.ovrAt(cd.r, simPos(c.pos)))}</b></span></div>${miniBars(cd.r, keys)}</button>`).join('')}</div>
      </div>
      <div class="dock"><div class="in"><button class="btn go block" data-act="cr-start">이 선수로 인생 시작</button></div></div>`;
  }
  function afterCreate() {
    const cv = document.getElementById('cr-ava');
    if (cv) drawAvatar(cv, App.create.avatar, TEAMCOLOR(App.create.hometown));
  }
  function readCreateInputs() {
    const c = App.create;
    const n = document.getElementById('cr-name'); if (n) c.name = n.value.trim() || c.name;
    const num = document.getElementById('cr-num'); if (num) c.num = Math.max(0, Math.min(99, parseInt(num.value, 10) || 0));
    const h = document.getElementById('cr-hand'); if (h) c.hand = +h.value;
    const ht = document.getElementById('cr-home'); if (ht) c.hometown = ht.value;
    const hs = document.getElementById('cr-hs'); if (hs) { const s = GAME_DATA.eliteSchools.find(x => x.name === hs.value); if (s) { c.hsName = s.name; c.hometown = s.team; } }
  }
  function startCareer() {
    readCreateInputs();
    const c = App.create;
    const hand = HANDS[c.hand];
    const seed = (Math.random() * 4294967295) >>> 0;
    App.st = Sim.newGame(seed, { name: c.name, num: c.num, role: c.role, pos: c.pos === 'CL' ? 'RP' : c.pos, closer: c.pos === 'CL', throws: hand[0], bats: hand[1], school: c.school, hometown: c.hometown, hsName: c.hsName || null, r: c.cands[c.pick].r, avatar: c.avatar, trainFocus: c.tf || [] });
    App.view = 'main'; App.tab = 'career'; App.flipped = false;
    save(); render();
  }

  // ================================================================
  // 야구카드
  // ================================================================
  function cardHTML(st) {
    const me = st.me, v = Sim.view(st);
    // 52차: 은퇴한 카드는 프로에서 가장 많이 뛴 팀·포지션으로
    const fin = st.done && st.final && st.final.mainTeamName ? st.final : null;
    const cTeam = fin ? fin.mainTeam : me.team;
    const color = cTeam ? TEAMCOLOR(cTeam) : '#3d4a5c';
    const emblem = fin ? esc(fin.mainTeamName) : me.team ? esc(Sim.teamName(st, me.team)) : (me.stage === 'univ' ? '大' : me.stage === 'indie' ? 'IND' : '高');
    const keys = Sim.mainKeys(me), opp = Sim.oppKeys(me);
    const sub = `${fin ? mainPosText(fin, me) : posText(me)} · ${handText(me)} · ${me.age}세`;
    const team = fin ? `${fin.mainTeamName} · 통산` : me.stage === 'hs' ? (me.hsName ? `${me.hsName} ${Math.min(3, me.grade)}학년` : `${me.school === 'strong' ? '명문고' : SCHOOL[me.school] + ' 고교'} ${Math.min(3, me.grade)}학년`) : me.stage === 'univ' ? `대학 ${me.univYears + 1}학년` : me.stage === 'indie' ? '독립리그' : me.stage === 'retired' ? '은퇴' : me.stage === 'mil' ? (me.milType === 'sangmu' ? `상무 · 군 복무 ${me.milYears + 1}년차` : `현역 복무 ${me.milYears + 1}년차`) : `${Sim.teamName(st, me.team)} · ${me.lvl === 1 ? '1군' : minorName(st)}`;
    const hof = st.done && st.final && st.final.hof && st.final.hof.in ? st.final.hof : null;
    const grade = hof ? 'HALL OF FAME' : { bronze: 'BRONZE', silver: 'SILVER', gold: 'GOLD', legend: 'LEGEND' }[v.grade];
    const fcls = hof ? 'hof' : v.grade;
    const troph = trophyList(st.car && st.car.awList);   // 64차: 우승·메달이 있으면 프로필을 줄이고 트로피 진열장
    return `
      <div class="card-wrap"><div class="bcard ${App.flipped ? 'flipped' : ''} ${hof ? 'is-hof' : ''} ${troph.length ? 'has-troph' : ''}" data-act="flip">
        <div class="face front ${fcls}"><div class="face-in">
          <div class="card-top" style="--team:${cardBg(color)}">
            <div class="card-emblem">${emblem}</div>
            <div class="card-ovr"><b class="num">${Sim.disp(v.ovr)}</b><span>OVR</span></div>
            <canvas id="card-ava"></canvas>
            ${hof ? `<div class="hof-ribbon">★ 명예의 전당 헌액자 · ${hof.year} ★</div>` : ''}
            <div class="card-grade">${grade}</div>
            ${hof && st.final && ensureRetNum(st) ? `<div class="card-retnum">영구결번 #${st.final.retNum.num}</div>` : ''}
          </div>
          <div class="card-name"><span class="no num">${me.num}</span><h2>${esc(me.name)}</h2></div>
          <div class="card-sub">${esc(team)} · ${sub}${me.role === 'P' ? ` · 최고 ${v.velo}km/h` : ''}</div>
          ${troph.length ? `<canvas id="card-troph" class="card-troph" width="340" height="104" aria-label="우승 기록: ${esc(troph.map(([k, n]) => `${TROPHY.find(t => t[0] === k)[1]} ${n}회`).join(', '))}"></canvas>` : ''}
          ${barsHTML(me.shown, keys, '', lastChg(st))}
          ${me.twoWay ? `<div class="card-sub tiny" style="padding-top:6px">${me.role === 'P' ? '타자' : '투수'} 능력</div>${barsHTML(me.shown, opp, 'opp', lastChg(st))}` : ''}
          <div class="card-foot"><span>${st.year} SEASON</span><span>탭하면 뒷면</span></div>
        </div></div>
        <div class="face back ${fcls}"><div class="face-in">
          <div class="back-head"><b>${esc(me.name)} <span class="muted small">#${me.num}</span></b><span class="small muted">연도별 기록</span></div>
          <div class="back-scroll">${histTables(st)}</div>
        </div></div>
      </div></div>`;
  }
  function histTables(st) {
    const me = st.me, H = st.hist, car = st.car;
    let out = '';
    // 65차: 카드 뒷면 기록표를 저장 이미지 카드와 같은 한글 항목·순서로 (투수: 세이브·홀드 포함)
    //   이도류(또는 이도류를 하다 그만둔 선수)는 타자·투수 둘 다, 시즌 WAR도 타자분·투수분으로
    const tw = !!(me.twoWay || (me.twoWayChosen && car.pit.outs > 0 && car.bat.PA > 0));
    const showBat = me.role === 'B' || tw || H.some(h => h.bat && h.bat.PA > 30);
    const showPit = me.role === 'P' || tw;
    const wOf = (h, fut, k) => h.war == null || fut ? '-' : f1(tw && h[k] != null ? h[k] : h.war);
    const td = a => a.map(x => `<td>${x}</td>`).join('');
    const th = a => `<tr>${a.map(x => `<th>${x}</th>`).join('')}</tr>`;
    const tm = (h, fut) => `${esc(h.team)}${fut ? '(2)' : ''}`;
    if (showBat) {
      const rows = H.filter(h => h.bat).map(h => { const b = h.bat; return `<tr class="${b.fut ? 'fut' : ''}">${td([String(h.year).slice(2), tm(h, b.fut), b.G || '-', b.PA ? r3(Sim.AVG(b)) : '-', b.AB || 0, b.H || 0, b.HR || 0, b.RBI || 0, b.SB || 0, b.PA ? r3(Sim.OBP(b)) : '-', b.PA ? r3(Sim.OPS(b)) : '-', wOf(h, b.fut, 'warB')])}</tr>`; }).join('');
      const t = car.bat;
      out += `<table class="stat">${th(['연도', '팀', '경기', '타율', '타수', '안타', '홈런', '타점', '도루', '출루율', 'OPS', 'WAR'])}${rows || '<tr><td colspan="12" class="muted">기록 없음</td></tr>'}${t.PA ? `<tr class="tot">${td(['통산', '1군', t.G, r3(Sim.AVG(t)), t.AB, t.H, t.HR, t.RBI, t.SB, r3(Sim.OBP(t)), r3(Sim.OPS(t)), f1(tw ? car.warB : car.war)])}</tr>` : ''}</table>`;
    }
    if (showPit) {
      const rows = H.filter(h => h.pit).map(h => { const p = h.pit; return `<tr class="${p.fut ? 'fut' : ''}">${td([String(h.year).slice(2), tm(h, p.fut), p.outs ? f2(Sim.ERA(p)) : '-', p.G || '-', p.W || 0, p.L || 0, p.SV || 0, p.HLD || 0, ip(p), p.K || 0, wOf(h, p.fut, 'warP')])}</tr>`; }).join('');
      const t = car.pit;
      out += `<table class="stat" style="margin-top:8px">${th(['연도', '팀', 'ERA', '경기', '승', '패', '세이브', '홀드', '이닝', '탈삼진', 'WAR'])}${rows || '<tr><td colspan="11" class="muted">기록 없음</td></tr>'}${t.outs ? `<tr class="tot">${td(['통산', '1군', f2(Sim.ERA(t)), t.G, t.W, t.L, t.SV, t.HLD || 0, ip(t), t.K, f1(tw ? car.warP : car.war)])}</tr>` : ''}</table>`;
    }
    return out;
  }
  function afterCard() {
    const cv = document.getElementById('card-ava');
    if (cv && App.st) drawAvatar(cv, App.st.me.avatar || 1, App.st.me.team ? TEAMCOLOR(App.st.me.team) : '#3d4a5c');
    const tc = document.getElementById('card-troph');
    if (tc && App.st) { const c = tc.getContext('2d'); c.clearRect(0, 0, tc.width, tc.height); drawShelf(c, trophyList(App.st.car.awList), 0, 0, tc.width, tc.height); }
  }

  // ================================================================
  // 메인
  // ================================================================
  function viewMain() {
    const st = App.st, me = st.me, v = Sim.view(st);
    let info;
    if (me.stage === 'pro') {
      info = [['나이', `${me.age}세`], ['소속', `${Sim.teamName(st, me.team)} ${me.lvl === 1 ? '1군' : minorName(st)}`], ['연봉', Sim.man(me.salary)]];
    } else if (me.stage === 'mil') {
      info = [['나이', `${me.age}세`], ['복무', me.milType === 'sangmu' ? '상무' : '현역'], ['전역까지', `${Sim.BAL.mil.years - me.milYears}시즌`]];
    } else {
      const sc = me.scout.perf.length ? Sim.interest(me.scout.score) : '관심 없음';
      info = [['나이', `${me.age}세`], ['소속', me.stage === 'hs' ? `고교 ${Math.min(3, me.grade)}학년` : me.stage === 'univ' ? '대학' : '독립리그'], ['스카우트', sc]];
    }
    const pending = st.pending.length;
    const goLabel = pending ? '결정이 기다리고 있다' : `${st.year} 시즌 진행 ▶`;
    return `
      <div class="topbar"><button class="btn small" data-act="home">홈</button><span class="title">${esc(me.name)}의 인생</span><span class="spacer"></span>${App.dev ? '<button class="btn small" data-act="auto">자동 진행</button>' : ''}${devToggle()}</div>
      ${cardHTML(st)}
      <div class="flip-hint">카드를 누르면 뒷면(연도별 기록)이 보인다</div>
      <div class="info">${info.map(([k, x]) => `<div><div class="k">${k}</div><div class="v">${esc(x)}</div></div>`).join('')}</div>
      ${contractPanel(st)}${pitchPanel(st)}
      ${focusPanel(st)}      ${me.stage === 'hs' && me.grade >= 3 && me.scout.perf.length ? `<div class="panel small">예상 지명 범위: <b>${Sim.draftRange(me.scout.score)}</b></div>` : ''}
      <div class="tabs">${[['career', '역대 시즌'], ['total', '역대 커리어'], ['comp', '대회별'], ['league', '리그'], ['story', Sim.canPost(st) ? '인생 ✈' : '인생']].map(([k, t]) => `<button class="${App.tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${t}</button>`).join('')}</div>
      ${App.tab === 'career' ? tabCareer(st) : App.tab === 'comp' ? tabComp(st) : App.tab === 'total' ? tabTotal(st) : App.tab === 'league' ? tabLeague(st) : tabStory(st)}
      ${me.stage === 'pro' && me.age >= 35 ? `<div style="text-align:center;margin-top:16px"><button class="btn small" data-act="retire-now">은퇴 선언</button></div>` : ''}
      ${App.dev ? adminPanel(st) : ''}
      <div class="dock"><div class="in"><button class="btn go block" data-act="${pending ? 'next-event' : 'play'}">${goLabel}</button></div></div>`;
  }
  function devText(st) {
    const d = Sim.debug(st), me = st.me;
    const pa = Object.entries(d.pa).map(([k, v]) => `${Sim.LABEL[k]} ${Math.round(me.r[k])}/${v}`).join('  ');
    return `[숨은 값 · 개발자 모드]\n잠재 등급: ${d.tier}  성장: ${d.growth}  에이징: ${d.aging}\n현재/잠재(PA): ${pa}\n관리 ${d.care}  감독신뢰 ${d.trust}  인기 ${d.pop}  기초체력 ${d.fit}  큰부상 ${d.bigInj}\n스카우트점수 ${d.scout}  1군연차 ${d.svc}/${d.faAt == null ? '-' : d.faAt}  이도류배율 ${d.twMult.main}/${d.twMult.opp}${d.twMult.legend ? '(역대급)' : ''}\n플래그 ${JSON.stringify(d.flags)}\n커리어점수(현재) ${Sim.careerScore(st)}`;
  }
  // 역대 시즌: 해마다 성적·소속·수상·능력치 변화를 한 번에
  function tabCareer(st) {
    const H = st.hist;
    if (!H.length) return `<div class="panel"><div class="muted small">아직 치른 시즌이 없다. 아래 버튼을 눌러 첫 시즌을 시작하자.</div></div>`;
    const me = st.me;
    const keys = me.twoWay ? Sim.ALL : Sim.mainKeys(me);
    const car = st.car;
    const pro = H.filter(h => h.war != null);
    const sum = `<div class="season-sum">
      <div><b>${H.length}</b><span>시즌</span></div>
      <div><b>${pro.length ? f1(car.war) : '-'}</b><span>통산 WAR</span></div>
      <div><b>${pro.length ? f1(Math.max(...pro.map(h => h.war))) : '-'}</b><span>최고 WAR</span></div>
      <div><b>${Sim.disp(car.peak || 0)}</b><span>최고 OVR</span></div></div>`;
    const items = H.slice().reverse().map(h => {
      const line = [];
      const fut = h.lg === 'MLB' ? '마이너 ' : h.lg === 'NPB' ? '2군 ' : '퓨처스 ';
      if (h.bat && h.bat.PA) line.push(`${h.bat.fut ? fut : ''}${Sim.fmtBatShort(h.bat)}`);
      if (h.pit && h.pit.outs) line.push(`${h.pit.fut ? fut : ''}${Sim.fmtPitShort(h.pit)}`);
      if (h.inj) line.push('부상으로 시즌 전체 결장 · 0경기');
      const where = h.stage === 'pro' || h.war != null ? `${h.team} · ${h.lvl}` : h.team;
      const ovr = h.ovr != null ? `<span class="s-ovr">OVR <b class="num">${Sim.disp(h.ovr)}</b>${h.ovrD ? `<i class="dv ${h.ovrD > 0 ? 'up' : 'down'}">${h.ovrD > 0 ? '▲' : '▼'}${Math.abs(Sim.dispD(h.ovrD))}</i>` : ''}</span>` : '';
      const aw = (h.awards || (h.note ? h.note.split(', ') : [])).filter(Boolean);
      return `<div class="season-item">
        <div class="s-head"><b class="num">${h.year}</b><span class="muted small">${h.age}세 · ${esc(where)}</span><span class="spacer"></span>${h.war != null && !(h.bat && h.bat.fut && !h.pit) ? `<span class="s-war">WAR <b class="num">${f1(h.war)}</b></span>` : ''}</div>
        ${h.status ? `<div class="small">${esc(h.status)}</div>` : ''}
        ${h.record || h.ps ? `<div class="tiny muted">${esc([h.record, h.ps].filter(Boolean).join(' · '))}</div>` : ''}
        ${h.tourn && h.tourn.length ? `<div class="tiny muted">${h.tourn.map(esc).join(' · ')}</div>` : ''}
        ${line.length ? `<div class="small s-line">${line.map(esc).join('<br>')}</div>` : '<div class="tiny muted">출전 기록 없음</div>'}
        ${aw.length ? `<div class="stamps sm">${aw.map(a => `<span class="stamp ${/MVP|우승|골든/.test(a) ? 'gold' : /각성|전성기|커리어 하이/.test(a) ? 'peak' : ''}">${esc(a)}</span>`).join('')}</div>` : ''}
        <div class="s-chg"><span class="tiny muted">시즌 후 능력치</span>${ovr}</div>
        ${h.chg ? chgChips(h.chg, keys) : '<div class="tiny muted">(이전 버전 기록이라 변화 정보 없음)</div>'}
      </div>`;
    }).join('');
    return `<div class="panel"><h3>역대 시즌</h3>${sum}${ovrSpark(H)}${items}</div>`;
  }
  // 시즌별 OVR 추이 (작은 선 그래프)
  function ovrSpark(H) {
    const pts = H.filter(h => h.ovr != null);
    if (pts.length < 2) return '';
    const W = 300, Ht = 64, pad = 6;
    const vs = pts.map(h => Sim.disp(h.ovr)), lo = Math.min(...vs) - 2, hi = Math.max(...vs) + 2;
    const x = i => pad + i * (W - pad * 2) / (pts.length - 1), y = v => Ht - pad - (v - lo) / (hi - lo) * (Ht - pad * 2);
    const d = pts.map((h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(Sim.disp(h.ovr)).toFixed(1)}`).join('');
    const best = vs.indexOf(Math.max(...vs));
    return `<div class="spark"><svg viewBox="0 0 ${W} ${Ht}" preserveAspectRatio="none" aria-label="시즌별 OVR 추이"><path d="${d}" fill="none" stroke="var(--navy)" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="${x(best)}" cy="${y(vs[best])}" r="3.5" fill="var(--gold)"/></svg><div class="tiny muted spark-lbl"><span>${pts[0].year}</span><span>OVR 추이 · 최고 ${vs[best]} (${pts[best].year})</span><span>${pts[pts.length - 1].year}</span></div></div>`;
  }
  // ---------- 14차: 육성 방향 (처음 + 커리어 중 2번 변경) ----------
  function focusPanel(st) {
    const me = st.me, F = Sim.BAL.focusChange;
    if (st.done) return '';
    const left = me.tfChanges == null ? F.times : me.tfChanges;
    const tf2On = me.tf2 && me.age <= me.tf2.until;
    const cur = tf2On ? me.tf2.keys : (me.trainFocus && me.trainFocus.length && me.age < Sim.BAL.trainFocus.untilAge ? me.trainFocus : null);
    const curTxt = cur ? `<b>${cur.map(k => Sim.LABEL[k]).join(' · ')}</b> 집중 <span class="muted">· ${tf2On ? `${me.tf2.until}세 시즌까지` : `${Sim.BAL.trainFocus.untilAge - 1}세 시즌까지`}</span>` : '<span class="muted">지금은 특별히 집중하는 능력치가 없다</span>';
    const keys = me.twoWay ? Sim.ALL : Sim.mainKeys(me);
    const pick = App.tfPick || [];
    return `<div class="panel small"><div class="row"><b>훈련 부스트</b><span class="spacer"></span><span class="tiny muted">부스트 바꾸기 남은 ${left}회</span></div>
      <div style="margin-top:4px">${curTxt}</div>
      ${left > 0 ? (App.tfOpen ? `<div class="seg wrap" style="margin-top:8px">${keys.map(k => `<button class="${pick.indexOf(k) >= 0 ? 'on' : ''}" data-act="tf-pick" data-v="${k}">${Sim.LABEL[k]}</button>`).join('')}</div>
        <div class="tiny muted" style="margin:6px 0">새 강점 두 개를 고르면 그쪽 잠재력이 오르고(+), 지금 가장 높은 강점 두 개의 잠재력은 조금 내려간다. 이후 ${F.seasons}시즌 동안 고른 능력치가 더 잘 오른다.</div>
        <div class="row" style="gap:8px"><button class="btn small" data-act="tf-close">취소</button><button class="btn small primary" data-act="tf-apply" ${pick.length === 2 ? '' : 'disabled'}>이 부스트로 바꾸기</button></div>`
        : `<button class="btn small" data-act="tf-open" style="margin-top:8px">훈련 부스트 바꾸기</button>`) : ''}</div>`;
  }
  // ---------- 프로필: 계약·구종 ----------
  function minorName(st) { const c = Sim.cfgOf(st.lg); return c.id === 'KBO' ? '2군(퓨처스)' : c.id === 'MLB' ? '2군(마이너)' : c.minor; }
  function contractPanel(st) {
    const me = st.me;
    if (me.stage !== 'pro') return '';
    const c = me.contract, yr = st.year;
    const left = c ? c.until - yr + 1 : 0;
    const kind = c ? ({ FA: 'FA 계약', '다년': '비FA 다년계약', '1년': '1년 계약', MLB: '메이저리그 계약', NPB: '일본 구단 계약', 'KBO 복귀': 'KBO 복귀 계약' }[c.kind] || c.kind) : '연봉 계약 (매년 갱신)';
    const fa = me.abroad ? '계약이 끝나면 다시 협상' : me.faAt == null ? '-' : me.svc >= me.faAt ? '자격 있음 (계약 종료 시 FA)' : `1군 ${me.faAt - me.svc}시즌 더 채우면 FA (현재 ${me.svc}/${me.faAt})`;
    const M = Sim.BAL.mil;
    const mil = me.milDone ? (me.milExempt ? `면제 (${me.milExempt})` : '해결') : `미필 · ${M.deadline}세 시즌 전까지 입대 (상무 기준 OVR ${Sim.disp(M.sangmuOVR)})`;
    const A = Sim.BAL.abroad;
    const ab = me.abroad ? `${Sim.LCFG[me.abroad].name}에서 뛰는 중` : Sim.cfgOf(st.lg).id !== 'KBO' ? '-'
      : !me.milDone ? '병역 해결 후 가능'
      : me.svc >= A.faSvc ? '포스팅 신청 가능 · 해외 FA 자격 있음'
      : me.svc >= A.svc ? `포스팅 신청 가능 · 해외 FA까지 1군 ${A.faSvc - me.svc}시즌`
      : `포스팅까지 1군 ${A.svc - me.svc}시즌 · 해외 FA까지 ${A.faSvc - me.svc}시즌`;
    const rows = [['계약', kind], ['연봉', Sim.man(me.salary)], ['기간', c ? `${c.until}년까지 · ${left > 0 ? `남은 ${left}년` : '올해로 만료'}` : '-'], ['FA', fa], ['해외', ab], ['병역', mil]];
    // 62차: 에이전시 (협상력이 높을수록 연봉 협상·FA 몸값에 유리, 수수료는 연봉에서 뗀다)
    { const ag = me.agency || { tier: me.flags && me.flags.bigAgent ? 'big' : 'small', skill: me.flags && me.flags.bigAgent ? 80 : 40 }, A = Sim.AGENCY[ag.tier]; const g = ag.skill >= 82 ? 'S' : ag.skill >= 66 ? 'A' : ag.skill >= 50 ? 'B' : 'C'; rows.splice(2, 0, ['에이전시', `${A.name} · 협상력 ${g}급 · 수수료 ${Math.round(A.fee * 100)}%`]); }
    if (me.draft) rows.push(['입단', me.draft.round === '육성' ? `${me.draft.year} 육성선수 (${Sim.teamName(st, me.draft.team)})` : `${me.draft.year} 드래프트 ${me.draft.round}라운드 (${Sim.teamName(st, me.draft.team)})`]);
    return `<div class="panel"><h3>계약 상황</h3><div class="kv-list">${rows.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div></div>`;
  }
  // 구종: 선수마다 고정된 순서(아바타 시드)로 변화구가 정해지고, 변화구·구위 능력치가 오르면 새 구종이 열린다
  const PITCH_POOL = [['슬라이더', 'brk', 0], ['커브', 'brk', -3], ['체인지업', 'stf', -2], ['포크볼', 'stf', -1], ['스플리터', 'stf', -4], ['커터', 'ctl', -2], ['투심', 'vel', -3], ['싱커', 'ctl', -4], ['너클커브', 'brk', -6], ['스위퍼', 'brk', -5]];
  function arsenal(me) {
    const r = me.r;
    let s = ((me.avatar || 7) * 2654435761) >>> 0;
    const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    const pool = PITCH_POOL.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const n = Math.min(5, 1 + (r.brk >= 45) + (r.brk >= 58) + (r.brk >= 70) + (r.stf >= 72));
    const grade = v => v >= 80 ? 'S' : v >= 72 ? 'A' : v >= 64 ? 'B' : v >= 55 ? 'C' : v >= 46 ? 'D' : 'E';
    const fb = Math.round(r.vel * 0.6 + r.stf * 0.4);
    const out = [{ name: '포심 패스트볼', v: fb, g: grade(fb), velo: Sim.velo(r.vel) }];
    pool.slice(0, n).forEach((p, i) => { const v = Math.round(r[p[1]] * 0.6 + r.brk * 0.4 + p[2] - i * 1.5 + (rnd() * 8 - 4)); out.push({ name: p[0], v, g: grade(v) }); });
    return out;
  }
  function pitchPanel(st) {
    const me = st.me;
    if (me.role !== 'P' && !me.twoWay) return '';
    const ars = arsenal(me);
    return `<div class="panel"><h3>구사 구종 <span class="tiny muted">${ars.length}개 · 변화구 능력이 오르면 새 구종이 열린다</span></h3><div class="pitches">${ars.map(p => `<div class="pitch"><span class="pn">${esc(p.name)}${p.velo ? ` <i class="tiny muted">${p.velo}km/h</i>` : ''}</span><span class="pa-trk"><span class="cur" style="width:${Math.max(5, Math.min(100, p.v))}%"></span></span><b class="pg g-${p.g}">${p.g}</b></div>`).join('')}</div></div>`;
  }

  // ---------- 대회별 기록 (시즌별 + 합계) ----------
  const COMP_NAME = { HS: '고교 야구', UNIV: '대학리그', IND: '독립리그', MIL: '상무(군 복무)', KBO1: 'KBO 정규시즌', KBO2: '퓨처스리그', KBOPS: 'KBO 포스트시즌', NPB1: 'NPB 정규시즌', NPB2: 'NPB 2군', NPBPS: 'NPB 포스트시즌', MLB1: 'MLB 정규시즌', MLB2: '마이너리그', MLBPS: 'MLB 포스트시즌', NAT: '국가대표' };
  const COMP_ORDER = ['HS', 'UNIV', 'IND', 'MIL', 'KBO2', 'KBO1', 'KBOPS', 'NPB2', 'NPB1', 'NPBPS', 'MLB2', 'MLB1', 'MLBPS', 'NAT'];
  function histLg(h) { return h.lg || (h.lvl === 'A' ? (/^고교/.test(h.team) ? 'HS' : h.team === '독립' ? 'IND' : 'UNIV') : 'KBO'); }
  function compData(st) {
    const C = {};
    // 62차: 부상으로 통째로 날린 시즌(h.inj)도 0으로 한 줄 남긴다
    const add = (key, h, bat, pit, war, def, inj) => {
      if (!(bat && bat.PA) && !(pit && pit.outs) && !inj) return;
      const c = C[key] = C[key] || { key, rows: [] };
      c.rows.push({ year: h.year, age: h.age, team: inj ? `${h.team} (부상)` : h.team, bat: bat && (bat.PA || inj) ? bat : null, pit: pit && (pit.outs || inj) ? pit : null, war, def: def || null });
    };
    for (const h of st.hist) {
      const lg = histLg(h);
      if (lg === 'HS' || lg === 'UNIV' || lg === 'IND' || lg === 'MIL') { add(lg, h, h.bat, h.pit, null); continue; }
      const top = x => x && !x.fut ? x : null;
      add(lg + '1', h, top(h.bat), top(h.pit), h.war, h.def, h.inj);
      add(lg + '2', h, h.futBat || (h.bat && h.bat.fut ? h.bat : null), h.futPit || (h.pit && h.pit.fut ? h.pit : null), null);
      add(lg + 'PS', h, h.psBat, h.psPit, null);
    }
    // 28차: 국가대표 — 대회 한 번이 한 줄 (팀 칸에 대회명·성적)
    for (const t of (st.car.intlRec || [])) add('NAT', { year: t.year, age: t.age, team: `${t.name} · ${t.result}` }, t.bat, t.pit, null);
    return COMP_ORDER.filter(k => C[k]).map(k => C[k]);
  }
  const sumLines = (arr, key) => arr.reduce((a, r) => { const s = r[key]; if (s) for (const k in s) if (typeof s[k] === 'number') a[k] = (a[k] || 0) + s[k]; return a; }, {});
  function batTable(rows, label, withWar) {
    const list = rows.filter(r => r.bat);
    if (!list.length) return '';
    const tot = sumLines(list, 'bat'), warT = list.reduce((a, r) => a + (r.war || 0), 0);
    const hasDef = list.some(r => r.def), defT = sumLines(list, 'def');
    const dcell = d => hasDef ? (d ? `<td>${d.DEF > 0 ? '+' : ''}${f1(d.DEF)}</td><td>${d.E}</td><td>${d.CH ? r3((d.CH - d.E) / d.CH) : '-'}</td>` : '<td>-</td><td>-</td><td>-</td>') : '';
    const line = (b, first, second, war, d) => `<tr><td>${first}</td><td>${second}</td><td>${b.G || '-'}</td><td>${b.PA}</td><td>${r3(Sim.AVG(b))}</td><td>${b.H}</td><td>${b.HR}</td><td>${b.RBI}</td><td>${b.R || 0}</td><td>${b.SB || 0}</td><td>${b.BB}</td><td>${b.K}</td><td>${r3(Sim.OBP(b))}</td><td>${r3(Sim.SLG(b))}</td><td>${r3(Sim.OPS(b))}</td>${dcell(d)}${withWar ? `<td>${war == null ? '-' : f1(war)}</td>` : ''}</tr>`;
    return `<h4 class="sub-h">${label}</h4><div class="tbl-scroll"><table class="lg rec"><tr><th>연도</th><th>팀</th><th>경기</th><th>타석</th><th>타율</th><th>안타</th><th>홈런</th><th>타점</th><th>득점</th><th>도루</th><th>볼넷</th><th>삼진</th><th>출루율</th><th>장타율</th><th>OPS</th>${hasDef ? '<th>수비 기여</th><th>실책</th><th>수비율</th>' : ''}${withWar ? '<th>WAR</th>' : ''}</tr>
      ${list.map(r => line(r.bat, r.year, esc(r.team), r.war, r.def)).join('')}${list.length > 1 ? line(tot, '합계', `${list.length}시즌`, withWar ? warT : null, hasDef && defT.CH ? defT : null).replace('<tr>', '<tr class="tot">') : ''}</table></div>`;
  }
  function pitTable(rows, label, withWar) {
    const list = rows.filter(r => r.pit);
    if (!list.length) return '';
    const tot = sumLines(list, 'pit'), warT = list.reduce((a, r) => a + (r.war || 0), 0);
    const line = (s, first, second, war) => `<tr><td>${first}</td><td>${second}</td><td>${s.G || 0}</td><td>${s.GS || 0}</td><td>${s.W || 0}</td><td>${s.L || 0}</td><td>${s.SV || 0}</td><td>${s.HLD || 0}</td><td>${ip(s)}</td><td>${f2(Sim.ERA(s))}</td><td>${s.K}</td><td>${s.BB}</td><td>${s.H}</td><td>${s.HR}</td><td>${f2(s.outs ? (s.BB + s.H) * 3 / s.outs : 0)}</td>${withWar ? `<td>${war == null ? '-' : f1(war)}</td>` : ''}</tr>`;
    return `<h4 class="sub-h">${label}</h4><div class="tbl-scroll"><table class="lg rec"><tr><th>연도</th><th>팀</th><th>경기</th><th>선발</th><th>승</th><th>패</th><th>세이브</th><th>홀드</th><th>이닝</th><th>ERA</th><th>탈삼진</th><th>볼넷</th><th>피안타</th><th>피홈런</th><th>WHIP</th>${withWar ? '<th>WAR</th>' : ''}</tr>
      ${list.map(r => line(r.pit, r.year, esc(r.team), r.war)).join('')}${list.length > 1 ? line(tot, '합계', `${list.length}시즌`, withWar ? warT : null).replace('<tr>', '<tr class="tot">') : ''}</table></div>`;
  }
  function tabComp(st) {
    const comps = compData(st);
    if (!comps.length) return `<div class="panel muted small">아직 기록이 없다.</div>`;
    const cur = comps.find(c => c.key === App.compKey) || comps[comps.length - 1];
    App.compKey = cur.key;
    const war = /1$/.test(cur.key);
    const nat = cur.key === 'NAT';
    return `<div class="lg-pick">${comps.map(c => `<button class="${c.key === cur.key ? 'on' : ''}" data-act="compkey" data-v="${c.key}">${COMP_NAME[c.key]}</button>`).join('')}</div>
      <div class="panel"><h3>${COMP_NAME[cur.key]} · ${nat ? '대회별 기록' : '시즌별 기록'}</h3>${[batTable(cur.rows, '타격', war), pitTable(cur.rows, '투구', war)].map(h => nat ? h.replace('<th>팀</th>', '<th>대회</th>').replace(/(\d+)시즌<\/td>/, '$1개 대회</td>') : h).join('')}</div>`;
  }

  // ---------- 통산 (합산 기록·우승·구단별) ----------
  function tabTotal(st) {
    const me = st.me, car = st.car;
    const pro = st.hist.filter(h => !['HS', 'UNIV', 'IND', 'MIL'].includes(histLg(h)));
    const topRows = pro.map(h => ({ year: h.year, team: `${h.team}${histLg(h) !== 'KBO' ? ` (${histLg(h)})` : ''}`, bat: h.bat && !h.bat.fut && (h.bat.PA || h.inj) ? h.bat : null, pit: h.pit && !h.pit.fut && (h.pit.outs || h.inj) ? h.pit : null, war: h.war, def: h.def || null }));
    // 구단별
    const byTeam = [];
    const amRows = st.hist.filter(h => ['HS', 'UNIV', 'IND', 'MIL'].includes(histLg(h))).map(h => ({ year: h.year, team: histLg(h) === 'HS' ? '고교 야구부' : histLg(h) === 'IND' ? '독립리그' : histLg(h) === 'MIL' ? h.team : `${h.team} (대학)`, bat: h.bat && h.bat.PA ? h.bat : null, pit: h.pit && h.pit.outs ? h.pit : null, war: null }));
    for (const r of amRows.concat(topRows)) { let t = byTeam.find(x => x.team === r.team); if (!t) byTeam.push(t = { team: r.team, rows: [] }); t.rows.push(r); }
    const titles = (car.awList || []).filter(awKeep).filter(a => /우승/.test(a));
    const amTitles = [];
    for (const h of st.hist) { (h.tourn || []).filter(x => / 우승$/.test(x)).forEach(x => amTitles.push(`${h.year} ${x} (고교)`)); if (/\(우승\)/.test(h.record || '')) amTitles.push(`${h.year} 대학리그 우승 (${h.team})`); }
    const awards = (car.awList || []).filter(awKeep).filter(a => !/우승/.test(a));
    const teamBlock = byTeam.map(t => {
      const yrs = t.rows.map(r => r.year), war = t.rows.reduce((a, r) => a + (r.war || 0), 0);
      const tTitles = titles.filter(a => (car.titles || []).some(x => a.startsWith(String(x.year)) && t.team.startsWith(x.team)));
      return `<details class="team-car" open><summary><b>${esc(t.team)}</b> <span class="muted small">${Math.min(...yrs)}~${Math.max(...yrs)} · ${t.rows.length}시즌${t.rows.some(r => r.war != null) ? ` · WAR ${f1(war)}` : ''}${tTitles.length ? ` · 우승 ${tTitles.length}회` : ''}</span></summary>${batTable(t.rows, '타격', t.rows.some(r => r.war != null))}${pitTable(t.rows, '투구', t.rows.some(r => r.war != null))}</details>`;
    }).join('');
    const tb = car.bat, tp = car.pit;
    const box = (v, k) => `<div><b>${v}</b><span>${k}</span></div>`;
    const batBox = tb && tb.PA ? `<div class="season-sum">${box(r3(Sim.AVG(tb)), '타율')}${box(tb.H, '안타')}${box(tb.HR, '홈런')}${box(tb.RBI, '타점')}</div><div class="season-sum">${box(tb.SB, '도루')}${box(r3(Sim.OBP(tb)), '출루율')}${box(r3(Sim.SLG(tb)), '장타율')}${box(r3(Sim.OPS(tb)), 'OPS')}</div>` : '';
    const pitBox = tp && tp.outs ? `<div class="season-sum">${box(tp.W + '-' + tp.L, '승-패')}${box(tp.SV, '세이브')}${box(ip(tp), '이닝')}${box(f2(Sim.ERA(tp)), 'ERA')}</div><div class="season-sum">${box(tp.K, '탈삼진')}${box(tp.HLD || 0, '홀드')}${box(f2(tp.outs ? (tp.BB + tp.H) * 3 / tp.outs : 0), 'WHIP')}${box(tp.G, '경기')}</div>` : '';
    return `<div class="panel"><h3>구단별 기록</h3>${teamBlock || '<div class="muted small">아직 기록이 없다.</div>'}${byTeam.length ? `<div class="tiny muted" style="margin-top:6px">구단 이름을 누르면 접고 펼 수 있다 · 각 구단의 시즌별 기록과 합계</div>` : ''}</div>
      <div class="panel"><h3>프로 1군 통산</h3>
        <div class="season-sum">${box(pro.length, '프로 시즌')}${box(f1(car.war), '통산 WAR')}${box(car.aw.MVP, 'MVP')}${box(car.aw.KS, '우승')}</div>
        ${batBox}${pitBox}${!batBox && !pitBox ? '<div class="muted small">아직 1군 기록이 없다.</div>' : ''}
        ${car.ps && (car.ps.bat.PA || car.ps.pit.outs) ? `<div class="small muted" style="margin-top:6px">포스트시즌 통산: ${[car.ps.bat.PA ? Sim.fmtBatShort(car.ps.bat) : '', car.ps.pit.outs ? Sim.fmtPitShort(car.ps.pit) : ''].filter(Boolean).map(esc).join(' / ')}</div>` : ''}</div>
      ${hofPanel(st)}
      ${natPanel(st)}
      <div class="panel"><h3>우승 기록</h3>${titles.length || amTitles.length ? `<div class="aw-list">${titles.concat(amTitles).map(a => `<div class="small">🏆 ${esc(a)}</div>`).join('')}</div>` : '<div class="muted small">아직 우승이 없다.</div>'}</div>
      <div class="panel"><h3>수상</h3>${awards.length ? `<div class="stamps sm">${awards.map(a => `<span class="stamp ${/MVP|골든/.test(a) ? 'gold' : ''}">${esc(a)}</span>`).join('')}</div>` : '<div class="muted small">아직 수상이 없다.</div>'}</div>`;
  }
  // 62차: 명예의 전당 기준 — 목록 중 2개 이상을 채워야 헌액
  function hofPanel(st) {
    const me = st.me, B = me.role === 'B' || me.twoWay, P = me.role === 'P' || me.twoWay, tw = !!(me.twoWay || me.twoWayChosen);
    const G = Sim.hofGoals(st).filter(g => !g.k || (g.k === 'B' && B) || (g.k === 'P' && P) || (g.k === 'tw' && tw));
    const need = Sim.BAL.hof.need || 2, n = G.filter(g => g.ok).length;
    return `<div class="panel"><h3>명예의 전당 기준 <span class="tiny muted">${need}개 이상 달성하면 은퇴 때 헌액</span></h3>
      <div class="small" style="margin-bottom:6px">달성 <b>${n}</b> / ${need} ${n >= need ? '<span class="stamp gold" style="margin-left:4px">헌액 기준 충족</span>' : ''}</div>
      <div class="kv-list">${G.map(g => `<div><span>${g.ok ? '✅' : '⬜'} ${esc(g.t)}</span><b>${esc(g.cur)}</b></div>`).join('')}</div></div>`;
  }
  // 28차: 역대 커리어 — 국가대표 통산
  function natPanel(st) {
    const car = st.car, rec = car.intlRec || [];
    const old = (car.intl || []).filter(s => !rec.some(t => s.startsWith(`${t.year} ${t.name}`)));   // 28차 이전 저장분은 결과만 남아 있다
    if (!rec.length && !old.length) return `<div class="panel"><h3>국가대표</h3><div class="muted small">아직 태극마크를 단 적이 없다.</div></div>`;
    const res = rec.map(t => t.result).concat(old.map(s => s.split(' ').pop()));
    const medals = res.filter(x => /메달|우승/.test(x));
    const golds = res.filter(x => /금메달|^우승/.test(x));
    const aw = rec.reduce((a, t) => a + t.awards.length, 0);
    const tb = sumLines(rec, 'bat'), tp = sumLines(rec, 'pit');
    const box = (v, k) => `<div><b>${v}</b><span>${k}</span></div>`;
    const stat = [tb.PA ? `타격 ${r3(Sim.AVG(tb))} · ${tb.H}안타 ${tb.HR}홈런 ${tb.RBI}타점 · OPS ${r3(Sim.OPS(tb))} (${tb.PA}타석)` : '', tp.outs ? `투구 ${ip(tp)}이닝 ERA ${f2(Sim.ERA(tp))} · ${tp.K}탈삼진${tp.W ? ` · ${tp.W}승` : ''}` : ''].filter(Boolean);
    const list = rec.map(t => `<div class="small">${/금메달|^우승/.test(t.result) ? '🥇' : /은메달|준우승/.test(t.result) ? '🥈' : /동메달/.test(t.result) ? '🥉' : '🇰🇷'} ${t.year} ${esc(t.name)} — <b>${esc(t.result)}</b>${t.rank ? ` <span class="muted">(${t.rank}위/${t.field}개국)</span>` : ''}${t.awards.length ? ` · <span style="color:var(--gold)">${t.awards.map(esc).join(', ')}</span>` : ''}</div>`)
      .concat(old.map(s => `<div class="small">🇰🇷 ${esc(s)}</div>`)).join('');
    return `<div class="panel"><h3>국가대표</h3>
      <div class="season-sum">${box(rec.length + old.length, '출전 대회')}${box(golds.length, '금·우승')}${box(medals.length, '메달')}${box(aw, '대회 개인상')}</div>
      ${stat.length ? `<div class="small muted" style="margin:6px 0">${stat.map(esc).join('<br>')}</div>` : ''}
      <div class="aw-list">${list}</div></div>`;
  }
  // 52차: 포스팅 신청은 '인생' 탭의 은퇴하기 바로 아래
  function postBox(st) {
    return Sim.canPost(st) ? `<div class="panel small post-box"><b>해외 진출 · 포스팅</b><div class="muted tiny" style="margin:4px 0 8px">신청하면 해외 구단 응찰을 받는다. 능력치·최근 성적이 모자라면 아무 데서도 응찰하지 않을 수 있다. 비시즌에 한 번.</div><button class="btn block" data-act="post">포스팅 신청</button></div>` : '';
  }
  function tabStory(st) {
    return `${st.done ? '' : `<div class="panel small retire-box"><div class="row"><div><b>은퇴하기</b><div class="tiny muted">지금 유니폼을 벗고 바로 은퇴 결산(엔딩)으로 넘어간다.</div></div><span class="spacer"></span><button class="btn small red" data-act="retire-now">은퇴하기</button></div></div>`}
      ${postBox(st)}
      <div class="panel"><h3>인생 이야기</h3>${st.story.slice().reverse().map(s => `<div class="story-item"><span class="y">${s.year}<br>${s.age}세</span><span>${esc(s.text)}</span></div>`).join('')}</div>`;
  }
  // ---------- 기록 계산 (타자·투수) ----------
  const dv0 = (a, b) => b ? a / b : 0;
  const BS = {   // 타자: [키, 이름, 값, 표시, 규정타석 필요, 낮을수록 좋음]
    cols: [
      ['OPS', 'OPS', r => dv0(r.H + r.BB, r.PA) + dv0(r.H + r.D + 2 * r.T + 3 * r.HR, r.AB), r3, 1],
      ['AVG', '타율', r => dv0(r.H, r.AB), r3, 1], ['H', '안타', r => r.H], ['HR', '홈런', r => r.HR], ['RBI', '타점', r => r.RBI], ['R', '득점', r => r.R],
      ['OBP', '출루율', r => dv0(r.H + r.BB, r.PA), r3, 1], ['SLG', '장타율', r => dv0(r.H + r.D + 2 * r.T + 3 * r.HR, r.AB), r3, 1],
      ['G', '경기', r => r.G], ['AB', '타수', r => r.AB], ['K', '삼진', r => r.K], ['BBK', 'BB/K', r => dv0(r.BB, r.K), f2, 1], ['SB', '도루', r => r.SB],
      ['ISO', 'ISO', r => dv0(r.H + r.D + 2 * r.T + 3 * r.HR, r.AB) - dv0(r.H, r.AB), r3, 1], ['BABIP', 'BABIP', r => dv0(r.H - r.HR, r.AB - r.K - r.HR), r3, 1],
      ['DEF', '수비 기여', r => r.DEF || 0, v => (v > 0 ? '+' : '') + f1(v)], ['E', '실책', r => r.E || 0, null, 1, 1], ['FPCT', '수비율', r => r.CH ? (r.CH - r.E) / r.CH : 0, r3, 1],
      ['WAR', 'WAR', r => r.war, f1],
    ],
    qual: (r, g) => r.PA >= 3.1 * g,
  };
  const PS = {
    cols: [
      ['ERA', 'ERA', r => dv0(r.ER * 27, r.outs), f2, 1, 1], ['G', '경기', r => r.G], ['W', '승리', r => r.W], ['L', '패', r => r.L], ['SV', '세이브', r => r.SV], ['HLD', '홀드', r => r.HLD],
      ['IP', '이닝', r => r.outs, v => Math.floor(v / 3) + (v % 3 ? '.' + v % 3 : '')], ['SHO', '완봉', r => r.SHO], ['CG', '완투', r => r.CG], ['K', '탈삼진', r => r.K], ['BB', '볼넷', r => r.BB],
      ['H', '피안타', r => r.H], ['HR', '피홈런', r => r.HR], ['WHIP', 'WHIP', r => dv0((r.BB + r.H) * 3, r.outs), f2, 1, 1],
      ['K9', 'K/9', r => dv0(r.K * 27, r.outs), f2, 1], ['BB9', 'BB/9', r => dv0(r.BB * 27, r.outs), f2, 1, 1], ['HR9', 'HR/9', r => dv0(r.HR * 27, r.outs), f2, 1, 1],
      ['KBB', 'K/BB', r => dv0(r.K, r.BB), f2, 1], ['BABIP', 'BABIP', r => dv0(r.H - r.HR, r.BF - r.K - r.HR - r.BB), r3, 1, 1],
      ['FIP', 'FIP', (r, c) => dv0((13 * r.HR + 3 * r.BB - 2 * r.K) * 3, r.outs) + c, f2, 1, 1], ['WAR', 'WAR', r => r.war, f1],
    ],
    qual: (r, g) => r.outs >= 3 * g,
  };
  // 기록 표: kind 'bat'|'pit', 정렬 키, 규정 적용 여부, 최대 행 수
  function recTable(st, S, kind, rows, sortKey, opt) {
    const D = kind === 'bat' ? BS : PS;
    const col = D.cols.find(c => c[0] === sortKey) || (opt.qualify ? D.cols[0] : [null]);
    const g = S.games, cF = S.cFIP || 0;
    let list = rows.slice();
    if (opt.qualify && col[4]) list = list.filter(r => D.qual(r, g) && ((col[0] !== 'E' && col[0] !== 'FPCT') || r.CH > 0));
    if (col[0]) list.sort((a, b) => col[5] ? col[2](a, cF) - col[2](b, cF) : col[2](b, cF) - col[2](a, cF));
    if (opt.limit) list = list.slice(0, opt.limit);
    const fmt = (c, r) => { const v = c[2](r, cF); return c[3] ? c[3](v) : Math.round(v); };
    const head = D.cols.map(c => `<th class="${c[0] === col[0] ? 'sort' : ''}" data-act="${opt.act}" data-v="${c[0]}">${c[1]}</th>`).join('');
    const body = list.map((r, i) => `<tr class="${r.me ? 'me' : ''}"><td>${opt.rank ? i + 1 : ''}</td><td>${esc(r.n)}${r.f ? '<span class="tiny muted">(외)</span>' : ''}${opt.team ? `<div class="tiny muted">${esc(Sim.teamName(st, r.t))}</div>` : `<div class="tiny muted">${esc(Sim.POSNAME[r.pos] || r.pos)} · ${r.age}세${App.dev && r.ovr != null ? ` · OVR ${Sim.disp(r.ovr)}` : ''}</div>`}</td>${D.cols.map(c => `<td class="${c[0] === col[0] ? 'sort' : ''}">${fmt(c, r)}</td>`).join('')}</tr>`).join('');
    return `<div class="tbl-scroll"><table class="lg rec"><tr><th>${opt.rank ? '#' : ''}</th><th>선수</th>${head}</tr>${body || `<tr><td colspan="${D.cols.length + 2}" class="muted">${opt.qualify && col[4] ? '규정 기록을 채운 선수가 없다' : '기록 없음'}</td></tr>`}</table></div>
      <div class="tiny muted" style="margin-top:4px">머리글을 누르면 그 기록으로 정렬${col[4] && opt.qualify ? ` · 비율 기록은 규정${kind === 'bat' ? `타석(${Math.round(3.1 * g)})` : `이닝(${g})`} 이상만` : ''}</div>`;
  }
  function standingsHTML(st, L, cfg) {
    const myT = st.me.team, mineU = st.me.univTeam, psSet = new Set((L.post && L.post.seeds) || []);
    const groups = cfg.two ? cfg.two.map(s => [s, L.standings.filter(x => x.sub === s)]) : [[null, L.standings]];
    return groups.map(([gname, list]) => `${gname ? `<h4 class="sub-h">${esc(gname)}</h4>` : ''}<table class="lg click"><tr><th>#</th><th>구단</th><th>승</th><th>패</th><th>승률</th><th></th></tr>${list.map((s, i) => `<tr class="${s.id === myT || s.id === mineU || s.id === 'F_' + myT ? 'me' : ''} ${App.lgTeam === s.id ? 'sel' : ''}" data-act="lgteam" data-v="${s.id}"><td>${gname ? i + 1 : s.rank}</td><td>${esc(s.name)} <span class="tiny muted">›</span></td><td>${s.wins}</td><td>${s.losses}</td><td>${r3(s.pct)}</td><td>${psSet.has(s.id) ? '<span class="ps-tag">PS</span>' : ''}</td></tr>`).join('')}</table>`).join('');
  }
  function tabLeague(st) {
    const list = Sim.leagueList(st);
    const cur = list.find(x => x.id === App.lgId) || list.find(x => x.mine) || list[0];
    App.lgId = cur.id;
    const { L, cfg } = cur;
    const pick = `<div class="lg-pick">${list.map(x => `<button class="${x.id === cur.id ? 'on' : ''}" data-act="lgid" data-v="${x.id}">${esc(x.cfg.short)}${x.mine ? ' <i>●</i>' : ''}</button>`).join('')}</div>`;
    if (!L.standings) return `${pick}<div class="panel muted small">첫 시즌이 끝나면 ${esc(cfg.name)} 기록이 열린다.</div>`;
    const yr = L.year || (st.year - 1);
    const post = L.post && L.post.rounds.length ? L.post.rounds.map(r => `${esc(r.name)}: <b>${esc(Sim.teamName(st, r.win))}</b> ${r.score} <span class="muted">vs ${esc(Sim.teamName(st, r.lose))}</span>`).join('<br>') : (L.post ? `우승: <b>${esc(Sim.teamName(st, L.post.champion))}</b> (정규시즌 1위)` : '');
    const S = L.stats;
    const kind = App.recKind || 'bat';
    const sortKey = kind === 'bat' ? (App.recBat || 'OPS') : (App.recPit || 'ERA');
    const recs = S ? `<div class="seg" style="margin-bottom:8px">${[['bat', '타자'], ['pit', '투수']].map(([k, t]) => `<button class="${kind === k ? 'on' : ''}" data-act="reckind" data-v="${k}">${t} 기록실</button>`).join('')}</div>${recTable(st, S, kind, S[kind], sortKey, { qualify: true, limit: 20, rank: true, team: true, act: 'recsort' })}` : '<div class="muted small">기록 없음</div>';
    const teamPanel = App.lgTeam && L.teams.some(t => t.id === App.lgTeam) ? teamRoster(st, L, App.lgTeam) : '';
    return `${pick}
      <div class="panel"><h3>${yr} ${esc(cfg.name)} 순위</h3>${standingsHTML(st, L, cfg)}<div class="tiny muted" style="margin-top:4px">구단을 누르면 소속 선수 기록이 열린다</div><div class="small" style="margin-top:10px">${post}</div></div>
      ${teamPanel}
      <div class="panel"><h3>기록실 TOP 20</h3>${recs}</div>
      ${L.awards ? `<div class="panel"><h3>시상</h3>${awardsHTML(st, L.awards)}</div>` : ''}`;
  }
  // 수상자 주요 기록: 해당 부문 기록을 앞에, 나머지 대표 기록과 WAR를 뒤에
  function awardLine(e, focus) {
    if (!e) return '';
    const parts = [];
    if (e.pit && e.pit.outs && (!e.bat || !e.bat.PA || /다승|평균자책|세이브|투수/.test(focus || ''))) {
      const p = e.pit;
      const main = { '다승왕': `${p.W}승`, '평균자책점왕': `ERA ${f2(Sim.ERA(p))}`, '세이브왕': `${p.SV || 0}세이브` }[focus];
      if (main) parts.push(`<b>${main}</b>`);
      parts.push(`${p.W}승 ${p.L}패${p.SV ? ` ${p.SV}세이브` : ''} ${ip(p)}이닝 ERA ${f2(Sim.ERA(p))} ${p.K}K`);
    }
    if (e.bat && e.bat.PA && !(e.pit && e.pit.outs && /다승|평균자책|세이브|투수/.test(focus || ''))) {
      const b = e.bat;
      const main = { '타격왕': `타율 ${r3(Sim.AVG(b))}`, '안타왕': `${b.H}안타`, '홈런왕': `${b.HR}홈런`, '타점왕': `${b.RBI}타점` }[focus];
      if (main) parts.push(`<b>${main}</b>`);
      parts.push(`${r3(Sim.AVG(b))} ${b.HR}홈런 ${b.RBI}타점 OPS ${r3(Sim.OPS(b))}`);
    }
    parts.push(`WAR ${f1(e.war)}`);
    return `<div class="aw-line tiny">${parts.filter((x, i, a) => a.indexOf(x) === i).join(' · ')}</div>`;
  }
  function awardsHTML(st, aw) {
    const row = (title, e, focus) => e ? `<div class="aw-item ${e.me ? 'me' : ''}"><span class="aw-t">${esc(title)}</span><div><b>${esc(e.name)}</b> <span class="muted small">${esc(Sim.teamName(st, e.team))}</span>${awardLine(e, focus || title)}</div></div>` : '';
    const gg = aw.gg ? Object.entries(aw.gg).flatMap(([pos, list]) => (list || []).filter(Boolean).map(e => row(`골든글러브 ${pos === 'P' ? '투수' : Sim.POSNAME[pos] || pos}`, e, pos === 'P' ? '투수' : ''))).join('') : '';
    return `<div class="aw-list">${row('MVP', aw.mvp)}${row('신인왕', aw.roy)}${Object.entries(aw.titles).map(([k, e]) => row(k, e, k)).join('')}</div>
      ${gg ? `<details class="aw-gg"><summary class="small">골든글러브 수상자 보기</summary><div class="aw-list">${gg}</div></details>` : ''}`;
  }
  // 구단 선수 기록 (시즌 종료 시점 명단)
  function teamRoster(st, L, id) {
    const S = L.stats, name = Sim.teamName(st, id);
    if (!S) return `<div class="panel"><h3>${esc(name)}</h3><div class="muted small">다음 시즌이 끝나면 선수 기록이 쌓인다.</div></div>`;
    const bats = S.bat.filter(r => r.t === id).sort((a, b) => b.PA - a.PA);
    const pits = S.pit.filter(r => r.t === id).sort((a, b) => b.GS - a.GS || b.outs - a.outs);
    return `<div class="panel"><div class="row"><h3 style="margin:0">${esc(name)} · ${S.year} 시즌 선수 기록</h3><span class="spacer"></span><button class="btn small" data-act="lgteam" data-v="">닫기</button></div>
      <div class="tiny muted" style="margin:6px 0">타자 ${bats.length}명 · 투수 ${pits.length}명${App.dev ? ' · 관리자: OVR 표시' : ''}</div>
      <h4 class="sub-h">타자</h4>${recTable(st, S, 'bat', bats, App.rosBat || 'PA_', { act: 'rossort-b' })}<h4 class="sub-h">투수</h4>${recTable(st, S, 'pit', pits, App.rosPit || 'GS_', { act: 'rossort-p' })}</div>`;
  }
  function statBoxes(res) {
    const box = (v, k) => `<div><b>${v}</b><span>${k}</span></div>`;
    const b = res.bat, p = res.pit, fb = res.futBat, fp = res.futPit;
    const isAm = res.stage !== 'pro';
    let html = '';
    const batRow = (s, war, label) => `${label ? `<div class="tiny muted" style="margin:6px 0 4px">${label}</div>` : ''}<div class="statline">${box(r3(Sim.AVG(s)), '타율')}${box(s.HR, '홈런')}${box(s.RBI, '타점')}${box(r3(Sim.OPS(s)), 'OPS')}${war == null ? box(s.PA, '타석') : box(f1(war), 'WAR')}</div>`;
    const pitRow = (s, war, label) => `${label ? `<div class="tiny muted" style="margin:6px 0 4px">${label}</div>` : ''}<div class="statline">${box(f2(Sim.ERA(s)), 'ERA')}${box((s.W || 0) + '-' + (s.L || 0), '승-패')}${s.SV ? box(s.SV, '세이브') : s.HLD ? box(s.HLD, '홀드') : box(s.K, '탈삼진')}${box(ip(s), '이닝')}${war == null ? box(s.K, 'K') : box(f1(war), 'WAR')}</div>`;
    if (b && b.PA) html += batRow(b, isAm ? null : (res.warB != null ? res.warB : res.war), (p && p.outs) ? '타격' : '');
    if (p && p.outs) html += pitRow(p, isAm ? null : (res.warP != null ? res.warP : res.war), (b && b.PA) ? '투구' : '');
    if (!html && (fb || fp)) {
      const mn = res.minor || '2군(퓨처스)';
      if (fb && fb.PA) html += batRow(fb, null, mn);
      if (fp && fp.outs) html += pitRow(fp, null, mn);
    } else {
      const mn = (res.minor || '2군(퓨처스)').replace(/^2군\((.+)\)$/, '$1');
      if (fb && fb.PA >= 40) html += `<div class="tiny muted" style="margin-top:6px">${esc(mn)}: ${Sim.fmtBatShort(fb)}</div>`;
      if (fp && fp.outs >= 30) html += `<div class="tiny muted" style="margin-top:6px">${esc(mn)}: ${Sim.fmtPitShort(fp)}</div>`;
    }
    return html || '<div class="muted small">출전 기록 없음</div>';
  }

  // ================================================================
  // 시즌 결과
  // ================================================================
  function viewResult() {
    const st = App.st, res = App.res, me = st.me;
    const shownKeys = me.twoWay ? Sim.ALL : Sim.mainKeys(me);
    const ch = Object.entries(res.changes || {}).filter(([k]) => shownKeys.indexOf(k) >= 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const team = res.team;
    const ps = res.psLine;
    let psTxt = '';
    if (res.post) {
      const champ = Sim.teamName(st, res.post.champion);
      psTxt = ps ? `포스트시즌: <b>${esc(ps.result)}</b>${ps.bat && ps.bat.PA ? ` · ${ps.bat.PA}타석 ${r3(Sim.AVG(ps.bat))} ${ps.bat.HR}홈런` : ''}${ps.pit && ps.pit.outs ? ` · ${ip(ps.pit)}이닝 ERA ${f2(Sim.ERA(ps.pit))}` : ''}` : `${esc(res.post.champName || '한국시리즈')} 우승: ${esc(champ)}`;
    }
    const rv = res.rivalLine;
    return `
      <div class="topbar"><span class="title">${res.stage === 'pro' ? '시즌 결산' : '시즌 결과'}</span><span class="spacer"></span>${devToggle()}</div>
      <div class="panel reveal">
        <div class="res-head"><h2>${res.year}</h2><span class="muted">${res.age}세 · ${res.stage === 'hs' ? '고교' : res.stage === 'univ' ? '대학' : res.stage === 'indie' ? '독립리그' : res.stage === 'mil' ? '군 복무' : '프로'}</span></div>
        <div class="status-line">${esc(res.statusText || '')}</div>
        <div style="margin-top:12px">${statBoxes(res)}</div>${res.def ? `<div class="small muted" style="margin-top:6px">수비: 기여 <b style="color:var(--ink)">${res.def.DEF > 0 ? '+' : ''}${f1(res.def.DEF)}점</b> · 실책 ${res.def.E} · 수비율 ${r3((res.def.CH - res.def.E) / res.def.CH)}</div>` : ''}
        ${res.awards.length || res.ms.length ? `<div class="stamps">${res.awards.map(a => `<span class="stamp ${/MVP|우승|골든/.test(a) ? 'gold' : /각성|전성기|커리어 하이/.test(a) ? 'peak' : ''}">${esc(a)}</span>`).join('')}${res.ms.map(m => `<span class="ribbon">통산 ${esc(m)}</span>`).join('')}</div>` : ''}
      </div>
      ${res.peak ? `<div class="panel reveal peak-banner ${res.peak.phase}"><div class="peak-title">${esc(res.peak.title)}</div><div class="peak-text">${esc(res.peak.text)}</div></div>` : ''}
      ${team ? `<div class="panel reveal"><h3>팀</h3><div><b>${esc(team.name)}</b> <span class="muted">${esc(team.record || '')}</span></div>${team.tourn && team.tourn.length ? `<div class="small muted" style="margin-top:4px">${team.tourn.map(esc).join(' · ')}</div>` : ''}${psTxt ? `<div class="small" style="margin-top:6px">${psTxt}</div>` : ''}</div>` : ''}
      ${res.leaderLine || rv ? `<div class="panel reveal"><h3>리그 속의 나</h3>${res.leaderLine ? `<div class="small">${esc(res.leaderLine)}</div>` : ''}${rv ? `<div class="vs" style="margin-top:10px"><div><b>${esc(me.name)}</b><div class="tiny muted">WAR ${f1(rv.myWar || 0)}</div></div><div class="mid">VS</div><div class="r"><b>${esc(rv.name)}</b> <span class="tiny muted">${esc(rv.team)}</span><div class="tiny muted">${esc(rv.line)} · WAR ${f1(rv.war)}</div></div></div>` : ''}</div>` : ''}
      <div class="panel reveal"><h3>능력치 변화</h3>${ch.length ? `<div class="changes">${ch.map(([k, d]) => `<span class="chg ${d > 0 ? 'up' : 'down'}">${Sim.LABEL[k]} ${d > 0 ? '+' : ''}${Sim.dispD(d)}</span>`).join('')}</div>` : '<div class="muted small">변화 없음</div>'}
        <div class="small muted" style="margin-top:8px">오버롤 ${Sim.disp(res.ovr)}${res.ovrD ? ` <i class="dv ${res.ovrD > 0 ? 'up' : 'down'}">${res.ovrD > 0 ? '▲' : '▼'}${Math.abs(Sim.dispD(res.ovrD))}</i>` : ''}${res.scout ? ` · 스카우트 관심도: <b style="color:var(--ink)">${esc(res.scout)}</b>` : ''}${res.salary ? ` · 내년 연봉 ${Sim.man(res.salary)}` : ''}</div></div>
      ${res.intl && res.intl.length ? `<div class="panel reveal"><h3>국제대회</h3>${res.intl.map(t => `<div class="small" style="margin-top:4px"><b>${esc(t.name)}</b>${t.exempt ? ' <span class="tiny muted">(병역 혜택 대회)</span>' : ''} — ${t.selected ? (t.outcome ? (t.outcome === '소집 고사' ? '국가대표에 뽑혔지만 소집을 고사했다.' : `<b style="color:var(--gold)">국가대표 출전 · ${esc(t.outcome)}</b>`) : '<b style="color:var(--gold)">국가대표 발탁</b>') : `<span class="muted">선발 실패 · ${esc(t.why || '')}</span>`}</div>`).join('')}</div>` : ''}
      ${res.news && res.news.length ? `<div class="panel reveal"><h3>팬 반응</h3>${res.news.map(n => `<div class="news">${esc(n)}</div>`).join('')}</div>` : ''}
      ${App.dev ? `<div class="dev">계산 ${res.ms_time}ms · playCoef ${f2(res.playCoef || 0)} · 구간 ${(res.segs || []).join(',')}</div>` : ''}
      <div class="dock"><div class="in"><button class="btn go block" data-act="res-next">${st.done ? '은퇴 결산 보기' : st.pending.length ? `다음 (${st.pending.length}개의 결정)` : '다음 시즌으로'}</button></div></div>`;
  }

  // ================================================================
  // 로딩 (시즌 진행 연출)
  // ================================================================
  const LOAD_MSG = {
    pro: ['스프링캠프 출발', '시범경기 점검', '개막전', '전반기 일정 소화 중', '올스타 브레이크', '후반기 순위 싸움', '정규시즌 최종전'],
    hs: ['동계 훈련', '주말리그 개막', '전국대회 예선', '전국대회 본선', '시즌 마무리'],
    univ: ['동계 훈련', '대학리그 개막', '전국대학선수권', '시즌 마무리'],
    post: ['포스팅 공시', '구단 응찰 접수 중', '응찰 마감 임박', '결과 집계 중'],
    mil: ['입소', '훈련소 생활', '부대 배치', '전반기 일정', '후반기 일정', '시즌 마무리'],
    indie: ['입단 테스트 준비', '독립리그 개막', '원정 버스 이동 중', '시즌 마무리'],
  };
  function viewLoading() {
    const L = App.loading;
    const msgs = LOAD_MSG[L.stage] || LOAD_MSG.pro;
    const i = Math.min(msgs.length - 1, Math.floor(L.p * msgs.length));
    return `<div class="loading-screen">
      <div class="ld-year num">${L.year}</div>
      <div class="ld-sub">${L.stage === 'post' ? '포스팅 진행 중' : L.stage === 'pro' ? '정규시즌 진행 중' : '시즌 진행 중'}</div>
      <div class="ld-ball" aria-hidden="true"></div>
      <div class="ld-bar"><span style="width:${Math.round(L.p * 100)}%"></span></div>
      <div class="ld-msg">${esc(msgs[i])}…</div>
    </div>`;
  }
  // opts.pauseAt(0~1)에서 opts.onPause(resume)를 부르고 멈춘다 → resume()을 부르면 이어서 진행 (17차: 시즌 중 국가대표)
  function startLoading(onDone, stageOver, opts) {
    const st = App.st;
    opts = opts || {};
    App.loading = { year: opts.year || st.year, stage: stageOver || opts.stage || st.me.stage, p: 0 };
    App.view = 'loading'; render(); window.scrollTo(0, 0);
    const dur = stageOver ? 2000 : (opts.stage || st.me.stage) === 'pro' ? 2200 : 1500;
    let t0 = performance.now(), base = 0, paused = false;
    const tick = () => {
      if (App.view !== 'loading' || paused) return;
      App.loading.p = Math.min(1, base + (performance.now() - t0) / dur);
      const bar = document.querySelector('.ld-bar span'), msg = document.querySelector('.ld-msg');
      if (bar) bar.style.width = Math.round(App.loading.p * 100) + '%';
      if (msg) { const m = LOAD_MSG[App.loading.stage] || LOAD_MSG.pro; msg.textContent = m[Math.min(m.length - 1, Math.floor(App.loading.p * m.length))] + '…'; }
      if (opts.pauseAt != null && App.loading.p >= opts.pauseAt) {
        const pa = opts.pauseAt; opts.pauseAt = null; paused = true;
        opts.onPause(() => { App.view = 'loading'; App.loading.p = pa; render(); base = pa; t0 = performance.now(); paused = false; setTimeout(tick, 33); });
        return;
      }
      if (App.loading.p >= 1) { setTimeout(onDone, 250); return; }
      setTimeout(tick, 33);
    };
    setTimeout(tick, 33);
  }

  // ================================================================
  // 정규시즌 종료 → 포스트시즌(시리즈별) → 시즌 결산
  // ================================================================
  function viewRegular() {
    const st = App.st, res = App.res, me = st.me;
    const stand = res.league.standings, post = res.league.post;
    const cfg = Sim.LCFG[res.league.cid || 'KBO'];
    const myT = me.team;
    const mine = stand.find(s => s.id === myT);
    const inPS = mine && post && post.seeds.indexOf(myT) >= 0;
    const rk = mine ? (cfg.two ? `${mine.sub} ${mine.subRank}위` : `${mine.rank}위`) : '';
    return `
      <div class="topbar"><span class="title">정규시즌 종료</span><span class="spacer"></span>${devToggle()}</div>
      <div class="panel reveal">
        <div class="res-head"><h2>${res.year}</h2><span class="muted">${res.age}세 · ${esc(cfg.name)} ${cfg.games}경기</span></div>
        <div class="status-line">${esc(res.statusText || '')}</div>
        <div style="margin-top:12px">${statBoxes(res)}</div>${res.def ? `<div class="small muted" style="margin-top:6px">수비: 기여 <b style="color:var(--ink)">${res.def.DEF > 0 ? '+' : ''}${f1(res.def.DEF)}점</b> · 실책 ${res.def.E} · 수비율 ${r3((res.def.CH - res.def.E) / res.def.CH)}</div>` : ''}
        ${res.leaderLine ? `<div class="small" style="margin-top:10px">${esc(res.leaderLine)}</div>` : ''}
      </div>
      <div class="panel reveal"><h3>최종 순위</h3>
        ${standingsHTML(st, { standings: stand, post }, cfg)}
        <div class="small" style="margin-top:10px">${mine ? (inPS ? `<b>${esc(mine.name)}</b>, ${rk}로 가을야구 진출!` : `${esc(mine.name)}은(는) ${rk}. 올해 가을야구는 TV로 본다.`) : ''}</div>
      </div>
      <div class="dock"><div class="in"><button class="btn go block" data-act="ps-start">포스트시즌 시작 ▶</button><button class="btn block small ghost" data-act="ps-skip" style="margin-top:8px">포스트시즌 건너뛰고 결산 보기</button></div></div>`;
  }
  function teamTag(st, id, myT) { return `<span class="${id === myT ? 'my-team' : ''}">${esc(Sim.teamName(st, id))}</span>`; }
  function seriesHead(st, r) {
    return `${teamTag(st, r.hi, st.me.team)} <span class="tiny muted">${r.hiSeed}위</span> vs ${teamTag(st, r.lo, st.me.team)} <span class="tiny muted">${r.loSeed}위</span>`;
  }
  function viewPost() {
    const st = App.st, res = App.res, ps = App.ps;
    const post = res.league.post;
    const myT = st.me.team;
    const NEED = i => post.rounds[i].needTxt || '';
    const myLine = post.me;
    const rounds = post.rounds.map((r, i) => {
      if (i > ps.idx) {
        const known = post.rounds.slice(0, i).every(x => x.win !== r.lo && x.lose !== r.lo) && r.loSeed;
        return `<div class="ps-round wait"><div class="ps-name">${esc(r.name)} <span class="tiny muted">${NEED(i)}</span></div><div class="small muted">${teamTag(st, r.hi, myT)} <span class="tiny">${r.hiSeed}위</span> vs ${known ? `${teamTag(st, r.lo, myT)} <span class="tiny">${r.loSeed}위</span>` : '앞 시리즈 승자'}</div></div>`;
      }
      const shown = i < ps.idx ? r.games.length : ps.shown;
      let a = r.adv, b = 0;
      const games = r.games.slice(0, shown).map((g, gi) => {
        if (g.win === r.hi) a++; else b++;
        const hiRuns = g.win === r.hi ? g.runs[0] : g.runs[1], loRuns = g.win === r.hi ? g.runs[1] : g.runs[0];
        return `<div class="game ${gi === shown - 1 && i === ps.idx && ps.playing ? 'new' : ''}"><span class="tiny muted">${gi + 1}차전</span><span class="${g.win === r.hi ? 'w' : ''}">${esc(Sim.teamName(st, r.hi))} ${hiRuns}</span><span class="muted">:</span><span class="${g.win === r.lo ? 'w' : ''}">${loRuns} ${esc(Sim.teamName(st, r.lo))}</span></div>`;
      }).join('');
      const done = i < ps.idx;
      const mySeries = done && myLine ? myLine.series.find(s => s.round === i) : null;
      const myTxt = mySeries ? `<div class="ps-me small">${esc(st.me.name)}: ${[mySeries.bat && mySeries.bat.PA ? Sim.fmtBatShort(mySeries.bat) : '', mySeries.pit && mySeries.pit.outs ? Sim.fmtPitShort(mySeries.pit) : ''].filter(Boolean).map(esc).join(' / ') || '출전 기록 없음'}</div>` : '';
      return `<div class="ps-round ${done ? 'done' : 'cur'} ${(r.hi === myT || r.lo === myT) ? 'mine' : ''}">
        <div class="ps-name">${esc(r.name)} <span class="tiny muted">${NEED(i)}</span></div>
        <div class="small">${seriesHead(st, r)}</div>
        <div class="ps-score num">${a} - ${b}${r.adv ? ' <span class="tiny muted">(어드밴티지 포함)</span>' : ''}</div>
        ${games ? `<div class="games">${games}</div>` : ''}
        ${done ? `<div class="ps-res"><b>${esc(Sim.teamName(st, r.win))}</b> 시리즈 승리 (${Math.max(a, b)}-${Math.min(a, b)})${r.win === myT ? ' · 다음 라운드로!' : r.lose === myT ? ' · 우리 팀의 가을은 여기까지' : ''}</div>` : ''}
        ${myTxt}
        ${!done && !ps.playing ? `<button class="btn go block" data-act="ps-play" style="margin-top:10px">${esc(r.name)} 진행 ▶</button>` : ''}
      </div>`;
    }).join('');
    const over = ps.idx >= post.rounds.length;
    const champ = over ? `<div class="panel reveal champ-banner ${post.champion === myT ? 'mine' : ''}"><div class="tiny muted">${res.year} ${esc(post.champName || '한국시리즈')} 우승</div><div class="champ-name">${esc(Sim.teamName(st, post.champion))}</div>${post.champion === myT ? '<div class="small">우리가 해냈다! 우승 반지를 낀다.</div>' : myLine && myLine.result ? `<div class="small">우리 팀: ${esc(myLine.result)}</div>` : ''}</div>` : '';
    return `
      <div class="topbar"><span class="title">${res.year} 포스트시즌</span><span class="spacer"></span>${!over && !ps.playing ? '<button class="btn small" data-act="ps-all">한 번에 진행</button>' : ''}</div>
      ${champ}
      <div class="panel">${rounds}</div>
      <div class="dock"><div class="in">${over ? '<button class="btn go block" data-act="ps-done">시즌 결산 보기</button>' : `<button class="btn block" disabled>${ps.playing ? '경기 진행 중…' : '시리즈를 진행하세요'}</button>`}</div></div>`;
  }
  function psPlay() {
    const ps = App.ps, r = App.res.league.post.rounds[ps.idx];
    if (!r || ps.playing) return;
    ps.playing = true; ps.shown = 0; render();
    const step = () => {
      if (App.view !== 'post') return;
      ps.shown++;
      if (ps.shown >= r.games.length) { ps.shown = r.games.length; render(); setTimeout(() => { ps.playing = false; ps.idx++; ps.shown = 0; render(); }, 700); return; }
      render(); setTimeout(step, 650);
    };
    setTimeout(step, 450);
  }

  // ================================================================
  // 14차: 국제대회 결과 (경기별로 하나씩 공개)
  // ================================================================
  // 24차: 경기마다 1~9회 이닝별 점수(화면용). 최종 스코어를 이닝에 고정된 난수로 나눈다
  function inningSplit(total, seed) {
    let s = (seed * 2654435761) >>> 0; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    const a = Array(9).fill(0);
    for (let i = 0; i < total; i++) { const k = Math.min(8, Math.floor(rnd() * 9)); a[k]++; }
    return a;
  }
  function liveGame(r, idx, inn) {
    const g = r.games[idx];
    const kor = inningSplit(g.score[0], r.year * 31 + idx * 7 + 1), opp = inningSplit(g.score[1], r.year * 31 + idx * 7 + 2);
    const cell = (arr, i) => i < inn ? arr[i] : '';
    const sum = arr => arr.slice(0, inn).reduce((x, y) => x + y, 0);
    return `<div class="live-game"><div class="live-head"><b>${esc(g.stage)}</b> · vs ${esc(g.opp)} <span class="live-dot">●</span> <span class="tiny">${inn}회 진행 중</span></div>
      <table class="linescore"><tr><th></th>${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `<th class="${i === inn ? 'cur' : ''}">${i}</th>`).join('')}<th>R</th></tr>
      <tr><td>대한민국</td>${kor.map((v, i) => `<td class="${i === inn - 1 ? 'cur' : ''}">${cell(kor, i)}</td>`).join('')}<td><b>${sum(kor)}</b></td></tr>
      <tr><td>${esc(g.opp)}</td>${opp.map((v, i) => `<td class="${i === inn - 1 ? 'cur' : ''}">${cell(opp, i)}</td>`).join('')}<td><b>${sum(opp)}</b></td></tr></table></div>`;
  }
  function viewIntl() {
    const r = App.intlRes, n = App.intlShown, all = n >= r.games.length, me = App.st.me;
    const live = !all ? liveGame(r, n, App.intlInn || 0) : '';
    const games = r.games.slice(0, n).map((g, i) => `<div class="game ${i === n - 1 && !all ? 'new' : ''}"><span class="tiny muted">${esc(g.stage)}</span><span class="${g.win ? 'w' : ''}">대한민국 ${g.score[0]}</span><span class="muted">:</span><span class="${g.win ? '' : 'w'}">${g.score[1]} ${esc(g.opp)}</span></div><div class="tiny muted intl-me">${esc(me.name)}: ${esc(g.me)}${g.hl ? ` <b class="intl-hl ${/난타|침묵/.test(g.hl) ? 'bad' : ''}">${esc(g.hl)}</b>` : ''}</div>`).join('');
    const tot = [r.bat ? Sim.fmtBatShort(r.bat).replace(/ OPS.*/, '') + ` (${r.bat.PA}타석)` : '', r.pit ? `${ip(r.pit)}이닝 ERA ${f2(Sim.ERA(r.pit))} ${r.pit.K}K` : ''].filter(Boolean).join(' / ');
    return `
      <div class="topbar"><span class="title">${r.year} ${esc(r.name)}</span><span class="spacer"></span>${all ? '' : '<button class="btn small" data-act="intl-skip">결과 바로 보기</button>'}</div>
      ${all ? `<div class="panel reveal champ-banner ${r.medal ? 'mine' : ''}"><div class="tiny muted">대한민국 국가대표</div><div class="champ-name">${esc(r.result)}</div>${r.closing ? `<div class="small" style="margin:2px 0 4px">${esc(r.closing)}</div>` : ''}${r.rank ? `<div class="small muted">최종 ${r.rank}위 · 참가 ${r.field}개국</div>` : ''}${r.awards && r.awards.length ? `<div class="stamps" style="justify-content:center">${r.awards.map(a => `<span class="stamp gold">${esc(a)}</span>`).join('')}</div>` : ''}${r.milGranted ? '<div class="small" style="color:var(--gold);font-weight:800">병역 혜택을 받았다!</div>' : r.exempt === false && /메달/.test(r.result) && me.milDone ? '' : ''}${tot ? `<div class="small muted" style="margin-top:6px">내 대회 성적: ${esc(tot)}</div>` : ''}</div>` : ''}
      ${live ? `<div class="panel">${live}</div>` : ''}<div class="panel"><h3>경기 결과</h3><div class="games">${games || '<div class="muted small">첫 경기가 진행 중이다…</div>'}</div></div>
      <div class="dock"><div class="in">${all ? '<button class="btn go block" data-act="intl-done">계속</button>' : '<button class="btn block" disabled>경기 진행 중…</button>'}</div></div>`;
  }
  function intlReveal() {
    if (App.view !== 'intl' || !App.intlRes) return;
    if (App.intlShown >= App.intlRes.games.length) { render(); return; }
    // 이닝을 하나씩 진행하고, 9회가 끝나야 그 경기 결과를 확정한다
    App.intlInn = (App.intlInn || 0) + 1;
    if (App.intlInn > 9) { App.intlInn = 0; App.intlShown++; render(); setTimeout(intlReveal, 800); return; }
    render(); setTimeout(intlReveal, App.intlInn === 9 ? 700 : 280);
  }

  // ================================================================
  // 전환점 모달
  // ================================================================
  function showEvent() {
    const st = App.st;
    const it = Sim.pendingItem(st);
    if (!it) { $modal.innerHTML = ''; return; }
    const who = it.who || '';
    $modal.innerHTML = `<div class="overlay"><div class="sheet">
      <div class="speaker"><div class="avatar-sq">${esc(who.slice(0, 1))}</div><div><b>${esc(who)}</b><span class="chip">${esc(it.cat || '')}</span></div><span class="spacer"></span><span class="tiny muted">${it.id === 'intlCall' ? `${st.year - 1}년 시즌 중 · ${st.me.age - 1}세` : it.id === 'draft' || it.id === 'usDirect' ? `${st.year - 1}년 ${it.id === 'draft' ? '9월' : '여름'} · ${st.me.age - 1}세` : `${st.year - 1}년 겨울 · ${st.me.age}세`}</span></div>
      <div class="bubble">${esc(it.text)}</div>
      ${App.reaction == null ? `<div class="choices">${it.ch.map((c, i) => `<button class="btn block" data-act="choose" data-v="${i}">${esc(c)}</button>`).join('')}</div>` : ''}
    </div></div>`;
  }
  function showReaction(text, after, r) {
    const sheet = $modal.querySelector('.sheet');
    if (!sheet) { after(); return; }
    const ch = sheet.querySelector('.choices'); if (ch) ch.remove();
    const hints = r && !r.intl && r.hints && r.hints.length ? `<div class="hints">${r.hints.map(h => `<div class="hint ${h.s > 0 ? 'up' : h.s < 0 ? 'down' : 'mid'}"><i>${h.s > 0 ? '▲' : h.s < 0 ? '▼' : '●'}</i>${esc(h.t)}</div>`).join('')}${r.verdict ? `<div class="verdict">${esc(r.verdict)}</div>` : ''}</div>` : '';
    sheet.insertAdjacentHTML('beforeend', `<div class="reaction">${esc(text)}</div>${hints}<div class="choices"><button class="btn primary block" data-act="react-ok">계속</button></div>`);
    App._after = after;
  }

  // ================================================================
  // 은퇴
  // ================================================================
  function benchPercentile(score) {
    const b = store.get(KEY_BENCH, null);
    if (!b || !b.length) return null;
    let lo = 0; while (lo < b.length && b[lo] <= score) lo++;
    return Math.max(0.1, 100 * (1 - lo / b.length));
  }
  function viewRetire() {
    const st = App.st, f = st.final, me = st.me;
    const pct = benchPercentile(f.score);
    const bat = f.bat, pit = f.pit;
    const lines = [];
    if (bat.PA) lines.push(`타격 ${bat.G}경기 ${r3(Sim.AVG(bat))} ${bat.H}안타 ${bat.HR}홈런 ${bat.RBI}타점 ${bat.SB}도루 · OPS ${r3(Sim.OPS(bat))}`);
    if (pit.outs) lines.push(`투구 ${pit.G}경기 ${pit.W}승 ${pit.L}패 ${pit.SV}세이브 ${pit.HLD}홀드 · ${ip(pit)}이닝 ERA ${f2(Sim.ERA(pit))} ${pit.K}탈삼진`);
    const tierTxt = { '역대급': '역대급', '특급': '특급', '유망': '유망', '평범': '평범' }[f.tier];
    const grow = { early: '조숙형', std: '표준형', late: '만개형' }[f.growth];
    const aging = { iron: '철인형', long: '장수형', std: '표준형', early: '조기 쇠퇴형', meteor: '혜성형', flash: '반짝 각성형' }[f.aging];
    return `
      <div class="topbar"><button class="btn small" data-act="home">홈</button><span class="title">은퇴 결산</span><span class="spacer"></span>${devToggle()}</div>
      ${cardHTML(st)}
      ${f.oneLine ? `<div class="panel reveal one-line"><span class="tiny muted">커리어 한줄평</span><b>“${esc(f.oneLine)}”</b></div>` : ''}
      ${f.hof && f.hof.in ? `<div class="panel reveal hof-panel"><div class="hof-title">명예의 전당 헌액</div><div class="small">${esc(f.name)}의 이름이 명예의 전당에 새겨졌다.</div><div class="stamps" style="justify-content:center">${f.hof.why.map(w => `<span class="stamp gold">${esc(w)}</span>`).join('')}</div><button class="btn small" data-act="hof-replay" style="margin-top:10px">헌액식 다시 보기</button></div>`
        : `<div class="panel reveal small muted" style="text-align:center">명예의 전당 헌액 기준에는 닿지 못했다.${f.hof && f.hof.why && f.hof.why.length ? `<div style="margin-top:6px">달성한 기준 ${f.hof.why.length}개 · 헌액에는 ${f.hof.need || 2}개 이상 필요</div><div class="stamps" style="justify-content:center">${f.hof.why.map(w => `<span class="stamp">${esc(w)}</span>`).join('')}</div>` : ''}</div>`}
      <div class="panel reveal" id="share-src">
        <div class="big-score"><span>CAREER SCORE</span><b class="num">${f.score}</b>
          ${pct != null ? `<span class="pct-badge">전체 커리어 대비 상위 ${pct < 1 ? pct.toFixed(1) : Math.round(pct)}%</span>` : `<span class="tiny muted" id="pct-wait">비교 데이터 만드는 중…</span>`}
          ${rankLine(st)}
        </div>
        <div class="small" style="margin-top:12px;text-align:center">${f.retireAge}세 은퇴 · ${f.seasons}시즌 · 통산 WAR <b>${f1(f.war)}</b>${f.twoWay ? ` (타 ${f1(f.warB)} / 투 ${f1(f.warP)})` : ''}<br>${esc(f.teams.join(' → ') || '프로 무대를 밟지 못했다')}</div>
        ${lines.length ? `<div class="small" style="margin-top:10px;display:grid;gap:4px">${lines.map(l => `<div>${esc(l)}</div>`).join('')}</div>` : ''}
        ${f.awList.length || f.ms.length ? `<div class="stamps">${f.awList.filter(awKeep).slice(0, 14).map(a => `<span class="stamp ${/MVP|우승|골든/.test(a) ? 'gold' : ''}">${esc(a)}</span>`).join('')}${f.ms.map(m => `<span class="ribbon">${esc(m)}</span>`).join('')}</div>` : ''}
        <div class="small muted" style="margin-top:10px">통산 수입 ${Sim.man(Math.max(0, f.earnings))}${f.draft ? ` · ${f.draft.year} 드래프트 ${f.draft.round}${typeof f.draft.round === 'number' ? '라운드' : ''}` : ' · 드래프트 미지명'}</div>
      </div>
      <div class="panel reveal"><h3>이제야 밝혀지는 비밀</h3>
        <div class="hidden-reveal">
          <div><div class="k">잠재력 등급</div><div class="v">${tierTxt}</div></div>
          <div><div class="k">잠재력 달성률</div><div class="v">${f.paRate}%</div></div>
          <div><div class="k">성장 유형</div><div class="v">${grow}</div></div>
          <div><div class="k">에이징 유형</div><div class="v">${aging}</div></div>
          <div style="grid-column:1/-1"><div class="k">전성기</div><div class="v">${f.peakInfo.none ? '타고난 전성기는 없었다' : f.peakInfo.missed ? `${f.peakInfo.from}세에 찾아올 예정이었다 — 끝내 오지 않았다` : `${f.peakInfo.from === f.peakInfo.to ? f.peakInfo.from + '세' : f.peakInfo.from + '~' + f.peakInfo.to + '세'} · WAR 합계 ${f1(f.peakInfo.war)}`}</div></div>
        </div></div>
      <div class="panel reveal"><h3>인생 이야기</h3>${f.story.map(s => `<div class="story-item"><span class="y">${s.year}<br>${s.age}세</span><span>${esc(s.text)}</span></div>`).join('')}</div>
      <div class="dock"><div class="in row"><button class="btn block" data-act="cardimg" style="flex:1.2">야구카드 저장 (앞·뒤)</button><button class="btn block" data-act="share" style="flex:1">요약 이미지</button><button class="btn go" data-act="new" style="flex:1">한 판 더</button></div></div>`;
  }
  // 33차: 우승컵 드는 애니메이션 — 고교 전국대회·대학리그·프로 포스트시즌·국가대표 우승 때 한 번씩
  function trophyTitles() {
    const st = App.st, res = App.res;
    if (App.view === 'intl' && App.intlRes && App.intlShown >= App.intlRes.games.length && /금메달|^우승/.test(App.intlRes.result) && !App.intlRes._tro) {
      App.intlRes._tro = true; return { list: [`${App.intlRes.year} ${App.intlRes.name} ${App.intlRes.result}`], who: '대한민국 국가대표', gold: App.intlRes.result === '금메달' };
    }
    if (!res || res._tro || !st) return null;
    const post = res.league && res.league.post;
    if (App.view === 'post' && post && App.ps && App.ps.idx >= post.rounds.length && post.champion === st.me.team) {
      res._tro = true; return { list: [`${res.year} ${post.champName || '한국시리즈'} 우승`], who: Sim.teamName(st, post.champion) };
    }
    if (App.view !== 'result') return null;
    res._tro = true;
    const list = [];
    if (post && post.champion === st.me.team) list.push(`${res.year} ${post.champName || '한국시리즈'} 우승`);   // 포스트시즌을 건너뛴 경우
    ((res.team && res.team.tourn) || []).filter(x => / 우승$/.test(x)).forEach(x => list.push(`${res.year} ${x}`));
    if (res.team && /\(우승\)/.test(res.team.record || '')) list.push(`${res.year} 대학리그 우승`);
    return list.length ? { list, who: res.team ? res.team.name : '' } : null;
  }
  function maybeTrophy() {
    if (App.st && App.st.done && App.view === 'retire') return;
    const t = trophyTitles();
    if (!t) return;
    const me = App.st.me;
    const colors = ['#d4a52f', '#f5d76e', '#ffffff', '#c4352b', '#8fb3ff'];
    let conf = '';
    for (let i = 0; i < 40; i++) conf += `<i style="left:${(i * 41) % 100}%;background:${colors[i % colors.length]};animation-delay:${(0.9 + (i * 0.11) % 1.8).toFixed(2)}s;animation-duration:${(2.4 + (i % 5) * 0.3).toFixed(2)}s"></i>`;
    const cup = t.gold
      ? '<g class="tro-cup"><path d="M70 6 L80 6 L86 22 L74 22 Z M80 6 L90 6 L86 22 Z" fill="#c4352b"/><circle cx="80" cy="30" r="11" fill="#f5c542" stroke="#b8860b" stroke-width="2"/><text x="80" y="34" text-anchor="middle" font-size="11" font-weight="900" fill="#8a6200">1</text></g>'
      : '<g class="tro-cup"><path d="M66 6 H94 V16 Q94 34 80 36 Q66 34 66 16 Z" fill="#f5c542" stroke="#b8860b" stroke-width="2"/><path d="M66 10 Q56 10 58 20 Q60 26 67 26" fill="none" stroke="#b8860b" stroke-width="3"/><path d="M94 10 Q104 10 102 20 Q100 26 93 26" fill="none" stroke="#b8860b" stroke-width="3"/><rect x="76" y="36" width="8" height="7" fill="#d4a52f"/><rect x="70" y="43" width="20" height="5" rx="1" fill="#8a6200"/><path d="M71 12 Q72 24 78 30" stroke="#fff6c8" stroke-width="2" fill="none" opacity=".8"/></g>';
    App.troView = App.view;
    $modal.innerHTML = `<div class="tro-overlay" data-act="trophy-ok">
      <div class="hof-confetti">${conf}</div>
      <div class="tro-box">
        <svg class="tro-svg" viewBox="0 0 160 190" aria-hidden="true">
          <ellipse cx="80" cy="182" rx="40" ry="6" fill="rgba(0,0,0,.25)"/>
          <g class="tro-arms" stroke-linecap="round" stroke-linejoin="round" fill="none">
            <g class="arm-l"><path d="M66 92 L52 66 L60 44" stroke="#1b2233" stroke-width="12"/><path d="M66 92 L52 66 L60 44" stroke="#f4f4f6" stroke-width="8"/></g>
            <g class="arm-r"><path d="M94 92 L108 66 L100 44" stroke="#1b2233" stroke-width="12"/><path d="M94 92 L108 66 L100 44" stroke="#f4f4f6" stroke-width="8"/></g>
          </g>
          ${cup}
          <rect x="66" y="88" width="28" height="44" rx="6" fill="#f4f4f6" stroke="#1b2233" stroke-width="2"/>
          <text x="80" y="118" text-anchor="middle" font-size="15" font-weight="900" fill="#c4352b">${esc(me.num)}</text>
          <rect x="68" y="132" width="10" height="42" rx="4" fill="#e9e9ee" stroke="#1b2233" stroke-width="2"/><rect x="82" y="132" width="10" height="42" rx="4" fill="#e9e9ee" stroke="#1b2233" stroke-width="2"/>
          <circle cx="80" cy="74" r="13" fill="#f1c9a5" stroke="#1b2233" stroke-width="2"/>
          <path d="M66 70 Q66 56 80 56 Q94 56 94 70 Z" fill="#1b2233"/><rect x="88" y="67" width="12" height="4" rx="2" fill="#1b2233"/>
        </svg>
        <div class="hof-kicker">CHAMPIONS</div>
        <div class="tro-big">${t.list.length > 1 ? '우승!' : esc(t.list[0].replace(/^\d+ /, ''))}</div>
        ${t.list.length > 1 ? `<div class="tro-list">${t.list.map(x => `<span>🏆 ${esc(x)}</span>`).join('')}</div>` : `<div class="tro-sub">${esc(t.list[0].slice(0, 4))}년 · ${esc(t.who)}</div>`}
        <div class="tro-msg">${esc(me.name)}, ${t.gold ? '금메달을' : '우승컵을'} 번쩍 들어 올렸다!</div>
        <button class="btn go" data-act="trophy-ok">계속</button>
      </div></div>`;
  }
  // 23차: 명예의 전당 헌액식 (은퇴 결산 첫 진입 때 한 번, '다시 보기'로 재생)
  function showHof() {
    const st = App.st, f = st.final, me = st.me;
    const colors = ['#d4a52f', '#f5d76e', '#ffffff', '#c4352b', '#8fb3ff'];
    let conf = '';
    for (let i = 0; i < 46; i++) conf += `<i style="left:${(i * 37) % 100}%;background:${colors[i % colors.length]};animation-delay:${((i * 0.13) % 2.2).toFixed(2)}s;animation-duration:${(2.6 + (i % 5) * 0.35).toFixed(2)}s"></i>`;
    $modal.innerHTML = `<div class="hof-overlay" data-act="hof-ok">
      <div class="hof-confetti">${conf}</div>
      <div class="hof-box">
        <div class="hof-kicker">HALL OF FAME</div>
        <div class="hof-big">명예의 전당 헌액</div>
        <div class="hof-name"><span class="num">#${me.num}</span> ${esc(f.name)}</div>
        <div class="hof-msg">${f.retireAge}세까지 ${f.seasons}시즌. 통산 WAR ${f1(f.war)}.<br>${esc(f.name)}의 이름이 명예의 전당에 영원히 새겨졌다.<br>축하합니다! 한 시대를 빛낸 선수였습니다.</div>
        <div class="hof-why">${f.hof.why.map(w => `<span>${esc(w)}</span>`).join('')}</div>
        <button class="btn go" data-act="hof-ok">헌액 카드 받기</button>
      </div></div>`;
  }
  // 65차: 영구결번식 — 헌액식 바로 다음. 구단 색 유니폼 뒷면 + 등번호
  function showRetNum() {
    const st = App.st, f = st.final, me = st.me, rn = ensureRetNum(st); if (!rn) return;
    const col = TEAMCOLOR(rn.teamId) || '#1f2d55';
    $modal.innerHTML = `<div class="hof-overlay ret-overlay" data-act="ret-ok">
      <div class="hof-box">
        <div class="hof-kicker">RETIRED NUMBER</div>
        <div class="ret-jersey" style="--team:${col}"><span class="ret-jname">${esc(f.name)}</span><b class="ret-jnum">${rn.num}</b></div>
        <div class="hof-big">영구결번</div>
        <div class="hof-name">${esc(rn.team)} · 등번호 <span class="num">#${rn.num}</span></div>
        <div class="hof-msg">이제 ${esc(rn.team)}에서 ${rn.num}번은 누구도 달 수 없다.<br>${esc(f.name)}의 등번호가 홈구장에 영원히 걸렸다.</div>
        <button class="btn go" data-act="ret-ok">계속</button>
      </div></div>`;
  }
  // 52차: 은퇴 결산의 순위 한 줄 — 순위에 들었을 때만 보여 준다 (못 들면 아무 문구 없음)
  function rankLine(st) {
    const span = t => `<span class="small" style="margin-top:6px">${t}</span>`;
    const txt = (a, s) => a ? `🏅 역대 최고점수 <b>${a}위</b>${s ? ` · 이번 시즌 <b>${s}위</b>` : ''}` : s ? `🏅 이번 시즌 최고점수 <b>${s}위</b>` : '';
    if (LB_ON && st._lb) {
      if (st._lb === 'checking') return span('순위 확인 중…');
      if (st._lb === 'in') { const t = txt(st._lbRank, st._lbSRank); return t ? span(t + ' — 야구카드가 순위표에 남았다') + (st._newBadges && st._newBadges.length ? span(`🎖️ 새 뱃지: <b>${st._newBadges.map(id => esc((BADGES.find(b => b.id === id) || {}).name || id)).join(', ')}</b> — 홈 화면 맨 아래에서 볼 수 있다`) : '') : ''; }
      if (st._lb === 'error') return span('온라인 순위에 연결하지 못했다 — 이 기기 기록에만 남았다');
      return '';
    }
    const t = txt(st._rank, st._srank);
    return t ? span(t + ' — 야구카드가 순위표에 남았다') : '';
  }
  // 능력치 12개를 화면 표시 숫자(1~99)로
  const ABIL_B = ['con', 'pow', 'eye', 'spd', 'def', 'arm'], ABIL_P = ['vel', 'ctl', 'stf', 'brk', 'sta', 'men'], ABIL_KEYS = ABIL_B.concat(ABIL_P);
  function abilOf(r, keys) { if (!r) return null; const o = {}; for (const k of keys || ABIL_KEYS) if (r[k] != null) o[k] = Sim.disp(r[k]); return o; }
  const pickKeys = (o, keys) => o ? Object.fromEntries(keys.filter(k => o[k] != null).map(k => [k, o[k]])) : null;
  // 밸런스 분석용 한 줄 — 이름 같은 개인정보는 보내지 않는다
  function careerRow(st) {
    const me = st.me, f = st.final, fl = me.flags || {}, r1 = h => h.lvl === '1군';
    const seasonsIn = lg => st.hist.filter(h => h.lg === lg && r1(h)).length;
    const r1d = x => Math.round((+x || 0) * 10) / 10;
    // 이도류를 한 번이라도 했으면(중간에 그만뒀어도) 12개 전부, 아니면 타자는 타자 6개 · 투수는 투수 6개
    const twEver = !!(me.twoWay || me.twoWayChosen), twQuit = twEver && !me.twoWay;
    const roleChanged = fl.role0 && fl.role0 !== me.role;   // 이도류 없이 투타를 바꾼 경우도 전부
    const keys = twEver || roleChanged ? ABIL_KEYS : me.role === 'P' ? ABIL_P : ABIL_B;
    return {
      build: window.GAME_BUILD || 0, pos0: fl.pos0 || null, main_pos: f.mainPos || null, two_way: twEver, tw_quit: twQuit,
      tier: f.tier, growth: f.growth, score: f.score, war: r1d(f.war), war_b: r1d(f.warB), war_p: r1d(f.warP),
      hof: !!(f.hof && f.hof.in), retire_age: f.retireAge, seasons: f.seasons, peak: f.peak,
      draft: me.draft ? String(me.draft.round) : '없음', origin: me.origin || 'hs',
      kbo: seasonsIn('KBO'), npb: seasonsIn('NPB'), mlb: seasonsIn('MLB'), debut: me.debut != null, vol: !!me.volRet,
      minutes: fl.t0 ? Math.round((Date.now() - fl.t0) / 60000) : null, aw: Object.fromEntries(Object.entries(f.aw || {}).filter(([, n]) => n > 0)),
      admin: !!(App.admin || /[?&]admin=/.test(location.search)),
      abil: { start: pickKeys(fl.r0, keys), peak: abilOf(st.car.peakR || me.r, keys), pot: abilOf(me.pa, keys) },
      log: seasonLog(st),
    };
  }
  // 시즌별 기록 — 타자: 타율·안타·홈런·OPS(+타석) / 투수: ERA·탈삼진·승·홀드·세이브·이닝 / 공통: 나이·리그·1군/2군·WAR
  function seasonLog(st) {
    const r3 = x => Math.round(x * 1000) / 1000, r2 = x => Math.round(x * 100) / 100;
    return st.hist.filter(h => (h.bat && h.bat.PA) || (h.pit && h.pit.outs) || h.inj).slice(0, 30).map(h => {
      const o = { age: h.age, lg: h.lg || null, lv: (h.bat && h.bat.fut) || (h.pit && h.pit.fut) ? '2군' : (h.lvl === '1군' || h.lvl === '2군' ? h.lvl : '아마') };
      if (h.war != null) o.war = Math.round(h.war * 10) / 10;
      const b = h.bat; if (b && b.PA) {
        const avg = b.AB ? b.H / b.AB : 0, obp = (b.H + b.BB) / b.PA, slg = b.AB ? (b.H + (b.D || 0) + 2 * (b.T || 0) + 3 * b.HR) / b.AB : 0;
        o.b = { pa: Math.round(b.PA), avg: r3(avg), h: Math.round(b.H), hr: Math.round(b.HR), ops: r3(obp + slg) };
      }
      const p = h.pit; if (p && p.outs) {
        o.p = { ip: Math.floor(Math.round(p.outs) / 3) + (Math.round(p.outs) % 3) / 10, era: r2(p.ER * 27 / p.outs), k: Math.round(p.K), w: p.W || 0, hld: p.HLD || 0, sv: p.SV || 0 };
      }
      return o;
    });
  }
  function recordRetire() {
    const st = App.st;
    if (!st.final || st._recorded) return;
    st._recorded = true;
    const recs = store.get(KEY_REC, []);
    const f = st.final;
    // 40차: 점수만 비교해 순위표에 들면 야구카드만 남기고, 못 들면 아무것도 남기지 않는다
    // 52차: 역대 TOP 20 + 이번 시즌(오늘) TOP 50 — 둘 중 하나라도 들면 남긴다
    const byScore = (a, b) => b.score - a.score;
    ensureRetNum(st);   // 65차: 영구결번 (카드·뱃지보다 먼저)
    const mine = { name: f.name, pos: f.mainPos && f.mainPos !== 'TW' ? f.mainPos : f.pos, twoWay: f.twoWay, score: f.score, war: f.war, hof: !!(f.hof && f.hof.in), date: Date.now(), card: cardData(st) };
    const all = recs.concat([mine]).sort(byScore);
    const keepAll = all.slice(0, ALL_MAX), keepSeason = all.filter(inSeason).slice(0, SEASON_MAX);
    const top = all.filter(r => keepAll.indexOf(r) >= 0 || keepSeason.indexOf(r) >= 0);
    st._rank = keepAll.indexOf(mine) + 1;      // 역대 순위 (0이면 TOP 20 밖)
    st._srank = keepSeason.indexOf(mine) + 1;  // 이번 시즌 순위 (0이면 TOP 50 밖)
    milestones(st);
    checkBadges(st);   // 65차: 뱃지 (이 기기에만 저장)
    bump('retire');
    if (mine.hof) bump('hof');
    { const p0 = [st.me.flags && st.me.flags.pos0, f.mainPos, st.me.pos].find(p => STAT_POS.indexOf(p) >= 0); if (p0 && statOK()) lbFetch('rpc/add_score', { method: 'POST', body: JSON.stringify({ p: p0, s: f.score }) }).catch(() => { }); }
    if (LB_ON && !LOCALHOST) lbFetch('rpc/add_career',{ method: 'POST', body: JSON.stringify({ d: careerRow(st) }) }).catch(() => { });
    if (LB_ON) lbSubmit(st);   // 47차: 온라인 TOP 50 (이 기기 기록은 연결 실패 때 보여 줄 예비용)
    store.set(KEY_REC, top);
    save();   // 39차: 커리어 저장 데이터는 지운다 (화면의 은퇴 결산은 메모리에 남아 있음)
    if (!store.get(KEY_BENCH, null)) buildBench();
  }
  // 비교 분포가 없으면 봇 커리어로 만든다 (밸런스 페이지를 돌려도 저장됨)
  function buildBench() {
    const scores = []; let k = 0; const N = 120;
    const POS_B = ['C', '1B', '2B', '3B', 'SS', 'OF', 'OF'], POS_P = ['SP', 'SP', 'RP'];
    function one(seed) {
      const role = seed % 100 < 55 ? 'B' : 'P', pos = role === 'B' ? POS_B[seed % 7] : POS_P[seed % 3];
      const c = Sim.makeCandidates({ rng: { s: seed ^ 0x9e3779b9 } }, role, pos);
      const st = Sim.newGame(seed, { name: 'b', role, pos, r: c[seed % 3].r, school: ['strong', 'mid', 'weak'][(seed >> 3) % 3] });
      let g = 0; while (!st.done && g++ < 40) { Sim.playSeason(st); let g2 = 0; while (st.pending.length && g2++ < 20) Sim.choose(st, Math.floor(((seed * 31 + g * 7 + g2) >>> 0) % st.pending[0].ch.length)); }
      return Sim.careerScore(st);
    }
    function step() {
      const t0 = performance.now();
      while (k < N && performance.now() - t0 < 30) scores.push(one(5000 + 7919 * k++));
      const w = document.getElementById('pct-wait'); if (w) w.textContent = `비교 데이터 만드는 중… ${Math.round(k / N * 100)}%`;
      if (k < N) setTimeout(step, 0);
      else { store.set(KEY_BENCH, scores.sort((a, b) => a - b)); if (App.view === 'retire') render(); }
    }
    setTimeout(step, 50);
  }
  function shareImage() {
    const st = App.st, f = st.final, me = st.me;
    const W = 720, H = 1000, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const color = me.team ? TEAMCOLOR(me.team) : '#3d4a5c';
    const grad = { bronze: '#a8693a', silver: '#8d96a3', gold: '#d4a52f', legend: '#7b2ff7' }[Sim.view(st).grade];
    c.fillStyle = grad; c.fillRect(0, 0, W, H);
    c.fillStyle = '#fbf7ee'; roundRect(c, 24, 24, W - 48, H - 48, 22); c.fill();
    c.fillStyle = cardBg(color); roundRect(c, 24, 24, W - 48, 380, 22); c.fill(); c.fillRect(24, 300, W - 48, 104);
    const av = document.createElement('canvas'); drawAvatar(av, me.avatar || 1, color);
    c.imageSmoothingEnabled = false; c.drawImage(av, W / 2 - 150, 104, 300, 300);
    c.fillStyle = '#fff'; c.font = '900 64px sans-serif'; c.textAlign = 'right'; c.fillText(String(f.score), W - 60, 110);
    c.font = '700 18px sans-serif'; c.fillText('CAREER SCORE', W - 60, 136);
    c.textAlign = 'left'; c.fillStyle = '#c4352b'; c.font = '900 48px sans-serif'; c.fillText(String(me.num), 60, 470);
    c.fillStyle = '#1b2233'; c.font = '900 48px sans-serif'; c.fillText(f.name, 60 + c.measureText(String(me.num)).width + 70, 470);
    c.font = '600 22px sans-serif'; c.fillStyle = '#4a5163';
    c.fillText(`${Sim.POSNAME[f.pos]}${f.twoWay ? ' · 이도류' : ''} · ${f.retireAge}세 은퇴 · 통산 WAR ${f1(f.war)}`, 60, 512);
    c.fillText((f.teams.join(' → ') || '아마추어').slice(0, 40), 60, 546);
    c.font = '700 24px sans-serif'; c.fillStyle = '#1b2233';
    let y = 600;
    if (f.bat.PA) { c.fillText(`${r3(Sim.AVG(f.bat))}  ${f.bat.H}안타  ${f.bat.HR}홈런  ${f.bat.RBI}타점`, 60, y); y += 38; }
    if (f.pit.outs) { c.fillText(`${f.pit.W}승 ${f.pit.L}패 ${f.pit.SV}세이브  ERA ${f2(Sim.ERA(f.pit))}  ${f.pit.K}K`, 60, y); y += 38; }
    c.font = '800 20px sans-serif'; c.fillStyle = '#c4352b';
    const aw = f.awList.filter(awKeep).concat(f.ms.map(m => '통산 ' + m));
    let x = 60; y += 10;
    for (const a of aw.slice(0, 12)) { const w = c.measureText(a).width + 24; if (x + w > W - 60) { x = 60; y += 42; } c.strokeStyle = '#c4352b'; c.lineWidth = 3; roundRect(c, x, y - 26, w, 36, 8); c.stroke(); c.fillText(a, x + 12, y); x += w + 10; }
    const pct = benchPercentile(f.score);
    c.fillStyle = '#1b2233'; c.font = '800 26px sans-serif'; c.textAlign = 'center';
    if (pct != null) c.fillText(`전체 커리어 대비 상위 ${pct < 1 ? pct.toFixed(1) : Math.round(pct)}%`, W / 2, H - 120);
    c.fillStyle = '#858a96'; c.font = '600 18px sans-serif'; c.fillText('골글 들고 명전으로', W / 2, H - 70);
    cv.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${f.name}_커리어카드.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  }
  // 12차: 야구카드 앞면(왼쪽)·뒷면(오른쪽)을 한 장의 이미지로 저장
  // 39차: 카드는 기록 데이터(cardData)로 그린다 → 은퇴 후 저장 데이터를 지워도 기록실에서 카드를 다시 볼 수 있다
  function cardData(st) {
    const me = st.me, f = st.final, v = Sim.view(st);
    // 65차: 이도류를 하다 그만뒀어도(twoWayChosen) 투수·타자 기록이 둘 다 있으면 카드 기록표·앞면 능력치 모두 양쪽
    const twNow = !!me.twoWay, tw = twNow || !!(me.twoWayChosen && f.pit && f.pit.outs > 0 && f.bat && f.bat.PA > 0);
    const isP = me.role === 'P' && !tw;
    // 55차: 이도류는 타자·투수 기록을 따로 (시즌 WAR도 타자분·투수분으로 나눠서)
    const tableOf = P => {
      const wk = tw ? (P ? 'warP' : 'warB') : 'war';
      const rows = st.hist.filter(h => h.war != null && (P ? h.pit && !h.pit.fut : h.bat && !h.bat.fut)).slice(-30).map(h => {
        const tm = String(h.team).slice(0, 5), w = h[wk] != null ? f1(h[wk]) : tw ? '-' : f1(h.war);
        // 62차: 카드 기록표 순서 — 투수: 연도·팀·ERA·경기·승·패·세이브·홀드·이닝·탈삼진·WAR / 타자: 연도·팀·경기·타율·타수·안타·홈런·타점·도루·출루율·OPS·WAR
        if (P) { const p = h.pit; return [String(h.year).slice(2), tm, p.outs ? f2(Sim.ERA(p)) : '-', p.G || 0, p.W || 0, p.L || 0, p.SV || 0, p.HLD || 0, ip(p), p.K || 0, w]; }
        const b = h.bat; return [String(h.year).slice(2), tm, b.G || 0, b.PA ? r3(Sim.AVG(b)) : '-', b.AB || 0, b.H || 0, b.HR || 0, b.RBI || 0, b.SB || 0, b.PA ? r3(Sim.OBP(b)) : '-', b.PA ? r3(Sim.OPS(b)) : '-', w];
      });
      const t = P ? f.pit : f.bat, tw2 = f1(tw ? (P ? f.warP : f.warB) : f.war);
      const total = P ? (t.outs ? ['통산', '', f2(Sim.ERA(t)), t.G, t.W, t.L, t.SV, t.HLD || 0, ip(t), t.K, tw2] : null)
        : (t.PA ? ['통산', '', t.G, r3(Sim.AVG(t)), t.AB, t.H, t.HR, t.RBI, t.SB, r3(Sim.OBP(t)), r3(Sim.OPS(t)), tw2] : null);
      return { rows, total };
    };
    const { rows, total } = tableOf(isP);
    const pt = tw ? tableOf(true) : null;
    const shown = me.shown || me.r;
    const mt = f.mainTeam || me.team;   // 52차: 가장 많이 뛴 팀·포지션
    return {
      name: me.name, num: me.num, avatar: me.avatar || 1, color: mt ? TEAMCOLOR(mt) : '#3d4a5c', team: f.mainTeamName || (me.team ? Sim.teamName(st, me.team) : ''),
      grade: v.grade, hof: f.hof && f.hof.in ? f.hof.year : null, ovr: Sim.disp(v.ovr), line: f.oneLine || '',
      info: `${f.mainPos ? mainPosText(f, me) : posText(me)} · ${handText(me)} · ${f.retireAge}세 은퇴 · 통산 WAR ${f1(f.war)}`,
      // 57차: 이도류는 앞면에 주 능력치/반대쪽 능력치를 한 줄에 함께 (막대 = 주, 세로선 = 반대쪽)
      stats: tw ? Sim.mainKeys(me).map((k, i) => { const o = Sim.oppKeys(me)[i]; return [Sim.LABEL[k], Sim.disp(shown[k]), Sim.LABEL[o], Sim.disp(shown[o])]; })
        : Sim.mainKeys(me).map(k => [Sim.LABEL[k], Sim.disp(shown[k])]),
      twMain: tw ? (me.role === 'P' ? '투구' : '타격') : undefined, year: st.year - 1, isP, rows, total, cv: 2,
      aw: sortAw(mergeAw((f.awList || []).filter(awKeep))), teams: (f.teams || []).join(' → ').slice(0, 44),   // 64차: 업적 12개 자르기 없앰 — 전부, 개인 수상부터
      troph: trophyList(f.awList || []),   // 64차: 우승 트로피 [종류, 횟수]
      ...(ensureRetNum(st) ? { retNum: { team: f.retNum.team, num: f.retNum.num } } : {}),   // 65차: 영구결번
      ...(pt ? { rowsP: pt.rows, totalP: pt.total } : {}),
    };
  }
  // 60차: 같은 업적은 연도를 모아 한 칸으로 — '2029 MVP', '2031 MVP' → '2029, 2031 MVP' (연속 연도는 2029~2031)
  //   이미 합쳐진 문자열은 '2029, ' 로 시작해 다시 건드리지 않는다 (예전 카드도 그대로 안전)
  // 64차: 카드 업적 순서 — 개인 수상(MVP·올해의 투수상·시리즈 MVP·골든글러브·신인왕·타이틀) → 리그 우승 → 국제대회 우승·메달 → 국제대회 개인상 → 그 밖
  const AW_RANK = [/^MVP$/, /올해의 투수상$/, /시리즈 MVP$/, /골든글러브$/, /신인왕$/, /왕$/, /시리즈 우승$/, /(우승|금메달|은메달|동메달|준우승)$/, /대회 MVP$/, /./];
  function sortAw(list) {
    const rank = s => { const k = s.replace(/ \(\d+회\)$/, '').replace(/^['\d][\d,~' ]* /, ''); const i = AW_RANK.findIndex(re => re.test(k)); return i < 0 ? AW_RANK.length : i; };
    return list.map((s, i) => [s, rank(s), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(x => x[0]);
  }
  function mergeAw(list) {
    const order = [], by = {};
    for (const a of list) {
      const m = /^(\d{4}) (.+)$/.exec(a);
      const key = m ? m[2] : '\u0000' + a;
      if (!by[key]) { by[key] = []; order.push(key); }
      if (m) by[key].push(+m[1]);
    }
    return order.map(k => {
      if (k[0] === '\u0000') return k.slice(1);
      const all = by[k], ys = [...new Set(all)].sort((a, b) => a - b), parts = [];
      for (let i = 0; i < ys.length;) {
        let j = i; while (j + 1 < ys.length && ys[j + 1] === ys[j] + 1) j++;
        parts.push(j - i >= 2 ? `${ys[i]}~${ys[j]}` : ys.slice(i, j + 1).join(', '));
        i = j + 1;
      }
      // 이도류가 한 해에 골든글러브 2개처럼 같은 해에 겹치면 총 횟수를 붙인다
      return `${parts.join(', ')} ${k}${all.length > ys.length ? ` (${all.length}회)` : ''}`;
    });
  }
  // ---------- 64차: 우승 트로피 진열장 (카드 앞면) ----------
  // 업적 목록('2036 한국시리즈 우승' 등)에서 리그 우승·국제대회 우승/메달만 골라 종류별 횟수로. 순서 = 위상 순
  const TROPHY = [
    ['WS', '월드시리즈', /월드시리즈 우승$/], ['JS', '재팬시리즈', /재팬시리즈 우승$/], ['KS', '한국시리즈', /한국시리즈 우승$/],
    ['WBC', 'WBC', /WBC 우승$/], ['P12', '프리미어12', /프리미어12 우승$/],
    ['OG', '올림픽 금', /올림픽 금메달$/], ['AG', '아시안게임 금', /아시안게임 금메달$/],   // 64차: 준우승·은·동은 기록에서 뺀다
  ];
  // 64차: 업적 목록에서 준우승·은메달·동메달을 뺀다 (예전 저장·예전 카드에 남아 있는 것도 화면에서 숨김)
  const awKeep = a => !/(준우승|은메달|동메달)( \(\d+회\))?$/.test(a);
  // 합쳐진 문자열('2029, 2031~2033 한국시리즈 우승', '… (3회)')의 횟수
  function awCount(s) {
    const m = /\((\d+)회\)$/.exec(s); if (m) return +m[1];
    const yrs = /^([\d,~ ]+) /.exec(s); if (!yrs) return 1;
    return yrs[1].split(',').reduce((n, p) => { const r = /(\d{4})\s*~\s*(\d{4})/.exec(p); return n + (r ? +r[2] - +r[1] + 1 : /\d{4}/.test(p) ? 1 : 0); }, 0) || 1;
  }
  function trophyList(aw) {
    const out = [];
    for (const [k, label, re] of TROPHY) { const n = (aw || []).filter(a => re.test(a)).reduce((s, a) => s + awCount(a), 0); if (n) out.push([k, n]); }
    return out;
  }
  // 트로피 한 개 그리기: (cx, by) = 가운데 아래, s = 높이. 실제 트로피를 본뜨지 않은 단순한 모양
  function drawTrophy(c, k, cx, by, s) {
    const u = s / 60, top = by - s;
    const G1 = '#f2c94c', G2 = '#b8860b', SV = '#cfd6df', SV2 = '#8d96a3', BR = '#cd7f32', BR2 = '#8a5222';
    const base = (col, w, h) => { c.fillStyle = col; roundRect(c, cx - w / 2 * u, by - h * u, w * u, h * u, 3 * u); c.fill(); };
    const cup = (body, dark, plate, tall) => {
      base(plate, 34, 9); c.fillStyle = dark; c.fillRect(cx - 9 * u, by - 13 * u, 18 * u, 5 * u);
      c.fillStyle = body; c.fillRect(cx - 3 * u, by - (tall ? 26 : 22) * u, 6 * u, (tall ? 14 : 10) * u);
      const bw = tall ? 15 : 21, bt = top + (tall ? 4 : 8) * u, bb = by - (tall ? 26 : 22) * u;
      c.beginPath(); c.moveTo(cx - bw * u, bt); c.lineTo(cx + bw * u, bt); c.quadraticCurveTo(cx + bw * u, bb, cx, bb); c.quadraticCurveTo(cx - bw * u, bb, cx - bw * u, bt); c.fill();
      c.strokeStyle = body; c.lineWidth = 3.5 * u;
      c.beginPath(); c.arc(cx - bw * u, bt + 9 * u, 7 * u, Math.PI * 0.5, Math.PI * 1.5); c.stroke();
      c.beginPath(); c.arc(cx + bw * u, bt + 9 * u, 7 * u, -Math.PI * 0.5, Math.PI * 0.5); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(cx - (bw - 5) * u, bt + 3 * u, 3 * u, 12 * u);
    };
    const medal = (face, rim, rib1, rib2) => {
      c.fillStyle = rib1; c.beginPath(); c.moveTo(cx - 14 * u, top); c.lineTo(cx - 4 * u, top); c.lineTo(cx + 4 * u, by - 30 * u); c.lineTo(cx - 4 * u, by - 30 * u); c.fill();
      c.fillStyle = rib2; c.beginPath(); c.moveTo(cx + 14 * u, top); c.lineTo(cx + 4 * u, top); c.lineTo(cx - 4 * u, by - 30 * u); c.lineTo(cx + 4 * u, by - 30 * u); c.fill();
      c.fillStyle = rim; c.beginPath(); c.arc(cx, by - 17 * u, 17 * u, 0, Math.PI * 2); c.fill();
      c.fillStyle = face; c.beginPath(); c.arc(cx, by - 17 * u, 13 * u, 0, Math.PI * 2); c.fill();
      c.fillStyle = rim; star(cx, by - 17 * u, 7 * u);
    };
    const star = (x, y, r) => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); };
    if (k === 'KS') cup(G1, G2, '#8b1e1e', false);
    else if (k === 'JS') cup(G1, G2, '#1f3a68', true);
    else if (k === 'WS') {
      // 깃발 고리: 기둥 위에 작은 삼각 깃발들이 둥글게
      base('#3d4a5c', 32, 9); c.fillStyle = SV2; c.fillRect(cx - 9 * u, by - 14 * u, 18 * u, 5 * u);
      c.fillStyle = G2; c.fillRect(cx - 2.5 * u, by - 32 * u, 5 * u, 18 * u);
      const cy = by - 32 * u, rx = 17 * u, ry = 5 * u;
      // 뒤쪽 깃발 → 고리 → 앞쪽 깃발 순서로 그려 입체감
      const flags = Array.from({ length: 8 }, (_, i) => -Math.PI / 2 + i * Math.PI / 4);
      const flag = a => { const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry; c.fillStyle = SV2; c.fillRect(x - 0.8 * u, y - 18 * u, 1.6 * u, 18 * u); c.fillStyle = Math.sin(a) > 0 ? G1 : '#d9b23a'; c.beginPath(); c.moveTo(x, y - 18 * u); c.lineTo(x + 8 * u, y - 14.5 * u); c.lineTo(x, y - 11 * u); c.fill(); };
      flags.filter(a => Math.sin(a) <= 0).forEach(flag);
      c.fillStyle = G2; c.beginPath(); c.ellipse(cx, cy, rx + 2 * u, ry + 2 * u, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = G1; c.beginPath(); c.ellipse(cx, cy - 1 * u, rx, ry, 0, 0, Math.PI * 2); c.fill();
      flags.filter(a => Math.sin(a) > 0).forEach(flag);
    } else if (k === 'WBC' || k === 'WBC2') {
      // 준우승은 은색 지구본
      const g1 = k === 'WBC' ? G1 : SV, g2 = k === 'WBC' ? G2 : SV2;
      base('#2b2b2b', 30, 9); c.fillStyle = SV2; c.fillRect(cx - 7 * u, by - 18 * u, 14 * u, 9 * u);
      const r = 17 * u, cy = by - 35 * u;
      c.fillStyle = g1; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = g2; c.lineWidth = 1.8 * u;
      c.beginPath(); c.ellipse(cx, cy, r * 0.45, r, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(cx - r, cy); c.lineTo(cx + r, cy); c.stroke();
      c.beginPath(); c.ellipse(cx, cy, r, r * 0.4, 0, 0, Math.PI * 2); c.stroke();
    } else if (k === 'P12' || k === 'P122') {
      base('#1f3a68', 32, 9); c.fillStyle = SV; c.fillRect(cx - 9 * u, by - 22 * u, 18 * u, 13 * u);
      c.fillStyle = k === 'P12' ? G1 : SV; star(cx, by - 40 * u, 19 * u); c.fillStyle = k === 'P12' ? G2 : SV2; star(cx, by - 40 * u, 8 * u);   // 준우승은 은색 별
    } else if (k === 'OG') medal(G1, G2, '#1f3a68', '#c4352b');
    else if (k === 'OS') medal(SV, SV2, '#1f3a68', '#c4352b');
    else if (k === 'OB') medal('#e3a06b', BR2, '#1f3a68', '#c4352b');
    else if (k === 'AG') medal(G1, G2, '#2e7d4f', '#f2f2f2');
    else if (k === 'AS') medal(SV, SV2, '#2e7d4f', '#f2f2f2');
    else if (k === 'AB') medal('#e3a06b', BR, '#2e7d4f', '#f2f2f2');
  }
  // 진열장: (x, y, w, h) 상자 안에 트로피 + 이름 + 횟수
  function drawShelf(c, list, x, y, w, h) {
    list = (list || []).filter(t => TROPHY.some(x => x[0] === t[0]));   // 64차: 없앤 종류(준우승·은·동)는 빼고 그린다
    c.fillStyle = '#f1e9d8'; roundRect(c, x, y, w, h, 12); c.fill();
    c.fillStyle = '#d9cdb3'; c.fillRect(x + 10, y + h - 40, w - 20, 3);
    if (!list.length) { c.fillStyle = '#a39a88'; c.font = '700 17px sans-serif'; c.textAlign = 'center'; c.fillText('우승 기록 없음', x + w / 2, y + h / 2 + 6); c.textAlign = 'left'; return; }
    const n = list.length, slot = w / n, s = Math.min(58, h - 50, slot * 0.7);
    const nameOf = k => TROPHY.find(t => t[0] === k)[1];
    list.forEach(([k, cnt], i) => {
      const cx = x + slot * (i + 0.5);
      drawTrophy(c, k, cx, y + h - 42, s);
      c.textAlign = 'center';
      let fs = Math.min(14, Math.max(10, slot / 6.2)); c.font = `800 ${fs}px sans-serif`;
      const nm = nameOf(k);
      while (fs > 9 && c.measureText(nm).width > slot - 4) { fs -= 0.5; c.font = `800 ${fs}px sans-serif`; }
      c.fillStyle = '#4a5163'; c.fillText(nm, cx, y + h - 22);
      c.fillStyle = '#c4352b'; c.font = `900 ${Math.min(15, Math.max(11, slot / 5.5))}px sans-serif`; c.fillText(`${cnt}회`, cx, y + h - 6);
    });
    c.textAlign = 'left';
  }
  function drawCard(d) {
    const three = Array.isArray(d.rowsP);   // 55차: 이도류는 앞면 + 타자 기록 + 투수 기록 3장
    const CW = 600, CH = 900, G = 40, W = CW * (three ? 3 : 2) + G * (three ? 4 : 3), H = CH + G * 2;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const color = d.color, isHof = d.hof != null;
    const gradC = isHof ? '#d4a52f' : ({ bronze: '#a8693a', silver: '#8d96a3', gold: '#d4a52f', legend: '#7b2ff7' }[d.grade] || '#8d96a3');
    c.fillStyle = '#efe8da'; c.fillRect(0, 0, W, H);
    const frame = x => { c.fillStyle = gradC; roundRect(c, x, G, CW, CH, 28); c.fill(); c.fillStyle = '#fbf7ee'; roundRect(c, x + 14, G + 14, CW - 28, CH - 28, 20); c.fill(); };
    // ---- 앞면 ----
    const X = G; frame(X);
    // 64차: 프로필(팀 색 영역)을 430 → 320으로 줄이고, 그 자리에 우승 트로피 진열장
    c.save(); roundRect(c, X + 14, G + 14, CW - 28, 320, 20); c.clip(); c.fillStyle = cardBg(color); c.fillRect(X + 14, G + 14, CW - 28, 320); c.restore();
    const av = document.createElement('canvas'); drawAvatar(av, d.avatar, color);
    c.imageSmoothingEnabled = false; c.drawImage(av, X + CW / 2 - 115, G + 104, 230, 230);
    c.fillStyle = '#fff'; c.textAlign = 'right'; c.font = '900 72px sans-serif'; c.fillText(String(d.ovr), X + CW - 44, G + 100);
    c.font = '800 20px sans-serif'; c.fillText('OVR', X + CW - 44, G + 126);
    c.textAlign = 'left'; c.font = '900 22px sans-serif'; c.fillText(d.team, X + 44, G + 64);
    if (isHof) {
      // 명예의 전당: 금색 리본 + 배지
      const gr = c.createLinearGradient(X + 14, 0, X + CW - 14, 0); gr.addColorStop(0, 'rgba(245,215,110,0)'); gr.addColorStop(0.15, '#f5d76e'); gr.addColorStop(0.5, '#ffe9a6'); gr.addColorStop(0.85, '#f5d76e'); gr.addColorStop(1, 'rgba(245,215,110,0)');
      c.fillStyle = gr; c.fillRect(X + 14, G + 136, CW - 28, 40); c.fillStyle = '#3b2a05'; c.font = '900 22px sans-serif'; c.textAlign = 'center'; c.fillText('★ 명예의 전당 헌액자 · ' + d.hof + ' ★', X + CW / 2, G + 164); c.textAlign = 'left';
      c.fillStyle = '#d4a52f'; roundRect(c, X + 44, G + 286, 190, 34, 8); c.fill(); c.fillStyle = '#3b2a05'; c.font = '900 18px sans-serif'; c.fillText('HALL OF FAME', X + 58, G + 310);
      if (d.retNum) {   // 65차: 영구결번 — 오른쪽 아래 남색 패
        const t = `영구결번 #${d.retNum.num}`; c.font = '900 18px sans-serif'; const tw = c.measureText(t).width + 28;
        c.fillStyle = '#1f2d55'; roundRect(c, X + CW - 44 - tw, G + 286, tw, 34, 8); c.fill(); c.strokeStyle = '#f5d76e'; c.lineWidth = 2; c.stroke();
        c.fillStyle = '#f5d76e'; c.textAlign = 'right'; c.fillText(t, X + CW - 58, G + 310); c.textAlign = 'left';
      }
    } else { c.fillStyle = gradC; roundRect(c, X + 44, G + 286, 130, 34, 8); c.fill(); c.fillStyle = '#fff'; c.font = '900 18px sans-serif'; c.fillText({ bronze: 'BRONZE', silver: 'SILVER', gold: 'GOLD', legend: 'LEGEND' }[d.grade] || '', X + 58, G + 310); }
    c.fillStyle = '#c4352b'; c.font = '900 46px sans-serif'; c.fillText(String(d.num), X + 44, G + 392);
    c.fillStyle = '#1b2233'; c.font = '900 44px sans-serif'; c.fillText(d.name, X + 44 + c.measureText(String(d.num)).width + 60, G + 392);
    c.font = '600 19px sans-serif'; c.fillStyle = '#4a5163';
    c.fillText(d.info, X + 44, G + 426);
    // 우승 트로피 (예전에 저장된 카드는 업적 목록에서 다시 센다)
    drawShelf(c, Array.isArray(d.troph) ? d.troph : trophyList(d.aw), X + 36, G + 442, CW - 72, 128);
    const pair = d.stats.length && d.stats[0].length >= 4;
    if (pair) {
      // 범례: 막대 = 주 능력, 세로선 = 반대쪽 능력
      const main = d.twMain || '주', opp = main === '투구' ? '타격' : '투구';
      c.textAlign = 'right'; c.font = '700 15px sans-serif'; c.fillStyle = '#858a96';
      const lx = X + CW - 44; c.fillText(`막대 ${main} · 선 ${opp}`, lx, G + 584); c.textAlign = 'left';
    }
    d.stats.forEach(([label, val, label2, val2], i) => {
      const y = G + 600 + i * 42;
      if (label2 != null) {
        c.fillStyle = '#4a5163'; c.font = '700 18px sans-serif'; c.fillText(`${label}/${label2}`, X + 44, y + 15);
        const bx = X + 196, bw = 250;
        c.fillStyle = '#e6dfd0'; roundRect(c, bx, y, bw, 16, 8); c.fill();
        c.fillStyle = val >= 80 ? '#c4352b' : '#1f3a68'; roundRect(c, bx, y, Math.max(16, bw * val / 100), 16, 8); c.fill();
        const lxx = bx + Math.min(bw - 2, Math.max(2, bw * val2 / 100));
        c.fillStyle = '#fbf7ee'; c.fillRect(lxx - 3.5, y - 7, 7, 30);
        c.fillStyle = '#e0a526'; c.fillRect(lxx - 2, y - 6, 4, 28);
        c.fillStyle = '#1b2233'; c.font = '900 20px sans-serif'; c.textAlign = 'right'; c.fillText(`${val}/${val2}`, X + CW - 44, y + 17); c.textAlign = 'left';
        return;
      }
      c.fillStyle = '#4a5163'; c.font = '700 20px sans-serif'; c.fillText(label, X + 44, y + 16);
      c.fillStyle = '#e6dfd0'; roundRect(c, X + 140, y, 340, 16, 8); c.fill();
      c.fillStyle = val >= 80 ? '#c4352b' : '#1f3a68'; roundRect(c, X + 140, y, Math.max(16, 340 * val / 100), 16, 8); c.fill();
      c.fillStyle = '#1b2233'; c.font = '900 22px sans-serif'; c.textAlign = 'right'; c.fillText(String(val), X + CW - 44, y + 17); c.textAlign = 'left';
    });
    // 55차: 맨 아래칸에 한줄평 (예전 'FINAL · 게임 이름' 자리). 길면 글자를 줄이고, 그래도 길면 두 줄로
    if (d.line) {
      const txt = `“${String(d.line)}”`, maxW = CW - 88;
      c.fillStyle = '#4a5163';
      let fs = 19; c.font = `italic 700 ${fs}px sans-serif`;
      while (fs > 15 && c.measureText(txt).width > maxW) { fs--; c.font = `italic 700 ${fs}px sans-serif`; }
      if (c.measureText(txt).width <= maxW) c.fillText(txt, X + 44, G + CH - 38);
      else {
        let cut = Math.ceil(txt.length / 2); const sp = txt.lastIndexOf(' ', cut); if (sp > 6) cut = sp;
        c.fillText(txt.slice(0, cut).trim(), X + 44, G + CH - 60); c.fillText(txt.slice(cut).trim(), X + 44, G + CH - 36);
      }
    }
    // ---- 뒷면 (이도류: 타자 기록, 투수 기록 두 장) ----
    // 64차: 업적은 자르지 않고 전부 — 다 들어가도록 기록표 줄 간격(lh)과 업적 글씨(fs)를 줄여 가며 맞춘다.
    //   그래도 넘치면 이도류는 투수 기록 뒷면에 이어서, 아니면 마지막 칸에 '외 N개'
    // 64차: 뒷면에는 개인 수상만 — 리그 우승·국제대회 우승/메달/준우승은 앞면 트로피로 간다.
    //   이도류는 타자 수상은 타자 뒷면, 투수 수상은 투수 뒷면, 둘 다 해당하는 상(MVP·신인왕·대회 MVP 등)은 주 포지션 쪽
    const bare = a => a.replace(/ \(\d+회\)$/, '');
    const isChamp = a => /(우승|금메달|은메달|동메달)$/.test(bare(a));
    const isPitAw = a => /(올해의 투수상|다승왕|평균자책점왕|세이브왕|탈삼진왕|투수 골든글러브|대회 탈삼진 1위)$/.test(bare(a));
    const isBatAw = a => !isPitAw(a) && /(타격왕|홈런왕|타점왕|도루왕|안타왕|골든글러브|대회 홈런 1위)$/.test(bare(a));
    const awAll = mergeAw((d.aw || []).filter(awKeep)).filter(a => !isChamp(a));
    const mainPit = d.twMain === '투구';
    const awBat = three ? awAll.filter(a => isBatAw(a) || (!isPitAw(a) && !mainPit)) : awAll;
    const awPit = three ? awAll.filter(a => isPitAw(a) || (!isBatAw(a) && mainPit)) : [];
    const chipLayout = (list, BX, y0, fs, short) => {
      c.font = `800 ${fs}px sans-serif`;
      const pad = Math.round(fs * 0.6), ch = Math.round(fs * 1.75), step = ch + 6, out = [];
      let ax = BX + 40, y = y0;
      for (let a of list) {
        if (short || c.measureText(a).width + pad * 2 > CW - 80) a = a.replace(/\b(19|20)(\d\d)\b/g, "'$2");   // '29~'31 처럼 줄여 쓴다
        const w = Math.min(CW - 80, c.measureText(a).width + pad * 2);
        if (ax + w > BX + CW - 40) { ax = BX + 40; y += step; }
        out.push({ a, x: ax, y, w, ch, pad }); ax += w + 8;
      }
      return out;
    };
    const back = (BX, isP, rows, total, title, awList) => {
      frame(BX);
      c.textAlign = 'left';
      c.fillStyle = '#1b2233'; c.font = '900 30px sans-serif'; c.fillText(`${d.name}  #${d.num}`, BX + 40, G + 76);
      c.font = '600 18px sans-serif'; c.fillStyle = '#4a5163'; c.fillText(title, BX + 40, G + 106);
      c.fillStyle = '#1b2233'; c.fillRect(BX + 40, G + 118, CW - 80, 3);
      // 62차(cv 2): 한글 머리글 · 요청 순서. 예전에 저장된 카드(cv 없음)는 예전 칸 순서 그대로 그린다
      const v2 = d.cv >= 2;
      const cols = v2 ? (isP ? ['연도', '팀', 'ERA', '경기', '승', '패', '세이브', '홀드', '이닝', '탈삼진', 'WAR'] : ['연도', '팀', '경기', '타율', '타수', '안타', '홈런', '타점', '도루', '출루율', 'OPS', 'WAR'])
        : isP ? ['연도', '팀', '경기', '승', '패', '세이브', '이닝', 'ERA', '탈삼진', 'WAR'] : ['연도', '팀', '경기', '타율', '홈런', '타점', '도루', 'OPS', 'WAR'];
      const cx = v2 ? (isP ? [0, 36, 118, 166, 204, 236, 268, 316, 356, 408, 462] : [0, 32, 100, 146, 186, 232, 276, 310, 352, 386, 432, 478])
        : isP ? [0, 44, 150, 196, 236, 276, 322, 386, 446, 500] : [0, 44, 160, 214, 278, 322, 372, 418, 494];
      const nR = rows && rows.length ? rows.length : 1, limit = G + CH - 62;
      // 업적이 다 들어가는 가장 큰 (줄 간격, 글씨) 조합을 찾는다
      let lh = 22, chips = [], afs = 17;
      if (awList && awList.length) {
        let best = null;
        search: for (const L of [22, 20, 18, 16]) for (const f of [17, 16, 15, 14, 13, 12, 11]) for (const sh of [false, true]) {
          const y0 = G + 180 + nR * L + 14 + (f >= 15 ? 40 : 32), lay = chipLayout(awList, BX, y0, f, sh);
          if (lay[lay.length - 1].y + 8 <= limit) { best = { L, f, lay }; break search; }
        }
        if (!best) { const L = 16, f = 11; best = { L, f, lay: chipLayout(awList, BX, G + 180 + nR * L + 14 + 32, f, true) }; }
        lh = best.L; afs = best.f; chips = best.lay;
      }
      const fs0 = v2 ? (isP ? 14 : 13) : 16;   // 타자는 칸이 12개라 한 단계 작게 (통산 4자리 숫자끼리 붙지 않게)
      const fs = Math.min(fs0, lh - 5);
      const line = (vals, y, bold, head) => { c.font = `${bold ? 800 : 600} ${head && v2 ? 13 : fs}px sans-serif`; vals.forEach((t, i) => c.fillText(String(t), BX + 44 + cx[i], y)); };
      c.fillStyle = '#858a96'; line(cols, G + 150, true, true);
      let y = G + 180;
      c.fillStyle = '#1b2233';
      for (const r of rows || []) { line(r, y); y += lh; }
      if (!rows || !rows.length) { c.font = '600 18px sans-serif'; c.fillText('1군 기록 없음', BX + 44, y); y += lh; }
      c.fillStyle = '#1b2233'; c.fillRect(BX + 40, y - 12, CW - 80, 2); y += 14;
      if (total) line(total, y, true);
      // 업적 칩: 넘치는 것은 다음 장으로 넘긴다
      const shown = chips.filter(k => k.y + 8 <= limit), rest = (awList || []).slice(shown.length);
      c.font = `800 ${afs}px sans-serif`; c.fillStyle = '#c4352b'; c.strokeStyle = '#c4352b'; c.lineWidth = 2;
      for (const k of shown) { roundRect(c, k.x, k.y - Math.round(afs * 1.3), k.w, k.ch, 7); c.stroke(); c.fillText(k.a, k.x + k.pad, k.y); }
      c.fillStyle = '#858a96'; c.font = '600 16px sans-serif'; c.fillText(d.teams || '', BX + 40, G + CH - 36);
      return rest;
    };
    const more = (BX, rest) => { if (rest.length) { c.fillStyle = '#c4352b'; c.font = '800 13px sans-serif'; c.textAlign = 'right'; c.fillText(`외 ${rest.length}개`, BX + CW - 40, G + CH - 36); c.textAlign = 'left'; } };
    if (three) {
      more(G * 2 + CW, back(G * 2 + CW, false, d.rows, d.total, '타자 기록 (1군)', awBat));
      more(G * 3 + CW * 2, back(G * 3 + CW * 2, true, d.rowsP, d.totalP, '투수 기록 (1군)', awPit));
    } else more(G * 2 + CW, back(G * 2 + CW, d.isP, d.rows, d.total, '연도별 기록 (1군)', awAll));
    return cv;
  }
  function cardImage(d) {
    d = d || cardData(App.st);
    drawCard(d).toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${d.name}_야구카드.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  // ================================================================
  // 렌더 & 이벤트
  // ================================================================
  function render() {
    let html;
    if (App.view === 'home') html = viewHome();
    else if (App.view === 'create') html = viewCreate();
    else if (App.view === 'main') html = viewMain();
    else if (App.view === 'result') html = viewResult();
    else if (App.view === 'loading') html = viewLoading();
    else if (App.view === 'regular') html = viewRegular();
    else if (App.view === 'post') html = viewPost();
    else if (App.view === 'intl') html = viewIntl();
    else if (App.view === 'retire') html = viewRetire();
    else if (App.view === 'guide') html = viewGuide();
    else if (App.view === 'notice') html = viewNotice();
    else if (App.view === 'patch') html = viewPatch();
    else if (App.view === 'lineup') html = viewLineup();
    $app.innerHTML = html;
    if (App.view === 'create') afterCreate();
    if (App.view === 'home') { startHero(); drawPodium(); }
    if (App.view === 'lineup') drawPodium();
    if (App.view === 'main' || App.view === 'retire') afterCard();
    // 59차: 우승 애니메이션이 떠 있는 동안 같은 화면이 다시 그려져도(국제대회 마지막 경기 0.8초 뒤 등) 지우지 않는다 — '계속'을 눌러야 닫힘
    const troOpen = App.troView && App.troView === App.view && $modal.querySelector('.tro-overlay');
    if (App.troView && App.troView !== App.view) App.troView = null;
    if (App.view !== 'main' && !troOpen) $modal.innerHTML = '';
    if (App.view === 'home' && App.noticePop) noticeModal();   // 51차: 홈이 다시 그려져도 공지 팝업 유지
    if (!troOpen && (App.view === 'post' || App.view === 'result' || App.view === 'intl')) maybeTrophy();
    if (App.view === 'retire' && App.st && App.st.final && App.st.final.hof && App.st.final.hof.in && !App.st._hofSeen) showHof();
  }
  // 진행 단계 수 — 이번 업데이트 이후 만든 선수만, 단계마다 한 번씩
  function milestones(st) {
    const me = st.me, m = me && me.flags && me.flags.ms;
    if (!m) return;
    const n = st.hist.length, hit = {
      pro: !!me.draft, debut: me.debut != null, starter: !!me.everStarter,
      s3: n >= 3, s6: n >= 6, s10: n >= 10, s15: n >= 15,
    };
    for (const k in hit) if (hit[k] && !m[k]) { m[k] = 1; bump('m_' + k); }
  }
  function goAfterSeason() {
    const st = App.st;
    milestones(st);
    if (st.done) { App.view = 'retire'; App.flipped = false; recordRetire(); render(); window.scrollTo(0, 0); return; }
    App.view = 'main'; render(); window.scrollTo(0, 0);
    if (st.pending.length) showEvent();
  }
  function playSeason() {
    const st = App.st;
    if (st.pending.length) { showEvent(); return; }
    if (App.view === 'loading') return;
    // 시즌은 미리 계산해 두고, 국가대표에 뽑혔으면 로딩 도중 멈춰서 소집 결정 → 대회 결과 → 로딩 재개 → 시즌 결산
    const year = st.year, stage = st.me.stage;
    const res = Sim.playSeason(st);
    if (!res) { App.view = 'main'; render(); return; }
    App.res = res;
    save();
    const finish = () => {
      // 프로: 정규시즌 결산 → 포스트시즌(시리즈별) → 시즌 결산. 아마추어는 바로 결과.
      App.view = res.stage === 'pro' && res.league && res.league.post ? 'regular' : 'result';
      App.ps = { idx: 0, shown: 0, playing: false };
      render(); window.scrollTo(0, 0);
    };
    const call = st.pending.length && st.pending[0].id === 'intlCall';
    startLoading(finish, null, { year, stage, pauseAt: call ? 0.55 : null, onPause: resume => { App.afterIntl = resume; showEvent(); } });
  }
  const nextIsCall = () => !!(App.st && App.st.pending.length && App.st.pending[0].id === 'intlCall');
  function autoPlay() {
    const st = App.st;
    let g = 0;
    while (!st.done && g++ < 40) {
      while (st.pending.length) Sim.choose(st, st.pending[0].safe || 0);
      if (st.done) break;
      App.res = Sim.playSeason(st);
    }
    while (st.pending.length) Sim.choose(st, st.pending[0].safe || 0);
    save(); goAfterSeason();
  }

  // 14차: 확인창(confirm) 대신 '한 번 더 누르기' — 앱 안 브라우저에서 확인창이 안 뜨는 경우가 있어서
  function armed(key, el, msg) {
    if (App._armed === key && Date.now() - App._armedAt < 4000) { App._armed = null; return true; }
    App._armed = key; App._armedAt = Date.now();
    if (el) { el.dataset.orig = el.dataset.orig || el.textContent; el.textContent = msg; el.classList.add('armed'); setTimeout(() => { if (App._armed === key) { App._armed = null; el.textContent = el.dataset.orig; el.classList.remove('armed'); } }, 4000); }
    return false;
  }
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act, v = el.dataset.v;
    if (App.view === 'create' && act !== 'cr-start') readCreateInputs();
    switch (act) {
      case 'dev': if (!App.admin) break; App.dev = !App.dev; store.set(KEY_DEV, App.dev); render(); if (App.view === 'main' && App.st && App.st.pending.length && $modal.innerHTML === '') { } break;
      case 'home': App.view = 'home'; render(); window.scrollTo(0, 0); break;
      case 'page': App.view = v; if (v === 'notice' || v === 'patch') markSeen(v); render(); window.scrollTo(0, 0); break;
      case 'continue': App.st = loadSave(); App.view = App.st.done ? 'retire' : 'main'; App.flipped = false; render(); if (App.view === 'main' && App.st.pending.length) showEvent(); break;
      case 'new': newCreate(); App.view = 'create'; render(); window.scrollTo(0, 0); break;
      case 'cr-tf': { const tf = App.create.tf || []; const i = tf.indexOf(v); if (i >= 0) tf.splice(i, 1); else { tf.push(v); if (tf.length > 2) tf.shift(); } App.create.tf = tf; render(); break; }
      case 'cr-role': App.create.role = v; App.create.pos = v === 'P' ? 'SP' : 'SS'; App.create.pick = 0; App.create.tf = v === 'P' ? ['vel', 'ctl'] : ['con', 'pow']; App.create.candSeed = (Math.random() * 1e9) >>> 0; rollCands(); render(); break;
      case 'cr-pos': App.create.pos = v; rollCands(); render(); break;
      case 'cr-school': {
        const c = App.create; c.school = v;
        if (v === 'strong' && !c.hsName) { const s = GAME_DATA.eliteSchools.find(x => x.team === c.hometown) || GAME_DATA.eliteSchools[0]; c.hsName = s.name; c.hometown = s.team; }
        render(); break;
      }
      case 'cr-pick': App.create.pick = +v; render(); break;
      case 'cr-reroll': App.create.candSeed = (Math.random() * 1e9) >>> 0; App.create.pick = 0; rollCands(); render(); break;
      case 'cr-ava': App.create.avatar = (Math.random() * 1e6) | 0; render(); break;
      case 'cr-start': startCareer(); bump('create'); if (App.st && App.st.me) { App.st.me.flags.pos0 = App.st.me.flags.closer ? 'CL' : App.st.me.pos; App.st.me.flags.t0 = Date.now(); App.st.me.flags.ms = {}; App.st.me.flags.r0 = abilOf(App.st.me.r); App.st.me.flags.role0 = App.st.me.role; save(); bump('pos_' + App.st.me.flags.pos0); } break;
      case 'flip': App.flipped = !App.flipped; el.classList.toggle('flipped', App.flipped); break;
      case 'tab': App.tab = v; render(); break;
      case 'lgcat': App.lgCat = v; render(); break;
      case 'lgteam': App.lgTeam = App.lgTeam === v || !v ? null : v; render(); break;
      case 'lgid': App.lgId = v; App.lgTeam = null; render(); break;
      case 'reckind': App.recKind = v; render(); break;
      case 'recsort': if ((App.recKind || 'bat') === 'bat') App.recBat = v; else App.recPit = v; render(); break;
      case 'rossort-b': App.rosBat = v; render(); break;
      case 'rossort-p': App.rosPit = v; render(); break;
      case 'compkey': App.compKey = v; render(); break;
      case 'lu-tab': App.lu.tab = v; render(); break;
      case 'admin': if (!App.admin) break; App.dev = !App.dev; store.set(KEY_DEV, App.dev); render(); break;
      case 'play': playSeason(); break;
      case 'next-event': showEvent(); break;
      case 'auto': autoPlay(); break;
      case 'res-next': goAfterSeason(); break;
      case 'ps-start': App.view = 'post'; render(); window.scrollTo(0, 0); break;
      case 'ps-play': psPlay(); break;
      case 'ps-all': App.ps.idx = App.res.league.post.rounds.length; App.ps.playing = false; render(); window.scrollTo(0, 0); break;
      case 'ps-skip': case 'ps-done': App.view = 'result'; render(); window.scrollTo(0, 0); break;
      case 'choose': {
        const cur = Sim.pendingItem(App.st), curId = cur && cur.id, curTid = cur && cur.ctx && cur.ctx.tid;
        const r = Sim.choose(App.st, +v);
        save();
        // 결과 화면의 국제대회 칸에 소집 결과를 적어 둔다
        if (curId === 'intlCall' && App.res && App.res.intl) { const e = App.res.intl.find(x => x.id === curTid); if (e) e.outcome = r && r.intl ? r.intl.result : '소집 고사'; }
        showReaction(r ? r.reaction : '', () => {
          if (App.st.done) { $modal.innerHTML = ''; App.view = 'retire'; recordRetire(); render(); window.scrollTo(0, 0); return; }
          if (r && r.intl) { $modal.innerHTML = ''; App.intlRes = r.intl; App.intlShown = 0; App.intlInn = 0; App.view = 'intl'; render(); window.scrollTo(0, 0); intlReveal(); return; }
          if (curId === 'intlCall' && nextIsCall()) { showEvent(); return; }   // 61차: 같은 해 다음 대회 소집
          if (curId === 'intlCall' && App.afterIntl) { $modal.innerHTML = ''; const f = App.afterIntl; App.afterIntl = null; f(); return; }
          if (App.st.pending.length) showEvent(); else { $modal.innerHTML = ''; render(); }
        }, r);
        break;
      }
      case 'react-ok': { const f = App._after; App._after = null; if (f) f(); break; }
      case 'retire-now': if (armed('retire', el, '한 번 더 누르면 은퇴')) { Sim.voluntaryRetire(App.st); save(); App.view = 'retire'; recordRetire(); render(); window.scrollTo(0, 0); } break;
      case 'share': shareImage(); break;
      case 'cardimg': cardImage(); break;
      case 'reccard': showRecCard(v); break;
      case 'notice-close': if (el.classList.contains('notice-overlay') && e.target.closest('.notice-pop')) break; App.noticePop = false; markSeen('notice'); $modal.innerHTML = ''; render(); break;
      case 'notice-all': App.noticePop = false; markSeen('notice'); App.view = 'notice'; render(); window.scrollTo(0, 0); break;
      case 'reccard-save': if (App._recCard) cardImage(App._recCard); break;
      case 'reccard-close': if (el.classList.contains('card-overlay') && e.target.closest('.card-box')) break; $modal.innerHTML = ''; break;
      case 'hof-ok': if (e.target.closest('.hof-box') && !e.target.closest('[data-act="hof-ok"].btn')) break; App.st._hofSeen = true; save(); $modal.innerHTML = ''; window.scrollTo(0, 0);
        if (ensureRetNum(App.st) && !App.st._retSeen) showRetNum();   // 65차: 헌액식 다음 영구결번식
        break;
      case 'ret-ok': if (e.target.closest('.hof-box') && !e.target.closest('[data-act="ret-ok"].btn')) break; App.st._retSeen = true; save(); $modal.innerHTML = ''; window.scrollTo(0, 0); break;
      case 'hof-replay': showHof(); break;
      case 'trophy-ok': if (e.target.closest('.tro-box') && !e.target.closest('[data-act="trophy-ok"].btn')) break; $modal.innerHTML = ''; App.troView = null; break;
      case 'intl-skip': App.intlShown = App.intlRes.games.length; render(); break;
      case 'intl-done': App.intlRes = null; if (nextIsCall()) { showEvent(); break; } if (App.afterIntl) { const f = App.afterIntl; App.afterIntl = null; f(); break; } App.view = 'main'; render(); window.scrollTo(0, 0); if (App.st.pending.length) showEvent(); break;
      case 'tf-open': App.tfOpen = true; App.tfPick = []; render(); break;
      case 'tf-close': App.tfOpen = false; App.tfPick = []; render(); break;
      case 'tf-pick': { const a = App.tfPick || []; const i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else { a.push(v); if (a.length > 2) a.shift(); } App.tfPick = a; render(); break; }
      case 'tf-apply': if (armed('tf', el, '한 번 더 누르면 확정') && Sim.changeFocus(App.st, App.tfPick)) { App.tfOpen = false; App.tfPick = []; save(); render(); } break;
      case 'post': if (armed('post', el, '한 번 더 누르면 신청') && Sim.requestPosting(App.st)) { save(); startLoading(() => { App.view = 'main'; render(); window.scrollTo(0, 0); showEvent(); }, 'post'); } break;
      case 'recopen': App.recOpen = App.recOpen === v ? null : v; render(); break;
    }
  });
  document.addEventListener('change', e => {
    if (App.view !== 'create') return;
    if (e.target.id === 'cr-home') { App.create.hometown = e.target.value; readCreateInputs(); render(); }
    if (e.target.id === 'cr-hs') { readCreateInputs(); render(); }
  });

  // 27차: 패치가 배포되면 열려 있는 탭에 새로고침 안내 — 예전 코드로 계속 플레이하는 일을 막는다
  // 42차: 게임 파일 5개(약 380KB)를 20초마다 받던 방식 → index.html(1KB)의 빌드 번호만 확인. 배포 주소는 5분마다 + 탭으로 돌아올 때, 로컬은 20초마다
  (function watchUpdate() {
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    const mine = window.GAME_BUILD || 0;
    let busy = false, last = 0, base = null;
    // 로컬(내 컴퓨터)에서는 빌드 번호를 안 올려도 파일이 바뀌면 알려 준다 (개발용)
    const files = ['sim.js', 'ui.js', 'data.js', 'content.js', 'style.css'];
    const sig = () => Promise.all(files.map(f => fetch(f + '?_=' + Date.now(), { cache: 'no-store' }).then(r => r.text()).then(t => t.length + ':' + t.slice(-200)))).then(a => a.join('|')).catch(() => null);
    if (local) sig().then(s => { base = s; });
    const tick = () => {
      if (busy || document.getElementById('upd-bar')) return;
      if (local) { sig().then(s => { if (s && base && s !== base) showBar(); }); return; }
      busy = true; last = Date.now();
      fetch('index.html?_=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.text() : '').then(t => {
        const m = /GAME_BUILD\s*=\s*(\d+)/.exec(t || '');
        if (m && +m[1] > mine) showBar();
      }).catch(() => { }).then(() => { busy = false; });
    };
    const showBar = () => {
      if (document.getElementById('upd-bar')) return;
      const bar = document.createElement('div');
      bar.id = 'upd-bar';
      bar.style.cssText = 'position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:9999;background:var(--gold,#e0b341);color:#111;padding:8px 12px;border-radius:10px;font-weight:700;font-size:14px;box-shadow:0 4px 16px rgba(0,0,0,.35);display:flex;gap:10px;align-items:center;max-width:calc(100% - 32px)';
      bar.innerHTML = '<span>게임이 업데이트됐어요</span><button style="border:0;border-radius:8px;padding:5px 10px;font-weight:800;cursor:pointer">새로고침</button>';
      bar.querySelector('button').onclick = () => { try { save(); } catch (e) { } location.reload(); };
      document.body.appendChild(bar);
    };
    setInterval(tick, local ? 20000 : 300000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - last > 60000) tick(); });
  })();

  (function countVisit() {
    // 접속 = 순방문자: 기기마다 한국 날짜로 하루 한 번
    try {
      const d = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
      if (localStorage.getItem('dugout_uv') !== d) setTimeout(() => {
        if (!statOK()) return;
        localStorage.setItem('dugout_uv', d); bump('uv');
      }, 1500);
    } catch (e) { }
  })();

  (function adminLink() {
    let q = null;
    try { q = new URLSearchParams(location.search).get('admin'); } catch (e) { }
    if (q == null) return;
    const clean = () => { try { const u = new URL(location.href); u.searchParams.delete('admin'); history.replaceState(null, '', u.pathname + (u.search || '') + u.hash); } catch (e) { } };
    if (q === 'off') { store.del(KEY_ADMIN); store.set(KEY_DEV, false); App.admin = false; App.dev = false; clean(); render(); return; }
    if (!(window.crypto && crypto.subtle)) { clean(); return; }
    sha256(q).then(h => {
      if (h === ADMIN_HASH) { store.set(KEY_ADMIN, q); App.admin = true; App.dev = !!store.get(KEY_DEV, false); logAdmin('login'); markAdminSession(); }
      else logAdmin('fail');
      clean(); render();
    }).catch(clean);
  })();
  function devId() {
    let d = store.get('dugout_devid', null);
    if (typeof d !== 'string' || !d) { d = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); store.set('dugout_devid', d); }
    return d;
  }
  function logAdmin(kind) {
    if (!LB_ON || LOCALHOST) return;
    lbFetch('rpc/log_admin', { method: 'POST', body: JSON.stringify({ k: kind, dev: devId(), agent: (navigator.userAgent || '').slice(0, 300) }) }).catch(() => { });
  }
  function markAdminSession() { try { sessionStorage.setItem('dugout_admin_seen', '1'); } catch (e) { } }
  function adminSessionLogged() { try { return sessionStorage.getItem('dugout_admin_seen') === '1'; } catch (e) { return false; } }
  (function adminCheck() {
    const k = store.get(KEY_ADMIN, null);
    if (typeof k !== 'string' || !k || !(window.crypto && crypto.subtle)) return;
    sha256(k).then(h => {
      if (h === ADMIN_HASH) { App.admin = true; App.dev = !!store.get(KEY_DEV, false); if (!adminSessionLogged() && !/[?&]admin=/.test(location.search)) { logAdmin('session'); markAdminSession(); } render(); }
      else store.del(KEY_ADMIN);
    }).catch(() => { });
  })();

  // 디버그·테스트용 핸들
  window.__app = App;
  window.__card = { drawCard, cardData, histTables, retiredNumber, render: () => render() };   // 64차: 카드 확인용
  // 51차: 게임에 처음 들어올 때 아직 안 본 공지가 있으면 팝업으로 알린다
  if (CT.notices.length && isNew('notice')) App.noticePop = true;
  render();
})();
