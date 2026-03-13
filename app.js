import { relayInit, generatePrivateKey, getPublicKey, finishEvent } 
from "https://esm.sh/nostr-tools@1.17.0"

// --- Relays ---
const RELAYS = [
  "wss://nos.lol",
  "wss://relay.snort.social",
  "wss://nostr.wine"
]

// --- Connect to relays ---
const relays = RELAYS.map(url=>{
  const r = relayInit(url)
  r.connect()
  r.on("connect",()=>console.log("Connected",url))
  r.on("error",()=>console.log("Failed",url))
  return r
})

// --- Keys ---
const priv = generatePrivateKey()
const pub = getPublicKey(priv)

// --- Game ---
let peer, symbol="X"
let roomCode = ""
const board = Array(9).fill("")
const boardEl = document.getElementById("board")
const statusEl = document.getElementById("status")
const roomEl = document.getElementById("roomcode")

// --- UI ---
for(let i=0;i<9;i++){
  const btn=document.createElement("button")
  btn.className="cell"
  btn.onclick=()=>makeMove(i)
  boardEl.appendChild(btn)
}

function render(){
  board.forEach((v,i)=>{
    document.querySelectorAll(".cell")[i].innerText=v
  })
}

function checkWin(){
  const combos=[
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ]
  for(const c of combos){
    if(board[c[0]] && board[c[0]]===board[c[1]] && board[c[1]]===board[c[2]]){
      statusEl.innerText=`${board[c[0]]} wins!`
      return true
    }
  }
  if(board.every(c=>c)) statusEl.innerText="Draw!"
  return false
}

// --- Moves ---
function makeMove(i){
  if(board[i] || !peer || !peer.connected || statusEl.innerText) return
  board[i]=symbol
  render()
  peer.send(JSON.stringify({type:"move",index:i}))
  checkWin()
}

function applyRemoteMove(i){
  board[i] = symbol==="X"?"O":"X"
  render()
  checkWin()
}

// --- Room Code Generator ---
function generateRoomCode(){
  return Math.random().toString(36).substring(2,6).toUpperCase()
}

// --- Host ---
document.getElementById("host").onclick = () => {
  roomCode = generateRoomCode()
  roomEl.innerText = "Room: "+roomCode
  symbol="X"
  peer = new SimplePeer({ initiator:true, trickle:false })

  peer.on("signal",signal=>{
    const event = finishEvent({
      kind:30000,
      created_at: Math.floor(Date.now()/1000),
      tags:[["t","tictactoe"],["room",roomCode]],
      content: JSON.stringify(signal),
      pubkey: pub
    }, priv)
    relays.forEach(r=>r.publish(event))
  })

  peer.on("data",msg=>{
    const m = JSON.parse(msg)
    if(m.type==="move") applyRemoteMove(m.index)
  })

  peer.on("connect",()=>statusEl.innerText="Connected to player!")
}

// --- Join ---
document.getElementById("join").onclick = () => {
  roomCode = prompt("Enter room code:").toUpperCase()
  symbol="O"

  relays.forEach(r=>{
    const sub = r.sub([{kinds:[30000],"#t":["tictactoe"],"#room":[roomCode]}])
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
        relays.forEach(rel => rel.publish(ansEvent))
      })

      peer.signal(signal)

      peer.on("data",msg=>{
        const m = JSON.parse(msg)
        if(m.type==="move") applyRemoteMove(m.index)
      })

      peer.on("connect",()=>statusEl.innerText="Connected to host!")
    })
  })
}
