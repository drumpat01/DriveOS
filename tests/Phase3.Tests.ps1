param([string]$NodePath=$env:DRIVEOS_NODE)
$ErrorActionPreference='Stop';$Root=Split-Path -Parent $PSScriptRoot
$index=Get-Content (Join-Path $Root 'web\index.html') -Raw
$scripts=@([regex]::Matches($index,'<script[^>]+src="(/[^"?]+\.js)')|ForEach-Object{$_.Groups[1].Value})
foreach($src in $scripts){$file=Join-Path (Join-Path $Root 'web') $src.TrimStart('/').Replace('/','\');if(-not(Test-Path -LiteralPath $file)){throw "Missing frontend module: $src"}}
$required=@('/core/build.js','/core/dom.js','/core/state.js','/core/platform.js','/core/api.js','/components/song-artwork.js','/features/navigation.js','/features/pwa.js','/features/theme.js','/features/ignition.js','/features/places.js','/features/charging.js','/features/recaps.js','/features/refresh.js','/features/drives.js','/features/replay.js','/features/music.js','/features/share-cards.js','/features/command-palette.js','/features/dashboard-customization.js','/features/dashboard-widgets.js','/app.js')
foreach($src in $required){if($scripts -notcontains $src){throw "Required frontend module is not loaded: $src"}}
for($i=1;$i -lt $required.Count;$i++){if([array]::IndexOf($scripts,$required[$i-1]) -ge [array]::IndexOf($scripts,$required[$i])){throw "Frontend module order changed near $($required[$i])."}}
$app=Get-Content (Join-Path $Root 'web\app.js') -Raw
if($app -notmatch 'toLocaleDateString\("en-US"' -or $app -notmatch 'month:\s*"2-digit"' -or $app -notmatch 'year:\s*"numeric"'){throw 'Desktop header date is not using compact MM/DD/YYYY formatting.'}
foreach($legacy in @('function initializePwa','function showView','function applyDriveOSTheme','function runDriveOSIgnition','const state = {')){if($app.Contains($legacy)){throw "Extracted frontend implementation returned to app.js: $legacy"}}
foreach($modalId in @('openPlaceNamesModal','placeNamesModal','placeNamesList')){if($index -notmatch ('id="'+$modalId+'"')){throw "Friendly places modal control is missing: $modalId"}}
foreach($shareId in @('shareCardButton','shareCardModal','shareCardCanvas','shareCardDownload')){if($index -notmatch ('id="'+$shareId+'"')){throw "Share card control is missing: $shareId"}}
foreach($commandId in @('commandPaletteButton','commandPalette','commandPaletteInput','commandPaletteResults')){if($index -notmatch ('id="'+$commandId+'"')){throw "Command palette control is missing: $commandId"}}
foreach($dashboardId in @('dashboardCustomizeButton','dashboardCustomizer','dashboardCustomizerList','dashboardWidgetGrid')){if($index -notmatch ('id="'+$dashboardId+'"')){throw "Dashboard customization control is missing: $dashboardId"}}
foreach($widgetId in @('todayDrivingMiles','dashboardSoundtrack')){if($index -notmatch ('id="'+$widgetId+'"')){throw "Dashboard insight widget is missing: $widgetId"}}
$commandPalette=Get-Content (Join-Path $Root 'web\features\command-palette.js') -Raw
if($commandPalette -notmatch 'event\.ctrlKey' -or $commandPalette -notmatch 'ArrowDown' -or $index -notmatch 'Answers use your saved JourneyDeck records'){throw 'Command palette keyboard or privacy behavior is missing.'}
if($commandPalette -notmatch 'looksLikeQuestion' -or $commandPalette -notmatch 'matches\.concat\(askItem\)' -or $commandPalette -notmatch 'relevance\(a, query\)'){throw 'Direct search matches must stay ahead of assistant answers for short queries.'}
$dashboardCustomization=Get-Content (Join-Path $Root 'web\features\dashboard-customization.js') -Raw
foreach($capability in @('localStorage','dashboard-size-compact','pinned','hidden','draggable','dashboard-widget-drag-handle','bindWidgetDropEvents','dashboard-widget-resize-handle','nearestSize','pointerdown','positions','blankDropPosition','dashboardGridDropPreview')){if($dashboardCustomization -notmatch [regex]::Escape($capability)){throw "Dashboard customization capability is missing: $capability"}}
$dashboardWidgets=Get-Content (Join-Path $Root 'web\features\dashboard-widgets.js') -Raw
foreach($capability in @('todaySummary','inferMood','data-dashboard-action','openShareCard','openRecap')){if($dashboardWidgets -notmatch [regex]::Escape($capability)){throw "Dashboard insight widget capability is missing: $capability"}}
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
if($app -notmatch 'tracks\.slice\(1, 21\)' -or $app -notmatch 'v3-recent-scroll' -or $app -notmatch 'v3-recent-columns' -or $styles -notmatch 'dashboard-size-wide\.spotify-panel \.v3-recent-columns'){throw 'Scrollable 20-track Spotify history is missing.'}
if($styles -notmatch '(?s)\.dashboard-size-compact\.spotify-panel \.v3-now-playing\s*\{[^}]*grid-template-columns:\s*112px' -or $styles -notmatch '(?s)\.dashboard-size-compact\.spotify-panel \.v3-recent-list\s*\{[^}]*display:\s*none'){throw 'Compact Spotify Now Playing layout is missing.'}
if($styles -notmatch 'grid-auto-flow:\s*row dense' -or $styles -notmatch 'align-items:\s*stretch' -or $styles -notmatch '(?s)\.dashboard-size-wide\s*\{[^}]*grid-column:\s*1\s*/\s*-1'){throw 'Dashboard size geometry is not standardized.'}
if($styles -notmatch '(?s)\.topbar-right \.theme-switcher\s*\{[^}]*display:\s*inline-flex\s*!important'){throw 'The theme switcher is not restored in the mobile header.'}
if($styles -notmatch 'JourneyDeck 5\.2\.6 - owner mobile bottom navigation' -or $styles -notmatch '@media \(max-width: 1120px\)' -or $styles -notmatch '(?s)\.main-nav\.mobile-nav-portal,\s*body > \.main-nav\s*\{[^}]*border-radius:\s*0\s*!important[^}]*background:\s*rgba\(249,252,253,\.82\)' -or $styles -notmatch '(?s)\.nav-button\.active::after\s*,[^}]*top:\s*0\s*!important'){throw 'Owner phone/tablet navigation is not using the Wife Mode-style bottom bar.'}
if($styles -notmatch '(?s):root\[data-theme="light"\] \.mobile-more-sheet\s*\{[^}]*background:\s*rgba\(249,252,253,\.94\)' -or $styles -notmatch '(?s):root\[data-theme="light"\] \.mobile-more-grid button\s*\{[^}]*color:\s*var\(--text\)'){throw 'The mobile More sheet does not follow the light theme.'}
if($styles -notmatch '(?s)@media \(min-width: 1121px\).*?:root\[data-theme="dark"\] \.main-nav \.nav-button\s*\{[^}]*color:\s*#a9c5cf\s*!important' -or $styles -notmatch '(?s):root\[data-theme="dark"\] \.command-palette-trigger,.*?color:\s*#9fbac4\s*!important'){throw 'Dark desktop header labels do not have sufficient contrast.'}
if($styles -notmatch '(?s):root\[data-theme="dark"\] \.vehicle-charge-summary \.battery-number\s*\{[^}]*color:\s*#eefbff'){throw 'Dark-mode battery percentage contrast is missing.'}
if($styles -notmatch '100dvh - 215px' -or $styles -notmatch 'command-mobile-note' -or $styles -notmatch 'safe-area-inset-top'){throw 'The command palette mobile layout is missing.'}
foreach($mobilePolish in @('data-mobile-label','dashboard-drive-card \{ grid-template-columns: minmax\(0,1fr\) minmax\(0,1fr\) 38px','charging-rate-editor \{ display: grid','background-activity-monitor\.idle \{ display: none','data-theme="light"\] \.live-drive-shell','data-theme="light"\] \.live-drive-overlay')){if(($index + $styles) -notmatch $mobilePolish){throw "Mobile JourneyDeck polish is missing: $mobilePolish"}}
if($index -notmatch 'rel="shortcut icon"[^>]+favicon\.png\?v=5\.2\.2' -or $index -notmatch 'apple-touch-icon[^>]+pwa-180\.png\?v=5\.2\.2'){throw 'Safari favicon and home-screen icon declarations are stale.'}
if($styles -notmatch '(?s)\.dashboard-size-wide\.vehicle-panel \.vehicle-car-art\.vehicle-car-model3\.vehicle-car-photo\s*\{[^}]*width:\s*100%\s*!important[^}]*height:\s*100%\s*!important[^}]*object-fit:\s*contain' -or $styles -notmatch 'vehicle-hero-visual::before'){throw 'Wide dashboard vehicle artwork framing is missing.'}
if($index -notmatch 'id="vehicleLocationMap"' -or $app -notmatch 'renderVehicleLocation' -or $styles -notmatch '(?s)\.dashboard-size-wide\.vehicle-panel \.vehicle-dashboard-main\s*\{[^}]*grid-template-columns:'){throw 'Wide vehicle live-location panel is missing.'}
$desktopHost=Get-Content (Join-Path $Root 'desktop\Program.cs') -Raw;$ignition=Get-Content (Join-Path $Root 'web\features\ignition.js') -Raw
if($desktopHost -match 'runDriveOSIgnition' -and $ignition -notmatch 'window\.runDriveOSIgnition\s*=\s*run'){throw 'Desktop ignition compatibility shim is missing.'}
$serviceWorker=Get-Content (Join-Path $Root 'web\service-worker.js') -Raw;if($serviceWorker -notmatch 'pathname\.endsWith\("\.js"\)'){throw 'Service worker no longer treats feature modules as network-only.'}
if(-not $NodePath){$node=Get-Command node.exe -ErrorAction SilentlyContinue;if($node){$NodePath=$node.Source}}
if($NodePath){
    & $NodePath (Join-Path $PSScriptRoot 'frontend-modules.test.js');if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
    & $NodePath (Join-Path $PSScriptRoot 'startup-refresh.test.js');if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
}else{Write-Warning 'Node.js unavailable; runtime module tests skipped.'}
Write-Host 'Phase 3 module and load-order tests passed.'
