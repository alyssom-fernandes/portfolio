/* Movimento do portfólio. Todo o conteúdo já vem no HTML; este arquivo só liga a rolagem aos estados.
   Regra: todo efeito é contínuo (o progresso da rolagem vira um valor interpolado), só transform e
   opacity mudam por quadro, e cada estilo só é escrito quando o valor muda.

   Capturar um estado sem rolar: ?cena=<id>&progresso=<0..1>
   ids: abertura, trajetoria, projetos (a cortina), habilidades, contato. Os projetos ficam numa grade de cartões, sem cena própria.
   Fora das cenas fixas, a entrada de cada elemento depende só da posição dele na tela (títulos por linha, textos de apoio,
   cartões que saem da planilha, matriz): voltar a rolagem desfaz o efeito, e uma âncora já chega no estado final. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const rampa = (a, b, v) => clamp((v - a) / (b - a));
const smooth = (a, b, v) => { const t = rampa(a, b, v); return t * t * (3 - 2 * t); };
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
// menu "Seções" (até 900 px): fecha ao escolher uma seção, com Esc e ao tocar fora, em todas as páginas
const menu = $('.mast-menu');
if (menu) {
  const sum = $('summary', menu);
  menu.addEventListener('click', e => { if (e.target.closest('a')) menu.open = false; });
  menu.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.open) { menu.open = false; sum.focus(); } });
  document.addEventListener('click', e => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
}
if (!document.body.classList.contains('inicio')) return;

const mq = matchMedia('(max-width:760px)');
const mob = () => mq.matches;
const mast = $('#mast');
let MH = mast.offsetHeight;
const cfg = JSON.parse($('#dados-cena').textContent);

/* ---------- títulos que entram por linha: cada palavra numa máscara, a linha sobe inteira ---------- */
// as palavras ficam em <span class="pm"><span class="pi">; as linhas são medidas no layout real (mudam com a largura)
function dividir(el) {
  const ws = [];
  const anda = no => {
    for (const n of [...no.childNodes]) {
      if (n.nodeType === 1) { anda(n); continue; }
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const frag = document.createDocumentFragment();
      // só o espaço comum separa: o espaço fixo (nbsp) mantém as palavras juntas, como no texto original
      for (const s of n.textContent.split(/([ \n\t]+)/)) {
        if (!s) continue;
        if (/^[ \n\t]+$/.test(s)) { frag.append(' '); continue; }
        const o = document.createElement('span'), i = document.createElement('span');
        o.className = 'pm'; i.className = 'pi'; i.textContent = s;
        o.append(i); frag.append(o); ws.push({ o, i });
      }
      n.replaceWith(frag);
    }
  };
  anda(el);
  el.classList.add('dividido');
  return { el, ws, linhas: [] };
}
function agrupar(t) {
  t.linhas = [];
  let ult = -1e9;
  t.ws.forEach(w => {
    const y = w.o.getBoundingClientRect().top;
    if (y > ult + 4) { t.linhas.push([]); ult = y; }
    t.linhas[t.linhas.length - 1].push(w.i);
  });
}
// k = 0 (escondido) a 1 (no lugar); as linhas se seguem com um pequeno atraso, sempre dentro do mesmo k
function revelar(t, k) {
  const n = t.linhas.length;
  if (!n) return;
  const d = Math.min(.16, .45 / n), w = 1 - d * (n - 1);
  t.linhas.forEach((ln, j) => {
    const e = smooth(j * d, j * d + w, k);
    const v = e > .999 ? 'none' : `translate3d(0, calc(${f3(1 - e)} * (100% + .5em)), 0) rotate(${f3((1 - e) * 3)}deg)`;
    ln.forEach(i => set(i, 'transform', v));
  });
}
// posição na tela → progresso da entrada (o mesmo ritmo em todas as seções)
const kTitulo = (top, vh) => rampa(vh * .95, vh * .7, top);
const kSobe = (top, vh) => rampa(vh * .97, vh * .74, top);
const titulos = $$('.fecho, .gp-cab h2, .hab-cab h2, .c-titulo, .t-passo h3').map(dividir);
// textos de apoio: sobem e aparecem logo depois do título
const sobe = $$('.gp-txt, .hab-cab p, .negocio, .contato .camada.papel .c-corpo');
function renderSobe(el, k) {
  const e = smooth(0, 1, k);
  set(el, 'opacity', f3(e));
  set(el, 'transform', e > .999 ? 'none' : `translate3d(0, ${(lerp(26, 0, e)).toFixed(1)}px, 0)`);
}

/* ---------- abertura: a grade de planilha some na primeira metade da rolagem ---------- */
const hero = $('#topo');
const abTxt = $('.ab-txt', hero), fichaAb = $('.ficha', hero);
function renderHero(p) {
  set(hero, '--g', f3(1 - smooth(0, .5, p)));
  // profundidade leve: o texto desce um pouco mais devagar que a página e a ficha sobe um pouco mais depressa
  const q = mob() ? 0 : smooth(0, 1, p);
  set(abTxt, 'translate', `0 ${(q * 64).toFixed(1)}px`);
  set(fichaAb, 'translate', `0 ${(q * -36).toFixed(1)}px`);
}

/* ---------- trajetória: a grade de meses enche em onda ---------- */
const traj = $('#trajetoria-cena');
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
// título de cada passo: o primeiro entra com a cena; os outros, no começo da sua janela
const titPasso = passos.map(s => titulos.find(t => t.el.parentNode === s));
const titSoltos = titulos.filter(t => !titPasso.includes(t));
let ultimoTotal = -1, posVirada = null;
function medirVirada() {
  const zc = daFase[ultima][0];
  if (!zc) return;
  // a etiqueta fica logo abaixo da última linha da grade, na coluna do primeiro mês da virada
  // (quando os meses novos abrem uma linha, ela não cobre os quadrados)
  const g = tFig.getBoundingClientRect(), r = zc.el.getBoundingClientRect(), gr = $('#gradeM', traj).getBoundingClientRect();
  posVirada = { top: gr.bottom - g.top + 8, left: r.left - g.left };
}
function renderTraj(p, k0 = 1) {
  titPasso.forEach((t, j) => { if (t) revelar(t, j === 0 ? Math.max(k0, rampa(0, .03, p)) : rampa(STEPR[j][0] - .015, STEPR[j][0] + .03, p)); });
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
  set(cnt, 'opacity', f3(smooth(.075, .1, p)));
  if (posVirada) {
    const k = smooth(.66, .76, p);
    set(virada, 'transform', `translate3d(${posVirada.left.toFixed(1)}px, ${(posVirada.top + lerp(10, 0, k)).toFixed(1)}px, 0)`);
    set(virada, 'opacity', f3(k));
  }
  set(traco, '--tp', f3(p));
  if (p > .5) prepararCartoes();
  passos.forEach((s, j) => {
    const [a, b] = STEPR[j];
    // os passos se cruzam (um sai enquanto o outro entra), sem quadro vazio entre eles
    const v = (j === 0 ? 1 : smooth(a - .015, a + .015, p)) * (j === passos.length - 1 ? 1 : 1 - smooth(b - .015, b + .015, p));
    set(s, 'opacity', f3(v));
    // o texto do passo vem logo depois do título
    set(s, '--pv', f3(j === 0 ? 1 : smooth(a + .012, a + .045, p)));
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
const cortinaIntro = p => smooth(.04, .86, p);
// as capturas da 1ª e da 2ª linha de cartões são decodificadas num momento ocioso depois da carga
// (ou, no mais tardar, quando a trajetória passa da metade), e não durante a cortina
let decodificou = false;
function prepararCartoes() {
  if (decodificou) return;
  decodificou = true;
  $$('.cartao').slice(0, 6).forEach(c => $$('img', c).forEach(im => { im.loading = 'eager'; if (im.decode) im.decode().catch(() => {}); }));
}
function renderIntro(p) {
  if (p > 0) prepararCartoes();
  set(intro, '--c', f3(cortinaIntro(p)));
}

/* ---------- contato: a cortina de papel volta ---------- */
const contato = $('#contato-cena');
const cortinaContato = p => smooth(0, .55, p);
function renderContato(p) {
  set(contato, '--cc', f3(cortinaContato(p)));
  // a assinatura termina antes do ponto em que o link "Contato" para a página
  set(contato, '--s', f3(smooth(.46, .62, p)));
}
/* o cabeçalho escurece quando a cortina passa por ele, e clareia na volta */
function renderMast(ci, cc, vh = innerHeight) {
  const hi = clamp((MH - vh * (1 - ci)) / MH), hc = clamp((MH - vh * (1 - cc)) / MH);
  // a troca do cabeçalho acontece no meio da passagem da borda, para ele não ficar cinza parado
  set(mast, '--d', f3(smooth(.3, .7, hi) * (1 - smooth(.3, .7, hc))));
}

/* ---------- vitrine: a planilha vira sistema ----------
   Cada linha de cartões chega como uma linha de planilha: os cartões encostados (sem o vão da grade), um pouco
   abaixo, com a área da tela ainda em células vazias. Com a rolagem, eles se separam, sobem e as telas reais
   aparecem; os botões entram por último. O CSS lê --k (0 = planilha, 1 = cartão) e --dx (quanto falta para fechar o vão). */
const lista = $('.cartoes');
const cartoes = $$('.cartao', lista).map(el => ({ el, y: 0 }));
function medirCartoes() {
  const gap = parseFloat(getComputedStyle(lista).columnGap) || 0, l0 = lista.offsetTop;
  const linhas = new Map();
  cartoes.forEach(c => {
    c.y = c.el.offsetTop - l0;
    if (!linhas.has(c.y)) linhas.set(c.y, []);
    linhas.get(c.y).push(c);
  });
  const cols = Math.max(...[...linhas.values()].map(l => l.length));
  for (const l of linhas.values()) {
    l.sort((a, b) => a.el.offsetLeft - b.el.offsetLeft);
    l.forEach((c, i) => set(c.el, '--dx', `${(((cols - 1) / 2 - i) * (gap + 1)).toFixed(1)}px`));
  }
}
const kCartao = (top, vh) => smooth(vh * 1.02, vh * .52, top);

/* ---------- habilidades: a matriz se preenche linha a linha, como a grade de meses ---------- */
const mx = $('.mx');
const mxLinhas = mx ? $$('tbody tr:not(.mx-g)', mx).map(el => ({ el, y: 0 })) : [];
let mxVis = false;
function medirMx() {
  mxVis = !!(mx && mx.offsetParent);
  if (!mxVis) return;
  const t0 = mx.getBoundingClientRect().top;
  mxLinhas.forEach(r => { r.y = r.el.getBoundingClientRect().top - t0; });
}

function medirTudo() {
  MH = mast.offsetHeight;
  ajustarFig();
  titulos.forEach(agrupar);
  medirCartoes();
  medirMx();
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
    // no modo captura os títulos, os cartões e a matriz ficam no estado final; só a cena pedida segue o progresso
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
  const topT = titSoltos.map(t => t.el.getBoundingClientRect().top);
  const top0 = titPasso[0] ? titPasso[0].el.getBoundingClientRect().top : 0;
  const topS = sobe.map(el => el.getBoundingClientRect().top);
  const lt = lista.getBoundingClientRect().top;
  const mt = mxVis ? mx.getBoundingClientRect().top : 0;
  // 2) escritas
  titSoltos.forEach((t, i) => revelar(t, kTitulo(topT[i], vh)));
  sobe.forEach((el, i) => renderSobe(el, kSobe(topS[i], vh)));
  cartoes.forEach(c => set(c.el, '--k', f3(kCartao(lt + c.y, vh))));
  if (mxVis) mxLinhas.forEach(r => set(r.el, '--k', f3(rampa(vh, vh * .84, mt + r.y))));
  if (titPasso[0] && (tr.top >= vh || tr.bottom <= 0)) revelar(titPasso[0], kTitulo(top0, vh));
  if (hr.bottom > 0) renderHero(clamp(-hr.top / Math.max(1, hr.height)));
  if (tr.top < vh && tr.bottom > 0) renderTraj(progFixo(tr), kTitulo(top0, vh));
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
Promise.all([document.fonts ? document.fonts.ready : null, new Promise(r => addEventListener('load', r, { once: true }))]).then(() => {
  medirTudo(); pedir();
  (window.requestIdleCallback || (f => setTimeout(f, 1200)))(prepararCartoes, { timeout: 4000 });
});
// voltando de uma página de projeto (cache de navegação), a posição pode ter mudado sem evento de rolagem
addEventListener('pageshow', e => { if (e.persisted) { medirTudo(); pedir(); } });
})();
