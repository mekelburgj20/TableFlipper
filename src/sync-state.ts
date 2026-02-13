import 'dotenv/config';
import { loginToIScored, findGames, navigateToLineupPage } from './iscored.js';
import { syncActiveGame, syncQueuedGame } from './database.js';

const GAME_TYPES = ['DG', 'WG-VPXS', 'WG-VR', 'MG'];

async function main() {
    console.log('🔄 Starting Manual State Sync...');
    
    let browser = null;
    try {
        const { browser: b, page } = await loginToIScored();
        browser = b;

        await navigateToLineupPage(page);

        for (const type of GAME_TYPES) {
            console.log(`🔎 Checking state for ${type}...`);
            const { activeGames, nextGames } = await findGames(page, type);
            
            if (activeGames.length > 0) {
                const active = activeGames[0];
                console.log(`   -> Found iScored Active: ${active.name} (${active.id})`);
                await syncActiveGame(type, active.id, active.name);
            } else {
                console.log(`   -> No active game found on iScored.`);
                await syncActiveGame(type, null, null);
            }

            if (nextGames.length > 0) {
                console.log(`   -> Found ${nextGames.length} queued (hidden) games on iScored.`);
                for (const next of nextGames) {
                    console.log(`      -> Syncing Queued: ${next.name} (${next.id})`);
                    await syncQueuedGame(type, next.id, next.name);
                }
            } else {
                console.log(`   -> No queued games found on iScored.`);
            }
        }

        console.log('✅ Sync completed successfully.');

    } catch (error) {
        console.error('❌ Sync failed:', error);
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

main();