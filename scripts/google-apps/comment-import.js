// Google Apps Script for Website Login, CSV Download, and Google Sheets Import
// Run this every 15 minutes using Google Apps Script triggers

// Configuration - UPDATE THESE VALUES
const CONFIG = {
    // Google Drive CSV file details
    csvFileId: 'your-csv-file-id', // From the CSV file URL: drive.google.com/file/d/FILE-ID/view
    csvFileName: 'data.csv', // Alternative: search by filename if you don't have the ID
    csvFolderId: 'your-folder-id', // Optional: limit search to specific folder

    // Google Sheets details
    spreadsheetId: 'your-spreadsheet-id', // From the URL: docs.google.com/spreadsheets/d/SPREADSHEET-ID/edit
    sheetName: 'Data', // Name of the sheet tab

    // Options
    clearExistingData: true, // Set to false to append data instead
    addTimestamp: true, // Add a timestamp column
    checkFileModified: true // Only import if CSV has been modified since last import
};

// Main function - this is what gets triggered every 15 minutes
function main() {
    try {
        console.log('Starting automated CSV import from Google Drive...');

        // Step 1: Get CSV file from Google Drive
        const csvFile = getCsvFromDrive();

        // Step 2: Check if file has been modified (optional)
        if (CONFIG.checkFileModified && !hasFileBeenModified(csvFile)) {
            console.log('CSV file has not been modified since last import. Skipping.');
            return;
        }

        // Step 3: Read CSV data
        const csvData = csvFile.getBlob().getDataAsString();

        // Step 4: Parse CSV and import to Google Sheets
        importToGoogleSheets(csvData);

        // Step 5: Update last import timestamp
        if (CONFIG.checkFileModified) {
            updateLastImportTimestamp(csvFile.getLastUpdated());
        }

        console.log('CSV import completed successfully!');

    } catch (error) {
        console.error('Error in main function:', error);
        // Optional: Send email notification on error
        sendErrorNotification(error);
    }
}

// Function to get CSV file from Google Drive
function getCsvFromDrive() {
    console.log('Getting CSV file from Google Drive...');

    let csvFile;

    // Method 1: Get file by ID (most reliable)
    if (CONFIG.csvFileId) {
        try {
            csvFile = DriveApp.getFileById(CONFIG.csvFileId);
            console.log('Found CSV file by ID: ' + csvFile.getName());
            return csvFile;
        } catch (error) {
            console.log('Could not find file by ID, trying other methods...');
        }
    }

    // Method 2: Search by filename
    if (CONFIG.csvFileName) {
        let files;

        // Search within specific folder if provided
        if (CONFIG.csvFolderId) {
            const folder = DriveApp.getFolderById(CONFIG.csvFolderId);
            files = folder.getFilesByName(CONFIG.csvFileName);
        } else {
            // Search in entire Drive
            files = DriveApp.getFilesByName(CONFIG.csvFileName);
        }

        if (files.hasNext()) {
            csvFile = files.next();
            console.log('Found CSV file by name: ' + csvFile.getName());
            return csvFile;
        }
    }

    // Method 3: Get the most recent CSV file in a folder
    if (CONFIG.csvFolderId && !csvFile) {
        const folder = DriveApp.getFolderById(CONFIG.csvFolderId);
        const files = folder.getFilesByType(MimeType.CSV);

        let mostRecentFile = null;
        let mostRecentDate = new Date(0);

        while (files.hasNext()) {
            const file = files.next();
            const lastUpdated = file.getLastUpdated();

            if (lastUpdated > mostRecentDate) {
                mostRecentDate = lastUpdated;
                mostRecentFile = file;
            }
        }

        if (mostRecentFile) {
            console.log('Found most recent CSV file: ' + mostRecentFile.getName());
            return mostRecentFile;
        }
    }

    throw new Error('Could not find CSV file in Google Drive. Please check your configuration.');
}

// Function to check if file has been modified since last import
function hasFileBeenModified(csvFile) {
    try {
        const properties = PropertiesService.getScriptProperties();
        const lastImportKey = 'lastImport_' + csvFile.getId();
        const lastImportTime = properties.getProperty(lastImportKey);

        if (!lastImportTime) {
            console.log('No previous import timestamp found. File will be imported.');
            return true;
        }

        const lastImportDate = new Date(lastImportTime);
        const fileLastModified = csvFile.getLastUpdated();

        console.log('File last modified: ' + fileLastModified);
        console.log('Last import: ' + lastImportDate);

        return fileLastModified > lastImportDate;

    } catch (error) {
        console.log('Error checking file modification time: ' + error.toString());
        return true; // Default to importing if we can't check
    }
}

// Function to update last import timestamp
function updateLastImportTimestamp(fileLastModified) {
    try {
        const properties = PropertiesService.getScriptProperties();
        const csvFile = getCsvFromDrive(); // Get file to get its ID
        const lastImportKey = 'lastImport_' + csvFile.getId();

        properties.setProperty(lastImportKey, fileLastModified.toISOString());
        console.log('Updated last import timestamp');

    } catch (error) {
        console.log('Error updating import timestamp: ' + error.toString());
    }
}

// Function to parse CSV and import to Google Sheets
function importToGoogleSheets(csvData) {
    console.log('Importing data to Google Sheets...');

    // Parse CSV data
    const rows = parseCSV(csvData);

    if (rows.length === 0) {
        throw new Error('No data found in CSV file');
    }

    // Get the spreadsheet and sheet
    const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
    let sheet = spreadsheet.getSheetByName(CONFIG.sheetName);

    // Create sheet if it doesn't exist
    if (!sheet) {
        sheet = spreadsheet.insertSheet(CONFIG.sheetName);
    }

    // Clear existing data if configured
    if (CONFIG.clearExistingData) {
        sheet.clear();
    }

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

    // Write data to sheet
    if (rows.length > 0) {
        const range = sheet.getRange(1, 1, rows.length, rows[0].length);
        range.setValues(rows);

        // Format header row
        if (rows.length > 0) {
            const headerRange = sheet.getRange(1, 1, 1, rows[0].length);
            headerRange.setFontWeight('bold');
            headerRange.setBackground('#f1f3f4');
        }
    }

    console.log(`Imported ${rows.length} rows to Google Sheets`);
}

// Simple CSV parser function
function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const result = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.length === 0) continue;

        // Simple CSV parsing - handles basic cases
        // For complex CSV with quotes and commas, consider using a library
        const row = line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
        result.push(row);
    }

    return result;
}

// Function to send error notifications
function sendErrorNotification(error) {
    const subject = 'CSV Import Error';
    const body = `Error occurred during CSV import:\n\n${error.toString()}\n\nTime: ${new Date()}`;

    // Send email to yourself (replace with your email)
    // MailApp.sendEmail('your-email@gmail.com', subject, body);
}

// Function to set up the trigger (run this once manually)
function setupTrigger() {
    // Delete existing triggers for this function
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
        if (trigger.getHandlerFunction() === 'main') {
            ScriptApp.deleteTrigger(trigger);
        }
    });

    // Create new trigger to run every 15 minutes
    ScriptApp.newTrigger('main')
        .timeBased()
        .everyMinutes(15)
        .create();

    console.log('Trigger set up successfully - script will run every 15 minutes');
}

// Alternative authentication methods for different websites

// Method 2: For reading CSV files with different encodings
function readCsvWithEncoding(csvFile, encoding = 'UTF-8') {
    try {
        const blob = csvFile.getBlob();

        // Convert blob to different encoding if needed
        switch (encoding.toLowerCase()) {
            case 'utf-8':
            case 'utf8':
                return blob.getDataAsString('UTF-8');
            case 'latin-1':
            case 'iso-8859-1':
                return blob.getDataAsString('ISO-8859-1');
            case 'windows-1252':
                return blob.getDataAsString('CP1252');
            default:
                return blob.getDataAsString();
        }
    } catch (error) {
        console.log('Error reading CSV with encoding ' + encoding + ': ' + error.toString());
        // Fallback to default encoding
        return csvFile.getBlob().getDataAsString();
    }
}

// Method 3: For CSV files shared from other accounts
function getCsvFromSharedDrive(sharedFileId) {
    try {
        // This requires the file to be shared with the script's account
        const csvFile = DriveApp.getFileById(sharedFileId);
        console.log('Successfully accessed shared CSV file: ' + csvFile.getName());
        return csvFile;
    } catch (error) {
        throw new Error('Cannot access shared CSV file. Make sure the file is shared with this account: ' + error.toString());
    }
}

// Method 4: For CSV files in shared drives (Google Workspace)
function getCsvFromSharedDrive_TeamDrive(sharedDriveId, fileName) {
    try {
        // Get all files in the shared drive
        const sharedDrive = DriveApp.getFolderById(sharedDriveId);
        const files = sharedDrive.getFilesByName(fileName);

        if (files.hasNext()) {
            const csvFile = files.next();
            console.log('Found CSV in shared drive: ' + csvFile.getName());
            return csvFile;
        } else {
            throw new Error('CSV file not found in shared drive');
        }
    } catch (error) {
        throw new Error('Cannot access shared drive CSV: ' + error.toString());
    }
}

// Test function to verify configuration
function testConfiguration() {
    console.log('Testing configuration...');

    try {
        // Test CSV file access
        const csvFile = getCsvFromDrive();
        console.log('✓ CSV file access successful: ' + csvFile.getName());
        console.log('  File size: ' + csvFile.getSize() + ' bytes');
        console.log('  Last modified: ' + csvFile.getLastUpdated());

        // Test CSV content preview
        const csvData = csvFile.getBlob().getDataAsString();
        const lines = csvData.split('\n');
        console.log('  First few lines of CSV:');
        for (let i = 0; i < Math.min(3, lines.length); i++) {
            console.log('    ' + lines[i]);
        }

        // Test spreadsheet access
        const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
        console.log('✓ Spreadsheet access successful: ' + spreadsheet.getName());

        // Test sheet access
        let sheet = spreadsheet.getSheetByName(CONFIG.sheetName);
        if (!sheet) {
            sheet = spreadsheet.insertSheet(CONFIG.sheetName);
            console.log('✓ Created new sheet: ' + CONFIG.sheetName);
        } else {
            console.log('✓ Sheet access successful: ' + CONFIG.sheetName);
        }

        console.log('Configuration test passed!');

    } catch (error) {
        console.error('Configuration test failed:', error);
    }
}

// Function to manually force import (ignores modification check)
function forceImport() {
    const originalCheckSetting = CONFIG.checkFileModified;
    CONFIG.checkFileModified = false;

    try {
        main();
    } finally {
        CONFIG.checkFileModified = originalCheckSetting;
    }
}

// Function to get CSV file information
function getCsvFileInfo() {
    try {
        const csvFile = getCsvFromDrive();

        const info = {
            name: csvFile.getName(),
            id: csvFile.getId(),
            size: csvFile.getSize(),
            lastUpdated: csvFile.getLastUpdated(),
            mimeType: csvFile.getBlob().getContentType(),
            url: csvFile.getUrl()
        };

        console.log('CSV File Information:');
        console.log(JSON.stringify(info, null, 2));

        return info;

    } catch (error) {
        console.error('Error getting file info:', error);
    }
}