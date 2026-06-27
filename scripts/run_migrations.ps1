Get-ChildItem -Path supabase/migrations | Where-Object { $_.Name -ge "008_add_people_categories.sql" } | ForEach-Object {
    Write-Host "Running $($_.Name)"
    $sql = Get-Content $_.FullName -Raw
    npx supabase db query --linked $sql
}
