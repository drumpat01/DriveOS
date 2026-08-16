param([switch]$SkipTests)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Assert-ReleaseCondition {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

foreach ($RelativePath in @(
    'DriveOS-Server.ps1', 'Dockerfile', 'render.yaml', 'version.json',
    'web\build.json', 'web\service-worker.js', 'web\index.html', 'deploy-files.json'
)) {
    Assert-ReleaseCondition (Test-Path (Join-Path $Root $RelativePath) -PathType Leaf) `
        "Required release file is missing: $RelativePath"
}

& (Join-Path $PSScriptRoot 'Sync-Version.ps1') -Check

$Render = Get-Content (Join-Path $Root 'render.yaml') -Raw
Assert-ReleaseCondition ($Render -match '(?m)^\s*branch:\s*main\s*$') `
    'render.yaml must deploy from main.'

if (Test-Path (Join-Path $Root '.git')) {
    $TrackedFiles = @(& git -C $Root ls-files)
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect tracked files.' }
    $ForbiddenTracked = @($TrackedFiles | Where-Object {
        $_ -match '(^|/)(data|artifacts|update-backups|WebView2Profile|webview2profile)/' -or
        $_ -match '(?i)\.(exe|pdb|zip|log|pfx|p12|pem|key|snk)$' -or
        ($_.ToLowerInvariant() -ne '.env.example' -and
            $_ -match '(?i)(^|/)(\.env(?:\..*)?|.*token.*|.*secret.*\.json)$')
    })
    Assert-ReleaseCondition ($ForbiddenTracked.Count -eq 0) `
        "Forbidden private or generated files are tracked: $($ForbiddenTracked -join ', ')"
}

$MojibakeFiles = @()
foreach ($File in @(Get-ChildItem (Join-Path $Root 'web') -Recurse -File -Include *.html,*.js,*.css,*.json)) {
    $Text = Get-Content $File.FullName -Raw -Encoding UTF8
    if ($Text.Contains([char]0xFFFD) -or $Text.Contains([char]0x00C3) -or $Text.Contains([char]0x00C2)) {
        $MojibakeFiles += $File.FullName.Substring($Root.Length + 1)
    }
}
Assert-ReleaseCondition ($MojibakeFiles.Count -eq 0) `
    "Possible mojibake detected in: $($MojibakeFiles -join ', ')"

if (-not $SkipTests) {
    foreach ($Test in @(
        'tests\WebHostingPrep.Tests.ps1', 'tests\WebAuth.Tests.ps1',
        'tests\WebSession.Tests.ps1', 'tests\WebRequest.Tests.ps1',
        'tests\SecretProtection.Tests.ps1', 'tests\Turso.Tests.ps1',
        'tests\DashboardLayout.Tests.ps1',
        'tests\Assistant.Tests.ps1',
        'tests\ListeningHistoryDedup.Tests.ps1',
        'tests\LastFmImport.Tests.ps1',
        'tests\YouTubeMusicImport.Tests.ps1',
        'tests\SoundtrackBackfill.Tests.ps1',
        'tests\DatabaseArchitecture.Tests.ps1',
        'tests\JourneyCollections.Tests.ps1',
        'tests\JourneyAttachments.Tests.ps1',
        'tests\Passkeys.Tests.ps1',
        'tests\MobilityGraph.Tests.ps1',
        'tests\TimelineImport.Tests.ps1',
        'tests\TessieIngestion.Tests.ps1',
        'tests\TessieReadiness.Tests.ps1',
        'tests\TursoRehearsal.Tests.ps1',
        'tests\TessieParity.Tests.ps1',
        'tests\SpotifyScheduledSync.Tests.ps1',
        'tests\WebDeployment.Tests.ps1'
    )) {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root $Test)
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
}

Write-Host 'DriveOS release preflight passed.' -ForegroundColor Green
