import React, { useEffect, useRef, useState } from "react";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

// ============================================================================
// FEATURE 5-8: Virtual Try-On
//
// Architecture: one modal shell (camera lifecycle, permission/error/loading UI) that hands
// off actual pixel placement to a small "adapter" per detection target. This is the extension
// point the spec asks for - a brand-new category only needs a new adapter registered in
// ADAPTERS below, nothing else changes.
//
//   FaceAdapter    -> targets: ears, neck, ears_neck, hair, face (uses MediaPipe FaceLandmarker,
//                      the one AI model this project ships - real landmark-based placement)
//   ManualAdapter  -> targets: wrist, hand, table, custom (anything with no shipped landmark
//                      model). Honest fallback: the customer positions/resizes/rotates the
//                      product image on top of the live camera themselves - never a fake
//                      "detection".
// ============================================================================

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const FACE_TARGETS = ["ears", "neck", "ears_neck", "hair", "face"];

function pickAdapter(targets) {
  if (targets?.some((t) => FACE_TARGETS.includes(t))) return "face";
  return "manual";
}

function useLoadedImage(url) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    if (!url) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ref.current = img;
      setReady(true);
    };
    img.src = url;
  }, [url]);
  return [ref, ready];
}

// ---------------------------------------------------------------------------
// FaceAdapter: real MediaPipe face-landmark detection, drives ear + neck placement.
//
// FEATURE 4/5/6 (this round) - actual product SIZE (width/height in cm) is set by the admin
// per variant (see AdminProducts.jsx / AdminVirtualTryOn.jsx) and is NEVER touched here based
// on customer input - `w`/`h` below are derived only from `earAsset.widthCm/heightCm` and
// `neckAsset.widthCm/heightCm` plus the live face-scale reference, exactly as before. The only
// thing customer controls can move is POSITION: `controlsRef.current.earGap` (how far apart the
// two earrings sit) and `.neckOffset` (how high/low the necklace sits, layered on top of the
// admin's own saved yOffset baseline). Both are read fresh every frame from a ref - not React
// state - so dragging a slider never re-triggers the model/camera setup in the effect below.
// ---------------------------------------------------------------------------
function FaceAdapter({ videoRef, canvasRef, assets, controlsRef, onReady, onError }) {
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const earImg = useLoadedImage(assets.find((a) => a.target === "ears")?.image?.url);
  const neckImg = useLoadedImage(assets.find((a) => a.target === "neck")?.image?.url);
  const earAsset = assets.find((a) => a.target === "ears");
  const neckAsset = assets.find((a) => a.target === "neck");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
        });
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        onReady();
        loop();
      } catch (err) {
        console.error("Virtual Try-On (face model) error:", err);
        onError("Could not load the face detection model. Please check your connection and try again.");
      }
    })();

    const loop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !canvas || !landmarker || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const result = landmarker.detectForVideo(video, performance.now());
      if (result.faceLandmarks?.length > 0) {
        draw(ctx, result.faceLandmarks[0], canvas);
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    const draw = (ctx, lm, canvas) => {
      // Outer face-edge points, used as a stable width reference to scale product art against.
      const leftFace = lm[234];
      const rightFace = lm[454];
      const faceWidthPx = Math.abs(rightFace.x - leftFace.x) * canvas.width;
      const live = controlsRef.current;

      if (earAsset && earImg[1] && earImg[0].current) {
        // SIZE - fixed, admin-configured, never changed by customer input.
        const scale = faceWidthPx / 15; // ~15cm average face width reference
        const w = Math.max(20, (earAsset.widthCm || 3) * scale);
        const h = w * ((earAsset.heightCm || 6) / (earAsset.widthCm || 3));
        // GAP - the only thing the customer's "Earring Distance" slider affects: how far each
        // earring sits from its landmark anchor, pushed outward (positive) or pulled inward
        // (negative). Symmetric on both sides, so the necklace... er, the pair stays centered.
        const gapPx = (live.earGap || 0) * (faceWidthPx / 100);
        // VERTICAL OFFSET - the "Earring Position" slider. Applied identically to both earrings
        // (same value, same sign) AFTER the per-side horizontal gap above, so it only ever moves
        // both earrings up/down together and never touches their horizontal distance from each
        // other or from their landmark anchors.
        const vOffsetPx = (live.earVOffset || 0) * (faceWidthPx / 100);
        [lm[234], lm[454]].forEach((pt, i) => {
          const side = i === 0 ? -1 : 1;
          const x = pt.x * canvas.width + side * gapPx;
          const y = pt.y * canvas.height + vOffsetPx;
          const drawX = i === 0 ? x - w + w * 0.15 : x - w * 0.15;
          ctx.drawImage(earImg[0].current, drawX, y + h * 0.08, w, h);
        });
      }

      if (neckAsset && neckImg[1] && neckImg[0].current) {
        // No shoulder/pose landmarks are loaded in this build, so the neck anchor is
        // approximated from the chin point - a well-understood approximation used when only a
        // face mesh (not a body pose model) is available.
        const chin = lm[152];
        const forehead = lm[10];
        const faceHeightPx = Math.abs(chin.y - forehead.y) * canvas.height;
        // SIZE - fixed, admin-configured, never changed by customer input.
        const scale = faceWidthPx / 13;
        const w = Math.max(30, (neckAsset.widthCm || 12) * scale);
        const h = w * ((neckAsset.heightCm || 10) / (neckAsset.widthCm || 12));
        // POSITION - two layered vertical offsets, both proportional to face height so they
        // scale sensibly at any distance from the camera: the admin's own saved baseline
        // (yOffset, set once in Admin > Products/Virtual Try-On) PLUS the customer's live
        // "Necklace Position" slider for this session only (never saved, never affects size).
        const adminYOffsetPx = (neckAsset.yOffset || 0) * (faceHeightPx / 100);
        const customerYOffsetPx = (live.neckOffset || 0) * (faceHeightPx / 100);
        const x = chin.x * canvas.width - w / 2;
        const y = chin.y * canvas.height + faceHeightPx * 0.35 + adminYOffsetPx + customerYOffsetPx;
        ctx.drawImage(neckImg[0].current, x, y, w, h);
      }
    };

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earImg[1], neckImg[1]]);

  return null;
}

// ---------------------------------------------------------------------------
// ManualAdapter: honest fallback for targets with no shipped AI model (wrist, hand, table,
// hair, custom). The customer drags/resizes/rotates the product image over the live camera
// feed themselves. This never pretends automatic detection exists.
// ---------------------------------------------------------------------------
function ManualAdapter({ containerRef, assets, onReady }) {
  const asset = assets[0];
  const [imgRef, ready] = useLoadedImage(asset?.image?.url);
  const [box, setBox] = useState({ x: 0.5, y: 0.5, scale: 1, rotate: 0 });
  const dragState = useRef(null);

  useEffect(() => {
    if (ready) onReady();
  }, [ready, onReady]);

  if (!asset) return null;

  const startDrag = (e) => {
    e.preventDefault();
    const point = e.touches ? e.touches[0] : e;
    dragState.current = { startX: point.clientX, startY: point.clientY, box: { ...box } };
  };
  const onMove = (e) => {
    if (!dragState.current || !containerRef.current) return;
    const point = e.touches ? e.touches[0] : e;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = (point.clientX - dragState.current.startX) / rect.width;
    const dy = (point.clientY - dragState.current.startY) / rect.height;
    setBox((b) => ({ ...b, x: dragState.current.box.x + dx, y: dragState.current.box.y + dy }));
  };
  const endDrag = () => {
    dragState.current = null;
  };

  const baseWidth = 140 * box.scale;
  const aspect = (asset.heightCm || 10) / (asset.widthCm || 10);

  return (
    <>
      <div
        onMouseDown={startDrag}
        onMouseMove={onMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onTouchStart={startDrag}
        onTouchMove={onMove}
        onTouchEnd={endDrag}
        style={{
          position: "absolute",
          left: `${box.x * 100}%`,
          top: `${box.y * 100}%`,
          width: baseWidth,
          height: baseWidth * aspect,
          transform: `translate(-50%, -50%) rotate(${box.rotate}deg)`,
          cursor: "grab",
          touchAction: "none",
        }}
      >
        {imgRef.current && (
          <img src={asset.image.url} alt="" draggable={false} className="w-full h-full object-contain pointer-events-none select-none" />
        )}
        <div className="absolute -inset-2 border-2 border-dashed border-white/70 rounded" />
      </div>

      {/* Manual controls */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 bg-black/60 rounded-full px-4 py-2 flex items-center gap-4 text-white text-sm">
        <button onClick={() => setBox((b) => ({ ...b, scale: Math.max(0.4, b.scale - 0.1) }))}>− Size</button>
        <button onClick={() => setBox((b) => ({ ...b, scale: Math.min(2.5, b.scale + 0.1) }))}>+ Size</button>
        <button onClick={() => setBox((b) => ({ ...b, rotate: b.rotate - 15 }))}>⟲ Rotate</button>
        <button onClick={() => setBox((b) => ({ ...b, rotate: b.rotate + 15 }))}>⟳ Rotate</button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// TryOnGapControls: the "Position/Gap" sliders, extracted as its own component so it can be
// rendered in TWO places that both edit the SAME live state:
//   1) Standalone, in a light popover on the product page next to the "Try-On Control" button
//      (see ProductDetails.jsx) - so the customer can set their preferred gap before even
//      opening the camera.
//   2) Inside the live camera overlay itself (dark/translucent styling), so they can fine-tune
//      while actually seeing it on their face.
// Both call the same onEarGapChange/onNeckOffsetChange, so adjusting it in either place keeps
// the other in sync. Size is never shown or editable here - see the callers for why.
// ---------------------------------------------------------------------------
export function TryOnGapControls({ earAvailable, neckAvailable, earGap, earVOffset, neckOffset, onEarGapChange, onEarVOffsetChange, onNeckOffsetChange, variant = "overlay" }) {
  if (!earAvailable && !neckAvailable) return null;
  const dark = variant === "overlay";
  const textClass = dark ? "text-white/90" : "text-plum-dark";
  const subTextClass = dark ? "text-white/60" : "text-plum-light/60";
  const accentClass = dark ? "accent-white" : "accent-plum";

  return (
    <div className={dark ? "space-y-3" : "space-y-4"}>
      {earAvailable && (
        <div>
          <div className={`flex justify-between text-xs mb-1 ${textClass}`}>
            <span>👂 Earring Distance</span>
          </div>
          <input
            type="range"
            min={-20}
            max={20}
            step={1}
            value={earGap}
            onChange={(e) => onEarGapChange(Number(e.target.value))}
            className={`w-full ${accentClass}`}
          />
          <div className={`flex justify-between text-[10px] ${subTextClass}`}>
            <span>Closer</span><span>Farther Apart</span>
          </div>
        </div>
      )}
      {earAvailable && (
        <div>
          <div className={`flex justify-between text-xs mb-1 ${textClass}`}>
            <span>💎 Earring Position</span>
          </div>
          <input
            type="range"
            min={-20}
            max={20}
            step={1}
            value={earVOffset}
            onChange={(e) => onEarVOffsetChange(Number(e.target.value))}
            className={`w-full ${accentClass}`}
          />
          <div className={`flex justify-between text-[10px] ${subTextClass}`}>
            <span>Higher</span><span>Lower</span>
          </div>
        </div>
      )}
      {neckAvailable && (
        <div>
          <div className={`flex justify-between text-xs mb-1 ${textClass}`}>
            <span>💎 Necklace Position</span>
          </div>
          <input
            type="range"
            min={-20}
            max={20}
            step={1}
            value={neckOffset}
            onChange={(e) => onNeckOffsetChange(Number(e.target.value))}
            className={`w-full ${accentClass}`}
          />
          <div className={`flex justify-between text-[10px] ${subTextClass}`}>
            <span>Higher</span><span>Lower</span>
          </div>
        </div>
      )}
      <p className={`text-[10px] text-center pt-0.5 ${subTextClass}`}>
        Actual size matches the real product — only position is adjustable here.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal shell: camera lifecycle + permission/error/loading states, shared by every adapter.
//
// `initialControls` / `onControlsChange` let the gap/position the customer set via the
// standalone "Try-On Control" button (see ProductDetails.jsx) carry straight into the camera
// view when it opens, and let further adjustments made INSIDE the camera view flow back out so
// the standalone panel stays in sync too - one shared value, two places to edit it.
// ---------------------------------------------------------------------------
export default function VirtualTryOnModal({ itemLabel, targets = [], assets = [], initialControls, onControlsChange, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const streamRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [cameraError, setCameraError] = useState("");
  const [modelReady, setModelReady] = useState(false);

  const adapter = pickAdapter(targets);
  const earAsset = assets.find((a) => a.target === "ears");
  const neckAsset = assets.find((a) => a.target === "neck");

  // FEATURE 4/5/6 (this round) - live customer POSITION controls, read every animation frame
  // by FaceAdapter via this ref (see comment there). Kept in a ref (not just state) so dragging
  // a slider doesn't reinitialize the camera/model - only React state (below) drives the slider
  // UI itself. Session-only: never sent to the server, never changes the admin-configured size.
  const controlsRef = useRef({ earGap: initialControls?.earGap || 0, earVOffset: initialControls?.earVOffset || 0, neckOffset: initialControls?.neckOffset || 0 });
  const [earGap, setEarGap] = useState(initialControls?.earGap || 0);
  const [earVOffset, setEarVOffset] = useState(initialControls?.earVOffset || 0);
  const [neckOffset, setNeckOffset] = useState(initialControls?.neckOffset || 0);
  // Adjustment panel: CLOSED by default (see the whole point of this feature) - only the small
  // gear button is visible until the customer taps it. panelRef/buttonRef back the
  // outside-pointerdown-closes logic below; both are excluded from "outside" so dragging a
  // slider (inside panelRef) or re-tapping the gear (buttonRef) never closes it.
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef(null);
  const gearButtonRef = useRef(null);

  const setEarGapLive = (v) => {
    setEarGap(v);
    controlsRef.current.earGap = v;
    onControlsChange?.({ earGap: v, earVOffset: controlsRef.current.earVOffset, neckOffset: controlsRef.current.neckOffset });
  };
  const setEarVOffsetLive = (v) => {
    setEarVOffset(v);
    controlsRef.current.earVOffset = v;
    onControlsChange?.({ earGap: controlsRef.current.earGap, earVOffset: v, neckOffset: controlsRef.current.neckOffset });
  };
  const setNeckOffsetLive = (v) => {
    setNeckOffset(v);
    controlsRef.current.neckOffset = v;
    onControlsChange?.({ earGap: controlsRef.current.earGap, earVOffset: controlsRef.current.earVOffset, neckOffset: v });
  };

  // pointerdown (not click) so this closes the panel the instant a touch/mouse press lands
  // outside it - covers mouse AND touch with one listener, per the spec's mobile requirement.
  // Only attached while the panel is actually open, and removed the moment it isn't, so it
  // never intercepts anything when the panel is already closed.
  useEffect(() => {
    if (!panelOpen) return;
    const handlePointerDown = (e) => {
      if (panelRef.current?.contains(e.target)) return; // inside the panel (incl. sliders) - stay open
      if (gearButtonRef.current?.contains(e.target)) return; // the gear button itself toggles on its own
      setPanelOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [panelOpen]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if (adapter === "manual") setLoading(false); // no model to wait for
      } catch (err) {
        console.error("Virtual Try-On camera error:", err);
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setCameraError("Camera permission was denied. Please allow camera access and try again.");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setCameraError("No camera was found on this device.");
        } else {
          setCameraError("Unable to start the camera. Please check your device and try again.");
        }
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (modelReady) setLoading(false);
  }, [modelReady]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      <div ref={containerRef} className="relative w-full max-w-3xl h-full md:h-[90vh] bg-black overflow-hidden">
        {/* Mirrored so the preview behaves like a normal front-camera/mirror view - a raised
            RIGHT hand shows on the RIGHT side of the screen, matching every other camera app's
            front-camera convention, instead of the raw sensor's un-mirrored orientation (which
            shows your right side on the frame's left, the way a camera facing you naturally
            sees you). Video and its landmark-driven overlay canvas are wrapped and flipped
            TOGETHER as a single rigid unit via this one CSS transform, so their relative
            alignment (jewelry glued to the face) is completely unaffected - FaceAdapter still
            reads video frames and draws onto the canvas in the exact same raw, un-flipped pixel
            space as before (see the draw() coordinate math above, untouched); only the
            DISPLAYED result is mirrored, not the underlying detection/drawing math. The close
            button, gear button and adjustment panel below are deliberately OUTSIDE this
            wrapper, so they stay anchored to their normal screen corners regardless of the
            mirrored preview. */}
        <div className="absolute inset-0 [transform:scaleX(-1)]">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay playsInline muted />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
        </div>

        {!cameraError && adapter === "face" && (
          <FaceAdapter
            videoRef={videoRef}
            canvasRef={canvasRef}
            assets={assets}
            controlsRef={controlsRef}
            onReady={() => setModelReady(true)}
            onError={(msg) => setCameraError(msg)}
          />
        )}
        {!cameraError && !loading && adapter === "manual" && (
          <ManualAdapter containerRef={containerRef} assets={assets} onReady={() => {}} />
        )}

        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-30 w-11 h-11 rounded-full bg-black/60 text-white text-2xl"
          aria-label="Close virtual try-on"
        >
          ×
        </button>

        {/* Adjustment toggle - small, corner-positioned, never covers the face. Sits just left
            of the close button so both small round controls share the same top-right row. */}
        {!loading && !cameraError && adapter === "face" && (earAsset || neckAsset) && (
          <button
            ref={gearButtonRef}
            onClick={() => setPanelOpen((v) => !v)}
            className="absolute top-5 right-20 z-30 w-11 h-11 rounded-full bg-black/60 text-white text-lg flex items-center justify-center"
            aria-label="Adjustment settings"
            aria-expanded={panelOpen}
          >
            ⚙️
          </button>
        )}

        {!loading && !cameraError && adapter === "face" && (
          <div className="absolute top-5 left-5 right-20 z-20">
            <div className="bg-black/50 text-white text-xs px-3 py-2 rounded-full inline-block">
              Face the camera and keep your face fully visible
            </div>
          </div>
        )}

        {loading && !cameraError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-white bg-black/70">
            <div className="text-center px-6">
              <div className="text-4xl mb-4">📷</div>
              <p className="text-lg">Starting Virtual Try-On...</p>
              <p className="text-sm text-gray-300 mt-2">Please allow camera access.</p>
            </div>
          </div>
        )}

        {cameraError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-white bg-black/80 p-6">
            <div className="text-center max-w-md">
              <div className="text-5xl mb-4">⚠️</div>
              <p className="text-lg mb-5">{cameraError}</p>
              <button onClick={onClose} className="px-6 py-3 rounded-lg bg-white text-black">Close</button>
            </div>
          </div>
        )}

        {!loading && !cameraError && adapter === "face" && panelOpen && (earAsset || neckAsset) && (
          <div ref={panelRef} className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-sm">
            <div className="bg-black/65 backdrop-blur rounded-2xl px-4 py-3">
              <TryOnGapControls
                earAvailable={!!earAsset}
                neckAvailable={!!neckAsset}
                earGap={earGap}
                earVOffset={earVOffset}
                neckOffset={neckOffset}
                onEarGapChange={setEarGapLive}
                onEarVOffsetChange={setEarVOffsetLive}
                onNeckOffsetChange={setNeckOffsetLive}
                variant="overlay"
              />
            </div>
          </div>
        )}

        {!loading && !cameraError && adapter !== "face" && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 text-center">
            <div className="bg-black/60 text-white px-5 py-3 rounded-full text-sm">
              Drag {itemLabel || "the item"} into place, then resize/rotate as needed
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
