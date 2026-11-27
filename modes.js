// 골글 들고 명전으로 — 확장판 엔진 (선수 보관함 · 리그모드 · 온라인모드 베타)
// 화면(modes-ui.js)과 분리. 모든 경기는 (시즌 시드, 경기 ID)로 난수를 만들어서
// 월별로 진행하든 한 번에 진행하든, 같은 경기를 다시 돌려도 결과가 똑같다.
const Modes = (function () {
  'use strict';
  const DATA = (typeof GAME_DATA !== 'undefined') ? GAME_DATA : require('./data.js');
  const S = (typeof Sim !== 'undefined') ? Sim : require('./sim.js');
  const I = S._internal;

  // ================================================================
  // 확장판 밸런스 상수 (여기만 고치면 된다)
  // ================================================================
  const MB = {
    vaultPerPos: 3,             // 포지션별 보관 슬롯 (불펜·마무리는 vaultCap)
    vaultCap: { SP: 6, RP: 7, CL: 2 }, // 선발 6(그중 5명 로테이션) · 불펜 7(그중 5명 라인업) · 마무리 2
    regInn: 11,                 // 정규시즌 연장 한도 (넘으면 무승부)
    postInn: 15,                // 포스트시즌 연장 한도
    spPullRuns: 6,              // 선발이 이만큼 실점하면 (2이닝 이상 던졌을 때) 강판
    relOuts: { CL: 3, SU: 3, MR: 6, LR: 9 },   // 구원 투수 한 번 등판 최대 아웃
    relRunsPull: 3,             // 구원이 한 번 등판에서 이만큼 실점하면 교체
    defK: 0.0016,               // 팀 수비 점수 1당 인플레이 안타 확률 변화
    sbK: 5.5,                   // 도루 시도: 1루 주자가 타석마다 (원작 600타석당 시도 수 / 600) × sbK 확률로 뛴다
    // 타자·투수 맞대결 보정: 원작은 타자·투수를 따로 계산해서, 맞대결로 곱하면 공격이 조금 세진다 → 리그 평균을 KBO 수준으로
    tune: { bb: 0.93, k: 1.04, hr: 0.8, babip: 0.955 },
    // 자기 포지션이 아닌 곳을 맡을 때 감점 (내부 눈금). 같은 내야끼리는 절반
    offPos: { def: 20, arm: 12, bat: 3, catcher: 30, rpAsSp: 12 },
    league: { games: 144, teams: 10 },
    // 온라인모드: 리그모드와 같은 10팀 144경기. 다른 9팀은 유저 구단 (베타: 가상 유저가 키운 선수 몇 명을 보유)
    online: { userCards: [4, 8], userBase: [60, 78] },   // 가상 유저 구단당 보관함 선수 수 · 능력 (내부 눈금)
    plat: { same: { bb: 0.94, k: 1.08, hr: 0.88, babip: 0.98 }, opp: { bb: 1.03, k: 0.97, hr: 1.05, babip: 1.01 } },   // 좌우 상성: 같은 손 타자 불리 · 반대 손 유리
    homeAdv: 0.02,   // 홈 어드밴티지: 홈 타자 볼넷·홈런 +2% 삼진 −2%, 원정은 반대
    // 작전 카드 효과 (다음 한 타석, 곱하기): k 삼진 · bb 볼넷 · hr 홈런 · babip 인플레이 안타 · dp 병살 · np 투구 수
    tacs: {
      out: { k: 1.05, bb: 1.08, hr: 0.88 }, ins: { k: 1.03, babip: 0.97, hr: 1.05 }, low: { hr: 0.75, babip: 1.02, dp: 1.5 }, high: { k: 1.1, hr: 1.15 },
      slow: { k: 1.06, bb: 1.04, np: 1.1 }, weak: { babip: 0.95, k: 0.92, dp: 1.4, np: 0.9 }, edge: { k: 1.08, bb: 1.15, np: 1.15 }, nohr: { hr: 0.7, bb: 1.1 }, guard: {},
      power: { hr: 1.15, k: 1.08 }, oppo: { k: 0.92, hr: 0.85, babip: 1.03 }, pull: { hr: 1.1, babip: 0.98 }, wait: { bb: 1.2, k: 1.08, np: 1.2 }, first: { bb: 0.7, k: 0.9, np: 0.6 }, contact: { k: 0.85, hr: 0.8, np: 1.15 },
    },
    // 주전 휴식: 정규시즌에 주전 타자가 가끔 쉬고, 그 자리에 맞는 후보가 나간다 (맞는 후보가 없으면 쉬지 않는다). 포수는 더 자주. 포스트시즌엔 안 쉰다
    rest: { bat: 0.07, C: 0.12 },
    inj: { bat: 0.0005, pit: 0.001 },   // 부상: 출전 타자 경기당 0.05%, 등판 투수 0.1%(투구 수 많을수록 조금 더) — 내 구단 한 시즌 1~2번쯤
    np: { spBase: 90, spSta: 0.6, rp: 30 },   // 투구 수: 선발 교체 목표 = 90 + (체력−50)×0.6 (±), 구원은 30구 안팎
    sub: { phInn: 7, phGap: 3, phK: 1.0, defInn: 8, defGap: 3 },   // 대타: 7회부터 · 3점 차 이내 지거나 동점 · 타격이 더 나은 후보 / 대수비: 8회부터 1~3점 앞설 때 수비가 +3(내부) 이상 좋은 후보
    err: { base: 0.032, k: 60 },   // 실책: 인플레이 아웃 타구 중 기본 3.2%가 실책, 야수 평균 수비(내부)가 60보다 낮을수록 늘고 높을수록 준다
    cond: { use: 8, perOut: 5, perPitch: 0.9, recBase: 18, recSta: 0.12, minRel: 35, tired: [[70, 0], [50, 2.5], [30, 5], [0, 8]] },   // tired: [체력 이상, 감소량(내부 눈금)] — 70 이상 없음, 50~69 약 −3, 30~49 약 −6, 30 미만 약 −10 (화면 눈금)   // 투수 체력: 등판 기본 소모 + 아웃당 소모(체력 능력치가 높을수록 덜), 하루 회복(기초 + 체력 능력치 비례), 불펜 등판 최소 체력
  };

  // ================================================================
  // 난수 (경기 ID별)
  // ================================================================
  function hash(str) { let h = 2166136261 >>> 0; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function makeRng(seed) {
    let s = seed >>> 0;
    const f = function () {
      let t = (s = (s + 0x6D2B79F5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.int = (a, b) => a + Math.floor(f() * (b - a + 1));
    f.range = (a, b) => a + f() * (b - a);
    f.chance = p => f() < p;
    f.pick = a => a[Math.floor(f() * a.length)];
    f.gauss = () => { let u = 0; while (u === 0) u = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * f()); };
    f.shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    return f;
  }
  const rngFor = (seed, key) => makeRng(hash(seed + '|' + key));
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // ================================================================
  // 포지션
  // ================================================================
  const BAT_POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
  const VAULT_POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'SP', 'RP', 'CL'];   // 마무리(CL)는 따로 보관 — 경기에서는 불펜(RP)으로 계산
  const POS_KO = { C: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: '유격수', LF: '좌익수', CF: '중견수', RF: '우익수', OF: '외야수', DH: '지명타자', SP: '선발투수', RP: '불펜투수', CL: '마무리', SU: '셋업', MR: '중간계투', TW: '이도류' };
  const simPos = p => (p === 'LF' || p === 'CF' || p === 'RF') ? 'OF' : p === 'CL' ? 'RP' : p;
  // 이 선수가 그 자리를 '자기 포지션'으로 맡을 수 있나 (외야도 좌·중·우 정확히 같아야 함, DH는 누구나, 마무리는 불펜)
  function natural(p, slot) {
    if (slot === 'DH') return true;
    const a = p.pos === 'CL' ? 'RP' : p.pos, b = slot === 'CL' ? 'RP' : slot;
    return a === b;
  }
  // 포지션 불일치: 자기 포지션이 아닌 자리를 맡으면 그 경기 능력치가 떨어진다
  //   수비·어깨가 크게, 타격(컨택·파워·선구안)도 조금. 같은 내야끼리·같은 외야끼리는 절반, 포수는 더 크게.
  //   불펜투수를 선발로 쓰면 체력이 떨어진다 (선발·이도류를 불펜으로 쓰는 건 감점 없음)
  const GRP = { C: 'C', '1B': 'IF', '2B': 'IF', '3B': 'IF', SS: 'IF', LF: 'OF', CF: 'OF', RF: 'OF', OF: 'OF', DH: 'DH' };
  function offPenalty(p, slot) {
    if (!p || !slot || p.common) return null;
    const O = MB.offPos;
    if (slot === 'SP') return simPos(p.pos) === 'RP' && p.role !== 'TW' ? { sta: -O.rpAsSp } : null;
    if (slot === 'RP' || slot === 'CL' || slot === 'SU' || slot === 'MR' || natural(p, slot)) return null;
    if (slot === 'C') return { def: -O.catcher, arm: -O.catcher * 0.6, con: -O.bat, pow: -O.bat, eye: -O.bat };
    const f = GRP[p.pos] && GRP[p.pos] === GRP[slot] ? 0.5 : 1;
    return { def: -O.def * f, arm: -O.arm * f, con: -O.bat * f, pow: -O.bat * f, eye: -O.bat * f };
  }
  function effR(p, slot) {
    const pen = offPenalty(p, slot); if (!pen) return p.r;
    const r = Object.assign({}, p.r); for (const k in pen) r[k] = Math.max(20, r[k] + pen[k]); return r;
  }
  // 경기용: 그 자리에서 뛰는 선수 (불일치면 능력치를 깎은 사본, 기록용 id는 그대로)
  function slotPlayer(p, slot) { const r = effR(p, slot); return r === p.r ? p : Object.assign({}, p, { r, off: true }); }
  const DEFW = { C: 1.1, SS: 1.2, '2B': 1.0, '3B': 0.9, CF: 1.0, LF: 0.7, RF: 0.8, '1B': 0.4, DH: 0 };

  // ================================================================
  // 능력치 → 한 타석 확률 (원작 변환표 그대로, 타자·투수 맞대결은 비율 곱)
  // ================================================================
  const R50 = {}; for (const k of S.ALL) R50[k] = 50;
  const B0 = I.batRates(R50), P0 = I.pitRates(R50);
  const rateCache = new WeakMap();
  function bRates(p) { let c = rateCache.get(p); if (!c) { c = { b: I.batRates(p.r), p: I.pitRates(p.r) }; rateCache.set(p, c); } return c.b; }
  function pRates(p) { let c = rateCache.get(p); if (!c) { c = { b: I.batRates(p.r), p: I.pitRates(p.r) }; rateCache.set(p, c); } return c.p; }
  const ovrOf = (r, pos) => S.ovrAt(r, simPos(pos === 'TW' ? 'DH' : pos));
  const dispOvr = (r, pos) => S.disp(ovrOf(r, pos));

  // ================================================================
  // 선수 보관함
  // ================================================================
  // 원작 프로 시즌 중 최고 '개막 OVR' (시즌 시작 때 능력치). 같은 값이면 먼저 기록한 시즌.
  // 역대 시즌 기록(hist)의 r은 그 해 겨울(성장 반영 뒤) 능력치 = 다음 시즌 개막 능력치다.
  function primeOf(st) {
    const me = st.me, H = st.hist || [];
    const mainPos = me.role === 'P' ? (me.pos === 'SP' ? 'SP' : 'RP') : me.pos;
    let best = null;
    for (let i = 1; i < H.length; i++) {
      const h = H[i], prev = H[i - 1];
      if (h.stage !== 'pro' || !prev.r) continue;
      if (!(h.lg === 'KBO' || h.lg === 'NPB' || h.lg === 'MLB')) continue;
      const o = S.ovrAt(prev.r, mainPos);
      if (!best || o > best.ovr + 1e-9) best = { ovr: o, r: Object.assign({}, prev.r), age: h.age, year: h.year, src: 'open' };
    }
    if (best) return best;
    // 나이별 기록이 없으면 대표 카드 능력치 (커리어 최고 능력치 → 없으면 은퇴 시점)
    const r = Object.assign({}, (st.car && st.car.peakR) || me.r);
    return { ovr: S.ovrAt(r, mainPos), r, age: null, year: null, src: 'card' };
  }
  function vaultPosOf(st) {
    const me = st.me, f = st.final || {};
    let p = f.mainPos && f.mainPos !== 'TW' ? f.mainPos : (me.twoWay || me.twoWayChosen) ? ((me.flags && me.flags.pos0) || me.pos) : me.pos;
    if (p === 'CL' || (p === 'RP' && me.flags && (me.flags.closer || me.flags.pos0 === 'CL'))) p = 'CL';   // 마무리로 뛴 불펜은 마무리 칸
    if (p === 'OF') p = me.ofPos || 'CF';
    return VAULT_POS.indexOf(p) >= 0 ? p : (me.role === 'P' ? 'SP' : 'DH');
  }
  // 원작 은퇴 상태(st)와 화면용 카드 데이터(cd: ui.js cardData)로 보관함 카드를 만든다
  function cardFromCareer(st, cd) {
    const me = st.me, f = st.final || {};
    const prime = primeOf(st);
    const pos = vaultPosOf(st);
    const tw = !!(me.twoWay || me.twoWayChosen);
    const r = {}; for (const k of S.ALL) r[k] = Math.round((prime.r[k] == null ? 20 : prime.r[k]) * 10) / 10;
    if (!st._careerId) st._careerId = 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    const aw = (f.awList || []).filter(a => /MVP|골든글러브|왕$|신인왕|우승|투수상/.test(a)).slice(0, 8);
    return {
      id: st._careerId, v: 1, name: me.name, num: me.num, avatar: me.avatar || 1, color: (cd && cd.color) || '#3d4a5c',
      team: (cd && cd.team) || f.mainTeamName || '', pos, role: me.role, tw, bats: me.bats, throws: me.throws,
      closer: !!(me.flags && (me.flags.closer || (me.flags.pos0 === 'CL'))),
      r, ovr: S.disp(prime.ovr), oppOvr: tw ? S.disp(me.role === 'P' ? S.ovrAt(r, 'DH') : S.ovrAt(r, 'RP')) : null,
      primeAge: prime.age, primeYear: prime.year, primeSrc: prime.src, aging: me.meteor ? 'meteor' : me.awaken && me.awaken.kind === 'flash' ? 'flash' : me.aging || 'std',   // 노화 유형 (모드 노화에 쓴다)
      career: { war: Math.round((f.war || 0) * 10) / 10, score: f.score || 0, hof: !!(f.hof && f.hof.in), seasons: f.seasons || 0, retireAge: f.retireAge || me.age, aw },
      savedAt: Date.now(),
    };
  }
  // 보관함 = { cards: [...] }. 같은 커리어는 한 장만.
  const capOf = pos => MB.vaultCap[pos] || MB.vaultPerPos;   // 그 포지션 보관 슬롯 수
  // 생성 선수 카드 (모든 능력치 65). 보관함 슬롯을 똑같이 차지하고, 지우려면 다른 카드처럼 지운다
  //   야수·지명타자·마무리: 그 포지션에 아무도 없을 때 1명 · 불펜: 3명 미만이면 3명까지 · 선발: 5명 미만이면 5명까지
  const FILL_MIN = pos => pos === 'SP' ? 5 : pos === 'RP' ? 3 : 1;
  function fillerCard(pos, i) {
    const id = 'f-' + pos + '-' + i, R = makeRng(hash('fillcard|' + id));
    const r = {}; for (const k of S.ALL) r[k] = 50;   // 내부 50 = 화면 65
    return { id, v: 1, filler: true, name: R.pick(DATA.surnames) + R.pick(DATA.given1) + R.pick(DATA.given2), num: R.int(1, 99), avatar: (hash(id) % 99991) + 1, color: '#8a8f98', team: '',
      pos, role: pos === 'SP' || pos === 'RP' || pos === 'CL' ? 'P' : 'B', tw: false, closer: pos === 'CL', bats: 'R', throws: 'R', r, ovr: S.disp(ovrOf(r, pos)), oppOvr: null,
      primeAge: null, primeYear: null, primeSrc: 'filler', career: { war: 0, score: 0, hof: false, seasons: 0, aw: [] }, savedAt: 0 };
  }
  // 보관함에 생성 선수 채우기 (바뀌면 true)
  function ensureFillers(vault) {
    vault.cards = vault.cards || []; let ch = false;
    for (const pos of VAULT_POS) {
      let n = vault.cards.filter(c => c.pos === pos).length;
      for (let i = 0; n < FILL_MIN(pos) && n < capOf(pos); i++) { const id = 'f-' + pos + '-' + i; if (vault.cards.some(c => c.id === id)) continue; vault.cards.push(fillerCard(pos, i)); n++; ch = true; }
    }
    return ch;
  }
  function vaultCheck(vault, card) {
    const cards = vault.cards || [];
    if (cards.some(c => c.id === card.id)) return { ok: false, why: 'dup', same: cards.filter(c => c.pos === card.pos) };
    const same = cards.filter(c => c.pos === card.pos);
    if (same.length >= capOf(card.pos)) return { ok: false, why: 'full', same };
    return { ok: true, same };
  }
  function vaultAdd(vault, card, removeId) {
    vault.cards = vault.cards || [];
    if (removeId) vault.cards = vault.cards.filter(c => c.id !== removeId);
    const chk = vaultCheck(vault, card);
    if (!chk.ok) return chk;
    vault.cards.push(card);
    return { ok: true };
  }
  function vaultRemove(vault, id) { const n = (vault.cards || []).length; vault.cards = (vault.cards || []).filter(c => c.id !== id); return vault.cards.length < n; }

  // 경기용 선수 객체 (보관함 카드 → 고정 능력치 선수)
  function cardPlayer(c) {
    return { id: 'v:' + c.id, name: c.name, pos: c.pos, role: c.tw ? 'TW' : c.role, r: Object.assign({}, c.r), card: c.id, num: c.num, closer: c.closer, ovr: c.ovr, age: c.primeAge || undefined, filler: c.filler || undefined, bats: c.bats || 'R', throws: c.throws || 'R' };
  }
  const isPitcher = p => p.role === 'P' || p.role === 'TW';
  const isBatter = p => p.role === 'B' || p.role === 'TW';

  // ================================================================
  // 한 경기 (타석 단위)
  // ================================================================
  // side = { tid, order: [{p, slot}]×9, sp: p, pen: { CL: p|null, SU: [p], MR: [p], LR: [p] }, can(p): 등판 가능?, sub(role): 대체 선수 or null, def: 팀 수비 점수 }
  function teamDef(order) {
    let s = 0;
    for (const x of order) {
      if (x.slot === 'DH') continue;
      const d = x.p.r.def;   // 포지션 불일치 감점은 slotPlayer에서 이미 능력치에 반영
      s += (d - 50) * (DEFW[x.slot] || 0.8) + (x.slot === 'C' || x.slot === 'SS' || x.slot === '3B' || x.slot === 'RF' ? (x.p.r.arm - 50) * 0.3 : 0);
    }
    return s / 8;
  }
  function emptyB() { return { PA: 0, AB: 0, H: 0, D: 0, T: 0, HR: 0, BB: 0, K: 0, R: 0, RBI: 0, SB: 0, CS: 0 }; }
  function emptyP() { return { outs: 0, BF: 0, H: 0, R: 0, BB: 0, K: 0, HR: 0, NP: 0 }; }

  // ---------- 좌우 상성: 같은 손이면 타자 불리, 반대 손이면 유리 (스위치히터는 늘 반대 손으로) ----------
  const handOf = (p, pit) => { const h = pit ? (p.throws || 'R') : (p.bats || 'R'); return /^L|좌/.test(h) ? 'L' : /^S|양/.test(h) ? 'S' : 'R'; };
  function platoon(bp, pp) {
    const ph = handOf(pp, true), bh = handOf(bp, false), same = bh !== 'S' && bh === ph;
    return same ? MB.plat.same : MB.plat.opp;
  }
  // 한 타석에 던진 공 수 (결과별 평균 근처로)
  function pitchesFor(kind, R) {
    const base = { BB: 5.6, K: 4.9, HR: 3.4, H: 3.3, OUT: 3.4, E: 3.3, IBB: 4 }[kind] || 3.4;
    return Math.max(1, Math.round(base + (R() - 0.5) * 3.2));
  }

  // ================================================================
  // 한 경기 (타석 단위, 한 타석씩 멈췄다 갈 수 있다 — 관전·감독 개입용)
  // ================================================================
  //   createGame(...) → { it: 제너레이터(타석마다 사건을 내놓는다), v: 지금 상태 보기, ctl: 감독 명령 }
  //   playGame(...)  → 끝까지 한 번에 돌린 박스스코어 (관전하지 않는 경기)
  //   opt.mine: 관전하는 내 구단 쪽 (0 원정 · 1 홈 · 없으면 -1)
  function createGame(id, seed, away, home, opt) {
    opt = opt || {};
    const R = rngFor(seed, id);
    const maxInn = opt.post ? MB.postInn : MB.regInn;
    const sides = [away, home], mine = opt.mine == null ? -1 : opt.mine;
    const score = [0, 0], line = [[], []];
    const bat = [new Map(), new Map()], pit = [[], []];
    const notes = (opt.notes || []).slice(), log = [];
    const idx = [0, 0];
    const defMul = sides.map(s => 1 - MB.defK * (s.def == null ? teamDef(s.order) : s.def));
    const errOf = ord => { const f = ord.filter(x => x.slot !== 'DH'); const d = f.reduce((a, x) => a + x.p.r.def, 0) / Math.max(1, f.length); return clamp(MB.err.base * (1 + (60 - d) / MB.err.k), 0.005, 0.08); };
    const errP = sides.map(s => errOf(s.order)), E = [0, 0];
    sides.forEach((s, t) => s.order.forEach(x => bat[t].set(x.p.id, Object.assign(emptyB(), { pos: x.slot }))));
    const pmap = sides.map(s => Object.fromEntries(s.order.map(x => [x.p.id, x.p])));
    const SB = MB.sub, order = sides.map(s => s.order.slice()), bench = sides.map(s => (s.bench || []).filter(Boolean).slice()), spots = sides.map(s => s.order.map(x => [x.p.id]));
    const offV = p => { const b = bRates(p); return b.bb * 1.4 + (1 - b.k) * b.babip * 1.1 + b.hr * 2.5; };
    const ctl = { cmds: [], auto: true };   // 감독 명령 (관전 중 내 구단). auto: AI가 교체도 알아서
    const nm = p => p ? p.name : '';
    const say = (txt, o) => { const e = Object.assign({ inn, half, txt, sc: score.slice() }, o || {}); log.push(e); return e; };
    function subIn(t, i, p, kind) {
      const slot = order[t][i].slot, sp = slotPlayer(p, slot), out = order[t][i].p;
      order[t][i] = { p: sp, slot, ph: kind === 'PH' || kind === 'PR' };
      bench[t] = bench[t].filter(x => x.id !== p.id);
      bat[t].set(p.id, Object.assign(emptyB(), { pos: slot, sub: kind }));
      pmap[t][p.id] = sp; spots[t][i].push(p.id);
      say(`${{ PH: '대타', PR: '대주자', DEF: '대수비' }[kind]} ${nm(p)} (${nm(out)} 대신)`, { kind: 'sub', t });
      return sp;
    }
    function maybePH(t, i, inn, base) {
      if (t === mine && !ctl.auto) return;
      if (!bench[t].length || inn < SB.phInn) return;
      const diff = score[t] - score[1 - t];
      if (diff > 0 || diff < -SB.phGap) return;
      if (!(base[0] || base[1] || base[2]) && inn < 9) return;
      let best = null, bv = offV(order[t][i].p) * SB.phK;
      const slot = order[t][i].slot;
      const canField = c => slot === 'DH' || natural(c, slot) || bench[t].some(d => d !== c && natural(d, slot));
      for (const c of bench[t]) { if (!canField(c)) continue; const v = offV(c); if (v > bv) { best = c; bv = v; } }
      if (best) subIn(t, i, best, 'PH');
    }
    function fixDefense(t, inn) {
      let ch = false;
      for (let i = 0; i < 9; i++) {
        const x = order[t][i]; if (!x.ph) continue;
        x.ph = false; const L = bat[t].get(x.p.id);
        if (x.slot === 'DH' || natural(x.p, x.slot)) { L.field = 1; continue; }
        const d = bench[t].filter(c => natural(c, x.slot)).sort((a, b) => b.r.def - a.r.def)[0];
        if (d) { subIn(t, i, d, 'DEF'); ch = true; } else L.field = 1;
      }
      const lead = score[t] - score[1 - t];
      if ((t !== mine || ctl.auto) && inn >= SB.defInn && lead >= 1 && lead <= 3) for (let i = 0; i < 9; i++) {
        const x = order[t][i]; if (x.slot === 'DH') continue;
        const d = bench[t].filter(c => natural(c, x.slot) && c.r.def >= x.p.r.def + SB.defGap).sort((a, b) => b.r.def - a.r.def)[0];
        if (d) { subIn(t, i, d, 'DEF'); ch = true; }
      }
      if (ch) refreshDef(t);
    }
    const refreshDef = t => { defMul[t] = 1 - MB.defK * teamDef(order[t]); errP[t] = errOf(order[t]); };
    // 투수 상태
    const used = [new Set(), new Set()];
    const cur = [null, null];
    let inn = 1, half = 0;
    function enter(t, p, role, inn0, why) {
      const lead = score[t] - score[1 - t];
      const st = { p, role, line: emptyP(), entryLead: lead, entryInn: inn0, exitLead: null, start: role === 'SP' };
      // 선발은 투구 수 목표(체력 능력치에 따라), 구원은 아웃 목표
      st.npTarget = role === 'SP' ? Math.round(clamp(MB.np.spBase + ((p.r.sta || 50) - 50) * MB.np.spSta + R.gauss() * 8, 70, 125)) : MB.np.rp;
      st.target = role === 'SP' ? 27 : MB.relOuts[role] || 3;
      const prev = cur[t];
      pit[t].push(st); used[t].add(p.id); cur[t] = st;
      if (prev) say(`투수 교체: ${nm(prev.p)} → ${nm(p)}${why ? ` (${why})` : ''}`, { kind: 'pitch', t });
    }
    enter(0, away.sp, 'SP', 1); enter(1, home.sp, 'SP', 1);
    function pickReliever(t, inn) {
      const s = sides[t], lead = score[t] - score[1 - t];
      const ok = p => p && !used[t].has(p.id) && (!s.can || s.can(p));
      const tryRole = (role, list) => { for (const p of list) if (ok(p)) return { p, role }; return null; };
      let c = null;
      if (inn >= 9 && lead >= 1 && lead <= 3) c = tryRole('CL', [s.pen.CL]);
      if (!c && inn >= 7 && lead >= 0 && lead <= 3) c = tryRole('SU', s.pen.SU || []);
      if (!c) c = tryRole('MR', s.pen.MR || []);
      if (!c && inn >= 9 && lead >= 0) c = tryRole('CL', [s.pen.CL]);
      if (!c) c = tryRole('SU', s.pen.SU || []);
      if (!c) c = tryRole('LR', s.pen.LR || []);
      if (!c) c = tryRole('CL', [s.pen.CL]);
      if (!c && s.sub) { const p = s.sub('MR', used[t]); if (p) { c = { p, role: 'MR' }; notes.push({ t: s.tid, txt: `${p.name} 투입 (가용 구원 없음)` }); } }
      return c;
    }
    function maybeChange(t, inn, atInningStart) {
      if (t === mine && !ctl.auto) return;
      const st = cur[t], L = st.line;
      let pull = false, why = '';
      if (st.role === 'SP') { pull = L.NP >= st.npTarget || (L.R >= MB.spPullRuns && L.outs >= 6); why = L.NP >= st.npTarget ? `${L.NP}구` : `${L.R}실점`; }
      else { pull = atInningStart ? L.outs >= st.target || L.NP >= st.npTarget || (L.outs > 0 && L.outs % 3 === 0 && st.role !== 'LR' && st.role !== 'MR') : L.R >= MB.relRunsPull + (st.role === 'LR' ? 2 : 0); }
      if (!pull) return;
      const nx = pickReliever(t, inn);
      if (!nx) return;
      st.exitLead = score[t] - score[1 - t];
      enter(t, nx.p, nx.role, inn, why);
    }
    let winP = [null, null], loseP = [null, null];
    function leadCheck(prevLeader) {
      const leader = score[0] > score[1] ? 0 : score[1] > score[0] ? 1 : -1;
      if (leader !== prevLeader && leader >= 0) { winP[leader] = cur[leader]; loseP[1 - leader] = cur[1 - leader]; }
    }
    // 감독 명령 처리 (내 구단): 투수 교체 · 대타 · 대주자 · 대수비 · 다음 타석 작전
    let tac = null, base = [null, null, null], outs = 0;
    function applyCmds(off, def) {
      while (ctl.cmds.length) {
        const c = ctl.cmds.shift(), t = mine; if (t < 0) break;
        if (c.type === 'pitch' && def === t && c.p && !used[t].has(c.p.id)) { cur[t].exitLead = score[t] - score[1 - t]; enter(t, c.p, c.role || 'MR', inn, '감독'); }
        else if (c.type === 'ph' && off === t) { const i = idx[t] % 9, p = bench[t].find(x => x.id === c.id); if (p) subIn(t, i, p, 'PH'); }
        else if (c.type === 'pr' && off === t && base[c.b]) { const i = order[t].findIndex(x => x.p.id === base[c.b]), p = bench[t].find(x => x.id === c.id); if (i >= 0 && p) { const sp = subIn(t, i, p, 'PR'); base[c.b] = sp.id; } }
        else if (c.type === 'def' && def === t) { const p = bench[t].find(x => x.id === c.id); if (p && order[t][c.i]) { subIn(t, c.i, p, 'DEF'); order[t][c.i].ph = false; bat[t].get(p.id).field = 1; refreshDef(t); } }
        else if (c.type === 'tac') tac = c.v;
        else if (c.type === 'auto') ctl.auto = !!c.v;
      }
    }
    // 지금 상태 (관전 화면용)
    const v = {
      get inn() { return inn; }, get half() { return half > 1 ? 1 : half; }, get outs() { return outs; }, get base() { const h = half > 1 ? 1 : half; return base.map(id => id ? (pmap[h] && pmap[h][id]) || null : null); },
      score, line, E, log, sides, mine, ctl, order, bench, cur, bat, pit, idx, used,
      H: t => [...bat[t].values()].reduce((a, L) => a + L.H, 0), BB: t => [...bat[t].values()].reduce((a, L) => a + L.BB, 0),
      batter: () => order[half] ? order[half][idx[half] % 9] : null, tac: () => tac, done: false, alert: null,
    };
    function* run() {
      let walkoff = false;
      const alertOnce = {};
      const alert = (key, txt) => { if (mine < 0 || alertOnce[key]) return; alertOnce[key] = 1; v.alert = txt; };
      for (inn = 1; ; inn++) {
        for (half = 0; half < 2; half++) {
          if (half === 1 && inn >= 9 && score[1] > score[0]) break;
          const off = half, def = 1 - half;
          fixDefense(def, inn); maybeChange(def, inn, true);
          outs = 0; let runs = 0;
          base = [null, null, null]; let errInn = false;
          say(`${inn}회${half ? '말' : '초'} — ${sides[off].tid} 공격 · 투수 ${nm(cur[def].p)}`, { kind: 'inn' });
          if (def === mine && inn >= 7 && Math.abs(score[0] - score[1]) <= 2) alert('close' + inn + half, `${inn}회${half ? '말' : '초'} 접전 수비 — 투수 교체할까?`);
          yield v;
          while (outs < 3) {
            applyCmds(off, def);
            maybeChange(def, inn, false);
            const pst = cur[def], pl = pst.line;
            if (def === mine && pl.NP >= 100) alert('np' + pst.p.id, `${nm(pst.p)} 투구 수 ${pl.NP}개`);
            if (off === mine && pst.p !== (v._lastOppP || null)) { if (v._lastOppP && handOf(pst.p, true) === 'L') alert('lhp' + pst.p.id, `상대 좌완 ${nm(pst.p)} 등판 — 대타?`); v._lastOppP = pst.p; }
            // 도루 (AI 판단 또는 감독 작전)
            if ((base[0] && !base[1] && outs < 2) || (tac === 'steal' && base[1] && !base[2] && outs < 2)) {
              const from = base[0] && !base[1] ? 0 : 1, rp = pmap[off][base[from]], rr = rp && bRates(rp);
              const tries = tac === "steal" ? true : tac !== "hitrun" && tac !== "bunt" && from === 0 && rr && rr.sbA > 0 && R() < rr.sbA / 600 * MB.sbK;
              if (rr && tries) {
                const rl = bat[off].get(base[from]); if (tac === 'steal') tac = null;
                const okP = Math.min(0.95, rr.sbS * (from === 1 ? 0.85 : 1) * (tac === "guard" && def === mine ? 0.7 : 1));   // 주루 경계
                if (R() < okP) { rl.SB++; base[from + 1] = base[from]; base[from] = null; say(`${nm(rp)} ${from + 2}루 도루 성공`, { kind: 'sb' }); }
                else { rl.CS++; base[from] = null; outs++; pl.outs++; say(`${nm(rp)} 도루 실패 (아웃)`, { kind: 'cs' }); yield v; if (outs >= 3) break; }
              }
            }
            const spot = idx[off] % 9; maybePH(off, spot, inn, base);
            const bx = order[off][spot]; idx[off]++;
            const b = bRates(bx.p), pr = pRates(pst.p), pf = platoon(bx.p, pst.p);
            const bl = bat[off].get(bx.p.id);
            const men = (base[1] || base[2]) ? pr.men : 1;
            const TU = MB.tune, hf = sides[off] === home ? MB.homeAdv : -MB.homeAdv;   // 홈 어드밴티지 (홈 타자 +, 원정 −)
            let bb = b.bb * pr.bb / P0.bb * TU.bb * pf.bb * (1 + hf), k = b.k * pr.k / P0.k * TU.k * pf.k * (1 - hf), hr = b.hr * pr.hr / P0.hr * TU.hr * pf.hr * (1 + hf) * (men > 1 ? 1 + (men - 1) * 0.5 : 1);
            let babip = clamp(b.babip * pr.babip / P0.babip * defMul[def] * men * TU.babip * pf.babip, 0.18, 0.5);
            const T = tac; tac = null;
            if (T === 'hitrun') k *= 0.85;
            if (T === 'in') babip = Math.min(0.5, babip * 1.08);
            const TM = MB.tacs[T]; if (TM) { bb *= TM.bb || 1; k *= TM.k || 1; hr *= TM.hr || 1; babip = clamp(babip * (TM.babip || 1), 0.18, 0.5); }   // 작전 카드 효과
            const over = pl.NP - pst.npTarget;   // 한계 투구 수를 넘겨 던지면 점점 맞는다 (+25구 약 15%, +50구 30%, 최대 60%)
            if (over > 0) { const f = Math.min(0.6, over / 50 * 0.3); bb *= 1 + f; hr *= 1 + f * 1.4; k *= 1 - f * 0.5; babip = clamp(babip * (1 + f * 0.25), 0.18, 0.5); }
            bl.PA++; pl.BF++;
            const prevLeader = score[0] > score[1] ? 0 : score[1] > score[0] ? 1 : -1;
            let scored = 0, errPlay = false, kind = 'OUT', txt = '';
            const scIds = [], before = base.slice(); let an = "";   // 애니메이션용: 홈인한 주자, 타석 전 주자, 타구 종류
            const score1 = (runner) => { if (!runner) return; scored++; scIds.push(runner); const rl = bat[off].get(runner); if (rl) rl.R++; };
            const who = nm(bx.p);
            if (T === 'ibb') {   // 고의사구
              bl.BB++; pl.BB++; kind = 'IBB';
              if (base[0]) { if (base[1]) { if (base[2]) score1(base[2]); base[2] = base[1]; } base[1] = base[0]; }
              base[0] = bx.p.id; bl.RBI += scored; txt = `${who} 고의사구`; an = "IBB";
            } else if (T === 'bunt' && outs < 2 && (base[0] || base[1])) {   // 희생번트
              bl.AB++; const ok = R() < 0.72 + (bx.p.r.con - 50) / 200;
              if (ok) { outs++; pl.outs++; if (base[2] && outs < 3 && R() < 0.5) { score1(base[2]); base[2] = null; } if (base[1] && !base[2]) { base[2] = base[1]; base[1] = null; } if (base[0] && !base[1]) { base[1] = base[0]; base[0] = null; } bl.AB--; txt = `${who} 희생번트 성공`; an = "BUNT"; }
              else { outs++; pl.outs++; const lead = base[1] ? 1 : 0; if (base[lead]) base[lead] = null; if (lead === 1 && base[0]) { base[1] = base[0]; base[0] = null; } base[0] = bx.p.id; txt = `${who} 번트 실패 — 선행 주자 아웃`; an = "BUNTF"; }
            } else {
              let u = R();
              if (u < bb) {
                bl.BB++; pl.BB++; kind = 'BB';
                if (base[0]) { if (base[1]) { if (base[2]) score1(base[2]); base[2] = base[1]; } base[1] = base[0]; }
                an = "BB"; base[0] = bx.p.id; bl.RBI += scored; txt = `${who} 볼넷${scored ? ' — 밀어내기 1점' : ''}`;
              } else if ((u -= bb) < k) {
                bl.AB++; bl.K++; pl.K++; pl.outs++; outs++; kind = "K"; an = "K"; txt = `${who} 삼진`;
                if (T === 'hitrun' && base[0] && outs < 3) { const rp = pmap[off][base[0]], rr = bRates(rp), rl = bat[off].get(base[0]); if (R() < rr.sbS * 0.8) { rl.SB++; base[1] = base[0]; base[0] = null; txt += ` · ${nm(rp)} 2루 도루`; } else { rl.CS++; base[0] = null; outs++; pl.outs++; txt += ` · 주자도 아웃 (삼진 도루사)`; } }
              } else if ((u -= k) < hr) {
                bl.AB++; bl.H++; bl.HR++; pl.H++; pl.HR++; kind = 'HR';
                for (let i = 2; i >= 0; i--) { score1(base[i]); base[i] = null; }
                score1(bx.p.id); an = "HR"; bl.RBI += scored; txt = `${who} ${scored === 4 ? '만루 홈런!' : '홈런!'} ${scored}점`;
              } else if (R() < babip) {
                bl.AB++; bl.H++; pl.H++; kind = 'H';
                const spd = (bx.p.r.spd - 50) / 100 + (T === 'hitrun' ? 0.15 : 0);
                if (R() < b.xbh) {
                  if (R() < b.t3) { bl.T++; for (let i = 2; i >= 0; i--) { score1(base[i]); base[i] = null; } base[2] = bx.p.id; txt = `${who} 3루타!`; an = "3B"; }
                  else { bl.D++; score1(base[2]); score1(base[1]); base[2] = base[1] = null; if (base[0]) { if (R() < 0.42 + spd * 0.3) score1(base[0]); else base[2] = base[0]; base[0] = null; } base[1] = bx.p.id; txt = `${who} 2루타!`; an = "2B"; }
                } else {
                  score1(base[2]); base[2] = null;
                  if (base[1]) { if (R() < 0.6 + spd * 0.2) score1(base[1]); else base[2] = base[1]; base[1] = null; }
                  if (base[0]) { if (!base[2] && R() < 0.28 + spd * 0.2) base[2] = base[0]; else base[1] = base[0]; base[0] = null; }
                  base[0] = bx.p.id; txt = `${who} 안타`; an = "1B";
                }
                bl.RBI += scored; if (scored) txt += ` ${scored}점`;
              } else {
                bl.AB++;
                if (R() < errP[def]) {
                  kind = 'E'; E[def]++;
                  score1(base[2]); base[2] = base[1]; base[1] = base[0]; base[0] = bx.p.id;
                  pl.UE = (pl.UE || 0) + scored; errInn = true; errPlay = true; an = "E"; txt = `${who} 실책으로 출루${scored ? ` ${scored}점` : ''}`;
                } else if (T !== "hitrun" && outs < 2 && base[0] && R() < 0.12 * (TM && TM.dp || 1)) {
                  base[0] = null; outs += 2; pl.outs += 2; txt = `${who} 병살타`; an = "DP";
                  if (outs < 3) { if (base[2]) { score1(base[2]); base[2] = null; } if (base[1]) { base[2] = base[1]; base[1] = null; } }
                } else {
                  outs++; pl.outs++; const fly = R() < 0.45; an = fly ? "FO" : "GO"; txt = `${who} ${fly ? "뜬공" : "땅볼"} 아웃`;
                  if (outs < 3) {
                    if (base[2] && T !== 'in' && R() < 0.38) { score1(base[2]); base[2] = null; bl.RBI += 1; txt = `${who} ${fly ? '희생플라이' : '땅볼'} 1점`; }
                    if (base[1] && !base[2] && R() < (T === 'hitrun' ? 0.7 : 0.3)) { base[2] = base[1]; base[1] = null; }
                    if (T === 'hitrun' && base[0] && !base[1]) { base[1] = base[0]; base[0] = null; }
                  }
                }
              }
            }
            pl.NP = (pl.NP || 0) + Math.max(1, Math.round(pitchesFor(kind, R) * (TM && TM.np || 1)));
            if (scored) { score[off] += scored; runs += scored; pl.R += scored; if (errInn && !errPlay) pl.UE = (pl.UE || 0) + scored; leadCheck(prevLeader); }
            say(txt, { kind: kind === 'HR' ? 'hr' : scored ? 'run' : kind === 'K' ? 'k' : 'pa', t: off, pa: { a: an, before, after: base.slice(), b: bx.p.id, sc: scIds, outs } });   // pa: 관전 애니메이션용
            if (scored && half === 1 && inn >= 9 && score[1] > score[0]) { walkoff = true; say('끝내기!', { kind: 'end' }); yield v; break; }
            yield v;
          }
          line[off].push(runs);
          if (walkoff) break;
        }
        if (walkoff) break;
        if (inn >= 9 && score[0] !== score[1]) break;
        if (inn >= maxInn) break;
      }
      cur[0].exitLead = score[0] - score[1]; cur[1].exitLead = score[1] - score[0];
      const winner = score[0] > score[1] ? 0 : score[1] > score[0] ? 1 : -1;
      const dec = [new Map(), new Map()];
      if (winner >= 0) {
        const w = winner, l = 1 - winner;
        let W = winP[w];
        if (W && W.start && W.line.outs < 15) W = pit[w].find(x => !x.start) || W;
        if (W) dec[w].set(W, 'W');
        if (loseP[l]) dec[l].set(loseP[l], 'L');
        const last = pit[w][pit[w].length - 1];
        if (last && last !== W && !last.start && (last.entryLead >= 1 && last.entryLead <= 3 || last.line.outs >= 9)) dec[w].set(last, 'S');
      }
      for (let t = 0; t < 2; t++) for (const x of pit[t]) {
        if (x.start || dec[t].has(x) || x === pit[t][pit[t].length - 1]) continue;
        if (x.entryLead >= 1 && x.entryLead <= 3 && x.exitLead != null && x.exitLead >= 1 && x.line.outs > 0) dec[t].set(x, 'H');
      }
      const box = {
        id, a: away.tid, h: home.tid, sc: score.slice(), ln: line, inn: Math.max(line[0].length, line[1].length), win: winner < 0 ? null : sides[winner].tid,
        b: {}, p: {}, e: E.slice(), notes: notes.length ? notes : undefined, post: opt.post || undefined,
      };
      sides.forEach((s, t) => {
        box.b[s.tid] = spots[t].flatMap((ids, i) => ids.map(id => { const L = bat[t].get(id); return [id, L.pos, L.PA, L.AB, L.H, L.D, L.T, L.HR, L.BB, L.K, L.R, L.RBI, L.SB, L.CS, L.sub === 'PH' ? (L.field ? 'PHF' : 'PH') : L.sub === 'PR' ? 'PR' : L.sub || '', i]; }));
        box.p[s.tid] = pit[t].map(x => [x.p.id, x.line.outs, x.line.BF, x.line.H, x.line.R, x.line.BB, x.line.K, x.line.HR, dec[t].get(x) || '', x.start ? 1 : 0, x.line.R - (x.line.UE || 0), x.line.NP || 0]);   // [10] 자책 · [11] 투구 수
      });
      v.done = true; v.box = box;
      say(`경기 종료 ${score[0]} : ${score[1]}`, { kind: 'end' });
      return box;
    }
    return { it: run(), v, ctl };
  }
  function playGame(id, seed, away, home, opt) {
    const g = createGame(id, seed, away, home, opt);
    let r; while (!(r = g.it.next()).done);
    return r.value;
  }
  // 박스스코어 → 시즌 기록에 더하기
  const BI = { PA: 2, AB: 3, H: 4, D: 5, T: 6, HR: 7, BB: 8, K: 9, R: 10, RBI: 11, SB: 12, CS: 13 };
  const PI = { outs: 1, BF: 2, H: 3, ER: 4, BB: 5, K: 6, HR: 7 };
  function emptyStat() { return { b: { G: 0, PA: 0, AB: 0, H: 0, D: 0, T: 0, HR: 0, BB: 0, K: 0, R: 0, RBI: 0, SB: 0, CS: 0 }, p: { G: 0, GS: 0, outs: 0, BF: 0, H: 0, ER: 0, BB: 0, K: 0, HR: 0, W: 0, L: 0, SV: 0, HLD: 0, CG: 0, SHO: 0 } }; }
  function addBox(stats, box) {
    for (const tid in box.b) for (const row of box.b[tid]) {
      const s = stats[row[0]] || (stats[row[0]] = emptyStat()); s.t = tid;
      s.b.G++; for (const k in BI) s.b[k] += row[BI[k]] || 0;
      s.pg = s.pg || {}; if (row[14] !== 'PH') s.pg[row[1]] = (s.pg[row[1]] || 0) + 1;   // 수비 위치별 출전 (주 포지션·수비 기록용, 대타만 나온 경기는 빼고)
    }
    for (const tid in box.p) for (const row of box.p[tid]) {
      const s = stats[row[0]] || (stats[row[0]] = emptyStat()); s.t = tid;
      s.p.G++; if (row[9]) s.p.GS++;
      if (row[9] && box.p[tid].length === 1) { s.p.CG = (s.p.CG || 0) + 1; if (!row[4]) s.p.SHO = (s.p.SHO || 0) + 1; }   // 완투·완봉
      for (const k in PI) s.p[k] += k === 'ER' && row[10] != null ? row[10] : row[PI[k]];   // 자책점: 실책으로 난 점수 뺀 값 (예전 박스는 실점)
      const d = row[8]; if (d === 'W') s.p.W++; else if (d === 'L') s.p.L++; else if (d === 'S') s.p.SV++; else if (d === 'H') s.p.HLD++;
    }
  }
  function addStand(stand, box) {
    const a = stand[box.a], h = stand[box.h];
    a.rs += box.sc[0]; a.ra += box.sc[1]; h.rs += box.sc[1]; h.ra += box.sc[0];
    if (box.win === box.a) { a.w++; h.l++; } else if (box.win === box.h) { h.w++; a.l++; } else { a.t++; h.t++; }
  }
  const pct = s => (s.w + s.l) ? s.w / (s.w + s.l) : 0;
  function standList(stand, teams) {
    const list = teams.map(t => Object.assign({ id: t.id, name: t.name }, stand[t.id]));
    list.sort((x, y) => pct(y) - pct(x) || (y.w - y.l) - (x.w - x.l) || (y.rs - y.ra) - (x.rs - x.ra));
    const top = list[0];
    list.forEach((s, i) => { s.rank = i + 1; s.pct = pct(s); s.gb = i ? ((top.w - s.w) + (s.l - top.l)) / 2 : 0; });
    return list;
  }

  // ================================================================
  // 기본 로스터 생성 (원작 리그와 같은 28명 구성·능력 분포)
  // ================================================================
  const TPL = {
    C: { def: 8, arm: 8, spd: -8, con: -3 }, '1B': { pow: 8, def: -6, spd: -8 }, '2B': { def: 5, spd: 4, pow: -8 },
    SS: { def: 8, arm: 6, spd: 4, pow: -8 }, '3B': { pow: 3, arm: 5 }, OF: { spd: 3 }, LF: { spd: 3 }, CF: { spd: 3 }, RF: { spd: 3 }, DH: { pow: 8, def: -15, spd: -8 },
    SP: { sta: 8 }, RP: { vel: 5, sta: -15 },
  };
  const ROSTER = [['C', 's'], ['1B', 's'], ['2B', 's'], ['3B', 's'], ['SS', 's'], ['LF', 's'], ['CF', 's'], ['RF', 's'], ['DH', 's'],
    ['C', 'b'], ['2B', 'b'], ['SS', 'b'], ['CF', 'b'], ['SP', 'p'], ['SP', 'p'], ['SP', 'p'], ['SP', 'p'], ['SP', 'p'], ['RP', 'p'], ['RP', 'p'], ['RP', 'p'],
    ['1B', 'b'], ['3B', 'b'], ['RF', 'b'], ['SP', 'x'], ['SP', 'x'], ['RP', 'r'], ['RP', 'r']];
  function genPlayer(R, id, pos, base, o) {
    const role = (pos === 'SP' || pos === 'RP') ? 'P' : 'B';
    const keys = role === 'B' ? S.BAT : S.PIT, tpl = TPL[pos] || {};
    const star = o.star != null ? (o.star ? 12 : 0) : (R.chance(0.08) ? 12 : 0);
    const r = {}; for (const k of S.ALL) r[k] = 20;
    for (const k of keys) r[k] = Math.round(clamp(base + star + (tpl[k] || 0) + R.gauss() * 9, 22, 96));
    let name = o.name;
    if (!name) name = o.foreign ? R.pick(DATA.foreign) : R.pick(DATA.surnames) + R.pick(DATA.given1) + R.pick(DATA.given2);
    const hb = R(), bats = hb < 0.03 ? "S" : hb < 0.38 ? "L" : "R", throws = role === "P" ? (R() < 0.28 ? "L" : "R") : (pos === "1B" && R() < 0.2 ? "L" : "R");   // 투타 (좌우 상성용)
    return { id, name, pos, role, r, foreign: !!o.foreign, num: R.int(1, 99), bats, throws };
  }
  function makeRosters(seed) {
    const R = makeRng(hash('rosters|' + seed));
    const BAL = S.BAL, players = {}, teams = [];
    for (const td of DATA.teams) {
      const sB = (td.bat - 100) * 0.8, sP = (td.pit - 100) * 0.5;
      const real = (DATA.realRosters && DATA.realRosters[td.id] || []).map(s => { const [name, pos, , star] = s.split(' '); return { name, pos, star: star === 'S' }; });
      const take = pos => { const want = simPos(pos), acc = pos === 'DH' ? ['DH', '1B', 'OF'] : [want]; for (const w of acc) { const i = real.findIndex(x => x.pos === w); if (i >= 0) return real.splice(i, 1)[0]; } return null; };
      const fHit = R.pick([1, 3, 5, 6, 8]);
      let spN = 0;
      const t = { id: td.id, name: td.name, color: td.color, roster: [] };
      ROSTER.forEach(([pos, kind], i) => {
        let base, foreign = false;
        if (kind === 's') { base = BAL.starterBase + sB; if (i === fHit) { foreign = true; base += 6; } }
        else if (kind === 'b') base = BAL.benchBase + sB;
        else if (kind === 'x') base = BAL.spCandBase + sP;
        else if (kind === 'r') base = BAL.rpExtraBase + sP;
        else if (pos === 'SP') { spN++; base = 47.5 + sP; if (spN <= 2) { foreign = true; base += 8; } }
        else base = 50 + sP;
        const rp = foreign ? null : take(pos);
        const id = td.id + ':' + i;
        players[id] = aiKeyBoost(genPlayer(R, id, pos, base + MB.ai.boost, { foreign, name: rp && rp.name, star: rp ? rp.star : undefined }));   // 컴퓨터 구단 능력치 올림
        t.roster.push(id);
      });
      teams.push(t);
    }
    return { teams, players };
  }

  // ================================================================
  // 자동 편성 (컴퓨터 구단 · '자동 편성' 버튼)
  // ================================================================
  // pool: 선수 객체 배열 → { bat: [{id, slot}]×9 (타순), sp: [id×n], CL, SU: [id,id], MR: [ids], LR: [ids] }
  function autoLineup(pool, nSP) {
    nSP = nSP || 5;
    const bats = pool.filter(isBatter), pits = pool.filter(isPitcher);
    const taken = new Set(), field = {};
    for (const slot of ['C', 'SS', '2B', 'CF', '3B', 'RF', 'LF', '1B']) {
      const cand = bats.filter(p => !taken.has(p.id));
      if (!cand.length) break;
      // 제 포지션 선수를 우선 (다른 포지션은 한참 더 잘 칠 때만)
      const score = p => S.ovrAt(effR(p, slot), simPos(slot)) + (natural(p, slot) ? 0 : -10) + (simPos(p.pos) === 'DH' && slot !== '1B' ? -10 : 0);
      cand.sort((a, b) => score(b) - score(a));
      field[slot] = cand[0].id; taken.add(cand[0].id);
    }
    const restB = bats.filter(p => !taken.has(p.id)).sort((a, b) => S.ovrAt(b.r, 'DH') - S.ovrAt(a.r, 'DH'));
    if (restB.length) { field.DH = restB[0].id; taken.add(restB[0].id); }
    const nine = BAT_POS.filter(s => field[s]).map(s => ({ id: field[s], slot: s }));
    const byId = Object.fromEntries(pool.map(p => [p.id, p]));
    const off = x => { const b = bRates(byId[x.id]); return b.bb * 1.4 + (1 - b.k) * b.babip * 1.1 + b.hr * 2.5; };
    const ranked = nine.slice().sort((a, b) => off(b) - off(a));
    const order = [ranked[1], ranked[3], ranked[0], ranked[2], ranked[4], ranked[5], ranked[6], ranked[7], ranked[8]].filter(Boolean);
    // 투수: 이도류는 타선에 있어도 선발로 쓸 수 있다
    const pTaken = new Set();
    // 선발 자원(SP·이도류)을 먼저, 모자라면 불펜에서 채운다
    const spScore = p => S.ovrAt(p.r, 'SP') + (p.pos === 'SP' || p.role === 'TW' ? 1000 : 0);
    const sp = pits.slice().sort((a, b) => spScore(b) - spScore(a)).slice(0, nSP).map(p => p.id);
    sp.forEach(id => pTaken.add(id));
    const rp = pits.filter(p => !pTaken.has(p.id) && (p.role !== 'TW' || !taken.has(p.id))).sort((a, b) => (S.ovrAt(b.r, 'RP') + (b.closer ? 5 : 0)) - (S.ovrAt(a.r, 'RP') + (a.closer ? 5 : 0)));
    const relief = rp.filter(p => simPos(p.pos) === 'RP'), longs = rp.filter(p => simPos(p.pos) !== 'RP');
    const CL = relief[0] ? relief[0].id : (longs[0] ? longs.shift().id : null);
    const SU = relief.slice(1, 3).map(p => p.id);
    const MR = relief.slice(3).map(p => p.id);
    const LR = longs.filter(p => p.id !== CL).map(p => p.id);
    return { bat: order, sp, CL, SU, MR, LR };
  }
  // 라인업 검사 → 문제 목록 (빈 배열이면 OK)
  function checkLineup(lu, byId, o) {
    o = o || {};
    const errs = [];
    const bat = (lu.bat || []).filter(x => x && x.id);
    if (bat.length !== 9) errs.push('타순 9명을 모두 채워야 한다');
    const slots = bat.map(x => x.slot);
    for (const s of BAT_POS) if (slots.filter(x => x === s).length !== 1) errs.push(`${POS_KO[s]} 자리를 한 명이 맡아야 한다`);
    const ids = bat.map(x => x.id);
    if (new Set(ids).size !== ids.length) errs.push('같은 선수가 타순에 두 번 들어갔다');
    for (const id of ids) { const p = byId[id]; if (!p) errs.push('없는 선수가 타순에 있다'); else if (!isBatter(p)) errs.push(`${p.name}은(는) 투수라 타순에 넣을 수 없다`); }
    const pIds = [].concat(lu.sp || [], lu.CL ? [lu.CL] : [], lu.CL2 ? [lu.CL2] : [], lu.SU || [], lu.MR || [], lu.LR || []).filter(Boolean);
    if ((lu.sp || []).filter(Boolean).length < (o.nSP || 5)) errs.push(`선발 ${o.nSP || 5}명을 모두 정해야 한다`);
    if (new Set(pIds).size !== pIds.length) errs.push('같은 투수가 두 보직에 들어갔다');
    for (const id of pIds) { const p = byId[id]; if (!p) errs.push('없는 투수가 있다'); else if (!isPitcher(p)) errs.push(`${p.name}은(는) 타자라 투수로 쓸 수 없다`); }
    for (const id of pIds) if (ids.indexOf(id) >= 0 && byId[id] && byId[id].role !== 'TW') errs.push(`${byId[id].name}은(는) 이도류가 아니라 타자·투수를 겸할 수 없다`);
    return Array.from(new Set(errs));
  }

  // ================================================================
  // 리그모드
  // ================================================================
  const MONTHS = ['3·4월', '5월', '6월', '7월', '8월', '9월'];
  function leagueSchedule(seed, teamIds) {
    // KBO처럼 시리즈로: 원형 순환 9라운드를 한 라운드씩 같은 상대와 연전(3연전·2연전). 팀당 상대별 16경기 = 3연전 4번 + 2연전 2번, 홈·원정 8경기씩.
    const R = makeRng(hash('sched|' + seed));
    const n = teamIds.length, days = [];
    const arr = teamIds.slice();
    const base = [];
    for (let r = 0; r < n - 1; r++) {
      const d = [];
      for (let i = 0; i < n / 2; i++) d.push([arr[i], arr[n - 1 - i]]);
      base.push(d);
      arr.splice(1, 0, arr.pop());
    }
    const per = MB.league.games / (n - 1);   // 상대별 경기 수 (16)
    const plan = schedPlan();   // 16 → 3·3·3·3·2·2 (날짜도 같은 계획으로 요일에 맞춘다)
    let last = -1;
    plan.forEach((len, c) => {
      const order = R.shuffle(base.map((_, i) => i));
      if (order[0] === last) [order[0], order[1]] = [order[1], order[0]];   // 같은 상대와 연전이 이어 붙지 않게
      last = order[order.length - 1];
      for (const i of order) { const games = base[i].map(([x, y]) => c % 2 ? [y, x] : [x, y]); for (let g = 0; g < len; g++) days.push(games); }
    });
    return days;
  }
  // 경기 날짜: KBO처럼 요일에 맞춘 시리즈. 3월 28일 이후 첫 화요일 개막.
  //   3연전은 화~목 · 금~일, 2연전은 화~수 · 목~금 · 토~일. 월요일은 쉰다. day = 정규시즌 경기일 번호(0부터)
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const dateCache = {};
  function schedPlan() { const per = MB.league.games / (MB.league.teams - 1), plan = []; for (let left = per; left > 0;) { const k = left === 4 ? 2 : left >= 3 ? 3 : left; plan.push(k); left -= k; } return plan; }   // 16 → 3·3·3·3·2·2
  function gameDate(year, day) {
    const key = year | 0;
    if (!dateCache[key]) {
      const list = [], rounds = MB.league.teams - 1, at = dt => ({ y: key, m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), w: WD[dt.getUTCDay()] });
      const week = new Date(Date.UTC(key, 2, 28)); while (week.getUTCDay() !== 2) week.setUTCDate(week.getUTCDate() + 1);   // 첫 화요일
      const OFF = { 3: [0, 3], 2: [0, 2, 4] };   // 화요일부터 며칠 뒤에 시리즈가 시작하나
      let lenNow = null, slot = 0;
      for (const len of schedPlan()) for (let r = 0; r < rounds; r++) {
        if (len !== lenNow) { if (lenNow !== null && slot) { week.setUTCDate(week.getUTCDate() + 7); } lenNow = len; slot = 0; }   // 시리즈 길이가 바뀌면 다음 주 화요일부터
        const s = new Date(week); s.setUTCDate(s.getUTCDate() + OFF[len][slot]);
        for (let g = 0; g < len; g++) { const dt = new Date(s); dt.setUTCDate(dt.getUTCDate() + g); list.push(at(dt)); }
        if (++slot >= OFF[len].length) { slot = 0; week.setUTCDate(week.getUTCDate() + 7); }
      }
      // 정규시즌 뒤 (포스트시즌 날짜용): 월요일 빼고 이어서
      const d = new Date(Date.UTC(list[list.length - 1].y, list[list.length - 1].m - 1, list[list.length - 1].d));
      for (let k = 0; k < 60; k++) { d.setUTCDate(d.getUTCDate() + 1); if (d.getUTCDay() !== 1) list.push(at(d)); else k--; }
      dateCache[key] = list;
    }
    return dateCache[key][Math.max(0, Math.min(day, dateCache[key].length - 1))];
  }
  const dateTxt = (year, day) => { const g = gameDate(year, day); return `${g.m}월 ${g.d}일 (${g.w})`; };
  // 포스트시즌 날짜: 정규시즌 끝나고 사흘 뒤부터, 시리즈 사이 하루 휴식
  function postDate(year, seasonDays, roundIdx, gameNo) { return dateTxt(year, seasonDays + 2 + roundIdx * 8 + gameNo); }
  // 월 구분은 실제 날짜 기준 (3·4월을 한 구간으로)
  const monthOf = (day, year) => { const m = gameDate(year || 2027, day).m; return Math.max(0, Math.min(MONTHS.length - 1, m - 4)); };
  // 온라인모드: 내 구단을 뺀 9팀을 유저 구단으로. 지금은 서버가 없어 가상 유저 —
  // 구단 이름을 바꾸고, 그 유저가 원작에서 키운 선수(보관함 카드)처럼 강한 선수 몇 명을 로스터에 더한다
  const USER_CLUBS = [['서울 번개', '#2b4c9b'], ['부산 파도', '#0b6e4f'], ['대구 사자굴', '#9b2b2b'], ['광주 호랑이굴', '#6b3fa0'], ['인천 등대', '#b5651d'], ['수원 성곽', '#1f6f8b'], ['대전 은하', '#7a7a1d'], ['창원 공룡알', '#333333'], ['울산 고래', '#14627a'], ['청주 직지', '#7a3d14']];
  function userClubs(seed, teams, players, mySlot) {
    const R = makeRng(hash('users|' + seed)), names = R.shuffle(USER_CLUBS.slice()), U = MB.online;
    const POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'SP', 'SP', 'SP', 'RP', 'CL'];
    let k = 0;
    for (const t of teams) {
      if (t.id === mySlot) continue;
      const [name, color] = names[k++];
      t.name = name; t.color = color; t.user = true;
      const n = R.int(U.userCards[0], U.userCards[1]);
      for (let i = 0; i < n; i++) {
        const pos = R.pick(POS), id = t.id + ':u' + i;
        const p = genPlayer(R, id, pos === 'CL' ? 'RP' : pos, R.range(U.userBase[0], U.userBase[1]), { star: false });
        p.pos = pos; p.user = true; p.closer = pos === 'CL';
        players[id] = p; t.roster.push(id);
      }
    }
  }
  function newLeague(o) {
    const seed = o.seed >>> 0;
    const { teams, players } = makeRosters(seed);
    const mine = teams.find(t => t.id === o.slot);
    const club = { name: o.name || mine.name, emblem: o.emblem || '⚾', color: o.color || mine.color, from: mine.name };
    mine.name = club.name; mine.color = club.color; mine.mine = true;
    if (o.online) userClubs(seed, teams, players, o.slot);
    const lg = { v: 1, mode: o.online ? 'online' : 'league', seed, my: o.slot, club, year: o.year || 2027, season: 1, teams, players, cards: {}, lineup: null, lineups: {}, hist: [], cardRec: {}, ageV: 1 };
    for (const t of teams) lg.lineups[t.id] = autoLineup(t.roster.map(id => players[id]));
    signCards(lg, o.vault || { cards: [] });   // 내 구단 = 보관함 카드 (없는 포지션은 생성 선수 카드)
    lg.lineup = myAutoLineup(myPool(lg), bpN(lg));
    lg.aiV = 2;   // 컴퓨터 구단은 처음부터 능력치를 올려 만든다 (makeRosters)
    startLeagueSeason(lg); mgrGoal(lg);
    return lg;
  }
  function startLeagueSeason(lg) {
    const ids = lg.teams.map(t => t.id);
    lg.cur = {
      season: lg.season, year: lg.year, sseed: hash(lg.seed + '|S' + lg.season), day: 0, sched: leagueSchedule(lg.seed + ':' + lg.season, ids),
      stand: Object.fromEntries(ids.map(id => [id, { w: 0, l: 0, t: 0, rs: 0, ra: 0 }])), stats: {}, done: {}, myBox: {}, myGames: [],
      rot: Object.fromEntries(ids.map(id => [id, 0])), pUse: {}, post: null, champion: null, phase: 'reg',
    };
  }
  function lgPlayer(lg, id) { return lg.players[id] || lg.cards[id] || (lg.gone && lg.gone[id]); }
  // 내 구단 선수 풀: 보관함 카드 + 보관함으로 못 채운 라인업 자리의 생성 선수(모든 능력치 65)
  function myPool(lg) { return lg.teams.find(t => t.id === lg.my).roster.map(id => lg.players[id]).concat(Object.values(lg.cards).filter(p => !inFarm(lg, p.id))); }   // 2군 선수는 1군 경기에 못 나온다
  // 라인업 자리 수: 야수 9(지명타자 포함) · 선발 5 · 불펜 5 · 마무리 1 (보관함에는 불펜 6·마무리 2까지 두고 그중에서 고른다)
  const bpN = () => 5;   // 라인업 불펜 자리 수 (리그·온라인·보관함 같음)
  const MY_NEED = { C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, LF: 1, CF: 1, RF: 1, DH: 1, SP: 5, RP: 6, CL: 1 };   // RP는 bpN(lg)로 바뀐다
  const FILL_V = 50;   // 내부값 50 = 화면 65
  function fillerPlayer(lg, pos, i) {
    const id = lg.my + ':f:' + pos + i, R = makeRng(hash('fill|' + lg.seed + '|' + id));
    const r = {}; for (const k of S.ALL) r[k] = FILL_V;
    return { id, name: R.pick(DATA.surnames) + R.pick(DATA.given1) + R.pick(DATA.given2), pos, role: pos === 'SP' || pos === 'RP' || pos === 'CL' ? 'P' : 'B', r, num: R.int(1, 99), filler: true, closer: pos === 'CL' || undefined };
  }
  const isCloser = p => p.pos === 'CL' || (p.pos === 'RP' && !!p.closer);   // 선발 카드의 closer 표시는 무시
  // 내 구단은 제 포지션 선수만 그 자리에 설 수 있다 (지명타자는 타자 누구나, 선발은 선발·이도류)
  function fitsSlot(p, slot) {
    if (!p) return false;
    if (slot === 'DH') return isBatter(p);
    if (slot === 'SP') return p.pos === 'SP' || p.role === 'TW';
    if (slot === 'CL') return isPitcher(p) && p.role !== 'TW' && isCloser(p);
    if (slot === 'RP') return p.pos === 'RP' && !p.closer;
    return isBatter(p) && p.pos === slot;
  }
  // 내 구단 자동 편성: 자리마다 제 포지션 선수 중 가장 좋은 선수. 마무리 1(CL) · 불펜1·2(SU) · 불펜3~(MR). 라인업 밖 투수는 남는 불펜으로.
  function myAutoLineup(pool, nRP) {
    const taken = new Set(), field = {}, best = (slot, key) => pool.filter(p => !taken.has(p.id) && fitsSlot(p, slot)).sort((a, b) => S.ovrAt(b.r, key) - S.ovrAt(a.r, key))[0];
    for (const slot of ['C', 'SS', '2B', 'CF', '3B', 'RF', 'LF', '1B', 'DH']) { const c = best(slot, simPos(slot)); if (c) { field[slot] = c.id; taken.add(c.id); } }
    const nine = BAT_POS.filter(s => field[s]).map(s => ({ id: field[s], slot: s }));
    const byId = Object.fromEntries(pool.map(p => [p.id, p]));
    const off = x => { const b = bRates(byId[x.id]); return b.bb * 1.4 + (1 - b.k) * b.babip * 1.1 + b.hr * 2.5; };
    const ranked = nine.slice().sort((a, b) => off(b) - off(a));
    const bat = [ranked[1], ranked[3], ranked[0], ranked[2], ranked[4], ranked[5], ranked[6], ranked[7], ranked[8]].filter(Boolean);
    const pick = (slot, n) => pool.filter(p => fitsSlot(p, slot) && !pTaken.has(p.id)).sort((a, b) => S.ovrAt(b.r, slot === 'SP' ? 'SP' : 'RP') - S.ovrAt(a.r, slot === 'SP' ? 'SP' : 'RP')).slice(0, n).map(p => (pTaken.add(p.id), p.id));
    const pTaken = new Set();
    const sp = pick('SP', 5), cl = pick('CL', 1), rp = pick('RP', nRP || 6);
    const lu = { bat, sp, CL: cl[0] || null, CL2: null, SU: rp.slice(0, 2), MR: rp.slice(2), LR: [], v2: 1 };
    lu.BN = autoBench(pool, lu);
    lu.LR = benchPitchers(pool, lu); return lu;
  }
  // 라인업에 안 넣은 투수(보관함에 둔 나머지 불펜·마무리·선발)는 남는 불펜으로 자동 등판
  // 후보 타자 5명 (경기에 나갈 수 있는 벤치): 타순에 없는 타자 중 타격이 좋은 순
  const BN_N = 5;
  function autoBench(pool, lu) {
    const used = new Set(lu.bat.map(b => b.id));
    const b = pool.filter(p => isBatter(p) && !used.has(p.id)).sort((x, y) => S.ovrAt(y.r, 'DH') - S.ovrAt(x.r, 'DH')).slice(0, BN_N).map(p => p.id);
    while (b.length < BN_N) b.push(null);
    return b;
  }
  function benchPitchers(pool, lu) {
    const used = new Set([].concat(lu.sp, [lu.CL, lu.CL2], lu.SU || [], lu.MR || [], lu.bat.map(b => b.id)).filter(Boolean));
    return pool.filter(p => isPitcher(p) && p.role !== 'TW' && !used.has(p.id)).sort((a, b) => S.ovrAt(b.r, 'RP') - S.ovrAt(a.r, 'RP')).map(p => p.id);
  }
  // 라인업이 제 포지션 규칙에 맞나 (안 맞는 칸 목록)
  function myLineupFit(lg) {
    const lu = lg.lineup, P = id => lgPlayer(lg, id), bad = [];
    for (const b of lu.bat) if (b.id && !fitsSlot(P(b.id), b.slot)) bad.push(`${P(b.id) ? P(b.id).name : '?'}: ${POS_KO[b.slot]} 자리에 설 수 없다`);
    const chk = (ids, slot, ko) => { for (const id of ids) if (id && !fitsSlot(P(id), slot)) bad.push(`${P(id) ? P(id).name : '?'}: ${ko} 자리에 설 수 없다`); };
    chk(lu.sp || [], 'SP', '선발'); chk([lu.CL, lu.CL2], 'CL', '마무리'); chk([].concat(lu.SU || [], lu.MR || []), 'RP', '불펜');
    return bad;
  }
  // 내 구단 선수 = 보관함 카드뿐 (생성 선수도 보관함 카드로 들어 있다). 바뀌어서 라인업에 없는 선수가 생기면 자동 편성.
  function syncMyRoster(lg) {
    const t = lg.teams.find(x => x.id === lg.my); t.roster = [];
    if (lg.lineup) {
      const ids = new Set(myPool(lg).map(p => p.id)), lu = lg.lineup;
      const used = [].concat(lu.bat.map(b => b.id), lu.sp, [lu.CL, lu.CL2], lu.SU || [], lu.MR || [], lu.LR || []).filter(Boolean);
      if (!(lg.fillV >= 7)) lg.lineup = myAutoLineup(myPool(lg), bpN(lg));
      else if (used.some(id => !ids.has(id))) {   // 빠진 선수(은퇴·삭제) 자리만 비운다 — 나머지 라인업은 그대로, 빈 칸은 경기 때 채운다
        const ok = id => id && ids.has(id) ? id : null;
        lu.bat.forEach(b => { b.id = ok(b.id); }); lu.sp = (lu.sp || []).map(ok); lu.CL = ok(lu.CL); lu.CL2 = ok(lu.CL2);
        lu.SU = (lu.SU || []).map(ok); lu.MR = (lu.MR || []).map(ok); lu.LR = (lu.LR || []).filter(id => ok(id)); if (lu.BN) lu.BN = lu.BN.map(ok);
      }
    }
    lg.fillV = 7;
  }
  // 빈 칸 채우기 (경기 시작 때): 비어 있는 자리는 그 포지션의 남는 선수 중 가장 좋은 선수로 (불펜은 선수가 모자라면 빈 채로)
  function fillEmpty(lg) {
    const lu = lg.lineup; if (!lu) return false;
    const used = new Set([].concat(lu.bat.map(b => b.id), lu.sp, [lu.CL], lu.SU || [], lu.MR || []).filter(Boolean));
    let changed = false;
    const pool = myPool(lg);
    const key = slot => slot === 'SP' ? 'SP' : slot === 'CL' || slot === 'RP' ? 'RP' : simPos(slot);
    const take = slot => {
      const p = pool.filter(q => !used.has(q.id) && fitsSlot(q, slot)).sort((a, b) => ((b.pos === slot) - (a.pos === slot)) || S.ovrAt(b.r, key(slot)) - S.ovrAt(a.r, key(slot)))[0];
      if (!p) return null;
      used.add(p.id); changed = true; return p.id;
    };
    for (const b of lu.bat) if (!b.id) b.id = take(b.slot);
    for (let i = 0; i < 5; i++) if (!lu.sp[i]) lu.sp[i] = take('SP');
    if (!lu.CL) lu.CL = take('CL');
    lu.SU = lu.SU || []; lu.MR = lu.MR || [];
    for (let i = 0; i < 2; i++) if (!lu.SU[i]) lu.SU[i] = take('RP');
    for (let i = 0; i < bpN(lg) - 2; i++) if (!lu.MR[i]) lu.MR[i] = take('RP');
    lu.MR.length = bpN(lg) - 2;
    if (changed) lu.LR = benchPitchers(myPool(lg), lu);
    return changed;
  }
  // 꼭 채워야 하는 칸(야수 9 · 선발 5 · 마무리)이 비었나. 불펜은 비어도 된다
  const hasEmpty = lu => !!lu && (lu.bat.some(b => !b.id) || lu.sp.slice(0, 5).some(x => !x) || lu.sp.length < 5 || !lu.CL);
  // 비우기: 라인업 칸을 전부 비운다 (빈 칸은 경기 시작 때 남는 선수로 채워진다)
  function clearMyLineup(lg) {
    const old = lg.lineup;
    lg.lineup = { bat: old.bat.map(b => ({ id: null, slot: b.slot })), sp: [null, null, null, null, null], CL: null, CL2: null, SU: [null, null], MR: Array(bpN(lg) - 2).fill(null), LR: [], BN: Array(BN_N).fill(null), v2: 1 };
  }
  // 보관함 ↔ 리그: 보관함에 있는 카드만 내 선수. 보관함에서 지운 카드는 기록 조회용(lg.gone)으로만 남긴다
  function signCards(lg, vault) {
    ensureFillers(vault);
    const ids = new Set(); let n = 0;
    // 은퇴해 쉬는 카드·3번 다 쓴 카드는 빠진다. 새로 들어오면 고른 나이로 새 생활
    for (const c of vault.cards || []) { if (!cardUsable(c, lg)) continue; const p = cardPlayer(c); ids.add(p.id); if (!lg.cards[p.id]) { lg.cards[p.id] = c.filler ? p : newLife(p, c); n++; } else { if (!c.filler) lifeInit(lg.cards[p.id], c); if (lg.cards[p.id].bats == null) { lg.cards[p.id].bats = p.bats; lg.cards[p.id].throws = p.throws; } } }
    // 은퇴해 쉬는 카드·다 쓴 카드는 보관함 슬롯은 차지하지만 이 리그에선 못 뛴다 → 그 포지션에 뛸 선수가 모자라면 이 리그에만 생성 선수 (보관함에는 안 넣는다)
    for (const pos of VAULT_POS) {
      let have = (vault.cards || []).filter(c => c.pos === pos && cardUsable(c, lg) && !inFarm(lg, 'v:' + c.id)).length;   // 2군 카드는 1군 자리를 못 채운다
      for (let i = 0; have < FILL_MIN(pos); i++, have++) { const c = fillerCard(pos, 20 + i); c.id = `lf-${pos}-${i}`; const p = cardPlayer(c); ids.add(p.id); if (!lg.cards[p.id]) { lg.cards[p.id] = p; n++; } }
    }
    for (const id of Object.keys(lg.cards)) if (!ids.has(id)) { (lg.gone || (lg.gone = {}))[id] = lg.cards[id]; delete lg.cards[id]; n++; }
    if (lg.farm) lg.farm = lg.farm.filter(id => lg.cards[id]);
    fixNums(lg);   // 영구결번 번호를 단 다른 선수는 번호를 바꾼다
    if (n || lg.fillV !== 7) syncMyRoster(lg);
    const lu = lg.lineup;
    if (lu) { const ids = new Set(myPool(lg).map(p => p.id)), bat = new Set(lu.bat.map(b => b.id)); if (!lu.BN) lu.BN = autoBench(myPool(lg), lu); else lu.BN = lu.BN.map(id => id && ids.has(id) && !bat.has(id) ? id : null); }   // 후보: 없으면 자동, 타순에 든 선수·지운 선수는 뺀다
    if (lu && (lu.MR || []).length > bpN(lg) - 2) { lu.MR.length = bpN(lg) - 2; lu.LR = benchPitchers(myPool(lg), lu); }   // 불펜 칸 수가 줄었으면 넘치는 칸은 남는 불펜으로
    // 한 번만: 노화를 넣기 전부터 있던 리그는 카드가 성장기 없이 전성기 나이로 시작했다 → 능력치는 그대로 두고 나이만 4살 되돌린다 (10시즌쯤 쓰게)
    if (!lg.ageV) {
      for (const id in lg.cards) { const p = lg.cards[id]; if (!p.filler && p.pa != null && p.age >= p.pa) p.age -= MB.age.back; }
      lg.ageV = 1;
    }
  }
  // ================================================================
  // 나이 · 성장 · 노화 · 은퇴 (보관함 카드, 리그·온라인 공통 — 온라인은 나중에 규칙이 갈라질 수 있어 lg.online으로 분기할 자리를 둔다)
  //   보관함에 넣을 때 시작 나이를 고른다 (전성기 나이 ~ 4살 어리게). 어리면 1살에 능력치 1.5씩 낮게 시작해 해마다 자라
  //   전성기 나이에 카드 능력치에 닿는다. 그 뒤 4년은 유지, 그다음부터 원작 노화(유형별 시작 나이·해마다 가속)를 50% 속도로
  //   (2026-11-27 측정: 이 설정이면 강팀으로 9시즌쯤, 그 뒤 천천히 내려간다. 예전 2년·70%는 5시즌 뒤 한꺼번에 무너졌다)
  //   은퇴(43세 또는 35세 이후 전성기보다 OVR 20 이상 떨어짐)하거나 리그를 초기화하면 사용 1회. 3회 다 쓰면 더는 못 쓴다 (명예의 전당 또는 방출)
  // ================================================================
  MB.age = { grow: 1.5, back: 4, young: 5, defPrime: 28, retire: 43, dropAge: 35, drop: 20, lives: 3, hof: 10, hold: 4, speed: 0.5 };   // hold: 전성기 뒤 능력치 유지 해 수 · speed: 노화 속도 (원작 대비)
  const modeKey = lg => lg.mode === 'online' ? 'on' : 'lg';
  const primeAgeOf = c => c.primeAge || MB.age.defPrime;
  function startAgeOf(c) { const pa = primeAgeOf(c); return Math.max(pa - MB.age.young, Math.min(pa, c.age0 || pa - MB.age.back)); }   // 따로 고르지 않으면 4살 어리게 (5살까지 고를 수 있다)
  const usesOf = c => c.uses || 0, livesLeft = c => Math.max(0, MB.age.lives - usesOf(c));
  // 사용 횟수 제한(3번)은 온라인만. 리그모드는 몇 번이든 다시 쓸 수 있다 (uses는 온라인에서만 센다)
  const limited = lg => modeKey(lg) === 'on';
  const cardUsable = (c, lg) => c.filler || ((!limited(lg) || livesLeft(c) > 0) && !(c.rest && c.rest[modeKey(lg)]));
  function ageKeys(p) { return p.role === 'TW' ? S.ALL : S.mainKeys({ role: isPitcher(p) ? 'P' : 'B' }); }
  // 새 선수 생활 시작: 고른 나이에 맞춰 능력치를 낮춘다
  function newLife(p, c) {
    const pa = primeAgeOf(c), age = startAgeOf(c), n = pa - age;
    p.pa = pa; p.age = age; p.baseR = Object.assign({}, c.r); p.life = usesOf(c) + 1; p.aging = c.aging || 'std';
    if (n > 0) for (const k of ageKeys(p)) p.r[k] = Math.max(20, Math.round((c.r[k] - MB.age.grow * n) * 10) / 10);
    p.ovr = dispOvr(p.r, p.pos);
    return p;
  }
  // 예전 리그에 이미 들어 있던 카드: 지금 능력치(전성기) 그대로 전성기 나이부터
  function lifeInit(p, c) { if (p.pa != null) return; p.pa = primeAgeOf(c); p.age = p.age || p.pa; p.baseR = Object.assign({}, c.r); p.life = usesOf(c) + 1; p.aging = c.aging || 'std'; }
  // 지난 시즌 출전 비율 → 성장 배수 (0.5 못 뜀 ~ 1.0 보통 주전 ~ 1.25 풀타임). 타자 500타석, 선발 150이닝, 불펜 60이닝이 풀타임
  function playF(lg, p) {
    const R = lg.cardRec && lg.cardRec[p.id], s = R && R.seasons.filter(x => x.year === lg.year - 1).pop();
    if (!s) return 0.5;
    const sh = (b, q) => Math.max(b ? (b.PA || 0) / 500 : 0, q ? (q.outs || 0) / (p.pos === 'SP' ? 450 : 180) : 0);
    const share = Math.max(sh(s.b, s.p), MB.fut.w * Math.min(1, sh(s.fb, s.fp)));   // 퓨처스(2군) 출전은 90%로 친다
    return Math.round((0.5 + 0.75 * Math.min(1, share)) * 100) / 100;
  }
  // 한 해 나이 먹기 (새 시즌 시작 때). 반환: 은퇴하면 true
  function ageOne(lg, p) {
    const R = makeRng(hash(`${lg.seed}|age|${lg.season}|${p.id}`));
    p.age++;
    const keys = ageKeys(p);
    const short = keys.some(k => p.r[k] < p.baseR[k] - 0.05);
    if (p.age <= p.pa || (short && p.age <= p.pa + MB.age.hold)) {   // 성장: 전성기 나이에 카드 능력치에 닿게 남은 차이를 나눠 채운다 (유지 기간에도 덜 컸으면 마저)
      // 출전 보너스: 지난 시즌 많이 뛰면 더 크고(최대 1.25배, 카드 능력치 +2까지), 못 뛰면 덜 큰다(0.5배)
      const f = playF(lg, p), left = Math.max(1, p.pa - p.age + 1);
      for (const k of keys) { const step = Math.max(0, (p.baseR[k] - p.r[k]) / left) * f; p.r[k] = Math.round(Math.min(p.baseR[k] + (f > 1 ? 2 : 0), p.r[k] + step) * 10) / 10; }
      p.lastF = f;
    } else {   // 노화: 원작 규칙 (유형별 시작 나이, 능력치별 늦게 시작, 해마다 가속)
      const BAL = S.BAL, crash = p.aging === 'meteor' && BAL.meteor ? BAL.meteor.decline : p.aging === 'flash' && BAL.awaken ? BAL.awaken.flashDecline : null;   // 혜성형·반짝 각성형은 전성기 다음 해부터 바로 크게
      const ag = crash ? [p.pa + 1].concat(crash) : BAL.aging[p.aging] || BAL.aging.std, start = crash ? p.pa + 1 : Math.max(ag[0], p.pa + 1 + MB.age.hold);   // 전성기 뒤 2년은 유지 (혜성형·반짝 각성형은 원작처럼 바로)
      if (p.age >= start) {
        const y = p.age - start, off = isPitcher(p) ? { vel: 0, sta: 0, stf: 1, brk: 1, men: 2, ctl: 2, spd: 0, def: 0, pow: 1, arm: 1, con: 1, eye: 2 } : { spd: 0, def: 0, pow: 1, arm: 1, con: 1, eye: 2 };
        for (const k of keys) { if (y < (off[k] || 0)) continue; const d = (ag[1] + Math.floor(R() * (ag[2] - ag[1] + 1))) * (1 + BAL.agingAccel * y) * MB.age.speed; p.r[k] = Math.max(20, Math.round((p.r[k] - d) * 10) / 10); }
      }
    }
    p.ovr = dispOvr(p.r, p.pos);
    rateCache.delete(p);   // 능력치가 바뀌었으니 경기용 비율 다시 계산
    const prime = dispOvr(p.baseR, p.pos);
    return p.age >= MB.age.retire || (p.age >= MB.age.dropAge && p.ovr <= prime - MB.age.drop);
  }
  // 이 리그에서 쌓은 카드 기록을 보관함 카드로 옮긴다 (명예의 전당 통산 기록용). part: 진행 중 시즌 기록도 넣을지
  function bankRec(lg, c, part) {
    const id = 'v:' + c.id, R = lg.cardRec && lg.cardRec[id], s = part && lg.cur && lg.cur.stats && lg.cur.stats[id];
    const seasons = (R ? R.seasons : []).slice();
    if (s && lg.cur.phase !== 'done') seasons.push({ season: lg.cur.season, year: lg.cur.year, b: s.b, p: s.p, titles: [], champ: false, part: true });
    if (!seasons.length) return false;
    (c.bank || (c.bank = [])).push({ mode: modeKey(lg), club: lg.club.name, life: (lg.cards[id] && lg.cards[id].life) || usesOf(c) + 1, seasons });
    if (lg.cardRec) delete lg.cardRec[id];
    return true;
  }
  // 새 시즌: 내 카드 나이 먹기 → 은퇴하면 사용 1회 + 기록 옮기고 이 모드에서 쉬게(보관함에서 '다시 쓰기'로 새 생활)
  function ageCards(lg, vault) {
    const out = [];
    for (const c of vault.cards || []) {
      const id = 'v:' + c.id, p = lg.cards[id]; if (!p || c.filler) continue;
      lifeInit(p, c);
      if (!ageOne(lg, p)) continue;
      out.push(retireOne(lg, c, p, false));
    }
    if (out.length) signCards(lg, vault);
    return out;
  }
  // 은퇴 처리 (나이로 자동 · 감독이 직접). 기록을 옮기고 이 모드에서 쉬게, 은퇴 선수 명단(영구결번 후보)에 올린다
  function retireOne(lg, c, p, manual) {
    const id = 'v:' + c.id;
    bankRec(lg, c, manual);   // 시즌 도중 직접 은퇴시키면 진행 중 기록도 옮긴다
    if (limited(lg)) c.uses = usesOf(c) + 1;
    (c.rest || (c.rest = {}))[modeKey(lg)] = true;
    if (lg.farm) lg.farm = lg.farm.filter(x => x !== id);
    const C = lg.clubRec && lg.clubRec.car[id], s = lg.cur.stats && lg.cur.stats[id];
    const e = { id, card: c.id, name: p.name, num: p.num, pos: p.pos, age: p.age, year: manual ? lg.cur.year : lg.year - 1, from: C ? C.from : (s ? lg.cur.year : null), av: c.avatar, color: c.color, manual: manual || undefined };
    const R = lg.retired || (lg.retired = []); R.push(e); if (R.length > 40) R.splice(0, R.length - 40);
    (lg.cur.news || (lg.cur.news = [])).push({ d: manual ? Math.max(0, lg.cur.day - 1) : -1, k: 'retire', txt: `[${lg.club.name}] ${p.name} ${p.age}세로 ${manual ? '현역 은퇴 선언' : '은퇴'}${limited(lg) ? ` — 사용 ${c.uses}/${MB.age.lives}` : ' — 보관함에서 다시 쓸 수 있다'}`, t: lg.my, pid: id });
    return e;
  }
  // 감독이 직접 은퇴시키기 (리그모드 · 포스트시즌 중에는 안 된다)
  function retireCard(lg, vault, cid) {
    const c = (vault.cards || []).find(x => x.id === cid), p = c && lg.cards['v:' + cid];
    if (!p || c.filler) return { ok: false, why: '은퇴시킬 수 없는 선수' };
    if (lg.cur.phase === 'post') return { ok: false, why: '포스트시즌 중에는 은퇴시킬 수 없다' };
    lifeInit(p, c);
    const e = retireOne(lg, c, p, true);
    signCards(lg, vault);
    return { ok: true, e };
  }
  // 영구결번 (구단 레전드): 우리 구단에서 은퇴한 선수의 등번호를 다시 못 달게. 같은 번호는 한 명만
  function retireNum(lg, id, on) {
    const L = lg.legends || (lg.legends = []), r = (lg.retired || []).find(x => x.id === id);
    if (!on) { lg.legends = L.filter(x => x.id !== id); return { ok: true }; }
    if (!r) return { ok: false, why: '은퇴한 선수만 영구결번할 수 있다' };
    if (L.some(x => x.id === id)) return { ok: true };
    if (r.num == null) return { ok: false, why: '등번호가 없다' };
    const same = L.find(x => x.num === r.num); if (same) return { ok: false, why: `${r.num}번은 이미 ${same.name}의 영구결번` };
    L.push(Object.assign({}, r, { at: lg.cur.year })); fixNums(lg);
    return { ok: true };
  }
  // 영구결번 번호를 단 현역 선수는 비어 있는 번호로 바꾼다 (레전드 본인이 다시 뛰면 그대로)
  function fixNums(lg) {
    const L = lg.legends; if (!L || !L.length) return;
    const ret = new Map(L.map(x => [x.num, x.id])), used = new Set(Object.values(lg.cards).map(p => p.num));
    for (const p of Object.values(lg.cards)) {
      if (!ret.has(p.num) || ret.get(p.num) === p.id) continue;
      let n = hash(p.id) % 99 + 1; for (let k = 0; k < 99 && (ret.has(n) || used.has(n)); k++) n = n % 99 + 1;
      used.add(n); p.num = n;
    }
  }
  // 구단 레전드의 우리 구단 통산 (기록실 통산 + 진행 중 시즌)
  function legendLine(lg, id) {
    const C = lg.clubRec && lg.clubRec.car[id], s = lg.cur.phase !== 'done' && lg.cur.stats[id] && lg.cur.stats[id].t === lg.my ? lg.cur.stats[id] : null;
    const b = {}, p = {}; for (const x of [C, s]) if (x) { for (const k in x.b) b[k] = (b[k] || 0) + (x.b[k] || 0); for (const k in x.p) p[k] = (p[k] || 0) + (x.p[k] || 0); }
    const champ = (lg.hist || []).filter(h => h.champion === lg.my && C && h.year >= C.from && h.year <= C.to).length;
    return { b, p, from: C ? C.from : null, to: C ? C.to : null, champ };
  }
  // 리그 초기화: 이 리그에서 뛴 카드는 사용 1회 (경기에 한 번도 안 나왔으면 그대로). 쉬던 표시는 새 리그에서 풀린다
  function resetLives(lg, vault) {
    let n = 0;
    for (const c of vault.cards || []) {
      if (c.filler) continue;
      const id = 'v:' + c.id, played = (lg.cardRec && lg.cardRec[id]) || (lg.cur && lg.cur.stats && lg.cur.stats[id]);
      if (c.rest) delete c.rest[modeKey(lg)];
      if (!played || !lg.cards[id]) continue;
      bankRec(lg, c, true); if (limited(lg)) c.uses = usesOf(c) + 1; n++;   // 기록은 명전 통산용으로 옮기고(보관함 저장 필요), 횟수는 온라인만
    }
    return n;
  }
  // 명예의 전당 (최대 10명): 보관함 카드를 넣는다. 지금 뛰는 리그 기록도 옮겨 담고, 보관함에서는 빠진다 (슬롯이 빈다)
  function hofInduct(vault, id, leagues) {
    const H = vault.hof || (vault.hof = []), c = (vault.cards || []).find(x => x.id === id);
    if (!c || c.filler) return { ok: false, why: 'none' };
    if (H.length >= MB.age.hof) return { ok: false, why: 'full' };
    for (const lg of leagues) if (lg) bankRec(lg, c, true);
    H.push({ card: c, at: Date.now() });
    vaultRemove(vault, id);
    return { ok: true };
  }
  // 명전 통산: 모드 기록 전부 합치기
  function hofTotals(c) {
    const b = {}, p = {}, add = (a, x) => { if (x) for (const k in x) if (typeof x[k] === 'number') a[k] = (a[k] || 0) + x[k]; };
    let seasons = 0, champ = 0; const titles = [], clubs = new Set();
    for (const L of c.bank || []) { clubs.add(`${L.mode === 'on' ? '온라인' : '리그'} ${L.club}`); for (const s of L.seasons) { seasons++; add(b, s.b); add(p, s.p); add(b, s.pb); add(p, s.pp); if (s.champ) champ++; (s.titles || []).forEach(t => titles.push(`${s.year} ${t}`)); } }
    return { b, p, seasons, champ, titles, clubs: [...clubs], lives: (c.bank || []).length };
  }
  // 투수 체력(0~100): 던지면 아웃 수만큼 떨어지고(체력 능력치가 높으면 덜), 하루 지날 때마다 기초 회복 + 체력 능력치 비례 회복
  function condOf(lg, p, day) {
    const c = lg.cur.cond && p && lg.cur.cond[p.id]; if (!c) return 100;
    const C = MB.cond, sta = (p.base || p).r.sta || 50;
    return Math.round(Math.max(0, Math.min(100, c[0] + Math.max(0, day - c[1]) * (C.recBase + sta * C.recSta))));
  }
  // 내 구단 다음 선발 (로테이션 몇 번째 칸인가: 0 = 1선발). 정규시즌 5인, 포스트시즌 4인
  function nextSp(lg) { const cur = lg.cur, n = cur.phase === 'post' ? 4 : 5; return ((cur.rot && cur.rot[lg.my]) || 0) % n; }
  // 선발 순서 바꾸기는 로테이션 한 바퀴가 끝나 1선발이 나올 차례일 때만
  const canReorderRot = lg => nextSp(lg) === 0;
  // 다음 경기 날 (정규시즌 경기일 번호, 포스트시즌은 200부터)
  function nowDay(lg) { const cur = lg.cur, P = cur.post; if (cur.phase === 'post' && P) { const r = P.rounds[P.idx]; return 200 + P.idx * 10 + r.games.length + 1; } return cur.phase === 'reg' ? cur.day : 199; }
  // 체력이 70 아래로 떨어진 투수는 구간별로 그 경기 투구 능력치가 떨어진다 (사본, 기록용 id는 그대로)
  const TIRED_KEYS = ['vel', 'ctl', 'stf', 'brk', 'sta'];
  function tiredDrop(lg, p, day) { const v = condOf(lg, p, day); return MB.cond.tired.find(([min]) => v >= min)[1]; }   // 체력 구간별 단계 감소
  function tired(lg, p, day) {
    if (!p) return p;
    const d = tiredDrop(lg, p, day); if (!d) return p;
    const r = Object.assign({}, p.r); for (const k of TIRED_KEYS) r[k] = Math.max(20, (r[k] || 20) - d);
    return Object.assign({}, p, { r, base: p.base || p });
  }
  // 부상 중인가 (inj[id] = 복귀하는 경기일)
  const isHurt = (lg, id, day) => !!(lg.cur.inj && lg.cur.inj[id] > day);
  function lineupSide(lg, tid, lu, dayKey, opt) {
    const P = id => lgPlayer(lg, id), ok = p => p && !isHurt(lg, p.id, dayKey);
    const team = lg.teams.find(x => x.id === tid);
    const pool = tid === lg.my ? myPool(lg) : team.roster.map(P).filter(Boolean);
    // 타순: 부상 선수는 그 자리 대신 — 후보 중 제 포지션 → 없으면 아무 타자 (포지션 감점)
    const taken = new Set(lu.bat.map(x => x.id).filter(id => ok(P(id))));
    const restDay = !(opt && opt.post) && dayKey < 200;   // 정규시즌만 (포스트시즌 날짜는 200부터)
    const order = lu.bat.map(x => {
      let p = P(x.id);
      // 주전 휴식: 같은 날·같은 선수면 항상 같은 결과 (관전·시뮬이 같게)
      if (ok(p) && restDay && rngFor(lg.cur.sseed, `rest|${tid}|${dayKey}|${p.id}`)() < (x.slot === 'C' ? MB.rest.C : MB.rest.bat)) {
        const grp = s => s === 'C' ? 'C' : ['LF', 'CF', 'RF'].includes(s) ? 'OF' : s === 'DH' ? 'DH' : 'IF';   // 같은 포지션 후보가 없으면 같은 내야·외야 후보
        const free = pool.filter(q => ok(q) && isBatter(q) && q.role !== 'TW' && !taken.has(q.id)), best = l => l.sort((a, b) => S.ovrAt(b.r, simPos(x.slot)) - S.ovrAt(a.r, simPos(x.slot)))[0];
        const rep = best(free.filter(q => fitsSlot(q, x.slot))) || (x.slot !== 'C' && x.slot !== 'DH' ? best(free.filter(q => q.pos !== 'C' && q.pos !== 'DH' && grp(q.pos) === grp(x.slot))) : null);
        if (rep) { taken.add(rep.id); p = rep; }
      }
      if (!ok(p)) {
        const cand = pool.filter(q => ok(q) && isBatter(q) && !taken.has(q.id));
        const rep = cand.filter(q => natural(q, x.slot)).sort((a, b) => S.ovrAt(b.r, simPos(x.slot)) - S.ovrAt(a.r, simPos(x.slot)))[0] || cand.sort((a, b) => S.ovrAt(b.r, 'DH') - S.ovrAt(a.r, 'DH'))[0];
        if (rep) { taken.add(rep.id); p = rep; }
        if (!p) p = cardPlayer(fillerCard(x.slot === 'DH' ? 'DH' : x.slot, 9));   // 쓸 타자가 아무도 없으면 그 경기만 생성 선수 (은퇴·부상으로 비었을 때)
      }
      return { p: slotPlayer(p, x.slot), slot: x.slot };
    });
    const cur = lg.cur, rot = cur.rot[tid] || 0;
    const sps = lu.sp.filter(Boolean).map(P).filter(Boolean);
    const nSP = opt && opt.post ? Math.min(4, sps.length) : sps.length;
    // 선발: 로테이션 차례 투수가 부상이면 다음 차례 투수
    let spP = sps[rot % nSP];
    for (let k = 0; k < nSP && !ok(spP); k++) spP = sps[(rot + 1 + k) % nSP];
    if (!ok(spP)) spP = pool.filter(q => ok(q) && isPitcher(q) && q.role !== 'TW').sort((a, b) => S.ovrAt(b.r, 'SP') - S.ovrAt(a.r, 'SP'))[0] || spP;
    if (!spP) spP = cardPlayer(fillerCard('SP', 9));   // 투수가 아무도 없으면 (은퇴로 다 빠졌을 때) 그 경기만 생성 선수
    const sp = tired(lg, slotPlayer(spP, 'SP'), dayKey);
    cur.rot[tid] = rot + 1;
    const can = p => { const u = cur.pUse[p.id] || []; const d = dayKey; return ok(p) && !(u.indexOf(d - 1) >= 0 && u.indexOf(d - 2) >= 0) && u.indexOf(d) < 0 && condOf(lg, p, d) >= MB.cond.minRel; };
    // 마무리 두 명: 첫 번째가 지쳤으면 두 번째가 마무리, 남는 한 명은 중간계투로. 중간계투는 최근 덜 던진 투수부터
    let c1 = lu.CL ? P(lu.CL) : null, c2 = lu.CL2 ? P(lu.CL2) : null;
    if (c1 && c2 && !can(c1) && can(c2)) [c1, c2] = [c2, c1];
    if (!c1) { c1 = c2; c2 = null; }
    const pen = { CL: c1, SU: (lu.SU || []).map(P).filter(Boolean), MR: (lu.v2 ? (lu.MR || []).concat(lu.LR || []) : (lu.MR || [])).map(P).filter(Boolean).concat(c2 ? [c2] : []).map((p, i) => [p, (cur.pUse[p.id] || []).filter(x => x >= dayKey - 3).length * 10 + i]).sort((a, b) => a[1] - b[1]).map(x => x[0]), LR: (lu.v2 ? [] : (lu.LR || [])).map(P).filter(Boolean).concat(sps.slice(nSP)) };
    for (const k of ['SU', 'MR', 'LR']) pen[k] = pen[k].filter(ok).map(p => tired(lg, p, dayKey)); pen.CL = ok(pen.CL) ? tired(lg, pen.CL, dayKey) : null;
    // 후보 타자 (대타·대수비): 내 구단은 고른 후보 5명, 다른 구단은 로스터에서 타순에 없는 타자 중 5명 (부상 제외)
    const inOrder = new Set(order.map(x => x.p.id));
    const bench = (lu.BN ? lu.BN.map(P) : team.roster.map(P).filter(p => p && isBatter(p) && p.role !== 'TW').sort((a, b) => S.ovrAt(b.r, simPos(b.pos)) - S.ovrAt(a.r, simPos(a.pos))).slice(0, 7)).filter(p => ok(p) && !inOrder.has(p.id)).slice(0, 5);
    return { tid, order, sp, pen, can, bench };
  }
  // 부상: 경기에 나온 선수가 낮은 확률로 다친다 (지친 투수·많이 던진 투수일수록 조금 더). 결장 경기 수는 짧게·중간·길게
  function rollInjuries(lg, box, d) {
    const I = MB.inj, R = rngFor(lg.cur.sseed, box.id + '|inj'), inj = lg.cur.inj || (lg.cur.inj = {});
    const hurt = (pid, tid) => {
      if (inj[pid] > d) return;
      const u = R(), games = u < 0.7 ? 2 + Math.floor(R() * 5) : u < 0.95 ? 8 + Math.floor(R() * 8) : 20 + Math.floor(R() * 21);   // 짧게 2~6경기 70% · 중간 8~15경기 25% · 길게 20~40경기 5%
      inj[pid] = d + 1 + games;
      const p = lgPlayer(lg, pid); (box.notes || (box.notes = [])).push({ t: tid, txt: `${p ? p.name : pid} 부상 — ${games}경기 결장`, inj: pid, g: games });
    };
    for (const tid in box.b) for (const row of box.b[tid]) if (row[2] > 0 && R() < I.bat) hurt(row[0], tid);
    for (const tid in box.p) for (const row of box.p[tid]) if (row[1] > 0 && R() < I.pit * (1 + (row[11] || 0) / 100)) hurt(row[0], tid);
  }
  // 한 경기 결과를 리그에 반영 (기록·순위·체력·부상)
  function recordGame(lg, box, d, a, h, id) {
    const cur = lg.cur;
    box.day = d; cur.done[id] = [box.sc[0], box.sc[1]];
    rollInjuries(lg, box, d);
    addBox(cur.stats, box); addStand(cur.stand, box); markUse(lg, box, d);
    if (a === lg.my || h === lg.my) { cur.myBox[id] = box; cur.myGames.push(id); }
    addNews(lg, box, d, id);
  }
  // 소식: 경기 결과에서 뉴스거리 뽑기. 내 구단은 결과·연승연패·홈런·맹타·호투·부상 모두, 다른 구단은 큰 기록만 (멀티 홈런·4안타·완봉·두 자릿수 홈런 고비·긴 부상)
  const NEWS_MAX = 300;
  function addNews(lg, box, d, id) {
    const cur = lg.cur, N = cur.news || (cur.news = []), my = lg.my, post = !!box.post;
    const tn = t => { const x = lg.teams.find(y => y.id === t); return x ? x.name : t; }, pn = pid => { const p = lgPlayer(lg, pid); return p ? p.name : pid; };
    const add = (k, txt, t, o) => N.push(Object.assign({ d, k, txt, t, post: post || undefined }, o || {}));
    const pre = t => `[${tn(t)}] `;   // 내 구단 소식도 [구단 이름]
    if (box.a === my || box.h === my) {
      const me = box.a === my ? 0 : 1, opp = me ? box.a : box.h, ms = box.sc[me], os = box.sc[1 - me];
      const res = box.win == null ? '무승부' : box.win === my ? '승리' : '패배', dec = k => { for (const t in box.p) { const r = box.p[t].find(x => x[8] === k); if (r) return pn(r[0]); } return ''; };
      const wp = dec('W'), sv = dec('S');
      add('game', `${post ? (cur.post.rounds[cur.post.idx] || {}).name + " · " : ""}[${tn(my)}] ${tn(opp)}에 ${ms}-${os} ${res}${wp ? ` · 승 ${wp}` : ''}${sv ? ` · 세 ${sv}` : ''}${box.inn > 9 ? ` (연장 ${box.inn}회)` : ''}`, my, { id, w: box.win === my ? 1 : box.win == null ? 0 : -1 });
      if (!post && box.win != null) {   // 연승·연패 (3연속부터)
        const want = box.win === my; let n = 0;
        for (let i = cur.myGames.length - 1; i >= 0; i--) { const b = cur.myBox[cur.myGames[i]]; if (!b || b.post) continue; if ((b.win === my) !== want || b.win == null) break; n++; }
        if (n >= 3) add('streak', `[${tn(my)}] ${n}${want ? '연승 질주' : '연패 수렁'}`, my);
      }
    }
    for (const t in box.b) for (const r of box.b[t]) {
      const s = cur.stats[r[0]], hr = s ? s.b.HR : r[7], mine = t === my;
      if (r[7] && (mine || r[7] >= 2 || [10, 20, 30, 40, 50].some(m => hr >= m && hr - r[7] < m))) add('hr', `${pre(t)}${pn(r[0])} ${(post ? `포스트시즌 ${r[7] >= 2 ? r[7] + "홈런 폭발" : "홈런"}` : r[7] >= 2 ? `${r[7]}홈런 폭발 (시즌 ${hr}호)` : `시즌 ${hr}호 홈런`)}${r[11] ? ` · ${r[11]}타점` : ''}`, t, { pid: r[0] });
      if (r[4] >= (mine ? 3 : 4)) add('hit', `${pre(t)}${pn(r[0])} ${r[3]}타수 ${r[4]}안타${r[11] ? ` ${r[11]}타점` : ''} 맹타`, t, { pid: r[0] });
      if (mine && r[12] >= 2) add('sb', `${pre(t)}${pn(r[0])} 도루 ${r[12]}개로 그라운드 흔들어`, t, { pid: r[0] });
    }
    for (const t in box.p) { const rows = box.p[t]; for (const r of rows) {
      const mine = t === my, cg = r[9] && rows.length === 1, ip = `${Math.floor(r[1] / 3)}${r[1] % 3 ? `.${r[1] % 3}` : ''}`;
      if (cg && !r[4]) add('pit', `${pre(t)}${pn(r[0])} 완봉승! ${r[6]}탈삼진`, t, { pid: r[0] });
      else if (mine && cg) add('pit', `${pre(t)}${pn(r[0])} 완투 ${r[4]}실점`, t, { pid: r[0] });
      else if (mine && r[9] && r[1] >= 18 && r[10] <= 3) add('pit', `${pre(t)}${pn(r[0])} ${ip}이닝 ${r[10]}자책 호투${r[6] >= 8 ? ` · ${r[6]}K` : ''}`, t, { pid: r[0] });
      else if (r[6] >= (mine ? 10 : 12)) add('pit', `${pre(t)}${pn(r[0])} ${r[6]}탈삼진 쇼`, t, { pid: r[0] });
      if (mine && r[8] === 'S') { const s = cur.stats[r[0]]; if (s && s.p.SV % 10 === 0) add('pit', `${pre(t)}${pn(r[0])} 시즌 ${s.p.SV}세이브`, t, { pid: r[0] }); }
    } }
    if (!post && (box.a === my || box.h === my)) clubMilestones(lg, box, add);   // 구단 통산 고비 (100홈런 등)
    for (const n of box.notes || []) if (n.inj && (n.t === my || n.g >= 10)) add('inj', `${pre(n.t)}${n.txt}`, n.t, { pid: n.inj });
    if (N.length > NEWS_MAX) N.splice(0, N.length - NEWS_MAX);
  }
  // 관전: 오늘 다른 경기는 바로 처리하고, 내 경기는 한 타석씩 돌릴 수 있게 넘겨준다. 다 보면 finish()
  function watchDay(lg) {
    fillEmpty(lg);
    const cur = lg.cur, d = cur.day; if (cur.phase !== 'reg' || d >= cur.sched.length) return null;
    let mine = null;
    for (const [a, h] of cur.sched[d]) {
      const id = `L${cur.season}-D${d + 1}-${a}-${h}`;
      if (cur.done[id]) continue;
      if (a === lg.my || h === lg.my) { mine = { a, h, id }; continue; }
      const away = lineupSide(lg, a, lgLineupOf(lg, a), d), home = lineupSide(lg, h, lgLineupOf(lg, h), d);
      recordGame(lg, playGame(id, cur.sseed, away, home), d, a, h, id);
    }
    if (!mine) { futDay(lg, d); cur.day++; if (cur.day >= cur.sched.length) cur.phase = 'regDone'; return null; }
    const away = lineupSide(lg, mine.a, lgLineupOf(lg, mine.a), d), home = lineupSide(lg, mine.h, lgLineupOf(lg, mine.h), d);
    const g = createGame(mine.id, cur.sseed, away, home, { mine: mine.a === lg.my ? 0 : 1 });
    g.id = mine.id; g.day = d;
    g.finish = () => {
      if (g.closed) return; let r; g.v.ctl.auto = true;   // 남은 경기를 한 번에 돌릴 때는 AI가 교체
      if (!g.v.done) while (!(r = g.it.next()).done);
      g.closed = true; recordGame(lg, g.v.box, d, mine.a, mine.h, mine.id);
      futDay(lg, d); cur.day++; if (cur.day >= cur.sched.length) cur.phase = 'regDone';
    };
    return g;
  }
  function markUse(lg, box, dayKey) {
    for (const tid in box.p) for (const row of box.p[tid]) { const u = lg.cur.pUse[row[0]] || (lg.cur.pUse[row[0]] = []); u.push(dayKey); if (u.length > 4) u.shift(); }
    const C = MB.cond, cond = lg.cur.cond || (lg.cur.cond = {});
    for (const tid in box.p) for (const row of box.p[tid]) { const p = lgPlayer(lg, row[0]); if (!p) continue; const sta = p.r.sta || 50; cond[p.id] = [Math.max(0, Math.round(condOf(lg, p, dayKey) - (C.use + (row[11] != null ? row[11] * C.perPitch : row[1] * C.perOut) * (1.25 - sta / 200)))), dayKey]; }   // 체력 소모는 투구 수 기준 (예전 박스는 아웃 수)
  }
  function lgLineupOf(lg, tid) { return tid === lg.my ? lg.lineup : lg.lineups[tid]; }
  function playLeagueDay(lg) {
    fillEmpty(lg);   // 내 라인업 빈 칸은 경기 전에 생성 선수로
    const cur = lg.cur, d = cur.day;
    if (d >= cur.sched.length) return false;
    for (const [a, h] of cur.sched[d]) {
      const id = `L${cur.season}-D${d + 1}-${a}-${h}`;
      if (cur.done[id]) continue;   // 이미 집계한 경기는 다시 세지 않는다
      const away = lineupSide(lg, a, lgLineupOf(lg, a), d), home = lineupSide(lg, h, lgLineupOf(lg, h), d);
      recordGame(lg, playGame(id, cur.sseed, away, home), d, a, h, id);
    }
    futDay(lg, d);   // 퓨처스 (2군)
    cur.day++;
    if (cur.day >= cur.sched.length) cur.phase = 'regDone';
    return true;
  }
  // 내 라인업(선발 9·로테이션·불펜·마무리·후보)에 든 부상 선수 — 있으면 교체하기 전에는 경기를 돌리지 않는다
  function myHurt(lg) {
    const lu = lg.lineup; if (!lu || !lg.cur) return [];
    const d = nowDay(lg), ids = [].concat(lu.bat.map(x => x.id), lu.sp || [], [lu.CL, lu.CL2], lu.SU || [], lu.MR || [], lu.BN || []).filter(Boolean);
    return ids.filter((id, i) => ids.indexOf(id) === i && isHurt(lg, id, d)).map(id => { const p = lgPlayer(lg, id); return { id, name: p ? p.name : id, left: lg.cur.inj[id] - d }; });
  }
  function playLeagueMonth(lg, stopHurt) {
    const cur = lg.cur; if (cur.phase !== 'reg') return 0;
    const m = monthOf(cur.day, lg.year); let n = 0;
    while (cur.phase === 'reg' && monthOf(cur.day, lg.year) === m && !(stopHurt && myHurt(lg).length)) { playLeagueDay(lg); n++; }   // stopHurt: 내 선수가 다치면 멈춘다 (화면에서 진행할 때)
    return n;
  }
  // 내 구단 이번 시리즈에 남은 경기 수 (같은 상대와 연속으로 붙는 날 수)
  function seriesLeft(lg) {
    const cur = lg.cur, opp = d => { const g = (cur.sched[d] || []).find(([a, h]) => a === lg.my || h === lg.my); return g ? (g[0] === lg.my ? g[1] : g[0]) : null; };
    const o = opp(cur.day); if (o == null) return 0;
    let k = 0; while (cur.day + k < cur.sched.length && opp(cur.day + k) === o) k++;
    return k;
  }
  const nextOpp = lg => { const cur = lg.cur, g = (cur.sched[cur.day] || []).find(([a, h]) => a === lg.my || h === lg.my); return g ? { opp: g[0] === lg.my ? g[1] : g[0], home: g[1] === lg.my } : null; };
  // 정규시즌 n경기(n일) 진행 — 한 경기 · 시리즈(3연전)
  function playLeagueDays(lg, n, stopHurt) { let k = 0; while (lg.cur.phase === 'reg' && k < n && !(stopHurt && myHurt(lg).length)) { playLeagueDay(lg); k++; } return k; }
  function playLeagueAll(lg) { let n = 0; while (lg.cur.phase === 'reg') { playLeagueDay(lg); n++; } return n; }
  function leagueStandings(lg) { return standList(lg.cur.stand, lg.teams); }

  // 포스트시즌: 와일드카드(4위 1승 안고 2전) → 준플레이오프(5전) → 플레이오프(5전) → 한국시리즈(7전)
  function leaguePostInit(lg) {
    const cur = lg.cur; if (cur.phase !== 'regDone') return;
    const st = leagueStandings(lg).map(s => s.id);
    cur.post = { seeds: st.slice(0, 5), rounds: [
      { key: 'WC', name: '와일드카드 결정전', hi: st[3], lo: st[4], need: [2, 2], adv: 1, games: [] },   // 4위는 1승을 안고 시작
      { key: 'SPO', name: '준플레이오프', hi: st[2], lo: null, need: [3, 3], games: [] },
      { key: 'PO', name: '플레이오프', hi: st[1], lo: null, need: [3, 3], games: [] },
      { key: 'KS', name: '한국시리즈', hi: st[0], lo: null, need: [4, 4], games: [] },
    ], idx: 0 };
    cur.phase = 'post';
  }
  function seriesWins(r) { let a = r.adv || 0, b = 0; for (const g of r.games) { if (g.win === r.hi) a++; else if (g.win === r.lo) b++; } return [a, b]; }
  function seriesOver(r) { const [a, b] = seriesWins(r); return a >= r.need[0] || b >= r.need[1] || (r.key === 'WC' && r.games.length >= 2); }
  function seriesWinner(r) { const [a, b] = seriesWins(r); if (b >= r.need[1]) return r.lo; if (a >= r.need[0]) return r.hi; return r.key === 'WC' ? r.hi : null; }
  // 포스트시즌 다음 경기 (지금 라운드의 다음 차전): 홈·원정, 경기 ID, 날짜 키
  function postNext(lg) {
    const cur = lg.cur, P = cur.post; if (!P || cur.phase !== 'post') return null;
    const r = P.rounds[P.idx]; if (seriesOver(r)) return null;
    const gi = r.games.length + 1;
    const homeHi = r.key === 'KS' || r.key === 'WC' ? [1, 2, 6, 7].indexOf(gi) >= 0 || r.key === 'WC' : [1, 2, 5].indexOf(gi) >= 0;
    const [h, a] = homeHi ? [r.hi, r.lo] : [r.lo, r.hi];
    return { r, gi, a, h, id: `L${cur.season}-${r.key}${gi}`, dk: 200 + P.idx * 10 + gi, mine: a === lg.my || h === lg.my };
  }
  // 포스트시즌 한 경기 결과 반영. 시리즈가 끝나면 다음 라운드로 (마지막이면 시즌 종료)
  function recordPost(lg, n, box) {
    const cur = lg.cur, P = cur.post, r = n.r;
    rollInjuries(lg, box, n.dk); markUse(lg, box, n.dk);
    r.games.push({ id: n.id, win: box.win, sc: box.sc, a: n.a, h: n.h });
    if (!P.stats) P.stats = {};
    addBox(P.stats, box);
    if (n.mine) { cur.myBox[n.id] = box; cur.myGames.push(n.id); addNews(lg, box, n.dk, n.id); }
    if (!seriesOver(r)) return;
    const w = seriesWinner(r);
    r.winner = w;
    if (P.idx < P.rounds.length - 1) { P.idx++; P.rounds[P.idx].lo = w; }
    else { cur.champion = w; cur.phase = 'done'; finishLeagueSeason(lg); }
  }
  function playPostGame(lg) {
    const n = postNext(lg); if (!n) return null;
    fillEmpty(lg);
    const cur = lg.cur, away = lineupSide(lg, n.a, lgLineupOf(lg, n.a), n.dk, { post: true }), home = lineupSide(lg, n.h, lgLineupOf(lg, n.h), n.dk, { post: true });
    recordPost(lg, n, playGame(n.id, cur.sseed, away, home, { post: true }));
    return n;
  }
  // 포스트시즌 내 경기 관전 (watchDay와 같은 꼴)
  function watchPost(lg) {
    const n = postNext(lg); if (!n || !n.mine) return null;
    fillEmpty(lg);
    const cur = lg.cur, away = lineupSide(lg, n.a, lgLineupOf(lg, n.a), n.dk, { post: true }), home = lineupSide(lg, n.h, lgLineupOf(lg, n.h), n.dk, { post: true });
    const g = createGame(n.id, cur.sseed, away, home, { mine: n.a === lg.my ? 0 : 1, post: true });
    g.id = n.id; g.day = n.dk; g.title = `${n.r.name} ${n.gi}차전`;
    g.finish = () => { if (g.closed) return; let r; g.v.ctl.auto = true; if (!g.v.done) while (!(r = g.it.next()).done); g.closed = true; recordPost(lg, n, g.v.box); };
    return g;
  }
  function playLeagueSeries(lg) {
    const P = lg.cur.post; if (!P || lg.cur.phase !== 'post') return null;
    const i = P.idx, r = P.rounds[i];
    let guard = 0; while (lg.cur.phase === 'post' && P.idx === i && guard++ < 9) playPostGame(lg);
    return r;
  }
  // 내 구단이 없는 라운드는 결과만: 내 라운드가 올 때까지 (탈락했으면 끝까지) 바로 진행
  function postSkipOthers(lg) {
    let n = 0;
    while (lg.cur.phase === 'post') { const x = postNext(lg); if (!x || x.mine) break; playLeagueSeries(lg); n++; }
    return n;
  }
  function playLeaguePostAll(lg) { if (lg.cur.phase === 'regDone') leaguePostInit(lg); while (lg.cur.phase === 'post') playLeagueSeries(lg); }
  // 개인 타이틀
  const QUAL_PA = 3.1, QUAL_IP = 1.0;
  function leaders(stats, games, byId, n) {
    n = n || 1;
    const rows = Object.entries(stats).map(([id, s]) => ({ id, s, p: byId(id) })).filter(x => x.p);
    const qb = rows.filter(x => x.s.b.PA >= QUAL_PA * games), qp = rows.filter(x => x.s.p.outs / 3 >= QUAL_IP * games);
    const top = (list, f, asc) => list.slice().sort((a, b) => asc ? f(a) - f(b) : f(b) - f(a)).slice(0, n).map(x => ({ id: x.id, name: x.p.name, t: x.s.t, v: f(x) }));
    return {
      AVG: top(qb, x => S.AVG(x.s.b)), HR: top(rows, x => x.s.b.HR), RBI: top(rows, x => x.s.b.RBI), H: top(rows, x => x.s.b.H), OPS: top(qb, x => S.OPS(x.s.b)),
      W: top(rows, x => x.s.p.W), ERA: top(qp, x => S.ERA(x.s.p), true), K: top(rows, x => x.s.p.K), SV: top(rows, x => x.s.p.SV), HLD: top(rows, x => x.s.p.HLD),
    };
  }
  // 수상 목록에서 이 선수가 받은 상 이름들
  function awardsOf(aw, id) {
    if (!aw) return [];
    const out = [];
    if (aw.mvp && aw.mvp.id === id) out.push('MVP');
    if (aw.poy && aw.poy.id === id) out.push('올해의 투수상');
    for (const k in aw.titles) if (aw.titles[k] && aw.titles[k].id === id) out.push(k);
    for (const k in aw.gg) if ((aw.gg[k] || []).some(e => e && e.id === id)) out.push('골든글러브');
    return out;
  }
  function postRounds(P, tn) { return P ? P.rounds.map(r => { const w = seriesWins(r); return { name: r.name, win: r.winner, lose: r.winner === r.hi ? r.lo : r.hi, score: `${Math.max(w[0], w[1])}-${Math.min(w[0], w[1])}` }; }) : []; }
  function finishLeagueSeason(lg) {
    const cur = lg.cur;
    const stand = leagueStandings(lg);
    const sum = leagueSummary(lg, true);
    cur.awards = sum.awards;
    // 보관함 카드 모드별 기록 (원작 기록과 별개)
    for (const id in lg.cards) {
      const s = cur.stats[id], ps = cur.post && cur.post.stats && cur.post.stats[id], fs = cur.fut && cur.fut.stats[id];
      if (!s && !ps && !fs) continue;
      const c = lg.cards[id];
      const rec = lg.cardRec[id] || (lg.cardRec[id] = { name: c.name, pos: c.pos, seasons: [] });
      const e = s && sum.stats.bat.concat(sum.stats.pit).find(x => x.n === c.name && x.t === s.t);
      rec.seasons.push({ season: cur.season, year: cur.year, b: s ? s.b : null, p: s ? s.p : null, pb: ps ? ps.b : null, pp: ps ? ps.p : null, fb: fs ? fs.b : undefined, fp: fs ? fs.p : undefined, titles: awardsOf(sum.awards, id), war: e ? e.war : null, champ: cur.champion === lg.my });
    }
    const myRank = stand.find(s => s.id === lg.my);
    lg.hist.push({
      season: cur.season, year: cur.year, champion: cur.champion, championName: (lg.teams.find(t => t.id === cur.champion) || {}).name,
      stand: stand.map(s => ({ id: s.id, name: s.name, w: s.w, l: s.l, t: s.t })), myRank: myRank ? myRank.rank : null, myRec: myRank ? `${myRank.w}승 ${myRank.l}패 ${myRank.t}무` : '',
      awards: sum.awards, post: postRounds(cur.post),
      goal: cur.goal, fut: (() => { const f = futStandings(lg), m = f && f.find(s => s.id === lg.my); return m ? m.rank : undefined; })(),
    });
    clubAdd(lg); mgrEval(lg);   // 구단 기록실 · 감독 평가
  }
  // ================================================================
  // 컴퓨터 구단 세대교체: 해마다 나이 먹고 (어리면 성장 · 32세부터 노화) 은퇴하면 그 자리에 신인 (리그·온라인 공통)
  // ================================================================
  MB.ai = { boost: 4, rookie: -3, retireAge: 37, hardAge: 41, key: { ctl: 0, men: 0, brk: 0, sta: 0, eye: 0, con: 0 }, rp: 0 };   // boost: 컴퓨터 구단 능력치 올림(내부) · rookie: 신인은 기본보다 낮게 시작
  // key·rp: 능력치별 추가 올림 (지금은 0 — 2026-11-27 측정: boost 4만으로 내 구단 81~82승 2~4위. key×0.5·rp 2면 74승 5위, boost 7+key면 꼴찌)
  function aiKeyBoost(p) { const keys = isPitcher(p) ? S.PIT : S.BAT; for (const k of keys) { const d = (MB.ai.key[k] || 0) + (p.pos === 'RP' ? MB.ai.rp : 0); if (d) p.r[k] = clamp(p.r[k] + d, 22, 99); } rateCache.delete(p); return p; }   // 컴퓨터 불펜은 더 (불펜이 약해 내 구단이 너무 이겼다)
  const aiAge0 = id => 21 + hash(id) % 15;
  function aiSeason(lg) {
    const R = makeRng(hash(`${lg.seed}|ai|${lg.season}`)), BAL = S.BAL, out = [];
    const boost = !lg.aiV, keyUp = (lg.aiV || 0) < 2;   // 예전 리그: 한 번 능력치 올림 (2단계: 제구·멘탈·선구)
    for (const t of lg.teams) {
      if (t.id === lg.my || t.user) continue;
      const td = DATA.teams.find(x => x.id === t.id) || { bat: 100, pit: 100 };
      const sB = (td.bat - 100) * 0.8, sP = (td.pit - 100) * 0.5;
      t.roster.forEach((id, i) => {
        const p = lg.players[id]; if (!p) return;
        const keys = isPitcher(p) ? S.PIT : S.BAT;
        if (boost) for (const k of keys) p.r[k] = clamp(p.r[k] + MB.ai.boost, 22, 99);
        if (keyUp) aiKeyBoost(p);
        if (p.age == null) p.age = aiAge0(id);
        p.age++;
        if (p.age <= 27) for (const k of keys) p.r[k] = clamp(p.r[k] + (p.age <= 24 ? 1 + R() * 2 : R() * 1.5), 22, 99);   // 어린 선수는 큰다
        else if (p.age >= 32) { const y = p.age - 32; for (const k of keys) p.r[k] = clamp(p.r[k] - (2 + R() * 2) * (1 + BAL.agingAccel * y) * 0.7, 20, 99); }
        for (const k of keys) p.r[k] = Math.round(p.r[k] * 10) / 10;
        rateCache.delete(p);   // 능력치가 바뀌었으니 경기용 비율 다시 계산
        const retire = p.age >= MB.ai.hardAge || (p.age >= MB.ai.retireAge && R() < (p.age - MB.ai.retireAge + 1) * 0.3) || (p.age >= 33 && dispOvr(p.r, p.pos) < 52);
        if (!retire) return;
        const [pos, kind] = ROSTER[i] || [p.pos, 's'];
        const base = (kind === 's' ? BAL.starterBase + sB : kind === 'b' ? BAL.benchBase + sB : kind === 'x' ? BAL.spCandBase + sP : kind === 'r' ? BAL.rpExtraBase + sP : pos === 'SP' ? 47.5 + sP : 50 + sP) + MB.ai.boost + MB.ai.rookie;
        const nid = `${t.id}:${i}:s${lg.season}`, np = aiKeyBoost(genPlayer(R, nid, pos, base, {}));
        np.age = 20 + Math.floor(R() * 4); np.rookie = lg.year + 1;
        lg.players[nid] = np; t.roster[i] = nid;   // 은퇴 선수 객체는 기록 조회용으로 남긴다
        out.push({ t: t.id, name: p.name, age: p.age, ovr: dispOvr(p.r, p.pos), rookie: np.name });
      });
      lg.lineups[t.id] = autoLineup(t.roster.map(id => lg.players[id]));
    }
    lg.aiV = 2;
    return out;
  }
  // ================================================================
  // 구단 기록실: 우리 구단에서 쌓은 통산 · 한 시즌 최고 (이 리그 동안). 통산 고비(100홈런 등)는 소식으로
  // ================================================================
  // ================================================================
  // 2군 · 퓨처스 리그 (리그모드만): 보관함 카드를 2군에 내리면 1군 경기에는 못 나오고 퓨처스 경기에 뛴다.
  //   퓨처스에서 뛴 만큼 다음 해 성장 보너스를 받는다 (1군 출전의 90%로 친다) — 어리게 넣은 유망주를 키우는 곳
  //   퓨처스 리그 = 10구단 2군 (1군과 같은 날 같은 상대). 다른 구단 2군은 생성 선수, 우리 2군은 내린 카드 + 빈자리는 생성 선수.
  //   우리 2군 경기만 실제로 돌리고 (기록은 우리 카드만 남긴다) 다른 2군끼리는 결과만
  // ================================================================
  MB.fut = { cap: 10, base: 42, w: 0.9 };   // cap: 2군 인원 · base: 퓨처스 생성 선수 능력(내부, 1군 주전 ≈54) · w: 퓨처스 출전을 성장에 얼마나 쳐주나
  const farmOn = lg => modeKey(lg) === 'lg';
  const farmOf = lg => lg.farm || (lg.farm = []);
  function inFarm(lg, id) { return !!(lg.farm && lg.farm.indexOf(id) >= 0); }
  // 1군 ↔ 2군. 1군에 그 포지션 선수가 모자라게 되면 (선발 5 · 불펜 3 · 나머지 1) 이 리그 전용 생성 선수가 1군을 채운다 (vault를 주면 바로)
  function farmMove(lg, id, down, vault) {
    const p = lg.cards[id];
    if (!p || p.filler || !farmOn(lg)) return { ok: false, why: '2군에 보낼 수 없는 선수' };
    if (lg.cur.phase === 'post') return { ok: false, why: '포스트시즌 중에는 1·2군을 바꿀 수 없다' };
    const F = farmOf(lg);
    if (down) {
      if (F.indexOf(id) >= 0) return { ok: true };
      if (F.length >= MB.fut.cap) return { ok: false, why: `2군은 ${MB.fut.cap}명까지` };
      F.push(id);
    } else { const i = F.indexOf(id); if (i >= 0) F.splice(i, 1); }
    if (vault) signCards(lg, vault);
    syncMyRoster(lg); fillEmpty(lg);   // 라인업에서 빠진 자리는 남는 선수로
    return { ok: true };
  }
  const FUT_POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'C', '2B', 'SS', 'CF', '1B', 'SP', 'SP', 'SP', 'SP', 'SP', 'RP', 'RP', 'RP', 'RP', 'RP', 'RP'];
  const FUT_C = new Map();   // 퓨처스 생성 선수 (저장 안 함 — 리그·시즌·구단으로 늘 같게 만든다)
  function futRoster(lg, tid) {
    const k = `${lg.seed}|${lg.season}|${tid}`; let T = FUT_C.get(k); if (T) return T;
    const R = makeRng(hash('fut|' + k)), base = MB.fut.base + R() * 4 - 2;
    T = FUT_POS.map((pos, i) => { const p = genPlayer(R, `F:${tid}:${i}`, pos, base, { star: R.chance(0.05) }); p.age = 19 + hash(p.id + k) % 7; p.fut = true; if (pos === 'RP' && i === FUT_POS.length - 1) p.closer = true; return p; });
    T.pow = T.reduce((a, p) => a + S.ovrAt(p.r, simPos(p.pos)), 0) / T.length;
    if (FUT_C.size > 30) FUT_C.delete(FUT_C.keys().next().value);
    FUT_C.set(k, T); return T;
  }
  // 퓨처스 한 팀 (경기용): 우리 2군 카드를 먼저 쓰고 빈자리는 생성 선수
  function futSide(lg, tid, d) {
    const F = lg.cur.fut, gen = futRoster(lg, tid), mine = tid === lg.my ? farmOf(lg).map(id => lg.cards[id]).filter(Boolean) : [];
    const field = {}, used = new Set();
    const mb = mine.filter(isBatter), mp = mine.filter(p => isPitcher(p) && p.role !== 'TW');
    for (const slot of BAT_POS) { const c = mb.find(p => !used.has(p.id) && p.pos === slot); if (c) { field[slot] = c; used.add(c.id); } }
    for (const p of mb) if (!used.has(p.id)) { const slot = ['DH'].concat(BAT_POS).find(s => !field[s]); if (slot) { field[slot] = p; used.add(p.id); } }   // 같은 포지션이 둘이면 지명타자 → 빈 수비 자리
    const gb = gen.filter(isBatter);
    for (const slot of BAT_POS) if (!field[slot]) { const c = gb.find(p => !used.has(p.id) && (p.pos === slot || slot === 'DH')) || gb.find(p => !used.has(p.id)); field[slot] = c; used.add(c.id); }
    const off = p => { const b = bRates(p); return b.bb * 1.4 + (1 - b.k) * b.babip * 1.1 + b.hr * 2.5; };
    const ranked = BAT_POS.map(s => ({ p: field[s], slot: s })).sort((a, b) => off(b.p) - off(a.p));
    const order = [1, 3, 0, 2, 4, 5, 6, 7, 8].map(i => ({ p: slotPlayer(ranked[i].p, ranked[i].slot), slot: ranked[i].slot }));
    const sps = mine.filter(p => p.pos === 'SP' || p.role === 'TW').concat(gen.filter(p => p.pos === 'SP')).slice(0, 5);
    const rot = F.rot[tid] || 0; F.rot[tid] = rot + 1;
    const sp = slotPlayer(sps[rot % sps.length], 'SP');
    const rps = mp.filter(p => p.pos !== 'SP').concat(gen.filter(p => p.pos === 'RP')), cl = rps.find(isCloser) || rps[0];
    const rest = rps.filter(p => p !== cl);
    const can = p => !(F.use[p.id] >= d - 1);   // 이틀 연속 등판은 안 한다
    return { tid, order, sp, pen: { CL: cl, SU: rest.slice(0, 2), MR: rest.slice(2).concat(mp.filter(p => p.pos === 'SP' && sps.indexOf(p) < 0)), LR: [] }, can, bench: gb.filter(p => !used.has(p.id)).slice(0, 4) };
  }
  // 정규시즌 하루마다: 우리 2군 경기는 돌리고, 다른 2군끼리는 능력 차로 결과만
  function futDay(lg, d) {
    if (!farmOn(lg)) return;
    const cur = lg.cur, F = cur.fut || (cur.fut = { stand: {}, stats: {}, rot: {}, use: {}, last: -1, my: [] });
    if (d <= F.last) return; F.last = d;
    for (const t of lg.teams) if (!F.stand[t.id]) F.stand[t.id] = { w: 0, l: 0, t: 0, rs: 0, ra: 0 };
    const R = rngFor(cur.sseed, 'futq|' + d), keep = new Set(farmOf(lg));
    for (const [a, h] of cur.sched[d] || []) {
      if (a === lg.my || h === lg.my) {
        const box = playGame(`F${cur.season}-D${d + 1}-${a}-${h}`, cur.sseed, futSide(lg, a, d), futSide(lg, h, d));
        addStand(F.stand, box);
        for (const t in box.p) for (const row of box.p[t]) F.use[row[0]] = d;
        const mb = { b: { [lg.my]: (box.b[lg.my] || []).filter(r => keep.has(r[0])) }, p: { [lg.my]: (box.p[lg.my] || []).filter(r => keep.has(r[0])) } };
        addBox(F.stats, mb); futNews(lg, mb, d);
        const me = box.a === lg.my ? 0 : 1; F.my.push([d, me ? box.a : box.h, box.sc[me], box.sc[1 - me]]); if (F.my.length > 10) F.my.shift();
      } else {
        const pa = clamp(0.5 + (futRoster(lg, a).pow - futRoster(lg, h).pow) * 0.03 - 0.02, 0.2, 0.8), lo = Math.floor(R() * 6), hi = lo + 1 + Math.floor(R() * 5), aw = R() < pa;
        addStand(F.stand, { a, h, sc: aw ? [hi, lo] : [lo, hi], win: aw ? a : h });
      }
    }
  }
  function futNews(lg, mb, d) {
    const N = lg.cur.news || (lg.cur.news = []), pre = `[${lg.club.name} 2군] `, nm = id => (lg.cards[id] || {}).name || id;
    for (const r of mb.b[lg.my]) if (r[7] >= 2 || r[4] >= 3) N.push({ d, k: 'fut', txt: `${pre}퓨처스 ${nm(r[0])} ${r[7] >= 2 ? `${r[7]}홈런` : `${r[3]}타수 ${r[4]}안타`}${r[11] ? ` ${r[11]}타점` : ''}`, t: lg.my, pid: r[0] });
    for (const r of mb.p[lg.my]) if (r[9] && r[1] >= 18 && r[10] <= 1) N.push({ d, k: 'fut', txt: `${pre}퓨처스 ${nm(r[0])} ${Math.floor(r[1] / 3)}이닝 ${r[10]}자책 ${r[6]}K 호투`, t: lg.my, pid: r[0] });
  }
  const futStandings = lg => lg.cur.fut ? standList(lg.cur.fut.stand, lg.teams) : null;
  // ================================================================
  // 시즌 리포트 (포스트시즌까지 끝났을 때): 성적 · 팀 MVP · 퓨처스 · 다음 시즌 전망 (성장·전성기·노쇠·은퇴 예상)
  // ================================================================
  function seasonReport(lg) {
    const cur = lg.cur, h = lg.hist[lg.hist.length - 1];
    if (cur.phase !== 'done' || !h || h.year !== cur.year) return null;
    const st = leagueStandings(lg).find(s => s.id === lg.my), sum = leagueSummary(lg, false), my = id => { const s = cur.stats[id]; return s && s.t === lg.my; };
    const war = {}; for (const e of sum.stats.bat.concat(sum.stats.pit)) if (e.me) war[e.n] = (war[e.n] || 0) + e.war;
    const ids = Object.keys(cur.stats).filter(my), P = id => lgPlayer(lg, id);
    const row = id => { const p = P(id); return p ? { id, name: p.name, pos: p.pos, war: Math.round((war[p.name] || 0) * 10) / 10, b: cur.stats[id].b, p: cur.stats[id].p } : null; };
    const all = ids.map(row).filter(Boolean).sort((a, b) => b.war - a.war);
    const bat = all.filter(x => x.b.PA >= 300).sort((a, b) => S.OPS(b.b) - S.OPS(a.b))[0] || null, pit = all.filter(x => x.p.outs >= 150).sort((a, b) => b.war - a.war)[0] || null;
    const P0 = cur.post, myRound = P0 ? P0.rounds.filter(r => r.hi === lg.my || r.lo === lg.my).pop() : null;
    const post = cur.champion === lg.my ? '한국시리즈 우승' : myRound ? `${myRound.name} 탈락` : '가을야구 실패';
    const fs = futStandings(lg), fr = fs && fs.find(s => s.id === lg.my);
    const farm = cur.fut ? Object.keys(cur.fut.stats).map(id => ({ id, name: (P(id) || {}).name || id, b: cur.fut.stats[id].b, p: cur.fut.stats[id].p })) : [];
    // 다음 시즌 전망: 내 카드 나이 +1 기준
    const look = [];
    for (const id in lg.cards) {
      const p = lg.cards[id]; if (p.filler || p.pa == null) continue;
      const a = p.age + 1, prime = dispOvr(p.baseR, p.pos), growing = a <= p.pa || Object.keys(p.baseR).some(k => p.r[k] < p.baseR[k] - 0.05) && a <= p.pa + MB.age.hold;
      const crash = p.aging === 'meteor' || p.aging === 'flash', hold = !growing && !crash && a <= p.pa + MB.age.hold;
      const risk = a >= MB.age.retire || (a >= MB.age.dropAge && p.ovr <= prime - MB.age.drop + 4);
      look.push({ id, name: p.name, pos: p.pos, age: a, ovr: p.ovr, prime, pa: p.pa, farm: inFarm(lg, id), k: risk ? 'risk' : growing ? 'grow' : hold ? 'hold' : 'down' });
    }
    return { year: cur.year, w: st.w, l: st.l, t: st.t, rank: st.rank, rs: st.rs, ra: st.ra, post, goal: cur.goal, mgr: lg.mgr && lg.mgr.log[lg.mgr.log.length - 1], mvp: all[0] || null, bat, pit, fut: fr ? { rank: fr.rank, w: fr.w, l: fr.l, t: fr.t } : null, farm, look };
  }
  // 다음 시즌으로: 나이 먹기 전·후 OVR을 비교해 오프시즌 변화(성장·노쇠·은퇴)를 남긴다
  function leagueOffseason(lg, vault) {
    const before = {}; for (const id in lg.cards) { const p = lg.cards[id]; if (!p.filler) before[id] = p.ovr || dispOvr(p.r, p.pos); }
    if (!nextLeagueSeason(lg)) return null;
    const gone = ageCards(lg, vault), out = new Set(gone.map(g => g.id)), ch = [];
    for (const id in before) { const p = lg.cards[id]; if (!p || out.has(id)) continue; ch.push({ id, name: p.name, pos: p.pos, age: p.age, from: before[id], to: p.ovr, d: p.ovr - before[id], farm: inFarm(lg, id) }); }
    ch.sort((a, b) => b.d - a.d);
    return (lg.cur.off = { year: lg.year - 1, gone, ch });
  }
  const CLUB_B = ['G', 'PA', 'AB', 'H', 'D', 'T', 'HR', 'BB', 'K', 'R', 'RBI', 'SB'], CLUB_P = ['G', 'GS', 'outs', 'H', 'ER', 'BB', 'K', 'HR', 'W', 'L', 'SV', 'HLD'];
  // 예전 리그: 카드 시즌 기록(cardRec)으로 구단 기록실을 채운다 (생성 선수 기록은 남아 있지 않다)
  function clubInit(lg) {
    if (lg.clubRec) return lg.clubRec;
    const C = lg.clubRec = { car: {}, best: [] };
    for (const id in lg.cardRec || {}) {
      const R = lg.cardRec[id];
      for (const s of R.seasons) {
        if (lg.cur && s.year >= lg.cur.year) continue;
        const e = C.car[id] || (C.car[id] = { name: R.name, pos: R.pos, from: s.year, b: {}, p: {} }); e.to = s.year;
        for (const k of CLUB_B) e.b[k] = (e.b[k] || 0) + ((s.b || {})[k] || 0);
        for (const k of CLUB_P) e.p[k] = (e.p[k] || 0) + ((s.p || {})[k] || 0);
        C.best.push({ id, name: R.name, year: s.year, b: s.b || {}, p: s.p || {} });
      }
    }
    return C;
  }
  function clubAdd(lg) {   // 정규시즌 끝날 때 한 번
    const C = clubInit(lg), cur = lg.cur;
    for (const id in cur.stats) {
      const s = cur.stats[id]; if (s.t !== lg.my) continue;
      const p = lgPlayer(lg, id), e = C.car[id] || (C.car[id] = { name: p ? p.name : id, pos: p ? p.pos : '', from: cur.year, b: {}, p: {} });
      e.to = cur.year; e.name = p ? p.name : e.name;
      for (const k of CLUB_B) e.b[k] = (e.b[k] || 0) + (s.b[k] || 0);
      for (const k of CLUB_P) e.p[k] = (e.p[k] || 0) + (s.p[k] || 0);
      C.best.push({ id, name: e.name, year: cur.year, b: s.b, p: s.p });
    }
    // 한 시즌 기록은 부문별 상위만 남겨 크기를 줄인다
    const keep = new Set(), top = (f, n) => C.best.slice().sort((a, b) => f(b) - f(a)).slice(0, n).forEach(x => keep.add(x));
    top(x => x.b.HR || 0, 5); top(x => x.b.H || 0, 5); top(x => x.b.RBI || 0, 5); top(x => x.b.SB || 0, 5); top(x => x.p.W || 0, 5); top(x => x.p.K || 0, 5); top(x => x.p.SV || 0, 5);
    top(x => x.b.PA >= 446 ? S.AVG(x.b) : 0, 5); top(x => x.p.outs >= 432 ? -S.ERA(x.p) + 100 : 0, 5);
    C.best = C.best.filter(x => keep.has(x));
  }
  const MILE = { HR: [100, 200, 300, 400, 500], H: [500, 1000, 1500, 2000, 2500, 3000], RBI: [500, 1000, 1500], SB: [100, 200, 300], W: [50, 100, 150, 200], SV: [100, 200, 300, 400], K: [500, 1000, 1500, 2000] };
  const MILE_KO = { HR: '홈런', H: '안타', RBI: '타점', SB: '도루', W: '승', SV: '세이브', K: '탈삼진' };
  // 경기 한 번 뒤 (addNews 안): 이 경기로 구단 통산 고비를 넘었으면
  function clubMilestones(lg, box, add) {
    const C = clubInit(lg), cur = lg.cur, my = lg.my;
    const rows = [].concat((box.b[my] || []).map(r => ({ id: r[0], g: { HR: r[7], H: r[4], RBI: r[11], SB: r[12] }, b: true })), (box.p[my] || []).map(r => ({ id: r[0], g: { W: r[8] === 'W' ? 1 : 0, SV: r[8] === 'S' ? 1 : 0, K: r[6] }, b: false })));
    for (const x of rows) {
      const s = cur.stats[x.id], e = C && C.car[x.id]; if (!s) continue;
      for (const k in x.g) {
        if (!x.g[k]) continue;
        const now = (x.b ? s.b[k] : s.p[k]) + (e ? (x.b ? e.b[k] : e.p[k]) || 0 : 0), before = now - x.g[k];
        const m = MILE[k].find(v => before < v && now >= v);
        if (m) { const p = lgPlayer(lg, x.id); add('mile', `[${(lg.teams.find(t => t.id === my) || {}).name}] ${p ? p.name : x.id} 구단 통산 ${m}${MILE_KO[k]} 달성!`, my, { pid: x.id }); }
      }
    }
  }
  // ================================================================
  // 감독 커리어: 시즌마다 구단주 목표 → 결과로 신뢰도. 20시즌이면 감독 은퇴 (결산 뒤 리그 마무리)
  // ================================================================
  MB.mgr = { seasons: 20, trust0: 60 };
  const GOALS = { champ: { name: '한국시리즈 우승', rank: 0 }, ks: { name: '한국시리즈 진출', rank: 0 }, ps: { name: '가을야구 진출', rank: 5 }, half: { name: '5할 승률', rank: 0 } };
  // 예전 리그: 지난 시즌들로 감독 기록을 채운다 (목표는 가을야구 진출로 친다)
  function mgrInit(lg) {
    if (lg.mgr) return lg.mgr;
    const Mg = lg.mgr = { trust: MB.mgr.trust0, log: [] };
    for (const h of lg.hist) {
      const st = h.stand.find(s => s.id === lg.my), champ = h.champion === lg.my, ok = h.myRank <= 5, d = ok ? (champ ? 18 : 10) : -12 - (h.myRank >= 8 ? 6 : 0);
      Mg.trust = clamp(Mg.trust + d, 0, 100); Mg.log.push({ year: h.year, goal: 'ps', ok, rank: h.myRank, champ, w: st ? st.w : 0, l: st ? st.l : 0, d });
    }
    return Mg;
  }
  function mgrGoal(lg) {   // 새 시즌 목표: 지난 시즌 성적에 따라
    const M = mgrInit(lg), h = lg.hist[lg.hist.length - 1];
    const k = !h ? 'ps' : h.champion === lg.my ? 'champ' : h.myRank <= 2 ? 'ks' : h.myRank <= 6 ? 'ps' : 'half';
    lg.cur.goal = k; return k;
  }
  function mgrEval(lg) {   // 시즌 끝 (포스트시즌까지): 목표 달성 여부 → 신뢰도
    const M = mgrInit(lg), cur = lg.cur, k = cur.goal || 'ps', h = lg.hist[lg.hist.length - 1];
    if (M.log.length && M.log[M.log.length - 1].year === cur.year) return M.log[M.log.length - 1];   // 이미 평가한 시즌
    const st = h && h.stand.find(s => s.id === lg.my), rank = h ? h.myRank : 10, P = cur.post;
    const inKS = !!(P && P.rounds[3] && (P.rounds[3].hi === lg.my || P.rounds[3].lo === lg.my)), champ = cur.champion === lg.my;
    const ok = k === 'champ' ? champ : k === 'ks' ? inKS : k === 'ps' ? rank <= 5 : st ? st.w >= st.l : false;
    const d = ok ? (champ ? 18 : 10) : -12 - (rank >= 8 ? 6 : 0);
    M.trust = clamp(M.trust + d, 0, 100);
    M.log.push({ year: cur.year, goal: k, ok, rank, champ, w: st ? st.w : 0, l: st ? st.l : 0, d });
    return { ok, d };
  }
  const mgrDone = lg => lg.mgr && lg.mgr.log.length >= MB.mgr.seasons;
  function nextLeagueSeason(lg) {
    if (lg.cur.phase !== 'done') return false;
    const aiGone = aiSeason(lg);   // 컴퓨터 구단 나이·은퇴·신인
    lg.season++; lg.year++;
    startLeagueSeason(lg); mgrGoal(lg);
    const N = lg.cur.news = [], tn = t => (lg.teams.find(x => x.id === t) || {}).name;
    for (const g of aiGone) if (g.ovr >= 72) N.push({ d: -1, k: 'retire', txt: `[${tn(g.t)}] ${g.name} ${g.age}세로 은퇴 (OVR ${g.ovr}) — 신인 ${g.rookie} 합류`, t: g.t });   // 이름난 선수 은퇴만 소식으로
    return true;
  }

  // ================================================================
  // 시즌 정리: 원작 커리어 모드의 리그 화면(순위표·기록실·구단 기록·시상)과 같은 모양
  // ================================================================
  // o: { stats, stand(standList 결과), games(팀당 정규시즌 경기 수), played(지금까지 치른 경기), year, seed, playerOf(id), mine(Set), final }
  const ageOf = (p, id) => p.age || 21 + hash(id) % 15;   // 보관함 카드는 전성기 나이, 나머지는 고정된 가상 나이
  function seasonSummary(o) {
    const IN = S._internal, BAL = S.BAL;
    let H = 0, BB = 0, AB = 0, PA = 0, TB = 0, ER = 0, outs = 0, pHR = 0, pBB = 0, pK = 0;
    for (const id in o.stats) { const b = o.stats[id].b, p = o.stats[id].p; H += b.H; BB += b.BB; AB += b.AB; PA += b.PA; TB += b.H + b.D + 2 * b.T + 3 * b.HR; ER += p.ER; outs += p.outs; pHR += p.HR; pBB += p.BB; pK += p.K; }
    const lgOPS = PA ? (H + BB) / PA + TB / Math.max(1, AB) : 0.775, lgERA = outs ? ER * 27 / outs : 4.18;
    const lgIP = outs / 3 || 1, cFIP = lgERA - (13 * pHR + 3 * pBB - 2 * pK) / lgIP;
    const R = makeRng(hash('sum|' + o.seed));
    const entries = [];
    for (const id of Object.keys(o.stats).sort()) {
      const s = o.stats[id], pl = o.playerOf(id); if (!pl) continue;
      const hasB = s.b.PA > 0, hasP = s.p.outs > 0;
      let pos = pl.pos;
      if (hasB && s.pg) { let mg = -1; for (const k in s.pg) if (s.pg[k] > mg) { mg = s.pg[k]; pos = k; } }
      else if (hasP) pos = s.p.GS * 2 >= s.p.G ? 'SP' : 'RP';
      const sp = simPos(pos);
      let war = 0, def = null;
      if (hasB) { war += IN.batWAR(s.b, pl.r, sp, lgOPS); if (sp !== 'DH') def = IN.defLine(pl.r, sp, (s.pg && s.pg[pos]) || s.b.G, R); }
      if (hasP) war += IN.pitWAR(s.p, lgERA);
      entries.push({ id, name: pl.name, team: s.t, pos, age: ageOf(pl, id), foreign: !!pl.foreign, me: !!(o.mine && o.mine.has(id)), bat: hasB ? s.b : null, pit: hasP ? s.p : null, war, def, ovr: S.ovrAt(pl.r, simPos(pos === 'TW' ? 'DH' : pos)) });
    }
    // 기록실 행 (원작 statRows와 같은 칸)
    const bat = [], pit = [];
    for (const e of entries) {
      const base = { n: e.name, t: e.team, pos: e.pos, age: e.age, war: Math.round(e.war * 10) / 10, ovr: e.ovr };
      if (e.me) base.me = 1; if (e.foreign) base.f = 1;
      if (e.bat) { const b = e.bat; bat.push(Object.assign({}, base, { G: b.G, PA: b.PA, AB: b.AB, H: b.H, D: b.D, T: b.T, HR: b.HR, BB: b.BB, K: b.K, SB: b.SB || 0, R: b.R, RBI: b.RBI }, e.def ? { CH: e.def.CH, E: e.def.E, DEF: e.def.DEF } : {})); }
      if (e.pit) { const p = e.pit; pit.push(Object.assign({}, base, { G: p.G, GS: p.GS, outs: p.outs, BF: p.BF, H: p.H, HR: p.HR, BB: p.BB, K: p.K, ER: p.ER, W: p.W, L: p.L, SV: p.SV, HLD: p.HLD, CG: p.CG || 0, SHO: p.SHO || 0 })); }
    }
    const played = Math.max(1, o.played || o.games);
    const standings = o.stand.map(s => ({ id: s.id, name: s.name, rank: s.rank, wins: s.w, losses: s.l, ties: s.t, pct: s.pct }));
    const out = { year: o.year, standings, stats: { year: o.year, games: played, cFIP: Math.round(cFIP * 100) / 100, bat, pit }, awards: null };
    if (!o.final) return out;
    // 시상 (원작 awards와 같은 기준: 규정 타석 3.1×경기, 규정 이닝 1×경기)
    const rankOf = id => (o.stand.find(s => s.id === id) || { rank: 9 }).rank;
    const best = (arr, f) => { let b = null, bv = -1e9; for (const x of arr) { const v = f(x); if (v > bv) { bv = v; b = x; } } return b; };
    const bats = entries.filter(e => e.bat), pits = entries.filter(e => e.pit);
    const qB = bats.filter(e => e.bat.PA >= 3.1 * played), qP = pits.filter(e => e.pit.outs >= 3 * played);
    const titles = {
      '타격왕': best(qB, e => S.AVG(e.bat)), '안타왕': best(bats, e => e.bat.H), '홈런왕': best(bats, e => e.bat.HR), '타점왕': best(bats, e => e.bat.RBI),
      '다승왕': best(pits, e => e.pit.W), '평균자책점왕': best(qP, e => -S.ERA(e.pit)), '세이브왕': best(pits, e => e.pit.SV || 0),
      '탈삼진왕': best(pits, e => e.pit.K || 0), '도루왕': best(bats, e => e.bat.SB || 0),
    };
    const titleCount = {};
    for (const k in titles) if (titles[k]) titleCount[titles[k].id] = (titleCount[titles[k].id] || 0) + 1;
    const ggS = e => e.war + (e.def ? e.def.DEF * 0.25 : 0);
    const gg = {};
    for (const pos of ['C', '1B', '2B', '3B', 'SS', 'DH']) gg[pos] = [best(bats.filter(e => simPos(e.pos) === pos), ggS)];
    gg.OF = bats.filter(e => simPos(e.pos) === 'OF').sort((a, b) => ggS(b) - ggS(a)).slice(0, 3);
    gg.P = [best(pits, e => e.war)];
    const V = BAL.mvpVote;
    const mvp = best(entries, e => { const rk = rankOf(e.team); return e.war / BAL.warScale + (titleCount[e.id] || 0) * V.title + (rk === 1 ? V.top1 : rk <= 3 ? V.top3 : 0) + R.gauss() * V.noise; });
    const poy = best(qP.length ? qP.concat(pits.filter(e => (e.pit.SV || 0) >= 30 * played / 144)) : pits, e => e.war + ['다승왕', '평균자책점왕', '탈삼진왕', '세이브왕'].filter(k => titles[k] === e).length * 0.6);
    // 저장용으로 가볍게 (수상자 기록만)
    const slim = e => e ? { id: e.id, name: e.name, team: e.team, pos: e.pos, me: e.me || undefined, war: Math.round(e.war * 10) / 10, bat: e.bat, pit: e.pit, def: e.def } : null;
    out.awards = { mvp: slim(mvp), roy: null, poy: slim(poy), titles: Object.fromEntries(Object.entries(titles).map(([k, e]) => [k, slim(e)])), gg: Object.fromEntries(Object.entries(gg).map(([k, l]) => [k, l.map(slim)])) };
    return out;
  }
  function leagueSummary(lg, final) {
    const cur = lg.cur, stand = leagueStandings(lg), me = stand.find(s => s.id === lg.my);
    const mine = new Set(myPool(lg).map(p => p.id).concat(Object.keys(lg.cards), Object.keys(lg.gone || {}), Object.keys(lg.players).filter(id => id.indexOf(lg.my + ':') === 0)));
    return seasonSummary({ stats: cur.stats, stand, games: MB.league.games, played: me.w + me.l + me.t, year: cur.year, seed: lg.seed + ':' + cur.season, playerOf: id => lgPlayer(lg, id), mine, final });
  }

  return {
    MB, capOf, BAT_POS, VAULT_POS, POS_KO, MONTHS, simPos, natural, dispOvr, ovrOf, effR, offPenalty,
    primeOf, cardFromCareer, ensureFillers, vaultCheck, vaultAdd, vaultRemove, cardPlayer, isBatter, isPitcher,
    ageCards, resetLives, retireCard, retireNum, legendLine, farmMove, inFarm, farmOn, futStandings, futRoster, seasonReport, leagueOffseason, hofInduct, cardLimited: limited, hofTotals, aiSeason, mgrGoal, mgrDone, clubInit, playF, MILE, startAgeOf, primeAgeOf, livesLeft, usesOf, cardUsable,
    playGame, createGame, handOf, watchDay, watchPost, playPostGame, postNext, postSkipOthers, myHurt, isHurt, isCloser, nextSp, canReorderRot, autoLineup, myAutoLineup, autoBench, BN_N, clearMyLineup, fillEmpty, hasEmpty, bpN, condOf, tiredDrop, nowDay, benchPitchers, fitsSlot, myLineupFit, checkLineup, makeRosters,
    gameDate, dateTxt, postDate,
    newLeague, signCards, myPool, lgPlayer, playLeagueDay, playLeagueDays, seriesLeft, nextOpp, playLeagueMonth, playLeagueAll, leagueStandings, leaguePostInit, playLeagueSeries, playLeaguePostAll, nextLeagueSeason, monthOf, seriesWins, leaders,
    seasonSummary, leagueSummary, awardsOf, USER_CLUBS,
    _t: { hash, makeRng, standList, addBox, emptyStat },
  };
})();
if (typeof module !== 'undefined') module.exports = Modes;
