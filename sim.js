// 골글 들고 명전으로 — 시뮬레이션 엔진 (UI와 분리, 시드 기반 난수)
// 브라우저(window.Sim)와 Node(module.exports) 양쪽에서 동작한다.
const Sim = (function () {
  'use strict';
  const DATA = (typeof GAME_DATA !== 'undefined') ? GAME_DATA : require('./data.js');

  // ================================================================
  // 밸런스 상수 (패치는 대부분 여기서)
  // ================================================================
  const BAL = {
    // 5.1 성장
    // 기획 초안 0.25/0.15/0.05 → 1차 패치: 18세에 이미 PA에 근접해 전원 슈퍼스타가 돼서 대폭 하향
    ageCoef: [[20, 0.07], [23, 0.05], [28, 0.03], [32, 0.01], [99, 0]],   // 55차: 시작 나이 16→17세에 맞춰 성장 구간을 1살씩 미룸
    hardRetire: 50,
    retireOffer: { drop: 6, gap: 3, war: 1.5 },   // 56차: 은퇴 권유 — 전성기 OVR 대비 하락폭, 팀 최약 선수와의 차이, 직전 시즌 WAR 기준   // 55차: 42세 강제 은퇴 폐지. 끝없이 이어지지 않게 50세에서만 끝낸다
    playCoef: { S: 1.0, B: 0.7, F: 0.5, I: 0.2 },        // 주전 / 백업 / 2군 / 부상
    growthRand: [0.7, 1.3],
    // 2차 패치("자주 대성하게"): 천장이 높은 선수일수록 더 빨리 큰다 → 상위 등급 전성기를 MVP급으로
    tierGrowth: { '역대급': 1.05, '특급': 1.1, '유망': 1.0, '평범': 0.9 },   // 4차: 1.3/1.15 → 1.1/1.1 (20세에 이미 완성형이라 통산이 과다)
    // MVP는 기자 투표: WAR + 타이틀 + 팀 성적 + 화제성 + 표심 흔들림
    // (3차) 아래 값은 예전 WAR 눈금 기준. 투표·화제성 계산 때 WAR를 ÷warScale 해서 쓰므로 확률은 그대로
    mvpVote: { title: 2.0, top1: 1.5, top3: 1.0, popPer: 0.03, popMax: 0.2, noise: 1.1 },   // 5차: 전성기 창이 생겨서 투표 보정은 낮춤
    meFormSD: 5,   // 내 선수 시즌 컨디션 (능력치 ±, 표준편차)
    // 5차: 전성기 창. 등급별로 몇 살부터 몇 년간 능력치 +boost (99 초과 허용 → 시즌 WAR 10~15)
    peak: { '역대급': { len: [2, 4], boost: [21, 26] },   // 41차: 18~23 → 21~26 (역대급 최고 시즌 WAR 중앙값 10.0 → 약 11)
      '특급': { len: [1, 3], boost: [3, 6] }, from: [25, 29], pitMult: 1.65 },   // 52차: 투수 전성기 배율 1.4 → 1.65 (최상위권 투수 상한)
    overCap: 120,
    pitRpwK: 0.927,   // 리그 평균 투수의 동적 승리당 득점(≈9.27) ÷ 예전 고정값 10
    pitScale: 1.25,   // 투수 WAR 눈금 보정 (warScale이 타자 기준이라 투수가 과소평가됐음. ERA 2.00·180이닝 ≈ 7)  // 성적 변환에 쓰는 능력치 상한 (내 선수 전성기만 99를 넘는다)
    popDecay: 0.9, popPerWAR: 2, popPerTitle: 4,
    // 3차 패치: KBO 눈금. 리그 WAR 1위 중앙값 10.4 → 약 7.6, MVP 중앙값 9.8 → 약 7.2
    warScale: 0.73,
    // 이도류: 성장 배율, 반대쪽 잠재력 감소폭, 성공 기준 WAR
    // 6차: 제안은 드물게(반대쪽 평균 45→48 이상, 해마다 확률), 고르면 잘 크게(성장 0.9→1.0, 반대쪽 잠재력 감소 0~18→0~10)
    twoWay: { offerMin: 48, offerP: 0.4, offerTiers: ['역대급', '특급'], main: 1.0, opp: 1.05, oppGap: [0, 8], oppGapLegend: [0, 0], okWAR: 2.0, quitGap: 8, quitWAR: 0.5, batIP: 0.9, spSta: 45, batGS: 0.45 },   // 7차: 타자 출신 이도류 선발 겸업 (체력 45+, 선발 등판 ×0.45 ≈ 13경기)   // okWAR: 타자·투수 각각 (5차: 투수 눈금 보정 + 전성기 창으로 기획서 원안 2.0 복귀)   // batIP: 타자 출신 이도류의 불펜 이닝 배율 (1차 0.6)
    oppGrowthHS: 0.3,                                     // 이도류 아닐 때 반대쪽 능력치 고교 성장 배율
    // 기획 초안 95~99/85~94/70~84/55~69 → 1차 패치: 확률은 유지하고 범위만 낮춤 (유망 = 평균적인 주전)
    paTier: [ // [이름, 확률, 평균PA 최소, 최대]
      // 17차: 유망 잠재력 58~75 → 60~79
      // 19차: 등급 비율 → 15/30/50/5
      // 60차: 등급 비율 → 8/24/58/10
      // 62차: 범위 → 90~99 / 76~95 / 60~80 / 45~60 (등급끼리 조금씩 겹친다)
      ['역대급', 0.08, 90, 99], ['특급', 0.24, 76, 95], ['유망', 0.58, 60, 80], ['평범', 0.10, 45, 60]],
    paSpread: 8,
    // 4차 패치: iron 36→35, long 34→33, 하락 가속 추가 (통산 WAR 상위권이 41세에도 5~8 WAR를 찍던 문제)
    aging: { iron: [35, 1, 2], long: [33, 1, 3], std: [32, 2, 4], early: [30, 3, 5] },
    agingAccel: 0.4,
    agingProb: { iron: 0.10, long: 0.20, std: 0.50, early: 0.20 },
    twoWayLegendP: 0.30,   // 19차: 이도류 중 약 30%가 역대급 체질 (반대쪽 잠재력 차이 없음)
    // 5.7 고교·드래프트
    seniorOVR: { strong: [47, 55], mid: [41, 49], weak: [34, 42] },
    schoolStr: { strong: 0.64, mid: 0.50, weak: 0.38 },
    schoolExpo: { strong: 3, mid: 0, weak: -3 },
    hsPA: { S: 90, P: 30, B: 8 }, hsIP: { S: 50, P: 18, B: 4 },
    scoutW: { ovr: 0.45, perf: 0.20, tourn: 0.10, tool: 0.15, pa: 0.10 },
    draftNoise: 4, draftCut: 46.5,
    // 26차: 지명 순번 구간 [1~3순위, 1라운드, 2~3라운드, 4~7라운드] — 실제 점수 분포(고졸 상위 3%/10%/25%/38%)에 맞춤. 예전 85/75/65/55는 아무도 못 닿았음
    draftBand: [58, 54, 51, 48.5],
releaseNoFirst: 3, starterSegs: 3, devGap: 6,
    // 8차: 아직 주전을 못 잡아 본 선수는 주전 경쟁에서 '증명 전' 불이익 (첫 주전 도달률 조절)
    // 29차: 주전 경쟁 지수(valAt) = a + b × 기대 WAR. 리그 선수들의 오버롤과 평균·표준편차가 같도록 맞춘 값
    // 31차: 구단 주도 트레이드 (주전을 못 잡은 선수). firstSeasons 시즌 뒤 firstP 확률, weakSeasons 시즌 뒤에는 약팀(하위 weakN개 구단)으로
    // 32차: 빈도 줄임 — 2년차 70%→25%, 3년차 약팀 트레이드도 30% 확률
    clubTrade: { firstSeasons: 2, firstP: 0.25, weakSeasons: 3, weakP: 0.3, weakN: 3 },
    // 35차: 투수 WAR 가중치 (타자 1 기준). 투수 WAR가 타자보다 쉽게 쌓여서 연봉·해외 제안·국가대표 선발·커리어 점수에서 2/3로 친다
    pitWarW: 1.2,  // 36차: 0.67 → 1.2 (투수는 귀하다 — 타자 주전 경쟁을 고쳐 투타 WAR를 맞춘 뒤 투수 우대)
    benchPA: 70,   // 36차: 1군 벤치 타자(나)의 구간당 타석 (대타·대수비·플래툰)
    spRotBar: 4, rpClBar: 3,   // 37차: 내 선발의 로테이션 경쟁·내 불펜의 마무리 경쟁 문턱 (지수 점수). 38차: 8/5 → 4/3 (구단에 6·7선발 후보가 생겨 실제 경쟁이 늘었음)
    useVal: true,
    valFit: { B: [47.01, 3.517], SP: [44.69, 4.591], RP: [42.28, 13.274] },   // 리그 5,400명 기준, 오버롤과 상관 0.93/0.91/0.87
    unprovenBias: 5,  // 38차: 10 → 5 (후보 타자가 늘어 경쟁이 세진 만큼 되돌림). 36차: 15 → 10 (타자 주전 도달이 투수보다 너무 어려웠음). 22차: 11→13, SP 4→6, 드래프트 기준선 45→46.5, 육성 테스트 기본 0.22→0.15, MVP 명성 0.4→0.2, MLB 벌점 9→7, NPB 4→3
    unprovenBiasSP: 3,   // 38차: 6 → 3. 16차: 선발 투수는 '증명 전' 감점을 작게 (선발 5명과 실제로 경쟁하게 된 뒤 너무 불리했음)
    // 9차: 훈련 방향 (선수 생성 때 두 능력치 선택). untilAge 미만 시즌까지 적용
    trainFocus: { untilAge: 22, focus: 1.6, other: 0.85 },
    // 14차: 커리어 중 육성 방향(강점) 변경 — times번, 고른 두 능력치 잠재 +paUp, 기존 강점 둘 잠재 −paDown, 이후 seasons시즌 성장 가중
    focusChange: { times: 2, paUp: 5, paDown: 4, seasons: 3 },
    // 10차: 해외 진출 (KBO 1군 연차 svc 이상, 나이 maxAge 이하, 최근 가중 WAR war 이상, OVR 기준)
    // 12차: 병역·국제대회. deadline 나이 겨울에 미필이면 입영. sangmuOVR 이상이면 상무 가능. 복무 years 시즌
    mil: { deadline: 28, sangmuOVR: 52, years: 2, earlyP: 0.3, earlyAge: [21, 26] },
    intl: [
      // 14차: 선발 기준 완화. OVR+WAR 기준을 넘거나, OVR이 모자라도 시즌 WAR이 warOnly 이상이면 선발
      { id: 'AG', name: '아시안게임', from: 2030, every: 4, ovr: 53, war: 1.2, warOnly: 2.5, maxAge: 25, wildOVR: 57, win: 0.8, exempt: true, medal: '금메달' },
      // 61차: 올림픽 4년마다(예전 8년), WBC 3년마다 → 한 해에 대회가 겹칠 수 있다 (예: 2032 올림픽+WBC, 2038 아시안게임+WBC)
      { id: 'OLY', name: '올림픽', from: 2028, every: 4, ovr: 56, war: 2, warOnly: 3.5, win: 0.5, exempt: true, medal: '동메달 이상' },
      { id: 'P12', name: '프리미어12', from: 2027, every: 4, ovr: 57, war: 2.2, warOnly: 3.8, win: 0.3, exempt: false, medal: '우승' },
      { id: 'WBC', name: 'WBC', from: 2029, every: 3, ovr: 59, war: 2.8, warOnly: 4.2, win: 0.15, exempt: false, medal: '우승' },
    ],
    // 23차: 명예의 전당 헌액 기준 (하나라도 달성). peakOVR은 화면 표시 눈금
    // 62차: 헌액 난이도 상향 — 아래 기준 중 need개 이상을 채워야 헌액. 기준 추가(골든글러브·개인 타이틀·시리즈 MVP·올해의 투수상·국제대회 우승·시즌 WAR·통산 OPS/ERA·도루·메이저리그 시즌)
    hof: { need: 2, war: 62, mvp: 2, titles: 4, titlesWar: 40, peakOVR: 95, peakWar: 45, hits: 2500, hr: 420, wins: 190, saves: 350, ks: 2600, twoWay: 3,
      gg: 6, title: 6, smvp: 2, poy: 2, intlGold: 2, seasonWar: 9, ops: [5000, 0.900], era: [4500, 3.00], sb: 400, mlb: 8 },
    // 11차: 마무리 지정 선수의 마무리 자리 우선 보정, 보직 전환 제안 확률
    // 43차: 보직 제안 확대 — toSP 0.35→0.5, toCL 0.4→0.5. spN 선발↔불펜 제안 횟수(1~2→2~3), gap 간격(3→2년), spSta 체력(50→45), spGap 5선발 대비 여유(1→3)
    //       마무리 제안은 따로: clGap 2년, clEra 리그 ERA보다 이만큼 좋으면(0.8→0.5), clVal 팀 최고 불펜 지수와 이만큼 차이 안이면
    // 52차: 커리어 점수. ach = 업적 기본 점수(우승·메달은 대회 순서대로), lgW = 리그 가중치(WAR·개인 수상), achK = 업적 전체 배율
    eliteScout: 1.5, regionPick: [0.5, 0.3],   // 52차: 지역 명문고 스카우트 보너스, 연고 구단 우선 지명 확률 [1라운드감, 2~3라운드감]
    score: {
      lgW: { KBO: 1, NPB: 1.25, MLB: 1.5 },
      ach: { WS: 150, WC: 120, OLY_G: 100, OLY_S: 75, OLY_B: 55, JS: 50, AG: 45, KS: 40,
        MVP: 100, POY: 35, SMVP: 30, GG: 30, TITLE: 20, ROY: 20, MS1: 30, MS2: 80, TW: 60 },
      // 역대급 타자·투수 각 100판에서 최상위권 WAR:업적 ≈ 60:40 이 되도록 맞춘 배율 (POY는 투수가 상위권을 독식하지 않게 35)
      achK: 0.48,
    },
    relief: { clHLD: 0.04, suSV: 0.03, mrSV: 0.005, mrHLD: 0.1, lrHLD: 0.05 },   // 43차: 보직별 세이브·홀드 섞임 (팀 승수 × 구간 비율 × 계수)
    closerBias: 8, roleOffer: { toSP: 0.5, toRP: 0.45, toCL: 0.5, spN: [2, 3], gap: 2, spSta: 45, spGap: 3, clGap: 2, clEra: 0.5, clVal: 2 },
    // 13차: 포스팅(svc 이상·병역 해결이면 언제든 신청), 해외 FA(faSvc 이상), 고교 미국 직행(usDirect)
    // 21차: 응찰 기준은 '평가값'(현재 OVR 60% + 잠재력 40%, 내부값)으로. mlbEval/npbEval, 가중 WAR mlbWar/npbWar (내부 눈금)
    abroad: { svc: 7, faSvc: 9, maxAge: 33, war: 3, npbOVR: 62, mlbOVR: 63, mlbWar: 3, mlbEval: 68, npbEval: 65, npbWar: 2.5,
      // 30차: [현재 OVR, 기대 WAR 지수, 잠재력 OVR, 보정] — 보정은 예전 평가와 같은 눈금이 되도록 맞춘 값
      evalW: [0.35, 0.35, 0.3, 2.7] },
    usDirect: { ovr: 50, scout: 58,tiers: ['역대급', '특급'] },
    // 10차: 늦깎이 각성 — age 범위에서 OVR이 maxOVR 이하이면 매년 p 확률로 잠재·능력치가 크게 뛴다 (한 번)
    bloom: { age: [22, 27], maxOVR: 56, p: 0.008, pa: [10, 16], now: [5, 9] },
    // 10차: 대학 시절 OVR이 이 이상이면 매년 p 확률로 육성선수 제안
    univDev: { ovr: 52, p: 0.2 },    univScout: -1,   // 대졸 스카우트 보정. 1차 -5 → 2차 +3 (즉시 전력 프리미엄, 4년을 쓴 것 자체가 대가)
    // 5.8 출전
    injSeg: { B: 0.035, P: 0.045 },
    otherInj: 0.10,
    // 5.9 돈 (만원)
    // 27차: 연봉 인상 — 시장가치 1억+2억/WAR → 1.5억+2.8억/WAR, 비FA 연봉은 시장가치에 더 빨리 붙게(arbRate), FA는 계약금(총액의 faBonus) 별도
    minSal: 3000, valBase: 15000, valPerWAR: 28000, arbRate: 0.45, arbWinRate: 0.65, faBonus: [0.3, 0.45],
    // 리그
    teamNoise: 0.03, adjDecay: 0.5,
    rookieBase: [41, 48], rookieStarP: 0.05,
    starterBase: 50.5, benchBase: 43,
    spCandBase: 45, rpExtraBase: 47, benchTopN: 4, benchLowPA: 25,   // 38차: 6·7선발 후보·추가 불펜 기본 능력, 출전 많은 후보 타자 수·나머지 후보의 구간당 타석
  };

  // ================================================================
  // 난수
  // ================================================================
  let R = null;
  function makeRng(o) {
    const f = function () {
      let t = (o.s = (o.s + 0x6D2B79F5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.int = (a, b) => a + Math.floor(f() * (b - a + 1));
    f.range = (a, b) => a + f() * (b - a);
    f.chance = p => f() < p;
    f.pick = a => a[Math.floor(f() * a.length)];
    f.tri = () => (f() + f() + f() - 1.5) / 1.5;
    f.gauss = () => { let u = 0; while (u === 0) u = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * f()); };
    f.weighted = (items, w) => { let tot = 0; for (const it of items) tot += w(it); let x = f() * tot; for (const it of items) { x -= w(it); if (x <= 0) return it; } return items[items.length - 1]; };
    return f;
  }
  function bind(st) { R = makeRng(st.rng); }

  // ================================================================
  // 능력치 → 성적 변환 (5.6)
  // ================================================================
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const BAT = ['con', 'pow', 'eye', 'spd', 'def', 'arm'];
  const PIT = ['vel', 'ctl', 'stf', 'brk', 'sta', 'men'];
  const ALL = BAT.concat(PIT);
  const LABEL = { con: '컨택', pow: '파워', eye: '선구안', spd: '주루', def: '수비', arm: '어깨', vel: '구속', ctl: '제구', stf: '구위', brk: '변화구', sta: '체력', men: '멘탈' };
  const POSNAME = { C: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: '유격수', OF: '외야수', CF: '중견수', LF: '좌익수', RF: '우익수', DH: '지명타자', SP: '선발투수', RP: '불펜투수' };
  // 62차: 외야는 중견수·좌익수·우익수로 부른다. 계산·기록은 모두 예전 외야수(OF) 그대로 — 이름표만 다르다
  const OF_POS = ['CF', 'LF', 'RF'];
  function posName(me) { return me.pos === 'OF' && me.ofPos ? POSNAME[me.ofPos] : POSNAME[me.pos]; }
  const X = [20, 50, 80, 99];
  // 99를 넘는 값(내 역대급 선수의 전성기·컨디션)은 80~99 구간 기울기 그대로 연장. 다른 선수는 99가 상한이라 영향 없음
  function L(v, ys) {
    v = clamp(v, 20, BAL.overCap);
    for (let i = 0; i < 3; i++) if (v <= X[i + 1]) return ys[i] + (ys[i + 1] - ys[i]) * (v - X[i]) / (X[i + 1] - X[i]);
    return ys[3] + (ys[3] - ys[2]) * (v - 99) / 19;
  }
  const T = {
    kB: [.33, .186, .10, .06], babip: [.280, .327, .370, .400], bb: [.04, .096, .145, .19], hr: [.002, .025, .06, .09], xbh: [.12, .21, .30, .36],
    sbA: [0, 6, 40, 70], sbS: [.60, .70, .85, .92], babSpd: [-.010, 0, .015, .025], defR: [-16, 0, 12, 20], armR: [-6, 0, 5, 9],
    kP: [.12, .203, .30, .37], bbP: [.14, .081, .04, .025], hrP: [.038, .022, .011, .006], babP: [.355, .300, .260, .240], ipS: [4.0, 5.4, 6.5, 7.2],
    men: [1.10, 1.00, 0.95, 0.92], velo: [130, 143, 151, 157],
  };
  const W = {
    C: { con: 15, pow: 15, eye: 10, spd: 5, def: 30, arm: 25 }, '1B': { con: 25, pow: 35, eye: 20, spd: 5, def: 10, arm: 5 },
    '2B': { con: 25, pow: 10, eye: 15, spd: 15, def: 30, arm: 5 }, SS: { con: 20, pow: 10, eye: 10, spd: 15, def: 30, arm: 15 },
    '3B': { con: 20, pow: 25, eye: 10, spd: 5, def: 20, arm: 20 }, OF: { con: 25, pow: 25, eye: 15, spd: 15, def: 10, arm: 10 },
    DH: { con: 35, pow: 40, eye: 25 },
    SP: { vel: 20, ctl: 20, stf: 15, brk: 20, sta: 20, men: 5 }, RP: { vel: 30, ctl: 15, stf: 20, brk: 20, sta: 5, men: 10 },
  };
  const POSADJ = { C: 10, SS: 7, '2B': 3, '3B': 2, OF: -4, '1B': -10, DH: -15 };
  const GROUP = { C: 'C', '1B': 'IF', '2B': 'IF', '3B': 'IF', SS: 'IF', OF: 'OF', DH: 'DH', SP: 'P', RP: 'P' };
  function ovrAt(r, pos) { const w = W[pos]; let s = 0, t = 0; for (const k in w) { s += r[k] * w[k]; t += w[k]; } return s / t; }

  function batRates(r, bonus) {
    bonus = bonus || 0;
    const g = k => clamp(r[k] + bonus, 20, BAL.overCap);
    const spd = g('spd');
    return {
      bb: Math.min(.26, L(g('eye'), T.bb)), k: Math.max(.035, L(g('con'), T.kB)), hr: Math.min(.13, L(g('pow'), T.hr)),
      babip: Math.min(.43, L(g('con'), T.babip) + L(spd, T.babSpd)),
      xbh: Math.min(.42, L(g('pow'), T.xbh)), t3: 0.08 * (0.4 + Math.min(99, spd) / 83), sbA: L(spd, T.sbA), sbS: Math.min(.95, L(spd, T.sbS)),
    };
  }
  function pitRates(r, bonus) {
    bonus = bonus || 0;
    const g = k => clamp(r[k] + bonus, 20, BAL.overCap);
    return {
      k: Math.min(.45, L(0.6 * g('vel') + 0.4 * g('brk'), T.kP)), bb: Math.max(.012, L(g('ctl'), T.bbP)), hr: Math.max(.002, L(0.7 * g('stf') + 0.3 * g('ctl'), T.hrP)),
      babip: Math.max(.215, L(g('stf'), T.babP)), ipS: Math.min(8.2, L(g('sta'), T.ipS)), men: Math.max(.88, L(g('men'), T.men)),
    };
  }
  // 18차: 최고 구속은 화면 표시 구속 능력치 기준 (표시 100 = 163km/h, 73 ≈ 150km/h)
  const VELO_PTS = [[20, 130], [50, 141], [70, 149], [85, 155], [100, 163]];
  function velo(v) {
    const d = clamp(40 + (v - 30) * 1.25, 20, 100);   // disp()와 같은 눈금 (반올림 전)
    for (let i = 1; i < VELO_PTS.length; i++) { const [x0, y0] = VELO_PTS[i - 1], [x1, y1] = VELO_PTS[i]; if (d <= x1) return Math.round(y0 + (y1 - y0) * (d - x0) / (x1 - x0)); }
    return 163;
  }

  function baseRuns(H, TB, HR, BB, outs) {
    const A = H + BB - HR, B = (1.4 * TB - 0.6 * H - 3 * HR + 0.1 * BB) * 1.02;
    return (B + outs > 0 ? A * B / (B + outs) : 0) + HR;
  }
  // 리그 평균 투수가 평균자책점 4.18이 되도록 보정
  const ERA_SCALE = (function () {
    const bb = .081, k = .203, hr = .022, bip = 1 - bb - k - hr, hn = bip * .300, xb = hn * .21, t3 = xb * .08, d2 = xb - t3, s1 = hn - xb;
    const H = hn + hr, TB = s1 + 2 * d2 + 3 * t3 + 4 * hr, outs = 1 - bb - H;
    return 4.18 / (baseRuns(H, TB, hr, bb, outs) / outs * 27);
  })();

  // ---------- 성적 라인 ----------
  function emptyBat() { return { G: 0, PA: 0, AB: 0, H: 0, D: 0, T: 0, HR: 0, BB: 0, K: 0, SB: 0, CS: 0, R: 0, RBI: 0 }; }
  function emptyPit() { return { G: 0, GS: 0, outs: 0, BF: 0, H: 0, HR: 0, BB: 0, K: 0, ER: 0, W: 0, L: 0, SV: 0, HLD: 0 }; }
  function addLine(a, b) { for (const k in b) if (typeof b[k] === 'number') a[k] = (a[k] || 0) + b[k]; return a; }
  function AVG(s) { return s.AB ? s.H / s.AB : 0; }
  function OBP(s) { return s.PA ? (s.H + s.BB) / s.PA : 0; }
  function SLG(s) { return s.AB ? (s.H + s.D + 2 * s.T + 3 * s.HR) / s.AB : 0; }
  function OPS(s) { return OBP(s) + SLG(s); }
  function ERA(s) { return s.outs ? s.ER * 27 / s.outs : 0; }
  function IP(s) { return s.outs / 3; }
  // 62차: 이닝 표기는 실제 야구처럼 (6과 1/3이닝 → 6.1, 2/3 → 6.2)
  function ipTxt(s) { const o = Math.round(s && s.outs || 0); return Math.floor(o / 3) + (o % 3 ? '.' + (o % 3) : ''); }

  function finishBat(s, p, sbForm, rm, bm) {
    s.AB = s.PA - s.BB;
    const ob = OBP(s) / 0.348;
    const att = p.sbA * s.PA / 600 * (sbForm || 1) * ob;
    const a = Math.round(att * R.range(0.8, 1.2));
    s.SB = 0; for (let i = 0; i < a; i++) if (R() < p.sbS) s.SB++;
    s.CS = a - s.SB;
    const TB = s.H + s.D + 2 * s.T + 3 * s.HR;
    s.R = Math.round(((s.H + s.BB - s.HR) * 0.32 + s.SB * 0.15) * (rm || 1) + s.HR);
    s.RBI = Math.round((TB * 0.22 + s.HR * 0.55 + s.BB * 0.03) * (bm || 1));
    s.G = Math.min(Math.round(144 * GF), Math.max(s.G || 0, Math.round(s.PA / 4.1)));   // 41차: 리그 경기 수 기준
    return s;
  }
  // 내 선수: 타석 단위 시뮬레이션
  function simBat(p, n, hitMult) {
    const s = emptyBat(); const hm = hitMult || 1;
    const bb = p.bb * hm, babip = p.babip * hm;
    for (let i = 0; i < n; i++) {
      s.PA++;
      let u = R();
      if (u < bb) { s.BB++; continue; } u -= bb;
      if (u < p.k) { s.K++; continue; } u -= p.k;
      if (u < p.hr) { s.HR++; s.H++; continue; }
      if (R() < babip) { s.H++; if (R() < p.xbh) { if (R() < p.t3) s.T++; else s.D++; } }
    }
    return s;
  }
  function simPitch(p, outsTarget, mult) {
    const s = emptyPit(); const m = mult || 1;
    const bb = p.bb * m, babip = p.babip * m;
    let s1 = 0, d2 = 0, t3 = 0, guard = 0;
    while (s.outs < outsTarget && guard++ < 5000) {
      s.BF++;
      let u = R();
      if (u < bb) { s.BB++; continue; } u -= bb;
      if (u < p.k) { s.K++; s.outs++; continue; } u -= p.k;
      if (u < p.hr) { s.HR++; s.H++; continue; }
      if (R() < babip) { s.H++; if (R() < 0.21) { if (R() < 0.08) t3++; else d2++; } else s1++; } else s.outs++;
    }
    const TB = s1 + 2 * d2 + 3 * t3 + 4 * s.HR;
    s.ER = Math.max(0, Math.round(baseRuns(s.H, TB, s.HR, s.BB, s.outs) * ERA_SCALE * (1 + R.tri() * 0.08)));
    return s;
  }
  // 다른 선수: 기대값 + 오차
  function batExp(p, PA, f, rm, bm) {
    const s = emptyBat(); s.PA = Math.round(PA);
    const bb = PA * p.bb * f.bb, k = PA * p.k / f.h, hr = PA * p.hr * f.hr;
    const bip = Math.max(0, PA - bb - k - hr), hn = bip * Math.min(0.45, p.babip * f.h), xb = hn * p.xbh, t3 = xb * p.t3;
    s.BB = Math.round(bb); s.K = Math.round(k); s.HR = Math.round(hr); s.H = Math.round(hn + hr); s.T = Math.round(t3); s.D = Math.round(xb - t3);
    return finishBat(s, p, f.sb, rm, bm);
  }
  function pitExp(p, outs, f) {
    const s = emptyPit();
    const bb = p.bb * f.bb, k = p.k * f.k, hr = p.hr * f.hr, bip = Math.max(0, 1 - bb - k - hr), hn = bip * p.babip * f.h;
    const H = hn + hr, opb = Math.max(0.4, 1 - bb - H), BF = outs / opb;
    const xb = hn * .21, t3 = xb * .08, d2 = xb - t3, s1 = hn - xb, TB = s1 + 2 * d2 + 3 * t3 + 4 * hr;
    s.outs = Math.round(outs); s.BF = Math.round(BF); s.H = Math.round(H * BF); s.HR = Math.round(hr * BF); s.BB = Math.round(bb * BF); s.K = Math.round(k * BF);
    s.ER = Math.round(baseRuns(H, TB, hr, bb, opb) * BF * ERA_SCALE);
    return s;
  }
  // 표시·기록용 WAR = 엔진 내부 승리 기여 × warScale. 팀 순위 계산은 내부 값(÷warScale)을 쓴다.
  const WS = x => x * BAL.warScale;          // "예전 눈금 x" 기준 문턱값을 새 눈금으로
  function batWAR(s, r, pos, lgOPS) { return batWARraw(s, r, pos, lgOPS) * BAL.warScale; }
  const DEFMUL = { C: 1.15, SS: 1.2, '2B': 1.05, '3B': 0.95, OF: 0.9, '1B': 0.5, DH: 0 };
  const ARMMUL = { C: 1.3, SS: 1.0, '3B': 0.9, OF: 1.0, '2B': 0.4, '1B': 0, DH: 0 };
  // 600타석 기준 수비 기여 득점 (평균 수비 50 = 0)
  function defRuns(r, pos) { return L(r.def, T.defR) * (DEFMUL[pos] || 0) + L(r.arm, T.armR) * (ARMMUL[pos] || 0); }
  // 수비 기록: 수비 기회·실책·수비율 (기대값 + 약간의 흔들림)
  const DEFCH = { C: 7.2, '1B': 8.8, '2B': 4.9, '3B': 2.8, SS: 4.4, OF: 2.1 };
  // 61차: 실책은 수비 능력(+송구가 많은 포지션은 어깨)에 크게 좌우 — 수비 50 기준 실책률 ERRBASE, 잘할수록 지수로 줄어든다
  //       수비 기여도 = 능력 기반 기여 − (실제 실책 − 기대 실책) × 0.7점  → 실책이 많으면 그해 기여도도 깎인다
  const ERRBASE = { C: .008, '1B': .005, '2B': .017, '3B': .044, SS: .032, OF: .015 };
  const ARMERR = { C: 0.6, '1B': 0.1, '2B': 0.3, '3B': 0.8, SS: 0.7, OF: 0.4 };
  function defLine(r, pos, G, rnd) {
    if (!DEFCH[pos] || !G) return null;
    const ch = Math.round(DEFCH[pos] * G);
    const skill = (r.def - 50) * 0.02 + (r.arm - 50) * 0.01 * ARMERR[pos];
    const expRate = clamp(ERRBASE[pos] * Math.exp(-skill), 0.001, 0.12);
    const rate = expRate * (rnd ? Math.exp((rnd() - 0.5) * 0.5) : 1);
    const E = Math.max(0, Math.round(ch * rate));
    return { CH: ch, E, DEF: Math.round((defRuns(r, pos) * G / 140 - (E - ch * expRate) * 0.7) * 10) / 10 };
  }
  function batWARraw(s, r, pos, lgOPS) {
    if (!s || !s.PA) return 0;
    const frac = s.PA / 600;
    let runs = (OPS(s) - lgOPS) * s.PA * 0.4;
    // 14차: 수비 가치는 포지션 난이도에 비례 (유격·포수 크게, 1루 작게). 어깨는 3루도 반영
    if (pos !== 'DH') runs += defRuns(r, pos) * frac;
    runs += s.SB * 0.2 - s.CS * 0.4 + (POSADJ[pos] || 0) * frac + 20 * frac;
    return runs / 10;
  }
  // 5차: 투수 승리당 득점을 동적으로 (FanGraphs 방식). 실점을 적게 주는 에이스일수록 1점의 가치가 커진다.
  // 평균 투수는 예전(÷10)과 같은 값이 나오도록 pitRpwK로 맞춤
  function pitWAR(s, lgERA) {
    if (!s || !s.outs) return 0;
    const ip = IP(s), era = ERA(s), ipg = s.GS ? Math.min(9, ip / s.GS) : 1;
    const rpw = (((18 - ipg) * lgERA + ipg * era) / 18 + 2) * 1.5;
    return (lgERA + 1.0 - era) * ip / 9 / rpw * BAL.pitRpwK * BAL.warScale * BAL.pitScale;
  }
  // 팀 순위용 내부 승리 기여 (표시 WAR에서 눈금 보정을 걷어낸 값)
  function winsOfLine(war, isPit) { return war / BAL.warScale / (isPit ? BAL.pitScale : 1); }

  // ================================================================
  // 리그 생성
  // ================================================================
  const TPL = {
    C: { def: 8, arm: 8, spd: -8, con: -3 }, '1B': { pow: 8, def: -6, spd: -8 }, '2B': { def: 5, spd: 4, pow: -8 },
    SS: { def: 8, arm: 6, spd: 4, pow: -8 }, '3B': { pow: 3, arm: 5 }, OF: { spd: 3 }, DH: { pow: 8, def: -15, spd: -8 },
    SP: { sta: 8 }, RP: { vel: 5, sta: -15 },
  };
  function genName(foreign, nat) {
    if (nat === 'jp' && !foreign) return R.pick(DATA.jpSurnames) + ' ' + R.pick(DATA.jpGiven);
    if (nat === 'us') return R.pick(DATA.usFirst) + ' ' + R.pick(DATA.foreign);
    return foreign ? R.pick(DATA.foreign) : R.pick(DATA.surnames) + R.pick(DATA.given1) + R.pick(DATA.given2);
  }
  // ---------- 10차: 리그 설정 ----------
  // level: 이 리그에서 내 선수 능력치에 붙는 벌점(리그 수준 차이). bonus: 성적 계산 보정(대학·2군처럼 수준 낮은 리그)
  const LCFG = {
    KBO: { id: 'KBO', name: 'KBO 리그', short: 'KBO', games: 144, ps: 'kbo', level: 0, salMul: 1, champ: '한국시리즈', minor: '2군', nat: 'kr' },
    NPB: { id: 'NPB', name: '일본 프로야구', short: 'NPB', games: 143, ps: 'npb', level: 3, salMul: 2.2, champ: '재팬시리즈', minor: '2군', nat: 'jp', two: ['센트럴', '퍼시픽'], base: 2 },
    MLB: { id: 'MLB', name: '메이저리그', short: 'MLB', games: 162, ps: 'mlb', level: 7, salMul: 7, champ: '월드시리즈', minor: '마이너리그', nat: 'us', two: ['아메리칸리그', '내셔널리그'], base: 2 },
    FUT: { id: 'FUT', name: '퓨처스리그', short: '퓨처스', games: 116, ps: 'none', bonus: 7, lite: true, nat: 'kr', base: -7, young: true },
    UNIV: { id: 'UNIV', name: '대학리그', short: '대학', games: 30, ps: 'none', bonus: 8, lite: true, nat: 'kr', base: -13, grad: 23, young: true },
  };
  const cfgOf = L => LCFG[(L && L.cid) || 'KBO'];
  let GF = 1;   // 현재 시뮬 중인 리그의 경기 수 / 144
  function genOther(st, teamId, pos, o, Lg) {
    const L = Lg || st.lg;
    const role = (pos === 'SP' || pos === 'RP') ? 'P' : 'B';
    const keys = role === 'B' ? BAT : PIT;
    const tpl = TPL[pos] || {};
    const star = R.chance(o.starP == null ? 0.08 : o.starP) ? 12 : 0;
    const r = {};
    for (const k of ALL) r[k] = 20;
    for (const k of keys) r[k] = Math.round(clamp(o.base + star + (tpl[k] || 0) + R.gauss() * 9, 22, 96));
    const gname = genName(o.foreign, o.nat || (cfgOf(L) || {}).nat);
    const p = { id: L.nextId++, name: o.name || gname, real: !!o.name, team: teamId, pos, role, age: o.age, r, foreign: !!o.foreign, debut: o.rookie ? st.year : -99, last: null, lastWAR: 0, star: !!star };
    L.p[p.id] = p;
    return p;
  }
  // 다른 리그(일본·미국·퓨처스·대학) 생성: KBO와 같은 28명 구성 (38차: 21 → 28)
  function makeOtherLeague(st, cid) {
    const cfg = LCFG[cid];
    const defs = cid === 'NPB' ? DATA.npbTeams : cid === 'MLB' ? DATA.mlbTeams : cid === 'UNIV' ? DATA.univTeams
      : DATA.teams.map(t => ({ id: 'F_' + t.id, name: t.name + ' 2군', color: t.color })).concat([{ id: 'F_SM', name: '상무', color: '#2d5a27' }]);
    const L = { cid, teams: [], p: {}, nextId: 1, lastStand: null, lgOPS: 0.775, lgERA: 4.18 };
    for (const td of defs) {
      const t = { id: td.id, name: td.name, color: td.color, sub: td.sub || null, act: [], adj: 0 };
      const tb = R.gauss() * 2.5 + (td.id === 'F_SM' ? 4 : 0);
      let spN = 0;
      const fHit = R.pick([1, 3, 5, 6, 8]);
      ROSTER.forEach(([pos, kind], i) => {
        let base = slotBase(kind, pos) + (cfg.base || 0) + tb;
        let foreign = false;
        if (cid === 'NPB') { if (kind === 's' && i === fHit) { foreign = true; base += 4; } if (pos === 'SP' && ++spN <= 1) { foreign = true; base += 5; } }
        const age = cfg.id === 'UNIV' ? R.int(19, 22) : cfg.young ? Math.round(clamp(23 + R.gauss() * 3, 19, 33)) : Math.round(clamp(28 + R.gauss() * 4, 21, 38));
        t.act.push(genOther(st, t.id, pos, { base, foreign, age, nat: foreign ? 'us' : cfg.nat, starP: cfg.lite ? 0.03 : 0.08 }, L).id);
      });
      L.teams.push(t);
    }
    return L;
  }
  function ensureLeagues(st) {
    if (!st.lg.cid) st.lg.cid = 'KBO';
    if (st.me && st.me.milDone == null) st.me.milDone = true;   // 병역 기능 이전 저장 게임은 해결된 것으로
    if (st.car && st.car.achPts == null) st.car.achPts = legacyAch(st);   // 52차 이전 저장: 지금까지의 업적 점수
    if (st.me && st.me.pos === 'OF' && !st.me.ofPos) st.me.ofPos = st.me.flags && st.me.flags.cornerOF ? 'LF' : 'CF';   // 62차 이전 저장: 외야수 → 중견수(코너 전향은 좌익수)
    st.L = st.L || {};
    for (const cid of ['FUT', 'UNIV', 'NPB', 'MLB']) if (!st.L[cid] && st.lg.cid !== cid) st.L[cid] = makeOtherLeague(st, cid);
    for (const L of [st.lg, st.home].concat(Object.values(st.L))) if (L) padRosters(st, L, cfgOf(L));
  }
  // 경기 기록용 무거운 필드 정리 (저장 용량)
  function stripLeague(L) { for (const id in L.p) { const p = L.p[id]; delete p.acc; delete p.form; delete p.season; delete p.last; delete p.injSeg; roundR(p); } }
  // 저장 용량: 능력치는 소수 한 자리, 기록은 정수로
  function roundR(p) { for (const k in p.r) p.r[k] = Math.round(p.r[k] * 10) / 10; if (p.lastWAR != null) p.lastWAR = Math.round(p.lastWAR * 100) / 100; }
  function roundTeamStats(ts) { for (const id in ts) for (const x of ts[id]) { roundLine(x.bat); roundLine(x.pit); if (x.war != null) x.war = Math.round(x.war * 10) / 10; } }
  function roundLine(s) { if (!s) return s; for (const k in s) if (typeof s[k] === 'number' && k !== 'war') s[k] = Math.round(s[k]); return s; }
  function findTeam(st, id) {
    for (const L of [st.lg, st.home].concat(Object.values(st.L || {}))) { if (!L) continue; const t = L.teams.find(x => x.id === id); if (t) return t; }
    return null;
  }
  const ROSTER = [['C', 's'], ['1B', 's'], ['2B', 's'], ['3B', 's'], ['SS', 's'], ['OF', 's'], ['OF', 's'], ['OF', 's'], ['DH', 's'],
    ['C', 'b'], ['2B', 'b'], ['SS', 'b'], ['OF', 'b'], ['SP', 'p'], ['SP', 'p'], ['SP', 'p'], ['SP', 'p'], ['SP', 'p'], ['RP', 'p'], ['RP', 'p'], ['RP', 'p'],
    // 38차: 후보 타자 3명(kind 'b'), 6·7선발 후보 2명(kind 'x'), 불펜 2명(kind 'r') 추가 → 28명. 뒤에 붙여야 앞쪽 슬롯 번호(외국인 자리 등)가 그대로다
    ['1B', 'b'], ['3B', 'b'], ['OF', 'b'], ['SP', 'x'], ['SP', 'x'], ['RP', 'r'], ['RP', 'r']];
  const ROSTER_OLD = 21;
  // 38차: 추가 슬롯 기본 능력 (선발 후보·추가 불펜은 기존 투수보다 조금 낮게)
  function slotBase(kind, pos) { return kind === 's' ? BAL.starterBase : kind === 'b' ? BAL.benchBase : kind === 'x' ? BAL.spCandBase : kind === 'r' ? BAL.rpExtraBase : pos === 'SP' ? 47.5 : 50; }
  // 38차: 예전 저장(21명 구단)에 추가 슬롯을 채운다
  function padRosters(st, L, cfg) {
    if (!L || !L.teams) return;
    for (const t of L.teams) {
      if (t.act.length !== ROSTER_OLD) continue;
      for (let i = ROSTER_OLD; i < ROSTER.length; i++) {
        const [pos, kind] = ROSTER[i];
        const base = slotBase(kind, pos) + ((cfg && cfg.base) || 0) + R.gauss() * 1.5;
        const age = cfg && cfg.id === 'UNIV' ? R.int(19, 22) : Math.round(clamp(27 + R.gauss() * 4, 20, 37));
        t.act.push(genOther(st, t.id, pos, { base, age, nat: cfg && cfg.nat, starP: 0.03 }, L === st.lg ? undefined : L).id);
      }
    }
  }
  function makeLeague(st) {
    st.lg = { teams: [], p: {}, nextId: 1, lastStand: null, lgOPS: 0.775, lgERA: 4.18 };
    for (const td of DATA.teams) {
      const t = { id: td.id, name: td.name, color: td.color, act: [], adj: 0, win2026: td.win };
      const sB = (td.bat - 100) * 0.8, sP = (td.pit - 100) * 0.5;
      // 실제 선수 명단: 슬롯 포지션에 맞는 선수를 순서대로 배치 (명단 앞쪽 = 주전 슬롯 우선)
      const real = (DATA.realRosters && DATA.realRosters[td.id] || []).map(s => { const [name, pos, by, star] = s.split(' '); return { name, pos, age: st.year - +by, star: star === 'S' }; }).filter(x => x.age <= 41);
      // 외국인 타자 자리는 간판(S) 국내 타자의 포지션을 피한다
      const fOpts = [1, 3, 5, 6, 8];
      const fPick = R.pick(fOpts);
      const fFree = fOpts.filter(i => !real.some(x => x.star && x.pos === ROSTER[i][0]));
      const fHit = fFree.indexOf(fPick) >= 0 || !fFree.length ? fPick : fFree[fOpts.indexOf(fPick) % fFree.length];
      let spCount = 0;
      const ACCEPT = { DH: ['DH', '1B', 'OF'], '2B': ['2B', '3B', '1B'], SS: ['SS', '2B', '3B'] };
      const takeReal = (pos, kind) => {
        const acc = kind === 'b' || pos === 'DH' ? (ACCEPT[pos] || [pos]) : [pos];
        for (const want of acc) { const i = real.findIndex(x => x.pos === want); if (i >= 0) return real.splice(i, 1)[0]; }
        return null;
      };
      ROSTER.forEach(([pos, kind], i) => {
        let base, foreign = false;
        if (kind === 's') { base = BAL.starterBase + sB; if (i === fHit) { foreign = true; base += 6; } }
        else if (kind === 'b') base = BAL.benchBase + sB;
        else if (kind === 'x' || kind === 'r') base = slotBase(kind, pos) + sP;
        else if (pos === 'SP') { spCount++; base = 47.5 + sP; if (spCount <= 2) { foreign = true; base += 8; } }
        else base = 50 + sP;
        let age = foreign ? R.int(26, 33) : Math.round(clamp(28 + R.gauss() * 4, 20, 38));
        const rp = foreign ? null : takeReal(pos, kind);
        const o = { base, foreign, age };
        if (rp) { o.name = rp.name; o.age = Math.max(19, rp.age); o.starP = rp.star ? 1 : 0; }   // 간판(S)만 스타 → 리그 전체 스타 비율이 생성 리그(8%)와 비슷하게
        t.act.push(genOther(st, t.id, pos, o).id);
      });
      st.lg.teams.push(t);
    }
    // 구단 보정: 첫 시즌 기대 승률이 2026 실제 승률과 같도록
    const exp = st.lg.teams.map(t => expectedTeamWAR(st, t));
    const avg = exp.reduce((a, b) => a + b, 0) / exp.length;
    st.lg.teams.forEach((t, i) => { t.playerExp = 0.5 + (exp[i] - avg) / BAL.warScale / 144; t.adj = t.win2026 - t.playerExp; });
  }
  function expectedTeamWAR(st, t) {
    let w = 0;
    const lu = teamLineup(st, t, -1, null);
    lu.starters.forEach(x => { w += batWAR(batExp(batRates(x.p.r), 620, FORM0, 1, 1), x.p.r, x.p.pos, 0.775); });
    lu.bench.forEach((x, i) => { w += batWAR(batExp(batRates(x.p.r), i < BAL.benchTopN ? 200 : 75, FORM0, 1, 1), x.p.r, x.p.pos, 0.775); });
    lu.sp.forEach(x => { const pr = pitRates(x.p.r); w += pitWAR(pitExp(pr, 29 * pr.ipS * 3, FORM0), 4.18) / BAL.pitScale; });
    lu.rp.forEach(x => { w += pitWAR(pitExp(pitRates(x.p.r), 180, FORM0), 4.18) / BAL.pitScale; });
    return w;
  }
  const FORM0 = { h: 1, bb: 1, hr: 1, sb: 1, k: 1 };

  // 라인업·보직 (seg = 구간 번호, -1이면 부상 무시)
  // meE: { bat: {pos, r, ovr, displace}, pit: {pos, r, ovr, displace} }
  function teamLineup(st, t, seg, meE) {
    const P = st.lg.p;
    let hs = [], ps = [];
    for (const id of t.act) {
      const p = P[id];
      if (seg >= 0 && p.injSeg === seg) continue;
      (p.role === 'B' ? hs : ps).push({ p, pos: p.pos, r: p.r, ovr: valAt(p.r, p.pos) });   // 29차: 오버롤 대신 기대 WAR 지수
    }
    if (meE && meE.bat) {
      if (meE.bat.displace) removeLowest(hs, GROUP[meE.bat.pos]);
      hs.push({ me: true, pos: meE.bat.pos, r: meE.bat.r, ovr: meE.bat.ovr });
    }
    if (meE && meE.pit) {
      // 15차: 내 자리는 늘 불펜 한 명을 빼서 만든다 → 선발이면 선발 5명과 경쟁, 불펜이면 로테이션에 끼지 않음
      if (meE.pit.displace) removeLowest(ps, 'P', 'RP');
      ps.push({ me: true, pos: meE.pit.pos, r: meE.pit.r, ovr: meE.pit.ovr, cl: meE.pit.cl, spPromise: meE.pit.spPromise });
    }
    const starters = [];
    const used = new Set();
    for (const pos of ['C', 'SS', '2B', '3B', '1B', 'OF', 'OF', 'OF']) {
      let best = null, bv = -1;
      for (const x of hs) if (!used.has(x) && x.pos === pos && x.ovr > bv) { best = x; bv = x.ovr; }
      if (!best) for (const x of hs) { if (used.has(x) || x.pos === 'DH') continue; const v = valAt(x.r, pos) - 5 + (x.me ? x.ovr - valAt(x.r, x.pos) : 0); if (v > bv) { best = x; bv = v; } }
      if (best) { used.add(best); starters.push({ x: best, slot: pos }); }
    }
    let dh = null, dv = -1;
    for (const x of hs) if (!used.has(x)) { const v = valAt(x.r, 'DH') + (x.me ? x.ovr - valAt(x.r, x.pos) : 0); if (v > dv) { dh = x; dv = v; } }
    if (dh) { used.add(dh); starters.push({ x: dh, slot: 'DH' }); }
    const bench = hs.filter(x => !used.has(x)).sort((a, b) => b.ovr - a.ovr);   // 38차: 후보는 지수 순 (앞쪽 benchTopN명이 대타·플래툰으로 많이 나간다)
    // 타순: 기대 OPS 순
    starters.forEach(s => { const e = batRates(s.x.r); s.eops = expOPS(e); });
    const byOps = starters.slice().sort((a, b) => b.eops - a.eops);
    const ORDER = [3, 4, 5, 1, 2, 6, 7, 8, 9];
    byOps.forEach((s, i) => { s.order = ORDER[i] || 9; });
    // 투수
    // 25차: 선발 전환을 받아들인 첫 시즌은 로테이션 자리를 보장 (spPromise)
    const sps = ps.filter(x => x.pos === 'SP').map(x => ({ x, v: valAt(x.r, 'SP') + (x.me ? x.ovr - valAt(x.r, x.pos) + (x.spPromise ? 100 : 0) : 0) })).sort((a, b) => b.v - a.v);
    const sp = sps.slice(0, 5).map(o => o.x);
    let rest = ps.filter(x => sp.indexOf(x) < 0);
    if (sp.length < 5) {
      rest.sort((a, b) => valAt(b.r, 'SP') - valAt(a.r, 'SP'));
      // 내 불펜 투수는 빈 선발 자리 메우기에서 제외 (보직 전환은 제안을 받아들였을 때만)
      const fill = rest.filter(x => !(x.me && x.pos === 'RP'));
      while (sp.length < 5 && fill.length) { const f = fill.shift(); sp.push(f); rest.splice(rest.indexOf(f), 1); }
    }
    // 11차: 마무리로 지정된 내 선수는 마무리 자리에 우선 (감독 신뢰 보정)
    rest = rest.map(x => ({ x, v: valAt(x.r, 'RP') + (x.me ? x.ovr - valAt(x.r, x.pos) + (x.cl ? BAL.closerBias : 0) : 0) })).sort((a, b) => b.v - a.v).map(o => o.x);
    // 25차: 마무리로 정해진 내 선수는 (직전 구간 ERA 4.5 초과로 잃지 않는 한) 마무리 자리 보장
    const myCl = rest.findIndex(x => x.me && x.cl && x.pos === 'RP');
    if (myCl > 0) rest.unshift(rest.splice(myCl, 1)[0]);
    const rp = rest.map((x, i) => ({ x, role: x.pos === 'SP' ? 'LR' : i === 0 ? 'CL' : i <= 2 ? 'SU' : 'MR' }));
    return {
      starters: starters.map(s => ({ p: s.x.p, me: s.x.me, slot: s.slot, order: s.order })),
      bench: bench.map(x => ({ p: x.p, me: x.me })),
      sp: sp.map(x => ({ p: x.p, me: x.me })),
      rp: rp.map(o => ({ p: o.x.p, me: o.x.me, role: o.role })),
    };
  }
  // 29차: 주전 경쟁 지수 — 능력치로 기대 WAR(타자 600타석·선발 29경기·불펜 65이닝)를 계산하고 오버롤 눈금으로 옮긴다.
  // 오버롤이 낮아도 그 포지션에서 실제로 점수를 내고 막는 능력이 높으면 주전을 잡는다. (난수를 쓰지 않는다)
  function expWAR(r, pos) {
    if (pos === 'SP' || pos === 'RP') {
      const pr = pitRates(r);
      const s = pitExp(pr, pos === 'SP' ? 29 * pr.ipS * 3 : 195, FORM0);
      if (pos === 'SP') s.GS = 29;
      return pitWAR(s, 4.18);
    }
    const br = batRates(r), sb = br.sbA * br.sbS, cs = br.sbA - sb;
    let runs = (expOPS(br) - 0.775) * 600 * 0.4 + sb * 0.2 - cs * 0.4 + (POSADJ[pos] || 0) + 20;
    if (pos !== 'DH') runs += defRuns(r, pos);
    return runs / 10 * BAL.warScale;
  }
  function valAt(r, pos) {
    if (!BAL.useVal) return ovrAt(r, pos);   // 비교용 스위치 (끄면 예전처럼 오버롤로 경쟁)
    const f = BAL.valFit[pos === 'SP' || pos === 'RP' ? pos : 'B'];
    return f[0] + f[1] * expWAR(r, pos);
  }
  function removeLowest(arr, group, pos) {
    let lo = null, lv = 1e9;
    // 15차: 투수는 같은 보직(선발↔선발, 불펜↔불펜)에서 뺀다 — 선발이 빠져 내 불펜 투수가 로테이션에 끼던 문제
    if (pos) for (const x of arr) if (!x.me && x.pos === pos && x.ovr < lv) { lo = x; lv = x.ovr; }
    if (!lo) for (const x of arr) if (!x.me && GROUP[x.pos] === group && x.ovr < lv) { lo = x; lv = x.ovr; }
    if (!lo && group === 'IF') for (const x of arr) if (!x.me && x.pos === 'DH' && x.ovr < lv) { lo = x; lv = x.ovr; }
    if (lo) arr.splice(arr.indexOf(lo), 1);
  }
  function expOPS(e) {
    const bip = Math.max(0, 1 - e.bb - e.k - e.hr), hn = bip * e.babip, xb = hn * e.xbh, t3 = xb * e.t3, d2 = xb - t3, s1 = hn - xb, ab = 1 - e.bb, h = hn + e.hr;
    return (e.bb + h) + (s1 + 2 * d2 + 3 * t3 + 4 * e.hr) / ab;
  }
  const SLOTPA = { 1: 680, 2: 665, 3: 650, 4: 635, 5: 620, 6: 605, 7: 590, 8: 575, 9: 560 };
  const RBIM = { 1: 0.85, 2: 0.9, 3: 1.15, 4: 1.15, 5: 1.12, 6: 1.0, 7: 0.95, 8: 0.9, 9: 0.85 };
  const RUNM = { 1: 1.18, 2: 1.12, 3: 1.05, 4: 1.0, 5: 0.97, 6: 0.93, 7: 0.9, 8: 0.88, 9: 0.86 };

  // 내 선수의 같은 포지션군 1군 최하위 오버롤
  function groupLowest(st, t, group) {
    let lv = 1e9;
    for (const id of t.act) {
      const p = st.lg.p[id];
      if ((GROUP[p.pos] === group) || (group === 'IF' && p.pos === 'DH')) lv = Math.min(lv, valAt(p.r, p.pos));
    }
    return lv === 1e9 ? 0 : lv;
  }
  function teamById(st, id) { return st.lg.teams.find(t => t.id === id); }
  // 52차: 계약 제안에 붙이는 '작년 N위' (지금 리그의 직전 시즌 순위)
  function lastRankTxt(st, id) {
    for (const L of [st.lg, st.home].concat(Object.values(st.L || {}))) {
      const ls = L && L.lastStand; const i = ls ? ls.indexOf(id) : -1;
      if (i >= 0) return ` (작년 ${i + 1}위)`;
    }
    return '';
  }

  // ================================================================
  // 내 선수
  // ================================================================
  function mainKeys(me) { return me.role === 'P' ? PIT : BAT; }
  function oppKeys(me) { return me.role === 'P' ? BAT : PIT; }
  function myOVR(me, r) { return ovrAt(r || me.r, me.pos); }
  function myOppOVR(me, r) { return me.role === 'P' ? ovrAt(r || me.r, 'DH') : ovrAt(r || me.r, 'RP'); }
  // 29차: 주전 경쟁용 (기대 WAR 지수, 오버롤 눈금)
  function myVal(me, r) { return valAt(r || me.r, me.pos); }
  function myOppVal(me, r) { return me.role === 'P' ? valAt(r || me.r, 'DH') : valAt(r || me.r, 'RP'); }
  function trustB(me) { return clamp(Math.trunc((me.trust - 50) / 10), -5, 5); }
  function peakBoost(me) { const p = me.peak; return p && me.age >= p.from && me.age < p.from + p.len ? p.boost * (me.role === 'P' ? BAL.peak.pitMult : 1) : 0; }
  function effR(me, extra) { const e = {}; const f = me.stage === 'pro' ? (me.form || 0) + peakBoost(me) - (me.lvPen || 0) : 0; for (const k of ALL) e[k] = me.r[k] + (me.tmp[k] || 0) + (extra || 0) + f; return e; }
  function addR(me, k, d) { me.r[k] = clamp(me.r[k] + d, 20, 99); }
  function lowestKey(me) { let lk = null, lv = 999; for (const k of mainKeys(me)) if (me.r[k] < lv) { lv = me.r[k]; lk = k; } return lk; }
  function avgKeys(r, keys) { return keys.reduce((a, k) => a + r[k], 0) / keys.length; }

  function makeCandidates(st, role, pos) {
    bind(st);
    const keys = role === 'P' ? PIT : BAT;
    const out = [];
    for (let c = 0; c < 3; c++) {
      const w = keys.map(() => R.range(0.6, 1.45));
      const sum = w.reduce((a, b) => a + b, 0);
      const r = {};
      keys.forEach((k, i) => { r[k] = clamp(Math.round(240 * w[i] / sum), 26, 58); });
      let diff = 240 - keys.reduce((a, k) => a + r[k], 0), guard = 0;
      while (diff !== 0 && guard++ < 200) { const k = R.pick(keys); const d = diff > 0 ? 1 : -1; if (r[k] + d >= 26 && r[k] + d <= 58) { r[k] += d; diff -= d; } }
      const opp = role === 'P' ? BAT : PIT;
      const oBase = R.range(28, 48);
      opp.forEach(k => { r[k] = Math.round(clamp(oBase + R.gauss() * 5, 20, 55)); });
      const top = keys.slice().sort((a, b) => r[b] - r[a])[0];
      out.push({ r, label: LABEL[top] + '형' });
    }
    return out;
  }

  function newGame(seed, setup) {
    const st = { v: DATA.version, seed: seed >>> 0, rng: { s: seed >>> 0 }, year: 2027, pending: [], hist: [], story: [], lgHist: [], last: null, done: false };
    bind(st);
    makeLeague(st);
    // 2026 시즌 순위표를 '직전 시즌'으로 둔다 (드래프트 순서용)
    st.lg.lastStand = st.lg.teams.map(t => ({ id: t.id, wins: Math.round(t.win2026 * 144) })).sort((a, b) => b.wins - a.wins).map(x => x.id);
    st.lg.cid = 'KBO';
    ensureLeagues(st);
    const me = {
      name: setup.name || '홍길동', num: setup.num || 1, bats: setup.bats || 'R', throws: setup.throws || 'R', role: setup.role,
      pos: OF_POS.indexOf(setup.pos) >= 0 ? 'OF' : setup.pos, ofPos: OF_POS.indexOf(setup.pos) >= 0 ? setup.pos : setup.pos === 'OF' ? 'CF' : null,
      age: 17, r: Object.assign({}, setup.r), school: setup.school || 'mid', hometown: setup.hometown || R.pick(DATA.teams).id, hsName: setup.hsName || null,
      avatar: setup.avatar || (seed % 9973),
      trainFocus: (setup.trainFocus || []).slice(0, 2), tfChanges: BAL.focusChange.times, tf2: null,
      stage: 'hs', grade: 1, team: null, lvl: 2, care: 0, trust: 50, pop: 0, dur: R.int(50, 85), bigInj: 0,
      twoWay: false, twOffered: false, focus: 1, svc: 0, faAt: null, contract: null, salary: 0, earnings: 0, draft: null, debut: null, origin: 'hs',
      scout: { score: 0, perf: [], tourn: [], err: R.range(-15, 15), youth: false, bonus: 0 }, flags: setup.closer ? { closer: true } : {}, tmp: {}, used: {}, noFirst: 0,
      univYears: 0, indieYears: 0, endedFirst: false, milDone: false, milType: null, milYears: 0, everStarter: false, everTwoWaySuccess: false, twoWayChosen: false,
    };
    // 숨은 값
    const tier = R.weighted(BAL.paTier, x => x[1]);
    me.tier = tier[0];
    const pk = BAL.peak[me.tier];
    me.peak = pk ? { from: R.int(BAL.peak.from[0], BAL.peak.from[1]), len: R.int(pk.len[0], pk.len[1]), boost: R.int(pk.boost[0], pk.boost[1]) } : null;
    const avgPA = R.range(tier[2], tier[3] + 0.99);
    const TW = BAL.twoWay;
    me.twMult = R.chance(BAL.twoWayLegendP) ? { main: 1.0, opp: TW.opp, legend: true } : { main: TW.main, opp: TW.opp, legend: false };
    const oppAvg = me.twMult.legend ? avgPA - R.range(TW.oppGapLegend[0], TW.oppGapLegend[1]) : avgPA - R.range(TW.oppGap[0], TW.oppGap[1]);
    me.pa = {};
    for (const k of mainKeys(me)) me.pa[k] = Math.round(clamp(avgPA + R.gauss() * BAL.paSpread, me.r[k] + 5, 99));
    for (const k of oppKeys(me)) me.pa[k] = Math.round(clamp(oppAvg + R.gauss() * BAL.paSpread, me.r[k] + 3, 99));
    me.growth = R.weighted(['early', 'std', 'late'], x => x === 'std' ? 0.5 : 0.25);
    me.aging = R.weighted(Object.keys(BAL.agingProb), x => BAL.agingProb[x]);
    me.shown = Object.assign({}, me.r);
    st.me = me;
    st.car = { bat: emptyBat(), pit: emptyPit(), ps: { bat: emptyBat(), pit: emptyPit() }, war: 0, warB: 0, warP: 0, aw: { MVP: 0, GG: 0, KSMVP: 0, TITLE: 0, ROY: 0, KS: 0, POY: 0 }, awList: [], ms: [], twoWaySeasons: 0, peak: myOVR(me), achPts: 0 };
    story(st, `${me.age}세, ${me.hsName || schoolName(me.school)} 야구부 1학년. 벤치 끝자리에서 인생이 시작됐다.`);
    return st;
  }
  function schoolName(s) { return { strong: '전국구 강호', mid: '중위권 고교', weak: '약체 고교' }[s]; }
  // 56차: inSeason — 시즌 중(예: 9월 신인 드래프트)에 있었던 일은 그 시즌의 연도·나이로 남긴다
  function story(st, text, inSeason) { st.story.push({ year: inSeason ? st.year - 1 : st.year, age: inSeason ? st.me.age - 1 : st.me.age, text }); }

  // ================================================================
  // 시즌 진행
  // ================================================================
  function playSeason(st) {
    bind(st);
    if (st.done || st.pending.length) return null;
    const t0 = Date.now();
    const me = st.me;
    me.tmp = {};
    applyPreSeasonFlags(st);
    if (me.age === 30 && !me.flags.rerolled) rerollAging(st);
    const res = { year: st.year, age: me.age, stage: me.stage, lines: [], awards: [], ms: [], news: [], notes: [], war: 0 };
    st.last = res;
    ensureLeagues(st);
    // 내가 속한 리그는 자세히 (선수 기용·구간별 경기). 해외에 있으면 KBO도 따로 돈다(복귀 대비)
    const _t0 = now();
    const lgRes = leagueSeason(st, res);
    PROF.main = (PROF.main || 0) + now() - _t0;
    if (st.home) { const cur = st.lg; st.lg = st.home; try { leagueSeason(st, {}, { noMe: true }); } finally { st.lg = cur; } }
    if (me.stage === 'hs') hsSeason(st, res);
    else if (me.stage === 'univ') amateurSeason(st, res, 'univ');
    else if (me.stage === 'indie') amateurSeason(st, res, 'indie');
    else if (me.stage === 'mil') milSeason(st, res);
    res.league = lgRes;
    intlTournament(st, res);
    runOtherLeagues(st, res);
    winter(st, res);
    res.ms_time = Date.now() - t0;
    return res;
  }

  // 퓨처스·대학·일본·미국 (내가 뛰지 않는 리그는 가볍게). 퓨처스·대학은 내 성적도 넣는다
  const PROF = {};
  const OPT = { fast: false, botPost: false };
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  function runOtherLeagues(st, res) {
    const me = st.me, L = st.L;
    const _t = now();
    // 퓨처스: KBO 소속으로 2군 기록이 있으면 내 2군 팀에 넣는다
    let futMine = null;
    if (me.stage === 'pro' && cfgOf(st.lg).id === 'KBO' && (res.futBat || res.futPit)) futMine = { team: 'F_' + me.team, pos: me.pos, r: effR(me), bat: res.futBat || null, pit: res.futPit || null };
    if (me.stage === 'mil' && me.milType === 'sangmu') futMine = { team: 'F_SM', pos: me.pos, r: effR(me), bat: res.bat || null, pit: res.pit || null };
    const fr = liteSeason(st, L.FUT, futMine);
    if (futMine) { res.futLeague = futMine.team; res.futWar = fr.myWAR; }
    if (me.stage === 'mil' && me.milType === 'sangmu' && res.team) { const s = L.FUT.standings.find(x => x.id === 'F_SM'); if (s) res.team.record = `퓨처스리그 ${s.wins}승 ${s.losses}패 · ${s.rank}위`; const lead = leaderLine(fr.leaders, me); if (lead) res.leaderLine = '퓨처스 ' + lead; }
    // 대학
    let uMine = null;
    if (res.stage === 'univ') uMine = { team: me.univTeam, pos: me.pos, r: effR(me), bat: res.bat || null, pit: res.pit || null };
    const ur = liteSeason(st, L.UNIV, uMine);
    if (uMine && res.team) {
      const s = L.UNIV.standings.find(x => x.id === me.univTeam);
      if (s) res.team.record = `대학리그 ${s.wins}승 ${s.losses}패 · ${s.rank}위${s.rank === 1 ? ' (우승)' : ''}`;
      res.univWar = ur.myWAR;
      const lead = leaderLine(ur.leaders, me);
      if (lead) res.leaderLine = '대학리그 ' + lead;
    }
    PROF.futUniv = (PROF.futUniv || 0) + now() - _t;
    const _t2 = now();
    // 밸런스 봇용 빠른 모드: 내가 없는 해외 리그는 시즌 기록 없이 노화·교체만
    for (const cid of ['NPB', 'MLB']) if (L[cid]) { if (OPT.fast) { liteWinter(st, L[cid]); stripLeague(L[cid]); } else liteSeason(st, L[cid], null); }
    PROF.abroad = (PROF.abroad || 0) + now() - _t2;
  }
  function applyPreSeasonFlags(st) {
    const me = st.me, f = me.flags;
    const all = k => { for (const key of ALL) me.tmp[key] = (me.tmp[key] || 0) + k; };
    if (f.slump) { all(-3); delete f.slump; }
    if (f.adjust) { all(R.range(-3, 3)); delete f.adjust; }
  }
  function rerollAging(st) {
    const me = st.me; me.flags.rerolled = true;
    const order = ['early', 'std', 'long', 'iron'];
    const i = order.indexOf(me.aging);
    const up = clamp(me.care * 0.05, 0, 0.25), down = clamp(-me.care * 0.05, 0, 0.25);
    const u = R();
    if (u < up && i < 3) me.aging = order[i + 1];
    else if (u < up + down && i > 0) me.aging = order[i - 1];
  }

  // ---------- 고교 ----------
  function hsSeason(st, res) {
    const me = st.me;
    const e = effR(me);
    const o = myOVR(me, e);
    const sr = BAL.seniorOVR[me.school];
    const senior = R.range(sr[0], sr[1]);
    let status = o >= senior ? 'S' : o >= senior - 6 ? 'P' : 'B';
    if (me.flags.hsPlayDown) { status = status === 'S' ? 'P' : 'B'; delete me.flags.hsPlayDown; }
    let inj = R.chance(0.06 + (me.flags.injRisk || 0)); delete me.flags.injRisk;
    const injMul = inj ? 0.6 : 1;
    if (inj) res.notes.push('시즌 중 부상으로 한 달 쉬었다.');
    res.status = status;
    res.statusText = { S: '주전', P: '대타·대수비', B: '벤치' }[status] + (me.role === 'P' ? ' (투수)' : '');
    const bonus = 15;
    let perf = 50;
    if (me.role === 'B' || me.twoWay) {
      const pa = Math.round(BAL.hsPA[status] * injMul * (me.role === 'B' ? 1 : 0.7) + R.int(-4, 4));
      const p = batRates(e, bonus);
      const s = finishBat(simBat(p, Math.max(0, pa)), p, 1, 1, 1);
      s.G = Math.min(25, Math.round(s.PA / 3.6));
      res.bat = s;
      if (s.PA >= 20) perf = pctNorm(OPS(s) + amDef(me, e), 0.80, 0.12);
      else perf = 30;
    }
    if (me.role === 'P' || me.twoWay) {
      const ip = BAL.hsIP[status] * injMul * (me.role === 'P' ? 1 : 0.6) * R.range(0.85, 1.15);
      const p = pitRates(e, bonus);
      const s = simPitch(p, Math.round(ip * 3), 1);
      s.G = Math.round(ip / 4.5) + 1; s.GS = status === 'S' ? Math.round(s.G * 0.6) : 0;
      res.pit = s;
      const pp = s.outs >= 30 ? (pctNorm(-ERA(s), -3.8, 1.3) * 0.7 + pctNorm(s.K / Math.max(1, s.BF), 0.20, 0.06) * 0.3) : 30;
      perf = me.role === 'P' ? pp : Math.max(perf, pp);
    }
    // 팀 성적
    const myC = status === 'S' ? (o - 45) * 0.006 : status === 'P' ? (o - 45) * 0.002 : 0;
    const str = clamp(BAL.schoolStr[me.school] + myC + (me.flags.hsTeamBoost || 0), 0.2, 0.85); delete me.flags.hsTeamBoost;
    let lw = 0; for (let i = 0; i < 10; i++) if (R() < log5(str, 0.5)) lw++;
    const ROUND = ['1회전 탈락', '16강', '8강', '4강', '준우승', '우승'];
    const tnames = ['봄 청룡기배', '여름 백호기배', '가을 현무기배'];
    const tres = [];
    let tScore = 0, won = 0;
    tnames.forEach(n => {
      let w = 0;
      while (w < 5) { const opp = 0.42 + w * 0.05 + R.range(-0.05, 0.05); if (R() < log5(str, opp)) w++; else break; }
      tres.push(`${n} ${ROUND[w]}`); tScore += [0, 10, 25, 45, 70, 100][w]; if (w === 5) won++;
    });
    tScore /= 3;
    res.team = { name: me.hsName || schoolName(me.school), record: `주말리그 ${lw}승 ${10 - lw}패`, tourn: tres };
    // 수상
    if (won && status === 'S' && perf >= 60 && R.chance(0.5)) res.awards.push('대회 MVP');
    if (status === 'S' && perf >= 90) res.awards.push(me.role === 'P' ? '대회 우수투수상' : '대회 타격상');
    if (status === 'S' && perf >= 97 && o >= 55) res.awards.push(me.role === 'P' ? '올해의 고교 투수' : '올해의 고교 타자');
    if (me.grade === 3 && o >= 60) { me.scout.youth = true; res.awards.push('청소년 대표 발탁'); story(st, `청소년 대표팀 유니폼을 입었다.`); }
    me.scout.perf.push(perf); me.scout.tourn.push(tScore);
    me.hsLast = { perf, status };
    me.scout.score = scoutScore(st);
    res.scout = interest(me.scout.score);
    res.playCoef = { S: 1.0, P: 0.7, B: 0.5 }[status] * (inj ? 0.8 : 1);
    if (status === 'S') { if (!me.flags.hsStarterSaid) { me.flags.hsStarterSaid = 1; story(st, `${me.grade}학년, 드디어 주전 자리를 꿰찼다.`); } }
    res.lines.push(res.bat ? hsBatLine(res.bat) : null);
    hsHistRow(st, res);
  }
  function hsBatLine(s) { return s; }
  function hsHistRow(st, res) {
    const me = st.me;
    st.hist.push({ year: st.year, age: me.age, team: me.stage === 'hs' ? (me.hsName ? me.hsName + ' ' + me.grade : '고교' + me.grade) : me.stage === 'univ' ? univName(st) : '독립', teamId: me.stage === 'univ' ? me.univTeam : null, lg: me.stage === 'hs' ? 'HS' : me.stage === 'univ' ? 'UNIV' : 'IND', lvl: 'A', bat: res.bat || null, pit: res.pit || null, war: null, note: res.awards.join(', ') });
  }
  // 14차: 아마추어 평가에 수비 기여를 OPS 환산으로 더한다 (유격·포수는 크게)
  function amDef(me, e) { return me.role === 'B' ? (defRuns(e, me.pos) / 600) * 3 : 0; }
  function pctNorm(x, mu, sd) { const z = (x - mu) / sd; return clamp(Math.round(100 / (1 + Math.exp(-1.7 * z))), 1, 99); }
  function log5(a, b) { return a * (1 - b) / (a * (1 - b) + b * (1 - a)); }
  function scoutScore(st) {
    const me = st.me, sc = me.scout, w = BAL.scoutW;
    const n = sc.perf.length;
    const wts = n === 1 ? [1] : n === 2 ? [0.35, 0.65] : [0.2, 0.3, 0.5];
    const perf = sc.perf.slice(-3).reduce((a, v, i) => a + v * wts[i], 0);
    const tourn = sc.tourn.slice(-3).reduce((a, v, i) => a + v * wts[i], 0);
    let tool;
    if (me.role === 'P') { const kmh = Math.round(L(me.r.vel, T.velo)); tool = me.r.vel + (kmh >= 150 ? 10 : 0); }   // 스카우트 판정은 예전 기준 유지 (밸런스)
    else tool = Math.max(me.r.pow, me.r.spd, me.r.arm, me.r.def + ((DEFMUL[me.pos] || 0) >= 1.1 ? 4 : 0));   // 14차: 수비도 툴로 본다
    const paAvg = avgKeys(me.pa, mainKeys(me)) + sc.err;
    let s = w.ovr * myOVR(me) + w.perf * perf + w.tourn * tourn + w.tool * tool + w.pa * paAvg;
    if (me.stage === 'hs') s += BAL.schoolExpo[me.school] + (sc.youth ? 5 : 0) + (me.hsName && me.school === 'strong' ? BAL.eliteScout : 0);   // 52차: 지역 명문고 스카우트 보너스
    if (me.stage === 'univ') s += BAL.univScout;
    s += sc.bonus || 0;
    return Math.max(s, ovrFloor(me));
  }
  // 26차: 능력치 바닥 — 미국 직행 제안 수준(내부 OVR 50, 표시 65)이면 최소 1라운드, 내부 54(표시 70)면 1~3순위
  function ovrFloor(me) {
    const o = myOVR(me), b = BAL.draftBand, u = BAL.usDirect.ovr;
    return o >= u + 4 ? b[0] : o >= u ? b[1] : 0;
  }
  const INTEREST = ['관심 없음', '지켜보는 중', '중위 라운드 후보', '상위 라운드 후보', '1라운드 유력'];
  function interest(s) { const b = BAL.draftBand; return INTEREST[s < BAL.draftCut ? 0 : s < b[3] ? 1 : s < b[2] ? 2 : s < b[1] ? 3 : 4]; }
  function draftRange(s) { const b = BAL.draftBand; return s >= b[0] ? '1라운드 상위 순번' : s >= b[1] ? '1라운드' : s >= b[2] ? '2~3라운드' : s >= b[3] ? '4~7라운드' : s >= BAL.draftCut ? '8~11라운드' : '미지명 위험'; }

  function univName(st) {
    const me = st.me;
    if (!me.univTeam && st.L && st.L.UNIV) me.univTeam = R.pick(st.L.UNIV.teams).id;
    const t = me.univTeam && findTeam(st, me.univTeam);
    return t ? t.name : '대학 야구부';
  }
  // ---------- 대학 / 독립리그 ----------
  function amateurSeason(st, res, kind) {
    const me = st.me, e = effR(me), o = myOVR(me, e);
    let status;
    if (kind === 'univ') { const senior = R.range(46, 56); status = o >= senior ? 'S' : o >= senior - 6 ? 'P' : 'B'; }
    else status = o >= 42 ? 'S' : 'P';
    res.status = status;
    res.statusText = (kind === 'univ' ? '대학 ' : '독립리그 ') + { S: '주전', P: '백업', B: '벤치' }[status];
    const bonus = kind === 'univ' ? 8 : 10;
    const paBase = kind === 'univ' ? { S: 115, P: 45, B: 12 } : { S: 320, P: 160, B: 40 };
    const ipBase = kind === 'univ' ? { S: 60, P: 25, B: 6 } : { S: 110, P: 50, B: 10 };
    let perf = 50;
    if (me.role === 'B' || me.twoWay) {
      const p = batRates(e, bonus);
      const s = finishBat(simBat(p, Math.round(paBase[status] * (me.role === 'B' ? 1 : 0.7))), p, 1, 1, 1);
      res.bat = s; perf = s.PA >= 20 ? pctNorm(OPS(s) + amDef(me, e), 0.80, 0.12) : 30;
    }
    if (me.role === 'P' || me.twoWay) {
      const p = pitRates(e, bonus);
      const s = simPitch(p, Math.round(ipBase[status] * 3 * (me.role === 'P' ? 1 : 0.6)), 1);
      s.G = Math.round(IP(s) / 5) + 1;
      res.pit = s;
      const pp = s.outs >= 30 ? pctNorm(-ERA(s), -3.8, 1.3) : 30;
      perf = me.role === 'P' ? pp : Math.max(perf, pp);
    }
    me.scout.perf.push(perf); me.scout.tourn.push(status === 'S' ? R.range(20, 70) : 10);
    res.team = { name: kind === 'univ' ? univName(st) : '독립리그 구단', record: '', tourn: [] };
    res.playCoef = { S: 1.0, P: 0.7, B: 0.5 }[status];
    if (kind === 'univ') { me.univYears++; me.scout.score = scoutScore(st); res.scout = interest(me.scout.score); }
    else me.indieYears++;
    hsHistRow(st, res);
  }

  // ---------- 리그 한 시즌 (+ 프로라면 내 선수) ----------
  function leagueSeason(st, res, opts) {
    const lg = st.lg, P = lg.p, me = st.me;
    const cfg = cfgOf(lg);
    GF = cfg.games / 144;
    const pro = me.stage === 'pro' && !(opts && opts.noMe);
    const myTeam = pro ? teamById(st, me.team) : null;
    // 시즌 준비
    for (const t of lg.teams) for (const id of t.act) {
      const p = P[id];
      p.acc = { PA: 0, rbiW: 0, rW: 0, outs: 0, GS: 0, cl: 0, su: 0, rel: 0 };
      p.injSeg = R.chance(BAL.otherInj) ? R.int(0, 2) : -9;
      p.form = { h: 1 + R.tri() * 0.07, bb: 1 + R.tri() * 0.15, hr: 1 + R.tri() * 0.25, sb: 1 + R.tri() * 0.25, k: 1 + R.tri() * 0.12 };
    }
    const mine = pro ? proPrep(st) : null;
    for (let seg = 0; seg < 3; seg++) {
      let meE = null;
      if (pro) meE = meSegStart(st, mine, seg, myTeam);
      for (const t of lg.teams) {
        const lu = teamLineup(st, t, seg, t === myTeam ? meE : null);
        for (const s of lu.starters) { const pa = SLOTPA[s.order] / 3; if (s.me) { mine.segRole.bat = { kind: 'S', order: s.order, slot: s.slot }; continue; } s.p.acc.PA += pa; s.p.acc.rbiW += pa * RBIM[s.order]; s.p.acc.rW += pa * RUNM[s.order]; }
        lu.bench.forEach((b, bi) => { if (b.me) { mine.segRole.bat = { kind: 'B' }; return; } const pa = bi < BAL.benchTopN ? 62 : BAL.benchLowPA; b.p.acc.PA += pa; b.p.acc.rbiW += pa * 0.9; b.p.acc.rW += pa * 0.95; });
        for (const s of lu.sp) { if (s.me) { mine.segRole.pit = { kind: 'SP' }; continue; } const pr = pitRates(s.p.r); const gs = spGS(GF) / 3; s.p.acc.GS += gs; s.p.acc.outs += gs * pr.ipS * 3 * (1 + R.tri() * 0.06); }
        for (const r of lu.rp) { if (r.me) { mine.segRole.pit = { kind: r.role }; continue; } const ip = r.role === 'MR' || r.role === 'LR' ? 17 : 20; r.p.acc.outs += ip * 3; r.p.acc.rel += Math.round(ip * 1.05); if (r.role === 'CL') r.p.acc.cl++; if (r.role === 'SU') r.p.acc.su++; }
      }
      if (pro) meSegPlay(st, mine, seg, myTeam);
    }
    // 다른 선수 라인
    let lgPA = 0, lgOB = 0, lgSL = 0, lgAB = 0, lgER = 0, lgOuts = 0;
    const lines = [];
    for (const t of lg.teams) for (const id of t.act) {
      const p = P[id];
      const a = p.acc;
      p.season = null;
      if (GF !== 1) { a.PA *= GF; a.rbiW *= GF; a.rW *= GF; a.outs *= GF; a.GS *= GF; a.rel = Math.round(a.rel * GF); }
      if (p.role === 'B' && a.PA > 0) {
        const s = batExp(batRates(p.r), a.PA, p.form, a.rW / a.PA, a.rbiW / a.PA);
        p.season = { bat: s };
        lgPA += s.PA; lgOB += s.H + s.BB; lgSL += s.H + s.D + 2 * s.T + 3 * s.HR; lgAB += s.AB;
      } else if (p.role === 'P' && a.outs > 0) {
        const s = pitExp(pitRates(p.r), a.outs, p.form);
        s.GS = Math.round(a.GS); s.G = s.GS + a.rel;
        p.season = { pit: s };
        lgER += s.ER; lgOuts += s.outs;
      }
      if (p.season) lines.push(p);
    }
    if (pro) {
      const b = mine.season.bat1, pi = mine.season.pit1;
      if (b && b.PA) { lgPA += b.PA; lgOB += b.H + b.BB; lgSL += b.H + b.D + 2 * b.T + 3 * b.HR; lgAB += b.AB; }
      if (pi && pi.outs) { lgER += pi.ER; lgOuts += pi.outs; }
    }
    lg.lgOPS = lgPA ? lgOB / lgPA + lgSL / lgAB : 0.775;
    lg.lgERA = lgOuts ? lgER * 27 / lgOuts : 4.18;
    lg.lgAVG = 0; { let h = 0, ab = 0; lines.forEach(p => { if (p.season.bat) { h += p.season.bat.H; ab += p.season.bat.AB; } }); lg.lgAVG = ab ? h / ab : 0; }
    for (const p of lines) {
      if (p.season.bat) p.season.war = batWAR(p.season.bat, p.r, p.pos, lg.lgOPS);
      else p.season.war = pitWAR(p.season.pit, lg.lgERA);
    }
    let myWAR = 0;
    if (pro) {
      const tb = mine.season.bat1 && mine.season.bat1.PA ? batWAR(mine.season.bat1, effR(me), mine.batPos, lg.lgOPS) : 0;
      const tp = mine.season.pit1 && mine.season.pit1.outs ? pitWAR(mine.season.pit1, lg.lgERA) : 0;
      mine.warB = tb; mine.warP = tp; myWAR = tb + tp;
    }
    // 순위
    const tw = {};
    for (const t of lg.teams) tw[t.id] = 0;
    for (const p of lines) tw[p.team] += winsOfLine(p.season.war, !p.season.bat);
    if (pro) tw[me.team] += winsOfLine(mine.warB, false) + winsOfLine(mine.warP, true);
    const stand = makeStandings(lg, tw, cfg);
    const prevOrder = lg.lastStand;
    const shifts = prevOrder ? stand.filter(s => Math.abs(prevOrder.indexOf(s.id) + 1 - s.rank) >= 3).length : 0;
    lg.lastStand = stand.map(s => s.id);
    lg.standings = stand;
    for (const t of lg.teams) t.adj *= BAL.adjDecay;
    const wpOf = id => stand.find(s => s.id === id).pct;
    const winsOf = id => stand.find(s => s.id === id).wins;
    // 승·패·세이브·홀드
    for (const p of lines) if (p.season.pit) pitDecisions(p.season.pit, p.acc, wpOf(p.team), winsOf(p.team), lg.lgERA);
    if (pro && mine.season.pit1 && mine.season.pit1.outs) pitDecisions(mine.season.pit1, mine.pacc, wpOf(me.team), winsOf(me.team), lg.lgERA);
    // 포스트시즌
    const post = postseason(st, stand, pro ? mine : null, cfg);
    // 수상·기록
    const entries = lines.map(p => ({ id: p.id, name: p.name, team: p.team, pos: p.pos, age: p.age, ovr: Math.round(ovrAt(p.r, p.pos)), foreign: p.foreign, bat: p.season.bat, pit: p.season.pit, war: p.season.war, rookie: st.year - p.debut <= 1, def: p.season.bat ? defLine(p.r, p.pos, Math.min(cfg.games, p.season.bat.G || Math.round(p.season.bat.PA / 4.1)), R) : null }));
    if (pro && ((mine.season.bat1 && mine.season.bat1.PA) || (mine.season.pit1 && mine.season.pit1.outs))) {
      entries.push({ id: 'me', name: me.name, team: me.team, pos: me.twoWay ? (me.role === 'P' ? 'SP' : me.pos) : me.pos, age: me.age, bat: mine.season.bat1 && mine.season.bat1.PA ? mine.season.bat1 : null, pit: mine.season.pit1 && mine.season.pit1.outs ? mine.season.pit1 : null, war: myWAR, rookie: me.debut == null || st.year - me.debut <= 1, me: true, pop: me.pop, ovr: Math.round(myOVR(me)), def: mine.season.bat1 && mine.season.bat1.PA && mine.batPos !== 'DH' ? (mine.def = defLine(me.r, mine.batPos, Math.min(cfg.games, mine.season.bat1.G || Math.round(mine.season.bat1.PA / 4.1)), R)) : null });
    }
    const aw = awards(entries, stand, post);
    const leaders = buildLeaders(entries);
    for (const p of lines) { p.last = p.season; p.lastWAR = p.season.war; }
    delete lg.leaders; lg.awards = aw; lg.post = post; lg.year = st.year;
    // 기록실·구단 기록 (겨울에 은퇴·이동하기 전 시즌 종료 시점)
    lg.stats = statRows(st, entries, lg);
    delete lg.teamStats;
    // 리그 기록 (밸런스 검증용)
    const lgh = { year: st.year, lgAVG: lg.lgAVG, lgOPS: lg.lgOPS, lgERA: lg.lgERA, hrKing: leaders.HR[0] ? leaders.HR[0].v : 0, avgKing: leaders.AVG[0] ? leaders.AVG[0].v : 0, wKing: leaders.W[0] ? leaders.W[0].v : 0, warKing: leaders.WAR[0] ? leaders.WAR[0].v : 0, mvpWar: aw.mvp ? aw.mvp.war : 0, shifts, champion: post.champion };
    if (cfg.id === 'KBO') st.lgHist.push(lgh);
    st._lead = leaders;
    if (pro) proFinish(st, res, mine, stand, post, aw, leaders, myWAR);
    delete st._lead;
    // 저장 용량: 시즌 계산용 필드 정리 (지난 시즌 기록 p.last만 남김)
    for (const t of lg.teams) for (const id of t.act) { const p = P[id]; if (!p) continue; delete p.acc; delete p.form; delete p.injSeg; if (p.season) { roundLine(p.season.bat); roundLine(p.season.pit); } delete p.season; }
    // 겨울: 다른 선수 노화·은퇴·신인
    leagueWinter(st);
    for (const id in P) roundR(P[id]);
    GF = 1;
    return { standings: stand, post, cid: cfg.id };
  }
  // 승리 기여 합 → 승률·순위 (양대 리그면 리그별 순위도)
  function makeStandings(L, tw, cfg) {
    const G = cfg.games;
    const avgW = Object.values(tw).reduce((a, b) => a + b, 0) / L.teams.length;
    const ps = L.teams.map(t => ({ t, p: clamp(0.5 + (tw[t.id] - avgW) / G + (t.adj || 0) + R.gauss() * BAL.teamNoise, 0.28, 0.72) }));
    const mean = ps.reduce((a, x) => a + x.p, 0) / ps.length;
    ps.forEach(x => { x.p -= mean - 0.5; x.wins = Math.round(x.p * G); x.losses = G - x.wins; x.pct = x.wins / G; });
    ps.sort((a, b) => b.wins - a.wins);
    const stand = ps.map((x, i) => ({ id: x.t.id, name: x.t.name, sub: x.t.sub || null, wins: x.wins, losses: x.losses, pct: x.pct, rank: i + 1, war: tw[x.t.id] }));
    if (cfg.two) for (const s of cfg.two) stand.filter(x => x.sub === s).forEach((x, i) => { x.subRank = i + 1; });
    return stand;
  }

  // ---------- 10차: 가벼운 리그 시즌 (내가 뛰지 않는 리그 / 퓨처스·대학) ----------
  // 선수별 기대 성적만 계산하고 순위·기록·시상을 만든다. mine = 내 선수 성적(대학·퓨처스에서 뛸 때)
  function liteSeason(st, L, mine) {
    const cfg = cfgOf(L), P = L.p, G = cfg.games, gf = G / 144, bonus = cfg.bonus || 0;
    const frm = () => ({ h: 1 + R.tri() * 0.07, bb: 1 + R.tri() * 0.15, hr: 1 + R.tri() * 0.25, sb: 1 + R.tri() * 0.25, k: 1 + R.tri() * 0.12 });
    const lines = [];
    for (const t of L.teams) {
      const ps = t.act.map(id => P[id]).filter(Boolean);
      const bats = ps.filter(p => p.role === 'B').sort((a, b) => valAt(b.r, b.pos) - valAt(a.r, a.pos));
      const sps = ps.filter(p => p.pos === 'SP').sort((a, b) => valAt(b.r, 'SP') - valAt(a.r, 'SP'));
      const rps = ps.filter(p => p.pos === 'RP');
      bats.forEach((p, i) => {
        const pa = (i < 9 ? 570 : i < 9 + BAL.benchTopN ? 170 : 65) * gf * R.range(0.85, 1.08);
        const br = batRates(p.r, bonus), s = batExp(br, pa, frm(), 1, 1);
        s.G = Math.min(G, Math.round(s.PA / (i < 9 ? 4.1 : 2.8)));
        p.season = { bat: s }; lines.push(p);
      });
      sps.forEach((p, i) => {
        const pr = pitRates(p.r, bonus), gs = i < 5 ? spGS(gf) * 0.97 : 6 * gf;
        const s = pitExp(pr, gs * pr.ipS * 3, frm()); s.GS = Math.round(gs); s.G = s.GS;
        p.acc = { GS: gs, cl: 0, su: 0, rel: 0 }; p.season = { pit: s }; lines.push(p);
      });
      rps.forEach((p, i) => {
        const ip = 62 * gf, s = pitExp(pitRates(p.r, bonus), ip * 3, frm()); s.GS = 0; s.G = Math.round(ip * 1.05);
        p.acc = { GS: 0, cl: i === 0 ? 3 : 0, su: i === 1 ? 3 : 0, rel: s.G }; p.season = { pit: s }; lines.push(p);
      });
    }
    let lgPA = 0, lgOB = 0, lgSL = 0, lgAB = 0, lgER = 0, lgOuts = 0;
    for (const p of lines) {
      const b = p.season.bat, s = p.season.pit;
      if (b) { lgPA += b.PA; lgOB += b.H + b.BB; lgSL += b.H + b.D + 2 * b.T + 3 * b.HR; lgAB += b.AB; }
      if (s) { lgER += s.ER; lgOuts += s.outs; }
    }
    L.lgOPS = lgPA ? lgOB / lgPA + lgSL / lgAB : 0.775;
    L.lgERA = lgOuts ? lgER * 27 / lgOuts : 4.18;
    for (const p of lines) p.season.war = p.season.bat ? batWAR(p.season.bat, p.r, p.pos, L.lgOPS) : pitWAR(p.season.pit, L.lgERA);
    let myWAR = 0;
    if (mine) {
      if (mine.bat && mine.bat.PA) myWAR += batWAR(mine.bat, mine.r, mine.pos, L.lgOPS);
      if (mine.pit && mine.pit.outs) myWAR += pitWAR(mine.pit, L.lgERA);
    }
    const tw = {};
    for (const t of L.teams) tw[t.id] = 0;
    for (const p of lines) tw[p.team] += winsOfLine(p.season.war, !p.season.bat);
    if (mine && tw[mine.team] != null) tw[mine.team] += winsOfLine(myWAR, false);
    const stand = makeStandings(L, tw, cfg);
    L.standings = stand; L.lastStand = stand.map(s => s.id);
    const wpOf = id => stand.find(s => s.id === id).pct, winsOf = id => stand.find(s => s.id === id).wins;
    for (const p of lines) if (p.season.pit) pitDecisions(p.season.pit, p.acc, wpOf(p.team), winsOf(p.team), L.lgERA);
    const post = cfg.ps === 'none' ? { rounds: [], champion: stand[0].id, seeds: [] } : postseason(st, stand, null, cfg);
    const entries = lines.map(p => ({ id: p.id, name: p.name, team: p.team, pos: p.pos, age: p.age, ovr: Math.round(ovrAt(p.r, p.pos)), foreign: p.foreign, bat: p.season.bat, pit: p.season.pit, war: p.season.war, rookie: st.year - p.debut <= 1, def: p.season.bat ? defLine(p.r, p.pos, Math.min(cfg.games, p.season.bat.G || Math.round(p.season.bat.PA / 4.1)), R) : null }));
    if (mine && ((mine.bat && mine.bat.PA) || (mine.pit && mine.pit.outs))) entries.push({ id: 'me', name: st.me.name, team: mine.team, pos: mine.pos, age: st.me.age, bat: mine.bat && mine.bat.PA ? mine.bat : null, pit: mine.pit && mine.pit.outs ? mine.pit : null, war: myWAR, me: true, pop: st.me.pop, rookie: false, ovr: Math.round(myOVR(st.me)) });
    const prevGF = GF; GF = gf;
    L.awards = awards(entries, stand, post);
    const leaders = buildLeaders(entries);
    GF = prevGF;
    L.post = post; L.year = st.year;
    L.stats = statRows(st, entries, L);
    delete L.teamStats; delete L.leaders;
    // 시상 기록에서 무거운 필드 정리
    for (const e of entries) { if (!e.me) { roundLine(e.bat); roundLine(e.pit); } }
    liteWinter(st, L);
    stripLeague(L);
    return { standings: stand, myWAR, leaders };
  }
  // 가벼운 리그의 겨울: 노화·성장·은퇴(대학은 졸업)·신인 보충
  function liteWinter(st, L) {
    const cfg = cfgOf(L), P = L.p;
    for (const t of L.teams) {
      for (let i = 0; i < t.act.length; i++) {
        const p = P[t.act[i]];
        if (!p) continue;
        p.age++;
        const keys = p.role === 'B' ? BAT : PIT;
        for (const k of keys) {
          let d;
          if (p.age <= 23) d = R.range(1, 3.5); else if (p.age <= 26) d = R.range(0.5, 3);
          else if (p.age <= 31) d = R.range(-1, 1); else if (p.age <= 34) d = -R.range(0.5, 2.5); else d = -R.range(2, 5);
          p.r[k] = clamp(p.r[k] + d, 20, 97);
        }
        const o = ovrAt(p.r, p.pos);
        const out = cfg.grad ? p.age >= cfg.grad
          : cfg.young ? (p.age >= 31 || (p.age >= 27 && o < 42) || R.chance(0.08))
          : (p.age >= 40 || (p.age >= 34 && o < 46) || (p.age >= 37 && o < 50) || (p.age >= 31 && o < 38));
        if (out) {
          delete P[p.id];
          const base = (cfg.grad ? BAL.starterBase + cfg.base - 4 : cfg.young ? BAL.benchBase + cfg.base - 2 : R.range(BAL.rookieBase[0], BAL.rookieBase[1]) + (cfg.base || 0)) + R.gauss() * 2;
          const np = genOther(st, t.id, p.pos, { base, age: cfg.grad ? 19 : R.int(19, 23), rookie: true, starP: cfg.lite ? 0.02 : BAL.rookieStarP, nat: cfg.nat }, L);
          np.debut = st.year + 1;
          t.act[i] = np.id;
        }
      }
    }
  }

  // 60차: 풀타임 선발 한 시즌 등판 수 — KBO 약 30~31, MLB 약 33 (예전 29.4라 28경기가 흔했다)
  function spGS(gf) { return 30.6 * Math.pow(gf, 0.7); }

  function pitDecisions(s, acc, wp, wins, lgERA) {
    const era = Math.max(0.5, ERA(s));
    if (s.GS > 0) {
      // 60차: 선발 승패 = 등판 수 × 승패가 갈리는 비율(이닝이 길수록↑) × 승리 몫(팀 승률·평균자책)
      //   예전 식은 평균자책이 아주 낮으면 배수가 끝없이 커져 28경기 36승 같은 기록이 나왔다. 이제 승+패 ≤ 선발 등판.
      const ipg = IP(s) / s.GS, q = Math.pow(lgERA / era, 0.9);
      const share = clamp(wp * q / (wp * q + (1 - wp) / q), 0.12, 0.9), dec = clamp(0.58 + (ipg - 5.5) * 0.1, 0.45, 0.85);
      const gs = Math.round(s.GS), nd = gs * dec;
      s.W = clamp(Math.round(nd * share + R.tri() * 1.5), 0, gs);
      s.L = clamp(Math.round(nd * (1 - share) + R.tri() * 1.5), 0, gs - s.W);
      // 완투·완봉: 경기당 이닝이 길고 평균자책이 낮을수록
      const cgP = clamp((ipg - 5.7) * 0.04, 0, 0.12), shoP = clamp(0.3 * lgERA / era, 0.05, 0.6);
      s.CG = 0; s.SHO = 0;
      for (let i = 0; i < Math.round(s.GS); i++) if (R() < cgP) { s.CG++; if (R() < shoP) s.SHO++; }
    } else { s.W = 0; s.L = 0; }
    // 43차: 불펜으로 던진 구간(마무리·필승조·추격조·롱릴리프)만큼 구원승·구원패 — 선발과 불펜을 오간 시즌도 둘 다 쌓인다
    const relief = ((acc.cl || 0) + (acc.su || 0) + (acc.mr || 0) + (acc.lr || 0)) / 3;
    if (relief > 0) { s.W += Math.round(relief * R.range(0, 5.5)); s.L += Math.round(relief * R.range(0, 5.5)); }
    // 15차: 평균자책이 나쁠수록 블론이 크게 늘고 세이브 기회도 줄어든다 (ERA 5 마무리가 30세이브 하던 문제)
    // 20차: 더 조임 — ERA 4.5 이상 마무리는 세이브 기회 자체도 줄어든다 (감독이 중요한 상황에 덜 씀)
    const blown = clamp(0.04 + (era - 2.2) * 0.12, 0.03, 0.6);
    const trustCL = clamp(1 - (era - 3.6) * 0.18, 0.45, 1);
    // 43차: 구간별 보직(마무리 CL·필승조 SU·추격조 MR)에 따라 세이브와 홀드를 함께 쌓는다.
    //   마무리도 동점·1점 차 8회에 나와 홀드를 가끔, 필승조도 마무리가 쉬는 날 세이브를 가끔, 추격조도 홀드를 조금 올린다.
    //   (예전엔 마무리→필승조로 바뀌어도 필승조가 아닌 추격조로 밀리면 홀드가 0이었다)
    const H = BAL.relief, mr = acc.mr || 0, lr = acc.lr || 0;
    const sv = wins * ((acc.cl || 0) / 3 * 0.42 * trustCL + (acc.su || 0) / 3 * H.suSV + (mr + lr) / 3 * H.mrSV);
    const hld = wins * ((acc.cl || 0) / 3 * H.clHLD + (acc.su || 0) / 3 * 0.35 + mr / 3 * H.mrHLD + lr / 3 * H.lrHLD);
    s.SV = Math.round(sv * (1 - blown) * R.range(0.9, 1.08));
    s.HLD = Math.round(hld * (1 - blown) * R.range(0.85, 1.15));
  }

  // ---------- 내 선수 프로 시즌 ----------
  function proPrep(st) {
    const me = st.me;
    // 4차: 시즌 컨디션(커리어 하이 / 부진). 평균 0이라 통산은 거의 그대로, 전성기 한두 해가 MVP급으로 튄다
    me.form = clamp(R.gauss() * BAL.meFormSD, -2 * BAL.meFormSD, 2 * BAL.meFormSD);
    const m = {
      season: { bat1: emptyBat(), pit1: emptyPit(), bat2: emptyBat(), pit2: emptyPit() },
      pacc: { cl: 0, su: 0 }, segs: [], miss: [0, 0, 0], segRole: {}, batPos: me.role === 'B' ? me.pos : 'DH', rehab: -1,
    };
    // 사전 부상 (전환점 결과)
    const f = me.flags;
    if (f.outSeason) { m.miss = [1, 1, 1]; delete f.outSeason; m.preNote = '재활로 시즌 전체를 쉬었다.'; }
    else if (f.missSegs) { for (let i = 0; i < f.missSegs; i++) m.miss[i] = 1; m.rehab = f.missSegs; delete f.missSegs; m.preNote = '재활로 시즌 초반을 쉬었다.'; }
    return m;
  }
  function injuryChance(st) {
    const me = st.me;
    let p = BAL.injSeg[me.role];
    if (me.age >= 33) p += 0.012;
    if (me.twoWay) p *= 1.5;
    p -= me.care * 0.003;
    if (me.role === 'B' && me.dur < 50) p += 0.01;
    if (me.flags.injRisk) p += me.flags.injRisk / 3;
    if (me.pos === 'RP') p *= 0.8;
    return clamp(p, 0.01, 0.2);
  }
  function meSegStart(st, m, seg, team) {
    const me = st.me;
    m.segRole = {};
    // 부상 판정
    if (m.miss[seg] < 1 && R.chance(injuryChance(st))) {
      const u = R();
      if (u < 0.70) { m.miss[seg] = Math.max(m.miss[seg], 0.5); m.injText = m.injText || '경미한 부상으로 잠시 이탈'; }
      else if (u < 0.92) { m.miss[seg] = 1; if (seg < 2) m.miss[seg + 1] = Math.max(m.miss[seg + 1], 0.5); m.rehab = seg + 2; m.injText = '중상으로 두 달 가까이 이탈'; }
      else {
        for (let i = seg; i < 3; i++) m.miss[i] = 1;
        me.bigInj++;
        if (me.role === 'P' || me.twoWay && R.chance(0.5)) { m.injText = '팔꿈치 인대 손상 — 시즌 아웃'; me.flags.tjPending = true; }
        else { m.injText = '무릎 부상 — 시즌 아웃'; me.dur = Math.max(20, me.dur - 15); }
      }
    }
    if (m.miss[seg] >= 1) { m.segs[seg] = 'I'; return null; }
    const e = effR(me, seg === 0 && me.flags.slowStart ? -4 : 0);
    const group = GROUP[me.pos];
    const myO = myVal(me, e) + trustB(me) + (seg === 0 && me.flags.camp ? 3 : 0);
    const low = groupLowest(st, team, group);
    let lvl = me.lvl;
    const prev = m.segs[seg - 1];
    if (m.rehab === seg) lvl = 2;
    else if (lvl === 2) {
      const last = m.lastSeg;
      let good = false;
      if (last && last.lvl === 2) {
        if (last.bat && last.bat.PA >= 60 && OPS(last.bat) >= 0.900) good = true;
        if (last.pit && last.pit.outs >= 45 && ERA(last.pit) <= 2.50) good = true;
      }
      // 13차: 해외(특히 미국)는 승격 문턱이 더 높다
      const young = me.lvPen && me.age < 22;
      const bar = me.lvPen ? me.lvPen + 2 + (young ? 6 : 0) : 0;
      if (myO >= low + bar || (good && !young) || R.chance(me.lvPen ? 0.02 : 0.06)) lvl = 1;
    } else {
      const last = m.lastSeg;
      let bad = false;
      if (last && last.lvl === 1) {
        // 14차: 수비가 좋으면 타격 부진을 더 오래 참아준다
        if (last.bat && last.bat.PA >= 80 && OPS(last.bat) < (me.r.def >= 65 && GROUP[me.pos] !== 'DH' && me.pos !== '1B' ? 0.540 : 0.600) && me.role === 'B') bad = true;
        if (last.pit && last.pit.outs >= 60 && ERA(last.pit) > 6.50 && me.role === 'P') bad = true;
      }
      if (seg === 0 && myO < low - 4) bad = true;
      if (bad) lvl = 2;
    }
    if (lvl === 1 && me.lvl === 2 && seg > 0 && prev !== 'I') m.callup = m.callup || seg;
    if (lvl === 2 && me.lvl === 1 && seg > 0) m.demote = seg;
    me.lvl = lvl;
    if (lvl === 2) { m.segs[seg] = 'F'; return null; }
    if (me.debut == null) { me.debut = st.year; m.debutNow = true; }
    // 1군 엔트리
    const meE = {};
    const ub = me.everStarter ? 0 : (me.role === 'P' && !me.twoWay && me.pos === 'SP' ? BAL.unprovenBiasSP : BAL.unprovenBias);
    const ovrB = (me.role === 'B' ? myO : myOppVal(me, e) + trustB(me)) - ub;
    // 7차: 타자 출신 이도류도 체력이 되면 선발 겸업 (예전엔 불펜 고정이라 이닝이 모자랐다)
    const twSP = me.role === 'B' && me.twoWay && e.sta >= BAL.twoWay.spSta;
    // 37차: 구단 투수진은 선발 5·불펜 3명뿐이라 5선발만 넘으면 로테이션이었다 → 6·7선발 후보와의 경쟁만큼 문턱(spRotBar, 불펜 마무리는 rpClBar)
    const pBar = me.role === 'P' && !me.twoWay ? (me.pos === 'SP' ? BAL.spRotBar : BAL.rpClBar) : 0;
    const ovrP = (me.role === 'P' ? myO : (twSP ? valAt(e, 'SP') : myOppVal(me, e)) + trustB(me)) - ub - pBar;
    if (me.role === 'B' || me.twoWay) meE.bat = { pos: me.role === 'B' ? me.pos : 'DH', r: e, ovr: ovrB, displace: me.role === 'B' };
    if (me.role === 'P' || me.twoWay) meE.pit = { pos: me.role === 'P' ? me.pos : (twSP ? 'SP' : 'RP'), r: e, ovr: ovrP, displace: me.role === 'P', cl: me.role === 'P' && me.pos === 'RP' && !!me.flags.closer && !(m.lastSeg && m.lastSeg.pit && m.lastSeg.pit.outs >= 15 && ERA(m.lastSeg.pit) > 4.5),
      spPromise: me.role === 'P' && me.pos === 'SP' && me.flags.spPromise === st.year };
    m.e = e;
    return meE;
  }
  function meSegPlay(st, m, seg, team) {
    const me = st.me;
    const frac = 1 - m.miss[seg];
    const segLine = { lvl: me.lvl, bat: null, pit: null };
    if (m.segs[seg] === 'I') { m.lastSeg = segLine; return; }
    const e = m.e || effR(me);
    const penalty = seg === 0 && me.flags.slowStart ? -4 : 0;
    const er = penalty ? effR(me, penalty) : e;
    if (me.lvl === 2) {
      m.segs[seg] = 'F';
      // 13차: 해외 2군·마이너는 리그 수준 벌점의 70%를 돌려준다 (마이너에서는 상대 수준도 낮다)
      const erF = me.lvPen ? effR(me, (penalty || 0) + me.lvPen * 0.7) : er;
      if (me.role === 'B' || me.twoWay) {
        const p = batRates(erF, 7); const s = finishBat(simBat(p, Math.round(130 * frac * (me.role === 'B' ? 1 : 0.6))), p, 1, 1, 1);
        addLine(m.season.bat2, s); segLine.bat = s;
      }
      if (me.role === 'P' || me.twoWay) {
        const p = pitRates(erF, 7);
        const outs = me.pos === 'SP' || me.role === 'B' ? Math.round((me.role === 'P' ? 8 : 3) * frac * p.ipS * 3) : Math.round(15 * 3 * frac);
        const s = simPitch(p, outs, 1 + (p.men - 1) * 0.4); s.G = me.pos === 'SP' ? Math.round(8 * frac) : Math.round(outs / 3);
        s.GS = me.pos === 'SP' ? s.G : 0;
        addLine(m.season.pit2, s); segLine.pit = s;
      }
      m.lastSeg = segLine;
      return;
    }
    const br = m.segRole.bat, pr = m.segRole.pit;
    let starterSeg = false;
    if (br) {
      const p = batRates(er, 0);
      let pa;
      if (br.kind === 'S') { pa = SLOTPA[br.order] / 3 * frac; if (me.twoWay && me.role === 'P') pa *= 0.7; starterSeg = true; m.batPos = br.slot === 'DH' ? 'DH' : (me.role === 'B' ? me.pos : 'DH'); }
      else pa = BAL.benchPA * frac * (me.flags.utility ? 1.4 : 1) * (me.twoWay && me.role === 'P' ? 0.5 : 1);
      pa *= GF;
      const rm = br.kind === 'S' ? RUNM[br.order] : 0.95, bm = br.kind === 'S' ? RBIM[br.order] : 0.9;
      const s = finishBat(simBat(p, Math.round(pa)), p, 1, rm, bm);
      addLine(m.season.bat1, s); segLine.bat = s;
    }
    if (pr) {
      const p = pitRates(er, 0);
      const rs = 1 + (p.men - 1) * 0.4;
      let s;
      if (pr.kind === 'SP') {
        const gs = Math.round(spGS(GF) / 3 * frac * (me.twoWay && me.role === 'P' ? 0.8 : me.twoWay ? BAL.twoWay.batGS : 1) * R.range(0.95, 1.05));
        s = simPitch(p, Math.round(gs * p.ipS * 3 * R.range(0.92, 1.08)), rs); s.GS = gs; s.G = gs;
        if (me.role === 'P') starterSeg = true;
      } else {
        const ip = (pr.kind === 'MR' || pr.kind === 'LR' ? 16 : 20) * GF * frac * (me.twoWay && me.role === 'B' ? BAL.twoWay.batIP : 1);
        s = simPitch(p, Math.round(ip * 3), rs); s.G = Math.round(ip * 1.05);
        if (pr.kind === 'CL') m.pacc.cl++;
        if (pr.kind === 'SU') m.pacc.su++;
        if (pr.kind === 'MR') m.pacc.mr = (m.pacc.mr || 0) + 1;   // 43차: 추격조도 홀드를 조금
        if (pr.kind === 'LR') m.pacc.lr = (m.pacc.lr || 0) + 1;   // 43차: 로테이션에서 밀린 선발(롱릴리프)도 불펜 기록
        // 8차: 불펜은 마무리만 '주전'으로 친다 (셋업까지 치면 프로 투수 100%가 주전 도달)
        if (me.role === 'P' && pr.kind === 'CL') starterSeg = true;
      }
      addLine(m.season.pit1, s); segLine.pit = s;
      m.pitRole = pr.kind;
    }
    m.segs[seg] = starterSeg ? 'S' : 'B';
    m.lastSeg = segLine;
  }

  // ---------- 포스트시즌 ----------
  function postseason(st, stand, mine, cfgIn) {
    const me = st.me;
    const cfg = cfgIn || LCFG.KBO;
    const str = id => stand.find(s => s.id === id).pct;
    const played = {};
    stand.forEach(s => { played[s.id] = 0; });
    const log = [];
    // 화면용 경기 점수는 별도 난수로 만든다 (본 시뮬레이션 난수 흐름에 영향 없음)
    const disp = makeRng({ s: (st.seed ^ Math.imul(st.year, 2654435761)) >>> 0 });
    function gameScore() {
      const w = Math.max(1, Math.round(4.2 + disp.gauss() * 2.4));
      const l = Math.max(0, Math.min(w - 1, Math.round(w - 1 - Math.abs(disp.gauss()) * 2.5)));
      return [w, l];
    }
    function series(hi, lo, need, hiStart) {
      let a = hiStart || 0, b = 0, g = 0;
      const games = [];
      while (a < need && b < need) {
        g++;
        const p = clamp(log5(str(hi), str(lo)) + 0.015, 0.2, 0.8);
        const hiWin = R() < p;
        if (hiWin) a++; else b++;
        games.push({ win: hiWin ? hi : lo, runs: gameScore() });
      }
      played[hi] += g; played[lo] += g;
      const ha = a - (hiStart || 0), hiWon = a >= need;
      return { hi, lo, need, adv: hiStart || 0, games, win: hiWon ? hi : lo, lose: hiWon ? lo : hi, score: hiWon ? `${ha}-${b}` : `${b}-${ha}`, g };
    }
    // seedOf: 화면에 쓸 시드 표기 (양대 리그면 리그 내 순위)
    const seedOf = id => { const s = stand.find(x => x.id === id); return cfg.two ? s.subRank : s.rank; };
    const add = (name, sr, sub) => { const r = { name, sub: sub || null, hiSeed: seedOf(sr.hi), loSeed: seedOf(sr.lo), needTxt: `${sr.need}선승${sr.adv ? ` · 상위팀 ${sr.adv}승 안고 시작` : ''}`, ...sr }; log.push(r); return r; };
    let fin, seeds;
    if (cfg.ps === 'kbo') {
      const seed = stand.slice(0, 5);
      const wc = add('와일드카드 결정전', series(seed[3].id, seed[4].id, 2, 1));
      const sp = add('준플레이오프', series(seed[2].id, wc.win, 3));
      const po = add('플레이오프', series(seed[1].id, sp.win, 3));
      fin = add('한국시리즈', series(seed[0].id, po.win, 4));
      seeds = seed.map(s => s.id);
    } else if (cfg.ps === 'npb') {
      // 클라이맥스 시리즈: 2위 vs 3위(2선승) → 1위(1승 어드밴티지) vs 승자(4선승) → 재팬시리즈
      const sub = cfg.two.map(sn => stand.filter(s => s.sub === sn).slice(0, 3));
      const f1 = sub.map((sd, i) => add(`${cfg.two[i]} CS 퍼스트`, series(sd[1].id, sd[2].id, 2), cfg.two[i]));
      const f2 = sub.map((sd, i) => add(`${cfg.two[i]} CS 파이널`, series(sd[0].id, f1[i].win, 4, 1), cfg.two[i]));
      const [a, b] = [f2[0].win, f2[1].win].sort((x, y) => str(y) - str(x));
      fin = add('재팬시리즈', series(a, b, 4));
      seeds = sub.flat().map(s => s.id);
    } else {
      // MLB: 리그별 6팀. 와일드카드(3v6, 4v5, 2선승) → 디비전(1·2번 시드, 3선승) → 챔피언십(4선승) → 월드시리즈
      const sub = cfg.two.map(sn => stand.filter(s => s.sub === sn).slice(0, 6));
      const ab = ['AL', 'NL'];
      const wc = sub.map((sd, i) => [add(`${ab[i]} 와일드카드 (3·6위)`, series(sd[2].id, sd[5].id, 2), cfg.two[i]), add(`${ab[i]} 와일드카드 (4·5위)`, series(sd[3].id, sd[4].id, 2), cfg.two[i])]);
      const ds = sub.map((sd, i) => [add(`${ab[i]} 디비전시리즈 1`, series(sd[0].id, wc[i][1].win, 3), cfg.two[i]), add(`${ab[i]} 디비전시리즈 2`, series(sd[1].id, wc[i][0].win, 3), cfg.two[i])]);
      const cs = sub.map((sd, i) => { const [x, y] = [ds[i][0].win, ds[i][1].win].sort((p, q) => str(q) - str(p)); return add(`${ab[i]} 챔피언십시리즈`, series(x, y, 4), cfg.two[i]); });
      const [a, b] = [cs[0].win, cs[1].win].sort((x, y) => str(y) - str(x));
      fin = add('월드시리즈', series(a, b, 4));
      seeds = sub.flat().map(s => s.id);
    }
    const ks = fin;
    const out = { rounds: log, champion: ks.win, runnerUp: ks.lose, ksGames: ks.g, seeds, champName: cfg.champ };
    // 내 선수 포스트시즌 — 시리즈마다 따로 시뮬레이션
    if (mine && played[me.team] > 0 && me.lvl === 1 && mine.segs[2] !== 'I' && mine.segs[2]) {
      const e = effR(me);
      const men = pitRates(e).men;
      const line = { bat: null, pit: null, g: played[me.team], series: [] };
      const batter = mine.segRole.bat || me.role === 'B', pitcher = mine.segRole.pit || me.role === 'P';
      const role = mine.pitRole || (me.pos === 'SP' ? 'SP' : 'CL');
      for (let ri = 0; ri < log.length; ri++) {
        const r = log[ri];
        if (r.win !== me.team && r.lose !== me.team) continue;
        const g = r.g;
        const sl = { round: ri, name: r.name, won: r.win === me.team, bat: null, pit: null };
        if (batter) {
          const p = batRates(e);
          const pa = Math.round(g * (mine.segs[2] === 'S' || (me.twoWay && me.role === 'P') ? 4.3 : 1.2) * (me.twoWay && me.role === 'P' ? 0.7 : 1));
          sl.bat = finishBat(simBat(p, pa, 2 - men), p, 1, 1.05, 1.1);
          sl.bat.G = g;
        }
        if (pitcher) {
          const p = pitRates(e);
          let s;
          if (role === 'SP') { const gs = Math.max(1, Math.round(g / 4.5)); s = simPitch(p, Math.round(gs * p.ipS * 3), men); s.GS = gs; s.G = gs; s.W = 0; for (let i = 0; i < gs; i++) if (R() < 0.45 + (4.18 - Math.min(8, ERA(s) || 4)) * 0.04) s.W++; }
          else { const ip = Math.max(1, Math.round(g * 0.45)); s = simPitch(p, ip * 3, men); s.G = Math.max(1, Math.round(g * 0.5)); s.W = R.chance(0.3) ? 1 : 0; s.SV = role === 'CL' ? R.int(0, Math.ceil(g / 3)) : 0; }
          sl.pit = s;
        }
        line.series.push(sl);
        if (sl.bat) { line.bat = line.bat || emptyBat(); addLine(line.bat, sl.bat); }
        if (sl.pit) { line.pit = line.pit || emptyPit(); addLine(line.pit, sl.pit); }
      }
      const myRounds = log.filter(r => r.win === me.team || r.lose === me.team);
      line.result = myRounds.length ? (out.champion === me.team ? `${cfg.champ} 우승` : myRounds[myRounds.length - 1].name + ' 탈락') : '';
      // 우승 시리즈 MVP — 마지막 시리즈 성적으로
      if (out.champion === me.team) {
        const ksl = line.series.find(s => s.round === log.length - 1) || {};
        const g = ks.g;
        let score = 0;
        if (ksl.bat && ksl.bat.PA) score = Math.max(score, OPS(ksl.bat) * (ksl.bat.PA >= g * 3 ? 1 : 0.6));
        if (ksl.pit && ksl.pit.outs) score = Math.max(score, 0.55 + 0.4 * (ksl.pit.W || 0) + Math.max(0, 3 - ERA(ksl.pit)) * 0.12 + (ksl.pit.SV || 0) * 0.15);
        const rival = 0.95 + R() * 0.45;
        line.ksMVP = score > rival;
      }
      out.me = line;
    }
    return out;
  }

  // ---------- 수상 ----------
  function awards(entries, stand, post) {
    const rankOf = id => (stand.find(s => s.id === id) || { rank: 9 }).rank;
    const best = (arr, f) => { let b = null, bv = -1e9; for (const x of arr) { const v = f(x); if (v > bv) { bv = v; b = x; } } return b; };
    const bats = entries.filter(e => e.bat && e.bat.PA);
    const pits = entries.filter(e => e.pit && e.pit.outs);
    const qB = bats.filter(e => e.bat.PA >= 446 * GF), qP = pits.filter(e => e.pit.outs >= 432 * GF);
    const titles = {
      '타격왕': best(qB, e => AVG(e.bat)), '홈런왕': best(bats, e => e.bat.HR), '타점왕': best(bats, e => e.bat.RBI),
      '다승왕': best(pits, e => e.pit.W), '평균자책점왕': best(qP, e => -ERA(e.pit)), '세이브왕': best(pits, e => e.pit.SV || 0),
      // 52차: 탈삼진왕·도루왕
      '탈삼진왕': best(pits, e => e.pit.K || 0), '도루왕': best(bats, e => e.bat.SB || 0),
    };
    const titleCount = {};
    for (const k in titles) if (titles[k]) titleCount[titles[k].id] = (titleCount[titles[k].id] || 0) + 1;
    const gg = {};
    // 14차: 골든글러브는 수비 기여를 크게 반영 (지명타자는 공격만)
    const ggS = e => e.war + (e.def ? e.def.DEF * 0.25 : 0);
    for (const pos of ['C', '1B', '2B', '3B', 'SS', 'DH']) gg[pos] = [best(bats.filter(e => e.pos === pos), ggS)];
    gg.OF = bats.filter(e => e.pos === 'OF').sort((a, b) => ggS(b) - ggS(a)).slice(0, 3);
    gg.P = [best(pits, e => e.war)];
    const V = BAL.mvpVote;
    const mvp = best(entries, e => {
      const rk = rankOf(e.team);
      let s = e.war / BAL.warScale + (titleCount[e.id] || 0) * V.title + (rk === 1 ? V.top1 : rk <= 3 ? V.top3 : 0) + R.gauss() * V.noise;
      if (e.me) s += clamp((e.pop || 0) * V.popPer, 0, V.popMax);   // 화제성(인기) — 다른 선수는 기본값 0
      return s;
    });
    const roy = best(entries.filter(e => e.rookie), e => e.war);
    // 52차: 올해의 투수상 — 리그(KBO·일본·미국)마다 그해 최고 투수 1명 (WAR + 투수 타이틀)
    const poy = best(qP.length ? qP.concat(pits.filter(e => (e.pit.SV || 0) >= 30)) : pits, e => e.war + ['다승왕', '평균자책점왕', '탈삼진왕', '세이브왕'].filter(k => titles[k] === e).length * 0.6);
    return { titles, gg, mvp, roy, poy };
  }
  // 10차: 기록실·구단 기록용 선수별 시즌 기록 (리그마다 1벌만 저장, 순위는 화면에서 계산)
  function statRows(st, entries, L) {
    const cfg = cfgOf(L), G = cfg.games;
    const bat = [], pit = [];
    let lgHR = 0, lgBB = 0, lgK = 0, lgER = 0, lgOuts = 0;
    for (const e of entries) if (e.pit && e.pit.outs) { const s = e.pit; lgHR += s.HR; lgBB += s.BB; lgK += s.K; lgER += s.ER; lgOuts += s.outs; }
    const lgIP = lgOuts / 3 || 1, lgERA = lgER * 9 / lgIP;
    const cFIP = lgERA - (13 * lgHR + 3 * lgBB - 2 * lgK) / lgIP;
    for (const e of entries) {
      const base = { n: e.name, t: e.team, pos: e.pos, age: e.age, war: Math.round((e.war || 0) * 10) / 10 };
      if (e.me) base.me = 1; if (e.ovr != null) base.ovr = e.ovr; if (e.foreign) base.f = 1;
      if (e.bat && e.bat.PA) { const b = e.bat; bat.push(Object.assign({}, base, { G: Math.min(G, b.G || Math.round(b.PA / 4.1)), PA: Math.round(b.PA), AB: Math.round(b.AB), H: Math.round(b.H), D: Math.round(b.D), T: Math.round(b.T), HR: Math.round(b.HR), BB: Math.round(b.BB), K: Math.round(b.K), SB: Math.round(b.SB || 0), R: Math.round(b.R || 0), RBI: Math.round(b.RBI || 0) }, e.def ? { CH: e.def.CH, E: e.def.E, DEF: e.def.DEF } : {})); }
      if (e.pit && e.pit.outs) { const s = e.pit; pit.push(Object.assign({}, base, { G: Math.round(s.G || 0), GS: Math.round(s.GS || 0), outs: Math.round(s.outs), BF: Math.round(s.BF || 0), H: Math.round(s.H), HR: Math.round(s.HR), BB: Math.round(s.BB), K: Math.round(s.K), ER: Math.round(s.ER), W: s.W || 0, L: s.L || 0, SV: s.SV || 0, HLD: s.HLD || 0, CG: s.CG || 0, SHO: s.SHO || 0 })); }
    }
    return { year: st.year, games: G, cFIP: Math.round(cFIP * 100) / 100, bat, pit };
  }
  function buildLeaders(entries) {
    const top = (arr, f, asc) => arr.map(e => ({ id: e.id, name: e.name, team: e.team, v: f(e), me: !!e.me })).sort((a, b) => asc ? a.v - b.v : b.v - a.v).slice(0, 30);
    const bats = entries.filter(e => e.bat && e.bat.PA), pits = entries.filter(e => e.pit && e.pit.outs);
    const qB = bats.filter(e => e.bat.PA >= 446 * GF), qP = pits.filter(e => e.pit.outs >= 432 * GF);
    return {
      AVG: top(qB, e => AVG(e.bat)), HR: top(bats, e => e.bat.HR), RBI: top(bats, e => e.bat.RBI), SB: top(bats, e => e.bat.SB), OPS: top(qB, e => OPS(e.bat)),
      W: top(pits, e => e.pit.W), ERA: top(qP, e => ERA(e.pit), true), SV: top(pits, e => e.pit.SV || 0), K: top(pits, e => e.pit.K), WAR: top(entries, e => e.war),
    };
  }

  // ---------- 프로 시즌 마무리 (내 선수 결과 정리) ----------
  // 62차: 2군 이름은 리그마다 — KBO 2군(퓨처스), 메이저리그 2군(마이너), 일본 2군
  function minorLabel(st) { const c = cfgOf(st.lg) || {}; return c.id === 'MLB' ? '2군(마이너)' : c.id === 'NPB' ? '2군' : '2군(퓨처스)'; }
  function proFinish(st, res, m, stand, post, aw, leaders, myWAR) {
    const me = st.me, car = st.car;
    res.minor = minorLabel(st);
    const team = teamById(st, me.team);
    const ts = stand.find(s => s.id === me.team);
    res.team = { name: team.name, record: `${ts.wins}승 ${ts.losses}패 · ${ts.rank}위`, tourn: [] };
    const b1 = m.season.bat1, p1 = m.season.pit1, b2 = m.season.bat2, p2 = m.season.pit2;
    // 41차: 경기 수 상한은 리그 경기 수 기준 (메이저리그 162경기인데 144로 잘리던 문제)
    const gms = (cfgOf(st.lg) || {}).games || 144, pgMax = Math.round(80 * gms / 144);
    b1.G = Math.min(gms, b1.G); b2.G = Math.min(gms, b2.G); p1.G = Math.min(pgMax, p1.G); p2.G = Math.min(pgMax, p2.G);
    if (b1.PA) res.bat = b1;
    if (p1.outs) res.pit = p1;
    if (b2.PA) res.futBat = b2;
    if (p2.outs) res.futPit = p2;
    res.war = myWAR; res.warB = m.warB; res.warP = m.warP; res.def = m.def || null;
    res.segs = m.segs.slice();
    // 한 줄 출전 요약
    const MON = ['4월', '6월', '8월'];
    const parts = [];
    const firstSeg = m.segs.findIndex(s => s === 'S' || s === 'B');
    if (m.segs.every(s => s === 'I')) parts.push('부상으로 시즌 전체 결장');
    else if (m.segs.every(s => s === 'F' || s === 'I')) parts.push(`시즌 내내 ${minorLabel(st)}`);
    else {
      if (firstSeg > 0) parts.push(`${MON[firstSeg]} 1군 콜업`);
      else parts.push('개막 1군');
      const sIdx = m.segs.indexOf('S');
      // 25차: 투수 보직 표시는 시즌 전체 기준 (불펜이 마무리를 잃었을 때 '선발 로테이션'으로 잘못 나오던 문제)
      const sLbl = me.role === 'P' && !me.twoWay ? (me.pos === 'SP' && (m.pitRole === 'SP' || m.pacc.cl === 0) ? '선발 로테이션' : m.pacc.cl >= 3 ? '마무리' : m.pacc.cl >= 1 ? '마무리 → 필승조' : '선발 로테이션') : '주전';
      if (sIdx >= 0) parts.push(sIdx === firstSeg ? sLbl : `${MON[sIdx]}부터 ${sLbl}`);
      else parts.push(me.role === 'P' ? (m.pacc.su ? '필승조 셋업' : '추격조') : '백업');
      if (m.demote) parts.push(`${MON[m.demote]} 2군 강등`);
    }
    if (m.injText) parts.push(m.injText);
    if (m.preNote) parts.unshift(m.preNote);
    res.statusText = parts.join(' · ');
    if (m.debutNow) story(st, `${st.year}년, ${team.name} 유니폼을 입고 1군 데뷔.`);
    const segs1 = m.segs.filter(s => s === 'S' || s === 'B').length;
    const segsS = m.segs.filter(s => s === 'S').length;
    if (segsS >= BAL.starterSegs) { if (!me.everStarter) story(st, `${me.age}세, 1군 주전으로 한 시즌을 버텼다.`); me.everStarter = true; }
    if (segs1 >= 2) me.svc++;
    me.noFirst = segs1 < 1 ? me.noFirst + 1 : 0;
    res.playCoef = m.segs.reduce((a, s) => a + BAL.playCoef[s === 'S' ? 'S' : s === 'B' ? 'B' : s === 'F' ? 'F' : 'I'], 0) / 3;
    if (m.injText) res.notes.push(m.injText);
    // 통산
    addLine(car.bat, b1); addLine(car.pit, p1);
    car.war += myWAR; car.warB += m.warB; car.warP += m.warP;
    if (me.twoWay && m.warB >= BAL.twoWay.okWAR && m.warP >= BAL.twoWay.okWAR) { car.twoWaySeasons++; me.everTwoWaySuccess = true; res.awards.push(`이도류 시즌 (타자·투수 WAR ${BAL.twoWay.okWAR}+)`); }
    // 수상
    const isMe = x => x && x.id === 'me';
    const lgId = cfgOf(st.lg).id;
    for (const k in aw.titles) if (isMe(aw.titles[k])) { res.awards.push(k); car.aw.TITLE++; car.awList.push(`${st.year} ${k}`); addAch(st, 'TITLE', lgId); }
    for (const pos in aw.gg) if (aw.gg[pos].some(isMe)) { res.awards.push('골든글러브'); car.aw.GG++; car.awList.push(`${st.year} 골든글러브`); addAch(st, 'GG', lgId); }
    if (isMe(aw.mvp)) { res.awards.push('정규시즌 MVP'); car.aw.MVP++; car.awList.push(`${st.year} MVP`); addAch(st, 'MVP', lgId); story(st, `${st.year}년, 리그 MVP. 이 해만큼은 리그가 내 것이었다.`); }
    if (isMe(aw.poy)) { res.awards.push('올해의 투수상'); car.aw.POY = (car.aw.POY || 0) + 1; car.awList.push(`${st.year} 올해의 투수상`); addAch(st, 'POY', lgId); story(st, `${st.year}년, 올해의 투수상. 리그에서 가장 위력적인 투수로 인정받았다.`); }
    if (me.twoWay && m.warB >= BAL.twoWay.okWAR && m.warP >= BAL.twoWay.okWAR) addAch(st, 'TW', lgId);
    // 화제성: 성적으로 쌓이고 해마다 조금씩 식는다 (MVP 투표·이벤트 조건에 쓰임)
    const myTitles = Object.values(aw.titles).filter(isMe).length;
    me.pop = Math.round(me.pop * BAL.popDecay + clamp(myWAR / BAL.warScale, -2, 8) * BAL.popPerWAR + myTitles * BAL.popPerTitle);
    if (isMe(aw.roy)) { res.awards.push('신인왕'); car.aw.ROY++; car.awList.push(`${st.year} 신인왕`); addAch(st, 'ROY', lgId); story(st, `${st.year}년 신인왕.`); }
    // 포스트시즌
    res.post = post;
    if (post.me) {
      res.psLine = post.me;
      if (post.me.bat) addLine(car.ps.bat, post.me.bat);
      if (post.me.pit) addLine(car.ps.pit, post.me.pit);
      const cn = post.champName || '한국시리즈';
      if (post.champion === me.team) { car.aw.KS++; addAch(st, lgId === 'MLB' ? 'WS' : lgId === 'NPB' ? 'JS' : 'KS', null); res.awards.push(`${cn} 우승`); car.awList.push(`${st.year} ${cn} 우승`); story(st, `${st.year}년, ${team.name}의 ${cn} 우승 멤버가 됐다.`); car.titles = (car.titles || []).concat([{ year: st.year, team: team.name, lg: cfgOf(st.lg).short, name: cn }]); }
      if (post.me.ksMVP) { car.aw.KSMVP++; addAch(st, 'SMVP', lgId); res.awards.push(`${cn} MVP`); car.awList.push(`${st.year} ${cn} MVP`); story(st, `${st.year}년 ${cn} MVP. 마지막 아웃카운트를 잊지 못한다.`); }
    }
    // 마일스톤
    const tot = { H: car.bat.H, HR: car.bat.HR, W: car.pit.W, SV: car.pit.SV, PK: car.pit.K };
    for (const msd of MILESTONES) {
      const [k, n, name] = msd;
      if (tot[k] >= n && car.ms.indexOf(name) < 0) { car.ms.push(name); res.ms.push(name); if (msd[3] > 0) addAch(st, msd[3] >= 40 ? 'MS2' : 'MS1', lgId); if (msd[3] > 0) story(st, `${me.age}세, 통산 ${name} 달성.`); }
    }
    // 리그 순위 한 줄
    res.leaderLine = leaderLine(leaders, me);
    res.rivalLine = rivalLine(st, res);
    res.news = fanNews(st, res);
    peakScene(st, res, myWAR, segs1);
    // 히스토리
    // 62차: 부상으로 시즌을 통째로 날리면 기록표에 0으로 남긴다 (예전엔 그 해가 기록표에서 빠졌다)
    const injAll = m.segs.every(s => s === 'I') && !b1.PA && !p1.outs && !b2.PA && !p2.outs;
    const zB = injAll && (me.role === 'B' || me.twoWay) ? emptyBat() : null, zP = injAll && (me.role === 'P' || me.twoWay) ? emptyPit() : null;
    st.hist.push({ year: st.year, age: me.age, team: team.name, teamId: team.id, lg: cfgOf(st.lg).id, pos: me.twoWay ? 'TW' : me.pos, ofPos: me.pos === 'OF' ? me.ofPos || null : undefined, lvl: segs1 >= 1 ? '1군' : '2군', inj: injAll || undefined, def: m.def || null, futBat: b2.PA ? b2 : null, futPit: p2.outs ? p2 : null, psBat: post.me && post.me.bat || null, psPit: post.me && post.me.pit || null, bat: b1.PA ? b1 : (b2.PA ? Object.assign({ fut: true }, b2) : zB), pit: p1.outs ? p1 : (p2.outs ? Object.assign({ fut: true }, p2) : zP), war: myWAR, warB: me.twoWay ? m.warB : undefined, warP: me.twoWay ? m.warP : undefined, note: res.awards.join(', ') });
    me.lastSeason = { war: myWAR, warB: m.warB, warP: m.warP, avg: b1.PA >= 100 ? AVG(b1) : null, ops: b1.PA >= 100 ? OPS(b1) : null, era: p1.outs >= 90 ? ERA(p1) : null, starter: segsS >= 2 || (me.role === 'P' && m.pacc.su >= 2), firstSegs: segs1, injured: !!m.injText, bigInjury: m.segs.filter(s => s === 'I').length >= 2, cl: m.pacc.cl, su: m.pacc.su, gs: p1.GS || 0 };
    // 25차: 시즌 대부분을 마무리로 뛰었다면 이미 마무리 투수로 본다 (결산에서 "마무리 맡아라" 제안이 뒤늦게 나오던 문제)
    if (me.role === 'P' && !me.twoWay && me.pos === 'RP' && m.pacc.cl >= 2 && !me.flags.closer) me.flags.closer = true;
    me.warHist = (me.warHist || []).concat([myWAR]);
    const ovr = myOVR(me);
    if (ovr > car.peak) car.peak = ovr;
    // 이력 플래그 정리
    delete me.flags.slowStart; delete me.flags.camp; delete me.flags.injRisk;
  }
  const MILESTONES = [
    ['H', 100, '100안타', 0], ['H', 500, '500안타', 0], ['H', 1000, '1000안타', 15], ['H', 1500, '1500안타', 0], ['H', 2000, '2000안타', 40],
    ['HR', 100, '100홈런', 0], ['HR', 150, '150홈런', 15], ['HR', 200, '200홈런', 0], ['HR', 300, '300홈런', 40], ['HR', 400, '400홈런', 0],
    ['W', 50, '50승', 0], ['W', 100, '100승', 15], ['W', 150, '150승', 40], ['W', 200, '200승', 0],
    ['SV', 100, '100세이브', 0], ['SV', 150, '150세이브', 15], ['SV', 300, '300세이브', 40],
    ['PK', 1000, '1000탈삼진', 15], ['PK', 2000, '2000탈삼진', 40],
  ];
  function leaderLine(L, me) {
    const cats = me.role === 'B' || me.twoWay ? [['HR', '홈런', v => v + '개', 'diff'], ['AVG', '타율', v => v.toFixed(3).replace(/^0/, ''), 'rate'], ['RBI', '타점', v => v, 'diff'], ['SB', '도루', v => v, 'diff']] : [];
    const pc = me.role === 'P' || me.twoWay ? [['W', '다승', v => v + '승', 'diff'], ['ERA', '평균자책점', v => v.toFixed(2), 'rate'], ['SV', '세이브', v => v, 'diff'], ['K', '탈삼진', v => v, 'diff']] : [];
    let bestTxt = null, bestRank = 99;
    for (const [k, name, fmt] of cats.concat(pc)) {
      const arr = L[k]; const i = arr.findIndex(x => x.me);
      if (i >= 0 && i < bestRank) {
        bestRank = i;
        if (i === 0) bestTxt = `${name} 1위 (${fmt(arr[0].v)}) — ${arr[1] ? `2위 ${josa(arr[1].name, '과', '와')} ${typeof arr[0].v === 'number' && k !== 'AVG' && k !== 'ERA' ? Math.abs(arr[0].v - arr[1].v) + '개 차' : '근소한 차'}` : ''}`;
        else bestTxt = `${name} ${i + 1}위 — 1위 ${josa(arr[0].name, '과', '와')} ${k === 'AVG' || k === 'ERA' ? (fmt(arr[0].v) + ' vs ' + fmt(arr[i].v)) : (Math.abs(arr[0].v - arr[i].v) + ' 차')}`;
      }
    }
    return bestTxt;
  }
  function rivalLine(st, res) {
    const me = st.me, P = st.lg.p;
    let rv = me.rival != null ? P[me.rival] : null;
    if (!rv || rv.retired) {
      const group = me.role === 'P' ? 'P' : GROUP[me.pos];
      const cands = Object.values(P).filter(p => !p.retired && (p.role === 'P' ? 'P' : GROUP[p.pos]) === group && Math.abs(p.age - me.age) <= 3 && p.last);
      if (!cands.length) return null;
      cands.sort((a, b) => b.lastWAR - a.lastWAR);
      rv = cands[0]; me.rival = rv.id;
      story(st, `라이벌 등장: ${teamById(st, rv.team).name}의 ${rv.name}.`);
    }
    if (!rv.last) return null;
    return { name: rv.name, team: teamById(st, rv.team).name, war: rv.lastWAR, line: rv.last.bat ? fmtBatShort(rv.last.bat) : fmtPitShort(rv.last.pit), myWar: res.war };
  }
  function fmtBatShort(s) { return `${rate3(AVG(s))} ${s.H}안타 ${s.HR}홈런 ${s.RBI}타점 OPS ${rate3(OPS(s))}`; }   // 62차: 안타 수 추가
  function fmtPitShort(s) { return `${s.W}승 ${s.L}패 ${s.SV ? s.SV + '세이브 ' : ''}ERA ${ERA(s).toFixed(2)} ${s.K}K`; }
  function rate3(v) { return v.toFixed(3).replace(/^0/, ''); }
  // ---------- 전성기 연출 ----------
  // 전조(전년 겨울) → 각성(첫해) → 전성기 n년차 → 저무는 해(끝난 다음 해). 은퇴 화면에서 기간이 공개된다.
  function peakScene(st, res, war, segs1) {
    const me = st.me, p = me.peak, car = st.car;
    if (!p) return;
    const idx = me.age - p.from;
    const played = segs1 >= 1;
    const best = car.bestWar == null || war > car.bestWar;
    car.bestWar = Math.max(car.bestWar == null ? -99 : car.bestWar, war);
    const rk = ((st._lead || {}).WAR || []).findIndex(x => x.me);
    if (idx === -1) {
      res.peak = { phase: 'omen', title: '겨울의 예감', text: me.role === 'P' ? '마지막 불펜 피칭에서 공이 손끝에 감기는 느낌이 달랐다. 포수가 미트를 내려다보며 고개를 갸웃했다.' : '시즌이 끝난 뒤 배팅 케이지, 공이 유난히 크게 보였다. 이유는 모르겠다.' };
      return;
    }
    if (idx >= 0 && idx < p.len) {
      car.peakYears = (car.peakYears || []).concat([{ age: me.age, war }]);
      const n = idx + 1;
      if (!played) {
        if (idx === 0) res.peak = { phase: 'lost', title: '각성', text: '감각은 인생 최고였다. 그런데 몸이 그라운드에 서지 못했다.' };
        if (idx === 0) story(st, `${me.age}세, 무언가 깨어났지만 그해는 그라운드에 서지 못했다.`);
        return;
      }
      if (idx === 0) {
        res.peak = { phase: 'awaken', title: '각성', text: me.role === 'P' ? '타자들의 배트가 공 밑으로, 위로 지나갔다. 마운드에서 처음으로 "이건 못 친다"는 확신이 들었다.' : '투수가 공을 놓는 순간 구종이 보였다. 모든 게 반 박자 느리게 흘렀다.' };
        res.awards.unshift('각성');
        res.news.unshift(`"${me.name}, 완전히 다른 선수가 됐다" — 스포츠면 1면`);
        story(st, `${me.age}세, 각성. 모든 것이 느리게 보이기 시작했다.`);
      } else if (rk === 0) {
        // 11차: '전성기 n년차' 표시는 없앴다. 리그 WAR 1위일 때만 팬 반응 한 줄
        res.news.unshift(`"지금 리그는 ${me.name}의 시대" — 야구 분석 채널`);
      }
      if (best && war >= WS(8)) { res.awards.push('커리어 하이'); story(st, `${me.age}세, 커리어 하이 시즌. WAR ${war.toFixed(1)}.`); }
      res.news = res.news.slice(0, 2);
      return;
    }
    if (idx === p.len) {
      res.peak = { phase: 'fade', title: '저무는 해', text: '몸은 그대로인데, 공이 미세하게 늦게 보였다. 그 감각은 아마 다시 오지 않을 것이다.' };
      const yrs = car.peakYears || [];
      if (yrs.length) story(st, `${me.age}세, 전성기가 저물기 시작했다. (${yrs[0].age}~${yrs[yrs.length - 1].age}세, WAR 합계 ${yrs.reduce((a, y) => a + y.war, 0).toFixed(1)})`);
    }
  }
  function fanNews(st, res) {
    const me = st.me, n = [];
    const b = res.bat, p = res.pit;
    if (b && b.PA >= 300) {
      const a = AVG(b), o = OPS(b);
      if (a >= 0.330) n.push(`"${me.name} 타율 ${rate3(a)}… 이거 실화냐" — 커뮤니티 인기글`);
      if (b.HR >= 30) n.push(`"${b.HR}홈런 거포 탄생" — 스포츠면 1면`);
      if (o < 0.650) n.push(`"${me.name} 언제 터지냐…" — 팬 게시판`);
    }
    if (p && p.outs >= 150) {
      const e = ERA(p);
      if (e <= 2.8) n.push(`"${me.name} 등판일 = 승리 예약" — 팬 게시판`);
      if (e >= 5.5) n.push(`"${me.name} 또 불쇼…" — 실시간 댓글`);
    }
    if (p && (p.SV || 0) >= 30) n.push(`"뒷문 걱정 끝" — 구단 팬카페`);
    if (res.awards.indexOf('정규시즌 MVP') >= 0) n.push('"올해의 주인공은 단연 이 선수" — 시상식 현장');
    if (!n.length && res.war >= WS(3)) n.push(`"${me.name}, 조용히 제 몫 이상" — 야구 분석 채널`);
    if (!n.length && me.lvl === 2) n.push('"2군에서 칼 가는 중" — 퓨처스 리포트');
    return n.slice(0, 2);
  }

  // ---------- 리그 겨울 ----------
  function leagueWinter(st) {
    const lg = st.lg, P = lg.p;
    for (const t of lg.teams) {
      for (let i = 0; i < t.act.length; i++) {
        const p = P[t.act[i]];
        p.age++;
        const keys = p.role === 'B' ? BAT : PIT;
        for (const k of keys) {
          let d;
          if (p.age <= 26) d = R.range(0.5, 3);
          else if (p.age <= 31) d = R.range(-1, 1);
          else if (p.age <= 34) d = -R.range(0.5, 2.5);
          else d = -R.range(2, 5);
          if ((k === 'spd' || k === 'vel') && p.age >= 30) d -= 0.7;
          p.r[k] = clamp(p.r[k] + d, 20, 97);
        }
        const o = ovrAt(p.r, p.pos);
        if (p.age >= 40 || (p.age >= 34 && o < 46) || (p.age >= 37 && o < 50) || (p.age >= 31 && o < 38)) {
          p.retired = true; delete P[p.id];
          const base = R.range(BAL.rookieBase[0], BAL.rookieBase[1]) + (R.chance(BAL.rookieStarP) ? 15 : 0);
          const np = genOther(st, t.id, p.pos, { base, age: R.int(20, 23), rookie: true, starP: 0 });
          np.debut = st.year + 1;
          t.act[i] = np.id;
          if (st.me.rival === p.id) st.me.rival = null;
        }
      }
    }
  }

  // ================================================================
  // 겨울: 성장·노화·계약·전환점
  // ================================================================
  function winter(st, res) {
    const me = st.me;
    // 성장
    const before = Object.assign({}, me.shown);
    const ovr0 = myOVR(me);
    grow(st, res.playCoef == null ? 0.5 : res.playCoef);
    lateBloom(st, res);
    res.changes = {};
    for (const k of ALL) { const d = Math.round(me.r[k]) - Math.round(before[k]); if (d) res.changes[k] = d; }
    me.shown = Object.assign({}, me.r);
    res.ovr = myOVR(me);
    res.ovrD = Math.round(res.ovr) - Math.round(ovr0);
    // 역대 시즌 기록에 이 해의 요약·능력치 변화를 붙인다
    let h = st.hist[st.hist.length - 1];
    if (!h || h.year !== res.year) { h = { year: res.year, age: res.age, team: res.team ? res.team.name : '', lvl: '-', bat: null, pit: null, war: null, note: res.awards.join(', ') }; st.hist.push(h); }
    Object.assign(h, {
      stage: res.stage, chg: res.changes, ovr: Math.round(res.ovr), ovrD: res.ovrD, r: Object.assign({}, me.r),
      status: res.statusText || '', record: res.team ? res.team.record : '', tourn: res.team && res.team.tourn ? res.team.tourn.slice() : [],
      ps: res.psLine ? res.psLine.result : '', awards: res.awards.slice(), ms: res.ms.slice(), warB: res.warB, warP: res.warP,
    });
    if (res.ovr >= (st.car.peak || 0)) { st.car.peak = res.ovr; st.car.peakR = Object.assign({}, me.r); }
    // 돈
    if (me.stage === 'pro') { me.earnings += Math.round(me.salary * (1 - AGENCY[agencyOf(me).tier].fee)); }   // 62차: 에이전시 수수료를 뗀 금액
    // 이도류 제안 체크 (고교)
    if (me.stage === 'hs' && !me.twOffered && BAL.twoWay.offerTiers.indexOf(me.tier) >= 0 && avgKeys(me.r, oppKeys(me)) >= BAL.twoWay.offerMin && R.chance(BAL.twoWay.offerP)) { me.twOffered = true; queue(st, 'twoway'); }
    // 진행 단계 전환
    me.age++;
    st.year++;
    if (me.stage === 'hs') {
      if (me.grade === 3) {
        // 13차: 잠재력 특급 이상 또는 스카우트 '1라운드 유력'이고 능력치 기준을 넘으면 미국 구단 직행 제안
        const U = BAL.usDirect;
        if (st.L && st.L.MLB && (U.tiers.indexOf(me.tier) >= 0 || (me.scout.score || 0) >= U.scout) && myOVR(me) >= U.ovr) queue(st, 'usDirect');
        queue(st, 'draft', { from: 'hs' });
      }
      me.grade++;
    } else if (me.stage === 'univ') {
      if (me.univYears >= 4) queue(st, 'draft', { from: 'univ' });
      // 10차: 대학 시절 능력치가 기준을 넘으면 육성선수 제안이 올 수 있다
      else if (myOVR(me) >= BAL.univDev.ovr && R.chance(BAL.univDev.p)) queue(st, 'univDev');
    } else if (me.stage === 'indie') {
      if (myOVR(me) >= 50) queue(st, 'tryout');
      else if (me.indieYears >= 3) queue(st, 'indieEnd');
    } else if (me.stage === 'pro') {
      proWinter(st, res);
    } else if (me.stage === 'mil') {
      me.milYears++;
      if (me.milYears >= BAL.mil.years) { me.stage = 'pro'; me.lvl = 2; me.milDone = true; me.milType = null; me.noFirst = 0; story(st, `${me.age}세, 전역. 다시 ${teamName(st, me.team)} 유니폼을 입는다.`); }
    }
    if (st.done) return;
    // 전환점 0~2개
    const u = R();
    let n = u < 0.30 ? 0 : u < 0.80 ? 1 : 2;
    if (st.pending.some(p => ['draft', 'tryout', 'retireOffer', 'released', 'overseas', 'univDev', 'enlist', 'univPick', 'intlCall', 'devTest'].indexOf(p.id) >= 0) || me.stage === 'mil') n = 0;
    const picked = [];
    for (let i = 0; i < n; i++) {
      const pool = EVENTS.filter(ev => !ev.forced && (!me.used[ev.id] || ev.repeat) && picked.indexOf(ev.id) < 0 && st.pending.every(p => p.id !== ev.id) && safeCond(ev, st));
      if (!pool.length) break;
      const ev = R.weighted(pool, x => x.w || 1);
      picked.push(ev.id);
      queue(st, ev.id);
    }
    res.eventCount = st.pending.length;
  }
  function safeCond(ev, st) { try { return ev.cond(st, st.me); } catch (e) { return false; } }

  function grow(st, playCoef) {
    const me = st.me, age = me.age;
    let ageC = 0;
    for (const [a, c] of BAL.ageCoef) if (age <= a) { ageC = c; break; }
    const typeC = (me.growth === 'early' ? (age < 21 ? 1.4 : 0.7) : me.growth === 'late' ? (age < 25 ? 0.7 : 1.4) : 1) * (BAL.tierGrowth[me.tier] || 1);
    const sets = me.twoWay
      ? [[mainKeys(me), me.twMult.main], [oppKeys(me), me.twMult.opp]]
      : [[mainKeys(me), me.focus || 1], [oppKeys(me), me.stage === 'hs' ? BAL.oppGrowthHS : 0]];
    // 훈련 방향: 고른 두 능력치는 정해진 나이 전까지 더 빨리, 나머지 주 능력치는 조금 덜 오른다 (잠재 상한은 그대로)
    const TF = BAL.trainFocus;
    const tf2On = me.tf2 && age <= me.tf2.until;
    const tf = tf2On ? me.tf2.keys : (me.trainFocus || []);
    const tfOn = tf.length && (tf2On || age < TF.untilAge);
    const mk = mainKeys(me);
    for (const [keys, mult] of sets) {
      if (!mult) continue;
      for (const k of keys) {
        const gap = me.pa[k] - me.r[k];
        if (gap <= 0) continue;
        const fw = !tfOn ? 1 : tf.indexOf(k) >= 0 ? TF.focus : mk.indexOf(k) >= 0 ? TF.other : 1;
        let g = gap * ageC * playCoef * typeC * mult * fw * R.range(BAL.growthRand[0], BAL.growthRand[1]);
        if (k === 'spd' && me.flags.catcher) g *= 0.5;
        me.r[k] = clamp(me.r[k] + g, 20, 99);
      }
    }
    // 노화
    const ag = BAL.aging[me.aging];
    let start = ag[0];
    const staVal = me.role === 'P' ? me.r.sta : me.dur;
    if (staVal >= 70) start += 1; else if (staVal < 40) start -= 1;
    start -= Math.min(2, me.bigInj);
    if (age >= start) {
      const y = age - start;
      const off = me.role === 'P' || me.twoWay
        ? { vel: 0, sta: 0, stf: 1, brk: 1, men: 2, ctl: 2, spd: 0, def: 0, pow: 1, arm: 1, con: 1, eye: 2 }
        : { spd: 0, def: 0, pow: 1, arm: 1, con: 1, eye: 2 };
      const keys = me.twoWay ? ALL : mainKeys(me);
      for (const k of keys) {
        if (y < off[k]) continue;
        let d = R.int(ag[1], ag[2]) * (1 + BAL.agingAccel * y);   // 4차: 해가 갈수록 하락 가속
        if (me.flags.slowDecline && (k === 'spd' || k === 'def')) d *= 0.6;
        if (me.flags.cornerOF && k === 'def') d *= 0.6;
        me.r[k] = clamp(me.r[k] - d, 20, 99);
      }
    }
    // 일시 효과 원복
    if (me.flags.restore) { for (const k in me.flags.restore) addR(me, k, me.flags.restore[k]); delete me.flags.restore; }
  }

  // 35차/36차: 투수 WAR 가중치 — 연봉·FA·해외 제안·국가대표 선발·커리어 점수에서 투수 WAR를 타자보다 높게 친다 (BAL.pitWarW)
  function warW(me) { return me.role === 'P' && !me.twoWay ? BAL.pitWarW : 1; }
  function marketValue(me) {
    const h = me.warHist || [];
    const a = h.length ? h[h.length - 1] : 0, b = h.length > 1 ? h[h.length - 2] : a;
    const w = Math.max(0, 0.6 * a + 0.4 * b) * warW(me);
    return Math.max(BAL.minSal, BAL.valBase + BAL.valPerWAR * w / BAL.warScale);
  }
  // 27차: FA 조건 문구 — 계약금이 있으면 총액(계약금+연봉×년)으로
  function faTerms(o) { return o.bon ? `${o.yrs}년 총액 ${man(o.bon + o.sal * o.yrs)} (계약금 ${man(o.bon)}, 연 ${man(o.sal)})` : `${o.yrs}년 연 ${man(o.sal)}`; }
  // ---------- 62차: 에이전시와 연봉 협상 ----------
  // 에이전시 3단계: 기존(개인·소형) → 중형 → 대형. 협상력(skill)이 높을수록 연봉 인상·FA 몸값에 유리하지만 수수료가 크다.
  //   중형·대형은 연봉(만원)이나 화제성이 기준을 넘으면 겨울에 영입 제안이 온다.
  const AGENCY = {
    small: { name: '기존 에이전시', skill: [30, 50], fee: 0.03 },
    mid: { name: '중형 에이전시', skill: [52, 70], fee: 0.05, sal: 20000, pop: 40 },   // 62차 조정: 연봉 1억 → 2억 (1억은 거의 모든 1군 선수가 넘어서 기존 에이전시가 의미 없었다)
    big: { name: '대형 에이전시', skill: [72, 95], fee: 0.08, sal: 50000, pop: 70 },   // 3억 → 5억
  };
  function agencyOf(me) {
    if (!me.agency) me.agency = me.flags && me.flags.bigAgent ? { tier: 'big', skill: 80 } : { tier: 'small', skill: 40 };   // 예전 저장: 대형 에이전시로 옮겼던 선수는 대형
    return me.agency;
  }
  function agentGrade(skill) { return skill >= 82 ? 'S' : skill >= 66 ? 'A' : skill >= 50 ? 'B' : 'C'; }
  // FA 몸값 배율 (협상력 30 ≈ 0.99, 50 ≈ 1.05, 70 ≈ 1.11, 95 ≈ 1.19)
  function agentMul(me) { return 0.9 + agencyOf(me).skill * 0.003; }
  // 협상 지렛대: 성적(시장가치 ÷ 제시액) · 팬들의 관심(화제성) · 명성(업적) · 에이전트 협상력
  function salaryLeverage(st, offer) {
    const me = st.me, ag = agencyOf(me), sm = cfgOf(st.lg).salMul || 1;
    const mv = marketValue(me) * sm;
    const perfN = clamp((mv / Math.max(1, offer) - 0.8) / 0.8, 0, 1);
    const popN = clamp((me.pop || 0) / 60, 0, 1);
    const fameN = clamp((st.car.achPts || 0) / 250, 0, 1);
    const agN = ag.skill / 100;
    const lev = 0.35 * perfN + 0.2 * popN + 0.15 * fameN + 0.3 * agN;
    const p10 = clamp(0.2 + 0.7 * lev, 0.1, 0.92), p25 = clamp(-0.1 + 0.8 * lev, 0.03, 0.75);
    const word = p => p >= 0.7 ? '해볼 만하다' : p >= 0.45 ? '반반' : p >= 0.25 ? '쉽지 않다' : '어렵다';
    const lvl = x => x >= 0.66 ? '높음' : x >= 0.33 ? '보통' : '낮음';
    return { p10, p25, w10: word(p10), w25: word(p25), perf: lvl(perfN), pop: lvl(popN), fame: lvl(fameN), agent: agentGrade(ag.skill) };
  }
  function weightedWAR(me) { const h = me.warHist || []; const a = h.length ? h[h.length - 1] : 0, b = h.length > 1 ? h[h.length - 2] : a; return (0.6 * a + 0.4 * b) * warW(me); }

  function proWinter(st, res) {
    const me = st.me;
    // 강제 이벤트
    if (me.flags.tjPending) { delete me.flags.tjPending; queue(st, 'tj'); }
    // 은퇴·방출
    if (me.age >= BAL.hardRetire) { retire(st, `${me.age}세, 더 이상 몸이 따라주지 않았다. 유니폼을 벗는다.`); return; }
    const team = teamById(st, me.team);
    const low = groupLowest(st, team, GROUP[me.pos]);
    const mo = myVal(me) - (me.lvPen || 0);
    const ls = me.lastSeason || {};
    let leaving = false;
    // 56차: 은퇴 권유는 나이가 아니라 능력·성적으로 — 전성기에서 내려온 선수(OVR RO.drop 이상 하락)가
    //   팀 같은 포지션에서 가장 약한 선수보다 못하거나, 그 선수와 차이가 RO.gap 이내인데 직전 시즌 WAR가 RO.war 미만이면
    const RO = BAL.retireOffer, fell = (st.car.peak || 0) - myOVR(me) >= RO.drop;
    if (fell && (mo < low || (mo < low + RO.gap && ls.war < WS(RO.war)))) { queue(st, 'retireOffer'); leaving = true; }
    else if (me.noFirst >= BAL.releaseNoFirst) { queue(st, 'released'); leaving = true; }
    // 10차: 해외 진출 (KBO에서 연차·성적·능력이 되면 포스팅/FA로 제안)
    const A = BAL.abroad;
    const faDue = !me.abroad && me.faAt != null && me.svc >= me.faAt && !(me.contract && me.contract.until >= st.year);
    // 12차: 병역 — 입영 기한이 되면 입대(상무/현역), 그 전에도 1군 자리가 없으면 가끔 조기 입대 제안
    const M = BAL.mil;
    if (!leaving && !me.milDone && me.age >= M.deadline) { queue(st, 'enlist', { due: true }); leaving = true; }
    // 44차: 상무 기준(OVR)을 넘으면 매년 상무 지원 권유. 45차: 병역 미필이면 기준과 상관없이 매년 겨울 입대 선택지(현역, 기준이 되면 상무도) — 미룰 수 있다
    else if (!leaving && !me.milDone && !me.abroad && me.age < M.deadline) { queue(st, 'enlist', { due: false, push: true }); }
    // 13차: 해외 진출은 자동 제안 대신 포스팅(직접 신청)·해외 FA(FA 이벤트 안)로
    const abroadOK = false;
    // 밸런스 봇용: 봇은 버튼을 못 누르므로 자격이 되면 가끔 포스팅을 신청한 것으로 친다
    if (OPT.botPost && !leaving && canPost(st) && R.chance(0.3)) { me.flags.postYear = st.year; queue(st, 'posting'); }
    // 60차: 이도류 투타 균형이 무너지면(능력 차 BAL.twoWay.quitGap 이상, 또는 한쪽만 잘하고 다른 쪽은 부진) 그만둘지 묻는다 — 2년 간격
    if (!leaving && me.twoWay && team && (me.flags.twAskYear || 0) <= st.year - 2) {
      const TW = BAL.twoWay, bV = me.role === 'B' ? myVal(me) : myOppVal(me), pV = me.role === 'P' ? myVal(me) : myOppVal(me);
      const wb = ls.warB, wp = ls.warP, hasW = wb != null && wp != null;
      const weak = Math.abs(bV - pV) >= TW.quitGap ? (bV < pV ? 'bat' : 'pit')
        : hasW && wp >= TW.okWAR && wb < TW.quitWAR ? 'bat' : hasW && wb >= TW.okWAR && wp < TW.quitWAR ? 'pit' : null;
      if (weak) { me.flags.twAskYear = st.year; queue(st, 'twQuit', { weak }); }
    }
    // 11차: 투수 보직 전환 제안 (불펜→선발, 선발→불펜, 불펜→마무리)
    // 15차: 보직 전환 제안은 커리어 통틀어 1~2번(랜덤), 최소 3년 간격
    // 43차: 선발↔불펜 제안은 2~3번·2년 간격, 마무리 제안은 따로 센다(횟수 제한 없음, 2년 간격). 조건도 완화 (BAL.roleOffer)
    const O = BAL.roleOffer;
    if (me.roleOffersLeft == null) { me.roleOffersLeft = R.int(O.spN[0], O.spN[1]); me.flags.ro43 = true; }
    else if (!me.flags.ro43) { me.flags.ro43 = true; me.roleOffersLeft += 1; }   // 43차 이전 저장: 한 번 더
    const roleOK = me.roleOffersLeft > 0 && (me.flags.roleOfferYear || 0) <= st.year - O.gap;
    const clOK = (me.flags.clOfferYear || 0) <= st.year - O.clGap;
    const qLen = st.pending.length;
    if (!leaving && !abroadOK && me.role === 'P' && !me.twoWay && team) {
      const e = effR(me);
      const tps = team.act.map(id => st.lg.p[id]).filter(Boolean);
      const spO = tps.filter(p => p.pos === 'SP').map(p => ovrAt(p.r, 'SP')).sort((a, b) => b - a);
      const fifth = spO[4] != null ? spO[4] : 40;
      const topRP = tps.filter(p => p.pos === 'RP').reduce((a, p) => Math.max(a, valAt(p.r, 'RP')), 0);
      const eraBad = ls.era != null && ls.era > st.lg.lgERA + 0.8, eraGood = ls.era != null && ls.era < st.lg.lgERA - O.clEra;
      if (roleOK && me.pos === 'RP' && me.r.sta >= O.spSta && ovrAt(e, 'SP') >= fifth - O.spGap && R.chance(O.toSP)) queue(st, 'toSP');
      else if (roleOK && me.pos === 'SP' && (ls.gs || 0) >= 5 && me.age >= 29 && (eraBad || ovrAt(e, 'SP') < fifth - 2 || me.r.sta < 45) && R.chance(O.toRP)) queue(st, 'toRP');
      if (st.pending.length > qLen) { me.roleOffersLeft--; me.flags.roleOfferYear = st.year; }
      // 마무리: 지난 시즌 ERA가 좋거나, 불펜 능력이 팀 최고 불펜 투수와 비슷하면
      else if (clOK && me.pos === 'RP' && !me.flags.closer && (ls.cl || 0) < 2 && (eraGood || valAt(e, 'RP') >= topRP - O.clVal) && R.chance(O.toCL)) { queue(st, 'toCL'); me.flags.clOfferYear = st.year; }
    }
    // 31차: 구단 주도 트레이드 — KBO 입단 후 2시즌 안에 주전을 못 잡으면 70% 확률로 다른 구단, 3시즌 안에 못 잡으면 약팀으로
    if (!me.abroad && cfgOf(st.lg).id === 'KBO') {
      me.proSeasons = (me.proSeasons || 0) + 1;
      const TR = BAL.clubTrade;
      if (!leaving && !me.everStarter && team) {
        if (me.proSeasons === TR.firstSeasons && !me.flags.trade1 && R.chance(TR.firstP)) { me.flags.trade1 = true; queue(st, 'clubTrade', { weak: false }); }
        else if (me.proSeasons === TR.weakSeasons && !me.flags.trade2 && R.chance(TR.weakP)) { me.flags.trade2 = true; queue(st, 'clubTrade', { weak: true }); }
      }
    }
    // 62차: 에이전시 영입 제안 — 연봉·화제성이 기준을 넘으면 한 단계 위 에이전시가 2년 간격으로 찾아온다
    {
      const ag = agencyOf(me), nxt = ag.tier === 'small' ? 'mid' : ag.tier === 'mid' ? 'big' : null, N = nxt && AGENCY[nxt];
      if (N && !leaving && team && (me.salary >= N.sal || (me.pop || 0) >= N.pop) && (me.flags.agencyYear || 0) <= st.year - 2 && R.chance(0.5)) { me.flags.agencyYear = st.year; queue(st, 'agency', { tier: nxt }); }
    }
    // 계약
    res.salaryPrev = me.salary;
    const sm = cfgOf(st.lg).salMul || 1;
    const v = marketValue(me) * sm;
    if (me.contract && me.contract.until >= st.year) {
      me.salary = me.contract.salary;
    } else {
      if (me.contract) me.contract = null;
      if ((me.abroad || (me.faAt != null && me.svc >= me.faAt)) && me.age <= 40) { if (!abroadOK && !leaving) queue(st, 'fa'); }
      else {
        const rate = me.flags.arbWin ? BAL.arbWinRate : BAL.arbRate;
        delete me.flags.arbWin;
        let ns = me.salary + (v - me.salary) * rate;
        ns = Math.max(ns, me.salary * 0.7, BAL.minSal * sm);
        if (me.flags.ytBump) { ns *= 1.05; delete me.flags.ytBump; }
        me.salary = Math.round(ns / 100) * 100;
        // 62차: 구단 제시액을 바로 확정하지 않고 협상 테이블에 올린다 (수락·인상 요구·연봉조정)
        if (!leaving && team && !st.done) queue(st, 'salary', { offer: me.salary, prev: res.salaryPrev || null });
        // 비FA 다년계약 제안
        const h = me.warHist || [];
        if (me.age >= 25 && h.length >= 2 && h[h.length - 1] >= 3 && h[h.length - 2] >= 3 && !me.flags.extDone && me.svc < (me.faAt || 99) - 1) queue(st, 'extension');
      }
    }
    res.salary = me.salary;
  }

  // ---------- 12차: 군 복무 시즌 (상무 = 퓨처스리그에서 뛰며 성장 / 현역 = 성장 없음) ----------
  function milSeason(st, res) {
    const me = st.me, sangmu = me.milType === 'sangmu', yr = me.milYears + 1;
    res.team = { name: sangmu ? '상무' : '군 복무', record: '', tourn: [] };
    if (!sangmu) {
      res.statusText = `현역 복무 ${yr}년차 · 야구공 대신 총을 잡았다`;
      res.playCoef = 0;
      // 17차: 현역 복무 중 체력 훈련 — 투수는 체력·멘탈, 타자는 어깨·주루가 오르고 나머지 주 능력치는 떨어진다 (매년)
      // 52차: 올라가는 능력치 +2 → +3, 나머지 −1 → −2
      // 62차: 몸이 단단해지는 쪽만 오른다 — 타자는 파워·어깨·멘탈, 투수는 구속·구위·체력. 나머지(감각 능력치)는 떨어진다
      const up = me.role === 'P' ? ['vel', 'stf', 'sta'] : ['pow', 'arm'];
      for (const k of mainKeys(me)) addR(me, k, up.indexOf(k) >= 0 ? 3 : -2);
      if (me.role !== 'P') addR(me, 'men', 3);
    } else {
      const e = effR(me);
      res.statusText = `상무 ${yr}년차 · 퓨처스리그 출전`;
      if (me.role === 'B' || me.twoWay) { const p = batRates(e, 7); res.bat = finishBat(simBat(p, Math.round(380 * (me.role === 'B' ? 1 : 0.6))), p, 1, 1, 1); res.bat.G = Math.round(res.bat.PA / 4.1); }
      if (me.role === 'P' || me.twoWay) { const p = pitRates(e, 7); const outs = me.pos === 'SP' ? Math.round(20 * p.ipS * 3 * (me.role === 'P' ? 1 : 0.4)) : 55 * 3; res.pit = simPitch(p, outs, 1); res.pit.G = me.pos === 'SP' ? 20 : 45; res.pit.GS = me.pos === 'SP' ? 20 : 0; }
      res.playCoef = 0.9;   // 52차: 0.85 → 0.9 (1군 주전 성장의 90%)
    }
    st.hist.push({ year: st.year, age: me.age, team: res.team.name, teamId: sangmu ? 'F_SM' : null, lg: 'MIL', lvl: 'A', bat: res.bat || null, pit: res.pit || null, war: null, note: '' });
  }
  function enlist(st, type) {
    const me = st.me;
    if (me.abroad) { const t = kboReturnTeam(st); returnKBO(st, t, BAL.minSal, 3); story(st, `병역 의무로 귀국. 전역 후 ${teamName(st, t)} 유니폼을 입기로 했다.`); }
    me.stage = 'mil'; me.milType = type; me.milYears = 0; me.lvl = 2;
    story(st, type === 'sangmu' ? `${me.age}세, 상무 입단. 군 복무를 하면서 퓨처스리그에서 뛴다.` : `${me.age}세, 현역 입대. 2년간 야구를 내려놓는다.`);
  }
  // ---------- 12차: 국제대회 (선발 기준 통과 시 출전, 아시안게임 금·올림픽 메달은 병역 혜택) ----------
  function intlTournament(st, res) {
    const me = st.me, year = res.year, calls = [];
    for (const T of BAL.intl) {
      const held = T.years ? T.years.indexOf(year) >= 0 : (year >= T.from && (year - T.from) % T.every === 0);
      if (!held) continue;
      res.intl = res.intl || [];
      const info = { id: T.id, name: T.name, selected: false, won: false, exempt: T.exempt };
      if (me.stage !== 'pro') { res.intl.push(Object.assign(info, { why: '프로 선수만 선발 대상' })); continue; }
      const o = myOVR(me), war = (res.war || 0) * warW(me);   // 35차: 투수 WAR 가중치
      const ageOK = T.maxAge == null || me.age <= T.maxAge || o >= T.wildOVR;
      const okAbroad = T.id !== 'AG' || !me.abroad;
      let merit = (o >= T.ovr && war >= WS(T.war)) || war >= WS(T.warOnly);
      // 29차: 올림픽은 해외파(메이저 직행·마이너리거 포함)도 능력치만 되면 선발 — 리그 수준이 달라 WAR로는 못 견준다
      const olyAbroad = T.id === 'OLY' && me.abroad && o >= T.ovr;
      if (olyAbroad) merit = true;
      if (merit && ageOK && okAbroad && (me.lvl === 1 || olyAbroad)) {
        // 14차: 바로 결과를 내지 않고 '국가대표 소집' 결정을 맨 앞에 띄운다 → 수락하면 대회를 경기별로 시뮬레이션
        info.selected = true; info.call = true;
        res.awards.push(`${T.name} 국가대표 발탁`);
        calls.push(T.id);
      } else {
        info.why = !ageOK ? `나이 제한(${T.maxAge}세 이하, 와일드카드 OVR ${disp(T.wildOVR)})` : !okAbroad ? '해외파는 선발 대상 아님' : me.lvl !== 1 ? '1군 선수만 선발' : `기준: OVR ${disp(T.ovr)} 이상 + 시즌 WAR ${WS(T.war).toFixed(1)} 이상, 또는 시즌 WAR ${WS(T.warOnly).toFixed(1)} 이상`;
      }
      res.intl.push(info);
    }
    // 61차: 한 해에 여러 대회 소집 가능 — 표에 적힌 순서대로 맨 앞에 띄운다
    for (let i = calls.length - 1; i >= 0; i--) { queue(st, 'intlCall', { tid: calls[i], year }); st.pending.unshift(st.pending.pop()); }
  }
  // ---------- 14차: 국제대회 경기별 시뮬레이션 ----------
  // 상대별 한국 승리 확률 (대표팀 기준), 대회별 대진
  const INTL_OPP = { 홍콩: 0.95, 태국: 0.93, 필리핀: 0.93, 중국: 0.85, 대만: 0.58, '일본(사회인)': 0.6, 일본: 0.42, 미국: 0.4, 도미니카: 0.42, 베네수엘라: 0.45, 쿠바: 0.55, 멕시코: 0.52, 이스라엘: 0.68, 호주: 0.66, 체코: 0.8, 네덜란드: 0.6, 푸에르토리코: 0.45 };
  const INTL_FMT = {
    AG: { group: ['태국', '홍콩', '대만'], ko: [['준결승', ['일본(사회인)', '대만', '중국']], ['결승', ['대만', '일본(사회인)']]], need: 2, boost: 0.22 },   // 43차: 경기마다 승률 +7%p (금메달 약 39% → 약 48%). 46차: +22%p (금메달 약 70%)
    OLY: { group: ['이스라엘', '미국', '도미니카'], ko: [['준결승', ['일본', '미국', '멕시코']], ['결승', ['일본', '미국', '도미니카']]], bronze: ['멕시코', '도미니카', '미국'], need: 1, boost: 0.27 },   // 46차: 경기마다 승률 +27%p (금메달 약 16% → 약 50%, 메달 약 90%)   // 29차: 2→1 (도쿄 올림픽처럼 조별리그는 시드 결정 성격, 메달 확률 약 35%→60%)
    P12: { group: ['호주', '쿠바', '대만'], ko: [['슈퍼라운드', ['멕시코', '미국', '베네수엘라']], ['결승', ['일본', '미국']]], need: 2 },
    WBC: { group: ['체코', '호주', '일본'], ko: [['8강', ['쿠바', '네덜란드', '멕시코']], ['4강', ['미국', '도미니카', '베네수엘라']], ['결승', ['일본', '미국', '푸에르토리코']]], need: 2 },
  };
  function playIntl(st, T) {
    const me = st.me, F = INTL_FMT[T.id], e = effR(me);
    const bR = batRates(e), pR = pitRates(e);
    const isB = me.role === 'B' || me.twoWay, isP = me.role === 'P' || me.twoWay, sp = me.pos === 'SP';
    const games = [];
    const tot = { bat: emptyBat(), pit: emptyPit() };
    let gi = 0;
    const play = (stage, opp) => {
      const line = [];
      let bonus = 0, bs = null, ps = null, start = false;
      if (isB) { bs = finishBat(simBat(bR, 4), bR, 1, 1, 1); addLine(tot.bat, bs); line.push(`${bs.AB}타수 ${bs.H}안타${bs.HR ? ` ${bs.HR}홈런` : ''}${bs.RBI ? ` ${bs.RBI}타점` : ''}`); bonus += bs.HR * 0.04 + (bs.H >= 2 ? 0.03 : bs.H === 0 ? -0.02 : 0); }
      if (isP) {
        start = sp && (gi === 1 || stage !== '조별리그' && gi % 2 === 0);
        if (start || (!sp && R.chance(0.6))) {
          // 62차: 등판마다 이닝이 달라진다 — 선발은 기대 이닝 ± 1이닝 남짓(투구 수·컨디션), 구원은 1/3~2이닝
          const outs = start ? clamp(Math.round(pR.ipS * 3 * 0.85 + R.gauss() * 3.5), 7, 27) : R.weighted([1, 2, 3, 3, 3, 4, 5, 6], () => 1);
          ps = simPitch(pR, outs, pR.men);
          // 대량 실점하면 일찍 강판 — 실점이 많을수록 아웃카운트를 덜 잡고 내려간다
          if (start && ps.ER >= 4 && ps.outs > 9) { const cut = Math.max(7, ps.outs - R.int(3, 7)); ps.outs = cut; }
          addLine(tot.pit, ps); tot.pit.GS = (tot.pit.GS || 0) + (start ? 1 : 0);
          line.push(`${ipTxt(ps)}이닝 ${ps.ER}실점 ${ps.K}K`); bonus += ps.ER === 0 ? (start ? 0.06 : 0.03) : ps.ER >= 3 ? -0.05 : 0;
        }
      }
      const win = R() < clamp((INTL_OPP[opp] || 0.5) + bonus + (F.boost || 0), 0.05, 0.97);
      let w = Math.max(1, Math.round(4.5 + R.gauss() * 2.5)), l = Math.max(0, Math.min(w - 1, Math.round(w - 1 - Math.abs(R.gauss()) * 2.5)));
      // 47차: 점수를 내 기록과 맞춘다 — 우리 팀 득점 ≥ 내 타점, 상대 득점 ≥ 내 자책점 (4:0 승리인데 '4실점 난타'가 나오던 문제)
      {
        let ours = win ? w : l, opp = win ? l : w;
        ours = Math.max(ours, bs ? bs.RBI || 0 : 0);
        opp = Math.max(opp, ps ? ps.R || ps.ER || 0 : 0);
        if (win && ours <= opp) ours = opp + 1 + Math.floor(Math.abs(R.gauss()) * 1.5);
        if (!win && opp <= ours) opp = ours + 1 + Math.floor(Math.abs(R.gauss()) * 1.5);
        w = win ? ours : opp; l = win ? opp : ours;
      }
      // 15차: 경기 하이라이트
      let hl = '';
      if (win && bs && bs.HR && w - l <= 2) hl = '결승 홈런!';
      else if (win && bs && bs.RBI >= 2 && w - l <= 2) hl = '결승타의 주인공';
      else if (bs && bs.HR >= 2) hl = '멀티 홈런';
      else if (ps && start && ps.ER === 0 && IP(ps) >= 5) hl = '무실점 호투';
      else if (ps && !start && win && ps.ER === 0 && w - l <= 3) hl = '뒷문을 꽁꽁 잠갔다';
      else if (ps && ps.ER >= 4) hl = '난타당했다';
      else if (bs && bs.H === 0 && bs.AB >= 3 && !win) hl = '침묵';
      games.push({ stage, opp, win, score: win ? [w, l] : [l, w], me: line.join(' · ') || '출전하지 않음', hl });
      gi++;
      return win;
    };
    let wins = 0;
    for (const o of F.group) if (play('조별리그', o)) wins++;
    let result;
    if (wins < F.need) result = '조별리그 탈락';
    else {
      result = null;
      for (let i = 0; i < F.ko.length; i++) {
        const [stage, pool] = F.ko[i];
        const opp = R.pick(pool);
        const won = play(stage, opp);
        const last = i === F.ko.length - 1;
        if (won && last) { result = T.id === 'AG' || T.id === 'OLY' ? '금메달' : '우승'; break; }
        if (!won) {
          if (last) result = T.id === 'AG' || T.id === 'OLY' ? '은메달' : '준우승';
          else if (F.bronze && i === F.ko.length - 2) result = play('동메달 결정전', R.pick(F.bronze)) ? '동메달' : '4위';
          else if (T.id === 'AG' && i === F.ko.length - 2) result = '동메달';
          else result = `${stage} 탈락`;
          break;
        }
      }
    }
    const medal = /메달|우승/.test(result) && !/준우승/.test(result) || result === '준우승';
    const exempt = T.exempt && (T.id === 'AG' ? result === '금메달' : /메달/.test(result));
    // 15차: 최종 순위·개인상
    const RANK = { '금메달': 1, '우승': 1, '은메달': 2, '준우승': 2, '동메달': 3, '4위': 4 };
    const n = { AG: 8, OLY: 6, P12: 12, WBC: 20 }[T.id];
    const rank = RANK[result] || (/4강/.test(result) ? 4 : /슈퍼라운드|8강/.test(result) ? R.int(5, 8) : R.int(Math.min(9, n - 2), n));
    const awards = [];
    const ops = tot.bat.PA ? OPS(tot.bat) : 0, era = tot.pit.outs ? ERA(tot.pit) : 99, ip = IP(tot.pit);
    const star = (tot.bat.PA >= 12 && ops >= 1.0) || (ip >= 9 && era <= 1.5) || (ip >= 4 && era === 0 && !sp);
    const good = (tot.bat.PA >= 12 && ops >= 0.85) || (ip >= 6 && era <= 2.5) || (ip >= 3 && era <= 1.0 && !sp);
    if (rank === 1 && star) awards.push('대회 MVP');
    if (good) awards.push('올-토너먼트 팀');
    if (tot.bat.HR >= 3) awards.push('대회 홈런 1위');
    if (tot.pit.K >= 15) awards.push('대회 탈삼진 1위');
    return { id: T.id, name: T.name, year: st.year - 1, games, result, rank, field: n, medal, exempt, awards, bat: tot.bat.PA ? tot.bat : null, pit: tot.pit.outs ? tot.pit : null };
  }
  // ---------- 10차: 돌발 변수 — 늦깎이 각성 ----------
  function lateBloom(st, res) {
    const me = st.me, B = BAL.bloom;
    if (me.flags.bloomed || me.age < B.age[0] || me.age > B.age[1] || me.stage === 'retired' || me.stage === 'hs') return;
    if (myOVR(me) > B.maxOVR || !R.chance(B.p)) return;
    me.flags.bloomed = true;
    for (const k of mainKeys(me)) { me.pa[k] = Math.min(97, me.pa[k] + R.int(B.pa[0], B.pa[1])); me.r[k] = clamp(me.r[k] + R.int(B.now[0], B.now[1]), 20, 99); }
    res.awards.push('늦깎이 각성');
    res.news = (res.news || []).concat([`"${me.name}, 이번 겨울 완전히 달라졌다" — 캠프 현장 기자`]);
    res.bloom = true;
    story(st, `${me.age}세 겨울, 무언가가 탁 트였다. 늦깎이 각성.`);
  }
  // ---------- 10차: 해외 진출·복귀 ----------
  function goAbroad(st, cid, teamId, sal, yrs) {
    const me = st.me;
    const L = st.L[cid]; delete st.L[cid];
    stripLeague(st.lg);
    st.home = st.lg; me.kboTeam = me.team;
    st.lg = L; L.lastStand = L.lastStand || L.teams.map(t => t.id);
    me.team = teamId; me.lvl = 1; me.lvPen = LCFG[cid].level; me.abroad = cid; me.rival = null; me.noFirst = 0;
    me.salary = sal; me.contract = { salary: sal, until: st.year + yrs - 1, kind: cid };
    story(st, `${me.age}세, ${LCFG[cid].name} 진출. ${tj(st, teamId, '과', '와')} ${yrs}년 연 ${man(sal)}.`);
  }
  function returnKBO(st, teamId, sal, yrs) {
    const me = st.me, cur = st.lg;
    stripLeague(cur); delete cur.teamStats;
    st.L[cur.cid] = cur;
    st.lg = st.home; st.home = null;
    const from = LCFG[cur.cid].name;
    me.team = teamId; me.lvl = 1; me.lvPen = 0; me.abroad = null; me.rival = null; me.noFirst = 0;
    me.salary = sal; me.contract = { salary: sal, until: st.year + yrs - 1, kind: 'KBO 복귀' };
    me.faAt = me.svc + Math.max(4, yrs);
    story(st, `${me.age}세, ${from} 생활을 마치고 ${tj(st, teamId, '으로', '로')} 복귀.`);
  }
  // 30차: 해외 스카우트 평가 = 현재 OVR + 기대 WAR 지수(능력치로 본 실제 기여) + 잠재력 OVR 를 종합 (가중치 BAL.abroad.evalW)
  // 21차까지는 현재 OVR 60% + 잠재력 평균 40%
  function abroadEval(me) {
    const w = BAL.abroad.evalW, pos = me.pos;
    if (BAL.abroad.evalOld) return myOVR(me) * 0.6 + avgKeys(me.pa, mainKeys(me)) * 0.4;   // 비교용
    return w[0] * myOVR(me) + w[1] * valAt(me.r, pos) + w[2] * ovrAt(me.pa, pos) + w[3];
  }
  // 13차: 해외 구단 제안 만들기 (능력치·최근 성적에 따라 리그·구단 수가 정해지고, 모자라면 0곳)
  function overseasOffers(st, kind) {
    const me = st.me, A = BAL.abroad, ww = weightedWAR(me), v = marketValue(me);
    const o = abroadEval(me);
    if (OPT.evLog) { const w = BAL.abroad.evalW; OPT.evLog.push({ old: myOVR(me) * 0.6 + avgKeys(me.pa, mainKeys(me)) * 0.4, now: w[0] * myOVR(me) + w[1] * valAt(me.r, me.pos) + w[2] * ovrAt(me.pa, me.pos) + w[3], tier: me.tier, age: me.age }); }
    const out = [];
    const pickTeams = (L, n) => { const ids = L.teams.map(t => t.id), res = []; while (res.length < n && ids.length) res.push(ids.splice(R.int(0, ids.length - 1), 1)[0]); return res; };
    const disc = kind === 'posting' ? 0.75 : 1;   // 포스팅은 이적료 때문에 연봉이 조금 낮다
    if (st.L.MLB) {
      const n = o >= A.mlbEval + 3 && ww >= WS(A.mlbWar + 1) ? R.int(2, 4) : o >= A.mlbEval && ww >= WS(A.mlbWar) ? R.int(1, 2) : o >= A.mlbEval - 2 && ww >= WS(A.mlbWar - 0.5) && R.chance(0.4) ? 1 : 0;
      for (const id of pickTeams(st.L.MLB, n)) { const yrs = R.int(2, 4); out.push({ cid: 'MLB', team: id, yrs, sal: Math.round(Math.max(BAL.minSal * LCFG.MLB.salMul * 0.5, v * LCFG.MLB.salMul * disc * R.range(0.65, 1.0)) / 100) * 100 }); }
    }
    if (st.L.NPB) {
      const n = o >= A.npbEval + 3 && ww >= WS(A.npbWar) ? R.int(2, 3) : o >= A.npbEval && ww >= WS(A.npbWar - 0.5) ? R.int(1, 2) : o >= A.npbEval - 2 && R.chance(0.25) ? 1 : 0;
      for (const id of pickTeams(st.L.NPB, n)) { const yrs = R.int(2, 3); out.push({ cid: 'NPB', team: id, yrs, sal: Math.round(Math.max(BAL.minSal * LCFG.NPB.salMul, v * LCFG.NPB.salMul * disc * R.range(0.8, 1.05)) / 100) * 100 }); }
    }
    return out.sort((a, b) => (a.cid === b.cid ? b.sal - a.sal : a.cid === 'MLB' ? -1 : 1));
  }
  // 14차: 육성 방향(강점) 바꾸기 — 커리어에 BAL.focusChange.times번
  function changeFocus(st, keys) {
    const me = st.me, F = BAL.focusChange;
    const allowed = me.twoWay ? ALL : mainKeys(me);
    keys = (keys || []).filter(k => allowed.indexOf(k) >= 0).slice(0, 2);
    if (st.done || keys.length !== 2 || (me.tfChanges == null ? F.times : me.tfChanges) <= 0) return false;
    if (me.tfChanges == null) me.tfChanges = F.times;
    const others = allowed.filter(k => keys.indexOf(k) < 0).sort((a, b) => me.pa[b] - me.pa[a]).slice(0, 2);
    for (const k of keys) me.pa[k] = Math.min(97, me.pa[k] + F.paUp);
    for (const k of others) me.pa[k] = Math.max(Math.ceil(me.r[k]) + 1, me.pa[k] - F.paDown);
    me.tf2 = { keys, until: me.age + F.seasons - 1 };
    me.tfChanges--;
    return true;   // 58차: 인생 이야기에는 남기지 않는다
  }
  function canPost(st) {
    const me = st.me, A = BAL.abroad;
    return me.stage === 'pro' && !me.abroad && cfgOf(st.lg).id === 'KBO' && me.svc >= A.svc && me.milDone && me.age <= A.maxAge
      && me.flags.postYear !== st.year && !st.pending.some(p => p.id === 'posting' || p.id === 'fa' || p.id === 'enlist' || p.id === 'released' || p.id === 'retireOffer');
  }
  function requestPosting(st) {
    bind(st);
    if (!canPost(st)) return false;
    st.me.flags.postYear = st.year;
    queue(st, 'posting');
    st.pending.unshift(st.pending.pop());   // 신청한 포스팅 결과를 먼저 보여준다
    return true;
  }
  function kboReturnTeam(st) {
    const L = st.home || st.lg, me = st.me;
    return (me.kboTeam && L.teams.some(t => t.id === me.kboTeam) && R.chance(0.6)) ? me.kboTeam : R.pick(L.teams).id;
  }

  function retire(st, text) {
    const me = st.me;
    if (st.done) return;
    st.done = true;
    me.stage = 'retired';
    if (st.car.peakR) me.shown = Object.assign({}, st.car.peakR); // 은퇴 카드는 전성기 능력치로
    story(st, text);
    st.pending = [];
    st.final = finalCard(st);
  }

  // ---------- 커리어 점수 (5.11) ----------
  // 52차: 커리어 점수 = WAR 점수 + 업적 점수 (최상위권에서 대략 6:4가 되도록 BAL.score.achK로 맞춤)
  //   WAR 점수: 시즌 WAR × 리그 가중치(KBO 1 · 일본 · 미국) × 투수 가중치
  //   업적 점수: 수상·타이틀·통산 기록은 받은 리그의 가중치를 곱하고, 우승·메달은 대회별 고정 점수(이미 리그 차등)
  function lgW(id) { return (BAL.score.lgW[id] || 1); }
  function addAch(st, key, lgId) {
    const car = st.car;
    if (car.achPts == null) car.achPts = 0;   // 예전 저장은 ensureLeagues에서 먼저 legacyAch로 채워진다
    car.achPts += (BAL.score.ach[key] || 0) * (lgId ? lgW(lgId) : 1);
  }
  // 52차 이전에 시작한 커리어: 그때까지의 수상 횟수로 업적 점수를 한 번 계산해 둔다 (리그 구분 없이 KBO 기준)
  function legacyAch(st) {
    const car = st.car, a = car.aw, A = BAL.score.ach;
    let s = (a.MVP || 0) * A.MVP + (a.GG || 0) * A.GG + (a.KSMVP || 0) * A.SMVP + (a.TITLE || 0) * A.TITLE + (a.ROY || 0) * A.ROY + (a.KS || 0) * A.KS + (a.POY || 0) * A.POY;
    for (const name of car.ms) { const m = MILESTONES.find(x => x[2] === name); if (m && m[3]) s += m[3] >= 40 ? A.MS2 : A.MS1; }
    s += (car.twoWaySeasons || 0) * A.TW;
    for (const t of car.intlRec || []) s += intlAchPts(t.name, t.result);
    return s;
  }
  function intlAchPts(name, result) {
    const A = BAL.score.ach;
    if (/올림픽/.test(name)) return result === '금메달' ? A.OLY_G : result === '은메달' ? A.OLY_S : result === '동메달' ? A.OLY_B : 0;
    if (/아시안게임/.test(name)) return result === '금메달' ? A.AG : 0;
    if (/WBC|프리미어/.test(name)) return result === '우승' ? A.WC : 0;
    return 0;
  }
  function warPoints(st) {
    const car = st.car, w = warW(st.me);
    // 시즌별 WAR를 리그 가중치로 합산 (예전 저장처럼 기록이 비어 있으면 통산 WAR 그대로)
    let sum = 0, seen = 0;
    for (const h of st.hist) if (h.war != null && (h.lg === 'KBO' || h.lg === 'NPB' || h.lg === 'MLB' || h.lg == null)) { sum += h.war * lgW(h.lg || 'KBO'); seen += h.war; }
    sum += car.war - seen;   // 기록 줄에 안 잡힌 나머지(있다면)는 가중치 1
    return sum * w / BAL.warScale * 10;
  }
  function careerScore(st) {
    const car = st.car;
    const ach = car.achPts == null ? legacyAch(st) : car.achPts;
    const s = warPoints(st) + ach * BAL.score.achK;
    return Math.max(0, Math.round(s));   // 41차: 통산 WAR가 마이너스여도 점수는 0점 아래로 내려가지 않는다
  }
  function scoreParts(st) { const ach = st.car.achPts == null ? legacyAch(st) : st.car.achPts; return { war: Math.round(warPoints(st)), ach: Math.round(ach * BAL.score.achK) }; }
  // 23차: 명예의 전당 (BAL.hof). 62차: 기준 목록 중 need개(2개) 이상을 채워야 헌액
  //   hofGoals: 화면에 보여 줄 기준 목록 — t 기준 이름, cur 현재 값, ok 달성 여부, why 헌액 사유 문구
  function hofGoals(st) {
    const car = st.car, H = BAL.hof, a = car.aw || {}, b = car.bat || {}, p = car.pit || {};
    const war = car.war || 0, peakOVR = disp(car.peak || 0);
    const golds = (car.intlRec || []).filter(t => t.result === '금메달' || t.result === '우승').length;
    const bestWar = st.hist.reduce((m, h) => h.war != null && h.war > m ? h.war : m, 0);
    const mlbN = st.hist.filter(h => h.lg === 'MLB' && h.lvl === '1군').length;
    const ops = b.PA ? OPS(b) : 0, era = p.outs ? ERA(p) : 0;
    const G = [
      { t: `통산 WAR ${H.war}`, cur: war.toFixed(1), ok: war >= H.war, why: `통산 WAR ${war.toFixed(1)}` },
      { t: `MVP ${H.mvp}회`, cur: `${a.MVP || 0}회`, ok: (a.MVP || 0) >= H.mvp, why: `MVP ${a.MVP}회` },
      { t: `우승 ${H.titles}회 + 통산 WAR ${H.titlesWar}`, cur: `${a.KS || 0}회 · WAR ${war.toFixed(1)}`, ok: (a.KS || 0) >= H.titles && war >= H.titlesWar, why: `우승 ${a.KS}회 · WAR ${war.toFixed(1)}` },
      { t: `최고 OVR ${H.peakOVR} + 통산 WAR ${H.peakWar}`, cur: `OVR ${peakOVR}`, ok: peakOVR >= H.peakOVR && war >= H.peakWar, why: `최고 OVR ${peakOVR}` },
      { t: `시즌 WAR ${H.seasonWar}`, cur: bestWar.toFixed(1), ok: bestWar >= H.seasonWar, why: `시즌 WAR ${bestWar.toFixed(1)}` },
      { t: `골든글러브 ${H.gg}회`, cur: `${a.GG || 0}회`, ok: (a.GG || 0) >= H.gg, why: `골든글러브 ${a.GG}회` },
      { t: `개인 타이틀 ${H.title}회`, cur: `${a.TITLE || 0}회`, ok: (a.TITLE || 0) >= H.title, why: `개인 타이틀 ${a.TITLE}회` },
      { t: `시리즈 MVP ${H.smvp}회`, cur: `${a.KSMVP || 0}회`, ok: (a.KSMVP || 0) >= H.smvp, why: `시리즈 MVP ${a.KSMVP}회` },
      { t: `국제대회 금메달·우승 ${H.intlGold}회`, cur: `${golds}회`, ok: golds >= H.intlGold, why: `국제대회 금메달·우승 ${golds}회` },
      { t: `메이저리그 1군 ${H.mlb}시즌`, cur: `${mlbN}시즌`, ok: mlbN >= H.mlb, why: `메이저리그 ${mlbN}시즌` },
      { t: `이도류 시즌 ${H.twoWay}회`, cur: `${car.twoWaySeasons || 0}회`, ok: (car.twoWaySeasons || 0) >= H.twoWay, why: `이도류 시즌 ${car.twoWaySeasons}회`, k: 'tw' },
      { t: `통산 ${H.hits}안타`, cur: `${b.H || 0}안타`, ok: (b.H || 0) >= H.hits, why: `통산 ${b.H}안타`, k: 'B' },
      { t: `통산 ${H.hr}홈런`, cur: `${b.HR || 0}홈런`, ok: (b.HR || 0) >= H.hr, why: `통산 ${b.HR}홈런`, k: 'B' },
      { t: `통산 ${H.sb}도루`, cur: `${b.SB || 0}도루`, ok: (b.SB || 0) >= H.sb, why: `통산 ${b.SB}도루`, k: 'B' },
      { t: `통산 OPS ${rate3(H.ops[1])} (${H.ops[0]}타석 이상)`, cur: b.PA ? `${rate3(ops)} · ${b.PA}타석` : '-', ok: (b.PA || 0) >= H.ops[0] && ops >= H.ops[1], why: `통산 OPS ${rate3(ops)}`, k: 'B' },
      { t: `통산 ${H.wins}승`, cur: `${p.W || 0}승`, ok: (p.W || 0) >= H.wins, why: `통산 ${p.W}승`, k: 'P' },
      { t: `통산 ${H.saves}세이브`, cur: `${p.SV || 0}세이브`, ok: (p.SV || 0) >= H.saves, why: `통산 ${p.SV}세이브`, k: 'P' },
      { t: `통산 ${H.ks}탈삼진`, cur: `${p.K || 0}탈삼진`, ok: (p.K || 0) >= H.ks, why: `통산 ${p.K}탈삼진`, k: 'P' },
      { t: `통산 ERA ${H.era[1].toFixed(2)} (${H.era[0] / 3}이닝 이상)`, cur: p.outs ? `${era.toFixed(2)} · ${ipTxt(p)}이닝` : '-', ok: (p.outs || 0) >= H.era[0] && era <= H.era[1], why: `통산 ERA ${era.toFixed(2)}`, k: 'P' },
      { t: `올해의 투수상 ${H.poy}회`, cur: `${a.POY || 0}회`, ok: (a.POY || 0) >= H.poy, why: `올해의 투수상 ${a.POY}회`, k: 'P' },
    ];
    return G;
  }
  function hofCheck(st) {
    const H = BAL.hof, why = hofGoals(st).filter(g => g.ok).map(g => g.why);
    return { in: why.length >= (H.need || 1), why, need: H.need || 1, year: st.year - 1 };
  }
  // 52차: 프로에서 가장 많이 뛴 팀·포지션 (1군 출전량 기준 — 타석 + 아웃카운트×1.5, 1군 기록이 없으면 2군 포함)
  function mainTeamPos(st) {
    const me = st.me, rows = st.hist.filter(h => h.teamId && (h.lg === 'KBO' || h.lg === 'NPB' || h.lg === 'MLB'));
    const vol = h => (h.bat && !h.bat.fut ? h.bat.PA || 0 : 0) + (h.pit && !h.pit.fut ? (h.pit.outs || 0) * 1.5 : 0);
    let use = rows.filter(h => vol(h) > 0);
    const w = use.length ? vol : () => 1;
    if (!use.length) use = rows;
    const tally = (keyOf) => { const m = {}; for (const h of use) { const k = keyOf(h); if (k) m[k] = (m[k] || 0) + w(h); } return Object.keys(m).sort((a, b) => m[b] - m[a])[0] || null; };
    const tid = tally(h => h.teamId), pos = tally(h => h.pos === 'OF' ? h.ofPos || me.ofPos || 'OF' : h.pos) || (me.twoWay ? 'TW' : me.pos === 'OF' && me.ofPos ? me.ofPos : me.pos);
    const row = use.find(h => h.teamId === tid);
    return { teamId: tid || me.team || null, teamName: row ? row.team : (me.team ? teamName(st, me.team) : ''), pos };
  }
  // 52차: 커리어 한줄평 — 기록에 맞는 문장 하나 (위에서부터 먼저 맞는 것)
  function careerLine(st, f) {
    const me = st.me, car = st.car, a = car.aw, P = POSNAME[f.mainPos] || (f.mainPos === 'TW' ? '이도류' : '선수');
    const mlb = st.hist.filter(h => h.lg === 'MLB' && h.war != null).length, npb = st.hist.filter(h => h.lg === 'NPB' && h.war != null).length;
    const peakAge = car.peakYears && car.peakYears.length ? car.peakYears[0].age : null;
    const undrafted = !me.draft || me.draft.round === '육성';
    const teams = new Set(st.hist.filter(h => h.teamId && h.lg === 'KBO').map(h => h.teamId)).size;
    const L = [];
    if (car.twoWaySeasons >= 3) L.push(`투타를 모두 지배한, 다시 나오기 힘든 이도류 ${f.hof.in ? '전설' : '스타'}`);
    if (f.hof.in && (a.MVP || 0) >= 3) L.push(`MVP ${a.MVP}회, 한 시대를 지배한 명예의 전당 ${P}`);
    if (mlb >= 5 && f.war >= WS(40)) L.push(`메이저리그를 호령한 한국 야구의 자존심, ${P} ${me.name}`);
    if (f.hof.in && undrafted) L.push(`지명받지 못한 소년에서 명예의 전당까지 — 야구 역사에 남을 역전극`);
    if (f.hof.in && teams <= 1) L.push(`한 팀의 유니폼만 입고 명예의 전당에 오른 영원한 프랜차이즈 ${P}`);
    if (f.hof.in) L.push(`기록과 기억 모두에 이름을 새긴 명예의 전당 ${P}`);
    if ((a.KS || 0) >= 4) L.push(`우승 반지 ${a.KS}개, 큰 경기에 강했던 우승 청부사`);
    if (mlb >= 2) L.push(`메이저리그의 벽에 도전했던 ${P}`);
    if (npb >= 3) L.push(`일본 무대에서도 실력을 증명한 ${P}`);
    if (peakAge != null && peakAge >= 31 && f.war >= WS(20)) L.push(`서른 넘어 꽃피운 대기만성형 ${P}`);
    if (undrafted && f.war >= WS(15)) L.push(`미지명의 설움을 실력으로 갚은 노력파 ${P}`);
    if ((a.MVP || 0) >= 1) L.push(`MVP의 영광을 안은 시대의 ${P}`);
    if ((a.POY || 0) >= 1) L.push(`리그 최고의 투수로 우뚝 섰던 에이스`);
    if (f.war >= WS(40)) L.push(`꾸준함으로 리그를 지탱한 정상급 ${P}`);
    if (f.war >= WS(20)) L.push(`팀의 중심을 오래 지킨 믿음직한 ${P}`);
    if ((car.ms || []).some(n => { const m = MILESTONES.find(x => x[2] === n); return m && m[3] > 0; })) L.push(`꾸준히 기록을 쌓아 올린 성실한 ${P}`);
    if (me.everStarter) L.push(`한때 주전으로 그라운드를 누볐던 ${P}`);
    if (me.debut != null) L.push(`1군 무대를 밟아 본 것만으로도 빛났던 야구 인생`);
    L.push('프로의 꿈을 끝까지 쫓았던 야구 소년');
    return L[0];
  }
  function finalCard(st) {
    const me = st.me, car = st.car;
    const keys = mainKeys(me);
    const paRate = Math.round(100 * avgKeys(st.car.peakR || me.r, keys) / avgKeys(me.pa, keys));
    const mtp = mainTeamPos(st);
    const f = {
      mainTeam: mtp.teamId, mainTeamName: mtp.teamName, mainPos: mtp.pos,
      hof: hofCheck(st),
      name: me.name, pos: me.pos, twoWay: me.twoWay, retireAge: me.age, score: careerScore(st), war: car.war, warB: car.warB, warP: car.warP,
      bat: car.bat, pit: car.pit, aw: car.aw, awList: car.awList, ms: car.ms, earnings: me.earnings + (me.bonus || 0),
      tier: me.tier, growth: me.growth, aging: me.aging, paRate: Math.min(100, paRate), peak: Math.round(car.peak),
      teams: Array.from(new Set(st.hist.filter(h => h.lvl === '1군' || h.lvl === '2군').map(h => h.team))),
      seasons: st.hist.length, story: st.story.slice(), draft: me.draft,
      peakInfo: !me.peak ? { none: true } : (car.peakYears && car.peakYears.length
        ? { from: car.peakYears[0].age, to: car.peakYears[car.peakYears.length - 1].age, war: car.peakYears.reduce((a, y) => a + y.war, 0) }
        : { missed: true, from: me.peak.from }),
    };
    f.oneLine = careerLine(st, f);
    return f;
  }

  // ================================================================
  // 전환점 / 결정
  // ================================================================
  function queue(st, id, ctx) {
    const ev = EVMAP[id];
    if (!ev) return;
    const me = st.me;
    const item = { id, ctx: ctx || {}, who: ev.who, cat: ev.cat };
    item.ctx._lg = cfgOf(st.lg).id;   // 13차: 큐에 넣을 때의 리그 (그 사이 리그를 옮기면 이 결정은 건너뛴다)
    if (ev.prep) ev.prep(st, me, item.ctx);
    item.text = typeof ev.text === 'function' ? ev.text(st, me, item.ctx) : ev.text;
    item.ch = typeof ev.ch === 'function' ? ev.ch(st, me, item.ctx) : ev.ch.slice();
    item.safe = typeof ev.safe === 'function' ? ev.safe(st, me, item.ctx) : (ev.safe || 0);
    if (!item.ch.length) return;
    item.ctx._labels = item.ch.slice();
    st.pending.push(item);
    if (!ev.repeat) me.used[id] = true;
  }
  function choose(st, idx) {
    bind(st);
    const item = st.pending.shift();
    if (!item) return null;
    const ev = EVMAP[item.id];
    const me = st.me;
    if (item.ctx && item.ctx._lg && item.ctx._lg !== cfgOf(st.lg).id && item.id !== 'enlist') return { reaction: '(소속 리그가 바뀌어 이 일은 없던 일이 됐다.)', done: st.done, hints: [], verdict: null };
    const before = snapMe(me);
    const reaction = ev.res(st, me, idx, item.ctx) || '';
    const hint = effectHint(st, before, snapMe(me));
    // 17차: 고교를 떠나는 순간(프로·대학·독립리그) 투수 보직을 고른다
    if (before.stage === 'hs' && me.stage !== 'hs' && me.stage !== 'retired' && !st.done && me.role === 'P' && !me.twoWay && !me.flags.roleChosen) { queue(st, 'pitRole'); st.pending.unshift(st.pending.pop()); }
    const intl = st._intlRes || null; delete st._intlRes;
    return { reaction, done: st.done, hints: hint.hints, verdict: hint.verdict, intl };
  }
  // ---------- 선택 결과 짐작 멘트 ----------
  // 선택 직후 바뀐 값(능력치·신뢰·관리·인기·돈·플래그)을 보고 정확한 수치 없이 방향만 알려준다.
  function snapMe(me) {
    return { r: Object.assign({}, me.r), trust: me.trust, care: me.care, pop: me.pop, earnings: me.earnings, salary: me.salary, lvl: me.lvl, team: me.team, pos: me.pos, stage: me.stage, flags: JSON.parse(JSON.stringify(me.flags || {})) };
  }
  const FLAG_HINT = {
    camp: [1, '캠프 컨디션이 좋다. 시즌 초반이 기대된다.'],
    slump: [-1, '왠지 다음 시즌 타격감이 불안하다.'],
    slowStart: [-1, '시즌 초반 출발이 늦을 것 같다.'],
    hsTeamBoost: [1, '팀 분위기가 한껏 올랐다.'],
    hsPlayDown: [-1, '다음 시즌 출전 기회가 줄 것 같다.'],
    slowDecline: [1, '나이가 들어도 오래 버틸 몸을 만들고 있다.'],
    utility: [1, '설 수 있는 자리가 넓어졌다.'],
    outSeason: [-1, '한동안 경기에 나설 수 없다.'],
    missSegs: [-1, '복귀까지 시간이 좀 걸린다.'],
    adjust: [0, '새 환경 적응이 변수다.'],
    bigAgent: [0, '협상 테이블에서 든든한 편이 생겼다.'],
    proOnly: [0, '프로 아니면 안 된다. 배수의 진을 쳤다.'],
  };
  function effectHint(st, a, b) {
    const me = st.me, hints = [];
    let score = 0;
    const add = (s, t) => { hints.push({ s, t }); score += s; };
    // 능력치 (주 능력 기준, 수치는 숨김)
    const keys = me.twoWay ? ALL : mainKeys(me);
    let sum = 0, bestK = null, bestV = 0;
    for (const k of ALL) { const d = b.r[k] - a.r[k]; if (keys.indexOf(k) >= 0) sum += d; if (Math.abs(d) > Math.abs(bestV)) { bestV = d; bestK = k; } }
    if (bestK && Math.abs(bestV) >= 0.5) {
      const lbl = LABEL[bestK];
      if (bestV > 0) add(sum >= 5 ? 2 : 1, sum >= 5 ? `${lbl} 쪽에서 확실히 뭔가 잡혔다.` : `${lbl} 감각이 조금 좋아진 것 같다.`);
      else add(sum <= -5 ? -2 : -1, sum <= -5 ? `${josa(lbl, '이', '가')} 크게 흐트러졌다.` : `${lbl} 감각이 살짝 무뎌졌다.`);
    }
    // 나중에 돌아올 수도 있는 능력치(restore)
    const ra = a.flags.restore || {}, rb = b.flags.restore || {};
    if (Object.keys(rb).some(k => (rb[k] || 0) > (ra[k] || 0))) add(0, '당장은 손해 같지만, 몸에 익으면 돌아올 수도 있다.');
    if (b.trust - a.trust >= 3) add(1, '감독의 신뢰를 얻은 것 같다.'); else if (b.trust - a.trust <= -3) add(-1, '감독과의 사이가 서먹해졌다.');
    if (b.care > a.care) add(1, '몸 관리에는 도움이 될 것 같다.'); else if (b.care < a.care) add(-1, '몸에 조금 무리가 간 것 같다.');
    if (b.pop - a.pop >= 3) add(1, '팬들의 관심이 커졌다.'); else if (b.pop - a.pop <= -2) add(-1, '여론이 조금 나빠졌다.');
    if (b.earnings < a.earnings) add(0, '돈이 꽤 들었다.');
    if (a.salary > 0 && b.salary > a.salary) add(1, '연봉이 올랐다.');
    if (b.lvl === 2 && a.lvl === 1 && b.team === a.team) add(-1, '2군으로 내려가게 됐다.');
    if (b.team !== a.team && a.team && b.team) add(0, '새 유니폼을 입는다. 새 출발이다.');
    if (b.pos !== a.pos) add(0, `${josa(POSNAME[b.pos], '으로', '로')} 새 도전. 적응이 관건이다.`);
    const ia = a.flags.injRisk || 0, ib = b.flags.injRisk || 0;
    if (ib > ia) add(-1, '몸 어딘가가 찜찜하다. 부상을 조심해야겠다.');
    for (const k in FLAG_HINT) if (b.flags[k] && !a.flags[k]) add(FLAG_HINT[k][0], FLAG_HINT[k][1]);
    if (b.flags.tjPending === false && a.flags.tjPending) { /* 통증을 참고 던진 경우: care·risk로 이미 표시 */ }
    if (!hints.length || b.stage === 'retired') return { hints: [], verdict: null };
    const pos = hints.some(h => h.s > 0), neg = hints.some(h => h.s < 0);
    const verdict = score >= 2 ? '좋은 선택이었던 것 같다.' : score >= 1 && !neg ? '나쁘지 않은 선택이다.' : score <= -2 ? '좋지 않은 선택이었을지도 모른다.' : score <= -1 && !pos ? '조금 아쉬운 결과다.' : pos && neg ? '얻은 것도, 잃은 것도 있다.' : '결과는 시간이 말해줄 것이다.';
    return { hints: hints.slice(0, 4), verdict };
  }

  // 팀 가입
  function joinTeam(st, teamId, how) {
    const me = st.me;
    me.stage = 'pro'; me.team = teamId; me.lvl = 2;
    if (me.faAt == null) me.faAt = me.origin === 'univ' ? 7 : 8;
    if (!me.salary) me.salary = BAL.minSal;
    me.rival = null;
  }
  function moveTeam(st, teamId) { st.me.team = teamId; st.me.lvl = 2; }
  function teamName(st, id) { const t = teamById(st, id) || findTeam(st, id); return t ? t.name : id; }
  // 조사: 받침 있으면 a, 없으면 b (영문 약칭은 받침 없음으로 처리)
  function josa(word, a, b) {
    const ch = String(word).charCodeAt(String(word).length - 1);
    if (ch >= 0xAC00 && ch <= 0xD7A3) { const jong = (ch - 0xAC00) % 28; if (a === '으로' && jong === 8) return word + b; return word + (jong ? a : b); }
    return word + b;
  }
  const tj = (st, id, a, b) => josa(teamName(st, id), a, b);
  function man(v) { // 만원 → 표시
    if (v >= 10000) { const e = v / 10000; return (e >= 10 ? Math.round(e) : Math.round(e * 10) / 10) + '억 원'; }
    return Math.round(v).toLocaleString() + '만 원';
  }
  function pickBetterTeam(st, exclude) {
    const me = st.me, mo = myVal(me) - (me.lvPen || 0);
    const cands = st.lg.teams.filter(t => t.id !== exclude && groupLowest(st, t, GROUP[me.pos]) < mo + 2);
    return cands.length ? R.pick(cands).id : null;
  }

  const EVENTS = [
    // ---------------- 강제 결정 ----------------
    {
      id: 'twoway', forced: true, cat: '고교', who: '감독',
      text: (st, me) => `"너, ${me.role === 'P' ? '배트 돌리는 것도 예사롭지 않더라' : '마운드에서 던지는 공도 보통이 아니던데'}. 둘 다 해볼 생각 있냐?"`,
      ch: ['둘 다 해본다 (이도류)', '한쪽에 집중한다'], safe: 1,
      res: (st, me, i) => {
        if (i === 0) { me.twoWay = true; me.twoWayChosen = true; story(st, `${me.age}세, 이도류의 길에 들어섰다.`); return '감독이 씩 웃었다. "힘들 거다. 그래도 해볼 가치는 있지."'; }
        me.focus = 1.1; return '"그래, 한 우물만 파는 것도 재능이다."';
      },
    },
    {
      id: 'draft', forced: true, cat: '입단', who: '구단 스카우트',
      prep: (st, me, ctx) => {
        let s = scoutScore(st) + R.range(-BAL.draftNoise, BAL.draftNoise);
        s = Math.max(s, ovrFloor(me));   // 26차: 노이즈가 능력치 바닥 아래로 끌어내리지 않게
        ctx.score = s;
        if (s < BAL.draftCut) { ctx.pick = null; return; }
        let pick; const db = BAL.draftBand;
        if (s >= db[0]) pick = R.int(1, 3); else if (s >= db[1]) pick = R.int(4, 10); else if (s >= db[2]) pick = R.int(11, 30);
        else if (s >= db[3]) pick = R.int(31, 70); else pick = R.int(71, 110);
        const order = st.lg.lastStand.slice().reverse();
        // 52차: 연고 구단 우선 관심 — 상위 라운드감(2~3라운드 이상)이면 연고 구단이 같은 라운드의 자기 순번에서 먼저 지명할 수 있다
        const hi = order.indexOf(me.hometown);
        if (me.stage === 'hs' && hi >= 0 && s >= db[2] && R.chance(s >= db[1] ? BAL.regionPick[0] : BAL.regionPick[1])) {
          const rd = Math.ceil(pick / 10); pick = (rd - 1) * 10 + hi + 1; ctx.regional = true;
        }
        ctx.pick = pick; ctx.round = Math.ceil(pick / 10); ctx.inRound = (pick - 1) % 10 + 1; ctx.team = order[(pick - 1) % 10];
        const bonusT = [[db[0], 30000, 50000], [db[1], 15000, 30000], [db[2], 7000, 15000], [db[3], 4000, 7000], [0, 2500, 3500]];
        const b = bonusT.find(x => s >= x[0]);
        ctx.bonus = Math.round(R.range(b[1], b[2]) / 100) * 100;
      },
      text: (st, me, c) => c.pick
        ? `${st.year} 신인 드래프트. ${c.round}라운드 ${c.inRound}순위(전체 ${c.pick}순위) — ${c.regional ? `연고 구단 ` : ''}${tj(st, c.team, '이', '가')} ${me.name}의 이름을 불렀다.${c.regional ? ' 고향 팬들이 환호했다.' : ''} 계약금 ${man(c.bonus)} 제안.`
        : `${st.year} 신인 드래프트. 110명의 이름이 불렸지만, 끝내 ${me.name}의 이름은 없었다.`,
      ch: (st, me, c) => c.pick ? (c.round <= 2 ? ['바로 서명한다', '계약금을 더 요구하며 버틴다'] : ['서명한다'])
        // 14차: 미지명 → 대학 / 육성선수 입단 테스트(합격·불합격) / 독립리그
        : (me.stage === 'univ' ? ['육성선수 입단 테스트', '독립리그', '야구를 그만둔다']
          : (me.flags.proOnly ? ['육성선수 입단 테스트', '독립리그'] : ['대학 진학', '육성선수 입단 테스트', '독립리그'])),
      safe: 0,
      res: (st, me, i, c) => {
        if (c.pick) {
          let bonus = c.bonus, txt = '펜을 드는 손이 조금 떨렸다.';
          if (i === 1) { if (R.chance(0.6)) { bonus = Math.round(bonus * 1.2); txt = '며칠 줄다리기 끝에 구단이 한발 물러섰다.'; } else { me.trust -= 8; me.pop -= 3; txt = '"신인이 벌써부터…" 기사 댓글이 곱지 않다.'; } }
          else me.trust += 5;
          me.bonus = bonus; me.draft = { year: st.year, round: c.round, pick: c.pick, team: c.team };
          joinTeam(st, c.team, 'draft');
          story(st, `${st.year} 드래프트 ${c.round}라운드 ${c.inRound}순위로 ${teamName(st, c.team)} 지명. 계약금 ${man(bonus)}.`, true);
          queue(st, 'camp'); queue(st, 'number');
          return txt;
        }
        return undraftedChoice(st, me, i, c);
      },
    },
    {
      id: 'tryout', forced: true, cat: '입단', who: '독립리그 감독',
      prep: (st, me, c) => { c.team = R.pick(st.lg.teams).id; },
      text: (st, me, c) => `시즌 막바지 트라이아웃. ${teamName(st, c.team)} 스카우트가 다가왔다. "육성선수로 한번 해보자."`,
      ch: ['계약한다', '한 시즌 더 독립리그에서'], safe: 0,
      res: (st, me, i, c) => {
        if (i === 0) { me.origin = me.origin || 'hs'; joinTeam(st, c.team); me.salary = BAL.minSal; me.draft = me.draft || { year: st.year, round: '육성', pick: null, team: c.team }; story(st, `독립리그를 거쳐 ${tj(st, c.team, '과', '와')} 육성선수 계약. 역전극의 시작.`); return '다시 프로의 문을 열었다.'; }
        return '아직 보여줄 게 남았다.';
      },
    },
    {
      // 14차: 국가대표 소집 — 수락하면 대회를 경기별로 시뮬레이션
      id: 'intlCall', forced: true, cat: '국가대표', who: '대표팀 감독',
      text: (st, me, c) => { const T = BAL.intl.find(x => x.id === c.tid); return `${c.year} ${T.name} 국가대표 최종 명단에 ${me.name}의 이름이 올랐다.${T.exempt ? (T.id === 'AG' ? ' 금메달이면 병역 혜택이 걸려 있다.' : ' 메달을 따면 병역 혜택이 걸려 있다.') : ''} 태극마크를 달겠나?`; },
      ch: (st, me, c) => { const T = BAL.intl.find(x => x.id === c.tid); return [`태극마크를 단다 (${T.name} 출전)`, '고사한다 (컨디션 관리)']; },
      safe: 0,
      res: (st, me, i, c) => {
        const T = BAL.intl.find(x => x.id === c.tid);
        if (i !== 0) { me.pop -= 4; story(st, `${c.year} ${T.name} 국가대표 소집을 고사했다.`); return '"이번엔 소속팀에 집중하겠습니다." 기사 댓글이 곱지 않다.'; }
        const r = playIntl(st, T); r.year = c.year;
        me.pop += r.medal ? 12 : 5;
        story(st, `${c.year} ${T.name} 국가대표 출전 — ${r.result}.`);
        st.car.intl = (st.car.intl || []).concat([`${c.year} ${T.name} ${r.result}`]);
        // 28차: 국가대표 기록 (역대 커리어·대회별 탭용)
        const gB = r.games.filter(g => /타수/.test(g.me)).length, gP = r.games.filter(g => /이닝/.test(g.me)).length;
        st.car.intlRec = (st.car.intlRec || []).concat([{ year: c.year, age: me.age - 1, name: T.name, result: r.result, rank: r.rank, field: r.field, medal: r.medal, awards: r.awards.slice(), bat: r.bat ? Object.assign({}, r.bat, { G: gB }) : null, pit: r.pit ? Object.assign({}, r.pit, { G: gP }) : null }]);
        if (r.medal) st.car.awList.push(`${c.year} ${T.name} ${r.result}`);
        { const p = intlAchPts(T.name, r.result); if (p) { if (st.car.achPts == null) st.car.achPts = 0; st.car.achPts += p; } }   // 52차: 국제대회 우승·메달도 커리어 점수에
        for (const a of r.awards) { st.car.awList.push(`${c.year} ${T.name} ${a}`); story(st, `${c.year} ${T.name} ${a}.`); }
        if (r.exempt && !me.milDone) {
          me.milDone = true; me.milExempt = `${c.year} ${T.name} ${r.result}`; r.milGranted = true; story(st, `${T.name} ${r.result}로 병역 혜택을 받았다.`);
          // 47차: 같은 겨울에 이미 올라와 있던 입영 통지·입대 권유는 취소 (27세 시즌 혜택이 28세 입영보다 늦게 처리되던 문제)
          st.pending = st.pending.filter(p => p.id !== 'enlist');
        }
        st._intlRes = r;
        // 24차: 결과는 대회 화면에서 경기가 다 끝난 뒤 공개 — 여기서는 합류만 알린다
        r.closing = /금메달|^우승/.test(r.result) ? '시상대 맨 위에서 애국가가 울려 퍼졌다.' : r.medal ? '시상대에 올라 메달을 목에 걸었다. 다음엔 맨 위에 서겠다.' : '아쉬움을 안고 귀국길에 올랐다.';
        return '태극마크가 달린 유니폼을 받았다. 대표팀 숙소로 향한다.';
      },
    },
    {
      // 31차: 구단 주도 트레이드 — 주전을 못 잡은 선수를 다른 구단(3년차면 약팀)으로 보낸다
      id: 'clubTrade', forced: true, cat: '트레이드', who: '단장',
      prep: (st, me, c) => {
        const order = (st.lg.lastStand || st.lg.teams.map(t => t.id)).filter(id => id !== me.team);
        c.team = c.weak ? R.pick(order.slice(-BAL.clubTrade.weakN)) : R.pick(order);
      },
      text: (st, me, c) => c.weak
        ? `입단 ${me.proSeasons}년째, 아직 주전 자리를 잡지 못했다. 단장이 불렀다. "${teamName(st, c.team)}에서 너를 원한다. 거기선 바로 기회를 줄 거다." 리그 하위권 구단으로의 트레이드가 결정됐다.`
        : `입단 ${me.proSeasons}년째 시즌이 끝났다. 단장실에서 연락이 왔다. "${tj(st, c.team, '과', '와')} 트레이드가 성사됐다. 새 팀에서 경쟁해 봐라."`,
      ch: (st, me, c) => [`${teamName(st, c.team)} 유니폼을 입는다`],
      safe: 0,
      res: (st, me, i, c) => {
        moveTeam(st, c.team); me.flags.adjust = true; me.noFirst = 0;
        story(st, `${me.age}세, ${tj(st, c.team, '으로', '로')} 트레이드${c.weak ? ' (하위권 구단, 주전 기회를 찾아서)' : ''}.`);
        return c.weak ? '짐을 싸면서 생각했다. 여기서는 반드시 자리를 잡는다.' : '낯선 라커룸, 새 등번호. 처음부터 다시 증명해야 한다.';
      },
    },
    {
      // 14차: 육성선수 입단 테스트 — 스카우트 점수가 지명 기준선에 가까울수록 합격 확률이 높다. 떨어지면 독립리그뿐
      id: 'devTest', forced: true, cat: '입단', who: '구단 육성 담당',
      prep: (st, me, c) => {
        const s = c.score != null ? c.score : scoutScore(st);
        c.p = clamp(0.15 + (s - (BAL.draftCut - BAL.devGap)) * 0.05, 0.05, 0.6) * (me.stage === 'univ' ? 0.35 : 1);
        c.pass = R.chance(c.p);
        if (c.pass) c.team = R.pick(st.lg.teams).id;
      },
      text: (st, me, c) => c.pass ? `입단 테스트 결과 발표. ${teamName(st, c.team)}에서 연락이 왔다. "육성선수로 같이 해보자."` : '입단 테스트를 몇 군데 봤다. …어느 구단도 육성선수로 받아주지 않았다.',
      ch: (st, me, c) => { c.opts = c.pass ? ['sign'] : [me.stage === 'hs' && !me.flags.proOnly ? 'univ' : null, 'indie', 'quit'].filter(Boolean); return c.opts.map(o => ({ sign: '육성선수 계약을 맺는다', univ: '대학 진학', indie: '독립리그에서 다시 도전', quit: '야구를 그만둔다' }[o])); },
      safe: 0,
      res: (st, me, i, c) => {
        const o = c.opts[i];
        if (o === 'sign') { joinTeam(st, c.team); me.salary = BAL.minSal; me.draft = { year: st.year, round: '육성', pick: null, team: c.team }; story(st, `육성선수 입단 테스트 합격. ${tj(st, c.team, '과', '와')} 육성선수 계약.`); return '등번호는 세 자리였다. 그래도 프로 유니폼이다.'; }
        if (o === 'univ') { me.stage = 'univ'; me.origin = 'univ'; me.univYears = 0; me.univTeam = null; queue(st, 'univPick'); st.pending.unshift(st.pending.pop()); me.scout.perf = []; me.scout.tourn = []; me.scout.bonus = 0; story(st, '육성선수 테스트 탈락. 대학에서 4년 뒤를 노린다.'); return '대학 캠퍼스의 야구장은 생각보다 작았다.'; }
        if (o === 'indie') { goClub(st, '육성선수 테스트 탈락. 독립리그에서 프로의 문을 다시 두드린다.'); return '버스로 원정을 다니는 리그. 그래도 매일 경기에 나간다.'; }
        retire(st, '드래프트도, 입단 테스트도 통과하지 못했다. 야구를 그만두었다.'); return '글러브를 벽장에 넣었다.';
      },
    },
    {
      // 17차: 고교 졸업 후 투수 보직 선택
      id: 'pitRole', forced: true, cat: '보직', who: '투수코치',
      text: (st, me) => `고교 시절엔 선발로만 던졌다. ${me.stage === 'pro' ? '프로' : me.stage === 'univ' ? '대학' : '독립리그'}에서는 어떤 투수가 될까?`,
      ch: ['선발투수 (긴 이닝, 체력이 중요)', '불펜투수 (짧고 굵게)', '마무리투수 (9회를 책임진다)'], safe: 0,
      res: (st, me, i) => {
        me.flags.roleChosen = true;
        if (i === 0) { me.pos = 'SP'; me.flags.closer = false; return '"로테이션 한 자리를 노려보자."'; }
        me.pos = 'RP'; me.flags.closer = i === 2;
        story(st, `${me.age}세, ${i === 2 ? '마무리' : '불펜'} 투수로 새 출발.`);
        return i === 2 ? '등장 음악부터 골라야겠다.' : '"한 이닝, 전력으로."';
      },
    },
    {
      // 12차: 입대 (기한 도래 또는 조기 입대 제안)
      id: 'enlist', forced: true, cat: '병역', who: '구단 매니저',
      prep: (st, me, c) => { c.sangmu = myOVR(me) >= BAL.mil.sangmuOVR; },
      text: (st, me, c) => (c.due ? '"입영 통지서가 나왔다. 더는 미룰 수 없다."' : c.push && c.sangmu ? `"상무 지원 기준을 넘었다. 입영 기한(${BAL.mil.deadline}세)까지 ${BAL.mil.deadline - me.age}년 — 올해 상무에 지원해 보는 건 어때?"`
        : c.push ? `"병역이 아직 남아 있다. 입영 기한(${BAL.mil.deadline}세)까지 ${BAL.mil.deadline - me.age}년 — 지금 현역으로 다녀오는 것도 방법이다."` : '"1군 자리가 쉽게 안 난다. 지금 군 문제를 해결하는 것도 방법이야."')
        + (c.push && c.sangmu ? '' : c.sangmu ? ' 상무에서 받아줄 수 있다는 연락이 왔다.' : ' 상무 지원 기준에는 아직 못 미친다.'),
      ch: (st, me, c) => { c.opts = [c.sangmu ? 'sangmu' : null, 'active', c.due ? null : 'later'].filter(Boolean); return c.opts.map(o => ({ sangmu: '상무 입단 (퓨처스리그에서 계속 뛴다)', active: '현역 입대 (2년간 야구 중단)', later: '아직은 미룬다' }[o])); },
      safe: (st, me, c) => c.due ? 0 : c.opts.length - 1,
      res: (st, me, i, c) => {
        const o = c.opts[i];
        if (me.milDone) return '병역 혜택으로 입대할 필요가 없어졌다.';   // 47차: 안전장치
        if (o === 'later') return '"그래, 1년만 더 버텨보자."';
        enlist(st, o);
        return o === 'sangmu' ? '군복 위에 상무 유니폼. 야구는 계속된다.' : '머리를 짧게 깎았다. 2년 뒤를 기약한다.';
      },
    },
    {
      // 11차: 진학할 대학 고르기 — 스카우트 점수가 높을수록 강팀 입학 제안이 온다
      id: 'univPick', forced: true, cat: '진학', who: '고교 감독',
      prep: (st, me, c) => {
        const L = st.L.UNIV, order = (L.standings || L.teams).map(s => s.id);
        const s = me.scout.score || 40, top = s >= 50 ? 0 : s >= 42 ? 2 : 4;
        const pool = order.slice(top, top + 7);
        c.opts = [];
        while (c.opts.length < 4 && pool.length) c.opts.push(pool.splice(R.int(0, pool.length - 1), 1)[0]);
        c.opts.sort((a, b) => order.indexOf(a) - order.indexOf(b));
      },
      text: '"대학 몇 군데서 연락이 왔다. 어디로 갈래?"',
      ch: (st, me, c) => c.opts.map(id => { const sd = (st.L.UNIV.standings || []).find(x => x.id === id); return `${teamName(st, id)}${sd ? ` (작년 대학리그 ${sd.rank}위)` : ''}`; }),
      safe: 0,
      res: (st, me, i, c) => { me.univTeam = c.opts[i] || c.opts[0]; story(st, `${teamName(st, me.univTeam)} 야구부에 입학했다.`); return '새 유니폼에 학교 이름이 박혀 있었다.'; },
    },
    {
      id: 'univDev', forced: true, cat: '입단', who: '프로 스카우트',
      prep: (st, me, c) => { c.team = R.pick(st.lg.teams).id; },
      text: (st, me, c) => `${univName(st)} 경기를 지켜보던 ${teamName(st, c.team)} 스카우트가 찾아왔다. "졸업까지 기다릴 거 없다. 육성선수로 바로 오자."`,
      ch: ['육성선수 계약 (프로 직행)', '졸업하고 드래프트를 노린다'], safe: 0,
      res: (st, me, i, c) => {
        if (i === 0) { joinTeam(st, c.team); me.salary = BAL.minSal; me.draft = { year: st.year, round: '육성', pick: null, team: c.team }; story(st, `${me.age}세, 대학 재학 중 ${tj(st, c.team, '과', '와')} 육성선수 계약.`); return '등번호는 세 자리지만, 프로 유니폼이다.'; }
        me.scout.bonus = (me.scout.bonus || 0) + 2; return '"졸업 때 다시 봅시다." 스카우트가 명함을 두고 갔다.';
      },
    },
    {
      // 13차: 포스팅 — 선수가 원할 때 신청. 응찰 구단은 능력치·성적에 따라 (없을 수도 있다)
      id: 'posting', forced: true, cat: '커리어', who: '에이전트',
      prep: (st, me, c) => { c.offers = overseasOffers(st, 'posting'); },
      text: (st, me, c) => c.offers.length
        ? `포스팅 마감. ${['MLB', 'NPB'].filter(id => c.offers.some(o => o.cid === id)).map(id => `${LCFG[id].short} ${c.offers.filter(o => o.cid === id).length}곳`).join(', ')}이 응찰했다.`
        : '포스팅 마감. …응찰한 구단이 한 곳도 없었다. 아직은 해외에서 보기에 부족하다는 뜻이다.',
      ch: (st, me, c) => c.offers.map(o => `${LCFG[o.cid].short}: ${teamName(st, o.team)}${lastRankTxt(st, o.team)} ${o.yrs}년 연 ${man(o.sal)}`).concat([c.offers.length ? '포스팅 철회 (잔류)' : '구단에 남는다']),
      safe: (st, me, c) => c.offers.length,
      res: (st, me, i, c) => {
        const o = c.offers[i];
        if (o) { goAbroad(st, o.cid, o.team, o.sal, o.yrs); me.pop += 10; return o.cid === 'MLB' ? '공항 출국장에 카메라가 줄을 섰다. 꿈의 무대로.' : '새 리그, 새 언어. 그래도 야구는 야구다.'; }
        if (!c.offers.length) { me.trust -= 3; return '"내년에 다시 보여주면 돼." 단장이 어깨를 두드렸다.'; }
        return '"아직은 여기서 할 일이 남았다."';
      },
    },
    {
      // 13차: 고교 졸업 때 미국 직행 (잠재력·스카우트 평가 + 능력치 기준)
      id: 'usDirect', forced: true, cat: '입단', who: '메이저리그 스카우트',
      prep: (st, me, c) => { c.team = R.pick(st.L.MLB.teams).id; c.bonus = Math.round(R.range(8000, 30000) * (me.tier === '역대급' ? 1.6 : 1) / 100) * 100; },
      text: (st, me, c) => `드래프트를 앞둔 여름,${teamName(st, c.team)} 스카우트가 찾아왔다. "마이너리그부터 시작하자. 계약금 ${man(c.bonus)}." (실패해서 돌아오면 KBO 복귀가 쉽지 않다)`,
      ch: ['미국으로 간다 (마이너리그 계약)', 'KBO 드래프트에 나간다'], safe: 1,
      res: (st, me, i, c) => {
        if (i !== 0) return '"한국에서 먼저 증명하겠습니다."';
        st.pending = st.pending.filter(p => p.id !== 'draft');
        me.stage = 'pro'; me.origin = 'us'; me.earnings += c.bonus;
        goAbroad(st, 'MLB', c.team, BAL.minSal, 6);
        me.lvl = 2; me.faAt = 6; me.contract.kind = 'MLB 마이너'; me.salary = BAL.minSal;
        me.draft = { year: st.year, round: '미국 직행', pick: null, team: c.team };
        story(st, `고교 졸업과 함께 ${tj(st, c.team, '과', '와')} 마이너리그 계약. 계약금 ${man(c.bonus)}.`);
        return '루키리그 버스는 생각보다 낡았다. 그래도 꿈의 무대로 가는 첫 차다.';
      },
    },
    {
      id: 'indieEnd', forced: true, cat: '커리어', who: '부모님',
      text: '독립리그 세 번째 겨울. 프로 테스트 연락은 오지 않았다.', ch: ['유니폼을 벗는다', '한 해만 더'], safe: 0,
      res: (st, me, i) => { if (i === 0 || me.indieYears >= 5) { retire(st, '프로의 꿈을 내려놓았다. 그래도 후회는 없다.'); return '마지막 배트를 가방에 넣었다.'; } return '이번이 정말 마지막이다.'; },
    },
    {
      id: 'tj', forced: true, cat: '부상', who: '팀 닥터',
      text: '"팔꿈치 인대가 거의 끊어졌습니다. 수술하면 1년 이상, 재활로 버티면 빨리 돌아올 수도 있지만…"',
      ch: ['토미존 수술을 받는다', '재활로 버틴다'], safe: 0,
      res: (st, me, i) => {
        if (i === 0) { me.flags.outSeason = true; if (R.chance(0.3)) me.flags.restore = Object.assign(me.flags.restore || {}, { vel: 2 }); story(st, `${me.age}세, 토미존 수술. 긴 재활이 시작됐다.`); return '수술실 불이 꺼졌다. 이제 기다림의 시간이다.'; }
        if (R.chance(0.7)) { me.flags.missSegs = 1; return '재활 센터에서 매일 고무밴드를 당겼다.'; }
        addR(me, 'vel', -5); me.flags.missSegs = 2; return '통증이 쉽게 가라앉지 않는다.';
      },
    },
    {
      id: 'retireOffer', forced: true, cat: '커리어', who: '단장',
      text: (st, me) => `"${me.name} 선수, 그동안 정말 고생 많았어요. 코치 자리를 준비해 뒀습니다."`,
      // 55차: 계약이 남아 있으면 '계약 기간을 채운다' 선택지
      ch: (st, me) => retireOpts(st, me).map(o => ({ retire: '은퇴한다', stay: `계약 기간(${me.contract && me.contract.until}년까지)을 채운다`, kbo: 'KBO로 돌아가 현역을 이어간다', release: '방출을 요청하고 현역을 이어간다' }[o])), safe: 0,
      res: (st, me, i) => {
        const o = retireOpts(st, me)[i];
        if (o === 'stay') { story(st, `${me.age}세, 은퇴 권유를 거절했다. 남은 계약 기간을 채우기로 했다.`); return '"계약은 끝까지 지키겠습니다."'; }
        i = o === 'retire' ? 0 : 1;
        if (i === 0) { retire(st, `${me.age}세, 은퇴. 마지막 ${me.role === 'P' ? '마운드' : '타석'}에서 관중이 기립했다.`); return '은퇴 기자회견에서 목이 메었다.'; }
        if (me.abroad) { const t = kboReturnTeam(st); returnKBO(st, t, BAL.minSal * 2, 1); return `${tj(st, t, '이', '가')} 고향 무대로 불러줬다.`; }
        const t = pickBetterTeam(st, me.team);
        if (!t) { retire(st, `${me.age}세, 방출 후 불러주는 팀이 없어 은퇴했다.`); return '전화는 끝내 울리지 않았다.'; }
        moveTeam(st, t); me.salary = BAL.minSal; me.contract = { salary: BAL.minSal, until: st.year, kind: '1년' }; story(st, `${me.age}세, 방출 후 ${tj(st, t, '과', '와')} 1년 계약.`); return `${teamName(st, t)}에서 연락이 왔다. 최저연봉 1년.`;
      },
    },
    {
      id: 'released', forced: true, cat: '커리어', who: '단장',
      text: '"2년 동안 1군 기회를 거의 못 줬네요. 미안하지만 방출입니다."',
      ch: (st, me) => me.abroad ? ['KBO로 돌아간다', '이 리그 다른 구단 문을 두드린다', '은퇴한다'] : me.age < 30 ? ['다른 구단 문을 두드린다', '독립리그로 간다', '은퇴한다'] : ['다른 구단 문을 두드린다', '은퇴한다'], safe: 0,
      res: (st, me, i) => {
        const opts = me.abroad ? ['kbo', 'knock', 'retire'] : me.age < 30 ? ['knock', 'indie', 'retire'] : ['knock', 'retire'];
        const o = opts[i];
        if (o === 'kbo') { const t = kboReturnTeam(st); returnKBO(st, t, BAL.minSal * 2, 2); return `${tj(st, t, '과', '와')} 계약. 다시 익숙한 그라운드로.`; }
        if (o === 'retire') { retire(st, `${me.age}세, 방출 후 은퇴.`); return '야구장 밖의 삶을 시작했다.'; }
        if (o === 'indie') { me.stage = 'indie'; me.team = null; me.indieYears = 0; story(st, `${me.age}세, 방출 후 독립리그로.`); return '처음부터 다시.'; }
        const t = pickBetterTeam(st, me.team);
        me.noFirst = 0;
        if (!t) { if (me.age < 30) { me.stage = 'indie'; me.team = null; me.indieYears = 0; return '불러주는 팀이 없어 독립리그로 향했다.'; } retire(st, `${me.age}세, 불러주는 팀이 없어 은퇴.`); return '전화는 끝내 울리지 않았다.'; }
        moveTeam(st, t); me.salary = BAL.minSal; story(st, `방출 후 ${teamName(st, t)} 입단.`); return `${tj(st, t, '이', '가')} 손을 내밀었다.`;
      },
    },
    {
      id: 'fa', forced: true, cat: '커리어', who: '에이전트',
      prep: (st, me, c) => {
        const ww = weightedWAR(me), v = marketValue(me) * agentMul(me) * (cfgOf(st.lg).salMul || 1);   // 62차: 에이전트 협상력
        // 52차: 제안 구단 수 확대 (0~1 → 1~2, 1~3 → 2~4, 3~5 → 4~6)
        const n = ww < WS(1) ? R.int(1, 2) : ww < WS(3) ? R.int(2, 4) : R.int(4, 6);
        const yrs = me.age <= 30 ? R.int(4, 6) : me.age <= 32 ? R.int(3, 4) : me.age <= 34 ? R.int(1, 3) : R.int(1, 2);
        const others = st.lg.teams.filter(t => t.id !== me.team).map(t => t.id);
        const offers = [];
        for (let i = 0; i < n && others.length; i++) { const id = others.splice(R.int(0, others.length - 1), 1)[0]; offers.push({ team: id, sal: Math.round(v * R.range(1.1, 1.3) / 100) * 100, yrs: Math.max(1, yrs + R.int(-1, 0)) }); }
        offers.sort((a, b) => b.sal - a.sal);
        c.best = offers[0] || null;
        c.off2 = offers[1] || null; c.off3 = offers[2] || null;   // 52차: 상위 3곳까지 선택지로
        c.stay = { team: me.team, sal: Math.round(Math.max(BAL.minSal, v * R.range(0.95, 1.1)) / 100) * 100, yrs };
        c.home = null;   // 52차: 고향팀 할인 제안 없앰 (고향 대신 연고 지역 → 드래프트 우선 관심)
        // 13차: 해외 FA (KBO 1군 faSvc 시즌 이상·병역 해결)
        c.ab = !me.abroad && cfgOf(st.lg).id === 'KBO' && me.svc >= BAL.abroad.faSvc && me.milDone && me.age <= BAL.abroad.maxAge + 2 ? overseasOffers(st, 'fa').slice(0, 3) : [];
        c.kbo = me.abroad ? { team: kboReturnTeam(st), sal: Math.round(Math.max(BAL.minSal, marketValue(me) * R.range(1.0, 1.3)) / 100) * 100, yrs: Math.max(1, yrs - 1) } : null;
        c.n = offers.length;
        // 27차: FA 계약금 (연봉 1억 이상 제안에만, 총 연봉의 30~45%)
        for (const o of [c.best, c.off2, c.off3, c.stay, c.home, c.kbo]) if (o && o.sal >= 10000) o.bon = Math.round(o.sal * o.yrs * R.range(BAL.faBonus[0], BAL.faBonus[1]) / 1000) * 1000;
      },
      text: (st, me, c) => `${me.abroad ? '계약 만료.' : 'FA 자격 취득!'} 제안한 구단 ${c.n}곳. ${c.best ? `최고액은 ${teamName(st, c.best.team)}${lastRankTxt(st, c.best.team)}의 ${faTerms(c.best)}.` : '시장 반응이 차갑다.'}`,
      ch: (st, me, c) => {
        const a = [], tn = id => teamName(st, id) + lastRankTxt(st, id);
        if (c.best) a.push(`최고 금액: ${tn(c.best.team)} ${faTerms(c.best)}`);
        // 62차: 최고액 구단과 추가 협상 (성공하면 10~20% 더, 실패하면 그 구단이 발을 빼고 원소속 잔류 조건으로)
        if (c.best && !me.abroad) { c.lev = salaryLeverage(st, c.best.sal); a.push(`에이전트에게 협상을 맡긴다: ${tn(c.best.team)}에 더 높은 금액 요구 (에이전트 판단: ${c.lev.w10}, 실패하면 원소속 잔류)`); }
        if (c.off2) a.push(`다른 제안: ${tn(c.off2.team)} ${faTerms(c.off2)}`);
        if (c.off3) a.push(`다른 제안: ${tn(c.off3.team)} ${faTerms(c.off3)}`);
        a.push(`원소속 잔류: ${tn(c.stay.team)} ${faTerms(c.stay)}`);
        if (c.home) a.push(`고향팀: ${tn(c.home.team)} ${faTerms(c.home)}`);
        if (c.kbo) a.push(`KBO 복귀: ${teamName(st, c.kbo.team)} ${faTerms(c.kbo)}`);
        (c.ab || []).forEach(o => a.push(`해외 FA · ${LCFG[o.cid].short}: ${teamName(st, o.team)}${lastRankTxt(st, o.team)} ${o.yrs}년 연 ${man(o.sal)}`));
        c.opts = [c.best ? 'best' : null, c.best && !me.abroad ? 'nego' : null, c.off2 ? 'off2' : null, c.off3 ? 'off3' : null, 'stay', c.home ? 'home' : null, c.kbo ? 'kbo' : null].filter(Boolean).concat((c.ab || []).map((o, j) => 'ab' + j));
        return a;
      },
      safe: 0,
      res: (st, me, i, c) => {
        let k = c.opts[i];
        if (/^ab\d/.test(k)) { const o = c.ab[+k.slice(2)]; goAbroad(st, o.cid, o.team, o.sal, o.yrs); me.pop += 10; return '해외 FA 계약. 새 무대가 기다린다.'; }
        let o = c[k], negoTxt = '';
        if (k === 'nego') {
          const p = c.lev ? c.lev.p10 : 0.5, u = R();
          if (u < p) { const m = R.range(1.1, 1.2); o = Object.assign({}, c.best, { sal: Math.round(c.best.sal * m / 100) * 100, bon: c.best.bon ? Math.round(c.best.bon * m / 1000) * 1000 : 0 }); negoTxt = '에이전트가 판을 키웠다. 조건이 더 올라갔다! '; k = 'best'; }
          else if (u < p + (1 - p) * 0.4) { o = c.best; negoTxt = '더 받아내진 못했지만 처음 조건은 지켰다. '; k = 'best'; }
          else { o = c.stay; k = 'stay'; me.pop -= 2; negoTxt = `${tj(st, c.best.team, '이', '가')} 협상에서 발을 뺐다. 결국 원소속 구단에 남는다. `; }
        }
        if (o.bon) { me.earnings += Math.round(o.bon * (1 - AGENCY[agencyOf(me).tier].fee)); me.pop += 2; }
        if (negoTxt) story(st, `${me.age}세 FA, 에이전트에게 협상을 맡겼다.`);
        if (k === 'kbo') { returnKBO(st, o.team, o.sal, o.yrs); return '"돌아온 걸 환영한다." 팬들이 플래카드를 들었다.'; }
        if (k !== 'stay') { moveTeam(st, o.team); me.flags.adjust = true; }
        if (k === 'home') me.pop += 10;
        if (k === 'stay') me.flags.oneClub = (me.flags.oneClub || 0) + 1;
        me.salary = o.sal; me.contract = { salary: o.sal, until: st.year + o.yrs - 1, kind: 'FA' };
        me.faAt = me.svc + Math.max(4, o.yrs);
        story(st, `${me.age}세 FA, ${tj(st, o.team, '과', '와')} ${faTerms(o)} 계약.`);
        return negoTxt + (k === 'best' ? '새 유니폼, 새 홈구장. 기자회견 플래시가 쏟아졌다.' : k === 'home' ? '어릴 적 응원하던 팀의 유니폼을 입었다.' : '"우리 팀에서 끝까지 함께하자." 팬들이 환호했다.');
      },
    },
    {
      id: 'extension', forced: true, cat: '커리어', who: '단장',
      prep: (st, me, c) => { c.sal = Math.round(marketValue(me) * 0.8 / 100) * 100; },
      text: (st, me, c) => `"FA까지 기다리지 말고 5년 장기계약 어떻습니까? 연 ${man(c.sal)} 보장합니다."`,
      ch: ['5년 계약에 서명', 'FA까지 기다린다'], safe: 0,
      res: (st, me, i, c) => {
        me.flags.extDone = true;
        if (i === 0) { me.salary = c.sal; me.contract = { salary: c.sal, until: st.year + 4, kind: '다년' }; me.faAt = Math.max(me.faAt || 0, me.svc + 5); me.flags.oneClub = (me.flags.oneClub || 0) + 1; story(st, `${me.age}세, 5년 연장계약. 연 ${man(c.sal)}.`); return '사인 한 번에 미래 5년이 정해졌다.'; }
        return '"시장에서 제 가치를 확인해 보고 싶습니다."';
      },
    },
    // 62차: 연봉 협상 — 계약이 끝나면 구단 제시액이 오고, 수락하거나 인상을 요구하거나 연봉조정을 신청한다.
    //   인상 성공 확률은 성적(시장가치 대비 제시액) · 팬들의 관심 · 명성 · 에이전트 협상력으로 정해진다 (salaryLeverage)
    {
      id: 'salary', forced: true, repeat: true, cat: '계약', who: '구단 운영팀',
      prep: (st, me, c) => {
        c.lev = salaryLeverage(st, c.offer);
        c.ask10 = Math.round(c.offer * 1.1 / 100) * 100; c.ask25 = Math.round(c.offer * 1.25 / 100) * 100;
        c.arb = me.svc >= 3 && me.lastSeason && me.lastSeason.war >= WS(2);
        c.mv = Math.round(marketValue(me) * (cfgOf(st.lg).salMul || 1) / 100) * 100;
      },
      text: (st, me, c) => `연봉 협상 테이블. 구단 제시액은 연 ${man(c.offer)}${c.prev ? ` (올해 ${man(c.prev)})` : ''}. 에이전트(${AGENCY[agencyOf(me).tier].name} · 협상력 ${c.lev.agent}급) 분석 — 성적 ${c.lev.perf} · 팬들의 관심 ${c.lev.pop} · 명성 ${c.lev.fame}.`,
      ch: (st, me, c) => {
        c.opts = ['ok', 'a10', 'a25', c.arb ? 'arb' : null].filter(Boolean);
        return c.opts.map(o => ({ ok: `제시액에 사인한다 (연 ${man(c.offer)})`, a10: `조금 더 올려 달라고 한다 (연 ${man(c.ask10)} 요구 · 에이전트 판단: ${c.lev.w10})`, a25: `크게 올려 달라고 버틴다 (연 ${man(c.ask25)} 요구 · 에이전트 판단: ${c.lev.w25})`, arb: `연봉조정을 신청한다 (구단안 vs 선수안, 지면 감독과 서먹해진다)` }[o]));
      },
      safe: 0,
      res: (st, me, i, c) => {
        const k = c.opts[i];
        const sign = (sal, txt) => { me.salary = sal; if (me.contract && me.contract.until < st.year) me.contract = null; return txt; };
        if (k === 'ok') { me.trust += 2; return sign(c.offer, '도장을 찍고 바로 훈련장으로 향했다.'); }
        if (k === 'arb') {
          if (R.chance(clamp(0.35 + (c.lev.p10 - 0.5) * 0.5, 0.2, 0.65))) { const s = Math.round(Math.max(c.offer, c.offer + (c.mv - c.offer) * 0.5) / 100) * 100; story(st, `${me.age}세, 연봉조정에서 승리. 연 ${man(s)}.`); return sign(s, `조정위원회가 선수 손을 들어줬다. 연 ${man(s)}.`); }
          me.trust -= 10; return sign(c.offer, '조정에서 졌다. 구단안대로 사인했고, 구단과의 공기가 서늘하다.');
        }
        const big = k === 'a25', p = big ? c.lev.p25 : c.lev.p10, ask = big ? c.ask25 : c.ask10, u = R();
        if (u < p) { me.pop += big ? 2 : 0; return sign(ask, `구단이 요구를 받아들였다. 연 ${man(ask)}에 사인!`); }
        if (u < p + (1 - p) * 0.4) { const mid = Math.round((c.offer + ask) / 2 / 100) * 100; return sign(mid, `밀고 당긴 끝에 중간에서 합의했다. 연 ${man(mid)}.`); }
        me.trust -= big ? 6 : 3;
        if (big && R.chance(0.3)) me.pop -= 3;
        return sign(c.offer, big ? '"그 금액은 무리입니다." 구단은 끝내 버텼다. 제시액에 사인했지만 분위기가 껄끄럽다.' : '구단이 꿈쩍하지 않았다. 제시액에 사인했다.');
      },
    },    { id: 'camp', forced: true, cat: '입단', who: '수석코치', text: '첫 스프링캠프. 선배들 사이에서 눈에 띄려면 뭔가 보여줘야 한다.', ch: ['무리해서라도 어필한다', '내 페이스대로 간다'], safe: 1,
      res: (st, me, i) => { if (i === 0) { me.flags.camp = true; if (R.chance(0.2)) me.flags.injRisk = (me.flags.injRisk || 0) + 0.06; return '캠프 MVP 후보 기사에 이름이 올랐다.'; } me.care += 1; return '불펜 투구 수를 지키며 묵묵히 몸을 만들었다.'; } },
    { id: 'number', forced: true, cat: '입단', who: '구단 매니저', text: '등번호를 정할 시간. 구단 레전드의 영구결번 바로 옆, 비어 있는 레전드 번호를 달 수도 있다.', ch: ['레전드의 번호를 요청한다', '빈 번호면 충분하다'], safe: 1,
      res: (st, me, i) => { if (i === 0) { me.pop += 8; me.flags.legendNum = true; return '"그 번호의 무게를 견딜 수 있을까?" 기자가 물었다.'; } return '유니폼 뒤의 숫자보다 앞의 이름이 중요하다.'; } },

    // ---------------- 고교 ----------------
    { id: 'final', cat: '고교', who: '감독', w: 1.2, cond: (st, me) => me.stage === 'hs' && me.hsLast && me.hsLast.status !== 'B', text: (st, me) => `전국대회 결승을 앞두고 감독이 불렀다. "내일 ${me.role === 'P' ? '선발투수' : '4번 타자'} 맡아볼래?"`, ch: ['나선다', '감독님께 맡긴다'], safe: 1,
      res: (st, me, i) => { if (i === 0) { me.scout.bonus = (me.scout.bonus || 0) + (R.chance(0.6) ? 6 : -4); return '스카우트 열댓 명이 백네트 뒤에 앉아 있었다.'; } me.scout.bonus = (me.scout.bonus || 0) + 1; return me.role === 'P' ? '"좋아, 불펜에서 대기해."' : '"좋아, 대타로 대기해."'; } },
    { id: 'overuse', cat: '고교', who: '감독', cond: (st, me) => me.stage === 'hs' && (me.role === 'P' || me.twoWay), text: '"오늘도 던질 수 있지? 우승하려면 네 팔이 필요하다." 사흘 연투째다.', ch: ['던진다', '못 던진다고 말한다'], safe: 1,
      res: (st, me, i) => { if (i === 0) { me.flags.hsTeamBoost = 0.05; me.care -= 1; if (R.chance(0.25)) me.flags.injRisk = 0.3; return '9회까지 마운드를 지켰다. 팔이 묵직하다.'; } me.care += 1; me.flags.hsPlayDown = true; me.trust -= 3; return '감독의 표정이 굳었다.'; } },
    { id: 'path', cat: '고교', who: '부모님', w: 1.5, cond: (st, me) => me.stage === 'hs' && me.grade === 3, text: '고3 진로 상담. "프로만 보는 거야, 아니면 대학도 생각해 둘래?"', ch: ['프로만 본다', '대학도 열어둔다'], safe: 1,
      res: (st, me, i) => { if (i === 0) { me.flags.proOnly = true; return '"그래, 네 인생이다."'; } addR(me, 'men', 2); return '마음이 한결 가벼워졌다.'; } },
    { id: 'lesson', cat: '고교', who: '부모님', cond: (st, me) => me.stage === 'hs', text: '프로 출신 코치가 하는 사설 레슨이 생겼다. 레슨비가 만만치 않다.', ch: ['다닌다', '학교 훈련만 한다'], safe: 1,
      res: (st, me, i) => { if (i === 0) { if (R.chance(0.7)) addR(me, lowestKey(me), 4); else addR(me, R.pick(mainKeys(me)), -2); return '첫 레슨, 코치가 폼을 한참 들여다봤다.'; } return '학교 운동장에서 묵묵히 배트를 돌렸다.'; } },
    { id: 'univFocus', cat: '대학', who: '대학 감독', cond: (st, me) => me.stage === 'univ', text: '"대학 4년, 기본기를 다시 다져보자. 아니면 경기 위주로 갈래?"', ch: ['기본기 훈련', '실전 위주'], safe: 0,
      res: (st, me, i) => { if (i === 0) { addR(me, lowestKey(me), 3); return '지루한 반복 훈련이 이어졌다.'; } me.scout.bonus = (me.scout.bonus || 0) + 2; return '매 경기 스카우트 리포트에 이름이 올랐다.'; } },

    // ---------------- 프로: 훈련 ----------------
    { id: 'form', cat: '훈련', who: '타격코치', cond: (st, me) => me.stage === 'pro' && me.role === 'B' && me.lastSeason && me.lastSeason.avg != null && me.lastSeason.avg < 0.250, text: '"타격폼, 이대로는 안 된다. 레그킥을 줄이자."', ch: ['받아들인다', '내 폼을 지킨다'], safe: 0,
      res: (st, me, i) => { if (i === 0) { if (R.chance(0.6)) addR(me, 'con', 6); else { addR(me, 'con', -4); me.flags.restore = Object.assign(me.flags.restore || {}, { con: 4 }); } return '새 폼이 아직 어색하다.'; } me.trust -= 8; return '코치가 말없이 돌아섰다.'; } },
    { id: 'slider', cat: '훈련', who: '투수코치', cond: (st, me) => me.stage !== 'hs' && (me.role === 'P') && me.age <= 25, text: '"슬라이더 하나 장착해 보자. 직구만으로는 한계가 온다."', ch: ['슬라이더를 배운다', '직구에 집중한다'], safe: 1,
      res: (st, me, i) => { if (i === 0) { const u = R(); if (u < 0.7) addR(me, 'brk', 8); else if (u < 0.85) me.flags.injRisk = (me.flags.injRisk || 0) + 0.06; return '그립을 쥔 손가락에 물집이 잡혔다.'; } addR(me, 'vel', 3); return '불펜에서 직구만 백 개를 던졌다.'; } },
    { id: 'bulk', cat: '훈련', who: '트레이닝 코치', cond: (st, me) => me.role === 'B' && me.r.pow < 60 && me.stage !== 'hs', text: '비시즌, 벌크업할까? 체중을 늘리면 타구에 힘이 실린다.', ch: ['벌크업', '날렵하게 유지'], safe: 1,
      res: (st, me, i) => { if (i === 0) { addR(me, 'pow', 7); addR(me, 'spd', -3); return '하루 다섯 끼. 유니폼이 꽉 낀다.'; } addR(me, 'spd', 2); return '스프린트 훈련을 늘렸다.'; } },
    { id: 'switch', cat: '훈련', who: '타격코치', cond: (st, me) => me.role === 'B' && me.bats === 'R' && me.age <= 21, text: '"발이 빠른데 좌타석에도 서 보는 건 어때? 스위치 히터."', ch: ['도전한다', '거절한다'], safe: 1,
      res: (st, me, i) => { if (i === 0) { addR(me, 'con', -5); if (R.chance(0.7)) { me.bats = 'S'; me.flags.restore = Object.assign(me.flags.restore || {}, { con: 7 }); } else me.flags.restore = Object.assign(me.flags.restore || {}, { con: 5 }); return '왼쪽 타석이 낯설다.'; } return '"오른쪽에서 더 잘 치면 된다."'; } },
    { id: 'sidearm', cat: '훈련', who: '투수코치', cond: (st, me) => me.role === 'P' && me.age <= 25 && me.stage !== 'hs' && me.r.vel < 60, text: '"구속이 정체됐어. 팔 각도를 내려 사이드암으로 가보자."', ch: ['바꾼다', '유지한다'], safe: 1,
      res: (st, me, i) => { if (i === 0) { addR(me, 'vel', -4); addR(me, 'stf', 6); addR(me, 'brk', 6); if (R.chance(0.3)) { addR(me, 'stf', 4); addR(me, 'brk', 4); } return '공이 낯선 궤적으로 휘어 들어갔다.'; } return '정통파의 자존심.'; } },
    { id: 'academy', cat: '훈련', who: '에이전트', cond: (st, me) => me.role === 'P' && me.stage === 'pro', text: '미국 사설 피칭 아카데미. 구속을 올려준다는데 비용이 꽤 든다.', ch: ['자비로 간다', '구단 훈련으로 충분하다'], safe: 1,
      res: (st, me, i) => { if (i === 0) { addR(me, 'vel', R.int(3, 6)); me.earnings -= 3000; if (R.chance(0.15)) me.flags.injRisk = (me.flags.injRisk || 0) + 0.08; return '레이더건 숫자에 집착하는 겨울이었다.'; } return '익숙한 구단 시설에서 겨울을 보냈다.'; } },
    { id: 'philo', cat: '훈련', who: '타격코치', cond: (st, me) => me.role === 'B' && me.stage !== 'hs', text: '"너는 어떤 타자가 되고 싶냐? 공을 끝까지 보는 타자, 초구부터 때리는 타자."', ch: ['공을 본다', '초구부터 공략'], safe: 0,
      res: (st, me, i) => { if (i === 0) { addR(me, 'eye', 5); addR(me, 'con', -2); return '투구 수를 늘리는 게 즐거워졌다.'; } addR(me, 'pow', 3); addR(me, 'eye', -2); return '초구 스트라이크는 놓치지 않는다.'; } },
    { id: 'multi', cat: '훈련', who: '수비코치', cond: (st, me) => me.stage === 'pro' && me.role === 'B' && GROUP[me.pos] === 'IF' && me.lastSeason && !me.lastSeason.starter, text: '"내야 어디든 볼 수 있으면 출전 기회가 늘어난다."', ch: ['멀티 포지션 훈련', '주 포지션만 판다'], safe: 0,
      res: (st, me, i) => { if (i === 0) { addR(me, 'def', 3); me.flags.utility = true; return '글러브 세 개를 들고 다니게 됐다.'; } me.trust += 4; return '"그래, 네 자리는 네가 지켜라."'; } },
    { id: 'video', cat: '훈련', who: '전력분석팀', cond: (st, me) => me.stage === 'pro', text: '전력분석팀이 약점 리포트를 내밀었다. 데이터대로 고쳐보라는데.', ch: ['데이터를 따른다', '내 감각을 믿는다'], safe: 0,
      res: (st, me, i) => { if (i === 0) { addR(me, lowestKey(me), 3); return '태블릿 속 히트맵을 밤새 들여다봤다.'; } if (R.chance(0.5)) addR(me, 'men', 3); return '"야구는 숫자가 아니라 감이다."'; } },
    { id: 'winter', cat: '훈련', who: '트레이너', cond: (st, me) => me.stage === 'pro', text: '비시즌 일정. 푹 쉴까, 해외 윈터리그에서 실전 감각을 유지할까.', ch: ['충분히 쉰다', '윈터리그에 간다'], safe: 0,
      res: (st, me, i) => { if (i === 0) { me.care += 1; return '오랜만에 가족과 여행을 다녀왔다.'; } addR(me, R.pick(mainKeys(me)), 3); me.care -= 1; return '도미니카의 뜨거운 햇볕 아래서 공을 던졌다.'; } },

    // ---------------- 포지션 ----------------
    { id: 'closer', cat: '포지션', who: '감독', cond: (st, me) => me.stage === 'pro' && me.role === 'P' && me.pos === 'SP' && me.r.sta < 55 && me.r.vel >= 55 && (me.roleOffersLeft == null || me.roleOffersLeft > 0) && (me.flags.roleOfferYear || 0) <= st.year - BAL.roleOffer.gap, text: '"선발로는 체력이 아쉽다. 마무리로 가보는 건 어때?"', ch: ['마무리 전향을 수락', '선발을 고수한다'], safe: 0,
      res: (st, me, i) => { me.roleOffersLeft = Math.max(0, (me.roleOffersLeft == null ? 2 : me.roleOffersLeft) - 1); me.flags.roleOfferYear = st.year; if (i === 0) { me.pos = 'RP'; me.flags.closer = true; story(st, `${me.age}세, 마무리 전향.`); return '9회의 마운드가 기다린다.'; } if (R.chance(0.5)) { me.trust -= 10; me.lvl = 2; return '감독이 고개를 저었다.'; } return '"그럼 결과로 보여줘."'; } },
    // 11차: 보직 전환 제안 (겨울에 조건이 맞으면 확률로 등장)
    { id: 'toSP', forced: true, cat: '보직', who: '투수코치', text: (st, me) => `"불펜에서 보여준 공이면 선발도 된다. 내년엔 로테이션에 넣어볼까?"${me.flags.closer ? ' 마무리 자리는 내려놓아야 한다.' : ''}`, ch: ['선발로 전환한다', '불펜에 남는다'], safe: 1,
      res: (st, me, i) => { if (i === 0) { me.pos = 'SP'; me.flags.closer = false; me.flags.spPromise = st.year; story(st, `${me.age}세, 불펜에서 선발로 전환.`); return '긴 이닝을 위한 몸 만들기가 시작됐다. 내년 로테이션 한 자리는 네 것이다.'; } me.trust += 3; return '"불펜은 네가 지켜줘."'; } },
    { id: 'toRP', forced: true, cat: '보직', who: '감독', text: '"요즘 긴 이닝이 버거워 보인다. 불펜에서 짧고 굵게 던지는 게 어때?"', ch: ['불펜으로 전환한다', '선발을 고수한다'], safe: 0,
      res: (st, me, i) => { if (i === 0) { me.pos = 'RP'; story(st, `${me.age}세, 선발에서 불펜으로 전환.`); return '한 이닝에 모든 걸 쏟아붓는 법을 배운다.'; } if (R.chance(0.4)) { me.trust -= 6; return '"그럼 캠프에서 증명해라." 감독의 목소리가 차가웠다.'; } return '"한 시즌 더 지켜보지."'; } },
    { id: 'toCL', forced: true, cat: '보직', who: '감독', text: '"9회를 맡길 투수가 필요하다. 네가 마무리를 해라."', ch: ['마무리를 맡는다', '지금 보직이 편하다'], safe: 0,
      res: (st, me, i) => { if (i === 0) { me.flags.closer = true; me.pop += 3; story(st, `${me.age}세, 팀의 마무리 투수가 됐다.`); return '등장 음악을 고르는 데 하루가 걸렸다.'; } return '"알았다. 대신 셋업은 확실히 막아줘."'; } },
    { id: 'toC', cat: '포지션', who: '감독', cond: (st, me) => me.stage === 'pro' && me.role === 'B' && me.pos !== 'C' && me.r.arm >= 65 && me.lastSeason && !me.lastSeason.starter, text: '"어깨가 좋은데 포수 해볼 생각 없냐? 포수는 늘 부족하다."', ch: ['포수 전향을 수락', '거절한다'], safe: 1,
      res: (st, me, i) => { if (i === 0) { me.pos = 'C'; me.flags.catcher = true; me.care -= 1; story(st, `${me.age}세, 포수 마스크를 썼다.`); return '무릎 보호대가 아직 어색하다.'; } me.trust -= 5; return '2군에서 조금 더 버텨야 한다.'; } },
    { id: 'toOF', cat: '포지션', who: '감독', cond: (st, me) => me.stage === 'pro' && me.role === 'B' && GROUP[me.pos] === 'IF' && me.age >= 28, text: '"내야 수비 범위가 예전 같지 않다. 코너 외야로 가자."', ch: ['수락한다', '내야를 고집한다'], safe: 0,
      res: (st, me, i) => { if (i === 0) { me.pos = 'OF'; me.ofPos = R.chance(0.5) ? 'LF' : 'RF'; me.flags.cornerOF = true; return '외야 잔디 냄새가 낯설다.'; } if (me.r.def < 50) me.trust -= 5; return '"실책 나오면 바로 바꾼다."'; } },
    // 60차: 투타 균형이 무너졌을 때 이도류를 그만둘지 — 잘하는 쪽에 집중하거나(주 포지션과 반대쪽이면 전향), 못하는 쪽에 집중하거나, 계속하거나
    {
      id: 'twQuit', forced: true, cat: '포지션', who: '감독',
      text: (st, me, c) => c.weak === 'bat'
        ? '"요즘 타석에서는 영 답이 안 나온다. 마운드에서는 이렇게 좋은데. 이도류, 계속할 거냐?"'
        : '"방망이는 리그 정상급인데 마운드가 버겁다. 이도류, 계속할 거냐?"',
      ch: (st, me, c) => {
        const strong = c.weak === 'bat' ? 'P' : 'B', other = strong === 'P' ? 'B' : 'P';
        const lbl = s => s === me.role ? (s === 'P' ? '투수에만 집중한다' : '타자에만 집중한다') : (s === 'P' ? '투수로 전향한다' : '타자로 전향한다');
        return ['이도류를 계속한다', lbl(strong), lbl(other)];
      },
      safe: 1,
      res: (st, me, i, c) => {
        if (i === 0) { me.trust -= 2; return '"알았다. 대신 둘 다 무너지면 그땐 내가 정한다."'; }
        const side = (i === 1) === (c.weak === 'bat') ? 'P' : 'B';
        me.twoWay = false; me.focus = 1.1;
        if (side !== me.role) {
          me.role = side; me.pos = side === 'P' ? (me.r.sta >= BAL.twoWay.spSta ? 'SP' : 'RP') : 'DH'; me.flags.closer = false;
          me.trainFocus = (me.trainFocus || []).filter(k => mainKeys(me).indexOf(k) >= 0);
          story(st, `${me.age}세, 이도류를 내려놓고 ${side === 'P' ? '투수' : '타자'}로 전향했다.`);
          return side === 'P' ? '방망이를 내려놓았다. 이제 마운드가 내 자리다.' : '글러브 대신 방망이를 잡았다. 이제 타석이 내 자리다.';
        }
        story(st, `${me.age}세, 이도류를 내려놓았다.`);
        return '한 우물을 파기로 했다.';
      },
    },
    {
      id: 'twkeep', cat: '포지션', who: '감독', repeat: true, w: 0.8, cond: (st, me) => me.twoWay, text: '"올해도 둘 다 할 거냐? 몸이 버텨줄지 걱정이다."',
      ch: (st, me) => ['이도류를 계속한다', me.role === 'P' ? '투수에만 집중한다' : '타자에만 집중한다'], safe: 1,
      res: (st, me, i) => { if (i === 0) return '"좋아, 끝까지 가보자."'; me.twoWay = false; me.focus = 1.1; story(st, `${me.age}세, 이도류를 내려놓았다.`); return '한 우물을 파기로 했다.'; },
    },

    // ---------------- 부상 ----------------
    { id: 'shot', cat: '부상', who: '트레이너', cond: (st, me) => me.stage === 'pro' && (me.role === 'P' || me.twoWay) && me.age >= 21, text: '시즌 막판, 어깨가 끊어질 듯 아프다. 주사 한 대면 다음 등판은 가능하다는데.', ch: ['주사 맞고 등판', '쉬겠다고 말한다'], safe: 1,
      res: (st, me, i) => { if (i === 0) { me.care -= 1; me.trust += 3; if (R.chance(0.3)) { me.flags.tjPending = false; me.flags.outSeason = true; me.bigInj++; story(st, `${me.age}세, 무리한 등판 끝에 토미존 수술.`); } return '통증이 사라졌다. 적어도 지금은.'; } me.care += 1; me.flags.missSegs = Math.max(me.flags.missSegs || 0, 0); return '"몸이 먼저다." 트레이너가 어깨를 두드렸다.'; } },
    { id: 'hammy', cat: '부상', who: '트레이너', cond: (st, me) => me.stage === 'pro' && me.lastSeason && me.lastSeason.injured && !me.lastSeason.bigInjury, text: '햄스트링이 아직 완전하지 않다. 빨리 복귀할까, 완벽히 회복할까.', ch: ['조기 복귀', '완벽하게 회복한다'], safe: 1,
      res: (st, me, i) => { if (i === 0) { if (R.chance(0.4)) me.flags.injRisk = (me.flags.injRisk || 0) + 0.25; return '캠프 첫날부터 전력 질주를 했다.'; } me.care += 1; return '재활 일정을 끝까지 지켰다.'; } },
    { id: 'diet', cat: '부상', who: '트레이너', cond: (st, me) => me.age >= 30 && me.stage === 'pro', text: '서른이 넘으니 체중이 쉽게 불어난다.', ch: ['식단 관리를 시작한다', '먹고 싶은 대로 먹는다'], safe: 0,
      res: (st, me, i) => { if (i === 0) { me.care += 1; me.flags.slowDecline = true; return '닭가슴살과 브로콜리의 나날.'; } addR(me, 'pow', 1); me.care -= 1; return '삼겹살 앞에서 의지가 무너졌다.'; } },

    // ---------------- 생활 ----------------
    { id: 'youtube', cat: '생활', who: '구단 홍보팀', cond: (st, me) => me.stage === 'pro' && me.lastSeason && me.lastSeason.firstSegs >= 1, text: '구단 유튜브에서 고정 출연 제안이 왔다. 반응이 좋으면 몸값도 오른다는데.', ch: ['출연한다', '야구에만 집중한다'], safe: 1,
      res: (st, me, i) => { if (i === 0) { me.pop += 10; me.flags.ytBump = true; if (R.chance(0.3)) me.flags.slump = true; return '첫 영상 조회수가 50만을 넘었다.'; } return '카메라 대신 배팅 케이지를 택했다.'; } },
    // 62차: 에이전시 영입 제안 (기존 → 중형 → 대형). 예전 '대형 에이전시 러브콜' 이벤트를 대신한다
    { id: 'agency', forced: true, repeat: true, cat: '생활', who: '에이전시',
      prep: (st, me, c) => { const A = AGENCY[c.tier]; c.skill = R.int(A.skill[0], A.skill[1]); c.cur = agencyOf(me); },
      text: (st, me, c) => { const A = AGENCY[c.tier], C = AGENCY[c.cur.tier]; return `${A.name}에서 연락이 왔다. "연봉 협상, FA 몸값까지 저희가 책임지겠습니다." 협상력 ${agentGrade(c.skill)}급 · 수수료 연봉의 ${Math.round(A.fee * 100)}%. (지금: ${C.name} · 협상력 ${agentGrade(c.cur.skill)}급 · 수수료 ${Math.round(C.fee * 100)}%)`; },
      ch: (st, me, c) => [`${AGENCY[c.tier].name}로 옮긴다`, '지금 에이전시와 간다'], safe: 1,
      res: (st, me, i, c) => { if (i === 0) { me.agency = { tier: c.tier, skill: c.skill }; if (c.tier === 'big') me.flags.bigAgent = true; story(st, `${me.age}세, ${AGENCY[c.tier].name}와 계약.`); return '계약서가 두툼했다. 협상 테이블에서 든든한 편이 생겼다.'; } addR(me, 'men', 1); return '"끝까지 같이 갑시다."'; } },    { id: 'love', cat: '생활', who: '매니저', cond: (st, me) => me.stage === 'pro' && me.age >= 22, text: '열애 사실을 공개할까? 기자들이 냄새를 맡기 시작했다.', ch: ['공개한다', '비공개로 간다'], safe: 1,
      res: (st, me, i) => { if (i === 0) { me.pop += 6; if (me.lastSeason && me.lastSeason.war < WS(1) && R.chance(0.3)) addR(me, 'men', -3); return '축하 댓글과 악플이 반반이다.'; } if (R.chance(0.2)) me.pop += 3; return '조용한 연애를 이어갔다.'; } },
    { id: 'drink', cat: '생활', who: '선배', cond: (st, me) => me.stage === 'pro', text: '"오늘 선배들끼리 한잔한다. 너도 와라."', ch: ['참석한다', '빠진다'], safe: 1,
      res: (st, me, i) => { if (i === 0) { me.trust += 3; me.care -= 1; return '새벽 세 시, 선배가 어깨를 감쌌다.'; } me.care += 1; if (R.chance(0.2)) me.trust -= 5; return '숙소에서 일찍 잠들었다.'; } },
    { id: 'trainer', cat: '생활', who: '에이전트', cond: (st, me) => me.stage === 'pro' && me.salary >= 20000, text: '연봉도 올랐으니 개인 트레이너를 붙여보는 건 어때요?', ch: ['개인 트레이너 고용', '필요 없다'], safe: 0,
      res: (st, me, i) => { if (i === 0) { me.care += 1; me.earnings -= 5000; return '아침 여섯 시, 트레이너가 문을 두드렸다.'; } return '스스로 관리할 자신이 있다.'; } },
    { id: 'sign', cat: '생활', who: '홍보팀', cond: (st, me) => me.stage === 'pro' && me.pop >= 10, text: '퇴근길 팬 사인 요청을 지나친 영상이 퍼졌다. 오해인데 반응이 심상치 않다.', ch: ['공개 사과한다', '무시한다'], safe: 0,
      res: (st, me, i) => { if (i === 0) { me.pop += 2; return '다음 날 팬 사인회를 열었다.'; } if (R.chance(0.5)) me.pop -= 15; return '시간이 해결해 주길 바랐다.'; } },
    { id: 'dog', cat: '생활', who: '가족', cond: (st, me) => me.age >= 20 && me.stage !== 'hs', text: '유기견 보호소에서 눈이 마주친 강아지가 있다.', ch: ['입양한다', '나중에'], safe: 0,
      res: (st, me, i) => { if (i === 0) { addR(me, 'men', 3); me.pop += 2; return '집에 오면 꼬리 치는 녀석이 생겼다.'; } return '아직은 여유가 없다.'; } },

    // ---------------- 커리어 ----------------
    { id: 'captain', cat: '커리어', who: '감독', cond: (st, me) => me.stage === 'pro' && me.age >= 28 && me.lastSeason && me.lastSeason.starter, text: '"올해 주장 맡아줄 수 있겠나?"', ch: ['수락한다', '거절한다'], safe: 1,
      res: (st, me, i) => { if (i === 0) { me.trust += 10; addR(me, 'men', 2); if (R.chance(0.2)) me.flags.slump = true; story(st, `${me.age}세, 주장 완장을 찼다.`); return '라커룸 한가운데 자리가 생겼다.'; } return '"아직은 제 야구에 집중하고 싶습니다."'; } },
    { id: 'nation', cat: '커리어', who: '대표팀 감독', cond: (st, me) => me.stage === 'pro' && me.lastSeason && me.lastSeason.war >= WS(4), text: '국가대표 소집 통보. 시즌 준비 일정이 빡빡해진다.', ch: ['합류한다', '정중히 고사한다'], safe: 0,
      res: (st, me, i) => { if (i === 0) { me.pop += 10; if (R.chance(0.25)) me.flags.slowStart = true; story(st, `${me.age}세, 태극마크를 달았다.`); return '가슴의 태극기가 무겁고도 뜨거웠다.'; } me.pop -= 3; return '여론이 조금 싸늘하다.'; } },
    { id: 'trade', cat: '커리어', who: '에이전트', cond: (st, me) => me.stage === 'pro' && me.age >= 23 && me.lastSeason && me.lastSeason.firstSegs <= 1 && myOVR(me) >= 45, text: '주전 경쟁에서 밀렸다. 트레이드를 요청할까?', ch: ['트레이드를 요청한다', '버틴다'], safe: 1,
      res: (st, me, i) => { if (i === 0) { const t = R.chance(0.6) ? pickBetterTeam(st, me.team) : null; if (t) { moveTeam(st, t); story(st, `${me.age}세, ${tj(st, t, '으로', '로')} 트레이드.`); return `${tj(st, t, '으로', '로')} 트레이드됐다. 새 출발이다.`; } me.trust -= 10; return '요청은 받아들여지지 않았다. 감독의 눈빛이 차갑다.'; } addR(me, 'men', 1); return '이를 악물었다.'; } },
  ];
  const EVMAP = {};
  EVENTS.forEach(e => { EVMAP[e.id] = e; });

  function goClub(st, text) { const me = st.me; me.stage = 'indie'; me.team = null; me.indieYears = 0; if (text) story(st, text); }
  function undraftedChoice(st, me, i, c) {
    const labels = c._labels;
    const label = labels ? labels[i] : null;
    const pick = label || '';
    if (pick.indexOf('대학') >= 0) { me.stage = 'univ'; me.origin = 'univ'; me.univYears = 0; me.univTeam = null; queue(st, 'univPick'); me.scout.perf = []; me.scout.tourn = []; me.scout.bonus = 0; story(st, '드래프트 미지명. 대학 야구부에서 4년 뒤를 노린다.'); return '대학 캠퍼스의 야구장은 생각보다 작았다.'; }
    if (pick.indexOf('육성') >= 0) { queue(st, 'devTest', { score: c.score }); st.pending.unshift(st.pending.pop()); return '구단들의 육성선수 입단 테스트 일정을 받아 들었다.'; }
    if (pick.indexOf('독립') >= 0) { goClub(st, '드래프트 미지명. 독립리그에서 다시 시작한다.'); return '버스로 원정을 다니는 리그. 그래도 매일 경기에 나간다.'; }
    retire(st, '드래프트에서 끝내 이름이 불리지 않았다. 야구를 그만두었다.');
    return '글러브를 벽장에 넣었다.';
  }
  // ================================================================
  // 공개 API
  // ================================================================
  function pendingItem(st) { return st.pending[0] || null; }
  function retireOpts(st, me) { const left = me.contract && me.contract.until >= st.year; return ['retire', left ? 'stay' : null, me.abroad ? 'kbo' : 'release'].filter(Boolean); }
  function voluntaryRetire(st) { bind(st); st.me.volRet = true; retire(st, st.me.stage === 'pro' ? `${st.me.age}세, 스스로 은퇴를 선언했다. 박수칠 때 떠난다.` : `${st.me.age}세, 스스로 야구를 내려놓았다.`); }

  // 표시용
  function view(st) {
    const me = st.me;
    return {
      ovr: Math.round(myOVR(me, me.shown)), oppOvr: Math.round(myOppOVR(me, me.shown)), velo: velo(me.shown.vel),
      grade: cardGrade(me), teamName: me.team ? teamName(st, me.team) : null, salary: me.salary,
    };
  }
  function cardGrade(me) { const a = avgKeys(me.shown, mainKeys(me)); return a >= 80 ? 'legend' : a >= 65 ? 'gold' : a >= 50 ? 'silver' : 'bronze'; }
  // 10차: 화면 표시용 능력치 눈금 (내부값 30→40, 64→83, 72→93). 내부 계산·밸런스는 그대로
  function disp(v) { return Math.max(1, Math.min(99, Math.round(40 + (v - 30) * 1.25))); }
  function dispD(d) { return d ? (Math.sign(d) * Math.max(1, Math.round(Math.abs(d) * 1.25))) : 0; }
  // 리그 탭용: 모든 리그 (내가 있는 리그 표시)
  function leagueList(st) {
    const out = [];
    const kbo = st.home || (cfgOf(st.lg).id === 'KBO' ? st.lg : null);
    const get = id => id === 'KBO' ? kbo : cfgOf(st.lg).id === id ? st.lg : (st.L || {})[id];
    for (const id of ['KBO', 'FUT', 'UNIV', 'NPB', 'MLB']) { const L = get(id); if (L) out.push({ id, cfg: LCFG[id], L, mine: myLeagueId(st) === id }); }
    return out;
  }
  function myLeagueId(st) {
    const me = st.me;
    if (me.stage === 'univ') return 'UNIV';
    if (me.stage === 'mil') return me.milType === 'sangmu' ? 'FUT' : 'KBO';
    if (me.stage !== 'pro') return 'KBO';
    const id = cfgOf(st.lg).id;
    return id === 'KBO' && me.lvl === 2 ? 'FUT' : id;
  }
  function debug(st) {
    const me = st.me;
    return { tier: me.tier, peak: me.peak, pa: me.pa, growth: me.growth, aging: me.aging, care: me.care, trust: me.trust, pop: me.pop, dur: me.dur, twMult: me.twMult, scout: Math.round(me.scout.score * 10) / 10, svc: me.svc, faAt: me.faAt, lvl: me.lvl, bigInj: me.bigInj, flags: me.flags };
  }

  return {
    BAL, LABEL, POSNAME, BAT, PIT, ALL, GROUP,
    newGame, makeCandidates, playSeason, pendingItem, choose, voluntaryRetire, careerScore,
    view, debug, interest, draftRange, man, teamName, velo, ovrAt, valAt, expWAR, scoreParts, mainKeys, oppKeys, LCFG, cfgOf, leagueList, myLeagueId, findTeam,
    AVG, OBP, SLG, OPS, ERA, IP, ipTxt, rate3, posName, hofGoals, salaryLeverage, AGENCY, fmtBatShort, fmtPitShort,
    PROF, OPT, disp, dispD, canPost, requestPosting, changeFocus, _internal: { batRates, pitRates, batExp, pitExp, ERA_SCALE, FORM0 },
  };
})();
if (typeof module !== 'undefined') module.exports = Sim;
