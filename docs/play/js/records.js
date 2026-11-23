/* records.js — ドライバー登録、コース別記録、総合順位、図鑑、設定、保存と消去 */
(function (G) {
  'use strict';
  const R13 = G.R13 = G.R13 || {};

  const KEY = 'r13.data.v062';
  const KEY_SETTINGS = 'r13.settings.v062';
  const OLD_KEYS = { data060: 'r13.data.v060', zukan050: 'r13.zukan.v050', settings050: 'r13.settings.v050' };
  const MAX_DRIVERS = 20;

  const DEFAULT_SETTINGS = {
    steer: 'tilt', sens: 1.0, invert: false, quality: 'standard', scenery: 'clear',
    bgm: true, se: true, vibe: true, shake: true, view: 'chase',
    season: 'autumn', assist: false, speedWarn: false, tutorialDone: false, bgmMode: 'town',
    card: 'full'   // 名所カード：full=イラスト付き / brief=最初だけイラスト / name=名前だけ
  };

  // --- storage with graceful fallback ---
  // On Android the save is written to app-private files through the host (durable),
  // mirrored to WebView localStorage; in a browser only localStorage is used.
  const mem = {};
  const host = (G.AndroidHost && typeof G.AndroidHost.storageGet === 'function') ? G.AndroidHost : null;
  function lsGet(k) { try { return G.localStorage.getItem(k); } catch (e) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; } }
  function lsSet(k, v) { try { G.localStorage.setItem(k, v); } catch (e) { mem[k] = v; } }
  function lsRemove(k) { try { G.localStorage.removeItem(k); } catch (e) { delete mem[k]; } }
  const storage = {
    get: function (k) {
      if (host) {
        try {
          const v = host.storageGet(k);
          if (v != null && v !== '') return v;
        } catch (e) { }
        const old = lsGet(k);                    // migrate a value that only exists in WebView storage
        if (old != null) { try { host.storageSet(k, old); } catch (e) { } }
        return old;
      }
      return lsGet(k);
    },
    set: function (k, v) {
      if (host) { try { host.storageSet(k, v); } catch (e) { } }
      lsSet(k, v);
    },
    remove: function (k) {
      if (host) { try { host.storageRemove(k); } catch (e) { } }
      lsRemove(k);
    }
  };
  function readJSON(k) { try { const s = storage.get(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

  let data = null;
  let settings = null;

  function blank() { return { ver: '0.6.2', drivers: {}, zukan: { stamps: {}, items: {} }, eraseGen: 0, routeVer: 2 }; }

  function newDriver(name) {
    return { name: name, created: Date.now(), points: 0, car: 'tourer', color: 'benibana',
      lastMissions: '', credited: [], courses: {}, trip: null };
  }

  function migrate(d) {
    // 0.6.0 の名前・記録・途中保存
    const old = readJSON(OLD_KEYS.data060);
    if (old && old.drivers) {
      Object.keys(old.drivers).forEach(function (n) {
        const o = old.drivers[n];
        if (d.drivers[n]) return;
        const nd = newDriver(n);
        nd.courses = o.courses || {};
        nd.trip = o.trip || null;
        let maxBest = 0;
        Object.keys(nd.courses).forEach(function (c) { maxBest = Math.max(maxBest, nd.courses[c].best || 0); });
        nd.points = o.points != null ? o.points : maxBest;   // 過去の完走最高得点を初期ポイントへ充当
        d.drivers[n] = nd;
      });
      if (old.zukan) d.zukan = old.zukan;
    }
    // 0.5.0 の図鑑
    const z = readJSON(OLD_KEYS.zukan050);
    if (z && z.stamps) {
      Object.assign(d.zukan.stamps, z.stamps || {});
      Object.assign(d.zukan.items, z.items || {});
    }
    return d;
  }

  function load() {
    data = readJSON(KEY);
    if (!data || !data.drivers) { data = migrate(blank()); save(); }
    data.zukan = data.zukan || { stamps: {}, items: {} };
    data.zukan.quiz = data.zukan.quiz || {};
    data.zukan.cards = data.zukan.cards || {};
    // 0.6.5：大石田と尾花沢の順番を入れ替えたため、区間の長さが変わった記録だけを整理する（得点・図鑑・ほかのコースの記録は残す）
    if ((data.routeVer || 1) < 2) {
      Object.keys(data.drivers).forEach(function (n) {
        const dr = data.drivers[n];
        if (dr.courses) {
          delete dr.courses.soba;                                             // そば街道は 8 km → 6 km に変更
          [['full', [8, 9]], ['obanazawa', [0, 1]]].forEach(function (x) {    // 区間タイム：35～41 km の2区間
            const c = dr.courses[x[0]]; if (!c) return;
            x[1].forEach(function (i) { if (c.segBest) delete c.segBest[i]; });
            c.segLast = [];
          });
        }
        if (dr.trip && dr.trip.courseId === 'soba') dr.trip = null;
      });
      if (data.ghosts && data.ghosts.soba) {
        Object.keys(data.ghosts.soba).forEach(function (n) { storage.remove('r13.ghost.soba.' + n); });
        delete data.ghosts.soba;
      }
      data.routeVer = 2;
      save();
    }
    settings = Object.assign({}, DEFAULT_SETTINGS, readJSON(OLD_KEYS.settings050) || {}, readJSON(KEY_SETTINGS) || {});
    return data;
  }
  function save() { if (data) storage.set(KEY, JSON.stringify(data)); }
  function saveSettings() { storage.set(KEY_SETTINGS, JSON.stringify(settings)); }
  function getSettings() { if (!settings) load(); return settings; }
  function setSetting(k, v) { getSettings()[k] = v; saveSettings(); }
  function getData() { if (!data) load(); return data; }

  // 名前：A～Zの1～16文字。前後空白を除き大文字に統一。
  function normalizeName(raw) {
    const n = String(raw || '').trim().toUpperCase();
    if (!/^[A-Z]{1,16}$/.test(n)) return null;
    return n;
  }
  function driverNames() { return Object.keys(getData().drivers).sort(); }
  function getDriver(name) { return getData().drivers[name] || null; }
  function addDriver(raw) {
    const n = normalizeName(raw);
    if (!n) return { ok: false, error: 'アルファベットA～Zの1～16文字で入力してください。' };
    const d = getData();
    if (d.drivers[n]) return { ok: true, name: n, existing: true };
    if (Object.keys(d.drivers).length >= MAX_DRIVERS)
      return { ok: false, error: '登録は最大20名です。既存の名前を整理してください。' };
    d.drivers[n] = newDriver(n);
    save();
    return { ok: true, name: n };
  }

  function courseRec(dr, courseId) {
    dr.courses[courseId] = dr.courses[courseId] || { best: null, bestTime: null, completions: 0, last: null, segBest: {}, segLast: [] };
    return dr.courses[courseId];
  }

  // 出発前に保存された各ドライバーの区間ベスト（自分を含む）
  function pastSegmentSnapshot(courseId) {
    const out = {};
    driverNames().forEach(function (n) {
      const c = getDriver(n).courses[courseId];
      if (!c || !c.segBest) return;
      Object.keys(c.segBest).forEach(function (i) {
        (out[i] = out[i] || []).push({ name: n, time: c.segBest[i] });
      });
    });
    return out;
  }

  function recordSegment(name, courseId, idx, result) {
    const dr = getDriver(name); if (!dr) return;
    const c = courseRec(dr, courseId);
    const b = c.segBest[idx];
    if (b == null || result.time < b) c.segBest[idx] = result.time;
    c.segLast[idx] = { time: result.time, kmpl: result.kmpl, bonus: result.totalBonus };
    save();
  }

  // 完走：最高得点、最速完走時間、完走回数、直近得点、解放ポイント（同じ完走の二重加算を防止）
  function recordCompletion(name, courseId, tripId, score, time, season) {
    const dr = getDriver(name); if (!dr) return null;
    const c = courseRec(dr, courseId);
    const already = dr.credited.indexOf(tripId) >= 0;
    const before = dr.points || 0;
    if (!already) {
      c.completions++;
      c.last = score;
      if (c.best == null || score > c.best) { c.best = score; c.bestSeason = season || null; }
      if (c.bestTime == null || time < c.bestTime) { c.bestTime = time; c.bestTimeSeason = season || null; }
      dr.points = before + score;
      dr.credited.push(tripId);
      if (dr.credited.length > 60) dr.credited.splice(0, dr.credited.length - 60);
    }
    save();
    return { pointsBefore: before, pointsAfter: dr.points, duplicate: already };
  }
  function recordLast(name, courseId, score) {
    const dr = getDriver(name); if (!dr) return;
    courseRec(dr, courseId).last = score; save();
  }

  // 記録一覧：各人の最高得点を降順、同点なら最速完走時間を優先
  function courseRanking(courseId) {
    const rows = [];
    driverNames().forEach(function (n) {
      const c = getDriver(n).courses[courseId];
      if (c && c.completions > 0 && c.best != null)
        rows.push({ name: n, best: c.best, bestTime: c.bestTime, completions: c.completions, last: c.last,
          bestSeason: c.bestSeason || null, bestTimeSeason: c.bestTimeSeason || null });
    });
    rows.sort(function (a, b) { return b.best - a.best || (a.bestTime || 1e9) - (b.bestTime || 1e9); });
    let rank = 0, prev = null;
    rows.forEach(function (r, i) { if (prev === null || r.best !== prev) { rank = i + 1; prev = r.best; } r.rank = rank; });
    return rows;
  }
  // ゴール時：今回の整数得点を他ドライバーの完走最高得点と比較。同点は同順位。
  function rankAgainstOthers(courseId, name, score) {
    let higher = 0, total = 1;
    driverNames().forEach(function (n) {
      if (n === name) return;
      const c = getDriver(n).courses[courseId];
      if (c && c.completions > 0 && c.best != null) { total++; if (c.best > score) higher++; }
    });
    return { rank: higher + 1, total: total };
  }
  function bestFullScore() {
    let best = 0;
    driverNames().forEach(function (n) { const c = getDriver(n).courses.full; if (c && c.best != null) best = Math.max(best, c.best); });
    return best;
  }

  // 途中の旅（名前ごとに1件）
  function saveTrip(name, trip, gen) {
    const d = getData();
    if (gen != null && gen !== d.eraseGen) return false;   // 消去後に古い旅が復活しないように
    const dr = d.drivers[name];
    if (!dr) return false;
    dr.trip = trip; save(); return true;
  }
  function clearTrip(name) { const dr = getDriver(name); if (dr) { dr.trip = null; save(); } }

  // 図鑑（端末共通）
  function stamp(regionId) { const z = getData().zukan; const isNew = !z.stamps[regionId]; z.stamps[regionId] = true; save(); return isNew; }
  // ご当地クイズ：正解した問題を図鑑に記録
  function quizCorrect(qid) { const z = getData().zukan; z.quiz = z.quiz || {}; const isNew = !z.quiz[qid]; z.quiz[qid] = true; save(); return isNew; }
  function quizDone() { const z = getData().zukan; return z.quiz || {}; }
  // 名所カード：通過して出会ったカードを図鑑に残す
  function cardGet(id) { const z = getData().zukan; z.cards = z.cards || {}; const isNew = !z.cards[id]; if (isNew) { z.cards[id] = true; save(); } return isNew; }
  function cardsDone() { const z = getData().zukan; return z.cards || {}; }
  function collect(itemId) { const z = getData().zukan; const isNew = !z.items[itemId]; z.items[itemId] = true; save(); return isNew; }

  // ---- ゴースト（過去の走行の再現）----
  // 走行は 0.5 秒ごとの (距離s, 横位置x) を整数差分で圧縮し、コース×名前ごとに最速完走1件を保存する。
  function ghostKey(courseId, name) { return 'r13.ghost.' + courseId + '.' + name; }
  function encodeSeq(arr, scale) {
    const out = []; let prev = 0;
    for (let i = 0; i < arr.length; i++) { const v = Math.round(arr[i] * scale); out.push(v - prev); prev = v; }
    return out.join(',');
  }
  function decodeSeq(str, scale) {
    if (!str) return new Float32Array(0);
    const parts = str.split(','); const out = new Float32Array(parts.length); let acc = 0;
    for (let i = 0; i < parts.length; i++) { acc += parseInt(parts[i], 10) || 0; out[i] = acc / scale; }
    return out;
  }
  function ghostIndex() { const d = getData(); d.ghosts = d.ghosts || {}; return d.ghosts; }
  function listGhosts(courseId) {
    const g = ghostIndex()[courseId] || {};
    return Object.keys(g).filter(function (n) { return !!getDriver(n); }).map(function (n) { return Object.assign({ name: n }, g[n]); })
      .sort(function (a, b) { return a.time - b.time; });
  }
  // 最速完走なら保存して true
  function saveGhostIfBest(name, courseId, rec, meta) {
    if (!getDriver(name) || !rec || !rec.s || rec.s.length < 4) return false;
    const idx = ghostIndex();
    idx[courseId] = idx[courseId] || {};
    const cur = idx[courseId][name];
    if (cur && cur.time <= meta.time) return false;
    const blob = { v: 1, dt: rec.dt, s: encodeSeq(rec.s, 10), x: encodeSeq(rec.x, 100), seg: meta.seg || [] };
    storage.set(ghostKey(courseId, name), JSON.stringify(blob));
    idx[courseId][name] = { time: meta.time, score: meta.score, season: meta.season || null, car: meta.car, color: meta.color, date: Date.now() };
    save();
    return true;
  }
  function loadGhost(courseId, name) {
    const meta = (ghostIndex()[courseId] || {})[name];
    if (!meta) return null;
    const blob = readJSON(ghostKey(courseId, name));
    if (!blob) return null;
    const sArr = decodeSeq(blob.s, 10), xArr = decodeSeq(blob.x, 100);
    const sMax = new Float32Array(sArr.length); let m = -1e9;
    for (let i = 0; i < sArr.length; i++) { m = Math.max(m, sArr[i]); sMax[i] = m; }
    return { name: name, course: courseId, dt: blob.dt, s: sArr, x: xArr, sMax: sMax, seg: blob.seg || [], meta: meta };
  }
  function removeGhost(courseId, name) {
    const idx = ghostIndex();
    if (idx[courseId] && idx[courseId][name]) delete idx[courseId][name];
    storage.remove(ghostKey(courseId, name));
  }
  // 走行中の記録（途中保存と一緒に再開できるように別キーで保持）
  function saveRec(name, tripId, rec) {
    if (!getDriver(name) || !rec) return;
    storage.set('r13.rec.' + name, JSON.stringify({ tripId: tripId, dt: rec.dt, s: encodeSeq(rec.s, 10), x: encodeSeq(rec.x, 100) }));
  }
  function loadRec(name, tripId) {
    const b = readJSON('r13.rec.' + name);
    if (!b || b.tripId !== tripId) return null;
    return { dt: b.dt, s: Array.prototype.slice.call(decodeSeq(b.s, 10)), x: Array.prototype.slice.call(decodeSeq(b.x, 100)) };
  }
  function clearRec(name) { storage.remove('r13.rec.' + name); }

  // ---- 消去 ----
  function eraseDriver(name) {
    const d = getData();
    if (!d.drivers[name]) return false;
    delete d.drivers[name];
    Object.keys(ghostIndex()).forEach(function (cid) { removeGhost(cid, name); });
    clearRec(name);
    // 他ドライバーの途中保存に残る順位比較用の名前も整理
    Object.keys(d.drivers).forEach(function (n) {
      const t = d.drivers[n].trip;
      if (t && t.pastSeg) Object.keys(t.pastSeg).forEach(function (i) {
        t.pastSeg[i] = t.pastSeg[i].filter(function (r) { return r.name !== name; });
      });
    });
    d.eraseGen = (d.eraseGen || 0) + 1;
    save();
    return true;
  }
  function eraseAll() {
    const idx = ghostIndex();
    Object.keys(idx).forEach(function (cid) { Object.keys(idx[cid]).forEach(function (n) { storage.remove(ghostKey(cid, n)); }); });
    driverNames().forEach(clearRec);
    const gen = (getData().eraseGen || 0) + 1;
    data = blank(); data.eraseGen = gen;
    Object.keys(OLD_KEYS).forEach(function (k) { if (k !== 'settings050') storage.remove(OLD_KEYS[k]); });
    save();
  }
  function confirmCode() { return String(Math.floor(1000 + Math.random() * 9000)); }

  R13.records = { MAX_DRIVERS: MAX_DRIVERS, DEFAULT_SETTINGS: DEFAULT_SETTINGS, load: load, save: save,
    getData: getData, getSettings: getSettings, setSetting: setSetting, saveSettings: saveSettings,
    normalizeName: normalizeName, driverNames: driverNames, getDriver: getDriver, addDriver: addDriver,
    courseRec: courseRec, pastSegmentSnapshot: pastSegmentSnapshot, recordSegment: recordSegment,
    recordCompletion: recordCompletion, recordLast: recordLast, courseRanking: courseRanking,
    rankAgainstOthers: rankAgainstOthers, bestFullScore: bestFullScore, saveTrip: saveTrip, clearTrip: clearTrip,
    stamp: stamp, collect: collect, quizCorrect: quizCorrect, quizDone: quizDone, cardGet: cardGet, cardsDone: cardsDone, eraseDriver: eraseDriver, eraseAll: eraseAll, confirmCode: confirmCode,
    listGhosts: listGhosts, saveGhostIfBest: saveGhostIfBest, loadGhost: loadGhost, removeGhost: removeGhost,
    saveRec: saveRec, loadRec: loadRec, clearRec: clearRec,
    _storage: storage };
  if (typeof module !== 'undefined') module.exports = R13;
})(typeof window !== 'undefined' ? window : globalThis);
