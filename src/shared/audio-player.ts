/**
 * Audio Player Manager
 * Singleton manager for playing character voicelines
 */

class AudioPlayerManager {
  private audio: HTMLAudioElement;
  private currentTrack: string | null = null;
  private volume: number = 5; // Default volume 5%
  private endCallbacks: Array<() => void> = [];

  constructor() {
    this.audio = new Audio();
    this.audio.volume = this.volume / 100;

    // Setup event listeners
    this.audio.addEventListener('ended', () => {
      this.currentTrack = null;
      this.endCallbacks.forEach(cb => cb());
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Audio playback error:', e);
      this.currentTrack = null;
    });
  }

  /**
   * Play audio from the given path
   */
  async play(audioPath: string): Promise<void> {
    // Stop current audio if playing
    if (this.isPlaying()) {
      this.stop();
    }

    console.log('[AudioPlayer] Attempting to play:', audioPath);
    this.currentTrack = audioPath;
    this.audio.src = audioPath;

    try {
      await this.audio.play();
      console.log('[AudioPlayer] Playing successfully');
    } catch (error) {
      console.error('[AudioPlayer] Play failed:', error);
      this.currentTrack = null;
      throw error;
    }
  }

  /**
   * Pause current audio
   */
  pause(): void {
    if (!this.audio.paused) {
      this.audio.pause();
    }
  }

  /**
   * Stop audio and reset
   */
  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.currentTrack = null;
  }

  /**
   * Set volume (0-100)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(100, volume));
    this.audio.volume = this.volume / 100;
  }

  /**
   * Get current volume (0-100)
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Get currently playing track path
   */
  getCurrentTrack(): string | null {
    return this.currentTrack;
  }

  /**
   * Check if audio is currently playing
   */
  isPlaying(): boolean {
    return !this.audio.paused && this.currentTrack !== null;
  }

  /**
   * Register callback for when playback ends
   */
  onPlaybackEnd(callback: () => void): void {
    this.endCallbacks.push(callback);
  }

  /**
   * Clear all end callbacks
   */
  clearEndCallbacks(): void {
    this.endCallbacks = [];
  }
}

// Create singleton instance
export const AudioPlayer = new AudioPlayerManager();

// Export to window for global access
if (typeof window !== 'undefined') {
  window.AudioPlayer = AudioPlayer;
}
