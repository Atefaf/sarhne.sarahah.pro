# Educational Sarhne Clone

This is an educational project created for a cybersecurity class. It represents an anonymous confession web application (similar to Sarhne) with two core vulnerabilities / privacy invasions built-in for demonstration:

1. **Browser Fingerprinting**: Uses FingerprintJS to silently collect visitor information including Canvas Fingerprint, IP, User Agent, Timezone, and Screen Info.
2. **Cross-Site Scripting (XSS)**: The dashboard intentionally displays raw HTML allowing Stored XSS demonstrations. A secure version is also provided for comparison.

## Running Instructions

1. **Prerequisites**: Ensure you have Python installed.
2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Run the Flask application**:
   ```bash
   python app.py
   ```
4. **Access the Application**:
   - Open your browser to `http://127.0.0.1:5000`
   - Register a new account.
   - Go to your dashboard to get your shareable profile link (`/u/<username>`).
   
## Testing the Application

### 1. Browser Fingerprinting
- Go to your shareable link on a different browser, incognito window, or device.
- Send a message.
- You will see that you've collected the backend IP/User-Agent, alongside the Javascript-gathered Visitor ID, Timezone, Screen Info, and **Canvas Fingerprint**.
- **Canvas Fingerprinting** provides an extremely robust string of data that identifies subtle hardware/software differences in how browsers render text/graphics.

### 2. Stored XSS
- Submit the following generic XSS payload as a message:
  ```html
  <script>alert('You have been hacked!');</script>
  ```
- Or a more advanced payload to steal a session cookie (although Flask uses HttpOnly by default for session cookies unless changed):
  ```html
  <img src="x" onerror="alert(document.cookie)">
  ```
- Go back to the dashboard and load the page.
- You will see the script executing in the "VULNERABLE (XSS)" box because the input is rendered as `| safe` HTML, bypassing Jinja's automatic escaping.
- The "SECURE (Escaped)" box demonstrates how web apps safely handle untrusted user input by escaping HTML syntax into inert text.

---

> **WARNING**: DO NOT use this code in a production environment. It is intentionally vulnerable.
