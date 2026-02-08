import fs from 'fs/promises';
import path from 'path';

const PICKER_STATE_FILE = path.join(process.cwd(), 'pickerState.json');

interface PickerInfo {
    pickerDiscordId: string | null;
    nominatedBy?: string | null;
    designatedAt: string | null;
}

interface PickerState {
    [gameType: string]: PickerInfo;
}

let pickerState: PickerState = {};

async function initializePickerState() {
    try {
        await fs.access(PICKER_STATE_FILE);
    } catch {
        await fs.writeFile(PICKER_STATE_FILE, JSON.stringify({}, null, 2));
    }
}

export async function loadPickerState(): Promise<void> {
    try {
        await initializePickerState();
        const data = await fs.readFile(PICKER_STATE_FILE, 'utf-8');
        pickerState = JSON.parse(data);
        console.log('✅ Picker state loaded successfully.');
    } catch (error) {
        console.error('❌ Failed to load picker state:', error);
        pickerState = {}; // Initialize with an empty state on failure
    }
}

async function savePickerState(): Promise<void> {
    try {
        await fs.writeFile(PICKER_STATE_FILE, JSON.stringify(pickerState, null, 2));
    } catch (error) {
        console.error('❌ Failed to save picker state:', error);
    }
}

export function getFullPickerState(): PickerState {
    return pickerState;
}

export async function setPicker(gameType: string, pickerId: string, nominatorId?: string): Promise<void> {
    const key = gameType.toUpperCase();
    pickerState[key] = {
        pickerDiscordId: pickerId,
        nominatedBy: nominatorId,
        designatedAt: new Date().toISOString(),
    };
    await savePickerState();
    console.log(`👑 New picker for ${key} set to: ${pickerId}. Nominated by: ${nominatorId ?? 'N/A'}`);
}

export function getPicker(gameType: string): PickerInfo | null {
    const key = gameType.toUpperCase();
    const info = pickerState[key] ?? null;
    console.log(`🔍 Getting picker for ${key}. Found: ${info ? JSON.stringify(info) : 'None'}`);
    return info;
}

export async function clearPicker(gameType: string): Promise<void> {
    const key = gameType.toUpperCase();
    if (pickerState[key]) {
        delete pickerState[key];
        await savePickerState();
        console.log(`✅ Picker for ${key} has been cleared.`);
    }
}

// Initial load when the module is imported
loadPickerState();