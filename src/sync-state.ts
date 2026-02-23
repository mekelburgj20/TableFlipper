import 'dotenv/config';
import { loginToIScored, getAllGames, TOURNAMENT_TAG_KEYS, navigateToLineupPage } from './iscored.js';
import { syncActiveGame, syncQueuedGame, syncCompletedGame, reconcileGames } from './database.js';
import { triggerLineupRepositioning, syncAllActiveStyles } from './maintenance.js';
import { logInfo, logError } from './logger.js';
import { fileURLToPath } from 'url';

const GAME_TYPES = ['DG', 'WG-VPXS', 'WG-VR', 'MG'];

export async function runStateSync() {
    logInfo('🔄 Starting Tournament State Sync...');
    
    let browser = null;
    try {
        const { browser: b, page } = await loginToIScored();
        browser = b;

        // --- Phase 1: Style Learning ---
        // Learn styles for all currently active tables before syncing state
        // Pass the current page to avoid double-login
        await syncAllActiveStyles(page);

        const allGames = await getAllGames(page);
        logInfo(`   -> Found ${allGames.length} total games on iScored lineup.`);

        const foundIscoredIds: string[] = [];
        const processedIds = new Set<string>();

        // 1. Process Tournament Grinds first (to ensure they get correct types)
        for (const type of GAME_TYPES) {
            logInfo(`🔎 Identifying ${type} games...`);
            const tagKey = TOURNAMENT_TAG_KEYS[type] || type;

            for (const game of allGames) {
                // Skip if already processed (though a game shouldn't have multiple grind tags ideally)
                if (processedIds.has(game.id)) continue;

                // Identification Logic:
                // 1. Check for the formal Tag Key (Primary)
                // 2. Fallback to Name Suffix (Legacy/Human) - only if name ends with it
                const tagMatch = game.tags?.some(t => t.toUpperCase().includes(tagKey.toUpperCase()));
                const nameMatch = game.name.toUpperCase().endsWith(' ' + type.toUpperCase());

                if (tagMatch || nameMatch) {
                    logInfo(`      - Found ${type}: ${game.name} (${game.id})`);
                    
                    if (game.isHidden) {
                        await syncQueuedGame(type, game.id, game.name);
                    } else if (!game.isHidden && !game.isLocked) {
                        await syncActiveGame(type, game.id, game.name);
                    } else if (!game.isHidden && game.isLocked) {
                        await syncCompletedGame(type, game.id, game.name);
                    }
                    
                    foundIscoredIds.push(game.id);
                    processedIds.add(game.id);
                }
            }
        }

        // 2. Process all other games as 'OTHER' type
        logInfo(`🔎 Identifying non-tournament games...`);
        for (const game of allGames) {
            if (processedIds.has(game.id)) continue;

            logInfo(`      - Found OTHER: ${game.name} (${game.id})`);
            
            // For 'OTHER' games, we follow simple visibility/lock rules
            if (!game.isHidden && !game.isLocked) {
                await syncActiveGame('OTHER', game.id, game.name);
            } else if (!game.isHidden && game.isLocked) {
                await syncCompletedGame('OTHER', game.id, game.name);
            } else {
                await syncQueuedGame('OTHER', game.id, game.name);
            }

            foundIscoredIds.push(game.id);
            processedIds.add(game.id);
        }

        // Handle case where a tournament type has NO active games on iScored
        for (const type of GAME_TYPES) {
            const hasActive = allGames.some(g => {
                const tagKey = TOURNAMENT_TAG_KEYS[type] || type;
                const tagMatch = g.tags?.some(t => t.toUpperCase().includes(tagKey.toUpperCase()));
                const nameMatch = g.name.toUpperCase().endsWith(' ' + type.toUpperCase());
                return (tagMatch || nameMatch) && !g.isHidden && !g.isLocked;
            });

            if (!hasActive) {
                logInfo(`   -> No active games found on iScored for ${type}. Cleared active state in DB.`);
                await syncActiveGame(type, null, null);
            }
        }

        // --- Reconciliation Phase ---
        // Mark any game in DB that is ACTIVE, COMPLETED, or QUEUED but NOT on iScored as HIDDEN
        await reconcileGames(foundIscoredIds);

        logInfo('✅ State sync completed successfully.');

        // Trigger lineup repositioning after sync
        await triggerLineupRepositioning();

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
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runStateSync().catch(() => process.exit(1));
}
