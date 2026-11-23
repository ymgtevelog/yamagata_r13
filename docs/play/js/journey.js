/* journey.js — コース、ミッション、コンボ */
(function (G) {
  'use strict';
  const R13 = G.R13 = G.R13 || {};

  const MISSION_DEFS = {
    careful: { title: '丁寧な連続走行', icon: '🛣' },
    fuel:    { title: '区間燃費',       icon: '⛽' },
    combo:   { title: 'コンボ',         icon: '✨' },
    signal:  { title: '信号待ち',       icon: '🚦' },
    souvenir:{ title: 'おみやげ',       icon: '🎁' },
    refuel:  { title: '給油',           icon: '🛢' },
    town:    { title: '次のまち',       icon: '🏘' }
  };
  const MISSION_BONUS = 800;

  function carefulTarget(lengthM) {
    return Math.min(1800, Math.max(100, Math.round(lengthM / 3 / 100) * 100));
  }

  function missionText(m) {
    switch (m.id) {
      case 'careful': return m.target.toLocaleString('ja-JP') + ' mを違反・事故なく連続走行';
      case 'fuel': return '1区間で燃費 8 km/L以上';
      case 'combo': return 'ドライブコンボ 1.1倍に到達';
      case 'signal': return '赤信号で待ってから青で出発';
      case 'souvenir': return '道の駅でおみやげを1つ取得';
      case 'refuel': return '給油所で1回給油';
      case 'town': return '新しい地域へ到達';
    }
    return '';
  }

  function feasibleMissions(course) {
    const f = R13.route.courseFeatures(course);
    const list = ['careful', 'fuel', 'combo'];
    if (f.signals > 0) list.push('signal');
    if (f.ekis > 0) list.push('souvenir');
    if (f.fuels > 0) list.push('refuel');
    if (f.regions > 1) list.push('town');
    return list;
  }

  function comboKey(ids) { return ids.slice().sort().join(','); }

  // 選択コース内で達成可能な候補から3種類。同じドライバーの直前と同じ組合せを避ける。
  function drawMissions(course, lastKey, rnd) {
    rnd = rnd || Math.random;
    const cand = feasibleMissions(course);
    let pick = null;
    for (let tries = 0; tries < 40; tries++) {
      const pool = cand.slice();
      const ids = [];
      while (ids.length < 3 && pool.length) ids.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
      pick = ids;
      if (comboKey(ids) !== lastKey) break;
    }
    const len = course.end - course.start;
    return pick.map(function (id) {
      return { id: id, target: id === 'careful' ? carefulTarget(len) : 0, done: false };
    });
  }

  // コンボ倍率：1,000 mごとに0.1倍、最大1.5倍
  function comboMultiplier(dist) {
    const step = Math.min(5, Math.floor(Math.max(0, dist) / 1000));
    return Math.round((1 + step * 0.1) * 10) / 10;
  }

  R13.journey = { MISSION_DEFS: MISSION_DEFS, MISSION_BONUS: MISSION_BONUS, carefulTarget: carefulTarget,
    missionText: missionText, feasibleMissions: feasibleMissions, drawMissions: drawMissions,
    comboKey: comboKey, comboMultiplier: comboMultiplier };
  if (typeof module !== 'undefined') module.exports = R13;
})(typeof window !== 'undefined' ? window : globalThis);
