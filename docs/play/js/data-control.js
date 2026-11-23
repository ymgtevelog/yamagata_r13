/* data-control.js — 確認番号による誤操作防止つき消去、汎用確認ダイアログ */
(function (G) {
  'use strict';
  const R13 = G.R13 = G.R13 || {};

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function close() { $('ov-confirm').classList.remove('on'); $('cf-box').innerHTML = ''; }

  // 汎用確認
  function confirm(opts) {
    const box = $('cf-box');
    box.innerHTML = '<h2>' + esc(opts.title) + '</h2><p>' + opts.html + '</p>' +
      '<div class="row"><button class="btn" id="cf-no">' + esc(opts.no || 'キャンセル') + '</button>' +
      '<button class="btn ' + (opts.danger ? 'danger' : 'primary') + '" id="cf-yes">' + esc(opts.yes || 'OK') + '</button></div>';
    $('ov-confirm').classList.add('on');
    $('cf-no').onclick = function () { close(); if (opts.onNo) opts.onNo(); };
    $('cf-yes').onclick = function () { close(); if (opts.onYes) opts.onYes(); };
  }

  // 消去：毎回表示する4桁の確認番号を入力し、一致した場合だけ消去ボタンを有効にする
  function openErase(opts) {
    const code = R13.records.confirmCode();
    const box = $('cf-box');
    box.innerHTML = '<h2>' + esc(opts.title) + '</h2>' +
      '<p>' + opts.html + '</p>' +
      '<p class="hint">実行後は元に戻せません。確認番号を入力すると消去ボタンが有効になります。</p>' +
      '<div class="code-box"><span class="code">' + code + '</span>' +
      '<input id="cf-code" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="----"></div>' +
      '<div class="row"><button class="btn" id="cf-no">キャンセル</button><button class="btn danger" id="cf-yes" disabled>消去する</button></div>';
    $('ov-confirm').classList.add('on');
    const inp = $('cf-code'), yes = $('cf-yes');
    inp.addEventListener('input', function () {
      inp.value = inp.value.replace(/[^0-9]/g, '').slice(0, 4);
      yes.disabled = inp.value !== code;
    });
    $('cf-no').onclick = close;
    yes.onclick = function () {
      if (inp.value !== code) { yes.disabled = true; return; }   // 実行時も一致を確認
      close();
      opts.onErase();
    };
    setTimeout(function () { try { inp.focus(); } catch (e) { } }, 50);
  }

  R13.dataControl = { confirm: confirm, openErase: openErase, close: close, esc: esc };
})(typeof window !== 'undefined' ? window : globalThis);
