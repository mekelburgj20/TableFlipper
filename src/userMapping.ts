// src/userMapping.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_MAPPING_FILE = path.join(__dirname, '..', 'userMapping.json');

interface UserMapping {
    [iScoredUsername: string]: string; // Maps iScored Username to Discord User ID
}

let userMap: UserMapping = {};

export async function loadUserMapping(): Promise<void> {
    try {
        const data = await fs.readFile(USER_MAPPING_FILE, 'utf-8');
        userMap = JSON.parse(data);
        console.log('✅ User mapping loaded.');
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.log('User mapping file not found, creating a new one.');
            userMap = {};
            await saveUserMapping(); // Create empty file
        } else {
            console.error('❌ Failed to load user mapping:', error);
            userMap = {}; // Reset to empty on error
        }
    }
}

export async function saveUserMapping(): Promise<void> {
    try {
        await fs.writeFile(USER_MAPPING_FILE, JSON.stringify(userMap, null, 2), 'utf-8');
        console.log('✅ User mapping saved.');
    } catch (error) {
        console.error('❌ Failed to save user mapping:', error);
    }
}

export function getDiscordIdByIscoredName(iScoredName: string): string | undefined {
    return userMap[iScoredName];
}

export function getIscoredNameByDiscordId(discordId: string): string | undefined {
    // Find the first iScored username that maps to this Discord ID
    for (const iScoredName in userMap) {
        if (userMap[iScoredName] === discordId) {
            return iScoredName;
        }
    }
    return undefined;
}

export async function addUserMapping(iScoredName: string, discordId: string): Promise<void> {
    if (userMap[iScoredName] === discordId) {
        console.log(`Mapping for ${iScoredName} -> ${discordId} already exists.`);
        return;
    }
    userMap[iScoredName] = discordId;
    await saveUserMapping();
    console.log(`🔄 Added/Updated mapping: ${iScoredName} -> ${discordId}`);
}
