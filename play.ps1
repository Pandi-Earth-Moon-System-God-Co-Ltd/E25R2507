param(
    [switch]$Verify,
    [switch]$Editor
)

$engineFolder = Join-Path (Split-Path -Parent $PSScriptRoot) 'Godot_v4.8-beta3_win64.exe'
$godot = Join-Path $engineFolder 'Godot_v4.8-beta3_win64.exe'
$console = Join-Path $engineFolder 'Godot_v4.8-beta3_win64_console.exe'

if (-not (Test-Path -LiteralPath $godot -PathType Leaf) -or -not (Test-Path -LiteralPath $console -PathType Leaf)) {
    Write-Error "Godot 4.8 beta 3 was not found in $engineFolder."
    exit 1
}

if ($Editor -and -not $Verify) {
    & $godot --path $PSScriptRoot --editor
    return
}

if ($Verify -or -not (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.godot\imported') -PathType Container)) {
    & $console --headless --path $PSScriptRoot --editor --import
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if ($Verify) {
    & $console --headless --path $PSScriptRoot --script res://tests/camp_smoke.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $console --headless --path $PSScriptRoot --script res://tests/combat_smoke.gd
    exit $LASTEXITCODE
}

& $godot --path $PSScriptRoot
