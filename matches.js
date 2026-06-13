const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1515174901097566339/wvbet3Jna2JCoQlrVZdr9YHHnBJuzTgvt6WPuD9_vCj29Idzim-KV8CUGsjHgJYrlnsL';

function openAuditModal(matchId, matchUuid) {
    const existing = document.getElementById('audit-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'audit-modal';
    overlay.innerHTML = `
        <div id="audit-modal-box">
            <h3>Report Match ${matchId}</h3>
            <label for="audit-username">Username (optional)</label>
            <input id="audit-username" type="text" placeholder="Your name" />
            <label for="audit-reason">Reason</label>
            <input id="audit-reason" type="text" placeholder="Describe the issue" />
            <div id="audit-error"></div>
            <div id="audit-buttons">
                <button id="audit-cancel">Cancel</button>
                <button id="audit-submit">Submit</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('audit-cancel').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    document.getElementById('audit-submit').onclick = async () => {
        const username = document.getElementById('audit-username').value.trim();
        const reason = document.getElementById('audit-reason').value.trim();
        const errorEl = document.getElementById('audit-error');

        if (!reason) {
            errorEl.textContent = 'Reason is required.';
            return;
        }

        const submitBtn = document.getElementById('audit-submit');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending…';

        const content = [
            `**Match Report**`,
            `**Match ID:** ${matchId}`,
            `**Replay:** https://tagpro.koalabeast.com/replays?uuid=${matchUuid}`,
            `**Reported by:** ${username || 'Anonymous'}`,
            `**Reason:** ${reason}`,
        ].join('\n');

        try {
            const res = await fetch(DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            overlay.remove();
        } catch (err) {
            errorEl.textContent = 'Failed to send. Try again.';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
        }
    };
}

function renderMatches(matches) {
    const container = document.getElementById('matches');
    container.innerHTML = '';
    const sorted = matches.slice().sort((a, b) => b.d - a.d);
    
    const table = document.createElement('table');
    table.id = 'matches-table';
    
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    for (const text of ['Date', 'Map', 'Players', 'Length', 'Result', 'Starting Zombie(s)', 'Last Alive', 'Links']) {
        const th = document.createElement('th');
        th.textContent = text;
        headerRow.appendChild(th);
    }
    
    const tbody = table.createTBody();
    
    for (const match of sorted) {
        const row = tbody.insertRow();
        const initialZombieSet = new Set(match.iZ);

        const survivors = [];
        const died = [];

        // Correct logic: Analyze players to find who survived to the end
        for (let i = 0; i < match.r.length; i++) {
            if (initialZombieSet.has(i)) continue;
            
            const stats = match.pl[i];
            if (!stats) continue;

            // 'ste' is the definitive flag from your backend for a win
            if (stats.ste) {
                survivors.push(match.r[i].n);
            } else if (stats.tB) {
                // Register death for non-survivors
                died.push({ name: match.r[i].n, t: stats.tB.t });
            }
        }

        // Logic: Survivors win if at least one person has the 'ste' flag
        const survivorsWon = survivors.length > 0;

        // Date
        const date = new Date(match.d * 1000);
        row.insertCell().textContent = date.toLocaleDateString('en-US', {
            month: 'numeric', day: 'numeric', year: '2-digit',
            hour: 'numeric', minute: '2-digit'
        });

        // Map
        row.insertCell().textContent = match.mN || '—';

        // Players
        row.insertCell().textContent = match.r.length;

        // Length
        row.insertCell().textContent = framesToTime(match.matchLength);

        // Result: Now correctly driven by the 'survivors' array
        const resultCell = row.insertCell();
        resultCell.textContent = survivorsWon ? 'Survivors Win' : 'Zombies Win';
        resultCell.className = survivorsWon ? 'result-survivors' : 'result-zombies';

        // Starting Zombies
        row.insertCell().textContent = match.iZ.map(i => match.r[i]?.n ?? '?').join(', ');

        // Last Alive
        const lastAliveCell = row.insertCell();
        if (survivorsWon) {
            lastAliveCell.innerHTML = survivors
                .map(n => `<span class="survivor-gold">${n}</span>`)
                .join(', ');
        } else if (died.length > 0) {
            // Sort by time of tag to find the last person standing
            died.sort((a, b) => b.t - a.t);
            lastAliveCell.textContent = died[0].name;
        } else {
            lastAliveCell.textContent = '—';
        }

        // Links + Audit
        const linksCell = row.insertCell();
        
        const replayLink = document.createElement('a');
        replayLink.href = `https://tagpro.koalabeast.com/replays?uuid=${match.u}`;
        replayLink.textContent = 'Replay';
        replayLink.target = '_blank';
        replayLink.rel = 'noopener';
        
        const euLink = document.createElement('a');
        euLink.href = `https://tagpro.eu/?match=${match.id}`;
        euLink.textContent = 'EU';
        euLink.target = '_blank';
        euLink.rel = 'noopener';
        
        const auditBtn = document.createElement('button');
        auditBtn.textContent = 'Report';
        auditBtn.onclick = () => openAuditModal(match.id, match.u);
        
        linksCell.append(replayLink, ' | ', euLink, ' | ', auditBtn);
    }
    
    container.appendChild(table);
}