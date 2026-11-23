/* 名所カードに写真を使うときの設定。
   1) このフォルダーに <カードID>.jpg を置く（横長 16:10 くらい、幅 800px ほど）。例：yz-uesugi.jpg
   2) 下の一覧にそのIDを書く。例：R13.sightPhotos = ['yz-uesugi', 'ym-yamadera'];
   一覧にないカードは、プログラムで描いたイラストを表示します。IDは js/sights.js の CARDS を参照。 */
window.R13 = window.R13 || {};
R13.sightPhotos = [];
