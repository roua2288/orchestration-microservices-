param(
    [string]$Profile = "",
    [string]$Region = "eu-west-3"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

if ($Profile) {
    $env:AWS_PROFILE = $Profile
}

if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) {
    throw "Terraform n'est pas installé ou introuvable dans PATH."
}

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    throw "AWS CLI n'est pas installé ou introuvable dans PATH."
}

terraform init -backend=false
terraform apply -auto-approve -input=false -var="region=$Region"

aws eks update-kubeconfig --name orchestration-eks --region $Region --profile $Profile
