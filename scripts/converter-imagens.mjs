// Converte capturas PNG em WebP para o site e mantém assets/projetos/manifesto.json
// (largura e altura de cada imagem, usadas pelo gerador para reservar o espaço na página).
//
// Uso (na pasta do projeto):
//   node scripts/converter-imagens.mjs                      converte a pasta padrão de capturas
//   node scripts/converter-imagens.mjs pasta/com/pngs       converte outra pasta
//
// Nome do arquivo → destino:
//   fuelmind-dashboard.png  →  assets/projetos/fuelmind/dashboard.webp
//   artmaker.png            →  assets/projetos/artmaker/principal.webp
// Telas mais largas que 960 px ganham também uma versão -960.webp (para celular).
//
// Outros scripts (ex.: capturar-telas) importam converterImagem() para gravar uma tela nova.

import sharp from 'sharp';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destinoBase = path.join(raiz, 'assets', 'projetos');
const manifestoPath = path.join(destinoBase, 'manifesto.json');
const pastaPadrao = path.join(raiz, '_prototipos', 'reportagem-vitrine', 'img');

const QUALIDADE = 82;
const LARGURA_MENOR = 960;

const rel = p => path.relative(raiz, p).split(path.sep).join('/');

export async function lerManifesto() {
  if (!existsSync(manifestoPath)) return {};
  return JSON.parse(await readFile(manifestoPath, 'utf8'));
}

async function salvarManifesto(manifesto) {
  const ordenado = Object.fromEntries(Object.entries(manifesto).sort(([a], [b]) => a.localeCompare(b)));
  await mkdir(destinoBase, { recursive: true });
  await writeFile(manifestoPath, JSON.stringify(ordenado, null, 2) + '\n');
}

// "fuelmind-dashboard.png" → { projeto: 'fuelmind', tela: 'dashboard' }
export function separarNome(arquivo) {
  const base = path.basename(arquivo, path.extname(arquivo)).toLowerCase();
  const i = base.indexOf('-');
  return i === -1
    ? { projeto: base, tela: 'principal' }
    : { projeto: base.slice(0, i), tela: base.slice(i + 1) };
}

// Converte um PNG (ou JPG) e devolve a entrada do manifesto. Não grava o manifesto:
// quem chama decide (use registrar() para uma imagem avulsa).
export async function converterImagem(origem, projeto, tela) {
  const pasta = path.join(destinoBase, projeto);
  await mkdir(pasta, { recursive: true });

  const { width: w, height: h } = await sharp(origem).metadata();
  const principal = path.join(pasta, `${tela}.webp`);
  await sharp(origem).webp({ quality: QUALIDADE }).toFile(principal);

  const entrada = { src: rel(principal), w, h, variantes: [] };
  if (w > LARGURA_MENOR) {
    const menor = path.join(pasta, `${tela}-${LARGURA_MENOR}.webp`);
    const r = await sharp(origem).resize({ width: LARGURA_MENOR }).webp({ quality: QUALIDADE }).toFile(menor);
    entrada.variantes.push({ src: rel(menor), w: r.width, h: r.height });
  }
  return entrada;
}

export async function registrar(origem, projeto, tela) {
  const manifesto = await lerManifesto();
  manifesto[`${projeto}/${tela}`] = await converterImagem(origem, projeto, tela);
  await salvarManifesto(manifesto);
  return manifesto[`${projeto}/${tela}`];
}

async function main() {
  const pasta = path.resolve(process.argv[2] ?? pastaPadrao);
  const arquivos = (await readdir(pasta)).filter(f => /\.(png|jpe?g)$/i.test(f)).sort();
  if (!arquivos.length) throw new Error(`Nenhuma imagem em ${pasta}`);

  const manifesto = await lerManifesto();
  for (const arquivo of arquivos) {
    const { projeto, tela } = separarNome(arquivo);
    const entrada = await converterImagem(path.join(pasta, arquivo), projeto, tela);
    manifesto[`${projeto}/${tela}`] = entrada;
    console.log(`OK  ${arquivo} → ${entrada.src} (${entrada.w}×${entrada.h})`);
  }
  await salvarManifesto(manifesto);
  console.log(`\n${arquivos.length} imagens · manifesto em ${rel(manifestoPath)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
