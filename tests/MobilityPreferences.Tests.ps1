$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.MobilityPreferences.psm1') -Force
function Assert-True([bool]$Condition,[string]$Message){if(-not $Condition){throw $Message}}
function Assert-Equal($Actual,$Expected,[string]$Message){if($Actual-ne$Expected){throw "$Message Expected '$Expected', got '$Actual'."}}

$Scratch = Join-Path ([IO.Path]::GetTempPath()) ('journeydeck-mobility-preferences-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $Scratch | Out-Null
try {
    $Repository = New-DriveOSRepository -DataDirectory $Scratch -AppRoot $Root -Provider Json
    $Record = [PSCustomObject]@{
        version=1;updatedAt='2026-08-16T06:00:00Z'
        places=@([PSCustomObject]@{nodeId='place-0123456789ab';name='School';category='work'})
        routines=@([PSCustomObject]@{routineId='routine-0123456789ab';status='confirmed';type='school-run';customName=''})
    }
    Set-DriveOSMobilityPreferencesRecord -Repository $Repository -Preferences $Record
    $Saved = Get-DriveOSMobilityPreferencesRecord -Repository $Repository
    Assert-Equal $Saved.places[0].name 'School' 'Place correction was not persisted.'
    Assert-Equal $Saved.routines[0].type 'school-run' 'Routine confirmation was not persisted.'
    $Saved = Set-MobilityPlacePreference -Repository $Repository -Candidate ([PSCustomObject]@{nodeId='place-0123456789ab';name='Nicholas School';category='family'})
    Assert-Equal $Saved.places.Count 1 'Updating a place correction created a duplicate.'
    Assert-Equal $Saved.places[0].category 'family' 'Updated place category was not persisted.'
    $Saved = Set-MobilityRoutinePreference -Repository $Repository -Candidate ([PSCustomObject]@{routineId='routine-0123456789ab';status='confirmed';type='custom';customName='Morning school loop'})
    Assert-Equal $Saved.routines.Count 1 'Updating a routine confirmation created a duplicate.'
    Assert-Equal $Saved.routines[0].customName 'Morning school loop' 'Custom routine name was not persisted.'
    try { Set-MobilityPlacePreference -Repository $Repository -Candidate ([PSCustomObject]@{nodeId='forged';name='Bad';category='home'}); throw 'Expected invalid place ID failure.' } catch { Assert-True ($_.Exception.Message -match 'valid mobility place ID') 'Forged place ID did not fail safely.' }
    try { Set-MobilityRoutinePreference -Repository $Repository -Candidate ([PSCustomObject]@{routineId='routine-0123456789ab';status='confirmed';type='custom';customName='' }); throw 'Expected custom name failure.' } catch { Assert-True ($_.Exception.Message -match 'Custom routine name') 'Empty custom routine name did not fail safely.' }
}
finally { if(Test-Path -LiteralPath $Scratch){Remove-Item -LiteralPath $Scratch -Recurse -Force} }

$RepositorySource = Get-Content (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Raw
$PreferenceSource = Get-Content (Join-Path $Root 'src\Application\DriveOS.MobilityPreferences.psm1') -Raw
$Server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
$Frontend = Get-Content (Join-Path $Root 'web\features\mobility-graph.js') -Raw
Assert-True ($RepositorySource -match "Get-DriveOSTursoState.+mobility-preferences") 'Turso mobility preferences do not use durable app state.'
Assert-True ($RepositorySource -match "Get-DriveOSSqliteState.+mobility-preferences") 'SQLite mobility preferences do not use durable app state.'
Assert-True ($Server -match '"/api/mobility/place"' -and $Server -match '"/api/mobility/routine"') 'Mobility correction endpoints are missing.'
Assert-True ($PreferenceSource -match "'home','work','family','errands','dining','wellness','other'") 'Place category validation is missing.'
Assert-True ($PreferenceSource -match "'commute','school-run','family-visit','errand-loop','custom'") 'Routine type validation is missing.'
Assert-True ($Frontend -match 'Save identity' -and $Frontend -match 'Is this a routine') 'Mobility correction controls are missing.'
Write-Host 'Mobility preference persistence and controls checks passed.' -ForegroundColor Green
