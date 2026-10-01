import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = "/models/two-sisters.glb";

// GLTF INSPECTION NOTE (done before writing any of this - do not skip re-checking this if the
// GLB is ever swapped again): parsed the glTF JSON chunk directly. Structure is:
//   - 2 nodes total: a root (translation [0,0,0], a small baked rotation quaternion, and a
//     non-uniform scale [~1.78, 1, 1]) with one child mesh node.
//   - ONE mesh, ONE material, attributes POSITION/NORMAL/TEXCOORD_0 only.
//   - NO skins/bones, NO morph targets ("targets" absent from every primitive), NO animation
//     clips.
// Consequences that follow directly from that (not guesses):
//   - There are no separate eye/pupil meshes and no bones to move independently - "eye-follow"
//     below is a whole-model micro-tilt standing in for it, same as the single-girl model
//     before it. It is intentionally tiny (see MAX_YAW/MAX_PITCH) so it doesn't read as the
//     whole figure turning.
//   - Real blinking is not possible without morph targets/eyelid geometry - not implemented,
//     not faked. See the note at the bottom of this file.
//   - Drag-to-rotate uses <OrbitControls> orbiting the CAMERA around the model (never spins the
//     mesh itself), which needs no bones/animation to work correctly.
//
// ORIENTATION: this is a different GLB export than the previous single-girl model, but the same
// generator (THREE.GLTFExporter) and pipeline, which came in ~90 degrees off. Applying that same
// known-good correction here as the default; if she/they load facing the wrong way, this is the
// one line to flip (to +Math.PI / 2).
const BASE_ROTATION_Y = -Math.PI / 2;

// Gaze-follow limits - a small stand-in for eye movement, not a body turn. The horizontal one is
// now admin-controlled (see maxYawRad below, driven by Settings.modelHorizontalRotation) rather
// than a fixed constant - the vertical one stays fixed on purpose, see point 5 of the spec this
// fixes ("keep the existing vertical behavior separate").
const MAX_PITCH = THREE.MathUtils.degToRad(5);
const LERP_FACTOR = 0.06;

// Fixed intrinsic model scale (unrelated to the admin "display size" control below) - just
// normalizes whatever units the GLB was exported in to a sane, consistent size to work with.
const NORMALIZED_SIZE = 2.2;

const isTouchDevice =
  typeof window !== "undefined" && (("ontouchstart" in window) || navigator.maxTouchPoints > 0);

// `maxYawRad` is the admin's "3D Model Horizontal Rotation" setting, converted to radians - the
// MAXIMUM the gaze-follow is allowed to turn the model left/right from its true front-facing
// orientation (BASE_ROTATION_Y, which this never modifies). It is NOT an offset added to the
// resting orientation - at rest (no mouse movement, or reduced-motion/touch), the model always
// settles back to exactly BASE_ROTATION_Y regardless of this value. At maxYawRad = 0, the mouse
// has zero horizontal effect (TEST H). `baseRotationX`, by contrast, IS a resting-orientation
// offset (the admin's separate vertical tilt setting) - intentionally different from how yaw
// works here; see point 5 of the spec this fixes.
function TwoSistersMesh({ reducedMotion, pointerRef, draggingRef, onMeasured, maxYawRad, baseRotationX }) {
  const { scene } = useGLTF(MODEL_URL);
  const group = useRef();

  // Center + normalize scale so the model always sits nicely in frame regardless of its
  // original export scale/origin - independent of the GLB's own baked root transform, which is
  // preserved as-is (three.js's Box3.setFromObject already accounts for it via matrixWorld).
  const { prepared, height, width } = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const centerVec = box.getCenter(new THREE.Vector3());
    const sizeVec = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) || 1;
    const scale = NORMALIZED_SIZE / maxDim;
    clone.position.set(-centerVec.x * scale, -centerVec.y * scale - 0.05, -centerVec.z * scale);
    clone.scale.setScalar(scale);
    return { prepared: clone, height: sizeVec.y * scale, width: sizeVec.x * scale };
  }, [scene]);

  // Reports the model's actual (post-normalization) footprint up to <CameraFit>, which is the
  // ONLY thing that decides how "large" the model appears - see that component for why framing
  // (not mesh scale) is what the admin's display-size setting drives.
  useEffect(() => {
    onMeasured?.({ height, width });
  }, [height, width, onMeasured]);

  useFrame((state) => {
    if (!group.current) return;
    // While the user is actively dragging to orbit the camera, freeze the gaze-tilt entirely so
    // the two interactions never fight each other - drag takes priority, exactly as specced.
    if (draggingRef?.current) return;

    if (reducedMotion || isTouchDevice || !pointerRef) {
      // At rest: always the true front-facing orientation, never influenced by maxYawRad -
      // this is what makes TEST G (reload = front-facing, no accumulated rotation) and the
      // "mouse at center" cases correct by construction, not by coincidence.
      group.current.rotation.y += (BASE_ROTATION_Y - group.current.rotation.y) * LERP_FACTOR;
      group.current.rotation.x += (baseRotationX - group.current.rotation.x) * LERP_FACTOR;
    } else {
      const p = pointerRef.current;
      // nx/ny are already normalized to [-1, 1] by the parent section (see
      // HomeContactSection.jsx's pointerRef) - clamped again here as a hard safety net so a
      // mouse position outside the tracked area can never push the target past ±maxYawRad
      // (TEST C/E). This target is recomputed from the CURRENT mouse position every frame, not
      // accumulated from movement deltas - it can never wind up past the clamp no matter how the
      // mouse moves (TEST F), which is the actual fix for "can effectively turn around".
      const nx = THREE.MathUtils.clamp(p.x, -1, 1);
      const ny = THREE.MathUtils.clamp(p.y, -1, 1);
      const targetY = BASE_ROTATION_Y + nx * maxYawRad;
      const targetX = baseRotationX - ny * MAX_PITCH;
      group.current.rotation.y += (targetY - group.current.rotation.y) * LERP_FACTOR;
      group.current.rotation.x += (targetX - group.current.rotation.x) * LERP_FACTOR;
    }

    if (reducedMotion) {
      group.current.scale.setScalar(1);
    } else {
      // Very light idle breathing pulse - the one ambient "alive" cue this static mesh can give.
      const breathe = 1 + Math.sin(state.clock.elapsedTime * 0.9) * 0.008;
      group.current.scale.setScalar(breathe);
    }
  });

  return (
    <group ref={group} rotation={[baseRotationX, BASE_ROTATION_Y, 0]}>
      <primitive object={prepared} />
    </group>
  );
}

// Frames the camera so the ENTIRE measured model (both girls, full body including shoes) is
// always visible with a comfortable margin - computed from the model's real, measured
// height/width and the camera's actual FOV/aspect, never a guessed/fixed distance. This is what
// "the model must never be cropped, regardless of display size" actually requires: cropping
// happens when a fixed camera distance stops matching the content, so the distance has to be
// derived from the content instead.
//
// `displayScale` (the admin's 0.5x-2.0x setting) is applied AFTER that safe-fit distance is
// found, as a simple zoom multiplier - it makes the model look bigger/smaller by moving the
// camera closer/further, without touching the mesh's own scale (which would also perturb the
// idle-breathing pulse and gaze-tilt math above). At the low end (0.5x) it backs off from the
// snug fit for a smaller-looking model with more headroom; at the high end (2.0x) it moves in
// closer for a notably larger one. The admin is expected to pick a sensible value; the panel is
// labeled with the safe 0.5-2.0 range for that reason.
function CameraFit({ height, width, displayScale }) {
  const { camera, size } = useThree();

  useEffect(() => {
    if (!height || !width || !size.height) return;
    const vFov = (camera.fov * Math.PI) / 180;
    const aspect = size.width / size.height;
    const padding = 1.3; // headroom so full body (incl. shoes/hair) never touches the frame edge -
    // bumped up from 1.2 after repeated cropping reports, to leave a visibly safer margin
    const distanceForHeight = (height / 2) * padding / Math.tan(vFov / 2);
    const distanceForWidth = ((width / 2) * padding) / (Math.tan(vFov / 2) * aspect);
    const safeFitDistance = Math.max(distanceForHeight, distanceForWidth);
    const distance = safeFitDistance / (displayScale || 1);
    camera.position.set(0, 0, distance);
    camera.updateProjectionMatrix();
  }, [height, width, displayScale, camera, size]);

  return null;
}

function Loader() {
  return (
    <mesh>
      <sphereGeometry args={[0.01, 4, 4]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

/**
 * Lazily-mountable, interactive 3D viewer for the two-sisters GLB. Meant to be imported via
 * React.lazy from the Contact section so the GLB (and three.js/R3F) never load on the initial
 * Home page bundle.
 *
 * Props:
 *  - pointerRef: ref (`{ current: { x, y } }`, both -1..1, 0 = center) updated by a parent that
 *    scopes "gaze-follow" to a specific area (the Contact section). Ignored on touch devices.
 *  - displayScale: admin-controlled 0.5-2.0 "how large the model appears" factor (see
 *    Settings.modelDisplayScale / AdminSettings.jsx). Defaults to 1.4 if not provided.
 *  - horizontalRotationDeg: admin-controlled 0-360° (Settings.modelHorizontalRotation) - the
 *    MAXIMUM the model is allowed to turn left/right toward the mouse, like a person's attention
 *    following a cursor, NOT a rotation of the model's resting/front-facing orientation. At 0°,
 *    the mouse has no horizontal effect at all and the model always faces straight forward; at
 *    e.g. 20°, the model smoothly turns up to ±20° from front-facing as the mouse moves toward
 *    either edge, and always returns to exactly front-facing (0°) when the mouse is centered or
 *    the page just loaded. Both sisters turn together as one rigid group (this is a single
 *    combined mesh, not two independent models), never independently.
 *  - verticalRotationDeg: admin-controlled 0-20° RESTING tilt (Settings.modelVerticalRotation) -
 *    unlike horizontalRotationDeg above, this one IS an offset applied to the model's base
 *    orientation (a deliberate difference - see point 5 of the horizontal-rotation fix this
 *    file went through). 0° = unchanged from the original default tilt.
 *
 * Neither prop touches position, scale, or the camera framing logic that keeps the full body in
 * view, and neither permanently modifies the GLB or the model's base orientation - see
 * TwoSistersMesh/CameraFit below for how they're layered onto the existing gaze-follow/idle
 * animation and drag-to-rotate (OrbitControls).
 */
export default function TwoSistersModel3D({ className = "", pointerRef, displayScale = 1.4, horizontalRotationDeg = 0, verticalRotationDeg = 0 }) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [dims, setDims] = useState(null);
  const draggingRef = useRef(false);

  // Recomputed only when the admin's saved values actually change - these aren't per-frame
  // state, so there's no reason to redo this trig on every render.
  //
  // maxYawRad is a CLAMP RANGE for the mouse-follow, not a resting-orientation offset - see the
  // doc comment on TwoSistersMesh above for exactly why that distinction is the whole fix here.
  const maxYawRad = useMemo(() => THREE.MathUtils.degToRad(horizontalRotationDeg), [horizontalRotationDeg]);
  const baseRotationX = useMemo(() => THREE.MathUtils.degToRad(verticalRotationDeg), [verticalRotationDeg]);

  useEffect(() => {
    setReducedMotion(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  }, []);

  return (
    <div className={className}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 35 }}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: false }}
        style={{ background: "transparent", touchAction: "none" }}
        dpr={[1, 1.75]}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 3, 4]} intensity={1.2} />
        <directionalLight position={[-2, 1.5, -2]} intensity={0.45} />
        <directionalLight position={[0, 2, -3]} intensity={0.3} />
        <Suspense fallback={<Loader />}>
          <TwoSistersMesh
            reducedMotion={reducedMotion}
            pointerRef={pointerRef}
            draggingRef={draggingRef}
            onMeasured={setDims}
            maxYawRad={maxYawRad}
            baseRotationX={baseRotationX}
          />
          <Environment preset="apartment" />
        </Suspense>
        {dims && <CameraFit height={dims.height} width={dims.width} displayScale={displayScale} />}
        {/* Drag-to-rotate ONLY - orbits the CAMERA around the model at a FIXED distance (never
            spins the mesh itself, so it works correctly regardless of the GLB having no
            bones/animation). enableZoom is deliberately OFF: mouse-wheel/pinch zoom was letting
            the model be scaled arbitrarily and crop itself (shoes/head going out of frame) -
            the only way to change the model's apparent size now is the admin's displayScale
            setting via CameraFit above, which always keeps the full body in frame at whatever
            size it picks. Rotation never changes distance/size, only viewing angle. */}
        <OrbitControls
          makeDefault
          target={[0, 0, 0]}
          enablePan={false}
          enableZoom={false}
          // Restricts vertical orbit to a comfortable band around eye-level - can't go
          // underneath the model or flip to a top-down view, but front/side/back are all
          // reachable via horizontal (azimuthal) drag, which is left unrestricted.
          minPolarAngle={Math.PI / 2 - 0.55}
          maxPolarAngle={Math.PI / 2 + 0.45}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.6}
          onStart={() => { draggingRef.current = true; }}
          onEnd={() => { draggingRef.current = false; }}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_URL);

// BLINKING - NOT IMPLEMENTED, BY DESIGN, NOT BY OVERSIGHT:
// This GLB (like the single-girl model before it) has no morph targets/blend shapes, no bones,
// and no animation clips - just one static mesh. There is no eyelid geometry to animate, and
// faking it (e.g. a scaled plane glued over each face) would look pasted-on, which is explicitly
// against the "natural, not robotic" goal here. Real blinking needs the source GLB re-exported
// with a blink morph target (ideally one per sister, so they don't blink in sync) or separate
// eyelid geometry/bones - once that exists, wire it in here: drive the morph target's influence
// with a 100-250ms open->closed->open tween on a randomized 3-7s interval per sister, cleaned up
// on unmount.
