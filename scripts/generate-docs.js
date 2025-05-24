// scripts/generate-docs.js
import fs from 'fs'; // 使用原生 fs
import path from 'path';
import chokidar from 'chokidar';
import { fileURLToPath } from 'url';

// ES Module replacements for __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// const sourceRootDir = 'D:\\BlockUpdate'; // REMOVED: No longer reading from a separate source
const publicDocsDir = path.join(__dirname, '..', 'public', 'docs'); // Directory to scan
const treeDataPath = path.join(__dirname, '..', 'src', 'doc-tree.json'); // Output JSON path

function parseIgnoreFile(dir) {
    const ignoreFilePath = path.join(dir, '.ignore');
    if (fs.existsSync(ignoreFilePath)) {
        try {
            return fs.readFileSync(ignoreFilePath, 'utf-8')
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));
        } catch (error) {
            console.error(`Error reading .ignore file at ${ignoreFilePath}:`, error);
            return [];
        }
    }
    return [];
}

// generateSlug is not used in this script version as we are not generating IDs here,
// but keeping it in case it's needed for other logic or future reference.
// function generateSlug(text) { ... }


// buildTree now scans a directory within public/docs
// currentDirNameInPublicDocs: Name of the current directory being processed (relative to publicDocsDir)
// basePathForNode: Base path string to construct the node's 'path' attribute (relative to 'docs/')
function buildTreeFromPublic(currentDirNameInPublicDocs, basePathForNode) {
    const currentAbsolutePath = path.join(publicDocsDir, currentDirNameInPublicDocs);

    if (!fs.existsSync(currentAbsolutePath) || !fs.statSync(currentAbsolutePath).isDirectory()) {
        console.warn(`  [buildTree] Directory not found or not a directory: ${currentAbsolutePath}`);
        return null;
    }

    const items = fs.readdirSync(currentAbsolutePath);
    const ignoredItems = parseIgnoreFile(currentAbsolutePath);

    const node = {
        name: path.basename(currentDirNameInPublicDocs), // Folder name
        type: 'folder',
        path: `docs/${basePathForNode.replace(/\\/g, '/')}`, // Path like 'docs/FolderName' or 'docs/FolderName/SubFolderName'
        children: []
    };

    const files = [];
    const subfolders = [];

    for (const item of items) {
        if (ignoredItems.includes(item) || item === '.ignore' || item.startsWith('.')) {
            continue;
        }

        const itemRelativePathInPublicDocs = path.join(currentDirNameInPublicDocs, item); // e.g., "FolderName/ItemName"
        const itemAbsolutePath = path.join(publicDocsDir, itemRelativePathInPublicDocs);
        const stat = fs.statSync(itemAbsolutePath);

        const newItemBasePathForNode = path.join(basePathForNode, item); // e.g., "FolderName/ItemName"

        if (stat.isDirectory()) {
            const subfolderNode = buildTreeFromPublic(itemRelativePathInPublicDocs, newItemBasePathForNode);
            if (subfolderNode && subfolderNode.children && subfolderNode.children.length > 0) {
                subfolders.push(subfolderNode);
            }
        } else if (item.endsWith('.md')) {
            const match = item.match(/^(\d+)-(.+)\.md$/);
            if (match) {
                const order = parseInt(match[1]);
                const name = match[2];

                files.push({
                    name: name,
                    order: order,
                    fullName: item,
                    type: 'file',
                    path: `docs/${newItemBasePathForNode.replace(/\\/g, '/')}`, // Path like 'docs/FolderName/1-File.md'
                    headings: []
                });
            }
        }
    }

    files.sort((a, b) => a.order - b.order);
    subfolders.sort((a, b) => a.name.localeCompare(b.name));

    node.children = [...files, ...subfolders];
    return node;
}


// Core logic to generate the tree, to be called by main and watcher
async function generateTreeCore() {
    console.log(`--- Starting Tree Generation from ${publicDocsDir} ---`);
    console.log('Will write to treeDataPath:', treeDataPath);

    if (!fs.existsSync(publicDocsDir)) {
        console.error(`Error: Directory ${publicDocsDir} does not exist. Cannot build documentation tree.`);
        fs.writeFileSync(treeDataPath, JSON.stringify([], null, 2));
        console.log(`Wrote empty array to ${treeDataPath} because publicDocsDir does not exist.`);
        return;
    }

    const topLevelTreeNodes = [];
    const publicDocsRootItems = fs.readdirSync(publicDocsDir);
    console.log('Top level items in publicDocsDir:', publicDocsRootItems);

    const ignoredRootItems = parseIgnoreFile(publicDocsDir);
    console.log('Ignored root items:', ignoredRootItems);

    for (const item of publicDocsRootItems) {
        console.log(`Processing top-level item: ${item}`);
        if (ignoredRootItems.includes(item) || item === '.ignore' || item.startsWith('.')) {
            console.log(`  Skipping ignored top-level item: ${item}`);
            continue;
        }

        // item is directly under public/docs, e.g., "ProjectA" or "0-RootFile.md"
        const itemAbsolutePath = path.join(publicDocsDir, item);
        const stat = fs.statSync(itemAbsolutePath);

        if (stat.isDirectory()) {
            // For a top-level directory "ProjectA":
            // currentDirNameInPublicDocs will be "ProjectA"
            // basePathForNode will be "ProjectA" (to form path "docs/ProjectA")
            const folderNode = buildTreeFromPublic(item, item);
            if (folderNode && folderNode.children && folderNode.children.length > 0) {
                topLevelTreeNodes.push(folderNode);
            } else {
                 console.log(`  Skipping top-level folder ${item} as it's empty or null.`);
            }
        } else if (item.endsWith('.md')) {
            const match = item.match(/^(\d+)-(.+)\.md$/);
            if (match) {
                const order = parseInt(match[1]);
                const name = match[2];
                const fileNode = {
                    name: name,
                    order: order,
                    fullName: item,
                    type: 'file',
                    path: `docs/${item.replace(/\\/g, '/')}`, // Path like "docs/0-RootFile.md"
                    headings: []
                };
                topLevelTreeNodes.push(fileNode);
                console.log(`  Added top-level file: ${item}`);
            } else {
                console.log(`  Skipping top-level .md file with invalid name format: ${item}`);
            }
        } else {
            console.log(`  Skipping non-md file/non-directory top-level item: ${item}`);
        }
    }

    // Sort top-level items
    topLevelTreeNodes.sort((a, b) => {
        if (a.type === 'file' && b.type === 'file') return a.order - b.order;
        if (a.type === 'folder' && b.type === 'folder') return a.name.localeCompare(b.name);
        if (a.type === 'file' && b.type === 'folder') return -1; // Files before folders
        if (a.type === 'folder' && b.type === 'file') return 1;  // Folders after
        return 0;
    });
    console.log(`Final topLevelTreeNodes count: ${topLevelTreeNodes.length}`);

    try {
        fs.writeFileSync(treeDataPath, JSON.stringify(topLevelTreeNodes, null, 2));
        console.log(`Docs tree successfully generated at ${treeDataPath}`);
    } catch (writeError) {
        console.error(`Failed to write to ${treeDataPath}:`, writeError);
    }
}

function handleGenerationError(error) {
    console.error("Failed to generate documentation tree:", error);
    try {
        fs.writeFileSync(treeDataPath, JSON.stringify([], null, 2));
        console.log(`Wrote empty tree to ${treeDataPath} due to error.`);
    } catch (writeError) {
        console.error("Failed to write empty tree:", writeError);
    }
}

async function main() {
    const isWatchMode = process.argv.includes('--watch');

    try {
        await generateTreeCore();
    } catch (error) {
        handleGenerationError(error);
        if (!isWatchMode) process.exit(1); // Exit if not watching and error occurs
    }

    if (isWatchMode) {
        console.log(`Watching for changes in ${publicDocsDir}...`);
        const watcher = chokidar.watch(publicDocsDir, {
            ignored:  path => path.includes('.DS_Store') || /(^|[\/\\])\../.test(path), // ignore dotfiles and .DS_Store
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 300, // ms to wait for more changes
                pollInterval: 100
            }
        });

        const regenerate = (event, filePath) => {
            console.log(`Detected ${event} in ${filePath}. Regenerating doc tree...`);
            generateTreeCore().catch(err => {
                handleGenerationError(err); // Log error but keep watcher running
            });
        };

        watcher
            .on('add', regenerate)
            .on('addDir', regenerate)
            .on('change', (filePath) => { // Be more specific for 'change'
                if (path.basename(filePath) === '.ignore' || filePath.endsWith('.md')) {
                    regenerate('change', filePath);
                }
            })
            .on('unlink', regenerate)
            .on('unlinkDir', regenerate);

        process.on('SIGINT', () => {
            console.log('Stopping watcher...');
            watcher.close().then(() => {
                console.log('Watcher stopped.');
                process.exit(0);
            });
        });
    } else {
        // console.log('Doc tree generation complete.'); // Already logged in generateTreeCore
    }
}

// Execute main function
main().catch(error => {
    console.error("Unhandled error during script execution:", error);
    process.exit(1);
});