import * as THREE from "three";
import { createHouseGeometry } from "./createHouseGeometry";
import { createRasterGlass } from "./createRasterGlass";

export interface HouseModel {
  group: THREE.Group;
  reveal: (progress: number) => void;
  prepare: (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => void;
  dispose: () => void;
}

const clamp01 = (value: number) => THREE.MathUtils.clamp(value, 0, 1);
const smooth = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const fract = (value: number) => value - Math.floor(value);
const hash = (x: number, y: number, seed: number) =>
  fract(Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453);

function noise(x: number, y: number, seed: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(hash(ix, iy, seed), hash(ix + 1, iy, seed), fx),
    THREE.MathUtils.lerp(
      hash(ix, iy + 1, seed),
      hash(ix + 1, iy + 1, seed),
      fx,
    ),
    fy,
  );
}

/** Small deterministic material maps, built once when the hero is mounted. */
function materialMap(
  size: number,
  sample: (u: number, v: number) => [number, number, number],
  isColor = true,
) {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const color = sample(x / (size - 1), y / (size - 1));
      const offset = (y * size + x) * 4;
      pixels[offset] = THREE.MathUtils.clamp(color[0], 0, 255);
      pixels[offset + 1] = THREE.MathUtils.clamp(color[1], 0, 255);
      pixels[offset + 2] = THREE.MathUtils.clamp(color[2], 0, 255);
      pixels[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function createLeafMaps() {
  const detail = (u: number, v: number) => {
    const across = (u - 0.5) * 2;
    const mainVein = Math.exp(-Math.pow(across / 0.021, 2));
    let secondaryVein = 0;
    for (let branch = 0; branch < 9; branch += 1) {
      const origin = 0.075 + branch * 0.101;
      const sideOffset = across < 0 ? 0.025 : 0;
      const distance = v - origin - Math.abs(across) * 0.23 - sideOffset;
      secondaryVein = Math.max(
        secondaryVein,
        Math.exp(-Math.pow(distance / 0.006, 2)),
      );
    }
    const cells = noise(u * 47, v * 68, 19);
    const flecks = noise(u * 109, v * 127, 23);
    const mottling = noise(u * 7, v * 11, 5);
    return { across, mainVein, secondaryVein, cells, flecks, mottling };
  };
  const color = materialMap(256, (u, v) => {
    const d = detail(u, v);
    const light =
      (d.mottling - 0.5) * 26 + (d.cells - 0.5) * 13 + (d.flecks - 0.5) * 8;
    const edge = Math.pow(Math.abs(d.across), 2) * 10;
    const vein = d.mainVein * 49 + d.secondaryVein * 21;
    return [
      62 + light - edge + vein,
      91 + light - edge + vein * 0.88,
      26 + light * 0.45 - edge * 0.3 + vein * 0.27,
    ];
  });
  const bump = materialMap(
    256,
    (u, v) => {
      const d = detail(u, v);
      const height =
        112 +
        d.mainVein * 65 +
        d.secondaryVein * 28 +
        d.cells * 20 +
        d.flecks * 10;
      return [height, height, height];
    },
    false,
  );
  return { color, bump };
}

function createStoneMaps() {
  const color = materialMap(256, (u, v) => {
    const cloud = noise(u * 8, v * 8, 29);
    const grain = noise(u * 89, v * 89, 31);
    const fleck = hash(Math.floor(u * 255), Math.floor(v * 255), 41);
    const mineral = Math.pow(noise(u * 29, v * 23, 47), 5) * 59;
    const value =
      121 +
      (cloud - 0.5) * 34 +
      (grain - 0.5) * 30 +
      (fleck - 0.5) * 17 +
      mineral;
    return [value + 5, value + 5, value - 2];
  });
  const bump = materialMap(
    256,
    (u, v) => {
      const height =
        100 + noise(u * 55, v * 55, 43) * 47 + hash(u * 255, v * 255, 53) * 24;
      return [height, height, height];
    },
    false,
  );
  color.wrapS = color.wrapT = THREE.RepeatWrapping;
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  return { color, bump };
}

function createLeafGeometry(length: number, width: number, curl: number) {
  const rows = 32;
  const columns = 12;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const t = row / rows;
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const side = u * 2 - 1;
      const envelope = Math.pow(Math.sin(Math.PI * t), 0.79);
      const asymmetry = 1 + 0.07 * side * Math.sin(t * Math.PI * 2);
      const edge = 1 + Math.sin(t * Math.PI * 28) * 0.008 * Math.abs(side);
      const x = side * width * 0.5 * envelope * asymmetry * edge;
      const y = t * length;
      const z =
        Math.sin(Math.PI * t) * length * 0.105 -
        t * t * length * 0.075 +
        side * side * envelope * width * 0.15 +
        side * Math.sin(Math.PI * t) * curl +
        (1 - Math.abs(side)) * envelope * 0.012;
      positions.push(x, y, z);
      uvs.push(u, t);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column;
        const b = a + 1;
        const c = a + columns + 1;
        indices.push(a, b, c, b, c + 1, c);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function stemGeometry(points: THREE.Vector3[], radius: number) {
  return new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points),
    28,
    radius,
    8,
    false,
  );
}

export function createHouseModel(): HouseModel {
  const group = new THREE.Group();
  group.name = "Calm home — glass, living plant and river stones";
  const hinge = new THREE.Group();
  hinge.name = "House bottom hinge";
  group.add(hinge);

  const geometry = createHouseGeometry();
  const optics = createRasterGlass(geometry);
  const house = new THREE.Mesh(geometry, optics.material);
  house.name = "Rounded olive glass house with open arch";
  house.castShadow = true;
  house.receiveShadow = true;
  hinge.add(house);

  const stoneMaps = createStoneMaps();
  const stoneSettings = [
    {
      position: [-0.265, 0.61, 0.2],
      scale: [0.32, 0.205, 0.24],
      color: "#b8b7a8",
      rotation: [0.1, 0.6, 0.12],
    },
    {
      position: [0.23, 0.625, 0.045],
      scale: [0.31, 0.185, 0.235],
      color: "#777c65",
      rotation: [-0.2, -0.35, -0.18],
    },
    {
      position: [0.19, 0.565, 0.27],
      scale: [0.245, 0.17, 0.21],
      color: "#6b7267",
      rotation: [0.2, 1.2, 0.08],
    },
  ];
  stoneSettings.forEach((setting, index) => {
    const geometry = new THREE.SphereGeometry(1, 44, 28);
    const positions = geometry.getAttribute("position");
    for (let vertex = 0; vertex < positions.count; vertex += 1) {
      const x = positions.getX(vertex);
      const y = positions.getY(vertex);
      const z = positions.getZ(vertex);
      // Broad, continuous irregularities preserve a naturally worn silhouette.
      const irregularity =
        1 +
        Math.sin(x * 5.2 + z * 3.1 + index * 1.7) *
          Math.cos(y * 4.7 - z * 2.2) *
          0.037 +
        Math.sin(x * 9.3 + y * 5.1 - z * 4.3 + index) * 0.013;
      positions.setXYZ(
        vertex,
        x * irregularity,
        y * irregularity,
        z * irregularity,
      );
    }
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color: setting.color,
      map: stoneMaps.color,
      bumpMap: stoneMaps.bump,
      bumpScale: 0.013,
      roughness: 0.78,
      metalness: 0,
      envMapIntensity: 0.4,
    });
    const stone = new THREE.Mesh(geometry, material);
    stone.name = `River stone ${index + 1}`;
    stone.position.set(...(setting.position as [number, number, number]));
    stone.scale.set(...(setting.scale as [number, number, number]));
    stone.rotation.set(...(setting.rotation as [number, number, number]));
    stone.castShadow = stone.receiveShadow = true;
    hinge.add(stone);
  });

  const plant = new THREE.Group();
  plant.name = "Living three-leaf seedling";
  plant.position.set(0.015, 0.43, 0.09);
  hinge.add(plant);
  const stemMaterial = new THREE.MeshStandardMaterial({
    color: "#65772c",
    roughness: 0.58,
    metalness: 0,
  });
  const stem = new THREE.Mesh(
    stemGeometry(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.008, 0.25, 0.025),
        new THREE.Vector3(0.035, 0.53, 0.015),
        new THREE.Vector3(0.095, 0.84, 0.008),
      ],
      0.021,
    ),
    stemMaterial,
  );
  stem.name = "Curved main stem";
  stem.castShadow = true;
  plant.add(stem);

  const leafMaps = createLeafMaps();
  const leafMaterial = new THREE.MeshPhysicalMaterial({
    color: "#dce1b7",
    map: leafMaps.color,
    bumpMap: leafMaps.bump,
    bumpScale: 0.009,
    metalness: 0,
    roughness: 0.47,
    clearcoat: 0.19,
    clearcoatRoughness: 0.4,
    sheen: 0.18,
    sheenRoughness: 0.7,
    sheenColor: "#a6b85c",
    envMapIntensity: 0.5,
    side: THREE.DoubleSide,
  });
  const midribMaterial = new THREE.MeshStandardMaterial({
    color: "#94a34b",
    roughness: 0.62,
  });
  const leafDefinitions = [
    {
      base: [0.074, 0.66, 0.012],
      direction: [0.52, 0.84, 0.055],
      length: 1.04,
      width: 0.445,
      curl: 0.035,
      turn: -0.12,
    },
    {
      base: [0.023, 0.49, 0.025],
      direction: [-0.76, 0.61, 0.085],
      length: 0.81,
      width: 0.343,
      curl: -0.047,
      turn: 0.21,
    },
    {
      base: [0.081, 0.77, -0.02],
      direction: [-0.19, 0.96, -0.12],
      length: 0.61,
      width: 0.255,
      curl: 0.029,
      turn: -0.29,
    },
  ];
  const leafHinges: {
    pivot: THREE.Group;
    resting: THREE.Quaternion;
    phase: number;
  }[] = [];
  leafDefinitions.forEach((definition, index) => {
    const pivot = new THREE.Group();
    pivot.name = `Leaf ${index + 1} unfurl hinge`;
    pivot.position.set(...(definition.base as [number, number, number]));
    const direction = new THREE.Vector3(
      ...(definition.direction as [number, number, number]),
    ).normalize();
    pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    pivot.rotateY(definition.turn);
    const blade = new THREE.Mesh(
      createLeafGeometry(definition.length, definition.width, definition.curl),
      leafMaterial,
    );
    blade.name = `Curved veined leaf ${index + 1}`;
    blade.castShadow = blade.receiveShadow = true;
    pivot.add(blade);
    const veinPoints = Array.from({ length: 13 }, (_, segment) => {
      const t = segment / 12;
      return new THREE.Vector3(
        0,
        t * definition.length * 0.96,
        Math.sin(Math.PI * t * 0.96) * definition.length * 0.105 -
          Math.pow(t * 0.96, 2) * definition.length * 0.075 +
          Math.pow(Math.sin(Math.PI * t * 0.96), 0.79) * 0.012 +
          0.003,
      );
    });
    const midrib = new THREE.Mesh(
      stemGeometry(veinPoints, 0.0032),
      midribMaterial,
    );
    pivot.add(midrib);
    plant.add(pivot);
    leafHinges.push({
      pivot,
      resting: pivot.quaternion.clone(),
      phase: index * 0.045,
    });

    if (index === 1) {
      const petiole = new THREE.Mesh(
        stemGeometry(
          [
            new THREE.Vector3(0.018, 0.35, 0.018),
            new THREE.Vector3(-0.002, 0.435, 0.025),
            pivot.position.clone(),
          ],
          0.011,
        ),
        stemMaterial,
      );
      plant.add(petiole);
    }
  });

  const foldQuaternion = new THREE.Quaternion();
  const foldAxis = new THREE.Vector3(1, 0, 0);
  const reveal = (progress: number) => {
    const p = clamp01(progress);
    const houseProgress = smooth(p / 0.8);
    hinge.rotation.x = -(1 - houseProgress) * Math.PI * 0.465;
    const growth = smooth((p - 0.2) / 0.8);
    plant.scale.set(
      0.72 + growth * 0.28,
      0.035 + growth * 0.965,
      0.72 + growth * 0.28,
    );
    leafHinges.forEach(({ pivot, resting, phase }) => {
      const unfurl = smooth((p - 0.27 - phase) / (0.73 - phase));
      foldQuaternion.setFromAxisAngle(foldAxis, (1 - unfurl) * 1.38);
      pivot.quaternion.copy(resting).multiply(foldQuaternion);
      pivot.scale.x = 0.12 + unfurl * 0.88;
    });
  };
  reveal(1);

  const dispose = () => {
    optics.dispose();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      objectMaterials.forEach((material) => {
        materials.add(material);
        Object.values(material).forEach((value) => {
          if (value instanceof THREE.Texture) textures.add(value);
        });
      });
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
  };

  return { group, reveal, dispose, prepare: (renderer, scene, camera) => optics.prepare(renderer, scene, camera, house) };
}
