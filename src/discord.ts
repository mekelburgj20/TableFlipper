interface NotificationParams {
    winner: string;
    winnerId: string | null; // Discord User ID
    score: string;
    activeGame: string;
    nextGame: string;
    gameType: string;
    isRepeatWinner: boolean;
    customMessage?: string;
}

/**
 * Sends a formatted notification to the Discord webhook.
 * @param params The parameters for the notification message.
 */
export async function sendDiscordNotification(params: NotificationParams) {
    console.log('📢 Sending Discord notification...');
    
    // Determine which webhook to use based on gameType
    let webhookUrl = process.env.DISCORD_WEBHOOK_URL; // Default fallback

    if (params.gameType === 'DG' && process.env.DISCORD_WEBHOOK_URL_DG) {
        webhookUrl = process.env.DISCORD_WEBHOOK_URL_DG;
    } else if (params.gameType === 'WG-VPXS' && process.env.DISCORD_WEBHOOK_URL_WG_VPXS) {
        webhookUrl = process.env.DISCORD_WEBHOOK_URL_WG_VPXS;
    } else if (params.gameType === 'WG-VR' && process.env.DISCORD_WEBHOOK_URL_WG_VR) {
        webhookUrl = process.env.DISCORD_WEBHOOK_URL_WG_VR;
    } else if (params.gameType === 'MG' && process.env.DISCORD_WEBHOOK_URL_MG) {
        webhookUrl = process.env.DISCORD_WEBHOOK_URL_MG;
    }

    if (!webhookUrl || webhookUrl === 'your_discord_webhook_url') {
        console.error('⚠️ Discord webhook URL not configured. Skipping notification.');
        return;
    }

    let message: string;

    if (params.customMessage) {
        message = params.customMessage;
    } else {
        const { winner, winnerId, score, activeGame, nextGame, gameType, isRepeatWinner } = params;
        const winnerMention = winnerId ? `<@${winnerId}>` : `\`${winner}\``;

        const typeNames: Record<string, string> = {
            'DG': 'Daily Grind',
            'WG-VPXS': 'Weekly Grind (VPXS)',
            'WG-VR': 'Weekly Grind (VR)',
            'MG': 'Monthly Grind'
        };
        const typeName = typeNames[gameType] || gameType;

        const messageLines = [
            `**The ${typeName} is Closed!**`,
            `**Game:** \`${activeGame}\``,
            `**Winner:** ${winnerMention} with a score of \`${score}\``,
            `**Open Now:** \`${nextGame}\` is ready for play!`,
        ];

        if (isRepeatWinner) {
            messageLines.push(
                `\n**Dynasty Rule Alert!** As a repeat winner, you must nominate another player to choose the next table.`,
                `Use the \`/nominate-picker grind-type:<grind-type> user:<@user>\` command.`
            );
        } else if (winnerId) {
            messageLines.push(
                `\n${winnerMention}, it's your turn to pick the next table! Use the \`/picktable <game_name>\` command.`
            );
        } else if (winner !== 'N/A') {
            // This case handles when the winner mapping doesn't exist yet.
            messageLines.push(
                `\nCongratulations ${winner}! We need to map your iScored name to your Discord ID. Please contact an admin.`
            );
        }
        message = messageLines.join('\n');
    }

    const payload = {
        content: message,
    };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
