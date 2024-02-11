import { WebGLRenderer, Scene, PerspectiveCamera, AmbientLight, BoxGeometry, MeshBasicMaterial, Mesh, TextureLoader, SpriteMaterial, Sprite, Group, AnimationMixer, AnimationClip, Color } from "three"

/** @ts-ignore-next-line */
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';


/** @ts-ignore-next-line */
const vscode = acquireVsCodeApi()

async function game() {
  const { innerWidth: width, innerHeight: height } = window
  const canvas = document.createElement("canvas")
  document.body.append(canvas)
  
  const renderer = new WebGLRenderer({ canvas });
  renderer.setSize(width, height);
  
  const scene = new Scene();
  
  const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 10
  
  const ambientLight = new AmbientLight('white', 1);
  scene.add(ambientLight);

  scene.background = new Color(0x999999);

  // const geometry = new BoxGeometry(1, 1, 1);
  // const material = new MeshBasicMaterial({color: 0x00ff00});
  // const cube = new Mesh(geometry, material);
  // scene.add(cube);
  
  // const textureLoader = new TextureLoader()
  // const sm = new SpriteMaterial({ map: null })
  // const sprite = new Sprite(sm)
  // sprite.scale.set(10, 8, 1)
  // scene.add(sprite)

  const loader = new GLTFLoader();

  const stickmanGltf = await (new Promise<GLTF>((res, rej) => loader.load("assets/stickman.glb", res, undefined, rej)))
  const stickman = new Group()
  stickman.add(stickmanGltf.scene)
  const mixer = new AnimationMixer(stickmanGltf.scene);
  const animations = stickmanGltf.animations;
  scene.add(stickman)

  camera.lookAt(stickman.position);

  const playAnimation = (name: string) => {
    const clip = AnimationClip.findByName(animations, name);
    const action = mixer.clipAction(clip);
    mixer.stopAllAction();
    action.fadeIn(0.1);
    action.play();
  }
  
  playAnimation("Idle")

  let then = 0
  function animate(time: number) {
    const delta = time - then
    then = time
    mixer.update(delta / 1000);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate(0)
  
  window.addEventListener("resize", () => {
    const { innerWidth: width, innerHeight: height } = window
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
    renderer.render(scene, camera)
  })

  // self.addEventListener('message', e => {
  //   const { ev, data } = e.data
  //   switch (ev) {
  //     case "capture":
  //       // console.log(data) 
  //       const captureBlob = new Blob([data], {type: "image/jpeg"});
  //       const captureDataUri = URL.createObjectURL(captureBlob);
  //       textureLoader.load(captureDataUri, (texture) => {
  //         const oldTexture = sm.map
  //         sm.map = texture
  //         sm.needsUpdate = true;
  //         oldTexture?.dispose()
  //       })
  //       break;
  //   }
  // })
}

game()

self.addEventListener('message', msg => {
  try { JSON.parse(msg.data) } catch { return }
  const { ev, data } = JSON.parse(msg.data)
})

vscode.postMessage(1)


const App = () => {

  
}