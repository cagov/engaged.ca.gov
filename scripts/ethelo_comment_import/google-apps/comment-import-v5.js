// Global config.
const CONFIG = {
    csvFileName: 'comments.csv',
    sheetName: 'comments', // Name of the sheet tab
    addTimestamp: true, // Add a timestamp column
    zakiya_mydrive_38: '1GC1ugnZWhz17gEsFF6m7HOoTVd7HvwbA', // My Drive/Comments/38
    engca_shareddrive_38: '10TM5mykUruWt_qORxYYgSfDlzpLMAB3nWqto3hlcMzo' //Shared Drive/Engaged California Downloads/Comments/38
};

// spreadsheetId
// string
// From the URL: docs.google.com/spreadsheets/d/SPREADSHEET-ID/edit

// checkFileModified
// boolean
// Only import if CSV has been modified since last import


const DECISION_FIRES_PROD= {
    decision_id: 33,
    csvFolderId: CONFIG.zakiya_mydrive,
    spreadsheetId: '1tpwxT05MsYVin975Rdk9n8iglEki_uRRdSlsReAFeoU',
}

const DECISION_SANDBOX_SHARED_DRIVE= {
    decision_id: 38,
    csvFolderId: CONFIG.engca_shareddrive_38,
    spreadsheetId: '10TM5mykUruWt_qORxYYgSfDlzpLMAB3nWqto3hlcMzo',
}

const DECISION_SANDBOX_MY_DRIVE= {
    decision_id: 38,
    csvFolderId: CONFIG.zakiyas_mydrive,
    spreadsheetId: '1Qkw5utYYygfKxBxcYHWvQD1QbWElEQ1HyrxOfhFZz8w',
}

function getCsvFromDrive(decision) {

    if (CONFIG.csvFileName) {
        let files;

        // Search within specific folder if provided
        if (decision.csvFolderId) {
            const folder = DriveApp.getFolderById(decision.csvFolderId);
            files = folder.getFilesByName(CONFIG.csvFileName);
        } else {
            // Search in entire Drive
            files = DriveApp.getFilesByName(CONFIG.csvFileName);
        }

        if (files.hasNext()) {
            const csvFile = files.next();
            console.log('Found CSV file by name: ' + csvFile.getName());
            return csvFile;
        }
    }
}

// Vibe code warning.
function importFileFromDrive(decision) {
    try {
        const file = getCsvFromDrive(decision.spreadsheetId);
        const blob = file.getBlob();
        const content = blob.getDataAsString();

        // Parse CSV data
        const rows = Utilities.parseCsv(content);
        if (rows.length === 0) {
            Logger.log('No data found in CSV');
            return;
        }

        const spreadsheet = SpreadsheetApp.openById(decision.spreadsheetId);
        const sheet = spreadsheet.getSheetByName(CONFIG.sheetName);

        // Get existing data from sheet
        let existingData = [];
        if (sheet.getLastRow() > 0) {
            existingData = sheet.getDataRange().getValues();
        }

        // Find comment_id column index
        const commentIdIndex = findCommentIdColumn(rows, existingData);
        if (commentIdIndex === -1) {
            Logger.log('Error: comment_id column not found');
            return;
        }

        // Determine which rows are new or updated
        let newRows = [];
        let updatedRows = [];

        if (existingData.length === 0) {
            // Sheet is empty, import all rows
            newRows = rows;
        } else {
            const result = findNewAndUpdatedRows(rows, existingData, commentIdIndex);
            newRows = result.newRows;
            updatedRows = result.updatedRows;
        }

        // Update existing rows if any changes detected
        if (updatedRows.length > 0) {
            updateExistingRows(sheet, updatedRows, existingData, commentIdIndex);
            Logger.log(`Updated ${updatedRows.length} existing rows.`);
        }

        if (newRows.length === 0) {
            Logger.log(updatedRows.length > 0 ? 'No new rows to import, but existing rows were updated.' : 'No new or updated rows found.');
            return;
        }

        // Add timestamp column if configured
        if (CONFIG.addTimestamp) {
            const timestamp = new Date();
            newRows.forEach(row => {
                if (row.length > 0) {
                    row.push(timestamp);
                }
            });

            // Update header row for timestamp column (only if this is the first import or header row)
            if (existingData.length === 0 && newRows.length > 0) {
                newRows[0][newRows[0].length - 1] = 'Import_Timestamp';
            } else if (newRows.length > 0 && isHeaderRow(newRows[0], rows[0])) {
                newRows[0][newRows[0].length - 1] = 'Import_Timestamp';
            }
        }

        // Append new rows to the sheet (never delete existing rows)
        if (existingData.length === 0) {
            // First import - add all data starting from row 1
            sheet.getRange(1, 1, newRows.length, newRows[0].length).setValues(newRows);
        } else {
            // Subsequent imports - append after existing data
            const startRow = sheet.getLastRow() + 1;
            sheet.getRange(startRow, 1, newRows.length, newRows[0].length).setValues(newRows);
        }

        Logger.log(`Import completed successfully. Added ${newRows.length} new rows.`);

    } catch (error) {
        Logger.log('Error: ' + error.toString());
    }
}

// Vibe code warning.
function findCommentIdColumn(csvRows, existingData) {
    // Try to find comment_id column in CSV first
    if (csvRows.length > 0) {
        const headerRow = csvRows[0];
        for (let i = 0; i < headerRow.length; i++) {
            if (headerRow[i].toString().toLowerCase().trim() === 'comment id') {
                return i;
            }
        }
    }

    // If not found in CSV, try existing data
    if (existingData.length > 0) {
        const headerRow = existingData[0];
        for (let i = 0; i < headerRow.length; i++) {
            if (headerRow[i].toString().toLowerCase().trim() === 'comment id') {
                return i;
            }
        }
    }

    return -1; // Column not found
}

// Vibe code warning.
function findNewAndUpdatedRows(csvRows, existingData, commentIdIndex) {
    const newRows = [];
    const updatedRows = [];

    // Create a map of existing comment_ids to their row data and row index
    const existingCommentIds = new Map();

    for (let i = 1; i < existingData.length; i++) { // Skip header row
        const row = existingData[i];
        if (row[commentIdIndex]) {
            const commentId = row[commentIdIndex].toString();
            existingCommentIds.set(commentId, {
                rowData: row,
                rowIndex: i + 1 // +1 because sheet rows are 1-indexed
            });
        }
    }

    // Check each CSV row
    csvRows.forEach((csvRow, index) => {
        if (index === 0) {
            // Skip header row in CSV, but add it if sheet is empty
            if (existingData.length === 0) {
                newRows.push([...csvRow]);
            }
            return;
        }

        const commentId = csvRow[commentIdIndex] ? csvRow[commentIdIndex].toString() : null;

        if (!commentId) {
            Logger.log(`Warning: Row ${index + 1} has no comment_id, skipping...`);
            return;
        }

        if (existingCommentIds.has(commentId)) {
            // Check if row has been updated
            const existingRow = existingCommentIds.get(commentId);
            if (hasRowChanged(csvRow, existingRow.rowData, commentIdIndex)) {
                updatedRows.push({
                    newData: [...csvRow],
                    sheetRowIndex: existingRow.rowIndex,
                    commentId: commentId
                });
            }
        } else {
            // New row
            newRows.push([...csvRow]);
        }
    });

    return { newRows, updatedRows };
}

// Vibe code warning.
function hasRowChanged(csvRow, existingRow, commentIdIndex) {
    // Compare all columns except timestamp column
    const csvLength = csvRow.length;
    let existingLength = existingRow.length;

    // If existing row has timestamp column, don't compare it
    if (CONFIG.addTimestamp && existingRow[existingLength - 1] instanceof Date) {
        existingLength--;
    }

    // Check if lengths differ (excluding timestamp)
    if (csvLength !== existingLength) {
        return true;
    }

    // Compare each cell value
    for (let i = 0; i < csvLength; i++) {
        const csvValue = csvRow[i] === null || csvRow[i] === undefined ? '' : csvRow[i].toString().trim();
        const existingValue = existingRow[i] === null || existingRow[i] === undefined ? '' : existingRow[i].toString().trim();

        if (csvValue !== existingValue) {
            return true;
        }
    }

    return false;
}

// Vibe code warning.
function updateExistingRows(sheet, updatedRows, existingData, commentIdIndex) {
    updatedRows.forEach(update => {
        const { newData, sheetRowIndex } = update;

        // Add timestamp if configured
        if (CONFIG.addTimestamp) {
            const timestamp = new Date();
            newData.push(timestamp);
        }

        // Update the specific row in the sheet
        sheet.getRange(sheetRowIndex, 1, 1, newData.length).setValues([newData]);
    });
}

// Vibe code warning.
function isHeaderRow(rowToCheck, originalFirstRow) {
    // Check if this row appears to be a header by comparing with the original first row
    if (rowToCheck.length !== originalFirstRow.length) return false;

    for (let i = 0; i < originalFirstRow.length; i++) {
        if (rowToCheck[i] !== originalFirstRow[i]) return false;
    }

    return true;
}

function runFires() {
    importFileFromDrive(DECISION_FIRES_PROD);
}

function runSandbox() {
    importFileFromDrive(DECISION_SANDBOX_SHARED_DRIVE);
    importFileFromDrive(DECISION_SANDBOX_MY_DRIVE);
}

