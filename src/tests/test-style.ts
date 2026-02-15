import { loginToIScored, createGame, deleteGame } from '../iscored.js';
import { config } from 'dotenv';
import { logInfo, logError } from '../logger.js';

config();

async function testStyle() {
    logInfo('🧪 Starting Community Style Integration Test...');
    
    let browserInstance = null;
    try {
        const { browser, page } = await loginToIScored();
        browserInstance = browser;

        const testGameName = 'Style Test Game';
        const testGameType = 'DG';
        // Use command line arg or default to 2924
        const testStyleId = process.argv[2] || '2924'; 

        logInfo(`🚀 Attempting to create "${testGameName}" with Style ID: ${testStyleId}`);
        
        const gameId = await createGame(page, testGameName, testGameType, testStyleId);
        
        logInfo(`✅ Successfully created game! ID: ${gameId}`);
        logInfo('👉 Please check iScored manually to see if the graphics/style were applied.');
        logInfo('Wait 10 seconds before cleanup...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Optional: Cleanup
        // await deleteGame(page, `${testGameName} ${testGameType}`, gameId);
        // logInfo('🗑️ Test game deleted.');

    } catch (error) {
        logError('❌ Style Test Failed:', error);
    } finally {
        if (browserInstance) {
            await browserInstance.close();
        }
    }
}

testStyle();
