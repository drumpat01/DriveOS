$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
Import-Module (Join-Path $Root 'src\Security\DriveOS.WebSession.psm1') -Force
Import-Module (Join-Path $Root 'src\Security\DriveOS.Passkeys.psm1') -Force
function Assert-True([bool]$Condition,[string]$Message){if(-not $Condition){throw $Message}}

$Challenge=New-DriveOSPasskeyChallenge -Purpose authenticate -ClientKey browser-one
$Used=Use-DriveOSPasskeyChallenge -ChallengeId $Challenge.challengeId -Purpose authenticate -ClientKey browser-one
Assert-True ($Used.challenge -eq $Challenge.challenge) 'Passkey challenge did not round-trip.'
try{Use-DriveOSPasskeyChallenge -ChallengeId $Challenge.challengeId -Purpose authenticate -ClientKey browser-one;throw 'Expected replay rejection.'}catch{Assert-True ($_.Exception.Message -match 'invalid or expired') 'A used passkey challenge was replayable.'}

$RpId='journeydeck.me';$Origin='https://journeydeck.me';$ClientChallenge='challenge_value'
$ClientBytes=[Text.Encoding]::UTF8.GetBytes((@{type='webauthn.get';challenge=$ClientChallenge;origin=$Origin;crossOrigin=$false}|ConvertTo-Json -Compress))
$EncodedClient=ConvertTo-DriveOSPasskeyBase64Url -Bytes $ClientBytes
Assert-True ((Test-DriveOSPasskeyClientData -ClientDataJSON $EncodedClient -ExpectedType 'webauthn.get' -ExpectedChallenge $ClientChallenge -ExpectedOrigin $Origin).Length -gt 0) 'Valid passkey client data was rejected.'
Assert-True (-not (Test-DriveOSPasskeyClientData -ClientDataJSON $EncodedClient -ExpectedType 'webauthn.get' -ExpectedChallenge wrong -ExpectedOrigin $Origin)) 'Wrong passkey challenge was accepted.'

$Hasher=[Security.Cryptography.SHA256]::Create();try{$RpHash=$Hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($RpId))}finally{$Hasher.Dispose()}
$Auth=New-Object byte[] 37;[Array]::Copy($RpHash,$Auth,32);$Auth[32]=0x05;$Auth[36]=7
Assert-True (Test-DriveOSPasskeyAuthenticatorData -AuthenticatorData $Auth -RpId $RpId) 'Valid authenticator data was rejected.'
Assert-True ((Get-DriveOSPasskeySignCount $Auth) -eq 7) 'Passkey sign counter was decoded incorrectly.'
$Auth[32]=0x01
Assert-True (-not (Test-DriveOSPasskeyAuthenticatorData -AuthenticatorData $Auth -RpId $RpId)) 'Authenticator data without user verification was accepted.'
Write-Host 'Passkey security checks passed.' -ForegroundColor Green
