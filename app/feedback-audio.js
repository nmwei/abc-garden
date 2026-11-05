// Kept identical across the three standalone Garden apps.
(() => {
  class GardenFeedbackAudio {
    static instances = new Set();
    static stopAll() { for (const player of this.instances) player.stop(); }
    constructor({enabled = () => true} = {}) {
      this.enabled = enabled;
      GardenFeedbackAudio.instances.add(this);
      this.element = null;
      this.token = 0;
      this.cancel = null;
      this.onHidden = () => { if (document.hidden) this.stop(); };
      globalThis.document?.addEventListener('visibilitychange', this.onHidden);
      globalThis.window?.addEventListener('pagehide', () => this.stop());
    }
    stop() {
      this.token++;
      clearTimeout(this.flowerTimer);
      this.flower?.remove();
      this.flower = null;
      this.cancel?.();
      if (!this.element) return;
      this.element.pause();
      this.element.removeAttribute('src');
      this.element.load();
    }
    answer(correct, anchor) {
      const pending = this.play(correct);
      if (correct && !document.hidden) {
        const box = (anchor?.isConnected ? anchor : document.body).getBoundingClientRect();
        const width = document.documentElement.clientWidth, height = document.documentElement.clientHeight;
        const flower = document.createElement('div');
        flower.className = 'answer-flower';
        flower.setAttribute('aria-hidden', 'true');
        flower.style.left = `${Math.max(90, Math.min(width - 90, box.left + box.width / 2))}px`;
        flower.style.top = `${Math.max(90, Math.min(height - 65, box.top + 4))}px`;
        const img = document.createElement('img');
        img.src = new URL('./assets/feedback-flower.svg', document.baseURI).href;
        img.alt = ''; img.width = img.height = 40;
        const label = document.createElement('span'); label.textContent = '答对啦！';
        flower.append(img, label); document.body.append(flower); this.flower = flower;
        this.flowerTimer = setTimeout(() => { flower.remove(); if (this.flower === flower) this.flower = null; }, 1450);
      }
      return pending;
    }
    async play(correct) {
      GardenFeedbackAudio.stopAll();
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
