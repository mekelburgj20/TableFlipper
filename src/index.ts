import 'dotenv/config';
import { runMaintenanceForGameType, triggerAllMaintenanceRoutines, runCleanupForGameType, syncAllActiveStyles, triggerLineupRepositioning } from './maintenance.js';
import { startDiscordBot } from './discordBot.js';
import { loadUserMapping } from './userMapping.js';
import { initializeDatabase } from './database.js';
import cron from 'node-cron';
import { checkPickerTimeouts } from './timeout.js';
import { reconcileUserMappings, announceLeadsAndRemind } from './identity.js';
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
        const client = startDiscordBot();

        // Helper to get the primary guild
        const getGuild = async () => {
            if (!client.isReady()) return null;
            return client.guilds.cache.first() || null;
        };

        // --- Daily Grind (DG) Schedule ---
        
        // Lead Announcement & Pre-pick Reminder (10 PM Central)
        cron.schedule('0 22 * * *', async () => {
            logInfo('⏰ Running 10 PM lead announcement for DG...');
            const guild = await getGuild();
            if (guild) {
                const channelId = process.env.DG_CHANNEL_ID || process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID;
                if (channelId) await announceLeadsAndRemind(guild, channelId, 'DG');
            }
        }, { scheduled: true, timezone: "America/Chicago" });

        // Proactive Mapping Scrape (11 PM Central)
        cron.schedule('0 23 * * *', async () => {
            logInfo('⏰ Running 11 PM proactive identity mapping for DG...');
            const guild = await getGuild();
            if (guild) await reconcileUserMappings(guild);
        }, { scheduled: true, timezone: "America/Chicago" });

        // Daily Maintenance (12 AM Central)
        cron.schedule('0 0 * * *', async () => {
            logInfo('⏰ Kicking off scheduled maintenance for DG + Global Style Sync + Repositioning...');
            try {
                await syncAllActiveStyles();
                await runMaintenanceForGameType('DG');
                await triggerLineupRepositioning();
            } catch (error) {
                logError('🚨 Daily maintenance task failed:', error);
            }
        }, { scheduled: true, timezone: "America/Chicago" });

        // --- Weekly Grind (WG) Schedule ---

        // Proactive Mapping Scrape (10 PM Wed Central)
        cron.schedule('0 22 * * 3', async () => {
            logInfo('⏰ Running 10 PM proactive identity mapping for Weekly Grinds...');
            const guild = await getGuild();
            if (guild) await reconcileUserMappings(guild);
        }, { scheduled: true, timezone: "America/Chicago" });

        // Weekly Maintenance (11 PM Wed Central)
        cron.schedule('0 23 * * 3', async () => {
            logInfo('⏰ Kicking off scheduled maintenance for Weekly Grinds...');
            try {
                await syncAllActiveStyles();
                await runMaintenanceForGameType('WG-VPXS');
                await runMaintenanceForGameType('WG-VR');
                await triggerLineupRepositioning();
            } catch (error) {
                logError('🚨 Weekly maintenance task failed:', error);
            }
        }, { scheduled: true, timezone: "America/Chicago" });

        // --- Monthly Grind (MG) Schedule ---

        // Proactive Mapping Scrape (11 PM Last Day of Month)
        // Cron for last day is tricky, let's run it daily at 11 PM and check if tomorrow is the 1st
        cron.schedule('0 23 * * *', async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            if (tomorrow.getDate() === 1) {
                logInfo('⏰ Running 11 PM proactive identity mapping for Monthly Grind...');
                const guild = await getGuild();
                if (guild) await reconcileUserMappings(guild);
            }
        }, { scheduled: true, timezone: "America/Chicago" });

        // Monthly Maintenance (12:01 AM on the 1st)
        cron.schedule('1 0 1 * *', async () => {
            logInfo('⏰ Kicking off scheduled maintenance for Monthly Grind...');
            try {
                await syncAllActiveStyles();
                await runMaintenanceForGameType('MG');
                await triggerLineupRepositioning();
            } catch (error) {
                logError('🚨 MG maintenance task failed:', error);
            }
        }, { scheduled: true, timezone: "America/Chicago" });


        // --- Common Tasks ---

        // Cleanup Routine (11:01 PM Wed)
        cron.schedule('1 23 * * 3', async () => {
            logInfo('🧹 Kicking off scheduled cleanup for DG and WG...');
            try {
                await syncAllActiveStyles();
                await runCleanupForGameType('DG');
                await runCleanupForGameType('WG-VPXS');
                await runCleanupForGameType('WG-VR');
                await triggerLineupRepositioning();
            } catch (error) {
                logError('🚨 Cleanup task failed:', error);
            }
        }, { scheduled: true, timezone: "America/Chicago" });

        // Picker timeout check & reminders (Every 5 minutes)
        cron.schedule('*/5 * * * *', async () => {
            logInfo('⏰ Kicking off 5-minute picker timeout and reminder check...');
            try {
                const guild = await getGuild();
                await checkPickerTimeouts(guild);
            } catch (error) {
                logError('🚨 Picker timeout check task failed:', error);
            }
        }, { scheduled: true, timezone: "America/Chicago" });
    }
}

main().catch(error => {
    logError("💥 Fatal error during startup:", error);
    process.exit(1);
});