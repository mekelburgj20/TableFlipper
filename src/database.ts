import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import * as path from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logWarn } from './logger.js';

// Define the path for the database file
const DB_DIR = path.join(process.cwd(), 'data');
let DB_FILENAME = process.env.DB_FILENAME || 'tableflipper.db';
let DB_PATH = path.join(DB_DIR, DB_FILENAME);

export function setDbFilename(filename: string) {
    DB_FILENAME = filename;
    DB_PATH = path.join(DB_DIR, DB_FILENAME);
    console.log(`🔌 Database switched to: ${DB_PATH}`);
}

export interface GameRow {
    id: string;
    iscored_game_id: string;
    name: string;
    type: string;
    status: 'QUEUED' | 'ACTIVE' | 'COMPLETED' | 'HIDDEN';
    picker_discord_id?: string | null;
    nominated_by_discord_id?: string | null;
    picker_type?: 'WINNER' | 'RUNNER_UP' | null;
    won_game_id?: string | null;
    reminder_count?: number;
    last_reminded_at?: string | null;
    picker_designated_at?: string | null;
    scheduled_to_be_active_at?: string | null;
    created_at: string;
    completed_at?: string | null;
}

/**
 * Opens a connection to the SQLite database.
 * @returns A promise that resolves to the database instance.
 */
async function openDb(): Promise<Database> {
    await fs.mkdir(DB_DIR, { recursive: true });
    return open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });
}

/**
 * Initializes the database by creating tables if they don't exist.
 */
export async function initializeDatabase() {
    console.log('🚀 Initializing database...');
    const db = await openDb();
    try {
        await db.exec(`PRAGMA journal_mode = WAL;`);
        await db.exec(`
            CREATE TABLE IF NOT EXISTS games (
                id TEXT PRIMARY KEY,
                iscored_game_id TEXT,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('QUEUED', 'ACTIVE', 'COMPLETED', 'HIDDEN')),
                picker_discord_id TEXT,
                nominated_by_discord_id TEXT,
                picker_type TEXT CHECK(picker_type IN ('WINNER', 'RUNNER_UP')),
                won_game_id TEXT,
                reminder_count INTEGER DEFAULT 0,
                last_reminded_at DATETIME,
                picker_designated_at DATETIME,
                scheduled_to_be_active_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME
            );
        `);
        await db.exec(`
            CREATE TABLE IF NOT EXISTS user_mappings (
                iscored_username TEXT PRIMARY KEY,
                discord_user_id TEXT NOT NULL
            );
        `);
        await db.exec(`
            CREATE TABLE IF NOT EXISTS pre_picks (
                discord_user_id TEXT NOT NULL,
                grind_type TEXT NOT NULL,
                table_name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (discord_user_id, grind_type)
            );
        `);
        await db.exec(`
            CREATE TABLE IF NOT EXISTS winners (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_iscored_id TEXT,
                discord_user_id TEXT,
                iscored_username TEXT NOT NULL,
                score TEXT NOT NULL,
                game_name TEXT NOT NULL,
                game_type TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await db.exec(`
            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id TEXT NOT NULL,
                iscored_username TEXT NOT NULL,
                score TEXT NOT NULL,
                rank TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(game_id) REFERENCES games(id)
            );
        `);
        
        // Re-create tables table with new schema
        // await db.exec(`DROP TABLE IF EXISTS tables;`); // Removed to persist data
        await db.exec(`
            CREATE TABLE IF NOT EXISTS tables (
                name TEXT PRIMARY KEY,
                aliases TEXT,
                is_atgames INTEGER DEFAULT 0,
                is_wg_vr INTEGER DEFAULT 0,
                is_wg_vpxs INTEGER DEFAULT 0,
                style_id TEXT,
                css_title TEXT,
                css_initials TEXT,
                css_scores TEXT,
                css_box TEXT,
                bg_color TEXT,
                score_type TEXT,
                sort_ascending INTEGER DEFAULT 0
            );
        `);
        console.log('✅ Database tables initialized successfully.');
    } catch (error) {
        console.error('❌ Error initializing database tables:', error);
        throw error;
    } finally {
        await db.close();
    }
}

// --- Table Functions ---

export interface TableRow {
    name: string;
    aliases?: string | null;
    is_atgames: number; // 0 or 1
    is_wg_vr: number; // 0 or 1
    is_wg_vpxs: number; // 0 or 1
    style_id?: string | null;
    css_title?: string | null;
    css_initials?: string | null;
    css_scores?: string | null;
    css_box?: string | null;
    bg_color?: string | null;
    score_type?: string | null;
    sort_ascending?: number; // 0 or 1
}

export async function upsertTable(table: TableRow): Promise<void> {
    const db = await openDb();
    try {
        await db.run(
            `INSERT INTO tables (name, aliases, is_atgames, is_wg_vr, is_wg_vpxs, style_id, css_title, css_initials, css_scores, css_box, bg_color, score_type, sort_ascending)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(name) DO UPDATE SET
                is_atgames = excluded.is_atgames,
                is_wg_vr = excluded.is_wg_vr,
                is_wg_vpxs = MAX(tables.is_wg_vpxs, excluded.is_wg_vpxs),
                aliases = COALESCE(excluded.aliases, tables.aliases),
                style_id = COALESCE(excluded.style_id, tables.style_id),
                css_title = COALESCE(excluded.css_title, tables.css_title),
                css_initials = COALESCE(excluded.css_initials, tables.css_initials),
                css_scores = COALESCE(excluded.css_scores, tables.css_scores),
                css_box = COALESCE(excluded.css_box, tables.css_box),
                bg_color = COALESCE(excluded.bg_color, tables.bg_color),
                score_type = COALESCE(excluded.score_type, tables.score_type),
                sort_ascending = COALESCE(excluded.sort_ascending, tables.sort_ascending)`,
            table.name, table.aliases, table.is_atgames, table.is_wg_vr, table.is_wg_vpxs, 
            table.style_id, table.css_title, table.css_initials, table.css_scores, table.css_box, 
            table.bg_color, table.score_type, table.sort_ascending
        );
    } finally {
        await db.close();
    }
}

export async function upsertVpxsTable(name: string): Promise<void> {
    const db = await openDb();
    try {
        await db.run(
            `INSERT INTO tables (name, is_wg_vpxs)
             VALUES (?, 1)
             ON CONFLICT(name) DO UPDATE SET
                is_wg_vpxs = 1`,
            name
        );
    } finally {
        await db.close();
    }
}

export async function getTable(name: string): Promise<TableRow | null> {
    const db = await openDb();
    try {
        return await db.get<TableRow>("SELECT * FROM tables WHERE name = ?", name) ?? null;
    } finally {
        await db.close();
    }
}

export async function searchTables(query: string, limit: number = 25, filterPlatform: 'atgames' | 'vr' | 'vpxs' | null = null): Promise<TableRow[]> {
    const db = await openDb();
    try {
        let sql = "SELECT * FROM tables WHERE name LIKE ?";
        const params: any[] = [`%${query}%`];

        if (filterPlatform === 'atgames') {
            sql += " AND is_atgames = 1";
        } else if (filterPlatform === 'vr') {
            sql += " AND is_wg_vr = 1";
        } else if (filterPlatform === 'vpxs') {
            sql += " AND is_wg_vpxs = 1";
        }

        sql += " ORDER BY name ASC LIMIT ?";
        params.push(limit);

        return await db.all<TableRow[]>(sql, ...params);
    } finally {
        await db.close();
    }
}

export async function getRecentGameNames(gameType: string, daysLookback: number): Promise<string[]> {
    const db = await openDb();
    try {
        const rows = await db.all<{ name: string }[]>(
            `SELECT name FROM games WHERE type = ? AND created_at >= date('now', '-' || ? || ' days')`,
            gameType, daysLookback
        );
        // Note: game names in 'games' table might be formatted like "Table Name DG". 
        // We might need to handle stripping the suffix if the 'tables' table has clean names.
        // However, the 'tables' table has clean names. The 'games' table has "Table Name DG".
        // The comparison needs to handle this.
        // Wait, 'games.name' usually includes " DG" or " WG-VR".
        // We should strip the suffix to get the raw table name for exclusion.
        
        return rows.map(r => {
            // Attempt to strip known suffixes based on gameType or common patterns
            // Or just return as is if the logic handles partial matches?
            // "Table Name DG" -> "Table Name"
            // "Table Name WG-VPXS" -> "Table Name"
            
            let name = r.name;
            const suffixes = [` ${gameType}`, ' DG', ' WG-VR', ' WG-VPXS', ' MG'];
            for (const suffix of suffixes) {
                if (name.endsWith(suffix)) {
                    name = name.slice(0, -suffix.length);
                    break; 
                }
            }
            return name;
        });
    } finally {
        await db.close();
    }
}

export async function getRandomCompatibleTable(filterPlatform: 'atgames' | 'vr' | 'vpxs', excludeNames: string[]): Promise<TableRow | null> {
    const db = await openDb();
    try {
        let sql = "SELECT * FROM tables WHERE 1=1";
        
        if (filterPlatform === 'atgames') {
            sql += " AND is_atgames = 1";
        } else if (filterPlatform === 'vr') {
            sql += " AND is_wg_vr = 1";
        } else if (filterPlatform === 'vpxs') {
            sql += " AND is_wg_vpxs = 1";
        }

        if (excludeNames.length > 0) {
            const placeholders = excludeNames.map(() => '?').join(',');
            sql += ` AND name NOT IN (${placeholders})`;
        }

        sql += " ORDER BY RANDOM() LIMIT 1";

        return await db.get<TableRow>(sql, ...excludeNames) ?? null;
    } finally {
        await db.close();
    }
}

export async function injectSpecialGame(gameType: string, gameName: string, iscoredGameId: string): Promise<void> {
    const db = await openDb();
    try {
        // 1. Find the FIRST queued game for this type (the next slot to be played)
        const nextSlot = await db.get<GameRow>(
            "SELECT * FROM games WHERE type = ? AND status = 'QUEUED' ORDER BY scheduled_to_be_active_at ASC LIMIT 1",
            gameType
        );

        if (nextSlot) {
            // 2. OVERWRITE the existing slot. This prevents the queue from growing indefinitely
            // and keeps the tournament schedule on track. The picker for this slot effectively "forfeits".
            await db.run(
                `UPDATE games SET name = ?, iscored_game_id = ?, picker_discord_id = NULL, nominated_by_discord_id = NULL, picker_designated_at = NULL 
                 WHERE id = ?`,
                gameName, iscoredGameId, nextSlot.id
            );
            console.log(`✅ Injected special game '${gameName}' into existing slot '${nextSlot.name}'.`);
        } else {
            // 3. Fallback: If no queue exists, create a new entry for tomorrow
            const newGameId = uuidv4();
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            
            await db.run(
                `INSERT INTO games (id, iscored_game_id, name, type, status, scheduled_to_be_active_at, created_at)
                 VALUES (?, ?, ?, ?, 'QUEUED', ?, ?)`,
                newGameId, iscoredGameId, gameName, gameType, tomorrow.toISOString(), now.toISOString()
            );
            console.log(`✅ Injected special game '${gameName}' as a new entry (no existing queue found).`);
        }

    } finally {
        await db.close();
    }
}

export async function syncActiveGame(gameType: string, iscoredGameId: string | null, gameName: string | null): Promise<void> {
    const db = await openDb();
    try {
        if (iscoredGameId && gameName) {
            // Check if this game exists
            const existingGame = await db.get<GameRow>("SELECT * FROM games WHERE iscored_game_id = ?", iscoredGameId);

            if (existingGame) {
                if (existingGame.status !== 'ACTIVE') {
                    await db.run(
                        "UPDATE games SET status = 'ACTIVE', type = ?, name = ?, completed_at = NULL WHERE id = ?", 
                        gameType, gameName, existingGame.id
                    );
                    console.log(`🔄 Synced DB: Set existing game '${gameName}' from ${existingGame.status} to ACTIVE (Type: ${gameType}).`);
                } else {
                    // Update metadata even if status is the same
                    await db.run("UPDATE games SET type = ?, name = ? WHERE id = ?", gameType, gameName, existingGame.id);
                }
            } else {
                const newId = uuidv4();
                await db.run(
                    `INSERT INTO games (id, iscored_game_id, name, type, status, created_at)
                     VALUES (?, ?, ?, ?, 'ACTIVE', ?)`,
                    newId, iscoredGameId, gameName, gameType, new Date().toISOString()
                );
                console.log(`🔄 Synced DB: Created new ACTIVE entry for '${gameName}' (Type: ${gameType}).`);
            }
        } else {
            // No active game on iScored - mark ALL active games of this type as COMPLETED
            const result = await db.run(
                `UPDATE games SET status = 'COMPLETED', completed_at = ? WHERE type = ? AND status = 'ACTIVE'`,
                new Date().toISOString(), gameType
            );
            if (result.changes && result.changes > 0) {
                console.log(`🔄 Synced DB: No active games found on iScored for ${gameType}. Marked ${result.changes} active games as COMPLETED in DB.`);
            }
        }

    } finally {
        await db.close();
    }
}

export async function syncQueuedGame(gameType: string, iscoredGameId: string, gameName: string): Promise<void> {
    const db = await openDb();
    try {
        const existingGame = await db.get<GameRow>("SELECT * FROM games WHERE iscored_game_id = ?", iscoredGameId);

        if (existingGame) {
            if (existingGame.status !== 'QUEUED') {
                await db.run("UPDATE games SET status = 'QUEUED', completed_at = NULL WHERE id = ?", existingGame.id);
                console.log(`🔄 Synced DB: Set existing game '${gameName}' from ${existingGame.status} to QUEUED.`);
            }
        } else {
            const newId = uuidv4();
            await db.run(
                `INSERT INTO games (id, iscored_game_id, name, type, status, created_at, scheduled_to_be_active_at)
                 VALUES (?, ?, ?, ?, 'QUEUED', ?, ?)`,
                newId, iscoredGameId, gameName, gameType, new Date().toISOString(), new Date().toISOString()
            );
            console.log(`🔄 Synced DB: Created new QUEUED entry for '${gameName}' (Type: ${gameType}).`);
        }
    } finally {
        await db.close();
    }
}

export async function syncCompletedGame(gameType: string, iscoredGameId: string, gameName: string): Promise<void> {
    const db = await openDb();
    try {
        const existingGame = await db.get<GameRow>("SELECT * FROM games WHERE iscored_game_id = ?", iscoredGameId);

        if (existingGame) {
            if (existingGame.status !== 'COMPLETED') {
                await db.run("UPDATE games SET status = 'COMPLETED', completed_at = ? WHERE id = ?", new Date().toISOString(), existingGame.id);
                console.log(`🔄 Synced DB: Set existing game '${gameName}' from ${existingGame.status} to COMPLETED.`);
            }
        } else {
            const newId = uuidv4();
            await db.run(
                `INSERT INTO games (id, iscored_game_id, name, type, status, created_at, completed_at)
                 VALUES (?, ?, ?, ?, 'COMPLETED', ?, ?)`,
                newId, iscoredGameId, gameName, gameType, new Date().toISOString(), new Date().toISOString()
            );
            console.log(`🔄 Synced DB: Created new COMPLETED entry for '${gameName}' (Type: ${gameType}).`);
        }
    } finally {
        await db.close();
    }
}

// --- Game Table Functions ---

export async function createGameEntry(game: Omit<GameRow, 'id' | 'created_at' | 'status' | 'name' | 'iscored_game_id'> & { name?: string, iscored_game_id?: string }): Promise<GameRow> {
    const db = await openDb();
    try {
        const now = new Date();
        let scheduledTime: Date;

        if (game.scheduled_to_be_active_at) {
            scheduledTime = new Date(game.scheduled_to_be_active_at);
        } else if (game.type === 'DG') {
            // DG has a 1-day buffer (it's picked 2 days in advance, so it sits in QUEUED for a day)
            // We set the start time to exactly 12:00 AM Central, 2 days from now.
            const now = new Date();
            
            // 1. Get the current date in Chicago
            const chicagoStr = now.toLocaleString('en-US', { timeZone: 'America/Chicago', hour12: false });
            const [datePart] = chicagoStr.split(', ');
            const [m, d, y] = datePart.split('/').map(Number);
            
            // 2. Create a date object for Midnight in the future (this starts in server-local time)
            const target = new Date(y, m - 1, d + 2, 0, 0, 0);
            
            // 3. Adjust for the difference between server-local and Chicago time
            const actualChicago = target.toLocaleString('en-US', { timeZone: 'America/Chicago', hour12: false });
            const [actualDate, actualTime] = actualChicago.split(', ');
            const [h] = actualTime.split(':').map(Number);
            
            // If 'h' is 2, it means our server-local midnight is 2:00 AM Central. 
            // We subtract those 2 hours to snap to exactly 12:00 AM Central.
            target.setHours(target.getHours() - h);
            scheduledTime = target;
        } else {
            // Weekly and Monthly grinds are active immediately upon being picked
            scheduledTime = new Date();
        }

        const newGame: GameRow = {
            id: uuidv4(),
            iscored_game_id: game.iscored_game_id || 'TBD',
            name: game.name || `TBD ${game.type} ${scheduledTime.toLocaleDateString()}`,
            type: game.type,
            status: 'QUEUED',
            scheduled_to_be_active_at: game.scheduled_to_be_active_at || scheduledTime.toISOString(),
            created_at: now.toISOString(),
        };

        await db.run(
            `INSERT INTO games (id, iscored_game_id, name, type, status, scheduled_to_be_active_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            newGame.id, newGame.iscored_game_id, newGame.name, newGame.type, newGame.status, newGame.scheduled_to_be_active_at
        );
        console.log(`✅ Created shell game entry for next ${newGame.type}. Scheduled for: ${newGame.scheduled_to_be_active_at}`);
        return newGame;
    } finally {
        await db.close();
    }
}

export async function getActiveGames(gameType: string): Promise<GameRow[]> {
    const db = await openDb();
    try {
        return await db.all<GameRow[]>("SELECT * FROM games WHERE type = ? AND status = 'ACTIVE'", gameType);
    } finally {
        await db.close();
    }
}

export async function getActiveGame(gameType: string): Promise<GameRow | null> {
    const games = await getActiveGames(gameType);
    return games.length > 0 ? games[0] : null;
}

export async function getAllActiveGames(): Promise<GameRow[]> {
    const db = await openDb();
    try {
        return await db.all<GameRow[]>("SELECT * FROM games WHERE status = 'ACTIVE' ORDER BY type ASC");
    } finally {
        await db.close();
    }
}

export async function getGameById(id: string): Promise<GameRow | null> {
    const db = await openDb();
    try {
        return await db.get<GameRow>("SELECT * FROM games WHERE id = ?", id) ?? null;
    } finally {
        await db.close();
    }
}

export async function incrementReminderCount(gameId: string): Promise<void> {
    const db = await openDb();
    try {
        await db.run(
            "UPDATE games SET reminder_count = reminder_count + 1, last_reminded_at = ? WHERE id = ?", 
            new Date().toISOString(), gameId
        );
    } finally {
        await db.close();
    }
}

export async function dbUpdatePicker(gameId: string, discordId: string, type: 'WINNER' | 'RUNNER_UP'): Promise<void> {
    const db = await openDb();
    try {
        await db.run(
            "UPDATE games SET picker_discord_id = ?, picker_type = ?, picker_designated_at = ?, reminder_count = 0 WHERE id = ?",
            discordId, type, new Date().toISOString(), gameId
        );
    } finally {
        await db.close();
    }
}

export async function getNextQueuedGames(gameType: string, limit: number = 1): Promise<GameRow[]> {
    const db = await openDb();
    try {
        return await db.all<GameRow[]>("SELECT * FROM games WHERE type = ? AND status = 'QUEUED' ORDER BY scheduled_to_be_active_at ASC LIMIT ?", gameType, limit);
    } finally {
        await db.close();
    }
}

export async function getNextQueuedGame(gameType: string): Promise<GameRow | null> {
    const games = await getNextQueuedGames(gameType, 1);
    return games.length > 0 ? games[0] : null;
}

export async function updateGameStatus(id: string, status: GameRow['status']): Promise<void> {
    const db = await openDb();
    try {
        let completed_at_sql = "";
        if (status === 'COMPLETED') {
            completed_at_sql = `, completed_at = '${new Date().toISOString()}'`;
        }
        await db.run(`UPDATE games SET status = ? ${completed_at_sql} WHERE id = ?`, status, id);
    } finally {
        await db.close();
    }
}

export async function updateQueuedGame(gameId: string, newName: string, iscoredGameId: string, newStatus?: GameRow['status']): Promise<void> {
    const db = await openDb();
    try {
        const statusSql = newStatus ? `, status = '${newStatus}'` : '';
        await db.run(
            `UPDATE games SET name = ?, iscored_game_id = ?, picker_discord_id = NULL, nominated_by_discord_id = NULL ${statusSql} WHERE id = ?`,
            newName, iscoredGameId, gameId
        );
        logInfo(`✅ Updated queued game ${gameId} with new name: ${newName}${newStatus ? ` and status: ${newStatus}` : ''}`);
    } finally {
        await db.close();
    }
}

// --- User Mapping Functions ---

export interface UserMappingRow {
    iscored_username: string;
    discord_user_id: string;
}

export async function dbAddUserMapping(iscoredUsername: string, discordUserId: string): Promise<void> {
    const db = await openDb();
    try {
        await db.run(
            `INSERT INTO user_mappings (iscored_username, discord_user_id) 
             VALUES (?, ?) 
             ON CONFLICT(iscored_username) DO UPDATE SET discord_user_id = excluded.discord_user_id`,
            iscoredUsername, discordUserId
        );
    } finally {
        await db.close();
    }
}

export async function dbGetDiscordIdByIscoredName(iscoredUsername: string): Promise<string | null> {
    const db = await openDb();
    try {
        const row = await db.get<UserMappingRow>(
            "SELECT discord_user_id FROM user_mappings WHERE LOWER(iscored_username) = LOWER(?)",
            iscoredUsername
        );
        return row?.discord_user_id ?? null;
    } finally {
        await db.close();
    }
}

export async function filterUnmappedUsers(usernames: string[]): Promise<string[]> {
    const db = await openDb();
    try {
        if (usernames.length === 0) return [];
        
        const placeholders = usernames.map(() => 'LOWER(?)').join(',');
        const rows = await db.all<{ iscored_username: string }[]>(
            `SELECT iscored_username FROM user_mappings WHERE LOWER(iscored_username) IN (${placeholders})`,
            ...usernames
        );
        
        const mappedNames = new Set(rows.map(r => r.iscored_username.toLowerCase()));
        return usernames.filter(u => !mappedNames.has(u.toLowerCase()));
    } finally {
        await db.close();
    }
}

export async function dbGetIscoredNameByDiscordId(discordUserId: string): Promise<string | null> {
    const db = await openDb();
    try {
        const row = await db.get<UserMappingRow>(
            "SELECT iscored_username FROM user_mappings WHERE discord_user_id = ? LIMIT 1",
            discordUserId
        );
        return row?.iscored_username ?? null;
    } finally {
        await db.close();
    }
}

// --- Pre-pick Functions ---

export interface PrePickRow {
    discord_user_id: string;
    grind_type: string;
    table_name: string;
    created_at: string;
}

export async function setPrePick(discordUserId: string, grindType: string, tableName: string): Promise<void> {
    const db = await openDb();
    try {
        await db.run(
            `INSERT INTO pre_picks (discord_user_id, grind_type, table_name) 
             VALUES (?, ?, ?) 
             ON CONFLICT(discord_user_id, grind_type) DO UPDATE SET table_name = excluded.table_name, created_at = CURRENT_TIMESTAMP`,
            discordUserId, grindType, tableName
        );
    } finally {
        await db.close();
    }
}

export async function getPrePick(discordUserId: string, grindType: string): Promise<PrePickRow | null> {
    const db = await openDb();
    try {
        return await db.get<PrePickRow>(
            "SELECT * FROM pre_picks WHERE discord_user_id = ? AND grind_type = ?",
            discordUserId, grindType
        ) ?? null;
    } finally {
        await db.close();
    }
}

export async function clearPrePick(discordUserId: string, grindType: string): Promise<void> {
    const db = await openDb();
    try {
        await db.run("DELETE FROM pre_picks WHERE discord_user_id = ? AND grind_type = ?", discordUserId, grindType);
    } finally {
        await db.close();
    }
}

// --- Eligibility Logic ---

/**
 * Checks if a table has been played in the last 120 days for a specific grind type.
 * A table is considered "played" if it exists in the 'games' table with ACTIVE or COMPLETED status
 * and was created within the last 120 days.
 */
export async function checkTableEligibility(tableName: string, grindType: string): Promise<boolean> {
    const db = await openDb();
    try {
        const lookbackDays = 120;
        const lookbackDate = new Date();
        lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);
        const lookbackString = lookbackDate.toISOString().replace('T', ' ').split('.')[0];
        
        const row = await db.get<{ count: number }>(
            `SELECT COUNT(*) as count FROM games 
             WHERE type = ? 
             AND (name = ? OR name LIKE ? || ' %') 
             AND status IN ('ACTIVE', 'COMPLETED') 
             AND created_at >= ?`,
            grindType, tableName, tableName, lookbackString
        );
        
        return (row?.count ?? 0) === 0;
    } finally {
        await db.close();
    }
}

/**
 * Enhanced version of getRandomCompatibleTable that respects the 120-day Eligibility rule.
 */
export async function getRandomCompatibleTableEligible(filterPlatform: 'atgames' | 'vr' | 'vpxs', grindType: string): Promise<TableRow | null> {
    const db = await openDb();
    try {
        const lookbackDays = 120;
        const lookbackDate = new Date();
        lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);
        const lookbackString = lookbackDate.toISOString().replace('T', ' ').split('.')[0];

        // Subquery to find names played in the last 120 days
        let sql = `
            SELECT * FROM tables 
            WHERE name NOT IN (
                SELECT DISTINCT 
                    CASE 
                        WHEN name LIKE '% DG' THEN SUBSTR(name, 1, LENGTH(name) - 3)
                        WHEN name LIKE '% WG-VPXS' THEN SUBSTR(name, 1, LENGTH(name) - 8)
                        WHEN name LIKE '% WG-VR' THEN SUBSTR(name, 1, LENGTH(name) - 6)
                        WHEN name LIKE '% MG' THEN SUBSTR(name, 1, LENGTH(name) - 3)
                        ELSE name 
                    END as clean_name
                FROM games 
                WHERE type = ? 
                AND status IN ('ACTIVE', 'COMPLETED') 
                AND created_at >= ?
            )
        `;

        if (filterPlatform === 'atgames') sql += " AND is_atgames = 1";
        else if (filterPlatform === 'vr') sql += " AND is_wg_vr = 1";
        else if (filterPlatform === 'vpxs') sql += " AND is_wg_vpxs = 1";

        sql += " ORDER BY RANDOM() LIMIT 1";

        return await db.get<TableRow>(sql, grindType, lookbackString) ?? null;
    } finally {
        await db.close();
    }
}

// --- Picker Logic Functions ---

export async function setPicker(gameType: string, pickerId: string | null, nominatorId?: string | null, wonGameId?: string | null, pickerType: 'WINNER' | 'RUNNER_UP' = 'WINNER'): Promise<void> {
    const db = await openDb();
    try {
        const nextQueuedGame = await db.get<GameRow>("SELECT * FROM games WHERE type = ? AND status = 'QUEUED' AND picker_discord_id IS NULL ORDER BY scheduled_to_be_active_at ASC LIMIT 1", gameType);
        if (nextQueuedGame) {
            await db.run(
                `UPDATE games SET 
                    picker_discord_id = ?, 
                    nominated_by_discord_id = ?, 
                    picker_type = ?,
                    won_game_id = ?,
                    picker_designated_at = ?,
                    reminder_count = 0,
                    last_reminded_at = NULL 
                 WHERE id = ?`,
                pickerId, nominatorId, pickerType, wonGameId, new Date().toISOString(), nextQueuedGame.id
            );
            logInfo(`👑 Picker for next ${gameType} game (${nextQueuedGame.name}) set to ${pickerId} (${pickerType}).`);
        } else {
            logWarn(`⚠️ Tried to set picker for ${gameType}, but no available game slot is queued.`);
        }
    } finally {
        await db.close();
    }
}

export async function getPicker(gameType: string): Promise<GameRow | null> {
    const db = await openDb();
    try {
        return await db.get<GameRow>(`SELECT * FROM games WHERE type = ? AND status = 'QUEUED' AND picker_discord_id IS NOT NULL ORDER BY scheduled_to_be_active_at ASC LIMIT 1`, gameType) ?? null;
    } finally {
        await db.close();
    }
}

export async function getGameByPicker(gameType: string, pickerId: string): Promise<GameRow | null> {
    const db = await openDb();
    try {
        return await db.get<GameRow>(`SELECT * FROM games WHERE type = ? AND status = 'QUEUED' AND picker_discord_id = ? ORDER BY scheduled_to_be_active_at ASC LIMIT 1`, gameType, pickerId) ?? null;
    } finally {
        await db.close();
    }
}

export interface ScoreRow {
    iscored_username: string;
    score: string;
    rank: string;
}

export async function saveScores(gameId: string, scores: ScoreRow[]): Promise<void> {
    const db = await openDb();
    try {
        const stmt = await db.prepare(`INSERT INTO scores (game_id, iscored_username, score, rank) VALUES (?, ?, ?, ?)`);
        for (const score of scores) {
            await stmt.run(gameId, score.iscored_username, score.score, score.rank);
        }
        await stmt.finalize();
        console.log(`✅ Saved ${scores.length} scores for game ID ${gameId}.`);
    } finally {
        await db.close();
    }
}

export async function hasScores(gameId: string): Promise<boolean> {
    const db = await openDb();
    try {
        const result = await db.get<{ count: number }>(`SELECT COUNT(*) as count FROM scores WHERE game_id = ?`, gameId);
        return (result?.count ?? 0) > 0;
    } finally {
        await db.close();
    }
}

export async function getLineupOrder(typeOrder: string[]): Promise<string[]> {
    const db = await openDb();
    try {
        const orderedIds: string[] = [];

        for (const type of typeOrder) {
            // Get Active games for this type
            const activeGames = await db.all<GameRow[]>(
                "SELECT iscored_game_id FROM games WHERE type = ? AND status = 'ACTIVE' ORDER BY scheduled_to_be_active_at ASC",
                type
            );
            for (const active of activeGames) {
                if (active.iscored_game_id && active.iscored_game_id !== 'TBD') {
                    orderedIds.push(active.iscored_game_id);
                }
            }

            // Get Completed games for this type, newest first (by scheduled time or created_at)
            const completed = await db.all<GameRow[]>(
                "SELECT iscored_game_id FROM games WHERE type = ? AND status = 'COMPLETED' ORDER BY scheduled_to_be_active_at DESC, created_at DESC",
                type
            );
            for (const c of completed) {
                if (c.iscored_game_id && c.iscored_game_id !== 'TBD' && !orderedIds.includes(c.iscored_game_id)) {
                    orderedIds.push(c.iscored_game_id);
                }
            }
        }

        return orderedIds;
    } finally {
        await db.close();
    }
}

export async function searchGamesByStatus(query: string, statuses: string[], limit: number = 25, gameType: string | null = null): Promise<GameRow[]> {
    const db = await openDb();
    try {
        const placeholders = statuses.map(() => '?').join(',');
        let sql = `SELECT * FROM games WHERE name LIKE ? AND status IN (${placeholders})`;
        const params: any[] = [`%${query}%`, ...statuses];

        if (gameType) {
            sql += ` AND type = ?`;
            params.push(gameType);
        }

        sql += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);
        return await db.all<GameRow[]>(sql, ...params);
    } finally {
        await db.close();
    }
}

export async function getGameByNameAndStatus(name: string, statuses: string[], gameType: string | null = null): Promise<GameRow | null> {
    const db = await openDb();
    try {
        const placeholders = statuses.map(() => '?').join(',');
        let sql = `SELECT * FROM games WHERE name = ? AND status IN (${placeholders})`;
        const params: any[] = [name, ...statuses];

        if (gameType) {
            sql += ` AND type = ?`;
            params.push(gameType);
        }

        sql += ` LIMIT 1`;
        return await db.get<GameRow>(sql, ...params) ?? null;
    } finally {
        await db.close();
    }
}

export async function getAllVisibleGames(): Promise<GameRow[]> {
    const db = await openDb();
    try {
        return await db.all<GameRow[]>("SELECT * FROM games WHERE status IN ('ACTIVE', 'QUEUED', 'COMPLETED')");
    } finally {
        await db.close();
    }
}

export async function getGameByIscoredId(iscoredId: string): Promise<GameRow | null> {
    const db = await openDb();
    try {
        return await db.get<GameRow>("SELECT * FROM games WHERE iscored_game_id = ?", iscoredId) ?? null;
    } finally {
        await db.close();
    }
}

/**
 * Reconciles the local database with the live state on iScored.
 * Any game in the DB that is marked as visible/active but missing from the provided IDs 
 * is updated to 'HIDDEN'.
 * @param foundIscoredIds Array of iScored IDs found during scraping.
 * @param gameType Optional tournament type to filter reconciliation.
 */
export async function reconcileGames(foundIscoredIds: string[], gameType: string | null = null): Promise<void> {
    const db = await openDb();
    try {
        let sql = `UPDATE games SET status = 'HIDDEN' 
                   WHERE status IN ('ACTIVE', 'COMPLETED', 'QUEUED') 
                   AND iscored_game_id != 'TBD'`;
        const params: any[] = [];

        if (gameType) {
            sql += ` AND type = ?`;
            params.push(gameType);
        }

        if (foundIscoredIds.length > 0) {
            const placeholders = foundIscoredIds.map(() => '?').join(',');
            sql += ` AND iscored_game_id NOT IN (${placeholders})`;
            params.push(...foundIscoredIds);
        }

        const result = await db.run(sql, ...params);
        if (result.changes && result.changes > 0) {
            console.log(`🧹 Reconciliation${gameType ? ' [' + gameType + ']' : ''}: Marked ${result.changes} missing games as HIDDEN.`);
        }
    } finally {
        await db.close();
    }
}
