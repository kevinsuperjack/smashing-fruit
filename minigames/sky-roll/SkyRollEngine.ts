import * as THREE from 'three';
import {
  BALL_RADIUS,
  createInitialBallState,
  FIXED_DT,
  getObstaclePoseAtTime,
  getSegmentPoseAtTime,
  getSegmentWidthForDifficulty,
  getSurfaceYOnSegment,
  PhysicsEvent,
  queryShadowGroundY,
  SkyBallState,
  SkyInputState,
  stepSkyRollPhysics,
} from './physics';
import {
  createContactShadowTexture,
  createFruitBallTexture,
  createSkyGradientTexture,
} from './fruitBallTextures';
import {
  FruitSkinId,
  SKY_THEME_PALETTES,
  SkyLevelDef,
  SkyRollDifficulty,
} from './types';

export interface HudSnapshot {
  progress: number;
  coinsCollected: number;
  totalCoins: number;
  hearts: number;
  maxHearts: number;
  elapsedSec: number;
  isBubbleRescue: boolean;
  isBoosted: boolean;
}

export interface SkyRollEngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onEvent: (event: PhysicsEvent) => void;
  onWebGLContextLost?: () => void;
}

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

export class SkyRollEngine {
  private container: HTMLElement;
  private level: SkyLevelDef;
  private difficulty: SkyRollDifficulty;
  private skin: FruitSkinId;
  private callbacks: SkyRollEngineCallbacks;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private resizeObserver: ResizeObserver;

  private state: SkyBallState;
  private input: SkyInputState = { steerX: 0, throttle: 0, jumpRequested: false };

  private ballGroup: THREE.Group;
  private ballMesh: THREE.Mesh;
  private bubbleMesh: THREE.Mesh;
  private crownMesh: THREE.Group | null = null;
  private shadowMesh: THREE.Mesh;

  private segmentMeshes = new Map<string, THREE.Group>();
  private obstacleMeshes = new Map<string, THREE.Group>();
  private coinMeshes = new Map<string, THREE.Mesh>();
  private checkpointFlags = new Map<string, THREE.Mesh>();
  private clouds: { mesh: THREE.Group; speed: number }[] = [];
  private particles: Particle[] = [];
  private particleGeo: THREE.SphereGeometry;
  private particleMatCache = new Map<string, THREE.MeshBasicMaterial>();

  private disposables: { dispose: () => void }[] = [];

  private rafId = 0;
  private lastFrameMs = 0;
  private accumulator = 0;
  private hudTimer = 0;
  private paused = false;
  private disposed = false;

  private camPos = new THREE.Vector3(0, 7, 11);
  private camTarget = new THREE.Vector3(0, 1, -4);
  private rollAxis = new THREE.Vector3();
  private rollQuat = new THREE.Quaternion();

  private handleContextLost: (e: Event) => void;
  private handleContextRestored: () => void;

  constructor(
    container: HTMLElement,
    level: SkyLevelDef,
    difficulty: SkyRollDifficulty,
    skin: FruitSkinId,
    callbacks: SkyRollEngineCallbacks,
  ) {
    this.container = container;
    this.level = level;
    this.difficulty = difficulty;
    this.skin = skin;
    this.callbacks = callbacks;
    this.state = createInitialBallState(level, difficulty);

    const palette = SKY_THEME_PALETTES[level.theme];

    // 1. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // WebGL Context Loss Recovery
    this.handleContextLost = (e: Event) => {
      e.preventDefault();
      this.paused = true;
      this.callbacks.onWebGLContextLost?.();
    };
    this.handleContextRestored = () => {
      this.paused = false;
      this.lastFrameMs = performance.now();
    };
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.handleContextLost,
    );
    this.renderer.domElement.addEventListener(
      'webglcontextrestored',
      this.handleContextRestored,
    );

    // 2. Scene & Sky
    this.scene = new THREE.Scene();
    const skyTex = createSkyGradientTexture(palette.skyTop, palette.skyBottom);
    this.disposables.push(skyTex);
    this.scene.background = skyTex;
    this.scene.fog = new THREE.Fog(palette.fogColor, 38, 125);

    // 3. Responsive Dynamic-FOV Camera
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.2, 180);
    this.updateCameraProjection();

    // 4. Lighting (warm sunlit sky)
    const hemi = new THREE.HemisphereLight('#FFFFFF', '#FDE68A', 1.15);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight('#FFFBEB', 1.15);
    dir.position.set(16, 32, 18);
    this.scene.add(dir);
    const rim = new THREE.DirectionalLight('#BAE6FD', 0.45);
    rim.position.set(-14, 12, -20);
    this.scene.add(rim);

    // 5. Build World Geometry
    this.particleGeo = new THREE.SphereGeometry(0.14, 6, 6);
    this.disposables.push(this.particleGeo);
    this.buildClouds();
    this.buildTrack();
    this.buildObstacles();
    this.buildCoins();

    // 6. Build 3D Fruit Ball, Crown (King Durian), Bubble & Contact Shadow
    this.ballGroup = new THREE.Group();
    const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 28, 20);
    const ballTex = createFruitBallTexture(skin);
    const ballMat = new THREE.MeshStandardMaterial({
      map: ballTex,
      roughness: 0.32,
      metalness: 0.05,
    });
    this.disposables.push(ballGeo, ballTex, ballMat);
    this.ballMesh = new THREE.Mesh(ballGeo, ballMat);
    this.ballGroup.add(this.ballMesh);

    if (skin === 'durian') {
      this.crownMesh = this.buildMiniCrown();
      this.crownMesh.position.set(0, BALL_RADIUS + 0.14, 0);
      this.ballGroup.add(this.crownMesh);
    }

    // Translucent Rainbow Bubble for Kid Mode Rescue
    const bubbleGeo = new THREE.SphereGeometry(BALL_RADIUS * 1.48, 20, 16);
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: '#7DD3FC',
      emissive: '#38BDF8',
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.42,
      roughness: 0.1,
    });
    this.disposables.push(bubbleGeo, bubbleMat);
    this.bubbleMesh = new THREE.Mesh(bubbleGeo, bubbleMat);
    this.bubbleMesh.visible = false;
    this.ballGroup.add(this.bubbleMesh);

    this.ballGroup.position.set(this.state.x, this.state.y, this.state.z);
    this.scene.add(this.ballGroup);

    // Ground-projected Contact Shadow Blob
    const shadowGeo = new THREE.PlaneGeometry(BALL_RADIUS * 2.5, BALL_RADIUS * 2.5);
    const shadowTex = createContactShadowTexture();
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    this.disposables.push(shadowGeo, shadowTex, shadowMat);
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadowMesh);

    // 7. ResizeObserver for seamless Portrait <-> Landscape orientation switching
    this.resizeObserver = new ResizeObserver(() => {
      this.updateCameraProjection();
    });
    this.resizeObserver.observe(container);

    // 8. Initialize Camera & Start Loop
    this.camPos.set(this.state.x, this.state.y + 5.8, this.state.z + 9.2);
    this.camTarget.set(this.state.x, this.state.y + 0.6, this.state.z - 5.5);
    this.emitHud();
    this.lastFrameMs = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private buildMiniCrown(): THREE.Group {
    const group = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#FACC15',
      emissive: '#CA8A04',
      emissiveIntensity: 0.3,
      roughness: 0.25,
      metalness: 0.6,
    });
    const baseGeo = new THREE.CylinderGeometry(0.32, 0.26, 0.22, 8);
    const base = new THREE.Mesh(baseGeo, goldMat);
    group.add(base);
    const tipGeo = new THREE.ConeGeometry(0.08, 0.2, 5);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const tip = new THREE.Mesh(tipGeo, goldMat);
      tip.position.set(Math.cos(a) * 0.24, 0.17, Math.sin(a) * 0.24);
      group.add(tip);
    }
    this.disposables.push(goldMat, baseGeo, tipGeo);
    return group;
  }

  private buildClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      roughness: 0.9,
      transparent: true,
      opacity: 0.9,
    });
    const puffGeo = new THREE.SphereGeometry(1, 10, 8);
    this.disposables.push(cloudMat, puffGeo);

    for (let i = 0; i < 22; i++) {
      const group = new THREE.Group();
      const puffs = 3 + (i % 3);
      for (let p = 0; p < puffs; p++) {
        const m = new THREE.Mesh(puffGeo, cloudMat);
        const s = 1.6 + ((i + p) % 3) * 0.85;
        m.scale.set(s * 1.35, s * 0.75, s);
        m.position.set((p - (puffs - 1) / 2) * 1.7, (p % 2) * 0.4, 0);
        group.add(m);
      }
      const side = i % 2 === 0 ? -1 : 1;
      group.position.set(
        side * (12 + (i * 5) % 24),
        -4 - (i % 6) * 1.8,
        10 - i * 9.5,
      );
      this.scene.add(group);
      this.clouds.push({ mesh: group, speed: 0.35 + (i % 4) * 0.15 });
    }
  }

  private buildTrack() {
    const palette = SKY_THEME_PALETTES[this.level.theme];
    const edgeMat = new THREE.MeshStandardMaterial({
      color: palette.trackEdge,
      roughness: 0.65,
    });
    const boostMat = new THREE.MeshStandardMaterial({
      color: '#38BDF8',
      emissive: '#0284C7',
      emissiveIntensity: 0.6,
      roughness: 0.2,
    });
    const bounceMat = new THREE.MeshStandardMaterial({
      color: '#FACC15',
      emissive: '#F59E0B',
      emissiveIntensity: 0.55,
      roughness: 0.2,
    });
    const kidRailMat = new THREE.MeshStandardMaterial({
      color: '#7DD3FC',
      emissive: '#38BDF8',
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.52,
      roughness: 0.2,
    });
    this.disposables.push(edgeMat, boostMat, bounceMat, kidRailMat);

    for (const seg of this.level.segments) {
      const group = new THREE.Group();
      const width = getSegmentWidthForDifficulty(seg, this.difficulty);
      const dz = seg.zStart - seg.zEnd;
      const dy = seg.yEnd - seg.yStart;
      const length = Math.sqrt(dz * dz + dy * dy);
      const pitch = Math.atan2(dy, dz); // +pitch tilts front (-Z) upward

      const thickness = 0.7;
      const deckColor =
        seg.kind === 'finish'
          ? '#FEF08A'
          : seg.kind === 'moving'
          ? '#67E8F9'
          : seg.color || palette.trackMain;

      const deckGeo = new THREE.BoxGeometry(width, thickness, length);
      const deckMat = new THREE.MeshStandardMaterial({
        color: deckColor,
        roughness: 0.55,
      });
      this.disposables.push(deckGeo, deckMat);

      const deckPivot = new THREE.Group();
      const deckMesh = new THREE.Mesh(deckGeo, deckMat);
      deckMesh.position.set(0, -thickness * 0.5, 0);
      deckPivot.add(deckMesh);

      // Decorative side trim rails
      const trimGeo = new THREE.BoxGeometry(0.24, thickness + 0.12, length);
      this.disposables.push(trimGeo);
      [-1, 1].forEach((side) => {
        const trim = new THREE.Mesh(trimGeo, edgeMat);
        trim.position.set(side * (width * 0.5 - 0.1), -thickness * 0.45, 0);
        deckPivot.add(trim);
      });

      // Kid Mode translucent soft guardrails
      if (this.difficulty === 'KID' && !seg.noGuardrails && seg.kind !== 'finish') {
        const railGeo = new THREE.BoxGeometry(0.18, 0.55, length);
        this.disposables.push(railGeo);
        [-1, 1].forEach((side) => {
          const rail = new THREE.Mesh(railGeo, kidRailMat);
          rail.position.set(side * (width * 0.5 - 0.12), 0.28, 0);
          deckPivot.add(rail);
        });
      }

      // Apply ramp tilt around X axis
      deckPivot.rotation.x = pitch;
      group.add(deckPivot);

      // Speed Boost Strip
      if (seg.boostAtZ !== undefined) {
        const localZ = seg.boostAtZ - (seg.zStart + seg.zEnd) * 0.5;
        const surfaceY =
          getSurfaceYOnSegment(seg, seg.boostAtZ, seg.zStart, seg.zEnd) -
          (seg.yStart + seg.yEnd) * 0.5;
        const padGeo = new THREE.BoxGeometry(Math.min(width * 0.6, 2.8), 0.1, 2.8);
        this.disposables.push(padGeo);
        const pad = new THREE.Mesh(padGeo, boostMat);
        pad.position.set(0, surfaceY + 0.06, localZ);
        pad.rotation.x = pitch;
        group.add(pad);
      }

      // Bounce Pad (explicit or Kid Mode auto-bounce before gap)
      const bounceZ =
        seg.bouncePadAtZ !== undefined
          ? seg.bouncePadAtZ
          : this.difficulty === 'KID'
          ? seg.kidAutoBounceAtZ
          : undefined;
      if (bounceZ !== undefined) {
        const localZ = bounceZ - (seg.zStart + seg.zEnd) * 0.5;
        const surfaceY =
          getSurfaceYOnSegment(seg, bounceZ, seg.zStart, seg.zEnd) -
          (seg.yStart + seg.yEnd) * 0.5;
        const padGeo = new THREE.CylinderGeometry(
          Math.min(width * 0.36, 1.5),
          Math.min(width * 0.4, 1.65),
          0.22,
          16,
        );
        this.disposables.push(padGeo);
        const pad = new THREE.Mesh(padGeo, bounceMat);
        pad.position.set(0, surfaceY + 0.11, localZ);
        group.add(pad);
      }

      // Mid-Course Checkpoint Gate
      if (seg.checkpointAtZ !== undefined) {
        const localZ = seg.checkpointAtZ - (seg.zStart + seg.zEnd) * 0.5;
        const surfaceY =
          getSurfaceYOnSegment(seg, seg.checkpointAtZ, seg.zStart, seg.zEnd) -
          (seg.yStart + seg.yEnd) * 0.5;
        const poleGeo = new THREE.CylinderGeometry(0.14, 0.14, 3.2, 8);
        const poleMat = new THREE.MeshStandardMaterial({ color: '#FFFBEB' });
        const bannerGeo = new THREE.BoxGeometry(width * 0.85, 0.65, 0.18);
        const bannerMat = new THREE.MeshStandardMaterial({
          color: '#F59E0B',
          emissive: '#B45309',
          emissiveIntensity: 0.3,
        });
        this.disposables.push(poleGeo, poleMat, bannerGeo, bannerMat);

        [-1, 1].forEach((side) => {
          const pole = new THREE.Mesh(poleGeo, poleMat);
          pole.position.set(
            side * (width * 0.44),
            surfaceY + 1.6,
            localZ,
          );
          group.add(pole);
        });
        const banner = new THREE.Mesh(bannerGeo, bannerMat);
        banner.position.set(0, surfaceY + 3.0, localZ);
        group.add(banner);
        this.checkpointFlags.set(seg.id, banner);
      }

      // Grand Finish Arch on finish segment
      if (seg.kind === 'finish') {
        const localZ = this.level.finishZ - (seg.zStart + seg.zEnd) * 0.5;
        const pillarGeo = new THREE.CylinderGeometry(0.32, 0.38, 4.8, 12);
        const pillarMat = new THREE.MeshStandardMaterial({
          color: '#F59E0B',
          metalness: 0.3,
          roughness: 0.3,
        });
        const archGeo = new THREE.BoxGeometry(width * 0.92, 1.0, 0.45);
        const archMat = new THREE.MeshStandardMaterial({
          color: '#10B981',
          emissive: '#059669',
          emissiveIntensity: 0.35,
        });
        this.disposables.push(pillarGeo, pillarMat, archGeo, archMat);

        [-1, 1].forEach((side) => {
          const p = new THREE.Mesh(pillarGeo, pillarMat);
          p.position.set(side * (width * 0.44), 2.4, localZ);
          group.add(p);
        });
        const arch = new THREE.Mesh(archGeo, archMat);
        arch.position.set(0, 4.7, localZ);
        group.add(arch);
      }

      group.position.set(
        seg.x,
        (seg.yStart + seg.yEnd) * 0.5,
        (seg.zStart + seg.zEnd) * 0.5,
      );
      this.scene.add(group);
      this.segmentMeshes.set(seg.id, group);
    }
  }

  private buildObstacles() {
    const sliderMat = new THREE.MeshStandardMaterial({
      color: '#EF4444',
      roughness: 0.35,
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: '#FEF3C7',
      roughness: 0.4,
    });
    const bumperMat = new THREE.MeshStandardMaterial({
      color: '#EC4899',
      emissive: '#BE185D',
      emissiveIntensity: 0.2,
      roughness: 0.3,
    });
    const windmillMat = new THREE.MeshStandardMaterial({
      color: '#F97316',
      emissive: '#C2410C',
      emissiveIntensity: 0.18,
      roughness: 0.35,
    });
    this.disposables.push(sliderMat, stripeMat, bumperMat, windmillMat);

    for (const obs of this.level.obstacles) {
      const group = new THREE.Group();
      if (obs.kind === 'slider') {
        const bodyGeo = new THREE.BoxGeometry(obs.size, obs.height, 0.85);
        const capGeo = new THREE.BoxGeometry(obs.size * 0.9, 0.25, 0.9);
        this.disposables.push(bodyGeo, capGeo);
        const body = new THREE.Mesh(bodyGeo, sliderMat);
        body.position.y = obs.height * 0.5;
        const cap = new THREE.Mesh(capGeo, stripeMat);
        cap.position.y = obs.height + 0.08;
        group.add(body, cap);
      } else if (obs.kind === 'bumper') {
        const cylGeo = new THREE.CylinderGeometry(
          obs.range,
          obs.range * 1.08,
          obs.height,
          16,
        );
        const topGeo = new THREE.SphereGeometry(obs.range * 0.92, 14, 10);
        this.disposables.push(cylGeo, topGeo);
        const cyl = new THREE.Mesh(cylGeo, bumperMat);
        cyl.position.y = obs.height * 0.5;
        const top = new THREE.Mesh(topGeo, stripeMat);
        top.position.y = obs.height;
        group.add(cyl, top);
      } else if (obs.kind === 'windmill') {
        const hubGeo = new THREE.CylinderGeometry(0.42, 0.5, 1.3, 12);
        const armGeo = new THREE.BoxGeometry(obs.size, obs.height * 0.65, 0.62);
        this.disposables.push(hubGeo, armGeo);
        const hub = new THREE.Mesh(hubGeo, stripeMat);
        hub.position.y = 0.65;
        const arm = new THREE.Mesh(armGeo, windmillMat);
        arm.position.y = 0.55;
        group.add(hub, arm);
      }
      group.position.set(obs.x, obs.y, obs.z);
      this.scene.add(group);
      this.obstacleMeshes.set(obs.id, group);
    }
  }

  private buildCoins() {
    const coinGeo = new THREE.OctahedronGeometry(0.46, 0);
    const coinMat = new THREE.MeshStandardMaterial({
      color: '#FACC15',
      emissive: '#F59E0B',
      emissiveIntensity: 0.45,
      metalness: 0.55,
      roughness: 0.2,
    });
    this.disposables.push(coinGeo, coinMat);

    for (const coin of this.level.coins) {
      const m = new THREE.Mesh(coinGeo, coinMat);
      m.position.set(coin.x, coin.y, coin.z);
      this.scene.add(m);
      this.coinMeshes.set(coin.id, m);
    }
  }

  private spawnBurst(x: number, y: number, z: number, colorHex: string, count = 10) {
    let mat = this.particleMatCache.get(colorHex);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ color: colorHex });
      this.particleMatCache.set(colorHex, mat);
      this.disposables.push(mat);
    }
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.particleGeo, mat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const spd = 2.4 + Math.random() * 3.8;
      this.particles.push({
        mesh,
        vx: Math.cos(a) * spd,
        vy: 3.0 + Math.random() * 4.2,
        vz: Math.sin(a) * spd,
        life: 0.55,
        maxLife: 0.55,
      });
    }
  }

  /**
   * Constant-Horizontal-FOV camera projection so Portrait (9:19.5) and
   * Landscape (16:9) both frame the full track width cleanly.
   */
  private updateCameraProjection() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    const aspect = w / h;
    const targetHorizontalFovRad = THREE.MathUtils.degToRad(68);
    const vFovRad =
      2 * Math.atan(Math.tan(targetHorizontalFovRad * 0.5) / Math.max(0.45, aspect));
    const vFovDeg = THREE.MathUtils.clamp(
      THREE.MathUtils.radToDeg(vFovRad),
      52,
      86,
    );

    this.camera.fov = vFovDeg;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  public setInput(steerX: number, throttle: number) {
    this.input.steerX = Math.max(-1, Math.min(1, steerX));
    this.input.throttle = Math.max(-1, Math.min(1, throttle));
  }

  public requestJump() {
    this.input.jumpRequested = true;
  }

  public setPaused(paused: boolean) {
    this.paused = paused;
    if (!paused) {
      this.lastFrameMs = performance.now();
    }
  }

  public getCollectedCoinCount(): number {
    return this.state.collectedCoins.size;
  }

  private emitHud() {
    this.callbacks.onHudUpdate({
      progress: this.state.progress,
      coinsCollected: this.state.collectedCoins.size,
      totalCoins: this.level.coins.length,
      hearts: this.state.hearts,
      maxHearts: this.state.maxHearts,
      elapsedSec: this.state.elapsedSec,
      isBubbleRescue: this.state.bubbleRescueTimer > 0,
      isBoosted: this.state.boostTimer > 0,
    });
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);

    const frameDt = Math.min(0.05, Math.max(0, (now - this.lastFrameMs) / 1000));
    this.lastFrameMs = now;

    if (!this.paused) {
      this.accumulator += frameDt;
      let steps = 0;
      while (this.accumulator >= FIXED_DT && steps < 5) {
        const prevX = this.state.x;
        const prevZ = this.state.z;
        const events = stepSkyRollPhysics(
          this.state,
          this.level,
          this.difficulty,
          this.input,
          FIXED_DT,
        );
        this.accumulator -= FIXED_DT;
        steps++;

        // Apply true rolling quaternion synced to travel displacement
        const dx = this.state.x - prevX;
        const dz = this.state.z - prevZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 0.0001 && this.state.bubbleRescueTimer <= 0) {
          // Axis perpendicular to velocity on XZ plane: up(0,1,0) x vel(dx,0,dz) = (dz, 0, -dx)
          this.rollAxis.set(dz / dist, 0, -dx / dist);
          this.rollQuat.setFromAxisAngle(this.rollAxis, dist / BALL_RADIUS);
          this.ballMesh.quaternion.premultiply(this.rollQuat);
        }

        for (const ev of events) {
          this.handlePhysicsEvent(ev);
        }
      }

      this.syncVisuals(frameDt);
      this.hudTimer += frameDt;
      if (this.hudTimer >= 0.08) {
        this.hudTimer = 0;
        this.emitHud();
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  private handlePhysicsEvent(ev: PhysicsEvent) {
    if (ev.type === 'COIN') {
      const mesh = this.coinMeshes.get(ev.coinId);
      if (mesh) mesh.visible = false;
      this.spawnBurst(ev.x, ev.y, ev.z, '#FACC15', 8);
    } else if (ev.type === 'JUMP') {
      this.spawnBurst(this.state.x, this.state.y - 0.5, this.state.z, '#FFFFFF', 6);
    } else if (ev.type === 'BOUNCE_PAD') {
      this.spawnBurst(ev.x, ev.y, ev.z, '#FDE047', 12);
    } else if (ev.type === 'BOOST') {
      this.spawnBurst(ev.x, ev.y, ev.z, '#38BDF8', 10);
    } else if (ev.type === 'CHECKPOINT') {
      for (const seg of this.level.segments) {
        if (this.state.activatedCheckpoints.has(seg.id)) {
          const flag = this.checkpointFlags.get(seg.id);
          if (flag) {
            (flag.material as THREE.MeshStandardMaterial).color.set('#10B981');
            (flag.material as THREE.MeshStandardMaterial).emissive.set('#059669');
          }
        }
      }
      this.spawnBurst(ev.x, ev.y + 1.5, ev.z, '#34D399', 16);
    } else if (ev.type === 'BUBBLE_RESCUE') {
      this.spawnBurst(this.state.x, this.state.y, this.state.z, '#7DD3FC', 12);
    } else if (ev.type === 'VICTORY') {
      this.spawnBurst(this.state.x, this.state.y + 1.2, this.state.z, '#FACC15', 22);
      this.spawnBurst(this.state.x, this.state.y + 1.8, this.state.z, '#34D399', 18);
      this.emitHud();
    } else if (ev.type === 'GAME_OVER' || ev.type === 'HEART_LOST') {
      this.emitHud();
    }

    this.callbacks.onEvent(ev);
  }

  private syncVisuals(dt: number) {
    const t = this.state.time;

    // 1. Ball & Bubble & Crown
    this.ballGroup.position.set(this.state.x, this.state.y, this.state.z);
    this.bubbleMesh.visible = this.state.bubbleRescueTimer > 0;
    if (this.bubbleMesh.visible) {
      const pulse = 1 + Math.sin(t * 14) * 0.06;
      this.bubbleMesh.scale.setScalar(pulse);
    }
    if (this.crownMesh) {
      this.crownMesh.rotation.y = t * 1.8;
    }

    // 2. Contact Shadow Blob
    const shadowY = queryShadowGroundY(
      this.level,
      this.difficulty,
      t,
      this.state.x,
      this.state.y,
      this.state.z,
    );
    if (shadowY !== null && this.state.bubbleRescueTimer <= 0) {
      const heightAbove = Math.max(0, this.state.y - BALL_RADIUS - shadowY);
      const scale = Math.max(0.35, 1 - heightAbove * 0.12);
      this.shadowMesh.visible = true;
      this.shadowMesh.position.set(this.state.x, shadowY + 0.03, this.state.z);
      this.shadowMesh.scale.setScalar(scale);
      (this.shadowMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0.12,
        0.65 - heightAbove * 0.1,
      );
    } else {
      this.shadowMesh.visible = false;
    }

    // 3. Moving Platforms
    for (const seg of this.level.segments) {
      if (!seg.moveAxis) continue;
      const mesh = this.segmentMeshes.get(seg.id);
      if (!mesh) continue;
      const pose = getSegmentPoseAtTime(seg, t, this.difficulty);
      mesh.position.x = pose.x;
      mesh.position.z = (pose.zStart + pose.zEnd) * 0.5;
    }

    // 4. Obstacles
    for (const obs of this.level.obstacles) {
      const mesh = this.obstacleMeshes.get(obs.id);
      if (!mesh) continue;
      const pose = getObstaclePoseAtTime(obs, t, this.difficulty);
      mesh.position.set(pose.x, pose.y, pose.z);
      mesh.rotation.y = pose.angleY;
    }

    // 5. Spinning Coins
    for (const coin of this.level.coins) {
      const mesh = this.coinMeshes.get(coin.id);
      if (!mesh || !mesh.visible) continue;
      mesh.rotation.y = t * 2.8 + coin.z * 0.3;
      mesh.position.y = coin.y + Math.sin(t * 3.5 + coin.z) * 0.14;
    }

    // 6. Drifting Clouds
    for (const c of this.clouds) {
      c.mesh.position.x += c.speed * dt;
      if (c.mesh.position.x > 38) c.mesh.position.x = -38;
    }

    // 7. Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= 14 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.scale.setScalar(Math.max(0.01, p.life / p.maxLife));
    }

    // 8. Smooth Chase Camera (adapts height slightly for Portrait vs Landscape)
    const isPortrait = this.camera.aspect < 0.85;
    const camHeight = isPortrait ? 6.6 : 5.2;
    const camBack = isPortrait ? 9.8 : 8.4;
    const boostPull = this.state.boostTimer > 0 ? 1.2 : 0;

    const desiredX = this.state.x * 0.72;
    const desiredY = Math.max(this.state.minTrackY + 2.5, this.state.y + camHeight);
    const desiredZ = this.state.z + camBack + boostPull;

    const lerpRate = 1 - Math.exp(-7.5 * dt);
    this.camPos.x += (desiredX - this.camPos.x) * lerpRate;
    this.camPos.y += (desiredY - this.camPos.y) * lerpRate;
    this.camPos.z += (desiredZ - this.camPos.z) * lerpRate;

    this.camTarget.x += (this.state.x * 0.85 - this.camTarget.x) * lerpRate;
    this.camTarget.y += (this.state.y + 0.5 - this.camTarget.y) * lerpRate;
    this.camTarget.z += (this.state.z - 5.5 - this.camTarget.z) * lerpRate;

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener(
      'webglcontextlost',
      this.handleContextLost,
    );
    this.renderer.domElement.removeEventListener(
      'webglcontextrestored',
      this.handleContextRestored,
    );

    for (const d of this.disposables) {
      try {
        d.dispose();
      } catch {}
    }
    this.disposables = [];
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
