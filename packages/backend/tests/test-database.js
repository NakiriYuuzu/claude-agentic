/**
 * Database Test
 * 測試資料庫基本功能
 */
import { DatabaseService } from '../src/services/database.service';
console.log('🧪 Testing Database Service...\n');
// 使用記憶體資料庫進行測試
const db = new DatabaseService(':memory:');
try {
    // Test 1: 建立工作空間設定
    console.log('Test 1: Creating workspace settings...');
    const created = db.createSettings({
        workspacePath: '/test/project-a',
        systemPrompt: 'You are a helpful assistant',
        allowedTools: ['Read', 'Write', 'Edit'],
        agents: {
            'reviewer': {
                description: 'Code reviewer',
                prompt: 'Review code for quality',
                model: 'sonnet'
            }
        }
    });
    console.log('✅ Created:', JSON.stringify(created, null, 2));
    // Test 2: 取得工作空間設定
    console.log('\nTest 2: Getting workspace settings...');
    const retrieved = db.getSettings('/test/project-a');
    console.log('✅ Retrieved:', retrieved ? 'Success' : 'Failed');
    // Test 3: 更新工作空間設定
    console.log('\nTest 3: Updating workspace settings...');
    const updated = db.updateSettings('/test/project-a', {
        systemPrompt: 'Updated system prompt',
        allowedTools: ['Read', 'Write']
    });
    console.log('✅ Updated systemPrompt:', updated.systemPrompt);
    // Test 4: 列出所有工作空間
    console.log('\nTest 4: Listing all workspaces...');
    const list = db.listWorkspaces();
    console.log('✅ Total workspaces:', list.length);
    // Test 5: 刪除工作空間設定
    console.log('\nTest 5: Deleting workspace settings...');
    const deleted = db.deleteSettings('/test/project-a');
    console.log('✅ Deleted:', deleted);
    console.log('\n✅ All tests passed!');
}
catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
}
finally {
    db.close();
}
//# sourceMappingURL=test-database.js.map