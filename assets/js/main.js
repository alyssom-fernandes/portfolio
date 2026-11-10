/* Movimento do portfólio. Todo o conteúdo já vem no HTML; este arquivo só liga a rolagem aos estados.
   Regra: todo efeito é contínuo (o progresso da rolagem vira um valor interpolado), só transform e
   opacity mudam por quadro, e cada estilo só é escrito quando o valor muda.

   Capturar um estado sem rolar: ?cena=<id>&progresso=<0..1>
   ids: abertura, trajetoria, projetos, artmaker, unifydata, deepchat, praxis, flowtrack, audistock,
        fuelmind, alertsignal, docke, habilidades, contato */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const f3 = v => (+v).toFixed(3);
const memo = new WeakMap();
function set(el, prop, val) {
  if (!el) return;
  let m = memo.get(el); if (!m) { m = {}; memo.set(el, m); }
  if (m[prop] === val) return;
  m[prop] = val;
  if (prop[0] === '-') el.style.setProperty(prop, val); else el.style[prop] = val;
}
const root = document.documentElement;

// aberto direto do disco (file://), o navegador precisa do index.html nos links de pasta
if (location.protocol === 'file:') $$('a[href$="/"]').forEach(a => { if (!/^https?:/.test(a.getAttribute('href'))) a.href = a.getAttribute('href') + 'index.html'; });
if (!document.body.classList.contains('inicio')) return;

const mq = matchMedia('(max-width:760px)');
const mob = () => mq.matches;
const mast = $('#mast');
let MH = mast.offsetHeight;
const cfg = JSON.parse($('#dados-cena').textContent);

/* ---------- abertura: a grade de planilha some na primeira metade da rolagem ---------- */
const hero = $('#topo');
const renderHero = p => set(hero, '--g', f3(1 - smooth(0, .5, p)));

/* ---------- trajetória: a grade de meses enche em onda ---------- */
const traj = $('#trajetoria');
const FASES = cfg.fases, ultima = FASES[FASES.length - 1];
const cels = $$('.cel[data-f]', traj).map(el => ({ el, fs: el.dataset.f.split(' '), i: el.firstElementChild }));
const daFase = Object.fromEntries(FASES.map(f => [f, cels.filter(c => c.fs[c.fs.length - 1] === f)]));
const WIN = [[.06, .42], [.44, .56], [.60, .74]];
const passos = $$('.t-passo', traj);
const STEPR = [[0, .43], [.43, .58], [.58, .78], [.78, 1]];
const cnt = $('#cnt'), cntN = $('#cntN'), virada = $('#virada'), tFig = $('#tFig'), traco = $('.t-traco', traj);
const lgN = Object.fromEntries(FASES.map(f => [f, $(`.legenda [data-ph="${f}"] .lg-n`, traj)]));
const celHoje = $('.cel.hoje', traj);
const plural = n => `${n} ${n === 1 ? cfg.mes : cfg.meses}`;
let ultimoTotal = -1, posVirada = null;
function medirVirada() {
  const zc = daFase[ultima][0];
  if (!zc) return;
  const g = tFig.getBoundingClientRect(), r = zc.el.getBoundingClientRect();
  posVirada = { top: r.bottom - g.top + 8, left: r.left - g.left };
}
function renderTraj(p) {
  let total = 0;
  const cont = Object.fromEntries(FASES.map(f => [f, 0]));
  FASES.forEach((f, j) => {
    const [a, b] = WIN[j] || [0, 1], lista = daFase[f], n = lista.length, ONDA = 6;
    const x = clamp((p - a) / (b - a)) * (n + ONDA);
    lista.forEach((c, k) => {
      const v = clamp((x - k) / ONDA), e = v * v * (3 - 2 * v);
      set(c.i, 'opacity', f3(e));
      set(c.i, 'transform', `scale(${f3(lerp(.3, 1, e))})`);
      if (v > .5) { total++; c.fs.forEach(q => cont[q]++); if (c.el === celHoje) celHoje.classList.add('ativo'); }
      else if (c.el === celHoje) celHoje.classList.remove('ativo');
    });
  });
  if (total !== ultimoTotal) {
    ultimoTotal = total;
    cntN.textContent = total;
    FASES.forEach(f => { lgN[f].textContent = cont[f] ? plural(cont[f]) : ''; });
  }
  // o contador só aparece quando o primeiro mês enche: nunca fica em 0 na tela
  set(cnt, 'opacity', f3(smooth(.05, .09, p)));
  if (posVirada) {
    const k = smooth(.66, .76, p);
    set(virada, 'transform', `translate3d(${posVirada.left.toFixed(1)}px, ${(posVirada.top + lerp(10, 0, k)).toFixed(1)}px, 0)`);
    set(virada, 'opacity', f3(k));
  }
  set(traco, '--tp', f3(p));
  passos.forEach((s, j) => {
    const [a, b] = STEPR[j];
    const v = (j === 0 ? 1 : smooth(a, a + .04, p)) * (j === passos.length - 1 ? 1 : 1 - smooth(b - .04, b, p));
    set(s, 'opacity', f3(v));
    set(s, 'visibility', v < .02 ? 'hidden' : 'visible');
  });
}
// a figura precisa caber na altura da cena fixa
const tFixo = tFig.parentNode;
function ajustarFig() {
  tFig.style.width = '';
  const emp = mob(), anos = cels.length ? Math.ceil($$('.ano', traj).length) : 6;
  const disp = emp ? tFixo.clientHeight * .58 : tFixo.clientHeight - parseFloat(getComputedStyle(tFixo).paddingTop) - 40;
  for (let k = 0; k < 6; k++) {
    const h = tFig.offsetHeight;
    if (h <= disp) break;
    const w = tFig.getBoundingClientRect().width;
    tFig.style.width = Math.max(220, w * (disp / h) - 4) + 'px';
  }
  medirVirada();
}

/* ---------- introdução dos projetos: a cortina escura sobe ---------- */
const intro = $('#projetos-cena');
const cortinaIntro = p => smooth(.06, .58, p);
function renderIntro(p) {
  set(intro, '--c', f3(cortinaIntro(p)));
  set(intro, '--fo', f3(1 - smooth(.56, .66, p)));
  set(intro, '--fi', f3(smooth(.62, .76, p)));
}

/* ---------- contato: a cortina de papel volta ---------- */
const contato = $('#contato-cena');
const cortinaContato = p => smooth(0, .55, p);
function renderContato(p) {
  set(contato, '--cc', f3(cortinaContato(p)));
  set(contato, '--s', f3(smooth(.55, .9, p)));
}
/* o cabeçalho escurece quando a cortina passa por ele, e clareia na volta */
function renderMast(ci, cc, vh = innerHeight) {
  const hi = clamp((MH - vh * (1 - ci)) / MH), hc = clamp((MH - vh * (1 - cc)) / MH);
  // a troca do cabeçalho acontece no meio da passagem da borda, para ele não ficar cinza parado
  set(mast, '--d', f3(smooth(.3, .7, hi) * (1 - smooth(.3, .7, hc))));
}

/* ---------- os nove projetos ---------- */
const BAR = 29;
const KF = 780 / 1688 * .96;  // largura do celular por altura da janela
const projs = $$('[data-proj]').map(sec => {
  const lis = $$('.destaques li', sec);
  const telas = lis.map(li => li.dataset.tela);
  const imgs = $$('.j-tela img', sec);
  return {
    sec, id: sec.dataset.cena, fixo: $('.fixo', sec), cab: $('.p-cab', sec), corpo: $('.p-corpo', sec), palco: $('.palco', sec),
    grupo: $('.grupo', sec), janela: $('.janela', sec), cel: $('.celular', sec), imgs, lis, telas, descs: $$('.descs p', sec),
    imgIdx: imgs.map(i => telas.indexOf(i.dataset.k)), iCel: telas.indexOf('celular'),
    modo: sec.classList.contains('cel-sempre') ? 'sempre' : sec.classList.contains('cel-destaque') ? 'destaque' : null,
    sinal: sec.classList.contains('lado-esq') ? -1 : 1, ar: parseFloat(sec.style.getPropertyValue('--ar')) || 1.6, span: 1
  };
});
function medirProj(P) {
  if (mob()) {
    P.t0 = P.cab.offsetTop + P.cab.offsetHeight + parseFloat(getComputedStyle(P.corpo).marginTop);
    P.span = Math.max(1, parseFloat(getComputedStyle(P.fixo, '::after').height) || 0);
    set(P.sec, '--jw', '100%');
    return;
  }
  const W = P.palco.clientWidth, H = P.palco.clientHeight;
  const jw0 = Math.max(240, Math.min(W, (H - BAR) * P.ar));
  const G = Math.max(20, W * .035);
  // produto de celular: o telefone fica na frente, 20% mais alto que a janela
  const kf = KF * (P.modo === 'sempre' ? 1.2 : 1);
  const jw1 = Math.min(jw0, (W - G - kf * BAR) / (1 + kf / P.ar));
  const hw1 = jw1 / P.ar + BAR;
  Object.assign(P, { W, H, G, jw0, jw1, cw: Math.min(kf * hw1, (H - 4) * 780 / 1688) });
  set(P.sec, '--jw', (P.modo === 'sempre' ? jw1 : jw0).toFixed(1) + 'px');
  set(P.sec, '--cw', P.cw.toFixed(1) + 'px');
}
// pesos dos destaques: cada troca se espalha por cerca de 200 px de rolagem
function pesos(n, p, spanPx) {
  const w = clamp(200 / Math.max(1, spanPx), .12, .42);
  const cs = n === 2 ? [.5] : Array.from({ length: n - 1 }, (_, j) => lerp(.24, .76, j / (n - 2)));
  const b = cs.map(c => smooth(c - w / 2, c + w / 2, p));
  return { b, v: Array.from({ length: n }, (_, j) => (j ? b[j - 1] : 1) * (j < n - 1 ? 1 - b[j] : 1)) };
}
function renderProj(P, p, e = 1, spanPx = P.span) {
  if (e > 0 && !P.decod) {
    P.decod = true;
    [...P.imgs, ...(P.cel ? [$('img', P.cel)] : [])].forEach(i => { i.loading = 'eager'; if (i.decode) i.decode().catch(() => {}); });
  }
  const m = mob(), n = P.lis.length;
  const { b, v } = pesos(n, p, spanPx);
  P.imgs.forEach((img, k) => { const it = P.imgIdx[k]; set(img, 'opacity', it <= 0 ? '1' : f3(b[it - 1])); });
  P.lis.forEach((li, j) => {
    set(li, 'opacity', f3(m ? smooth(.45, .8, v[j]) : .5 + .5 * v[j]));
    set(li, '--a', f3(v[j]));
    set(P.descs[j], 'opacity', f3(smooth(.55, .9, v[j])));
  });
  const k = P.iCel >= 0 ? v[P.iCel] : 0;
  const entra = smooth(.25, 1, e);
  if (m) {
    set(P.janela, 'transform', 'none');
    set(P.janela, 'opacity', f3(1 - .72 * k));
    if (P.cel) {
      set(P.cel, 'opacity', f3(k));
      set(P.cel, 'transform', `translate3d(-50%, ${lerp(8, 0, k).toFixed(2)}%, 0) rotate(${lerp(-4, 0, k).toFixed(2)}deg)`);
    }
    return;
  }
  set(P.grupo, 'transform', `translate3d(0, ${lerp(34, 0, entra).toFixed(1)}px, 0)`);
  const s = P.sinal;
  if (P.modo === 'sempre') {
    // telefone e janela lado a lado, centrados; no destaque do celular ele sobe ao palco
    const off = Math.max(0, (P.W - (P.jw1 + P.G + P.cw)) / 2);
    set(P.janela, 'transform', `translate3d(${(s * off).toFixed(1)}px, -50%, 0)`);
    set(P.janela, 'opacity', f3(1 - .6 * k));
    set(P.cel, 'opacity', '1');
    set(P.cel, 'transform', `translate3d(${(-s * off).toFixed(1)}px, -50%, 0) scale(${f3(1 + .045 * k)})`);
    return;
  }
  const off0 = (P.W - P.jw0) / 2;
  if (P.modo === 'destaque') {
    // o telefone entra pelo lado de fora; a janela encolhe para o lado da ficha e abre espaço
    const sc = lerp(1, P.jw1 / P.jw0, k);
    const off1 = Math.max(0, (P.W - (P.jw1 + P.G + P.cw)) / 2);
    set(P.janela, 'transform', `translate3d(${(s * lerp(off0, off1, k)).toFixed(1)}px, -50%, 0) scale(${f3(sc)})`);
    set(P.janela, 'opacity', '1');
    set(P.cel, 'opacity', f3(k));
    set(P.cel, 'transform', `translate3d(${(-s * off1 + s * lerp(14, 0, k) * P.cw / 100).toFixed(1)}px, calc(-50% + ${lerp(6, 0, k).toFixed(1)}%), 0) rotate(${(s * lerp(4, 0, k)).toFixed(2)}deg)`);
    return;
  }
  set(P.janela, 'transform', `translate3d(${(s * off0).toFixed(1)}px, -50%, 0)`);
}
function medirTudo() {
  MH = mast.offsetHeight;
  projs.forEach(medirProj);
  ajustarFig();
}

/* ---------- foco do teclado no índice: leva a cortina até o fim ---------- */
intro.addEventListener('focusin', () => {
  const r = intro.getBoundingClientRect(), span = r.height - innerHeight;
  if (span > 0 && -r.top / span < .78) scrollTo(0, scrollY + r.top + span * .8);
});

/* ---------- modo captura ---------- */
const qs = new URLSearchParams(location.search);
const cena = qs.get('cena');
if (cena) {
  const p = qs.has('progresso') ? clamp(parseFloat(qs.get('progresso')) || 0) : 1;
  root.classList.add('cap');
  const secs = $$('[data-cena]'), idx = secs.findIndex(s => s.dataset.cena === cena);
  const pos = id => secs.findIndex(s => s.dataset.cena === id);
  secs.forEach((s, i) => { if (i < idx) s.classList.add('off'); });
  $$('img[loading="lazy"]').forEach(im => { im.loading = 'eager'; });
  const Pc = projs.find(P => P.id === cena);
  const draw = () => {
    medirTudo();
    renderHero(cena === 'abertura' ? p : 1);
    renderTraj(cena === 'trajetoria' ? p : idx > pos('trajetoria') ? 1 : 0);
    const ci = cena === 'projetos' ? cortinaIntro(p) : idx > pos('projetos') ? 1 : 0;
    renderIntro(cena === 'projetos' ? p : idx > pos('projetos') ? 1 : 0);
    renderContato(cena === 'contato' ? p : 0);
    projs.forEach(P => renderProj(P, P === Pc ? p : 0, 1, mob() ? P.span : innerHeight * .6));
    renderMast(ci, cena === 'contato' ? cortinaContato(p) : 0, innerHeight);
    if (Pc && mob()) scrollTo(0, Pc.corpo.getBoundingClientRect().top + scrollY - MH);
    else scrollTo(0, 0);
  };
  draw();
  addEventListener('resize', draw); addEventListener('load', draw);
  if (document.fonts) document.fonts.ready.then(draw);
  return;
}

/* ---------- rolagem ---------- */
let fila = false;
const progFixo = r => { const span = r.height - innerHeight; return span > 0 ? clamp(-r.top / span) : 0; };
function quadro() {
  fila = false;
  const vh = innerHeight, m = mob();
  // 1) leituras
  const hr = hero.getBoundingClientRect(), tr = traj.getBoundingClientRect(), ir = intro.getBoundingClientRect(), cr = contato.getBoundingClientRect();
  const pr = projs.map(P => P.sec.getBoundingClientRect());
  // 2) escritas
  if (hr.bottom > 0) renderHero(clamp(-hr.top / Math.max(1, hr.height)));
  if (tr.top < vh && tr.bottom > 0) renderTraj(progFixo(tr));
  const pI = ir.top < vh ? progFixo(ir) : 0;
  if (ir.top < vh && ir.bottom > 0) renderIntro(pI);
  const pC = cr.top < vh ? progFixo(cr) : 0;
  if (cr.top < vh && cr.bottom > 0) renderContato(pC);
  renderMast(cortinaIntro(pI), cortinaContato(pC), vh);
  projs.forEach((P, i) => {
    const r = pr[i];
    if (r.top > vh * 1.6 || r.bottom < -vh * .6) return;
    if (m) {
      const topo = r.top + P.t0;
      renderProj(P, clamp((MH - topo) / P.span), 1, P.span);
    } else {
      const span = r.height - vh;
      renderProj(P, span > 0 ? clamp(-r.top / span) : 0, clamp((vh - r.top) / vh), span);
    }
  });
}
const pedir = () => { if (!fila) { fila = true; requestAnimationFrame(quadro); } };
addEventListener('scroll', pedir, { passive: true });
addEventListener('resize', () => { medirTudo(); pedir(); });
mq.addEventListener('change', () => { medirTudo(); pedir(); });
medirTudo();
projs.forEach(P => renderProj(P, 0, 0, P.span));
quadro();
if (document.fonts) document.fonts.ready.then(() => { medirTudo(); pedir(); });
addEventListener('load', () => { medirTudo(); pedir(); });
})();
