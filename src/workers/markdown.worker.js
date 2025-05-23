// public/markdown.worker.js
// 注意：在 Worker 中，我们不能直接使用 ES 模块的 import 语法导入本地文件 (除非浏览器支持且配置正确)
// 通常，我们会将依赖的函数内联或者使用 importScripts() (对于非模块 Worker)。
// 对于模块类型的 Worker (type: 'module')，现代浏览器支持 import。
// 以下假设 markdownParser.js 的函数可以被某种方式访问，
// 或者更简单地，我们将这些函数直接在 Worker 中定义或复制过来。

// 为了简单和模块化，我们假设可以直接 import (如果你的构建工具和浏览器支持)
// 否则，你需要调整 Worker 的构建或将函数逻辑复制到这里。
// Vite 等现代构建工具通常可以处理模块 Worker 的导入。

let mdWorkerIt; // 单独的 markdown-it 实例，避免主线程和 worker 线程的配置冲突 (如果需要不同配置)
let hljsWorker; // highlight.js 实例

// 初始化函数，确保 markdown-it 和 hljs 只加载一次
async function initializeParser() {
    if (!mdWorkerIt) {
        try {
            const MarkdownItModule = await import('markdown-it');
            mdWorkerIt = new MarkdownItModule.default({ // 注意 .default
                html: true,
                linkify: true,
                typographer: true,
                highlight: function (str, lang) {
                    if (lang && hljsWorker && hljsWorker.getLanguage(lang)) {
                        try {
                            return '<pre class="hljs"><code>' +
                                   hljsWorker.highlight(str, { language: lang, ignoreIllegals: true }).value +
                                   '</code></pre>';
                        } catch (__) {}
                    }
                    return '<pre class="hljs"><code>' + mdWorkerIt.utils.escapeHtml(str) + '</code></pre>';
                }
            });

            const hljsModule = await import('highlight.js/lib/core'); // 核心
            hljsWorker = hljsModule.default;
             // 按需注册语言，或者导入 common 以获得常用语言
            const javascript = await import('highlight.js/lib/languages/javascript');
            const xml = await import('highlight.js/lib/languages/xml'); // HTML, XML
            const css = await import('highlight.js/lib/languages/css');
            const python = await import('highlight.js/lib/languages/python');
            const java = await import('highlight.js/lib/languages/java');
            const bash = await import('highlight.js/lib/languages/bash');
            // ... 注册更多你需要的语言
            hljsWorker.registerLanguage('javascript', javascript.default);
            hljsWorker.registerLanguage('xml', xml.default);
            hljsWorker.registerLanguage('css', css.default);
            hljsWorker.registerLanguage('python', python.default);
            hljsWorker.registerLanguage('java', java.default);
            hljsWorker.registerLanguage('bash', bash.default);

        } catch (e) {
            console.error('Worker: Failed to load markdown-it or highlight.js:', e);
            throw e; // 抛出错误，让调用者知道初始化失败
        }
    }
}


// 从 markdownParser.js 复制/调整这些函数
// 或者如果模块导入可行，则直接使用它们
function workerParseMarkdown(markdown) {
  if (!mdWorkerIt) {
    console.warn("Worker: markdown-it not initialized for parseMarkdown.");
    return `<p>Error: Parser not ready.</p>`;
  }
  if (typeof markdown !== 'string') return '';
  return mdWorkerIt.render(markdown);
}

function workerSplitMarkdownIntoBlocks(markdownText) {
  if (!markdownText || typeof markdownText !== 'string') return [];
   // 使用与主线程 markdownParser.js 中相同的 splitMarkdownIntoBlocks 逻辑
   // 这里为了简化，我们假设它与上面 markdownParser.js 中的版本一致
   // 你应该确保这两处的逻辑是同步的，或者通过某种方式共享。
   //  (为简洁起见，此处省略了分割逻辑的重复代码，实际应包含)
   // 这是一个非常基础的分割逻辑，你可以根据你的需求改进它
    const blocks = markdownText
    .split(/(\n#{1,2}\s[^\n]+|\n\n\n+)/g) 
    .reduce((acc, part, index, arr) => {
      if (index % 2 === 0) { 
        if (part.trim()) {
          acc.push({ id: `worker-block-${acc.length}-${Date.now()}`, markdown: part.trim() });
        }
      } else { 
        const lastBlock = acc[acc.length - 1];
        if (lastBlock && part.trim()) {
           if (part.startsWith('\n#')) {
             acc.push({ id: `worker-block-${acc.length}-${Date.now()}`, markdown: part.trim() });
           }
        }
      }
      return acc;
    }, [])
    .filter(block => block.markdown);

  if (blocks.length === 0 && markdownText.trim()) {
    return [{ id: `worker-block-0-${Date.now()}`, markdown: markdownText.trim() }];
  }
  return blocks.map((block, index) => ({ ...block, id: `worker-block-${index}-${Date.now()}-${Math.random().toString(36).substring(2,7)}`}));
}


// 监听来自主线程的消息
self.onmessage = async (e) => {
  const { type, markdownText, markdownBlock } = e.data;

  try {
    await initializeParser(); // 确保解析器已初始化

    if (type === 'split_text') {
      if (!markdownText) {
        self.postMessage({ type: 'blocks_splitted', blocks: [] });
        return;
      }
      const blocks = workerSplitMarkdownIntoBlocks(markdownText);
      self.postMessage({ type: 'blocks_splitted', blocks });
    } else if (type === 'parse_block') {
      if (!markdownBlock || !markdownBlock.markdown) {
         self.postMessage({ type: 'block_parsed', html: '', originalId: markdownBlock.id });
         return;
      }
      const html = workerParseMarkdown(markdownBlock.markdown);
      self.postMessage({ type: 'block_parsed', html, originalId: markdownBlock.id });
    }
  } catch (error) {
    console.error('Worker error:', error);
    self.postMessage({ type: 'error', message: error.message, originalId: markdownBlock ? markdownBlock.id : null });
  }
};

// 发送一个信号表明 worker 已准备好 (可选)
self.postMessage({ type: 'worker_ready' });