import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadHousingModel, cloneHousingModel } from './housing-models';
import { setCharacterExpression } from './housing-expression';
import { HousingMotion } from './housing-motion';

/** Independent inspector camera; never changes the room camera or saved layout. */
export class HousingPreview {
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 1, .01, 1000);
  private readonly controls: OrbitControls;
  private readonly observer: ResizeObserver;
  private disposed = false;
  private expression = 1;
  private motion?: HousingMotion;
  private motionEnabled = true;

  constructor(private readonly host: HTMLElement, id: string, onError: () => void) {
    const canvas = this.renderer.domElement;
    canvas.className = 'housing-scene';
    canvas.setAttribute('aria-label', host.getAttribute('aria-label') || '3D');
    canvas.tabIndex = 0;
    host.replaceChildren(canvas);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9aab80, 2.2));
    const sun = new THREE.DirectionalLight(0xfff5dc, 2.2);
    sun.position.set(5, 10, 8);
    this.scene.add(sun);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.zoomSpeed = .5;
    this.controls.addEventListener('change', this.draw);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('mousedown', this.onMouseDown);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(host);
    this.resize();
    void loadHousingModel(id).then(source => {
      if (this.disposed) return;
      const model = cloneHousingModel(source);
      setCharacterExpression(model, this.expression);
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, .1);
      model.position.sub(center);
      this.scene.add(model);
      this.motion = new HousingMotion(model, this.draw, this.motionEnabled);
      const distance = radius / Math.sin(THREE.MathUtils.degToRad(20));
      this.camera.position.copy(new THREE.Vector3(-1, .7, 1.4).normalize().multiplyScalar(distance));
      this.camera.near = radius / 100;
      this.camera.far = radius * 100;
      this.controls.minDistance = radius * .25;
      this.controls.maxDistance = radius * 15;
      this.camera.updateProjectionMatrix();
      this.controls.update();
      this.draw();
    }).catch(error => {
      if (this.disposed) return;
      console.error('[Housing preview]', id, error);
      onError();
    });
  }

  setExpression(expression: number): void {
    this.expression = expression;
    setCharacterExpression(this.scene, expression);
    this.draw();
  }

  setMotion(enabled: boolean): void {
    this.motionEnabled = enabled;
    this.motion?.setEnabled(enabled);
  }

  private readonly onWheel = (event: WheelEvent): void => { event.preventDefault(); };
  private readonly onMouseDown = (event: MouseEvent): void => { if (event.button === 1) event.preventDefault(); };
  private readonly draw = (): void => { if (!this.disposed) this.renderer.render(this.scene, this.camera); };
  private readonly resize = (): void => {
    const width = this.host.clientWidth, height = this.host.clientHeight;
    if (!width || !height || this.disposed) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.draw();
  };

  dispose(): void {
    this.disposed = true;
    this.motion?.dispose();
    this.observer.disconnect();
    this.controls.dispose();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('wheel', this.onWheel);
    canvas.removeEventListener('mousedown', this.onMouseDown);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
  }
}
