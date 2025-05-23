<template>
  <aside :class="['sidebar', { collapsed: isCollapsed }]">
    <button @click="$emit('toggle-collapse')" class="collapse-btn" v-show="!isCollapsed" title="折叠/展开侧边栏">
      {{ isCollapsed ? '显示' : '隐藏' }}
    </button>
    <div v-if="!isCollapsed" class="sidebar-content">
      <div class="file-tree">
        <h3 class="sidebar-title">文档导航</h3>
        <!-- 如果 tree 是一个数组，直接遍历 -->
        <TreeItem
          v-for="topItem in tree"
          :key="topItem.path || topItem.name"
          :item="topItem"
          :active-file-path="activeFilePath"
          :depth="0"
          @select-file="path => $emit('select-file', path)"
        />
      </div>
      <div v-if="!isCollapsed && activeFilePath && activeFileHeadings.length > 0" class="article-outline">
        <h4 class="sidebar-title">本文大纲</h4>
        <ul>
          <li
            v-for="heading in activeFileHeadings"
            :key="heading.id"
            :class="`heading-level-${heading.level}`"
            @click="navigateToHeading(heading.id)"
            :title="heading.text"
          >
            {{ heading.text }}
          </li>
        </ul>
      </div>
    </div>
  </aside>
</template>

<script setup>
import TreeItem from './TreeItem.vue';

const props = defineProps({
  tree: Array, // tree 是顶级项目的数组
  activeFilePath: String,
  activeFileHeadings: Array,
  isCollapsed: Boolean
});

const emit = defineEmits(['select-file', 'toggle-collapse', 'navigate-to-heading']);

function navigateToHeading(headingId) {
  emit('navigate-to-heading', headingId);
}
</script>

<style scoped>
.sidebar {
  width: 280px;
  background-color: #f6f8fa; /* GitHub-like sidebar background */
  border-right: 1px solid #d0d7de; /* GitHub-like border */
  padding: 0; /* 改为0，让 sidebar-content 控制内边距 */
  overflow-y: auto;
  transition: width 0.3s ease, padding 0.3s ease;
  height: 100vh;
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  flex-shrink: 0; /* 防止在 flex 布局中被压缩 */
}

.sidebar.collapsed {
  width: 0;
  padding: 0;
  overflow: hidden;
  border-right: none;
}

.sidebar-content {
  padding: 20px 15px; /* 侧边栏内容的内边距 */
  flex-grow: 1;
  overflow-y: auto; /* 如果内容过多，允许滚动 */
}


.collapse-btn {
  display: block; /* 改为块级元素，方便定位和样式 */
  background: #f6f8fa;
  border: 1px solid #d0d7de;
  color: #24292e;
  padding: 8px 12px;
  cursor: pointer;
  text-align: center;
  font-weight: 500;
  margin: 10px auto; /* 居中 */
  width: calc(100% - 30px); /* 按钮宽度 */
  box-sizing: border-box;
  border-radius: 6px;
  transition: background-color 0.2s ease;
}
.collapse-btn:hover {
  background-color: #e1e4e8;
}


.sidebar.collapsed .collapse-btn {
  display: none; /* 折叠时，由 App.vue 中的按钮控制展开 */
}

.sidebar-title {
  font-size: 0.9em;
  color: #57606a; /* GitHub muted color */
  margin-top: 0;
  margin-bottom: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}


.file-tree {
  margin-bottom: 25px;
}

.article-outline {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #d0d7de;
}
.article-outline ul {
  list-style-type: none;
  padding-left: 0;
  margin: 0;
}
.article-outline li {
  padding: 5px 8px;
  cursor: pointer;
  color: #24292e;
  font-size: 0.9em;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background-color 0.15s ease;
}
.article-outline li:hover {
  background-color: #e1e4e8;
  color: #0969da;
}
.article-outline .heading-level-3 {
  padding-left: 20px; /* H3 缩进 */
}
.article-outline .heading-level-2 {
  font-weight: 500; /* H2 可以稍微加粗 */
}
</style>