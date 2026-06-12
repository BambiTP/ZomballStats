async function getData() {
    const cached = sessionStorage.getItem('zomball_matches');
    if (cached) return JSON.parse(cached);
    const response = await fetch('https://stats.zomball.workers.dev/stats/all');
    const matches = await response.json();
    sessionStorage.setItem('zomball_matches', JSON.stringify(matches));
    return matches;
}

function getTotalGames(matches) {
    return matches.length;
}

function getValidTagsByAuthPlayers(matches) {
    const totals = {};
    for (const match of matches) {
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.a !== 1) continue;
            const stats = match.pl[i];
            if (!stats || !stats.zS) continue;
            let tags = 0;
            for (const stint of stats.zS) {
                tags += stint.vT || 0;
            }
            totals[player.n] = (totals[player.n] || 0) + tags;
        }
    }
    return totals;
}

function getValidTagsForPlayer(matches, playerName) {
    let total = 0;
    for (const match of matches) {
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.n !== playerName || player.a !== 1) continue;
            const stats = match.pl[i];
            if (!stats || !stats.zS) continue;
            for (const stint of stats.zS) {
                total += stint.vT || 0;
            }
            break;
        }
    }
    return total;
}

function getGamesByAuthPlayers(matches) {
    const totals = {};
    for (const match of matches) {
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.a !== 1) continue;
            totals[player.n] = (totals[player.n] || 0) + 1;
        }
    }
    return totals;
}

function getGamesForPlayer(matches, playerName) {
    let total = 0;
    for (const match of matches) {
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.n !== playerName || player.a !== 1) continue;
            total++;
            break;
        }
    }
    return total;
}

function getSurvivalTimeByAuthPlayers(matches) {
    const totals = {};
    for (const match of matches) {
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.a !== 1) continue;
            const stats = match.pl[i];
            if (!stats || !stats.sT) continue;
            totals[player.n] = (totals[player.n] || 0) + stats.sT;
        }
    }
    return totals;
}

function getSurvivalTimeForPlayer(matches, playerName) {
    let total = 0;
    for (const match of matches) {
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.n !== playerName || player.a !== 1) continue;
            const stats = match.pl[i];
            if (stats && stats.sT) total += stats.sT;
            break;
        }
    }
    return total;
}
function getSurvivalTimePerZombieByAuthPlayers(matches) {
    const totals = {};
    for (const match of matches) {
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.a !== 1) continue;
            const stats = match.pl[i];
            if (!stats || !stats.sZ) continue;
            if (!totals[player.n]) totals[player.n] = {};
            for (const [zombieCount, time] of Object.entries(stats.sZ)) {
                totals[player.n][zombieCount] = (totals[player.n][zombieCount] || 0) + time;
            }
        }
    }
    return totals;
}

function getSurvivalTimePerZombieForPlayer(matches, playerName) {
    const totals = {};
    for (const match of matches) {
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.n !== playerName || player.a !== 1) continue;
            const stats = match.pl[i];
            if (stats && stats.sZ) {
                for (const [zombieCount, time] of Object.entries(stats.sZ)) {
                    totals[zombieCount] = (totals[zombieCount] || 0) + time;
                }
            }
            break;
        }
    }
    return totals;
}
function getFirstLastNeverByAuthPlayers(matches) {
    const totals = {};
    for (const match of matches) {
        const initialZombies = new Set(match.iZ);
        const survivors = [];
        const died = [];

        for (let i = 0; i < match.r.length; i++) {
            if (initialZombies.has(i)) continue;
            const player = match.r[i];
            if (player.a !== 1) continue;
            const stats = match.pl[i];
            if (!totals[player.n]) totals[player.n] = { firstToDie: 0, lastAlive: 0, neverDied: 0 };
            if (!stats || !stats.tB) {
                survivors.push(player.n);
            } else {
                died.push({ name: player.n, t: stats.tB.t });
            }
        }

        for (const name of survivors) {
            totals[name].neverDied++;
            totals[name].lastAlive++;
        }

        if (died.length > 0) {
            died.sort((a, b) => a.t - b.t);
            totals[died[0].name].firstToDie++;
            if (survivors.length === 0) {
                totals[died[died.length - 1].name].lastAlive++;
            }
        }
    }
    return totals;
}

function getFirstLastNeverForPlayer(matches, playerName) {
    const totals = { firstToDie: 0, lastAlive: 0, neverDied: 0 };
    for (const match of matches) {
        const initialZombies = new Set(match.iZ);
        let playerIndex = -1;
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.n === playerName && player.a === 1 && !initialZombies.has(i)) {
                playerIndex = i;
                break;
            }
        }
        if (playerIndex === -1) continue;

        const playerStats = match.pl[playerIndex];
        const survivors = [];
        const died = [];

        for (let i = 0; i < match.r.length; i++) {
            if (initialZombies.has(i)) continue;
            const stats = match.pl[i];
            if (!stats || !stats.tB) {
                survivors.push(i);
            } else {
                died.push({ index: i, t: stats.tB.t });
            }
        }

        if (!playerStats || !playerStats.tB) {
            totals.neverDied++;
            totals.lastAlive++;
        } else {
            died.sort((a, b) => a.t - b.t);
            if (died[0].index === playerIndex) totals.firstToDie++;
            if (survivors.length === 0 && died[died.length - 1].index === playerIndex) totals.lastAlive++;
        }
    }
    return totals;
}
function getInitialZombieCountByAuthPlayers(matches) {
    const totals = {};
    for (const match of matches) {
        const initialZombies = new Set(match.iZ);
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.a !== 1) continue;
            totals[player.n] = (totals[player.n] || 0) + (initialZombies.has(i) ? 1 : 0);
        }
    }
    return totals;
}

function getInitialZombieCountForPlayer(matches, playerName) {
    let total = 0;
    for (const match of matches) {
        const initialZombies = new Set(match.iZ);
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.n !== playerName || player.a !== 1) continue;
            if (initialZombies.has(i)) total++;
            break;
        }
    }
    return total;
}
function getGameCountPerZombieByAuthPlayers(matches) {
    const totals = {};
    for (const match of matches) {
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.a !== 1) continue;
            const stats = match.pl[i];
            if (!stats || !stats.sZ) continue;
            if (!totals[player.n]) totals[player.n] = {};
            for (const zombieCount of Object.keys(stats.sZ)) {
                totals[player.n][zombieCount] = (totals[player.n][zombieCount] || 0) + 1;
            }
        }
    }
    return totals;
}