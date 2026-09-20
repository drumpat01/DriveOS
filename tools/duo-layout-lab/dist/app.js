import * as THREE from "three";
import { OrbitControls } from "./vendor/OrbitControls.js";
import { POSTURES, clampAngle, closestPosture, layoutMetrics, panelRotations, screenPresentation } from "./model.js";

const canvas = document.querySelector("#duo-canvas");
const fallback = document.querySelector("#webgl-fallback");
const angleInput = document.querySelector("#fold-angle");
const angleOutput = document.querySelector("#angle-output");
const leftSelect = document.querySelector("#left-screen");
const rightSelect = document.querySelector("#right-screen");
const safeToggle = document.querySelector("#safe-areas");
const hingeToggle = document.querySelector("#hinge-region");
const floorToggle = document.querySelector("#studio-floor");
const autoOrbitButton = document.querySelector("#auto-orbit");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const screenSources = Object.freeze({
  home: "./assets/screens/home.webp",
  memories: "./assets/screens/memories.webp",
  soundtracks: "./assets/screens/soundtracks.webp",
  statistics: "./assets/screens/statistics.webp",
  ipad: "./assets/screens/ipad-home.png"
});

const state = {
  angle: POSTURES.book.angle,
  posture: "book",
  leftScreen: "home",
  rightScreen: "memories",
  safeAreas: false,
  showHinge: true,
  showFloor: true,
  autoOrbit: false,
  angleTween: 0,
  cameraTween: 0,
  orientationTween: 0
};

const imageCache = new Map();
const textureDrawers = [];
let renderer;
let scene;
let camera;
let controls;
let deviceRoot;
let openDevice;
let closedDevice;
let leftPivot;
let rightPivot;
let hinge;
let hingeGlow;
let floor;
let safeFrames = [];
let screenBindings;
let lastFrame = performance.now();

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function loadImage(key) {
  if (imageCache.has(key)) return imageCache.get(key);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = screenSources[key];
  });
  imageCache.set(key, promise);
  return promise;
}

function createScreenMaterial(screenKey, options = {}) {
  const surface = document.createElement("canvas");
  surface.width = 512;
  surface.height = 1024;
  const context = surface.getContext("2d");
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });

  const drawer = {
    key: screenKey,
    setKey(nextKey) {
      this.key = nextKey;
      this.draw();
    },
    async draw() {
      context.clearRect(0, 0, surface.width, surface.height);
      roundedRect(context, 0, 0, surface.width, surface.height, 44);
      context.save();
      context.clip();
      context.fillStyle = "#06152b";
      context.fillRect(0, 0, surface.width, surface.height);
      try {
        const image = await loadImage(this.key);
        if (options.spreadSide) {
          // Crop the actual iPad app viewport out of the source design, then
          // adapt one shared tablet canvas across both panes.
          const sourceX = image.naturalWidth * 0.08;
          const sourceY = image.naturalHeight * 0.23;
          const sourceWidth = image.naturalWidth * 0.84;
          const sourceHeight = image.naturalHeight * 0.735;
          const spreadWidth = surface.width * 2;
          const offsetX = options.spreadSide === "right" ? -surface.width : 0;
          context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, offsetX, 0, spreadWidth, surface.height);
        } else {
          const scale = Math.max(surface.width / image.naturalWidth, surface.height / image.naturalHeight);
          const width = image.naturalWidth * scale;
          const height = image.naturalHeight * scale;
          context.drawImage(image, (surface.width - width) / 2, (surface.height - height) / 2, width, height);
        }
      } catch {
        context.fillStyle = "#e3bd65";
        context.font = "600 30px system-ui";
        context.textAlign = "center";
        context.fillText("JOURNEYDECK", surface.width / 2, surface.height / 2);
      }
      context.restore();
      texture.needsUpdate = true;
    }
  };
  textureDrawers.push(drawer);
  drawer.draw();
  return { material, drawer };
}

function fillRounded(context, x, y, width, height, radius, fill, stroke = null) {
  roundedRect(context, x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 2;
    context.stroke();
  }
}

function drawDuoPortraitInterface(context, side) {
  const spread = document.createElement("canvas");
  spread.width = 1024;
  spread.height = 1024;
  const draw = spread.getContext("2d");
  const background = draw.createLinearGradient(0, 0, 1024, 1024);
  background.addColorStop(0, "#071528");
  background.addColorStop(0.58, "#0b2038");
  background.addColorStop(1, "#091522");
  draw.fillStyle = background;
  draw.fillRect(0, 0, 1024, 1024);

  draw.fillStyle = "#e7bd62";
  draw.font = "700 21px system-ui";
  draw.letterSpacing = "5px";
  draw.fillText("JOURNEYDECK", 34, 48);
  draw.fillStyle = "#f8f5ee";
  draw.font = "700 54px Georgia";
  draw.fillText("Home", 34, 108);
  draw.fillStyle = "#9eabc0";
  draw.font = "500 18px system-ui";
  draw.fillText("Your road, arranged for two screens.", 34, 140);

  const hero = draw.createLinearGradient(40, 176, 486, 428);
  hero.addColorStop(0, "#17335a");
  hero.addColorStop(0.52, "#10233f");
  hero.addColorStop(1, "#281b35");
  fillRounded(draw, 34, 174, 444, 252, 30, hero, "rgba(227,189,101,.42)");
  draw.fillStyle = "rgba(255,255,255,.08)";
  draw.beginPath();
  draw.arc(410, 225, 112, 0, Math.PI * 2);
  draw.fill();
  draw.strokeStyle = "rgba(255,132,89,.7)";
  draw.lineWidth = 8;
  draw.beginPath();
  draw.moveTo(70, 375);
  draw.bezierCurveTo(170, 330, 230, 392, 315, 300);
  draw.bezierCurveTo(352, 260, 395, 275, 450, 220);
  draw.stroke();
  draw.fillStyle = "#f8f5ee";
  draw.font = "700 35px Georgia";
  draw.fillText("Ready for the road?", 60, 230);
  draw.fillStyle = "#b9c4d4";
  draw.font = "500 18px system-ui";
  draw.fillText("Start a journey and keep the story.", 60, 266);
  fillRounded(draw, 60, 300, 190, 54, 18, "#e7bd62");
  draw.fillStyle = "#17130b";
  draw.font = "700 18px system-ui";
  draw.fillText("Start Journey  →", 84, 334);

  const leftMetrics = [
    [34, 450, "842", "Miles with music"],
    [262, 450, "26h", "Listening time"]
  ];
  for (const [x, y, value, label] of leftMetrics) {
    fillRounded(draw, x, y, 216, 122, 22, "rgba(255,255,255,.055)", "rgba(255,255,255,.12)");
    draw.fillStyle = "#f8f5ee";
    draw.font = "700 37px system-ui";
    draw.fillText(value, x + 20, y + 52);
    draw.fillStyle = "#9eabc0";
    draw.font = "500 15px system-ui";
    draw.fillText(label, x + 20, y + 83);
  }

  draw.fillStyle = "#f8f5ee";
  draw.font = "650 23px system-ui";
  draw.fillText("Recent memory", 34, 624);
  fillRounded(draw, 34, 648, 444, 310, 26, "rgba(255,255,255,.05)", "rgba(255,255,255,.12)");
  const memory = draw.createLinearGradient(60, 674, 446, 900);
  memory.addColorStop(0, "#e47461");
  memory.addColorStop(0.48, "#653e71");
  memory.addColorStop(1, "#172b45");
  fillRounded(draw, 54, 668, 404, 178, 22, memory);
  draw.fillStyle = "rgba(255,255,255,.15)";
  draw.beginPath();
  draw.moveTo(54, 820);
  draw.lineTo(175, 726);
  draw.lineTo(260, 800);
  draw.lineTo(350, 708);
  draw.lineTo(458, 810);
  draw.closePath();
  draw.fill();
  draw.fillStyle = "#f8f5ee";
  draw.font = "700 24px system-ui";
  draw.fillText("Coastal Weekend", 58, 890);
  draw.fillStyle = "#9eabc0";
  draw.font = "500 16px system-ui";
  draw.fillText("142 mi  •  4h 32m  •  18 photos", 58, 921);

  draw.fillStyle = "#e7bd62";
  draw.font = "700 14px system-ui";
  draw.fillText("LIVE JOURNEY", 552, 48);
  draw.fillStyle = "#f8f5ee";
  draw.font = "700 40px Georgia";
  draw.fillText("Pacific Coast Drive", 552, 98);
  draw.fillStyle = "#9eabc0";
  draw.font = "500 17px system-ui";
  draw.fillText("Two-pane details stay clear of the hinge.", 552, 132);

  fillRounded(draw, 548, 174, 442, 192, 28, "rgba(255,255,255,.055)", "rgba(227,189,101,.32)");
  draw.fillStyle = "#6ee7b7";
  draw.beginPath();
  draw.arc(582, 212, 8, 0, Math.PI * 2);
  draw.fill();
  draw.fillStyle = "#c6d0de";
  draw.font = "700 15px system-ui";
  draw.fillText("IN PROGRESS", 600, 218);
  draw.fillStyle = "#f8f5ee";
  draw.font = "700 48px system-ui";
  draw.fillText("42.6 mi", 572, 286);
  draw.fillStyle = "#aeb9c9";
  draw.font = "500 18px system-ui";
  draw.fillText("1h 18m  •  12 songs", 574, 326);

  const rightMetrics = [
    [548, 392, "318", "Songs on the road"],
    [776, 392, "7", "Day streak"]
  ];
  for (const [x, y, value, label] of rightMetrics) {
    fillRounded(draw, x, y, 214, 122, 22, "rgba(255,255,255,.055)", "rgba(255,255,255,.12)");
    draw.fillStyle = "#f8f5ee";
    draw.font = "700 37px system-ui";
    draw.fillText(value, x + 20, y + 52);
    draw.fillStyle = "#9eabc0";
    draw.font = "500 15px system-ui";
    draw.fillText(label, x + 20, y + 83);
  }

  draw.fillStyle = "#f8f5ee";
  draw.font = "650 23px system-ui";
  draw.fillText("Recent journeys", 548, 568);
  const journeys = [
    ["Canyon Run", "78 mi  •  2h 45m"],
    ["Lakeside Loop", "64 mi  •  2h 10m"],
    ["Sunset Commute", "31 mi  •  54m"]
  ];
  journeys.forEach(([title, detail], index) => {
    const y = 594 + index * 112;
    fillRounded(draw, 548, y, 442, 94, 20, "rgba(255,255,255,.045)", "rgba(255,255,255,.1)");
    fillRounded(draw, 568, y + 17, 60, 60, 16, index === 0 ? "#263e72" : index === 1 ? "#3f5e43" : "#704443");
    draw.fillStyle = "#f8f5ee";
    draw.font = "700 19px system-ui";
    draw.fillText(title, 650, y + 38);
    draw.fillStyle = "#9eabc0";
    draw.font = "500 15px system-ui";
    draw.fillText(detail, 650, y + 66);
    draw.fillStyle = "#e7bd62";
    draw.font = "700 23px system-ui";
    draw.fillText("›", 952, y + 55);
  });
  fillRounded(draw, 548, 944, 442, 50, 18, "rgba(227,189,101,.12)", "rgba(227,189,101,.3)");
  draw.fillStyle = "#e7bd62";
  draw.font = "650 16px system-ui";
  draw.fillText("Home      Music      Memories      Statistics", 578, 976);

  draw.fillStyle = "#050a12";
  draw.fillRect(504, 0, 16, 1024);
  context.drawImage(spread, side === "right" ? 512 : 0, 0, 512, 1024, 0, 0, 512, 1024);
}

function drawTentInterface(context, side) {
  const wide = document.createElement("canvas");
  wide.width = 1024;
  wide.height = 512;
  const draw = wide.getContext("2d");
  const background = draw.createLinearGradient(0, 0, 1024, 512);
  background.addColorStop(0, "#07172a");
  background.addColorStop(0.55, "#102846");
  background.addColorStop(1, "#17172d");
  draw.fillStyle = background;
  draw.fillRect(0, 0, 1024, 512);
  draw.fillStyle = "#e7bd62";
  draw.font = "700 18px system-ui";
  draw.fillText("JOURNEYDECK  •  TENT VIEW", 34, 42);
  draw.fillStyle = "#f8f5ee";
  draw.font = "700 48px Georgia";
  draw.fillText(side === "left" ? "Now driving" : "Road soundtrack", 34, 102);

  if (side === "left") {
    fillRounded(draw, 34, 130, 420, 326, 30, "rgba(255,255,255,.055)", "rgba(227,189,101,.35)");
    draw.fillStyle = "#f8f5ee";
    draw.font = "700 128px system-ui";
    draw.fillText("42", 68, 292);
    draw.fillStyle = "#e7bd62";
    draw.font = "700 25px system-ui";
    draw.fillText("MPH", 300, 278);
    draw.fillStyle = "#aeb9c9";
    draw.font = "500 20px system-ui";
    draw.fillText("Pacific Coast Drive", 72, 344);
    draw.fillText("42.6 mi  •  1h 18m", 72, 382);
    fillRounded(draw, 72, 404, 220, 36, 16, "rgba(110,231,183,.14)");
    draw.fillStyle = "#6ee7b7";
    draw.font = "700 15px system-ui";
    draw.fillText("●  RECORDING", 96, 428);
  } else {
    fillRounded(draw, 34, 130, 956, 326, 30, "rgba(255,255,255,.055)", "rgba(169,99,255,.34)");
    const art = draw.createLinearGradient(72, 168, 330, 426);
    art.addColorStop(0, "#e56f62");
    art.addColorStop(0.5, "#6f426e");
    art.addColorStop(1, "#1b3155");
    fillRounded(draw, 72, 168, 258, 258, 28, art);
    draw.fillStyle = "rgba(255,255,255,.17)";
    draw.beginPath();
    draw.moveTo(72, 380);
    draw.lineTo(170, 255);
    draw.lineTo(238, 338);
    draw.lineTo(330, 220);
    draw.lineTo(330, 426);
    draw.lineTo(72, 426);
    draw.closePath();
    draw.fill();
    draw.fillStyle = "#f8f5ee";
    draw.font = "700 39px system-ui";
    draw.fillText("Golden Hour", 380, 226);
    draw.fillStyle = "#b3bed0";
    draw.font = "500 21px system-ui";
    draw.fillText("Coastal Nights", 382, 266);
    draw.strokeStyle = "#e7bd62";
    draw.lineWidth = 4;
    draw.beginPath();
    for (let x = 382; x <= 884; x += 14) {
      const height = 16 + Math.abs(Math.sin(x * 0.05)) * 38;
      draw.moveTo(x, 345 - height / 2);
      draw.lineTo(x, 345 + height / 2);
    }
    draw.stroke();
    draw.fillStyle = "#e7bd62";
    draw.font = "700 18px system-ui";
    draw.fillText("12 songs on this drive", 382, 410);
  }

  context.save();
  context.translate(512, 0);
  context.rotate(Math.PI / 2);
  context.drawImage(wide, 0, 0);
  context.restore();
}

function createAdaptiveMaterial(mode, side) {
  const surface = document.createElement("canvas");
  surface.width = 512;
  surface.height = 1024;
  const context = surface.getContext("2d");
  if (mode === "portrait") drawDuoPortraitInterface(context, side);
  if (mode === "tent") drawTentInterface(context, side);
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  return { material, drawer: { draw() { texture.needsUpdate = true; } } };
}

function makeRoundedShape(width, height, radius) {
  const left = -width / 2;
  const bottom = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(left + radius, bottom);
  shape.lineTo(left + width - radius, bottom);
  shape.quadraticCurveTo(left + width, bottom, left + width, bottom + radius);
  shape.lineTo(left + width, bottom + height - radius);
  shape.quadraticCurveTo(left + width, bottom + height, left + width - radius, bottom + height);
  shape.lineTo(left + radius, bottom + height);
  shape.quadraticCurveTo(left, bottom + height, left, bottom + height - radius);
  shape.lineTo(left, bottom + radius);
  shape.quadraticCurveTo(left, bottom, left + radius, bottom);
  shape.closePath();
  return shape;
}

function makeSafeFrame(width, height) {
  const x = width / 2 - 0.18;
  const yTop = height / 2 - 0.26;
  const yBottom = -height / 2 + 0.2;
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-x, yTop, 0.018),
    new THREE.Vector3(x, yTop, 0.018),
    new THREE.Vector3(x, yBottom, 0.018),
    new THREE.Vector3(-x, yBottom, 0.018)
  ]);
  const material = new THREE.LineBasicMaterial({ color: 0x6ee7b7, transparent: true, opacity: 0.95 });
  const frame = new THREE.LineLoop(geometry, material);
  frame.renderOrder = 4;
  frame.visible = false;
  safeFrames.push(frame);
  return frame;
}

function addOuterDisplay(group, material, centerX, width, height, depth) {
  const bezel = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.12, height - 0.12),
    new THREE.MeshPhysicalMaterial({ color: 0x020307, metalness: 0.35, roughness: 0.25, clearcoat: 0.8 })
  );
  bezel.position.set(centerX, 0, -depth / 2 - 0.047);
  bezel.rotation.y = Math.PI;
  group.add(bezel);

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.25, height - 0.25), material);
  screen.position.set(centerX, 0, -depth / 2 - 0.052);
  screen.rotation.y = Math.PI;
  screen.renderOrder = 2;
  group.add(screen);

  const cameraCutout = new THREE.Mesh(
    new THREE.CircleGeometry(0.036, 20),
    new THREE.MeshBasicMaterial({ color: 0x020205, toneMapped: false })
  );
  cameraCutout.position.set(centerX + width * 0.34, height / 2 - 0.19, -depth / 2 - 0.065);
  cameraCutout.rotation.y = Math.PI;
  cameraCutout.renderOrder = 5;
  group.add(cameraCutout);
}

function addCameraBack(group, centerX, width, height, depth) {
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.12, height - 0.12),
    new THREE.MeshPhysicalMaterial({
      color: 0x263753,
      metalness: 0.68,
      roughness: 0.32,
      clearcoat: 0.65,
      clearcoatRoughness: 0.22,
      emissive: 0x08111f,
      emissiveIntensity: 0.45
    })
  );
  back.position.set(centerX, 0, -depth / 2 - 0.047);
  back.rotation.y = Math.PI;
  group.add(back);

  const island = new THREE.Mesh(
    new THREE.ShapeGeometry(makeRoundedShape(0.82, 0.5, 0.14), 16),
    new THREE.MeshPhysicalMaterial({ color: 0x344157, metalness: 0.86, roughness: 0.2, clearcoat: 0.7 })
  );
  const cameraX = centerX + width * 0.29;
  const cameraY = height / 2 - 0.43;
  island.position.set(cameraX, cameraY, -depth / 2 - 0.06);
  island.rotation.y = Math.PI;
  island.castShadow = true;
  group.add(island);

  const lensMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x02050a,
    metalness: 0.55,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.08
  });
  const ringMaterial = new THREE.MeshPhysicalMaterial({ color: 0x566174, metalness: 1, roughness: 0.18 });
  for (const offset of [-0.2, 0.2]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.18, 32), ringMaterial);
    ring.position.set(cameraX + offset, cameraY, -depth / 2 - 0.072);
    ring.rotation.y = Math.PI;
    ring.renderOrder = 4;
    group.add(ring);

    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.125, 32), lensMaterial);
    lens.position.set(cameraX + offset, cameraY, -depth / 2 - 0.075);
    lens.rotation.y = Math.PI;
    lens.renderOrder = 5;
    group.add(lens);
  }

  const flash = new THREE.Mesh(
    new THREE.CircleGeometry(0.052, 20),
    new THREE.MeshBasicMaterial({ color: 0xffe8b5, toneMapped: false })
  );
  flash.position.set(cameraX, cameraY - 0.16, -depth / 2 - 0.076);
  flash.rotation.y = Math.PI;
  flash.renderOrder = 5;
  group.add(flash);
}

function makePanel(screenMaterial, side = 0, exterior = null) {
  const width = 2.42;
  const height = 4.78;
  const depth = 0.15;
  const group = new THREE.Group();
  const centerX = side * width / 2;

  const chassisGeometry = new THREE.ExtrudeGeometry(makeRoundedShape(width, height, 0.23), {
    depth,
    bevelEnabled: true,
    bevelSegments: 5,
    bevelSize: 0.055,
    bevelThickness: 0.035,
    curveSegments: 16
  });
  chassisGeometry.center();
  const chassisMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x20242c,
    metalness: 0.92,
    roughness: 0.2,
    clearcoat: 0.55,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.2
  });
  const chassis = new THREE.Mesh(chassisGeometry, chassisMaterial);
  chassis.position.x = centerX;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  const bezel = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.12, height - 0.12),
    new THREE.MeshPhysicalMaterial({ color: 0x020307, metalness: 0.35, roughness: 0.25, clearcoat: 0.8 })
  );
  bezel.position.set(centerX, 0, depth / 2 + 0.047);
  group.add(bezel);

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.25, height - 0.25), screenMaterial);
  screen.position.set(centerX, 0, depth / 2 + 0.052);
  screen.renderOrder = 2;
  group.add(screen);
  group.userData.innerScreen = screen;

  const safeFrame = makeSafeFrame(width - 0.25, height - 0.25);
  safeFrame.position.set(centerX, 0, depth / 2 + 0.052);
  group.add(safeFrame);

  const cameraCutout = new THREE.Mesh(
    new THREE.CircleGeometry(0.036, 20),
    new THREE.MeshBasicMaterial({ color: 0x020205, toneMapped: false })
  );
  cameraCutout.position.set(centerX, height / 2 - 0.19, depth / 2 + 0.065);
  cameraCutout.renderOrder = 5;
  group.add(cameraCutout);

  if (exterior?.kind === "display") {
    addOuterDisplay(group, exterior.material, centerX, width, height, depth);
  } else if (exterior?.kind === "camera") {
    addCameraBack(group, centerX, width, height, depth);
  }

  return group;
}

function buildDevice() {
  deviceRoot = new THREE.Group();
  deviceRoot.rotation.x = -0.035;
  scene.add(deviceRoot);

  const left = createScreenMaterial(state.leftScreen);
  const right = createScreenMaterial(state.rightScreen);
  const closed = createScreenMaterial(state.leftScreen);
  const outer = createScreenMaterial(state.leftScreen);
  const flatLeft = createScreenMaterial("ipad", { spreadSide: "left" });
  const flatRight = createScreenMaterial("ipad", { spreadSide: "right" });
  const portraitLeft = createAdaptiveMaterial("portrait", "left");
  const portraitRight = createAdaptiveMaterial("portrait", "right");
  const tentLeft = createAdaptiveMaterial("tent", "left");
  const tentRight = createAdaptiveMaterial("tent", "right");

  openDevice = new THREE.Group();
  leftPivot = makePanel(left.material, -1, { kind: "display", material: outer.material });
  rightPivot = makePanel(right.material, 1, { kind: "camera" });
  openDevice.add(leftPivot, rightPivot);

  const hingeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x171920,
    metalness: 1,
    roughness: 0.18,
    clearcoat: 0.7
  });
  hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 4.55, 28), hingeMaterial);
  hinge.castShadow = true;
  openDevice.add(hinge);

  hingeGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.112, 0.112, 4.36, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff795c, transparent: true, opacity: 0.27, side: THREE.DoubleSide, toneMapped: false })
  );
  hingeGlow.renderOrder = 5;
  openDevice.add(hingeGlow);

  closedDevice = makePanel(closed.material, 0, { kind: "camera" });
  closedDevice.visible = false;
  deviceRoot.add(openDevice, closedDevice);

  return {
    left, right, closed, outer, flatLeft, flatRight,
    portraitLeft, portraitRight, tentLeft, tentRight
  };
}

function makeStudio() {
  floor = new THREE.Mesh(
    new THREE.PlaneGeometry(35, 35),
    new THREE.MeshStandardMaterial({ color: 0x090b10, metalness: 0.05, roughness: 0.72, transparent: true, opacity: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.78;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(22, 22, 0x2d3342, 0x171c27);
  grid.position.y = -2.765;
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  floor.userData.grid = grid;
  scene.add(grid);
}

function setCameraPreset(name, immediate = false) {
  const presets = {
    front: [0, 0.05, 8.15],
    perspective: [3.7, 2.05, 7.15],
    high: [4.4, 5.1, 4.9],
    rear: [4.4, 2.1, -7]
  };
  const destination = new THREE.Vector3(...(presets[name] ?? presets.perspective));
  const start = camera.position.clone();
  const started = performance.now();
  const duration = immediate || reducedMotion.matches ? 0 : 560;
  cancelAnimationFrame(state.cameraTween);

  const step = (time) => {
    const progress = duration === 0 ? 1 : Math.min(1, (time - started) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    camera.position.lerpVectors(start, destination, eased);
    controls.target.lerp(new THREE.Vector3(0, -0.1, 0), eased);
    controls.update();
    if (progress < 1) state.cameraTween = requestAnimationFrame(step);
  };
  state.cameraTween = requestAnimationFrame(step);
}

function updateModel(angle) {
  state.angle = clampAngle(angle);
  const closed = state.angle <= 12;
  openDevice.visible = !closed;
  closedDevice.visible = closed;
  const rotations = panelRotations(state.angle);
  leftPivot.rotation.y = rotations.leftRadians;
  rightPivot.rotation.y = rotations.rightRadians;
  const presentation = screenPresentation(state.posture, state.angle);
  const materials = {
    tablet: [screenBindings.flatLeft.material, screenBindings.flatRight.material],
    "duo portrait": [screenBindings.portraitLeft.material, screenBindings.portraitRight.material],
    "duo tent": [screenBindings.tentLeft.material, screenBindings.tentRight.material],
    independent: [screenBindings.left.material, screenBindings.right.material]
  }[presentation];
  leftPivot.userData.innerScreen.material = materials[0];
  rightPivot.userData.innerScreen.material = materials[1];
  const adaptiveInterface = presentation !== "independent";
  leftSelect.disabled = adaptiveInterface;
  rightSelect.disabled = adaptiveInterface;
  document.querySelector("#swap-screens").disabled = adaptiveInterface;
  document.querySelector(".screen-group").classList.toggle("is-adaptive", adaptiveInterface);
  hinge.visible = !closed;
  hingeGlow.visible = !closed && state.showHinge;
  closedDevice.rotation.y = THREE.MathUtils.degToRad(-4);

  const metrics = layoutMetrics(state.angle);
  angleInput.value = String(metrics.angle);
  angleOutput.value = `${metrics.angle}°`;
  const selectedPosture = POSTURES[state.posture] ?? POSTURES[closestPosture(metrics.angle)];
  document.querySelector("#posture-readout").textContent = `${selectedPosture.label} · ${metrics.angle}°`;
  document.querySelector("#pane-readout").textContent = `${metrics.panes} ${metrics.panes === 1 ? "pane" : "panes"}`;
  document.querySelector("#metric-presentation").textContent = titleCase(adaptiveInterface ? presentation : metrics.presentation);
  document.querySelector("#metric-panes").textContent = String(metrics.panes);
  document.querySelector("#metric-division").textContent = titleCase(metrics.division);
  document.querySelector("#metric-gap").textContent = `${metrics.reservedRegion} pt`;

  document.querySelectorAll("[data-posture]").forEach((button) => {
    button.classList.toggle("active", button.dataset.posture === state.posture);
  });
}

function animateOrientation(destination) {
  const start = deviceRoot.rotation.z;
  const started = performance.now();
  const duration = reducedMotion.matches ? 0 : 520;
  cancelAnimationFrame(state.orientationTween);
  const step = (time) => {
    const progress = duration === 0 ? 1 : Math.min(1, (time - started) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    deviceRoot.rotation.z = start + (destination - start) * eased;
    if (progress < 1) state.orientationTween = requestAnimationFrame(step);
  };
  state.orientationTween = requestAnimationFrame(step);
}

function titleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function animateAngle(destination) {
  const target = clampAngle(destination);
  const start = state.angle;
  const started = performance.now();
  const duration = reducedMotion.matches ? 0 : 520;
  cancelAnimationFrame(state.angleTween);
  const step = (time) => {
    const progress = duration === 0 ? 1 : Math.min(1, (time - started) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    updateModel(start + (target - start) * eased);
    if (progress < 1) state.angleTween = requestAnimationFrame(step);
  };
  state.angleTween = requestAnimationFrame(step);
}

function setupEvents(screenBindings) {
  document.querySelector("#posture-buttons").addEventListener("click", (event) => {
    const button = event.target.closest("[data-posture]");
    if (!button) return;
    state.posture = button.dataset.posture;
    const posture = POSTURES[button.dataset.posture];
    animateAngle(posture.angle);
    animateOrientation(posture.rotationZ);
    setCameraPreset(posture.camera);
  });

  angleInput.addEventListener("input", () => {
    const angle = clampAngle(angleInput.value);
    const preservePortrait = state.posture === "flatPortrait" && angle >= 168;
    if (!preservePortrait) state.posture = closestPosture(angle);
    deviceRoot.rotation.z = POSTURES[state.posture].rotationZ;
    updateModel(angle);
  });
  leftSelect.addEventListener("change", () => {
    state.leftScreen = leftSelect.value;
    screenBindings.left.drawer.setKey(state.leftScreen);
    screenBindings.closed.drawer.setKey(state.leftScreen);
    screenBindings.outer.drawer.setKey(state.leftScreen);
  });
  rightSelect.addEventListener("change", () => {
    state.rightScreen = rightSelect.value;
    screenBindings.right.drawer.setKey(state.rightScreen);
  });
  document.querySelector("#swap-screens").addEventListener("click", () => {
    const left = leftSelect.value;
    leftSelect.value = rightSelect.value;
    rightSelect.value = left;
    leftSelect.dispatchEvent(new Event("change"));
    rightSelect.dispatchEvent(new Event("change"));
  });

  safeToggle.addEventListener("change", () => {
    state.safeAreas = safeToggle.checked;
    safeFrames.forEach((frame) => { frame.visible = state.safeAreas; });
  });
  hingeToggle.addEventListener("change", () => {
    state.showHinge = hingeToggle.checked;
    hingeGlow.visible = state.showHinge && state.angle > 12;
  });
  floorToggle.addEventListener("change", () => {
    state.showFloor = floorToggle.checked;
    floor.visible = state.showFloor;
    floor.userData.grid.visible = state.showFloor;
  });
  autoOrbitButton.addEventListener("click", () => {
    state.autoOrbit = !state.autoOrbit;
    autoOrbitButton.setAttribute("aria-pressed", String(state.autoOrbit));
    autoOrbitButton.textContent = state.autoOrbit ? "Stop orbit" : "Auto orbit";
  });
  document.querySelector("#reset-camera").addEventListener("click", () => setCameraPreset((POSTURES[state.posture] ?? POSTURES[closestPosture(state.angle)]).camera));
  canvas.addEventListener("dblclick", () => setCameraPreset((POSTURES[state.posture] ?? POSTURES[closestPosture(state.angle)]).camera));
  canvas.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 0.2 : 0.08;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      deviceRoot.rotation.y += event.key === "ArrowLeft" ? -step : step;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      deviceRoot.rotation.x = THREE.MathUtils.clamp(deviceRoot.rotation.x + (event.key === "ArrowUp" ? -step : step), -0.8, 0.8);
    }
    if (event.key === "Home") {
      event.preventDefault();
      const posture = POSTURES[state.posture] ?? POSTURES[closestPosture(state.angle)];
      deviceRoot.rotation.set(-0.035, 0, posture.rotationZ);
      setCameraPreset(posture.camera);
    }
  });
}

function init() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (error) {
    console.error(error);
    canvas.hidden = true;
    fallback.hidden = false;
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x080b12, 0.027);
  camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(3.7, 2.05, 7.15);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 4.8;
  controls.maxDistance = 16;
  controls.maxPolarAngle = Math.PI * 0.78;
  controls.target.set(0, -0.1, 0);

  scene.add(new THREE.HemisphereLight(0xb9c8ff, 0x161016, 1.45));
  const key = new THREE.DirectionalLight(0xffe0b8, 4.4);
  key.position.set(-5, 7, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const violet = new THREE.PointLight(0x9257ff, 30, 18, 1.6);
  violet.position.set(5, 1.5, 4);
  scene.add(violet);
  const coral = new THREE.PointLight(0xff553b, 26, 17, 1.7);
  coral.position.set(-5, -0.4, 3);
  scene.add(coral);
  const rearFill = new THREE.PointLight(0x9bb7ff, 22, 18, 1.7);
  rearFill.position.set(-2.5, 3.2, -5.5);
  scene.add(rearFill);

  screenBindings = buildDevice();
  makeStudio();
  setupEvents(screenBindings);
  updateModel(state.angle);

  const resize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  const render = (time) => {
    const elapsed = Math.min(0.05, (time - lastFrame) / 1000);
    lastFrame = time;
    if (state.autoOrbit && !reducedMotion.matches) deviceRoot.rotation.y += elapsed * 0.24;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
}

init();
