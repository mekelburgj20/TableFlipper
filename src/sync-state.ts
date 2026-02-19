import 'dotenv/config';
import { loginToIScored, findGames, navigateToLineupPage } from './iscored.js';
import { syncActiveGame, syncQueuedGame, syncCompletedGame } from './database.js';
import { logInfo, logError } from './logger.js';

const GAME_TYPES = ['DG', 'WG-VPXS', 'WG-VR', 'MG'];

export async function runStateSync() {
    logInfo('🔄 Starting Tournament State Sync...');
    
    let browser = null;
    try {
        const { browser: b, page } = await loginToIScored();
        browser = b;

        await navigateToLineupPage(page);

        const foundIscoredIds: string[] = [];

        for (const type of GAME_TYPES) {
            logInfo(`🔎 Checking state for ${type}...`);
            const { activeGames, nextGames, completedGames } = await findGames(page, type);
            
            if (activeGames.length > 0) {
                const active = activeGames[0];
                logInfo(`   -> Found iScored Active: ${active.name} (${active.id})`);
                await syncActiveGame(type, active.id, active.name);
                foundIscoredIds.push(active.id);
            } else {
                logInfo(`   -> No active game found on iScored for ${type}.`);
                await syncActiveGame(type, null, null);
            }

            if (nextGames.length > 0) {
                logInfo(`   -> Found ${nextGames.length} queued (hidden) games on iScored for ${type}.`);
                for (const next of nextGames) {
                    await syncQueuedGame(type, next.id, next.name);
                    foundIscoredIds.push(next.id);
                }
            }

            if (completedGames && completedGames.length > 0) {
                logInfo(`   -> Found ${completedGames.length} completed (shown+locked) games on iScored for ${type}.`);
                for (const comp of completedGames) {
                    await syncCompletedGame(type, comp.id, comp.name);
                    foundIscoredIds.push(comp.id);
                }
            }
        }

        // --- Reconciliation Phase ---
        // Mark any game in DB that is ACTIVE or COMPLETED but NOT on iScored as HIDDEN
        const db = await (async () => {
            const { open } = await import('sqlite');
            const sqlite3 = await import('sqlite3');
            const path = await import('path');
            return open({
                filename: path.join(process.cwd(), 'data', 'tableflipper.db'),
                driver: sqlite3.default.Database
            });
        })();

        try {
            if (foundIscoredIds.length > 0) {
                const placeholders = foundIscoredIds.map(() => '?').join(',');
                const result = await db.run(
                    `UPDATE games SET status = 'HIDDEN' 
                     WHERE status IN ('ACTIVE', 'COMPLETED') 
                     AND iscored_game_id NOT IN (${placeholders})`,
                    ...foundIscoredIds
                );
                if (result.changes && result.changes > 0) {
                    logInfo(`🧹 Reconciliation: Marked ${result.changes} missing games as HIDDEN.`);
                }
            }
        } finally {
            await db.close();
        }

        logInfo('✅ State sync completed successfully.');

    } catch (error) {
        logError('❌ State sync failed:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Support running directly
runStateSync().catch(() => process.exit(1));
