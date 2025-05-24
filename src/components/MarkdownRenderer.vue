<template>
  <div class="markdown-renderer-container" ref="containerRef">
    <DynamicScroller
      :items="processedBlocks"
      :min-item-size="50"
      class="scroller"
      key-field="id"
      v-if="processedBlocks.length > 0"
    >
      <template v-slot="{ item, index, active }">
        <DynamicScrollerItem
          :item="item"
          :active="active"
          :size-dependencies="[item.html]"
          :data-index="index"
        >
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="markdown-block" v-html="item.html"></div>
        </DynamicScrollerItem>
      </template>
      <template #before>
        <div class="scroller-padding"></div>
      </template>
      <template #after>
        <div class="scroller-padding"></div>
      </template>
    </DynamicScroller>
    <div v-else-if="isLoading" class="loading-placeholder">
      正在加载 Markdown...
    </div>
    <div v-else class="empty-placeholder">无 Markdown 内容。</div>
  </div>
</template>

<script setup>
import {
  ref,
  watch,
  onMounted,
  onBeforeUnmount,
  computed,
  nextTick,
  onUpdated
} from 'vue'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
// 导入你的解析服务
import {
  parseMarkdown,
  splitMarkdownIntoBlocks
} from '../services/markdownParser' // 确保路径正确

const props = defineProps({
  markdownText: {
    type: String,
    required: true,
    default: ''
  },
  useWorker: {
    type: Boolean,
    default: true // 假设你想默认启用 Worker (如果它实现了 basePath 处理)
  },
  basePath: {
    // 从 App.vue 传递过来
    type: String,
    default: ''
  }
})

const emit = defineEmits(['active-heading-changed'])

const containerRef = ref(null)
const scrollerRef = ref(null)
const rawBlocks = ref([]) // 包含 id, markdown, containedHeadingIds, html
const isLoading = ref(true)
let markdownWorker = null

const headingsInView = ref([]) // 用于 scrollspy

const collectHeadings = () => {
  if (!containerRef.value || !scrollerRef.value || !scrollerRef.value.$el)
    return
  const scrollableView = scrollerRef.value.$el // DynamicScroller 的根滚动元素
  const headingElements = scrollableView.querySelectorAll('h2[id], h3[id]') // 在滚动器内部查找
  const newHeadings = []
  const scrollContainerTop = scrollableView.getBoundingClientRect().top

  headingElements.forEach((el) => {
    newHeadings.push({
      id: el.id,
      // 正确计算相对于滚动容器顶部的 offsetTop
      top:
        el.getBoundingClientRect().top -
        scrollContainerTop +
        scrollableView.scrollTop
    })
  })
  headingsInView.value = newHeadings.sort((a, b) => a.top - b.top)
  // console.log('Collected headings for scrollspy:', headingsInView.value);
}

const setupWorker = () => {
  if (props.useWorker && window.Worker) {
    // 根据当前环境自动选择正确的Worker路径
    let workerPath = './markdown.worker.js';
    
    // 在开发环境下，可能需要使用绝对路径
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      workerPath = '/markdown.worker.js';
    }
    
    console.log('初始化Markdown Worker，路径:', workerPath);
    markdownWorker = new Worker(workerPath, { type: 'module' })

    markdownWorker.onmessage = (e) => {
      const { type, blocks, html, originalId, message } = e.data

      if (type === 'blocks_splitted_from_worker') {
        // 假设 worker 返回分割好的块
        rawBlocks.value = blocks.map((b) => ({
          ...b,
          html: '<p>正在解析块...</p>'
        }))
        isLoading.value = false
        rawBlocks.value.forEach((block) => {
          if (markdownWorker) {
            // 向 worker 请求解析单个块时，也传递 basePath
            markdownWorker.postMessage({
              type: 'parse_block_from_worker',
              markdownBlock: {
                id: block.id,
                markdown: block.markdown,
                containedHeadingIds: block.containedHeadingIds
              }, // 传递整个块信息
              basePath: props.basePath // <--- 传递 basePath
            })
          }
        })
      } else if (type === 'block_parsed_from_worker' && originalId) {
        const blockIndex = rawBlocks.value.findIndex((b) => b.id === originalId)
        if (blockIndex !== -1) {
          rawBlocks.value[blockIndex].html = html
        }
      } else if (type === 'error_from_worker') {
        console.error('Markdown Worker 错误:', message, originalId)
        if (originalId) {
          const blockIndex = rawBlocks.value.findIndex(
            (b) => b.id === originalId
          )
          if (blockIndex !== -1) {
            rawBlocks.value[blockIndex].html =
              `<p style="color: red;">解析块失败: ${message}</p>`
          }
        }
      } else if (type === 'worker_ready') {
        console.log('Markdown Worker 已准备好。')
        if (props.markdownText) {
          // 当 worker 准备好时，发送整个文本进行分割和初步处理
          markdownWorker.postMessage({
            type: 'split_text_in_worker', // Worker 需要处理这个消息类型
            markdownText: props.markdownText,
            basePath: props.basePath // <--- 传递 basePath
          })
        }
      }
    }

    markdownWorker.onerror = (e) => {
      console.error('初始化 Markdown Worker 时发生错误:', e.message)
      isLoading.value = false
      processMarkdownWithoutWorker(props.markdownText, props.basePath) // 传递 basePath
      if (markdownWorker) markdownWorker.terminate()
      markdownWorker = null
    }
  } else {
    // 如果不使用 Worker 或浏览器不支持，立即在主线程处理
    // watch 的 immediate:true 应该会处理初始加载，这里作为后备
    if (
      props.markdownText &&
      rawBlocks.value.length === 0 &&
      !isLoading.value
    ) {
      processMarkdownWithoutWorker(props.markdownText, props.basePath)
    } else if (!props.markdownText) {
      isLoading.value = false // 如果没文本，也不在加载状态
    }
  }
}

const processMarkdownWithoutWorker = (text, currentBasePath) => {
  // console.log("在主线程处理 Markdown, basePath:", currentBasePath);
  isLoading.value = true
  // 1. 分割块 (splitMarkdownIntoBlocks 不需要 basePath，因为它只提取 ID 和原始 markdown)
  const splittedBlocks = splitMarkdownIntoBlocks(text)

  // 2. 为每个块渲染 HTML (parseMarkdown 需要 basePath 来处理相对路径)
  rawBlocks.value = splittedBlocks.map((block) => ({
    ...block,
    html: parseMarkdown(block.markdown, currentBasePath) // <--- 使用导入的 parseMarkdown 并传递 basePath
  }))
  isLoading.value = false
  // DOM 更新后收集标题
  nextTick().then(collectHeadings)
}

// computed 属性现在很简单，因为 HTML 是在 rawBlocks 中直接更新的
const processedBlocks = computed(() => rawBlocks.value)

watch(
  () => [props.markdownText, props.basePath],
  async (newValues, oldValues) => {
    const [newText, newBasePath] = newValues || []
    const [oldText, oldBasePath] = oldValues || []
    // 避免不必要的重复处理，除非文本或基础路径实际改变
    if (
      newText === oldText &&
      newBasePath === oldBasePath &&
      !isLoading.value &&
      rawBlocks.value.length > 0
    ) {
      // console.log("MarkdownRenderer: Text and basePath unchanged, skipping re-processing.");
      return
    }

    if (!newText) {
      rawBlocks.value = []
      isLoading.value = false
      headingsInView.value = [] // 清空标题
      return
    }

    console.log(
      `MarkdownRenderer: Processing new text or basePath. UseWorker: ${props.useWorker}, Worker available: ${!!markdownWorker}`
    )
    isLoading.value = true
    if (props.useWorker && markdownWorker) {
      // 告诉 worker 处理新的文本和 basePath
      markdownWorker.postMessage({
        type: 'split_text_in_worker', // Worker 需要处理这个消息类型
        markdownText: newText,
        basePath: newBasePath // <--- 传递 basePath
      })
    } else if (
      props.useWorker &&
      !markdownWorker &&
      typeof window !== 'undefined' &&
      window.Worker
    ) {
      // Worker 尚未初始化 (可能在 onMounted 中会初始化)
      // onMounted 中的 setupWorker 会在 worker_ready 后发送初始文本
      console.log(
        'MarkdownRenderer: Worker is being set up or not ready, text processing deferred.'
      )
    } else {
      // Worker 未启用或不可用
      processMarkdownWithoutWorker(newText, newBasePath)
    }
  },
  { immediate: true, deep: true }
) // immediate 确保初始加载, deep 对 basePath (如果是对象)

let lastActiveHeadingId = null
const handleScroll = (event) => {
  if (!headingsInView.value.length || !event.target) return
  const scrollPosition = event.target.scrollTop
  let currentActiveId = null
  const threshold = parseInt(event.target.offsetHeight * 0.2) || 60 // 视口高度的20%或60px

  for (let i = headingsInView.value.length - 1; i >= 0; i--) {
    const heading = headingsInView.value[i]
    if (heading.top <= scrollPosition + threshold) {
      currentActiveId = heading.id
      break
    }
  }
  if (
    currentActiveId === null &&
    headingsInView.value.length > 0 &&
    scrollPosition < headingsInView.value[0].top
  ) {
    // currentActiveId = headingsInView.value[0].id; // 可选：激活第一个
  }

  if (currentActiveId !== lastActiveHeadingId) {
    emit('active-heading-changed', currentActiveId)
    lastActiveHeadingId = currentActiveId
  }
}

// 用于父组件调用的滚动方法
const scrollToHeading = async (headingId) => {
  if (!headingId) {
    // 降级日志级别，减少控制台输出
    // console.warn('No heading ID provided for scrolling.')
    return
  }

  const scrollToElement = () => {
    const container = containerRef.value
    if (!container) return false

    const element = container.querySelector(`#${CSS.escape(headingId)}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return true
    }
    return false
  }

  if (scrollToElement()) {
    return
  }

  if (
    !scrollerRef.value ||
    !processedBlocks.value ||
    processedBlocks.value.length === 0
  ) {
    // 降级日志级别，减少控制台输出
    // console.warn('Scroller or blocks not ready for scrolling to heading.')
    return
  }

  let targetBlockIndex = -1
  for (let i = 0; i < processedBlocks.value.length; i++) {
    const block = processedBlocks.value[i]
    if (
      block.containedHeadingIds &&
      block.containedHeadingIds.includes(headingId)
    ) {
      targetBlockIndex = i
      break
    }
  }

  if (targetBlockIndex !== -1) {
    // 滚动到包含标题的块
    scrollerRef.value.scrollToItem(targetBlockIndex)

    // 等待滚动完成后再尝试滚动到具体元素
    const maxAttempts = 5
    let attempts = 0

    const tryScrollToElement = () => {
      attempts++
      if (scrollToElement() || attempts >= maxAttempts) {
        return
      }
      setTimeout(tryScrollToElement, 100)
    }

    setTimeout(tryScrollToElement, 100)
  } else {
    // 降级日志级别，减少控制台输出
    // console.warn(`Block containing heading ID '${headingId}' not found.`)
  }
}

defineExpose({ scrollToHeading }) // 暴露给父组件

onMounted(() => {
  if (
    props.useWorker &&
    typeof window !== 'undefined' &&
    window.Worker &&
    !markdownWorker
  ) {
    setupWorker()
  } else if (
    !props.useWorker ||
    (typeof window !== 'undefined' && !window.Worker)
  ) {
    // 如果 watch 的 immediate:true 没有因为某些原因在 markdownText 初始有值时触发处理
    if (
      props.markdownText &&
      rawBlocks.value.length === 0 &&
      !isLoading.value
    ) {
      console.log('onMounted: Triggering initial main thread processing.')
      processMarkdownWithoutWorker(props.markdownText, props.basePath)
    } else if (!props.markdownText) {
      isLoading.value = false
    }
  }

  const hljsStyledId = 'hljs-styles'
  if (
    typeof document !== 'undefined' &&
    !document.getElementById(hljsStyledId)
  ) {
    const link = document.createElement('link')
    link.id = hljsStyledId
    link.rel = 'stylesheet'
    link.href =
      'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
    document.head.appendChild(link)
  }

  // 监听 scrollerRef.value.$el 的滚动事件，而不是 containerRef
  // 因为 DynamicScroller 内部有自己的滚动机制
  if (scrollerRef.value && scrollerRef.value.$el) {
    scrollerRef.value.$el.addEventListener('scroll', handleScroll, {
      passive: true
    })
  } else {
    // 如果 scrollerRef.$el 还没准备好，稍后尝试（或在 onUpdated 中）
    // 但通常 onMounted 时 ref 应该可用了
    watch(scrollerRef, (newScrollerRef) => {
      if (newScrollerRef && newScrollerRef.$el) {
        newScrollerRef.$el.removeEventListener('scroll', handleScroll) // 先移除旧的，以防万一
        newScrollerRef.$el.addEventListener('scroll', handleScroll, {
          passive: true
        })
      }
    })
  }
})

// 当组件更新后，如果 DOM 结构变化导致标题位置改变，重新收集
onUpdated(() => {
  // collectHeadings 可能会频繁调用，考虑防抖或仅在特定条件下调用
  // 例如，仅在 rawBlocks.value 变化后，且不是由于 html 更新导致的小变化
  // 简单起见，每次更新后都收集，但对于大型文档要注意性能
  // console.log("onUpdated triggered, re-collecting headings.");
  // nextTick(collectHeadings); // 确保 DOM 已经更新完毕
})

onBeforeUnmount(() => {
  if (markdownWorker) {
    markdownWorker.terminate()
    markdownWorker = null
  }
  if (scrollerRef.value && scrollerRef.value.$el) {
    // 从 scroller 卸载事件
    scrollerRef.value.$el.removeEventListener('scroll', handleScroll)
  }
})
</script>

<style lang="scss">
/* 使用 lang="scss" 需要安装 sass-loader 和 sass */
.markdown-renderer-container {
  height: 100%; // 继承 .markdown-view-wrapper 的高度
  overflow-y: auto; // 如果内部内容超出则滚动
  background-color: #fff;
  /* 这里也没有 width 设置，期望它能自然撑满父容器的宽度 */
}

.scroller {
  height: 100%; /* 确保 scroller 占满容器高度 */
}

.scroller-padding {
  height: 20px; /* 虚拟列表上下留白 */
}

.loading-placeholder,
.empty-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  font-size: 1.2em;
  color: #777;
  padding: 20px;
  text-align: center;
}

.markdown-block {
  padding: 10px 15px; // 块的内边距
  border-bottom: 1px solid #e0e0e0; // 块之间的分隔线 (可选)

  &:last-child {
    border-bottom: none;
  }

  // --- 从你原来的样式中迁移并调整 ---
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin-top: 1.2em;
    margin-bottom: 0.6em;
    font-weight: 600;
    line-height: 1.25;
  }
  h1 {
    font-size: 2em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid #eaecef;
  }
  h2 {
    font-size: 1.6em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid #eaecef;
  }
  h3 {
    font-size: 1.3em;
  }
  h4 {
    font-size: 1.1em;
  }

  p {
    line-height: 1.7;
    margin-bottom: 1em;
  }

  a {
    color: #0969da; // GitHub 蓝色
    text-decoration: none;
    &:hover {
      text-decoration: underline;
    }
  }

  ul,
  ol {
    padding-left: 2em;
    margin-top: 0;
    margin-bottom: 1em;
  }
  li {
    margin-bottom: 0.3em;
  }
  li > p {
    // 列表项内的段落
    margin-bottom: 0.2em;
  }

  blockquote {
    margin: 1em 0;
    padding: 0.5em 1em;
    color: #57606a; // GitHub 引用颜色
    border-left: 0.25em solid #d0d7de; // GitHub 引用边框颜色
    background-color: #f6f8fa; // GitHub 引用背景色
    & > :first-child {
      margin-top: 0;
    }
    & > :last-child {
      margin-bottom: 0;
    }
  }

  code {
    font-family:
      'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
    padding: 0.2em 0.4em;
    margin: 0;
    font-size: 85%;
    //background-color: rgba(175, 184, 193, 0.2); // GitHub 内联代码背景
    border-radius: 6px; // GitHub 圆角
  }

  pre {
    // 代码块容器
    font-family:
      'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
    padding: 16px;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    background-color: #525252; // GitHub 代码块背景
    border-radius: 6px; // GitHub 圆角
    margin-bottom: 1em;

    code.hljs {
      // highlight.js 会给代码块内的 <code> 加上 hljs 类
      padding: 0;
      margin: 0;
      font-size: 100%;
      background-color: transparent; // 继承 pre 的背景
      border-radius: 0;
      white-space: pre; // 保持 pre 的 white-space 行为
      text-align: left;
      display: block; // 确保代码块占满 pre
      // color: #24292e; // 默认代码颜色，hljs 会覆盖
    }
  }

  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin-top: 0.8em;
    margin-bottom: 0.8em;
    background-color: #fff; // 如果图片有透明背景，在暗色主题下可能需要
  }

  table {
    border-collapse: collapse;
    margin: 1em 0;
    width: auto; // 或者 max-width: 100%; display: block; overflow-x: auto;
    display: block;
    max-width: fit-content; // 尝试让表格内容决定宽度，但仍可滚动
    overflow-x: auto; // 超出时可水平滚动
    border-spacing: 0;
  }
  th,
  td {
    border: 1px solid #d0d7de; // GitHub 表格边框颜色
    padding: 8px 12px;
  }
  th {
    font-weight: 600;
    background-color: #f6f8fa; // GitHub 表头背景
  }
  tr:nth-child(2n) {
    // GitHub 表格条纹
    background-color: #f6f8fa;
  }
  tr {
    background-color: #fff;
    border-top: 1px solid #d0d7de;
  }

  hr {
    height: 0.25em;
    padding: 0;
    margin: 24px 0;
    background-color: #d0d7de; // GitHub 分割线颜色
    border: 0;
  }
}
</style>
