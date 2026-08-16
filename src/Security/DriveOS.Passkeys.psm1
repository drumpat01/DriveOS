Set-StrictMode -Version 2.0

$script:DriveOSPasskeyChallenges = @{}

function ConvertTo-DriveOSPasskeyBase64Url {
    param([byte[]]$Bytes)
    return [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
}

function ConvertFrom-DriveOSPasskeyBase64Url {
    param([string]$Value)
    $Padded=$Value.Replace('-','+').Replace('_','/')
    while(($Padded.Length % 4) -ne 0){$Padded+='='}
    return [Convert]::FromBase64String($Padded)
}

function New-DriveOSPasskeyChallenge {
    param([ValidateSet('register','authenticate')][string]$Purpose,[string]$ClientKey,[DateTimeOffset]$Now=[DateTimeOffset]::UtcNow)
    $IdBytes=New-Object byte[] 18;$ChallengeBytes=New-Object byte[] 32
    $Random=[Security.Cryptography.RandomNumberGenerator]::Create()
    try{$Random.GetBytes($IdBytes);$Random.GetBytes($ChallengeBytes)}finally{$Random.Dispose()}
    $Id=ConvertTo-DriveOSPasskeyBase64Url -Bytes $IdBytes
    $Challenge=ConvertTo-DriveOSPasskeyBase64Url -Bytes $ChallengeBytes
    foreach($Key in @($script:DriveOSPasskeyChallenges.Keys)){if($script:DriveOSPasskeyChallenges[$Key].expiresAt -le $Now){$script:DriveOSPasskeyChallenges.Remove($Key)}}
    $script:DriveOSPasskeyChallenges[$Id]=[PSCustomObject]@{purpose=$Purpose;challenge=$Challenge;clientKey=$ClientKey;expiresAt=$Now.AddMinutes(5)}
    return [PSCustomObject]@{challengeId=$Id;challenge=$Challenge;expiresAtUtc=$Now.AddMinutes(5).ToString('o')}
}

function Use-DriveOSPasskeyChallenge {
    param([string]$ChallengeId,[string]$Purpose,[string]$ClientKey,[DateTimeOffset]$Now=[DateTimeOffset]::UtcNow)
    if(-not $ChallengeId -or -not $script:DriveOSPasskeyChallenges.ContainsKey($ChallengeId)){throw 'Passkey challenge is invalid or expired.'}
    $Entry=$script:DriveOSPasskeyChallenges[$ChallengeId];$script:DriveOSPasskeyChallenges.Remove($ChallengeId)
    if($Entry.expiresAt -le $Now -or $Entry.purpose -ne $Purpose -or $Entry.clientKey -ne $ClientKey){throw 'Passkey challenge is invalid or expired.'}
    return $Entry
}

function Test-DriveOSPasskeyClientData {
    param([string]$ClientDataJSON,[string]$ExpectedType,[string]$ExpectedChallenge,[string]$ExpectedOrigin)
    try {
        $Bytes=ConvertFrom-DriveOSPasskeyBase64Url -Value $ClientDataJSON
        $Data=([Text.Encoding]::UTF8.GetString($Bytes))|ConvertFrom-Json
        if("$($Data.type)" -ne $ExpectedType -or "$($Data.challenge)" -ne $ExpectedChallenge -or "$($Data.origin)" -ne $ExpectedOrigin){return $null}
        if($Data.PSObject.Properties['crossOrigin'] -and [bool]$Data.crossOrigin){return $null}
        return $Bytes
    }catch{return $null}
}

function Test-DriveOSPasskeyAuthenticatorData {
    param([byte[]]$AuthenticatorData,[string]$RpId)
    if(-not $AuthenticatorData -or $AuthenticatorData.Length -lt 37){return $false}
    $Hasher=[Security.Cryptography.SHA256]::Create()
    try{$Expected=$Hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($RpId))}finally{$Hasher.Dispose()}
    for($i=0;$i -lt 32;$i++){if($AuthenticatorData[$i] -ne $Expected[$i]){return $false}}
    $Flags=$AuthenticatorData[32]
    return (($Flags -band 0x01) -ne 0 -and ($Flags -band 0x04) -ne 0)
}

function Get-DriveOSPasskeySignCount {
    param([byte[]]$AuthenticatorData)
    if(-not $AuthenticatorData -or $AuthenticatorData.Length -lt 37){return 0}
    return [uint32](($AuthenticatorData[33]-shl 24)-bor($AuthenticatorData[34]-shl 16)-bor($AuthenticatorData[35]-shl 8)-bor$AuthenticatorData[36])
}

function New-DriveOSEcdsaFromPasskeySpki {
    param([byte[]]$PublicKeySpki)
    # WebAuthn ES256 public keys are returned as a 91-byte SubjectPublicKeyInfo
    # structure containing the P-256 algorithm identifiers and an uncompressed point.
    [byte[]]$Prefix=0x30,0x59,0x30,0x13,0x06,0x07,0x2A,0x86,0x48,0xCE,0x3D,0x02,0x01,0x06,0x08,0x2A,0x86,0x48,0xCE,0x3D,0x03,0x01,0x07,0x03,0x42,0x00,0x04
    if(-not $PublicKeySpki -or $PublicKeySpki.Length -ne 91){return $null}
    for($Index=0;$Index -lt $Prefix.Length;$Index++){if($PublicKeySpki[$Index] -ne $Prefix[$Index]){return $null}}
    $Ecdsa=$null
    try {
        $Parameters=[Security.Cryptography.ECParameters]::new()
        $Parameters.Curve=[Security.Cryptography.ECCurve]::CreateFromFriendlyName('nistP256')
        $Point=[Security.Cryptography.ECPoint]::new()
        $Point.X=[byte[]]($PublicKeySpki[27..58])
        $Point.Y=[byte[]]($PublicKeySpki[59..90])
        $Parameters.Q=$Point
        $Ecdsa=[Security.Cryptography.ECDsa]::Create()
        $Ecdsa.ImportParameters($Parameters)
        return $Ecdsa
    } catch {
        if($Ecdsa){$Ecdsa.Dispose()}
        return $null
    }
}

function Test-DriveOSPasskeyAssertion {
    param([string]$ClientDataJSON,[string]$AuthenticatorData,[string]$Signature,[string]$PublicKeySpki,[string]$ExpectedChallenge,[string]$Origin,[string]$RpId)
    $ClientBytes=Test-DriveOSPasskeyClientData -ClientDataJSON $ClientDataJSON -ExpectedType 'webauthn.get' -ExpectedChallenge $ExpectedChallenge -ExpectedOrigin $Origin
    if(-not $ClientBytes){return $false}
    try{$AuthBytes=ConvertFrom-DriveOSPasskeyBase64Url $AuthenticatorData;$SignatureBytes=ConvertFrom-DriveOSPasskeyBase64Url $Signature;$KeyBytes=ConvertFrom-DriveOSPasskeyBase64Url $PublicKeySpki}catch{return $false}
    if(-not(Test-DriveOSPasskeyAuthenticatorData -AuthenticatorData $AuthBytes -RpId $RpId)){return $false}
    $Hasher=[Security.Cryptography.SHA256]::Create();try{$ClientHash=$Hasher.ComputeHash($ClientBytes)}finally{$Hasher.Dispose()}
    $Signed=New-Object byte[] ($AuthBytes.Length+$ClientHash.Length);[Array]::Copy($AuthBytes,0,$Signed,0,$AuthBytes.Length);[Array]::Copy($ClientHash,0,$Signed,$AuthBytes.Length,$ClientHash.Length)
    $Ecdsa=New-DriveOSEcdsaFromPasskeySpki -PublicKeySpki $KeyBytes
    if(-not $Ecdsa){return $false}
    try{return $Ecdsa.VerifyData($Signed,$SignatureBytes,[Security.Cryptography.HashAlgorithmName]::SHA256,[Security.Cryptography.DSASignatureFormat]::Rfc3279DerSequence)}catch{return $false}finally{$Ecdsa.Dispose()}
}

Export-ModuleMember -Function ConvertTo-DriveOSPasskeyBase64Url,ConvertFrom-DriveOSPasskeyBase64Url,New-DriveOSPasskeyChallenge,Use-DriveOSPasskeyChallenge,Test-DriveOSPasskeyClientData,Test-DriveOSPasskeyAuthenticatorData,Get-DriveOSPasskeySignCount,New-DriveOSEcdsaFromPasskeySpki,Test-DriveOSPasskeyAssertion
