// ============================================================
// Lookup.gs
// Sky Cards EX2 — Lookup Table and Matching Functions
//
// PURPOSE:
//   Reads the Lookup Tables sheet and provides fuzzy player
//   name matching and ICAO code resolution from OCR text.
//
// DEPENDS ON:  CONFIG (Config.gs)
//              levenshteinDistance, normaliseOCR,
//              findColIndex (Utils.gs)
// USED BY:     Main.gs (doPost)
// ============================================================


// ============================================================
// GET LOOKUP TABLE DATA
// Receives the already-open spreadsheet object from doPost()
// so getSpreadsheet() is only called once per submission.
// Returns all cell values as a 2D array, shared across all
// functions that need it to avoid repeated sheet reads.
// ============================================================
function getLookupData(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(CONFIG.lookupSheet);
  if (!sheet) {
    Logger.log("Error: Lookup sheet '" + CONFIG.lookupSheet + "' not found");
    return null;
  }
  return sheet.getDataRange().getValues();
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

  var bestMatch    = inputName;
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
    if (icao && fullName) {
      aircraft.push({ icao: icao, name: fullName });
    }
  }
  aircraft.sort(function(a, b) { return b.name.length - a.name.length; });

  var fullNorm  = normaliseOCR(rawText);
  var rarityPos = -1;

  for (var r = 0; r < CONFIG.rarityWords.length; r++) {
    var pos = fullNorm.indexOf(CONFIG.rarityWords[r]);
    if (pos !== -1 && (rarityPos === -1 || pos < rarityPos)) {
      rarityPos = pos;
    }
  }

  var searchText;
  if (rarityPos !== -1) {
    searchText = fullNorm.substring(rarityPos);
    Logger.log("lookupICAOFromOCR: Rarity word at position " + rarityPos +
               " — scanning aircraft section only");
  } else {
    searchText = fullNorm;
    Logger.log("lookupICAOFromOCR: Warning — no rarity word found, scanning full text");
  }

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
