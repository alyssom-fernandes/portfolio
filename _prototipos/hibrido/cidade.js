/* =====================================================================
   CIDADE 3D — maquete arquitetônica sobre uma planilha
   Three.js 0.170.0 (jsdelivr). Tudo procedural, nada de assets externos.
   - entrada: a planilha vista de cima; os números das células viram prédios
     andar por andar e a câmera desce até o sobrevoo
   - cada seção do HTML comanda um plano de câmera (APP.plano)
   - andares e janelas em InstancedMesh; sombras só em aparelhos capazes
   ===================================================================== */
(function () {
'use strict';
// script clássico com import() dinâmico: módulos locais são bloqueados em file://,
// mas o import map (three@0.170.0 no jsdelivr) vale também para import() dinâmico.
const APP = window.APP, M = window.MODELO, P = window.PLANTA;
let THREE, RoundedBoxGeometry, mergeGeometries;

if (APP && APP.usar3D) carregar().then(iniciar).catch(err => { console.error(err); APP.falhou('o 3D não carregou'); });

async function carregar() {
  const [t, rb, bu] = await Promise.all([
    import('three'),
    import('three/addons/geometries/RoundedBoxGeometry.js'),
    import('three/addons/utils/BufferGeometryUtils.js'),
  ]);
  THREE = t; RoundedBoxGeometry = rb.RoundedBoxGeometry; mergeGeometries = bu.mergeGeometries;
  APP.carregou3D = true;
}

async function iniciar() {
  // fontes das texturas (cabeçalhos e números da planilha)
  try {
    await Promise.race([
      Promise.all(['500 64px "IBM Plex Mono"', '400 32px "IBM Plex Mono"'].map(f => document.fonts.load(f))),
      new Promise(r => setTimeout(r, 1500)),
    ]);
  } catch (e) { /* segue com a fonte de sistema */ }
  if (!APP.usar3D) return;

  const canvas = document.getElementById('cidade');
  const MOB = APP.mobile || matchMedia('(pointer: coarse)').matches;
  // sombras só em aparelhos capazes (em captura, o desktop força a qualidade alta; o celular fica como no aparelho)
  const ALTA = !MOB && (!APP.gpuFraca || APP.captura);
  let renderer;
  try {
    // alpha: no celular cada vitrine é desenhada só no seu recorte (scissor); o resto fica transparente
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false });
  } catch (e) { APP.falhou('este navegador não abriu o WebGL'); return; }
  renderer.setClearColor(0x000000, 0);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); APP.falhou('o contexto WebGL foi perdido'); parar(); });

  const DPR_MAX = Math.min(window.devicePixelRatio || 1, MOB ? 1.5 : 2);
  let dpr = Math.min(DPR_MAX, 1.5);   // começa folgado; sobe até o máximo se o aparelho aguentar
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = ALTA;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // ---------- utilidades ----------
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const COR = {
    zen: new THREE.Color('#98A5B6'), meio: new THREE.Color('#CBD1D9'), horiz: new THREE.Color('#E6E8EB'), nevoa: new THREE.Color('#E0E3E7'),
    chao: '#D3D6DB', papel: '#F3F3F0', grade: '#CCD3DC', gradeFina: '#DFE3E8', cab: '#E3E6EA', cabTxt: '#7C838E',
    base: '#2F353F', laje: '#F1F2F3', lajeT: '#E9ECF0', cenario: '#CCD2DA', copa: '#9EB3A6', tronco: '#9AA0A8',
    azul: '#2B3BEA', astcon: '#B5A688', nm: '#7A705E', verde: '#1FB35E', tinta: '#1B2230',
  };
  const corCarreira = { astcon: COR.astcon, nm: COR.nm, zen: COR.azul };

  // ---------- cena, névoa, céu ----------
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(COR.nevoa, 110, 340);
  const camera = new THREE.PerspectiveCamera(30, 1, .5, 1500);
  const SOL = V(-.58, .52, .62).normalize();

  const ceuUniforms = { uZen: { value: COR.zen }, uMeio: { value: COR.meio }, uHor: { value: COR.horiz }, uNev: { value: COR.nevoa }, uSol: { value: SOL } };
  const ceuMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: ceuUniforms,
    vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uZen,uMeio,uHor,uNev,uSol; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float h = d.y;
        vec3 c = mix(uHor, uMeio, smoothstep(0.0, 0.22, h));
        c = mix(c, uZen, smoothstep(0.18, 0.9, h));
        float s = max(dot(d, uSol), 0.0);
        c += vec3(0.95,0.97,1.0) * pow(s, 24.0) * 0.18 * smoothstep(-0.05, 0.2, h);
        c = mix(uNev, c, smoothstep(-0.02, 0.06, h));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const ceu = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), ceuMat);
  ceu.renderOrder = -10; scene.add(ceu);

  // ambiente para reflexos do vidro (gerado do próprio céu)
  {
    const pm = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), ceuMat));
    const chaoEnv = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: '#9AA4B2' }));
    chaoEnv.rotation.x = -Math.PI / 2; chaoEnv.position.y = -1; envScene.add(chaoEnv);
    scene.environment = pm.fromScene(envScene, 0.02).texture;
    pm.dispose();
  }

  // ---------- luz de fim de tarde, fria ----------
  scene.add(new THREE.HemisphereLight('#EEF0F4', '#79808B', .95));
  const sol = new THREE.DirectionalLight('#FBFCFF', 2.9);
  sol.position.copy(SOL).multiplyScalar(160);
  scene.add(sol, sol.target);
  if (ALTA) {
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    const sc = sol.shadow.camera; sc.left = -64; sc.right = 64; sc.top = 52; sc.bottom = -52; sc.near = 60; sc.far = 300;
    sol.shadow.bias = -0.0006; sol.shadow.normalBias = 0.04; sol.shadow.radius = 2;
  }
  const contra = new THREE.DirectionalLight('#C3CEE2', .35); contra.position.set(70, 40, -60); scene.add(contra);

  // ---------- texturas ----------
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  function texCanvas(w, h, desenha, srgb = true) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    desenha(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    return t;
  }
  const letra = i => { let s = ''; i++; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
  const mesRot = m => ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][(m + 1) % 12] + '/' + (2021 + Math.floor((m + 1) / 12));

  // folha de cálculo: o tampo da maquete
  const folhaTex = texCanvas(ALTA ? 3072 : 2048, Math.round((ALTA ? 3072 : 2048) * P.SZ / P.SX), (x, W, H) => {
    const u = W / P.SX;
    const X = wx => (wx - P.X0) * u, Z = wz => (wz - P.Z0) * u;
    x.fillStyle = COR.papel; x.fillRect(0, 0, W, H);
    // blocos de dados (faixa selecionada, como numa planilha)
    P.predios.forEach(b => {
      x.fillStyle = b.tipo === 'projeto' ? '#E8ECF5' : '#EDF0F4';
      x.fillRect(X(P.cx(b.c0)), Z(P.cz(b.r0)), b.nc * P.CW * u, b.nr * P.CH * u);
    });
    // grade
    x.fillStyle = COR.gradeFina;
    for (let r = 0; r <= P.ROWS; r++) x.fillRect(0, Z(P.cz(r)) - .6, W, 1.2);
    x.fillStyle = COR.grade;
    for (let c = 0; c <= P.COLS; c++) x.fillRect(X(P.cx(c)) - .8, 0, 1.6, H);
    // cabeçalhos
    x.fillStyle = COR.cab; x.fillRect(0, 0, W, P.CH * u); x.fillRect(0, 0, P.CW * u, H);
    x.fillStyle = '#B9C0CA'; x.fillRect(0, P.CH * u - 1.5, W, 3); x.fillRect(P.CW * u - 1.5, 0, 3, H);
    x.fillStyle = COR.cabTxt; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `500 ${Math.round(P.CH * u * .5)}px "IBM Plex Mono", monospace`;
    for (let c = 1; c < P.COLS; c++) x.fillText(letra(c - 1), X(P.cx(c)) + P.CW * u / 2, P.CH * u / 2 + 1);
    for (let r = 1; r < P.ROWS; r++) x.fillText(String(r), P.CW * u / 2, Z(P.cz(r)) + P.CH * u / 2 + 1);
    // avenida: 1 célula por mês
    const av = P.AV, z0 = Z(av.z - av.largura / 2), zh = av.largura * u;
    for (let m = 0; m <= av.fimAno; m++) {
      const x0 = X(av.mx(m));
      let c = null;
      if (m <= M.mesHoje) c = m >= M.mes('2026-02') ? COR.azul : m >= M.mes('2025-09') ? COR.nm : COR.astcon;
      if (c) { x.fillStyle = c; x.fillRect(x0 + 2, z0 + 2, av.mw * u - 4, zh - 4); }
      else { x.strokeStyle = '#C2C9D2'; x.lineWidth = 2; x.strokeRect(x0 + 3, z0 + 3, av.mw * u - 6, zh - 6); }
      if (m === M.mes('2025-09')) { x.fillStyle = COR.astcon; x.beginPath(); x.moveTo(x0 + 2, z0 + 2); x.lineTo(x0 + av.mw * u - 2, z0 + 2); x.lineTo(x0 + 2, z0 + zh - 2); x.fill(); }
    }
    // anos e rótulos da avenida
    x.fillStyle = '#5B6270'; x.textAlign = 'left'; x.textBaseline = 'top';
    x.font = `500 ${Math.round(P.CH * u * .62)}px "IBM Plex Mono", monospace`;
    for (let a = 2021; a <= 2026; a++) {
      const m = Math.max(0, (a - 2021) * 12 - 1);
      x.fillRect(X(av.mx(m)), z0 + zh + 4, 2, P.CH * u * .9);
      x.fillText(a === 2021 ? 'fev/2021' : String(a), X(av.mx(m)) + 8, z0 + zh + 8);
    }
    x.textBaseline = 'bottom';
    x.fillStyle = '#6A717D';
    x.font = `400 ${Math.round(P.CH * u * .5)}px "IBM Plex Mono", monospace`;
    x.fillText('AVENIDA DA CARREIRA · 1 CÉLULA = 1 MÊS', X(av.mx(0)), z0 - 6);
    // borda da seleção dos blocos de dados
    x.strokeStyle = '#A9B3C4'; x.lineWidth = 2;
    P.predios.forEach(b => x.strokeRect(X(P.cx(b.c0)) + 1, Z(P.cz(b.r0)) + 1, b.nc * P.CW * u - 2, b.nr * P.CH * u - 2));
  });
  folhaTex.generateMipmaps = true;
  folhaTex.minFilter = THREE.LinearMipmapLinearFilter;

  // vidro: caixilhos nítidos; as persianas e luzes acesas variam por andar no shader
  function texVidro(panos) {
    const W = panos * 96, H = 128;
    const cor = texCanvas(W, H, (x) => {
      const g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#5D6C82'); g.addColorStop(.6, '#3F4C60'); g.addColorStop(1, '#343F51');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.fillStyle = '#E6E9ED';
      for (let i = 0; i <= panos; i++) x.fillRect(i * 96 - (i === 0 ? 0 : 3), 0, i === 0 || i === panos ? 5 : 6, H);
      x.fillRect(0, H * .7, W, 4);
      x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(0, 0, W, H * .1);
    });
    const mascara = texCanvas(W, H, (x) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#fff';
      for (let i = 0; i < panos; i++) x.fillRect(i * 96 + 6, 4, 84, H * .7 - 6);
    }, false);
    return { cor, mascara };
  }
  const aoTex = texCanvas(128, 128, (x, w) => {
    const g = x.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,.9)'); g.addColorStop(.5, 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, w);
  });

  // ---------- chão, maquete, folha ----------
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ color: COR.chao, roughness: 1 }));
  chao.rotation.x = -Math.PI / 2; chao.position.y = -1.15; chao.receiveShadow = ALTA; scene.add(chao);
  const base = new THREE.Mesh(new RoundedBoxGeometry(P.SX + .8, 1.15, P.SZ + .8, 2, .12), new THREE.MeshStandardMaterial({ color: COR.base, roughness: .7, metalness: 0 }));
  base.position.y = -.575; base.castShadow = ALTA; base.receiveShadow = ALTA; scene.add(base);
  const folha = new THREE.Mesh(new THREE.PlaneGeometry(P.SX, P.SZ), new THREE.MeshStandardMaterial({ map: folhaTex, roughness: .92, metalness: 0, envMapIntensity: .25 }));
  folha.rotation.x = -Math.PI / 2; folha.position.y = .004; folha.receiveShadow = ALTA; scene.add(folha);

  // ---------- materiais ----------
  const matLaje = new THREE.MeshStandardMaterial({ color: COR.laje, roughness: .86, metalness: 0, envMapIntensity: .2 });
  const matLajeT = new THREE.MeshStandardMaterial({ color: COR.lajeT, roughness: .86, metalness: 0, envMapIntensity: .2 });
  function matVidro(panos, tom) {
    const t = texVidro(panos);
    const m = new THREE.MeshStandardMaterial({ color: tom, map: t.cor, emissiveMap: t.mascara, emissive: 0x000000, roughness: .12, metalness: .1, envMapIntensity: .9 });
    m.onBeforeCompile = sh => {
      sh.uniforms.uAzul = { value: new THREE.Color('#3F58FF') };
      sh.uniforms.uPers = { value: new THREE.Color('#B9C1CC') };
      sh.uniforms.uPanos = { value: panos };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aInfo;\nvarying vec2 vInfo;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInfo = aInfo;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform vec3 uAzul, uPers; uniform float uPanos; varying vec2 vInfo;
          float h21(vec2 p){ p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          float pano = floor(vMapUv.x * uPanos);
          float semente = floor(vInfo.y + 0.5);
          float hs = h21(vec2(pano + 3.0, mod(semente, 97.0) + 1.0));
          float mascara = texture2D(emissiveMap, vMapUv).r;
          float nivel = 0.15 + 0.55 * fract(hs * 7.13);
          float pers = step(0.78, hs) * step(1.0 - nivel, vMapUv.y) * mascara;
          diffuseColor.rgb = mix(diffuseColor.rgb, uPers, pers * 0.9);`)
        .replace('#include <emissivemap_fragment>', `
          totalEmissiveRadiance = uAzul * mascara * vInfo.x * 1.35;`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.85, pers);`);
    };
    return m;
  }

  // ---------- prédios (InstancedMesh por tipo) ----------
  const FH = P.FH, LAJE = .16;
  const predios = P.predios.map(b => Object.assign({}, b, { glow: 0, alvoGlow: 0, prog: 0, delay: 0 }));
  const porId = {};
  predios.forEach(b => { porId[b.id] = b; });
  const minX = Math.min(...predios.map(b => b.x)), spanX = Math.max(...predios.map(b => b.x)) - minX;
  predios.forEach(b => { b.delay = .7 + (b.x - minX) / spanX * 1.35 + (hash(b.id) % 100) / 100 * .2; });

  const grupos = [];
  function criaGrupo(lista, w, matL, vidroTom, panos) {
    const andares = [];
    lista.forEach(b => { for (let i = 0; i < b.n; i++) andares.push({ b, i }); });
    const N = andares.length;
    const gLaje = new RoundedBoxGeometry(w + .18, LAJE, w + .18, 2, .035); gLaje.translate(0, LAJE / 2, 0);
    const gVid = new THREE.BoxGeometry(w - .1, FH - LAJE, w - .1); gVid.translate(0, LAJE + (FH - LAJE) / 2, 0);
    const pil = [];
    const o = w / 2 - .01;
    [[o, o], [-o, o], [o, -o], [-o, -o]].forEach(([px, pz]) => { const g = new THREE.BoxGeometry(.13, FH - LAJE, .13); g.translate(px, LAJE + (FH - LAJE) / 2, pz); pil.push(g); });
    const gPil = mergeGeometries(pil);
    const aInfo = new THREE.InstancedBufferAttribute(new Float32Array(N * 2), 2);
    andares.forEach((a, k) => { aInfo.setXY(k, 0, (hash(a.b.id) % 89) + a.i * 7); });
    gVid.setAttribute('aInfo', aInfo);
    const lajes = new THREE.InstancedMesh(gLaje, matL, N);
    const vidros = new THREE.InstancedMesh(gVid, matVidro(panos, vidroTom), N);
    const pilares = new THREE.InstancedMesh(gPil, matL, N);
    [lajes, vidros, pilares].forEach(im => { im.castShadow = ALTA; im.receiveShadow = ALTA && im !== vidros; im.frustumCulled = false; scene.add(im); });
    const g = { andares, lajes, vidros, pilares, aInfo, w };
    grupos.push(g);
    return g;
  }
  const comAndares = predios.filter(b => b.n > 0);
  const gP = criaGrupo(comAndares.filter(b => b.tipo === 'projeto'), 3.2, matLaje, '#FFFFFF', 4);
  const gT = criaGrupo(comAndares.filter(b => b.tipo === 'tecnologia'), 1.5, matLajeT, '#DCE3EE', 2);

  // coberturas: platibanda (azul = em produção), casa de máquinas, antenas
  const cobs = [];
  {
    const lista = comAndares;
    const gParaP = new RoundedBoxGeometry(3.42, .3, 3.42, 2, .05); gParaP.translate(0, .15, 0);
    const gParaT = new RoundedBoxGeometry(1.72, .26, 1.72, 2, .04); gParaT.translate(0, .13, 0);
    const gCasa = new RoundedBoxGeometry(1, .55, .8, 2, .05); gCasa.translate(0, .55 / 2 + .28, 0);
    const lp = lista.filter(b => b.tipo === 'projeto'), lt = lista.filter(b => b.tipo === 'tecnologia');
    const matCob = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: .86, envMapIntensity: .2 });
    const lpProd = lp.filter(b => b.status === 'producao');
    const gDeck = new RoundedBoxGeometry(2.7, .08, 2.7, 1, .02); gDeck.translate(0, .3 + .04, 0);
    const decks = new THREE.InstancedMesh(gDeck, new THREE.MeshStandardMaterial({ color: '#2230B0', roughness: .8, envMapIntensity: .1 }), lpProd.length);
    lpProd.forEach((b, k) => cobs.push({ b, im: decks, k, kind: 'para' }));
    decks.receiveShadow = ALTA; decks.frustumCulled = false; scene.add(decks);
    const paraP = new THREE.InstancedMesh(gParaP, matCob, lp.length);
    const paraT = new THREE.InstancedMesh(gParaT, matCob, lt.length);
    const casas = new THREE.InstancedMesh(gCasa, matLaje, lista.length);
    const cBranco = new THREE.Color(COR.laje);
    lp.forEach((b, k) => { paraP.setColorAt(k, cBranco); cobs.push({ b, im: paraP, k, kind: 'para' }); });
    lt.forEach((b, k) => { paraT.setColorAt(k, cBranco); cobs.push({ b, im: paraT, k, kind: 'para' }); });
    lista.forEach((b, k) => {
      const r = hash(b.id + 'c');
      const s = b.tipo === 'projeto' ? 1 : .55;
      cobs.push({ b, im: casas, k, kind: 'casa', s, ox: ((r % 100) / 100 - .5) * b.w * .35, oz: (((r >> 8) % 100) / 100 - .5) * b.w * .35 });
    });
    [paraP, paraT, casas].forEach(im => { im.castShadow = ALTA; im.receiveShadow = ALTA; im.frustumCulled = false; scene.add(im); });
  }
  // antenas: demo ao vivo
  const antenas = [];
  predios.filter(b => b.antena).forEach(b => {
    const g = new THREE.Group();
    const mastro = new THREE.Mesh(new THREE.CylinderGeometry(.035, .05, 2.2, 8), new THREE.MeshStandardMaterial({ color: '#5A616D', roughness: .5 }));
    mastro.position.y = 1.1; g.add(mastro);
    const luzM = new THREE.MeshBasicMaterial({ color: COR.verde });
    const luz = new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 8), luzM); luz.position.y = 2.25; g.add(luz);
    g.position.set(b.x + b.w * .3, (b.n ? b.n * FH + .3 : .75), b.z - b.w * .3);
    g.scale.setScalar(.001); scene.add(g);
    antenas.push({ b, g, luzM, fase: (hash(b.id) % 100) / 16 });
  });
  // pavilhões térreos (projetos fora da matriz)
  const pavs = predios.filter(b => b.n === 0);
  const pavVid = (() => {
    const g = new THREE.BoxGeometry(3.3, .6, 2.7); g.translate(0, .06 + .3, 0);
    const a = new THREE.InstancedBufferAttribute(new Float32Array(pavs.length * 2), 2);
    pavs.forEach((b, k) => a.setXY(k, 0, hash(b.id) % 89));
    g.setAttribute('aInfo', a);
    const im = new THREE.InstancedMesh(g, matVidro(4, '#FFFFFF'), pavs.length);
    im.castShadow = ALTA; im.receiveShadow = ALTA; im.frustumCulled = false; scene.add(im);
    return { im, a };
  })();
  const pavTeto = (() => {
    const g = new RoundedBoxGeometry(3.7, .16, 3.1, 2, .04); g.translate(0, .66 + .08, 0);
    const im = new THREE.InstancedMesh(g, matLaje, pavs.length);
    im.castShadow = ALTA; im.receiveShadow = ALTA; im.frustumCulled = false; scene.add(im);
    return im;
  })();

  // oclusão de contato (sombra suave no pé de cada volume) — funciona mesmo sem mapa de sombras
  const aoItens = [];
  predios.forEach(b => aoItens.push({ x: b.x, z: b.z, sx: b.w * 2.1, sz: b.w * 2.1, b }));
  P.cenario.forEach(c => aoItens.push({ x: c.x, z: c.z, sx: c.w * 1.9, sz: c.d * 1.9, cen: true }));
  const aoMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: aoTex, color: '#42506A', transparent: true, opacity: ALTA ? .32 : .5, depthWrite: false }), aoItens.length);
  aoMesh.position.y = .012; aoMesh.renderOrder = 1; aoMesh.frustumCulled = false; scene.add(aoMesh);

  // cenário (entorno sem dado): volumes lisos, uma só geometria
  const cenGeo = mergeGeometries(P.cenario.map(c => { const g = new RoundedBoxGeometry(c.w, c.h, c.d, 2, .06); g.translate(c.x, c.h / 2, c.z); return g; }));
  const cenario = new THREE.Mesh(cenGeo, new THREE.MeshStandardMaterial({ color: COR.cenario, roughness: .95, envMapIntensity: .3 }));
  cenario.castShadow = ALTA; cenario.receiveShadow = ALTA; scene.add(cenario);

  // árvores de maquete
  const arv = new THREE.Group(); scene.add(arv);
  {
    const copas = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.5, 1), new THREE.MeshStandardMaterial({ color: COR.copa, roughness: .9, flatShading: true, envMapIntensity: .3 }), P.arvores.length);
    const troncos = new THREE.InstancedMesh(new THREE.CylinderGeometry(.04, .06, .7, 6).translate(0, .35, 0), new THREE.MeshStandardMaterial({ color: COR.tronco, roughness: .8 }), P.arvores.length);
    const o = new THREE.Object3D();
    P.arvores.forEach((t, k) => {
      o.position.set(t.x, 0, t.z); o.scale.setScalar(t.s); o.rotation.set(0, 0, 0); o.updateMatrix(); troncos.setMatrixAt(k, o.matrix);
      o.position.set(t.x, .62 * t.s + .35 * t.s, t.z); o.rotation.y = t.x * 3.1; o.scale.set(t.s * .95, t.s * 1.05, t.s * .95); o.updateMatrix(); copas.setMatrixAt(k, o.matrix);
    });
    [copas, troncos].forEach(im => { im.castShadow = ALTA; im.receiveShadow = ALTA; arv.add(im); });
  }

  // marcos da carreira (início de cada emprego), anel de "hoje" e marco da formação
  const marcos = P.marcos.map(mk => {
    const g = new THREE.Group(); g.position.set(mk.x, 0, mk.z); scene.add(g);
    const tot = new THREE.Mesh(new RoundedBoxGeometry(.36, 3.2, .36, 2, .05).translate(0, 1.6, 0), matLaje); tot.castShadow = ALTA; g.add(tot);
    const bm = new THREE.MeshStandardMaterial({ color: corCarreira[mk.cor], roughness: .6, emissive: corCarreira[mk.cor], emissiveIntensity: 0 });
    const faixa = new THREE.Mesh(new RoundedBoxGeometry(.42, .55, .42, 2, .05).translate(0, 3.0, 0), bm); faixa.castShadow = ALTA; g.add(faixa);
    g.scale.y = .001;
    const o = Object.assign({}, mk, { g, bm, glow: 0, top: V(mk.x, 3.4, mk.z) });
    porId[mk.id] = o;
    return o;
  });
  // ladrilhos da avenida (1 por mês), em relevo leve, na cor de onde eu estava
  const ladrilhos = (() => {
    const n = M.mesHoje + 1;
    const g = new RoundedBoxGeometry(P.AV.mw - .1, .1, P.AV.largura - .12, 1, .02); g.translate(0, .05, 0);
    const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: .75, envMapIntensity: .15 }), n);
    const cor = new THREE.Color();
    for (let m = 0; m < n; m++) {
      const c = m >= M.mes('2026-02') ? COR.azul : m > M.mes('2025-09') ? COR.nm : m === M.mes('2025-09') ? '#988C74' : COR.astcon;
      im.setColorAt(m, cor.set(c));
    }
    im.castShadow = ALTA; im.receiveShadow = ALTA; im.frustumCulled = false; scene.add(im);
    return im;
  })();
  const hojeAnel = new THREE.Mesh(new THREE.RingGeometry(.55, .7, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: COR.azul, transparent: true, depthWrite: false }));
  hojeAnel.position.set(P.hoje.x, .14, P.hoje.z); scene.add(hojeAnel);
  const formG = new THREE.Group(); formG.position.set(P.formacao.x, 0, P.formacao.z); scene.add(formG);
  {
    const t = new THREE.Mesh(new RoundedBoxGeometry(.3, 2.2, .3, 2, .05).translate(0, 1.1, 0), matLaje); t.castShadow = ALTA; formG.add(t);
    const f = new THREE.Mesh(new RoundedBoxGeometry(.9, .6, .08, 2, .03).translate(.45, 1.9, 0), new THREE.MeshStandardMaterial({ color: COR.azul, roughness: .6 })); f.castShadow = ALTA; formG.add(f);
    formG.scale.y = .001;
  }

  // seleção (como a célula selecionada de uma planilha) — acende no hover/foco
  const selecoes = [];
  predios.forEach(b => {
    const W = b.nc * P.CW + .2, Dz = b.nr * P.CH + .2, e = .09;
    const partes = [[0, -Dz / 2, W + e, e], [0, Dz / 2, W + e, e], [-W / 2, 0, e, Dz + e], [W / 2, 0, e, Dz + e], [W / 2, Dz / 2, .34, .34]];
    const geo = mergeGeometries(partes.map(([x, z, w, d]) => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, 0, z)));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: COR.azul, transparent: true, opacity: 0, depthWrite: false }));
    m.position.set(b.x, .02, b.z); m.visible = false; m.renderOrder = 2; scene.add(m);
    b.sel = m;
  });

  // números nas células (a planilha antes de virar cidade)
  const numeros = [];
  predios.forEach(b => {
    const w = b.nc * P.CW - .12, d = b.nr * P.CH - .12;
    const tex = texCanvas(256, Math.round(256 * d / w), (x, W, H) => {
      x.clearRect(0, 0, W, H);
      x.fillStyle = '#5E6674'; x.textAlign = 'left'; x.textBaseline = 'top';
      x.font = `500 ${b.tipo === 'projeto' ? 20 : 30}px "IBM Plex Mono", monospace`;
      x.fillText((b.tipo === 'projeto' ? b.nome : b.curto).toUpperCase().slice(0, b.tipo === 'projeto' ? 16 : 10), 12, 10);
      x.fillStyle = b.status === 'producao' ? COR.azul : COR.tinta; x.textAlign = 'right'; x.textBaseline = 'alphabetic';
      x.font = `500 ${b.tipo === 'projeto' ? 118 : 150}px "IBM Plex Mono", monospace`;
      x.fillText(b.n ? String(b.n) : '—', W - 16, H - 18);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.position.set(b.x, .02, b.z); m.renderOrder = 3; scene.add(m);
    numeros.push({ b, m });
  });

  // caixas invisíveis para o clique/hover
  const pegaveis = [];
  const pegaMat = new THREE.MeshBasicMaterial();
  predios.forEach(b => {
    const h = (b.n ? b.n * FH : .8) + .6;
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.w + .6, h, b.w + .6), pegaMat);
    m.position.set(b.x, h / 2, b.z); m.visible = false; m.userData.id = b.id; scene.add(m); pegaveis.push(m);
    b.top = V(b.x, h - .3, b.z);
  });
  marcos.forEach(mk => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.8, 1.2), pegaMat);
    m.position.set(mk.x, 1.9, mk.z); m.visible = false; m.userData.id = mk.id; scene.add(m); pegaveis.push(m);
  });

  // ---------- rótulos HTML (só no plano certo, com prevenção de colisão) ----------
  const rotEl = document.getElementById('rotulos');
  const rotulos = [];
  function rot(conj, html, pos, prio, cls = '', id = null) {
    const el = document.createElement('div'); el.className = 'rot ' + cls; el.innerHTML = `<span class="in">${html}</span>`;
    rotEl.appendChild(el);
    const r = { conj, el, pos, prio, id, on: false, w: 0, h: 0 };
    rotulos.push(r); return r;
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // rótulo de bairro: pintado no chão, na calçada à frente do bairro, como numa planta. Vistas de cima,
  // as torres sobem na tela e o chão da frente fica livre, então nenhuma torre atravessa o texto.
  function frenteBairro(tipo) {
    const l = predios.filter(b => b.tipo === tipo);
    const xs = l.map(b => b.x);
    const frente = Math.max(...l.map(b => b.z + b.nr * P.CH / 2));
    return V((Math.min(...xs) + Math.max(...xs)) / 2, .2, frente + 1.6);
  }
  rot('distrito', 'Bairro dos projetos', frenteBairro('projeto'), 9, 'distrito');
  rot('distrito', 'Bairro das tecnologias', frenteBairro('tecnologia'), 8, 'distrito');
  rot('distrito', 'Avenida 2021 → hoje', V(4, .2, 17), 7, 'distrito');
  predios.forEach(b => {
    // ancorado na cobertura do próprio prédio (não no topo da antena, que parecia apontar para o vizinho)
    if (b.tipo === 'projeto') rot('proj', esc(b.nome), b.top.clone().add(V(0, .45, 0)), 20 + b.n + (b.status === 'producao' ? 20 : 0) + (b.ref.destaque ? 60 : 0), b.status === 'producao' ? 'prod' : '', b.id);
    else rot('tec', esc(b.curto), b.top.clone().add(V(0, .25, 0)), b.n, '', b.id);
  });
  marcos.forEach(mk => rot('marco', `<b>${mesRot(M.mes(mk.ref.inicio))}</b> · ${esc(mk.ref.curto)}`, mk.top.clone(), 30, 'marco c-' + mk.cor, mk.id));
  rot('hoje', 'hoje · ' + mesRot(M.mesHoje), V(P.hoje.x, .3, P.hoje.z), 40, 'hoje');
  rot('formacao', 'Tecnólogo em ADS · 2026', V(P.formacao.x + .45, 2.5, P.formacao.z), 35);
  function medirRotulos() { rotulos.forEach(r => { const i = r.el.firstChild; r.w = i.offsetWidth; r.h = i.offsetHeight; }); }
  medirRotulos();

  const legEl = document.getElementById('legenda-fig');
  const legsM = Array.from(document.querySelectorAll('.vitrine .leg-m'));
  const etq = document.getElementById('etiqueta');
  const etqB = etq.querySelector('b'), etqS = etq.querySelector('span'), etqE = etq.querySelector('em');

  // ---------- planos de câmera ----------
  // coordenadas esféricas em torno de um alvo: r (distância), th (azimute), ph (ângulo polar)
  // `fit`: a distância e o alvo são calculados para que o conjunto de pontos caiba inteiro
  // na área livre da cidade (à direita da coluna no desktop; dentro da vitrine no celular)
  const PL = {
    topo:        { t: V(-2, 0, 1),       r: 104, th: 0,    ph: .0008, fit: 'folha', m: [.97, .97, .97] },
    abertura:    { t: V(-1, 2.6, -2.5),  r: 80,  th: .5,   ph: 1.02,
                   mob: { t: V(1, 3.2, -4), r: 54, ph: .98 } },   // no celular a faixa é baixa: chega mais perto
    // rasante sobre o canto da folha: cabeçalhos A, B, C… e números de linha em primeiro plano
    perfil:      { t: V(-28.5, 0, -15.5), r: 39, th: -.2, ph: .74 },
    experiencia: { t: V(5, 1.2, 10.5),   r: 62,  th: 1.1,  ph: 1.12 },
    projetos:    { t: V(12.6, 4, -3.6),  r: 60,  th: .56,  ph: 1.06, fit: 'projetos', m: [.9, .74, .9] },
    habilidades: { t: V(-15.3, 2.4, -6.3), r: 40, th: .3,  ph: 1.04, fit: 'tecnologias', m: [.9, .8, .9] },
    formacao:    { t: V(21, 1.4, 11),    r: 30,  th: .98,  ph: 1.12 },
    contato:     { t: V(1, 0, 1),        r: 130, th: -.22, ph: .8,  fit: 'folha', m: [.97, .9, .95] },
    'marco:astcon':      { t: V(-12, 1, 11.5), r: 50, th: 1.2, ph: 1.14 },
    'marco:novo-mexico': { t: V(17.2, 1.4, 11.5), r: 28, th: .75, ph: 1.12 },
    'marco:grupo-zen':   { t: V(16, 2.5, 4),   r: 42, th: .32, ph: 1.05 },
  };
  // foco num prédio: testa vários azimutes e fica com o primeiro em que nenhum vizinho tapa a vista
  const rayF = new THREE.Raycaster();
  function calculaFoco(b) {
    const h = b.n ? b.n * FH : 1;
    const t = V(b.x, Math.max(1.2, h * .46), b.z);
    const r = h * 1.9 + (b.tipo === 'projeto' ? 22 : 16);
    const ph = 1.04;
    const base = b.tipo === 'projeto' ? .5 : .3;
    const cands = [0, .45, -.45, .9, -.9, 1.35, -1.35, 1.8, -1.8, 2.3, -2.3, 3].map(d => base + d);
    const outros = pegaveis.filter(m => m.userData.id !== b.id);
    outros.forEach(m => m.updateMatrixWorld());
    let melhor = null, menor = Infinity;
    for (const th of cands) {
      const sp = Math.sin(ph);
      const cam = V(t.x + r * sp * Math.sin(th), t.y + r * Math.cos(ph), t.z + r * sp * Math.cos(th));
      let hits = 0;
      const lado = V(Math.cos(th), 0, -Math.sin(th)).multiplyScalar(b.w * .5);
      [h * .12, h * .45, h * .8].forEach(y => [-1, 0, 1].forEach(l => {
        const o = V(b.x, y, b.z).addScaledVector(lado, l), dir = cam.clone().sub(o).normalize();
        o.addScaledVector(dir, b.w * .8);
        rayF.set(o, dir); rayF.far = cam.distanceTo(o);
        if (rayF.intersectObjects(outros, false).length) hits++;
      }));
      const custo = hits * 10 + Math.abs(th - base);
      if (custo < menor) { menor = custo; melhor = th; }
      if (hits === 0) break;
    }
    return { t, r, th: melhor, ph };
  }
  // pontos que precisam caber em cada enquadramento automático
  const PONTOS = (() => {
    const caixa = (l, extra) => {
      const p = [];
      l.forEach(b => {
        const h = (b.n ? b.n * FH + .3 : .9) + (b.antena ? extra : 0), a = b.w / 2 + .1;
        [[-a, -a], [a, -a], [a, a], [-a, a]].forEach(([dx, dz]) => { p.push(V(b.x + dx, 0, b.z + dz), V(b.x + dx, h, b.z + dz)); });
      });
      return p;
    };
    const f = [];
    [[P.X0, P.Z0], [-P.X0, P.Z0], [-P.X0, -P.Z0], [P.X0, -P.Z0]].forEach(([x, z]) => { f.push(V(x * 1.01, 0, z * 1.01), V(x * 1.01, -1.15, z * 1.01)); });
    return { folha: f, projetos: caixa(predios.filter(b => b.tipo === 'projeto'), 2.4), tecnologias: caixa(predios.filter(b => b.tipo === 'tecnologia'), 0) };
  })();
  const camF = new THREE.PerspectiveCamera(), vF = new THREE.Vector3(), dirF = new THREE.Vector3(), upF = new THREE.Vector3();
  // projeta os pontos no "retângulo da região" (-1..1) para um alvo, distância e ângulos dados
  function caixaProjetada(t, r, th, ph, pts, tanV, a) {
    const sp = Math.sin(ph);
    camF.position.set(t.x + r * sp * Math.sin(th), t.y + r * Math.cos(ph), t.z + r * sp * Math.cos(th));
    camF.lookAt(t); camF.updateMatrixWorld(); camF.matrixWorldInverse.copy(camF.matrixWorld).invert();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) {
      vF.copy(p).applyMatrix4(camF.matrixWorldInverse);
      if (vF.z > -.5) return null;
      const x = vF.x / -vF.z / (tanV * a), y = vF.y / -vF.z / tanV;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return { x0, x1, y0, y1 };
  }
  // menor distância em que tudo cabe, com o conjunto centrado na área útil (margens: lados, topo, base)
  function enquadra(k, pts, tanV, a) {
    const [mx, mt, mb] = k.m || [.92, .82, .92];
    const cabe = bb => bb && bb.x0 >= -mx && bb.x1 <= mx && bb.y1 <= mt && bb.y0 >= -mb;
    const t = k.t.clone();
    let r = k.r;
    for (let it = 0; it < 4; it++) {
      let lo = 4, hi = 800;
      for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (cabe(caixaProjetada(t, m, k.th, k.ph, pts, tanV, a))) hi = m; else lo = m; }
      r = hi;
      const bb = caixaProjetada(t, r, k.th, k.ph, pts, tanV, a);
      if (!bb) break;
      const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2 - (mt - mb) / 2;
      // desloca o alvo nos eixos da tela da câmera (direita e cima), à distância do alvo
      camF.matrixWorld.extractBasis(dirF, upF, vF);
      t.addScaledVector(dirF, cx * tanV * a * r).addScaledVector(upF, cy * tanV * r);
    }
    return { t, r: r * 1.001, th: k.th, ph: k.ph };
  }
  const tanDe = () => Math.tan(THREE.MathUtils.degToRad(APP.mobile ? 32 : 30) / 2);
  const aspDe = reg => (reg.x1 - reg.x0) / Math.max(60, reg.yc1 - reg.y0);
  let cacheFit = {};
  function planoDe(nome, reg) {
    let k = PL[nome];
    if (!k && nome && nome.startsWith('foco:')) {
      const b = porId[nome.slice(5)];
      if (b && b.tipo) k = b.planoFoco || (b.planoFoco = calculaFoco(b));
    }
    k = k || PL.abertura;
    if (APP.mobile && k.mob) k = Object.assign({}, k, k.mob, { mob: null });
    const a = aspDe(reg);
    if (k.fit) {
      const chave = nome + '|' + a.toFixed(2) + '|' + (APP.mobile ? 'm' : 'd');
      return cacheFit[chave] || (cacheFit[chave] = enquadra(k, PONTOS[k.fit], tanDe(), a));
    }
    // regiões mais estreitas que a do desktop (≈1,05) afastam a câmera para caber na largura
    const f = a < 1.05 ? Math.pow(1.05 / a, .85) : 1;
    return { t: k.t, r: k.r * f, th: k.th, ph: k.ph };
  }
  // o que acender em cada plano
  function focoDoPlano(nome) {
    if (!nome) return null;
    if (nome.startsWith('foco:') || nome.startsWith('marco:')) return nome.split(':')[1];
    return null;
  }
  function conjDoPlano(nome) {
    if (!nome) return [];
    if (nome.startsWith('foco:')) return ['foco'];
    if (nome.startsWith('marco:')) return ['marco', 'hoje', 'rel'];
    return ({ abertura: ['distrito'], perfil: [], contato: ['distrito'], experiencia: ['marco', 'hoje'], projetos: ['proj'], habilidades: ['tec'], formacao: ['formacao', 'hoje'] })[nome] || [];
  }

  // ---------- tamanho e região ----------
  // Uma "região" é o retângulo da tela onde a cidade aparece: à direita da coluna (desktop, acima da
  // legenda) ou uma vitrine (celular). A projeção é deslocada (lente descentrada, como setViewOffset)
  // para que o centro óptico fique no centro da região e a altura dela corresponda ao campo de visão.
  let W = innerWidth, H = innerHeight;
  function aplicaRegiao(reg) {
    const hR = Math.max(60, reg.yc1 - reg.y0);
    camera.aspect = W / H;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanDe() * H / hR));
    camera.updateProjectionMatrix();
    const e = camera.projectionMatrix.elements;
    e[8] = -((reg.x0 + reg.x1) / W - 1);
    e[9] = -(1 - (reg.y0 + reg.yc1) / H);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  function redimensiona() {
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H, false);
    cacheFit = {};
    predios.forEach(b => { b.planoFoco = null; });
    medirRotulos();
  }
  addEventListener('resize', () => { redimensiona(); acordar(); });
  redimensiona();

  // ---------- interação: hover (mouse) e toque ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let querPegar = false, hoverCidade = null, toque = null;
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  canvas.addEventListener('pointermove', e => {
    ndc.set(e.clientX / W * 2 - 1, -(e.clientY / H) * 2 + 1);
    if (e.pointerType === 'mouse') { querPegar = true; mouse.x = ndc.x; mouse.y = ndc.y; acordar(); }
  });
  canvas.addEventListener('pointerleave', () => { querPegar = false; defineHover(null); });
  canvas.addEventListener('pointerdown', e => { toque = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', e => {
    if (!toque) return;
    const parado = Math.hypot(e.clientX - toque.x, e.clientY - toque.y) < 8 && performance.now() - toque.t < 600;
    toque = null;
    if (!parado) return;
    ndc.set(e.clientX / W * 2 - 1, -(e.clientY / H) * 2 + 1);
    // no celular, cada vitrine tem a própria câmera: usa a da vitrine tocada
    if (APP.mobile) {
      const v = vistas.find(q => e.clientY >= q.reg.y0 && e.clientY <= q.reg.y1);
      if (!v) return;
      vista(v.k); aplicaRegiao(v.reg);
    }
    const id = pega();
    if (id) APP.irPara(id);
  });
  function pega() {
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pegaveis, false)[0];
    return hit ? hit.object.userData.id : null;
  }
  function defineHover(id) {
    if (hoverCidade === id) return;
    hoverCidade = id;
    canvas.classList.toggle('sobre', !!id);
    APP.aoPassar(id);
    if (!id) { etq.classList.remove('on'); return; }
    const o = M.porId[id], b = porId[id];
    etqB.textContent = o.tipo === 'carreira' ? o.empresa : o.nome;
    if (o.tipo === 'projeto') etqS.textContent = (b.n ? `${b.n} andares = ${b.n} tecnologias` : 'pavilhão · fora da matriz') + ' · ' + o.rotulo.toLowerCase();
    else if (o.tipo === 'tecnologia') etqS.textContent = `${o.total} ${o.total === 1 ? 'andar = 1 projeto' : `andares = ${o.total} projetos`}`;
    else etqS.textContent = `${mesRot(M.mes(o.inicio))} – ${o.fim ? mesRot(M.mes(o.fim)) : 'hoje'}`;
    etqE.textContent = o.tipo === 'projeto' ? 'clique para ver o projeto' : o.tipo === 'tecnologia' ? 'clique para ver na matriz' : 'clique para ver a experiência';
    etq.classList.add('on');
  }

  // ---------- laço ----------
  const o3 = new THREE.Object3D(), v3 = new THREE.Vector3();
  const cur = { t: V(), r: 0, th: 0, ph: 0 };
  const introPlano = !APP.plano || APP.plano === 'abertura';
  const INTRO = APP.captura || !introPlano ? 0 : 1;   // entrada completa só quando se chega pela abertura
  let t0 = 0, ultimo = 0, raf = 0, quadros = 0, construido = false, amostras = [], checouDesempenho = APP.captura;
  let ajusteDpr = 0, somaDt = 0, nDt = 0;
  // repouso: sem rolagem, mouse, hover nem câmera em movimento, desenha a ~20 fps (a deriva continua)
  let ativoAte = 0, emMovimento = true, ocioso = false;
  let vistas = [];   // câmeras usadas no último quadro, por região (o toque no celular usa a da vitrine)

  function acordar() {
    ativoAte = performance.now() + 2500;
    if (raf || APP.cv || document.hidden || !APP.visivel || !APP.usar3D) return;
    ultimo = performance.now();
    raf = requestAnimationFrame(quadro);
  }
  function parar() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  APP.acordar = acordar;
  document.addEventListener('visibilitychange', acordar);

  function vista(k) {
    const sp = Math.sin(k.ph);
    camera.position.set(k.t.x + k.r * sp * Math.sin(k.th), k.t.y + k.r * Math.cos(k.ph), k.t.z + k.r * sp * Math.cos(k.th));
    camera.lookAt(k.t);
  }
  function angDif(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

  // câmera de uma região num instante: plano + deriva + (celular) giro ligado à rolagem + entrada
  function camDaRegiao(reg, plano, tempoS, it) {
    const k = planoDe(plano, reg);
    // deriva lenta e limitada (a vista aérea balança um pouco mais), para o enquadramento continuar valendo
    const deriva = Math.sin(tempoS * .07) * (plano === 'contato' ? .06 : .03);
    let alvo;
    if (APP.mobile) {
      // a vitrine gira a cidade de leve conforme sobe pela tela (scrollytelling dentro da janela)
      const par = clamp(((reg.y0 + reg.y1) / 2 - H / 2) / H, -1, 1);
      alvo = { t: k.t, r: k.r, th: k.th + deriva + par * .32, ph: clamp(k.ph - par * .05, .02, 1.4) };
    } else {
      alvo = { t: k.t, r: k.r, th: k.th + deriva - mouse.sx * .05, ph: clamp(k.ph + mouse.sy * .025, .02, 1.4) };
    }
    if (INTRO && it < 5.2 && plano === 'abertura') {
      // entrada: a planilha vista de cima (a folha inteira enquadrada) → a câmera desce
      const topo = planoDe('topo', reg);
      const e = ease(clamp((it - 1) / 4));
      return { t: topo.t.clone().lerp(alvo.t, e), r: lerp(topo.r, alvo.r, e), th: topo.th + angDif(topo.th, alvo.th) * e, ph: lerp(topo.ph, alvo.ph, e), intro: true };
    }
    return alvo;
  }

  function quadro(agora) {
    raf = 0;
    if (APP.cv || document.hidden || !APP.visivel || !APP.usar3D) return;
    raf = requestAnimationFrame(quadro);
    const eraOcioso = ocioso;
    ocioso = construido && !emMovimento && !hoverCidade && agora > ativoAte;
    if (ocioso && agora - ultimo < 48) return;
    const medir = !ocioso && !eraOcioso;   // quadros vindos do repouso não entram nas medições
    if (!t0) t0 = agora;
    const bruto = Math.max(0, (agora - ultimo) / 1000), dt = Math.min(.1, bruto); ultimo = agora;
    quadros++;
    const tempoS = (agora - t0) / 1000;
    const it = INTRO ? tempoS : 99;

    // desempenho: se os primeiros quadros forem muito lentos, cai para a versão estática
    if (!checouDesempenho && quadros > 8 && bruto < .5 && medir) {
      amostras.push(bruto);
      if (amostras.length >= 45) {
        checouDesempenho = true;
        const med = amostras.slice().sort((a, b) => a - b)[amostras.length >> 1];
        if (med > .07) { APP.falhou('o 3D ficou lento neste aparelho'); parar(); renderer.dispose(); return; }
      }
    }
    // o estático entrou por tempo (rede lenta), mas o 3D chegou e está fluido: volta para o 3D
    if (checouDesempenho && APP.provisorio && APP.recuperar) APP.recuperar();
    // resolução adaptativa (nunca acima do DPR máximo)
    if (!APP.captura && quadros > 60 && bruto < .25 && medir) {
      somaDt += bruto; nDt++;
      if (nDt >= 90) {
        const med = somaDt / nDt; somaDt = 0; nDt = 0;
        if (med > .024 && dpr > 1) { dpr = Math.max(1, dpr - .25); renderer.setPixelRatio(dpr); redimensiona(); }
        else if (med < .013 && dpr < DPR_MAX && ++ajusteDpr > 2) { ajusteDpr = 0; dpr = Math.min(DPR_MAX, dpr + .25); renderer.setPixelRatio(dpr); redimensiona(); }
      }
    }

    // ---- câmeras por região ----
    const plano = APP.plano || 'abertura';
    mouse.sx = lerp(mouse.sx, mouse.x, 1 - Math.exp(-dt * 2));
    mouse.sy = lerp(mouse.sy, mouse.y, 1 - Math.exp(-dt * 2));
    const regs = APP.regioes ? APP.regioes() : [];
    vistas = [];
    emMovimento = Math.abs(mouse.sx - mouse.x) + Math.abs(mouse.sy - mouse.y) > .002;
    if (!APP.mobile && regs[0]) {
      // desktop: uma câmera só, com transição suave entre os planos
      const reg = regs[0];
      const alvo = camDaRegiao(reg, plano, tempoS, it);
      if (alvo.intro || APP.captura || quadros < 3) {
        cur.t.copy(alvo.t); cur.r = alvo.r; cur.th = alvo.th; cur.ph = alvo.ph;
        if (alvo.intro) emMovimento = true;
      } else {
        const a = 1 - Math.exp(-dt * 2.1);
        cur.t.lerp(alvo.t, a); cur.r = lerp(cur.r, alvo.r, a); cur.th += angDif(cur.th, alvo.th) * a; cur.ph = lerp(cur.ph, alvo.ph, a);
        if (cur.t.distanceTo(alvo.t) > .03 || Math.abs(cur.r - alvo.r) > .05 || Math.abs(angDif(cur.th, alvo.th)) > .004 || Math.abs(cur.ph - alvo.ph) > .002) emMovimento = true;
      }
      vistas.push({ reg, k: { t: cur.t.clone(), r: cur.r, th: cur.th, ph: cur.ph } });
    } else {
      // celular: cada vitrine visível tem a própria câmera, com o assunto centrado dentro dela.
      // A vitrine principal (mais visível) é desenhada por último e recebe os rótulos.
      for (let i = regs.length - 1; i >= 0; i--) {
        const k = camDaRegiao(regs[i], regs[i].plano, tempoS, it);
        if (k.intro) emMovimento = true;
        vistas.push({ reg: regs[i], k });
      }
    }

    // ---- construção andar por andar ----
    if (!construido) {
      let tudo = true;
      grupos.forEach(g => {
        g.andares.forEach((a, k) => {
          const s = clamp((it - a.b.delay - a.i * .065) / .42);
          if (s < 1) tudo = false;
          const e = easeOut(s);
          o3.position.set(a.b.x, a.i * FH, a.b.z); o3.rotation.set(0, 0, 0);
          if (s <= 0) o3.scale.set(0, 0, 0); else o3.scale.set(1, Math.max(.001, e), 1);
          o3.updateMatrix();
          g.lajes.setMatrixAt(k, o3.matrix); g.vidros.setMatrixAt(k, o3.matrix); g.pilares.setMatrixAt(k, o3.matrix);
        });
        g.lajes.instanceMatrix.needsUpdate = g.vidros.instanceMatrix.needsUpdate = g.pilares.instanceMatrix.needsUpdate = true;
      });
      cobs.forEach(c => {
        const b = c.b, s = easeOut(clamp((it - b.delay - b.n * .07) / .4));
        if (s < 1) tudo = false;
        if (c.kind === 'para') o3.position.set(b.x, b.n * FH, b.z), o3.scale.set(1, Math.max(.001, s), 1);
        else o3.position.set(b.x + c.ox, b.n * FH, b.z + c.oz), o3.scale.set(c.s * b.w / 3.2 * 1.1, Math.max(.001, s) * (b.tipo === 'projeto' ? 1 : .8), c.s * b.w / 3.2 * 1.1);
        if (s <= 0) o3.scale.set(0, 0, 0);
        o3.updateMatrix(); c.im.setMatrixAt(c.k, o3.matrix); c.im.instanceMatrix.needsUpdate = true;
      });
      pavs.forEach((b, k) => {
        const s = easeOut(clamp((it - b.delay) / .5));
        o3.position.set(b.x, 0, b.z); if (s <= 0) o3.scale.set(0, 0, 0); else o3.scale.set(1, Math.max(.001, s), 1); o3.updateMatrix();
        pavVid.im.setMatrixAt(k, o3.matrix); pavTeto.setMatrixAt(k, o3.matrix);
      });
      pavVid.im.instanceMatrix.needsUpdate = pavTeto.instanceMatrix.needsUpdate = true;
      aoItens.forEach((a, k) => {
        const s = a.cen ? clamp((it - 2.7) / 1.4) : clamp((it - a.b.delay) / .6);
        o3.position.set(a.x, 0, a.z); o3.scale.set(a.sx, 1, a.sz * Math.max(.001, s)); o3.scale.x = a.sx * Math.max(.001, s); o3.updateMatrix(); aoMesh.setMatrixAt(k, o3.matrix);
      });
      aoMesh.instanceMatrix.needsUpdate = true;
      const sc = easeOut(clamp((it - 2.7) / 1.4)); cenario.scale.y = Math.max(.001, sc); cenario.visible = sc > 0; if (sc < 1) tudo = false;
      const sa = easeOut(clamp((it - 3.3) / 1)); arv.scale.set(1, Math.max(.001, sa), 1); arv.visible = sa > 0; if (sa < 1) tudo = false;
      for (let m = 0; m <= M.mesHoje; m++) {
        const s = easeOut(clamp((it - 1.2 - m * .02) / .35));
        o3.position.set(P.AV.mx(m) + P.AV.mw / 2, 0, P.AV.z); o3.rotation.set(0, 0, 0); if (s <= 0) o3.scale.set(0, 0, 0); else o3.scale.set(1, Math.max(.001, s), 1); o3.updateMatrix(); ladrilhos.setMatrixAt(m, o3.matrix);
      }
      ladrilhos.instanceMatrix.needsUpdate = true;
      marcos.forEach((mk, i) => { const s = easeOut(clamp((it - 3 - i * .2) / .7)); mk.g.scale.y = Math.max(.001, s); mk.g.visible = s > 0; });
      { const s = easeOut(clamp((it - 3.2) / .7)); formG.scale.y = Math.max(.001, s); formG.visible = s > 0; }
      antenas.forEach(a => { const s = easeOut(clamp((it - a.b.delay - a.b.n * .07 - .3) / .5)); a.g.scale.setScalar(Math.max(.001, s)); a.g.visible = s > 0; });
      hojeAnel.visible = it > 2.6;
      numeros.forEach(nm => { const s = clamp((it - nm.b.delay + .1) / .45); nm.m.material.opacity = 1 - s; nm.m.visible = s < 1; });
      if (tudo && it > 4) construido = true;
    }

    // ---- destaque (hover da cidade, hover/foco do HTML, plano atual) ----
    const focoPl = focoDoPlano(plano);
    const ativo = hoverCidade || APP.hover || focoPl;
    const rel = ativo ? M.relacionados(ativo) : null;
    let mudouInfo = false;
    predios.forEach(b => {
      const alvoG = !ativo ? 0 : b.id === ativo ? 1 : rel.has(b.id) ? .38 : 0;
      const g = lerp(b.glow, alvoG, 1 - Math.exp(-dt * 9));
      if (Math.abs(g - b.glow) > .002 || (alvoG === 0 && b.glow !== 0 && g < .003)) { b.glow = g < .003 && alvoG === 0 ? 0 : g; mudouInfo = true; }
      const op = b.glow * .95;
      b.sel.material.opacity = op; b.sel.visible = op > .01;
    });
    if (mudouInfo) {
      grupos.forEach(g => { g.andares.forEach((a, k) => g.aInfo.setX(k, a.b.glow)); g.aInfo.needsUpdate = true; });
      pavs.forEach((b, k) => pavVid.a.setX(k, b.glow)); pavVid.a.needsUpdate = true;
    }
    marcos.forEach(mk => {
      const alvoG = !ativo ? 0 : mk.id === ativo || rel.has(mk.id) ? 1 : 0;
      mk.glow = lerp(mk.glow, alvoG, 1 - Math.exp(-dt * 8));
      mk.bm.emissiveIntensity = mk.glow * .8;
    });
    antenas.forEach(a => { const bl = Math.pow(.5 + .5 * Math.sin(tempoS * 4 + a.fase), 5); a.luzM.color.set(COR.verde).multiplyScalar(.45 + bl * 1.1); });
    const pul = (tempoS * .6) % 1; hojeAnel.scale.setScalar(1 + pul * .9); hojeAnel.material.opacity = (1 - pul) * .9;

    if (mudouInfo) emMovimento = true;

    // ---- desenho: uma passada por região (no celular, recortada na vitrine) ----
    if (!vistas.length) return;
    const tesoura = APP.mobile;
    renderer.setScissorTest(tesoura);
    if (tesoura) { renderer.setScissor(0, 0, W, H); renderer.clear(); }
    for (const v of vistas) {
      vista(v.k); aplicaRegiao(v.reg);
      ceu.position.copy(camera.position);
      if (tesoura) {
        const y0 = Math.max(0, Math.floor(v.reg.y0)), y1 = Math.min(H, Math.ceil(v.reg.y1));
        if (y1 - y0 < 1) continue;
        renderer.setScissor(0, H - y1, W, y1 - y0);
      }
      renderer.render(scene, camera);
    }
    renderer.setScissorTest(false);
    // daqui em diante a câmera é a da região principal (a última desenhada)
    const principal = vistas[vistas.length - 1].reg;
    const planoRot = principal.plano || plano;

    // ---- hover do mouse (raycast só quando o mouse mexe) ----
    if (querPegar && !APP.mobile) { querPegar = false; defineHover(pega()); }

    // ---- rótulos: só na região principal, dentro dela, sem colisão e sem prédio na frente ----
    const conj = conjDoPlano(planoRot);
    const focoRot = focoDoPlano(planoRot);
    const aceitos = [];
    if (APP.mobile) legsM.forEach(el => { const r = el.getBoundingClientRect(); if (r.bottom > 0 && r.top < H) aceitos.push([r.left - 4, r.top - 4, r.right + 4, r.bottom + 4]); });
    const xMin = principal.x0 + 8, xMax = principal.x1 - 6;
    const yMin = Math.max(principal.y0, APP.topoPx) + 6, yMax = Math.min(principal.yc1, H) - 6;
    const cand = rotulos.filter(r => {
      if (hoverCidade && r.id === hoverCidade) return false;
      if (it < 4.6) return false;
      if (conj.includes(r.conj)) return true;
      if (conj.includes('foco') && r.id && r.id === focoRot) return true;
      if (conj.includes('rel') && r.id && rel && rel.has(r.id) && r.conj === 'proj') return true;
      if (APP.hover && r.id === APP.hover && !hoverCidade) return true;
      return false;
    }).sort((a, b) => b.prio - a.prio);
    const mostrar = new Set();
    cand.forEach(r => {
      v3.copy(r.pos).project(camera);
      if (v3.z > 1) return;
      const px = (v3.x * .5 + .5) * W, py = (-v3.y * .5 + .5) * H;
      const dist = r.conj === 'distrito' ? 0 : 16;
      const rect = [px - r.w / 2 - 3, py - dist - r.h - 3, px + r.w / 2 + 3, py - dist + 3];
      if (r.conj === 'distrito') { rect[1] = py - r.h / 2 - 3; rect[3] = py + r.h / 2 + 3; }
      if (rect[0] < xMin || rect[2] > xMax || rect[1] < yMin || rect[3] > yMax) return;
      if (aceitos.some(a => rect[0] < a[2] && rect[2] > a[0] && rect[1] < a[3] && rect[3] > a[1])) return;
      if (ocluido(r)) return;
      aceitos.push(rect); mostrar.add(r);
      r.el.style.transform = `translate3d(${px.toFixed(1)}px,${py.toFixed(1)}px,0)`;
    });
    rotulos.forEach(r => { const on = mostrar.has(r); if (on !== r.on) { r.on = on; r.el.classList.toggle('on', on); } });

    if (hoverCidade) {
      const b = porId[hoverCidade];
      v3.copy(b.top).add(V(0, .4, 0)).project(camera);
      const px = clamp((v3.x * .5 + .5) * W, xMin + 130, W - 140), py = Math.max(APP.topoPx + 110, (-v3.y * .5 + .5) * H);
      etq.style.transform = `translate3d(${px.toFixed(1)}px,${py.toFixed(1)}px,0)`;
    }

    if (!APP.cidadeOk) { APP.cidadeOk = true; document.documentElement.classList.add('cidade-ok'); }
  }

  // algum prédio (que não seja o do próprio rótulo) está entre a câmera e o ponto do rótulo?
  const rayR = new THREE.Raycaster(), dirR = new THREE.Vector3();
  function ocluido(r) {
    dirR.copy(r.pos).sub(camera.position);
    const d = dirR.length(); dirR.divideScalar(d);
    rayR.set(camera.position, dirR); rayR.far = d - .4;
    return rayR.intersectObjects(pegaveis, false).some(h => h.object.userData.id !== r.id);
  }

  window.CIDADE = { scene, camera, renderer };
  acordar();
}
})();
