# SC.EX^2

SC.EX2 ([REDACTED]Cards Experience Extract) is an automated ETL tool designed to extract a [REDACTED]Cards player's Aircraft XP from an ingame battle screenshot and append the data to a shared Google Sheet table. The The tool can be run for each screenshot as it is taken or in bulk mode to upload multiple records at once. 

*Disclaimer: Code used within the Google Script Portion of the tool has been generated using Claude AI.*

## How does it work?
SC.EX^2 is a two stage script which makes use of both iOS Shortcut scripting and Google App Scripts to get "Player Name", "Aircraft Name" and "XP" from an ingame battle screenshot as follows:

### <ins>iPhone Shortcut</ins>

The screenshot is cropped to each of the regions in the screenshot and text is extracted and packaged as a json to be sent to the google script App.
1. Share when a screenshot is taken or select bulk upload of screenshots
2. Shortcut will iterate through selected screenshots
3. Date taken ius extracted from screenshot metadata in ISO8601 time format
4. Screenshot dimensions are extracted
5. Raw text is extracted from the right side of the screenshot
6. Raw text and date information are compiled into a JSON and sent to Google App Script vie URL POST.
7. Alert will appear when google script is complete either indicating success or error.

### <ins>Google App Script</ins>
The json packet sent from the Shortcut via URL post is parsed, processed and appended appended to specified Google Sheet table.
1. Raw text is parsed and data points are extracted using comination of regex and lookup table 
2. Player name is fuzzy matched to a predefined list of most common players to account for any minor errors (e.g. "0" instead of "O"/"i" instead of "l") in the OCR text detection
3. Aircraft name is matched to ICAO code in lookup table containing all current ingame aircraft.
4. Data is appended to appropriate column at the bottom of the table.
6. Status message returned to Shortcut to alert user that script is complete.

[Note] - This portion of the tool is fully automated and does not require any input from the user. A copy of the code is available for reference if you are curious about this portion of the script is doing.

## Installation
SC.EX2 shortcut file will be provided.

1. Download shortcut app from file attached to message or iCloud link
2. Open Shortcut App file and select Add Shortcut
3. Upon running the Shortcut for the first time you will be prompted to allow media sharing via the shortcut. Select allow always to never see this notification again. (This alert is tied to the amount of screenshots being processed and will appear when a greater amount is being input)
4. Upon completion of the Shortcut an alert should appear either indicating the script was successful including the players name and aircraft ICAO or an Error code. 
  - If an error code appears post to the XP Screenshots chat

## How to Run
### Instant Sharing Mode (Single Screenshots)
This mode allows quick upload of data during a battle by running the tool from the screenshot editer share Sheet. [Insert Share Icon]. It should be possible to take a screenshot and upload during the time you have between rounds, meaning you won't have to save the screenshot to your phone's storage.

Tool can be run directly after taking a screenshot 
1. Take a screenshot of the battle card you would like to add.
2. Open screenshot editing (if not already open) by selecting the small screenshot window in the bottom left of the screen.
3. Click share button in the top right
4. Select show more and scroll down to bottom of the list and select SC.EX^2.
5. The script will run in the background, you can close screenshot X out of the screenshot without saving.
6. When the script is complete you should receive a notification stating the Player name aircraft icao and XP value.

### Bulk Upload Mode (Multiple Screenshots)
This mode allows multiple screenshot to be uploaded at a time from your photo library 

Bulk mode can be used by:
1. Manually trigger shortcut (either from within shortcut app/home screen bookmark/siri etc.)
2. You will be prompted to select photos to be processed.
   - Select up to 10 screenshots (This is the default limit you can share, this can be increase in the Settings App by going to Apps>Shortcuts>Advanced>Allow Sharing Large Amounts of Data).
3. Upon running it for the first time you will be prompted for permission to send screenshots.
   - Select Always Allow if you do not want to see this every time the tool is run
4. The script will iterate through each of the screenshots
5. Upon completion of each screenshot you will receive a notification when each is complete with the player's name and aircraft ICAO code.

## Development Pipeline

### Implemented
- Google App Script which accepts JSON via URL POST to populate data in google sheet
- Using lookup table to match airplane name from card to ICAO code used in data table
- Fuzzy player name check from lookup table sheet to ensure minor errors in image to text conversion are corrected
- Appending record info at bottom of table and then sort by descending order
- Raw text from right side (oppenent's card) of the screenshot now parsed and processed completely within Google Apps Script allowing for expanded compatibility with device screen sizes.
    - Combination of REGEX and lookup tables used to extract "Player Name" and "ICAO" code from raw text. (Refer to README in scripts folder for more detail)
    - No longer utilises cropping regions for individual components.
- Duplicate detection where all fields are identical
- Add Record ID to all records
- Move config variables to a separate input sheet so that there are no hard coded values in main script
- Processing progress tracking notifications stating how many screenshots from batch have been processed (e.g. 1/20, 5/10, 1/1)
- Automate conversion of Screenshot time taken from Local Device Time zone to UTC

### In Development
- Google sheet and google app sheet replacement
    - Investigate lightweight cloud SQL solutions hosting database and process incoming data points
    - Develop web app alternative to Looker(Data) Studio

### Backlog
- Add Function to flag incorrect names in status column for review (only if they are within a certain range beyond threshold)
    - Dump raw text grab in a separate sheet with corresponding Record ID for refence/manual correction should an error occur
- Add Function to append new player names to lookup table if not found during fuzzy playuer name check (for names not flagged in above test)
- Add android compatibility
    - Android version of shortcut workflow to extract card text and send to apps script
- Add notification for time taken to complete script in bulk mode
- Test google drive OCR Text recognition capabilities
- Investigate other sources for lookup tables and reduce need for sheets API calls
    - Getting list of aircraft names and ICAO codes from SkyCards API
    - Fetching player names from another source
- (Ongoing) Script Optimisation

### Deprecated Features/Upates
- Using defined pixel regions to extract infromation from screenshot - not reliable for scrpaing information from different screenshot/phone screen sizes
- Update Pixel region ratios to be more compatible with screen sizes
- Make shortcut dump raw extracts into a file so that more than 10 can be sent at a time
- [No longer required as text filtering moved to google apps script] Data quality check within shortcut before pushing to google script to ensure no null values are being sent.

## Known Issues
- Some fuckass left the door open and a fly got into the code :(
- Phantom's Can't Hang 
