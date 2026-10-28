# deploy.ps1 - Script Automatizado de Despliegue para Finca La Leonora
param (
    [string]$GitHubRepoUrl,
    [string]$NeonDatabaseUrl
)

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "🚀 DESPLIEGUE AUTOMATIZADO - FINCA LA LEONORA" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

# 1. Configurar DATABASE_URL en .env si fue proporcionada
if ($NeonDatabaseUrl) {
    Write-Host "📌 Configurando cadena de conexión Neon en .env..." -ForegroundColor Cyan
    "PORT=8080`nDATABASE_URL=$NeonDatabaseUrl" | Out-File -Encoding utf8 .env
    Write-Host "✅ .env actualizado con éxito." -ForegroundColor Green
}

# 2. Configurar remoto de GitHub y hacer push
if ($GitHubRepoUrl) {
    Write-Host "📌 Vinculando con repositorio remoto de GitHub: $GitHubRepoUrl..." -ForegroundColor Cyan
    git remote remove origin 2>$null
    git remote add origin $GitHubRepoUrl
    git branch -M main
    Write-Host "📌 Subiendo archivos a GitHub..." -ForegroundColor Cyan
    git push -u origin main
    Write-Host "✅ Código subido exitosamente a GitHub." -ForegroundColor Green
} else {
    Write-Host "ℹ️ No especificaste GitHubRepoUrl. El repositorio Git local está listo con commit inicial." -ForegroundColor Yellow
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "🎉 Proceso finalizado." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
