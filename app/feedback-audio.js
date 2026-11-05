// Kept identical across the three standalone Garden apps.
(() => {
  class GardenFeedbackAudio {
    constructor({enabled = () => true} = {}) {
      this.enabled = enabled;
      this.element = null;
      this.token = 0;
      this.cancel = null;
      this.onHidden = () => { if (document.hidden) this.stop(); };
      globalThis.document?.addEventListener('visibilitychange', this.onHidden);
      globalThis.window?.addEventListener('pagehide', () => this.stop());
    }
    stop() {
      this.token++;
      this.cancel?.();
      if (!this.element) return;
      this.element.pause();
      this.element.removeAttribute('src');
      this.element.load();
    }
    async play(correct) {
      this.stop();
      if (!this.enabled() || document.hidden) return false;
      if (!this.element) {
        this.element = new Audio();
        this.element.id = 'feedback-audio';
        this.element.hidden = true;
        this.element.preload = 'none';
        this.element.setAttribute('playsinline', '');
        document.body.append(this.element);
      }
      const token = this.token;
      this.element.volume = 1;
      this.element.src = new URL(`./assets/audio/feedback-${correct ? 'correct' : 'retry'}.wav`, document.baseURI).href;
      return new Promise(resolve => {
        let settled = false;
        const finish = ok => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.element.onended = this.element.onerror = null;
          if (this.cancel === cancel) this.cancel = null;
          resolve(ok && token === this.token);
        };
        const cancel = () => finish(false);
        this.cancel = cancel;
        const timer = setTimeout(() => { finish(false); this.stop(); }, 15000);
        this.element.onended = () => finish(true);
        this.element.onerror = () => finish(false);
        // Play inside the answer tap so iPad can unlock this media element.
        this.element.play().catch(() => finish(false));
      });
    }
  }
  globalThis.GardenFeedbackAudio = GardenFeedbackAudio;
})();
