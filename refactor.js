const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdir(dir, function(err, list) {
        if (err) return callback(err);
        var pending = list.length;
        if (!pending) return callback(null);
        list.forEach(function(file) {
            file = path.resolve(dir, file);
            fs.stat(file, function(err, stat) {
                if (stat && stat.isDirectory()) {
                    walk(file, function(err) {
                        if (!--pending) callback(null);
                    });
                } else {
                    if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                        processFile(file);
                    }
                    if (!--pending) callback(null);
                }
            });
        });
    });
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Text Colors
    content = content.replace(/text-white(?![a-zA-Z0-9\-\/])/g, 'text-[var(--color-text-1)]');
    content = content.replace(/text-black(?![a-zA-Z0-9\-\/])/g, 'text-[var(--color-background)]');
    content = content.replace(/text-\[rgba\(255,255,255,0\.[789]\)\]/g, 'text-[var(--color-text-2)]');
    content = content.replace(/text-\[rgba\(255,255,255,0\.[123456]\)\]/g, 'text-[var(--color-text-3)]');

    // Background Colors
    content = content.replace(/bg-\[#13111C\]/g, 'bg-[var(--color-background)]');
    content = content.replace(/bg-\[rgba\(11,9,20,0\.[89]\)\]/g, 'bg-[var(--color-background)]');
    content = content.replace(/bg-\[rgba\(0,0,0,0\.[24]\)\]/g, 'bg-[var(--color-surface)]');
    content = content.replace(/bg-white(?![a-zA-Z0-9\-\/])/g, 'bg-[var(--color-text-1)]');
    content = content.replace(/bg-\[rgba\(255,255,255,0\.0[25]\)\]/g, 'bg-[var(--color-surface)]');
    content = content.replace(/bg-\[rgba\(255,255,255,0\.1\)\]/g, 'bg-[var(--color-surface)]');
    content = content.replace(/hover:bg-\[rgba\(255,255,255,0\.05\)\]/g, 'hover:bg-[var(--color-surface)]');
    content = content.replace(/hover:bg-\[rgba\(255,255,255,0\.1\)\]/g, 'hover:bg-[var(--color-border)]');

    // Border Colors
    content = content.replace(/border-\[rgba\(255,255,255,0\.0[52]\)\]/g, 'border-[var(--color-border)]');
    content = content.replace(/border-\[rgba\(255,255,255,0\.1[025]?\)\]/g, 'border-[var(--color-border)]');
    content = content.replace(/border-\[rgba\(255,255,255,0\.2[5]?\)\]/g, 'border-[var(--color-border)]');
    content = content.replace(/border-\[rgba\(255,255,255,0\.3\)\]/g, 'border-[var(--color-border)]');
    content = content.replace(/border-white(?![a-zA-Z0-9\-\/])/g, 'border-[var(--color-text-1)]');

    fs.writeFileSync(filePath, content, 'utf8');
}

walk('src', function(err) {
    if (err) throw err;
    console.log('Refactoring complete.');
});
