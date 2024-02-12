import { WebGLRenderer, Scene, PerspectiveCamera, AmbientLight, AnimationMixer, AnimationClip, Color, MeshLambertMaterial, Vector3, GridHelper, NormalAnimationBlendMode, AdditiveAnimationBlendMode, AnimationAction, Euler } from 'three'

/** @ts-ignore-next-line */
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
/** @ts-ignore-next-line */
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

/** @ts-ignore-next-line */
const vscode = acquireVsCodeApi()


async function game() {
  function createEventDispatcher<T extends unknown[]>() {
    const fns: ((...p: T) => void)[] = []
    return [
      (...params: T) => fns.forEach(fn => fn(...params)),
      (fn: (...p: T) => void) => { fns.push(fn); return () => fns.splice(fns.findIndex(p => p === fn)) }
    ] as const
  }

  const [dispatchPhysicsStep, beforePhysicsStep] = createEventDispatcher<[number]>()
  const [dispatchRenderUpdate, beforeRenderUpdate] = createEventDispatcher<[number]>()

  function useTicker(onUpdate: (delta: number) => void, tps: number, onTPS?: (tps: number) => void) {
    let now
    let delta
    let then = performance.now()
    let interval = 1000/tps
  
    let thenTps = then
    let ticks = 0
  
    const render = () => {
      now = performance.now()
      delta = now - then
  
      if (delta >= interval) {
        ticks++
        if (now >= thenTps + 1000) {
          onTPS?.((ticks * 1000) / (now - thenTps))
          thenTps = now
          ticks = 0
        }
  
        then = now - (delta % interval)
        onUpdate(delta / 1000)
      }
  
      setTimeout(render)
    }
  
    render()
  }
  
  function createCamera(width: number, height: number) {
    const camera = new PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.z = 10
    return camera
  }
  
  function createScene() {
    const scene = new Scene()
    scene.background = new Color(0x000000)
    
    scene.add(new GridHelper())

    const light = new AmbientLight(0xffffff, 2)
    scene.add(light)
  
    return scene
  }
  
  const assets = new Map<string, GLTF>()
  async function loadAssets() {
    const loader = new GLTFLoader()
  
    const stickmanGltf = await (new Promise<GLTF>((res, rej) => loader.load('assets/stickman.glb', res, undefined, rej)))
    stickmanGltf.scene.children[0].children[0].material = new MeshLambertMaterial({ color: 'white', fog: false })
    // stickmanGltf.scene.traverse( child => { if ( child.material ) console.log(child.name) && child.material.metalness = 0 } )
    assets.set('stickman', stickmanGltf)
  
  }
  
  function createStickman() {
    const gltf = assets.get('stickman')
    const object = cloneSkeleton(gltf.scene)
    const mixer = new AnimationMixer(object)
    const animations = gltf.animations
  
    beforeRenderUpdate(delta => mixer.update(delta))
  
    let currentAction: AnimationAction
    return { object, mixer, animations,
      playAnimation(name: string) {
        const clip = AnimationClip.findByName(animations, name)
        const action = mixer.clipAction(clip)
        currentAction?.fadeOut(0.1)
        // mixer.stopAllAction()
        action.reset()
        action.fadeIn(0.1)
        action.play()
        currentAction = action
      }
    }
  }
  
  function createPlayer() {
    const stickman = createStickman()
  
    return {
      ...stickman
    }
  }
  
  function useThirdPersonController(player: ReturnType<typeof createPlayer>, camera: PerspectiveCamera) {
    const object = player.object
    camera.lookAt(object.position)

    const moveSpeed = 2
    const turnSpeed = 2
  
    let running = false
    let turning = 0
  
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const press = e.type === 'keydown'
      switch (e.key) {
      case 'w':
        running = press
        player.playAnimation(press ? 'Running' : 'Idle')
        break
      case 'a':
        turning = press ? 1 : 0
        if (!running) player.playAnimation(press ? 'TurnLeft' : 'Idle')
        break
      case 'd':
        turning = press ? -1 : 0
        if (!running) player.playAnimation(press ? 'TurnRight' : 'Idle')
        break
      }
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('keyup', onKey)
    
    const minPolarAngle = 0
    const maxPolarAngle = Math.PI
    const PI_2 = Math.PI / 2
    const euler = new Euler()
    const pointerSpeed = 1

    let theta = 0
    let phi = 0
    let radius = 10

    let lastMousePos = { x: 0, y: 0 }
    const onMouse = (e: MouseEvent) => {
      const delta = { x: e.clientX - lastMousePos.x, y: e.clientY - lastMousePos.y }

      // theta += 0.1 * Math.PI * delta.x / document.body.clientWidth
      // phi += 0.1 * Math.PI * delta.y / document.body.clientHeight
      theta += (delta.y - theta) * 0.05;
      phi += (delta.x - phi) * 0.05;

      const pos = object.position
      // camera.position.x = pos.x + radius * Math.sin(phi) * Math.cos(theta)
      // camera.position.y = pos.y + radius * Math.cos(phi)
      // camera.position.z = pos.z + radius * Math.sin(phi) * Math.sin(theta)

      camera.position.x = pos.x + radius * Math.sin(phi * Math.PI / 360) * Math.cos(theta * Math.PI / 360);
      camera.position.y = pos.y + radius * Math.sin(phi * Math.PI / 360) * Math.sin(theta * Math.PI / 360);
      camera.position.z = pos.z + radius * Math.cos(phi * Math.PI / 360);

      camera.lookAt(pos)
    }

    document.addEventListener('mousedown', (e) => { 
      e.preventDefault()
      lastMousePos = { x: e.clientX, y: e.clientY }
      document.addEventListener('mousemove', onMouse)
    })
    document.addEventListener('mouseup', () => { document.removeEventListener('mousemove', onMouse) })
    
    const vector = new Vector3()
    const camOffset = new Vector3(0, 1, -10)
    camera.position.copy(camOffset)
    camera.lookAt(player.object.position)

    beforePhysicsStep(delta => {
      if (turning != 0) {
        object.rotation.y += (turning * turnSpeed) * delta
        camera.lookAt(player.object.position)
      }
      if (running) {
        object.getWorldDirection(vector)
        object.position.addScaledVector(vector, moveSpeed * delta)
        camera.position.copy(object.position).add(camOffset)
        camera.lookAt(player.object.position)
      }
    })
  }

  const { innerWidth: width, innerHeight: height } = window
  const canvas = document.createElement('canvas')
  document.body.append(canvas)
  
  const renderer = new WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(width, height)

  const camera = createCamera(width, height)

  await loadAssets()

  const scene = createScene()

  const player = createPlayer()
  player.playAnimation('Idle')
  scene.add(player.object)

  useThirdPersonController(player, camera)

  useTicker(delta => {
    dispatchPhysicsStep(delta)
  }, 45)

  useTicker(delta => {
    dispatchRenderUpdate(delta)
    renderer.render(scene, camera)
  }, 45)
  
  window.addEventListener('resize', () => {
    const { innerWidth: width, innerHeight: height } = window
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
    renderer.render(scene, camera)
  })


  // const textureLoader = new TextureLoader()
  // const sm = new SpriteMaterial({ map: null })
  // const sprite = new Sprite(sm)
  // sprite.scale.set(10, 8, 1)
  // scene.add(sprite)

  // self.addEventListener('message', e => {
  //   const { ev, data } = e.data
  //   switch (ev) {
  //     case 'capture':
  //       // console.log(data) 
  //       const captureBlob = new Blob([data], {type: 'image/jpeg'})
  //       const captureDataUri = URL.createObjectURL(captureBlob)
  //       textureLoader.load(captureDataUri, (texture) => {
  //         const oldTexture = sm.map
  //         sm.map = texture
  //         sm.needsUpdate = true
  //         oldTexture?.dispose()
  //       })
  //       break
  //   }
  // })
}

game()

self.addEventListener('message', msg => {
  try { JSON.parse(msg.data) } catch { return }
  const { ev, data } = JSON.parse(msg.data)
})

vscode.postMessage(1)