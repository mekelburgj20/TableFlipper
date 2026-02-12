import { Client, GatewayIntentBits, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { Browser } from 'playwright';
import { loginToIScored, createGame, submitScoreToIscored } from './iscored.js';
import { getIscoredNameByDiscordId, getDiscordIdByIscoredName } from './userMapping.js';
import { getPicker, setPicker, updateQueuedGame, getNextQueuedGame, searchTables, getTable, getRecentGameNames, getRandomCompatibleTable } from './database.js';
import { getLastWinner, getHistory, getTableStats } from './history.js';
import { getTablesFromSheet } from './googleSheet.js';
import { getStandingsFromApi, findActiveGame } from './api.js';
import { setPause, getPauseState } from './pauseState.js';
import { triggerAllMaintenanceRoutines, runMaintenanceForGameType } from './maintenance.js';

export function startDiscordBot() {
    console.log('🤖 Starting Discord bot...');
    console.log(`Debug: MOD_ROLE_ID from env: ${process.env.MOD_ROLE_ID}`);

    // Global unhandled promise rejection handler for debugging
    process.on('unhandledRejection', (reason, promise) => {
        console.error('--- Unhandled Rejection (Global) ---');
        console.error('Reason:', reason);
        console.error('Promise:', promise);
        console.error('------------------------------------');
    });

    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token || token === 'your_discord_bot_token') {
        console.error('❌ DISCORD_BOT_TOKEN not found in environment variables. Bot will not start.');
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
        console.log(`✅ Discord bot ready! Logged in as ${readyClient.user.tag}`);
    });

    // --- Command Handler ---
    client.on(Events.InteractionCreate, async interaction => {
        if (interaction.isAutocomplete()) {
            const focusedOption = interaction.options.getFocused(true);

            if (focusedOption.name === 'table-name') {
                const gameType = interaction.options.getString('game-type');
                console.log(`Debug: Autocomplete. GameType: '${gameType}', Search: '${focusedOption.value}'`);
                
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
        
        else if (commandName === 'picktable') {
            const gameType = interaction.options.getString('game-type', true);
            let tableName = interaction.options.getString('table-name');
            const surpriseMe = interaction.options.getBoolean('surprise-me');

            if (!tableName && !surpriseMe) {
                await interaction.reply({ content: '❌ You must either provide a **table-name** or select **surprise-me: True**.', ephemeral: true });
                return;
            }

            await interaction.deferReply();

            // 1. Find the next queued game for this type and check if the user is the picker
            const nextGame = await getNextQueuedGame(gameType);

            if (!nextGame || !nextGame.picker_discord_id || nextGame.picker_discord_id !== interaction.user.id) {
                console.log(`❌ /picktable authorization failed for user ${interaction.user.id}.`);
                console.log(`   - Next game picker slot: ${nextGame?.picker_discord_id}`);
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
                    await interaction.editReply(`❌ I couldn't find a valid random table that matches the criteria (Platform: ${platformFilter}, History: ${daysLookback} days).`);
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
                    content: `🎲 **Fate has chosen:** **${randomTable.name}**\n\nDo you want to proceed with this table?`,
                    components: [row]
                });

                try {
                    const confirmation = await response.awaitMessageComponent({ 
                        filter: i => i.user.id === interaction.user.id, 
                        time: 60000 
                    });

                    if (confirmation.customId === 'cancel_pick') {
                        await confirmation.update({ content: '❌ Selection cancelled. You can run `/picktable` again.', components: [] });
                        return;
                    }

                    await confirmation.update({ content: `✅ Confirmed! Setting up **${randomTable.name}**...`, components: [] });
                    tableName = randomTable.name;

                } catch (e) {
                    await interaction.editReply({ content: '❌ Confirmation timed out. Selection cancelled.', components: [] });
                    return;
                }
            }

            // 3. Validate Table Selection (Skip if Surprise Me was used, as it came from DB)
            if (!surpriseMe && tableName) {
                // Manual selection validation
                if (gameType === 'DG') {
                    const tableData = await getTable(tableName);
                    
                    if (!tableData) {
                        await interaction.editReply(`❌ The table '**${tableName}**' is not recognized in our database. Please select a valid table from the list for Daily Grind.`);
                        return;
                    }

                    if (!tableData.is_atgames) {
                        await interaction.editReply(`❌ The table '**${tableName}**' is not marked as available on **AtGames**. Please select an AtGames-compatible table for Daily Grind.`);
                        return;
                    }
                }
                // For WG-VR and WG-VPXS, we implemented STRICT filtering in autocomplete,
                // but the user could still type "Africa".
                // The requirements said: "For the Weekly and Monthly Grinds, no validation is necessary..."
                // BUT later the user said "list... is showing games that are not available...".
                // I updated autocomplete filtering.
                // Should I add validation here too?
                // The prompt for THIS task didn't ask for it, but "Surprise Me" handles it.
                // I will stick to existing logic: Only strict validation for DG, filtering for others was UI-only (Autocomplete).
                // Wait, if I type "Africa" for WG-VPXS manually, should it fail?
                // Previously I implemented NO validation for WG. I'll keep it that way unless asked.
            }

            // 4. Create the game in iScored
            const newGameName = `${tableName} ${gameType}`;
            let browser: Browser | null = null;
            try {
                console.log(`🚀 Handling /picktable for ${gameType} with table: ${tableName}`);
                const { browser: newBrowser, page } = await loginToIScored();
                browser = newBrowser;
                
                // This function now creates the game and returns the iScored ID
                const iscoredGameId = await createGame(page, newGameName); 
                
                // 5. Update the game entry in our database
                await updateQueuedGame(nextGame.id, newGameName, iscoredGameId);

                const confirmationMessage = `✅ Thank you, ${interaction.user.toString()}! The table **${newGameName}** has been selected and created. It will be the table for the tournament in 2 days.`;
                
                // If we already replied via button update, we need to edit that or follow up?
                // We did `await confirmation.update({ content: ... })`.
                // So the interaction is technically "replied".
                // `interaction.editReply` edits the ORIGINAL reply (which is now the "Confirmed! Setting up..." message).
                await interaction.editReply({ content: confirmationMessage, components: [] });

            } catch (error) {
                console.error(error);
                await interaction.editReply(`❌ An error occurred while trying to create the game '${newGameName}'.`);
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
            const gameType = interaction.options.getString('game-type', true);
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
                await interaction.editReply('✅ Daily Grind (DG) maintenance routine has been manually triggered and completed.');
            } catch (error) {
                console.error('❌ Error manually triggering DG maintenance:', error);
                await interaction.editReply('❌ An error occurred while trying to manually trigger the DG maintenance routine.');
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
                await interaction.editReply('✅ Weekly Grind (WG-VPXS, WG-VR) maintenance routines have been manually triggered and completed.');
            } catch (error) {
                console.error('❌ Error manually triggering Weekly maintenance:', error);
                await interaction.editReply('❌ An error occurred while trying to manually trigger the Weekly maintenance routines.');
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
                await interaction.editReply('✅ Monthly Grind (MG) maintenance routine has been manually triggered and completed.');
            } catch (error) {
                console.error('❌ Error manually triggering Monthly maintenance:', error);
                await interaction.editReply('❌ An error occurred while trying to manually trigger the Monthly maintenance routine.');
            }
        }
        
        else if (commandName === 'pause-dg-pick') {
            const specialGameName = interaction.options.getString('special-game-name', true);
            const durationHours = interaction.options.getInteger('duration-hours') ?? 24;

            await interaction.deferReply({ ephemeral: true });

            // 1. Check for Mod Role
            const modRoleId = process.env.MOD_ROLE_ID;
            if (!modRoleId) {
                await interaction.editReply('The MOD_ROLE_ID is not configured. Please contact an admin.');
                return;
            }
            
            const memberRoles = interaction.member?.roles as any; // any is not ideal, but discord.js v14 types are complex
            if (!memberRoles || !memberRoles.cache.has(modRoleId)) {
                await interaction.editReply('You do not have permission to use this command.');
                return;
            }

            // 2. Set the pause state
            await setPause(specialGameName, durationHours);

            // 3. Confirm
            await interaction.editReply(`✅ Picker pause has been activated for ${durationHours} hours. The special game will be **${specialGameName}**.`);
            if (interaction.channel && 'send' in interaction.channel) {
                await interaction.channel.send(`**Attention:** Normal table picking has been paused by a moderator. The next tournament will be on **${specialGameName}**.`);
            }
        }
        
        else if (commandName === 'current-dg-scores') {
            const gameType = interaction.options.getString('game-type', true);
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
                console.error(error);
                await interaction.editReply('❌ An error occurred while trying to fetch the current scores.');
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
                console.error(error);
                await interaction.editReply('❌ An error occurred while trying to fetch the table list.');
            }
        }
        
        else if (commandName === 'nominate-picker') {
            const gameType = interaction.options.getString('game-type', true);
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
        
        else if (commandName === 'submitscore-dg') { // Note: Command name was updated
            const gameType = interaction.options.getString('game-type', true);
            const score = interaction.options.getInteger('score', true);
            const photoAttachment = interaction.options.getAttachment('photo', true);
            const iScoredUsername = interaction.options.getString('iscored_username', true);

            await interaction.deferReply();

            try {
                // Check if the provided iScored username is already mapped to a different Discord user
                const existingDiscordId = getIscoredNameByDiscordId(iScoredUsername);
                if (existingDiscordId && existingDiscordId !== interaction.user.id) {
                    await interaction.editReply(`❌ The iScored username '${iScoredUsername}' is already linked to another Discord user.`);
                    return;
                }

                await submitScoreToIscored(iScoredUsername, interaction.user.id, score, photoAttachment.url, gameType);
                await interaction.editReply(`✅ Received your score of ${score} for ${iScoredUsername} (${gameType}). Submission to iScored successful!`);
            } catch (error) {
                console.error(error);
                await interaction.editReply(`❌ An error occurred while trying to submit your score.`);
            }
        }
    });


    client.login(token);
}
