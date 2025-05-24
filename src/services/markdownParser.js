// src/services/markdownParser.js
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js' // 如果你需要代码高亮
import mdAnchor from 'markdown-it-anchor' // 用于添加锚点

// 辅助函数：生成 slug (用于标题 ID)
// 确保这个 slugify 函数是你项目中统一使用的版本，并且添加了前缀
export function slugify(text) {
  let s = ''
  if (typeof text === 'string' && text.trim() !== '') {
    s = String(text)
      .toLowerCase()
      .replace(/\s+/g, '-') // 替换空格为 -
      .replace(/\./g, '-') // 替换点为 -
      .replace(/[^\w-]+/g, '') // 移除所有非单词字符 (保留字母、数字、下划线、连字符)
      .replace(/--+/g, '-') // 替换多个 - 为单个 -
      .replace(/^-+/, '') // 从文本开头移除 -
      .replace(/-+$/, '') // 从文本末尾移除 -
  }
  if (!s) {
    // 如果处理后 s 为空（例如输入是纯符号或空字符串），给一个默认值
    s = 'untitled-section'
  }
  return `heading-${s}` // <--- 确保有前缀
}

// 初始化 markdown-it
const md = new MarkdownIt({
  html: true, // 允许 HTML 标签
  linkify: true, // 自动转换 URL 为链接
  typographer: true, // 启用智能标点替换
  highlight: function (str, lang) {
    // 代码高亮配置
    if (lang && hljs.getLanguage(lang)) {
      try {
        return (
          '<pre class="hljs"><code>' +
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
          '</code></pre>'
        )
      } catch (__) {}
    }
    return (
      '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>'
    ) // 默认处理
  }
})

// 使用 markdown-it-anchor 插件
md.use(mdAnchor, {
  level: [2, 3], // 只为 H2 和 H3 添加锚点
  slugify: (s) => slugify(s), // <--- 使用本文件定义的 slugify 函数
  permalink: mdAnchor.permalink.headerLink({
    // class: 'header-anchor',
    // symbol: '#',
    // srText: 'Permalink to this section'
  })
})

// 保存原始的渲染规则，以便在自定义规则中调用它们
const originalImageRule =
  md.renderer.rules.image ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options)
  }
const originalLinkOpenRule =
  md.renderer.rules.link_open ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options)
  }

/**
 * 将 Markdown 文本解析为 HTML，并处理相对路径
 * @param {string} markdown - Markdown 字符串
 * @param {string} [basePath=''] - 当前 Markdown 文件所在的目录路径 (相对于 public 目录，例如 "docs/BlockUpdate/")
 * @returns {string} HTML 字符串
 */
export function parseMarkdown(markdown, basePath = '') {
  if (typeof markdown !== 'string') return ''

  // 使用一个环境对象将 basePath 传递给渲染规则
  const renderEnv = { basePath: basePath || '' }

  // 临时覆盖图片渲染规则以处理相对路径
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const srcIndex = token.attrIndex('src')
    let src = token.attrs[srcIndex][1]
    const currentBasePath = env.basePath // 从 env 获取 basePath

    // 检查是否是需要处理的相对路径
    if (src && currentBasePath && !/^(?:[a-z]+:|\/\/|\/|#|data:)/i.test(src)) {
      try {
        // 假设在浏览器环境中执行 (Vue 组件中调用)
        // currentBasePath 是类似 "docs/BlockUpdate/"
        // src 是类似 "./img/Updates.jpg" 或 "img/Updates.jpg"
        let baseForUrlConstructor = window.location.origin // e.g., "http://localhost:5173"
        // 确保 basePath 相对于站点根
        if (currentBasePath.startsWith('/')) {
          baseForUrlConstructor += currentBasePath
        } else {
          baseForUrlConstructor += '/' + currentBasePath
        }
        // 确保基础路径以 '/' 结尾，以便 URL 解析器正确处理相对路径
        if (!baseForUrlConstructor.endsWith('/')) {
          baseForUrlConstructor += '/'
        }

        const resolvedUrl = new URL(src, baseForUrlConstructor)
        // resolvedUrl.pathname 会是 "/docs/BlockUpdate/img/Updates.jpg"
        // 我们希望最终 src 是 "docs/BlockUpdate/img/Updates.jpg" (相对于 public)
        let finalSrc = resolvedUrl.pathname
        if (finalSrc.startsWith('/')) {
          finalSrc = finalSrc.substring(1)
        }
        src = finalSrc.replace(/\/+/g, '/') // 清理多余的斜杠
      } catch (e) {
        console.error(
          'Error resolving relative image path in markdownParser:',
          e,
          'basePath:',
          currentBasePath,
          'src:',
          src
        )
        // 如果解析失败，保持原始 src
      }
      // 更新 token 中的 src 属性
      token.attrs[srcIndex][1] = src
    }
    // 调用原始的图片渲染规则
    return originalImageRule(tokens, idx, options, env, self)
  }

  // 可选：类似地处理链接 (如果你需要)
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const hrefIndex = token.attrIndex('href')
    if (hrefIndex >= 0) {
      let href = token.attrs[hrefIndex][1]
      const currentBasePath = env.basePath
      // 只处理非外部、非锚点、非协议的链接
      if (
        href &&
        currentBasePath &&
        !/^(?:[a-z]+:|\/\/|\/|#|data:)/i.test(href)
      ) {
        // 如果是 .md 文件，你可能想做特殊处理，比如转换为路由链接
        // 这里我们假设也像图片一样解析为相对于 public 的路径
        try {
          let baseForUrlConstructor = window.location.origin
          if (currentBasePath.startsWith('/')) {
            baseForUrlConstructor += currentBasePath
          } else {
            baseForUrlConstructor += '/' + currentBasePath
          }
          if (!baseForUrlConstructor.endsWith('/')) {
            baseForUrlConstructor += '/'
          }

          const resolvedUrl = new URL(href, baseForUrlConstructor)
          let finalHref = resolvedUrl.pathname
          if (finalHref.startsWith('/')) {
            finalHref = finalHref.substring(1)
          }
          href = finalHref.replace(/\/+/g, '/')
        } catch (e) {
          console.error(
            'Error resolving relative link path in markdownParser:',
            e,
            'basePath:',
            currentBasePath,
            'href:',
            href
          )
        }
        token.attrs[hrefIndex][1] = href
      }
    }
    return originalLinkOpenRule(tokens, idx, options, env, self)
  }

  // 使用带有 env 的 render 方法
  const html = md.render(markdown, renderEnv)

  // 注意：由于 md 是一个单例，并且我们修改了它的 renderer.rules，
  // 这些规则会保持被修改的状态，直到下次它们被再次修改。
  // 这对于顺序调用 parseMarkdown 且每次都传入正确的 basePath 是可以的。
  // 如果有并发调用的可能性（例如在 Node.js 服务器端），则需要更小心地处理 md 实例的状态，
  // 或者为每次解析克隆一个新的 md 实例或更精细地管理规则。
  // 在 Vue 组件的生命周期内，通常是顺序的，所以问题不大。

  return html
}

export function splitMarkdownIntoBlocks(markdownText) {
  if (!markdownText || typeof markdownText !== 'string') return []

  const rawContentBlocks = markdownText
    .split(/(\n#{1}\s[^\n]+|\n\n\n+)/g)
    .map((blockText) => blockText.trim())
    .filter((blockText) => blockText.length > 0)

  if (rawContentBlocks.length === 0 && markdownText.trim()) {
    rawContentBlocks.push(markdownText.trim())
  }

  const processedBlocks = []
  // 注意：md.parse 不会应用 renderer.rules。Renderer rules 是在 md.render() 阶段应用的。
  // 所以这里的 md.parse 获取的 tokens 是原始的。
  // mdAnchor 插件会在 parse 阶段修改 tokens 来添加 id 属性。
  const mditForSplit = new MarkdownIt() // 或者复用全局 md，但要清楚它不执行render规则
  mditForSplit.use(mdAnchor, {
    // 确保用于分割的实例也有 anchor 以正确提取ID
    level: [2, 3],
    slugify: (s) => slugify(s)
  })

  for (let i = 0; i < rawContentBlocks.length; i++) {
    const currentMarkdownBlock = rawContentBlocks[i]
    const containedHeadingIds = []

    const html = mditForSplit.render(currentMarkdownBlock)
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html

    const headings = tempDiv.querySelectorAll('h2, h3')
    headings.forEach((heading) => {
      if (heading.id) {
        containedHeadingIds.push(heading.id)
      }
    })

    processedBlocks.push({
      id: `block-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      markdown: currentMarkdownBlock,
      containedHeadingIds
    })
  }
  return processedBlocks
}
