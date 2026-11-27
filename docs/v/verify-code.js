/* verify-code.js — 結果カードの「記録の確認コード」を作る・確かめる（ゲームと確認ページで同じファイルを使う）

   コードの形（例：2026年11月25日に 98,765 点・2時間39分38秒01 で全行程を完走した ABCDEFGH さん。山形ドライブ R13 ver 1.0.5）
     S0098765xD20261125xT02393801xN00000000ABCDEFGHxVYD30105x8YTDSH7B8KR05RTF7H
     S  得点（7桁・左を0で埋める）
     D  完走した日（端末の日付 YYYYMMDD）
     T  完走タイム（時・分・秒・1/100秒 を各2桁）
     N  ドライバー名（A～Z・16文字。左を0で埋める）
     V  ソフトの記号（英大文字・数字 3 文字。YD3＝山形ドライブ R13）＋バージョン（versionCode 4桁。1.0.5 → 0105）
     最後の18文字  確認用の値：
       HMAC-SHA256（鍵, "R13V2|" + 上の5項目をxでつないだ文字列）の先頭90ビットを
       Crockford Base32（0-9 と A-Z から I L O U を除いた32文字）で18文字にしたもの
   QR コードには確認ページの URL の後ろ（# の後）にこのコードを入れる。# の後ろはサーバーに送られない。
   難易度の違う版や別のドライブゲームを出すときは、ソフトの記号を分けて GAMES に名前を足す（確認ページも同じファイルを使う）。

   注意：ゲームはオフラインで動くため、鍵はプログラムの中にある。画像の数字を書き換えただけの偽物は見分けられるが、
   プログラムを解析すれば作れてしまう。高得点の紹介など大事な場面では、運営による追加の確認（画面録画など）と組み合わせる。 */
(function (G) {
  'use strict';
  const R13 = G.R13 = G.R13 || {};
  const VERSION = 'R13V2';
  // このソフトの記号とバージョン（versionCode）。バージョンを上げるときはここも直す（build.sh の VER と同じ）
  const GAME = 'YD3', VERSION_CODE = 107;
  const GAMES = { YD3: '山形ドライブ R13' };
  const PAGE = 'https://ymgtevelog.github.io/yamagata_r13/v/';

  // ---------------------------------------------------------------- SHA-256（同期・依存なし）
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256(bytes) {
    const l = bytes.length, nb = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(nb);
    m.set(bytes); m[l] = 0x80;
    const bits = l * 8; m[nb - 4] = (bits >>> 24) & 255; m[nb - 3] = (bits >>> 16) & 255; m[nb - 2] = (bits >>> 8) & 255; m[nb - 1] = bits & 255;
    m[nb - 5] = Math.floor(bits / 0x100000000) & 255;
    const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], w = new Array(64);
    for (let o = 0; o < nb; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = (m[o + i * 4] << 24) | (m[o + i * 4 + 1] << 16) | (m[o + i * 4 + 2] << 8) | m[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15], b = w[i - 2];
        const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let A = h[0], B = h[1], C = h[2], D = h[3], E = h[4], F = h[5], Gg = h[6], H = h[7];
      for (let i = 0; i < 64; i++) {
        const S1 = ((E >>> 6) | (E << 26)) ^ ((E >>> 11) | (E << 21)) ^ ((E >>> 25) | (E << 7));
        const ch = (E & F) ^ (~E & Gg);
        const t1 = (H + S1 + ch + K[i] + w[i]) | 0;
        const S0 = ((A >>> 2) | (A << 30)) ^ ((A >>> 13) | (A << 19)) ^ ((A >>> 22) | (A << 10));
        const mj = (A & B) ^ (A & C) ^ (B & C);
        const t2 = (S0 + mj) | 0;
        H = Gg; Gg = F; F = E; E = (D + t1) | 0; D = C; C = B; B = A; A = (t1 + t2) | 0;
      }
      h[0] = (h[0] + A) | 0; h[1] = (h[1] + B) | 0; h[2] = (h[2] + C) | 0; h[3] = (h[3] + D) | 0;
      h[4] = (h[4] + E) | 0; h[5] = (h[5] + F) | 0; h[6] = (h[6] + Gg) | 0; h[7] = (h[7] + H) | 0;
    }
    const out = new Uint8Array(32);
    for (let i = 0; i < 8; i++) { out[i * 4] = h[i] >>> 24; out[i * 4 + 1] = (h[i] >>> 16) & 255; out[i * 4 + 2] = (h[i] >>> 8) & 255; out[i * 4 + 3] = h[i] & 255; }
    return out;
  }
  function utf8(s) { const a = []; s = unescape(encodeURIComponent(s)); for (let i = 0; i < s.length; i++) a.push(s.charCodeAt(i)); return new Uint8Array(a); }
  function hmac(key, msg) {
    if (key.length > 64) key = sha256(key);
    const ipad = new Uint8Array(64 + msg.length), opad = new Uint8Array(64 + 32);
    for (let i = 0; i < 64; i++) { const k = key[i] || 0; ipad[i] = k ^ 0x36; opad[i] = k ^ 0x5c; }
    ipad.set(msg, 64);
    opad.set(sha256(ipad), 64);
    return sha256(opad);
  }
  const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function base32(bytes, nChars) {
    let out = '', acc = 0, nb = 0, i = 0;
    while (out.length < nChars) {
      if (nb < 5) { acc = (acc << 8) | (bytes[i++] || 0); nb += 8; }
      out += B32.charAt((acc >>> (nb - 5)) & 31); nb -= 5; acc &= (1 << nb) - 1;
    }
    return out;
  }
  // 鍵：いくつかの断片を並べ替えてから SHA-256 にかけたもの（そのままの文字列はプログラムに置かない）
  let _key = null;
  function key() {
    if (_key) return _key;
    const p = ['bW9nYXRh', 'LXIxMy1', 'eWFt', 'ZXZlbG9n', 'dmVyaWZ5', 'LTIwMjYt', 'eW1ndC1'];
    const order = [2, 0, 1, 6, 3, 5, 4];
    let s = ''; order.forEach(function (i) { s += p[i]; });
    const raw = (typeof atob === 'function') ? atob(s) : Buffer.from(s, 'base64').toString('binary');
    const bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) ^ ((i * 29 + 7) & 255);
    _key = sha256(bytes);
    return _key;
  }

  // ---------------------------------------------------------------- コードを作る・読む
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function vcText(vc) { vc = +vc; return Math.floor(vc / 100) + '.' + (Math.floor(vc / 10) % 10) + '.' + (vc % 10); }
  function body(score, date, timeSec, name, game, vcode) {
    const cs = Math.max(0, Math.round(timeSec * 100));
    const hh = Math.floor(cs / 360000), mm = Math.floor(cs / 6000) % 60, ss = Math.floor(cs / 100) % 60, cc = cs % 100;
    const d = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
    return 'S' + pad(Math.min(9999999, Math.max(0, Math.floor(score))), 7) + 'xD' + d + 'xT' + pad(Math.min(99, hh), 2) + pad(mm, 2) + pad(ss, 2) + pad(cc, 2) +
      'xN' + pad(String(name || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 16), 16) +
      'xV' + String(game || GAME).toUpperCase().slice(0, 3) + pad(Math.min(9999, Math.max(0, vcode == null ? VERSION_CODE : vcode)), 4);
  }
  function sign(b) { return base32(hmac(key(), utf8(VERSION + '|' + b)), 18); }
  function make(score, date, timeSec, name, game, vcode) { const b = body(score, date, timeSec, name, game, vcode); return b + 'x' + sign(b); }
  const RE = /^S(\d{7})xD(\d{4})(\d{2})(\d{2})xT(\d{2})(\d{2})(\d{2})(\d{2})xN([0A-Z]{16})xV([A-Z0-9]{3})(\d{4})x([0-9A-HJKMNP-TV-Z]{18})$/;
  const LEN = 74, SEP = [8, 18, 28, 46, 55];
  function parse(code) {
    code = String(code || '').trim().replace(/^.*#/, '');
    try { code = decodeURIComponent(code); } catch (e) { }
    code = code.replace(/\s+/g, '').toUpperCase();
    if (code.length === LEN) code = code.split('').map(function (c, i) { return SEP.indexOf(i) >= 0 && c === 'X' ? 'x' : c; }).join('');
    const m = RE.exec(code);
    if (!m) return { ok: false, format: false, code: code };
    const b = code.slice(0, code.lastIndexOf('x'));
    const ok = sign(b) === m[12];
    const name = m[9].replace(/^0+/, '');
    return {
      ok: ok, format: true, code: code,
      score: parseInt(m[1], 10), year: +m[2], month: +m[3], day: +m[4],
      time: +m[5] * 3600 + +m[6] * 60 + +m[7] + +m[8] / 100, timeText: (+m[5] ? +m[5] + '時間' : '') + +m[6] + '分' + m[7] + '秒' + m[8],
      name: name, game: m[10], gameName: GAMES[m[10]] || null, versionCode: +m[11], versionText: vcText(m[11])
    };
  }
  function url(code) { return PAGE + '#' + code; }

  R13.verify = { VERSION: VERSION, GAME: GAME, VERSION_CODE: VERSION_CODE, GAMES: GAMES, PAGE: PAGE, make: make, parse: parse, url: url, body: body, _sha256: sha256, _hmac: hmac };
  if (typeof module === 'object' && module.exports) module.exports = R13.verify;
})(typeof window !== 'undefined' ? window : globalThis);
