// src/userMapping.ts
import { dbAddUserMapping, dbGetDiscordIdByIscoredName, dbGetIscoredNameByDiscordId } from './database.js';
import { logInfo, logError } from './logger.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Compatibility shim: database is initialized in index.ts.
 * We use this to trigger a one-time migration if the legacy file exists.
 */
export async function loadUserMapping(): Promise<void> {
    const legacyPath = path.join(process.cwd(), 'userMapping.json');
    try {
        const stats = await fs.stat(legacyPath);
        if (stats.isFile()) {
            logInfo('📂 Legacy userMapping.json found. You should run the migration script: npm run migrate-user-mapping');
            // We don't auto-migrate here to keep this module simple and avoid circular deps 
            // if initializeDatabase wasn't ready.
        }
    } catch (e) {
        // File doesn't exist, good.
    }
}

/**
 * Compatibility shim: database writes are immediate.
 */
export async function saveUserMapping(): Promise<void> {
    // No-op for database
}

export function getDiscordIdByIscoredName(iScoredName: string): string | undefined {
    // Note: This is now async in DB but this export is sync.
    // This is a problem for existing sync calls.
    // I will need to update callers to use await or use a cache.
    // For now, I'll provide a warning and return undefined to force a fix in callers.
    logError(`❌ Synchronous call to getDiscordIdByIscoredName('${iScoredName}') is no longer supported. Use dbGetDiscordIdByIscoredName instead.`);
    return undefined;
}

export function getIscoredNameByDiscordId(discordId: string): string | undefined {
    logError(`❌ Synchronous call to getIscoredNameByDiscordId('${discordId}') is no longer supported. Use dbGetIscoredNameByDiscordId instead.`);
    return undefined;
}

export async function addUserMapping(iScoredName: string, discordId: string): Promise<void> {
    await dbAddUserMapping(iScoredName, discordId);
}

// Re-export async versions
export { dbGetDiscordIdByIscoredName as getDiscordIdByIscoredNameAsync, dbGetIscoredNameByDiscordId as getIscoredNameByDiscordIdAsync };
