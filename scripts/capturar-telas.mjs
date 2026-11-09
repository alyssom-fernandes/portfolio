// Capturas de tela dos projetos do portfólio, direto das demos ao vivo.
//
// O script abre o Microsoft Edge escondido (headless), com um perfil novo e descartável na pasta
// temporária do Windows, navega pelas demos seguindo fonte/capturas.json e tira um PNG de cada tela.
// Não depende de nada além do Node 24 e do sharp que já está no projeto: conversa com o Edge pelo
// protocolo de depuração (Chrome DevTools Protocol) usando o WebSocket e o fetch do próprio Node.
//
// ─── COMO RODAR (na pasta do projeto) ─────────────────────────────────────────────────────────────
//
//   node scripts/capturar-telas.mjs                     ensaio de todos os projetos ativos
//   node scripts/capturar-telas.mjs fuelmind praxis     ensaio só desses projetos
//   node scripts/capturar-telas.mjs fuelmind/dashboard  ensaio de uma tela só
//   node scripts/capturar-telas.mjs --saida C:\capturas ensaio salvando os PNGs nessa pasta
//   node scripts/capturar-telas.mjs fuelmind --gravar   captura E atualiza o site
//   node scripts/capturar-telas.mjs praxis --visivel    mostra a janela do Edge (para ver o que acontece)
//
//   ENSAIO (padrão): os PNGs vão para uma pasta nova em %TEMP% (ou a de --saida) e o site não é
//   tocado. Abra os PNGs, confira e, se estiverem bons, rode de novo com --gravar.
//
//   --gravar: cada PNG é convertido em WebP (scripts/converter-imagens.mjs) e salvo em
//   assets/projetos/<projeto>/<tela>.webp, substituindo a imagem anterior, e o
//   assets/projetos/manifesto.json é atualizado. Depois é só regenerar o site.
//
//   Projetos com "ativo": false são pulados, a não ser que você peça pelo nome
//   (ex.: node scripts/capturar-telas.mjs docke). Se uma demo estiver fora do ar, o script avisa
//   e segue para o próximo projeto; se uma tela passar do tempo limite, avisa e segue para a próxima.
//   No fim mostra um resumo e sai com código 1 se alguma tela falhou.
//
// ─── COMO ADICIONAR UM PROJETO OU UMA TELA (fonte/capturas.json) ───────────────────────────────────
//
//   {
//     "padroes": { "esperaMs": 1500, "tempoLimiteMs": 45000 },
//     "projetos": [
//       {
//         "id": "fuelmind",                          ← pasta em assets/projetos/ (mesmo id do site)
//         "nome": "Fuel Mind",
//         "ativo": true,                             ← false = só roda se for pedido pelo nome
//         "url": "https://controle-entradas-posto.web.app/",
//         "entrada": [                               ← passos para entrar na demo (opcional)
//           { "clicar": "Acessar modo demo" },
//           { "esperar": "#painel" }
//         ],
//         "telas": [
//           {
//             "nome": "dashboard",                   ← vira assets/projetos/fuelmind/dashboard.webp
//             "rota": "#/dashboard",                 ← relativa à url do projeto (ou "url": "https://...")
//             "passos": [ { "clicar": "Relatórios" } ],
//             "esperar": ".grafico",                 ← seletor CSS que precisa aparecer antes da foto
//             "esperaMs": 2000,                      ← pausa extra antes da foto (animações, gráficos)
//             "rolar": { "ate": "#alertas" },        ← opcional; ou { "y": 600 } ou { "y": 600, "em": ".lista" }
//             "dispositivo": "tela"                  ← "tela" (1440×900) ou "celular" (390×844, 2×)
//           }
//         ]
//       }
//     ]
//   }
//
//   Passos aceitos (em "entrada" e em "passos"), um por objeto:
//     { "clicar": "Texto visível" }            clica no elemento com esse texto (botão, link, aba, menu)
//     { "clicar": "Texto", "exato": false }    aceita texto que apenas contenha o trecho
//     { "clicarSeletor": "css" }               clica no primeiro elemento visível que casa com o seletor
//     { "esperar": "css" }                     espera o seletor aparecer
//     { "esperarTexto": "Texto" }              espera o texto aparecer na página
//     { "esperarSumir": "css" }                espera o seletor sumir da tela (ex.: um aviso temporário)
//     { "esperarUrlSem": "/login" }            espera o endereço deixar de conter o trecho (saiu da tela de login)
//     { "aguardar": 1000 }                     pausa em milissegundos
//     { "tecla": "Escape" }                    pressiona uma tecla (só Escape, para fechar menus/avisos)
//     { "folhaImpressa": { "largura": "210mm", "margem": "14mm 12mm", "zoom": 1.3 } }
//                                              mostra a versão de impressão da página (mídia "print") como uma
//                                              folha branca centralizada, igual à prévia de um PDF. Não clica em
//                                              nada nem abre a janela de impressão. Use na última tela da aba (ou
//                                              "entrarDeNovo" na tela seguinte), porque a aba continua em modo impressão.
//   "entradaSempre": true no projeto repete a entrada antes de cada tela (demos que não guardam sessão).
//   "entrarDeNovo": true numa tela abre uma aba limpa e refaz a entrada só para ela (útil no celular,
//   para a demo já carregar no layout de celular).
//   O nome da tela precisa ser o mesmo usado no site (chave "projeto/tela" do manifesto).
//   "observacao" (no projeto ou na tela) é só uma anotação para você; o script ignora.
//
// ─── O QUE O SCRIPT NUNCA FAZ ─────────────────────────────────────────────────────────────────────
//
//   Não digita em campos, não faz login com usuário e senha, não envia formulário e não clica em
//   ações que alteram dados. Só abre telas, abas, menus e os botões de entrar em modo demonstração.
//   Por segurança, ele se recusa a clicar em qualquer elemento cujo texto pareça uma ação de escrita
//   (salvar, excluir, aprovar, restaurar, enviar, entrar com senha...), mesmo que o capturas.json peça.
//   O Edge usado é um perfil novo em %TEMP%: não mexe no Edge que você usa, não vê suas senhas nem
//   seus cookies. No fim, fecha só o Edge que ele mesmo abriu e apaga o perfil temporário.

import { spawn, execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registrar } from './converter-imagens.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(raiz, 'fonte', 'capturas.json');

const EDGE_PADRAO = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

export const DISPOSITIVOS = {
  tela: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
  celular: { width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
};
const UA_CELULAR =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/130.0.0.0 Mobile Safari/537.36 EdgA/130.0.0.0';

// Textos de botões que alteram dados ou pedem credenciais: o script nunca clica neles.
// "Acessar modo demo", "Entrar na demo" e afins continuam permitidos.
const PROIBIDOS = [
  /\bsalvar\b/i, /\bexcluir\b/i, /\bapagar\b/i, /\bdeletar\b/i, /\bremover\b/i,
  /\brestaurar\b/i, /\bresetar\b/i, /\bredefinir\b/i, /\blimpar\b/i,
  /\baprovar\b/i, /\breprovar\b/i, /\brejeitar\b/i, /\bconfirmar\b/i, /\bcancelar pedido\b/i,
  /\benviar\b/i, /\bsubmeter\b/i, /\bcadastrar\b/i, /\bcriar\b/i, /^\s*\+?\s*nov[oa]\b/i,
  /\bimportar\b/i, /\bduplicar\b/i, /\beditar\b/i, /\bpagar\b/i, /\bregistrar\b/i,
  /\bsair\b/i, /\blogout\b/i, /\bsenha\b/i, /\bsign ?in\b/i, /\blog ?in\b/i,
  /^\s*entrar\s*$/i, /\bcriar conta\b/i,
];
const PERMITIDOS = [/modo demo/i, /\bdemonstra/i, /\bdemo\b/i];

function textoProibido(texto) {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (PERMITIDOS.some(r => r.test(t)) && !/restaurar|resetar|sair/i.test(t)) return false;
  return PROIBIDOS.some(r => r.test(t));
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

// ─── Edge ─────────────────────────────────────────────────────────────────────────────────────────

export async function abrirEdge({ visivel = false } = {}) {
  const exe = process.env.EDGE_PATH || EDGE_PADRAO.find(p => existsSync(p));
  if (!exe) throw new Error('Microsoft Edge não encontrado. Defina a variável EDGE_PATH com o caminho do msedge.exe.');

  const perfil = await mkdtemp(path.join(os.tmpdir(), 'portfolio-capturas-perfil-'));
  const args = [
    visivel ? null : '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-sync', '--disable-features=msEdgeSidebarV2,msUndersideButton,Translate',
    '--hide-scrollbars', '--mute-audio', '--window-size=1440,900',
    'about:blank',
  ].filter(Boolean);
  const proc = spawn(exe, args, { stdio: 'ignore', windowsHide: true });
  const pid = proc.pid;
  proc.on('error', () => {});

  // O Edge escreve a porta escolhida em <perfil>/DevToolsActivePort.
  const arquivoPorta = path.join(perfil, 'DevToolsActivePort');
  let porta;
  for (let i = 0; i < 150 && !porta; i++) {
    try {
      const [linha] = (await readFile(arquivoPorta, 'utf8')).split(/\r?\n/);
      if (/^\d+$/.test(linha)) porta = Number(linha);
    } catch {}
    if (!porta) await esperar(100);
  }
  const edge = { pid, perfil, porta };
  if (!porta) {
    await fecharEdge(edge);
    throw new Error('O Edge não abriu a porta de depuração em 15 s.');
  }
  const versao = await (await fetch(`http://127.0.0.1:${porta}/json/version`)).json();
  edge.cdp = await Conexao.abrir(versao.webSocketDebuggerUrl);
  edge.userAgent = versao['User-Agent'].replace(/Headless/g, '');
  return edge;
}

export async function fecharEdge(edge) {
  if (!edge) return;
  try { await edge.cdp?.enviar('Browser.close'); } catch {}
  edge.cdp?.fechar();
  await esperar(500);
  // Encerra somente a árvore do processo que este script abriu (nunca por nome).
  if (edge.pid) {
    await new Promise(r => execFile('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { windowsHide: true }, () => r()));
  }
  // Processos filhos do Edge ainda podem gravar no perfil por alguns instantes: tenta até sumir.
  for (let i = 0; i < 20; i++) {
    try { await rm(edge.perfil, { recursive: true, force: true }); } catch {}
    await esperar(500);
    if (!existsSync(edge.perfil)) return;
  }
  console.warn(`  aviso: não consegui apagar o perfil temporário ${edge.perfil}`);
}

// ─── Conexão CDP (WebSocket nativo do Node) ───────────────────────────────────────────────────────

class Conexao {
  static abrir(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const c = new Conexao(ws);
      ws.addEventListener('open', () => resolve(c), { once: true });
      ws.addEventListener('error', () => reject(new Error('Falha ao conectar no Edge pelo WebSocket.')), { once: true });
    });
  }
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pendentes = new Map();
    this.ouvintes = new Set();
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pendentes.has(msg.id)) {
        const { resolve, reject, metodo } = this.pendentes.get(msg.id);
        this.pendentes.delete(msg.id);
        msg.error ? reject(new Error(`${metodo}: ${msg.error.message}`)) : resolve(msg.result);
      } else if (msg.method) {
        for (const f of this.ouvintes) f(msg);
      }
    });
    ws.addEventListener('close', () => {
      for (const { reject } of this.pendentes.values()) reject(new Error('Conexão com o Edge fechada.'));
      this.pendentes.clear();
    });
  }
  enviar(metodo, params = {}, sessionId) {
    const id = ++this.id;
    const msg = { id, method: metodo, params };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pendentes.set(id, { resolve, reject, metodo });
      this.ws.send(JSON.stringify(msg));
    });
  }
  fechar() { try { this.ws.close(); } catch {} }
}

// Uma aba num contexto isolado (cookies e armazenamento próprios, como uma janela anônima).
export class Aba {
  static async abrir(edge) {
    const { browserContextId } = await edge.cdp.enviar('Target.createBrowserContext', { disposeOnDetach: true });
    const { targetId } = await edge.cdp.enviar('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await edge.cdp.enviar('Target.attachToTarget', { targetId, flatten: true });
    const aba = new Aba(edge, sessionId, targetId, browserContextId);
    await aba.cmd('Page.enable');
    await aba.cmd('Runtime.enable');
    await aba.cmd('Page.setLifecycleEventsEnabled', { enabled: true });
    return aba;
  }
  constructor(edge, sessionId, targetId, contexto) {
    Object.assign(this, { edge, sessionId, targetId, contexto });
    this.dispositivo = null;
  }
  cmd(metodo, params) { return this.edge.cdp.enviar(metodo, params, this.sessionId); }

  async fechar() {
    try { await this.edge.cdp.enviar('Target.closeTarget', { targetId: this.targetId }); } catch {}
    try { await this.edge.cdp.enviar('Target.disposeBrowserContext', { browserContextId: this.contexto }); } catch {}
  }

  // Retorna true se o dispositivo mudou (a página precisa ser recarregada para o site perceber).
  async usarDispositivo(nome) {
    const d = DISPOSITIVOS[nome];
    if (!d) throw new Error(`Dispositivo desconhecido: "${nome}" (use "tela" ou "celular").`);
    if (this.dispositivo === nome) return false;
    await this.cmd('Emulation.setDeviceMetricsOverride', { ...d, screenWidth: d.width, screenHeight: d.height });
    await this.cmd('Emulation.setTouchEmulationEnabled', d.mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
    await this.cmd('Emulation.setEmitTouchEventsForMouse', { enabled: d.mobile, configuration: d.mobile ? 'mobile' : 'desktop' });
    await this.cmd('Network.setUserAgentOverride', {
      userAgent: d.mobile ? UA_CELULAR : this.edge.userAgent,
      platform: d.mobile ? 'Android' : 'Win32',
      userAgentMetadata: d.mobile
        ? { platform: 'Android', platformVersion: '14', architecture: '', model: 'Pixel 8', mobile: true,
            brands: [{ brand: 'Chromium', version: '130' }] }
        : undefined,
    });
    const mudou = this.dispositivo !== null;
    this.dispositivo = nome;
    return mudou;
  }

  async avaliar(expr) {
    const r = await this.cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }

  async navegar(url, tempoLimite) {
    const carregou = this.esperarEvento('Page.loadEventFired', tempoLimite);
    const r = await this.cmd('Page.navigate', { url });
    if (r.errorText) throw new ErroDemo(`não abriu ${url} (${r.errorText})`);
    if (r.loaderId) await carregou; // navegação só de âncora (#rota) não dispara load
    await this.esperarPronto(tempoLimite);
  }

  async recarregar(tempoLimite) {
    const carregou = this.esperarEvento('Page.loadEventFired', tempoLimite);
    await this.cmd('Page.reload', { ignoreCache: false });
    await carregou;
    await this.esperarPronto(tempoLimite);
  }

  esperarEvento(metodo, tempoLimite) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { this.edge.cdp.ouvintes.delete(f); reject(new Error(`tempo limite esperando ${metodo}`)); }, tempoLimite);
      const f = msg => {
        if (msg.method === metodo && msg.sessionId === this.sessionId) {
          clearTimeout(t); this.edge.cdp.ouvintes.delete(f); resolve(msg.params);
        }
      };
      this.edge.cdp.ouvintes.add(f);
    });
  }

  async esperarPronto(tempoLimite) {
    await this.esperarCondicao(`document.readyState === 'complete'`, tempoLimite, 'a página terminar de carregar');
    await this.avaliar(`document.fonts ? document.fonts.ready.then(() => true) : true`).catch(() => {});
  }

  async esperarCondicao(expr, tempoLimite, descricao) {
    const fim = Date.now() + tempoLimite;
    while (Date.now() < fim) {
      try { if (await this.avaliar(`(() => { try { return !!(${expr}); } catch { return false; } })()`)) return; } catch {}
      await esperar(250);
    }
    throw new Error(`tempo limite esperando ${descricao}`);
  }

  esperarSeletor(sel, tempoLimite) {
    return this.esperarCondicao(`(() => { const e = document.querySelector(${JSON.stringify(sel)});
      if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })()`,
      tempoLimite, `o seletor ${sel}`);
  }

  esperarSumir(sel, tempoLimite) {
    return this.esperarCondicao(`![...document.querySelectorAll(${JSON.stringify(sel)})].some(e => {
      const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; })`,
      tempoLimite, `o seletor ${sel} sumir`);
  }

  esperarUrlSem(trecho, tempoLimite) {
    return this.esperarCondicao(`!location.href.includes(${JSON.stringify(trecho)})`, tempoLimite, `sair de ${trecho}`);
  }

  // Linhas da página que parecem mensagem de erro (para explicar por que a demo não abriu).
  async avisosDaPagina() {
    return this.avaliar(`(document.body?.innerText || '').split(/\\n/).map(l => l.trim())
      .filter(l => /indispon|fora do ar|erro|falha|unavailable|error|tente novamente/i.test(l)).slice(0, 3)`).catch(() => []);
  }

  esperarTexto(texto, tempoLimite) {
    return this.esperarCondicao(`document.body && document.body.innerText.includes(${JSON.stringify(texto)})`,
      tempoLimite, `o texto "${texto}"`);
  }

  // Procura o elemento clicável e devolve { texto } ou null; o clique acontece dentro da página.
  async clicar({ texto, seletor, exato = true }, tempoLimite) {
    const busca = `(() => {
      const visivel = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
      const norm = t => (t || '').replace(/\\s+/g, ' ').trim();
      let alvo = null;
      const seletor = ${JSON.stringify(seletor ?? null)}, texto = ${JSON.stringify(texto ?? null)}, exato = ${exato};
      if (seletor) alvo = [...document.querySelectorAll(seletor)].find(visivel) || null;
      else {
        const casa = e => { const t = norm(e.innerText || e.textContent || e.getAttribute('aria-label') || e.title);
          return exato ? t === texto : t.includes(texto); };
        const clicaveis = 'button, a, [role=button], [role=tab], [role=menuitem], [role=link], [onclick], summary, label, li, [tabindex]';
        // entre os clicáveis que casam, fica o mais interno (evita pegar o diálogo inteiro)
        const cands = [...document.querySelectorAll(clicaveis)].filter(e => visivel(e) && casa(e));
        alvo = cands.find(e => !cands.some(o => o !== e && e.contains(o))) || null;
        if (!alvo) {
          // qualquer elemento visível com o texto; sobe até o ancestral clicável mais próximo
          const todos = [...document.querySelectorAll('body *')].filter(e => visivel(e) && casa(e));
          const folha = todos.find(e => ![...e.children].some(f => todos.includes(f)));
          alvo = folha ? (folha.closest(clicaveis) || folha) : null;
        }
      }
      if (!alvo) return null;
      const rotulo = norm(alvo.innerText || alvo.textContent || alvo.getAttribute('aria-label') || alvo.title).slice(0, 80);
      const tipo = (alvo.getAttribute('type') || '').toLowerCase();
      if (tipo === 'submit' || (alvo.tagName === 'BUTTON' && alvo.form && tipo !== 'button'))
        return { rotulo, bloqueado: 'botão de enviar formulário' };
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) || alvo.isContentEditable)
        return { rotulo, bloqueado: 'campo de digitação' };
      return { rotulo, alvoOk: true };
    })()`;
    const fim = Date.now() + tempoLimite;
    let achado = null;
    while (Date.now() < fim && !achado) {
      achado = await this.avaliar(busca).catch(() => null);
      if (!achado) await esperar(300);
    }
    const nome = seletor ? `seletor ${seletor}` : `"${texto}"`;
    if (!achado) throw new Error(`não achei ${nome} para clicar`);
    if (achado.bloqueado) throw new Error(`recusei clicar em ${nome}: ${achado.bloqueado}`);
    if (textoProibido(achado.rotulo) || textoProibido(texto))
      throw new Error(`recusei clicar em ${nome} ("${achado.rotulo}"): parece uma ação que altera dados`);
    // Repete a busca e clica de fato (o elemento pode ter sido recriado nesse meio-tempo).
    const ok = await this.avaliar(busca.replace(`return { rotulo, alvoOk: true };`,
      `const r = alvo.getBoundingClientRect();
       if (r.top < 0 || r.bottom > innerHeight) alvo.scrollIntoView({ block: 'center', inline: 'nearest' });
       alvo.click(); return { rotulo, alvoOk: true };`));
    if (!ok?.alvoOk) throw new Error(`não consegui clicar em ${nome}`);
    return ok.rotulo;
  }

  // Versão de impressão da página, desenhada como uma folha sobre fundo cinza (prévia de PDF).
  async folhaImpressa({ largura = '210mm', margem = '14mm 12mm', zoom = 1, fundo = '#3b3d42' } = {}) {
    await this.cmd('Emulation.setEmulatedMedia', { media: 'print' });
    // Estilos aplicados pelo CSSOM (element.style), que a política de segurança (CSP) das demos não bloqueia.
    const estilos = {
      html: { background: fundo },
      body: { 'box-sizing': 'border-box', width: largura, 'max-width': 'none', 'min-height': '297mm',
        margin: '28px auto', padding: margem, background: '#fff', 'box-shadow': '0 6px 30px rgba(0,0,0,.45)',
        zoom: String(Number(zoom) || 1) },
    };
    await this.avaliar(`(() => { const e = ${JSON.stringify(estilos)};
      for (const [alvo, props] of Object.entries(e)) {
        const el = alvo === 'html' ? document.documentElement : document.body;
        for (const [p, v] of Object.entries(props)) el.style.setProperty(p, v, 'important');
      }
      window.scrollTo(0, 0); return true; })()`);
    await esperar(600);
  }

  async tecla(nome) {
    if (nome !== 'Escape') throw new Error(`tecla "${nome}" não permitida (só Escape)`);
    for (const type of ['keyDown', 'keyUp'])
      await this.cmd('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  }

  async rolar(rolagem) {
    if (!rolagem) return;
    if (rolagem.ate) {
      await this.avaliar(`(() => { const e = document.querySelector(${JSON.stringify(rolagem.ate)});
        if (!e) throw new Error('não achei ${rolagem.ate.replace(/'/g, '')} para rolar até ele');
        e.scrollIntoView({ block: ${JSON.stringify(rolagem.bloco || 'start')}, behavior: 'instant' }); })()`);
    } else {
      const y = Number(rolagem.y) || 0;
      await this.avaliar(rolagem.em
        ? `document.querySelector(${JSON.stringify(rolagem.em)}).scrollTo({ top: ${y}, behavior: 'instant' })`
        : `window.scrollTo({ top: ${y}, behavior: 'instant' })`);
    }
    await esperar(600);
  }

  async fotografar() {
    await this.cmd('Page.bringToFront').catch(() => {});
    const { data } = await this.cmd('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    return Buffer.from(data, 'base64');
  }
}

class ErroDemo extends Error {}

// ─── Execução ─────────────────────────────────────────────────────────────────────────────────────

async function executarPasso(aba, passo, tempoLimite) {
  if (passo.clicar !== undefined || passo.clicarSeletor !== undefined) {
    const rotulo = await aba.clicar({ texto: passo.clicar, seletor: passo.clicarSeletor, exato: passo.exato !== false }, tempoLimite);
    console.log(`    · cliquei em "${rotulo}"`);
    await esperar(passo.depoisMs ?? 700);
  } else if (passo.esperar) await aba.esperarSeletor(passo.esperar, tempoLimite);
  else if (passo.esperarTexto) await aba.esperarTexto(passo.esperarTexto, tempoLimite);
  else if (passo.esperarUrlSem) await aba.esperarUrlSem(passo.esperarUrlSem, tempoLimite);
  else if (passo.esperarSumir) await aba.esperarSumir(passo.esperarSumir, tempoLimite);
  else if (passo.aguardar) await esperar(passo.aguardar);
  else if (passo.tecla) { await aba.tecla(passo.tecla); await esperar(400); }
  else if (passo.folhaImpressa) await aba.folhaImpressa(passo.folhaImpressa === true ? {} : passo.folhaImpressa);
  else if (passo.digitar !== undefined || passo.preencher !== undefined)
    throw new Error('o script não digita em campos (regra do portfólio)');
  else throw new Error(`passo desconhecido: ${JSON.stringify(passo)}`);
}

function comLimite(promessa, ms, descricao) {
  let t;
  return Promise.race([
    promessa,
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`tempo limite de ${Math.round(ms / 1000)} s em ${descricao}`)), ms); }),
  ]).finally(() => clearTimeout(t));
}

async function entrar(aba, projeto, dispositivo, limite) {
  await aba.usarDispositivo(dispositivo);
  await aba.navegar(projeto.url, limite);
  for (const passo of projeto.entrada ?? []) await executarPasso(aba, passo, limite);
}

async function capturarProjeto(edge, projeto, telas, padroes, saida, gravar, resultados) {
  const limite = projeto.tempoLimiteMs ?? padroes.tempoLimiteMs ?? 45000;
  console.log(`\n▸ ${projeto.nome ?? projeto.id}  (${projeto.url})`);

  // Confere se a demo responde antes de abrir o navegador nela.
  try {
    const r = await fetch(projeto.url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    console.warn(`  ✗ demo fora do ar ou inacessível (${e.cause?.code || e.message}). Pulando ${projeto.id}.`);
    for (const t of telas) resultados.push({ chave: `${projeto.id}/${t.nome}`, ok: false, erro: 'demo fora do ar' });
    return;
  }

  let aba = await Aba.abrir(edge);
  try {
    try {
      await comLimite(entrar(aba, projeto, telas[0]?.dispositivo ?? 'tela', limite), limite + 5000, 'entrar na demo');
    } catch (e) {
      console.warn(`  ✗ não consegui entrar na demo: ${e.message}. Pulando ${projeto.id}.`);
      for (const aviso of await aba.avisosDaPagina()) console.warn(`    a página diz: "${aviso}"`);
      for (const t of telas) resultados.push({ chave: `${projeto.id}/${t.nome}`, ok: false, erro: `entrada: ${e.message}` });
      return;
    }

    for (const tela of telas) {
      const chave = `${projeto.id}/${tela.nome}`;
      const dispositivo = tela.dispositivo ?? 'tela';
      const t0 = Date.now();
      process.stdout.write(`  • ${tela.nome} [${dispositivo}] ...\n`);
      try {
        await comLimite((async () => {
          if ((projeto.entradaSempre || tela.entrarDeNovo) && tela !== telas[0]) {
            await aba.fechar();
            aba = await Aba.abrir(edge);
            await entrar(aba, projeto, dispositivo, limite);
          }
          const mudou = await aba.usarDispositivo(dispositivo);
          const destino = tela.url ?? (tela.rota !== undefined ? new URL(tela.rota, projeto.url).href : null);
          if (destino) await aba.navegar(destino, limite);
          if (mudou || tela.recarregar) await aba.recarregar(limite);
          for (const passo of tela.passos ?? []) await executarPasso(aba, passo, limite);
          if (tela.esperar) await aba.esperarSeletor(tela.esperar, limite);
          if (tela.esperarTexto) await aba.esperarTexto(tela.esperarTexto, limite);
          await aba.rolar(tela.rolar);
          await esperar(tela.esperaMs ?? padroes.esperaMs ?? 1500);
        })(), (tela.tempoLimiteMs ?? limite) + 5000, chave);

        const png = await aba.fotografar();
        const arquivo = path.join(saida, `${projeto.id}-${tela.nome}.png`);
        await writeFile(arquivo, png);
        let destinoSite = '';
        if (gravar) destinoSite = ` → ${(await registrar(arquivo, projeto.id, tela.nome)).src}`;
        console.log(`    ✓ ${path.basename(arquivo)}${destinoSite}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
        resultados.push({ chave, ok: true, arquivo });
      } catch (e) {
        console.warn(`    ✗ ${chave}: ${e.message}`);
        resultados.push({ chave, ok: false, erro: e.message });
        if (e instanceof ErroDemo) { console.warn(`  Demo parou de responder. Pulando o resto de ${projeto.id}.`); break; }
        // Depois de um erro a página pode ter ficado num estado estranho: recomeça do zero.
        try {
          await aba.fechar();
          aba = await Aba.abrir(edge);
          await comLimite(entrar(aba, projeto, dispositivo, limite), limite + 5000, 'entrar na demo de novo');
        } catch (e2) {
          console.warn(`  ✗ não consegui voltar para a demo (${e2.message}). Pulando o resto de ${projeto.id}.`);
          break;
        }
      }
    }
  } finally {
    await aba.fechar();
  }
}

function lerArgumentos(argv) {
  const opcoes = { gravar: false, saida: null, visivel: false, pedidos: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--gravar') opcoes.gravar = true;
    else if (a === '--saida') opcoes.saida = argv[++i];
    else if (a === '--visivel') opcoes.visivel = true;
    else if (a === '--ajuda' || a === '-h' || a === '--help') opcoes.ajuda = true;
    else if (a.startsWith('--')) throw new Error(`opção desconhecida: ${a}`);
    else opcoes.pedidos.push(a.toLowerCase());
  }
  return opcoes;
}

async function main() {
  const opcoes = lerArgumentos(process.argv.slice(2));
  if (opcoes.ajuda) {
    console.log('Uso: node scripts/capturar-telas.mjs [projeto | projeto/tela ...] [--gravar] [--saida <pasta>]\n' +
      'Sem --gravar é só ensaio (PNGs numa pasta em %TEMP%). Detalhes no cabeçalho do arquivo.');
    return;
  }
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const padroes = config.padroes ?? {};

  // Seleção: sem nomes → todos os ativos; com nomes → exatamente os pedidos (mesmo inativos).
  const ids = new Set(config.projetos.map(p => p.id));
  for (const pedido of opcoes.pedidos) {
    const [id, tela] = pedido.split('/');
    if (!ids.has(id)) throw new Error(`projeto "${id}" não existe em fonte/capturas.json (há: ${[...ids].join(', ')})`);
    const p = config.projetos.find(x => x.id === id);
    if (tela && !p.telas.some(t => t.nome === tela)) throw new Error(`tela "${tela}" não existe em ${id} (há: ${p.telas.map(t => t.nome).join(', ')})`);
  }
  const selecao = [];
  for (const p of config.projetos) {
    const pedidosDoProjeto = opcoes.pedidos.filter(x => x.split('/')[0] === p.id);
    if (opcoes.pedidos.length ? !pedidosDoProjeto.length : p.ativo === false) continue;
    const telasPedidas = pedidosDoProjeto.filter(x => x.includes('/')).map(x => x.split('/')[1]);
    const telas = telasPedidas.length && !pedidosDoProjeto.includes(p.id) ? p.telas.filter(t => telasPedidas.includes(t.nome)) : p.telas;
    selecao.push({ projeto: p, telas });
  }
  if (!selecao.length) { console.log('Nada para capturar.'); return; }

  const saida = path.resolve(opcoes.saida ?? await mkdtemp(path.join(os.tmpdir(), 'portfolio-capturas-')));
  await mkdir(saida, { recursive: true });
  console.log(opcoes.gravar
    ? `Modo GRAVAR: as imagens do site em assets/projetos/ serão substituídas. PNGs em ${saida}`
    : `Modo ENSAIO: o site não será alterado. PNGs em ${saida}`);

  const resultados = [];
  let edge;
  const encerrar = async () => { await fecharEdge(edge); edge = null; };
  process.once('SIGINT', async () => { console.warn('\nInterrompido. Fechando o Edge...'); await encerrar(); process.exit(130); });
  try {
    edge = await abrirEdge({ visivel: opcoes.visivel });
    for (const { projeto, telas } of selecao)
      await capturarProjeto(edge, projeto, telas, padroes, saida, opcoes.gravar, resultados);
  } finally {
    await encerrar();
  }

  const falhas = resultados.filter(r => !r.ok);
  console.log(`\nResumo: ${resultados.length - falhas.length} de ${resultados.length} telas capturadas. PNGs em ${saida}`);
  for (const f of falhas) console.log(`  ✗ ${f.chave}: ${f.erro}`);
  if (!opcoes.gravar && resultados.some(r => r.ok))
    console.log('Nada foi alterado no site. Se as imagens estiverem boas, rode de novo com --gravar.');
  if (falhas.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(`Erro: ${e.message}`); process.exit(1); });
}
