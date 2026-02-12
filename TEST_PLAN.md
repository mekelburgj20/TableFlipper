# TableFlipper - Master Test Plan

This document outlines the procedures for validating the full functionality of the TableFlipper bot. It includes automated tests for backend logic and manual steps for verifying Discord and iScored integrations.

## Part 1: Automated Backend Tests

These scripts verify the internal logic, database integrity, and external API connections.

### 1. Database Logic
Verifies that tables can be created, updated, and queried, and that the game lifecycle (Queued -> Active -> Completed) works as expected.
```bash
npm run test:db
```
**Expected Result:** "🎉 All Database Tests Passed!"

### 2. iScored Connection
Verifies that the bot can launch a headless browser, navigate to iScored.info, and log in successfully with the provided credentials.
```bash
npm run test:iscored
```
**Expected Result:** "✅ Login successful!"

### 3. Google Sheets Sync
Verifies that the bot can fetch and parse the table list from the configured Google Sheet.
```bash
npm run test:sheets
```
**Expected Result:** "✅ Successfully fetched X tables."

---

## Part 2: Manual Discord & Integration Testing

These steps require interacting with the bot in your Discord server.

### 1. Table Selection & Autocomplete
**Goal:** Verify that `/picktable` suggests the correct tables and filters invalid ones.

*   **Test A: Daily Grind (DG)**
    1.  Type `/picktable game-type: Daily Grind (DG)`.
    2.  Click `table-name` and type `Aero`.
    3.  **Verify:** You see "Aerobatics" (if marked for AtGames).
    4.  Type a nonsense name (e.g. `XYz123`) and submit.
    5.  **Verify:** Bot rejects it with an error message.

*   **Test B: Weekly Grind VPXS (WG-VPXS)**
    1.  Type `/picktable game-type: Weekly Grind VPXS`.
    2.  Click `table-name` (leave blank).
    3.  **Verify:** The list ONLY shows VPXS-compatible tables (e.g. "Africa" should NOT appear if `wg-vpxs=0`).

*   **Test C: Monthly Grind (MG)**
    1.  Type `/picktable game-type: Monthly Grind`.
    2.  Type any random text for `table-name`.
    3.  **Verify:** Bot accepts it (MG has no strict validation).

*   **Test D: Surprise Me**
    1.  Type `/picktable game-type: Daily Grind (DG) surprise-me: True`.
    2.  Leave `table-name` blank.
    3.  **Verify:** Bot replies "Fate has chosen: [Random Table]. Do you want to proceed?" with Yes/No buttons.
    4.  Click **No**.
    5.  **Verify:** Bot says "Selection cancelled."
    6.  Run it again and Click **Yes**.
    7.  **Verify:** Bot proceeds to create the game.

### 2. Viewing the Table List
**Goal:** Verify the ephemeral list command.

1.  Type `/dg-table-selection`.
2.  **Verify:** A long list of tables appears.
3.  **Verify:** The message says "Only you can see this" (Ephemeral).

### 3. Score Submission
**Goal:** Verify score submission flow.

1.  Wait for an active game to be present (or use maintenance trigger to cycle one).
2.  Type `/submitscore-dg`.
3.  Fill in Score, Attach a dummy image, and enter your iScored Username.
4.  **Verify:** Bot replies "Received your score... Submission to iScored successful!".
5.  **Verify:** Check iScored.info to see if the score appears on the dashboard.

### 4. Maintenance Triggers
**Goal:** Verify that games rotate correctly.

*   **Test A: Trigger DG Maintenance**
    1.  Run `/trigger-maintenance-dg`.
    2.  **Verify:**
        *   Current active DG game is Locked on iScored.
        *   Winner is announced in Discord.
        *   Next queued game becomes Active (Visible) on iScored.
        *   Bot confirms completion.

*   **Test B: Trigger Weekly/Monthly**
    1.  Run `/trigger-maintenance-weekly` or `/trigger-maintenance-monthly`.
    2.  **Verify:** Similar rotation occurs for the respective tournament type.

### 5. Statistics
**Goal:** Verify reporting commands.

1.  Run `/list-winners game-type: Daily Grind period: All Time`.
2.  **Verify:** A leaderboard of winners is displayed.
3.  Run `/table-stats table-name: [A known table]`.
4.  **Verify:** Play count and high score are displayed.

---

## Part 3: Full System Reset (Optional)

If you need to verify a clean slate installation:

1.  Stop the bot.
2.  Delete `data/tableflipper.db`.
3.  Run `npm run sync-tables`.
4.  Start the bot `npm run dev`.
5.  Run a maintenance trigger to seed the initial games.
