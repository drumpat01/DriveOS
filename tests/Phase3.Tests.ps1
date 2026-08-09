param([string]$NodePath=$env:DRIVEOS_NODE)
$ErrorActionPreference='Stop';$Root=Split-Path -Parent $PSScriptRoot
$index=Get-Content (Join-Path $Root 'web\index.html') -Raw
$scripts=@([regex]::Matches($index,'<script[^>]+src="(/[^"?]+\.js)')|ForEach-Object{$_.Groups[1].Value})
foreach($src in $scripts){$file=Join-Path (Join-Path $Root 'web') $src.TrimStart('/').Replace('/','\');if(-not(Test-Path -LiteralPath $file)){throw "Missing frontend module: $src"}}
$required=@('/core/build.js','/core/dom.js','/core/state.js','/core/platform.js','/core/api.js','/components/song-artwork.js','/features/navigation.js','/features/pwa.js','/features/theme.js','/features/ignition.js','/features/places.js','/features/charging.js','/features/recaps.js','/features/refresh.js','/features/drives.js','/features/replay.js','/app.js')
foreach($src in $required){if($scripts -notcontains $src){throw "Required frontend module is not loaded: $src"}}
for($i=1;$i -lt $required.Count;$i++){if([array]::IndexOf($scripts,$required[$i-1]) -ge [array]::IndexOf($scripts,$required[$i])){throw "Frontend module order changed near $($required[$i])."}}
$app=Get-Content (Join-Path $Root 'web\app.js') -Raw
foreach($legacy in @('function initializePwa','function showView','function applyDriveOSTheme','function runDriveOSIgnition','const state = {')){if($app.Contains($legacy)){throw "Extracted frontend implementation returned to app.js: $legacy"}}
$desktopHost=Get-Content (Join-Path $Root 'desktop\Program.cs') -Raw;$ignition=Get-Content (Join-Path $Root 'web\features\ignition.js') -Raw
if($desktopHost -match 'runDriveOSIgnition' -and $ignition -notmatch 'window\.runDriveOSIgnition=run'){throw 'Desktop ignition compatibility shim is missing.'}
$serviceWorker=Get-Content (Join-Path $Root 'web\service-worker.js') -Raw;if($serviceWorker -notmatch 'pathname\.endsWith\("\.js"\)'){throw 'Service worker no longer treats feature modules as network-only.'}
if(-not $NodePath){$node=Get-Command node.exe -ErrorAction SilentlyContinue;if($node){$NodePath=$node.Source}}
if($NodePath){& $NodePath (Join-Path $PSScriptRoot 'frontend-modules.test.js');if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}}else{Write-Warning 'Node.js unavailable; runtime module tests skipped.'}
Write-Host 'Phase 3 module and load-order tests passed.'
