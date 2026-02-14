import { chromium, Browser, Page, Locator } from 'playwright';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { loginToIScored, findGames } from './iscored.js'; // Import login and findGames

export async function getWinnerAndScoreFromApi(gameName: string): Promise<{ winner: string; score: string }> {
    const gameroomName = process.env.GAMEROOM_NAME;
    if (!gameroomName) {
        throw new Error('GAMEROOM_NAME environment variable is not set.');
    }
    const encodedGameName = encodeURIComponent(gameName);
    const url = `https://www.iscored.info/api/${gameroomName}/${encodedGameName}`;

    console.log(`🔎 Calling iScored API for winner of '${gameName}'...`);
    
    try {
        const response = await axios.get(url);
        const data = response.data;

        if (data && data.scores && data.scores.length > 0) {
            const winnerData = data.scores.find((s: any) => s.rank === '1');
            if (winnerData) {
                console.log(`✅ Found Winner via API: ${winnerData.name} with score ${winnerData.score}`);
                return { winner: winnerData.name, score: winnerData.score };
            }
        }
        
        console.log(`⚠️ No rank 1 winner found for '${gameName}' via API.`);
        return { winner: 'N/A', score: 'N/A' };

    } catch (error) {
        console.error(`❌ Error calling iScored API for game '${gameName}':`, error);
        return { winner: 'N/A', score: 'N/A' };
    }
}

export async function getStandingsFromApi(gameName: string): Promise<Standing[]> {
    const gameroomName = process.env.GAMEROOM_NAME;
    if (!gameroomName) {
        throw new Error('GAMEROOM_NAME environment variable is not set.');
    }
    const encodedGameName = encodeURIComponent(gameName);
    const url = `https://www.iscored.info/api/${gameroomName}/${encodedGameName}?max=10`; // Get top 10

    console.log(`🔎 Calling iScored API for standings of '${gameName}'...`);
    
    try {
        const response = await axios.get(url);
        const data = response.data;

        if (data && data.scores && Array.isArray(data.scores)) {
            const standings: Standing[] = data.scores.map((s: any) => ({
                rank: s.rank,
                name: s.name,
                score: s.score,
            }));
            console.log(`✅ Found ${standings.length} standings for '${gameName}' via API.`);
            return standings;
        }
        return [];
    } catch (error) {
        console.error(`❌ Error calling iScored API for standings of game '${gameName}':`, error);
        return [];
    }
}

/**
 * Reusable function to scrape winner/score from the public page using an existing Page instance.
 */
export async function getWinnerAndScoreFromPage(page: Page, gameId: string, gameName: string): Promise<{ winner: string; score: string }> {
    console.log(`🔎 Scraping public page for winner of '${gameName}' (ID: ${gameId})...`);

    try {
        const publicUrl = process.env.ISCORED_PUBLIC_URL;
        if (!publicUrl) {
            console.error('❌ ISCORED_PUBLIC_URL is not defined in environment variables.');
            return { winner: 'N/A', score: 'N/A' };
        }
        
        // Navigate if not already there (or force reload to get fresh data)
        await page.goto(publicUrl);

        const mainFrame = page.frameLocator('#main');
        
        // Directly locate the target game card using its ID
        const targetGameCard = mainFrame.locator(`div.game#a${gameId}`);
        
        // Wait briefly for the element to appear
        try {
            await targetGameCard.waitFor({ state: 'visible', timeout: 5000 });
        } catch (e) {
            console.log(`⚠️ Could not find visible game card for '${gameName}' (ID: ${gameId}) on public page.`);
            return { winner: 'N/A', score: 'N/A' };
        }

        console.log(`Debug: Found target game card for '${gameName}' (ID: ${gameId}).`);

        // Check if the game is locked on the public page
        if (await targetGameCard.locator('.scorebox.locked').isVisible()) {
            console.log(`⚠️ Game '${gameName}' (ID: ${gameId}) is locked on the public page (admin side). Cannot determine winner.`);
            return { winner: 'N/A', score: 'N/A' };
        }

        // Find the top score in the primary scorebox.
        const winnerNameElement = targetGameCard.locator(`.scorebox .name`).first();
        const winnerScoreElement = targetGameCard.locator(`.scorebox .score:not([id])`).first();
        
        if (await winnerNameElement.isVisible() && await winnerScoreElement.isVisible()) {
            const winnerName = await winnerNameElement.innerText();
            const winnerScore = await winnerScoreElement.innerText();
            console.log(`✅ Found Winner: ${winnerName} with a score of ${winnerScore} for game '${gameName}'`);
            return { winner: winnerName, score: winnerScore };
        } else {
            console.log(`⚠️ Could not find visible winner name or score elements within the game card for '${gameName}' (ID: ${gameId}).`);
            return { winner: 'N/A', score: 'N/A' }; 
        }

    } catch (error) {
        console.error(`Error scraping public page for winner of '${gameName}' (ID: ${gameId}):`, error);
        return { winner: 'N/A', score: 'N/A' };
    }
}

/**
 * Fetches the winner and their score for a specific game by scraping the public iScored page.
 * This function launches its own browser instance to perform the scraping.
 */
export async function getWinnerAndScoreFromPublicPage(gameId: string, gameName: string): Promise<{ winner: string; score: string }> {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        ({ browser, page } = await loginToIScored());
        return await getWinnerAndScoreFromPage(page, gameId, gameName);
    } catch (error) {
        console.error(`Error in getWinnerAndScoreFromPublicPage for '${gameName}' (ID: ${gameId}):`, error);
        return { winner: 'N/A', score: 'N/A' };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

export interface Standing {
    rank: string;
    name: string;
    score: string;
}

export async function getStandingsFromPublicPage(gameId: string): Promise<Standing[]> {
    console.log(`🔎 Scraping public page for standings of game ID '${gameId}'...`);
    const publicUrl = process.env.ISCORED_PUBLIC_URL;
    if (!publicUrl) {
        throw new Error('ISCORED_PUBLIC_URL is not defined in environment variables.');
    }

    let browser: Browser | null = null;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(publicUrl);

        try {
            await page.click('button:has-text("I agree")', { timeout: 3000 });
        } catch { /* ignored */ }

        const mainFrame = page.frameLocator('#main');
        
        // Find all visible, unlocked scoreboxes
        const allScoreboxes = await mainFrame.locator('div.scorebox.unlocked').all();
        
        const standings: Standing[] = [];
        let rank = 1;

        for (const scorebox of allScoreboxes) {
            const classAttribute = await scorebox.getAttribute('class');
            // Extract the game ID from the class string, e.g., "scorebox a90658Box unlocked" -> "90658"
            const match = classAttribute?.match(/a(\d+)Box/);
            const scoreboxGameId = match ? match[1] : null;

            if (scoreboxGameId === gameId) {
                const name = await scorebox.locator('.name').textContent() ?? 'N/A';
                // Find the score that does NOT have an ID, which indicates it's the top score
                const score = await scorebox.locator('.score:not([id])').textContent() ?? 'N/A';
                
                standings.push({
                    rank: (rank++).toString(),
                    name: name.trim(),
                    score: score.trim(),
                });
            }
        }

        await browser.close();
        console.log(`✅ Found ${standings.length} standings for game ID ${gameId}.`);
        return standings;

    } catch (error) {
        console.error(`Error scraping public page for standings of game ID '${gameId}':`, error);
        throw new Error('Could not fetch standings.');
    }
}


export async function findActiveGame(gameType: string): Promise<{id: string, name: string} | null> {
    console.log(`🔎 Finding active game for type '${gameType}' via admin login...`);
    let browser: Browser | null = null;
    let page: Page | null = null;
    try {
        ({ browser, page } = await loginToIScored());

        const { activeGames } = await findGames(page, gameType);

        if (activeGames.length > 0) {
            const activeGame = {
                id: activeGames[0].id,
                name: activeGames[0].name
            };
            console.log(`✅ Found active game for type '${gameType}': ${activeGame.name} (ID: ${activeGame.id})`);
            return activeGame;
        } else {
            console.log(`⚠️ Could not find an active game for type '${gameType}'.`);
            return null;
        }

    } catch (error) {
        console.error(`❌ Error finding active game for type '${gameType}':`, error);
        return null;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}