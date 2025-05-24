// src/components/TreeItem.vue
<template>
  <div class="tree-item-container">
    <!-- 文件或文件夹标签 -->
    <div
      v-if="item.type === 'folder'"
      @click="toggleFolder"
      :class="['item-label', 'folder-label', { open: isOpen }]"
      :style="{ paddingLeft: depth * 18 + 5 + 'px' }"
      role="button" :aria-expanded="isOpen.toString()" tabindex="0"
      @keydown.enter="toggleFolder" @keydown.space.prevent="toggleFolder"
      :title="item.name"
    >
      <span class="icon">{{ isOpen ? '▼' : '►' }}</span>
      <span class="item-name">{{ item.name }}</span>
    </div>

    <div
      v-else-if="item.type === 'file'"
      @click="selectFile"
      :class="['item-label', 'file-label', { active: isActiveFile }]"
      :style="{ paddingLeft: depth * 18 + 5 + 'px' }"
      role="link" tabindex="0"
      @keydown.enter="selectFile" @keydown.space.prevent="selectFile"
      :title="item.name"
    >
      <span class="item-name">{{'#' + item.order + ' ' + item.name}}</span>
    </div>

    <!-- 子文件夹的递归渲染 -->
    <div
      v-if="item.type === 'folder' && isOpen && item.children && item.children.length"
      class="item-children item-children-folders"
    >
      <TreeItem
        v-for="child in item.children"
        :key="child.path || child.name"
        :item="child"
        :active-file-path="activeFilePath"
        :depth="depth + 1"
        :active-file-headings="activeFileHeadings"         
        :active-scrolled-heading-id="activeScrolledHeadingId" 
        @select-file="path => $emit('select-file', path)"
        @navigate-to-heading="id => $emit('navigate-to-heading', id)"
      />
    </div>

    <!-- (D) 新增：如果当前 TreeItem 是激活的文件，则显示其 H2/H3 目录 -->
    <nav
      v-if="isActiveFile && activeFileHeadings && activeFileHeadings.length > 0"
      class="item-children article-toc-embedded"
      :style="{ paddingLeft: (depth + 1) * 18 + 5 + 'px' }"
    >
      <ul class="toc-list-embedded">
        <li
          v-for="heading in activeFileHeadings"
          :key="heading.id"
          :class="[
            'toc-item-embedded',
            `toc-level-${heading.level}`,
            { 'active-heading': heading.id === activeScrolledHeadingId }
          ]"
          @click.stop="navigateToTocHeading(heading.id)"
          role="link" tabindex="0"
          @keydown.enter.stop="navigateToTocHeading(heading.id)"
          @keydown.space.prevent.stop="navigateToTocHeading(heading.id)"
          :title="heading.text"
        >
          <span class="toc-text">{{ heading.text }}</span>
        </li>
      </ul>
    </nav>

  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  item: Object,
  activeFilePath: String,
  depth: { type: Number, default: 0 },
  activeFileHeadings: { type: Array, default: () => [] },         // (E) 接收 props
  activeScrolledHeadingId: { type: String, default: null }     // (F) 接收 props
});
const emit = defineEmits(['select-file', 'navigate-to-heading']); // (G) 声明新事件

const isActiveFile = computed(() => props.item.type === 'file' && props.item.path === props.activeFilePath);

const containsActivePath = computed(() => {
  if (props.item.type !== 'folder' || !props.activeFilePath || !props.item.path) {
    return false;
  }
  // activeFilePath: "docs/Category/Sub/File.md"
  // props.item.path: "docs/Category"
  // 确保 activeFilePath 是以 props.item.path + '/' 开头的，或者是完全相同的路径 (如果文件夹本身可以被选中)
  return props.activeFilePath.startsWith(props.item.path + (props.item.path.endsWith('/') ? '' : '/'));
});
const isOpen = ref(
  props.item.type === 'folder' ? (containsActivePath.value || props.depth < 1) : false
);
watch(containsActivePath, (newValue, oldValue) => {
  if (props.item.type === 'folder' && newValue && !isOpen.value) {
    isOpen.value = true;
  }
  // 可选：如果活动路径移出此文件夹，是否要折叠？
  // else if (props.item.type === 'folder' && !newValue && oldValue && isOpen.value && props.depth >= 1) {
  //   isOpen.value = false; // 如果不再包含活动路径且不是顶层，则折叠
  // }
});



function toggleFolder() {
  if (props.item.type === 'folder') {
    isOpen.value = !isOpen.value;
  }
}
function selectFile() {
    if (props.item.type === 'file') {
        emit('select-file', props.item.path);
    }
}

// (H) 新增：处理 TOC 链接点击
function navigateToTocHeading(headingId) {
  emit('navigate-to-heading', headingId);
}
</script>

<style scoped lang="scss">
/* ... 你的 .item-label, .folder-label, .file-label, .item-name 样式保持不变 ... */
.icon {
  margin-right: 6px;
  font-size: 0.8em;
  display: inline-block;
  width: 1em;
  color: #57606a; /* 图标颜色 */
}

.item-children {
  /* 可以为子项容器添加一些通用样式，如果需要 */
}
.item-children-folders {
  /* 特指文件夹的子项容器，如果需要与TOC的子项容器区分 */
}

.item-name {
  /* 保持文件名样式 */
  font-weight: 500;
  color: #24292e; /* 更深的颜色 */
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  &:hover,
  &:focus {
    color: #0366d6; /* 悬停时颜色 */
  }
}

/* (I) 新增/调整：内嵌的文章目录 (TOC) 样式 */
.article-toc-embedded {
  // paddingLeft 已通过 :style 设置
  // 这个容器的 margin-top 可以用来和文件条目隔开一点距离
  margin-top: 4px;
  margin-bottom: 8px; // 如果下面还有其他文件，可以加点底部间距
}

.toc-list-embedded {
  list-style-type: none;
  padding-left: 0;
  margin: 0;
}

.toc-item-embedded { // 与 Sidebar 中独立的 .toc-item 样式类似，但可能需要微调
  padding: 4px 0; // 调整垂直内边距
  // padding-left 由层级 class 控制
  font-size: 0.9em; // 比文件/文件夹名稍小
  color: #586069;
  text-decoration: none;
  border-radius: 3px;
  cursor: pointer;
  line-height: 1.4;
  transition: color 0.15s ease, font-weight 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover,
  &:focus-visible {
    color: #0366d6;
  }

  &.active-heading {
    color: #0366d6;
    font-weight: 600;
  }

  // 根据 heading.level 设置缩进
  // 注意：这里的 padding-left 是相对于父级 .article-toc-embedded 的 padding-left 的
  // 如果 .article-toc-embedded 已经通过 :style 设置了 (depth + 1) 的缩进，
  // 那么 toc-level-2 的额外 padding-left 应该是 0 或很小的值。
  // toc-level-3 则在这个基础上再增加。
  &.toc-level-2 {
    // padding-left: 0; // 假设基础缩进已由父容器提供
  }
  &.toc-level-3 {
    padding-left: 15px; // H3 比 H2 再多缩进
  }
  &.toc-level-4 {
    padding-left: 30px;
  }
}

.toc-text {
  /* 可以保持为空，或用于特殊文本样式 */
}
</style>