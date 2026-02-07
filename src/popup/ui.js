/**
 * VoiceReplica - UI Controller
 * Manages user interface, application state, and user interactions
 * 
 * @module ui
 * @description Pure UI controller with no speech recognition logic
 * @version 1.0.0
 */

const BACKEND_BASE_URL = "http://localhost:3000/api";
(function() {
  'use strict';

  // ============================================================================
  // DOM Element References
  // ============================================================================
  const elements = {
    // Control buttons
    micButton: document.getElementById('micButton'),
    clearButton: document.getElementById('clearButton'),
    
    // Status display
    statusText: document.getElementById('statusText'),
    statusDot: null, // Will be selected dynamically
    
    // Content areas
    transcriptArea: document.getElementById('transcriptArea'),
    responseArea: document.getElementById('responseArea'),
    
    // Labels
    micLabel: null // Will be selected dynamically
  };

  // ============================================================================
  // Application State
  // ============================================================================

  const state = {
    isListening: false,
    currentTranscript: '',
    finalTranscript: '',
    currentResponse: '',
    hasError: false,
    sessionStartTime: null
  };

  // ============================================================================
  // Configuration
  // ============================================================================

  const config = {
    // Mock backend response delay (ms)
    responseDelay: 1500,
    
    // Auto-clear response delay after showing (ms) - 0 to disable
    autoClearDelay: 0,
    
    // Status messages
    statusMessages: {
      ready: 'Ready',
      listening: 'Listening...',
      processing: 'Processing...',
      responding: 'Responding...',
      error: 'Error occurred'
    },
    
    // Placeholder texts
    placeholders: {
      transcript: 'Your voice transcript will appear here...',
      response: 'AI response will appear here...'
    }
  };

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize the UI controller
   * Sets up event listeners and initial state
   */
  const initialize = () => {
    try {
      // Get additional DOM elements
      elements.statusDot = document.querySelector('.status-dot');
      elements.micLabel = document.querySelector('.mic-label');
      
      // Verify VoiceEngine is available
      if (typeof VoiceEngine === 'undefined') {
        showError({
          type: 'initialization-failed',
          message: 'VoiceEngine is not available. Please check voiceEngine.js is loaded.',
          fatal: true
        });
        return;
      }
      
      // Bind event listeners
      bindEventListeners();
      
      // Initialize VoiceEngine event handlers
      initializeVoiceEngine();
      
      // Set initial UI state
      setUIState('ready');
      
      console.log('VoiceReplica UI initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize UI:', error);
      showError({
        type: 'initialization-failed',
        message: 'Failed to initialize UI: ' + error.message,
        fatal: true
      });
    }
  };

  /**
   * Bind all UI event listeners
   */
  const bindEventListeners = () => {
    // Microphone button - toggle listening
    if (elements.micButton) {
      elements.micButton.addEventListener('click', handleMicButtonClick);
    }
    
    // Clear button - reset all content
    if (elements.clearButton) {
      elements.clearButton.addEventListener('click', handleClearButtonClick);
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
  };

  /**
   * Initialize VoiceEngine event handlers
   */
  const initializeVoiceEngine = () => {
    // Listen for transcripts
    VoiceEngine.onTranscript((data) => {
      handleTranscript(data);
    });
    
    // Listen for errors
    VoiceEngine.onError((errorInfo) => {
      handleVoiceError(errorInfo);
    });
    
    // Listen for end events
    VoiceEngine.onEnd((data) => {
      handleVoiceEnd(data);
    });
    
    // Listen for state changes (if available)
    if (typeof VoiceEngine.onStateChange === 'function') {
      VoiceEngine.onStateChange((data) => {
        handleVoiceStateChange(data);
      });
    }
  };

  // ============================================================================
  // Event Handlers - User Interactions
  // ============================================================================

  /**
   * Handle microphone button click
   * Toggles between start and stop listening
   */
  const handleMicButtonClick = () => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  /**
   * Handle clear button click
   * Resets all content and state
   */
  const handleClearButtonClick = () => {
    // Stop listening if active
    if (state.isListening) {
      stopListening();
    }
    
    // Clear all content
    clearAllContent();
    
    // Reset to ready state
    setUIState('ready');
    
    // Visual feedback
    animateButtonPress(elements.clearButton);
  };

  /**
   * Handle keyboard shortcuts
   * @param {KeyboardEvent} event - Keyboard event
   */
  const handleKeyboardShortcuts = (event) => {
    // Space bar - toggle listening (when not typing in input)
    if (event.code === 'Space' && event.target === document.body) {
      event.preventDefault();
      handleMicButtonClick();
    }
    
    // Escape - stop listening
    if (event.code === 'Escape' && state.isListening) {
      event.preventDefault();
      stopListening();
    }
    
    // Ctrl/Cmd + K - clear all
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      handleClearButtonClick();
    }
  };

  // ============================================================================
  // Event Handlers - VoiceEngine Events
  // ============================================================================

  /**
   * Handle transcript data from VoiceEngine
   * @param {Object} data - Transcript data
   * @param {string} data.transcript - The transcribed text
   * @param {boolean} data.isFinal - Whether this is a final transcript
   * @param {number} data.confidence - Confidence score (0-1)
   * @param {number} data.timestamp - Timestamp of transcript
   */
  const handleTranscript = (data) => {
    const { transcript, isFinal, confidence } = data;
    
    if (isFinal) {
      // Store final transcript
      state.finalTranscript = transcript;
      state.currentTranscript = '';
      
      // Display final transcript
      displayTranscript(transcript, true);
      
      // Process the final transcript (get AI response)
      processTranscript(transcript);
      
    } else {
      // Store interim transcript
      state.currentTranscript = transcript;
      
      // Display interim transcript
      displayTranscript(transcript, false);
    }
  };

  /**
   * Handle errors from VoiceEngine
   * @param {Object} errorInfo - Error information
   * @param {string} errorInfo.type - Error type
   * @param {string} errorInfo.message - Error message
   * @param {boolean} errorInfo.fatal - Whether error is fatal
   * @param {boolean} errorInfo.recoverable - Whether error is recoverable
   */
  const handleVoiceError = (errorInfo) => {
    console.error('VoiceEngine error:', errorInfo);
    
    state.hasError = true;
    state.isListening = false;
    
    // Show error in UI
    showError(errorInfo);
    
    // Update UI state
    setUIState('error');
    
    // Update mic button to stopped state
    updateMicButton(false);
  };

  /**
   * Handle end event from VoiceEngine
   * @param {Object} data - End event data
   */
  const handleVoiceEnd = (data) => {
    // Only update if we think we're still listening
    // (prevents race conditions)
    if (state.isListening) {
      console.log('VoiceEngine ended unexpectedly');
    }
  };

  /**
   * Handle state change from VoiceEngine
   * @param {Object} data - State change data
   */
  const handleVoiceStateChange = (data) => {
    console.log('VoiceEngine state change:', data);
    
    // Sync UI state with engine state
    if (data.isListening !== state.isListening) {
      state.isListening = data.isListening;
      updateMicButton(data.isListening);
    }
  };

  // ============================================================================
  // Voice Control Functions
  // ============================================================================

  /**
   * Start listening for voice input
   */
  const startListening = () => {
    try {
      // Clear any previous errors
      state.hasError = false;
      
      // Clear previous transcript and response
      state.currentTranscript = '';
      state.finalTranscript = '';
      clearTranscript();
      clearResponse();
      
      // Record session start time
      state.sessionStartTime = Date.now();
      
      // Start the voice engine
      const success = VoiceEngine.start();
      
      if (success) {
        state.isListening = true;
        setUIState('listening');
        updateMicButton(true);
      } else {
        showError({
          type: 'start-failed',
          message: 'Failed to start voice recognition',
          recoverable: true
        });
      }
      
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      showError({
        type: 'start-failed',
        message: error.message,
        recoverable: true
      });
    }
  };

  /**
   * Stop listening for voice input
   */
  const stopListening = () => {
    try {
      // Stop the voice engine
      VoiceEngine.stop();
      
      state.isListening = false;
      setUIState('ready');
      updateMicButton(false);
      
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
    }
  };

  // ============================================================================
  // UI State Management
  // ============================================================================

  /**
   * Set the overall UI state
   * @param {string} stateName - State name (ready, listening, processing, error)
   */
  const setUIState = (stateName) => {
    const statusMessage = config.statusMessages[stateName] || stateName;
    
    // Update status text
    updateStatusText(statusMessage);
    
    // Update status dot
    updateStatusDot(stateName);
    
    // Update mic label
    updateMicLabel(stateName);
  };

  /**
   * Update status text display
   * @param {string} text - Status text to display
   */
  const updateStatusText = (text) => {
    if (elements.statusText) {
      elements.statusText.textContent = text;
    }
  };

  /**
   * Update status dot indicator
   * @param {string} stateName - State name for dot styling
   */
  const updateStatusDot = (stateName) => {
    if (!elements.statusDot) return;
    
    // Remove all state classes
    elements.statusDot.classList.remove('ready', 'listening', 'processing', 'error');
    
    // Add current state class
    elements.statusDot.classList.add(stateName);
  };

  /**
   * Update microphone button visual state
   * @param {boolean} isListening - Whether currently listening
   */
  const updateMicButton = (isListening) => {
    if (!elements.micButton) return;
    
    if (isListening) {
      elements.micButton.classList.add('listening');
      elements.micButton.setAttribute('aria-label', 'Stop listening');
    } else {
      elements.micButton.classList.remove('listening');
      elements.micButton.setAttribute('aria-label', 'Start listening');
    }
  };

  /**
   * Update microphone label text
   * @param {string} stateName - Current state name
   */
  const updateMicLabel = (stateName) => {
    if (!elements.micLabel) return;
    
    const labels = {
      ready: 'Click to Start',
      listening: 'Listening...',
      processing: 'Processing...',
      error: 'Try Again'
    };
    
    elements.micLabel.textContent = labels[stateName] || 'Click to Start';
  };

  // ============================================================================
  // Content Display Functions
  // ============================================================================

  /**
   * Display transcript in the UI
   * @param {string} text - Transcript text
   * @param {boolean} isFinal - Whether this is final transcript
   */
  const displayTranscript = (text, isFinal = false) => {
    if (!elements.transcriptArea) return;
    
    // Clear placeholder
    elements.transcriptArea.classList.add('has-content');
    
    // Create or update transcript element
    let transcriptElement = elements.transcriptArea.querySelector('.transcript-text');
    
    if (!transcriptElement) {
      transcriptElement = document.createElement('p');
      transcriptElement.className = 'transcript-text';
      elements.transcriptArea.innerHTML = '';
      elements.transcriptArea.appendChild(transcriptElement);
    }
    
    // Update text
    transcriptElement.textContent = text;
    
    // Add styling for interim vs final
    if (isFinal) {
      transcriptElement.style.fontWeight = '600';
      transcriptElement.style.color = 'var(--gray-800)';
    } else {
      transcriptElement.style.fontWeight = '400';
      transcriptElement.style.color = 'var(--gray-500)';
    }
    
    // Scroll to bottom
    elements.transcriptArea.scrollTop = elements.transcriptArea.scrollHeight;
  };

  /**
   * Display AI response in the UI
   * @param {string} text - Response text
   */
  const displayResponse = (text) => {
    if (!elements.responseArea) return;
    
    // Clear placeholder
    elements.responseArea.classList.add('has-content');
    
    // Create or update response element
    let responseElement = elements.responseArea.querySelector('.response-text');
    
    if (!responseElement) {
      responseElement = document.createElement('p');
      responseElement.className = 'response-text';
      elements.responseArea.innerHTML = '';
      elements.responseArea.appendChild(responseElement);
    }
    
    // Update text
    responseElement.textContent = text;
    responseElement.style.fontWeight = '500';
    responseElement.style.color = 'var(--gray-800)';
    
    // Scroll to bottom
    elements.responseArea.scrollTop = elements.responseArea.scrollHeight;
    
    // Store response
    state.currentResponse = text;
  };

  /**
   * Show error message in UI
   * @param {Object} errorInfo - Error information
   */
  const showError = (errorInfo) => {
    const { type, message, fatal } = errorInfo;
    
    // Update status
    updateStatusText('Error: ' + type);
    
    // Show error in response area
    if (elements.responseArea) {
      elements.responseArea.classList.add('has-content');
      elements.responseArea.innerHTML = `
        <div class="error-message" style="color: var(--error-red); font-weight: 500;">
          <p><strong>Error:</strong> ${message}</p>
          ${fatal ? '<p style="margin-top: 8px; font-size: 12px;">Please reload the extension.</p>' : ''}
        </div>
      `;
    }
  };

  /**
   * Clear transcript display
   */
  const clearTranscript = () => {
    if (!elements.transcriptArea) return;
    
    elements.transcriptArea.classList.remove('has-content');
    elements.transcriptArea.innerHTML = `
      <p class="placeholder-text">${config.placeholders.transcript}</p>
    `;
  };

  /**
   * Clear response display
   */
  const clearResponse = () => {
    if (!elements.responseArea) return;
    
    elements.responseArea.classList.remove('has-content');
    elements.responseArea.innerHTML = `
      <p class="placeholder-text">${config.placeholders.response}</p>
    `;
  };

  /**
   * Clear all content (transcript and response)
   */
  const clearAllContent = () => {
    clearTranscript();
    clearResponse();
    
    // Reset state
    state.currentTranscript = '';
    state.finalTranscript = '';
    state.currentResponse = '';
    state.hasError = false;
  };

  // ============================================================================
  // AI Response Processing (Mock Backend)
  // ============================================================================

  /**
   * Process final transcript and generate AI response
   * @param {string} transcript - Final transcript text
   */
  const processTranscript = async (transcript) => {
    if (!transcript || transcript.trim().length === 0) {
      return;
    }
    
    // Update UI to processing state
    setUIState('processing');
    
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: transcript
        })
      });

      if (!response.ok) {
        throw new Error('Backend request failed');
      }

      const result = await response.json();

      // console.log("Backend Result:", result);

      setUIState('responding');

      // Show AI message
      displayResponse(result.message || 'Done');

      // 🔊 Speak response (optional for now)
      speakText(result.message);

      // 👉 Send intent to router (Phase 2)
      sendToRouter(result);

      await delay(500);
      setUIState('ready');
    } catch (error) {
      console.error('Error processing transcript:', error);
      showError({
        type: 'processing-failed',
        message: 'Failed to process your message',
        recoverable: true
      });
      setUIState('error');
    }
  };

  const sendToRouter = (data) => {
    chrome.runtime.sendMessage({
      type: 'INTENT_RESULT',
      payload: data
    });
  };


  /**
   * Generate a mock AI response based on transcript
   * Replace this with actual API call to your backend
   * 
   * @param {string} transcript - User's transcript
   * @returns {string} Mock AI response
   */
  const generateMockResponse = (transcript) => {
    const lowerTranscript = transcript.toLowerCase();
    
    // Simple keyword-based responses (mock)
    if (lowerTranscript.includes('hello') || lowerTranscript.includes('hi')) {
      return "Hello! I'm VoiceReplica, your AI voice assistant. How can I help you today?";
    }
    
    if (lowerTranscript.includes('weather')) {
      return "I don't have access to real-time weather data yet, but I can help you with other tasks!";
    }
    
    if (lowerTranscript.includes('time')) {
      const currentTime = new Date().toLocaleTimeString();
      return `The current time is ${currentTime}.`;
    }
    
    if (lowerTranscript.includes('help')) {
      return "I can help you with various tasks. Try asking me questions, giving commands, or just having a conversation!";
    }
    
    if (lowerTranscript.includes('thank')) {
      return "You're welcome! I'm here to help whenever you need me.";
    }
    
    // Default response
    return `I heard you say: "${transcript}". This is a mock response. Connect me to your AI backend to provide real responses!`;
  };

  // ============================================================================
  // Utility Functions
  // ============================================================================

  /**
   * Create a delay using Promise
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  const delay = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  /**
   * Animate button press for visual feedback
   * @param {HTMLElement} button - Button element to animate
   */
  const animateButtonPress = (button) => {
    if (!button) return;
    
    button.style.transform = 'scale(0.95)';
    setTimeout(() => {
      button.style.transform = '';
    }, 150);
  };

  const speakText = (text) => {
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    speechSynthesis.speak(utterance);
  };


  /**
   * Format timestamp for display
   * @param {number} timestamp - Unix timestamp
   * @returns {string} Formatted time string
   */
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  // ============================================================================
  // Public API (if needed for external access)
  // ============================================================================

  window.VoiceReplicaUI = {
    // Expose only necessary methods for external use
    getState: () => ({ ...state }),
    clearAll: clearAllContent,
    startListening,
    stopListening
  };

  // ============================================================================
  // Auto-Initialize on DOM Ready
  // ============================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();