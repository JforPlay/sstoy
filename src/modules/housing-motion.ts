import { AnimationMixer } from 'three';
import type { Object3D } from 'three';

/** Original skeletal animation, with one cancellable render loop per visible model. */
export class HousingMotion {
  private readonly mixer: AnimationMixer;
  private frame = 0;
  private previous = 0;
  private disposed = false;

  constructor(private readonly model: Object3D, private readonly draw: () => void, enabled = true) {
    this.mixer = new AnimationMixer(model);
    const clip = model.animations[0];
    if (clip) {
      this.mixer.clipAction(clip).play();
      this.mixer.update(0);
      this.setEnabled(enabled);
    }
  }

  setEnabled(enabled: boolean): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0; this.previous = 0;
    if (enabled && !this.disposed && this.model.animations.length) this.frame = requestAnimationFrame(this.tick);
  }

  private readonly tick = (time: number): void => {
    if (this.disposed) return;
    if (this.previous) this.mixer.update(Math.min((time - this.previous) / 1000, .1));
    this.previous = time;
    this.draw();
    this.frame = requestAnimationFrame(this.tick);
  };

  dispose(): void {
    this.disposed = true;
    this.setEnabled(false);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
  }
}
