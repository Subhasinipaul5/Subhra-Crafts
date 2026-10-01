import { lazy, Suspense, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { INSTAGRAM_URL, buildWhatsAppUrl } from "../config";
import api from "../api/client";
import DecorativeBackground from "./three/DecorativeBackground";
import DoodlePhrase from "./DoodlePhrase";
import AnimatedDoodles from "./AnimatedDoodles";
import Reveal from "./Reveal";

// Real destinations still power every link below (INSTAGRAM_URL, buildWhatsAppUrl(), and
// CONTACT_EMAIL here) - only their visible text was replaced with generic copy per the owner's
// request that the actual handle/number/address never render as visible text anywhere on the
// site (including hover/tooltip text - none of these three links carry a title or aria-label
// that would leak them either).
const CONTACT_EMAIL = "paulsubhasini31@gmail.com";

// The two-sisters 3D model (React Three Fiber + the GLB) is genuinely heavy - lazy-loaded so
// it's never part of the Home page's initial bundle, and only actually mounted once this
// section is scrolled into view (see the IntersectionObserver below).
const TwoSistersModel3D = lazy(() => import("./three/TwoSistersModel3D"));

function GirlLoadingFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-rose/40 border-t-rose animate-spin" />
    </div>
  );
}

export default function HomeContactSection() {
  const sectionRef = useRef(null);
  const [showGirl, setShowGirl] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [modelDisplayScale, setModelDisplayScale] = useState(1.4);
  const [modelHorizontalRotation, setModelHorizontalRotation] = useState(0);
  const [modelVerticalRotation, setModelVerticalRotation] = useState(0);
  // Shared with TwoSistersModel3D so the model's cursor-follow is scoped to "moving the mouse
  // over this section" (per spec) rather than the whole window - updated here, read there.
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    api.get("/settings").then((res) => {
      if (res.data?.modelDisplayScale) setModelDisplayScale(res.data.modelDisplayScale);
      if (res.data?.modelHorizontalRotation !== undefined) setModelHorizontalRotation(res.data.modelHorizontalRotation);
      if (res.data?.modelVerticalRotation !== undefined) setModelVerticalRotation(res.data.modelVerticalRotation);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!sectionRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowGirl(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const handlePointerMove = (e) => {
    const rect = sectionRef.current?.getBoundingClientRect();
    if (!rect) return;
    pointerRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerRef.current.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
  };
  const handlePointerLeave = () => {
    // Snaps the follow target back to center - the model lerps smoothly from here back to its
    // front-facing default rotation, it doesn't jump.
    pointerRef.current.x = 0;
    pointerRef.current.y = 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const msg = `Hello SubhRa Crafts!\nSubject: ${form.subject || "-"}\n${form.message}\n- ${form.name} (${form.email})`;
    window.open(buildWhatsAppUrl(msg), "_blank");
    toast.success("Opening WhatsApp...");
  };

  return (
    <section
      ref={sectionRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative overflow-hidden bg-gradient-to-b from-cream to-blush/30 py-10 sm:py-12"
    >
      <DecorativeBackground theme="bokeh" />
      <AnimatedDoodles variant="mandala" />

      {/* Handwritten contact doodles - more visible than before (higher opacity, bolder
          colors), tucked into the corners of the LEFT/RIGHT columns away from the model and
          away from form fields/cards, matching the reference's intentional (not scattered)
          placement around the three-column composition. */}
      <div className="hidden sm:block absolute inset-0 pointer-events-none select-none" aria-hidden="true">
        <DoodlePhrase text="Let's Connect ♡" className="top-4 left-[3%] opacity-85" color="#7a2f4b" rotate={-6} size="text-2xl" />
        <DoodlePhrase text="Say Hello ✨" className="bottom-6 left-[4%] opacity-75" color="#d6538a" rotate={4} size="text-lg" />
        <DoodlePhrase text="We will love to hear your thoughts ♡" className="bottom-6 right-[2%] opacity-80 max-w-[230px] whitespace-normal text-right" color="#d6538a" rotate={3} size="text-lg" />
        <DoodlePhrase text="✉" className="top-[36%] right-[3%] opacity-70" color="#8b5cf6" rotate={-8} size="text-3xl" />
        <DoodlePhrase text="✨" className="top-10 right-[16%] opacity-70" color="#c98a3e" rotate={0} size="text-2xl" />
        <DoodlePhrase text="✦" className="top-[18%] left-[10%] opacity-60" color="#8b5cf6" rotate={0} size="text-2xl" />
      </div>

      {/*
        Three-column composition (desktop): LEFT ~35% "Get in Touch" content, CENTER ~30% the
        3D models, RIGHT ~35% the form - matching the reference layout exactly, rather than the
        previous 2-column (model | everything else) arrangement.
        Tablet/mobile: stacks as Get in Touch -> models -> form (grid-cols-1, source order).
      */}
      <div className="relative max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-[35fr_30fr_35fr] gap-8 lg:gap-6 items-center">
        {/* LEFT ~35% - heading, supporting text, contact cards */}
        <div className="order-1">
          <Reveal>
            <div className="text-xs tracking-[0.3em] uppercase text-rose mb-2">Get in Touch</div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl text-plum dark:text-cream mb-2.5">
              We'd Love to Hear from You
            </h2>
            <p className="text-sm text-plum-light/80 dark:text-cream/80 mb-5 max-w-md">
              Have a question, custom request, or just want to say hello? We're here for you!
            </p>
          </Reveal>

          <div className="space-y-2.5">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-4 rounded-xl2 border border-blush bg-white/60 dark:bg-white/5 px-5 py-2.5 hover:shadow-soft transition-shadow"
            >
              <span className="w-9 h-9 rounded-full bg-rose/15 text-rose flex items-center justify-center text-base">📸</span>
              <span className="flex-1">
                <span className="block text-sm font-medium text-plum dark:text-cream">Instagram</span>
                {/* The section/icon/link stays fully functional (INSTAGRAM_URL above) - only
                    the actual handle as visible text is removed, per the owner's request. */}
                <span className="block text-xs text-plum-light/70 dark:text-cream/70">Follow us on Instagram</span>
              </span>
              <span className="text-rose">→</span>
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="flex items-center gap-4 rounded-xl2 border border-blush bg-white/60 dark:bg-white/5 px-5 py-2.5 hover:shadow-soft transition-shadow"
            >
              <span className="w-9 h-9 rounded-full bg-rose/15 text-rose flex items-center justify-center text-base">✉️</span>
              <span className="flex-1">
                <span className="block text-sm font-medium text-plum dark:text-cream">Email</span>
                {/* The section/icon/action stays - only the raw address as visible text is
                    removed, per the owner's request. Clicking still opens the same mailto:
                    action (CONTACT_EMAIL above), so the Email option is fully functional. */}
                <span className="block text-xs text-plum-light/70 dark:text-cream/70">Send us an email</span>
              </span>
              <span className="text-rose">→</span>
            </a>
            <a
              href={buildWhatsAppUrl()}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-4 rounded-xl2 border border-blush bg-white/60 dark:bg-white/5 px-5 py-2.5 hover:shadow-soft transition-shadow"
            >
              <span className="w-9 h-9 rounded-full bg-rose/15 text-rose flex items-center justify-center text-base">💬</span>
              <span className="flex-1">
                <span className="block text-sm font-medium text-plum dark:text-cream">WhatsApp</span>
                {/* The section/icon/link stays fully functional (buildWhatsAppUrl() above) -
                    only the actual phone number as visible text is removed. */}
                <span className="block text-xs text-plum-light/70 dark:text-cream/70">Chat with us on WhatsApp</span>
              </span>
              <span className="text-rose">→</span>
            </a>
          </div>
        </div>

        {/* CENTER ~30% - the 3D models. Generously sized and centered; framing is computed from
            the model's real bounding box (see TwoSistersModel3D/CameraFit) so head-to-shoes stay
            visible at any admin-configured display scale, not just the default. */}
        <div className="order-2 relative h-[440px] sm:h-[520px] lg:h-[640px] flex items-center justify-center">
          {showGirl ? (
            <Suspense fallback={<GirlLoadingFallback />}>
              <TwoSistersModel3D
                className="w-full h-full"
                pointerRef={pointerRef}
                displayScale={modelDisplayScale}
                horizontalRotationDeg={modelHorizontalRotation}
                verticalRotationDeg={modelVerticalRotation}
              />
            </Suspense>
          ) : (
            <GirlLoadingFallback />
          )}
        </div>

        {/* RIGHT ~35% - the form, in its own elegant card so it stays visually balanced against
            the model rather than sprawling the full column width. */}
        <div className="order-3">
          <form onSubmit={handleSubmit} className="card p-5 sm:p-6 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                required
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-blush rounded-lg px-4 py-2.5 bg-white/70"
              />
              <input
                required
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-blush rounded-lg px-4 py-2.5 bg-white/70"
              />
            </div>
            <input
              placeholder="Subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full border border-blush rounded-lg px-4 py-2.5 bg-white/70"
            />
            <textarea
              required
              rows={4}
              placeholder="Message"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full border border-blush rounded-lg px-4 py-2.5 bg-white/70"
            />
            <button className="btn-primary w-full sm:w-auto">Send Message →</button>
          </form>
        </div>
      </div>
    </section>
  );
}
