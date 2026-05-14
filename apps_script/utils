// ============================================================
// Utils.gs
// Sky Cards EX2 — Shared Utility Functions
//
// PURPOSE:
//   Low-level helper functions with no dependency on sheet
//   data. Used across multiple other files.
//
// DEPENDS ON:  nothing
// USED BY:     Lookup.gs, Extract.gs, Records.gs, Main.gs
// ============================================================


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
