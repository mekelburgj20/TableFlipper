import { promises as fs } from 'fs';
import * as path from 'path';
import { runStateSync } from './sync-state.js';
import { getAllVisibleGames, GameRow, getTable, updateGameStatus, getGameByIscoredId } from './database.js';
import { loginToIScored, scrapeScoresForGame, ScoreWithPhoto, createGame, submitScoreToIscored, deleteGame, findGames, getAllGames, Game, addTagToGame, showGame, hideGame, lockGame, unlockGame } from './iscored.js';
import { logInfo, logError, logWarn } from './logger.js';
import axios from 'axios';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const streamPipeline = promisify(pipeline);
const BACKUP_DIR = path.join(process.cwd(), 'backups');

// Extended interface to handle both DB games and raw iScored games
interface BackupGame {
    // Core Identity
    iscored_game_id: string; // Original ID at time of backup
    name: string;
    
    // Status
    isHidden: boolean;
    isLocked: boolean;
    tags?: string[];

    // DB Metadata (Optional - only for tournament games)
    db_id?: string;
    type?: string;
    picker_discord_id?: string | null;
    nominated_by_discord_id?: string | null;
    created_at?: string;
    scheduled_to_be_active_at?: string | null;
    completed_at?: string | null;

    // Data
    scores: ScoreWithPhoto[];
}

interface BackupMetadata {
    timestamp: string;
    games: BackupGame[];
}

/**
 * Creates a full backup of the system state.
 * 1. Runs sync-state to ensure DB is up to date (for tournament games).
 * 2. Fetches ALL games from iScored lineup.
 * 3. Scrapes scores and photos for all of them.
 * 4. Merges with DB metadata where available.
 * 5. Saves everything to a timestamped backup folder.
 */
export async function createBackup(): Promise<string> {
    logInfo('📦 Starting System Backup...');
    
    // 1. Sync State first (ensure DB is fresh for tournament tracking)
    await runStateSync();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, timestamp);
    const photosDir = path.join(backupPath, 'photos');

    await fs.mkdir(photosDir, { recursive: true });

    // 2. Copy Database and Config Files
    const dataDir = path.join(process.cwd(), 'data');
    const filesToCopy = ['tableflipper.db'];
    const rootFilesToCopy = ['history.json', 'pickerState.json', 'userMapping.json'];

    for (const file of filesToCopy) {
        try {
            await fs.copyFile(path.join(dataDir, file), path.join(backupPath, file));
            logInfo(`   -> Copied ${file}`);
        } catch (e) {
            logWarn(`   -> Could not copy ${file} (might not exist).`);
        }
    }

    for (const file of rootFilesToCopy) {
        try {
            await fs.copyFile(path.join(process.cwd(), file), path.join(backupPath, file));
            logInfo(`   -> Copied ${file}`);
        } catch (e) {
            logWarn(`   -> Could not copy ${file} (might not exist).`);
        }
    }

    // 3. Fetch All Games & Scrape Scores
    const backupGames: BackupGame[] = [];
    
    let browser = null;
    try {
        const { browser: b, page } = await loginToIScored();
        browser = b;

        // Get ALL games currently on the lineup
        const liveGames = await getAllGames(page);
        logInfo(`   -> Found ${liveGames.length} games on iScored lineup to backup.`);

        for (const liveGame of liveGames) {
            logInfo(`   -> Backing up game: ${liveGame.name} (ID: ${liveGame.id})...`);
            
            // Try to find matching DB entry
            const dbGame = await getGameByIscoredId(liveGame.id);
            
            // Construct base BackupGame object
            const backupGame: BackupGame = {
                iscored_game_id: liveGame.id,
                name: liveGame.name,
                isHidden: liveGame.isHidden,
                isLocked: liveGame.isLocked,
                tags: liveGame.tags,
                scores: []
            };

            // Merge DB metadata if available
            if (dbGame) {
                backupGame.db_id = dbGame.id;
                backupGame.type = dbGame.type;
                backupGame.picker_discord_id = dbGame.picker_discord_id;
                backupGame.nominated_by_discord_id = dbGame.nominated_by_discord_id;
                backupGame.created_at = dbGame.created_at;
                backupGame.scheduled_to_be_active_at = dbGame.scheduled_to_be_active_at;
                backupGame.completed_at = dbGame.completed_at;
                logInfo(`      -> Linked to DB entry (Type: ${dbGame.type})`);
            } else {
                logInfo(`      -> No DB entry found (Regular game).`);
            }

            // Scrape scores (only if game is visible/accessible? getAllGames returns them so they exist)
            // But scrapeScoresForGame uses public page logic. If it's hidden, public page might not show it?
            // getAllGames returns hidden ones too.
            // If hidden, scrapeScoresForGame might fail or return empty.
            if (!liveGame.isHidden) {
                try {
                    backupGame.scores = await scrapeScoresForGame(page, liveGame.id);
                } catch (e) {
                    logWarn(`      -> Could not scrape scores for ${liveGame.name}: ${e}`);
                }
            } else {
                logInfo(`      -> Game is hidden, skipping score scrape.`);
            }

            // Download photos
            for (const score of backupGame.scores) {
                if (score.photoUrl) {
                    try {
                        const ext = path.extname(score.photoUrl) || '.jpg';
                        // Sanitize filename: gameId_rank_username
                        const safeUsername = score.username.replace(/[^a-z0-9]/gi, '_');
                        const filename = `${liveGame.id}_${score.rank}_${safeUsername}${ext}`;
                        const localPath = path.join(photosDir, filename);

                        const response = await axios({
                            url: score.photoUrl,
                            method: 'GET',
                            responseType: 'stream'
                        });

                        await streamPipeline(response.data, createWriteStream(localPath));
                        
                        // Update the score object to point to the relative local path (for restore)
                        score.photoUrl = `photos/${filename}`; 
                    } catch (e) {
                        logError(`❌ Failed to download photo for ${score.username} in ${liveGame.name}:`, e);
                        score.photoUrl = null; 
                    }
                }
            }

            backupGames.push(backupGame);
        }

    } catch (e) {
        logError('❌ Backup failed during scraping:', e);
        throw e;
    } finally {
        if (browser) await browser.close();
    }

    // 4. Save Metadata
    const metadata: BackupMetadata = {
        timestamp,
        games: backupGames
    };

    await fs.writeFile(path.join(backupPath, 'backup_metadata.json'), JSON.stringify(metadata, null, 2));
    
    logInfo(`✅ Backup completed successfully: ${backupPath}`);
    return backupPath;
}

/**
 * Restores the system state from a backup.
 * 1. Restores DB and JSON files.
 * 2. Wipes ALL current iScored games.
 * 3. Recreates games from backup.
 * 4. Updates restored DB with new game IDs.
 * 5. Re-submits scores.
 */
export async function restoreBackup(backupFolderName: string): Promise<void> {
    const backupPath = path.join(BACKUP_DIR, backupFolderName);
    
    if (!await fs.stat(backupPath).catch(() => false)) {
        throw new Error(`Backup folder not found: ${backupPath}`);
    }

    logInfo(`♻️ Starting System Restore from: ${backupFolderName}`);
    
    const metadataPath = path.join(backupPath, 'backup_metadata.json');
    const metadata: BackupMetadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

    // 1. Restore Files (DB and JSON)
    const dataDir = path.join(process.cwd(), 'data');
    await fs.copyFile(path.join(backupPath, 'tableflipper.db'), path.join(dataDir, 'tableflipper.db'));
    logInfo('   -> Restored tableflipper.db');

    const rootFiles = ['history.json', 'pickerState.json', 'userMapping.json'];
    for (const file of rootFiles) {
        if (await fs.stat(path.join(backupPath, file)).catch(() => false)) {
            await fs.copyFile(path.join(backupPath, file), path.join(process.cwd(), file));
            logInfo(`   -> Restored ${file}`);
        }
    }

    // 2. Wipe & Rebuild iScored
    let browser = null;
    try {
        const { browser: b, page } = await loginToIScored();
        browser = b;

        // A. Delete ALL existing games on iScored to clear the board
        logInfo('   -> Wiping current iScored lineup...');
        const currentGames = await getAllGames(page);
        for (const game of currentGames) {
            logInfo(`      -> Deleting: ${game.name} (${game.id})`);
            await deleteGame(page, game.name, game.id);
        }
        logInfo('   -> Lineup cleared.');

        // B. Recreate Games from Backup
        // Open DB connection to update IDs
        const db = await open({
            filename: path.join(dataDir, 'tableflipper.db'),
            driver: sqlite3.Database
        });

        try {
            for (const game of metadata.games) {
                logInfo(`   -> Recreating game: ${game.name}`);

                // 1. Determine Style ID
                // Attempt to look it up in the restored DB tables catalog
                // Since we restored the DB, we can use `getTable` (if we opened separate conn or use helper)
                // But `getTable` uses `openDb` internally which creates a NEW connection.
                // We should be careful about concurrency if using WAL mode, but it's usually fine.
                // We'll use `getTable` helper.
                const tableData = await getTable(game.name.replace(/ (DG|WG-VPXS|WG-VR|MG)$/, '')); 
                const styleId = tableData?.style_id;

                // 2. Create the Game
                // `createGame` helper adds tags and handles DG buffer. 
                // But we want exact restoration of state.
                // If we use `createGame`, it might apply logic we don't want (like hiding DG).
                // We should pass a type if it has one, or empty string?
                // `createGame` requires a type for tagging.
                
                // If it was a tournament game, pass its type.
                // If it was a regular game, what "type" do we pass? `createGame` uses it for tagging.
                // If the backup game has tags, we should apply those specific tags.
                // `createGame` logic:
                //   - Takes `grindType`
                //   - Applies `TOURNAMENT_TAG_KEYS[grindType]`
                
                // We should probably just use `createGame` with a dummy type if it's not a known tournament, 
                // OR modify `createGame` to be more flexible.
                // Or just use `createGame` to make the shell, then manually adjust tags/status.
                
                // Better: Use `createGame` if it has a type. 
                // If not, use `createGame` with a generic type or empty, and assume `createGame` handles it?
                // `createGame` expects `grindType` to map to a tag.
                
                // Let's use `createGame` but we might need to fix tags after.
                
                // Strategy: 
                // Call createGame. If `game.type` exists, pass it. If not, pass 'Restore'.
                // Then immediately clear tags and apply `game.tags` from backup.
                // Then force status (Hidden/Locked).
                
                const restoreType = game.type || 'Restore';
                const { id: newIscoredId } = await createGame(page, game.name, restoreType, styleId);

                // 3. Fix Tags
                // Since `createGame` adds a tag based on type, we might want to clear it if it differs.
                // Tagify input clearing is hard.
                // Maybe just ADD the backed up tags?
                if (game.tags && game.tags.length > 0) {
                     for (const tag of game.tags) {
                         // Only add if not already added by createGame logic
                         // (createGame adds based on type. e.g. DG adds DG)
                         await addTagToGame(page, newIscoredId, tag);
                     }
                }
                
                // 4. Fix Status (Lock/Hide)
                // We construct a temporary Game object for the helpers
                const gameObj: Game = { id: newIscoredId, name: game.name, isHidden: false, isLocked: false }; // status doesn't matter for helper, only ID
                
                if (game.isHidden) {
                    await hideGame(page, gameObj);
                } else {
                    await showGame(page, gameObj);
                }
                
                if (game.isLocked) {
                    await lockGame(page, gameObj);
                } else {
                    await unlockGame(page, gameObj);
                }

                // 5. Update Local DB if it was a tracked game
                if (game.db_id) {
                    await db.run('UPDATE games SET iscored_game_id = ? WHERE id = ?', newIscoredId, game.db_id);
                    logInfo(`      -> Updated DB Link (Old: ${game.iscored_game_id} -> New: ${newIscoredId})`);
                }

                // 6. Restore Scores
                if (game.scores && game.scores.length > 0) {
                    logInfo(`      -> Restoring ${game.scores.length} scores...`);
                    for (const score of game.scores) {
                         // Resolve user mapping
                         // We read the restored userMapping.json
                         const mappingPath = path.join(process.cwd(), 'userMapping.json');
                         let userMap: Record<string, string> = {};
                         try {
                             userMap = JSON.parse(await fs.readFile(mappingPath, 'utf-8'));
                         } catch (e) {}

                         // Case-insensitive lookup
                         const lowerUsername = score.username.toLowerCase();
                         const discordId = Object.entries(userMap).find(([k, v]) => k.toLowerCase() === lowerUsername)?.[1] || 'UnknownRestoredUser';
                         
                         let photoUrl = '';
                         if (score.photoUrl) {
                             photoUrl = `file://${path.join(backupPath, score.photoUrl)}`;
                         }

                         try {
                            await submitScoreToIscored(score.username, discordId, parseInt(score.score.replace(/,/g, '')), photoUrl, newIscoredId, game.name);
                         } catch (e) {
                             logError(`      ❌ Failed to submit score for ${score.username}: ${e}`);
                         }
                    }
                }
            }
        } finally {
            await db.close();
        }

    } catch (e) {
        logError('❌ Restore failed:', e);
        throw e;
    } finally {
        if (browser) await browser.close();
    }

    // 3. Final Sync to ensure alignment and trigger repositioning
    await runStateSync();

    logInfo('✅ System Restore Completed.');
}
