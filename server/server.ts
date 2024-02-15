import type { ServerWebSocket } from "bun"
import NetEvent from "../shared/NetEvents"


type UserData = { id: number, room: number }

const socketById = new Map<number, ServerWebSocket<UserData>>()
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

function messageBuffer(ev: NetEvent, payloadLen: number) {
  const buffer = Buffer.alloc(1 + payloadLen)
  buffer.writeUint8(ev, 0)
  return buffer
}

function createMessage(ev: NetEvent, payloadLen: number, addPayload: (buffer: Buffer) => void) {
  const buffer = messageBuffer(ev, payloadLen)
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
      socketById.set(id, ws)

      ws.sendBinary(createMessage(NetEvent.ID, 2, b => b.writeUInt16BE(id, 1)))

      const room = getFreeRoom()
      ws.data.room = room
      ws.subscribe("room:" + room)
      ws.publish("room:" + room, createMessage(NetEvent.JOINED, 2, b => b.writeUInt16BE(id, 1)))
      ws.sendBinary(createMessage(NetEvent.ROOM, 1, b => b.writeUint8(room, 1)))

      roomState.get(room)!.forEach(b => ws.sendBinary(b))
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
      ws.publish("room:" + ws.data.room, createMessage(NetEvent.LEFT, 2, b => b.writeUInt16BE(ws.data.id, 1)))
      socketById.delete(ws.data.id)
    }
  },
});

console.log(`Listening on localhost:${server.port}`);