// ============================================================
// CONFIGURATION — update these values only
// ============================================================
var CONFIG = {
  spreadsheetId:    "[INSERT GOOGLE SHEET ID HERE]",
  dataSheet:        "[TEST] Shortcut DUMP",
  lookupSheet:      "Lookup Tables",
  playerCol:        "Player",
  icaoCol:          "ICAO",
  aircraftCol:      "Full Name",
  dateCol:          "Date (UTC)",
  matchThreshold:   3,
  rarityWords:      ["COMMON", "UNCOMMON", "SCARCE", "RARE",
                     "ULTRA", "HISTORICAL", "FANTASY"],
  xpMinDigits:      4,
  xpMaxDigits:      12
};


// ============================================================
// OPEN SPREADSHEET ONCE — reused across all functions
// ============================================================
function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.spreadsheetId);
}


// ============================================================
// LEVENSHTEIN DISTANCE
// Measures how many single-character edits (insertions,
// deletions, substitutions) are needed to change string a
// into string b. Used to fuzzy match OCR misreads to known
// player names in the lookup table.
// ============================================================
function levenshteinDistance(a, b) {
  a = a.toUpperCase().trim();
  b = b.toUpperCase().trim();

  var matrix = [];
  for (var i = 0; i <= b.length; i++) matrix[i] = [i];
  for (var j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (var i = 1; i <= b.length; i++) {
    for (var j = 1; j <= a.length; j++) {
      matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
        ? matrix[i - 1][j - 1]
        : Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1]     + 1,
            matrix[i - 1][j]     + 1
          );
    }
  }
  return matrix[b.length][a.length];
}


// ============================================================
// GET LOOKUP TABLE DATA
// Opens the lookup sheet and returns all cell values as a
// 2D array. Called once per request and passed to all
// functions that need it to avoid repeated sheet reads.
// ============================================================
function getLookupData() {
  var sheet = getSpreadsheet().getSheetByName(CONFIG.lookupSheet);
  if (!sheet) {
    Logger.log("Error: Lookup sheet '" + CONFIG.lookupSheet + "' not found");
    return null;
  }
  return sheet.getDataRange().getValues();
}


// ============================================================
// FIND COLUMN INDEX BY HEADER NAME
// Scans a 2D array for a matching header string and returns
// its row and column index. Used to locate columns
// dynamically so the script is not dependent on fixed
// column positions in the spreadsheet.
// ============================================================
function findColIndex(data, headerName) {
  for (var i = 0; i < data.length; i++) {
    for (var j = 0; j < data[i].length; j++) {
      if (data[i][j].toString().trim() === headerName) {
        return { row: i, col: j };
      }
    }
  }
  return null;
}


// ============================================================
// NORMALISE OCR TEXT
// Replaces newline characters with spaces and collapses
// multiple consecutive spaces into one. Converts to
// uppercase. This produces a single clean searchable string
// from multi-line OCR output.
// ============================================================
function normaliseOCR(rawText) {
  return rawText
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}


// ============================================================
// EXTRACT PLAYER NAME FROM RAW OCR TEXT
// Uses a two-step approach:
//   Step 1 — Capture the text block between a category word
//             (weight, wingspan, seats, etc.) and a rarity
//             word (ULTRA, COMMON, etc.) using regex.
//             This isolates the section of the OCR where the
//             player name always appears.
//   Step 2 — Filter the lines in that block to find valid
//             player name candidates by excluding:
//             - Lines starting with GLOW
//             - Lines that are only a card multiplier (X72)
//             - Lines with no letters at all
//             - Lines shorter than 2 characters
//             The last remaining candidate is the player name
//             as it always appears immediately before the
//             rarity word line.
// ============================================================
function extractPlayerFromOCR(rawText) {
  var CATEGORY = "(?:weight|[a-zA-Z]ingspan|seats|rarity|aircraft|year|speed)";
  var RARITY   = "(?:ULTRA|COMMON|UNCOMMON|SCARCE|RARE|HISTORICAL|FANTASY|PANTASY)";
  var VALIDATION = /^(?!GLOW)(?!X\d+$)(?=.*[A-Za-z]).{2,}$/i;

  // Step 1: capture block between category word and rarity word
  var blockPattern = new RegExp(
    "[^\\n]*" + CATEGORY + "[^\\n]*\\n([\\s\\S]*?)(?:[^\\n]*" + RARITY + ")",
    "i"
  );
  var match = rawText.match(blockPattern);
  if (!match) {
    Logger.log("extractPlayerFromOCR: No category/rarity block found");
    return null;
  }

  // Step 2: filter block lines to find valid candidates
  var lines = match[1].split("\n");
  var candidates = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (VALIDATION.test(line)) {
      candidates.push(line);
    }
  }

  if (candidates.length === 0) {
    Logger.log("extractPlayerFromOCR: No valid candidates found in block");
    return null;
  }

  var result = candidates[candidates.length - 1];
  Logger.log("extractPlayerFromOCR: Extracted '" + result + "'");
  return result;
}


// ============================================================
// FUZZY MATCH PLAYER NAME
// Takes the raw OCR player name and compares it against
// every known player in the lookup table using Levenshtein
// distance. Returns the closest match if it is within the
// configured threshold. Falls back to the original OCR
// value if no close match is found so the name is never
// silently lost.
// ============================================================
function fuzzyMatchPlayer(inputName, lookupData) {
  if (!inputName || inputName.trim() === "") {
    Logger.log("fuzzyMatchPlayer: Empty input name");
    return inputName;
  }

  var found = findColIndex(lookupData, CONFIG.playerCol);
  if (!found) {
    Logger.log("Error: Could not find '" + CONFIG.playerCol + "' column");
    return inputName;
  }

  var bestMatch   = inputName;
  var bestDistance = Infinity;

  for (var i = found.row + 1; i < lookupData.length; i++) {
    var playerName = lookupData[i][found.col].toString().trim();
    if (playerName === "") continue;

    var distance = levenshteinDistance(inputName, playerName);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch    = playerName;
    }
  }

  if (bestDistance <= CONFIG.matchThreshold) {
    Logger.log("fuzzyMatchPlayer: '" + inputName + "' → '" + bestMatch +
               "' (distance: " + bestDistance + ")");
    return bestMatch;
  }

  Logger.log("fuzzyMatchPlayer: No match for '" + inputName +
             "' — best was '" + bestMatch + "' (distance: " + bestDistance + ")");
  return inputName;
}


// ============================================================
// EXTRACT XP FROM RAW OCR TEXT
// Finds all occurrences of a number immediately before the
// text "XP" in the OCR output. Takes the last occurrence
// which is consistently the clean formatted value in the
// card footer. Strips spaces used as thousand separators
// and validates the result is a plausible XP number.
// Returns a formatted string with commas e.g. "5,217,630".
// ============================================================
function extractXPFromOCR(rawText) {
  // Match all digit groups followed by XP
  var xpPattern = /([\d\s]+)\s*XP/gi;
  var matches   = [];
  var match;

  while ((match = xpPattern.exec(rawText)) !== null) {
    matches.push(match[1].trim());
  }

  if (matches.length === 0) {
    Logger.log("extractXPFromOCR: No XP value found");
    return null;
  }

  // Take the last match — consistently the clean card footer value
  var rawXP  = matches[matches.length - 1];
  var xpClean = rawXP.replace(/\s+/g, "");

  // Validate digit count is within plausible XP range
  var digitCount = xpClean.length;
  if (digitCount < CONFIG.xpMinDigits || digitCount > CONFIG.xpMaxDigits) {
    Logger.log("extractXPFromOCR: Value '" + xpClean +
               "' outside plausible digit range");
    return null;
  }

  // Format with commas
  var formatted = parseInt(xpClean, 10).toLocaleString("en-US");
  Logger.log("extractXPFromOCR: Extracted '" + formatted + "'");
  return formatted;
}


// ============================================================
// LOOKUP ICAO FROM RAW OCR TEXT — hybrid positional approach
// Scans only the text AFTER the first rarity word to avoid
// false positive matches against player names that could
// share a short aircraft name (e.g. DRONE, SANTA).
// Aircraft names are sorted longest-first before scanning
// to ensure longer specific names match before shorter
// substrings of those names can match incorrectly.
// Falls back to full text scan if no rarity word is found.
// ============================================================
function lookupICAOFromOCR(rawText, lookupData) {
  if (!rawText || rawText.trim() === "") {
    Logger.log("lookupICAOFromOCR: Empty OCR text received");
    return null;
  }

  // Find ICAO and Full Name column indices
  var icaoFound = findColIndex(lookupData, CONFIG.icaoCol);
  var nameFound = findColIndex(lookupData, CONFIG.aircraftCol);

  if (!icaoFound || !nameFound) {
    Logger.log("Error: Could not find ICAO or Full Name columns");
    return null;
  }

  // Build aircraft list sorted longest name first
  var aircraft = [];
  for (var i = icaoFound.row + 1; i < lookupData.length; i++) {
    var icao     = lookupData[i][icaoFound.col].toString().trim();
    var fullName = lookupData[i][nameFound.col].toString().trim().toUpperCase();
    if (icao && fullName && icao !== "nan" && fullName !== "nan") {
      aircraft.push({ icao: icao, name: fullName });
    }
  }
  aircraft.sort(function(a, b) { return b.name.length - a.name.length; });

  // Normalise OCR text to single searchable line
  var fullNorm = normaliseOCR(rawText);

  // Find the earliest rarity word position — everything after is aircraft territory
  var rarityPos = -1;
  for (var r = 0; r < CONFIG.rarityWords.length; r++) {
    var pos = fullNorm.indexOf(CONFIG.rarityWords[r]);
    if (pos !== -1 && (rarityPos === -1 || pos < rarityPos)) {
      rarityPos = pos;
    }
  }

  // Use text after rarity word or full text if no rarity word found
  var searchText;
  if (rarityPos !== -1) {
    searchText = fullNorm.substring(rarityPos);
    Logger.log("lookupICAOFromOCR: Rarity word at position " + rarityPos +
               " — scanning aircraft section only");
  } else {
    searchText = fullNorm;
    Logger.log("lookupICAOFromOCR: Warning — no rarity word found, scanning full text");
  }

  // Scan search window for aircraft names longest first
  for (var i = 0; i < aircraft.length; i++) {
    if (searchText.indexOf(aircraft[i].name) !== -1) {
      Logger.log("lookupICAOFromOCR: Matched '" + aircraft[i].name +
                 "' → " + aircraft[i].icao);
      return aircraft[i].icao;
    }
  }

  Logger.log("lookupICAOFromOCR: No aircraft match found");
  return null;
}


// ============================================================
// SORT TABLE BY DATE DESCENDING
// Locates the header row by searching for the player column
// header, then finds the date column by name. Sorts all
// data rows below the header by date in descending order
// so the most recent entry always appears at the top.
// Accepts the sheet as a parameter to reuse the already-
// open sheet object rather than reopening it.
// ============================================================
function sortTableByDate(sheet) {
  var values         = sheet.getDataRange().getValues();
  var headerRowIndex = -1;

  for (var i = 0; i < values.length; i++) {
    if (values[i].indexOf(CONFIG.playerCol) !== -1) {
      headerRowIndex = i + 1; // convert to 1-indexed
      break;
    }
  }

  if (headerRowIndex === -1) {
    Logger.log("sortTableByDate: Could not find table header row");
    return;
  }

  var headerValues = values[headerRowIndex - 1];
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


// ============================================================
// MAIN POST HANDLER
// Entry point called by the Shortcuts app via HTTP POST.
// Receives the raw OCR text and optional manual overrides.
// Orchestrates all extraction and lookup functions then
// writes the result to the spreadsheet.
//
// Expected JSON body from Shortcuts:
// {
//   "rawText":      "<full OCR text from screenshot>",
//   "status":       "Confirmed",
//   "date":         "2026-05-10"
// }
//
// Optional override fields (populated from Ask for Input
// if auto-extraction is reviewed and corrected):
// {
//   "playerOverride": "<corrected player name>",
//   "xpOverride":     "<corrected XP value>",
//   "icaoOverride":   "<corrected ICAO code>"
// }
// ============================================================
function doPost(e) {
  try {
    var spreadsheet = getSpreadsheet();
    var sheet       = spreadsheet.getSheetByName(CONFIG.dataSheet);

    if (!sheet) {
      return ContentService.createTextOutput(
        "Error: Sheet '" + CONFIG.dataSheet + "' not found"
      );
    }

    var data = JSON.parse(e.postData.contents);

    if (!data.rawText || data.rawText.trim() === "") {
      return ContentService.createTextOutput("Error: No raw OCR text received");
    }

    // Load lookup data once — shared across all functions
    var lookupData = getLookupData();
    if (!lookupData) {
      return ContentService.createTextOutput("Error: Could not load lookup table");
    }

    // Extract all three fields from raw OCR
    var extractedPlayer = extractPlayerFromOCR(data.rawText);
    var extractedXP     = extractXPFromOCR(data.rawText);
    var extractedICAO   = lookupICAOFromOCR(data.rawText, lookupData);

    // Apply fuzzy matching to extracted player name
    var playerName = extractedPlayer
      ? fuzzyMatchPlayer(extractedPlayer, lookupData)
      : "";

    // Apply manual overrides if provided (from Ask for Input corrections)
    if (data.playerOverride && data.playerOverride.trim() !== "") {
      playerName = fuzzyMatchPlayer(data.playerOverride.trim(), lookupData);
    }
    var xp   = (data.xpOverride   && data.xpOverride.trim()   !== "")
      ? data.xpOverride.trim()
      : (extractedXP || "");
    var icao = (data.icaoOverride && data.icaoOverride.trim() !== "")
      ? data.icaoOverride.trim()
      : (extractedICAO || "");

    // Find the header row of the Player XP table
    var values         = sheet.getDataRange().getValues();
    var headerRowIndex = -1;

    for (var i = 0; i < values.length; i++) {
      if (values[i].indexOf(CONFIG.playerCol) !== -1) {
        headerRowIndex = i + 1; // convert to 1-indexed
        break;
      }
    }

    if (headerRowIndex === -1) {
      return ContentService.createTextOutput("Error: Could not find table header");
    }

    var firstDataRow = headerRowIndex + 1;
    var lastCol      = sheet.getLastColumn();
    var sourceRange  = sheet.getRange(firstDataRow, 1, 1, lastCol);
    var formulaRow   = sourceRange.getFormulas()[0];

    // Insert new row immediately below header
    sheet.insertRowAfter(headerRowIndex);

    // Copy formatting from first data row to preserve table styling
    var newRow = sheet.getRange(headerRowIndex + 1, 1, 1, lastCol);
    sourceRange.copyTo(newRow, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);

    // Restore any formula columns from the first data row
    for (var col = 0; col < formulaRow.length; col++) {
      if (formulaRow[col] !== "") {
        sheet.getRange(headerRowIndex + 1, col + 1).setFormula(formulaRow[col]);
      }
    }

    // Write extracted data into columns B–F only
    sheet.getRange(headerRowIndex + 1, 2, 1, 5).setValues([[
      playerName,
      icao,
      xp,
      data.status || "",
      data.date   || ""
    ]]);

    // Sort table by date descending after insert
    sortTableByDate(sheet);

    return ContentService.createTextOutput(
      "[GREAT SUCCESS :D] " + playerName +
      " — " + (icao || "NO ICAO") +
      " — " + (xp   || "NO XP") +
      " added"
    );

  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.message);
  }
}


// ============================================================
// TEST FUNCTIONS
// ============================================================

function testLevenshtein() {
  Logger.log("=== LEVENSHTEIN DISTANCE TEST ===");
  var cases = [
    ["Woofles",    "Woofles",    0],
    ["Wooflez",    "Woofles",    1],
    ["W00fles",    "Woofles",    2],
    ["Audnderaide","Audhdelaide",3],
    ["XYZ",        "Woofles",    99]
  ];
  for (var i = 0; i < cases.length; i++) {
    var dist   = levenshteinDistance(cases[i][0], cases[i][1]);
    var status = dist === cases[i][2] || cases[i][2] === 99 ? "✅" : "❌";
    Logger.log(status + " '" + cases[i][0] + "' vs '" + cases[i][1] +
               "' = " + dist);
  }
}

function testExtractPlayer() {
  Logger.log("=== PLAYER EXTRACTION TEST ===");
  var cases = [
    ["ND 5: t seats\nKitty\n- ULTRA=",                    "Kitty"],
    ["75\nND 2:\nt speed\nTuck5829\n- ULTRA",              "Tuck5829"],
    ["ND 4: : weight\nZekafer\nGLOW X32\n= UNCOMMON E",   "Zekafer"],
    ["•ll 5G\n954\nND 5:\nt rarity\nدمي)\nOlifly\nZ ULTRA G", "Olifly"],
    ["ND 2:\nseats\nx\nJapaokawa\nGLOW X75\n= UNCOMMON S","Japaokawa"]
  ];
  for (var i = 0; i < cases.length; i++) {
    var result = extractPlayerFromOCR(cases[i][0]);
    var status = result === cases[i][1] ? "✅" : "❌";
    Logger.log(status + " Expected: '" + cases[i][1] +
               "' | Got: '" + result + "'");
  }
}

function testExtractXP() {
  Logger.log("=== XP EXTRACTION TEST ===");
  var cases = [
    ["CYBER 5 217 630 XP • 100%\n0%",         "5,217,630"],
    ["CYBER 39 525 676 XP • 100%\n0%",        "39,525,676"],
    ["CYBER 67 304 688 XP 099%\n67 304 688 XP","67,304,688"],
    ["CYBER 120 670 XP • 100%",               "120,670"],
    ["NO XP HERE",                             null]
  ];
  for (var i = 0; i < cases.length; i++) {
    var result = extractXPFromOCR(cases[i][0]);
    var status = result === cases[i][1] ? "✅" : "❌";
    Logger.log(status + " Expected: '" + cases[i][1] +
               "' | Got: '" + result + "'");
  }
}

function testFuzzyMatch() {
  Logger.log("=== FUZZY MATCH TEST ===");
  var lookupData = getLookupData();
  var cases = [
    "Woofles",
    "W00fles",
    "ScubaSteve28",
    "ScubaSteve82",
    "Audnderaide",
    "UnknownXYZPlayer"
  ];
  for (var i = 0; i < cases.length; i++) {
    var result = fuzzyMatchPlayer(cases[i], lookupData);
    Logger.log("Input: '" + cases[i] + "' → '" + result + "'");
  }
}

function testICAOLookup() {
  Logger.log("=== ICAO LOOKUP TEST ===");
  var lookupData = getLookupData();
  var cases = [
    ["= UNCOMMON S\nAIRBUS\nA380\n2005\nFIRST FLIGHT\n3.11\nRARITY\nCYBER 39 525 676 XP", "A388"],
    ["- ULTRA &\nSOLAR IMPULSE 2\n2014\n10.90\nFIRST FLIGHT\nCYBER 5 217 630 XP",         "SOL2"],
    ["= ULTRA =\nBOEING\n777-300ER\n2003\n1.55\nFIRST FLIGHT",                            "B77W"]
  ];
  for (var i = 0; i < cases.length; i++) {
    var result = lookupICAOFromOCR(cases[i][0], lookupData);
    var status = result === cases[i][1] ? "✅" : "❌";
    Logger.log(status + " Expected: " + cases[i][1] + " | Got: " + result);
  }
}

function testPost() {
  Logger.log("=== FULL POST TEST ===");
  var mockEvent = {
    postData: {
      contents: JSON.stringify({
        rawText: "•ll 5G\n60\nND 3:\n: speed\nC-mooon\nGLOW X72\nUNCOMMON B\nAIRBUS\nA380\n2005\nFIRST FLIGHT\n79.8\nWINGSPAN, M\n868\nSEATS\n3.11\nRARITY\n561\nSPEED, KT\n575\nWEIGHT, T\nCYBER 39 525 676 XP • 100%\n0%",
        status:  "Confirmed",
        date:    "2026-05-10"
      })
    }
  };
  Logger.log(doPost(mockEvent).getContent());
}

function testSortByDate() {
  Logger.log("=== SORT TEST ===");
  var sheet = getSpreadsheet().getSheetByName(CONFIG.dataSheet);
  if (!sheet) { Logger.log("Error: Sheet not found"); return; }
  sortTableByDate(sheet);
}

function testAll() {
  Logger.log("============================");
  Logger.log("RUNNING ALL TESTS");
  Logger.log("============================");
  testLevenshtein();
  testExtractPlayer();
  testExtractXP();
  testFuzzyMatch();
  testICAOLookup();
  testPost();
}
