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
      Loading Markdown...
    </div>
    <div v-else class="empty-placeholder">
      No Markdown content.
    </div>
  </div>
</template>
<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed} from 'vue';
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import { parseMarkdown, splitMarkdownIntoBlocks } from '../services/markdownParser';

const props = defineProps({
  markdownText: {
    type: String,
    required: true,
    default: '',
  },
  useWorker: {
    type: Boolean,
    default: false,
  }
});
const rawBlocks = ref([]);
const isLoading = ref(true);
let markdownWorker = null;
const setupWorker = () => {
  if (props.useWorker && window.Worker) {
    // Vite specific worker loading for type: 'module'
    // markdownWorker = new Worker(new URL('@/workers/markdown.worker.js', import.meta.url), { type: 'module' });
    // For public folder worker:
    markdownWorker = new Worker('/markdown.worker.js', { type: 'module' }); // Make sure public/markdown.worker.js exists

    markdownWorker.onmessage = (e) => {
      const { type, blocks, html, originalId, message } = e.data;

      if (type === 'blocks_splitted') {
        rawBlocks.value = blocks.map(b => ({ ...b, html: '<p>Loading content...</p>' })); // 预填充，避免 key 问题
        isLoading.value = false;
        // 现在逐个请求解析每个块
        rawBlocks.value.forEach(block => {
          if (markdownWorker) { // 检查 worker 是否仍然存在
            markdownWorker.postMessage({ type: 'parse_block', markdownBlock: block });
          }
        });
      } else if (type === 'block_parsed' && originalId) {
        const blockIndex = rawBlocks.value.findIndex(b => b.id === originalId);
        if (blockIndex !== -1) {
          // Vue 3 ref array manipulation: create new array or splice for reactivity
          const newBlocks = [...rawBlocks.value];
          newBlocks[blockIndex] = { ...newBlocks[blockIndex], html };
          rawBlocks.value = newBlocks;
        }
      } else if (type === 'error') {
        console.error('Error from Markdown Worker:', message);
        // 可以选择在这里降级到主线程处理
        isLoading.value = false;
      }
    };

    markdownWorker.onerror = (e) => {
      console.error('Error initializing Markdown Worker:', e);
      isLoading.value = false;
      // Fallback to main thread processing if worker fails
      processMarkdownWithoutWorker(props.markdownText);
      markdownWorker = null; // Disable worker for future operations
    };
  }
};
const processMarkdownWithoutWorker = (text) => {
  isLoading.value = true;
  const splitted = splitMarkdownIntoBlocks(text);
  rawBlocks.value = splitted.map(block => ({
    ...block,
    html: parseMarkdown(block.markdown)
  }));
  isLoading.value = false;
};
const processedBlocks = computed(() => rawBlocks.value);


watch(() => props.markdownText, (newText) => {
  if (!newText) {
    rawBlocks.value = [];
    isLoading.value = false;
    return;
  }
  isLoading.value = true;
  if (props.useWorker && markdownWorker) {
    markdownWorker.postMessage({ type: 'split_text', markdownText: newText });
  } else if (props.useWorker && !markdownWorker && window.Worker) {
    // Worker 应该被初始化但还没好，先尝试初始化
    setupWorker();
    // 等待 worker 初始化后，它会处理 (或者在 mounted 中已经初始化)
    // 更好的做法是确保 worker 准备好后再发送消息
     if (markdownWorker) {
        markdownWorker.postMessage({ type: 'split_text', markdownText: newText });
     } else {
        // Worker 初始化失败或不支持，降级
        processMarkdownWithoutWorker(newText);
     }
  }
  else {
    processMarkdownWithoutWorker(newText);
  }
}, { immediate: true });
onMounted(()=>{
  if(props.useWorker&&window.Worker && !markdownWorker){
    setupWorker();
  }
  const hljsStyledId='hljs-styled';
  if(!document.getElementById(hljsStyledId)){
    const link=document.createElement('link');
    link.id=hljsStyledId;
    link.rel='stylesheet';
    link.href='https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
    document.head.appendChild(link);
  }
});
onBeforeUnmount(()=>{
  if(markdownWorker){
    markdownWorker.terminate();
    markdownWorker = null;
  }
});
</script>
<style lang="scss">
.markdown-renderer-container {
  height: 100%;
  overflow-y: auto;
}
.scroller{
  height: 100%;
}
.scroller-padding {
  height: 20px;
}
.loading-placeholder,.empty-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  font-size: 1.2em;
  color: #888;
}
.markdown-block {
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  &:last-child {
    border-bottom: none;
  }
  h1,h2,h3,h4,h5,h6 {
    margin-top: 1em;
    margin-bottom: 0.5em;
    font-weight: 600;
  }
  h1{font-size: 2em;}
  h2{font-size: 1.75em;}
  h3{font-size: 1.5em;}
  p{
    line-height: 1.6;
    margin-bottom: 1em;
  }
  a{
    color: #0366d6;
    text-decoration: none;
    &:hover{
      text-decoration: underline;
    }
  }
  ul,ol{
    padding-left:2em;
    margin-bottom:1em;
  }
  li{
    margin-bottom:0.25em;
  }
  blockquote{
    margin-left:0;
    padding:0.5em 1em;
    color:#6a737d;
    border-left:0.25em solid #dfe2e5;
    background-color:#f9f9f9;
  }
  code {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
    padding: .2em .4em;
    margin: 0;
    font-size: 85%;
    background-color: rgba(27,31,35,.05);
    border-radius: 3px;
  }
  pre {
    padding: 16px;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    background-color: #f6f8fa;
    border-radius: 3px;
    word-wrap: normal;
    code {
      padding: 0;
      margin: 0;
      font-size: 100%;
      background-color: transparent;
      border-radius: 0;
      white-space: pre;
    }
  }

  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin-top: 0.5em;
    margin-bottom: 0.5em;
  }

  table {
    border-collapse: collapse;
    margin-bottom: 1em;
    width: auto;
    display: block;
    overflow-x: auto;
  }
  th, td {
    border: 1px solid #dfe2e5;
    padding: 6px 13px;
  }
  th {
    font-weight: 600;
    background-color: #f6f8fa;
  }

  hr {
    height: .25em;
    padding: 0;
    margin: 24px 0;
    background-color: #e1e4e8;
    border: 0;
  }
}
</style>