// Enhanced Background script for WinGo Predictor Extension
class WinGoPredictorBackground {
    constructor() {
        this.setupMessageHandlers();
        this.setupContextMenus();
        this.setupActionHandler();
        this.predictionCache = new Map();
    }

    setupMessageHandlers() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('Background received message:', request.type);
            
            switch (request.type) {
                case 'PERIOD_CHANGED':
                    this.handlePeriodChange(request, sender);
                    sendResponse({ success: true });
                    break;
                
                case 'GET_PREDICTION':
                case 'GET_AUTO_PREDICTION':
                    this.handleGetPrediction(request, sender, sendResponse);
                    return true; // Keep message channel open for async response
                
                case 'UPDATE_AUTO_MODE':
                    this.handleAutoModeUpdate(request, sender);
                    sendResponse({ success: true });
                    break;
                
                default:
                    console.log('Unknown message type:', request.type);
                    sendResponse({ error: 'Unknown message type' });
            }
        });
    }

    setupContextMenus() {
        chrome.runtime.onInstalled.addListener(() => {
            try {
                chrome.contextMenus.create({
                    id: 'wingo-predictor-toggle',
                    title: 'Toggle WinGo Predictor Overlay',
                    contexts: ['page'],
                    documentUrlPatterns: ['https://damangames5.com/*']
                });
            } catch (error) {
                console.log('Context menu creation failed:', error);
            }
        });

        chrome.contextMenus.onClicked.addListener((info, tab) => {
            if (info.menuItemId === 'wingo-predictor-toggle') {
                this.sendToContentScript(tab.id, { type: 'TOGGLE_PREDICTOR' });
            }
        });
    }

    setupActionHandler() {
        chrome.action.onClicked.addListener((tab) => {
            if (tab.url && tab.url.includes('damangames5.com')) {
                this.sendToContentScript(tab.id, { type: 'SHOW_OVERLAY' });
            } else {
                chrome.tabs.create({ url: 'https://damangames5.com' });
            }
        });
    }

    async handleAutoModeUpdate(request, sender) {
        try {
            await this.sendToContentScript(sender.tab.id, {
                type: 'UPDATE_AUTO_MODE',
                enabled: request.enabled
            });
        } catch (error) {
            console.log('Could not update content script auto mode:', error);
        }
    }

    handlePeriodChange(request, sender) {
        console.log('New period detected:', request.period);
        
        // Store the latest game state
        chrome.storage.local.set({
            currentPeriod: request.period,
            gameHistory: request.history,
            lastUpdate: Date.now()
        });

        // If auto mode is enabled, trigger prediction after delay
        if (request.autoMode) {
            setTimeout(() => {
                this.handleGetPrediction({
                    type: 'GET_AUTO_PREDICTION',
                    period: request.period,
                    history: request.history
                }, sender, () => {});
            }, 2000);
        }
    }

    async sendToContentScript(tabId, message) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, message);
            return response;
        } catch (error) {
            console.error('Error sending message to content script:', error);
            return null;
        }
    }

    async handleGetPrediction(request, sender, sendResponse) {
        console.log('Handling prediction request...');
        
        try {
            // Show thinking state in overlay
            this.sendToContentScript(sender.tab.id, { 
                type: 'SHOW_THINKING' 
            });

            // Get stored settings and API key
            const result = await chrome.storage.local.get([
                'openai_api_key', 
                'analysisPages', 
                'aiModel',
                'advancedAnalysis', 
                'statisticalAnalysis', 
                'trendAnalysis'
            ]);
            
            const apiKey = result.openai_api_key;
            
            if (!apiKey) {
                const error = 'Please configure your OpenAI API key first';
                this.sendToContentScript(sender.tab.id, {
                    type: 'PREDICTION_ERROR',
                    error: error
                });
                sendResponse({ error: error });
                return;
            }

            // Get game history - try from request first, then storage
            let history = request.history;
            if (!history || !history.length) {
                const gameData = await chrome.storage.local.get(['gameHistory']);
                history = gameData.gameHistory || [];
            }
            
            if (!history.length) {
                const error = 'No game history available for analysis';
                this.sendToContentScript(sender.tab.id, {
                    type: 'PREDICTION_ERROR',
                    error: error
                });
                sendResponse({ error: error });
                return;
            }

            console.log('Making prediction with history length:', history.length);

            const analysisOptions = {
                analysisPages: parseInt(result.analysisPages) || 50,
                aiModel: result.aiModel || 'gpt-4',
                advancedAnalysis: result.advancedAnalysis !== false,
                statisticalAnalysis: result.statisticalAnalysis !== false,
                trendAnalysis: result.trendAnalysis !== false
            };

            // Make prediction request
            const prediction = await this.makeEnhancedPredictionRequest(
                apiKey, 
                history, 
                analysisOptions
            );
            
            console.log('Prediction generated:', prediction);
            
            // Send prediction to content script overlay
            this.sendToContentScript(sender.tab.id, {
                type: 'UPDATE_PREDICTION',
                prediction: prediction
            });

            // Cache prediction
            this.predictionCache.set(request.period || 'latest', {
                prediction,
                timestamp: Date.now()
            });

            sendResponse({ prediction: prediction });
            
        } catch (error) {
            console.error('Error handling prediction request:', error);
            
            this.sendToContentScript(sender.tab.id, {
                type: 'PREDICTION_ERROR',
                error: error.message
            });
            
            sendResponse({ error: error.message });
        }
    }

    async makeEnhancedPredictionRequest(apiKey, history, options) {
        const { analysisPages, aiModel } = options;
        
        // Limit history to specified number for optimal analysis
        const limitedHistory = history.slice(0, analysisPages);
        
        // Perform comprehensive analysis
        const analysis = this.performComprehensiveAnalysis(limitedHistory);
        
        const prompt = this.buildEnhancedPredictionPrompt(limitedHistory, analysis);
        
        console.log('Making API request to OpenAI...');
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: aiModel,
                messages: [
                    {
                        role: 'system',
                        content: this.getEnhancedSystemPrompt()
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.2,
                max_tokens: 500,
                top_p: 0.9
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API request failed: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        
        console.log('AI Response:', content);
        
        try {
            const parsed = JSON.parse(content);
            return this.enhancePrediction(parsed, analysis, limitedHistory);
        } catch (parseError) {
            console.log('JSON parse failed, using fallback parsing');
            const predictions = this.extractPredictionFromText(content);
            return this.enhancePrediction(predictions, analysis, limitedHistory);
        }
    }

    getEnhancedSystemPrompt() {
        return `You are an expert AI pattern analyst for WinGo color prediction game. 

WinGo Game Rules:
- Numbers 0-9 with associated colors and sizes
- Numbers 0-4 are SMALL, Numbers 5-9 are BIG
- Color mappings: 0,5→Red+Violet; 1,3,7,9→Green; 2,4,6,8→Red
- Predict next COLOR and SIZE only (no numbers needed)

Your expertise:
- Pattern recognition in color sequences
- Statistical frequency analysis
- Trend identification and reversal detection
- Big/Small alternation patterns
- Color distribution analysis

Analyze patterns focusing on:
1. Recent color trends (last 10 results)
2. Big/Small alternation patterns
3. Color frequency distribution
4. Streak analysis and break patterns
5. Statistical probability of outcomes

Always return JSON format with color, size, confidence, and reasoning.`;
    }

    performComprehensiveAnalysis(history) {
        if (!history.length) return { summary: "No data available" };

        // Extract sequences
        const colors = history.map(h => h.colors && h.colors[0]).filter(c => c);
        const sizes = history.map(h => h.size).filter(s => s);
        const numbers = history.map(h => h.number).filter(n => n !== undefined);

        // Color frequency analysis
        const colorFreq = this.getFrequencyMap(colors);
        
        // Size frequency analysis  
        const sizeFreq = this.getFrequencyMap(sizes);
        
        // Recent patterns (last 10)
        const recentColors = colors.slice(0, 10);
        const recentSizes = sizes.slice(0, 10);
        
        // Streak analysis
        const colorStreak = this.getStreak(colors);
        const sizeStreak = this.getStreak(sizes);
        
        // Alternation analysis
        const sizeAlternation = this.analyzeSizeAlternation(recentSizes);
        
        // Color distribution balance
        const colorBalance = this.analyzeColorBalance(colorFreq, colors.length);

        return {
            colorFreq,
            sizeFreq,
            recentColors,
            recentSizes,
            colorStreak,
            sizeStreak,
            sizeAlternation,
            colorBalance,
            totalEntries: history.length
        };
    }

    buildEnhancedPredictionPrompt(history, analysis) {
        const historyText = history.slice(0, 15).map((h, index) => 
            `${index + 1}. Period: ${h.period}, Number: ${h.number}, Size: ${h.size}, Colors: ${h.colors.join(', ')}`
        ).join('\n');

        return `WINGO GAME ANALYSIS - PREDICT NEXT COLOR & SIZE

RECENT GAME HISTORY:
${historyText}

PATTERN ANALYSIS:
- Color Frequency: ${JSON.stringify(analysis.colorFreq)}
- Size Frequency: ${JSON.stringify(analysis.sizeFreq)}
- Recent Colors: ${analysis.recentColors.slice(0, 8).join(' → ')}
- Recent Sizes: ${analysis.recentSizes.slice(0, 8).join(' → ')}
- Current Color Streak: ${analysis.colorStreak.value} (${analysis.colorStreak.count} times)
- Current Size Streak: ${analysis.sizeStreak.value} (${analysis.sizeStreak.count} times)
- Size Alternation Pattern: ${JSON.stringify(analysis.sizeAlternation)}
- Color Balance: ${JSON.stringify(analysis.colorBalance)}

PREDICTION TASK:
Based on the comprehensive pattern analysis above, predict the NEXT result for:
1. COLOR (red/green/violet) - Consider frequency distribution, streaks, and recent trends
2. SIZE (big/small) - Analyze alternation patterns and streak breaks

Focus on:
- Breaking existing streaks when they become too long (3+ consecutive)
- Balancing color distribution when one color becomes overrepresented  
- Size alternation tendencies and pattern breaks
- Statistical probability based on recent frequency

Return prediction in this EXACT JSON format:
{
    "color": "red|green|violet",
    "size": "big|small", 
    "confidence": 60-90,
    "reasoning": "Detailed explanation of your prediction logic based on the analysis"
}`;
    }

    enhancePrediction(prediction, analysis, history) {
        const validatedPrediction = {
            color: this.validateColor(prediction.color) || this.getProbabilisticColor(analysis),
            size: this.validateSize(prediction.size) || this.getProbabilisticSize(analysis),
            confidence: this.calculateConfidence(prediction, analysis, history),
            reasoning: prediction.reasoning || this.generateReasoning(analysis)
        };

        return validatedPrediction;
    }

    getProbabilisticColor(analysis) {
        const { colorFreq, recentColors, colorStreak, colorBalance } = analysis;
        
        // If there's a long streak, predict the break
        if (colorStreak.count >= 3) {
            const otherColors = ['red', 'green', 'violet'].filter(c => c !== colorStreak.value);
            return otherColors[Math.floor(Math.random() * otherColors.length)];
        }
        
        // Find underrepresented color for balance
        if (colorBalance) {
            const sortedColors = Object.entries(colorBalance)
                .sort(([,a], [,b]) => a - b);
            
            if (sortedColors[0][1] < 0.25) { // If significantly underrepresented
                return sortedColors[0][0];
            }
        }
        
        // Recent trend analysis - avoid the most frequent recent color
        const recentFreq = this.getFrequencyMap(recentColors.slice(0, 5));
        const sortedRecent = Object.entries(recentFreq)
            .sort(([,a], [,b]) => b - a);
        
        if (sortedRecent.length > 0) {
            const otherColors = ['red', 'green', 'violet']
                .filter(c => c !== sortedRecent[0][0]);
            return otherColors[Math.floor(Math.random() * otherColors.length)];
        }
        
        return 'green'; // Default fallback
    }

    getProbabilisticSize(analysis) {
        const { sizeStreak, sizeAlternation } = analysis;
        
        // Break long streaks
        if (sizeStreak.count >= 3) {
            return sizeStreak.value === 'big' ? 'small' : 'big';
        }
        
        // Follow alternation pattern if strong
        if (sizeAlternation && sizeAlternation.shouldAlternate) {
            return sizeAlternation.nextSize;
        }
        
        // Default to opposite of current streak
        return sizeStreak.value === 'big' ? 'small' : 'big';
    }

    calculateConfidence(prediction, analysis, history) {
        let confidence = prediction.confidence || 70;
        
        // Adjust based on data quality
        if (history.length >= 50) confidence += 5;
        if (history.length >= 100) confidence += 5;
        
        // Adjust based on pattern strength
        if (analysis.colorStreak && analysis.colorStreak.count >= 3) confidence += 10;
        if (analysis.sizeStreak && analysis.sizeStreak.count >= 3) confidence += 10;
        
        return Math.max(60, Math.min(90, Math.round(confidence)));
    }

    generateReasoning(analysis) {
        let reasons = [];
        
        if (analysis.colorStreak && analysis.colorStreak.count >= 3) {
            reasons.push(`Breaking ${analysis.colorStreak.value} streak of ${analysis.colorStreak.count}`);
        }
        
        if (analysis.sizeStreak && analysis.sizeStreak.count >= 2) {
            reasons.push(`${analysis.sizeStreak.value} streak suggests alternation`);
        }
        
        if (analysis.colorBalance) {
            const imbalanced = Object.entries(analysis.colorBalance)
                .find(([,freq]) => freq < 0.25);
            if (imbalanced) {
                reasons.push(`${imbalanced[0]} underrepresented (${(imbalanced[1]*100).toFixed(1)}%)`);
            }
        }
        
        return reasons.length > 0 
            ? `AI Analysis: ${reasons.join(', ')}. Pattern-based prediction with statistical backing.`
            : 'Advanced pattern analysis suggests this outcome based on frequency distribution and trend analysis.';
    }

    extractPredictionFromText(text) {
        const colorMatch = text.match(/(?:color|predict).*?(red|green|violet)/i);
        const sizeMatch = text.match(/(?:size|predict).*?(big|small)/i);
        const confidenceMatch = text.match(/(?:confidence|probability).*?(\d+)/i);
        
        return {
            color: colorMatch ? colorMatch[1].toLowerCase() : null,
            size: sizeMatch ? sizeMatch[1].toLowerCase() : null,
            confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 70,
            reasoning: text.substring(0, 200)
        };
    }

    // Utility functions
    getFrequencyMap(array) {
        return array.reduce((freq, item) => {
            freq[item] = (freq[item] || 0) + 1;
            return freq;
        }, {});
    }

    getStreak(array) {
        if (!array.length) return { value: null, count: 0 };
        
        let currentValue = array[0];
        let count = 1;
        
        for (let i = 1; i < array.length; i++) {
            if (array[i] === currentValue) {
                count++;
            } else {
                break;
            }
        }
        
        return { value: currentValue, count };
    }

    analyzeSizeAlternation(recentSizes) {
        if (recentSizes.length < 3) return null;
        
        let alternations = 0;
        for (let i = 1; i < Math.min(recentSizes.length, 6); i++) {
            if (recentSizes[i] !== recentSizes[i-1]) {
                alternations++;
            }
        }
        
        const alternationRate = alternations / (Math.min(recentSizes.length, 6) - 1);
        const shouldAlternate = alternationRate > 0.6;
        const lastSize = recentSizes[0];
        
        return {
            alternationRate: alternationRate.toFixed(2),
            shouldAlternate,
            nextSize: shouldAlternate ? (lastSize === 'big' ? 'small' : 'big') : lastSize
        };
    }

    analyzeColorBalance(colorFreq, total) {
        const balance = {};
        ['red', 'green', 'violet'].forEach(color => {
            balance[color] = ((colorFreq[color] || 0) / total);
        });
        return balance;
    }

    validateColor(color) {
        const validColors = ['red', 'green', 'violet'];
        return validColors.includes(color?.toLowerCase()) ? color.toLowerCase() : null;
    }

    validateSize(size) {
        const validSizes = ['big', 'small'];
        return validSizes.includes(size?.toLowerCase()) ? size.toLowerCase() : null;
    }
}

// Initialize background script
const winGoPredictorBg = new WinGoPredictorBackground();
console.log('WinGo Predictor Background Script initialized');