import { 
  WebGLRenderer, Scene, PerspectiveCamera, AmbientLight, AnimationMixer, AnimationClip, 
  Color, MeshLambertMaterial, Vector3, GridHelper, AnimationAction, TextureLoader, Group, 
  PlaneGeometry, Mesh, Object3D, RectAreaLight, Quaternion, MeshStandardMaterial, Texture, RepeatWrapping, Plane, MeshPhongMaterial, WebGLShadowMap 
} from 'three'

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

const tStart = performance.now()

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
  
    let active = true

    const render = () => {
      if (!active) return

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
    
    return () => active = false
  }
  
  const assets = new Map<string, unknown>()
  function loadAssets() {
    const assetsDir = (self as unknown as { assetsDir: string }).assetsDir + '/'

    const texLoader = new TextureLoader()
    const loadTex = (src: string) => new Promise<Texture>(res => texLoader.load(assetsDir + src, res))
    const gltfLoader = new GLTFLoader()
    const loadGLTF = (src: string) => new Promise<GLTF>(res => gltfLoader.load(assetsDir + src, res))

    return Promise.all([
      loadTex('ground.png').then(tex => {
        tex.wrapS = RepeatWrapping
        tex.wrapT = RepeatWrapping
        assets.set('ground', tex)
      }),
      loadGLTF('stickman.glb').then(gltf => {
        const mesh = gltf.scene.children[0].children[0]
        mesh.material = new MeshStandardMaterial({ color: 0xffffff })
        assets.set('stickman', gltf)
      }),
      loadGLTF('desktop.glb').then(gltf => {
        gltf.scene.children[0].children[0].children[0].material = new MeshStandardMaterial({ color: 0xffffff })
        assets.set('desktop', gltf)
      }),
      loadGLTF('cubicle.glb').then(gltf => {
        const mesh = gltf.scene.children[0].children[0].children[0]
        mesh.material = new MeshStandardMaterial({ color: 0xffffff })
        assets.set('cubicle', gltf)
      })
    ])
  }

  const PI_2 = Math.PI * 2
  const PI_H = Math.PI / 2

  const moveSpeed = 2
  const turnSpeed = 3

  function createCamera(width: number, height: number) {
    const camera = new PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.z = 10
    return camera
  }
  
  function createScene() {
    const scene = new Scene()
    scene.background = new Color(0xaaaaaa)
    
    // const gh = new GridHelper()
    // gh.position.y = 0.001
    // scene.add(gh)

    const light = new AmbientLight(0xffffff, 0.5)
    scene.add(light)

    const width = 10
    const height = 10
    const intensity = 2.2
    const rectLight = new RectAreaLight(0xffffff, intensity,  width, height)
    rectLight.position.set(0, 10, 0)
    rectLight.lookAt(0, 0, 0)
    scene.add(rectLight)
    
    const rectLightHelper = new RectAreaLightHelper(rectLight)
    rectLight.add(rectLightHelper)

    const gw = 10, gd = 50
    const ground = new Mesh(new PlaneGeometry(gw, gd), new MeshStandardMaterial({ metalness: 0, roughness: 1 }))
    ground.rotation.x = -PI_H
    const groundTex = assets.get('ground') as Texture
    groundTex.repeat.set(gw / 4, gd / 2)
    ground.material.map = groundTex
    scene.add(ground)
    
    return scene
  }

  function createStickman() {
    const gltf = assets.get('stickman') as GLTF
    const object = cloneSkeleton(gltf.scene)
    const mixer = new AnimationMixer(object)
    const animations = gltf.animations
  
    beforeRenderUpdate(delta => mixer.update(delta))
  
    let currentAction: AnimationAction
    return { object, mixer,
      currentAction: () => (currentAction as unknown as { _clip: { name: string }})._clip.name,
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

    const vector = new Vector3()

    beforePhysicsStep(delta => {
      if (turning != 0) {
        object.rotation.y += PI_2 + ((turning * turnSpeed) * delta) // TODO 
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

    const desktop = (assets.get('desktop') as GLTF).scene.clone() as Object3D
    desktop.scale.subScalar(0.1)
    group.add(desktop)

    const geometry = new PlaneGeometry(0.721, 0.414)
    const material = new MeshLambertMaterial({ color: 0xffffff })
    const screen = new Mesh(geometry, material)
    screen.position.add(new Vector3(0.05, 0.4, 0.0))
    screen.rotation.setFromVector3(new Vector3(0, PI_H, 0.))
    group.add(screen)

    return { object: group, screen }
  }

  function createCubicle() {
    const group = new Group()
    const desktop = createDesktop()
    desktop.object.position.y += 0.74
    desktop.object.position.x += 0.48
    desktop.object.position.z += 0.0
    group.add(desktop.object)

    const cubicle = (assets.get('cubicle') as GLTF).scene.clone() as Object3D
    cubicle.scale.subScalar(0.3)
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

  let room = 0
  let playerId = 0

  const pawns = new Map<number, { pos: Vector3, rot: Quaternion } & ReturnType<typeof createStickman>>()

  function spawnPawn(id: number, pos: Vector3) {
    if (id == playerId) return

    const sm = createStickman()
    sm.object.position.copy(pos)
    sm.playAnimation('Idle')
    scene.add(sm.object)

    pawns.set(id, { ...sm, pos, rot: new Quaternion() })
  }

  function removePawn(id: number) {
    const pawn = pawns.get(id)!
    scene.remove(pawn.object)
    pawns.delete(id)
  }

  function handlePawnPosUpdate(id: number, pos: Vector3) {
    const pawn = pawns.get(id)!
    if (!pawn.pos.equals(pos)) {
      if (pawn.currentAction() != 'Running') {
        pawn.playAnimation('Running')
      }
      pawn.pos = pos
    }
  }

  function handlePawnRotUpdate(id: number, rot: number) {
    const pawn = pawns.get(id)!
    pawn.rot = new Quaternion().setFromAxisAngle(pawn.object.up, rot)
  }

  const dirVec = new Vector3()
  beforePhysicsStep(delta => {
    pawns.forEach(pawn => {
      if (!pawn.object.position.equals(pawn.pos)) {
        const direction = dirVec.subVectors(pawn.pos, pawn.object.position).normalize()
        const distance = pawn.object.position.distanceTo(pawn.pos)
        const deltaScalar = moveSpeed * delta
        if (distance > deltaScalar) {
          pawn.object.position.addScaledVector(direction, deltaScalar)
        } else {
          pawn.object.position.copy(pawn.pos)
          setTimeout(() => pawn.object.position.equals(pawn.pos) && pawn.playAnimation('Idle'), 180)
        }
      }
    })
  })

  beforePhysicsStep(delta => {
    pawns.forEach(pawn => {
      if (!pawn.object.quaternion.equals(pawn.rot)) {
        pawn.object.quaternion.rotateTowards(pawn.rot, turnSpeed * delta)
      }
    })
  })

  socket.addEventListener('message', e => {
    const view = new DataView(e.data)
    let cursor = 0
    const id = view.getUint16(cursor)
    cursor += 2
    const ev = view.getUint8(2)
    cursor += 1

    switch (ev) {
      case NetEvent.ID:
        playerId = id
        break
      case NetEvent.ROOM:
        room = view.getUint8(cursor)
        cursor += 1
        while (cursor < (view.byteLength - 4)) {
          spawnPawn(
            view.getUint16(cursor),
            new Vector3(
              view.getFloat32(cursor + 3 + 0),
              view.getFloat32(cursor + 3 + 4),
              view.getFloat32(cursor + 3 + 8)
            )
          )
          cursor += 3 + (3 * 4)
        }
        break
      case NetEvent.JOINED:
        spawnPawn(id, new Vector3())
        break
      case NetEvent.LEFT:
        removePawn(id)
        break
      case NetEvent.POSITION:
        handlePawnPosUpdate(id, new Vector3(
          view.getFloat32(cursor + 0),
          view.getFloat32(cursor + 4),
          view.getFloat32(cursor + 8)
        ))
        break
      case NetEvent.ROTATION:
        handlePawnRotUpdate(id, view.getUint16(cursor) / 10000)
        break
    }
  })

  socket.addEventListener('open', () => {
    let lastPos = new Vector3()
    const pt = setInterval(() => {
      if (!socket.OPEN || socket.CONNECTING) return
      const pos = player.object.position
      if (pos.equals(lastPos)) return
      lastPos.copy(pos)
      const buffer = new ArrayBuffer(1 + (3 * 4))
      const view = new DataView(buffer)
      view.setUint8(0, NetEvent.POSITION)
      view.setFloat32(1 + 0, pos.x)
      view.setFloat32(1 + 4, pos.y)
      view.setFloat32(1 + 8, pos.z)
      socket.send(buffer)
    }, 1000 / 4)

    let lastRot = 0
    const rt = setInterval(() => {
      if (!socket.OPEN || socket.CONNECTING) return
      const rot = Math.abs(Math.floor((player.object.rotation.y % PI_2) * 10000))
      if (rot == lastRot) return
      lastRot = rot
      const buffer = new ArrayBuffer(1 + 2)
      const view = new DataView(buffer)
      view.setUint8(0, NetEvent.ROTATION)
      view.setUint16(1, rot)
      socket.send(buffer)
    }, 1000 / 6)

    socket.addEventListener('close', () => {
      clearTimeout(pt)
      clearTimeout(rt)
    })
  }, { once: true })

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
  }, 44)
  
  useTicker(delta => {
    dispatchRenderUpdate(delta)
    renderer.render(scene, camera)
  }, 60)
  
  window.addEventListener('resize', () => {
    const { innerWidth: width, innerHeight: height } = window
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
    renderer.render(scene, camera)
  })

  console.log('startup: ' + ((performance.now() - tStart) / 1000).toFixed(2) + 's')
}

game()