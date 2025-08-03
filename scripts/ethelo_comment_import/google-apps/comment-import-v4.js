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

function importFileFromDrive(decision) {
    try {
        const file = getCsvFromDrive(decision.spreadsheetId);
        const blob = file.getBlob();
        const content = blob.getDataAsString();

        // Parse CSV data
        const rows = Utilities.parseCsv(content);

        // Add timestamp column if configured
        if (CONFIG.addTimestamp) {
            const timestamp = new Date();
            rows.forEach(row => {
                if (row.length > 0) {
                    row.push(timestamp);
                }
            });

            // Update header row if it exists
            if (rows.length > 0 && rows[0].length > 0) {
                rows[0][rows[0].length - 1] = 'Import_Timestamp';
            }
        }

        const spreadsheet = SpreadsheetApp.openById(decision.spreadsheetId);
        const sheet = spreadsheet.getSheetByName(CONFIG.sheetName);

        // sheet.clear();
        sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

        Logger.log('Import completed successfully');

    } catch (error) {
        Logger.log('Error: ' + error.toString());
    }
}


function runFires() {
    importFileFromDrive(DECISION_FIRES_PROD);
}

function runSandbox() {
    // importFileFromDrive(DECISION_SANDBOX_SHARED_DRIVE);
    importFileFromDrive(DECISION_SANDBOX_MY_DRIVE);
}

