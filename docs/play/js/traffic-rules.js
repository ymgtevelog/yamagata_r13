/* traffic-rules.js — 違反、区間加点、得点定数 */
(function (G) {
  'use strict';
  const R13 = G.R13 = G.R13 || {};

  const SCORE = {
    PER_METER: 1,
    NEW_REGION: 100,
    PASS_SAME: 30,
    PASS_ONCOMING: 60,
    SIGNAL_WAIT: 100,
    SOUVENIR: 800,
    QUIZ: 300,
    MISSION: 800,
    SEG_STANDARD: 300,
    SEG_RANK: [600, 400, 300],
    COMPLETE_FULL: 3000,
    COMPLETE_CHALLENGE: 1000,
    PEN_REG: 1500,
    PEN_SIGNAL: 2000,
    PEN_CAMERA: 1200,
    PEN_GASOUT: 2000,
    PEN_CHECKPOINT: 500
  };
  // 回数を数えて検挙する方式
  const REG_EVERY = 8;      // 追い越し・はみ出し：8・16・24回目…
  const SIGNAL_EVERY = 5;   // 信号無視：5・10・15回目…

  function regCaught(count) { return count > 0 && count % REG_EVERY === 0; }
  function signalCaught(count) { return count > 0 && count % SIGNAL_EVERY === 0; }

  // 区間燃費：8 km/L以上400点、6以上250点、4以上100点
  function fuelBonus(kmPerL) {
    if (!(kmPerL >= 0) || !isFinite(kmPerL)) return kmPerL === Infinity ? 400 : 0;
    if (kmPerL >= 8) return 400;
    if (kmPerL >= 6) return 250;
    if (kmPerL >= 4) return 100;
    return 0;
  }

  // 順位＝自分より速い過去記録数＋1（同タイムは同順位）。過去記録がなければ暫定1位。
  function segmentRank(time, pastTimes) {
    let faster = 0;
    (pastTimes || []).forEach(function (t) { if (t < time) faster++; });
    return faster + 1;
  }

  // 標準達成と順位加点は重複させず、大きい方を加算
  function segmentTimeBonus(time, lengthM, pastTimes) {
    const std = R13.route.standardTime(lengthM);
    const stdOk = time < std;
    const rank = segmentRank(time, pastTimes);
    const rankBonus = rank <= 3 ? SCORE.SEG_RANK[rank - 1] : 0;
    const stdBonus = stdOk ? SCORE.SEG_STANDARD : 0;
    return { std: std, stdOk: stdOk, rank: rank, rankBonus: rankBonus, stdBonus: stdBonus,
      bonus: Math.max(rankBonus, stdBonus), provisional: !(pastTimes && pastTimes.length) };
  }

  // 燃料計算（L）
  function fuelUse(F, v, d, dt, accel, brake) {
    if (accel && brake) accel = false;
    const kmh = v * 3.6;
    const dist = d / 1000 / 9 * (1 + (accel ? 0.55 : 0) + (brake ? 0.40 : 0) + Math.max(0, kmh - 60) / 100 * 0.65);
    const time = dt * (0.0001 + (accel ? 0.00015 : 0) + (brake ? 0.00008 : 0));
    return F * (dist + time);
  }

  // 必要な減速の前方判定距離
  function brakeLookahead(v) { return Math.min(220, v * v / 16 + 45); }

  function formatTime(sec) {
    if (!isFinite(sec)) return '--:--.--';
    sec = Math.max(0, sec);
    const m = Math.floor(sec / 60);
    const s = sec - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  }

  R13.rules = { SCORE: SCORE, REG_EVERY: REG_EVERY, SIGNAL_EVERY: SIGNAL_EVERY, regCaught: regCaught,
    signalCaught: signalCaught, fuelBonus: fuelBonus, segmentRank: segmentRank,
    segmentTimeBonus: segmentTimeBonus, fuelUse: fuelUse, brakeLookahead: brakeLookahead, formatTime: formatTime };
  if (typeof module !== 'undefined') module.exports = R13;
})(typeof window !== 'undefined' ? window : globalThis);
