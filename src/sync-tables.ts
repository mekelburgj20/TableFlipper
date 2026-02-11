import { config } from 'dotenv';
import { syncTablesFromSheet } from './googleSheet.js';
import { initializeDatabase } from './database.js';

config();

async function main() {
    const gid = process.env.GOOGLE_SHEET_GID;
    if (!gid) {
        console.error('❌ GOOGLE_SHEET_GID is not set in .env');
        process.exit(1);
    }

    try {
        await initializeDatabase();
        await syncTablesFromSheet(gid);
        console.log('✅ Table sync completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Table sync failed:', error);
        process.exit(1);
    }
}

main();
