import * as signal from "./signal";

enum RTCSignalType {
    OFFER = "offer",
    ANSWER = "answer",
    CANDIDATE = "candidate",
}
type RTCSignallingData = {
    type: RTCSignalType;
    body: RTCSessionDescriptionInit | RTCIceCandidate | null;
}



export class SignallingRTCPeerConnection extends RTCPeerConnection {
    readonly to: signal.SignallingPortId;

    private readonly port: signal.SignallingPort;

    constructor(configuration: RTCConfiguration, port: signal.SignallingPort) {
        super(configuration);
        this.to = port.to;
        this.port = port;

        this.port.addEventListener("message", ev => {
            try {
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
                } 
            } catch (e) {}
        });

        super.addEventListener("icecandidate", ev => {
            let response: RTCSignallingData = {type: RTCSignalType.CANDIDATE, body: ev.candidate};
            this.port.send(response);
        });


        super.createOffer().then(offer => {
            this.setLocalDescription(offer);
            let response: RTCSignallingData = {type: RTCSignalType.OFFER, body: offer};
            this.port.send(response);
        });
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
            let data = ev.data as RTCSignallingData;
            if ((ev.from in this.connections) || data.type != RTCSignalType.OFFER) return;

            let accept: (s: IncomingOfferSignal) => SignallingRTCPeerConnection = (s) => {
                let connection = new SignallingRTCPeerConnection(this.configuration, this.channel.port(ev.from));
                let event = new signal.IncomingSignalEvent("signal", {from: s.from, data: s.data});
                this.connections[ev.from] = connection;
                this.channel.dispatchEvent(event);
                return connection;
            }
            let event = new OfferEvent("offer", {from: ev.from, data: ev.data, accept});
            if (this.onoffer) this.onoffer(event);
            this.dispatchEvent(event); 
        });
    }

    createConnection(to: signal.SignallingPortId): SignallingRTCPeerConnection {
        let connection = new SignallingRTCPeerConnection(this.configuration, this.channel.port(to));
        connection.addEventListener("iceconnectionstatechange", () => {
            if (connection.iceConnectionState === "disconnected") delete connection[connection.to];
        })
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


interface IncomingOfferSignal extends signal.IncomingSignal {
    data: {type: RTCSignalType.OFFER, body: RTCSessionDescriptionInit};
}
interface OfferEventInit extends EventInit, IncomingOfferSignal {
    accept: (s: IncomingOfferSignal) => SignallingRTCPeerConnection;
};
class OfferEvent extends Event {
    readonly from: signal.SignallingPortId;
    
    constructor(type: string, eventInitDict: OfferEventInit) {
        super(type, eventInitDict);
        this.from = eventInitDict.from;
        this.accept = () => eventInitDict.accept({from: eventInitDict.from, data: eventInitDict.data});
    }

    readonly accept: () => SignallingRTCPeerConnection;
}
