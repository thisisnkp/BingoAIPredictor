class WinGoPredictorPopup {
    constructor() {
        this.apiKey = '';
        this.statistics = {
            total: 0,
            wins: 0,
            accuracy: 0,
            predictions: [],
            winStreak: 0,
            maxStreak: 0
        };
        this.currentPrediction = null;
        this.autoPredictionEnabled = false;
        this.lastPeriod = null;
        this.isProcessing = false;
        
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.updateUI();
        this.startDataRefresh();
        this.setupAutoModeMonitoring();
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get([
                'openai_api_key', 
                'statistics', 
                'analysisPages', 
                'aiModel',
                'advancedAnalysis',
                'statisticalAnalysis',
                'trendAnalysis',
                'autoPrediction'
            ]);
            
            this.apiKey = result.openai_api_key || '';
            this.statistics = result.statistics || { 
                total: 0, 
                wins: 0, 
                accuracy: 0, 
                predictions: [],
                winStreak: 0,
                maxStreak: 0
            };
            this.autoPredictionEnabled = result.autoPrediction || false;
            
            if (this.apiKey) {
                document.getElementById('apiKeyInput').value = this.apiKey;
                this.showApiStatus('✅ API Key configured', 'success');
            }

            // Load enhanced analysis settings
            document.getElementById('analysisPages').value = result.analysisPages || '50';
            document.getElementById('aiModel').value = result.aiModel || 'gpt-4';
            document.getElementById('advancedAnalysis').checked = result.advancedAnalysis !== false;
            document.getElementById('statisticalAnalysis').checked = result.statisticalAnalysis !== false;
            document.getElementById('trendAnalysis').checked = result.trendAnalysis !== false;
            document.getElementById('autoPrediction').checked = this.autoPredictionEnabled;
            
            this.updateAutoPredictionUI();
            this.updateStatisticsDisplay();
            
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    setupEventListeners() {
        document.getElementById('saveApiKey').addEventListener('click', () => this.saveApiKey());
        document.getElementById('getPrediction').addEventListener('click', () => this.getPrediction());
        document.getElementById('refreshHistory').addEventListener('click', () => this.refreshHistory());
        document.getElementById('sendToOverlay').addEventListener('click', () => this.sendToOverlay());
        document.getElementById('autoPrediction').addEventListener('change', () => this.toggleAutoPrediction());
        document.getElementById('resetStats').addEventListener('click', () => this.resetStatistics());
        
        // Save enhanced analysis settings when changed
        document.getElementById('analysisPages').addEventListener('change', () => this.saveAnalysisSettings());
        document.getElementById('aiModel').addEventListener('change', () => this.saveAnalysisSettings());
        document.getElementById('advancedAnalysis').addEventListener('change', () => this.saveAnalysisSettings());
        document.getElementById('statisticalAnalysis').addEventListener('change', () => this.saveAnalysisSettings());
        document.getElementById('trendAnalysis').addEventListener('change', () => this.saveAnalysisSettings());
    }

    setupAutoModeMonitoring() {
        // Monitor for auto predictions in the background
        setInterval(() => {
            if (this.autoPredictionEnabled) {
                this.checkAutoModeStatus();
            }
        }, 5000);
    }

    async checkAutoModeStatus() {
        if (!this.autoPredictionEnabled || this.isProcessing) return;
        
        const gameData = await this.getCurrentGameData();
        if (!gameData || !gameData.currentPeriod) return;
        
        // Update AI status
        const aiStatusEl = document.getElementById('aiStatus');
        if (aiStatusEl) {
            aiStatusEl.textContent = '🤖 Auto Mode Active';
            aiStatusEl.className = 'fw-bold text-success';
        }
    }

    async toggleAutoPrediction() {
        this.autoPredictionEnabled = document.getElementById('autoPrediction').checked;
        
        await chrome.storage.local.set({
            autoPrediction: this.autoPredictionEnabled
        });
        
        // Notify background script and content script
        try {
            chrome.runtime.sendMessage({
                type: 'UPDATE_AUTO_MODE',
                enabled: this.autoPredictionEnabled
            });
            
            // Also notify content script directly
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            chrome.tabs.sendMessage(tab.id, {
                type: 'UPDATE_AUTO_MODE',
                enabled: this.autoPredictionEnabled
            });
        } catch (error) {
            console.log('Could not notify scripts:', error);
        }
        
        this.updateAutoPredictionUI();
        
        if (this.autoPredictionEnabled) {
            this.showStatus('🤖 Smart Auto Mode Activated - AI will predict automatically', 'success');
            
            const aiStatusEl = document.getElementById('aiStatus');
            if (aiStatusEl) {
                aiStatusEl.textContent = '🤖 Auto Mode Active';
                aiStatusEl.className = 'fw-bold text-success';
            }
        } else {
            this.showStatus('🔧 Manual Mode - Click to predict manually', 'info');
            
            const aiStatusEl = document.getElementById('aiStatus');
            if (aiStatusEl) {
                aiStatusEl.textContent = 'Manual Mode';
                aiStatusEl.className = 'fw-bold text-secondary';
            }
        }
    }

    updateAutoPredictionUI() {
        const label = document.querySelector('label[for="autoPrediction"]');
        const card = document.querySelector('.card.border-success');
        const autoStatus = document.getElementById('autoStatus');
        
        if (this.autoPredictionEnabled) {
            if (label) label.classList.add('auto-prediction-active');
            if (card) {
                card.classList.add('border-success');
                card.classList.remove('border-secondary');
            }
            if (autoStatus) {
                autoStatus.style.display = 'block';
                autoStatus.innerHTML = '<small class="fw-bold text-success">🟢 Auto Mode Active - Monitoring for new periods...</small>';
            }
        } else {
            if (label) label.classList.remove('auto-prediction-active');
            if (card) {
                card.classList.add('border-secondary');
                card.classList.remove('border-success');
            }
            if (autoStatus) {
                autoStatus.style.display = 'none';
            }
        }
    }

    async saveAnalysisSettings() {
        const settings = {
            analysisPages: document.getElementById('analysisPages').value,
            aiModel: document.getElementById('aiModel').value,
            advancedAnalysis: document.getElementById('advancedAnalysis').checked,
            statisticalAnalysis: document.getElementById('statisticalAnalysis').checked,
            trendAnalysis: document.getElementById('trendAnalysis').checked
        };
        
        await chrome.storage.local.set(settings);
        this.showStatus('⚙️ AI Analysis settings saved', 'success');
    }

    async saveApiKey() {
        const apiKeyInput = document.getElementById('apiKeyInput');
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            this.showApiStatus('❌ Please enter an API key', 'error');
            return;
        }
        
        if (!apiKey.startsWith('sk-')) {
            this.showApiStatus('❌ Invalid API key format (should start with sk-)', 'error');
            return;
        }

        try {
            // Test API key with a simple request
            this.showApiStatus('🔍 Testing API key...', 'info');
            
            const testResponse = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });
            
            if (!testResponse.ok) {
                this.showApiStatus('❌ Invalid API key or no access', 'error');
                return;
            }
            
            await chrome.storage.local.set({ openai_api_key: apiKey });
            this.apiKey = apiKey;
            this.showApiStatus('✅ API Key validated and saved successfully', 'success');
            
        } catch (error) {
            this.showApiStatus('❌ Error validating API key', 'error');
            console.error('API key validation error:', error);
        }
    }

    showApiStatus(message, type) {
        const statusElement = document.getElementById('apiStatus');
        const className = type === 'success' ? 'text-success' : 
                         type === 'info' ? 'text-primary' : 'text-danger';
        statusElement.innerHTML = `<small class="${className}">${message}</small>`;
        
        setTimeout(() => {
            if (type !== 'success') {
                statusElement.innerHTML = '';
            }
        }, 5000);
    }

    async getCurrentGameData() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            const result = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    // Extract current period
                    const periodElement = document.querySelector('.TimeLeft__C-id');
                    const currentPeriod = periodElement ? periodElement.textContent.trim() : null;
                    
                    // Extract time remaining
                    const timeElements = document.querySelectorAll('.TimeLeft__C-time > div');
                    let timeRemaining = '-';
                    if (timeElements.length >= 5) {
                        timeRemaining = `${timeElements[0].textContent}${timeElements[1].textContent}:${timeElements[3].textContent}${timeElements[4].textContent}`;
                    }
                    
                    // Extract comprehensive game history
                    const historyRows = document.querySelectorAll('.record-body .van-row');
                    const history = [];
                    
                    historyRows.forEach((row, index) => {
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
                            
                            history.push({
                                period: periodEl.textContent.trim(),
                                number: parseInt(numberEl.textContent.trim()),
                                size: sizeEl.textContent.trim().toLowerCase(),
                                colors: colors,
                                index: index
                            });
                        }
                    });
                    
                    return {
                        currentPeriod,
                        timeRemaining,
                        history: history
                    };
                }
            });
            
            return result[0].result;
        } catch (error) {
            console.error('Error getting game data:', error);
            return null;
        }
    }

    async getPrediction(isAuto = false) {
        if (!this.apiKey) {
            this.showStatus('❌ Please configure your OpenAI API key first', 'error');
            return;
        }

        if (this.isProcessing) {
            this.showStatus('⏳ AI is already processing a prediction...', 'warning');
            return;
        }

        const gameData = await this.getCurrentGameData();
        if (!gameData || !gameData.history.length) {
            this.showStatus('❌ Could not retrieve game data', 'error');
            return;
        }

        this.isProcessing = true;
        const predictionBtn = document.getElementById('getPrediction');
        const btnText = document.getElementById('predictionBtnText');
        const btnLoader = document.getElementById('predictionLoader');
        
        // Update UI for processing state
        predictionBtn.disabled = true;
        btnText.textContent = '🧠 AI Thinking...';
        btnLoader.style.display = 'inline-block';
        document.querySelector('.prediction-result').classList.add('prediction-loading');
        
        if (!isAuto) {
            this.showStatus('🧠 Advanced AI analyzing patterns...', 'info');
        }

        try {
            // Send prediction request to background script
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    type: 'GET_PREDICTION',
                    history: gameData.history,
                    period: gameData.currentPeriod
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else if (response.error) {
                        reject(new Error(response.error));
                    } else {
                        resolve(response);
                    }
                });
            });

            const prediction = response.prediction;
            this.currentPrediction = prediction;
            this.displayPrediction(prediction);
            
            // Update last prediction time
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            document.getElementById('lastPredictionTime').textContent = timeStr;
            
            this.showStatus(`✅ AI Prediction Complete (${prediction.confidence}% confidence)`, 'success');
            
            // Enable send to overlay button
            document.getElementById('sendToOverlay').disabled = false;
            
            // Auto-send if auto mode or explicit auto call
            if (isAuto || this.autoPredictionEnabled) {
                setTimeout(() => {
                    this.sendToOverlay();
                }, 1000);
            }
            
        } catch (error) {
            console.error('Error getting prediction:', error);
            this.showStatus('❌ AI Prediction failed: ' + error.message, 'error');
        } finally {
            this.isProcessing = false;
            predictionBtn.disabled = false;
            btnText.textContent = '🧠 Get AI Prediction';
            btnLoader.style.display = 'none';
            document.querySelector('.prediction-result').classList.remove('prediction-loading');
        }
    }

    displayPrediction(prediction) {
        const colorElement = document.getElementById('predictedColor');
        const sizeElement = document.getElementById('predictedSize');
        const numberElement = document.getElementById('predictedNumber');
        const confidenceBar = document.getElementById('confidenceBar');
        const confidenceText = document.getElementById('confidenceText');
        const reasoningSection = document.getElementById('predictionReasoning');
        const reasoningText = document.getElementById('reasoningText');

        // Display color with enhanced styling
        if (colorElement) {
            colorElement.textContent = prediction.color ? 
                prediction.color.charAt(0).toUpperCase() + prediction.color.slice(1) : '-';
            colorElement.className = `fw-bold fs-4 mt-1 ${prediction.color || ''}`;
        }

        // Display size with enhanced styling
        if (sizeElement) {
            sizeElement.textContent = prediction.size ? 
                prediction.size.charAt(0).toUpperCase() + prediction.size.slice(1) : '-';
            sizeElement.className = `fw-bold fs-4 mt-1 ${prediction.size || ''}`;
        }

        // Hide number prediction (since we're focusing on color and size only)
        if (numberElement) {
            numberElement.textContent = '-';
            numberElement.parentElement.style.display = 'none';
        }

        // Display confidence with enhanced animations
        const confidence = Math.max(60, Math.min(90, prediction.confidence || 70));
        if (confidenceText) {
            confidenceText.textContent = `${confidence}%`;
        }
        
        if (confidenceBar) {
            confidenceBar.style.width = `${confidence}%`;
            
            // Enhanced confidence color coding
            confidenceBar.classList.remove('bg-success', 'bg-warning', 'bg-danger', 'bg-info');
            if (confidence >= 85) {
                confidenceBar.classList.add('bg-success');
                document.querySelector('.prediction-result').classList.add('high-confidence');
            } else if (confidence >= 75) {
                confidenceBar.classList.add('bg-info');
                document.querySelector('.prediction-result').classList.remove('high-confidence');
            } else if (confidence >= 65) {
                confidenceBar.classList.add('bg-warning');
                document.querySelector('.prediction-result').classList.remove('high-confidence');
            } else {
                confidenceBar.classList.add('bg-danger');
                document.querySelector('.prediction-result').classList.remove('high-confidence');
            }
        }

        // Display detailed reasoning if available
        if (prediction.reasoning && reasoningSection && reasoningText) {
            reasoningText.textContent = prediction.reasoning;
            reasoningSection.style.display = 'block';
        }
    }

    async sendToOverlay() {
        if (!this.currentPrediction) {
            this.showStatus('❌ No prediction available to send', 'error');
            return;
        }

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            await chrome.tabs.sendMessage(tab.id, {
                type: 'UPDATE_PREDICTION',
                prediction: this.currentPrediction
            });
            
            this.showStatus('✅ Prediction sent to overlay successfully', 'success');
            
            // Record this prediction for statistics
            await this.recordPrediction(this.currentPrediction);
            
        } catch (error) {
            console.error('Error sending to overlay:', error);
            this.showStatus('❌ Could not send to overlay - make sure you are on the game page', 'error');
        }
    }

    async recordPrediction(prediction) {
        const gameData = await this.getCurrentGameData();
        if (!gameData) return;

        const predictionRecord = {
            period: gameData.currentPeriod,
            prediction: prediction,
            timestamp: Date.now(),
            result: null // Will be filled when result is available
        };

        this.statistics.predictions.push(predictionRecord);
        this.statistics.total++;
        
        await this.saveStatistics();
        this.updateStatisticsDisplay();
    }

    async checkPredictionResults() {
        // Check recent predictions against actual results
        const gameData = await this.getCurrentGameData();
        if (!gameData || !gameData.history.length) return;

        let updated = false;
        const recentResults = gameData.history.slice(0, 10); // Check last 10 results

        for (let prediction of this.statistics.predictions) {
            if (prediction.result !== null) continue; // Already checked

            // Find matching result
            const matchingResult = recentResults.find(result => 
                result.period === prediction.period
            );

            if (matchingResult) {
                prediction.result = matchingResult;
                
                // Check if prediction was correct (focusing on color and size only)
                const colorCorrect = matchingResult.colors.includes(prediction.prediction.color);
                const sizeCorrect = matchingResult.size === prediction.prediction.size;
                
                // Both color and size correct = win
                if (colorCorrect && sizeCorrect) {
                    this.statistics.wins++;
                    this.statistics.winStreak++;
                    updated = true;
                } else {
                    this.statistics.winStreak = 0; // Reset streak on loss
                }
                
                // Update max streak
                if (this.statistics.winStreak > this.statistics.maxStreak) {
                    this.statistics.maxStreak = this.statistics.winStreak;
                }
            }
        }

        if (updated) {
            // Calculate accuracy based on checked predictions
            const checkedPredictions = this.statistics.predictions.filter(p => p.result !== null);
            if (checkedPredictions.length > 0) {
                this.statistics.accuracy = Math.round((this.statistics.wins / checkedPredictions.length) * 100);
            }

            await this.saveStatistics();
            this.updateStatisticsDisplay();
        }
    }

    async saveStatistics() {
        await chrome.storage.local.set({
            statistics: this.statistics
        });
    }

    updateStatisticsDisplay() {
        const accuracyEl = document.getElementById('accuracy');
        const totalEl = document.getElementById('totalPredictions');
        const winsEl = document.getElementById('wins');
        const streakEl = document.getElementById('winStreak');

        if (accuracyEl) {
            accuracyEl.textContent = `${this.statistics.accuracy}%`;
            // Color code accuracy
            accuracyEl.classList.remove('text-success', 'text-warning', 'text-danger');
            if (this.statistics.accuracy >= 70) {
                accuracyEl.classList.add('text-success');
            } else if (this.statistics.accuracy >= 50) {
                accuracyEl.classList.add('text-warning');
            } else {
                accuracyEl.classList.add('text-danger');
            }
        }

        if (totalEl) totalEl.textContent = this.statistics.total.toString();
        if (winsEl) winsEl.textContent = this.statistics.wins.toString();
        if (streakEl) {
            streakEl.textContent = this.statistics.winStreak.toString();
            // Highlight good streaks
            streakEl.classList.remove('text-success', 'text-warning');
            if (this.statistics.winStreak >= 3) {
                streakEl.classList.add('text-success');
            } else if (this.statistics.winStreak >= 1) {
                streakEl.classList.add('text-warning');
            }
        }
    }

    async resetStatistics() {
        if (confirm('🗑️ Are you sure you want to reset all AI performance statistics?')) {
            this.statistics = {
                total: 0,
                wins: 0,
                accuracy: 0,
                predictions: [],
                winStreak: 0,
                maxStreak: 0
            };
            
            await this.saveStatistics();
            this.updateStatisticsDisplay();
            this.showStatus('📊 All statistics have been reset', 'success');
        }
    }

    async refreshHistory() {
        this.showStatus('🔄 Refreshing game history...', 'info');
        const gameData = await this.getCurrentGameData();
        if (gameData) {
            this.displayHistory(gameData.history);
            this.showStatus('✅ Game history refreshed', 'success');
        } else {
            this.showStatus('❌ Could not refresh history', 'error');
        }
    }

    displayHistory(history) {
        const container = document.getElementById('gameHistory');
        
        if (!history.length) {
            container.innerHTML = `
                <div class="text-center text-muted p-3">
                    <div class="spinner-border spinner-border-sm" role="status"></div>
                    <small class="d-block mt-2">No history data available</small>
                </div>
            `;
            return;
        }

        const historyHTML = history.slice(0, 12).map(item => {
            const colorDots = item.colors.map(color => 
                `<span class="color-dot ${color}" title="${color}" style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin: 0 1px; background-color: ${color === 'red' ? '#ef4444' : color === 'green' ? '#22c55e' : '#a855f7'};"></span>`
            ).join('');
            
            return `
                <div class="history-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; margin-bottom: 4px; background: rgba(0,0,0,0.05); border-radius: 6px; font-size: 12px;">
                    <div class="history-period" style="font-weight: bold; color: #666;">${item.period.slice(-6)}</div>
                    <div style="font-weight: bold; font-size: 14px; color: #2563eb;">${item.number}</div>
                    <div class="history-result" style="display: flex; align-items: center; gap: 4px;">
                        ${colorDots}
                        <span class="size-badge" style="background: ${item.size === 'big' ? '#22c55e' : '#ef4444'}; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: bold;" title="${item.size}">${item.size.toUpperCase()}</span>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = historyHTML;
    }

    updateUI() {
        // Update current game info with enhanced styling
        this.getCurrentGameData().then(gameData => {
            if (gameData) {
                const periodEl = document.getElementById('currentPeriod');
                const timeEl = document.getElementById('timeRemaining');
                
                if (periodEl) {
                    periodEl.textContent = gameData.currentPeriod || '-';
                }
                
                if (timeEl) {
                    timeEl.textContent = gameData.timeRemaining || '-';
                    
                    // Enhanced time warning system
                    timeEl.classList.remove('time-warning', 'time-critical');
                    if (gameData.timeRemaining && gameData.timeRemaining !== '-') {
                        const [minutes, seconds] = gameData.timeRemaining.split(':').map(Number);
                        const totalSeconds = minutes * 60 + seconds;
                        
                        if (totalSeconds <= 30 && totalSeconds > 10) {
                            timeEl.classList.add('time-warning');
                        } else if (totalSeconds <= 10) {
                            timeEl.classList.add('time-critical');
                        }
                    }
                }
                
                this.displayHistory(gameData.history);
                
                // Check for period changes for auto mode
                if (this.autoPredictionEnabled && gameData.currentPeriod !== this.lastPeriod) {
                    this.lastPeriod = gameData.currentPeriod;
                    if (!this.isProcessing) {
                        // Small delay to ensure history is updated
                        setTimeout(() => {
                            this.getPrediction(true);
                        }, 2000);
                    }
                }
            }
        });

        // Check for prediction results
        this.checkPredictionResults();
    }

    startDataRefresh() {
        // Refresh data every 3 seconds for better responsiveness
        setInterval(() => {
            this.updateUI();
        }, 3000);
    }

    showStatus(message, type) {
        const statusElement = document.getElementById('status');
        if (!statusElement) return;
        
        // Remove existing status classes
        statusElement.classList.remove('status-success', 'status-error', 'status-info', 'status-warning');
        
        let className = 'text-muted';
        let statusClass = '';
        
        switch(type) {
            case 'success': 
                className = 'text-success';
                statusClass = 'status-success';
                break;
            case 'error': 
                className = 'text-danger';
                statusClass = 'status-error';
                break;
            case 'info': 
                className = 'text-primary';
                statusClass = 'status-info';
                break;
            case 'warning':
                className = 'text-warning';
                statusClass = 'status-warning';
                break;
        }
        
        statusElement.classList.add(statusClass);
        statusElement.innerHTML = `<small class="${className}">${message}</small>`;
        
        // Auto-hide non-success messages after delay
        if (type !== 'success') {
            setTimeout(() => {
                if (statusElement.innerHTML.includes(message)) {
                    statusElement.innerHTML = '<small class="text-muted">🚀 Advanced AI Predictor Ready</small>';
                    statusElement.classList.remove(statusClass);
                }
            }, 8000);
        }
    }
}

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', () => {
    new WinGoPredictorPopup();
});