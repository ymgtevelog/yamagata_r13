/* sights.js — 名所カード：沿線13市町村の名所の紹介文と、プログラムで描くイラスト。
   写真を使う場合は www/sights/<id>.jpg を置き、www/sights/photos.js の一覧に id を書くと、イラストの代わりにその写真を表示する。 */
(function (G) {
  'use strict';
  const R13 = G.R13 = G.R13 || {};

  // s：カードを出す地点（m）。沿道の案内板はその少し先に立つ。
  const CARDS = [
    // ---------------- 米沢
    { id: 'yz-uesugi', region: 'yonezawa', s: 500, name: '上杉神社・松が岬公園', art: 'shrine', opt: { sakura: true, moat: true },
      short: '米沢城の本丸跡。上杉謙信をまつる',
      body: '米沢城の本丸跡に建つ神社で、戦国武将の上杉謙信をまつります。お堀に囲まれた松が岬公園は桜の名所。2月には雪灯篭の灯がともる「上杉雪灯篭まつり」の会場になります。',
      info: [['場所', '米沢市の中心部（国道13号の西）'], ['見ごろ', '桜は4月中旬〜下旬、雪灯篭は2月']] },
    { id: 'yz-byosho', region: 'yonezawa', s: 1500, name: '上杉家廟所', art: 'mausoleum',
      short: '杉木立に並ぶ、歴代藩主の墓所',
      body: '上杉謙信と、米沢藩の歴代藩主がねむる墓所。高い杉木立の中に廟屋が整然と並び、国の史跡に指定されています。静かで厳かな空気が流れる場所です。',
      info: [['場所', '米沢市御廟'], ['ひとこと', '上杉神社とあわせて歩くと、米沢藩の歴史がたどれます']] },
    { id: 'yz-onogawa', region: 'yonezawa', s: 3200, name: '小野川温泉', art: 'onsen', opt: { style: 'town', fireflies: true, v: 1 },
      short: '小野小町ゆかりの湯。初夏はホタル',
      body: '小野小町が見つけたと伝わる温泉。温泉街には足湯や飲泉所があり、ラジウムを含む湯で知られます。初夏の夜にはホタルが舞い、冬はかまくらが並びます。',
      info: [['場所', '米沢市の南西'], ['見ごろ', 'ホタルは6月中旬〜7月']] },
    // ---------------- 高畠
    { id: 'th-kameoka', region: 'takahata', s: 4500, name: '亀岡文殊', art: 'temple', opt: { cedar: true, steps: true },
      short: '日本三文殊の一つ。学問の仏さま',
      body: '大聖寺の文殊堂は「日本三文殊」の一つに数えられ、合格祈願の参拝者が全国から訪れます。杉並木の石畳の参道を上った先に、どっしりとしたお堂が建っています。',
      info: [['場所', '高畠町亀岡'], ['ひとこと', '境内に湧く「利根水」は、知恵の水といわれます']] },
    { id: 'th-akutsu', region: 'takahata', s: 6700, name: '安久津八幡神社', art: 'pagoda',
      short: '三重塔と茅葺きの舞楽殿が残る古社',
      body: '田園の中に三重塔がすっと立つ、高畠を代表する風景。茅葺き屋根の舞楽殿では、春と秋の例大祭で舞が奉納されます。まわりは歴史公園として整備されています。',
      info: [['場所', '高畠町安久津（道の駅 たかはたのそば）'], ['見ごろ', '春の桜、秋の紅葉']] },
    { id: 'th-hirosuke', region: 'takahata', s: 7500, name: '浜田広介記念館', art: 'house', opt: { kind: 'hirosuke' },
      short: '「泣いた赤おに」の作者のふるさと',
      body: '「日本のアンデルセン」と呼ばれる童話作家・浜田広介は高畠町の生まれ。記念館では「泣いた赤おに」などの作品世界にふれられ、移築された生家も見学できます。',
      info: [['場所', '高畠町一本柳'], ['ひとこと', '高畠は「まほろばの里」。童話の里としても知られます']] },
    // ---------------- 南陽
    { id: 'nn-kumano', region: 'nanyo', s: 8250, name: '熊野大社', art: 'shrine', opt: { kaya: true, cedar: true, rabbit: true },
      short: '東北の伊勢。三羽のうさぎを探そう',
      body: '「日本三熊野」の一つに数えられる古社。茅葺きの大きな拝殿が見事です。本殿の裏には三羽のうさぎが隠し彫りされ、三羽すべて見つけると願いがかなうといわれます。',
      info: [['場所', '南陽市宮内'], ['ひとこと', '縁結びの神社としても親しまれています']] },
    { id: 'nn-akayu', region: 'nanyo', s: 8900, name: '赤湯温泉', art: 'onsen', opt: { style: 'town', grape: true, v: 3 },
      short: '開湯900年あまり。ぶどうとワインの湯のまち',
      body: '平安時代の開湯と伝わる、歴史ある温泉。米沢藩主・上杉家の御殿湯としても使われました。まわりの丘にはぶどう畑が広がり、ワイナリーめぐりも楽しめます。',
      info: [['場所', '南陽市赤湯（国道13号の西）'], ['ひとこと', '辛みそをのせた赤湯のラーメンも名物']] },
    { id: 'nn-eboshi', region: 'nanyo', s: 9300, name: '烏帽子山公園', art: 'sakurahill',
      short: '千本桜と石の大鳥居。さくら名所100選',
      body: '赤湯温泉街を見下ろす丘に、約千本の桜が咲きます。「日本さくら名所100選」の一つ。烏帽子山八幡宮の石の大鳥居は、継ぎ目のない鳥居として日本有数の大きさです。',
      info: [['場所', '南陽市赤湯'], ['見ごろ', '4月中旬〜下旬']] },
    { id: 'nn-sky', region: 'nanyo', s: 10100, name: '十分一山と白竜湖', art: 'sky',
      short: '空を舞うパラグライダーと、ぶどう畑の斜面',
      body: '十分一山の斜面には、ぶどう畑が一面に広がります。山頂近くの南陽スカイパークはパラグライダーの名所。ふもとの白竜湖と置賜盆地を見わたす眺めは、朝霧の季節が特に美しいといわれます。',
      info: [['場所', '南陽市赤湯の北（国道13号の左手の山）'], ['ひとこと', '国道13号は、この山と白竜湖の間を上っていきます']] },
    // ---------------- 上山
    { id: 'km-narage', region: 'kaminoyama', s: 13500, name: '楢下宿', art: 'posttown',
      short: '羽州街道の宿場。茅葺きの家と石橋',
      body: '江戸時代、参勤交代の大名も通った羽州街道の宿場町。茅葺き屋根の古民家と、明治時代に架けられた石造りのアーチ橋が残り、昔の街道の面影を伝えます。',
      info: [['場所', '上山市楢下'], ['ひとこと', '宿場のこんにゃく料理も知られています']] },
    { id: 'km-castle', region: 'kaminoyama', s: 14300, name: '上山城', art: 'castle', opt: { type: 'tenshu', sakura: true },
      short: '蔵王を望む城。月岡公園は桜の名所',
      body: '城下町・上山のシンボル。現在の天守は昭和57年に建てられたもので、中は郷土資料館になっています。最上階からは蔵王連峰と上山の街並みを一望できます。',
      info: [['場所', '上山市元城内（国道13号の右手）'], ['見ごろ', '桜は4月中旬〜下旬']] },
    { id: 'km-onsen', region: 'kaminoyama', s: 15150, name: 'かみのやま温泉', art: 'onsen', opt: { style: 'town', crane: true },
      short: '鶴が傷をいやした「鶴脛の湯」',
      body: '室町時代、旅の僧が、沼地に湧く湯で脛の傷をいやす鶴を見つけたのが始まりと伝わります。城下町・宿場町・温泉町の三つの顔を持ち、街なかに足湯や共同浴場が点在します。',
      info: [['場所', '上山市の中心部'], ['ひとこと', '秋には「かみのやま温泉全国かかし祭」が開かれます']] },
    { id: 'km-mokichi', region: 'kaminoyama', s: 16550, name: '斎藤茂吉記念館', art: 'house', opt: { kind: 'mokichi' },
      short: '歌人・斎藤茂吉のふるさと、金瓶',
      body: '近代短歌を代表する歌人・斎藤茂吉は、上山の金瓶の生まれ。記念館には自筆の原稿や書画が展示され、蔵王を望む「みゆき公園」の中に建っています。',
      info: [['場所', '上山市北町（JR茂吉記念館前駅のそば）'], ['ひとこと', '歌集『赤光』『あらたま』で知られます']] },
    // ---------------- 山形
    { id: 'ym-zao', region: 'yamagata', s: 17500, name: '蔵王温泉と樹氷', art: 'juhyo',
      short: '冬は樹氷（スノーモンスター）の世界',
      body: '蔵王連峰の中腹にある、強い酸性の硫黄泉で知られる温泉。冬は木々が雪と氷におおわれた「樹氷」が山を埋めつくし、ロープウェイから眺められます。夜のライトアップも幻想的です。',
      info: [['場所', '山形市蔵王温泉（国道13号の東の山）'], ['見ごろ', '樹氷は1月下旬〜2月']] },
    { id: 'ym-kajo', region: 'yamagata', s: 19800, name: '霞城公園（山形城跡）', art: 'castle', opt: { type: 'gate', sakura: true },
      short: '最上義光の城。お堀と桜、東大手門',
      body: '最上義光が城下町の基礎を築いた山形城の跡。復元された二ノ丸東大手門は、木造の櫓門として国内有数の大きさです。お堀沿いに約1500本の桜が咲きます。',
      info: [['場所', '山形市霞城町（山形駅の北）'], ['見ごろ', '桜は4月中旬']] },
    { id: 'ym-bunsho', region: 'yamagata', s: 20250, name: '文翔館', art: 'western',
      short: '大正時代の旧県庁舎。時計塔の洋館',
      body: '大正5年に建てられた、れんが造りの旧県庁舎と旧県会議事堂。国の重要文化財で、時計塔は今も時を刻みます。館内は無料で見学でき、大正の雰囲気をそのまま味わえます。',
      info: [['場所', '山形市旅篭町'], ['ひとこと', '山形市の中心街、七日町大通りの突きあたりに建ちます']] },
    { id: 'ym-imoni', region: 'yamagata', s: 20560, name: '日本一の芋煮会フェスティバル', art: 'imoni',
      short: '直径6 m超の大鍋で、約3万食',
      body: '毎年9月、馬見ヶ崎川の河川敷で開かれる山形の秋の風物詩。大鍋「鍋太郎」で里芋・牛肉・こんにゃく・ねぎをしょうゆ味で煮こみ、重機ですくって配ります。',
      info: [['場所', '山形市・馬見ヶ崎川の河川敷（国道13号の橋の近く）'], ['時期', '9月中旬']] },
    { id: 'ym-yamadera', region: 'yamagata', s: 22100, name: '山寺（宝珠山立石寺）', art: 'cliff',
      short: '「閑さや岩にしみ入る蝉の声」',
      body: '860年、慈覚大師円仁が開いたと伝わる山寺。千段をこえる石段を上ると、岩の上に建つ納経堂や五大堂から、山あいの里を見わたせます。松尾芭蕉が名句を詠んだ地です。',
      info: [['場所', '山形市山寺（国道13号の東）'], ['見ごろ', '新緑、紅葉、雪景色と四季それぞれ']] },
    // ---------------- 天童
    { id: 'td-maizuru', region: 'tendo', s: 23900, name: '舞鶴山と人間将棋', art: 'shogi',
      short: '桜の下で、人が駒になる春の一局',
      body: '天童市街の東にある舞鶴山は、約2千本の桜の名所。春の天童桜まつりでは、甲冑や着物姿の人が将棋の駒になる「人間将棋」が行われ、プロ棋士が対局します。',
      info: [['場所', '天童市天童（国道13号の右手）'], ['時期', '人間将棋は4月']] },
    { id: 'td-onsen', region: 'tendo', s: 24800, name: '天童温泉', art: 'onsen', opt: { style: 'town', koma: true, v: 2 },
      short: '将棋駒のまちの湯。街なかの温泉',
      body: '明治時代に、田んぼの井戸掘りから湧いた温泉。旅館やホテルが市街地に集まり、足湯も楽しめます。将棋の対局の舞台になることも多い、将棋のまちの温泉です。',
      info: [['場所', '天童市鎌田本町（国道13号の右手）'], ['ひとこと', '天童の将棋駒は、全国の生産量の大半を占めます']] },
    { id: 'td-jakushoji', region: 'tendo', s: 26000, name: '若松寺', art: 'temple', opt: { cedar: true, kaya: true },
      short: '「めでためでたの若松様よ」縁結びの寺',
      body: '花笠音頭に「めでためでたの若松様よ」と歌われる古寺。縁結びの観音さまとして知られます。室町時代に建てられた観音堂は、国の重要文化財です。',
      info: [['場所', '天童市山元（市街の東の山あい）'], ['ひとこと', '「西の出雲、東の若松」と並び称されます']] },
    // ---------------- 東根
    { id: 'hg-cherry', region: 'higashine', s: 27300, name: 'さくらんぼ「佐藤錦」', art: 'cherry',
      short: '東根は佐藤錦のふるさと。初夏の赤い宝石',
      body: 'さくらんぼの代表品種「佐藤錦」は、東根の佐藤栄助が長い年月をかけて育てました。東根市はさくらんぼの生産量が日本一。初夏には果樹園でさくらんぼ狩りが楽しめます。',
      info: [['場所', '東根市の全域'], ['見ごろ', '6月中旬〜7月上旬']] },
    { id: 'hg-onsen', region: 'higashine', s: 29100, name: 'さくらんぼ東根温泉', art: 'onsen', opt: { style: 'town', cherry: true, v: 1 },
      short: '果樹園に囲まれた、とろりとした湯',
      body: '明治時代に、かんがい用の井戸掘りで見つかった温泉。琥珀色のなめらかな湯が特徴です。果樹園に囲まれた温泉街に、旅館や共同浴場が並びます。',
      info: [['場所', '東根市温泉町（国道13号の東）'], ['ひとこと', '共同浴場が多く、気軽に立ち寄り湯ができます']] },
    { id: 'hg-keyaki', region: 'higashine', s: 29700, name: '東根の大ケヤキ', art: 'tree',
      short: '樹齢1500年以上。日本一のケヤキ',
      body: '東根小学校の校庭に立つ、国の特別天然記念物。樹齢は1500年以上、幹のまわりは約16メートルといわれ、ケヤキとして日本一の大きさです。子どもたちを見守り続けてきました。',
      info: [['場所', '東根市本丸南（東根城の跡）'], ['見ごろ', '新緑の5月、黄葉の11月']] },
    // ---------------- 村山
    { id: 'mr-nansho', region: 'murayama', s: 31500, name: '最上川三難所', art: 'rapids',
      short: '碁点・三ヶ瀬・隼。舟運の時代の難所',
      body: '最上川が村山市で大きく曲がるあたりは、岩が多く流れの速い「碁点」「三ヶ瀬」「隼」の三難所。舟運の時代には船頭を悩ませました。今は舟下りで、その流れを体験できます。',
      info: [['場所', '村山市の西（国道13号の左手）'], ['ひとこと', '川沿いのそば屋をめぐる「最上川三難所そば街道」も人気']] },
    { id: 'mr-rose', region: 'murayama', s: 32900, name: '東沢バラ公園', art: 'rose',
      short: '約750品種、2万株のバラ',
      body: '7ヘクタールの園内に、世界各国のバラが咲く東日本有数のバラ園。その香りは、環境省の「かおり風景100選」にも選ばれています。初夏と秋に見ごろを迎えます。',
      info: [['場所', '村山市楯岡（国道13号の東）'], ['見ごろ', '6月上旬〜7月上旬、9月中旬〜下旬']] },
    { id: 'mr-iai', region: 'murayama', s: 34300, name: '居合神社', art: 'shrine', opt: { cedar: true, sword: true },
      short: '居合の始祖・林崎甚助をまつる',
      body: '戦国時代、この地に生まれた林崎甚助重信は、居合の道を開いたとされます。神社には全国から居合道の修行者が訪れ、境内の道場で奉納演武が行われます。',
      info: [['場所', '村山市林崎'], ['ひとこと', '「居合発祥の地」として知られます']] },
    // ---------------- 大石田
    { id: 'oi-kashi', region: 'oishida', s: 35500, name: '大石田河岸', art: 'kashi',
      short: '最上川舟運で栄えた、川のみなと',
      body: '江戸時代、大石田は最上川舟運の最大の河岸として栄え、紅花や米が酒田へ運ばれました。川沿いの堤防には、蔵の白壁を模した「塀蔵」が続きます。松尾芭蕉もここで句会を開きました。',
      info: [['場所', '大石田町の中心部（国道13号の西）'], ['ひとこと', '芭蕉は大石田で「五月雨を集めて涼し最上川」と詠みました']] },
    { id: 'oi-soba', region: 'oishida', s: 36300, name: '大石田そば街道', art: 'soba',
      short: '在来種「来迎寺在来」の手打ちそば',
      body: '昼と夜の寒暖差と朝霧が、香り高いそばを育てます。町内に十数軒のそば屋が点在し、在来種のそばや、太打ちの田舎そばを味わえます。次年子地区のそばも有名です。',
      info: [['場所', '大石田町の各地'], ['見ごろ', 'そばの花は8月下旬〜9月、新そばは秋']] },
    // ---------------- 尾花沢
    { id: 'ob-tokura', region: 'obanazawa', s: 37400, name: '徳良湖', art: 'lake', opt: { hanagasa: true },
      short: '花笠踊りが生まれた湖',
      body: '大正時代に造られた、かんがい用のため池。工事で土をつき固めるときの歌と、笠を回す動きが、花笠音頭と花笠踊りの始まりといわれます。湖畔にはキャンプ場や温泉があります。',
      info: [['場所', '尾花沢市二藤袋（国道13号の東）'], ['ひとこと', '8月の「おばなざわ花笠まつり」では、発祥の地の踊りが見られます']] },
    { id: 'ob-ginzan', region: 'obanazawa', s: 38600, name: '銀山温泉', art: 'onsen', opt: { style: 'river' },
      short: '大正ロマンの木造旅館と、ガス灯の夜',
      body: '銀山川の両岸に、大正から昭和初期の木造多層の旅館が立ち並びます。夕暮れにガス灯がともると、川面に灯りが映り、タイムスリップしたような風景に。江戸時代に栄えた延沢銀山が名の由来です。',
      info: [['場所', '尾花沢市銀山新畑（国道13号から東へ）'], ['見ごろ', '雪景色の冬は特に人気']] },
    { id: 'ob-seifu', region: 'obanazawa', s: 39200, name: '芭蕉・清風歴史資料館', art: 'house', opt: { kind: 'seifu' },
      short: '芭蕉が10泊した、紅花商人のまち',
      body: '松尾芭蕉は『おくのほそ道』の旅で、紅花商人・鈴木清風を訪ねて尾花沢に10泊しました。資料館は、清風宅の隣にあった商家を移した建物。芭蕉と清風の交流を紹介しています。',
      info: [['場所', '尾花沢市中町'], ['ひとこと', '芭蕉が尾花沢で詠んだ「涼しさを我宿にしてねまる也」']] },
    // ---------------- 舟形
    { id: 'fn-sabane', region: 'funagata', s: 41480, name: '猿羽根山地蔵尊', art: 'temple', opt: { red: true, cedar: true },
      short: '峠の上の縁結び・子宝のお地蔵さま',
      body: '猿羽根峠の頂上近くに建つ、日本三大地蔵の一つといわれるお地蔵さま。縁結びや子宝、延命にご利益があるとされます。峠からは最上川と舟形の町を見下ろせます。',
      info: [['場所', '舟形町舟形（猿羽根トンネルの上）'], ['ひとこと', '旧羽州街道の峠道が史跡として残ります']] },
    { id: 'fn-oguni', region: 'funagata', s: 42250, name: '最上小国川', art: 'ayu',
      short: '松原鮎で知られる清流',
      body: '山あいを流れる清流で、鮎釣りの名所。ここで育つ鮎は「松原鮎」と呼ばれ、香りのよさで有名です。夏は川いっぱいに釣り人が並び、「ふながた若鮎まつり」が開かれます。',
      info: [['場所', '舟形町（国道13号が渡る川）'], ['見ごろ', '鮎釣りは7月〜9月']] },
    { id: 'fn-megami', region: 'funagata', s: 43400, name: '国宝・縄文の女神', art: 'dogu',
      short: '高さ45 cm。日本最大級の土偶',
      body: '舟形町の西ノ前遺跡から出土した、約4500年前の土偶。すらりとした八頭身の美しい姿から「縄文の女神」と呼ばれ、国宝に指定されています。実物は山形市の県立博物館で見られます。',
      info: [['場所', '出土地は舟形町西ノ前遺跡'], ['ひとこと', '町内では精巧なレプリカが展示されています']] },
    // ---------------- 新庄
    { id: 'sj-matsuri', region: 'shinjo', s: 45200, name: '新庄まつり', art: 'yatai',
      short: '豪華な山車が練り歩く、ユネスコ無形文化遺産',
      body: '8月24日から26日、歌舞伎や物語の名場面を再現した約20台の山車（やたい）が、囃子にあわせて街を進みます。夜の宵まつりは灯りに浮かぶ山車が圧巻。江戸時代の宝暦6年（1756年）に始まったと伝わります。',
      info: [['場所', '新庄市の中心部（国道13号の西）'], ['時期', '8月24日〜26日']] },
    { id: 'sj-park', region: 'shinjo', s: 46300, name: '最上公園（新庄城跡）', art: 'castle', opt: { type: 'moat', sakura: true },
      short: '戸沢氏の城跡。お堀に映る桜',
      body: '新庄藩主・戸沢氏の居城だった新庄城の跡。お堀と石垣が残り、春は桜の名所になります。園内には戸沢神社があり、新庄まつりの舞台の一つにもなります。',
      info: [['場所', '新庄市堀端町'], ['見ごろ', '桜は4月下旬']] },
    { id: 'sj-gensan', region: 'shinjo', s: 47250, name: 'エコロジーガーデン 原蚕の杜', art: 'silk',
      short: '昭和初期の蚕糸試験場。木立の中の木造建築',
      body: '昭和の初めに建てられた、旧蚕糸試験場新庄支場の建物群。大きな木立の中に洋風の木造建築が並び、国の登録有形文化財になっています。産直市やカフェも開かれます。',
      info: [['場所', '新庄市十日町'], ['ひとこと', '道の駅として、休憩にも立ち寄れます']] },
    // ---------------- 金山
    { id: 'kn-machi', region: 'kaneyama', s: 50300, name: '金山の街並み', art: 'kanetown',
      short: '白壁と切妻屋根。100年かけて育てる景観',
      body: '白い土壁に杉板、黒い切妻屋根の「金山型住宅」が並びます。町は「街並み景観づくり100年運動」を続けてきました。明治時代に訪れた英国の旅行家イザベラ・バードも、この地の美しさを書き残しています。',
      info: [['場所', '金山町の中心部'], ['ひとこと', '蔵を生かした「蔵史館」や、屋根付きの「きごころ橋」も見どころ']] },
    { id: 'kn-ozeki', region: 'kaneyama', s: 50900, name: '大堰と鯉', art: 'koi',
      short: '街なかの水路を、色とりどりの鯉が泳ぐ',
      body: '江戸時代に造られた農業用の水路「大堰」。石積みの水路が白壁の街並みに沿って流れ、春から秋にかけて錦鯉が放されます。水音と鯉の姿が、散策の楽しみです。',
      info: [['場所', '金山町の中心部'], ['見ごろ', '鯉は春〜秋（冬は池で越冬）']] },
    { id: 'kn-sugi', region: 'kaneyama', s: 51700, name: '金山杉の美林', art: 'cedar',
      short: '樹齢300年近い大杉がそびえる',
      body: '金山町は、まっすぐで木目の美しい「金山杉」の産地。「大美輪の大杉」と呼ばれる林には、江戸時代に植えられた100本あまりの大杉が立ち並び、見上げるほどの高さに圧倒されます。',
      info: [['場所', '金山町有屋'], ['ひとこと', '街並みの家々にも、金山杉がふんだんに使われています']] }
  ];

  // ================================================================ イラスト（基準 320×200）
  function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const K = {
    sky: function (g, top, bot, h) { const gr = g.createLinearGradient(0, 0, 0, h || 200); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, 320, 200); },
    sun: function (g, x, y, r, c) { const gr = g.createRadialGradient(x, y, 0, x, y, r * 3); gr.addColorStop(0, c || 'rgba(255,250,220,0.95)'); gr.addColorStop(0.33, 'rgba(255,245,200,0.5)'); gr.addColorStop(1, 'rgba(255,245,200,0)'); g.fillStyle = gr; g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6); },
    cloud: function (g, x, y, s, a) { g.fillStyle = 'rgba(255,255,255,' + (a || 0.85) + ')'; [[0, 0, 16], [14, -5, 13], [28, 0, 15], [14, 5, 14], [-12, 4, 10]].forEach(function (c) { g.beginPath(); g.ellipse(x + c[0] * s, y + c[1] * s, c[2] * s, c[2] * s * 0.62, 0, 0, 6.283); g.fill(); }); },
    hills: function (g, y, amp, col, seed, snow) {
      const r = rng(seed); g.fillStyle = col; g.beginPath(); g.moveTo(0, 200); let pts = [];
      for (let x = 0; x <= 320; x += 20) { const yy = y - amp * (0.3 + 0.7 * r()); pts.push([x, yy]); g.lineTo(x, yy); }
      g.lineTo(320, 200); g.closePath(); g.fill();
      if (snow) { g.fillStyle = snow; pts.forEach(function (p, i) { if (i === 0 || i === pts.length - 1) return; if (p[1] < pts[i - 1][1] && p[1] < pts[i + 1][1]) { g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] - 9, p[1] + 9); g.lineTo(p[0] - 3, p[1] + 7); g.lineTo(p[0] + 2, p[1] + 11); g.lineTo(p[0] + 9, p[1] + 9); g.closePath(); g.fill(); } }); }
    },
    ground: function (g, y, col) { g.fillStyle = col; g.fillRect(0, y, 320, 200 - y); },
    water: function (g, y, h, top, bot) { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, y, 320, h); g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1; const r = rng(Math.round(y * 7 + h)); for (let i = 0; i < 16; i++) { const x = r() * 320, yy = y + 3 + r() * (h - 6), l = 8 + r() * 22; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + l, yy); g.stroke(); } },
    cedar: function (g, x, y, h, col) { g.fillStyle = '#5a4030'; g.fillRect(x - h * 0.035, y - h * 0.16, h * 0.07, h * 0.16); g.fillStyle = col || '#2f6a3c'; for (let i = 0; i < 3; i++) { const yy = y - h * 0.12 - i * h * 0.27, w = h * (0.26 - i * 0.055); g.beginPath(); g.moveTo(x, yy - h * 0.36); g.lineTo(x - w, yy); g.lineTo(x + w, yy); g.closePath(); g.fill(); } },
    tree: function (g, x, y, r, col, trunk) { g.fillStyle = trunk || '#6a4a34'; g.fillRect(x - r * 0.12, y - r * 0.9, r * 0.24, r * 0.9); g.fillStyle = col; [[0, -1.5, 1], [-0.7, -1.1, 0.75], [0.7, -1.1, 0.75], [0, -0.9, 0.8]].forEach(function (c) { g.beginPath(); g.arc(x + c[0] * r, y + c[1] * r, c[2] * r, 0, 6.283); g.fill(); }); },
    sakura: function (g, x, y, r) { K.tree(g, x, y, r, '#f6bfd2', '#5a4034'); g.fillStyle = '#fde2ec'; [[-0.3, -1.7, 0.45], [0.5, -1.3, 0.4], [-0.7, -1.0, 0.35]].forEach(function (c) { g.beginPath(); g.arc(x + c[0] * r, y + c[1] * r, c[2] * r, 0, 6.283); g.fill(); }); },
    petals: function (g, n, seed, col) { const r = rng(seed); g.fillStyle = col || 'rgba(255,225,235,0.9)'; for (let i = 0; i < n; i++) { g.beginPath(); g.ellipse(r() * 320, r() * 200, 2.2, 1.2, r() * 3, 0, 6.283); g.fill(); } },
    // 入母屋・切妻の屋根（x 中心, y 軒, w 幅, h 高さ）
    roof: function (g, x, y, w, h, col, curve) { g.fillStyle = col; g.beginPath(); g.moveTo(x - w / 2 - (curve ? 5 : 2), y); g.quadraticCurveTo(x - w / 4, y - h * (curve ? 0.55 : 0.5), x - w * 0.12, y - h); g.lineTo(x + w * 0.12, y - h); g.quadraticCurveTo(x + w / 4, y - h * (curve ? 0.55 : 0.5), x + w / 2 + (curve ? 5 : 2), y); g.closePath(); g.fill(); },
    gable: function (g, x, y, w, h, col) { g.fillStyle = col; g.beginPath(); g.moveTo(x - w / 2 - 3, y); g.lineTo(x, y - h); g.lineTo(x + w / 2 + 3, y); g.closePath(); g.fill(); },
    torii: function (g, x, y, w, h, col) { g.fillStyle = col; const t = Math.max(2, w * 0.07); g.fillRect(x - w * 0.36, y - h, t, h); g.fillRect(x + w * 0.36 - t, y - h, t, h); g.fillRect(x - w * 0.5, y - h - t * 0.2, w, t * 1.1); g.fillRect(x - w * 0.42, y - h * 0.8, w * 0.84, t * 0.8); g.beginPath(); g.moveTo(x - w * 0.56, y - h - t * 1.3); g.quadraticCurveTo(x, y - h - t * 0.5, x + w * 0.56, y - h - t * 1.3); g.lineTo(x + w * 0.54, y - h - t * 0.2); g.lineTo(x - w * 0.54, y - h - t * 0.2); g.closePath(); g.fill(); },
    steam: function (g, x, y, s) { g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 3 * s; g.lineCap = 'round'; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x + i * 7 * s, y); g.bezierCurveTo(x + i * 7 * s - 6 * s, y - 8 * s, x + i * 7 * s + 6 * s, y - 14 * s, x + i * 7 * s, y - 22 * s); g.stroke(); } },
    person: function (g, x, y, h, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y - h * 0.86, h * 0.14, 0, 6.283); g.fill(); g.fillRect(x - h * 0.13, y - h * 0.72, h * 0.26, h * 0.72); },
    rr: function (g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); },
    stone: function (g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(0,0,0,0.14)'; g.lineWidth = 1; for (let yy = y + 6; yy < y + h; yy += 7) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); } const r = rng(Math.round(x + y)); for (let yy = y; yy < y + h; yy += 7) for (let xx = x + r() * 12; xx < x + w; xx += 10 + r() * 8) { g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, Math.min(y + h, yy + 7)); g.stroke(); } }
  };

  const ART = {
    shrine: function (g, o) {
      K.sky(g, '#7fb6e6', '#e4f1f6'); K.cloud(g, 60, 34, 1); K.cloud(g, 230, 26, 0.8);
      K.hills(g, 120, 30, '#7aa27a', 5);
      for (let i = 0; i < 9; i++) K.cedar(g, 14 + i * 38, 130 + (i % 2) * 4, 86 + (i % 3) * 14, i % 2 ? '#2c6238' : '#356f40');
      K.ground(g, 128, '#b9c49a');
      g.fillStyle = '#d9d2c0'; g.beginPath(); g.moveTo(130, 200); g.lineTo(190, 200); g.lineTo(172, 128); g.lineTo(148, 128); g.closePath(); g.fill();   // 参道
      // 拝殿
      g.fillStyle = '#efe6d2'; g.fillRect(118, 96, 84, 34); g.fillStyle = '#7a4a34'; for (let x = 122; x < 200; x += 13) g.fillRect(x, 96, 3, 34); g.fillStyle = '#4a3226'; g.fillRect(150, 106, 20, 24);
      K.roof(g, 160, 98, 104, o.kaya ? 40 : 30, o.kaya ? '#8a7450' : '#3f6b62', true);
      if (o.kaya) { g.fillStyle = '#6f5c3e'; g.fillRect(146, 56, 28, 5); }
      g.fillStyle = '#c9a54a'; g.fillRect(157, 70, 6, 3);
      K.torii(g, 160, 176, 70, 50, o.kaya ? '#8e8a82' : '#c8402c');
      if (o.moat) { K.water(g, 178, 22, '#6f9fb8', '#4f7f9a'); g.fillStyle = '#c8402c'; g.fillRect(120, 172, 80, 6); g.fillRect(124, 166, 3, 10); g.fillRect(193, 166, 3, 10); g.fillStyle = '#d9d2c0'; g.fillRect(138, 178, 44, 22); }
      if (o.sakura) { K.sakura(g, 40, 176, 22); K.sakura(g, 284, 172, 24); K.sakura(g, 92, 150, 13); K.sakura(g, 232, 150, 14); K.petals(g, 26, 9); }
      if (o.rabbit) { g.fillStyle = '#fff'; [[262, 170], [276, 176], [248, 178]].forEach(function (p) { g.beginPath(); g.ellipse(p[0], p[1], 7, 5, 0, 0, 6.283); g.fill(); g.beginPath(); g.ellipse(p[0] + 5, p[1] - 8, 1.8, 5, 0.2, 0, 6.283); g.fill(); g.beginPath(); g.ellipse(p[0] + 2, p[1] - 8, 1.8, 5, -0.2, 0, 6.283); g.fill(); g.fillStyle = '#c8402c'; g.fillRect(p[0] + 5, p[1] - 2, 1.6, 1.6); g.fillStyle = '#fff'; }); }
      if (o.sword) { g.strokeStyle = '#d8dde2'; g.lineWidth = 3; g.beginPath(); g.moveTo(40, 186); g.quadraticCurveTo(70, 160, 96, 150); g.stroke(); g.strokeStyle = '#3a2a22'; g.lineWidth = 5; g.beginPath(); g.moveTo(30, 194); g.lineTo(42, 184); g.stroke(); g.fillStyle = '#c9a54a'; g.fillRect(39, 181, 6, 6); }
    },
    mausoleum: function (g) {
      K.sky(g, '#9cc3e0', '#e9f2ee'); K.ground(g, 150, '#8fa878');
      for (let i = 0; i < 12; i++) K.cedar(g, 8 + i * 28, 150, 150 + (i % 3) * 18, i % 2 ? '#24583a' : '#2f6842');
      g.fillStyle = 'rgba(255,255,230,0.18)'; g.beginPath(); g.moveTo(120, 0); g.lineTo(170, 0); g.lineTo(230, 200); g.lineTo(90, 200); g.closePath(); g.fill();   // 木もれ日
      g.fillStyle = '#cfc7b4'; g.fillRect(0, 168, 320, 32); g.fillStyle = '#bdb5a2'; g.fillRect(130, 150, 60, 50);
      for (let i = 0; i < 5; i++) { const x = 36 + i * 62, w = i === 2 ? 46 : 36, y = i === 2 ? 150 : 156; g.fillStyle = '#e9e2d0'; g.fillRect(x - w / 2 + 4, y - 22, w - 8, 22); g.fillStyle = '#5a4634'; g.fillRect(x - 4, y - 16, 8, 16); K.roof(g, x, y - 22, w, i === 2 ? 22 : 17, '#4f5a56', true); }
      g.fillStyle = '#8e8a82'; for (let i = 0; i < 6; i++) { g.fillRect(20 + i * 56, 176, 5, 16); g.fillRect(17 + i * 56, 172, 11, 5); }
    },
    onsen: function (g, o) {
      const river = o.style === 'river';
      if (river) {
        K.sky(g, '#2c3a66', '#e79a6a'); K.hills(g, 90, 46, '#3d4a5c', 3);
        // 両岸の木造旅館
        const inn = function (x, w, hh, base) { g.fillStyle = '#4a3528'; g.fillRect(x, base - hh, w, hh); for (let f = 0; f < Math.floor(hh / 20); f++) { g.fillStyle = '#ffd98a'; for (let xx = x + 5; xx < x + w - 6; xx += 11) g.fillRect(xx, base - hh + 6 + f * 20, 7, 10); g.fillStyle = '#2e2018'; g.fillRect(x - 2, base - hh + 18 + f * 20, w + 4, 2.5); } K.roof(g, x + w / 2, base - hh, w + 6, 14, '#26303a', true); };
        inn(4, 62, 82, 140); inn(70, 50, 62, 140); inn(204, 52, 68, 140); inn(258, 60, 86, 140);
        K.water(g, 140, 60, '#35507a', '#1f2f52');
        g.fillStyle = 'rgba(255,217,138,0.35)'; for (let i = 0; i < 9; i++) g.fillRect(18 + i * 34, 146, 6, 40);
        g.fillStyle = '#c8402c'; g.fillRect(110, 136, 100, 6); g.strokeStyle = '#c8402c'; g.lineWidth = 2; g.beginPath(); g.moveTo(110, 136); g.quadraticCurveTo(160, 120, 210, 136); g.stroke();
        [[120, 132], [200, 132], [66, 138], [254, 138]].forEach(function (p) { g.fillStyle = '#2a2a2a'; g.fillRect(p[0] - 1, p[1] - 18, 2, 18); K.sun(g, p[0], p[1] - 20, 5, 'rgba(255,225,150,0.95)'); });
        g.fillStyle = '#fff'; const r = rng(4); for (let i = 0; i < 40; i++) { g.globalAlpha = 0.7; g.beginPath(); g.arc(r() * 320, r() * 200, 1.3, 0, 6.283); g.fill(); } g.globalAlpha = 1;
        K.steam(g, 160, 170, 1);
      } else {
        K.sky(g, '#86bbe8', '#f1ecd8'); K.cloud(g, 250, 30, 0.9); K.hills(g, 110, 34, '#7ea27c', 8);
        if (o.cherry) for (let i = 0; i < 6; i++) { K.tree(g, 20 + i * 56, 118, 11, '#4f8a3c'); g.fillStyle = '#d8322b'; g.beginPath(); g.arc(18 + i * 56, 106, 2, 0, 6.283); g.arc(26 + i * 56, 102, 2, 0, 6.283); g.fill(); }
        K.ground(g, 118, '#c9c4b2');
        const inn = function (x, w, hh, col) { g.fillStyle = col; g.fillRect(x, 150 - hh, w, hh); g.fillStyle = '#5a4634'; for (let f = 0; f < Math.floor(hh / 18); f++) for (let xx = x + 5; xx < x + w - 7; xx += 12) g.fillRect(xx, 150 - hh + 6 + f * 18, 8, 9); K.roof(g, x + w / 2, 150 - hh, w + 8, 16, '#4a4f58', true); };
        if (o.grape) { g.fillStyle = '#6fa04e'; g.beginPath(); g.moveTo(0, 118); g.quadraticCurveTo(90, 40, 200, 118); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1.5; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(30 + i * 8, 112 - i * 9); g.quadraticCurveTo(96, 96 - i * 11, 170 - i * 8, 112 - i * 9); g.stroke(); } }
        const v = o.v | 0;
        if (v === 1) { inn(8, 120, 40, '#7a5a40'); inn(140, 70, 66, '#8a6848'); inn(220, 96, 44, '#7a5a40'); }
        else if (v === 2) { inn(10, 64, 78, '#e9e6de'); inn(84, 70, 52, '#d9d2c2'); inn(164, 60, 86, '#e9e6de'); inn(232, 80, 58, '#d9d2c2'); }
        else if (v === 3) { inn(20, 96, 46, '#efe6d2'); inn(128, 64, 58, '#c9a888'); inn(204, 104, 48, '#efe6d2'); }
        else { inn(16, 78, 54, '#efe6d2'); inn(110, 96, 72, '#e6d8be'); inn(226, 80, 50, '#efe6d2'); }
        g.fillStyle = '#b9b2a0'; g.fillRect(0, 150, 320, 50);
        // 足湯
        g.fillStyle = '#8a6a4a'; K.rr(g, 96, 160, 128, 30, 6); g.fill(); g.fillStyle = '#7fc0d0'; K.rr(g, 102, 165, 116, 20, 4); g.fill();
        K.steam(g, 130, 162, 1); K.steam(g, 190, 162, 0.9); K.steam(g, 60, 96, 0.8); K.steam(g, 262, 100, 0.8);
        K.person(g, 114, 168, 22, '#c8402c'); K.person(g, 206, 168, 22, '#2f6fc0');
        if (o.grape) { g.fillStyle = '#6b3a86'; [[30, 172], [44, 180], [270, 176], [286, 184]].forEach(function (p) { for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(p[0] + (k % 3) * 5 - 5, p[1] + Math.floor(k / 3) * 5 + (k === 5 ? 3 : 0), 3.2, 0, 6.283); g.fill(); } }); g.fillStyle = '#4f8a3c'; [[30, 166], [270, 170]].forEach(function (p) { g.beginPath(); g.ellipse(p[0] + 6, p[1], 8, 4, -0.4, 0, 6.283); g.fill(); }); }
        if (o.cherry) { [[34, 180], [282, 182]].forEach(function (c) { g.strokeStyle = '#7a9a3c'; g.lineWidth = 2; g.beginPath(); g.moveTo(c[0], c[1] - 22); g.lineTo(c[0] - 7, c[1] - 6); g.moveTo(c[0], c[1] - 22); g.lineTo(c[0] + 8, c[1] - 3); g.stroke(); g.fillStyle = '#d8232b'; g.beginPath(); g.arc(c[0] - 7, c[1], 7, 0, 6.283); g.arc(c[0] + 8, c[1] + 3, 7, 0, 6.283); g.fill(); g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(c[0] - 9, c[1] - 2, 1.8, 0, 6.283); g.arc(c[0] + 6, c[1] + 1, 1.8, 0, 6.283); g.fill(); }); }
        if (o.koma) { g.fillStyle = '#e8c27a'; g.beginPath(); g.moveTo(262, 196); g.lineTo(300, 196); g.lineTo(296, 160); g.lineTo(281, 150); g.lineTo(266, 160); g.closePath(); g.fill(); g.fillStyle = '#222'; g.font = '900 17px sans-serif'; g.textAlign = 'center'; g.fillText('王', 281, 178); g.fillText('将', 281, 194); }
        if (o.crane) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(276, 170, 13, 8, -0.2, 0, 6.283); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(284, 166); g.quadraticCurveTo(292, 150, 288, 140); g.stroke(); g.fillStyle = '#c8402c'; g.beginPath(); g.arc(288, 139, 3, 0, 6.283); g.fill(); g.strokeStyle = '#333'; g.lineWidth = 2; g.beginPath(); g.moveTo(272, 176); g.lineTo(270, 196); g.moveTo(280, 176); g.lineTo(282, 196); g.stroke(); g.fillStyle = '#222'; g.beginPath(); g.moveTo(264, 168); g.lineTo(254, 174); g.lineTo(266, 174); g.fill(); }
        if (o.fireflies) { g.fillStyle = 'rgba(20,30,60,0.42)'; g.fillRect(0, 0, 320, 200); const r = rng(12); for (let i = 0; i < 22; i++) K.sun(g, r() * 320, 60 + r() * 130, 2.2, 'rgba(210,255,120,0.95)'); }
      }
    },
    temple: function (g, o) {
      K.sky(g, '#8cbfe8', '#eaf3ee'); K.cloud(g, 70, 30, 0.9);
      K.hills(g, 120, 40, '#6f9a70', 15);
      for (let i = 0; i < 10; i++) K.cedar(g, 6 + i * 35, 140 + (i % 2) * 6, 110 + (i % 3) * 16, i % 2 ? '#2a5e38' : '#356f42');
      K.ground(g, 140, '#a9b88a');
      // 石段
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#cfc8b6' : '#bdb6a4'; g.fillRect(132 - i * 4, 136 + i * 8, 56 + i * 8, 8); }
      // 本堂
      const wall = o.red ? '#b8402c' : '#e9dfc8';
      g.fillStyle = wall; g.fillRect(112, 88, 96, 48); g.fillStyle = '#5a3e2c'; for (let x = 116; x < 206; x += 15) g.fillRect(x, 88, 3.5, 48); g.fillStyle = '#3a2a20'; g.fillRect(146, 104, 28, 32);
      K.roof(g, 160, 92, 124, o.kaya ? 46 : 38, o.kaya ? '#8a7450' : (o.red ? '#3a4650' : '#4a5a54'), true);
      g.fillStyle = '#c9a54a'; g.beginPath(); g.arc(160, o.kaya ? 44 : 52, 3.5, 0, 6.283); g.fill();
      // 石灯籠
      [[98, 176], [222, 176]].forEach(function (p) { g.fillStyle = '#9a968c'; g.fillRect(p[0] - 3, p[1] - 22, 6, 22); g.fillRect(p[0] - 8, p[1] - 30, 16, 8); g.beginPath(); g.moveTo(p[0] - 11, p[1] - 30); g.lineTo(p[0], p[1] - 38); g.lineTo(p[0] + 11, p[1] - 30); g.fill(); g.fillStyle = '#ffe2a0'; g.fillRect(p[0] - 3, p[1] - 28, 6, 5); });
      if (o.red) { g.fillStyle = '#c8402c'; for (let i = 0; i < 5; i++) { g.fillRect(40 + i * 12, 170, 2, 24); g.fillRect(40 + i * 12, 170, 8, 9); } }
    },
    pagoda: function (g) {
      K.sky(g, '#86bce8', '#f0f0dc'); K.cloud(g, 236, 34, 1); K.hills(g, 118, 36, '#6f9a6c', 21);
      for (let i = 0; i < 7; i++) K.cedar(g, 190 + i * 22, 136, 86 + (i % 3) * 14, i % 2 ? '#2a5e38' : '#356f42');
      K.ground(g, 132, '#9cbf78'); K.water(g, 156, 44, '#7fb0c8', '#5f90aa');
      // 三重塔
      const x = 110;
      g.fillStyle = '#7a5a40'; g.fillRect(x - 1.5, 18, 3, 24);
      for (let i = 0; i < 3; i++) { const y = 62 + i * 30, w = 44 + i * 10; g.fillStyle = '#a04a32'; g.fillRect(x - w * 0.3, y, w * 0.6, 22); g.fillStyle = '#efe6d2'; g.fillRect(x - w * 0.3 + 4, y + 5, w * 0.6 - 8, 10); K.roof(g, x, y + 2, w + 14, 15, '#4a5650', true); }
      g.fillStyle = '#9a968c'; g.fillRect(x - 28, 146, 56, 8);
      g.fillStyle = 'rgba(160,74,50,0.3)'; g.fillRect(x - 12, 158, 24, 34);
      // 舞楽殿（茅葺き）
      g.fillStyle = '#7a5a40'; for (let xx = 34; xx <= 70; xx += 12) g.fillRect(xx - 46, 128, 3, 20); g.fillStyle = '#efe6d2'; g.fillRect(-12, 144, 40, 6);
      K.sakura(g, 46, 150, 16); K.sakura(g, 176, 148, 15);
    },
    house: function (g, o) {
      K.sky(g, '#8fc1ea', '#f3efdc'); K.cloud(g, 60, 30, 0.9); K.cloud(g, 250, 40, 0.7); K.hills(g, 116, 30, '#7ca47a', 31); K.ground(g, 130, '#a7c486');
      if (o.kind === 'hirosuke') {
        // 茅葺きの生家と、赤おに・青おに
        g.fillStyle = '#efe6d2'; g.fillRect(40, 104, 130, 44); g.fillStyle = '#5a4634'; g.fillRect(52, 118, 22, 30); g.fillRect(96, 116, 26, 16); g.fillRect(134, 116, 22, 16);
        K.roof(g, 105, 108, 154, 52, '#8a7450'); g.fillStyle = '#6f5c3e'; g.fillRect(84, 54, 42, 6);
        const oni = function (x, c) { g.fillStyle = c; g.beginPath(); g.arc(x, 150, 15, 0, 6.283); g.fill(); g.fillRect(x - 12, 160, 24, 30); g.fillStyle = '#f2c230'; g.beginPath(); g.moveTo(x - 8, 138); g.lineTo(x - 5, 126); g.lineTo(x - 2, 138); g.fill(); g.beginPath(); g.moveTo(x + 2, 138); g.lineTo(x + 5, 126); g.lineTo(x + 8, 138); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 5, 148, 3.2, 0, 6.283); g.arc(x + 5, 148, 3.2, 0, 6.283); g.fill(); g.fillStyle = '#222'; g.beginPath(); g.arc(x - 5, 149, 1.5, 0, 6.283); g.arc(x + 5, 149, 1.5, 0, 6.283); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, 154, 5, 0.2, 2.9); g.stroke(); g.fillStyle = '#e8b02a'; g.fillRect(x - 12, 176, 24, 8); };
        oni(222, '#d8483a'); oni(270, '#3f7fd0');
      } else if (o.kind === 'mokichi') {
        g.fillStyle = '#e9e6de'; g.fillRect(60, 96, 170, 52); g.fillStyle = '#6a7a84'; g.fillRect(60, 90, 170, 8); g.fillStyle = '#44566a'; for (let x = 72; x < 220; x += 26) g.fillRect(x, 108, 16, 28); g.fillStyle = '#5a4634'; g.fillRect(134, 116, 22, 32);
        // 松と歌碑
        g.fillStyle = '#5a4030'; g.fillRect(262, 96, 6, 54); g.fillStyle = '#2f6842'; [[265, 88, 26, 9], [252, 104, 20, 7], [280, 110, 20, 7]].forEach(function (c) { g.beginPath(); g.ellipse(c[0], c[1], c[2], c[3], 0, 0, 6.283); g.fill(); });
        g.fillStyle = '#8e8a82'; K.rr(g, 14, 128, 34, 50, 6); g.fill(); g.fillStyle = '#3a3a3a'; for (let i = 0; i < 3; i++) g.fillRect(22 + i * 8, 136, 2.5, 32);
        K.hills(g, 62, 26, 'rgba(255,255,255,0)', 2);
      } else {
        // 蔵造りの商家と紅花
        g.fillStyle = '#f2efe6'; g.fillRect(70, 86, 150, 64); g.fillStyle = '#2f2a28'; g.fillRect(70, 126, 150, 24); g.fillStyle = '#3a3230'; g.fillRect(96, 100, 20, 22); g.fillRect(174, 100, 20, 22); g.fillStyle = '#5a4634'; g.fillRect(132, 112, 26, 38);
        K.gable(g, 145, 88, 160, 34, '#2e2a28');
        const r = rng(7); for (let i = 0; i < 46; i++) { const x = r() * 320, y = 160 + r() * 36; g.strokeStyle = '#4f8a3c'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y + 10); g.lineTo(x, y); g.stroke(); g.fillStyle = r() < 0.7 ? '#f2a51c' : '#e2501c'; g.beginPath(); g.arc(x, y, 3.2, 0, 6.283); g.fill(); }
      }
    },
    sakurahill: function (g) {
      K.sky(g, '#86bce8', '#f6e9ee'); K.cloud(g, 250, 30, 0.9); K.hills(g, 110, 30, '#8fb088', 41);
      g.fillStyle = '#f2b6cc'; g.beginPath(); g.moveTo(0, 150); g.quadraticCurveTo(160, 40, 320, 150); g.lineTo(320, 200); g.lineTo(0, 200); g.fill();
      const r = rng(3); for (let i = 0; i < 46; i++) { const x = r() * 320, t = Math.abs(x - 160) / 160, y = 62 + t * t * 86 + r() * 60; g.fillStyle = ['#fbd3e0', '#f6bfd2', '#fde6ee', '#f0a8c2'][i % 4]; g.beginPath(); g.arc(x, y, 9 + r() * 9, 0, 6.283); g.fill(); }
      g.fillStyle = '#d9d2c0'; g.beginPath(); g.moveTo(136, 200); g.lineTo(184, 200); g.lineTo(170, 120); g.lineTo(150, 120); g.fill();
      K.torii(g, 160, 168, 92, 72, '#a8a49a');
      K.petals(g, 40, 6);
    },
    sky: function (g) {
      K.sky(g, '#4f9ee0', '#dff0f4'); K.cloud(g, 60, 44, 1.1); K.cloud(g, 250, 26, 0.8);
      K.hills(g, 126, 30, '#8fb09a', 51);
      K.water(g, 128, 22, '#8fc0d8', '#6fa3be'); K.ground(g, 148, '#b8cf8a');
      // ぶどう畑の斜面
      g.fillStyle = '#5f9a44'; g.beginPath(); g.moveTo(0, 96); g.lineTo(150, 170); g.lineTo(0, 200); g.fill(); g.fillStyle = '#6fae4e'; g.beginPath(); g.moveTo(0, 200); g.lineTo(150, 170); g.lineTo(320, 200); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(0, 108 + i * 10); g.lineTo(18 + i * 15, 118 + i * 8.4); g.stroke(); }
      g.fillStyle = '#6b3a86'; const r = rng(9); for (let i = 0; i < 20; i++) { const x = 20 + r() * 280, y = 178 + r() * 18; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + (k % 3) * 3 - 3, y + Math.floor(k / 3) * 3, 2, 0, 6.283); g.fill(); } }
      const para = function (x, y, s, c) { g.fillStyle = c; g.beginPath(); g.moveTo(x - 22 * s, y); g.quadraticCurveTo(x, y - 20 * s, x + 22 * s, y); g.quadraticCurveTo(x, y - 8 * s, x - 22 * s, y); g.fill(); g.strokeStyle = 'rgba(40,40,40,0.6)'; g.lineWidth = 0.8; [-18, -6, 6, 18].forEach(function (d) { g.beginPath(); g.moveTo(x + d * s, y - 2 * s); g.lineTo(x, y + 22 * s); g.stroke(); }); g.fillStyle = '#30343a'; g.fillRect(x - 2 * s, y + 20 * s, 4 * s, 7 * s); };
      para(200, 70, 1.2, '#d8322b'); para(118, 46, 0.8, '#f2c230'); para(270, 96, 0.7, '#2f7fd0');
    },
    castle: function (g, o) {
      K.sky(g, '#7fb6e6', '#eef3e6'); K.cloud(g, 64, 30, 1); K.hills(g, 110, 44, '#8aa7b4', 61, '#f4f8fb');
      if (o.type === 'tenshu') {
        K.ground(g, 150, '#9cbf78'); K.stone(g, 96, 124, 128, 40, '#b0a894');
        const lvl = [[104, 98, 28], [84, 74, 26], [60, 52, 24]];
        lvl.forEach(function (l, i) { g.fillStyle = '#f4f1ea'; g.fillRect(160 - l[0] / 2, l[1], l[0], l[2]); g.fillStyle = '#3a3a3a'; for (let x = 160 - l[0] / 2 + 8; x < 160 + l[0] / 2 - 8; x += 14) g.fillRect(x, l[1] + 9, 5, 8); K.roof(g, 160, l[1] + 3, l[0] + 22, 15, '#4a5560', true); });
        K.gable(g, 160, 54, 52, 20, '#4a5560'); g.fillStyle = '#c9a54a'; g.fillRect(146, 32, 4, 5); g.fillRect(170, 32, 4, 5);
      } else if (o.type === 'gate') {
        K.water(g, 150, 50, '#7aa9c2', '#567f9a'); K.stone(g, 0, 118, 320, 34, '#b0a894');
        g.fillStyle = '#f4f1ea'; g.fillRect(96, 78, 128, 42); g.fillStyle = '#3a3230'; g.fillRect(96, 104, 128, 16); g.fillStyle = '#5a4634'; g.fillRect(140, 108, 40, 44); g.fillStyle = '#3a3a3a'; for (let x = 106; x < 216; x += 18) g.fillRect(x, 88, 8, 9);
        K.roof(g, 160, 80, 154, 26, '#4a5560', true);
        g.fillStyle = '#8a6a4a'; g.fillRect(132, 148, 56, 8); for (let x = 134; x < 188; x += 9) g.fillRect(x, 140, 2.5, 9); g.fillRect(132, 140, 56, 2.5);
        g.fillStyle = '#f4f1ea'; g.fillRect(0, 100, 96, 18); g.fillRect(224, 100, 96, 18); g.fillStyle = '#4a5560'; g.fillRect(0, 96, 96, 5); g.fillRect(224, 96, 96, 5);
      } else {
        K.ground(g, 120, '#9cbf78'); K.stone(g, 0, 122, 320, 34, '#b0a894'); K.water(g, 156, 44, '#7aa9c2', '#567f9a');
        g.fillStyle = '#c8402c'; g.fillRect(124, 150, 72, 6); g.strokeStyle = '#c8402c'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(124, 150); g.quadraticCurveTo(160, 136, 196, 150); g.stroke();
        g.fillStyle = '#efe6d2'; g.fillRect(138, 92, 44, 28); K.roof(g, 160, 94, 62, 20, '#4a5a54', true); K.torii(g, 160, 122, 30, 22, '#c8402c');
      }
      if (o.sakura) { [[30, 150, 22], [70, 142, 17], [252, 142, 18], [294, 150, 23]].forEach(function (p) { K.sakura(g, p[0], p[1] - (o.type === 'tenshu' ? -6 : 26), p[2]); }); K.petals(g, 34, 13); }
    },
    posttown: function (g) {
      K.sky(g, '#8cc0e8', '#f1efda'); K.cloud(g, 240, 30, 0.9); K.hills(g, 112, 50, '#6f9a6c', 71); K.ground(g, 128, '#a9c486');
      const kaya = function (x, w) { g.fillStyle = '#efe6d2'; g.fillRect(x - w / 2 + 6, 104, w - 12, 30); g.fillStyle = '#5a4634'; g.fillRect(x - 8, 114, 16, 20); g.fillRect(x - w / 2 + 12, 112, 12, 10); K.roof(g, x, 108, w, 44, '#8a7450'); g.fillStyle = '#6f5c3e'; g.fillRect(x - w * 0.14, 62, w * 0.28, 5); };
      kaya(64, 104); kaya(250, 112);
      K.water(g, 150, 50, '#86b6cc', '#6496b0');
      // 石のアーチ橋
      g.fillStyle = '#a8a294'; g.beginPath(); g.moveTo(92, 150); g.lineTo(228, 150); g.lineTo(228, 176); g.quadraticCurveTo(160, 96, 92, 176); g.closePath(); g.fill();
      g.fillStyle = '#8e887a'; g.fillRect(88, 140, 144, 8); g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1; for (let i = 0; i < 9; i++) { const a = Math.PI * (0.12 + i * 0.095); g.beginPath(); g.moveTo(160 - Math.cos(a) * 62, 176 - Math.sin(a) * 34); g.lineTo(160 - Math.cos(a) * 70, 176 - Math.sin(a) * 40); g.stroke(); }
      K.person(g, 150, 140, 16, '#3a4a6a'); g.fillStyle = '#e8d28a'; g.beginPath(); g.moveTo(141, 126); g.lineTo(159, 126); g.lineTo(150, 120); g.fill();
    },
    juhyo: function (g) {
      K.sky(g, '#3f86d6', '#cfe6f6'); K.sun(g, 262, 40, 12);
      K.hills(g, 104, 30, '#dfeaf2', 81); g.fillStyle = '#f6fafd'; g.beginPath(); g.moveTo(0, 130); g.quadraticCurveTo(160, 90, 320, 136); g.lineTo(320, 200); g.lineTo(0, 200); g.fill();
      const monster = function (x, y, s) { g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x - 16 * s, y); g.quadraticCurveTo(x - 20 * s, y - 26 * s, x - 9 * s, y - 34 * s); g.quadraticCurveTo(x - 12 * s, y - 50 * s, x, y - 58 * s); g.quadraticCurveTo(x + 11 * s, y - 48 * s, x + 8 * s, y - 34 * s); g.quadraticCurveTo(x + 21 * s, y - 24 * s, x + 16 * s, y); g.closePath(); g.fill(); g.fillStyle = 'rgba(150,190,225,0.55)'; g.beginPath(); g.moveTo(x + 2 * s, y); g.quadraticCurveTo(x + 12 * s, y - 24 * s, x + 3 * s, y - 52 * s); g.quadraticCurveTo(x + 11 * s, y - 46 * s, x + 8 * s, y - 34 * s); g.quadraticCurveTo(x + 21 * s, y - 24 * s, x + 16 * s, y); g.fill(); };
      [[40, 150, 0.7], [96, 142, 0.6], [150, 150, 0.8], [210, 140, 0.6], [270, 152, 0.75], [62, 196, 1.3], [158, 198, 1.5], [258, 196, 1.25]].forEach(function (m) { monster(m[0], m[1], m[2]); });
      // ロープウェイ
      g.strokeStyle = '#444'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 40); g.lineTo(320, 86); g.stroke();
      g.fillStyle = '#d8322b'; K.rr(g, 120, 62, 30, 20, 4); g.fill(); g.fillStyle = '#cfe6f6'; g.fillRect(124, 66, 22, 8); g.strokeStyle = '#444'; g.beginPath(); g.moveTo(135, 58); g.lineTo(135, 62); g.stroke();
    },
    western: function (g) {
      K.sky(g, '#7fb6e6', '#eef0e2'); K.cloud(g, 60, 30, 0.9); K.cloud(g, 262, 44, 0.7); K.ground(g, 156, '#b8b2a2');
      g.fillStyle = '#d9d2c2'; g.fillRect(20, 84, 280, 74); g.fillStyle = '#b8a890'; g.fillRect(20, 114, 280, 4); g.fillRect(20, 84, 280, 5);
      g.fillStyle = '#4a5a6a'; g.fillRect(14, 76, 292, 10);
      for (let x = 30; x < 296; x += 22) { if (x > 136 && x < 180) continue; g.fillStyle = '#44566a'; K.rr(g, x, 92, 11, 18, 5); g.fill(); g.fillRect(x, 124, 11, 22); }
      // 中央の時計塔
      g.fillStyle = '#d9d2c2'; g.fillRect(132, 62, 56, 96); g.fillStyle = '#c8bca4'; g.fillRect(140, 30, 40, 34); g.fillStyle = '#4a5a6a'; g.beginPath(); g.moveTo(136, 30); g.lineTo(160, 6); g.lineTo(184, 30); g.fill(); g.fillRect(158.5, 0, 3, 8);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(160, 46, 11, 0, 6.283); g.fill(); g.strokeStyle = '#333'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(160, 46); g.lineTo(160, 38); g.moveTo(160, 46); g.lineTo(166, 49); g.stroke();
      g.fillStyle = '#5a4634'; K.rr(g, 148, 122, 24, 36, 10); g.fill(); g.fillStyle = '#c8bca4'; g.fillRect(136, 110, 48, 5);
      K.tree(g, 30, 176, 12, '#4f8a3c'); K.tree(g, 292, 176, 12, '#4f8a3c');
      g.fillStyle = '#9a948a'; g.fillRect(0, 176, 320, 24); g.fillStyle = '#c8402c'; g.fillRect(120, 176, 80, 24);
    },
    imoni: function (g) {
      K.sky(g, '#7fb6e6', '#f2ecd6'); K.cloud(g, 250, 28, 0.9); K.hills(g, 100, 40, '#b9803a', 91); K.hills(g, 112, 22, '#d09a3a', 92);
      K.water(g, 110, 26, '#86b6cc', '#6496b0'); K.ground(g, 132, '#cbbf9c');
      // 大鍋
      g.fillStyle = '#8e8a82'; g.fillRect(96, 168, 128, 14); g.fillStyle = '#2c2f33'; g.beginPath(); g.moveTo(84, 124); g.lineTo(236, 124); g.quadraticCurveTo(232, 168, 204, 170); g.lineTo(116, 170); g.quadraticCurveTo(88, 168, 84, 124); g.fill();
      g.fillStyle = '#7a4a22'; g.beginPath(); g.ellipse(160, 124, 76, 12, 0, 0, 6.283); g.fill(); g.fillStyle = '#e8dcc0'; const r = rng(5); for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(100 + r() * 120, 120 + r() * 8, 4.5, 0, 6.283); g.fill(); } g.fillStyle = '#6fae4e'; for (let i = 0; i < 9; i++) g.fillRect(100 + r() * 118, 120 + r() * 7, 9, 2.5);
      K.steam(g, 130, 112, 1.5); K.steam(g, 190, 114, 1.4);
      // 重機（バックホー）
      g.fillStyle = '#f2b21c'; K.rr(g, 250, 132, 46, 24, 4); g.fill(); g.fillStyle = '#333'; K.rr(g, 244, 156, 58, 12, 6); g.fill(); g.fillStyle = '#cfe6f6'; g.fillRect(276, 136, 16, 12);
      g.strokeStyle = '#f2b21c'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(256, 136); g.lineTo(232, 84); g.lineTo(204, 108); g.stroke(); g.fillStyle = '#8e8a82'; g.beginPath(); g.moveTo(196, 104); g.lineTo(212, 104); g.lineTo(208, 120); g.lineTo(198, 120); g.fill();
      for (let i = 0; i < 7; i++) K.person(g, 16 + i * 11, 190 - (i % 2) * 5, 20, ['#c8402c', '#2f6fc0', '#2f8a4a', '#e8872a'][i % 4]);
      g.fillStyle = '#2f6fc0'; g.fillRect(20, 142, 44, 4); g.fillStyle = '#f4f4f0'; g.beginPath(); g.moveTo(16, 142); g.lineTo(42, 126); g.lineTo(68, 142); g.fill();
    },
    cliff: function (g) {
      K.sky(g, '#86bce8', '#f0f0dc'); K.cloud(g, 250, 30, 0.9); K.hills(g, 150, 50, '#7ca47a', 101);
      // 岩山
      g.fillStyle = '#9a968a'; g.beginPath(); g.moveTo(40, 200); g.lineTo(60, 110); g.lineTo(96, 96); g.lineTo(112, 54); g.lineTo(150, 44); g.lineTo(172, 70); g.lineTo(206, 62); g.lineTo(236, 104); g.lineTo(270, 120); g.lineTo(290, 200); g.fill();
      g.fillStyle = '#868276'; g.beginPath(); g.moveTo(112, 54); g.lineTo(128, 120); g.lineTo(96, 96); g.fill(); g.beginPath(); g.moveTo(172, 70); g.lineTo(190, 140); g.lineTo(206, 62); g.fill(); g.beginPath(); g.moveTo(236, 104); g.lineTo(226, 170); g.lineTo(270, 120); g.fill();
      [[70, 150, 60], [96, 176, 54], [250, 170, 60], [210, 190, 46], [150, 186, 50], [40, 190, 50], [286, 196, 54]].forEach(function (c, i) { K.cedar(g, c[0], c[1], c[2], i % 2 ? '#2a5e38' : '#356f42'); });
      // 納経堂（赤い小堂）と開山堂
      g.fillStyle = '#b8402c'; g.fillRect(122, 34, 18, 14); K.roof(g, 131, 36, 26, 10, '#3a4650', true);
      g.fillStyle = '#efe6d2'; g.fillRect(150, 30, 24, 16); K.roof(g, 162, 32, 34, 12, '#4a5a54', true);
      // 五大堂（張り出した舞台）
      g.fillStyle = '#7a5a40'; g.fillRect(196, 48, 30, 14); K.roof(g, 211, 50, 40, 11, '#4a5a54', true); g.strokeStyle = '#7a5a40'; g.lineWidth = 2; for (let x = 198; x <= 226; x += 7) { g.beginPath(); g.moveTo(x, 62); g.lineTo(x, 80); g.stroke(); }
      // 石段
      g.strokeStyle = '#d9d2c0'; g.lineWidth = 4; g.beginPath(); g.moveTo(170, 200); g.lineTo(150, 160); g.lineTo(176, 130); g.lineTo(150, 100); g.lineTo(160, 76); g.stroke();
    },
    shogi: function (g) {
      K.sky(g, '#86bce8', '#f6e9ee'); K.hills(g, 104, 30, '#8fb088', 111);
      [[20, 118, 20], [70, 110, 22], [124, 104, 20], [196, 104, 20], [250, 110, 22], [300, 118, 20]].forEach(function (p) { K.sakura(g, p[0], p[1], p[2]); });
      K.ground(g, 112, '#a9c486');
      // 将棋盤（遠近）
      g.fillStyle = '#e8c88a'; g.beginPath(); g.moveTo(96, 120); g.lineTo(224, 120); g.lineTo(292, 196); g.lineTo(28, 196); g.fill();
      g.strokeStyle = '#7a5a34'; g.lineWidth = 1; for (let i = 0; i <= 6; i++) { const t = i / 6; g.beginPath(); g.moveTo(96 + t * 128, 120); g.lineTo(28 + t * 264, 196); g.stroke(); const y = 120 + t * t * 76 * 0.35 + t * 76 * 0.65, xl = 96 - (y - 120) / 76 * 68, xr = 224 + (y - 120) / 76 * 68; g.beginPath(); g.moveTo(xl, y); g.lineTo(xr, y); g.stroke(); }
      const koma = function (x, y, s, ch) { g.fillStyle = '#f0d49a'; g.beginPath(); g.moveTo(x - 9 * s, y); g.lineTo(x + 9 * s, y); g.lineTo(x + 7 * s, y - 17 * s); g.lineTo(x, y - 22 * s); g.lineTo(x - 7 * s, y - 17 * s); g.closePath(); g.fill(); g.fillStyle = '#222'; g.font = '900 ' + Math.round(11 * s) + 'px sans-serif'; g.textAlign = 'center'; g.fillText(ch, x, y - 5 * s); };
      const samurai = function (x, y, s, c) { K.person(g, x, y, 26 * s, c); g.fillStyle = '#2a2a2a'; g.beginPath(); g.moveTo(x - 8 * s, y - 24 * s); g.lineTo(x, y - 34 * s); g.lineTo(x + 8 * s, y - 24 * s); g.fill(); g.fillStyle = '#c9a54a'; g.fillRect(x - 1 * s, y - 36 * s, 2 * s, 5 * s); };
      samurai(120, 150, 0.7, '#c8402c'); samurai(160, 148, 0.7, '#c8402c'); samurai(200, 150, 0.7, '#c8402c');
      samurai(86, 190, 1.05, '#2f5fa8'); samurai(160, 192, 1.1, '#2f5fa8'); samurai(236, 190, 1.05, '#2f5fa8');
      koma(128, 174, 0.9, '歩'); koma(196, 172, 0.9, '金'); koma(160, 136, 0.6, '王');
      K.petals(g, 38, 17);
    },
    tree: function (g) {
      K.sky(g, '#86bce8', '#eef3e0'); K.cloud(g, 40, 26, 0.8); K.cloud(g, 270, 34, 0.9); K.ground(g, 160, '#c9c0a4');
      g.fillStyle = '#efe9da'; g.fillRect(0, 118, 96, 44); g.fillStyle = '#7a8a94'; g.fillRect(0, 112, 96, 7); g.fillStyle = '#44566a'; for (let x = 6; x < 90; x += 15) { g.fillRect(x, 126, 9, 9); g.fillRect(x, 142, 9, 9); }
      // 幹
      g.fillStyle = '#5a4030'; g.beginPath(); g.moveTo(130, 176); g.quadraticCurveTo(148, 150, 142, 96); g.lineTo(184, 96); g.quadraticCurveTo(178, 150, 204, 176); g.fill();
      g.fillStyle = '#4a3226'; g.beginPath(); g.moveTo(160, 176); g.quadraticCurveTo(166, 140, 160, 100); g.lineTo(170, 100); g.quadraticCurveTo(176, 140, 190, 176); g.fill();
      g.strokeStyle = '#5a4030'; g.lineWidth = 9; g.lineCap = 'round'; [[150, 100, 96, 66], [172, 100, 232, 62], [160, 98, 162, 44]].forEach(function (b) { g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[2], b[3]); g.stroke(); });
      const r = rng(11); for (let i = 0; i < 46; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * 1; const x = 164 + Math.cos(a) * d * 116, y = 62 + Math.sin(a) * d * 52; g.fillStyle = ['#4f8a3c', '#5f9a44', '#3f7a34', '#6fae4e'][i % 4]; g.beginPath(); g.arc(x, y, 14 + r() * 10, 0, 6.283); g.fill(); }
      // しめ縄と子ども
      g.strokeStyle = '#e8dcc0'; g.lineWidth = 3; g.beginPath(); g.moveTo(140, 132); g.quadraticCurveTo(162, 142, 186, 132); g.stroke(); g.fillStyle = '#fff'; [150, 162, 174].forEach(function (x) { g.fillRect(x, 136, 3, 8); });
      K.person(g, 232, 182, 18, '#d8322b'); K.person(g, 250, 184, 16, '#2f6fc0'); K.person(g, 100, 184, 17, '#f2c230');
    },
    cherry: function (g) {
      K.sky(g, '#8cc4ee', '#eef6e0'); K.hills(g, 150, 30, '#8fb88a', 121); K.ground(g, 150, '#9cc878');
      for (let i = 0; i < 6; i++) K.tree(g, 20 + i * 56, 168, 13, '#4f8a3c');
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, 118, 320, 5);
      // 枝とさくらんぼ
      g.strokeStyle = '#6a4a34'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 26); g.quadraticCurveTo(140, 34, 320, 12); g.stroke();
      const leaf = function (x, y, a) { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#4f9a3c'; g.beginPath(); g.ellipse(18, 0, 20, 8, 0, 0, 6.283); g.fill(); g.strokeStyle = '#3a7a2c'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 0); g.lineTo(36, 0); g.stroke(); g.restore(); };
      leaf(60, 30, 0.5); leaf(150, 30, -0.4); leaf(230, 22, 0.7); leaf(110, 30, 2.4); leaf(280, 16, 2.3);
      const pair = function (x, y, l, d) { g.strokeStyle = '#7a9a3c'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - d * 0.4, y + l * 0.6, x - d, y + l); g.moveTo(x, y); g.quadraticCurveTo(x + d * 0.5, y + l * 0.6, x + d, y + l + 6); g.stroke();
        [[x - d, y + l + 12], [x + d, y + l + 18]].forEach(function (c) { const gr = g.createRadialGradient(c[0] - 4, c[1] - 5, 2, c[0], c[1], 15); gr.addColorStop(0, '#ff8a7a'); gr.addColorStop(0.5, '#e02a2a'); gr.addColorStop(1, '#a8141c'); g.fillStyle = gr; g.beginPath(); g.arc(c[0], c[1], 14, 0, 6.283); g.fill(); g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(c[0] - 5, c[1] - 6, 3, 1.8, -0.6, 0, 6.283); g.fill(); }); };
      pair(80, 32, 46, 16); pair(170, 30, 60, 18); pair(256, 22, 44, 15);
    },
    rapids: function (g) {
      K.sky(g, '#86bce8', '#eef3e0'); K.cloud(g, 60, 26, 0.9); K.hills(g, 96, 46, '#5f9462', 131); K.hills(g, 108, 26, '#7fae6c', 132);
      K.water(g, 104, 96, '#5f9fc0', '#2f6f96');
      g.fillStyle = '#7a766c'; [[40, 150, 26, 12], [110, 126, 18, 8], [250, 140, 30, 13], [200, 176, 22, 10], [290, 186, 26, 11]].forEach(function (r) { g.beginPath(); g.ellipse(r[0], r[1], r[2], r[3], 0, 0, 6.283); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2.5; g.beginPath(); g.arc(r[0], r[1] + 3, r[2] + 4, 0.2, 2.9); g.stroke(); });
      // 舟下りの舟
      g.fillStyle = '#7a5230'; g.beginPath(); g.moveTo(108, 158); g.lineTo(206, 158); g.quadraticCurveTo(216, 158, 222, 148); g.lineTo(96, 148); g.quadraticCurveTo(100, 158, 108, 158); g.fill();
      g.fillStyle = '#f2ead8'; g.fillRect(124, 126, 66, 6); g.fillStyle = '#7a5a40'; g.fillRect(126, 132, 2.5, 16); g.fillRect(186, 132, 2.5, 16);
      for (let i = 0; i < 4; i++) K.person(g, 140 + i * 13, 150, 15, ['#c8402c', '#2f6fc0', '#f2c230', '#2f8a4a'][i]);
      K.person(g, 208, 148, 20, '#2a3a5a'); g.fillStyle = '#e8d28a'; g.beginPath(); g.moveTo(199, 130); g.lineTo(217, 130); g.lineTo(208, 124); g.fill(); g.strokeStyle = '#8a6a4a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(214, 124); g.lineTo(236, 176); g.stroke();
    },
    rose: function (g) {
      K.sky(g, '#86bce8', '#f3efe0'); K.cloud(g, 250, 28, 0.9); K.hills(g, 110, 34, '#6f9a6c', 141); K.ground(g, 118, '#8fc070');
      g.fillStyle = '#d9d2c0'; g.beginPath(); g.moveTo(128, 200); g.lineTo(192, 200); g.lineTo(170, 118); g.lineTo(150, 118); g.fill();
      const r = rng(13);
      for (let k = 0; k < 3; k++) { const y = 150 + k * 22, w = 46 + k * 18, x = 160; g.strokeStyle = '#3f7a34'; g.lineWidth = 5 + k * 1.5; g.beginPath(); g.moveTo(x - w, y + 30); g.lineTo(x - w, y - 20 - k * 6); g.quadraticCurveTo(x, y - 62 - k * 14, x + w, y - 20 - k * 6); g.lineTo(x + w, y + 30); g.stroke(); for (let i = 0; i < 26 + k * 8; i++) { const t = r(), a = Math.PI * t, px = x - Math.cos(a) * w, py = y - 20 - k * 6 - Math.sin(a) * (40 + k * 8) + (t < 0.12 || t > 0.88 ? r() * 40 : 0); g.fillStyle = ['#e02a4a', '#f06a8a', '#ffd0dc', '#f2c230', '#fff'][Math.floor(r() * 5)]; g.beginPath(); g.arc(px + (r() - 0.5) * 6, py + (r() - 0.5) * 6, 3 + k, 0, 6.283); g.fill(); } }
      for (let i = 0; i < 90; i++) { const x = r() * 320; if (x > 126 && x < 194) continue; const y = 126 + r() * 72; g.fillStyle = '#3f7a34'; g.beginPath(); g.arc(x, y + 3, 5, 0, 6.283); g.fill(); g.fillStyle = ['#e02a4a', '#f06a8a', '#ffd0dc', '#f2c230', '#fff', '#f08a3a'][Math.floor(r() * 6)]; g.beginPath(); g.arc(x, y, 3.6, 0, 6.283); g.fill(); }
    },
    kashi: function (g) {
      K.sky(g, '#86bce8', '#f1efda'); K.cloud(g, 60, 28, 0.9); K.hills(g, 100, 40, '#6f9a6c', 151); K.ground(g, 104, '#9cbf78');
      // 塀蔵（白壁と瓦）
      g.fillStyle = '#f4f1ea'; g.fillRect(0, 96, 320, 34); g.fillStyle = '#3a3a3e'; g.fillRect(0, 118, 320, 12); g.fillStyle = '#4a4f58'; g.fillRect(0, 90, 320, 7);
      for (let x = 20; x < 320; x += 62) { g.fillStyle = '#f4f1ea'; g.fillRect(x, 74, 34, 24); K.gable(g, x + 17, 76, 36, 14, '#4a4f58'); g.fillStyle = '#3a3a3e'; g.fillRect(x + 12, 84, 10, 10); }
      g.fillStyle = '#b0a894'; g.fillRect(0, 130, 320, 10);
      K.water(g, 140, 60, '#7fb0c8', '#4f84a2');
      // ひらた舟
      g.fillStyle = '#7a5230'; g.beginPath(); g.moveTo(96, 176); g.lineTo(214, 176); g.quadraticCurveTo(232, 172, 238, 160); g.lineTo(84, 160); g.quadraticCurveTo(86, 172, 96, 176); g.fill();
      g.fillStyle = '#5a4030'; g.fillRect(158, 96, 3, 66); g.fillStyle = '#f2ead8'; g.fillRect(128, 100, 64, 46); g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1; for (let x = 140; x < 192; x += 12) { g.beginPath(); g.moveTo(x, 100); g.lineTo(x, 146); g.stroke(); }
      g.fillStyle = '#e8c88a'; [100, 114, 204, 218].forEach(function (x) { K.rr(g, x, 150, 12, 10, 3); g.fill(); });
      K.person(g, 228, 160, 18, '#2a3a5a');
    },
    soba: function (g) {
      K.sky(g, '#e9dcc0', '#d9c8a4'); g.fillStyle = '#7a5a3c'; g.fillRect(0, 0, 320, 200); g.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < 200; y += 14) g.fillRect(0, y, 320, 2);
      // 板（長い木の箱）
      g.fillStyle = '#c9a26a'; K.rr(g, 24, 46, 212, 112, 8); g.fill(); g.fillStyle = '#b08a52'; K.rr(g, 34, 56, 192, 92, 4); g.fill();
      const r = rng(17); g.lineCap = 'round';
      for (let m = 0; m < 5; m++) { const cx = 62 + m * 34, cy = 102 + (m % 2) * 6; for (let i = 0; i < 26; i++) { g.strokeStyle = ['#b9a88a', '#a8977a', '#c9b89a', '#9a8a70'][i % 4]; g.lineWidth = 2.2; g.beginPath(); const a = r() * 6.283, rr2 = 8 + r() * 14; g.ellipse(cx + (r() - 0.5) * 8, cy + (r() - 0.5) * 16, rr2, rr2 * (0.5 + r() * 0.4), a, 0, 4.5 + r()); g.stroke(); } }
      // そば猪口と薬味、箸
      g.fillStyle = '#2f4a6a'; g.beginPath(); g.moveTo(250, 78); g.lineTo(304, 78); g.lineTo(296, 122); g.lineTo(258, 122); g.fill(); g.fillStyle = '#3a2a1c'; g.beginPath(); g.ellipse(277, 78, 27, 7, 0, 0, 6.283); g.fill(); g.fillStyle = '#fff'; g.fillRect(262, 92, 30, 3);
      g.fillStyle = '#f4f1ea'; g.beginPath(); g.ellipse(276, 150, 24, 9, 0, 0, 6.283); g.fill(); g.fillStyle = '#6fae4e'; for (let i = 0; i < 14; i++) g.fillRect(260 + r() * 30, 145 + r() * 8, 5, 2); g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(292, 148, 5, 0, 6.283); g.fill();
      g.strokeStyle = '#3a2a1c'; g.lineWidth = 3; g.beginPath(); g.moveTo(40, 178); g.lineTo(230, 170); g.moveTo(40, 186); g.lineTo(230, 178); g.stroke();
    },
    lake: function (g, o) {
      K.sky(g, '#7fb6e6', '#eef3e0'); K.cloud(g, 70, 30, 1); K.cloud(g, 250, 40, 0.8); K.hills(g, 104, 40, '#6f9a6c', 161, null); K.hills(g, 112, 20, '#8fb880', 162);
      K.water(g, 112, 56, '#8fc4dc', '#5f9ab8'); K.ground(g, 166, '#9cc878');
      for (let i = 0; i < 5; i++) K.tree(g, 10 + i * 20, 170, 9, '#4f8a3c'); for (let i = 0; i < 4; i++) K.tree(g, 250 + i * 22, 172, 10, '#4f8a3c');
      if (o && o.hanagasa) {
        const dancer = function (x, y, s, a) { K.person(g, x, y, 34 * s, '#f4f1ea'); g.fillStyle = '#2f5fa8'; g.fillRect(x - 5 * s, y - 16 * s, 10 * s, 5 * s); g.save(); g.translate(x + 14 * s, y - 34 * s); g.rotate(a); g.fillStyle = '#e8d28a'; g.beginPath(); g.ellipse(0, 0, 15 * s, 5 * s, 0, 0, 6.283); g.fill(); g.fillStyle = '#d8322b'; [-9, -3, 3, 9].forEach(function (d) { g.beginPath(); g.arc(d * s, -1 * s, 3 * s, 0, 6.283); g.fill(); }); g.restore(); g.strokeStyle = '#f4f1ea'; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(x + 3 * s, y - 22 * s); g.lineTo(x + 12 * s, y - 32 * s); g.stroke(); };
        dancer(92, 200, 1.7, -0.4); dancer(160, 202, 1.8, 0.2); dancer(228, 200, 1.7, -0.3);
      }
    },
    dogu: function (g) {
      const gr = g.createRadialGradient(160, 96, 10, 160, 100, 190); gr.addColorStop(0, '#3a4a6a'); gr.addColorStop(1, '#141c2c'); g.fillStyle = gr; g.fillRect(0, 0, 320, 200);
      g.strokeStyle = 'rgba(200,160,110,0.22)'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { g.beginPath(); for (let x = 0; x <= 320; x += 8) { const y = 16 + i * 34 + Math.sin(x / 18 + i) * 7; if (x) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); }
      K.sun(g, 160, 80, 38, 'rgba(255,230,180,0.28)');
      // 縄文の女神（正面）
      g.fillStyle = '#b98558';
      g.beginPath(); g.moveTo(138, 44); g.quadraticCurveTo(160, 20, 182, 44); g.lineTo(178, 50); g.lineTo(142, 50); g.fill();               // 頭（半円の帽子形）
      g.fillRect(154, 50, 12, 10);                                                                                                         // 首
      g.beginPath(); g.moveTo(118, 60); g.lineTo(202, 60); g.lineTo(196, 72); g.lineTo(176, 76); g.lineTo(172, 108); g.lineTo(148, 108); g.lineTo(144, 76); g.lineTo(124, 72); g.fill();   // 肩と胴
      g.beginPath(); g.moveTo(140, 108); g.lineTo(180, 108); g.lineTo(190, 128); g.lineTo(130, 128); g.fill();                             // 腰
      g.beginPath(); g.moveTo(132, 128); g.lineTo(188, 128); g.lineTo(184, 188); g.lineTo(162, 188); g.lineTo(160, 140); g.lineTo(158, 188); g.lineTo(136, 188); g.fill();   // 脚
      g.fillStyle = '#9a6a42'; g.beginPath(); g.moveTo(160, 108); g.lineTo(190, 128); g.lineTo(186, 188); g.lineTo(172, 188); g.lineTo(170, 120); g.fill();
      g.strokeStyle = '#7a4a2a'; g.lineWidth = 1.5; for (let y = 136; y < 186; y += 7) { g.beginPath(); g.moveTo(138, y); g.lineTo(156, y); g.moveTo(164, y); g.lineTo(182, y); g.stroke(); }
      g.beginPath(); g.moveTo(148, 84); g.lineTo(160, 92); g.lineTo(172, 84); g.stroke();
      g.fillStyle = '#7a4a2a'; g.fillRect(124, 188, 72, 6);
    },
    ayu: function (g) {
      K.sky(g, '#8cc4ee', '#eef6e0'); K.hills(g, 70, 40, '#5f9462', 171); K.hills(g, 84, 22, '#7fae6c', 172);
      const gr = g.createLinearGradient(0, 80, 0, 200); gr.addColorStop(0, '#8fd0dc'); gr.addColorStop(1, '#3f94a8'); g.fillStyle = gr; g.fillRect(0, 80, 320, 120);
      g.fillStyle = 'rgba(120,110,90,0.5)'; const r = rng(19); for (let i = 0; i < 30; i++) { g.beginPath(); g.ellipse(r() * 320, 120 + r() * 80, 8 + r() * 12, 4 + r() * 5, 0, 0, 6.283); g.fill(); }
      const fish = function (x, y, s, a) { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#b8c49a'; g.beginPath(); g.moveTo(-30 * s, 0); g.quadraticCurveTo(-8 * s, -11 * s, 26 * s, -2 * s); g.quadraticCurveTo(-8 * s, 11 * s, -30 * s, 0); g.fill(); g.fillStyle = '#e8e6c8'; g.beginPath(); g.moveTo(-28 * s, 1 * s); g.quadraticCurveTo(-8 * s, 9 * s, 24 * s, 0); g.quadraticCurveTo(-8 * s, 4 * s, -28 * s, 1 * s); g.fill(); g.fillStyle = '#b8c49a'; g.beginPath(); g.moveTo(24 * s, -1 * s); g.lineTo(38 * s, -9 * s); g.lineTo(34 * s, 0); g.lineTo(38 * s, 8 * s); g.fill(); g.fillStyle = '#e8c83a'; g.beginPath(); g.ellipse(-14 * s, 1 * s, 4 * s, 2.4 * s, 0, 0, 6.283); g.fill(); g.fillStyle = '#222'; g.beginPath(); g.arc(-23 * s, -1.5 * s, 1.5 * s, 0, 6.283); g.fill(); g.restore(); };
      fish(100, 130, 1.1, 0.1); fish(206, 150, 1.3, -0.12); fish(140, 180, 0.9, 0.05); fish(262, 116, 0.8, 0.2);
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5; for (let i = 0; i < 14; i++) { const x = r() * 320, y = 86 + r() * 110; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 12, y - 3, x + 26, y); g.stroke(); }
      K.person(g, 40, 100, 22, '#3a4a5a'); g.strokeStyle = '#3a3a3a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(44, 84); g.lineTo(110, 40); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(110, 40); g.lineTo(104, 122); g.stroke();
    },
    yatai: function (g) {
      K.sky(g, '#1c2550', '#5a3a6a'); const r = rng(23); g.fillStyle = '#fff'; for (let i = 0; i < 30; i++) { g.globalAlpha = 0.5 + r() * 0.5; g.fillRect(r() * 320, r() * 80, 1.5, 1.5); } g.globalAlpha = 1;
      g.fillStyle = '#2a2440'; g.fillRect(0, 120, 320, 80); g.fillStyle = '#3a3050'; g.fillRect(0, 96, 70, 30); g.fillRect(250, 100, 70, 26);
      // 山車
      g.fillStyle = '#7a1c1c'; g.fillRect(84, 138, 152, 26); g.fillStyle = '#c9a54a'; g.fillRect(84, 138, 152, 4); g.fillRect(84, 160, 152, 4);
      g.fillStyle = '#2a2a2a'; [112, 208].forEach(function (x) { g.beginPath(); g.arc(x, 172, 16, 0, 6.283); g.fill(); g.fillStyle = '#c9a54a'; g.beginPath(); g.arc(x, 172, 5, 0, 6.283); g.fill(); g.fillStyle = '#2a2a2a'; });
      g.fillStyle = '#6a8a5a'; g.beginPath(); g.moveTo(90, 138); g.quadraticCurveTo(120, 60, 160, 78); g.quadraticCurveTo(210, 50, 232, 138); g.fill();          // 山（岩と松）
      g.fillStyle = '#8fb06a'; g.beginPath(); g.arc(128, 96, 16, 0, 6.283); g.arc(196, 86, 18, 0, 6.283); g.fill();
      g.fillStyle = '#f6bfd2'; for (let i = 0; i < 20; i++) { g.beginPath(); g.arc(96 + r() * 130, 70 + r() * 50, 4, 0, 6.283); g.fill(); }                      // 桜
      const fig = function (x, y, c) { K.person(g, x, y, 30, c); g.fillStyle = '#c9a54a'; g.fillRect(x - 6, y - 34, 12, 4); g.fillStyle = '#f2e0c8'; g.beginPath(); g.arc(x, y - 26, 4, 0, 6.283); g.fill(); };
      fig(140, 138, '#c8402c'); fig(178, 138, '#2f5fa8');
      g.strokeStyle = '#d8dde2'; g.lineWidth = 2; g.beginPath(); g.moveTo(146, 120); g.lineTo(166, 100); g.stroke();
      // ちょうちん
      for (let i = 0; i < 9; i++) { const x = 20 + i * 35, y = 30 + Math.sin(i * 0.8) * 5; K.sun(g, x, y, 6, 'rgba(255,200,120,0.9)'); g.fillStyle = '#f08a3a'; g.beginPath(); g.ellipse(x, y, 5, 7, 0, 0, 6.283); g.fill(); }
      g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 26); g.quadraticCurveTo(160, 40, 320, 26); g.stroke();
      for (let i = 0; i < 12; i++) K.person(g, 12 + i * 27, 198 - (i % 2) * 4, 20, ['#f4f1ea', '#2f5fa8', '#c8402c'][i % 3]);
    },
    silk: function (g) {
      K.sky(g, '#86bce8', '#eef3e0'); K.cloud(g, 250, 28, 0.9); K.ground(g, 150, '#9cc878');
      for (let i = 0; i < 4; i++) K.tree(g, 30 + i * 90, 150, 30, i % 2 ? '#3f7a34' : '#4f8a3c');
      const bld = function (x, w, hh) { g.fillStyle = '#e9e2cf'; g.fillRect(x, 150 - hh, w, hh); g.fillStyle = '#b8ae96'; for (let y = 150 - hh + 6; y < 150; y += 6) g.fillRect(x, y, w, 1); g.fillStyle = '#5a6a5a'; for (let xx = x + 8; xx < x + w - 10; xx += 16) { g.fillRect(xx, 150 - hh + 12, 9, 14); if (hh > 50) g.fillRect(xx, 150 - hh + 36, 9, 14); } K.gable(g, x + w / 2, 150 - hh, w, 20, '#7a4a3a'); };
      bld(40, 110, 62); bld(176, 96, 46);
      g.fillStyle = '#7a4a3a'; g.fillRect(84, 56, 22, 14); K.gable(g, 95, 58, 26, 9, '#5a3a2e');
      g.fillStyle = '#d9d2c0'; g.fillRect(0, 168, 320, 32);
      // 繭
      g.fillStyle = '#fff'; [[270, 182], [288, 186], [278, 192]].forEach(function (p) { g.beginPath(); g.ellipse(p[0], p[1], 9, 5.5, 0.3, 0, 6.283); g.fill(); });
    },
    kanetown: function (g) {
      K.sky(g, '#86bce8', '#eef3e0'); K.cloud(g, 60, 26, 0.9);
      g.fillStyle = '#356f42'; g.beginPath(); g.moveTo(0, 110); g.lineTo(60, 44); g.lineTo(120, 110); g.fill(); g.fillStyle = '#2f6840'; g.beginPath(); g.moveTo(96, 110); g.lineTo(170, 28); g.lineTo(244, 110); g.fill(); g.fillStyle = '#3a7446'; g.beginPath(); g.moveTo(214, 110); g.lineTo(276, 52); g.lineTo(320, 96); g.lineTo(320, 110); g.fill();   // 金山三峰
      K.ground(g, 110, '#b9b4a4');
      const hs = function (x, w, hh) { g.fillStyle = '#f4f1ea'; g.fillRect(x, 150 - hh, w, hh); g.fillStyle = '#5a4636'; g.fillRect(x, 150 - hh * 0.38, w, hh * 0.38); g.fillStyle = '#3a3230'; for (let xx = x + 8; xx < x + w - 10; xx += 18) g.fillRect(xx, 150 - hh + 10, 10, 11); g.strokeStyle = '#5a4636'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 150 - hh + 3); g.lineTo(x + w, 150 - hh + 3); g.stroke(); K.gable(g, x + w / 2, 150 - hh, w + 8, hh * 0.52, '#2e2a28'); g.fillStyle = '#f4f1ea'; g.beginPath(); g.moveTo(x + w * 0.3, 150 - hh); g.lineTo(x + w / 2, 150 - hh - hh * 0.3); g.lineTo(x + w * 0.7, 150 - hh); g.fill(); };
      hs(8, 86, 52); hs(112, 96, 60); hs(226, 88, 50);
      g.fillStyle = '#9a968c'; g.fillRect(0, 150, 320, 10); K.water(g, 160, 18, '#7fb6cc', '#5f96b0'); g.fillStyle = '#9a968c'; g.fillRect(0, 178, 320, 22);
      [[60, 168, '#e8502a'], [150, 170, '#f4f1ea'], [230, 167, '#f2b21c']].forEach(function (k) { g.fillStyle = k[2]; g.beginPath(); g.ellipse(k[0], k[1], 9, 3.4, 0, 0, 6.283); g.fill(); g.beginPath(); g.moveTo(k[0] + 8, k[1]); g.lineTo(k[0] + 14, k[1] - 4); g.lineTo(k[0] + 14, k[1] + 4); g.fill(); });
    },
    koi: function (g) {
      g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 320, 60); g.fillStyle = '#5a4636'; g.fillRect(0, 34, 320, 26); g.fillStyle = '#2e2a28'; g.fillRect(0, 0, 320, 8);
      K.stone(g, 0, 60, 320, 26, '#a8a294');
      const gr = g.createLinearGradient(0, 86, 0, 200); gr.addColorStop(0, '#7fc0c8'); gr.addColorStop(1, '#3f8a96'); g.fillStyle = gr; g.fillRect(0, 86, 320, 92);
      K.stone(g, 0, 178, 320, 22, '#a8a294');
      const koi = function (x, y, s, a, c1, c2) { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = c1; g.beginPath(); g.moveTo(-34 * s, 0); g.quadraticCurveTo(-12 * s, -15 * s, 22 * s, -4 * s); g.lineTo(40 * s, -13 * s); g.lineTo(36 * s, 0); g.lineTo(40 * s, 13 * s); g.lineTo(22 * s, 4 * s); g.quadraticCurveTo(-12 * s, 15 * s, -34 * s, 0); g.fill(); g.fillStyle = c2; g.beginPath(); g.ellipse(-12 * s, -1 * s, 10 * s, 6 * s, 0.3, 0, 6.283); g.fill(); g.beginPath(); g.ellipse(10 * s, 1 * s, 7 * s, 4 * s, -0.2, 0, 6.283); g.fill(); g.fillStyle = '#222'; g.beginPath(); g.arc(-26 * s, -3 * s, 1.6 * s, 0, 6.283); g.arc(-26 * s, 3 * s, 1.6 * s, 0, 6.283); g.fill(); g.restore(); };
      koi(86, 116, 1.1, 0.12, '#f4f1ea', '#e8402a'); koi(212, 134, 1.3, -0.1, '#f2a51c', '#f4f1ea'); koi(140, 158, 0.9, 0.06, '#e8402a', '#f08a3a'); koi(270, 104, 0.8, 0.2, '#f4f1ea', '#222');
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5; const r = rng(29); for (let i = 0; i < 16; i++) { const x = r() * 320, y = 92 + r() * 80; g.beginPath(); g.ellipse(x, y, 10 + r() * 8, 3, 0, 0, 6.283); g.stroke(); }
    },
    cedar: function (g) {
      K.sky(g, '#a9d0ea', '#eef6e6'); g.fillStyle = '#356f42'; g.fillRect(0, 0, 320, 80); g.fillStyle = '#2a5e38'; const r = rng(31);
      for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(r() * 320, r() * 70, 20 + r() * 20, 0, 6.283); g.fill(); }
      g.fillStyle = 'rgba(255,255,220,0.2)'; g.beginPath(); g.moveTo(190, 0); g.lineTo(240, 0); g.lineTo(180, 200); g.lineTo(90, 200); g.fill();
      K.ground(g, 170, '#6f8a52'); g.fillStyle = '#8a7a5a'; g.beginPath(); g.moveTo(130, 200); g.lineTo(196, 200); g.lineTo(170, 150); g.lineTo(156, 150); g.fill();
      [[20, 14], [64, 20], [108, 13], [224, 22], [268, 15], [306, 18]].forEach(function (t, i) { const gr = g.createLinearGradient(t[0] - t[1] / 2, 0, t[0] + t[1] / 2, 0); gr.addColorStop(0, '#5a4030'); gr.addColorStop(0.5, '#8a6a4c'); gr.addColorStop(1, '#4a3226'); g.fillStyle = gr; g.fillRect(t[0] - t[1] / 2, 0, t[1], 180 + (i % 2) * 8); });
      for (let i = 0; i < 12; i++) { g.fillStyle = '#4f8a3c'; g.beginPath(); g.ellipse(r() * 320, 176 + r() * 20, 12, 5, 0, 0, 6.283); g.fill(); }
      K.person(g, 163, 186, 15, '#d8322b');
    }
  };

  // ================================================================ 描画と写真の差し替え
  const photos = {};                    // id → Image（www/sights/photos.js の一覧にある写真）
  function preloadPhotos() {
    if (typeof Image === 'undefined') return;
    const list = R13.sightPhotos || [];
    CARDS.forEach(function (c) {
      if (list.indexOf(c.id) < 0) return;
      const im = new Image();
      im.onload = function () { if (im.naturalWidth > 16) { photos[c.id] = im; cache = {}; if (R13.sights.onPhoto) R13.sights.onPhoto(c.id); } };
      im.onerror = function () {};
      im.src = 'sights/' + c.id + '.jpg';
    });
  }
  // カードの絵を (x, y, w, h) に描く
  function draw(ctx, card, x, y, w, h) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const ph = photos[card.id];
    if (ph) {
      const r = Math.max(w / ph.naturalWidth, h / ph.naturalHeight), sw = w / r, sh = h / r;
      ctx.drawImage(ph, (ph.naturalWidth - sw) / 2, (ph.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
    } else {
      const r = Math.max(w / 320, h / 200);
      ctx.translate(x + (w - 320 * r) / 2, y + (h - 200 * r) / 2); ctx.scale(r, r);
      ctx.lineCap = 'butt'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
      (ART[card.art] || ART.lake)(ctx, card.opt || {});
    }
    ctx.restore();
  }
  let cache = {};
  // data URL（サムネイル・詳細用）
  function dataUrl(card, w, h) {
    const key = card.id + ':' + w + 'x' + h;
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), card, 0, 0, w, h);
    return (cache[key] = c.toDataURL('image/jpeg', 0.86));
  }

  // ================================================================ 沿道の案内板の位置
  // カードの地点の少し先で、トンネル・橋・交差点・道の駅・ほかの標識と重ならない場所を探す
  function boardSpots(RT) {
    const taken = [];
    RT.REGIONS.forEach(function (r) { taken.push(r.start - 30, r.start - 1000); });
    RT.CAMERAS.forEach(function (c) { taken.push(c.s - 300, c.s - 600, c.s); });
    RT.YELLOW_ZONES.forEach(function (z) { taken.push(z[0] - 20); });
    RT.SWITCHES.forEach(function (w) { taken.push(w.s - 500); });
    RT.STATIONS.forEach(function (st) { taken.push(st.s - 800, st.s - 300, st.s - 40); });
    RT.RIVERS.forEach(function (rv) { taken.push(rv.s - rv.half - 26); });
    for (let s = 300; s < RT.TOTAL; s += 1600) taken.push(s);
    const ok = function (s) {
      if (s < 40 || s > RT.TOTAL - 60) return false;
      for (const t of RT.TUNNELS) if (s > t.start - 110 && s < t.end + 110) return false;
      for (const rv of RT.RIVERS) if (Math.abs(s - rv.s) < rv.half + 50 + (rv.bank || 0)) return false;
      for (const sg of RT.SIGNALS) if (s > sg.s - 45 && s < sg.s + 70) return false;
      for (const st of RT.STATIONS) if (Math.abs(s - st.s) < 215) return false;
      for (const t of taken) if (Math.abs(s - t) < 32) return false;
      return true;
    };
    const out = {};
    CARDS.forEach(function (c) {
      let found = null;
      for (let d = 90; d <= 420 && found == null; d += 10) if (ok(c.s + d)) found = c.s + d;
      if (found == null) for (let d = 80; d >= -200 && found == null; d -= 10) if (ok(c.s + d)) found = c.s + d;
      if (found != null) { out[c.id] = found; taken.push(found); }
    });
    return out;
  }

  const byId = {}; CARDS.forEach(function (c) { byId[c.id] = c; });
  R13.sights = {
    CARDS: CARDS, byId: byId, ART: ART, draw: draw, dataUrl: dataUrl, preloadPhotos: preloadPhotos, boardSpots: boardSpots, photos: photos,
    forRegion: function (id) { return CARDS.filter(function (c) { return c.region === id; }); }
  };
  if (typeof module !== 'undefined') module.exports = R13;
})(typeof window !== 'undefined' ? window : globalThis);
