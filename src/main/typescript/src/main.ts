
import {Uuid} from "uuid-tool"
import * as rtc from "./rtc";
import * as signal from "./signal";

let parsedUrl = new URL(window.location.href);

if (! (parsedUrl.searchParams.get("u") && parsedUrl.searchParams.get("t")) ) {
    throw Error("Missing parameters \"u\" or \"t\" in URL");
}

const LOCAL_UUID = parsedUrl.searchParams.get("u") || "";

// MineCraft data WebSocket endpoint

let MCSocket = new WebSocket(`wss://${parsedUrl.host}/ws/mc${parsedUrl.search}`);

MCSocket.addEventListener("message", async ev =>  {
    let audioProcessingData = await audiodata.AudioProcessingData.fromBytes(ev.data as Blob);
    handleChannelsFromAudioProcessingData(audioProcessingData);
});

MCSocket.addEventListener("close", () => {
    throw Error("Incorrect login credentials")
});

type ConnectionAndStream = {
    connection: rtc.SignallingRTCPeerConnection,
    stream: audiodata.ProcessingMediaStream
};

const AUDIOS_DIV_QUERY_SELECTOR = "#audios";

let localStream: MediaStream;
navigator.mediaDevices.getUserMedia({audio: true, video: false})
    .then(stream => {localStream= stream});

const config: RTCConfiguration = {iceServers: [{ urls: "stun:stun.1.google.com:19302" }] };

const signallingChannel = new signal.WSSignallingChannel(`wss://${parsedUrl.host}/ws/rtc${parsedUrl.search}`);
const factory = new rtc.SignallingRTCPeerConnectionFactory(config, signallingChannel);

const channels: {[id: string]: ConnectionAndStream} = {};

function handleChannelsFromAudioProcessingData(audioProcessingData: audiodata.AudioProcessingData): void {
    
    for (const uuid in audioProcessingData) {
        let channel: ConnectionAndStream;

        if (channel = channels[uuid]) {
            channel.stream.processAudio(audioProcessingData[uuid])
        } else {
            channel = {connection: factory.createConnection(uuid), stream: new audiodata.ProcessingMediaStream()};
            configureChannel(channel);
            channels[uuid] = channel;
        }
    }

    for (const uuid in channels) {
        if (uuid in audioProcessingData) {
            continue;
        } else {
            channels[uuid].connection.close();
            delete channels[uuid];
            $('#'+channels[uuid].connection.to as string).remove();
        }
    }

}



function configureChannel(channel: ConnectionAndStream): void {
    //t0d0: add support for channel switching
    channel.connection.addTrack(localStream.getAudioTracks()[0]);

    channel.connection.addEventListener("connectionstatechange", () => {
        if (channel.connection.iceConnectionState === "disconnected") delete channels[channel.connection.to];
    });
    
    channel.connection.addEventListener("track", ev => {
        channel.stream.addTrack(ev.track);
    });

    $(AUDIOS_DIV_QUERY_SELECTOR)
    .append($("<audio/>", {srcObject: channel.stream, id: channel.connection.to}));
}

new Audio


namespace audiodata {

    /**The required data to process a single player audio channel */
    export interface ChannelProcessingData{
        gain: number,
        pan: number,
    }

    /**The required audio processing data to process each incoming player audio channel indexed by player UUID 
    * @see io.github.keyboardcat1.minertc.audio.AudioProcessingData
    */
    export class AudioProcessingData {
        [uuid: string]: ChannelProcessingData,
        /**
         * Convert a byte representation of an `AudioProcessingData` object into an object
         * @param data The bytes as a Blob
         * @returns An `AudioProcessingData` object constructed from the bytes
         */
        public static fromBytes(data: Blob): Promise<AudioProcessingData> {
            const reader = new FileReader();
            reader.readAsArrayBuffer(data);
            return new Promise(resolve => reader.addEventListener("loadend", () => {
                let out: AudioProcessingData = {};
                const BYTES = 24;
                let parsedData = new Uint8Array(reader.result as ArrayBufferLike);
                for (let i=0; i<parsedData.length; i+=BYTES) {
                    let uuid = new Uuid();
                    uuid.fromBytes(Array.from(parsedData.slice(i, i + 16)));
                    let gain = toFloat((parsedData[i+16] << 8*3) + (parsedData[i+17] << 8*2) + (parsedData[i+18] << 8*1) + (parsedData[i+19] << 8*0));
                    let pan = toFloat((parsedData[i+20] << 8*3) + (parsedData[i+21] << 8*2) + (parsedData[i+22] << 8*1) + (parsedData[i+23] << 8*0));
                    out[uuid.toString()] = {gain,pan,};
                }
                resolve(out)
            }));
        }
    }

    export class ProcessingMediaStream extends MediaStream {
        readonly audioContext: AudioContext = new AudioContext();
        readonly gainNode: GainNode;
        readonly stereoPannerNode: StereoPannerNode;
        
        constructor()
        constructor(stream: MediaStream)
        constructor(tracks: MediaStreamTrack[])
        constructor() {
            super();
    
            const source = this.audioContext.createMediaStreamSource(this);
    
            this.gainNode = this.audioContext.createGain();
            this.stereoPannerNode = this.audioContext.createStereoPanner();
    
            source.connect(this.gainNode);
            source.connect(this.stereoPannerNode);
    
            this.gainNode.connect(this.audioContext.destination);
            this.stereoPannerNode.connect(this.audioContext.destination);
        }
        
        processAudio(data: audiodata.ChannelProcessingData): void {
            this.gainNode.gain.setValueAtTime(data.gain, this.audioContext.currentTime);
            this.stereoPannerNode.pan.setValueAtTime(data.pan, this.audioContext.currentTime);
        }
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
}















