# Portfólio — Alyssom Fernandes

Site estático no formato **"Reportagem + Vitrine"**: a abertura e a trajetória contam a carreira
(das planilhas aos sistemas, com a grade de meses), e os projetos aparecem como vitrine, com as telas de verdade:
um índice e, em seguida, um "lançamento" (cena de rolagem compacta) por projeto com telas.

Sem framework. Um gerador em Node lê a **fonte única de dados** e escreve o `index.html` com todo o conteúdo
em HTML (legível sem JavaScript e pelo Google). O JavaScript só acrescenta os efeitos de rolagem.

## Estrutura

```
fonte/
  dados.json            tudo que NÃO é texto: links, datas, números, projetos, matriz de habilidades, baseUrl
  textos.pt.json        todo o texto do site em português; textos.en.json (inglês) e textos.es.json (espanhol da Espanha)
  capturas.json         roteiro das capturas de tela das demos (usado por scripts/capturar-telas.mjs)
scripts/
  gerar-site.mjs        gera index.html, en/, es/, robots.txt, sitemap.xml e 404.html a partir de fonte/ → npm run build
  converter-imagens.mjs converte PNG em WebP e atualiza o manifesto          → npm run imagens
  capturar-telas.mjs    tira as capturas das demos com o Edge                → npm run capturas
  gerar-cv.ps1          gera os PDFs do currículo e a imagem de compartilhamento
assets/
  css/style.css         visual da página, incluindo o modo impressão (o CV)
  js/main.js            efeitos (rolagem contínua, grade de meses, telas trocando)
  img/og-pt|en|es.png   imagem que aparece ao compartilhar o link (uma por idioma)
  img/rubrica.png|webp  rubrica de Alyssom (só o traço, fundo transparente): assina o rodapé e o CV impresso
  projetos/             capturas em WebP + manifesto.json (largura, altura e versão de 960 px)
cv/                     currículo em PDF (PT, EN, ES)
index.html              GERADO — não edite à mão (é sobrescrito pelo build); o mesmo vale para en/, es/,
                        robots.txt, sitemap.xml e 404.html
favicon.svg
```

Pastas locais que não vão para o site: `_prototipos/`, `_versao-anterior/`, `_source/`, `node_modules/`.

## Ver no computador

```bash
npm run build -- --idiomas pt     # enquanto as traduções EN/ES não forem refeitas (veja "Gerar o site")
py -m http.server 5173
```

Depois abra http://127.0.0.1:5173. Abrir o `index.html` direto (duplo clique) também funciona.

Para testar uma cena sem rolar a página, use `?cena=<id>&progresso=<0 a 1>`, por exemplo
`http://127.0.0.1:5173/?cena=fuelmind&progresso=0.5`. Ids: `abertura`, `trajetoria`, `projetos`,
o id de cada projeto em lançamento (`artmaker`, `unifydata`, `fuelmind`, `praxis`, `deepchat`, `audistock`,
`alertsignal`, `flowtrack`), `cartoes`, `habilidades`, `formacao`, `contato`.

## Gerar o site

```bash
npm run build
```

Rode sempre que mexer em `fonte/` ou nas imagens. Se algo estiver errado, o gerador **não** grava nada e diz
exatamente o que corrigir (chave faltando num idioma, tela que não existe no manifesto, projeto sem campo obrigatório).

**Só alguns idiomas:** `npm run build -- --idiomas pt` (ou `--idiomas pt,en`; também vale a variável de ambiente
`IDIOMAS=pt`) gera só as páginas desses idiomas e confere só os textos deles. As outras páginas que já existem
(`en/index.html`, `es/index.html`) ficam como estavam e continuam no seletor de idioma, nos `hreflang`, no sitemap e
na 404. **Hoje (03/10/2026) use `--idiomas pt`:** os textos em português mudaram e `textos.en.json` / `textos.es.json`
ainda vão ser refeitos; sem a opção, o build para e lista as chaves que faltam nas traduções (é a lista de trabalho de
quem traduz). Não apague `en/`, `es/` nem os `textos.en/es.json`.

As contagens do site são calculadas dos dados, nunca escritas à mão: projetos publicados (quantidade de projetos),
demos ao vivo (projetos com `demo.ativa: true`) e anos de carreira (desde fev/2021). Elas aparecem em "Em números",
na abertura da seção de projetos e no título de "Também no GitHub" ("Mais um projeto." / "Mais 3 projetos.").

## Textos

Todos os textos ficam em `fonte/textos.pt.json`, em chaves legíveis (`abertura.linhaFina`, `projetos.fuelmind.frase`...).
Não use HTML. Marcação permitida:

| Escreva        | Vira                                              |
|----------------|---------------------------------------------------|
| `*palavra*`    | ênfase (itálico azul)                             |
| `**palavra**`  | negrito                                           |
| `~palavra~`    | riscado (usado em "planilhas" na tese)            |
| `{variavel}`   | valor vindo de `dados.json` ou calculado          |
| ` `       | espaço rígido (a linha nunca quebra ali), ex.: `RR. HH.` |

Variáveis úteis: `{empresasClientes}`, `{planilhasSubstituidas}`, `{empresasGrupo}` e
`{empresasGrupoBase}` (o mesmo número sem o "+", para escrever "mais de 20"), `{anosCarreira}`,
`{projetosPublicados}`, `{demosAtivas}`, `{marca}` (AFN Systems), `{carreira.zen.periodo}`, e os `numeros` de cada projeto
(ex.: `{testes}` no Fuel Mind).

As datas (`formato.mesAno`) já saem com espaço rígido: a linha só quebra entre as datas ("set/2025 –" / "jan/2026"),
nunca no meio de uma. Na legenda da grade, os meses de cada empresa são os do período exibido (o mês de transição
conta para as duas); o total conta cada mês de calendário uma vez.

## Projetos: níveis, índice e ordem

A seção de projetos tem três partes, nesta ordem:

1. **Abertura com índice** (`#projetos`, índice em `#indice`): as contagens calculadas e um sumário com todos os
   projetos (número, nome, frase e status). Cada linha é uma âncora para o projeto (`#p-<id>`), então o índice funciona
   sem JavaScript. Textos: `projetos.indice.titulo`, `projetos.indice.texto` e `projetos.indice.rotulo` (nome do índice
   para leitores de tela).
2. **Lançamentos** (`"nivel": "lancamento"`): uma cena de rolagem compacta por projeto com telas, uma depois da outra.
   Janela de navegador + celular (só se houver captura de celular) + 3 a 5 destaques sincronizados com as telas, a
   "prova" (número com a fonte, ex.: testes no CI), a stack e os botões. No topo de cada cena, os números de todos os
   projetos funcionam como um mini índice (o atual em destaque; cada número é uma âncora).
3. **Cartões** (`"nivel": "cartao"`): projetos sem telas, em "Também no GitHub". Sem captura, o cartão mostra uma
   ficha tipográfica (nome, repositório e stack). Com um cartão só, ele ocupa a largura toda e o título fica no
   singular (`projetos.cartoes.tituloUm` / `textoUm`).

**Ordem:** o campo `ordem` de cada projeto em `fonte/dados.json` (1 = primeiro). A mesma ordem vale para o índice, os
lançamentos, os cartões, as colunas da matriz de habilidades e o currículo impresso. Para mudar, troque os números (e a
ordem de `matriz.colunas`, com as marcas) e rode o build. Hoje (11/10/2026), do melhor e mais chamativo para o menor:
ArtMaker, UnifyData, Fuel Mind, Praxis, DeepChat, AudiStock, AlertSignal, FlowTrack e, no fim, o Docke como cartão
(não tem nenhuma tela).

**"Subir" um projeto de cartão para lançamento:** gere as telas (veja **Capturas de tela**), troque
`"nivel": "cartao"` por `"nivel": "lancamento"`, preencha `telas`, `celular` (ou `null`), `legenda` e `itens`, escreva os
textos dos destaques e rode o build. O gerador avisa o que faltar: pelo menos uma tela, `itens` com a tela de cada
destaque e, no texto, `itens.<id>.titulo` / `itens.<id>.texto`. O primeiro destaque não pode ser o `"celular"` (o
celular entra na cena depois da janela).

**Altura das cenas:** cada lançamento tem a altura da tela mais um "passo" de rolagem por destaque (`--passo` em
`assets/css/style.css`, hoje 24vh). Diminua para cenas mais curtas, aumente para mais calmas. Use 3 ou 4 destaques
por projeto (o Fuel Mind tem 5). A descrição de cada destaque abre e fecha numa janela larga do passo (`main.js`,
`renderLaunch`), então um passo menor não deixa a troca brusca. A cena se ajusta à altura da janela (a janela do navegador e o celular encolhem, e a
lista mostra só a descrição do destaque ativo). No celular e no tablet em pé a cena fica empilhada: telas em cima,
texto embaixo, um destaque por vez. Telas com proporção diferente da primeira do projeto aparecem inteiras, sem corte.

**Transições:** tudo é contínuo. Enquanto uma cena sobe do pé da tela até fixar, a janela e o celular chegam
(progresso de "entrada"); com a cena fixa, os destaques trocam junto com as telas (progresso dos destaques). Entre dois
lançamentos seguidos, o de baixo já vai se montando enquanto o de cima sai.

## Adicionar um projeto

1. Se tiver telas: gere as capturas (veja **Imagens** e **Capturas de tela**) para que existam em
   `assets/projetos/manifesto.json` com a chave `"projeto/tela"` (ex.: `"novo/painel"`).
2. Em `fonte/dados.json`, dentro de `"projetos"`, copie um bloco parecido e ajuste:
   - `id`, `nome`, `ordem` (posição na página), `nivel`: `"lancamento"` (com telas) ou `"cartao"` (sem telas)
   - `emProducao` (true/false), `demo`: `{ "url": "...", "ativa": true }` ou `null`
   - `codigo`: lista de `{ "rotulo": "codigo", "url": "https://github.com/..." }` (o UnifyData usa dois:
     `codigoWeb` e `codigoPython`; os rótulos ficam em `interface.rotulosCodigo`)
   - `stack`: lista de tecnologias, com nomes neutros que valem nos 3 idiomas (ex.: "JavaScript (ES modules)",
     "DeepSeek API"); `numeros`: valores usados nos textos (ex.: `{ "testes": "40" }`)
   - `telas`: chaves do manifesto; `celular`: chave da captura de celular ou `null`
   - `legenda`: `"demo"` (captura de demo com dados fictícios) ou `"repositorio"` (imagens do repositório)
   - `itens`: destaques ligados a telas (`{ "id": "importa", "tela": "novo/painel" }` ou `"tela": "celular"`)
3. Em `fonte/textos.pt.json`, dentro de `"projetos"`, crie `"novo"` com:
   - obrigatórios: `frase` (curta e factual; aparece no índice e no lançamento), `resumo`, `cv` (a linha do projeto no
     currículo impresso, concisa) e, no lançamento, `itens.<id>.titulo` / `itens.<id>.texto`
   - opcionais: `prova` (ex.: `"**{testes}** testes automatizados no GitHub Actions"`, aparece com um ✓) e `obs`
     (observação curta, ex.: "Sem demo publicada…")
   - e em `"alt"` o texto alternativo de cada tela usada.
4. Na matriz de habilidades, acrescente o id em `matriz.colunas` e uma marca (0/1) em cada linha, **só com evidência no
   código ou no CI** do repositório. Os totais são calculados.
5. `npm run build -- --idiomas pt`.

## Status e demos

O status de cada projeto é calculado: **Em produção** (`emProducao: true`), senão **Demo ao vivo**
(`demo.ativa: true`), senão **Código**. Sem demo ativa, o projeto mostra só os botões de código (ex.: AlertSignal, que
está em produção mas não tem demo publicada; FlowTrack e Docke, cujas demos estão fora do ar).

**Ligar a demo do Docke ou do FlowTrack:** em `fonte/dados.json`, no projeto, troque `"ativa": false` por
`"ativa": true` em `demo` e rode o build. Aparece o botão "Ver demo ao vivo", o status muda de "Código" para "Demo ao
vivo", a barra da janela passa a mostrar o endereço da demo e a contagem de demos é recalculada. Enquanto
`"ativa": false`, a URL da demo continua guardada nos dados. Na barra da janela e no CV o endereço aparece sem o
`?demo=1`; o link leva ao endereço completo.

## Imagens

```bash
npm run imagens
```

Converte os PNG em WebP (qualidade 82), cria a versão de 960 px das telas largas e atualiza
`assets/projetos/manifesto.json`. O gerador usa esse manifesto para largura/altura, `srcset` e para conferir
que toda tela citada existe.

## Capturas de tela

As imagens dos projetos (`assets/projetos/<projeto>/<tela>.webp`) vêm direto das demos ao vivo. O script
`scripts/capturar-telas.mjs` (atalho: `npm run capturas`) abre o Microsoft Edge escondido, com um perfil
descartável na pasta temporária, e segue o roteiro de `fonte/capturas.json`. Ele só navega e usa os botões de
entrar em modo demonstração: nunca digita, nunca faz login e nunca envia formulário.

```bash
node scripts/capturar-telas.mjs                     # ensaio: PNGs numa pasta em %TEMP%, site intacto
node scripts/capturar-telas.mjs fuelmind            # ensaio de um projeto
node scripts/capturar-telas.mjs praxis/kanban       # ensaio de uma tela
node scripts/capturar-telas.mjs fuelmind --gravar   # substitui as imagens do site e o manifesto
```

Fluxo recomendado: melhorou uma demo → rode o ensaio → confira os PNGs → rode de novo com `--gravar` →
`npm run build`.

- **Nova tela:** acrescente em `fonte/capturas.json` um item em `telas` com `nome` (o mesmo usado no site),
  `rota` ou `passos` (ex.: `{ "clicar": "Relatórios" }`) e `dispositivo` (`"tela"` 1440×900 ou `"celular"` 390×844).
- **Novo projeto:** acrescente um item em `projetos` com `id`, `url`, os passos de `entrada`
  (ex.: `{ "clicar": "Acessar modo demo" }`) e as telas.
- **Demo indisponível:** marque o projeto com `"ativo": false`. Ele é pulado nas execuções gerais, mas ainda roda
  quando é pedido pelo nome.

A documentação completa está no cabeçalho do script.

## Currículo em PDF e imagem de compartilhamento

```powershell
powershell -ExecutionPolicy Bypass -File scripts\gerar-cv.ps1
```

- Regenera o site, imprime cada página existente (`index.html`, `en/index.html`, `es/index.html`) em
  `cv/Alyssom-Fernandes-CV-PT.pdf` / `-EN.pdf` / `-ES.pdf` e confere se deu 2 páginas.
- Gera `assets/img/og-pt.png` (e `og-en.png`, `og-es.png`) em 1200×630 a partir de um modelo próprio.
- Para conferir antes de substituir os PDFs: `-PastaCv C:\algum\lugar`. Opções `-SemCv` e `-SemOg`.
- `-Idiomas pt`: roda o build com `--idiomas pt` e só faz o PDF (e a og) desses idiomas. Use enquanto as traduções
  estiverem desatualizadas, por exemplo `scripts\gerar-cv.ps1 -PastaCv $env:TEMP\cv-teste -SemOg -Idiomas pt`.

O CV é o modo impressão da página (`@media print` em `style.css`): identidade e contato, resumo, experiência,
projetos (todos, na ordem do site, uma linha concisa cada, em `projetos.<id>.cv`), habilidades, formação e idiomas —
sai dos mesmos dados do site. Tem de continuar em 2 páginas A4, com a experiência antes dos projetos (o script avisa
se não der).

## robots.txt, sitemap.xml e página 404

O build gera os três na raiz a partir de `site.baseUrl`:

- `sitemap.xml`: as 3 páginas, cada uma com os `hreflang` (pt-BR, en, es-ES e x-default).
- `robots.txt`: libera tudo e aponta o sitemap. Os buscadores só leem o robots.txt na raiz do domínio; enquanto o site
  estiver em `/portfolio/`, envie o sitemap pelo Google Search Console (no domínio próprio ou no repositório especial
  ele passa a valer sozinho).
- `404.html`: página simples no visual do site, com links para as 3 versões (textos em `erro404` de cada
  `textos.<idioma>.json`). Os links usam o caminho do `baseUrl` (ex.: `/portfolio/`), porque o GitHub Pages serve a
  404 em qualquer profundidade.

## Trocar o endereço do site (baseUrl)

Em `fonte/dados.json`, `site.baseUrl` (uma linha):

- hoje: `https://alyssom-fernandes.github.io/portfolio/`
- repositório especial na raiz: `https://alyssom-fernandes.github.io/`
- domínio próprio: `https://seudominio.com/`

Rode `npm run build` e `scripts\gerar-cv.ps1` (o endereço aparece no CV e na og). Esse endereço só é usado nas URLs
absolutas (canonical, hreflang, Open Graph, JSON-LD, CV, sitemap, robots e links da 404); links e imagens internas são relativos e funcionam em
qualquer lugar. Para domínio próprio no GitHub Pages, crie também o arquivo `CNAME` com o domínio.

## Adicionar um idioma

1. Copie `fonte/textos.pt.json` para `fonte/textos.en.json` (ou `textos.es.json`) e traduza **só os valores**.
   Mantenha as chaves, a marcação (`*`, `**`, `~`) e as `{variaveis}` iguais.
2. `npm run build` — o idioma entra sozinho: gera `en/index.html`, o seletor PT/EN/ES no topo, os `hreflang`
   e o link do CV em inglês. Se faltar alguma chave, o gerador lista quais.
3. `scripts\gerar-cv.ps1` para o PDF e a og do idioma.

Os idiomas possíveis (código, `lang`, pasta) estão em `site.idiomas` no `dados.json`.

## Publicar (GitHub Pages)

1. `npm run build` (ou `npm run build -- --idiomas pt` enquanto EN/ES não forem refeitos) e, se mudou texto,
   `scripts\gerar-cv.ps1` (com `-Idiomas pt` no mesmo caso).
2. Confira localmente (`py -m http.server 5173`).
3. Faça o commit e o push para `main`. O Pages publica a raiz do repositório (o arquivo `.nojekyll` já existe).
   Vão para o ar: `index.html`, `en/`, `es/`, `assets/`, `cv/`, `favicon.svg`, `robots.txt`, `sitemap.xml`, `404.html`.
   Os arquivos de `fonte/` e `scripts/` também ficam no repositório (não aparecem na página).
