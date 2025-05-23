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
    <div v-else class="empty-placeholder">
      无 Markdown 内容。
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed} from 'vue';
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
// 确保这个路径是正确的，指向我们上面创建的 markdownParser.js
import { parseMarkdown, splitMarkdownIntoBlocks } from '../services/markdownParser';

const props = defineProps({
  markdownText: {
    type: String,
    required: true,
    default: '',
  },
  useWorker: { // 控制是否使用 Worker
    type: Boolean,
    default: true, // 默认启用 Worker (如果可用)
  }
});

const rawBlocks = ref([]); // 从 splitMarkdownIntoBlocks 返回的原始块数组
const isLoading = ref(true);
let markdownWorker = null;

const setupWorker = () => {
  if (props.useWorker && window.Worker) {
    // 确保 Worker 路径正确。如果 public/markdown.worker.js 存在:
    markdownWorker = new Worker('/markdown.worker.js', { type: 'module' });

    markdownWorker.onmessage = (e) => {
      const { type, blocks, html, originalId, message } = e.data;

      if (type === 'blocks_splitted') {
        // 预填充 HTML，这样 DynamicScrollerItem 可以立即渲染一些东西
        rawBlocks.value = blocks.map(b => ({ ...b, html: '<p>正在解析块...</p>' }));
        isLoading.value = false;
        // 逐个请求解析每个块
        rawBlocks.value.forEach(block => {
          if (markdownWorker) {
            markdownWorker.postMessage({ type: 'parse_block', markdownBlock: block });
          }
        });
      } else if (type === 'block_parsed' && originalId) {
        const blockIndex = rawBlocks.value.findIndex(b => b.id === originalId);
        if (blockIndex !== -1) {
          // 对于 Vue 3 ref 数组，直接修改或使用 splice 是响应式的
          rawBlocks.value[blockIndex] = { ...rawBlocks.value[blockIndex], html };
        }
      } else if (type === 'error') {
        console.error('Markdown Worker 错误:', message);
        const blockIndex = rawBlocks.value.findIndex(b => b.id === originalId);
        if (blockIndex !== -1) {
           rawBlocks.value[blockIndex].html = `<p style="color: red;">解析块失败: ${message}</p>`;
        }
        // 可以选择在这里对特定块或全局进行降级处理
      } else if (type === 'worker_ready') {
        console.log('Markdown Worker 已准备好。');
        // Worker 准备好后，如果 markdownText 已有值，则触发处理
        if (props.markdownText) {
          markdownWorker.postMessage({ type: 'split_text', markdownText: props.markdownText });
        }
      }
    };

    markdownWorker.onerror = (e) => {
      console.error('初始化 Markdown Worker 时发生错误:', e.message);
      isLoading.value = false;
      // 如果 Worker 失败，则回退到主线程处理
      processMarkdownWithoutWorker(props.markdownText);
      if (markdownWorker) {
        markdownWorker.terminate(); // 确保终止失败的 worker
      }
      markdownWorker = null; // 禁用 Worker
    };
  } else {
    // Worker 不可用或未启用，立即在主线程处理
    processMarkdownWithoutWorker(props.markdownText);
  }
};

// 不使用 Worker 或 Worker 失败时的处理逻辑
const processMarkdownWithoutWorker = (text) => {
  console.log("在主线程处理 Markdown。");
  isLoading.value = true;
  const splittedBlocks = splitMarkdownIntoBlocks(text);
  rawBlocks.value = splittedBlocks.map(block => ({
    ...block,
    html: parseMarkdown(block.markdown) // 使用 markdownParser.js 中的 parseMarkdown
  }));
  isLoading.value = false;
};

// computed 属性，确保 DynamicScroller 总是拿到最新的块列表
const processedBlocks = computed(() => rawBlocks.value);

watch(() => props.markdownText, (newText, oldText) => {
  if (newText === oldText && !isLoading.value) return; // 避免不必要的重复处理

  if (!newText) {
    rawBlocks.value = [];
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  if (props.useWorker && markdownWorker) {
    markdownWorker.postMessage({ type: 'split_text', markdownText: newText });
  } else if (props.useWorker && !markdownWorker && window.Worker) {
    // Worker 尚未初始化，调用 setupWorker
    // setupWorker 内部会在 Worker 准备好后发送消息 (如果 markdownText 有值)
    // 或者在 onMounted 中已调用 setupWorker
    console.log("Worker 正在设置中，稍后将处理文本。");
  } else {
    // Worker 未启用或不可用
    processMarkdownWithoutWorker(newText);
  }
}, { immediate: true }); // immediate: true 确保初始加载时执行

onMounted(() => {
  if (props.useWorker && window.Worker && !markdownWorker) {
    setupWorker(); // 初始化 Worker
  } else if (!props.useWorker || !window.Worker) {
    // 如果不使用 worker 或 worker 不支持，则立即处理（watch 的 immediate 应该已经处理了）
    // 但以防万一，如果初始 markdownText 有值且未处理，这里可以再触发一次
    if (props.markdownText && rawBlocks.value.length === 0) {
        processMarkdownWithoutWorker(props.markdownText);
    }
  }

  // 动态加载 highlight.js 样式 (如果还没有)
  const hljsStyledId = 'hljs-styles'; // 确保 ID 唯一
  if (!document.getElementById(hljsStyledId)) {
    const link = document.createElement('link');
    link.id = hljsStyledId;
    link.rel = 'stylesheet';
    // 你可以选择一个 highlight.js 主题
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'; // 例如 github-dark 主题
    document.head.appendChild(link);
  }
});

onBeforeUnmount(() => {
  if (markdownWorker) {
    markdownWorker.terminate();
    markdownWorker = null;
  }
});
</script>

<style lang="scss"> /* 使用 lang="scss" 需要安装 sass-loader 和 sass */
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
  h1, h2, h3, h4, h5, h6 {
    margin-top: 1.2em;
    margin-bottom: 0.6em;
    font-weight: 600;
    line-height: 1.25;
  }
  h1 { font-size: 2em; padding-bottom: .3em; border-bottom: 1px solid #eaecef; }
  h2 { font-size: 1.6em; padding-bottom: .3em; border-bottom: 1px solid #eaecef; }
  h3 { font-size: 1.3em; }
  h4 { font-size: 1.1em; }

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

  ul, ol {
    padding-left: 2em;
    margin-top: 0;
    margin-bottom: 1em;
  }
  li {
    margin-bottom: 0.3em;
  }
  li > p { // 列表项内的段落
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
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
    padding: .2em .4em;
    margin: 0;
    font-size: 85%;
    background-color: rgba(175, 184, 193, 0.2); // GitHub 内联代码背景
    border-radius: 6px; // GitHub 圆角
  }

  pre { // 代码块容器
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
    padding: 16px;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    background-color: #f6f8fa; // GitHub 代码块背景
    border-radius: 6px; // GitHub 圆角
    margin-bottom: 1em;

    code.hljs { // highlight.js 会给代码块内的 <code> 加上 hljs 类
      padding: 0;
      margin: 0;
      font-size: 100%;
      background-color: transparent; // 继承 pre 的背景
      border-radius: 0;
      white-space: pre; // 保持 pre 的 white-space 行为
      text-align: left;
      display: block; // 确保代码块占满 pre
      color: #24292e; // 默认代码颜色，hljs 会覆盖
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
  th, td {
    border: 1px solid #d0d7de; // GitHub 表格边框颜色
    padding: 8px 12px;
  }
  th {
    font-weight: 600;
    background-color: #f6f8fa; // GitHub 表头背景
  }
  tr:nth-child(2n) { // GitHub 表格条纹
    background-color: #f6f8fa;
  }
  tr {
      background-color: #fff;
      border-top: 1px solid #d0d7de;
  }


  hr {
    height: .25em;
    padding: 0;
    margin: 24px 0;
    background-color: #d0d7de; // GitHub 分割线颜色
    border: 0;
  }
}
</style>