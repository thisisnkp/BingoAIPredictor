// Enhanced Content script for WinGo Color Prediction Extension
class WinGoContentScript {
    constructor() {
        this.currentPeriod = null;
        this.timeRemaining = null;
        this.gameHistory = [];
        this.predictionOverlay = null;
        this.isActive = false;
        this.currentPrediction = null;
        this.isThinking = false;
        this.autoModeEnabled = false;
        this.lastProcessedPeriod = null;
        
        this.init();
    }

    async init() {
        // Check if we're on the correct page
        if (this.isWinGoPage()) {
            this.isActive = true;
            this.createPredictionOverlay();
            this.setupMessageListener();
            this.startMonitoring();
            await this.checkAutoMode();
            console.log('WinGo Predictor: Extension activated');
        }
    }

    isWinGoPage() {
        return window.location.href.includes('damangames5.com') && 
               (window.location.href.includes('WinGo') || 
                document.querySelector('.TimeLeft__C-id'));
    }

    async checkAutoMode() {
        try {
            const result = await chrome.storage.local.get(['autoPrediction']);
            this.autoModeEnabled = result.autoPrediction || false;
            this.updateOverlayAutoStatus();
        } catch (error) {
            console.log('Could not check auto mode:', error);
        }
    }

    createPredictionOverlay() {
        // Remove existing overlay if present
        const existing = document.getElementById('wingo-predictor-overlay');
        if (existing) {
            existing.remove();
        }

        // Create enhanced floating prediction display
        this.predictionOverlay = document.createElement('div');
        this.predictionOverlay.id = 'wingo-predictor-overlay';
        this.predictionOverlay.innerHTML = `
            <style>
                #wingo-predictor-overlay {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                }
                
                .predictor-container {
                    width: 280px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 12px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    color: white;
                    overflow: hidden;
                    transition: all 0.3s ease;
                }
                
                .predictor-container.minimized .card-body {
                    display: none;
                }
                
                .predictor-header {
                    background: rgba(255,255,255,0.1);
                    padding: 12px 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: move;
                    backdrop-filter: blur(10px);
                }
                
                .header-title {
                    font-weight: bold;
                    font-size: 14px;
                }
                
                .auto-mode-indicator {
                    font-size: 10px;
                    opacity: 0.8;
                    color: #4ade80;
                    margin-top: 2px;
                }
                
                .header-controls button {
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    margin-left: 6px;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                
                .header-controls button:hover {
                    background: rgba(255,255,255,0.3);
                }
                
                .card-body {
                    padding: 16px;
                }
                
                .prediction-status {
                    text-align: center;
                    margin-bottom: 12px;
                    font-size: 12px;
                    opacity: 0.9;
                }
                
                .prediction-details {
                    margin-bottom: 16px;
                }
                
                .prediction-row {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 12px;
                }
                
                .prediction-card {
                    flex: 1;
                    background: rgba(255,255,255,0.15);
                    border-radius: 8px;
                    padding: 12px 8px;
                    text-align: center;
                    backdrop-filter: blur(10px);
                }
                
                .prediction-card-label {
                    font-size: 10px;
                    opacity: 0.8;
                    margin-bottom: 4px;
                    font-weight: bold;
                }
                
                .prediction-card-value {
                    font-size: 16px;
                    font-weight: bold;
                    text-transform: capitalize;
                }
                
                .prediction-card-value.red {
                    color: #ff6b6b;
                }
                
                .prediction-card-value.green {
                    color: #4ade80;
                }
                
                .prediction-card-value.violet {
                    color: #a855f7;
                }
                
                .confidence-section {
                    margin-bottom: 12px;
                }
                
                .confidence-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 6px;
                    font-size: 10px;
                    font-weight: bold;
                }
                
                .progress {
                    height: 6px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 3px;
                    overflow: hidden;
                }
                
                .progress-bar {
                    height: 100%;
                    background: linear-gradient(90deg, #4ade80, #22c55e);
                    transition: width 0.5s ease;
                    border-radius: 3px;
                }
                
                .progress-bar.warning {
                    background: linear-gradient(90deg, #fbbf24, #f59e0b);
                }
                
                .progress-bar.danger {
                    background: linear-gradient(90deg, #ef4444, #dc2626);
                }
                
                .reasoning-section {
                    background: rgba(255,255,255,0.1);
                    border-radius: 6px;
                    padding: 8px;
                    margin-top: 8px;
                }
                
                .reasoning-text {
                    font-size: 10px;
                    line-height: 1.3;
                    opacity: 0.9;
                    max-height: 60px;
                    overflow-y: auto;
                }
                
                .game-info {
                    border-top: 1px solid rgba(255,255,255,0.2);
                    padding-top: 12px;
                }
                
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 6px;
                    font-size: 11px;
                }
                
                .info-label {
                    opacity: 0.8;
                    font-weight: bold;
                }
                
                .info-value {
                    font-weight: bold;
                }
                
                .time-display.warning {
                    color: #fbbf24;
                }
                
                .time-display.critical {
                    color: #ef4444;
                    animation: pulse 1s infinite;
                }
                
                .loading-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.8);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    border-radius: 12px;
                }
                
                .loading-spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid rgba(255,255,255,0.3);
                    border-top: 3px solid #4ade80;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 12px;
                }
                
                .thinking-animation {
                    font-size: 12px;
                    color: #4ade80;
                    animation: thinking 1.5s ease-in-out infinite;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                
                @keyframes thinking {
                    0%, 100% { opacity: 0.7; }
                    50% { opacity: 1; }
                }
                
                .predictor-container.dragging {
                    transform: scale(1.02);
                    box-shadow: 0 15px 40px rgba(0,0,0,0.4);
                }
                
                .prediction-details.high-confidence {
                    animation: glow 2s ease-in-out infinite alternate;
                }
                
                @keyframes glow {
                    from { box-shadow: 0 0 5px rgba(74, 222, 128, 0.3); }
                    to { box-shadow: 0 0 15px rgba(74, 222, 128, 0.6); }
                }
            </style>
            <div class="predictor-container" id="predictorContainer">
                <div class="predictor-header">
                    <div class="header-title">
                        <div>🎯 AI Predictor</div>
                        <div id="autoModeIndicator" class="auto-mode-indicator" style="display: none;">
                            🤖 AUTO MODE
                        </div>
                    </div>
                    <div class="header-controls">
                        <button class="minimize-btn" onclick="this.closest('.predictor-container').classList.toggle('minimized')">−</button>
                        <button class="close-btn" onclick="this.closest('#wingo-predictor-overlay').style.display='none'">×</button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="prediction-status" id="predictionStatus">
                        🚀 AI Ready
                    </div>
                    
                    <div class="prediction-details" id="predictionDetails" style="display: none;">
                        <div class="prediction-row">
                            <div class="prediction-card">
                                <div class="prediction-card-label">COLOR</div>
                                <div id="overlay-prediction" class="prediction-card-value">-</div>
                            </div>
                            <div class="prediction-card">
                                <div class="prediction-card-label">SIZE</div>
                                <div id="overlay-size" class="prediction-card-value">-</div>
                            </div>
                        </div>
                        
                        <div class="confidence-section">
                            <div class="confidence-header">
                                <span>AI CONFIDENCE</span>
                                <span id="overlay-confidence">0%</span>
                            </div>
                            <div class="progress">
                                <div id="overlay-confidence-bar" class="progress-bar" style="width: 0%"></div>
                            </div>
                        </div>
                        
                        <div id="overlay-reasoning" class="reasoning-section" style="display: none;">
                            <div class="prediction-card-label">AI ANALYSIS</div>
                            <div id="overlay-reasoning-text" class="reasoning-text"></div>
                        </div>
                    </div>
                    
                    <div class="game-info">
                        <div class="info-row">
                            <span class="info-label">PERIOD</span>
                            <span id="overlay-period" class="info-value">-</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">TIME LEFT</span>
                            <span id="overlay-time" class="info-value time-display">-</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">STATUS</span>
                            <span id="overlay-status" class="info-value">Ready</span>
                        </div>
                    </div>
                </div>
                
                <div class="loading-overlay" id="loadingOverlay" style="display: none;">
                    <div class="loading-spinner"></div>
                    <div class="thinking-animation">AI Thinking...</div>
                </div>
            </div>
        `;
        
        // Make overlay draggable
        this.makeDraggable();
        
        document.body.appendChild(this.predictionOverlay);
        
        // Load saved position
        this.loadOverlayPosition();
    }

    makeDraggable() {
        let isDragging = false;
        let currentX = 0;
        let currentY = 0;
        let initialX = 0;
        let initialY = 0;
        let xOffset = 0;
        let yOffset = 0;

        const container = this.predictionOverlay.querySelector('.predictor-container');
        const header = this.predictionOverlay.querySelector('.predictor-header');

        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);

        const self = this;

        function dragStart(e) {
            if (e.target.classList.contains('minimize-btn') || 
                e.target.classList.contains('close-btn')) {
                return;
            }

            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            isDragging = true;
            
            container.classList.add('dragging');
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                xOffset = currentX;
                yOffset = currentY;

                container.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            }
        }

        function dragEnd() {
            if (isDragging) {
                isDragging = false;
                container.classList.remove('dragging');
                
                // Save position
                if (chrome.storage && chrome.storage.local) {
                    chrome.storage.local.set({
                        overlayPosition: { x: currentX, y: currentY }
                    });
                }
            }
        }
    }

    async loadOverlayPosition() {
        try {
            const result = await chrome.storage.local.get(['overlayPosition']);
            if (result.overlayPosition) {
                const container = this.predictionOverlay.querySelector('.predictor-container');
                container.style.transform = `translate3d(${result.overlayPosition.x}px, ${result.overlayPosition.y}px, 0)`;
            }
        } catch (error) {
            console.log('Could not load overlay position:', error);
        }
    }

    updateOverlayAutoStatus() {
        const indicator = this.predictionOverlay?.querySelector('#autoModeIndicator');
        if (indicator) {
            indicator.style.display = this.autoModeEnabled ? 'block' : 'none';
        }
    }

    startMonitoring() {
        // Monitor game state every second
        setInterval(() => {
            this.updateGameState();
        }, 1000);

        // Monitor for new periods using DOM observation
        this.observePeriodChanges();
    }

    updateGameState() {
        if (!this.isActive || !this.predictionOverlay) return;

        // Get current period
        const periodElement = document.querySelector('.TimeLeft__C-id');
        const newPeriod = periodElement ? periodElement.textContent.trim() : null;

        // Get time remaining
        const timeElements = document.querySelectorAll('.TimeLeft__C-time > div');
        let timeRemaining = '-';
        if (timeElements.length >= 5) {
            timeRemaining = `${timeElements[0].textContent}${timeElements[1].textContent}:${timeElements[3].textContent}${timeElements[4].textContent}`;
        }

        // Update overlay
        this.updateOverlayDisplay(newPeriod, timeRemaining);

        // Check for period change
        if (newPeriod && newPeriod !== this.currentPeriod) {
            this.currentPeriod = newPeriod;
            this.onPeriodChange();
        }

        this.timeRemaining = timeRemaining;
    }

    updateOverlayDisplay(period, time) {
        const periodDisplay = this.predictionOverlay.querySelector('#overlay-period');
        const timeDisplay = this.predictionOverlay.querySelector('#overlay-time');
        
        if (periodDisplay) {
            periodDisplay.textContent = period || '-';
        }

        if (timeDisplay) {
            timeDisplay.textContent = time;
            
            // Add warning styling for low time
            timeDisplay.classList.remove('warning', 'critical');
            
            if (time !== '-') {
                const [minutes, seconds] = time.split(':').map(Number);
                const totalSeconds = minutes * 60 + seconds;
                
                if (totalSeconds <= 30 && totalSeconds > 10) {
                    timeDisplay.classList.add('warning');
                } else if (totalSeconds <= 10) {
                    timeDisplay.classList.add('critical');
                }
            }
        }
    }

    observePeriodChanges() {
        const periodElement = document.querySelector('.TimeLeft__C-id');
        if (periodElement) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList' || mutation.type === 'characterData') {
                        const newPeriod = periodElement.textContent.trim();
                        if (newPeriod && newPeriod !== this.currentPeriod && newPeriod !== this.lastProcessedPeriod) {
                            this.currentPeriod = newPeriod;
                            this.lastProcessedPeriod = newPeriod;
                            this.onPeriodChange();
                        }
                    }
                });
            });

            observer.observe(periodElement, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }
    }

    onPeriodChange() {
        console.log('Period changed to:', this.currentPeriod);
        
        // Clear current prediction when period changes
        this.currentPrediction = null;
        this.updatePredictionStatus('🔄 New period detected', 'info');
        
        // Update game history
        setTimeout(() => {
            this.updateGameHistory();
        }, 1500);

        // Auto prediction if enabled
        if (this.autoModeEnabled && !this.isThinking) {
            setTimeout(() => {
                this.triggerAutoPrediction();
            }, 2500);
        }

        // Send message to background script
        this.notifyPeriodChange();
    }

    updateGameHistory() {
        const historyRows = document.querySelectorAll('.record-body .van-row');
        const newHistory = [];
        
        historyRows.forEach(row => {
            const periodEl = row.querySelector('.van-col--10');
            const numberEl = row.querySelector('.record-body-num');
            const sizeEl = row.querySelector('.van-col--5 span');
            const colorEls = row.querySelectorAll('.record-origin-I');
            
            if (periodEl && numberEl && sizeEl) {
                const colors = [];
                colorEls.forEach(colorEl => {
                    if (colorEl.classList.contains('red')) colors.push('red');
                    if (colorEl.classList.contains('green')) colors.push('green');
                    if (colorEl.classList.contains('violet')) colors.push('violet');
                });
                
                newHistory.push({
                    period: periodEl.textContent.trim(),
                    number: parseInt(numberEl.textContent.trim()),
                    size: sizeEl.textContent.trim().toLowerCase(),
                    colors: colors
                });
            }
        });
        
        this.gameHistory = newHistory;
        console.log('Updated game history:', newHistory.length, 'entries');
    }

    async triggerAutoPrediction() {
        if (!this.autoModeEnabled || this.isThinking) return;
        
        this.updatePredictionStatus('🤖 Auto prediction starting...', 'thinking');
        this.showThinking(true);
        
        // Send message to background to get prediction
        try {
            console.log('Triggering auto prediction for period:', this.currentPeriod);
            const response = await this.sendMessageToBackground({
                type: 'GET_AUTO_PREDICTION',
                period: this.currentPeriod,
                history: this.gameHistory
            });
            
            if (response && response.error) {
                throw new Error(response.error);
            }
            
        } catch (error) {
            console.log('Auto prediction failed:', error);
            this.updatePredictionStatus('❌ Auto prediction failed', 'error');
            this.showThinking(false);
        }
    }

    async sendMessageToBackground(message) {
        return new Promise((resolve, reject) => {
            try {
                chrome.runtime.sendMessage(message, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    notifyPeriodChange() {
        try {
            chrome.runtime.sendMessage({
                type: 'PERIOD_CHANGED',
                period: this.currentPeriod,
                history: this.gameHistory,
                autoMode: this.autoModeEnabled
            });
        } catch (error) {
            console.log('Could not send message to background:', error);
        }
    }

    showThinking(show) {
        const loadingOverlay = this.predictionOverlay?.querySelector('#loadingOverlay');
        const predictionDetails = this.predictionOverlay?.querySelector('#predictionDetails');
        const predictionStatus = this.predictionOverlay?.querySelector('#predictionStatus');
        
        if (loadingOverlay) {
            loadingOverlay.style.display = show ? 'flex' : 'none';
        }
        
        if (show) {
            if (predictionDetails) predictionDetails.style.display = 'none';
            if (predictionStatus) predictionStatus.style.display = 'none';
        }
        
        this.isThinking = show;
    }

    updatePredictionOverlay(prediction) {
        if (!this.predictionOverlay || !prediction) return;

        console.log('Updating overlay with prediction:', prediction);
        
        this.currentPrediction = prediction;
        this.showThinking(false);
        
        const predictionDetails = this.predictionOverlay.querySelector('#predictionDetails');
        const predictionStatus = this.predictionOverlay.querySelector('#predictionStatus');
        
        const colorEl = this.predictionOverlay.querySelector('#overlay-prediction');
        const sizeEl = this.predictionOverlay.querySelector('#overlay-size');
        const confidenceEl = this.predictionOverlay.querySelector('#overlay-confidence');
        const confidenceBar = this.predictionOverlay.querySelector('#overlay-confidence-bar');
        const reasoningSection = this.predictionOverlay.querySelector('#overlay-reasoning');
        const reasoningText = this.predictionOverlay.querySelector('#overlay-reasoning-text');

        if (colorEl && sizeEl && confidenceEl) {
            // Update color prediction
            const colorText = prediction.color ? 
                prediction.color.charAt(0).toUpperCase() + prediction.color.slice(1) : '-';
            colorEl.textContent = colorText;
            colorEl.className = `prediction-card-value ${prediction.color || ''}`;

            // Update size prediction
            const sizeText = prediction.size ? 
                prediction.size.charAt(0).toUpperCase() + prediction.size.slice(1) : '-';
            sizeEl.textContent = sizeText;
            
            // Update confidence
            const confidence = prediction.confidence || 0;
            confidenceEl.textContent = `${confidence}%`;
            confidenceBar.style.width = `${confidence}%`;
            
            // Color confidence bar based on level
            confidenceBar.classList.remove('warning', 'danger');
            if (confidence >= 75) {
                predictionDetails.classList.add('high-confidence');
            } else {
                predictionDetails.classList.remove('high-confidence');
                if (confidence < 70) {
                    confidenceBar.classList.add('warning');
                }
                if (confidence < 60) {
                    confidenceBar.classList.add('danger');
                }
            }
            
            // Update reasoning if available
            if (prediction.reasoning && reasoningSection && reasoningText) {
                reasoningText.textContent = prediction.reasoning;
                reasoningSection.style.display = 'block';
            }
            
            // Show prediction details
            predictionDetails.style.display = 'block';
            predictionStatus.style.display = 'none';
            
            // Update status
            this.updateOverlayStatus(`✅ Prediction ready (${confidence}% confidence)`);
        }
    }
    
    updatePredictionStatus(message, type = 'info') {
        if (!this.predictionOverlay) return;
        
        const predictionDetails = this.predictionOverlay.querySelector('#predictionDetails');
        const predictionStatus = this.predictionOverlay.querySelector('#predictionStatus');
        
        if (predictionStatus) {
            predictionStatus.textContent = message;
        }
        
        if (type === 'thinking') {
            predictionStatus.style.display = 'block';
            predictionDetails.style.display = 'none';
        } else if (type !== 'thinking' && !this.currentPrediction) {
            predictionStatus.style.display = 'block';
            predictionDetails.style.display = 'none';
        }
    }

    updateOverlayStatus(message) {
        const statusEl = this.predictionOverlay?.querySelector('#overlay-status');
        if (statusEl) {
            statusEl.textContent = message;
        }
    }

    // Listen for messages from popup and background
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('Content script received message:', request.type);
            
            switch (request.type) {
                case 'UPDATE_PREDICTION':
                    this.updatePredictionOverlay(request.prediction);
                    sendResponse({ success: true });
                    break;
                    
                case 'GET_GAME_STATE':
                    sendResponse({
                        period: this.currentPeriod,
                        timeRemaining: this.timeRemaining,
                        history: this.gameHistory
                    });
                    break;
                    
                case 'TOGGLE_PREDICTOR':
                    this.toggleOverlay();
                    sendResponse({ success: true });
                    break;
                    
                case 'SHOW_OVERLAY':
                    if (this.predictionOverlay) {
                        this.predictionOverlay.style.display = 'block';
                    }
                    sendResponse({ success: true });
                    break;
                    
                case 'HIDE_OVERLAY':
                    if (this.predictionOverlay) {
                        this.predictionOverlay.style.display = 'none';
                    }
                    sendResponse({ success: true });
                    break;

                case 'UPDATE_AUTO_MODE':
                    this.autoModeEnabled = request.enabled;
                    this.updateOverlayAutoStatus();
                    this.updateOverlayStatus(
                        this.autoModeEnabled ? '🤖 Auto mode enabled' : '🔧 Manual mode'
                    );
                    sendResponse({ success: true });
                    break;

                case 'SHOW_THINKING':
                    this.updatePredictionStatus('🧠 AI analyzing patterns...', 'thinking');
                    this.showThinking(true);
                    sendResponse({ success: true });
                    break;

                case 'PREDICTION_ERROR':
                    this.showThinking(false);
                    this.updatePredictionStatus(`❌ ${request.error}`, 'error');
                    sendResponse({ success: true });
                    break;
                    
                default:
                    sendResponse({ error: 'Unknown message type' });
            }
        });
    }
    
    toggleOverlay() {
        if (this.predictionOverlay) {
            const isHidden = this.predictionOverlay.style.display === 'none';
            this.predictionOverlay.style.display = isHidden ? 'block' : 'none';
        }
    }
}

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new WinGoContentScript();
    });
} else {
    new WinGoContentScript();
}