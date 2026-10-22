import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimationClip, Group, VectorKeyframeTrack } from 'three';
import { HousingMotion } from '../housing-motion';

describe('housing idle playback', () => {
  let frames: Map<number, FrameRequestCallback>;
  let id: number;
  beforeEach(() => {
    frames = new Map(); id = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++id, callback); return id; });
    vi.stubGlobal('cancelAnimationFrame', (frame: number) => frames.delete(frame));
  });
  afterEach(() => vi.unstubAllGlobals());
  function step(time: number): void {
    const callbacks = [...frames.values()]; frames.clear();
    callbacks.forEach(callback => callback(time));
  }
  function model(): Group {
    const root = new Group();
    root.animations = [new AnimationClip('idle', 1, [new VectorKeyframeTrack('.position', [0, 1], [0, 0, 0, 1, 0, 0])])];
    return root;
  }
  it('animates, pauses, resumes and cancels the loop on disposal', () => {
    const root = model(), draw = vi.fn();
    const motion = new HousingMotion(root, draw);
    step(100); step(150);
    expect(root.position.x).toBeCloseTo(.05);
    motion.setEnabled(false);
    expect(frames.size).toBe(0);
    step(200); expect(root.position.x).toBeCloseTo(.05);
    motion.setEnabled(true); step(1000); step(1050);
    expect(root.position.x).toBeCloseTo(.1);
    expect(draw).toHaveBeenCalledTimes(4);
    motion.dispose(); expect(frames.size).toBe(0);
  });
  it('does not schedule a loop for static furniture', () => {
    const motion = new HousingMotion(new Group(), vi.fn());
    expect(frames.size).toBe(0);
    motion.dispose();
  });
  it('does not share animation state between model instances', () => {
    const first = model(), second = model();
    const a = new HousingMotion(first, vi.fn());
    const b = new HousingMotion(second, vi.fn(), false);
    step(100); step(150);
    expect(first.position.x).toBeCloseTo(.05);
    expect(second.position.x).toBe(0);
    a.dispose(); b.dispose();
  });
});
