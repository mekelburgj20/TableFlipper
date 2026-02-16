import { triggerLineupRepositioning } from '../maintenance.js';
import { initializeDatabase } from '../database.js';
import { config } from 'dotenv';
import { logInfo } from '../logger.js';

config();

async function testFullReposition() {
    logInfo('🧪 Starting Full Lineup Repositioning Test (DOM-based)...');
    await initializeDatabase();
    await triggerLineupRepositioning();
    logInfo('🏁 Test complete. Check iScored to verify order.');
}

testFullReposition();
