import 'dotenv/config';
import { runMaintenanceForGameType, triggerAllMaintenanceRoutines, runCleanupForGameType, syncAllActiveStyles, triggerLineupRepositioning } from './maintenance.js';
import { startDiscordBot } from './discordBot.js';
import { loadUserMapping } from './userMapping.js';
import { initializeDatabase } from './database.js';
import cron from 'node-cron';
import { checkPickerTimeouts } from './timeout.js';
import { logInfo, logError } from './logger.js';

async function main() {
    logInfo('🤖 TableFlipper Bot starting...');

    // Initialize the database first
    try {
        await initializeDatabase();
    } catch (error) {
        logError('❌ Failed to initialize database:', error);
        process.exit(1); // Exit if database cannot be initialized
    }
    
    // Load user mappings at startup, this is critical for both modes.
    try {
        await loadUserMapping();
    } catch (error) {
        logError('❌ Failed to load user mappings at startup:', error);
        process.exit(1); // Exit if user mappings cannot be loaded
    }

    // Check for manual maintenance trigger
    if (process.argv.includes('--run-maintenance')) {
        logInfo('Detected --run-maintenance argument. Running all maintenance routines...');
        try {
            await triggerAllMaintenanceRoutines();
            await triggerLineupRepositioning();
            logInfo('Manual maintenance trigger completed. Exiting.');
            process.exit(0);
        } catch (error) {
            logError('Error during manual maintenance trigger:', error);
            process.exit(1);
        }
    } else {
        // Normal bot startup
        startDiscordBot();

        // Schedule the Daily Grind maintenance to run at 12:00 AM Central Time
        cron.schedule('0 0 * * *', async () => {
            logInfo('⏰ Kicking off scheduled maintenance for DG + Global Style Sync + Repositioning...');
            try {
                await syncAllActiveStyles(); // Learned styles for all active tables
                await runMaintenanceForGameType('DG');
                await triggerLineupRepositioning();
            } catch (error) {
                logError('🚨 Daily maintenance task failed:', error);
            }
        }, {
            scheduled: true,
            timezone: "America/Chicago"
        });

        // Schedule the Weekly Grind maintenance to run at 11:00 PM on Wednesdays
        cron.schedule('0 23 * * 3', async () => {
            logInfo('⏰ Kicking off scheduled maintenance for Weekly Grinds...');
            try {
                await syncAllActiveStyles(); // Learned styles for all active tables
                await runMaintenanceForGameType('WG-VPXS');
                await runMaintenanceForGameType('WG-VR');
                await triggerLineupRepositioning();
            } catch (error) {
                logError('🚨 Weekly maintenance task failed:', error);
            }
        }, {
            scheduled: true,
            timezone: "America/Chicago"
        });

        // Schedule the Cleanup Routine for DG and WG to run at 11:01 PM on Wednesdays
        cron.schedule('1 23 * * 3', async () => {
            logInfo('🧹 Kicking off scheduled cleanup for DG and WG...');
            try {
                await syncAllActiveStyles(); // Final style sync before cleanup
                await runCleanupForGameType('DG');
                await runCleanupForGameType('WG-VPXS');
                await runCleanupForGameType('WG-VR');
                await triggerLineupRepositioning();
            } catch (error) {
                logError('🚨 Cleanup task failed:', error);
            }
        }, {
            scheduled: true,
            timezone: "America/Chicago"
        });

        // Schedule the Monthly Grind maintenance to run at 12:01 AM on the 1st of the month
        cron.schedule('1 0 1 * *', async () => {
            logInfo('⏰ Kicking off scheduled maintenance for Monthly Grind...');
            try {
                await syncAllActiveStyles(); // Learned styles for all active tables
                await runMaintenanceForGameType('MG');
                await triggerLineupRepositioning();
            } catch (error) {
                logError('🚨 MG maintenance task failed:', error);
            }
        }, {
            scheduled: true,
            timezone: "America/Chicago"
        });

        // Schedule the picker timeout check to run every hour
        cron.schedule('0 * * * *', () => {
            logInfo('⏰ Kicking off hourly picker timeout check...');
            checkPickerTimeouts().catch((error: any) => {
                logError('🚨 Picker timeout check task failed:', error);
            });
        }, {
            scheduled: true,
            timezone: "America/Chicago"
        });
    }
}

main().catch(error => {
    logError("💥 Fatal error during startup:", error);
    process.exit(1);
});