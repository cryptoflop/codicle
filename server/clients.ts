
function simulateClient() {
  const socket = new WebSocket("ws://localhost:3000")

  let id: number

  socket.addEventListener("message", event => {
    
    console.log(event.data)

    
    
  })

  setTimeout(() => socket.send(Uint8Array.from([])), 1000)

}

Array(1).fill(1).forEach(simulateClient)