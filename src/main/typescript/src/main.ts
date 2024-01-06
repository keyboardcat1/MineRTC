import {Uuid} from "uuid-tool"
import * as ezrtc from "@keyboardcat1/ezrtc"


let parsedUrl = new URL(window.location.href)
if (! (parsedUrl.searchParams.get("u") && parsedUrl.searchParams.get("t")) ) {
    throw Error("Missing parameters \"u\" or \"t\" in URL")
}

// CONFIG
const MC_ENDPOINT = `wss://${parsedUrl.host}/ws/mc${parsedUrl.search}`
const RTC_ENDPOINT = `wss://${parsedUrl.host}/ws/rtc${parsedUrl.search}`

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.1.google.com:19302" }]

const AUDIOS_DIV_QUERY_SELECTOR = "#audios"



// MINECRAFT DATA
let audioProcessingData: audio.AudioProcessingData

let MCSocket = new WebSocket(MC_ENDPOINT)

MCSocket.addEventListener("message", async ev =>  {
    audioProcessingData = await audio.AudioProcessingData.fromBytes(ev.data as Blob)
    handleChannelsFromAudioProcessingData(audioProcessingData)
})

MCSocket.addEventListener("close", () => {
    throw Error("Incorrect login credentials")
})





const streams: {[id: string]: audio.ProcessedRTCHTMLMediaStream} = {}

let localStream: MediaStream
navigator.mediaDevices.getUserMedia({audio: true, video: false})
    .then(stream => {localStream= stream})

const rtcConfig: RTCConfiguration = {iceServers: ICE_SERVERS }

const signallingChannel = new ezrtc.signalling.WSSignallingChannel(`wss://${parsedUrl.host}/ws/rtc${parsedUrl.search}`)
const factory = new ezrtc.rtc.SignallingRTCPeerConnectionFactory(signallingChannel, rtcConfig)

factory.addEventListener("offer", ev => {
    if (!(ev.from in audioProcessingData)) return

    let element = new HTMLAudioElement()
    element.id = ev.from

    let stream = new audio.ProcessedRTCHTMLMediaStream(ev.accept(), element)
    
    stream.connection.addTrack(localStream.getAudioTracks()[0])
    $(AUDIOS_DIV_QUERY_SELECTOR).append(element)

    streams[ev.from] = stream
})

function handleChannelsFromAudioProcessingData(audioProcessingData: audio.AudioProcessingData): void {
    
    for (const uuid in audioProcessingData) {
        let stream: audio.ProcessedRTCHTMLMediaStream

        if (stream = streams[uuid]) {
            stream.processAudio(audioProcessingData[uuid])
        } else {
            let element = new HTMLAudioElement()
            element.id = uuid

            stream = new audio.ProcessedRTCHTMLMediaStream(factory.createConnection(uuid), element)
            
            stream.connection.addTrack(localStream.getAudioTracks()[0])
            $(AUDIOS_DIV_QUERY_SELECTOR).append(element)
            
            streams[uuid] = stream
        }
    }

    for (const uuid in streams) {
        if (uuid in audioProcessingData) {
            continue
        } else {
            streams[uuid].connection.close()
            $(streams[uuid].element).remove()
            delete streams[uuid]
        }
    }

}



namespace audio {
/**
 * The required data to process a single player audio stream
 */
export interface StreamProcessingData{
    gain: number,
    pan: number,
}

/**A class representing the required audio processing data to process each incoming player audio stream indexed by player UUID 
* @see io.github.keyboardcat1.minertc.audio.AudioProcessingData
*/
export class AudioProcessingData {
    [uuid: string]: StreamProcessingData,
    /**
     * Convert a byte representation of an `AudioProcessingData` object into an object
     * @param data The bytes as a Blob
     * @returns An {@link AudioProcessingData} object constructed from the bytes
     */
    public static fromBytes(data: Blob): Promise<AudioProcessingData> {
        const reader = new FileReader()
        reader.readAsArrayBuffer(data)
        return new Promise(resolve => reader.addEventListener("loadend", () => {
            let out: AudioProcessingData = {}
            const BYTES = 24
            let parsedData = new Uint8Array(reader.result as ArrayBufferLike)
            for (let i=0; i<parsedData.length; i+=BYTES) {
                let uuid = new Uuid()
                uuid.fromBytes(Array.from(parsedData.slice(i, i + 16)))
                let gain = toFloat((parsedData[i+16] << 8*3) + (parsedData[i+17] << 8*2) + (parsedData[i+18] << 8*1) + (parsedData[i+19] << 8*0))
                let pan = toFloat((parsedData[i+20] << 8*3) + (parsedData[i+21] << 8*2) + (parsedData[i+22] << 8*1) + (parsedData[i+23] << 8*0))
                out[uuid.toString()] = {gain,pan,}
            }
            resolve(out)
        }))
    }
}

export class ProcessedRTCHTMLMediaStream extends ezrtc.utils.RTCHTMLMediaStream {
    private audioContext = new AudioContext()
    private gainNode = this.audioContext.createGain()
    private stereoPannerNode = this.audioContext.createStereoPanner()

    constructor(connection: RTCPeerConnection, element: HTMLMediaElement) {
        super(connection, element)

        const source = this.audioContext.createMediaStreamSource(this)

        source.connect(this.gainNode)
        source.connect(this.stereoPannerNode)

        this.gainNode.connect(this.audioContext.destination)
        this.stereoPannerNode.connect(this.audioContext.destination)
    }

    processAudio(data: audio.StreamProcessingData): void {
        this.gainNode.gain.setValueAtTime(data.gain, this.audioContext.currentTime)
        this.stereoPannerNode.pan.setValueAtTime(data.pan, this.audioContext.currentTime)
    }
}

//bytes of uint32 to float32
function toFloat (n: number): number {
    n= +n
    let res: number
    let mts= n & 0x007fffff
    let sgn= (n & 0x80000000) ? -1 : 1
    let exp= (n & 0x7f800000) >>> 23
    function mantissa (mts: number): number {
        let bit= 0x00400000
        while (mts && bit) {
            mts/= 2
            bit>>>= 1
        }
        return mts
    }
    if (exp === 0xff) {
        //NaN or +/- Infinity
        res= mts ? NaN : sgn * Infinity
    } else if (exp) {
        //Normalized value
        res= sgn * ((1 + mantissa(mts)) * Math.pow(2, exp-127))
    } else if (mts) {
        //Subnormal
        res= sgn* (mantissa(mts)* Math.pow(2, -126))
    } else {
        //zero, -zero
        res= (sgn > 0) ? 0 : -0
    }
    return res
}
}
















