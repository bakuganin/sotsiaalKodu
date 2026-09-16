import {
  AnimationMixer,
  EquirectangularReflectionMapping,
  Group,
  LoopOnce,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  Quaternion,
  Texture,
  Vector3,
  type BufferGeometry,
  type DataTexture,
  type Material,
  type Object3D,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { createRasterGlass } from "./createRasterGlass";

export interface BlenderHouseModel {
  group: Group;
  environment: DataTexture | null;
  revealDuration: number;
  reveal: (progress: number) => void;
  prepare: (renderer: WebGLRenderer, scene: Scene, camera: Camera) => void;
  dispose: () => void;
}

const MODEL_URL = "/models/calm-home.glb";
const STUDIO_URL = "/models/calm-home-studio.hdr";
const smooth = (value: number) => {
  const t = MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

async function fetchBytes(url: string, signal: AbortSignal, timeout: number) {
  signal.throwIfAborted();
  const request = new AbortController();
  const abort = () => request.abort(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  const timer = window.setTimeout(() => request.abort(), timeout);
  try {
    const response = await fetch(url, { signal: request.signal });
    if (!response.ok)
      throw new Error(`Hero asset unavailable: ${response.status}`);
    return await response.arrayBuffer();
  } finally {
    window.clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}

function disposeScene(scene: Object3D) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const bitmaps = new Set<ImageBitmap>();
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    objectMaterials.forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (!(value instanceof Texture)) return;
        textures.add(value);
        if (
          typeof ImageBitmap !== "undefined" &&
          value.source.data instanceof ImageBitmap
        )
          bitmaps.add(value.source.data);
      });
    });
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  bitmaps.forEach((bitmap) => bitmap.close());
}

async function loadStudio(signal: AbortSignal): Promise<DataTexture | null> {
  try {
    const bytes = await fetchBytes(STUDIO_URL, signal, 3_000);
    signal.throwIfAborted();
    const texture = new HDRLoader().createDataTexture(bytes);
    texture.mapping = EquirectangularReflectionMapping;
    texture.name = "Blender hero studio";
    return texture;
  } catch {
    // The model remains usable with the local studio if this optional asset fails.
    return null;
  }
}

function adaptModel(
  gltf: GLTF,
  environment: DataTexture | null,
): BlenderHouseModel {
  const group = gltf.scene;
  const hinge = group.getObjectByName("House_Root");
  const glass = group.getObjectByName("House_Glass");
  const plant = group.getObjectByName("Plant_Root");
  if (!hinge || !glass || !plant)
    throw new Error("Blender hero is missing its named model parts");

  // Cycles accounts for the enclosing glass when lighting the plant. The web
  // environment has no such occlusion, so reduce its contribution to opaque parts.
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    materials.forEach((material) => {
      if (
        "envMapIntensity" in material &&
        !(material instanceof MeshPhysicalMaterial && material.transmission > 0)
      )
        material.envMapIntensity = 0.35;
    });
  });

  const glassSurfaces = [glass, group.getObjectByName("Roof_Glass")]
    .filter(
      (object): object is Mesh =>
        object instanceof Mesh &&
        object.material instanceof MeshPhysicalMaterial,
    )
    .map((mesh) => {
      const source = mesh.material as MeshPhysicalMaterial;
      const optics = createRasterGlass(mesh.geometry);
      // Keep the authored material values; only replace the constant-thickness
      // approximation with the actual exported front and rear surfaces.
      optics.material.copy(source);
      mesh.material = optics.material;
      return { mesh, source, optics };
    });
  let supportsRearSurface: boolean | undefined;

  const restingHinge = hinge.quaternion.clone();
  const restingPlantScale = plant.scale.clone();
  const leaves = ["Leaf_Left", "Leaf_Right", "Leaf_Top"]
    .map((name) => group.getObjectByName(name))
    .filter((object): object is Object3D => Boolean(object))
    .map((object, index) => ({
      object,
      rotation: object.quaternion.clone(),
      scale: object.scale.clone(),
      phase: index * 0.045,
    }));
  const fold = new Quaternion();
  const foldAxis = new Vector3(1, 0, 0);
  const growthScale = new Vector3();
  const clip = gltf.animations.find((animation) => animation.name === "Reveal");
  const mixer = clip ? new AnimationMixer(group) : null;
  const action = clip && mixer ? mixer.clipAction(clip) : null;
  if (action) {
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
  }

  const reveal = (progress: number) => {
    const p = MathUtils.clamp(progress, 0, 1);
    if (clip && action && mixer) {
      action.reset().play();
      mixer.setTime(p * clip.duration);
      return;
    }

    // Blender exports the finished pose. Animate named pivots without reshaping it.
    fold.setFromAxisAngle(foldAxis, -(1 - smooth(p / 0.8)) * Math.PI * 0.465);
    hinge.quaternion.copy(restingHinge).multiply(fold);
    const growth = smooth((p - 0.2) / 0.8);
    growthScale.set(
      0.72 + growth * 0.28,
      0.035 + growth * 0.965,
      0.72 + growth * 0.28,
    );
    plant.scale.copy(restingPlantScale).multiply(growthScale);
    leaves.forEach(({ object, rotation, scale, phase }) => {
      const unfurl = smooth((p - 0.27 - phase) / (0.73 - phase));
      fold.setFromAxisAngle(foldAxis, (1 - unfurl) * 1.38);
      object.quaternion.copy(rotation).multiply(fold);
      object.scale.copy(scale);
      object.scale.x *= 0.12 + unfurl * 0.88;
    });
  };
  reveal(1);

  let disposed = false;
  return {
    group,
    environment,
    revealDuration: clip ? clip.duration * 1000 : 1500,
    reveal,
    prepare(renderer, scene, camera) {
      supportsRearSurface ??=
        renderer.extensions.has("EXT_color_buffer_float") ||
        renderer.extensions.has("EXT_color_buffer_half_float");
      glassSurfaces.forEach(({ mesh, source, optics }) => {
        if (!supportsRearSurface) {
          source.envMap = scene.environment;
          mesh.material = source;
        } else optics.prepare(renderer, scene, camera, mesh);
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mixer?.stopAllAction();
      mixer?.uncacheRoot(group);
      disposeScene(group);
      glassSurfaces.forEach(({ optics }) => optics.dispose());
      new Set(glassSurfaces.map(({ source }) => source)).forEach((material) =>
        material.dispose(),
      );
      environment?.dispose();
    },
  };
}

/** Load the authored Blender model before allocating a WebGL context. */
export async function loadBlenderHouse(
  signal: AbortSignal,
): Promise<BlenderHouseModel> {
  signal.throwIfAborted();
  const modelTask = fetchBytes(MODEL_URL, signal, 10_000).then(
    async (bytes) => {
      const gltf = await new GLTFLoader().parseAsync(bytes, "/models/");
      if (signal.aborted) {
        disposeScene(gltf.scene);
        signal.throwIfAborted();
      }
      return gltf;
    },
  );
  const [modelResult, studioResult] = await Promise.allSettled([
    modelTask,
    loadStudio(signal),
  ]);
  const environment =
    studioResult.status === "fulfilled" ? studioResult.value : null;
  if (modelResult.status === "rejected") {
    environment?.dispose();
    throw modelResult.reason;
  }
  try {
    signal.throwIfAborted();
    return adaptModel(modelResult.value, environment);
  } catch (error) {
    disposeScene(modelResult.value.scene);
    environment?.dispose();
    throw error;
  }
}
