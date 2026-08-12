param(
    [string]$CommitMessage,
    [string[]]$Paths,
    [switch]$SkipTests,
    [switch]$NoPush,
    [switch]$PreflightOnly,
    [switch]$Yes
)

& (Join-Path $PSScriptRoot 'tools\Deploy-DriveOS.ps1') @PSBoundParameters
