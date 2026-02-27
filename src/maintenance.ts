import { Browser, Page } from 'playwright';
import { loginToIScored, lockGame, showGame, navigateToSettingsPage, navigateToLineupPage, deleteGame, findGames, getAllGames, syncStyleFromIScored, repositionLineup, createGame, Game as IscoredGame } from './iscored.js';
import { getWinnerAndScoreFromPage, getStandingsFromPage } from './api.js';
import { updateWinnerHistory, getLastWinner } from './history.js';
import { sendDiscordNotification } from './discord.js';
import { dbGetDiscordIdByIscoredName } from './database.js';
import { getActiveGames, getActiveGame, getNextQueuedGames, getNextQueuedGame, updateGameStatus, setPicker, createGameEntry, GameRow, hasScores, saveScores, getGameByIscoredId, syncCompletedGame, syncQueuedGame, upsertTable, getTable, getLineupOrder, reconcileGames, getPrePick, clearPrePick, checkTableEligibility, updateQueuedGame } from './database.js';
import { logInfo, logError, logWarn } from './logger.js';

const ALL_GAME_TYPES = ['DG', 'WG-VPXS', 'WG-VR', 'MG'];

export async function triggerLineupRepositioning() {
    logInfo('🔄 Triggering automated lineup repositioning...');
    const typeOrderEnv = process.env.LINEUP_TYPE_ORDER || "DG,WG-VPXS,WG-VR,MG";
    const typeOrder = typeOrderEnv.split(',').map(t => t.trim());

    let browser: Browser | null = null;
    try {
        const orderedIds = await getLineupOrder(typeOrder);
        if (orderedIds.length === 0) {
            logInfo('   -> No games found in DB to order.');
            return;
        }

        const { browser: b, page } = await loginToIScored();
        browser = b;

        await repositionLineup(page, orderedIds);
        logInfo('✅ Lineup repositioning completed.');

    } catch (error) {
        logError('❌ Error during triggerLineupRepositioning:', error);
    } finally {
        if (browser) await browser.close();
    }
}

export async function triggerAllMaintenanceRoutines() {
    logInfo('Manual trigger: Running maintenance for all game types...');

    // First, sync styles for all active tables
    await syncAllActiveStyles();

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
        
        const { activeGames, nextGames, completedGames } = await findGames(page, gameType);
        const officialActiveGame = await getActiveGame(gameType);
        
        // Any game that is SHOWN or HIDDEN but tagged is a candidate for sync
        const visibleGames = [...activeGames, ...completedGames, ...nextGames];
        
        logInfo(`   -> Found ${visibleGames.length} visible ${gameType} games to evaluate.`);

        for (const game of visibleGames) {
            // If this is the official active game in our DB, we MUST skip it.
            if (officialActiveGame && game.id === officialActiveGame.iscored_game_id) {
                logInfo(`   -> Skipping official active game: '${game.name}' (ID: ${game.id})`);
                continue;
            }

            logInfo(`   Processing sync/cleanup for '${game.name}' (ID: ${game.id})...`);
            
            // Check if we have this game in DB
            let dbGame = await getGameByIscoredId(game.id);
            
            // If the game isn't in our DB, we should create a record for it so we can track it.
            if (!dbGame) {
                if (game.isHidden) {
                    logInfo(`   -> Game not found in local DB. Importing as QUEUED to allow maintenance promotion.`);
                    await syncQueuedGame(gameType, game.id, game.name);
                } else {
                    logInfo(`   -> Game not found in local DB. Importing as COMPLETED to allow cleanup.`);
                    await syncCompletedGame(gameType, game.id, game.name);
                }
                dbGame = await getGameByIscoredId(game.id);
            }
            
            if (dbGame) {
                // If it's HIDDEN, we don't delete it - we just let maintenance handle it
                if (game.isHidden) {
                    logInfo(`   -> Game is hidden/queued. Leaving for maintenance logic.`);
                    continue;
                }

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
                if (dbGame.status !== 'COMPLETED' && (!officialActiveGame || dbGame.id !== officialActiveGame.id)) {
                    await updateGameStatus(dbGame.id, 'COMPLETED');
                }

                // Delete the game from iScored only if it's not the active one
                if (dbGame.status !== 'ACTIVE' && (!officialActiveGame || dbGame.id !== officialActiveGame.id)) {
                    await deleteGame(page, game.name, game.id);
                    // Mark as HIDDEN in DB so it doesn't show up in 'current' autocomplete
                    await updateGameStatus(dbGame.id, 'HIDDEN');
                }
                
                // We need to re-navigate to Lineup page because deleteGame goes to Games tab
                await navigateToLineupPage(page);

            } else {
                logError(`❌ Failed to acquire DB record for '${game.name}' (ID: ${game.id}) even after sync. Skipping.`);
            }
            
            // Give the site a moment to "breathe" between deletions to avoid UI lag
            await page.waitForTimeout(2000);
        }

        // --- Reconciliation Phase ---
        // Mark any game in DB for THIS type that was NOT found on iScored as HIDDEN
        // This handles cases where games were deleted manually or the board was wiped.
        const foundIds = visibleGames.map(g => g.id);
        await reconcileGames(foundIds, gameType);
        
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

export async function syncAllActiveStyles(existingPage?: Page) {
    logInfo('🎨 Starting automated style sync for all games in the arcade...');
    let browser: Browser | null = null;
    let page: Page;

    try {
        if (existingPage) {
            page = existingPage;
        } else {
            const { browser: b, page: p } = await loginToIScored();
            browser = b;
            page = p;
        }

        const mainFrame = page.frameLocator('#main');
        await navigateToSettingsPage(page);
        
        // Go to Games tab once
        const gamesTab = mainFrame.locator('a[href="#games"]');
        await gamesTab.click();
        const selectGame = mainFrame.locator('#selectGame');
        await selectGame.waitFor({ state: 'visible', timeout: 10000 });

        // Wait for the dropdown to actually contain game options (more than just the default "Choose a Game")
        // We look for any option with a value that is NOT "0".
        try {
            await mainFrame.locator('#selectGame option:not([value="0"])').first().waitFor({ state: 'attached', timeout: 5000 });
        } catch (e) {
            logWarn('   -> Dropdown options did not appear within 5s, proceeding with what we have.');
        }

        // Get all options from the dropdown
        const options = await selectGame.locator('option').all();
        logInfo(`   -> Total options found in dropdown: ${options.length}`);
        
        const gamesToSync: { id: string, name: string }[] = [];
        
        for (const option of options) {
            const val = await option.getAttribute('value');
            const name = await option.innerText();
            if (val && val !== '0') {
                gamesToSync.push({ id: val, name: name.trim() });
            }
        }

        logInfo(`   -> Found ${gamesToSync.length} games in the editor dropdown.`);

        for (const game of gamesToSync) {
            // Remove any tournament suffixes for the DB lookup/save
            const cleanName = game.name.replace(/ (DG|WG-VPXS|WG-VR|MG)$/, '');
            
            logInfo(`   -> Sniffing style for: ${cleanName} (ID: ${game.id})`);
            
            // We call syncStyleFromIScored but it's now optimized because we are already on the right tab
            const capturedStyle = await syncStyleFromIScored(page, cleanName, game.id);
            
            if (Object.keys(capturedStyle).length > 0) {
                const table = await getTable(cleanName);
                await upsertTable({
                    name: cleanName,
                    is_atgames: table?.is_atgames ?? 0,
                    is_wg_vr: table?.is_wg_vr ?? 0,
                    is_wg_vpxs: table?.is_wg_vpxs ?? 0,
                    ...capturedStyle
                });
                logInfo(`   ✅ Successfully recorded style for '${cleanName}'.`);
            }
            
            // Small pause to let the UI breathe between selections
            await page.waitForTimeout(500);
        }
    } catch (error) {
        logError('❌ Error during syncAllActiveStyles:', error);
    } finally {
        if (browser) await browser.close();
    }
}

export async function runMaintenanceForGameType(gameType: string) {
    logInfo(`Running database-driven maintenance routine for ${gameType}...`);
    let browser: Browser | null = null;

    try {
        const { browser: b, page } = await loginToIScored();
        browser = b;

        // --- Phase 0: Sync/Cleanup Sweep ---
        await cleanupOldGames(page, gameType);

        // --- Phase 1: Get Game States from DB ---
        const activeGames = await getActiveGames(gameType);
        const nextQueuedGames = await getNextQueuedGames(gameType, activeGames.length > 0 ? activeGames.length : 1);
        
        // Fetch the last winner once at the start. 
        // This ensures that if the same person wins multiple games in this cycle, 
        // they aren't blocked by the dynasty rule against their own win from 5 minutes ago.
        const lastCycleWinner = await getLastWinner(gameType);

        // --- Phase 2: Process Active Games ---
        if (activeGames.length > 0) {
            logInfo(`Found ${activeGames.length} active game(s) in DB for ${gameType}.`);

            for (const activeGame of activeGames) {
                logInfo(`Processing maintenance for: ${activeGame.name} (ID: ${activeGame.iscored_game_id})`);
                
                // 1. Get winner from iScored
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

                await navigateToLineupPage(page);

                // 2. Lock game on iScored
                const iscoredGame: IscoredGame = { id: activeGame.iscored_game_id, name: activeGame.name, isHidden: false, isLocked: false };
                await lockGame(page, iscoredGame);
                logInfo(`🔒 Locked game on iScored: ${activeGame.name}`);

                // 3. Update game status in DB
                await updateGameStatus(activeGame.id, 'COMPLETED');
                logInfo(`✅ Marked game as COMPLETED in DB: ${activeGame.name}`);

                // 4. Update winner history and check for dynasty
                const winnerDiscordId = await dbGetDiscordIdByIscoredName(winner);
                
                // Dynasty Rule: Check against the winner of the PREVIOUS cycle
                const isRepeatWinner = !!(lastCycleWinner && winner && lastCycleWinner.toLowerCase() === winner.toLowerCase());
                
                await updateWinnerHistory(gameType, { gameName: activeGame.name, winner, score, winnerId: winnerDiscordId });

                // 5. Handle picker assignment and create next game shell
                const nextSlot = await createGameEntry({
                    type: gameType,
                });

                if (winnerDiscordId && !isRepeatWinner) {
                    // Check for Pre-Pick
                    const prePick = await getPrePick(winnerDiscordId, gameType);
                    let prePickApplied = false;

                    if (prePick) {
                        logInfo(`✨ Pre-pick found for ${winner}: ${prePick.table_name}. Checking eligibility...`);
                        const isEligible = await checkTableEligibility(prePick.table_name, gameType);
                        
                        if (isEligible) {
                            try {
                                const { id: iscoredGameId } = await createGame(page, prePick.table_name, gameType);
                                await updateQueuedGame(nextSlot.id, prePick.table_name, iscoredGameId, 'QUEUED');
                                await clearPrePick(winnerDiscordId, gameType);
                                logInfo(`✅ Successfully applied pre-pick for ${winner}.`);
                                prePickApplied = true;
                            } catch (e) {
                                logError(`❌ Failed to apply pre-pick for ${winner}:`, e);
                            }
                        } else {
                            logWarn(`⚠️ Pre-picked table '${prePick.table_name}' has already been played in the last 120 days. Skipping pre-pick.`);
                        }
                    }

                    if (!prePickApplied) {
                        logInfo(`Setting picker for ${winner}.`);
                        await setPicker(gameType, winnerDiscordId, null, activeGame.id, 'WINNER');
                    }
                } else if (winnerDiscordId && isRepeatWinner) {
                    logInfo(`👑 ${winner} is a repeat winner from the previous cycle. Dynasty rule is active. Not setting picker.`);
                } else if (!winnerDiscordId) {
                    logWarn(`⚠️ Winner ${winner} is not mapped to a Discord user. Mod alert needed.`);
                    // TODO: Trigger Mod Alert
                }
                
                // 6. Send Discord notification
                const nextGamePlaceholder = await getNextQueuedGame(gameType);
                await sendDiscordNotification({
                    winner,
                    winnerId: winnerDiscordId,
                    score,
                    activeGame: activeGame.name,
                    nextGame: nextGamePlaceholder?.name ?? 'None',
                    gameType,
                    isRepeatWinner,
                });
                logInfo(`This cycle's winner for ${activeGame.name} is ${winner} with a score of ${score}. Announcement sent.`);
            }

            logInfo(`ℹ️ All active ${gameType} games processed. They will remain visible/locked until scheduled cleanup.`);

        } else {
            logInfo(`⚠️ No active game found for ${gameType}. Skipping winner determination and locking.`);
            // Ensure we are on lineup page for next steps if we didn't go there yet
            await navigateToLineupPage(page);
        }

        // --- Phase 3: Activate All Corresponding Queued Games ---
        // If we had 2 active games, we should activate up to 2 queued games.
        if (nextQueuedGames.length > 0) {
            logInfo(`Found ${nextQueuedGames.length} queued game(s) in DB to activate.`);
            
            for (const nextGame of nextQueuedGames) {
                if (nextGame.iscored_game_id === 'TBD') {
                    logInfo(`   -> Next game '${nextGame.name}' is still TBD (no pick made yet). Skipping show.`);
                    continue;
                }

                const iscoredGame: IscoredGame = { id: nextGame.iscored_game_id, name: nextGame.name, isHidden: true, isLocked: true };
                
                // 1. Show game on iScored
                await showGame(page, iscoredGame);
                logInfo(`🎉 Shown game on iScored: ${nextGame.name}`);

                // 2. Update game status in DB
                await updateGameStatus(nextGame.id, 'ACTIVE');
                logInfo(`✅ Marked game as ACTIVE in DB: ${nextGame.name}`);
            }
        } else {
            logInfo(`⚠️ No games to show for ${gameType}.`);
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
