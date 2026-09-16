import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  FrontSide,
  Matrix3,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  ShaderChunk,
  Vector3,
} from "three";
import {
  FloatVertexAttributeTexture,
  MeshBVH,
  MeshBVHUniformStruct,
  SAH,
  shaderIntersectFunction,
  shaderStructs,
} from "three-mesh-bvh";

export interface OpticalGlass {
  material: MeshPhysicalMaterial;
  update: (mesh: Mesh, background?: Color) => void;
  dispose: () => void;
}

const opticalTransmission = /* glsl */ `
// HERO_OPTICAL_GLASS
uniform BVH opticalBvh;
uniform sampler2D opticalNormals;
uniform mat4 opticalWorldInverse;
uniform mat3 opticalNormalMatrix;
uniform vec3 opticalCenter;
uniform float opticalEpsilon;
uniform float opticalBackdropDistance;
uniform vec3 opticalPaperColor;

vec3 opticalEnvironment( vec3 direction, float surfaceRoughness ) {
  #ifdef ENVMAP_TYPE_CUBE_UV
    return textureCubeUV( envMap, envMapRotation * direction, surfaceRoughness ).rgb * envMapIntensity;
  #else
    return vec3( 0.0 );
  #endif
}

// The opaque transmission buffer contains the plant, stones, and book gutter.
// Project beyond the actual exit surface, rather than offsetting the front face
// by an arbitrary thickness. Rays returning toward the viewer see the studio.
vec3 opticalBackgroundRadiance( vec3 exitPosition, vec3 direction, float surfaceRoughness, float refractionIndex ) {
  vec3 viewExit = ( viewMatrix * vec4( exitPosition, 1.0 ) ).xyz;
  vec3 viewDirection = mat3( viewMatrix ) * direction;
  float backdropDepth = ( viewMatrix * modelMatrix * vec4( opticalCenter, 1.0 ) ).z - opticalBackdropDistance;
  if ( viewDirection.z < -0.025 ) {
    float distanceToBackdrop = ( backdropDepth - viewExit.z ) / viewDirection.z;
    if ( distanceToBackdrop > 0.0 && distanceToBackdrop < 80.0 ) {
      vec3 samplePosition = exitPosition + direction * distanceToBackdrop;
      vec4 projected = projectionMatrix * viewMatrix * vec4( samplePosition, 1.0 );
      vec2 sampleUv = projected.xy / projected.w * 0.5 + 0.5;
      if ( all( greaterThanEqual( sampleUv, vec2( 0.0 ) ) ) && all( lessThanEqual( sampleUv, vec2( 1.0 ) ) ) ) {
        vec3 screenRadiance = getTransmissionSample( sampleUv, surfaceRoughness, refractionIndex ).rgb;
        // The page's flat CSS paper is not a studio wall at every viewing angle.
        // Keep real opaque objects while allowing the clear parts to see the
        // surrounding studio through their refracted direction.
        float objectCoverage = smoothstep( 0.025, 0.09, length( screenRadiance - opticalPaperColor ) );
        vec3 studioRadiance = mix( opticalPaperColor, opticalEnvironment( direction, surfaceRoughness ), 0.72 );
        screenRadiance = mix( studioRadiance, screenRadiance, objectCoverage );
        float edge = min( min( sampleUv.x, 1.0 - sampleUv.x ), min( sampleUv.y, 1.0 - sampleUv.y ) );
        float screenWeight = smoothstep( 0.0, 0.055, edge );
        return mix( opticalEnvironment( direction, surfaceRoughness ), screenRadiance, screenWeight );
      }
    }
  }
  return opticalEnvironment( direction, surfaceRoughness );
}

float opticalFresnel( vec3 incident, vec3 transmitted, vec3 normal, float relativeIor ) {
  float incidentCosine = clamp( dot( -incident, normal ), 0.0, 1.0 );
  float transmittedCosine = clamp( dot( -transmitted, normal ), 0.0, 1.0 );
  // Unlike the exterior Schlick approximation, this stays continuous at TIR.
  float perpendicular = ( relativeIor * incidentCosine - transmittedCosine )
    / max( relativeIor * incidentCosine + transmittedCosine, 0.00001 );
  float parallel = ( incidentCosine - relativeIor * transmittedCosine )
    / max( incidentCosine + relativeIor * transmittedCosine, 0.00001 );
  return 0.5 * ( perpendicular * perpendicular + parallel * parallel );
}

// The arch makes this volume nonconvex. A ray leaving one wall may cross air
// and enter the opposite wall, so keep following real boundaries before looking
// up the background. This is a bounded primary continuation, not recursion.
vec3 opticalOutsideRadiance( vec3 exitPosition, vec3 direction, vec3 exitFaceNormal,
  float surfaceRoughness, float refractionIndex, vec3 glassAttenuationColor, float glassAttenuationDistance ) {
  vec3 rayDirection = normalize( mat3( opticalWorldInverse ) * direction );
  vec3 rayOrigin = ( opticalWorldInverse * vec4( exitPosition, 1.0 ) ).xyz
    - exitFaceNormal * opticalEpsilon * 2.0 + rayDirection * opticalEpsilon;
  vec3 throughput = vec3( 1.0 );
  vec3 radiance = vec3( 0.0 );
  bool inside = false;

  for ( int eventIndex = 0; eventIndex < 4; eventIndex ++ ) {
    uvec4 faceIndices = uvec4( 0u );
    vec3 faceNormal = vec3( 0.0 );
    vec3 barycoord = vec3( 0.0 );
    float side = 0.0;
    float hitDistance = 0.0;
    bool hit = bvhIntersectFirstHit( opticalBvh, rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, hitDistance );
    vec3 worldDirection = normalize( mat3( modelMatrix ) * rayDirection );
    if ( !hit ) {
      vec3 worldOrigin = ( modelMatrix * vec4( rayOrigin, 1.0 ) ).xyz;
      return radiance + throughput * opticalBackgroundRadiance( worldOrigin, worldDirection, surfaceRoughness, refractionIndex );
    }

    // Winding tells which medium this segment occupied. This also recovers
    // safely if a grazing origin lands microscopically across its last surface.
    inside = side < 0.0;
    vec3 localHit = rayOrigin + rayDirection * max( hitDistance, 0.0 );
    vec3 worldHit = ( modelMatrix * vec4( localHit, 1.0 ) ).xyz;
    if ( inside ) {
      float worldDistance = length( mat3( modelMatrix ) * ( rayDirection * max( hitDistance, 0.0 ) ) );
      throughput *= volumeAttenuation( worldDistance, glassAttenuationColor, glassAttenuationDistance );
    }
    vec3 smoothNormal = normalize( textureSampleBarycoord( opticalNormals, barycoord, faceIndices.xyz ).xyz );
    vec3 worldNormal = normalize( opticalNormalMatrix * smoothNormal );
    if ( dot( worldNormal, worldDirection ) > 0.0 ) worldNormal = -worldNormal;
    float relativeIor = inside ? refractionIndex : 1.0 / refractionIndex;
    vec3 transmittedDirection = refract( worldDirection, worldNormal, relativeIor );

    if ( dot( transmittedDirection, transmittedDirection ) < 0.00001 ) {
      // Total internal reflection stays in the same medium.
      rayDirection = normalize( mat3( opticalWorldInverse ) * reflect( worldDirection, worldNormal ) );
      float geometricSide = dot( rayDirection, faceNormal );
      if ( geometricSide < 0.001 )
        rayDirection = normalize( rayDirection + faceNormal * ( 0.001 - geometricSide ) );
      rayOrigin = localHit + faceNormal * opticalEpsilon * 2.0 + rayDirection * opticalEpsilon;
    } else {
      transmittedDirection = normalize( transmittedDirection );
      float fresnel = opticalFresnel( worldDirection, transmittedDirection, worldNormal, relativeIor );
      // Air-side reflection can see the surrounding scene. Weak reflection
      // branches within later glass segments receive a bounded studio estimate.
      vec3 reflectedDirection = reflect( worldDirection, worldNormal );
      vec3 reflectedRadiance = inside
        ? opticalEnvironment( reflectedDirection, surfaceRoughness ) * 0.25
        : opticalBackgroundRadiance( worldHit, reflectedDirection, surfaceRoughness, refractionIndex );
      radiance += throughput * fresnel * reflectedRadiance;
      throughput *= 1.0 - fresnel;
      rayDirection = normalize( mat3( opticalWorldInverse ) * transmittedDirection );
      float geometricSide = dot( rayDirection, faceNormal );
      if ( geometricSide > -0.001 )
        rayDirection = normalize( rayDirection - faceNormal * ( 0.001 + geometricSide ) );
      rayOrigin = localHit - faceNormal * opticalEpsilon * 2.0 + rayDirection * opticalEpsilon;
      inside = !inside;
    }
    if ( max( throughput.r, max( throughput.g, throughput.b ) ) < 0.006 ) return radiance;
  }

  vec3 finalDirection = normalize( mat3( modelMatrix ) * rayDirection );
  vec3 finalPosition = ( modelMatrix * vec4( rayOrigin, 1.0 ) ).xyz;
  return radiance + throughput * ( inside
    ? opticalEnvironment( finalDirection, surfaceRoughness ) * 0.25
    : opticalBackgroundRadiance( finalPosition, finalDirection, surfaceRoughness, refractionIndex ) );
}

vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float surfaceRoughness, const in vec3 diffuseColor,
  const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 objectMatrix,
  const in mat4 cameraViewMatrix, const in mat4 cameraProjectionMatrix, const in float dispersion, const in float refractionIndex, const in float thickness,
  const in vec3 glassAttenuationColor, const in float glassAttenuationDistance ) {

  // The hero uses an orthographic camera: its viewing rays remain parallel.
  vec3 incident = isOrthographic
    ? transformDirectionByInverseViewMatrix( vec3( 0.0, 0.0, -1.0 ), viewMatrix )
    : -v;
  vec3 entryNormal = normalize( n );
  if ( dot( incident, entryNormal ) > 0.0 ) entryNormal = -entryNormal;
  vec3 insideWorldDirection = normalize( refract( incident, entryNormal, 1.0 / refractionIndex ) );
  vec3 rayDirection = normalize( mat3( opticalWorldInverse ) * insideWorldDirection );
  vec3 localEntryNormal = normalize( mat3( opticalWorldInverse ) * entryNormal );
  vec3 rayOrigin = ( opticalWorldInverse * vec4( position, 1.0 ) ).xyz
    - localEntryNormal * opticalEpsilon * 2.0 + rayDirection * opticalEpsilon;
  vec3 throughput = vec3( 1.0 );
  vec3 radiance = vec3( 0.0 );

  // Bound work per fragment while retaining internal reflections and TIR.
  for ( int bounce = 0; bounce < 3; bounce ++ ) {
    uvec4 faceIndices = uvec4( 0u );
    vec3 faceNormal = vec3( 0.0 );
    vec3 barycoord = vec3( 0.0 );
    float side = 0.0;
    float hitDistance = 0.0;
    bool hit = bvhIntersectFirstHit( opticalBvh, rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, hitDistance );
    if ( !hit ) {
      vec3 worldOrigin = ( objectMatrix * vec4( rayOrigin, 1.0 ) ).xyz;
      vec3 worldDirection = normalize( mat3( objectMatrix ) * rayDirection );
      radiance += throughput * opticalBackgroundRadiance( worldOrigin, worldDirection, surfaceRoughness, refractionIndex );
      throughput = vec3( 0.0 );
      break;
    }

    vec3 localHit = rayOrigin + rayDirection * max( hitDistance, 0.0 );
    float worldDistance = length( mat3( objectMatrix ) * ( rayDirection * max( hitDistance, 0.0 ) ) );
    throughput *= volumeAttenuation( worldDistance, glassAttenuationColor, glassAttenuationDistance );
    vec3 smoothNormal = normalize( textureSampleBarycoord( opticalNormals, barycoord, faceIndices.xyz ).xyz );
    vec3 worldNormal = normalize( opticalNormalMatrix * smoothNormal );
    vec3 worldDirection = normalize( mat3( objectMatrix ) * rayDirection );
    if ( dot( worldNormal, worldDirection ) > 0.0 ) worldNormal = -worldNormal;
    vec3 worldHit = ( objectMatrix * vec4( localHit, 1.0 ) ).xyz;
    vec3 exitDirection = refract( worldDirection, worldNormal, refractionIndex );

    if ( dot( exitDirection, exitDirection ) > 0.00001 ) {
      exitDirection = normalize( exitDirection );
      float fresnel = opticalFresnel( worldDirection, exitDirection, worldNormal, refractionIndex );
      // Follow further walls for the dominant transmitted path. A weak Fresnel
      // echo contributes studio light without retracing the whole frame again.
      vec3 escapedRadiance;
      if ( max( throughput.r, max( throughput.g, throughput.b ) ) > 0.2 )
        escapedRadiance = opticalOutsideRadiance( worldHit, exitDirection, faceNormal,
          surfaceRoughness, refractionIndex, glassAttenuationColor, glassAttenuationDistance );
      else escapedRadiance = opticalBackgroundRadiance( worldHit, exitDirection, surfaceRoughness, refractionIndex );
      radiance += throughput * ( 1.0 - fresnel ) * escapedRadiance;
      throughput *= fresnel;
    }

    if ( max( throughput.r, max( throughput.g, throughput.b ) ) < 0.006 ) {
      throughput = vec3( 0.0 );
      break;
    }
    vec3 reflectedDirection = reflect( worldDirection, worldNormal );
    rayDirection = normalize( mat3( opticalWorldInverse ) * reflectedDirection );
    // Smooth shading normals can place a reflected ray just outside its actual
    // triangle at grazing angles. Keep its origin/direction in the solid.
    float geometricSide = dot( rayDirection, faceNormal );
    if ( geometricSide < 0.001 )
      rayDirection = normalize( rayDirection + faceNormal * ( 0.001 - geometricSide ) );
    rayOrigin = localHit + faceNormal * opticalEpsilon * 2.0 + rayDirection * opticalEpsilon;
  }

  // The few paths still trapped after the bounded traversal receive a subdued
  // studio continuation. This prevents hard black holes at extreme edge angles.
  vec3 remainingDirection = normalize( mat3( objectMatrix ) * rayDirection );
  radiance += throughput * opticalEnvironment( remainingDirection, surfaceRoughness ) * 0.25;
  vec3 entryFresnel = EnvironmentBRDF( entryNormal, -incident, specularColor, specularF90, surfaceRoughness );
  return vec4( ( 1.0 - entryFresnel ) * diffuseColor * radiance, 1.0 );
}
`;

/** Real entry/exit optics for one rigid, closed glass mesh. */
export function createOpticalGlass(geometry: BufferGeometry): OpticalGlass {
  // BVH construction may reorder triangles. Own the tracing copy so the caller's
  // geometry, groups, and any other materials remain untouched.
  const tracingGeometry = geometry.clone();
  tracingGeometry.clearGroups();
  if (!tracingGeometry.getAttribute("normal"))
    tracingGeometry.computeVertexNormals();
  tracingGeometry.computeBoundingBox();
  const bounds = tracingGeometry.boundingBox!;
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const extent = Math.max(size.x, size.y, size.z);
  const bvh = new MeshBVH(tracingGeometry, {
    strategy: SAH,
    maxDepth: 28,
    targetLeafSize: 6,
  });
  const bvhUniform = new MeshBVHUniformStruct();
  const normalTexture = new FloatVertexAttributeTexture();
  const worldInverse = new Matrix4();
  const worldNormal = new Matrix3();
  const paperColor = new Color(0xefefed);
  let disposed = false;
  let material: MeshPhysicalMaterial | undefined;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    bvhUniform.dispose();
    normalTexture.dispose();
    tracingGeometry.dispose();
    material?.dispose();
  };

  try {
    bvhUniform.updateFrom(bvh);
    const normals = tracingGeometry.getAttribute("normal");
    const normalValues = new Float32Array(normals.count * 3);
    for (let index = 0; index < normals.count; index += 1) {
      normalValues[index * 3] = normals.getX(index);
      normalValues[index * 3 + 1] = normals.getY(index);
      normalValues[index * 3 + 2] = normals.getZ(index);
    }
    normalTexture.updateFrom(new Float32BufferAttribute(normalValues, 3));
    material = new MeshPhysicalMaterial({
      color: "#ffffff",
      metalness: 0,
      roughness: 0.075,
      transmission: 1,
      thickness: 1,
      ior: 1.46,
      attenuationColor: "#8c9e36",
      attenuationDistance: 1.1,
      clearcoat: 0,
      envMapIntensity: 1,
      side: FrontSide,
    });
    material.name = "Olive optical glass — actual internal ray paths";
    const uniforms = {
      opticalBvh: { value: bvhUniform },
      opticalNormals: { value: normalTexture },
      opticalWorldInverse: { value: worldInverse },
      opticalNormalMatrix: { value: worldNormal },
      opticalPaperColor: { value: paperColor },
      opticalCenter: { value: center },
      opticalEpsilon: { value: Math.max(extent * 0.00006, 0.00002) },
      opticalBackdropDistance: { value: extent * 0.9 },
    };
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <transmission_pars_fragment>",
        `
          #ifdef USE_TRANSMISSION
          precision highp usampler2D;
          ${shaderStructs}
          ${shaderIntersectFunction}
          ${ShaderChunk.transmission_pars_fragment.replace(
            "vec4 getIBLVolumeRefraction(",
            "vec4 getIBLVolumeRefractionSinglePass(",
          )}
          ${opticalTransmission}
          #endif
        `,
      );
    };
    material.customProgramCacheKey = () => "hero-optical-glass-bvh-v2";
    return {
      material,
      update(mesh, background) {
        if (disposed) return;
        if (background) paperColor.copy(background);
        worldInverse.copy(mesh.matrixWorld).invert();
        worldNormal.getNormalMatrix(mesh.matrixWorld);
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
