import cron from 'node-cron';
import { loginToIScored, findGameByName, showGame, Game } from './iscored.js'; // Changed unarchiveGame to showGame
import { Browser } from 'playwright';

/**
 * Schedules a cron job to show (make active) a specific game at a given time.
 * @param gameName The name of the game to show.
 * @param showDateTime The Date object representing the exact date and time to show the game.
 */
export async function scheduleGameShow(gameName: string, showDateTime: Date) { // Renamed scheduleGameUnlock to scheduleGameShow
    // Calculate cron expression
    const minute = showDateTime.getMinutes();
    const hour = showDateTime.getHours();
    const dayOfMonth = showDateTime.getDate();
    const month = showDateTime.getMonth() + 1; // Month is 0-indexed in Date object
    // Day of week can be '*' as we specify dayOfMonth

    const cronExpression = `${minute} ${hour} ${dayOfMonth} ${month} *`;

    console.log(`⏰ Scheduling show for game '${gameName}' at ${showDateTime.toLocaleString()} (Cron: '${cronExpression}')`); // Updated log

    cron.schedule(cronExpression, async () => {
        console.log(`🎉 Executing scheduled show for game '${gameName}'...`); // Updated log
        let browser: Browser | null = null;
        try {
            const { browser: newBrowser, page } = await loginToIScored();
            browser = newBrowser;

            const targetGame = await findGameByName(page, gameName);

            if (targetGame) {
                await showGame(page, targetGame); // Changed unarchiveGame to showGame
                console.log(`✅ Successfully showed game: ${gameName}`); // Updated log
            } else {
                console.error(`❌ Could not find scheduled game '${gameName}' to show.`); // Updated log
            }

        } catch (error) {
            console.error(`❌ Error during scheduled show for game '${gameName}':`, error); // Updated log
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