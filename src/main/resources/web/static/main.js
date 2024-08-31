const { Uuid } = require('uuid-tool');


const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};


const parsedUrl = new URL(window.location.href);
if (!(parsedUrl.searchParams.get('u') && parsedUrl.searchParams.get('t'))) {
  throw Error('Missing parameters \'u\' or \'t\' in URL.');
}
const localUuid = parsedUrl.searchParams.get('u');


const peers = {};

let localStream;
navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  .then(stream => {
    localStream = stream;
    init();
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
  MCSocket.onmessage = handleMC;
  MCSocket.onclose = ({ code, reason }) => { console.log(`/mc closed: ${code} ${reason}`); closePeers(); };

  RTCSocket = new WebSocket(RTC_URL);
  RTCSocket.onmessage = handleRTC;
  RTCSocket.onclose = ({ code, reason }) => { console.log(`/rtc closed: ${code} ${reason}`), closePeers(); };
}

window.addEventListener("beforeunload", closePeers);

// === WEBSOCKET HANDLERS ===
// handle AudioProcessingData binary messages
async function handleMC(ev) {
  const audioData = await audioDataFromBytes(ev.data);
  console.log(audioData);
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
class Peer extends MediaStream {

  // uuid: peer's uuid
  constructor(uuid) {
    super();

    this.uuid = uuid;

    // audio element
    this.element = document.createElement('audio');
    this.element.id = this.uuid;
    document.querySelector(AUDIOS_DIV).appendChild(this.element);

    // processing nodes
    this.audioContext = new AudioContext();
    this.gainNode = this.audioContext.createGain();
    this.stereoPannerNode = this.audioContext.createStereoPanner();

    // peer connection
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.pc = new RTCPeerConnection(RTC_CONFIG);
    for (const track of localStream.getTracks()) {
      this.pc.addTrack(track, localStream);
    }
    this.pc.ontrack = ({ track, streams }) => {
      track.onunmute = () => {
        if (this.element.srcObject) return;
        this.addTrack(track);
        const source = this.audioContext.createMediaStreamSource(this);
        source.connect(this.gainNode);
        source.connect(this.stereoPannerNode);
        this.gainNode.connect(this.audioContext.destination);
        this.stereoPannerNode.connect(this.audioContext.destination);
        this.element.srcObject = this;
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

  }

  async handleSignal({ description, candidate }) {
    try {
      if (description) {
        const offerCollision = description.type === "offer" && (this.makingOffer || this.pc.signalingState !== "stable");
        const polite = localUuid > this.uuid;
        this.ignoreOffer = !polite && offerCollision;
        if (this.ignoreOffer) {
          return;
        }

        await this.pc.setRemoteDescription(description);
        if (description.type === "offer") {
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
    if (!this.getAudioTracks()[0]) return;
    this.gainNode.gain.setValueAtTime(audioData.gain, this.audioContext.currentTime);
    this.stereoPannerNode.pan.setValueAtTime(audioData.pan, this.audioContext.currentTime);
    this.getAudioTracks()[0].enabled = audioData.enabled;
  }

  close() {
    this.pc.close();
    this.element.remove();
    delete peers[this.uuid];
  }
}

function closePeers() {
  for (const uuid in peers)
    peers[uuid].close()
}


// === PARSERS === 
// parse binary AudioProcessingData to JSON
function audioDataFromBytes(data) {
  const reader = new FileReader();
  reader.readAsArrayBuffer(data);
  return new Promise(resolve => reader.addEventListener('loadend', () => {
    let data = {};
    const BYTES = 25;
    let parsedData = new Uint8Array(reader.result);
    for (let i = 0; i < parsedData.length; i += BYTES) {
      let uuid = new Uuid();
      uuid.fromBytes(Array.from(parsedData.slice(i, i + 16)));
      let gain = toFloat((parsedData[i + 16] << 8 * 3) + (parsedData[i + 17] << 8 * 2) + (parsedData[i + 18] << 8 * 1) + (parsedData[i + 19] << 8 * 0));
      let pan = toFloat((parsedData[i + 20] << 8 * 3) + (parsedData[i + 21] << 8 * 2) + (parsedData[i + 22] << 8 * 1) + (parsedData[i + 23] << 8 * 0));
      let enabled = parsedData[i + 24] == 1;
      data[uuid.toString()] = { gain, pan, enabled };
    }
    resolve(data);
  }));
}

// bytes of uint32 to float32
function toFloat(n) {
  n = +n;
  let res;
  let mts = n & 0x007fffff;
  let sgn = (n & 0x80000000) ? -1 : 1;
  let exp = (n & 0x7f800000) >>> 23;
  function mantissa(mts) {
    let bit = 0x00400000;
    while (mts && bit) {
      mts /= 2;
      bit >>>= 1;
    }
    return mts;
  }
  if (exp === 0xff) {
    res = mts ? NaN : sgn * Infinity;
  } else if (exp) {
    res = sgn * ((1 + mantissa(mts)) * Math.pow(2, exp - 127));
  } else if (mts) {
    res = sgn * (mantissa(mts) * Math.pow(2, -126));
  } else {
    res = (sgn > 0) ? 0 : -0;
  }
  return res;
}