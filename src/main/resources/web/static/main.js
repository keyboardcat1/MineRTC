const { Uuid } = require('uuid-tool');

let parsedUrl = new URL(window.location.href);
if (!(parsedUrl.searchParams.get('u') && parsedUrl.searchParams.get('t'))) {
    throw Error('Missing parameters \'u\' or \'t\' in URL');
}

const localUuid = parsedUrl.searchParams.get('u');

const MC_URL = `wss://${parsedUrl.host}/ws/mc${parsedUrl.search}`;
const RTC_URL = `wss://${parsedUrl.host}/ws/rtc${parsedUrl.search}`;
const ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.l.google.com:5349" },
    { urls: "stun:stun1.l.google.com:3478" },
];

const streams = {};

let localStream;
navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then(stream => { localStream = stream; init() });


const MCSocket = new WebSocket(MC_URL);
const RTCSocket = new WebSocket(RTC_URL);

// initiate WebSockets
function init() {
    MCSocket.addEventListener('open', handleOpen);
    MCSocket.addEventListener('message', handleMC);
    MCSocket.addEventListener('close', handleClose);

    RTCSocket.addEventListener('open', handleOpen);
    RTCSocket.addEventListener('message', handleRTC);
    RTCSocket.addEventListener('close', handleClose);
}


// === WEBSOCKET HANDLERS ===
// handle AudioProcessingData binary messages
async function handleMC(ev) {
    const audioData = await audioDataFromBytes(ev.data);
    for (const uuid in audioData) {
        let stream = streams[uuid];
        if (stream)
            stream.process(audioData[uuid]);
        else
            streams[uuid] = new Stream(uuid);
    }
}

// handle RTC signalling messages
function handleRTC(ev) {
    const signal = JSON.parse(ev.data);
    const data = signal.data;

    if (!(signal.from in streams)) {
        if (data.type == 'offer') {
            streams[signal.from] = new Stream(signal.from);
        } else {
            return;
        }
    }
    const connection = streams[signal.from].connection;

    switch (data.type) {
        case 'offer':
            console.log(data);
            connection.setRemoteDescription(data.body);
            connection.createAnswer().then(answer => {
                let response = { type: 'answer', body: answer };
                send(signal.from, response);
            });
            break;
        case 'answer':
            connection.setRemoteDescription(data.body);
            break;
        case 'candidate':
            connection.addIceCandidate(data.body);
            break;
    }
}

// handle open
let opens = 0;
function handleOpen(ev) {
    opens++;
    if (opens == 2) statusConnected();
}

// handle close
function handleClose(ev) {
    statusDisconnected();
    console.log(`WebSocket Error: ${ev.code} ${ev.reason}`);
}


// === WEBRTC UTILITIES ===
// connect to specified uuid and configure connection
function connect(to) {
    const config = { iceServers: ICE_SERVERS };
    const connection = new RTCPeerConnection(config);
    connection.addEventListener('icecandidate', ev => {
        let response = { type: 'candidate', body: ev.candidate };
        send(to, response);
    });

    if (localUuid > to) {
        connection.createOffer().then(offer => {
            connection.setLocalDescription(offer);
            let response = { type: 'offer', body: offer };
            send(to, response);
        });
    }

    return connection;
}

// RTCSocket.send() "to uuid" utility
function send(to, data) {
    RTCSocket.send(JSON.stringify({ to, data }));
}


// === STREAM UTILITY CLASS ===
const AUDIOS_DIV = '#audios';
// MediaStream coupled with a connection, an audio HTML element and audio processing
class Stream extends MediaStream {

    // uuid: peer's uuid
    constructor(uuid) {
        super();

        this.uuid = uuid;

        this.element = document.createElement('audio');
        this.element.id = this.uuid;
        this.element.srcObject = this;
        document.querySelector(AUDIOS_DIV).appendChild(this.element);

        this.audioContext = new AudioContext();
        this.gainNode = this.audioContext.createGain();
        this.stereoPannerNode = this.audioContext.createStereoPanner();

        this.connection = connect(this.uuid);
        this.connection.addTrack(localStream.getAudioTracks()[0]);
        this.connection.addEventListener('track', ev => {
            this.addTrack(ev.track);
            const source = this.audioContext.createMediaStreamSource(this);
            source.connect(this.gainNode);
            source.connect(this.stereoPannerNode);
            this.gainNode.connect(this.audioContext.destination);
            this.stereoPannerNode.connect(this.audioContext.destination);
        });

        this.connection.addEventListener('connectionstatechange', ev => {
            if (this.connection.connectionState == 'closed')
                this.close();
        });
    }

    // process using StreamProcessingData
    process(data) {
        this.gainNode.gain.setValueAtTime(data.gain, this.audioContext.currentTime);
        this.stereoPannerNode.pan.setValueAtTime(data.pan, this.audioContext.currentTime);
        this.getAudioTracks()[0].enabled = data.enabled;
    }

    // handle close event
    close() {
        this.connection.close();
        this.element.remove();
        delete streams[this.uuid];
    }
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


// === UI ===
// #status "Connected."
function statusConnected() {
    const element = document.getElementById('status');
    element.textContent = 'Connected.';
    element.style.color = 'limegreen';
}
// #status "Disconnected."
function statusDisconnected() {
    const element = document.getElementById('status');
    element.textContent = 'Disonnected.';
    element.style.color = 'red';
}
