import PublicGoogleSheetsParser from 'public-google-sheets-parser';
import { upsertTable, TableRow, getTable } from './database.js';

/**
 * Fetches a list of tables from the configured Google Sheet.
 * Assumes the sheet has a column named 'Table Name'.
 * @param gid The specific sheet GID to parse.
 * @returns A promise that resolves to an array of table names.
 */
interface SheetItem {
    'Table Name': string;
    'dg'?: string;
    'wg-vr'?: string;
    'wg-vpxs'?: string;
    'atgames'?: string;
    'aliases'?: string;
    'style_id'?: string;
}

function parseBoolean(value: string | undefined): number {
    if (!value) return 0;
    const lower = value.toString().toLowerCase().trim();
    return (lower === 'true' || lower === 'yes' || lower === '1' || lower === 'x') ? 1 : 0;
}

export async function getTablesFromSheet(gid: string): Promise<string[]> {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) {
        throw new Error('GOOGLE_SHEET_ID is not defined in the environment variables.');
    }

    // @ts-ignore
    const parser = new PublicGoogleSheetsParser(sheetId);
    
    try {
        console.log(`Fetching table list from Google Sheet ID: ${sheetId}, GID: ${gid}`);
        const items = await parser.parse(sheetId, gid) as SheetItem[];
        
        if (!items || items.length === 0) {
            console.log('No items found in the Google Sheet.');
            return [];
        }

        const tableNames = items.map(item => item['Table Name']).filter(Boolean);
        
        console.log(`✅ Found ${tableNames.length} tables from the sheet.`);
        return tableNames;

    } catch (error) {
        console.error('❌ Error parsing Google Sheet:', error);
        throw new Error('Could not fetch the table list from Google Sheets.');
    }
}

/**
 * Fetches tables from Google Sheet and syncs them to the database.
 */
export async function syncTablesFromSheet(gid: string): Promise<void> {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) {
        throw new Error('GOOGLE_SHEET_ID is not defined in the environment variables.');
    }

    // @ts-ignore
    const parser = new PublicGoogleSheetsParser(sheetId);

    try {
        console.log(`🔄 Syncing tables from Google Sheet ID: ${sheetId}, GID: ${gid}...`);
        const items = await parser.parse(sheetId, gid) as SheetItem[];

        if (!items || items.length === 0) {
            console.log('⚠️ No items found in the Google Sheet to sync.');
            return;
        }

        let count = 0;
        for (const item of items) {
            const tableName = item['Table Name'];
            if (!tableName) continue;

            const existingTable = await getTable(tableName);

            const tableRow: TableRow = {
                name: tableName,
                aliases: item['aliases'] || null,
                is_atgames: parseBoolean(item['atgames']),
                is_wg_vr: parseBoolean(item['wg-vr']),
                is_wg_vpxs: parseBoolean(item['wg-vpxs']),
                // Only overwrite style_id if it's in the sheet, otherwise keep existing/learned one
                style_id: item['style_id'] ? item['style_id'].toString() : (existingTable?.style_id || null),
                // Preserve other learned styles if they already exist
                css_title: existingTable?.css_title || null,
                css_initials: existingTable?.css_initials || null,
                css_scores: existingTable?.css_scores || null,
                css_box: existingTable?.css_box || null,
                bg_color: existingTable?.bg_color || null,
                score_type: existingTable?.score_type || null,
                sort_ascending: existingTable?.sort_ascending || 0
            };
            
            await upsertTable(tableRow);
            count++;
        }
        console.log(`✅ Successfully synced ${count} tables to the database.`);

    } catch (error) {
        console.error('❌ Error syncing tables from Google Sheet:', error);
        throw error;
    }
}
