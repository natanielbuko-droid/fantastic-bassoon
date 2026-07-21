/**
 * Syntezowane audio przez WebAudio API — zero plików dźwiękowych.
 * AudioContext powstaje dopiero po pierwszej interakcji użytkownika
 * (wymóg autoplay w przeglądarkach). Muzyka tła to prosty arpeggiator
 * planowany z wyprzedzeniem względem zegara AudioContext.
 */

const MASTER_VOLUME = 0.5;
const MUSIC_VOLUME = 0.16;

// Arpeggio a-moll: A2, E3, A3, C4, E4, C4, A3, E3 (Hz)
const ARP_PATTERN = [110, 164.81, 220, 261.63, 329.63, 261.63, 220, 164.81];
const ARP_BPM = 132;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private muted: boolean;
  private schedulerId: number | null = null;
  private nextNoteTime = 0;
  private arpStep = 0;

  constructor(muted: boolean) {
    this.muted = muted;
  }

  /** Wywoływane przy pierwszej interakcji — tworzy/wznawia AudioContext. */
  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = MUSIC_VOLUME;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, this.ctx.currentTime, 0.02);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    slideTo?: number,
    when = 0,
    destination?: AudioNode,
  ): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), t0 + duration);
    }
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(destination ?? this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private noise(duration: number, volume: number): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * duration), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  playFlip(): void {
    this.tone(240, 0.09, "square", 0.16, 480);
  }

  /** Wysokość dźwięku rośnie z licznikiem combo. */
  playCollect(comboCount: number): void {
    const freq = 620 * Math.pow(2, Math.min(comboCount, 14) / 12);
    this.tone(freq, 0.13, "sine", 0.22);
    this.tone(freq * 2, 0.1, "sine", 0.08);
  }

  playPowerup(): void {
    this.tone(392, 0.1, "triangle", 0.2);
    this.tone(523.25, 0.1, "triangle", 0.2, undefined, 0.09);
    this.tone(784, 0.16, "triangle", 0.2, undefined, 0.18);
  }

  playShieldBreak(): void {
    this.tone(660, 0.18, "square", 0.18, 180);
    this.noise(0.12, 0.1);
  }

  playDeath(): void {
    this.tone(220, 0.55, "sawtooth", 0.28, 36);
    this.noise(0.35, 0.22);
  }

  startMusic(): void {
    if (!this.ctx || this.schedulerId !== null) return;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    const beat = 60 / ARP_BPM / 2; // ósemki
    const scheduler = () => {
      if (!this.ctx) return;
      // Planuj nuty na 0.2 s do przodu.
      while (this.nextNoteTime < this.ctx.currentTime + 0.2) {
        const freq = ARP_PATTERN[this.arpStep % ARP_PATTERN.length]!;
        this.tone(
          freq,
          beat * 0.9,
          "triangle",
          1,
          undefined,
          this.nextNoteTime - this.ctx.currentTime,
          this.musicGain ?? undefined,
        );
        // Bas co pełny takt.
        if (this.arpStep % 8 === 0) {
          this.tone(
            55,
            beat * 3,
            "sine",
            0.9,
            undefined,
            this.nextNoteTime - this.ctx.currentTime,
            this.musicGain ?? undefined,
          );
        }
        this.nextNoteTime += beat;
        this.arpStep++;
      }
    };
    scheduler();
    this.schedulerId = window.setInterval(scheduler, 90);
  }

  stopMusic(): void {
    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }
}
