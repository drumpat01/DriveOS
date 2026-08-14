$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Assert-True([bool]$Condition,[string]$Message) {
    if (-not $Condition) { throw $Message }
}

$Server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
$Tokens = $null
$ParseErrors = $null
$Ast = [System.Management.Automation.Language.Parser]::ParseInput($Server,[ref]$Tokens,[ref]$ParseErrors)
Assert-True ($ParseErrors.Count -eq 0) 'DriveOS server has PowerShell syntax errors.'

foreach ($FunctionName in @(
    'ConvertTo-ListeningMatchText',
    'Get-ListeningRecordSource',
    'Test-CrossProviderListeningDuplicate',
    'Remove-CrossProviderListeningDuplicates'
)) {
    $FunctionAst = $Ast.Find({
        param($Node)
        $Node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $Node.Name -eq $FunctionName
    },$true)
    Assert-True ($null -ne $FunctionAst) "Missing listening-history function: $FunctionName"
    Invoke-Expression $FunctionAst.Extent.Text
}

$Base = [DateTimeOffset]::Parse('2026-08-14T12:00:00Z')
function New-Play {
    param([string]$Source,[string]$Track,[string]$Artist,[int]$OffsetSeconds,[int]$DurationMs=180000)
    [PSCustomObject]@{
        id = "$Source|$Track|$OffsetSeconds"
        source = $Source
        track = $Track
        artist = $Artist
        played_at = $Base.AddSeconds($OffsetSeconds).ToString('o')
        duration_ms = $DurationMs
    }
}

$Records = @(
    New-Play -Source lastfm -Track 'Same Song' -Artist 'The Artist' -OffsetSeconds 0
    New-Play -Source spotify -Track 'Same Song' -Artist 'The Artist' -OffsetSeconds 120
    New-Play -Source spotify -Track 'Repeat Song' -Artist 'The Artist' -OffsetSeconds 1000
    New-Play -Source spotify -Track 'Repeat Song' -Artist 'The Artist' -OffsetSeconds 1060
    New-Play -Source lastfm -Track 'Far Apart' -Artist 'The Artist' -OffsetSeconds 2000
    New-Play -Source spotify -Track 'Far Apart' -Artist 'The Artist' -OffsetSeconds 2721
    New-Play -Source lastfm -Track 'Artist Matters' -Artist 'First Artist' -OffsetSeconds 3000
    New-Play -Source spotify -Track 'Artist Matters' -Artist 'Second Artist' -OffsetSeconds 3060
)

$Result = @(Remove-CrossProviderListeningDuplicates -Records $Records)
Assert-True ($Result.Count -eq 7) 'Cross-provider de-duplication changed the number of visible listening events.'
$SameSong = @($Result | Where-Object track -eq 'Same Song')
Assert-True ($SameSong.Count -eq 1 -and $SameSong[0].source -eq 'spotify') 'Spotify no longer replaces its matching legacy Last.fm event.'
Assert-True (@($Result | Where-Object track -eq 'Repeat Song').Count -eq 2) 'Same-provider repeat listens were collapsed.'
Assert-True (@($Result | Where-Object track -eq 'Far Apart').Count -eq 2) 'Events outside the 12-minute maximum window were collapsed.'
Assert-True (@($Result | Where-Object track -eq 'Artist Matters').Count -eq 2) 'Different artists with the same title were collapsed.'

function Remove-CrossProviderListeningDuplicatesReference {
    param([object[]]$ReferenceRecords = @())
    $Kept = New-Object Collections.ArrayList
    foreach ($Record in @($ReferenceRecords | Sort-Object {
        try { [DateTimeOffset]::Parse("$($_.played_at)").UtcTicks }
        catch { 0 }
    })) {
        $DuplicateIndex = -1
        for ($Index = 0; $Index -lt $Kept.Count; $Index++) {
            if (Test-CrossProviderListeningDuplicate -Candidate $Record -ExistingRecord $Kept[$Index]) {
                $DuplicateIndex = $Index
                break
            }
        }
        if ($DuplicateIndex -lt 0) { [void]$Kept.Add($Record); continue }
        if ((Get-ListeningRecordSource -Record $Record) -eq 'spotify') { $Kept[$DuplicateIndex] = $Record }
    }
    return @($Kept)
}

$DifferentialRecords = @()
for ($Index = 0; $Index -lt 240; $Index++) {
    $DifferentialRecords += New-Play `
        -Source @('lastfm','spotify','spotify')[$Index % 3] `
        -Track @('Alpha','Beta','Gamma')[$Index % 3] `
        -Artist @('Artist','Artist','Different Artist')[$Index % 3] `
        -OffsetSeconds (($Index * 137) % 12000) `
        -DurationMs @(180000,240000,420000)[$Index % 3]
}
$ReferenceResult = @(Remove-CrossProviderListeningDuplicatesReference -ReferenceRecords $DifferentialRecords)
$BoundedResult = @(Remove-CrossProviderListeningDuplicates -Records $DifferentialRecords)
Assert-True (
    (@($ReferenceResult | ForEach-Object id) -join "`n") -eq
    (@($BoundedResult | ForEach-Object id) -join "`n")
) 'Bounded de-duplication diverged from the legacy Last.fm/Spotify matching behavior.'

$ManyRecords = @()
for ($Index = 0; $Index -lt 2000; $Index++) {
    $ManyRecords += New-Play -Source spotify -Track 'Recurring Song' -Artist 'The Artist' -OffsetSeconds ($Index * 900)
}
$Stopwatch = [Diagnostics.Stopwatch]::StartNew()
$ManyResult = @(Remove-CrossProviderListeningDuplicates -Records $ManyRecords)
$Stopwatch.Stop()
Assert-True ($ManyResult.Count -eq $ManyRecords.Count) 'Bounded de-duplication removed valid recurring plays.'
Assert-True ($Stopwatch.Elapsed.TotalSeconds -lt 10) 'Listening-history de-duplication is no longer bounded by its 12-minute match window.'

Write-Host 'JourneyDeck listening-history de-duplication checks passed.' -ForegroundColor Green
