import { initializeDatabase } from '../database.js';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';

// Replicate openDb logic
const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'tableflipper.db');

async function openTestDb() {
    return open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });
}

async function main() {
    await initializeDatabase();
    const db = await openTestDb();

    console.log('🔍 Checking for VPXS contamination in AtGames list...');

    // 1. Count Total AtGames
    const atgamesCount = await db.get("SELECT count(*) as count FROM tables WHERE is_atgames = 1");
    console.log(`Total is_atgames=1: ${atgamesCount.count}`);

    // 2. Count Total VPXS
    const vpxsCount = await db.get("SELECT count(*) as count FROM tables WHERE is_wg_vpxs = 1");
    console.log(`Total is_wg_vpxs=1: ${vpxsCount.count}`);

    // 3. Count Overlap
    const bothCount = await db.get("SELECT count(*) as count FROM tables WHERE is_wg_vpxs = 1 AND is_atgames = 1");
    console.log(`Overlap (Both=1): ${bothCount.count}`);

    // 4. Sample Overlap
    const samples = await db.all("SELECT * FROM tables WHERE is_wg_vpxs = 1 AND is_atgames = 1 LIMIT 10");
    console.log('\nSample Overlap Tables:', samples);

    // 5. Check for a known pure VPXS table (e.g. from recent logs or hypothesis)
    // If "Fish Tales (Williams 1991)" exists and is_atgames=1, that's bad.
    const suspect = await db.get("SELECT * FROM tables WHERE name LIKE '%(Williams%)%' AND is_atgames = 1 LIMIT 1");
    if (suspect) {
        console.error('❌ FOUND SUSPECT TABLE:', suspect);
    } else {
        console.log('✅ No obvious suspect tables (Williams/etc) found in is_atgames=1 list.');
    }

    await db.close();
}

main().catch(console.error);