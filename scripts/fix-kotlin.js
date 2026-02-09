const fs = require('fs');
const path = require('path');

const KOTLIN_VERSION = '1.9.25';
const OLD_VERSIONS = ['1.9.24', '1.9.23', '1.8.10', '1.8.0'];

function searchAndReplace(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (file !== 'build' && file !== '.git') { // Skip build folders
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
            if (filePath.endsWith('android/build.gradle')) {
                if (content.match(/kotlinVersion\s*=\s*['"][\d.]+['"]/)) {
                    console.log(`Forcing kotlinVersion in ${filePath}`);
                    content = content.replace(/kotlinVersion\s*=\s*['"][\d.]+['"]/, `kotlinVersion = "${KOTLIN_VERSION}"`);
                    changed = true;
                }
            }

            if (changed) {
                fs.writeFileSync(filePath, content, 'utf8');
            }
        }
    }
}

console.log('Starting Kotlin version patcher...');
searchAndReplace('./android');
searchAndReplace('./node_modules/expo-modules-core');
console.log('Done patching Kotlin versions.');
