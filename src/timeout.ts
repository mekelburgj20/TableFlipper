import { getPicker, updateQueuedGame } from './database.js';
import { createGame } from './iscored.js';
import { loginToIScored } from './iscored.js';
import { randomTableList } from './tableList.js';
import { sendDiscordNotification } from './discord.js';

const ALL_GAME_TYPES = ['DG', 'WG-VPXS', 'WG-VR', 'MG'];
const PICKER_TIMEOUT_HOURS = 12;

export async function checkPickerTimeouts() {
    console.log('⏳ Checking for picker timeouts...');

    for (const gameType of ALL_GAME_TYPES) {
        const game = await getPicker(gameType);

        if (game && game.picker_designated_at && game.picker_discord_id) {
            const designatedAt = new Date(game.picker_designated_at);
            const timeout = new Date(designatedAt.getTime() + PICKER_TIMEOUT_HOURS * 60 * 60 * 1000);

            if (new Date() > timeout) {
                console.log(`⏰ Picker for ${gameType} has timed out!`);

                let browser = null;
                try {
                    // 1. Pick a random table
                    const randomTable = randomTableList[Math.floor(Math.random() * randomTableList.length)];
                    const newGameName = `${randomTable} ${gameType}`;
                    console.log(`🤖 Randomly selected table: ${newGameName}`);

                    // 2. Create the game in iScored
                    const { browser: newBrowser, page } = await loginToIScored();
                    browser = newBrowser;
                    const iscoredGameId = await createGame(page, newGameName);

                    // 3. Update the game in the database
                    await updateQueuedGame(game.id, newGameName, iscoredGameId);

                    // 4. Announce it
                    await sendDiscordNotification({
                        winner: 'N/A',
                        winnerId: null,
                        score: 'N/A',
                        activeGame: 'None',
                        nextGame: newGameName,
                        isRepeatWinner: false,
                        customMessage: `⏰ The picker for **${gameType}** timed out.\nI have randomly selected **${newGameName}** as the next game.`
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