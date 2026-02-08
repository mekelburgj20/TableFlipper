import { Browser, Page } from 'playwright';
import { loginToIScored, findGames, lockGame, unlockGame, findGameByName, navigateToLineupPage } from './iscored.js';
import { getWinnerAndScoreFromPublicPage } from './api.js';
import { checkWinnerHistory, updateWinnerHistory } from './history.js';
import { sendDiscordNotification } from './discord.js';
import { getDiscordIdByIscoredName } from './userMapping.js';
import { setPicker } from './pickerState.js';
import { getPauseState, checkPauseExpiration } from './pauseState.js';

const ALL_GAME_TYPES = ['DG', 'WG-VPXS', 'WG-VR', 'MG'];

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
        // --- Phase 1: Login & Find Games ---
        ({ browser, page } = await loginToIScored());
        
        await navigateToLineupPage(page); // Initial navigation
        const { activeGames, nextGames } = await findGames(page, gameType);

        if (activeGames.length === 0) {
            throw new Error(`Could not find an active '${gameType}' game. Halting maintenance.`);
        }
        const activeGame = activeGames[0]; // Use the first active game

        if (nextGames.length === 0) {
            console.log(`⚠️ Could not find a next '${gameType}' game. The cycle will be broken.`);
        }
        let nextGame = nextGames.length > 0 ? nextGames[0] : null;

        // --- Phase 1.2: Check for Pause Override (if page needs to be re-evaluated) ---
        const pauseState = getPauseState();
        let gameToUnlock = nextGame;
        let announcementNextGame = nextGame ? nextGame.name : 'None';

        if (pauseState.isPaused && pauseState.specialGameName) {
            console.log(`⏸️ Pause is active. Overriding next game with special game: ${pauseState.specialGameName}`);
            // findGameByName will handle its own navigation if needed
            const specialGame = await findGameByName(page, pauseState.specialGameName);
            if (specialGame) {
                gameToUnlock = specialGame;
                announcementNextGame = specialGame.name;
            } else {
                console.error(`❌ Could not find the special game '${pauseState.specialGameName}' to unlock.`);
            }
        }

        // --- Phase 2: Get Winner & Lock Active Game ---
        const { winner, score } = await getWinnerAndScoreFromPublicPage(activeGame.id, activeGame.name);
        
        // lockGame now handles its own navigation to ensure it's on the correct page for its action and verification
        await lockGame(page, activeGame); 
        console.log(`🔒 Locked game: ${activeGame.name}`);

        // --- Phase 3: Announce Winner & Check History ---
        const isRepeatWinner = await checkWinnerHistory(gameType, winner);
        await updateWinnerHistory(gameType, { gameName: activeGame.name, winner, score });
        
        const winnerDiscordId = getDiscordIdByIscoredName(winner) ?? null;

        if (winnerDiscordId) {
            if (isRepeatWinner) {
                console.log(`👑 ${winner} is a repeat winner. They must nominate another player.`);
            } else {
                await setPicker(gameType, winnerDiscordId);
            }
        }

        await sendDiscordNotification({
            winner,
            winnerId: winnerDiscordId,
            score,
            activeGame: activeGame.name,
            nextGame: announcementNextGame,
            isRepeatWinner,
        });
        const winnerDisplayName = winner === 'N/A' ? 'N/A' : winner;
        console.log(`This cycle's winner for ${gameType} is ${winnerDisplayName} with a score of ${score}. Announcement sent.`);

        // --- Phase 4: Unlock Next Game ---
        if (gameToUnlock) {
            // unlockGame now handles its own navigation to ensure it's on the correct page for its action and verification
            await unlockGame(page, gameToUnlock);
            console.log(`🔓 Unlocked game: ${gameToUnlock.name}`);
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

