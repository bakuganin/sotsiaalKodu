import * as THREE from "three";

/**
 * A single closed glass volume. Every angular strip shares its vertices with
 * the next, including the front, back, outer wall and the wall of the arch.
 * The rounded cross-section replaces offset bevels, which can fold over at
 * small doorway corners and produce inverted faces in a transmissive object.
 */
export function createHouseGeometry(): THREE.BufferGeometry {
  const outline = new THREE.Shape();
  outline.moveTo(-1.07, 0);
  outline.lineTo(1.07, 0);
  outline.quadraticCurveTo(1.29, 0, 1.3, 0.23);
  outline.lineTo(1.3, 1.68);
  outline.quadraticCurveTo(1.3, 1.78, 1.42, 1.93);
  outline.bezierCurveTo(1.63, 2.08, 1.63, 2.19, 1.43, 2.33);
  outline.lineTo(0.19, 3.325);
  outline.quadraticCurveTo(0, 3.515, -0.19, 3.325);
  outline.lineTo(-1.43, 2.33);
  outline.bezierCurveTo(-1.63, 2.19, -1.63, 2.08, -1.42, 1.93);
  outline.quadraticCurveTo(-1.3, 1.78, -1.3, 1.68);
  outline.lineTo(-1.3, 0.23);
  outline.quadraticCurveTo(-1.29, 0, -1.07, 0);
  outline.closePath();

  const arch = new THREE.Shape();
  arch.moveTo(-0.43, 0.4);
  arch.lineTo(0.43, 0.4);
  arch.quadraticCurveTo(0.64, 0.4, 0.64, 0.61);
  arch.lineTo(0.64, 1.55);
  arch.bezierCurveTo(0.64, 1.94, 0.34, 2.24, 0, 2.24);
  arch.bezierCurveTo(-0.34, 2.24, -0.64, 1.94, -0.64, 1.55);
  arch.lineTo(-0.64, 0.61);
  arch.quadraticCurveTo(-0.64, 0.4, -0.43, 0.4);
  arch.closePath();

  // Both contours are star-shaped about this point inside the open doorway.
  // Joining their intersections along the same ray keeps every ring ordered:
  // no triangulated cap seams, offset-curve overlaps or intersecting surfaces.
  const center = new THREE.Vector2(0, 1.35);
  const outside = outline.getSpacedPoints(1536);
  const inside = arch.getSpacedPoints(1024);
  const radialDistance = (
    contour: THREE.Vector2[],
    directionX: number,
    directionY: number,
  ) => {
    let result = -Infinity;
    for (let index = 0; index < contour.length - 1; index += 1) {
      const a = contour[index];
      const b = contour[index + 1];
      const edgeX = b.x - a.x;
      const edgeY = b.y - a.y;
      const denominator = directionX * edgeY - directionY * edgeX;
      if (Math.abs(denominator) < 1e-12) continue;
      const pointX = a.x - center.x;
      const pointY = a.y - center.y;
      const along = (pointX * directionY - pointY * directionX) / denominator;
      const distance = (pointX * edgeY - pointY * edgeX) / denominator;
      if (along >= -1e-8 && along <= 1 + 1e-8 && distance > 0)
        result = Math.max(result, distance);
    }
    if (!Number.isFinite(result))
      throw new Error("House contour must enclose the doorway center");
    return result;
  };

  // A softened rectangular superellipse gives a broad, gently convex face
  // and continuous rounded shoulders. It never develops the raised edge and
  // concave transition of a separately inflated flat cap. Front/back depth
  // reaches +/- .52; all intermediate points belong to the same convex arc.
  const halfDepth = 0.52;
  const crossSegments = 72;
  const angularBase = 384;
  const angles: number[] = [];
  for (let index = 0; index < angularBase; index += 1) {
    const angle = (index / angularBase) * Math.PI * 2;
    const nearEave =
      (angle > 0.25 && angle < 0.7) ||
      (angle > Math.PI - 0.7 && angle < Math.PI - 0.25);
    const subdivisions = nearEave ? 3 : 1;
    for (let sub = 0; sub < subdivisions; sub += 1)
      angles.push(((index + sub / subdivisions) / angularBase) * Math.PI * 2);
  }
  const angularSegments = angles.length;
  const exponent = 1;
  const denseCross = Array.from({ length: 4097 }, (_, index) => {
    const angle = (index / 4096) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      radial: (1 - Math.sign(cos) * Math.abs(cos) ** exponent) * 0.5,
      z: Math.sign(sin) * Math.abs(sin) ** exponent * halfDepth,
      length: 0,
    };
  });
  for (let index = 1; index < denseCross.length; index += 1) {
    const previous = denseCross[index - 1];
    const current = denseCross[index];
    current.length =
      previous.length +
      Math.hypot(
        (current.radial - previous.radial) * 0.8,
        current.z - previous.z,
      );
  }
  const perimeter = denseCross[denseCross.length - 1].length;
  let denseIndex = 1;
  const crossSection = Array.from({ length: crossSegments }, (_, index) => {
    const target = (index / crossSegments) * perimeter;
    while (denseCross[denseIndex].length < target) denseIndex += 1;
    const previous = denseCross[denseIndex - 1];
    const current = denseCross[denseIndex];
    const t = (target - previous.length) / (current.length - previous.length);
    return {
      radial: THREE.MathUtils.lerp(previous.radial, current.radial, t),
      z: THREE.MathUtils.lerp(previous.z, current.z, t),
    };
  });

  const positions = new Float32Array(angularSegments * crossSegments * 3);
  const indices: number[] = [];
  for (let angular = 0; angular < angularSegments; angular += 1) {
    const angle = angles[angular];
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);
    const outerRadius = radialDistance(outside, directionX, directionY);
    const innerRadius = radialDistance(inside, directionX, directionY);
    if (outerRadius <= innerRadius)
      throw new Error("House arch must remain inside the exterior contour");
    for (let cross = 0; cross < crossSegments; cross += 1) {
      const section = crossSection[cross];
      const radius = THREE.MathUtils.lerp(
        outerRadius,
        innerRadius,
        section.radial,
      );
      const offset = (angular * crossSegments + cross) * 3;
      positions[offset] = center.x + directionX * radius;
      positions[offset + 1] = center.y + directionY * radius;
      positions[offset + 2] = section.z;

      const nextAngular = (angular + 1) % angularSegments;
      const nextCross = (cross + 1) % crossSegments;
      const a = angular * crossSegments + cross;
      const b = nextAngular * crossSegments + cross;
      const c = angular * crossSegments + nextCross;
      const d = nextAngular * crossSegments + nextCross;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
