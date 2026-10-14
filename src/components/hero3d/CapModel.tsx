"use client";

import { Component, Suspense, type ReactNode, useEffect, useMemo } from "react";
import * as THREE from "three";
import { useLoader, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { config } from "@/lib/config";
import { heroStore } from "@/lib/heroStore";

/**
 * Boné pré-exportado (scripts/export-cap.ts → public/media/bone/bone.glb, meshopt + WebP).
 * Depois de carregar, pré-compila os shaders com gl.compileAsync e só então libera a entrada.
 */
const extendLoader = (loader: GLTFLoader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
};

function GlbCap({ onReady }: { onReady: () => void }) {
  const { scene: gltfScene } = useLoader(GLTFLoader, config.media.bone.glb, extendLoader);
  const { gl, scene, camera } = useThree();

  const cap = useMemo(() => {
    const s = gltfScene;
    s.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      // fica com frustum culling: antes da entrada o boné está acima do enquadramento
      // e não deve renderizar (a compilação é feita por gl.compile, um material por frame)
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mesh.name === "decal") {
        mat.transparent = true;
        mat.depthWrite = false;
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = -8;
        mesh.renderOrder = 1;
      }
    });
    return s;
  }, [gltfScene]);

  useEffect(() => {
    let cancelled = false;
    performance.mark("hero:glb-parsed");
    const meshes: THREE.Mesh[] = [];
    cap.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    // Pré-compila um material por frame (programas iguais são reaproveitados pelo cache do three),
    // começando dois frames depois para o Environment já ter aplicado o envMap.
    const seen = new Set<THREE.Material>();
    const queue = meshes.filter((m) => {
      const mat = m.material as THREE.Material;
      if (seen.has(mat)) return false;
      seen.add(mat);
      return true;
    });
    let wait = 6;
    let raf = 0;
    const step = () => {
      if (cancelled) return;
      if (wait > 0) {
        wait--;
        raf = requestAnimationFrame(step);
        return;
      }
      const mesh = queue.shift();
      if (mesh) {
        performance.mark("hero:compile-" + mesh.name);
        (gl as THREE.WebGLRenderer).compile(mesh, camera, scene);
        raf = requestAnimationFrame(step);
        return;
      }
      performance.mark("hero:cap-ready");
      heroStore.capReady = true;
      onReady();
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [cap, gl, scene, camera, onReady]);

  return <primitive object={cap} />;
}

class GlbBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function CapModel({ onReady, onError }: { onReady: () => void; onError: () => void }) {
  return (
    <GlbBoundary onError={onError}>
      <Suspense fallback={null}>
        <GlbCap onReady={onReady} />
      </Suspense>
    </GlbBoundary>
  );
}

useLoader.preload(GLTFLoader, config.media.bone.glb, extendLoader);
