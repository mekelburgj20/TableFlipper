import { loginToIScored } from '../iscored.js';

async function runTest() {
    console.log('🧪 Starting iScored Login Test...');
    
    let browser = null;
    try {
        const result = await loginToIScored();
        browser = result.browser;
        console.log('✅ Login successful!');
    } catch (error) {
        console.error('❌ Login failed:', error);
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
            console.log('🚪 Browser closed.');
        }
    }
}

runTest();
