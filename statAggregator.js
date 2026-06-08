/**
 * statAggregator.js
 * Processes the Zomball match timeline and calculates advanced survival statistics.
 */

window.aggregateZomballStats = function(matchData) {
    if (!matchData || !matchData.timeline || !matchData.players) {
        throw new Error("JSON structure doesn't match expected Zomball match data layout.");
    }

    // 1. Build Zombie Count Intervals based on the timeline
    let intervals = [];
    let currentCount = matchData.startingZombieCount || 1;
    let lastTime = 0;

    matchData.timeline.forEach(event => {
        if (event.type === 'join_zombie') {
            intervals.push({ start: lastTime, end: event.time, count: currentCount });
            currentCount = event.zombieCount;
            lastTime = event.time;
        } else if (event.type === 'match_over') {
            intervals.push({ start: lastTime, end: event.time, count: currentCount });
        }
    });

    // Extract all unique horde sizes that existed during the match
    const uniqueZombieCounts = [...new Set(intervals.map(i => i.count))].sort((a, b) => a - b);
    const playerStats = [];

    // 2. Process Player Stats
    Object.entries(matchData.players).forEach(([id, playerData]) => {
        const name = playerData.name;
        
        // Filter out loop/glitch human stints to get their true survival time
        const trueHumanStint = playerData.humanStints.find(stint => !stint.isSpawnKill);
        const isAlpha = playerData.humanStints.length === 0;

        let vsTimes = {};
        uniqueZombieCounts.forEach(c => vsTimes[c] = 0);
        let totalSurvivalSeconds = null;
        let zombiesAtDeath = null;

        // If they played as a survivor, calculate their times
        if (!isAlpha && trueHumanStint) {
            const spawnTime = trueHumanStint.spawnTime || 0;
            const deathTime = trueHumanStint.deathTime;
            
            totalSurvivalSeconds = trueHumanStint.durationFrames / 60;
            zombiesAtDeath = trueHumanStint.zombiesOnDeath;

            // Check their lifespan against every zombie interval timeline
            intervals.forEach(interval => {
                const overlapStart = Math.max(spawnTime, interval.start);
                const overlapEnd = Math.min(deathTime, interval.end);
                const framesSurvived = Math.max(0, overlapEnd - overlapStart);
                
                if (framesSurvived > 0) {
                    vsTimes[interval.count] += framesSurvived;
                }
            });
        }

        // Tally ONLY valid tags
        let validTags = 0;
        if (playerData.zombieStints) {
            playerData.zombieStints.forEach(stint => {
                validTags += stint.validTags;
            });
        }

        // Push processed data to array
        playerStats.push({
            name,
            isAlpha,
            totalSurvivalSeconds,
            zombiesAtDeath,
            vsTimes,
            validTags
        });
    });

    // Return structured data for the UI to render
    return { uniqueZombieCounts, playerStats };
};