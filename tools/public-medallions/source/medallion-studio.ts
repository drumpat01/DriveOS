import { Color, Mesh, MeshBasicMaterial, PlaneGeometry, Scene } from 'three';

/**
 * A small, offline product-photography studio for PMREMGenerator.fromScene().
 * RGB triples are linear radiance, not display colors. The positive background
 * covers the full sphere, so turning the coin never exposes a black hemisphere.
 */
export function createMedallionStudio() {
  const scene = new Scene();
  scene.name = 'medallion-studio';
  scene.background = new Color(0.34, 0.36, 0.4);
  const geometry = new PlaneGeometry(1, 1);
  const materials: MeshBasicMaterial[] = [];

  function panel(name: string, position: [number, number, number], size: [number, number],
    radiance: number, tint: [number, number, number] = [1, 1, 1]) {
    const material = new MeshBasicMaterial({
      color: new Color(...tint).multiplyScalar(radiance),
      toneMapped: false,
    });
    materials.push(material);
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.scale.set(size[0], size[1], 1);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  }

  // Broad cards make smooth reflected sweeps, instead of point-light pinpricks.
  // Front and reverse both receive key/fill cards, with only a subtle warm/cool
  // difference; theme color should come from the coin's materials and artwork.
  panel('front-key', [-3.4, 2.8, 4.5], [4.5, 5.5], 2.8, [1, 0.98, 0.94]);
  panel('front-fill', [4.3, 0.4, 3.2], [3.6, 6], 1.8, [0.95, 0.98, 1]);
  panel('reverse-key', [3.2, 2.3, -4.5], [4.2, 5.2], 2.5, [1, 0.98, 0.94]);
  panel('reverse-fill', [-4.1, 0.3, -3.4], [3.5, 5.5], 1.7, [0.96, 0.98, 1]);
  panel('ceiling-softbox', [0, 5.8, 0], [6, 7], 1.65);
  panel('lower-bounce', [0, -5.5, 0], [6, 6], 0.7, [1, 0.96, 0.9]);

  let disposed = false;
  return {
    scene,
    dispose() {
      if (disposed) return;
      disposed = true;
      geometry.dispose();
      materials.forEach(material => material.dispose());
      scene.clear();
    },
  };
}
