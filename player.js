const Player = (() => {
    let _allMatches = [];
    let _prevView = 'stats';
    let _currentMap = 'all';
    let _currentPeriod = 'all';
    let _vsLimit = null;
    let _vsSort = 'games';
    let _vsSortAsc = false;
    let _currentPlayerName = '';
    let _currentPlayerMatches = [];
    let _currentSharedMatchesMap = {};
    let _currentOpponents = [];

    // ── Utilities ──────────────────────────────────────────────────────────────

    function getPlayerIndex(match, playerName) {
        for (let i = 0; i < match.r.length; i++) {
            if (match.r[i].n === playerName && match.r[i].a === 1) return i;
        }
        return -1;
    }

    function getPlayerMaps(matches, playerName) {
        const maps = new Set();
        for (const match of matches) {
            if (getPlayerIndex(match, playerName) !== -1 && match.mN) maps.add(match.mN);
        }
        return Array.from(maps).sort();
    }

    function getPlayerMatches(matches, playerName, mapFilter) {
        return matches.filter(m => {
            if (mapFilter !== 'all' && m.mN !== mapFilter) return false;
            return getPlayerIndex(m, playerName) !== -1;
        }).sort((a, b) => b.d - a.d);
    }

    function getSharedMatches(matches, playerA, playerB, mapFilter) {
        return matches.filter(m => {
            if (mapFilter !== 'all' && m.mN !== mapFilter) return false;
            return getPlayerIndex(m, playerA) !== -1 && getPlayerIndex(m, playerB) !== -1;
        }).sort((a, b) => b.d - a.d);
    }

    // ── Stat Computation ───────────────────────────────────────────────────────

    function computePlayerStats(playerMatches, playerName, limit) {
        const matches = limit ? playerMatches.slice(0, limit) : playerMatches;
        let games = 0, startingZombie = 0, neverDied = 0, firstToDie = 0, lastAlive = 0;
        let validTags = 0, survivalTime = 0, zombieTime = 0;
        const survivalByZ = {}, gameCountByZ = {};

        for (const match of matches) {
            const pIdx = getPlayerIndex(match, playerName);
            if (pIdx === -1) continue;
            games++;

            const initialZombies = new Set(match.iZ);
            const stats = match.pl[pIdx];

            if (initialZombies.has(pIdx)) startingZombie++;

            if (stats) {
                if (stats.vT) validTags += stats.vT;
                if (stats.sT) survivalTime += stats.sT;
                if (stats.zT) zombieTime += stats.zT;
                if (stats.sZ) {
                    for (const [z, t] of Object.entries(stats.sZ)) {
                        survivalByZ[z] = (survivalByZ[z] || 0) + t;
                        gameCountByZ[z] = (gameCountByZ[z] || 0) + 1;
                    }
                }
            }

            const playerIsLjz = match.r[pIdx].ljz;
            if (!initialZombies.has(pIdx) && !playerIsLjz) {
                const died = [];
                let hasSurvivor = false;
                for (let i = 0; i < match.r.length; i++) {
                    if (initialZombies.has(i)) continue;
                    if (match.r[i].ljz) continue; // skip late join zombies
                    const s = match.pl[i];
                    if (!s) continue;
                    if (s.ste) hasSurvivor = true;
                    else if (s.tB) died.push({ index: i, t: s.tB.t });
                }
                if (!stats || stats.ste) {
                    neverDied++;
                    lastAlive++;
                } else if (stats.tB) {
                    died.sort((a, b) => a.t - b.t);
                    if (died.length > 0 && died[0].index === pIdx) firstToDie++;
                    if (!hasSurvivor && died.length > 0 && died[died.length - 1].index === pIdx) lastAlive++;
                }
            }
        }

        return { games, startingZombie, neverDied, firstToDie, lastAlive, validTags, survivalTime, zombieTime, survivalByZ, gameCountByZ };
    }

    function computeVsStats(sharedMatches, playerA, playerB, limit) {
        const matches = limit ? sharedMatches.slice(0, limit) : sharedMatches;
        let aKilledB = 0, bKilledA = 0;
        let aRunTotal = 0, aRunNonIZ = 0;
        let bRunTotal = 0, bRunNonIZ = 0;
        let aWonScore = 0, bWonScore = 0;

        for (const match of matches) {
            const aIdx = getPlayerIndex(match, playerA);
            const bIdx = getPlayerIndex(match, playerB);
            if (aIdx === -1 || bIdx === -1) continue;

            const aStats = match.pl[aIdx];
            const bStats = match.pl[bIdx];
            const initialZombies = new Set(match.iZ);
            const aIsIZ = initialZombies.has(aIdx);
            const bIsIZ = initialZombies.has(bIdx);

            // Kill counts
            if (aStats && aStats.tP) {
                for (const tag of aStats.tP) {
                    if (tag.p === bIdx) aKilledB++;
                }
            }
            if (aStats && aStats.tB && aStats.tB.p === bIdx) bKilledA++;

            // Run time calculations
            const aWasSurvivor = !aIsIZ && aStats && (aStats.sT > 0 || aStats.ste);
            const bWasSurvivor = !bIsIZ && bStats && (bStats.sT > 0 || bStats.ste);

            if (aWasSurvivor) {
                const aSurvEnd = aStats.tB ? aStats.tB.t : match.matchLength;
                if (bIsIZ) {
                    aRunTotal += aSurvEnd;
                } else if (bStats && bStats.tB) {
                    const timeRunning = Math.max(0, aSurvEnd - bStats.tB.t);
                    aRunTotal += timeRunning;
                    aRunNonIZ += timeRunning;
                }
            }

            if (bWasSurvivor) {
                const bSurvEnd = bStats.tB ? bStats.tB.t : match.matchLength;
                if (aIsIZ) {
                    bRunTotal += bSurvEnd;
                } else if (aStats && aStats.tB) {
                    const timeRunning = Math.max(0, bSurvEnd - aStats.tB.t);
                    bRunTotal += timeRunning;
                    bRunNonIZ += timeRunning;
                }
            }

            // Survivor score
            if (aWasSurvivor && bWasSurvivor) {
                const aDiedAt = aStats.tB ? aStats.tB.t : Infinity;
                const bDiedAt = bStats.tB ? bStats.tB.t : Infinity;
                if (aDiedAt < bDiedAt) bWonScore++;
                else if (bDiedAt < aDiedAt) aWonScore++;
            }
        }

        return { 
            aKilledB, bKilledA, 
            aRunTotal, aRunNonIZ, 
            bRunTotal, bRunNonIZ, 
            aWonScore, bWonScore, 
            matchCount: matches.length 
        };
    }

    // ── Rendering ─────────────────────────────────────────────────────────────

    function makeToggleBtn(label, active, onClick) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.marginRight = '6px';
        if (active) btn.style.fontWeight = 'bold';
        btn.onclick = onClick;
        return btn;
    }

    function renderPlayerStats(container, playerName, playerMatches, limit) {
        container.innerHTML = '';
        const stats = computePlayerStats(playerMatches, playerName, limit);
        const { games, startingZombie, neverDied, firstToDie, lastAlive, validTags,
                survivalTime, zombieTime, survivalByZ, gameCountByZ } = stats;

        const toggleDiv = document.createElement('div');
        toggleDiv.style.marginBottom = '10px';
        toggleDiv.appendChild(makeToggleBtn('All Time', !limit,
            () => renderPlayerStats(container, playerName, playerMatches, null)));
        toggleDiv.appendChild(makeToggleBtn('Last 50', limit === 50,
            () => renderPlayerStats(container, playerName, playerMatches, 50)));
        container.appendChild(toggleDiv);

        const nonStartingGames = games - startingZombie;
        const cols = [
            ['Games',           games],
            ['Starting Zombie', startingZombie],
            ['Never Died',      neverDied],
            ['First To Die',    firstToDie],
            ['Last Alive',      lastAlive],
            ['Valid Tags',      validTags],
            ['Avg Tags/Game',   games ? (validTags / games).toFixed(2) : '—'],
            ['Survival Time',   framesToTime(survivalTime)],
            ['Avg Survival',    nonStartingGames ? framesToTime(survivalTime / nonStartingGames) : '—'],
            ['Zombie Time',     framesToTime(zombieTime)],
        ];

        const table = document.createElement('table');
        table.style.marginBottom = '16px';
        const hRow = table.insertRow();
        const vRow = table.insertRow();
        for (const [label, value] of cols) {
            const th = document.createElement('th');
            th.textContent = label;
            hRow.appendChild(th);
            vRow.insertCell().textContent = value;
        }
        container.appendChild(table);

        const zKeys = Object.keys(survivalByZ).sort((a, b) => Number(a) - Number(b));
        if (zKeys.length > 0) {
            const zLabel = document.createElement('strong');
            zLabel.textContent = 'Survival Time vs Zombie Count';
            zLabel.style.display = 'block';
            zLabel.style.marginBottom = '4px';
            container.appendChild(zLabel);

            const zTable = document.createElement('table');
            const zHRow = zTable.insertRow();
            const zTotalRow = zTable.insertRow();
            const zAvgRow = zTable.insertRow();
            for (const z of zKeys) {
                const th = document.createElement('th');
                th.textContent = z + 'z';
                zHRow.appendChild(th);
                zTotalRow.insertCell().textContent = framesToTime(survivalByZ[z]);
                zAvgRow.insertCell().textContent = 'avg: ' + framesToTime(survivalByZ[z] / (gameCountByZ[z] || 1));
            }
            container.appendChild(zTable);
        }
    }

    function renderVsTable(container, playerName, opponents, sharedMatchesMap, vsLimit, sortBy, sortAsc) {
        container.innerHTML = '';

        const h3 = document.createElement('h3');
        h3.textContent = 'Head to Head';
        h3.style.margin = '0 0 8px';
        container.appendChild(h3);

        const toggleDiv = document.createElement('div');
        toggleDiv.style.marginBottom = '10px';
        toggleDiv.appendChild(makeToggleBtn('All Time', !vsLimit,
            () => { _vsLimit = null; reRenderVs(); }));
        toggleDiv.appendChild(makeToggleBtn('Last 50 Shared', vsLimit === 50,
            () => { _vsLimit = 50; reRenderVs(); }));
        container.appendChild(toggleDiv);

        const rows = opponents.map(opp => {
            const shared = sharedMatchesMap[opp];
            if (!shared || shared.length === 0) return null;
            return { opp, ...computeVsStats(shared, playerName, opp, vsLimit) };
        }).filter(Boolean);

        if (rows.length === 0) {
            const p = document.createElement('p');
            p.textContent = 'No shared matches found.';
            container.appendChild(p);
            return;
        }

        const sortFns = {
            games:         r => r.matchCount,
            kills:         r => r.aKilledB,
            deaths:        r => r.bKilledA,
            myRunTotal:    r => r.aRunTotal,
            myRunNonIZ:    r => r.aRunNonIZ,
            theirRunTotal: r => r.bRunTotal,
            theirRunNonIZ: r => r.bRunNonIZ,
            score:         r => r.aWonScore - r.bWonScore,
        };
        const fn = sortFns[sortBy] || sortFns.games;
        rows.sort((a, b) => sortAsc ? fn(a) - fn(b) : fn(b) - fn(a));

        const columns = [
            { key: null,            label: 'Opponent' },
            { key: 'games',         label: 'Games' },
            { key: 'kills',         label: 'I Killed Them' },
            { key: 'deaths',        label: 'They Killed Me' },
            { key: 'myRunTotal',    label: 'Ran From Them +PZ' },
            { key: 'myRunNonIZ',    label: 'Ran From Them -PZ' },
            { key: 'theirRunTotal', label: 'Ran From Me +PZ' },
            { key: 'theirRunNonIZ', label: 'Ran From Me -PZ' },
            { key: 'score',         label: 'Tagged First Score (Me - Them)' },
        ];

        const table = document.createElement('table');
        const hRow = table.insertRow();
        for (const col of columns) {
            const th = document.createElement('th');
            if (!col.key) {
                th.textContent = col.label;
            } else {
                const isActive = sortBy === col.key;
                const btn = document.createElement('button');
                btn.innerHTML = col.label + (isActive ? (sortAsc ? ' &uarr;' : ' &darr;') : '');
                btn.style.cssText = 'background:none;border:none;cursor:pointer;padding:0;font-size:inherit;font-weight:' + (isActive ? 'bold' : 'normal') + ';';
                btn.onclick = () => {
                    if (_vsSort === col.key) _vsSortAsc = !_vsSortAsc;
                    else { _vsSort = col.key; _vsSortAsc = false; }
                    reRenderVs();
                };
                th.appendChild(btn);
            }
            hRow.appendChild(th);
        }

        for (const row of rows) {
            const tr = table.insertRow();

            const oppCell = tr.insertCell();
            const oppBtn = document.createElement('button');
            oppBtn.textContent = row.opp;
            oppBtn.style.cssText = 'background:none;border:none;cursor:pointer;padding:0;text-decoration:underline;font-size:inherit;';
            oppBtn.onclick = () => Player.showPlayer(row.opp);
            oppCell.appendChild(oppBtn);

            tr.insertCell().textContent = row.matchCount;
            tr.insertCell().textContent = row.aKilledB;
            tr.insertCell().textContent = row.bKilledA;
            tr.insertCell().textContent = framesToTime(row.aRunTotal);
            tr.insertCell().textContent = framesToTime(row.aRunNonIZ);
            tr.insertCell().textContent = framesToTime(row.bRunTotal);
            tr.insertCell().textContent = framesToTime(row.bRunNonIZ);
            tr.insertCell().textContent = row.aWonScore + ' - ' + row.bWonScore;
        }

        container.appendChild(table);
    }

    function reRenderVs() {
        const container = document.getElementById('player-vs-container');
        if (container) {
            renderVsTable(container, _currentPlayerName, _currentOpponents,
                _currentSharedMatchesMap, _vsLimit, _vsSort, _vsSortAsc);
        }
    }

    function refreshPlayerContent() {
        const periodMatches = filterMatches(_allMatches, _currentPeriod);
        
        _currentPlayerMatches = getPlayerMatches(periodMatches, _currentPlayerName, _currentMap);

        const opponentSet = new Set();
        for (const match of _currentPlayerMatches) {
            for (const r of match.r) {
                if (r.a === 1 && r.n !== _currentPlayerName) opponentSet.add(r.n);
            }
        }
        _currentOpponents = Array.from(opponentSet).sort();

        _currentSharedMatchesMap = {};
        for (const opp of _currentOpponents) {
            _currentSharedMatchesMap[opp] = getSharedMatches(periodMatches, _currentPlayerName, opp, _currentMap);
        }

        const statsContainer = document.getElementById('player-stats-container');
        if (statsContainer) renderPlayerStats(statsContainer, _currentPlayerName, _currentPlayerMatches, null);

        reRenderVs();
        
        renderMatches(_currentPlayerMatches, 'player-matches-container');
    }

    function renderPlayer(playerName) {
        _currentPlayerName = playerName;
        _currentMap = 'all';
        _currentPeriod = 'all';

        const container = document.getElementById('player-view');
        container.innerHTML = '';

        const backBtn = document.createElement('button');
        backBtn.innerHTML = '&larr; Back';
        backBtn.onclick = () => Switcher.switchView(_prevView);
        container.appendChild(backBtn);

        const h2 = document.createElement('h2');
        h2.textContent = playerName;
        h2.style.margin = '8px 0';
        container.appendChild(h2);

        // --- Period Filter Bar ---
        const periodBar = document.createElement('div');
        periodBar.id = 'player-period-bar';
        periodBar.style.marginBottom = '8px';

        const addPeriodBtn = (label, value) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.dataset.period = value;
            btn.style.marginRight = '6px';
            if (value === _currentPeriod) btn.style.fontWeight = 'bold';
            btn.onclick = () => {
                _currentPeriod = value;
                document.querySelectorAll('#player-period-bar button').forEach(b => {
                    b.style.fontWeight = b.dataset.period === value ? 'bold' : '';
                });
                refreshPlayerContent();
            };
            periodBar.appendChild(btn);
        };

        addPeriodBtn('Today', 'today');
        addPeriodBtn('This Week', 'week');
        addPeriodBtn('This Month', 'month');
        addPeriodBtn('All Time', 'all');
        container.appendChild(periodBar);

        // --- Map Filter Bar ---
        const maps = getPlayerMaps(_allMatches, playerName);
        const mapBar = document.createElement('div');
        mapBar.id = 'player-map-bar';
        mapBar.style.marginBottom = '12px';

        const addMapBtn = (label, value) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.dataset.map = value;
            btn.style.marginRight = '6px';
            if (value === _currentMap) btn.style.fontWeight = 'bold';
            btn.onclick = () => {
                _currentMap = value;
                document.querySelectorAll('#player-map-bar button').forEach(b => {
                    b.style.fontWeight = b.dataset.map === value ? 'bold' : '';
                });
                refreshPlayerContent();
            };
            mapBar.appendChild(btn);
        };

        addMapBtn('All Maps', 'all');
        for (const map of maps) addMapBtn(map, map);
        container.appendChild(mapBar);

        const statsContainer = document.createElement('div');
        statsContainer.id = 'player-stats-container';
        statsContainer.style.marginBottom = '24px';
        container.appendChild(statsContainer);

        const vsContainer = document.createElement('div');
        vsContainer.id = 'player-vs-container';
        container.appendChild(vsContainer);

        const h3Matches = document.createElement('h3');
        h3Matches.textContent = 'Match History';
        h3Matches.style.marginTop = '24px';
        container.appendChild(h3Matches);

        const matchesContainer = document.createElement('div');
        matchesContainer.id = 'player-matches-container';
        container.appendChild(matchesContainer);

        refreshPlayerContent();
    }

    // ── Public ─────────────────────────────────────────────────────────────────

    function showPlayer(playerName, fromView) {
        if (fromView) _prevView = fromView;
        _vsSort = 'games';
        _vsSortAsc = false;
        _vsLimit = null;
        renderPlayer(playerName);
        Switcher.switchView('player');
    }

    function init(matches) {
        _allMatches = matches;
    }

    return { init, showPlayer };
})();
