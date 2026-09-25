// Project Suraksha Frontend Application
(function() {
    'use strict';

    const API_BASE = '';

    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const page = this.dataset.page;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(page).classList.add('active');

            if (page === 'alerts') loadAlerts();
            if (page === 'help') loadHelp();
        });
    });

    // Search handler
    document.getElementById('search-btn').addEventListener('click', searchVillage);
    document.getElementById('village-search').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchVillage();
    });

    // Village search handler (page 2)
    document.getElementById('search-btn-v2').addEventListener('click', getVillageReport);
    document.getElementById('village-search-v2').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') getVillageReport();
    });

    async function searchVillage() {
        const name = document.getElementById('village-search').value.trim();
        if (!name) return;

        const container = document.getElementById('search-result');
        container.innerHTML = '<div class="loading"></div>';

        try {
            const res = await fetch(`${API_BASE}/report/${encodeURIComponent(name)}`);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            displayVillageReport(container, data);
        } catch (err) {
            container.innerHTML = `<div class="error-message">Village not found or error: ${err.message}</div>`;
        }
    }

    async function getVillageReport() {
        const name = document.getElementById('village-search-v2').value.trim();
        if (!name) return;

        const container = document.getElementById('village-report');
        container.innerHTML = '<div class="loading"></div>';

        try {
            const res = await fetch(`${API_BASE}/report/${encodeURIComponent(name)}`);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            displayVillageReport(container, data);
        } catch (err) {
            container.innerHTML = `<div class="error-message">Village not found or error: ${err.message}</div>`;
        }
    }

    function displayVillageReport(container, data) {
        const risk = data.composite_risk_score || 0;
        const tier = data.tier || 'Unknown';
        const zone = data.priority_zone || 'Unknown';

        let html = `
            <h3 style="margin-bottom:16px;color:var(--color-primary)">${data.village_name || 'Unknown'}</h3>
            <div style="margin-bottom:16px">
                <span class="tier-badge tier-${tier}">${tier} Risk</span>
                <span style="margin-left:12px;font-weight:600">Priority Zone: ${zone}</span>
            </div>
            <div class="risk-card">
                <div class="risk-score">
                    <div class="score" style="color:var(--color-critical)">${(risk*100).toFixed(1)}%</div>
                    <div class="label">Composite Risk</div>
                </div>
                <div class="risk-score">
                    <div class="score" style="color:var(--color-high)">${(data.flood_hazard_score||0)*100}%</div>
                    <div class="label">Flood Risk</div>
                </div>
                <div class="risk-score">
                    <div class="score" style="color:var(--color-high)">${(data.landslide_susceptibility||0)*100}%</div>
                    <div class="label">Landslide Risk</div>
                </div>
                <div class="risk-score">
                    <div class="score" style="color:var(--color-medium)">${(data.cloudburst_probability||0)*100}%</div>
                    <div class="label">Cloudburst Risk</div>
                </div>
                <div class="risk-score">
                    <div class="score" style="color:var(--color-medium)">${(data.erosion_risk||0)*100}%</div>
                    <div class="label">Erosion Risk</div>
                </div>
            </div>
        `;

        // Recommendations
        if (data.recommendations && data.recommendations.length > 0) {
            html += `<h4 style="margin-top:20px;margin-bottom:8px">Recommended Actions</h4>`;
            data.recommendations.forEach(rec => {
                html += `<div class="recommendation ${risk > 0.6 ? 'high-risk' : ''}">${rec}</div>`;
            });
        }

        // Confidence
        if (data.confidence_score) {
            html += `<div style="margin-top:16px;padding:12px;background:#f0f8ff;border-radius:8px">
                <strong>Confidence:</strong> ${(data.confidence_score*100).toFixed(0)}% - ${data.explanation || ''}
            </div>`;
        }

        // Relocation candidates
        if (data.village_code) {
            html += `<div style="margin-top:20px"><h4>Relocation Sites</h4><div id="reloc-${data.village_code}">Loading...</div></div>`;
            fetch(`${API_BASE}/relocation/candidates/${data.village_code}`)
                .then(r => r.json())
                .then(candidates => {
                    const div = document.getElementById(`reloc-${data.village_code}`);
                    if (candidates.candidates) {
                        div.innerHTML = candidates.candidates.map(c => `
                            <div class="risk-score" style="text-align:left;margin-bottom:8px">
                                <strong>${c.site_name}</strong> (Suitability: ${(c.suitability_score*100).toFixed(1)}%)
                                <span style="float:right;color:#666">${c.subdistrict}</span>
                            </div>
                        `).join('');
                    }
                });
        }

        container.innerHTML = html;
    }

    async function loadAlerts() {
        const container = document.getElementById('alerts-container');
        container.innerHTML = '<div class="loading"></div>';

        try {
            const res = await fetch(`${API_BASE}/live/alerts`);
            if (!res.ok) throw new Error('Failed to load alerts');
            const data = await res.json();

            let html = `<p style="margin-bottom:16px"><strong>Region:</strong> ${data.region || 'N/A'} | <em>${new Date(data.timestamp).toLocaleString()}</em></p>`;

            if (data.alerts && data.alerts.length > 0) {
                data.alerts.forEach(alert => {
                    html += `<div class="alert-item alert-NORMAL">
                        <strong>${alert.title || 'Alert'}</strong><br>
                        <small>${alert.pubDate || ''}</small><br>
                        ${alert.description || ''}<br>
                        <a href="${alert.link || '#'}" target="_blank">Details</a>
                    </div>`;
                });
            } else {
                html += '<p>No active alerts at this time.</p>';
            }
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<div class="error-message">Failed to load alerts: ${err.message}</div>`;
        }
    }

    async function loadHelp() {
        const container = document.getElementById('help-content');
        container.innerHTML = '<div class="loading"></div>';

        try {
            const res = await fetch(`${API_BASE}/help`);
            if (!res.ok) throw new Error('Failed to load help');
            const data = await res.json();

            let html = '<h3>Usage Examples</h3>';
            for (const [path, desc] of Object.entries(data.usage_examples)) {
                html += `<div class="recommendation"><strong>${path}</strong> - ${desc}</div>`;
            }
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<div class="error-message">Failed to load help</div>`;
        }
    }

    // Initial load - get stats
    document.addEventListener('DOMContentLoaded', async function() {
        try {
            const res = await fetch(`${API_BASE}/batch/risk_ranking`);
            if (res.ok) {
                const data = await res.json();
                const tiers = {TIER_1:0, TIER_2:0, TIER_3:0, TIER_4:0};
                data.villages.forEach(v => {
                    if (tiers[v.tier] !== undefined) tiers[v.tier]++;
                });
                document.getElementById('stat-tier-1').textContent = tiers.TIER_1;
                document.getElementById('stat-tier-2').textContent = tiers.TIER_2;
                document.getElementById('stat-tier-3').textContent = tiers.TIER_3;
                document.getElementById('stat-tier-4').textContent = tiers.TIER_4;
            }
        } catch (e) {
            console.log('Stats load failed:', e);
        }

        // Also load alerts in background
        try {
            const res = await fetch(`${API_BASE}/health`);
            if (res.ok) {
                const data = await res.json();
                document.getElementById('total-villages').textContent = data.models_loaded || 0;
            }
        } catch (e) {}
    });
})();