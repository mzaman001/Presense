$files = Get-ChildItem -Path "C:\Users\muhdz\.gemini\antigravity\scratch\presense\src\" -Recurse -Filter *.tsx

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw

    # Text Colors
    $content = $content -replace 'text-white(?![a-zA-Z0-9\-\/])', 'text-[var(--color-text-1)]'
    $content = $content -replace 'text-black(?![a-zA-Z0-9\-\/])', 'text-[var(--color-background)]'
    $content = $content -replace 'text-\[rgba\(255,255,255,0\.[789]\)\]', 'text-[var(--color-text-2)]'
    $content = $content -replace 'text-\[rgba\(255,255,255,0\.[123456]\)\]', 'text-[var(--color-text-3)]'

    # Background Colors
    $content = $content -replace 'bg-\[#13111C\]', 'bg-[var(--color-background)]'
    $content = $content -replace 'bg-\[rgba\(11,9,20,0\.[89]\)\]', 'bg-[var(--color-background)]'
    $content = $content -replace 'bg-\[rgba\(0,0,0,0\.[24]\)\]', 'bg-[var(--color-surface)]'
    $content = $content -replace 'bg-white(?![a-zA-Z0-9\-\/])', 'bg-[var(--color-text-1)]'
    $content = $content -replace 'bg-\[rgba\(255,255,255,0\.0[25]\)\]', 'bg-[var(--color-surface)]'
    $content = $content -replace 'bg-\[rgba\(255,255,255,0\.1\)\]', 'bg-[var(--color-surface)]'
    $content = $content -replace 'hover:bg-\[rgba\(255,255,255,0\.05\)\]', 'hover:bg-[var(--color-surface)]'

    # Border Colors
    $content = $content -replace 'border-\[rgba\(255,255,255,0\.0[52]\)\]', 'border-[var(--color-border)]'
    $content = $content -replace 'border-\[rgba\(255,255,255,0\.1[025]?\)\]', 'border-[var(--color-border)]'
    $content = $content -replace 'border-\[rgba\(255,255,255,0\.2[5]?\)\]', 'border-[var(--color-border)]'
    $content = $content -replace 'border-\[rgba\(255,255,255,0\.3\)\]', 'border-[var(--color-border)]'
    $content = $content -replace 'border-white(?![a-zA-Z0-9\-\/])', 'border-[var(--color-text-1)]'

    Set-Content -Path $file.FullName -Value $content -NoNewline
}
