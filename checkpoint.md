<!-- AI HANDOVER PROMPT -->
**Project Status:** 
"TableFlipper" has been upgraded with a sophisticated preference-based picking system and a tiered fallback mechanism. The user identity system has transitioned to a database-backed model with automated discovery.

**Recent Work:**
1.  **Refactored `/pick-table`:** Unified the command to handle both immediate picks and "Pre-pick" queuing. Users can now set preferences at any time.
2.  **Tiered Timeout & Fallback:** Implemented a 1-hour winner window and 30-minute runner-up window. Added interval reminders (15m/10m) and automated runner-up pivoting.
3.  **Identity Discovery Engine:** Added proactive iScored-to-Discord mapping that scrapes standings 1 hour before rotation and auto-maps users via guild member search.
4.  **Calendar Year Eligibility:** Enforced a strict rule that tables cannot be repeated within the same calendar year for a given grind type.
5.  **Database Migration:** Successfully moved all user mappings into the SQLite database for better performance and reliability.

**Current Context:**
*   Picking rights are now handled via `picker_type` (WINNER/RUNNER_UP) and `won_game_id` in the DB.
*   Proactive announcements (10 PM) encourage engagement by highlighting leaders and reminding users to set their picks.
*   The bot handles unmapped winners by alerting moderators to use the new `/map-user` command.

**Next Actions:**
1.  **Pre-pick DM Notifications:** Notify users when their pre-pick is successfully applied or if it fails the yearly eligibility check during rotation.
2.  **OCR Verification:** Integrate lightweight OCR for automatic score validation.
3.  **Live Standings:** Maintain pinned, auto-updating leaderboard messages in tournament channels.

**Files to Watch:**
*   `src/timeout.ts` (Tiered timeouts & Reminders)
*   `src/identity.ts` (Mapping logic & Lead announcements)
*   `src/database.ts` (Pre-pick storage & Yearly eligibility)
*   `src/discordBot.ts` (Unified /pick-table flow)
<!-- END PROMPT -->

# Checkpoint for TableFlipper Project (Update 8)

**Date:** February 27, 2026

## Project Summary: Pre-picks, Tiered Timeouts, and Identity Discovery

This update introduces a "Set and Forget" picking system and ensures tournament continuity through a robust runner-up fallback system. The bot is now proactive, seeking out player identities and encouraging competition through scheduled announcements.

### Key Changes Implemented:

#### 1. Unified Selection Flow (Pre-picks)
*   **Persistent Preferences**: Users can now run `/pick-table` at any time to "queue" their preference for a grind.
*   **Instant Activation**: If a winner has a valid pre-pick, the bot activates it immediately upon rotation, eliminating the manual picking delay.
*   **Yearly Eligibility**: Implemented a strict check to ensure tables aren't repeated within the same calendar year, providing a fresh "season" feel every January.

#### 2. Tiered Fallback Mechanism
*   **Winner -> Runner-Up Pivot**: If a winner fails to pick within 60 minutes, the bot automatically fetches the standings and pivots picking rights to the 2nd place player.
*   **Aggressive Reminders**: Implemented interval reminders (every 15m for winners, every 10m for runner-ups) to keep the picking window top-of-mind.
*   **Auto-Selection Fallback**: If all human pickers fail, the bot selects a random compatible table that hasn't been played this year.

#### 3. Identity discovery & Mapping
*   **Proactive Mapping**: Added a scheduled job that scrapes active games 1 hour before rotation to find and map new iScored users before they potentially win.
*   **Guild Member Search**: The bot now searches the Discord server for usernames and nicknames that match iScored profiles to auto-link accounts.
*   **Moderator Tools**: Added `/map-user` to allow admins to resolve identity conflicts manually.

#### 4. Scheduled Engagement
*   **Lead Announcements**: Daily at 10 PM, the bot highlights the top two players for the Daily Grind and reminds everyone to set their table selections.
*   **Identity Syncs**: Strategic identity scrapes scheduled before DG, WG, and MG rotations.

## Final Status
TableFlipper is now a "proactive" bot that minimizes manual intervention. By managing user identities and table preferences in advance, the bot ensures that tournament rotations are smooth, timely, and visually consistent.
