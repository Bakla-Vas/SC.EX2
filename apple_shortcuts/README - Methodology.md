# SC.EX2 — Shortcut Reference

**Sky Cards · Screenshot OCR to Google Sheets**
**Component:** Apple Shortcuts App
**Companion script:** `SC_EX2_Apps_Script.js`

---

## Overview

This Shortcut is the front-end of the SC.EX2 pipeline. Its sole responsibility is to:

1. Obtain one or more game screenshots
2. Crop each screenshot to isolate the right-hand card
3. Extract raw text from the cropped image using Apple's built-in OCR
4. Send that raw text to the Google Apps Script web app via HTTP POST
5. Display the response as a notification

All data parsing, player matching, ICAO lookup, and spreadsheet writing is handled server-side by the Apps Script. The Shortcut contains no regex or lookup logic.

---

## Complete Action Flow

```
┌─────────────────────────────────────────────┐
│ STEP 1 — Receive Images from Share Sheet    │
├─────────────────────────────────────────────┤
│ STEP 2 — If Shortcut Input has any value    │
│   └── (image came via Share Sheet → skip   │
│        mode selection, use that image)      │
│ Otherwise                                   │
│   STEP 3 — List: Manual / Auto             │
│   STEP 4 — Choose from List               │
│   STEP 5 — If Selected Item is Manual      │
│     └── Select photos (multiple)           │
│   Otherwise (Auto)                          │
│     └── Find Photos where Album is         │
│          SC.EX^2 Sample Images             │
│          Sort: Date Taken, Oldest First    │
│          Limit: 20 items                   │
│   End if                                   │
│ End if                                     │
├─────────────────────────────────────────────┤
│ STEP 6 — Repeat with each item in          │
│          If Result                          │
│   STEP 7  — Get Width from Repeat Item     │
│   STEP 8  — Calculate Width ÷ 2           │
│             → stored as Half X Coord       │
│   STEP 9  — Get Height from Repeat Item   │
│   STEP 10 — Get Date Taken from           │
│             Repeat Item                    │
│   STEP 11 — Format Date Taken             │
│             Date Format: Short            │
│             Time Format: None             │
│             Locale: English (US)          │
│             → stored as Formatted Date    │
│   STEP 12 — Crop Repeat Item              │
│             Position: Custom              │
│             X: Half X Coord               │
│             Y: 0                          │
│             Width: Half X Coord           │
│             Height: Height                │
│             → stored as Player name crop  │
│   STEP 13 — Extract text from             │
│             Player name crop              │
│             → stored as rawExtract        │
│   STEP 14 — Get contents of URL           │
│             Method: POST                  │
│             Body: JSON                    │
│               rawText  = rawExtract       │
│               status   = rawExtract       │
│               date     = Formatted Date   │
│   STEP 15 — Show notification             │
│             Body: Contents of URL         │
│             Play Sound: ON               │
│ End Repeat                                │
└─────────────────────────────────────────────┘
```

---

## Step-by-Step Reference

### Step 1 — Receive Images from Share Sheet

**Action:** Receive Images from Share Sheet
**If there's no input:** Continue

**What it does:**
This is the entry point of the Shortcut. It listens for images shared directly to the Shortcut from another app — most commonly the iOS screenshot preview that appears immediately after taking a screenshot. Tapping the screenshot thumbnail and selecting Share, then choosing this Shortcut, passes the image directly into the pipeline.

**Why "Continue" when no input:**
Setting "If there's no input" to Continue rather than Stop allows the Shortcut to run even when launched directly from the Shortcuts app or Home Screen without a shared image. In that case the Shortcut Input variable will be empty, which is handled in Step 2.

**Key concept:**
The Share Sheet is the fastest way to process a screenshot immediately after taking it. The image never needs to be saved to the camera roll first.

---

### Step 2 — If Shortcut Input has any value

**Action:** If / Otherwise / End If
**Condition:** Shortcut Input has any value

**What it does:**
Checks whether an image was received via the Share Sheet in Step 1.

- **If true (image was shared):** The Shortcut skips Steps 3–5 entirely and uses the shared image directly. The If Result variable is set to that image and execution jumps to the Repeat loop in Step 6.
- **If false (no shared image):** Execution falls through to the Otherwise branch where the user is prompted to select images manually or automatically from an album.

**Why it exists:**
This branch makes the Shortcut work in two different trigger modes without needing two separate Shortcuts. Share Sheet users get a zero-prompt experience. Direct launch users get the mode selection menu.

---

### Step 3 — List (Manual / Auto)

**Action:** List
**Items:** Manual, Auto

**What it does:**
Defines the two image source options that are presented to the user when no image was shared. This is a static list stored inside the Shortcut — it does not connect to any external source.

**Items explained:**

| Item | Meaning |
|------|---------|
| Manual | User picks specific photos from their library |
| Auto | Shortcut fetches the most recent photos from a designated album |

---

### Step 4 — Choose from List

**Action:** Choose from List
**Input:** List from Step 3
**Select Multiple:** OFF

**What it does:**
Presents the Manual / Auto options to the user as a tap-to-select menu. The selected value is stored as the Selected Item variable used in Step 5.

**Select Multiple is OFF** because the user only needs to choose one mode, not multiple.

---

### Step 5 — If Selected Item is Manual / Otherwise

**Action:** If / Otherwise / End If
**Condition:** Selected Item is "Manual"

This block contains two branches depending on what the user selected.

---

#### Branch A — Manual (If Selected Item is Manual)

**Action:** Select photos
**Include:** All
**Select Multiple:** ON

**What it does:**
Opens the iOS photo picker and lets the user tap to select one or more screenshots from their camera roll. All selected images are passed as a list into the Repeat loop in Step 6.

**Select Multiple is ON** so that a user can batch-process several screenshots from a single session in one run of the Shortcut.

---

#### Branch B — Auto (Otherwise)

**Action:** Find Photos where Album is SC.EX^2 Sample Images
**Sort by:** Date Taken
**Order:** Oldest First
**Limit:** ON — Get 20 Items

**What it does:**
Automatically fetches up to 20 photos from a specific named album called `SC.EX^2 Sample Images`. Photos are returned oldest first so they are processed in the order they were taken.

**Why oldest first:**
Processing in chronological order means the spreadsheet will be populated in the correct sequence when multiple screenshots are processed in a single batch.

**Why 20 items:**
This is a practical ceiling to prevent accidentally processing a very large album in one run. Adjust the limit by tapping the − and + buttons.

**Important:** The album `SC.EX^2 Sample Images` must exist in your iOS Photos app before using this mode. Create it manually in Photos and move or save screenshots into it. The name must match exactly — it is case sensitive.

---

### Step 6 — Repeat with each item in If Result

**Action:** Repeat with each item in If Result

**What it does:**
Loops through every image that was collected by whichever branch ran in Step 2 or Step 5. Each iteration processes one screenshot. The current image in the loop is available as the Repeat Item variable.

**If Result** is the output of the outermost If block from Step 2. It contains either:
- The single image shared via the Share Sheet
- The images selected manually in Branch A
- The images found automatically in Branch B

Everything inside the Repeat block (Steps 7–15) runs once per image.

---

### Step 7 — Get Width from Repeat Item

**Action:** Get Width from Image
**Input:** Repeat Item

**What it does:**
Reads the pixel width of the current screenshot. This is needed to calculate where to crop the image to isolate the right-hand card.

**Variable produced:** Width

---

### Step 8 — Calculate Width ÷ 2

**Action:** Calculate
**Expression:** Width ÷ 2

**What it does:**
Divides the image width by 2 to find the horizontal midpoint. Sky Cards battle screenshots show two cards side by side — the left card belongs to the current player and the right card belongs to the opponent. Dividing by 2 gives the X coordinate where the right half begins.

**Variable produced:** Half X Coord

**Why this works:**
Screenshots are always full width. The two cards are always positioned symmetrically. Cropping from the midpoint to the right edge always isolates the opponent's card regardless of device screen size.

---

### Step 9 — Get Height from Repeat Item

**Action:** Get Height from Image
**Input:** Repeat Item

**What it does:**
Reads the pixel height of the current screenshot. Stored and used in the Crop action in Step 12 to set the crop height to the full image height.

**Variable produced:** Height

---

### Step 10 — Get Date Taken from Repeat Item

**Action:** Get Date Taken from Image
**Input:** Repeat Item

**What it does:**
Reads the EXIF date metadata embedded in the screenshot at the moment it was captured. This is more reliable than using the current date because batch processing could run hours or days after the screenshots were taken.

**Variable produced:** Date Taken

---

### Step 11 — Format Date Taken

**Action:** Format Date
**Input:** Date Taken
**Date Format:** Short
**Time Format:** None
**Locale:** English (United States)

**What it does:**
Converts the raw Date Taken timestamp into a short human-readable date string. With the Short format and English (US) locale this produces dates in M/D/YY format for example 5/10/26.

**Variable produced:** Formatted Date

**Note on format:**
The date format should match what your Google Sheet expects in the Date (UTC) column. If your sheet uses a different format such as YYYY-MM-DD, change the Date Format setting here to Custom and enter `yyyy-MM-dd`.

---

### Step 12 — Crop Repeat Item

**Action:** Crop Image
**Input:** Repeat Item
**Position:** Custom
**X Coordinate:** Half X Coord
**Y Coordinate:** 0
**Width:** Half X Coord
**Height:** Height

**What it does:**
Crops the screenshot to isolate only the right half — the opponent's card. The crop starts at the horizontal midpoint (Half X Coord) and at the very top (Y = 0), then extends for exactly half the image width (Half X Coord) and the full image height (Height).

**Variable produced:** Player name crop

**Why crop at all:**
Passing the full screenshot to OCR causes the player's own card on the left to also be extracted. Both cards contain aircraft names, XP values and player names. Cropping to the right half ensures the OCR only sees the opponent's card data, preventing the wrong values being extracted.

**Coordinate diagram:**
```
┌──────────────┬──────────────┐
│              │  ← CROP →   │
│  Left card   │  Right card  │
│  (ignored)   │  (processed) │
│              │              │
└──────────────┴──────────────┘
X=0          X=Half        X=Width
```

---

### Step 13 — Extract text from Player name crop

**Action:** Extract Text from Image
**Input:** Player name crop (from Step 12)

**What it does:**
Runs Apple's built-in Vision OCR framework on the cropped image to extract all visible text as a multi-line string. This is the raw OCR output that is sent to the Apps Script for parsing.

**Variable produced:** rawExtract

**No regex or parsing happens here.** The raw multi-line text is sent as-is to the Apps Script which handles all extraction logic server-side.

**OCR accuracy notes:**
- Works best on clear, high-contrast screenshots
- Dark backgrounds with bright text (as used in Sky Cards) generally produce good results
- Some characters are commonly misread: O/0, l/1, rn/m, G/C — the Apps Script fuzzy matching handles these

---

### Step 14 — Get contents of URL (POST to Apps Script)

**Action:** Get Contents of URL
**URL:** Your Google Apps Script Web App URL
**Method:** POST
**Headers:** content-type: application/json
**Request Body:** JSON

| JSON Key | Value | Description |
|----------|-------|-------------|
| rawText | rawExtract | The full OCR text from Step 13 |
| status | rawExtract | Currently mapped to rawExtract — update to a fixed text value "Confirmed" if preferred |
| date | Formatted Date | The formatted date from Step 11 |

**What it does:**
Sends the raw OCR text and date to the Google Apps Script web app via an HTTP POST request. The Apps Script then extracts the player name, XP, and ICAO code from the raw text and writes a new row to the spreadsheet.

**Variable produced:** Contents of URL — the text response returned by the Apps Script

**Note on the status field:**
The status field is currently mapped to rawExtract in the screenshots. This should be updated to a fixed text value of `Confirmed` unless you want the Apps Script to determine status from the OCR text.

**Note on the URL:**
The URL shown in the screenshots is the Web App deployment URL from Google Apps Script. This URL is unique to your deployment. If you redeploy using the "edit existing deployment" method the URL does not change. If you accidentally create a new deployment you will need to update this URL.

---

### Step 15 — Show notification

**Action:** Show Notification
**Body:** Contents of URL
**Title:** optional
**Play Sound:** ON

**What it does:**
Displays the response from the Apps Script as an iOS notification. The response will be one of:

| Response | Meaning |
|----------|---------|
| `[GREAT SUCCESS :D] PlayerName — ICAO — XP added` | Row written successfully |
| `Error: Sheet 'name' not found` | Sheet name mismatch in CONFIG |
| `Error: No raw OCR text received` | OCR produced empty output |
| `Error: Could not load lookup table` | Lookup sheet not found |

**Play Sound ON** provides audible confirmation when processing multiple screenshots in a batch without looking at the screen.

**End Repeat** — after the notification is shown the loop returns to Step 6 and processes the next image. When all images are processed the Shortcut ends.

---

## Variable Reference

| Variable | Created in | Used in | Contains |
|----------|------------|---------|----------|
| Shortcut Input | Step 1 | Step 2 | Image shared via Share Sheet (or empty) |
| If Result | Step 2 | Step 6 | All images to process |
| Selected Item | Step 4 | Step 5 | "Manual" or "Auto" |
| Repeat Item | Step 6 | Steps 7–12 | Current image being processed |
| Width | Step 7 | Step 8 | Pixel width of current image |
| Half X Coord | Step 8 | Step 12 | Width ÷ 2 — right card start X position |
| Height | Step 9 | Step 12 | Pixel height of current image |
| Date Taken | Step 10 | Step 11 | Raw EXIF date of screenshot |
| Formatted Date | Step 11 | Step 14 | Short date string e.g. 5/10/26 |
| Player name crop | Step 12 | Step 13 | Cropped right-half image |
| rawExtract | Step 13 | Step 14 | Raw multi-line OCR text |
| Contents of URL | Step 14 | Step 15 | Apps Script response string |

---

## Trigger Modes Summary

| Mode | How to trigger | Best for |
|------|----------------|----------|
| Share Sheet | Take screenshot → tap thumbnail → Share → this Shortcut | Processing a single screenshot immediately |
| Manual | Launch Shortcut → select Auto/Manual → pick photos | Selecting specific screenshots from the camera roll |
| Auto (Album) | Launch Shortcut → select Auto → fetches album | Batch processing a set of saved screenshots |

---

## Setup Checklist

- [ ] Create a Photos album named exactly `SC.EX^2 Sample Images` if using Auto mode
- [ ] Add this Shortcut to the Share Sheet (Shortcut Settings → Show in Share Sheet)
- [ ] Add this Shortcut to the Home Screen for quick manual launch
- [ ] Confirm the Apps Script Web App URL in Step 14 matches your current deployment
- [ ] Confirm the date format in Step 11 matches your sheet's Date (UTC) column format
- [ ] Update the status field in Step 14 to a fixed value of `Confirmed` if not parsing status from OCR

