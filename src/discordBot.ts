import { Client, GatewayIntentBits, Events, EmbedBuilder } from 'discord.js';
import { Browser } from 'playwright';
import { loginToIScored, createGame, submitScoreToIscored } from './iscored.js';
import { getIscoredNameByDiscordId, getDiscordIdByIscoredName } from './userMapping.js';
import { getPicker, clearPicker, setPicker, gamePicked } from './pickerState.js';
import { getLastWinner, getHistory } from './history.js';
import { getTablesFromSheet } from './googleSheet.js';
import { getStandingsFromApi, findActiveGame } from './api.js';
import { setPause, getPauseState } from './pauseState.js';
import { triggerAllMaintenanceRoutines } from './maintenance.js';

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
        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;

        if (commandName === 'ping') {
            await interaction.reply('Pong!');
        } 
        
        else if (commandName === 'picktable') {
            const gameType = interaction.options.getString('game-type', true);
            const tableName = interaction.options.getString('table-name', true);
            const newGameName = `${tableName} ${gameType}`;

            await interaction.deferReply();

            // 1. Check if the user is the designated picker
            const pickerInfo = getPicker(gameType);
            if (!pickerInfo || pickerInfo.pickerDiscordId !== interaction.user.id) {
                console.log(`❌ /picktable authorization failed for user ${interaction.user.id}.`);
                console.log(`   - Current pickerInfo: ${JSON.stringify(pickerInfo)}`);
                console.log(`   - Interaction user ID: ${interaction.user.id}`);
                await interaction.editReply(`You are not authorized to pick a table for the ${gameType} tournament right now.`);
                return;
            }

            // 2. Create the game in iScored
            let browser: Browser | null = null;
            try {
                console.log(`🚀 Handling /picktable for ${gameType} with table: ${tableName}`);
                console.log('DEBUG: Starting loginToIScored...');
                const { browser: newBrowser, page } = await loginToIScored();
                browser = newBrowser;
                console.log('DEBUG: Finished loginToIScored. Starting createGame...');
                
                const pauseState = getPauseState();
                const unlockBufferHours = pauseState.isPaused ? 72 : 48;
                const confirmationMessage = pauseState.isPaused 
                    ? `✅ Thank you, ${interaction.user.toString()}! Your pick, **${newGameName}**, has been created. It will be played after the current special event game.`
                    : `✅ Thank you, ${interaction.user.toString()}! The table **${newGameName}** has been selected and created. It will be the table for the tournament in 2 days.`;

                await createGame(page, newGameName); 
                console.log('DEBUG: Finished createGame. Starting gamePicked...');

                // 3. Clear the picker designation and store the new game name
                await gamePicked(gameType, newGameName); // Replaced clearPicker
                console.log('DEBUG: Finished gamePicked. Sending editReply...');
                await interaction.editReply(confirmationMessage);
                console.log('DEBUG: Finished editReply.');

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

            const fullHistory = getHistory() as { [gameType: string]: any[] };
            const relevantResults: any[] = [];

            for (const gameType in fullHistory) {
                fullHistory[gameType].forEach(result => {
                    if (result.gameName.toLowerCase().includes(tableName.toLowerCase())) {
                        relevantResults.push(result);
                    }
                });
            }

            if (relevantResults.length === 0) {
                await interaction.editReply(`No play history found for tables matching "${tableName}".`);
                return;
            }

            const playCount = relevantResults.length;
            let highScore = 0;
            let highScoreWinner = '';

            for (const result of relevantResults) {
                const score = parseInt(result.score.replace(/,/g, ''), 10);
                if (score > highScore) {
                    highScore = score;
                    highScoreWinner = result.winner;
                }
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

            const results = getHistory(gameType) as any[]; // any[] because getHistory can return History object
            
            let filteredResults = results;
            const now = new Date();
            let filterDate: Date;

            if (period === '7d') {
                filterDate = new Date(now.setDate(now.getDate() - 7));
                filteredResults = results.filter(r => new Date(r.date) > filterDate);
            } else if (period === '30d') {
                filterDate = new Date(now.setDate(now.getDate() - 30));
                filteredResults = results.filter(r => new Date(r.date) > filterDate);
            } else if (period === '90d') {
                filterDate = new Date(now.setDate(now.getDate() - 90));
                filteredResults = results.filter(r => new Date(r.date) > filterDate);
            } // 'all' period does not require filtering

            if (filteredResults.length === 0) {
                await interaction.editReply(`No wins recorded for ${gameType} in the selected period.`);
                return;
            }

            const winCounts: { [winner: string]: number } = {};
            for (const result of filteredResults) {
                winCounts[result.winner] = (winCounts[result.winner] || 0) + 1;
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
        
        else if (commandName === 'trigger-maintenance') {
            await interaction.deferReply({ ephemeral: true });

            // 1. Check for Mod Role
            const modRoleId = process.env.MOD_ROLE_ID;
            console.log(`Debug: MOD_ROLE_ID from env (in trigger-maintenance handler): ${modRoleId}`);
            if (!modRoleId) {
                await interaction.editReply('The MOD_ROLE_ID is not configured. Please contact an admin.');
                return;
            }
            
            const memberRoles = interaction.member?.roles as any; // any is not ideal, but discord.js v14 types are complex
            if (!memberRoles || !memberRoles.cache.has(modRoleId)) {
                await interaction.editReply('You do not have permission to use this command.');
                return;
            }

            // 2. Trigger maintenance
            try {
                await triggerAllMaintenanceRoutines();
                await interaction.editReply('✅ All maintenance routines have been manually triggered and completed.');
            } catch (error) {
                console.error('❌ Error manually triggering maintenance routines:', error);
                await interaction.editReply('❌ An error occurred while trying to manually trigger maintenance routines.');
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
            await interaction.deferReply();

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
                    await interaction.followUp(messageChunks[i]);
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
            const lastWinner = getLastWinner(gameType);
            const nominatorIscoredName = getIscoredNameByDiscordId(nominatorUser.id);

            if (!lastWinner || !nominatorIscoredName || lastWinner.toLowerCase() !== nominatorIscoredName.toLowerCase()) {
                await interaction.editReply(`You are not the last winner for the ${gameType} tournament, so you cannot nominate a picker.`);
                return;
            }

            // 2. Check if a picker has already been nominated
            const currentPicker = getPicker(gameType);
            if (currentPicker && currentPicker.pickerDiscordId) {
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
