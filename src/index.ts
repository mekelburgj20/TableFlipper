import 'dotenv/config';
import { runMaintenanceForGameType, triggerAllMaintenanceRoutines } from './maintenance.js';
import { startDiscordBot } from './discordBot.js';
import { loadUserMapping } from './userMapping.js';
import cron from 'node-cron';
import { checkPickerTimeouts } from './timeout.js';

console.log('🤖 TableFlipper Bot starting for testing...');

// Check for manual maintenance trigger
if (process.argv.includes('--trigger-maintenance')) {
    console.log('Detected --trigger-maintenance argument. Running all maintenance routines...');
    triggerAllMaintenanceRoutines()
        .then(() => {
            console.log('Manual maintenance trigger completed. Exiting.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error during manual maintenance trigger:', error);
            process.exit(1);
        });
} else {
    // Normal bot startup
    startDiscordBot(); 
    // try {
    //     await loadUserMapping(); // Load user mappings at startup
    // } catch (error) {
    //     console.error('❌ Failed to load user mappings at startup:', error);
    //     process.exit(1); // Exit if user mappings cannot be loaded
    // }

    // Validate essential environment variables
    // if (!process.env.ISCORED_USERNAME || !process.env.ISCORED_PASSWORD || !process.env.GAMEROOM_NAME) {
    //     console.error('❌ Missing critical iScored environment variables. Please check your .env file.');
    //     process.exit(1);
    // }



    // Schedule the Daily Grind maintenance to run at 12:00 AM Central Time
    cron.schedule('0 0 * * *', () => {
        console.log('⏰ Kicking off scheduled maintenance for DG...');
        runMaintenanceForGameType('DG').catch((error: any) => {
            console.error('🚨 DG maintenance task failed:', error);
        });
    }, {
        scheduled: true,
        timezone: "America/Chicago"
    });

    // Schedule the Weekly Grind maintenance to run at 12:01 AM on Wednesdays
    cron.schedule('1 0 * * 3', () => {
        console.log('⏰ Kicking off scheduled maintenance for Weekly Grinds...');
        runMaintenanceForGameType('WG-VPXS').catch((error: any) => {
            console.error('🚨 WG-VPXS maintenance task failed:', error);
        });
        runMaintenanceForGameType('WG-VR').catch((error: any) => {
            console.error('🚨 WG-VR maintenance task failed:', error);
        });
    }, {
        scheduled: true,
        timezone: "America/Chicago"
    });

    // Schedule the Monthly Grind maintenance to run at 12:01 AM on the 1st of the month
    cron.schedule('1 0 1 * *', () => {
        console.log('⏰ Kicking off scheduled maintenance for Monthly Grind...');
        runMaintenanceForGameType('MG').catch((error: any) => {
            console.error('🚨 MG maintenance task failed:', error);
        });
    }, {
        scheduled: true,
        timezone: "America/Chicago"
    });



    // Schedule the picker timeout check to run every hour
    cron.schedule('0 * * * *', () => {
        console.log('⏰ Kicking off hourly picker timeout check...');
        checkPickerTimeouts().catch((error: any) => {
            console.error('🚨 Picker timeout check task failed:', error);
        });
    }, {
        scheduled: true,
        timezone: "America/Chicago"
    });
}
