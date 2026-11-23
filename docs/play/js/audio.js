/* audio.js — BGM（指定音源があれば優先・なければ合成BGM）、エンジン・風・接触音・獲得音・サイレン（合成音） */
(function (G) {
  'use strict';
  const R13 = G.R13 = G.R13 || {};

  function Audio() {
    this.ctx = null;
    this.bgmOn = true; this.seOn = true;
    this.bgmPlaying = false;
    this.fileBgm = null; this.fileOk = false; this.fileChecked = false;
    this.synth = null;
    this.engine = null;
    // 市町村ソング（0.6.3.2）：地域に入るとその市町村の歌へクロスフェード
    this.bgmMode = 'town';          // 'town' = 市町村ソング, 'classic' = んだんだ！やまがた
    this.townId = null;             // region whose song should play
    this.townEl = null;             // currently playing <audio>
    this.fadeTimer = null;
    this.townOk = null;             // Opus support
  }
  const TOWN_VOL = 0.62;
  const FILE_VOL = 0.55;
  // iOS の Safari は <audio> の音量を変えられないため、Web Audio の音量つまみ（GainNode）を通す
  const UA = (G.navigator && navigator.userAgent) || '';
  const IOS = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && ((G.navigator && navigator.maxTouchPoints) || 0) > 1);
  // 0.1 秒の無音（iOS で最初のタップのときに再生しておくと、その後は自由に再生できる）
  const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

  // 市町村ソングの形式：Opus（.ogg）が使えなければ AAC（.m4a、ブラウザ版のみ同梱）
  Audio.prototype.townFormat = function () {
    if (this.townOk == null) {
      this.townOk = false;
      try {
        const a = document.createElement('audio');
        if (a.canPlayType && a.canPlayType('audio/ogg; codecs=opus') !== '') this.townOk = 'ogg';
        else if (a.canPlayType && G.R13 && G.R13.web && a.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== '') this.townOk = 'm4a';
      } catch (e) { this.townOk = false; }
    }
    return this.townOk;
  };
  Audio.prototype.townSupported = function () { return !!this.townFormat(); };
  Audio.prototype.townUrl = function (id) { return 'audio/towns/' + id + '.' + this.townFormat(); };
  Audio.prototype._useTown = function () { return this.bgmMode === 'town' && this.townId && this.townSupported(); };

  // 再生用の <audio> を 2 つ用意して交互に使う（クロスフェード用）。最初のタップのときに作る。
  Audio.prototype._mkEl = function () {
    const el = new G.Audio();
    el.loop = true; el.preload = 'auto';
    try { el.setAttribute('playsinline', ''); } catch (e) { }
    if (IOS && this.ctx) {
      try {
        const src = this.ctx.createMediaElementSource(el), g = this.ctx.createGain();
        g.gain.value = 0; src.connect(g); g.connect(this.master); el._gain = g;
      } catch (e) { el._gain = null; }
    }
    return el;
  };
  function setVol(el, v) {
    if (!el) return;
    if (el._gain) el._gain.gain.value = v; else el.volume = v;
  }
  function getVol(el) { return el ? (el._gain ? el._gain.gain.value : el.volume) : 0; }
  Audio.prototype._slots = function () {
    if (!this.slotEls) this.slotEls = [this._mkEl(), this._mkEl()];
    return this.slotEls;
  };
  // 利用者の操作の中で呼ぶ：iOS で後から再生できるように、無音を一度再生しておく
  Audio.prototype._prime = function () {
    if (this.primed) return;
    this.primed = true;
    const self = this;
    this._slots().forEach(function (el) {
      if (el.src) return;
      setVol(el, 0); el.src = SILENT;
      try { const p = el.play(); if (p && p.then) p.then(function () { if (!el._id) el.pause(); }, function () { self.primed = false; }); } catch (e) { }
    });
  };
  // 地域が変わったとき（出発・再開時も）に呼ぶ
  Audio.prototype.setRegion = function (id) {
    if (id === this.townId) return;
    this.townId = id;
    if (this.bgmPlaying && this._useTown()) this._crossfadeTo(id);
  };
  Audio.prototype._crossfadeTo = function (id) {
    const self = this;
    const old = this.townEl;
    if (old && old._id === id) { if (old.paused) old.play().catch(function () {}); return; }
    const slots = this._slots();
    const el = slots[0] === old ? slots[1] : slots[0];
    clearInterval(this.fadeTimer);
    el._id = id; el.loop = true;
    setVol(el, 0);
    el.src = this.townUrl(id);
    el.play().catch(function () {});
    this.townEl = el;
    if (this.fileBgm) try { this.fileBgm.pause(); } catch (e) { }
    this._stopSynth();
    const t0 = Date.now(), dur = 1800, oldVol = getVol(old);
    this.fadeTimer = setInterval(function () {
      const k = Math.min(1, (Date.now() - t0) / dur);
      setVol(el, TOWN_VOL * k);
      if (old) setVol(old, oldVol * (1 - k));
      if (k >= 1) {
        clearInterval(self.fadeTimer);
        if (old) { try { old.pause(); old._id = null; } catch (e) { } }
      }
    }, 50);
  };
  Audio.prototype.setBgmMode = function (mode) {
    this.bgmMode = mode === 'classic' ? 'classic' : 'town';
    if (!this.bgmPlaying) return;
    this.stopBgm(); this.playBgm();
  };

  Audio.prototype.unlock = function () {
    if (!this.ctx) {
      const AC = G.AudioContext || G.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
      this.seBus = c.createGain(); this.seBus.gain.value = 1; this.seBus.connect(this.master);
      this.bgmBus = c.createGain(); this.bgmBus.gain.value = 0.42; this.bgmBus.connect(this.master);
      this.noiseBuf = this._noise(2);
      this._probeFile();
    }
    if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') this.ctx.resume();
    this._prime();
  };

  Audio.prototype._noise = function (sec) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec);
    const b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  };

  // ユーザー指定音源（assets/www/audio/bgm.mp3）があれば優先
  Audio.prototype._probeFile = function () {
    const self = this;
    try {
      const a = this._mkEl();
      setVol(a, FILE_VOL);
      a.addEventListener('canplaythrough', function () { self.fileOk = true; self.fileChecked = true; if (self.bgmPlaying) { self._stopSynth(); a.play().catch(function () {}); } }, { once: true });
      a.addEventListener('error', function () { self.fileOk = false; self.fileChecked = true; }, { once: true });
      a.src = 'audio/bgm.mp3';
      this.fileBgm = a;
      // iOS：後から再生できるよう、最初のタップの中で一度だけ無音で再生しておく
      if (IOS) {
        setVol(a, 0);
        const p = a.play();
        if (p && p.then) p.then(function () { if (!(self.bgmPlaying && !self._useTown() && self.fileOk)) a.pause(); setVol(a, FILE_VOL); }, function () { setVol(a, FILE_VOL); });
      }
    } catch (e) { this.fileChecked = true; }
  };

  Audio.prototype.setBgm = function (on) { this.bgmOn = on; if (!on) this.stopBgm(); };
  Audio.prototype.setSe = function (on) { this.seOn = on; if (!on) this.engineStop(); };

  Audio.prototype.playBgm = function () {
    if (!this.ctx || !this.bgmOn) return;
    this.bgmPlaying = true;
    if (this._useTown()) {
      if (this.townEl && this.townEl._id === this.townId) { clearInterval(this.fadeTimer); setVol(this.townEl, TOWN_VOL); this.townEl.play().catch(function () {}); }
      else this._crossfadeTo(this.townId);
      return;
    }
    if (this.fileOk && this.fileBgm) { this.fileBgm.play().catch(function () {}); return; }
    this._startSynth();
  };
  Audio.prototype.stopBgm = function () {
    this.bgmPlaying = false;
    clearInterval(this.fadeTimer);
    if (this.townEl) try { this.townEl.pause(); } catch (e) { }
    if (this.fileBgm) try { this.fileBgm.pause(); } catch (e) { }
    this._stopSynth();
  };
  // 旅の終了時：次の旅は最初の地域の歌の頭から
  Audio.prototype.resetTown = function () {
    if (this.townEl) { try { this.townEl.pause(); this.townEl._id = null; } catch (e) { } }
    this.townEl = null; this.townId = null;
  };

  // ---- 合成BGM：ヨナ抜き（ペンタトニック）の明るい旅のテーマ ----
  const SCALE = [0, 2, 4, 7, 9];           // major pentatonic
  const ROOT = 62;                          // D4
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function scaleNote(deg) {
    const o = Math.floor(deg / 5), i = ((deg % 5) + 5) % 5;
    return ROOT + o * 12 + SCALE[i];
  }
  const MELODY = [
    // bars of 8 eighth-notes; null = rest; numbers are scale degrees
    [4, null, 4, 5, 6, null, 5, 4], [3, null, 2, 3, 4, null, null, null],
    [4, null, 4, 5, 6, 7, 6, 5], [4, null, 3, 2, 3, null, null, null],
    [5, null, 6, 7, 8, null, 7, 6], [5, null, 4, 5, 6, null, 4, null],
    [3, 4, 5, null, 4, 3, 2, null], [1, null, 2, null, 0, null, null, null],
    [7, null, 7, 6, 5, null, 6, 7], [8, null, 7, 6, 5, null, null, null],
    [4, 5, 6, null, 5, 4, 3, null], [4, null, 5, null, 6, null, null, null],
    [7, null, 8, 7, 6, null, 5, 4], [5, null, 4, 3, 4, null, 2, null],
    [3, null, 4, 5, 4, 3, 2, 1], [0, null, null, null, 0, null, null, null]
  ];
  const CHORDS = [0, 3, 0, 4, 3, 0, 4, 0, 3, 0, 4, 0, 3, 0, 4, 0]; // degrees of bass root

  Audio.prototype._startSynth = function () {
    if (this.synth || !this.ctx) return;
    const c = this.ctx, self = this;
    const bpm = 116, eighth = 60 / bpm / 2;
    const st = { step: 0, next: c.currentTime + 0.1, timer: null };
    this.synth = st;
    function pluck(t, f, dur, vol, type) {
      const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
      o.type = type || 'triangle'; o.frequency.value = f;
      fl.type = 'lowpass'; fl.frequency.setValueAtTime(f * 6, t); fl.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(fl); fl.connect(g); g.connect(self.bgmBus);
      o.start(t); o.stop(t + dur + 0.05);
    }
    function drum(t, f, vol, dur) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f * 2.2, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(self.bgmBus); o.start(t); o.stop(t + dur + 0.05);
    }
    function shaker(t, vol) {
      const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
      s.buffer = self.noiseBuf; f.type = 'highpass'; f.frequency.value = 6000;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      s.connect(f); f.connect(g); g.connect(self.bgmBus); s.start(t, Math.random()); s.stop(t + 0.07);
    }
    function tick() {
      while (st.next < c.currentTime + 0.25) {
        const bar = Math.floor(st.step / 8) % MELODY.length, beat = st.step % 8;
        const t = st.next;
        const note = MELODY[bar][beat];
        if (note != null) {
          pluck(t, midi(scaleNote(note)), 0.42, 0.16, 'triangle');
          pluck(t, midi(scaleNote(note) + 12), 0.18, 0.035, 'square');
        }
        const root = CHORDS[bar];
        if (beat === 0 || beat === 4) pluck(t, midi(scaleNote(root) - 24), 0.5, 0.2, 'sine');
        if (beat === 2 || beat === 6) pluck(t, midi(scaleNote(root + 2) - 12), 0.22, 0.06, 'triangle');
        if (beat === 0) drum(t, 55, 0.5, 0.35);
        if (beat === 4) drum(t, 70, 0.32, 0.25);
        if (beat === 6 && bar % 2 === 1) drum(t, 90, 0.18, 0.15);
        shaker(t, beat % 2 ? 0.05 : 0.025);
        st.step++;
        st.next += eighth;
      }
    }
    st.timer = setInterval(tick, 60);
    tick();
  };
  Audio.prototype._stopSynth = function () {
    if (this.synth) { clearInterval(this.synth.timer); this.synth = null; }
  };

  // ---- エンジン・風 ----
  Audio.prototype.engineStart = function () {
    if (!this.ctx || !this.seOn || this.engine) return;
    const c = this.ctx;
    const e = {};
    e.o1 = c.createOscillator(); e.o1.type = 'sawtooth';
    e.o2 = c.createOscillator(); e.o2.type = 'square';
    e.f = c.createBiquadFilter(); e.f.type = 'lowpass'; e.f.frequency.value = 600; e.f.Q.value = 3;
    e.g = c.createGain(); e.g.gain.value = 0.0;
    e.o1.connect(e.f); e.o2.connect(e.f); e.f.connect(e.g); e.g.connect(this.seBus);
    e.n = c.createBufferSource(); e.n.buffer = this.noiseBuf; e.n.loop = true;
    e.nf = c.createBiquadFilter(); e.nf.type = 'bandpass'; e.nf.frequency.value = 800; e.nf.Q.value = 0.6;
    e.ng = c.createGain(); e.ng.gain.value = 0;
    e.n.connect(e.nf); e.nf.connect(e.ng); e.ng.connect(this.seBus);
    e.o1.start(); e.o2.start(); e.n.start();
    this.engine = e;
  };
  Audio.prototype.engineStop = function () {
    const e = this.engine; if (!e) return;
    try { e.o1.stop(); e.o2.stop(); e.n.stop(); } catch (err) { }
    this.engine = null;
  };
  Audio.prototype.engineUpdate = function (speed, accel, gearInfo, rain) {
    const e = this.engine; if (!e || !this.ctx) return;
    const t = this.ctx.currentTime;
    const rpm = gearInfo.rpm;                 // 0..1
    const base = 38 + rpm * 120;
    e.o1.frequency.setTargetAtTime(base, t, 0.05);
    e.o2.frequency.setTargetAtTime(base * 0.5, t, 0.05);
    e.f.frequency.setTargetAtTime(300 + rpm * 1400 + (accel ? 500 : 0), t, 0.08);
    e.g.gain.setTargetAtTime(0.05 + rpm * 0.07 + (accel ? 0.04 : 0), t, 0.1);
    const kmh = speed * 3.6;
    e.ng.gain.setTargetAtTime(Math.min(0.22, (kmh / 120) * (kmh / 120) * 0.22) + (rain ? 0.035 : 0), t, 0.2);
    e.nf.frequency.setTargetAtTime(500 + kmh * 9, t, 0.2);
  };

  // ---- 効果音 ----
  Audio.prototype._tone = function (f, t0, dur, vol, type, f2) {
    if (!this.ctx || !this.seOn) return;
    const c = this.ctx, t = c.currentTime + (t0 || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.seBus); o.start(t); o.stop(t + dur + 0.05);
  };
  Audio.prototype._burst = function (dur, vol, freq) {
    if (!this.ctx || !this.seOn) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    s.buffer = this.noiseBuf; f.type = 'lowpass'; f.frequency.value = freq || 1200;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.seBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  };
  Audio.prototype.sfx = function (name, arg) {
    if (!this.ctx || !this.seOn) return;
    const T = this._tone.bind(this);
    switch (name) {
      case 'crash': this._burst(0.6, 0.9, 900); T(70, 0, 0.4, 0.6, 'sine', 35); T(1800, 0.02, 0.25, 0.08, 'square', 600); break;
      case 'scrape': this._burst(0.25, 0.2, 3000); break;
      case 'pickup': [0, 4, 7, 12].forEach(function (n, i) { T(midi(74 + n), i * 0.08, 0.35, 0.22, 'triangle'); }); break;
      case 'mission': [0, 4, 7, 12, 16].forEach(function (n, i) { T(midi(72 + n), i * 0.09, 0.4, 0.2, 'square'); }); T(midi(84), 0.5, 0.6, 0.18, 'triangle'); break;
      case 'region': T(midi(79), 0, 0.25, 0.2, 'triangle'); T(midi(86), 0.14, 0.45, 0.2, 'triangle'); break;
      case 'pass': T(midi(88), 0, 0.12, 0.12, 'triangle'); break;
      case 'pass2': T(midi(88), 0, 0.1, 0.12, 'triangle'); T(midi(93), 0.08, 0.16, 0.12, 'triangle'); break;
      case 'combo': T(midi(81), 0, 0.15, 0.15, 'square'); T(midi(88), 0.1, 0.25, 0.15, 'square'); break;
      case 'comboLost': T(midi(70), 0, 0.2, 0.12, 'triangle', midi(58)); break;
      case 'violation': T(520, 0, 0.18, 0.18, 'square'); T(390, 0.18, 0.25, 0.18, 'square'); break;
      case 'signalBonus': T(midi(84), 0, 0.3, 0.16, 'sine'); T(midi(91), 0.1, 0.4, 0.14, 'sine'); break;
      case 'count': T(arg ? 1320 : 880, 0, arg ? 0.5 : 0.18, 0.25, 'square'); break;
      case 'horn': T(415, 0, 0.6, 0.22, 'square'); T(523, 0, 0.6, 0.18, 'square'); break;
      case 'shutter': this._burst(0.08, 0.4, 5000); T(2400, 0.02, 0.05, 0.1, 'square'); break;
      case 'siren': {
        const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
        o.type = 'sawtooth'; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
        for (let i = 0; i < 3; i++) { o.frequency.setValueAtTime(650, t + i * 1); o.frequency.linearRampToValueAtTime(980, t + i * 1 + 0.5); o.frequency.linearRampToValueAtTime(650, t + i * 1 + 1); }
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.1); g.gain.setValueAtTime(0.16, t + 2.7); g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
        o.connect(f); f.connect(g); g.connect(this.seBus); o.start(t); o.stop(t + 3.05);
        break;
      }
      case 'fuel': for (let i = 0; i < 6; i++) T(midi(76 + i * 2), i * 0.07, 0.12, 0.1, 'sine'); break;
      case 'goal': [0, 4, 7, 12, 7, 12, 16, 19].forEach(function (n, i) { T(midi(67 + n), i * 0.12, 0.5, 0.18, 'triangle'); T(midi(55 + n), i * 0.12, 0.5, 0.1, 'square'); }); break;
      case 'tap': T(1200, 0, 0.05, 0.08, 'sine'); break;
      case 'thunder': {
        // 雷鳴：低いノイズのうなり（遠雷〜近雷）
        const c = this.ctx, t = c.currentTime;
        const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        src.buffer = this.noiseBuf; src.loop = true; f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(120, t + 2.6);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.75, t + 0.05); g.gain.exponentialRampToValueAtTime(0.25, t + 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
        src.connect(f); f.connect(g); g.connect(this.seBus); src.start(t, Math.random()); src.stop(t + 3.3);
        break;
      }
      case 'shutterPhoto': this._burst(0.06, 0.5, 6000); T(1800, 0.05, 0.06, 0.12, 'square'); break;
      case 'step': T(midi(84), 0, 0.15, 0.14, 'triangle'); T(midi(88), 0.08, 0.2, 0.14, 'triangle'); break;
      case 'warn': T(980, 0, 0.12, 0.14, 'sine'); T(980, 0.18, 0.12, 0.14, 'sine'); break;
      case 'segment': T(midi(79), 0, 0.2, 0.15, 'triangle'); T(midi(83), 0.1, 0.2, 0.15, 'triangle'); T(midi(86), 0.2, 0.35, 0.15, 'triangle'); break;
    }
  };

  R13.Audio = Audio;
})(typeof window !== 'undefined' ? window : globalThis);
