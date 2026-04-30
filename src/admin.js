import { supabase } from './supabase.js';

async function fetchVisitors() {
    const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching visitors:", error);
        return [];
    }
    return data;
}

function renderStats(visitors) {
    document.getElementById('totalLogs').innerText = visitors.length;
    document.getElementById('zeroClickVisits').innerText = visitors.filter(v => v.action_type === 'PAGE_VISIT').length;
    document.getElementById('messagesSent').innerText = visitors.filter(v => v.action_type === 'MESSAGE_SENT').length;
}

function renderVisitors(visitors) {
    const container = document.getElementById('visitorsContainer');
    if (!visitors.length) {
        container.innerHTML = '<div class="card" style="text-align:center; border-left-color: #ffa502;">No visitors yet. Share your link!</div>';
        return;
    }

    container.innerHTML = visitors.map(v => `
        <div class="card ${v.action_type === 'PAGE_VISIT' ? 'visit' : 'msg'}">
            <div class="card-header">
                <div>
                    <span class="badge ${v.action_type === 'PAGE_VISIT' ? 'visit' : 'msg'}">
                        ${v.action_type}
                    </span>
                    <span style="color:#999; font-size:12px; margin-left:10px;">#${v.id} — ${new Date(v.created_at).toLocaleString()}</span>
                </div>
                <span style="font-size:12px;">from <b style="color:#ffa502;">${v.ip_address}</b></span>
            </div>

            ${v.action_type === 'MESSAGE_SENT' && v.message ? `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                <div>
                    <div class="msg-label vuln">⚠️ VULNERABLE (Raw XSS)</div>
                    <div class="msg-display vuln">${v.message}</div>
                </div>
                <div>
                    <div class="msg-label safe">✅ SECURE (Escaped)</div>
                    <div class="msg-display safe">${escapeHTML(v.message)}</div>
                </div>
            </div>
            ` : ''}

            <div class="section-title">📍 Location & Network</div>
            <div class="grid">
                <div class="item geo"><span class="key">Country</span><span class="val">${v.ip_country}</span></div>
                <div class="item geo"><span class="key">City</span><span class="val">${v.ip_city}</span></div>
                <div class="item geo"><span class="key">ISP / Provider</span><span class="val">${v.ip_isp}</span></div>
                <div class="item geo"><span class="key">Latitude</span><span class="val">${v.ip_lat}</span></div>
                <div class="item geo"><span class="key">Longitude</span><span class="val">${v.ip_lon}</span></div>
                <div class="item highlight" style="border-color: #f1c40f;"><span class="key" style="color: #f1c40f;">Local Network IP</span><span class="val">${v.local_ip}</span></div>
                <div class="item" style="grid-column: span 2; background: #c0392b; border: 1px solid #e74c3c;">
                    <span class="key" style="color: #ffdcb5;">Exact Address</span>
                    <span class="val" style="color: white; font-weight: bold; font-size: 14px;">${v.exact_address}</span>
                </div>
                <div class="item" style="background: #e67e22; border: 1px solid #d35400;">
                    <span class="key" style="color: #fff3e0;">GPS Accuracy</span>
                    <span class="val" style="color: white; font-weight: bold;">${v.gps_accuracy}</span>
                </div>
            </div>

            <div class="section-title">🖥️ Device & System</div>
            <div class="grid">
                <div class="item highlight"><span class="key">Browser</span><span class="val">${v.browser_name}</span></div>
                <div class="item highlight"><span class="key">Operating System</span><span class="val">${v.os_name}</span></div>
                <div class="item highlight"><span class="key">Device Type</span><span class="val">${v.device_type}</span></div>
                <div class="item"><span class="key">Resolution</span><span class="val">${v.screen_resolution}</span></div>
                <div class="item"><span class="key">Timezone</span><span class="val">${v.timezone_offset}</span></div>
                <div class="item highlight" style="border-color: #9b59b6;"><span class="key" style="color: #9b59b6;">GPU</span><span class="val">${v.gpu_renderer}</span></div>
            </div>

            <div class="section-title">🔑 Unique Fingerprints</div>
            <div class="grid">
                <div class="item highlight"><span class="key">Canvas Hash</span><span class="val">${v.canvas_hash}</span></div>
                <div class="item"><span class="key">User Agent</span><span class="val" style="font-size: 10px;">${v.user_agent}</span></div>
            </div>
        </div>
    `).join('');
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function initAdmin() {
    const password = prompt("Enter Admin Password:");
    if (password !== "admin123") {
        alert("Access Denied");
        window.location.href = "/";
        return;
    }

    const visitors = await fetchVisitors();
    renderStats(visitors);
    renderVisitors(visitors);
}

initAdmin();
