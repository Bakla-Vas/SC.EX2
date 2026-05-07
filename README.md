# SC.EX^2

SC.EX2 (FlyCards Experience Extract) is an automated ETL tool designed to extract a FlyCards player's Aircraft XP from an ingame battle screenshot and append the data to a shared Google Sheet table. The The tool can be run for each screenshot as it is taken or in bulk mode to upload multiple records at once. 

*Disclaimer: Code used within the Google Script Portion of the tool has been generated using Claude AI.*

## How does it work?
SC.EX^2 is a two stage script which makes use of both iOS Shortcut scripting and Google App Scripts to get "Player Name", "Aircraft Name" and "XP" from an ingame battle screenshot as follows:

### <ins>iPhone Shortcut</ins>

***[NOTE] Currently reworking this portion of the script to work using REGEX to extract information from the raw screenshot extract rather than cropping and extracting information to make the shortcut more compatible with all screen sizes.***

The screenshot is cropped to each of the regions in the screenshot and text is extracted and packaged as a json to be sent to the google script App.
1. Share when a screenshot is taken or select bulk upload of screenshots
2. Shortcut will iterate through selected screenshots
3. Screenshot dimensions and date taken are extracted
4. **[Currently being replaced]** Pixel ranges for each of the data points is defined
    - Ratios of sceenshot size are utilised to ensure compatability across iphone screen sizes.
5. **[Currently being replaced]** Images are cropped to each region and text extracted from image
6. Text is processed to remove any unwanted portions
7. Data points are compiled into a JSON and posted via URL to Google App
8. Alert will appear when google script is complete either indicating success or error.

### <ins>Google App Script</ins>
The json packet sent from the Shortcut via URL post is parsed and processed to be appended to specified Google Sheet table.
1. Player name is fuzzy matched to a predefined list of most common players to account for any minor errors (e.g. "0" instead of "O"/"i" instead of "l") in the OCR text detection
2. Aircraft name is matched to ICAO code in lookup table containing all current ingame aircraft.
3. Data is appended to appropriate column at the bottom of the table.
4. Table is sorted by date in descending order to bring record to top of table.
5. Status message returned to Shortcut to alert user that script is complete

[Note] - This portion of the tool is fully automated and does not require any input from the user. A copy of the code is available for reference if you are curious about this portion of the script is doing.

## Installation
SC.EX2 can be downloaded using the following file link.

[INSERT LINK HERE WHEN COMPLETE]

Open link and select Add Shortcut
Upon running the Shortcut for the first time you will be prompted to allow media sharing via the shortcut. Select allow always to never see this notification again. (This alert is tied to the amount of screenshots being processed and will appear when a greater amount is being input)
Upon completion of the Shortcut an alert should appear either indicating the script was successful including the players name and aircraft ICAO or an Error code. 
  - If an error code appears post to the XP Screenshots chat

## How to Run
### Instant Sharing Mode (Single Screenshots)
This mode allows quick upload of data during a battle by running the tool from the screenshot editer share Sheet. [Insert Share Icon]. It should be possible to take a screenshot and upload during the time you have between rounds, meaning you won't have to save the screenshot to your phone's storage.

Tool can be run directly when taking a screenshot 
1. Click small screenshot window to enable editing
2. Click share button
3. Scroll down to bottom of list and select Extract Card Information
4. Script will run in the background, you can close screenshot editting without saving screenshot.
5. When the script is complete you should receive a notification

### Bulk Upload Mode (Multiple Screenshots)
This mode allows multiple screenshot to be uploaded at a time from your photo library 

Bulk mode can be used by:
1. Run Shortcut (either from within shortcut app/home screen bookmark/siri etc.)
2. You will be prompted to select photos to be processed.
   - Select up to 10 screenshots.
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

### In Development
- (Ongoing) Optimise scripting speed
- Switch to scraping all text data from the right side of the screenshot and using regular expressions (REGEX) to extract record information
  
### Backlog
- Add automated Record ID
- Dump raw text grab in a separate sheet with corresponding Record ID for refence/manual correction should an error occur
    - Alternatively, upload the cropped screenshot for manual checking 
- Function to flag incorrect names in status column
- Function to add new player names to lookup table if not found during fuzzy playuer name check
- Data quality check within shortcut before pushing to google script to ensure no null values are being sent.
- Clean up all of the names in the lookup table so that they are clean
- Test google drive OCR Text recognition capabilities

### Deprecated Features/Upates
- Using defined pixel regions to extract infromation from screenshot - not reliable for scrpaing information from different screenshot/phone screen sizes
- Update Pixel region ratios to be more compatible with screen sizes

## Troubleshooting
Some fuckass left the door open again and a fly got into the script :(
