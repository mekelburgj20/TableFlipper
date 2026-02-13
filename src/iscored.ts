import { chromium, Browser, Page, Locator } from 'playwright';
import { scheduleGameShow } from './scheduler.js'; // Updated import
import { addUserMapping } from './userMapping.js';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import os from 'os'; // Import os module
import axios from 'axios';

const ISCORED_LOGIN_URL = 'https://iscored.info/';
const ISCORED_SETTINGS_URL = 'https://iscored.info/settings.php';
const ISCORED_LINEUP_URL = 'https://iscored.info/settings.php#order'; // Direct URL for the Lineup tab
const ISCORED_GAMES_URL = 'https://iscored.info/settings.php#games'; // Direct URL for the Games tab

export interface Game {
    id: string;
    name: string;
    isHidden: boolean; // Changed from isLocked to isHidden
}

export async function loginToIScored(): Promise<{ browser: Browser, page: Page }> {
    console.log('🚀 Launching browser and logging into iScored...');
    const browser = await chromium.launch({ headless: true });
    
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    // Polyfill the Wake Lock API to prevent script errors on the page
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'wakeLock', {
            get: () => ({
                request: () => Promise.resolve(),
            }),
            configurable: true, // Allow redefining the property
        });
    });

    // Listen for all console events and log them to the terminal
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        if (text.includes('DevTools listening on')) return;
        console.log(`[Browser Console - ${type.toUpperCase()}]: ${text}`);
    });

    try {
        await page.goto(ISCORED_LOGIN_URL);

        try {
            await page.click('button:has-text("I agree")', { timeout: 3000 });
        } catch (error) {
            console.log('Cookie consent dialog not found or already dismissed. Continuing...');
        }

        const mainFrame = page.frameLocator('#main');
        
        await mainFrame.getByRole('textbox', { name: 'Username' }).fill(process.env.ISCORED_USERNAME!);
        await mainFrame.getByRole('textbox', { name: 'Password', exact: true }).fill(process.env.ISCORED_PASSWORD!);
        await mainFrame.getByRole('button', { name: 'Log In' }).click();

        // Wait for the main page to load after login by waiting for the user dropdown
        await mainFrame.locator('#userDropdown').waitFor({ state: 'visible', timeout: 10000 });
        
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

        // Removed redundant navigation steps. Assume caller has already navigated and waited.
        
        console.log('   -> On Lineup page. Locating li.list-group-item elements.');
        const gameElements = await mainFrame.locator('li.list-group-item').all();
        console.log(`   -> Found ${gameElements.length} li.list-group-item elements.`);

        let activeGames: Game[] = [];
        let nextGames: Game[] = [];

        for (const gameRow of gameElements) {
            const nameElement = gameRow.locator('span.dragHandle');
            const name = (await nameElement.innerText()).trim();
            console.log(`   -> Processing game: "${name}"`);

            if (name.toUpperCase().includes(' ' + gameType.toUpperCase())) {
                console.log(`      -> Game name includes ' ${gameType}'.`);
                const idAttr = await gameRow.getAttribute('id');
                if (!idAttr) {
                    console.log(`      -> No id attribute found for ${gameType} game, skipping.`);
                    continue;
                }
                
                const id = idAttr; // The ID is directly on the <li> element, e.g., id="90658"
                console.log(`      -> Game ID attribute: "${idAttr}", extracted ID: "${id}"`);

                const hideCheckbox = gameRow.locator('input[id^="hide"]'); // Target the specific hide checkbox
                const isHidden = await hideCheckbox.isChecked();
                console.log(`      -> isHidden: ${isHidden}`);
                
                const game: Game = { id, name, isHidden }; // Changed isLocked to isHidden

                if (!isHidden) {
                    activeGames.push(game);
                } else {
                    nextGames.push(game);
                }
            }
        }

        if (activeGames.length > 0) {
            console.log(`✅ Found ${activeGames.length} active (shown) ${gameType} game(s):`);
            activeGames.forEach(g => console.log(`   - ${g.name} (ID: ${g.id})`));
        } else {
            console.log(`⚠️ Could not find any active (shown) ${gameType} games.`);
        }

        if (nextGames.length > 0) {
            console.log(`✅ Found ${nextGames.length} next (hidden) ${gameType} game(s):`);
            nextGames.forEach(g => console.log(`   - ${g.name} (ID: ${g.id})`));
        } else {
            console.log(`⚠️ Could not find any next (hidden) ${gameType} game(s).`);
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
        
        // Removed redundant navigation steps. Assume caller has already navigated and waited.
        
        const gameRows = await mainFrame.locator('li.list-group-item').all();

        for (const row of gameRows) {
            const nameElement = row.locator('span.dragHandle');
            const name = (await nameElement.innerText()).trim();
            if (name.trim().toUpperCase() === gameName.trim().toUpperCase()) {
                const idAttr = await row.getAttribute('id');
                if (!idAttr) continue;
                const id = idAttr; // The ID is directly on the <li> element, e.g., id="90658"
                
                const hideCheckbox = row.locator(`input[id="hide${id}"]`); // Find the hide checkbox by ID
                const isHidden = await hideCheckbox.isChecked();
                
                return { id, name, isHidden }; // Changed isLocked to isHidden
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

export async function hideGame(page: Page, game: Game): Promise<void> {
    console.log(`📦 Hiding game: ${game.name} (ID: ${game.id})`);
    try {
        // Assume we are already on the Lineup page.
        const mainFrame = page.frameLocator('#main');

        // Find the game row for the specific game
        const gameRow = await findGameRow(page, game.name); // findGameRow returns the Locator for the <li>
        if (!gameRow) {
            throw new Error(`Game row for '${game.name}' not found on Lineup page to hide.`);
        }

        const hideCheckbox = gameRow.locator(`#hide${game.id}`); // Target the specific hide checkbox
        await hideCheckbox.waitFor({ state: 'visible', timeout: 5000 }); // Wait specifically for the checkbox

        if (!(await hideCheckbox.isChecked())) {
            await hideCheckbox.check({ force: true });
            await page.waitForTimeout(1000); // Give AJAX time for state to update server-side
            console.log(`Intermediate: Hide checkbox for ${game.name} (ID: ${game.id}) checked.`);
        } else {
            console.log(`Info: Game ${game.name} (ID: ${game.id}) was already hidden.`);
        }

        if (!(await hideCheckbox.isChecked())) {
            throw new Error(`Failed to verify hide for game ${game.name} (ID: ${game.id}). Checkbox is not checked.`);
        }

        console.log(`✅ Game '${game.name}' (ID: ${game.id}) hidden successfully.`);

    } catch (error) {
        console.error(`❌ Failed to hide game '${game.name}' (ID: ${game.id}).`, error);
        await page.screenshot({ path: 'hide_game_error.png', fullPage: true });
        console.log(`📷 Screenshot saved to hide_game_error.png.`);
        throw error;
    }
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

export async function showGame(page: Page, game: Game): Promise<void> {
    console.log(`🎉 Showing game: ${game.name} (ID: ${game.id})`);
    try {
        // Assume we are already on the Lineup page.
        const mainFrame = page.frameLocator('#main');

        // Find the game row for the specific game
        const gameRow = await findGameRow(page, game.name); // findGameRow returns the Locator for the <li>
        if (!gameRow) {
            throw new Error(`Game row for '${game.name}' not found on Lineup page to show.`);
        }

        // First, unlock the game
        await unlockGame(page, game);
        console.log(`✅ Game '${game.name}' (ID: ${game.id}) unlocked before being shown.`);

        const hideCheckbox = gameRow.locator(`#hide${game.id}`); // Target the specific hide checkbox
        await hideCheckbox.waitFor({ state: 'visible', timeout: 5000 }); // Wait specifically for the checkbox

        // We want to UNCHECK this box to unhide/show the game
        if (await hideCheckbox.isChecked()) {
            await hideCheckbox.uncheck({ force: true });
            await page.waitForTimeout(1000); // Give AJAX time for state to update server-side
            console.log(`Intermediate: Hide checkbox for ${game.name} (ID: ${game.id}) unchecked.`);
        } else {
            console.log(`Info: Game ${game.name} (ID: ${game.id}) was already shown.`);
        }

        // Verify the change was persisted
        if (await hideCheckbox.isChecked()) {
            throw new Error(`Failed to verify show for game ${game.name} (ID: ${game.id}). Checkbox is still checked.`);
        }
        
        console.log(`✅ Game '${game.name}' (ID: ${game.id}) shown successfully.`);

    } catch (error) {
        console.error(`❌ Failed to show game '${game.name}' (ID: ${game.id}).`, error);
        await page.screenshot({ path: 'show_game_error.png', fullPage: true });
        console.log(`📷 Screenshot saved to show_game_error.png.`);
        throw error;
    }
}

export async function navigateToSettingsPage(page: Page) {
    console.log('Navigating to Settings page via URL...');
    await page.goto(ISCORED_SETTINGS_URL);
    // Wait for a known element on the settings page to be visible
    await page.locator('#main a[href="#order"]').waitFor({ state: 'visible', timeout: 10000 });
    console.log('✅ On Settings page.');
}

export async function navigateToLineupPage(page: Page) {
    console.log('Navigating to Lineup page via URL + Click...');
    try {
        // Navigate to settings page base
        await page.goto(ISCORED_SETTINGS_URL);
        console.log(`   -> Current URL: ${page.url()}`);
        
        // Explicitly click the Lineup tab to ensure it renders/shows
        const lineupTab = page.frameLocator('#main').locator('a[href="#order"]');
        await lineupTab.waitFor({ state: 'visible', timeout: 30000 });
        await lineupTab.click();
        
        console.log('   -> Clicked Lineup tab. Waiting for list...');
        await page.waitForFunction(() => {
            const iframe = document.querySelector('#main');
            if (!iframe) return false;
            const iframeDoc = (iframe as HTMLIFrameElement).contentDocument;
            if (!iframeDoc) return false;
            const list = iframeDoc.querySelector('ul#orderGameUL');
            if (!list) return false;
            const style = window.getComputedStyle(list);
            if (style.display === 'none' || style.visibility === 'hidden') {
                return false;
            }
            return true;
        }, { timeout: 30000 });
        
        console.log('✅ On Lineup page.');

    } catch (e) {
        console.error('❌ Timeout or error in navigateToLineupPage. Taking a screenshot.');
        try {
            await page.screenshot({ path: 'lineup_page_error.png', fullPage: true });
            console.log(`📷 Screenshot saved to lineup_page_error.png.`);
        } catch (sError) {
            console.error('Failed to take screenshot:', sError);
        }
        throw e;
    }
}



export async function createGame(page: Page, gameName: string): Promise<string> {
    console.log(`✨ Creating new game: ${gameName}`);
    
    try {
        const mainFrame = page.frameLocator('#main');

        // Ensure we are on the settings page, then go to Games tab
        await navigateToSettingsPage(page); // Navigates to settings page
        await mainFrame.locator('a[href="#games"]').click(); // Clicks games tab
        await mainFrame.locator('button:has-text("Add New Game")').waitFor({ state: 'visible' });

        // 2. Click "Add New Game".
        await mainFrame.locator('button:has-text("Add New Game")').click();
        
        // 3. Fill in the game name into the search input and click "Create Blank Game"
        await mainFrame.locator('input[type="search"][aria-controls="stylesTable"]').fill(gameName);
        await mainFrame.locator('button:has-text("Create Blank Game")').click();
        
        console.log(`✅ Created blank game '${gameName}'.`);

        // Now, switch to the Lineup tab to get the game ID and then hide/lock it.
        await mainFrame.locator('a[href="#order"]').click(); // Click on Lineup tab
        // Re-wait for the lineup content to ensure it's loaded after tab switch
        await page.waitForFunction(() => {
            const iframe = document.querySelector('#main');
            if (!iframe) return false;
            const iframeDoc = (iframe as HTMLIFrameElement).contentDocument;
            if (!iframeDoc) return false;
            const list = iframeDoc.querySelector('ul#orderGameUL');
            if (!list) return false;
            const style = window.getComputedStyle(list);
            if (style.display === 'none' || style.visibility === 'hidden') {
                return false;
            }
            return true;
        }, { timeout: 15000 });

        const newlyCreatedGame = await findGameByName(page, gameName);

        if (!newlyCreatedGame) {
            throw new Error(`Could not find newly created game '${gameName}' on the Lineup page.`);
        }

        // Hide the newly created game.
        await hideGame(page, newlyCreatedGame);
        console.log(`✅ Game '${gameName}' created and hidden successfully.`);

        // Lock the newly created game as well to prevent premature scores
        await lockGame(page, newlyCreatedGame);
        console.log(`✅ Game '${gameName}' also locked to prevent premature scores.`);

        // Schedule the show for 24 hours from now.
        const now = new Date();
        const showDateTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
        await scheduleGameShow(newlyCreatedGame.name, showDateTime);

        return newlyCreatedGame.id;

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

        // Navigate to the Lineup page to find the active game
        await navigateToLineupPage(page);

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
        
        // Retry logic for opening the modal
        let modalVisible = false;
        for (let i = 0; i < 3; i++) {
            try {
                console.log(`   -> Attempt ${i + 1} to open score modal...`);
                await scoreEntryActivator.click({ timeout: 5000 });
                await mainFrame.locator('#scoreEntryDiv').waitFor({ state: 'visible', timeout: 5000 });
                modalVisible = true;
                break;
            } catch (e) {
                console.warn(`   -> Attempt ${i + 1} failed or timed out. Retrying...`);
                // If the modal didn't appear, maybe the click didn't register or the page wasn't ready.
                // Waiting a bit before retry.
                await page.waitForTimeout(2000);
            }
        }

        if (!modalVisible) {
             throw new Error('Failed to open score entry modal after 3 attempts.');
        }

        // 4. Wait for the score entry modal to be visible and fill in the details.
        // (Already waited in the loop, but good to ensure element reference is fresh if needed, though locator is lazy)
        await mainFrame.locator('#newInitials').fill(iScoredUsername);
        await mainFrame.locator('#newScore').fill(score.toString());

        // 5. Handle photo upload
        console.log(`📷 Downloading photo from ${photoUrl}`);
        const tempDir = path.join(os.tmpdir(), 'tableflipper_tmp'); // Use system's temp directory
        await fsPromises.mkdir(tempDir, { recursive: true }); // Ensure directory exists
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
            const confirmButton = mainFrame.getByRole('button', { name: 'Yes Please.' });
            await confirmButton.click({ timeout: 3000 });
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