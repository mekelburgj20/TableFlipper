import { loginToIScored, navigateToLineupPage } from '../iscored.js';
import { config } from 'dotenv';
import { logInfo, logError } from '../logger.js';

config();

async function exploreLineup() {
    logInfo('🧪 Exploring Lineup Repositioning...');
    
    let browserInstance = null;
    try {
        const { browser, page } = await loginToIScored();
        browserInstance = browser;

        await navigateToLineupPage(page);
        const mainFrame = page.frameLocator('#main');

        // Explore global functions in the iframe
        const functions = await mainFrame.locator(':root').evaluate(() => {
            const fns = [];
            for (let prop in window) {
                if (typeof (window as any)[prop] === 'function') {
                    fns.push(prop);
                }
            }
            return fns.sort();
        });

        logInfo(`Found ${functions.length} functions in the iframe.`);
        
        const saveImpl = await mainFrame.locator(':root').evaluate(() => {
            return (window as any).saveSetting?.toString() || 'saveSetting not found';
        });
        logInfo(`saveSetting implementation:
${saveImpl}`);

        // List games in order
        const gameList = await mainFrame.locator('ul#orderGameUL li').evaluateAll((elements) => {
            return elements.map(el => ({
                id: el.getAttribute('id'),
                name: (el.querySelector('.dragHandle') as HTMLElement)?.innerText.trim() || 'Unknown'
            }));
        });

        logInfo('Current Lineup Order:');
        gameList.forEach((g, i) => logInfo(`${i + 1}. ${g.name} (ID: ${g.id})`));

    } catch (error) {
        logError('❌ Exploration Failed:', error);
    } finally {
        if (browserInstance) {
            await browserInstance.close();
        }
    }
}

exploreLineup();
