import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
// import 'highlight.js/styles/github-dark.css';

const md = new MarkdownIt({
  html: true,        // 允许 HTML 标签
  xhtmlOut: false,     // 强制括回
  breaks: true,        // 转换段落里的 '\n' 到 <br>。
  langPrefix: 'language-', // 给围栏代码块的 CSS 类名加上前缀
  linkify: true,     // 将类似 URL 的文本自动转换为链接。

  // 启用一些语言中立的替换 + 引号美化
  typographer: true,

  // 高亮函数，会替换默认的 highlight 未指定 lang 和指定 lang 但未找到时，返回原代码块。
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code>' +
               hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
               '</code></pre>';
      } catch (__) {}
    }
    // 使用默认的 escape 进行处理
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
  }
});

// 自定义图片渲染规则以支持懒加载
const defaultImageRenderer = md.renderer.rules.image;
md.renderer.rules.image = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  // 给图片添加 loading="lazy" 属性
  token.attrPush(['loading', 'lazy']);
  // decoding="async" 进一步优化
  token.attrPush(['decoding', 'async']);
  return defaultImageRenderer(tokens, idx, options, env, self);
};


import mdSub from 'markdown-it-sub';
import mdSup from 'markdown-it-sup';
import mdFootnote from 'markdown-it-footnote';
import mdTaskLists from 'markdown-it-task-lists';
md.use(mdSub)
  .use(mdSup)
  .use(mdFootnote)
  .use(mdTaskLists);


export function parseMarkdown(markdownText) {
  if (typeof markdownText !== 'string') {
    return '';
  }
  return md.render(markdownText);
}

// 为了虚拟滚动，我们需要将 Markdown 分割成块
// 这是一个简单的按段落或分隔符分割的例子。
// 你可能需要更复杂的逻辑来确定“块”的边界，例如基于标题。
export function splitMarkdownIntoBlocks(markdownText) {
  if (!markdownText) return [];
  const blocks = markdownText.split(/\n(?=#{1,2})/);
  return blocks.filter(block => block && block.trim() !== '---' && block.trim() !== '').map((block, index) => ({
    id: `block-${index}-${Date.now()}`, // 唯一 ID
    markdown: block.trim(),
    // html: md.render(block.trim()) // 可以在这里预渲染，或者在组件中渲染
  }));
}