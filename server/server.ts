import type { ServerWebSocket } from "bun"
import NetEvent from "../shared/NetEvents"


type UserData = { id: number, room: number }

const roomState = new Map<number, Map<number, Buffer>>()

let ID_COUNTER = 0
function getId() {
  ID_COUNTER++
  return ID_COUNTER
}

function getFreeRoom() {
  const id = 1
  if (!roomState.has(id)) roomState.set(id, new Map())
  return id
}

function createMessageBase(id: number, ev: NetEvent, payloadLen: number) {
  const buffer = Buffer.alloc(2 + 1 + payloadLen)
  buffer.writeInt16BE(id, 0)
  buffer.writeUint8(ev, 2)
  return buffer
}

function createMessage(ev: NetEvent, payloadLen: number, addPayload: (buffer: Buffer) => void, id = 0) {
  const buffer = createMessageBase(id, ev, payloadLen)
  addPayload(buffer)
  return buffer
}

const server = Bun.serve<UserData>({
  port: 3000,

  fetch(req, server) {
    server.upgrade(req, {
      data: { id: 0, room: 0 }
    })
  },

  websocket: {
    idleTimeout: 20,
    maxPayloadLength: 256,
    perMessageDeflate: false,
    closeOnBackpressureLimit: true,

    open(ws) {
      const id = getId()
      ws.data.id = id

      ws.sendBinary(createMessageBase(id, NetEvent.ID, 0))

      const room = getFreeRoom()
      ws.data.room = room

      roomState.get(ws.data.room)!.set(ws.data.id, createMessageBase(id, NetEvent.POSITION, 3 * 4))

      ws.subscribe("room:" + room)
      ws.publish("room:" + room, createMessageBase(id, NetEvent.JOINED, 0))

      const roomLen = Array.from(roomState.get(room)!.entries()).reduce((p, [_, b]) => p + b.length, 0)
      ws.sendBinary(createMessage(NetEvent.ROOM, 1 + roomLen, b => {
        b.writeUint8(room, 3)
        
        let cursor = 4
        roomState.get(room)!.forEach(pb => {
          pb.copy(b, cursor)
          cursor += pb.length
        })
      }))
    },
    
    message(ws, data: Buffer) {
      if (data.length == 0) { ws.close(); return }
      const ev = data.readUint8(0)
      if (ev <= NetEvent.MIN || ev >= NetEvent.MAX) { ws.close(); return }
      if (ev == NetEvent.ALIVE) return

      const buffer = Buffer.allocUnsafe(2 + data.length)
      buffer.writeUInt16BE(ws.data.id, 0)
      data.copy(buffer, 2)

      if (ev == NetEvent.CUBICLE || ev == NetEvent.POSITION) roomState.get(ws.data.room)!.set(ws.data.id, buffer)

      ws.publish("room:" + ws.data.room, buffer)
    },

    close(ws) {
      roomState.get(ws.data.room)?.delete(ws.data.id)
      server.publish("room:" + ws.data.room, createMessageBase(ws.data.id, NetEvent.LEFT, 0))
    }
  },
});

console.log(`Listening on localhost:${server.port}`);