/* =====================================================================
   DADOS — única fonte de números e fatos deste protótipo.
   Tudo vem de _prototipos/conteudo.md.
   Números marcados com * no conteudo.md aguardam confirmação do Alyssom:
   ficam em PENDENTE (pendente: true). Troque aqui e a página inteira muda
   (elementos com data-num="chave" no HTML são preenchidos a partir daqui).
   ===================================================================== */
window.DATA = (function () {
  'use strict';

  // * números aguardando confirmação
  const PENDENTE = {
    empresasClientes:      { valor: '60+',  pendente: true, fonte: 'Astcon — empresas clientes de DP/RH' },
    unidadesNegocio:       { valor: '3',    pendente: true, fonte: 'Grupo Zen — unidades de negócio' },
    planilhasSubstituidas: { valor: '6+',   pendente: true, fonte: 'Fuel Mind — planilhas desconectadas substituídas' },
    menosChamadasIA:       { valor: '~90%', pendente: true, fonte: 'FlowTrack — afirmado no README' },
  };

  // números confirmados
  const NUMEROS = {
    anosCarreira: '5+',
    projetos: 9,
    emProducao: 2,
    demosAoVivo: 3,
    testesFuelMind: 102,
    testesFlowTrack: 83,
    bancosFlowTrack: 4,
    camadasIA: 3,
    perfisPraxis: 6,
    eventosPraxis: 14,
  };

  const GH = 'https://github.com/alyssom-fernandes';

  return {
    PENDENTE,
    NUMEROS,
    pessoa: {
      nome: 'Alyssom Fernandes',
      titulo: 'Developer · Data & Business Intelligence',
      tese: 'Passei 5 anos dentro das planilhas. Hoje construo os sistemas que as substituem.',
      local: 'Brasil · UTC−3',
      disponibilidade: 'Remoto ou relocação para Espanha e Portugal',
      visto: 'visto de nômade digital em andamento',
      email: 'alyssom1919@gmail.com',
      linkedin: 'https://linkedin.com/in/alyssom-fernandes',
      github: GH,
      whatsapp: 'https://wa.me/5562996674854',
      whatsappRotulo: '+55 62 99667-4854',
      cv: '../../cv/Alyssom-Fernandes-CV-PT.pdf',
      comparacao: '../index.html',
    },

    // cronológico; datas em AAAA-MM; fim null = atual
    carreira: [
      { id: 'astcon', inicio: '2021-02', fim: '2025-09', empresa: 'Astcon Assessoria Contábil', curto: 'Astcon', cor: 'astcon' },
      { id: 'novo-mexico', inicio: '2025-09', fim: '2026-01', empresa: 'Fazenda Novo México', curto: 'Novo México', cor: 'nm' },
      { id: 'grupo-zen', inicio: '2026-02', fim: null, empresa: 'Grupo Zen', curto: 'Grupo Zen', cor: 'zen', projetos: ['fuel-mind', 'alertsignal'] },
    ],

    // status: producao | demo-ao-vivo | demo | codigo
    // repo: repositório público (URLs já usadas no site atual, index.html na raiz). Sem repo → o link
    // da página vira "Perfil no GitHub", para não prometer um código que não está lá.
    projetos: [
      { id: 'fuel-mind',   nome: 'Fuel Mind',   status: 'producao',     rotulo: 'Em produção',  demo: 'https://controle-entradas-posto.web.app', destaque: true, origem: 'grupo-zen', repo: GH + '/Fuel-Mind' },
      { id: 'praxis',      nome: 'Praxis',      status: 'demo-ao-vivo', rotulo: 'Demo ao vivo', demo: 'https://praxis-af618.web.app', destaque: true, repo: GH + '/Praxis' },
      { id: 'flowtrack',   nome: 'FlowTrack',   status: 'codigo',       rotulo: 'Código',       nota: 'backend fora do ar no momento', destaque: true, repo: GH + '/FlowTrack' },
      { id: 'alertsignal', nome: 'AlertSignal', status: 'producao',     rotulo: 'Em produção',  destaque: true, origem: 'grupo-zen', repo: GH + '/AlertSignal' },
      { id: 'docke',       nome: 'Docke',       status: 'codigo',       rotulo: 'Código', repo: GH + '/Docke' },
      { id: 'unifydata',   nome: 'UnifyData',   status: 'codigo',       rotulo: 'Código', repo: [{ rot: 'Web', url: GH + '/UnifyData-Web' }, { rot: 'Python', url: GH + '/UnifyData-Python' }] },
      { id: 'audistock',   nome: 'AudiStock',   status: 'codigo',       rotulo: 'Código', repo: GH + '/AudiStock' },
      { id: 'deepchat',    nome: 'DeepChat',    status: 'demo',         rotulo: 'Demo',         nota: 'exige chave de API própria', demo: 'https://alyssom-fernandes.github.io/DeepChat/', repo: GH + '/DeepChat' },
      { id: 'artmaker',    nome: 'ArtMaker',    status: 'demo-ao-vivo', rotulo: 'Demo ao vivo', demo: 'https://alyssom-fernandes.github.io/ArtMaker/', repo: GH + '/ArtMaker' },
    ],
    github: GH,

    // Matriz tecnologias × projetos (evidência real, já usada no site atual).
    // padrão: 1 caractere por coluna, na ordem de `colunas`; último número = coluna Total.
    matriz: {
      colunas: ['fuel-mind', 'praxis', 'flowtrack', 'alertsignal', 'docke', 'unifydata', 'audistock'],
      linhas: [
        ['Autenticação & perfis de acesso', 'Auth & perfis', '1111101', 6],
        ['Relatórios PDF / Excel',          'PDF / Excel',   '1111011', 6],
        ['JavaScript',                      'JavaScript',    '1101011', 5],
        ['Python',                          'Python',        '0011110', 4],
        ['Dashboards & KPIs',               'Dashboards',    '1110100', 4],
        ['PostgreSQL / Supabase',           'PostgreSQL',    '0010101', 3],
        ['Jobs agendados',                  'Jobs',          '0111000', 3],
        ['Tempo real & offline',            'Tempo real',    '1010001', 3],
        ['Testes automatizados',            'Testes',        '1010100', 3],
        ['TypeScript',                      'TypeScript',    '0010100', 2],
        ['React',                           'React',         '0010100', 2],
        ['FastAPI',                         'FastAPI',       '0010100', 2],
        ['Firebase',                        'Firebase',      '1100000', 2],
        ['pandas',                          'pandas',        '0001010', 2],
        ['CI (GitHub Actions)',             'CI',            '0010100', 2],
        ['Flask + SQLite',                  'Flask',         '0001000', 1],
        ['IA generativa (Claude)',          'IA generativa', '0010000', 1],
        ['OCR (Tesseract)',                 'OCR',           '0000100', 1],
        ['NF-e (XML)',                      'NF-e',          '1000000', 1],
      ],
      // "Tecnologias por projeto (soma da coluna)" — usado para conferir a matriz
      somaPorProjeto: { 'fuel-mind': 8, praxis: 6, flowtrack: 13, alertsignal: 7, docke: 10, unifydata: 4, audistock: 5 },
    },
  };
})();

/* ---------- modelo derivado (usado pela página e pela cidade) ---------- */
window.MODELO = (function (D) {
  'use strict';
  const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const cols = D.matriz.colunas;
  const techs = D.matriz.linhas.map(([nome, curto, padrao, total]) => ({
    tipo: 'tecnologia', id: 'tec-' + slug(nome), nome, curto, total,
    usa: cols.filter((c, j) => padrao[j] === '1'),
  }));
  techs.forEach(t => { if (t.usa.length !== t.total) console.warn('Matriz: total diverge em', t.nome); });
  const projetos = D.projetos.map(p => Object.assign({ tipo: 'projeto' }, p, {
    techs: techs.filter(t => t.usa.includes(p.id)),
    naMatriz: cols.includes(p.id),
  }));
  projetos.forEach(p => {
    const esperado = D.matriz.somaPorProjeto[p.id];
    if (esperado != null && esperado !== p.techs.length) console.warn('Matriz: soma diverge em', p.nome);
  });
  const carreira = D.carreira.map(c => Object.assign({ tipo: 'carreira' }, c));
  const porId = {};
  [...projetos, ...techs, ...carreira].forEach(o => { porId[o.id] = o; });

  // meses: índice 0 = fev/2021
  const mes = s => { const [a, m] = s.split('-').map(Number); return (a - 2021) * 12 + (m - 2); };
  const hoje = new Date();
  const mesHoje = Math.max(mes('2026-02'), (hoje.getFullYear() - 2021) * 12 + hoje.getMonth() + 1 - 2);

  // quem se relaciona com quem (para destacar prédios ligados)
  function relacionados(id) {
    const s = new Set([id]); const o = porId[id]; if (!o) return s;
    if (o.tipo === 'projeto') { o.techs.forEach(t => s.add(t.id)); if (o.origem) s.add(o.origem); }
    if (o.tipo === 'tecnologia') o.usa.forEach(p => s.add(p));
    if (o.tipo === 'carreira' && o.projetos) o.projetos.forEach(p => s.add(p));
    return s;
  }
  return { projetos, techs, carreira, porId, slug, mes, mesHoje, relacionados };
})(window.DATA);

/* ---------- planta da cidade (compartilhada pelo 3D e pela versão estática) ----------
   O chão é uma folha de cálculo: COLS colunas × ROWS linhas. Cada prédio ocupa um
   bloco de células. Nada aqui é dado novo: só posições derivadas do MODELO. */
window.PLANTA = (function (M) {
  'use strict';
  const CW = 1.8, CH = 0.9, COLS = 46, ROWS = 56;
  const SX = COLS * CW, SZ = ROWS * CH, X0 = -SX / 2, Z0 = -SZ / 2;
  const cx = c => X0 + c * CW, cz = r => Z0 + r * CH;
  const FH = 0.9;
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  const predios = [];
  // bairro dos projetos: 3 × 3, bloco de 2 colunas × 4 linhas.
  // Linha 0 fica no fundo; a câmera vem da frente e da direita. As torres mais altas vão para trás
  // (FlowTrack atrás e à esquerda) e os pavilhões térreos para a frente, para nenhum destaque ficar escondido.
  const ordemP = [['flowtrack', 'docke', 'alertsignal'], ['fuel-mind', 'praxis', 'unifydata'], ['audistock', 'artmaker', 'deepchat']];
  const pc = [25, 29, 33], pr = [14, 22, 30];
  ordemP.forEach((linha, i) => linha.forEach((id, j) => {
    const p = M.porId[id];
    predios.push({ id, tipo: 'projeto', nome: p.nome, ref: p, c0: pc[j], r0: pr[i], nc: 2, nr: 4,
      x: cx(pc[j]) + CW, z: cz(pr[i]) + 2 * CH, w: 3.2, n: p.techs.length, status: p.status,
      antena: p.status === 'demo-ao-vivo' || p.id === 'fuel-mind' });
  }));
  // bairro das tecnologias: 5 por linha, bloco de 1 coluna × 2 linhas, da mais usada para a menos usada
  const ordT = M.techs.slice().sort((a, b) => b.total - a.total || M.techs.indexOf(a) - M.techs.indexOf(b));
  ordT.forEach((t, i) => {
    const c0 = 10 + 2 * (i % 5), r0 = 14 + 4 * Math.floor(i / 5);
    predios.push({ id: t.id, tipo: 'tecnologia', nome: t.nome, curto: t.curto, ref: t, c0, r0, nc: 1, nr: 2,
      x: cx(c0) + CW / 2, z: cz(r0) + CH, w: 1.5, n: t.total, status: 'tec' });
  });

  // avenida da carreira: 1 célula (meia coluna) por mês, a partir de fev/2021
  const AV = { r0: 42, nr: 2, x0: cx(4), mw: CW / 2, z: cz(42) + CH, largura: 2 * CH };
  AV.mx = m => AV.x0 + m * AV.mw;               // borda esquerda do mês m
  AV.fimAno = M.mes('2026-12');                   // até dez/2026 (meses futuros ficam vazios)
  const marcos = M.carreira.map(c => ({ id: c.id, tipo: 'carreira', nome: c.empresa, ref: c, cor: c.cor,
    x: AV.mx(M.mes(c.inicio)) + AV.mw / 2, z: cz(41) + CH / 2 }));
  const hoje = { x: AV.mx(M.mesHoje) + AV.mw / 2, z: AV.z };
  const m2026 = M.mes('2026-01');
  const formacao = { x: AV.mx(m2026 + 6), z: cz(45) + CH / 2 };

  // reserva de células (cenário não invade dados, avenida e praça)
  const occ = new Uint8Array(COLS * ROWS);
  const reserva = (c0, r0, nc, nr) => { for (let c = Math.max(0, c0); c < Math.min(COLS, c0 + nc); c++) for (let r = Math.max(0, r0); r < Math.min(ROWS, r0 + nr); r++) occ[r * COLS + c] = 1; };
  const livre = (c0, r0, nc, nr) => { if (c0 < 1 || r0 < 1 || c0 + nc > COLS - 1 || r0 + nr > ROWS - 1) return false; for (let c = c0; c < c0 + nc; c++) for (let r = r0; r < r0 + nr; r++) if (occ[r * COLS + c]) return false; return true; };
  reserva(0, 0, COLS, 2); reserva(0, 0, 2, ROWS);
  reserva(8, 12, 13, 19);   // tecnologias
  reserva(23, 12, 15, 24);  // projetos
  reserva(20, 12, 4, 20);   // praça
  reserva(1, 38, COLS, 9);  // avenida + calçadas

  const cenario = [];
  const R = rng(20260929);
  const tenta = (area, n, hMin, hMax) => {
    let feitos = 0;
    for (let k = 0; k < n * 40 && feitos < n; k++) {
      const nc = 1 + Math.floor(R() * 2.2), nr = 2 + Math.floor(R() * 4);
      const c0 = area[0] + Math.floor(R() * (area[2] - nc + 1)), r0 = area[1] + Math.floor(R() * (area[3] - nr + 1));
      if (!livre(c0 - 1, r0 - 1, nc + 1, nr + 1)) continue;
      reserva(c0, r0, nc, nr);
      const h = hMin + Math.pow(R(), 1.6) * (hMax - hMin);
      cenario.push({ x: cx(c0) + nc * CW / 2, z: cz(r0) + nr * CH / 2, w: nc * CW - .5, d: nr * CH - .45, h });
      feitos++;
    }
  };
  tenta([2, 2, 43, 10], 34, .8, 4.2);   // fundo
  tenta([2, 12, 6, 26], 12, 1, 5);       // lateral esquerda
  tenta([38, 12, 7, 26], 12, 1, 5.5);    // lateral direita
  tenta([2, 47, 43, 8], 16, .5, 1.8);    // frente (baixos, não tampam a câmera)

  const arvores = [];
  const Rt = rng(7);
  for (let x = cx(3); x < cx(45); x += CW * 1.25) {
    if (!marcos.some(m => Math.abs(m.x - x) < 1.1)) arvores.push({ x: x + (Rt() - .5) * .3, z: cz(40) + CH / 2, s: .7 + Rt() * .25 });
    if (Rt() < .45) arvores.push({ x: x + CW * .6 + (Rt() - .5) * .3, z: cz(46) + CH / 2, s: .65 + Rt() * .25 });
  }
  for (let c = 20; c < 24; c++) for (let r = 13; r < 31; r += 2) if (Rt() < .72) arvores.push({ x: cx(c) + CW / 2 + (Rt() - .5) * .6, z: cz(r) + CH + (Rt() - .5) * .5, s: .75 + Rt() * .5 });
  for (let k = 0; k < 400 && arvores.length < 96; k++) {
    const c = 1 + Math.floor(Rt() * (COLS - 2)), r = 1 + Math.floor(Rt() * (ROWS - 2));
    if (occ[r * COLS + c]) continue;
    occ[r * COLS + c] = 1;
    arvores.push({ x: cx(c) + CW / 2, z: cz(r) + CH / 2, s: .7 + Rt() * .5 });
  }

  const porId = {};
  predios.forEach(p => { porId[p.id] = p; });
  marcos.forEach(m => { porId[m.id] = m; });
  return { CW, CH, COLS, ROWS, SX, SZ, X0, Z0, cx, cz, FH, predios, marcos, hoje, formacao, AV, cenario, arvores, porId, rng };
})(window.MODELO);
