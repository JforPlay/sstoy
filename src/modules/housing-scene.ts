import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { footprint, furnitureKind } from './housing-layout';
import type { Furniture, Placement, RoomSize } from './housing-layout';

type SceneState = { indoor: boolean; size: RoomSize; placements: Placement[]; furniture: Record<string, Furniture>; selected: string; floor?: number; wall?: number; grid: boolean };
type Callbacks = { select: (uid: string) => void; move: (placement: Placement) => void; error: (id: string) => void };
const loader = new GLTFLoader();
const models = new Map<string, Promise<THREE.Group>>();
function loadModel(id: string): Promise<THREE.Group> {
  let pending = models.get(id);
  if (!pending) {
    pending = loader.loadAsync(`assets/housing/models/${id}.glb`).then(gltf => gltf.scene);
    models.set(id, pending);
    void pending.catch(() => models.delete(id));
  }
  return pending;
}

/** Original Unity meshes, rendered in real 3D. Layout coordinates remain unchanged. */
export class HousingScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-20, 20, 16, -16, .1, 250);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly controls: OrbitControls;
  private readonly objects = new THREE.Group();
  private readonly environment = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly observer: ResizeObserver;
  private grid?: THREE.GridHelper;
  private selection?: THREE.BoxHelper;
  private state?: SceneState;
  private revision = 0;
  private disposed = false;
  private environmentId = '';
  private drag?: { p: Placement; object: THREE.Object3D; start: THREE.Vector3; position: THREE.Vector3; candidate: Placement; pointerId: number };

  constructor(private readonly host: HTMLElement, private readonly callbacks: Callbacks) {
    const canvas = this.renderer.domElement;
    canvas.className = 'housing-scene';
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', host.getAttribute('aria-label') || '3D');
    host.replaceChildren(canvas);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color('#c7d9b0');
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9aab80, 2.2));
    const sun = new THREE.DirectionalLight(0xfff5dc, 2.2);
    sun.position.set(5, 32, -18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, far: 100 });
    sun.shadow.bias = -.0005;
    this.scene.add(sun, sun.target, this.environment, this.objects);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = false;
    this.controls.minZoom = .45;
    this.controls.maxZoom = 5;
    this.controls.maxPolarAngle = Math.PI * .48;
    this.controls.minPolarAngle = .15;
    this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    this.controls.addEventListener('change', this.draw);
    canvas.addEventListener('pointerdown', this.onDown, true);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(host);
    this.resize();
  }

  private readonly draw = (): void => {
    if (this.disposed) return;
    if (this.state?.indoor) {
      const direction = this.camera.position.clone().sub(this.controls.target).setY(0).normalize();
      this.environment.traverse(node => {
        if (!(node instanceof THREE.Mesh) || !node.name.includes('DianTi01')) return;
        const center = node.userData.backdropCenter as THREE.Vector3 | undefined;
        if (center) node.visible = center.clone().sub(this.controls.target).setY(0).dot(direction) < this.state!.size.L * .7;
      });
    }
    this.renderer.render(this.scene, this.camera);
  };
  private readonly resize = (): void => {
    const width = this.host.clientWidth, height = this.host.clientHeight;
    if (!width || !height || this.disposed) return;
    this.camera.left = -19 * width / height;
    this.camera.right = 19 * width / height;
    this.camera.top = 19; this.camera.bottom = -19;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.draw();
  };

  update(state: SceneState): void {
    this.state = state;
    const revision = ++this.revision;
    const sceneId = state.indoor ? 'indoor' : 'outdoor';
    if (this.environmentId !== sceneId) {
      this.environmentId = sceneId;
      this.environment.clear();
      this.camera.position.set(-35, 30, 40);
      this.controls.target.set(-state.size.L / 2, 0, state.size.W / 2);
      this.camera.zoom = 1.3;
      this.controls.update();
      this.scene.background = new THREE.Color(state.indoor ? '#b7b5bd' : '#c7d9b0');
      void loadModel(sceneId).then(model => {
        if (this.disposed || this.environmentId !== sceneId) return;
        const clone = model.clone(true);
        this.prepare(clone);
        this.environment.add(clone);
        clone.updateMatrixWorld(true);
        clone.traverse(node => {
          if (node instanceof THREE.Mesh && node.name.includes('DianTi01')) node.userData.backdropCenter = new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3());
        });
        this.draw();
      }).catch(() => this.callbacks.error(sceneId));
    }
    if (this.grid) { this.scene.remove(this.grid); this.grid.geometry.dispose(); (this.grid.material as THREE.Material).dispose(); }
    this.grid = new THREE.GridHelper(state.size.L, state.size.L, 0xfff8dd, 0xfff8dd);
    this.grid.position.set(-state.size.L / 2, .04, state.size.W / 2);
    (this.grid.material as THREE.Material).transparent = true;
    (this.grid.material as THREE.Material).opacity = .45;
    this.grid.visible = state.grid;
    this.scene.add(this.grid);
    const requested = [...state.placements.map(p => ({ id: p.furnitureId, placement: p })),
      ...([state.floor, state.wall].filter((id): id is number => !!id).map(id => ({ id, placement: undefined })))];
    void Promise.all(requested.map(async entry => {
      try {
        const model = (await loadModel(String(entry.id))).clone(true);
        this.prepare(model);
        const wrapper = new THREE.Group();
        wrapper.add(model);
        if (entry.placement) {
          const p = entry.placement, f = state.furniture[p.furnitureId]!;
          const kind = furnitureKind(f);
          if (kind !== 'wall' && kind !== 'fixture') {
            const bounds = new THREE.Box3().setFromObject(model);
            const center = bounds.getCenter(new THREE.Vector3());
            model.position.set(-center.x, -bounds.min.y, -center.z);
            const dimensions = footprint(f, p.rotation);
            wrapper.position.set(-p.x - dimensions.L / 2, .015, p.y + dimensions.W / 2);
          } else if (kind === 'wall') {
            const bounds = new THREE.Box3().setFromObject(model);
            const center = bounds.getCenter(new THREE.Vector3());
            model.position.set(-center.x, -bounds.min.y, -bounds.min.z + .025);
            wrapper.position.set(p.wall === 'left' ? 0 : -p.x - f.L / 2, p.elevation || 0, p.wall === 'left' ? p.y + f.L / 2 : 0);
          } else {
            wrapper.position.set(-p.x, p.elevation || 0, p.y);
          }
          wrapper.rotation.y = -THREE.MathUtils.degToRad(p.rotation);
          wrapper.userData.placement = p.uid;
        }
        return wrapper;
      } catch { if (revision === this.revision) this.callbacks.error(String(entry.id)); return undefined; }
    })).then(objects => {
      if (revision !== this.revision || this.disposed) return;
      this.objects.clear();
      objects.forEach(object => { if (object) this.objects.add(object); });
      this.highlight(state.selected);
      this.draw();
    });
    this.draw();
  }

  private prepare(object: THREE.Object3D): void {
    object.traverse(node => {
      if (node instanceof THREE.Mesh) { node.castShadow = true; node.receiveShadow = true; }
    });
  }

  private highlight(uid: string): void {
    if (this.selection) { this.scene.remove(this.selection); this.selection.geometry.dispose(); this.selection.material.dispose(); this.selection = undefined; }
    const object = this.objects.children.find(child => child.userData.placement === uid);
    if (object) { this.selection = new THREE.BoxHelper(object, 0x55eddf); this.scene.add(this.selection); }
  }

  point(clientX: number, clientY: number, wall?: 'left' | 'right'): { x: number; y: number } | undefined {
    this.setRay(clientX, clientY);
    const plane = wall ? new THREE.Plane(new THREE.Vector3(wall === 'left' ? 1 : 0, 0, wall === 'right' ? 1 : 0), 0) : new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = this.raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    if (!hit) return undefined;
    return wall ? { x: wall === 'left' ? hit.z : -hit.x, y: hit.y } : { x: -hit.x, y: hit.z };
  }

  private setRay(x: number, y: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private readonly onDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !this.state) return;
    this.setRay(event.clientX, event.clientY);
    let object: THREE.Object3D | null | undefined;
    for (const hit of this.raycaster.intersectObjects(this.objects.children, true)) {
      object = hit.object;
      while (object && !object.userData.placement) object = object.parent;
      if (object?.userData.placement) break;
    }
    const uid = object?.userData.placement as string | undefined;
    this.callbacks.select(uid || '');
    this.highlight(uid || ''); this.draw();
    const p = this.state.placements.find(p => p.uid === uid);
    if (!p || !object || p.uid.startsWith('fixture-')) return;
    const point = this.point(event.clientX, event.clientY, p.wall);
    if (!point) return;
    event.stopImmediatePropagation();
    this.controls.enabled = false;
    this.renderer.domElement.setPointerCapture(event.pointerId);
    this.drag = { p, object, start: new THREE.Vector3(point.x, point.y, 0), position: object.position.clone(), candidate: { ...p }, pointerId: event.pointerId };
  };

  private readonly onMove = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag) return;
    const point = this.point(event.clientX, event.clientY, drag.p.wall);
    if (!point) return;
    const dx = Math.round(point.x - drag.start.x), dy = Math.round(point.y - drag.start.y);
    drag.candidate = drag.p.wall ? { ...drag.p, x: drag.p.wall === 'right' ? drag.p.x + dx : 0, y: drag.p.wall === 'left' ? drag.p.y + dx : 0, elevation: (drag.p.elevation || 0) + dy } : { ...drag.p, x: drag.p.x + dx, y: drag.p.y + dy };
    drag.object.position.copy(drag.position).add(drag.p.wall ? new THREE.Vector3(drag.p.wall === 'right' ? -dx : 0, dy, drag.p.wall === 'left' ? dx : 0) : new THREE.Vector3(-dx, 0, dy));
    this.selection?.update(); this.draw();
  };

  private readonly onUp = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag) return;
    this.drag = undefined;
    this.controls.enabled = true;
    this.renderer.domElement.releasePointerCapture(drag.pointerId);
    drag.object.position.copy(drag.position);
    if (event.type !== 'pointercancel' && JSON.stringify(drag.p) !== JSON.stringify(drag.candidate)) this.callbacks.move(drag.candidate);
    this.selection?.update(); this.draw();
  };

  dispose(): void {
    this.disposed = true; ++this.revision;
    this.observer.disconnect(); this.controls.dispose();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onDown, true);
    canvas.removeEventListener('pointermove', this.onMove);
    canvas.removeEventListener('pointerup', this.onUp);
    canvas.removeEventListener('pointercancel', this.onUp);
    this.grid?.geometry.dispose();
    if (this.grid) (this.grid.material as THREE.Material).dispose();
    this.selection?.geometry.dispose(); this.selection?.material.dispose();
    this.renderer.dispose(); canvas.remove();
  }
}
