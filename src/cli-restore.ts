import 'dotenv/config';
import { restoreBackup } from './backup-restore.js';
import { logInfo, logError } from './logger.js';
import * as readline from 'readline';

async function main() {
    const backupFolder = process.argv[2];

    if (!backupFolder) {
        console.error('❌ Please provide the backup folder name as an argument.');
        console.error('Usage: npm run restore-backup -- <backup_folder_name>');
        console.error('Example: npm run restore-backup -- 2023-10-27_10-00-00');
        process.exit(1);
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    logInfo('⚠️  DANGER ZONE ⚠️');
    logInfo(`You are about to restore the system state from backup: ${backupFolder}`);
    logInfo('');
    logInfo('THIS WILL:');
    logInfo('1. DELETE ALL current tournament games on iScored.');
    logInfo('2. Recreate games from the backup.');
    logInfo('3. Restore scores and photos.');
    logInfo('4. Overwrite the local database (tableflipper.db).');
    logInfo('');

    rl.question('Are you absolutely sure you want to proceed? Type "yes" to confirm: ', async (answer) => {
        if (answer.toLowerCase() === 'yes') {
            logInfo('Starting restoration process... This may take several minutes.');
            try {
                await restoreBackup(backupFolder);
                logInfo('✅ Restore Complete! Please verify the iScored board.');
                process.exit(0);
            } catch (error) {
                logError('❌ Restore Failed:', error);
                process.exit(1);
            }
        } else {
            logInfo('Restore cancelled.');
            process.exit(0);
        }
        rl.close();
    });
}

main();
