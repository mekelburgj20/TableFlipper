# TableFlipper Bot Setup Instructions

This guide explains how to set up and run the TableFlipper bot for managing your "Daily Grind" pinball league.

## 1. Prerequisites

*   **Node.js:** Ensure you have Node.js version 18.x or higher installed. You can download it from [nodejs.org](https://nodejs.org/).
*   **Git:** You will need Git to clone the repository.

## 2. Setup

1.  **Clone the Repository:**
    ```bash
    git clone <your-repo-url>
    cd TableFlipper
    ```

2.  **Install Dependencies:**
    Run the following command to install all the necessary packages defined in `package.json`.
    ```bash
    npm install
    ```
    This will also download the necessary browser binaries for Playwright.

3.  **Configure Environment Variables:**
    Create a file named `.env` in the root of the project directory by copying the example file:
    ```bash
    cp .env.example .env
    ```
    Now, open the `.env` file and fill in your specific credentials:
    *   `ISCORED_USERNAME`: Your iScored admin username.
    *   `ISCORED_PASSWORD`: Your iScored admin password.
    *   `GAMEROOM_NAME`: Your iScored gameroom name (e.g., "mekelburgj").
    *   `DISCORD_WEBHOOK_URL`: The full URL for your Discord channel's webhook.
    *   `DISCORD_BOT_TOKEN`: The token for your Discord bot (required for Phase 2).

## 3. Running the Bot

The bot has two primary functions: the nightly maintenance cron job and the interactive Discord bot for picking tables. Both are managed by the main script.

### Development Mode

To run the bot in development mode with hot-reloading (which will restart the script when you make changes), use:
```bash
npm run dev
```
The nightly maintenance task will be scheduled, and the Discord bot will attempt to log in if a token is provided.

### Production Mode

For a production environment, it's best to use a process manager like **PM2** to ensure the bot runs continuously and restarts automatically if it crashes.

1.  **Install PM2:**
    If you don't have PM2 installed, get it globally:
    ```bash
    npm install -g pm2
    ```

2.  **Build the Project:**
    First, compile the TypeScript code into JavaScript:
    ```bash
    npm run build
    ```
    This will create a `dist` folder with the compiled code.

3.  **Start with PM2:**
    Start the main application using PM2:
    ```bash
    pm2 start dist/index.js --name "TableFlipper"
    ```

4.  **Managing the Process:**
    *   To see the status and logs: `pm2 status` and `pm2 logs TableFlipper`
    *   To stop the bot: `pm2 stop TableFlipper`
    *   To restart the bot: `pm2 restart TableFlipper`
    *   To make PM2 restart on server reboot: `pm2 startup` (follow the on-screen instructions).

The cron job defined in `src/index.ts` will automatically execute every night at 10:00 PM Central Time. As long as the main process is running with PM2, the schedule will be active.