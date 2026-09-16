import {
  BackSide,
  BufferGeometry,
  Camera,
  Color,
  FrontSide,
  HalfFloatType,
  LinearFilter,
  Mesh,
  MeshPhysicalMaterial,
  NoBlending,
  Scene,
  ShaderChunk,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";

export interface RasterGlass {
  material: MeshPhysicalMaterial;
  prepare: (
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera,
    mesh: Mesh,
  ) => void;
  dispose: () => void;
}

const rasterTransmission = /* glsl */ `
// HERO_OPTICAL_GLASS
uniform sampler2D opticalRearSurface;
uniform vec2 opticalRearTexel;
uniform vec3 opticalPaperColor;
uniform float opticalMaxDistance;

vec3 rasterStudio( vec3 direction, float surfaceRoughness ) {
  #ifdef ENVMAP_TYPE_CUBE_UV
    return textureCubeUV( envMap, envMapRotation * direction, surfaceRoughness ).rgb * envMapIntensity;
  #else
    return vec3( 0.0 );
  #endif
}

vec2 rasterProject( vec3 viewPosition ) {
  vec4 projected = projectionMatrix * vec4( viewPosition, 1.0 );
  return projected.xy / projected.w * 0.5 + 0.5;
}

bool rasterValidSurface( vec4 surface, vec2 uv ) {
  return surface.a > 0.01 && dot( surface.xyz, surface.xyz ) > 0.2
    && all( greaterThanEqual( uv, opticalRearTexel ) )
    && all( lessThanEqual( uv, vec2( 1.0 ) - opticalRearTexel ) );
}

vec3 rasterBackground( vec3 exitPosition, vec3 direction, float surfaceRoughness, float refractionIndex ) {
  vec3 studio = rasterStudio( direction, surfaceRoughness );
  vec3 viewExit = ( viewMatrix * vec4( exitPosition, 1.0 ) ).xyz;
  vec3 viewDirection = mat3( viewMatrix ) * direction;
  if ( viewDirection.z < -0.025 ) {
    // Project onto the same distant paper/gutter plane as the previous optics.
    float distanceToPaper = min( opticalMaxDistance / -viewDirection.z, 40.0 );
    vec2 uv = rasterProject( viewExit + viewDirection * distanceToPaper );
    if ( all( greaterThanEqual( uv, vec2( 0.0 ) ) ) && all( lessThanEqual( uv, vec2( 1.0 ) ) ) ) {
      // Hardware trilinear filtering is enough for polished glass. The standard
      // bicubic helper needs eight samples, repeated for every optical path.
      float lod = log2( max( transmissionSamplerSize.x, 1.0 ) )
        * applyIorToRoughness( surfaceRoughness, refractionIndex );
      vec3 opaque = textureLod( transmissionSamplerMap, uv, lod ).rgb;
      float objectCoverage = smoothstep( 0.025, 0.09, length( opaque - opticalPaperColor ) );
      vec3 background = mix( mix( opticalPaperColor, studio, 0.48 ), opaque, objectCoverage );
      float edge = min( min( uv.x, 1.0 - uv.x ), min( uv.y, 1.0 - uv.y ) );
      return mix( studio, background, smoothstep( 0.0, 0.055, edge ) );
    }
  }
  return studio;
}

float rasterFresnel( vec3 incident, vec3 transmitted, vec3 normal, float relativeIor ) {
  float ci = clamp( dot( -incident, normal ), 0.0, 1.0 );
  float ct = clamp( dot( -transmitted, normal ), 0.0, 1.0 );
  float rs = ( relativeIor * ci - ct ) / max( relativeIor * ci + ct, 0.00001 );
  float rp = ( ci - relativeIor * ct ) / max( ci + relativeIor * ct, 0.00001 );
  return 0.5 * ( rs * rs + rp * rp );
}

vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float surfaceRoughness, const in vec3 diffuseColor,
  const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 objectMatrix,
  const in mat4 cameraViewMatrix, const in mat4 cameraProjectionMatrix, const in float dispersion, const in float refractionIndex, const in float thickness,
  const in vec3 glassAttenuationColor, const in float glassAttenuationDistance ) {
  vec3 incident = isOrthographic
    ? transformDirectionByInverseViewMatrix( vec3( 0.0, 0.0, -1.0 ), viewMatrix )
    : -v;
  vec3 entryNormal = normalize( n );
  if ( dot( incident, entryNormal ) > 0.0 ) entryNormal = -entryNormal;
  vec3 insideWorldDirection = normalize( refract( incident, entryNormal, 1.0 / refractionIndex ) );
  vec3 insideViewDirection = normalize( mat3( viewMatrix ) * insideWorldDirection );
  vec3 entryView = ( viewMatrix * vec4( position, 1.0 ) ).xyz;
  float entryDepth = -entryView.z;
  vec2 startUv = rasterProject( entryView );
  vec4 rearSurface = texture2D( opticalRearSurface, startUv );
  vec3 rearNormal = -normalize( mat3( viewMatrix ) * entryNormal );
  float travel = min( thickness, opticalMaxDistance );

  if ( insideViewDirection.z < -0.04 && rasterValidSurface( rearSurface, startUv ) ) {
    float denominator = -insideViewDirection.z;
    travel = clamp( ( rearSurface.a - entryDepth ) / denominator, 0.001, opticalMaxDistance );
    rearNormal = normalize( rearSurface.xyz );
    // Two rear-surface predictions follow the actual rounded back geometry.
    // Work stays constant per fragment: no per-pixel tree or triangle loops.
    for ( int refinement = 0; refinement < 2; refinement ++ ) {
      vec2 predictedUv = rasterProject( entryView + insideViewDirection * travel );
      vec4 predictedRear = texture2D( opticalRearSurface, predictedUv );
      if ( !rasterValidSurface( predictedRear, predictedUv ) || predictedRear.a < entryDepth ) {
        // The ray crosses the projected arch edge. Locate that boundary with
        // three bounded steps and keep the last real rear-wall normal.
        float lower = 0.0;
        float upper = travel;
        for ( int edgeStep = 0; edgeStep < 3; edgeStep ++ ) {
          float middle = ( lower + upper ) * 0.5;
          vec2 edgeUv = rasterProject( entryView + insideViewDirection * middle );
          vec4 edgeSurface = texture2D( opticalRearSurface, edgeUv );
          if ( rasterValidSurface( edgeSurface, edgeUv ) && edgeSurface.a >= entryDepth ) {
            lower = middle;
            rearNormal = normalize( edgeSurface.xyz );
          } else upper = middle;
        }
        travel = max( lower, 0.001 );
        break;
      }
      float predictedTravel = clamp( ( predictedRear.a - entryDepth ) / denominator, 0.001, opticalMaxDistance );
      travel = mix( travel, predictedTravel, 0.8 );
      rearNormal = normalize( predictedRear.xyz );
    }
  }

  if ( dot( insideViewDirection, rearNormal ) > 0.0 ) rearNormal = -rearNormal;
  vec3 worldRearNormal = transformNormalByInverseViewMatrix( rearNormal, viewMatrix );
  vec3 exitWorldDirection = refract( insideWorldDirection, worldRearNormal, refractionIndex );
  vec3 exitPosition = position + insideWorldDirection * travel;
  vec3 attenuation = volumeAttenuation( travel, glassAttenuationColor, glassAttenuationDistance );
  vec3 reflectedDirection = reflect( insideWorldDirection, worldRearNormal );
  vec3 reflectedLight = rasterStudio( reflectedDirection, surfaceRoughness );
  vec3 radiance;
  if ( dot( exitWorldDirection, exitWorldDirection ) < 0.00001 ) {
    radiance = reflectedLight * attenuation;
  } else {
    exitWorldDirection = normalize( exitWorldDirection );
    float rearFresnel = rasterFresnel( insideWorldDirection, exitWorldDirection, worldRearNormal, refractionIndex );
    vec3 transmitted = rasterBackground( exitPosition, exitWorldDirection, surfaceRoughness, refractionIndex );
    // A subdued internal echo preserves glass edge depth without retracing a
    // tree of progressively weaker reflections on every animation frame.
    radiance = mix( transmitted, reflectedLight * attenuation, rearFresnel ) * attenuation;
  }
  vec3 frontFresnel = EnvironmentBRDF( entryNormal, -incident, specularColor, specularF90, surfaceRoughness );
  return vec4( ( 1.0 - frontFresnel ) * diffuseColor * radiance, 1.0 );
}
`;

/** Rear-surface optics with constant shader cost and one isolated raster pass. */
export function createRasterGlass(geometry: BufferGeometry): RasterGlass {
  geometry.computeBoundingBox();
  const extent = geometry.boundingBox!.getSize(new Vector3()).length();
  const rearTarget = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  rearTarget.texture.name = "Glass rear surface — view normal and linear depth";
  const captureMaterial = new ShaderMaterial({
    name: "Glass rear surface capture",
    side: BackSide,
    blending: NoBlending,
    depthTest: true,
    depthWrite: true,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 rearNormal;
      varying float rearDepth;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4( position, 1.0 );
        rearNormal = normalMatrix * normal;
        rearDepth = -viewPosition.z;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 rearNormal;
      varying float rearDepth;
      void main() {
        gl_FragColor = vec4( normalize( rearNormal ), rearDepth );
      }
    `,
  });
  const captureScene = new Scene();
  const captureMesh = new Mesh(geometry, captureMaterial);
  captureMesh.matrixAutoUpdate = false;
  captureMesh.frustumCulled = false;
  captureScene.add(captureMesh);

  const material = new MeshPhysicalMaterial({
    name: "Rounded olive glass — raster entry and exit surfaces",
    color: "#ffffff",
    metalness: 0,
    roughness: 0.075,
    transmission: 1,
    thickness: 0.8,
    ior: 1.46,
    attenuationColor: "#8c9e36",
    attenuationDistance: 2.2,
    clearcoat: 0,
    envMapIntensity: 1,
    side: FrontSide,
  });
  const paperColor = new Color(0xefefed);
  const rearTexel = new Vector2(1, 1);
  const drawingSize = new Vector2();
  const cssSize = new Vector2();
  const previousClearColor = new Color();
  const uniforms = {
    opticalRearSurface: { value: rearTarget.texture },
    opticalRearTexel: { value: rearTexel },
    opticalPaperColor: { value: paperColor },
    opticalMaxDistance: { value: extent * 0.85 },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <transmission_pars_fragment>",
      `
        #ifdef USE_TRANSMISSION
        ${ShaderChunk.transmission_pars_fragment.replace(
          "vec4 getIBLVolumeRefraction(",
          "vec4 getIBLVolumeRefractionSinglePass(",
        )}
        ${rasterTransmission}
        #endif
      `,
    );
  };
  material.customProgramCacheKey = () => "hero-raster-glass-v1";
  let disposed = false;
  let capturing = false;
  let supportsTarget: boolean | undefined;

  return {
    material,
    prepare(renderer, scene, camera, mesh) {
      if (disposed || capturing) return;
      supportsTarget ??=
        renderer.extensions.has("EXT_color_buffer_float") ||
        renderer.extensions.has("EXT_color_buffer_half_float");
      if (!supportsTarget)
        throw new Error("Floating-point glass capture unavailable");
      if (scene.background instanceof Color) paperColor.copy(scene.background);
      renderer.getDrawingBufferSize(drawingSize);
      renderer.getSize(cssSize);
      const maximum = cssSize.x < 380 ? 256 : 384;
      const ratio = Math.min(
        1,
        maximum / Math.max(drawingSize.x, drawingSize.y),
      );
      const width = Math.max(1, Math.round(drawingSize.x * ratio));
      const height = Math.max(1, Math.round(drawingSize.y * ratio));
      if (rearTarget.width !== width || rearTarget.height !== height) {
        rearTarget.setSize(width, height);
        rearTexel.set(1 / width, 1 / height);
      }
      mesh.updateWorldMatrix(true, false);
      captureMesh.matrix.copy(mesh.matrixWorld);
      const previousTarget = renderer.getRenderTarget();
      const previousCubeFace = renderer.getActiveCubeFace();
      const previousMipLevel = renderer.getActiveMipmapLevel();
      renderer.getClearColor(previousClearColor);
      const previousClearAlpha = renderer.getClearAlpha();
      const previousAutoClear = renderer.autoClear;
      const previousXr = renderer.xr.enabled;
      capturing = true;
      try {
        renderer.xr.enabled = false;
        renderer.autoClear = false;
        renderer.setRenderTarget(rearTarget);
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, true, false);
        renderer.render(captureScene, camera);
      } finally {
        renderer.setRenderTarget(
          previousTarget,
          previousCubeFace,
          previousMipLevel,
        );
        renderer.setClearColor(previousClearColor, previousClearAlpha);
        renderer.autoClear = previousAutoClear;
        renderer.xr.enabled = previousXr;
        capturing = false;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      rearTarget.dispose();
      captureMaterial.dispose();
      material.dispose();
      captureScene.remove(captureMesh);
    },
  };
}
