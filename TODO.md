# Active Tasks
(None)

# Future Considerations
15. **Pre-pick Queue Notifications:** DM users when their pre-pick is successfully applied or if it fails validation during rotation.

# Completed History
1. [COMPLETED] **Pre-pick Queue & Runner-Up Fallback:** Implemented tiered timeouts (1h/30m), interval reminders, and automated pre-pick application.
2. [COMPLETED] **Identity Discovery Engine:** Proactive iScored-to-Discord mapping via guild member search and `/map-user` command.
3. [COMPLETED] **Refactored /pick-table:** Unified command for immediate picks and queuing future preferences. confirmation messages are now ephemeral.
4. [COMPLETED] **120-Day Eligibility Rule:** Enforced a rolling 120-day lookback for all table selections to ensure variety.
5. [COMPLETED] **Stability & Tone Polish:** Removed all emojis from Discord messages and logs. Added `LOG_LEVEL` filtering to reduce console spam.
6. [COMPLETED] **Hotfix: Unmapped Winner Stalling:** Updated timeout loop to handle winners without Discord IDs, notifying moderators and pivoting to runner-ups correctly.
7. [COMPLETED] **Hotfix: DB Migration Reliability:** Fixed a bug where new schema columns were not correctly added to existing databases during initialization.
8. [COMPLETED] **Admin Nomination Override:** Moderators can now nominate pickers, bypassing the winner-only restriction.
9. [COMPLETED] **Hotfix: Timeout Loop Bug:** Fixed an infinite loop during auto-selection fallback by properly clearing picker metadata.
10. [COMPLETED] **Hotfix: Nominate Picker Refinement:** Improved channel detection and removed redundant admin override messaging for valid winners.
11. [COMPLETED] **Hotfix: Queued Game Eligibility:** Prevented the auto-picker from selecting games that are already queued up.
12. [COMPLETED] **Hotfix: Env Variables:** Synced .env.example with missing channel ID and logging configuration fields.
13. [COMPLETED] **Channel-Specific Context:** Commands now automatically infer tournament types based on the Discord channel.
3. [COMPLETED] **Easter Eggs:** The bot now responds to regular messages containing the word "squeal".
4. [COMPLETED] **Multi-Slot Weekly Grinds:** Support for multiple active games per tournament type.
... (existing history continued)
2. [COMPLETED] **Forensic Style Sniffing:** Automated style learning via Community Style ID extraction.
3. [COMPLETED] **Non-Tournament Submission:** Support for score entry on non-grind active games (type 'OTHER').
4. [COMPLETED] **Unified Standings & Submissions:** Refactored `/list-scores` and `/submit-score` into flexible commands supporting both tournament and table-based parameters with intelligent autocomplete.
5. [COMPLETED] **Immediate Rotation:** Implemented zero-buffer activation for Weekly and Monthly grinds, allowing them to go live as soon as a winner picks.
6. [COMPLETED] **State Reconciliation:** Added automatic cleanup logic to `sync-state` and maintenance sweeps to identify and hide "ghost" games in the database that are no longer on iScored.
7. [COMPLETED] **Scheduled Maintenance Refinement:** Updated Weekly maintenance to trigger at 11:00 PM Central on Wednesdays.
8. [COMPLETED] **Multi-Channel Routing:** Implemented tournament-specific Discord webhooks for announcements and timeout notifications.
9. [COMPLETED] **Lineup Repositioning (DOM-based):** Implemented automated reordering of the iScored Lineup using physical DOM manipulation. Now integrated into both maintenance and state sync.
10. [COMPLETED] **Community Styles:** Added support for iScored Community Styles.
11. [COMPLETED] **Tag-Based Identification:** Formalized the use of iScored tags as the primary identifier for tournament types.
12. [COMPLETED] **VPXS API Integration:** Integrated the Virtual Pinball Spreadsheet API for expanded WG-VPXS autocomplete.
13. [COMPLETED] **Enhanced Persistent Logging:** Refactored core modules to log all browser automation and maintenance steps to `data/bot.log`.
14. [COMPLETED] **Dynasty Rule:** Prevent repeat winners from picking consecutive tables.
15. [COMPLETED] **Table Database & Validation:** Integrated Google Sheet catalog and platform-specific filtering.
16. [COMPLETED] **Scoreboard Wipe Utility:** CLI tool to clear the iScored board.
17. [COMPLETED] **Automated Header Removal:** Global toggle to strip logos from new games.
