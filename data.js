async function getData() {
    const cached = sessionStorage.getItem('zomball_matches');
    if (cached) return JSON.parse(cached);
    const response = await fetch('https://stats.zomball.workers.dev/stats/all');
    const matches = await response.json();
    sessionStorage.setItem('zomball_matches', JSON.stringify(matches));
    return matches;
}

function filterMatches(matches, period) {
    if (period === 'all') return matches;

    const now = new Date();
    const estOffset = -5 * 60;
    const utcMinutes = now.getTime() / 60000 + now.getTimezoneOffset();
    const estNow = new Date((utcMinutes + estOffset) * 60000);

    let cutoff;
    if (period === 'today') {
        cutoff = new Date(estNow);
        cutoff.setHours(10, 0, 0, 0);
        if (estNow.getHours() < 10) cutoff.setDate(cutoff.getDate() - 1);
    } else if (period === 'week') {
        cutoff = new Date(estNow);
        const day = cutoff.getDay();
        const diffToMonday = (day === 0 ? -6 : 1 - day);
        cutoff.setDate(cutoff.getDate() + diffToMonday);
        cutoff.setHours(10, 0, 0, 0);
    } else if (period === 'month') {
        cutoff = new Date(estNow);
        cutoff.setDate(1);
        cutoff.setHours(10, 0, 0, 0);
    }

    const cutoffUnix = (cutoff.getTime() / 1000) + (5 * 60 * 60);
    return matches.filter(m => m.d >= cutoffUnix);
}

function getPlayerMatchSets(matches, limit) {
    const playerMatchSets = {};
    const sorted = matches.slice().sort((a, b) => b.d - a.d);
    for (const match of sorted) {
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.a !== 1) continue;
            if (!playerMatchSets[player.n]) playerMatchSets[player.n] = new Set();
            if (playerMatchSets[player.n].size < limit) {
                playerMatchSets[player.n].add(match.u);
            }
        }
    }
    return playerMatchSets;
}

function shouldCount(playerMatchSets, playerName, matchUuid) {
    if (!playerMatchSets) return true;
    return playerMatchSets[playerName] && playerMatchSets[playerName].has(matchUuid);
}

function framesToTime(frames) {
    const totalSeconds = Math.floor(frames / 60);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes + ':' + String(seconds).padStart(2, '0');
}

function getTotalGames(matches) {
    return matches.length;
}

function getValidTagsByAuthPlayers(matches, playerMatchSets) {
    const totals = {};
    for (const match of matches) {
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.a !== 1) continue;
            if (!shouldCount(playerMatchSets, player.n, match.u)) continue;
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

function getValidTagsForPlayer(matches, playerName, playerMatchSets) {
    let total = 0;
    for (const match of matches) {
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.n !== playerName || player.a !== 1) continue;
            if (!shouldCount(playerMatchSets, playerName, match.u)) continue;
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

function getGamesByAuthPlayers(matches, playerMatchSets) {
    const totals = {};
    for (const match of matches) {
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.a !== 1) continue;
            if (!shouldCount(playerMatchSets, player.n, match.u)) continue;
            totals[player.n] = (totals[player.n] || 0) + 1;
        }
    }
    return totals;
}

function getGamesForPlayer(matches, playerName, playerMatchSets) {
    let total = 0;
    for (const match of matches) {
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.n !== playerName || player.a !== 1) continue;
            if (!shouldCount(playerMatchSets, playerName, match.u)) continue;
            total++;
            break;
        }
    }
    return total;
}

function getSurvivalTimeByAuthPlayers(matches, playerMatchSets) {
    const totals = {};
    for (const match of matches) {
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.a !== 1) continue;
            if (!shouldCount(playerMatchSets, player.n, match.u)) continue;
            const stats = match.pl[i];
            if (!stats || !stats.sT) continue;
            totals[player.n] = (totals[player.n] || 0) + stats.sT;
        }
    }
    return totals;
}

function getSurvivalTimeForPlayer(matches, playerName, playerMatchSets) {
    let total = 0;
    for (const match of matches) {
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.n !== playerName || player.a !== 1) continue;
            if (!shouldCount(playerMatchSets, playerName, match.u)) continue;
            const stats = match.pl[i];
            if (stats && stats.sT) total += stats.sT;
            break;
        }
    }
    return total;
}

function getSurvivalTimePerZombieByAuthPlayers(matches, playerMatchSets) {
    const totals = {};
    for (const match of matches) {
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.a !== 1) continue;
            if (!shouldCount(playerMatchSets, player.n, match.u)) continue;
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

function getSurvivalTimePerZombieForPlayer(matches, playerName, playerMatchSets) {
    const totals = {};
    for (const match of matches) {
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.n !== playerName || player.a !== 1) continue;
            if (!shouldCount(playerMatchSets, playerName, match.u)) continue;
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

function getGameCountPerZombieByAuthPlayers(matches, playerMatchSets) {
    const totals = {};
    for (const match of matches) {
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.a !== 1) continue;
            if (!shouldCount(playerMatchSets, player.n, match.u)) continue;
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

function getFirstLastNeverByAuthPlayers(matches, playerMatchSets) {
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
                survivors.push({ name: player.n });
            } else {
                died.push({ name: player.n, t: stats.tB.t });
            }
        }

        for (const s of survivors) {
            if (shouldCount(playerMatchSets, s.name, match.u)) {
                totals[s.name].neverDied++;
                totals[s.name].lastAlive++;
            }
        }

        if (died.length > 0) {
            died.sort((a, b) => a.t - b.t);
            if (shouldCount(playerMatchSets, died[0].name, match.u)) totals[died[0].name].firstToDie++;
            if (survivors.length === 0 && shouldCount(playerMatchSets, died[died.length - 1].name, match.u)) {
                totals[died[died.length - 1].name].lastAlive++;
            }
        }
    }
    return totals;
}

function getFirstLastNeverForPlayer(matches, playerName, playerMatchSets) {
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
        if (!shouldCount(playerMatchSets, playerName, match.u)) continue;

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

function getInitialZombieCountByAuthPlayers(matches, playerMatchSets) {
    const totals = {};
    for (const match of matches) {
        const initialZombies = new Set(match.iZ);
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.a !== 1) continue;
            if (!shouldCount(playerMatchSets, player.n, match.u)) continue;
            totals[player.n] = (totals[player.n] || 0) + (initialZombies.has(i) ? 1 : 0);
        }
    }
    return totals;
}

function getInitialZombieCountForPlayer(matches, playerName, playerMatchSets) {
    let total = 0;
    for (const match of matches) {
        const initialZombies = new Set(match.iZ);
        for (let i = 0; i < match.r.length; i++) {
            const player = match.r[i];
            if (player.n !== playerName || player.a !== 1) continue;
            if (!shouldCount(playerMatchSets, playerName, match.u)) continue;
            if (initialZombies.has(i)) total++;
            break;
        }
    }
    return total;
}
