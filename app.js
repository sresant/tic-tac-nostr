import {
    relayInit,
    generatePrivateKey,
    getPublicKey
  } from "https://esm.sh/nostr-tools@1.17.0"
  

const relay = relayInit("wss://relay.damus.io")
await relay.connect()

const priv = generatePrivateKey()
const pub = getPublicKey(priv)

let peer
let symbol="X"

const board = Array(9).fill("")
const boardEl = document.getElementById("board")

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

function makeMove(i){

  if(board[i]) return

  board[i]=symbol
  render()

  peer.send(JSON.stringify({
    type:"move",
    index:i
  }))
}

function applyRemoteMove(i){

  board[i]=symbol==="X"?"O":"X"
  render()
}

document.getElementById("host").onclick=hostGame
document.getElementById("join").onclick=joinGame

function hostGame(){

  peer = new SimplePeer({ initiator:true, trickle:false })

  peer.on("signal",signal=>{

    const event={
      kind:30000,
      created_at:Math.floor(Date.now()/1000),
      tags:[["t","tictactoe"]],
      content:JSON.stringify(signal),
      pubkey:pub,
      sig:""
    }

    relay.publish(event)
  })

  peer.on("data",msg=>{
    const m=JSON.parse(msg)
    if(m.type==="move") applyRemoteMove(m.index)
  })
}

function joinGame(){

  const sub = relay.sub([{kinds:[30000],"#t":["tictactoe"]}])

  sub.on("event",event=>{

    const signal=JSON.parse(event.content)

    peer = new SimplePeer({ initiator:false, trickle:false })

    peer.on("signal",answer=>{
      relay.publish({
        kind:30001,
        created_at:Math.floor(Date.now()/1000),
        tags:[["p",event.pubkey]],
        content:JSON.stringify(answer),
        pubkey:pub,
        sig:""
      })
    })

    peer.signal(signal)

    peer.on("data",msg=>{
      const m=JSON.parse(msg)
      if(m.type==="move") applyRemoteMove(m.index)
    })

  })
}
