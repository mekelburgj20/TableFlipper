<!-- AI HANDOVER PROMPT -->
**Project Status:** 
"TableFlipper" v1.3.0 is a robust, production-ready arcade management bot. Recent updates have focused on system stability, identity automation, and a professional user experience.

**Recent Work:**
1.  **Refactored `/pick-table`**: Unified flow for immediate and pre-picks. Confirmation messages are now private (ephemeral).
2.  **Tiered Timeout Loop**: 1-hour winner window and 30-minute runner-up window with automated reminders and pivoting.
3.  **120-Day Eligibility**: Rolling lookback prevents table repetition within a 4-month window.
4.  **Identity Engine**: Proactive iScored-to-Discord mapping and `/map-user` command.
5.  **Reliability Hotfixes**: Resolved issues with DB schema migrations and unmapped winner stalls.
6.  **Console Optimization**: Implemented `LOG_LEVEL` filtering to reduce cron-related noise.

**Current Context:**
*   Tournament rotations are now highly automated; manual intervention is only needed for unmapped winners or complex disputes.
*   The bot uses a clean, emoji-free tone for all professional communications.
*   Identity mapping is stored in SQLite for persistence and performance.

**Next Actions:**
1.  **Pre-pick DM Notifications:** Alert users when their queued picks are successfully applied or fail validation.
2.  **OCR Score Verification**: Automated validation of score photos.
3.  **Live Standings Board**: Pinned Discord messages that update in real-time.

**Files to Watch:**
*   `src/timeout.ts` (Tiered logic & Reminders)
*   `src/database.ts` (Migration logic & Eligibility checks)
*   `src/identity.ts` (Mapping & Lead alerts)
*   `src/logger.ts` (Verbosity control)
<!-- END PROMPT -->

# Checkpoint for TableFlipper Project (Update 9)

**Date:** February 28, 2026

## Project Summary: Reliability, Privacy, and Tone Polish

This update moves the project to **v1.3.0**, centering on bulletproofing the automated picking loop and refining the bot's communication style. The system now gracefully handles unmapped users and protects user privacy during the table selection process.

### Key Changes Implemented:

#### 1. Bulletproof Selection Loop
*   **Unmapped Winner Recovery**: Updated the timeout engine to monitor winners who haven't linked their Discord accounts. The bot now notifies moderators and continues the 1-hour countdown to the runner-up, ensuring the board never stalls.
*   **120-Day Rolling Lookback**: Switched from a seasonal "Calendar Year" rule to a rolling 120-day window. This provides a more dynamic and consistent variety across all four tournament types.
*   **Migration Resilience**: Enhanced the database initialization logic to perform safety checks (`ALTER TABLE`) on existing databases, ensuring all new tracking columns are added without requiring a full reset.

#### 2. Professional Tone & Privacy
*   **Emoji-Free Communication**: Removed all trophies, checkmarks, and icons from Discord messages and system logs to create a clean, professional text-only interface.
*   **Ephemeral Confirmation**: Refactored `/pick-table` so that the bot's response is only visible to the person running the command, preventing channel clutter and keeping user preferences private.

#### 3. Console & Identity Management
*   **Log Verbosity Control**: Added a `LOG_LEVEL` environment variable. Frequent heartbeats (like the 5-minute timeout checks) are now set to `DEBUG` level, keeping the console clear of spam while retaining full detail in the `bot.log` file.
*   **Identity Auto-Discovery**: The proactive mapping engine now automatically searches the Discord server for usernames and nicknames that match iScored profiles, reducing the need for manual mapping.

#### 4. Critical Hotfixes
*   **Auto-Pick Loop Fix**: Fixed a critical issue where the timeout fallback mechanism would continuously select new random games due to lingering picker metadata in the database.
*   **Nominate Picker Refinement**: Improved channel context detection for `/nominate-picker` and removed redundant "Admin Override" warnings for rightful winners.
*   **Eligibility Protection**: Enhanced the 120-day eligibility logic to ensure the bot never auto-selects a table that is already scheduled or actively queued.

## Final Status
TableFlipper v1.3.0 is a mature automation engine. With the new tiered fallback mechanism and identity discovery engine, tournament rotations are now resilient enough to handle unresponsive winners and unmapped players without manual admin oversight.
