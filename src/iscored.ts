import { chromium, Browser, Page, Locator } from 'playwright';
import { scheduleGameUnlock } from './scheduler.js';
import { addUserMapping } from './userMapping.js';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import axios from 'axios';

const ISCORED_LOGIN_URL = 'https://iscored.info/';

export interface Game {
    id: string;
    name: string;
    isLocked: boolean;
}

export async function loginToIScored(): Promise<{ browser: Browser, page: Page }> {
    console.log('🚀 Launching browser and logging into iScored...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(ISCORED_LOGIN_URL);

        try {
            // Use a more specific locator for the cookie consent button if needed, but this is a good first attempt
            await page.click('button:has-text("I agree")', { timeout: 3000 });
        } catch (error) {
            console.log('Cookie consent dialog not found or already dismissed. Continuing...');
        }

        const mainFrame = page.frameLocator('#main');
        
        await mainFrame.getByRole('textbox', { name: 'Username' }).fill(process.env.ISCORED_USERNAME!);
        await mainFrame.getByRole('textbox', { name: 'Password', exact: true }).fill(process.env.ISCORED_PASSWORD!);
        await mainFrame.getByRole('button', { name: 'Log In' }).click();

        console.log('✅ Successfully logged in to iScored.');
        return { browser, page };

    } catch (error) {
        console.error('❌ Failed during login process.');
        await page.screenshot({ path: 'login_error.png', fullPage: true });
        console.log('📷 Screenshot saved to login_error.png');
        await browser.close();
        throw error;
    }
}

export async function findGames(page: Page, gameType: string): Promise<{ activeGames: Game[], nextGames: Game[] }> {
    console.log(`🔎 Finding active and next '${gameType}' games on the Settings -> Lineup page...`);

    try {
        const mainFrame = page.frameLocator('#main');

        // Removed redundant navigation steps. Assume caller has already navigated.
        await mainFrame.locator('ul#orderGameUL').waitFor();
        
        console.log('   -> On Lineup page. Locating li.list-group-item elements.');
        const gameElements = await mainFrame.locator('li.list-group-item').all();
        console.log(`   -> Found ${gameElements.length} li.list-group-item elements.`);

        let activeGames: Game[] = [];
        let nextGames: Game[] = [];

        for (const gameRow of gameElements) {
            const nameElement = gameRow.locator('span.dragHandle');
            const name = (await nameElement.innerText()).trim();
            console.log(`   -> Processing game: "${name}"`);

            if (name.toUpperCase().includes(gameType.toUpperCase())) {
                console.log(`      -> Game name includes '${gameType}'.`);
                const idAttr = await gameRow.getAttribute('id');
                if (!idAttr) {
                    console.log(`      -> No id attribute found for ${gameType} game, skipping.`);
                    continue;
                }
                
                const id = idAttr; // The ID is directly on the <li> element, e.g., id="90658"
                console.log(`      -> Game ID attribute: "${idAttr}", extracted ID: "${id}"`);

                const lockCheckbox = gameRow.locator('input.lockCheckbox');
                const isLocked = await lockCheckbox.isChecked();
                console.log(`      -> isLocked: ${isLocked}`);
                
                const game: Game = { id, name, isLocked };

                if (!isLocked) {
                    activeGames.push(game);
                } else {
                    nextGames.push(game);
                }
            }
        }

        if (activeGames.length > 0) {
            console.log(`✅ Found ${activeGames.length} active ${gameType} game(s):`);
            activeGames.forEach(g => console.log(`   - ${g.name} (ID: ${g.id})`));
        } else {
            console.log(`⚠️ Could not find any active (unlocked) ${gameType} games.`);
        }

        if (nextGames.length > 0) {
            console.log(`✅ Found ${nextGames.length} next (locked) ${gameType} game(s):`);
            nextGames.forEach(g => console.log(`   - ${g.name} (ID: ${g.id})`));
        } else {
            console.log(`⚠️ Could not find any next (locked) ${gameType} game(s).`);
        }

        return { activeGames, nextGames };

    } catch (error) {
        console.error('❌ Failed to find games on the Lineup page.');
        await page.screenshot({ path: 'find_games_error.png', fullPage: true });
        console.log('📷 Screenshot of the Lineup page saved to find_games_error.png.');
        throw error;
    }
}
export async function findGameByName(page: Page, gameName: string): Promise<Game | null> {
    try {
        const mainFrame = page.frameLocator('#main');
        
        // Removed redundant navigation steps. Assume caller has already navigated.
        await mainFrame.locator('ul#orderGameUL').waitFor();
        
        const gameRows = await mainFrame.locator('li.list-group-item').all();

        for (const row of gameRows) {
            const nameElement = row.locator('span.dragHandle');
            const name = (await nameElement.innerText()).trim();
            if (name.trim().toUpperCase() === gameName.trim().toUpperCase()) {
                const idAttr = await row.getAttribute('id');
                if (!idAttr) continue;
                const id = idAttr.replace('game', ''); // e.g., id="game90658" -> "90658"
                
                const lockCheckbox = row.locator('input.lockCheckbox');
                const isLocked = await lockCheckbox.isChecked();
                
                return { id, name, isLocked };
            }
        }
        return null; // Game not found
    } catch (error) {
        console.error(`❌ Failed to find game by name '${gameName}'.`);
        throw error;
    }
}

export async function findGameRow(page: Page, gameName: string): Promise<Locator | null> {
    try {
        const mainFrame = page.frameLocator('#main');
        
        // Removed redundant navigation steps. Assume caller has already navigated.
        await mainFrame.locator('ul#orderGameUL').waitFor();

        const gameRows = await mainFrame.locator('li.list-group-item').all();

        for (const row of gameRows) {
            const nameElement = row.locator('span.dragHandle');
            const name = (await nameElement.innerText()).trim();
            if (name.trim().toUpperCase() === gameName.trim().toUpperCase()) {
                return row; // Return the Locator for the entire row
            }
        }
        return null; // Game row not found
    } catch (error) {
        console.error(`❌ Failed to find game row for '${gameName}'.`);
        throw error;
    }
}


export async function lockGame(page: Page, game: Game) {
    console.log(`🔒 Locking game ID: ${game.id}`);
    
    // Assume we are already on the lineup page.
    const mainFrame = page.frameLocator('#main');
    const lockCheckbox = mainFrame.locator(`#lock${game.id}`);
    
    // Check if the game is already locked
    if (!(await lockCheckbox.isChecked())) {
        await lockCheckbox.check({ force: true });
        await page.waitForTimeout(1000); // Give AJAX time for state to update server-side
        console.log(`Intermediate: Checkbox for ${game.name} (ID: ${game.id}) clicked.`);
    } else {
        console.log(`Info: Game ${game.name} (ID: ${game.id}) was already locked.`);
    }

    // Verify the change was persisted
    if (!(await lockCheckbox.isChecked())) {
        throw new Error(`Failed to verify lock for game ${game.name} (ID: ${game.id}). Checkbox is not checked.`);
    }

    console.log(`✅ Game locked: ${game.name} (ID: ${game.id})`);
}

export async function unlockGame(page: Page, game: Game) {
    console.log(`🔓 Unlocking game ID: ${game.id}`);
    
    // Assume we are already on the lineup page.
    const mainFrame = page.frameLocator('#main');
    const lockCheckbox = mainFrame.locator(`#lock${game.id}`);

    // Check if the game is already unlocked
    if (await lockCheckbox.isChecked()) {
        await lockCheckbox.uncheck({ force: true });
        await page.waitForTimeout(1000); // Give AJAX time for state to update server-side
        console.log(`Intermediate: Checkbox for ${game.name} (ID: ${game.id}) clicked.`);
    } else {
        console.log(`Info: Game ${game.name} (ID: ${game.id}) was already unlocked.`);
    }

    // Verify the change was persisted
    if (await lockCheckbox.isChecked()) {
        throw new Error(`Failed to verify unlock for game ${game.name} (ID: ${game.id}). Checkbox is still checked.`);
    }
    
    console.log(`✅ Game unlocked: ${game.name} (ID: ${game.id})`);
}

export async function navigateToLineupPage(page: Page) {
    console.log('Navigating to Lineup page...');
    const mainFrame = page.frameLocator('#main');
    await mainFrame.locator('#userDropdown').getByRole('link').click();
    await mainFrame.getByRole('link', { name: ' Settings' }).click();
    await mainFrame.locator('a[href="#order"]').click();
    // Add a wait for the page to be fully loaded after navigation
    await page.waitForLoadState('domcontentloaded'); 
    await mainFrame.locator('ul#orderGameUL').waitFor({ state: 'visible' }); // Explicitly wait for visible
    console.log('✅ On Lineup page.');
}
    
export async function createGame(page: Page, gameName: string) {
    console.log(`✨ Creating new game: ${gameName}`);
    
    try {
        const mainFrame = page.frameLocator('iframe').first();

        // 1. Navigate to the Games tab in settings.
        await mainFrame.locator('a[href="#games"]').click();
        
        // 2. Click "Add New Game".
        await mainFrame.locator('button:has-text("Add New Game")').click();
        
        // 3. Fill in the game name into the search input (to name the blank game) and click "Create Blank Game"
        // The modal says: "Type the name of your game in the Search box below. [...] create a blank game with no styling."
        // So filling the search box should name the blank game.
        await mainFrame.locator('input[type="search"][aria-controls="stylesTable"]').fill(gameName);
        await mainFrame.locator('button:has-text("Create Blank Game")').click();
        
        // TODO: Research if there's an option to set a default placeholder image or if this needs to be a manual step.
        // For now, the game will be created without an associated style.
        console.log(`✅ Created blank game '${gameName}'.`);

        // Wait for the page to settle after game creation
        await page.waitForLoadState('domcontentloaded');
        
        // After creation, verify the game exists and then lock it.
        console.log(`Attempting to find and lock the newly created game '${gameName}'.`);

        const newGame = await findGameByName(page, gameName);
        if (newGame) {
            await lockGame(page, newGame);
            console.log(`✅ Game '${gameName}' created and locked successfully.`);

            // Schedule the unlock for 24 hours from now.
            const now = new Date();
            const unlockDateTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

            await scheduleGameUnlock(gameName, unlockDateTime);
        } else {
            console.error(`❌ Could not find the newly created game '${gameName}' to lock or schedule unlock.`);
        }

    } catch (error) {
        console.error(`❌ Failed to create game '${gameName}'.`, error);
        await page.screenshot({ path: 'create_game_error.png', fullPage: true });
        console.log(`📷 Screenshot saved to create_game_error.png.`);
        throw error;
    }
}

export async function submitScoreToIscored(iScoredUsername: string, discordUserId: string, score: number, photoUrl: string, gameType: string) {
    console.log(`🚀 Submitting score to iScored: User '${iScoredUsername}', Score: ${score}, Game Type: ${gameType}`);
    let browser: Browser | null = null;
    try {
        const { browser: newBrowser, page } = await loginToIScored();
        browser = newBrowser;

        // 1. Find the active game from the settings page.
        const { activeGames } = await findGames(page, gameType);

        if (activeGames.length === 0) {
            throw new Error(`Could not find an active ${gameType} game to submit score to.`);
        }
        
        const activeGame = activeGames[0]; // Select the first active game
        
        // 2. Navigate back to the main page to click the score entry element.
        console.log(`   -> Navigating to main page to submit score for ${activeGame.name}`);
        await page.goto(ISCORED_LOGIN_URL, { waitUntil: 'domcontentloaded' });
        const mainFrame = page.frameLocator('#main');

        // 3. Click the correct element to open the score modal.
        // The element ID on the main page is in the format 'a<gameId>Scores'.
        const scoreEntryActivator = mainFrame.locator(`#a${activeGame.id}Scores`);
        await scoreEntryActivator.click();

        // 4. Wait for the score entry modal to be visible and fill in the details.
        await mainFrame.locator('#scoreEntryDiv').waitFor({ state: 'visible' });
        await mainFrame.locator('#newInitials').fill(iScoredUsername);
        await mainFrame.locator('#newScore').fill(score.toString());

        // 5. Handle photo upload
        console.log(`📷 Downloading photo from ${photoUrl}`);
        const tempDir = 'C:\\Users\\mekel\\.gemini\\tmp\\73d07c8ace8fc258f6b4b6b6188aa866a6357b1acbf7e6c12cd14a5197c149cb'; // Ensure this path is correct
        const photoResponse = await axios({
            url: photoUrl,
            method: 'GET',
            responseType: 'stream'
        });
        
        const tempPhotoPath = path.join(tempDir, `score_photo_${Date.now()}.jpg`);
        const writer = fs.createWriteStream(tempPhotoPath);
        photoResponse.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(undefined));
            writer.on('error', reject);
        });

        console.log(`✅ Photo downloaded to ${tempPhotoPath}`);
        
        // Re-implement file chooser logic
        const fileChooserPromise = page.waitForEvent('filechooser');
        await mainFrame.locator('#takePhoto').click(); // Click the button to trigger the file chooser
        const fileChooser = await fileChooserPromise;
        console.log(`   -> Setting files for upload: ${tempPhotoPath}`);
        await fileChooser.setFiles(tempPhotoPath);
        console.log(`✅ Photo uploaded via file chooser.`);
        // Add a small delay to allow the page to process the file selection
        await page.waitForTimeout(1000);

        // 6. Post the score.
        await mainFrame.getByRole('button', { name: 'Post Your Score!' }).click();
        
        // 7. Wait for submission to complete and handle potential confirmation dialog.
        try {
            // Check for the confirmation dialog that appeared in the codegen
            await mainFrame.getByRole('button', { name: 'Yes Please.' }).click({ timeout: 3000 });
            console.log('   -> Clicked "Yes Please." confirmation.');
        } catch (e) {
            console.log('   -> "Yes Please." confirmation dialog not found, continuing...');
        }

        // Wait for the modal to disappear as a final confirmation of success.
        await mainFrame.locator('#scoreEntryDiv').waitFor({ state: 'hidden' });
        console.log(`✅ Score ${score} submitted successfully to iScored for game '${activeGame.name}' by ${iScoredUsername}.`);

        // Add/Update user mapping after successful score submission
        await addUserMapping(iScoredUsername, discordUserId);

        // Clean up the downloaded photo
        await fsPromises.unlink(tempPhotoPath);
        console.log(`🗑️ Deleted temporary photo: ${tempPhotoPath}`);

    } catch (error) {
        console.error(`❌ Failed to submit score to iScored for user '${iScoredUsername}' (Discord: ${discordUserId}):`, error);
        // We no longer have a 'page' object here if it fails during login
        // if (page) { 
        //     await page.screenshot({ path: 'submit_score_error.png', fullPage: true });
        //     console.log(`📷 Screenshot saved to submit_score_error.png.`);
        // }
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}