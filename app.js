import { relayInit, generatePrivateKey, getPublicKey, finishEvent } 
from "https://esm.sh/nostr-tools@1.17.0"

// --- Relays for signaling ---
const RELAYS = [
  "wss://nos.lol",
  "wss://relay.snort.social",
  "wss://nostr.wine"
]

// Connect to relays
const relayConnections = RELAYS.map(url => {
  const r = relayInit(url)
  r.connect()
  r.on("connect",()=>console.log("Connected to",url))
  r.on("error",()=>console.log("Failed",url))
  return r
})

// --- Generate keys ---
const priv = generatePrivateKey()
const pub = getPublicKey(priv)

// --- Game state ---
let peer
let symbol = "X"
const board = Array(9).fill("")
const boardEl = document.getElementById("board")

// Create UI
for(let i=0;i<9;i++){
  const btn=document.createElement("button")
  btn.className="cell"
  btn.onclick=()=>makeMove(i)
  boardEl.appendChild(btn)
}

function render(){
  [...document.querySelectorAll(".cell")].forEach((c,i)=>{
    c.innerText=board[i]
  })
}

// Local move
function makeMove(i){
  if(board[i]) return
  board[i]=symbol
  render()
  if(peer && peer.connected){
    peer.send(JSON.stringify({type:"move", index:i}))
  }
}

// Remote move
function applyRemoteMove(i){
  board[i] = symbol==="X"?"O":"X"
  render()
}

// --- Event listeners ---
document.getElementById("host").onclick = hostGame
document.getElementById("join").onclick = joinGame

// --- Host Game ---
function hostGame(){
  peer = new SimplePeer({ initiator:true, trickle:false })

  peer.on("signal",signal=>{
    // Publish to all relays
    const event = finishEvent({
      kind:30000,
      created_at: Math.floor(Date.now()/1000),
      tags:[["t","tictactoe"]],
      content: JSON.stringify(signal),
      pubkey: pub
    }, priv)

    relayConnections.forEach(r=>r.publish(event))
  })

  peer.on("data",msg=>{
    const m = JSON.parse(msg)
    if(m.type==="move") applyRemoteMove(m.index)
  })
}

// --- Join Game ---
function joinGame(){
  relayConnections.forEach(r=>{
    const sub = r.sub([{kinds:[30000], "#t":["tictactoe"]}])
    sub.on("event",event=>{
      const signal = JSON.parse(event.content)
      peer = new SimplePeer({ initiator:false, trickle:false })

      peer.on("signal",answer=>{
        const ansEvent = finishEvent({
          kind:30001,
          created_at: Math.floor(Date.now()/1000),
          tags:[["p",event.pubkey]],
          content: JSON.stringify(answer),
          pubkey: pub
        }, priv)

        relayConnections.forEach(rel => rel.publish(ansEvent))
      })

      peer.signal(signal)

      peer.on("data",msg=>{
        const m = JSON.parse(msg)
        if(m.type==="move") applyRemoteMove(m.index)
      })
    })
  })
}