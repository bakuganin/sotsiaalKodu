import {
  AgXToneMapping,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import type { BlenderHouseModel } from "./loadBlenderHouse";

export interface HeroSceneController {
  resize: () => void;
  setBackground: (color: string, gutter: string, split: boolean) => void;
  point: (x: number, y: number) => void;
  reset: () => void;
  setReducedMotion: (reduced: boolean) => void;
  setActive: (active: boolean) => void;
  replay: () => void;
  dispose: () => void;
}

interface SceneOptions {
  reducedMotion: boolean;
  onReady: () => void;
  onError: () => void;
}

const REST_YAW = 0.38;
const REST_PITCH = 0.025;

export function createHeroScene(
  host: HTMLElement,
  options: SceneOptions,
  model: BlenderHouseModel,
): HeroSceneController {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2", {
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  if (!context) throw new Error("WebGL2 unavailable");

  const renderer = new WebGLRenderer({
    canvas,
    context,
    alpha: true,
    antialias: true,
  });
  renderer.debug.onShaderError = (gl, _program, _vertex, fragment) => {
    // A failed GPU shader must restore the original artwork, never a blank canvas.
    throw new Error(
      gl.getShaderInfoLog(fragment) || "Hero glass shader failed",
    );
  };
  const resources: (() => void)[] = [
    () => canvas.remove(),
    () => {
      renderer.dispose();
      renderer.forceContextLoss();
    },
    model.dispose,
  ];
  const disposeResources = () => {
    resources
      .splice(0)
      .reverse()
      .forEach((dispose) => {
        try {
          dispose();
        } catch {
          /* Continue releasing the remaining resources. */
        }
      });
  };
  try {
    renderer.setClearColor(0xefefed, 0);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = AgXToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.transmissionResolutionScale = 0.75;
    canvas.setAttribute("aria-hidden", "true");
    host.append(canvas);

    const scene = new Scene();
    scene.background = new Color(0xefefed);
    const camera = new OrthographicCamera(-2.2, 2.2, 2.2, -2.2, 0.1, 40);
    camera.position.set(0, 3, 8);
    camera.lookAt(0, 1.72, 0);

    const pmrem = new PMREMGenerator(renderer);
    resources.push(() => pmrem.dispose());
    if (model.environment) {
      const environment = pmrem.fromEquirectangular(model.environment);
      resources.push(() => environment.dispose());
      scene.environment = environment.texture;
    } else {
      const environmentScene = new Scene();
      environmentScene.background = new Color(0x68754b);
      const studioPanels: Mesh<PlaneGeometry, MeshBasicMaterial>[] = [];
      const addStudioPanel = (
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
        intensity: number,
      ) => {
        const panel = new Mesh(
          new PlaneGeometry(width, height),
          new MeshBasicMaterial({
            color: new Color().setRGB(intensity, intensity, intensity),
          }),
        );
        panel.position.set(x, y, z);
        panel.lookAt(0, 1.5, 0);
        environmentScene.add(panel);
        studioPanels.push(panel);
      };
      addStudioPanel(-3.5, 6.5, 4, 5.5, 6, 12);
      addStudioPanel(4, 2.6, 6, 2.7, 4, 1.5);
      addStudioPanel(5, 3, 2, 1.8, 5, 4);
      addStudioPanel(0, 7, -2, 5, 3, 5);
      addStudioPanel(-4, 3.5, -5, 2.5, 4, 3);
      addStudioPanel(0, -3, 3, 6, 1.5, 2);
      resources.push(() =>
        studioPanels.forEach((panel) => {
          panel.geometry.dispose();
          panel.material.dispose();
        }),
      );
      const environment = pmrem.fromScene(environmentScene, 0.05, 0.1, 100, {
        position: new Vector3(0, 1.5, 0),
      });
      resources.push(() => environment.dispose());
      scene.environment = environment.texture;
      studioPanels.forEach((panel) => {
        panel.geometry.dispose();
        panel.material.dispose();
      });
    }
    scene.environmentIntensity = 1;
    // Explicit assignment lets Three respect each material's environment intensity
    // instead of replacing it with scene.environmentIntensity on every draw.
    model.group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material) => {
        if (material instanceof MeshStandardMaterial)
          material.envMap = scene.environment;
      });
    });
    pmrem.dispose();

    // The Blender panorama already includes the studio's diffuse and specular light.
    // Extra fill lights here would wash out the authored leaf and stone textures.
    if (!model.environment) {
      scene.add(new HemisphereLight(0xfffdf1, 0x718253, 0.8));
      const key = new DirectionalLight(0xfff9df, 1.8);
      key.position.set(-3, 5, 5);
      scene.add(key);
      const rim = new DirectionalLight(0xffffff, 1.5);
      rim.position.set(4, 3, -2);
      scene.add(rim);
    }

    // Match the existing book gutter behind the glass so transmission refracts it.
    const spineGeometry = new PlaneGeometry(1, 12);
    const spineMaterial = new MeshBasicMaterial({
      color: 0x080908,
      toneMapped: false,
    });
    const spine = new Mesh(spineGeometry, spineMaterial);
    spine.position.set(0, 1.72, -3);
    spine.rotation.copy(camera.rotation);
    scene.add(spine);
    resources.push(() => {
      spineGeometry.dispose();
      spineMaterial.dispose();
    });

    const pivot = new Group();
    pivot.position.y = 1.7;
    model.group.position.y = -1.7;
    pivot.add(model.group);
    scene.add(pivot);

    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = shadowCanvas.height = 128;
    const shadowContext = shadowCanvas.getContext("2d")!;
    const gradient = shadowContext.createRadialGradient(64, 64, 5, 64, 64, 63);
    gradient.addColorStop(0, "rgba(39,51,22,0.2)");
    gradient.addColorStop(0.45, "rgba(39,51,22,0.08)");
    gradient.addColorStop(1, "rgba(39,51,22,0)");
    shadowContext.fillStyle = gradient;
    shadowContext.fillRect(0, 0, 128, 128);
    const shadowTexture = new CanvasTexture(shadowCanvas);
    const shadowGeometry = new PlaneGeometry(4, 1.7);
    const shadowMaterial = new MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    resources.push(() => {
      shadowGeometry.dispose();
      shadowMaterial.dispose();
      shadowTexture.dispose();
    });
    const shadow = new Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.08;
    scene.add(shadow);

    let disposed = false;
    let active = true;
    let pausedAt: number | null = null;
    let reduced = options.reducedMotion;
    let frame: number | undefined;
    let previousTime = 0;
    let introStart: number | null = null;
    let ready = false;
    let yaw = REST_YAW;
    let pitch = REST_PITCH;
    let targetYaw = yaw;
    let targetPitch = pitch;
    const diagnosticHost = host.parentElement!;
    diagnosticHost.dataset.sceneSource = "blender";
    let sceneWidth = host.clientWidth;
    const updateResolution = (settled: boolean) => {
      const maximum = settled ? (sceneWidth < 380 ? 1.4 : 1.75) : 1.25;
      const minimum = settled ? 1.5 : 1;
      const ratio = Math.min(
        Math.max(window.devicePixelRatio || 1, minimum),
        maximum,
      );
      if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
    };

    const cancelFrame = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      previousTime = 0;
    };

    const draw = (now: number) => {
      frame = undefined;
      if (disposed || !active) return;
      const elapsed = previousTime
        ? Math.min((now - previousTime) / 1000, 0.15)
        : 1 / 60;
      previousTime = now;
      const smoothing = 1 - Math.exp(-9 * elapsed);
      yaw += (targetYaw - yaw) * smoothing;
      pitch += (targetPitch - pitch) * smoothing;
      const progress =
        !ready && !reduced
          ? 0
          : introStart === null
            ? 1
            : Math.min(1, (now - introStart) / model.revealDuration);
      model.reveal(progress);
      if (progress === 1) introStart = null;
      pivot.rotation.set(pitch, yaw, 0);
      shadowMaterial.opacity = 0.35 + progress * 0.65;
      diagnosticHost.dataset.sceneYaw = yaw.toFixed(4);
      diagnosticHost.dataset.scenePitch = pitch.toFixed(4);
      diagnosticHost.dataset.sceneRevealed = progress === 1 ? "true" : "false";
      try {
        updateResolution(
          progress === 1 &&
            Math.abs(targetYaw - yaw) < 0.00003 &&
            Math.abs(targetPitch - pitch) < 0.00003,
        );
        model.prepare(renderer, scene, camera);
        renderer.render(scene, camera);
        if (!ready) {
          ready = true;
          // Shader compilation must not consume the reveal before it is visible.
          if (!reduced) introStart = performance.now();
          options.onReady();
        }
      } catch {
        cancelFrame();
        active = false;
        options.onError();
        return;
      }
      if (
        introStart !== null ||
        Math.abs(targetYaw - yaw) > 0.00003 ||
        Math.abs(targetPitch - pitch) > 0.00003
      )
        frame = requestAnimationFrame(draw);
      else previousTime = 0;
    };

    const requestDraw = () => {
      if (!disposed && active && frame === undefined)
        frame = requestAnimationFrame(draw);
    };
    const reset = () => {
      targetYaw = REST_YAW;
      targetPitch = REST_PITCH;
      requestDraw();
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      cancelFrame();
      active = false;
      options.onError();
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    resources.push(() =>
      canvas.removeEventListener("webglcontextlost", onContextLost),
    );

    const resize = () => {
      if (disposed) return;
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      sceneWidth = width;
      updateResolution(reduced);
      renderer.setSize(width, height, false);
      const aspect = width / height;
      const halfHeight = Math.max(2.05, 1.85 / aspect);
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      spine.scale.x = ((camera.right - camera.left) * 2) / width;
      requestDraw();
    };
    resize();

    return {
      resize,
      setBackground(color, gutter, split) {
        (scene.background as Color).set(color);
        spineMaterial.color.set(gutter);
        spine.visible = split;
        requestDraw();
      },
      point(x, y) {
        if (reduced) return;
        targetYaw = REST_YAW + Math.max(-1, Math.min(1, x)) * 0.21;
        targetPitch = REST_PITCH + Math.max(-1, Math.min(1, y)) * 0.105;
        requestDraw();
      },
      reset,
      setReducedMotion(value) {
        reduced = value;
        if (value) {
          introStart = null;
          yaw = targetYaw = REST_YAW;
          pitch = targetPitch = REST_PITCH;
        }
        requestDraw();
      },
      setActive(value) {
        if (active === value) return;
        active = value;
        if (value) {
          if (pausedAt !== null && introStart !== null)
            introStart += performance.now() - pausedAt;
          pausedAt = null;
          requestDraw();
        } else {
          pausedAt = performance.now();
          cancelFrame();
        }
      },
      replay() {
        if (reduced) return;
        introStart = performance.now();
        reset();
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        cancelFrame();
        disposeResources();
      },
    };
  } catch (error) {
    disposeResources();
    throw error;
  }
}
