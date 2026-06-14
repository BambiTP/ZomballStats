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

function makePlayerLink(name, fromView) {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.style.cssText = 'background:none;border:none;cursor:pointer;padding:0;text-decoration:underline;font-size:inherit;';
    btn.onclick = () => Player.showPlayer(name, fromView || 'matches');
    return btn;
}

function renderMatches(matches, targetId = 'matches') {
    const container = document.getElementById(targetId);
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

        // Collect survivors (by index) and died list
        const survivorIndexes = [];
        const died = [];

        for (let i = 0; i < match.r.length; i++) {
            if (initialZombieSet.has(i)) continue;
            const stats = match.pl[i];
            if (!stats) continue;
            if (stats.ste) {
                survivorIndexes.push(i);
            } else if (stats.tB) {
                died.push({ index: i, name: match.r[i].n, t: stats.tB.t });
            }
        }

        const survivorsWon = survivorIndexes.length > 0;

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

        // Result
        const resultCell = row.insertCell();
        resultCell.textContent = survivorsWon ? 'Survivors Win' : 'Zombies Win';
        resultCell.className = survivorsWon ? 'result-survivors' : 'result-zombies';

        // Starting Zombies — auth players are clickable
        const szCell = row.insertCell();
        match.iZ.forEach((i, idx) => {
            const r = match.r[i];
            if (!r) {
                szCell.appendChild(document.createTextNode('?'));
            } else if (r.a === 1) {
                szCell.appendChild(makePlayerLink(r.n, 'matches'));
            } else {
                szCell.appendChild(document.createTextNode(r.n));
            }
            if (idx < match.iZ.length - 1) szCell.appendChild(document.createTextNode(', '));
        });

        // Last Alive — auth players are clickable
        const lastAliveCell = row.insertCell();
        if (survivorsWon) {
            survivorIndexes.forEach((i, idx) => {
                const r = match.r[i];
                const span = document.createElement('span');
                span.className = 'survivor-gold';
                if (r && r.a === 1) {
                    const btn = makePlayerLink(r.n, 'matches');
                    btn.style.color = 'goldenrod';
                    btn.style.fontWeight = 'bold';
                    span.appendChild(btn);
                } else {
                    span.textContent = r ? r.n : '?';
                }
                lastAliveCell.appendChild(span);
                if (idx < survivorIndexes.length - 1) {
                    lastAliveCell.appendChild(document.createTextNode(', '));
                }
            });
        } else if (died.length > 0) {
            died.sort((a, b) => b.t - a.t);
            const last = died[0];
            const r = match.r[last.index];
            if (r && r.a === 1) {
                lastAliveCell.appendChild(makePlayerLink(r.n, 'matches'));
            } else {
                lastAliveCell.textContent = last.name;
            }
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
