# TableFlipper - iScored Tournament Discord Bot

## 1. Project Overview

TableFlipper is a Node.js Discord bot designed to automate and manage pinball tournaments hosted on the iScored.info platform. It supports Daily, Weekly, and Monthly tournament formats, automating score submission, game rotation, winner announcements, and providing rich user interaction through slash commands. The bot leverages Playwright for robust browser automation and interaction with iScored.info.

## 2. Features

*   **Automated Tournament Management:**
    *   **Multi-Format Support:** Manages Daily Grind (`DG`), Weekly Grinds (`WG-VPXS`, `WG-VR`), and Monthly Grind (`MG`) tournaments.
    *   **Scheduled Maintenance:** Automatically and reliably locks completed games, accurately determines winners, unlocks new games, and sends Discord announcements based on predefined schedules (e.g., daily at 12 AM Central, weekly on Wednesdays, monthly on the 1st).
    *   **Manual Trigger:** Maintenance routines can be manually triggered via a CLI command (`npm run dev -- --trigger-maintenance`) or moderator-restricted Discord slash commands (`/trigger-maintenance-dg`, `/trigger-maintenance-weekly`, `/trigger-maintenance-monthly`).
*   **Dynamic Winner Picking Flow:**
    *   **Winner Picking Rights:** Tournament winners are granted the exclusive right to pick the next table (for play two days in advance).
    *   **Dynasty Rule Enforcement:** Prevents consecutive wins from giving picking rights to the same player. Repeat winners must `/nominate-picker` another user.
    *   **Picker Timeout:** If a designated picker or nominee fails to select a table within 12 hours, the bot automatically selects a random table from a predefined list.
*   **Comprehensive Discord Slash Commands:**
    *   **`/submit-score [grind-type] [score] [photo] [iscored_username]`**: Submit your score and a photo for validation for a specific tournament.
    *   **`/picktable [grind-type] [table-name]`**: Allows the designated winner to choose the next table for a tournament. Includes strict platform filtering (e.g., only shows VPXS-compatible tables for WG-VPXS).
    *   **`/nominate-picker [grind-type] [user]`**: Allows a repeat winner to nominate another player to pick the table.
    *   **`/list-winners [grind-type] (period)`**: Lists past winners for a specified tournament and period (e.g., last 7 days, 30 days, 90 days, all time).
    *   **`/table-stats [table-name]`**: Displays play count and high score records for a specific pinball table from historical data.
    *   **`/current-dg-scores [grind-type]`**: Shows the live leaderboard for the active game of a specified tournament, displayed ephemerally.
    *   **`/dg-table-selection`**: Lists all available pinball tables for selection, pulled from a Google Sheet.
    *   **`/pause-dg-pick [special-game-name] (duration-hours)`**: (Moderator only) Pauses regular picking and schedules a special game.
*   **User Mapping:** Maintains a JSON-based mapping between Discord user IDs and iScored usernames for seamless score submissions.
*   **Robust Data Management:** Stores all tournament history (game played, winner, score, date) and game state in a SQLite database for reporting, analysis, and robust state management.

## 3. Setup and Installation

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm (usually installed with Node.js)
*   A registered Discord Bot application with a token and client ID.
*   An administrator account for your iScored.info arcade.
*   A publicly accessible Google Sheet containing your list of pinball tables.
*   A Discord Role ID for moderators (for restricted commands).

### Installation Steps

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd TableFlipper
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root of the project by copying the `.env.example` file:
    ```bash
    cp .env.example .env
    ```
    Edit the `.env` file with your specific credentials and configurations:
    ```
    # iScored Credentials
    ISCORED_USERNAME="your_iscored_admin_username"
    ISCORED_PASSWORD="your_iscored_admin_password"
    GAMEROOM_NAME="your_iscored_gameroom_name"
    ISCORED_PUBLIC_URL="https://iscored.info/your_gameroom_path" # e.g., https://iscored.info/myarcade

    # Discord Configuration
    DISCORD_WEBHOOK_URL="your_discord_webhook_url"
    DISCORD_BOT_TOKEN="your_discord_bot_token"
    DISCORD_CLIENT_ID="your_discord_bot_client_id"
    MOD_ROLE_ID="your_discord_mod_role_id" # The ID of the Discord role that can use moderator commands

    # Google Sheets Configuration (for /dg-table-selection)
    GOOGLE_SHEET_ID="your_google_sheet_id"
    // The GID is the number at the end of the URL from the sheet tab you want to use.
    GOOGLE_SHEET_GID="your_google_sheet_gid"
    ```

## 4. Usage

### Running the Bot

To start the bot in development mode, which compiles the TypeScript files and then runs the bot, use:
```bash
npm run dev
```

### Deploying Slash Commands

Before the bot's slash commands are available in your Discord server, you need to deploy them. You only need to run this command once, or whenever you add or modify a command.

```bash
npm run deploy-commands
```

### Manual Maintenance Trigger

To manually trigger all maintenance routines (simulating the daily/weekly/monthly schedules), you can use:

From the CLI:
```bash
npm run dev -- --trigger-maintenance
```

From Discord (for authorized users):
```
/trigger-maintenance
```

### Google Sheet & Table Sync

To populate the database with the list of valid tables for the Daily Grind:

1.  **Prepare your Google Sheet:** Ensure your sheet is "Shared with anyone with the link" and has the following headers in Row 1:
    *   `Table Name` (Required)
    *   `atgames` (Mark with `x`, `TRUE`, or `1` if compatible)
    *   `wg-vr` (Mark with `x`, `TRUE`, or `1` if compatible)
    *   `wg-vpxs` (Mark with `x`, `TRUE`, or `1` if compatible)
    *   `aliases` (Optional)

2.  **Configure .env:** Set `GOOGLE_SHEET_ID` and `GOOGLE_SHEET_GID` in your `.env` file.

3.  **Run Sync Script:**
    ```bash
    npm run sync-tables
    ```
    This must be run manually whenever you add new tables to the Google Sheet.

### Interacting with the Bot

All primary interaction with the bot is through its Discord slash commands. Refer to the command list above for details.

## 5. Project Structure

*   `src/`: Contains all the TypeScript source code.
    *   `index.ts`: The main entry point. Initializes Discord bot, schedules cron jobs, and handles CLI manual trigger.
    *   `discordBot.ts`: Manages Discord bot client, registers and handles slash commands.
    *   `maintenance.ts`: Contains the core logic for the maintenance routines (locking/unlocking games, winner processing, etc.).
    *   `iscored.ts`: Handles all Playwright browser automation and interaction with iScored.info.
    *   `api.ts`: Functions for scraping public iScored data (standings, winners).
    *   `history.ts`: Manages persistent storage of tournament results in the SQLite database.
    *   `userMapping.ts`: Manages mapping between Discord user IDs and iScored usernames.
    *   `scheduler.ts`: Manages future game unlocks (used by `createGame`).
    *   `timeout.ts`: Contains logic for checking and handling picker timeouts.
    *   `database.ts`: Handles the SQLite database connection, schema, and core CRUD operations for games and winners.
    *   `deploy-commands.ts`: Script for registering slash commands with Discord.*   `.env`: Stores confidential environment variables (ignored by git).
*   `package.json`: Defines project dependencies and scripts.
*   `tsconfig.json`: TypeScript compiler configuration.
