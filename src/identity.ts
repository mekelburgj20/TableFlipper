import { Guild, TextChannel, Message } from 'discord.js';
import { getStandingsFromApi } from './api.js';
import { dbAddUserMapping, dbGetDiscordIdByIscoredName, filterUnmappedUsers, getAllActiveGames } from './database.js';
import { logInfo, logError, logWarn } from './logger.js';

/**
 * Scrapes all active games and attempts to auto-map any unmapped iScored users
 * by searching for matching usernames/nicknames in the Discord guild.
 */
export async function reconcileUserMappings(guild: Guild) {
    logInfo('🔍 Starting proactive identity mapping scrape...');
    
    try {
        // 1. Get all active games
        const activeGames = await getAllActiveGames();
        if (activeGames.length === 0) {
            logInfo('   -> No active games to scrape.');
            return;
        }

        // 2. Gather all unique iScored usernames from standings
        const allUsernames = new Set<string>();
        for (const game of activeGames) {
            const standings = await getStandingsFromApi(game.name);
            standings.forEach(s => allUsernames.add(s.name));
        }

        const uniqueUsernames = Array.from(allUsernames);
        logInfo(`   -> Found ${uniqueUsernames.length} unique iScored users across active games.`);

        // 3. Filter for those NOT in our database
        const unmappedNames = await filterUnmappedUsers(uniqueUsernames);
        if (unmappedNames.length === 0) {
            logInfo('   -> All active users are already mapped.');
            return;
        }

        logInfo(`   -> Attempting to auto-map ${unmappedNames.length} users: ${unmappedNames.join(', ')}`);

        // 4. Try to fetch all guild members for searching (might fail without intent)
        try {
            await guild.members.fetch();
        } catch (e) {
            logWarn('   -> Failed to fetch all members (Privileged Intent might be missing). Searching cache only.');
        }

        for (const iscoredName of unmappedNames) {
            const searchName = iscoredName.toLowerCase();
            
            // Search criteria:
            // - Exact username match
            // - Exact nickname match
            // - Exact globalName (Display Name) match
            const match = guild.members.cache.find(m => 
                m.user.username.toLowerCase() === searchName ||
                m.nickname?.toLowerCase() === searchName ||
                m.user.globalName?.toLowerCase() === searchName
            );

            if (match) {
                logInfo(`   Auto-mapped: iScored '${iscoredName}' -> Discord @${match.user.tag}`);
                await dbAddUserMapping(iscoredName, match.id);
            } else {
                logWarn(`   ❌ No match found for iScored user: '${iscoredName}'`);
            }
        }

    } catch (error) {
        logError('❌ Error during reconcileUserMappings:', error);
    }
}

/**
 * Sends a notification to moderators if a winner is not mapped.
 */
export async function notifyUnmappedWinner(guild: Guild, iscoredName: string, grindType: string) {
    const modChannelId = process.env.MOD_CHANNEL_ID;
    if (!modChannelId) {
        logWarn('⚠️ MOD_CHANNEL_ID not set. Cannot send unmapped winner notification.');
        return;
    }

    try {
        const channel = await guild.channels.fetch(modChannelId) as TextChannel;
        if (channel) {
            const msg = `**Identity Alert:** The winner of the **${grindType}**, **${iscoredName}**, is not mapped to a Discord user.\n` +
                        `They cannot pick their next table until they are mapped using \`/map-user\`.`;
            await channel.send(msg);
        }
    } catch (e) {
        logError('❌ Failed to send mod notification:', e);
    }
}

/**
 * Sends a lead announcement with pre-pick reminders.
 */
export async function announceLeadsAndRemind(guild: Guild, channelId: string, grindType: string) {
    try {
        const channel = await guild.channels.fetch(channelId) as TextChannel;
        if (!channel) return;

        const activeGames = await getAllActiveGames();
        const grindGame = activeGames.find(g => g.type === grindType);
        
        if (!grindGame) {
            logInfo(`   -> No active game found for ${grindType} to announce leads.`);
            return;
        }

        const standings = await getStandingsFromApi(grindGame.name);
        if (standings.length < 2) return;

        const first = standings[0].name;
        const second = standings[1].name;

        const msg = `**Leaderboard Update!**\n\n` +
                    `**${first}** and **${second}** are currently in the lead for the **${grindType}**! Who can overtake them?!\n\n` +
                    `Hurry, there's still 2 hours remaining! Everyone please make sure your selection is queued up by using ` +
                    `\`/pick-table grind-type:${grindType} ...\` so that when you win, your pick is activated immediately!`;

        await channel.send(msg);

    } catch (e) {
        logError(`❌ Error during lead announcement for ${grindType}:`, e);
    }
}
