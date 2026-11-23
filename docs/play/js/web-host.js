/* web-host.js — ブラウザ版（iPhone の Safari、Android の Chrome など）向けの補助。
   Android アプリ版（AndroidHost があるとき）は何もしない。
   - 端末の傾き：DeviceMotion の重力加速度から、アプリ版と同じ計算で傾き角を出す（iOS は最初のタップで許可を求める）
   - iOS の音：無音スイッチでも音が出るように（対応端末のみ）
   - 記録：ブラウザの保存領域をできるだけ残すよう依頼
   - ホーム画面への追加とオフライン用の service worker（https のときだけ） */
(function (G) {
  'use strict';
  const R13 = G.R13 = G.R13 || {};
  if (G.AndroidHost) { R13.web = null; return; }

  const ua = (G.navigator && navigator.userAgent) || '';
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  const touch = ('ontouchstart' in G) || (navigator.maxTouchPoints || 0) > 0;
  const standalone = !!((G.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone);

  // ---------------------------------------------------------------- 傾き
  const tilt = {
    supported: !!G.DeviceMotionEvent && touch,
    needsPermission: !!(G.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function'),
    permission: 'unknown',          // 'unknown' | 'granted' | 'denied'
    valid: false, deg: 0, fx: 0, fy: 0, init: false, invert: false, vote: 0, listening: false, lastT: 0,
    onChange: null
  };
  function screenAngle() {
    try { if (G.screen && screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle; } catch (e) { }
    const o = G.orientation;
    if (typeof o === 'number') return o < 0 ? 360 + o : o;
    return (G.innerWidth > G.innerHeight) ? 90 : 0;
  }
  function onMotion(e) {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null || g.y == null) return;
    let ax = g.x, ay = g.y;
    // ブラウザによって符号が逆の端末がある。画面を立てて持ったときに「画面の上方向」が正になる向きにそろえる。
    let sx, sy;
    switch (screenAngle()) {
      case 90:  sx = -ay; sy = ax;  break;
      case 180: sx = -ax; sy = -ay; break;
      case 270: sx = ay;  sy = -ax; break;
      default:  sx = ax;  sy = ay;  break;
    }
    if (Math.abs(sy) > 4 && Math.abs(sx) < Math.abs(sy)) {
      tilt.vote = Math.max(-30, Math.min(30, (tilt.vote || 0) + (sy < 0 ? 1 : -1)));
      const inv = tilt.vote > 8 ? true : (tilt.vote < -8 ? false : tilt.invert);
      if (inv !== tilt.invert) { tilt.invert = inv; tilt.init = false; }
    }
    if (tilt.invert) { sx = -sx; sy = -sy; }
    if (!tilt.init) { tilt.fx = sx; tilt.fy = sy; tilt.init = true; }
    tilt.fx += (sx - tilt.fx) * 0.35;
    tilt.fy += (sy - tilt.fy) * 0.35;
    // 画面の上端が右へ動く回転（時計回り）を正の角度にする（アプリ版と同じ）
    tilt.deg = Math.atan2(-tilt.fx, tilt.fy) * 180 / Math.PI;
    tilt.lastT = Date.now();
    if (!tilt.valid) { tilt.valid = true; if (tilt.onChange) tilt.onChange(); }
  }
  function listen() {
    if (tilt.listening || !tilt.supported) return;
    tilt.listening = true;
    G.addEventListener('devicemotion', onMotion);
    G.addEventListener('orientationchange', function () { tilt.init = false; });
  }
  // iOS は利用者の操作（タップ）の中で許可を求める必要がある
  function requestTilt() {
    if (!tilt.supported) return Promise.resolve(false);
    if (!tilt.needsPermission) { tilt.permission = 'granted'; listen(); return Promise.resolve(true); }
    if (tilt.permission === 'granted') { listen(); return Promise.resolve(true); }
    if (tilt.permission === 'denied') return Promise.resolve(false);
    let p;
    try { p = DeviceMotionEvent.requestPermission(); } catch (e) { return Promise.resolve(false); }
    return Promise.resolve(p).then(function (r) {
      tilt.permission = r === 'granted' ? 'granted' : 'denied';
      if (tilt.permission === 'granted') listen();
      if (tilt.onChange) tilt.onChange();
      return tilt.permission === 'granted';
    }, function () { tilt.permission = 'denied'; if (tilt.onChange) tilt.onChange(); return false; });
  }
  if (tilt.supported && !tilt.needsPermission) listen();

  // AndroidHost と同じ名前の関数（傾きだけ）
  const tiltHost = {
    hasSensor: function () { return tilt.supported && tilt.permission !== 'denied'; },
    hasTilt: function () { return tilt.valid && Date.now() - tilt.lastT < 1500; },
    getTilt: function () { return tilt.deg; }
  };

  // ---------------------------------------------------------------- 最初のタップで行うこと
  let firstDone = false;
  function firstGesture() {
    if (firstDone) return;
    firstDone = true;
    requestTilt();
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { }   // iOS：無音スイッチ中も音を出す
  }
  G.addEventListener('pointerup', firstGesture, true);
  G.addEventListener('touchend', firstGesture, true);
  G.addEventListener('click', firstGesture, true);

  // 記録を消されにくくする（対応ブラウザのみ）
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () { }); } catch (e) { }

  // ホーム画面に追加したときのオフライン用（https のときだけ）
  if ((location.protocol === 'https:' || location.hostname === 'localhost') && 'serviceWorker' in navigator) {
    G.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { }); });
  }

  // iOS：ピンチで画面が拡大されないように（ダブルタップの拡大は CSS の touch-action で止める）
  if (isIOS) document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });

  R13.web = { isIOS: isIOS, touch: touch, standalone: standalone, tilt: tilt, tiltHost: tiltHost, requestTilt: requestTilt };
})(typeof window !== 'undefined' ? window : globalThis);
