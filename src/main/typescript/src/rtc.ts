import * as signal from "./signal";

enum RTCSignalType {
    OFFER = "offer",
    ANSWER = "answer",
    CANDIDATE = "candidate",
    LEAVE = "leave",
}
type RTCSignallingData = {
    type: RTCSignalType;
    body: RTCSessionDescriptionInit | RTCIceCandidate | null;
}



interface SignallingRTCPeerConnectionEventMap extends RTCPeerConnectionEventMap{
    leave: Event;
    contact: Event;
}

export class SignallingRTCPeerConnection extends RTCPeerConnection {
    readonly to: signal.SignallingPortId;

    onleave: (ev: Event) => any | null;
    oncontact: (ev: Event) => any | null;

    private readonly port: signal.SignallingPort;
    private CONTACTED: boolean;

    constructor(configuration: RTCConfiguration, port: signal.SignallingPort) {
        super(configuration);
        this.to = port.to;
        this.port = port;

        this.port.addEventListener("message", ev => {
        this.CONTACTED = true
        let data: RTCSignallingData = JSON.parse(ev.data) as RTCSignallingData;
        switch (data.type) {
            case RTCSignalType.OFFER:
                this.setRemoteDescription(data.body as RTCSessionDescriptionInit);
                this.createAnswer().then(answer => {
                let response: RTCSignallingData = {type: RTCSignalType.ANSWER, body: answer};
                this.port.send(response);
                });
                break;
            case RTCSignalType.ANSWER:
                this.setRemoteDescription(data.body as RTCSessionDescriptionInit);
                break;
            case RTCSignalType.CANDIDATE:
                this.addIceCandidate(data.body as RTCIceCandidate);
                break;
            case RTCSignalType.LEAVE:
                let event = new Event("leave");
                if (this.onleave) this.onleave(event);
                this.dispatchEvent(event);
                super.close();
                break;
        }
        let event = new Event("contact");
        if (this.oncontact) this.oncontact(event);
        this.dispatchEvent(event);
        });

        super.addEventListener("icecandidate", ev => {
        let response: RTCSignallingData = {type: RTCSignalType.CANDIDATE, body: ev.candidate};
        this.port.send(response);
        });

        this.createOffer().then(offer => {
        this.setLocalDescription(offer);
        let response: RTCSignallingData = {type: RTCSignalType.OFFER, body: offer};
        this.port.send(response);
        })
    }

    close(): void {
        let response: RTCSignallingData = {type: RTCSignalType.LEAVE, body: null};
        this.port.send(response);
        super.close();
    }

    addEventListener<K extends keyof SignallingRTCPeerConnectionEventMap>(
        type: K,
        callback: (ev: SignallingRTCPeerConnectionEventMap[K]) => any,
        options?: boolean | AddEventListenerOptions
    ): void;
    addEventListener(
        type: string,
        callback: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions | undefined
    ): void {
        super.addEventListener(type, callback, options);
    }

    removeEventListener<K extends keyof SignallingRTCPeerConnectionEventMap>(
        type: K,
        callback: (ev: SignallingRTCPeerConnectionEventMap[K]) => any,
        options?: boolean | AddEventListenerOptions
    ): void;
    removeEventListener(
        type: string,
        callback: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions | undefined
    ): void {
        super.removeEventListener(type, callback, options);
    }
}


interface SignallingRTCPeerConnectionFactoryEventMap {
    offer: OfferEvent;
    [ev: string]: Event;
}

export class SignallingRTCPeerConnectionFactory extends EventTarget {
    onoffer: (ev: OfferEvent) => any | null;

    private readonly connections: {[to: signal.SignallingPortId]: SignallingRTCPeerConnection} = {};
    private readonly channel: signal.SignallingChannel;
    private readonly configuration: RTCConfiguration;

    constructor(configuration: RTCConfiguration, channel: signal.SignallingChannel) {
        super();
        this.channel = channel;
        this.configuration = configuration;

        this.channel.addEventListener("signal", ev => {
        if (!(ev.from in this.connections)) {
            let connection: SignallingRTCPeerConnection = new SignallingRTCPeerConnection(this.configuration, this.channel.port(ev.from));
            let event = new OfferEvent("offer", {connection});
            if (this.onoffer) this.onoffer(event);
            this.dispatchEvent(event);
        }
        });
    }

    createConnection(to: signal.SignallingPortId): SignallingRTCPeerConnection {
        let connection = new SignallingRTCPeerConnection(this.configuration, this.channel.port(to));
        connection.addEventListener("leave", () => delete this.connections[to]);
        return connection;
    }

    addEventListener<K extends keyof SignallingRTCPeerConnectionFactoryEventMap>(
        type: K,
        callback: (ev: SignallingRTCPeerConnectionFactoryEventMap[K]) => any,
        options?: boolean | AddEventListenerOptions
    ): void;
    addEventListener(
        type: string,
        callback: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions | undefined
    ): void {
        super.addEventListener(type, callback, options);
    }

    removeEventListener<K extends keyof SignallingRTCPeerConnectionFactoryEventMap>(
        type: K,
        callback: (ev: SignallingRTCPeerConnectionFactoryEventMap[K]) => any,
        options?: boolean | AddEventListenerOptions
    ): void;
    removeEventListener(
        type: string,
        callback: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions | undefined
    ): void {
        super.removeEventListener(type, callback, options);
    }
}

interface OfferEventInit extends EventInit {
    connection: SignallingRTCPeerConnection;
}
class OfferEvent extends Event {
    connection: SignallingRTCPeerConnection;
    
    constructor(type: string, eventInitDict: OfferEventInit) {
        super(type, eventInitDict);
        this.connection = eventInitDict.connection;
    }
}
