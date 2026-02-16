import { loginToIScored, navigateToLineupPage } from '../iscored.js';
import { config } from 'dotenv';
import { logInfo, logError } from '../logger.js';

config();

async function testRepositionDom() {
    logInfo('🧪 Testing DOM-based Lineup Repositioning...');
    
    let browserInstance = null;
    try {
        const { browser, page } = await loginToIScored();
        browserInstance = browser;

        await navigateToLineupPage(page);
        const mainFrame = page.frameLocator('#main');

        // List games in order before
        const beforeOrder = await mainFrame.locator('ul#orderGameUL li').evaluateAll((elements) => {
            return elements.map(el => ({
                id: el.getAttribute('id'),
                name: (el.querySelector('.dragHandle') as HTMLElement)?.innerText.trim() || 'Unknown'
            }));
        });

        logInfo('Order BEFORE:');
        beforeOrder.forEach((g, i) => logInfo(`${i + 1}. ${g.name} (ID: ${g.id})`));

        if (beforeOrder.length > 1) {
            const lastGame = beforeOrder[beforeOrder.length - 1];
            logInfo(`🚀 Physically moving "${lastGame.name}" (ID: ${lastGame.id}) to the top of the list...`);

            const result = await mainFrame.locator(':root').evaluate((el, targetId) => {
                const lineupUl = document.getElementById('orderGameUL');
                const targetLi = document.getElementById(targetId);
                const saveFn = (window as any).saveSetting;

                if (!lineupUl || !targetLi || !saveFn) {
                    return { success: false, error: `lineupUl: ${!!lineupUl}, targetLi: ${!!targetLi}, saveFn: ${!!saveFn}` };
                }

                // 1. Physically move the element in the DOM
                lineupUl.prepend(targetLi);

                // 2. Calculate the new order from the DOM
                const newOrderIds = Array.from(lineupUl.children).map(child => child.getAttribute('id'));

                // 3. Persist via iScored's save mechanism
                saveFn("gameOrder", newOrderIds.join(","));

                return { success: true, newOrder: newOrderIds };
            }, lastGame.id);

            if (result.success) {
                logInfo('✅ DOM move and saveSetting executed.');
                logInfo('Wait 5 seconds for iScored to process...');
                await page.waitForTimeout(5000);

                // Re-read the list to verify
                const afterOrder = await mainFrame.locator('ul#orderGameUL li').evaluateAll((elements) => {
                    return elements.map(el => ({
                        id: el.getAttribute('id'),
                        name: (el.querySelector('.dragHandle') as HTMLElement)?.innerText.trim() || 'Unknown'
                    }));
                });

                logInfo('Order AFTER:');
                afterOrder.forEach((g, i) => logInfo(`${i + 1}. ${g.name} (ID: ${g.id})`));

                if (afterOrder[0].id === lastGame.id) {
                    logInfo('🎉 VERIFIED: Game is now physically and persistently at the top!');
                } else {
                    logError('❌ FAILED: Game is not at the top.');
                }
            } else {
                logError(`❌ Reposition failed: ${result.error}`);
            }
        }

    } catch (error) {
        logError('❌ Test Failed:', error);
    } finally {
        if (browserInstance) {
            await browserInstance.close();
        }
    }
}

testRepositionDom();
