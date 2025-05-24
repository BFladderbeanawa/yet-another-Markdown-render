import MarkdownIt from "markdown-it";

try{
    if(typeof MarkdownIt === 'undefined'){
        importScripts('https://fastly.jsdelivr.net/npm/markdown-it@14.0.0/dist/markdown-it.min.js');
    }
} catch(e){
    console.error('Error loading MarkdownIt in worker:', e);
    self.postMessage({type: 'error_from_worker', message: 'Failed to load MarkdownIt'});
}
try {
  if (typeof hljs === 'undefined') {
    importScripts('https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js');
  }
} catch (e) {
  console.error("Failed to load highlight.js in worker:", e);
}
let md;
if(typeof MarkdownIt !== 'undefined'){
    md = new MarkdownIt({
        html: true,
        xhtmlOut: false,
        breaks: true,
        langPrefix: 'language-',
        linkify: true,
        typographer: true,
        highlight: function (str, lang) {
            if (lang && hljs.getLanguage(lang) && typeof hljs !== 'undefined') {
                try {
                    return '<pre class="hljs"><code>' +
                        hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                        '</code></pre>';
                } catch (__) {}
            }
            return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
        }
    });
    const defaultImageRenderer = md.renderer.rules.image;
    md.renderer.rules.image = function (tokens, idx, options, env, self) {
        const token = tokens[idx];
        token.attrPush(['loading', 'lazy']);
        token.attrPush(['decoding', 'async']);
        return defaultImageRenderer(tokens, idx, options, env, self);
    };
}else{
    md={
        render:(text)=>`<p>Error: Markdown parser not loaded in worker.</p><pre>${text.replace(/</g, '<')}</pre>`,
        utils:{
            escapeHtml:(text)=>text.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, "'")
        }
    };
}
// 在初始化完成后发送准备就绪消息
self.postMessage({ type: 'worker_ready' });

self.onmessage = function (e) {
    const {id, markdownBlock, markdownText, type, basePath} = e.data;
    // 处理从MarkdownRenderer发送的parse_block_from_worker消息
    if ((type === 'parse_block' || type === 'parse_block_from_worker') && markdownBlock){
        try{
            // 确保正确获取markdown文本
            const markdownText = markdownBlock.markdown || ' ';
            const html = md.render(markdownText);
            self.postMessage({id, html, originalId:markdownBlock.id, type:'block_parsed_from_worker'});
        }catch (error) {
            console.error('Error rendering in worker for block:', error);
            self.postMessage({id, html: `<p>Error rendering block: ${markdownBlock.id}</p>`, originalId:markdownBlock.id, type:'error_from_worker', message: error.message});
        }
    }else if ((type === 'split_text' || type === 'split_text_in_worker') && typeof markdownText === 'string') {
    try {
      const blocks = markdownText.split(/\n\s*(\n---|---\n)\s*\n|\n\n+/);
      const processedBlocks = blocks
        .filter(block => block && block.trim() !== '---' && block.trim() !== '')
        .map((block, index) => ({
          id: `worker-block-${index}-${Date.now()}`,
          markdown: block.trim(),
        }));
      self.postMessage({ type: 'blocks_splitted_from_worker', blocks: processedBlocks });
    } catch (error) {
      console.error('Error splitting markdown in worker:', error);
      self.postMessage({ type: 'error_from_worker', message: 'Failed to split markdown text' });
    }
  }
};