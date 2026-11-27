/* game.js — 画面遷移、入力、保存タイミング、HUD、演出 */
(function (G) {
  'use strict';
  const R13 = G.R13;
  const RT = R13.route, RU = R13.rules, J = R13.journey, GA = R13.garage, REC = R13.records, DC = R13.dataControl;
  const esc = DC.esc;
  const DT = R13.sim.DT;
  function $(id) { return document.getElementById(id); }
  function fmtInt(n) { return Math.floor(n).toLocaleString('ja-JP'); }
  function fmtKm(m) { return (Math.max(0, m) / 1000).toFixed(1) + ' km'; }
  const host = G.AndroidHost || null;
  // 傾き：アプリ版は AndroidHost、ブラウザ版は web-host.js（DeviceMotion）
  const tiltSrc = host || (R13.web && R13.web.tiltHost) || null;

  const Game = {
    mode: 'menu', screen: 'title', sim: null, driver: null, courseId: 'full', prevScreen: 'title',
    renderer: null, audio: new R13.Audio(), settings: null, last: 0, acc: 0, hudT: 0,
    count: null, neutral: 0, tiltSamples: [], steerKey: 0, alertsKey: '', showcaseS: 36420, gen: 0,
    input: { accel: false, brake: false, left: false, right: false, keys: {} }, holdTimer: 0, segTimer: 0,
    ghostData: null, ghostChoice: {}, tut: null, recSaveT: 0, photoCam: { yaw: 2.6, pitch: 0.24, dist: 9, fov: 50 }, photoHud: false
  };
  G.R13Game = Game;

  // ================================================================ init
  Game.init = function () {
    REC.load();
    this.settings = REC.getSettings();
    try { this.renderer = new R13.Renderer($('gl')); }
    catch (e) {
      document.body.innerHTML = '<div style="color:#fff;padding:30px;font-family:sans-serif">' + (host ? 'この端末のWebViewではWebGLを利用できません。Android System WebView を更新してください。' : 'このブラウザでは 3D 表示（WebGL）を利用できません。最新の Safari または Chrome でお試しください。') + '<br><small>' + esc(e.message) + '</small></div>';
      return;
    }
    R13.sights.preloadPhotos();
    this._webSetup();
    this.renderer.setQuality(this.settings.quality);
    this.renderer.setScenery(this.settings.scenery);
    this.renderer.setSeason(this.settings.season || 'autumn');
    this.renderer.camMode = this.settings.view || 'chase';
    this.audio.bgmOn = this.settings.bgm; this.audio.seOn = this.settings.se;
    this.audio.bgmMode = this.settings.bgmMode || 'town';
    this.driver = this._lastDriver();
    this._showcaseCar();
    this.renderer.warm(this.showcaseS);
    this._bindUI();
    this._bindInput();
    this.show('title');
    const self = this;
    function frame(ts) { self._frame(ts); requestAnimationFrame(frame); }
    requestAnimationFrame(frame);
  };

  Game._lastDriver = function () {
    let n = null;
    try { n = REC._storage.get('r13.lastDriver'); } catch (e) { }
    return n && REC.getDriver(n) ? n : (REC.driverNames()[0] || null);
  };
  Game._setLastDriver = function (n) { this.driver = n; try { REC._storage.set('r13.lastDriver', n || ''); } catch (e) { } };

  Game._showcaseCar = function () {
    const d = this.driver && REC.getDriver(this.driver);
    const car = GA.carById(d ? d.car : 'tourer'), col = GA.colorById(d ? d.color : 'benibana');
    this.renderer.setPlayerCar(car, col.hex);
  };

  // ================================================================ screens
  Game.show = function (name) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('on'); });
    const el = $(name === 'hud' ? 'hud' : 'scr-' + name);
    if (el) el.classList.add('on');
    this.screen = name;
    if (name !== 'hud') { this.audio.stopBgm(); this.audio.engineStop(); }
    if (name === 'title') this._renderTitle();
    if (name === 'courses') this._renderCourses();
    if (name === 'driver') this._renderDriver();
    if (name === 'garage') this._renderGarage();
    if (name === 'zukan') this._renderZukan();
    if (name === 'records') this._renderRecords(this._recCourse || 'full');
    if (name === 'settings') this._renderSettings();
    if (name === 'music') this._renderMusic();
  };

  // ---------------------------------------------------------------- 楽曲紹介（山形たびめぐり音楽帳）
  Game._renderMusic = function () {
    const MU = R13.music, self = this;
    const cur = (this.prevScreen === 'pause' && this.sim) ? RT.regionAt(this.sim.st.s).id : null;
    const classic = this.settings.bgmMode === 'classic';
    $('mu-now').innerHTML = cur
      ? (classic ? '<b>♪ いま流れている曲</b>「んだんだ！やまがた」（設定の「BGMの曲」で市町村ソングに切り替えられます）'
        : '<b>♪ いま流れている曲</b>' + esc(RT.regionAt(this.sim.st.s).name + RT.regionAt(this.sim.st.s).muni) + 'の歌<button class="btn small yt" data-mv="' + cur + '">▶ この曲の MV</button>')
      : '';
    $('mu-now').style.display = cur ? '' : 'none';
    $('mu-list').innerHTML = RT.REGIONS.map(function (r, i) {
      const url = MU.MV[r.id];
      return '<div class="mu-item' + (r.id === cur && !classic ? ' now' : '') + '"><span class="mu-no">' + (i + 1) + '</span>' +
        '<span class="mu-tx"><b>' + esc(r.name + r.muni) + '</b><small>' + esc(MU.AREA[r.id] || '') + '・' + (r.start / 1000) + '～' + (r.end / 1000) + ' km' + (r.id === cur && !classic ? '・<em>再生中</em>' : '') + '</small></span>' +
        (url ? '<button class="btn small yt" data-mv="' + r.id + '" aria-label="' + esc(r.name + r.muni) + 'の歌の MV を YouTube で見る">▶ MV</button>' : '') + '</div>';
    }).join('');
    document.querySelectorAll('#scr-music [data-mv]').forEach(function (b) {
      b.onclick = function () { self._openLink(MU.MV[b.getAttribute('data-mv')]); };
    });
  };
  // YouTube のリンクを外部アプリで開く（開けなければ画面に案内）
  Game._openLink = function (url) {
    this.audio.sfx('tap');
    R13.music.open(url);
  };
  Game._backFromMusic = function () {
    if (this.prevScreen === 'pause' && this.sim) { this._backFromSettings(); return; }
    this.show(this.prevScreen === 'howto' ? 'howto' : 'title');
  };

  Game._renderTitle = function () {
    $('title-best').textContent = fmtInt(REC.bestFullScore());
    // 途中の旅（未完走）の得点も見えるようにする
    const d = this.driver && REC.getDriver(this.driver);
    const tt = $('title-trip');
    if (d && d.trip) {
      const tc = RT.courseById(d.trip.courseId);
      tt.innerHTML = '<span class="play">▶</span><span class="tt-main">途中の旅　<b>' + esc(d.name) + '</b>　' + RT.seasonById(d.trip.season || 'autumn').icon + ' ' + esc(tc.name) + '　' + esc(RT.regionAt(d.trip.s).name) + '　<b class="gold">' + fmtInt(d.trip.score) + '</b> 点' +
        '<small>完走すると記録と解放ポイントに反映されます</small></span><span class="go">続きから ›</span>';
      tt.style.display = '';
      const self = this;
      // 途中の旅 → そのドライバー・コースの出発画面（続きから再開／ゴースト選択）へ
      tt.onclick = function () { self.audio.unlock(); self.audio.sfx('tap'); self._setLastDriver(d.name); self.courseId = d.trip.courseId; self.prevScreen = 'title'; self.show('driver'); };
    } else tt.style.display = 'none';
    this.mode = 'menu';
    this._showcaseCar();
    this._renderSeasonPick();
    $('btn-tutorial').classList.toggle('pulse', !this.settings.tutorialDone);
  };

  // 季節の選択（タイトル）。次の新しい旅に適用し、保存中の旅は開始時の季節で再開する。
  Game._renderSeasonPick = function () {
    const self = this, box = $('season-pick');
    box.innerHTML = RT.SEASONS.map(function (x) {
      return '<button data-season="' + x.id + '" class="' + (self.settings.season === x.id ? 'sel' : '') + '" title="' + esc(x.label) + '">' + x.icon + '<span>' + x.name + '</span></button>';
    }).join('') + '<span class="season-label">' + esc(RT.seasonById(this.settings.season).label) + '</span>';
    box.querySelectorAll('button').forEach(function (b) {
      b.onclick = function () {
        self.audio.unlock(); self.audio.sfx('tap');
        REC.setSetting('season', b.dataset.season);
        self.renderer.setSeason(b.dataset.season);
        self.renderer.warm(self.showcaseS);
        self._renderSeasonPick();
      };
    });
  };

  Game._renderCourses = function () {
    const list = $('course-list');
    const self = this;
    list.innerHTML = '';
    RT.COURSES.filter(function (c) { return !c.full && !c.practice; }).forEach(function (c) {
      const f = RT.courseFeatures(c);
      const rk = REC.courseRanking(c.id);
      const top = rk[0];
      const div = document.createElement('div');
      div.className = 'course-card';
      div.innerHTML = '<b>' + esc(c.name) + '</b><span class="lbl">' + esc(c.label) + '</span>' +
        '<span class="meta">全行程 ' + (c.start / 1000) + '～' + (c.end / 1000) + ' km　' + esc(c.guide) + '</span>' +
        '<div class="tags"><span class="tag">🚦 信号 ' + f.signals + '</span>' + (f.ekis ? '<span class="tag">🎁 道の駅 ' + f.ekis + '</span>' : '') +
        (f.fuels ? '<span class="tag">⛽ 給油 ' + f.fuels + '</span>' : '') + '<span class="tag">🏘 ' + f.regions + '地域</span></div>' +
        (top ? '<span class="mybest">🏆 ' + esc(top.name) + '　' + fmtInt(top.best) + '点</span>' : '<span class="meta">まだ完走記録はありません</span>');
      div.onclick = function () { self.audio.unlock(); self.audio.sfx('tap'); self.courseId = c.id; self.prevScreen = 'courses'; self.show('driver'); };
      list.appendChild(div);
    });
  };

  // ---------------------------------------------------------------- driver
  Game._renderDriver = function () {
    const c = RT.courseById(this.courseId);
    $('driver-course').textContent = c.name + '（' + c.label + '）';
    const list = $('driver-list');
    const self = this;
    list.innerHTML = '';
    const names = REC.driverNames();
    names.forEach(function (n) {
      const d = REC.getDriver(n);
      const b = document.createElement('button');
      b.className = 'chip' + (n === self.driver ? ' sel' : '');
      b.innerHTML = esc(n) + (d.trip ? '<span class="dot" title="途中の旅あり"></span>' : '');
      b.onclick = function () { self.audio.sfx('tap'); self._setLastDriver(n); self._renderDriver(); };
      list.appendChild(b);
    });
    if (!names.length) list.innerHTML = '<p class="hint">まだドライバーが登録されていません。</p>';
    $('name-hint').textContent = '名前はアルファベットA～Zの1～16文字（' + names.length + '/' + REC.MAX_DRIVERS + '名）。大文字に統一して保存します。';
    const det = $('driver-detail');
    const d = this.driver && REC.getDriver(this.driver);
    if (!d) { det.innerHTML = '<p class="hint">名前を選ぶか、新しく登録してください。</p>'; return; }
    const rec = d.courses[c.id] || {};
    const car = GA.carById(d.car), col = GA.colorById(d.color);
    let kv = '<div class="kv">' +
      '<span>このコースの最高</span><span>' + (rec.best != null ? fmtInt(rec.best) + ' 点' : '—') + '</span>' +
      '<span>最速完走</span><span>' + (rec.bestTime != null ? RU.formatTime(rec.bestTime) : '—') + '</span>' +
      '<span>完走回数</span><span>' + (rec.completions || 0) + ' 回</span>' +
      '<span>車両</span><span>' + esc(car.name) + '／' + esc(col.name) + '</span>' +
      '<span>解放ポイント</span><span>' + fmtInt(d.points || 0) + '</span>' +
      '<span>季節</span><span>' + RT.seasonById(this.settings.season).icon + ' ' + esc(RT.seasonById(this.settings.season).label) + '（タイトルで変更）</span></div>';
    let html = '<h3>' + esc(d.name) + '</h3>';
    // ゴーストカーの選択（登録したドライバーの最速完走を再現。接触しない）
    const ghosts = REC.listGhosts(c.id);
    if (this.ghostChoice[c.id] === undefined) {
      const own = ghosts.filter(function (g) { return g.name === d.name; })[0];
      this.ghostChoice[c.id] = own ? own.name : '';
    }
    const gsel = this.ghostChoice[c.id];
    html += '<div class="ghost-pick"><label>👻 ゴーストと走る</label><select id="dr-ghost"><option value="">なし</option>' + ghosts.map(function (g) {
      const se = g.season ? RT.seasonById(g.season).icon : '';
      return '<option value="' + esc(g.name) + '"' + (g.name === gsel ? ' selected' : '') + '>' + esc(g.name) + (g.name === d.name ? '（自分）' : '') + '　' + RU.formatTime(g.time) + ' ' + se + '</option>';
    }).join('') + '</select>' + (ghosts.length ? '' : '<span class="hint">完走するとゴーストが保存されます</span>') + '</div>';
    const ghostHtml = html.slice(html.indexOf('<div class="ghost-pick">'));
    html = html.slice(0, html.indexOf('<div class="ghost-pick">')) + '<div class="driver-actions">';
    if (d.trip) {
      const tc = RT.courseById(d.trip.courseId);
      const pos = ((d.trip.s - tc.start) / 1000).toFixed(1);
      const ts = RT.seasonById(d.trip.season || 'autumn'), cs = RT.seasonById(this.settings.season);
      const differs = ts.id !== cs.id;
      html += '<p class="hint">途中の旅：<b>' + esc(tc.name) + '</b>　' + ts.icon + ts.name + '　' + pos + ' km地点　' + fmtInt(d.trip.score) + '点　' + esc(RT.regionAt(d.trip.s).name) + '</p>';
      if (differs) html += '<p class="hint season-warn">⚠ 途中の旅は「' + ts.icon + ' ' + ts.name + '」で始めた旅です。再開すると' + ts.name + 'の景色・路面のまま続きます。いま選んでいる「' + cs.icon + ' ' + cs.name + '」で走るには「新しく出発」を選んでください。</p>';
      html += '<button class="btn big primary" id="dr-resume">▶ 続きから再開<small>' + ts.icon + ts.name + '　' + esc(tc.name) + '　' + esc(RT.regionAt(d.trip.s).name) + 'から</small></button>';
      html += '<button class="btn big" id="dr-new">🚗 新しく出発<small>' + cs.icon + cs.name + '　' + esc(c.name) + '（途中の旅は上書き）</small></button>';
    } else {
      html += '<button class="btn big primary" id="dr-new">🚗 出発する<small>' + RT.seasonById(this.settings.season).icon + RT.seasonById(this.settings.season).name + '　' + esc(c.name) + '　' + esc(c.label) + '</small></button>';
    }
    // 出発ボタンを先頭に、ゴースト選択・記録の詳細はその下へ（低い画面でもボタンが見える）
    html += '</div>' + ghostHtml + kv + '<button class="btn" id="dr-garage">🔧 ガレージで車を選ぶ</button><br><button class="linkbtn" id="dr-erase">この名前の記録を消去…</button>';
    det.innerHTML = html;
    if ($('dr-resume')) $('dr-resume').onclick = function () { self.audio.unlock(); self.startTrip(d.name, null, d.trip); };
    $('dr-ghost').onchange = function () { self.ghostChoice[c.id] = this.value; };
    $('dr-new').onclick = function () {
      self.audio.unlock();
      if (d.trip) DC.confirm({ title: '途中の旅を上書きしますか？', html: '「' + esc(RT.courseById(d.trip.courseId).name) + '」の途中保存を上書きして、「' + esc(c.name) + '」を新しく始めます。', yes: '上書きして出発', danger: true,
        onYes: function () { self.startTrip(d.name, c.id, null); } });
      else self.startTrip(d.name, c.id, null);
    };
    $('dr-garage').onclick = function () { self.prevScreen = 'driver'; self.show('garage'); };
    $('dr-erase').onclick = function () {
      DC.openErase({ title: d.name + ' の記録を消去', html: 'この名前の記録、途中の旅、解放ポイント、車種と色を消去します。他の名前と、端末共通の図鑑・設定は残ります。',
        onErase: function () { REC.eraseDriver(d.name); self._setLastDriver(REC.driverNames()[0] || null); self._renderDriver(); self._toastMenu('消去しました'); } });
    };
  };
  Game._toastMenu = function (t) { const h = $('name-hint'); if (h) { h.textContent = t; } };

  // ---------------------------------------------------------------- garage
  Game._renderGarage = function () {
    const sel = $('garage-driver');
    const self = this;
    const names = REC.driverNames();
    sel.innerHTML = names.map(function (n) { return '<option' + (n === self.driver ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('');
    sel.style.display = names.length ? '' : 'none';
    sel.onchange = function () { self._setLastDriver(sel.value); self._renderGarage(); };
    const d = this.driver && REC.getDriver(this.driver);
    if (!d) {
      $('garage-points').innerHTML = 'ドライバーを登録するとガレージを使えます。';
      $('garage-cars').innerHTML = ''; $('garage-colors').innerHTML = '';
      this._showcaseCar(); return;
    }
    const pts = d.points || 0;
    const nx = GA.nextUnlock(pts);
    let prevNeed = 0;
    [].concat(GA.CARS, GA.COLORS).forEach(function (x) { if (x.need <= pts) prevNeed = Math.max(prevNeed, x.need); });
    $('garage-points').innerHTML = esc(d.name) + ' の累計解放ポイント<b>' + fmtInt(pts) + '</b>' +
      (nx ? '<span class="next">次の解放：' + nx.kind + '「' + esc(nx.name) + '」まで あと ' + fmtInt(nx.need - pts) + ' pt</span><div class="pbar"><i style="width:' +
        Math.min(100, (pts - prevNeed) / Math.max(1, nx.need - prevNeed) * 100) + '%"></i></div>' : '<span class="next">すべて解放済み！</span>') +
      (d.trip ? '<span class="next">途中の旅（' + esc(RT.courseById(d.trip.courseId).name) + '）の得点 <b class="small">' + fmtInt(d.trip.score) + '</b> は完走時に加算されます</span>' : '');
    const cars = $('garage-cars');
    cars.innerHTML = '';
    GA.CARS.forEach(function (c) {
      const un = GA.isCarUnlocked(c.id, pts);
      const div = document.createElement('div');
      div.className = 'car-card' + (d.car === c.id ? ' sel' : '') + (un ? '' : ' locked');
      const stat = function (label, v, max) { return '<div class="stat"><label>' + label + '</label><div class="sb"><i style="width:' + Math.round(v / max * 100) + '%"></i></div></div>'; };
      div.innerHTML = (un ? '' : '<span class="lock">🔒 ' + fmtInt(c.need) + '</span>') + '<b>' + esc(c.name) + '</b>' +
        stat('最高速', c.vmaxKmh, 180) + stat('加速', c.accel, 1.3) + stat('旋回', c.turn, 1.2) + stat('燃費', 1 / c.fuel, 1.15) +
        '<div class="hint">' + esc(c.desc) + '</div>';
      div.onclick = function () {
        if (!un) { self.audio.sfx('warn'); return; }
        d.car = c.id; REC.save(); self.audio.sfx('tap'); self._renderGarage();
      };
      cars.appendChild(div);
    });
    const cols = $('garage-colors');
    cols.innerHTML = '';
    GA.COLORS.forEach(function (c) {
      const un = GA.isColorUnlocked(c.id, pts);
      const div = document.createElement('div');
      div.className = 'swatch' + (d.color === c.id ? ' sel' : '') + (un ? '' : ' locked');
      div.innerHTML = '<i style="background:' + c.hex + '"></i>' + esc(c.name) + (un ? '' : '<br>🔒 ' + fmtInt(c.need));
      div.onclick = function () {
        if (!un) { self.audio.sfx('warn'); return; }
        d.color = c.id; REC.save(); self.audio.sfx('tap'); self._renderGarage();
      };
      cols.appendChild(div);
    });
    this._showcaseCar();
  };

  // ---------------------------------------------------------------- zukan
  Game._renderZukan = function () {
    const z = REC.getData().zukan;
    let ns = 0, ni = 0;
    $('zukan-stamps').innerHTML = RT.REGIONS.map(function (r) {
      const got = !!z.stamps[r.id]; if (got) ns++;
      return '<div class="stamp' + (got ? ' got' : '') + '"' + (got ? ' title="' + esc(r.tag) + '"' : '') + '>' + esc(r.name) + '<small>' + (got ? esc(r.kana) : '？？？') + '</small>' + (got ? '<small class="tg">' + esc(r.tag) + '</small>' : '') + '</div>';
    }).join('');
    $('zukan-items').innerHTML = Object.keys(RT.ITEMS).map(function (k) {
      const it = RT.ITEMS[k], got = !!z.items[k]; if (got) ni++;
      const st = RT.STATIONS.filter(function (s) { return s.id === it.station; })[0];
      return '<div class="item' + (got ? '' : ' no') + '"><div class="ico">' + it.icon + '</div><div><b>' + (got ? esc(it.name) : '？？？') + '</b>' +
        '<p>' + esc(st.name) + '（' + (st.s / 1000).toFixed(1) + ' km）</p>' + (got ? '<p>' + esc(it.note) + '</p>' : '<p>道の駅に立ち寄って手に入れよう</p>') + '</div></div>';
    }).join('');
    // ご当地クイズの進み具合（道の駅ごと）
    const qd = REC.quizDone();
    let nq = 0;
    $('zukan-quiz').innerHTML = RT.STATIONS.filter(function (s) { return s.type === 'eki'; }).map(function (s) {
      const list = R13.quiz.forStation(s.id);
      const got = list.filter(function (q) { return qd[q.id]; }).length; nq += got;
      return '<div class="qp">' + esc(s.name) + '<small>正解 ' + got + ' / ' + list.length + (got === list.length && list.length ? '　全問正解！' : '') + '</small><span class="dots">' +
        list.map(function (q) { return qd[q.id] ? '<i>●</i>' : '○'; }).join('') + '</span></div>';
    }).join('');
    // 名所カード（市町村ごと）
    const cd = REC.cardsDone(), self = this;
    let nc = 0;
    $('zukan-cards').innerHTML = RT.REGIONS.map(function (r) {
      const list = R13.sights.forRegion(r.id);
      const got = list.filter(function (c) { return cd[c.id]; }).length; nc += got;
      return '<div class="cg-h">' + esc(r.name + r.muni) + '<small>' + got + ' / ' + list.length + '</small></div>' + list.map(function (c) {
        return cd[c.id] ? '<button type="button" data-card="' + c.id + '"><img alt="" loading="lazy" src="' + R13.sights.dataUrl(c, 240, 150) + '"><span>' + esc(c.name) + '</span></button>'
          : '<button type="button" class="no" disabled><div class="q">？</div><span>まだ出会っていません</span></button>';
      }).join('');
    }).join('');
    $('zukan-cards').querySelectorAll('button[data-card]').forEach(function (b) { b.onclick = function () { self._openSight(b.getAttribute('data-card')); }; });
    $('zukan-cards-n').textContent = nc + ' / ' + R13.sights.CARDS.length;
    $('zukan-count').textContent = 'スタンプ ' + ns + '/13　おみやげ ' + ni + '/7　クイズ ' + nq + '/' + R13.quiz.total() + '　名所カード ' + nc + '/' + R13.sights.CARDS.length;
  };

  // ---------------------------------------------------------------- records
  Game._renderRecords = function (cid) {
    this._recCourse = cid;
    const self = this;
    $('rec-tabs').innerHTML = '';
    RT.COURSES.filter(function (c) { return !c.practice; }).forEach(function (c) {
      const b = document.createElement('button');
      b.className = 'tab' + (c.id === cid ? ' sel' : '');
      b.textContent = c.name;
      b.onclick = function () { self._renderRecords(c.id); };
      $('rec-tabs').appendChild(b);
    });
    const rows = REC.courseRanking(cid);
    const medals = ['🥇', '🥈', '🥉'];
    let html = '<table class="rank"><tr><th>順位</th><th>名前</th><th>最高得点</th><th>最速完走</th><th>完走</th><th>直近</th></tr>';
    if (!rows.length) html += '<tr><td colspan="6" class="hint">まだ完走記録はありません。</td></tr>';
    rows.forEach(function (r) {
      const se = function (x) { return x ? ' ' + RT.seasonById(x).icon : ''; };
      const hasGhost = REC.listGhosts(cid).some(function (g) { return g.name === r.name; });
      html += '<tr><td>' + (r.rank <= 3 ? '<span class="medal">' + medals[r.rank - 1] + '</span>' : r.rank) + '</td><td><b>' + esc(r.name) + '</b>' + (hasGhost ? ' 👻' : '') + '</td><td class="num">' + fmtInt(r.best) + se(r.bestSeason) +
        '</td><td class="num">' + RU.formatTime(r.bestTime) + se(r.bestTimeSeason) + '</td><td class="num">' + r.completions + '</td><td class="num">' + (r.last != null ? fmtInt(r.last) : '—') + '</td></tr>';
    });
    // 途中の旅（未完走）：総合順位には入れないが、得点と現在地を表示
    const trips = REC.driverNames().map(function (n) { return REC.getDriver(n); })
      .filter(function (d) { return d.trip && d.trip.courseId === cid; })
      .sort(function (a, b) { return b.trip.score - a.trip.score; });
    if (trips.length) {
      const c = RT.courseById(cid);
      html += '</table><h3>途中の旅（未完走・保存中）</h3><table class="rank"><tr><th>名前</th><th>現在の得点</th><th>現在地</th><th>経過時間</th></tr>';
      trips.forEach(function (d) {
        html += '<tr><td><b>' + esc(d.name) + '</b></td><td class="num">' + fmtInt(d.trip.score) + '</td><td>' + esc(RT.regionAt(d.trip.s).name) + '　' +
          ((d.trip.s - c.start) / 1000).toFixed(1) + ' km</td><td class="num">' + RU.formatTime(d.trip.time) + '</td></tr>';
      });
      html += '<tr><td colspan="4" class="hint">完走すると最高得点・総合順位・解放ポイントに反映されます。</td></tr>';
    }
    html += '</table><h3>区間ベスト</h3><table class="rank"><tr><th>区間</th><th>距離</th><th>標準タイム</th><th>ベスト</th><th>記録者</th></tr>';
    const segs = RT.courseSegments(RT.courseById(cid));
    const snap = REC.pastSegmentSnapshot(cid);
    segs.forEach(function (sg, i) {
      const recs = (snap[i] || []).slice().sort(function (a, b) { return a.time - b.time; });
      const b = recs[0];
      html += '<tr><td>' + esc(sg.name) + '</td><td class="num">' + (sg.length / 1000).toFixed(1) + ' km</td><td class="num">' + RU.formatTime(RT.standardTime(sg.length)) +
        '</td><td class="num">' + (b ? RU.formatTime(b.time) : '—') + '</td><td>' + (b ? esc(b.name) : '') + '</td></tr>';
    });
    html += '</table><p class="hint">記録一覧は各人の最高得点を降順に並べ、同点なら最速完走時間を優先します。順位はコース別・季節共通です（🌸🌻🍁⛄は記録した季節、👻はゴーストあり）。</p>';
    $('rec-body').innerHTML = html;
  };

  // ---------------------------------------------------------------- settings
  Game._renderSettings = function () {
    const S = this.settings, self = this;
    const fromPause = this.prevScreen === 'pause';
    const seg = function (key, label, opts) {
      return '<div class="set-row"><label>' + label + '</label><div class="seg" data-key="' + key + '">' + opts.map(function (o) {
        return '<button data-v="' + o[0] + '" class="' + (String(S[key]) === String(o[0]) ? 'sel' : '') + '">' + o[1] + '</button>';
      }).join('') + '</div></div>';
    };
    const onoff = function (key, label) { return seg(key, label, [[true, 'ON'], [false, 'OFF']]); };
    let html = seg('steer', '操舵', [['tilt', '端末の傾き'], ['touch', 'タッチボタン']]) +
      '<div class="set-row"><label>傾き感度</label><div class="slider"><input type="range" min="0.5" max="1.8" step="0.1" id="set-sens" value="' + S.sens + '"><b id="set-sens-v">' + Number(S.sens).toFixed(1) + '倍</b></div></div>' +
      onoff('invert', '左右反転') +
      seg('quality', '描画品質', [['light', '軽量'], ['standard', '標準'], ['high', '高画質']]) +
      seg('scenery', '景観', [['clear', '青空と実りの道'], ['sunset', '夕映え'], ['rain', '雨上がり']]) +
      onoff('bgm', 'BGM') + seg('bgmMode', 'BGMの曲', [['town', '市町村ソング'], ['classic', 'んだんだ！やまがた']]) + onoff('se', 'エンジン音と効果音') + onoff('vibe', '振動') + onoff('shake', 'カメラ揺れ') +
      seg('view', '視点', [['chase', '追従'], ['bonnet', 'ボンネット']]) +
      seg('card', '名所カード', [['full', 'イラスト付き'], ['brief', '最初だけイラスト'], ['name', '名前だけ']]) +
      seg('season', '季節（次の旅）', RT.SEASONS.map(function (x) { return [x.id, x.icon + x.name]; })) +
      onoff('assist', '🔰 操舵アシスト') + onoff('speedWarn', '🔰 速度注意表示');
    html += '<p class="hint about-line">山形ドライブ R13 ver 1.0.7（非公式・個人制作）　<a href="' + R13.music.PRIVACY + '" data-ext>プライバシーポリシー</a></p>';
    if (!fromPause) html += '<div class="danger-zone"><div><b>全履歴消去</b><div class="hint">全ドライバー、全コース記録、途中の旅、図鑑、解放ポイント、旧版の記録を消去します。描画や音などの設定は残ります。</div></div><button class="btn danger" id="set-erase">全履歴消去…</button></div>';
    else html += '<p class="hint" style="grid-column:1/-1">データの消去はタイトル画面の設定から行えます。</p>';
    if (host && host.hasSensor && !host.hasSensor()) html += '<p class="hint" style="grid-column:1/-1">この端末では傾きセンサーが見つからないため、タッチボタンで操舵します。</p>';
    if (!host && R13.web) {
      const wt = R13.web.tilt;
      if (!wt.supported) html += '<p class="hint" style="grid-column:1/-1">このブラウザでは傾きセンサーを使えないため、タッチボタンで操舵します（PC は ← → キー）。</p>';
      else if (wt.permission === 'denied') html += '<p class="hint" style="grid-column:1/-1">「動作と方向」へのアクセスが許可されなかったため、タッチボタンで操舵します。傾きで操作するには、ページを読み込み直して最初のタップで「許可」を選んでください。</p>';
    }
    $('settings-body').innerHTML = html;
    document.querySelectorAll('#settings-body .seg').forEach(function (el) {
      el.querySelectorAll('button').forEach(function (b) {
        b.onclick = function () {
          const key = el.dataset.key; let v = b.dataset.v;
          if (v === 'true') v = true; else if (v === 'false') v = false;
          self.applySetting(key, v);
          self._renderSettings();
        };
      });
    });
    const sens = $('set-sens');
    sens.oninput = function () { $('set-sens-v').textContent = Number(sens.value).toFixed(1) + '倍'; self.applySetting('sens', Math.round(Number(sens.value) * 10) / 10); };
    if ($('set-erase')) $('set-erase').onclick = function () {
      DC.openErase({ title: '全履歴消去', html: '全ドライバー、全コース記録、途中の旅、図鑑、解放ポイント、旧版の記録を消去します。描画や音などの設定は残ります。',
        onErase: function () { REC.eraseAll(); self.sim = null; self._setLastDriver(null); self._showcaseCar(); self.show('title'); } });
    };
  };

  Game.applySetting = function (key, v) {
    REC.setSetting(key, v);
    const r = this.renderer;
    if (key === 'quality') { r.setQuality(v); r.warm(this.sim ? this.sim.st.s : this.showcaseS); }
    if (key === 'scenery') { r.setScenery(v); r.clearChunks(); r.warm(this.sim ? this.sim.st.s : this.showcaseS); }
    if (key === 'bgm') this.audio.setBgm(v);
    if (key === 'bgmMode') this.audio.setBgmMode(v);
    if (key === 'se') this.audio.setSe(v);
    if (key === 'view') r.camMode = v;
    if (key === 'card' && this._cardCur) $('h-card').classList.toggle('mini', v === 'name' || (v === 'brief' && this._cardT <= CARD_SEC - CARD_FULL_SEC));
    if (key === 'season' && !this.sim) { r.setSeason(v); r.warm(this.showcaseS); }
    this._applySteerMode();
    this.audio.sfx('tap');
  };

  Game._tiltAvailable = function () { return !!(tiltSrc && tiltSrc.hasSensor && tiltSrc.hasSensor()); };
  Game._applySteerMode = function () {
    const touch = this.settings.steer === 'touch' || !this._tiltAvailable();
    $('hud').classList.toggle('touch', touch);
  };

  // ブラウザ版の表示（アプリ版では何もしない）
  Game._webSetup = function () {
    if (host || !R13.web) return;
    const W = R13.web, self = this;
    document.documentElement.classList.add('web');
    $('ver-line').innerHTML = '山形ドライブ R13 ver 1.0.7　ブラウザ版・非公式<br>広告／課金なし';
    W.tilt.onChange = function () { self._applySteerMode(); if (self.screen === 'settings') self._renderSettings(); };
    // iPhone の Safari で開いているとき：ホーム画面への追加を案内
    let hide = false; try { hide = localStorage.getItem('r13.a2hs') === '1'; } catch (e) { }
    if (W.isIOS && !W.standalone && !hide) {
      const el = $('a2hs'); el.classList.add('on');
      $('a2hs-close').onclick = function (e) { e.stopPropagation(); el.classList.remove('on'); try { localStorage.setItem('r13.a2hs', '1'); } catch (x) { } };
    }
  };

  // ================================================================ trip flow
  Game.startTrip = function (name, courseId, savedTrip) {
    const d = REC.getDriver(name);
    if (!d) return;
    this.tut = null;
    this._setLastDriver(name);
    let sim;
    this.gen = REC.getData().eraseGen || 0;
    if (savedTrip) {
      // 走行記録（ゴースト用）も途中から再開。見つからなければこの旅のゴーストは保存しない
      let rec = REC.loadRec(name, savedTrip.tripId);
      if (!rec) rec = { dt: 0.5, s: [], x: [], partial: savedTrip.time > 1 };
      sim = new R13.Sim({ trip: savedTrip, rec: rec });
    } else {
      const c = RT.courseById(courseId);
      const missions = J.drawMissions(c, d.lastMissions || '');
      d.lastMissions = J.comboKey(missions.map(function (m) { return m.id; }));
      const car = GA.isCarUnlocked(d.car, d.points) ? d.car : 'tourer';
      const color = GA.isColorUnlocked(d.color, d.points) ? d.color : 'benibana';
      sim = new R13.Sim({ course: c.id, driver: name, car: car, color: color, missions: missions, pastSeg: REC.pastSegmentSnapshot(c.id),
        season: this.settings.season || 'autumn', ghost: this.ghostChoice[c.id] || null });
      sim.startStamp();
      REC.saveTrip(name, sim.serialize(), this.gen);
      REC.clearRec(name);
    }
    this._beginTrip(sim, name);
  };

  Game._beginTrip = function (sim, label) {
    this.sim = sim;
    this.audio.resetTown();
    this.audio.setRegion(sim.practice ? null : RT.regionAt(sim.st.s).id);
    this.courseId = sim.course.id;
    this.recSaveT = 0;
    this._sightReset();
    const car = GA.carById(sim.st.carId), col = GA.colorById(sim.st.colorId);
    this.renderer.setSeason(sim.st.season || 'autumn');
    this.renderer.resetWeather();          // 前の旅の雪・雨の表現を持ち越さない
    this.renderer.setPlayerCar(car, col.hex);
    // ghost
    this.ghostData = null;
    if (sim.st.ghost) {
      const g = REC.loadGhost(sim.course.id, sim.st.ghost);
      if (g) { this.ghostData = g; this.renderer.setGhost(g, GA.colorById(g.meta.color).hex, g.name); }
    }
    if (!this.ghostData) this.renderer.setGhost(null);
    this.renderer.camInit = false;
    this.renderer.warm(sim.st.s);
    $('h-driver').textContent = label;
    $('h-course').textContent = sim.course.name + '　' + RT.seasonById(sim.st.season).icon;
    $('h-ghost').style.display = this.ghostData ? '' : 'none';
    $('hud').classList.toggle('has-ghost', !!this.ghostData);
    $('h-tut').style.display = this.tut ? '' : 'none';
    this._applySteerMode();
    this.show('hud');
    this._startCountdown();
  };

  Game._startCountdown = function () {
    this.mode = 'countdown';
    this.count = { t: 0, last: -1 };
    this.tiltSamples = [];
    this.input.accel = this.input.brake = false;
    const sim = this.sim;
    $('c-course').textContent = sim.course.name + '　' + sim.course.label + '　' + RT.regionAt(sim.st.s).name + 'から';
    $('c-missions').innerHTML = sim.st.missions.map(function (m) {
      return '<div class="mchip"><b>' + J.MISSION_DEFS[m.id].icon + ' ' + esc(J.MISSION_DEFS[m.id].title) + (m.done ? ' ✓' : '') + '</b>' + esc(J.missionText(m)) + '</div>';
    }).join('');
    $('c-calib').textContent = this._usingTilt() ? '端末を持ちやすい角度で構えてください（中立を設定中）' : '';
    $('c-num').textContent = '3'; $('c-num').classList.remove('go');
    $('ov-count').classList.add('on');
    this.audio.unlock();
  };

  Game._usingTilt = function () { return this.settings.steer === 'tilt' && this._tiltAvailable(); };

  Game._countdownTick = function (dt) {
    const c = this.count;
    c.t += dt;
    if (this._usingTilt() && c.t <= 1.2 && tiltSrc.hasTilt()) this.tiltSamples.push(tiltSrc.getTilt());
    if (c.t > 1.2 && this.tiltSamples.length && !c.calibrated) {
      c.calibrated = true;
      const a = this.tiltSamples.slice().sort(function (x, y) { return x - y; });
      this.neutral = a[Math.floor(a.length / 2)];
      $('c-calib').textContent = 'ハンドルの中立を設定しました';
    }
    const n = 3 - Math.floor(c.t);
    if (n !== c.last) {
      c.last = n;
      if (n > 0) { $('c-num').textContent = String(n); this.audio.sfx('count', false); }
      else if (n === 0) {
        $('c-num').textContent = 'GO!'; $('c-num').classList.add('go'); this.audio.sfx('count', true);
        this.mode = 'drive';
        this.audio.engineStart();
        this.audio.playBgm();
        const self = this;
        setTimeout(function () { if (self.mode !== 'countdown') $('ov-count').classList.remove('on'); }, 600);
      }
    }
  };

  Game.pause = function (reason) {
    if (this.mode !== 'drive' && this.mode !== 'countdown') return;
    this.mode = 'paused';
    $('ov-count').classList.remove('on');
    this.audio.stopBgm(); this.audio.engineStop();
    this._saveTrip(true);
    const st = this.sim.st;
    $('p-info').innerHTML = '<p>' + esc(st.driver) + '　' + esc(this.sim.course.name) + '　' + esc(RT.regionAt(st.s).name) + '　' +
      ((st.s - this.sim.course.start) / 1000).toFixed(1) + ' km地点　' + fmtInt(st.score) + '点　経過 ' + RU.formatTime(st.time) + '</p>' +
      (reason === 'rotate' ? '<p class="hint">端末の向きが変わったため一時停止しました。再開時にハンドルの中立を設定し直します。</p>' : '');
    $('ov-pause').classList.add('on');
  };
  Game.resume = function () {
    $('ov-pause').classList.remove('on');
    this._startCountdown();
  };

  Game._saveTrip = function (withRec) {
    const s = this.sim;
    if (!s || s.st.finished || s.practice) { if (s) s.requestSave = false; return; }
    REC.saveTrip(s.st.driver, s.serialize(), this.gen);
    s.requestSave = false;
    if (withRec !== false && (withRec || this.recSaveT >= 20)) { REC.saveRec(s.st.driver, s.st.tripId, s.rec); this.recSaveT = 0; }
  };

  Game.toTitle = function () {
    this._saveTrip(true);
    this.sim = null;
    this.tut = null;
    this.ghostData = null;
    if (this.renderer) this.renderer.setGhost(null);
    this.exitPhoto(true);
    this.mode = 'menu';
    this.renderer.setSeason(this.settings.season || 'autumn');
    this.renderer.resetWeather();
    this._cardHide(true);
    ['ov-pause', 'ov-count', 'ov-result', 'ov-card', 'ov-event', 'ov-service', 'ov-police', 'ov-mission', 'ov-sight'].forEach(function (id) { $(id).classList.remove('on'); });
    this.renderer.clearChunks();
    this.renderer.warm(this.showcaseS);
    this.show('title');
  };

  // ================================================================ input
  Game._bindInput = function () {
    const self = this, inp = this.input;
    function hold(el, key) {
      const on = function (e) { e.preventDefault(); inp[key] = true; el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch (x) { } self.audio.unlock(); };
      const off = function (e) { inp[key] = false; el.classList.remove('on'); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('lostpointercapture', off);
    }
    hold($('pedal-accel'), 'accel');
    hold($('pedal-brake'), 'brake');
    hold($('steer-left'), 'left');
    hold($('steer-right'), 'right');
    G.addEventListener('keydown', function (e) {
      inp.keys[e.code] = true;
      if (e.code === 'KeyC') self.toggleView();
      if (e.code === 'KeyI' && self.mode === 'drive' && self._cardCur) self._openSight(self._cardCur.id);
      if (e.code === 'Escape') self.onBack();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0 && document.activeElement.tagName !== 'INPUT') e.preventDefault();
      self.audio.unlock();
    });
    G.addEventListener('keyup', function (e) { inp.keys[e.code] = false; });
    G.addEventListener('blur', function () { inp.keys = {}; });
    document.addEventListener('visibilitychange', function () { if (document.hidden) self.pause('hidden'); });
    let lastW = G.innerWidth, lastH = G.innerHeight;
    G.addEventListener('resize', function () {
      self.renderer.resize();
      const rotated = (G.innerWidth > G.innerHeight) !== (lastW > lastH);
      lastW = G.innerWidth; lastH = G.innerHeight;
      if (rotated) self.pause('rotate');
    });
    G.addEventListener('orientationchange', function () { self.pause('rotate'); });
  };

  Game._readInput = function (dt) {
    const k = this.input.keys, inp = this.input;
    const accel = inp.accel || k.ShiftLeft || k.ShiftRight || k.ArrowUp;
    const brake = inp.brake || k.Space || k.ArrowDown;
    let steer = 0;
    const kl = inp.left || k.ArrowLeft || k.KeyA, kr = inp.right || k.ArrowRight || k.KeyD;
    if (kl || kr) {
      const target = (kr ? 1 : 0) - (kl ? 1 : 0);
      this.steerKey += (target - this.steerKey) * Math.min(1, dt * 5);
      steer = this.steerKey;
    } else {
      this.steerKey *= Math.max(0, 1 - dt * 8);
      steer = this.steerKey;
      if (this._usingTilt() && tiltSrc.hasTilt()) {
        let a = tiltSrc.getTilt() - this.neutral;
        if (a > 180) a -= 360; if (a < -180) a += 360;
        const dz = 1.5;                       // 中立角から1.5度の遊び
        const m = Math.max(0, Math.abs(a) - dz) / 25 * this.settings.sens;
        steer = Math.sign(a) * Math.min(1, m);
        if (this.settings.invert) steer = -steer;
      }
    }
    return { accel: !!accel, brake: !!brake, steer: steer };
  };

  Game.toggleView = function () {
    if (!this.renderer) return;
    const v = this.renderer.camMode === 'chase' ? 'bonnet' : 'chase';
    this.renderer.camMode = v; REC.setSetting('view', v);
    this.renderer.camInit = false;
  };

  Game.vibrate = function (ms) {
    if (!this.settings.vibe) return;
    try { if (host && host.vibrate) host.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { }
  };

  Game.onBack = function () {
    if ($('ov-confirm').classList.contains('on')) { DC.close(); return true; }
    if ($('ov-card').classList.contains('on')) { $('ov-card').classList.remove('on'); return true; }
    if ($('ov-sight').classList.contains('on')) { this._closeSight(); return true; }
    if ($('ov-mission').classList.contains('on')) { this._closeMission(); return true; }
    if (this.mode === 'photo') { this.exitPhoto(); return true; }
    // 一時停止から開いた設定・楽曲紹介は、一時停止画面へ戻す（走行は再開しない）
    if (this.screen === 'settings' && this.prevScreen === 'pause') { this._backFromSettings(); return true; }
    if (this.screen === 'music') { this._backFromMusic(); return true; }
    if (this.mode === 'drive' || this.mode === 'countdown') { this.pause('back'); return true; }
    if (this.mode === 'paused') { this.resume(); return true; }
    if (this.mode === 'hold' || this.mode === 'result') return true;
    if (this.screen !== 'title') { this.show(this.screen === 'driver' ? (this.prevScreen === 'courses' ? 'courses' : 'title') : 'title'); return true; }
    return false;
  };

  // ================================================================ UI binding
  Game._bindUI = function () {
    const self = this;
    document.querySelectorAll('[data-nav]').forEach(function (b) {
      b.addEventListener('click', function () {
        self.audio.unlock(); self.audio.sfx('tap');
        const t = b.dataset.nav;
        if (t === 'back-driver') { self.show(self.prevScreen === 'courses' ? 'courses' : 'title'); return; }
        if (t === 'back-settings') { self._backFromSettings(); return; }
        if (t === 'back-music') { self._backFromMusic(); return; }
        if (t === 'music') self.prevScreen = self.screen === 'howto' ? 'howto' : 'title';
        if (t === 'garage' || t === 'settings') self.prevScreen = 'title';
        self.show(t);
      });
    });
    document.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { self.audio.unlock(); self.audio.sfx('tap'); self.courseId = b.dataset.go; self.prevScreen = 'title'; self.show('driver'); });
    });
    $('name-add').onclick = function () {
      const r = REC.addDriver($('name-input').value);
      if (!r.ok) { $('name-hint').textContent = r.error; self.audio.sfx('warn'); return; }
      $('name-input').value = '';
      self._setLastDriver(r.name);
      self._renderDriver();
      if (r.existing) $('name-hint').textContent = r.name + ' はすでに登録されています（大文字・小文字は同じ名前として扱います）。';
    };
    $('name-input').addEventListener('input', function () {
      const v = this.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 16);
      if (v !== this.value) this.value = v;
    });
    $('name-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('name-add').click(); });
    $('b-pause').onclick = function () { self.pause('button'); };
    $('b-view').onclick = function () { self.toggleView(); };
    $('b-mission').onclick = function () { self._openMission(); };
    $('m-close').onclick = function () { self._closeMission(); };
    $('h-card').onclick = function () { if (self._cardCur) self._openSight(self._cardCur.id); };
    $('p-resume').onclick = function () { self.resume(); };
    $('p-view').onclick = function () { self.toggleView(); };
    $('p-title').onclick = function () { self.toTitle(); };
    $('btn-tutorial').onclick = function () { self.audio.unlock(); self.audio.sfx('tap'); self.startTutorial(); };
    $('p-photo').onclick = function () { self.enterPhoto(); };
    $('ph-back').onclick = function () { self.exitPhoto(); };
    $('ph-shot').onclick = function () { self.takePhoto(); };
    $('ph-hud').onclick = function () { self.photoHud = !self.photoHud; this.textContent = '表示：' + (self.photoHud ? '現在地入り' : 'なし'); };
    $('ph-dist').oninput = function () { self.photoCam.dist = Number(this.value); };
    $('ph-pitch').oninput = function () { self.photoCam.pitch = Number(this.value) * Math.PI / 180; };
    $('ph-fov').oninput = function () { self.photoCam.fov = Number(this.value); };
    // drag to orbit the camera in photo mode
    const cv = $('gl');
    let drag = null;
    cv.addEventListener('pointerdown', function (e) { if (self.mode !== 'photo') return; drag = { x: e.clientX, y: e.clientY, yaw: self.photoCam.yaw, pitch: self.photoCam.pitch }; try { cv.setPointerCapture(e.pointerId); } catch (x) { } });
    cv.addEventListener('pointermove', function (e) {
      if (!drag || self.mode !== 'photo') return;
      self.photoCam.yaw = drag.yaw - (e.clientX - drag.x) * 0.008;
      self.photoCam.pitch = Math.max(-0.08, Math.min(1.3, drag.pitch + (e.clientY - drag.y) * 0.006));
      $('ph-pitch').value = Math.round(self.photoCam.pitch * 180 / Math.PI);
    });
    cv.addEventListener('pointerup', function () { drag = null; });
    cv.addEventListener('pointercancel', function () { drag = null; });
    cv.addEventListener('wheel', function (e) { if (self.mode !== 'photo') return; self.photoCam.dist = Math.max(3, Math.min(40, self.photoCam.dist * (e.deltaY > 0 ? 1.1 : 0.9))); $('ph-dist').value = self.photoCam.dist; }, { passive: true });
    $('p-settings').onclick = function () { $('ov-pause').classList.remove('on'); self.prevScreen = 'pause'; self.show('settings'); };
    $('p-music').onclick = function () { self.audio.sfx('tap'); $('ov-pause').classList.remove('on'); self.prevScreen = 'pause'; self.show('music'); };
    $('mu-playlist').onclick = function () { self._openLink(R13.music.PLAYLIST.url); };
    $('mu-channel').onclick = function () { self._openLink(R13.music.CHANNEL.url); };
    // 本文中の外部リンク（制作クレジットなど）は WebView 内で開かず、外部アプリで開く
    document.addEventListener('click', function (e) {
      const a = e.target && e.target.closest ? e.target.closest('a[data-ext]') : null;
      if (!a) return;
      e.preventDefault(); self._openLink(a.getAttribute('href'));
    });
  };
  Game._backFromSettings = function () {
    if (this.prevScreen === 'pause' && this.sim) {
      document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('on'); });
      $('hud').classList.add('on'); this.screen = 'hud';
      this.prevScreen = 'title';
      $('ov-pause').classList.add('on');
    } else this.show('title');
  };

  Game._openMission = function () {
    if (!this.sim) return;
    if (this.mode === 'drive') { this.mode = 'missionview'; this.audio.engineStop(); }
    const st = this.sim.st;
    $('m-list').innerHTML = st.missions.map(function (m) {
      let prog = '';
      if (m.id === 'careful' && !m.done) prog = '（現在 ' + fmtInt(st.comboDist) + ' m）';
      if (m.id === 'combo' && !m.done) prog = '（現在 ×' + J.comboMultiplier(st.comboDist).toFixed(1) + '）';
      return '<div class="mrow' + (m.done ? ' done' : '') + '"><div class="ck">' + (m.done ? '✓' : '') + '</div><div><b>' + J.MISSION_DEFS[m.id].icon + ' ' +
        esc(J.MISSION_DEFS[m.id].title) + '</b><small>' + esc(J.missionText(m)) + prog + '</small></div><div class="pts">+800</div></div>';
    }).join('');
    $('ov-mission').classList.add('on');
  };
  Game._closeMission = function () {
    $('ov-mission').classList.remove('on');
    if (this.mode === 'missionview') { this.mode = 'drive'; this.audio.engineStart(); }
  };

  // ================================================================ main loop
  Game._frame = function (ts) {
    const now = ts / 1000;
    let dt = this.last ? now - this.last : 0.016;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    const r = this.renderer;
    if (!r) return;
    const inTrip = this.sim && (this.screen === 'hud' || ((this.screen === 'settings' || this.screen === 'music') && this.prevScreen === 'pause'));
    if (!inTrip) { r.renderShowcase(dt, this.showcaseS); return; }
    const sim = this.sim;
    let input = { accel: false, brake: false, steer: 0 };
    if (this.mode === 'countdown') this._countdownTick(dt);
    if (this.mode === 'drive') {
      input = this._readInput(dt);
      input.assist = !!this.settings.assist;
      this.recSaveT += dt;
      this.acc += dt;
      let n = 0;
      while (this.acc >= DT && n < 8) {
        sim.step(input, DT);
        this.acc -= DT; n++;
        this._handleEvents();
        if (sim.hold) break;
      }
      if (sim.hold) { this.acc = 0; this._startHold(); }
      this._sights();
      this._cards(dt);
      if (sim.requestSave) this._saveTrip();
      const gi = gearInfo(sim.st.speed * 3.6);
      this.audio.engineUpdate(sim.st.speed, input.accel, gi, this.settings.scenery === 'rain' || (sim.weather && sim.weather.type === 'storm'));
      if (this.tut) this._tutorialTick();
    } else this.acc = 0;
    if (this.mode === 'hold') this._holdTick(dt);
    const self = this;
    r.render(sim, dt, {
      brake: input.brake || (this.mode !== 'drive'), shakeOn: this.settings.shake && this.mode !== 'photo',
      rough: sim.shoulder && sim.st.speed > 3, photo: this.mode === 'photo' ? this.photoCam : null,
      onThunder: function (delay) { setTimeout(function () { if (self.mode === 'drive') { self.audio.sfx('thunder'); self.vibrate(60); } }, delay * 1000); }
    });
    this._hud(dt, input);
  };

  function gearInfo(kmh) {
    const g = [0, 18, 36, 56, 80, 110, 145, 999];
    if (kmh < 1) return { gear: 'N', rpm: 0.05 };
    for (let i = 1; i < g.length; i++) if (kmh < g[i]) return { gear: String(i), rpm: 0.25 + 0.75 * (kmh - g[i - 1]) / (g[i] - g[i - 1]) };
    return { gear: '6', rpm: 1 };
  }

  // ================================================================ events
  Game._toast = function (text, cls, ms) {
    const box = $('h-toasts');
    while (box.children.length > 3) box.removeChild(box.firstChild);
    const d = document.createElement('div');
    d.className = 'toast ' + (cls || 'info');
    d.textContent = text;
    box.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, ms || 1700);
  };

  // 車窓の見どころ案内（沿線の実際の風景に合わせた目印を、通過時に短く表示）
  Game._sightReset = function () {
    this._cardReset();
    const s = this.sim ? this.sim.st.s : 0;
    let i = 0;
    while (i < RT.SIGHTS.length && RT.SIGHTS[i].s <= s) i++;
    this._sightIdx = i;
  };
  Game._sights = function () {
    const sim = this.sim;
    if (!sim || sim.practice) return;
    const L = RT.SIGHTS;
    while (this._sightIdx < L.length && L[this._sightIdx].s <= sim.st.s) {
      const g = L[this._sightIdx++];
      if (sim.st.s - g.s < 60 && RT.inCourse(sim.course, g.s)) this._toast('📍 ' + g.text, 'sight', 3500);
    }
  };

  // ---------------------------------------------------------------- 名所カード
  const SG = R13.sights;
  const CARD_SEC = 10;
  const CARD_FULL_SEC = 3.5;
  Game._cardReset = function () {
    const s = this.sim ? this.sim.st.s : 0;
    let i = 0;
    while (i < SG.CARDS.length && SG.CARDS[i].s <= s) i++;
    this._cardIdx = i;
    this._cardHide(true);
  };
  Game._cardHide = function (now) {
    const el = $('h-card');
    this._cardCur = null; this._cardT = 0;
    if (now || !el.classList.contains('on')) { el.classList.remove('on', 'out', 'mini'); return; }
    el.classList.add('out');
    setTimeout(function () { if (el.classList.contains('out')) el.classList.remove('on', 'out', 'mini'); }, 420);
  };
  Game._cardShow = function (c, isNew) {
    const el = $('h-card'), reg = RT.REGIONS.filter(function (r) { return r.id === c.region; })[0];
    el.innerHTML = '<img alt="" src="' + SG.dataUrl(c, 192, 132) + '"><span class="tx"><span class="tg">' + esc(reg.name + reg.muni) + 'の名所' + (isNew ? '<i>NEW</i>' : '') + '</span><b>' + esc(c.name) + '</b><small>' + esc(c.short) + '</small></span>' +
      '<span class="go">くわしく</span><span class="bar" style="animation-duration:' + CARD_SEC + 's"></span>';
    el.classList.remove('on', 'out', 'mini'); void el.offsetWidth; el.classList.add('on');
    if (this.settings.card === 'name') el.classList.add('mini');
    this._cardCur = c; this._cardT = CARD_SEC;
  };
  Game._cards = function (dt) {
    const sim = this.sim;
    if (!sim || sim.practice) return;
    const L = SG.CARDS, st = sim.st;
    while (this._cardIdx < L.length && L[this._cardIdx].s <= st.s) {
      const c = L[this._cardIdx++];
      if (st.s - c.s < 60 && RT.inCourse(sim.course, c.s)) {
        const isNew = REC.cardGet(c.id);
        st.cards = st.cards || { n: 0, fresh: 0 };
        st.cards.n++; if (isNew) st.cards.fresh++;
        this._cardShow(c, isNew);
        if (isNew) this.audio.sfx('tap');
      }
    }
    if (this._cardCur) {
      this._cardT -= dt;
      // 設定「最初だけイラスト」：3.5 秒たったら名前だけの小さな札にして、前方を見やすくする（タップで詳細を開けるのは同じ）
      if (this.settings.card === 'brief' && this._cardT <= CARD_SEC - CARD_FULL_SEC) { const el = $('h-card'); if (!el.classList.contains('mini')) el.classList.add('mini'); }
      if (this._cardT <= 0) this._cardHide();
    }
  };
  // 名所カードの詳細。走行中に開いたときは走行を止め（時間は進まない）、閉じるとそのまま走行にもどる。
  Game._openSight = function (id) {
    const c = SG.byId[id]; if (!c) return;
    const driving = this.mode === 'drive';
    if (driving) { this.mode = 'sightview'; this.audio.engineStop(); this.input.accel = this.input.brake = false; this._cardHide(true); }
    const reg = RT.REGIONS.filter(function (r) { return r.id === c.region; })[0];
    $('sight-box').innerHTML = '<div class="sight-wrap"><div class="sight-pic"><img alt="' + esc(c.name) + 'の絵" src="' + SG.dataUrl(c, 640, 400) + '"><span class="cap">' + esc(reg.name + reg.muni) + 'の名所</span></div>' +
      '<div class="sight-tx"><h2>' + esc(c.name) + '</h2><div class="lead">' + esc(c.short) + '</div><p>' + esc(c.body) + '</p>' +
      '<dl class="sight-info">' + c.info.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' +
      (SG.photos[c.id] ? '' : '<div class="sight-note">絵はイメージです。</div>') + '</div></div>' +
      '<div class="actions"><button class="btn primary" id="sight-close">' + (this.mode === 'sightview' ? '閉じて走行を続ける' : '閉じる') + '</button></div>';
    const self = this;
    $('sight-close').onclick = function () { self._closeSight(); };
    $('ov-sight').classList.add('on');
    this.audio.sfx('tap');
  };
  Game._closeSight = function () {
    $('ov-sight').classList.remove('on');
    if (this.mode === 'sightview') { this.mode = 'drive'; this.audio.engineStart(); }
  };

  Game._handleEvents = function () {
    const sim = this.sim, A = this.audio, self = this;
    sim.drainEvents().forEach(function (e) {
      switch (e.type) {
        case 'region': {
          const r = e.region;
          const b = $('h-banner');
          b.innerHTML = '<div class="banner-inner"><span class="welcome">ようこそ</span><span class="name">' + esc(r.name + r.muni) + '</span>' +
            '<span class="sub"><span class="en">' + esc(r.en) + '</span><span class="tagline">' + esc(r.tag || '') + '</span>' +
            (self.settings.bgm && A._useTown() ? '<span class="song">♪ 山形たびめぐり音楽帳｜' + esc(r.name + r.muni) + '</span>' : '') + '</span>' +
            (e.newStamp ? '<span class="stampmark">NEW<br>スタンプ</span>' : '') + '</div>';
          b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
          if (e.bonus) self._toast('+' + e.bonus + ' 新しいまち', 'plus');
          A.sfx('region');
          A.setRegion(r.id);                        // その市町村の歌へ
          break;
        }
        case 'segment': self._showSegment(e.result); A.sfx('segment'); break;
        case 'pass': self._toast('+' + e.pts + (e.kind === 'oncoming' ? ' 追い越し（対向車線）' : ' 追い越し'), 'plus'); A.sfx(e.kind === 'oncoming' ? 'pass2' : 'pass'); break;
        case 'violation': {
          if (e.kind === 'camera') { A.sfx('shutter'); self.vibrate(120); break; }
          const names = { hamidashi: 'はみ出し禁止違反', overtake: '追い越し禁止違反', signal: '信号無視' };
          let rest = '';
          if (!e.caught) {
            const every = e.kind === 'signal' ? RU.SIGNAL_EVERY : RU.REG_EVERY;
            rest = '　あと' + (every - (e.count % every)) + '回で取締り';
          }
          self._toast('⚠ ' + names[e.kind] + '（' + e.count + '回目）' + rest, 'minus');
          A.sfx('violation'); self.vibrate(160);
          break;
        }
        case 'police': A.sfx('siren'); self.vibrate(400); break;
        case 'collision':
          self._toast('💥 接触 耐久度 -' + e.damage, 'minus'); A.sfx('crash'); self.vibrate(320); self.renderer.bump(0.6); break;
        case 'shoulder': self._toast('路肩走行　耐久度が減少します', 'minus'); A.sfx('scrape'); self.vibrate(60); break;
        case 'comboReset': if (e.mult > 1) { self._toast('コンボ解除', 'minus'); A.sfx('comboLost'); } break;
        case 'combo': self._toast('✨ ドライブコンボ ×' + e.mult.toFixed(1), 'plus big'); A.sfx('combo'); break;
        case 'mission': self._toast('🎉 ミッション達成「' + J.MISSION_DEFS[e.mission.id].title + '」 +800', 'plus big'); A.sfx('mission'); self.vibrate(80); break;
        case 'signalBonus': self._toast('+' + e.pts + ' 信号待ちボーナス', 'plus'); A.sfx('signalBonus'); break;
        case 'serviceInfo': self._toast(e.text, 'info'); break;
        case 'horn': A.sfx('horn'); break;
        case 'cameraPass': if (e.ok) self._toast('📷 取締り地点を ' + Math.round(e.kmh) + ' km/h で通過　OK', 'info'); break;
        case 'tailgate': self._toast('⚠ 後続車が急接近！', 'minus'); break;
        case 'refuel': A.sfx('fuel'); break;
        case 'souvenir': A.sfx('pickup'); break;
        case 'wreck': A.sfx('crash'); self.vibrate(500); break;
        case 'gasout': A.sfx('warn'); break;
        case 'goal': A.sfx('goal'); break;
      }
    });
  };

  Game._showSegment = function (r) {
    const el = $('h-seg');
    const rankTxt = r.provisional ? '暫定1位' : r.rank + '位/' + (r.pastCount + 1);
    el.innerHTML = '<div class="segcard"><h4>区間確定　' + esc(r.name) + '</h4>' +
      '<div class="line"><span>タイム <b>' + RU.formatTime(r.time) + '</b>' + (r.stdOk ? ' ✓' : '') + '</span><b>+' + r.timeBonus + '</b></div>' +
      '<div class="line"><span>標準 ' + RU.formatTime(r.std) + '</span><span>' + rankTxt + '</span></div>' +
      '<div class="line"><span>燃費 ' + (isFinite(r.kmpl) ? r.kmpl.toFixed(1) : '--') + ' km/L</span><b>+' + r.fuelBonus + '</b></div>' +
      (this.ghostData && this.ghostData.seg[r.idx] != null ? (function (gd) {
        const df = r.time - gd.seg[r.idx];
        return '<div class="line"><span>👻 ' + esc(gd.name) + '</span><b class="' + (df <= 0 ? 'ahead' : 'behind') + '">' + (df <= 0 ? '−' : '+') + Math.abs(df).toFixed(2) + ' 秒</b></div>';
      })(this.ghostData) : '') +
      '<div class="line tot"><span>区間ボーナス</span><span>+' + r.totalBonus + '</span></div></div>';
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(this._segTO);
    this._segTO = setTimeout(function () { el.classList.remove('on'); }, 6500);
  };

  // ================================================================ holds (police / service / gasout / wreck / goal)
  Game._startHold = function () {
    const h = this.sim.hold;
    if (!h) return;
    this.mode = 'hold';
    this._cardHide(true);
    this.holdTimer = 0;
    this.input.accel = this.input.brake = false;
    const self = this;
    if (h.type === 'police') {
      $('pol-reason').textContent = h.reason;
      $('pol-pen').textContent = '-' + fmtInt(h.penalty) + ' 点';
      $('ov-police').classList.add('on');
    } else if (h.type === 'service') {
      const st = h.station;
      let html;
      // landscape-friendly: icon on the left, text on the right, button always visible at the bottom
      if (h.kind === 'eki') {
        const it = RT.ITEMS[h.item];
        html = '<div class="svc-row"><div class="bigico">' + it.icon + '</div><div class="svc-info"><div class="hint">' + esc(st.name) + '</div>' +
          '<div class="itemname">' + esc(it.name) + (h.newItem ? ' <span class="newbadge">図鑑に新登録！</span>' : '') + '</div>' +
          '<p class="note">' + esc(it.note) + '</p><div class="gain"><span>+800 点</span><span>耐久度 +' + Math.round(h.repaired) + '</span></div></div></div>';
      } else {
        html = '<div class="svc-row"><div class="bigico">⛽</div><div class="svc-info"><div class="hint">' + esc(st.name) + '</div><div class="itemname">満タン！</div>' +
          '<p class="note">' + h.added.toFixed(2) + ' L 給油しました（燃料 5.00 L）</p><div class="gain"><span>給油料金なし</span></div></div></div>';
      }
      if (h.kind === 'eki' && h.quiz) {
        html += '<div class="actions"><button class="btn primary" id="svc-quiz">🎓 ご当地クイズに挑戦<small>　正解で +' + R13.quiz.POINTS + ' 点</small></button><button class="btn" id="svc-ok">本線へ戻る</button></div>';
      } else {
        html += '<div class="actions"><button class="btn primary" id="svc-ok">本線へ戻る</button><span class="hint">約90 m先から停止状態で再出発します</span></div>';
      }
      $('svc-box').innerHTML = html;
      $('ov-service').classList.add('on');
      $('svc-ok').onclick = function () { self._endHold(); };
      if ($('svc-quiz')) $('svc-quiz').onclick = function () { self.audio.sfx('tap'); self._openQuiz(); };
    } else if (h.type === 'gasout') {
      $('ev-box').innerHTML = '<h2>⛽ ガス欠</h2><p>燃料がなくなりました。<b style="color:#b3261e">-2,000 点</b></p><p>救援車から <b>1 L</b> の応急給油を受けました。最寄りの給油所をめざしましょう。</p>' +
        '<div class="actions"><button class="btn primary" id="ev-ok">走行を続ける</button></div>';
      $('ov-event').classList.add('on');
      $('ev-ok').onclick = function () { self._endHold(); };
      this.audio.engineStop();
    } else if (h.type === 'wreck') {
      const r = RT.regionAt(h.checkpoint);
      $('ev-box').innerHTML = '<h2>🚧 区間終了</h2><p>車体の耐久度が0になりました。</p><p>直近の地域チェックポイント（<b>' + esc(r.name) + '</b>）から再開します。<b style="color:#b3261e">-500 点</b></p>' +
        '<p class="hint">耐久度100・停止状態で再開。燃料・経過時間・獲得品・違反回数は保持されます。</p><div class="actions"><button class="btn primary" id="ev-ok">チェックポイントから再開</button></div>';
      $('ov-event').classList.add('on');
      $('ev-ok').onclick = function () { self._endHold(); };
      this.audio.engineStop();
    } else if (h.type === 'goal') {
      this._goal();
    }
  };
  // ---------------------------------------------------------------- ご当地クイズ（道の駅）
  Game._openQuiz = function () {
    const sim = this.sim, h = sim && sim.hold, self = this;
    if (!h || h.type !== 'service' || !h.quiz || h.quizAnswered) return;
    const q = h.quizQ || (h.quizQ = R13.quiz.pick(h.station.id, REC.quizDone()));
    if (!q) { this._endHold(); return; }
    const long = q.choices.some(function (c) { return c.text.length > 11; });
    $('svc-box').innerHTML = '<div class="quiz"><div class="quiz-head">🎓 ご当地クイズ<span>' + esc(h.station.name) + '</span><b>正解で +' + R13.quiz.POINTS + ' 点</b></div>' +
      '<p class="quiz-q">' + esc(q.q) + '</p><div class="quiz-choices' + (long ? ' long' : '') + '">' +
      q.choices.map(function (c, i) { return '<button class="quiz-c" data-i="' + i + '">' + esc(c.text) + '</button>'; }).join('') + '</div>' +
      '<div id="quiz-res"></div></div><div class="actions" id="quiz-actions"><span class="hint">3つの中から選んでください（時間は止まっています）</span></div>';
    $('svc-box').querySelectorAll('.quiz-c').forEach(function (b) {
      b.onclick = function () { self._answerQuiz(q, Number(b.dataset.i)); };
    });
  };
  Game._answerQuiz = function (q, idx) {
    const sim = this.sim, self = this;
    const pickd = q.choices[idx];
    const res = sim.answerQuiz(q.id, !!pickd.ok);
    if (!res) return;
    $('svc-box').querySelectorAll('.quiz-c').forEach(function (b, i) {
      b.disabled = true;
      if (q.choices[i].ok) b.classList.add('ok');
      else if (i === idx) b.classList.add('ng');
      else b.classList.add('dim');
    });
    const right = q.choices.filter(function (c) { return c.ok; })[0].text;
    $('quiz-res').innerHTML = '<div class="quiz-res"><div class="mark ' + (res.correct ? 'ok' : 'ng') + '">' + (res.correct ? '◯' : '✕') + '</div><p>' +
      (res.correct ? '<b class="pts">正解！ +' + res.pts + ' 点</b>' + (res.isNew ? ' <span class="newbadge">図鑑に記録</span>' : '') : '<b>ざんねん。正解は「' + esc(right) + '」</b>') +
      '<br>' + esc(q.note) + '</p></div>';
    $('quiz-actions').innerHTML = '<button class="btn primary" id="svc-ok">本線へ戻る</button><span class="hint">約90 m先から停止状態で再出発します</span>';
    $('svc-ok').onclick = function () { self._endHold(); };
    this.audio.sfx(res.correct ? 'mission' : 'warn');
    if (res.correct) this.vibrate(60);
    this._saveTrip();
  };

  Game._holdTick = function (dt) {
    const h = this.sim && this.sim.hold;
    if (!h) return;
    this.holdTimer += dt;
    if (h.type === 'police' && this.holdTimer >= 3.0) this._endHold();   // 警察の取締り演出は約3秒
    if (h.type === 'service' && !h.quiz && this.holdTimer >= 4.5) this._endHold();   // クイズがあるときは自動で閉じない
  };
  Game._endHold = function () {
    if (!this.sim || !this.sim.hold) return;
    ['ov-police', 'ov-service', 'ov-event'].forEach(function (id) { $(id).classList.remove('on'); });
    const t = this.sim.hold.type;
    this.sim.resolveHold();
    this._saveTrip();
    this.mode = 'drive';
    this._sightReset();
    this.renderer.camInit = false;
    if (t === 'wreck' || t === 'gasout' || t === 'service') this.audio.engineStart();
  };

  Game._goal = function () {
    const sim = this.sim, st = sim.st, self = this;
    this.mode = 'result';
    this.audio.engineStop();
    if (sim.practice) { this._tutorialDone(); return; }
    const score = st.finalScore;
    const rank = REC.rankAgainstOthers(st.courseId, st.driver, score);
    const prev = (REC.getDriver(st.driver).courses[st.courseId] || {}).best;
    const res = REC.recordCompletion(st.driver, st.courseId, st.tripId, score, st.time, st.season) || { pointsBefore: 0, pointsAfter: 0 };
    REC.clearTrip(st.driver);
    // ゴースト：自分の最速完走なら保存
    let ghostSaved = false;
    if (!sim.rec.partial) {
      ghostSaved = REC.saveGhostIfBest(st.driver, st.courseId, sim.rec, { time: st.time, score: score, season: st.season, car: st.carId, color: st.colorId,
        seg: st.segResults.map(function (r) { return r.time; }) });
    }
    REC.clearRec(st.driver);
    const gd = this.ghostData;
    let ghostHtml = '';
    if (gd) {
      const total = st.time - gd.meta.time;
      ghostHtml = '<h3>👻 ゴースト ' + esc(gd.name) + ' との比較　<span class="' + (total <= 0 ? 'ahead' : 'behind') + '">' + (total <= 0 ? '−' : '+') + Math.abs(total).toFixed(2) + ' 秒</span></h3>' +
        '<table class="res-table ghost-table"><tr><td>区間</td><td>あなた</td><td>' + esc(gd.name) + '</td><td>差</td></tr>' +
        st.segResults.map(function (r, i) {
          const gt = gd.seg[i];
          const df = gt != null ? r.time - gt : null;
          return '<tr><td>' + esc(r.name) + '</td><td>' + RU.formatTime(r.time) + '</td><td>' + (gt != null ? RU.formatTime(gt) : '—') + '</td><td class="' + (df == null ? '' : (df <= 0 ? 'ahead' : 'behind')) + '">' +
            (df == null ? '—' : (df <= 0 ? '−' : '+') + Math.abs(df).toFixed(2)) + '</td></tr>';
        }).join('') + '</table>';
    }
    const unlocks = GA.unlockedBetween(res.pointsBefore, res.pointsAfter);
    const bd = st.bd;
    const rows = [
      ['走行距離（コンボ込み）', bd.distance], ['新しいまち', bd.region], ['追い越し', bd.pass], ['信号待ちボーナス', bd.signal],
      ['道の駅の特産品', bd.souvenir], ['ご当地クイズ', bd.quiz || 0], ['ミッション', bd.mission], ['区間タイム', bd.segment], ['区間燃費', bd.fuel],
      ['完走ボーナス', bd.complete], ['減点', -bd.penalty]
    ];
    let segRows = st.segResults.map(function (r) {
      return '<tr><td>' + esc(r.name) + '</td><td>' + RU.formatTime(r.time) + (r.stdOk ? ' ✓' : '') + '　' + (isFinite(r.kmpl) ? r.kmpl.toFixed(1) : '--') + ' km/L　+' + r.totalBonus + '</td></tr>';
    }).join('');
    const isBest = prev == null || score > prev;
    $('res-box').innerHTML = '<div class="res-head"><div><div class="hint">' + esc(sim.course.name) + '　' + esc(sim.course.label) + '　' + esc(st.driver) + '</div>' +
      '<h2>🏁 完走おめでとう！</h2></div><div style="text-align:right"><div class="res-score">' + fmtInt(score) + '<small style="font-size:16px"> 点</small></div>' +
      '<div class="res-rank">総合 ' + rank.rank + '位 / ' + rank.total + '人' + (isBest ? '　<span class="newbadge">自己ベスト</span>' : '') + '</div></div></div>' +
      '<div class="res-grid"><div><table class="res-table">' + rows.map(function (r) {
        return '<tr><td>' + r[0] + '</td><td class="' + (r[1] < 0 ? 'neg' : '') + '">' + (r[1] > 0 ? '+' : (r[1] < 0 ? '−' : '')) + fmtInt(Math.abs(Math.round(r[1]))) + '</td></tr>';
      }).join('') + '</table></div><div><table class="res-table"><tr><td>完走タイム</td><td>' + RU.formatTime(st.time) + '</td></tr>' +
      '<tr><td>ミッション</td><td>' + st.missions.filter(function (m) { return m.done; }).length + ' / ' + st.missions.length + '</td></tr>' +
      '<tr><td>最大コンボ</td><td>×' + st.maxMult.toFixed(1) + '</td></tr><tr><td>違反（規制／信号）</td><td>' + st.regCount + ' / ' + st.sigCount + '</td></tr>' +
      '<tr><td>接触</td><td>' + st.collisions + ' 回</td></tr>' + (st.quiz ? '<tr><td>ご当地クイズ</td><td>' + st.quiz.ok + ' / ' + st.quiz.n + ' 問正解</td></tr>' : '') +
      (st.cards ? '<tr><td>名所カード</td><td>' + st.cards.n + ' 枚' + (st.cards.fresh ? '（新しく ' + st.cards.fresh + ' 枚）' : '') + '</td></tr>' : '') + '<tr><td>おみやげ</td><td>' + st.items.map(function (i) { return RT.ITEMS[i].icon; }).join(' ') + '</td></tr>' +
      segRows + '</table></div></div>' +
      ghostHtml +
      (ghostSaved ? '<div class="unlock">👻 最速記録のゴーストを保存しました（' + RT.seasonById(st.season).icon + ' ' + RT.seasonById(st.season).name + '）</div>' : '') +
      '<div class="hint">解放ポイント ' + fmtInt(res.pointsBefore) + ' → <b>' + fmtInt(res.pointsAfter) + '</b></div>' +
      unlocks.map(function (u) { return '<div class="unlock">🎉 ' + esc(u) + ' が解放されました！</div>'; }).join('') +
      '<div class="row actions"><button class="btn gold" id="res-card">📤 結果カード</button><button class="btn" id="res-rec">🏆 記録を見る</button><button class="btn blue" id="res-again">🔁 もう一度</button><button class="btn primary" id="res-title">タイトルへ</button></div>';
    $('ov-result').classList.add('on');
    // 結果カード用のデータ（ゴール時の景色を1枚撮っておく）。撮影で処理が止まる間に紙吹雪が終わらないよう、撮ってから降らせる
    let shot = null;
    try { shot = this.renderer.capture(sim, { brake: true, shakeOn: false }); } catch (e) { shot = null; }
    this._confetti(isBest || prev == null ? 90 : 50);
    const now = new Date(), se = RT.seasonById(st.season);
    this._cardData = {
      shot: shot, courseName: sim.course.name, courseLabel: sim.course.label, driver: st.driver, score: score, time: st.time,
      seasonIcon: se.icon, seasonName: se.name, rank: rank.rank, rankTotal: rank.total, isBest: isBest && prev != null, first: prev == null,
      missions: st.missions.filter(function (m) { return m.done; }).length, missionsTotal: st.missions.length, maxMult: st.maxMult,
      passes: st.passes || 0, violations: st.regCount + st.sigCount, collisions: st.collisions,
      quiz: st.quiz ? { ok: st.quiz.ok, n: st.quiz.n } : null,
      items: st.items.map(function (i) { return RT.ITEMS[i].icon; }),
      regions: st.regions.map(function (id) { const r = RT.REGIONS.filter(function (x) { return x.id === id; })[0]; return r ? r.name : id; }),
      courseId: st.courseId,
      verify: (st.courseId === 'full' && R13.verify) ? R13.verify.make(score, now, st.time, st.driver) : null,
      date: now.getFullYear() + '.' + (now.getMonth() + 1) + '.' + now.getDate(), stamp: now, town: !!(this.settings.bgm && this.audio._useTown && this.audio._useTown())
    };
    this._cardUri = null; this._cardJpeg = null;
    $('res-card').onclick = function () { self.audio.sfx('tap'); self.openCard(); };
    const cid = st.courseId, dname = st.driver;
    $('res-title').onclick = function () { self.sim = null; self.toTitle(); };
    $('res-rec').onclick = function () { self.sim = null; self.toTitle(); self._recCourse = cid; self.show('records'); };
    $('res-again').onclick = function () { $('ov-result').classList.remove('on'); $('ov-card').classList.remove('on'); self.startTrip(dname, cid, null); };
    this.audio.stopBgm();
  };

  // 完走の紙吹雪（数秒で消える）
  Game._confetti = function (n) {
    const box = $('confetti'); if (!box) return;
    const cols = ['#d8322b', '#f2c230', '#2f7fd0', '#2f8a4a', '#e58ab6', '#ffffff', '#f08a24'];
    let html = '';
    for (let i = 0; i < n; i++) {
      const left = Math.random() * 100, dur = 2.2 + Math.random() * 2.2, delay = Math.random() * 1.2;
      html += '<i style="left:' + left.toFixed(1) + '%;background:' + cols[i % cols.length] + ';animation-duration:' + dur.toFixed(2) + 's;animation-delay:' + delay.toFixed(2) + 's;--dx:' + ((Math.random() - 0.5) * 160).toFixed(0) + 'px;--rot:' + (360 + Math.random() * 720).toFixed(0) + 'deg"></i>';
    }
    box.innerHTML = html; box.classList.add('on');
    clearTimeout(this._confT);
    this._confT = setTimeout(function () { box.classList.remove('on'); box.innerHTML = ''; }, 5800);
  };

  // ================================================================ 結果カード（画像にして保存・共有）
  const CARD_FONT = '"Noto Sans JP","Noto Sans CJK JP","Hiragino Sans","Yu Gothic","Meiryo",sans-serif';
  Game._drawCard = function (D, img) {
    const W = 1200, H = 1200, PH = 560;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const font = function (w, px) { g.font = w + ' ' + px + 'px ' + CARD_FONT; };
    const rr = function (x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    g.fillStyle = '#fbf6ea'; g.fillRect(0, 0, W, H);
    // ゴールの景色
    if (img) {
      const r = Math.max(W / img.width, PH / img.height), sw = W / r, sh = PH / r;
      g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, W, PH);
    } else {
      const sky = g.createLinearGradient(0, 0, 0, PH); sky.addColorStop(0, '#2f7fd0'); sky.addColorStop(1, '#d4e8f4'); g.fillStyle = sky; g.fillRect(0, 0, W, PH);
    }
    const shade = g.createLinearGradient(0, PH - 240, 0, PH); shade.addColorStop(0, 'rgba(14,26,38,0)'); shade.addColorStop(1, 'rgba(14,26,38,0.86)');
    g.fillStyle = shade; g.fillRect(0, PH - 240, W, 240);
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.fillStyle = '#ffffff'; font(900, 60); g.fillText('山形ドライブ R13', 48, PH - 78);
    g.fillStyle = '#ffe08a'; font(800, 32);
    let head = '🏁 ' + D.courseName + '　' + D.courseLabel + '　完走！';
    while (g.measureText(head).width > W - 96 && head.length > 8) head = head.slice(0, -2);
    g.fillText(head, 50, PH - 28);
    // 季節
    font(800, 30); const sl = D.seasonIcon + ' ' + D.seasonName, sw2 = g.measureText(sl).width + 44;
    g.fillStyle = 'rgba(14,26,38,0.6)'; rr(W - 40 - sw2, 34, sw2, 56, 28); g.fill();
    g.fillStyle = '#fff'; g.fillText(sl, W - 40 - sw2 + 22, 73);
    // 紹介ページの QR コード（左上。白い台紙に載せ、読み取りやすいよう周りに余白をとる）
    const QR = R13.QR_SITE;
    if (QR && QR.rows && QR.rows.length) {
      const qn = QR.rows.length, cell = Math.floor(150 / qn), qs = cell * qn, pad = cell * 3, bw = qs + pad * 2, bx = 36, by = 34;
      g.fillStyle = 'rgba(14,26,38,0.35)'; rr(bx + 3, by + 5, bw, bw + 40, 18); g.fill();
      g.fillStyle = '#ffffff'; rr(bx, by, bw, bw + 40, 18); g.fill();
      g.fillStyle = '#16324a';
      for (let yy = 0; yy < qn; yy++) for (let xx = 0; xx < qn; xx++) if (QR.rows[yy].charAt(xx) === '1') g.fillRect(bx + pad + xx * cell, by + pad + yy * cell, cell, cell);
      g.textAlign = 'center'; font(800, 17); g.fillText('ゲームの紹介・遊ぶ', bx + bw / 2, by + bw + 22);
      g.textAlign = 'left';
    }
    // 1.0.3：記録の確認用 QR コード（右上、季節の札の下）。全行程を完走したカードだけ。読み取ると確認ページが開き、得点・日付・タイム・名前が正しい組み合わせかを確かめられる
    if (D.verify && R13.verify && typeof qrcode === 'function') {
      try {
        const q = qrcode(0, 'M'); q.addData(R13.verify.url(D.verify)); q.make();
        const qn = q.getModuleCount(), cell = Math.max(3, Math.floor(190 / qn)), qs = cell * qn, pad = cell * 3, bw = qs + pad * 2, bx = W - 36 - bw, by = 112;
        g.fillStyle = 'rgba(14,26,38,0.35)'; rr(bx + 3, by + 5, bw, bw + 40, 18); g.fill();
        g.fillStyle = '#ffffff'; rr(bx, by, bw, bw + 40, 18); g.fill();
        g.fillStyle = '#111111';
        for (let yy = 0; yy < qn; yy++) for (let xx = 0; xx < qn; xx++) if (q.isDark(yy, xx)) g.fillRect(bx + pad + xx * cell, by + pad + yy * cell, cell, cell);
        g.fillStyle = '#16324a'; g.textAlign = 'center'; font(800, 17); g.fillText('✔ 記録の確認用', bx + bw / 2, by + bw + 22);
        g.textAlign = 'left';
      } catch (e) { }
    }
    // 得点
    g.fillStyle = '#8a8272'; font(800, 28); g.fillText('SCORE', 56, 632);
    g.fillStyle = '#b3261e'; font(900, 150);
    const sc = Math.floor(D.score).toLocaleString('ja-JP'); g.fillText(sc, 48, 772);
    const scw = g.measureText(sc).width; font(900, 50); g.fillText('点', 48 + scw + 12, 772);
    // 右：タイムと順位
    const RX = Math.max(760, 48 + scw + 110);
    g.fillStyle = '#8a8272'; font(800, 26); g.fillText('完走タイム', RX, 632);
    g.fillStyle = '#16324a'; font(900, 66); g.fillText(RU.formatTime(D.time), RX, 700);
    font(800, 32); g.fillText('総合 ' + D.rank + '位 / ' + D.rankTotal + '人', RX, 752);
    if (D.isBest || D.first) {
      const bt = D.isBest ? '自己ベスト更新！' : '初完走！'; font(900, 26);
      const bw = g.measureText(bt).width + 36; g.fillStyle = '#e2b44a'; rr(RX, 768, bw, 42, 21); g.fill();
      g.fillStyle = '#3a2a00'; g.fillText(bt, RX + 18, 798);
    }
    // 走ったまち
    const names = D.regions, n = names.length, x0 = 96, x1 = W - 96, y = 872;
    g.strokeStyle = '#16324a'; g.lineWidth = 6; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
    g.textAlign = 'center';
    names.forEach(function (nm, i) {
      const x = n > 1 ? x0 + (x1 - x0) * i / (n - 1) : (x0 + x1) / 2;
      g.fillStyle = i === 0 ? '#2f8a4a' : (i === n - 1 ? '#b3261e' : '#ffffff');
      g.beginPath(); g.arc(x, y, i === 0 || i === n - 1 ? 15 : 11, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#16324a'; g.lineWidth = 5; g.stroke();
      g.fillStyle = '#16324a'; font(800, n > 10 ? 24 : 28); g.fillText(nm, x, y + 50);
    });
    g.fillStyle = '#8a8272'; font(700, 22); g.textAlign = 'left'; g.fillText('走ったまち（国道13号）', x0 - 44, y - 32);
    // 記録のチップ
    const chips = ['🎯 ミッション ' + D.missions + '/' + D.missionsTotal, '✨ 最大コンボ ×' + D.maxMult.toFixed(1), '🚗 追い越し ' + D.passes + '回'];
    if (D.quiz) chips.push('🎓 クイズ ' + D.quiz.ok + '/' + D.quiz.n + ' 正解');
    chips.push('🚦 違反 ' + D.violations + '回', '💥 接触 ' + D.collisions + '回');
    if (D.items.length) chips.push('🎁 ' + D.items.join(' '));
    font(800, 27);
    let cx = 52, cy = 968;
    chips.forEach(function (t) {
      const w = g.measureText(t).width + 40;
      if (cx + w > W - 48) { cx = 52; cy += 64; }
      g.fillStyle = '#f0e7d2'; rr(cx, cy, w, 50, 25); g.fill();
      g.fillStyle = '#2a2a2a'; g.fillText(t, cx + 20, cy + 36);
      cx += w + 12;
    });
    // フッター
    g.strokeStyle = '#d9cfb8'; g.lineWidth = 2; g.beginPath(); g.moveTo(48, 1112); g.lineTo(W - 48, 1112); g.stroke();
    g.fillStyle = '#6b6558'; font(700, 26); g.fillText('DRIVER ' + D.driver + '　' + D.date, 52, 1152);
    g.textAlign = 'right'; g.fillStyle = '#16324a'; font(800, 26); g.fillText('#山形ドライブR13　#国道13号　#山形県', W - 52, 1152);
    if (D.town) { g.fillStyle = '#8a8272'; font(600, 20); g.fillText('♪ 走行中のBGM：山形たびめぐり音楽帳（制作・発信：山形イベログ）', W - 52, 1184); }
    g.textAlign = 'left';
    return c.toDataURL('image/jpeg', 0.9);
  };
  Game._cardText = function (D) {
    return '山形ドライブ R13「' + D.courseName + '（' + D.courseLabel + '）」を完走！ ' + Math.floor(D.score).toLocaleString('ja-JP') + '点　タイム ' + RU.formatTime(D.time) +
      ' #山形ドライブR13 #国道13号 #山形県 ' + ((R13.QR_SITE && R13.QR_SITE.url) || 'https://ymgtevelog.github.io/yamagata_r13/');
  };
  Game.openCard = function () {
    const D = this._cardData, self = this;
    if (!D) return;
    const show = function () {
      $('card-box').innerHTML = '<h2>📤 結果カード</h2><div class="card-wrap"><img class="card-preview" id="card-img" alt="結果カード" src="' + self._cardJpeg + '">' +
        '<div><p class="hint" id="card-msg">得点・タイム・走ったまち・ゴールの景色を1枚にまとめました。保存して、SNSや家族へ共有できます。</p></div></div>' +
        '<div class="row actions"><button class="btn blue" id="card-share">共有する</button><button class="btn" id="card-save">画像を保存</button><button class="btn primary" id="card-close">閉じる</button></div>';
      $('ov-card').classList.add('on');
      $('card-close').onclick = function () { $('ov-card').classList.remove('on'); };
      $('card-save').onclick = function () { self.audio.sfx('tap'); self._saveCard(false); };
      $('card-share').onclick = function () { self.audio.sfx('tap'); self._saveCard(true); };
    };
    if (this._cardJpeg) { show(); return; }
    const done = function (img) { try { self._cardJpeg = self._drawCard(D, img); } catch (e) { self._cardJpeg = self._drawCard(D, null); } show(); };
    if (D.shot) { const img = new Image(); img.onload = function () { done(img); }; img.onerror = function () { done(null); }; img.src = D.shot; }
    else done(null);
  };
  Game._cardName = function () {
    const d = this._cardData.stamp, p = function (n) { return ('0' + n).slice(-2); };
    return 'R13_card_' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '.jpg';
  };
  Game._saveCard = function (share) {
    const D = this._cardData, jpeg = this._cardJpeg, msg = $('card-msg'), self = this;
    if (!D || !jpeg) return;
    const name = this._cardName(), text = this._cardText(D);
    if (host && host.savePhoto) {
      if (!this._cardUri) { try { this._cardUri = host.savePhoto(jpeg.split(',')[1], name) || ''; } catch (e) { this._cardUri = ''; } }
      const uri = this._cardUri;
      if (!uri) { msg.textContent = '保存できませんでした。端末の空き容量を確認してください。'; this._cardUri = null; return; }
      if (!share) { msg.textContent = 'ピクチャ／YamagataDriveR13 に保存しました。'; return; }
      if (uri.indexOf('content://') !== 0) { msg.textContent = '画像を保存しました。この端末では共有画面を開けないため、ギャラリーなどから共有してください。'; return; }
      try { if (host.shareImage) host.shareImage(uri, text, '結果カードを共有'); else host.sharePhoto(uri); msg.textContent = 'ピクチャ／YamagataDriveR13 に保存し、共有画面を開きました。'; }
      catch (e) { msg.textContent = '画像は保存しました。共有画面を開けませんでした。'; }
      return;
    }
    // ブラウザ（PC）：共有に対応していれば共有、なければダウンロード
    const download = function () { const a = document.createElement('a'); a.href = jpeg; a.download = name; document.body.appendChild(a); a.click(); a.remove(); msg.textContent = '画像をダウンロードしました。'; };
    if (share && navigator.share && navigator.canShare && G.fetch) {
      G.fetch(jpeg).then(function (r) { return r.blob(); }).then(function (b) {
        const f = new File([b], name, { type: 'image/jpeg' });
        if (navigator.canShare({ files: [f] })) return navigator.share({ files: [f], text: text });
        download();
      }).catch(function () { download(); });
    } else download();
  };

  // ================================================================ tutorial（はじめてのドライブ）
  const TUT_STEPS = [
    { t: 'ハンドル', d: '端末を左右に傾けて（タッチ操作は ◀ ▶）車線の中を走ろう', done: function (sim, T) { return sim.st.s - T.s0 > 150; } },
    { t: 'アクセル', d: '右下の ACCEL を押し続けて 70 km/h まで加速。離すと 60 km/h の巡行に戻ります', done: function (sim) { return sim.st.speed * 3.6 >= 69; } },
    { t: 'ブレーキ', d: '左下の BRAKE で減速。押し続けると止まります。一度止まってみよう', done: function (sim) { return sim.st.speed < 0.5; } },
    { t: '信号', d: '900 m 付近の信号。赤なら停止線の手前で止まり、青で出発（信号待ちボーナス +100）', done: function (sim) { return sim.st.s > 930; } },
    { t: '中央線', d: '黄色の実線は はみ出し禁止。白の破線では対向車に注意して追い越しできます', done: function (sim) { return sim.st.s > 1750; } },
    { t: '車線減少', d: '黄色の案内「車線減少」が出たら、早めに右の車線へ合流しよう', done: function (sim) { return sim.st.s > 2290; } },
    { t: '道の駅', d: '左の緑の枠に入り、ほぼ止まったまま約1秒で特産品（米沢牛）をもらえます', done: function (sim) { return !!sim.st.stationsUsed['eki-yonezawa'] || sim.st.s > 2560; } },
    { t: 'ゴール', d: '3.2 km の信号を越えて 3.6 km でゴール。全行程の前の練習はここまで！', done: function () { return false; } }
  ];
  Game.startTutorial = function () {
    const S = this.settings;
    const sim = new R13.Sim({ course: 'tutorial', driver: this.driver || 'GUEST', car: 'tourer', color: 'benibana', missions: [], pastSeg: {}, season: S.season || 'autumn' });
    this.tut = { step: 0, s0: sim.st.s };
    this.gen = REC.getData().eraseGen || 0;
    this._beginTrip(sim, '練習');
    this._renderTut();
  };
  Game._renderTut = function () {
    const T = this.tut; if (!T) return;
    const st = TUT_STEPS[T.step];
    $('h-tut').innerHTML = '<span class="step">🔰 STEP ' + (T.step + 1) + '/' + TUT_STEPS.length + '　' + esc(st.t) + '</span><span class="desc">' + esc(st.d) + '</span>' +
      (T.step === 0 ? '<span class="tip">設定の「操舵アシスト」「速度注意表示」をONにすると運転を補助します</span>' : '');
  };
  Game._tutorialTick = function () {
    const T = this.tut, sim = this.sim;
    if (!T || !sim) return;
    const st = TUT_STEPS[T.step];
    if (T.step < TUT_STEPS.length - 1 && st.done(sim, T)) {
      T.step++;
      this.audio.sfx('step');
      this._renderTut();
    }
  };
  Game._tutorialDone = function () {
    const self = this;
    REC.setSetting('tutorialDone', true);
    $('res-box').innerHTML = '<h2>🔰 チュートリアル完了！</h2><p>ハンドル・ペダル・信号・中央線・車線減少・道の駅の使い方を練習しました。練習走行は記録・解放ポイント・図鑑には反映しません。</p>' +
      '<p class="hint">次は区間チャレンジ（5～10分）や全行程に挑戦しよう。夏は雷雨、冬は降雪で滑りやすい区間があります。</p>' +
      '<div class="row actions"><button class="btn" id="tut-again">🔁 もう一度練習</button><button class="btn blue" id="tut-course">⏱ 区間チャレンジへ</button><button class="btn primary" id="tut-title">タイトルへ</button></div>';
    $('ov-result').classList.add('on');
    this.audio.stopBgm();
    $('tut-title').onclick = function () { self.sim = null; self.toTitle(); };
    $('tut-again').onclick = function () { $('ov-result').classList.remove('on'); self.startTutorial(); };
    $('tut-course').onclick = function () { self.sim = null; self.toTitle(); self.show('courses'); };
  };

  // ================================================================ photo mode（写真モード）
  Game.enterPhoto = function () {
    if (!this.sim || this.mode !== 'paused') return;
    this.mode = 'photo';
    $('ov-pause').classList.remove('on');
    $('hud').classList.add('photo');
    $('photo-ui').classList.add('on');
    $('ph-dist').value = this.photoCam.dist; $('ph-pitch').value = Math.round(this.photoCam.pitch * 180 / Math.PI); $('ph-fov').value = this.photoCam.fov;
  };
  Game.exitPhoto = function (silent) {
    $('photo-ui').classList.remove('on');
    $('hud').classList.remove('photo');
    if (this.mode === 'photo') {
      this.mode = 'paused';
      this.renderer.camInit = false;
      if (!silent) $('ov-pause').classList.add('on');
    }
  };
  Game.takePhoto = function () {
    const sim = this.sim; if (!sim) return;
    const self = this;
    this.audio.sfx('shutterPhoto');
    const url = this.renderer.capture(sim, { photo: this.photoCam, shakeOn: false });
    const img = new Image();
    img.onload = function () {
      // watermark: game name, place, season, date
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const k = c.height / 400;
      const d = new Date();
      const region = RT.regionAt(sim.st.s);
      const line1 = '山形ドライブ R13', line2 = (self.photoHud ? region.name + region.muni + '付近　' : '') + RT.seasonById(sim.st.season).name + '　' + d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate();
      g.font = '800 ' + Math.round(15 * k) + 'px "Noto Sans JP", sans-serif';
      const w1 = g.measureText(line1).width;
      g.font = '600 ' + Math.round(11 * k) + 'px "Noto Sans JP", sans-serif';
      const w2 = g.measureText(line2).width;
      const bw = Math.max(w1, w2) + 22 * k, bh = 44 * k, bx = c.width - bw - 12 * k, by = c.height - bh - 12 * k;
      g.fillStyle = 'rgba(14,26,38,0.55)'; g.fillRect(bx, by, bw, bh);
      g.fillStyle = '#ffffff'; g.textBaseline = 'top';
      g.font = '800 ' + Math.round(15 * k) + 'px "Noto Sans JP", sans-serif'; g.fillText(line1, bx + 11 * k, by + 6 * k);
      g.fillStyle = '#e2b44a'; g.font = '600 ' + Math.round(11 * k) + 'px "Noto Sans JP", sans-serif'; g.fillText(line2, bx + 11 * k, by + 26 * k);
      const jpeg = c.toDataURL('image/jpeg', 0.9);
      const name = 'R13_' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '_' + ('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2) + ('0' + d.getSeconds()).slice(-2) + '.jpg';
      self._savePhoto(jpeg, name);
    };
    img.src = url;
  };
  Game._savePhoto = function (jpeg, name) {
    const self = this;
    let uri = '';
    if (host && host.savePhoto) {
      try { uri = host.savePhoto(jpeg.split(',')[1], name) || ''; } catch (e) { uri = ''; }
    } else {
      const a = document.createElement('a'); a.href = jpeg; a.download = name; document.body.appendChild(a); a.click(); a.remove(); uri = 'download';
    }
    const ok = !!uri;
    const canShare = ok && host && host.sharePhoto && uri.indexOf('content://') === 0;
    $('ev-box').innerHTML = '<h2>' + (ok ? '📷 写真を保存しました' : '保存できませんでした') + '</h2>' +
      '<img class="photo-preview" src="' + jpeg + '" alt="撮影した写真">' +
      '<p class="hint">' + (ok ? (host && host.savePhoto ? 'ピクチャ／YamagataDriveR13 に保存しました。' : '画像をダウンロードしました。') : '端末の空き容量を確認してください。') + '</p>' +
      '<div class="row actions">' + (canShare ? '<button class="btn blue" id="ph-share">共有する</button>' : '') + '<button class="btn primary" id="ph-ok">撮影を続ける</button></div>';
    $('ov-event').classList.add('on');
    $('ph-ok').onclick = function () { $('ov-event').classList.remove('on'); };
    if (canShare) $('ph-share').onclick = function () { try { host.sharePhoto(uri); } catch (e) { } };
  };

  // ================================================================ HUD
  Game._hud = function (dt, input) {
    const sim = this.sim; if (!sim) return;
    const st = sim.st;
    const kmh = st.speed * 3.6;
    $('h-speed').textContent = Math.round(kmh);
    const sp = $('h-steer'); sp.style.left = (50 + (sim.steer || 0) * 45) + '%';
    this.hudT += dt;
    if (this.hudT < 0.1) return;
    this.hudT = 0;
    const info = sim.info();
    $('h-region').textContent = info.region.name;
    $('h-next').textContent = '次：' + info.nextName + '　' + fmtKm(info.nextDist);
    $('h-remain').textContent = '残り ' + fmtKm(info.remain);
    $('h-prog').style.width = (info.progress * 100).toFixed(1) + '%';
    $('h-prog-car').style.left = (info.progress * 100).toFixed(1) + '%';
    $('h-segtime').textContent = '区間 ' + RU.formatTime(info.segTime) + ' / 標準 ' + RU.formatTime(info.segStd);
    $('h-score').textContent = fmtInt(st.score);
    const cm = $('h-combo'); cm.textContent = '×' + info.mult.toFixed(1); cm.classList.toggle('hot', info.mult > 1);
    $('h-mis').textContent = '✓' + info.missionsDone + '/' + st.missions.length;
    $('h-gear').textContent = gearInfo(kmh).gear;
    const dur = $('h-dur'); dur.style.width = st.dur + '%'; dur.className = st.dur < 35 ? 'crit' : (st.dur < 65 ? 'warn' : '');
    $('h-dur-t').textContent = Math.round(st.dur);
    const fu = $('h-fuel'); fu.style.width = (st.fuel / R13.sim.TANK * 100) + '%'; fu.className = st.fuel < 1 ? 'crit' : (st.fuel < 2 ? 'warn' : '');
    $('h-fuel-t').textContent = st.fuel.toFixed(2) + ' L';
    $('h-kmpl').textContent = (info.segKmpl != null ? info.segKmpl.toFixed(1) : '--') + ' km/L';

    // alerts — each alert keeps its own element (keyed by id) and only its text is updated,
    // so distances count down smoothly instead of the whole list being rebuilt (which looked like flashing).
    const al = [];
    const dist = function (d) {
      const step = d >= 100 ? 10 : 5;
      return '<span class="dist">' + Math.max(0, Math.round(d / step) * step) + ' m</span>';
    };
    if (info.signal && info.signal.d < 260) {
      const s = info.signal.state;
      al.push(['signal', '', '<span class="sig"><i class="' + (s === 0 ? 'g' : '') + '"></i><i class="' + (s === 1 ? 'y' : '') + '"></i><i class="' + (s === 2 ? 'r' : '') + '"></i></span>信号 ' + dist(info.signal.d)]);
    }
    if (info.laneReduce) {
      const myLane = Math.round(-st.x / RT.LANE_W - 0.5);
      const mine = myLane >= info.laneReduce.to;
      al.push(['lane', mine ? 'red' : 'yel', '⚠ 車線減少 ' + dist(info.laneReduce.d) + (mine ? ' 右へ合流' : '')]);
    }
    if (info.yellow) al.push(['yellow', 'yel', '🚫 ' + (info.lanes === 1 ? '追い越し禁止' : 'はみ出し禁止')]);
    else if (info.yellowAhead) al.push(['yellow', 'yel', 'まもなく はみ出し禁止']);
    if (info.camera && !info.camera.done) al.push(['camera', 'blue', '📷 速度取締 ' + dist(info.camera.d)]);
    if (info.service) {
      const sv = info.service, s2 = sv.st;
      const txt = s2.type === 'eki' ? (sv.used ? '道の駅（済）' : '🎁 道の駅 ' + RT.ITEMS[s2.item].name)
        : '⛽ 給油所' + (st.fuel >= 4.85 ? '（満タン）' : '');
      al.push(['service', 'green', txt + ' ' + (sv.d > 0 ? dist(sv.d) : 'ここ') + ' 左枠']);
    }
    if (info.offRoad) al.push(['offroad', 'red', '路肩走行中']);
    // 坂道（下り坂は速度が出やすく、ブレーキが利きにくい）
    const gr = RT.gradeAt(st.s), grA = RT.gradeAt(st.s + 120);
    if (Math.min(gr, grA) < -0.022) al.push(['slope', 'blue', '⬇ 下り坂 ' + Math.round(-Math.min(gr, grA) * 100) + '%　速度注意']);
    else if (Math.max(gr, grA) > 0.025) al.push(['slope', '', '⬆ 上り坂 ' + Math.round(Math.max(gr, grA) * 100) + '%']);
    // 天候区間（夏の雷雨・冬の降雪）
    const wz = RT.WEATHER_ZONES[st.season];
    if (sim.weather && sim.weather.w > 0.25) al.push(['weather', sim.weather.type === 'snow' ? 'snow' : 'storm', (sim.weather.type === 'snow' ? '❄ 降雪 スリップ注意' : '⚡ 雷雨 スリップ注意')]);
    else if (wz && wz.start - st.s > 0 && wz.start - st.s < 600 && RT.inCourse(sim.course, wz.start)) al.push(['weather', wz.type === 'snow' ? 'snow' : 'storm', 'まもなく' + wz.name + '区間 ' + dist(wz.start - st.s)]);
    if (st.fuel < 1.2) {
      let nf = null;
      for (const s2 of RT.STATIONS) if (s2.type === 'fuel' && s2.s > st.s && RT.inCourse(sim.course, s2.s)) { nf = s2; break; }
      al.push(['fuel', 'red', '⛽ 燃料わずか' + (nf ? ' 給油所 ' + fmtKm(nf.s - st.s) : '')]);
    }
    if (st.dur < 35) al.push(['dur', 'red', '🔧 耐久度低下']);
    // 運転の妨げにならないよう、優先度の高い3件だけを表示（並び順は優先度順で固定）
    const PRIO = { offroad: 0, weather: 1, lane: 2, signal: 3, camera: 4, slope: 5, fuel: 6, dur: 7, service: 8, yellow: 9 };
    al.sort(function (a, b) { return PRIO[a[0]] - PRIO[b[0]]; });
    this._renderAlerts(al.slice(0, 3));
    this._hudGhost(sim);
    this._hudAdvice(sim, info);
  };

  // ゴーストとの差（同じ地点を通過した時刻の差）
  Game._hudGhost = function (sim) {
    const g = this.ghostData, el = $('h-ghost');
    if (!g) return;
    const gp = R13.ghost.gap(g, sim.st.s, sim.st.time);
    const pos = R13.ghost.posAt(g, sim.st.time);
    let html;
    if (gp == null) html = '👻 ' + esc(g.name) + '　<b class="ahead">ゴール済み</b>';
    else {
      const ahead = gp <= 0;
      const dm = pos ? Math.round(pos.s - sim.st.s) : 0;
      html = '👻 ' + esc(g.name) + '　<b class="' + (ahead ? 'ahead' : 'behind') + '">' + (ahead ? '−' : '+') + Math.abs(gp).toFixed(1) + ' 秒</b>' +
        '<small>' + (pos && !pos.done ? (dm >= 0 ? '前 ' + dm + ' m' : '後ろ ' + (-dm) + ' m') : '') + '</small>';
    }
    if (el._html !== html) { el.innerHTML = html; el._html = html; }
  };

  // 速度注意（初心者向けの補助）：制限60 km/h、取締り地点、赤信号、天候区間の推奨速度
  Game._hudAdvice = function (sim, info) {
    const el = $('h-advice');
    if (!this.settings.speedWarn) { if (el._html !== '') { el.innerHTML = ''; el._html = ''; } return; }
    const st = sim.st, kmh = st.speed * 3.6;
    let msg = '', cls = '';
    const wz = sim.weather && sim.weather.w > 0.25 ? sim.weather.zone : null;
    if (info.signal && info.signal.state !== 0 && info.signal.d < 130 && kmh > 35) { msg = '🚦 信号 減速！'; cls = 'warn'; }
    else if (wz && kmh > wz.advise) { msg = (wz.type === 'snow' ? '❄ 推奨 ' : '⚡ 推奨 ') + wz.advise + ' km/h'; cls = 'warn'; }
    else if (info.camera && !info.camera.done && kmh > 60) { msg = '📷 60 km/h以下に'; cls = 'warn'; }
    else if (RT.gradeAt(st.s) < -0.022 && kmh > 62) { msg = '⬇ 下り坂 早めに減速'; cls = 'warn'; }
    else if (kmh > 63) { msg = '速度超過'; cls = 'warn'; }
    const html = '<span class="limit">60</span>' + (msg ? '<span class="' + cls + '">' + esc(msg) + '</span>' : '<span class="ok">OK</span>');
    if (el._html !== html) { el.innerHTML = html; el._html = html; }
  };

  Game._renderAlerts = function (al) {
    const box = $('h-alerts');
    const els = this._alertEls || (this._alertEls = {});
    const keep = {};
    let prev = null;
    al.forEach(function (a) {
      const id = a[0], cls = 'alert ' + a[1];
      keep[id] = true;
      let el = els[id];
      if (!el) {
        el = document.createElement('div');
        el.className = cls + ' new';
        el.innerHTML = a[2];
        el._html = a[2];
        el._cls = cls;
        els[id] = el;
        setTimeout(function () { el.classList.remove('new'); }, 300);
      } else {
        if (el._cls !== cls) { el.className = cls; el._cls = cls; }
        if (el._html !== a[2]) { el.innerHTML = a[2]; el._html = a[2]; }
      }
      // keep order without detaching existing elements unnecessarily
      const want = prev ? prev.nextSibling : box.firstChild;
      if (want !== el) box.insertBefore(el, want);
      prev = el;
    });
    Object.keys(els).forEach(function (id) {
      if (!keep[id]) { if (els[id].parentNode) els[id].parentNode.removeChild(els[id]); delete els[id]; }
    });
  };

  // ================================================================ host hooks
  G.R13Host = {
    onHostPause: function (reason) { Game.pause(reason === 'rotate' ? 'rotate' : 'hidden'); },
    onBack: function () { return Game.onBack(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { Game.init(); });
  else Game.init();
})(window);
