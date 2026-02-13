import { REST, Routes } from 'discord.js';
import 'dotenv/config';

const commands = [
    {
        name: 'ping',
        description: 'Replies with Pong!',
    },
    {
        name: 'picktable',
        description: 'Allows the previous winner to pick the next table.',
        options: [
            {
                name: 'grind-type',
                type: 3, // STRING
                description: 'The type of tournament you are picking for.',
                required: true,
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
        name: 'table-stats',
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
        description: 'Lists past winners for a tournament.',
        options: [
            {
                name: 'grind-type',
                type: 3, // STRING
                description: 'The tournament to get the winner list for.',
                required: true,
                choices: [
                    { name: 'Daily Grind (DG)', value: 'DG' },
                    { name: 'Weekly Grind VPXS (WG-VPXS)', value: 'WG-VPXS' },
                    { name: 'Weekly Grind VR (WG-VR)', value: 'WG-VR' },
                    { name: 'Monthly Grind (MG)', value: 'MG' },
                ]
            },
            {
                name: 'period',
                type: 3, // STRING
                description: 'The time period to filter winners by. (Default: 7d)',
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
        name: 'trigger-maintenance-dg',
        description: 'Manually triggers the maintenance routine for the Daily Grind (DG).',
    },
    {
        name: 'trigger-maintenance-weekly',
        description: 'Manually triggers the maintenance routine for all Weekly Grinds (WG-VPXS, WG-VR).',
    },
    {
        name: 'trigger-maintenance-monthly',
        description: 'Manually triggers the maintenance routine for the Monthly Grind (MG).',
    },
    {
        name: 'pause-dg-pick',
        description: 'Pauses the winner pick and sets a special game for the next cycle.',
        options: [
            {
                name: 'special-game-name',
                type: 3, // STRING
                description: 'The name of the special game to be played.',
                required: true,
            },
            {
                name: 'duration-hours',
                type: 4, // INTEGER
                description: 'How many hours the pause should last. Default is 24.',
                required: false,
            }
        ]
    },
    {
        name: 'current-dg-scores',
        description: 'View the current standings for a tournament.',
        options: [
            {
                name: 'grind-type',
                type: 3, // STRING
                description: 'The tournament to get scores for.',
                required: true,
                choices: [
                    { name: 'Daily Grind (DG)', value: 'DG' },
                    { name: 'Weekly Grind VPXS (WG-VPXS)', value: 'WG-VPXS' },
                    { name: 'Weekly Grind VR (WG-VR)', value: 'WG-VR' },
                    { name: 'Monthly Grind (MG)', value: 'MG' },
                ]
            }
        ]
    },
    {
        name: 'dg-table-selection',
        description: 'Lists the available tables to pick from for the Daily Grind.',
    },
    {
        name: 'nominate-picker',
        description: 'Allows a repeat winner to nominate another player to pick the next table.',
        options: [
            {
                name: 'grind-type',
                type: 3, // STRING
                description: 'The type of tournament you are nominating for.',
                required: true,
                choices: [
                    { name: 'Daily Grind (DG)', value: 'DG' },
                    { name: 'Weekly Grind VPXS (WG-VPXS)', value: 'WG-VPXS' },
                    { name: 'Weekly Grind VR (WG-VR)', value: 'WG-VR' },
                    { name: 'Monthly Grind (MG)', value: 'MG' },
                ]
            },
            {
                name: 'user',
                type: 6, // USER
                description: 'The user you want to nominate to pick the next table.',
                required: true,
            },
        ],
    },
    {
        name: 'submit-score',
        description: 'Submit your tournament score and a photo for validation.',
        options: [
            {
                name: 'grind-type',
                type: 3, // STRING
                description: 'The type of tournament you are submitting a score for.',
                required: true,
                choices: [
                    { name: 'Daily Grind (DG)', value: 'DG' },
                    { name: 'Weekly Grind VPXS (WG-VPXS)', value: 'WG-VPXS' },
                    { name: 'Weekly Grind VR (WG-VR)', value: 'WG-VR' },
                    { name: 'Monthly Grind (MG)', value: 'MG' },
                ]
            },
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
        ],
    },
    {
        name: 'list-active',
        description: 'Shows the currently active table for a tournament.',
        options: [
            {
                name: 'grind-type',
                type: 3, // STRING
                description: 'The tournament to check.',
                required: true,
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
