function ConvertFrom-DriveOSRequestBody {
    param([string]$BodyText,[string[]]$RequiredFields=@())
    if(-not $BodyText){throw 'Request body was empty.'}
    try{$body=$BodyText|ConvertFrom-Json}catch{throw 'Request body was invalid JSON.'}
    foreach($field in $RequiredFields){if(-not $body.$field){throw "$field is required."}}
    return $body
}

function Get-DriveOSHttpError {
    param([string]$Message)
    $result=[ordered]@{statusCode=500;statusText='Internal Server Error';publicMessage='DriveOS request failed.'}
    if($Message -like '*Spotify token file not found*'){$result.statusCode=401;$result.statusText='Unauthorized';$result.publicMessage='Spotify authorization is required on this computer.'}
    elseif($Message -like '*playlist-modify-private*'){$result.statusCode=403;$result.statusText='Forbidden';$result.publicMessage='Spotify playlist permission is not available. Reauthorize Spotify for DriveOS.'}
    elseif($Message -like '* is required*' -or $Message -like '*Request body was empty*' -or $Message -like '*invalid JSON*'){$result.statusCode=400;$result.statusText='Bad Request';$result.publicMessage=$Message}
    return [pscustomobject]$result
}

Export-ModuleMember -Function ConvertFrom-DriveOSRequestBody,Get-DriveOSHttpError
