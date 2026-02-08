import { getFullPickerState, clearPicker } from './pickerState.js';
import { randomTableList } from './tableList.js';
import { createGame, loginToIScored } from './iscored.js';
import { sendTimeoutNotification } from './discord.js';
import { Browser } from 'playwright';

const PICKER_TIMEOUT_HOURS = 12;

export async function checkPickerTimeouts() {
    console.log('⏳ Checking for picker timeouts...');
    
    const pickerState = getFullPickerState();
    const now = new Date();

    for (const gameType in pickerState) {
        const pickerInfo = pickerState[gameType];
        
        if (pickerInfo && pickerInfo.designatedAt) {
            const designatedTime = new Date(pickerInfo.designatedAt);
            const hoursSinceDesignated = (now.getTime() - designatedTime.getTime()) / (1000 * 60 * 60);

            if (hoursSinceDesignated > PICKER_TIMEOUT_HOURS) {
                console.log(`⏰ Picker for ${gameType} has timed out! Selecting a random table.`);
                
                // 1. Select a random table
                const randomTable = randomTableList[Math.floor(Math.random() * randomTableList.length)];
                const newGameName = `${randomTable} ${gameType}`;

                // 2. Create the game
                let browser: Browser | null = null;
                try {
                    console.log(`🚀 Creating random game for ${gameType}: ${newGameName}`);
                    const { browser: newBrowser, page } = await loginToIScored();
                    browser = newBrowser;
                    await createGame(page, newGameName);

                    // 3. Clear picker and announce
                    await clearPicker(gameType);
                    
                    console.log(`📢 Announcing random selection for ${gameType}: ${newGameName}`);
                    await sendTimeoutNotification(gameType, newGameName);

                } catch (error) {
                    console.error(`❌ Error creating random game for ${gameType}:`, error);
                } finally {
                    if (browser) {
                        await browser.close();
                    }
                }
            }
        }
    }
}
