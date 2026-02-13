import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'data', 'bot.log');

export function log(message: string, level: 'INFO' | 'ERROR' | 'WARN' = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}
`;
    
    // Log to console
    if (level === 'ERROR') {
        console.error(logEntry.trim());
    } else {
        console.log(logEntry.trim());
    }

    // Log to file
    try {
        fs.appendFileSync(LOG_FILE, logEntry);
    } catch (e) {
        console.error('Failed to write to log file:', e);
    }
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
