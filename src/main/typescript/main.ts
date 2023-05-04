import { Uuid, UuidTool } from "uuid-tool";



class Channel {
    public connection: RTCPeerConnection;
    public context: AudioContext;
    public gain: GainNode;
    public pan: StereoPannerNode;
}

interface AudioProcessingData {
    [uuid: string]: ChannelProcessingData,
}

interface ChannelProcessingData{
    gain: number,
    pan: number,
}

interface RTCPacket {
    from: string,
    to: string,
    type: RTCPacketType,
    body: RTCSessionDescriptionInit | RTCIceCandidate,
}

enum RTCPacketType {
    OFFER = "offer",
    ANSWER = "answer",
    CANDIDATE = "candidate",
}





const channels: {[uuid: string] : Channel} = {};

const parsedUrl = new URL(window.location.href);

if (! (parsedUrl.searchParams.get('u') && parsedUrl.searchParams.get('t')) ) {
    throw Error('Missing parameters "u" or "t" in URL');
}

const localUuid = parsedUrl.searchParams.get('u') || '';



// MINECRAFT (MAIN)

let MCSocket = new WebSocket(`ws://${parsedUrl.host}/ws/mc${parsedUrl.search}`);

MCSocket.onmessage = async ev =>  {
    let audioProcessingData = await fromBytes(ev.data);
    handleRTC(audioProcessingData);
    handleAudio(audioProcessingData);
}

MCSocket.onclose = () => {
    throw Error('Incorrect login credentials')
};



// WEBRTC

let RTCSocket = new WebSocket(`ws://${parsedUrl.host}/ws/rtc${parsedUrl.search}`);

function handleRTC(audioProcessingData: AudioProcessingData): void {
    // initate connections not in channels
    for (const uuid in audioProcessingData) {
        if (uuid in channels) continue;
        initChannel(uuid);
    }

    // close connections not in audioProcessingData
    for (const uuid in channels) {
        if (uuid in audioProcessingData) continue;
        endChannel(uuid);
    }
}

function initChannel(uuid: string): void {
    let channel = new Channel();

    const config = {iceServers: [{urls: 'stun:stun2.1.google.com:19302'}]};

    channel.connection = new RTCPeerConnection(config);

    // add local track to connection
    channel.connection.addTrack(localStream.getAudioTracks()[0]);
    //manage audio nodes and element
    channel.connection.ontrack = ev => initAudioFromTrack(uuid, ev.track);
    //send ICE candidate whenever we receive one
    channel.connection.onicecandidate = ev => send(RTCPacketType.CANDIDATE, uuid, ev.candidate as RTCIceCandidate);

    //initiate offer only if prioritized
    if (localUuid > uuid) {
        channel.connection.createOffer()
            .then(offer => {
                send(RTCPacketType.CANDIDATE, uuid, offer);
                channel.connection.setLocalDescription(offer);
            })
    }

    channels[uuid] = channel;
    
}

function endChannel(uuid: string): void {
    $(`#${uuid}`).remove()
    channels[uuid].connection.close()
    delete channels[uuid]
}

RTCSocket.onmessage = ev => {
    let data: RTCPacket = JSON.parse(ev.data);
    if (data.to != localUuid || !channels[data.from].connection) return;
    
    switch (data.type) {
        case RTCPacketType.OFFER:
            handleOffer(data);
            break;
        case RTCPacketType.ANSWER:
            handleAnswer(data);
            break;
        case RTCPacketType.CANDIDATE:
            handleCandidate(data);
            break;
    }
}

function handleOffer(data: RTCPacket): void {
    let conn = channels[data.from].connection

    conn.setRemoteDescription(new RTCSessionDescription(data.body as RTCSessionDescriptionInit))

    //create an answer to an offer and send it to
    conn.createAnswer()
        .then( answer => send(RTCPacketType.ANSWER, data.from, answer) )
}

function handleAnswer(data: RTCPacket): void {
    let conn = channels[data.from].connection
    conn.setRemoteDescription(new RTCSessionDescription(data.body as RTCSessionDescriptionInit))
}

//when we got an ice candidate from a remote user
function handleCandidate(data: RTCPacket): void {
    let conn = channels[data.from].connection
    conn.addIceCandidate(new RTCIceCandidate(data.body as RTCIceCandidate))
}



// AUDIO

let localStream: MediaStream;
navigator.mediaDevices.getUserMedia({audio: true, video: false})
    .then(stream => {localStream = stream})

function initAudioFromTrack(uuid: string, track: MediaStreamTrack): void {
    
    let stream = new MediaStream();
    stream.addTrack(track);

    let channel = channels[uuid];

    //create GainNode and StereoPannerNode for given uuid and create audio element
    channel.context = new AudioContext();

    const source = channel.context.createMediaStreamSource(stream);
    
    channel.gain = channel.context.createGain();
    channel.pan = channel.context.createStereoPanner();

    source.connect(channel.gain);
    source.connect(channel.pan);

    channel.gain.connect(channel.context.destination);
    channel.pan.connect(channel.context.destination);

    //create audio elements
    $('#audios').append($('<audio/>', {srcObject: stream, id: uuid}));
}

function handleAudio(audioProcessingData: AudioProcessingData): void {
    for (const [uuid, channel] of Object.entries(channels)){
        if (!channel.context) return;
        channel.gain.gain.setValueAtTime(audioProcessingData[uuid].gain, channel.context.currentTime);
        channel.pan.pan.setValueAtTime(audioProcessingData[uuid].pan, channel.context.currentTime);
    }
    

}



// UTIL

//send data
function send(type: RTCPacketType, to: string, body: RTCSessionDescriptionInit | RTCIceCandidate) {
    RTCSocket.send(JSON.stringify({
        type,
        from: localUuid,
        to,
        body,
    }))
}

//AudioProcessingData.tobytes() but in reverse
function fromBytes(data: any): Promise<AudioProcessingData> {

    const reader = new FileReader();
    reader.readAsArrayBuffer(data);
    
    return new Promise(resolve => reader.onloadend = () => {
        let out: AudioProcessingData = {};

        const BYTES = 24;
        let parsedData = new Uint8Array(reader.result as ArrayBufferLike);
        for (let i=0; i<parsedData.length; i+=BYTES) { //for each chunk of bytes encoding (UUID, AudioProcessingData.ChannelProcessingData)
            let uuid = new Uuid();

            // UUID from first 16 bytes of chunk
            uuid.fromBytes(Array.from(parsedData.slice(i, i + 16)));

            //AudioProcessingData.ChannelProcessingData.gain from the following 4 bytes of chunk
            let gain = toFloat((parsedData[i+16] << 8*3) + (parsedData[i+17] << 8*2) + (parsedData[i+18] << 8*1) + (parsedData[i+19] << 8*0));

            //AudioProcessingData.ChannelProcessingData.pan from the last 4 bytes of chunk
            let pan = toFloat((parsedData[i+20] << 8*3) + (parsedData[i+21] << 8*2) + (parsedData[i+22] << 8*1) + (parsedData[i+23] << 8*0));

            out[uuid.toString()] = {
                gain,
                pan,
            };
        }

        resolve(out)
    })
}

//bytes of uint32 to float32
function toFloat (n: number): number {

    n= +n;
    let res: number;
    let mts= n & 0x007fffff;
    let sgn= (n & 0x80000000) ? -1 : 1;
    let exp= (n & 0x7f800000) >>> 23;
    
    function mantissa (mts: number): number {
        let bit= 0x00400000;
        while (mts && bit) {
            mts/= 2;
            bit>>>= 1;
        }
        return mts;
    }

    if (exp === 0xff) {
        //NaN or +/- Infinity
        res= mts ? NaN : sgn * Infinity;
    } else if (exp) {
        //Normalized value
        res= sgn * ((1 + mantissa(mts)) * Math.pow(2, exp-127));
    } else if (mts) {
        //Subnormal
        res= sgn* (mantissa(mts)* Math.pow(2, -126));
    } else {
        //zero, -zero
        res= (sgn > 0) ? 0 : -0;
    }

    return res;
}

////bytes of uint32 to float32
//function toFloat($: number): number{var f,_=8388607&($=+$),r=2147483648&$?-1:1,n=(2139095040&$)>>>23;function o($){for(var f=4194304;$&&f;)$/=2,f>>>=1;return $}return 255===n?_?NaN:r*(1/0):n?r*((1+o(_))*Math.pow(2,n-127)):_?r*(11754943508222875e-54*o(_)):0}
