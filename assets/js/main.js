/* Movimento do portfólio. Todo o conteúdo já vem no HTML; este arquivo só liga a rolagem aos estados.
   Regra: todo efeito é contínuo (o progresso da rolagem vira um valor interpolado), só transform e
   opacity mudam por quadro, e cada estilo só é escrito quando o valor muda.

   Capturar um estado sem rolar: ?cena=<id>&progresso=<0..1>
   ids: abertura, trajetoria, projetos (a cortina), habilidades, contato. Os projetos ficam numa grade de cartões, sem cena própria. */
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
// a grade sai do gerador até o mês da publicação; aqui entram, na fase em andamento, os meses que passaram desde então
// (para testar outro mês: ?hoje=AAAA-MM)
(() => {
  const sim = (new URLSearchParams(location.search).get('hoje') || '').match(/^(\d{4})-(\d{2})$/);
  const d = new Date(), agora = sim ? +sim[1] * 12 + (+sim[2] - 1) : d.getFullYear() * 12 + d.getMonth();
  if (!cfg.aberta || !(agora > cfg.hoje)) return;
  const grade = $('#gradeM', traj), anos = $$('.ano', grade);
  const y0 = +anos[0].textContent, yN = +anos[anos.length - 1].textContent;
  for (let y = yN + 1; y <= Math.floor(agora / 12); y++)
    grade.insertAdjacentHTML('beforeend', `<span class="ax ano">${y}</span>` + '<span class="cel fut"></span>'.repeat(12));
  const cs = $$('.cel', grade), velha = $('.cel.hoje', grade);
  if (velha) velha.classList.remove('hoje');
  for (let i = cfg.hoje + 1; i <= agora; i++) {
    const c = cs[(Math.floor(i / 12) - y0) * 12 + (i % 12)];
    if (!c) continue;
    c.className = 'cel' + (i === agora ? ' hoje' : '');
    c.dataset.f = cfg.aberta.id;
    c.innerHTML = `<i style="background:${cfg.aberta.cor}"></i>`;
  }
  const n = $('#cntN', traj);
  if (n) n.textContent = $$('.cel[data-f]', grade).length;
})();
const cels =$$('.cel[data-f]', traj).map(el => ({ el, fs: el.dataset.f.split(' '), i: el.firstElementChild }));
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
  // a etiqueta fica logo abaixo da última linha da grade, na coluna do primeiro mês da virada
  // (quando os meses novos abrem uma linha, ela não cobre os quadrados)
  const g = tFig.getBoundingClientRect(), r = zc.el.getBoundingClientRect(), gr = $('#gradeM', traj).getBoundingClientRect();
  posVirada = { top: gr.bottom - g.top + 8, left: r.left - g.left };
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
  traj.classList.remove('compacto', 'sem-extra', 'mini');
  let disp;
  if (mob()) {
    // no celular a figura fica em cima e o texto embaixo. Se o passo mais longo não couber, o texto fica compacto;
    // se ainda não couber, sai o complemento; por último, a figura encolhe
    const cs = getComputedStyle(tFixo);
    const sobra = () => {
      const topo = tFig.getBoundingClientRect().top - tFixo.getBoundingClientRect().top;
      return tFixo.clientHeight - parseFloat(cs.paddingBottom) - topo - tFig.offsetHeight - (parseFloat(cs.rowGap) || 20)
        - Math.max(...passos.map(s => s.offsetHeight));
    };
    if (sobra() < 0) traj.classList.add('compacto');
    if (sobra() < 0) traj.classList.add('sem-extra');
    if (sobra() < 0) traj.classList.add('mini');
    disp = Math.min(tFixo.clientHeight * .58, tFig.offsetHeight + Math.min(0, sobra()));
  } else disp = tFixo.clientHeight - parseFloat(getComputedStyle(tFixo).paddingTop) - 40;
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
// a tela escura sobe e a frase inverte de cor; o título e os cartões vêm logo depois, no fluxo normal
const cortinaIntro = p => smooth(.04, .8, p);
function renderIntro(p) {
  set(intro, '--c', f3(cortinaIntro(p)));
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

function medirTudo() {
  MH = mast.offsetHeight;
  ajustarFig();
}

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
  const draw = () => {
    medirTudo();
    renderHero(cena === 'abertura' ? p : 1);
    renderTraj(cena === 'trajetoria' ? p : idx > pos('trajetoria') ? 1 : 0);
    const ci = cena === 'projetos' ? cortinaIntro(p) : idx > pos('projetos') ? 1 : 0;
    renderIntro(cena === 'projetos' ? p : idx > pos('projetos') ? 1 : 0);
    renderContato(cena === 'contato' ? p : 0);
    renderMast(ci, cena === 'contato' ? cortinaContato(p) : 0, innerHeight);
    scrollTo(0, 0);
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
  const vh = innerHeight;
  // 1) leituras
  const hr = hero.getBoundingClientRect(), tr = traj.getBoundingClientRect(), ir = intro.getBoundingClientRect(), cr = contato.getBoundingClientRect();
  // 2) escritas
  if (hr.bottom > 0) renderHero(clamp(-hr.top / Math.max(1, hr.height)));
  if (tr.top < vh && tr.bottom > 0) renderTraj(progFixo(tr));
  const pI = ir.top < vh ? progFixo(ir) : 0;
  if (ir.top < vh && ir.bottom > 0) renderIntro(pI);
  const pC = cr.top < vh ? progFixo(cr) : 0;
  if (cr.top < vh && cr.bottom > 0) renderContato(pC);
  renderMast(cortinaIntro(pI), cortinaContato(pC), vh);
}
const pedir = () => { if (!fila) { fila = true; requestAnimationFrame(quadro); } };
addEventListener('scroll', pedir, { passive: true });
addEventListener('resize', () => { medirTudo(); pedir(); });
mq.addEventListener('change', () => { medirTudo(); pedir(); });
medirTudo();
quadro();
if (document.fonts) document.fonts.ready.then(() => { medirTudo(); pedir(); });
addEventListener('load', () => { medirTudo(); pedir(); });
})();
