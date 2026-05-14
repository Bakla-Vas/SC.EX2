// ============================================================
// Lookup.gs
// Sky Cards EX2 — Lookup Table and Matching Functions
//
// PURPOSE:
//   Reads the Lookup Tables sheet and provides fuzzy player
//   name matching and ICAO code resolution from OCR text.
//
// CACHE STRATEGY (SS.ID.17):
//   Three optimisations applied to stay well within the
//   CacheService 100KB per-key limit as tables grow:
//
//   Option 1 — Column filtering
//     Only the columns the script actually needs are cached:
//     - Player list:   ["PlayerName", ...]
//     - Aircraft list: {"ICAO": "FULL NAME UPPERCASE", ...}
//     All other columns in the sheet are discarded before
//     caching, reducing payload by ratio of used vs total cols.
//
//   Option 2 — Split cache keys
//     Player list and aircraft list are stored under separate
//     cache keys (CONFIG.cachePlayerKey / cacheAircraftKey).
//     Each has its own 100KB chunk budget and can be cleared
//     independently via clearPlayerCache() / clearAircraftCache().
//
//   Option 3 — Compact JSON format
//     Player list: plain array of strings ["Name1","Name2"]
//     Aircraft list: flat key-value object {"ICAO":"NAME"}
//     Both eliminate structural overhead from the 2D array
//     format (row wrappers, column wrappers, blank cells).
//
//   Chunking:
//     Each list is split into 90KB chunks if needed, stored
//     under numbered keys (_0, _1 ...) and a count key (_n).
//     All chunks are written/read in a single putAll/getAll
//     call to minimise CacheService API calls.
//
// DEPENDS ON:  CONFIG (Config.gs)
//              levenshteinDistance, normaliseOCR,
//              findColIndex (Utils.gs)
// USED BY:     Main.gs (doPost)
// ============================================================

var CACHE_CHUNK_SIZE = 90000; // bytes -- safely under 100KB limit


// ============================================================
// CACHE WRITE -- chunked putAll
// Serialises data to JSON, splits into 90KB chunks, and
// writes all chunks plus a count key in a single putAll()
// call. TTL is 21600s (CacheService maximum). The 12-hour
// logical expiry is enforced by the timestamp key.
// ============================================================
function writeToCache(cache, baseKey, data) {
  var serialised  = JSON.stringify(data);
  var totalLength = serialised.length;
  var entries     = {};
  var chunkCount  = 0;

  for (var i = 0; i < totalLength; i += CACHE_CHUNK_SIZE) {
    entries[baseKey + "_" + chunkCount] =
      serialised.substring(i, i + CACHE_CHUNK_SIZE);
    chunkCount++;
  }
  entries[baseKey + "_n"] = chunkCount.toString();

  cache.putAll(entries, 21600);
  Logger.log(
    "writeToCache [" + baseKey + "]: " +
    chunkCount + " chunk(s) -- " +
    Math.round(totalLength / 1024) + "KB"
  );
}


// ============================================================
// CACHE READ -- chunked getAll
// Reads the count key, retrieves all chunks in a single
// getAll() call, reassembles and deserialises.
// Returns null if any chunk is missing (incomplete cache).
// ============================================================
function readFromCache(cache, baseKey) {
  var countStr = cache.get(baseKey + "_n");
  if (!countStr) return null;

  var count = parseInt(countStr, 10);
  var keys  = [];
  for (var c = 0; c < count; c++) {
    keys.push(baseKey + "_" + c);
  }

  var chunks      = cache.getAll(keys);
  var reassembled = "";
  for (var c = 0; c < count; c++) {
    var chunk = chunks[baseKey + "_" + c];
    if (!chunk) {
      Logger.log("readFromCache [" + baseKey + "]: Chunk " + c + " missing");
      return null;
    }
    reassembled += chunk;
  }

  return JSON.parse(reassembled);
}


// ============================================================
// REMOVE CACHE KEYS -- chunked removeAll
// Removes all chunk keys and the count key for a base key.
// Optionally removes the shared timestamp key.
// ============================================================
function removeCacheKeys(cache, baseKey, removeTimestamp) {
  var countStr = cache.get(baseKey + "_n");
  var keys     = [baseKey + "_n"];

  if (countStr) {
    var count = parseInt(countStr, 10);
    for (var c = 0; c < count; c++) {
      keys.push(baseKey + "_" + c);
    }
  }

  if (removeTimestamp) {
    keys.push(CONFIG.cacheTimestampKey);
  }

  cache.removeAll(keys);
  Logger.log(
    "removeCacheKeys [" + baseKey + "]: Removed " +
    keys.length + " key(s)"
  );
}


// ============================================================
// BUILD PLAYER LIST -- compact array format (Option 1 + 3)
// Extracts only the Player column from the full sheet data
// and returns a plain array of name strings.
// Result: ["Woofles", "Kitty", "Tuck5829", ...]
// ============================================================
function buildPlayerList(sheetData) {
  var found = findColIndex(sheetData, CONFIG.playerCol);
  if (!found) {
    Logger.log("buildPlayerList: Player column not found");
    return [];
  }

  var players = [];
  for (var i = found.row + 1; i < sheetData.length; i++) {
    var name = sheetData[i][found.col].toString().trim();
    if (name !== "") players.push(name);
  }

  Logger.log("buildPlayerList: " + players.length + " players extracted");
  return players;
}


// ============================================================
// BUILD AIRCRAFT MAP -- compact key-value format (Option 1 + 3)
// Extracts only ICAO and Full Name columns from sheet data
// and returns a flat object keyed by ICAO code.
// Names stored uppercase to match OCR normalisation.
// Result: {"A388": "AIRBUS A380", "SOL2": "SOLAR IMPULSE 2"}
// ============================================================
function buildAircraftMap(sheetData) {
  var icaoFound = findColIndex(sheetData, CONFIG.icaoCol);
  var nameFound = findColIndex(sheetData, CONFIG.aircraftCol);

  if (!icaoFound || !nameFound) {
    Logger.log("buildAircraftMap: ICAO or Full Name column not found");
    return {};
  }

  var aircraftMap = {};
  for (var i = icaoFound.row + 1; i < sheetData.length; i++) {
    var icao     = sheetData[i][icaoFound.col].toString().trim();
    var fullName = sheetData[i][nameFound.col].toString().trim().toUpperCase();
    if (icao && fullName) {
      aircraftMap[icao] = fullName;
    }
  }

  Logger.log(
    "buildAircraftMap: " +
    Object.keys(aircraftMap).length + " aircraft extracted"
  );
  return aircraftMap;
}


// ============================================================
// GET SHEET DATA -- single read shared across both lists
// Reads the full lookup sheet once and passes the 2D array
// to both buildPlayerList() and buildAircraftMap() when
// both caches are cold simultaneously. Internal use only.
// ============================================================
function getSheetData(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(CONFIG.lookupSheet);
  if (!sheet) {
    Logger.log("Error: Lookup sheet '" + CONFIG.lookupSheet + "' not found");
    return null;
  }
  return sheet.getDataRange().getValues();
}


// ============================================================
// GET PLAYER LIST
// Returns the cached player array if valid, otherwise reads
// the sheet, builds the compact list, and writes to cache.
// Cache failures are non-fatal -- always falls back to sheet.
// ============================================================
function getPlayerList(spreadsheet) {
  var cache = CacheService.getScriptCache();
  var now   = Math.floor(Date.now() / 1000);

  try {
    var ts = cache.get(CONFIG.cacheTimestampKey);
    if (ts && (now - parseInt(ts, 10)) < CONFIG.cacheDuration) {
      var cached = readFromCache(cache, CONFIG.cachePlayerKey);
      if (cached) {
        Logger.log(
          "getPlayerList: Cache hit -- " + cached.length + " players" +
          " (expires in " +
          (CONFIG.cacheDuration - (now - parseInt(ts, 10))) + "s)"
        );
        return cached;
      }
    } else {
      Logger.log("getPlayerList: Cache miss or expired -- reading from sheet");
    }
  } catch (err) {
    Logger.log("getPlayerList: Cache read error -- " + err.message);
  }

  var sheetData  = getSheetData(spreadsheet);
  if (!sheetData) return [];
  var playerList = buildPlayerList(sheetData);

  try {
    writeToCache(cache, CONFIG.cachePlayerKey, playerList);
    cache.put(CONFIG.cacheTimestampKey, now.toString(), 21600);
  } catch (err) {
    Logger.log("getPlayerList: Cache write error -- " + err.message);
  }

  return playerList;
}


// ============================================================
// GET AIRCRAFT MAP
// Returns the cached aircraft object if valid, otherwise
// reads the sheet, builds the compact map, and writes to
// cache. Cache failures are non-fatal -- always falls back.
// ============================================================
function getAircraftMap(spreadsheet) {
  var cache = CacheService.getScriptCache();
  var now   = Math.floor(Date.now() / 1000);

  try {
    var ts = cache.get(CONFIG.cacheTimestampKey);
    if (ts && (now - parseInt(ts, 10)) < CONFIG.cacheDuration) {
      var cached = readFromCache(cache, CONFIG.cacheAircraftKey);
      if (cached) {
        Logger.log(
          "getAircraftMap: Cache hit -- " +
          Object.keys(cached).length + " aircraft" +
          " (expires in " +
          (CONFIG.cacheDuration - (now - parseInt(ts, 10))) + "s)"
        );
        return cached;
      }
    } else {
      Logger.log("getAircraftMap: Cache miss or expired -- reading from sheet");
    }
  } catch (err) {
    Logger.log("getAircraftMap: Cache read error -- " + err.message);
  }

  var sheetData   = getSheetData(spreadsheet);
  if (!sheetData) return {};
  var aircraftMap = buildAircraftMap(sheetData);

  try {
    writeToCache(cache, CONFIG.cacheAircraftKey, aircraftMap);
    cache.put(CONFIG.cacheTimestampKey, now.toString(), 21600);
  } catch (err) {
    Logger.log("getAircraftMap: Cache write error -- " + err.message);
  }

  return aircraftMap;
}


// ============================================================
// FUZZY MATCH PLAYER NAME
// Accepts the compact player array from getPlayerList()
// rather than the full 2D sheet data. Compares the OCR
// input against every known player using Levenshtein
// distance. Returns closest match within threshold, or the
// original OCR value if no match found.
// ============================================================
function fuzzyMatchPlayer(inputName, playerList) {
  if (!inputName || inputName.trim() === "") {
    Logger.log("fuzzyMatchPlayer: Empty input name");
    return inputName;
  }

  if (!playerList || playerList.length === 0) {
    Logger.log("fuzzyMatchPlayer: Empty player list -- returning input unchanged");
    return inputName;
  }

  var bestMatch    = inputName;
  var bestDistance = Infinity;

  for (var i = 0; i < playerList.length; i++) {
    var distance = levenshteinDistance(inputName, playerList[i]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch    = playerList[i];
    }
  }

  if (bestDistance <= CONFIG.matchThreshold) {
    Logger.log(
      "fuzzyMatchPlayer: '" + inputName + "' -> '" + bestMatch +
      "' (distance: " + bestDistance + ")"
    );
    return bestMatch;
  }

  Logger.log(
    "fuzzyMatchPlayer: No match for '" + inputName +
    "' -- best was '" + bestMatch +
    "' (distance: " + bestDistance + ")"
  );
  return inputName;
}


// ============================================================
// LOOKUP ICAO FROM RAW OCR TEXT
// Accepts the compact aircraft map from getAircraftMap().
// Converts map to array sorted longest name first to ensure
// specific names match before shorter substrings.
// Scans only the text after the first rarity word to avoid
// false positives against player names.
// ============================================================
function lookupICAOFromOCR(rawText, aircraftMap) {
  if (!rawText || rawText.trim() === "") {
    Logger.log("lookupICAOFromOCR: Empty OCR text received");
    return null;
  }

  if (!aircraftMap || Object.keys(aircraftMap).length === 0) {
    Logger.log("lookupICAOFromOCR: Empty aircraft map");
    return null;
  }

  var aircraft = [];
  for (var icao in aircraftMap) {
    aircraft.push({ icao: icao, name: aircraftMap[icao] });
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
    Logger.log(
      "lookupICAOFromOCR: Rarity word at position " + rarityPos +
      " -- scanning aircraft section only"
    );
  } else {
    searchText = fullNorm;
    Logger.log("lookupICAOFromOCR: Warning -- no rarity word found, scanning full text");
  }

  for (var i = 0; i < aircraft.length; i++) {
    if (searchText.indexOf(aircraft[i].name) !== -1) {
      Logger.log(
        "lookupICAOFromOCR: Matched '" + aircraft[i].name +
        "' -> " + aircraft[i].icao
      );
      return aircraft[i].icao;
    }
  }

  Logger.log("lookupICAOFromOCR: No aircraft match found");
  return null;
}


// ============================================================
// CLEAR PLAYER CACHE
// Call after updating the Player column in the lookup sheet.
// Only invalidates the player list -- aircraft cache is kept.
// ============================================================
function clearPlayerCache() {
  var cache = CacheService.getScriptCache();
  removeCacheKeys(cache, CONFIG.cachePlayerKey, false);
  cache.remove(CONFIG.cacheTimestampKey);
  Logger.log("clearPlayerCache: Player cache cleared");
}


// ============================================================
// CLEAR AIRCRAFT CACHE
// Call after updating the aircraft/ICAO columns in the
// lookup sheet. Only invalidates the aircraft list --
// player cache is kept.
// ============================================================
function clearAircraftCache() {
  var cache = CacheService.getScriptCache();
  removeCacheKeys(cache, CONFIG.cacheAircraftKey, false);
  cache.remove(CONFIG.cacheTimestampKey);
  Logger.log("clearAircraftCache: Aircraft cache cleared");
}


// ============================================================
// CLEAR ALL CACHES
// Call after updating both tables, or when a full refresh
// is needed. Clears player list, aircraft list, and the
// shared timestamp key.
// ============================================================
function clearAllCaches() {
  var cache = CacheService.getScriptCache();
  removeCacheKeys(cache, CONFIG.cachePlayerKey,   false);
  removeCacheKeys(cache, CONFIG.cacheAircraftKey, false);
  cache.remove(CONFIG.cacheTimestampKey);
  Logger.log("clearAllCaches: All lookup caches cleared");
}
