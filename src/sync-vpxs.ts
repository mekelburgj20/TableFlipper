import axios from 'axios';
import { initializeDatabase, upsertVpxsTable } from './database.js';
import { config } from 'dotenv';

config();

const VPS_DB_URL = 'https://virtualpinballspreadsheet.github.io/vps-db/db/vpsdb.json';

interface VpsGame {
    id: string;
    name: string;
    manufacturer?: string;
    year?: number;
    // ... other fields
}

async function main() {
    console.log('🚀 Starting VPS Database Sync...');

    try {
        await initializeDatabase();
        
        console.log(`📥 Fetching data from ${VPS_DB_URL}...`);
        const response = await axios.get<VpsGame[]>(VPS_DB_URL);
        const games = response.data;

        if (!Array.isArray(games)) {
            throw new Error('Invalid data format received from VPS API.');
        }

        console.log(`✅ Fetched ${games.length} games. Updating database...`);

        let count = 0;
        for (const game of games) {
            if (game.name) {
                // Sanitize name if needed? 
                // VPS names can be "Fish Tales (Williams 1991)".
                // Our Google Sheet names might be "Fish Tales".
                // If we want them to match, we might need fuzzy matching or alias handling.
                // However, the requirement says "If the game is available in this database, it can be selected".
                // So adding the precise VPS name is correct.
                // It means "Fish Tales (Williams 1991)" will be a valid selection for WG-VPXS.
                
                await upsertVpxsTable(game.name);
                count++;
                if (count % 100 === 0) {
                    process.stdout.write(`\rProcessed ${count} tables...`);
                }
            }
        }
        console.log(); // Print newline

        console.log(`✅ Successfully synced ${count} tables from VPS Database.`);
        process.exit(0);

    } catch (error) {
        console.error('❌ VPS Sync failed:', error);
        process.exit(1);
    }
}

main();