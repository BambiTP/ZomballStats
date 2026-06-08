// --- Internal Utilities (Not Exported) ---

class LogReader {
    constructor(data) {
        this.data = data;
        this.pos = 0;
    }
    end() { return (this.pos >> 3) >= this.data.length; }
    readBool() {
        if (this.end()) return 0;
        const result = (this.data[this.pos >> 3] >> (7 - (this.pos & 7))) & 1;
        this.pos++;
        return result;
    }
    readFixed(bits) {
        let result = 0;
        while (bits--) result = (result << 1) | this.readBool();
        return result;
    }
    readTally() {
        let result = 0;
        while (this.readBool()) result++;
        return result;
    }
    readFooter() {
        let size = this.readFixed(2) << 3;
        let free = (8 - (this.pos & 7)) & 7;
        size |= free;
        let minimum = 0;
        while (free < size) {
            minimum += 1 << free;
            free += 8;
        }
        return this.readFixed(size) + minimum;
    }
}

// Replaced Node's Buffer with Browser's atob()
function decodeBase64ToBytes(base64Str) {
    if (!base64Str) return new Uint8Array(0);
    const binaryString = atob(base64Str);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
}

function getBitSizes(size) {
    size *= 40;
    let grid = size - 1;
    let result = 32;
    if (!(grid & 0xFFFF0000)) { result -= 16; grid <<= 16; }
    if (!(grid & 0xFF000000)) { result -= 8;  grid <<= 8;  }
    if (!(grid & 0xF0000000)) { result -= 4;  grid <<= 4;  }
    if (!(grid & 0xC0000000)) { result -= 2;  grid <<= 2;  }
    if (!(grid & 0x80000000))   result--;
    return [result, (((1 << result) - size) >> 1) + 20];
}

// --- Constants ---
const Team  = { none: 0, red: 1, blue: 2 };
const Flag  = { none: 0, opponent: 1, opponentPotato: 2, neutral: 3, neutralPotato: 4, temporary: 5 };
const Power = { none: 0, jukeJuice: 1, rollingBomb: 2, tagPro: 4, topSpeed: 8 };

// --- Internal Decoders ---
function decodeMap(base64Data, width) {
    const reader = new LogReader(decodeBase64ToBytes(base64Data));
    const grid = [];
    let x = 0, y = 0, currentRow = [];

    while (!reader.end() || x !== 0) {
        let tile = reader.readFixed(6);
        if (tile) {
            if      (tile <  6) tile +=   9;              //  1- 5 ->  10- 14
            else if (tile < 13) tile  = (tile -  4) * 10; //  6-12 ->  20- 80
            else if (tile < 17) tile +=  77;              // 13-16 ->  90- 93
            else if (tile < 20) tile  = (tile -  7) * 10; // 17-19 -> 100-120
            else if (tile < 22) tile += 110;              // 20-21 -> 130-131
            else if (tile < 32) tile  = (tile -  8) * 10; // 22-31 -> 140-230
            else if (tile < 34) tile += 208;              // 32-33 -> 240-241
            else if (tile < 36) tile += 216;              // 34-35 -> 250-251
            else                tile  = (tile - 10) * 10; // 36-63 -> 260-530
        }

        let count = 1 + reader.readFooter();
        for (let i = 0; i < count; i++) {
            currentRow.push(tile);
            x++;
            if (x === width) {
                grid.push(currentRow);
                currentRow = [];
                x = 0;
                y++;
            }
        }
    }
    return grid;
}

function decodePlayerEvents(base64Data, startingTeam, duration) {
    const reader = new LogReader(decodeBase64ToBytes(base64Data));
    const events = [];
    let time = 0, flag = Flag.none, powers = Power.none;
    let team = startingTeam;
    let prevent = false, button = false, block = false;

    while (!reader.end()) {
        let newTeam;
        if (reader.readBool()) {
            if (team) newTeam = reader.readBool() ? Team.none : 3 - team;
            else      newTeam = 1 + reader.readBool();                   
        } else {
            newTeam = team;                                              
        }

        const dropPop  = reader.readBool();
        const returns  = reader.readTally();
        const tags     = reader.readTally();
        const grab     = !flag && reader.readBool();
        let   captures = reader.readTally();

        let keep = !dropPop && newTeam && (newTeam === team || !team) &&
                   (!captures || (!flag && !grab) || reader.readBool());

        const newFlag  = grab ? (keep ? 1 + reader.readFixed(2) : Flag.temporary) : flag;
        let   powerups = reader.readTally();

        let powersDown = Power.none, powersUp = Power.none;
        for (let i = 1; i < 16; i <<= 1) {
            if (powers & i) { if (reader.readBool()) powersDown |= i; }
            else if (powerups && reader.readBool()) { powersUp |= i; powerups--; }
        }

        const togglePrevent = reader.readBool();
        const toggleButton  = reader.readBool();
        const toggleBlock   = reader.readBool();

        time += 1 + reader.readFooter();

        if (!team && newTeam) {
            team = newTeam;
            events.push({ type: 'join', time, team });
        }

        for (let i = 0; i < returns; i++) events.push({ type: 'return', time, flag, powers, team });
        for (let i = 0; i < tags;    i++) events.push({ type: 'tag',    time, flag, powers, team });

        if (grab) {
            flag = newFlag;
            events.push({ type: 'grab', time, flag, powers, team });
        }

        if (captures--) {
            do {
                if (keep || !flag) {
                    events.push({ type: 'flaglessCapture', time, flag, powers, team });
                } else {
                    events.push({ type: 'capture', time, flag, powers, team });
                    flag = Flag.none; 
                    keep = true;
                }
            } while (captures--);
        }

        for (let i = 1; i < 16; i <<= 1) {
            if (powersDown & i) {
                powers ^= i;
                events.push({ type: 'powerdown', time, flag, power: i, powers, team });
            } else if (powersUp & i) {
                powers |= i;
                events.push({ type: 'powerup', time, flag, power: i, powers, team });
            }
        }

        for (let i = 0; i < powerups; i++) events.push({ type: 'duplicatePowerup', time, flag, powers, team });

        if (togglePrevent) {
            if (prevent) { events.push({ type: 'stopPrevent',  time, flag, powers, team }); prevent = false; }
            else         { events.push({ type: 'startPrevent', time, flag, powers, team }); prevent = true;  }
        }

        if (toggleButton) {
            if (button) { events.push({ type: 'stopButton',  time, flag, powers, team }); button = false; }
            else         { events.push({ type: 'startButton', time, flag, powers, team }); button = true;  }
        }

        if (toggleBlock) {
            if (block) { events.push({ type: 'stopBlock',  time, flag, powers, team }); block = false; }
            else        { events.push({ type: 'startBlock', time, flag, powers, team }); block = true;  }
        }

        if (dropPop) {
            if (flag) {
                events.push({ type: 'drop', time, flag, powers, team });
                flag = Flag.none;
            } else {
                events.push({ type: 'pop', time, powers, team });
            }
        }

        if (newTeam !== team) {
            if (!newTeam) {
                events.push({ type: 'quit', time, flag, powers, team });
                powers = Power.none;
            } else {
                events.push({ type: 'switch', time, flag, powers, team: newTeam });
            }
            flag = Flag.none;
            team = newTeam;
        }
    }

    events.push({ type: 'end', time: duration, flag, powers, team });
    return events;
}

function decodeSplats(base64Data, mapWidth, mapHeight) {
    const reader = new LogReader(decodeBase64ToBytes(base64Data));
    const xBits = getBitSizes(mapWidth);
    const yBits = getBitSizes(mapHeight);
    const splatTimeline = [];
    let timeIndex = 0;

    while (!reader.end()) {
        let count = reader.readTally();
        if (count > 0) {
            const currentSplats = [];
            while (count--) {
                currentSplats.push({
                    x: reader.readFixed(xBits[0]) - xBits[1],
                    y: reader.readFixed(yBits[0]) - yBits[1]
                });
            }
            splatTimeline.push({ timeIndex, splats: currentSplats });
        }
        timeIndex++;
    }
    return splatTimeline;
}

// --- Core Processing Logic ---
function processSingleMatch(matchData, mapsData, options) {
    const result = {};
    if (matchData.id) result.id = matchData.id;

    if (options.gameinfo) {
        for (const key in matchData) {
            if (!['map', 'players', 'teams', 'id'].includes(key)) {
                result[key] = matchData[key];
            }
        }
    }

    // Single matches already contain map info here
    let mapWidth = 0;
    let mapHeight = 0;
    let mapTiles = null;
    const targetMapId = matchData.mapId;

    if (matchData.map && matchData.map.width && matchData.map.tiles) {
        mapWidth = matchData.map.width;
        mapTiles = matchData.map.tiles;
    } else if (mapsData && mapsData[targetMapId]) {
        mapWidth = mapsData[targetMapId].width;
        mapTiles = mapsData[targetMapId].tiles;
    }

    let decodedTiles = null;
    if (mapWidth > 0 && mapTiles) {
        decodedTiles = decodeMap(mapTiles, mapWidth);
        mapHeight = decodedTiles.length;
    }

    if (options.map) {
        if (decodedTiles) {
            const externalMapData = (mapsData && mapsData[targetMapId]) ? mapsData[targetMapId] : {};
            result.map = {
                ...externalMapData,
                ...(matchData.map || {})
            };
            result.map.tiles = decodedTiles;
            result.map.width = mapWidth;
            result.map.height = mapHeight;
        } else {
            result.map = null;
        }
    }

    if (options.players && matchData.players) {
        result.players = matchData.players.map(player => {
            const p = { ...player };
            if (p.events) {
                p.events = decodePlayerEvents(p.events, p.team, matchData.duration);
            }
            return p;
        });
    }

    if ((options.team || options.splats) && matchData.teams) {
        result.teams = matchData.teams.map(team => {
            const t = options.team ? { ...team } : {};
            if (options.splats) {
                if (team.splats && mapWidth > 0 && mapHeight > 0) {
                    t.splats = decodeSplats(team.splats, mapWidth, mapHeight);
                } else {
                    t.splats = null;
                }
            }
            return t;
        });
    }

    return result;
}

// Helper to handle FileReader wrapping
function readJsonFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(JSON.parse(e.target.result));
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

// --- Exported API via window ---
window.TagProDecoder = {
    Team,
    Flag,
    Power,

    /**
     * Decode bulk matches from uploaded browser File objects.
     * @param {File} bulkFile - Browser File object for bulk matches.
     * @param {File|null} mapFile - Browser File object for maps JSON (optional).
     * @param {object} options - Options object
     * @param {Array|string} idArray - Array of match IDs, or 'all'.
     */
    decodeBulkMatches: async function(bulkFile, mapFile, options, idArray = 'all') {
        const matchesData = await readJsonFile(bulkFile);
        let mapsData = null;

        if (mapFile) {
            mapsData = await readJsonFile(mapFile);
        }

        let matchIds = Object.keys(matchesData);
        if (Array.isArray(idArray)) {
            matchIds = matchIds.filter(id => idArray.includes(id));
        }

        const results = [];
        for (const matchId of matchIds) {
            const matchData = matchesData[matchId];
            matchData.id = matchId;
            results.push(processSingleMatch(matchData, mapsData, options));
        }
        return results;
    },

    /**
     * Decode individual match files from uploaded browser File objects.
     * @param {FileList|Array<File>} files - Array or FileList of browser File objects
     * @param {object} options - Options object
     */
    decodeMatchFiles: async function(files, options) {
        const results = [];
        for (const file of files) {
            const fileData = await readJsonFile(file);
            results.push(processSingleMatch(fileData, null, options));
        }
        return results;
    }
};