import fs from 'fs/promises';
import path from 'path';
import { dbAddUserMapping, initializeDatabase } from './database.js';

async function migrateUserMappings() {
    const mappingPath = path.join(process.cwd(), 'userMapping.json');
    
    try {
        await initializeDatabase();
        
        const data = await fs.readFile(mappingPath, 'utf-8');
        const userMap = JSON.parse(data);
        
        console.log(`🚀 Migrating ${Object.keys(userMap).length} user mappings to database...`);
        
        for (const [iscoredName, discordId] of Object.entries(userMap)) {
            await dbAddUserMapping(iscoredName, discordId as string);
        }
        
        console.log('✅ Migration complete.');
        
        // Rename the old file to .bak
        await fs.rename(mappingPath, mappingPath + '.bak');
        console.log(`📦 Original mapping file renamed to ${mappingPath}.bak`);
        
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.log('ℹ️ No userMapping.json found to migrate.');
        } else {
            console.error('❌ Migration failed:', error);
        }
    }
}

migrateUserMappings();
