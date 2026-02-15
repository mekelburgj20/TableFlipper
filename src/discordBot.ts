import { Client, GatewayIntentBits, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { Browser } from 'playwright';
import { loginToIScored, createGame, submitScoreToIscored } from './iscored.js';
import { getIscoredNameByDiscordId, getDiscordIdByIscoredName } from './userMapping.js';
import { getPicker, setPicker, updateQueuedGame, getNextQueuedGame, searchTables, getTable, getRecentGameNames, getRandomCompatibleTable, injectSpecialGame, getActiveGame } from './database.js';
import { getLastWinner, getHistory, getTableStats } from './history.js';
import { getTablesFromSheet } from './googleSheet.js';
import { getStandingsFromApi, findActiveGame } from './api.js';
import { triggerAllMaintenanceRoutines, runMaintenanceForGameType, runCleanupForGameType } from './maintenance.js';
import { logInfo, logError, logWarn } from './logger.js';

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

    // --- Command Handler ---
    client.on(Events.InteractionCreate, async interaction => {
        // Autocomplete logging handled inside the block if needed, but let's log chat commands
        if (interaction.isChatInputCommand()) {
             logInfo(`Received command: /${interaction.commandName} from ${interaction.user.tag} (${interaction.user.id})`);
        }

        if (interaction.isAutocomplete()) {
            const focusedOption = interaction.options.getFocused(true);

            if (focusedOption.name === 'table-name') {
                const gameType = interaction.options.getString('grind-type');
                // logInfo(`Debug: Autocomplete. GameType: '${gameType}', Search: '${focusedOption.value}'`);
                
                let choices: any[] = [];

                if (gameType === 'DG') {
                    choices = await searchTables(focusedOption.value, 25, 'atgames');
                } else if (gameType === 'WG-VR') {
                    choices = await searchTables(focusedOption.value, 25, 'vr');
                } else if (gameType === 'WG-VPXS') {
                    choices = await searchTables(focusedOption.value, 25, 'vpxs');
                } else {
                    // For MG or others, provide no suggestions (allow free typing)
                    await interaction.respond([]);
                    return;
                }

                const filtered = choices.map(t => ({ name: t.name, value: t.name }));
                await interaction.respond(filtered);
            }
            return;
        }

        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;

        if (commandName === 'ping') {
            await interaction.reply('Pong!');
        } 
        
        else if (commandName === 'list-active') {
            const gameType = interaction.options.getString('grind-type');
            await interaction.deferReply();

            try {
                if (gameType) {
                    // Specific type requested
                    const activeGame = await getActiveGame(gameType);
                    if (activeGame) {
                        await interaction.editReply(`The currently active table for **${gameType}** is: **${activeGame.name}**`);
                    } else {
                        await interaction.editReply(`There is no active table for **${gameType}** at this time.`);
                    }
                } else {
                    // List all types
                    const types = ['DG', 'WG-VPXS', 'WG-VR', 'MG'];
                    let message = '**Currently Active Tables:**\n';
                    
                    for (const type of types) {
                        const activeGame = await getActiveGame(type);
                        if (activeGame) {
                            message += `**${type}:** ${activeGame.name}\n`;
                        } else {
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

        else if (commandName === 'picktable') {
            const gameType = interaction.options.getString('grind-type', true);
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
                logInfo(`❌ /picktable authorization failed for user ${interaction.user.id}.`);
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
                        await confirmation.update({ content: 'Selection cancelled. You can run `/picktable` again.', components: [] });
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
                logInfo(`🚀 Handling /picktable for ${gameType} with table: ${tableName}`);
                const { browser: newBrowser, page } = await loginToIScored();
                browser = newBrowser;
                
                // This function now creates the game and returns the iScored ID
                // We pass the grind-type as the second argument to be added as a Tag
                const iscoredGameId = await createGame(page, newGameName, gameType); 
                
                // 5. Update the game entry in our database
                await updateQueuedGame(nextGame.id, tableName!, iscoredGameId);

                // Format the activation time
                let formattedTime = 'Unknown Time';
                if (nextGame.scheduled_to_be_active_at) {
                    const activeDate = new Date(nextGame.scheduled_to_be_active_at);
                     formattedTime = activeDate.toLocaleDateString('en-US', {
                        year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'America/Chicago'
                     }) + ' at ' + activeDate.toLocaleTimeString('en-US', {
                         hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago'
                     }).toLowerCase() + ' Central';
                }

                const confirmationMessage = `Thank you, ${interaction.user.toString()}! The table **${tableName} ${gameType}** has been selected and created. It will be the table for the tournament beginning ${formattedTime}.`;
                
                await interaction.editReply({ content: confirmationMessage, components: [] });

            } catch (error) {
                logError(`Error in /picktable:`, error);
                await interaction.editReply(`An error occurred while trying to create the game '${newGameName}'.`);
            } finally {
                if (browser) {
                    await browser.close();
                }
            }
        } 
        
        else if (commandName === 'table-stats') {
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
            const gameType = interaction.options.getString('grind-type', true);
            const period = interaction.options.getString('period') ?? '7d'; // Default to last 7 days

            await interaction.deferReply();

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
                .setTitle(`Winners for ${gameType} (${periodText})`)
                .setColor(0xFFD700)
                .setTimestamp();
            
            let description = '';
            sortedWinners.slice(0, 15).forEach(([winner, count], index) => {
                description += `**${index + 1}. ${winner}** - ${count} wins\n`;
            });

            embed.setDescription(description);

            await interaction.editReply({ embeds: [embed] });
        }
        
        else if (commandName === 'trigger-maintenance-dg') {
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
        
        else if (commandName === 'trigger-maintenance-weekly') {
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

        else if (commandName === 'trigger-maintenance-monthly') {
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

        else if (commandName === 'trigger-cleanup') {
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
                        summary += `✅ **${type}**\n`;
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
        
        else if (commandName === 'pause-dg-pick') {
            const specialGameName = interaction.options.getString('special-game-name', true);
            // duration-hours is ignored as the queue shift logic handles the delay naturally (pushing by 24h)

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
                const { browser: newBrowser, page } = await loginToIScored();
                browser = newBrowser;
                
                // Create (or find) the game and get its ID
                // Apply 'DG' tag
                const iscoredGameId = await createGame(page, fullGameName, 'DG');
                
                // 3. Inject into Database
                await injectSpecialGame('DG', fullGameName, iscoredGameId);
                
                await interaction.editReply(`**Manual Override Successful!**\n\nThe game **${fullGameName}** has been injected at the front of the queue.\nThe existing winner's pick (and any other queued games) have been pushed back by 24 hours.`);

            } catch (error) {
                logError('Error during manual override:', error);
                await interaction.editReply(`An error occurred while trying to inject the special game: ${error}`);
            } finally {
                if (browser) {
                    await browser.close();
                }
            }
        }
        
        else if (commandName === 'current-dg-scores') {
            const gameType = interaction.options.getString('grind-type', true);
            await interaction.deferReply({ ephemeral: true });

            try {
                const activeGame = await findActiveGame(gameType);
                if (!activeGame) {
                    await interaction.editReply(`Could not find an active tournament for ${gameType}.`);
                    return;
                }

                const standings = await getStandingsFromApi(activeGame.name);
                if (standings.length === 0) {
                    await interaction.editReply(`No scores have been submitted yet for ${activeGame.name}.`);
                    return;
                }

                const embed = new EmbedBuilder()
                    .setTitle(`Current Standings for ${activeGame.name}`)
                    .setColor(0x00AE86)
                    .setTimestamp();

                let description = '';
                standings.slice(0, 15).forEach(s => { // Limit to top 15 to avoid hitting char limits
                    description += `**${s.rank}. ${s.name}** - ${s.score}\n`;
                });
                
                embed.setDescription(description);

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                logError(`Error in /current-dg-scores:`, error);
                await interaction.editReply('An error occurred while trying to fetch the current scores.');
            }
        }
        
        else if (commandName === 'dg-table-selection') {
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
                logError(`Error in /dg-table-selection:`, error);
                await interaction.editReply('An error occurred while trying to fetch the table list.');
            }
        }
        
        else if (commandName === 'nominate-picker') {
            const gameType = interaction.options.getString('grind-type', true);
            const nominatedUser = interaction.options.getUser('user', true);
            const nominatorUser = interaction.user;

            await interaction.deferReply({ ephemeral: true });

            // 1. Validate the nominator
            const lastWinner = await getLastWinner(gameType);
            const nominatorIscoredName = getIscoredNameByDiscordId(nominatorUser.id);

            if (!lastWinner || !nominatorIscoredName || lastWinner.toLowerCase() !== nominatorIscoredName.toLowerCase()) {
                await interaction.editReply(`You are not the last winner for the ${gameType} tournament, so you cannot nominate a picker.`);
                return;
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
            await interaction.editReply(`You have successfully nominated ${nominatedUser.toString()} to pick the next table for the ${gameType} tournament.`);
            
            // Also send a public message to the channel
            if (interaction.channel && 'send' in interaction.channel) {
                await interaction.channel.send(`${nominatorUser.toString()} has nominated ${nominatedUser.toString()} to pick the next table for the ${gameType} tournament!`);
            }

        }
        
        else if (commandName === 'submit-score') { // Note: Command name was updated
            const gameType = interaction.options.getString('grind-type', true);
            const score = interaction.options.getInteger('score', true);
            const photoAttachment = interaction.options.getAttachment('photo', true);
            const iScoredUsername = interaction.options.getString('iscored_username', true);

            await interaction.deferReply();

            try {
                // Check if the provided iScored username is already mapped to a different Discord user
                const existingDiscordId = getIscoredNameByDiscordId(iScoredUsername);
                if (existingDiscordId && existingDiscordId !== interaction.user.id) {
                    await interaction.editReply(`The iScored username '${iScoredUsername}' is already linked to another Discord user.`);
                    return;
                }

                // Get active game name for confirmation
                const activeGame = await getActiveGame(gameType);
                const activeGameName = activeGame ? activeGame.name : "Unknown (Check /list-active)";

                if (!activeGame) {
                    await interaction.editReply(`I couldn't find an active game for **${gameType}** in my database. Please check if the tournament is active.`);
                    return;
                }

                // Confirmation UI
                const confirmBtn = new ButtonBuilder()
                    .setCustomId('confirm_score')
                    .setLabel(`Yes, submit for ${activeGameName}`)
                    .setStyle(ButtonStyle.Primary);
                
                const cancelBtn = new ButtonBuilder()
                    .setCustomId('cancel_score')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary);

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, cancelBtn);

                const response = await interaction.editReply({
                    content: `**Score Submission Review**\n\n**Tournament:** ${gameType}\n**Active Table:** ${activeGameName}\n**Score:** ${score}\n**Player:** ${iScoredUsername}\n\nIs this correct?`,
                    components: [row]
                });

                try {
                    const confirmation = await response.awaitMessageComponent({ 
                        filter: i => i.user.id === interaction.user.id, 
                        time: 60000 
                    });

                    if (confirmation.customId === 'cancel_score') {
                        await confirmation.update({ content: 'Submission cancelled.', components: [] });
                        return;
                    }

                    await confirmation.update({ content: `Confirmed! Submitting score to iScored...`, components: [] });

                    await submitScoreToIscored(iScoredUsername, interaction.user.id, score, photoAttachment.url, activeGame.iscored_game_id, activeGameName);
                    await interaction.editReply(`**Success!** Score of ${score} posted for ${activeGameName}.`);

                } catch (e) {
                    await interaction.editReply({ content: 'Confirmation timed out. Submission cancelled.', components: [] });
                }
            } catch (error) {
                logError(`Error in /submit-score:`, error);
                await interaction.editReply(`An error occurred while trying to submit your score.`);
            }
        }
    });


    client.login(token);
}