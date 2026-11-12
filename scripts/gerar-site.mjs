// Gera o site estático a partir da fonte única de dados.
//
// Uso (na pasta do projeto):
//   npm run build                              gera index.html (pt-BR), en/ e es/ e as páginas de cada projeto
//                                              (projetos/<id>/, en/projetos/<id>/, es/projetos/<id>/)
//   npm run build -- --idiomas pt              gera só os idiomas listados (separados por vírgula); as páginas
//                                              dos outros idiomas ficam como estão (e continuam no seletor de
//                                              idioma, nos hreflang e no sitemap). Também aceita IDIOMAS=pt
//   node scripts/gerar-site.mjs --og <pasta>   também grava os modelos da imagem de compartilhamento
//                                              (og-<idioma>.html) nessa pasta; usado por scripts/gerar-cv.ps1
//
// Entradas:
//   fonte/dados.json            tudo que não é texto humano (links, datas, números, projetos, matriz)
//   fonte/textos.<idioma>.json  todo texto humano; um idioma fica ativo quando o arquivo existe
//   assets/projetos/manifesto.json  capturas de tela (largura, altura, variante de 960 px)
//
// Marcação permitida nos textos (nada de HTML):
//   *ênfase*   **negrito**   ~riscado~   {variavel}
// As variáveis vêm dos dados ({empresasClientesBase}, {carreira.zen.ano}...) ou são calculadas aqui
// ({projetosPublicados}, {demosAtivas}, {testesTotal}...). Nenhuma contagem é escrita à mão.
//
// O gerador para com uma mensagem clara se faltar chave em algum idioma ativo, se um projeto citar
// uma tela que não existe no manifesto ou se um projeto não tiver os campos mínimos.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lerJson = rel => {
  const arq = path.join(raiz, rel);
  try { return JSON.parse(readFileSync(arq, 'utf8')); }
  catch (e) { falhar([`não consegui ler ${rel}: ${e.message}`]); }
};
function falhar(erros) {
  console.error('\n✖ O site não foi gerado. Corrija:\n');
  for (const e of erros) console.error('  • ' + e);
  console.error('');
  process.exit(1);
}

const args = process.argv.slice(2);
const ogDir = args.includes('--og') ? path.resolve(args[args.indexOf('--og') + 1] || '') : null;
const pedidoIdiomas = (args.includes('--idiomas') ? args[args.indexOf('--idiomas') + 1] : process.env.IDIOMAS) || '';
const listaPedida = pedidoIdiomas.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

/* 1. Leitura */

const dados = lerJson('fonte/dados.json');
const manifesto = lerJson('assets/projetos/manifesto.json');
const comTextos = dados.site.idiomas.filter(i => existsSync(path.join(raiz, 'fonte', `textos.${i.codigo}.json`)));
const padrao = dados.site.idiomaPadrao;
if (!comTextos.some(i => i.codigo === padrao)) falhar([`falta fonte/textos.${padrao}.json (idioma padrão)`]);
if (listaPedida.length) {
  const desconhecidos = listaPedida.filter(c => !comTextos.some(i => i.codigo === c));
  if (desconhecidos.length) falhar([`--idiomas: ${desconhecidos.join(', ')} não tem fonte/textos.<idioma>.json (há: ${comTextos.map(i => i.codigo).join(', ')})`]);
}
const idiomasAtivos = listaPedida.length ? comTextos.filter(i => listaPedida.includes(i.codigo)) : comTextos;
const idiomasLinks = comTextos.filter(i => idiomasAtivos.includes(i) || existsSync(path.join(raiz, i.pasta, 'index.html')));
const textosTodos = Object.fromEntries(comTextos.map(i => [i.codigo, lerJson(`fonte/textos.${i.codigo}.json`)]));
const textos = Object.fromEntries(idiomasAtivos.map(i => [i.codigo, textosTodos[i.codigo]]));

const projetos = [...dados.projetos].sort((a, b) => a.ordem - b.ordem);
const carreira = dados.carreira;
const hoje = new Date();
const mesIdx = (y, m) => y * 12 + (m - 1);
const HOJE = mesIdx(hoje.getFullYear(), hoje.getMonth() + 1);

/* 2. Valores calculados */

const inicioCarreira = carreira[0].inicio;
const temDemoAtiva = p => !!(p.demo && p.demo.ativa);
const somaTestes = p => Object.values(p.testes || {}).reduce((a, n) => a + n, 0);
const calc = {
  anoInicio: String(inicioCarreira[0]),
  projetosPublicados: String(projetos.length),
  demosAtivas: String(projetos.filter(temDemoAtiva).length),
  fuso: dados.identidade.fuso,
  'formacao.conclusao': String(dados.formacao.conclusao),
  'formacao.instituicao': dados.formacao.instituicao
};

/* 3. Validação */

const erros = [];
function achatar(obj, pre = '', out = {}) {
  if (Array.isArray(obj)) {
    out[pre + '#'] = obj.length;
    obj.forEach((v, i) => achatar(v, `${pre}${i}.`, out));
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) if (!k.startsWith('_')) achatar(v, `${pre}${k}.`, out);
  } else out[pre.slice(0, -1)] = obj;
  return out;
}
const planos = Object.fromEntries(Object.entries(textos).map(([c, t]) => [c, achatar(t)]));
const planoPadrao = achatar(textosTodos[padrao]);
const desatualizados = [];
for (const [cod, plano] of Object.entries(planos)) {
  if (cod === padrao) continue;
  const antes = erros.length;
  for (const k of Object.keys(planoPadrao)) {
    if (!(k in plano)) erros.push(`textos.${cod}.json: falta a chave "${k.replace(/\.#$/, '')}"`);
    else if (k.endsWith('#') && plano[k] !== planoPadrao[k]) erros.push(`textos.${cod}.json: "${k.slice(0, -2)}" tem ${plano[k]} itens (em ${padrao}: ${planoPadrao[k]})`);
  }
  for (const k of Object.keys(plano)) if (!(k in planoPadrao)) erros.push(`textos.${cod}.json: chave "${k.replace(/\.#$/, '')}" não existe em textos.${padrao}.json`);
  if (erros.length > antes) desatualizados.push(cod);
}
for (const [cod, plano] of Object.entries(planos))
  for (const [k, v] of Object.entries(plano))
    if (typeof v === 'string' && /<[a-z/!]/i.test(v)) erros.push(`textos.${cod}.json: "${k}" tem HTML; use *ênfase*, **negrito** ou ~riscado~`);

const ids = new Set();
const temTexto = (cod, chave) => typeof pegar(textos[cod], chave) === 'string';
const daVitrine = p => (p.itens || []).filter(it => it.vitrine);
for (const p of projetos) {
  const onde = `projeto "${p.id || '?'}"`;
  for (const campo of ['id', 'nome', 'ordem', 'cor', 'codigo', 'stack', 'telas', 'itens', 'testes', 'composicao'])
    if (p[campo] === undefined || p[campo] === '') erros.push(`${onde}: falta o campo "${campo}"`);
  if (!p.id) continue;
  if (ids.has(p.id)) erros.push(`${onde}: id repetido`);
  ids.add(p.id);
  if (!Array.isArray(p.codigo) || !p.codigo.length || p.codigo.some(c => !c.url || !c.rotulo)) erros.push(`${onde}: "codigo" precisa de ao menos um { rotulo, url }`);
  if (p.demo && (typeof p.demo.url !== 'string' || typeof p.demo.ativa !== 'boolean')) erros.push(`${onde}: "demo" precisa de { url, ativa: true|false } (ou null)`);
  if (!temDemoAtiva(p) && !p.comoRodar) erros.push(`${onde}: sem demo ativa, precisa de "comoRodar" (link por idioma para a seção do README)`);
  if (p.comoRodar) for (const i of comTextos) if (!p.comoRodar[i.codigo]) erros.push(`${onde}: "comoRodar" não tem o idioma ${i.codigo}`);
  if (p.composicao && !['dir', 'esq'].includes(p.composicao.lado)) erros.push(`${onde}: composicao.lado deve ser "dir" ou "esq"`);
  if (p.composicao && ![null, 'sempre', 'destaque'].includes(p.composicao.celular)) erros.push(`${onde}: composicao.celular deve ser "sempre", "destaque" ou null`);
  if (p.composicao && p.composicao.celular && !p.celular) erros.push(`${onde}: composicao.celular pede um "celular"`);
  const telas = Array.isArray(p.telas) ? p.telas : [];
  if (!telas.length) erros.push(`${onde}: precisa de ao menos uma tela`);
  for (const k of telas) if (!manifesto[k]) erros.push(`${onde}: a tela "${k}" não existe em assets/projetos/manifesto.json`);
  if (p.abertura && !manifesto[p.abertura]) erros.push(`${onde}: a abertura "${p.abertura}" não existe em assets/projetos/manifesto.json`);
  if (p.celular && !manifesto[p.celular]) erros.push(`${onde}: o celular "${p.celular}" não existe em assets/projetos/manifesto.json`);
  if (!p.legenda) erros.push(`${onde}: precisa de "legenda" ("demo" ou "repositorio")`);
  for (const it of p.itens || [])
    if (it.tela === 'celular' ? !p.celular : !telas.includes(it.tela)) erros.push(`${onde}: o item "${it.id}" usa a tela "${it.tela}", que não está em "telas"${it.tela === 'celular' ? ' (nem há "celular")' : ''}`);
  const vit = daVitrine(p);
  if (vit.length < 2 || vit.length > 4) erros.push(`${onde}: o resumo precisa de 2 a 4 itens com "vitrine": true (tem ${vit.length})`);
  if (vit.length && vit[0].tela === 'celular') erros.push(`${onde}: o primeiro item do resumo não pode ser o "celular"`);
  if ((p.itens || []).length < 3 || (p.itens || []).length > 5) erros.push(`${onde}: a página de detalhe pede de 3 a 5 itens (tem ${(p.itens || []).length})`);
  for (const cod of Object.keys(textos)) {
    const req = ['frase', 'origem', 'origemLonga', 'problema', 'resumo', 'prova', 'cv'].map(k => `projetos.${p.id}.${k}`);
    for (const it of p.itens || []) req.push(`projetos.${p.id}.itens.${it.id}.titulo`, `projetos.${p.id}.itens.${it.id}.texto`);
    for (const k of [...telas, ...(p.abertura ? [p.abertura] : []), ...(p.celular ? [p.celular] : [])]) req.push(`alt.${k.replace('/', '.')}`);
    req.push(`projetos.legendas.${p.legenda}`);
    for (const c of p.codigo || []) req.push(`interface.rotulosCodigo.${c.rotulo}`);
    for (const s of p.stack || []) if (typeof s === 'object') req.push(s.texto);
    for (const k of req) if (!temTexto(cod, k)) erros.push(`textos.${cod}.json: falta "${k}" (${onde})`);
  }
}

const M = dados.matriz;
for (const c of M.colunas) if (!ids.has(c)) erros.push(`matriz: a coluna "${c}" não é um projeto`);
for (const l of M.linhas) {
  if (l.marcas.length !== M.colunas.length || /[^01]/.test(l.marcas)) erros.push(`matriz: a linha "${l.id}" precisa de ${M.colunas.length} marcas 0/1`);
  for (const cod of Object.keys(textos)) if (!temTexto(cod, `habilidades.linhas.${l.id}`)) erros.push(`textos.${cod}.json: falta "habilidades.linhas.${l.id}"`);
}
// cada linha da matriz fica em exatamente um grupo, e os grupos seguem a ordem das linhas
const nosGrupos = (M.grupos || []).flatMap(g => g.linhas);
if (nosGrupos.join() !== M.linhas.map(l => l.id).join()) erros.push('matriz: "grupos" precisa listar todas as linhas, uma vez cada, na ordem de "linhas"');
for (const g of M.grupos || []) for (const cod of Object.keys(textos)) if (!temTexto(cod, `habilidades.grupos.${g.id}`)) erros.push(`textos.${cod}.json: falta "habilidades.grupos.${g.id}"`);
const idsCarreira = new Set(carreira.map(c => c.id));
for (const n of dados.negocio) for (const o of n.onde) if (!idsCarreira.has(o)) erros.push(`negocio "${n.id}": "${o}" não está na carreira`);
carreira.forEach((c, i) => { if (c.fim === null && i !== carreira.length - 1) erros.push(`carreira "${c.id}": só a última fase pode ter fim null`); });

const varsProjetos = new Set(projetos.flatMap(p => [...Object.keys(p.numeros || {}), ...Object.keys(p.testes || {}), 'testesTotal']));
const varsLocais = new Set(['mes', 'mesCurto', 'ano', 'dia', 'inicio', 'fim', 'texto', 'n', 'total', 'nome', 'frase', 'rotulo', 'data',
  'linkEmail', 'linkWhatsapp', 'linkGithub']);
const varsCarreira = new Set(carreira.flatMap(c => ['empresa', 'curto', 'cargo', 'cargoFormal', 'inicio', 'inicioLongo', 'fim', 'fimLongo', 'periodo', 'anos', 'ano', 'anoInicio', 'anoFim'].map(k => `carreira.${c.id}.${k}`)));
const varsGlobais = new Set([...Object.keys(dados.numeros), ...Object.keys(dados.numeros).map(k => k + 'Base'), ...Object.keys(calc),
  'pais', 'marca', 'formacao.curso', 'formacao.cursoCurto', 'atualizado']);
for (const [cod, plano] of Object.entries(planos))
  for (const [k, v] of Object.entries(plano))
    if (typeof v === 'string') for (const [, nome] of v.matchAll(/\{([^}]+)\}/g))
      if (![varsProjetos, varsLocais, varsCarreira, varsGlobais].some(s => s.has(nome))) erros.push(`textos.${cod}.json: "${k}" usa a variável {${nome}}, que não existe`);

if (desatualizados.length) erros.push(`Traduções desatualizadas (${desatualizados.map(c => `textos.${c}.json`).join(', ')}). Para gerar só o ${padrao.toUpperCase()} enquanto elas não chegam: npm run build -- --idiomas ${padrao}`);
if (erros.length) falhar(erros);

/* 4. Utilidades de texto */

function pegar(obj, chave) { return chave.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function preencher(modelo, vars, contexto) {
  return String(modelo).replace(/\{([^}]+)\}/g, (_, nome) => {
    if (!(nome in vars)) falhar([`variável {${nome}} sem valor em "${contexto}"`]);
    return vars[nome];
  });
}
function marcar(s, { risco = 'risco', marca = 'marca', semRisco = false } = {}) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, marca ? `<em class="${marca}">$1</em>` : '<em>$1</em>')
    .replace(/~(.+?)~/g, semRisco ? '$1' : `<span class="${risco}">$1</span>`);
}
const limpar = s => String(s).replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/~(.+?)~/g, '$1');
const hash = rel => createHash('md5').update(readFileSync(path.join(raiz, rel))).digest('hex').slice(0, 8);
const host = u => u.replace(/^https?:\/\//, '').replace(/[?#].*$/, '').replace(/\/$/, '');
const fmtN = (n, lang) => new Intl.NumberFormat(lang).format(n);
const novaAba = ' target="_blank" rel="noopener"';
// texto que troca de cor no cabeçalho (papel ↔ tela): duas camadas, só a primeira é lida
const dup = t => `<span class="t0">${t}</span><span class="t1" aria-hidden="true">${t}</span>`;

const FONTES = { serif: 'assets/fonts/fraunces-latin.woff2', serifItalico: 'assets/fonts/fraunces-italic-latin.woff2', sans: 'assets/fonts/geist-latin.woff2' };

/* 5. Contexto de um idioma (variáveis e funções de texto) */

function contexto(idioma) {
  const cod = idioma.codigo;
  const T = textos[cod];
  const F = T.formato;
  const mesAno = ([y, m]) => preencher(F.mesAno, { mes: F.mesesCurtos[m - 1], ano: y }, 'formato.mesAno').replace(/ /g, ' ');
  const V = { ...calc, pais: T.identidade.pais, marca: dados.identidade.marca, 'formacao.curso': T.formacao.curso, 'formacao.cursoCurto': T.formacao.cursoCurto };
  for (const [k, v] of Object.entries(dados.numeros)) { V[k] = v; V[k + 'Base'] = v.replace(/\+$/, ''); }
  V.atualizado = preencher(F.dataLonga, { dia: hoje.getDate(), mes: F.mesesLongos[hoje.getMonth()], ano: hoje.getFullYear() }, 'formato.dataLonga');
  const [ty, tm, td] = dados.testesConferidos;
  V.data = preencher(F.dataCurta, { dia: td, mes: tm, mesCurto: F.mesesCurtos[tm - 1], ano: ty }, 'formato.dataCurta');
  for (const c of carreira) {
    const k = `carreira.${c.id}.`, TC = T.carreira[c.id];
    const fim = c.fim ? mesAno(c.fim) : F.hoje;
    Object.assign(V, {
      [k + 'empresa']: c.empresa, [k + 'curto']: c.curto, [k + 'cargo']: TC.cargo, [k + 'cargoFormal']: TC.cargoFormal,
      [k + 'inicio']: mesAno(c.inicio), [k + 'fim']: fim, [k + 'periodo']: preencher(F.periodo, { inicio: mesAno(c.inicio), fim }, 'formato.periodo'),
      [k + 'inicioLongo']: preencher(F.mesAnoLongo, { mes: F.mesesLongos[c.inicio[1] - 1], ano: c.inicio[0] }, 'formato.mesAnoLongo'),
      [k + 'fimLongo']: c.fim ? preencher(F.mesAnoLongo, { mes: F.mesesLongos[c.fim[1] - 1], ano: c.fim[0] }, 'formato.mesAnoLongo') : F.hoje,
      [k + 'ano']: String(c.inicio[0]), [k + 'anoInicio']: String(c.inicio[0]), [k + 'anoFim']: c.fim ? String(c.fim[0]) : F.hoje,
      [k + 'anos']: c.fim ? `${c.inicio[0]}–${c.fim[0]}` : `${c.inicio[0]}–${F.hoje}`
    });
  }
  const txt = (chave, extra = {}) => {
    const v = pegar(T, chave);
    if (typeof v !== 'string') falhar([`textos.${cod}.json: falta "${chave}"`]);
    return preencher(v, { ...V, ...extra }, chave);
  };
  const h = (chave, extra, op) => marcar(txt(chave, extra), op);
  const p0 = (chave, extra) => esc(limpar(txt(chave, extra)));
  const varsP = p => ({ ...(p.numeros || {}), ...Object.fromEntries(Object.entries(p.testes || {}).map(([k, n]) => [k, fmtN(n, idioma.lang)])), testesTotal: fmtN(somaTestes(p), idioma.lang), nome: p.nome });
  const stackDe = p => p.stack.map(s => typeof s === 'object' ? txt(s.texto) : s);
  return { cod, T, F, V, txt, h, p0, varsP, stackDe, mesAno };
}

/* 6. Peças comuns */

function imgDe(chave, pref, C, { cls = '', attrs = '', sizes = '(max-width: 760px) 100vw, 1000px', carregar = 'lazy' } = {}) {
  const m = manifesto[chave];
  const srcset = [...m.variantes.map(v => `${pref}${v.src} ${v.w}w`), `${pref}${m.src} ${m.w}w`].join(', ');
  return `<img${cls ? ` class="${cls}"` : ''} src="${pref}${m.src}"${m.variantes.length ? ` srcset="${srcset}" sizes="${sizes}"` : ''} width="${m.w}" height="${m.h}" alt="${C.p0('alt.' + chave.replace('/', '.'))}" loading="${carregar}" decoding="async"${attrs}>`;
}

function cabecalho({ C, pref, ancora, idiomaHref, escuro = false }) {
  const { T } = C;
  const seletor = idiomasLinks.length > 1
    ? `<nav class="idiomas" aria-label="${esc(T.interface.idioma)}">${idiomasLinks.map(i =>
        `<a href="${idiomaHref(i)}" hreflang="${i.hreflang}" lang="${i.lang}" data-pasta${i.codigo === C.cod ? ' aria-current="page"' : ''} title="${esc(i.nome)}">${dup(i.codigo.toUpperCase())}</a>`).join('')}</nav>`
    : '';
  const secoes = [['trajetoria', T.trajetoria.secao], ['projetos', T.projetos.secao], ['habilidades', T.habilidades.secao], ['contato', T.contato.secao]];
  const links = secoes.map(([id, rot]) => `<a href="${ancora}#${id}">${dup(esc(rot))}</a>`).join('');
  const cvHref = pref + dados.identidade.cv[C.cod];
  return `<header class="mast${escuro ? ' escuro' : ''}" id="mast">
  <a class="marca-nome" href="${ancora || '#topo'}">${dup(esc(dados.identidade.nome))}</a>
  <nav class="mast-nav" aria-label="${esc(T.interface.secoes)}">${links}</nav>
  <details class="mast-menu"><summary>${dup(esc(T.interface.secoes))}</summary><nav aria-label="${esc(T.interface.secoes)}">${secoes.map(([id, rot]) => `<a href="${ancora}#${id}">${esc(rot)}</a>`).join('')}<span class="menu-idiomas">${idiomasLinks.map(i => `<a href="${idiomaHref(i)}" hreflang="${i.hreflang}" lang="${i.lang}"${i.codigo === C.cod ? ' aria-current="page"' : ''}>${esc(i.nome)}</a>`).join('')}</span></nav></details>
  ${seletor}
  <a class="mast-cv" href="${cvHref}" target="_blank" rel="noopener" aria-label="${esc(T.interface.baixarCv)}">${dup(esc(T.interface.cvCurto))}</a>
</header>`;
}

function cabeca({ C, idioma, pref, titulo, descricao, urlPagina, alternativas, extra = '', ogTipo = 'profile', tema }) {
  const og = `assets/img/og-${C.cod}.png`;
  const base = dados.site.baseUrl;
  const ogUrl = existsSync(path.join(raiz, og)) ? base + og : base + `assets/img/og-${padrao}.png`;
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<meta name="description" content="${descricao}">
<link rel="canonical" href="${esc(urlPagina)}">
${alternativas.map(([hl, u]) => `<link rel="alternate" hreflang="${hl}" href="${esc(u)}">`).join('\n')}
<meta property="og:type" content="${ogTipo}">
<meta property="og:site_name" content="${esc(dados.identidade.nome)}">
<meta property="og:title" content="${titulo}">
<meta property="og:description" content="${descricao}">
<meta property="og:url" content="${esc(urlPagina)}">
<meta property="og:image" content="${esc(ogUrl)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${C.p0('meta.ogDescricao')}">
<meta property="og:locale" content="${idioma.ogLocale}">
${idiomasLinks.filter(i => i !== idioma).map(i => `<meta property="og:locale:alternate" content="${i.ogLocale}">`).join('\n')}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(ogUrl)}">
<meta name="theme-color" content="${tema}">
<link rel="icon" href="${pref}favicon.svg" type="image/svg+xml">
<link rel="preload" href="${pref}${FONTES.serif}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${pref}${FONTES.sans}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${pref}assets/css/style.css?v=${hash('assets/css/style.css')}">
<script>document.documentElement.classList.add('js');['pagereveal','pageswap'].forEach(t=>addEventListener(t,e=>{const v=e.viewTransition;if(v){[v.ready,v.finished,v.updateCallbackDone].forEach(p=>p&&p.catch(()=>{}));}}))</script>
<script src="${pref}assets/js/main.js?v=${hash('assets/js/main.js')}" defer></script>${extra}`;
}

// botões de um projeto: Ver detalhes, Demo (ou Como rodar a demo) e Código
function botoes(p, C, pref, { detalhes = true, codigoTodos = false } = {}) {
  const { T } = C;
  const nome = { nome: p.nome };
  const out = [];
  if (detalhes) out.push(`<a class="btn claro" href="${pref}projetos/${p.id}/" aria-label="${C.p0('interface.aria.detalhes', nome)}">${esc(T.interface.verDetalhes)}</a>`);
  if (temDemoAtiva(p)) out.push(`<a class="btn linha" href="${esc(p.demo.url)}"${novaAba} aria-label="${C.p0('interface.aria.demo', nome)}">${esc(detalhes ? T.interface.demo : T.interface.abrirDemo)}</a>`);
  else out.push(`<a class="btn linha" href="${esc(p.comoRodar[C.cod])}"${novaAba} aria-label="${C.p0('interface.aria.comoRodar', nome)}">${esc(T.interface.comoRodar)}</a>`);
  const cods = codigoTodos ? p.codigo : p.codigo.slice(0, 1);
  for (const c of cods) {
    const rot = codigoTodos ? T.interface.rotulosCodigo[c.rotulo] : T.interface.rotulosCodigo.codigo;
    out.push(`<a class="btn linha" href="${esc(c.url)}"${novaAba} aria-label="${C.p0('interface.aria.codigo', { ...nome, rotulo: rot })}">${esc(rot)}</a>`);
  }
  return out.join('');
}

// número da prova (total de testes) + detalhamento + data da conferência
function prova(p, C, cls = 'fp-prova') {
  const vp = C.varsP(p);
  return `<div class="${cls}">
          <p class="prova-n"><b>${esc(vp.testesTotal)}</b> <span>${C.p0('projetos.rotulos.testes')}</span></p>
          <p class="prova-d"><span class="pd-det">${C.h(`projetos.${p.id}.prova`, vp)}</span> <span class="pd-data">${C.p0('projetos.rotulos.conferidos')}.</span></p>
        </div>`;
}

const barraUrl = p => temDemoAtiva(p) ? host(p.demo.url) : host(p.codigo[0].url);

// no currículo, as linguagens e as ferramentas de dados vêm antes das capacidades
const PRIMEIRO_NO_CV = ['javascript', 'typescript', 'python', 'postgres', 'excel', 'pandas', 'react', 'fastapi', 'flask', 'firebase'];
// no currículo, as habilidades vêm por grupo: primeiro o que se usa, por último a prática
const GRUPOS_NO_CV = ['linguagens', 'dados', 'plataformas', 'produto', 'pratica'];
const ordemCv = linhas =>[...linhas].sort((a, b) => (PRIMEIRO_NO_CV.indexOf(a.id) + 1 || 99) - (PRIMEIRO_NO_CV.indexOf(b.id) + 1 || 99));

/* 7. Página inicial de um idioma */

function gerarPagina(idioma) {
  const C = contexto(idioma);
  const { cod, T, F, V, txt, h, p0, varsP, stackDe } = C;
  const pref = '../'.repeat(idioma.pasta.split('/').filter(Boolean).length);
  const base = dados.site.baseUrl;
  const urlIdioma = i => base + i.pasta;
  const I = dados.identidade;
  const cvHref = pref + I.cv[cod];

  /* abertura */
  const ficha = ['experiencia', 'formacao', 'idiomas', 'vaga', 'fuso'].map(k =>
    `<div><dt>${p0(`abertura.ficha.${k}Rotulo`)}</dt><dd>${h(`abertura.ficha.${k}`)}</dd></div>`).join('\n        ');
  const abertura = `<section class="abertura" id="topo" data-cena="abertura" aria-labelledby="nome">
    <div class="ab-wrap">
      <div class="ab-txt">
        <p class="ab-kicker">${p0('identidade.titulo')}</p>
        <h1 class="ab-nome" id="nome">${I.nome.split(' ').map(w => `<span class="ln"><span class="ln-i">${esc(w)}</span></span>`).join(' ')}</h1>
        <p class="ab-tese">${h('identidade.tese')}</p>
        <p class="ab-linha">${h('abertura.linhaFina')}</p>
        <div class="ab-acoes">
          <a class="btn tinta" href="${cvHref}" target="_blank" rel="noopener">${esc(T.interface.baixarCv)}</a>
          <a class="btn contorno" href="#contato">${esc(T.interface.contato)}</a>
          <a class="ab-link" href="#projetos">${esc(T.interface.verDestaque)}</a>
        </div>
      </div>
      <dl class="ficha" aria-label="${p0('abertura.ficha.titulo')}">
        ${ficha}
      </dl>
    </div>
  </section>`;

  /* trajetória */
  const fases = carreira.map(c => ({ id: c.id, a: mesIdx(...c.inicio), b: c.fim ? mesIdx(...c.fim) : HOJE, cor: c.cor }));
  const naData = i => fases.filter(f => i >= f.a && i <= f.b);
  const Y0 = inicioCarreira[0], Y1 = Math.floor(HOJE / 12);
  const contagem = Object.fromEntries(fases.map(f => [f.id, 0]));
  let totalMeses = 0;
  let grade = '<span></span>' + [...T.trajetoria.figura.iniciaisMeses].map(l => `<span class="ax">${esc(l)}</span>`).join('');
  for (let y = Y0; y <= Y1; y++) {
    grade += `<span class="ax ano">${y}</span>`;
    for (let m = 1; m <= 12; m++) {
      const i = mesIdx(y, m), fs = naData(i);
      if (i > HOJE) { grade += '<span class="cel fut"></span>'; continue; }
      if (!fs.length) { grade += '<span class="cel pre"></span>'; continue; }
      for (const f of fs) contagem[f.id]++;
      totalMeses++;
      const bg = fs.length > 1 ? `linear-gradient(135deg, ${fs[0].cor} 50%, ${fs[1].cor} 50%)` : fs[0].cor;
      grade += `<span class="cel${i === HOJE ? ' hoje' : ''}" data-f="${fs.map(f => f.id).join(' ')}"><i style="background:${bg}"></i></span>`;
    }
  }
  const meses = n => `${n} ${n === 1 ? F.mes : F.meses}`;
  // a soma da legenda passa do total quando um mês de troca pertence a duas empresas: a nota explica a diferença
  const somaFases = carreira.reduce((s, c) => s + contagem[c.id], 0);
  const passos = T.trajetoria.passos;
  const trajetoria = `<section class="cena traj" id="trajetoria-cena" data-cena="trajetoria" aria-labelledby="traj-t">
    <span class="ancora" id="trajetoria"></span>
    <div class="fixo">
      <div class="t-txt">
        <h2 class="t-secao" id="traj-t">${esc(T.trajetoria.secao)}</h2>
        <div class="t-traco" aria-hidden="true"><b></b></div>
        <div class="t-passos">
          ${passos.map((s, j) => `<article class="t-passo">
            <h3>${h(`trajetoria.passos.${j}.titulo`)}</h3>
            <p>${h(`trajetoria.passos.${j}.texto`)}${s.extra ? ` <span class="t-extra">${h(`trajetoria.passos.${j}.extra`)}</span>` : ''}</p>
            <p class="t-fonte">${p0(`trajetoria.passos.${j}.fonte`)}</p>
          </article>`).join('\n          ')}
        </div>
      </div>
      <figure class="t-fig" id="tFig">
        <div class="fig-topo">
          <figcaption class="fig-t">${p0('trajetoria.figura.titulo')}</figcaption>
          <p class="fig-cnt" id="cnt"><b id="cntN">${totalMeses}</b> <span>${esc(F.meses)}</span></p>
        </div>
        <div class="grade-m" id="gradeM" role="img" aria-label="${p0('trajetoria.figura.legendaGrade')}">${grade}</div>
        <p class="virada" id="virada"><span>${p0('trajetoria.figura.virada')}</span></p>
        <dl class="legenda">${carreira.map(c => `<div data-ph="${c.id}"><dt><i style="background:${c.cor}"></i>${esc(c.curto)}</dt><dd>${p0(`carreira.${c.id}.area`)}</dd><dd class="lg-n" data-total="${meses(contagem[c.id])}">${meses(contagem[c.id])}</dd></div>`).join('')}</dl>
        ${somaFases > totalMeses ? `<p class="lg-nota">${p0('trajetoria.figura.notaTroca')}</p>` : ''}
      </figure>
    </div>
  </section>`;

  /* introdução dos projetos: a cortina do papel para a tela */
  const intro = `<section class="cena intro" id="projetos-cena" data-cena="projetos">
    <div class="fixo">
      <div class="camada papel">
        <div class="camada-in"><p class="fecho">${h('trajetoria.fecho', {}, { marca: 'fecho-m' })}</p></div>
      </div>
      <div class="camada tela">
        <div class="camada-in">
          <p class="fecho clone" aria-hidden="true">${h('trajetoria.fecho', {}, { marca: 'fecho-m' })}</p>
        </div>
      </div>
    </div>
  </section>`;

  /* projetos: nove cartões com o mesmo peso; o resto fica na página de cada projeto */
  const cartoes = projetos.map(p => {
    const vp = varsP(p), vit = daVitrine(p);
    const telas = [...new Set(vit.map(it => it.tela).filter(t => t !== 'celular'))].slice(0, 2);
    const sz = '(max-width: 760px) 92vw, (max-width: 1100px) 46vw, 460px';
    const imgs = telas.map(k => imgDe(k, pref, C, { sizes: sz })).join('');
    const cel = p.composicao.celular === 'sempre' && p.celular;
    const href = `${pref}projetos/${p.id}/`;
    // no celular, a captura do celular substitui a tela de computador, que ficaria pequena demais para ler
    return `<li class="cartao${p.celular ? ' tem-cel' : ''}" id="p-${p.id}" style="--cor:${p.cor}">
        <a class="ct-midia" href="${href}" tabindex="-1" aria-hidden="true">
          <span class="ct-tela${telas.length > 1 ? ' duas' : ''}" style="view-transition-name:janela-${p.id}">${imgs}</span>
          ${cel ? `<span class="ct-cel">${imgDe(p.celular, pref, C, { sizes: '120px' })}</span>` : ''}
          ${p.celular ? `<span class="ct-cel-m">${imgDe(p.celular, pref, C, { sizes: '(max-width: 640px) 56vw, 1px' })}</span>` : ''}
        </a>
        <div class="ct-txt">
          <h3 class="ct-nome"><a href="${href}" tabindex="-1" style="view-transition-name:nome-${p.id}">${esc(p.nome)}</a></h3>
          <p class="ct-frase">${h(`projetos.${p.id}.frase`, vp)}</p>
          <p class="ct-testes"><b>${esc(vp.testesTotal)}</b> ${p0('projetos.rotulos.testes')}</p>
          <p class="ct-stack">${stackDe(p).slice(0, 3).map(s => esc(s.replace(/\s*\(.*\)$/, ''))).join(', ')}</p>
        </div>
        <div class="ct-acoes">${botoes(p, C, pref)}</div>
      </li>`;
  }).join('\n      ');
  const resumos = `<section class="grade-p" id="projetos" aria-labelledby="proj-t">
    <header class="gp-cab">
      <h2 id="proj-t">${h('projetos.titulo')}</h2>
      <div class="gp-txt">
        <p class="in-lead">${h('projetos.texto')}</p>
        <p class="in-marca">${h('projetos.marca')}</p>
      </div>
    </header>
    <ol class="cartoes">
      ${cartoes}
    </ol>
  </section>`;

  /* habilidades */
  const nomeCol = id => projetos.find(p => p.id === id).nome;
  const totLinha = M.linhas.map(l => [...l.marcas].filter(c => c === '1').length);
  const totCol = M.colunas.map((_, c) => M.linhas.filter(l => l.marcas[c] === '1').length);
  const habilidades = `<section class="habilidades" id="habilidades" data-cena="habilidades" aria-labelledby="hab-t">
    <div class="hab-wrap">
      <div class="hab-cab">
        <h2 id="hab-t">${h('habilidades.titulo')}</h2>
        <p>${h('habilidades.texto')}</p>
      </div>
      <div class="mx-w">
        <table class="mx">
          <caption class="sr">${esc(T.habilidades.secao)}</caption>
          <thead><tr><th class="l" scope="col">${p0('habilidades.cabecalho')}</th>${M.colunas.map(c => `<th class="c" scope="col"><span>${esc(nomeCol(c))}</span></th>`).join('')}<th class="t" scope="col">${p0('habilidades.total')}</th></tr></thead>
          ${M.grupos.map(g => `<tbody><tr class="mx-g"><th scope="rowgroup" colspan="${M.colunas.length + 2}">${p0(`habilidades.grupos.${g.id}`)}</th></tr>${g.linhas.map(id => { const r = M.linhas.findIndex(x => x.id === id), l = M.linhas[r]; return `<tr><th scope="row">${p0(`habilidades.linhas.${l.id}`)}</th>${[...l.marcas].map((c, k) => `<td>${c === '1' ? `<i role="img" aria-label="${esc(nomeCol(M.colunas[k]))}"></i>` : ''}</td>`).join('')}<td class="t">${totLinha[r]}</td></tr>`; }).join('')}</tbody>`).join('')}
          <tfoot><tr><th scope="row">${p0('habilidades.porProjeto')}</th>${totCol.map(t => `<td>${t}</td>`).join('')}<td></td></tr></tfoot>
        </table>
        <ul class="mx-lista">${M.linhas.map(l => `${M.grupos.find(g => g.linhas[0] === l.id) ? `<li class="mx-g">${p0(`habilidades.grupos.${M.grupos.find(g => g.linhas[0] === l.id).id}`)}</li>` : ''}<li><b>${p0(`habilidades.linhas.${l.id}`)}</b><span>${[...l.marcas].map((c, k) => c === '1' ? esc(nomeCol(M.colunas[k])) : '').filter(Boolean).join(', ')}</span></li>`).join('')}</ul>
      </div>
      <div class="negocio">
        <h3>${p0('habilidades.negocioTitulo')}</h3>
        <ul>${dados.negocio.map(n => `<li><span>${p0(`habilidades.negocio.${n.id}`)}</span><em>${n.onde.map(o => esc(carreira.find(c => c.id === o).curto)).join(', ')}</em></li>`).join('')}</ul>
      </div>
    </div>
  </section>`;

  /* contato: a volta ao papel */
  const LINK = { linkEmail: '\u0001e\u0001', linkWhatsapp: '\u0001w\u0001', linkGithub: '\u0001g\u0001' };
  const textoContato = h('contato.texto', LINK)
    .replace('\u0001e\u0001', `<a href="mailto:${esc(I.email)}">${esc(I.email)}</a>`)
    .replace('\u0001w\u0001', `<a href="${esc(I.whatsapp)}"${novaAba}>${esc(T.interface.whatsapp)}</a>`)
    .replace('\u0001g\u0001', `<a href="${esc(I.github)}"${novaAba}>${esc(T.interface.github)}</a>`);
  const contato = `<footer class="contato-w" aria-labelledby="ct-t">
  <div class="cena contato" id="contato-cena" data-cena="contato">
    <span class="ancora" id="contato"></span>
    <div class="fixo">
      <div class="camada tela" aria-hidden="true" inert>
        <div class="camada-in"><div class="c-wrap"><p class="c-titulo">${p0('contato.titulo')}</p><div class="c-corpo oculto"><p class="c-txt">${textoContato}</p><div class="c-acoes"><span class="btn tinta">${esc(T.interface.baixarCv)}</span></div><p class="c-form">${p0('contato.formacao')}</p><div class="c-assina"><span class="rubrica-v"></span><p>${esc(I.nome)}<span>${p0('contato.atualizado')}</span></p></div></div></div></div>
      </div>
      <div class="camada papel">
        <div class="camada-in">
          <div class="c-wrap">
            <h2 class="c-titulo" id="ct-t">${p0('contato.titulo')}</h2>
            <div class="c-corpo">
              <p class="c-txt">${textoContato}</p>
              <div class="c-acoes">
                <a class="btn tinta" href="${cvHref}" target="_blank" rel="noopener">${esc(T.interface.baixarCv)}</a>
                <a class="btn contorno" href="${esc(I.linkedin)}"${novaAba}>${esc(T.interface.linkedin)}</a>
              </div>
              <p class="c-form">${p0('contato.formacao')}</p>
              <div class="c-assina">
                <img class="rubrica" id="rubrica" src="${pref}${I.rubrica}" width="220" height="399" alt="${p0('identidade.rubricaAlt')}" loading="lazy" decoding="async">
                <p>${esc(I.nome)}<span>${p0('contato.atualizado')}</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
    <div class="rodape"><p>${esc(I.marca)}, ${esc(I.nome)}</p><p><a href="mailto:${esc(I.email)}">${esc(T.interface.email)}</a><a href="${esc(I.linkedin)}"${novaAba}>${esc(T.interface.linkedin)}</a><a href="${esc(I.github)}"${novaAba}>${esc(T.interface.github)}</a><a href="${esc(I.whatsapp)}"${novaAba}>${esc(T.interface.whatsapp)}</a></p></div>
  </footer>`;

  /* currículo (só na impressão) */
  const urlSite = urlIdioma(idioma);
  const linkCv = p => temDemoAtiva(p) ? p.demo.url : p.codigo[0].url;
  const cv = `<article class="cvp" aria-hidden="true">
  <header class="cvp-h">
    <h2>${esc(I.nome)}</h2>
    <p class="cvp-t">${p0('identidade.titulo')}</p>
    <p class="cvp-c"><a href="mailto:${esc(I.email)}">${esc(I.email)}</a><a href="${esc(I.whatsapp)}">${esc(I.whatsappExibicao)}</a><a href="${esc(I.linkedin)}">${esc(host(I.linkedin))}</a><a href="${esc(I.github)}">${esc(host(I.github))}</a></p>
    <p class="cvp-c"><span>${p0('cv.site')}: <a href="${esc(urlSite)}">${esc(host(urlSite))}</a></span><span>${p0('identidade.disponibilidade')}</span><span>${esc(T.identidade.pais)}, ${esc(I.fuso)}</span><span>${p0('abertura.ficha.idiomas')}</span></p>
  </header>
  <section class="cvp-s">
    <h3>${p0('cv.resumoTitulo')}</h3>
    <p class="cvp-tese">${p0('identidade.tese')}</p>
    <p>${p0('cv.resumo')}</p>
  </section>
  <section class="cvp-s">
    <h3>${p0('cv.experienciaTitulo')}</h3>
    ${[...carreira].reverse().map(c => `<div class="cvp-x">
      <div class="cvp-q">${esc(V[`carreira.${c.id}.periodo`])}</div>
      <div><h4>${esc(c.empresa)} <span>${p0(`carreira.${c.id}.tipo`)}</span></h4>
        <p class="cvp-r">${p0(`carreira.${c.id}.cargo`)}${T.carreira[c.id].cargoFormal ? ` <span>(${p0(`carreira.${c.id}.cargoFormal`)})</span>` : ''}</p>
        <ul>${T.carreira[c.id].itens.map((_, k) => `<li>${p0(`carreira.${c.id}.itens.${k}`)}</li>`).join('')}</ul></div>
    </div>`).join('\n    ')}
  </section>
  <section class="cvp-s">
    <h3>${p0('cv.projetosTitulo')}</h3>
    <p class="cvp-nota">${p0('cv.projetosNota')}</p>
    ${projetos.map(p => `<div class="cvp-p">
      <h4>${esc(p.nome)} <a href="${esc(linkCv(p))}">${esc(host(linkCv(p)))}</a></h4>
      <p>${p0(`projetos.${p.id}.cv`, varsP(p))} <span class="cvp-sk">${stackDe(p).map(esc).join(', ')}</span></p>
    </div>`).join('\n    ')}
  </section>
  <section class="cvp-s">
    <h3>${p0('cv.habilidadesTitulo')}</h3>
    <p>${GRUPOS_NO_CV.map(gid => M.grupos.find(g => g.id === gid)).map(g => `<b>${p0(`habilidades.grupos.${g.id}`)}:</b> ${ordemCv(g.linhas.map(id => M.linhas.find(l => l.id === id))).map(l => p0(`habilidades.linhas.${l.id}`)).join(', ')}.`).join(' ')}</p>
    <p><b>${p0('cv.negocio')}:</b> ${dados.negocio.map(n => p0(`habilidades.negocio.${n.id}`)).join('; ')}.</p>
  </section>
  <section class="cvp-s">
    <h3>${p0('cv.formacaoTitulo')}</h3>
    <p><b>${p0('formacao.curso')}</b>, ${p0('formacao.detalhe')}.</p>
  </section>
  <footer class="cvp-assina">
    <img src="${pref}${I.rubrica}" width="220" height="399" alt="${p0('identidade.rubricaAlt')}" loading="lazy" decoding="async">
    <span>${esc(I.marca)}, ${esc(I.nome)}</span>
  </footer>
</article>`;

  /* dados para os efeitos */
  // hoje = mês em que a página foi gerada; aberta = fase sem fim (o main.js completa no navegador os meses que passaram depois)
  const aberta = carreira.find(c => c.fim === null);
  const dadosJs = { fases: carreira.map(c => c.id), mes: F.mes, meses: F.meses, hoje: HOJE, aberta: aberta ? { id: aberta.id, cor: aberta.cor } : null };

  /* head */
  const pessoa = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: I.nome,
    jobTitle: limpar(T.identidade.titulo),
    description: limpar(txt('meta.descricao')),
    url: urlSite,
    email: I.email,
    sameAs: [I.linkedin, I.github],
    address: { '@type': 'PostalAddress', addressCountry: 'BR' },
    worksFor: { '@type': 'Organization', name: carreira[carreira.length - 1].empresa },
    alumniOf: { '@type': 'CollegeOrUniversity', name: dados.formacao.instituicao },
    knowsLanguage: dados.idiomasFalados.map(l => ({ '@type': 'Language', name: limpar(txt(`formacao.idiomas.${l.id}.nome`)), alternateName: l.codigo }))
  };
  const idiomaPadrao = dados.site.idiomas.find(i => i.codigo === padrao);
  const alternativas = [...idiomasLinks.map(i => [i.hreflang, urlIdioma(i)]), ['x-default', urlIdioma(idiomaPadrao)]];
  const head = cabeca({ C, idioma, pref, titulo: p0('meta.titulo'), descricao: p0('meta.descricao'), urlPagina: urlSite, alternativas, tema: dados.site.corTema,
    extra: `\n<script type="application/ld+json">${JSON.stringify(pessoa).replace(/</g, '\\u003c')}</script>` });

  return `<!doctype html>
<html lang="${idioma.lang}">
<head>
${head}
</head>
<body class="inicio">
<a class="pular" href="#conteudo">${esc(T.interface.pularParaConteudo)}</a>
${cabecalho({ C, pref, ancora: '', idiomaHref: i => pref + i.pasta })}

<main id="conteudo" tabindex="-1">
  ${abertura}

  ${trajetoria}

  ${intro}

  <div class="vitrine">
  ${resumos}

  ${habilidades}
  </div>
</main>

${contato}

${cv}

<script type="application/json" id="dados-cena">${JSON.stringify(dadosJs)}</script>
</body>
</html>
`;
}

/* 8. Página de detalhe de um projeto */

// Seção técnica: fonte/tecnico/<id>.<idioma>.json. É opcional: sem o arquivo do idioma, a seção e a entrada
// dela no índice não aparecem. Com o arquivo, o formato é conferido aqui, antes de gravar qualquer página.
// Os textos não aceitam HTML; trechos entre crases viram <code>. Cada fonte é "Repo/caminho" ou "Repo/caminho#L1-L9".
const REPO_GITHUB = 'https://github.com/alyssom-fernandes/';
// fonte/tecnico/commits.json: o commit em que as linhas foram conferidas; sem ele, o link usa HEAD
const COMMITS = (() => {
  const rel = path.join(raiz, 'fonte/tecnico/commits.json');
  if (!existsSync(rel)) return {};
  const j = JSON.parse(readFileSync(rel, 'utf8').replace(/^﻿/, ''));
  for (const [k, v] of Object.entries(j)) if (!k.startsWith('_') && !/^[0-9a-f]{40}$/.test(v)) falhar([`fonte/tecnico/commits.json: "${k}" precisa de um SHA de 40 caracteres`]);
  return j;
})();
const reFonte =/^([A-Za-z0-9._-]+)\/([^#\s]+?)(?:#L(\d+)(?:-L(\d+))?)?$/;
function validarTecnico(t, p, rel) {
  const e = [];
  const objeto = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const texto = (v, campo) => {
    if (typeof v !== 'string' || !v.trim()) { e.push(`${rel}: "${campo}" precisa ser um texto`); return; }
    // dentro de crases, "<input>" é código citado (sai escapado); fora delas, é HTML e não entra
    if (/<[a-z/!]/i.test(v.replace(/`[^`]*`/g, ''))) e.push(`${rel}: "${campo}" tem HTML; use só texto, com \`código\` entre crases`);
    if ((v.match(/`/g) || []).length % 2) e.push(`${rel}: "${campo}" tem uma crase sem par`);
  };
  const fontes = (v, campo) => {
    if (!Array.isArray(v) || !v.length) { e.push(`${rel}: "${campo}" precisa de ao menos uma fonte ("Repo/caminho" ou "Repo/caminho#L1-L9")`); return; }
    v.forEach((f, i) => { if (typeof f !== 'string' || !reFonte.test(f)) e.push(`${rel}: "${campo}.${i}" (${JSON.stringify(f)}) não está no formato "Repo/caminho" ou "Repo/caminho#L1-L9"`); });
  };
  const chaves = (obj, campo, aceitas) => {
    for (const k of Object.keys(obj)) if (!k.startsWith('_') && !aceitas.includes(k)) e.push(`${rel}: a chave "${campo}${k}" não existe no formato (aceitas: ${aceitas.join(', ')})`);
  };
  const bloco = (v, campo, campos) => {
    if (!objeto(v)) { e.push(`${rel}: falta "${campo}" { ${campos.join(', ')} }`); return false; }
    chaves(v, campo + '.', campos);
    for (const c of campos) if (c === 'fontes') fontes(v.fontes, `${campo}.fontes`); else if (c !== 'fluxo') texto(v[c], `${campo}.${c}`);
    return true;
  };
  if (!objeto(t)) return [`${rel}: precisa ser um objeto { id, arquitetura, decisoes, desafio, testes }`];
  chaves(t, '', ['id', 'arquitetura', 'decisoes', 'desafio', 'testes']);
  if (t.id !== p.id) e.push(`${rel}: "id" deve ser "${p.id}" (está ${JSON.stringify(t.id)})`);
  if (bloco(t.arquitetura, 'arquitetura', ['texto', 'fluxo', 'fontes'])) {
    const f = t.arquitetura.fluxo;
    if (!Array.isArray(f) || f.length < 3 || f.length > 5) e.push(`${rel}: "arquitetura.fluxo" precisa de 3 a 5 rótulos curtos (tem ${Array.isArray(f) ? f.length : 0})`);
    else f.forEach((r, i) => texto(r, `arquitetura.fluxo.${i}`));
  }
  if (!Array.isArray(t.decisoes) || t.decisoes.length !== 3) e.push(`${rel}: "decisoes" precisa de exatamente 3 itens { titulo, texto, fontes } (tem ${Array.isArray(t.decisoes) ? t.decisoes.length : 0})`);
  else t.decisoes.forEach((d, i) => bloco(d, `decisoes.${i}`, ['titulo', 'texto', 'fontes']));
  bloco(t.desafio, 'desafio', ['titulo', 'texto', 'fontes']);
  bloco(t.testes, 'testes', ['texto', 'fontes']);
  return e;
}
// lido e conferido uma vez, antes da gravação: um arquivo errado para o build sem deixar páginas pela metade
const TECNICO = (() => {
  const out = {}, errosT = [];
  for (const idioma of idiomasAtivos) for (const p of projetos) {
    const rel = `fonte/tecnico/${p.id}.${idioma.codigo}.json`;
    if (!existsSync(path.join(raiz, rel))) continue;
    let t;
    try { t = JSON.parse(readFileSync(path.join(raiz, rel), 'utf8').replace(/^﻿/, '')); }
    catch (err) { errosT.push(`${rel}: não é um JSON válido (${err.message})`); continue; }
    const e = validarTecnico(t, p, rel);
    if (e.length) errosT.push(...e); else out[`${p.id}.${idioma.codigo}`] = t;
  }
  if (errosT.length) falhar(errosT);
  return out;
})();
// texto da seção técnica: tudo escapado; só `crases` viram <code>
const comCodigo = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
// "Ver no código: nucleo.js L1–11  app.js": o nome do arquivo; o repositório entra quando dois repositórios têm o mesmo nome
function linksFontes(lista, C) {
  const fs = lista.map(f => { const [, repo, cam, l1, l2] = f.match(reFonte); return { repo, cam, l1, l2, arq: cam.split('/').pop() }; });
  const links = fs.map(x => {
    const ambiguo = fs.some(y => y.arq === x.arq && y.repo !== x.repo);
    const ancora = x.l1 ? `#L${x.l1}${x.l2 ? `-L${x.l2}` : ''}` : '';
    const url = `${REPO_GITHUB}${x.repo}/blob/${COMMITS[x.repo] || 'HEAD'}/${x.cam.split('/').map(encodeURIComponent).join('/')}${ancora}`;
    const linhas = x.l1 ? ` <small>L${x.l1}${x.l2 ? `–${x.l2}` : ''}</small>` : '';
    return `<a href="${esc(url)}"${novaAba} title="${esc(`${x.repo}/${x.cam}`)}">${esc(ambiguo ? `${x.repo}/${x.arq}` : x.arq)}${linhas}</a>`;
  });
  return `<p class="t-fontes"><span>${C.p0('projetos.detalhe.verNoCodigo')}:</span> ${links.join(' ')}</p>`;
}
// cabeçalho numerado de uma seção (o fio de cima se desenha na entrada)
const cabSecao = (n, id, rotulo) => `<div class="d-cab" data-revela><span class="d-num" aria-hidden="true">${String(n).padStart(2, '0')}</span><h2 id="${id}">${rotulo}</h2></div>`;
function secaoTecnica(t, n, C) {
  const { p0 } = C;
  const A = t.arquitetura;
  const nos = A.fluxo.map((r, i) => `<li><span class="t-no"><span class="t-no-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="t-no-r">${comCodigo(r)}</span></span></li>`).join('');
  const decisoes = t.decisoes.map(d => `<li data-revela><h4>${comCodigo(d.titulo)}</h4><p>${comCodigo(d.texto)}</p>${linksFontes(d.fontes, C)}</li>`).join('\n          ');
  return `<section class="d-sec d-tecnico" id="s-tecnico" aria-labelledby="d-tec-t" data-secao>
        ${cabSecao(n, 'd-tec-t', p0('projetos.detalhe.tecnicoTitulo'))}
        <div class="t-bloco t-arq">
          <h3 class="t-rot" data-revela>${p0('projetos.detalhe.arquiteturaTitulo')}</h3>
          <div class="t-corpo" data-revela="1"><p class="t-lead">${comCodigo(A.texto)}</p>${linksFontes(A.fontes, C)}</div>
        </div>
        <figure class="t-fluxo" data-fluxo style="--n:${A.fluxo.length}">
          <figcaption>${p0('projetos.detalhe.fluxoTitulo')}</figcaption>
          <ol>${nos}</ol>
        </figure>
        <div class="t-bloco">
          <h3 class="t-rot" data-revela>${p0('projetos.detalhe.decisoesTitulo')}</h3>
          <ol class="t-corpo t-decisoes">
          ${decisoes}
          </ol>
        </div>
        <div class="t-bloco t-desafio">
          <h3 class="t-rot" data-revela>${p0('projetos.detalhe.desafioTitulo')}</h3>
          <div class="t-corpo" data-revela="1"><h4>${comCodigo(t.desafio.titulo)}</h4><p>${comCodigo(t.desafio.texto)}</p>${linksFontes(t.desafio.fontes, C)}</div>
        </div>
        <div class="t-bloco t-testes">
          <h3 class="t-rot" data-revela>${p0('projetos.detalhe.testesTitulo')}</h3>
          <div class="t-corpo" data-revela="1"><p>${comCodigo(t.testes.texto)}</p>${linksFontes(t.testes.fontes, C)}</div>
        </div>
      </section>`;
}

function gerarDetalhe(idioma, p, idx) {
  const C = contexto(idioma);
  const { cod, T, p0, h, varsP, stackDe } = C;
  const profundidade = idioma.pasta.split('/').filter(Boolean).length + 2;
  const pref = '../'.repeat(profundidade);
  const home = '../../';
  const base = dados.site.baseUrl;
  const urlDe = i => `${base}${i.pasta}projetos/${p.id}/`;
  const vp = varsP(p);
  const I = dados.identidade;
  const ant = projetos[(idx - 1 + projetos.length) % projetos.length];
  const prox = projetos[(idx + 1) % projetos.length];
  // a abertura usa uma tela que não se repete nos destaques; sem "abertura", a primeira das telas
  const t0 = p.abertura || p.telas[0];
  const m0 = manifesto[t0];
  const cel = p.celular;
  const sizesGrande = '(max-width: 760px) 100vw, 1100px';
  // cada captura abre em tamanho real na janela de ampliar (projeto.js); sem JS, o link abre a imagem
  const ampliar = (chave, dentro) => `<a class="d-ampliar" href="${pref}${manifesto[chave].src}" target="_blank" rel="noopener" aria-label="${esc(`${p0('projetos.detalhe.ampliar')}: ${limpar(C.p0('alt.' + chave.replace('/', '.')))}`)}">${dentro}<span class="d-amp-selo" aria-hidden="true">${p0('projetos.detalhe.ampliar')}</span></a>`;
  const destaques = p.itens.map((it, j) => {
    const fig = it.tela === 'celular'
      ? `<div class="d-fig celular-so" data-revela>${ampliar(p.celular, imgDe(p.celular, pref, C, { sizes: '(max-width: 760px) 70vw, 320px' }))}</div>`
      : `<div class="d-fig" data-revela>${ampliar(it.tela, `<div class="janela"><div class="j-barra"><span>${esc(barraUrl(p))}</span></div><div class="j-tela estatica">${imgDe(it.tela, pref, C, { sizes: sizesGrande })}</div></div>`)}</div>`;
    return `<li class="d-item${it.tela === 'celular' ? ' d-item-cel' : ''}${j % 2 ? ' inv' : ''}">
          ${fig}
          <div class="d-item-txt" data-revela="1"><h3>${h(`projetos.${p.id}.itens.${it.id}.titulo`, vp)}</h3><p>${h(`projetos.${p.id}.itens.${it.id}.texto`, vp)}</p></div>
        </li>`;
  }).join('\n        ');
  const tecnico = TECNICO[`${p.id}.${cod}`];
  // seções do estudo de caso, na ordem da página; o índice sai desta lista
  const secoes = [
    { id: 's-origem', rot: p0('projetos.detalhe.origemTitulo') },
    { id: 's-ficha', rot: p0('projetos.detalhe.fichaTitulo') },
    { id: 's-destaques', rot: p0('projetos.detalhe.destaquesTitulo') },
    ...(tecnico ? [{ id: 's-tecnico', rot: p0('projetos.detalhe.tecnicoTitulo') }] : []),
    { id: 's-stack', rot: p0('projetos.detalhe.stackLinksTitulo') }
  ];
  const num = id => secoes.findIndex(s => s.id === id) + 1;
  const nn = i => String(i + 1).padStart(2, '0');
  const itensIndice = secoes.map((s, i) => `<li><a href="#${s.id}" data-alvo="${s.id}"${i === 0 ? ' aria-current="location"' : ''}><span class="d-ind-n">${nn(i)}</span><span class="d-ind-r">${s.rot}</span></a></li>`).join('');
  const rotIndice = p0('projetos.detalhe.indice');
  const alternativas = [...idiomasLinks.map(i => [i.hreflang, urlDe(i)]), ['x-default', urlDe(dados.site.idiomas.find(i => i.codigo === padrao))]];
  const titulo = p0('meta.tituloProjeto', { nome: p.nome, frase: limpar(C.txt(`projetos.${p.id}.frase`, vp)).replace(/\.$/, '') });
  // a busca corta a descrição perto de 155 caracteres: o resumo longo termina antes, numa vírgula
  const curto = s => {
    if (s.length <= 158) return s;
    const i = Math.max(s.lastIndexOf(', ', 152), s.lastIndexOf('; ', 152));
    return (i > 80 ? s.slice(0, i) : s.slice(0, 152).replace(/\s+\S*$/, '')).replace(/[,;:]$/, '') + '…';
  };
  const descricao = esc(curto(limpar(C.txt(`projetos.${p.id}.resumo`, vp))));
  // dados estruturados do projeto (schema.org), só com o que já está em dados.json e nos textos
  const codigoLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: p.nome,
    description: limpar(C.txt(`projetos.${p.id}.resumo`, vp)),
    url: urlDe(idioma),
    inLanguage: idioma.lang,
    codeRepository: p.codigo[0].url,
    keywords: stackDe(p).join(', '),
    author: { '@type': 'Person', name: I.nome, url: `${base}${idioma.pasta}` },
    ...(temDemoAtiva(p) ? { targetProduct: { '@type': 'WebApplication', name: p.nome, url: p.demo.url, applicationCategory: 'BusinessApplication', operatingSystem: 'Web' } } : {}),
  };
  const extra = `\n<link rel="stylesheet" href="${pref}assets/css/projeto.css?v=${hash('assets/css/projeto.css')}">\n<script src="${pref}assets/js/projeto.js?v=${hash('assets/js/projeto.js')}" defer></script>` +
    `\n<script type="application/ld+json">${JSON.stringify(codigoLd).replace(/</g, '\\u003c')}</script>`;
  const head = cabeca({ C, idioma, pref, titulo, descricao, urlPagina: urlDe(idioma), alternativas, extra, ogTipo: 'article', tema: dados.site.corTemaTela });
  const links = botoes(p, C, pref, { detalhes: false, codigoTodos: true });
  return `<!doctype html>
<html lang="${idioma.lang}">
<head>
${head}
</head>
<body class="detalhe" style="--cor:${p.cor}">
<a class="pular" href="#conteudo">${esc(T.interface.pularParaConteudo)}</a>
${cabecalho({ C, pref, ancora: home, idiomaHref: i => `${pref}${i.pasta}projetos/${p.id}/`, escuro: true })}

<main id="conteudo" tabindex="-1">
  <article class="d-art">
    <header class="d-abertura">
      <a class="d-voltar" href="${home}#p-${p.id}">${esc(T.projetos.detalhe.voltar)}</a>
      <h1 class="d-nome" style="view-transition-name:nome-${p.id}">${esc(p.nome)}</h1>
      <p class="d-frase">${h(`projetos.${p.id}.frase`, vp)}</p>
      <div class="d-palco${cel ? ' com-cel' : ''}">
        <div class="janela" style="view-transition-name:janela-${p.id}">
          <div class="j-barra"><span>${esc(barraUrl(p))}</span><span class="j-leg">${p0(`projetos.legendas.${p.legenda}`)}</span></div>
          <div class="j-tela estatica" style="aspect-ratio:${m0.w} / ${m0.h}">${imgDe(t0, pref, C, { sizes: sizesGrande, carregar: 'eager', attrs: ' fetchpriority="high"' })}</div>
        </div>
        ${cel ? `<div class="celular">${imgDe(p.celular, pref, C, { sizes: '(max-width: 760px) 40vw, 240px', carregar: 'eager' })}</div>` : ''}
      </div>
      <div class="d-acoes">${links}</div>
    </header>

    <div class="d-corpo">
      <details class="d-ind-m">
        <summary><span class="sr">${rotIndice}: </span><span class="d-ind-n" data-atual-n>${nn(0)}</span><span class="d-ind-r" data-atual-r>${secoes[0].rot}</span><span class="d-ind-tot" aria-hidden="true">/${nn(secoes.length - 1)}</span><span class="d-ind-seta" aria-hidden="true"></span></summary>
        <nav aria-label="${rotIndice}"><ol>${itensIndice}</ol></nav>
      </details>
      <nav class="d-ind" aria-label="${rotIndice}">
        <p class="d-ind-t" aria-hidden="true">${rotIndice}</p>
        <ol>${itensIndice}</ol>
      </nav>

      <div class="d-secoes">
      <section class="d-sec d-sec-origem" id="s-origem" aria-labelledby="d-origem-t" data-secao>
        ${cabSecao(num('s-origem'), 'd-origem-t', p0('projetos.detalhe.origemTitulo'))}
        <p class="d-origem-txt" data-revela="1">${h(`projetos.${p.id}.origemLonga`, vp)}</p>
      </section>

      <section class="d-sec d-sec-ficha" id="s-ficha" aria-labelledby="d-ficha-t" data-secao>
        ${cabSecao(num('s-ficha'), 'd-ficha-t', p0('projetos.detalhe.fichaTitulo'))}
        <div class="d-fichag">
          <div data-revela><p class="fp-rot">${p0('projetos.rotulos.problema')}</p><p>${h(`projetos.${p.id}.problema`, vp)}</p></div>
          <div data-revela="1"><p class="fp-rot">${p0('projetos.rotulos.sistema')}</p><p>${h(`projetos.${p.id}.resumo`, vp)}</p></div>
          <div data-revela="2"><p class="fp-rot">${p0('projetos.rotulos.prova')}</p>${prova(p, C, 'd-prova')}${temDemoAtiva(p) ? '' : `<p class="d-semdemo">${p0('projetos.detalhe.semDemo')}</p>`}</div>
        </div>
      </section>

      <section class="d-sec d-sec-destaques" id="s-destaques" aria-labelledby="d-dest-t" data-secao>
        ${cabSecao(num('s-destaques'), 'd-dest-t', p0('projetos.detalhe.destaquesTitulo'))}
        <ol class="d-dest-lista">
        ${destaques}
        </ol>
      </section>
      ${tecnico ? `\n      ${secaoTecnica(tecnico, num('s-tecnico'), C)}\n` : ''}
      <section class="d-sec d-sec-stack" id="s-stack" aria-labelledby="d-stack-t" data-secao>
        ${cabSecao(num('s-stack'), 'd-stack-t', p0('projetos.detalhe.stackLinksTitulo'))}
        <div class="d-stackg">
          <div data-revela><h3>${p0('projetos.detalhe.stackTitulo')}</h3><p>${stackDe(p).map(esc).join(', ')}</p></div>
          <div data-revela="1"><h3>${p0('projetos.detalhe.linksTitulo')}</h3><div class="d-acoes">${links}</div></div>
        </div>
      </section>
      </div>
    </div>
  </article>

  <nav class="d-nav" aria-label="${p0('projetos.detalhe.navegacao')}">
    <a class="d-ant" href="../${ant.id}/"><span>${p0('projetos.detalhe.anterior')}</span><b>${esc(ant.nome)}</b></a>
    <a class="d-todos" href="${home}#projetos">${esc(T.projetos.detalhe.voltar)}</a>
    <a class="d-prox" href="../${prox.id}/"><span>${p0('projetos.detalhe.proximo')}</span><b>${esc(prox.nome)}</b></a>
  </nav>
</main>
<dialog class="lb" aria-label="${p0('projetos.detalhe.ampliar')}">
  <figure class="lb-fig"><figcaption class="lb-leg"></figcaption></figure>
  <button type="button" class="lb-btn lb-ant" aria-label="${p0('projetos.detalhe.ampliarAnterior')}">&larr;</button>
  <button type="button" class="lb-btn lb-prox" aria-label="${p0('projetos.detalhe.ampliarProxima')}">&rarr;</button>
  <button type="button" class="lb-btn lb-fechar" autofocus>${p0('projetos.detalhe.ampliarFechar')}</button>
</dialog>

<footer class="d-rodape">
  <p class="d-rod-t"><a href="${home}#contato">${p0('contato.titulo')}</a></p>
  <p><a href="mailto:${esc(I.email)}">${esc(I.email)}</a><a href="${esc(I.linkedin)}"${novaAba}>${esc(T.interface.linkedin)}</a><a href="${esc(I.github)}"${novaAba}>${esc(T.interface.github)}</a><a href="${pref}${I.cv[cod]}" target="_blank" rel="noopener">${esc(T.interface.baixarCv)}</a></p>
</footer>
</body>
</html>
`;
}

/* 9. Modelo da imagem de compartilhamento (1200×630) */

// capa de compartilhamento: minimalista, só a frase, o nome com o título e o endereço do idioma
// (sem números que envelhecem; decisão do dono em 11/11/2026)
function gerarOg(idioma) {
  const C = contexto(idioma);
  const urlArq = rel => pathToFileURL(path.join(raiz, rel)).href;
  return `<!doctype html>
<html lang="${idioma.lang}"><head><meta charset="utf-8">
<style>
@font-face{font-family:'Fraunces';src:url('${urlArq(FONTES.serif)}') format('woff2');font-weight:100 900}
@font-face{font-family:'Geist';src:url('${urlArq(FONTES.sans)}') format('woff2');font-weight:100 900}
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#FBFBF8;color:#1E1F1A}
body{position:relative;font-family:'Geist',sans-serif;
  background-image:linear-gradient(to right,rgba(30,31,26,.045) 1px,transparent 1px),linear-gradient(to bottom,rgba(30,31,26,.045) 1px,transparent 1px);background-size:96px 32px}
p{margin:0}
.t{position:absolute;left:84px;right:90px;top:92px;font:350 74px/1.12 'Fraunces';letter-spacing:-.015em}
.risco{position:relative;color:#55564D}.risco::after{content:'';position:absolute;left:-2px;right:-2px;top:54%;height:3px;background:#B3261E}
.marca{font-style:normal;background:linear-gradient(transparent 58%,#F4DE6B 58%,#F4DE6B 92%,transparent 92%)}
.quem{position:absolute;left:84px;bottom:104px;font:500 26px 'Geist'}
.quem span{color:#55564D;font-weight:400}
.url{position:absolute;left:84px;bottom:64px;font:500 22px 'Geist';color:#55564D}
</style></head><body>
<p class="t">${C.h('identidade.tese')}</p>
<p class="quem">${esc(dados.identidade.nome)} <span>· ${C.p0('identidade.titulo')}</span></p>
<p class="url">${esc(host(dados.site.baseUrl + idioma.pasta))}</p>
</body></html>`;
}

/* 10. robots.txt, sitemap.xml e 404.html */

function gerarExtras() {
  const base = dados.site.baseUrl;
  const caminho = new URL(base).pathname;
  const idiomaPadrao = dados.site.idiomas.find(i => i.codigo === padrao);
  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${base}sitemap.xml\n`;
  const lastmod = hoje.toISOString().slice(0, 10);
  const grupos = [
    i => base + i.pasta,
    ...projetos.map(p => i => `${base}${i.pasta}projetos/${p.id}/`)
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${grupos.map(url => idiomasLinks.map(i => `  <url>
    <loc>${esc(url(i))}</loc>
    <lastmod>${lastmod}</lastmod>
${[...idiomasLinks.map(j => [j.hreflang, url(j)]), ['x-default', url(idiomaPadrao)]].map(([hl, u]) => `    <xhtml:link rel="alternate" hreflang="${hl}" href="${esc(u)}"/>`).join('\n')}
  </url>`).join('\n')).join('\n')}
</urlset>
`;
  const blocos = idiomasLinks.map(i => {
    const T = textosTodos[i.codigo];
    return `<section lang="${i.lang}"><h2>${esc(T.erro404.titulo)}</h2><p>${esc(T.erro404.texto)}</p><p class="ls"><a href="${esc(caminho + i.pasta)}" data-r="${esc(i.pasta)}">${esc(T.erro404.link)}</a><a href="${esc(caminho + i.pasta)}#projetos" data-r="${esc(i.pasta)}#projetos">${esc(T.erro404.linkProjetos)}</a></p></section>`;
  }).join('\n    ');
  const pagina404 = `<!doctype html>
<html lang="${idiomaPadrao.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>404 — ${esc(dados.identidade.nome)}</title>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(readFileSync(path.join(raiz, 'favicon.svg'), 'utf8').replace(/\r\n?/g, '\n').trim())}" type="image/svg+xml">
<script>(function(){var b=${JSON.stringify(caminho)};if(location.pathname.indexOf(b)!==0)b='/';var s=document.createElement('style');s.textContent="@font-face{font-family:'Fraunces';src:url('"+b+"${FONTES.serif}') format('woff2');font-weight:100 900;font-display:swap}@font-face{font-family:'Geist';src:url('"+b+"${FONTES.sans}') format('woff2');font-weight:100 900;font-display:swap}";document.head.appendChild(s);document.addEventListener('DOMContentLoaded',function(){[].forEach.call(document.querySelectorAll('[data-r]'),function(a){a.href=b+a.getAttribute('data-r')})})})();</script>
<style>
*{box-sizing:border-box}
html,body{margin:0;background:#FBFBF8;color:#1E1F1A}
body{min-height:100vh;display:flex;flex-direction:column;font:400 16px/1.5 'Geist','Segoe UI',system-ui,sans-serif}
header{display:flex;align-items:center;height:56px;padding:0 max(16px,calc((100vw - 1344px) / 2));border-bottom:1px solid #D9DBD0}
header a{font:400 21px 'Fraunces',Georgia,serif;text-decoration:none;color:inherit}
main{flex:1;width:100%;max-width:1376px;margin:0 auto;padding:clamp(40px,10vh,110px) 16px 60px;
  background-image:linear-gradient(to right,rgba(30,31,26,.045) 1px,transparent 1px),linear-gradient(to bottom,rgba(30,31,26,.045) 1px,transparent 1px);background-size:112px 28px}
h1{margin:0;font:300 clamp(6rem,22vw,14rem)/.85 'Fraunces',Georgia,serif;letter-spacing:-.03em}
h1 span{position:relative;color:#55564D}h1 span::after{content:'';position:absolute;left:-.03em;right:-.03em;top:54%;height:.025em;background:#B3261E}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:32px;margin-top:56px}
section{border-top:1px solid #1E1F1A;padding-top:16px}
h2{margin:0 0 6px;font:400 26px/1.2 'Fraunces',Georgia,serif}
p{margin:0 0 14px;color:#55564D}
.ls{display:flex;flex-wrap:wrap;gap:6px 20px}
a{color:#1E1F1A}
.ls a{font-weight:500;text-underline-offset:4px;text-decoration-thickness:1px;padding:6px 0}
.ls a:hover{color:#2445B5}
:focus-visible{outline:2px solid #2445B5;outline-offset:3px}
</style>
</head>
<body>
<header><a href="${esc(caminho)}" data-r="">${esc(dados.identidade.nome)}</a></header>
<main>
  <h1><span>404</span></h1>
  <div class="grid">
    ${blocos}
  </div>
</main>
</body>
</html>
`;
  return { 'robots.txt': robots, 'sitemap.xml': sitemap, '404.html': pagina404 };
}

/* 11. Gravação */

for (const idioma of idiomasAtivos) {
  const destino = path.join(raiz, idioma.pasta, 'index.html');
  mkdirSync(path.dirname(destino), { recursive: true });
  writeFileSync(destino, gerarPagina(idioma));
  console.log(`✔ ${path.relative(raiz, destino).split(path.sep).join('/')}  (${idioma.lang})`);
  projetos.forEach((p, idx) => {
    const arq = path.join(raiz, idioma.pasta, 'projetos', p.id, 'index.html');
    mkdirSync(path.dirname(arq), { recursive: true });
    writeFileSync(arq, gerarDetalhe(idioma, p, idx));
  });
  console.log(`✔ ${idioma.pasta}projetos/<id>/index.html  (${projetos.length} páginas de projeto)`);
}
for (const [arq, conteudo] of Object.entries(gerarExtras())) {
  writeFileSync(path.join(raiz, arq), conteudo);
  console.log(`✔ ${arq}`);
}
if (ogDir) {
  mkdirSync(ogDir, { recursive: true });
  for (const idioma of idiomasAtivos) {
    const arq = path.join(ogDir, `og-${idioma.codigo}.html`);
    writeFileSync(arq, gerarOg(idioma));
    console.log(`✔ modelo da og: ${arq}`);
  }
}
const inativos = dados.site.idiomas.filter(i => !comTextos.includes(i)).map(i => i.codigo);
const mantidos = idiomasLinks.filter(i => !idiomasAtivos.includes(i)).map(i => i.codigo);
console.log(`Projetos: ${projetos.length}, demos ativas: ${calc.demosAtivas}, ordem: ${projetos.map(p => p.nome).join(', ')}`);
if (inativos.length) console.log(`Idiomas sem textos (não gerados): ${inativos.join(', ')}`);
if (mantidos.length) console.log(`Não gerados nesta execução (as páginas existentes ficaram como estavam): ${mantidos.join(', ')}`);
for (const i of idiomasAtivos) if (!existsSync(path.join(raiz, `assets/img/og-${i.codigo}.png`)))
  console.log(`Aviso: falta assets/img/og-${i.codigo}.png (gere com scripts/gerar-cv.ps1)`);
