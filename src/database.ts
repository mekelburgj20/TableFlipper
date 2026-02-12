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
        
        // Re-create tables table with new schema
        // await db.exec(`DROP TABLE IF EXISTS tables;`); // Removed to persist data
        await db.exec(`
            CREATE TABLE IF NOT EXISTS tables (
                name TEXT PRIMARY KEY,
                aliases TEXT,
                is_atgames INTEGER DEFAULT 0,
                is_wg_vr INTEGER DEFAULT 0,
                is_wg_vpxs INTEGER DEFAULT 0
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
}

export async function upsertTable(table: TableRow): Promise<void> {
    const db = await openDb();
    try {
        await db.run(
            `INSERT INTO tables (name, aliases, is_atgames, is_wg_vr, is_wg_vpxs)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(name) DO UPDATE SET
                is_atgames = excluded.is_atgames,
                is_wg_vr = excluded.is_wg_vr,
                is_wg_vpxs = excluded.is_wg_vpxs,
                aliases = COALESCE(excluded.aliases, tables.aliases)`,
            table.name, table.aliases, table.is_atgames, table.is_wg_vr, table.is_wg_vpxs
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
