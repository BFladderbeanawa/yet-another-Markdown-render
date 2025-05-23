// src/services/markdownParser.js
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js'; // 如果你需要代码高亮

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

/**
 * 将 Markdown 文本解析为 HTML
 * @param {string} markdown - Markdown 字符串
 * @returns {string} HTML 字符串
 */
export function parseMarkdown(markdown) {
  if (typeof markdown !== 'string') return '';
  return md.render(markdown);
}

/**
 * 将 Markdown 文本分割成块。
 * 这里是一个简化的示例，你可以根据需要定义“块”的逻辑。
 * 例如，可以按标题、水平线或自定义分隔符分割。
 * 为了与你的 MarkdownRenderer.vue 更好地配合，这里的分割逻辑可能需要更复杂，
 * 例如，按空行、标题等有意义的结构分割。
 * 此处简化为按一级或二级标题分割，或者按多个空行分割。
 */
export function splitMarkdownIntoBlocks(markdownText) {
  if (!markdownText || typeof markdownText !== 'string') return [];

  // 这是一个非常基础的分割逻辑，你可以根据你的需求改进它
  // 例如，可以按特定标记物分割，或者更智能地按内容结构分割
  // 这个例子尝试按一级、二级标题或连续三个以上换行符分割
  const blocks = markdownText
    .split(/(\n#{1,2}\s[^\n]+|\n\n\n+)/g) // 按标题或多个空行分割，并保留分隔符
    .reduce((acc, part, index, arr) => {
      if (index % 2 === 0) { // 主内容部分
        if (part.trim()) {
          acc.push({ id: `block-${acc.length}-${Date.now()}`, markdown: part.trim() });
        }
      } else { // 分隔符部分 (标题或空行)
        const lastBlock = acc[acc.length - 1];
        if (lastBlock && part.trim()) {
           // 将标题作为新块的开始，或者附加到前一个块（取决于你的逻辑）
           // 这里我们选择将标题作为新块的开始
           if (part.startsWith('\n#')) {
             acc.push({ id: `block-${acc.length}-${Date.now()}`, markdown: part.trim() });
           } else if (lastBlock) {
             // 如果是空行分隔符，并且前一个块存在，可以将后续内容视为新块（如果前面已有内容）
             // 或者，可以将分隔符附加到前一个块（若要保留空行）
             // 简单起见，这里的空行分隔符会导致后续内容成为新块 (如果它非空)
           }
        }
      }
      return acc;
    }, [])
    .filter(block => block.markdown); // 移除空的 markdown 块

  // 如果没有有效分割，则整个文本作为一个块
  if (blocks.length === 0 && markdownText.trim()) {
    return [{ id: `block-0-${Date.now()}`, markdown: markdownText.trim() }];
  }
  
  // 确保每个块都有唯一的 ID
  return blocks.map((block, index) => ({ ...block, id: `block-${index}-${Date.now()}-${Math.random().toString(36).substring(2,7)}`}));
}

// 辅助函数：生成 slug (用于标题 ID)
export function slugify(text) {
  return String(text).toLowerCase()
    .replace(/\s+/g, '-')           // 替换空格为 -
    .replace(/[^\w-]+/g, '')       // 移除所有非单词字符
    .replace(/--+/g, '-')         // 替换多个 - 为单个 -
    .replace(/^-+/, '')             // 从文本开头移除 -
    .replace(/-+$/, '');            // 从文本末尾移除 -
}