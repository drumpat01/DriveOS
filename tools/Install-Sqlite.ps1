param([switch]$NoDownload)
$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
$Destination=Join-Path $PSScriptRoot 'sqlite'
$Executable=Join-Path $Destination 'sqlite3.exe'
if(Test-Path -LiteralPath $Executable){return $Executable}
if($NoDownload){throw 'SQLite runtime is not installed.'}
$Version='3530400'
$Url="https://sqlite.org/2026/sqlite-tools-win-x64-$Version.zip"
$ExpectedSha256='F46EE2475DE4CBE287E6E5F7D43C838796B14E7379CD216BDBB28D391429F9FC'
$Zip=Join-Path ([IO.Path]::GetTempPath()) "driveos-sqlite-$Version.zip"
try{
    [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $Url -OutFile $Zip -UseBasicParsing
    $Actual=(Get-FileHash -LiteralPath $Zip -Algorithm SHA256).Hash
    if($Actual -ne $ExpectedSha256){throw 'SQLite archive checksum verification failed.'}
    if(-not(Test-Path $Destination)){New-Item -ItemType Directory -Path $Destination|Out-Null}
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $Archive=[IO.Compression.ZipFile]::OpenRead($Zip)
    try{
        $Entry=$Archive.Entries|Where-Object FullName -eq 'sqlite3.exe'|Select-Object -First 1
        if(-not $Entry){throw 'sqlite3.exe was not found in the verified archive.'}
        [IO.Compression.ZipFileExtensions]::ExtractToFile($Entry,$Executable,$true)
    }finally{$Archive.Dispose()}
}finally{if(Test-Path -LiteralPath $Zip){Remove-Item -LiteralPath $Zip -Force}}
& $Executable -version
if($LASTEXITCODE -ne 0){throw 'The installed SQLite runtime did not start.'}
return $Executable
