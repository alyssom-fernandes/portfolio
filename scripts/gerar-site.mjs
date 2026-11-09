// Gera o site estático a partir da fonte única de dados.
//
// Uso (na pasta do projeto):
//   npm run build                              gera index.html (pt-BR) e, se existirem os textos, en/ e es/
//   npm run build -- --idiomas pt              gera só as páginas dos idiomas listados (separados por vírgula);
//                                              as outras páginas já existentes ficam como estão (e continuam no
//                                              seletor de idioma, nos hreflang e no sitemap). Também aceita a
//                                              variável de ambiente IDIOMAS=pt
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
// As variáveis vêm dos dados ({empresasClientes}, {carreira.zen.ano}...) ou são calculadas aqui
// ({anosCarreira}, {projetosPublicados}, {demosAtivas}...). Nenhuma contagem é escrita à mão.
//
// O gerador para com uma mensagem clara se faltar chave em algum idioma ativo, se um projeto citar
// uma tela que não existe no manifesto ou se um projeto não tiver os campos mínimos.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

/* ─────────────────────────── 1. Leitura ─────────────────────────── */

const dados = lerJson('fonte/dados.json');
const manifesto = lerJson('assets/projetos/manifesto.json');
// idiomas com textos (fonte/textos.<idioma>.json existe)
const comTextos = dados.site.idiomas.filter(i => existsSync(path.join(raiz, 'fonte', `textos.${i.codigo}.json`)));
const padrao = dados.site.idiomaPadrao;
if (!comTextos.some(i => i.codigo === padrao)) falhar([`falta fonte/textos.${padrao}.json (idioma padrão)`]);
if (listaPedida.length) {
  const desconhecidos = listaPedida.filter(c => !comTextos.some(i => i.codigo === c));
  if (desconhecidos.length) falhar([`--idiomas: ${desconhecidos.join(', ')} não tem fonte/textos.<idioma>.json (há: ${comTextos.map(i => i.codigo).join(', ')})`]);
}
// idiomas gerados NESTA execução (todos, ou só os pedidos em --idiomas)
const idiomasAtivos = listaPedida.length ? comTextos.filter(i => listaPedida.includes(i.codigo)) : comTextos;
// idiomas que aparecem no seletor, nos hreflang, no sitemap e na 404: os gerados agora e os que já têm página
const idiomasLinks = comTextos.filter(i => idiomasAtivos.includes(i) || existsSync(path.join(raiz, i.pasta, 'index.html')));
const textosTodos = Object.fromEntries(comTextos.map(i => [i.codigo, lerJson(`fonte/textos.${i.codigo}.json`)]));
const textos = Object.fromEntries(idiomasAtivos.map(i => [i.codigo, textosTodos[i.codigo]]));

const projetos = [...dados.projetos].sort((a, b) => a.ordem - b.ordem);
const carreira = dados.carreira;
const hoje = new Date();
const mesIdx = (y, m) => y * 12 + (m - 1);
const HOJE = mesIdx(hoje.getFullYear(), hoje.getMonth() + 1);

/* ─────────────────────────── 2. Valores calculados ─────────────────────────── */

const inicioCarreira = carreira[0].inicio;
const anosCompletos = Math.floor((HOJE - mesIdx(...inicioCarreira)) / 12);
const temDemoAtiva = p => !!(p.demo && p.demo.ativa);
const calc = {
  anosCarreira: `${anosCompletos}+`,
  anoInicio: String(inicioCarreira[0]),
  projetosPublicados: String(projetos.length),
  demosAtivas: String(projetos.filter(temDemoAtiva).length),
  fuso: dados.identidade.fuso,
  'formacao.conclusao': String(dados.formacao.conclusao),
  'formacao.instituicao': dados.formacao.instituicao
};

/* ─────────────────────────── 3. Validação ─────────────────────────── */

const erros = [];

// 3a. chaves iguais em todos os idiomas ativos (chaves com _ são ignoradas)
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
  const base = planoPadrao;
  const antes = erros.length;
  for (const k of Object.keys(base)) {
    if (!(k in plano)) erros.push(`textos.${cod}.json: falta a chave "${k.replace(/\.#$/, '')}"`);
    else if (k.endsWith('#') && plano[k] !== base[k]) erros.push(`textos.${cod}.json: "${k.slice(0, -2)}" tem ${plano[k]} itens (em ${padrao}: ${base[k]})`);
  }
  for (const k of Object.keys(plano)) if (!(k in base)) erros.push(`textos.${cod}.json: chave "${k.replace(/\.#$/, '')}" não existe em textos.${padrao}.json`);
  if (erros.length > antes) desatualizados.push(cod);
}
for (const [cod, plano] of Object.entries(planos))
  for (const [k, v] of Object.entries(plano))
    if (typeof v === 'string' && /<[a-z/!]/i.test(v)) erros.push(`textos.${cod}.json: "${k}" tem HTML; use *ênfase*, **negrito** ou ~riscado~`);

// 3b. projetos
const ids = new Set();
const temTexto = (cod, chave) => typeof pegar(textos[cod], chave) === 'string';
for (const p of projetos) {
  const onde = `projeto "${p.id || '?'}"`;
  for (const campo of ['id', 'nome', 'nivel', 'ordem', 'codigo', 'stack', 'telas', 'itens'])
    if (p[campo] === undefined || p[campo] === null || p[campo] === '') erros.push(`${onde}: falta o campo "${campo}"`);
  if (!p.id) continue;
  if (ids.has(p.id)) erros.push(`${onde}: id repetido`);
  ids.add(p.id);
  if (!['lancamento', 'cartao'].includes(p.nivel)) erros.push(`${onde}: nivel deve ser "lancamento" ou "cartao" (está "${p.nivel}")`);
  if (!Array.isArray(p.codigo) || !p.codigo.length || p.codigo.some(c => !c.url || !c.rotulo)) erros.push(`${onde}: "codigo" precisa de ao menos um { rotulo, url }`);
  if (p.demo && (typeof p.demo.url !== 'string' || typeof p.demo.ativa !== 'boolean')) erros.push(`${onde}: "demo" precisa de { url, ativa: true|false } (ou null)`);
  const telas = Array.isArray(p.telas) ? p.telas : [];
  for (const k of telas) if (!manifesto[k]) erros.push(`${onde}: a tela "${k}" não existe em assets/projetos/manifesto.json`);
  if (p.celular && !manifesto[p.celular]) erros.push(`${onde}: o celular "${p.celular}" não existe em assets/projetos/manifesto.json`);
  if (telas.length && !p.legenda) erros.push(`${onde}: tem telas, então precisa de "legenda" ("demo" ou "repositorio")`);
  for (const it of p.itens || []) {
    if (it.tela === 'celular' ? !p.celular : !telas.includes(it.tela)) erros.push(`${onde}: o item "${it.id}" usa a tela "${it.tela}", que não está em "telas"${it.tela === 'celular' ? ' (nem há "celular")' : ''}`);
  }
  if (p.nivel === 'lancamento') {
    if (!telas.length) erros.push(`${onde}: para ser "lancamento" precisa de ao menos uma tela`);
    if (!(p.itens || []).length) erros.push(`${onde}: para ser "lancamento" precisa de itens (destaques sincronizados com as telas)`);
  }
  if (p.nivel === 'lancamento' && (p.itens || []).length && p.itens[0].tela === 'celular')
    erros.push(`${onde}: o primeiro destaque não pode ser o "celular" (o celular entra na cena depois da janela)`);
  if (p.demo && 'exigeChaveApi' in p.demo) erros.push(`${onde}: "exigeChaveApi" não existe mais; toda demo ativa conta como demo ao vivo`);
  for (const cod of Object.keys(textos)) {
    // frase: aparece no índice de projetos e no lançamento · cv: linha do projeto no currículo impresso
    const req = [`projetos.${p.id}.resumo`, `projetos.${p.id}.frase`, `projetos.${p.id}.cv`];
    for (const it of p.itens || []) if (p.nivel === 'lancamento') req.push(`projetos.${p.id}.itens.${it.id}.titulo`, `projetos.${p.id}.itens.${it.id}.texto`);
    for (const k of [...telas, ...(p.celular ? [p.celular] : [])]) req.push(`alt.${k.replace('/', '.')}`);
    if (p.legenda) req.push(`projetos.legendas.${p.legenda}`);
    for (const c of p.codigo || []) req.push(`interface.rotulosCodigo.${c.rotulo}`);
    for (const s of p.stack || []) if (typeof s === 'object') req.push(s.texto);
    for (const k of req) if (!temTexto(cod, k)) erros.push(`textos.${cod}.json: falta "${k}" (${onde})`);
  }
}

// 3c. matriz, negócio, carreira
const M = dados.matriz;
for (const c of M.colunas) if (!ids.has(c)) erros.push(`matriz: a coluna "${c}" não é um projeto`);
for (const l of M.linhas) {
  if (l.marcas.length !== M.colunas.length || /[^01]/.test(l.marcas)) erros.push(`matriz: a linha "${l.id}" precisa de ${M.colunas.length} marcas 0/1`);
  for (const cod of Object.keys(textos)) if (!temTexto(cod, `habilidades.linhas.${l.id}`)) erros.push(`textos.${cod}.json: falta "habilidades.linhas.${l.id}"`);
}
const idsCarreira = new Set(carreira.map(c => c.id));
for (const n of dados.negocio) for (const o of n.onde) if (!idsCarreira.has(o)) erros.push(`negocio "${n.id}": "${o}" não está na carreira`);
carreira.forEach((c, i) => { if (c.fim === null && i !== carreira.length - 1) erros.push(`carreira "${c.id}": só a última fase pode ter fim null`); });

// 3d. variáveis conhecidas
const varsProjetos = new Set(projetos.flatMap(p => Object.keys(p.numeros || {})));
const varsLocais = new Set(['mes', 'ano', 'inicio', 'fim', 'texto', 'n', 'total']);
const varsCarreira = new Set(carreira.flatMap(c => ['empresa', 'curto', 'cargo', 'cargoFormal', 'inicio', 'fim', 'periodo', 'anos', 'ano', 'anoInicio', 'anoFim'].map(k => `carreira.${c.id}.${k}`)));
const varsGlobais = new Set([...Object.keys(dados.numeros), ...Object.keys(dados.numeros).map(k => k + 'Base'), ...Object.keys(calc),
  'pais', 'marca', 'formacao.curso', 'atualizado', 'foraDaMatriz']);
for (const [cod, plano] of Object.entries(planos))
  for (const [k, v] of Object.entries(plano))
    if (typeof v === 'string') for (const [, nome] of v.matchAll(/\{([^}]+)\}/g))
      if (![varsProjetos, varsLocais, varsCarreira, varsGlobais].some(s => s.has(nome))) erros.push(`textos.${cod}.json: "${k}" usa a variável {${nome}}, que não existe`);

if (desatualizados.length) erros.push(`Traduções desatualizadas (${desatualizados.map(c => `textos.${c}.json`).join(', ')}). Para gerar só o ${padrao.toUpperCase()} enquanto elas não chegam: npm run build -- --idiomas ${padrao}`);
if (erros.length) falhar(erros);

/* ─────────────────────────── 4. Utilidades de texto ─────────────────────────── */

function pegar(obj, chave) { return chave.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function preencher(modelo, vars, contexto) {
  return String(modelo).replace(/\{([^}]+)\}/g, (_, nome) => {
    if (!(nome in vars)) falhar([`variável {${nome}} sem valor em "${contexto}"`]);
    return vars[nome];
  });
}
// marcação mínima → HTML (o texto é escapado antes)
function marcar(s, { em = '', risco = 'strike', semRisco = false } = {}) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, em ? `<em class="${em}">$1</em>` : '<em>$1</em>')
    .replace(/~(.+?)~/g, semRisco ? '$1' : `<span class="${risco}">$1</span>`);
}
const limpar = s => String(s).replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/~(.+?)~/g, '$1');
const hash = rel => createHash('md5').update(readFileSync(path.join(raiz, rel))).digest('hex').slice(0, 8);
const host = u => u.replace(/^https?:\/\//, '').replace(/\/$/, '');
const dois = n => String(n).padStart(2, '0');

/* ─────────────────────────── 5. Página de um idioma ─────────────────────────── */

function gerarPagina(idioma) {
  const cod = idioma.codigo;
  const T = textos[cod];
  const F = T.formato;
  const pref = '../'.repeat(idioma.pasta.split('/').filter(Boolean).length);
  const base = dados.site.baseUrl;
  const abs = rel => base + rel;
  const urlIdioma = i => abs(i.pasta);

  // variáveis deste idioma
  // cada data é indivisível (espaço rígido): a linha só pode quebrar entre as datas, nunca no meio de uma
  const mesAno = ([y, m]) => preencher(F.mesAno, { mes: F.mesesCurtos[m - 1], ano: y }, 'formato.mesAno').replace(/ /g, ' ');
  const V = { ...calc, pais: T.identidade.pais, marca: dados.identidade.marca, 'formacao.curso': T.formacao.curso };
  for (const [k, v] of Object.entries(dados.numeros)) { V[k] = v; V[k + 'Base'] = v.replace(/\+$/, ''); }
  V.atualizado = preencher(F.mesAnoLongo, { mes: F.mesesLongos[hoje.getMonth()], ano: hoje.getFullYear() }, 'formato.mesAnoLongo');
  // projetos fora da matriz (se houver): citados numa frase à parte (habilidades.notaFora)
  const fora = projetos.filter(p => !M.colunas.includes(p.id)).map(p => p.nome);
  V.foraDaMatriz = new Intl.ListFormat(idioma.lang, { type: 'conjunction' }).format(fora);
  for (const c of carreira) {
    const k = `carreira.${c.id}.`, TC = T.carreira[c.id];
    const fim = c.fim ? mesAno(c.fim) : F.hoje;
    Object.assign(V, {
      [k + 'empresa']: c.empresa, [k + 'curto']: c.curto, [k + 'cargo']: TC.cargo, [k + 'cargoFormal']: TC.cargoFormal,
      [k + 'inicio']: mesAno(c.inicio), [k + 'fim']: fim, [k + 'periodo']: preencher(F.periodo, { inicio: mesAno(c.inicio), fim }, 'formato.periodo'),
      [k + 'ano']: String(c.inicio[0]), [k + 'anoInicio']: String(c.inicio[0]), [k + 'anoFim']: c.fim ? String(c.fim[0]) : F.hoje,
      [k + 'anos']: c.fim ? `${c.inicio[0]}–${c.fim[0]}` : `${c.inicio[0]}–${F.hoje}`
    });
  }
  const txt = (chave, extra = {}) => {
    const v = pegar(T, chave);
    if (typeof v !== 'string') falhar([`textos.${cod}.json: falta "${chave}"`]);
    return preencher(v, { ...V, ...extra }, chave);
  };
  const h = (chave, extra, op) => marcar(txt(chave, extra), op);   // HTML
  const p0 = (chave, extra) => esc(limpar(txt(chave, extra)));    // texto puro, escapado

  // projetos: valores derivados
  // status: "Em produção" vence; senão "Demo ao vivo" (demo ativa); senão "Código"
  const statusDe = p => p.emProducao ? 'producao' : temDemoAtiva(p) ? 'demo' : 'codigo';
  const badge = p => { const s = statusDe(p); return `<span class="badge ${s}">${esc(T.interface.status[s])}</span>`; };
  // na barra da janela: o endereço da demo (sem ?demo=1) ou, sem demo, o do repositório
  const urlBarra = p => (temDemoAtiva(p) ? host(p.demo.url) : host(p.codigo[0].url)).replace(/[?#].*$/, '').replace(/\/$/, '');
  const stackDe = p => p.stack.map(s => typeof s === 'object' ? txt(s.texto) : s);
  const varsP = p => Object.fromEntries(Object.entries(p.numeros || {}).map(([k, v]) => [k, v]));
  const novaAba = ' target="_blank" rel="noopener"';
  const seta = '<span class="arr" aria-hidden="true">↗</span>';
  // sem demo ativa: só os botões de código (o UnifyData tem dois: web e Python)
  const botoes = p =>
    (temDemoAtiva(p) ? `<a class="btn solid sm" href="${esc(p.demo.url)}"${novaAba}>${esc(T.interface.verDemo)} ${seta}</a>` : '')
    + p.codigo.map(c => `<a class="btn ghost sm" href="${esc(c.url)}"${novaAba}>${esc(T.interface.rotulosCodigo[c.rotulo])} ${seta}</a>`).join('');
  // textos opcionais de cada projeto: prova (número com a fonte, ex.: testes no CI) e obs (observação curta)
  const opcional = (p, k) => temTexto(cod, `projetos.${p.id}.${k}`) ? h(`projetos.${p.id}.${k}`, varsP(p)) : '';
  // posição na página (1, 2, 3...) e total, para o índice e a numeração
  const pos = p => dois(projetos.indexOf(p) + 1);
  const total = dois(projetos.length);

  // imagem a partir do manifesto
  const img = (chave, { cls = '', attrs = '', tamanhos = '(max-width: 760px) 92vw, 780px' } = {}) => {
    const m = manifesto[chave];
    const srcset = [...m.variantes.map(v => `${pref}${v.src} ${v.w}w`), `${pref}${m.src} ${m.w}w`].join(', ');
    return `<img${cls ? ` class="${cls}"` : ''} src="${pref}${m.src}"${m.variantes.length ? ` srcset="${srcset}" sizes="${tamanhos}"` : ''} width="${m.w}" height="${m.h}" alt="${p0('alt.' + chave.replace('/', '.'))}" loading="lazy" decoding="async"${attrs}>`;
  };

  const cvHref = pref + dados.identidade.cv[cod];
  const I = dados.identidade;
  // o número do WhatsApp nunca quebra de linha (nem no hífen)
  const fone = `<span class="nw">${esc(I.whatsappExibicao)}</span>`;

  /* ---------- cabeçalho ---------- */
  const seletor = idiomasLinks.length > 1
    ? `<nav class="idiomas" aria-label="${esc(T.interface.idioma)}">${idiomasLinks.map(i =>
        `<a href="${pref}${i.pasta}" hreflang="${i.hreflang}" lang="${i.lang}" data-pasta${i.codigo === cod ? ' aria-current="page"' : ''} title="${esc(i.nome)}">${i.codigo.toUpperCase()}</a>`).join('')}</nav>`
    : '';
  const cabecalho = `<header class="mast" id="mast">
  <a class="brand" href="#topo">${esc(I.nome)}</a>
  <nav class="mast-nav" aria-label="${esc(T.interface.secoes)}">
    <a href="#trajetoria">${esc(T.trajetoria.secao)}</a>
    <a href="#projetos">${esc(T.projetos.secao)}</a>
    <a href="#habilidades">${esc(T.habilidades.secao)}</a>
    <a href="#formacao">${esc(limpar(T.formacao.secao))}</a>
  </nav>
  <div class="mast-acts">
    ${seletor}
    <a class="pill solid" href="${cvHref}" target="_blank" rel="noopener" aria-label="${esc(T.interface.baixarCv)}">${esc(T.interface.cvCurto)} <span aria-hidden="true">↓</span></a>
    <a class="pill" href="#contato">${esc(T.interface.contato)}</a>
  </div>
  <div class="progress" id="progress"></div>
</header>`;

  /* ---------- abertura ---------- */
  const sup = v => { const m = String(v).match(/^(.*?)(\+?)$/); return esc(m[1]) + (m[2] ? '<sup>+</sup>' : ''); };
  const abertura = `<section class="hero wrap" id="topo" data-cena="abertura">
    <div class="folio"><span>${p0('abertura.folio')}</span><span data-hoje="${esc(T.identidade.pais)}, ${esc(I.fuso)}">${esc(T.identidade.pais)}, ${esc(I.fuso)}</span></div>
    <div class="hero-txt">
      <p class="kicker"><i></i>${p0('abertura.kicker')}</p>
      <h1 class="nome">${I.nome.split(' ').map((w, i) => `<span class="ln"><span style="--i:${i}">${esc(w)}</span></span>`).join(' ')}</h1>
      <p class="tese">${h('identidade.tese', {}, { em: 'sis' })}</p>
      <p class="linha-fina">${h('abertura.linhaFina')}</p>
      <div class="assina">
        <span class="role">${p0('identidade.titulo')}</span>
        <p class="dispo"><span class="pulse" aria-hidden="true"></span><span>${h('abertura.disponivel')}</span></p>
      </div>
      <div class="acoes">
        <a class="btn solid" href="${cvHref}" target="_blank" rel="noopener">${esc(T.interface.baixarCv)} <span class="arr" aria-hidden="true">↓</span></a>
        <a class="btn ghost" href="#contato">${esc(T.interface.contato)}</a>
        <nav class="redes" aria-label="${esc(T.interface.redes)}">
          <a href="${esc(I.linkedin)}"${novaAba}>${esc(T.interface.linkedin)} <span aria-hidden="true">↗</span></a>
          <a href="${esc(I.github)}"${novaAba}>${esc(T.interface.github)} <span aria-hidden="true">↗</span></a>
        </nav>
      </div>
    </div>
    <aside class="ficha" aria-label="${p0('abertura.ficha.titulo')}">
      <div class="ficha-h"><span>${p0('abertura.ficha.titulo')}</span><span>${p0('abertura.ficha.periodo')}</span></div>
      <div class="ficha-r"><b>${sup(V.anosCarreira)}</b><span>${p0('abertura.ficha.anosRotulo')}</span><small>${p0('abertura.ficha.anosNota')}</small></div>
      <div class="ficha-r"><b>${sup(V.empresasClientes)}</b><span>${p0('abertura.ficha.empresasRotulo')}</span><small>${p0('abertura.ficha.empresasNota')}</small></div>
      <div class="ficha-r"><b class="z">${esc(V.projetosPublicados)}</b><span>${p0('abertura.ficha.projetosRotulo')}</span><small>${p0('abertura.ficha.projetosNota')}</small></div>
      <div class="agora"><span class="k">${p0('abertura.agora.rotulo')}</span><b>${p0('abertura.agora.titulo')}</b>${p0('abertura.agora.texto')}</div>
    </aside>
  </section>`;

  /* ---------- trajetória ---------- */
  // grade estática (sem JavaScript); com JavaScript, main.js refaz a grade com a data do visitante
  const fases = carreira.map(c => ({ id: c.id, a: mesIdx(...c.inicio), b: c.fim ? mesIdx(...c.fim) : HOJE, cor: c.cor }));
  const naData = i => fases.filter(f => i >= f.a && i <= f.b);
  const Y0 = inicioCarreira[0], Y1 = Math.floor(HOJE / 12);
  // meses de cada empresa = meses do período exibido (o mês de transição conta para as duas);
  // o total conta cada mês de calendário uma vez só
  const contagem = Object.fromEntries(fases.map(f => [f.id, 0]));
  let totalMeses = 0;
  let grade = '<span></span>' + [...T.trajetoria.figura.iniciaisMeses].map(l => `<span class="ax">${esc(l)}</span>`).join('');
  for (let y = Y0; y <= Y1; y++) {
    grade += `<span class="ax yr${y === Y1 ? ' b' : ''}">${y}</span>`;
    for (let m = 1; m <= 12; m++) {
      const i = mesIdx(y, m), fs = naData(i);
      if (i > HOJE) { grade += '<span class="cell fut"></span>'; continue; }
      if (!fs.length) { grade += '<span class="cell pre"></span>'; continue; }
      const dom = fs[fs.length - 1];
      for (const f of fs) contagem[f.id]++;
      totalMeses++;
      const bg = fs.length > 1 ? `linear-gradient(135deg, ${fs[0].cor} 50%, ${fs[1].cor} 50%)` : dom.cor;
      grade += `<span class="cell${i === HOJE ? ' hoje' : ''}"><i style="background:${bg}"></i></span>`;
    }
  }
  const meses = n => `${n} ${n === 1 ? F.mes : F.meses}`;
  const passos = T.trajetoria.passos;
  const trajetoria = `<section class="scene traj" id="trajetoria" data-cena="trajetoria" style="--altura:460vh">
    <div class="stick">
      <div class="t-txt">
        <div class="t-head"><h2 class="sec-k">${esc(T.trajetoria.secao)}</h2></div>
        <div class="t-steps">
          ${passos.map((s, j) => `<article class="t-step">
            <p class="t-n">${dois(j + 1)} <span>/ ${dois(passos.length)}</span></p>
            <h3>${h(`trajetoria.passos.${j}.titulo`)}</h3>
            <p>${h(`trajetoria.passos.${j}.texto`)}${s.extra ? `<span class="xtra"> ${h(`trajetoria.passos.${j}.extra`)}</span>` : ''}</p>
            ${s.chips.length ? `<div class="t-chips">${s.chips.map((c, k) => `<span>${p0(`trajetoria.passos.${j}.chips.${k}`)}</span>`).join('')}</div>` : ''}
            ${s.fonte ? `<p class="src">${p0(`trajetoria.passos.${j}.fonte`)}</p>` : ''}
          </article>`).join('\n          ')}
        </div>
      </div>
      <figure class="t-fig" style="--linhas:${Y1 - Y0 + 2}">
        <div class="fig-top">
          <div><div class="fig-k">${p0('trajetoria.figura.rotulo')}</div><div class="fig-t">${p0('trajetoria.figura.titulo')}</div></div>
          <div class="cnt"><b id="cntN">${totalMeses}</b><span>${esc(F.meses)}</span></div>
        </div>
        <div class="grid-m" id="gridM" role="img" aria-label="${p0('trajetoria.figura.legendaGrade')}">${grade}</div>
        <div class="virada" id="virada"><span class="tag">${p0('trajetoria.figura.virada')}</span></div>
        <div class="lg">${carreira.map(c => `<div class="lg-i" data-ph="${c.id}"><i style="background:${c.cor}"></i><b>${esc(c.curto)}</b><em>${p0(`carreira.${c.id}.area`)}</em><span>${esc(V[`carreira.${c.id}.periodo`])}</span><strong>${meses(contagem[c.id])}</strong></div>`).join('')}</div>
        <p class="fig-q" id="figQ">${marcar(txt('trajetoria.figura.aspas', { texto: txt('identidade.tese') }), { semRisco: true }).replace(/<em>/g, '<b>').replace(/<\/em>/g, '</b>')}</p>
      </figure>
    </div>
  </section>`;

  /* ---------- projetos: abertura da seção + índice ---------- */
  // o índice é uma lista de âncoras (funciona sem JavaScript): número, nome, frase e status de cada projeto.
  // A revelação (data-rev) fica nos filhos, nunca no alvo da âncora: assim o salto pelo índice para no lugar certo.
  const indice = `<nav class="p-indice" id="indice" aria-labelledby="indice-t">
      <div class="pi-h" data-rev><h3 class="pi-t" id="indice-t">${p0('projetos.indice.titulo')}</h3><p>${h('projetos.indice.texto')}</p></div>
      <ol class="pi-l" data-rev>${projetos.map(p => `
        <li><a href="#p-${p.id}"><span class="pi-n">${pos(p)}</span><span class="pi-nome">${esc(p.nome)}</span><span class="pi-f">${p0(`projetos.${p.id}.frase`, varsP(p))}</span>${badge(p)}</a></li>`).join('')}
      </ol>
    </nav>`;
  const introProjetos = `<section class="p-intro wrap" id="projetos" data-cena="projetos">
    <p class="sec-k" data-rev>${esc(T.projetos.secao)}</p>
    <h2 class="sec-t" data-rev>${h('projetos.titulo')}</h2>
    <p class="sec-p" data-rev>${h('projetos.texto')}</p>
    <div class="counts" data-rev>
      <div><b>${esc(V.projetosPublicados)}</b>${p0('projetos.publicados')}</div>
      <div><b class="z">${esc(V.demosAtivas)}</b>${p0('projetos.comDemo')}</div>
    </div>
    <p class="marca-afn" data-rev>${h('projetos.marca')}</p>
    ${indice}
  </section>`;

  // numeração de cada cena: os números de todos os projetos, cada um uma âncora (o atual em destaque)
  const miniIndice = atual => `<nav class="l-idx" aria-label="${p0('projetos.indice.rotulo')}">${projetos.map(q =>
    `<a href="#p-${q.id}" title="${esc(q.nome)}"${q === atual ? ' aria-current="true"' : ''}>${pos(q)}</a>`).join('')}</nav>`;

  /* ---------- lançamentos ---------- */
  // altura da cena = altura da tela + um "passo" de rolagem por destaque (--passo, em style.css)
  const lancamentos = projetos.filter(p => p.nivel === 'lancamento').map(p => {
    const vp = varsP(p), m0 = manifesto[p.telas[0]];
    const cel = p.celular ? manifesto[p.celular] : null;
    // só as telas usadas pelos destaques entram na janela (na ordem dos destaques)
    const telasUsadas = [...new Set(p.itens.map(it => it.tela).filter(t => t !== 'celular'))];
    const ar0 = m0.w / m0.h;
    // captura com proporção diferente da primeira: aparece inteira (sem corte), centralizada
    const imgTela = k => { const m = manifesto[k]; const dif = Math.abs(m.w / m.h - ar0) / ar0 > .02;
      return img(k, { cls: dif ? 'encaixe' : '', attrs: ` data-k="${k}"` }); };
    const prova = opcional(p, 'prova'), obs = opcional(p, 'obs');
    return `<section class="scene launch" id="p-${p.id}" data-cena="${p.id}" data-lancamento style="--n:${p.itens.length}">
    <div class="stick">
      <div class="l-txt">
        <div class="l-num">${miniIndice(p)}${badge(p)}</div>
        <h3>${esc(p.nome)}</h3>
        <p class="l-frase">${h(`projetos.${p.id}.frase`, vp)}</p>
        <p class="l-res">${h(`projetos.${p.id}.resumo`, vp)}</p>
        <div class="l-listw"><i class="l-bar" aria-hidden="true"></i><ol class="l-list">${p.itens.map(it =>
          `<li data-tela="${it.tela}"><b>${h(`projetos.${p.id}.itens.${it.id}.titulo`, vp)}</b><span class="l-d"><span>${h(`projetos.${p.id}.itens.${it.id}.texto`, vp)}</span></span></li>`).join('')}</ol></div>
        ${prova ? `<p class="l-prova">${prova}</p>` : ''}
        <p class="l-meta">${stackDe(p).map(t => `<span>${esc(t)}</span>`).join(' · ')}${obs ? `<em>${obs}</em>` : ''}</p>
        <div class="l-cta">${botoes(p)}</div>
      </div>
      <div class="l-stage">
        <div class="l-rig${cel ? ' com-cel' : ''}" style="--ar:${ar0.toFixed(4)}">
          <div class="win"><div class="win-bar"><i><b></b></i><span class="win-url">${esc(urlBarra(p))}</span></div>
            <div class="win-scr" style="aspect-ratio:${m0.w} / ${m0.h}">${telasUsadas.map(imgTela).join('')}<i class="dim"></i></div>
          </div>
          ${cel ? `<div class="phone"><div class="ps">${img(p.celular, { tamanhos: '180px' })}</div></div>` : ''}
          <p class="l-cap">${p0(`projetos.legendas.${p.legenda}`)}</p>
        </div>
      </div>
    </div>
  </section>`;
  }).join('\n  ');

  /* ---------- cartões (projetos sem telas, ou com nivel "cartao") ---------- */
  const cartoesP = projetos.filter(p => p.nivel === 'cartao');
  const cartao = p => {
    const vp = varsP(p), obs = opcional(p, 'obs');
    let palco;
    if (p.telas.length) {
      const m0 = manifesto[p.telas[0]];
      palco = `<div class="c-rig${p.celular ? ' com-cel' : ''}">
        <div class="win"><div class="win-bar"><i><b></b></i><span class="win-url">${esc(urlBarra(p))}</span></div>
          <div class="win-scr" style="aspect-ratio:${m0.w} / ${m0.h}">${p.telas.map(k => img(k, { attrs: ` data-k="${k}"`, tamanhos: '(max-width: 760px) 86vw, 460px' })).join('')}</div>
        </div>
        ${p.celular ? `<div class="phone"><div class="ps">${img(p.celular, { tamanhos: '110px' })}</div></div>` : ''}
        ${p.telas.length > 1 ? `<div class="c-dots" aria-hidden="true">${p.telas.map(() => '<i><b></b></i>').join('')}</div>` : ''}
      </div>`;
    } else {
      palco = `<div class="fc" aria-hidden="true">
        <div class="fc-top"><span>${p0('projetos.cartoes.fichaRotulo')}</span><span>${pos(p)} / ${total}</span></div>
        <div class="fc-nome">${esc(p.nome)}</div>
        <div class="fc-url">${esc(host(p.codigo[0].url))}</div>
        <div class="fc-k">${p0('projetos.cartoes.fichaStack')}</div>
        <ul class="fc-stack">${stackDe(p).map(s => `<li><span>${esc(s)}</span></li>`).join('')}</ul>
      </div>`;
    }
    const grande = p.telas.length && p.celular;
    return `<article class="card${grande ? ' big' : ''}${p.telas.length ? '' : ' sem-tela'}" id="p-${p.id}" data-cartao>
      <div class="c-stage" data-rev>${palco}</div>
      <div class="c-txt" data-rev>
        <h3>${esc(p.nome)} ${badge(p)}</h3>
        <p class="c-frase">${h(`projetos.${p.id}.frase`, vp)}</p>
        <p>${h(`projetos.${p.id}.resumo`, vp)}</p>
        ${obs ? `<div class="obs">${obs}</div>` : ''}
        ${p.legenda ? `<div class="capt">${p0(`projetos.legendas.${p.legenda}`)}</div>` : ''}
        ${p.telas.length ? `<div class="chips">${stackDe(p).map(s => `<span>${esc(s)}</span>`).join('')}</div>` : '<div class="chips vazio"></div>'}
        <div class="l-cta">${botoes(p)}</div>
      </div>
    </article>`;
  };
  // com um cartão só, o título e o texto ficam no singular e o cartão ocupa a largura toda
  const umCartao = cartoesP.length === 1;
  const secaoCartoes = cartoesP.length ? `<section class="others wrap" id="outros" data-cena="cartoes">
    <p class="sec-k" data-rev>${p0('projetos.cartoes.secao')}</p>
    <h2 class="sec-t" data-rev>${h(umCartao ? 'projetos.cartoes.tituloUm' : 'projetos.cartoes.titulo', { n: String(cartoesP.length) })}</h2>
    <p class="sec-p" data-rev>${h(umCartao ? 'projetos.cartoes.textoUm' : 'projetos.cartoes.texto')}</p>
    <div class="grid-o${umCartao ? ' um' : ''}">
    ${cartoesP.map(cartao).join('\n    ')}
    </div>
  </section>` : '';

  /* ---------- habilidades ---------- */
  const nomeCol = id => projetos.find(p => p.id === id).nome;
  const totLinha = M.linhas.map(l => [...l.marcas].filter(c => c === '1').length);
  const totCol = M.colunas.map((_, c) => M.linhas.filter(l => l.marcas[c] === '1').length);
  const maxLinha = Math.max(...totLinha);
  const habilidades = `<section class="skills wrap" id="habilidades" data-cena="habilidades">
    <p class="sec-k" data-rev>${esc(T.habilidades.secao)}</p>
    <h2 class="sec-t" data-rev>${h('habilidades.titulo')}</h2>
    <p class="sec-p" data-rev>${h('habilidades.texto')}</p>
    <div class="sk-grid">
      <div class="mx-w">
        <table class="mx" id="mx">
          <thead><tr><th class="l" scope="col">${p0('habilidades.cabecalho')}</th>${M.colunas.map(c => `<th class="c" scope="col"><span>${esc(nomeCol(c))}</span></th>`).join('')}<th class="t" scope="col">${p0('habilidades.total')}</th></tr></thead>
          <tbody>${M.linhas.map((l, r) => `<tr${totLinha[r] === maxLinha ? ' class="top"' : ''}><th scope="row">${p0(`habilidades.linhas.${l.id}`)}</th>${[...l.marcas].map((c, k) => `<td>${c === '1' ? `<i role="img" aria-label="${esc(nomeCol(M.colunas[k]))}"></i>` : ''}</td>`).join('')}<td class="t">${totLinha[r]}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td>${p0('habilidades.porProjeto')}</td>${totCol.map(t => `<td class="n">${t}</td>`).join('')}<td></td></tr></tfoot>
        </table>
        <p class="mx-n">${h('habilidades.nota')}${fora.length ? ' ' + h('habilidades.notaFora') : ''}</p>
      </div>
      <div class="neg" data-rev>
        <h3>${p0('habilidades.negocioTitulo')}</h3>
        <ul>${dados.negocio.map(n => `<li>${p0(`habilidades.negocio.${n.id}`)}<span>${n.onde.map(o => esc(carreira.find(c => c.id === o).curto)).join(' · ')}</span></li>`).join('')}</ul>
      </div>
    </div>
  </section>`;

  /* ---------- formação ---------- */
  const formacao = `<section class="edu wrap" id="formacao" data-cena="formacao">
    <h2 class="sec-k" data-rev>${p0('formacao.secao')}</h2>
    <div class="edu-grid">
      <div class="edu-c" data-rev>
        <span class="k">${p0('formacao.superiorRotulo')}</span>
        <h3>${p0('formacao.curso')}</h3>
        <p>${p0('formacao.detalhe')}</p>
      </div>
      <div class="edu-c" data-rev id="langs">
        <span class="k">${p0('formacao.idiomasRotulo')}</span>
        ${dados.idiomasFalados.map(l => `<div class="lang" data-idioma="${l.codigo}"><span>${p0(`formacao.idiomas.${l.id}.nome`)}</span><span class="bar"><i style="--v:${l.barra}"></i></span><small>${p0(`formacao.idiomas.${l.id}.nivel`)}</small></div>`).join('\n        ')}
      </div>
    </div>
  </section>`;

  /* ---------- contato ---------- */
  const contato = `<footer class="contato" id="contato" data-cena="contato">
  <div class="ct-in">
    <div class="ct-top">
      <div>
        <p class="sec-k">${esc(T.contato.secao)}</p>
        <h2 class="ct-h">${h('contato.titulo')}</h2>
      </div>
      <div>
        <p class="ct-p">${h('contato.texto')}</p>
        <div class="ct-cta">
          <a class="btn solid" href="${cvHref}" target="_blank" rel="noopener">${esc(T.interface.baixarCv)} <span class="arr" aria-hidden="true">↓</span></a>
          <a class="btn ghost" href="mailto:${esc(I.email)}">${esc(I.email)}</a>
        </div>
      </div>
    </div>
    <div class="ct-grid">
      <div><h3>${p0('contato.quem')}</h3><p>${esc(I.nome)}<br>${p0('identidade.titulo')}</p></div>
      <div><h3>${p0('contato.disponibilidade')}</h3><p>${p0('identidade.disponibilidade')}<br>${esc(T.identidade.pais)} · ${esc(I.fuso)}</p></div>
      <div><h3>${p0('contato.contato')}</h3><ul>
        <li><a href="mailto:${esc(I.email)}">${esc(T.interface.email)}</a></li>
        <li><a href="${esc(I.linkedin)}"${novaAba}>${esc(T.interface.linkedin)} <span aria-hidden="true">↗</span></a></li>
        <li><a href="${esc(I.github)}"${novaAba}>${esc(T.interface.github)} <span aria-hidden="true">↗</span></a></li>
        <li><a href="${esc(I.whatsapp)}"${novaAba}>${esc(T.interface.whatsapp)} ${fone}</a></li>
        <li><a href="${cvHref}" target="_blank" rel="noopener">${p0('contato.cv')} <span aria-hidden="true">↓</span></a></li>
      </ul></div>
      <div><h3>${p0('contato.formacaoIdiomas')}</h3><p>${p0('formacao.cursoCurto')} — ${esc(dados.formacao.instituicao)}, ${esc(String(dados.formacao.conclusao))}<br>${dados.idiomasFalados.map(l => p0(`formacao.idiomas.${l.id}.curto`)).join(' · ')}</p></div>
    </div>
    <div class="ct-assina" id="assina">
      <img class="rubrica" src="${pref}${I.rubrica}" width="220" height="399" alt="${p0('identidade.rubricaAlt')}" loading="lazy" decoding="async">
      <span class="ct-nome">${esc(I.nome)}</span>
    </div>
    <div class="ct-foot"><span><b>${esc(I.marca)}</b> · ${esc(I.nome)}</span><span>${p0('contato.atualizado')}</span></div>
  </div>
</footer>`;

  /* ---------- currículo (só na impressão) ---------- */
  const urlSite = urlIdioma(idioma);
  const linkP = p => temDemoAtiva(p) ? p.demo.url : p.codigo[0].url;
  // sem demo e com mais de um repositório (ex.: UnifyData web + Python): todos os links, os seguintes abreviados
  const linksCv = p => temDemoAtiva(p) || p.codigo.length === 1
    ? `<a href="${esc(linkP(p))}">${esc(host(linkP(p)).replace(/[?#].*$/, '').replace(/\/$/, ''))}</a>`
    : p.codigo.map((c, k) => `<a href="${esc(c.url)}">${esc(k ? host(c.url).split('/').pop() : host(c.url))}</a>`).join(' · ');
  const cv = `<article class="cvp" aria-hidden="true">
  <header class="cvp-h">
    <h2>${esc(I.nome)}</h2>
    <p class="cvp-t">${p0('identidade.titulo')}</p>
    <p class="cvp-c"><a href="mailto:${esc(I.email)}">${esc(I.email)}</a> · <a href="${esc(I.whatsapp)}">${fone}</a> · <a href="${esc(I.linkedin)}">${esc(host(I.linkedin))}</a> · <a href="${esc(I.github)}">${esc(host(I.github))}</a></p>
    <p class="cvp-c">${p0('cv.site')}: <a href="${esc(urlSite)}">${esc(host(urlSite))}</a> · ${p0('identidade.disponibilidade')} · ${esc(T.identidade.pais)}, ${esc(I.fuso)}</p>
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
      <div><h4>${esc(c.empresa)} <span>· ${p0(`carreira.${c.id}.tipo`)}</span></h4>
        <p class="cvp-r">${p0(`carreira.${c.id}.cargo`)}${T.carreira[c.id].cargoFormal ? ` <span>(${p0(`carreira.${c.id}.cargoFormal`)})</span>` : ''}</p>
        <ul>${T.carreira[c.id].itens.map((_, k) => `<li>${p0(`carreira.${c.id}.itens.${k}`)}</li>`).join('')}</ul></div>
    </div>`).join('\n    ')}
  </section>
  <section class="cvp-s">
    <h3>${p0('cv.projetosTitulo')}</h3>
    ${projetos.map(p => `<div class="cvp-p">
      <h4>${esc(p.nome)} <span class="cvp-st">${esc(T.interface.status[statusDe(p)])}</span> ${linksCv(p)}</h4>
      <p>${p0(`projetos.${p.id}.cv`, varsP(p))} <span class="cvp-sk">${stackDe(p).map(esc).join(' · ')}</span></p>
    </div>`).join('\n    ')}
  </section>
  <section class="cvp-s">
    <h3>${p0('cv.habilidadesTitulo')}</h3>
    <p><b>${p0('cv.tecnologias')}:</b> ${M.linhas.map(l => p0(`habilidades.linhas.${l.id}`)).join(' · ')}</p>
    <p><b>${p0('cv.negocio')}:</b> ${dados.negocio.map(n => p0(`habilidades.negocio.${n.id}`)).join(' · ')}</p>
  </section>
  <section class="cvp-s">
    <h3>${p0('cv.formacaoTitulo')}</h3>
    <p><b>${p0('formacao.curso')}</b> — ${p0('formacao.detalhe')}</p>
    <p>${dados.idiomasFalados.map(l => `<b>${p0(`formacao.idiomas.${l.id}.nome`)}</b> — ${p0(`formacao.idiomas.${l.id}.nivel`)}`).join(' · ')}</p>
  </section>
  <footer class="cvp-assina">
    <img src="${pref}${I.rubrica}" width="220" height="399" alt="${p0('identidade.rubricaAlt')}">
    <span>${esc(I.marca)} · ${esc(I.nome)}</span>
  </footer>
</article>`;

  /* ---------- dados para os efeitos (main.js) ---------- */
  const dadosJs = {
    fases: carreira.map(c => ({ id: c.id, inicio: c.inicio, fim: c.fim, cor: c.cor })),
    iniciais: T.trajetoria.figura.iniciaisMeses,
    mes: F.mes, meses: F.meses
  };

  /* ---------- <head> ---------- */
  const og = `assets/img/og-${cod}.png`;
  const ogUrl = existsSync(path.join(raiz, og)) ? abs(og) : abs(`assets/img/og-${padrao}.png`);
  const titulo = p0('meta.titulo'), descricao = p0('meta.descricao');
  const pessoa = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: I.nome,
    jobTitle: limpar(T.identidade.titulo),
    description: limpar(txt('meta.descricao')),
    url: urlSite,
    email: 'mailto:' + I.email,
    image: ogUrl,
    sameAs: [I.linkedin, I.github],
    address: { '@type': 'PostalAddress', addressCountry: 'BR' },
    worksFor: { '@type': 'Organization', name: carreira[carreira.length - 1].empresa },
    alumniOf: { '@type': 'CollegeOrUniversity', name: dados.formacao.instituicao },
    knowsLanguage: dados.idiomasFalados.map(l => ({ '@type': 'Language', name: limpar(txt(`formacao.idiomas.${l.id}.nome`)), alternateName: l.codigo, description: limpar(txt(`formacao.idiomas.${l.id}.nivel`)) }))
  };
  const idiomaPadrao = dados.site.idiomas.find(i => i.codigo === padrao);
  const cabeca = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<meta name="description" content="${descricao}">
<link rel="canonical" href="${esc(urlSite)}">
${idiomasLinks.map(i => `<link rel="alternate" hreflang="${i.hreflang}" href="${esc(urlIdioma(i))}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${esc(urlIdioma(idiomaPadrao))}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="${esc(I.nome)}">
<meta property="og:title" content="${p0('meta.ogTitulo')}">
<meta property="og:description" content="${p0('meta.ogDescricao')}">
<meta property="og:url" content="${esc(urlSite)}">
<meta property="og:image" content="${esc(ogUrl)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${p0('meta.ogDescricao')}">
<meta property="og:locale" content="${idioma.ogLocale}">
${idiomasLinks.filter(i => i !== idioma).map(i => `<meta property="og:locale:alternate" content="${i.ogLocale}">`).join('\n')}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${p0('meta.ogTitulo')}">
<meta name="twitter:description" content="${p0('meta.ogDescricao')}">
<meta name="twitter:image" content="${esc(ogUrl)}">
<meta name="theme-color" content="${dados.site.corTema}">
<link rel="icon" href="${pref}favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&amp;family=Instrument+Sans:wght@400..700&amp;family=IBM+Plex+Mono:wght@400;500&amp;display=swap">
<link rel="stylesheet" href="${pref}assets/css/style.css?v=${hash('assets/css/style.css')}">
<script>document.documentElement.classList.add('js')</script>
<script src="${pref}assets/js/main.js?v=${hash('assets/js/main.js')}" defer></script>
<script type="application/ld+json">${JSON.stringify(pessoa).replace(/</g, '\\u003c')}</script>`;

  return `<!doctype html>
<html lang="${idioma.lang}">
<head>
${cabeca}
</head>
<body>
<a class="skip" href="#conteudo">${esc(T.interface.pularParaConteudo)}</a>
${cabecalho}

<main id="conteudo">
  ${abertura}

  ${trajetoria}

  ${introProjetos}
  ${lancamentos}

  ${secaoCartoes}

  ${habilidades}

  ${formacao}
</main>

${contato}

${cv}

<script type="application/json" id="dados-cena">${JSON.stringify(dadosJs).replace(/</g, '\\u003c')}</script>
</body>
</html>
`;
}

/* ─────────────────────────── 6. Modelo da imagem de compartilhamento ─────────────────────────── */

function gerarOg(idioma) {
  const cod = idioma.codigo, T = textos[cod];
  const V = { ...calc };
  const tese = marcar(T.identidade.tese, { em: 'sis' });
  // grade simplificada: cada mês de carreira, colorido por empresa
  const fases = carreira.map(c => ({ a: mesIdx(...c.inicio), b: c.fim ? mesIdx(...c.fim) : HOJE, cor: c.cor }));
  let cel = '';
  for (let y = inicioCarreira[0]; y <= Math.floor(HOJE / 12); y++)
    for (let m = 1; m <= 12; m++) {
      const i = mesIdx(y, m), fs = fases.filter(f => i >= f.a && i <= f.b);
      cel += i > HOJE ? '<i class="f"></i>' : fs.length ? `<i style="background:${fs[fs.length - 1].cor}"></i>` : '<i class="p"></i>';
    }
  return `<!doctype html>
<html lang="${idioma.lang}"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&amp;family=Instrument+Sans:wght@400..700&amp;family=IBM+Plex+Mono:wght@400;500&amp;display=swap">
<style>
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#F3EFE6;color:#15140F}
body{font-family:'Newsreader',Georgia,serif;position:relative}
.m{position:absolute;inset:44px 56px 104px;display:grid;grid-template-columns:1fr 330px;gap:56px}
.top{grid-column:1/-1;display:flex;justify-content:space-between;border-bottom:1.5px solid #15140F;padding-bottom:12px;font:500 15px/1 'IBM Plex Mono',monospace;letter-spacing:.12em;text-transform:uppercase;color:#4F4B42}
h1{margin:0;font-weight:450;font-size:96px;line-height:.95;letter-spacing:-.04em}
p{margin:26px 0 0;font-size:40px;line-height:1.14;letter-spacing:-.015em;max-width:15em}
.strike{color:#6B6558;-webkit-box-decoration-break:clone;box-decoration-break:clone;background:linear-gradient(178deg,transparent calc(56% - .045em),#15140F calc(56% - .045em),#15140F calc(56% + .03em),transparent calc(56% + .03em))}
.sis{font-style:italic;color:#2B3BEA;background:linear-gradient(transparent 62%,#F2DC5D 62%,#F2DC5D 92%,transparent 92%)}
.r{align-self:end}
.g{display:grid;grid-template-columns:repeat(12,1fr);gap:4px;width:280px;margin-left:auto}
.g i{aspect-ratio:1;border-radius:3px;background:#E6DFD1}.g i.f{background:transparent;box-shadow:inset 0 0 0 1px rgba(135,129,115,.45)}
.k{text-align:right;font:500 13px/1.4 'IBM Plex Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:#2B3BEA;margin-bottom:12px}
.pe{position:absolute;left:56px;right:56px;bottom:40px;display:flex;justify-content:space-between;font:500 18px/1 'Instrument Sans',sans-serif;color:#4F4B42}
.pe b{color:#15140F}
</style></head><body>
<div class="m">
  <div class="top"><span>${esc(limpar(T.identidade.titulo))}</span><span>${esc(preencher(T.abertura.ficha.periodo, V, 'og'))}</span></div>
  <div><h1>${esc(dados.identidade.nome)}</h1><p>${tese}</p></div>
  <div class="r"><div class="k">${esc(limpar(T.trajetoria.figura.titulo))}</div><div class="g">${cel}</div></div>
</div>
<div class="pe"><span><b>${esc(limpar(T.identidade.disponibilidade))}</b></span><span>${esc(host(dados.site.baseUrl + idioma.pasta))}</span></div>
</body></html>`;
}

/* ─────────────────────────── 7. robots.txt, sitemap.xml e 404.html (a partir do baseUrl) ─────────────────────────── */

function gerarExtras() {
  const base = dados.site.baseUrl;
  const caminho = new URL(base).pathname;             // ex.: /portfolio/ — a 404 é servida em qualquer profundidade
  const idiomaPadrao = dados.site.idiomas.find(i => i.codigo === padrao);
  const alternativas = [...idiomasLinks.map(i => [i.hreflang, base + i.pasta]), ['x-default', base + idiomaPadrao.pasta]];
  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${base}sitemap.xml\n`;
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${idiomasLinks.map(i => `  <url>
    <loc>${esc(base + i.pasta)}</loc>
${alternativas.map(([h, u]) => `    <xhtml:link rel="alternate" hreflang="${h}" href="${esc(u)}"/>`).join('\n')}
  </url>`).join('\n')}
</urlset>
`;
  const blocos = idiomasLinks.map(i => {
    const T = textosTodos[i.codigo];
    return `<section lang="${i.lang}"><h2>${esc(T.erro404.titulo)}</h2><p>${esc(T.erro404.texto)}</p><a href="${esc(caminho + i.pasta)}">${esc(T.erro404.link)} <span aria-hidden="true">→</span></a></section>`;
  }).join('\n    ');
  const pagina404 = `<!doctype html>
<html lang="${idiomaPadrao.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>404 · ${esc(dados.identidade.nome)}</title>
<link rel="icon" href="${esc(caminho)}favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&amp;family=Instrument+Sans:wght@400..700&amp;family=IBM+Plex+Mono:wght@400;500&amp;display=swap">
<style>
*{box-sizing:border-box}
html,body{margin:0;background:#F3EFE6;color:#15140F}
body{min-height:100vh;display:flex;flex-direction:column;font-family:'Newsreader',Georgia,serif}
header{display:flex;align-items:center;height:58px;padding:0 max(16px,calc((100vw - 1100px) / 2 + max(16px,4vw)));border-bottom:1px solid #15140F}
header a{font-weight:600;font-size:21px;text-decoration:none;color:inherit}
main{flex:1;width:100%;max-width:1100px;margin:0 auto;padding:clamp(40px,10vh,110px) max(16px,4vw) 60px}
.k{font:500 12px/1 'IBM Plex Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:#2B3BEA;margin:0 0 34px}
h1{margin:0;font-weight:300;font-size:clamp(5rem,18vw,11rem);line-height:.85;letter-spacing:-.05em}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:28px;margin-top:48px}
section{border-top:2px solid #15140F;padding-top:16px}
h2{margin:0 0 8px;font-weight:500;font-size:26px;letter-spacing:-.02em}
p{margin:0 0 16px;font:15px/1.5 'Instrument Sans','Segoe UI',sans-serif;color:#4F4B42}
section a{font:600 14px/1 'Instrument Sans','Segoe UI',sans-serif;color:#15140F;text-decoration:none;border-bottom:1px solid #15140F;padding-bottom:3px}
section a:hover{color:#2B3BEA;border-color:#2B3BEA}
:focus-visible{outline:2px solid #2B3BEA;outline-offset:3px}
</style>
</head>
<body>
<header><a href="${esc(caminho)}">${esc(dados.identidade.nome)}</a></header>
<main>
  <p class="k">${esc(dados.identidade.marca)} · ${esc(dados.identidade.nome)}</p>
  <h1>404</h1>
  <div class="grid">
    ${blocos}
  </div>
</main>
</body>
</html>
`;
  return { 'robots.txt': robots, 'sitemap.xml': sitemap, '404.html': pagina404 };
}

/* ─────────────────────────── 8. Gravação ─────────────────────────── */

for (const idioma of idiomasAtivos) {
  const destino = path.join(raiz, idioma.pasta, 'index.html');
  mkdirSync(path.dirname(destino), { recursive: true });
  writeFileSync(destino, gerarPagina(idioma));
  console.log(`✔ ${path.relative(raiz, destino).split(path.sep).join('/')}  (${idioma.lang})`);
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
console.log(`Projetos: ${projetos.length} · demos ativas: ${calc.demosAtivas} · lançamentos: ${projetos.filter(p => p.nivel === 'lancamento').map(p => p.nome).join(', ')}`);
if (inativos.length) console.log(`Idiomas sem textos (não gerados): ${inativos.join(', ')}`);
if (mantidos.length) console.log(`Não gerados nesta execução (as páginas existentes ficaram como estavam): ${mantidos.join(', ')}`);
for (const i of idiomasAtivos) if (!existsSync(path.join(raiz, `assets/img/og-${i.codigo}.png`)))
  console.log(`Aviso: falta assets/img/og-${i.codigo}.png (gere com scripts/gerar-cv.ps1)`);
