import cron from 'node-cron';
import { loginToIScored, findGameByName, unlockGame, Game } from './iscored.js';
import { Browser } from 'playwright';

/**
 * Schedules a cron job to unlock a specific game at a given time.
 * @param gameName The name of the game to unlock.
 * @param unlockDateTime The Date object representing the exact date and time to unlock the game.
 */
export async function scheduleGameUnlock(gameName: string, unlockDateTime: Date) {
    // Calculate cron expression
    const minute = unlockDateTime.getMinutes();
    const hour = unlockDateTime.getHours();
    const dayOfMonth = unlockDateTime.getDate();
    const month = unlockDateTime.getMonth() + 1; // Month is 0-indexed in Date object
    // Day of week can be '*' as we specify dayOfMonth

    const cronExpression = `${minute} ${hour} ${dayOfMonth} ${month} *`;

    console.log(`⏰ Scheduling unlock for game '${gameName}' at ${unlockDateTime.toLocaleString()} (Cron: '${cronExpression}')`);

    cron.schedule(cronExpression, async () => {
        console.log(`🔓 Executing scheduled unlock for game '${gameName}'...`);
        let browser: Browser | null = null;
        try {
            const { browser: newBrowser, page } = await loginToIScored();
            browser = newBrowser;

            const targetGame = await findGameByName(page, gameName);

            if (targetGame) {
                await unlockGame(page, targetGame);
                console.log(`✅ Successfully unlocked game: ${gameName}`);
            } else {
                console.error(`❌ Could not find scheduled game '${gameName}' to unlock.`);
            }

        } catch (error) {
            console.error(`❌ Error during scheduled unlock for game '${gameName}':`, error);
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }, {
        scheduled: true,
        timezone: "America/Chicago" // Central Time
    });
}