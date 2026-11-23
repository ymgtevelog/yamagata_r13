/* garage.js — 車種、色、解放条件 */
(function (G) {
  'use strict';
  const R13 = G.R13 = G.R13 || {};

  const CARS = [
    { id: 'tourer',  name: 'R13 ツアラー',   need: 0,     vmaxKmh: 160, accel: 1.0,  turn: 1.0,  fuel: 1.00,
      dims: { len: 4.5, wid: 1.80, hgt: 1.45 }, desc: '標準車。どの区間でも扱いやすいバランス型。' },
    { id: 'compact', name: '里山コンパクト', need: 8000,  vmaxKmh: 150, accel: 0.9,  turn: 1.18, fuel: 0.90,
      dims: { len: 3.9, wid: 1.70, hgt: 1.55 }, desc: '燃費と旋回性能に優れる小型車。山あいの道や給油の少ない区間で強い。' },
    { id: 'sport',   name: '蔵王スポーツ',   need: 30000, vmaxKmh: 180, accel: 1.22, turn: 1.04, fuel: 1.25,
      dims: { len: 4.6, wid: 1.88, hgt: 1.25 }, desc: '加速と最高速度に特徴。燃料の減りは早いので給油計画が鍵。' }
  ];

  const COLORS = [
    { id: 'benibana', name: '紅花レッド',       need: 0,     hex: '#9F3F36' },
    { id: 'komeiro',  name: '米色クリーム',     need: 3000,  hex: '#DED1AA' },
    { id: 'seiryu',   name: '清流ブルー',       need: 7000,  hex: '#305B78' },
    { id: 'satoyama', name: '里山グリーン',     need: 12000, hex: '#507C60' },
    { id: 'yukiakari', name: '雪明かりシルバー', need: 18000, hex: '#B8C7CC' }
  ];

  function carById(id) { for (const c of CARS) if (c.id === id) return c; return CARS[0]; }
  function colorById(id) { for (const c of COLORS) if (c.id === id) return c; return COLORS[0]; }
  function isCarUnlocked(id, points) { return (points || 0) >= carById(id).need; }
  function isColorUnlocked(id, points) { return (points || 0) >= colorById(id).need; }
  // 次に解放されるもの
  function nextUnlock(points) {
    const all = CARS.map(function (c) { return { kind: '車種', name: c.name, need: c.need }; })
      .concat(COLORS.map(function (c) { return { kind: '車体色', name: c.name, need: c.need }; }))
      .filter(function (x) { return x.need > (points || 0); })
      .sort(function (a, b) { return a.need - b.need; });
    return all[0] || null;
  }
  function unlockedBetween(before, after) {
    const out = [];
    CARS.forEach(function (c) { if (c.need > before && c.need <= after) out.push('車種「' + c.name + '」'); });
    COLORS.forEach(function (c) { if (c.need > before && c.need <= after) out.push('車体色「' + c.name + '」'); });
    return out;
  }

  R13.garage = { CARS: CARS, COLORS: COLORS, carById: carById, colorById: colorById,
    isCarUnlocked: isCarUnlocked, isColorUnlocked: isColorUnlocked, nextUnlock: nextUnlock, unlockedBetween: unlockedBetween };
  if (typeof module !== 'undefined') module.exports = R13;
})(typeof window !== 'undefined' ? window : globalThis);
