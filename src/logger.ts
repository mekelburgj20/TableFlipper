import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'data', 'bot.log');

const LOG_LEVELS = {
    'DEBUG': 0,
    'INFO': 1,
    'WARN': 2,
    'ERROR': 3
};

type LogLevel = keyof typeof LOG_LEVELS;

const CURRENT_LOG_LEVEL = (process.env.LOG_LEVEL?.toUpperCase() as LogLevel) || 'INFO';

export function log(message: string, level: LogLevel = 'INFO') {
    const currentLevelValue = LOG_LEVELS[CURRENT_LOG_LEVEL] ?? 1;
    const incomingLevelValue = LOG_LEVELS[level] ?? 1;

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    
    // Always write to file
    try {
        fs.appendFileSync(LOG_FILE, logEntry);
    } catch (e) {
        console.error('Failed to write to log file:', e);
    }

    // Only log to console if level is sufficient
    if (incomingLevelValue >= currentLevelValue) {
        if (level === 'ERROR') {
            console.error(logEntry.trim());
        } else {
            console.log(logEntry.trim());
        }
    }
}

export function logDebug(message: string) {
    log(message, 'DEBUG');
}

export function logInfo(message: string) {
    log(message, 'INFO');
}

export function logWarn(message: string) {
    log(message, 'WARN');
}

export function logError(message: string, error?: any) {
    let errStr = '';
    if (error) {
        if (error instanceof Error) {
            errStr = `
Stack: ${error.stack}`;
        } else {
            errStr = `
Error: ${JSON.stringify(error)}`;
        }
    }
    log(`${message}${errStr}`, 'ERROR');
}
