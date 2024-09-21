const { Uuid } = require('uuid-tool');


const RTC_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};


const parsedUrl = new URL(window.location.href);
if (!(parsedUrl.searchParams.get('u') && parsedUrl.searchParams.get('t'))) {
  UI_setInputText('Connect with /connect in game');
  // throw Error('Missing parameters \'u\' or \'t\' in URL.');
}
const localUuid = parsedUrl.searchParams.get('u');


const peers = {};

let localStream;
navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  .then(stream => {
    localStream = stream;
    init();
    UI_hideInputText();
    UI_unhideInfo();
  })
  .catch(err => {
    console.log(err);
  });

// initiate WebSockets
let MCSocket, RTCSocket;
function init() {
  const MC_URL = `wss://${parsedUrl.host}/ws/mc${parsedUrl.search}`;
  const RTC_URL = `wss://${parsedUrl.host}/ws/rtc${parsedUrl.search}`;

  MCSocket = new WebSocket(MC_URL);
  // MCSocket.onmessage = handleMC;
  MCSocket.onclose = ({ code, reason }) => { console.log(`/mc closed: ${code} ${reason}`); closePeers() };


  RTCSocket = new WebSocket(RTC_URL);
  RTCSocket.onopen = () => MCSocket.onmessage = handleMC;
  RTCSocket.onmessage = handleRTC;
  RTCSocket.onclose = ({ code, reason }) => { console.log(`/rtc closed: ${code} ${reason}`); closePeers() };

  MCSocket.addEventListener('open', () => UI_setWsState('connected'));
  MCSocket.addEventListener('close', ({ code, reason }) => UI_setWsState(`closed: ${code} ${reason}`))
}

window.addEventListener('beforeunload', closePeers);

// === WEBSOCKET HANDLERS ===
// handle AudioProcessingData binary messages
async function handleMC(ev) {
  const audioData = await audioDataFromBytes(ev.data);
  for (const uuid in peers) {
    if (!(uuid in audioData))
      peers[uuid].close();
  }
  for (const uuid in audioData) {
    let peer = peers[uuid];
    if (peer)
      peer.process(audioData[uuid]);
    else
      peers[uuid] = new Peer(uuid);
  }
}

// handle RTC signalling messages
async function handleRTC(ev) {
  let { from, data } = JSON.parse(ev.data);
  if (!(from in peers))
    peers[from] = new Peer(from);
  await peers[from].handleSignal(data);
}

// === STREAM UTILITY CLASS ===
const AUDIOS_DIV = '#audios';
class Peer {

  // uuid: peer's uuid
  constructor(uuid) {
    this.uuid = uuid;
    this.receivedTrack = false;

    // audio element
    this.element = document.createElement('audio');
    document.querySelector(AUDIOS_DIV).appendChild(this.element);

    // processing nodes
    this.audioContext = new AudioContext();
    this.gainNode = this.audioContext.createGain();
    this.pannerNode = this.audioContext.createPanner();
    // configuration
    this.pannerNode.panningModel = 'HRTF';
    this.pannerNode.distanceModel = 'linear';
    this.pannerNode.refDistance = 1;
    this.pannerNode.maxDistance = SERVER_CONFIG.maxDistance;
    this.pannerNode.rolloffFactor = 1;
    this.pannerNode.coneInnerAngle = 60;
    this.pannerNode.coneOuterAngle = 90;
    this.pannerNode.coneOuterGain = 0.3;

    // peer connection
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.pc = new RTCPeerConnection(RTC_CONFIG);
    for (const track of localStream.getTracks()) {
      this.pc.addTrack(track, localStream);
    }
    this.pc.ontrack = ({ track, streams }) => {
      track.onunmute = () => {
        if (this.receivedTrack) return;
        else this.receivedTrack = true;
        this.element.srcObject = streams[0];
        this.audioContext.createMediaStreamSource(streams[0]).connect(this.gainNode);
        this.gainNode.connect(this.pannerNode);
        this.pannerNode.connect(this.audioContext.destination);
      };
    };
    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        this.send({ description: this.pc.localDescription });
      } catch (err) {
        console.error(err);
      } finally {
        this.makingOffer = false;
      }
    };
    this.pc.onicecandidate = ({ candidate }) => this.send({ candidate });
    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState in ['closed', 'failed'])
        this.close()
    };
    this.pc.on

    UI_addTr(this.uuid);
    UI_setTr(this.uuid, "new");
    this.pc.addEventListener('connectionstatechange', () => UI_setTr(this.uuid, this.pc.connectionState));
  }

  async handleSignal({ description, candidate }) {
    try {
      if (description) {
        const offerCollision = description.type === 'offer' && (this.makingOffer || this.pc.signalingState !== 'stable');
        const polite = localUuid > this.uuid;
        this.ignoreOffer = !polite && offerCollision;
        if (this.ignoreOffer) {
          return;
        }

        await this.pc.setRemoteDescription(description);
        if (description.type === 'offer') {
          await this.pc.setLocalDescription();
          this.send({ description: this.pc.localDescription });
        }
      } else if (candidate) {
        try {
          await this.pc.addIceCandidate(candidate);
        } catch (err) {
          if (!this.ignoreOffer) {
            throw err;
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  send(data) {
    RTCSocket.send(JSON.stringify({ to: this.uuid, data }));
  }

  // process using StreamProcessingData
  process(audioData) {
    let ct = this.audioContext.currentTime;
    if (!this.receivedTrack) return;
    this.gainNode.gain.setValueAtTime(audioData.enabled?1:0, ct);
    if (!audioData.enabled) return;
    if (this.audioContext.listener.forwardX) {
      this.audioContext.listener.forwardX.setValueAtTime(audioData.forwardX, ct);
      this.audioContext.listener.forwardY.setValueAtTime(audioData.forwardY, ct);
      this.audioContext.listener.forwardZ.setValueAtTime(audioData.forwardZ, ct);
    } else {
      this.audioContext.listener.setOrientation(audioData.forwardX, audioData.forwardY, audioData.forwardZ, 0, 1, 0);
    }
    this.pannerNode.positionX.setValueAtTime(audioData.positionX, ct);
    this.pannerNode.positionY.setValueAtTime(audioData.positionY, ct);
    this.pannerNode.positionZ.setValueAtTime(audioData.positionZ, ct);
    this.pannerNode.orientationX.setValueAtTime(audioData.orientationX, ct);
    this.pannerNode.orientationY.setValueAtTime(audioData.orientationY, ct);
    this.pannerNode.orientationZ.setValueAtTime(audioData.orientationZ, ct);
  }

  close() {
    UI_removeTr(this.uuid);
    this.element.remove();
    this.pc.close();
    delete peers[this.uuid];
  }
}

function closePeers() {
  for (const uuid in peers)
    peers[uuid].close()
}

// === CODEC === 
// parse binary AudioProcessingData to JSON
function audioDataFromBytes(data) {
  const reader = new FileReader();
  reader.readAsArrayBuffer(data);
  return new Promise(resolve => reader.addEventListener('loadend', () => {
    let data = {};
    const BYTES = 16 + 9*4 + 1;
    let parsedData = new Uint8Array(reader.result);
    for (let i = 0; i < parsedData.length; i += BYTES) {
      let uuid = new Uuid();
      uuid.fromBytes(Array.from(parsedData.slice(i, i + 16)));
      const bFloat = (f) => toFloat(parsedData.slice(i+f, i+f+4));
      data[uuid.toString()] = {
        forwardX: bFloat(4*4), forwardY: bFloat(5*4), forwardZ: bFloat(6*4),
        positionX: bFloat(7*4), positionY: bFloat(8*4), positionZ: bFloat(9*4),
        orientationX: bFloat(10*4), orientationY: bFloat(11*4), orientationZ: bFloat(12*4),
        enabled: parsedData[i+13*4]==1,
      };
    }
    resolve(data);
  }));
}

// UInt8Array to float32
function toFloat(arr) {
  let buf = arr.buffer;
  let view = new DataView(buf);
  return view.getFloat32(0);
}

// === UI ===
function UI_hideInputText() {
  let e = document.querySelector('#input-text');
  e.style['display'] = 'none';
}
function UI_setInputText(text) {
  let e = document.querySelector('#input-text');
  e.textContent = text;
}
function UI_unhideInfo() {
  let e = document.querySelector('#info');
  e.style['display'] = 'block';
}
function UI_setWsState(text, color) {
  let e = document.querySelector('#ws-state');
  e.textContent = text;
  if (text === 'connected') e.style['color'] = 'limegreen';
  else if (text.includes('closed:')) e.style['color'] = 'red';
}
function UI_addTr(uuid) {
  let tr = document.createElement('tr');
  tr.id = uuid;
  for (let className of ['td-uuid', 'td-state']) {
    let td = document.createElement('td');
    td.classList.add(className);
    if (className === 'td-uuid') td.textContent = uuid;
    tr.append(td);
  }
  let table = document.querySelector('#peers');
  table.appendChild(tr);
}
function UI_setTr(uuid, state) {
  let tr = document.getElementById(uuid);
  let td_state = tr.querySelector('.td-state');
  td_state.textContent = state;
  if (state === 'connected') td_state.style['color'] = 'limegreen';
  else if (state === 'new' || state === 'connecting') td_state.style['color'] = 'yellow';
  else td_state.style['color'] = 'red'
}
function UI_removeTr(uuid) {
  document.getElementById(uuid).remove();
}

new QRCode(document.querySelector("#qrcode"), {
  text: window.location.href,
  colorLight : "#000000",
  colorDark : "#ffffff",
});
document.querySelector("#fix").onclick = () => {
  let e = document.querySelector("#qrcode");
  let c = document.querySelector('#connectivity');
  let a = document.querySelector('#fix');
  if (e.style['display'] === 'block') {
    e.style['display'] = 'none';
    c.style['display'] = 'block';
    a.textContent = 'Not working?';
  } else {
    e.style['display'] = 'block';
    c.style['display'] = 'none';
    a.textContent = 'Back';
  }
}





