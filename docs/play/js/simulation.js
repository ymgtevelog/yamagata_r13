/* simulation.js — 走行、一般車、追突防止、衝突、燃料、区間確定、保存復元 */
(function (G) {
  'use strict';
  const R13 = G.R13 = G.R13 || {};
  const RT = R13.route, RU = R13.rules, J = R13.journey, GA = R13.garage;
  const SC = RU.SCORE;

  const DT = 1 / 60;
  const CRUISE = 60 / 3.6;
  const TANK = 5.0;
  const REFUEL_BELOW = 4.85;
  const MAX_SAME = 16, MAX_OPP = 10;
  const GRACE = 1.6;
  const REC_DT = 0.5;
  const NPC_TYPES = [
    { kind: 'sedan', len: 4.5, wid: 1.76, hgt: 1.45, w: 5 },
    { kind: 'kei',   len: 3.4, wid: 1.48, hgt: 1.65, w: 4 },
    { kind: 'van',   len: 4.7, wid: 1.80, hgt: 1.95, w: 2 },
    { kind: 'truck', len: 7.6, wid: 2.25, hgt: 2.9,  w: 2 },
    { kind: 'suv',   len: 4.6, wid: 1.85, hgt: 1.70, w: 3 }
  ];
  const NPC_COLORS = ['#f2f2ee', '#1d1f24', '#8a9096', '#c9ccd0', '#7b2a2a', '#2f4f7a', '#e8e0c8', '#5a6b4e', '#b8862e', '#3d6f8f', '#ffffff', '#30343a'];

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pickType() {
    let tot = 0; NPC_TYPES.forEach(function (t) { tot += t.w; });
    let r = Math.random() * tot;
    for (const t of NPC_TYPES) { r -= t.w; if (r <= 0) return t; }
    return NPC_TYPES[0];
  }

  function serviceDepth(s) {
    let best = 0;
    for (const st of RT.STATIONS) {
      const d = Math.abs(s - st.s);
      if (d <= 70) return 1;
      if (d < 110) best = Math.max(best, (110 - d) / 40);
    }
    return best;
  }
  function bayLateral(stS) { return -(RT.halfWidth(stS) + 3.8); }

  function Sim(opts) {
    // opts: { course, driver, car, color, trip(saved) , pastSeg }
    this.course = RT.courseById(opts.trip ? opts.trip.courseId : opts.course);
    this.segments = RT.courseSegments(this.course);
    this.events = [];
    this.hold = null;
    if (opts.trip) this.st = JSON.parse(JSON.stringify(opts.trip));
    else this.st = this._fresh(opts);
    this.car = GA.carById(this.st.carId);
    this.dims = this.car.dims;
    this.npcs = [];
    this.excursion = null;
    this.prevBrake = false;
    this.stopTimer = 0;
    this.stationLock = null;
    this.signalArmed = {};
    this.grace = 0;
    this.shoulder = false;
    this.hornCooldown = 0;
    this.vx = 0;
    this.steer = 0;
    this.saveTimer = 0;
    this.lastViolation = null;
    this.st.season = this.st.season || 'autumn';
    this.practice = !!this.course.practice;
    this.weather = RT.weatherAt(this.st.season, this.st.s);
    this.slip = 0;              // 0..1 how much the car is sliding (for HUD/FX)
    // ghost recording: (s, x) every REC_DT seconds of driving time
    this.rec = opts.rec || { dt: REC_DT, s: [], x: [] };
    this.nextRec = this.rec.s.length * REC_DT;
    this._initTraffic();
  }

  Sim.prototype._fresh = function (o) {
    const c = this.course;
    const startRegion = RT.regionAt(c.start + 1);
    const lanes = RT.lanesAt(c.start + 10);
    const st = {
      v: 2, tripId: 't' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      courseId: c.id, driver: o.driver, carId: o.car || 'tourer', colorId: o.color || 'benibana',
      season: o.season || 'autumn', ghost: o.ghost || null,
      startedAt: Date.now(),
      s: c.start + 6, x: RT.lateralOfLane(lanes - 1, 1), speed: 0,
      dur: 100, fuel: TANK, fuelUsed: 0, time: 0,
      score: 0, maxS: c.start + 6,
      bd: { distance: 0, region: 0, pass: 0, signal: 0, souvenir: 0, mission: 0, segment: 0, fuel: 0, complete: 0, penalty: 0 },
      regCount: 0, sigCount: 0, camHit: {}, stationsUsed: {}, refuels: 0, gasOuts: 0, wrecks: 0, collisions: 0,
      passes: 0, regions: [startRegion.id], items: [],
      segIdx: 0, segStartTime: 0, segStartFuel: 0, segResults: [],
      missions: o.missions || [], comboDist: 0, maxMult: 1,
      pastSeg: o.pastSeg || {}, finished: false
    };
    return st;
  };

  Sim.prototype.serialize = function () { return JSON.parse(JSON.stringify(this.st)); };
  Sim.prototype.emit = function (type, data) { const e = data || {}; e.type = type; this.events.push(e); return e; };
  Sim.prototype.drainEvents = function () { const e = this.events; this.events = []; return e; };
  Sim.prototype.multiplier = function () { return J.comboMultiplier(this.st.comboDist); };

  Sim.prototype.addScore = function (pts, key) {
    const st = this.st;
    st.score = Math.max(0, st.score + pts);
    if (key) st.bd[key] = (st.bd[key] || 0) + pts;
  };
  Sim.prototype.penalize = function (pts) {
    const st = this.st;
    st.score = Math.max(0, st.score - pts);   // 得点の下限は0点
    st.bd.penalty += pts;
  };

  Sim.prototype.comboReset = function (reason) {
    const had = this.st.comboDist;
    this.st.comboDist = 0;
    if (had > 50) this.emit('comboReset', { reason: reason, mult: J.comboMultiplier(had) });
  };

  // ---------------------------------------------------------------- traffic
  Sim.prototype._capAt = function (dir, s) {
    const one = RT.lanesAt(s) === 1;
    const cap = dir > 0 ? (one ? MAX_SAME / 2 : MAX_SAME) : (one ? MAX_OPP / 2 : MAX_OPP);
    return this.practice ? Math.ceil(cap / 2) : cap;      // チュートリアルは交通量を半分に
  };
  Sim.prototype._initTraffic = function () {
    this.npcs = [];
    let id = 0;
    for (let i = 0; i < MAX_SAME; i++) this.npcs.push(this._newNpc(id++, 1, i));
    for (let i = 0; i < MAX_OPP; i++) this.npcs.push(this._newNpc(id++, -1, i));
    const ps = this.st.s;
    this.npcs.forEach(function (n) {
      n.hidden = true;
      const base = n.dir > 0 ? rand(-180, 820) : rand(60, 950);
      this._spawn(n, ps + base, true);
    }, this);
  };
  Sim.prototype._newNpc = function (id, dir, slot) {
    return { id: id, dir: dir, slot: slot, s: 0, x: 0, lane: 0, v: 0, v0: 0, len: 4.5, wid: 1.76, hgt: 1.45,
      kind: 'sedan', color: '#ffffff', hidden: true, crashed: 0, ignoreUntil: -1, prevAhead: true, passed: false,
      retry: 0, brakeLight: false, blink: 0 };
  };
  Sim.prototype._spawn = function (n, pos, initial) {
    if (pos < -1800 || pos > RT.TOTAL + 1800) { n.hidden = true; n.retry = 0.5; return false; }
    if (n.slot >= this._capAt(n.dir, pos)) { n.hidden = true; n.retry = 0.5; return false; }
    const lanes = RT.lanesAt(pos);
    const lane = Math.floor(Math.random() * lanes);
    const x = RT.lateralOfLane(lane, n.dir);
    // keep clear of other cars and of the player
    for (const o of this.npcs) {
      if (o === n || o.hidden || o.dir !== n.dir) continue;
      if (Math.abs(o.s - pos) < 28 && Math.abs(o.x - x) < 2.5) { n.hidden = true; n.retry = 0.3; return false; }
    }
    if (Math.abs(pos - this.st.s) < (initial ? 45 : 160)) { n.hidden = true; n.retry = 0.3; return false; }
    const t = pickType();
    n.kind = t.kind; n.len = t.len; n.wid = t.wid; n.hgt = t.hgt;
    n.color = NPC_COLORS[Math.floor(Math.random() * NPC_COLORS.length)];
    n.s = pos; n.lane = lane; n.x = x;
    if (n.dir > 0) {
      if (t.kind === 'truck') n.v0 = rand(40, 50) / 3.6;
      else if (lanes > 1 && lane === 0) n.v0 = rand(58, 72) / 3.6;
      else n.v0 = rand(43, 57) / 3.6;
    } else n.v0 = rand(46, 62) / 3.6;
    n.v = n.v0 * 0.9;
    n.hidden = false; n.crashed = 0; n.ignoreUntil = -1; n.passed = false;
    n.prevAhead = n.s > this.st.s;
    return true;
  };

  Sim.prototype._updateTraffic = function (dt) {
    const st = this.st, ps = st.s, px = st.x, pv = st.speed;
    const plen = this.dims.len;
    const t = st.time;
    for (const n of this.npcs) {
      if (n.hidden) {
        n.retry -= dt;
        if (n.retry <= 0) {
          let pos;
          if (n.dir > 0) pos = (pv < 9 && Math.random() < 0.5) ? ps - rand(200, 260) : ps + rand(560, 860);
          else pos = ps + rand(660, 960);
          this._spawn(n, pos, false);
        }
        continue;
      }
      const rel = n.s - ps;
      // window management
      if ((n.dir > 0 && (rel < -270 || rel > 940)) || (n.dir < 0 && (rel < -220 || rel > 1050))) {
        n.hidden = true; n.retry = rand(0.1, 1.2); continue;
      }
      // per-position cap (only drop when far from the player so cars never vanish in view)
      if (n.slot >= this._capAt(n.dir, n.s) && (rel < -150 || rel > 650)) { n.hidden = true; n.retry = 0.5; continue; }

      if (n.crashed > 0) {
        n.crashed -= dt;
        n.v = Math.max(0, n.v - 8 * dt);
        n.s += n.dir * n.v * dt;
        const edge = RT.halfWidth(n.s) + 0.8;
        n.x += (n.dir > 0 ? -1 : 1) * 1.6 * dt;
        n.x = Math.max(-edge, Math.min(edge, n.x));
        if (n.crashed <= 0 && Math.abs(rel) > 120) { n.hidden = true; n.retry = 1; }
        else if (n.crashed <= 0) n.crashed = 0.5;
        continue;
      }
      // merge when the lane ends ahead
      const lanesAhead = Math.min(RT.lanesAt(n.s + n.dir * 380), RT.lanesAt(n.s + n.dir * 200), RT.lanesAt(n.s));
      if (n.lane >= lanesAhead) {
        const tgt = lanesAhead - 1;
        const tx = RT.lateralOfLane(tgt, n.dir);
        let clear = true;
        for (const o of this.npcs) {
          if (o === n || o.hidden || o.dir !== n.dir) continue;
          if (Math.abs(o.x - tx) < 1.8 && Math.abs(o.s - n.s) < 14) { clear = false; break; }
        }
        if (clear || RT.halfWidth(n.s) < (n.lane + 0.75) * RT.LANE_W) { n.lane = tgt; n.blink = 2.5; }
      }
      const txl = RT.lateralOfLane(n.lane, n.dir);
      const dxl = txl - n.x;
      n.x += Math.max(-1.4 * dt, Math.min(1.4 * dt, dxl));
      if (n.blink > 0) n.blink -= dt;

      // leader search
      const front = n.s + n.dir * n.len / 2;
      let gap = 1e9, lv = 0, s0 = 4;
      for (const o of this.npcs) {
        if (o === n || o.hidden || o.dir !== n.dir) continue;
        if (Math.abs(o.x - n.x) > 2.3) continue;
        const d = (o.s - n.s) * n.dir;
        if (d <= 0) continue;
        const g = d - (o.len + n.len) / 2;
        if (g < gap) { gap = g; lv = o.v; s0 = 4; }
      }
      if (n.dir > 0 && t >= n.ignoreUntil && Math.abs(px - n.x) < 2.3 && ps > n.s) {
        // 自車を障害物として認識し、少なくとも約7 mの車間を保つ
        const g = (ps - n.s) - (plen + n.len) / 2;
        if (g < gap) { gap = g; lv = pv; s0 = 7.2; }
      }
      // signals
      for (const sg of RT.SIGNALS) {
        const line = n.dir > 0 ? sg.s - 1.5 : sg.s + 24.5;
        const dist = (line - front) * n.dir;
        if (dist < 0 || dist > 130) continue;
        const state = RT.signalState(sg, t);
        if (state === 2 || (state === 1 && dist > n.v * n.v / 8 + 2)) {
          const g = dist;
          if (g < gap) { gap = g; lv = 0; s0 = 0.8; }
        }
        break;
      }
      // IDM
      const v = n.v, v0 = n.v0 * (1 - 0.25 * RT.weatherAt(this.st.season, n.s).w);   // 一般車も悪天候では速度を落とす
      const a0 = 1.6, b = 2.6, T = 1.25;
      const sStar = s0 + Math.max(0, v * T + v * (v - lv) / (2 * Math.sqrt(a0 * b)));
      let acc = a0 * (1 - Math.pow(v / v0, 4));
      if (gap < 1e8) acc -= a0 * Math.pow(sStar / Math.max(0.1, gap), 2);
      acc = Math.max(-9, Math.min(a0, acc));
      n.brakeLight = acc < -0.6 || n.v < 0.3;
      n.v = Math.max(0, v + acc * dt);
      if (gap < 0.3 && n.v > lv) n.v = Math.min(n.v, lv);
      n.s += n.dir * n.v * dt;
    }
  };

  // ---------------------------------------------------------------- helpers
  Sim.prototype.leftLimit = function (s) {
    const hw = RT.halfWidth(s);
    return -(hw + RT.SHOULDER - 0.9 + serviceDepth(s) * 4.8);
  };
  Sim.prototype.rightLimit = function (s) { return RT.halfWidth(s) + RT.SHOULDER - 0.9; };

  Sim.prototype.isBrakeNecessary = function () {
    const st = this.st, v = st.speed, R = RU.brakeLookahead(v);
    const pf = st.s + this.dims.len / 2;
    for (const n of this.npcs) {
      if (n.hidden) continue;
      if (Math.abs(n.x - st.x) > 2.4) continue;
      const g = (n.s - n.len / 2) - pf;
      if (g > -1 && g < R) return true;
    }
    for (const sg of RT.SIGNALS) {
      const d = sg.s - pf;
      if (d > 0 && d < R && RT.signalState(sg, st.time) !== 0) return true;
    }
    for (const w of RT.SWITCHES) { const d = w.s - st.s; if (d > 0 && d < R) return true; }
    if (this.course.end - st.s < R) return true;
    for (const s2 of RT.STATIONS) if (Math.abs(st.s - s2.s) <= 200) return true;
    return false;
  };

  Sim.prototype._violation = function (kind) {
    const st = this.st;
    st.regCount++;
    this.comboReset(kind);
    const caught = RU.regCaught(st.regCount);
    this.emit('violation', { kind: kind, count: st.regCount, caught: caught });
    if (caught) this._police(kind === 'hamidashi' ? 'はみ出し禁止違反' : '追い越し禁止違反', SC.PEN_REG);
    this.requestSave = true;
  };
  Sim.prototype._police = function (reason, penalty) {
    this.penalize(penalty);
    this.st.speed = 0;
    this.vx = 0;
    this.hold = { type: 'police', reason: reason, penalty: penalty, t: 3.0 };
    this.emit('police', { reason: reason, penalty: penalty });
    this.requestSave = true;
  };

  Sim.prototype._missionDone = function (id) {
    const st = this.st;
    for (const m of st.missions) {
      if (m.id === id && !m.done) {
        m.done = true;
        this.addScore(J.MISSION_BONUS, 'mission');
        this.emit('mission', { mission: m });
        this.requestSave = true;
      }
    }
  };

  Sim.prototype._finalizeSegment = function () {
    const st = this.st;
    const seg = this.segments[st.segIdx];
    if (!seg) return;
    const time = st.time - st.segStartTime;
    const used = st.fuelUsed - st.segStartFuel;
    const kmpl = used > 0 ? (seg.length / 1000) / used : Infinity;
    const past = (st.pastSeg[st.segIdx] || []).map(function (r) { return r.time; });
    const tb = RU.segmentTimeBonus(time, seg.length, past);
    const fb = RU.fuelBonus(kmpl);
    this.addScore(tb.bonus, 'segment');
    this.addScore(fb, 'fuel');
    const res = { idx: st.segIdx, name: seg.name, length: seg.length, time: time, std: tb.std, stdOk: tb.stdOk,
      rank: tb.rank, provisional: tb.provisional, timeBonus: tb.bonus, kmpl: kmpl, fuelBonus: fb, totalBonus: tb.bonus + fb,
      pastCount: past.length };
    st.segResults.push(res);
    if (R13.records && !this.practice) R13.records.recordSegment(st.driver, st.courseId, st.segIdx, res);
    this.emit('segment', { result: res });
    if (kmpl >= 8) this._missionDone('fuel');
    st.segIdx++;
    st.segStartTime = st.time;
    st.segStartFuel = st.fuelUsed;
    this.requestSave = true;
  };

  Sim.prototype._enterRegion = function (region) {
    const st = this.st;
    const isNewTrip = st.regions.indexOf(region.id) < 0;
    let isNewZukan = false;
    if (R13.records && !this.practice) isNewZukan = R13.records.stamp(region.id);
    if (isNewTrip) {
      st.regions.push(region.id);
      this.addScore(SC.NEW_REGION, 'region');
      this._missionDone('town');
    }
    this.emit('region', { region: region, bonus: isNewTrip ? SC.NEW_REGION : 0, newStamp: isNewZukan });
    this.requestSave = true;
  };

  Sim.prototype.startStamp = function () {
    // 出発地域のスタンプ（加点なし）
    const r = RT.regionAt(this.course.start + 1);
    if (R13.records && !this.practice) R13.records.stamp(r.id);
  };

  Sim.prototype.checkpointS = function () {
    const r = RT.regionAt(this.st.s);
    return Math.max(r.start, this.course.start) + 6;
  };

  Sim.prototype._returnToMain = function (s) {
    const st = this.st;
    st.s = s;
    const lanes = RT.lanesAt(s);
    st.x = RT.lateralOfLane(lanes - 1, 1);
    st.speed = 0; this.vx = 0;
    this.excursion = null;
    this.stopTimer = 0;
    // clear cars standing on the restart point
    for (const n of this.npcs) {
      if (!n.hidden && Math.abs(n.s - s) < 30) { n.hidden = true; n.retry = 0.5; }
      if (!n.hidden) n.prevAhead = n.s > st.s;
    }
    st.maxS = Math.max(st.maxS, st.s);
  };

  // resolve a hold (called by the game after its overlay finishes)
  Sim.prototype.resolveHold = function () {
    const h = this.hold; this.hold = null;
    if (!h) return;
    const st = this.st;
    if (h.type === 'wreck') {
      this.penalize(SC.PEN_CHECKPOINT);
      st.dur = 100;
      const cp = this.checkpointS();
      this._returnToMain(cp);
      for (const n of this.npcs) { n.hidden = true; n.retry = rand(0, 0.6); }
      this.grace = GRACE;
    } else if (h.type === 'gasout') {
      st.fuel = 1.0;   // 救援車から1 Lの応急給油
    } else if (h.type === 'service') {
      this._returnToMain(h.returnS);
    }
    this.requestSave = true;
  };

  // 道の駅のご当地クイズ：停車中（service hold）に1問だけ答えられる。正解で +300 点。
  Sim.prototype.answerQuiz = function (qid, correct) {
    const h = this.hold, st = this.st;
    if (!h || h.type !== 'service' || !h.quiz || h.quizAnswered) return null;
    h.quizAnswered = true;
    st.quiz = st.quiz || { n: 0, ok: 0 };
    st.quiz.n++;
    let isNew = false, pts = 0;
    if (correct) {
      st.quiz.ok++;
      pts = SC.QUIZ;
      this.addScore(pts, 'quiz');
      if (R13.records && !this.practice) isNew = R13.records.quizCorrect(qid);
    }
    this.requestSave = true;
    return { correct: !!correct, pts: pts, isNew: isNew };
  };

  // ---------------------------------------------------------------- main step
  // input: { accel, brake, steer (-1..1) }
  Sim.prototype.step = function (input, dt) {
    dt = dt || DT;
    const st = this.st;
    if (this.hold || st.finished) return;
    const car = this.car;
    let accel = !!input.accel, brake = !!input.brake;
    if (accel && brake) accel = false;   // 両方を押した場合はブレーキ優先

    st.time += dt;
    if (st.time >= this.nextRec) {
      this.rec.s.push(Math.round(st.s * 10) / 10); this.rec.x.push(Math.round(st.x * 100) / 100);
      this.nextRec += REC_DT;
    }
    if (this.grace > 0) this.grace -= dt;
    if (this.hornCooldown > 0) this.hornCooldown -= dt;

    // brake edge: necessary or not
    if (brake && !this.prevBrake && st.speed > 0.5) {
      const necessary = this.isBrakeNecessary();
      const kmh = st.speed * 3.6;
      if (!necessary && kmh >= 60) this.comboReset('brake');
      if (!necessary && kmh >= 90) {
        for (const n of this.npcs) {
          if (n.hidden || n.dir < 0 || n.crashed > 0) continue;
          if (Math.abs(n.x - st.x) > 2.0) continue;
          const g = (st.s - this.dims.len / 2) - (n.s + n.len / 2);
          if (g >= -0.5 && g <= 25) { n.ignoreUntil = st.time + 2.0; this.emit('tailgate', {}); }
        }
      }
    }
    this.prevBrake = brake;

    // weather / grip (夏の雷雨・冬の降雪区間は滑りやすい)
    this.weather = RT.weatherAt(st.season, st.s);
    const grip = this.weather.grip;

    // longitudinal
    const vmax = car.vmaxKmh / 3.6;
    // 坂道：下りは速度が出やすくブレーキが利きにくい、上りは速度が落ちやすい（ゲーム用に重力の影響を強調）
    const grade = RT.gradeAt(st.s);
    this.grade = grade;
    const down = Math.max(0, -grade), up = Math.max(0, grade);
    const ag = -9.8 * grade * 3.0;
    let v = st.speed, a, ae = 0;
    if (brake) a = -12 * Math.max(0.3, Math.pow(grip, 1.1)) * (1 - Math.min(0.35, down * 7));   // 雪道で約2倍、下り坂でさらに伸びる
    else if (accel) {
      a = 6 * car.accel * (0.35 + 0.65 * grip) * (1 - Math.min(0.3, up * 4));               // ホイールスピン・上り坂
      const near = (vmax - v) / (0.18 * vmax);
      if (near < 1) a *= Math.max(0, near);
    } else {
      // ペダルを離すと60 km/hへ。下り坂ではエンジンブレーキが重力に負けて速度が上がる
      if (v < CRUISE) ae = 3.5 * (0.5 + 0.5 * grip); else if (v > CRUISE) ae = -3 * (1 - Math.min(0.9, down * 27)); else ae = 0;
      a = ae;
    }
    if (!brake || v > 0.3) a += ag;
    if (brake && v <= 0.3) a = Math.min(a, 0);                // 止まっている間はブレーキで坂でも動かない
    const hw = RT.halfWidth(st.s);
    const depth = serviceDepth(st.s);
    const offRoad = (st.x < -hw - 0.2 && depth <= 0) || st.x > hw + 0.2;
    if (offRoad && v > 30 / 3.6) a -= 4;
    let nv = v + a * dt;
    if (!brake && !accel) {
      if (v < CRUISE && nv > CRUISE && ag <= ae) nv = CRUISE;
      if (v > CRUISE && nv < CRUISE) nv = CRUISE;
    }
    if (nv > vmax) nv = vmax;
    if (nv < 0) nv = 0;
    st.speed = nv;
    const d = nv * dt;
    const prevS = st.s;
    st.s += d;

    // lateral (steering)
    let steer = Math.max(-1, Math.min(1, input.steer || 0));
    const k = RT.curvature(st.s);
    // 遠心方向への流れ（滑りやすい路面のカーブで発生）
    const drift = -k * nv * nv * (1 - grip) * 1.7;
    if (input.assist) {
      // 操舵アシスト：入力が小さいときは自車側の車線中央へ戻し、流れも打ち消す
      if (Math.abs(steer) < 0.12) {
        const lanesA = Math.min(RT.lanesAt(st.s), RT.lanesAt(st.s + 120));
        let best = null;
        for (let i = 0; i < lanesA; i++) { const lx = RT.lateralOfLane(i, 1); if (best === null || Math.abs(lx - st.x) < Math.abs(best - st.x)) best = lx; }
        const want = (best - st.x) * 0.45 - this.vx * 0.12 - drift * 0.18;
        steer = Math.max(-0.55, Math.min(0.55, want / (5.2 * car.turn * Math.max(0.2, Math.min(1, nv / 7)))));
      } else {
        steer = Math.max(-1, Math.min(1, steer - drift * 0.08));
      }
    }
    this.steer = steer;
    const lowSpeed = Math.min(1, nv / 7);
    const targetVx = steer * 5.2 * car.turn * lowSpeed;
    const response = 9 * (0.18 + 0.82 * grip * grip);     // 滑りやすいとハンドルの効きが遅れる
    this.vx += (targetVx - this.vx) * Math.min(1, dt * response);
    this.vx += drift * dt;
    this.slip = Math.min(1, Math.abs(drift) / 1.5 + (1 - grip) * (brake && nv > 8 ? 0.6 : 0));
    st.x += this.vx * dt;
    const ll = this.leftLimit(st.s), rl = this.rightLimit(st.s);
    if (st.x < ll) { st.x = ll; this.vx = 0; }
    if (st.x > rl) { st.x = rl; this.vx = 0; }

    // fuel
    const used = RU.fuelUse(car.fuel, nv, d, dt, accel, brake);
    st.fuel -= used; st.fuelUsed += used;

    // distance score (only for new ground), combo distance
    if (st.s > st.maxS) {
      const gain = st.s - st.maxS;
      st.maxS = st.s;
      this.addScore(gain * SC.PER_METER * this.multiplier(), 'distance');
    }
    const multBefore = this.multiplier();
    st.comboDist += d;
    const multAfter = this.multiplier();
    if (multAfter > multBefore) { this.emit('combo', { mult: multAfter }); st.maxMult = Math.max(st.maxMult, multAfter); }
    if (multAfter >= 1.1) this._missionDone('combo');
    for (const m of st.missions) if (m.id === 'careful' && !m.done && st.comboDist >= m.target) this._missionDone('careful');

    // shoulder driving
    if (offRoad) {
      st.dur = Math.max(0, st.dur - 4.5 * dt);
      if (!this.shoulder) { this.comboReset('shoulder'); this.emit('shoulder', {}); }
      this.shoulder = true;
    } else this.shoulder = false;

    this._updateTraffic(dt);
    this._collisions();
    this._overtaking();
    this._signals(prevS);
    this._cameras(prevS);
    this._stations(dt);

    // region boundary / goal
    if (!this.hold) {
      const c = this.course;
      if (st.s >= c.end) {
        this._finish();
        return;
      }
      for (const r of RT.REGIONS) {
        if (prevS < r.start && st.s >= r.start && r.start > c.start && r.start < c.end) {
          this._finalizeSegment();
          this._enterRegion(r);
        }
      }
    }

    // durability / fuel
    if (!this.hold && st.dur <= 0) {
      st.dur = 0; st.speed = 0; st.wrecks++;
      this.hold = { type: 'wreck', checkpoint: this.checkpointS() };
      this.emit('wreck', {});
      this.requestSave = true;
    } else if (!this.hold && st.fuel <= 0) {
      st.fuel = 0; st.speed = 0; st.gasOuts++;
      this.penalize(SC.PEN_GASOUT);
      this.comboReset('gasout');
      this.hold = { type: 'gasout' };
      this.emit('gasout', {});
      this.requestSave = true;
    }

    this.saveTimer += dt;
    if (this.saveTimer >= 8) { this.saveTimer = 0; this.requestSave = true; }
  };

  Sim.prototype._collisions = function () {
    const st = this.st, L = this.dims.len, W = this.dims.wid;
    for (const n of this.npcs) {
      if (n.hidden || n.crashed > 0) continue;
      const ds = n.s - st.s, dx = n.x - st.x;
      // horn when an oncoming car is on a collision course
      if (n.dir < 0 && this.hornCooldown <= 0 && Math.abs(dx) < 2.0 && ds > 10 && ds < 70) {
        this.hornCooldown = 3; this.emit('horn', { s: n.s });
      }
      if (Math.abs(ds) >= (L + n.len) / 2 - 0.05 || Math.abs(dx) >= (W + n.wid) / 2 - 0.05) continue;
      // overlap
      if (n.dir > 0) {
        if (ds > 0) { st.s = n.s - (L + n.len) / 2 - 0.05; }
        else { n.s = st.s - (L + n.len) / 2 - 0.05; n.v = Math.min(n.v, st.speed * 0.5); n.ignoreUntil = -1; }
      } else {
        n.crashed = 2.5;
      }
      if (this.grace <= 0) {
        const dmg = n.dir > 0 ? 34 : 50;
        st.dur = Math.max(0, st.dur - dmg);
        st.speed *= 0.3;
        if (n.dir > 0 && ds > 0) n.v = Math.max(n.v, st.speed + 1);
        st.collisions++;
        this.grace = GRACE;
        this.comboReset('crash');
        this.emit('collision', { dir: n.dir, damage: dmg });
        this.requestSave = true;
      }
    }
  };

  Sim.prototype._overtaking = function () {
    const st = this.st;
    const inOpp = st.x > 0;
    if (inOpp && !this.excursion) this.excursion = { counted: false, pending: [] };
    const ex = this.excursion;
    if (inOpp && ex && !ex.counted && RT.isYellow(st.s) && RT.lanesAt(st.s) >= 2) {
      ex.counted = true;               // はみ出しは同じ対向車線への進入中に重複計上しない
      this._violation('hamidashi');
    }
    for (const n of this.npcs) {
      if (n.hidden || n.dir < 0) continue;
      const nowAhead = n.s > st.s;
      if (n.prevAhead && !nowAhead && !n.passed && n.crashed <= 0 && Math.abs(n.x - st.x) > 1.2) {
        n.passed = true;
        if (inOpp && ex) ex.pending.push({ id: n.id, illegal: RT.isYellow(st.s) && RT.lanesAt(st.s) === 1 });
        else {
          this.addScore(SC.PASS_SAME, 'pass');
          st.passes++;
          this.emit('pass', { kind: 'same', pts: SC.PASS_SAME });
        }
      } else if (!n.prevAhead && nowAhead && ex) {
        ex.pending = ex.pending.filter(function (p) { return p.id !== n.id; });
        if (n.passed) n.passed = false;
      }
      n.prevAhead = nowAhead;
    }
    if (!inOpp && ex) {
      // 自車側へ戻った
      for (const p of ex.pending) {
        if (p.illegal) { if (!ex.counted) this._violation('overtake'); }
        else if (!ex.counted) {
          this.addScore(SC.PASS_ONCOMING, 'pass');
          st.passes++;
          this.emit('pass', { kind: 'oncoming', pts: SC.PASS_ONCOMING });
        }
      }
      this.excursion = null;
    }
  };

  Sim.prototype._signals = function (prevS) {
    const st = this.st;
    const half = this.dims.len / 2;
    const pf0 = prevS + half, pf1 = st.s + half;
    const inBay = st.x < -RT.halfWidth(st.s) - 1.0;
    for (const sg of RT.SIGNALS) {
      const d = sg.s - pf1;
      const state = RT.signalState(sg, st.time);
      if (st.speed < 0.4 && d >= -0.5 && d <= 45 && state === 2) this.signalArmed[sg.id] = true;
      if (pf0 < sg.s && pf1 >= sg.s) {
        if (inBay) continue;   // 駐車枠内の移動は除外
        if (state === 2) {
          st.sigCount++;
          this.comboReset('signal');
          const caught = RU.signalCaught(st.sigCount);
          this.emit('violation', { kind: 'signal', count: st.sigCount, caught: caught });
          if (caught) this._police('信号無視', SC.PEN_SIGNAL);
          this.requestSave = true;
        } else if (this.signalArmed[sg.id]) {
          this.addScore(SC.SIGNAL_WAIT, 'signal');
          this.emit('signalBonus', { pts: SC.SIGNAL_WAIT });
          this._missionDone('signal');
        }
        delete this.signalArmed[sg.id];
      }
    }
  };

  Sim.prototype._cameras = function (prevS) {
    const st = this.st;
    const pf0 = prevS + this.dims.len / 2, pf1 = st.s + this.dims.len / 2;
    for (const c of RT.CAMERAS) {
      if (pf0 < c.s && pf1 >= c.s) {
        const kmh = st.speed * 3.6;
        if (kmh > RT.CAMERA_TRIGGER_KMH && !st.camHit[c.id]) {
          st.camHit[c.id] = true;
          this.comboReset('camera');
          this.emit('violation', { kind: 'camera', kmh: kmh, caught: true });
          this._police('速度超過（自動速度取締り ' + Math.round(kmh) + ' km/h）', SC.PEN_CAMERA);
        } else {
          this.emit('cameraPass', { kmh: kmh, ok: kmh <= RT.CAMERA_TRIGGER_KMH });
        }
      }
    }
  };

  Sim.prototype._stations = function (dt) {
    const st = this.st;
    let inside = null;
    for (const s2 of RT.STATIONS) {
      if (!RT.inCourse(this.course, s2.s)) continue;
      if (Math.abs(st.s - s2.s) <= 70 && Math.abs(st.x - bayLateral(s2.s)) <= 1.6) { inside = s2; break; }
    }
    if (!inside) { this.stopTimer = 0; this.stationLock = null; return; }
    if (this.stationLock === inside.id) return;
    if (st.speed * 3.6 < 3) this.stopTimer += dt; else this.stopTimer = 0;
    if (this.stopTimer < 1.0) return;
    this.stopTimer = 0;
    this.stationLock = inside.id;
    const ret = inside.s + 90;
    if (inside.type === 'fuel') {
      if (st.fuel < REFUEL_BELOW) {
        const before = st.fuel;
        st.fuel = TANK; st.refuels++;
        this._missionDone('refuel');
        this.hold = { type: 'service', station: inside, kind: 'fuel', added: TANK - before, returnS: ret };
        this.emit('refuel', { station: inside, added: TANK - before });
      } else this.emit('serviceInfo', { text: '燃料はほぼ満タンです' });
    } else {
      if (!st.stationsUsed[inside.id]) {
        st.stationsUsed[inside.id] = true;
        st.items.push(inside.item);
        this.addScore(SC.SOUVENIR, 'souvenir');
        const before = st.dur;
        st.dur = Math.min(100, st.dur + 20);
        let isNew = false;
        if (R13.records && !this.practice) isNew = R13.records.collect(inside.item);
        this._missionDone('souvenir');
        this.hold = { type: 'service', station: inside, kind: 'eki', item: inside.item, newItem: isNew,
          repaired: st.dur - before, returnS: ret, quiz: !this.practice && !!(R13.quiz && R13.quiz.forStation(inside.id).length) };
        this.emit('souvenir', { station: inside, item: inside.item, isNew: isNew });
      } else this.emit('serviceInfo', { text: 'この旅ではすでに立ち寄り済みです' });
    }
    this.requestSave = true;
  };

  Sim.prototype._finish = function () {
    const st = this.st;
    this._finalizeSegment();
    const bonus = this.course.full ? SC.COMPLETE_FULL : SC.COMPLETE_CHALLENGE;
    this.addScore(bonus, 'complete');
    st.finished = true;
    st.finalScore = Math.floor(st.score);
    this.hold = { type: 'goal' };
    this.emit('goal', { score: st.finalScore, time: st.time });
  };

  // ---------------------------------------------------------------- HUD helpers
  Sim.prototype.info = function () {
    const st = this.st, c = this.course;
    const region = RT.regionAt(st.s);
    const out = { region: region, lanes: RT.lanesAt(st.s) };
    // next region or goal
    let next = null;
    for (const r of RT.REGIONS) if (r.start > st.s && r.start < c.end) { next = r; break; }
    out.nextName = next ? next.name : c.name + ' ゴール';
    out.nextDist = next ? next.start - st.s : c.end - st.s;
    out.remain = c.end - st.s;
    out.progress = Math.max(0, Math.min(1, (st.s - c.start) / (c.end - c.start)));
    // signal ahead
    out.signal = null;
    for (const sg of RT.SIGNALS) {
      const d = sg.s - (st.s + this.dims.len / 2);
      if (d > -2 && d < 320) { out.signal = { d: d, state: RT.signalState(sg, st.time), id: sg.id,
        remain: signalRemain(sg, st.time) }; break; }
    }
    const sw = RT.nextSwitch(st.s);
    out.laneReduce = (sw && sw.to < sw.from && sw.s - st.s < 650) ? { d: sw.s - st.s, from: sw.from, to: sw.to } : null;
    out.laneAdd = (sw && sw.to > sw.from && sw.s - st.s < 300) ? { d: sw.s - st.s } : null;
    out.yellow = RT.isYellow(st.s);
    out.yellowAhead = !out.yellow && RT.isYellow(st.s + 150);
    out.camera = null;
    for (const cm of RT.CAMERAS) { const d = cm.s - st.s; if (d > 0 && d < 700) { out.camera = { d: d, done: !!st.camHit[cm.id] }; break; } }
    out.service = null;
    for (const s2 of RT.STATIONS) {
      if (!RT.inCourse(c, s2.s)) continue;
      const d = s2.s - st.s;
      if (d > -70 && d < 1500) {
        out.service = { st: s2, d: d, used: s2.type === 'eki' ? !!st.stationsUsed[s2.id] : false,
          bayX: bayLateral(s2.s) };
        break;
      }
    }
    out.segTime = st.time - st.segStartTime;
    const seg = this.segments[st.segIdx];
    out.segStd = seg ? RT.standardTime(seg.length) : 0;
    const segFuel = st.fuelUsed - st.segStartFuel;
    const segDist = seg ? Math.max(0, st.s - seg.start) : 0;
    out.segKmpl = (segFuel > 0.002 && segDist > 300) ? Math.min(99.9, (segDist / 1000) / segFuel) : null;
    out.mult = this.multiplier();
    out.missionsDone = st.missions.filter(function (m) { return m.done; }).length;
    out.offRoad = this.shoulder;
    return out;
  };

  function signalRemain(sg, t) {
    const p = ((t + sg.offset) % sg.cycle + sg.cycle) % sg.cycle;
    if (p < sg.green) return sg.green - p;
    if (p < sg.green + sg.yellow) return sg.green + sg.yellow - p;
    return sg.cycle - p;
  }

  R13.Sim = Sim;
  R13.sim = { DT: DT, TANK: TANK, CRUISE: CRUISE, serviceDepth: serviceDepth, bayLateral: bayLateral, NPC_TYPES: NPC_TYPES };
  if (typeof module !== 'undefined') module.exports = R13;
})(typeof window !== 'undefined' ? window : globalThis);
