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
    $Three=Save-JourneyCollection -Repository $Repository -Name 'City after dark' -Description 'Late city routes' -DriveIds @('drive-5','drive-6')
    $Four=Save-JourneyCollection -Repository $Repository -Name 'Night soundtrack' -Description 'Music after sunset' -DriveIds @('drive-7','drive-8')
    $AsOf=[DateTimeOffset]::UtcNow
    $ContextDrives=@(
        [pscustomobject]@{id='drive-1';startedAt=$AsOf.AddDays(-18).AddHours(-7).ToString('o');startingLocation='Home';endingLocation='Mountain';miles=18;songCount=2},
        [pscustomobject]@{id='drive-2';startedAt=$AsOf.AddDays(-16).AddHours(-7).ToString('o');startingLocation='Mountain';endingLocation='Home';miles=19;songCount=2},
        [pscustomobject]@{id='drive-3';startedAt=$AsOf.AddDays(-14).AddHours(-7).ToString('o');startingLocation='Home';endingLocation='Office';miles=8;songCount=1},
        [pscustomobject]@{id='drive-4';startedAt=$AsOf.AddDays(-12).AddHours(-7).ToString('o');startingLocation='Office';endingLocation='Home';miles=8;songCount=1},
        [pscustomobject]@{id='drive-5';startedAt=$AsOf.AddDays(-10).Date.AddHours(21).ToString('o');startingLocation='Home';endingLocation='Downtown';miles=12;songCount=4;soundtrack=@([pscustomobject]@{artist='Nova Lane'})},
        [pscustomobject]@{id='drive-6';startedAt=$AsOf.AddDays(-8).Date.AddHours(22).ToString('o');startingLocation='Downtown';endingLocation='Home';miles=13;songCount=5;soundtrack=@([pscustomobject]@{artist='Nova Lane'})},
        [pscustomobject]@{id='drive-7';startedAt=$AsOf.AddDays(-6).Date.AddHours(21).ToString('o');startingLocation='Home';endingLocation='Downtown';miles=11;songCount=3;soundtrack=@([pscustomobject]@{artist='Nova Lane'})},
        [pscustomobject]@{id='drive-8';startedAt=$AsOf.AddDays(-4).Date.AddHours(23).ToString('o');startingLocation='Downtown';endingLocation='Home';miles=14;songCount=6;soundtrack=@([pscustomobject]@{artist='Nova Lane'})}
    )
    $Suggestions=@(Update-JourneyMemorySuggestions -Repository $Repository -Collections @($One,$Two,$Three,$Four) -Drives $ContextDrives -AsOfUtc $AsOf)
    Assert-True (@($Suggestions|Where-Object kind -eq memory).Count -eq 1) 'Memory suggestion was not generated from real collections.'
    Assert-True (@($Suggestions|Where-Object kind -eq collection).Count -eq 1) 'Collection suggestion was not generated from real journeys.'
    $Suggestion=@($Suggestions|Where-Object kind -eq memory|Select-Object -First 1)[0]
    Assert-True ($Suggestion.payload.collectionIds.Count -ge 2 -and $Suggestion.payload.journeyCount -ge 2 -and $Suggestion.payload.signals.Count -ge 1) 'Memory suggestion lacks contextual Collection and Journey evidence.'
    Set-JourneyMemorySuggestionStatus -Repository $Repository -SuggestionId $Suggestion.id -Status dismissed|Out-Null
    $Suppressed=@(Update-JourneyMemorySuggestions -Repository $Repository -Collections @($One,$Two,$Three,$Four) -Drives $ContextDrives -AsOfUtc $AsOf.AddDays(29))
    Assert-True (-not @($Suppressed|Where-Object id -eq $Suggestion.id).Count) 'A dismissed suggestion returned before 30 days.'
    Assert-Equal @(Get-JourneyMemorySuggestions -Repository $Repository -Status dismissed).Count 1 'Suggestion dismissal did not remain durable after refresh.'
    $Revived=@(Update-JourneyMemorySuggestions -Repository $Repository -Collections @($One,$Two,$Three,$Four) -Drives $ContextDrives -AsOfUtc $AsOf.AddDays(31)|Where-Object id -eq $Suggestion.id)
    Assert-Equal $Revived.Count 1 'A dismissed suggestion did not become eligible after 30 days.'
    $Confirmed=Save-JourneyMemory -Repository $Repository -Name $Revived[0].title -Notes $Revived[0].description -ArtworkKey $Revived[0].payload.artworkKey -CollectionIds @($Revived[0].payload.collectionIds) -SuggestionId $Revived[0].id
    Assert-Equal @(Get-JourneyMemorySuggestions -Repository $Repository -Status accepted).Count 1 'Saving a confirmed suggestion did not accept it durably.'
    $AfterAcceptance=@(Update-JourneyMemorySuggestions -Repository $Repository -Collections @($One,$Two,$Three,$Four) -Drives $ContextDrives -AsOfUtc $AsOf.AddDays(62))
    Assert-True (-not @($AfterAcceptance|Where-Object id -eq $Suggestion.id).Count) 'An accepted suggestion was generated again.'
    Remove-JourneyMemory -Repository $Repository -MemoryId $Memory.id|Out-Null
    Remove-JourneyMemory -Repository $Repository -MemoryId $Confirmed.id|Out-Null
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
$MomentsClient=Get-Content (Join-Path $Root 'web\features\moments.js') -Raw
$CollectionsClient=Get-Content (Join-Path $Root 'web\features\collections.js') -Raw
$Index=Get-Content (Join-Path $Root 'web\index.html') -Raw
$MomentsCss=Get-Content (Join-Path $Root 'web\moments.css') -Raw
$Styles=Get-Content (Join-Path $Root 'web\styles.css') -Raw
$MemoriesModule=Get-Content (Join-Path $Root 'src\Application\DriveOS.Memories.psm1') -Raw
Assert-True ($MomentsClient.Contains('/api/memories') -and $MomentsClient.Contains('/api/memories/save')) 'Moments still uses session-only Memory drafts instead of the durable API.'
Assert-True ($MomentsClient.Contains('/api/memories/attachments/add') -and $MomentsClient.Contains('/api/collections/attachments/get')) 'Memory and inherited Collection hero images are not wired to durable attachments.'
Assert-True ($MomentsClient.Contains('memoryEditCollectionResults') -and $MomentsClient.Contains('data-choose-memory-collection')) 'Memory editing lacks searchable saved-collection selection.'
Assert-True ($MomentsClient.Contains('openCollectionPicker') -and $MomentsClient.Contains('renderCollectionPickerResults') -and $MomentsClient.Contains('addJourneyToExistingCollection') -and $MomentsClient.Contains('data-add-existing-collection')) 'Moments lacks the desktop Add to Collection chooser and durable saved-collection results.'
Assert-True ($MomentsClient.Contains('state.collections.filter') -and $MomentsClient.Contains('source: "moments-existing"') -and -not $MomentsClient.Contains('Preview only')) 'Add to Existing is not backed by live Collections and durable journey assignment.'
Assert-True ($Index.Contains('momentsCollectionPickerChoice') -and $Index.Contains('momentsCollectionPickerSearch') -and $Index.Contains('MATCHING COLLECTIONS')) 'Moments collection picker markup is incomplete.'
Assert-True ($Index.Contains('data-moments-search="memories"') -and $Index.Contains('data-moments-search="collections"') -and $Index.Contains('data-moments-search="journeys"')) 'Moments is missing one or more category search controls.'
Assert-True ($MomentsClient.Contains('applyMemorySearch') -and $MomentsClient.Contains('applyCollectionSearch') -and $MomentsClient.Contains('is-filter-dimmed')) 'Moments category search is not wired to live filtering and dimming.'
Assert-True ($MomentsCss.Contains('.moments-section-search.is-open') -and $MomentsCss.Contains('.moments-journey-row.is-filter-dimmed')) 'Moments category search styling is incomplete.'
Assert-True ($MomentsClient.Contains('isLocalPreview') -and $MomentsClient.Contains('orderedPreviewRecords')) 'Localhost no longer preserves the complete Memory preview carousel alongside saved data.'
Assert-True ($Index.Contains('id="momentsMemoriesHeading" class="moments-level-label sr-only"')) 'The redundant visible Memories section heading returned.'
Assert-True ($MomentsClient.Contains('collectionChevron') -and $MomentsClient.Contains('M7 4l6 6-6 6') -and $MomentsCss.Contains('.moments-collection-card > i svg')) 'Collection-card chevrons are not using a truly centered vector path.'
Assert-True ($Index.Contains('M13 4l-6 6 6 6') -and $Index.Contains('M7 4l6 6-6 6') -and $MomentsCss.Contains('.moments-carousel-arrow svg')) 'Carousel chevrons are not using centered vector paths.'
Assert-True ($MomentsClient.Contains('data-confirm-memory-suggestion') -and $MomentsClient.Contains('data-dismiss-memory-suggestion') -and $MomentsClient.Contains('confirmMemorySuggestion') -and $MomentsClient.Contains('dismissMemorySuggestion')) 'Memory suggestions do not expose confirm and dismiss actions.'
Assert-True ($MemoriesModule.Contains('Get-JourneyMemoryContextScore') -and $MemoriesModule.Contains("AddDays(-30)") -and $MemoriesModule.Contains("Status stale")) 'Contextual Memory generation or its 30-day suppression lifecycle is missing.'
Assert-True ($MomentsClient.Contains('data-view-memory-collection') -and $MomentsClient.Contains('memory-edit-collection-view')) 'Memory editing does not provide a distinct Collection overview action.'
Assert-True ($MomentsClient.Contains('refreshMemoryCollectionSearch') -and $MomentsClient.Contains('api.get("/api/collections")')) 'Memory editing does not refresh its search from saved Collections.'
Assert-True ($MomentsCss.Contains('#memoryEditAddCollection') -and $MomentsCss.Contains(':root[data-theme] .memory-photo-picker:focus-within')) 'Memory editor Collection and photo actions are still inheriting the old theme.'
Assert-True ($MomentsCss.Contains('.journey-story-modal { z-index: 2147483150 !important; }') -and $MomentsCss.Contains('#journeyCollectionModal { z-index: 2147483175 !important; }')) 'Collection View cannot layer safely over an in-progress Memory edit.'
Assert-True ($Styles.Contains('.modal-close {') -and $Styles.Contains('z-index: 20;')) 'Layered modal close controls can be covered by Collection or Memory hero artwork.'
Assert-True ($MomentsClient.Contains('saveCreatedCollection') -and $MomentsClient.Contains('/api/collections/save') -and $MomentsClient.Contains('/api/collections/attachments/add')) 'The Moments collection canvas does not durably save collections and their photos.'
Assert-True ($MomentsClient.Contains('name: file.name, file, url: URL.createObjectURL(file)')) 'Create Collection drops the selected File before its durable photo upload.'
Assert-True (-not $MomentsClient.Contains('is ready to create with')) 'The create-collection canvas still reports preview-only behavior.'
Assert-True ($MomentsClient.Contains('openCreateCollection') -and $MomentsClient.Contains('renderCreateJourneyLists') -and $MomentsClient.Contains('pickerSelectedJourneyIds')) 'Create Collection lacks interactive journey selection and live totals.'
Assert-True ($Index.Contains('momentsCollectionCreate') -and $Index.Contains('momentsCreatePhotos') -and $Index.Contains('momentsCreateJourneySearch')) 'Create Collection canvas markup is incomplete.'
Assert-True ($CollectionsClient.Contains('journeydeck:collectionchanged')) 'Collection edits do not notify Moments to refresh names, counts, and artwork.'
Assert-True ($Index.Contains('Saved privately to your JourneyDeck account') -and -not $Index.Contains('changes last for this browser session')) 'The Memory editor still describes saved changes as session-only.'
Write-Host 'JourneyDeck Memory model checks passed.' -ForegroundColor Green
