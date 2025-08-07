# WinGo Color Prediction Chrome Extension

## ❤️ Support this project

If you find this project helpful, consider supporting it:

[![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://www.paypal.com/ncp/payment/DFEE788YZA9W8)

## 📋 Installation Guide

### Step 1: Download Files
Save all the following files in a new folder (e.g., `wingo-predictor-extension`):

1. `manifest.json` - Extension configuration
2. `popup.html` - Main popup interface  
3. `popup.css` - Popup styling
4. `popup.js` - Popup functionality
5. `content.js` - Content script for game monitoring
6. `content.css` - Overlay styling
7. `background.js` - Background service worker

### Step 2: Install Extension in Chrome

1. **Open Chrome Extensions Page**
   - Go to `chrome://extensions/` in your browser
   - Or click the 3-dot menu → More Tools → Extensions

2. **Enable Developer Mode**
   - Toggle "Developer mode" switch in the top-right corner

3. **Load Extension**
   - Click "Load unpacked" button
   - Select the folder containing all the extension files
   - The extension should now appear in your extensions list

4. **Pin Extension (Optional)**
   - Click the puzzle piece icon in the toolbar
   - Pin the WinGo Predictor extension for easy access

### Step 3: Setup OpenAI API Key

1. **Get OpenAI API Key**
   - Visit [OpenAI Platform](https://platform.openai.com/api-keys)
   - Create an account or log in
   - Generate a new API key
   - Copy the API key (starts with `sk-`)

2. **Configure Extension**
   - Go to the WinGo game page: https://damangames5.com/#/saasLottery/WinGo
   - Click the extension icon in the toolbar
   - Enter your OpenAI API key in the input field
   - Click "Save API Key"

### Step 4: Using the Extension

## 🎯 Features

### Main Popup Interface
- **API Key Management**: Secure storage of OpenAI API key
- **Current Game Info**: Real-time period and timer display
- **AI Predictions**: Color and size predictions with confidence levels
- **Game History**: Recent results with visual indicators
- **Statistics**: Track prediction accuracy

### Floating Overlay
- **Real-time Display**: Shows on the game page
- **Next Period**: Displays upcoming period number
- **Live Timer**: Color-coded time remaining (warning at 15s, critical at 5s)
- **Current Prediction**: Shows AI prediction directly on page
- **Minimizable**: Click the minus button to collapse

## 🎮 How It Works

### Game Rules
- **Numbers**: 0-4 are Small, 5-9 are Big
- **Colors**: 
  - 0, 5 = Red + Violet
  - 1, 3, 7, 9 = Green
  - 2, 4, 6, 8 = Red

### AI Analysis
The extension analyzes:
- Recent game history patterns
- Color sequence trends
- Size alternation patterns
- Hot/cold number analysis
- Streak patterns and reversals

### Prediction Process
1. Extension monitors game automatically
2. Collects last 20 game results
3. Sends data to OpenAI for pattern analysis
4. AI provides color, size, and confidence predictions
5. Results displayed in popup and overlay

## 🔧 Troubleshooting

### Common Issues

**Extension not working on game page:**
- Refresh the page after installing
- Make sure you're on the correct URL
- Check if extension is enabled

**API errors:**
- Verify API key is correct (starts with `sk-`)
- Check OpenAI account has credits
- Ensure internet connection is stable

**Predictions not showing:**
- Wait for game history to load (2-3 rounds)
- Click "Get Prediction" manually
- Check API key is saved correctly

**Overlay not visible:**
- Scroll to top of page
- Check if overlay is minimized (click to expand)
- Refresh page if needed

### Browser Compatibility
- **Chrome**: ✅ Fully supported
- **Edge**: ✅ Supported (Chromium-based)
- **Firefox**: ❌ Not supported (different manifest format)
- **Safari**: ❌ Not supported

## ⚠️ Important Notes

### Responsible Use
- This is for educational/entertainment purposes
- Gambling involves risk - never bet more than you can afford to lose
- AI predictions are not guaranteed to be accurate
- Past results don't guarantee future outcomes

### Privacy & Security
- API key is stored locally in your browser
- No data is sent to third parties except OpenAI
- Extension only works on the specified game website

### Performance
- Extension uses minimal resources
- Updates every 1-2 seconds when active
- Automatically pauses when not on game page

## 🔄 Updates

To update the extension:
1. Download new files
2. Replace old files in extension folder
3. Go to `chrome://extensions/`
4. Click refresh button on the extension card

## 📞 Support

If you encounter issues:
1. Check browser console for errors (F12 → Console)
2. Verify all files are in the extension folder
3. Ensure API key is valid and has credits
4. Try refreshing the game page

## 🎨 Customization

You can modify the extension by editing:
- `popup.css` - Change popup appearance
- `content.css` - Modify overlay styling  
- Prompt in `popup.js` and `background.js` - Adjust AI instructions

---

**Version**: 1.0  
**Last Updated**: August 2025  
**Compatibility**: Chrome 88+, Edge 88+