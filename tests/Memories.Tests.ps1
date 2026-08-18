$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Sqlite.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.Collections.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.Attachments.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.Memories.psm1') -Force
Import-Module (Join-Path $Root 'src\Http\DriveOS.Http.psm1') -Force

function Assert-True{param([bool]$Condition,[string]$Message)if(-not $Condition){throw $Message}}
function Assert-Equal{param($Actual,$Expected,[string]$Message)if($Actual -ne $Expected){throw "$Message Expected '$Expected', got '$Actual'."}}

$Scratch=Join-Path ([IO.Path]::GetTempPath()) ('journeydeck-memories-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $Scratch|Out-Null
try{
    $Repository=New-DriveOSRepository -DataDirectory $Scratch -AppRoot $Root -Provider Json
    $One=Save-JourneyCollection -Repository $Repository -Name 'Mountain weekends' -Description 'Mountain drives' -DriveIds @('drive-1','drive-2')
    $Two=Save-JourneyCollection -Repository $Repository -Name 'Favorite night drives' -Description 'Night drives' -DriveIds @('drive-3','drive-4')
    $Memory=Save-JourneyMemory -Repository $Repository -Name 'Summer 2026' -Notes 'Golden days.' -ArtworkKey 'summer-2026' -CollectionIds @($One.id,$Two.id)
    Assert-True ($Memory.id -match '^memory_[a-f0-9]{32}$') 'Memory did not receive a durable ID.'
    Assert-Equal $Memory.collectionIds.Count 2 'Memory collection links did not round-trip.'
    Assert-Equal @(Get-JourneyMemories -Repository $Repository).Count 1 'Memory did not persist.'
    $Created=$Memory.createdAtUtc
    $Updated=Save-JourneyMemory -Repository $Repository -MemoryId $Memory.id -Name 'Summer memories' -Notes 'Updated.' -ArtworkKey 'weekend-escapes' -CollectionIds @($Two.id,$One.id)
    Assert-Equal $Updated.createdAtUtc $Created 'Memory update changed its creation time.'
    Assert-Equal $Updated.collectionIds[0] $Two.id 'Memory collection order was not retained.'
    $Rejected=$false
    try{Save-JourneyMemory -Repository $Repository -Name 'Invalid' -CollectionIds @($One.id)|Out-Null}catch{$Rejected=$_.Exception.Message -like 'A memory must contain*'}
    Assert-True $Rejected 'A one-collection Memory was accepted.'
    $Suggestions=@(Update-JourneyMemorySuggestions -Repository $Repository -Collections @($One,$Two) -Drives @([pscustomobject]@{id='drive-1'},[pscustomobject]@{id='drive-2'}))
    Assert-True (@($Suggestions|Where-Object kind -eq memory).Count -eq 1) 'Memory suggestion was not generated from real collections.'
    Assert-True (@($Suggestions|Where-Object kind -eq collection).Count -eq 1) 'Collection suggestion was not generated from real journeys.'
    $Suggestion=@($Suggestions|Where-Object kind -eq memory|Select-Object -First 1)[0]
    Set-JourneyMemorySuggestionStatus -Repository $Repository -SuggestionId $Suggestion.id -Status dismissed|Out-Null
    Update-JourneyMemorySuggestions -Repository $Repository -Collections @($One,$Two) -Drives @()|Out-Null
    Assert-Equal @(Get-JourneyMemorySuggestions -Repository $Repository -Status dismissed).Count 1 'Suggestion dismissal did not remain durable after refresh.'
    Remove-JourneyMemory -Repository $Repository -MemoryId $Memory.id|Out-Null
    Assert-Equal @(Get-JourneyMemories -Repository $Repository).Count 0 'Memory deletion did not persist.'
}
finally{if(Test-Path -LiteralPath $Scratch){Remove-Item -LiteralPath $Scratch -Recurse -Force}}

$SqliteExecutable=Join-Path $Root 'tools\sqlite\sqlite3.exe'
if(Test-Path -LiteralPath $SqliteExecutable){
    $DbScratch=Join-Path ([IO.Path]::GetTempPath()) ('journeydeck-memory-db-'+[guid]::NewGuid().ToString('N'));New-Item -ItemType Directory -Path $DbScratch|Out-Null
    try{
        $DbRepository=New-DriveOSRepository -DataDirectory $DbScratch -AppRoot $Root -Provider SQLite;Initialize-DriveOSSqlite -Repository $DbRepository
        $DbOne=Save-JourneyCollection -Repository $DbRepository -Name 'City nights' -DriveIds @()
        $DbTwo=Save-JourneyCollection -Repository $DbRepository -Name 'Sunday drives' -DriveIds @()
        $DbMemory=Save-JourneyMemory -Repository $DbRepository -Name 'Weekend escapes' -CollectionIds @($DbOne.id,$DbTwo.id)
        Assert-Equal @(Get-JourneyMemories -Repository $DbRepository).Count 1 'SQLite Memory did not round-trip.'
        $Photo=Add-JourneyMemoryAttachment -Repository $DbRepository -MemoryId $DbMemory.id -FileName 'memory.png' -ContentType 'image/png' -DataBase64 'iVBORw0KGgo='
        $StoredPhoto=@(Get-DriveOSMemoryAttachments -Repository $DbRepository -AttachmentId $Photo.id -IncludeData)
        Assert-Equal $StoredPhoto.Count 1 'SQLite Memory photo did not round-trip.'
        Assert-Equal $StoredPhoto[0].dataBase64 'iVBORw0KGgo=' 'SQLite Memory photo data changed.'
        Remove-JourneyMemory -Repository $DbRepository -MemoryId $DbMemory.id|Out-Null
        Assert-Equal @(Get-DriveOSMemoryAttachments -Repository $DbRepository -AttachmentId $Photo.id).Count 0 'Deleting a Memory did not cascade to its photos.'
    }
    finally{if(Test-Path -LiteralPath $DbScratch){Remove-Item -LiteralPath $DbScratch -Recurse -Force}}
}

$Server=Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
foreach($Route in @('/api/memories','/api/memories/save','/api/memories/delete','/api/memories/suggestions/status','/api/memories/attachments/list','/api/memories/attachments/get','/api/memories/attachments/add','/api/memories/attachments/remove')){Assert-True ($Server.Contains($Route)) "Memory API route is missing: $Route"}
$HttpError=Get-DriveOSHttpError -Message 'A memory must contain at least two collections.'
Assert-Equal $HttpError.statusCode 400 'Memory validation errors must be public bad requests.'
Write-Host 'JourneyDeck Memory model checks passed.' -ForegroundColor Green
