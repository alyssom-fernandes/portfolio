/* =====================================================================
   INTERFACE — funciona igual com ou sem 3D
   - preenche números (DATA), monta figuras (meses, situação, matriz)
   - decide o plano de câmera pela rolagem (scrollytelling)
   - liga cartões ↔ prédios, visão recrutador, estados por URL
   - versão estática (SVG) quando o WebGL não existe, falha ou é lento
   ===================================================================== */
(function () {
  'use strict';
  const D = window.DATA, M = window.MODELO, P = window.PLANTA;
  const Q = new URLSearchParams(location.search);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const html = document.documentElement;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const APP = window.APP = {
    captura: Q.get('captura') === '1',
    plano: 'abertura',
    hover: null,
    cv: html.classList.contains('modo-cv'),
    visivel: true,
    mobile: false,
    colPx: 0, topoPx: 60,
    usar3D: false, gpuFraca: false, cidadeOk: false,
    acordar: null,            // a cidade registra aqui como voltar a desenhar
  };
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------- números (os pendentes vêm de DATA.PENDENTE) ---------- */
  $$('[data-num]').forEach(el => {
    const k = el.dataset.num, p = D.PENDENTE[k];
    if (p) { el.textContent = p.valor; el.dataset.pendente = 'true'; }
    else if (D.NUMEROS[k] != null) el.textContent = D.NUMEROS[k];
  });

  /* ---------- Fig. 3: grade de meses ---------- */
  (function meses() {
    const el = $('#meses'); if (!el) return;
    const MES = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    let h = '<span></span>' + MES.map(m => `<span class="mh">${m}</span>`).join('');
    const anoHoje = 2021 + Math.floor((M.mesHoje + 1) / 12);
    for (let a = 2021; a <= Math.max(2026, anoHoje); a++) {
      h += `<span class="ano${a === anoHoje ? ' atual' : ''}">${a}</span>`;
      for (let k = 1; k <= 12; k++) {
        const m = (a - 2021) * 12 + (k - 2);
        let cls = 'm';
        if (m < 0) cls += ' antes';
        else if (m > M.mesHoje) cls += ' vazio';
        else if (m === M.mes('2025-09')) cls += ' divide';
        else if (m > M.mes('2025-09') && m <= M.mes('2026-01')) cls += ' nm';
        else if (m >= M.mes('2026-02')) cls += ' zen';
        if (m === M.mesHoje) cls += ' hoje';
        h += `<span class="${cls}"></span>`;
      }
    }
    el.innerHTML = h;
  })();

  /* ---------- Fig. 5: projetos por situação ---------- */
  (function situacao() {
    const el = $('#situacao'); if (!el) return;
    const grupos = [
      ['producao', 'Em produção'], ['demo-ao-vivo', 'Demo ao vivo'], ['demo', 'Demo'], ['codigo', 'Só código'],
    ];
    el.innerHTML = grupos.map(([st, rot]) => {
      const ps = M.projetos.filter(p => p.status === st);
      return `<div class="sit-g ${st}"><h4><span>${st === 'producao' ? `<b>${D.NUMEROS.emProducao}</b> · ` : ''}${rot}</span></h4><ul>${ps.map(p => `<li><a href="#projeto-${p.id}" data-liga="${p.id}">${esc(p.nome)}</a></li>`).join('')}</ul></div>`;
    }).join('') + `<p class="sit-nota">O Fuel Mind também tem demo ao vivo: são ${D.NUMEROS.demosAoVivo} demos abertas (Fuel Mind, Praxis e ArtMaker). A do DeepChat exige chave de API própria.</p>`;
  })();

  /* ---------- links de código: saem do DATA (campo repo); sem repo, o link honesto é o perfil ---------- */
  $$('[data-repo]').forEach(a => {
    const p = D.projetos.find(q => q.id === a.dataset.repo);
    const repos = p && p.repo ? [].concat(p.repo) : [];
    const seta = ' <span aria-hidden="true">↗</span>';
    if (!repos.length) { a.href = D.github; a.innerHTML = 'Perfil no GitHub' + seta; return; }
    const rot = a.dataset.rotulo || 'Código no GitHub';
    const r0 = repos[0];
    a.href = r0.url || r0;
    a.innerHTML = (repos.length > 1 ? `${rot} · ${esc(r0.rot)}` : rot) + seta;
    // mais de um repositório (ex.: UnifyData web e Python): um link por repositório
    repos.slice(1).forEach(r => {
      const b = a.cloneNode(false);
      b.removeAttribute('data-repo');
      b.href = r.url; b.innerHTML = esc(r.rot) + seta;
      a.after(document.createTextNode(' '), b);
    });
  });

  /* ---------- Fig. 6: matriz tecnologias × projetos ---------- */
  (function matriz() {
    const el = $('#matriz'); if (!el) return;
    const cols = D.matriz.colunas.map(id => M.porId[id]);
    let h = '<thead><tr><th class="ct" scope="col">Tecnologia</th>' +
      cols.map(p => `<th class="cp${p.status === 'producao' ? ' prod' : ''}" scope="col" data-liga="${p.id}"><span>${esc(p.nome)}</span></th>`).join('') +
      '<th class="tt" scope="col">Total</th></tr></thead><tbody>';
    M.techs.forEach(t => {
      h += `<tr data-liga="${t.id}"><th scope="row"><span class="longo">${esc(t.nome)}</span><span class="curto">${esc(t.curto)}</span></th>` +
        cols.map(p => t.usa.includes(p.id) ? `<td><i title="${esc(t.nome)} · ${esc(p.nome)}" aria-label="usa"></i></td>` : '<td><i class="nao" aria-label="não usa"></i></td>').join('') +
        `<td class="tt">${t.total}</td></tr>`;
    });
    h += '</tbody><tfoot><tr><td></td>' + cols.map(p => `<td>${p.techs.length}</td>`).join('') + '<td></td></tr></tfoot>';
    el.innerHTML = h;
    const res = $('#hab-resumo');
    if (res) res.innerHTML = '<b>Com evidência em projetos:</b> ' + M.techs.map(t => `${esc(t.nome)} (${t.total})`).join(' · ') + '.';
  })();

  /* ---------- legendas das figuras (desktop: fixa; celular: nas vitrines) ---------- */
  const legendas = {};
  $$('.sec[data-plano]').forEach(s => { legendas[s.dataset.plano] = s.dataset.legenda || ''; });
  function legendaDe(plano) {
    if (legendas[plano] != null) return legendas[plano];
    const [tipo, id] = plano.split(':');
    const o = M.porId[id];
    if (tipo === 'foco' && o && o.tipo === 'projeto') {
      const n = o.techs.length, pl = P.porId[id];
      const partes = [n ? `${n} andares = ${n} tecnologias da matriz` : 'pavilhão térreo: fora da matriz tecnologias × projetos'];
      if (o.status === 'producao') partes.push('telhado azul: em produção');
      if (pl && pl.antena) partes.push('antena verde: demo ao vivo');
      if (o.origem) partes.push('nasceu no Grupo Zen');
      return `<b>${esc(o.nome)}.</b> ${partes.join(' · ')}.`;
    }
    if (tipo === 'marco' && o) {
      const fim = o.fim ? o.fim.split('-').reverse().join('/').replace(/^0?(\d+)\//, (a, m) => ['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+m] + '/') : 'hoje';
      const ini = o.inicio.split('-').reverse().join('/').replace(/^0?(\d+)\//, (a, m) => ['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+m] + '/');
      return `<b>${esc(o.empresa)}.</b> Na avenida, as células de ${ini} a ${fim}${o.projetos ? '; os prédios acesos nasceram aqui' : ''}.`;
    }
    return legendas.abertura;
  }
  $$('.sec > .vitrine').forEach(v => { const s = v.parentElement; v.innerHTML = `<p class="leg-m">${s.dataset.legenda || ''}</p>`; });
  $$('.vitrine-pj').forEach(v => { const a = v.closest('[data-plano]'); v.innerHTML = `<p class="leg-m">${legendaDe(a.dataset.plano)}</p>`; v.style.display = ''; });
  const legFig = $('#legenda-fig');
  let legAtual = '';
  function mostraLegenda(plano) {
    const txt = legendaDe(plano);
    if (txt === legAtual) return;
    legAtual = txt;
    legFig.classList.add('troca');
    clearTimeout(mostraLegenda.t);
    mostraLegenda.t = setTimeout(() => {
      legFig.innerHTML = `<span>${txt}</span>`; legFig.classList.remove('troca');
      // a altura da faixa define a área livre da cidade (o enquadramento fica acima dela)
      if (!APP.mobile && legFig.offsetHeight !== APP.legPx) { APP.legPx = legFig.offsetHeight; if (APP.acordar) APP.acordar(); }
    }, APP.captura ? 0 : 220);
  }
  legAtual = legendaDe('abertura');
  legFig.innerHTML = `<span>${legAtual}</span>`;

  /* ---------- medidas de layout (a cidade usa para centrar o assunto) ---------- */
  function medir() {
    APP.mobile = innerWidth < 900;
    APP.topoPx = $('#topo').offsetHeight;
    APP.colPx = APP.mobile ? 0 : $('#inicio .col').offsetWidth;
    APP.legPx = APP.mobile ? 0 : legFig.offsetHeight;
  }
  medir();
  addEventListener('resize', () => { medir(); atualizarPlano(); });

  /* ---------- deslocamento (em captura, o conteúdo é transladado: rolar a janela sai em branco no headless) ---------- */
  const main = $('#conteudo');
  let desloc = 0;
  function irParaY(y, suave) {
    y = Math.max(0, Math.round(y));
    if (APP.captura) { desloc = y; main.style.transform = `translateY(${-y}px)`; atualizarPlano(); return; }
    window.scrollTo({ top: y, behavior: suave ? 'smooth' : 'instant' });
  }
  const topoDe = el => el.getBoundingClientRect().top + window.scrollY + desloc;
  // elementos curtos (linha da lista, linha da matriz) vão para a linha de leitura; os longos, para o topo
  const alvoDe = el => {
    const h = el.offsetHeight, linha = innerHeight * (APP.mobile ? .5 : .42);
    if (h < innerHeight * .5 && !el.classList.contains('vitrine-pj') && !el.classList.contains('sec')) return topoDe(el) - linha + Math.min(h / 2, 60);
    let y = topoDe(el) - APP.topoPx - 12;
    // cartão de projeto mais alto que a tela: desce até os links (demo/código) ficarem visíveis,
    // sem deixar o nome do projeto passar para baixo do cabeçalho
    const links = !APP.mobile && el.classList.contains('pj') && el.querySelector('.pj-links');
    if (links) {
      const fimLinks = topoDe(links) + links.offsetHeight + 24 - innerHeight;
      const limite = topoDe(el.querySelector('h3')) - APP.topoPx - 14;
      if (fimLinks > y) y = Math.min(fimLinks, limite);
    }
    return y;
  };

  /* ---------- regiões onde a cidade aparece (a câmera centra o assunto em cada uma) ----------
     desktop: à direita da coluna, acima da legenda. celular: a faixa da abertura e cada vitrine
     visível, da mais visível para a menos visível (a primeira comanda o plano). */
  const vitrines = $$('.vitrine').map(v => {
    const pj = v.classList.contains('vitrine-pj');
    return { el: v, plano: pj ? v.dataset.plano : v.parentElement.dataset.plano, alvo: pj ? v.nextElementSibling.querySelector('[data-plano]') : v.parentElement };
  });
  const inicio = $('#inicio'), inicioCol = $('#inicio .col');
  APP.regioes = function () {
    const W = innerWidth, H = innerHeight, topo = APP.topoPx;
    if (!APP.mobile) return [{ plano: APP.plano || 'abertura', alvo: null, x0: APP.colPx, x1: W, y0: topo, y1: H, yc1: H - APP.legPx, vis: 1 }];
    const out = [];
    const add = (plano, alvo, y0, y1, yc1) => {
      const vis = Math.min(y1, H) - Math.max(y0, topo);
      if (vis > 2) out.push({ plano, alvo, x0: 0, x1: W, y0, y1, yc1, vis });
    };
    const ri = inicio.getBoundingClientRect(), rc = inicioCol.getBoundingClientRect();
    add('abertura', inicio, ri.top + topo, rc.top, rc.top - 26);   // 26 px: o degradê acima da folha
    for (const v of vitrines) {
      const r = v.el.getBoundingClientRect();
      if (r.bottom <= topo || r.top >= H) continue;
      const lg = v.el.firstElementChild;
      add(v.plano, v.alvo, r.top, r.bottom, lg ? lg.getBoundingClientRect().top - 8 : r.bottom);
    }
    return out.sort((a, b) => b.vis - a.vis);
  };

  /* ---------- plano de câmera pela rolagem ---------- */
  const planoEls = $$('[data-plano]');
  const navLinks = $$('.topo-nav a');
  function atualizarPlano() {
    if (APP.cv) return;
    const H = innerHeight, linha = H * 0.42;
    let melhor = null, mh = Infinity;
    if (APP.mobile) {
      // celular: manda a vitrine mais visível (não uma linha fixa da tela)
      const rg = APP.regioes()[0];
      if (!rg) return;
      melhor = rg.alvo === inicio ? null : rg.alvo;
    } else {
      for (const el of planoEls) {
        const r = el.getBoundingClientRect();
        if (r.top <= linha && r.bottom >= linha && r.height < mh) { melhor = el; mh = r.height; }
      }
    }
    const plano = melhor ? melhor.dataset.plano : 'abertura';
    if (plano === APP.plano) return;
    APP.plano = plano;
    mostraLegenda(plano);
    const sec = melhor && melhor.closest('.sec');
    navLinks.forEach(a => a.setAttribute('aria-current', String(!!sec && a.getAttribute('href') === '#' + sec.id)));
    $$('.ativo').forEach(e => e.classList.remove('ativo'));
    if (melhor && melhor !== sec) melhor.classList.add('ativo');
    if (APP.acordar) APP.acordar();
  }
  // rAF quando a aba desenha; um temporizador garante a atualização mesmo com rAF estrangulado
  let agendado = false;
  const rodaPlano = () => { if (!agendado) return; agendado = false; atualizarPlano(); };
  addEventListener('scroll', () => {
    if (APP.acordar) APP.acordar();   // sai do repouso (e, no celular, as vitrines acompanham a rolagem)
    if (agendado) return; agendado = true; requestAnimationFrame(rodaPlano); setTimeout(rodaPlano, 120);
  }, { passive: true });

  /* ---------- cartão ↔ prédio ---------- */
  function setHover(id) {
    if (APP.hover === id) return;
    APP.hover = id;
    $$('#estatico .bld.acesa').forEach(g => g.classList.remove('acesa'));
    if (id) $$(`#estatico .bld[data-id="${id}"]`).forEach(g => g.classList.add('acesa'));
    if (APP.acordar) APP.acordar();
  }
  APP.setHover = setHover;
  document.addEventListener('mouseover', e => { const el = e.target.closest('[data-liga]'); setHover(el ? el.dataset.liga : null); });
  document.addEventListener('focusin', e => { const el = e.target.closest('[data-liga]'); if (el) setHover(el.dataset.liga); });
  document.addEventListener('focusout', e => { if (e.target.closest('[data-liga]')) setHover(null); });

  // prédio → conteúdo (clique/toque na cidade)
  APP.irPara = function (id) {
    const o = M.porId[id]; if (!o) return;
    let el = null, bloco = 'start';
    if (o.tipo === 'projeto') el = document.getElementById('projeto-' + id);
    else if (o.tipo === 'tecnologia') { el = $(`#matriz tr[data-liga="${id}"]`); bloco = 'center'; }
    else if (o.tipo === 'carreira') el = document.getElementById('exp-' + id);
    if (!el) return;
    irParaY(alvoDe(el), true);
    el.classList.add('realce');
    setTimeout(() => el.classList.remove('realce'), 2200);
    if (el.tabIndex >= 0) setTimeout(() => { try { el.focus({ preventScroll: true }); } catch (e) {} }, 500);
  };
  // realce do cartão quando o mouse passa num prédio
  APP.aoPassar = function (id) {
    $$('.pj.realce, .outros li.realce, #matriz tr.realce').forEach(e => e.classList.remove('realce'));
    if (!id) return;
    const o = M.porId[id]; if (!o) return;
    const el = o.tipo === 'projeto' ? document.getElementById('projeto-' + id) : o.tipo === 'tecnologia' ? $(`#matriz tr[data-liga="${id}"]`) : null;
    if (el) el.classList.add('realce');
  };

  /* ---------- visão recrutador ---------- */
  const btsCV = $$('[data-alterna-cv]');
  function setCV(on, doUsuario) {
    APP.cv = on;
    html.classList.toggle('modo-cv', on);
    btsCV.forEach(b => b.setAttribute('aria-pressed', String(on)));
    const u = new URL(location.href);
    if (on) u.searchParams.set('view', 'cv'); else u.searchParams.delete('view');
    history.replaceState(null, '', u);
    if (doUsuario) irParaY(0, false);
    if (!on) { APP.plano = null; medir(); atualizarPlano(); if (APP.acordar) APP.acordar(); }
  }
  btsCV.forEach(b => b.addEventListener('click', () => setCV(!APP.cv, true)));
  addEventListener('beforeprint', () => { if (!APP.cv) { html.classList.add('modo-cv'); APP._print = true; } });
  addEventListener('afterprint', () => { if (APP._print) { html.classList.remove('modo-cv'); APP._print = false; } });
  btsCV.forEach(b => b.setAttribute('aria-pressed', String(APP.cv)));

  /* ---------- copiar e-mail ---------- */
  $$('[data-copiar]').forEach(b => b.addEventListener('click', async () => {
    const aviso = $('.aviso-copia');
    try { await navigator.clipboard.writeText(b.dataset.copiar); aviso.textContent = 'E-mail copiado para a área de transferência.'; }
    catch (e) { aviso.textContent = 'Não deu para copiar aqui: ' + b.dataset.copiar; }
    setTimeout(() => { aviso.textContent = ''; }, 3500);
  }));

  /* ---------- no celular, só desenha a cidade quando alguma vitrine está à vista ---------- */
  if ('IntersectionObserver' in window) {
    const vis = new Set();
    const io = new IntersectionObserver(ents => {
      ents.forEach(e => { if (e.isIntersecting) vis.add(e.target); else vis.delete(e.target); });
      const antes = APP.visivel;
      APP.visivel = !APP.mobile || vis.size > 0;
      if (APP.visivel && !antes && APP.acordar) APP.acordar();
    });
    $$('.vitrine').forEach(v => io.observe(v));
    io.observe($('#inicio'));
  }

  /* =====================================================================
     VERSÃO ESTÁTICA — axonometria em SVG gerada da mesma planta
     ===================================================================== */
  // provisorio = true: o estático entra agora, mas o 3D continua carregando e assume se ficar pronto e fluido
  APP.falhou = function (motivo, provisorio) {
    const eraProvisorio = APP.provisorio;
    if (!provisorio) { APP.usar3D = false; APP.provisorio = false; }
    const m = $('#modo-3d');
    if (m) m.textContent = 'Você está vendo a versão estática da cidade (' + motivo + ').';
    if (html.classList.contains('sem-3d')) {
      if (eraProvisorio && !provisorio) try { construirEstatico(motivo); } catch (e) { console.error(e); }
      return;
    }
    html.classList.remove('recuperando');
    html.classList.add('sem-3d');
    if (provisorio) APP.provisorio = true;
    try { construirEstatico(motivo + (provisorio ? '; a versão 3D entra sozinha se terminar de carregar' : '')); } catch (e) { console.error(e); }
  };
  // o 3D chegou depois do estático: troca com um esmaecimento
  APP.recuperar = function () {
    if (!APP.provisorio || !APP.usar3D) return;
    APP.provisorio = false;
    html.classList.add('recuperando');
    html.classList.remove('sem-3d');
    setTimeout(() => html.classList.remove('recuperando'), 1000);
    const m = $('#modo-3d'); if (m) m.textContent = '';
  };
  function construirEstatico(motivo) {
    const th = 0.62, el = 0.56;
    const ct = Math.cos(th), st = Math.sin(th), ce = Math.cos(el), se = Math.sin(el);
    const pr = (x, y, z) => [x * ct - z * st, -(-x * st * se + y * ce - z * ct * se)];
    const dep = (x, y, z) => x * st * ce + y * se + z * ct * ce;
    const pts = a => a.map(p => pr(...p).map(v => v.toFixed(2)).join(',')).join(' ');
    const poly = (a, fill, extra = '') => `<polygon points="${pts(a)}" fill="${fill}" ${extra}/>`;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    const acc = (x, y, z) => { const [a, b] = pr(x, y, z); minX = Math.min(minX, a); maxX = Math.max(maxX, a); minY = Math.min(minY, b); maxY = Math.max(maxY, b); };
    const X0 = P.X0, Z0 = P.Z0, X1 = -P.X0, Z1 = -P.Z0, BASE = 1.1;
    [[X0, 0, Z0], [X1, 0, Z0], [X1, 0, Z1], [X0, 0, Z1], [X1, -BASE, Z1], [X0, -BASE, Z1], [X1, -BASE, Z0]].forEach(p => acc(...p));
    acc(0, 13, Z0 + 12);

    let s = '';
    // base (maquete) e folha
    s += poly([[X0, 0, Z1], [X1, 0, Z1], [X1, -BASE, Z1], [X0, -BASE, Z1]], '#353B47');
    s += poly([[X1, 0, Z0], [X1, 0, Z1], [X1, -BASE, Z1], [X1, -BASE, Z0]], '#262B35');
    s += poly([[X0, 0, Z0], [X1, 0, Z0], [X1, 0, Z1], [X0, 0, Z1]], '#F3F3F0');
    s += poly([[X0, 0, Z0], [X1, 0, Z0], [X1, 0, Z0 + P.CH], [X0, 0, Z0 + P.CH]], '#E3E6EA');
    s += poly([[X0, 0, Z0], [X0 + P.CW, 0, Z0], [X0 + P.CW, 0, Z1], [X0, 0, Z1]], '#E3E6EA');
    let g = '';
    for (let c = 0; c <= P.COLS; c++) { const x = P.cx(c), a = pr(x, 0, Z0), b = pr(x, 0, Z1); g += `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`; }
    for (let r = 0; r <= P.ROWS; r++) { const z = P.cz(r), a = pr(X0, 0, z), b = pr(X1, 0, z); g += `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`; }
    s += `<path d="${g}" stroke="#D2D7DE" stroke-width=".06" fill="none"/>`;
    // avenida: 1 célula por mês
    const cor = { astcon: '#B5A688', nm: '#7A705E', zen: '#2B3BEA' };
    for (let m = 0; m <= P.AV.fimAno; m++) {
      const x = P.AV.mx(m), z0 = P.AV.z - P.AV.largura / 2, z1 = P.AV.z + P.AV.largura / 2;
      let c = '#FFFFFF';
      if (m <= M.mesHoje) c = m === M.mes('2025-09') ? cor.nm : m > M.mes('2025-09') && m < M.mes('2026-02') ? cor.nm : m >= M.mes('2026-02') ? cor.zen : cor.astcon;
      s += poly([[x + .05, 0, z0], [x + P.AV.mw - .05, 0, z0], [x + P.AV.mw - .05, 0, z1], [x + .05, 0, z1]], c, m > M.mesHoje ? 'stroke="#C9CED6" stroke-width=".05"' : '');
    }
    // objetos ordenados por profundidade
    const objs = [];
    P.cenario.forEach(b => objs.push({ d: dep(b.x, 0, b.z), svg: caixa(b.x, b.z, b.w, b.d, 0, b.h, ['#DADEE4', '#C7CDD6', '#B3BAC5']) }));
    P.arvores.forEach(t => { const r = .45 * t.s; const [a, b] = pr(t.x, .9 * t.s, t.z); objs.push({ d: dep(t.x, 0, t.z), svg: `<circle cx="${a.toFixed(2)}" cy="${b.toFixed(2)}" r="${r.toFixed(2)}" fill="#9DB3A5"/><circle cx="${(a - r * .25).toFixed(2)}" cy="${(b - r * .25).toFixed(2)}" r="${(r * .55).toFixed(2)}" fill="#B6C8BC"/>` }); });
    P.marcos.forEach(mk => objs.push({ d: dep(mk.x, 0, mk.z), svg: `<g class="bld" data-id="${mk.id}" data-liga="${mk.id}"><title>${esc(mk.nome)}</title>` + caixa(mk.x, mk.z, .35, .35, 0, 3.2, ['#F5F6F7', '#E1E4E8', '#C9CED6']) + caixa(mk.x, mk.z, .38, .38, 2.7, 3.2, cor[mk.cor] === '#2B3BEA' ? ['#4B5AF0', '#2B3BEA', '#2230C4'] : [cor[mk.cor], cor[mk.cor], cor[mk.cor]]) + '</g>' }));
    P.predios.forEach(b => {
      const FH = P.FH, n = b.n, hw = b.w / 2;
      let svg = `<g class="bld" data-id="${b.id}" data-liga="${b.id}"><title>${esc(b.nome)} · ${n ? n + ' andares' : 'pavilhão, fora da matriz'}</title>`;
      if (!n) svg += caixa(b.x, b.z, b.w * 1.1, b.w * .9, 0, .7, ['#F3F4F5', '#6B7A90', '#556377']);
      else {
        svg += caixa(b.x, b.z, b.w, b.w, 0, n * FH, ['#F3F4F5', '#E6E9EC', '#CDD2D9']);
        for (let i = 0; i < n; i++) {
          const y0 = i * FH + .18, y1 = (i + 1) * FH - .02;
          svg += poly([[b.x - hw + .12, y0, b.z + hw], [b.x + hw - .12, y0, b.z + hw], [b.x + hw - .12, y1, b.z + hw], [b.x - hw + .12, y1, b.z + hw]], b.tipo === 'projeto' ? '#6E7F96' : '#8393A8');
          svg += poly([[b.x + hw, y0, b.z + hw - .12], [b.x + hw, y0, b.z - hw + .12], [b.x + hw, y1, b.z - hw + .12], [b.x + hw, y1, b.z + hw - .12]], b.tipo === 'projeto' ? '#56657A' : '#6A7A90');
        }
        const topo = b.status === 'producao' ? ['#3A49EE', '#2B3BEA', '#2231C8'] : ['#F7F8F9', '#E6E9EC', '#CDD2D9'];
        svg += caixa(b.x, b.z, b.w + .12, b.w + .12, n * FH, n * FH + .22, topo);
        if (b.antena) { const [a1, b1] = pr(b.x + hw * .5, n * FH + .2, b.z - hw * .5), [a2, b2] = pr(b.x + hw * .5, n * FH + 2.2, b.z - hw * .5); svg += `<line x1="${a1}" y1="${b1}" x2="${a2}" y2="${b2}" stroke="#444851" stroke-width=".08"/><circle cx="${a2}" cy="${b2}" r=".18" fill="#1FB35E"><animate attributeName="opacity" values="1;.2;1" dur="1.4s" repeatCount="indefinite"/></circle>`; }
      }
      svg += '</g>';
      objs.push({ d: dep(b.x, 0, b.z), svg });
    });
    objs.sort((a, b) => a.d - b.d).forEach(o => { s += o.svg; });
    // hoje
    { const [a, b] = pr(P.hoje.x, 0, P.hoje.z); s += `<ellipse cx="${a}" cy="${b}" rx=".9" ry=".5" fill="none" stroke="#2B3BEA" stroke-width=".12"/>`; }

    function caixa(x, z, w, d, y0, y1, [cTop, cZ, cX]) {
      const a = w / 2, b = d / 2;
      return poly([[x - a, y0, z + b], [x + a, y0, z + b], [x + a, y1, z + b], [x - a, y1, z + b]], cZ) +
        poly([[x + a, y0, z + b], [x + a, y0, z - b], [x + a, y1, z - b], [x + a, y1, z + b]], cX) +
        poly([[x - a, y1, z - b], [x + a, y1, z - b], [x + a, y1, z + b], [x - a, y1, z + b]], cTop);
    }
    const pad = .6, W = maxX - minX + pad * 2, H = maxY - minY + pad * 2;
    const box = $('#estatico');
    box.innerHTML = `<svg viewBox="${(minX - pad).toFixed(1)} ${(minY - pad).toFixed(1)} ${W.toFixed(1)} ${H.toFixed(1)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Maquete estática da cidade de dados">${s}</svg>` +
      `<p class="estatico-nota">Versão estática da cidade: ${esc(motivo)}. Toque num prédio para ir ao projeto.</p>`;
    box.querySelector('svg').addEventListener('click', e => { const g = e.target.closest('.bld'); if (g) APP.irPara(g.dataset.id); });
  }

  /* ---------- decide: 3D ou estático, já no carregamento ---------- */
  (function decidir() {
    if (Q.get('webgl') === '0') return APP.falhou('modo sem 3D pedido pela URL');
    let gl = null;
    try { const c = document.createElement('canvas'); gl = c.getContext('webgl2') || c.getContext('webgl'); } catch (e) {}
    if (!gl) return APP.falhou('este navegador não abriu o WebGL');
    try {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
      APP.gpuFraca = /swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(r);
      APP.gpu = r;
    } catch (e) {}
    if (APP.gpuFraca && !APP.captura) return APP.falhou('sem aceleração gráfica neste aparelho');
    APP.usar3D = true;
    // se o 3D não subir rápido (rede lenta, CDN fora do ar), mostra o estático em 6 s — de forma
    // provisória: o carregamento continua e, se o 3D terminar e rodar bem, ele assume (APP.recuperar).
    // O relógio só anda com a aba visível: aba aberta em segundo plano não conta como lentidão.
    let espera = 0;
    const limite = APP.captura ? 30000 : 6000;
    const relogio = setInterval(() => {
      if (APP.cidadeOk || !APP.usar3D) return clearInterval(relogio);
      if (document.visibilityState !== 'visible') return;
      espera += 250;
      if (espera > limite + (APP.carregou3D ? 3000 : 0)) { clearInterval(relogio); APP.falhou(APP.carregou3D ? 'o 3D ainda não conseguiu desenhar' : 'o 3D está demorando a carregar', true); }
    }, 250);
  })();

  /* ---------- estados por URL: ?secao= ?foco= ?view=cv ?webgl=0 ---------- */
  function aplicarURL() {
    const foco = Q.get('foco'), secao = Q.get('secao');
    let el = null;
    if (foco && M.porId[foco]) {
      const o = M.porId[foco];
      el = o.tipo === 'projeto' ? document.getElementById('projeto-' + foco) : o.tipo === 'carreira' ? document.getElementById('exp-' + foco) : $(`#matriz tr[data-liga="${foco}"]`);
      if (o.tipo === 'tecnologia') setHover(foco);
    } else if (secao) {
      const mapa = { inicio: 'inicio', abertura: 'inicio', perfil: 'perfil', experiencia: 'experiencia', projetos: 'projetos', habilidades: 'habilidades', formacao: 'formacao', contato: 'contato' };
      el = document.getElementById(mapa[secao] || secao);
    }
    // no celular, o foco num projeto mostra a vitrine (a cidade) logo acima do cartão
    if (el && APP.mobile && el.parentElement && el.parentElement.previousElementSibling && el.parentElement.previousElementSibling.classList.contains('vitrine-pj')) el = el.parentElement.previousElementSibling;
    // no celular, a seção aberta pela URL mostra a vitrine centrada (a cidade no meio da tela)
    const vit = el && APP.mobile && el.classList.contains('sec') && el.id !== 'inicio' ? el.querySelector(':scope > .vitrine') : null;
    if (el && !APP.cv) irParaY(el.id === 'inicio' ? 0 : vit ? topoDe(vit) - (innerHeight - vit.offsetHeight) / 2 : alvoDe(el), false);
    APP.plano = null; atualizarPlano();
  }
  aplicarURL();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { medir(); if (Q.has('foco') || Q.has('secao')) aplicarURL(); });
})();
