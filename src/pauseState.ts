import fs from 'fs/promises';
import path from 'path';

const PAUSE_STATE_FILE = path.join(process.cwd(), 'pauseState.json');

interface PauseState {
    isPaused: boolean;
    pausedUntil: string | null;
    specialGameName: string | null;
}

let pauseState: PauseState = {
    isPaused: false,
    pausedUntil: null,
    specialGameName: null,
};

async function initializePauseState() {
    try {
        await fs.access(PAUSE_STATE_FILE);
        const data = await fs.readFile(PAUSE_STATE_FILE, 'utf-8');
        pauseState = JSON.parse(data);
    } catch {
        await fs.writeFile(PAUSE_STATE_FILE, JSON.stringify(pauseState, null, 2));
    }
}

async function savePauseState(): Promise<void> {
    try {
        await fs.writeFile(PAUSE_STATE_FILE, JSON.stringify(pauseState, null, 2));
    } catch (error) {
        console.error('❌ Failed to save pause state:', error);
    }
}

export function getPauseState(): PauseState {
    return pauseState;
}

export async function setPause(specialGameName: string, durationHours: number = 24): Promise<void> {
    const now = new Date();
    const pausedUntil = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
    
    pauseState = {
        isPaused: true,
        pausedUntil: pausedUntil.toISOString(),
        specialGameName: specialGameName,
    };
    await savePauseState();
    console.log(`⏸️ Game picking paused until ${pausedUntil.toISOString()}. Special game: ${specialGameName}`);
}

export async function clearPause(): Promise<void> {
    pauseState = {
        isPaused: false,
        pausedUntil: null,
        specialGameName: null,
    };
    await savePauseState();
    console.log('▶️ Game picking pause has been cleared.');
}

// Function to automatically check and clear the pause if it has expired.
export async function checkPauseExpiration(): Promise<void> {
    if (pauseState.isPaused && pauseState.pausedUntil) {
        const now = new Date();
        const pausedUntil = new Date(pauseState.pausedUntil);
        if (now > pausedUntil) {
            console.log('Pause duration has expired.');
            await clearPause();
        }
    }
}


// Initial load
initializePauseState();
