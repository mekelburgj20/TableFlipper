import * as fs from 'fs'; // Use synchronous fs for debugging write issues
import { promises as fsPromises } from 'fs'; // For promise-based operations

import path from 'path';

// Use the temporary directory for state files to bypass potential permission/locking issues
const TEMP_DIR = 'C:\\Users\\mekel\\.gemini\\tmp\\73d07c8ace8fc2588f6b4b6b6188aa866a6357b1acbf7e6c12cd14a5197c149cb';
const PICKER_STATE_FILE = path.join(TEMP_DIR, 'pickerState.json');
const PICKER_STATE_FILE_DEBUG = path.join(TEMP_DIR, 'pickerState_debug.json'); // New debug file path
console.log('Picker state file path:', PICKER_STATE_FILE); // Added logging for file path

interface PickerInfo {
    pickerDiscordId: string | null;
    nominatedBy?: string | null;
    designatedAt: string | null;
    nextScheduledGameName?: string; // Add this line
}

interface PickerState {
    [gameType: string]: PickerInfo;
}

let pickerState: PickerState = {};

async function initializePickerState() {
    // This part can remain promise-based as it seems to work for read
    try {
        // Ensure the temporary directory exists
        await fsPromises.mkdir(TEMP_DIR, { recursive: true });
        await fsPromises.access(PICKER_STATE_FILE_DEBUG); // Use promises version for access
        console.log(`Info: ${PICKER_STATE_FILE_DEBUG} already exists.`);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.log(`Info: ${PICKER_STATE_FILE_DEBUG} does not exist. Creating empty file.`);
            await fsPromises.writeFile(PICKER_STATE_FILE_DEBUG, JSON.stringify({}, null, 2)); // Use promises version for write
            console.log(`Info: ${PICKER_STATE_FILE_DEBUG} created.`);
        } else {
            console.error(`❌ Error accessing ${PICKER_STATE_FILE_DEBUG}:`, error);
        }
    }
}

export async function loadPickerState(): Promise<void> {
    try {
        await initializePickerState(); // Ensure file structure exists or is created
        const data = await fsPromises.readFile(PICKER_STATE_FILE_DEBUG, 'utf-8'); // Use promises version for read
        console.log('Raw data read from pickerState_debug.json:', data); // Added for debugging
        pickerState = JSON.parse(data);
        console.log('✅ Picker state loaded successfully.');
    } catch (error) {
        console.error('❌ Failed to load picker state:', error);
        pickerState = {}; // Reset to empty on error to prevent corrupted state
    }
}

async function savePickerState(): Promise<void> {
    console.log('--- Entering savePickerState ---'); // Added for debugging
    console.log('Object to be written:', pickerState); // Log the object itself
    const dataToWrite = JSON.stringify(pickerState, null, 2);
    try {
        console.log('Attempting to write picker state to data to DEBUG file (synchronously):', PICKER_STATE_FILE_DEBUG);
        fs.writeFileSync(PICKER_STATE_FILE_DEBUG, dataToWrite, 'utf-8'); // Write to DEBUG file
        console.log('✅ Picker state saved (synchronously to DEBUG file).');
    } catch (error) {
        console.error('❌ Failed to save picker state (synchronous error to DEBUG file):', error);
        throw error; // Re-throw to ensure it's caught by setPicker or unhandledRejection
    } finally {
        console.log('--- Exiting savePickerState ---');
    }
}

export function getFullPickerState(): PickerState {
    return pickerState;
}

export async function setPicker(gameType: string, pickerId: string | null, nominatorId?: string | null, nextScheduledGameName?: string): Promise<void> {
    const key = gameType.toUpperCase();
    pickerState[key] = {
        pickerDiscordId: pickerId,
        nominatedBy: nominatorId,
        designatedAt: new Date().toISOString(),
        nextScheduledGameName: nextScheduledGameName, // Store the scheduled game name
    };
    await savePickerState();
    console.log(`👑 New picker for ${key} set to: ${pickerId}. Nominated by: ${nominatorId ?? 'N/A'}. Next scheduled game: ${nextScheduledGameName ?? 'None'}`);
}

export function getPicker(gameType: string): PickerInfo | null {
    const key = gameType.toUpperCase();
    const info = pickerState[key] ?? null;
    console.log(`🔍 Getting picker for ${key}. Found: ${info ? JSON.stringify(info) : 'None'}`); // Added logging for getPicker
    return info;
}

export async function clearPicker(gameType: string): Promise<void> {
    const key = gameType.toUpperCase();
    if (pickerState[key]) {
        // Clear picker-specific info, but keep nextScheduledGameName and designatedAt
        pickerState[key].pickerDiscordId = null;
        pickerState[key].nominatedBy = undefined; // Clear nominator as well
        // designatedAt remains as it marks when the picker was last designated (even if now cleared)
        await savePickerState();
        console.log(`✅ Picker designation for ${key} has been cleared.`);
    }
}

export async function gamePicked(gameType: string, newGameName: string): Promise<void> {
    const key = gameType.toUpperCase();
    if (pickerState[key]) {
        pickerState[key].pickerDiscordId = null;
        pickerState[key].nominatedBy = undefined;
        pickerState[key].nextScheduledGameName = newGameName; // Store the game name that was just picked
        await savePickerState();
        console.log(`✅ Game picked for ${key}: ${newGameName}. Picker designation cleared.`);
    } else {
        console.error(`❌ No picker info found for ${key} when calling gamePicked.`);
    }
}

// Initial load when the module is imported
loadPickerState();