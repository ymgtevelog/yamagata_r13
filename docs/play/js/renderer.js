/* renderer.js — 3D表示、品質、景観（Three.js）。車両・建物・樹木・テクスチャはすべてプログラム生成。 */
(function (G) {
  'use strict';
  const R13 = G.R13 = G.R13 || {};
  const THREE = G.THREE;
  const RT = R13.route;
  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;   // hex colors are sRGB
  function lin(c) { return Math.pow(c, 2.2); }

  const CHUNK = 100;
  const QUALITY = {
    light:    { pr: 0.75, shadows: false, shadowSize: 0,    far: 480, density: 0.55, behind: 1 },
    standard: { pr: 1.25, shadows: true,  shadowSize: 1024, far: 680, density: 0.85, behind: 1 },
    high:     { pr: 2.0,  shadows: true,  shadowSize: 2048, far: 900, density: 1.0,  behind: 2 }
  };
  const SCENERY = {
    clear: { name: '青空と実りの道', top: 0x2f7fd0, hor: 0xd4e8f4, fog: 0xc9dfec, sun: 0xfff4e0, sunI: 2.4, hemiSky: 0xbfdcff, hemiGround: 0x6b6a40, hemiI: 0.95,
      sunDir: [0.5, 0.85, 0.35], road: 0x55585d, rough: 0.92, rain: false, lights: false, exposure: 1.0, rainbow: false, cloud: 0xffffff },
    sunset: { name: '夕映え', top: 0x34479a, hor: 0xffb070, fog: 0xf0ae80, sun: 0xffa868, sunI: 2.1, hemiSky: 0xffc8a0, hemiGround: 0x4a3a40, hemiI: 0.8,
      sunDir: [-0.85, 0.16, -0.45], road: 0x5e5e66, rough: 0.7, rain: false, lights: true, exposure: 1.05, rainbow: false, cloud: 0xffc7a0 },
    rain: { name: '雨上がり', top: 0x6f8291, hor: 0xd2d8dc, fog: 0xb4bec4, sun: 0xe8eef2, sunI: 1.0, hemiSky: 0xd8e2ea, hemiGround: 0x4a5246, hemiI: 1.05,
      sunDir: [0.3, 0.6, 0.6], road: 0x3a3e44, rough: 0.28, rain: true, lights: true, exposure: 1.02, rainbow: true, cloud: 0xe4e8ec }
  };

  // 季節ごとの空と光（天気が「青空」のとき）。春＝かすんだ空、夏＝深い青と強い日差し、秋＝高く澄んだ空と金色の光、冬＝淡く冷たい空
  const SEASON_SKY = {
    spring: { top: 0x4a93d6, hor: 0xe3eef0, fog: 0xd2e3e8, sun: 0xfff1da, sunI: 2.25, hemiSky: 0xcfe4ff, hemiGround: 0x7a8050, hemiI: 1.0, cloud: 0xffffff },
    summer: { top: 0x1765c6, hor: 0xcbe5f8, fog: 0xc0dcf0, sun: 0xfff9ea, sunI: 2.75, hemiSky: 0xb4d6ff, hemiGround: 0x5f7038, hemiI: 0.95, cloud: 0xffffff, exposure: 1.03 },
    autumn: { top: 0x2a72c2, hor: 0xe4ecec, fog: 0xd8e2e2, sun: 0xffe8c0, sunI: 2.45, hemiSky: 0xc4dcf6, hemiGround: 0x7a6a40, hemiI: 0.92, cloud: 0xfffaf0 },
    winter: { top: 0x7c9dbd, hor: 0xe9eef2, fog: 0xdde5ec, sun: 0xf2f5ff, sunI: 1.95, hemiSky: 0xdfe9f5, hemiGround: 0x8a9098, hemiI: 1.08, cloud: 0xe9eef3 }
  };
  // 雲の形：[見える数, 横の倍率, 縦の倍率, 高さの倍率, 濃さ]
  const SEASON_CLOUD = { spring: [12, 1.1, 0.85, 1.0, 0.72], summer: [12, 0.95, 1.35, 1.3, 0.92], autumn: [9, 1.5, 0.5, 1.35, 0.6], winter: [16, 1.5, 0.75, 0.8, 0.88] };

  function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function rng(seed) { let s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  // ------------------------------------------------------------ textures
  const texCache = {};
  function canvasTex(key, w, h, draw, repeat) {
    if (texCache[key]) return texCache[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    texCache[key] = t;
    return t;
  }
  const JP_FONT = '"Noto Sans JP","Noto Sans CJK JP","Hiragino Sans","Yu Gothic","Meiryo",sans-serif';
  function signTex(key, w, h, draw) { return canvasTex('sign:' + key, w, h, draw, false); }
  function fitText(g, text, maxW, size, weight) {
    let s = size;
    do { g.font = (weight || 700) + ' ' + s + 'px ' + JP_FONT; s -= 2; } while (g.measureText(text).width > maxW && s > 10);
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function asphaltTex() {
    return canvasTex('asphalt', 256, 256, function (g, w, h) {
      g.fillStyle = '#7a7d82'; g.fillRect(0, 0, w, h);
      const r = rng(7);
      for (let i = 0; i < 9000; i++) {
        const v = 95 + Math.floor(r() * 70);
        g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 4) + ',' + (0.25 + r() * 0.4) + ')';
        g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
      }
      for (let i = 0; i < 6; i++) { // tire tracks
        g.fillStyle = 'rgba(40,40,44,0.08)'; g.fillRect(w * (0.18 + i * 0.13), 0, 14, h);
      }
    }, true);
  }
  function windowTex() {
    return canvasTex('windows', 128, 256, function (g, w, h) {
      g.fillStyle = '#dcdcd6'; g.fillRect(0, 0, w, h);
      const r = rng(31);
      for (let y = 8; y < h; y += 22) for (let x = 8; x < w; x += 20) {
        const lit = r();
        g.fillStyle = lit > 0.82 ? '#f5e7b0' : (lit > 0.4 ? '#6d8496' : '#4d5f6e');
        g.fillRect(x, y, 12, 13);
      }
    }, true);
  }
  // 夕方・雨の日に灯る窓（windowTex と同じ並び）
  function windowLitTex() {
    return canvasTex('windows-lit', 128, 256, function (g, w, h) {
      g.fillStyle = '#000000'; g.fillRect(0, 0, w, h);
      const r = rng(31);
      for (let y = 8; y < h; y += 22) for (let x = 8; x < w; x += 20) {
        const lit = r();
        if (lit > 0.82) { g.fillStyle = '#ffe2a0'; g.fillRect(x, y, 12, 13); }
        else if (lit > 0.52) { g.fillStyle = '#c9a25a'; g.fillRect(x, y, 12, 13); }
      }
    }, true);
  }
  // 住宅の壁：窓と玄関（面ごとに同じ絵。色は建物ごとに掛け合わせる）
  function houseTex(lit) {
    return canvasTex(lit ? 'house-lit' : 'house', 128, 64, function (g, w, h) {
      g.fillStyle = lit ? '#000000' : '#ffffff'; g.fillRect(0, 0, w, h);
      if (!lit) { g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(0, h - 9, w, 9); g.fillStyle = 'rgba(0,0,0,0.05)'; for (let y = 6; y < h - 9; y += 6) g.fillRect(0, y, w, 1); }
      const win = function (x, y, ww, hh, on) {
        if (lit) { if (on) { g.fillStyle = '#ffd98a'; g.fillRect(x, y, ww, hh); } return; }
        g.fillStyle = '#f4f4f0'; g.fillRect(x - 2, y - 2, ww + 4, hh + 4);
        g.fillStyle = '#44566a'; g.fillRect(x, y, ww, hh);
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + ww / 2 - 1, y, 2, hh);
      };
      win(12, 8, 22, 15, true); win(52, 8, 22, 15, false); win(94, 8, 22, 15, true);
      win(12, 36, 22, 16, false); win(94, 36, 22, 16, true);
      if (!lit) { g.fillStyle = '#6a4a34'; g.fillRect(55, 34, 16, 30); g.fillStyle = '#d8c070'; g.fillRect(67, 48, 2, 3); }
    });
  }
  // 水面のさざ波（明るい筋がゆっくり流れる）
  function waterTex() {
    return canvasTex('water', 256, 256, function (g, w, h) {
      g.fillStyle = '#c4c9cc'; g.fillRect(0, 0, w, h);
      const r = rng(57);
      for (let i = 0; i < 260; i++) {
        const x = r() * w, y = r() * h, len = 14 + r() * 46;
        g.strokeStyle = 'rgba(255,255,255,' + (0.18 + r() * 0.5) + ')'; g.lineWidth = 1 + r() * 2;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + len / 2, y + (r() - 0.5) * 6, x + len, y); g.stroke();
        if (x + len > w) { g.beginPath(); g.moveTo(x - w, y); g.lineTo(x - w + len, y); g.stroke(); }
      }
      for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(40,60,70,' + (0.05 + r() * 0.1) + ')'; g.fillRect(r() * w, r() * h, 20 + r() * 50, 2 + r() * 3); }
    }, true);
  }
  // 花びら・落ち葉の粒
  function petalTex() {
    return canvasTex('petal', 32, 32, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(16, 16, 12, 7, 0.6, 0, Math.PI * 2); g.fill();
    });
  }
  function grassTex() {
    return canvasTex('grass', 256, 256, function (g, w, h) {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      const r = rng(11);
      for (let i = 0; i < 7000; i++) {
        const v = 200 + Math.floor(r() * 55);
        g.fillStyle = 'rgba(' + (v - 30) + ',' + v + ',' + (v - 60) + ',0.35)';
        g.fillRect(r() * w, r() * h, 2, 3 + r() * 4);
      }
    }, true);
  }
  function paddyTex() {
    return canvasTex('paddy', 128, 128, function (g, w, h) {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 6) { g.fillStyle = 'rgba(120,90,20,0.18)'; g.fillRect(0, y, w, 2); }
      const r = rng(5);
      for (let i = 0; i < 1500; i++) { g.fillStyle = 'rgba(255,240,180,0.25)'; g.fillRect(r() * w, r() * h, 1, 3); }
    }, true);
  }

  // ------------------------------------------------------------ geometry helpers
  function taperedBox(w, h, l, topW, topL, shiftZ) {
    const g = new THREE.BoxGeometry(w, h, l);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > 0) {
        p.setX(i, p.getX(i) * topW);
        p.setZ(i, p.getZ(i) * topL + (shiftZ || 0));
      }
    }
    g.computeVertexNormals();
    return g;
  }
  function roofGeom(w, l, h) {
    // gable roof prism (ridge along length)
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 - 0.4, 0); shape.lineTo(w / 2 + 0.4, 0); shape.lineTo(0, h); shape.lineTo(-w / 2 - 0.4, 0);
    const g = new THREE.ExtrudeGeometry(shape, { depth: l + 0.6, bevelEnabled: false });
    g.translate(0, 0, -(l + 0.6) / 2);
    return g;
  }

  // ------------------------------------------------------------ Renderer
  function Renderer(canvas) {
    this.canvas = canvas;
    this.quality = 'standard';
    this.sceneryId = 'clear';
    this.chunks = new Map();
    this.mats = {};
    this.time = 0;
    this.shake = 0;
    this.camMode = 'chase';
    this.season = 'autumn';
    this.anims = new Set();            // 動きのある目印（パラグライダー・飛行機・湯気）
    this.weatherW = 0; this.weatherType = null; this.tunnelDim = 0; this.flash = 0; this.nextBolt = 5;
    this.ghostMesh = null; this.ghost = null;
    this.photo = null;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.camInit = false;
    this.npcMeshes = [];
    this._tmp = {};
    this._initThree();
  }

  Renderer.prototype._initThree = function () {
    const r = this.r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.3, 3200);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.shadow.camera.left = -45; this.sun.shadow.camera.right = 45;
    this.sun.shadow.camera.top = 45; this.sun.shadow.camera.bottom = -45;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 260;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.scene.fog = new THREE.Fog(0xcccccc, 60, 700);

    this.world = new THREE.Group(); this.scene.add(this.world);
    this._materials();
    this._sky();
    this._mountains();
    this._clouds();
    this._rain();
    this._birds();
    this._farGround();
    this.player = new THREE.Group(); this.scene.add(this.player);
    this.resize();
  };

  Renderer.prototype._materials = function () {
    const M = this.mats;
    const at = asphaltTex();
    M.road = new THREE.MeshStandardMaterial({ map: at, color: 0x5a5d62, roughness: 0.9, metalness: 0.0 });
    M.bay = new THREE.MeshStandardMaterial({ map: at, color: 0x6b6d72, roughness: 0.9 });
    M.white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    M.yellow = new THREE.MeshStandardMaterial({ color: 0xf2b82a, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    M.green = new THREE.MeshStandardMaterial({ color: 0x3d7a4a, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    M.ground = new THREE.MeshLambertMaterial({ vertexColors: true, map: grassTex() });
    M.paddy = new THREE.MeshLambertMaterial({ map: paddyTex(), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    M.trunk = new THREE.MeshLambertMaterial({ color: 0x5a4632 });
    M.leaf = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    M.cedar = new THREE.MeshLambertMaterial({ color: 0x2f5233, flatShading: true });
    M.bldg = new THREE.MeshLambertMaterial({ color: 0xffffff, map: windowTex(), emissive: 0xffffff, emissiveMap: windowLitTex(), emissiveIntensity: 0 });
    M.wall = new THREE.MeshLambertMaterial({ color: 0xffffff });
    M.roof = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    M.pole = new THREE.MeshLambertMaterial({ color: 0x8e8a82 });
    M.metal = new THREE.MeshStandardMaterial({ color: 0x9aa3a8, roughness: 0.4, metalness: 0.6 });
    M.dark = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.6 });
    M.glass = new THREE.MeshStandardMaterial({ color: 0x1c2833, roughness: 0.08, metalness: 0.9 });
    M.tire = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
    M.rim = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.3, metalness: 0.8 });
    M.head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d0, emissiveIntensity: 0.4 });
    M.arrowRed = new THREE.MeshLambertMaterial({ color: 0xd8322b });
    M.arrowWhite = new THREE.MeshLambertMaterial({ color: 0xf6f6f2 });
    this.waterMap = waterTex(); this.waterMap.repeat.set(1, 1);
    M.water = new THREE.MeshStandardMaterial({ color: 0x5f8ea8, map: this.waterMap, roughness: 0.22, metalness: 0.2, side: THREE.DoubleSide });
    M.water.envMapIntensity = 0.6;
    M.house = new THREE.MeshLambertMaterial({ color: 0xffffff, map: houseTex(false), emissive: 0xffffff, emissiveMap: houseTex(true), emissiveIntensity: 0 });
    M.guard = new THREE.MeshLambertMaterial({ color: 0xf0f1f1, emissive: 0x6a6c6e, side: THREE.DoubleSide });          // ガードレール
    M.lamp = new THREE.MeshStandardMaterial({ color: 0xe8e8e0, emissive: 0xfff0c8, emissiveIntensity: 0 });   // 街路灯の灯具（夕方・雨で点灯）
    M.fruit = new THREE.MeshLambertMaterial({ color: 0xffffff });
    M.plot = new THREE.MeshLambertMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    M.rail = new THREE.MeshLambertMaterial({ color: 0xc9cfd3, side: THREE.DoubleSide });
    // 前照灯が路面を照らす光（夕方・雨・トンネルで見える）
    M.beam = new THREE.MeshBasicMaterial({ map: beamTex(), color: 0xfff2cc, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    M.beam.toneMapped = false;
    M.flagpole = new THREE.MeshLambertMaterial({ color: 0xf2f2ee });
    M.lampOff = new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.5 });
    M.lampG = new THREE.MeshStandardMaterial({ color: 0x1fc9c0, emissive: 0x16e0d0, emissiveIntensity: 2.2 });
    M.lampY = new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xffa500, emissiveIntensity: 2.2 });
    M.lampR = new THREE.MeshStandardMaterial({ color: 0xff3020, emissive: 0xff2010, emissiveIntensity: 2.4 });

    // shared geometries
    const GE = this.geo = {};
    GE.trunk = new THREE.CylinderGeometry(0.18, 0.26, 1, 6); GE.trunk.translate(0, 0.5, 0);
    GE.canopy = new THREE.IcosahedronGeometry(1, 0);
    GE.cedar = new THREE.ConeGeometry(1, 1, 7); GE.cedar.translate(0, 0.5, 0);
    GE.box = new THREE.BoxGeometry(1, 1, 1); GE.box.translate(0, 0.5, 0);
    GE.roof = roofGeom(1, 1, 0.45);
    GE.pole = new THREE.CylinderGeometry(0.13, 0.16, 1, 6); GE.pole.translate(0, 0.5, 0);
    GE.plane = new THREE.PlaneGeometry(1, 1); GE.plane.rotateX(-Math.PI / 2);
    GE.fruit = new THREE.IcosahedronGeometry(0.16, 0);
    GE.arrow = new THREE.BoxGeometry(0.09, 0.42, 0.09);
    GE.flagpole = new THREE.CylinderGeometry(0.03, 0.03, 3.7, 5); GE.flagpole.translate(0, 1.85, 0);
    GE.flag = new THREE.PlaneGeometry(0.76, 2.4); GE.flag.translate(0.41, 2.42, 0);
  };

  // ------------------------------------------------------------ sky / backdrop
  Renderer.prototype._sky = function () {
    const geo = new THREE.SphereGeometry(2800, 32, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunCol: { value: new THREE.Color() }, rainbow: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: [
        'uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float rainbow; varying vec3 vP;',
        'vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); }',
        'void main(){ float h = clamp(vP.y,0.0,1.0); vec3 c = mix(hor, top, pow(h,0.55));',
        ' if (vP.y < 0.0) c = hor;',
        ' float sd = max(dot(vP, normalize(sunDir)),0.0);',
        ' c += sunCol * (pow(sd, 900.0)*2.2 + pow(sd, 12.0)*0.25);',
        ' if (rainbow > 0.0) { vec3 ad = normalize(vec3(-sunDir.x, -sunDir.y, -sunDir.z)); float ang = acos(clamp(dot(vP, ad),-1.0,1.0));',
        '   float t = (ang - 0.69)/0.05; if (t>0.0 && t<1.0 && vP.y>0.0) c = mix(c, c + hue(t*0.8)*0.35, rainbow*smoothstep(0.0,0.25,vP.y)*sin(t*3.14159)); }',
        ' gl_FragColor = linearToOutputTexel(vec4(c,1.0)); }'
      ].join('\n')
    });
    this.sky = new THREE.Mesh(geo, this.skyMat);
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
  };

  // 遠景の山並み（方角は固定：東＝蔵王連峰、西＝月山・朝日連峰）。霧に埋もれないよう fog は切り、
  // 霞（空気遠近）は頂点色に混ぜる。色は季節ごとに塗り替える（_paintMountains）。
  Renderer.prototype._mountains = function () {
    const group = new THREE.Group();
    const segs = 144;
    const r = rng(1313);
    const heights = [];
    for (let i = 0; i <= segs; i++) {
      const a = i / segs * Math.PI * 2;
      let h = 90 + 150 * Math.abs(Math.sin(a * 3.1 + 1)) + 70 * r() + 60 * Math.abs(Math.sin(a * 11.3));
      // 蔵王連峰 (east, +X) and 月山 (west, -X) as big masses
      const east = Math.exp(-Math.pow((a - 0) / 0.28, 2)) + Math.exp(-Math.pow((a - Math.PI * 2) / 0.28, 2));
      const west = Math.exp(-Math.pow((a - Math.PI) / 0.33, 2));
      h += east * 330 + west * 420;
      heights.push(h);
    }
    heights[segs] = heights[0];
    // 面ごとに色を塗る（ローポリの稜線がはっきり出る）。5段に分け、中腹の頂点を少しずらして尾根と谷を作る。
    const ROWS = [0, 0.34, 0.6, 0.82, 1], R1 = 2050, R0 = 2420, BASE = -40;
    const grid = [];
    for (let i = 0; i <= segs; i++) {
      const col = [], a = i / segs * Math.PI * 2, h = heights[i];
      for (let row = 0; row < ROWS.length; row++) {
        const f = ROWS[row], mid = row > 0 && row < ROWS.length - 1;
        const ii = i % segs;
        const rad = R0 + (R1 - R0) * f + (mid ? (hash(ii * 5.3 + row * 9.7) - 0.5) * 70 : 0);
        const y = BASE + (h - BASE) * f * (mid ? 0.9 + hash(ii * 2.9 + row * 4.1) * 0.2 : 1);
        col.push([Math.cos(a) * rad, y, Math.sin(a) * rad]);
      }
      grid.push(col);
    }
    const pos = [], col = [], meta = [];
    const tri = function (p, q, s, i, row, n) {
      [p, q, s].forEach(function (v) { pos.push(v[0], v[1], v[2]); col.push(1, 1, 1); });
      // 面の向き（東西南北どちらを向くか）で明暗を付ける
      const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = s[0] - p[0], vy = s[1] - p[1], vz = s[2] - p[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const cx = (p[0] + q[0] + s[0]) / 3, cz = (p[2] + q[2] + s[2]) / 3;
      if (nx * cx + nz * cz > 0) { nx = -nx; ny = -ny; nz = -nz; }                // 内側（道路側）を向く法線
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      meta.push({ row: row, y: (p[1] + q[1] + s[1]) / 3, top: Math.max(heights[i], heights[i + 1]), k: hash(i * 7.3 + row * 1.7 + n * 3.1), n: [nx / len, ny / len, nz / len] });
    };
    for (let i = 0; i < segs; i++) {
      for (let row = 0; row < ROWS.length - 1; row++) {
        const p00 = grid[i][row], p10 = grid[i + 1][row], p11 = grid[i + 1][row + 1], p01 = grid[i][row + 1];
        if ((i + row) % 2) { tri(p00, p10, p11, i, row, 0); tri(p00, p11, p01, i, row, 1); }
        else { tri(p00, p10, p01, i, row, 0); tri(p10, p11, p01, i, row, 1); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    // 照明の影響を受けない塗り（季節の色がそのまま出る）。陰影は面ごとの色に焼き込む。
    this.mountMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide });
    this.mountMat.toneMapped = false;
    this.mountGeo = g; this.mountMeta = meta;
    group.add(new THREE.Mesh(g, this.mountMat));
    // nearer foothills ring（里山）
    const pos2 = [], col2 = [], meta2 = [];
    const R2 = 1100, R3 = 1500, fs = 120;
    const fh = function (i) { const j = ((i % fs) + fs) % fs; return 26 + 62 * hash(j * 3.3) + 26 * Math.abs(Math.sin(j * 0.7)); };
    for (let i = 0; i < fs; i++) {
      const a0 = i / fs * Math.PI * 2, a1 = (i + 1) / fs * Math.PI * 2;
      const pA = [Math.cos(a0) * R3, -30, Math.sin(a0) * R3], pB = [Math.cos(a1) * R3, -30, Math.sin(a1) * R3];
      const pC = [Math.cos(a1) * R2, fh(i + 1), Math.sin(a1) * R2], pD = [Math.cos(a0) * R2, fh(i), Math.sin(a0) * R2];
      [[pA, pB, pC], [pA, pC, pD]].forEach(function (tr, n) {
        tr.forEach(function (v) { pos2.push(v[0], v[1], v[2]); col2.push(1, 1, 1); });
        meta2.push({ k: hash(i * 5.1 + n * 0.37), sh: 0.8 + 0.2 * hash(i * 2.3 + n * 1.9), lit: (i + n) % 2 });
      });
    }
    const g2 = new THREE.BufferGeometry();
    this.footGeo = g2; this.footMeta = meta2;
    g2.setAttribute('position', new THREE.Float32BufferAttribute(pos2, 3));
    g2.setAttribute('color', new THREE.Float32BufferAttribute(col2, 3));
    group.add(new THREE.Mesh(g2, this.mountMat));
    this.mountains = group;
    this.scene.add(group);
    this._paintMountains();
  };

  // 季節ごとの山の色：春＝新緑と残雪、夏＝深い緑（高い峰にわずかな残雪）、秋＝紅葉と初冠雪、冬＝雪山
  const MOUNT_LOOK = {
    spring: { low: [[0.47, 0.66, 0.36], [0.56, 0.72, 0.42], [0.5, 0.68, 0.38], [0.52, 0.7, 0.4], [0.49, 0.67, 0.37], [0.54, 0.71, 0.41], [0.45, 0.64, 0.35], [0.86, 0.74, 0.76]], mid: [[0.38, 0.55, 0.36], [0.44, 0.6, 0.4]], high: [0.5, 0.56, 0.54], snow: 300, foot: [[0.5, 0.7, 0.38], [0.6, 0.76, 0.44], [0.54, 0.72, 0.4], [0.56, 0.74, 0.42], [0.48, 0.68, 0.36], [0.92, 0.76, 0.8]], haze: 0.3 },
    summer: { low: [[0.2, 0.44, 0.22], [0.25, 0.5, 0.25]], mid: [[0.17, 0.38, 0.24], [0.21, 0.42, 0.26]], high: [0.3, 0.44, 0.36], snow: 700, foot: [[0.22, 0.48, 0.22], [0.28, 0.54, 0.26]], haze: 0.3 },
    autumn: { low: [[0.7, 0.4, 0.16], [0.78, 0.56, 0.18], [0.6, 0.26, 0.14], [0.4, 0.46, 0.22]], mid: [[0.62, 0.34, 0.16], [0.52, 0.4, 0.2], [0.7, 0.48, 0.18]], high: [0.46, 0.4, 0.34], snow: 560, foot: [[0.74, 0.42, 0.16], [0.82, 0.6, 0.2], [0.58, 0.26, 0.14], [0.42, 0.5, 0.24]], haze: 0.26 },
    winter: { low: [[0.86, 0.89, 0.93], [0.82, 0.86, 0.9]], mid: [[0.92, 0.94, 0.97], [0.88, 0.91, 0.95]], high: [0.97, 0.98, 1.0], snow: -100, foot: [[0.84, 0.88, 0.92], [0.9, 0.92, 0.95], [0.7, 0.76, 0.78]], haze: 0.2 }
  };
  Renderer.prototype._paintMountains = function () {
    const L = MOUNT_LOOK[this.season] || MOUNT_LOOK.autumn;
    const S = this._S();
    const hz = new THREE.Color(S.hor);                         // 霞の色＝地平線の空の色（sRGB）
    const sd = S.sunDir, sl = Math.sqrt(sd[0] * sd[0] + sd[1] * sd[1] + sd[2] * sd[2]) || 1;
    const mix = function (c, k, sh) { sh = sh || 1; return [lin(c[0] * sh + (hz.r - c[0] * sh) * k), lin(c[1] * sh + (hz.g - c[1] * sh) * k), lin(c[2] * sh + (hz.b - c[2] * sh) * k)]; };
    const pickc = function (arr, k) { return arr[Math.min(arr.length - 1, Math.floor(k * arr.length))]; };
    const SNOW = [0.96, 0.975, 1.0], SNOW_SHADE = [0.78, 0.84, 0.94];
    if (this.mountGeo) {
      const col = this.mountGeo.attributes.color, M = this.mountMeta;
      for (let f = 0; f < M.length; f++) {
        const m = M[f];
        // 日なたと日かげ：面の向きと太陽の方向
        const facing = Math.max(0, (m.n[0] * sd[0] + m.n[1] * sd[1] + m.n[2] * sd[2]) / sl);
        const sh = 0.72 + 0.3 * facing + (m.k - 0.5) * 0.08;
        let c, snowy = false;
        if (m.y > L.snow && m.top > L.snow + 40) { snowy = true; c = facing > 0.25 ? SNOW : SNOW_SHADE; }
        else if (m.row === 0) c = pickc(L.low, m.k);
        else if (m.row === 1) c = pickc(m.k < 0.5 ? L.low : L.mid, (m.k * 2) % 1);
        else if (m.row === 2) c = pickc(L.mid, m.k);
        else c = L.high;
        const o = mix(c, L.haze + 0.06 + (m.row === 0 ? 0.12 : 0), snowy ? 1 : sh);
        col.setXYZ(f * 3, o[0], o[1], o[2]); col.setXYZ(f * 3 + 1, o[0], o[1], o[2]); col.setXYZ(f * 3 + 2, o[0], o[1], o[2]);
      }
      col.needsUpdate = true;
    }
    if (this.footGeo) {
      const c2 = this.footGeo.attributes.color, F = this.footMeta;
      for (let f = 0; f < F.length; f++) {
        const o = mix(pickc(L.foot, F[f].k), L.haze - 0.06, F[f].sh * (F[f].lit ? 1.0 : 0.9));
        c2.setXYZ(f * 3, o[0], o[1], o[2]); c2.setXYZ(f * 3 + 1, o[0], o[1], o[2]); c2.setXYZ(f * 3 + 2, o[0], o[1], o[2]);
      }
      c2.needsUpdate = true;
    }
  };

  Renderer.prototype._clouds = function () {
    const tex = canvasTex('cloud', 256, 128, function (g, w, h) {
      const r = rng(77);
      for (let i = 0; i < 22; i++) {
        const x = w * (0.15 + r() * 0.7), y = h * (0.35 + r() * 0.35), rad = 18 + r() * 36;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }
    });
    this.cloudMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
    this.clouds = new THREE.Group();
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(this.cloudMat);
      const a = hash(i * 9.1) * Math.PI * 2, d = 900 + hash(i * 2.7) * 1300;
      s.position.set(Math.cos(a) * d, 260 + hash(i * 5.3) * 380, Math.sin(a) * d);
      const sc = 500 + hash(i * 4.4) * 600; s.scale.set(sc, sc * 0.42, 1);
      s.userData = { sc: sc, y: s.position.y };
      this.clouds.add(s);
    }
    this.scene.add(this.clouds);
  };

  // 空を渡る鳥の群れ（冬は白鳥）。ときどき現れて空を横切る
  Renderer.prototype._birds = function () {
    const g = this.birds = new THREE.Group();
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, -0.28, 0, 0, 0.3, 1.5, 0, 0.12]), 3));
    wing.computeVertexNormals();
    this.birdMat = new THREE.MeshBasicMaterial({ color: 0x2a2f36, side: THREE.DoubleSide });
    this.birdWings = [];
    const slots = [[0, 0, 0], [-3.2, 0.4, 3.4], [3.3, -0.3, 3.6], [-6.4, 0.2, 7.1], [6.6, 0.5, 7.4], [-9.4, -0.4, 10.6], [9.8, 0.1, 11.2]];
    for (let i = 0; i < slots.length; i++) {
      const b = new THREE.Group(); b.position.set(slots[i][0], slots[i][1], slots[i][2]);
      const l = new THREE.Mesh(wing, this.birdMat), r = new THREE.Mesh(wing, this.birdMat); r.scale.x = -1;
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.5, 4), this.birdMat); body.rotation.x = -Math.PI / 2;
      b.add(l); b.add(r); b.add(body); b.userData.ph = i * 0.9;
      this.birdWings.push([l, r, b]); g.add(b);
    }
    g.visible = false;
    this.birdT = 6; this.birdOn = false; this.birdSeed = 1;
    this.scene.add(g);
  };
  Renderer.prototype._birdsUpdate = function (dt, sim, bad, inTun) {
    const g = this.birds; if (!g) return;
    const rainy = SCENERY[this.sceneryId].rain;
    this.birdT -= dt;
    if (!this.birdOn) {
      g.visible = false;
      if (this.birdT > 0 || bad > 0.2 || inTun || rainy) return;
      // 次の群れ：進行方向の左右どちらかの空から現れ、斜めに横切る
      const r1 = hash(this.birdSeed * 3.1), r2 = hash(this.birdSeed * 7.7), r3 = hash(this.birdSeed * 11.3); this.birdSeed++;
      const winter = this.season === 'winter';
      this.birdMat.color.setHex(winter ? 0xf4f6f8 : (this.sceneryId === 'sunset' ? 0x1c1a20 : 0x2a2f36));
      const dirSide = r1 < 0.5 ? -1 : 1;
      this.birdP = { side: dirSide, x: -dirSide * (150 + r2 * 60), y: 34 + r3 * 26, z: -(150 + r2 * 120), vx: dirSide * (11 + r3 * 5), vz: -(3 + r1 * 6), n: winter ? 7 : (3 + Math.floor(r2 * 5)), sc: winter ? 2.1 : 1.25, flap: winter ? 5.2 : 8.5 };
      for (let i = 0; i < this.birdWings.length; i++) this.birdWings[i][2].visible = i < this.birdP.n;
      g.scale.setScalar(this.birdP.sc);
      this.birdOn = true; this.birdT = 26;
    }
    const P = this.birdP;
    if (this.birdT <= 0 || bad > 0.5 || inTun) { this.birdOn = false; this.birdT = 18 + hash(this.birdSeed * 5.9) * 30; g.visible = false; return; }
    P.x += P.vx * dt; P.z += P.vz * dt;
    // カメラの向きを基準にした位置（進行方向が −z）
    const cam = this.camera, h = Math.atan2(this.camLook.x - this.camPos.x, this.camLook.z - this.camPos.z);
    const sn = Math.sin(h), cs = Math.cos(h);
    const fx = -P.z, rx = P.x;                           // 前方へ fx、右へ rx
    g.position.set(cam.position.x + sn * fx - cs * rx, cam.position.y + P.y, cam.position.z + cs * fx + sn * rx);
    g.rotation.y = h + Math.PI + Math.atan2(-P.vx, -P.vz) * -1;
    const t = this.time;
    for (let i = 0; i < P.n; i++) {
      const w = this.birdWings[i], a = Math.sin(t * P.flap + w[2].userData.ph) * 0.6;
      w[0].rotation.z = a; w[1].rotation.z = -a;
      w[2].position.y += (Math.sin(t * 1.3 + w[2].userData.ph * 2) * 0.004);
    }
    g.visible = true;
  };

  Renderer.prototype._rain = function () {
    const n = 1400, pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 60, y = Math.random() * 30, z = (Math.random() - 0.5) * 60;
      pos.set([x, y, z, x + 0.05, y - 0.7, z], i * 6);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: 0xc8d4dc, transparent: true, opacity: 0.35, fog: false });
    this.rainMesh = new THREE.LineSegments(g, this.rainMat);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.visible = false;
    this.scene.add(this.rainMesh);
    // snowfall (冬の降雪区間)
    const ns = 1600, sp = new Float32Array(ns * 3);
    for (let i = 0; i < ns; i++) sp.set([(Math.random() - 0.5) * 70, Math.random() * 28, (Math.random() - 0.5) * 70], i * 3);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
    this.snowMesh = new THREE.Points(sg, this.snowMat);
    this.snowMesh.frustumCulled = false; this.snowMesh.visible = false;
    this.scene.add(this.snowMesh);
    // 季節の空気感：春は桜の花びら、秋は落ち葉が舞う（走行には影響しない演出）
    const na = 320, ap = new Float32Array(na * 3), ac = new Float32Array(na * 3);
    for (let i = 0; i < na; i++) ap.set([(Math.random() - 0.5) * 56, Math.random() * 20, (Math.random() - 0.5) * 56], i * 3);
    const ag = new THREE.BufferGeometry();
    ag.setAttribute('position', new THREE.BufferAttribute(ap, 3)); ag.setAttribute('color', new THREE.BufferAttribute(ac, 3));
    this.airMat = new THREE.PointsMaterial({ size: 0.24, map: petalTex(), vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, alphaTest: 0.3, fog: false });
    this.airMesh = new THREE.Points(ag, this.airMat);
    this.airMesh.frustumCulled = false; this.airMesh.visible = false;
    this.scene.add(this.airMesh);
    this._styleAir();
  };
  const AIR_COLORS = { spring: [0xffd3e2, 0xffe6ee, 0xf9b8cf, 0xffffff], autumn: [0xe07a1c, 0xc9401e, 0xe8b02a, 0x9a5a22, 0xd9602a] };
  Renderer.prototype._styleAir = function () {
    if (!this.airMesh) return;
    const pal = AIR_COLORS[this.season], ca = this.airMesh.geometry.attributes.color, c = new THREE.Color();
    this.airOn = !!pal;
    if (pal) { for (let i = 0; i < ca.count; i++) { c.setHex(pal[i % pal.length]); ca.setXYZ(i, c.r, c.g, c.b); } ca.needsUpdate = true; }
    this.airMat.size = this.season === 'autumn' ? 0.32 : 0.27;
    this.airMesh.geometry.setDrawRange(0, Math.round(ca.count * (QUALITY[this.quality].density >= 0.8 ? 1 : 0.5)));
  };

  // 遠景の地面は、見えている範囲の道路の最低点よりさらに下に置く（下り坂の先や川・湖を覆わない）
  Renderer.prototype._farY = function (s) {
    const far = QUALITY[this.quality].far;
    let m = Infinity;
    for (let q = s - 240; q <= s + far + 160; q += 40) { const y = RT.pointAt(q, 0).y; if (y < m) m = y; }
    const y = m - 6;
    this._farYv = (this._farYv == null || Math.abs(y - this._farYv) > 3) ? y : this._farYv + (y - this._farYv) * 0.08;   // 大きく離れたら即座に合わせる（再開・移動直後）
    return this._farYv;
  };
  Renderer.prototype._farGround = function () {
    const g = new THREE.CircleGeometry(2400, 48); g.rotateX(-Math.PI / 2);
    this.farGroundMat = new THREE.MeshLambertMaterial({ color: 0x6f8a4a });
    this.farGround = new THREE.Mesh(g, this.farGroundMat);
    this.scene.add(this.farGround);
  };

  // ------------------------------------------------------------ settings
  Renderer.prototype.setQuality = function (q) {
    this.quality = QUALITY[q] ? q : 'standard';
    const Q = QUALITY[this.quality];
    const pr = Math.min(Q.pr, G.devicePixelRatio || 1);
    this.r.setPixelRatio(pr);
    this.r.shadowMap.enabled = Q.shadows;
    this.sun.castShadow = Q.shadows;
    if (Q.shadows) { this.sun.shadow.mapSize.set(Q.shadowSize, Q.shadowSize); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    this.scene.traverse(function (o) { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(function (m) { m.needsUpdate = true; }); } });
    this.resize();
    this.applyScenery();
    this.clearChunks();
  };

  Renderer.prototype.setSeason = function (id) {
    const next = SEASON_LOOK[id] ? id : 'autumn';
    if (next === this.season) return;
    this.season = next;
    const L = SEASON_LOOK[next];
    this.mats.cedar.color.setHex(L.cedar);
    this._styleAir();
    this.applyScenery();
    this.clearChunks();
  };

  Renderer.prototype.setScenery = function (id) { this.sceneryId = SCENERY[id] ? id : 'clear'; this.applyScenery(); };
  // 天気と季節を合わせた見た目の設定
  Renderer.prototype._S = function () {
    const S = SCENERY[this.sceneryId] || SCENERY.clear;
    return this.sceneryId === 'clear' && SEASON_SKY[this.season] ? Object.assign({}, S, SEASON_SKY[this.season]) : S;
  };
  Renderer.prototype._styleClouds = function () {
    const c = (this.sceneryId === 'clear' && SEASON_CLOUD[this.season]) || [16, 1, 1, 1, this.sceneryId === 'rain' ? 0.95 : 0.85];
    this.clouds.children.forEach(function (s, i) {
      const b = s.userData;
      s.visible = i < c[0];
      const tall = (i % 4 === 0) ? 1.25 : 1;                       // 一部は背の高い雲（夏は入道雲）
      s.scale.set(b.sc * c[1], b.sc * 0.42 * c[2] * (c[2] > 1.2 ? tall : 1), 1);
      s.position.y = b.y * c[3] + (c[2] > 1.2 && i % 4 === 0 ? -60 : 0);
    });
    this.cloudMat.opacity = c[4];
  };
  Renderer.prototype.applyScenery = function () {
    const S = this._S(), Q = QUALITY[this.quality];
    this.skyMat.uniforms.top.value.setHex(S.top);
    this.skyMat.uniforms.hor.value.setHex(S.hor);
    this.skyMat.uniforms.sunCol.value.setHex(S.sun);
    this.skyMat.uniforms.sunDir.value.set(S.sunDir[0], S.sunDir[1], S.sunDir[2]).normalize();
    this.skyMat.uniforms.rainbow.value = S.rainbow ? 1 : 0;
    this.scene.fog.color.setHex(S.fog);
    this.scene.fog.near = S.rain ? 40 : 70;
    this.scene.fog.far = Q.far * (S.rain ? 0.85 : 1);
    this.scene.background = new THREE.Color(S.hor);
    this.sun.color.setHex(S.sun); this.sun.intensity = S.sunI;
    this.hemi.color.setHex(S.hemiSky); this.hemi.groundColor.setHex(S.hemiGround); this.hemi.intensity = S.hemiI;
    this.mats.road.color.setHex(S.road); this.mats.road.roughness = S.rough; this.mats.road.metalness = S.rain ? 0.25 : 0;
    this.mats.bay.roughness = S.rain ? 0.35 : 0.9;
    this.cloudMat.color.setHex(S.cloud);
    this._styleClouds();
    this._styleAir();
    const litK = S.lights ? (this.sceneryId === 'sunset' ? 1.0 : 0.6) : 0;        // 夕方・雨：窓と街路灯がともる
    this.mats.bldg.emissiveIntensity = litK * 0.9; this.mats.house.emissiveIntensity = litK * 0.8; this.mats.lamp.emissiveIntensity = litK * 2.6;
    this.mountMat.color.setHex(this.sceneryId === 'sunset' ? 0xd9b0b4 : (S.rain ? 0xd0d6da : 0xffffff));
    this._paintMountains();
    const SL = SEASON_LOOK[this.season] || SEASON_LOOK.autumn;
    this.farGroundMat.color.setHex(this.sceneryId === 'sunset' && this.season !== 'winter' ? 0x5d5a3a : SL.far);
    this.baseRoad = S.road;
    if (this.season === 'winter') this.mats.road.color.setHex(0x6e737a);
    this.rainMesh.visible = S.rain;
    this.base = { fogNear: this.scene.fog.near, fogFar: this.scene.fog.far, fog: this.scene.fog.color.clone(),
      top: this.skyMat.uniforms.top.value.clone(), hor: this.skyMat.uniforms.hor.value.clone(), sunI: this.sun.intensity, hemiI: this.hemi.intensity,
      hemiSky: this.hemi.color.clone(), hemiGround: this.hemi.groundColor.clone(),
      road: this.mats.road.color.clone(), rough: this.mats.road.roughness, metal: this.mats.road.metalness, rain: S.rain ? 0.35 : 0 };
    this.r.toneMappingExposure = S.exposure;
    this.mats.head.emissiveIntensity = S.lights ? 2.5 : 0.4;
    this._env();
  };

  Renderer.prototype._env = function () {
    // environment map from a simple gradient sky so car paint and wet road reflect the scenery
    try {
      const S = this._S();
      const es = new THREE.Scene();
      const m = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.ShaderMaterial({
        side: THREE.BackSide, uniforms: { top: { value: new THREE.Color(S.top) }, hor: { value: new THREE.Color(S.hor) }, gr: { value: new THREE.Color(0x5a5a50) } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 gr; varying vec3 vP; void main(){ vec3 c = vP.y>0.0 ? mix(hor, top, pow(vP.y,0.6)) : mix(hor, gr, min(1.0,-vP.y*4.0)); gl_FragColor=vec4(c*1.25,1.0);}'
      }));
      es.add(m);
      const pm = new THREE.PMREMGenerator(this.r);
      const rt = pm.fromScene(es, 0.02);
      if (this.envRT) this.envRT.dispose();
      this.envRT = rt;
      this.scene.environment = rt.texture;
      pm.dispose(); m.geometry.dispose(); m.material.dispose();
    } catch (e) { /* environment is optional */ }
  };

  Renderer.prototype.resize = function () {
    const w = G.innerWidth || 1280, h = G.innerHeight || 720;
    this.r.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  // merge child meshes of a group by material (cuts draw calls for NPC cars)
  function mergeByMaterial(g) {
    const buckets = new Map(), remove = [];
    g.children.forEach(function (m) {
      if (!m.isMesh || m.userData.noMerge) return;
      const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      m.updateMatrix();
      geo.applyMatrix4(m.matrix);
      const key = m.material.uuid;
      if (!buckets.has(key)) buckets.set(key, { mat: m.material, geos: [] });
      buckets.get(key).geos.push(geo);
      remove.push(m);
    });
    remove.forEach(function (m) { g.remove(m); m.geometry.dispose(); });
    buckets.forEach(function (b) {
      let n = 0; b.geos.forEach(function (x) { n += x.attributes.position.count; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
      let o = 0;
      b.geos.forEach(function (x) {
        pos.set(x.attributes.position.array, o * 3);
        if (x.attributes.normal) nor.set(x.attributes.normal.array, o * 3);
        o += x.attributes.position.count; x.dispose();
      });
      const mg = new THREE.BufferGeometry();
      mg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      mg.computeBoundingSphere();
      g.add(new THREE.Mesh(mg, b.mat));
    });
  }

  // ------------------------------------------------------------ cars
  const TAIL_OFF = 0x4a0b0b, TAIL_LIT = 0x8a1010, TAIL_BRAKE = 0xff2a1e, STOP_OFF = 0x2a0707, STOP_ON = 0xff1414;
  // state: 0 = 消灯, 1 = 尾灯（夕方・雨）, 2 = ブレーキ
  function setTail(parts, state) {
    if (parts._tail === state) return;
    parts._tail = state;
    parts.tail.color.setHex(state === 2 ? TAIL_BRAKE : (state === 1 ? TAIL_LIT : TAIL_OFF));
    parts.tail.emissiveIntensity = state === 2 ? 1.0 : (state === 1 ? 0.22 : 0.05);
    if (parts.stop) parts.stop.color.setHex(state === 2 ? STOP_ON : STOP_OFF);
  }
  let beamGeo = null;
  function sharedBeamGeo() { if (!beamGeo) { beamGeo = new THREE.PlaneGeometry(6.4, 24); beamGeo.rotateX(-Math.PI / 2); beamGeo.translate(0, 0, -12); } return beamGeo; }
  function beamTex() {
    return canvasTex('beam', 64, 128, function (g, w, h) {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      // 手前（下）が明るく、先（上）へ行くほど広がって薄くなる 2 本の光
      [0.34, 0.66].forEach(function (cx) {
        const gr = g.createRadialGradient(w * cx, h * 0.86, 1, w * cx, h * 0.5, h * 0.62);
        gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.42)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(0, 0, w, h);
      });
      g.globalCompositeOperation = 'source-over';
      const fade = g.createLinearGradient(0, 0, 0, h); fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(0.3, 'rgba(0,0,0,0.25)'); fade.addColorStop(0.9, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,0.9)');
      g.fillStyle = fade; g.fillRect(0, 0, w, h);
      const side = g.createLinearGradient(0, 0, w, 0); side.addColorStop(0, 'rgba(0,0,0,1)'); side.addColorStop(0.2, 'rgba(0,0,0,0)'); side.addColorStop(0.8, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = side; g.fillRect(0, 0, w, h);
    }, false);
  }
  function buildCar(spec, colorHex, mats, opts) {
    // spec: {len,wid,hgt,kind}
    opts = opts || {};
    const g = new THREE.Group();
    const L = spec.len, W = spec.wid, H = spec.hgt, kind = spec.kind || 'sedan';
    const paint = new THREE.MeshStandardMaterial({ color: new THREE.Color(colorHex), roughness: 0.36, metalness: 0.25 });
    paint.envMapIntensity = 0.5;            // 空の映り込みを抑えて、車体の色をはっきり見せる
    const parts = { paint: paint };
    const clearance = 0.22;
    const wheelR = kind === 'truck' ? 0.5 : (kind === 'kei' ? 0.29 : 0.33);
    if (kind === 'truck') {
      const cabL = 1.9;
      const cab = new THREE.Mesh(taperedBox(W, 2.0, cabL, 0.96, 0.9, 0.05), paint);
      cab.position.set(0, clearance + 0.4 + 1.0, -L / 2 + cabL / 2); g.add(cab);
      const ws = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.75, 0.05), mats.glass);
      ws.position.set(0, clearance + 0.4 + 1.45, -L / 2 - 0.01); g.add(ws);
      const cargoMat = new THREE.MeshStandardMaterial({ color: opts.cargo || 0xe6e8ea, roughness: 0.6 });
      const cargo = new THREE.Mesh(new THREE.BoxGeometry(W + 0.05, H - 0.5, L - cabL - 0.2), cargoMat);
      cargo.position.set(0, clearance + 0.4 + (H - 0.5) / 2, -L / 2 + cabL + 0.15 + (L - cabL - 0.2) / 2); g.add(cargo);
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.35, L - 0.2), mats.dark);
      chassis.position.set(0, clearance + 0.25, 0); g.add(chassis);
    } else {
      let bodyH = H * 0.46, cabH = H - bodyH - clearance, cabL = L * 0.5, cabShift = 0.05 * L, topW = 0.82, topL = 0.72;
      if (kind === 'kei') { bodyH = H * 0.42; cabH = H - bodyH - clearance; cabL = L * 0.72; cabShift = 0.08 * L; topW = 0.9; topL = 0.86; }
      if (kind === 'van') { cabL = L * 0.8; cabShift = 0.07 * L; topW = 0.92; topL = 0.9; }
      if (kind === 'suv') { cabL = L * 0.62; cabShift = 0.08 * L; topW = 0.88; topL = 0.82; }
      if (kind === 'sport') { bodyH = H * 0.5; cabH = H - bodyH - clearance; cabL = L * 0.42; cabShift = 0.07 * L; topW = 0.78; topL = 0.6; }
      const body = new THREE.Mesh(taperedBox(W, bodyH, L, 0.97, 0.94, 0), paint);
      body.position.y = clearance + bodyH / 2; g.add(body);
      const cab = new THREE.Mesh(taperedBox(W * 0.9, cabH, cabL, topW, topL, 0), mats.glass);
      cab.position.set(0, clearance + bodyH + cabH / 2, cabShift); g.add(cab);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9 * topW * 0.98, 0.06, cabL * topL * 0.98), paint);
      roof.position.set(0, clearance + bodyH + cabH, cabShift); g.add(roof);
      // pillars feel: thin paint strip on cab side
      const bumperF = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, 0.18, 0.12), mats.dark);
      bumperF.position.set(0, clearance + 0.12, -L / 2 + 0.02); g.add(bumperF);
      const bumperR = bumperF.clone(); bumperR.position.z = L / 2 - 0.02; g.add(bumperR);
      const grille = new THREE.Mesh(new THREE.BoxGeometry(W * 0.4, 0.14, 0.04), mats.dark);
      grille.position.set(0, clearance + bodyH * 0.55, -L / 2 - 0.005); g.add(grille);
    }
    // lights
    const headGeo = new THREE.BoxGeometry(W * 0.22, 0.12, 0.05);
    const yl = kind === 'truck' ? clearance + 0.55 : clearance + (kind === 'kei' ? 0.42 : 0.38);
    [-1, 1].forEach(function (sx) {
      const hl = new THREE.Mesh(headGeo, mats.head); hl.position.set(sx * W * 0.33, yl, -L / 2 - 0.02); g.add(hl);
    });
    // 尾灯・制動灯：消灯時は暗い赤、ブレーキ中だけ鮮やかな赤に光る（トーンマッピングを外して橙色に転ばないようにする）
    const tailMat = new THREE.MeshStandardMaterial({ color: TAIL_OFF, emissive: 0xff0000, emissiveIntensity: 0.05, roughness: 0.4 });
    tailMat.toneMapped = false;
    parts.tail = tailMat;
    [-1, 1].forEach(function (sx) {
      const tl = new THREE.Mesh(headGeo, tailMat); tl.position.set(sx * W * 0.36, yl + 0.08, L / 2 + 0.02); g.add(tl);
    });
    // ハイマウントストップランプ（ブレーキ中だけ点灯）
    const stopMat = new THREE.MeshBasicMaterial({ color: STOP_OFF }); stopMat.toneMapped = false;
    const stop = new THREE.Mesh(new THREE.BoxGeometry(W * 0.34, 0.07, 0.06), stopMat);
    stop.position.set(0, yl + (kind === 'truck' ? 0.55 : 0.3), L / 2 + 0.025);
    g.add(stop);
    parts.stop = stopMat;
    const blinkMat = new THREE.MeshStandardMaterial({ color: 0x8a5a10, emissive: 0xffa020, emissiveIntensity: 0 });
    parts.blink = blinkMat;
    const bg = new THREE.BoxGeometry(0.12, 0.08, 0.06);
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (p) {
      const b = new THREE.Mesh(bg, blinkMat); b.position.set(p[0] * W * 0.47, yl, p[1] * (L / 2 + 0.01)); b.userData.side = p[0]; g.add(b);
    });
    // wheels
    const wg = new THREE.CylinderGeometry(wheelR, wheelR, 0.24, 14); wg.rotateZ(Math.PI / 2);
    const rg = new THREE.CylinderGeometry(wheelR * 0.6, wheelR * 0.6, 0.25, 10); rg.rotateZ(Math.PI / 2);
    const wz = kind === 'truck' ? [-L / 2 + 1.1, L / 2 - 1.3, L / 2 - 2.4] : [-L / 2 + L * 0.19, L / 2 - L * 0.19];
    parts.wheels = [];
    wz.forEach(function (z) {
      [-1, 1].forEach(function (sx) {
        const w = new THREE.Mesh(wg, mats.tire); w.position.set(sx * (W / 2 - 0.12), wheelR, z); g.add(w);
        const rim = new THREE.Mesh(rg, mats.rim); rim.position.copy(w.position); g.add(rim);
        parts.wheels.push(w, rim);
      });
    });
    if (opts.shadow) g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; } });
    if (mats.beam && !opts.noBeam) {
      const beam = new THREE.Mesh(sharedBeamGeo(), mats.beam);
      beam.position.set(0, 0.05, -L / 2 + 0.3); beam.userData.noMerge = true; beam.userData.sharedGeo = true; beam.renderOrder = 2; g.add(beam);
    }
    // simple blob shadow for all cars (cheap)
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.15, L * 1.08), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03; blob.userData.noMerge = true; g.add(blob);
    g.userData.parts = parts;
    if (opts.merge) mergeByMaterial(g);
    g.traverse(function (o) { if (o.isMesh && (o.material === paint || o.material === tailMat || o.material === stopMat || o.material === blinkMat || o.material === blob.material)) o.userData.ownMat = true; });
    return g;
  }

  Renderer.prototype.setPlayerCar = function (car, colorHex) {
    while (this.player.children.length) {
      const c = this.player.children.pop();
      c.traverse(function (o) { if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose(); });
    }
    const kind = car.id === 'sport' ? 'sport' : (car.id === 'compact' ? 'kei' : 'sedan');
    const m = buildCar({ len: car.dims.len, wid: car.dims.wid, hgt: car.dims.hgt, kind: kind }, colorHex, this.mats, { shadow: true });
    if (car.id === 'sport') {
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(car.dims.wid * 0.9, 0.06, 0.32), m.userData.parts.paint);
      spoiler.position.set(0, 1.05, car.dims.len / 2 - 0.2); m.add(spoiler);
      [-0.5, 0.5].forEach(function (x) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.1), this.mats.dark); p.position.set(x, 0.95, car.dims.len / 2 - 0.2); m.add(p); }, this);
    }
    this.playerMesh = m;
    this.player.add(m);
  };

  Renderer.prototype._ensureNpcs = function (npcs) {
    while (this.npcMeshes.length < npcs.length) this.npcMeshes.push(null);
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      let m = this.npcMeshes[i];
      const sig = n.kind + n.color + n.len;
      if (!m || m.userData.sig !== sig) {
        if (m) { this.scene.remove(m); m.traverse(function (o) { if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose(); if (o.userData.ownMat && o.material) o.material.dispose(); }); }
        const cargo = [0xe6e8ea, 0x2e6fae, 0xd9d2c0, 0x3a7a4a][i % 4];
        m = buildCar({ len: n.len, wid: n.wid, hgt: n.hgt, kind: n.kind }, n.color, this.mats, { cargo: cargo, shadow: false, merge: true });
        m.userData.sig = sig;
        this.npcMeshes[i] = m;
        this.scene.add(m);
      }
    }
  };

  // ------------------------------------------------------------ chunks
  Renderer.prototype.clearChunks = function () {
    const self = this;
    this.chunks.forEach(function (c) { self._disposeChunk(c); });
    this.chunks.clear();
  };
  Renderer.prototype._disposeChunk = function (c) {
    this.world.remove(c);
    const anims = this.anims;
    c.traverse(function (o) {
      if (o.userData.anim) anims.delete(o);
      if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose();
      if (o.material && o.userData.ownMat) o.material.dispose();
      if (o.isInstancedMesh && o.dispose) o.dispose();
    });
  };

  Renderer.prototype._updateChunks = function (s) {
    const Q = QUALITY[this.quality];
    const first = Math.floor((s - 120 * Q.behind) / CHUNK), last = Math.floor((s + Q.far + 120) / CHUNK);
    const self = this;
    this.chunks.forEach(function (c, k) { if (k < first - 1 || k > last + 1) { self._disposeChunk(c); self.chunks.delete(k); } });
    let built = 0;
    for (let k = first; k <= last; k++) {
      if (!this.chunks.has(k)) {
        if (built >= (this._warm ? 30 : 2)) break;
        const c = this._buildChunk(k);
        this.chunks.set(k, c); this.world.add(c);
        built++;
      }
    }
    this._warm = false;
  };
  Renderer.prototype.warm = function (s) { this._warm = true; this._updateChunks(s); };

  // ribbon builder
  function Ribbon() { this.pos = []; this.uv = []; this.col = []; this.idx = []; this.n = 0; }
  Ribbon.prototype.quad = function (a, b, c, d, uva, uvb, uvc, uvd, ca, cb, cc, cd) {
    const i = this.n;
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
    if (uva) this.uv.push(uva[0], uva[1], uvb[0], uvb[1], uvc[0], uvc[1], uvd[0], uvd[1]);
    if (ca) this.col.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2], cc[0], cc[1], cc[2], cd[0], cd[1], cd[2]);
    this.idx.push(i, i + 2, i + 1, i, i + 3, i + 2);
    this.n += 4;
  };
  Ribbon.prototype.mesh = function (mat) {
    if (!this.n) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    if (this.uv.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  };

  // ---- 地形（0.6.4）：景観の種類ごとの地面の高さ。道路の高さからの相対値。
  const G_LATS = [0, 0.6, 3.2, 6, 18, 40, 80, 140, 230];
  const SIDEWALK = { city: 1, strip: 1, industrial: 1, suburb: 1, town: 1, onsen: 1, kanetown: 1 };   // 歩道のあるまちなか
  const GUARD = { hill: 1, forest: 1, grapehill: 1, lake: 1, riverside: 1 };                              // ガードレールを付ける沿道
  const LAND_KEY = { city: 'city', strip: 'city', industrial: 'city', suburb: 'town', town: 'town', onsen: 'town', kanetown: 'town',
    rice: 'rice', soba: 'rice', field: 'orchard', cherry: 'orchard', orchard: 'orchard', grape: 'orchard', grapehill: 'hill',
    hill: 'hill', forest: 'forest', lake: 'town', riverside: 'town' };
  const WATER_Y = { lake: -0.95, riverside: -1.7 };      // 水面の高さ
  const WATER_FROM = { lake: 18, riverside: 18 };
  const RIVER_BED = -4.3, RIVER_WATER = -3.3;            // 橋の下：川底と水面（橋の中央の路面から）
  function typeNodeY(type, side, o, s) {
    if (o < 0.5) return 0.02;
    if (o < 3.3) return SIDEWALK[type] ? 0.1 : -0.12;      // 歩道は縁石の分だけ高い
    if (o < 7) return -0.12;
    if (type === 'lake') return o < 18.5 ? -0.5 : (o > 200 ? 5 : -1.6);
    if (type === 'riverside') return o < 18.5 ? -0.4 : (o < 41 ? -2.2 : (o > 200 ? 16 : -3.0));
    if (type === 'grapehill') return -0.15 + Math.max(0, o - 12) * 0.2 * (0.75 + 0.25 * Math.sin(s / 260 + side));
    if (type === 'hill' || type === 'forest') return -0.15 + Math.max(0, o - 60) * 0.16 * (0.6 + 0.4 * Math.sin(s / 300 + side));
    return -0.15 + Math.max(0, o - 140) * 0.06 * (0.6 + 0.4 * Math.sin(s / 300 + side));   // 平地は140 mまで平ら
  }
  function typeY(type, side, o, s) {
    if (o <= 0) return 0.02;
    for (let i = 0; i < G_LATS.length - 1; i++) {
      if (o <= G_LATS[i + 1]) {
        const a = G_LATS[i], b = G_LATS[i + 1], ya = typeNodeY(type, side, a, s), yb = typeNodeY(type, side, b, s);
        return ya + (yb - ya) * (o - a) / (b - a);
      }
    }
    return typeNodeY(type, side, 230, s);
  }
  const _bl = {};
  function clampS(s) { return Math.max(0, Math.min(RT.TOTAL - 1, s)); }
  // 景観の切替をなめらかにつないだ地面の高さ。node=true は地面メッシュの頂点用。
  function terrainY(side, o, s, node) {
    RT.landBlend(clampS(s), side, _bl);
    const f = node ? typeNodeY : typeY;
    let y = f(_bl.a, side, o, s);
    if (_bl.t > 0 && _bl.b !== _bl.a) y += (f(_bl.b, side, o, s) - y) * _bl.t;
    return y;
  }

  const LAND_COL = {
    city: [0.55, 0.57, 0.52], town: [0.47, 0.6, 0.33], orchard: [0.42, 0.6, 0.27], hill: [0.36, 0.52, 0.27],
    rice: [0.62, 0.6, 0.3], forest: [0.3, 0.46, 0.24]
  };
  // 四季の見た目（0.6.3）
  const SEASON_LOOK = {
    spring: { land: { city: [0.55, 0.57, 0.52], town: [0.5, 0.66, 0.36], orchard: [0.48, 0.66, 0.34], hill: [0.42, 0.6, 0.32], rice: [0.5, 0.6, 0.46], forest: [0.36, 0.54, 0.3] },
      snowline: 250, cedar: 0x355c3a, far: 0x7f9a58, paddy: [0x86a9b4, 0x7fa3a6, 0x93b3b2], tree: [0x7cb648, 0x8cc152, 0x6aa83e],
      blossom: [0xf6c3d5, 0xf9d4e2, 0xf1b0c8], fruit: false, forestTree: [0x8cc152, 0x9ccc65, 0xf3c6d6] },
    summer: { land: { city: [0.52, 0.55, 0.5], town: [0.38, 0.58, 0.26], orchard: [0.34, 0.56, 0.22], hill: [0.3, 0.5, 0.22], rice: [0.36, 0.58, 0.24], forest: [0.26, 0.44, 0.2] },
      snowline: 520, cedar: 0x2a4a2c, far: 0x557a3a, paddy: [0x5c9a36, 0x66a63e, 0x579232], tree: [0x3f7a2c, 0x4a8a32, 0x386e28],
      fruit: true, forestTree: [0x3f7a2c, 0x2f6a24, 0x4a8a32] },
    autumn: { land: LAND_COL, snowline: 380, cedar: 0x2f5233, far: 0x6f8a4a, paddy: null, tree: null, fruit: true, forestTree: null },
    winter: { land: { city: [0.82, 0.84, 0.86], town: [0.9, 0.92, 0.95], orchard: [0.92, 0.94, 0.96], hill: [0.9, 0.92, 0.95], rice: [0.94, 0.95, 0.97], forest: [0.88, 0.9, 0.93] },
      snowline: -100, cedar: 0x4f6e5c, far: 0xe6ebf0, paddy: [0xf2f5f8, 0xeef2f6, 0xe8eef3], tree: [0xe9eef1, 0xdfe6ea, 0xd5dde2],
      fruit: false, forestTree: [0xe2e8ec, 0xd8e0e5, 0xeef2f4], roofSnow: true, bare: true }
  };

  Renderer.prototype._buildChunk = function (k) {
    const group = new THREE.Group();
    const s0 = k * CHUNK, s1 = s0 + CHUNK;
    if (s1 < -1900 || s0 > RT.TOTAL + 1900) return group;
    const rand = rng(k * 7919 + 17);
    const STEP = 4;
    const road = new Ribbon(), ground = new Ribbon();
    const wht = new Ribbon(), yel = new Ribbon(), grn = new Ribbon();
    const P = RT.pointAt;
    const A = {}, B = {}, C = {}, D = {};
    const midRegion = RT.regionAt(Math.max(0, Math.min(RT.TOTAL - 1, s0 + 50)));
    const sunset = this.sceneryId === 'sunset';
    const look = SEASON_LOOK[this.season] || SEASON_LOOK.autumn;
    const winter = this.season === 'winter';
    function tunnelMound(s) {
      for (const t of RT.TUNNELS) {
        if (s > t.start - 60 && s < t.end + 60) return Math.min(1, (s - (t.start - 60)) / 60, ((t.end + 60) - s) / 60);
      }
      return 0;
    }

    function inIntersection(s) {
      for (const sg of RT.SIGNALS) if (s > sg.s + 0.5 && s < sg.s + 23) return sg;
      return null;
    }
    function leftEdge(s) { return -(RT.halfWidth(s) + RT.SHOULDER + R13.sim.serviceDepth(s) * 4.8); }
    function rightEdge(s) { return RT.halfWidth(s) + RT.SHOULDER; }

    // --- road surface & ground
    const water = new Ribbon(), rail = new Ribbon(), guard = new Ribbon();
    const guardBlocked = function (s, side) {
      for (const t of RT.TUNNELS) if (s > t.start - 8 && s < t.end + 8) return true;
      for (const sg of RT.SIGNALS) if (s > sg.s - 14 && s < sg.s + 36) return true;
      if (side < 0) { if (R13.sim.serviceDepth(s) > 0 || R13.sim.serviceDepth(s + 6) > 0) return true; for (const st of RT.STATIONS) if (Math.abs(s - st.s) < 150) return true; }
      return false;
    };
    const roadY = function (s) { return RT.pointAt(s, 0).y; };
    const riverLevel = function (s, rel) { const rv = RT.inRiver(s); return rv ? roadY(rv.s) + rel - roadY(s) : 0; };
    for (let s = s0; s < s1; s += STEP) {
      const sa = s, sb = s + STEP;
      const la = leftEdge(sa), lb = leftEdge(sb), ra = rightEdge(sa), rb = rightEdge(sb);
      P(sa, la, A); P(sb, lb, B); P(sb, rb, C); P(sa, ra, D);
      road.quad(A, B, C, D, [la / 4, sa / 8], [lb / 4, sb / 8], [rb / 4, sb / 8], [ra / 4, sa / 8]);
      const rfa = RT.riverAt(sa), rfb = RT.riverAt(sb);
      // ground both sides
      [-1, 1].forEach(function (side) {
        const ea = side < 0 ? la : ra, eb = side < 0 ? lb : rb;
        const landA = RT.landAt(clampS(sa), side);
        const base = look.land[LAND_KEY[landA] || 'town'] || look.land.town;
        const paved = landA === 'strip' || landA === 'industrial' || landA === 'city';
        const walk = !!SIDEWALK[landA];
        const wet = landA === 'lake' || landA === 'riverside';
        const h = function (o, s) {
          let y = terrainY(side, o, s, true);
          const rf = RT.riverAt(s);
          if (winter && o >= 0.5 && o <= 6.5 && rf < 0.3) y += 0.55;              // 除雪の雪壁
          const tm = tunnelMound(s);                                             // トンネルの山
          if (tm > 0 && o >= 5.9) y = Math.max(y, tm * (9.5 + (o - 6) * 0.55));   // 山はトンネル壁の外側から立ち上げる
          if (rf > 0 && o >= 0.5) y += (riverLevel(s, RIVER_BED) - y) * rf;       // 川：橋の下へ落とす
          return y;
        };
        const col = function (o, s) {
          const n = (winter ? 0.95 : 0.88) + (winter ? 0.06 : 0.24) * hash(Math.floor(s / 40) * 13 + Math.floor(o / 30) * 7 + side);
          let c = [base[0] * n, base[1] * n, base[2] * n];
          if (paved && o < 41 && o >= 0.5) c = winter ? [0.84 * n, 0.86 * n, 0.89 * n] : [0.46 * n, 0.47 * n, 0.47 * n];   // 駐車場・構内の舗装
          if (o >= 0.5 && o < 3.3) {
            if (walk) c = winter ? [0.9, 0.91, 0.93] : [0.7 * n, 0.7 * n, 0.67 * n];                     // 歩道
            else if (!winter && !wet) c = [c[0] * 0.86, c[1] * 0.9, c[2] * 0.8];                        // 路肩の草
          }
          if (wet && o >= 17 && o < 200) c = winter ? [0.7, 0.74, 0.78] : [0.36 * n, 0.4 * n, 0.33 * n];                    // 岸・湖底
          if (RT.riverAt(s) > 0.5 && o >= 0.5) c = winter ? [0.82, 0.85, 0.88] : [0.5 * n, 0.5 * n, 0.45 * n];              // 河原
          if (o < 0.5) c = winter ? [0.8, 0.82, 0.85] : [0.55, 0.55, 0.5];          // curb/gravel
          if (sunset) c = [c[0] * 1.05, c[1] * 0.9, c[2] * 0.8];
          return [lin(c[0]), lin(c[1]), lin(c[2])];
        };
        const lat = function (e, o) { return e + side * o; };
        const uvs = function (o, s) { return [o / 6, s / 6]; };
        for (let i = 0; i < G_LATS.length - 1; i++) {
          const o0 = G_LATS[i], o1 = G_LATS[i + 1];
          P(sa, lat(ea, o0), A); A.y += h(o0, sa); P(sb, lat(eb, o0), B); B.y += h(o0, sb);
          P(sb, lat(eb, o1), C); C.y += h(o1, sb); P(sa, lat(ea, o1), D); D.y += h(o1, sa);
          if (side < 0) ground.quad(D, C, B, A, uvs(o1, sa), uvs(o1, sb), uvs(o0, sb), uvs(o0, sa), col(o1, sa), col(o1, sb), col(o0, sb), col(o0, sa));
          else ground.quad(A, B, C, D, uvs(o0, sa), uvs(o0, sb), uvs(o1, sb), uvs(o1, sa), col(o0, sa), col(o0, sb), col(o1, sb), col(o1, sa));
        }
        // 水面：湖・川沿い（道路の高さに沿わせる）と、橋の下の川（水平）
        const wq = function (oIn, oOut, ya, yb) {
          P(sa, lat(ea, oIn), A); A.y += ya; P(sb, lat(eb, oIn), B); B.y += yb;
          P(sb, lat(eb, oOut), C); C.y += yb; P(sa, lat(ea, oOut), D); D.y += ya;
          const u0 = side * oIn / 18, u1 = side * oOut / 18, v0 = sa / 18, v1 = sb / 18;
          if (side < 0) water.quad(D, C, B, A, [u1, v0], [u1, v1], [u0, v1], [u0, v0]); else water.quad(A, B, C, D, [u0, v0], [u0, v1], [u1, v1], [u1, v0]);
        };
        // ガードレール：山あい・水辺・カーブの外側（交差点・道の駅・トンネル・橋を除く）
        if ((GUARD[landA] || Math.abs(RT.curvature(clampS(sa))) > 0.0018) && rfa === 0 && rfb === 0 && sa >= 0 && sb <= RT.TOTAL && !guardBlocked(sa, side)) {
          const gl = function (e) { return e + side * 0.28; };
          P(sa, gl(ea), A); A.y += 0.5; P(sb, gl(eb), B); B.y += 0.5; P(sb, gl(eb), C); C.y += 0.82; P(sa, gl(ea), D); D.y += 0.82;
          guard.quad(A, B, C, D);
          const gp = function (e) { return e + side * 0.34; };
          P(sa, gp(ea), A); A.y += 0.0; P(sa + 0.14, gp(ea), B); B.y += 0.0; P(sa + 0.14, gp(ea), C); C.y += 0.82; P(sa, gp(ea), D); D.y += 0.82;
          guard.quad(A, B, C, D);
        }
        if (wet) wq(WATER_FROM[landA], 228, WATER_Y[landA], WATER_Y[landA]);
        if (rfa > 0 || rfb > 0) {
          wq(0.55, 229, riverLevel(sa, RIVER_WATER), riverLevel(sb, RIVER_WATER));
          // 高欄（橋の欄干）
          if (rfa > 0.5 && rfb > 0.5) {
            const rl = function (e) { return e - side * 0.25; };
            P(sa, rl(ea), A); A.y += 0.05; P(sb, rl(eb), B); B.y += 0.05; P(sb, rl(eb), C); C.y += 1.05; P(sa, rl(ea), D); D.y += 1.05;
            rail.quad(A, B, C, D);
          }
        }
      });
    }
    const wm = water.mesh(this.mats.water); if (wm) group.add(wm);
    const rm = rail.mesh(this.mats.rail); if (rm) { rm.castShadow = true; group.add(rm); }
    const gdm = guard.mesh(this.mats.guard); if (gdm) group.add(gdm);

    // --- markings
    const lineAt = function (rb, latFn, sa, sb, w, y) {
      for (let s = sa; s < sb; s += 2) {
        const e = Math.min(sb, s + 2);
        const l0 = latFn(s), l1 = latFn(e);
        P(s, l0 - w / 2, A); P(e, l1 - w / 2, B); P(e, l1 + w / 2, C); P(s, l0 + w / 2, D);
        A.y += y; B.y += y; C.y += y; D.y += y;
        rb.quad(A, B, C, D);
      }
    };
    const Y = 0.015;
    for (let s = s0; s < s1; s += 10) {
      const sg = inIntersection(s + 5);
      // edge lines (solid)
      if (!sg) {
        lineAt(wht, function (q) { return -RT.halfWidth(q); }, s, s + 10, 0.15, Y);
        lineAt(wht, function (q) { return RT.halfWidth(q); }, s, s + 10, 0.15, Y);
      }
      if (sg) continue;
      // center line
      const cst = centerLineStyle(s + 5);
      if (cst === 'yellow') {
        lineAt(yel, function () { return -0.12; }, s, s + 10, 0.15, Y);
        lineAt(yel, function () { return 0.12; }, s, s + 10, 0.15, Y);
      } else if (cst === 'wide') {
        // 1.0.4：片側2車線以上で規制のない区間は、白の二重の破線（線 8m・すき間 2m、各 18cm 幅、間隔 20cm）。
        //        車線境界線（細い1本・5m／5m）と遠くの車線からでも見分けやすくする。白の実線ははみ出し禁止と受け取られるため使わない
        lineAt(wht, function () { return -0.19; }, s + 1, s + 9, 0.18, Y);
        lineAt(wht, function () { return 0.19; }, s + 1, s + 9, 0.18, Y);
      } else {
        lineAt(wht, function () { return 0; }, s, s + 5, 0.15, Y);      // 片側1車線：白の破線
      }
      // lane lines (dashed)
      const wc = RT.laneWidthCount(s + 5);
      const nl = Math.ceil(wc - 0.01);
      for (let i = 1; i < nl; i++) {
        if (i * RT.LANE_W < RT.halfWidth(s + 5) - 0.6) {
          lineAt(wht, function () { return -i * RT.LANE_W; }, s, s + 5, 0.13, Y);
          lineAt(wht, function () { return i * RT.LANE_W; }, s, s + 5, 0.13, Y);
        }
      }
    }
    // signals: stop lines, crosswalks, cross street
    const self = this;
    RT.SIGNALS.forEach(function (sg) {
      if (sg.s + 25 < s0 || sg.s >= s1) return;
      if (sg.s >= s0 && sg.s < s1) {
        const hw = RT.halfWidth(sg.s);
        // stop line (ours) and oncoming
        lineAt(wht, function () { return -hw / 2; }, sg.s - 0.45, sg.s, hw, Y + 0.002);
        lineAt(wht, function () { return hw / 2; }, sg.s + 23, sg.s + 23.45, hw, Y + 0.002);
        // crosswalks
        [[1.5, 5.5], [17.5, 21.5]].forEach(function (cw) {
          for (let l = -hw - 1; l < hw + 1; l += 1.0) lineAt(wht, function () { return l + 0.25; }, sg.s + cw[0], sg.s + cw[1], 0.45, Y + 0.002);
        });
        // cross street
        const cr = new Ribbon();
        P(sg.s + 7, -95, A); P(sg.s + 16, -95, B); P(sg.s + 16, 95, C); P(sg.s + 7, 95, D);
        const y0 = RT.pointAt(sg.s + 11.5, 0).y;
        A.y = B.y = C.y = D.y = y0 - 0.005;
        cr.quad(A, B, C, D, [0, 0], [0, 2], [40, 2], [40, 0]);
        const crm = cr.mesh(self.mats.road); crm.receiveShadow = true; group.add(crm);
        // intersection fill
        const fill = new Ribbon();
        P(sg.s, -hw - RT.SHOULDER, A); P(sg.s + 23.5, -hw - RT.SHOULDER, B); P(sg.s + 23.5, hw + RT.SHOULDER, C); P(sg.s, hw + RT.SHOULDER, D);
        [A, B, C, D].forEach(function (p) { p.y += 0.004; });
        fill.quad(A, B, C, D, [0, 0], [0, 3], [3, 3], [3, 0]);
        group.add(fill.mesh(self.mats.road));
        self._signalObject(group, sg);
      }
    });
    // service bay markings
    RT.STATIONS.forEach(function (st) {
      if (st.s + 110 < s0 || st.s - 110 >= s1) return;
      const hw = RT.halfWidth(st.s);
      const a = Math.max(s0, st.s - 70), b = Math.min(s1, st.s + 70);
      if (a < b) {
        lineAt(grn, function () { return -(hw + 3.8); }, a, b, 3.0, Y - 0.004);
        lineAt(wht, function () { return -(hw + 2.2); }, a, b, 0.12, Y);
        lineAt(wht, function () { return -(hw + 5.4); }, a, b, 0.12, Y);
        for (let q = st.s - 70; q <= st.s + 70; q += 10) if (q >= s0 && q < s1) lineAt(wht, function () { return -(hw + 3.8); }, q, q + 0.15, 3.2, Y + 0.001);
      }
      if (st.s >= s0 && st.s < s1) self._stationObject(group, st);
    });

    const roadMesh = road.mesh(this.mats.road); roadMesh.receiveShadow = true; group.add(roadMesh);
    const gm = ground.mesh(this.mats.ground); gm.receiveShadow = true; group.add(gm);
    [[wht, this.mats.white], [yel, this.mats.yellow], [grn, this.mats.green]].forEach(function (p) { const m = p[0].mesh(p[1]); if (m) { m.receiveShadow = true; group.add(m); } });

    this._tunnel(group, s0, s1);
    this._scenery(group, k, s0, s1, rand);
    this._signs(group, s0, s1);
    return group;
  };

  // ------------------------------------------------------------ tunnel (南陽の1車線区間)
  Renderer.prototype._tunnel = function (group, s0, s1) {
    const self = this;
    RT.TUNNELS.forEach(function (t) {
      const a = Math.max(s0, t.start), b = Math.min(s1, t.end);
      if (a >= b && !(t.start >= s0 && t.start < s1) && !(t.end >= s0 && t.end < s1)) return;
      const tube = new Ribbon(), cap = new Ribbon(), stripe = new Ribbon();
      const A = {}, B = {}, C = {}, D = {};
      const W = function (s) { return RT.halfWidth(s) + RT.SHOULDER + 0.5; };
      const prof = function (s) {
        const w = W(s), pts = [[-w, -0.1], [-w, 4.4]];
        for (let i = 1; i < 8; i++) { const ang = Math.PI - i * Math.PI / 8; pts.push([w * Math.cos(ang), 4.4 + 2.9 * Math.sin(ang)]); }
        pts.push([w, 4.4], [w, -0.1]);
        return pts;
      };
      if (a < b) {
        for (let s = a; s < b; s += 4) {
          const e = Math.min(b, s + 4), pa = prof(s), pb = prof(e);
          for (let i = 0; i < pa.length - 1; i++) {
            RT.pointAt(s, pa[i][0], A); A.y += pa[i][1]; RT.pointAt(e, pb[i][0], B); B.y += pb[i][1];
            RT.pointAt(e, pb[i + 1][0], C); C.y += pb[i + 1][1]; RT.pointAt(s, pa[i + 1][0], D); D.y += pa[i + 1][1];
            tube.quad(A, B, C, D, [i, s / 6], [i, e / 6], [i + 1, e / 6], [i + 1, s / 6]);
          }
          // hill cap over the tube
          const wa = W(s) + 6.2, wb = W(e) + 6.2;
          RT.pointAt(s, -wa, A); A.y += 9.5; RT.pointAt(e, -wb, B); B.y += 9.5; RT.pointAt(e, wb, C); C.y += 9.5; RT.pointAt(s, wa, D); D.y += 9.5;
          cap.quad(A, B, C, D);
          // white lower wall panels
          [-1, 1].forEach(function (sd) {
            RT.pointAt(s, sd * (W(s) - 0.02), A); A.y += 0.4; RT.pointAt(e, sd * (W(e) - 0.02), B); B.y += 0.4;
            RT.pointAt(e, sd * (W(e) - 0.02), C); C.y += 2.6; RT.pointAt(s, sd * (W(s) - 0.02), D); D.y += 2.6;
            stripe.quad(A, B, C, D);
          });
        }
        const concrete = new THREE.MeshStandardMaterial({ color: 0x9c9a92, roughness: 0.92, side: THREE.DoubleSide });
        const tm = tube.mesh(concrete); tm.userData.ownMat = true; tm.castShadow = true; tm.receiveShadow = true; group.add(tm);
        const capCol = { spring: 0x6f9a48, summer: 0x4a7a32, autumn: 0x8a7a3a, winter: 0xe8edf2 }[self.season] || 0x6f8a4a;
        const cm = cap.mesh(new THREE.MeshLambertMaterial({ color: capCol, side: THREE.DoubleSide })); cm.userData.ownMat = true; group.add(cm);
        const sm = stripe.mesh(new THREE.MeshStandardMaterial({ color: 0xe8e6de, roughness: 0.6, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 }));
        sm.userData.ownMat = true; group.add(sm);
        // tunnel lights (orange) every 12 m on both upper sides
        const lights = [];
        for (let s = Math.ceil(a / 12) * 12; s < b; s += 12) [-1, 1].forEach(function (sd) { lights.push({ s: s, lat: sd * (W(s) * 0.62) }); });
        if (lights.length) {
          const lg = new THREE.BoxGeometry(0.35, 0.12, 1.4);
          const lm = new THREE.MeshStandardMaterial({ color: 0xffd7a0, emissive: 0xffa040, emissiveIntensity: 2.4 });
          const im = new THREE.InstancedMesh(lg, lm, lights.length);
          im.userData.ownMat = true;
          const d = new THREE.Object3D(), P = {};
          lights.forEach(function (L, i) {
            RT.pointAt(L.s, L.lat, P);
            d.position.set(P.x, P.y + 6.6, P.z); d.rotation.set(0, -P.h, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
          });
          group.add(im);
        }
      }
      // portals
      [t.start, t.end].forEach(function (ps, idx) {
        if (ps < s0 || ps >= s1) return;
        const P = RT.pointAt(ps, 0), w = W(ps);
        const g = new THREE.Group(); g.position.set(P.x, P.y, P.z); g.rotation.y = -P.h;
        const m = new THREE.MeshStandardMaterial({ color: 0xb4b2aa, roughness: 0.85 });
        const own = function (mesh) { mesh.userData.ownMat = true; return mesh; };
        const pillarL = own(new THREE.Mesh(new THREE.BoxGeometry(7, 11, 1.6), m)); pillarL.position.set(-w - 3.5, 5.5, 0); g.add(pillarL);
        const pillarR = own(new THREE.Mesh(new THREE.BoxGeometry(7, 11, 1.6), m)); pillarR.position.set(w + 3.5, 5.5, 0); g.add(pillarR);
        const lintel = own(new THREE.Mesh(new THREE.BoxGeometry(2 * w + 14, 3.8, 1.6), m)); lintel.position.set(0, 9.3, 0); g.add(lintel);
        const tex = signTex('tunnel-plate-' + t.name, 512, 128, function (gg, W2, H2) {
          gg.fillStyle = '#e9e7e0'; gg.fillRect(0, 0, W2, H2); gg.strokeStyle = '#555'; gg.lineWidth = 6; gg.strokeRect(6, 6, W2 - 12, H2 - 12);
          gg.fillStyle = '#222'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; fitText(gg, t.name, W2 - 60, 70, 900); gg.fillText(t.name, W2 / 2, H2 / 2);
        });
        const plate = own(new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshStandardMaterial({ map: tex })));
        plate.position.set(0, 9.4, idx === 0 ? 0.82 : -0.82); if (idx === 1) plate.rotation.y = Math.PI; g.add(plate);
        group.add(g);
      });
    });
  };

  // ------------------------------------------------------------ scenery placement
  // 景観プラン（RT.SCENE_PLAN）に従い、左右それぞれの沿道を作る（0.6.4）
  Renderer.prototype._scenery = function (group, k, s0, s1, rand) {
    const Q = QUALITY[this.quality];
    const dens = Q.density;
    const self = this, M = this.mats, GE = this.geo;
    const season = this.season, winter = season === 'winter';
    const look = SEASON_LOOK[season] || SEASON_LOOK.autumn;
    const sMid = clampS(s0 + 50);
    const opt = RT.sceneOptAt(sMid);
    const trees = [], cedars = [], blds = [], houses = [], boxes = [], plots = [], poles = [], arrows = [], paddies = [], fruits = [], stooks = [], lamps = [], bushes = [];
    const tmp = {};
    const E = RT.halfWidth(s0 + 50) + RT.SHOULDER;
    const clearOf = function (s, lat) {
      for (const sg of RT.SIGNALS) if (s > sg.s - 4 && s < sg.s + 27 && Math.abs(lat) < 100) return false;
      for (const st of RT.STATIONS) if (Math.abs(s - st.s) < 130 && lat < 0 && lat > -60) return false;
      for (const t of RT.TUNNELS) if (s > t.start - 80 && s < t.end + 80 && Math.abs(lat) < 70) return false;
      return true;
    };
    // 地面の高さに合わせて配置。川（橋）の区間には何も置かない。
    const place = function (arr, s, lat, sx, sy, sz, rot, color, yoff) {
      if (RT.riverClear(s)) return null;
      RT.pointAt(s, lat, tmp);
      const side = lat < 0 ? -1 : 1;
      const o = Math.abs(lat) - (RT.halfWidth(s) + RT.SHOULDER + (side < 0 ? R13.sim.serviceDepth(s) * 4.8 : 0));
      const gy = o > 0 ? terrainY(side, o, s, false) : 0;
      const ob = { x: tmp.x, y: tmp.y + gy + (yoff || 0), z: tmp.z, sx: sx, sy: sy, sz: sz, rot: (rot == null ? -tmp.h : rot), color: color };
      arr.push(ob);
      return ob;
    };
    const N = function (n) { return Math.max(0, Math.round(n * dens)); };
    const pick = function (a) { return a[Math.floor(rand() * a.length)]; };
    const heading = function (s) { return -RT.pointAt(s, 0).h; };

    const roofCols = [0x9b3a30, 0x3f5f86, 0x5a7050, 0x6b4a3a, 0x8a8f94, 0x2f3a4a, 0xa05a2a];
    const wallCols = [0xe8e2d4, 0xd8d0c0, 0xf0ece4, 0xc9c2b4, 0xb7b0a2, 0xe0d8c8];
    const bldCols = [0xd6d8da, 0xc8c2b8, 0xb9c3cc, 0xe3ddd0, 0xa8b0b6, 0xd0c8bc];
    const storeCols = [0xf2f0ea, 0xe6e2d8, 0xdfe3e6, 0xf5f2e4, 0xd9d4c8];
    const brandCols = [0xd23a2e, 0x1f5fa8, 0x2f8a4a, 0xe8872a, 0xf0c020, 0x27407a, 0xc0356a];
    const wareCols = [0xdfe3e6, 0xc9d3da, 0xe6e0d2, 0xb8c4cc, 0xd4d9cf];
    const greenCols = [0x4f7f3a, 0x5d8a3c, 0x456f34];
    const snow = 0xf2f5f8;

    const tree = function (s, lat, sx, sy, land, color, fixed) {
      const o = place(trees, s, lat, sx, sy, sx, null, color != null ? color : pick(greenCols));
      if (o) { o.land = land; o.fixed = !!fixed; }
      return o;
    };
    const cedar = function (s, lat, sx, sy) { return place(cedars, s, lat, sx, sy, sx, rand() * 6, null); };
    const house = function (s, lat, w, h, d, wall, roof, rot) {
      const o = place(houses, s, lat, w, h, d, rot == null ? heading(s) + (rand() < 0.5 ? 0 : Math.PI / 2) : rot, 0);
      if (o) { o.wall = wall != null ? wall : pick(wallCols); o.roof = roof != null ? roof : pick(roofCols); }
      return o;
    };
    // 無地の箱（店舗・倉庫・ぶどう棚・雨よけ・柵・看板）。sx=道路と直角方向、sz=道路方向
    const box = function (s, lat, sx, sy, sz, color, yoff) { return place(boxes, s, lat, sx, sy, sz, null, color, yoff); };
    const plot = function (s, lat, sx, sz, color, yoff) { return place(plots, s, lat, sx, 1, sz, null, color, yoff == null ? 0.1 : yoff); };
    const fruit = function (s, lat, y, color, scale) { return place(fruits, s, lat, scale || 1, 1, 1, 0, color, y); };
    const farmhouse = function (side, i, minLat, maxLat) {
      const s = s0 + rand() * CHUNK, lat = side * (E + minLat + rand() * (maxLat - minLat));
      if (!house(s, lat, 9, 6, 10, wallCols[i % wallCols.length], roofCols[(k + i * 3) % roofCols.length], heading(s))) return;
      for (let t = 0; t < 5; t++) cedar(s + (rand() - 0.5) * 30, lat + side * (8 + rand() * 10), 2.2, 10 + rand() * 6);   // 屋敷林
      if (season === 'spring' && rand() < 0.45) {                                // 春：こいのぼり
        const ks = s + 7, kl = lat - side * 7;
        if (place(poles, ks, kl, 0.7, 9.4, 0.7, null, null)) {
          box(ks + 1.3, kl, 0.18, 0.36, 2.2, 0xf2c230, 8.8);
          [[0x26282c, 8.0, 3.0], [0xd8322b, 7.2, 2.6], [0x2f6fc0, 6.5, 2.2]].forEach(function (f) { box(ks + f[2] / 2 + 0.3, kl, 0.3, 0.6, f[2], f[0], f[1]); });
        }
      }
    };
    const sideLat = function (side, min, max) { return side * (E + min + rand() * (max - min)); };
    const boardList = Object.keys(boardSpots()).map(function (id) { return boardSpots()[id]; }).filter(function (b) { return b > s0 - 30 && b < s1 + 30; });
    const nearBoard = function (s, d) { for (let i = 0; i < boardList.length; i++) if (Math.abs(s - boardList[i]) < d) return true; return false; };

    // utility poles (left) and snow arrow poles (矢羽根) in snowy north
    const landL = RT.landAt(sMid, -1), landR = RT.landAt(sMid, 1);
    for (let s = s0 + (k % 2) * 17; s < s1; s += 34) {
      const lat = -(RT.halfWidth(s) + RT.SHOULDER + 2.2 + R13.sim.serviceDepth(s) * 6);
      if (clearOf(s, lat) && !nearBoard(s, 7)) place(poles, s, lat, 1, 9.5, 1, null, null);
    }
    const wild = function (l) { return l === 'forest' || l === 'hill'; };
    if (s0 > 30000 || wild(landL) || wild(landR)) {
      for (let s = s0; s < s1; s += 25) {
        const lat = -(RT.halfWidth(s) + RT.SHOULDER + 0.5);
        if (R13.sim.serviceDepth(s) > 0) continue;
        if (clearOf(s, -1)) place(arrows, s, lat, 1, 1, 1, null, null);
        const lat2 = RT.halfWidth(s) + RT.SHOULDER + 0.5;
        if (clearOf(s, 1)) place(arrows, s + 12, lat2, 1, 1, 1, null, null);
      }
    }
    // 防雪柵（大石田・尾花沢・新庄の吹きさらしの区間、風上の西側）。冬は板を立て、ほかの季節はたたんである。
    if (opt.fence && (landL === 'rice' || landL === 'field' || landL === 'soba') && k % 4 !== 3) {
      for (let s = s0 + 5; s < s1; s += 10) {
        const lat = -(RT.halfWidth(s) + RT.SHOULDER + 4.4);
        if (!clearOf(s, lat)) continue;
        place(poles, s - 5, lat, 1, 3.6, 1, null, null);
        if (winter) { box(s, lat, 0.16, 2.9, 9.7, 0x7f9498, 0.6); }
        else { box(s, lat, 0.5, 0.45, 9.7, 0x7f9498, 0.05); }
      }
    }

    const stook = function (s, lat, sx, sy, color) { return place(stooks, s, lat, sx, sy, sx, rand() * 6, color); };
    // 花・低木のかたまり（樹冠と同じ形を低く使う）。yc＝中心の高さ
    const bush = function (s, lat, r, hgt, color, yc) { const o = place(bushes, s, lat, r, hgt, r, rand() * 6, color, yc); return o; };
    const URBAN = { city: 1, strip: 1, suburb: 1, town: 1, onsen: 1, industrial: 1, kanetown: 1 };
    const FARM = { rice: 1, soba: 1, field: 1, orchard: 1, cherry: 1, grape: 1 };
    [-1, 1].forEach(function (side) {
      const land = side < 0 ? landL : landR;
      // 冬：除雪で路肩に寄せた雪の壁（北へ行くほど高い）
      if (winter) {
        const deep = sMid > 31000 ? 1 : (sMid > 13000 ? 0.72 : 0.55);
        for (let s = s0 + 5; s < s1; s += 10) {
          const e = RT.halfWidth(s) + RT.SHOULDER, lat = side * (e + 1.05);
          if (!clearOf(s, lat) || !clearOf(s + 5, lat) || !clearOf(s - 5, lat) || (side < 0 && (R13.sim.serviceDepth(s - 5) > 0 || R13.sim.serviceDepth(s + 5) > 0))) continue;
          if (RT.riverClear(s - 5) || RT.riverClear(s + 5)) continue;
          const hgt = (0.5 + hash(s * 0.37 + side * 3.1) * 0.55) * deep;
          if (box(s, lat, 1.5, hgt, 10.3, 0xeef2f6, 0)) box(s, lat + side * 0.15, 0.95, hgt * 0.4, 10.3, 0xffffff, hgt);
        }
      }
      // 街路灯（まちなか）：夕方・雨の日は灯具がともる
      if (URBAN[land]) {
        for (let s = s0 + (side < 0 ? 12 : 37); s < s1; s += 50) {
          const e = RT.halfWidth(s) + RT.SHOULDER, lat = side * (e + 1.3);
          if (!clearOf(s, lat) || !clearOf(s, side * 20) || (side < 0 && R13.sim.serviceDepth(s) > 0)) continue;
          if (!place(poles, s, lat, 1, 7.6, 1, null, null)) continue;
          box(s, side * (e + 0.2), 2.3, 0.13, 0.13, 0x8e8a82, 7.5);
          place(lamps, s, side * (e - 0.9), 0.95, 0.16, 0.38, null, null, 7.36);
        }
      }
      // 視線誘導標（田園の直線）：白い支柱と反射板
      if (FARM[land] && s0 <= 30000) {
        for (let s = s0 + 20; s < s1; s += 50) {
          const lat = side * (RT.halfWidth(s) + RT.SHOULDER + 0.5);
          if (!clearOf(s, lat) || (side < 0 && R13.sim.serviceDepth(s) > 0)) continue;
          if (box(s, lat, 0.1, 1.0, 0.1, 0xf4f4f0)) box(s, lat, 0.16, 0.16, 0.05, side < 0 ? 0xf5f5f5 : 0xff8a1e, 0.78);
        }
      }
      // 道ばたの花：春は菜の花、夏はひまわり、秋はコスモス（こんもりした株が並ぶ）
      if (FARM[land] && !winter && hash(k * 3.7 + side * 1.3) < 0.4) {
        const pal = season === 'spring' ? [0xf2d726, 0xe8c81a, 0xf6e04a, 0x7fb24a] : (season === 'summer' ? [0xf5c518, 0xf0b410, 0xf7d23a] : [0xe58ab6, 0xf3c4da, 0xc9508c, 0xf6e4ec, 0x7a9a4a]);
        const cnt = N(season === 'summer' ? 30 : 46);
        for (let i = 0; i < cnt; i++) {
          const s = s0 + 3 + rand() * 94, lat = side * (RT.halfWidth(s) + RT.SHOULDER + 3.5 + rand() * 2.2);
          if (!clearOf(s, lat) || (side < 0 && R13.sim.serviceDepth(s) > 0)) continue;
          const c = pal[Math.floor(rand() * pal.length)];
          if (season === 'summer') {                                               // ひまわり：緑の茎の上に黄色い花
            bush(s, lat, 0.08, 0.85, 0x4b8732, 0.85);
            bush(s, lat, 0.3, 0.16, 0x3f7a2c, 0.9);
            bush(s, lat, 0.46, 0.17, c, 1.72);
            bush(s, lat, 0.2, 0.2, 0x7a4a1c, 1.74);
          } else bush(s, lat, 0.7 + rand() * 0.5, 0.34 + rand() * 0.22, c, 0.2);
        }
      }
      // のぼり旗（直売所・そば屋・温泉の宣伝）。3 本ずつ並び、風でゆれる
      const flagP = land === 'rice' ? 0.07 : 0.24;
      if (hash(k * 5.3 + side * 2.9 + 0.7) < flagP) {
        const text = flagTextFor(land, RT.regionAt(sMid).id, hash(k * 1.9 + side));
        const fs = s0 + 18 + hash(k * 7.1 + side) * 56;
        const flat = side * (RT.halfWidth(fs) + RT.SHOULDER + 1.7);
        if (text && clearOf(fs, flat) && !RT.riverClear(fs) && !RT.riverClear(fs + 8) && !nearBoard(fs + 3, 12) && !(side < 0 && (R13.sim.serviceDepth(fs) > 0 || R13.sim.serviceDepth(fs + 8) > 0))) {
          const fg = new THREE.Group(); const banners = [];
          for (let i = 0; i < 3; i++) {
            const q = RT.pointAt(fs + i * 3.2, flat);
            const one = new THREE.Group(); one.position.set(q.x, q.y, q.z); one.rotation.y = -q.h;
            const pole = new THREE.Mesh(GE.flagpole, M.flagpole); pole.userData.sharedGeo = true; one.add(pole);
            const bn = new THREE.Mesh(GE.flag, new THREE.MeshLambertMaterial({ map: flagTex(text), side: THREE.DoubleSide }));
            bn.userData.sharedGeo = true; bn.userData.ownMat = true; bn.userData.ph = i * 1.3 + k; one.add(bn); banners.push(bn);
            fg.add(one);
          }
          fg.userData.flags = text;
          fg.userData.anim = function (t) { for (let i = 0; i < banners.length; i++) banners[i].rotation.y = Math.sin(t * 2.6 + banners[i].userData.ph) * 0.3 + Math.sin(t * 5.3 + banners[i].userData.ph * 2) * 0.08; };
          self.anims.add(fg); group.add(fg);
        }
      }
      // 秋のすすき（山あい・川沿いの道ばた）
      if (season === 'autumn' && GUARD[land]) {
        for (let i = 0; i < N(14); i++) {
          const s = s0 + rand() * CHUNK, lat = sideLat(side, 2.4, 7);
          if (clearOf(s, lat)) stook(s, lat, 0.22 + rand() * 0.16, 1.0 + rand() * 0.6, rand() < 0.5 ? 0xd8c9a0 : 0xc9b88a);
        }
      }
    });

    const GEN = {
      city: function (side) {
        for (let i = 0; i < N(9); i++) {
          const s = s0 + rand() * CHUNK, lat = sideLat(side, 7, 22);
          if (!clearOf(s, lat)) continue;
          const w = 10 + rand() * 14, d = 10 + rand() * 12, h = 8 + rand() * 26;
          place(blds, s, lat + side * d / 2, w, h, d, null, pick(bldCols));
        }
        for (let i = 0; i < N(10); i++) {
          const s = s0 + rand() * CHUNK, lat = sideLat(side, 40, 160);
          place(blds, s, lat, 14 + rand() * 12, 12 + rand() * 40, 14 + rand() * 12, null, pick(bldCols));
        }
        for (let i = 0; i < N(3); i++) { const s = s0 + rand() * CHUNK, lat = sideLat(side, 4, 6); if (clearOf(s, lat)) tree(s, lat, 1.6, 4 + rand() * 2, 'city', 0x4f7f3a); }
      },
      // 住宅地：戸建てに、ロードサイドの店と中低層の集合住宅が混じる
      suburb: function (side) {
        for (let i = 0; i < N(10); i++) {
          const s = s0 + rand() * CHUNK, lat = sideLat(side, 8, 70);
          if (!clearOf(s, lat)) continue;
          house(s, lat + side * 4, 7 + rand() * 4, 5 + rand() * 2.5, 8 + rand() * 4);
        }
        for (let i = 0; i < N(1); i++) {
          const s = s0 + rand() * CHUNK, lat = sideLat(side, 5, 10);
          if (!clearOf(s, lat)) continue;
          place(blds, s, lat + side * 7, 16 + rand() * 12, 5 + rand() * 3, 14, null, pick(bldCols));
        }
        if (rand() < 0.22) {
          const s = s0 + rand() * CHUNK, lat = sideLat(side, 80, 130);
          if (clearOf(s, lat)) place(blds, s, lat, 26 + rand() * 10, 12 + rand() * 5, 11, null, pick(bldCols));
        }
        for (let i = 0; i < N(6); i++) tree(s0 + rand() * CHUNK, sideLat(side, 15, 135), 2.3, 5 + rand() * 4, 'suburb');
      },
      // まちなか：住宅と小さな店
      town: function (side) {
        for (let i = 0; i < N(7); i++) {
          const s = s0 + rand() * CHUNK, lat = sideLat(side, 6, 40);
          if (!clearOf(s, lat)) continue;
          house(s, lat + side * 4, 7 + rand() * 4, 5 + rand() * 2.5, 8 + rand() * 4);
        }
        for (let i = 0; i < N(3); i++) {
          const s = s0 + rand() * CHUNK, lat = sideLat(side, 6, 14);
          if (!clearOf(s, lat)) continue;
          place(blds, s, lat + side * 6, 12 + rand() * 8, 4 + rand() * 4, 11, null, pick(bldCols));
        }
        for (let i = 0; i < N(8); i++) tree(s0 + rand() * CHUNK, sideLat(side, 20, 135), 2.4, 5 + rand() * 4, 'town');
      },
      // 温泉街：まちなみの奥に中層の旅館・ホテル
      onsen: function (side) {
        GEN.town(side);
        for (let i = 0; i < N(2); i++) {
          const s = s0 + rand() * CHUNK, lat = sideLat(side, 45, 115);
          place(blds, s, lat, 16 + rand() * 8, 18 + rand() * 16, 14 + rand() * 6, null, pick([0xe3ddd0, 0xd8cdb8, 0xc9c2b4, 0xe8e2d4]));
        }
      },
      // 金山：白壁と切妻屋根の「金山型住宅」、背後に杉
      kanetown: function (side) {
        for (let i = 0; i < N(9); i++) {
          const s = s0 + rand() * CHUNK, lat = sideLat(side, 9, 50);
          if (!clearOf(s, lat)) continue;
          const w = 7.5 + rand() * 3, d = 9 + rand() * 3.5, rot = heading(s) + (rand() < 0.6 ? 0 : Math.PI / 2);
          if (house(s, lat + side * 4, w, 6 + rand() * 2, d, 0xf4f1ea, pick([0x2e2a28, 0x3a3230, 0x4a3a30]), rot))
            place(boxes, s, lat + side * 4, w + 0.25, 1.5, d + 0.25, rot, 0x5a4636, 0);          // 腰板（杉板）
        }
        for (let i = 0; i < N(10); i++) cedar(s0 + rand() * CHUNK, sideLat(side, 60, 170), 2 + rand(), 13 + rand() * 9);
        for (let i = 0; i < N(3); i++) tree(s0 + rand() * CHUNK, sideLat(side, 12, 60), 2.2, 5 + rand() * 3, 'town');
      },
      // ロードサイド店舗：駐車場の奥に平屋の大きな店、道路際にポール看板
      strip: function (side) {
        for (let i = 0; i < 2; i++) {
          if (rand() > 0.5 + 0.5 * dens) continue;
          const s = s0 + 14 + i * 50 + rand() * 10;
          const along = 24 + rand() * 16, depth = 14 + rand() * 8, h = 5 + rand() * 3, setback = 13 + rand() * 7;
          const lat = side * (E + setback + depth / 2);
          if (!clearOf(s, lat) || !clearOf(s - along / 2, lat) || !clearOf(s + along / 2, lat)) continue;
          const brand = pick(brandCols);
          if (!box(s, lat, depth, h, along, pick(storeCols))) continue;
          box(s, side * (E + setback - 0.3), 0.6, 1.3, along * 0.96, brand, h - 1.6);              // 軒の帯看板
          box(s, side * (E + setback - 0.14), 0.28, 2.5, along * 0.74, 0x2b3c4e, 0.2);             // ガラス張りの店先
          for (let f = 0; f < 3; f++) {                                                            // のぼり旗
            const fs = s + along / 2 + 2 + f * 2.2, fl = side * (E + 3.6);
            if (clearOf(fs, fl) && place(poles, fs, fl, 0.5, 3.1, 0.5, null, null)) box(fs, fl + side * 0.3, 0.55, 1.7, 0.05, brandCols[(f + Math.floor(s)) % brandCols.length], 1.25);
          }
          plot(s, side * (E + 2.5 + (setback - 3) / 2), setback - 3, along + 8, winter ? 0xd4d9de : 0x4b4e53, 0.05);   // 駐車場
          if (rand() < 0.8) {
            const ps = s - along / 2 - 3, pl = side * (E + 2.8);
            if (clearOf(ps, pl) && place(poles, ps, pl, 1, 8.6, 1, null, null)) box(ps, pl, 3.2, 2.2, 0.35, brand, 6.6);   // ポール看板
          }
        }
        for (let i = 0; i < N(3); i++) { const s = s0 + rand() * CHUNK, lat = sideLat(side, 55, 125); house(s, lat, 7 + rand() * 4, 5 + rand() * 2.5, 8 + rand() * 4); }
        for (let i = 0; i < N(3); i++) tree(s0 + rand() * CHUNK, sideLat(side, 45, 135), 2.3, 5 + rand() * 4, 'suburb');
      },
      // 流通・工業団地：大きな倉庫と工場
      industrial: function (side) {
        for (let i = 0; i < 2; i++) {
          if (rand() > 0.85) continue;
          const s = s0 + 22 + i * 52 + rand() * 6;
          const along = 34 + rand() * 12, depth = 26 + rand() * 12, h = 9 + rand() * 4, setback = 12 + rand() * 10;
          const lat = side * (E + setback + depth / 2);
          if (!clearOf(s, lat) || !clearOf(s - along / 2, lat) || !clearOf(s + along / 2, lat)) continue;
          if (!box(s, lat, depth, h, along, pick(wareCols))) continue;
          box(s, side * (E + setback - 0.2), 0.5, 1.0, along * 0.98, pick([0x1f5fa8, 0x2f8a4a, 0xd23a2e, 0x27407a]), h * 0.72);
          plot(s, side * (E + 2.5 + (setback - 3) / 2), setback - 3, along + 6, winter ? 0xd4d9de : 0x55585c, 0.05);
        }
        for (let i = 0; i < N(1); i++) { const s = s0 + rand() * CHUNK, lat = sideLat(side, 70, 120); place(blds, s, lat, 18, 9 + rand() * 4, 12, null, pick(bldCols)); }
        for (let i = 0; i < N(4); i++) { const s = s0 + rand() * CHUNK, lat = sideLat(side, 4.5, 6.5); if (clearOf(s, lat)) tree(s, lat, 1.7, 4 + rand() * 2, 'city'); }
      },
      // 水田
      rice: function (side) {
        for (let s = s0; s < s1; s += 25) {
          for (let j = 0; j < Math.round(5 * dens); j++) {
            const lat = side * (RT.halfWidth(s) + RT.SHOULDER + 5 + j * 22 + 11);
            const shade = 0.85 + hash(s * 0.1 + j * 3 + side) * 0.3;
            if (!clearOf(s, lat)) continue;
            const pd = place(paddies, s + 12.5, lat, 21, 1, 23.5, null, new THREE.Color(0.76 * shade, 0.57 * shade, 0.17 * shade).getHex(), 0.14);
            // 秋：刈り取りの終わった田に杭掛け（くいがけ）が並ぶ
            if (pd && season === 'autumn' && j < 4 && hash(s * 0.37 + j * 9.1 + side) < 0.3) {
              pd.color = 0xb9a160;
              for (let q = 0; q < 6; q++) stook(s + 2.5 + q * 4, lat + (hash(s + q) - 0.5) * 3, 0.62, 2.0, q % 2 ? 0xc9a54e : 0xb8923c);
            }
          }
        }
        for (let i = 0; i < N(2); i++) farmhouse(side, i, 118, 132);
      },
      // そば畑（夏の終わりから秋に白い花）
      soba: function (side) {
        const cols = { spring: [0x8a7a56, 0x93825c], summer: [0x6f9a48, 0x79a552], autumn: [0xe4e9d8, 0xd9e0c6, 0xeef0e2], winter: [snow, 0xeef2f6] }[season] || [0xe4e9d8];
        for (let s = s0; s < s1; s += 25) {
          for (let j = 0; j < Math.round(5 * dens); j++) {
            const lat = side * (RT.halfWidth(s) + RT.SHOULDER + 5 + j * 22 + 11);
            if (!clearOf(s, lat)) continue;
            plot(s + 12.5, lat, 21, 23.5, cols[Math.floor(hash(s * 0.3 + j * 5 + side) * cols.length)], 0.12);
          }
        }
        for (let i = 0; i < N(2); i++) farmhouse(side, i, 118, 132);
      },
      // すいか畑：畝に沿ってつるが伸び、夏は実がなる。春はトンネル栽培の白い覆い。
      field: function (side) {
        const soil = winter ? snow : (season === 'spring' ? 0x86704c : 0x7a6848);
        for (let s = s0; s < s1; s += 25) {
          for (let j = 0; j < Math.round(4 * dens); j++) {
            const lat = side * (RT.halfWidth(s) + RT.SHOULDER + 5 + j * 22 + 11);
            if (!clearOf(s, lat)) continue;
            plot(s + 12.5, lat, 21, 23.5, soil, 0.12);
            if (winter) continue;
            for (let r = 0; r < 4; r++) {
              const rl = lat + (r - 1.5) * 5;
              if (season === 'spring') box(s + 12.5, rl, 1.5, 0.55, 22, 0xeef1f2, 0.12);
              else box(s + 12.5, rl, 3.2, 0.22, 22, season === 'summer' ? 0x3f7f2e : 0x7f8a46, 0.12);
              if (season === 'summer' && j < 2) for (let f = 0; f < 3; f++) fruit(s + 2 + rand() * 21, rl + (rand() - 0.5) * 2.6, 0.42, 0x1f5a24, 2.3);
            }
          }
        }
        for (let i = 0; i < N(1); i++) farmhouse(side, i, 108, 130);
      },
      // 果樹園（りんご・ラ・フランス）：秋に実がなる
      orchard: function (side, kind) {
        const cherry = kind === 'cherry';
        const kaki = !cherry && s0 >= 13000 && s0 < 17000;            // 上山：柿（紅柿）
        const rowStart = 9 + rand() * 4;
        const showFruit = cherry ? season === 'summer' : season === 'autumn';
        if (kaki && (season === 'autumn' || season === 'winter')) {
          // 柿のれん：軒先につるした干し柿
          for (let i = 0; i < 2; i++) {
            const s = s0 + 20 + i * 50 + rand() * 10, lat = side * (RT.halfWidth(s) + RT.SHOULDER + 6.5);
            if (!clearOf(s, lat)) continue;
            if (place(poles, s - 3.4, lat, 1, 3.0, 1, null, null)) { place(poles, s + 3.4, lat, 1, 3.0, 1, null, null); box(s, lat, 0.25, 1.9, 6.6, 0xe07a1c, 0.9); box(s, lat, 0.9, 0.12, 7.4, 0x6b4a3a, 2.95); }
          }
        }
        for (let r = 0; r < Math.round(6 * dens); r++) {
          const fc = cherry ? 0xc4182c : (kaki ? (r % 3 === 2 ? 0xb9c44e : 0xe8781e) : (r % 2 ? 0xc4282c : 0xb9c44e));
          for (let s = s0 + 3; s < s1; s += 7) {
            const lat = side * (RT.halfWidth(s) + RT.SHOULDER + rowStart + r * 7);
            if (!clearOf(s, lat)) continue;
            const sc = 1.7 + rand() * 0.5;
            tree(s, lat, sc, 2.6 + rand(), cherry ? 'cherry' : 'orchard', [0x5f8f34, 0x6a9a3a, 0x568a30][r % 3]);
            if (showFruit && rand() < 0.55) for (let f = 0; f < 3; f++) fruit(s + (rand() - 0.5) * 2.4, lat + (rand() - 0.5) * 2.4, 2.2 + rand() * 1.2, fc, cherry ? 0.8 : 1.15);
          }
          // さくらんぼの雨よけハウス（収穫期の夏、道路に近い列）
          if (cherry && season === 'summer' && r < 3) {
            for (let s = s0 + 1; s < s1; s += 33) {
              const lat = side * (RT.halfWidth(s + 16) + RT.SHOULDER + rowStart + r * 7);
              if (!clearOf(s + 16, lat) || !clearOf(s, lat) || !clearOf(s + 32, lat)) continue;
              if (box(s + 16.5, lat, 6.3, 0.12, 31, 0xeef2f3, 4.5)) { place(poles, s + 1.5, lat, 1, 4.5, 1, null, null); place(poles, s + 31.5, lat, 1, 4.5, 1, null, null); }
            }
          }
        }
        for (let i = 0; i < N(2); i++) { const s = s0 + rand() * CHUNK; house(s, sideLat(side, 60, 125), 8, 5.5, 9, wallCols[i % wallCols.length], roofCols[(k + i) % roofCols.length], heading(s)); }
      },
      cherry: function (side) { GEN.orchard(side, 'cherry'); },
      // ぶどう棚（平らな棚に葉が茂る）。hillside=true は斜面のぶどう畑（雨よけ付き）
      grape: function (side, hillside) {
        const leaf = { spring: [0x9ac35c, 0x8cb854], summer: [0x4f8a34, 0x5a963a], autumn: [0x9aa23e, 0xb09a3a, 0x7f9a38], winter: [0xe6ebee, 0xdfe5e9] }[season] || [0x5a963a];
        const rows = Math.round((hillside ? 13 : 6) * dens);
        for (let r = 0; r < rows; r++) {
          for (let s = s0 + 6.5; s < s1; s += 13) {
            const lat = side * (RT.halfWidth(s) + RT.SHOULDER + 9 + r * 7.6);
            if (!clearOf(s, lat) || (hillside && rand() < r * 0.035)) continue;
            if (!box(s, lat, 6.6, winter ? 0.1 : 0.32, 11.6, leaf[(r + Math.floor(s / 13)) % leaf.length], 1.85)) continue;
            place(poles, s - 5.6, lat, 1, 1.9, 1, null, null);
            if (hillside && r % 3 === 1 && !winter) box(s, lat, 6.0, 0.1, 11.6, 0xe9eef0, 2.75);          // 雨よけ
            if (season === 'autumn' && r < 6) for (let f = 0; f < 3; f++) fruit(s + (rand() - 0.5) * 9, lat + (rand() - 0.5) * 5, 1.55, 0x5b2a70, 1.4);
          }
        }
        if (hillside) for (let i = 0; i < N(12); i++) tree(s0 + rand() * CHUNK, sideLat(side, 118, 215), 3, 6 + rand() * 4, 'hill', pick([0x3f6f30, 0x6b8a2e, 0xb06a28, 0xc8902a]));
        else for (let i = 0; i < N(2); i++) { const s = s0 + rand() * CHUNK; house(s, sideLat(side, 70, 125), 8, 5.5, 9, null, null, heading(s)); }
      },
      grapehill: function (side) { GEN.grape(side, true); },
      // 里山：雑木林（秋は紅葉）に杉が混じる
      hill: function (side) {
        for (let i = 0; i < N(26); i++) {
          const s = s0 + rand() * CHUNK, lat = sideLat(side, 6, 170);
          if (!clearOf(s, lat)) continue;
          if (rand() < 0.35) cedar(s, lat, 1.8 + rand() * 1.2, 9 + rand() * 9);
          else tree(s, lat, 2.8, 6 + rand() * 4, 'hill', pick([0x3f6f30, 0x6b8a2e, 0xb06a28, 0xc8902a]));
        }
      },
      // 杉林（金山は背の高い金山杉）
      forest: function (side) {
        const tall = s0 >= 49000;
        for (let i = 0; i < N(30); i++) {
          const s = s0 + rand() * CHUNK, lat = sideLat(side, 6, 170);
          if (!clearOf(s, lat)) continue;
          if (rand() < 0.85) cedar(s, lat, 1.8 + rand() * 1.2, tall ? 15 + rand() * 10 : 9 + rand() * 9);
          else tree(s, lat, 2.8, 6 + rand() * 4, 'forest', pick([0x3f6f30, 0x6b8a2e, 0xb06a28, 0xc8902a]));
        }
      },
      // 湖と湿原（白竜湖）：岸にヨシ、対岸に木立
      lake: function (side) {
        const reed = { spring: 0xa9b46a, summer: 0x6f9a40, autumn: 0xc2ae62, winter: 0xcfc9a8 }[season] || 0xc2ae62;
        for (let i = 0; i < N(34); i++) tree(s0 + rand() * CHUNK, sideLat(side, 6, 22), 0.55 + rand() * 0.3, 1.2 + rand() * 0.8, 'lake', reed, true);
        for (let i = 0; i < N(7); i++) tree(s0 + rand() * CHUNK, sideLat(side, 158, 220), 3, 6 + rand() * 4, 'hill', pick([0x3f6f30, 0x6b8a2e, 0xb06a28]));
      },
      // 川沿い（最上川）：手前の岸に木立、対岸は山
      riverside: function (side) {
        for (let i = 0; i < N(7); i++) tree(s0 + rand() * CHUNK, sideLat(side, 7, 26), 2.2, 5 + rand() * 4, 'town');
        for (let i = 0; i < N(12); i++) {
          const s = s0 + rand() * CHUNK, lat = sideLat(side, 158, 222);
          if (rand() < 0.5) cedar(s, lat, 2.4, 10 + rand() * 8); else tree(s, lat, 3, 6 + rand() * 4, 'hill', pick([0x3f6f30, 0x6b8a2e, 0xb06a28, 0xc8902a]));
        }
      }
    };
    for (const side of [-1, 1]) {
      const land = side < 0 ? landL : landR;
      (GEN[land] || GEN.town)(side);
    }

    // ---- 四季の色付け ----
    const pickH = function (arr, i) { return arr[Math.abs(i) % arr.length]; };
    if (look.tree) {
      trees.forEach(function (o) {
        if (o.fixed) return;
        const hsh = Math.floor(hash(o.x * 0.37 + o.z * 0.11) * 1000);
        const fruitTree = o.land === 'orchard' || o.land === 'cherry';
        if (o.land === 'forest' || o.land === 'hill') o.color = pickH(look.forestTree || look.tree, hsh);
        else if (look.blossom && (fruitTree || hsh % 3 === 0)) o.color = o.land === 'cherry' ? pickH([0xfbeef2, 0xf7e2ea, 0xffffff], hsh) : pickH(look.blossom, hsh);   // 春：桜・果樹の花（さくらんぼは白）
        else o.color = pickH(look.tree, hsh);
        if (look.bare) { o.sx *= 0.72; o.sz *= 0.72; }                                                        // 冬：雪をかぶった枯れ木
      });
    }
    if (look.paddy) paddies.forEach(function (o, i) { o.color = pickH(look.paddy, i); });
    if (look.roofSnow) houses.forEach(function (o, i) { if (i % 7 !== 3) o.roof = 0xf3f5f8; });

    // instanced meshes
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const cMid = RT.pointAt(s0 + CHUNK / 2, 0);
    const cSphere = new THREE.Sphere(new THREE.Vector3(cMid.x, cMid.y + 10, cMid.z), 300);
    function inst(geo, mat, arr, fn, shadow) {
      if (!arr.length) return;
      const g2 = geo.clone();
      g2.boundingSphere = cSphere.clone();
      const im = new THREE.InstancedMesh(g2, mat, arr.length);
      im.frustumCulled = true;
      arr.forEach(function (o, i) {
        fn(dummy, o);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
        if (o._c != null) { col.setHex(o._c); im.setColorAt(i, col); }
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = !!shadow && Q.shadows; im.receiveShadow = false;
      group.add(im);
    }
    inst(GE.trunk, M.trunk, trees, function (d, o) { d.position.set(o.x, o.y, o.z); d.rotation.set(0, o.rot, 0); d.scale.set(1, o.sy * 0.45, 1); });
    // 樹冠：1本ずつ明るさを変え、標準画質以上では小さな樹冠を重ねてこんもり見せる
    const shadeHex = function (hex, k) { col.setHex(hex); col.multiplyScalar(k); return col.getHex(); };
    const canopies = [];
    trees.forEach(function (o) {
      const hsh = hash(o.x * 0.71 + o.z * 0.29);
      const c0 = o.fixed ? o.color : shadeHex(o.color, 0.88 + hsh * 0.24);
      canopies.push({ x: o.x, y: o.y + o.sy * 0.62, z: o.z, sx: o.sx, sy: o.sy * 0.42, sz: o.sz, rot: o.rot, _c: c0 });
      if (dens >= 0.8 && !o.fixed && o.sy > 3.4) {
        const a = hsh * 6.283, k = 0.58 + hsh * 0.14;
        canopies.push({ x: o.x + Math.cos(a) * o.sx * 0.5, y: o.y + o.sy * (0.78 + hsh * 0.1), z: o.z + Math.sin(a) * o.sx * 0.5, sx: o.sx * k, sy: o.sy * 0.42 * k, sz: o.sz * k, rot: o.rot + 1, _c: shadeHex(o.color, 1.0 + hsh * 0.16) });
      }
    });
    bushes.forEach(function (o) { canopies.push({ x: o.x, y: o.y, z: o.z, sx: o.sx, sy: o.sy, sz: o.sz, rot: o.rot, _c: o.color }); });
    inst(GE.canopy, M.leaf, canopies, function (d, o) { d.position.set(o.x, o.y, o.z); d.rotation.set(0, o.rot, 0); d.scale.set(o.sx, o.sy, o.sz); }, true);
    stooks.forEach(function (o) { o._c = o.color; });
    inst(GE.cedar, M.roof, stooks, function (d, o) { d.position.set(o.x, o.y, o.z); d.rotation.set(0, o.rot, 0); d.scale.set(o.sx, o.sy, o.sz); });
    inst(GE.box, M.lamp, lamps, function (d, o) { d.position.set(o.x, o.y, o.z); d.rotation.set(0, o.rot, 0); d.scale.set(o.sx, o.sy, o.sz); });
    fruits.forEach(function (o) { o._c = o.color != null ? o.color : 0xc4282c; });
    inst(GE.fruit, M.fruit, fruits, function (d, o) { d.position.set(o.x, o.y, o.z); d.rotation.set(0, 0, 0); d.scale.set(o.sx, o.sx, o.sx); });
    boxes.forEach(function (o) { o._c = o.color; });
    inst(GE.box, M.wall, boxes, function (d, o) { d.position.set(o.x, o.y, o.z); d.rotation.set(0, o.rot, 0); d.scale.set(o.sx, o.sy, o.sz); }, true);
    plots.forEach(function (o) { o._c = o.color; });
    inst(GE.plane, M.plot, plots, function (d, o) { d.position.set(o.x, o.y, o.z); d.rotation.set(0, o.rot, 0); d.scale.set(o.sx, 1, o.sz); });
    inst(GE.cedar, M.cedar, cedars, function (d, o) { d.position.set(o.x, o.y + o.sy * 0.15, o.z); d.rotation.set(0, o.rot, 0); d.scale.set(o.sx, o.sy * 0.88, o.sz); }, true);
    inst(GE.trunk, M.trunk, cedars, function (d, o) { d.position.set(o.x, o.y, o.z); d.rotation.set(0, 0, 0); d.scale.set(1, o.sy * 0.2, 1); });
    blds.forEach(function (o) { o._c = o.color; });
    inst(GE.box, M.bldg, blds, function (d, o) { d.position.set(o.x, o.y, o.z); d.rotation.set(0, o.rot, 0); d.scale.set(o.sx, o.sy, o.sz); }, true);
    houses.forEach(function (o) { o._c = o.wall; });
    inst(GE.box, M.house, houses, function (d, o) { d.position.set(o.x, o.y, o.z); d.rotation.set(0, o.rot, 0); d.scale.set(o.sx, o.sy * 0.7, o.sz); }, true);
    houses.forEach(function (o) { o._c = o.roof; });
    inst(GE.roof, M.roof, houses, function (d, o) { d.position.set(o.x, o.y + o.sy * 0.7, o.z); d.rotation.set(0, o.rot, 0); d.scale.set(o.sx, o.sy * 0.75, o.sz); }, true);
    houses.forEach(function (o) { o._c = null; });
    inst(GE.pole, M.pole, poles, function (d, o) { d.position.set(o.x, o.y, o.z); d.rotation.set(0, 0, 0); d.scale.set(1, o.sy, 1); });
    paddies.forEach(function (o) { o._c = o.color; });
    inst(GE.plane, M.paddy, paddies, function (d, o) { d.position.set(o.x, o.y, o.z); d.rotation.set(0, o.rot, 0); d.scale.set(o.sx, 1, o.sz); });
    // snow arrows: pole + red/white arrow
    inst(GE.pole, M.arrowWhite, arrows, function (d, o) { d.position.set(o.x, o.y, o.z); d.rotation.set(0, 0, 0); d.scale.set(0.4, 5.2, 0.4); });
    const heads = [];
    arrows.forEach(function (o) { for (let j = 0; j < 4; j++) heads.push({ x: o.x, y: o.y + 5.2 - j * 0.42, z: o.z, rot: o.rot, j: j }); });
    const reds = heads.filter(function (h) { return h.j % 2 === 0; }), whites = heads.filter(function (h) { return h.j % 2 === 1; });
    const ag = new THREE.BoxGeometry(0.75, 0.38, 0.06); ag.translate(0.3, 0, 0);
    ag.boundingSphere = cSphere.clone();
    [[reds, M.arrowRed], [whites, M.arrowWhite]].forEach(function (p) {
      if (!p[0].length) return;
      const im = new THREE.InstancedMesh(ag, p[1], p[0].length);
      im.frustumCulled = true;
      p[0].forEach(function (o, i) {
        const lat = 1; dummy.position.set(o.x, o.y, o.z); dummy.rotation.set(0, o.rot, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      });
      group.add(im);
    });
  };

  // ------------------------------------------------------------ signs & landmarks
  function addSign(group, s, lat, w, h, tex, poleH, opts) {
    opts = opts || {};
    const p = RT.pointAt(s, lat);
    const g = new THREE.Group();
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = -p.h + (opts.turn || 0);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.1 });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    board.userData.ownMat = true;
    board.position.y = poleH + h / 2;
    g.add(board);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x8c949a }));
    back.userData.ownMat = true;
    back.rotation.y = Math.PI; back.position.y = poleH + h / 2; back.position.z = -0.02;
    g.add(back);
    const legs = opts.legs || [0];
    legs.forEach(function (lx) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, poleH + h * 0.5, 6), new THREE.MeshStandardMaterial({ color: 0xa0a8ac, metalness: 0.5, roughness: 0.4 }));
      pole.userData.ownMat = true;
      pole.position.set(lx, (poleH + h * 0.5) / 2, -0.06); g.add(pole);
    });
    group.add(g);
    return g;
  }

  // 方面と距離の案内標識を立てる位置（まちに入って約 180 m 先。トンネル・橋・信号・道の駅を避ける）
  function distSignSpot(r) {
    if (r.end >= RT.TOTAL) return null;                  // 最後のまち（金山）には立てない
    for (let s = r.start + 180; s < r.start + 760; s += 20) {
      let ok = true;
      for (const t of RT.TUNNELS) if (s > t.start - 110 && s < t.end + 110) ok = false;
      for (const rv of RT.RIVERS) if (Math.abs(s - rv.s) < rv.half + 70 + (rv.bank || 0)) ok = false;
      for (const sg of RT.SIGNALS) if (s > sg.s - 45 && s < sg.s + 70) ok = false;
      for (const st of RT.STATIONS) if (Math.abs(s - st.s) < 215 || Math.abs(s - (st.s - 300)) < 40 || Math.abs(s - (st.s - 800)) < 40) ok = false;
      for (let q = 300; q < RT.TOTAL; q += 1600) if (Math.abs(s - q) < 40) ok = false;
      if (ok) return s;
    }
    return null;
  }
  function distSignRows(i, s) {
    const R = RT.REGIONS, pickIds = [];
    if (R[i + 1]) pickIds.push(i + 1);
    ['yamagata', 'shinjo', 'kaneyama'].forEach(function (id) {
      const j = R.findIndex(function (r) { return r.id === id; });
      if (j > i && pickIds.indexOf(j) < 0 && pickIds.length < 3) pickIds.push(j);
    });
    return pickIds.map(function (j) { return { name: R[j].name, en: R[j].en.charAt(0) + R[j].en.slice(1).toLowerCase(), km: Math.max(1, Math.round((R[j].start - s) / 1000)) }; }).reverse();
  }
  Renderer.distSignSpot = distSignSpot; Renderer.distSignRows = distSignRows;

  // のぼり旗（沿道の直売所やそば屋の宣伝。作物やまちに合わせた文字）
  const FLAGS = {
    'さくらんぼ': ['#ffffff', '#d2232a'], 'ぶどう': ['#f4ecf8', '#6b3a86'], 'ワイン': ['#6b1f3a', '#ffffff'], 'そば': ['#1f3a5f', '#ffffff'], 'すいか': ['#2f8a3c', '#ffffff'],
    'ラ・フランス': ['#eef2c0', '#5a7a1c'], 'りんご': ['#ffffff', '#c8322b'], 'つや姫': ['#b3261e', '#ffe9a8'], '温泉': ['#e8872a', '#ffffff'], '直売所': ['#f2c230', '#b3261e']
  };
  function flagTex(text) {
    const col = FLAGS[text] || FLAGS['直売所'];
    return canvasTex('flag:' + text, 96, 304, function (g, w, h) {
      g.fillStyle = col[0]; g.fillRect(0, 0, w, h);
      g.fillStyle = col[1]; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const ch = Array.from(text), step = Math.min(62, (h - 44) / ch.length);
      g.font = '900 ' + Math.round(Math.min(64, step * 1.02)) + 'px ' + JP_FONT;
      ch.forEach(function (c, i) {
        const y = 22 + step * (i + 0.5) + ((h - 44) - step * ch.length) / 2;
        if (c === 'ー' || c === '・') { g.save(); g.translate(w / 2, y); if (c === 'ー') g.rotate(Math.PI / 2); g.fillText(c, 0, 0); g.restore(); }
        else g.fillText(c, w / 2, y);
      });
    }, false);
  }
  function flagTextFor(land, regionId, r) {
    if (land === 'cherry') return 'さくらんぼ';
    if (land === 'grape' || land === 'grapehill') return r < 0.3 ? 'ワイン' : 'ぶどう';
    if (land === 'soba') return 'そば';
    if (land === 'field') return 'すいか';
    if (land === 'onsen') return '温泉';
    if (land === 'orchard') return ({ kaminoyama: 'ラ・フランス', tendo: 'ラ・フランス', takahata: 'ラ・フランス', yamagata: 'さくらんぼ', higashine: r < 0.5 ? 'さくらんぼ' : 'りんご' })[regionId] || 'りんご';
    if (land === 'rice') return r < 0.5 ? 'つや姫' : '直売所';
    return null;
  }
  Renderer.flagTextFor = flagTextFor;

  // 名所カードの案内板（観光案内の茶色の板に、名所の絵と名前）。木の柱と小さな屋根つき。
  let boardSpotCache = null;
  function boardSpots() { return boardSpotCache || (boardSpotCache = (R13.sights ? R13.sights.boardSpots(RT) : {})); }
  function sightBoardTex(card) {
    const reg = RT.REGIONS.filter(function (r) { return r.id === card.region; })[0];
    return canvasTex('sightboard:' + card.id, 512, 400, function (g, w, h) {
      g.fillStyle = '#5b3d26'; roundRect(g, 0, 0, w, h, 18); g.fill();
      g.fillStyle = '#f4ead2'; roundRect(g, 10, 10, w - 20, h - 20, 12); g.fill();
      R13.sights.draw(g, card, 18, 18, w - 36, 286);
      g.fillStyle = '#6b4a2e'; g.fillRect(18, 304, w - 36, h - 322);
      g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      fitText(g, card.name, w - 70, 50, 800); g.fillText(card.name, w / 2, 344);
      // 左上の札：「〇〇市の名所」
      const tag = reg.name + reg.muni + 'の名所';
      g.font = '800 24px ' + JP_FONT; const tw = g.measureText(tag).width + 26;
      g.fillStyle = '#b3261e'; roundRect(g, 18, 18, tw, 40, 8); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(tag, 31, 39);
    }, false);
  }
  function addSightBoard(group, s, card) {
    const W = 6.6, H = 5.15, base = 2.4;
    const lat = -(RT.halfWidth(s) + RT.SHOULDER + 4.6 + R13.sim.serviceDepth(s) * 6);
    const p = RT.pointAt(s, lat);
    const g = new THREE.Group();
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = -p.h - 0.26;
    g.userData.sightBoard = card.id;                       // 少し道路のほうへ向ける
    const tex = sightBoardTex(card);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.22 }));
    board.userData.ownMat = true; board.position.y = base + H / 2; g.add(board);
    const wood = new THREE.MeshStandardMaterial({ color: 0x5b3d26, roughness: 0.85 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, H + 0.1, 0.12), wood);
    back.userData.ownMat = true; back.position.set(0, base + H / 2, -0.08); g.add(back);
    [-1, 1].forEach(function (sd) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.34, base + H + 0.6, 0.34), wood);
      post.position.set(sd * (W / 2 + 0.2), (base + H + 0.6) / 2, -0.08); g.add(post);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(W / 2 + 0.95, 0.16, 1.3), new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 0.8 }));
      roof.userData.ownMat = true;
      roof.position.set(sd * (W / 4 + 0.22), base + H + 0.78, 0); roof.rotation.z = -sd * 0.3; g.add(roof);
    });
    group.add(g);
    return g;
  }
  Renderer.boardSpots = boardSpots;
  if (R13.sights) R13.sights.onPhoto = function (id) { delete texCache['sightboard:' + id]; };

  // トンネルの中（坑口の前後を含む）に標識を立てない。内側に当たる場合は出口の先か入口の手前へ移す。
  // target：その標識が案内している地点。出口の先に置けるならそちら、置けなければ入口の手前。
  function signOutsideTunnel(s, target) {
    for (const t of RT.TUNNELS) {
      if (s > t.start - 70 && s < t.end + 62) {
        const after = t.end + 66, before = t.start - 80;
        return (target == null || target - after >= 60) ? after : before;
      }
    }
    return s;
  }

  Renderer.signOutsideTunnel = signOutsideTunnel;
  // 中央線：はみ出し禁止区間＝黄色の二重線、片側2車線以上＝白の二重の破線（8m 引いて 2m あける）、片側1車線＝白の破線（5m／5m）
  //       車線境界線（同じ向きの車線の間）は細い白の破線（5m／5m・幅 13cm）
  function centerLineStyle(s) {
    if (RT.isYellow(s)) return 'yellow';
    return RT.lanesAt(clampS(s)) >= 2 ? 'wide' : 'dashed';
  }
  Renderer.centerLineStyle = centerLineStyle;
  Renderer.prototype._signs = function (group, s0, s1) {
    const inChunk = function (s) { return s >= s0 && s < s1; };
    // region welcome boards
    RT.REGIONS.forEach(function (r) {
      let ws = r.start - 30;
      const wt = RT.tunnelAt(ws) || RT.tunnelAt(ws + 12) || RT.tunnelAt(ws - 12);
      if (wt) ws = wt.end + 30;                       // トンネル内なら出口の先へ
      if (r.start <= 0 || !inChunk(ws)) return;
      const tex = signTex('region-' + r.id, 512, 256, function (g, w, h) {
        g.fillStyle = '#1f5fa8'; roundRect(g, 4, 4, w - 8, h - 8, 22); g.fill();
        g.strokeStyle = '#ffffff'; g.lineWidth = 8; roundRect(g, 14, 14, w - 28, h - 28, 16); g.stroke();
        g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        fitText(g, r.name + r.muni, w - 80, 110, 800); g.fillText(r.name + r.muni, w / 2, h * 0.42);
        fitText(g, r.en + (r.muni === '市' ? ' CITY' : ' TOWN'), w - 80, 40, 700); g.fillText(r.en + (r.muni === '市' ? ' CITY' : ' TOWN'), w / 2, h * 0.78);
      });
      addSign(group, ws, -(RT.halfWidth(ws) + RT.SHOULDER + 1.2), 3.6, 1.8, tex, 1.8, { legs: [-1.3, 1.3] });
    });
    // "next town" guide signs 1 km before boundaries
    RT.REGIONS.forEach(function (r) {
      const s = r.start - 1000;
      if (r.start <= 0 || !inChunk(s)) return;
      const tex = signTex('guide-' + r.id, 512, 256, function (g, w, h) {
        g.fillStyle = '#1a7a4a'; roundRect(g, 4, 4, w - 8, h - 8, 18); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 6; roundRect(g, 12, 12, w - 24, h - 24, 12); g.stroke();
        g.fillStyle = '#fff'; g.textBaseline = 'middle';
        g.textAlign = 'left'; fitText(g, r.name, 260, 96, 800); g.fillText(r.name, 50, h * 0.42);
        g.font = '700 30px ' + JP_FONT; g.fillText(r.en, 52, h * 0.78);
        g.textAlign = 'right'; g.font = '800 92px ' + JP_FONT; g.fillText('1', w - 130, h * 0.45);
        g.font = '700 46px ' + JP_FONT; g.fillText('km', w - 50, h * 0.5);
        // route 13 shield
        g.fillStyle = '#1f5fa8'; g.beginPath(); g.moveTo(w - 160, h - 70); g.lineTo(w - 40, h - 70); g.lineTo(w - 70, h - 20); g.lineTo(w - 130, h - 20); g.closePath(); g.fill();
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '800 34px sans-serif'; g.fillText('13', w - 100, h - 45);
      });
      addSign(group, s, -(RT.halfWidth(s) + RT.SHOULDER + 1.0), 3.6, 1.8, tex, 2.4, { legs: [-1.4, 1.4] });
    });
    // Route 13 shields every 1.6 km
    for (let sq = Math.ceil((s0 - 700) / 1600) * 1600 + 300; sq < s1 + 700; sq += 1600) {
      let s = signOutsideTunnel(sq, null);
      if (s !== sq) s += 60;                         // 移した先でほかの案内標識と重ならないようにずらす
      if (!inChunk(s)) continue;
      const tex = signTex('r13', 256, 256, function (g, w, h) {
        g.fillStyle = '#1f5fa8';
        g.beginPath(); g.moveTo(20, 30); g.lineTo(w - 20, 30); g.lineTo(w - 50, h - 30); g.quadraticCurveTo(w / 2, h, 50, h - 30); g.closePath(); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 8; g.stroke();
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = '800 120px sans-serif'; g.fillText('13', w / 2, h * 0.5);
        g.font = '700 26px ' + JP_FONT; g.fillText('国道', w / 2, 62);
      });
      addSign(group, s, -(RT.halfWidth(s) + RT.SHOULDER + 0.9), 1.1, 1.1, tex, 2.2);
    }
    // speed camera warnings (600 m and 300 m before) and the unit
    RT.CAMERAS.forEach(function (c) {
      [600, 300].forEach(function (d) {
        const s = c.s - d; if (!inChunk(s)) return;
        const tex = signTex('cam', 512, 256, function (g, w, h) {
          g.fillStyle = '#1f5fa8'; roundRect(g, 4, 4, w - 8, h - 8, 14); g.fill();
          g.strokeStyle = '#fff'; g.lineWidth = 6; roundRect(g, 12, 12, w - 24, h - 24, 10); g.stroke();
          g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
          fitText(g, '自動速度取締', w - 70, 80, 800); g.fillText('自動速度取締', w / 2, h * 0.38);
          fitText(g, '実施中', w - 70, 76, 800); g.fillText('実施中', w / 2, h * 0.72);
        });
        addSign(group, s, -(RT.halfWidth(s) + RT.SHOULDER + 1.0), 2.6, 1.3, tex, 2.4, { legs: [-1, 1] });
      });
      if (inChunk(c.s)) {
        const p = RT.pointAt(c.s, -(RT.halfWidth(c.s) + RT.SHOULDER + 0.6));
        const g = new THREE.Group(); g.position.set(p.x, p.y, p.z); g.rotation.y = -p.h;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 6.5, 8), new THREE.MeshStandardMaterial({ color: 0x9aa2a6, metalness: 0.5 }));
        pole.userData.ownMat = true; pole.position.y = 3.25; g.add(pole);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.2, 0.2), pole.material); arm.position.set(2.6, 6.4, 0); g.add(arm);
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.7), new THREE.MeshStandardMaterial({ color: 0xe8e8e2 }));
        box.userData.ownMat = true; box.position.set(4.6, 6.0, 0); g.add(box);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.18, 12), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.9 }));
        lens.userData.ownMat = true; lens.position.set(4.6, 6.0, 0.36); g.add(lens);
        group.add(g);
      }
    });
    // lane reduction warning signs 500 m before
    RT.SWITCHES.forEach(function (w) {
      if (w.to >= w.from) return;
      const s = w.s - 500; if (!inChunk(s)) return;
      const tex = signTex('lanes-' + w.from + '-' + w.to, 256, 320, function (g, W2, H) {
        g.save(); g.translate(W2 / 2, 128); g.rotate(Math.PI / 4);
        g.fillStyle = '#f5c518'; g.fillRect(-82, -82, 164, 164); g.strokeStyle = '#111'; g.lineWidth = 8; g.strokeRect(-74, -74, 148, 148);
        g.restore();
        g.fillStyle = '#111';
        // two lanes merging into one
        g.fillRect(W2 / 2 + 6, 70, 12, 120);
        g.beginPath(); g.moveTo(W2 / 2 - 40, 190); g.lineTo(W2 / 2 - 28, 190); g.lineTo(W2 / 2 - 6, 120); g.lineTo(W2 / 2 - 6, 70); g.lineTo(W2 / 2 - 18, 70); g.lineTo(W2 / 2 - 18, 118); g.closePath(); g.fill();
        g.fillStyle = '#ffffff'; g.fillRect(16, 262, W2 - 32, 50); g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(16, 262, W2 - 32, 50);
        g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, '車線減少 500m', W2 - 50, 34, 800); g.fillText('車線減少 500m', W2 / 2, 288);
      });
      addSign(group, s, -(RT.halfWidth(s) + RT.SHOULDER + 0.9), 1.3, 1.62, tex, 1.8);
    });
    // no-passing regulation signs at yellow zone starts
    RT.YELLOW_ZONES.forEach(function (z) {
      const s = z[0] - 20; if (!inChunk(s)) return;
      const tex = signTex('nopass', 256, 320, function (g, W2) {
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(W2 / 2, 128, 112, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#d32020'; g.lineWidth = 24; g.beginPath(); g.arc(W2 / 2, 128, 100, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#1f5fa8'; g.beginPath(); g.arc(W2 / 2, 128, 86, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff'; g.fillRect(W2 / 2 - 6, 60, 12, 110);
        g.beginPath(); g.moveTo(W2 / 2 + 20, 70); g.lineTo(W2 / 2 + 50, 120); g.lineTo(W2 / 2 + 30, 120); g.lineTo(W2 / 2 + 30, 180); g.lineTo(W2 / 2 + 10, 180); g.lineTo(W2 / 2 + 10, 120); g.lineTo(W2 / 2 - 10, 120); g.closePath(); g.fill();
        g.strokeStyle = '#d32020'; g.lineWidth = 12; g.beginPath(); g.moveTo(W2 / 2 - 60, 190); g.lineTo(W2 / 2 + 60, 66); g.stroke();
        g.fillStyle = '#ffffff'; g.fillRect(16, 262, W2 - 32, 50); g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(16, 262, W2 - 32, 50);
        g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, 'はみ出し禁止', W2 - 50, 34, 800); g.fillText('はみ出し禁止', W2 / 2, 288);
      });
      addSign(group, s, -(RT.halfWidth(s) + RT.SHOULDER + 0.9), 1.0, 1.25, tex, 2.0);
    });
    // service advance signs (1000 m / 300 m)
    RT.STATIONS.forEach(function (st) {
      [800, 300].forEach(function (d0) {
        const s = signOutsideTunnel(st.s - d0, st.s); if (!inChunk(s)) return;
        const d = Math.round((st.s - s) / 10) * 10;          // 移した場合は実際の残り距離を表示
        const isEki = st.type === 'eki';
        const tex = signTex('svc-' + st.id + '-' + d, 512, 256, function (g, w, h) {
          g.fillStyle = isEki ? '#1f5fa8' : '#1a7a4a'; roundRect(g, 4, 4, w - 8, h - 8, 16); g.fill();
          g.strokeStyle = '#fff'; g.lineWidth = 6; roundRect(g, 12, 12, w - 24, h - 24, 10); g.stroke();
          g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
          if (isEki) { fitText(g, '道の駅', w - 60, 44, 700); g.fillText('道の駅', w / 2, 52); fitText(g, st.short, w - 60, 72, 800); g.fillText(st.short, w / 2, 120); }
          else { fitText(g, '⛽ ' + st.name, w - 60, 62, 800); g.fillText('⛽ ' + st.name, w / 2, 90); }
          fitText(g, '左側 ' + d + 'm 先', w - 60, 46, 700); g.fillText('左側 ' + d + 'm 先', w / 2, 196);
        });
        addSign(group, s, -(RT.halfWidth(s) + RT.SHOULDER + 1.0), 3.2, 1.6, tex, 2.4, { legs: [-1.2, 1.2] });
      });
    });
    // 方面と距離の案内標識（各市町村に入った先。上から遠い順に 3 か所）
    RT.REGIONS.forEach(function (r, i) {
      const s = distSignSpot(r);
      if (s == null || !inChunk(s)) return;
      const rows = distSignRows(i, s);
      if (!rows.length) return;
      const tex = signTex('dist-' + r.id, 512, 96 * rows.length + 28, function (g, w, h) {
        g.fillStyle = '#1f5fa8'; roundRect(g, 4, 4, w - 8, h - 8, 16); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 6; roundRect(g, 12, 12, w - 24, h - 24, 10); g.stroke();
        g.fillStyle = '#fff'; g.textBaseline = 'middle';
        rows.forEach(function (row, j) {
          const y = 14 + 96 * j + 48;
          g.textAlign = 'left'; fitText(g, row.name, 190, 62, 800); g.fillText(row.name, 40, y - 8);
          g.font = '700 20px ' + JP_FONT; g.fillText(row.en, 42, y + 32);
          g.textAlign = 'right'; g.font = '800 66px ' + JP_FONT; g.fillText(String(row.km), w - 112, y);
          g.font = '700 34px ' + JP_FONT; g.fillText('km', w - 40, y + 10);
          if (j) { g.fillRect(34, 14 + 96 * j, w - 68, 3); }
        });
      });
      const hh = 3.4 * (96 * rows.length + 28) / 512;
      addSign(group, s, -(RT.halfWidth(s) + RT.SHOULDER + 1.1), 3.4, hh, tex, 2.5, { legs: [-1.3, 1.3] });
    });
    // 名所カードの案内板
    if (R13.sights) {
      const spots = boardSpots();
      R13.sights.CARDS.forEach(function (c) { const bs = spots[c.id]; if (bs != null && inChunk(bs)) addSightBoard(group, bs, c); });
    }
    // 川の名前の標識（橋の手前）
    RT.RIVERS.forEach(function (rv) {
      const s = rv.s - rv.half - 26; if (!inChunk(s)) return;
      const tex = signTex('river-' + rv.name, 512, 200, function (g, w, h) {
        g.fillStyle = '#1f5fa8'; roundRect(g, 4, 4, w - 8, h - 8, 14); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 6; roundRect(g, 12, 12, w - 24, h - 24, 10); g.stroke();
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        fitText(g, rv.name, w - 70, 84, 800); g.fillText(rv.name, w / 2, h * 0.42);
        fitText(g, rv.en, w - 70, 34, 700); g.fillText(rv.en, w / 2, h * 0.8);
      });
      addSign(group, s, -(RT.halfWidth(s) + RT.SHOULDER + 1.0), 2.8, 1.1, tex, 2.2, { legs: [-1.1, 1.1] });
    });
    // landmarks（沿線の目印。左＝西、右＝東）
    const LM = [
      { s: 9150, lat: -310, kind: 'mount', r: 140, h: 46, col: 'sakura' },     // 烏帽子山公園（桜の名所）
      { s: 10000, lat: -150, kind: 'para' },                                   // 十分一山のパラグライダー
      { s: 14700, lat: 85, kind: 'castle' },                                   // 上山城
      { s: 16500, lat: 190, kind: 'skytower' },                                // 金瓶の高層マンション
      { s: 19300, lat: -78, kind: 'hospital' },                                // 飯田の大学病院
      { s: 20150, lat: 360, kind: 'mount', r: 200, h: 120, col: 'pine' },      // 千歳山
      { s: 20350, lat: 78, kind: 'kencho' },                                   // 山形県庁
      { s: 20250, lat: -300, kind: 'tower' },                                  // 駅前の高層ビル
      { s: 20916, lat: -23, kind: 'nabe' },
      { s: 20779, lat: -40, kind: 'imoni' }, { s: 20926, lat: -52, kind: 'imoni' },   // 秋の芋煮会（河川敷）
      { s: 28300, lat: -420, kind: 'plane' },                                  // 山形空港を離陸する飛行機                                    // 芋煮会の大鍋
      { s: 24600, lat: 280, kind: 'mount', r: 170, h: 52, col: 'sakura' },     // 舞鶴山
      { s: 24300, lat: -60, kind: 'koma' },
      { s: 32800, lat: 560, kind: 'mount', r: 360, h: 210, col: 'wood' },      // 甑岳
      { s: 33330, lat: 0, kind: 'overbridge' },                                // 道の駅むらやまの連絡橋
      { s: 33450, lat: -36, kind: 'sobahouse' },
      { s: 36480, lat: -34, kind: 'sobahouse' },                               // 大石田のそば屋
      { s: 37110, lat: 18, kind: 'hanagasa' },                                 // 花笠のモニュメント（花笠踊り発祥の地）
      { s: 37950, lat: -42, kind: 'suika' },
      { s: 43330, lat: 13, kind: 'megami' },                                   // 土偶「縄文の女神」のモニュメント
      { s: 50250, lat: -330, kind: 'mount', r: 95, h: 80, col: 'pine' },       // 金山三峰
      { s: 50480, lat: -410, kind: 'mount', r: 112, h: 96, col: 'pine' },
      { s: 50720, lat: -345, kind: 'mount', r: 90, h: 72, col: 'pine' },
      { s: 41075, lat: 0, kind: 'jizo' }                                       // 猿羽根山地蔵尊
    ];
    const self = this;
    LM.forEach(function (l) { if (inChunk(l.s)) self._landmark(group, l); });
  };

  Renderer.prototype._landmark = function (group, l) {
    const p = RT.pointAt(l.s, l.lat);
    const g = new THREE.Group(); g.position.set(p.x, p.y - 0.1, p.z); g.rotation.y = -p.h;
    const own = function (m) { m.userData.ownMat = true; return m; };
    const season = this.season, winter = season === 'winter';
    if (l.kind === 'castle') {
      // 天守風の建物（ゲーム用の造形）
      const wallM = own(new THREE.MeshLambertMaterial({ color: 0xf2efe6 })), roofM = own(new THREE.MeshLambertMaterial({ color: winter ? 0xe9edf1 : 0x3b4650 }));
      const base = new THREE.Mesh(new THREE.BoxGeometry(26, 6, 22), own(new THREE.MeshLambertMaterial({ color: 0x8b8578 }))); base.position.y = 3; g.add(base);
      [[16, 5, 14], [12, 4.5, 10], [8, 4, 7]].forEach(function (d, i) {
        const y = 6 + i * 6.2;
        const w = new THREE.Mesh(new THREE.BoxGeometry(d[0], d[1], d[2]), wallM); w.position.y = y + d[1] / 2; g.add(w);
        const r = new THREE.Mesh(new THREE.ConeGeometry(d[0] * 0.82, 2.6, 4), roofM); r.rotation.y = Math.PI / 4; r.scale.z = d[2] / d[0]; r.position.y = y + d[1] + 1.1; g.add(r);
      });
    } else if (l.kind === 'koma') {
      // 大きな将棋駒のモニュメント
      const shape = new THREE.Shape();
      shape.moveTo(-3, 0); shape.lineTo(3, 0); shape.lineTo(2.3, 6.2); shape.lineTo(0, 7.6); shape.lineTo(-2.3, 6.2); shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 1 });
      const tex = signTex('koma', 256, 320, function (gg, w, h) {
        gg.fillStyle = '#e8c27a'; gg.fillRect(0, 0, w, h);
        gg.fillStyle = '#1a1a1a'; gg.textAlign = 'center'; gg.textBaseline = 'middle';
        gg.font = '900 110px ' + JP_FONT; gg.fillText('王', w / 2, h * 0.36); gg.fillText('将', w / 2, h * 0.72);
      });
      const front = own(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 })), side = own(new THREE.MeshStandardMaterial({ color: 0xd8b06a, roughness: 0.5 }));
      geo.computeBoundingBox();
      const uv = geo.attributes.uv, pos = geo.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + 3) / 6, pos.getY(i) / 7.6);
      const m = new THREE.Mesh(geo, [front, side]); m.position.set(0, 1.4, 0); m.rotation.y = Math.PI / 2 - 0.6; m.castShadow = true;
      g.add(m);
      const ped = new THREE.Mesh(new THREE.BoxGeometry(8, 1.4, 4), own(new THREE.MeshLambertMaterial({ color: 0x8e8a82 }))); ped.position.y = 0.7; g.add(ped);
    } else if (l.kind === 'suika') {
      const tex = canvasTex('suika', 256, 128, function (gg, w, h) {
        gg.fillStyle = '#2f7a2c'; gg.fillRect(0, 0, w, h);
        gg.fillStyle = '#123d14'; for (let x = 0; x < w; x += 32) { gg.beginPath(); for (let y = 0; y <= h; y += 8) gg.lineTo(x + 8 * Math.sin(y / 9), y); gg.lineTo(x + 12, h); gg.lineTo(x + 12, 0); gg.fill(); }
      }, true);
      const m = new THREE.Mesh(new THREE.SphereGeometry(3.2, 24, 16), own(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 })));
      m.scale.y = 0.88; m.position.y = 2.8; m.castShadow = true; g.add(m);
    } else if (l.kind === 'tower') {
      // 駅前の高層ビル（遠景）
      const m = new THREE.Mesh(new THREE.BoxGeometry(24, 108, 24), this.mats.bldg); m.position.y = 54; g.add(m);
      const top = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 14), own(new THREE.MeshLambertMaterial({ color: 0xb9c3cc }))); top.position.y = 112; g.add(top);
    } else if (l.kind === 'skytower') {
      // 田園の中に1棟だけ建つ高層マンション
      const body = own(new THREE.MeshLambertMaterial({ color: 0xe9e4d8, map: windowTex() }));
      const m = new THREE.Mesh(new THREE.BoxGeometry(20, 128, 20), body); m.position.y = 64; g.add(m);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 12), own(new THREE.MeshLambertMaterial({ color: 0xcfc8b8 }))); cap.position.y = 131.5; g.add(cap);
      const pod = new THREE.Mesh(new THREE.BoxGeometry(34, 6, 30), own(new THREE.MeshLambertMaterial({ color: 0xd8d2c4 }))); pod.position.y = 3; g.add(pod);
    } else if (l.kind === 'kencho') {
      // 県庁舎：横に長い高層の庁舎と低層棟
      const body = own(new THREE.MeshLambertMaterial({ color: 0xe6e2d8, map: windowTex() }));
      const m = new THREE.Mesh(new THREE.BoxGeometry(20, 62, 52), body); m.position.set(14, 31, 0); g.add(m);
      const low = new THREE.Mesh(new THREE.BoxGeometry(30, 14, 70), body); low.position.set(4, 7, 0); g.add(low);
      const top = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 20), own(new THREE.MeshLambertMaterial({ color: 0xbfc5c8 }))); top.position.set(14, 65, 0); g.add(top);
    } else if (l.kind === 'hospital') {
      const body = own(new THREE.MeshLambertMaterial({ color: 0xf0ebe0, map: windowTex() }));
      const m = new THREE.Mesh(new THREE.BoxGeometry(26, 34, 64), body); m.position.set(-12, 17, 0); g.add(m);
      const w2 = new THREE.Mesh(new THREE.BoxGeometry(40, 18, 30), body); w2.position.set(-18, 9, 46); g.add(w2);
      const top = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 12), own(new THREE.MeshLambertMaterial({ color: 0xc8ccd0 }))); top.position.set(-12, 36.5, 0); g.add(top);
    } else if (l.kind === 'mount') {
      // 沿線の山（千歳山・舞鶴山・甑岳）
      const pal = {
        pine:   { spring: 0x3f6a3c, summer: 0x2f5a30, autumn: 0x456a38, winter: 0xc9d6d4 },
        sakura: { spring: 0xf0bfd0, summer: 0x4a8a3a, autumn: 0xb8843a, winter: 0xe6ecef },
        wood:   { spring: 0x7fa85a, summer: 0x3f7a34, autumn: 0x7d8a48, winter: 0xe9eef2 }
      }[l.col || 'wood'];
      const geo = new THREE.ConeGeometry(l.r, l.h, 14, 3);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {                      // なだらかな稜線にする
        const y = pos.getY(i), f = 1 + 0.16 * Math.sin(i * 12.9898) * (y < l.h / 2 - 1 ? 1 : 0);
        pos.setX(i, pos.getX(i) * f); pos.setZ(i, pos.getZ(i) * f);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, own(new THREE.MeshLambertMaterial({ color: pal[season] || pal.autumn, flatShading: true })));
      m.position.y = l.h / 2 - 6; g.add(m);
    } else if (l.kind === 'nabe') {
      // 馬見ヶ崎川の河川敷にある、日本一の芋煮会の大鍋
      const iron = own(new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.55, metalness: 0.6 }));
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 2.7, 1.7, 20, 1, true), iron); pot.material.side = THREE.DoubleSide; pot.position.y = 2.35; g.add(pot);
      const bottom = new THREE.Mesh(new THREE.CircleGeometry(2.7, 20), iron); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 1.52; g.add(bottom);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.12, 6, 24), iron); rim.rotation.x = Math.PI / 2; rim.position.y = 3.2; g.add(rim);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.4, 1.5, 12), own(new THREE.MeshLambertMaterial({ color: 0x8e8a82 }))); base.position.y = 0.75; g.add(base);
    } else if (l.kind === 'overbridge') {
      // 国道13号をまたぐ連絡橋（道の駅むらやま）
      const hw = RT.halfWidth(l.s) + RT.SHOULDER;
      const conc = own(new THREE.MeshLambertMaterial({ color: 0xd9d6cc })), glass = own(new THREE.MeshLambertMaterial({ color: 0x9fb8c6 }));
      const x0 = -(hw + 17), x1 = hw + 9, len = x1 - x0, cx = (x0 + x1) / 2;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.6, 4.2), conc); deck.position.set(cx, 6.3, 0); deck.castShadow = true; g.add(deck);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(len, 2.3, 4.0), glass); wall.position.set(cx, 7.75, 0); g.add(wall);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 1, 0.35, 4.8), own(new THREE.MeshLambertMaterial({ color: winter ? 0xeef2f5 : 0x8b3a30 }))); roof.position.set(cx, 9.1, 0); g.add(roof);
      [x0 - 2.5, x1 + 2.5].forEach(function (x) {
        const tw = new THREE.Mesh(new THREE.BoxGeometry(5.5, 10.5, 6.5), conc); tw.position.set(x, 5.25, 0); tw.castShadow = true; g.add(tw);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(5.2, 2.6, 4), roof.material); cap.rotation.y = Math.PI / 4; cap.position.set(x, 11.8, 0); g.add(cap);
      });
    } else if (l.kind === 'jizo') {
      // 猿羽根峠の地蔵堂（トンネルの上の山に建つ）
      const gy = 15.2;
      const hall = new THREE.Mesh(new THREE.BoxGeometry(6.5, 3.6, 5.5), own(new THREE.MeshLambertMaterial({ color: 0x7a4a34 }))); hall.position.set(23, gy + 1.8, 0); g.add(hall);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(6.2, 3.0, 4), own(new THREE.MeshLambertMaterial({ color: winter ? 0xeef2f5 : 0x8a2f2a }))); roof.rotation.y = Math.PI / 4; roof.position.set(23, gy + 5.1, 0); g.add(roof);
    } else if (l.kind === 'para') {
      // パラグライダー（ゆっくり漂う）
      const gl = [];
      [[-10, 40, -110, 0xd8322b], [22, 50, -20, 0xf2c230], [-46, 60, 70, 0x2f7fd0]].forEach(function (q, i) {
        const pg = new THREE.Group();
        const wing = new THREE.Mesh(new THREE.SphereGeometry(4.6, 10, 4, 0, Math.PI * 2, 0, Math.PI / 3), own(new THREE.MeshLambertMaterial({ color: q[3], side: THREE.DoubleSide })));
        wing.scale.set(1, 0.5, 0.42); wing.position.y = -1.6; pg.add(wing);
        const pilot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.5), own(new THREE.MeshLambertMaterial({ color: 0x30343a }))); pilot.position.y = -5.2; pg.add(pilot);
        pg.position.set(q[0], q[1], q[2]); pg.userData.base = q; pg.userData.i = i;
        g.add(pg); gl.push(pg);
      });
      g.userData.anim = function (time) {
        gl.forEach(function (pg) { const q = pg.userData.base, i = pg.userData.i;
          pg.position.set(q[0] + Math.cos(time * 0.22 + i * 2.1) * 9, q[1] + Math.sin(time * 0.35 + i * 1.3) * 3.5, q[2] + Math.sin(time * 0.17 + i) * 12);
          pg.rotation.y = Math.sin(time * 0.2 + i) * 0.6; });
      };
    } else if (l.kind === 'plane') {
      // 旅客機（山形空港は国道13号の西側。滑走路は国道とほぼ並行）
      const white = own(new THREE.MeshLambertMaterial({ color: 0xf4f6f8 })), blue = own(new THREE.MeshLambertMaterial({ color: 0x1f5fa8 }));
      const pl = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 30, 10), white); body.rotation.x = Math.PI / 2; pl.add(body);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(1.9, 4.5, 10), white); nose.rotation.x = -Math.PI / 2; nose.position.z = -17.2; pl.add(nose);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(30, 0.5, 5), white); wing.position.set(0, -0.6, 0); pl.add(wing);
      const tailW = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 3), white); tailW.position.set(0, 0.4, 13.5); pl.add(tailW);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.5, 4.5), blue); fin.position.set(0, 3.2, 13.2); pl.add(fin);
      g.add(pl);
      g.userData.anim = function (time) {
        const u = (time * 0.028) % 1;                         // 約36秒で1回
        const z = 700 - u * 1700;
        pl.position.set(0, 26 + (700 - z) * 0.16, z);
        pl.rotation.x = 0.16;
      };
      g.userData.anim(0);
    } else if (l.kind === 'imoni') {
      // 秋の芋煮会：河川敷のブルーシート、テント、鍋（秋だけ）
      if (season === 'autumn') {
        const tarp = own(new THREE.MeshLambertMaterial({ color: 0x2f6fc0 })), tent = own(new THREE.MeshLambertMaterial({ color: 0xf4f4f0 })), pot = own(new THREE.MeshLambertMaterial({ color: 0x2c2f33 }));
        const smoke = own(new THREE.MeshLambertMaterial({ color: 0xe6e8ea, transparent: true, opacity: 0.55 }));
        const puffs = [];
        [[0, 0], [-9, 5], [-17, -3], [-26, 4]].forEach(function (q, i) {
          const sheet = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.06, 3.4), tarp); sheet.position.set(q[0], 0.08, q[1]); g.add(sheet);
          const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.5, 10), pot); p2.position.set(q[0] + 2.9, 0.45, q[1]); g.add(p2);
          const pf = new THREE.Mesh(new THREE.SphereGeometry(0.55, 6, 5), smoke); pf.position.set(q[0] + 2.9, 1.4, q[1]); pf.userData.i = i; g.add(pf); puffs.push(pf);
          if (i % 2 === 0) {
            const tb = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 3.2), tent); tb.position.set(q[0] - 4.2, 2.3, q[1]); g.add(tb);
            const tc = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.1, 4), tent); tc.rotation.y = Math.PI / 4; tc.position.set(q[0] - 4.2, 2.9, q[1]); g.add(tc);
            [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].forEach(function (c) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, 0.08), tent); leg.position.set(q[0] - 4.2 + c[0], 1.15, q[1] + c[1]); g.add(leg); });
          }
        });
        g.userData.anim = function (time) { puffs.forEach(function (pf) { const u = (time * 0.35 + pf.userData.i * 0.37) % 1; pf.position.y = 1.2 + u * 3.2; pf.scale.setScalar(0.7 + u * 1.3); }); };
      }
    } else if (l.kind === 'hanagasa') {
      // 花笠のモニュメント（ゲーム用の造形）
      const straw = own(new THREE.MeshLambertMaterial({ color: winter ? 0xf0f2f4 : 0xe6cf86, side: THREE.DoubleSide })), red = own(new THREE.MeshLambertMaterial({ color: 0xd8322b }));
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 5, 8), this.mats.metal); pole.position.y = 2.5; g.add(pole);
      const hat = new THREE.Group();
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.7, 0.95, 20, 1, true), straw); hat.add(cone);
      for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), red); const a = i / 6 * Math.PI * 2; f.position.set(Math.cos(a) * 1.75, -0.02, Math.sin(a) * 1.75); hat.add(f); }
      hat.position.y = 5.4; hat.rotation.set(0.5, 0, -0.25); g.add(hat);
      const ped = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 2.4), own(new THREE.MeshLambertMaterial({ color: 0x8e8a82 }))); ped.position.y = 0.4; g.add(ped);
    } else if (l.kind === 'megami') {
      // 国宝の土偶「縄文の女神」をかたどったモニュメント（ゲーム用の造形）
      const clay = own(new THREE.MeshLambertMaterial({ color: 0xb37a52 }));
      const ped = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 3), own(new THREE.MeshLambertMaterial({ color: 0x8e8a82 }))); ped.position.y = 0.6; g.add(ped);
      const fig = new THREE.Group();
      const legs = new THREE.Mesh(taperedBox(1.5, 2.9, 1.1, 0.72, 0.8, 0), clay); legs.position.y = 1.45; fig.add(legs);
      const hip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.75, 1.9), clay); hip.position.set(0, 3.2, 0.42); fig.add(hip);
      const torso = new THREE.Mesh(taperedBox(1.2, 1.7, 0.45, 1.5, 1, 0), clay); torso.position.set(0, 4.4, 0); fig.add(torso);
      const sh = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.4, 0.5), clay); sh.position.set(0, 5.4, 0); fig.add(sh);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.34, 14, 1, false, 0, Math.PI), clay); head.rotation.set(Math.PI / 2, 0, Math.PI / 2); head.position.set(0, 5.6, 0); fig.add(head);
      fig.position.y = 1.2; fig.rotation.y = -Math.PI / 2 + 0.5; fig.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
      g.add(fig);
    } else if (l.kind === 'sobahouse') {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 8), own(new THREE.MeshLambertMaterial({ color: 0x6b4a32 }))); wall.position.y = 2; g.add(wall);
      const roof = new THREE.Mesh(roofGeom(8, 12, 4.5), own(new THREE.MeshLambertMaterial({ color: winter ? 0xeef2f5 : 0xc9b27a })));
      roof.rotation.y = Math.PI / 2; roof.position.y = 4; g.add(roof);
    }
    if (l.kind === 'hanagasa' || l.kind === 'megami') g.scale.setScalar(1.5);
    if (g.userData.anim) { this.anims.add(g); }
    group.add(g);
  };

  Renderer.prototype._signalObject = function (group, sg) {
    const M = this.mats;
    const parts = [];
    const mk = function (s, side) {
      // side -1: ours (left pole, arm over our lanes, faces us); +1 oncoming
      const hw = RT.halfWidth(sg.s);
      const lat = side * (hw + RT.SHOULDER + 0.5);
      const p = RT.pointAt(s, lat);
      const g = new THREE.Group(); g.position.set(p.x, p.y, p.z); g.rotation.y = -p.h + (side > 0 ? Math.PI : 0);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 6.2, 8), M.metal); pole.position.y = 3.1; g.add(pole);
      const armLen = hw + 1.2;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, armLen, 6), M.metal);
      arm.rotation.z = Math.PI / 2; arm.position.set(armLen / 2, 5.9, 0); g.add(arm);
      const head = new THREE.Group(); head.position.set(Math.min(armLen - 0.4, hw * 0.75 + 0.6), 5.6, 0); g.add(head);
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.5, 0.3), M.dark); head.add(box);
      const visorG = new THREE.CircleGeometry(0.17, 14);
      const lamps = [];
      [-0.45, 0, 0.45].forEach(function (x) {
        const l = new THREE.Mesh(visorG, M.lampOff); l.position.set(x, 0, 0.16); head.add(l); lamps.push(l);
      });
      // rotation so +x arm extends over road (to the right of a pole on the left side)
      group.add(g);
      parts.push(lamps);
    };
    mk(sg.s + 22.5, -1);
    mk(sg.s + 0.5, 1);
    const self = this;
    this._signals = this._signals || [];
    this._signals.push({ sg: sg, lamps: parts, group: group });
  };

  Renderer.prototype._stationObject = function (group, st) {
    const hw = RT.halfWidth(st.s);
    const own = function (m) { m.userData.ownMat = true; return m; };
    const p = RT.pointAt(st.s, -(hw + 22));
    const g = new THREE.Group(); g.position.set(p.x, p.y - 0.1, p.z); g.rotation.y = -p.h;
    // lot
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(26, 120), this.mats.bay); lot.rotation.x = -Math.PI / 2; lot.position.set(4, 0.06, 0); lot.receiveShadow = true; g.add(lot);
    if (st.type === 'eki') {
      const wallM = own(new THREE.MeshLambertMaterial({ color: 0xf1ebdc })), woodM = own(new THREE.MeshLambertMaterial({ color: 0x8a5a36 }));
      const b = new THREE.Mesh(new THREE.BoxGeometry(14, 5, 34), wallM); b.position.set(-4, 2.5, 0); b.castShadow = true; g.add(b);
      const roof = new THREE.Mesh(roofGeom(14, 34, 3.6), own(new THREE.MeshLambertMaterial({ color: 0x4a5560 }))); roof.position.set(-4, 5, 0); g.add(roof);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 34), woodM); beam.position.set(3.2, 4.2, 0); g.add(beam);
      // tall sign pylon
      const item = RT.ITEMS[st.item];
      const tex = signTex('eki-' + st.id, 256, 640, function (gg, w, h) {
        gg.fillStyle = '#1f5fa8'; gg.fillRect(0, 0, w, h);
        gg.fillStyle = '#ffffff'; gg.fillRect(10, 10, w - 20, 120);
        gg.fillStyle = '#1f5fa8'; gg.textAlign = 'center'; gg.textBaseline = 'middle';
        fitText(gg, '道の駅', w - 40, 76, 900); gg.fillText('道の駅', w / 2, 72);
        gg.fillStyle = '#fff';
        const name = st.short;
        const chars = name.length > 6 ? [name.slice(0, Math.ceil(name.length / 2)), name.slice(Math.ceil(name.length / 2))] : [name];
        chars.forEach(function (c, i) { fitText(gg, c, w - 40, 64, 800); gg.fillText(c, w / 2, 200 + i * 74); });
        gg.font = '120px ' + JP_FONT; gg.fillText(item.icon, w / 2, 430);
        fitText(gg, item.name, w - 40, 48, 800); gg.fillText(item.name, w / 2, 560);
      });
      const pyl = new THREE.Mesh(new THREE.BoxGeometry(2.6, 6.5, 0.5), own(new THREE.MeshStandardMaterial({ color: 0x1f5fa8 })));
      pyl.position.set(10.5, 3.25 + 1.2, -62); g.add(pyl);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 6.5), own(new THREE.MeshStandardMaterial({ map: tex })));
      face.position.set(10.5, 3.25 + 1.2, -61.74); face.rotation.y = 0; g.add(face);
      const face2 = face.clone(); face2.position.z = -62.26; face2.rotation.y = Math.PI; g.add(face2);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.4), this.mats.metal); leg.position.set(10.5, 0.6, -62); g.add(leg);
      // parked cars for life
      for (let i = 0; i < 4; i++) {
        const c = buildCar({ len: 4.4, wid: 1.75, hgt: 1.5, kind: i % 2 ? 'kei' : 'sedan' }, ['#ffffff', '#30343a', '#8a9096', '#7b2a2a'][i], this.mats, { merge: true });
        c.position.set(6, 0.05, -12 + i * 7); c.rotation.y = Math.PI / 2;
        g.add(c);
      }
      // banners (nobori)
      for (let i = 0; i < 5; i++) {
        const nb = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 2.2), own(new THREE.MeshLambertMaterial({ color: [0xd8322b, 0xf2c230, 0x2f7a3a][i % 3], side: THREE.DoubleSide })));
        nb.position.set(11.5, 2.2, -30 + i * 14); nb.rotation.y = Math.PI / 2; g.add(nb);
        const np = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.4, 4), this.mats.metal); np.position.set(11.5, 1.7, -30 + i * 14 - 0.32); g.add(np);
      }
    } else {
      // fuel station canopy
      const canopyM = own(new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.5 }));
      const can = new THREE.Mesh(new THREE.BoxGeometry(14, 1.0, 26), canopyM); can.position.set(4, 5.6, 0); can.castShadow = true; g.add(can);
      const band = new THREE.Mesh(new THREE.BoxGeometry(14.1, 0.45, 26.1), own(new THREE.MeshStandardMaterial({ color: 0x1a7a4a, emissive: 0x0d4a2a, emissiveIntensity: 0.3 }))); band.position.set(4, 5.3, 0); g.add(band);
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (q) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.2, 0.5), canopyM); c.position.set(4 + q[0] * 4, 2.6, q[1] * 9); g.add(c);
      });
      for (let i = 0; i < 3; i++) {
        const pump = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 1.4), own(new THREE.MeshStandardMaterial({ color: 0x1a7a4a }))); pump.position.set(4, 0.9, -8 + i * 8); g.add(pump);
      }
      const shop = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 14), own(new THREE.MeshLambertMaterial({ color: 0xe9e6dd }))); shop.position.set(-8, 2, 0); g.add(shop);
      const tex = signTex('fuel-' + st.id, 256, 512, function (gg, w, h) {
        gg.fillStyle = '#1a7a4a'; gg.fillRect(0, 0, w, h);
        gg.fillStyle = '#fff'; gg.textAlign = 'center'; gg.textBaseline = 'middle';
        gg.font = '140px ' + JP_FONT; gg.fillText('⛽', w / 2, 130);
        fitText(gg, 'FUEL', w - 30, 70, 900); gg.fillText('FUEL', w / 2, 260);
        fitText(gg, st.short, w - 30, 70, 800); gg.fillText(st.short, w / 2, 360);
        fitText(gg, 'フューエル', w - 30, 46, 800); gg.fillText('フューエル', w / 2, 440);
      });
      const pyl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4.4), own(new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide })));
      pyl.position.set(10.5, 4.4, -40); g.add(pyl);
      const pp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 0.4), this.mats.metal); pp.position.set(10.5, 1.1, -40); g.add(pp);
    }
    group.add(g);
  };

  // ------------------------------------------------------------ per-frame update
  Renderer.prototype.render = function (sim, dt, opts) {
    opts = opts || {};
    this.time += dt;
    const st = sim.st, P = RT.pointAt;
    const T = this._tmp;
    this._updateChunks(st.s);

    // signals lamp states (shared materials would sync all, so swap per-lamp material)
    if (this._signals) {
      const self = this;
      this._signals = this._signals.filter(function (o) { return o.group.parent; });
      this._signals.forEach(function (o) {
        const state = RT.signalState(o.sg, st.time);
        o.lamps.forEach(function (lamps) {
          lamps[0].material = state === 0 ? self.mats.lampG : self.mats.lampOff;
          lamps[1].material = state === 1 ? self.mats.lampY : self.mats.lampOff;
          lamps[2].material = state === 2 ? self.mats.lampR : self.mats.lampOff;
        });
      });
    }

    // player
    const p = P(st.s, st.x, T);
    const yawOff = Math.atan2(sim.vx || 0, Math.max(4, st.speed));
    this.player.position.set(p.x, p.y + 0.02, p.z);
    this.player.rotation.order = 'YXZ';
    this.player.rotation.set(Math.atan(RT.gradeAt(st.s)), -p.h - yawOff, 0);   // 坂道で車体も傾ける
    if (this.playerMesh) {
      const parts = this.playerMesh.userData.parts;
      setTail(parts, opts.brake ? 2 : (SCENERY[this.sceneryId].lights ? 1 : 0));
      const roll = (sim.steer || 0) * -0.035 * Math.min(1, st.speed / 20);
      this.playerMesh.rotation.z = roll;
      const spin = st.speed * dt / 0.33;
      parts.wheels.forEach(function (w) { w.rotation.x -= spin; });
      this.playerMesh.visible = this.camMode !== 'bonnet';
    }

    // NPCs
    this._ensureNpcs(sim.npcs);
    const blinkOn = (this.time % 0.8) < 0.4;
    const lightsOn = SCENERY[this.sceneryId].lights;
    for (let i = 0; i < sim.npcs.length; i++) {
      const n = sim.npcs[i], m = this.npcMeshes[i];
      if (n.hidden) { m.visible = false; continue; }
      m.visible = true;
      const q = P(n.s, n.x, T);
      m.position.set(q.x, q.y + 0.02, q.z);
      m.rotation.order = 'YXZ';
      m.rotation.y = -q.h + (n.dir < 0 ? Math.PI : 0) + (n.crashed > 0 ? 0.35 : 0);
      m.rotation.x = Math.atan(RT.gradeAt(n.s) * n.dir);
      const parts = m.userData.parts;
      setTail(parts, n.brakeLight ? 2 : (lightsOn ? 1 : 0));
      parts.blink.emissiveIntensity = (n.blink > 0 && blinkOn) || (n.crashed > 0 && blinkOn) ? 3 : 0;
    }

    // ghost car (no collision, display only)
    this._updateGhost(st);

    // camera
    if (this._offset) { this.camera.clearViewOffset(); this._offset = false; }
    const view = opts.photo ? 'photo' : this.camMode;
    const cp = P(st.s, st.x, {});
    const h = -cp.h - yawOff * 0.6;
    const fwd = new THREE.Vector3(-Math.sin(h), 0, -Math.cos(h));
    let desired, look;
    const speedK = Math.min(1, st.speed / 40);
    if (view === 'photo') {
      const ph = opts.photo, ang = h + ph.yaw;
      const dir = new THREE.Vector3(-Math.sin(ang) * Math.cos(ph.pitch), Math.sin(ph.pitch), -Math.cos(ang) * Math.cos(ph.pitch));
      look = new THREE.Vector3(cp.x, cp.y + 0.9, cp.z);
      desired = look.clone().addScaledVector(dir, -ph.dist);
      if (desired.y < cp.y + 0.3) desired.y = cp.y + 0.3;
      this.camera.fov = ph.fov || 50;
      if (this.playerMesh) this.playerMesh.visible = true;
    } else if (view === 'bonnet') {
      desired = new THREE.Vector3(cp.x, cp.y + 1.25, cp.z).addScaledVector(fwd, 0.4);
      look = new THREE.Vector3(cp.x, cp.y + 1.05, cp.z).addScaledVector(fwd, 30);
      this.camera.fov = 66 + speedK * 8;
    } else {
      const back = 6.6 + speedK * 0.8, up = 2.55;
      desired = new THREE.Vector3(cp.x, cp.y + up, cp.z).addScaledVector(fwd, -back);
      look = new THREE.Vector3(cp.x, cp.y + 1.1, cp.z).addScaledVector(fwd, 9);
      this.camera.fov = 60 + speedK * 10;
    }
    if (!this.camInit || opts.snap || view === 'photo') { this.camPos.copy(desired); this.camLook.copy(look); this.camInit = true; }
    const k = view === 'bonnet' || view === 'photo' ? 1 : Math.min(1, dt * 7);
    this.camPos.lerp(desired, k);
    this.camLook.lerp(look, Math.min(1, dt * 10));
    this.camera.position.copy(this.camPos);
    if (this.shake > 0 && opts.shakeOn !== false) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 1.6);
    } else this.shake = 0;
    if (opts.shakeOn !== false && opts.rough) { this.camera.position.y += (Math.random() - 0.5) * 0.05; }
    this.camera.lookAt(this.camLook);
    this.camera.updateProjectionMatrix();

    // backdrop follows camera
    this.sky.position.copy(this.camera.position);
    this.mountains.position.set(this.camera.position.x, cp.y - 10, this.camera.position.z);
    this.clouds.position.set(this.camera.position.x, 0, this.camera.position.z);
    this.farGround.position.set(this.camera.position.x, this._farY(sim.st.s), this.camera.position.z);
    const tNow = this.time; this.anims.forEach(function (o) { o.userData.anim(tNow); });
    this.waterMap.offset.set((tNow * 0.011) % 1, (tNow * 0.019) % 1);            // 水面のさざ波を流す
    this._weatherFx(dt, sim, opts);
    // sun & shadow follow
    const S = SCENERY[this.sceneryId];
    this.sun.position.set(cp.x + S.sunDir[0] * 120, cp.y + S.sunDir[1] * 120 + 10, cp.z + S.sunDir[2] * 120);
    this.sun.target.position.set(cp.x, cp.y, cp.z);
    this.sun.target.updateMatrixWorld();

    this.r.render(this.scene, this.camera);
  };

  // ---- weather: 夏の雷雨・冬の降雪、トンネル内の照明 ----
  // 旅の開始・終了時に天候の表現（雪・雨・路面の色）を持ち越さない
  Renderer.prototype.resetWeather = function () { this.weatherW = 0; this.weatherType = null; this.flash = 0; this.nextBolt = 5; if (this.snowMesh) this.snowMesh.visible = false; };
  Renderer.prototype._weatherFx = function (dt, sim, opts) {
    const B = this.base; if (!B) return;
    const wx = sim ? sim.weather : null;
    const wt = wx && wx.w > 0 ? wx.type : null;
    const target = wx ? wx.w : 0;
    if (wt && this.weatherType && wt !== this.weatherType) this.weatherW = 0;      // 種類が変わったら前の天候を引きずらない
    this.weatherW += (target - this.weatherW) * Math.min(1, dt * 1.5);
    if (wt) this.weatherType = wt;
    else if (this.weatherW < 0.01) { this.weatherW = 0; this.weatherType = null; }
    const w = this.weatherType ? this.weatherW : 0;
    const inTun = sim ? RT.inTunnel(sim.st.s) : false;
    this.tunnelDim += ((inTun ? 1 : 0) - this.tunnelDim) * Math.min(1, dt * 3);
    const storm = this.weatherType === 'storm' ? w : 0, snow = this.weatherType === 'snow' ? w : 0;
    // 前照灯：夕方・雨・雷雨・降雪・トンネルで点灯し、路面を照らす
    const lampK = Math.max(SCENERY[this.sceneryId].lights ? (this.sceneryId === 'sunset' ? 0.8 : 0.6) : 0, this.tunnelDim, storm * 0.8, snow * 0.45);
    this.mats.beam.opacity = lampK * 0.8; this.mats.beam.visible = lampK > 0.03;
    this.mats.head.emissiveIntensity = 0.4 + 2.4 * lampK;
    this._birdsUpdate(dt, sim, Math.max(storm, snow), inTun);
    const fog = this.scene.fog, U = this.skyMat.uniforms;
    // fog & sky
    const stormFog = new THREE.Color(0x56606a), snowFog = new THREE.Color(0xdfe5ea);
    fog.color.copy(B.fog).lerp(stormFog, storm * 0.85).lerp(snowFog, snow * 0.9);
    fog.near = B.fogNear * (1 - 0.7 * Math.max(storm, snow));
    fog.far = B.fogFar * (1 - 0.6 * storm - 0.68 * snow);
    U.top.value.copy(B.top).lerp(new THREE.Color(0x2a323c), storm * 0.9).lerp(new THREE.Color(0xc4ccd4), snow * 0.9);
    U.hor.value.copy(B.hor).lerp(new THREE.Color(0x5a646e), storm * 0.9).lerp(new THREE.Color(0xe6eaee), snow * 0.9);
    this.scene.background.copy(fog.color);
    const mop = 1 - 0.96 * Math.max(storm, snow);                      // 雷雨・降雪の中では山並みは見えなくなる
    if ((mop < 0.999) !== this.mountMat.transparent) { this.mountMat.transparent = mop < 0.999; this.mountMat.needsUpdate = true; }   // 晴れている間は不透明のまま描く（負荷を増やさない）
    this.mountMat.opacity = mop;
    this.mountains.visible = this.mountMat.opacity > 0.03;
    // lightning
    if (storm > 0.5 && !inTun) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.flash = 1; this.nextBolt = 4 + Math.random() * 7;
        if (opts && opts.onThunder) opts.onThunder(0.4 + Math.random() * 1.4);
      }
    }
    this.flash = Math.max(0, this.flash - dt * 5);
    const fl = this.flash > 0 ? (Math.random() < 0.7 ? this.flash : this.flash * 0.3) : 0;
    if (fl > 0) { U.top.value.lerp(new THREE.Color(0xdde4ff), fl * 0.7); U.hor.value.lerp(new THREE.Color(0xeef0ff), fl * 0.7); }
    // lights
    const dim = this.tunnelDim;
    this.sun.intensity = B.sunI * (1 - 0.75 * storm - 0.45 * snow) * (1 - 0.88 * dim);
    this.hemi.intensity = (B.hemiI * (1 - 0.5 * storm) + fl * 2.2) * (1 + 0.9 * dim);
    this.mats.road.emissive.setHex(0x3a2a18); this.mats.road.emissiveIntensity = 0.55 * dim;   // 照明に照らされた路面
    // トンネル内はナトリウム灯の暖色
    this.hemi.color.copy(B.hemiSky).lerp(new THREE.Color(0xffc488), dim * 0.85);
    this.hemi.groundColor.copy(B.hemiGround).lerp(new THREE.Color(0x8a6a4a), dim * 0.7);
    // inside the tunnel the sky reflection (environment light) is cut as well
    const envK = (1 - 0.85 * dim) * (1 - 0.5 * storm);
    if (this._envK !== envK) {
      this._envK = envK;
      [this.mats.road, this.mats.bay, this.mats.white, this.mats.yellow].forEach(function (m) { m.envMapIntensity = envK; });
    }
    // road surface: wet (雷雨) / snow covered (降雪)
    this.mats.road.color.copy(B.road).lerp(new THREE.Color(0x30343a), storm * 0.6).lerp(new THREE.Color(0xaeb5bc), snow * 0.75);
    this.mats.road.roughness = B.rough + (0.22 - B.rough) * storm + (0.75 - B.rough) * snow;
    this.mats.road.metalness = B.metal + (0.25 - B.metal) * storm;
    // particles follow the camera
    const cam = this.camera.position;
    const rainLevel = inTun ? 0 : Math.max(B.rain, storm);
    this.rainMesh.visible = rainLevel > 0.02;
    if (this.rainMesh.visible) {
      this.rainMat.opacity = 0.18 + 0.45 * rainLevel;
      this.rainMesh.position.set(cam.x, cam.y - 6, cam.z);
      const pa = this.rainMesh.geometry.attributes.position, arr = pa.array;
      const fall = dt * (22 + 14 * storm);
      for (let i = 0; i < arr.length; i += 6) {
        arr[i + 1] -= fall; arr[i + 4] -= fall;
        if (arr[i + 4] < 0) { arr[i + 1] += 30; arr[i + 4] += 30; }
      }
      pa.needsUpdate = true;
    }
    // 花びら・落ち葉：カメラの周りの空間を漂う（速く走るほど後ろへ流れる）
    const airShow = this.airOn && !inTun && storm < 0.3 && snow < 0.3 && !!sim;
    this.airMesh.visible = airShow;
    if (airShow) {
      const pa = this.airMesh.geometry.attributes.position, arr = pa.array, t = this.time;
      const lp = this._airCam || (this._airCam = cam.clone());
      let dx = cam.x - lp.x, dy = cam.y - lp.y, dz = cam.z - lp.z;
      if (dx * dx + dz * dz > 400) { dx = 0; dy = 0; dz = 0; }               // 場面が切り替わったときは流さない
      lp.copy(cam);
      this.airMesh.position.set(cam.x, cam.y - 5, cam.z);
      const n3 = this.airMesh.geometry.drawRange.count * 3;
      for (let i = 0; i < n3; i += 3) {
        arr[i] += Math.sin(t * 0.8 + i) * dt * 0.9 - dx;
        arr[i + 1] -= dt * (0.7 + (i % 5) * 0.14) + dy;
        arr[i + 2] += Math.cos(t * 0.6 + i * 0.7) * dt * 0.7 - dz;
        if (arr[i] > 28) arr[i] -= 56; else if (arr[i] < -28) arr[i] += 56;
        if (arr[i + 2] > 28) arr[i + 2] -= 56; else if (arr[i + 2] < -28) arr[i + 2] += 56;
        if (arr[i + 1] < 0) arr[i + 1] += 20; else if (arr[i + 1] > 20) arr[i + 1] -= 20;
        // カメラのすぐ前には置かない（大きく映りすぎるのを防ぐ）
        if (arr[i] > -4 && arr[i] < 4 && arr[i + 2] > -4 && arr[i + 2] < 4 && arr[i + 1] > 1 && arr[i + 1] < 9) arr[i] += arr[i] < 0 ? -5 : 5;
      }
      pa.needsUpdate = true;
    } else this._airCam = null;
    this.snowMesh.visible = snow > 0.02 && !inTun;
    if (this.snowMesh.visible) {
      this.snowMat.opacity = 0.9 * snow;
      this.snowMesh.position.set(cam.x, cam.y - 8, cam.z);
      const pa = this.snowMesh.geometry.attributes.position, arr = pa.array;
      const t = this.time;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= dt * (1.4 + (i % 7) * 0.12);
        arr[i] += Math.sin(t * 0.9 + i) * dt * 0.6;
        if (arr[i + 1] < 0) arr[i + 1] += 28;
      }
      pa.needsUpdate = true;
    }
  };

  // ---- ghost car ----
  Renderer.prototype.setGhost = function (ghost, colorHex, label) {
    if (this.ghostMesh) {
      this.scene.remove(this.ghostMesh);
      this.ghostMesh.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); if (o.material) o.material.dispose(); });
      this.ghostMesh = null;
    }
    this.ghost = ghost || null;
    if (!ghost) return;
    const kind = ghost.meta && ghost.meta.car === 'sport' ? 'sport' : (ghost.meta && ghost.meta.car === 'compact' ? 'kei' : 'sedan');
    const car = R13.garage.carById(ghost.meta ? ghost.meta.car : 'tourer');
    const m = buildCar({ len: car.dims.len, wid: car.dims.wid, hgt: car.dims.hgt, kind: kind }, colorHex || '#9fd0ff', this.mats, { merge: true });
    m.traverse(function (o) {
      if (o.isMesh) {
        const mm = o.material.clone();
        mm.transparent = true; mm.opacity = 0.38; mm.depthWrite = false;
        if (mm.emissive) { mm.emissive = new THREE.Color(0x6fb4ff); mm.emissiveIntensity = 0.35; }
        o.material = mm; o.renderOrder = 5;
      }
    });
    // name tag
    const tex = signTex('ghost-' + label, 256, 64, function (g, w, h) {
      g.fillStyle = 'rgba(20,40,70,0.75)'; roundRect(g, 2, 2, w - 4, h - 4, 18); g.fill();
      g.fillStyle = '#bfe3ff'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, '👻 ' + label, w - 20, 34, 800); g.fillText('👻 ' + label, w / 2, h / 2 + 1);
    });
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.9 }));
    tag.scale.set(2.6, 0.65, 1); tag.position.y = 2.6; m.add(tag);
    this.ghostMesh = m;
    this.scene.add(m);
  };
  Renderer.prototype._updateGhost = function (st) {
    const g = this.ghost, m = this.ghostMesh;
    if (!g || !m) return;
    const pos = R13.ghost.posAt(g, st.time);
    if (!pos || pos.done || Math.abs(pos.s - st.s) > 650) { m.visible = false; return; }
    m.visible = true;
    const q = RT.pointAt(pos.s, pos.x, {});
    const nxt = R13.ghost.posAt(g, st.time + 0.5);
    const ds = Math.max(0.5, nxt.s - pos.s), dx = nxt.x - pos.x;
    m.position.set(q.x, q.y + 0.03, q.z);
    m.rotation.order = 'YXZ';
    m.rotation.y = -q.h - Math.atan2(dx, ds);
    m.rotation.x = Math.atan(RT.gradeAt(pos.s));
  };

  // photo capture: render once at higher resolution and return a JPEG data URL
  Renderer.prototype.capture = function (sim, opts) {
    const pr = this.r.getPixelRatio();
    this.r.setPixelRatio(Math.min(2, G.devicePixelRatio || 1));
    this.resize();
    this.render(sim, 0, opts);
    const url = this.canvas.toDataURL('image/jpeg', 0.92);
    this.r.setPixelRatio(pr);
    this.resize();
    return url;
  };

  // garage / title preview: orbit around a parked car
  Renderer.prototype.renderShowcase = function (dt, s) {
    this.time += dt;
    this._weatherFx(dt, null, null);
    s = s || 400;
    this._updateChunks(s);
    const p = RT.pointAt(s, -5.25);
    this.player.position.set(p.x, p.y + 0.02, p.z);
    this.player.rotation.set(0, -p.h, 0);
    if (this.playerMesh) this.playerMesh.visible = true;
    const a = this.time * 0.25;
    this.camera.fov = 45;
    const w = G.innerWidth || 1280, h = G.innerHeight || 720;
    this.camera.setViewOffset(w, h, -w * 0.2, 0, w, h);
    this._offset = true;
    this.camera.position.set(p.x + Math.cos(a) * 8, p.y + 2.4, p.z + Math.sin(a) * 8);
    this.camera.lookAt(p.x, p.y + 0.8, p.z);
    this.camera.updateProjectionMatrix();
    this.sky.position.copy(this.camera.position);
    this.mountains.position.set(this.camera.position.x, p.y - 10, this.camera.position.z);
    this.clouds.position.set(this.camera.position.x, 0, this.camera.position.z);
    this.farGround.position.set(this.camera.position.x, this._farY(s), this.camera.position.z);
    const S = SCENERY[this.sceneryId];
    this.sun.position.set(p.x + S.sunDir[0] * 120, p.y + S.sunDir[1] * 120 + 10, p.z + S.sunDir[2] * 120);
    this.sun.target.position.set(p.x, p.y, p.z); this.sun.target.updateMatrixWorld();
    this.npcMeshes.forEach(function (m) { if (m) m.visible = false; });
    this.r.render(this.scene, this.camera);
  };

  Renderer.prototype.bump = function (amount) { this.shake = Math.max(this.shake, amount); };

  R13.Renderer = Renderer;
  R13.renderer = { QUALITY: QUALITY, SCENERY: SCENERY };
})(typeof window !== 'undefined' ? window : globalThis);
