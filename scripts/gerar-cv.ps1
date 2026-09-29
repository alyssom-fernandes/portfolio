# Gera os PDFs do currículo (PT, EN, ES) e a imagem de compartilhamento (og.png)
# a partir do próprio index.html, usando o Edge (ou Chrome) em modo headless.
#
# Uso (na pasta do projeto):
#   powershell -ExecutionPolicy Bypass -File scripts\gerar-cv.ps1
#
# Rode de novo sempre que alterar textos do site: o PDF é o "modo impressão" da página.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$index = Join-Path $root 'index.html'
$cvDir = Join-Path $root 'cv'
$imgDir = Join-Path $root 'assets\img'
New-Item -ItemType Directory -Force $cvDir, $imgDir | Out-Null

$candidates = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
)
$browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Edge ou Chrome não encontrado.' }

$baseUrl = ([System.Uri]$index).AbsoluteUri
$profileDir = Join-Path $env:TEMP 'portfolio-cv-profile'

function Invoke-Headless([string[]]$browserArgs) {
  $common = @('--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
              '--disable-extensions', "--user-data-dir=$profileDir", '--virtual-time-budget=9000')
  $proc = Start-Process -FilePath $browser -ArgumentList ($common + $browserArgs) -Wait -PassThru -WindowStyle Hidden
  return $proc.ExitCode
}

foreach ($lang in 'pt', 'en', 'es') {
  $out = Join-Path $cvDir ("Alyssom-Fernandes-CV-{0}.pdf" -f $lang.ToUpper())
  if (Test-Path $out) { Remove-Item $out }
  Invoke-Headless @('--no-pdf-header-footer', "--print-to-pdf=$out", "$baseUrl`?lang=$lang") | Out-Null
  if (Test-Path $out) { Write-Host "OK  $out" } else { Write-Warning "Falhou: $out" }
}

$og = Join-Path $imgDir 'og.png'
if (Test-Path $og) { Remove-Item $og }
Invoke-Headless @('--window-size=1200,630', "--screenshot=$og", "$baseUrl`?lang=pt&og=1") | Out-Null
if (Test-Path $og) { Write-Host "OK  $og" } else { Write-Warning "Falhou: $og" }
