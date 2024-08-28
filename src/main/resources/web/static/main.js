const { Uuid } = require('uuid-tool');

let parsedUrl = new URL(window.location.href);
if (!(parsedUrl.searchParams.get('u') && parsedUrl.searchParams.get('t'))) {
    throw Error('Missing parameters \'u\' or \'t\' in URL');
}

const localUuid = parsedUrl.searchParams.get('u');


const MC_URL = `wss://${parsedUrl.host}/ws/mc${parsedUrl.search}`;
const RTC_URL = `wss://${parsedUrl.host}/ws/rtc${parsedUrl.search}`;
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]; // TODO: request stuns

let audioData = {};
const streams = {};

let MCSocket = new WebSocket(MC_URL);
MCSocket.addEventListener('message', handleMC);
MCSocket.addEventListener('close', () => { throw Error('MC Connection closed'); });

let RTCSocket = new WebSocket(RTC_URL);
MCSocket.addEventListener('message', handleRTC);
MCSocket.addEventListener('close', () => { throw Error('RTC Connection closed'); });


async function handleMC(ev) {
    audioData = await audioDataFromBytes(ev.data);
    console.log(audioData);
    updateStreams(audioData);
}

function handleRTC(ev) {
    const signal = JSON.parse(ev.data);
    const data = signal.data;

    if (!(signal.from in streams) && data.type == 'offer' && signal.from in audioData)
        streams[signal.from] = connect(signal.from, signal.data)
    else
        return
    const connection = streams[signal.from];

    switch (data.type) {
        case 'offer':
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

function updateStreams(audioData) {
    const AUDIOS_DIV = '#audios';
    for (const uuid in audioData) {
        let stream;
        if (stream = streams[uuid])
            stream.process(audioData[uuid]);
        else
            streams[uuid] = new Stream(uuid);
    }

    for (const uuid in streams) {
        if (uuid in audioData) continue;
        streams[uuid].connection.close();
        streams[uuid].element.remove();
        delete streams[uuid];
    }

}

function connect(to, offer) {
    const config = { iceServers: ICE_SERVERS };
    const connection = new RTCPeerConnection(config)
    connection.addEventListener('icecandidate', ev => {
        let response = { type: 'candidate', body: ev.candidate };
        send(to, response);
    });

    if (offer) {
        connection.setRemoteDescription(data.body);
        connection.createAnswer().then(answer => {
            let response = { type: 'answer', body: answer };
            send(to, response);
        });
    } else if (localUuid > to) {
        connection.createOffer().then(offer => {
            connection.setLocalDescription(offer);
            let response = { type: 'offer', body: offer };
            send(to, response);
        });
    }

    return connection;
}
function send(to, data) {
    RTCSocket.send(JSON.stringify({ to, data }));
}



class Stream extends MediaStream {
    constructor(uuid, connection) {
        this.uuid = uuid;

        this.element = document.createElement('audio');;
        this.element.id = this.uuid;
        this.element.srcObject = this;
        document.querySelector(AUDIOS_DIV).appendChild(this.element);

        this.audioContext = new AudioContext();
        this.gainNode = this.audioContext.createGain();
        this.stereoPannerNode = this.audioContext.createStereoPanner();

        if (connection)
            this.connection = connection;
        else
            this.connection = connect(this.uuid);
        this.connection.addTrack(localStream.getAudioTracks()[0]);
        this.connection.addEventListener('track', ev => {
            const source = this.audioContext.createMediaStreamSource(this);
            source.connect(this.gainNode);
            source.connect(this.stereoPannerNode);
            this.gainNode.connect(this.audioContext.destination);
            this.stereoPannerNode.connect(this.audioContext.destination);
        })

        super()
    }

    process(data) {
        this.gainNode.gain.setValueAtTime(data.gain, this.audioContext.currentTime);
        this.stereoPannerNode.pan.setValueAtTime(data.pan, this.audioContext.currentTime);
        this.element.muted = data.muted;
    }
}


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
            let muted = parsedData[i + 24] == 1;
            data[uuid.toString()] = { gain, pan, muted };
        }
        resolve(data);
    }));
}
//bytes of uint32 to float32
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
        //NaN or +/- Infinity
        res = mts ? NaN : sgn * Infinity;
    } else if (exp) {
        //Normalized value
        res = sgn * ((1 + mantissa(mts)) * Math.pow(2, exp - 127));
    } else if (mts) {
        //Subnormal
        res = sgn * (mantissa(mts) * Math.pow(2, -126));
    } else {
        //zero, -zero
        res = (sgn > 0) ? 0 : -0;
    }
    return res;
}


