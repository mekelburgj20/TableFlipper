import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';
import { promises as fs } from 'fs';
import { getDiscordIdByIscoredName } from './userMapping.js';
import { loadUserMapping } from './userMapping.js';
import { initializeDatabase } from './database.js'; // Import initializeDatabase

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'tableflipper.db');
const HISTORY_PATH = path.join(process.cwd(), 'history.json');

async function openDb() {
    await fs.mkdir(DB_DIR, { recursive: true });
    return open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });
}

async function migrateHistory() {
    console.log('🚀 Starting history.json migration to SQLite...');

    // Ensure the database and its tables are created
    await initializeDatabase();

    // Load user mappings to find discord IDs
    await loadUserMapping();

    const db = await openDb();

    try {
        // 1. Read history.json
        const historyDataRaw = await fs.readFile(HISTORY_PATH, 'utf-8');
        const historyData = JSON.parse(historyDataRaw);

        // 2. Check if there's data to migrate
        const { count } = await db.get('SELECT COUNT(*) as count FROM winners');
        if (count > 0) {
            console.log('⚠️ Winners table already contains data. Migration skipped to prevent duplicates.');
            return;
        }

        console.log('Migrating winner data...');
        let migratedCount = 0;

        // 3. Iterate and insert
        for (const gameType in historyData) {
            if (Object.prototype.hasOwnProperty.call(historyData, gameType)) {
                const results = historyData[gameType];
                if (Array.isArray(results)) { // Add this check
                    for (const result of results) {
                        const discordId = getDiscordIdByIscoredName(result.winner);
                        await db.run(
                            `INSERT INTO winners (game_iscored_id, discord_user_id, iscored_username, score, game_name, game_type, created_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            'N/A', // We don't have the game ID in history.json, placeholder
                            discordId ?? null,
                            result.winner,
                            result.score,
                            result.gameName,
                            gameType,
                            result.date
                        );
                        migratedCount++;
                    }
                }
            }
        }

        console.log(`✅ Successfully migrated ${migratedCount} winner records from history.json.`);

    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.log('📄 history.json not found, skipping migration.');
        } else {
            console.error('❌ An error occurred during migration:', error);
        }
    } finally {
        await db.close();
        console.log('🚪 Database connection closed.');
    }
}

migrateHistory();
