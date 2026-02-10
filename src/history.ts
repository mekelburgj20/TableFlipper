import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';
import { promises as fs } from 'fs';

// Define the path for the database file
const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'tableflipper.db');

/**
 * Opens a connection to the SQLite database.
 * @returns A promise that resolves to the database instance.
 */
async function openDb() {
    // This function assumes the directory and db file are created by initializeDatabase
    return open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });
}

export interface GameResult {
    id: number;
    game_iscored_id: string;
    discord_user_id: string | null;
    iscored_username: string;
    score: string;
    game_name: string;
    game_type: string;
    created_at: string;
}

/**
 * Gets the historical results for a given game type.
 * @param gameType The game type (e.g., 'DG') to get history for.
 * @returns A promise that resolves to an array of game results.
 */
export async function getHistory(gameType: string): Promise<GameResult[]> {
    const db = await openDb();
    try {
        const results = await db.all<GameResult[]>(
            'SELECT * FROM winners WHERE game_type = ? ORDER BY created_at ASC',
            gameType.toUpperCase()
        );
        return results;
    } finally {
        await db.close();
    }
}

/**
 * Gets statistics for a given table name.
 * @param tableName The name of the table to search for.
 * @returns A promise that resolves to an object with stats.
 */
export async function getTableStats(tableName: string): Promise<{ playCount: number; highScore: number; highScoreWinner: string; }> {
    const db = await openDb();
    try {
        // Use LIKE to find games that contain the table name
        const results = await db.all<GameResult[]>(
            'SELECT iscored_username, score FROM winners WHERE game_name LIKE ?',
            `%${tableName}%`
        );
        
        const playCount = results.length;
        let highScore = 0;
        let highScoreWinner = 'N/A';

        for (const result of results) {
            const score = parseInt(result.score.replace(/,/g, ''), 10);
            if (score > highScore) {
                highScore = score;
                highScoreWinner = result.iscored_username;
            }
        }
        return { playCount, highScore, highScoreWinner };

    } finally {
        await db.close();
    }
}

/**
 * Gets the iScored username of the last winner for a specific game type.
 * @param gameType The game type (e.g., 'DG').
 * @returns A promise that resolves to the winner's username or null if none.
 */
export async function getLastWinner(gameType: string): Promise<string | null> {
    const db = await openDb();
    try {
        const result = await db.get(
            'SELECT iscored_username FROM winners WHERE game_type = ? ORDER BY created_at DESC LIMIT 1',
            gameType.toUpperCase()
        );
        return result?.iscored_username ?? null;
    } finally {
        await db.close();
    }
}

/**
 * Checks if the current winner is the same as the most recent winner for a game type.
 * @param gameType The game type (e.g., 'DG').
 * @param currentWinner The iScored username of the current winner.
 * @returns A promise that resolves to true if they are a repeat winner, false otherwise.
 */
export async function checkWinnerHistory(gameType: string, currentWinner: string): Promise<boolean> {
    console.log(`Checking winner history for ${gameType}...`);
    if (!currentWinner || currentWinner === 'N/A') {
        return false;
    }

    const lastWinner = await getLastWinner(gameType);
    console.log(`Last winner for ${gameType} was: ${lastWinner}. Current winner is: ${currentWinner}.`);

    if (lastWinner && lastWinner.toLowerCase() === currentWinner.toLowerCase()) {
        console.log('Dynasty rule applied: Repeat winner.');
        return true;
    }
    return false;
}

/**
 * Inserts a new winner record into the database.
 * @param gameType The game type (e.g., 'DG').
 * @param result An object containing the winner's details.
 */
export async function updateWinnerHistory(gameType: string, result: { gameName: string; winner: string; score: string; winnerId: string | null; }) {
    if (result.winner && result.winner !== 'N/A') {
        console.log(`Updating winner history in database for ${gameType.toUpperCase()} with new result.`);
        const db = await openDb();
        try {
            await db.run(
                `INSERT INTO winners (game_iscored_id, discord_user_id, iscored_username, score, game_name, game_type)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                'N/A', // We don't have this yet, will be added when games table is used
                result.winnerId,
                result.winner,
                result.score,
                result.gameName,
                gameType.toUpperCase()
            );
        } finally {
            await db.close();
        }
    }
}
