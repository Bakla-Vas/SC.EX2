// ============================================================
// Main.gs
// Sky Cards EX2 — Entry Point and Spreadsheet Accessor
//
// PURPOSE:
//   Provides the single shared spreadsheet accessor used
//   across all files, and the doPost() HTTP handler which
//   is the entry point for all Shortcuts app submissions.
//
// DEPENDS ON:  CONFIG, getSpreadsheetId (Config.gs)
//              extractPlayerFromOCR, extractXPFromOCR (Extract.gs)
//              getLookupData, fuzzyMatchPlayer,
//              lookupICAOFromOCR (Lookup.gs)
//              generateRecordId, isDuplicate,
//              logToRawExtract, sortTableByDate (Records.gs)
// USED BY:     Shortcuts app via HTTP POST
// ============================================================


// ============================================================
// OPEN SPREADSHEET ONCE — reused across all functions
// The spreadsheetId is read from Script Properties via
// getSpreadsheetId() in Config.gs. Never hardcoded here.
// ============================================================
function getSpreadsheet() {
  return SpreadsheetApp.openById(getSpreadsheetId());
}


// ============================================================
// MAIN POST HANDLER
// Entry point called by the Shortcuts app via HTTP POST.
// Orchestrates all extraction, duplicate checking, ID
// generation, sheet writing and raw extract logging in a
// single transaction.
//
// Expected JSON body:
// {
//   "rawText":  "<full OCR text from screenshot>",
//   "status":   "Confirmed",
//   "date":     "2026-05-10"
// }
//
// Optional override fields:
// {
//   "playerOverride": "<corrected player name>",
//   "xpOverride":     "<corrected XP value>",
//   "icaoOverride":   "<corrected ICAO code>"
// }
//
// Flow:
//   1. Parse and validate incoming JSON
//   2. Extract player, XP and ICAO from rawText
//   3. Apply fuzzy matching to player name
//   4. Apply manual overrides if provided
//   5. Read sheet data once — reused for ID generation,
//      duplicate check and header row location
//   6. Generate unique record ID (SC-YYMMDD-NNNNN)
//   7. Check for exact duplicate — log and return early
//      if found (row is NOT written)
//   8. Append new row at the bottom of the table
//   9. Sort table by date descending
//  10. Log full submission to SCEX2_Raw_Extract sheet
// ============================================================
function doPost(e) {
  var spreadsheet     = getSpreadsheet();
  var extractedPlayer = null;
  var matchedPlayer   = "";
  var icao            = "";
  var xp              = "";
  var recordId        = "PENDING";

  try {
    var sheet = spreadsheet.getSheetByName(CONFIG.dataSheet);
    if (!sheet) {
      logToRawExtract(spreadsheet, "ERROR", "ERROR", "", null, null, null, null,
                      "Sheet '" + CONFIG.dataSheet + "' not found");
      return ContentService.createTextOutput(
        "Error: Sheet '" + CONFIG.dataSheet + "' not found"
      );
    }

    var data = JSON.parse(e.postData.contents);
    if (!data.rawText || data.rawText.trim() === "") {
      logToRawExtract(spreadsheet, "ERROR", "ERROR", "", null, null, null, null,
                      "No raw OCR text received");
      return ContentService.createTextOutput("Error: No raw OCR text received");
    }

    // Load lookup data once — shared across all functions
    var lookupData = getLookupData(spreadsheet);
    if (!lookupData) {
      logToRawExtract(spreadsheet, "ERROR", "ERROR", data.rawText,
                      null, null, null, null, "Could not load lookup table");
      return ContentService.createTextOutput("Error: Could not load lookup table");
    }

    // ── EXTRACTION ─────────────────────────────────────────
    extractedPlayer = extractPlayerFromOCR(data.rawText);
    xp              = extractXPFromOCR(data.rawText)            || "";
    icao            = lookupICAOFromOCR(data.rawText, lookupData) || "";

    // Apply fuzzy matching to extracted player name
    matchedPlayer = extractedPlayer
      ? fuzzyMatchPlayer(extractedPlayer, lookupData)
      : "";

    // Apply manual overrides if provided
    if (data.playerOverride && data.playerOverride.trim() !== "") {
      matchedPlayer = fuzzyMatchPlayer(data.playerOverride.trim(), lookupData);
    }
    if (data.xpOverride   && data.xpOverride.trim()   !== "") xp   = data.xpOverride.trim();
    if (data.icaoOverride && data.icaoOverride.trim() !== "") icao = data.icaoOverride.trim();

    // ── PARSE AND NORMALISE DATE TO UTC ───────────────────────
    // The Shortcuts app sends the EXIF datetime string which
    // includes the device timezone offset e.g. "2026-05-13 09:15:00 +1000".
    // new Date() parses the offset correctly into a UTC instant.
    // Utilities.formatDate() then extracts yyyy-MM-dd in UTC
    // so all records are stored in a consistent timezone
    // regardless of where the screenshot was taken.
    // Backwards compatible with short date strings and omitted
    // dates — see SS.ID.10 for full format compatibility notes.
    var recordDate = Utilities.formatDate(
      new Date(), CONFIG.timezone, CONFIG.dateFormat
    );
    if (data.date && data.date.trim() !== "") {
      var parsed = new Date(data.date.trim());
      if (!isNaN(parsed.getTime())) {
        recordDate = Utilities.formatDate(parsed, "UTC", CONFIG.dateFormat);
        Logger.log("doPost: Date normalised to UTC — '" + recordDate +
                   "' from '" + data.date.trim() + "'");
      } else {
        Logger.log("doPost: Could not parse date '" + data.date +
                   "' — using today in " + CONFIG.timezone);
      }
    }

    // ── READ SHEET DATA ────────────────────────────────────
    // Single read — reused for ID generation, duplicate
    // check, header row location and column index lookup
    var sheetValues    = sheet.getDataRange().getValues();
    var headerRowIndex = -1;

    for (var i = 0; i < sheetValues.length; i++) {
      if (sheetValues[i].indexOf(CONFIG.playerCol) !== -1) {
        headerRowIndex = i + 1; // 1-indexed
        break;
      }
    }

    if (headerRowIndex === -1) {
      logToRawExtract(spreadsheet, "ERROR", "ERROR", data.rawText,
                      extractedPlayer, matchedPlayer, icao, xp,
                      "Could not find table header");
      return ContentService.createTextOutput("Error: Could not find table header");
    }

    // Locate column indices from header row (0-indexed for array access)
    var headerRow    = sheetValues[headerRowIndex - 1];
    var idColIdx     = headerRow.indexOf(CONFIG.idCol);
    var playerColIdx = headerRow.indexOf(CONFIG.playerCol);
    var icaoColIdx   = headerRow.indexOf(CONFIG.icaoCol);
    var xpColIdx     = headerRow.indexOf(CONFIG.xpCol);
    var dateColIdx   = headerRow.indexOf(CONFIG.dateCol);

    if (playerColIdx === -1 || icaoColIdx === -1 ||
        xpColIdx     === -1 || dateColIdx === -1 ||
        idColIdx     === -1) {
      logToRawExtract(spreadsheet, "ERROR", "ERROR", data.rawText,
                      extractedPlayer, matchedPlayer, icao, xp,
                      "Could not locate required columns in header row");
      return ContentService.createTextOutput(
        "Error: Could not locate required columns in header row"
      );
    }

    // ── GENERATE RECORD ID ─────────────────────────────────
    recordId = generateRecordId(sheetValues, idColIdx);

    // ── DUPLICATE CHECK ────────────────────────────────────
    var duplicate = isDuplicate(
      sheetValues, headerRowIndex,
      playerColIdx, icaoColIdx, xpColIdx, dateColIdx,
      matchedPlayer, icao, xp, recordDate
    );

    if (duplicate) {
      logToRawExtract(spreadsheet, "DUPLICATE", "DUPLICATE", data.rawText,
                      extractedPlayer, matchedPlayer, icao, xp, "");
      Logger.log("doPost: Exact duplicate — record not written");
      return ContentService.createTextOutput(
        "[DUPLICATE] Record already exists: " +
        matchedPlayer + " — " + icao + " — " + xp + " on " + recordDate
      );
    }

    // ── APPEND ROW ─────────────────────────────────────────
    // Appends the new record at the bottom of the sheet.
    sheet.appendRow([
      recordId,
      matchedPlayer,
      icao,
      xp,
      data.status || "",
      recordDate
    ]);

    // Sort table by date descending after insert.
    sortTableByDate(sheet, sheetValues, headerRowIndex);

    // ── LOG TO RAW EXTRACT ─────────────────────────────────
    logToRawExtract(spreadsheet, recordId, "SUCCESS", data.rawText,
                    extractedPlayer, matchedPlayer, icao, xp, "");

    return ContentService.createTextOutput(
      "[GREAT SUCCESS :D] " + recordId +
      " — " + matchedPlayer +
      " — " + (icao || "NO ICAO") +
      " — " + (xp   || "NO XP") +
      " added"
    );

  } catch (err) {
    Logger.log("doPost: Unhandled error — " + err.message);
    logToRawExtract(spreadsheet, recordId || "ERROR", "ERROR", "",
                    extractedPlayer, matchedPlayer, icao, xp, err.message);
    return ContentService.createTextOutput("Error: " + err.message);
  }
}
