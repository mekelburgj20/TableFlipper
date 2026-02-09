const ALL_GAME_TYPES = ['DG', 'WG-VPXS', 'WG-VR', 'MG'];

// Set to 'true' to temporarily disable the Dynasty Rule and always set the picker.
// Set to 'false' to re-enable the Dynasty Rule (repeat winners cannot pick).
const DISABLE_DYNASTY_RULE_TEMPORARILY = true;

import { Browser, Page } from 'playwright';
import { loginToIScored, findGames, lockGame, showGame, findGameByName, navigateToLineupPage, Game } from './iscored.js';
import { getWinnerAndScoreFromApi } from './api.js';
import { checkWinnerHistory, updateWinnerHistory } from './history.js';
import { sendDiscordNotification } from './discord.js';
import { getDiscordIdByIscoredName } from './userMapping.js';
import { setPicker, getFullPickerState } from './pickerState.js'; // Added getFullPickerState
import { getPauseState, checkPauseExpiration } from './pauseState.js';


export async function triggerAllMaintenanceRoutines() {
    console.log('Manual trigger: Running maintenance for all game types...');
    await checkPauseExpiration(); // Ensure expired pauses are cleared before running maintenance

    for (const gameType of ALL_GAME_TYPES) {
        try {
            await runMaintenanceForGameType(gameType);
        } catch (error) {
            console.error(`🚨 Error running maintenance for ${gameType} during manual trigger:`, error);
        }
    }
    console.log('Manual trigger: All maintenance routines completed.');
}

export async function runMaintenanceForGameType(gameType: string) {
    console.log(`Running maintenance routine for ${gameType}...`);
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        const fullPickerState = getFullPickerState(); // Get full picker state at beginning
        const currentPickerInfo = fullPickerState[gameType];

        // --- Phase 1: Login & Find Games ---
        ({ browser, page } = await loginToIScored());
        
        await navigateToLineupPage(page); // Initial navigation
        const { activeGames, nextGames } = await findGames(page, gameType);

        let activeGame = activeGames.length > 0 ? activeGames[0] : null;
        let gameToShow: Game | null = null; // Renamed to reflect show action

        // Determine which game to show: prioritize nextScheduledGameName from pickerState
        if (currentPickerInfo?.nextScheduledGameName) {
            console.log(`DEBUG: Found nextScheduledGameName in pickerState: ${currentPickerInfo.nextScheduledGameName}`);
            gameToShow = await findGameByName(page, currentPickerInfo.nextScheduledGameName);
            if (!gameToShow) {
                console.error(`❌ Scheduled game '${currentPickerInfo.nextScheduledGameName}' not found on iScored. Will attempt to find a game to show from nextGames.`);
            }
        }
        
        // Fallback: if no active game, and no specific scheduled game, try to pick the first hidden game
        // However, this logic needs careful consideration. If there's no active game to score winner from,
        // and no specific scheduled game, then something is likely wrong with the state.
        if (!activeGame) {
            if (!gameToShow && nextGames.length > 0) {
                 // Only use nextGames as a fallback if no specific scheduled game was found
                console.log(`⚠️ No active game found, and no specific scheduled game. Attempting to show the first 'next game': ${nextGames[0].name}`);
                gameToShow = nextGames[0];
            } else if (!gameToShow) {
                 throw new Error(`Could not find an active '${gameType}' game and no scheduled game to show. Halting maintenance.`);
            }
        }
        
        // This part remains mostly the same, but now uses activeGame (if found)
        let winner: string = 'N/A';
        let score: string = 'N/A';

        if (activeGame) {
            // Use the API to get the winner and score
            const { winner: foundWinner, score: foundScore } = await getWinnerAndScoreFromApi(activeGame.name);
            winner = foundWinner;
            score = foundScore;

            // lockGame now handles its own navigation to ensure it's on the correct page for its action and verification
            await lockGame(page, activeGame); 
            console.log(`🔒 Locked game: ${activeGame.name}`);

            // --- Phase 3: Announce Winner & Check History ---
            const isRepeatWinner = await checkWinnerHistory(gameType, winner);
            await updateWinnerHistory(gameType, { gameName: activeGame.name, winner, score });
            
            const winnerDiscordId = getDiscordIdByIscoredName(winner) ?? null;

            if (winnerDiscordId) {
                if (DISABLE_DYNASTY_RULE_TEMPORARILY) {
                    console.log('--- TESTING: Dynasty Rule is TEMPORARILY DISABLED. Always setting picker. ---');
                    await setPicker(gameType, winnerDiscordId);
                    if (isRepeatWinner) {
                        console.log(`👑 ${winner} is a repeat winner (but picker was set due to temporary disable).`);
                    }
                } else {
                    if (!isRepeatWinner) {
                        console.log(`Setting picker for ${winner}.`);
                        await setPicker(gameType, winnerDiscordId);
                    } else {
                        console.log(`👑 ${winner} is a repeat winner. Dynasty rule is active. Not setting picker.`);
                    }
                }
            }

            await sendDiscordNotification({
                winner,
                winnerId: winnerDiscordId,
                score,
                activeGame: activeGame.name,
                nextGame: currentPickerInfo?.nextScheduledGameName ?? 'None', // Use scheduled game name
                isRepeatWinner,
            });
            const winnerDisplayName = winner === 'N/A' ? 'N/A' : winner;
            console.log(`This cycle's winner for ${gameType} is ${winnerDisplayName} with a score of ${score}. Announcement sent.`);
        } else {
            console.log(`⚠️ No active game found for ${gameType}. Skipping winner determination and locking.`);
            // Send a simplified notification if no active game to announce winner
            await sendDiscordNotification({
                winner: 'N/A',
                winnerId: null,
                score: 'N/A',
                activeGame: 'None',
                nextGame: currentPickerInfo?.nextScheduledGameName ?? 'None',
                isRepeatWinner: false, // Cannot be a repeat winner if no winner was found
            });
        }

        // --- Phase 4: Show Next Game ---
        if (gameToShow) {
            await showGame(page, gameToShow);
            console.log(`🎉 Shown game: ${gameToShow.name}`);
            // After showing the scheduled game, clear its name from pickerState
            if (currentPickerInfo?.nextScheduledGameName) {
                await setPicker(gameType, currentPickerInfo.pickerDiscordId, currentPickerInfo.nominatedBy, undefined); // Clear nextScheduledGameName
                console.log(`✅ Cleared nextScheduledGameName from pickerState for ${gameType}.`);
            }
        } else {
            console.log(`⚠️ No game to show for ${gameType}.`);
        }

        console.log(`✅ ${gameType} maintenance routine completed successfully.`);

    } catch (error) {
        console.error(`🚨 An error occurred during the ${gameType} maintenance routine:`, error);
    } finally {
        if (browser) {
            await browser.close();
            console.log('🚪 Browser closed.');
        }
    }
}