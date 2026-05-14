// ============================================================
// Extract.gs
// Sky Cards EX2 — OCR Extraction Functions
//
// PURPOSE:
//   Extracts structured values (player name, XP) from raw
//   multi-line OCR text produced by the Shortcuts app.
//
// DEPENDS ON:  CONFIG (Config.gs) — categoryWords, rarityWords
// USED BY:     Main.gs (doPost)
// ============================================================


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
  var CATEGORY   = "(?:" + CONFIG.categoryWords.join("|") + ")";
  var RARITY     = "(?:" + CONFIG.rarityWords.join("|")   + ")";
  var VALIDATION = /^(?!GLOW)(?!X\d+$)(?=.*[A-Za-z]).{2,}$/i;

  var blockPattern = new RegExp(
    "[^\\n]*" + CATEGORY + "[^\\n]*\\n([\\s\\S]*?)(?:[^\\n]*" + RARITY + ")",
    "i"
  );
  var match = rawText.match(blockPattern);
  if (!match) {
    Logger.log("extractPlayerFromOCR: No category/rarity block found");
    return null;
  }

  var lines      = match[1].split("\n");
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
// EXTRACT XP FROM RAW OCR TEXT
// Finds all occurrences of a number immediately before the
// text "XP" in the OCR output. Takes the last occurrence
// which is consistently the clean formatted value in the
// card footer. Strips spaces used as thousand separators
// and validates the result is a plausible XP number.
// Returns a formatted string with commas e.g. "5,217,630".
// ============================================================
function extractXPFromOCR(rawText) {
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

  var rawXP   = matches[matches.length - 1];
  var xpClean = rawXP.replace(/\s+/g, "");

  var digitCount = xpClean.length;
  if (digitCount < CONFIG.xpMinDigits || digitCount > CONFIG.xpMaxDigits) {
    Logger.log("extractXPFromOCR: Value '" + xpClean +
               "' outside plausible digit range");
    return null;
  }

  var formatted = parseInt(xpClean, 10).toLocaleString("en-US");
  Logger.log("extractXPFromOCR: Extracted '" + formatted + "'");
  return formatted;
}
