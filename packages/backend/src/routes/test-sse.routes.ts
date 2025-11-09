/**
 * SSE Test Page Routes
 * 提供 SSE 測試介面
 */

import { Elysia } from 'elysia'
import { html } from '@elysiajs/html'

export const createTestSSERoutes = () => new Elysia()
    .use(html())
    .get('/test-sse', () => {
        return (
            `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SSE Query Tester - Claude Agent API</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }
        .header p {
            opacity: 0.9;
            font-size: 14px;
        }
        .form-section {
            padding: 30px;
            border-bottom: 1px solid #e0e0e0;
        }
        .form-group {
            margin-bottom: 20px;
        }
        .form-group label {
            display: block;
            font-weight: 600;
            margin-bottom: 8px;
            color: #333;
        }
        .form-group input,
        .form-group textarea,
        .form-group select {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 6px;
            font-size: 14px;
            transition: border-color 0.3s;
        }
        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
            outline: none;
            border-color: #667eea;
        }
        .form-group textarea {
            min-height: 100px;
            resize: vertical;
            font-family: inherit;
        }
        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        .btn-group {
            display: flex;
            gap: 10px;
        }
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            flex: 1;
        }
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        .btn-secondary {
            background: #f5f5f5;
            color: #666;
        }
        .btn-secondary:hover {
            background: #e0e0e0;
        }
        .output-section {
            padding: 30px;
            background: #f9f9f9;
        }
        .output-section h2 {
            margin-bottom: 20px;
            color: #333;
            font-size: 20px;
        }
        .status-bar {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px;
            background: white;
            border-radius: 6px;
            margin-bottom: 20px;
            border-left: 4px solid #667eea;
        }
        .status-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #ccc;
        }
        .status-indicator.connected {
            background: #4caf50;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .log-container {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
            border-radius: 6px;
            max-height: 500px;
            overflow-y: auto;
            font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
            font-size: 13px;
            line-height: 1.6;
        }
        .log-entry {
            margin-bottom: 12px;
            padding: 8px;
            border-left: 3px solid transparent;
            border-radius: 3px;
        }
        .log-entry.init { border-left-color: #4caf50; background: rgba(76, 175, 80, 0.1); }
        .log-entry.session_init { border-left-color: #2196f3; background: rgba(33, 150, 243, 0.1); }
        .log-entry.assistant_message { border-left-color: #ff9800; background: rgba(255, 152, 0, 0.1); }
        .log-entry.result { border-left-color: #9c27b0; background: rgba(156, 39, 176, 0.1); }
        .log-entry.complete { border-left-color: #4caf50; background: rgba(76, 175, 80, 0.1); }
        .log-entry.error { border-left-color: #f44336; background: rgba(244, 67, 54, 0.1); }
        .log-timestamp {
            color: #888;
            font-size: 11px;
            margin-right: 10px;
        }
        .log-event {
            color: #4ec9b0;
            font-weight: bold;
            margin-right: 10px;
        }
        .log-content {
            color: #ce9178;
        }
        pre {
            margin: 8px 0;
            padding: 8px;
            background: #2d2d2d;
            border-radius: 4px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 SSE Query Tester</h1>
            <p>測試 Claude Agent API 的 Server-Sent Events 串流功能</p>
        </div>

        <div class="form-section">
            <form id="queryForm">
                <div class="form-group">
                    <label for="workspacePath">Workspace Path *</label>
                    <input
                        type="text"
                        id="workspacePath"
                        name="workspacePath"
                        placeholder="/Users/yuuzu/projects/my-app"
                        value="/Users/yuuzu/HanaokaYuuzu/Ai/claude-code/claude-agentic"
                        required
                    >
                </div>

                <div class="form-group">
                    <label for="prompt">Prompt *</label>
                    <textarea
                        id="prompt"
                        name="prompt"
                        placeholder="請輸入您的查詢..."
                        required
                    >列出當前目錄的所有檔案</textarea>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="model">Model (Optional)</label>
                        <select id="model" name="model">
                            <option value="">預設</option>
                            <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
                            <option value="claude-opus-4-20250514">Claude Opus 4</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="permissionMode">Permission Mode (Optional)</label>
                        <select id="permissionMode" name="permissionMode">
                            <option value="">預設</option>
                            <option value="default">Default</option>
                            <option value="plan">Plan</option>
                            <option value="acceptEdits">Accept Edits</option>
                            <option value="bypassPermissions">Bypass Permissions</option>
                        </select>
                    </div>
                </div>

                <div class="btn-group">
                    <button type="submit" class="btn btn-primary" id="startBtn">
                        🚀 開始查詢
                    </button>
                    <button type="button" class="btn btn-secondary" id="clearBtn">
                        🗑️ 清除日誌
                    </button>
                </div>
            </form>
        </div>

        <div class="output-section">
            <h2>📊 即時輸出</h2>
            <div class="status-bar">
                <div class="status-indicator" id="statusIndicator"></div>
                <span id="statusText">準備就緒</span>
            </div>
            <div class="log-container" id="logContainer">
                <div style="color: #888; text-align: center; padding: 40px;">
                    等待查詢開始...
                </div>
            </div>
        </div>
    </div>

    <script>
        const form = document.getElementById('queryForm')
        const startBtn = document.getElementById('startBtn')
        const clearBtn = document.getElementById('clearBtn')
        const logContainer = document.getElementById('logContainer')
        const statusIndicator = document.getElementById('statusIndicator')
        const statusText = document.getElementById('statusText')

        let eventSource = null

        // 清除日誌
        clearBtn.addEventListener('click', () => {
            logContainer.innerHTML = '<div style="color: #888; text-align: center; padding: 40px;">日誌已清除</div>'
        })

        // 格式化時間
        function formatTime(date) {
            return date.toLocaleTimeString('zh-TW', { hour12: false })
        }

        // 添加日誌
        function addLog(event, data) {
            const time = formatTime(new Date())
            const entry = document.createElement('div')
            entry.className = \`log-entry \${event}\`

            let content = ''
            if (typeof data === 'string') {
                content = data
            } else {
                content = JSON.stringify(data, null, 2)
            }

            entry.innerHTML = \`
                <span class="log-timestamp">\${time}</span>
                <span class="log-event">\${event.toUpperCase()}</span>
                <div class="log-content"><pre>\${content}</pre></div>
            \`

            // 移除 "等待查詢開始" 提示
            if (logContainer.firstChild && logContainer.firstChild.style) {
                logContainer.innerHTML = ''
            }

            logContainer.appendChild(entry)
            logContainer.scrollTop = logContainer.scrollHeight
        }

        // 更新狀態
        function updateStatus(connected, text) {
            if (connected) {
                statusIndicator.classList.add('connected')
            } else {
                statusIndicator.classList.remove('connected')
            }
            statusText.textContent = text
        }

        // 提交表單
        form.addEventListener('submit', async (e) => {
            e.preventDefault()

            // 關閉舊的連接
            if (eventSource) {
                eventSource.close()
            }

            // 準備請求數據
            const formData = new FormData(form)
            const queryData = {
                workspacePath: formData.get('workspacePath'),
                prompt: formData.get('prompt'),
                options: {}
            }

            if (formData.get('model')) {
                queryData.options.model = formData.get('model')
            }
            if (formData.get('permissionMode')) {
                queryData.options.permissionMode = formData.get('permissionMode')
            }

            // 發送 POST 請求
            startBtn.disabled = true
            updateStatus(true, '正在連接...')

            try {
                const response = await fetch('/api/query', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(queryData)
                })

                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`)
                }

                updateStatus(true, '✅ 已連接，正在接收數據...')

                // 讀取 SSE 串流
                const reader = response.body.getReader()
                const decoder = new TextDecoder()

                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    const chunk = decoder.decode(value)
                    const lines = chunk.split('\\n\\n')

                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            const eventMatch = line.match(/event: (.+)/)
                            const dataMatch = line.match(/data: (.+)/)

                            if (eventMatch && dataMatch) {
                                const event = eventMatch[1]
                                const data = JSON.parse(dataMatch[1])
                                addLog(event, data)
                            }
                        }
                    }
                }

                updateStatus(false, '✅ 查詢完成')
            } catch (error) {
                addLog('error', \`錯誤: \${error.message}\`)
                updateStatus(false, '❌ 發生錯誤')
            } finally {
                startBtn.disabled = false
            }
        })
    </script>
</body>
</html>`
        )
    }, {
        detail: {
            summary: 'SSE 測試頁面',
            description: '提供圖形化介面測試 SSE 查詢功能',
            tags: ['System']
        }
    })