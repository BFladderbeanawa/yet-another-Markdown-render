<template>
  <aside :class="['sidebar', { collapsed: isCollapsed }]">
    <!-- 折叠按钮调整为更小，更靠边 -->
    <button
      v-if="!isCollapsed"
      @click="$emit('toggle-collapse')"
      class="collapse-btn"
      title="折叠侧边栏"
      aria-label="折叠侧边栏"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-chevron-left"><polyline points="15 18 9 12 15 6"></polyline></svg>
    </button>

    <div v-if="!isCollapsed" class="sidebar-content">
      <div class="file-tree-section">
        <h3 class="sidebar-section-title">文档导航</h3>
        <TreeItem
          v-for="topItem in tree"
          :key="topItem.path || topItem.name"
          :item="topItem"
          :active-file-path="activeFilePath"
          :depth="0"
          :active-file-headings="activeFileHeadings"         
          :active-scrolled-heading-id="activeScrolledHeadingId" 
          @select-file="(path) => $emit('select-file', path)"
          @navigate-to-heading="navigateToHeading"        
        />
      </div>
      <!-- 移除固定的 article-toc-section，它现在会内嵌在 TreeItem 中 -->
      <!--
      <nav v-if="activeFilePath && activeFileHeadings.length > 0" class="article-toc-section">
        ...
      </nav>
      -->
    </div>
  </aside>
</template>

<script setup>
import TreeItem from './TreeItem.vue';

const props = defineProps({
  tree: Array,
  activeFilePath: String,
  activeFileHeadings: Array,
  isCollapsed: Boolean,
  activeScrolledHeadingId: String
});

const emit = defineEmits([
  'select-file',
  'toggle-collapse',
  'navigate-to-heading'
]);

function navigateToHeading(headingId) { // 这个函数现在由 TreeItem 内部的TOC触发，再emit给App
  emit('navigate-to-heading', headingId);
}
</script>

<style scoped lang="scss"> /* 使用 SCSS */
.sidebar {
  width: 260px; /* 可以调整宽度 */
  background-color: #f8f9fa; /* 更中性的浅灰色 */
  border-right: 1px solid #dee2e6; /* 边框颜色 */
  padding: 0; /* 由 sidebar-content 控制内边距 */
  overflow-y: auto;
  transition: width 0.25s ease-in-out;
  height: 100vh;
  box-sizing: border-box;
  position: relative; /* 为了 collapse-btn 的定位 */
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  font-size: 14px; /* 基础字体大小 */
}

.sidebar.collapsed {
  width: 0;
  overflow: hidden;
  border-right: none;
}

.sidebar-content {
  padding: 20px 0; /* 上下内边距，左右由各 section 控制 */
  flex-grow: 1;
  overflow-y: auto;
}

.collapse-btn {
  position: absolute;
  top: 15px;
  right: 0px; /* 按钮一半在侧边栏内，一半在外，更像 Docsify */
  width: 24px;
  height: 24px;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  padding: 0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  color: #495057; // 图标颜色

  &:hover {
    background-color: #f1f3f5;
    color: #007bff;
  }

  svg {
    width: 16px;
    height: 16px;
  }
}
.sidebar.collapsed .collapse-btn {
  display: none;
}

.file-tree-section,
.article-toc-section {
  padding-left: 20px;  /* 统一左边距 */
  padding-right: 15px; /* 右边距 */
}

.file-tree-section {
  margin-bottom: 24px; /* 文件树和页内目录之间的间距 */
}

.sidebar-section-title { // 用于 "文档导航" 和 "本文内容"
  font-size: 0.85em;    // 标题小一点
  color: #6c757d;     // 柔和的灰色
  margin-top: 0;
  margin-bottom: 10px;
  font-weight: 600;
  text-transform: uppercase; // 大写
  letter-spacing: 0.5px;   // 轻微字间距
  padding-left: 0; // 标题本身不额外缩进
}

.toc-list {
  list-style-type: none;
  padding-left: 0;
  margin: 0;
}

.toc-item {
  display: block;
  padding: 5px 0; // 上下内边距，左右缩进由层级 class 控制
  margin-left: 5px; // 基础左外边距，用于创建第一级缩进感
  font-size: 0.95em; // 页内目录字体比文件树稍小
  color: #495057;   // 默认文字颜色
  text-decoration: none;
  border-radius: 3px;
  cursor: pointer;
  line-height: 1.5;
  transition: color 0.15s ease, font-weight 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    color: #007bff; // 悬停时文字颜色
  }

  &.active-heading {
    color: #007bff;   // 激活项文字颜色
    font-weight: 600; // 激活项加粗
    // 可以考虑在这里添加一个细微的左边框，模仿某些文档站点的风格
    // border-left: 2px solid #007bff;
    // padding-left: calc(current-padding-left - 2px); // 如果加了border，调整padding
  }

  &.toc-level-2 {
    // padding-left: 0; // 基础缩进由 margin-left 提供
  }
  &.toc-level-3 {
    margin-left: 20px; // H3 进一步缩进 (相对于父级 ul/li)
                      // 或者用 padding-left: 15px; （相对于 toc-level-2 的最终 padding）
  }
  &.toc-level-4 {
    margin-left: 35px; // H4 再进一步缩进
                      // 或者用 padding-left: 30px;
  }
}

.toc-text {
  // 如果需要，可以包裹文本以应用特定样式，但通常直接在 .toc-item 上设置即可
}
</style>