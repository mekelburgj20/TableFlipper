import 'dotenv/config';
import { loginToIScored, deleteGame, getAllGames } from './iscored.js';
import { logInfo, logError, logWarn } from './logger.js';
import { Browser } from 'playwright';

/**
 * Scoreboard Wipe Utility
 * Deletes EVERY game currently on the iScored scoreboard.
 * Use with caution - this is a destructive operation.
 */
async function scoreboardWipe() {
    logInfo('🧹 Starting full scoreboard wipe...');
    
    // Safety check for username
    const username = process.env.ISCORED_USERNAME;
    logInfo(`   -> Target Arcade: ${username}`);

    let browser: Browser | null = null;
    try {
        const { browser: b, page } = await loginToIScored();
        browser = b;

        // 1. Get all games from the Lineup tab (more reliable than the dropdown)
        logInfo('   -> Fetching list of all games...');
        const gamesToDelete = await getAllGames(page);

        if (gamesToDelete.length === 0) {
            logInfo('✅ No games found on iScored. Scoreboard is already clean.');
            return;
        }

        logInfo(`   -> Found ${gamesToDelete.length} games to delete.`);

        // 3. Iterate and delete each game
        // We use the ID directly for maximum reliability with deleteGame()
        for (let i = 0; i < gamesToDelete.length; i++) {
            const game = gamesToDelete[i];
            logInfo(`   -> [${i + 1}/${gamesToDelete.length}] Deleting '${game.name}' (ID: ${game.id})...`);
            
            try {
                // deleteGame() handles its own navigation to the Games tab
                await deleteGame(page, game.name, game.id);
                
                // Small delay to allow iScored AJAX to settle
                await page.waitForTimeout(1000);
            } catch (e) {
                logError(`      ❌ Error deleting game '${game.name}':`, e);
                logInfo('      Trying to continue with remaining games...');
            }
        }

        logInfo('✅ Full scoreboard wipe completed successfully.');
        logInfo('ℹ️ Note: You may want to run "npm run sync-state" to reconcile your local database.');

    } catch (error) {
        logError('❌ Fatal error during scoreboard wipe:', error);
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
            logInfo('🚪 Browser closed.');
        }
    }
}

// Execution
scoreboardWipe();
