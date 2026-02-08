import * as fs from 'fs/promises';

const HISTORY_FILE = 'history.json';

export interface GameResult {
    date: string;
    gameName: string;
    winner: string;
    score: string;
}

interface History {
    [gameType: string]: GameResult[];
}

let history: History = {};

async function initializeHistory() {
    try {
        await fs.access(HISTORY_FILE);
    } catch {
        await fs.writeFile(HISTORY_FILE, JSON.stringify({}, null, 2));
    }
}

export async function loadHistory(): Promise<void> {
    try {
        await initializeHistory();
        const data = await fs.readFile(HISTORY_FILE, 'utf-8');
        history = JSON.parse(data);
    } catch (error) {
        console.error('Error loading history file:', error);
        history = {};
    }
}

async function saveHistory(): Promise<void> {
    try {
        await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
    } catch (error) {
        console.error('Error saving history file:', error);
    }
}

export function getHistory(gameType?: string): History | GameResult[] {
    if (gameType) {
        return history[gameType.toUpperCase()] || [];
    }
    return history;
}

export function getLastWinner(gameType: string): string | null {
    const key = gameType.toUpperCase();
    const results = history[key];
    if (results && results.length > 0) {
        return results[results.length - 1].winner;
    }
    return null;
}

export async function checkWinnerHistory(gameType: string, currentWinner: string): Promise<boolean> {
    console.log(`Checking winner history for ${gameType}...`);
    if (!currentWinner || currentWinner === 'N/A') {
        return false;
    }

    const lastWinner = getLastWinner(gameType);
    console.log(`Last winner for ${gameType} was: ${lastWinner}. Current winner is: ${currentWinner}.`);

    if (lastWinner && lastWinner.toLowerCase() === currentWinner.toLowerCase()) {
        console.log('Dynasty rule applied: Repeat winner.');
        return true;
    }
    return false;
}

export async function updateWinnerHistory(gameType: string, result: Omit<GameResult, 'date'>) {
    if (result.winner && result.winner !== 'N/A') {
        const key = gameType.toUpperCase();
        if (!history[key]) {
            history[key] = [];
        }
        
        const newResult: GameResult = {
            ...result,
            date: new Date().toISOString(),
        };

        history[key].push(newResult);
        console.log(`Updating history.json for ${key} with new result.`);
        await saveHistory();
    }
}

// Initial load
loadHistory();