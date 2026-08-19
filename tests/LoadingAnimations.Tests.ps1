$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot

function Assert-True([bool]$Condition,[string]$Message){if(-not $Condition){throw $Message}}

$Loader=Get-Content (Join-Path $Root 'web\features\loader-concepts.js') -Raw
$Ignition=Get-Content (Join-Path $Root 'web\features\ignition.js') -Raw
$Index=Get-Content (Join-Path $Root 'web\index.html') -Raw
$Navigation=Get-Content (Join-Path $Root 'web\features\navigation.js') -Raw
$VersionSync=Get-Content (Join-Path $Root 'tools\Sync-Version.ps1') -Raw

foreach($Concept in @('pulse','atlas','trace','sync','soundtrack','wave','liner-notes','mixdown')){
  Assert-True ($Loader -match ('id:"'+[regex]::Escape($Concept)+'"')) "Missing rotating loader concept: $Concept"
}
Assert-True ($Loader -match '\(previous\+1\)%concepts\.length') 'Loader refreshes do not cycle through all concepts.'
Assert-True ($Loader -match 'attachShadow\(\{mode:"open"\}\)') 'The live loader is not isolated from application styling.'
Assert-True ($Loader -match 'selected\.markup' -and $Loader -notmatch 'concepts\.map\([^\r\n]+markup') 'The live loader must render only the selected animation.'
Assert-True ($Ignition -match 'JourneyDeckLoader\?\.current\?\.duration' -and $Ignition -match 'Math\.max\(3000, conceptDuration\)') 'Dashboard readiness can still cut the animation short.'
Assert-True ($Loader -match 'visibility:hidden' -and $Loader -match 'addEventListener\("load",\(\)=>settle\(true\)' -and $Loader -match 'loaderVisualReady' -and $Ignition -match 'JourneyDeckLoader\?\.ready') 'Animation must stay hidden until its visual stylesheet is ready.'
Assert-True ($Loader -match 'addEventListener\("error",\(\)=>settle\(false\)' -and $Loader -match 'setTimeout\(\(\)=>settle\(false\),2000\)') 'A failed loader stylesheet must resolve without revealing unstyled artwork.'
Assert-True ($Index -match '(?s)features/loader-concepts\.js.*features/ignition\.js') 'Loader selection must run before the ignition sequence.'
Assert-True ($Navigation -match 'bindLoadingLabEasterEgg' -and $Navigation -match 'activations>=3' -and $Navigation -match 'loading-preview\.html\?v=') 'The hidden three-tap Loading Lab shortcut is missing.'
Assert-True ($VersionSync -match 'loading-preview\.html' -and $VersionSync -match 'loader-concepts\.js') 'Loading Lab assets are outside automatic version synchronization.'

Write-Host 'JourneyDeck rotating loading animation checks passed.' -ForegroundColor Green
