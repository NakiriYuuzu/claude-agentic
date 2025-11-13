import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'

/**
 * 配置 marked 渲染器
 * 整合語法高亮和自定義代碼塊渲染
 * 使用官方 marked-highlight 套件 + 完整 GFM 支援
 */

// 創建 Marked 實例並配置 highlight.js
const marked = new Marked(
    markedHighlight({
        emptyLangClass: 'hljs',
        langPrefix: 'hljs language-',
        highlight(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext'
            return hljs.highlight(code, { language }).value
        }
    })
)

// 配置 marked 選項（完整 GFM 支援）
marked.use({
    gfm: true,          // GitHub Flavored Markdown
    breaks: true,       // 換行符轉換為 <br>
    pedantic: false
})

// 自定義渲染器 - 添加複製按鈕到代碼塊
marked.use({
    renderer: {
        code({ text, lang, escaped }) {
            // 取得語言並進行高亮處理
            const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
            const highlighted = hljs.highlight(text, { language }).value

            return `
<div class="code-block-wrapper">
  <pre><code class="hljs language-${ language }">${ highlighted }</code></pre>
  <button
    class="code-copy-btn"
    type="button"
    aria-label="複製代碼"
    title="複製代碼"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </svg>
  </button>
</div>
`.trim()
        }
    }
})

/**
 * 渲染 Markdown 為 HTML
 * @param markdown - Markdown 文字
 * @returns HTML 字串
 */
export function renderMarkdown(markdown: string): string {
    if (!markdown) return ''

    try {
        // 使用同步 parse 方法
        const result = marked.parse(markdown, { async: false })
        return result as string
    } catch (error) {
        console.error('Markdown 渲染錯誤:', error)
        // 如果渲染失敗，至少返回轉義的文字
        return markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }
}
