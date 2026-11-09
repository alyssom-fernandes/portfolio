# Gera o currículo em PDF (um por idioma publicado) e a imagem de compartilhamento (og) de cada idioma,
# usando o Edge (ou Chrome) em modo headless, com um perfil novo e descartável na pasta temporária.
#
# Uso (na pasta do projeto):
#   powershell -ExecutionPolicy Bypass -File scripts\gerar-cv.ps1
#       regenera o site (npm run build), grava cv\Alyssom-Fernandes-CV-PT.pdf (e -EN / -ES se existirem
#       en\index.html e es\index.html) e assets\img\og-pt.png (e og-en.png / og-es.png)
#
#   powershell -ExecutionPolicy Bypass -File scripts\gerar-cv.ps1 -PastaCv C:\temp\teste
#       grava os PDFs em outra pasta (bom para conferir antes de substituir os de cv\)
#
#   -SemCv   só gera as imagens og      ·      -SemOg   só gera os PDFs
#   -Idiomas pt   só os idiomas listados (separados por vírgula), ex.: enquanto as traduções estão desatualizadas;
#                 repassa --idiomas ao gerador do site e só imprime o PDF / gera a og desses idiomas
#
# O PDF é o "modo impressão" da própria página (@media print em assets\css\style.css):
# 2 páginas A4, experiência antes dos projetos. A og usa um modelo próprio (1200×630),
# gerado por scripts\gerar-site.mjs --og, e não um recorte da página.
# Rode de novo sempre que alterar textos ou dados do site.

param(
  [string]$PastaCv = '',
  [switch]$SemCv,
  [switch]$SemOg,
  [string]$Idiomas = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $PastaCv) { $PastaCv = Join-Path $root 'cv' }
$imgDir = Join-Path $root 'assets\img'
New-Item -ItemType Directory -Force $PastaCv, $imgDir | Out-Null

$candidates = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
)
$browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Edge ou Chrome não encontrado.' }

# 1. Site atualizado + modelos da og numa pasta temporária
$tmp = Join-Path $env:TEMP ('portfolio-cv-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force $tmp | Out-Null
Push-Location $root
try {
  if ($Idiomas) { & node scripts/gerar-site.mjs --og $tmp --idiomas $Idiomas } else { & node scripts/gerar-site.mjs --og $tmp }
  if ($LASTEXITCODE -ne 0) { throw 'O gerador do site falhou (veja a mensagem acima).' }
} finally { Pop-Location }

# 2. Edge headless com perfil próprio; ao final encerra SÓ os processos deste perfil
function Invoke-Headless([string[]]$browserArgs) {
  $perfil = Join-Path $tmp ('perfil-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
  $common = @('--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
              '--disable-extensions', "--user-data-dir=$perfil", '--virtual-time-budget=12000')
  $proc = Start-Process -FilePath $browser -ArgumentList ($common + $browserArgs) -PassThru -WindowStyle Hidden
  if (-not $proc.WaitForExit(120000)) { Write-Warning 'O navegador passou do tempo limite.' }
  Get-CimInstance Win32_Process -Filter "Name='msedge.exe' OR Name='chrome.exe'" |
    Where-Object { $_.CommandLine -like "*$perfil*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 500
  Remove-Item -Recurse -Force $perfil -ErrorAction SilentlyContinue
}

$idiomasCv = @(
  @{ cod = 'pt'; pagina = 'index.html' },
  @{ cod = 'en'; pagina = 'en\index.html' },
  @{ cod = 'es'; pagina = 'es\index.html' }
)
if ($Idiomas) {
  $lista = $Idiomas.Split(',') | ForEach-Object { $_.Trim().ToLower() }
  $idiomasCv = @($idiomasCv | Where-Object { $lista -contains $_.cod })
}

# 3. Currículo em PDF de cada página que existir
if (-not $SemCv) {
  foreach ($i in $idiomasCv) {
    $pagina = Join-Path $root $i.pagina
    if (-not (Test-Path $pagina)) { continue }
    $out = Join-Path $PastaCv ("Alyssom-Fernandes-CV-{0}.pdf" -f $i.cod.ToUpper())
    if (Test-Path $out) { Remove-Item $out }
    $url = ([System.Uri]$pagina).AbsoluteUri
    Invoke-Headless @('--no-pdf-header-footer', "--print-to-pdf=$out", $url)
    if (Test-Path $out) {
      $paginas = ([regex]::Matches([System.IO.File]::ReadAllText($out, [System.Text.Encoding]::GetEncoding(28591)), '/Type\s*/Page[^s]')).Count
      Write-Host ("OK  {0}  ({1} página(s))" -f $out, $paginas)
      if ($paginas -ne 2) { Write-Warning "O currículo deveria ter 2 páginas; ajuste os textos ou o @media print." }
    } else { Write-Warning "Falhou: $out" }
  }
}

# 4. Imagem de compartilhamento 1200×630 de cada idioma
if (-not $SemOg) {
  foreach ($i in $idiomasCv) {
    $modelo = Join-Path $tmp ("og-{0}.html" -f $i.cod)
    if (-not (Test-Path $modelo)) { continue }
    $og = Join-Path $imgDir ("og-{0}.png" -f $i.cod)
    if (Test-Path $og) { Remove-Item $og }
    Invoke-Headless @('--window-size=1200,630', "--screenshot=$og", ([System.Uri]$modelo).AbsoluteUri)
    if (Test-Path $og) { Write-Host "OK  $og" } else { Write-Warning "Falhou: $og" }
  }
  # a página aponta para a og do idioma: regenera para já usar as imagens novas
  Push-Location $root
  try {
    if ($Idiomas) { & node scripts/gerar-site.mjs --idiomas $Idiomas | Out-Null } else { & node scripts/gerar-site.mjs | Out-Null }
  } finally { Pop-Location }
}

Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
