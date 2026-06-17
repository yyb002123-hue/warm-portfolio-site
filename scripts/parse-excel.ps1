param(
  [Parameter(Mandatory = $true)]
  [string]$Path
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-CellText {
  param(
    [System.Xml.XmlElement]$Cell,
    [string[]]$SharedStrings,
    [System.Xml.XmlNamespaceManager]$Ns
  )

  $type = $Cell.GetAttribute("t")
  if ($type -eq "s") {
    $valueNode = $Cell.SelectSingleNode("./x:v", $Ns)
    if ($null -eq $valueNode -or $valueNode.InnerText -eq "") { return "" }
    $index = [int]$valueNode.InnerText
    if ($index -ge 0 -and $index -lt $SharedStrings.Count) { return $SharedStrings[$index] }
    return ""
  }

  if ($type -eq "inlineStr") {
    $texts = $Cell.SelectNodes(".//x:t", $Ns) | ForEach-Object { $_.InnerText }
    return ($texts -join "")
  }

  $value = $Cell.SelectSingleNode("./x:v", $Ns)
  if ($null -ne $value) { return $value.InnerText }
  return ""
}

function Get-ColumnIndex {
  param([string]$Reference)

  $letters = ([regex]::Match($Reference, "^[A-Z]+")).Value
  $number = 0
  foreach ($char in $letters.ToCharArray()) {
    $number = $number * 26 + ([int][char]$char - [int][char]'A' + 1)
  }
  return $number - 1
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
try {
  $sharedStrings = @()
  $sharedEntry = $zip.GetEntry("xl/sharedStrings.xml")
  if ($null -eq $sharedEntry) { $sharedEntry = $zip.GetEntry("xl\sharedStrings.xml") }
  if ($null -ne $sharedEntry) {
    $reader = [System.IO.StreamReader]::new($sharedEntry.Open(), [System.Text.Encoding]::UTF8)
    try { [xml]$sharedXml = $reader.ReadToEnd() } finally { $reader.Close() }
    $sharedNs = [System.Xml.XmlNamespaceManager]::new($sharedXml.NameTable)
    $sharedNs.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
    foreach ($item in $sharedXml.SelectNodes("//x:si", $sharedNs)) {
      $texts = $item.SelectNodes(".//x:t", $sharedNs) | ForEach-Object { $_.InnerText }
      $sharedStrings += ($texts -join "")
    }
  }

  $sheetEntry = $zip.GetEntry("xl/worksheets/sheet1.xml")
  if ($null -eq $sheetEntry) { $sheetEntry = $zip.GetEntry("xl\worksheets\sheet1.xml") }
  if ($null -eq $sheetEntry) {
    $sheetEntry = $zip.Entries | Where-Object { $_.FullName -like "xl/worksheets/sheet*.xml" -or $_.FullName -like "xl\worksheets\sheet*.xml" } | Select-Object -First 1
  }
  if ($null -eq $sheetEntry) { throw "No worksheet found in Excel file." }

  $reader = [System.IO.StreamReader]::new($sheetEntry.Open(), [System.Text.Encoding]::UTF8)
  try { [xml]$sheetXml = $reader.ReadToEnd() } finally { $reader.Close() }
  $ns = [System.Xml.XmlNamespaceManager]::new($sheetXml.NameTable)
  $ns.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

  $rows = @()
  foreach ($row in $sheetXml.SelectNodes("//x:sheetData/x:row", $ns)) {
    $cells = @{}
    foreach ($cell in $row.SelectNodes("./x:c", $ns)) {
      $ref = $cell.GetAttribute("r")
      if (-not $ref) { continue }
      $index = Get-ColumnIndex $ref
      $cells[$index] = Get-CellText $cell $sharedStrings $ns
    }

    if ($cells.Count -eq 0) { continue }
    $max = ($cells.Keys | Measure-Object -Maximum).Maximum
    $values = for ($i = 0; $i -le $max; $i++) {
      if ($cells.ContainsKey($i)) { [string]$cells[$i] } else { "" }
    }
    $rows += ,$values
  }

  ConvertTo-Json -InputObject @($rows) -Depth 8 -Compress
} finally {
  $zip.Dispose()
}
