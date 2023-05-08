const { Uuid } = require('uuid-tool');



let parsedUrl = new URL(window.location.href);

if (! (parsedUrl.searchParams.get('u') && parsedUrl.searchParams.get('t')) ) {
    throw Error('Missing parameters "u" or "t" in URL');
}

const LOCAL_UUID = parsedUrl.searchParams.get('u') || '';

// MineCraft data WebSocket endpoint

let MCSocket = new WebSocket(`wss://${parsedUrl.host}/ws/mc${parsedUrl.search}`);

MCSocket.onmessage = async ev =>  {
    let audioProcessingData = await audio.AudioProcessingData.fromBytes(ev.data as Blob);
    audio.handleChannelsFromAudioProcessingData(audioProcessingData);
}

MCSocket.onclose = () => {
    throw Error('Incorrect login credentials')
};







namespace audio {
    /**The query selector __uniquely__ designating a `div` containing the `audio` elements */
    export let AUDIOS_DIV_QUERY_SELECTOR = "#audios";

    /**A class representing the required audio processing data to process each incoming player audio channel indexed by player UUID 
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
    }

    /**An interface representing the required audio processing data to process a single incoming audio channel */
    export interface ChannelProcessingData{
        gain: number,
        pan: number,
    }

    /** The collection of channels*/
    export const channels: {[uuid: string]: Channel}  = {};

    /**
     * Create, delete and process audio channels based on an `AudioProcessingData` object
     * @param audioProcessingData A `AudioProcessingData` object
     */
    export function handleChannelsFromAudioProcessingData(audioProcessingData: AudioProcessingData) {
        for (const uuid in audioProcessingData) {
            if (uuid in channels) {
                channels[uuid].processAudio(audioProcessingData[uuid])
            } else {
                channels[uuid] = new Channel(uuid);
            }
        }

        for (const uuid in channels) {
            if (uuid in audioProcessingData) {
                continue;
            } else {
                channels[uuid].delete();
                delete channels[uuid];
            }
        }

    }

    /**
     * A class representing an incoming audio channel
     */

    export class Channel {
        /**
         * This channel's UUID
         */
        public readonly uuid: string;
        
        private connection: RTCPeerConnection;

        private context: AudioContext;
        private gain: GainNode;
        private pan: StereoPannerNode;
        
        /**
         * Initialize a channel alongside its WebRTC connection and audio element
         * @param uuid This channel's UUID
         */
        constructor (uuid: string) {
            this.uuid = uuid;
            const config = {iceServers: [{urls: 'stun:stun2.1.google.com:19302'}]};
        
            this.connection = new RTCPeerConnection(config);
        
            // add local track to connection
            this.connection.addTrack(localStream.getAudioTracks()[0]);
            //manage audio nodes and element
            this.connection.ontrack = ev => this.initAudioFromTrack(ev.track);
            //send ICE candidate whenever we receive one
            this.connection.onicecandidate = ev => send(RTCPacketType.CANDIDATE, this.uuid, ev.candidate as RTCIceCandidate);
        
            //initiate offer only if prioritized
            if (LOCAL_UUID > this.uuid) {
                this.connection.createOffer()
                    .then(offer => {
                        send(RTCPacketType.CANDIDATE, this.uuid, offer);
                        this.connection.setLocalDescription(offer);
                    })
            }
        }
        
        /**
         * Delete the x `audio` element and close the WebRTC connection associated with this object
         */
        public delete(): void {
            $(`#${this.uuid}`).remove();
            this.connection.close();
        }
        
        /**
         * Apply processing data to the audio associated with this object
         * @param channelProcessingData A `ChannelProcessingData`object  
         */
        public processAudio(channelProcessingData: ChannelProcessingData): void {
            if (!this.context) return;
            this.gain.gain.setValueAtTime(channelProcessingData.gain, this.context.currentTime);
            this.pan.pan.setValueAtTime(channelProcessingData.pan, this.context.currentTime);
        }
        /**
         * @private
         */
        public handleRTCPakcet (packet: RTCPacket) {
            if (packet.to != LOCAL_UUID || !this.connection) return;
                
            switch (packet.type) {
                case RTCPacketType.OFFER:
                    this.connection.setRemoteDescription(new RTCSessionDescription(packet.body as RTCSessionDescriptionInit))
                    this.connection.createAnswer()
                        .then( answer => send(RTCPacketType.ANSWER, packet.from, answer) )
                    break;
                case RTCPacketType.ANSWER:
                    this.connection.setRemoteDescription(new RTCSessionDescription(packet.body as RTCSessionDescriptionInit))
                    break;
                case RTCPacketType.CANDIDATE:
                    this.connection.addIceCandidate(new RTCIceCandidate(packet.body as RTCIceCandidate))
                    break;
            }
        }
    
        private initAudioFromTrack(track: MediaStreamTrack): void {
        
            let stream = new MediaStream();
            stream.addTrack(track);
        
            //create GainNode and StereoPannerNode for given uuid and create audio element
            this.context = new AudioContext();
        
            const source = this.context.createMediaStreamSource(stream);
            
            this.gain = this.context.createGain();
            this.pan = this.context.createStereoPanner();
        
            source.connect(this.gain);
            source.connect(this.pan);
        
            this.gain.connect(this.context.destination);
            this.pan.connect(this.context.destination);
        
            //create audio elements
            $(AUDIOS_DIV_QUERY_SELECTOR).append($('<audio/>', {srcObject: stream, id: this.uuid}));
        }
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

    let localStream: MediaStream;
    navigator.mediaDevices.getUserMedia({audio: true, video: false})
        .then(stream => {localStream= stream})
    
    const RTCSocket = new WebSocket(`wss://${parsedUrl.host}/ws/rtc${parsedUrl.search}`);
    RTCSocket.onmessage = ev => {
        let packet: RTCPacket = JSON.parse(ev.data);
        if (channels[packet.from])
            channels[packet.from].handleRTCPakcet(packet)
    }
    

    function send(type: RTCPacketType, to: string, body: RTCSessionDescriptionInit | RTCIceCandidate) {
        RTCSocket.send(JSON.stringify({
            type,
            from: LOCAL_UUID,
            to,
            body,
        }))
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
