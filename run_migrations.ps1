Get-ChildItem -Path supabase/migrations | Where-Object { $_.Name -ge "014_snooze.sql" } | ForEach-Object {
    Write-Host "Running $($_.Name)"
    $sql = Get-Content $_.FullName -Raw
    npx supabase db query --linked $sql
}
