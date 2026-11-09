/* =====================================================================
   Efeitos da página. Todo o conteúdo já vem no HTML; este arquivo só
   acrescenta movimento. Regra: todo efeito de rolagem é CONTÍNUO —
   o progresso da rolagem vira um estado interpolado, nada "aos saltos".

   Testes sem rolar (headless): ?cena=<id>&progresso=<0..1>
   ids: abertura, trajetoria, projetos, <id do projeto em lançamento>,
        cartoes, habilidades, formacao, contato
   ===================================================================== */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
// cenas empilhadas (mesma condição do CSS): celular e tablet em pé
const empilhado = matchMedia('(max-width:760px), (max-width:1024px) and (orientation:portrait)');
const mobile = () => empilhado.matches;
const root = document.documentElement;
const cfg = JSON.parse($('#dados-cena').textContent);

/* ---------- links de idioma: via file:// o navegador precisa do index.html ---------- */
if (location.protocol === 'file:') $$('a[data-pasta]').forEach(a => { a.href = a.getAttribute('href') + 'index.html'; });

/* ---------- data de hoje no fólio ---------- */
const dh = $('[data-hoje]');
if (dh) dh.textContent = new Intl.DateTimeFormat(root.lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()) + ' · ' + dh.dataset.hoje;

/* ---------- TRAJETÓRIA: grade de meses (refeita com a data do visitante) ---------- */
const mi = (y, m) => y * 12 + (m - 1);
const now = new Date();
const PH = cfg.fases.map(f => ({ id: f.id, cor: f.cor, a: mi(...f.inicio), b: f.fim ? mi(...f.fim) : null }));
const HOJE = Math.max(mi(now.getFullYear(), now.getMonth() + 1), PH[PH.length - 1].a);
PH.forEach(p => { if (p.b === null) p.b = HOJE; });
const Y0 = cfg.fases[0].inicio[0], Y1 = Math.floor(HOJE / 12);
const phasesAt = i => PH.filter(p => i >= p.a && i <= p.b);
const gridM = $('#gridM');
let gh = '<span></span>' + [...cfg.iniciais].map(l => `<span class="ax">${l}</span>`).join('');
for (let y = Y0; y <= Y1; y++) {
  gh += `<span class="ax yr${y === Y1 ? ' b' : ''}">${y}</span>`;
  for (let m = 1; m <= 12; m++) {
    const i = mi(y, m), phs = phasesAt(i);
    if (i > HOJE) { gh += '<span class="cell fut"></span>'; continue; }
    if (!phs.length) { gh += '<span class="cell pre"></span>'; continue; }
    const ph = phs[phs.length - 1];   // no mês de transição, vale a fase que começa
    const bg = phs.length > 1 ? `linear-gradient(135deg, ${phs[0].cor} 50%, ${phs[1].cor} 50%)` : ph.cor;
    gh += `<span class="cell${i === HOJE ? ' hoje' : ''}" data-i="${i}" data-ph="${ph.id}" data-phs="${phs.map(q => q.id).join(' ')}"><i style="background:${bg}"></i><i class="o"></i></span>`;
  }
}
gridM.innerHTML = gh;
const cells = $$('.cell[data-i]', gridM).map(el => ({ el, ph: el.dataset.ph, phs: el.dataset.phs.split(' '), f: el.firstChild, o: el.lastChild }));
const tFig = $('.t-fig'), virada = $('#virada');
const lgItem = Object.fromEntries(PH.map(p => [p.id, $(`.lg-i[data-ph="${p.id}"]`)]));
const lgCount = Object.fromEntries(PH.map(p => [p.id, $(`.lg-i[data-ph="${p.id}"] strong`)]));
const phTot = Object.fromEntries(PH.map(p => [p.id, cells.filter(c => c.ph === p.id).length]));
const firstOf = id => cells.findIndex(c => c.ph === id);
const ultima = PH[PH.length - 1].id;
// janelas de progresso de cada fase (preenchimento contínuo, mês a mês)
const WIN = PH.length === 3 ? [[.06, .42], [.44, .56], [.60, .74]] : PH.map((_, j) => [.06 + j * .68 / PH.length, .06 + (j + .9) * .68 / PH.length]);
const tSteps = $$('.t-step');
const STEPR = tSteps.length === 4 ? [[0, .43], [.43, .58], [.58, .78], [.78, 1]] : tSteps.map((_, j) => [j / tSteps.length, (j + 1) / tSteps.length]);
const cntN = $('#cntN'), figQ = $('#figQ');
const plural = n => n + ' ' + (n === 1 ? cfg.mes : cfg.meses);

// posição da etiqueta da virada (leitura de layout; feita antes das escritas do quadro)
function medirVirada() {
  const zc = cells[firstOf(ultima)];
  if (!zc || !virada) return null;
  const g = tFig.getBoundingClientRect(), r = zc.el.getBoundingClientRect();
  return { top: r.bottom - g.top + 8, left: r.left - g.left };
}

function renderTraj(p, vir = medirVirada()) {
  const cheio = new Uint8Array(cells.length);
  PH.forEach((ph, j) => {
    const [a, b] = WIN[j], n = phTot[ph.id], s0 = firstOf(ph.id);
    // frente de preenchimento contínua: cada mês leva ONDA meses de rolagem para aparecer, então vários meses
    // estão entrando ao mesmo tempo e nenhum "estala" de uma vez
    const ONDA = 6, x = clamp((p - a) / (b - a)) * (n + ONDA);
    // na última etapa, as planilhas "se apagam" e os sistemas ficam em destaque
    const fade = ph.id === ultima ? 1 : 1 - .62 * smooth(.8, .95, p);
    for (let k = 0; k < n; k++) {
      const c = cells[s0 + k], v = clamp((x - k) / ONDA), e = v * v * (3 - 2 * v);
      c.f.style.opacity = (e * fade).toFixed(3);
      c.f.style.transform = `scale(${lerp(.3, 1, e).toFixed(3)})`;
      c.o.style.opacity = ph.id === ultima ? 0 : (e * .55 * smooth(.8, .95, p)).toFixed(3);
      if (v > .5) cheio[s0 + k] = 1;                 // o contador conta o mês quando ele passa da metade
    }
    // legenda: a empresa que a grade ainda não alcançou fica esmaecida e acende quando o preenchimento chega nela
    if (lgItem[ph.id]) lgItem[ph.id].style.opacity = lerp(.4, 1, smooth(a - .05, a, p)).toFixed(3);
  });
  // meses por empresa = meses do período dela (o mês de transição conta para as duas); o total conta cada mês uma vez
  const porFase = Object.fromEntries(PH.map(ph => [ph.id, 0]));
  let total = 0;
  cells.forEach((c, i) => { if (cheio[i]) { total++; c.phs.forEach(id => { porFase[id]++; }); } });
  PH.forEach(ph => { if (lgCount[ph.id]) lgCount[ph.id].textContent = plural(porFase[ph.id]); });
  cntN.textContent = total;
  // etiqueta da virada: acompanha a linha do ano em que começa a última fase
  if (vir) {
    const k = smooth(.66, .76, p);
    virada.style.top = vir.top + 'px';
    virada.style.left = vir.left + 'px';
    virada.style.opacity = k.toFixed(3);
    virada.style.transform = `translateY(${lerp(10, 0, k).toFixed(1)}px)`;
  }
  const q = smooth(.84, .96, p);
  figQ.style.opacity = q.toFixed(3); figQ.style.transform = `translateY(${lerp(14, 0, q).toFixed(1)}px)`;
  // troca de etapa em sequência (contínua): a que sai some em [b-.04, b] e a próxima só aparece em [a, a+.04],
  // então os dois textos nunca ficam legíveis um sobre o outro
  tSteps.forEach((s, j) => {
    const [a, b] = STEPR[j];
    const inn = j === 0 ? 1 : smooth(a, a + .04, p);
    const out = j === tSteps.length - 1 ? 0 : smooth(b - .04, b, p);
    s.style.opacity = (inn * (1 - out)).toFixed(3);
    s.style.transform = `translateY(${((1 - inn) * 28 - out * 28).toFixed(1)}px)`;
    s.style.pointerEvents = inn * (1 - out) > .5 ? 'auto' : 'none';
  });
}

// a figura (contador + grade + legenda + citação) precisa caber na altura da cena fixa em qualquer idioma:
// mede a altura real e, se passar, reduz a largura (as células são quadradas) até caber com folga.
// Empilhado (celular), a conta inclui o texto da etapa mais alta, que fica embaixo da figura.
const tStick = tFig.parentNode;
function ajustarFig() {
  tFig.style.width = '';
  const emp = mobile();
  const anos = Y1 - Y0 + 1;
  const disp = emp ? tStick.clientHeight - parseFloat(getComputedStyle(tStick).paddingTop) - 12 : tStick.clientHeight - 64;
  const altura = () => tFig.offsetHeight + (emp ? 16 + Math.max(...tSteps.map(s => s.offsetHeight)) : 0);
  for (let k = 0; k < 6; k++) {
    const h = altura();
    if (h <= disp) break;
    const w = tFig.getBoundingClientRect().width, c = cells[0].el.getBoundingClientRect().width;
    tFig.style.width = Math.max(emp ? 180 : 260, w - 12 * c + 12 * (c - (h - disp) / anos) - 2) + 'px';
  }
}

/* ---------- LANÇAMENTOS (qualquer projeto com nivel "lancamento") ---------- */
// Cada lançamento tem dois progressos contínuos:
//   e (entrada) 0 → 1 enquanto a cena sobe do pé da tela até fixar sob o cabeçalho (a janela e o celular chegam)
//   p (destaques) 0 → 1 enquanto a cena está fixa (um "passo" de rolagem por destaque)
// Assim, entre dois lançamentos seguidos, a cena de baixo já vai se montando enquanto a de cima sai.
const launches = $$('[data-lancamento]').map(sec => {
  const lis = $$('.l-list li', sec);
  const imgs = $$('.win-scr img', sec);
  return { id: sec.dataset.cena, sec, lis, imgs, telas: lis.map(li => li.dataset.tela), keys: imgs.map(i => i.dataset.k),
    stick: $('.stick', sec), listw: $('.l-listw', sec),
    rig: $('.l-rig', sec), phone: $('.phone', sec), cap: $('.l-cap', sec), dim: $('.dim', sec), bar: $('.l-bar', sec),
    ds: lis.map(li => $('.l-d', li)), dh: lis.map(() => 0), sh: 0 };
});
const mast = $('#mast');
let mh = mast ? mast.offsetHeight : 0;
// altura natural de cada descrição (a lista mostra só a do destaque ativo, abrindo e fechando de forma contínua).
// Empilhado (celular), os destaques ocupam o mesmo lugar: a caixa da lista fica com a altura do mais alto.
const medirDescricoes = () => {
  mh = mast ? mast.offsetHeight : 0;
  launches.forEach(L => {
    L.dh = L.ds.map(d => d ? d.firstElementChild.offsetHeight : 0);
    L.sh = L.stick.offsetHeight;
    // + 10 px: o destaque que entra desliza até 9 px (translateY) antes de assentar
    if (L.listw) L.listw.style.height = mobile() ? Math.max(...L.lis.map(li => li.offsetHeight)) + 10 + 'px' : '';
  });
};
// progresso dos destaques (cena fixa) e da entrada (cena subindo), a partir da posição da seção
const progL = (L, r) => { const span = r.height - L.sh; return span > 0 ? clamp((mh - r.top) / span) : 0; };
const entradaL = r => clamp((innerHeight - r.top) / Math.max(1, innerHeight - mh));

function renderLaunch(L, p, e = 1) {
  const n = L.telas.length;
  const x = clamp(p, 0, .9999) * n, h = Math.floor(x), u = x - h;
  const b = h < n - 1 ? smooth(.7, 1, u) : 0;      // mistura contínua com o próximo destaque
  const lastWin = j => { for (let q = Math.min(j, n - 1); q >= 0; q--) if (L.telas[q] !== 'celular') return L.telas[q]; return L.keys[0]; };
  const A = lastWin(h), B = lastWin(h + 1), P = h > 0 ? lastWin(h - 1) : null;
  // a tela seguinte entra POR CIMA da atual (sem "vão" escuro no meio da troca); a anterior, já coberta,
  // termina de sumir por baixo, de forma contínua
  const mob = mobile();
  L.imgs.forEach(img => {
    const k = img.dataset.k;
    img.style.zIndex = k === B && B !== A ? 2 : k === A ? 1 : 0;
    img.style.opacity = k === A ? 1 : k === B ? b.toFixed(3) : k === P ? (1 - smooth(0, .3, u)).toFixed(3) : 0;
  });
  // na lista, o primeiro destaque já começa inteiro e o último termina inteiro; a troca de destaque acontece
  // junto com a troca de tela (a tela cruza em x = j + .85; a lista, também)
  const xl = clamp(x + .15, .5, n - .5);
  L.lis.forEach((li, j) => {
    // no celular os destaques ocupam o mesmo lugar: o que sai some antes de o próximo aparecer (sem sobreposição)
    const dist = Math.abs(xl - (j + .5)), v = mob ? 1 - smooth(.2, .5, dist) : 1 - smooth(.25, .75, dist);
    li.style.opacity = mob ? v.toFixed(3) : (.3 + .7 * v).toFixed(3);
    li.style.transform = mob ? `translateY(${((j + .5 - xl) * 18).toFixed(1)}px)` : 'none';
    // a descrição abre e fecha numa janela larga (60% do passo de cada destaque): a que sai fecha enquanto a
    // próxima abre, as duas pela metade no ponto de troca, e a altura total da lista fica quase constante
    const d = L.ds[j], vd = mob ? v : 1 - smooth(.2, .8, dist);
    if (d) { d.style.height = (L.dh[j] * vd).toFixed(1) + 'px'; d.style.opacity = vd.toFixed(3); }
  });
  if (L.bar) L.bar.style.transform = `scaleY(${clamp(p).toFixed(4)})`;
  const tel = j => L.telas[Math.min(j, n - 1)];
  const phoneW = (tel(h) === 'celular' ? 1 - b : 0) + (tel(h + 1) === 'celular' ? b : 0);
  // a janela sobe e assenta enquanto a cena entra (e) e segue subindo devagar durante os destaques (p)
  const enter = smooth(.25, 1, e);
  const ty = lerp(mob ? 18 : 40, 0, enter) + lerp(0, mob ? -6 : -14, p);
  const s = lerp(.94, 1, enter) - phoneW * .03;
  L.rig.style.transform = `translate3d(${(-phoneW * (mob ? 4 : 2)).toFixed(2)}%, ${ty.toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
  L.dim.style.opacity = (phoneW * .5).toFixed(3);
  // com o celular em destaque (ampliado por cima da janela), a legenda abaixo some junto, sem ficar meio coberta
  if (L.cap && L.phone) L.cap.style.opacity = (1 - phoneW).toFixed(3);
  if (L.phone) {
    // o celular chega na segunda metade da entrada e assenta quando a cena fixa
    const pin = smooth(.45, 1, e);
    const tx = lerp(12, 0, pin) + phoneW * (mob ? -70 : -90);
    L.phone.style.opacity = pin.toFixed(3);
    // empilhado (celular), o celular em destaque cresce menos e não sobe: cabe acima do texto
    L.phone.style.transform = `translate3d(${tx.toFixed(1)}%, ${(lerp(mob ? 4 : 18, 0, pin) - phoneW * (mob ? 0 : 8)).toFixed(1)}%, 0) rotate(${lerp(-4, 0, pin).toFixed(2)}deg) scale(${(1 + phoneW * (mob ? .2 : .38)).toFixed(4)})`;
  }
}

/* ---------- CARTÕES: telas trocam conforme o cartão atravessa a tela ---------- */
const cards = $$('[data-cartao]').map(el => ({ el, imgs: $$('.win-scr img', el), dots: $$('.c-dots b', el), phone: $('.c-rig .phone', el),
  fc: $('.fc', el), fcLis: $$('.fc-stack li span', el) }));
function renderCard(C, q) {
  const n = C.imgs.length;
  if (n > 1) {
    const x = smooth(.28, .72, q) * (n - 1);
    C.imgs.forEach((img, k) => { img.style.opacity = k === 0 ? 1 : smooth(0, 1, x - (k - 1)).toFixed(3); });
    C.dots.forEach((d, k) => { d.style.transform = `scaleX(${(k === 0 ? 1 : clamp(x - (k - 1))).toFixed(3)})`; });
  }
  if (C.phone) {
    const e = smooth(.12, .38, q);
    C.phone.style.opacity = e.toFixed(3);
    C.phone.style.transform = `translate3d(${lerp(34, 0, e).toFixed(1)}%, ${lerp(10, 0, e).toFixed(1)}%, 0) rotate(${lerp(7, 0, e).toFixed(2)}deg)`;
  }
  if (C.fc) {
    C.fc.style.setProperty('--q', smooth(.05, .35, q).toFixed(3));
    const m = C.fcLis.length;
    C.fcLis.forEach((s, k) => s.style.setProperty('--r', smooth(.1 + k * .2 / m, .2 + k * .2 / m, q).toFixed(3)));
  }
}
// 0 = topo do cartão entrando por baixo · 1 = cartão saindo por cima

/* ---------- HABILIDADES e IDIOMAS ---------- */
const mxRows = $$('#mx tbody tr').map(tr => $$('td i', tr));
function renderMatrix(q) {
  const R = mxRows.length;
  mxRows.forEach((dots, r) => dots.forEach((d, k) => {
    const s = (r / R) * .75 + k * .012;
    d.style.transform = `scale(${smooth(s, s + .2, q).toFixed(3)})`;
  }));
}
const langBars = $$('#langs .bar i');
const langV = langBars.map(b => parseFloat(getComputedStyle(b).getPropertyValue('--v')) || 0);
const renderLangs = q => langBars.forEach((b, j) => {
  b.style.transform = `scaleX(${(langV[j] * smooth(j * .1, j * .1 + .6, q)).toFixed(3)})`;
});

/* ---------- ASSINATURA: a rubrica aparece conforme a página chega ao fim ---------- */
const rubrica = $('#assina .rubrica');
const renderSign = q => { if (rubrica) rubrica.style.setProperty('--s', q.toFixed(3)); };

/* ---------- revelação contínua (posição na tela → estado) ---------- */
const revs = $$('[data-rev]');
function renderRevs(all, tops = []) {
  const vh = innerHeight;
  for (const [i, el] of revs.entries()) {
    const t = all ? 1 : smooth(0, 1, (vh * .98 - tops[i]) / (vh * .3));
    el.style.opacity = t.toFixed(3);
    el.style.transform = `translateY(${((1 - t) * 26).toFixed(1)}px)`;
  }
}

/* ---------- rolagem ---------- */
const traj = $('#trajetoria'), mx = $('#mx'), langs = $('#langs'), bar = $('#progress');
const progR = r => { const span = r.height - innerHeight; return span > 0 ? clamp(-r.top / span) : 0; };
const enterR = (r, k = .75) => clamp((innerHeight * .95 - r.top) / (r.height * k));
const cardR = r => clamp((innerHeight - r.top) / (innerHeight + r.height));

const qs = new URLSearchParams(location.search);
const cena = qs.get('cena');
if (cena) {
  const p = qs.has('progresso') ? clamp(parseFloat(qs.get('progresso')) || 0) : 1;
  root.classList.add('cap');
  const secs = $$('[data-cena]'), idx = secs.findIndex(s => s.dataset.cena === cena);
  secs.forEach((s, i) => { if (i < idx) s.classList.add('off'); });
  $$('img[loading="lazy"]').forEach(im => { im.loading = 'eager'; });
  const draw = () => {
    medirDescricoes(); ajustarFig();
    renderTraj(cena === 'trajetoria' ? p : 1);
    launches.forEach(L => renderLaunch(L, L.id === cena ? p : 0, 1));
    cards.forEach(C => renderCard(C, cena === 'cartoes' ? p : .5));
    renderMatrix(cena === 'habilidades' ? p : 1); renderLangs(1); renderRevs(true); renderSign(1);
    bar.style.transform = 'scaleX(0)';
  };
  draw(); addEventListener('resize', draw); addEventListener('load', draw);
  if (document.fonts) document.fonts.ready.then(draw);
  scrollTo(0, 0);
  return;
}

let queued = false;
const perto = (r, vh, k) => r.top < vh * (1 + k) && r.bottom > -vh * k;
const frame = () => {
  queued = false;
  const vh = innerHeight, doc = document.documentElement;
  // 1) todas as leituras de layout do quadro
  const sh = doc.scrollHeight, sy = scrollY;
  const tr = traj.getBoundingClientRect();
  const trajVis = tr.top < vh && tr.bottom > 0, vir = trajVis ? medirVirada() : null;
  const lr = launches.map(L => L.sec.getBoundingClientRect());
  const cr = cards.map(C => C.el.getBoundingClientRect());
  const mr = mx.getBoundingClientRect(), gr = langs.getBoundingClientRect();
  const tops = revs.map(el => el.getBoundingClientRect().top);
  const fim = smooth(0, 1, 1 - (sh - vh - sy) / (vh * .45));
  // 2) só escritas (seções longe da tela não são redesenhadas)
  bar.style.transform = `scaleX(${clamp(sy / (sh - vh)).toFixed(4)})`;
  if (trajVis) renderTraj(progR(tr), vir);
  launches.forEach((L, i) => { if (perto(lr[i], vh, .5)) renderLaunch(L, progL(L, lr[i]), entradaL(lr[i])); });
  cards.forEach((C, i) => { if (perto(cr[i], vh, .2)) renderCard(C, cardR(cr[i])); });
  if (perto(mr, vh, .2)) renderMatrix(enterR(mr));
  if (perto(gr, vh, .2)) renderLangs(enterR(gr, 1.2));
  renderRevs(false, tops); renderSign(fim);
};
const req = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
addEventListener('scroll', req, { passive: true });
addEventListener('resize', () => { medirDescricoes(); ajustarFig(); req(); });
medirDescricoes();
ajustarFig();
renderTraj(0);
launches.forEach(L => { const r = L.sec.getBoundingClientRect(); renderLaunch(L, progL(L, r), entradaL(r)); });
cards.forEach(C => renderCard(C, cardR(C.el.getBoundingClientRect())));
frame();
if (document.fonts) document.fonts.ready.then(() => { medirDescricoes(); ajustarFig(); req(); });
})();
