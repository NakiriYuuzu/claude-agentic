/**
 * Minimal Workspace Test
 * 測試只用 workspacePath 建立工作空間（其他欄位都不填）
 */

import { DatabaseService } from '../src/services/database.service'

console.log('🧪 Testing minimal workspace creation...\n')

// 使用記憶體資料庫進行測試
const db = new DatabaseService(':memory:')

try {
    // Test 1: 只提供 workspacePath，其他欄位都不填
    console.log('Test 1: Creating workspace with ONLY workspacePath...')
    const minimal = db.createSettings({
        workspacePath: '/test/minimal-workspace'
        // 不提供任何其他欄位
    })

    console.log('✅ Created minimal workspace:')
    console.log('   - workspacePath:', minimal.workspacePath)
    console.log('   - systemPrompt:', minimal.systemPrompt ?? 'undefined')
    console.log('   - allowedTools:', minimal.allowedTools ?? 'undefined')
    console.log('   - agents:', minimal.agents ?? 'undefined')
    console.log('   - mcpServers:', minimal.mcpServers ?? 'undefined')
    console.log('   - hooks:', minimal.hooks ?? 'undefined')

    // Test 2: 只提供 workspacePath + systemPrompt
    console.log('\nTest 2: Creating workspace with workspacePath + systemPrompt only...')
    const partial = db.createSettings({
        workspacePath: '/test/partial-workspace',
        systemPrompt: 'Custom prompt'
    })

    console.log('✅ Created partial workspace:')
    console.log('   - workspacePath:', partial.workspacePath)
    console.log('   - systemPrompt:', partial.systemPrompt)
    console.log('   - agents:', partial.agents ?? 'undefined')

    console.log('\n✅ All tests passed! agents, mcpServers, hooks 都是非必填的！')

} catch (error: any) {
    console.error('\n❌ Test failed:', error.message)
    process.exit(1)
} finally {
    db.close()
}
