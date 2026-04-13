# =============================================================
# deploy-aws.ps1 — Deploy admin_app-v21 a S3 + CloudFront
# Uso: .\deploy-aws.ps1
# =============================================================

$BUCKET      = "escalapp-web-front"
$S3_PREFIX   = "admin"
$CF_DIST_ID  = "E1ILE8J3E53GC9"
$DIST_FOLDER = "dist\admin_app-v21\browser"

# 1. Build de Angular (base-href ya está en angular.json producción)
Write-Host "`n[1/4] Construyendo la aplicación..." -ForegroundColor Cyan
ng build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: El build falló. Revisa los errores anteriores." -ForegroundColor Red
    exit 1
}

# 2. Subir archivos a S3 (--delete elimina archivos viejos)
Write-Host "`n[2/4] Subiendo archivos a S3..." -ForegroundColor Cyan
aws s3 sync "$DIST_FOLDER" "s3://$BUCKET/$S3_PREFIX/" --delete
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Falló la subida a S3." -ForegroundColor Red
    exit 1
}

# 3. Corregir MIME types para .js y .css
#    (aws s3 sync a veces no los asigna correctamente en Windows)
Write-Host "`n[3/4] Configurando MIME types..." -ForegroundColor Cyan

aws s3 cp "s3://$BUCKET/$S3_PREFIX/" "s3://$BUCKET/$S3_PREFIX/" `
    --recursive `
    --exclude "*" `
    --include "*.js" `
    --metadata-directive REPLACE `
    --content-type "application/javascript" `
    --cache-control "max-age=31536000,immutable"

aws s3 cp "s3://$BUCKET/$S3_PREFIX/" "s3://$BUCKET/$S3_PREFIX/" `
    --recursive `
    --exclude "*" `
    --include "*.css" `
    --metadata-directive REPLACE `
    --content-type "text/css" `
    --cache-control "max-age=31536000,immutable"

# index.html sin caché para que siempre obtenga la versión más nueva
aws s3 cp "s3://$BUCKET/$S3_PREFIX/index.html" "s3://$BUCKET/$S3_PREFIX/index.html" `
    --metadata-directive REPLACE `
    --content-type "text/html" `
    --cache-control "no-cache,no-store,must-revalidate"

# 4. Invalidar caché de CloudFront
Write-Host "`n[4/4] Invalidando caché de CloudFront..." -ForegroundColor Cyan
aws cloudfront create-invalidation `
    --distribution-id $CF_DIST_ID `
    --paths "/$S3_PREFIX/*"

Write-Host "`n✅ Deploy completado!" -ForegroundColor Green
Write-Host "Espera 1-2 minutos a que CloudFront propague los cambios." -ForegroundColor Yellow
Write-Host "URL: https://dsm1cwmosama.cloudfront.net/$S3_PREFIX/" -ForegroundColor Yellow
