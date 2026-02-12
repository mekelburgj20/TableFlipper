import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'tableflipper.db');

async function migrate() {
    console.log('🚀 Starting schema fix migration...');
    const db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });

    try {
        // Check if completed_at exists
        try {
            await db.exec(`ALTER TABLE games ADD COLUMN completed_at DATETIME`);
            console.log(`✅ Added column 'completed_at' to games table.`);
        } catch (error: any) {
            if (error.message.includes('duplicate column name')) {
                console.log(`ℹ️ Column 'completed_at' already exists.`);
            } else {
                console.error(`❌ Error adding column 'completed_at':`, error);
            }
        }
        
        console.log('✅ Fix migration completed successfully.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await db.close();
    }
}

migrate();
