"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
// imports profundos: evitam o barrel do drei (+ three-stdlib inteiro) no bundle
import { ContactShadows } from "@react-three/drei/core/ContactShadows";
import { Float } from "@react-three/drei/core/Float";
import { Sparkles } from "@react-three/drei/core/Sparkles";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { CALLOUTS, heroStore } from "@/lib/heroStore";
import CapModel from "./CapModel";

type Props = {
  onReady: () => void;
  onError: () => void;
};

/* ---------- utilidades ---------- */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

type Key = [number, number];
function keyframe(p: number, keys: Key[]) {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (p <= keys[i][0]) {
      const [p0, v0] = keys[i - 1];
      const [p1, v1] = keys[i];
      return v0 + (v1 - v0) * smooth((p - p0) / (p1 - p0));
    }
  }
  return keys[keys.length - 1][1];
}

/* ---------- roteiro do scroll story ---------- */
// callouts em 0.16 / 0.31 / 0.46 / 0.61 (ver heroStore); saída de 0.68 até 1 (fim da seção)
const ROT_Y: Key[] = [[0, 0], [0.16, 0.55], [0.31, -0.5], [0.46, 1.4], [0.61, 0.08], [0.8, 1.1], [1, 2.0]];
const ROT_X: Key[] = [[0, 0], [0.16, 0.5], [0.31, -0.22], [0.46, 0.05], [0.61, 0.1], [0.8, 0.0]];
const CAM_Z: Key[] = [[0, 5], [0.25, 4.3], [0.61, 3.5], [0.7, 3.7], [1, 7.0]];
const CAM_Z_MOBILE: Key[] = [[0, 5], [0.25, 4.8], [0.61, 4.5], [0.7, 4.6], [1, 7.0]];
const EXIT_START = 0.68;
/** Saída: começa suave e acelera, terminando fora da tela exatamente em p = 1. */
const exitY = (p: number) => -2.1 * Math.pow(clamp01((p - EXIT_START) / (1 - EXIT_START)), 1.4);
const CAP_WIDTH = 2.5;

function Rig({ onReady, onError }: Props) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const keyLight = useRef<THREE.SpotLight>(null);
  const rimLight = useRef<THREE.SpotLight>(null);
  const fillLight = useRef<THREE.PointLight>(null);
  const rimLight2 = useRef<THREE.SpotLight>(null);
  const { camera, size } = useThree();

  const start = useRef<number | null>(null);
  const auto = useRef(0);
  const drag = useRef(0);
  const tilt = useRef({ x: 0, y: 0 });

  const tmp = useRef(new THREE.Vector3());
  const [shadowsOn, setShadowsOn] = useState(false);
  const frameNo = useRef(0);

  useFrame((state, dt) => {
    frameNo.current++;
    if (frameNo.current === 5 && !shadowsOn) {
      performance.mark("hero:stage-shadows");
      setShadowsOn(true);
    }
    const o = outer.current;
    const g = inner.current;
    if (!o || !g) return;
    const d = Math.min(dt, 0.05);
    const { reduced, isMobile } = heroStore;
    const p = reduced ? 0 : heroStore.progress;

    // a entrada só começa quando o GLB carregou e os shaders foram compilados
    if (!heroStore.capReady) start.current = null;
    else if (start.current === null) {
      start.current = state.clock.elapsedTime;
      performance.mark("hero:entrance-start");
    }
    const t = reduced ? 99 : start.current === null ? 0 : state.clock.elapsedTime - start.current;

    /* luzes acendem */
    const lightOn = smooth(t / 0.6);
    if (keyLight.current) keyLight.current.intensity = 95 * lightOn;
    if (fillLight.current) fillLight.current.intensity = 14 * lightOn;
    if (rimLight.current) rimLight.current.intensity = 260 * lightOn;
    if (rimLight2.current) rimLight2.current.intensity = 150 * lightOn;

    /* escala base pelo viewport (câmera em z=5) */
    const cam = camera as THREE.PerspectiveCamera;
    const visibleW = 2 * 5 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * (size.width / size.height);
    const frac = isMobile ? 1.0 : 0.4;
    const base = (visibleW * frac) / CAP_WIDTH;
    const zoom = reduced ? 1 : keyframe(p, isMobile ? [[0, 1], [0.2, 0.86], [0.61, 0.9], [0.7, 0.85], [1, 0.6]] : [[0, 1], [0.61, 1.25], [0.7, 1.15], [1, 0.75]]);
    o.scale.setScalar(base * zoom);

    /* entrada: desce girando e assenta */
    const drop = 1 - easeOutCubic((t - 0.15) / 1.3);
    // em repouso o boné fica acima da copy; na story desce para o centro; no fim sai por baixo
    const restY = isMobile ? 0.62 : 0.72;
    const toCenter = reduced ? 0 : smooth(p / 0.2);
    o.position.y = restY * (1 - toCenter) + drop * 2.8 + (reduced ? 0 : exitY(p));
    const entranceRot = drop * -2.6;

    /* rotação automática (pausa durante a story), arrasto com inércia */
    const inStory = !reduced && p > 0.03;
    if (!heroStore.dragging && !inStory) auto.current += d * (reduced ? 0.25 : 0.38);
    else if (inStory) {
      // volta suavemente para a volta completa mais próxima: os keyframes da story ficam absolutos
      const turn = Math.round(auto.current / (Math.PI * 2)) * Math.PI * 2;
      auto.current = THREE.MathUtils.damp(auto.current, turn, 3, d);
    }
    drag.current += heroStore.dragImpulse;
    heroStore.dragImpulse = 0;
    if (!heroStore.dragging) {
      drag.current += heroStore.dragVelocity;
      heroStore.dragVelocity *= 0.93;
    }

    /* tilt pelo mouse (desktop) com inércia */
    const wantTilt = !isMobile && !inStory && !heroStore.dragging;
    const tx = wantTilt ? heroStore.mouse.y * 0.22 : 0;
    const ty = wantTilt ? heroStore.mouse.x * 0.35 : 0;
    tilt.current.x = THREE.MathUtils.damp(tilt.current.x, tx, 4, d);
    tilt.current.y = THREE.MathUtils.damp(tilt.current.y, ty, 4, d);

    const storyY = reduced ? 0 : keyframe(p, ROT_Y);
    const storyX = reduced ? 0 : keyframe(p, ROT_X);
    g.rotation.set(0.12 + tilt.current.x + storyX, entranceRot + auto.current + drag.current + tilt.current.y + storyY, 0);

    /* câmera aproxima durante a story */
    const z = reduced ? 5 : keyframe(p, isMobile ? CAM_Z_MOBILE : CAM_Z);
    cam.position.z = THREE.MathUtils.damp(cam.position.z, z, 6, d);
    cam.lookAt(0, 0.1, 0);

    /* callouts: projeta âncoras locais para a tela */
    g.updateWorldMatrix(true, false);
    const stage = heroStore.stageEl;
    const stageRect = stage?.getBoundingClientRect();
    CALLOUTS.forEach((c, i) => {
      const el = heroStore.calloutEls[i];
      const line = heroStore.lineEls[i];
      const dot = heroStore.dotEls[i];
      if (!el || !line || !dot) return;
      const k = reduced ? 0 : clamp01(1 - Math.abs(p - c.at) / 0.085);
      if (k <= 0.001) {
        el.style.opacity = "0";
        line.style.opacity = "0";
        dot.style.opacity = "0";
        return;
      }
      const v = tmp.current.set(c.anchor[0], c.anchor[1], c.anchor[2]);
      g.localToWorld(v);
      v.project(camera);
      const sx = (v.x * 0.5 + 0.5) * size.width;
      const sy = (1 - (v.y * 0.5 + 0.5)) * size.height;
      const ease = smooth(k);
      el.style.opacity = String(ease);
      el.style.transform = `translate3d(0, ${(1 - ease) * 10}px, 0)`;
      const r = el.getBoundingClientRect();
      const left = stageRect ? r.left - stageRect.left : r.left;
      const top = stageRect ? r.top - stageRect.top : r.top;
      const onLeft = left + r.width / 2 < size.width / 2;
      const lx = onLeft ? left + r.width : left;
      const ly = top + r.height / 2;
      const len = Math.hypot(sx - lx, sy - ly);
      line.setAttribute("x1", String(lx));
      line.setAttribute("y1", String(ly));
      line.setAttribute("x2", String(sx));
      line.setAttribute("y2", String(sy));
      line.style.strokeDasharray = String(len);
      line.style.strokeDashoffset = String(len * (1 - ease));
      line.style.opacity = String(ease);
      dot.setAttribute("cx", String(sx));
      dot.setAttribute("cy", String(sy));
      dot.setAttribute("r", String(3 + ease * 2));
      dot.style.opacity = String(ease);
    });
  });

  return (
    <>
      <spotLight
        ref={keyLight}
        position={[3.2, 3.6, 3]}
        angle={0.5}
        penumbra={0.9}
        intensity={0}
        color="#fff6ea"
        castShadow={false}
      />
      <spotLight ref={rimLight} position={[-3.5, 2.6, -3.2]} angle={0.5} penumbra={1} intensity={0} color="#ffffff" />
      <spotLight ref={rimLight2} position={[3.6, 1.8, -3]} angle={0.5} penumbra={1} intensity={0} color="#ffffff" />
      <pointLight ref={fillLight} position={[0, 1.2, 4.5]} intensity={0} color="#ffffff" />
      <ambientLight intensity={0.22} />

      <group ref={outer}>
        <Float speed={heroStore.reduced ? 0 : 1.1} rotationIntensity={0.12} floatIntensity={0.35}>
          <group ref={inner} position={[0, -0.25, 0]}>
            <CapModel onReady={onReady} onError={onError} />
          </group>
        </Float>
        {shadowsOn ? (
        <ContactShadows
          position={[0, -0.62, 0]}
          opacity={0.7}
          scale={5}
          blur={2.6}
          far={2.2}
          resolution={heroStore.isMobile ? 256 : 512}
          frames={heroStore.reduced ? 1 : Infinity}
          color="#000000"
        />
        ) : null}
      </group>
    </>
  );
}

function Effects({ isMobile }: { isMobile: boolean }) {
  useEffect(() => {
    performance.mark("hero:stage-fx");
  }, []);
  return (
    <EffectComposer multisampling={isMobile ? 0 : 4} enableNormalPass={false}>
      <Bloom luminanceThreshold={0.85} luminanceSmoothing={0.25} intensity={0.5} mipmapBlur radius={0.6} />
      <Vignette offset={0.12} darkness={0.4} eskil={false} />
    </EffectComposer>
  );
}

/** Partículas espalhadas pelo viewport inteiro, em duas camadas de profundidade. */
function SparkleField({ isMobile }: { isMobile: boolean }) {
  const { viewport } = useThree();
  useEffect(() => {
    performance.mark("hero:stage-sparkles");
  }, []);
  const w = viewport.width * 1.3;
  const h = viewport.height * 1.3;
  const area = w * h;
  const far = Math.round(Math.min(220, area * (isMobile ? 10 : 14)));
  const near = Math.round(Math.min(90, area * (isMobile ? 4 : 6)));
  return (
    <>
      <Sparkles count={far} scale={[w * 1.6, h * 1.6, 2]} position={[0, 0, -2.5]} size={1.1} speed={0.18} opacity={0.35} color="#ffffff" />
      <Sparkles count={near} scale={[w, h, 2.5]} position={[0, 0, 0.6]} size={2.2} speed={0.28} opacity={0.5} color="#ffffff" />
    </>
  );
}

/**
 * Ambiente de estúdio: três "softboxes" renderizados uma vez por uma CubeCamera (128px, HalfFloat),
 * exatamente como o <Environment> do drei fazia, mas sem arrastar os loaders HDR/EXR/gainmap para o bundle.
 */
function StudioEnv({ intensity = 0.45 }: { intensity?: number }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    performance.mark("hero:stage-env");
    const box = new THREE.Scene();
    const panel = (i: number, pos: [number, number, number], size: [number, number]) => {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false });
      mat.color.multiplyScalar(i);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), mat);
      m.position.set(...pos);
      m.lookAt(0, 0, 0);
      box.add(m);
    };
    panel(2, [0, 6, 0], [8, 8]);
    panel(1.2, [-6, 2, 1], [2, 6]);
    panel(0.6, [6, 1, -2], [2, 4]);
    const fbo = new THREE.WebGLCubeRenderTarget(128);
    fbo.texture.type = THREE.HalfFloatType;
    const cam = new THREE.CubeCamera(1, 1000, fbo);
    const autoClear = gl.autoClear;
    gl.autoClear = true;
    cam.update(gl, box);
    gl.autoClear = autoClear;
    scene.environment = fbo.texture;
    scene.environmentIntensity = intensity;
    box.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
    return () => {
      scene.environment = null;
      fbo.dispose();
    };
  }, [gl, scene, intensity]);
  return null;
}

/** Monta os auxiliares pesados um por frame (Environment, sombras, partículas, pós-processamento) para espalhar a compilação de shaders. */
function Staged({ children }: { children: ReactNode[] }) {
  const [stage, setStage] = useState(0);
  useFrame(() => {
    if (stage < children.length) setStage((s) => s + 1);
  });
  return <>{children.slice(0, stage)}</>;
}

export default function Scene({ onReady, onError }: Props) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [env] = useState(() => ({
    isMobile: typeof window !== "undefined" && window.matchMedia("(max-width: 767px), (pointer: coarse)").matches,
    reduced: typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  }));

  heroStore.isMobile = env.isMobile;
  heroStore.reduced = env.reduced;

  useEffect(() => {
    performance.mark("hero:canvas-mounted");
  }, []);

  /* pausa o render quando o canvas sai da tela */
  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrapper} className="absolute inset-0">
      <Canvas
        dpr={env.isMobile ? [1, 1.5] : [1, 2]}
        frameloop={visible ? "always" : "never"}
        camera={{ position: [0, 1.1, 5], fov: 30, near: 0.1, far: 40 }}
        gl={{ antialias: !env.isMobile, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <Rig onReady={onReady} onError={onError} />
        <Staged>
          <StudioEnv key="env" />
          <Effects key="fx" isMobile={env.isMobile} />
          {!env.reduced ? <SparkleField key="sparkles" isMobile={env.isMobile} /> : <group key="sparkles" />}
        </Staged>
      </Canvas>
    </div>
  );
}
