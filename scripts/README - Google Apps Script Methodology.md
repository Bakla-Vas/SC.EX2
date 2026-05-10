# SC.EX2 - Screenshot OCR to Google Sheets

Google Apps Script — Function Reference

## Purpose of this document

This reference explains every function in the SC.EX2 Apps Script, step
by step. Each section covers what the function does, why it exists, how
it works internally, what it returns, and how it connects to the rest of
the script. It is written so that you can interrogate any part of the
code and understand how to build or modify it yourself.

## Overall script flow

The script receives a single HTTP POST request from the iPhone Shortcuts
app. The request body contains the raw OCR text extracted from a Sky
Cards screenshot. The script then:

1.  Extracts the player name from the OCR text using a two-step regex
    and filter approach

2.  Fuzzy matches the extracted player name against a known player
    lookup table to correct OCR misreads

3.  Extracts the XP value from the OCR text by finding the last number
    before the word XP

4.  Looks up the aircraft ICAO code by scanning the OCR text after the
    rarity word against the full aircraft name lookup table

5.  Writes all four fields plus status and date to the Leaderboard Data
    Entry sheet

6.  Sorts the table by date descending so the newest entry always
    appears at the top

## 1. CONFIG

The CONFIG object sits at the top of the script and holds every value
that might need changing in one place. No other function contains
hardcoded sheet names, column headers, or threshold values. If you need
to change a setting you only ever edit CONFIG.

### Fields

| **Field** | **Purpose** |
|----|----|
| spreadsheetId | The unique ID from the Google Sheets URL. Found between /d/ and /edit in the browser address bar. |
| dataSheet | The exact name of the sheet tab where rows are written. Case sensitive. |
| lookupSheet | The exact name of the sheet tab containing the player and aircraft lookup tables. |
| playerCol | The column header text used to find the Player column dynamically. Avoids hardcoding column letters. |
| icaoCol | The column header text used to find the ICAO column in the lookup table. |
| aircraftCol | The column header text used to find the Full Name column in the lookup table. |
| dateCol | The column header text used to locate the Date column when sorting. |
| matchThreshold | Maximum Levenshtein distance allowed when fuzzy matching player names. 3 means up to 3 character differences are accepted as a match. |
| rarityWords | Array of rarity category words from the game. Used to find the dividing line between the player name section and the aircraft section of the OCR text. |
| xpMinDigits | Minimum number of digits for a valid XP value. Prevents year numbers like 2005 being mistaken for XP. |
| xpMaxDigits | Maximum number of digits for a valid XP value. Prevents runaway matches on very long digit strings. |

## 2. getSpreadsheet()

Opens the Google Spreadsheet by its ID and returns the spreadsheet
object. Every other function that needs to access the spreadsheet calls
this helper rather than calling SpreadsheetApp.openById directly.

### Purpose

Centralising the spreadsheet open call means the ID only needs to be
defined once in CONFIG. If you move the script to a new spreadsheet you
change one value and every function updates automatically.

### How it works

1.  Calls the built-in SpreadsheetApp.openById() with the ID from CONFIG

2.  Returns the spreadsheet object which can then be used to access
    individual sheets

### Returns

A Spreadsheet object. All subsequent sheet access uses this object.

## 3. levenshteinDistance(a, b)

Calculates the Levenshtein distance between two strings. This is the
minimum number of single-character edits — insertions, deletions, and
substitutions — needed to transform string a into string b.

### Purpose

OCR misreads characters frequently. A player named Woofles might be read
as W00fles or Wooflies. Levenshtein distance lets the script measure how
different the OCR output is from each known player name and pick the
closest match.

### How it works — the matrix

1.  Both strings are converted to uppercase and trimmed so comparison is
    case-insensitive

2.  A 2D matrix is created where matrix\[i\]\[j\] will hold the edit
    distance between the first i characters of b and the first j
    characters of a

3.  The first row and column are filled with 0, 1, 2, 3... representing
    the cost of deleting all characters

4.  For each remaining cell: if the characters match the cost is copied
    from the diagonal (no edit needed). If they differ the cost is 1
    plus the minimum of the three neighbouring cells (insert, delete, or
    substitute)

5.  The final answer is in matrix\[b.length\]\[a.length\]

### Parameters

| **Parameter** | **Description**                                         |
|---------------|---------------------------------------------------------|
| a             | First string to compare (the OCR extracted name)        |
| b             | Second string to compare (the lookup table player name) |

### Returns

An integer. 0 means identical. 1 means one character different. 3 is the
default match threshold.

## 4. getLookupData()

Opens the lookup sheet and reads all its cell values into memory as a 2D
JavaScript array. The array is passed to every function that needs to
search the lookup table.

### Purpose

Reading a Google Sheet is a slow operation. If each lookup function
opened the sheet independently, a single request would trigger multiple
slow reads. By reading once and passing the result around, the script
makes only one sheet read per request.

### How it works

1.  Calls getSpreadsheet() to get the spreadsheet object

2.  Calls getSheetByName() using the lookupSheet name from CONFIG

3.  Calls getDataRange() to get all cells that contain data

4.  Calls getValues() to return a 2D array where each element is
    \[row\]\[column\]

### Returns

A 2D array of all values in the lookup sheet, or null if the sheet is
not found. Null causes an early error return in doPost so the failure is
reported clearly.

## 5. findColIndex(data, headerName)

Scans a 2D array for a cell matching headerName and returns its row and
column position. Used to locate the correct column in the lookup table
without assuming a fixed column letter.

### Purpose

If column positions were hardcoded as numbers or letters, adding or
rearranging columns in the spreadsheet would break the script silently.
This function finds columns by their header text so the script adapts
automatically to layout changes.

### How it works

1.  Loops through every row of the 2D array

2.  For each row loops through every cell

3.  If the cell value matches headerName exactly (after trimming
    whitespace) returns an object with the row and column index

4.  Returns null if no match is found

### Parameters

| **Parameter** | **Description** |
|----|----|
| data | The 2D array returned by getLookupData() |
| headerName | The exact text of the column header to find e.g. 'Player', 'ICAO', 'Full Name' |

### Returns

An object { row: N, col: N } where row is the header row index and col
is the column index, both zero-based. Returns null if not found.

## 6. normaliseOCR(rawText)

Converts multi-line OCR text into a single flat uppercase string
suitable for searching. Newlines become spaces, multiple consecutive
spaces collapse into one.

### Purpose

Aircraft names in the OCR often span multiple lines (BOEING on one line,
777-300ER on the next). The lookup table stores them as a single string.
Normalising the OCR text makes substring matching possible without
needing a multi-line regex.

### How it works

1.  Replaces all newline characters (\n) with a space using replace()

2.  Collapses sequences of multiple spaces into a single space using a
    regex

3.  Trims leading and trailing whitespace

4.  Converts the entire string to uppercase for case-insensitive
    matching

### Parameters

| **Parameter** | **Description**                                       |
|---------------|-------------------------------------------------------|
| rawText       | The raw multi-line OCR string received from Shortcuts |

### Returns

A single-line uppercase string with normalised spacing.

# 7. extractPlayerFromOCR(rawText)

Extracts the player name from raw OCR text using a two-step approach:
first a regex captures the block of text between a category word and a
rarity word, then a filter removes junk lines to find the player name.

### Purpose

The player name always appears in a consistent position in the OCR —
after a category word (weight, seats, speed etc.) and before a rarity
word (ULTRA, COMMON etc.). This structural pattern is used as anchors to
isolate the player name without needing to know the name in advance.

### Step 1 — Block capture regex

1.  The CATEGORY pattern matches any of the gameplay category words that
    appear on the line above the player name

2.  \[^\n\]\* before and after the category word allows any prefix or
    suffix characters on that line (the OCR often adds stray characters)

3.  The capture group (\[\s\S\]\*?) lazily captures everything between
    the category line and the rarity line

4.  The RARITY pattern anchors the end of the block

### Step 2 — Candidate filtering

1.  The captured block is split into individual lines

2.  Each line is tested against a validation regex that excludes: lines
    starting with GLOW (card glow indicator), lines that are only a card
    multiplier like X72, lines with no letters at all, lines shorter
    than 2 characters

3.  All remaining lines are valid candidates

4.  The last candidate is returned — the player name always appears as
    the last valid line before the rarity word

### Returns

A string containing the extracted player name, or null if no valid
candidate is found.

## 8. fuzzyMatchPlayer(inputName, lookupData)

Compares the extracted player name against every known player in the
lookup table and returns the closest match within the configured
distance threshold.

### Purpose

OCR frequently misreads characters — O becomes 0, l becomes 1, rn
becomes m. A player named ScubaSteve28 might be read as ScubaSteve2B.
Fuzzy matching corrects these errors automatically so names are
standardised in the spreadsheet.

### How it works

1.  Returns the input immediately if it is empty

2.  Uses findColIndex to locate the Player column in the lookup data

3.  Loops through every player name in the lookup table

4.  Calls levenshteinDistance for each comparison

5.  Tracks the smallest distance found and the corresponding name

6.  If the best distance is within CONFIG.matchThreshold, returns the
    matched lookup name

7.  If no match is within threshold, returns the original OCR value
    unchanged so data is never silently lost

### Parameters

| **Parameter** | **Description**                               |
|---------------|-----------------------------------------------|
| inputName     | The raw player name string extracted from OCR |
| lookupData    | The 2D lookup array from getLookupData()      |

### Returns

The best matching player name from the lookup table if within threshold,
otherwise the original input string.

## 9. extractXPFromOCR(rawText)

Finds all numbers immediately before the text XP in the OCR output,
takes the last occurrence, and returns it as a formatted number string
with commas.

### Purpose

The XP value appears twice in the card OCR — once in a garbled form in
the card body and once cleanly in the footer. Taking the last occurrence
consistently returns the clean value.

### How it works

1.  Uses a global regex /(\[ \d\]+)\s\*XP/gi to find all XP matches in
    the text

2.  The g flag means it finds all occurrences, not just the first

3.  Collects all matches into an array

4.  Takes the last element of the array which corresponds to the footer
    value

5.  Removes all spaces from the digit string (spaces are used as
    thousand separators in the game)

6.  Validates the digit count is within CONFIG.xpMinDigits and
    CONFIG.xpMaxDigits to exclude false matches like year numbers

7.  Parses to an integer and formats with toLocaleString to add commas
    e.g. 5,217,630

### Returns

A formatted XP string with commas e.g. '5,217,630', or null if no valid
XP value is found.

## 10. lookupICAOFromOCR(rawText, lookupData)

Scans the raw OCR text for aircraft names from the lookup table and
returns the corresponding ICAO code. Uses a positional approach to only
search the section of the OCR that contains the aircraft card data,
avoiding false matches against player names.

### Purpose

Regex-based aircraft name extraction was inconsistent because the OCR
layout varies significantly between screenshots. Scanning for known
aircraft names directly is more reliable because the lookup table is the
authoritative source of truth.

### How it works — positional hybrid approach

1.  Builds a list of all aircraft from the lookup table as name/ICAO
    pairs

2.  Sorts the list longest name first — this ensures that BOEING
    777-300ER is checked before BOEING 777 so a more specific name
    always wins

3.  Calls normaliseOCR to convert the multi-line OCR text to a single
    searchable string

4.  Finds the position of the earliest rarity word in the normalised
    text — this is the dividing line between the player name section and
    the aircraft section

5.  Creates a search window starting from the rarity word position so
    player names earlier in the text cannot be falsely matched as
    aircraft names

6.  Falls back to the full text if no rarity word is found

7.  Loops through the aircraft list and checks if each name appears in
    the search window using indexOf

8.  Returns the ICAO code of the first match found

### Parameters

| **Parameter** | **Description**                                       |
|---------------|-------------------------------------------------------|
| rawText       | The raw multi-line OCR string received from Shortcuts |
| lookupData    | The 2D lookup array from getLookupData()              |

### Returns

An ICAO code string e.g. 'A388', or null if no aircraft name is found in
the OCR text.

## 11. sortTableByDate(sheet)

Sorts all data rows in the Player XP table by the Date (UTC) column in
descending order so the most recent entry always appears at the top.

### Purpose

New rows are inserted below the header rather than appended to the end,
so without sorting the table order would be determined by insertion
sequence rather than date. Sorting after every insert keeps the table
consistently ordered.

### How it works

1.  Reads all cell values from the sheet into a 2D array

2.  Finds the header row by searching for the Player column header

3.  Finds the date column by searching the header row for the Date (UTC)
    header text

4.  Calculates the range of data rows (from the row after the header to
    the last row)

5.  Calls the built-in sort() method on that range, passing the date
    column index and ascending: false for descending order

### Parameters

| **Parameter** | **Description** |
|----|----|
| sheet | The Sheet object for the data sheet, passed in from doPost to reuse the already-open object |

### Returns

Nothing. Modifies the sheet in place.

## 12. doPost(e)

The main entry point of the script. Called automatically by Google Apps
Script whenever the Shortcuts app sends an HTTP POST request to the Web
App URL.

### Purpose

doPost is the standard Apps Script function name for handling POST
requests to a deployed Web App. Google routes incoming POST requests to
this function automatically.

### Expected JSON body from Shortcuts

| **Field** | **Description** |
|----|----|
| rawText | Required. The full multi-line OCR text extracted from the screenshot |
| status | Optional. Defaults to empty. Typically 'Confirmed' |
| date | Optional. Defaults to empty. Format: YYYY-MM-DD |
| playerOverride | Optional. Manually corrected player name from Ask for Input |
| xpOverride | Optional. Manually corrected XP value from Ask for Input |
| icaoOverride | Optional. Manually corrected ICAO code from Ask for Input |

### How it works — step by step

1.  Parses the incoming JSON body using JSON.parse()

2.  Validates that rawText is present and not empty

3.  Calls getLookupData() once and passes the result to all subsequent
    functions

4.  Calls extractPlayerFromOCR() to get the raw OCR player name

5.  Calls fuzzyMatchPlayer() to correct OCR misreads against the lookup
    table

6.  Calls extractXPFromOCR() to get the formatted XP value

7.  Calls lookupICAOFromOCR() to get the aircraft ICAO code

8.  Applies any manual override fields if they were provided

9.  Finds the header row of the Player XP table

10. Reads formatting and formulas from the first data row

11. Inserts a new row immediately below the header

12. Copies formatting from the first data row to the new row

13. Restores any formula columns into the new row

14. Writes player, ICAO, XP, status and date into columns B through F

15. Calls sortTableByDate() to reorder the table

16. Returns a success message string that Shortcuts displays as a
    notification

### Override logic

If a playerOverride field is present and non-empty, it replaces the
auto-extracted player name and is still passed through fuzzyMatchPlayer
so lookup table standardisation is applied. XP and ICAO overrides
replace the auto-extracted values directly without further processing.

### Returns

A ContentService text output string. On success: '\[GREAT SUCCESS :D\]
PlayerName — ICAO — XP added'. On failure: 'Error: \<message\>'. This
string is displayed in the Shortcuts notification.

## 13. Test Functions

The script includes a suite of test functions that can be run directly
in the Apps Script editor without going through Shortcuts. Each test
function calls its corresponding production function with known inputs
and logs the result.

### testLevenshtein()

Tests the levenshteinDistance function with known string pairs and
expected distances. Verifies that exact matches return 0, single
character differences return 1, and so on.

### testExtractPlayer()

Tests extractPlayerFromOCR with five representative OCR samples covering
common edge cases: standard layout, junk lines before the name, GLOW
lines after the name, Arabic characters in junk lines, and
single-character junk lines.

### testExtractXP()

Tests extractXPFromOCR with XP values in different formats including
values that appear twice in the OCR (garbled then clean), values with
spaces as thousand separators, and a case with no XP present.

### testFuzzyMatch()

Tests fuzzyMatchPlayer with six player names including exact matches,
OCR misreads, and a name that should not match anything in the lookup
table.

### testICAOLookup()

Tests lookupICAOFromOCR with three raw OCR blocks for known aircraft.
Verifies that the correct ICAO code is returned for multi-line aircraft
names like BOEING 777-300ER.

### testPost()

Tests the full end-to-end flow by constructing a mock POST event object
with a real OCR sample and passing it to doPost. Verifies that a row is
written to the sheet and the success message is returned.

### testSortByDate()

Runs sortTableByDate directly on the data sheet. Useful for manually
resorting the table if entries were added out of order.

### testAll()

Runs all test functions in sequence. Use this after making any code
changes to verify nothing has broken before redeploying.

### How to run a test

> • In the Apps Script editor select the test function name from the
> function dropdown at the top
>
> • Click the Run button (triangle icon)
>
> • Click Execution Log at the bottom to see all Logger.log output
>
> • Green tick icons indicate passing tests, red X icons indicate
> failures

## 14. Deployment Notes

The script must be deployed as a Web App for Shortcuts to reach it via
HTTP POST.

### First deployment

1.  Click Deploy then New Deployment in the Apps Script editor

2.  Click the gear icon and select Web App

3.  Set Execute as: Me

4.  Set Who has access: Anyone

5.  Click Deploy and copy the Web App URL

6.  Paste the URL into the Shortcuts Get Contents of URL action

### Updating after code changes

1.  Click Deploy then Manage Deployments

2.  Click the pencil edit icon on the existing deployment

3.  Change the version to New Version

4.  Click Deploy — the URL does not change

Never create a new deployment when updating code. Editing the existing
deployment preserves the URL so the Shortcut continues to work without
changes.

### Authorization

The first time the script runs it will ask for Google account
authorization. Click Review Permissions, sign in, click Advanced, click
Go to project name, then Allow. Run the test function again after
authorizing.
