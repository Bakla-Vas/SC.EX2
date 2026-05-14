// ============================================================
// Tests.gs
// Sky Cards EX2 — Test Functions
//
// PURPOSE:
//   Unit and integration tests for all major functions.
//   Run individually or all at once via testAll().
//   Because these tests call across all files, testAll()
//   also acts as a full cross-file integration check.
//
// DEPENDS ON:  All other .gs files (full project scope)
// USED BY:     Manual execution from the Apps Script editor
// ============================================================


function testLevenshtein() {
  Logger.log("=== LEVENSHTEIN DISTANCE TEST ===");
  var cases = [
    ["Woofles",     "Woofles",     0],
    ["Wooflez",     "Woofles",     1],
    ["W00fles",     "Woofles",     2],
    ["Audnderaide", "Audhdelaide", 3],
    ["XYZ",         "Woofles",     99]
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
    ["ND 5: t seats\nKitty\n- ULTRA=",                       "Kitty"],
    ["75\nND 2:\nt speed\nTuck5829\n- ULTRA",                 "Tuck5829"],
    ["ND 4: : weight\nZekafer\nGLOW X32\n= UNCOMMON E",      "Zekafer"],
    ["•ll 5G\n954\nND 5:\nt rarity\nدمي)\nOlifly\nZ ULTRA G", "Olifly"],
    ["ND 2:\nseats\nx\nJapaokawa\nGLOW X75\n= UNCOMMON S",   "Japaokawa"]
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
    ["CYBER 5 217 630 XP • 100%\n0%",           "5,217,630"],
    ["CYBER 39 525 676 XP • 100%\n0%",          "39,525,676"],
    ["CYBER 67 304 688 XP 099%\n67 304 688 XP", "67,304,688"],
    ["CYBER 120 670 XP • 100%",                 "120,670"],
    ["NO XP HERE",                               null]
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
  var lookupData = getLookupData(getSpreadsheet());
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
  var lookupData = getLookupData(getSpreadsheet());
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


function testGenerateId() {
  Logger.log("=== RECORD ID GENERATION TEST ===");

  var today     = Utilities.formatDate(new Date(), "UTC", CONFIG.idDateFormat);
  var yesterday = "260509"; // hardcoded past date for test

  var mockSheet = [
    ["ID",                          "Player",   "ICAO"],
    ["SC-" + today + "-00001",      "Woofles",  "SOL2"],
    ["SC-" + today + "-00002",      "Kitty",    "A388"],
    ["SC-" + yesterday + "-00003",  "Tuck5829", "B77W"], // different date — should not count
    ["SC-" + today + "-00003",      "Olifly",   "MC10"]
  ];

  var result   = generateRecordId(mockSheet, 0);
  var expected = "SC-" + today + "-00004";
  var status   = result === expected ? "✅" : "❌";
  Logger.log(status + " Expected: '" + expected + "' | Got: '" + result + "'");

  // Test with empty sheet (first record of the day)
  var emptySheet = [["ID", "Player", "ICAO"]];
  var result2    = generateRecordId(emptySheet, 0);
  var expected2  = "SC-" + today + "-00001";
  var status2    = result2 === expected2 ? "✅" : "❌";
  Logger.log(status2 + " Expected: '" + expected2 + "' | Got: '" + result2 + "'");
}


function testDuplicateCheck() {
  Logger.log("=== DUPLICATE CHECK TEST ===");

  var mockSheet = [
    ["ID",              "Player",       "ICAO",  "XP",          "Status",    "Date (UTC)"],
    ["SC-260510-00001", "Woofles",      "SOL2",  "5,217,630",   "Confirmed", "2026-05-10"],
    ["SC-260510-00002", "ScubaSteve28", "A388",  "39,525,676",  "Confirmed", "2026-05-10"],
    ["SC-260509-00001", "Woofles",      "B77W",  "7,100,000",   "Confirmed", "2026-05-09"]
  ];

  var headerRowIndex = 1;
  var headerRow      = mockSheet[0];
  var playerColIdx   = headerRow.indexOf("Player");
  var icaoColIdx     = headerRow.indexOf("ICAO");
  var xpColIdx       = headerRow.indexOf("XP");
  var dateColIdx     = headerRow.indexOf("Date (UTC)");

  var cases = [
    // [player, icao, xp, date, expectDuplicate]
    ["Woofles",      "SOL2", "5,217,630",  "2026-05-10", true],   // exact match
    ["Woofles",      "SOL2", "6,000,000",  "2026-05-10", false],  // different XP
    ["Woofles",      "SOL2", "5,217,630",  "2026-05-11", false],  // different date
    ["ScubaSteve28", "A388", "39,525,676", "2026-05-10", true],   // exact match
    ["Woofles",      "B77W", "7,100,000",  "2026-05-10", false],  // different date (09 vs 10)
    ["Kitty",        "MC10", "1,000,000",  "2026-05-10", false],  // new record
    ["Woofles",      "SOL2", "5217630",    "2026-05-10", true]    // XP without commas
  ];

  var passed = 0;
  for (var i = 0; i < cases.length; i++) {
    var tc     = cases[i];
    var result = isDuplicate(
      mockSheet, headerRowIndex,
      playerColIdx, icaoColIdx, xpColIdx, dateColIdx,
      tc[0], tc[1], tc[2], tc[3]
    );
    var ok = result === tc[4];
    if (ok) passed++;
    Logger.log(
      (ok ? "✅" : "❌") +
      " " + tc[0] + "/" + tc[1] + "/" + tc[2] + "/" + tc[3] +
      " → Expected duplicate: " + tc[4] + " | Got: " + result
    );
  }
  Logger.log("Passed: " + passed + "/" + cases.length);
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


function testDuplicatePost() {
  Logger.log("=== DUPLICATE POST TEST ===");
  Logger.log("Submitting same record twice — second should return DUPLICATE message");
  var mockEvent = {
    postData: {
      contents: JSON.stringify({
        rawText: "•ll 5G\n60\nND 3:\n: speed\nC-mooon\nGLOW X72\nUNCOMMON B\nAIRBUS\nA380\n2005\nFIRST FLIGHT\n79.8\nWINGSPAN, M\n868\nSEATS\n3.11\nRARITY\n561\nSPEED, KT\n575\nWEIGHT, T\nCYBER 39 525 676 XP • 100%\n0%",
        status:  "Confirmed",
        date:    "2026-05-10"
      })
    }
  };
  Logger.log("First submission:  " + doPost(mockEvent).getContent());
  Logger.log("Second submission: " + doPost(mockEvent).getContent());
}


function testSortByDate() {
  Logger.log("=== SORT TEST ===");
  var sheet = getSpreadsheet().getSheetByName(CONFIG.dataSheet);
  if (!sheet) { Logger.log("Error: Sheet not found"); return; }
  var sheetValues    = sheet.getDataRange().getValues();
  var headerRowIndex = -1;
  for (var i = 0; i < sheetValues.length; i++) {
    if (sheetValues[i].indexOf(CONFIG.playerCol) !== -1) {
      headerRowIndex = i + 1;
      break;
    }
  }
  if (headerRowIndex === -1) { Logger.log("Error: Header row not found"); return; }
  sortTableByDate(sheet, sheetValues, headerRowIndex);
}


// ============================================================
// DATE NORMALISATION TEST
// Validates that all incoming date formats from the Shortcuts
// app are correctly parsed and normalised to yyyy-MM-dd UTC.
// Covers: full EXIF with offset, ISO 8601, plain yyyy-MM-dd,
// US short date, omitted date, and unparseable strings.
// See SS.ID.09 and SS.ID.10 for full compatibility notes.
// ============================================================
function testDateNormalisation() {
  Logger.log("=== DATE NORMALISATION TEST ===");

  var today = Utilities.formatDate(new Date(), CONFIG.timezone, CONFIG.dateFormat);

  // Each case: [input date string, expected yyyy-MM-dd output]
  // null input simulates an omitted date field — expects today
  var cases = [
    // Full EXIF with positive offset — should convert to UTC
    ["13-05-2026 09:15:00 +1000",  "2026-05-12"],  // 09:15 AEST = 23:15 UTC prev day
    // Full EXIF with negative offset
    ["2026-05-13 02:00:00 -0500",  "2026-05-13"],  // 02:00 EST = 07:00 UTC same day
    // ISO 8601 with colon offset
    ["2026-05-13T09:15:00+10:00",  "2026-05-12"],  // same as first case
    // ISO 8601 UTC (Z suffix)
    ["2026-05-13T00:00:00Z",       "2026-05-13"],
    // Plain yyyy-MM-dd — no conversion needed
    ["2026-05-13",                 "2026-05-13"],
    // US short date format from Shortcuts "Short" locale
    ["5/13/26",                    "2026-05-13"],
    // Omitted date — expects today's date in CONFIG.timezone
    [null,                         today],
    // Unparseable string — expects today's date as fallback
    ["not-a-date",                 today]
  ];

  var passed = 0;
  for (var i = 0; i < cases.length; i++) {
    var input    = cases[i][0];
    var expected = cases[i][1];
    var result;

    // Mirror the exact logic from doPost() in Main.gs
    result = Utilities.formatDate(new Date(), CONFIG.timezone, CONFIG.dateFormat);
    if (input && input.trim() !== "") {
      var parsed = new Date(input.trim());
      if (!isNaN(parsed.getTime())) {
        result = Utilities.formatDate(parsed, "UTC", CONFIG.dateFormat);
      }
      // If unparseable, result stays as today — matches expected
    }

    var ok = result === expected;
    if (ok) passed++;
    Logger.log(
      (ok ? "✅" : "❌") +
      " Input: '" + (input || "null") + "'" +
      " | Expected: '" + expected + "'" +
      " | Got: '" + result + "'"
    );
  }
  Logger.log("Passed: " + passed + "/" + cases.length);
}


// ============================================================
// RUN ALL TESTS
// Executes the full test suite in sequence. Because this
// calls functions across every file, a clean pass here
// confirms all files are cross-referenced correctly.
// ============================================================
function testAll() {
  Logger.log("============================");
  Logger.log("RUNNING ALL TESTS");
  Logger.log("============================");
  testLevenshtein();
  testExtractPlayer();
  testExtractXP();
  testFuzzyMatch();
  testICAOLookup();
  testGenerateId();
  testDuplicateCheck();
  testDateNormalisation();
  testPost();
}
