import { getPicker, updateQueuedGame, getRecentGameNames, getRandomCompatibleTable } from './database.js';
import { createGame } from './iscored.js';
import { loginToIScored } from './iscored.js';
import { sendDiscordNotification } from './discord.js';

const PICKER_TIMEOUT_HOURS = 18;

// Monthly Grind (MG) is excluded from timeouts as per requirements.
const TIMEOUT_GAME_TYPES = ['DG', 'WG-VPXS', 'WG-VR'];

export async function checkPickerTimeouts() {
    console.log('⏳ Checking for picker timeouts...');

    for (const gameType of TIMEOUT_GAME_TYPES) {
        const game = await getPicker(gameType);

        if (game && game.picker_designated_at && game.picker_discord_id) {
            const designatedAt = new Date(game.picker_designated_at);
            const timeout = new Date(designatedAt.getTime() + PICKER_TIMEOUT_HOURS * 60 * 60 * 1000);

            if (new Date() > timeout) {
                console.log(`⏰ Picker for ${gameType} has timed out!`);

                let browser = null;
                try {
                    // 1. Pick a random valid table
                    // DG: 21 days lookback, AtGames
                    // WG: 3 turns (approx 21 days) lookback, Respective Platform
                    
                    const daysLookback = 21;
                    const recentGames = await getRecentGameNames(gameType, daysLookback);
                    
                    let platformFilter: 'atgames' | 'vr' | 'vpxs' = 'atgames'; // Default to DG logic
                    if (gameType === 'WG-VR') platformFilter = 'vr';
                    if (gameType === 'WG-VPXS') platformFilter = 'vpxs';

                    const randomTableRow = await getRandomCompatibleTable(platformFilter, recentGames);

                    if (!randomTableRow) {
                        console.error(`❌ Could not find a valid random table for ${gameType} (Platform: ${platformFilter}, Excluded: ${recentGames.length} recent games).`);
                        // Fallback? Or just fail safely? 
                        // If we fail, we shouldn't update the game status so it retries or alerts?
                        // For now, let's log error and continue loop.
                        continue;
                    }

                    const randomTable = randomTableRow.name;
                    const newGameName = randomTable; // Clean name (Tags handle ID)
                    console.log(`🤖 Randomly selected table: ${newGameName}`);

                    // 2. Create the game in iScored
                    const { browser: newBrowser, page } = await loginToIScored();
                    browser = newBrowser;
                    const { id: iscoredGameId } = await createGame(page, newGameName, gameType);

                    // 3. Update the game in the database (keeping base name in DB, createGame adds suffix for iScored)
                    await updateQueuedGame(game.id, newGameName, iscoredGameId);

                    // 4. Announce it
                    const fullGameName = `${newGameName} ${gameType}`;
                    await sendDiscordNotification({
                        winner: 'N/A',
                        winnerId: null,
                        score: 'N/A',
                        activeGame: 'None',
                        nextGame: fullGameName,
                        gameType: gameType,
                        isRepeatWinner: false,
                        customMessage: `The picker for **${gameType}** timed out.\nI have randomly selected **${fullGameName}** as the next game.`
                    });

                } catch (error) {
                    console.error(`❌ Error handling picker timeout for ${gameType}:`, error);
                } finally {
                    if (browser) {
                        await browser.close();
                    }
                }
            }
        }
    }
}