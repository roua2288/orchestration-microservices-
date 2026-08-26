param(
    [string]$Tag = "v2"
)

$ErrorActionPreference = "Stop"

$AccountId = "136609826386"
$Region = "eu-west-3"
$Registry = "$AccountId.dkr.ecr.$Region.amazonaws.com"
$DockerConfig = "$env:TEMP\ecr-auth-clean"

# Liste des microservices
$services = @(
    "frontend",
    "backend",
    "user-service",
    "product-service",
    "order-service",
    "payment-service",
    "notification-service"
)

Write-Host "Recuperation du jeton ECR..."

# Recuperation du token d'authentification ECR
$Token = aws ecr get-authorization-token `
    --region $Region `
    --query "authorizationData[0].authorizationToken" `
    --output text

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($Token)) {
    throw "Impossible de recuperer le jeton ECR."
}

# Creation d'une configuration Docker temporaire
Remove-Item $DockerConfig -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $DockerConfig | Out-Null

$config = @{
    auths = @{
        $Registry = @{
            auth = $Token.Trim()
        }
    }
}

$config |
ConvertTo-Json -Depth 5 |
Set-Content "$DockerConfig\config.json" -Encoding ascii

# Build et push de chaque microservice
foreach ($service in $services) {

    $LocalImage = "${service}:$Tag"
    $EcrImage = "$Registry/${service}:$Tag"
    if ($service -eq "frontend") {
        $Context = ".\frontend-app"
    }
    else {
        $Context = ".\services\$service"
    }

    Write-Host "`n=== Build de $service ==="

    docker build `
        --provenance=false `
        --sbom=false `
        -t $LocalImage `
        $Context

    if ($LASTEXITCODE -ne 0) {
        throw "Echec du build de $service."
    }

    Write-Host "Tag de l'image : $EcrImage"

    docker tag $LocalImage $EcrImage

    if ($LASTEXITCODE -ne 0) {
        throw "Echec du tag de $service."
    }

    Write-Host "Push vers Amazon ECR..."

    docker --config $DockerConfig push $EcrImage

    if ($LASTEXITCODE -ne 0) {
        throw "Echec du push de $service."
    }

    Write-Host "$service pousse avec succes."
}

# Nettoyage de la configuration Docker temporaire
Remove-Item $DockerConfig -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`nTous les microservices ont ete construits et pousses vers ECR."