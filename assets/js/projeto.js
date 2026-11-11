/* Página de projeto: índice que acompanha a leitura e entradas ligadas à rolagem.
   Mesma regra do main.js: o progresso da rolagem vira um valor contínuo (nada dispara aos saltos), só
   transform, opacity e clip-path mudam por quadro (via variáveis CSS do projeto.css) e cada estilo só é
   escrito quando o valor muda. Sem este arquivo, tudo fica no estado final. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const f3 = v => (+v).toFixed(3);
const memo = new WeakMap();
function set(el, prop, val) {
  if (!el) return;
  let m = memo.get(el); if (!m) { m = {}; memo.set(el, m); }
  if (m[prop] === val) return;
  m[prop] = val;
  el.style.setProperty(prop, val);
}
if (!document.body.classList.contains('detalhe')) return;

// entradas: cada [data-revela] vai de 0 a 1 enquanto o topo dele sobe de 96% a 66% da altura da tela;
// data-revela="1", "2"... atrasa um pouco os vizinhos da mesma linha
const revela = $$('[data-revela]').map(el => ({ el, atraso: (+el.dataset.revela || 0) * 52 }));
// fluxo: blocos e setas se desenham um depois do outro
const fluxos = $$('[data-fluxo]').map(el => ({ el, nos: $$('li', el) }));
const secoes = $$('[data-secao]');
const corpo = $('.d-corpo');
const ind = $('.d-ind'), indM = $('.d-ind-m');
const links = $$('a[data-alvo]');
const atualN = $('[data-atual-n]'), atualR = $('[data-atual-r]');
const rotulos = Object.fromEntries(links.map(a => [a.dataset.alvo, { n: $('.d-ind-n', a).textContent, r: $('.d-ind-r', a).textContent }]));
const palco = $('.d-palco');
let atual = null;

function marcar(id) {
  if (id === atual) return;
  atual = id;
  links.forEach(a => { if (a.dataset.alvo === id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
  if (atualN && rotulos[id]) { atualN.textContent = rotulos[id].n; atualR.textContent = rotulos[id].r; }
}

let fila = false;
function quadro() {
  fila = false;
  const vh = innerHeight;
  // 1) leituras
  const tr = revela.map(r => r.el.getBoundingClientRect().top);
  const fr = fluxos.map(f => f.el.getBoundingClientRect());
  const st = secoes.map(s => s.getBoundingClientRect().top);
  const cr = corpo ? corpo.getBoundingClientRect() : null;
  const sy = scrollY;
  const falta = Math.max(0, document.documentElement.scrollHeight - vh - sy);
  // 2) escritas
  revela.forEach((r, i) => {
    // perto do fim da página o elemento não sobe até 66%: a entrada termina onde ele para, no fim da rolagem
    const fim = Math.max(vh * .66, tr[i] + r.atraso - falta);
    set(r.el, '--e', f3(smooth(Math.max(vh * .96, fim + vh * .12), fim, tr[i] + r.atraso)));
  });
  fluxos.forEach((f, i) => {
    const r = fr[i], n = f.nos.length, S = 2 * n - 1;
    // começa quando o topo do diagrama entra; termina quando o fim dele passa de 60% da tela
    const p = clamp((vh * .92 - r.top) / Math.max(1, vh * .32 + r.height));
    const P = p * (S + .3);
    const etapa = k => { const t = clamp((P - k) / 1.3); return t * t * (3 - 2 * t); };
    f.nos.forEach((li, j) => {
      set(li, '--b', f3(etapa(2 * j)));
      if (j < n - 1) set(li, '--a', f3(etapa(2 * j + 1)));
    });
  });
  // seção atual: a última cujo topo já passou de 35% da tela
  let k = 0;
  st.forEach((t, i) => { if (t <= vh * .35) k = i; });
  // no fim da página, a última seção visível vale como atual (ela pode nunca chegar a 35%)
  if (falta < 4) st.forEach((t, i) => { if (t < vh * .8) k = i; });
  if (secoes[k]) marcar(secoes[k].id);
  if (cr) {
    // chega a 1 no fim do corpo ou, se a página acabar antes, no fim da rolagem
    const p = f3(clamp((vh * .35 - cr.top) / Math.max(1, Math.min(cr.height, vh * .35 - cr.top + falta))));
    set(ind, '--p', p); set(indM, '--p', p);
  }
  // abertura: o celular sobe um pouco mais rápido que a janela
  if (palco && sy < vh * 1.5) set(palco, '--py', (-Math.min(sy, vh) * .07).toFixed(1) + 'px');
}
const pedir = () => { if (!fila) { fila = true; requestAnimationFrame(quadro); } };
addEventListener('scroll', pedir, { passive: true });
addEventListener('resize', pedir);
addEventListener('load', pedir);
// rolagem suave só quando o clique é num link interno (#seção); quem chega por link direto cai na seção na hora
document.addEventListener('click', e => { if (e.target.closest('a[href^="#"]')) document.documentElement.classList.add('rola-suave'); }, true);
if (document.fonts) document.fonts.ready.then(pedir);
quadro();

// índice compacto: fecha ao escolher uma seção, com Esc e ao tocar fora
if (indM) {
  const sum = $('summary', indM);
  indM.addEventListener('click', e => { if (e.target.closest('a[data-alvo]')) indM.open = false; });
  indM.addEventListener('keydown', e => { if (e.key === 'Escape' && indM.open) { indM.open = false; sum.focus(); } });
  document.addEventListener('click', e => { if (indM.open && !indM.contains(e.target)) indM.open = false; });
}
})();
