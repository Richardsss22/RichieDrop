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

console.log('Starting Kotlin version patcher...');

// 1. Regex Replace (Keep this as first line of defense)
// searchAndReplace('./android'); // Moved below to process specific paths
// searchAndReplace('./node_modules/expo-modules-core');

// Process recursively
// Process recursively
searchAndReplace('./android');

// Fix bug: node_modules is inside android/ folder in this repo structure
const nodeModulesPath = path.join('android', 'node_modules', 'expo-modules-core');
if (fs.existsSync(nodeModulesPath)) {
    console.log(`Patching expo-modules-core at ${nodeModulesPath}`);
    searchAndReplace(nodeModulesPath);
} else {
    // Fallback if structure is flat (e.g. locally or different setup)
    console.log('Searching for expo-modules-core in root node_modules...');
    searchAndReplace('./node_modules/expo-modules-core');
}

// Debug: List contents of android directory to confirm structure (user debugging)
if (fs.existsSync('android')) {
    console.log('List of android/ directory:', fs.readdirSync('android'));
    if (fs.existsSync('android/android')) {
        console.log('List of android/android/ directory:', fs.readdirSync('android/android'));
    }
}

// 2. Modify Root build.gradle directly first (Variable Replacement)
const rootBuildGradlePath = path.join('android', 'android', 'build.gradle');
if (fs.existsSync(rootBuildGradlePath)) {
    console.log(`Modifying root build.gradle at ${rootBuildGradlePath}`);
    let rootContent = fs.readFileSync(rootBuildGradlePath, 'utf8');

    // Replace kotlinVersion variable in buildscript ext
    // Common pattern: ext { ... kotlinVersion = "1.9.24" ... }
    if (rootContent.includes('kotlinVersion')) {
        console.log('Found kotlinVersion variable, forcing to 1.9.25');
        rootContent = rootContent.replace(/kotlinVersion\s*=\s*['"][\d.]+['"]/g, `kotlinVersion = "${KOTLIN_VERSION}"`);
        fs.writeFileSync(rootBuildGradlePath, rootContent, 'utf8');
    }

    // 3. Append Resolution Strategy (Safety Net)
    console.log(`Appending resolution strategy to ${rootBuildGradlePath}`);
    const resolutionStrategy = `
// FORCE KOTLIN VERSION (Added by fix-kotlin.cjs)
allprojects {
    configurations.all {
        resolutionStrategy {
            force 'org.jetbrains.kotlin:kotlin-stdlib:${KOTLIN_VERSION}'
            force 'org.jetbrains.kotlin:kotlin-stdlib-jdk8:${KOTLIN_VERSION}'
            force 'org.jetbrains.kotlin:kotlin-reflect:${KOTLIN_VERSION}'
        }
    }
}
subprojects {
    buildscript {
        configurations.all {
            resolutionStrategy.eachDependency { details ->
                if (details.requested.group == 'org.jetbrains.kotlin' && details.requested.name.startsWith('kotlin-gradle-plugin')) {
                    details.useVersion '${KOTLIN_VERSION}'
                }
            }
        }
    }
}
`;
    // Only append if not already appended
    if (!rootContent.includes('FORCE KOTLIN VERSION')) {
        fs.appendFileSync(rootBuildGradlePath, resolutionStrategy, 'utf8');
    }
} else {
    console.warn(`Warning: Could not find root build.gradle at ${rootBuildGradlePath}`);
}

console.log('Done patching Kotlin versions.');
