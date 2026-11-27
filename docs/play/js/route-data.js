/* route-data.js — 地域、距離、車線、信号、道の駅、給油所、速度取締り
 * 道路・施設配置・距離・取締りはゲーム用に構成したものです。 */
(function (G) {
  'use strict';
  const R13 = G.R13 = G.R13 || {};

  const LANE_W = 3.5;           // m
  const SHOULDER = 2.4;         // paved shoulder outside the edge line (m)
  const TOTAL = 53000;          // 全行程 m
  const WIDTH_BLEND = 350;      // 道路幅は切替点の350 m手前から滑らかに変化

  const REGIONS = [
    { id: 'yonezawa', tag: '上杉の城下町', muni: '市',   name: '米沢',   kana: 'よねざわ',   en: 'YONEZAWA',   start: 0,     end: 4000,  lanes: 2, land: 'town' },
    { id: 'takahata', tag: 'ぶどうとワインのまち', muni: '町',   name: '高畠',   kana: 'たかはた',   en: 'TAKAHATA',   start: 4000,  end: 8000,  lanes: 1, land: 'orchard' },
    { id: 'nanyo', tag: '赤湯温泉とぶどうのまち', muni: '市',      name: '南陽',   kana: 'なんよう',   en: 'NANYO',      start: 8000,  end: 13000, lanes: 2, land: 'orchard' },
    { id: 'kaminoyama', tag: 'かみのやま温泉の城下町', muni: '市', name: '上山',   kana: 'かみのやま', en: 'KAMINOYAMA', start: 13000, end: 17000, lanes: 2, land: 'hill' },
    { id: 'yamagata', tag: '県都・蔵王の玄関口', muni: '市',   name: '山形',   kana: 'やまがた',   en: 'YAMAGATA',   start: 17000, end: 23000, lanes: 3, land: 'city' },
    { id: 'tendo', tag: '将棋駒と温泉のまち', muni: '市',      name: '天童',   kana: 'てんどう',   en: 'TENDO',      start: 23000, end: 27000, lanes: 3, land: 'town' },
    { id: 'higashine', tag: 'さくらんぼ「佐藤錦」発祥の地', muni: '市',  name: '東根',   kana: 'ひがしね',   en: 'HIGASHINE',  start: 27000, end: 31000, lanes: 2, land: 'orchard' },
    { id: 'murayama', tag: 'そば街道とバラのまち', muni: '市',   name: '村山',   kana: 'むらやま',   en: 'MURAYAMA',   start: 31000, end: 35000, lanes: 2, land: 'rice' },
    // 0.6.5：国道13号の実際の通過順（村山 → 大石田 → 尾花沢 → 舟形）に組み直し。道路の形・車線・信号の位置は変えていない。
    { id: 'oishida', tag: '最上川舟運とそばのまち', muni: '町',    name: '大石田', kana: 'おおいしだ', en: 'OISHIDA',    start: 35000, end: 37000, lanes: 2, land: 'rice' },
    { id: 'obanazawa', tag: 'すいかと銀山温泉のまち', muni: '市',  name: '尾花沢', kana: 'おばなざわ', en: 'OBANAZAWA',  start: 37000, end: 41000, lanes: 2, land: 'rice' },
    { id: 'funagata', tag: '「縄文の女神」が出土したまち', muni: '町',   name: '舟形',   kana: 'ふながた',   en: 'FUNAGATA',   start: 41000, end: 44000, lanes: 1, land: 'forest' },
    { id: 'shinjo', tag: '新庄まつりのまち', muni: '市',     name: '新庄',   kana: 'しんじょう', en: 'SHINJO',     start: 44000, end: 49000, lanes: 2, land: 'town' },
    { id: 'kaneyama', tag: '金山杉と白壁の街並み', muni: '町',   name: '金山',   kana: 'かねやま',   en: 'KANEYAMA',   start: 49000, end: 53000, lanes: 1, land: 'forest' }
  ];

  // 短時間コース（全行程上の範囲）。短時間コースは到着先の地域の入口で終了。
  const COURSES = [
    { id: 'full',    name: '全行程',       label: '米沢 → 金山',   start: 0,     end: 53000, guide: '53 km　50～65分', full: true },
    { id: 'okitama', name: '置賜ショート', label: '米沢 → 南陽',   start: 0,     end: 8000,  guide: '8 km　8～10分' },
    { id: 'zao',     name: '蔵王のふもと', label: '上山 → 山形',   start: 13000, end: 17000, guide: '4 km　4～6分' },
    { id: 'kaju',    name: '果樹の道',     label: '山形 → 東根',   start: 17000, end: 27000, guide: '10 km　9～12分' },
    { id: 'soba',    name: 'そば街道',     label: '村山 → 尾花沢', start: 31000, end: 37000, guide: '6 km　6～8分' },      // 村山・大石田を走り、尾花沢の入口まで
    { id: 'mogami',  name: '最上ショート', label: '舟形 → 金山',   start: 41000, end: 49000, guide: '8 km　8～10分' },
    { id: 'obanazawa', name: 'すいかと最上川の道', label: '大石田 → 舟形', start: 35000, end: 41000, guide: '6 km　6～8分' },   // 大石田・尾花沢を走り、舟形の入口まで
    // チュートリアル（練習用：記録・解放ポイント・図鑑には反映しない）
    { id: 'tutorial', name: 'はじめてのドライブ', label: '米沢 0～3.6 km', start: 0, end: 3600, guide: '約5分', practice: true }
  ];

  // ---- 季節と天候区間（0.6.3） ----
  const SEASONS = [
    { id: 'spring', name: '春', label: '春　桜と田植えの道', icon: '🌸' },
    { id: 'summer', name: '夏', label: '夏　青田と雷雨',     icon: '🌻' },
    { id: 'autumn', name: '秋', label: '秋　実りの道',       icon: '🍁' },
    { id: 'winter', name: '冬', label: '冬　雪国の道',       icon: '⛄' }
  ];
  // 夏は東根～村山で雷雨、冬は大石田～尾花沢～舟形で降雪。区間内は滑りやすくなる。
  const WEATHER_ZONES = {
    summer: { type: 'storm', name: '雷雨', start: 27500, end: 32000, grip: 0.72, advise: 50 },
    winter: { type: 'snow',  name: '降雪', start: 35500, end: 42000, grip: 0.5,  advise: 45 }
  };
  const WEATHER_RAMP = 300;
  function seasonById(id) { for (const x of SEASONS) if (x.id === id) return x; return SEASONS[2]; }
  // 天候の強さ w (0..1) と路面グリップ
  function weatherAt(season, s) {
    const z = WEATHER_ZONES[season];
    if (!z) return { type: null, w: 0, grip: 1, zone: null };
    let w = 0;
    if (s > z.start - WEATHER_RAMP && s < z.end + WEATHER_RAMP) {
      w = Math.min(1, (s - (z.start - WEATHER_RAMP)) / WEATHER_RAMP, ((z.end + WEATHER_RAMP) - s) / WEATHER_RAMP);
      w = Math.max(0, w);
    }
    if (inTunnel(s)) w = 0;
    return { type: w > 0 ? z.type : null, w: w, grip: 1 - (1 - z.grip) * Math.min(1, w), zone: z };
  }

  // ---- 道路線形の追加カーブ（実際の国道13号の線形を参考にしたゲーム用の表現） ----
  // k > 0 = 右カーブ, k < 0 = 左カーブ
  const CURVES = [
    { c: 11350, len: 640, k: +1 / 380, name: '南陽→上山 右カーブ' },
    { c: 12950, len: 640, k: -1 / 380, name: '南陽→上山 左カーブ' },
    { c: 40450, len: 520, k: -1 / 330, name: '尾花沢→舟形 左カーブ' },
    { c: 41450, len: 520, k: +1 / 330, name: '尾花沢→舟形 右カーブ' }
  ];
  const CURVE_EASE = 140;   // 緩和区間
  function curveWeight(cv, s) {
    const a = cv.c - cv.len / 2, b = cv.c + cv.len / 2;
    if (s <= a || s >= b) return 0;
    const e = Math.min(1, (s - a) / CURVE_EASE, (b - s) / CURVE_EASE);
    return e * e * (3 - 2 * e);
  }
  // トンネル（実在の国道13号のトンネルをゲームの縮尺で表現）
  //  岩部山トンネル：南陽市川樋～上山市（上山バイパス、実延長947 m）
  //  猿羽根トンネル：猿羽根峠の下（尾花沢市～舟形町、1961年開通、実延長433 m）
  const TUNNELS = [
    { start: 11080, end: 11640, name: '岩部山トンネル', en: 'Iwabeyama Tunnel' },
    { start: 41040, end: 41420, name: '猿羽根トンネル', en: 'Sabane Tunnel' }   // 舟形の入口（41 km）のすぐ先。区間コースのゴール・スタートはトンネルの手前
  ];
  function inTunnel(s) { for (const t of TUNNELS) if (s >= t.start && s <= t.end) return true; return false; }
  function tunnelAt(s) { for (const t of TUNNELS) if (s >= t.start && s <= t.end) return t; return null; }

  // 全行程に信号を26か所。青20～24秒、黄2秒、赤6～9秒、場所ごとに位相をずらす。
  const SIGNAL_POS = [900, 3200, 4600, 7000, 8800, 10000, 12500, 13600, 15000, 17800, 19400, 21100, 22000,
    22700, 23700, 25800, 27600, 31800, 34200, 35700, 38600, 40200, 41600, 44800, 46000, 50600];
  const SIGNALS = SIGNAL_POS.map(function (s, i) {
    const green = 20 + ((i * 7) % 5);        // 20..24
    const yellow = 2;
    const red = 6 + ((i * 3) % 4);           // 6..9
    const cycle = green + yellow + red;
    const offset = (i * 13.7) % cycle;
    return { id: i, s: s, green: green, yellow: yellow, red: red, cycle: cycle, offset: offset };
  });

  // 道の駅をモチーフとした施設（7）と給油所（3）
  //   1.0.7：道の駅の名前は、走行中の表示（🎁 道の駅 米沢牛）にそろえて「道の駅 ＋ 特産品」に統一（図鑑・停車画面・クイズ・看板も同じ）
  const STATIONS = [
    { id: 'eki-yonezawa', type: 'eki', s: 2400,  name: '道の駅 米沢牛',     short: '米沢牛',     item: 'beef',   region: 'yonezawa' },
    { id: 'eki-takahata', type: 'eki', s: 5800,  name: '道の駅 ぶどうジャム', short: 'ぶどうジャム', item: 'jam',    region: 'takahata' },
    { id: 'fuel-nanyo',   type: 'fuel', s: 11800, name: '南陽フューエル', short: '南陽',     region: 'nanyo' },
    { id: 'eki-zao',      type: 'eki', s: 18600, name: '道の駅 芋煮', short: '芋煮', item: 'imoni', region: 'yamagata' },
    { id: 'eki-tendo',    type: 'eki', s: 25100, name: '道の駅 将棋駒', short: '将棋駒', item: 'koma',   region: 'tendo' },
    { id: 'fuel-higashine', type: 'fuel', s: 28600, name: '東根フューエル', short: '東根',   region: 'higashine' },
    { id: 'eki-murayama', type: 'eki', s: 33300, name: '道の駅 そば', short: 'そば', item: 'soba',   region: 'murayama' },
    { id: 'eki-obanazawa', type: 'eki', s: 37800, name: '道の駅 すいか', short: 'すいか',     item: 'suika',  region: 'obanazawa' },
    { id: 'fuel-funagata', type: 'fuel', s: 43000, name: '舟形フューエル', short: '舟形',     region: 'funagata' },
    { id: 'eki-shinjo',   type: 'eki', s: 47000, name: '道の駅 くじらもち', short: 'くじらもち', item: 'kujira', region: 'shinjo' }
  ];

  const ITEMS = {
    beef:   { name: '米沢牛',       station: 'eki-yonezawa',  icon: '🥩', note: '置賜地方で育てられるブランド牛。すき焼きやステーキで知られる米沢の名物。' },
    jam:    { name: 'ぶどうジャム', station: 'eki-takahata',  icon: '🍇', note: 'ぶどう栽培が盛んな高畠町。ぶどうの甘さを生かしたジャムをおみやげに。' },
    imoni:  { name: '芋煮',         station: 'eki-zao',       icon: '🍲', note: '里芋と牛肉を醤油で煮る山形の秋の味。河原での芋煮会は季節の風物詩。' },
    koma:   { name: '将棋駒',       station: 'eki-tendo',     icon: '☗',  note: '天童は将棋駒の産地として全国に知られる。書き駒・彫り駒の職人技。' },
    soba:   { name: 'そば',         station: 'eki-murayama',  icon: '🍜', note: '村山の「最上川三難所そば街道」。板そばでいただく香り高い田舎そば。' },
    suika:  { name: 'すいか',       station: 'eki-obanazawa', icon: '🍉', note: '昼夜の寒暖差が大きい尾花沢で育つ、夏の大玉すいか。' },
    kujira: { name: 'くじらもち',   station: 'eki-shinjo',    icon: '🍡', note: '新庄など最上地方に伝わる、もち米や砂糖を使った保存のきく郷土菓子。' }
  };

  // 自動速度取締り：計測点と看板（600 m前・300 m前）
  const CAMERAS = [
    { id: 'cam1', s: 10500 },
    { id: 'cam2', s: 30000 },
    { id: 'cam3', s: 45700 }
  ];
  const SPEED_LIMIT_KMH = 60;
  const CAMERA_TRIGGER_KMH = 63;   // 63 km/hちょうどでは減点しない

  // 中央線の規制区間（黄色の実線）。それ以外は白の破線。
  const YELLOW_ZONES = [
    [1200, 2000], [5000, 5600], [6800, 7500], [9200, 10200], [12000, 12600], [14200, 15400],
    [18000, 19500], [21500, 22300], [24000, 24800], [29200, 30200], [32000, 32800], [36200, 37000],
    [39600, 40400], [41800, 42400], [45000, 46200], [50200, 51400]
  ];

  function regionIndexAt(s) {
    if (s < 0) return 0;
    for (let i = 0; i < REGIONS.length; i++) if (s < REGIONS[i].end) return i;
    return REGIONS.length - 1;
  }
  function regionAt(s) { return REGIONS[regionIndexAt(s)]; }

  // 車線計画（地域の入口からの距離 m と片側車線数）。
  // 0.6.3.2：山形・天童・東根・村山には片側1車線区間を置かない。山形市内は中心部（19.0～21.6 km）だけ3車線。
  const LANE_PLAN = {
    yamagata:  [[0, 2], [2000, 3], [4600, 2]],
    tendo:     [[0, 2]],
    higashine: [[0, 2]],
    murayama:  [[0, 2]],
    oishida:   [[0, 2]],                    // 35～37 km：2車線
    obanazawa: [[0, 2], [400, 1]]           // 37.4 km から1車線（車線の位置は0.6.4までと同じ）
  };
  function planOf(r) {
    if (LANE_PLAN[r.id]) return LANE_PLAN[r.id];
    const L = r.end - r.start;
    if (r.lanes === 3) return [[0, 3], [L * 0.48, 2], [L * 0.77, 1]];
    if (r.lanes === 2) return [[0, 2], [L * 0.6, 1]];
    return [[0, 1]];
  }
  REGIONS.forEach(function (r) { r.plan = planOf(r); r.lanes = r.plan[0][1]; });
  function lanesAt(s) {
    const r = regionAt(s);
    const off = s - r.start;
    let n = r.plan[0][1];
    for (const p of r.plan) if (off >= p[0]) n = p[1];
    return n;
  }

  // 車線数の切替点
  const SWITCHES = (function () {
    const out = [];
    let prev = lanesAt(0);
    REGIONS.forEach(function (r) {
      r.plan.forEach(function (p) {
        const at = r.start + p[0];
        if (at <= 0) return;
        const after = lanesAt(at + 0.01);
        if (after !== prev) out.push({ s: at, from: prev, to: after });
        prev = after;
      });
    });
    return out;
  })();

  // ---- 景観プラン（0.6.4）----
  // 国道13号の沿線の実態（各バイパスの位置、市街地・水田・果樹園・峠・川の並び）を、ゲームの距離に縮めて配置。
  // 進行方向は北向きなので、左＝西側、右＝東側。[開始 m, 左, 右, {fence: 防雪柵}]
  //  strip=ロードサイド店舗 suburb=住宅地 town=まちなか city=中心市街地 onsen=温泉街 kanetown=金山の白壁の街並み
  //  industrial=流通・工業団地 rice=水田 soba=そば畑 field=すいか畑 cherry=さくらんぼ園 orchard=果樹園（りんご・ラ・フランス）
  //  grape=ぶどう棚 grapehill=斜面のぶどう畑 hill=里山 forest=杉林 lake=湖と湿原 riverside=川沿い
  const SCENE_PLAN = [
    // 米沢：米沢バイパス。西が市街地、北へ進むと置賜盆地の水田
    [0,     'strip',    'strip'],
    [700,   'suburb',   'strip'],
    [1500,  'strip',    'rice'],
    [2100,  'rice',     'rice'],
    [3400,  'town',     'rice'],
    // 高畠：糠野目・深沼。盆地の水田、東の丘陵にぶどう畑、屋代川
    [4000,  'rice',     'rice'],
    [4900,  'town',     'town'],
    [5500,  'rice',     'grape'],
    [6600,  'rice',     'orchard'],
    [7400,  'industrial', 'rice'],
    // 南陽：赤湯バイパス。西に赤湯の街と十分一山のぶどう畑、東に白竜湖。鳥上坂を上って岩部山トンネルへ
    [8000,  'strip',    'strip'],
    [8800,  'town',     'rice'],
    [9500,  'grapehill', 'lake'],
    [10650, 'grapehill', 'hill'],
    [11000, 'hill',     'hill'],
    [12300, 'forest',   'hill'],
    // 上山：中山・川口の谷あいから上山盆地へ。東に城下町と蔵王、北端の金瓶に高層マンション
    [13000, 'hill',     'forest'],
    [13900, 'rice',     'orchard'],
    [14500, 'rice',     'town'],
    [15300, 'orchard',  'suburb'],
    [16200, 'rice',     'rice'],
    // 山形：山形バイパス。蔵王成沢の果樹と住宅→飯田→県庁・千歳山のあたりだけ都会的→馬見ヶ崎川→流通センター→漆山
    [17000, 'orchard',  'hill'],
    [17800, 'suburb',   'orchard'],
    [18400, 'strip',    'suburb'],
    [19000, 'suburb',   'strip'],
    [19600, 'city',     'city'],
    [20950, 'strip',    'suburb'],
    [21600, 'industrial', 'strip'],
    [22300, 'rice',     'suburb'],
    // 天童：清池の工業団地→市街地のロードサイド（東に天童温泉と舞鶴山）→乱川の果樹園
    [23000, 'industrial', 'rice'],
    [23800, 'strip',    'town'],
    [24700, 'suburb',   'onsen'],
    [25500, 'strip',    'suburb'],
    [26300, 'orchard',  'orchard'],
    // 東根：さくらんぼ園の中を走る。西に神町と新しい市街地
    [27000, 'cherry',   'cherry'],
    [27900, 'suburb',   'cherry'],
    [28900, 'strip',    'strip'],
    [29800, 'cherry',   'orchard'],
    [30500, 'rice',     'cherry'],
    // 村山：楯岡。東にまちと甑岳、西は最上川へ続く水田
    [31000, 'rice',     'rice'],
    [31800, 'rice',     'town'],
    [32700, 'rice',     'strip'],
    [33700, 'soba',     'rice'],
    [34400, 'town',     'hill'],
    // 大石田：町の東の端を通る。そば畑と水田、防雪柵。西に大石田のまちと最上川
    [35000, 'soba',     'rice',   { fence: true }],
    [35700, 'rice',     'soba',   { fence: true }],
    [36300, 'town',     'soba'],
    // 尾花沢：東にまちなか、丹生川、すいか畑と防雪柵、名木沢で西に最上川、猿羽根峠へ
    [37000, 'field',    'town',   { fence: true }],
    [37350, 'field',    'field',  { fence: true }],
    [38400, 'rice',     'field',  { fence: true }],
    [39000, 'field',    'hill'],
    [39450, 'riverside', 'hill'],
    [40300, 'forest',   'forest'],
    // 舟形：猿羽根トンネルを抜けて舟形のまち、最上小国川
    [41000, 'forest',   'forest'],
    [41800, 'town',     'rice'],
    [42700, 'hill',     'rice'],
    [43400, 'forest',   'forest'],
    // 新庄：新庄盆地。西が市街地、バイパス沿いにロードサイド店舗、北は泉田の水田
    [44000, 'rice',     'hill'],
    [44800, 'suburb',   'rice'],
    [45700, 'strip',    'strip'],
    [46700, 'town',     'rice'],
    [47400, 'rice',     'rice',   { fence: true }],
    [48300, 'rice',     'forest', { fence: true }],
    // 金山：金山杉の林と、白壁・切妻屋根の街並み、金山川
    [49000, 'forest',   'rice'],
    [49800, 'rice',     'forest'],
    [50400, 'kanetown', 'kanetown'],
    [51300, 'forest',   'forest'],
    [52400, 'forest',   'rice']
  ];
  function sceneIndexAt(s) {
    let lo = 0, hi = SCENE_PLAN.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (SCENE_PLAN[m][0] <= s) lo = m; else hi = m - 1; }
    return lo;
  }
  // 景観の種類。side < 0 = 左（西）、side > 0 = 右（東）。省略時は左。
  function landAt(s, side) { return SCENE_PLAN[sceneIndexAt(s)][side > 0 ? 2 : 1]; }
  function sceneOptAt(s) { return SCENE_PLAN[sceneIndexAt(s)][3] || {}; }
  // 景観の切替を前後50 mでなめらかにつなぐための重み {a, b, t}（地形の高さ用）
  const SCENE_BLEND = 50;
  function landBlend(s, side, out) {
    out = out || {};
    const i = sceneIndexAt(s), col = side > 0 ? 2 : 1;
    const cur = SCENE_PLAN[i];
    out.a = cur[col]; out.b = cur[col]; out.t = 0;
    const next = SCENE_PLAN[i + 1];
    if (next && next[0] - s < SCENE_BLEND) { out.b = next[col]; out.t = 0.5 * smooth(1 - (next[0] - s) / SCENE_BLEND); }
    else if (i > 0 && s - cur[0] < SCENE_BLEND) { out.a = SCENE_PLAN[i - 1][col]; out.b = cur[col]; out.t = 0.5 + 0.5 * smooth((s - cur[0]) / SCENE_BLEND); }
    return out;
  }

  // 国道13号が渡る川（橋）。half = 水面の半分の長さ m
  const RIVERS = [
    { s: 6400,  half: 34, name: '屋代川',     en: 'Yashiro River' },
    { s: 20850, half: 46, name: '馬見ヶ崎川', en: 'Mamigasaki River', bank: 24 },   // bank：建物を置かない河川敷の幅
    { s: 22900, half: 34, name: '立谷川',     en: 'Tachiya River' },
    { s: 26880, half: 34, name: '乱川',       en: 'Midare River' },
    { s: 37250, half: 36, name: '丹生川',     en: 'Nyu River' },
    { s: 42500, half: 40, name: '最上小国川', en: 'Mogami-Oguni River' },
    { s: 51420, half: 34, name: '金山川',     en: 'Kaneyama River' }
  ];
  const RIVER_RAMP = 12;
  // 0..1：橋の上（川の区間）で1
  function riverAt(s) {
    for (const rv of RIVERS) {
      const d = Math.abs(s - rv.s);
      if (d < rv.half + RIVER_RAMP) return d <= rv.half ? 1 : smooth(1 - (d - rv.half) / RIVER_RAMP);
    }
    return 0;
  }
  function inRiver(s, margin) {
    for (const rv of RIVERS) if (Math.abs(s - rv.s) < rv.half + RIVER_RAMP + (margin || 0)) return rv;
    return null;
  }
  // 沿道の建物・木を置かない範囲（川と河川敷）
  function riverClear(s) {
    for (const rv of RIVERS) if (Math.abs(s - rv.s) < rv.half + RIVER_RAMP + 8 + (rv.bank || 0)) return rv;
    return null;
  }

  // 車窓の見どころ（通過時に案内を表示）。side: -1 左（西）, 1 右（東）, 0 正面・両側
  const SIGHTS = [
    { s: 120,   side: 0,  text: '上杉の城下町・米沢を出発' },
    { s: 1700,  side: 1,  text: '置賜盆地の水田が広がります' },
    { s: 4100,  side: 0,  text: '高畠町は「まほろばの里」' },
    { s: 5560,  side: 1,  text: '右手の丘陵は高畠のぶどう畑（デラウェア）' },
    { s: 8100,  side: -1, text: '南陽市・赤湯　左手に赤湯温泉' },
    { s: 9000,  side: -1, text: '左手奥に烏帽子山公園（桜の名所）' },
    { s: 9560,  side: 0,  text: '左：十分一山のぶどう畑　右：白竜湖' },
    { s: 10050, side: -1, text: '十分一山はパラグライダーの名所' },
    { s: 10850, side: 0,  text: '鳥上坂を上って岩部山トンネルへ' },
    { s: 13950, side: 0,  text: '上山は干し柿（紅柿）とラ・フランスの産地' },
    { s: 14450, side: 1,  text: '右手に上山城と蔵王連峰' },
    { s: 15400, side: 0,  text: 'かみのやま温泉　かかし祭のまち' },
    { s: 16300, side: 1,  text: '右手に金瓶の高層マンション' },
    { s: 16650, side: 0,  text: '金瓶は歌人・斎藤茂吉のふるさと' },
    { s: 17350, side: 1,  text: '右手に蔵王連峰　冬は樹氷で知られます' },
    { s: 19950, side: 1,  text: '右手に山形県庁と千歳山' },
    { s: 20300, side: -1, text: '左手奥に山形駅と霞城公園（山形城跡）' },
    { s: 20700, side: 0,  text: '馬見ヶ崎川　秋は芋煮会でにぎわう河川敷' },
    { s: 21700, side: -1, text: '左手に山形流通団地（流通センター）' },
    { s: 22780, side: 0,  text: '立谷川を渡ると天童市' },
    { s: 24350, side: 1,  text: '右手に舞鶴山（人間将棋の舞台）と天童温泉' },
    { s: 26450, side: 0,  text: '乱川のあたりはラ・フランスの果樹園' },
    { s: 27100, side: 0,  text: 'さくらんぼ「佐藤錦」発祥の地・東根' },
    { s: 28100, side: -1, text: '左手に神町　その西に山形空港' },
    { s: 29850, side: 1,  text: '東の旧市街に日本一の大ケヤキ' },
    { s: 31400, side: -1, text: '左手奥は最上川三難所（碁点・三ヶ瀬・隼）' },
    { s: 32500, side: 1,  text: '右手に楯岡のまちと甑岳' },
    { s: 32950, side: 1,  text: '右手奥に東沢バラ公園' },
    { s: 33900, side: 0,  text: '最上川三難所そば街道のそば畑' },
    { s: 35100, side: 0,  text: '大石田町　そば畑と防雪柵の道' },
    { s: 35900, side: -1, text: '西に最上川舟運で栄えた大石田のまち' },
    { s: 36400, side: 0,  text: '大石田そば街道　手打ちそばの里' },
    { s: 37050, side: 1,  text: '尾花沢は花笠踊り発祥の地（徳良湖）' },
    { s: 38050, side: 0,  text: '夏は尾花沢すいかの畑が広がります' },
    { s: 38700, side: 1,  text: '銀山温泉はここから東へ' },
    { s: 39500, side: -1, text: '名木沢　左手に最上川' },
    { s: 40850, side: 0,  text: '猿羽根峠　この先トンネルで越えます' },
    { s: 41500, side: 0,  text: '峠の上に猿羽根山地蔵尊' },
    { s: 42400, side: 0,  text: '最上小国川　鮎釣りで知られる清流' },
    { s: 43200, side: 1,  text: '舟形は国宝の土偶「縄文の女神」のふるさと' },
    { s: 44100, side: 0,  text: '新庄盆地に入ります' },
    { s: 45600, side: 0,  text: '新庄まつりの山車（やたい）のまち' },
    { s: 46350, side: -1, text: '左手に山形新幹線の終点・新庄駅' },
    { s: 47600, side: 1,  text: '右手奥に神室連峰' },
    { s: 49150, side: 0,  text: '金山町は金山杉の里' },
    { s: 50150, side: -1, text: '左手に金山三峰（薬師山・中の森・熊鷹森）' },
    { s: 50450, side: 0,  text: 'イザベラ・バードも称えた金山の街並み' },
    { s: 51600, side: 0,  text: '金山杉の美林' }
  ];

  function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

  // 連続的な片側車線数（道路幅計算用）
  function laneWidthCount(s) {
    let n = lanesAt(s);
    for (let i = 0; i < SWITCHES.length; i++) {
      const w = SWITCHES[i];
      if (s >= w.s - WIDTH_BLEND && s < w.s) {
        const t = smooth((s - (w.s - WIDTH_BLEND)) / WIDTH_BLEND);
        return w.from + (w.to - w.from) * t;
      }
    }
    return n;
  }
  function halfWidth(s) { return laneWidthCount(s) * LANE_W; }

  function nextSwitch(s) {
    for (let i = 0; i < SWITCHES.length; i++) if (SWITCHES[i].s > s) return SWITCHES[i];
    return null;
  }

  function isYellow(s) {
    for (let i = 0; i < YELLOW_ZONES.length; i++) {
      const z = YELLOW_ZONES[i];
      if (s >= z[0] && s < z[1]) return true;
    }
    return false;
  }

  // 信号状態 0=青 1=黄 2=赤
  function signalState(sig, t) {
    const p = ((t + sig.offset) % sig.cycle + sig.cycle) % sig.cycle;
    if (p < sig.green) return 0;
    if (p < sig.green + sig.yellow) return 1;
    return 2;
  }

  function lateralOfLane(lane, dir) {
    // dir +1 = 自車と同方向（中央線の左側＝負の横位置）, -1 = 対向
    return dir > 0 ? -(lane + 0.5) * LANE_W : (lane + 0.5) * LANE_W;
  }

  function courseById(id) {
    for (let i = 0; i < COURSES.length; i++) if (COURSES[i].id === id) return COURSES[i];
    return COURSES[0];
  }

  // 区間（市町村境界とコースのゴールで確定）
  function courseSegments(course) {
    const segs = [];
    REGIONS.forEach(function (r) {
      const a = Math.max(r.start, course.start), b = Math.min(r.end, course.end);
      if (b - a > 1) segs.push({ region: r.id, name: r.name, start: a, end: b, length: b - a });
    });
    return segs;
  }

  function inCourse(course, s) { return s >= course.start && s < course.end; }

  function courseFeatures(course) {
    const segs = courseSegments(course);
    return {
      signals: SIGNALS.filter(function (x) { return inCourse(course, x.s); }).length,
      ekis: STATIONS.filter(function (x) { return x.type === 'eki' && inCourse(course, x.s); }).length,
      fuels: STATIONS.filter(function (x) { return x.type === 'fuel' && inCourse(course, x.s); }).length,
      regions: segs.length,
      length: course.end - course.start
    };
  }

  // 標準タイム：区間距離を平均70 km/hで走る時間＋12秒
  function standardTime(lengthM) { return lengthM / (70 / 3.6) + 12; }

  // ---- 道路の形（曲率・高さ）: ゲーム用の線形 ----
  function curvature(s) {
    let base = 0.0011 * Math.sin(s / 610 + 0.4) + 0.0007 * Math.sin(s / 1730 + 2.1) + 0.0004 * Math.sin(s / 297 + 1.3);
    let feat = 0, wmax = 0;
    for (const cv of CURVES) {
      // fade the background wiggle out around the named curves so they read cleanly
      const near = Math.abs(s - cv.c) - cv.len / 2;
      if (near < 260) wmax = Math.max(wmax, Math.min(1, 1 - near / 260));
      feat += cv.k * curveWeight(cv, s);
    }
    return base * (1 - Math.max(0, Math.min(1, wmax))) + feat;
  }
  // 高低差：地域ごとの起伏の大きさを境界の前後600 mでなめらかにつなぎ、勾配はおおむね5%以内（ゲーム用の表現）
  const LAND_RELIEF = { city: 2, town: 4, orchard: 6, rice: 4, hill: 18, forest: 20 };
  function reliefAt(s) {
    const BL = 600;
    let num = 0, den = 0;
    for (const r of REGIONS) {
      const a = r.start - BL, b = r.end + BL;
      if (s < a || s > b) continue;
      let w = 1;
      if (s < r.start + BL) w = Math.min(w, (s - a) / (2 * BL));
      if (s > r.end - BL) w = Math.min(w, (b - s) / (2 * BL));
      w = Math.max(0, Math.min(1, w)); w = w * w * (3 - 2 * w);
      num += w * (LAND_RELIEF[r.land] || 4); den += w;
    }
    return den > 0 ? num / den : 4;
  }
  function elevationRaw(s) {
    const A = reliefAt(s);
    return A * Math.sin(s / 760 + 0.7) + A * 0.25 * Math.sin(s / 310 + 2.0) + 6 * Math.sin(s / 3100);
  }
  function elevation(s) {
    if (PATH) {           // smoothed profile
      let f = (s - PATH_MIN) / PATH_STEP; if (f < 0) f = 0; if (f > PATH.n - 2) f = PATH.n - 2;
      const i = Math.floor(f), t = f - i; return PATH.Y[i] + (PATH.Y[i + 1] - PATH.Y[i]) * t;
    }
    return elevationRaw(s);
  }
  // 勾配（上り＋、下り−）
  function gradeAt(s) { return (elevation(s + 6) - elevation(s - 6)) / 12; }

  const PATH_STEP = 2, PATH_MIN = -2000, PATH_MAX = TOTAL + 2000;
  let PATH = null;
  function buildPath() {
    const n = Math.floor((PATH_MAX - PATH_MIN) / PATH_STEP) + 2;
    const X = new Float64Array(n), Z = new Float64Array(n), H = new Float64Array(n), Y = new Float64Array(n);
    // integrate forward from s=0
    const i0 = Math.round(-PATH_MIN / PATH_STEP);
    X[i0] = 0; Z[i0] = 0; H[i0] = 0;
    for (let i = i0 + 1; i < n; i++) {
      const s = PATH_MIN + i * PATH_STEP;
      H[i] = H[i - 1] + curvature(s - PATH_STEP / 2) * PATH_STEP;
      const hm = (H[i] + H[i - 1]) / 2;
      X[i] = X[i - 1] + Math.sin(hm) * PATH_STEP;
      Z[i] = Z[i - 1] - Math.cos(hm) * PATH_STEP;
    }
    for (let i = i0 - 1; i >= 0; i--) {
      const s = PATH_MIN + i * PATH_STEP;
      H[i] = H[i + 1] - curvature(s + PATH_STEP / 2) * PATH_STEP;
      const hm = (H[i] + H[i + 1]) / 2;
      X[i] = X[i + 1] - Math.sin(hm) * PATH_STEP;
      Z[i] = Z[i + 1] + Math.cos(hm) * PATH_STEP;
    }
    const Y0 = new Float64Array(n);
    for (let i = 0; i < n; i++) Y0[i] = elevationRaw(PATH_MIN + i * PATH_STEP);
    // moving-average smoothing over ±60 m so crests and dips read as gentle slopes
    const W = 30; let acc = 0;
    for (let i = 0; i < Math.min(n, W); i++) acc += Y0[i];
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - W), b = Math.min(n - 1, i + W);
      let sum = 0; for (let j = a; j <= b; j++) sum += Y0[j];
      Y[i] = sum / (b - a + 1);
    }
    PATH = { X: X, Z: Z, H: H, Y: Y, n: n };
  }

  // returns {x,y,z,h} of road centerline at s plus lateral offset
  function pointAt(s, lat, out) {
    if (!PATH) buildPath();
    out = out || {};
    let f = (s - PATH_MIN) / PATH_STEP;
    if (f < 0) f = 0;
    if (f > PATH.n - 2) f = PATH.n - 2;
    const i = Math.floor(f), t = f - i;
    const x = PATH.X[i] + (PATH.X[i + 1] - PATH.X[i]) * t;
    const z = PATH.Z[i] + (PATH.Z[i + 1] - PATH.Z[i]) * t;
    const h = PATH.H[i] + (PATH.H[i + 1] - PATH.H[i]) * t;
    const y = PATH.Y[i] + (PATH.Y[i + 1] - PATH.Y[i]) * t;
    lat = lat || 0;
    out.x = x + Math.cos(h) * lat;
    out.z = z + Math.sin(h) * lat;
    out.y = y;
    out.h = h;
    return out;
  }

  R13.route = {
    LANE_W: LANE_W, SHOULDER: SHOULDER, TOTAL: TOTAL, WIDTH_BLEND: WIDTH_BLEND,
    REGIONS: REGIONS, COURSES: COURSES, SIGNALS: SIGNALS, STATIONS: STATIONS, ITEMS: ITEMS,
    CAMERAS: CAMERAS, YELLOW_ZONES: YELLOW_ZONES, SWITCHES: SWITCHES,
    SPEED_LIMIT_KMH: SPEED_LIMIT_KMH, CAMERA_TRIGGER_KMH: CAMERA_TRIGGER_KMH,
    regionAt: regionAt, regionIndexAt: regionIndexAt, lanesAt: lanesAt, landAt: landAt, laneWidthCount: laneWidthCount,
    halfWidth: halfWidth, nextSwitch: nextSwitch, isYellow: isYellow, signalState: signalState,
    lateralOfLane: lateralOfLane, courseById: courseById, courseSegments: courseSegments,
    courseFeatures: courseFeatures, inCourse: inCourse, standardTime: standardTime,
    curvature: curvature, elevation: elevation, gradeAt: gradeAt, pointAt: pointAt,
    SEASONS: SEASONS, WEATHER_ZONES: WEATHER_ZONES, seasonById: seasonById, weatherAt: weatherAt,
    CURVES: CURVES, TUNNELS: TUNNELS, inTunnel: inTunnel, tunnelAt: tunnelAt,
    SCENE_PLAN: SCENE_PLAN, sceneIndexAt: sceneIndexAt, sceneOptAt: sceneOptAt, landBlend: landBlend,
    RIVERS: RIVERS, riverAt: riverAt, inRiver: inRiver, riverClear: riverClear, SIGHTS: SIGHTS
  };
  if (typeof module !== 'undefined') module.exports = R13;
})(typeof window !== 'undefined' ? window : globalThis);
