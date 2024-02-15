import { WebGLRenderer, Scene, PerspectiveCamera, AmbientLight, AnimationMixer, AnimationClip, Color, MeshLambertMaterial, Vector3, GridHelper, NormalAnimationBlendMode, AdditiveAnimationBlendMode, AnimationAction, Euler, SpriteMaterial, TextureLoader, Sprite, Group, PlaneGeometry, Mesh, Object3D, DirectionalLight, RectAreaLight, MeshPhongMaterial, MeshBasicMaterial } from 'three'
/** @ts-ignore-next-line */
import NetEvent from '../../../shared/NetEvents'

/** @ts-ignore-next-line */
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
/** @ts-ignore-next-line */
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
/** @ts-ignore-next-line */
import { RectAreaLightHelper } from 'three/examples/jsm/helpers/RectAreaLightHelper.js'

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
  
  const assets = new Map<string, GLTF>()
  function loadAssets() {
    const loader = new GLTFLoader()
    const load = (src: string) => new Promise<GLTF>(res => loader.load(src, res))

    const assetsDir = (self as unknown as { assetsDir: string }).assetsDir
    return Promise.all([
      load(assetsDir + '/stickman.glb').then(gltf => {
        gltf.scene.children[0].children[0].material.metalness = 0
        assets.set('stickman', gltf)
      }),
      load(assetsDir + '/mac_ex.glb').then(gltf => assets.set('desktop', gltf)),
      load(assetsDir + '/cubicle.glb').then(gltf => assets.set('cubicle', gltf))
    ])
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

    const light = new AmbientLight(0xffffff, 0.5)
    scene.add(light)

    const width = 10
    const height = 10
    const intensity = 2.2
    const rectLight = new RectAreaLight( 0xffffff, intensity,  width, height )
    rectLight.position.set( 0, 10, 0 )
    rectLight.lookAt(0, 0, 0)
    scene.add(rectLight)

    const rectLightHelper = new RectAreaLightHelper( rectLight )
    rectLight.add( rectLightHelper )
  
    return scene
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

    let radius = 5
    let azimuth = 0
    let polar = Math.PI / 2
    const sensitivity = 0.01
    const camAngle = new Vector3()

    const updateCamAngle = (e = { movementX: 0, movementY: 0 }) => {
      const { movementX, movementY } = e
      
      azimuth += movementX * sensitivity
      polar -= movementY * sensitivity

      polar = Math.max(0.01, Math.min((Math.PI / 2) - 0.25, polar))

      const x = radius * Math.sin(polar) * Math.cos(azimuth)
      const z = radius * Math.sin(polar) * Math.sin(azimuth)
      const y = radius * Math.cos(polar)

      camAngle.set(x, y, z)
      camera.position.copy(camAngle).add(object.position)
      camera.lookAt(object.position)
    }

    document.addEventListener('wheel', (e) => {radius += e.deltaY < 0 ? -1 : 1; updateCamAngle() })
    document.addEventListener('mousedown', (e) => { document.addEventListener('mousemove', updateCamAngle) })
    document.addEventListener('mouseup', () => { document.removeEventListener('mousemove', updateCamAngle) })
    updateCamAngle()

    let running = false
    let turning = 0
  
    const updateMovmentState = (e = { repeat: false, key: 'w', type: 'keyup' }) => {
      if (e.repeat) return
      const press = e.type === 'keydown'
      switch (e.key) {
      case 'w':
        running = press
        player.playAnimation(press ? 'Running' : 'Idle')
        break
      case 'a':
        turning = press ? 1 : 0
        // if (!running) player.playAnimation(press ? 'TurnLeft' : 'Idle')
        break
      case 'd':
        turning = press ? -1 : 0
        // if (!running) player.playAnimation(press ? 'TurnRight' : 'Idle')
        break
      }
    }

    document.addEventListener('keydown', updateMovmentState)
    document.addEventListener('keyup', updateMovmentState)
    updateMovmentState()

    const moveSpeed = 2
    const turnSpeed = 3

    const vector = new Vector3()

    beforePhysicsStep(delta => {
      if (turning != 0) {
        object.rotation.y += (turning * turnSpeed) * delta
      }
      if (running) {
        object.getWorldDirection(vector)
        object.position.addScaledVector(vector, moveSpeed * delta)
        vector.copy(camAngle).add(object.position)
        camera.position.copy(vector)
      }
    })
  }

  function createDesktop() {
    const group = new Group()
    // const sm = new SpriteMaterial({ map: null })
    // const sprite = new Sprite(sm)
    // sprite.scale.set(2, 1, 1)

    const desktop = assets.get('desktop').scene.clone() as Object3D
    desktop.scale.addScalar(0.5)
    group.add(desktop)

    const geometry = new PlaneGeometry(0.721, 0.414)
    const material = new MeshLambertMaterial({ color: 0xffffff })
    const screen = new Mesh(geometry, material)
    screen.position.add(new Vector3(0.0564, 0.43, 0.174))
    screen.rotation.x = -0.07
    group.add(screen)

    return { object: group, screen }
  }

  function createCubicle() {
    const group = new Group()
    const desktop = createDesktop()
    desktop.object.position.y += 0.8
    desktop.object.position.x += 0.05
    desktop.object.position.z -= 0.3
    group.add(desktop.object)

    const cubicle = assets.get('cubicle').scene.clone() as Object3D
    cubicle.scale.subScalar(0.785)
    cubicle.position.add(new Vector3(-1, 0, 1.5))
    group.add(cubicle)

    return {
      object: group,
      desktop
    }
  }
  
  const assetsPromise = loadAssets()

  const { innerWidth: width, innerHeight: height } = window
  const canvas = document.createElement('canvas')
  document.body.append(canvas)
  
  const renderer = new WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(width, height)

  const camera = createCamera(width, height)

  await assetsPromise

  const scene = createScene()

  const player = createPlayer()
  player.object.position.add(new Vector3(0, 0, 2))
  useThirdPersonController(player, camera)
  scene.add(player.object)

  const ownCubicle = createCubicle()
  const ownScreenMat = ownCubicle.desktop.screen.material
  scene.add(ownCubicle.object)

  const textureLoader = new TextureLoader()

  const socket = new WebSocket('ws://localhost:3000')
  socket.binaryType = 'arraybuffer'

  let id = 0
  let room = 0
  socket.addEventListener('message', e => {
    const view = new DataView(e.data)
    const ev = view.getUint8(0)

    switch (ev) {
      case NetEvent.ID:
        id = view.getUint16(1)
        break;
      case NetEvent.ROOM:
        room = view.getUint8(1)
        break;
      case NetEvent.POSITION:
        console.log(new Vector3(
          view.getFloat32(1 + 0),
          view.getFloat32(1 + 4),
          view.getFloat32(1 + 8)
        ))
        break;
    }
  })

  useTicker(() => {
    if (!socket.OPEN) return
    const pos = player.object.position
    const buffer = new ArrayBuffer(1 + (4 * 3))
    const view = new DataView(buffer)
    view.setUint8(0, NetEvent.POSITION)
    view.setFloat32(1 + 0, pos.x)
    view.setFloat32(1 + 4, pos.y)
    view.setFloat32(1 + 8, pos.z)
    socket.send(buffer)
  }, 1)

  self.addEventListener('message', msg => {
    if (!msg?.data?.ev) return
    const { ev, data } = msg.data
    switch (ev) {
      case 'capture':
        const captureBlob = new Blob([data], {type: 'image/jpeg'})
        const captureDataUri = URL.createObjectURL(captureBlob)
        textureLoader.load(captureDataUri, (texture) => {
          const oldTexture = ownScreenMat.map
          ownScreenMat.map = texture
          ownScreenMat.needsUpdate = true
          oldTexture?.dispose()
        })
        break
    }
  })

  
  useTicker(delta => {
    dispatchPhysicsStep(delta)
    dispatchRenderUpdate(delta)
    renderer.render(scene, camera)
  }, 75)
  
  window.addEventListener('resize', () => {
    const { innerWidth: width, innerHeight: height } = window
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
    renderer.render(scene, camera)
  })
}

game()