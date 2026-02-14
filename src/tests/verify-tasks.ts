import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { loginToIScored, createGame, findGameByName, hideGame, lockGame } from '../iscored.js';

// --- Configuration ---
const DB_PATH = path.join(process.cwd(), 'data', 'tableflipper.db');
const DISCORD_BOT_FILE = path.join(process.cwd(), 'src', 'discordBot.ts');
const DISCORD_MSG_FILE = path.join(process.cwd(), 'src', 'discord.ts');

async function runStaticChecks() {
    console.log('🔍 --- Starting Static Verification ---');

    // 1. Verify VPXS Sync
    console.log('\n📊 Checking Database for VPXS Tables...');
    try {
        const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
        const result = await db.get('SELECT COUNT(*) as count FROM tables WHERE is_wg_vpxs = 1');
        await db.close();

        if (result && result.count > 0) {
            console.log(`✅ VPXS Sync Verified: Found ${result.count} tables flagged as 'is_wg_vpxs'.`);
        } else {
            console.error('❌ VPXS Sync Failed: No tables found with is_wg_vpxs = 1.');
        }
    } catch (e) {
        console.error('❌ Database Check Error:', e);
    }

    // 2. Verify Emoji Removal
    console.log('\n😊 Checking Codebase for User-Facing Emojis...');
    const filesToCheck = [DISCORD_BOT_FILE, DISCORD_MSG_FILE];
    const forbiddenEmojis = ['✅', '❌', '🟢', '⚪', '⚠️', '👑', '🛑', '🎲', '📝'];
    
    let emojiFail = false;
    for (const file of filesToCheck) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Skip console.log lines
            if (line.trim().startsWith('console.')) continue;
            
            for (const emoji of forbiddenEmojis) {
                if (line.includes(emoji)) {
                    console.warn(`⚠️ Potential Emoji found in ${path.basename(file)}:${i + 1}: ${line.trim()}`);
                    // We just warn because some might be legitimate (e.g. internal logic, though we aimed to remove user-facing ones)
                    // Given the strict instruction "Remove emojis from user-facing messages", verifying strictly is hard via regex 
                    // without false positives in comments/logs. But we filtered console.log.
                    // Let's assume non-console lines with emojis are suspicious.
                    emojiFail = true;
                }
            }
        }
    }
    
    if (!emojiFail) {
        console.log('✅ Emoji Cleanliness Verified (No common emojis found outside console logs).');
    } else {
        console.log('⚠️ Please review the warnings above to ensure no emojis are sent to Discord.');
    }

    // 3. Verify Date Formatting Logic
    console.log('\n📅 Verifying Date Formatting Logic...');
    const mockDate = new Date();
    mockDate.setDate(mockDate.getDate() + 2); // 2 days from now
    mockDate.setHours(12, 0, 0, 0); // Noon

    const formattedTime = mockDate.toLocaleDateString('en-US', {
        year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'America/Chicago'
     }) + ' at ' + mockDate.toLocaleTimeString('en-US', {
         hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago'
     }).toLowerCase() + ' Central';

    console.log(`Input Date: ${mockDate.toISOString()}`);
    console.log(`Formatted Output: "${formattedTime}"`);
    console.log('ℹ️ Verify this matches the expected format: "M/D/YYYY at h:mm(am/pm) Central"');
}

async function runLiveChecks() {
    console.log('\n🚀 --- Starting Live Integration Tests (iScored) ---');
    console.log('⚠️ This will create a game named "AutomatedTestGame" on your iScored account.');

    let browserInstance = null;
    try {
        const { browser, page } = await loginToIScored();
        browserInstance = browser;

        const testGameName = `AutomatedTestGame-${Date.now()}`;
        const testGameType = 'DG';

        console.log(`Testing Game Creation: "${testGameName}" with Tag "${testGameType}"...`);
        
        // Create Game with Tag
        await createGame(page, testGameName, testGameType);

        // Verify Tag
        console.log('Verifying Tag existence...');
        // We need to re-find the game to check it.
        // findGameByName calls extract tags if we modified it to do so? 
        // Our updated findGameByName *can* filter by untagged, but doesn't return tags explicitly in the Game interface yet.
        // But `createGame` succeeded, which implies `addTagToGame` ran.
        // Let's manually inspect the "value" of the input using a similar locator logic.
        
        const game = await findGameByName(page, testGameName);
        if (!game) throw new Error('Game created but not found!');

        const gameRow = await page.frameLocator('#main').locator(`li#${game.id}`);
        const tagInput = gameRow.locator(`input[name="tagInput${game.id}"]`);
        const tagValue = await tagInput.getAttribute('value');

        console.log(`Retrieved Tag Value: ${tagValue}`);
        
        if (tagValue && tagValue.includes(testGameType)) {
            console.log('✅ Tag Verification PASSED: Tag found on game.');
        } else {
            console.error('❌ Tag Verification FAILED: Tag not found.');
        }

        // Cleanup (Hide/Lock is part of creation, maybe we can delete? No delete function yet.)
        // We will just leave it hidden/locked.
        console.log('✅ Live Test Cycle Complete.');

    } catch (error) {
        console.error('❌ Live Test Failed:', error);
    } finally {
        if (browserInstance) await browserInstance.close();
    }
}

async function main() {
    await runStaticChecks();

    if (process.argv.includes('--live')) {
        await runLiveChecks();
    } else {
        console.log('\nℹ️  Skipping Live Checks. Run with `-- --live` to execute Playwright integration tests.');
    }
}

main();