import { initializeDatabase, upsertTable, getTable, searchTables, createGameEntry, getActiveGame, updateGameStatus, getNextQueuedGame, setPicker, getPicker, GameRow, setDbFilename } from '../database.js';
import * as path from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';

async function runTests() {
    console.log('🧪 Starting Database Tests...');
    
    // Set test DB filename
    const TEST_DB_NAME = 'test_tableflipper.db';
    setDbFilename(TEST_DB_NAME);
    
    const DB_DIR = path.join(process.cwd(), 'data');
    const TEST_DB_PATH = path.join(DB_DIR, TEST_DB_NAME);

    // Clean up previous test run
    try {
        await fs.unlink(TEST_DB_PATH);
        console.log('   🧹 Cleaned up old test database.');
    } catch (e) {}

    // 1. Initialize
    console.log('   [1/5] Initializing Database...');
    await initializeDatabase();

    // 2. Table Operations
    console.log('   [2/5] Testing Table Operations...');
    await upsertTable({ name: 'Test Table 1', is_atgames: 1, is_wg_vr: 0, is_wg_vpxs: 0 });
    await upsertTable({ name: 'Test Table 2', is_atgames: 0, is_wg_vr: 1, is_wg_vpxs: 1 });
    
    const table1 = await getTable('Test Table 1');
    if (!table1 || table1.is_atgames !== 1) throw new Error('Failed to retrieve Test Table 1 correctly.');
    
    const searchRes = await searchTables('Test', 10, 'atgames');
    if (searchRes.length !== 1 || searchRes[0].name !== 'Test Table 1') throw new Error('Search filtering failed.');
    console.log('       ✅ Table operations pass.');

    // 3. Game Lifecycle
    console.log('   [3/5] Testing Game Lifecycle...');
    // Create a game
    const game = await createGameEntry({ type: 'DG', name: 'Test Game DG' });
    if (!game.id) throw new Error('Game creation failed, no ID returned.');

    // Verify it's queued
    const queued = await getNextQueuedGame('DG');
    if (!queued || queued.id !== game.id) throw new Error('Failed to retrieve queued game.');

    // Set status to ACTIVE
    await updateGameStatus(game.id, 'ACTIVE');
    const active = await getActiveGame('DG');
    if (!active || active.id !== game.id) throw new Error('Failed to activate game.');
    
    // Set status to COMPLETED
    await updateGameStatus(game.id, 'COMPLETED');
    const completed = await getActiveGame('DG');
    if (completed) throw new Error('Game should no longer be active.');
    console.log('       ✅ Game lifecycle pass.');

    // 4. Picker Logic
    console.log('   [4/5] Testing Picker Logic...');
    // Create another queued game
    const game2 = await createGameEntry({ type: 'DG', name: 'Test Game DG 2' });
    
    await setPicker('DG', 'discord_123', 'discord_nom_456');
    const pickerGame = await getPicker('DG');
    
    if (!pickerGame || pickerGame.picker_discord_id !== 'discord_123') throw new Error('Failed to set picker.');
    if (pickerGame.nominated_by_discord_id !== 'discord_nom_456') throw new Error('Failed to set nominator.');
    console.log('       ✅ Picker logic pass.');

    // 5. Cleanup
    console.log('   [5/5] Cleaning up...');
    try {
        await fs.unlink(TEST_DB_PATH);
        console.log('       ✅ Test database deleted.');
    } catch (e) {
        console.warn('       ⚠️ Failed to delete test database:', e);
    }

    console.log('🎉 All Database Tests Passed!');
}

runTests().catch(err => {
    console.error('❌ Test Failed:', err);
    process.exit(1);
});
