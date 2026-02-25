import { Client, GatewayIntentBits, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { Browser } from 'playwright';
import fs from 'fs';
import * as path from 'path';
import { loginToIScored, createGame, submitScoreToIscored } from './iscored.js';
import { getIscoredNameByDiscordId, getDiscordIdByIscoredName } from './userMapping.js';
import { getPicker, setPicker, updateQueuedGame, getNextQueuedGame, searchTables, getTable, getRecentGameNames, getRandomCompatibleTable, injectSpecialGame, getActiveGames, searchGamesByStatus, getGameByNameAndStatus, getAllActiveGames } from './database.js';
import { getLastWinner, getHistory, getTableStats, getRecentWinners } from './history.js';
import { getTablesFromSheet } from './googleSheet.js';
import { getStandingsFromApi } from './api.js';
import { triggerAllMaintenanceRoutines, runMaintenanceForGameType, runCleanupForGameType } from './maintenance.js';
import { runStateSync } from './sync-state.js';
import { createBackup, restoreBackup } from './backup-restore.js';
import { logInfo, logError, logWarn } from './logger.js';

/**
 * Helper to infer the tournament type based on the Discord channel name.
 */
function getGameTypeFromChannel(channelName: string | null): string | null {
    if (!channelName) return null;
    const name = channelName.toLowerCase();
    if (name.includes('daily') || name.includes('-dg')) return 'DG';
    if (name.includes('weekly-vpxs') || name.includes('-vpxs')) return 'WG-VPXS';
    if (name.includes('weekly-vr') || name.includes('-vr')) return 'WG-VR';
    if (name.includes('monthly') || name.includes('-mg')) return 'MG';
    return null;
}

export function startDiscordBot() {
    logInfo('🤖 Starting Discord bot...');
    logInfo(`Debug: MOD_ROLE_ID from env: ${process.env.MOD_ROLE_ID}`);

    // Global unhandled promise rejection handler for debugging
    process.on('unhandledRejection', (reason, promise) => {
        logError('--- Unhandled Rejection (Global) ---', reason);
    });

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token || token === 'your_discord_bot_token') {
        logError('❌ DISCORD_BOT_TOKEN not found in environment variables. Bot will not start.');
        return;
    }

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent, // Required to read message content
        ],
    });

    client.once(Events.ClientReady, readyClient => {
        logInfo(`✅ Discord bot ready! Logged in as ${readyClient.user.tag}`);
    });

    // --- Message Handler (Easter Eggs) ---
    client.on(Events.MessageCreate, async message => {
        if (message.author.bot) return;

        const content = message.content.toLowerCase();
        
        // Load Easter Eggs from external JSON
        const easterEggsPath = path.join(process.cwd(), 'data', 'easter-eggs.json');
        if (fs.existsSync(easterEggsPath)) {
            try {
                const eggs = JSON.parse(fs.readFileSync(easterEggsPath, 'utf8'));
                for (const egg of eggs) {
                    const match = egg.triggers.some((trigger: string) => content.includes(trigger.toLowerCase()));
                    if (match) {
                        const response = egg.responses[Math.floor(Math.random() * egg.responses.length)];
                        await message.reply(response);
                        return; // Only trigger one egg per message
                    }
                }
            } catch (e) {
                logError('Failed to load or parse easter-eggs.json:', e);
            }
        }
    });

    // --- Command Handler ---
    client.on(Events.InteractionCreate, async interaction => {
        // Autocomplete logging handled inside the block if needed, but let's log chat commands
        if (interaction.isChatInputCommand()) {
             logInfo(`Received command: /${interaction.commandName} from ${interaction.user.tag} (${interaction.user.id})`);
        }

        if (interaction.isAutocomplete()) {
            const focusedOption = interaction.options.getFocused(true);

            if (focusedOption.name === 'table-name') {
                const commandName = interaction.commandName;
                let gameType = interaction.options.getString('grind-type');
                const query = focusedOption.value;

                // Channel-specific context inference
                if (!gameType && 'name' in interaction.channel!) {
                    gameType = getGameTypeFromChannel(interaction.channel.name);
                }

                logInfo(`Autocomplete debug: command='${commandName}', gameType='${gameType}', query='${query}'`);
                
                let choices: any[] = [];

                if (commandName === 'pick-table') {
                    if (gameType === 'DG') {
                        choices = await searchTables(query, 25, 'atgames');
                    } else if (gameType === 'WG-VR') {
                        choices = await searchTables(query, 25, 'vr');
                    } else if (gameType === 'WG-VPXS') {
                        choices = await searchTables(query, 25, 'vpxs');
                    }
                } else if (commandName === 'list-scores') {
                    // Entire current lineup (locked and unlocked), but not queued (hidden)
                    choices = await searchGamesByStatus(query, ['ACTIVE', 'COMPLETED'], 25, gameType);
                } else if (commandName === 'submit-score') {
                    // Only active games (not locked or hidden)
                    choices = await searchGamesByStatus(query, ['ACTIVE'], 25, gameType);
                }

                let filtered = choices.map(t => {
                    // Use the 'type' if available (GameRow) or map based on platform flags (TableRow)
                    let typeLabel = '';
                    if ('type' in t && t.type) {
                        const displayType = t.type === 'OTHER' ? 'Non-Tournament' : t.type;
                        typeLabel = ` [${displayType}]`;
                    } else if ('is_atgames' in t) {
                        if (t.is_atgames) typeLabel = ' [DG]';
                        else if (t.is_wg_vpxs) typeLabel = ' [WG-VPXS]';
                        else if (t.is_wg_vr) typeLabel = ' [WG-VR]';
                    }
                    return { name: `${t.name}${typeLabel}`, value: t.name };
                });

                // --- Empty Result Handling ---
                if (filtered.length === 0) {
                    const typeMsg = gameType ? ` for ${gameType}` : '';
                    filtered = [{ 
                        name: `(No active games found${typeMsg})`, 
                        value: 'NONE_FOUND' 
                    }];
                }

                await interaction.respond(filtered.slice(0, 25));
            }
            return;
        }

        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;

        if (commandName === 'check-ping') {
            await interaction.reply('Pong!');
        } 
        
        else if (commandName === 'list-active') {
            let gameType = interaction.options.getString('grind-type');
            
            // Channel-specific context inference
            if (!gameType && interaction.channel && 'name' in interaction.channel) {
                gameType = getGameTypeFromChannel(interaction.channel.name);
            }

            await interaction.deferReply();

            try {
                if (gameType) {
                    // Specific type requested
                    const activeGames = await getActiveGames(gameType);
                    if (activeGames.length > 0) {
                        const names = activeGames.map(g => `**${g.name}**`).join(', ');
                        await interaction.editReply(`The currently active table(s) for **${gameType}** are: ${names}`);
                    } else {
                        await interaction.editReply(`There is no active table for **${gameType}** at this time.`);
                    }
                } else {
                    // List all types
                    const types = ['DG', 'WG-VPXS', 'WG-VR', 'MG', 'OTHER'];
                    let message = '**Currently Active Tables:**\n';
                    
                    for (const type of types) {
                        const activeGames = await getActiveGames(type);
                        if (activeGames.length > 0) {
                            const names = activeGames.map(g => g.name).join(', ');
                            const typeLabel = type === 'OTHER' ? 'Non-Tournament' : type;
                            message += `**${typeLabel}:** ${names}\n`;
                        } else if (type !== 'OTHER') {
                            message += `**${type}:** *None*\n`;
                        }
                    }
                    await interaction.editReply(message);
                }
            } catch (error) {
                logError(`Error in /list-active:`, error);
                await interaction.editReply('An error occurred while fetching the active games.');
            }
        }

        else if (commandName === 'pick-table') {
            let gameType = interaction.options.getString('grind-type');
            
            // Channel-specific context inference
            if (!gameType && interaction.channel && 'name' in interaction.channel) {
                gameType = getGameTypeFromChannel(interaction.channel.name);
            }

            if (!gameType) {
                await interaction.reply({ content: 'Please specify a **grind-type** or run this command in a tournament-specific channel.', ephemeral: true });
                return;
            }

            let tableName = interaction.options.getString('table-name');
            const surpriseMe = interaction.options.getBoolean('surprise-me');

            if (!tableName && !surpriseMe) {
                await interaction.reply({ content: 'You must either provide a **table-name** or select **surprise-me: True**.', ephemeral: true });
                return;
            }

            await interaction.deferReply();

            // 1. Find the next queued game for this type and check if the user is the picker
            const nextGame = await getNextQueuedGame(gameType);

            if (!nextGame || !nextGame.picker_discord_id || nextGame.picker_discord_id !== interaction.user.id) {
                logInfo(`❌ /pick-table authorization failed for user ${interaction.user.id}.`);
                logInfo(`   - Next game picker slot: ${nextGame?.picker_discord_id}`);
                await interaction.editReply(`You are not authorized to pick a table for the ${gameType} tournament right now.`);
                return;
            }

            // 2. Handle Surprise Me Logic
            if (surpriseMe) {
                const daysLookback = 21;
                const recentGames = await getRecentGameNames(gameType, daysLookback);
                
                let platformFilter: 'atgames' | 'vr' | 'vpxs' = 'atgames'; 
                if (gameType === 'WG-VR') platformFilter = 'vr';
                if (gameType === 'WG-VPXS') platformFilter = 'vpxs';

                const randomTable = await getRandomCompatibleTable(platformFilter, recentGames);

                if (!randomTable) {
                    await interaction.editReply(`I couldn't find a valid random table that matches the criteria (Platform: ${platformFilter}, History: ${daysLookback} days).`);
                    return;
                }

                // Confirmation UI
                const confirmBtn = new ButtonBuilder()
                    .setCustomId('confirm_pick')
                    .setLabel(`Yes, pick ${randomTable.name}`)
                    .setStyle(ButtonStyle.Success);
                
                const cancelBtn = new ButtonBuilder()
                    .setCustomId('cancel_pick')
                    .setLabel('No, pick another')
                    .setStyle(ButtonStyle.Secondary);

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, cancelBtn);

                const response = await interaction.editReply({
                    content: `**Fate has chosen:** **${randomTable.name}**\n\nDo you want to proceed with this table?`,
                    components: [row]
                });

                try {
                    const confirmation = await response.awaitMessageComponent({ 
                        filter: i => i.user.id === interaction.user.id, 
                        time: 60000 
                    });

                    if (confirmation.customId === 'cancel_pick') {
                        await confirmation.update({ content: 'Selection cancelled. You can run `/pick-table` again.', components: [] });
                        return;
                    }

                    await confirmation.update({ content: `Confirmed! Setting up **${randomTable.name}**...`, components: [] });
                    tableName = randomTable.name;

                } catch (e) {
                    await interaction.editReply({ content: 'Confirmation timed out. Selection cancelled.', components: [] });
                    return;
                }
            }

            // 3. Validate Table Selection (Skip if Surprise Me was used, as it came from DB)
            if (!surpriseMe && tableName) {
                // Check if table exists and is valid for the mode
                const tableData = await getTable(tableName);
                let isVerified = false;

                if (tableData) {
                    if (gameType === 'DG' && tableData.is_atgames) isVerified = true;
                    else if (gameType === 'WG-VR' && tableData.is_wg_vr) isVerified = true;
                    else if (gameType === 'WG-VPXS' && tableData.is_wg_vpxs) isVerified = true;
                    else if (gameType === 'MG') isVerified = true; // No restriction for MG
                } else {
                    // Table not in DB at all.
                    // For MG, we accept unknown tables. For others, it's unverified.
                    if (gameType === 'MG') isVerified = true;
                }

                if (!isVerified) {
                    const confirmBtn = new ButtonBuilder()
                        .setCustomId('confirm_warning')
                        .setLabel('Yes, proceed anyway')
                        .setStyle(ButtonStyle.Danger); // Red button for warning
                    
                    const cancelBtn = new ButtonBuilder()
                        .setCustomId('cancel_warning')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary);

                    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, cancelBtn);

                    const response = await interaction.editReply({
                        content: `**Warning:** The table "**${tableName}**" is not verified for the **${gameType}** tournament in our database.\n\nAre you sure you want to proceed?`,
                        components: [row]
                    });

                    try {
                        const confirmation = await response.awaitMessageComponent({ 
                            filter: i => i.user.id === interaction.user.id, 
                            time: 60000 
                        });

                        if (confirmation.customId === 'cancel_warning') {
                            await confirmation.update({ content: 'Selection cancelled.', components: [] });
                            return;
                        }

                        // Update the message to remove buttons and show confirmation
                        await confirmation.update({ content: `Proceeding with **${tableName}**...`, components: [] });
                        // Flow continues to creation below...

                    } catch (e) {
                        await interaction.editReply({ content: 'Confirmation timed out. Selection cancelled.', components: [] });
                        return;
                    }
                }
            }

            // 4. Create the game in iScored
            const newGameName = tableName!; // Use clean table name (Tags handle the type)
            let browser: Browser | null = null;
            try {
                logInfo(`🚀 Handling /pick-table for ${gameType} with table: ${tableName}`);
                
                // Fetch styleId if available
                const tableData = await getTable(tableName!);
                const styleId = tableData?.style_id;

                const { browser: newBrowser, page } = await loginToIScored();
                browser = newBrowser;
                
                // This function now creates the game and returns an object with ID and scheduled time
                // We pass the grind-type as the second argument to be added as a Tag
                const { id: iscoredGameId, scheduledTime } = await createGame(page, newGameName, gameType, styleId); 
                
                // 5. Update the game entry in our database
                await updateQueuedGame(nextGame.id, tableName!, iscoredGameId);

                // Format the activation message
                let timeMessage = '';
                if (gameType === 'DG') {
                    const formattedTime = scheduledTime.toLocaleDateString('en-US', {
                        year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'America/Chicago'
                    }) + ' at ' + scheduledTime.toLocaleTimeString('en-US', {
                        hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago'
                    }).toLowerCase() + ' Central';
                    timeMessage = `It will be the table for the tournament beginning **${formattedTime}**.`;
                } else {
                    timeMessage = `It has been activated and is **ready for play right now!**`;
                }

                const confirmationMessage = `Thank you, ${interaction.user.toString()}! The table **${tableName} ${gameType}** has been selected and created. ${timeMessage}`;
                
                await interaction.editReply({ content: confirmationMessage, components: [] });

            } catch (error) {
                logError(`Error in /pick-table:`, error);
                await interaction.editReply(`An error occurred while trying to create the game '${newGameName}'.`);
            } finally {
                if (browser) {
                    await browser.close();
                }
            }
        } 
        
        else if (commandName === 'view-stats') {
            const tableName = interaction.options.getString('table-name', true);
            await interaction.deferReply();

            const { playCount, highScore, highScoreWinner } = await getTableStats(tableName);

            if (playCount === 0) {
                await interaction.editReply(`No play history found for tables matching "${tableName}".`);
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(`Statistics for ${tableName}`)
                .setColor(0x1E90FF)
                .addFields(
                    { name: 'Total Plays', value: playCount.toString(), inline: true },
                    { name: 'All-Time High Score', value: `${highScore.toLocaleString()} (by ${highScoreWinner})`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
        
        else if (commandName === 'list-winners') {
            const view = interaction.options.getString('view') ?? 'recent';
            let gameType = interaction.options.getString('grind-type');

            // Channel-specific context inference
            if (!gameType && interaction.channel && 'name' in interaction.channel) {
                gameType = getGameTypeFromChannel(interaction.channel.name);
            }

            const limit = interaction.options.getInteger('limit') ?? 5;
            const period = interaction.options.getString('period') ?? '7d';

            await interaction.deferReply({ ephemeral: true });

            try {
                if (view === 'recent') {
                    const winners = await getRecentWinners(gameType, limit);

                    if (winners.length === 0) {
                        await interaction.editReply('No past winners found.');
                        return;
                    }

                    const embed = new EmbedBuilder()
                        .setTitle(gameType ? `Recent Winners: ${gameType}` : 'Recent Winners (All Types)')
                        .setColor(0x00FF00)
                        .setTimestamp();

                    let description = '';
                    winners.forEach((w, i) => {
                        const date = new Date(w.created_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago' });
                        description += `**${i + 1}. [${w.game_type}]** ${date}: **${w.iscored_username}** - \`${w.game_name}\`\n`;
                    });

                    embed.setDescription(description);
                    await interaction.editReply({ embeds: [embed] });

                } else {
                    // Leaderboard View
                    if (!gameType) {
                        await interaction.editReply('Please specify a **grind-type** when using the **Leaderboard** view.');
                        return;
                    }

                    const results = await getHistory(gameType);
                    
                    let filteredResults = results;
                    const now = new Date();

                    if (period !== 'all') {
                        const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
                        const filterDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
                        filteredResults = results.filter(r => new Date(r.created_at) > filterDate);
                    }

                    if (filteredResults.length === 0) {
                        await interaction.editReply(`No wins recorded for ${gameType} in the selected period.`);
                        return;
                    }

                    const winCounts: { [winner: string]: number } = {};
                    for (const result of filteredResults) {
                        winCounts[result.iscored_username] = (winCounts[result.iscored_username] || 0) + 1;
                    }

                    const sortedWinners = Object.entries(winCounts).sort((a, b) => b[1] - a[1]);

                    const periodText = period === '7d' ? 'Last 7 Days' : period === '30d' ? 'Last 30 Days' : period === '90d' ? 'Last 90 Days' : 'All Time';
                    const embed = new EmbedBuilder()
                        .setTitle(`Leaderboard for ${gameType} (${periodText})`)
                        .setColor(0xFFD700)
                        .setTimestamp();
                    
                    let description = '';
                    sortedWinners.slice(0, 15).forEach(([winner, count], index) => {
                        description += `**${index + 1}. ${winner}** - ${count} wins\n`;
                    });

                    embed.setDescription(description);
                    await interaction.editReply({ embeds: [embed] });
                }

            } catch (error) {
                logError(`Error in /list-winners:`, error);
                await interaction.editReply('An error occurred while fetching the winners.');
            }
        }
        
        else if (commandName === 'run-maintenance-dg') {
            await interaction.deferReply({ ephemeral: true });
            const modRoleId = process.env.MOD_ROLE_ID;
            if (!modRoleId) {
                await interaction.editReply('The MOD_ROLE_ID is not configured. Please contact an admin.');
                return;
            }
            const memberRoles = interaction.member?.roles as any;
            if (!memberRoles || !memberRoles.cache.has(modRoleId)) {
                await interaction.editReply('You do not have permission to use this command.');
                return;
            }
            try {
                await runMaintenanceForGameType('DG');
                await interaction.editReply('Daily Grind (DG) maintenance routine has been manually triggered and completed.');
            } catch (error) {
                logError('❌ Error manually triggering DG maintenance:', error);
                await interaction.editReply('An error occurred while trying to manually trigger the DG maintenance routine.');
            }
        }
        
        else if (commandName === 'run-maintenance-weekly') {
            await interaction.deferReply({ ephemeral: true });
            const modRoleId = process.env.MOD_ROLE_ID;
            if (!modRoleId) {
                await interaction.editReply('The MOD_ROLE_ID is not configured. Please contact an admin.');
                return;
            }
            const memberRoles = interaction.member?.roles as any;
            if (!memberRoles || !memberRoles.cache.has(modRoleId)) {
                await interaction.editReply('You do not have permission to use this command.');
                return;
            }
            try {
                await runMaintenanceForGameType('WG-VPXS');
                await runMaintenanceForGameType('WG-VR');
                await interaction.editReply('Weekly Grind (WG-VPXS, WG-VR) maintenance routines have been manually triggered and completed.');
            } catch (error) {
                logError('❌ Error manually triggering Weekly maintenance:', error);
                await interaction.editReply('An error occurred while trying to manually trigger the Weekly maintenance routines.');
            }
        }

        else if (commandName === 'run-maintenance-monthly') {
            await interaction.deferReply({ ephemeral: true });
            const modRoleId = process.env.MOD_ROLE_ID;
            if (!modRoleId) {
                await interaction.editReply('The MOD_ROLE_ID is not configured. Please contact an admin.');
                return;
            }
            const memberRoles = interaction.member?.roles as any;
            if (!memberRoles || !memberRoles.cache.has(modRoleId)) {
                await interaction.editReply('You do not have permission to use this command.');
                return;
            }
            try {
                await runMaintenanceForGameType('MG');
                await interaction.editReply('Monthly Grind (MG) maintenance routine has been manually triggered and completed.');
            } catch (error) {
                logError('❌ Error manually triggering Monthly maintenance:', error);
                await interaction.editReply('An error occurred while trying to manually trigger the Monthly maintenance routine.');
            }
        }

        else if (commandName === 'sync-state') {
            await interaction.deferReply({ ephemeral: true });
            const modRoleId = process.env.MOD_ROLE_ID;
            if (!modRoleId) {
                await interaction.editReply('The MOD_ROLE_ID is not configured. Please contact an admin.');
                return;
            }
            const memberRoles = interaction.member?.roles as any;
            if (!memberRoles || !memberRoles.cache.has(modRoleId)) {
                await interaction.editReply('You do not have permission to use this command.');
                return;
            }
            try {
                await runStateSync();
                await interaction.editReply('Tournament state has been successfully synchronized with iScored.');
            } catch (error) {
                logError('❌ Error manually triggering state sync:', error);
                await interaction.editReply('An error occurred while trying to synchronize state.');
            }
        }

        else if (commandName === 'run-cleanup') {
            const gameType = interaction.options.getString('grind-type') ?? 'ALL';
            await interaction.deferReply({ ephemeral: true });
            
            const modRoleId = process.env.MOD_ROLE_ID;
            if (!modRoleId) {
                await interaction.editReply('The MOD_ROLE_ID is not configured. Please contact an admin.');
                return;
            }
            const memberRoles = interaction.member?.roles as any;
            if (!memberRoles || !memberRoles.cache.has(modRoleId)) {
                await interaction.editReply('You do not have permission to use this command.');
                return;
            }

            try {
                if (gameType === 'ALL') {
                    const types = ['DG', 'WG-VPXS', 'WG-VR', 'MG'];
                    let summary = 'Cleanup sweep triggered for:\n';
                    for (const type of types) {
                        logInfo(`🚀 Manually triggering cleanup for ${type}...`);
                        await runCleanupForGameType(type);
                        summary += `Done: **${type}**\n`;
                    }
                    await interaction.editReply(`**Cleanup Complete!**\n\n${summary}\nAll old locked or stray visible tables have been cleared from iScored.`);
                } else {
                    await runCleanupForGameType(gameType);
                    await interaction.editReply(`Cleanup routine for **${gameType}** has been manually triggered and completed.`);
                }
            } catch (error) {
                logError(`❌ Error manually triggering cleanup for ${gameType}:`, error);
                await interaction.editReply(`An error occurred while trying to manually trigger the cleanup routine for ${gameType}.`);
            }
        }
        
        else if (commandName === 'create-backup') {
            await interaction.deferReply({ ephemeral: true });
            const modRoleId = process.env.MOD_ROLE_ID;
            if (!modRoleId) {
                await interaction.editReply('The MOD_ROLE_ID is not configured. Please contact an admin.');
                return;
            }
            const memberRoles = interaction.member?.roles as any;
            if (!memberRoles || !memberRoles.cache.has(modRoleId)) {
                await interaction.editReply('You do not have permission to use this command.');
                return;
            }
            try {
                const backupPath = await createBackup();
                const folderName = backupPath.split(/[\\/]/).pop();
                await interaction.editReply(`**Backup Successful!**\n\nA full system backup has been created at:\n\`${folderName}\`\n\nTo restore this state, use:\n\`/restore-backup backup-folder:${folderName}\``);
            } catch (error) {
                logError('❌ Error during backup:', error);
                await interaction.editReply('An error occurred while creating the backup.');
            }
        }

        else if (commandName === 'pause-pick') {
            const specialGameName = interaction.options.getString('special-game-name', true);

            await interaction.deferReply({ ephemeral: true });

            // 1. Check for Mod Role
            const modRoleId = process.env.MOD_ROLE_ID;
            if (!modRoleId) {
                await interaction.editReply('The MOD_ROLE_ID is not configured. Please contact an admin.');
                return;
            }
            
            const memberRoles = interaction.member?.roles as any;
            if (!memberRoles || !memberRoles.cache.has(modRoleId)) {
                await interaction.editReply('You do not have permission to use this command.');
                return;
            }

            // 2. Create the game in iScored FIRST
            // The maintenance routine expects the game to exist on iScored.
            const fullGameName = specialGameName; // Use clean name, Tag handles ID
            
            let browser: Browser | null = null;
            try {
                logInfo(`🚀 Manual Override: Creating/Finding special game '${fullGameName}'...`);
                
                // Fetch styleId if available
                const tableData = await getTable(fullGameName);
                const styleId = tableData?.style_id;

                const { browser: newBrowser, page } = await loginToIScored();
                browser = newBrowser;
                
                // Create (or find) the game and get its ID
                // Apply 'DG' tag
                const { id: iscoredGameId } = await createGame(page, fullGameName, 'DG', styleId);
                
                // 3. Inject into Database
                await injectSpecialGame('DG', fullGameName, iscoredGameId);
                
                await interaction.editReply(`**Manual Override Successful!**\n\nThe game **${fullGameName}** has been injected into the next available slot.\nNote: This slot's original picker has been overridden to keep the tournament schedule on track.`);

            } catch (error) {
                logError('Error during manual override:', error);
                await interaction.editReply(`An error occurred while trying to inject the special game: ${error}`);
            } finally {
                if (browser) {
                    await browser.close();
                }
            }
        }
        
        else if (commandName === 'list-scores') {
            let gameType = interaction.options.getString('grind-type');

            // Channel-specific context inference
            if (!gameType && interaction.channel && 'name' in interaction.channel) {
                gameType = getGameTypeFromChannel(interaction.channel.name);
            }

            const tableName = interaction.options.getString('table-name');
            await interaction.deferReply({ ephemeral: true });

            try {
                let targetGames: { name: string, type?: string }[] = [];

                if (tableName) {
                    targetGames = [{ name: tableName }];
                } else if (gameType) {
                    const activeGames = await getActiveGames(gameType);
                    if (activeGames.length > 0) {
                        targetGames = activeGames.map(g => ({ name: g.name, type: gameType }));
                    } else {
                        await interaction.editReply(`No active tournament found for **${gameType}**.`);
                        return;
                    }
                } else {
                    // Default: All Active Games
                    const actives = await getAllActiveGames();
                    if (actives.length === 0) {
                        await interaction.editReply('No active tournaments found in the database.');
                        return;
                    }
                    targetGames = actives.map(a => ({ name: a.name, type: a.type }));
                }

                const embeds = [];

                for (const game of targetGames) {
                    const standings = await getStandingsFromApi(game.name);
                    
                    const title = game.type ? `Standings: ${game.type} (${game.name})` : `Standings: ${game.name}`;
                    const embed = new EmbedBuilder()
                        .setTitle(title)
                        .setColor(0x00AE86)
                        .setTimestamp();

                    if (standings.length === 0) {
                        embed.setDescription('No scores submitted yet.');
                    } else {
                        let description = '';
                        standings.slice(0, 10).forEach(s => { 
                            description += `**${s.rank}. ${s.name}** - ${s.score}\n`;
                        });
                        embed.setDescription(description);
                    }
                    embeds.push(embed);
                }

                await interaction.editReply({ embeds: embeds.slice(0, 10) });

            } catch (error) {
                logError(`Error in /list-scores:`, error);
                await interaction.editReply('An error occurred while fetching the standings.');
            }
        }
        
        else if (commandName === 'view-selection') {
            await interaction.deferReply({ ephemeral: true });

            const gid = process.env.GOOGLE_SHEET_GID;
            if (!gid) {
                await interaction.editReply('The Google Sheet GID is not configured. Please contact an admin.');
                return;
            }

            try {
                const tables = await getTablesFromSheet(gid);
                if (tables.length === 0) {
                    await interaction.editReply('Could not find any tables in the selection sheet.');
                    return;
                }

                let message = '**Available Tables for Picking:**\n\n';
                const messageChunks = [];
                for (const table of tables) {
                    if (message.length + table.length > 1900) { // Keep under Discord's 2000 char limit
                        messageChunks.push(message);
                        message = '';
                    }
                    message += `- ${table}\n`;
                }
                messageChunks.push(message);

                await interaction.editReply(messageChunks[0]);
                for (let i = 1; i < messageChunks.length; i++) {
                    await interaction.followUp({ content: messageChunks[i], ephemeral: true });
                }

            } catch (error) {
                logError(`Error in /view-selection:`, error);
                await interaction.editReply('An error occurred while trying to fetch the table list.');
            }
        }
        
        else if (commandName === 'nominate-picker') {
            let gameType = interaction.options.getString('grind-type');

            // Channel-specific context inference
            if (!gameType && interaction.channel && 'name' in interaction.channel) {
                gameType = getGameTypeFromChannel(interaction.channel.name);
            }

            if (!gameType) {
                await interaction.reply({ content: 'Please specify a **grind-type** or run this command in a tournament-specific channel.', ephemeral: true });
                return;
            }

            const nominatedUser = interaction.options.getUser('user', true);
            const nominatorUser = interaction.user;

            await interaction.deferReply({ ephemeral: true });

            // 1. Validate the nominator
            const modRoleId = process.env.MOD_ROLE_ID;
            const memberRoles = interaction.member?.roles as any;
            const isMod = modRoleId && modRoleId !== 'your_mod_role_id' && memberRoles && memberRoles.cache.has(modRoleId);

            if (!isMod) {
                const lastWinner = await getLastWinner(gameType);
                const nominatorIscoredName = getIscoredNameByDiscordId(nominatorUser.id);

                if (!lastWinner || !nominatorIscoredName || lastWinner.toLowerCase() !== nominatorIscoredName.toLowerCase()) {
                    await interaction.editReply(`You are not the last winner for the ${gameType} tournament, so you cannot nominate a picker.`);
                    return;
                }
            }

            // 2. Check if a picker has already been nominated
            const currentPicker = await getPicker(gameType);
            if (currentPicker && currentPicker.picker_discord_id) {
                await interaction.editReply(`A picker has already been designated for the ${gameType} tournament.`);
                return;
            }

            // 3. Set the new picker
            await setPicker(gameType, nominatedUser.id, nominatorUser.id);

            // 4. Send confirmation
            const nominationMsg = isMod ? 
                `**Admin Override:** ${nominatorUser.toString()} has designated ${nominatedUser.toString()} as the picker for the next ${gameType} tournament.` :
                `You have successfully nominated ${nominatedUser.toString()} to pick the next table for the ${gameType} tournament.`;
            
            await interaction.editReply(nominationMsg);
            
            // Also send a public message to the channel
            if (interaction.channel && 'send' in interaction.channel) {
                const publicMsg = isMod ?
                    `**Admin Override:** ${nominatorUser.toString()} has designated ${nominatedUser.toString()} to pick the next table for the ${gameType} tournament!` :
                    `${nominatorUser.toString()} has nominated ${nominatedUser.toString()} to pick the next table for the ${gameType} tournament!`;
                await interaction.channel.send(publicMsg);
            }

        }
        
        else if (commandName === 'submit-score') { 
            const gameType = interaction.options.getString('grind-type');
            let tableName = interaction.options.getString('table-name');
            const score = interaction.options.getInteger('score', true);
            const photoAttachment = interaction.options.getAttachment('photo', true);
            const iScoredUsername = interaction.options.getString('iscored_username', true);

            await interaction.deferReply();

            try {
                // --- Table Name Cleanup ---
                // Support cleaning up any leftover separators if needed
                if (tableName) {
                    if (tableName.includes(' » ')) tableName = tableName.split(' » ').pop()!;
                    if (tableName.includes(' ➔ ')) tableName = tableName.split(' ➔ ').pop()!;
                    if (tableName.includes(' > ')) tableName = tableName.split(' > ').pop()!;
                }

                if (tableName === 'NONE_FOUND' || (tableName && tableName.startsWith('(No active games'))) {
                    await interaction.editReply('You must select a valid table name from the list. If no tables are shown, ensure the selected grind type has active games.');
                    return;
                }

                const existingDiscordId = getIscoredNameByDiscordId(iScoredUsername);
                if (existingDiscordId && existingDiscordId !== interaction.user.id) {
                    await interaction.editReply(`The iScored username '${iScoredUsername}' is already linked to another Discord user.`);
                    return;
                }

                let targetGameName: string | null = null;
                let iscoredId: string | null = null;
                let contextType: string = 'Game';

                if (tableName) {
                    if (tableName.startsWith('NONE_')) {
                        await interaction.editReply('You must select a valid table name from the list. If no tables are shown, ensure the selected grind type has active games.');
                        return;
                    }
                    // If both are provided, filter by both for maximum precision
                    const game = await getGameByNameAndStatus(tableName, ['ACTIVE'], gameType);
                    if (game) {
                        targetGameName = game.name;
                        iscoredId = game.iscored_game_id;
                        if (gameType) {
                            contextType = `Tournament (${gameType})`;
                        } else if (game.type === 'OTHER') {
                            contextType = 'Non-Tournament Game';
                        } else {
                            contextType = `Tournament (${game.type})`;
                        }
                    } else {
                        const typeError = gameType ? ` for the **${gameType}** tournament` : '';
                        await interaction.editReply(`The table "**${tableName}**" is either not active or not found${typeError}. Scores can only be submitted to active games.`);
                        return;
                    }
                } else if (gameType) {
                    const activeGames = await getActiveGames(gameType);
                    if (activeGames.length === 1) {
                        targetGameName = activeGames[0].name;
                        iscoredId = activeGames[0].iscored_game_id;
                        contextType = `Tournament (${gameType})`;
                    } else if (activeGames.length > 1) {
                        await interaction.editReply(`Multiple active tables found for **${gameType}**: ${activeGames.map(g => `**${g.name}**`).join(', ')}. Please use the **table-name** option to specify which table you are submitting for.`);
                        return;
                    } else {
                        await interaction.editReply(`I couldn't find an active game for **${gameType}** in my database.`);
                        return;
                    }
                } else {
                    await interaction.editReply('Please specify either a **grind-type** or a **table-name**.');
                    return;
                }

                const confirmBtn = new ButtonBuilder().setCustomId('confirm_score').setLabel(`Yes, submit for ${targetGameName}`).setStyle(ButtonStyle.Primary);
                const cancelBtn = new ButtonBuilder().setCustomId('cancel_score').setLabel('Cancel').setStyle(ButtonStyle.Secondary);
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, cancelBtn);

                const response = await interaction.editReply({
                    content: `**Score Submission Review**\n\n**${contextType}:** ${targetGameName}\n**Score:** ${score.toLocaleString()}\n**Player:** ${iScoredUsername}\n\nIs this correct?`,
                    components: [row]
                });

                const confirmation = await response.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, time: 60000 });
                if (confirmation.customId === 'cancel_score') {
                    await confirmation.update({ content: 'Submission cancelled.', components: [] });
                    return;
                }

                await confirmation.update({ content: `Confirmed! Submitting score to iScored...`, components: [] });
                await submitScoreToIscored(iScoredUsername, interaction.user.id, score, photoAttachment.url, iscoredId!, targetGameName!);
                await interaction.editReply(`**Success!** Score of ${score.toLocaleString()} posted for **${targetGameName}**.`);
            } catch (error) {
                logError(`Error in /submit-score:`, error);
                await interaction.editReply(`An error occurred while trying to submit your score.`);
            }
        }
    });


    client.login(token);
}