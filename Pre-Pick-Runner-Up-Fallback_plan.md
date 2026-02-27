# Feature Plan: Pre-pick Queue & Runner-Up Fallback

## 1. Objective
Enhance the TableFlipper tournament experience by allowing users to set table preferences in advance, implementing a robust fallback system when winners are unresponsive, and proactively mapping iScored identities to Discord.

## 2. Database Schema Changes
### New Tables
- `user_mappings`: Moves mapping out of JSON for better querying.
  - `iscored_username` (PK), `discord_user_id`
- `pre_picks`: Stores user table preferences per grind type.
  - `discord_user_id`, `grind_type`, `table_name` (PK: user_id, grind_type)

### Updated Tables
- `games`: Add tracking for multi-stage timeouts.
  - `picker_type`: 'WINNER' or 'RUNNER_UP'
  - `won_game_id`: Reference to the game the picker won.
  - `reminder_count`: Number of reminders sent.
  - `last_reminded_at`: Timestamp of last reminder.

## 3. Core Logic Enhancements

### Refactored `/pick-table` Command
- **Dual-Mode**:
  - If the user is the *Active Picker* for a grind: Immediate iScored creation.
  - If not: Save selection to `pre_picks` table.
- **Validation**: 
  - Platform check (e.g., AtGames for DG).
  - **Calendar Year Rule**: Table cannot be selected if it was played (ACTIVE/COMPLETED) in the current calendar year.

### Identity Discovery Engine
- **Proactive Mapping**: 1 hour before each grind rotation, a job will scrape iScored standings.
- **Fuzzy Matching**: If an iScored user isn't mapped, the bot will search the Discord server for matching usernames/nicknames and auto-map them.
- **Mod Alerts**: If a winner cannot be mapped, notify moderators immediately with a link to the new `/map-user` command.

### Tiered Timeout System
- **Winner (1 Hour)**: Reminders every 15 minutes.
- **Runner-Up Pivot**: After 1 hour, the picker rights transfer to the 2nd place player.
- **Runner-Up (30 Minutes)**: Reminders every 10 minutes.
- **Auto-Selection**: After 30 minutes, the bot selects a random valid table.

## 4. Scheduled Jobs & Announcements

| Time (Central) | Task | Channel |
| :--- | :--- | :--- |
| **10:00 PM Daily** | DG Lead Announcement (1st/2nd place) + Selection Reminder | `#daily-grind` |
| **11:00 PM Daily** | Proactive Identity Mapping Scrape (DG) | Internal |
| **10:00 PM Wed** | Proactive Identity Mapping Scrape (WG) | Internal |
| **11:00 PM Last Day** | Proactive Identity Mapping Scrape (MG) | Internal |
| **Every 5 Mins** | Timeout Check & Interval Reminders | Direct Message / Channel |

## 5. New/Updated Commands
- `/pick-table`: Refactored to handle both Pre-picks (anytime) and Immediate Picks (when authorized).
- `/map-user`: (Mod Only) Manually map an iScored username to a Discord ID.

## 6. Implementation Phases
1. **Infrastructure**: Database migration and Yearly Eligibility helper.
2. **Identity**: Discord member search and auto-mapping logic.
3. **Refactor**: `/pick-table` logic and Pre-pick validation.
4. **Maintenance**: Integrate pre-pick application into rotation.
5. **Scheduler**: Implement lead announcements and 5-minute timeout loop.
