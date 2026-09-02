$base = 'C:\Users\muhdz\.gemini\antigravity\scratch\presense\.audit'
$local = Get-Content -Encoding utf8 "$base\local_lines.txt" | Where-Object { $_ -ne '' } | Sort-Object | Get-Unique
$up = Get-Content -Encoding utf8 "$base\upstream_lines.txt" | Where-Object { $_ -ne '' } | Sort-Object | Get-Unique
$overlap = Compare-Object $local $up -IncludeEqual | Where-Object { $_.SideIndicator -eq '==' } | ForEach-Object { $_.InputObject }
Write-Output ("OVERLAP ({0}):" -f $overlap.Count)
foreach ($f in $overlap) { Write-Output ("  " + $f) }
Write-Output ("LOCAL ONLY ({0}):" -f ($local.Count - $overlap.Count))
foreach ($f in ($local | Where-Object { $_ -notin $overlap } | Select-Object -First 15)) { Write-Output ("  " + $f) }
Write-Output ("UPSTREAM ONLY: {0} files" -f ($up.Count - $overlap.Count))
