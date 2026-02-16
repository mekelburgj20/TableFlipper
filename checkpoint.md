<!-- AI HANDOVER PROMPT -->
**Project Status:** 
"TableFlipper" is a fully functional Discord bot for managing pinball tournaments. The codebase features robust iScored automation, state-of-the-art cleanup logic, and multi-channel notification support.

**Recent Work:**
1.  **Multi-Channel Webhooks:** Implemented support for tournament-specific Discord webhooks (`DISCORD_WEBHOOK_URL_DG`, etc.) in `src/discord.ts`, allowing announcements to be routed to dedicated channels.
2.  **Dynamic Notification Headers:** Updated `src/discord.ts` and `src/maintenance.ts` to use dynamic message headers based on the tournament type (e.g., "The Monthly Grind is Closed!").
3.  **Timeout Notification Routing:** Updated `src/timeout.ts` to ensure picker timeout announcements are also correctly routed to tournament-specific channels.
4.  **Emoji Cleanliness:** Verified and enforced project standards regarding the removal of emojis from user-facing Discord messages.
5.  **Cleanup Overhaul:** Implemented a reliable cleanup sweep that deletes old locked tables while preserving active games. Combined into a single `/trigger-cleanup` command.

**Current Context:**
*   The bot handles DG, WG, and MG cycles autonomously.
*   Cleanup is scheduled for Wednesdays at 11 PM Central.
*   Database schema is mature and synchronized.
*   Multi-channel routing is fully operational and tested.

**Next Actions:**
1.  **Community Styles:** Investigate applying styles to games via the DB.
2.  **Admin Override:** Implement moderator nomination overrides.
3.  **VPXS API:** Integrate the Virtual Pinball Spreadsheet API for expanded table lists.

**Files to Watch:**
*   `src/discord.ts` (Webhook routing & message formatting)
*   `src/maintenance.ts` (Maintenance logic)
*   `src/timeout.ts` (Picker timeout handling)
*   `src/iscored.ts` (Core automation)
<!-- END PROMPT -->

# Checkpoint for TableFlipper Project (Update 5)

**Date:** February 16, 2026

## Project Summary: Multi-Channel Routing & UI Polish

This update introduces intelligent notification routing and refines the user-facing Discord experience. It addresses the need for dedicated tournament channels and ensures that announcements are accurately labeled and formatted.

### Key Changes Implemented:

#### 1. Multi-Channel Webhook System
*   **Targeted Routing:** Implemented a granular webhook selection system in `src/discord.ts`. The bot now looks for environment variables like `DISCORD_WEBHOOK_URL_DG`, `DISCORD_WEBHOOK_URL_MG`, etc., to route messages to the correct Discord channels.
*   **Robust Fallback:** Maintained `DISCORD_WEBHOOK_URL` as a global fallback for any tournament type without a dedicated URL, ensuring no messages are lost.
*   **Comprehensive Coverage:** Updated both standard maintenance routines and automatic picker timeout handlers to use the new routing logic.

#### 2. Dynamic Notification & UI Polish
*   **Accurate Headers:** Message headers are no longer hardcoded as "Daily Grind". They now dynamically reflect the tournament type (e.g., "The Weekly Grind (VPXS) is Closed!").
*   **Emoji Standard Enforcement:** Conducted a sweep of user-facing strings to remove emojis, aligning with project visual standards. Internal logs maintain their emojis for developer readability.
*   **Verification Tooling:** Updated `src/tests/verify-tasks.ts` to automatically check for forbidden emojis in user-facing code while ignoring developer logs.

#### 3. Maintenance Logic Stability
*   **Tournament Identification:** Verified that the system correctly distinguishes between different tournament types (DG vs MG) even when game names are similar, relying on iScored tags as the primary key.
*   **State Consistency:** Confirmed that the database accurately reflects active and completed games across all tournament formats.

## Final Status
The bot now supports a professional, multi-channel Discord setup. Notifications are accurately routed and labeled, and the codebase adheres to strict UI standards. The core automation and maintenance cycles are stable and verified.
