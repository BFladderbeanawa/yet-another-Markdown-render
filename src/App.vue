<template>
  <div id="app-container">
    <header>
      <h1>Markdown Renderer</h1>
      <label>
        <input type="checkbox" v-model="useWorker"> Use Web Worker
      </label>
    </header>
    <main>
      <MarkdownRenderer :markdownText="sampleMarkdown" :use-worker="useWorker" />
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import MarkdownRenderer from './components/MarkdownRenderer.vue';

const useWorker = ref(true); // 默认尝试使用 Worker

const sampleMarkdown = ref(`
# Welcome to Markdown Renderer

This is a **Vue 3** component using \`markdown-it\` for parsing, \`vue-virtual-scroller\` for large documents, and lazy loading for images.

---

## Features

*   Markdown Parsing
*   Virtual Scrolling
*   Image Lazy Loading
*   Syntax Highlighting (via highlight.js)
*   Optional Web Worker for parsing

---

## Example Code Block

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}
greet('World');
\`\`\`

\`\`\`python
def add(a, b):
  return a + b

print(add(5, 3))
\`\`\`

---

## Images

This image will be lazy-loaded:
![Placeholder Kitten](https://placekitten.com/g/800/400)

Another one:
![Placeholder Bear](https://placebear.com/800/450)

---
${Array.from({ length: 50 }).map((_, i) => `
## Section ${i + 1}

This is paragraph number one in section ${i + 1}. It might contain some *italic* or **bold** text.

This is paragraph number two. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

![Random Image ${i}](https://picsum.photos/seed/${i}/600/300)

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
`).join('\n---\n')}

## Final Section

This is the end of the document.
`);

</script>

<style lang="scss">
// Global styles or App specific styles
body, html {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: #f4f4f4;
}

#app-container {
  display: flex;
  flex-direction: column;
  height: 100vh; // Full viewport height
}

header {
  padding: 10px 20px;
  background-color: #333;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  h1 {
    margin: 0;
    font-size: 1.5em;
  }
  label {
    display: flex;
    align-items: center;
    gap: 5px;
  }
}

main {
  flex-grow: 1;
  overflow: hidden; // Important for the virtual scroller's container
  background-color: #fff;
  margin: 10px;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}
</style>