// ============================================================
// CONFIG.gs
// Sky Cards EX2 — Project Configuration
//
// PURPOSE:
//   Central configuration file for all tunable values.
//   Safe to commit to GitHub — no sensitive data is stored
//   here. The spreadsheetId is read at runtime from
//   Script Properties (set once manually via the Apps Script
//   editor: Project Settings → Script Properties).
//
// DEPENDS ON:  nothing
// USED BY:     Main.gs, Records.gs, Extract.gs,
//              Lookup.gs, Utils.gs
//
// ── HOW TO SET THE SPREADSHEET ID ──────────────────────────
//   1. Open your Apps Script project
//   2. Click the gear icon → "Project Settings"
//   3. Scroll to "Script Properties"
//   4. Click "Add Script Property"
//   5. Key:   SPREADSHEET_ID
//      Value: your full Google Sheets ID
//   6. Save. The script will read it automatically.
// ============================================================

var CONFIG = {

  // ── SHEET NAMES ──────────────────────────────────────────
  dataSheet:        "[TEST] Shortcut DUMP",
  lookupSheet:      "Lookup Tables",
  rawExtractSheet:  "SCEX2_Raw_Extract",

  // ── COLUMN HEADER NAMES ──────────────────────────────────
  playerCol:        "Player",
  icaoCol:          "ICAO",
  aircraftCol:      "Full Name",
  dateCol:          "Date (UTC)",
  idCol:            "ID",
  xpCol:            "XP",

  // ── FUZZY MATCH ──────────────────────────────────────────
  matchThreshold:   3,

  // ── RARITY WORDS (used for OCR sectioning) ───────────────
  // Used both for ICAO positional lookup (Lookup.gs) and
  // player extraction regex (Extract.gs). Add new rarity
  // types here only — no other file needs to change.
  rarityWords:      ["COMMON", "UNCOMMON", "SCARCE", "RARE",
                     "ULTRA", "HISTORICAL", "FANTASY"],

  // ── CATEGORY WORDS (used for player extraction regex) ────
  // Stat label words that appear immediately before the
  // player name block in the OCR output.
  categoryWords:    ["weight", "wingspan", "seats", "rarity",
                     "aircraft", "year", "speed"],

  // ── XP VALIDATION ────────────────────────────────────────
  xpMinDigits:      4,
  xpMaxDigits:      12,

  // ── DATE / TIMESTAMP FORMATS ─────────────────────────────
  dateFormat:       "yyyy-MM-dd",
  timestampFormat:  "yyyy-MM-dd HH:mm:ss",

  // ── TIMEZONE ─────────────────────────────────────────────
  // Fallback timezone used if no date is provided in the
  // incoming payload. Uses IANA timezone names.
  // Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
  timezone:         "UTC",

  // ── RECORD ID FORMAT ─────────────────────────────────────
  idPrefix:         "SC",
  idDateFormat:     "yyMMdd",
  idPadLength:      5

};


// ============================================================
// GET SPREADSHEET ID FROM SCRIPT PROPERTIES
// Called once in getSpreadsheet() (Main.gs). Returns the
// value stored under the key "SPREADSHEET_ID" in
// Project Settings → Script Properties.
//
// Throws a descriptive error if the property is missing so
// the cause is immediately obvious in the execution log.
// ============================================================
function getSpreadsheetId() {
  var id = PropertiesService
    .getScriptProperties()
    .getProperty("SPREADSHEET_ID");

  if (!id || id.trim() === "") {
    throw new Error(
      "Script Property 'SPREADSHEET_ID' is not set. " +
      "Go to Project Settings → Script Properties and add it."
    );
  }

  return id.trim();
}
