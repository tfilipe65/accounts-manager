# Exports the transaction sheets of Teia_Accounts.xlsb (opened read-only) to TSV files in
# db\workbook-export (git-ignored). scripts\import-workbook.mjs reads them.
#   powershell -File scripts\export-workbook.ps1
# Override with $env:WORKBOOK_PATH / $env:WORKBOOK_EXPORT_DIR.
$ErrorActionPreference = "Stop"
$path = if ($env:WORKBOOK_PATH) { $env:WORKBOOK_PATH } else { "C:\Users\tony\OneDrive - Teia Firme Lda\_ALGARVE BUILDERS\CLAUDE AI\AB ACCT\Teia_Accounts.xlsb" }
$outDir = if ($env:WORKBOOK_EXPORT_DIR) { $env:WORKBOOK_EXPORT_DIR } else { Join-Path $PSScriptRoot "..\db\workbook-export" }
New-Item -ItemType Directory -Force $outDir | Out-Null

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.AutomationSecurity = 3
$excel.EnableEvents = $false
$wb = $excel.Workbooks.Open($path, 0, $true)
try {
  foreach ($name in @("Income","Expense","Bank_1","Bank_2","Bank_3","Cash","Journal_Entry","Opening_balance")) {
    $ws = $wb.Worksheets.Item($name)
    $ur = $ws.UsedRange
    $r0 = $ur.Row; $c0 = $ur.Column
    $nr = $ur.Rows.Count; $nc = [Math]::Min($ur.Columns.Count, 45)
    $rng = $ws.Range($ws.Cells.Item($r0,$c0), $ws.Cells.Item($r0+$nr-1, $c0+$nc-1))
    $vals = $rng.Value2
    $sb = New-Object System.Text.StringBuilder
    for ($r = 1; $r -le $nr; $r++) {
      $parts = New-Object string[] $nc
      for ($c = 1; $c -le $nc; $c++) {
        $v = $vals[$r,$c]
        if ($null -eq $v) { $parts[$c-1] = "" } else { $parts[$c-1] = ([string]$v).Replace("`t"," ").Replace("`r"," ").Replace("`n"," ") }
      }
      [void]$sb.AppendLine(($parts -join "`t"))
    }
    [System.IO.File]::WriteAllText((Join-Path $outDir "$name.tsv"), $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
    Write-Output "$name : rows=$nr cols=$nc"
  }
} finally {
  $wb.Close($false)
  $excel.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}
