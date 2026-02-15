import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';

async function check() {
    const db = await open({
        filename: path.join(process.cwd(), 'data', 'tableflipper.db'),
        driver: sqlite3.Database
    });

    const result = await db.get('SELECT COUNT(*) as count FROM tables WHERE is_wg_vpxs = 1');
    console.log(`Tables with is_wg_vpxs = 1: ${result?.count}`);

    const sample = await db.all('SELECT name FROM tables WHERE is_wg_vpxs = 1 LIMIT 10');
    console.log('Sample names:', sample.map(s => s.name));

    const search = await db.all("SELECT name FROM tables WHERE is_wg_vpxs = 1 AND name LIKE '%Game of Thrones%'");
    console.log('Search for Game of Thrones:', search.map(s => s.name));

    await db.close();
}

check();
