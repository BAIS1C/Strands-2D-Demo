# Avaturn Three.js Example — Complete Reference Implementation
> From github.com/avaturn/avaturn-threejs-example
> Scraped March 2026

---

## File Structure
```
avaturn-threejs-example/
├── public/
│   ├── default_model.glb      # Default avatar GLB
│   ├── animation.glb           # Idle animation GLB
│   └── brown_photostudio_01.hdr # HDRI environment map
├── index.html
├── main.css
└── main.js
```

## Setup
```bash
npm install -g local-web-server
ws
# → http://localhost:8000
```

---

## index.html
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0" />
    <link href="https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,700&family=Roboto:ital,wght@0,500;1,300;1,400&display=swap" rel="stylesheet" />
    <title>Avaturn three.js Example</title>
    <link href="./main.css" rel="stylesheet" />
  </head>
  <body>
    <section class="main" style="text-align: center;margin:auto; right:0px; left: 0px;">
      <h2>Avaturn three.js example</h2>
      <div class="actions">
        <input type="button" id="buttonOpen" value="Open Avaturn" />
        <input type="button" id="buttonClose" value="Close Avaturn" />
      </div>
    </section>
    <div id="avaturn-sdk-container"></div>
    <div id="container"></div>

    <script async src="https://unpkg.com/es-module-shims@1.3.6/dist/es-module-shims.js"></script>
    <script type="importmap">
      {
        "imports": {
          "three": "https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.module.js",
          "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.157.0/examples/jsm/"
        }
      }
    </script>
    <script type="module" src="main.js"></script>
  </body>
</html>
```

---

## main.js (Complete)
```javascript
import * as THREE from "three";
import Stats from "three/addons/libs/stats.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AvaturnSDK } from "https://cdn.jsdelivr.net/npm/@avaturn/sdk/dist/index.js";

let scene, renderer, camera, stats, animationGroup;
let model, mixer, clock;
let currentAvatar;
let idleAction;

async function loadAvatar(url) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  model = gltf.scene;
  scene.add(model);

  // Configure materials
  model.traverse(function (object) {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      object.material.envMapIntensity = 0.3;
      // Turn off mipmaps for crispier textures (1k resolution only)
      if (object.material.map && !object.material.name.includes("hair")) {
        object.material.map.generateMipmaps = false;
      }
    }
  });

  animationGroup.add(model);
  return model;
}

function filterAnimation(animation) {
  // Keep only root motion and quaternion rotations
  animation.tracks = animation.tracks.filter((track) => {
    const name = track.name;
    return name.endsWith("Hips.position") || name.endsWith(".quaternion");
  });
  return animation;
}

async function init() {
  const container = document.getElementById("container");

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  // Camera + Controls
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  camera.position.set(-2, 1, 3);
  controls.target.set(0, 1, 0);
  controls.update();

  // Animation
  clock = new THREE.Clock();
  animationGroup = new THREE.AnimationObjectGroup();
  mixer = new THREE.AnimationMixer(animationGroup);

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc0c0c0);
  scene.fog = new THREE.Fog(0xc0c0c0, 20, 50);

  // Lighting
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff);
  dirLight.position.set(3, 3, 5);
  dirLight.castShadow = true;
  dirLight.shadow.camera.top = 2;
  dirLight.shadow.camera.bottom = -2;
  dirLight.shadow.camera.left = -2;
  dirLight.shadow.camera.right = 2;
  dirLight.shadow.camera.near = 0.1;
  dirLight.shadow.camera.far = 40;
  dirLight.shadow.bias = -0.001;
  dirLight.intensity = 3;
  scene.add(dirLight);

  // HDRI Environment
  new RGBELoader().load("public/brown_photostudio_01.hdr", (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
  });

  // Ground
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Load default avatar
  currentAvatar = await loadAvatar("public/default_model.glb");

  // Load idle animation
  const loader = new GLTFLoader();
  loader.load("public/animation.glb", function (gltf) {
    const clip = filterAnimation(gltf.animations[0]);
    const action = mixer.clipAction(clip);
    idleAction = action;
    idleAction.play();
  });

  stats = new Stats();
  container.appendChild(stats.dom);
  window.addEventListener("resize", onWindowResize);
  animate();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  let mixerUpdateDelta = clock.getDelta();
  mixer.update(mixerUpdateDelta);
  stats.update();
  renderer.render(scene, camera);
}

function openIframe() {
  initAvaturn();
  document.querySelector("#avaturn-sdk-container").hidden = false;
  document.querySelector("#buttonOpen").disabled = true;
}

function closeIframe() {
  document.querySelector("#avaturn-sdk-container").hidden = true;
  document.querySelector("#buttonOpen").disabled = false;
}

function initAvaturn() {
  const container = document.getElementById("avaturn-sdk-container");
  const subdomain = "demo"; // Replace with your subdomain
  const url = `https://${subdomain}.avaturn.dev`;

  const sdk = new AvaturnSDK();
  sdk.init(container, { url }).then(() => {
    sdk.on("export", (data) => {
      // HOT-SWAP: Remove old avatar, load new one
      loadAvatar(data.url).then((model) => {
        currentAvatar.visible = false;
        currentAvatar.removeFromParent();
        animationGroup.uncache(currentAvatar);
        animationGroup.remove(currentAvatar);
        currentAvatar = model;
      });
      closeIframe();
    });
  });
}

await init();
closeIframe();
document.querySelector("#buttonOpen").addEventListener("click", openIframe);
document.querySelector("#buttonClose").addEventListener("click", closeIframe);
```

---

## Key Patterns for Strands Integration

### Avatar Hot-Swap
The critical pattern — when export fires, the old avatar is cleanly removed and replaced:
```javascript
sdk.on("export", (data) => {
  loadAvatar(data.url).then((newModel) => {
    oldAvatar.visible = false;
    oldAvatar.removeFromParent();
    animationGroup.uncache(oldAvatar);
    animationGroup.remove(oldAvatar);
    currentAvatar = newModel;
  });
});
```

### Animation Filtering
Only keep Hips position + all quaternion rotations — strips translation tracks that would conflict with game movement:
```javascript
animation.tracks = animation.tracks.filter((track) => {
  return track.name.endsWith("Hips.position") || track.name.endsWith(".quaternion");
});
```

### Material Config
Disable mipmaps for crisp textures at 1k resolution (skip for hair materials):
```javascript
if (object.material.map && !object.material.name.includes("hair")) {
  object.material.map.generateMipmaps = false;
}
```

### AnimationObjectGroup
Uses `THREE.AnimationObjectGroup` so the same mixer/animations apply to any swapped avatar — no need to rebuild the animation system on avatar change.
