import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';

async function migrate() {
    console.log('🚀 Starting Database Migration for tables schema...');
    const dbPath = path.join(process.cwd(), 'data', 'tableflipper.db');
    
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    try {
        const columns = [
            { name: 'style_id', type: 'TEXT' },
            { name: 'css_title', type: 'TEXT' },
            { name: 'css_initials', type: 'TEXT' },
            { name: 'css_scores', type: 'TEXT' },
            { name: 'css_box', type: 'TEXT' },
            { name: 'bg_color', type: 'TEXT' },
            { name: 'score_type', type: 'TEXT' },
            { name: 'sort_ascending', type: 'INTEGER DEFAULT 0' }
        ];

        // Get existing columns
        const tableInfo = await db.all("PRAGMA table_info(tables)");
        const existingNames = tableInfo.map(c => c.name);

        for (const col of columns) {
            if (!existingNames.includes(col.name)) {
                console.log(`   -> Adding column '${col.name}'...`);
                await db.exec(`ALTER TABLE tables ADD COLUMN ${col.name} ${col.type}`);
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
