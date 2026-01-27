# ============================================
# Lifo4 EMS - Prepare Deploy Package (Windows)
# Execute no PowerShell como Admin
# ============================================

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Blue
Write-Host "   Lifo4 EMS - Preparando Deploy" -ForegroundColor Blue
Write-Host "============================================" -ForegroundColor Blue
Write-Host ""

$ProjectDir = Split-Path -Parent $PSScriptRoot
$OutputFile = "$ProjectDir\lifo4-ems-deploy.tar.gz"

Write-Host "[1/3] Verificando projeto..." -ForegroundColor Yellow
if (!(Test-Path "$ProjectDir\backend")) {
    Write-Host "Erro: Diretorio backend nao encontrado!" -ForegroundColor Red
    exit 1
}

Write-Host "[2/3] Criando pacote de deploy..." -ForegroundColor Yellow

# Check if 7-Zip is installed
$7zipPath = "C:\Program Files\7-Zip\7z.exe"
if (!(Test-Path $7zipPath)) {
    Write-Host "7-Zip nao encontrado. Instalando via winget..." -ForegroundColor Yellow
    winget install 7zip.7zip -h
    $7zipPath = "C:\Program Files\7-Zip\7z.exe"
}

# Create temporary directory for clean copy
$TempDir = "$env:TEMP\lifo4-deploy-$(Get-Random)"
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

# Copy files excluding node_modules, .git, venv, etc.
Write-Host "Copiando arquivos..." -ForegroundColor Gray
$Exclude = @("node_modules", ".git", "venv", "__pycache__", ".env", "*.log", "dist", "build", ".next")

function Copy-FilteredDirectory {
    param($Source, $Destination, $ExcludeList)

    Get-ChildItem -Path $Source -Force | ForEach-Object {
        $skip = $false
        foreach ($ex in $ExcludeList) {
            if ($_.Name -like $ex) {
                $skip = $true
                break
            }
        }

        if (!$skip) {
            if ($_.PSIsContainer) {
                $newDest = Join-Path $Destination $_.Name
                New-Item -ItemType Directory -Path $newDest -Force | Out-Null
                Copy-FilteredDirectory -Source $_.FullName -Destination $newDest -ExcludeList $ExcludeList
            } else {
                Copy-Item $_.FullName -Destination $Destination -Force
            }
        }
    }
}

Copy-FilteredDirectory -Source $ProjectDir -Destination $TempDir -ExcludeList $Exclude

Write-Host "[3/3] Compactando..." -ForegroundColor Yellow
$TarFile = "$env:TEMP\lifo4-ems.tar"

# Create tar
Push-Location $TempDir
& $7zipPath a -ttar $TarFile * -r | Out-Null
Pop-Location

# Create gzip
& $7zipPath a -tgzip $OutputFile $TarFile | Out-Null

# Cleanup
Remove-Item $TarFile -Force -ErrorAction SilentlyContinue
Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue

$FileSize = (Get-Item $OutputFile).Length / 1MB
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "   Pacote criado com sucesso!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Arquivo: $OutputFile" -ForegroundColor Cyan
Write-Host "Tamanho: $([math]::Round($FileSize, 2)) MB" -ForegroundColor Cyan
Write-Host ""
Write-Host "Proximo passo - Copie para o servidor:" -ForegroundColor Yellow
Write-Host "scp `"$OutputFile`" root@76.13.164.252:/opt/" -ForegroundColor White
Write-Host ""
