// Sound & Browser Notifications Manager

class NotificationManager {
  constructor() {
    this.soundEnabled = true;
    this.audioContext = null;
    this.initAudio();
    this.requestPermission();
  }

  // Initialize Web Audio API context on first user click to bypass browser safety limits
  initAudio() {
    const handleGesture = () => {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
    };
    
    window.addEventListener('click', handleGesture, { once: true });
    window.addEventListener('keydown', handleGesture, { once: true });
  }

  // Toggle sounds
  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    return this.soundEnabled;
  }

  // Synthesize a beautiful, high-quality modern chime using Web Audio API oscillators
  playChime() {
    if (!this.soundEnabled) return;
    
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const ctx = this.audioContext;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const now = ctx.currentTime;
      
      // Node creation
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      // Wave shape
      osc1.type = 'sine';
      osc2.type = 'triangle';
      
      // Frequencies: High, clean double-tone chord (E6 & A6)
      osc1.frequency.setValueAtTime(1318.51, now); // E6
      osc2.frequency.setValueAtTime(1760.00, now); // A6
      
      // Gain envelope (smooth fade out)
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.12, now + 0.02); // Quick fade-in
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.35); // Smooth decay
      
      // Hooking up
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Timing
      osc1.start(now);
      osc2.start(now);
      
      osc1.stop(now + 0.4);
      osc2.stop(now + 0.4);
      
    } catch (err) {
      console.warn('Audio Context failed to play sound:', err);
    }
  }

  // Request browser desktop notification permissions
  requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  // Display native OS/browser message notification banner
  showBrowserNotification(title, message, onClickCallback) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    
    // Only send notification if application tab is currently blurred/hidden
    if (document.hidden) {
      const options = {
        body: message,
        icon: '/favicon.ico', // Placeholder or brand icon
        tag: 'nexuschat-msg',
        renotify: true
      };
      
      const notification = new Notification(title, options);
      
      if (onClickCallback) {
        notification.onclick = () => {
          window.focus();
          onClickCallback();
          notification.close();
        };
      }
    }
  }
}

// Global reference
window.notifications = new NotificationManager();
