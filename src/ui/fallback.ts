
export type FallbackState = 'Idle' | 'Offer' | 'Playing';

export class FallbackController {
  state: FallbackState = 'Idle';
  private timeout?: number;
  constructor(private onShow: () => void, private onPlay: () => void) {}
  arm(delayMs = 2000) {
    this.cancel();
    this.timeout = window.setTimeout(() => {
      this.state = 'Offer';
      this.onShow();
    }, delayMs);
  }
  play() {
    this.state = 'Playing';
    this.onPlay();
    this.cancel();
  }
  reset() {
    this.state = 'Idle';
    this.cancel();
  }
  private cancel() { if (this.timeout) { clearTimeout(this.timeout); this.timeout = undefined; } }
}
