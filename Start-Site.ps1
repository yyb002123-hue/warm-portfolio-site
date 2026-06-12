$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$publicDir = Join-Path $root "public"
$uploadsDir = Join-Path $publicDir "uploads"
$dataFile = Join-Path $root "data\site-data.json"
$backupFile = Join-Path $root "data\site-data.backup.json"
$port = if ($env:PORT) { [int]$env:PORT } else { 3000 }

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".gif" = "image/gif"
  ".webp" = "image/webp"
  ".svg" = "image/svg+xml; charset=utf-8"
}

function Write-Response($stream, [int]$status, [string]$statusText, [byte[]]$body, [string]$contentType) {
  $header = "HTTP/1.1 $status $statusText`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  $stream.Write($body, 0, $body.Length)
}

function Text-Bytes([string]$text) {
  return [System.Text.Encoding]::UTF8.GetBytes($text)
}

function Save-UploadedImage($payload) {
  $dataUrl = [string]$payload.dataUrl
  $match = [regex]::Match($dataUrl, '^data:(image/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$')
  if (-not $match.Success) {
    throw "Only png, jpg, webp, and gif images are supported"
  }

  $extensions = @{
    "image/png" = ".png"
    "image/jpeg" = ".jpg"
    "image/webp" = ".webp"
    "image/gif" = ".gif"
  }
  $safeName = [System.IO.Path]::GetFileName([string]$payload.filename) -replace '[^a-zA-Z0-9._-]', '-'
  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($safeName)
  if ([string]::IsNullOrWhiteSpace($baseName)) { $baseName = "image" }
  if ($baseName.Length -gt 42) { $baseName = $baseName.Substring(0, 42) }
  $finalName = "$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-$baseName$($extensions[$match.Groups[1].Value])"

  New-Item -ItemType Directory -Force -Path $uploadsDir | Out-Null
  [System.IO.File]::WriteAllBytes((Join-Path $uploadsDir $finalName), [Convert]::FromBase64String($match.Groups[2].Value))
  return "/uploads/$finalName"
}

function Read-Request($stream) {
  $buffer = New-Object byte[] 8192
  $bytes = New-Object System.Collections.Generic.List[byte]
  $headerEnd = -1

  while ($headerEnd -lt 0) {
    $read = $stream.Read($buffer, 0, $buffer.Length)
    if ($read -le 0) { break }
    for ($i = 0; $i -lt $read; $i++) {
      $bytes.Add($buffer[$i])
    }
    $arr = $bytes.ToArray()
    for ($i = 0; $i -le $arr.Length - 4; $i++) {
      if ($arr[$i] -eq 13 -and $arr[$i + 1] -eq 10 -and $arr[$i + 2] -eq 13 -and $arr[$i + 3] -eq 10) {
        $headerEnd = $i + 4
        break
      }
    }
  }

  $all = $bytes.ToArray()
  $headerText = [System.Text.Encoding]::ASCII.GetString($all, 0, $headerEnd)
  $lines = $headerText -split "`r`n"
  $requestLine = $lines[0] -split " "
  $headers = @{}
  foreach ($line in $lines[1..($lines.Length - 1)]) {
    if ($line.Contains(":")) {
      $parts = $line.Split(":", 2)
      $headers[$parts[0].Trim().ToLowerInvariant()] = $parts[1].Trim()
    }
  }

  $contentLength = if ($headers.ContainsKey("content-length")) { [int]$headers["content-length"] } else { 0 }
  $bodyBytes = New-Object System.Collections.Generic.List[byte]
  for ($i = $headerEnd; $i -lt $all.Length; $i++) {
    $bodyBytes.Add($all[$i])
  }

  while ($bodyBytes.Count -lt $contentLength) {
    $read = $stream.Read($buffer, 0, [Math]::Min($buffer.Length, $contentLength - $bodyBytes.Count))
    if ($read -le 0) { break }
    for ($i = 0; $i -lt $read; $i++) {
      $bodyBytes.Add($buffer[$i])
    }
  }

  return @{
    Method = $requestLine[0]
    Path = ($requestLine[1] -split "\?")[0]
    Body = [System.Text.Encoding]::UTF8.GetString($bodyBytes.ToArray())
  }
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
$listener.Start()

Write-Host "Site running: http://localhost:$port/"
Write-Host "Admin: http://localhost:$port/admin.html"
Write-Host "Press Ctrl+C to stop."

while ($true) {
  $client = $listener.AcceptTcpClient()
  $stream = $client.GetStream()

  try {
    $request = Read-Request $stream

    if ($request.Path -eq "/api/site" -and $request.Method -eq "GET") {
      $json = Get-Content -LiteralPath $dataFile -Raw -Encoding UTF8
      $json = $json.TrimStart([char]0xFEFF)
      Write-Response $stream 200 "OK" (Text-Bytes $json) "application/json; charset=utf-8"
      continue
    }

    if ($request.Path -eq "/api/site" -and $request.Method -eq "POST") {
      $null = $request.Body | ConvertFrom-Json
      if (Test-Path -LiteralPath $dataFile -PathType Leaf) {
        Copy-Item -LiteralPath $dataFile -Destination $backupFile -Force
      }
      $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
      [System.IO.File]::WriteAllText($dataFile, $request.Body, $utf8NoBom)
      Write-Response $stream 200 "OK" (Text-Bytes '{"ok":true}') "application/json; charset=utf-8"
      continue
    }

    if ($request.Path -eq "/api/upload" -and $request.Method -eq "POST") {
      $payload = $request.Body | ConvertFrom-Json
      $uploadedUrl = Save-UploadedImage $payload
      Write-Response $stream 200 "OK" (Text-Bytes "{""ok"":true,""url"":""$uploadedUrl""}") "application/json; charset=utf-8"
      continue
    }

    $relativePath = [System.Uri]::UnescapeDataString($request.Path.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
      $relativePath = "index.html"
    }

    $fullPath = [System.IO.Path]::GetFullPath((Join-Path $publicDir $relativePath))
    $publicRoot = [System.IO.Path]::GetFullPath($publicDir)
    $publicRootWithSlash = $publicRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    if (-not $fullPath.StartsWith($publicRootWithSlash)) {
      Write-Response $stream 403 "Forbidden" (Text-Bytes "Forbidden") "text/plain; charset=utf-8"
      continue
    }

    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
      Write-Response $stream 404 "Not Found" (Text-Bytes "Not found") "text/plain; charset=utf-8"
      continue
    }

    $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
    $contentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { "application/octet-stream" }
    Write-Response $stream 200 "OK" ([System.IO.File]::ReadAllBytes($fullPath)) $contentType
  } catch {
    Write-Response $stream 500 "Server Error" (Text-Bytes $_.Exception.Message) "text/plain; charset=utf-8"
  } finally {
    $stream.Close()
    $client.Close()
  }
}
