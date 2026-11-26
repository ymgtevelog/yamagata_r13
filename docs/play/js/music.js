/* music.js — BGM「山形たびめぐり音楽帳」の紹介と、YouTube へのリンク（制作・発信：山形イベログ）。
   ゲーム自体は通信しない。リンクは端末の YouTube アプリまたはブラウザで開く。 */
(function (G) {
  'use strict';
  const R13 = G.R13 = G.R13 || {};
  const CHANNEL = { name: '山形イベログ', handle: '@ymgt_evelog', url: 'https://www.youtube.com/@ymgt_evelog' };
  const PLAYLIST = { name: '山形たびめぐり音楽帳', url: 'https://www.youtube.com/playlist?list=PLCg-62_Qkruc' };
  // 市町村ソングの MV（国道13号の並び順）
  const MV = {
    yonezawa: 'https://www.youtube.com/watch?v=u6RMKRHk3m8',
    takahata: 'https://www.youtube.com/watch?v=ZBvtILmtOA0',
    nanyo: 'https://www.youtube.com/watch?v=-8JRyOAbeYQ',
    kaminoyama: 'https://www.youtube.com/watch?v=W4spHB1lk6Y',
    yamagata: 'https://www.youtube.com/watch?v=MbpH4DH5yM0',
    tendo: 'https://www.youtube.com/watch?v=9GhqmaJhNpM',
    higashine: 'https://www.youtube.com/watch?v=Xd7D-_q8Y1w',
    murayama: 'https://www.youtube.com/watch?v=qgzALVmPjmU',
    oishida: 'https://www.youtube.com/watch?v=fP3vtYJCXx8',
    obanazawa: 'https://www.youtube.com/watch?v=zHz1JKbfR0Q',
    funagata: 'https://www.youtube.com/watch?v=m0aDLkenfxk',
    shinjo: 'https://www.youtube.com/watch?v=0WsvNM2SRsk',
    kaneyama: 'https://www.youtube.com/watch?v=uiEPtVjqneM'
  };
  // このアプリのプライバシーポリシー（GitHub Pages）
  const PRIVACY = 'https://ymgtevelog.github.io/yamagata_r13/privacy.html';
  // 開いてよいリンク（YouTube と、このアプリの GitHub Pages・リポジトリのみ）
  function allowed(url) { return /^https:\/\/(www\.|m\.)?youtube\.com\/[^\s"'<>]*$/.test(url) || /^https:\/\/youtu\.be\/[^\s"'<>]*$/.test(url) ||
    /^https:\/\/(ymgtevelog\.github\.io\/yamagata_r13|github\.com\/ymgtevelog\/yamagata_r13)(\/[^\s"'<>]*)?$/.test(url); }
  // 外部アプリで開く。Android はホスト経由、ブラウザは新しいタブ。
  function open(url) {
    if (!allowed(url)) return false;
    const host = G.AndroidHost;
    if (host && host.openUrl) { try { return host.openUrl(url) !== false; } catch (e) { return false; } }
    try { const w = G.open(url, '_blank', 'noopener'); return !!w || true; } catch (e) { return false; }
  }
  const AREA = { yonezawa: '置賜', takahata: '置賜', nanyo: '置賜', kaminoyama: '村山', yamagata: '村山', tendo: '村山', higashine: '村山',
    murayama: '村山', oishida: '村山', obanazawa: '村山', funagata: '最上', shinjo: '最上', kaneyama: '最上' };
  const TUTORIAL = 'https://www.youtube.com/watch?v=udiu85Q-stQ';   // 1.0.5：操作説明の動画（約2分）
  R13.music = { CHANNEL: CHANNEL, PLAYLIST: PLAYLIST, PRIVACY: PRIVACY, TUTORIAL: TUTORIAL, MV: MV, AREA: AREA, allowed: allowed, open: open };
  if (typeof module !== 'undefined') module.exports = R13;
})(typeof window !== 'undefined' ? window : globalThis);
