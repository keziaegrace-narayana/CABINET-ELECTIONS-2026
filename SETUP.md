# Setup Instructions - Run Locally on Any Computer

This is a static website application. No installation or build process required!

## Quick Start (5 seconds)

### Option 1: Direct Browser (Easiest)
1. Download or clone this repository
2. Open `index.html` in your web browser (double-click or drag to browser)
3. Done! The app is now running

### Option 2: Using Git (Recommended for teams)

#### Windows
```bash
git clone https://github.com/keziaegrace-narayana/CABINET-ELECTIONS-2026.git
cd CABINET-ELECTIONS-2026
start index.html
```

#### macOS
```bash
git clone https://github.com/keziaegrace-narayana/CABINET-ELECTIONS-2026.git
cd CABINET-ELECTIONS-2026
open index.html
```

#### Linux
```bash
git clone https://github.com/keziaegrace-narayana/CABINET-ELECTIONS-2026.git
cd CABINET-ELECTIONS-2026
xdg-open index.html  # or use your preferred browser
```

### Option 3: Using a Local Server (Recommended for development)

#### Python 3
```bash
cd CABINET-ELECTIONS-2026
python -m http.server 8000
# Then open http://localhost:8000 in your browser
```

#### Python 2
```bash
cd CABINET-ELECTIONS-2026
python -m SimpleHTTPServer 8000
# Then open http://localhost:8000 in your browser
```

#### Node.js (if installed)
```bash
cd CABINET-ELECTIONS-2026
npx http-server
# Then open http://localhost:8080 in your browser
```

## Files in This Project

- `index.html` - Main voting page
- `admin.html` - Administrator dashboard
- `results.html` - Results display page
- `app.js` - Main voting logic
- `admin.js` - Admin functionality
- `results.js` - Results display logic
- `storage.js` - Local storage management
- `candidates-data.js` - Candidate data
- `candidates.json` - Candidate information
- `style.css` - Styling
- `site-config.js` - Configuration

## Data Storage

This application uses browser **local storage** to store voting data. Each computer maintains its own local copy of the data.

## System Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- No additional software needed

## Troubleshooting

**White screen when opening index.html?**
- Try using a local server instead (Python or Node.js option above)
- Some browsers have restrictions on local file access

**Can't find index.html?**
- Make sure you're in the correct directory: `cd CABINET-ELECTIONS-2026`
- Check that the file exists: `ls -la` (macOS/Linux) or `dir` (Windows)

**Need more help?**
- Check the `readme.md` for project details
