param([string]$NodePath=$env:DRIVEOS_NODE)
$ErrorActionPreference='Stop';$Root=Split-Path -Parent $PSScriptRoot
$index=Get-Content (Join-Path $Root 'web\index.html') -Raw
$scripts=@([regex]::Matches($index,'<script[^>]+src="(/[^"?]+\.js)')|ForEach-Object{$_.Groups[1].Value})
foreach($src in $scripts){$file=Join-Path (Join-Path $Root 'web') $src.TrimStart('/').Replace('/','\');if(-not(Test-Path -LiteralPath $file)){throw "Missing frontend module: $src"}}
$required=@('/core/build.js','/core/dom.js','/core/state.js','/core/platform.js','/core/api.js','/components/song-artwork.js','/features/navigation.js','/features/pwa.js','/features/theme.js','/features/ignition.js','/features/places.js','/features/charging.js','/features/recaps.js','/features/refresh.js','/features/drives.js','/features/replay.js','/features/music.js','/features/share-cards.js','/app.js')
foreach($src in $required){if($scripts -notcontains $src){throw "Required frontend module is not loaded: $src"}}
for($i=1;$i -lt $required.Count;$i++){if([array]::IndexOf($scripts,$required[$i-1]) -ge [array]::IndexOf($scripts,$required[$i])){throw "Frontend module order changed near $($required[$i])."}}
$app=Get-Content (Join-Path $Root 'web\app.js') -Raw
foreach($legacy in @('function initializePwa','function showView','function applyDriveOSTheme','function runDriveOSIgnition','const state = {')){if($app.Contains($legacy)){throw "Extracted frontend implementation returned to app.js: $legacy"}}
foreach($modalId in @('openPlaceNamesModal','placeNamesModal','placeNamesList')){if($index -notmatch ('id="'+$modalId+'"')){throw "Friendly places modal control is missing: $modalId"}}
foreach($shareId in @('shareCardButton','shareCardModal','shareCardCanvas','shareCardDownload')){if($index -notmatch ('id="'+$shareId+'"')){throw "Share card control is missing: $shareId"}}
if($index -notmatch 'Home privacy is locked on'){throw 'Share-card Home privacy lock is missing.'}
if($index -notmatch '>Share to X<'){throw 'Share-card X action is missing.'}
$shareCards=Get-Content (Join-Path $Root 'web\features\share-cards.js') -Raw
if($shareCards -notmatch 'https://x\.com/intent/tweet'){throw 'Official X Web Intent fallback is missing.'}
if($shareCards -notmatch 'tiles\.openfreemap\.org/styles/liberty'){throw 'Share-card map overview is missing.'}
if($index -notmatch 'data-close-place-modal'){throw 'Friendly places modal backdrop/close control is missing.'}
foreach($searchId in @('driveSearchInput','driveAdvancedToggle','driveAdvancedFilters')){if($index -notmatch ('id="'+$searchId+'"')){throw "Drive search control is missing: $searchId"}}
if($index -notmatch 'id="driveAdvancedFilters"[^>]*hidden'){throw 'Advanced drive filters must be collapsed initially.'}
if($index -notmatch 'placeholder="Enter a city or state'){throw 'The primary drive search is not labeled for city/state search.'}
$styles=Get-Content (Join-Path $Root 'web\styles.css') -Raw
if($styles -notmatch '(?s)\.topbar-right \.theme-switcher\s*\{[^}]*display:\s*inline-flex\s*!important'){throw 'The theme switcher is not restored in the mobile header.'}
foreach($metricClass in @('drive-stat-distance','drive-stat-duration','drive-stat-battery','drive-stat-soundtrack','drive-stat-energy')){if($app -notmatch $metricClass){throw "Drive-card metric class is missing: $metricClass"}}
if($styles -notmatch '(?s)\.dashboard-drive-card\s*>\s*\.v3-drive-play\s*\{[^}]*width:\s*48px\s*!important;[^}]*height:\s*48px\s*!important;[^}]*border-radius:\s*50%\s*!important'){throw 'The mobile dashboard play control is no longer locked to a circle.'}
if($styles -notmatch '(?s)\.drive-card:not\(\.dashboard-drive-card\)\s*>\s*\.drive-stat-battery,\s*\.drive-card:not\(\.dashboard-drive-card\)\s*>\s*\.drive-stat-energy\s*\{[^}]*display:\s*none\s*!important'){throw 'Secondary mobile telemetry is no longer reserved for drive details.'}
$desktopHost=Get-Content (Join-Path $Root 'desktop\Program.cs') -Raw;$ignition=Get-Content (Join-Path $Root 'web\features\ignition.js') -Raw
if($desktopHost -match 'runDriveOSIgnition' -and $ignition -notmatch 'window\.runDriveOSIgnition\s*=\s*run'){throw 'Desktop ignition compatibility shim is missing.'}
$serviceWorker=Get-Content (Join-Path $Root 'web\service-worker.js') -Raw;if($serviceWorker -notmatch 'pathname\.endsWith\("\.js"\)'){throw 'Service worker no longer treats feature modules as network-only.'}
if(-not $NodePath){$node=Get-Command node.exe -ErrorAction SilentlyContinue;if($node){$NodePath=$node.Source}}
if($NodePath){
    & $NodePath (Join-Path $PSScriptRoot 'frontend-modules.test.js');if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
    & $NodePath (Join-Path $PSScriptRoot 'startup-refresh.test.js');if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
}else{Write-Warning 'Node.js unavailable; runtime module tests skipped.'}
Write-Host 'Phase 3 module and load-order tests passed.'
