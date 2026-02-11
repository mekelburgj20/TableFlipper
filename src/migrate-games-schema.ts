import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'tableflipper.db');

async function migrate() {
    console.log('🚀 Starting games table schema migration...');
    const db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });

    try {
        const columnsToAdd = [
            { name: 'picker_discord_id', type: 'TEXT' },
            { name: 'nominated_by_discord_id', type: 'TEXT' },
            { name: 'picker_designated_at', type: 'DATETIME' },
            { name: 'scheduled_to_be_active_at', type: 'DATETIME' }
        ];

        for (const col of columnsToAdd) {
            try {
                await db.exec(`ALTER TABLE games ADD COLUMN ${col.name} ${col.type}`);
                console.log(`✅ Added column '${col.name}' to games table.`);
            } catch (error: any) {
                if (error.message.includes('duplicate column name')) {
                    console.log(`ℹ️ Column '${col.name}' already exists.`);
                } else {
                    console.error(`❌ Error adding column '${col.name}':`, error);
                }
            }
        }
        
        console.log('✅ Migration completed successfully.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await db.close();
    }
}

migrate();
