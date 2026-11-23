/* ghost.js — ゴーストカー（過去の走行の再現）。走行時間に合わせて位置を補間し、同じ地点の通過時刻差を求める。
 * ゴーストとは接触しない（一般車・判定には一切関与しない表示専用）。 */
(function (G) {
  'use strict';
  const R13 = G.R13 = G.R13 || {};

  // position of the ghost at driving time t (seconds)
  function posAt(g, t) {
    const n = g.s.length;
    if (!n) return null;
    const f = t / g.dt;
    if (f >= n - 1) return { s: g.s[n - 1], x: g.x[n - 1], done: true, i: n - 1 };
    if (f <= 0) return { s: g.s[0], x: g.x[0], done: false, i: 0 };
    const i = Math.floor(f), u = f - i;
    return { s: g.s[i] + (g.s[i + 1] - g.s[i]) * u, x: g.x[i] + (g.x[i + 1] - g.x[i]) * u, done: false, i: i };
  }

  // the driving time at which the ghost first reached distance s (uses the running maximum, so rewinds are ignored)
  function timeAtS(g, s) {
    const a = g.sMax, n = a.length;
    if (!n || s < a[0]) return 0;
    if (s > a[n - 1]) return null;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (a[m] >= s) hi = m; else lo = m; }
    const s0 = a[lo], s1 = a[hi];
    const u = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
    return (lo + u) * g.dt;
  }

  // gap in seconds: positive = you are behind the ghost
  function gap(g, s, t) {
    const tg = timeAtS(g, s);
    if (tg == null) return null;
    return t - tg;
  }

  R13.ghost = { posAt: posAt, timeAtS: timeAtS, gap: gap };
  if (typeof module !== 'undefined') module.exports = R13;
})(typeof window !== 'undefined' ? window : globalThis);
