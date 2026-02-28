import { Guild, TextChannel } from 'discord.js';
import { 
    getPicker, 
    updateQueuedGame, 
    getRecentGameNames, 
    getRandomCompatibleTable,
    getRandomCompatibleTableEligible,
    updateGameStatus,
    GameRow,
    TableRow,
    dbGetDiscordIdByIscoredName,
    getPrePick,
    clearPrePick,
    checkTableEligibility,
    getTable,
    getGameById,
    incrementReminderCount,
    dbUpdatePicker
} from './database.js';
import { createGame, loginToIScored } from './iscored.js';
import { sendDiscordNotification } from './discord.js';
import { getStandingsFromApi } from './api.js';
import { logInfo, logError, logWarn } from './logger.js';
import { notifyUnmappedWinner } from './identity.js';
import * as path from 'path';

const TIMEOUT_GAME_TYPES = ['DG', 'WG-VPXS', 'WG-VR'];

export async function checkPickerTimeouts(guild: Guild | null) {
    if (!guild) {
        logWarn('⚠️ No guild provided to checkPickerTimeouts, skipping.');
        return;
    }

    logInfo('⏳ Checking for picker timeouts and reminders...');

    for (const gameType of TIMEOUT_GAME_TYPES) {
        // Updated getPicker in database.ts should now return the first slot with a picker
        const game = await getPicker(gameType);

        if (game && game.picker_designated_at) {
            await handleTieredTimeout(guild, game);
        }
    }
}

async function handleTieredTimeout(guild: Guild, game: GameRow) {
    const now = new Date();
    const designatedAt = new Date(game.picker_designated_at!);
    const elapsedMins = (now.getTime() - designatedAt.getTime()) / (1000 * 60);
    
    // Type-safe picker type
    const pickerType = game.picker_type || 'WINNER';

    if (pickerType === 'WINNER') {
        // WINNER TIMEOUT: 1 Hour (60 mins)
        if (elapsedMins >= 60) {
            logInfo(`⏰ Winner for ${game.type} has timed out after 1 hour. Pivoting to Runner-Up...`);
            await pivotToRunnerUp(guild, game);
        } else {
            // Reminders every 15 minutes
            const nextReminderInterval = (game.reminder_count! + 1) * 15;
            if (elapsedMins >= nextReminderInterval) {
                await sendPickerReminder(guild, game, 60 - Math.floor(elapsedMins));
            }
        }
    } else if (pickerType === 'RUNNER_UP') {
        // RUNNER_UP TIMEOUT: 30 Minutes
        if (elapsedMins >= 30) {
            logInfo(`⏰ Runner-Up for ${game.type} has timed out after 30 minutes. Falling back to auto-selection...`);
            await fallbackToAutoSelection(game);
        } else {
            // Reminders every 10 minutes
            const nextReminderInterval = (game.reminder_count! + 1) * 10;
            if (elapsedMins >= nextReminderInterval) {
                await sendPickerReminder(guild, game, 30 - Math.floor(elapsedMins));
            }
        }
    }
}

async function sendPickerReminder(guild: Guild, game: GameRow, minsRemaining: number) {
    try {
        const channelId = process.env.DG_CHANNEL_ID || process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID;
        if (!channelId) return;

        const channel = await guild.channels.fetch(channelId) as TextChannel;
        if (!channel) return;

        if (game.picker_discord_id) {
            const mention = `<@${game.picker_discord_id}>`;
            const pickerRole = game.picker_type === 'RUNNER_UP' ? 'Runner-Up' : 'Winner';
            
            await channel.send(`${mention}, as the **${pickerRole}**, you have **${minsRemaining} minutes** remaining to pick the next table for **${game.type}**! Use \`/pick-table\` now or the pick will pass to the ${game.picker_type === 'WINNER' ? 'runner-up' : 'bot'}.`);
        } else if (game.picker_type === 'WINNER') {
            // Unmapped winner: Try to find their name from the won game standings
            if (game.won_game_id) {
                const wonGame = await getGameById(game.won_game_id);
                if (wonGame) {
                    const standings = await getStandingsFromApi(wonGame.name);
                    const winnerName = standings[0]?.name || 'Unknown';
                    await notifyUnmappedWinner(guild, winnerName, game.type);
                }
            }
        }
        
        await incrementReminderCount(game.id);
        
    } catch (e) {
        logError('❌ Failed to send picker reminder:', e);
    }
}

async function pivotToRunnerUp(guild: Guild, game: GameRow) {
    if (!game.won_game_id) {
        logError(`❌ Cannot pivot to runner-up for ${game.type}: won_game_id is missing.`);
        await fallbackToAutoSelection(game);
        return;
    }

    try {
        // 1. Get the game name from DB to fetch standings
        const wonGame = await getGameById(game.won_game_id);

        if (!wonGame) {
             await fallbackToAutoSelection(game);
             return;
        }

        // 2. Fetch standings
        const standings = await getStandingsFromApi(wonGame.name);
        if (standings.length < 2) {
            logWarn(`⚠️ No runner-up found in standings for ${wonGame.name}. Auto-selecting.`);
            await fallbackToAutoSelection(game);
            return;
        }

        const runnerUpIscoredName = standings[1].name;
        const runnerUpDiscordId = await dbGetDiscordIdByIscoredName(runnerUpIscoredName);

        if (runnerUpDiscordId) {
            // Check for Pre-Pick
            const prePick = await getPrePick(runnerUpDiscordId, game.type);
            if (prePick) {
                const isEligible = await checkTableEligibility(prePick.table_name, game.type);
                if (isEligible) {
                    logInfo(`✨ Applying pre-pick for Runner-Up ${runnerUpIscoredName}: ${prePick.table_name}`);
                    let browser = null;
                    try {
                        const { browser: b, page } = await loginToIScored();
                        browser = b;
                        const tableData = await getTable(prePick.table_name);
                        const { id: iscoredGameId } = await createGame(page, prePick.table_name, game.type, tableData?.style_id);
                        const newStatus = game.type === 'DG' ? 'QUEUED' : 'ACTIVE';
                        await updateQueuedGame(game.id, prePick.table_name, iscoredGameId, newStatus);
                        await clearPrePick(runnerUpDiscordId, game.type);
                        
                        await sendDiscordNotification({
                            winner: runnerUpIscoredName,
                            winnerId: runnerUpDiscordId,
                            score: standings[1].score,
                            activeGame: 'None',
                            nextGame: `${prePick.table_name} ${game.type}`,
                            gameType: game.type,
                            isRepeatWinner: false,
                            customMessage: `The winner timed out. Runner-up **${runnerUpIscoredName}** had a pre-pick! **${prePick.table_name}** is the next game.`
                        });
                        return;
                    } catch (e) {
                        logError('Error applying runner-up pre-pick:', e);
                    } finally {
                        if (browser) await browser.close();
                    }
                }
            }

            // No pre-pick or it failed: Set as active picker
            await dbUpdatePicker(game.id, runnerUpDiscordId, 'RUNNER_UP');
            
            const channelId = process.env.DG_CHANNEL_ID || process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID;
            if (channelId) {
                const channel = await guild.channels.fetch(channelId) as TextChannel;
                await channel?.send(`The winner has timed out. Picking rights for **${game.type}** have passed to the runner-up: <@${runnerUpDiscordId}>! You have **30 minutes** to pick.`);
            }
        } else {
            logWarn(`⚠️ Runner-up ${runnerUpIscoredName} is not mapped to Discord. Auto-selecting.`);
            await notifyUnmappedWinner(guild, runnerUpIscoredName, game.type);
            await fallbackToAutoSelection(game);
        }

    } catch (e) {
        logError('❌ Error in pivotToRunnerUp:', e);
        await fallbackToAutoSelection(game);
    }
}

async function fallbackToAutoSelection(game: GameRow) {
    logInfo(`🤖 Triggering auto-selection for ${game.type}...`);
    let browser = null;
    try {
        let platformFilter: 'atgames' | 'vr' | 'vpxs' = 'atgames'; 
        if (game.type === 'WG-VR') platformFilter = 'vr';
        if (game.type === 'WG-VPXS') platformFilter = 'vpxs';

        const randomTableRow = await getRandomCompatibleTableEligible(platformFilter, game.type);

        if (!randomTableRow) {
            logError(`❌ No valid random table found for ${game.type}.`);
            return;
        }

        const newGameName = randomTableRow.name;
        const { browser: b, page } = await loginToIScored();
        browser = b;
        const { id: iscoredGameId } = await createGame(page, newGameName, game.type, randomTableRow.style_id);

        const newStatus = game.type === 'DG' ? 'QUEUED' : 'ACTIVE';
        await updateQueuedGame(game.id, newGameName, iscoredGameId, newStatus);

        await sendDiscordNotification({
            winner: 'N/A',
            winnerId: null,
            score: 'N/A',
            activeGame: 'None',
            nextGame: `${newGameName} ${game.type}`,
            gameType: game.type,
            isRepeatWinner: false,
            customMessage: `The picker(s) for **${game.type}** timed out.\nI have randomly selected **${newGameName}** as the next game.`
        });

    } catch (error) {
        logError(`❌ Error in fallbackToAutoSelection for ${game.type}:`, error);
    } finally {
        if (browser) await browser.close();
    }
}

