// ===== Notification Sound System =====
// Uses Web Audio API — no external sound files needed

const NotificationSound = {
    _ctx: null,

    _getContext() {
        if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        return this._ctx;
    },

    // Kitchen bell — new order in queue (bright ding-ding)
    newOrder() {
        const ctx = this._getContext();
        const now = ctx.currentTime;

        // First ding
        this._playTone(ctx, 880, now, 0.15, 'sine', 0.4);
        this._playTone(ctx, 1320, now + 0.02, 0.15, 'sine', 0.3);

        // Second ding
        this._playTone(ctx, 880, now + 0.25, 0.15, 'sine', 0.4);
        this._playTone(ctx, 1320, now + 0.27, 0.15, 'sine', 0.3);

        // Third ding (higher)
        this._playTone(ctx, 1100, now + 0.5, 0.2, 'sine', 0.35);
        this._playTone(ctx, 1650, now + 0.52, 0.2, 'sine', 0.25);
    },

    // Order ready — waiter notification (pleasant ascending chime)
    orderReady() {
        const ctx = this._getContext();
        const now = ctx.currentTime;

        this._playTone(ctx, 523, now, 0.12, 'sine', 0.3);        // C5
        this._playTone(ctx, 659, now + 0.12, 0.12, 'sine', 0.3);  // E5
        this._playTone(ctx, 784, now + 0.24, 0.12, 'sine', 0.3);  // G5
        this._playTone(ctx, 1047, now + 0.36, 0.3, 'sine', 0.35); // C6 (hold)
    },

    // Payment success — cashier (cash register ka-ching)
    paymentSuccess() {
        const ctx = this._getContext();
        const now = ctx.currentTime;

        // Quick metallic hit
        this._playTone(ctx, 2000, now, 0.05, 'square', 0.15);
        this._playTone(ctx, 3000, now + 0.02, 0.08, 'sine', 0.2);
        // Ring
        this._playTone(ctx, 1500, now + 0.08, 0.3, 'sine', 0.25);
        this._playTone(ctx, 2000, now + 0.1, 0.3, 'sine', 0.2);
    },

    // Low stock warning — urgent beep
    warning() {
        const ctx = this._getContext();
        const now = ctx.currentTime;

        this._playTone(ctx, 400, now, 0.15, 'sawtooth', 0.2);
        this._playTone(ctx, 350, now + 0.2, 0.15, 'sawtooth', 0.2);
        this._playTone(ctx, 300, now + 0.4, 0.25, 'sawtooth', 0.25);
    },

    // Online order — special notification (gentle melody)
    onlineOrder() {
        const ctx = this._getContext();
        const now = ctx.currentTime;

        this._playTone(ctx, 440, now, 0.1, 'sine', 0.25);
        this._playTone(ctx, 554, now + 0.1, 0.1, 'sine', 0.25);
        this._playTone(ctx, 659, now + 0.2, 0.1, 'sine', 0.25);
        this._playTone(ctx, 880, now + 0.3, 0.15, 'sine', 0.3);
        this._playTone(ctx, 659, now + 0.5, 0.1, 'sine', 0.2);
        this._playTone(ctx, 880, now + 0.6, 0.25, 'sine', 0.3);
    },

    _playTone(ctx, freq, startTime, duration, type, volume) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration + 0.05);
    }
};
