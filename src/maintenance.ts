import { Browser, Page } from 'playwright';
import { loginToIScored, lockGame, showGame, Game as IscoredGame } from './iscored.js';
import { getWinnerAndScoreFromApi } from './api.js';
import { checkWinnerHistory, updateWinnerHistory } from './history.js';
import { sendDiscordNotification } from './discord.js';
import { getDiscordIdByIscoredName } from './userMapping.js';
import { getActiveGame, getNextQueuedGame, updateGameStatus, setPicker, createGameEntry, GameRow } from './database.js';
import { checkPauseExpiration } from './pauseState.js';

const ALL_GAME_TYPES = ['DG', 'WG-VPXS', 'WG-VR', 'MG'];

export async function triggerAllMaintenanceRoutines() {
    console.log('Manual trigger: Running maintenance for all game types...');
    await checkPauseExpiration();

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
    console.log(`Running database-driven maintenance routine for ${gameType}...`);
    let browser: Browser | null = null;

    try {
        // --- Phase 1: Get Game States from DB ---
        const activeGame = await getActiveGame(gameType);
        const nextGame = await getNextQueuedGame(gameType);

        ({ browser } = await loginToIScored());
        const page = await browser.newPage();

        // --- Phase 2: Process Active Game (if one exists) ---
        if (activeGame) {
            console.log(`Found active game in DB: ${activeGame.name} (ID: ${activeGame.iscored_game_id})`);
            
            // 1. Get winner from iScored API
            const { winner, score } = await getWinnerAndScoreFromApi(activeGame.name);

            // 2. Lock game on iScored
            const iscoredGame: IscoredGame = { id: activeGame.iscored_game_id, name: activeGame.name, isHidden: false };
            await lockGame(page, iscoredGame);
            console.log(`🔒 Locked game on iScored: ${activeGame.name}`);

            // 3. Update game status in DB
            await updateGameStatus(activeGame.id, 'COMPLETED');
            console.log(`✅ Marked game as COMPLETED in DB: ${activeGame.name}`);

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
                console.log(`Setting picker for ${winner}.`);
                // Now set the picker on the newly created shell game
                await setPicker(gameType, winnerDiscordId);
            } else if (winnerDiscordId && isRepeatWinner) {
                console.log(`👑 ${winner} is a repeat winner. Dynasty rule is active. Not setting picker.`);
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
            console.log(`This cycle's winner for ${gameType} is ${winner} with a score of ${score}. Announcement sent.`);

        } else {
            console.log(`⚠️ No active game found for ${gameType}. Skipping winner determination and locking.`);
        }

        // --- Phase 3: Activate Next Queued Game ---
        if (nextGame) {
            console.log(`Found next queued game in DB: ${nextGame.name}`);
            const iscoredGame: IscoredGame = { id: nextGame.iscored_game_id, name: nextGame.name, isHidden: true };
            
            // 1. Show game on iScored
            await showGame(page, iscoredGame);
            console.log(`🎉 Shown game on iScored: ${nextGame.name}`);

            // 2. Update game status in DB
            await updateGameStatus(nextGame.id, 'ACTIVE');
            console.log(`✅ Marked game as ACTIVE in DB: ${nextGame.name}`);

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
