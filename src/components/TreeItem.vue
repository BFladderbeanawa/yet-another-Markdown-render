<template>
  <div class="tree-item" :style="{ 'padding-left': depth * 15 + 'px' }">
    <div v-if="item.type === 'folder'" @click="toggleFolder" :class="['item-label', 'folder-label', { open: isOpen }]" role="button" tabindex="0" @keydown.enter="toggleFolder" @keydown.space.prevent="toggleFolder">
      <span class="icon">{{ isOpen ? "▼" : "►" }}</span>
      <span class="item-name">{{ item.name }}</span>
    </div>
    <div v-else-if="item.type === 'file'" @click="$emit('select-file', item.path)" :class="['item-label', 'file-label', { active: item.path === activeFilePath }]" role="link" tabindex="0" @keydown.enter="$emit('select-file', item.path)" :title="item.name">
      <span class="item-name">{{ item.name }}</span>
    </div>

    <div v-if="item.type === 'folder' && isOpen && item.children && item.children.length" class="item-children">
      <TreeItem v-for="child in item.children" :key="child.path || child.name" :item="child" :active-file-path="activeFilePath" :depth="depth + 1" @select-file="(path) => $emit('select-file', path)" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({
  item: Object,
  activeFilePath: String,
  depth: {
    // 用于控制缩进
    type: Number,
    default: 0,
  },
});
defineEmits(["select-file"]);

// 文件夹默认是否展开，可以根据需求调整（例如，如果路径匹配当前激活文件，则展开父级）
const isOpen = ref(props.item.type === "folder" ? props.depth < 2 : false); // 默认展开前两级文件夹

function toggleFolder() {
  if (props.item.type === "folder") {
    isOpen.value = !isOpen.value;
  }
}

// 如果当前文件在此文件夹下，则自动展开文件夹 (可选逻辑)
// watch(() => props.activeFilePath, (newPath) => {
//   if (props.item.type === 'folder' && newPath && newPath.startsWith(props.item.path)) {
//     isOpen.value = true;
//   }
// });
</script>

<style scoped>
.item-label {
  padding: 6px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 0.95em;
  color: #24292e; /* GitHub 文本颜色 */
  border-radius: 4px;
  transition: background-color 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-label:hover,
.item-label:focus {
  background-color: #e1e4e8; /* GitHub hover 效果 */
  outline: none;
}
.folder-label .icon {
  margin-right: 6px;
  font-size: 0.8em;
  display: inline-block;
  width: 1em;
  color: #57606a; /* 图标颜色 */
}
.file-label.active {
  font-weight: 600;
  color: #0969da; /* GitHub 选中链接颜色 */
  background-color: #ddf4ff; /* GitHub 选中背景 */
}
.item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
