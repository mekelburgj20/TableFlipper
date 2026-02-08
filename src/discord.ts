interface NotificationParams {
    winner: string;
    winnerId: string | null; // Discord User ID
    score: string;
    activeGame: string;
    nextGame: string;
    isRepeatWinner: boolean;
}

/**
 * Sends a formatted notification to the Discord webhook.
 * @param params The parameters for the notification message.
 */
export async function sendDiscordNotification(params: NotificationParams) {
    console.log('📢 Sending Discord notification...');
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl || webhookUrl === 'your_discord_webhook_url') {
        console.error('⚠️ Discord webhook URL not configured. Skipping notification.');
        return;
    }

    const { winner, winnerId, score, activeGame, nextGame, isRepeatWinner } = params;

    const winnerMention = winnerId ? `<@${winnerId}>` : `\`${winner}\``;

    const messageLines = [
        `**🛑 The Daily Grind is Closed! 🛑**`,
        `**Game:** \`${activeGame}\``,
        `👑 **Winner:** ${winnerMention} with a score of \`${score}\``,
        `✅ **Open Now:** \`${nextGame}\` is ready for play!`,
    ];

    if (isRepeatWinner) {
        messageLines.push(
            `\n⚠️ **Dynasty Rule Alert!** As a repeat winner, you must nominate another player to choose the next table.`,
            `Use the \`/nominate-picker game-type:<game-type> user:<@user>\` command.`
        );
    } else if (winnerId) {
        messageLines.push(
            `\n${winnerMention}, it's your turn to pick the next table! Use the \`/picktable <game_name>\` command.`
        );
    } else {
        // This case handles when the winner mapping doesn't exist yet.
        messageLines.push(
            `\nCongratulations ${winner}! We need to map your iScored name to your Discord ID. Please contact an admin.`
        );
    }

    const payload = {
        content: messageLines.join('\n'),
        // We can also add 'allowed_mentions' to control pinging if needed
        // "allowed_mentions": {
        //   "users": winnerId ? [winnerId] : []
        // }
    };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Discord API responded with status ${response.status}`);
        }

        console.log('✅ Discord notification sent successfully.');
    } catch (error) {
        console.error('❌ Error sending Discord notification:', error);
    }
}

export async function sendTimeoutNotification(gameType: string, newGameName: string) {
    console.log('📢 Sending picker timeout notification...');
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl || webhookUrl === 'your_discord_webhook_url') {
        console.error('⚠️ Discord webhook URL not configured. Skipping notification.');
        return;
    }

    const messageLines = [
        `**⏰ Picker Timed Out for ${gameType}!**`,
        `The designated picker did not choose a table within the 12-hour limit.`,
        `A random table has been selected: **${newGameName}**`,
        `This table will be in the lineup in 2 days.`
    ];

    const payload = {
        content: messageLines.join('\n'),
    };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Discord API responded with status ${response.status}`);
        }

        console.log('✅ Timeout notification sent successfully.');
    } catch (error) {
        console.error('❌ Error sending timeout notification:', error);
    }
}
