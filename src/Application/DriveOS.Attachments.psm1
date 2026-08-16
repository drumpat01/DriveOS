Set-StrictMode -Version 2.0

$script:AllowedJourneyAttachmentTypes=@('image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv','application/json')

function Test-JourneyAttachmentSignature {
    param([byte[]]$Bytes,[string]$ContentType)
    if($ContentType -eq 'image/jpeg'){return $Bytes.Length -ge 3 -and $Bytes[0] -eq 0xFF -and $Bytes[1] -eq 0xD8 -and $Bytes[2] -eq 0xFF}
    if($ContentType -eq 'image/png'){return $Bytes.Length -ge 8 -and (($Bytes[0..7] -join ',') -eq '137,80,78,71,13,10,26,10')}
    if($ContentType -eq 'image/webp'){return $Bytes.Length -ge 12 -and [Text.Encoding]::ASCII.GetString($Bytes,0,4) -eq 'RIFF' -and [Text.Encoding]::ASCII.GetString($Bytes,8,4) -eq 'WEBP'}
    if($ContentType -eq 'application/pdf'){return $Bytes.Length -ge 5 -and [Text.Encoding]::ASCII.GetString($Bytes,0,5) -eq '%PDF-'}
    return -not ($Bytes -contains 0)
}

function Add-JourneyAttachment {
    param($Repository,[string]$CollectionId,[string]$FileName,[string]$ContentType,[string]$DataBase64)
    if($CollectionId -notmatch '^collection_[a-f0-9]{32}$'){throw 'Collection ID is invalid.'}
    $SafeName=[IO.Path]::GetFileName("$FileName").Trim()
    if(-not $SafeName -or $SafeName.Length -gt 120){throw 'Attachment filename is invalid.'}
    $Type="$ContentType".Trim().ToLowerInvariant()
    if($Type -notin $script:AllowedJourneyAttachmentTypes){throw 'This file type is not supported.'}
    try{$Bytes=[Convert]::FromBase64String("$DataBase64")}catch{throw 'Attachment data is invalid.'}
    if($Bytes.Length -lt 1 -or $Bytes.Length -gt 1572864){throw 'Attachments must be 1.5 MB or smaller.'}
    if(-not (Test-JourneyAttachmentSignature -Bytes $Bytes -ContentType $Type)){throw 'Attachment content does not match its file type.'}
    $Collection=@(Get-DriveOSJourneyCollections -Repository $Repository | Where-Object id -eq $CollectionId | Select-Object -First 1)
    if(-not $Collection){throw 'Collection was not found.'}
    $Existing=@(Get-DriveOSJourneyAttachments -Repository $Repository -CollectionId $CollectionId)
    if($Existing.Count -ge 20){throw 'A journey may contain at most 20 attachments.'}
    $Record=[PSCustomObject]@{id='attachment_'+[guid]::NewGuid().ToString('N');collectionId=$CollectionId;fileName=$SafeName;contentType=$Type;byteLength=$Bytes.Length;dataBase64="$DataBase64";createdAtUtc=[DateTimeOffset]::UtcNow.ToString('o')}
    Set-DriveOSJourneyAttachment -Repository $Repository -Record $Record
    return [PSCustomObject]@{id=$Record.id;collectionId=$CollectionId;fileName=$SafeName;contentType=$Type;byteLength=$Bytes.Length;createdAtUtc=$Record.createdAtUtc}
}

function Remove-JourneyAttachment {
    param($Repository,[string]$AttachmentId)
    if($AttachmentId -notmatch '^attachment_[a-f0-9]{32}$'){throw 'Attachment ID is invalid.'}
    Remove-DriveOSJourneyAttachment -Repository $Repository -AttachmentId $AttachmentId
    return [PSCustomObject]@{deleted=$true;attachmentId=$AttachmentId}
}

Export-ModuleMember -Function Add-JourneyAttachment,Remove-JourneyAttachment,Test-JourneyAttachmentSignature
