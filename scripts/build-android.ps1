param(
    [string]$JdkRoot = $env:JAVA_HOME,
    [string]$SdkRoot = "$env:LOCALAPPDATA/Android/Sdk",
    [string]$CacheRoot = ''
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (!$CacheRoot) { $CacheRoot = Join-Path $projectRoot '.android-build' }
$CacheRoot = [IO.Path]::GetFullPath($CacheRoot)
if (!$JdkRoot -or !(Test-Path -LiteralPath (Join-Path $JdkRoot 'bin/javac.exe'))) {
    throw 'Pass -JdkRoot with the path to an installed JDK 21.'
}
if (!(Test-Path -LiteralPath (Join-Path $SdkRoot 'platforms/android-36/android.jar'))) {
    throw 'Android SDK Platform 36 is required. Pass its SDK root with -SdkRoot.'
}
foreach ($folder in @('temp', 'gradle', 'android-user')) {
    New-Item -ItemType Directory -Force -Path (Join-Path $CacheRoot $folder) | Out-Null
}
$settings = @{
    JAVA_HOME = $JdkRoot
    ANDROID_HOME = $SdkRoot
    ANDROID_SDK_ROOT = $SdkRoot
    GRADLE_USER_HOME = (Join-Path $CacheRoot 'gradle')
    ANDROID_USER_HOME = (Join-Path $CacheRoot 'android-user')
    TEMP = (Join-Path $CacheRoot 'temp')
    TMP = (Join-Path $CacheRoot 'temp')
    npm_config_cache = (Join-Path $CacheRoot 'npm-cache')
}
$previous = @{}
foreach ($key in $settings.Keys) {
    $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
    [Environment]::SetEnvironmentVariable($key, $settings[$key], 'Process')
}
Push-Location -LiteralPath $projectRoot
try {
    $sdkProperty = 'sdk.dir=' + ([IO.Path]::GetFullPath($SdkRoot).Replace('\', '/')) + "`n"
    [IO.File]::WriteAllText((Join-Path $projectRoot 'android/local.properties'), $sdkProperty, [Text.UTF8Encoding]::new($false))
    & npm.cmd run android:sync
    if ($LASTEXITCODE -ne 0) { throw 'Web build / Capacitor sync failed.' }
    Push-Location -LiteralPath (Join-Path $projectRoot 'android')
    try {
        & .\gradlew.bat :app:assembleDebug --no-daemon --max-workers=1 --console=plain
        if ($LASTEXITCODE -ne 0) { throw 'Android APK build failed.' }
    } finally { Pop-Location }
    $apk = Join-Path $projectRoot 'android/app/build/outputs/apk/debug/app-debug.apk'
    if (!(Test-Path -LiteralPath $apk)) { throw 'Build finished without the expected APK.' }
    [pscustomobject]@{
        APK = $apk
        Bytes = (Get-Item -LiteralPath $apk).Length
        SHA256 = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash
    } | Format-List
} finally {
    Pop-Location
    foreach ($key in $previous.Keys) {
        [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process')
    }
}
