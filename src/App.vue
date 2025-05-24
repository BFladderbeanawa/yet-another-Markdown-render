<template>
  <div class="app-container">
    <Sidebar
      :tree="docTree"
      :active-file-path="activeFilePath"
      :active-file-headings="activeFileHeadings"
      :active-scrolled-heading-id="activeScrolledHeadingId"
      :is-collapsed="isSidebarCollapsed"
      @select-file="handleSelectFile"
      @toggle-collapse="isSidebarCollapsed = !isSidebarCollapsed"
      @navigate-to-heading="scrollToHeadingInMarkdownRenderer"
    />
    <main
      :class="['content-area', { 'sidebar-collapsed': isSidebarCollapsed }]"
    >
      <button
        class="sidebar-toggle-main"
        @click="isSidebarCollapsed = !isSidebarCollapsed"
        v-show="isSidebarCollapsed"
      >
        显示侧边栏
      </button>
      <MarkdownRenderer
        v-if="activeFileContent !== null"
        :markdown-text="activeFileContent"
        :base-path="activeFileDir"
        :use-worker="false"
        @active-heading-changed="handleActiveHeadingChanged"
        ref="markdownRendererRef"
        class="markdown-view-wrapper"
      />
      <div v-else-if="isFetchingFile" class="content-placeholder">
        正在加载文章...
      </div>
      <div v-else class="content-placeholder">请从侧边栏选择一篇文章。</div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import Sidebar from './components/Sidebar.vue'
import MarkdownRenderer from './components/MarkdownRenderer.vue' // 你的 MarkdownRenderer 组件
import docTreeDataArray from './doc-tree.json' // 导入生成的树 (数组)
import MarkdownIt from 'markdown-it'
import { slugify } from './services/markdownParser' // 从你的服务导入 slugify

const docTree = ref(docTreeDataArray) // docTreeDataArray 是顶级项目的数组
const activeFilePath = ref(null)
const activeFileContent = ref(null) // 初始化为 null，以区分空内容和未选择
const activeFileHeadings = ref([])
const activeScrolledHeadingId = ref(null)
const isSidebarCollapsed = ref(false)
const isFetchingFile = ref(false) // 用于指示文件正在加载
const markdownRendererRef = ref(null) // 引用 MarkdownRenderer 组件

const mdItForHeadings = new MarkdownIt() // 单独用于提取标题的实例

const activeFileDir = ref('')

function handleActiveHeadingChanged(headingId) {
  activeScrolledHeadingId.value = headingId
}

async function fetchAndPrepareMarkdown(filePath) {
  if (!filePath) {
    activeFilePath.value = null
    activeFileContent.value = null // 设置为 null
    activeFileHeadings.value = []
    isFetchingFile.value = false
    return
  }

  isFetchingFile.value = true
  activeFilePath.value = filePath
  activeFileContent.value = '' // 临时设置为空字符串，让 MarkdownRenderer 显示加载
  activeFileHeadings.value = []
  activeScrolledHeadingId.value = null

  try {
    // filePath 类似于 "docs/ProjectA/1-Intro.md"
    // fetch 需要基于 public 目录的相对路径，所以前面加 /
    const response = await fetch(`/${filePath}`)
    if (!response.ok) {
      throw new Error(`获取 ${filePath} 失败: ${response.statusText}`)
    }
    const markdown = await response.text()
    activeFileContent.value = markdown // 更新内容，触发 MarkdownRenderer
    const lastSlash = filePath.lastIndexOf('/')
    if (lastSlash !== -1) {
      activeFileDir.value = filePath.substring(0, lastSlash + 1) // "docs/BlockUpdate/"
    } else {
      activeFileDir.value = '' // 如果文件在 docs/ 根目录下
    }
    console.log(
      'Active file directory for relative paths:',
      activeFileDir.value
    )

    // 解析 H2/H3 标题 (使用 markdown-it)
    const tokens = mdItForHeadings.parse(markdown, {})
    const headings = []
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      if (
        token.type === 'heading_open' &&
        (token.tag === 'h2' || token.tag === 'h3')
      ) {
        const level = parseInt(token.tag.substring(1))
        const textToken = tokens[i + 1] // heading_open 后面紧跟着 inline token (文本内容)
        if (textToken && textToken.type === 'inline' && textToken.children) {
          const text = textToken.content.trim()
          headings.push({
            level: level,
            text: text,
            // 重要：确保 slugify 与你的 Markdown 渲染器 (或 markdown-it 配置) 生成的 ID 一致
            // 如果 MarkdownRenderer 内部的解析会给标题添加 ID，最好从那里获取或确保逻辑统一
            id: slugify(textToken.content) // 使用 markdownParser.js 中的 slugify
          })
        }
      }
    }
    activeFileHeadings.value = headings
  } catch (error) {
    console.error('加载 Markdown 出错:', error)
    activeFileContent.value = `# 错误\n无法加载 ${filePath} 的内容。\n\n${error.message}`
    activeFileHeadings.value = []
  } finally {
    isFetchingFile.value = false
  }
}

function handleSelectFile(filePath) {
  fetchAndPrepareMarkdown(filePath)
}

// 滚动到 MarkdownRenderer 中的特定标题
// 注意：这假设你的 MarkdownRenderer (或其内部的 markdown-it) 会为标题生成 ID
// 并且这些 ID 与 slugify(text) 生成的一致。
async function scrollToHeadingInMarkdownRenderer(headingId) {
  if (typeof headingId === 'undefined' || headingId === null) {
    console.error(
      'App.vue: scrollToHeadingInMarkdownRenderer called with undefined or null headingId.'
    )
    return
  }

  if (
    markdownRendererRef.value &&
    typeof markdownRendererRef.value.scrollToHeading === 'function'
  ) {
    // 调用 MarkdownRenderer 组件暴露的 scrollToHeading 方法
    markdownRendererRef.value.scrollToHeading(headingId)
  } else {
    console.warn(
      'MarkdownRenderer ref not available or scrollToHeading method not exposed.'
    )
    // Fallback (旧的直接 DOM 操作，可能在虚拟滚动下不可靠)
    await nextTick()
    const rendererContainer = markdownRendererRef.value?.$el
    if (rendererContainer) {
      try {
        const element = rendererContainer.querySelector(
          `#${CSS.escape(headingId)}`
        )
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } else {
          console.warn(
            `Fallback: 在 MarkdownRenderer DOM 中未找到 ID 为 "${headingId}" 的标题。`
          )
        }
      } catch (e) {
        console.error(`Fallback: querySelector error for ID "${headingId}":`, e)
      }
    }
  }
}

onMounted(() => {
  // 可选：自动加载第一个文件
  const findFirstFile = (nodesArray) => {
    for (const node of nodesArray) {
      if (node.type === 'file') return node.path
      if (node.type === 'folder' && node.children) {
        const foundInChild = findFirstFile(node.children)
        if (foundInChild) return foundInChild
      }
    }
    return null
  }
  const firstFile = findFirstFile(docTree.value)
  if (firstFile) {
    // fetchAndPrepareMarkdown(firstFile); // 取消注释以默认加载第一个文件
  }
})
</script>

<style>
/* 全局样式 */
#app {
  padding: 0 0 0 0;
}

body,
html {
  margin: 0;
  padding: 0;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif,
    'Apple Color Emoji', 'Segoe UI Emoji';
  height: 100vh;
  overflow: hidden; /* 防止 body 滚动，让子元素处理滚动 */
  background-color: #f6f8fa; /* 页面背景色，可以根据主题调整 */
}

.app-container {
  display: flex; /* 关键：将 .app-container 设置为 flex 容器 */
  height: 100vh;
  overflow: hidden;
}

.content-area {
  flex-grow: 1; /* 尝试从其父容器 .app-container 获取空间 */
  overflow-y: hidden;
  background-color: #fff;
  display: flex; /* 设置为 flex 容器 */
  flex-direction: column; /* 子项垂直排列 */
}

.content-area.sidebar-collapsed {
  margin-left: 0;
}

.markdown-view-wrapper {
  flex-grow: 1; /* 尝试填满 .content-area 的垂直空间 */
  min-height: 0;
  /* 这里没有直接设置 width 或 flex-basis，所以它应该继承父级的宽度或由 flex 布局决定 */
}

.markdown-block {
  padding-left: 10%;
  padding-right: 10%;
  text-align: left;
}

.content-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  font-size: 1.2em;
  color: #586069;
}

.sidebar-toggle-main {
  position: fixed; /* 或者 absolute,取决于布局 */
  top: 10px;
  left: 10px;
  z-index: 1050; /* 需要高于侧边栏 (如果侧边栏是 fixed/absolute 且未完全隐藏) */
  background: #2ea44f;
  color: white;
  border: 1px solid rgba(27, 31, 36, 0.15);
  padding: 6px 12px;
  font-size: 14px;
  border-radius: 6px;
  cursor: pointer;
  box-shadow:
    0 1px 0 rgba(27, 31, 36, 0.04),
    inset 0 1px 0 hsla(0, 0%, 100%, 0.25);
}
.sidebar-toggle-main:hover {
  background-color: #2c974b;
}
</style>
