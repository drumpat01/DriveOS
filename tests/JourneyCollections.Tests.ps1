$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Sqlite.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.Collections.psm1') -Force
function Assert-True([bool]$Condition,[string]$Message){if(-not $Condition){throw $Message}}
function Assert-Equal($Actual,$Expected,[string]$Message){if($Actual -ne $Expected){throw "$Message Expected '$Expected', got '$Actual'."}}

$Scratch = Join-Path ([IO.Path]::GetTempPath()) ('journeydeck-collections-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $Scratch | Out-Null
try {
    $Repository = New-DriveOSRepository -DataDirectory $Scratch -AppRoot $Root -Provider Json
    $Created = Save-JourneyCollection -Repository $Repository -Name '  Summer roads  ' -Description '  Family drives  ' -DriveIds @('drive-2','drive-1','drive-2')
    Assert-True ($Created.id -match '^collection_[a-f0-9]{32}$') 'Collection ID is not server-generated and stable.'
    Assert-Equal $Created.name 'Summer roads' 'Collection name was not normalized.'
    Assert-Equal $Created.driveIds.Count 2 'Duplicate collection membership was not removed.'
    $Updated = Save-JourneyCollection -Repository $Repository -CollectionId $Created.id -Name 'Summer 2026' -Description '' -DriveIds @('drive-1')
    Assert-Equal $Updated.createdAtUtc $Created.createdAtUtc 'Editing a collection changed its creation time.'
    Assert-Equal @(Get-JourneyCollections -Repository $Repository).Count 1 'Editing a collection created a duplicate.'
    $Deleted = Remove-JourneyCollection -Repository $Repository -CollectionId $Created.id
    Assert-True $Deleted.deleted 'Collection delete did not report success.'
    Assert-Equal @(Get-JourneyCollections -Repository $Repository).Count 0 'Collection delete did not remove the JSON record.'
    try { Save-JourneyCollection -Repository $Repository -Name '' -DriveIds @(); throw 'Expected validation failure.' } catch { Assert-True ($_.Exception.Message -match 'name is required') 'Empty collection name did not fail safely.' }
    try { Save-JourneyCollection -Repository $Repository -CollectionId 'collection_missing' -Name 'Invalid' -DriveIds @(); throw 'Expected validation failure.' } catch { Assert-True ($_.Exception.Message -match 'ID is invalid') 'Forged collection ID did not fail safely.' }
}
finally { if(Test-Path -LiteralPath $Scratch){Remove-Item -LiteralPath $Scratch -Recurse -Force} }

$Server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
$WifeJs = Get-Content (Join-Path $Root 'web\wife.js') -Raw
$Styles = Get-Content (Join-Path $Root 'web\styles.css') -Raw
$Index = Get-Content (Join-Path $Root 'web\index.html') -Raw
$CollectionsJs = Get-Content (Join-Path $Root 'web\features\collections.js') -Raw
Assert-True ($Server -match '"/api/collections"') 'Owner collection read endpoint is missing.'
Assert-True ($Server -match '"/api/collections/save"' -and $Server -match '"/api/collections/delete"') 'Owner collection mutation endpoints are missing.'
Assert-True ($Server -match '"/api/wife/collections"') 'Wife Mode collection read endpoint is missing.'
Assert-True ($WifeJs -match '/api/wife/collections') 'Wife Mode does not load shared collections.'
Assert-True ($WifeJs -notmatch '/api/collections/(save|delete)') 'Wife Mode contains collection mutation behavior.'
Assert-True ($Styles -match '\.journey-collections-panel\s*\{[^}]*padding:\s*24px') 'Journey collections panel lacks a safe desktop content inset.'
Assert-True ($Styles -match '\.journey-collections-panel \.panel-description,[\s\S]*?white-space:\s*normal') 'Journey collections copy can still be clipped instead of wrapping.'
Assert-True ($Styles -match '@media \(max-width:760px\)[^{]*\{[^}]*\.journey-collections-panel\s*\{\s*padding:\s*18px') 'Journey collections panel lacks a responsive content inset.'
Assert-True ($Index -match 'id="journeyStoryModal"' -and $Index -match 'id="journeyStoryMap"' -and $Index -match 'id="journeyStoryPhotos"') 'Collection story modal is missing its photo or map surfaces.'
Assert-True ($CollectionsJs -match 'collectionMusic' -and $CollectionsJs -match 'albumImage' -and $CollectionsJs -match 'TOP ARTIST') 'Collection story does not derive its top artist.'
Assert-True ($CollectionsJs -match 'slice\(0,3\)' -and $CollectionsJs -match '/api/collections/attachments/get') 'Collection story does not load its first attached photos.'
Assert-True ($CollectionsJs -match 'collectionRoutes' -and $CollectionsJs -match 'collection-routes') 'Collection story map overview is missing.'
Assert-True ($Styles -match '@media \(max-width:760px\)[\s\S]*?\.journey-story-grid\s*\{\s*grid-template-columns:1fr') 'Collection story is not responsive on mobile.'
Write-Host 'Journey Collections checks passed.' -ForegroundColor Green
