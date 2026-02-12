import { getTablesFromSheet } from '../googleSheet.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function runTest() {
    console.log('🧪 Starting Google Sheet Sync Test...');
    
    const gid = process.env.GOOGLE_SHEET_GID;
    if (!gid) throw new Error('GOOGLE_SHEET_GID not set');

    try {
        console.log(`   Fetching from GID: ${gid}`);
        const tables = await getTablesFromSheet(gid);
        console.log(`✅ Successfully fetched ${tables.length} tables.`);
        if (tables.length > 0) {
            console.log(`   First table: ${tables[0]}`);
        }
    } catch (error) {
        console.error('❌ Sheet sync failed:', error);
        process.exit(1);
    }
}

runTest();
