# =============================================================
# deploy-aws.ps1 — Deploy a S3 + CloudFront
# Uso: .\deploy-aws.ps1               (menú interactivo)
#      .\deploy-aws.ps1 -App admin
#      .\deploy-aws.ps1 -App restaurante
#      .\deploy-aws.ps1 -App all
# =============================================================

param(
    [ValidateSet("admin", "restaurante", "parqueadero", "tienda", "all", "")]
    [string]$App = ""
)

$BUCKET     = "escalapp-web-front"
$CF_DIST_ID = "E1ILE8J3E53GC9"
$CF_URL     = "https://dsm1cwmosama.cloudfront.net"

# ── Definición de cada app ──────────────────────────────────
$APPS = @{
    admin = @{
        Name       = "Admin App"
        ProjectDir = "$PSScriptRoot"
        DistFolder = "$PSScriptRoot\dist\admin_app-v21\browser"
        S3Prefix   = "admin"
    }
    restaurante = @{
        Name       = "Restaurante App"
        ProjectDir = "$PSScriptRoot\..\restaurante_app"
        # Verifica si este lleva guion bajo o medio
        DistFolder = "$PSScriptRoot\..\restaurante_app\dist\negocio-app\browser"
        S3Prefix   = "restaurante"
    }
    parqueadero = @{
        Name       = "Parqueadero App"
        ProjectDir = "$PSScriptRoot\..\parqueadero_app"
        # AJUSTADO según tu log de error:
        DistFolder = "$PSScriptRoot\..\parqueadero_app\dist\parqueadero_app\browser" 
        S3Prefix   = "parqueadero"
    }
    tienda = @{
        Name       = "Tienda App"
        ProjectDir = "$PSScriptRoot\..\tienda_app"
        # Ajusta este también según cómo se llame el proyecto en su angular.json
        DistFolder = "$PSScriptRoot\..\tienda_app\dist\tienda_app\browser"
        S3Prefix   = "tienda"
    }
}

# ── Menú interactivo si no se pasó parámetro ─────────────────
if ($App -eq "") {
    Write-Host ""
    Write-Host "¿Qué aplicación deseas desplegar?" -ForegroundColor Cyan
    Write-Host "  [1] Admin"
    Write-Host "  [2] Restaurante"
    Write-Host "  [3] Parqueadero"
    Write-Host "  [4] Tienda"
    Write-Host "  [5] Todas"
    $choice = Read-Host "Selecciona (1-5)"
    $App = switch ($choice) {
        "1" { "admin" }
        "2" { "restaurante" }
        "3" { "parqueadero" }
        "4" { "tienda" }
        "5" { "all" }
        default { Write-Host "Opción inválida." -ForegroundColor Red; exit 1 }
    }
}

$targets = if ($App -eq "all") { @("admin", "restaurante", "parqueadero", "tienda") } else { @($App) }

# ── Función de deploy para una app ───────────────────────────
function Deploy-App($appKey) {
    $cfg = $APPS[$appKey]

    Write-Host ""
    Write-Host "══════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host " Desplegando: $($cfg.Name)" -ForegroundColor Magenta
    Write-Host "══════════════════════════════════════════" -ForegroundColor Magenta

    # 1. Build
    Write-Host "`n[1/5] Construyendo $($cfg.Name)..." -ForegroundColor Cyan
    Push-Location $cfg.ProjectDir
    # Se recomienda asegurar que el base-href coincida con el prefijo de S3
    ng build --base-href "/$($cfg.S3Prefix)/"
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Write-Host "ERROR: El build de $($cfg.Name) falló." -ForegroundColor Red
        exit 1
    }
    Pop-Location

    # 2. Sync a S3
    Write-Host "`n[2/5] Subiendo archivos a s3://$BUCKET/$($cfg.S3Prefix)/..." -ForegroundColor Cyan
    aws s3 sync $cfg.DistFolder "s3://$BUCKET/$($cfg.S3Prefix)/" --delete
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Falló la subida a S3." -ForegroundColor Red
        exit 1
    }

    # 3. Manejo de index.csr.html (Solución al error 403)
    # Renombramos index.csr.html a index.html para que CloudFront lo encuentre
    Write-Host "`n[3/5] Normalizando index.html..." -ForegroundColor Cyan
    aws s3 mv "s3://$BUCKET/$($cfg.S3Prefix)/index.csr.html" "s3://$BUCKET/$($cfg.S3Prefix)/index.html" --content-type "text/html"
    
    # 4. MIME types y Cache Control
    Write-Host "`n[4/5] Configurando MIME types..." -ForegroundColor Cyan

    # JavaScript
    aws s3 cp "s3://$BUCKET/$($cfg.S3Prefix)/" "s3://$BUCKET/$($cfg.S3Prefix)/" `
        --recursive --exclude "*" --include "*.js" `
        --metadata-directive REPLACE `
        --content-type "application/javascript" `
        --cache-control "max-age=31536000,immutable"

    # CSS
    aws s3 cp "s3://$BUCKET/$($cfg.S3Prefix)/" "s3://$BUCKET/$($cfg.S3Prefix)/" `
        --recursive --exclude "*" --include "*.css" `
        --metadata-directive REPLACE `
        --content-type "text/css" `
        --cache-control "max-age=31536000,immutable"

    # HTML (Asegurar que el index no se guarde en caché para ver cambios rápido)
    aws s3 cp "s3://$BUCKET/$($cfg.S3Prefix)/index.html" "s3://$BUCKET/$($cfg.S3Prefix)/index.html" `
        --metadata-directive REPLACE `
        --content-type "text/html" `
        --cache-control "no-cache,no-store,must-revalidate"

    # 5. Invalidar CloudFront
    Write-Host "`n[5/5] Invalidando caché de CloudFront (/$($cfg.S3Prefix)/*)..." -ForegroundColor Cyan
    aws cloudfront create-invalidation `
        --distribution-id $CF_DIST_ID `
        --paths "/$($cfg.S3Prefix)/*"

    Write-Host "`n✅ $($cfg.Name) desplegado correctamente." -ForegroundColor Green
    Write-Host "   URL: $CF_URL/$($cfg.S3Prefix)/" -ForegroundColor Yellow
}

# ── Ejecutar deploys seleccionados ───────────────────────────
foreach ($target in $targets) {
    Deploy-App $target
}

Write-Host ""
Write-Host "Espera 1-2 minutos a que CloudFront propague los cambios." -ForegroundColor Yellow