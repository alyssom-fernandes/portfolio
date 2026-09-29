# Portfólio — Alyssom Fernandes

**Conceito: "da planilha ao sistema".** A página inteira se comporta como uma planilha:
barra de fórmulas no topo (que muda a cada seção), colunas A–L, linhas numeradas,
abas no rodapé como menu e a célula sob o cursor aparecendo na caixa de nome.
No topo, uma planilha caótica se desfaz célula por célula e vira o dashboard do Fuel Mind.

Sem framework e sem etapa de build: HTML, CSS e JavaScript puros.

## Estrutura

```
index.html            conteúdo da página (texto padrão em português)
assets/css/style.css  todo o visual, incluindo tema escuro e o layout do PDF
assets/js/i18n.js     textos em PT, EN e ES
assets/js/main.js     comportamento (idioma, tema, fórmulas, animações)
assets/img/og.png     imagem que aparece ao compartilhar o link
cv/                   currículo em PDF nos 3 idiomas (gerado pelo script)
scripts/gerar-cv.ps1  gera os PDFs e a og.png a partir da própria página
favicon.svg
_versao-anterior/     a versão estilo GTA, guardada como estava
```

## Ver no computador

Abrir o `index.html` direto funciona, mas o ideal é um servidor local:

```bash
py -m http.server 5173
```

Depois acesse http://localhost:5173 (use `?lang=en` ou `?lang=es` para os outros idiomas).

## Editar textos

1. Procure o texto em `assets/js/i18n.js` e altere nos **três** idiomas (`pt`, `en`, `es`).
2. Se mudar o português, altere também no `index.html` (é o que aparece sem JavaScript e para o Google).
3. Rode o script do CV (abaixo) para o PDF acompanhar.

Projetos novos: copie um bloco `<article class="project">` no `index.html`, crie as chaves
`p5.*` no `i18n.js` e, se quiser, adicione uma coluna na tabela dinâmica de habilidades.
Os totais da tabela são calculados sozinhos.

## Gerar o currículo em PDF

O PDF é o "modo impressão" da própria página (experiência antes dos projetos, 2 páginas).

```bash
powershell -ExecutionPolicy Bypass -File scripts/gerar-cv.ps1
```

Gera `cv/Alyssom-Fernandes-CV-PT.pdf`, `-EN.pdf`, `-ES.pdf` e `assets/img/og.png`.
O botão "Baixar CV" do site já aponta para o PDF do idioma que está aberto.

## Publicar (GitHub Pages, grátis)

1. Crie um repositório (por exemplo `alyssom-fernandes.github.io`) e envie estes arquivos.
   Não precisa enviar `_versao-anterior/` nem `_source/`.
2. No GitHub: **Settings → Pages → Branch: main / (root)**.
3. Depois de publicado, troque no `index.html` o `og:image` por uma URL absoluta, por exemplo
   `https://alyssom-fernandes.github.io/assets/img/og.png`, para a prévia aparecer no LinkedIn/WhatsApp.

## Pendências conhecidas

- **FlowTrack, Docke e AudiStock** estão com o backend fora do ar (projeto Supabase pausado;
  Railway e Fly.io sem resposta). Quando voltarem, dá para adicionar o link "Demo ao vivo" nos cards.
- As ilustrações dos projetos são representações (marcadas como "Interface ilustrativa").
  Dá para trocar por prints reais: Fuel Mind, FlowTrack e AlertSignal já têm prints nos repositórios.
