const fs = require('fs');
const path = require('path');

const KOTLIN_VERSION = '1.9.25';
// Only targeting 1.9.24 because that is the version causing conflict with Compose Compiler 1.5.15
// Previous attempts included 1.8.x which broke androidx.dependencies
const OLD_VERSIONS = ['1.9.24'];

function searchAndReplace(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (file !== 'build' && file !== '.git' && file !== 'node_modules') {
                searchAndReplace(filePath);
            }
        } else if (file.endsWith('.gradle') || file.endsWith('.gradle.kts')) {
            let content = fs.readFileSync(filePath, 'utf8');
            let changed = false;

            // Replace old versions
            for (const oldVer of OLD_VERSIONS) {
                if (content.includes(oldVer)) {
                    console.log(`Patching ${filePath}: ${oldVer} -> ${KOTLIN_VERSION}`);
                    content = content.replace(new RegExp(oldVer.replace(/\./g, '\\.'), 'g'), KOTLIN_VERSION);
                    changed = true;
                }
            }

            // Force kotlinVersion in buildscript ext if present
            // This handles cases where it might be defined but not with the exact string 1.9.24
            if (filePath.endsWith('android/build.gradle')) {
                const kotlinVersionRegex = /kotlinVersion\s*=\s*['"][\d.]+['"]/;
                if (content.match(kotlinVersionRegex)) {
                    const transform = content.replace(kotlinVersionRegex, `kotlinVersion = "${KOTLIN_VERSION}"`);
                    if (transform !== content) {
                        console.log(`Forcing kotlinVersion variable in ${filePath}`);
                        content = transform;
                        changed = true;
                    }
                }
            }

            if (changed) {
                fs.writeFileSync(filePath, content, 'utf8');
            }
        }
    }
}

console.log('Starting Kotlin version patcher (Targeting 1.9.24 only)...');
searchAndReplace('./android');
searchAndReplace('./node_modules/expo-modules-core');
console.log('Done patching Kotlin versions.');
