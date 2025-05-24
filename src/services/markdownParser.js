// src/services/markdownParser.js
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js'; // 如果你需要代码高亮
import mdAnchor from 'markdown-it-anchor'; // 用于添加锚点

// 初始化 markdown-it
const md = new MarkdownIt({
  html: true, // 允许 HTML 标签
  linkify: true, // 自动转换 URL 为链接
  typographer: true, // 启用智能标点替换
  highlight: function (str, lang) { // 代码高亮配置
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code>' +
               hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
               '</code></pre>';
      } catch (__) {}
    }
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>'; // 默认处理
  }
});
md.use(mdAnchor, {
  level: [2, 3], // 只为 H2 和 H3 添加锚点
  slugify: s => slugify(s), // 使用你自定义的 slugify 函数
  permalink: mdAnchor.permalink.headerLink({ // 可选：添加一个永久链接图标/符号
    // class: 'header-anchor', // 自定义class
    // symbol: '#', // 自定义符号
    // srText: 'Permalink to this section' // For screen readers
  })
  // 或者更简单的 permalink: true (会使用默认的符号和行为)
});

/**
 * 将 Markdown 文本解析为 HTML
 * @param {string} markdown - Markdown 字符串
 * @returns {string} HTML 字符串
 */
export function parseMarkdown(markdown) {
  if (typeof markdown !== 'string') return '';
  return md.render(markdown);
}


export function splitMarkdownIntoBlocks(markdownText) {
  if (!markdownText || typeof markdownText !== 'string') return [];

  // 1. 分割 Markdown 文本成初步的块
  // 你的分割逻辑可以保持，但可能需要调整以更好地适应 Markdown 结构。
  // 例如，更可靠的分割可能是基于高阶标题 (H1, H2) 或者水平线。
  // 这里我们使用一个更通用的按空行分割的逻辑，然后处理每个块。
  // 或者，如果你的目标是确保每个 H2/H3 都在其逻辑块内，
  // 而不是用 H2/H3 来分割块，那么分割逻辑会不同。

  // 假设我们希望每个 H1 或 H2 开始一个新块，其他内容归属于前一个块。
  // 这个分割逻辑比较复杂，我们先简化为按较大的空隙分割，
  // 然后在每个块内查找 H2/H3。

  const rawContentBlocks = markdownText
    .split(/\n\s*\n\s*\n+/) // 按两个或更多连续的空行（即至少有三行，中间一行是空的）分割
    .map(blockText => blockText.trim())
    .filter(blockText => blockText.length > 0);

  if (rawContentBlocks.length === 0 && markdownText.trim()) {
    rawContentBlocks.push(markdownText.trim()); // 整个文本作为一个块
  }

  const processedBlocks = [];

  for (let i = 0; i < rawContentBlocks.length; i++) {
    const currentMarkdownBlock = rawContentBlocks[i];
    const containedHeadingIds = [];

    // 2. 解析当前块以提取 H2/H3 标题 ID
    // 使用 markdown-it 的 parse 方法获取 tokens
    const tokens = md.parse(currentMarkdownBlock, {}); // md 实例应已配置 mdAnchor

    tokens.forEach((token, tokenIndex) => {
      if (token.type === 'heading_open' && (token.tag === 'h2' || token.tag === 'h3')) {
        // 方式1: 从 markdown-it-anchor 添加的 attrs 中获取 id
        if (token.attrs) {
          const idAttr = token.attrs.find(attr => attr[0] === 'id');
          if (idAttr && idAttr[1]) {
            containedHeadingIds.push(idAttr[1]); // idAttr[1] 应该是已经 slugify 过的
          }
        }
        // 方式2: 如果 mdAnchor 没有在 parse 阶段就添加 id (通常会)，
        // 或者你需要确保，可以从标题文本重新 slugify。
        // 但最好依赖 mdAnchor 的 slugify 结果以保证一致性。
        /*
        else {
          const nextToken = tokens[tokenIndex + 1];
          if (nextToken && nextToken.type === 'inline' && nextToken.content) {
            containedHeadingIds.push(slugify(nextToken.content));
          }
        }
        */
      }
    });

    processedBlocks.push({
      // 保持或改进你的 ID 生成逻辑，确保唯一性
      id: `block-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      markdown: currentMarkdownBlock,
      containedHeadingIds: containedHeadingIds, // 存储提取到的 H2/H3 ID
      // html: "..." // HTML 将由 MarkdownRenderer 组件或 Worker 生成
    });
  }

  return processedBlocks;
}
// 辅助函数：生成 slug (用于标题 ID)
export function slugify(text) {
  return String(text).toLowerCase()
    .replace(/\s+/g, '-')           // 替换空格为 -
    .replace(/[^\w-]+/g, '')       // 移除所有非单词字符
    .replace(/--+/g, '-')         // 替换多个 - 为单个 -
    .replace(/^-+/, '')             // 从文本开头移除 -
    .replace(/-+$/, '');            // 从文本末尾移除 -
    return `heading-${s}`;
}