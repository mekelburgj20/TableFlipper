import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';

async function migrate() {
    const dbPath = path.join(process.cwd(), 'data', 'tableflipper.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    console.log('Checking for style_id column in tables table...');
    const tableInfo = await db.all("PRAGMA table_info(tables)");
    const hasStyleId = tableInfo.some(column => column.name === 'style_id');

    if (!hasStyleId) {
        console.log('Adding style_id column to tables table...');
        await db.exec("ALTER TABLE tables ADD COLUMN style_id TEXT");
        console.log('✅ Column added successfully.');
    } else {
        console.log('✅ style_id column already exists.');
    }

    await db.close();
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
