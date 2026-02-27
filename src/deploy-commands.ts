import { REST, Routes } from 'discord.js';
import 'dotenv/config';

const commands = [
    {
        name: 'check-ping',
        description: 'Replies with Pong!',
    },
    {
        name: 'pick-table',
        description: 'Allows the previous winner to pick the next table.',
        options: [
            {
                name: 'grind-type',
                type: 3, // STRING
                description: 'The type of tournament you are picking for.',
                required: false,
                choices: [
                    { name: 'Daily Grind (DG)', value: 'DG' },
                    { name: 'Weekly Grind VPXS (WG-VPXS)', value: 'WG-VPXS' },
                    { name: 'Weekly Grind VR (WG-VR)', value: 'WG-VR' },
                    { name: 'Monthly Grind (MG)', value: 'MG' },
                ]
            },
            {
                name: 'table-name',
                type: 3, // STRING
                description: 'The name of the pinball table to play next.',
                required: false,
                autocomplete: true,
            },
            {
                name: 'surprise-me',
                type: 5, // BOOLEAN
                description: 'Let the bot pick a random valid table for you.',
                required: false,
            },
        ],
    },
    {
        name: 'view-stats',
        description: 'Shows statistics for a specific table.',
        options: [
            {
                name: 'table-name',
                type: 3, // STRING
                description: 'The name of the table to get stats for.',
                required: true,
            }
        ]
    },
    {
        name: 'list-winners',
        description: 'Lists past winners or a leaderboard for tournaments.',
        options: [
            {
                name: 'view',
                type: 3, // STRING
                description: 'The type of list to show (default: Recent).',
                required: false,
                choices: [
                    { name: 'Recent Results', value: 'recent' },
                    { name: 'Leaderboard', value: 'leaderboard' },
                ]
            },
            {
                name: 'grind-type',
                type: 3, // STRING
                description: 'The tournament to filter by (optional).',
                required: false,
                choices: [
                    { name: 'Daily Grind (DG)', value: 'DG' },
                    { name: 'Weekly Grind VPXS (WG-VPXS)', value: 'WG-VPXS' },
                    { name: 'Weekly Grind VR (WG-VR)', value: 'WG-VR' },
                    { name: 'Monthly Grind (MG)', value: 'MG' },
                ]
            },
            {
                name: 'limit',
                type: 4, // INTEGER
                description: 'Number of recent winners to show (default 5).',
                required: false,
            },
            {
                name: 'period',
                type: 3, // STRING
                description: 'Time period for Leaderboard (default 7d).',
                required: false,
                choices: [
                    { name: 'Last 7 Days', value: '7d' },
                    { name: 'Last 30 Days', value: '30d' },
                    { name: 'Last 90 Days', value: '90d' },
                    { name: 'All Time', value: 'all' },
                ]
            }
        ]
    },
    {
        name: 'run-maintenance-dg',
        description: 'Manually triggers the maintenance routine for the Daily Grind (DG).',
    },
    {
        name: 'run-maintenance-weekly',
        description: 'Manually triggers the maintenance routine for all Weekly Grinds (WG-VPXS, WG-VR).',
    },
    {
        name: 'run-maintenance-monthly',
        description: 'Manually triggers the maintenance routine for the Monthly Grind (MG).',
    },
    {
        name: 'sync-state',
        description: 'Manually synchronizes the local database with the live state on iScored.',
    },
    {
        name: 'run-cleanup',
        description: 'Manually triggers the cleanup routine (delete old locked games) for tournaments.',
        options: [
            {
                name: 'grind-type',
                type: 3, // STRING
                description: 'The tournament to cleanup (leave blank for all).',
                required: false,
                choices: [
                    { name: 'All Tournaments', value: 'ALL' },
                    { name: 'Daily Grind (DG)', value: 'DG' },
                    { name: 'Weekly Grind VPXS (WG-VPXS)', value: 'WG-VPXS' },
                    { name: 'Weekly Grind VR (WG-VR)', value: 'WG-VR' },
                    { name: 'Monthly Grind (MG)', value: 'MG' },
                ]
            }
        ]
    },
    {
        name: 'create-backup',
        description: 'Create a full backup of the current state (DB, scores, photos).',
    },
    {
        name: 'pause-pick',
        description: 'Pauses the winner pick and sets a special game for the next cycle.',
        options: [
            {
                name: 'special-game-name',
                type: 3, // STRING
                description: 'The name of the special game to be played.',
                required: true,
            }
        ]
    },
    {
        name: 'list-scores',
        description: 'View current standings. Leave options blank to see all active grinds.',
        options: [
            {
                name: 'grind-type',
                type: 3, // STRING
                description: 'Filter standings by tournament type.',
                required: false,
                choices: [
                    { name: 'Daily Grind (DG)', value: 'DG' },
                    { name: 'Weekly Grind VPXS (WG-VPXS)', value: 'WG-VPXS' },
                    { name: 'Weekly Grind VR (WG-VR)', value: 'WG-VR' },
                    { name: 'Monthly Grind (MG)', value: 'MG' },
                ]
            },
            {
                name: 'table-name',
                type: 3, // STRING
                description: 'Filter standings by a specific table name.',
                required: false,
                autocomplete: true,
            },
        ]
    },
    {
        name: 'view-selection',
        description: 'Lists the available tables to pick from for the Daily Grind.',
    },
    {
        name: 'nominate-picker',
        description: 'Allows a repeat winner to nominate another player to pick the next table.',
        options: [
            {
                name: 'user',
                type: 6, // USER
                description: 'The user you want to nominate to pick the next table.',
                required: true,
            },
            {
                name: 'grind-type',
                type: 3, // STRING
                description: 'The type of tournament you are nominating for.',
                required: false,
                choices: [
                    { name: 'Daily Grind (DG)', value: 'DG' },
                    { name: 'Weekly Grind VPXS (WG-VPXS)', value: 'WG-VPXS' },
                    { name: 'Weekly Grind VR (WG-VR)', value: 'WG-VR' },
                    { name: 'Monthly Grind (MG)', value: 'MG' },
                ]
            },
        ],
    },
    {
        name: 'submit-score',
        description: 'Submit your tournament score and a photo for validation.',
        options: [
            {
                name: 'score',
                type: 4, // INTEGER
                description: 'Your score for the tournament.',
                required: true,
            },
            {
                name: 'photo',
                type: 11, // ATTACHMENT
                description: 'A photo of your score for validation.',
                required: true,
            },
            {
                name: 'iscored_username',
                type: 3, // STRING
                description: 'Your iScored username.',
                required: true,
            },
            {
                name: 'grind-type',
                type: 3, // STRING
                description: 'Submit score to the active table for this grind type.',
                required: false,
                choices: [
                    { name: 'Daily Grind (DG)', value: 'DG' },
                    { name: 'Weekly Grind VPXS (WG-VPXS)', value: 'WG-VPXS' },
                    { name: 'Weekly Grind VR (WG-VR)', value: 'WG-VR' },
                    { name: 'Monthly Grind (MG)', value: 'MG' },
                ]
            },
            {
                name: 'table-name',
                type: 3, // STRING
                description: 'Submit score to a specific active table by name.',
                required: false,
                autocomplete: true,
            },
        ],
    },
    {
        name: 'map-user',
        description: 'Manually map an iScored username to a Discord ID.',
        options: [
            {
                name: 'iscored-username',
                type: 3, // STRING
                description: 'The username exactly as it appears on iScored.',
                required: true,
            },
            {
                name: 'discord-user',
                type: 6, // USER
                description: 'The Discord user to map to.',
                required: true,
            }
        ]
    },
    {
        name: 'list-active',
        description: 'Shows the currently active table for a tournament.',
        options: [
            {
                name: 'grind-type',
                type: 3, // STRING
                description: 'The tournament to check.',
                required: false,
                choices: [
                    { name: 'Daily Grind (DG)', value: 'DG' },
                    { name: 'Weekly Grind VPXS (WG-VPXS)', value: 'WG-VPXS' },
                    { name: 'Weekly Grind VR (WG-VR)', value: 'WG-VR' },
                    { name: 'Monthly Grind (MG)', value: 'MG' },
                ]
            }
        ]
    },
];

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
    throw new Error('Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID in .env file.');
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
