import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import * as path from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';

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
                picker_designated_at DATETIME,
                scheduled_to_be_active_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME
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
        // 1. Deactivate any CURRENTLY active games for this type in DB
        // (We assume iScored is truth. If iScored says Game X is active, Game Y in DB should stop being active)
        await db.run(
            `UPDATE games SET status = 'COMPLETED', completed_at = ? WHERE type = ? AND status = 'ACTIVE'`,
            new Date().toISOString(), gameType
        );

        if (iscoredGameId && gameName) {
            // 2. Check if the iScored game exists in DB
            const existingGame = await db.get<GameRow>("SELECT * FROM games WHERE iscored_game_id = ?", iscoredGameId);

            if (existingGame) {
                // Update it to ACTIVE
                await db.run("UPDATE games SET status = 'ACTIVE', completed_at = NULL WHERE id = ?", existingGame.id);
                console.log(`🔄 Synced DB: Set existing game '${gameName}' to ACTIVE.`);
            } else {
                // Insert as new ACTIVE game
                const newId = uuidv4();
                await db.run(
                    `INSERT INTO games (id, iscored_game_id, name, type, status, created_at)
                     VALUES (?, ?, ?, ?, 'ACTIVE', ?)`,
                    newId, iscoredGameId, gameName, gameType, new Date().toISOString()
                );
                console.log(`🔄 Synced DB: Created new ACTIVE entry for '${gameName}'.`);
            }
        } else {
            console.log(`🔄 Synced DB: No active game found on iScored for ${gameType}. Cleared active state in DB.`);
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
                console.log(`🔄 Synced DB: Set existing game '${gameName}' to QUEUED.`);
            }
        } else {
            const newId = uuidv4();
            // We set scheduled_to_be_active_at to now for simplicity, or we could try to order them?
            // For now, simple import.
            await db.run(
                `INSERT INTO games (id, iscored_game_id, name, type, status, created_at, scheduled_to_be_active_at)
                 VALUES (?, ?, ?, ?, 'QUEUED', ?, ?)`,
                newId, iscoredGameId, gameName, gameType, new Date().toISOString(), new Date().toISOString()
            );
            console.log(`🔄 Synced DB: Created new QUEUED entry for '${gameName}'.`);
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
                console.log(`🔄 Synced DB: Set existing game '${gameName}' to COMPLETED.`);
            }
        } else {
            const newId = uuidv4();
            await db.run(
                `INSERT INTO games (id, iscored_game_id, name, type, status, created_at, completed_at)
                 VALUES (?, ?, ?, ?, 'COMPLETED', ?, ?)`,
                newId, iscoredGameId, gameName, gameType, new Date().toISOString(), new Date().toISOString()
            );
            console.log(`🔄 Synced DB: Created new COMPLETED entry for '${gameName}'.`);
        }
    } finally {
        await db.close();
    }
}

// --- Game Table Functions ---

export async function createGameEntry(game: Omit<GameRow, 'id' | 'created_at' | 'status' | 'name' | 'iscored_game_id'> & { name?: string, iscored_game_id?: string }): Promise<GameRow> {
    const db = await openDb();
    try {
        const nextGameDate = new Date();
        nextGameDate.setDate(nextGameDate.getDate() + 2);

        const newGame: GameRow = {
            id: uuidv4(),
            iscored_game_id: game.iscored_game_id || 'TBD',
            name: game.name || `TBD ${game.type} ${nextGameDate.toLocaleDateString()}`,
            type: game.type,
            status: 'QUEUED',
            scheduled_to_be_active_at: game.scheduled_to_be_active_at || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString(),
        };

        await db.run(
            `INSERT INTO games (id, iscored_game_id, name, type, status, scheduled_to_be_active_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            newGame.id, newGame.iscored_game_id, newGame.name, newGame.type, newGame.status, newGame.scheduled_to_be_active_at
        );
        console.log(`✅ Created shell game entry for next ${newGame.type}.`);
        return newGame;
    } finally {
        await db.close();
    }
}

export async function getActiveGame(gameType: string): Promise<GameRow | null> {
    const db = await openDb();
    try {
        return await db.get<GameRow>("SELECT * FROM games WHERE type = ? AND status = 'ACTIVE'", gameType) ?? null;
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

export async function getNextQueuedGame(gameType: string): Promise<GameRow | null> {
    const db = await openDb();
    try {
        return await db.get<GameRow>("SELECT * FROM games WHERE type = ? AND status = 'QUEUED' ORDER BY scheduled_to_be_active_at ASC LIMIT 1", gameType) ?? null;
    } finally {
        await db.close();
    }
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

export async function updateQueuedGame(gameId: string, newName: string, iscoredGameId: string): Promise<void> {
    const db = await openDb();
    try {
        await db.run(
            `UPDATE games SET name = ?, iscored_game_id = ?, picker_discord_id = NULL, nominated_by_discord_id = NULL WHERE id = ?`,
            newName, iscoredGameId, gameId
        );
        console.log(`✅ Updated queued game ${gameId} with new name: ${newName}`);
    } finally {
        await db.close();
    }
}

// --- Picker Logic Functions ---

export async function setPicker(gameType: string, pickerId: string | null, nominatorId?: string | null): Promise<void> {
    const db = await openDb();
    try {
        const nextQueuedGame = await db.get<GameRow>("SELECT * FROM games WHERE type = ? AND status = 'QUEUED' AND picker_discord_id IS NULL ORDER BY scheduled_to_be_active_at ASC LIMIT 1", gameType);
        if (nextQueuedGame) {
            await db.run(
                `UPDATE games SET picker_discord_id = ?, nominated_by_discord_id = ?, picker_designated_at = ? WHERE id = ?`,
                pickerId, nominatorId, new Date().toISOString(), nextQueuedGame.id
            );
            console.log(`👑 Picker for next ${gameType} game (${nextQueuedGame.name}) set to ${pickerId}.`);
        } else {
            console.warn(`⚠️ Tried to set picker for ${gameType}, but no available game slot is queued.`);
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
