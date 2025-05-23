<template>
  <div class="markdown-renderer-container" ref="containerRef">
    <DynamicScrollerItem
      :items="processedBlocks"
      :min-item-size="50"
      class="scroller"
      key-field="id"
      v-if="processedBlocks.length>0">
      <template v-slot="{item, index, active}">
        <DynamicScrollerItem
          :item="item"
          :active="active"
          size-dependencies="[item.html]"
          :data-index="index"
        >
          <div class="markdown-block" v-html="item.html"></div>
        </DynamicScrollerItem>
      </template>
      <template #before>
        <div class="scroller-padding"></div> 
      </template>
      <template #after>
        <div class="scroller-padding"></div>
      </template>
    </DynamicScrollerItem>
    <div v-else-if="isLoading" class="loading-placeholder">
      Loading Markdown...
    </div>
    <div v-else class="empty-placeholder">
      No Markdown content available.
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
let MarkdownWorker = null;
const setupWorker = () => {
  if(props.useWorker&&window.Worker){
    MarkdownWorker = new Worker('/markdown.worker.js');
    MarkdownWorker.onmessage = (e) => {
      const {id, html, originalId, type, blocks}=e.data;
      if(type==='blocks_splitted'){
        rawBlocks.value=blocks;
        isLoading.value=false;
        rawBlocks.value.forEach(block => {
          MarkdownWorker.postMessage({
            id: 'parse-${block.id}',
            markdownBlock: block
          });
        });
      }else if(originalId && html!==undefined){
        const blockIndex = rawBlocks.value.findIndex(block => block.id === originalId);
        if(blockIndex !== -1){
          const updatedBlock = {
            ...rawBlocks.value[blockIndex],
            html
          };
        }
        const targetBlock = rawBlocks.value.find(block => block.id === originalId);
        if(targetBlock){
          targetBlock.html = html;
        }else{
          console.warn('Block not found:', originalId);
        }
      }
    };
    MarkdownWorker.onerror = (e) => {
      console.error('Worker error:', e);
      isLoading.value = false;
      processedMarkdownWithoutWorker(props.markdownText);
    };
  }
};
const processedMarkdownWithoutWorker = (text) => {
  console.log('Processing markdown on main thread');
  rawBlocks.value = splitMarkdownIntoBlocks(text);
  isLoading.value = false;
}
const processedBlocks = computed(()=>{
  if(props.useWorker&&MarkdownWorker){
    return rawBlocks.value.map(block => ({
      ...block,
      html: block.html || '<p>Loading Blocks...</p>',
    }));
  }else{
    return rawBlocks.value.map(block => ({
      ...block,
      html: parseMarkdown(block.markdownBlock),
    }));
  }
});
watch(() => props.markdownText, (newText) => {
  if(!newText){
    rawBlocks.value = [];
    isLoading.value = true;
    return;
  }
  isLoading.value = true;
  if(props.useWorker && MarkdownWorker){
    MarkdownWorker.postMessage({
      markdownText: newText
    });
  }else{
    processedMarkdownWithoutWorker(newText);
  }
},{immediate: true});
onMounted(()=>{
  if(props.useWorker){
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
  if(MarkdownWorker){
    MarkdownWorker.terminate();
    MarkdownWorker = null;
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
}
</style>