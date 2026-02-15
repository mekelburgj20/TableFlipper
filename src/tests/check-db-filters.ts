import { searchTables, initializeDatabase } from '../database.js';
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

    console.log('🔍 Checking DB content sample...');
    // Check a known VPXS table
    const vpxsSample = await db.get("SELECT * FROM tables WHERE is_wg_vpxs = 1 AND is_atgames = 0 LIMIT 1");
    console.log('VPXS Only Sample:', vpxsSample);

    // Check if any table has BOTH (might be valid, but worth checking count)
    const bothSample = await db.get("SELECT count(*) as count FROM tables WHERE is_wg_vpxs = 1 AND is_atgames = 1");
    console.log('Tables with BOTH flags:', bothSample);

    // Check for "contamination": VPXS tables that shouldn't be atgames
    // We can't know for sure semantically, but we can check if the count of is_atgames is suspiciously high
    // or if we find " (Williams 1991)" in is_atgames list.
    const suspectAtGames = await db.all("SELECT * FROM tables WHERE is_atgames = 1 AND name LIKE '%(%)%' LIMIT 5");
    console.log('Suspect AtGames (containing parens):', suspectAtGames);

    console.log('\n🔍 Testing searchTables filters...');

    console.log("--- Filter: 'atgames' ---");
    const atgamesResults = await searchTables('', 5, 'atgames');
    atgamesResults.forEach(r => console.log(`  ${r.name} [AG:${r.is_atgames}, VPXS:${r.is_wg_vpxs}]`));

    console.log("\n--- Filter: 'vpxs' ---");
    const vpxsResults = await searchTables('', 5, 'vpxs');
    vpxsResults.forEach(r => console.log(`  ${r.name} [AG:${r.is_atgames}, VPXS:${r.is_wg_vpxs}]`));

    console.log("\n--- Filter: 'vr' ---");
    const vrResults = await searchTables('', 5, 'vr');
    vrResults.forEach(r => console.log(`  ${r.name} [AG:${r.is_atgames}, VPXS:${r.is_wg_vpxs}]`));

    await db.close();
}

main().catch(console.error);
