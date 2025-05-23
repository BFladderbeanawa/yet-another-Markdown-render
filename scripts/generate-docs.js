// scripts/generate-docs.js
import fs from 'fs-extra'; // 使用 import
import path from 'path';   // 使用 import
import { fileURLToPath } from 'url'; // 用于获取 __dirname

// 获取在 ES 模块中的 __filename 和 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 【重要配置】你的 Markdown 源文件夹路径
const sourceRootDir = 'D:\\GraduateTextsInTechnicalMC'; // <--- 修改为你实际的 Markdown 源文件夹
// Vue 项目 public 目录下的目标文件夹，用于存放复制后的 .md 文件
const publicDocsDir = path.join(__dirname, '..', 'public', 'docs');
// 生成的 JSON 树数据的存放路径
const treeDataPath = path.join(__dirname, '..', 'src', 'doc-tree.json');

/**
 * 解析 .ignore 文件内容
 * @param {string} dir 目录路径
 * @returns {string[]} 忽略的文件/文件夹名称列表
 */
function parseIgnoreFile(dir) {
    const ignoreFilePath = path.join(dir, '.ignore');
    if (fs.existsSync(ignoreFilePath)) {
        return fs.readFileSync(ignoreFilePath, 'utf-8')
            .split(/\r?\n/) // 处理 Windows 和 Unix 换行符
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#')); // 忽略空行和注释
    }
    return [];
}

/**
 * 构建目录树的核心函数
 * @param {string} currentSourceDir 当前处理的源目录
 * @param {string} currentPublicRelativePath 当前目录在 public/docs 下的相对路径
 * @returns {object | null} 目录节点对象
 */
function buildTree(currentSourceDir, currentPublicRelativePath) {
    const items = fs.readdirSync(currentSourceDir);
    const ignoredItems = parseIgnoreFile(currentSourceDir);

    const node = {
        name: path.basename(currentSourceDir),
        type: 'folder',
        path: `docs/${currentPublicRelativePath.replace(/\\/g, '/')}`,
        children: []
    };

    const files = [];
    const subfolders = [];

    for (const item of items) {
        if (ignoredItems.includes(item) || item === '.ignore' || item.startsWith('.')) {
            continue;
        }

        const sourceItemPath = path.join(currentSourceDir, item);
        const itemPublicPathSegment = path.join(currentPublicRelativePath, item);
        const stat = fs.statSync(sourceItemPath);

        if (stat.isDirectory()) {
            const subfolderNode = buildTree(sourceItemPath, itemPublicPathSegment);
            if (subfolderNode && subfolderNode.children.length > 0) {
                subfolders.push(subfolderNode);
            }
        } else if (item.endsWith('.md')) {
            const match = item.match(/^(\d+)-(.+)\.md$/);
            if (match) {
                const order = parseInt(match[1]);
                const name = match[2];
                const targetFilePath = path.join(publicDocsDir, itemPublicPathSegment);

                fs.ensureDirSync(path.dirname(targetFilePath));
                fs.copySync(sourceItemPath, targetFilePath);

                files.push({
                    name: name,
                    order: order,
                    fullName: item,
                    type: 'file',
                    path: `docs/${itemPublicPathSegment.replace(/\\/g, '/')}`,
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

/**
 * 主执行函数
 */
async function main() {
    console.log(`正在清理旧的文档目录: ${publicDocsDir}...`);
    await fs.emptyDir(publicDocsDir);

    console.log(`正在从 ${sourceRootDir} 的顶级项目构建目录树...`);

    const topLevelTreeNodes = [];
    const sourceRootItems = fs.readdirSync(sourceRootDir);
    const ignoredRootItems = parseIgnoreFile(sourceRootDir);

    for (const item of sourceRootItems) {
        if (ignoredRootItems.includes(item) || item === '.ignore' || item.startsWith('.')) {
            continue;
        }

        const sourceItemPath = path.join(sourceRootDir, item);
        const stat = fs.statSync(sourceItemPath);

        if (stat.isDirectory()) {
            const folderNode = buildTree(sourceItemPath, item);
            if (folderNode && folderNode.children.length > 0) {
                topLevelTreeNodes.push(folderNode);
            }
        } else if (item.endsWith('.md')) {
            const match = item.match(/^(\d+)-(.+)\.md$/);
            if (match) {
                const order = parseInt(match[1]);
                const name = match[2];
                const targetFilePath = path.join(publicDocsDir, item);

                fs.ensureDirSync(path.dirname(targetFilePath));
                fs.copySync(sourceItemPath, targetFilePath);

                topLevelTreeNodes.push({
                    name: name,
                    order: order,
                    fullName: item,
                    type: 'file',
                    path: `docs/${item.replace(/\\/g, '/')}`,
                    headings: []
                });
            }
        }
    }

    topLevelTreeNodes.sort((a, b) => {
        if (a.type === 'file' && b.type === 'file') {
            return a.order - b.order;
        }
        if (a.type === 'folder' && b.type === 'folder') {
            return a.name.localeCompare(b.name);
        }
        if (a.type === 'file' && b.type === 'folder') return -1;
        if (a.type === 'folder' && b.type === 'file') return 1;
        return 0;
    });

    // 使用 fs.writeJSONSync 来确保目录存在，或者继续使用 writeFileSync
    // fs.writeJSONSync(treeDataPath, topLevelTreeNodes, { spaces: 2 });
    fs.writeFileSync(treeDataPath, JSON.stringify(topLevelTreeNodes, null, 2));
    console.log(`文档树已生成: ${treeDataPath} (现在是一个顶级项目数组)`);
    console.log(`Markdown 文件已复制到: ${publicDocsDir}`);
}

main().catch(error => {
    console.error("生成文档时发生错误:", error);
    process.exit(1);
});