// ============================================================
// Records.gs
// Sky Cards EX2 — Record Management Functions
//
// PURPOSE:
//   Handles all record-level operations: generating unique
//   IDs, checking for duplicates, logging to the raw extract
//   sheet, and sorting the data table by date.
//
// DEPENDS ON:  CONFIG (Config.gs)
// USED BY:     Main.gs (doPost)
// ============================================================


// ============================================================
// GENERATE RECORD ID
// Produces a unique ID in the format SC-YYMMDD-NNNNN where:
//   SC     = CONFIG.idPrefix
//   YYMMDD = today's UTC date (submission date, not photo date)
//   NNNNN  = zero-padded integer, incremented by scanning
//             the highest existing ID for today in column A
//             of the data sheet.
//
// Scanning is done from the already-read sheetValues array
// so no additional API call is needed.
//
// Example: SC-260510-00001, SC-260510-00002
// ============================================================
function generateRecordId(sheetValues, idColIdx) {
  var today   = Utilities.formatDate(new Date(), "UTC", CONFIG.idDateFormat);
  var prefix  = CONFIG.idPrefix + "-" + today + "-";
  var highest = 0;

  // Scan all rows for IDs matching today's prefix
  for (var i = 0; i < sheetValues.length; i++) {
    var cell = sheetValues[i][idColIdx]
      ? sheetValues[i][idColIdx].toString().trim()
      : "";

    if (cell.indexOf(prefix) === 0) {
      var suffix = parseInt(cell.replace(prefix, ""), 10);
      if (!isNaN(suffix) && suffix > highest) {
        highest = suffix;
      }
    }
  }

  // Pad the next integer to CONFIG.idPadLength digits
  var next   = highest + 1;
  var padded = next.toString();
  while (padded.length < CONFIG.idPadLength) {
    padded = "0" + padded;
  }

  var newId = prefix + padded;
  Logger.log("generateRecordId: Generated '" + newId + "'");
  return newId;
}


// ============================================================
// CHECK FOR DUPLICATE RECORD
// Scans all existing data rows looking for a record where
// Player, ICAO, XP and Date all match the incoming values.
// Uses the sheetValues array already read in doPost() so
// no additional API call is needed.
//
// XP values are normalised (commas and spaces stripped) before
// comparison so formatting differences do not cause misses.
// Date comparison strips any time component so "2026-05-10"
// and "2026-05-10 09:15" are treated as the same date.
//
// Returns true if an exact duplicate is found.
// Returns false if the record is new.
// ============================================================
function isDuplicate(sheetValues, headerRowIndex,
                      playerColIdx, icaoColIdx,
                      xpColIdx, dateColIdx,
                      newPlayer, newICAO, newXP, newDate) {

  var newXPNorm   = newXP.toString().replace(/[,\s]/g, "");
  var newDateOnly = newDate.toString().split("T")[0].split(" ")[0].trim();

  for (var i = headerRowIndex; i < sheetValues.length; i++) {
    var row = sheetValues[i];

    var rowPlayer   = row[playerColIdx] ? row[playerColIdx].toString().trim()            : "";
    var rowICAO     = row[icaoColIdx]   ? row[icaoColIdx].toString().trim()              : "";
    var rowXPNorm   = row[xpColIdx]     ? row[xpColIdx].toString().replace(/[,\s]/g, "") : "";

    // Sheets returns dates as JS Date objects via getValues() — must use
    // Utilities.formatDate() to get a plain yyyy-MM-dd string for comparison.
    // Falls back to string parsing for plain-string dates in test mock data.
    var rowDateOnly = "";
    if (row[dateColIdx]) {
      var d = row[dateColIdx];
      if (d instanceof Date) {
        rowDateOnly = Utilities.formatDate(d, "UTC", "yyyy-MM-dd");
      } else {
        rowDateOnly = d.toString().split("T")[0].split(" ")[0].trim();
      }
    }

    if (rowPlayer   === newPlayer   &&
        rowICAO     === newICAO     &&
        rowXPNorm   === newXPNorm   &&
        rowDateOnly === newDateOnly) {
      Logger.log(
        "isDuplicate: Match found at row " + (i + 1) +
        " — Player: " + rowPlayer + ", ICAO: " + rowICAO +
        ", XP: " + rowXPNorm + ", Date: " + rowDateOnly
      );
      return true;
    }
  }

  Logger.log("isDuplicate: No duplicate found — record is new");
  return false;
}


// ============================================================
// LOG TO RAW EXTRACT SHEET
// Appends one row to the SCEX2_Raw_Extract sheet for every
// submission — successful, duplicate, or error — so raw OCR
// text is always preserved for manual inspection.
//
// Columns written (always appended to the end of the sheet):
//   A — Record ID (or "DUPLICATE" / "ERROR" if not written)
//   B — Submission timestamp (UTC)
//   C — Outcome (SUCCESS / DUPLICATE / ERROR)
//   D — Raw OCR text
//   E — Extracted player name (before fuzzy match)
//   F — Fuzzy matched player name
//   G — Extracted ICAO
//   H — Extracted XP
//   I — Error message (if any)
//
// Creates the sheet and header row automatically if the sheet
// does not yet exist in the spreadsheet.
// ============================================================
function logToRawExtract(spreadsheet, recordId, outcome,
                          rawText, extractedPlayer,
                          matchedPlayer, icao, xp, errorMsg) {

  var sheet = spreadsheet.getSheetByName(CONFIG.rawExtractSheet);

  // Create the sheet and write headers if it does not exist
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.rawExtractSheet);
    sheet.appendRow([
      "ID",
      "Timestamp (UTC)",
      "Outcome",
      "Raw OCR Text",
      "Extracted Player",
      "Matched Player",
      "ICAO",
      "XP",
      "Error"
    ]);
    Logger.log("logToRawExtract: Created '" + CONFIG.rawExtractSheet + "' sheet");
  }

  var timestamp = Utilities.formatDate(new Date(), "UTC", CONFIG.timestampFormat);

  sheet.appendRow([
    recordId        || "",
    timestamp,
    outcome         || "",
    rawText         || "",
    extractedPlayer || "",
    matchedPlayer   || "",
    icao            || "",
    xp              || "",
    errorMsg        || ""
  ]);

  Logger.log(
    "logToRawExtract: Logged '" + outcome +
    "' for ID '" + recordId + "'"
  );
}


// ============================================================
// SORT TABLE BY DATE DESCENDING
// Accepts the sheet object, the pre-read sheetValues array,
// and the already-resolved headerRowIndex (1-indexed) from
// doPost() — eliminating the need to re-scan sheetValues
// for the header row and date column here.
// Sorts all data rows below the header by date descending
// so the most recent entry always appears at the top.
// ============================================================
function sortTableByDate(sheet, sheetValues, headerRowIndex) {

  var headerValues = sheetValues[headerRowIndex - 1];
  var dateCol      = -1;

  for (var i = 0; i < headerValues.length; i++) {
    if (headerValues[i].toString().trim() === CONFIG.dateCol) {
      dateCol = i + 1; // convert to 1-indexed
      break;
    }
  }

  if (dateCol === -1) {
    Logger.log("sortTableByDate: Could not find '" + CONFIG.dateCol + "' column");
    return;
  }

  var firstDataRow = headerRowIndex + 1;
  var lastRow      = sheet.getLastRow();
  var lastCol      = sheet.getLastColumn();

  if (lastRow <= headerRowIndex) {
    Logger.log("sortTableByDate: No data rows to sort");
    return;
  }

  sheet.getRange(firstDataRow, 1, lastRow - headerRowIndex, lastCol)
    .sort({ column: dateCol, ascending: false });

  Logger.log("sortTableByDate: Sorted by '" + CONFIG.dateCol + "' descending");
}
