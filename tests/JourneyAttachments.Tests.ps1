$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Sqlite.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.Collections.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.Attachments.psm1') -Force
function Assert-True([bool]$Condition,[string]$Message){if(-not $Condition){throw $Message}}

$Jpeg=[byte[]](0xFF,0xD8,0xFF,0xE0,1,2,3)
Assert-True (Test-JourneyAttachmentSignature -Bytes $Jpeg -ContentType image/jpeg) 'JPEG signature was rejected.'
Assert-True (-not (Test-JourneyAttachmentSignature -Bytes ([byte[]](1,2,3)) -ContentType image/jpeg)) 'Spoofed JPEG was accepted.'
Assert-True (Test-JourneyAttachmentSignature -Bytes ([Text.Encoding]::UTF8.GetBytes('journey notes')) -ContentType text/plain) 'Text attachment was rejected.'
Assert-True (-not (Test-JourneyAttachmentSignature -Bytes ([byte[]](65,0,66)) -ContentType text/plain)) 'Binary content was accepted as text.'

$Server=Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
$Client=Get-Content (Join-Path $Root 'web\features\collections.js') -Raw
$RenderStart=Get-Content (Join-Path $Root 'render-start.sh') -Raw
Assert-True ($Server -match '/api/collections/attachments/add' -and $Server -match '3145728') 'Bounded attachment upload endpoint is missing.'
Assert-True ($Client -match 'MAX_BYTES=1572864' -and $Client -match 'createImageBitmap') 'Client photo compression or size limit is missing.'
Assert-True ($RenderStart -match 'client_max_body_size 4m') 'Production proxy body limit cannot accept bounded attachment uploads.'
Write-Host 'Journey attachment checks passed.' -ForegroundColor Green
