import { Browser, Page } from 'playwright';
import { loginToIScored, lockGame, showGame, navigateToLineupPage, deleteGame, findGames, Game as IscoredGame } from './iscored.js';
import { getWinnerAndScoreFromPage, getStandingsFromPage } from './api.js';
import { checkWinnerHistory, updateWinnerHistory } from './history.js';
import { sendDiscordNotification } from './discord.js';
import { getDiscordIdByIscoredName } from './userMapping.js';
import { getActiveGame, getNextQueuedGame, updateGameStatus, setPicker, createGameEntry, GameRow, hasScores, saveScores, getGameByIscoredId, syncCompletedGame } from './database.js';
import { logInfo, logError, logWarn } from './logger.js';

const ALL_GAME_TYPES = ['DG', 'WG-VPXS', 'WG-VR', 'MG'];

export async function triggerAllMaintenanceRoutines() {
    logInfo('Manual trigger: Running maintenance for all game types...');

    for (const gameType of ALL_GAME_TYPES) {
        try {
            await runMaintenanceForGameType(gameType);
        } catch (error) {
            logError(`🚨 Error running maintenance for ${gameType} during manual trigger:`, error);
        }
    }
    logInfo('Manual trigger: All maintenance routines completed.');
}

async function cleanupOldGames(page: Page, gameType: string) {
    logInfo(`🧹 Running cleanup sweep for old ${gameType} games...`);
    try {
        // Navigate to Lineup page to find games
        await navigateToLineupPage(page);
        
        const { completedGames } = await findGames(page, gameType);
        
        logInfo(`   -> Found ${completedGames.length} visible locked games to clean up.`);

        for (const game of completedGames) {
            logInfo(`   Processing cleanup for '${game.name}' (ID: ${game.id})...`);
            
            // Check if we have this game in DB
            let dbGame = await getGameByIscoredId(game.id);
            
            // If the game isn't in our DB, we should create a record for it so we can track and delete it.
            if (!dbGame) {
                logInfo(`   -> Game not found in local DB. Importing as COMPLETED to allow cleanup.`);
                await syncCompletedGame(gameType, game.id, game.name);
                dbGame = await getGameByIscoredId(game.id);
            }
            
            if (dbGame) {
                // Check if scores are saved
                const scoresExist = await hasScores(dbGame.id);
                if (!scoresExist) {
                    logInfo(`   -> No scores found in DB. Fetching standings...`);
                    const standings = await getStandingsFromPage(page, game.id, game.name);
                    if (standings.length > 0) {
                        await saveScores(dbGame.id, standings.map(s => ({
                            iscored_username: s.name,
                            score: s.score,
                            rank: s.rank
                        })));
                    }
                    // Re-navigate to Lineup page as getStandings went to public page
                    await navigateToLineupPage(page);
                } else {
                    logInfo(`   -> Scores already exist in DB.`);
                }
                
                // Mark as COMPLETED if not already
                if (dbGame.status !== 'COMPLETED') {
                    await updateGameStatus(dbGame.id, 'COMPLETED');
                }

                // Delete the game from iScored
                await deleteGame(page, game.name, game.id);
                
                // We need to re-navigate to Lineup page because deleteGame goes to Games tab
                await navigateToLineupPage(page);

            } else {
                logError(`❌ Failed to acquire DB record for '${game.name}' (ID: ${game.id}) even after sync. Skipping.`);
            }
        }
        
    } catch (error) {
        logError(`❌ Error during cleanupOldGames for ${gameType}:`, error);
    }
}

export async function runCleanupForGameType(gameType: string) {
    logInfo(`🧹 Starting scheduled cleanup for ${gameType}...`);
    let browser: Browser | null = null;
    try {
        const { browser: b, page } = await loginToIScored();
        browser = b;
        await cleanupOldGames(page, gameType);
        logInfo(`✅ Scheduled cleanup for ${gameType} completed.`);
    } catch (error) {
        logError(`🚨 Error during scheduled cleanup for ${gameType}:`, error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

export async function runMaintenanceForGameType(gameType: string) {
    logInfo(`Running database-driven maintenance routine for ${gameType}...`);
    let browser: Browser | null = null;

    try {
        // --- Phase 1: Get Game States from DB ---
        const activeGame = await getActiveGame(gameType);
        const nextGame = await getNextQueuedGame(gameType);

        const { browser: b, page } = await loginToIScored();
        browser = b;
        
        // --- Phase 2: Process Active Game (if one exists) ---
        if (activeGame) {
            logInfo(`Found active game in DB: ${activeGame.name} (ID: ${activeGame.iscored_game_id})`);
            
            // 1. Get winner from iScored (using scraper via existing page to handle Tags/ID correctly)
            const { winner, score } = await getWinnerAndScoreFromPage(page, activeGame.iscored_game_id, activeGame.name);

            // 1b. Get ALL standings and save to DB
            const standings = await getStandingsFromPage(page, activeGame.iscored_game_id, activeGame.name);
            if (standings.length > 0) {
                await saveScores(activeGame.id, standings.map(s => ({
                    iscored_username: s.name,
                    score: s.score,
                    rank: s.rank
                })));
            }

            // Re-navigate to lineup page to perform admin actions (locking, etc.)
            // getWinnerAndScoreFromPage navigates to the public page, so we must go back to settings.
            await navigateToLineupPage(page);

            // 2. Lock game on iScored
            const iscoredGame: IscoredGame = { id: activeGame.iscored_game_id, name: activeGame.name, isHidden: false, isLocked: false };
            await lockGame(page, iscoredGame);
            logInfo(`🔒 Locked game on iScored: ${activeGame.name}`);

            // 3. Update game status in DB
            await updateGameStatus(activeGame.id, 'COMPLETED');
            logInfo(`✅ Marked game as COMPLETED in DB: ${activeGame.name}`);

            // 4. Update winner history and check for dynasty
            const winnerDiscordId = getDiscordIdByIscoredName(winner) ?? null;
            await updateWinnerHistory(gameType, { gameName: activeGame.name, winner, score, winnerId: winnerDiscordId });
            const isRepeatWinner = await checkWinnerHistory(gameType, winner);

            // 5. Handle picker assignment and create next game shell
            let nextGameForPicker: GameRow | null = null;
            // Create a shell for the next game
            nextGameForPicker = await createGameEntry({
                type: gameType,
            });

            if (winnerDiscordId && !isRepeatWinner) {
                logInfo(`Setting picker for ${winner}.`);
                // Now set the picker on the newly created shell game
                await setPicker(gameType, winnerDiscordId);
            } else if (winnerDiscordId && isRepeatWinner) {
                logInfo(`👑 ${winner} is a repeat winner. Dynasty rule is active. Not setting picker.`);
                // Even if it's a repeat winner, we leave the picker field null on the new shell,
                // so it can be nominated.
            }
            
            // 6. Send Discord notification
            await sendDiscordNotification({
                winner,
                winnerId: winnerDiscordId,
                score,
                activeGame: activeGame.name,
                nextGame: nextGame?.name ?? 'None',
                isRepeatWinner,
            });
            logInfo(`This cycle's winner for ${gameType} is ${winner} with a score of ${score}. Announcement sent.`);

            // 7. Delete the game from iScored (Cleanup) - ONLY for Monthly Grind (MG)
            if (gameType === 'MG') {
                try {
                    await deleteGame(page, activeGame.name, activeGame.iscored_game_id);
                    logInfo(`🗑️ Deleted active game from iScored: ${activeGame.name}`);
                    // Re-navigate to lineup for next steps
                    await navigateToLineupPage(page);
                } catch (e) {
                    logError(`⚠️ Failed to delete active game ${activeGame.name}:`, e);
                }
            } else {
                logInfo(`ℹ️ Skipping deletion for ${gameType}. Game will remain visible/locked until scheduled cleanup.`);
            }

        } else {
            logInfo(`⚠️ No active game found for ${gameType}. Skipping winner determination and locking.`);
            // Ensure we are on lineup page for next steps if we didn't go there yet
            await navigateToLineupPage(page);
        }

        // --- Phase 2.5: Cleanup Old Games ---
        // REMOVED from daily maintenance. Now handled by separate scheduled task via runCleanupForGameType.
        // await cleanupOldGames(page, gameType);

        // --- Phase 3: Activate Next Queued Game ---
        if (nextGame) {
            logInfo(`Found next queued game in DB: ${nextGame.name}`);
            const iscoredGame: IscoredGame = { id: nextGame.iscored_game_id, name: nextGame.name, isHidden: true, isLocked: true };
            
            // 1. Show game on iScored
            await showGame(page, iscoredGame);
            logInfo(`🎉 Shown game on iScored: ${nextGame.name}`);

            // 2. Update game status in DB
            await updateGameStatus(nextGame.id, 'ACTIVE');
            logInfo(`✅ Marked game as ACTIVE in DB: ${nextGame.name}`);

        } else {
            logInfo(`⚠️ No game to show for ${gameType}.`);
        }


        logInfo(`✅ ${gameType} maintenance routine completed successfully.`);

    } catch (error) {
        logError(`🚨 An error occurred during the ${gameType} maintenance routine:`, error);
    } finally {
        if (browser) {
            await browser.close();
            logInfo('🚪 Browser closed.');
        }
    }
}
