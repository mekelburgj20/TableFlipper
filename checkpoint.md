<!-- AI HANDOVER PROMPT -->
**Project Status:** 
"TableFlipper" is a fully functional Discord bot for managing pinball tournaments. The codebase features robust iScored automation, intelligent state reconciliation, and a highly flexible command structure.

**Recent Work:**
1.  **Dual-Slot Weekly Grinds:** Refactored maintenance and sync logic to support multiple active tables for a single tournament type (e.g., dual WG-VPXS).
2.  **Forensic Style Sniffing:** Implemented automated extraction of Community Style IDs from active games to ensure perfect visual persistence across rotations.
3.  **Non-Tournament Support:** Integrated type 'OTHER' for any unlocked game on iScored, making them available for score submission.
4.  **Full State Reconciliation:** Updated sync logic to identify and hide 'ghost' games, including those in the hidden queue.
5.  **Scoreboard Wipe:** Added a CLI utility for clearing the board.

**Current Context:**
*   The bot now handles multiple winners and pickers per cycle.
*   Style learning is board-wide and triggers during every state sync.
*   Autocomplete is optimized for clean labels and type-specific filtering.

**Next Actions:**
1.  **Admin Override:** Implement moderator nomination overrides.
2.  **OCR Verification:** Research lightweight OCR for automatic score validation.
3.  **Proactive Picker DMs:** Send friendly DM reminders to winners.

**Files to Watch:**
*   `src/discordBot.ts` (Command handlers & Autocomplete)
*   `src/database.ts` (Reconciliation & multi-slot logic)
*   `src/sync-state.ts` (Board-wide synchronization)
*   `src/iscored.ts` (Style sniffing & header removal)
<!-- END PROMPT -->

# Checkpoint for TableFlipper Project (Update 7)

**Date:** February 23, 2026

## Project Summary: Multi-Slot Support & Style Forensic Sniffing

This update significantly expands the bot's architectural flexibility and visual reliability. It introduces the ability to manage multiple active tournaments of the same type and implements a high-fidelity style learning system that survives game deletions and resets.

### Key Changes Implemented:

#### 1. Dual-Slot Weekly Grinds
*   **Multi-Active Support**: Refactored the core engine to allow multiple active games for a single grind type (e.g., two concurrent `WG-VPXS` tables).
*   **Sequential Picking**: If a user wins multiple slots in a cycle, the system correctly tracks their double-pick rights and allows them to perform `/picktable` twice.
*   **Aggressive Rollover**: Maintenance now loops through all active games, determines separate winners, and activates the corresponding number of queued games.

#### 2. Forensic Style Sniffing & Application
*   **Fingerprint Extraction**: The bot now scans the `background-image` CSS of every active game to extract the underlying Community Style ID (`style_id`).
*   **Visual Fidelity**: By storing both the `style_id` and raw CSS overrides, the bot can perfectly recreate an admin's manual styling choices when a game returns to rotation.
*   **Header Removal Toggle**: Added a global option to automatically strip game logos (header images) after creation, as preferred by the community.

#### 3. Non-Tournament Game Awareness
*   **Universal Submissions**: The bot now tracks every unlocked game on the board as type `OTHER`. 
*   **Type 'OTHER' Integration**: Users can now use `/submit-score` for any game on the arcade, even if it's not part of a tournament grind.

#### 4. Absolute State Reconciliation
*   **Ghost Purging**: Fixed an edge case where deleted queued games remained active in the database. Reconciliation now checks the entire iScored board against the local DB and marks any missing entries as `HIDDEN`.
*   **Scoreboard Wipe**: A new CLI command `npm run scoreboard-wipe` allows for instant clearing of all games on the iScored board.

## Final Status
The bot has evolved from a simple tournament manager into a comprehensive arcade automation engine. It is now robust enough to handle custom events, manual board edits, and complex multi-winner scenarios with zero loss of data or visual style.
