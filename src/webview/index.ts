import { WebGLRenderer, Scene, PerspectiveCamera, AmbientLight, BoxGeometry, MeshBasicMaterial, Mesh, TextureLoader, SpriteMaterial, Sprite, RepeatWrapping } from "three"

// const vscode = acquireVsCodeApi();

// vscode.postMessage("testii");

function game() {
  const { innerWidth: width, innerHeight: height } = window
  const canvas = document.createElement("canvas")
  document.body.append(canvas)
  
  const renderer = new WebGLRenderer({ canvas });
  renderer.setSize(width, height);
  
  const scene = new Scene();
  
  const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 11
  
  const ambientLight = new AmbientLight('white', 0.8);
  scene.add(ambientLight);
  
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshBasicMaterial({color: 0x00ff00});
  const cube = new Mesh(geometry, material);
  scene.add(cube);
  
  const textureLoader = new TextureLoader()
  const sm = new SpriteMaterial({ map: null, color: 0xffffff })
  const sprite = new Sprite(sm)
  sprite.scale.set(10, 8, 1)
  scene.add(sprite)

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate()
  
  window.addEventListener("resize", () => {
    const { innerWidth: width, innerHeight: height } = window
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
    renderer.render(scene, camera)
  })

  self.addEventListener('message', e => {
    const { ev, data } = e.data
    switch (ev) {
      case "capture":
        // console.log(data) 
        const captureBlob = new Blob([data], {type: "image/jpeg"});
        const captureDataUri = URL.createObjectURL(captureBlob);
        textureLoader.load(captureDataUri, (texture) => {
          const oldTexture = sm.map
          sm.map = texture
          sm.needsUpdate = true;
          oldTexture?.dispose()
        })
        break;
    }
  })
}

game()

// const buffer = canvas.toBuffer();

// fs.writeFileSync(__dirname + `image.png`, buffer)